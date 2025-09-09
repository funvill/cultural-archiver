/**
 * Submission route handlers for logbook entries (POST /api/logbook)
 * Handles artwork submissions with photos, location, and metadata
 */

import type { Context } from 'hono';
import type {
  WorkerEnv,
  LogbookSubmissionRequest,
  LogbookSubmissionResponse,
  FastArtworkSubmissionRequest,
  FastArtworkSubmissionResponse,
  NearbyArtworkInfo,
  CreateLogbookEntryRequest,
} from '../types';
import { createDatabaseService } from '../lib/database';
import { createSuccessResponse, ValidationApiError } from '../lib/errors';
import { validatePhotoFiles } from '../lib/photos';
import { getUserToken } from '../middleware/auth';
import { getValidatedData, getValidatedFiles } from '../middleware/validation';
import { safeJsonParse } from '../lib/errors';
import { processAndUploadPhotos } from '../lib/photos';
import { CONSENT_VERSION } from '../../shared/consent';
import { createSimilarityService } from '../lib/similarity';
import { DEFAULT_ARTWORK_SEARCH_RADIUS } from '../../shared/geo';
import type { SimilarityQuery } from '../../shared/similarity';

// Interfaces for database results
interface DuplicateCheckResult {
  count: number;
}

interface UserStatsResult {
  total_submissions: number;
  approved_submissions: number;
  pending_submissions: number;
  last_submission_at: string | null;
}

/**
 * POST /api/logbook - Create Submission
 * Handles new artwork submissions with photos and metadata
 */
export async function createLogbookSubmission(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  const validatedData = getValidatedData<LogbookSubmissionRequest>(c, 'body');
  const validatedFiles = getValidatedFiles(c);

  const db = createDatabaseService(c.env.DB);

  try {
    // Check for nearby artworks to show user potential duplicates
    const nearbyArtworks = await db.findNearbyArtworks(
      validatedData.lat,
      validatedData.lon,
      500, // 500m radius for duplicate detection
      5 // Limit to 5 nearby artworks
    );

    // Convert nearby artworks to the expected format
    const nearbyArtworkInfo: NearbyArtworkInfo[] = nearbyArtworks.map(artwork => ({
      id: artwork.id,
      lat: artwork.lat,
      lon: artwork.lon,
      type_name: artwork.type_name,
      distance_meters: Math.round(artwork.distance_km * 1000),
      photos: safeJsonParse<string[]>(artwork.tags, []), // For now, photos are in tags - this will be improved
    }));

    // Create logbook entry first (with location and without photos)
    const logbookEntry: CreateLogbookEntryRequest = {
      user_token: userToken,
      lat: validatedData.lat,
      lon: validatedData.lon,
      ...(validatedData.note && { note: validatedData.note }),
      photos: [], // Will be updated after processing
      consent_version: validatedData.consent_version || CONSENT_VERSION, // Use provided version or current
    };

    const newEntry = await db.createLogbookEntry(logbookEntry);

    // Process photos if any were uploaded
    let photoUrls: string[] = [];
    if (validatedFiles.length > 0) {
      photoUrls = await processPhotos(c.env, validatedFiles, newEntry.id);

      // Update logbook entry with photo URLs
      await db.updateLogbookPhotos(newEntry.id, photoUrls);
    }

    // Create response
    const response: LogbookSubmissionResponse = {
      id: newEntry.id,
      status: 'pending',
      message: 'Submission received and is pending review',
      ...(nearbyArtworkInfo.length > 0 && { nearby_artworks: nearbyArtworkInfo }),
    };

    return c.json(createSuccessResponse(response), 201);
  } catch (error) {
    console.error('Failed to create logbook submission:', error);
    throw error;
  }
}

/**
 * Process uploaded photos using the photo processing pipeline
 * Returns array of photo URLs
 */
async function processPhotos(
  env: WorkerEnv,
  files: File[],
  submissionId: string
): Promise<string[]> {
  try {
    // Validate files first
    const validation = validatePhotoFiles(files);
    if (!validation.isValid) {
      throw new ValidationApiError(
        validation.errors.map((msg: string) => ({
          message: msg,
          field: 'photos',
          code: 'VALIDATION_ERROR',
        })),
        'Photo validation failed'
      );
    }

    // Process and upload photos
    const results = await processAndUploadPhotos(env, validation.validFiles, submissionId, {
      preserveExif: true,
    });

    // Return the URLs
    return results.map(result => result.originalUrl);
  } catch (error) {
    console.error('Photo processing error:', error);

    if (error instanceof ValidationApiError) {
      throw error;
    }

    throw new ValidationApiError(
      [
        {
          message: error instanceof Error ? error.message : 'Unknown photo processing error',
          field: 'photos',
          code: 'PROCESSING_ERROR',
        },
      ],
      'Failed to process uploaded photos'
    );
  }
}

/**
 * Get file extension from MIME type
 */

/**
 * Check for duplicate submissions within a time window
 * Prevents rapid-fire duplicate submissions
 */
export async function checkDuplicateSubmission(
  db: D1Database,
  userToken: string,
  lat: number,
  lon: number,
  timeWindowMinutes: number = 15
): Promise<boolean> {
  const timeWindowMs = timeWindowMinutes * 60 * 1000;
  const cutoffTime = new Date(Date.now() - timeWindowMs).toISOString();

  try {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM logbook 
      WHERE user_token = ? 
        AND created_at > ?
        AND ABS(49.2827 - ?) < 0.001 -- Rough coordinate check within ~100m
        AND ABS(-123.1207 - ?) < 0.001
    `);

    const result = await stmt.bind(userToken, cutoffTime, lat, lon).first();
    return result ? (result as unknown as DuplicateCheckResult).count > 0 : false;
  } catch (error) {
    console.warn('Failed to check duplicate submission:', error);
    return false; // Allow submission if check fails
  }
}

/**
 * Validate submission coordinates are reasonable
 * Rejects obviously invalid coordinates
 */
export function validateSubmissionCoordinates(lat: number, lon: number): void {
  // Basic validation already done by middleware, but add additional checks
  if (lat === 0 && lon === 0) {
    throw new ValidationApiError([
      {
        field: 'coordinates',
        message: 'Coordinates appear to be null island (0,0)',
        code: 'INVALID_COORDINATES',
      },
    ]);
  }

  // Check if coordinates are in ocean (very basic check)
  // This is a simplified check - in production you might use a more sophisticated service
  const isLikelyLand = Math.abs(lat) > 0.1 || Math.abs(lon) > 0.1;
  if (!isLikelyLand) {
    console.warn(`Suspicious coordinates submitted: ${lat}, ${lon}`);
    // Don't reject - just log for review
  }
}

/**
 * Get submission statistics for a user
 * Used for rate limiting and user feedback
 */
export async function getUserSubmissionStats(
  db: D1Database,
  userToken: string
): Promise<{
  total_submissions: number;
  approved_submissions: number;
  pending_submissions: number;
  last_submission_at: string | null;
}> {
  try {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_submissions,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_submissions,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_submissions,
        MAX(created_at) as last_submission_at
      FROM logbook 
      WHERE user_token = ? AND status != 'rejected'
    `);

    const result = await stmt.bind(userToken).first();
    return result
      ? (result as unknown as UserStatsResult)
      : {
          total_submissions: 0,
          approved_submissions: 0,
          pending_submissions: 0,
          last_submission_at: null,
        };
  } catch (error) {
    console.error('Failed to get user submission stats:', error);
    return {
      total_submissions: 0,
      approved_submissions: 0,
      pending_submissions: 0,
      last_submission_at: null,
    };
  }
}

/**
 * POST /api/artworks/fast - Fast Photo-First Artwork Submission
 * Handles new artwork creation OR logbook entry submission with similarity checking
 */
export async function createFastArtworkSubmission(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  const validatedData = getValidatedData<FastArtworkSubmissionRequest>(c, 'body');
  const validatedFiles = getValidatedFiles(c);

  const db = createDatabaseService(c.env.DB);
  const photoDebug = c.env.PHOTO_DEBUG === '1' || c.env.PHOTO_DEBUG === 'true';
  const dbg = (...args: unknown[]): void => { if (photoDebug) console.info('[PHOTO][FAST]', ...args); };

  dbg('Incoming fast submission', {
    userToken: userToken.slice(0, 8) + '…',
    hasExistingArtwork: !!validatedData.existing_artwork_id,
    lat: validatedData.lat,
    lon: validatedData.lon,
    title: validatedData.title,
    tagKeys: validatedData.tags ? Object.keys(validatedData.tags) : [],
  fileCount: validatedFiles.length,
  fileMeta: validatedFiles.map((f, i) => ({ i, name: f.name, type: f.type, size: f.size })),
  });

  try {
    // Validate consent version is provided and current
    if (!validatedData.consent_version) {
      throw new ValidationApiError([
        {
          field: 'consent_version',
          message: 'Consent version is required for submissions',
          code: 'CONSENT_REQUIRED',
        },
      ]);
    }

    if (validatedData.consent_version !== CONSENT_VERSION) {
      throw new ValidationApiError([
        {
          field: 'consent_version',
          message: `Consent version ${validatedData.consent_version} is outdated. Current version: ${CONSENT_VERSION}`,
          code: 'CONSENT_OUTDATED',
        },
      ]);
    }

    // Check for potential duplicates using similarity service
    let similarityWarnings: Array<{
      artwork_id: string;
      similarity_score: number;
      similarity_explanation: string;
    }> = [];

  if (validatedData.title) {
      try {
        const similarityService = createSimilarityService({ includeMetadata: false });
    dbg('Running similarity pre-check');
        const nearbyArtworks = await db.findNearbyArtworks(
          validatedData.lat,
          validatedData.lon,
          DEFAULT_ARTWORK_SEARCH_RADIUS,
          10 // Check up to 10 candidates
        );
    dbg('Similarity candidates fetched', { count: nearbyArtworks.length });

        if (nearbyArtworks.length > 0) {
          const query: SimilarityQuery = {
            coordinates: { lat: validatedData.lat, lon: validatedData.lon },
            title: validatedData.title,
            ...(validatedData.tags && { tags: Object.values(validatedData.tags).map(String) }),
          };

          const similarityCandidates = nearbyArtworks.map(artwork => ({
            id: artwork.id,
            coordinates: { lat: artwork.lat, lon: artwork.lon },
            // artwork comes from findNearbyArtworks which returns ArtworkRecord with title + tags possibly
            title: (artwork as unknown as { title?: string | null }).title ?? null,
            tags: (artwork as unknown as { tags?: string | null }).tags ?? null,
            type_name: artwork.type_name,
            distance_meters: Math.round(artwork.distance_km * 1000),
          }));

          const duplicateCheck = similarityService.checkForDuplicates(query, similarityCandidates);
          dbg('Similarity duplicate check', {
            highSimilarity: duplicateCheck.highSimilarityMatches.length,
            warningSimilarity: duplicateCheck.warningSimilarityMatches.length,
          });
          
          // Extract high similarity warnings
          if (duplicateCheck.highSimilarityMatches.length > 0) {
            const allResults = similarityService.calculateSimilarityScores(query, similarityCandidates);
            similarityWarnings = duplicateCheck.highSimilarityMatches.map(match => {
              const result = allResults.find(r => r.artworkId === match.artworkId);
              return {
                artwork_id: match.artworkId,
                similarity_score: result?.overallScore ?? 0,
                similarity_explanation: result ? getSimilarityExplanation(result) : 'High similarity detected',
              };
            });
          }
        }
      } catch (error) {
        console.warn('Similarity check failed during submission:', error);
        // Continue without similarity warnings
      }
    }

    // Determine if this is a new artwork or logbook entry
    const isNewArtwork = !validatedData.existing_artwork_id;
    let submissionId: string;
    let artworkId: string | undefined;
    let submissionType: 'new_artwork' | 'logbook_entry';

    if (isNewArtwork) {
      // Build a default note if neither explicit note nor title supplied
      const autoNoteParts: string[] = [];
      if (validatedData.title) autoNoteParts.push(`Title: ${validatedData.title}`);
      if (validatedData.tags) autoNoteParts.push(`Tags: ${JSON.stringify(validatedData.tags)}`);
      const generatedNote = autoNoteParts.join('\n') || 'New photo submission';
      const finalNote = validatedData.note || generatedNote;
      // Create new artwork submission (logbook entry without artwork_id)
      const logbookEntry: CreateLogbookEntryRequest = {
        user_token: userToken,
        lat: validatedData.lat,
        lon: validatedData.lon,
        note: finalNote,
        photos: [], // Will be updated after processing
        consent_version: validatedData.consent_version,
      };

  const newEntry = await db.createLogbookEntry(logbookEntry);
  dbg('Created new artwork logbook entry (pending)', { submissionId: newEntry.id });
      submissionId = newEntry.id;
      submissionType = 'new_artwork';
    } else {
      // Create logbook entry for existing artwork
      if (!validatedData.existing_artwork_id) {
        throw new ValidationApiError([{
          field: 'existing_artwork_id',
          message: 'existing_artwork_id is required for logbook entries',
          code: 'REQUIRED'
        }]);
      }
      
      const logbookEntry: CreateLogbookEntryRequest = {
        artwork_id: validatedData.existing_artwork_id,
        user_token: userToken,
        lat: validatedData.lat,
        lon: validatedData.lon,
        ...(validatedData.note && { note: validatedData.note }),
        photos: [], // Will be updated after processing
        consent_version: validatedData.consent_version,
      };

  const newEntry = await db.createLogbookEntry(logbookEntry);
  dbg('Created logbook entry for existing artwork', { submissionId: newEntry.id, artworkId: validatedData.existing_artwork_id });
      submissionId = newEntry.id;
      artworkId = validatedData.existing_artwork_id;
      submissionType = 'logbook_entry';
    }

    // Process photos if any were uploaded
    let photoUrls: string[] = [];
    if (validatedFiles.length > 0) {
      const start = Date.now();
      dbg('Beginning photo processing', { submissionId, fileCount: validatedFiles.length });
      photoUrls = await processPhotos(c.env, validatedFiles, submissionId);
      dbg('Photo processing complete', { submissionId, processed: photoUrls.length, ms: Date.now() - start, urls: photoUrls });
      // Update logbook entry with photo URLs
      await db.updateLogbookPhotos(submissionId, photoUrls);
      dbg('Updated logbook entry with photos', { submissionId, photoCount: photoUrls.length });
    } else {
      dbg('No photos uploaded with submission');
    }

    // Create response
    const response: FastArtworkSubmissionResponse = {
      id: submissionId,
      submission_type: submissionType,
      status: 'pending',
      message: isNewArtwork
        ? 'New artwork submission received and is pending review'
        : 'Logbook entry submitted and is pending review',
      ...(artworkId && { artwork_id: artworkId }),
      ...(similarityWarnings.length > 0 && { similarity_warnings: similarityWarnings }),
    };

  dbg('Submission response ready', { submissionId, submissionType, photos: photoUrls.length });
  return c.json(createSuccessResponse(response), 201);
  } catch (error) {
    console.error('Failed to create fast artwork submission:', error);
  dbg('Submission failed', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Helper function to generate similarity explanations for submissions
 */
interface SimilaritySignalMeta { distanceMeters?: number }
interface SimilaritySignal { type: string; rawScore: number; metadata?: SimilaritySignalMeta }
function getSimilarityExplanation(result: { 
  overallScore: number; 
  signals: Array<SimilaritySignal> 
}): string {
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
