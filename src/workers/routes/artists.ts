/**
 * Artist route handlers for artist profile management
 *
 * Provides endpoints for artist CRUD operations:
 * - GET /api/artists - List artists with search/filter
 * - GET /api/artists/:id - Get artist profile with artworks
 * - PUT /api/artists/:id - Submit artist profile edits (queued for moderation)
 * - POST /api/artists - Create artist profile (authenticated users)
 */

import type { Context } from 'hono';
import type {
  ArtistRecord,
  ArtistApiResponse,
  CreateArtistRequest,
  CreateArtistEditRequest,
  ArtistEditSubmissionResponse,
  ArtistPendingEditsResponse,
  ArtworkWithPhotos,
  ArtworkRecord,
} from '../../shared/types';
import type { WorkerEnv } from '../types';
import { createDatabaseService } from '../lib/database';
import { createSuccessResponse, ValidationApiError, NotFoundError } from '../lib/errors';
import { getUserToken } from '../middleware/auth';
import { getValidatedData } from '../middleware/validation';
import { safeJsonParse } from '../lib/errors';

// UUID generation function
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * GET /api/artists - List Artists (Index Page)
 * Returns paginated list of artists with optional search/filter
 * Updated to match PRD requirements for index pages
 */
export async function getArtistsList(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const validatedQuery = getValidatedData<{
    page?: number;
    limit?: number;
    sort?: 'updated_desc' | 'name_asc' | 'created_desc';
    search?: string;
    status?: 'active' | 'inactive';
  }>(c, 'query');

  const db = createDatabaseService(c.env.DB);
  
  // Set defaults per PRD
  const page = Math.max(validatedQuery.page || 1, 1);
  const limit = Math.min(validatedQuery.limit || 30, 50);
  const sort = validatedQuery.sort || 'updated_desc';
  const offset = (page - 1) * limit;

  try {
    // Build WHERE clause with filters
    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];
    
    if (validatedQuery.status) {
      whereClause += ' AND a.status = ?';
      params.push(validatedQuery.status);
    } else {
      // Default to active artists only
      whereClause += ' AND a.status = ?';
      params.push('active');
    }
    
    if (validatedQuery.search) {
      whereClause += ' AND a.name LIKE ?';
      params.push(`%${validatedQuery.search}%`);
    }

    // Build ORDER BY clause
    let orderClause = '';
    switch (sort) {
      case 'name_asc':
        orderClause = 'ORDER BY a.name ASC';
        break;
      case 'created_desc':
        orderClause = 'ORDER BY a.created_at DESC';
        break;
      case 'updated_desc':
      default:
        orderClause = 'ORDER BY COALESCE(a.updated_at, a.created_at) DESC';
        break;
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM artists a
      ${whereClause}
    `;
    
    const countResult = await db.db.prepare(countQuery)
      .bind(...params)
      .first() as { total: number };
    
    const totalItems = countResult.total;
    const totalPages = Math.ceil(totalItems / limit);

    // Validate page number
    if (page > totalPages && totalItems > 0) {
      return c.json({
        error: 'Page not found',
        message: `Page ${page} does not exist. Total pages: ${totalPages}`,
      }, 404);
    }

    // Get artists with artwork count
    const artistsQuery = `
      SELECT a.*, 
             COUNT(aa.artwork_id) as artwork_count
      FROM artists a
      LEFT JOIN artwork_artists aa ON a.id = aa.artist_id
      ${whereClause}
      GROUP BY a.id
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const artists = await db.db.prepare(artistsQuery)
      .bind(...params, limit, offset)
      .all();

    // Format response with short bio (~20 words)
    const formattedArtists: import('../../shared/types').ArtistApiResponse[] = (artists.results as unknown as (import('../../shared/types').ArtistRecord & { artwork_count: number })[])?.map((artist) => {
      // Truncate description to ~20 words for card display
      let shortBio = artist.description || '';
      if (shortBio) {
        const words = shortBio.split(/\s+/);
        if (words.length > 20) {
          shortBio = words.slice(0, 20).join(' ') + '...';
        }
      }

      return {
        ...artist,
        tags_parsed: safeJsonParse(artist.tags, {}),
        artwork_count: artist.artwork_count || 0,
        short_bio: shortBio,
      };
    }) || [];

    // Set cache headers for 1 hour as per PRD
    c.header('Cache-Control', 'public, max-age=3600');

    const response: import('../../shared/types').ArtistIndexResponse = {
      totalItems,
      currentPage: page,
      totalPages,
      items: formattedArtists,
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Failed to get artists list:', error);
    throw error;
  }
}

/**
 * GET /api/artists/:id - Get Artist Profile
 * Returns artist details with their artworks
 */
export async function getArtistProfile(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const artistId = c.req.param('id');
  
  if (!artistId) {
    throw new ValidationApiError([{
      field: 'artist_id',
      message: 'Artist ID is required',
      code: 'REQUIRED_FIELD',
    }]);
  }

  const db = createDatabaseService(c.env.DB);

  try {
    // Get artist details
    const artistStmt = db.db.prepare(`
      SELECT * FROM artists 
      WHERE id = ? AND status = 'active'
    `);
    const artist = await artistStmt.bind(artistId).first() as ArtistRecord | null;

    if (!artist) {
      throw new NotFoundError(`Artist not found: ${artistId}`);
    }

    // Get artist's artworks
    const artworksStmt = db.db.prepare(`
      SELECT 
        a.id, a.lat, a.lon, a.type_id, a.created_at, a.status, 
        a.tags, a.title, a.description, a.created_by,
        at.name as type_name,
        (
          SELECT l.photos
          FROM logbook l
          WHERE l.artwork_id = a.id 
            AND l.status = 'approved' 
            AND l.photos IS NOT NULL 
            AND l.photos != '[]'
          ORDER BY l.created_at DESC
          LIMIT 1
        ) as recent_photos,
        (
          SELECT COUNT(*)
          FROM logbook l
          WHERE l.artwork_id = a.id 
            AND l.status = 'approved' 
            AND l.photos IS NOT NULL 
            AND l.photos != '[]'
        ) as photo_count
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
      JOIN artwork_artists aa ON a.id = aa.artwork_id
      WHERE aa.artist_id = ? AND a.status = 'approved'
      ORDER BY a.created_at DESC
    `);
    
    const artworks = await artworksStmt.bind(artistId).all();

    // Format artworks
    const formattedArtworks: ArtworkWithPhotos[] = (artworks.results as unknown as (ArtworkRecord & { recent_photos?: string; photo_count?: number; type_name: string })[])?.map((artwork) => {
      const result: ArtworkWithPhotos = {
        ...artwork,
        photo_count: artwork.photo_count || 0,
      };
      
      if (artwork.recent_photos) {
        const photos = safeJsonParse<string[]>(artwork.recent_photos, []);
        if (photos.length > 0 && photos[0]) {
          result.recent_photo = photos[0];
        }
      }
      
      return result;
    }) || [];

    const response: ArtistApiResponse = {
      ...artist,
      tags_parsed: safeJsonParse(artist.tags, {}),
      artwork_count: formattedArtworks.length,
      artworks: formattedArtworks,
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    console.error('Failed to get artist profile:', error);
    throw error;
  }
}

/**
 * POST /api/artists - Create Artist Profile
 * Allows authenticated users to create new artist profiles
 */
export async function createArtist(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  
  if (!userToken) {
    throw new ValidationApiError([{
      field: 'user_token',
      message: 'Authentication required',
      code: 'REQUIRED_AUTH',
    }]);
  }

  const requestBody = await c.req.json().catch(() => {
    throw new ValidationApiError([{
      field: 'request_body',
      message: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    }]);
  });

  const request = requestBody as CreateArtistRequest;
  
  // Validate required fields
  if (!request.name?.trim()) {
    throw new ValidationApiError([{
      field: 'name',
      message: 'Artist name is required',
      code: 'REQUIRED_FIELD',
    }]);
  }

  const db = createDatabaseService(c.env.DB);
  const artistId = generateUUID();

  try {
    // Create artist
    const insertStmt = db.db.prepare(`
      INSERT INTO artists (id, name, description, tags, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    await insertStmt.bind(
      artistId,
      request.name.trim(),
      request.description?.trim() || null,
      request.tags ? JSON.stringify(request.tags) : '{}',
      request.status || 'active'
    ).run();

    // Get the created artist
    const artistStmt = db.db.prepare('SELECT * FROM artists WHERE id = ?');
    const artist = await artistStmt.bind(artistId).first() as ArtistRecord;

    const response: ArtistApiResponse = {
      ...artist,
      tags_parsed: safeJsonParse(artist.tags, {}),
      artwork_count: 0,
      artworks: [],
    };

    return c.json(createSuccessResponse(response, 'Artist profile created successfully'));
  } catch (error) {
    console.error('Failed to create artist:', error);
    throw error;
  }
}

/**
 * PUT /api/artists/:id - Submit Artist Edits
 * Allows authenticated users to propose edits to artist profiles
 */
export async function submitArtistEdit(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  const artistId = c.req.param('id');
  
  if (!artistId) {
    throw new ValidationApiError([{
      field: 'artist_id',
      message: 'Artist ID is required',
      code: 'REQUIRED_FIELD',
    }]);
  }

  if (!userToken) {
    throw new ValidationApiError([{
      field: 'user_token',
      message: 'Authentication required',
      code: 'REQUIRED_AUTH',
    }]);
  }

  const requestBody = await c.req.json().catch(() => {
    throw new ValidationApiError([{
      field: 'request_body',
      message: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    }]);
  });

  const request = requestBody as CreateArtistEditRequest;
  
  if (!request.edits || !Array.isArray(request.edits) || request.edits.length === 0) {
    throw new ValidationApiError([{
      field: 'edits',
      message: 'At least one edit is required',
      code: 'REQUIRED_FIELD',
    }]);
  }

  const db = createDatabaseService(c.env.DB);

  try {
    // Check if artist exists
    const artistStmt = db.db.prepare('SELECT id FROM artists WHERE id = ?');
    const artist = await artistStmt.bind(artistId).first();
    
    if (!artist) {
      throw new NotFoundError(`Artist not found: ${artistId}`);
    }

    // Check for existing pending edits by this user
    const existingEditStmt = db.db.prepare(`
      SELECT edit_id FROM artist_edits 
      WHERE artist_id = ? AND user_token = ? AND status = 'pending'
      LIMIT 1
    `);
    const existingEdit = await existingEditStmt.bind(artistId, userToken).first();
    
    if (existingEdit) {
      throw new ValidationApiError([{
        field: 'pending_edits',
        message: 'You already have pending edits for this artist',
        code: 'DUPLICATE_PENDING_EDIT',
      }]);
    }

    // Insert edit records
    const insertEditStmt = db.db.prepare(`
      INSERT INTO artist_edits (
        edit_id, artist_id, user_token, field_name, 
        field_value_old, field_value_new
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const editId = generateUUID();
    
    for (const edit of request.edits) {
      await insertEditStmt.bind(
        editId,
        artistId,
        userToken,
        edit.field_name,
        edit.field_value_old,
        edit.field_value_new
      ).run();
    }

    const response: ArtistEditSubmissionResponse = {
      edit_id: editId,
      status: 'pending',
      message: 'Artist edits submitted for moderation',
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationApiError) {
      throw error;
    }
    console.error('Failed to submit artist edit:', error);
    throw error;
  }
}

/**
 * GET /api/artists/:id/pending-edits - Check User's Pending Edits for Artist
 * Returns information about any pending edits the user has submitted
 */
export async function getUserPendingArtistEdits(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  const artistId = c.req.param('id');
  
  if (!artistId) {
    throw new ValidationApiError([{
      field: 'artist_id',
      message: 'Artist ID is required',
      code: 'REQUIRED_FIELD',
    }]);
  }

  if (!userToken) {
    throw new ValidationApiError([{
      field: 'user_token',
      message: 'Authentication required',
      code: 'REQUIRED_AUTH',
    }]);
  }

  const db = createDatabaseService(c.env.DB);

  try {
    // Get pending edits for this user and artist
    const pendingEditsStmt = db.db.prepare(`
      SELECT edit_id, submitted_at 
      FROM artist_edits 
      WHERE artist_id = ? AND user_token = ? AND status = 'pending'
      ORDER BY submitted_at DESC
    `);
    
    const pendingEdits = await pendingEditsStmt.bind(artistId, userToken).all();

    const response: ArtistPendingEditsResponse = {
      has_pending_edits: pendingEdits.results && pendingEdits.results.length > 0,
    };

    // Add submission timestamp if there are pending edits
    if (response.has_pending_edits && pendingEdits.results && pendingEdits.results.length > 0) {
      const firstEdit = pendingEdits.results[0] as { submitted_at?: string };
      if (firstEdit?.submitted_at) {
        response.submitted_at = firstEdit.submitted_at;
      }
    }

    return c.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Failed to get user pending artist edits:', error);
    throw error;
  }
}