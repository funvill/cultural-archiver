/**
 * Discovery route handlers for artwork search and details
 * Handles GET /api/artworks/nearby and GET /api/artworks/:id
 * Enhanced with similarity scoring for fast photo-first workflow
 */

import type { Context } from 'hono';
import type {
  WorkerEnv,
  ArtworkRecord,
  ArtworkDetailResponse,
  ArtworkWithPhotos,
  NearbyArtworksResponse,
} from '../types';
import type { StructuredTagsData } from '../../shared/types';
import { DEFAULT_ARTWORK_SEARCH_RADIUS } from '../../shared/geo';
import { createDatabaseService } from '../lib/database';
import { createSuccessResponse, NotFoundError } from '../lib/errors';
import { getValidatedData } from '../middleware/validation';
import { safeJsonParse } from '../lib/errors';
import { createSimilarityService } from '../lib/similarity';
import { categorizeTagsForDisplay } from '../../shared/tag-display';
import type { SimilarityQuery } from '../../shared/similarity';

// Import new database patch for submissions compatibility
import { 
  getLogbookEntriesForArtworkFromSubmissions,
  getAllLogbookEntriesForArtworkFromSubmissions 
} from '../lib/database-patch.js';

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
    // Minimal response for map pins
    minimal?: boolean;
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

    // If minimal flag requested, short-circuit and return compact payload for map pins
    if (validatedQuery.minimal) {
      // For minimal mode, include a recent photo from artwork.photos, logbook entries, or artwork tags
      const minimal = await Promise.all(artworks.map(async artwork => {
        // Try artwork.photos first
        let recentPhoto: string | null = null;
        try {
          if (artwork.photos) {
            const parsed = safeJsonParse<string[]>(artwork.photos as unknown as string, []);
            if (parsed.length > 0) recentPhoto = parsed[0] ?? null;
          }
        } catch {/* ignore parse errors */}

        // If not found, check logbook entries (submissions)
        if (!recentPhoto) {
          try {
            const logbookEntries = await getAllLogbookEntriesForArtworkFromSubmissions(c.env.DB, artwork.id);
            for (const entry of logbookEntries) {
              if (entry.photos) {
                const photos = safeJsonParse<string[]>(entry.photos, []);
                if (photos.length > 0) {
                  recentPhoto = photos[0] ?? null;
                  break;
                }
              }
            }
          } catch {/* ignore logbook errors */}
        }

        // If still not found, check artwork-level tags for _photos
        if (!recentPhoto && artwork.tags) {
          try {
            const raw = safeJsonParse<Record<string, unknown>>(artwork.tags, {});
            if (raw && Array.isArray(raw._photos) && raw._photos.length > 0) {
              if (typeof raw._photos[0] === 'string') recentPhoto = raw._photos[0];
            }
          } catch {/* ignore tag parse errors */}
        }

        return {
          id: artwork.id,
          lat: artwork.lat,
          lon: artwork.lon,
          type_name: artwork.type_name,
          recent_photo: recentPhoto,
        };
      }));

      const response = {
        artworks: minimal,
        total: minimal.length,
        search_center: { lat: validatedQuery.lat, lon: validatedQuery.lon },
        search_radius: radius,
      };

      return c.json(createSuccessResponse(response));
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

    // Get artists for this artwork
    const artists = await db.getArtistsForArtwork(artworkId);

    // Get logbook entries for timeline with pagination - UPDATED: using submissions
    const logbookEntries = await getLogbookEntriesForArtworkFromSubmissions(c.env.DB, artworkId, perPage, offset);

    // Format logbook entries with parsed photos (using inline type from ArtworkDetailResponse)
    const logbookEntriesWithPhotos: Array<{
      id: string;
      artwork_id: string | null;
      user_token: string;
      lat: number | null;
      lon: number | null;
      notes: string | null;
      photos: string | null;
      status: 'pending' | 'approved' | 'rejected';
      created_at: string;
      rejection_reason?: string;
      photos_parsed: string[];
    }> = logbookEntries.map(entry => ({
      ...entry,
      photos_parsed: safeJsonParse<string[]>(entry.photos, []),
    }));

    // Get all photos from logbook entries (paginated subset for timeline)
    const allPhotos: string[] = [];
    logbookEntriesWithPhotos.forEach(entry => {
      allPhotos.push(...entry.photos_parsed);
    });

    // Include photos from artwork.photos field (from mass import and direct uploads)
    try {
      if (artwork.photos) {
        const artworkPhotos = safeJsonParse<string[]>(artwork.photos, []);
        artworkPhotos.forEach(photoUrl => {
          if (typeof photoUrl === 'string' && !allPhotos.includes(photoUrl)) {
            allPhotos.push(photoUrl);
          }
        });
      }
    } catch (e) {
      console.warn('Failed to parse artwork.photos field', e);
    }

    // Also include any artwork-level photos stored in tags._photos (set during approval)
    // updateArtworkPhotos stores photos inside root JSON object under _photos key.
    try {
      if (artwork.tags) {
  const raw = safeJsonParse<Record<string, unknown>>(artwork.tags, {});
        if (raw && Array.isArray(raw._photos)) {
          for (const p of raw._photos) {
            if (typeof p === 'string' && !allPhotos.includes(p)) {
              allPhotos.push(p);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse artwork-level photos from tags', e);
    }

    // Parse artwork tags from structured format
    const rawTagsFallback: StructuredTagsData = { tags: {}, version: '1.0.0', lastModified: new Date().toISOString() };
    const structuredTags = safeJsonParse<StructuredTagsData>(artwork.tags || '{}', rawTagsFallback);

    // Defensive: some legacy rows may have plain JSON without wrapping { tags: {..} }
    let tagObject: unknown = structuredTags?.tags;
    if (!tagObject || typeof tagObject !== 'object' || Array.isArray(tagObject)) {
      // Try interpreting artwork.tags as a flat map if possible
      try {
        const parsedRaw = safeJsonParse<Record<string, unknown>>(artwork.tags || '{}', {});
        if ('version' in parsedRaw) {
          // Already a structured object but malformed tags field
          tagObject = {};
        } else {
          tagObject = parsedRaw; // treat top-level keys as tags
        }
      } catch {
        tagObject = {};
      }
    }

    const tagsParsed: Record<string, string> = {};
    try {
      Object.entries(tagObject as Record<string, unknown>).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          tagsParsed[key] = String(value);
        }
      });
    } catch (e) {
      console.warn('Failed to iterate tags object; returning empty tags_parsed', e);
    }

    // Categorize tags according to current schema
    const categorizedTags = categorizeTagsForDisplay(tagsParsed);

    // Compute artist_name field using artists from database relationship
    let artistName = 'Unknown Artist';
    
    // Check if we have artists from the database relationship
    if (artists && artists.length > 0) {
      // Use the first primary artist, or just the first artist if no primary found
      const primaryArtist = artists.find(a => a.role === 'primary') || artists[0];
      if (primaryArtist) {
        artistName = primaryArtist.name;
      }
    } else if (artwork.artist_name) {
      // Fallback to artist_name from the database JOIN
      artistName = artwork.artist_name;
    } else if (tagsParsed) {
      // Final fallback to tags
      if (tagsParsed.artist_name && typeof tagsParsed.artist_name === 'string') {
        artistName = tagsParsed.artist_name;
      } else if (tagsParsed.artist && typeof tagsParsed.artist === 'string') {
        artistName = tagsParsed.artist;
      }
    }

  const response: ArtworkDetailResponse = {
      ...artwork,
      type_name: artwork.type_name,
      photos: allPhotos,
      logbook_entries: logbookEntriesWithPhotos,
      tags_parsed: tagsParsed,
      tags_categorized: categorizedTags,
      artists: artists,
      artist_name: artistName,
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
      FROM submissions
      WHERE submission_type = 'logbook'
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
      SELECT DISTINCT a.*, COALESCE(type_tag.value, 'unknown') as type_name,
             0 as distance_km -- TODO: Calculate if lat/lon provided
      FROM artwork a
      LEFT JOIN tags type_tag ON (type_tag.artwork_id = a.id AND type_tag.label = 'artwork_type')
      LEFT JOIN logbook l ON a.id = l.artwork_id
      WHERE a.status = 'approved'
        AND (
          type_tag.value LIKE ? OR
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
        const logbookEntries = await getAllLogbookEntriesForArtworkFromSubmissions(c.env.DB, artwork.id);

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
      SELECT a.*, COALESCE(type_tag.value, 'unknown') as type_name, COUNT(l.id) as submission_count
      FROM artwork a
      LEFT JOIN tags type_tag ON (type_tag.artwork_id = a.id AND type_tag.label = 'artwork_type')
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
        const logbookEntries = await getAllLogbookEntriesForArtworkFromSubmissions(c.env.DB, artwork.id);

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
      SELECT a.*, COALESCE(type_tag.value, 'unknown') as type_name
      FROM artwork a
      LEFT JOIN tags type_tag ON (type_tag.artwork_id = a.id AND type_tag.label = 'artwork_type')
      WHERE a.status = 'approved'
      ORDER BY a.created_at DESC
      LIMIT ?
    `);

    const results = await stmt.bind(limit).all();

    // Format results
    const artworksWithPhotos: ArtworkWithPhotos[] = await Promise.all(
      (results.results as unknown as ArtworkWithPhotos[]).map(async artwork => {
        const logbookEntries = await getAllLogbookEntriesForArtworkFromSubmissions(c.env.DB, artwork.id);

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
        const logbookEntries = await getAllLogbookEntriesForArtworkFromSubmissions(c.env.DB, artwork.id);

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

/**
 * POST /api/artworks/check-similarity - Check for Similar Artworks
 * Dedicated endpoint for the fast photo-first workflow to check for duplicates
 */
export async function checkArtworkSimilarity(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const validatedData = getValidatedData<{
    lat: number;
    lon: number;
    title?: string;
    tags?: string[]; // Array of tag values for similarity comparison
    radius?: number;
    limit?: number;
    dev_mode?: boolean; // Include detailed similarity breakdown
  }>(c, 'body');

  const db = createDatabaseService(c.env.DB);

  // Use fast workflow defaults
  const radius = validatedData.radius || DEFAULT_ARTWORK_SEARCH_RADIUS;
  const limit = validatedData.limit || 10; // Fewer results for similarity check

  try {
    // Find nearby artworks as candidates
    const candidates = await db.findNearbyArtworks(
      validatedData.lat,
      validatedData.lon,
      radius,
      limit
    );

    // If no candidates, no duplicates possible
    if (candidates.length === 0) {
      return c.json(createSuccessResponse({
        has_similar_artworks: false,
        high_similarity_count: 0,
        warning_similarity_count: 0,
        candidates: [],
        similarity_service: null,
      }));
    }

    // Check for similarity using the similarity service
    const similarityService = createSimilarityService({
      includeMetadata: validatedData.dev_mode === true,
    });

    const query: SimilarityQuery = {
      coordinates: { lat: validatedData.lat, lon: validatedData.lon },
      ...(validatedData.title && { title: validatedData.title }),
      ...(validatedData.tags && { tags: validatedData.tags }),
    };

    // Convert candidates to similarity format
    const similarityCandidates = candidates.map(artwork => ({
      id: artwork.id,
      coordinates: { lat: artwork.lat, lon: artwork.lon },
  title: (artwork as ArtworkRecord & { title?: string }).title ?? null,
  tags: (artwork as ArtworkRecord & { tags?: string | null }).tags ?? null, // JSON string format
      type_name: artwork.type_name,
      distance_meters: Math.round(artwork.distance_km * 1000),
    }));

    const duplicateCheck = similarityService.checkForDuplicates(query, similarityCandidates);

    // Format candidates with photos for display
    const candidatesWithPhotos = await Promise.all(
      candidates.slice(0, 5).map(async artwork => { // Limit to top 5 for performance
        const logbookEntries = await getAllLogbookEntriesForArtworkFromSubmissions(c.env.DB, artwork.id);
        const allPhotos: string[] = [];
        
        logbookEntries.forEach(entry => {
          if (entry.photos) {
            const photos = safeJsonParse<string[]>(entry.photos, []);
            allPhotos.push(...photos);
          }
        });

        // Find similarity result for this artwork
        const allSimilarityResults = similarityService.calculateSimilarityScores(query, similarityCandidates);
        const similarityResult = allSimilarityResults.find(result => result.artworkId === artwork.id);

        return {
          id: artwork.id,
          lat: artwork.lat,
          lon: artwork.lon,
          type_name: artwork.type_name,
          distance_meters: Math.round(artwork.distance_km * 1000),
          title: (artwork as ArtworkRecord & { title?: string }).title ?? null,
          tags: (artwork as ArtworkRecord & { tags?: string | null }).tags ?? null,
          photos: allPhotos.slice(0, 1), // Just first photo for preview
          // Similarity enhancements
          similarity_score: similarityResult?.overallScore,
          similarity_threshold: similarityResult?.threshold,
          similarity_explanation: similarityResult ? getSimilarityExplanation(similarityResult) : undefined,
          ...(validatedData.dev_mode && similarityResult && {
            similarity_signals: similarityResult.signals.map(signal => ({
              type: signal.type,
              raw_score: signal.rawScore,
              weighted_score: signal.weightedScore,
              metadata: signal.metadata,
            }))
          })
        };
      })
    );

    const response = {
      has_similar_artworks: duplicateCheck.hasHighSimilarity || duplicateCheck.hasWarningSimilarity,
      high_similarity_count: duplicateCheck.highSimilarityMatches.length,
      warning_similarity_count: duplicateCheck.warningSimilarityMatches.length,
      candidates: candidatesWithPhotos,
      search_params: {
        center: { lat: validatedData.lat, lon: validatedData.lon },
        radius_meters: radius,
        title: validatedData.title,
        tags: validatedData.tags,
      },
      similarity_service: {
        strategy: similarityService.getStrategyInfo(),
        dev_mode: validatedData.dev_mode === true,
      },
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Failed to check artwork similarity:', error);
    
    // Graceful degradation - return basic nearby results without similarity
    try {
      const basicCandidates = await db.findNearbyArtworks(
        validatedData.lat,
        validatedData.lon,
        radius,
        Math.min(limit, 5)
      );

      const basicResponse = {
        has_similar_artworks: false,
        high_similarity_count: 0,
        warning_similarity_count: 0,
        candidates: basicCandidates.map(artwork => ({
          id: artwork.id,
          lat: artwork.lat,
          lon: artwork.lon,
          type_name: artwork.type_name,
          distance_meters: Math.round(artwork.distance_km * 1000),
          title: (artwork as ArtworkRecord & { title?: string }).title ?? null,
          tags: (artwork as ArtworkRecord & { tags?: string | null }).tags ?? null,
          photos: [],
        })),
        search_params: {
          center: { lat: validatedData.lat, lon: validatedData.lon },
          radius_meters: radius,
        },
        similarity_service: {
          error: 'Similarity service unavailable, showing distance-only results',
          dev_mode: validatedData.dev_mode === true,
        },
      };

      return c.json(createSuccessResponse(basicResponse));
    } catch (fallbackError) {
      console.error('Fallback nearby search also failed:', fallbackError);
      throw error; // Throw original error
    }
  }
}

/**
 * Helper function to generate similarity explanations
 * Extracted here to avoid circular dependencies
 */
interface SimilaritySignalMeta { distanceMeters?: number; [key: string]: unknown }
interface SimilaritySignal { type: string; rawScore: number; metadata?: SimilaritySignalMeta }
function getSimilarityExplanation(result: { overallScore: number; signals: SimilaritySignal[] }): string {
  const { overallScore, signals } = result;
  const explanations: string[] = [];

  for (const signal of signals) {
    if (signal.type === 'distance' && signal.metadata?.distanceMeters) {
      const distance = Math.round(signal.metadata.distanceMeters);
      explanations.push(`${distance}m away`);
    } else if (signal.type === 'title' && signal.rawScore > 0.5) {
      explanations.push('similar title');
    } else if (signal.type === 'tags' && signal.rawScore > 0.3) {
      explanations.push('matching tags');
    }
  }

  const scorePercent = Math.round(overallScore * 100);
  return explanations.length > 0 
    ? `${scorePercent}% similar (${explanations.join(', ')})`
    : `${scorePercent}% similar`;
}

/**
 * GET /api/artworks - List All Approved Artworks (Index Page)
 * Returns paginated list of all approved artworks for browsing
 * Query parameters:
 * - page: page number (default: 1)
 * - limit: items per page (default: 30, max: 50)
 * - sort: sorting option (updated_desc, title_asc, created_desc)
 */
export async function getArtworksList(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
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

    // Get artworks with type information and primary artist
    const artworksQuery = `
      SELECT a.id, a.lat, a.lon, a.created_at, a.status, a.tags, 
             a.title, a.description,
             COALESCE(json_extract(a.tags, '$.artwork_type'), 'unknown') as type_name,
             COALESCE(art.name, 'Unknown Artist') as primary_artist_name
      FROM artwork a
      LEFT JOIN artwork_artists aa ON a.id = aa.artwork_id AND aa.role = 'primary'
      LEFT JOIN artists art ON aa.artist_id = art.id
      WHERE a.status = 'approved'
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const artworks = await db.db.prepare(artworksQuery)
      .bind(limit, offset)
      .all();

    // Get photos for each artwork
    const artworksWithPhotos = await Promise.all(
      (artworks.results as unknown as (ArtworkRecord & { type_name?: string; primary_artist_name?: string })[] || []).map(async (artwork) => {
        // Get logbook entries for this artwork to find photos
        const logbookEntries = await getAllLogbookEntriesForArtworkFromSubmissions(c.env.DB, artwork.id);
        const allPhotos: string[] = [];
        
        logbookEntries.forEach(entry => {
          if (entry.photos) {
            const photos = safeJsonParse<string[]>(entry.photos, []);
            allPhotos.push(...photos);
          }
        });

        // Use primary artist name from JOIN query, with fallback to tags
        let artistName = artwork.primary_artist_name || 'Unknown Artist';
        
        // Fallback to tags if no artist found through relationships
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
          type_name: artwork.type_name,
          photos: allPhotos,
          tags_parsed: safeJsonParse(artwork.tags, {}),
          // Add derived fields for card display
          recent_photo: (() : string | null => {
            if (allPhotos.length > 0) {
              const photo = allPhotos[0];
              if (photo) {
                return (photo.startsWith('http') || photo.startsWith('/photos/'))
                  ? photo
                  : `/photos/${photo}`;
              }
            }
            return null;
          })(),
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
