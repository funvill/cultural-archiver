/**
 * Discovery route handlers - Updated for New Unified Schema
 * Handles artwork search and details using the new unified submissions table
 * 
 * UPDATED: Uses new submissions service instead of legacy logbook table
 */

import type { Context } from 'hono';
import type {
  WorkerEnv,
  ArtworkRecord,
  ArtworkDetailResponse,
  ArtworkWithPhotos,
  NearbyArtworksResponse,
  ArtworkCreatorInfo,
} from '../types';
import type { StructuredTagsData } from '../../shared/types';
import { DEFAULT_ARTWORK_SEARCH_RADIUS } from '../../shared/geo';
import { createSuccessResponse, NotFoundError } from '../lib/errors';
import { getValidatedData } from '../middleware/validation';
import { safeJsonParse } from '../lib/errors';
import { createSimilarityService } from '../lib/similarity';
import type { SimilarityQuery } from '../../shared/similarity';

// Import new submissions service
import { getLogbookEntries } from '../lib/submissions.js';

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

interface LogbookEntryWithPhotos {
  id: string;
  artwork_id: string;
  user_token: string;
  submitter_name: string | null;
  lat?: number;
  lon?: number;
  notes: string | null;
  photos: string | null;
  photos_parsed: string[];
  created_at: string;
  verification_status: string;
  status: string;
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
    similarity_query?: SimilarityQuery;
    include_similarity_scores?: boolean;
  }>(c, 'query');

  const radius = validatedQuery.radius || DEFAULT_ARTWORK_SEARCH_RADIUS;
  const limit = Math.min(validatedQuery.limit || 50, 100);

  // Direct database query for nearby artworks
  const latDelta = radius / 111320;
  const lonDelta = radius / (111320 * Math.cos(validatedQuery.lat * Math.PI / 180));

  const artworks = await c.env.DB.prepare(`
    SELECT id, title, artist_names, year_created, medium, dimensions,
           lat, lon, address, neighborhood, city, region, country,
           description, photos, tags, source_type, source_id,
           created_at, updated_at, status,
           (6371 * acos(cos(radians(?)) * cos(radians(lat)) * 
           cos(radians(lon) - radians(?)) + sin(radians(?)) * sin(radians(lat)))) as distance_km
    FROM artwork 
    WHERE lat BETWEEN ? AND ? 
    AND lon BETWEEN ? AND ?
    AND status = 'approved'
    HAVING distance_km <= ?
    ORDER BY distance_km
    LIMIT ?
  `).bind(
    validatedQuery.lat, validatedQuery.lon, validatedQuery.lat,
    validatedQuery.lat - latDelta, validatedQuery.lat + latDelta,
    validatedQuery.lon - lonDelta, validatedQuery.lon + lonDelta,
    radius / 1000,
    limit
  ).all();

  if (!artworks.results) {
    return c.json(createSuccessResponse({ artworks: [], total_count: 0 }));
  }

  // Get photo debug setting
  const photoDebugEnabled = c.env.PHOTO_DEBUG === '1' || c.env.PHOTO_DEBUG === 'true';

  // Format response with photos and additional info
  const artworksWithPhotos = await Promise.all(
    (artworks.results as any[]).map(async (artwork: any) => {
      // Get logbook entries (submissions) for this artwork to find photos
      const logbookSubmissions = await getLogbookEntries(c.env.DB, artwork.id, 'approved');

      // Extract photos from approved logbook submissions
      const combinedPhotos: string[] = [];
      logbookSubmissions.forEach(submission => {
        if (submission.photos) {
          const photos = Array.isArray(submission.photos) ? submission.photos : 
                        safeJsonParse<string[]>(JSON.stringify(submission.photos), []);
          for (const p of photos) {
            if (typeof p === 'string' && !combinedPhotos.includes(p)) combinedPhotos.push(p);
          }
        }
      });

      // Also include artwork-level photos stored under _photos in tags (set during approval)
      try {
        if (artwork.tags) {
          // Parse artwork tags (unknown -> record)
          const raw = safeJsonParse<Record<string, unknown>>(artwork.tags || '{}', {});
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
          logbook_submissions: logbookSubmissions.length,
          aggregated_photos: combinedPhotos.length,
          has_artwork_tags: !!artwork.tags,
        });
      }

      // Parse tags for duplicate detection compatibility
      let tags_parsed: Record<string, unknown> = {};
      try {
        if (artwork.tags) {
          tags_parsed = safeJsonParse<Record<string, unknown>>(artwork.tags || '{}', {});
        }
      } catch (e) {
        console.warn('Failed to parse artwork tags for nearby API', { artwork_id: artwork.id, error: e });
      }

      return {
        ...artwork,
        type_name: 'artwork', // Add required type_name property
        recent_photo: combinedPhotos.length > 0 ? combinedPhotos[0] : undefined,
        photo_count: combinedPhotos.length,
        distance_km: Number(artwork.distance_km),
        tags_parsed,
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

  // Handle similarity scoring if requested
  if (validatedQuery.similarity_query && validatedQuery.include_similarity_scores) {
    try {
      const similarityService = createSimilarityService(c.env);
      
      // Convert artworks to similarity format and score them
      const artworksWithScores = await similarityService.scoreArtworks(
        validatedQuery.similarity_query,
        artworksWithPhotos.map(artwork => ({
          id: artwork.id,
          title: artwork.title || '',
          description: artwork.description || '',
          tags_parsed: artwork.tags_parsed || {},
          photos: artwork.recent_photo ? [artwork.recent_photo] : [],
          lat: artwork.lat,
          lon: artwork.lon,
        }))
      );

      // Merge scores back into the artwork objects
      const scoredArtworks = artworksWithPhotos.map(artwork => {
        const scored = artworksWithScores.find(s => s.id === artwork.id);
        return {
          ...artwork,
          similarity_score: scored?.similarity_score || 0,
          similarity_details: scored?.similarity_details
        };
      });

      // Sort by similarity score if scoring was requested
      scoredArtworks.sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0));

      const response: NearbyArtworksResponse = {
        artworks: scoredArtworks,
        total_count: scoredArtworks.length,
        query_lat: validatedQuery.lat,
        query_lon: validatedQuery.lon,
        radius_km: radius / 1000,
        similarity_scored: true
      };

      return c.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Similarity scoring failed, falling back to distance-only results:', error);
    }
  }

  const response: NearbyArtworksResponse = {
    artworks: artworksWithPhotos,
    total_count: artworksWithPhotos.length,
    query_lat: validatedQuery.lat,
    query_lon: validatedQuery.lon,
    radius_km: radius / 1000,
    similarity_scored: false
  };

  return c.json(createSuccessResponse(response));
}

/**
 * GET /api/artworks/:id - Get Artwork Details
 * Returns complete artwork details with creators and paginated logbook timeline
 */
export async function getArtworkDetails(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const artworkId = c.req.param('id');
  if (!artworkId) {
    throw new NotFoundError('Artwork ID is required');
  }

  // Parse pagination parameters
  const page = parseInt(c.req.query('page') || '1');
  const perPage = Math.min(parseInt(c.req.query('per_page') || '10'), 50);
  const offset = (page - 1) * perPage;

  // Get artwork details
  const artwork = await c.env.DB.prepare(`
    SELECT id, title, artist_names, year_created, medium, dimensions,
           lat, lon, address, neighborhood, city, region, country,
           description, photos, tags, status, source_type, source_id,
           created_at, updated_at
    FROM artwork WHERE id = ? AND status = 'approved'
  `).bind(artworkId).first<ArtworkRecord>();

  if (!artwork) {
    throw new NotFoundError('Artwork not found');
  }

  // Get artists for this artwork (if using artists table)
  // This would need to be implemented based on your artist system
  const artists: ArtworkCreatorInfo[] = [];

  // Get logbook entries (submissions) for timeline with pagination
  const logbookSubmissions = await getLogbookEntries(c.env.DB, artworkId, 'approved', perPage, offset);

  // Format logbook entries with parsed photos
  const logbookEntriesWithPhotos: LogbookEntryWithPhotos[] = logbookSubmissions.map(submission => ({
    id: submission.id,
    artwork_id: submission.artwork_id || artworkId,
    user_token: submission.user_token,
    submitter_name: submission.submitter_name || null,
    lat: submission.lat || undefined,
    lon: submission.lon || undefined,
    notes: submission.notes,
    photos: submission.photos ? JSON.stringify(submission.photos) : null,
    photos_parsed: Array.isArray(submission.photos) ? submission.photos : 
                   submission.photos ? safeJsonParse<string[]>(JSON.stringify(submission.photos), []) : [],
    created_at: submission.created_at,
    verification_status: submission.verification_status || 'pending',
    status: submission.status
  }));

  // Get all photos from logbook entries (paginated subset for timeline)
  const allPhotos: string[] = [];
  logbookEntriesWithPhotos.forEach(entry => {
    allPhotos.push(...entry.photos_parsed);
  });

  // Also include any artwork-level photos stored in tags._photos (set during approval)
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
    console.warn('Failed to parse artwork-level photos for detail view', e);
  }

  // Parse structured tags for display
  let structuredTags: StructuredTagsData | null = null;
  try {
    if (artwork.tags) {
      const rawTags = safeJsonParse<Record<string, unknown>>(artwork.tags, {});
      // You would need to implement categorizeTagsForDisplay based on your tag schema
      // structuredTags = categorizeTagsForDisplay(rawTags);
    }
  } catch (e) {
    console.warn('Failed to parse structured tags for artwork details', e);
  }

  // Parse photos from artwork record
  let artworkPhotos: string[] = [];
  try {
    if (artwork.photos) {
      artworkPhotos = safeJsonParse<string[]>(artwork.photos, []);
    }
  } catch (e) {
    console.warn('Failed to parse artwork photos', e);
  }

  const response: ArtworkDetailResponse = {
    ...artwork,
    photos_parsed: artworkPhotos,
    creators: artists,
    logbook_entries: logbookEntriesWithPhotos,
    all_photos: allPhotos,
    structured_tags: structuredTags,
    pagination: {
      page,
      per_page: perPage,
      total_count: logbookEntriesWithPhotos.length,
      has_more: logbookEntriesWithPhotos.length === perPage
    }
  };

  return c.json(createSuccessResponse(response));
}

/**
 * GET /api/stats - Get platform statistics
 */
export async function getStats(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  try {
    // Get artwork statistics
    const artworkStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_artworks,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_artworks,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_artworks
      FROM artwork
    `).first<ArtworkStatsResult>();

    // Get submission statistics (replaces logbook stats)
    const submissionStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as recent_submissions
      FROM submissions
    `).first<SubmissionStatsResult>();

    const stats = {
      artworks: {
        total: artworkStats?.total_artworks || 0,
        approved: artworkStats?.approved_artworks || 0,
        pending: artworkStats?.pending_artworks || 0
      },
      submissions: {
        total: submissionStats?.total_submissions || 0,
        recent: submissionStats?.recent_submissions || 0
      }
    };

    return c.json(createSuccessResponse(stats));

  } catch (error) {
    console.error('Error getting stats:', error);
    throw new Error('Failed to retrieve platform statistics');
  }
}

/**
 * Helper function to get logbook entries as photos from submissions
 * This replaces the old db.getLogbookEntriesForArtwork() calls
 */
async function getArtworkPhotosFromSubmissions(
  db: D1Database,
  artworkId: string
): Promise<string[]> {
  const submissions = await getLogbookEntries(db, artworkId, 'approved');
  const photos: string[] = [];
  
  submissions.forEach(submission => {
    if (submission.photos && Array.isArray(submission.photos)) {
      photos.push(...submission.photos);
    }
  });
  
  return photos;
}

/**
 * GET /api/artworks/export - Export artworks in various formats
 */
export async function exportArtworks(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const format = c.req.query('format') || 'geojson';
  const limit = Math.min(parseInt(c.req.query('limit') || '1000'), 5000);

  try {
    // Get approved artworks for export
    const artworks = await c.env.DB.prepare(`
      SELECT id, title, artist_names, year_created, medium,
             lat, lon, address, neighborhood, city, region, country,
             description, tags, created_at, updated_at
      FROM artwork 
      WHERE status = 'approved'
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all<ArtworkRecord>();

    if (!artworks.results) {
      return c.json(createSuccessResponse({ artworks: [], total_count: 0 }));
    }

    // Add photos from submissions for each artwork
    const artworksWithPhotos = await Promise.all(
      artworks.results.map(async artwork => {
        const photos = await getArtworkPhotosFromSubmissions(c.env.DB, artwork.id);
        return {
          ...artwork,
          photos: photos,
          tags_parsed: artwork.tags ? safeJsonParse<Record<string, unknown>>(artwork.tags, {}) : {}
        };
      })
    );

    if (format === 'geojson') {
      const geojson = {
        type: 'FeatureCollection',
        features: artworksWithPhotos.map(artwork => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [artwork.lon, artwork.lat]
          },
          properties: {
            id: artwork.id,
            title: artwork.title,
            artist_names: artwork.artist_names,
            year_created: artwork.year_created,
            medium: artwork.medium,
            description: artwork.description,
            address: artwork.address,
            neighborhood: artwork.neighborhood,
            city: artwork.city,
            region: artwork.region,
            country: artwork.country,
            photos: artwork.photos,
            tags: artwork.tags_parsed,
            created_at: artwork.created_at,
            updated_at: artwork.updated_at
          }
        }))
      };

      return c.json(geojson, {
        headers: {
          'Content-Type': 'application/geo+json',
          'Content-Disposition': `attachment; filename="cultural-archiver-export-${new Date().toISOString().split('T')[0]}.geojson"`
        }
      });
    }

    // Default JSON format
    return c.json(createSuccessResponse({
      artworks: artworksWithPhotos,
      total_count: artworksWithPhotos.length,
      exported_at: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Error exporting artworks:', error);
    throw new Error('Failed to export artworks');
  }
}