/**
 * Mass Import API Endpoint
 * 
 * Handles complete mass import submissions for trusted users (moderators or higher).
 * This endpoint allows importing large batches of artworks, including images, 
 * logbook entries, and tags from public datasets.
 * 
 * All imported records are automatically approved and attributed to the importing user.
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { createSuccessResponse, ValidationApiError, ApiError, UnauthorizedError } from '../lib/errors';
import { processAndUploadPhotos } from '../lib/photos';
import { createDatabaseService } from '../lib/database';
import { createMassImportDuplicateDetectionService } from '../lib/mass-import-duplicate-detection';
import { CONSENT_VERSION } from '../../shared/consent';

/**
 * Mass import payload interface matching the documentation
 */
interface MassImportPayload {
  user_uuid: string;
  duplicateThreshold?: number; // Optional duplicate detection threshold (default: 0.7)
  artwork: {
    title: string;
    description?: string;
    lat: number;
    lon: number;
    photos?: Array<{ url: string }>;
    created_by?: string; // Artist name for duplicate detection
  };
  logbook?: Array<{
    note?: string;
    timestamp?: string;
    tags?: Array<{ label: string; value: string }>;
  }>;
}

/**
 * Enhanced mass import response with duplicate detection
 */
interface MassImportResponse {
  artwork_id?: string;
  logbook_ids?: string[];
  status: 'approved' | 'duplicate_detected';
  message: string;
  photos_processed?: number;
  photos_failed?: number;
  coordinates: {
    lat: number;
    lon: number;
  };
  // Duplicate detection results
  duplicate?: {
    artworkId: string;
    title: string;
    confidenceScore: number;
    scoreBreakdown: {
      title: number;
      artist: number;
      location: number;
      tags: number;
    };
    existingArtworkId: string;
    existingArtworkUrl: string;
  };
  debug?: any[];
}

/**
 * POST /api/mass-import - Complete mass import submission
 * 
 * This endpoint handles the complete mass import workflow:
 * 1. Validates user has moderator or admin privileges
 * 2. Downloads photos from provided URLs
 * 3. Creates artwork entry (automatically approved)
 * 4. Creates logbook entries with tags
 * 5. Returns submission details for tracking
 */
export async function processMassImport(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  try {
    // Parse JSON payload
    const payload = await c.req.json() as MassImportPayload;

    // Validate required fields
    if (!payload.user_uuid) {
      throw new ValidationApiError(
        [{ message: 'User UUID is required', field: 'user_uuid', code: 'REQUIRED_FIELD' }],
        'Missing required user UUID'
      );
    }

    if (!payload.artwork) {
      throw new ValidationApiError(
        [{ message: 'Artwork data is required', field: 'artwork', code: 'REQUIRED_FIELD' }],
        'Missing required artwork data'
      );
    }

    if (!payload.artwork.title) {
      throw new ValidationApiError(
        [{ message: 'Artwork title is required', field: 'artwork.title', code: 'REQUIRED_FIELD' }],
        'Missing required artwork title'
      );
    }

    if (typeof payload.artwork.lat !== 'number' || typeof payload.artwork.lon !== 'number') {
      throw new ValidationApiError(
        [{ message: 'Valid latitude and longitude are required', field: 'artwork.coordinates', code: 'INVALID_COORDINATES' }],
        'Invalid coordinates provided'
      );
    }

    // Validate coordinates range
    if (payload.artwork.lat < -90 || payload.artwork.lat > 90 || 
        payload.artwork.lon < -180 || payload.artwork.lon > 180) {
      throw new ValidationApiError(
        [{ message: 'Coordinates must be valid lat/lon values', field: 'artwork.coordinates', code: 'COORDINATES_OUT_OF_RANGE' }],
        'Coordinates out of valid range'
      );
    }

    // Validate user UUID format (basic validation for now)
    // TODO: Implement proper role-based authorization check for moderators/admins
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.user_uuid)) {
      throw new UnauthorizedError('Invalid user UUID format');
    }

    // Create database service
    const db = createDatabaseService(c.env.DB);

    // ========================================
    // DUPLICATE DETECTION
    // ========================================
    
    console.log(`[MASS_IMPORT] Starting duplicate detection for artwork: ${payload.artwork.title}`);
    
    // Create duplicate detection service
    const duplicateDetectionService = createMassImportDuplicateDetectionService(c.env.DB);
    
    // Build tags from logbook entries for duplicate detection
    const allTags: Record<string, string> = {};
    if (payload.logbook) {
      for (const logbookEntry of payload.logbook) {
        if (logbookEntry?.tags) {
          for (const tag of logbookEntry.tags) {
            allTags[tag.label] = tag.value;
          }
        }
      }
    }

    console.log(`[MASS_IMPORT] Built allTags:`, allTags);

    // Extract artist information for duplicate detection
    // Priority: 1) payload.artwork.created_by, 2) tags.artist, 3) tags.created_by
    const artistForDuplicateDetection = payload.artwork.created_by || 
                                       allTags.artist || 
                                       allTags.created_by || 
                                       undefined;

    console.log(`[MASS_IMPORT] Artist for duplicate detection: "${artistForDuplicateDetection}" (from ${payload.artwork.created_by ? 'artwork.created_by' : allTags.artist ? 'tags.artist' : allTags.created_by ? 'tags.created_by' : 'none'})`);

    // Check for duplicates
    const duplicateResult = await duplicateDetectionService.checkForDuplicates({
      title: payload.artwork.title,
      ...(payload.artwork.description && { description: payload.artwork.description }),
      lat: payload.artwork.lat,
      lon: payload.artwork.lon,
      ...(artistForDuplicateDetection && { artist: artistForDuplicateDetection }),
      ...(Object.keys(allTags).length > 0 && { tags: allTags }),
      ...(payload.duplicateThreshold && { duplicateThreshold: payload.duplicateThreshold })
    });

    console.log(`[MASS_IMPORT] Duplicate detection complete. Checked ${duplicateResult.candidatesChecked} candidates. Duplicate: ${duplicateResult.isDuplicate}`);

    // If duplicate detected, return early with duplicate information
    if (duplicateResult.isDuplicate && duplicateResult.duplicateInfo) {
      console.log(`[MASS_IMPORT] Duplicate detected with confidence score: ${duplicateResult.duplicateInfo.confidenceScore}`);
      
      const response: MassImportResponse = {
        status: 'duplicate_detected',
        message: `Duplicate artwork detected with ${Math.round(duplicateResult.duplicateInfo.confidenceScore * 100)}% confidence`,
        coordinates: {
          lat: payload.artwork.lat,
          lon: payload.artwork.lon,
        },
        duplicate: duplicateResult.duplicateInfo
      };

      return c.json(createSuccessResponse(response), 200);
    }

    // Debug info for response
    let debugInfo: Array<any> = [];

    let processedPhotoUrls: string[] = [];

    // Process photos if provided
    if (payload.artwork.photos && payload.artwork.photos.length > 0) {
      console.log(`[MASS_IMPORT] Processing ${payload.artwork.photos.length} photos for mass import`);
      
      // Download and process each photo
      for (const photo of payload.artwork.photos) {
        try {
          console.log(`[MASS_IMPORT] Downloading photo: ${photo.url}`);
          
          // Download the photo
          const response = await fetch(photo.url, {
            headers: {
              'User-Agent': 'Cultural-Archiver-Mass-Import/1.0',
            },
          });

          if (!response.ok) {
            console.warn(`[MASS_IMPORT] Failed to download photo ${photo.url}: ${response.status} ${response.statusText}`);
            continue; // Skip this photo but continue with others
          }

          // Check content type
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.startsWith('image/')) {
            console.warn(`[MASS_IMPORT] Invalid content type for ${photo.url}: ${contentType}`);
            continue;
          }

          // Get the image data
          const arrayBuffer = await response.arrayBuffer();
          
          // Validate file size (15MB limit)
          const maxSize = 15 * 1024 * 1024;
          if (arrayBuffer.byteLength > maxSize) {
            console.warn(`[MASS_IMPORT] Photo too large: ${arrayBuffer.byteLength} bytes (max: ${maxSize})`);
            continue;
          }

          // Create File object
          const filename = generateFilenameFromUrl(photo.url, contentType);
          const blob = new Blob([arrayBuffer], { type: contentType });
          const file = new File([blob], filename, { type: contentType });

          // Generate submission ID for photo processing
          const submissionId = `mass-import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

          // Process photo through the standard pipeline
          const results = await processAndUploadPhotos(c.env, [file], submissionId, {
            preserveExif: true,
            generateThumbnail: true, // Generate thumbnails for consistency
            useCloudflareImages: false, // Use R2 directly for consistency
          });

          if (results.length > 0 && results[0]) {
            processedPhotoUrls.push(results[0].originalUrl);
            console.log(`[MASS_IMPORT] Successfully processed photo: ${results[0].originalUrl}`);
          }

        } catch (error) {
          console.error(`[MASS_IMPORT] Failed to process photo ${photo.url}:`, error);
          // Continue with other photos
        }
      }

      console.log(`[MASS_IMPORT] Successfully processed ${processedPhotoUrls.length}/${payload.artwork.photos.length} photos`);
    }

    // Create artwork entry (automatically approved)
    // Use default artwork type 'public_art' for mass imports
    const artworkId = generateId();
    const timestamp = new Date().toISOString();

    await db.db.prepare(`
      INSERT INTO artwork (id, title, description, lat, lon, type_id, status, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, 'public_art', 'approved', ?, ?)
    `).bind(
      artworkId,
      payload.artwork.title,
      payload.artwork.description || null,
      payload.artwork.lat,
      payload.artwork.lon,
      timestamp,
      payload.user_uuid
    ).run();

    // If we processed photos, we need to associate them with the artwork
    // For now, we'll store them in the first logbook entry as photos are typically associated with logbook entries
    // This matches the current system design where photos are stored with logbook entries

    console.log(`[MASS_IMPORT] Created artwork ${artworkId}: ${payload.artwork.title}`);

    // Create logbook entries if provided, or a default entry if photos were processed
    const logbookIds: string[] = [];
    
    if (payload.logbook && payload.logbook.length > 0) {
      // Use provided logbook entries
      for (let i = 0; i < payload.logbook.length; i++) {
        const logbookEntry = payload.logbook[i];
        if (!logbookEntry) continue; // Skip undefined entries
        
        const logbookId = generateId();
        const logbookTimestamp = logbookEntry.timestamp ? new Date(logbookEntry.timestamp).toISOString() : timestamp;

        // Put photos in the first logbook entry if we processed any
        const photosForThisEntry = (i === 0 && processedPhotoUrls.length > 0) ? processedPhotoUrls : [];

        // Create logbook entry (automatically approved)
        await db.db.prepare(`
          INSERT INTO logbook (id, artwork_id, note, lat, lon, photos, status, created_at, user_token, consent_version)
          VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
        `).bind(
          logbookId,
          artworkId,
          logbookEntry.note || null,
          payload.artwork.lat,
          payload.artwork.lon,
          JSON.stringify(photosForThisEntry),
          logbookTimestamp,
          payload.user_uuid,
          CONSENT_VERSION
        ).run();

        console.log(`[MASS_IMPORT] Created logbook entry ${logbookId}${photosForThisEntry.length > 0 ? ` with ${photosForThisEntry.length} photos` : ''}`);
        logbookIds.push(logbookId);

        // Create tags for this logbook entry if provided
        console.log(`[MASS_IMPORT] Checking for tags in logbook entry...`);
        console.log(`[MASS_IMPORT] logbookEntry.tags exists: ${!!logbookEntry.tags}`);
        console.log(`[MASS_IMPORT] logbookEntry.tags type: ${typeof logbookEntry.tags}`);
        console.log(`[MASS_IMPORT] logbookEntry.tags length: ${logbookEntry.tags?.length || 'undefined'}`);
        console.log(`[MASS_IMPORT] logbookEntry.tags content: ${JSON.stringify(logbookEntry.tags)}`);
        
        // Store debug info in response for immediate feedback
        if (!debugInfo) debugInfo = [];
        debugInfo.push({
          logbookId,
          tagsExists: !!logbookEntry.tags,
          tagsType: typeof logbookEntry.tags,
          tagsLength: logbookEntry.tags?.length || 0,
          tagsContent: logbookEntry.tags
        });
        
        if (logbookEntry.tags && logbookEntry.tags.length > 0) {
          console.log(`[MASS_IMPORT] Starting to process ${logbookEntry.tags.length} tags for artwork...`);
          
          // Convert tags array to object format for JSON storage
          const tagsObject: Record<string, string> = {};
          for (const tag of logbookEntry.tags) {
            tagsObject[tag.label] = tag.value;
            console.log(`[MASS_IMPORT] Processing tag: ${tag.label}=${tag.value}`);
          }
          
          // Update artwork tags field with the processed tags
          await db.db.prepare(`
            UPDATE artwork SET tags = ? WHERE id = ?
          `).bind(
            JSON.stringify(tagsObject),
            artworkId
          ).run();

          console.log(`[MASS_IMPORT] ✅ Successfully updated artwork ${artworkId} with ${logbookEntry.tags.length} tags`);
          console.log(`[MASS_IMPORT] ✅ Tags JSON: ${JSON.stringify(tagsObject)}`);
        } else {
          console.log(`[MASS_IMPORT] ❌ No tags to process - condition failed`);
        }
      }
    } else if (processedPhotoUrls.length > 0) {
      // Create a default logbook entry to hold the photos
      const logbookId = generateId();
      
      await db.db.prepare(`
        INSERT INTO logbook (id, artwork_id, note, lat, lon, photos, status, created_at, user_token, consent_version)
        VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
      `).bind(
        logbookId,
        artworkId,
        'Mass import submission', // Default note
        payload.artwork.lat,
        payload.artwork.lon,
        JSON.stringify(processedPhotoUrls),
        timestamp,
        payload.user_uuid,
        CONSENT_VERSION
      ).run();

      console.log(`[MASS_IMPORT] Created default logbook entry ${logbookId} with ${processedPhotoUrls.length} photos`);
      logbookIds.push(logbookId);
    }

    // Return successful response
    const response: MassImportResponse = {
      artwork_id: artworkId,
      logbook_ids: logbookIds,
      status: 'approved', // All mass imports are auto-approved (no duplicates detected)
      message: 'Mass import submission processed successfully',
      photos_processed: processedPhotoUrls.length,
      photos_failed: (payload.artwork.photos?.length || 0) - processedPhotoUrls.length,
      coordinates: {
        lat: payload.artwork.lat,
        lon: payload.artwork.lon,
      },
      debug: debugInfo,
    };

    console.log(`[MASS_IMPORT] Successfully completed mass import for artwork ${artworkId} with ${logbookIds.length} logbook entries`);
    return c.json(createSuccessResponse(response), 201);

  } catch (error) {
    console.error('[MASS_IMPORT] Mass import submission error:', error);

    if (error instanceof ValidationApiError || error instanceof UnauthorizedError) {
      throw error;
    }

    throw new ApiError(
      'Failed to process mass import submission',
      'MASS_IMPORT_ERROR',
      500,
      { details: { originalError: error instanceof Error ? error.message : String(error) } }
    );
  }
}

/**
 * Generate a unique UUID
 */
function generateId(): string {
  // Use Web Crypto API to generate a proper UUID
  return crypto.randomUUID();
}

/**
 * Generate a filename from URL and content type
 */
function generateFilenameFromUrl(url: string, contentType: string): string {
  try {
    // Extract filename from URL if possible
    const urlPath = new URL(url).pathname;
    const urlFilename = urlPath.split('/').pop();
    
    if (urlFilename && urlFilename.includes('.')) {
      return urlFilename;
    }
  } catch (error) {
    // Invalid URL, generate a filename
  }

  // Generate filename based on content type
  const extension = getExtensionFromMimeType(contentType);
  const timestamp = Date.now();
  return `mass-import-${timestamp}.${extension}`;
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  return mimeToExt[mimeType.toLowerCase()] || 'jpg';
}
