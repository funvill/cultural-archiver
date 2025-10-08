/**
 * Mass Import API V2 Endpoint
 *
 * Complete rewrite for unified submissions system with CLI plugin integration.
 * Supports importing both artworks and artists with sophisticated deduplication,
 * automatic approval, and seamless integration with the modular plugin architecture.
 *
 * Features:
 * - MassImportRequestV2/ResponseV2 format matching PRD specifications
 * - Configurable duplicate detection with scoring weights
 * - Artist auto-creation and linking with artists table
 * - Intelligent tag merging that preserves original data
 * - Individual transaction processing for fault tolerance
 * - Comprehensive error handling and validation
 * - R2 photo processing pipeline integration
 * - Audit trail and logging for complete traceability
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import {
  createSuccessResponse,
  ValidationApiError,
  ApiError,
  UnauthorizedError,
} from '../lib/errors';
import { processAndUploadPhotos } from '../lib/photos';
import { createDatabaseService } from '../lib/database';
import { createMassImportV2DuplicateDetectionService } from '../lib/mass-import-v2-duplicate-detection';
import { createArtistAutoCreationService } from '../lib/artist-auto-creation';
import { SYSTEM_ADMIN_USER_UUID, generateUUID } from '../../shared/constants';
import type {
  MassImportRequestV2,
  MassImportResponseV2,
  RawImportData,
  ValidationError,
} from '../../shared/mass-import';

// ================================
// Constants and Configuration
// ================================

const MASS_IMPORT_SYSTEM_USER_TOKEN = SYSTEM_ADMIN_USER_UUID;
const MAX_PROCESSING_TIME_MS = 60000; // 1 minute timeout as per PRD
const MAX_BATCH_SIZE = 10; // Maximum records per batch
const DEFAULT_DUPLICATE_THRESHOLD = 0.7;
const DEFAULT_DUPLICATE_WEIGHTS = {
  gps: 0.6,
  title: 0.25,
  artist: 0.2,
  referenceIds: 0.5,
  tagSimilarity: 0.05,
};

// ================================
// Request Validation
// ================================

function validateMassImportRequest(payload: any): MassImportRequestV2 {
  // Basic structure validation
  if (!payload || typeof payload !== 'object') {
    throw new ValidationApiError(
      [
        {
          message: 'Request body must be a valid JSON object',
          field: 'body',
          code: 'INVALID_JSON',
        },
      ],
      'Invalid request format'
    );
  }

  const errors: ValidationError[] = [];

  // Validate metadata
  if (!payload.metadata) {
    errors.push({
      field: 'metadata',
      message: 'Metadata section is required',
      code: 'REQUIRED_FIELD',
    });
  } else {
    if (!payload.metadata.importId) {
      errors.push({
        field: 'metadata.importId',
        message: 'Import ID is required',
        code: 'REQUIRED_FIELD',
      });
    }
    if (!payload.metadata.source?.pluginName) {
      errors.push({
        field: 'metadata.source.pluginName',
        message: 'Plugin name is required',
        code: 'REQUIRED_FIELD',
      });
    }
    if (!payload.metadata.source?.originalDataSource) {
      errors.push({
        field: 'metadata.source.originalDataSource',
        message: 'Original data source is required',
        code: 'REQUIRED_FIELD',
      });
    }
    if (!payload.metadata.timestamp) {
      errors.push({
        field: 'metadata.timestamp',
        message: 'Timestamp is required',
        code: 'REQUIRED_FIELD',
      });
    }
  }

  // Validate config
  if (!payload.config) {
    errors.push({ field: 'config', message: 'Config section is required', code: 'REQUIRED_FIELD' });
  } else {
    if (
      typeof payload.config.duplicateThreshold !== 'number' ||
      payload.config.duplicateThreshold < 0 ||
      payload.config.duplicateThreshold > 1
    ) {
      errors.push({
        field: 'config.duplicateThreshold',
        message: 'Duplicate threshold must be between 0 and 1',
        code: 'INVALID_RANGE',
      });
    }
    if (
      typeof payload.config.batchSize !== 'number' ||
      payload.config.batchSize < 1 ||
      payload.config.batchSize > MAX_BATCH_SIZE
    ) {
      errors.push({
        field: 'config.batchSize',
        message: `Batch size must be between 1 and ${MAX_BATCH_SIZE}`,
        code: 'INVALID_RANGE',
      });
    }
  }

  // Validate data
  if (!payload.data) {
    errors.push({ field: 'data', message: 'Data section is required', code: 'REQUIRED_FIELD' });
  } else {
    const hasArtworks =
      payload.data.artworks &&
      Array.isArray(payload.data.artworks) &&
      payload.data.artworks.length > 0;
    const hasArtists =
      payload.data.artists &&
      Array.isArray(payload.data.artists) &&
      payload.data.artists.length > 0;

    if (!hasArtworks && !hasArtists) {
      errors.push({
        field: 'data',
        message: 'At least one artwork or artist must be provided',
        code: 'EMPTY_DATA',
      });
    }

    // Validate individual records
    if (hasArtworks) {
      payload.data.artworks.forEach((artwork: any, index: number) => {
        validateRawImportData(artwork, `data.artworks[${index}]`, errors);
      });
    }

    if (hasArtists) {
      payload.data.artists.forEach((artist: any, index: number) => {
        validateRawImportData(artist, `data.artists[${index}]`, errors);
      });
    }
  }

  if (errors.length > 0) {
    throw new ValidationApiError(errors, 'Request validation failed');
  }

  return payload as MassImportRequestV2;
}

function validateRawImportData(data: any, fieldPrefix: string, errors: ValidationError[]): void {
  if (!data || typeof data !== 'object') {
    errors.push({ field: fieldPrefix, message: 'Record must be an object', code: 'INVALID_TYPE' });
    return;
  }

  // Required fields
  if (typeof data.lat !== 'number' || data.lat < -90 || data.lat > 90) {
    errors.push({
      field: `${fieldPrefix}.lat`,
      message: 'Latitude must be between -90 and 90',
      code: 'COORDINATES_OUT_OF_RANGE',
    });
  }
  if (typeof data.lon !== 'number' || data.lon < -180 || data.lon > 180) {
    errors.push({
      field: `${fieldPrefix}.lon`,
      message: 'Longitude must be between -180 and 180',
      code: 'COORDINATES_OUT_OF_RANGE',
    });
  }
  if (!data.title || typeof data.title !== 'string' || data.title.length === 0) {
    errors.push({
      field: `${fieldPrefix}.title`,
      message: 'Title is required and must be non-empty',
      code: 'REQUIRED_FIELD',
    });
  }
  if (!data.source || typeof data.source !== 'string' || data.source.length === 0) {
    errors.push({
      field: `${fieldPrefix}.source`,
      message: 'Source is required and must be non-empty',
      code: 'REQUIRED_FIELD',
    });
  }

  // Optional field validation
  if (data.title && data.title.length > 200) {
    errors.push({
      field: `${fieldPrefix}.title`,
      message: 'Title must be 200 characters or less',
      code: 'FIELD_TOO_LONG',
    });
  }
  if (data.description && data.description.length > 10000) {
    errors.push({
      field: `${fieldPrefix}.description`,
      message: 'Description must be 10000 characters or less',
      code: 'FIELD_TOO_LONG',
    });
  }
  if (data.artist && data.artist.length > 500) {
    errors.push({
      field: `${fieldPrefix}.artist`,
      message: 'Artist must be 500 characters or less',
      code: 'FIELD_TOO_LONG',
    });
  }

  // Validate photos array
  if (data.photos && Array.isArray(data.photos)) {
    data.photos.forEach((photo: any, photoIndex: number) => {
      if (!photo || typeof photo !== 'object') {
        errors.push({
          field: `${fieldPrefix}.photos[${photoIndex}]`,
          message: 'Photo must be an object',
          code: 'INVALID_TYPE',
        });
      } else if (!photo.url || typeof photo.url !== 'string') {
        errors.push({
          field: `${fieldPrefix}.photos[${photoIndex}].url`,
          message: 'Photo URL is required',
          code: 'REQUIRED_FIELD',
        });
      } else {
        try {
          new URL(photo.url);
        } catch {
          errors.push({
            field: `${fieldPrefix}.photos[${photoIndex}].url`,
            message: 'Photo URL must be valid',
            code: 'INVALID_URL',
          });
        }
      }
    });
  }
}

// ================================
// Main Endpoint Handler
// ================================

/**
 * POST /api/mass-import - Mass Import V2 endpoint
 */
export async function processMassImportV2(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const startTime = Date.now();

  // Create timeout for entire operation
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, MAX_PROCESSING_TIME_MS);

  try {
    // 1. Parse and validate request
    const payload = await c.req.json();
    const request = validateMassImportRequest(payload);

    console.log(
      `[MASS_IMPORT_V2] Starting import: ${request.metadata.importId}, plugin: ${request.metadata.source.pluginName}`
    );

    // 2. Initialize services
    const db = createDatabaseService(c.env.DB);
    const duplicateService = createMassImportV2DuplicateDetectionService(c.env.DB);
    const artistService = createArtistAutoCreationService(c.env.DB);

    // 3. Initialize response structure
    const response: MassImportResponseV2 = {
      importId: request.metadata.importId,
      summary: {
        totalRequested: 0,
        totalProcessed: 0,
        totalSucceeded: 0,
        totalFailed: 0,
        totalDuplicates: 0,
        processingTimeMs: 0,
      },
      results: {
        artworks: {
          created: [],
          duplicates: [],
          failed: [],
        },
        artists: {
          created: [],
          autoCreated: [],
          duplicates: [],
          failed: [],
        },
      },
      auditTrail: {
        importStarted: new Date().toISOString(),
        importCompleted: '',
        batchesProcessed: 0,
        tagsMerged: 0,
        photosDownloaded: 0,
        photosUploaded: 0,
        systemUserToken: MASS_IMPORT_SYSTEM_USER_TOKEN,
      },
    };

    // 4. Count total requested records
    const artworkCount = request.data.artworks?.length || 0;
    const artistCount = request.data.artists?.length || 0;
    response.summary.totalRequested = artworkCount + artistCount;

    console.log(`[MASS_IMPORT_V2] Processing ${artworkCount} artworks and ${artistCount} artists`);

    // 5. Process artworks if provided
    if (request.data.artworks && request.data.artworks.length > 0) {
      await processArtworkBatch(request.data.artworks, request, response, {
        db,
        duplicateService,
        artistService,
        env: c.env,
      });
      response.auditTrail.batchesProcessed++;
    }

    // 6. Process artists if provided
    if (request.data.artists && request.data.artists.length > 0) {
      await processArtistBatch(request.data.artists, request, response, {
        db,
        duplicateService,
        artistService,
        env: c.env,
      });
      response.auditTrail.batchesProcessed++;
    }

    // 7. Finalize response
    const endTime = Date.now();
    response.summary.processingTimeMs = endTime - startTime;
    response.auditTrail.importCompleted = new Date().toISOString();

    console.log(
      `[MASS_IMPORT_V2] Completed import ${request.metadata.importId}: ${response.summary.totalSucceeded}/${response.summary.totalRequested} successful in ${response.summary.processingTimeMs}ms`
    );

    // Clear timeout
    clearTimeout(timeoutId);

    // Return 201 Created for successful completion (even with some failures)
    return c.json(createSuccessResponse(response), 201);
  } catch (error) {
    clearTimeout(timeoutId);

    console.error('[MASS_IMPORT_V2] Import failed:', error);

    if (error instanceof ValidationApiError || error instanceof UnauthorizedError) {
      throw error;
    }

    // Handle timeout
    if (timeoutController.signal.aborted) {
      throw new ApiError('Import operation timed out', 'IMPORT_TIMEOUT', 408, {
        details: { timeout: MAX_PROCESSING_TIME_MS },
      });
    }

    throw new ApiError('Failed to process mass import', 'MASS_IMPORT_ERROR', 500, {
      details: { originalError: error instanceof Error ? error.message : String(error) },
    });
  }
}

// ================================
// Batch Processing Functions
// ================================

interface ProcessingServices {
  db: ReturnType<typeof createDatabaseService>;
  duplicateService: ReturnType<typeof createMassImportV2DuplicateDetectionService>;
  artistService: ReturnType<typeof createArtistAutoCreationService>;
  env: WorkerEnv;
}

async function processArtworkBatch(
  artworks: RawImportData[],
  request: MassImportRequestV2,
  response: MassImportResponseV2,
  services: ProcessingServices
): Promise<void> {
  console.log(`[MASS_IMPORT_V2] Processing ${artworks.length} artworks`);

  for (let i = 0; i < artworks.length; i++) {
    const artwork = artworks[i];

    if (!artwork) {
      console.error(`[MASS_IMPORT_V2] Artwork at index ${i} is undefined`);
      response.summary.totalFailed++;
      response.summary.totalProcessed++;
      continue;
    }

    try {
      await processIndividualTransaction(async () => {
        await processSingleArtwork(artwork, request, response, services);
        response.summary.totalProcessed++;
      });
    } catch (error) {
      console.error(`[MASS_IMPORT_V2] Failed to process artwork ${i}:`, error);

      response.results.artworks.failed.push({
        title: artwork.title,
        error: error instanceof Error ? error.message : String(error),
      });

      response.summary.totalFailed++;
      response.summary.totalProcessed++;
    }
  }
}

async function processArtistBatch(
  artists: RawImportData[],
  request: MassImportRequestV2,
  response: MassImportResponseV2,
  services: ProcessingServices
): Promise<void> {
  console.log(`[MASS_IMPORT_V2] Processing ${artists.length} artists`);

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];

    if (!artist) {
      console.error(`[MASS_IMPORT_V2] Artist at index ${i} is undefined`);
      response.summary.totalFailed++;
      response.summary.totalProcessed++;
      continue;
    }

    try {
      await processIndividualTransaction(async () => {
        await processSingleArtist(artist, request, response, services);
        response.summary.totalProcessed++;
      });
    } catch (error) {
      console.error(`[MASS_IMPORT_V2] Failed to process artist ${i}:`, error);

      response.results.artists.failed.push({
        name: artist.title, // Using title as name for artists
        error: error instanceof Error ? error.message : String(error),
      });

      response.summary.totalFailed++;
      response.summary.totalProcessed++;
    }
  }
}

async function processSingleArtwork(
  artworkData: RawImportData,
  request: MassImportRequestV2,
  response: MassImportResponseV2,
  services: ProcessingServices
): Promise<void> {
  const { db, duplicateService, artistService, env } = services;

  // 1. Check for duplicates
  const duplicateResult = await duplicateService.checkArtworkDuplicates({
    data: artworkData,
    threshold: request.config.duplicateThreshold || DEFAULT_DUPLICATE_THRESHOLD,
    weights: request.config.duplicateWeights || DEFAULT_DUPLICATE_WEIGHTS,
  });

  if (duplicateResult.isDuplicate && duplicateResult.existingId) {
    console.log(`[MASS_IMPORT_V2] Duplicate artwork detected: ${artworkData.title}`);

    // Merge tags if enabled
    if (request.config.enableTagMerging && artworkData.tags) {
      const mergeResult = await duplicateService.mergeTagsIntoExisting(
        'artwork',
        duplicateResult.existingId,
        artworkData.tags
      );
      response.auditTrail.tagsMerged += mergeResult.newTagsAdded;
    }

    response.results.artworks.duplicates.push({
      title: artworkData.title,
      existingId: duplicateResult.existingId,
      confidenceScore: duplicateResult.confidenceScore!,
      scoreBreakdown: duplicateResult.scoreBreakdown!,
      error: 'DUPLICATE_DETECTED',
    });

    response.summary.totalDuplicates++;
    return;
  }

  // 2. Process photos
  const photoUrls = await processArtworkPhotos(artworkData, env, response);

  // 3. Create artwork record via submissions table
  const artworkId = generateUUID();
  const submissionId = generateUUID();
  const timestamp = new Date().toISOString();

  // Create submission record (artwork_id is NULL for new artwork submissions)
  await db.db
    .prepare(
      `
    INSERT INTO submissions (
      id, submission_type, user_token, artwork_id, lat, lon, notes, photos, tags,
      status, created_at, updated_at
    ) VALUES (?, 'new_artwork', ?, NULL, ?, ?, ?, ?, ?, 'approved', ?, ?)
  `
    )
    .bind(
      submissionId,
      MASS_IMPORT_SYSTEM_USER_TOKEN,
      artworkData.lat,
      artworkData.lon,
      artworkData.description || null,
      JSON.stringify(photoUrls),
      JSON.stringify({
        ...artworkData.tags,
        source: artworkData.source,
        import_batch: request.metadata.importId,
        plugin_name: request.metadata.source.pluginName,
      }),
      timestamp,
      timestamp
    )
    .run();

  // Create artwork record
  await db.db
    .prepare(
      `
    INSERT INTO artwork (
      id, lat, lon, title, description, photos, tags, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?)
  `
    )
    .bind(
      artworkId,
      artworkData.lat,
      artworkData.lon,
      artworkData.title,
      artworkData.description || null,
      JSON.stringify(photoUrls),
      JSON.stringify({
        ...artworkData.tags,
        source: artworkData.source,
        import_batch: request.metadata.importId,
      }),
      timestamp
    )
    .run();

  console.log(`[MASS_IMPORT_V2] Created artwork: ${artworkId} - ${artworkData.title}`);

  // 4. Handle artist auto-creation and linking
  if (request.config.createMissingArtists) {
    try {
      const artistResult = await artistService.processArtworkArtists(artworkId, artworkData, {
        createMissingArtists: true,
        similarityThreshold: 0.95,
        autoLinkArtwork: true,
        systemUserToken: MASS_IMPORT_SYSTEM_USER_TOKEN,
      });

      // Add auto-created artists to response
      for (let i = 0; i < artistResult.newArtistsCreated; i++) {
        response.results.artists.autoCreated.push({
          id: artistResult.linkedArtistIds[i] || '',
          name: artworkData.artist || artworkData.created_by || '',
          reason: 'referenced_in_artwork',
          sourceArtworkId: artworkId,
        });
      }
    } catch (error) {
      console.warn(`[MASS_IMPORT_V2] Artist processing failed for artwork ${artworkId}:`, error);
    }
  }

  response.results.artworks.created.push({
    id: artworkId,
    title: artworkData.title,
    submissionId,
  });

  response.summary.totalSucceeded++;
}

async function processSingleArtist(
  artistData: RawImportData,
  request: MassImportRequestV2,
  response: MassImportResponseV2,
  services: ProcessingServices
): Promise<void> {
  const { db, duplicateService } = services;

  // 1. Check for duplicates
  const duplicateResult = await duplicateService.checkArtistDuplicates({
    name: artistData.title, // Using title as artist name
    description: artistData.description || '', // Provide empty string instead of undefined
    externalId: artistData.externalId || '', // Provide empty string instead of undefined
    threshold: request.config.duplicateThreshold || DEFAULT_DUPLICATE_THRESHOLD,
    weights: request.config.duplicateWeights || DEFAULT_DUPLICATE_WEIGHTS,
  });

  if (duplicateResult.isDuplicate && duplicateResult.existingId) {
    console.log(`[MASS_IMPORT_V2] Duplicate artist detected: ${artistData.title}`);

    // Check if we need to update the biography
    let bioUpdated = false;
    if (artistData.description && artistData.description.trim().length > 0) {
      // Fetch existing artist record
      const existingArtist = await db.db
        .prepare('SELECT description FROM artists WHERE id = ?')
        .bind(duplicateResult.existingId)
        .first<{ description: string | null }>();

      if (existingArtist) {
        const existingDesc = existingArtist.description || '';
        const newDesc = artistData.description.trim();

        // Update if: 
        // 1. Existing description is empty, OR
        // 2. New description has content that isn't already in the existing description
        const shouldUpdate = !existingDesc || !existingDesc.includes(newDesc);

        if (shouldUpdate) {
          // Append new content to existing description with separator
          const updatedDesc = existingDesc
            ? `${existingDesc}\n\n--- Additional Information ---\n\n${newDesc}`
            : newDesc;

          await db.db
            .prepare('UPDATE artists SET description = ?, updated_at = ? WHERE id = ?')
            .bind(updatedDesc, new Date().toISOString(), duplicateResult.existingId)
            .run();

          bioUpdated = true;
          console.log(`[MASS_IMPORT_V2] Updated biography for artist: ${artistData.title}`);
        }
      }
    }

    // Merge tags if enabled
    if (request.config.enableTagMerging && artistData.tags) {
      const mergeResult = await duplicateService.mergeTagsIntoExisting(
        'artist',
        duplicateResult.existingId,
        artistData.tags
      );
      response.auditTrail.tagsMerged += mergeResult.newTagsAdded;
    }

    response.results.artists.duplicates.push({
      name: artistData.title,
      existingId: duplicateResult.existingId,
      confidenceScore: duplicateResult.confidenceScore!,
      error: bioUpdated ? 'DUPLICATE_DETECTED_BIO_UPDATED' : 'DUPLICATE_DETECTED',
    });

    response.summary.totalDuplicates++;
    return;
  }

  // 2. Create artist record
  const artistId = generateUUID();
  const submissionId = generateUUID();
  const timestamp = new Date().toISOString();

  // Determine desired status: honor request-level autoApproveArtists if present
  const desiredArtistStatus = (request.config && (request.config as any).autoApproveArtists)
    ? 'approved'
    : ((artistData.status as string) || 'pending');

  // Create artist record FIRST (to satisfy foreign key constraint)
  await db.db
    .prepare(
      `
    INSERT INTO artists (
      id, name, description, tags, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `
    )
    .bind(
      artistId,
      artistData.title,
      artistData.description || null,
      JSON.stringify({
        ...artistData.tags,
        external_id: artistData.externalId, // Store externalId in tags for duplicate detection
        source: artistData.source,
        import_batch: request.metadata.importId,
      }),
      // Respect explicit status from importer (e.g., 'approved') or default to 'pending'
  desiredArtistStatus,
      timestamp,
      timestamp
    )
    .run();

  // Create submission record AFTER (references artist_id foreign key)
  await db.db
    .prepare(
      `
    INSERT INTO submissions (
      id, submission_type, user_token, artist_id, notes, tags,
      status, created_at, updated_at
    ) VALUES (?, 'new_artist', ?, ?, ?, ?, 'approved', ?, ?)
  `
    )
    .bind(
      submissionId,
      MASS_IMPORT_SYSTEM_USER_TOKEN,
      artistId,
      artistData.description || null,
      JSON.stringify({
        ...artistData.tags,
        source: artistData.source,
        import_batch: request.metadata.importId,
        plugin_name: request.metadata.source.pluginName,
      }),
      timestamp,
      timestamp
    )
    .run();

  console.log(`[MASS_IMPORT_V2] Created artist: ${artistId} - ${artistData.title}`);

  response.results.artists.created.push({
    id: artistId,
    name: artistData.title,
    submissionId,
  });

  response.summary.totalSucceeded++;
}

// ================================
// Helper Functions
// ================================

async function processArtworkPhotos(
  artworkData: RawImportData,
  env: WorkerEnv,
  response: MassImportResponseV2
): Promise<string[]> {
  const processedUrls: string[] = [];

  if (!artworkData.photos || artworkData.photos.length === 0) {
    return processedUrls;
  }

  console.log(`[MASS_IMPORT_V2] Processing ${artworkData.photos.length} photos`);

  for (const photo of artworkData.photos) {
    try {
      // Download photo
      const photoResponse = await fetch(photo.url, {
        headers: { 'User-Agent': 'Cultural-Archiver-Mass-Import-V2/1.0' },
      });

      if (!photoResponse.ok) {
        throw new Error(`HTTP ${photoResponse.status}: ${photoResponse.statusText}`);
      }

      const contentType = photoResponse.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const arrayBuffer = await photoResponse.arrayBuffer();
      const maxSize = 15 * 1024 * 1024; // 15MB
      if (arrayBuffer.byteLength > maxSize) {
        throw new Error(`File too large: ${arrayBuffer.byteLength} bytes`);
      }

      // Create file for processing
      const filename = generateFilename(photo.url, contentType);
      const file = new File([arrayBuffer], filename, { type: contentType });
      const submissionId = `mass-import-v2-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Process through standard pipeline
      const results = await processAndUploadPhotos(env, [file], submissionId, {
        preserveExif: true,
        generateThumbnail: true,
        useCloudflareImages: false,
      });

      if (results.length > 0 && results[0]) {
        processedUrls.push(results[0].originalUrl);
        response.auditTrail.photosDownloaded++;
        response.auditTrail.photosUploaded++;
        console.log(`[MASS_IMPORT_V2] Processed photo: ${results[0].originalUrl}`);
      }
    } catch (error) {
      console.error(`[MASS_IMPORT_V2] Failed to process photo ${photo.url}:`, error);
      // Continue with other photos - don't fail entire import
    }
  }

  return processedUrls;
}

async function processIndividualTransaction<T>(operation: () => Promise<T>): Promise<T> {
  // Each record is processed in its own transaction for fault tolerance
  return await operation();
}

function generateFilename(url: string, contentType: string): string {
  try {
    const urlPath = new URL(url).pathname;
    const urlFilename = urlPath.split('/').pop();

    if (urlFilename && urlFilename.includes('.')) {
      return urlFilename;
    }
  } catch {
    // Invalid URL, generate filename
  }

  const extension = getExtensionFromMimeType(contentType);
  const timestamp = Date.now();
  return `mass-import-v2-${timestamp}.${extension}`;
}

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
