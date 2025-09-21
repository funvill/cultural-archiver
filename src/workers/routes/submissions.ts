/**
 * Submission route handlers for artwork submissions (POST /api/submissions)
 * Handles artwork submissions with photos, location, and metadata
 * 
 * UPDATED: Uses consent-first pattern with centralized consent table
 */

import type { Context } from 'hono';
import type {
  WorkerEnv,
  SubmissionRequest,
  SubmissionResponse,
  FastArtworkSubmissionRequest,
  FastArtworkSubmissionResponse,
  NearbyArtworkInfo,
  CreateSubmissionEntryRequest,
  UnifiedSubmissionRequest,
} from '../types';
import { createDatabaseService, getLogbookCooldownStatus } from '../lib/database';
import { createSubmission as createSubmissionEntry } from '../lib/submissions';
import { createSuccessResponse, ValidationApiError, ApiError } from '../lib/errors';
import { validatePhotoFiles } from '../lib/photos';
import { getUserToken } from '../middleware/auth';
import { getValidatedData, getValidatedFiles } from '../middleware/validation';
import { safeJsonParse } from '../lib/errors';
import { processAndUploadPhotos } from '../lib/photos';
import { CONSENT_VERSION } from '../../shared/consent';
import { createSimilarityService } from '../lib/similarity';
import { DEFAULT_ARTWORK_SEARCH_RADIUS } from '../../shared/geo';
import type { SimilarityQuery } from '../../shared/similarity';

// Import the new consent system
import { recordConsent, generateConsentTextHash } from '../lib/consent-new';

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
 * POST /api/logbook - Create Submission (Updated: Consent-First Pattern)
 * Handles new artwork submissions with photos and metadata
 * 
 * NEW FLOW:
 * 1. Record consent FIRST
 * 2. Create logbook entry only after consent success
 * 3. Process photos
 * 4. Return response with consent audit trail
 */
export async function createSubmission(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  const validatedData = getValidatedData<SubmissionRequest>(c, 'body');
  const validatedFiles = getValidatedFiles(c);

  const db = createDatabaseService(c.env.DB);

  try {
    // STEP 1: Consent-First Pattern - Record consent BEFORE creating content
    
    // Generate a unique content ID for this submission
    const contentId = crypto.randomUUID(); // This will be used for both consent and logbook
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
    
    // Extract consent information from request
    const consentVersion = validatedData.consent_version || CONSENT_VERSION;
    const consentTextHash = await generateConsentTextHash(
      `Cultural Archiver Consent v${consentVersion} - Logbook Submission`
    );
    
    // Determine user identity (authenticated vs anonymous)
    const isAuthenticated = userToken && userToken.length > 36; // Simple heuristic 
    const consentParams = {
      ...(isAuthenticated ? { userId: userToken } : { anonymousToken: userToken }),
      contentType: 'logbook' as const,
      contentId,
      consentVersion,
      ipAddress: clientIP,
      consentTextHash,
      db: c.env.DB,
    };

    console.info('Recording consent for logbook submission:', {
      userToken,
      contentId,
      consentVersion,
      isAuthenticated,
      ipAddress: clientIP,
    });

    // Record consent - this MUST succeed before proceeding
    let consentRecord;
    try {
      consentRecord = await recordConsent(consentParams);
    } catch (error) {
      console.error('Consent recording failed:', error);
      throw new ApiError(
        'Submission blocked: Consent could not be recorded',
        'SUBMISSION_BLOCKED',
        409,
        {
          details: {
            message: 'Your consent is required before submitting content',
            consentVersion: consentVersion,
            error: error instanceof Error ? error.message : 'Unknown consent error',
          },
        }
      );
    }

    console.info('Consent recorded successfully, proceeding with submission:', {
      consentId: consentRecord.id,
      contentId,
    });

    // STEP 2: Check for nearby artworks to show user potential duplicates
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

    // STEP 3: Create submission entry (consent already recorded)
    const submissionEntry: CreateSubmissionEntryRequest = {
      user_token: userToken,
      lat: validatedData.lat,
      lon: validatedData.lon,
      ...(validatedData.notes && { notes: validatedData.notes }),
      photos: [], // Will be updated after processing
      // NOTE: No consent_version field needed - it's now in the consent table
    };

    // Create the submission entry - it will generate its own ID
    const newEntry = await db.createLogbookEntry(submissionEntry);
    
    // Update our consent record to use the actual logbook entry ID
    try {
      await c.env.DB.prepare(`
        UPDATE consent 
        SET content_id = ? 
        WHERE id = ?
      `).bind(newEntry.id, consentRecord.id).run();
      
      console.info('Updated consent record with actual logbook ID:', {
        consentId: consentRecord.id,
        originalContentId: contentId,
        actualLogbookId: newEntry.id,
      });
    } catch (error) {
      console.warn('Failed to update consent record with actual logbook ID:', error);
      // This is not critical - the consent is still valid
    }

    // STEP 4: Process photos if any were uploaded
    let photoUrls: string[] = [];
    if (validatedFiles.length > 0) {
      photoUrls = await processPhotos(c.env, validatedFiles, newEntry.id);

      // Update logbook entry with photo URLs
      await db.updateLogbookPhotos(newEntry.id, photoUrls);
    }

    // STEP 5: Create response 
    const response: SubmissionResponse = {
      id: newEntry.id,
      status: 'pending',
      message: 'Submission received and is pending review',
      ...(nearbyArtworkInfo.length > 0 && { nearby_artworks: nearbyArtworkInfo }),
      // TODO: Add consent audit information to response type
      // consent_id: consentRecord.id,
      // consent_version: consentVersion,
    };

    console.info('Logbook submission completed successfully:', {
      submissionId: newEntry.id,
      consentId: consentRecord.id,
      userToken,
      photoCount: photoUrls.length,
      nearbyArtworks: nearbyArtworkInfo.length,
    });

    return c.json(createSuccessResponse(response), 201);
  } catch (error) {
    console.error('Failed to create logbook submission:', error);
    
    // Return appropriate error based on type
    if (error instanceof ApiError) {
      throw error; // Re-throw API errors (including SUBMISSION_BLOCKED)
    }
    
    throw new ApiError(
      'Failed to create submission',
      'SUBMISSION_FAILED',
      500,
      {
        details: {
          message: 'An error occurred while processing your submission',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    );
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
      SELECT COUNT(*) as count FROM submissions 
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
      FROM submissions 
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
    // STEP 1: Consent-First Pattern - Record consent BEFORE creating content
    
    // Generate a unique content ID for this submission
    const contentId = crypto.randomUUID(); // This will be used for both consent and logbook
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
    
    // Extract consent information from request
    const consentVersion = validatedData.consent_version || CONSENT_VERSION;
    const consentTextHash = await generateConsentTextHash(
      `Cultural Archiver Consent v${consentVersion} - Fast Artwork Submission`
    );
    
    // Determine user identity (authenticated vs anonymous)
    const isAuthenticated = userToken && userToken.length > 36; // Simple heuristic 
    const consentParams = {
      ...(isAuthenticated ? { userId: userToken } : { anonymousToken: userToken }),
      contentType: 'logbook' as const,
      contentId,
      consentVersion,
      ipAddress: clientIP,
      consentTextHash,
      db: c.env.DB,
    };

    console.info('Recording consent for fast artwork submission:', {
      userToken,
      contentId,
      consentVersion,
      isAuthenticated,
      ipAddress: clientIP,
    });

    // Record consent - this MUST succeed before proceeding
    let consentRecord;
    try {
      consentRecord = await recordConsent(consentParams);
    } catch (error) {
      console.error('Consent recording failed:', error);
      throw new ApiError(
        'Submission blocked: Consent could not be recorded',
        'SUBMISSION_BLOCKED',
        409,
        {
          details: {
            message: 'Your consent is required before submitting content',
            consentVersion: consentVersion,
            error: error instanceof Error ? error.message : 'Unknown consent error',
          },
        }
      );
    }

    console.info('Consent recorded successfully, proceeding with submission:', {
      consentId: consentRecord.id,
      contentId,
    });

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
      // Build structured submission data for approval process
      const submissionData = {
        _submission: {
          lat: validatedData.lat,
          lon: validatedData.lon,
          type_name: (validatedData.tags?.artwork_type as string) || 'unknown',
          tags: {
            ...(validatedData.tags || {}),
            // Include title in tags for approval extraction  
            ...(validatedData.title && { title: validatedData.title }),
          },
        },
        notes: validatedData.notes || 'Fast photo-first submission',
      };

      // Create new artwork submission (submission entry without artwork_id)
      const submissionEntry: CreateSubmissionEntryRequest = {
        user_token: userToken,
        lat: validatedData.lat,
        lon: validatedData.lon,
        notes: JSON.stringify(submissionData),
        photos: [], // Will be updated after processing
      };

      const newEntry = await db.createLogbookEntry(submissionEntry);
      
      // Update our consent record to use the actual logbook entry ID
      try {
        await c.env.DB.prepare(`
          UPDATE consent 
          SET content_id = ? 
          WHERE id = ?
        `).bind(newEntry.id, consentRecord.id).run();
        
        console.info('Updated consent record with actual logbook ID:', {
          consentId: consentRecord.id,
          originalContentId: contentId,
          actualLogbookId: newEntry.id,
        });
      } catch (error) {
        console.warn('Failed to update consent record with actual logbook ID:', error);
        // This is not critical - the consent is still valid
      }
      
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
      
      const submissionEntry: CreateSubmissionEntryRequest = {
        artwork_id: validatedData.existing_artwork_id,
        user_token: userToken,
        lat: validatedData.lat,
        lon: validatedData.lon,
        ...(validatedData.notes && { notes: validatedData.notes }),
        photos: [], // Will be updated after processing
      };

      const newEntry = await db.createLogbookEntry(submissionEntry);
      
      // Update our consent record to use the actual logbook entry ID
      try {
        await c.env.DB.prepare(`
          UPDATE consent 
          SET content_id = ? 
          WHERE id = ?
        `).bind(newEntry.id, consentRecord.id).run();
        
        console.info('Updated consent record with actual logbook ID:', {
          consentId: consentRecord.id,
          originalContentId: contentId,
          actualLogbookId: newEntry.id,
        });
      } catch (error) {
        console.warn('Failed to update consent record with actual logbook ID:', error);
        // This is not critical - the consent is still valid
      }
      
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

/**
 * POST /api/submissions - Unified Submission Handler
 * Handles different types of submissions based on submissionType field
 */
export async function createUnifiedSubmission(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  const validatedData = getValidatedData<UnifiedSubmissionRequest>(c, 'body');
  const validatedFiles = getValidatedFiles(c);

  try {
    // Route to appropriate handler based on submission type
    switch (validatedData.submissionType) {
      case 'logbook':
        return await handleLogbookSubmission(c, userToken, validatedData, validatedFiles);
      case 'new_artwork':
        // TODO: Implement new artwork submission
        throw new ApiError('New artwork submissions not yet implemented', 'NOT_IMPLEMENTED', 501);
      case 'artwork_edit':
        // TODO: Implement artwork edit submission
        throw new ApiError('Artwork edit submissions not yet implemented', 'NOT_IMPLEMENTED', 501);
      default:
        throw new ValidationApiError(
          [{ field: 'submissionType', message: 'Invalid submission type', code: 'INVALID_TYPE' }],
          'Invalid submission type'
        );
    }
  } catch (error) {
    if (error instanceof ApiError || error instanceof ValidationApiError) {
      throw error;
    }
    
    console.error('Unified submission handler error:', error);
    throw new ApiError(
      'Submission processing failed',
      'SUBMISSION_FAILED',
      500
    );
  }
}

/**
 * Handle logbook submission (user visit documentation)
 */
async function handleLogbookSubmission(
  c: Context<{ Bindings: WorkerEnv }>,
  userToken: string,
  data: UnifiedSubmissionRequest,
  files: File[]
): Promise<Response> {
  // Validation: artworkId is required for logbook submissions
  if (!data.artworkId) {
    throw new ValidationApiError(
      [{ field: 'artworkId', message: 'Artwork ID is required for logbook submissions', code: 'REQUIRED' }],
      'Missing required field: artworkId'
    );
  }

  // Validation: at least one photo is required
  if (!files || files.length === 0) {
    throw new ValidationApiError(
      [{ field: 'photos', message: 'At least one photo is required for logbook submissions', code: 'REQUIRED' }],
      'Photo is required for logbook entries'
    );
  }

  // Check 30-day cooldown (skip in development if disabled)
  const cooldownEnabled = c.env.LOGBOOK_COOLDOWN_ENABLED !== 'false';
  if (cooldownEnabled) {
    const cooldownStatus = await getLogbookCooldownStatus(c.env.DB, data.artworkId, userToken);
    if (cooldownStatus.onCooldown) {
      const cooldownDate = cooldownStatus.cooldownUntil ? new Date(cooldownStatus.cooldownUntil) : null;
      const dateStr = cooldownDate ? cooldownDate.toLocaleDateString() : 'a later date';
      
      throw new ApiError(
        `You can only submit one logbook entry per artwork every 30 days. Please try again after ${dateStr}.`,
        'COOLDOWN_ACTIVE',
        429,
        {
          details: {
            cooldownUntil: cooldownStatus.cooldownUntil,
            retryAfter: cooldownDate ? Math.ceil((cooldownDate.getTime() - Date.now()) / 1000) : 86400
          }
        }
      );
    }
  }

  // Verify artwork exists
  const db = createDatabaseService(c.env.DB);
  const artwork = await db.getArtworkWithDetails(data.artworkId);
  if (!artwork) {
    throw new ValidationApiError(
      [{ field: 'artworkId', message: 'Artwork not found', code: 'NOT_FOUND' }],
      'Artwork not found'
    );
  }

  try {
    // Generate content ID for consent and submission
    const contentId = crypto.randomUUID();
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
    
    // Record consent
    const consentVersion = data.consent_version || CONSENT_VERSION;
    const consentTextHash = await generateConsentTextHash(
      `Cultural Archiver Consent v${consentVersion} - Logbook Submission`
    );
    
    const isAuthenticated = userToken && userToken.length > 36;
    const consentParams = {
      ...(isAuthenticated ? { userId: userToken } : { anonymousToken: userToken }),
      contentType: 'logbook' as const,
      contentId,
      consentVersion,
      ipAddress: clientIP,
      consentTextHash,
      db: c.env.DB,
    };

    await recordConsent(consentParams);

    // Process photos
    const photoUrls = await processPhotos(c.env, files, contentId);
    
    // Check EXIF location if available and flag mismatch
    let locationMismatch = false;
    try {
      // TODO: Extract EXIF location from photos and check distance
      // For now, use provided coordinates vs artwork coordinates
      if (data.lat && data.lon) {
        const distance = calculateDistance(
          data.lat, data.lon,
          artwork.lat, artwork.lon
        );
        locationMismatch = distance > 1000; // > 1km
      }
    } catch (error) {
      console.warn('Failed to check EXIF location:', error);
    }

    // Build notes from condition and other responses
    const notes = [];
    if (data.condition) {
      notes.push(`Condition: ${data.condition}`);
    }
    if (data.notes) {
      notes.push(data.notes);
    }

    // Create submission record
    const submissionId = await createSubmissionEntry(c.env.DB, {
      submissionType: 'logbook_entry',
      userToken,
      artworkId: data.artworkId,
      lat: data.lat,
      lon: data.lon,
      notes: notes.join('; '),
      photos: photoUrls,
      ...(locationMismatch && { tags: { location_mismatch: 'true' } }),
      verificationStatus: 'pending',
    });

    // Create response
    const response: SubmissionResponse = {
      id: submissionId,
      status: 'pending',
      message: 'Submission received for review.',
      nearby_artworks: [], // Not applicable for logbook submissions
    };

    return c.json(createSuccessResponse(response), 201);

  } catch (error) {
    console.error('Logbook submission failed:', error);
    
    if (error instanceof ApiError || error instanceof ValidationApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to process logbook submission',
      'LOGBOOK_SUBMISSION_FAILED',
      500
    );
  }
}

/**
 * Calculate distance between two points in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}
