/**
 * Discovery route handlers for artwork search and details
 * Handles GET /api/artworks/nearby and GET /api/artworks/:id
 */

import type { Context } from 'hono';
import type {
  WorkerEnv,
  ArtworkRecord,
  ArtworkDetailResponse,
  ArtworkWithPhotos,
  LogbookEntryWithPhotos,
  NearbyArtworksResponse,
  ArtworkCreatorInfo,
} from '../types';
import type { StructuredTagsData } from '../../shared/types';
import { DEFAULT_SEARCH_RADIUS } from '../types';
import { createDatabaseService } from '../lib/database';
import { createSuccessResponse, NotFoundError } from '../lib/errors';
import { getValidatedData } from '../middleware/validation';
import { safeJsonParse } from '../lib/errors';

// Database result interfaces
interface ArtworkStatsResult {
  total_artworks: number;
  approved_artworks: number;
  pending_artworks: number;
}

interface SubmissionStatsResult {
  total_submissions: number;
  recent_submissions: number;
}

/**
 * GET /api/artworks/nearby - Find Nearby Artworks
 * Returns approved artworks within a specified radius
 */
export async function getNearbyArtworks(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const validatedQuery = getValidatedData<{
    lat: number;
    lon: number;
    radius?: number;
    limit?: number;
  }>(c, 'query');

  const db = createDatabaseService(c.env.DB);

  // Set defaults
  const radius = validatedQuery.radius || DEFAULT_SEARCH_RADIUS;
  const limit = validatedQuery.limit || 20;

  try {
    // Find nearby artworks
    const artworks = await db.findNearbyArtworks(
      validatedQuery.lat,
      validatedQuery.lon,
      radius,
      limit
    );

    // Format response with photos and additional info
    const artworksWithPhotos: ArtworkWithPhotos[] = await Promise.all(
      artworks.map(async artwork => {
        // Get logbook entries for this artwork to find photos
        const logbookEntries = await db.getLogbookEntriesForArtwork(artwork.id);

        // Extract photos from logbook entries
        const allPhotos: string[] = [];
        logbookEntries.forEach(entry => {
          if (entry.photos) {
            const photos = safeJsonParse<string[]>(entry.photos, []);
            allPhotos.push(...photos);
          }
        });

        return {
          ...artwork,
          type_name: artwork.type_name,
          recent_photo: allPhotos.length > 0 ? allPhotos[0] : undefined,
          photo_count: allPhotos.length,
          distance_km: artwork.distance_km, // Keep the distance for sorting/filtering
        } as ArtworkWithPhotos;
      })
    );

    const response: NearbyArtworksResponse = {
      artworks: artworksWithPhotos,
      total: artworksWithPhotos.length,
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
 * GET /api/artworks/:id - Artwork Details
 * Returns complete artwork details with creators and paginated logbook timeline
 */
export async function getArtworkDetails(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const artworkId = c.req.param('id');

  if (!artworkId) {
    throw new NotFoundError('Artwork', 'ID parameter missing');
  }

  // Get pagination parameters
  const page = parseInt(c.req.query('page') || '1', 10);
  const perPage = parseInt(c.req.query('per_page') || '10', 10);
  const offset = (page - 1) * perPage;

  const db = createDatabaseService(c.env.DB);

  try {
    // Get artwork with type information
    const artwork = await db.getArtworkWithDetails(artworkId);

    if (!artwork) {
      throw new NotFoundError('Artwork', artworkId);
    }

    // Get creators for this artwork
    const creators: ArtworkCreatorInfo[] = await db.getCreatorsForArtwork(artworkId);

    // Get logbook entries for timeline with pagination
    const logbookEntries = await db.getLogbookEntriesForArtwork(artworkId, perPage, offset);

    // Format logbook entries with parsed photos
    const logbookEntriesWithPhotos: LogbookEntryWithPhotos[] = logbookEntries.map(entry => ({
      ...entry,
      photos_parsed: safeJsonParse<string[]>(entry.photos, []),
    }));

    // Get all photos from logbook entries
    const allPhotos: string[] = [];
    logbookEntriesWithPhotos.forEach(entry => {
      allPhotos.push(...entry.photos_parsed);
    });

    // Parse artwork tags from structured format
    const structuredTags = safeJsonParse<StructuredTagsData>(
      artwork.tags || '{}', 
      { tags: {}, version: '1.0.0', lastModified: new Date().toISOString() }
    );
    
    // Extract just the tags portion and ensure all values are strings for the frontend
    const tagsParsed: Record<string, string> = {};
    Object.entries(structuredTags.tags).forEach(([key, value]) => {
      tagsParsed[key] = String(value);
    });

    const response: ArtworkDetailResponse = {
      ...artwork,
      type_name: artwork.type_name,
      photos: allPhotos,
      logbook_entries: logbookEntriesWithPhotos,
      tags_parsed: tagsParsed,
      creators: creators,
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    console.error('Failed to get artwork details:', error);
    throw error;
  }
}

/**
 * Get artwork statistics for analytics
 * Not exposed as API endpoint but useful for internal metrics
 */
export async function getArtworkStats(db: D1Database): Promise<{
  total_artworks: number;
  approved_artworks: number;
  pending_artworks: number;
  total_submissions: number;
  recent_submissions: number;
}> {
  try {
    const artworkStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_artworks,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_artworks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_artworks
      FROM artwork
    `);

    const submissionStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_submissions,
        SUM(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as recent_submissions
      FROM logbook
    `);

    const [artworkResult, submissionResult] = await Promise.all([
      artworkStmt.first(),
      submissionStmt.first(),
    ]);

    return {
      total_artworks: (artworkResult as ArtworkStatsResult | null)?.total_artworks || 0,
      approved_artworks: (artworkResult as ArtworkStatsResult | null)?.approved_artworks || 0,
      pending_artworks: (artworkResult as ArtworkStatsResult | null)?.pending_artworks || 0,
      total_submissions: (submissionResult as SubmissionStatsResult | null)?.total_submissions || 0,
      recent_submissions:
        (submissionResult as SubmissionStatsResult | null)?.recent_submissions || 0,
    };
  } catch (error) {
    console.error('Failed to get artwork stats:', error);
    return {
      total_artworks: 0,
      approved_artworks: 0,
      pending_artworks: 0,
      total_submissions: 0,
      recent_submissions: 0,
    };
  }
}

/**
 * Search artworks by text query (for future implementation)
 * This is a placeholder for full-text search capabilities
 */
export async function searchArtworks(
  c: Context<{ Bindings: WorkerEnv }>,
  query: string
): Promise<ArtworkWithPhotos[]> {
  const db = createDatabaseService(c.env.DB);

  try {
    // For MVP, we'll do a simple text search on notes
    // In production, this would use a proper search index
    const stmt = db.db.prepare(`
      SELECT DISTINCT a.*, at.name as type_name,
             0 as distance_km -- TODO: Calculate if lat/lon provided
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
      LEFT JOIN logbook l ON a.id = l.artwork_id
      WHERE a.status = 'approved'
        AND (
          at.name LIKE ? OR
          l.note LIKE ?
        )
      ORDER BY a.created_at DESC
      LIMIT 20
    `);

    const searchTerm = `%${query}%`;
    const results = await stmt.bind(searchTerm, searchTerm).all();

    // Format results similar to nearby artworks
    const artworksWithPhotos: ArtworkWithPhotos[] = await Promise.all(
      (results.results as unknown as ArtworkWithPhotos[]).map(async artwork => {
        const logbookEntries = await db.getLogbookEntriesForArtwork(artwork.id);

        const allPhotos: string[] = [];
        logbookEntries.forEach(entry => {
          if (entry.photos) {
            const photos = safeJsonParse<string[]>(entry.photos, []);
            allPhotos.push(...photos);
          }
        });

        return {
          ...artwork,
          recent_photo: allPhotos.length > 0 ? allPhotos[0] : undefined,
          photo_count: allPhotos.length,
        } as ArtworkWithPhotos;
      })
    );

    return artworksWithPhotos;
  } catch (error) {
    console.error('Failed to search artworks:', error);
    return [];
  }
}

/**
 * Get popular artworks (most submissions)
 * Useful for featuring popular content
 */
export async function getPopularArtworks(
  c: Context<{ Bindings: WorkerEnv }>,
  limit: number = 10
): Promise<ArtworkWithPhotos[]> {
  const db = createDatabaseService(c.env.DB);

  try {
    const stmt = db.db.prepare(`
      SELECT a.*, at.name as type_name, COUNT(l.id) as submission_count
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
      LEFT JOIN logbook l ON a.id = l.artwork_id AND l.status = 'approved'
      WHERE a.status = 'approved'
      GROUP BY a.id
      ORDER BY submission_count DESC, a.created_at DESC
      LIMIT ?
    `);

    const results = await stmt.bind(limit).all();

    // Format results
    const artworksWithPhotos: ArtworkWithPhotos[] = await Promise.all(
      (results.results as unknown as ArtworkWithPhotos[]).map(async artwork => {
        const logbookEntries = await db.getLogbookEntriesForArtwork(artwork.id);

        const allPhotos: string[] = [];
        logbookEntries.forEach(entry => {
          if (entry.photos) {
            const photos = safeJsonParse<string[]>(entry.photos, []);
            allPhotos.push(...photos);
          }
        });

        return {
          ...artwork,
          distance_km: 0, // Not applicable for popular artworks
          recent_photo: allPhotos.length > 0 ? allPhotos[0] : undefined,
          photo_count: allPhotos.length,
        } as ArtworkWithPhotos;
      })
    );

    return artworksWithPhotos;
  } catch (error) {
    console.error('Failed to get popular artworks:', error);
    return [];
  }
}

/**
 * Get recently added artworks
 * Useful for showcasing new content
 */
export async function getRecentArtworks(
  c: Context<{ Bindings: WorkerEnv }>,
  limit: number = 10
): Promise<ArtworkWithPhotos[]> {
  const db = createDatabaseService(c.env.DB);

  try {
    const stmt = db.db.prepare(`
      SELECT a.*, at.name as type_name
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
      WHERE a.status = 'approved'
      ORDER BY a.created_at DESC
      LIMIT ?
    `);

    const results = await stmt.bind(limit).all();

    // Format results
    const artworksWithPhotos: ArtworkWithPhotos[] = await Promise.all(
      (results.results as unknown as ArtworkWithPhotos[]).map(async artwork => {
        const logbookEntries = await db.getLogbookEntriesForArtwork(artwork.id);

        const allPhotos: string[] = [];
        logbookEntries.forEach(entry => {
          if (entry.photos) {
            const photos = safeJsonParse<string[]>(entry.photos, []);
            allPhotos.push(...photos);
          }
        });

        return {
          ...artwork,
          distance_km: 0, // Not applicable for recent artworks
          recent_photo: allPhotos.length > 0 ? allPhotos[0] : undefined,
          photo_count: allPhotos.length,
        } as ArtworkWithPhotos;
      })
    );

    return artworksWithPhotos;
  } catch (error) {
    console.error('Failed to get recent artworks:', error);
    return [];
  }
}

/**
 * GET /api/artworks/bounds - Find Artworks in Bounds
 * Returns approved artworks within specified geographic bounds
 */
export async function getArtworksInBounds(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const validatedQuery = getValidatedData<{
    north: number;
    south: number;
    east: number;
    west: number;
  }>(c, 'query');

  const db = createDatabaseService(c.env.DB);

  try {
    // Find artworks in bounds
    const artworks = await db.findArtworksInBounds(
      validatedQuery.north,
      validatedQuery.south,
      validatedQuery.east,
      validatedQuery.west
    );

    // Format response with photos and additional info
    const artworksWithPhotos: ArtworkWithPhotos[] = await Promise.all(
      artworks.map(async (artwork: ArtworkRecord & { type_name: string; distance_km: number }) => {
        // Get logbook entries for this artwork to find photos
        const logbookEntries = await db.getLogbookEntriesForArtwork(artwork.id);

        // Extract photos from logbook entries
        const allPhotos: string[] = [];
        logbookEntries.forEach(entry => {
          if (entry.photos) {
            const photos = safeJsonParse<string[]>(entry.photos, []);
            allPhotos.push(...photos);
          }
        });

        return {
          ...artwork,
          type_name: artwork.type_name,
          recent_photo: allPhotos.length > 0 ? allPhotos[0] : undefined,
          photo_count: allPhotos.length,
          distance_km: 0, // Not applicable for bounds queries
        } as ArtworkWithPhotos;
      })
    );

    const responseData: NearbyArtworksResponse = {
      artworks: artworksWithPhotos,
      total: artworks.length,
      search_center: {
        lat: (validatedQuery.north + validatedQuery.south) / 2,
        lon: (validatedQuery.east + validatedQuery.west) / 2,
      },
      search_radius: 0, // Not applicable for bounds
    };

    return c.json(createSuccessResponse(responseData));
  } catch (error) {
    console.error('Error getting artworks in bounds:', error);
    throw error;
  }
}
