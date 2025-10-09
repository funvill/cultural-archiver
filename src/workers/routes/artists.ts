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
} from '../../shared/types';
import type { WorkerEnv } from '../types';
import { createDatabaseService } from '../lib/database';
import { createSuccessResponse, ValidationApiError, NotFoundError } from '../lib/errors';
import { getUserToken } from '../middleware/auth';
import { getValidatedData } from '../middleware/validation';
import { safeJsonParse } from '../lib/errors';

// UUID generation function
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == 'x' ? r : (r & 0x3) | 0x8;
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
    status?: 'approved' | 'pending' | 'rejected';
  }>(c, 'query');

  // Set defaults per PRD
  const page = Math.max(validatedQuery.page || 1, 1);
  const limit = Math.min(validatedQuery.limit || 30, 50);
  const offset = (page - 1) * limit;
  const status = validatedQuery.status || 'approved';

  // Respect sort parameter from query (frontend exposes updated_desc | name_asc | created_desc)
  const sort = (validatedQuery.sort as string) || 'updated_desc';
  let orderClause = 'a.name ASC';
  if (sort === 'updated_desc') {
    orderClause = "a.updated_at DESC";
  } else if (sort === 'created_desc') {
    orderClause = "a.created_at DESC";
  } else if (sort === 'name_asc') {
    orderClause = "a.name ASC";
  }

  try {
    const db = createDatabaseService(c.env.DB);

    let query: string;
    let params: unknown[];

    if (validatedQuery.search) {
      // Search query - updated to use artwork_artists table instead of artist_names field
      query = `
        SELECT a.id, a.name, a.description, a.aliases, a.tags, a.status, a.created_at, a.updated_at,
               (SELECT COUNT(DISTINCT aa.artwork_id) 
                FROM artwork_artists aa 
                JOIN artwork aw ON aa.artwork_id = aw.id 
                WHERE aa.artist_id = a.id AND aw.status = 'approved') as artwork_count
        FROM artists a
        WHERE a.status = ? AND a.name LIKE ?
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `;
      params = [status, `%${validatedQuery.search}%`, limit, offset];
    } else {
      // Standard listing - updated to use artwork_artists table instead of artist_names field
      query = `
        SELECT a.id, a.name, a.description, a.aliases, a.tags, a.status, a.created_at, a.updated_at,
               (SELECT COUNT(DISTINCT aa.artwork_id) 
                FROM artwork_artists aa 
                JOIN artwork aw ON aa.artwork_id = aw.id 
                WHERE aa.artist_id = a.id AND aw.status = 'approved') as artwork_count
        FROM artists a
        WHERE a.status = ?
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `;
      params = [status, limit, offset];
    }

    const stmt = db.db.prepare(query);
    const result = await stmt.bind(...params).all();
    const artists = result.results as (ArtistRecord & { artwork_count: number })[];

    // Get total count for pagination
    const countQuery = validatedQuery.search
      ? `SELECT COUNT(*) as total FROM artists WHERE status = ? AND name LIKE ?`
      : `SELECT COUNT(*) as total FROM artists WHERE status = ?`;

    const countParams = validatedQuery.search ? [status, `%${validatedQuery.search}%`] : [status];

    const countStmt = db.db.prepare(countQuery);
    const countResult = (await countStmt.bind(...countParams).first()) as { total: number };
    const totalItems = countResult?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    // Format artists for API response
    const formattedArtists: import('../../shared/types').ArtistApiResponse[] = artists.map(
      artist => ({
        id: artist.id,
        name: artist.name,
        description: artist.description || '',
        aliases: artist.aliases || null,
        tags: artist.tags,
        created_at: artist.created_at,
        updated_at: artist.updated_at,
        status: artist.status,
        tags_parsed: safeJsonParse(artist.tags, {}),
        artwork_count: artist.artwork_count || 0,
      })
    );

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
 * GET /api/artists/search - Artist Search (Typeahead)
 * Fast fuzzy search endpoint for artist lookup in edit forms
 * Searches name and aliases fields with case-insensitive matching
 * Target: <200ms response time
 */
export async function searchArtists(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const validatedQuery = getValidatedData<{
    q?: string;
    limit?: number;
  }>(c, 'query');

  const searchQuery = (validatedQuery.q || '').trim();
  const limit = Math.min(validatedQuery.limit || 10, 50);

  // If no search query, return empty results quickly
  if (!searchQuery) {
    return c.json(
      createSuccessResponse({
        results: [],
        count: 0,
      })
    );
  }

  try {
    const db = createDatabaseService(c.env.DB);

    // Fuzzy search on name and aliases (JSON field)
    // Use LIKE for case-insensitive matching on name
    // Parse aliases JSON and search within it
    // Note: artists table no longer has status field (removed in migration 0020)
    const query = `
      SELECT 
        id, 
        name, 
        description,
        aliases,
        tags,
        created_at,
        updated_at
      FROM artists
      WHERE (
        name LIKE ? COLLATE NOCASE
        OR aliases LIKE ? COLLATE NOCASE
      )
      ORDER BY 
        CASE 
          WHEN name LIKE ? COLLATE NOCASE THEN 1
          ELSE 2
        END,
        name ASC
      LIMIT ?
    `;

    const searchPattern = `%${searchQuery}%`;
    const exactPattern = `${searchQuery}%`;

    const stmt = db.db.prepare(query);
    const result = await stmt.bind(searchPattern, searchPattern, exactPattern, limit).all();
    const artists = result.results as ArtistRecord[];

    // Format results for typeahead UI
    const formattedResults = artists.map(artist => {
      const tagsParsed = safeJsonParse(artist.tags, {}) as Record<string, unknown>;
      const aliasesParsed = safeJsonParse(artist.aliases, []) as string[];

      // Extract short bio (first 100 chars of description)
      const descriptionShort =
        artist.description && artist.description.length > 100
          ? artist.description.substring(0, 100) + '...'
          : artist.description || '';

      return {
        id: artist.id,
        name: artist.name,
        description_short: descriptionShort,
        aliases: aliasesParsed,
        tags_parsed: tagsParsed,
        // Optional: include birth/death years if in tags
        birth_year: (tagsParsed.birth_year as number) || null,
        death_year: (tagsParsed.death_year as number) || null,
      };
    });

    // Fast response with short cache (5 minutes for search results)
    c.header('Cache-Control', 'public, max-age=300');

    return c.json(
      createSuccessResponse({
        results: formattedResults,
        count: formattedResults.length,
      })
    );
  } catch (error) {
    console.error('Failed to search artists:', error);
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
    throw new ValidationApiError([
      {
        field: 'artist_id',
        message: 'Artist ID is required',
        code: 'REQUIRED_FIELD',
      },
    ]);
  }

  try {
    const db = createDatabaseService(c.env.DB);

    // Get artist details
    const artistStmt = db.db.prepare(`
      SELECT id, name, description, aliases, tags, status, created_at, updated_at
      FROM artists
      WHERE id = ?
    `);
    const artist = (await artistStmt.bind(artistId).first()) as ArtistRecord | null;

    if (!artist) {
      throw new NotFoundError(`Artist not found: ${artistId}`);
    }

    // Get artist's artworks using artwork_artists junction table
    const artworksStmt = db.db.prepare(`
      SELECT a.id, a.title, a.lat, a.lon, a.created_at, a.status, a.tags,
             (SELECT photos FROM submissions WHERE artwork_id = a.id AND submission_type = 'logbook_entry' ORDER BY created_at DESC LIMIT 1) as recent_photos,
             (SELECT COUNT(*) FROM submissions WHERE artwork_id = a.id AND submission_type = 'logbook_entry') as photo_count
      FROM artwork a
      INNER JOIN artwork_artists aa ON a.id = aa.artwork_id
      WHERE aa.artist_id = ? AND a.status = 'approved'
      ORDER BY a.created_at DESC
    `);
    const artworks = await artworksStmt.bind(artistId).all();

    interface ArtworkWithTypeAndPhotos {
      id: string;
      title: string | null;
      lat: number;
      lon: number;
      type_id: string;
      created_at: string;
      status: 'pending' | 'approved' | 'removed';
      tags: string | null;
      type_name: string;
      recent_photos: string | null;
      photo_count: number;
    }

    // Format response
    const response: import('../../shared/types').ArtistApiResponse = {
      id: artist.id,
      name: artist.name,
      description: artist.description || '',
      aliases: artist.aliases || null,
      tags: artist.tags,
      created_at: artist.created_at,
      updated_at: artist.updated_at,
      status: artist.status,
      tags_parsed: safeJsonParse(artist.tags, {}),
      artworks:
        (artworks.results as ArtworkWithTypeAndPhotos[])?.map(artwork => {
          const recentPhotos = safeJsonParse(artwork.recent_photos, []);
          return {
            id: artwork.id,
            title: artwork.title,
            lat: artwork.lat,
            lon: artwork.lon,
            type_id: artwork.type_id,
            created_at: artwork.created_at,
            status: artwork.status,
            tags: artwork.tags,
            type_name: artwork.type_name || '',
            photo_count: artwork.photo_count || 0,
            ...(recentPhotos.length > 0 && { recent_photo: recentPhotos[0] }),
          };
        }) || [],
      artwork_count: artworks.results?.length || 0,
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
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
    throw new ValidationApiError([
      {
        field: 'user_token',
        message: 'Authentication required',
        code: 'REQUIRED_AUTH',
      },
    ]);
  }

  const requestBody = await c.req.json().catch(() => {
    throw new ValidationApiError([
      {
        field: 'request_body',
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
      },
    ]);
  });

  const request = requestBody as CreateArtistRequest;

  // Validate required fields
  if (!request.name?.trim()) {
    throw new ValidationApiError([
      {
        field: 'name',
        message: 'Artist name is required',
        code: 'REQUIRED_FIELD',
      },
    ]);
  }

  const db = createDatabaseService(c.env.DB);
  const artistId = generateUUID();

  try {
    // Create artist
    const insertStmt = db.db.prepare(`
      INSERT INTO artists (id, name, description, tags, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    await insertStmt
      .bind(
        artistId,
        request.name.trim(),
        request.description?.trim() || null,
        request.tags ? JSON.stringify(request.tags) : '{}',
        request.status || 'pending'
      )
      .run();

    // Get the created artist
    const artistStmt = db.db.prepare('SELECT * FROM artists WHERE id = ?');
    const artist = (await artistStmt.bind(artistId).first()) as ArtistRecord;

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
    throw new ValidationApiError([
      {
        field: 'artist_id',
        message: 'Artist ID is required',
        code: 'REQUIRED_FIELD',
      },
    ]);
  }

  if (!userToken) {
    throw new ValidationApiError([
      {
        field: 'user_token',
        message: 'Authentication required',
        code: 'REQUIRED_AUTH',
      },
    ]);
  }

  const requestBody = await c.req.json().catch(() => {
    throw new ValidationApiError([
      {
        field: 'request_body',
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
      },
    ]);
  });

  const request = requestBody as CreateArtistEditRequest;

  if (!request.edits || !Array.isArray(request.edits) || request.edits.length === 0) {
    throw new ValidationApiError([
      {
        field: 'edits',
        message: 'At least one edit is required',
        code: 'REQUIRED_FIELD',
      },
    ]);
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
      throw new ValidationApiError([
        {
          field: 'pending_edits',
          message: 'You already have pending edits for this artist',
          code: 'DUPLICATE_PENDING_EDIT',
        },
      ]);
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
      await insertEditStmt
        .bind(
          editId,
          artistId,
          userToken,
          edit.field_name,
          edit.field_value_old,
          edit.field_value_new
        )
        .run();
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
export async function getUserPendingArtistEdits(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  const artistId = c.req.param('id');

  if (!artistId) {
    throw new ValidationApiError([
      {
        field: 'artist_id',
        message: 'Artist ID is required',
        code: 'REQUIRED_FIELD',
      },
    ]);
  }

  if (!userToken) {
    throw new ValidationApiError([
      {
        field: 'user_token',
        message: 'Authentication required',
        code: 'REQUIRED_AUTH',
      },
    ]);
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
