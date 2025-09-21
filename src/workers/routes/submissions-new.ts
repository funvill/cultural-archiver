/**
 * Submission route handlers - Updated for New Unified Schema
 * Handles all submission types using the new unified submissions table
 * 
 * UPDATED: Uses new submissions service with unified schema
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { createSuccessResponse, ApiError } from '../lib/errors';
import { isRateLimitingEnabled } from '../types';
import { getUserToken } from '../middleware/auth';
import { getValidatedData, getValidatedFiles } from '../middleware/validation';
import { processAndUploadPhotos } from '../lib/photos';
import { CONSENT_VERSION } from '../../shared/consent';
import { DEFAULT_ARTWORK_SEARCH_RADIUS } from '../../shared/geo';
import { generateUUID } from '../../shared/constants';

// Import new unified services
import {
  createLogbookEntry,
  createArtworkEdit,
  createNewArtworkSubmission,
  getSubmissionsByStatus,
  approveSubmission,
  rejectSubmission
} from '../lib/submissions.js';
import { recordUserActivity } from '../lib/user-activity.js';
import { createAuditLog } from '../lib/audit-log.js';
import { hasPermission } from '../lib/user-roles.js';

// Import the new consent system
import { recordConsent, generateConsentTextHash } from '../lib/consent-new.js';

// ================================
// Request/Response Types
// ================================

interface LogbookSubmissionRequest {
  lat: number;
  lon: number;
  note?: string;
  photos?: File[];
  tags?: Record<string, string>;
  artwork_id?: string;
  consent_version?: string;
}

interface ArtworkEditSubmissionRequest {
  artwork_id: string;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown>;
  notes?: string;
  consent_version?: string;
}

interface NewArtworkSubmissionRequest {
  title: string;
  year_created?: number;
  medium?: string;
  dimensions?: string;
  lat: number;
  lon: number;
  address?: string;
  neighborhood?: string;
  city?: string;
  region?: string;
  country?: string;
  description?: string;
  photos?: File[];
  tags?: Record<string, string>;
  consent_version?: string;
}

interface SubmissionResponse {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  submission_type: string;
  nearby_artworks?: Array<{
    id: string;
    title: string;
    distance_meters: number;
    lat: number;
    lon: number;
  }>;
}

// ================================
// Logbook Submission Handler
// ================================

/**
 * POST /api/submissions/logbook - Create Logbook Entry
 */
export async function createLogbookSubmission(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  const validatedData = getValidatedData<LogbookSubmissionRequest>(c, 'body');
  const validatedFiles = getValidatedFiles(c);

  try {
    // Rate limiting check - only if enabled
    if (isRateLimitingEnabled(c.env)) {
      await recordUserActivity(
        c.env.DB, 
        userToken, 
        'user_token', 
        'submission'
      );

      // Check daily submission limit (10 per day)
      const dailySubmissions = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM user_activity 
        WHERE identifier = ? AND activity_type = 'submission' 
        AND window_start = date('now', 'start of day')
      `).bind(userToken).first<{count: number}>();

      if (dailySubmissions && dailySubmissions.count >= 10) {
        throw new ApiError(
          'Too many submissions. Please wait a moment before trying again.',
          'RATE_LIMIT_EXCEEDED',
          429
        );
      }
    }

    // Record consent
    const contentId = generateUUID();
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
    const consentVersion = validatedData.consent_version || CONSENT_VERSION;
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

    const consentRecord = await recordConsent(consentParams);

    // Check for nearby artworks
    const nearbyArtworks = await findNearbyArtworks(
      c.env.DB,
      validatedData.lat,
      validatedData.lon,
      DEFAULT_ARTWORK_SEARCH_RADIUS
    );

    // Process photos if any
    let photoUrls: string[] = [];
    if (validatedFiles.length > 0) {
      const photoResults = await processAndUploadPhotos(c.env, validatedFiles, contentId);
      photoUrls = photoResults.map(result => result.originalUrl);
    }

    // Create logbook submission
    const logbookData: Parameters<typeof createLogbookEntry>[1] = {
      userToken,
      artworkId: validatedData.artwork_id || '',
      lat: validatedData.lat,
      lon: validatedData.lon,
      verificationStatus: 'pending'
    };

    // Prefer `notes` field but accept legacy `note`
    // Prefer `notes` field but accept legacy `note`
    const vd = validatedData as unknown as { notes?: string; note?: string };
    if (vd.notes) {
      logbookData.notes = vd.notes;
    } else if (vd.note) {
      logbookData.notes = vd.note;
    }
    if (photoUrls.length > 0) {
      logbookData.photos = photoUrls;
    }
    if (validatedData.tags) {
      logbookData.tags = validatedData.tags;
    }

    const submissionId = await createLogbookEntry(c.env.DB, logbookData);

    // Audit log the submission
    const userAgent = c.req.header('User-Agent') || 'Unknown';
    await createAuditLog(c.env.DB, {
      entityType: 'submission',
      entityId: submissionId,
      action: 'create',
      userToken,
      ipAddress: clientIP,
      userAgent,
      newData: {
        submission_type: 'logbook_entry',
        has_photos: photoUrls.length > 0,
        has_artwork_id: !!validatedData.artwork_id,
        consent_id: consentRecord.id
      }
    });

    const response: SubmissionResponse = {
      id: submissionId,
      status: 'pending',
      message: 'Logbook entry submitted successfully and is pending review',
      submission_type: 'logbook_entry',
      nearby_artworks: nearbyArtworks.map(artwork => ({
        id: artwork.id,
        title: artwork.title || 'Untitled',
        distance_meters: Math.round(artwork.distance_km * 1000),
        lat: artwork.lat,
        lon: artwork.lon
      }))
    };

    return c.json(createSuccessResponse(response), 201);

  } catch (error) {
    console.error('Error creating logbook submission:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to create logbook submission',
      'SUBMISSION_CREATION_FAILED',
      500,
      { details: { error: error instanceof Error ? error.message : 'Unknown error' } }
    );
  }
}

// ================================
// Artwork Edit Submission Handler
// ================================

/**
 * POST /api/submissions/artwork-edit - Submit Artwork Edit
 */
export async function createArtworkEditSubmission(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  const validatedData = getValidatedData<ArtworkEditSubmissionRequest>(c, 'body');

  try {
    // Check if user has permission to edit artworks
    const canEdit = await hasPermission(c.env.DB, userToken, 'artwork.edit');
    if (!canEdit) {
      throw new ApiError(
        'Insufficient permissions to edit artworks',
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }

    // Record consent
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
    const consentVersion = validatedData.consent_version || CONSENT_VERSION;
    const consentTextHash = await generateConsentTextHash(
      `Cultural Archiver Consent v${consentVersion} - Artwork Edit`
    );

    const consentRecord = await recordConsent({
      userId: userToken,
      contentType: 'artwork' as const,
      contentId: validatedData.artwork_id,
      consentVersion,
      ipAddress: clientIP,
      consentTextHash,
      db: c.env.DB,
    });

    // Create artwork edit submission
    const artworkEditData: Parameters<typeof createArtworkEdit>[1] = {
      userToken,
      artworkId: validatedData.artwork_id,
      oldData: validatedData.old_data,
      newData: validatedData.new_data
    };

    if (validatedData.notes) {
      artworkEditData.notes = validatedData.notes;
    }

    const submissionId = await createArtworkEdit(c.env.DB, artworkEditData);

    // Audit log
    const userAgent = c.req.header('User-Agent') || 'Unknown';
    await createAuditLog(c.env.DB, {
      entityType: 'submission',
      entityId: submissionId,
      action: 'create',
      userToken,
      ipAddress: clientIP,
      userAgent,
      oldData: validatedData.old_data,
      newData: validatedData.new_data,
      metadata: {
        submission_type: 'artwork_edit',
        artwork_id: validatedData.artwork_id,
        consent_id: consentRecord.id
      }
    });

    const response: SubmissionResponse = {
      id: submissionId,
      status: 'pending',
      message: 'Artwork edit submitted successfully and is pending review',
      submission_type: 'artwork_edit'
    };

    return c.json(createSuccessResponse(response), 201);

  } catch (error) {
    console.error('Error creating artwork edit submission:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to create artwork edit submission',
      'SUBMISSION_CREATION_FAILED',
      500,
      { details: { error: error instanceof Error ? error.message : 'Unknown error' } }
    );
  }
}

// ================================
// New Artwork Submission Handler
// ================================

/**
 * POST /api/submissions/new-artwork - Submit New Artwork
 */
export async function createNewArtworkSubmissionHandler(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  const validatedData = getValidatedData<NewArtworkSubmissionRequest>(c, 'body');
  const validatedFiles = getValidatedFiles(c);

  try {
    // Rate limiting check - only if enabled
    if (isRateLimitingEnabled(c.env)) {
      await recordUserActivity(c.env.DB, userToken, 'user_token', 'submission');

      // Check daily submission limit (10 per day)
      const dailySubmissions = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM user_activity 
        WHERE identifier = ? AND activity_type = 'submission' 
        AND window_start = date('now', 'start of day')
      `).bind(userToken).first<{count: number}>();

      if (dailySubmissions && dailySubmissions.count >= 10) {
        throw new ApiError(
          'Too many submissions. Please wait a moment before trying again.',
          'RATE_LIMIT_EXCEEDED',
          429
        );
      }
    }

    // Record consent
    const contentId = generateUUID();
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
    const consentVersion = validatedData.consent_version || CONSENT_VERSION;
    const consentTextHash = await generateConsentTextHash(
      `Cultural Archiver Consent v${consentVersion} - New Artwork Submission`
    );

    const consentRecord = await recordConsent({
      anonymousToken: userToken,
      contentType: 'artwork' as const,
      contentId,
      consentVersion,
      ipAddress: clientIP,
      consentTextHash,
      db: c.env.DB,
    });

    // Process photos
    let photoUrls: string[] = [];
    if (validatedFiles.length > 0) {
      const photoResults = await processAndUploadPhotos(c.env, validatedFiles, contentId);
      photoUrls = photoResults.map(result => result.originalUrl);
    }

    // Check for nearby artworks
    const nearbyArtworks = await findNearbyArtworks(
      c.env.DB,
      validatedData.lat,
      validatedData.lon,
      DEFAULT_ARTWORK_SEARCH_RADIUS
    );

    // Prepare new artwork data
    const newArtworkData = {
      title: validatedData.title,
      year_created: validatedData.year_created || null,
      medium: validatedData.medium || null,
      dimensions: validatedData.dimensions || null,
      lat: validatedData.lat,
      lon: validatedData.lon,
      neighborhood: validatedData.neighborhood || null,
      city: validatedData.city || null,
      region: validatedData.region || null,
      country: validatedData.country || null,
      description: validatedData.description || null,
      photos: photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
      tags: validatedData.tags ? JSON.stringify(validatedData.tags) : null,
      source_type: 'user_submission',
      source_id: contentId
    };

    // Create new artwork submission
    const newArtworkSubmissionData: Parameters<typeof createNewArtworkSubmission>[1] = {
      userToken,
      lat: validatedData.lat,
      lon: validatedData.lon,
      notes: `New artwork submission: ${validatedData.title}`,
      photos: photoUrls,
      newData: newArtworkData
    };

    if (validatedData.tags) {
      newArtworkSubmissionData.tags = validatedData.tags;
    }

    const submissionId = await createNewArtworkSubmission(c.env.DB, newArtworkSubmissionData);

    // Audit log
    const userAgent = c.req.header('User-Agent') || 'Unknown';
    await createAuditLog(c.env.DB, {
      entityType: 'submission',
      entityId: submissionId,
      action: 'create',
      userToken,
      ipAddress: clientIP,
      userAgent,
      newData: newArtworkData,
      metadata: {
        submission_type: 'new_artwork',
        has_photos: photoUrls.length > 0,
        consent_id: consentRecord.id
      }
    });

    const response: SubmissionResponse = {
      id: submissionId,
      status: 'pending',
      message: 'New artwork submitted successfully and is pending review',
      submission_type: 'new_artwork',
      nearby_artworks: nearbyArtworks.map(artwork => ({
        id: artwork.id,
        title: artwork.title || 'Untitled',
        distance_meters: Math.round(artwork.distance_km * 1000),
        lat: artwork.lat,
        lon: artwork.lon
      }))
    };

    return c.json(createSuccessResponse(response), 201);

  } catch (error) {
    console.error('Error creating new artwork submission:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to create new artwork submission',
      'SUBMISSION_CREATION_FAILED',
      500,
      { details: { error: error instanceof Error ? error.message : 'Unknown error' } }
    );
  }
}

// ================================
// Submission Management Handlers
// ================================

/**
 * GET /api/submissions - List submissions with filtering
 */
export async function listSubmissions(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  
  try {
    // Check permissions
    const canReview = await hasPermission(c.env.DB, userToken, 'submissions.view');
    if (!canReview) {
      throw new ApiError(
        'Insufficient permissions to view submissions',
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }

    // Parse query parameters
    const status = c.req.query('status') as 'pending' | 'approved' | 'rejected' | undefined;
    const submissionType = c.req.query('type') as 'logbook_entry' | 'artwork_edit' | 'new_artwork' | undefined;
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    // Get submissions
    const submissions = await getSubmissionsByStatus(
      c.env.DB,
      status || 'pending',
      submissionType,
      limit,
      offset
    );

    return c.json(createSuccessResponse({
      submissions,
      pagination: {
        limit,
        offset,
        total: submissions.length
      }
    }));

  } catch (error) {
    console.error('Error listing submissions:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to list submissions',
      'SUBMISSION_LIST_FAILED',
      500,
      { details: { error: error instanceof Error ? error.message : 'Unknown error' } }
    );
  }
}

/**
 * POST /api/submissions/:id/approve - Approve submission
 */
export async function approveSubmissionHandler(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  const submissionId = c.req.param('id');
  const { review_notes } = await c.req.json() as { review_notes?: string };

  try {
    // Check permissions
    const canApprove = await hasPermission(c.env.DB, userToken, 'submissions.approve');
    if (!canApprove) {
      throw new ApiError(
        'Insufficient permissions to approve submissions',
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }

    // Approve the submission
    const success = await approveSubmission(
      c.env.DB,
      submissionId,
      userToken,
      review_notes
    );

    if (!success) {
      throw new ApiError(
        'Failed to approve submission',
        'APPROVAL_FAILED',
        500
      );
    }

    // Audit log
    await createAuditLog(c.env.DB, {
      entityType: 'submission',
      entityId: submissionId,
      action: 'approve',
      userToken,
      metadata: {
        review_notes,
        approved_at: new Date().toISOString()
      }
    });

    return c.json(createSuccessResponse({
      message: 'Submission approved successfully',
      submission_id: submissionId
    }));

  } catch (error) {
    console.error('Error approving submission:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to approve submission',
      'APPROVAL_FAILED',
      500,
      { details: { error: error instanceof Error ? error.message : 'Unknown error' } }
    );
  }
}

/**
 * POST /api/submissions/:id/reject - Reject submission
 */
export async function rejectSubmissionHandler(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  const submissionId = c.req.param('id');
  const { review_notes } = await c.req.json() as { review_notes?: string };

  try {
    // Check permissions
    const canReject = await hasPermission(c.env.DB, userToken, 'submissions.reject');
    if (!canReject) {
      throw new ApiError(
        'Insufficient permissions to reject submissions',
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }

    // Reject the submission
    const success = await rejectSubmission(
      c.env.DB,
      submissionId,
      userToken,
      review_notes
    );

    if (!success) {
      throw new ApiError(
        'Failed to reject submission',
        'REJECTION_FAILED',
        500
      );
    }

    // Audit log
    await createAuditLog(c.env.DB, {
      entityType: 'submission',
      entityId: submissionId,
      action: 'reject',
      userToken,
      metadata: {
        review_notes,
        rejected_at: new Date().toISOString()
      }
    });

    return c.json(createSuccessResponse({
      message: 'Submission rejected successfully',
      submission_id: submissionId
    }));

  } catch (error) {
    console.error('Error rejecting submission:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to reject submission',
      'REJECTION_FAILED',
      500,
      { details: { error: error instanceof Error ? error.message : 'Unknown error' } }
    );
  }
}

// ================================
// Helper Functions
// ================================

async function findNearbyArtworks(
  db: D1Database,
  lat: number,
  lon: number,
  radiusMeters: number = 500
): Promise<Array<{id: string, title: string, lat: number, lon: number, distance_km: number}>> {
  const latDelta = radiusMeters / 111320;
  const lonDelta = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));

  const results = await db.prepare(`
    SELECT id, title, lat, lon,
           (6371 * acos(cos(radians(?)) * cos(radians(lat)) * 
           cos(radians(lon) - radians(?)) + sin(radians(?)) * sin(radians(lat)))) as distance_km
    FROM artwork 
    WHERE lat BETWEEN ? AND ? 
    AND lon BETWEEN ? AND ?
    AND status = 'approved'
    HAVING distance_km <= ?
    ORDER BY distance_km
    LIMIT 10
  `).bind(
    lat, lon, lat,
    lat - latDelta, lat + latDelta,
    lon - lonDelta, lon + lonDelta,
    radiusMeters / 1000
  ).all<{id: string, title: string, lat: number, lon: number, distance_km: number}>();

  return results.results || [];
}