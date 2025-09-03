/**
 * Review and moderation route handlers
 *
 * Provides endpoints for reviewers to approve, reject, and manage
 * user submissions with proper permission checking and audit logging.
 */

import type { Context } from 'hono';
import type { WorkerEnv, AuthContext, ArtworkRecord, LogbookRecord } from '../types';
import {
  insertArtwork,
  updateLogbookStatus,
  findNearbyArtworks,
  findLogbookById,
  insertTags,
  findArtworkById,
  updateArtworkPhotos,
} from '../lib/database';
import { movePhotosToArtwork, cleanupRejectedPhotos } from '../lib/photos';
import { calculateDistance } from '../lib/spatial';

// Interfaces for database results
interface SubmissionRow {
  id: string;
  artwork_id: string | null;
  user_token: string;
  lat: number | null;
  lon: number | null;
  note: string | null;
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
  type_id: string;
  tags: string;
  artwork_type_name?: string;
}
import { ApiError } from '../lib/errors';

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
    if (!authContext.isReviewer) {
      throw new ApiError('Reviewer permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Get query parameters
    const { limit = '20', offset = '0', status = 'pending' } = c.req.query();
    const limitNum = Math.min(parseInt(limit) || 20, MAX_REVIEW_BATCH_SIZE);
    const offsetNum = parseInt(offset) || 0;

    // Query pending submissions
    const stmt = c.env.DB.prepare(`
      SELECT 
        l.*,
        COUNT(*) OVER() as total_count
      FROM logbook l
      WHERE l.status = ?
      ORDER BY l.created_at ASC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(status, limitNum, offsetNum).all();

    if (!results.success) {
      throw new ApiError('Failed to fetch review queue', 'DATABASE_ERROR', 500);
    }

    const totalCount =
      results.results.length > 0 ? (results.results[0] as unknown as SubmissionRow).total_count : 0;

    // Format submissions for review
    const submissions = results.results.map((row: unknown) => {
      const submissionRow = row as SubmissionRow;
      // Convert SubmissionRow to LogbookRecord for parsing
      const logbookRecord: LogbookRecord = {
        id: submissionRow.id,
        artwork_id: submissionRow.artwork_id,
        user_token: submissionRow.user_token,
        lat: submissionRow.lat,
        lon: submissionRow.lon,
        note: submissionRow.note,
        photos: submissionRow.photos,
        status: submissionRow.status as 'pending' | 'approved' | 'rejected',
        created_at: submissionRow.created_at,
      };
      const parsedData = parseSubmissionData(logbookRecord);

      const submission = {
        id: parsedData.id,
        type: parsedData.artwork_type_name || 'Unknown',
        lat: parsedData.lat,
        lon: parsedData.lon,
        note: parsedData.note || '',
        photos: parsedData.photos ? JSON.parse(parsedData.photos) : [],
        tags: parsedData.tags ? JSON.parse(parsedData.tags) : {},
        status: parsedData.status,
        created_at: parsedData.created_at,
        artwork_id: parsedData.artwork_id,
      };

      return submission;
    });

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
 * Format: { note: "user note", _submission: { lat: 49.123, lon: -123.456, type_id: "public_art", tags: {} } }
 */
function parseSubmissionData(logbookEntry: LogbookRecord): ParsedSubmissionData {
  try {
    if (logbookEntry.note) {
      const noteData = JSON.parse(logbookEntry.note);
      if (noteData._submission) {
        return {
          ...logbookEntry,
          total_count: 0, // Add missing field
          lat: noteData._submission.lat,
          lon: noteData._submission.lon,
          type_id: noteData._submission.type_id,
          tags: JSON.stringify(noteData._submission.tags || {}),
          note: noteData.note || null, // Extract the actual user note
          artwork_type_name: noteData._submission.type_name || 'Unknown',
        };
      }
    }
  } catch (error) {
    // If parsing fails, return as-is with default values
  }

  return {
    ...logbookEntry,
    total_count: 0, // Add missing field
    lat: 49.2827, // Default Vancouver coordinates for testing
    lon: -123.1207,
    type_id: 'other',
    tags: '{}',
    artwork_type_name: 'Other',
  };
}
export async function getSubmissionForReview(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');

    // Check reviewer permissions
    if (!authContext.isReviewer) {
      throw new ApiError('Reviewer permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
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

    // Get artwork type name
    const typeStmt = c.env.DB.prepare('SELECT name FROM artwork_types WHERE id = ?');
    const typeResult = await typeStmt.bind(submission.type_id).first();

    return c.json({
      submission: {
        id: submission.id,
        type: typeResult?.name || 'Unknown',
        type_id: submission.type_id,
        lat: submission.lat,
        lon: submission.lon,
        note: submission.note,
        photos: submission.photos ? JSON.parse(submission.photos) : [],
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
    if (!authContext.isReviewer) {
      throw new ApiError('Reviewer permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
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
      // Create new artwork from submission
      const artworkData: Omit<ArtworkRecord, 'id' | 'created_at' | 'updated_at'> = {
        type_id: submission.type_id,
        lat: overrides?.lat || submission.lat,
        lon: overrides?.lon || submission.lon,
        tags: submission.tags || '{}',
        status: 'approved',
        photos: '[]', // Will be updated after photo migration
      };

      finalArtworkId = await insertArtwork(c.env.DB, artworkData);
      newArtworkCreated = true;
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
        newPhotoUrls = await movePhotosToArtwork(c.env, submissionPhotos, finalArtworkId);

        // Update artwork with new photos
        if (newArtworkCreated) {
          await updateArtworkPhotos(c.env.DB, finalArtworkId, newPhotoUrls);
        } else {
          // Merge with existing photos
          const existingArtwork = await findArtworkById(c.env.DB, finalArtworkId);
          const existingPhotos = existingArtwork?.photos ? JSON.parse(existingArtwork.photos) : [];
          const allPhotos = [...existingPhotos, ...newPhotoUrls];
          await updateArtworkPhotos(c.env.DB, finalArtworkId, allPhotos);
        }
      }
    }

    // Add tags from submission to artwork
    if (submission.tags) {
      const tags = JSON.parse(submission.tags);
      const tagEntries = Object.entries(tags).map(([label, value]) => ({
        label,
        value: String(value),
        artwork_id: finalArtworkId,
        logbook_id: null,
      }));

      if (tagEntries.length > 0) {
        await insertTags(c.env.DB, tagEntries);
      }
    }

    // Update submission status
    await updateLogbookStatus(c.env.DB, submissionId, 'approved', finalArtworkId);

    // Log approval action
    console.log('Submission approved:', {
      submissionId,
      artworkId: finalArtworkId,
      action,
      reviewerId: authContext.userToken,
      newArtworkCreated,
      photosMoved: newPhotoUrls.length,
    });

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
    if (!authContext.isReviewer) {
      throw new ApiError('Reviewer permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
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

    // Log rejection action
    console.log('Submission rejected:', {
      submissionId,
      reason,
      reviewerId: authContext.userToken,
      photosCleanedUp: cleanup_photos,
    });

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
    if (!authContext.isReviewer) {
      throw new ApiError('Reviewer permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Get submission counts by status
    const statusStmt = c.env.DB.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM logbook
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
      FROM logbook
      WHERE created_at >= date('now', '-30 days')
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
    if (!authContext.isReviewer) {
      throw new ApiError('Reviewer permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
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
            const artworkData: Omit<ArtworkRecord, 'id' | 'created_at' | 'updated_at'> = {
              type_id: submission.type_id,
              lat: submission.lat,
              lon: submission.lon,
              tags: submission.tags || '{}',
              status: 'approved',
              photos: null, // Will be updated separately if needed
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
