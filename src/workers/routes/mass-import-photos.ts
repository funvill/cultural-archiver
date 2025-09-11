/**
 * Mass Import Submission Routes
 * 
 * Handles complete mass import submissions including photo downloading,
 * processing, and logbook entry creation in a single operation.
 * This endpoint is specifically designed for mass import operations.
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { createSuccessResponse, ValidationApiError, ApiError } from '../lib/errors';
import { processAndUploadPhotos } from '../lib/photos';
import { createDatabaseService } from '../lib/database';
import type { CreateLogbookEntryRequest } from '../types';
import { CONSENT_VERSION } from '../../shared/consent';

/**
 * Mass import submission payload interface
 */
interface MassImportSubmissionPayload {
  user_token: string;
  lat: number;
  lon: number;
  title?: string; // Artwork title
  note?: string;
  photo_urls?: string[]; // URLs to download and process
  consent_version?: string;
  tags?: Record<string, string | number | boolean>;
}

/**
 * POST /api/mass-import/submit - Complete mass import submission
 * 
 * This endpoint handles the complete mass import workflow:
 * 1. Downloads photos from provided URLs
 * 2. Processes them through the photo pipeline
 * 3. Creates logbook entry with processed photos
 * 4. Returns submission details for tracking
 */
export async function processMassImportPhotos(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  try {
    // Parse JSON payload
    const payload = await c.req.json() as MassImportSubmissionPayload;

    // Validate required fields
    if (!payload.user_token) {
      throw new ValidationApiError(
        [{ message: 'User token is required', field: 'user_token', code: 'REQUIRED_FIELD' }],
        'Missing required user token'
      );
    }

    if (typeof payload.lat !== 'number' || typeof payload.lon !== 'number') {
      throw new ValidationApiError(
        [{ message: 'Valid latitude and longitude are required', field: 'coordinates', code: 'INVALID_COORDINATES' }],
        'Invalid coordinates provided'
      );
    }

    // Validate coordinates range
    if (payload.lat < -90 || payload.lat > 90 || payload.lon < -180 || payload.lon > 180) {
      throw new ValidationApiError(
        [{ message: 'Coordinates must be valid lat/lon values', field: 'coordinates', code: 'COORDINATES_OUT_OF_RANGE' }],
        'Coordinates out of valid range'
      );
    }

    let processedPhotoUrls: string[] = [];

    // Process photos if provided
    if (payload.photo_urls && payload.photo_urls.length > 0) {
      console.log(`[MASS_IMPORT] Processing ${payload.photo_urls.length} photos for mass import`);
      
      // Download and process each photo
      for (const photoUrl of payload.photo_urls) {
        try {
          console.log(`[MASS_IMPORT] Downloading photo: ${photoUrl}`);
          
          // Download the photo
          const response = await fetch(photoUrl, {
            headers: {
              'User-Agent': 'Cultural-Archiver-Mass-Import/1.0',
            },
          });

          if (!response.ok) {
            console.warn(`[MASS_IMPORT] Failed to download photo ${photoUrl}: ${response.status} ${response.statusText}`);
            continue; // Skip this photo but continue with others
          }

          // Check content type
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.startsWith('image/')) {
            console.warn(`[MASS_IMPORT] Invalid content type for ${photoUrl}: ${contentType}`);
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
          const filename = generateFilenameFromUrl(photoUrl, contentType);
          const blob = new Blob([arrayBuffer], { type: contentType });
          const file = new File([blob], filename, { type: contentType });

          // Generate submission ID for photo processing
          const submissionId = `mass-import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

          // Process photo through the standard pipeline
          const results = await processAndUploadPhotos(c.env, [file], submissionId, {
            preserveExif: true,
            generateThumbnail: false, // Skip thumbnails for mass import to speed up processing
            useCloudflareImages: false, // Use R2 directly for consistency
          });

          if (results.length > 0 && results[0]) {
            processedPhotoUrls.push(results[0].originalUrl);
            console.log(`[MASS_IMPORT] Successfully processed photo: ${results[0].originalUrl}`);
          }

        } catch (error) {
          console.error(`[MASS_IMPORT] Failed to process photo ${photoUrl}:`, error);
          // Continue with other photos
        }
      }

      console.log(`[MASS_IMPORT] Successfully processed ${processedPhotoUrls.length}/${payload.photo_urls.length} photos`);
    }

    // Create logbook entry with proper title and content structure
    let initialNote = '';
    
    // Include title if provided - use markdown heading for proper parsing
    if (payload.title) {
      initialNote = `# ${payload.title}\n\n`;
    }
    
    // Add description/note content
    if (payload.note) {
      initialNote += payload.note;
    }

    const logbookEntry: CreateLogbookEntryRequest = {
      user_token: payload.user_token,
      lat: payload.lat,
      lon: payload.lon,
      note: initialNote,
      photos: processedPhotoUrls,
      consent_version: payload.consent_version || CONSENT_VERSION,
    };

    console.log(`[MASS_IMPORT] Creating logbook entry with ${processedPhotoUrls.length} photos and title: ${payload.title || 'No title'}`);
    const db = createDatabaseService(c.env.DB);
    const newEntry = await db.createLogbookEntry(logbookEntry);

    // If tags are provided, store them as part of the note for moderation
    let enhancedNote = initialNote;
    if (payload.tags && Object.keys(payload.tags).length > 0) {
      const tagsSection = '\n\n## Import Tags\n' + 
        Object.entries(payload.tags)
          .map(([key, value]) => `- **${key}**: ${value}`)
          .join('\n');
      enhancedNote = enhancedNote + tagsSection;
      
      // Update the logbook entry with enhanced note
      await c.env.DB.prepare(`
        UPDATE logbook 
        SET note = ? 
        WHERE id = ?
      `).bind(enhancedNote, newEntry.id).run();
    }

    // Return successful response
    const response = {
      id: newEntry.id,
      status: 'pending',
      message: 'Mass import submission created successfully',
      photos_processed: processedPhotoUrls.length,
      photos_failed: (payload.photo_urls?.length || 0) - processedPhotoUrls.length,
      coordinates: {
        lat: payload.lat,
        lon: payload.lon,
      },
    };

    console.log(`[MASS_IMPORT] Successfully created submission ${newEntry.id} with ${processedPhotoUrls.length} photos`);
    return c.json(createSuccessResponse(response), 201);

  } catch (error) {
    console.error('[MASS_IMPORT] Mass import submission error:', error);

    if (error instanceof ValidationApiError) {
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
