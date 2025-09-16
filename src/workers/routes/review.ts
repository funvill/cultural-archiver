/**
 * Review and moderation route handlers
 *
 * Provides endpoints for reviewers to approve, reject, and manage
 * user submissions with proper permission checking and audit logging.
 */

import type { Context } from 'hono';
import type { WorkerEnv, AuthContext, ArtworkRecord, LogbookRecord } from '../types';
import type { D1Database } from '@cloudflare/workers-types';
import {
  insertArtwork,
  updateLogbookStatus,
  updateLogbookPhotos,
  findNearbyArtworks,
  findLogbookById,
  findArtworkById,
  updateArtworkPhotos,
  getPhotosFromArtwork,
} from '../lib/database';
import { movePhotosToArtwork, cleanupRejectedPhotos, generatePhotoUrl, extractR2KeyFromRef } from '../lib/photos';
import { calculateDistance } from '../lib/spatial';
import { 
  getSubmissionsByStatus,
  getSubmission,
  approveSubmission as approveSubmissionInDb,
  rejectSubmission as rejectSubmissionInDb
} from '../lib/submissions';
import type { ArtworkEditReviewData, SubmissionRecord, ArtworkEditDiff } from '../../shared/types';

// Interfaces for database results
interface SubmissionRow {
  id: string;
  artwork_id: string | null;
  user_token: string;
  lat: number | null;
  lon: number | null;
  notes: string | null;
  photos: string | null;
  created_at: string;
  status: string;
  total_count: number;
}

interface StatusRow {
  status: string;
  count: number;
}

interface ParsedSubmissionData extends LogbookRecord {
  total_count: number;
  lat: number;
  lon: number;
  tags: string;
  artwork_type_name?: string;
}
import { ApiError } from '../lib/errors';

// ================================
// Adapter Functions for Artwork Edit Review
// ================================

/**
 * Convert SubmissionRecord (artwork_edit type) to ArtworkEditReviewData format
 * for backward compatibility with existing review UI
 */
function convertSubmissionToArtworkEditReview(submission: SubmissionRecord): ArtworkEditReviewData {
  // Parse the field_changes to create diffs
  const fieldChanges = submission.field_changes ? JSON.parse(submission.field_changes) : {};
  
  const diffs: ArtworkEditDiff[] = [];
  
  // Create diffs for all fields that have changed
  for (const [fieldName, change] of Object.entries(fieldChanges)) {
    const changeObj = change as { old: unknown; new: unknown };
    diffs.push({
      field_name: fieldName,
      old_value: typeof changeObj.old === 'string' ? changeObj.old : JSON.stringify(changeObj.old),
      new_value: typeof changeObj.new === 'string' ? changeObj.new : JSON.stringify(changeObj.new)
    });
  }
  
  return {
    edit_ids: [submission.id], // Single submission ID instead of multiple edit IDs
    artwork_id: submission.artwork_id!,
    user_token: submission.user_token,
    submitted_at: submission.created_at,
    diffs
  };
}

/**
 * Get pending artwork edits for review using the new submissions system
 */
async function getPendingArtworkEditsForReview(
  db: D1Database, 
  limit: number = 50, 
  offset: number = 0
): Promise<ArtworkEditReviewData[]> {
  const submissions = await getSubmissionsByStatus(
    db, 
    'pending', 
    'artwork_edit', 
    limit, 
    offset
  );
  
  return submissions.map(convertSubmissionToArtworkEditReview);
}

/**
 * Get artwork edit submission for review using the new submissions system
 */
async function getArtworkEditSubmissionForReview(
  db: D1Database,
  submissionId: string
): Promise<ArtworkEditReviewData | null> {
  const submission = await getSubmission(db, submissionId);
  
  if (!submission || submission.submission_type !== 'artwork_edit') {
    return null;
  }
  
  return convertSubmissionToArtworkEditReview(submission);
}

// ================================

// Configuration
const NEARBY_ARTWORK_RADIUS_METERS = 100; // For reviewer duplicate detection
const MAX_REVIEW_BATCH_SIZE = 50;

/**
 * GET /api/review/queue
 * Get pending submissions for review
 */
export async function getReviewQueue(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');

    // Check reviewer permissions
  if (!authContext.canReview) {
  throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Get query parameters
    const { limit = '20', offset = '0', status = 'pending' } = c.req.query();
    const limitNum = Math.min(parseInt(limit) || 20, MAX_REVIEW_BATCH_SIZE);
    const offsetNum = parseInt(offset) || 0;

    console.log(`[DEBUG] Review queue params:`, { status, limit, offset, limitNum, offsetNum });

    // Query pending submissions
    const stmt = c.env.DB.prepare(`
      SELECT 
        s.*,
        COUNT(*) OVER() as total_count
      FROM submissions s
      WHERE s.status = ? AND s.submission_type = 'logbook_entry'
      ORDER BY s.created_at ASC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(status, limitNum, offsetNum).all();
    
    console.log(`[DEBUG] Database query result:`, { 
      success: results.success, 
      count: results.results?.length,
      meta: results.meta 
    });

    if (!results.success) {
      throw new ApiError('Failed to fetch review queue', 'DATABASE_ERROR', 500);
    }

    const totalCount =
      results.results.length > 0 ? (results.results[0] as unknown as SubmissionRow).total_count : 0;

    // Format submissions for review
    const submissions = results.results.map((row: unknown) => {
      try {
        const submissionRow = row as SubmissionRow;
        
        // Parse the structured submission data
        let title = 'Untitled Submission';
        let note = 'No note provided';
        let artworkType = 'Other';
        
        if (submissionRow.notes) {
          try {
            const submissionData = JSON.parse(submissionRow.notes);
            if (submissionData._submission) {
              // Extract title from tags
              if (submissionData._submission.tags?.title) {
                title = submissionData._submission.tags.title;
              }
              // Extract artwork type
              if (submissionData._submission.tags?.artwork_type) {
                artworkType = submissionData._submission.tags.artwork_type;
              } else if (submissionData._submission.type_name) {
                artworkType = submissionData._submission.type_name;
              }
            }
            // Extract the actual user note
            if (submissionData.notes) {
              note = submissionData.notes;
            }
          } catch (parseError) {
            console.warn('Failed to parse submission data:', parseError);
            // Use the raw notes as fallback
            note = submissionRow.notes;
          }
        }
        
        // Normalize photo references to absolute URLs where possible
        const rawPhotos = submissionRow.photos ? JSON.parse(submissionRow.photos) : [];
        const normalizedPhotos = (rawPhotos || []).map((p: string) => {
          try {
            // If already an absolute URL, leave as-is (constructor will throw if invalid)
            new URL(p);
            return p;
          } catch (err) {
            // If looks like an internal permalink or app route, skip normalization
            if (typeof p === 'string' && (p.startsWith('/p/') || p.startsWith('/artwork/'))) {
              return p; // leave as-is; frontend will handle or ignore
            }

            // Otherwise treat as an R2 key and generate full URL
            const key = extractR2KeyFromRef(p);
            return key ? generatePhotoUrl(c.env, key) : p;
          }
        });

        return {
          id: submissionRow.id,
          title: title,
          type: artworkType,
          lat: submissionRow.lat || 49.2827,
          lon: submissionRow.lon || -123.1207,
          note: note,
          photos: normalizedPhotos,
          tags: {},
          status: submissionRow.status,
          created_at: submissionRow.created_at,
          artwork_id: submissionRow.artwork_id,
          user_token: submissionRow.user_token, // Add missing user_token field
        };
      } catch (error) {
        console.error(`Failed to process submission ${(row as { id?: string })?.id}:`, error);
        return null;
      }
    }).filter(submission => submission !== null); // Remove failed submissions
    
    console.log(`[DEBUG] Review queue returning ${submissions.length} submissions`);

    return c.json({
      submissions,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: totalCount,
        has_more: offsetNum + limitNum < totalCount,
      },
    });
  } catch (error) {
    console.error('Review queue error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve review queue', 'REVIEW_QUEUE_ERROR', 500);
  }
}

/**
 * For MVP: Extract submission coordinates and type from logbook note field
 * Format: { note: "user note", _submission: { lat: 49.123, lon: -123.456, tags: { artwork_type: "public_art" } } }
 */
function parseSubmissionData(logbookEntry: LogbookRecord): ParsedSubmissionData {
  try {
    if (logbookEntry.notes) {
      // Try to parse as new format with _submission field
      const noteData = JSON.parse(logbookEntry.notes);
      if (noteData._submission) {
        const submissionTags = noteData._submission.tags || {};
        return {
          ...logbookEntry,
          total_count: 0, // Add missing field
          lat: noteData._submission.lat,
          lon: noteData._submission.lon,
          tags: JSON.stringify(submissionTags),
          notes: noteData.notes || null, // Extract the actual user note
          artwork_type_name: submissionTags.artwork_type || noteData._submission.type_name || 'unknown',
        };
      }
      
      // Handle old format: "Tags: {...}"
      if (typeof logbookEntry.notes === 'string' && logbookEntry.notes.startsWith('Tags: ')) {
        const tagsString = logbookEntry.notes.substring(6); // Remove "Tags: " prefix
        try {
          const tags = JSON.parse(tagsString);
          return {
            ...logbookEntry,
            total_count: 0,
            lat: logbookEntry.lat || 49.2827,
            lon: logbookEntry.lon || -123.1207,
            tags: JSON.stringify(tags),
            notes: null,
            artwork_type_name: 'Other',
          };
        } catch (tagParseError) {
          console.warn('Failed to parse tags from old format note:', tagParseError);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to parse submission note:', error);
  }

  return {
    ...logbookEntry,
    total_count: 0, // Add missing field
    lat: logbookEntry.lat || 49.2827, // Use actual coordinates or fallback to Vancouver
    lon: logbookEntry.lon || -123.1207,
    tags: '{}',
    artwork_type_name: 'unknown',
  };
}
export async function getSubmissionForReview(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');

    // Check reviewer permissions
  if (!authContext.canReview) {
  throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const submissionId = c.req.param('id');

    // Get submission details
    const rawSubmission = await findLogbookById(c.env.DB, submissionId);
    if (!rawSubmission) {
      throw new ApiError('Submission not found', 'SUBMISSION_NOT_FOUND', 404);
    }

    // Parse submission data from note field
    const submission = parseSubmissionData(rawSubmission);

    // Find nearby artworks for duplicate detection
    const nearbyArtworks = await findNearbyArtworks(
      c.env.DB,
      submission.lat,
      submission.lon,
      NEARBY_ARTWORK_RADIUS_METERS
    );

    // Calculate distances for reviewer context
    const nearbyWithDistances = nearbyArtworks.map((artwork: ArtworkRecord) => ({
      ...artwork,
      distance_meters: Math.round(
        calculateDistance(submission.lat, submission.lon, artwork.lat, artwork.lon).distance_km *
          1000
      ), // Convert km to meters
    }));

    // Get artwork type from tags (already available in submission.artwork_type_name)
    const artworkTypeName = submission.artwork_type_name || 'unknown';

    // Normalize photo references to absolute URLs where possible
    const rawPhotos = submission.photos ? JSON.parse(submission.photos) : [];
    const normalizedPhotos = (rawPhotos || []).map((p: string) => {
      try {
        new URL(p);
        return p;
      } catch (err) {
        if (typeof p === 'string' && (p.startsWith('/p/') || p.startsWith('/artwork/'))) {
          return p;
        }

        const key = extractR2KeyFromRef(p);
        return key ? generatePhotoUrl(c.env, key) : p;
      }
    });

    return c.json({
      submission: {
        id: submission.id,
        type: artworkTypeName,
        lat: submission.lat,
        lon: submission.lon,
        notes: submission.notes,
        photos: normalizedPhotos,
        tags: submission.tags ? JSON.parse(submission.tags) : {},
        status: submission.status,
        created_at: submission.created_at,
        artwork_id: submission.artwork_id,
      },
      nearby_artworks: nearbyWithDistances,
      review_context: {
        duplicate_threshold_meters: NEARBY_ARTWORK_RADIUS_METERS,
        requires_action: submission.status === 'pending',
      },
    });
  } catch (error) {
    console.error('Submission review error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve submission for review', 'SUBMISSION_REVIEW_ERROR', 500);
  }
}

/**
 * POST /api/review/approve/:id
 * Approve a submission and create/link artwork
 */
export async function approveSubmission(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');

    // Check reviewer permissions
  if (!authContext.canReview) {
  throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const submissionId = c.req.param('id');
    const { action, artwork_id, overrides } = await c.req.json();

    // Validate action
    if (!['create_new', 'link_existing'].includes(action)) {
      throw new ApiError(
        'Invalid approval action. Must be "create_new" or "link_existing"',
        'INVALID_ACTION',
        400
      );
    }

    // Get submission
    const rawSubmission = await findLogbookById(c.env.DB, submissionId);
    if (!rawSubmission) {
      throw new ApiError('Submission not found', 'SUBMISSION_NOT_FOUND', 404);
    }

    const submission = parseSubmissionData(rawSubmission);

    if (submission.status !== 'pending') {
      throw new ApiError('Only pending submissions can be approved', 'INVALID_STATUS', 400);
    }

    let finalArtworkId: string = '';
    let newArtworkCreated = false;

    if (action === 'create_new') {
    // Create new artwork from submission - include title and description from tags if available
    const submissionTags = submission.tags ? JSON.parse(submission.tags) : {};
    console.log('[APPROVAL DEBUG] Title/Description extraction:', {
      submissionId: submission.id,
      originalTags: submission.tags,
      parsedTags: submissionTags,
      extractedTitle: typeof submissionTags.title === 'string' ? submissionTags.title : null,
      extractedDescription: typeof submissionTags.description === 'string' ? submissionTags.description : null,
      titleType: typeof submissionTags.title,
      descriptionType: typeof submissionTags.description
    });
    const artworkData: Omit<ArtworkRecord, 'id' | 'created_at'> = {
      lat: overrides?.lat || submission.lat,
      lon: overrides?.lon || submission.lon,
      tags: submission.tags || '{}',
      status: 'approved',
      title: typeof submissionTags.title === 'string' ? submissionTags.title : null,
      description: typeof submissionTags.description === 'string' ? submissionTags.description : null,
      created_by: (typeof submissionTags.artist === 'string' ? submissionTags.artist : 
                  typeof submissionTags.artist_name === 'string' ? submissionTags.artist_name : 
                  typeof submissionTags.created_by === 'string' ? submissionTags.created_by : null),
      photos: submission.photos ? JSON.stringify(JSON.parse(submission.photos)) : null // Fix: ensure proper JSON format
    };      
    finalArtworkId = await insertArtwork(c.env.DB, artworkData);
    newArtworkCreated = true;

    // Create consent record for the new artwork 
    // Use the original submission's consent information to create artwork consent
    try {
      const { recordConsent, generateConsentTextHash, getConsentRecord } = await import('../lib/consent-new');
      
      // Get the logbook consent record to extract consent information
      const logbookConsentRecord = await getConsentRecord(c.env.DB, {
        contentType: 'logbook',
        contentId: submission.id,
      });

      if (logbookConsentRecord) {
        const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
        const consentTextHash = await generateConsentTextHash(
          `Cultural Archiver Consent v${logbookConsentRecord.consent_version} - Artwork Created from Submission`
        );

        const consentParams = {
          ...(logbookConsentRecord.user_id 
            ? { userId: logbookConsentRecord.user_id } 
            : logbookConsentRecord.anonymous_token 
              ? { anonymousToken: logbookConsentRecord.anonymous_token }
              : { anonymousToken: submission.user_token }), // fallback to submission user token
          contentType: 'artwork' as const,
          contentId: finalArtworkId,
          consentVersion: logbookConsentRecord.consent_version,
          ipAddress: clientIP,
          consentTextHash,
          db: c.env.DB,
        };

        const artworkConsentRecord = await recordConsent(consentParams);
        console.info('Created consent record for new artwork:', {
          artworkId: finalArtworkId,
          consentId: artworkConsentRecord.id,
          fromLogbookConsent: logbookConsentRecord.id,
        });
      } else {
        console.warn('No logbook consent record found for submission:', submission.id);
      }
    } catch (error) {
      console.error('Failed to create artwork consent record:', error);
      // Don't fail the approval if consent creation fails - log and continue
    }
    } else if (action === 'link_existing') {
      // Link to existing artwork
      if (!artwork_id) {
        throw new ApiError(
          'Artwork ID required for linking to existing artwork',
          'MISSING_ARTWORK_ID',
          400
        );
      }

      // Verify artwork exists
      const existingArtwork = await findArtworkById(c.env.DB, artwork_id);
      if (!existingArtwork) {
        throw new ApiError('Target artwork not found', 'ARTWORK_NOT_FOUND', 404);
      }

      finalArtworkId = artwork_id;
    }

    // Move photos from submission to artwork
    let newPhotoUrls: string[] = [];
    if (submission.photos) {
      const submissionPhotos = JSON.parse(submission.photos);
      if (submissionPhotos.length > 0) {
        const moveStart = Date.now();
        const debugEnabled = c.env.PHOTO_DEBUG === '1' || c.env.PHOTO_DEBUG === 'true';
        if (debugEnabled) {
          console.info('[PHOTO][REVIEW] Moving submission photos', {
            submission_id: submission.id,
            artwork_candidate_id: finalArtworkId,
            count: submissionPhotos.length,
          });
        }
        newPhotoUrls = await movePhotosToArtwork(c.env, submissionPhotos, finalArtworkId);
        if (debugEnabled) {
          console.info('[PHOTO][REVIEW] Move complete', {
            submission_id: submission.id,
            artwork_id: finalArtworkId,
            moved: newPhotoUrls.length,
            ms: Date.now() - moveStart,
          });
        }

        // Update artwork with new photos (deduplicate to prevent duplicates from merging same photo)
        if (newArtworkCreated) {
          await updateArtworkPhotos(c.env.DB, finalArtworkId, newPhotoUrls);
        } else {
          // Merge with existing photos and deduplicate
          const existingArtwork = await findArtworkById(c.env.DB, finalArtworkId);
          const existingPhotos = existingArtwork ? getPhotosFromArtwork(existingArtwork) : [];
          const allPhotos = Array.from(new Set([...existingPhotos, ...newPhotoUrls]));
          await updateArtworkPhotos(c.env.DB, finalArtworkId, allPhotos);
        }
        
        // Update the logbook entry to point to the moved photos to prevent duplication
        // in photo aggregation (logbook + artwork photos would show duplicates otherwise)
        await updateLogbookPhotos(c.env.DB, submissionId, newPhotoUrls);
      }
    }

    // Tags are already stored in the artwork's JSON tags field during artwork creation
    // No separate tag insertion needed since we use JSON-based tag storage

    // Update submission status
    await updateLogbookStatus(c.env.DB, submissionId, 'approved', finalArtworkId);

    // Log the moderation decision for audit trail
    const { logModerationDecision, createModerationAuditContext } = await import('../lib/audit');
    const auditContext = createModerationAuditContext(
      c,
      submissionId,
      authContext.userToken,
      'approved',
      {
        reason: `Action: ${action}${overrides ? ` with overrides` : ''}`,
        artworkId: finalArtworkId,
        actionTaken: action as 'create_new' | 'link_existing',
        photosProcessed: newPhotoUrls.length,
      }
    );

    const auditResult = await logModerationDecision(c.env.DB, auditContext);
    if (!auditResult.success) {
      console.warn('Failed to log moderation decision:', auditResult.error);
    }

    return c.json({
      message: 'Submission approved successfully',
      submission_id: submissionId,
      artwork_id: finalArtworkId,
      action,
      new_artwork_created: newArtworkCreated,
      photos_migrated: newPhotoUrls.length,
      approved_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Approval error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to approve submission', 'APPROVAL_ERROR', 500);
  }
}

/**
 * POST /api/review/reject/:id
 * Reject a submission with reason
 */
export async function rejectSubmission(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');

    // Check reviewer permissions
  if (!authContext.canReview) {
  throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const submissionId = c.req.param('id');
    const { reason, cleanup_photos = true } = await c.req.json();

    // Get submission for rejection
    const rawSubmission = await findLogbookById(c.env.DB, submissionId);
    if (!rawSubmission) {
      throw new ApiError('Submission not found', 'SUBMISSION_NOT_FOUND', 404);
    }

    const submission = parseSubmissionData(rawSubmission);

    if (submission.status !== 'pending') {
      throw new ApiError('Only pending submissions can be rejected', 'INVALID_STATUS', 400);
    }

    // Clean up photos if requested
    if (cleanup_photos && submission.photos) {
      const submissionPhotos = JSON.parse(submission.photos);
      if (submissionPhotos.length > 0) {
        await cleanupRejectedPhotos(c.env, submissionPhotos);
      }
    }

    // Update submission status
    await updateLogbookStatus(c.env.DB, submissionId, 'rejected');

    // Log the moderation decision for audit trail
    const { logModerationDecision, createModerationAuditContext } = await import('../lib/audit');
    const auditContext = createModerationAuditContext(
      c,
      submissionId,
      authContext.userToken,
      'rejected',
      {
        reason: reason || 'No reason provided',
        photosProcessed:
          cleanup_photos && submission.photos ? JSON.parse(submission.photos).length : 0,
      }
    );

    const auditResult = await logModerationDecision(c.env.DB, auditContext);
    if (!auditResult.success) {
      console.warn('Failed to log moderation decision:', auditResult.error);
    }

    return c.json({
      message: 'Submission rejected successfully',
      submission_id: submissionId,
      reason,
      photos_cleaned_up: cleanup_photos,
      rejected_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Rejection error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to reject submission', 'REJECTION_ERROR', 500);
  }
}

/**
 * GET /api/review/stats
 * Get review statistics and metrics
 */
export async function getReviewStats(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');

    // Check reviewer permissions
  if (!authContext.canReview) {
  throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Get submission counts by status
    const statusStmt = c.env.DB.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM submissions
      WHERE submission_type = 'logbook'
      GROUP BY status
    `);

    const statusResults = await statusStmt.all();

    if (!statusResults.success) {
      throw new ApiError('Failed to fetch review statistics', 'DATABASE_ERROR', 500);
    }

    // Get recent activity
    const recentStmt = c.env.DB.prepare(`
      SELECT 
        DATE(created_at) as date,
        status,
        COUNT(*) as count
      FROM submissions
      WHERE created_at >= date('now', '-30 days') AND submission_type = 'logbook'
      GROUP BY DATE(created_at), status
      ORDER BY date DESC
    `);

    const recentResults = await recentStmt.all();

    // Format statistics
    const statusCounts = statusResults.results.reduce(
      (acc: Record<string, number>, row: unknown) => {
        const statusRow = row as StatusRow;
        acc[statusRow.status] = statusRow.count;
        return acc;
      },
      {} as Record<string, number>
    );

    const recentActivity = recentResults.success ? recentResults.results : [];

    return c.json({
      status_counts: {
        pending: statusCounts.pending || 0,
        approved: statusCounts.approved || 0,
        rejected: statusCounts.rejected || 0,
      },
      queue_size: statusCounts.pending || 0,
      recent_activity: recentActivity,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Review stats error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve review statistics', 'REVIEW_STATS_ERROR', 500);
  }
}

/**
 * PUT /api/review/batch
 * Batch approve/reject multiple submissions
 */
export async function processBatchReview(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');

    // Check reviewer permissions
  if (!authContext.canReview) {
  throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const { submissions } = await c.req.json();

    if (!Array.isArray(submissions) || submissions.length === 0) {
      throw new ApiError('Submissions array is required', 'INVALID_BATCH', 400);
    }

    if (submissions.length > MAX_REVIEW_BATCH_SIZE) {
      throw new ApiError(
        `Batch size cannot exceed ${MAX_REVIEW_BATCH_SIZE} submissions`,
        'BATCH_TOO_LARGE',
        400
      );
    }

    const results = {
      approved: 0,
      rejected: 0,
      errors: [] as Array<{ submission_id: unknown; error: string }>,
    };

    // Process each submission
    for (const item of submissions) {
      try {
        const { id, action } = item;

        if (action === 'approve') {
          // Simple approval (create new artwork)
          const rawSubmission = await findLogbookById(c.env.DB, id);
          if (rawSubmission && rawSubmission.status === 'pending') {
            const submission = parseSubmissionData(rawSubmission);
            
            // Parse submission tags to extract title, description, and artist
            let submissionTags: Record<string, unknown> = {};
            try {
              submissionTags = typeof submission.tags === 'string' 
                ? JSON.parse(submission.tags) 
                : (submission.tags || {});
            } catch (e) {
              console.error('Failed to parse submission tags:', e);
            }
            
            console.log('[BULK APPROVAL DEBUG] Title/Description extraction:', {
              submissionId: submission.id,
              originalTags: submission.tags,
              parsedTags: submissionTags,
              extractedTitle: typeof submissionTags.title === 'string' ? submissionTags.title : null,
              extractedDescription: typeof submissionTags.description === 'string' ? submissionTags.description : null,
              titleType: typeof submissionTags.title,
              descriptionType: typeof submissionTags.description
            });
            
            const artworkData: Omit<ArtworkRecord, 'id' | 'created_at'> = {
              lat: submission.lat,
              lon: submission.lon,
              tags: submission.tags || '{}',
              status: 'approved',
              title: typeof submissionTags.title === 'string' ? submissionTags.title : null,
              description: typeof submissionTags.description === 'string' ? submissionTags.description : null,
              created_by: (typeof submissionTags.artist === 'string' ? submissionTags.artist : 
                          typeof submissionTags.created_by === 'string' ? submissionTags.created_by : null),
              photos: submission.photos || null
            };

            const artworkId = await insertArtwork(c.env.DB, artworkData);
            await updateLogbookStatus(c.env.DB, id, 'approved', artworkId);
            results.approved++;
          }
        } else if (action === 'reject') {
          const rawSubmission = await findLogbookById(c.env.DB, id);
          if (rawSubmission && rawSubmission.status === 'pending') {
            await updateLogbookStatus(c.env.DB, id, 'rejected');
            results.rejected++;
          }
        }
      } catch (error) {
        results.errors.push({
          submission_id: item.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return c.json({
      message: 'Batch review completed',
      results,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Batch review error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to process batch review', 'BATCH_REVIEW_ERROR', 500);
  }
}

/**
 * GET /api/review/artwork-edits
 * Get pending artwork edits for moderation queue
 */
export async function getArtworkEditsForReview(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');

    // Check reviewer permissions
  if (!authContext.canReview) {
  throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Handle both frontend parameter styles (page/per_page and limit/offset)
    const per_page = parseInt(c.req.query('per_page') || c.req.query('limit') || '50');
    const page = parseInt(c.req.query('page') || '1');
    const limit = per_page;
    const offset = (page - 1) * per_page;

    const pendingEdits: ArtworkEditReviewData[] = await getPendingArtworkEditsForReview(
      c.env.DB,
      limit,
      offset
    );

    // Enrich with artwork details
    const enrichedEdits = [];
    for (const edit of pendingEdits) {
      const artwork = await findArtworkById(c.env.DB, edit.artwork_id);
      if (artwork) {
        // Parse the tags to get display values with error handling
        let tagsParsed: Record<string, string> = {};
        try {
          tagsParsed = JSON.parse(artwork.tags || '{}') as Record<string, string>;
        } catch (jsonError) {
          console.warn(
            `[ARTWORK EDITS] Invalid JSON in tags for artwork ${artwork.id}: "${artwork.tags}"`
          );
          // If it's not valid JSON, treat the entire string as a title
          tagsParsed = { title: artwork.tags || 'Unknown Artwork' };
        }

        enrichedEdits.push({
          ...edit,
          artwork_title: tagsParsed.title || 'Unknown Artwork',
          artwork_status: artwork.status,
        });
      } else {
        enrichedEdits.push({
          ...edit,
          artwork_title: 'Unknown Artwork',
          artwork_status: 'unknown' as const,
        });
      }
    }

    return c.json({
      edits: enrichedEdits,
      pagination: {
        limit,
        offset,
        total_items: enrichedEdits.length,
        has_more: enrichedEdits.length === limit,
      },
    });
  } catch (error) {
    console.error('Get artwork edits error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to get artwork edits', 'ARTWORK_EDITS_ERROR', 500);
  }
}

/**
 * GET /api/review/artwork-edits/:editId
 * Get specific artwork edit submission for detailed review
 */
export async function getArtworkEditForReview(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');

    // Check reviewer permissions
  if (!authContext.canReview) {
  throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const editId = c.req.param('editId');

    const editSubmission: ArtworkEditReviewData | null =
      await getArtworkEditSubmissionForReview(c.env.DB, editId);
    if (!editSubmission) {
      throw new ApiError('Edit submission not found', 'EDIT_NOT_FOUND', 404);
    }

    // Get artwork details
    const artwork = await findArtworkById(c.env.DB, editSubmission.artwork_id);
    if (!artwork) {
      throw new ApiError('Associated artwork not found', 'ARTWORK_NOT_FOUND', 404);
    }

    // Parse the tags to get current field values
    const tagsParsed = JSON.parse(artwork.tags || '{}') as Record<string, string>;

    return c.json({
      edit_submission: editSubmission,
      artwork: {
        id: artwork.id,
        title: tagsParsed.title || '',
        description: tagsParsed.description || '',
        created_by: tagsParsed.creator || '',
        tags: tagsParsed,
        status: artwork.status,
        lat: artwork.lat,
        lon: artwork.lon,
      },
    });
  } catch (error) {
    console.error('Get artwork edit error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to get artwork edit', 'ARTWORK_EDIT_ERROR', 500);
  }
}

/**
 * POST /api/review/artwork-edits/:editId/approve
 * Approve artwork edit submission (all-or-nothing)
 */
export async function approveArtworkEdit(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');

    // Check reviewer permissions
  if (!authContext.canReview) {
  throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const editId = c.req.param('editId');
    const { apply_to_artwork = true } = await c.req.json();

    // Get the full edit submission
    const editSubmission: ArtworkEditReviewData | null =
      await getArtworkEditSubmissionForReview(c.env.DB, editId);
    if (!editSubmission) {
      throw new ApiError('Edit submission not found', 'EDIT_NOT_FOUND', 404);
    }

    // Approve the submission (note: editSubmission.edit_ids contains single submission ID in new system)
    const submissionId = editSubmission.edit_ids[0];
    if (!submissionId) {
      throw new ApiError('Invalid submission data', 'INVALID_SUBMISSION', 400);
    }
    
    await approveSubmissionInDb(
      c.env.DB,
      submissionId,
      authContext.userToken,
      apply_to_artwork ? 'Approved - changes applied to artwork' : 'Approved - changes not applied'
    );

    // Log the moderation decision for audit trail
    const { logModerationDecision, createModerationAuditContext } = await import('../lib/audit');
    const auditContext = createModerationAuditContext(
      c,
      editId,
      authContext.userToken,
      'approved',
      {
        reason: `Approved ${editSubmission.edit_ids.length} field edits`,
        artworkId: editSubmission.artwork_id,
        // Note: edit_count and fields_changed are custom metadata that may not be stored
      }
    );

    const auditResult = await logModerationDecision(c.env.DB, auditContext);
    if (!auditResult.success) {
      console.warn('Failed to log artwork edit approval:', auditResult.error);
    }

    return c.json({
      message: 'Artwork edit approved successfully',
      edit_id: editId,
      edit_count: editSubmission.edit_ids.length,
      artwork_id: editSubmission.artwork_id,
      applied_to_artwork: apply_to_artwork,
      approved_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Approve artwork edit error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to approve artwork edit', 'ARTWORK_EDIT_APPROVAL_ERROR', 500);
  }
}

/**
 * POST /api/review/artwork-edits/:editId/reject
 * Reject artwork edit submission with reason
 */
export async function rejectArtworkEdit(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');

    // Check reviewer permissions
  if (!authContext.canReview) {
  throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const editId = c.req.param('editId');
    const { reason } = await c.req.json();

    // Get the full edit submission
    const editSubmission: ArtworkEditReviewData | null =
      await getArtworkEditSubmissionForReview(c.env.DB, editId);
    if (!editSubmission) {
      throw new ApiError('Edit submission not found', 'EDIT_NOT_FOUND', 404);
    }

    // Reject the submission (note: editSubmission.edit_ids contains single submission ID in new system)
    const submissionId = editSubmission.edit_ids[0];
    if (!submissionId) {
      throw new ApiError('Invalid submission data', 'INVALID_SUBMISSION', 400);
    }
    
    await rejectSubmissionInDb(
      c.env.DB,
      submissionId,
      authContext.userToken,
      reason
    );

    // Log the moderation decision for audit trail
    const { logModerationDecision, createModerationAuditContext } = await import('../lib/audit');
    const auditContext = createModerationAuditContext(
      c,
      editId,
      authContext.userToken,
      'rejected',
      {
        reason: reason || `Rejected ${editSubmission.edit_ids.length} field edits`,
        artworkId: editSubmission.artwork_id,
        // Note: edit_count and fields_rejected are custom metadata that may not be stored
      }
    );

    const auditResult = await logModerationDecision(c.env.DB, auditContext);
    if (!auditResult.success) {
      console.warn('Failed to log artwork edit rejection:', auditResult.error);
    }

    return c.json({
      message: 'Artwork edit rejected successfully',
      edit_id: editId,
      edit_count: editSubmission.edit_ids.length,
      artwork_id: editSubmission.artwork_id,
      reason: reason || 'No reason provided',
      rejected_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reject artwork edit error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to reject artwork edit', 'ARTWORK_EDIT_REJECTION_ERROR', 500);
  }
}
