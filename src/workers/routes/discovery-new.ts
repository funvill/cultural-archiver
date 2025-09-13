/**
 * Discovery route handlers for artwork search and details
 * Handles GET /api/artworks/nearby and GET /api/artworks/:id
 * Enhanced with similarity scoring for fast photo-first workflow
 */

import type { Context } from 'hono';
import type {
  WorkerEnv,
  ArtworkRecord,
  ArtworkWithPhotos,
  NearbyArtworksResponse,
} from '../types';
import type { ArtistRecord } from '../../shared/types';
import { DEFAULT_ARTWORK_SEARCH_RADIUS } from '../../shared/geo';
import { createDatabaseService } from '../lib/database';
import { createSuccessResponse } from '../lib/errors';
import { getValidatedData } from '../middleware/validation';
import { safeJsonParse } from '../lib/errors';
import { createSimilarityService } from '../lib/similarity';
import type { SimilarityQuery } from '../../shared/similarity';

// Import new database patch for submissions compatibility
import { 
  getAllLogbookEntriesForArtworkFromSubmissions 
} from '../lib/database-patch.js';

/**
 * GET /api/artworks/nearby - Find Nearby Artworks
 * Returns approved artworks within a specified radius
 * Enhanced with optional similarity scoring for duplicate detection
 */
export async function getNearbyArtworks(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const validatedQuery = getValidatedData<{
    lat: number;
    lon: number;
    radius?: number;
    limit?: number;
    // Fast photo-first workflow parameters
    title?: string;
    tags?: string[]; // Array of tag values
    include_similarity?: boolean;
    similarity_dev_mode?: boolean;
  }>(c, 'query');

  const db = createDatabaseService(c.env.DB);

  // Set defaults - use fast workflow radius if not specified
  const radius = validatedQuery.radius || DEFAULT_ARTWORK_SEARCH_RADIUS;
  const limit = validatedQuery.limit || 20;

  try {
    // Find nearby artworks
    const artworks = await db.findNearbyArtworks(
      validatedQuery.lat,
      validatedQuery.lon,
      radius,
      limit
    );

    const photoDebugEnabled = c.env.PHOTO_DEBUG === '1' || c.env.PHOTO_DEBUG === 'true';
    if (photoDebugEnabled) {
      console.info('[PHOTO][NEARBY] Query start', {
        lat: validatedQuery.lat,
        lon: validatedQuery.lon,
        radius,
        limit,
        returned: artworks.length,
      });
    }

    // Format response with photos and additional info
    const artworksWithPhotos: ArtworkWithPhotos[] = await Promise.all(
      artworks.map(async artwork => {
        // Get logbook entries for this artwork to find photos - UPDATED: using submissions
        const logbookEntries = await getAllLogbookEntriesForArtworkFromSubmissions(c.env.DB, artwork.id);

        // Extract photos from logbook entries
        const combinedPhotos: string[] = [];
        logbookEntries.forEach(entry => {
          if (entry.photos) {
            const photos = safeJsonParse<string[]>(entry.photos, []);
            for (const p of photos) {
              if (typeof p === 'string' && !combinedPhotos.includes(p)) combinedPhotos.push(p);
            }
          }
        });

        // Also include artwork-level photos stored under _photos in tags (set during approval)
        try {
          if (artwork.tags) {
            // Parse artwork tags (unknown -> record)
            const raw = safeJsonParse<Record<string, unknown>>(artwork.tags, {});
            if (raw && Array.isArray(raw._photos)) {
              for (const p of raw._photos) {
                if (typeof p === 'string' && !combinedPhotos.includes(p)) combinedPhotos.push(p);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse artwork-level photos for nearby listing', e);
        }

        if (photoDebugEnabled) {
          console.info('[PHOTO][NEARBY] Artwork aggregation', {
            artwork_id: artwork.id,
            logbook_entries: logbookEntries.length,
            aggregated_photos: combinedPhotos.length,
            has_artwork_tags: !!artwork.tags,
          });
        }

        // Parse tags for duplicate detection compatibility
        let tags_parsed: Record<string, unknown> = {};
        try {
          if (artwork.tags) {
            tags_parsed = safeJsonParse<Record<string, unknown>>(artwork.tags, {});
          }
        } catch (e) {
          console.warn('Failed to parse artwork tags for nearby API', { artwork_id: artwork.id, error: e });
        }

        return {
          ...artwork,
          type_name: artwork.type_name,
          recent_photo: combinedPhotos.length > 0 ? combinedPhotos[0] : undefined,
          photo_count: combinedPhotos.length,
          distance_km: artwork.distance_km, // Keep the distance for sorting/filtering
          tags_parsed, // Add parsed tags for mass import duplicate detection
        } as ArtworkWithPhotos & { tags_parsed: Record<string, unknown> };
      })
    );

    if (photoDebugEnabled) {
      const withPhotos = artworksWithPhotos.filter(a => a.photo_count > 0).length;
      console.info('[PHOTO][NEARBY] Aggregation summary', {
        total: artworksWithPhotos.length,
        with_photos: withPhotos,
        without_photos: artworksWithPhotos.length - withPhotos,
      });
    }

    // Enhance with similarity scoring if requested (for fast photo-first workflow)
    let enhancedArtworks = artworksWithPhotos;
    if (validatedQuery.include_similarity && (validatedQuery.title || validatedQuery.tags)) {
      try {
        const similarityService = createSimilarityService({
          includeMetadata: validatedQuery.similarity_dev_mode === true,
        });

        const query: SimilarityQuery = {
          coordinates: { lat: validatedQuery.lat, lon: validatedQuery.lon },
          ...(validatedQuery.title && { title: validatedQuery.title }),
          ...(validatedQuery.tags && { tags: validatedQuery.tags }),
        };

        // Need to ensure artworksWithPhotos have distance_km for similarity service
        const artworksForSimilarity = artworksWithPhotos.map(artwork => {
          // Find the original artwork with distance_km from the database query
          const originalArtwork = artworks.find(a => a.id === artwork.id);
          return {
            id: artwork.id,
            lat: artwork.lat,
            lon: artwork.lon,
            type_name: artwork.type_name,
            distance_km: originalArtwork?.distance_km ?? 0,
            title: (originalArtwork as ArtworkRecord & { title?: string })?.title ?? null,
            tags: (originalArtwork as ArtworkRecord & { tags?: string | null })?.tags ?? null,
            photos: artwork.recent_photo ? [artwork.recent_photo] : [],
          };
        });

        const enhancedResults = similarityService.enhanceNearbyResults(query, artworksForSimilarity);
        
        // Convert back to ArtworkWithPhotos format for response - merge properties
        enhancedArtworks = enhancedResults.map(enhanced => {
          const original = artworksWithPhotos.find(a => a.id === enhanced.id);
          return {
            ...original!,
            ...enhanced,
            // Keep original artwork properties that might not be in enhanced result
            photo_count: original?.photo_count ?? 0,
            created_at: original?.created_at ?? '',
            status: original?.status ?? 'approved',
          };
        }) as ArtworkWithPhotos[];
      } catch (error) {
        console.warn('Similarity enhancement failed, using distance-only results:', error);
        // Graceful degradation - continue with original results
      }
    }

    const response: NearbyArtworksResponse = {
      artworks: enhancedArtworks,
      total: enhancedArtworks.length,
      search_center: {
        lat: validatedQuery.lat,
        lon: validatedQuery.lon,
      },
      search_radius: radius,
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Failed to get nearby artworks:', error);
    throw error;
  }
}

/**
 * GET /api/artworks/:id - Get Artwork Details
 */
export async function getArtworkDetails(c: Context): Promise<Response> {
  return c.json(createSuccessResponse({
    artwork: null,
    message: 'Artwork details endpoint temporarily simplified during schema migration'
  }));
}

/**
 * GET /api/artworks - List All Approved Artworks (Index Page)
 * Returns paginated list of all approved artworks for browsing
 * Query parameters:
 * - page: page number (default: 1)
 * - limit: items per page (default: 30, max: 50)
 * - sort: sorting option (updated_desc, title_asc, created_desc)
 */
export async function listArtworks(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  let validatedQuery;
  try {
    validatedQuery = getValidatedData<{
      page?: number;
      limit?: number;
      sort?: 'updated_desc' | 'title_asc' | 'created_desc';
    }>(c, 'query');
  } catch (error) {
    console.error('Validation error in getArtworksList:', error);
    // Fallback to manual parsing
    const url = new URL(c.req.url);
    validatedQuery = {
      page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!, 10) : undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined,
      sort: url.searchParams.get('sort') as 'updated_desc' | 'title_asc' | 'created_desc' | undefined,
    };
  }

  const db = createDatabaseService(c.env.DB);
  
  // Set defaults per PRD
  const page = Math.max(validatedQuery.page || 1, 1);
  const limit = Math.min(validatedQuery.limit || 30, 50);
  const sort = validatedQuery.sort || 'updated_desc';
  const offset = (page - 1) * limit;

  try {
    // Build ORDER BY clause
    let orderClause = '';
    switch (sort) {
      case 'title_asc':
        orderClause = 'ORDER BY COALESCE(a.title, json_extract(a.tags, \'$.artwork_type\'), \'unknown\') ASC, a.created_at DESC';
        break;
      case 'created_desc':
        orderClause = 'ORDER BY a.created_at DESC';
        break;
      case 'updated_desc':
      default:
        // Default to created_at since updated_at doesn't exist in schema
        orderClause = 'ORDER BY a.created_at DESC';
        break;
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM artwork a
      WHERE a.status = 'approved'
    `;
    
    const countResult = await db.db.prepare(countQuery).first() as { total: number };
    const totalItems = countResult.total;
    const totalPages = Math.ceil(totalItems / limit);

    // Validate page number
    if (page > totalPages && totalItems > 0) {
      return c.json({
        error: 'Page not found',
        message: `Page ${page} does not exist. Total pages: ${totalPages}`,
      }, 404);
    }

    // Get artworks with type information
    const artworksQuery = `
      SELECT a.id, a.lat, a.lon, a.created_at, a.status, a.tags, 
             a.title, a.description, a.artist_names,
             COALESCE(json_extract(a.tags, '$.artwork_type'), 'unknown') as type_name
      FROM artwork a
      WHERE a.status = 'approved'
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const artworks = await db.db.prepare(artworksQuery)
      .bind(limit, offset)
      .all();

    // Get photos for each artwork
    const artworksWithPhotos = await Promise.all(
      (artworks.results as unknown as (ArtworkRecord & { type_name?: string; artist_names?: string })[] || []).map(async (artwork) => {
        // Get logbook entries for this artwork to find photos
        const logbookEntries = await getAllLogbookEntriesForArtworkFromSubmissions(c.env.DB, artwork.id);
        const allPhotos: string[] = [];
        
        logbookEntries.forEach(entry => {
          if (entry.photos) {
            const photos = safeJsonParse<string[]>(entry.photos, []);
            allPhotos.push(...photos);
          }
        });

        // Get primary artist name from artist_names or tags
        let artistName = 'Unknown Artist';
        
        // First try the artist_names JSON array
        if (artwork.artist_names) {
          const artistNames = safeJsonParse<string[]>(artwork.artist_names, []);
          if (artistNames.length > 0 && artistNames[0]) {
            artistName = artistNames[0]; // Use first artist
          }
        }
        
        // Fallback to tags
        if (artistName === 'Unknown Artist' && artwork.tags) {
          const tags = safeJsonParse<Record<string, unknown>>(artwork.tags, {});
          if (tags.artist_name && typeof tags.artist_name === 'string') {
            artistName = tags.artist_name;
          } else if (tags.artist && typeof tags.artist === 'string') {
            artistName = tags.artist;
          }
        }

        return {
          id: artwork.id,
          lat: artwork.lat,
          lon: artwork.lon,
          created_at: artwork.created_at,
          status: artwork.status,
          tags: artwork.tags,
          title: artwork.title,
          description: artwork.description,
          artist_names: artwork.artist_names,
          type_name: artwork.type_name,
          photos: allPhotos,
          tags_parsed: safeJsonParse(artwork.tags, {}),
          // Add derived fields for card display
          recent_photo: allPhotos.length > 0 ? allPhotos[0] : null,
          photo_count: allPhotos.length,
          artist_name: artistName,
        } as import('../../shared/types').ArtworkApiResponse;
      })
    );

    // Set cache headers for 1 hour as per PRD
    c.header('Cache-Control', 'public, max-age=3600');

    const response: import('../../shared/types').ArtworkIndexResponse = {
      totalItems,
      currentPage: page,
      totalPages,
      items: artworksWithPhotos,
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Failed to get artworks list:', error);
    throw error;
  }
}

/**
 * GET /api/artists - List All Artists with Basic Information
 */
export async function listArtists(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const validatedQuery = getValidatedData<{
    page?: number;
    limit?: number;
    sort?: 'updated_desc' | 'name_asc' | 'created_desc';
    search?: string;
    status?: 'active' | 'inactive';
  }>(c, 'query');

  // Set defaults per PRD
  const page = Math.max(validatedQuery.page || 1, 1);
  const limit = Math.min(validatedQuery.limit || 30, 50);
  const offset = (page - 1) * limit;
  const status = validatedQuery.status || 'active';

  try {
    const db = createDatabaseService(c.env.DB);

    let query: string;
    let params: unknown[];

    if (validatedQuery.search) {
      // Search query
      query = `
        SELECT id, name, bio as description, tags, status, created_at, updated_at,
               (SELECT COUNT(*) FROM artwork WHERE artist_names LIKE '%"' || artists.name || '"%' AND status = 'approved') as artwork_count
        FROM artists
        WHERE status = ? AND name LIKE ?
        ORDER BY name ASC
        LIMIT ? OFFSET ?
      `;
      params = [status, `%${validatedQuery.search}%`, limit, offset];
    } else {
      // Standard listing
      query = `
        SELECT id, name, bio as description, tags, status, created_at, updated_at,
               (SELECT COUNT(*) FROM artwork WHERE artist_names LIKE '%"' || artists.name || '"%' AND status = 'approved') as artwork_count
        FROM artists
        WHERE status = ?
        ORDER BY name ASC
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
    
    const countParams = validatedQuery.search
      ? [status, `%${validatedQuery.search}%`]
      : [status];

    const countStmt = db.db.prepare(countQuery);
    const countResult = await countStmt.bind(...countParams).first() as { total: number };
    const totalItems = countResult?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    // Format artists for API response
    const formattedArtists: import('../../shared/types').ArtistApiResponse[] = artists.map(artist => ({
      id: artist.id,
      name: artist.name,
      description: artist.description || '',
      tags: artist.tags,
      created_at: artist.created_at,
      updated_at: artist.updated_at,
      status: artist.status,
      tags_parsed: safeJsonParse(artist.tags, {}),
      artwork_count: artist.artwork_count || 0,
    }));

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