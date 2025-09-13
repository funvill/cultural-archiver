/**
 * Unified Submissions API - Handles all submission types in one consolidated endpoint
 * Replaces separate logbook and artwork_edits tables with a single submissions table
 * 
 * Submission Types:
 * - new_artwork: New artwork submissions (replaces logbook entries for new artwork)
 * - edit_artwork: Artwork edit submissions (replaces artwork_edits table)
 * - additional_info: Community contributions to existing artwork (replaces logbook entries linked to artwork)
 */

import type { Context } from 'hono';
import type {
  WorkerEnv,
  UnifiedSubmissionRequest,
  UnifiedSubmissionResponse,
  SubmissionRecord,
  NewArtworkSubmission,
  EditArtworkSubmission,
  AdditionalInfoSubmission,
  NearbyArtworkInfo,
  SubmissionsListResponse,
  SubmissionApiResponse,
} from '../types';
import { createDatabaseService } from '../lib/database';
import { createSuccessResponse, ValidationApiError, ApiError } from '../lib/errors';
import { validatePhotoFiles, processAndUploadPhotos } from '../lib/photos';
import { getUserToken } from '../middleware/auth';
import { safeJsonParse } from '../lib/errors';
import { generateUUID } from '../lib/database';

// Import the consent system
import { recordConsent, generateConsentTextHash } from '../lib/consent-new';
import { CONSENT_VERSION } from '../../shared/consent';

/**
 * POST /api/submissions - Unified submission endpoint
 * Handles new_artwork, edit_artwork, and additional_info submission types
 */
export async function createUnifiedSubmission(c: Context<{ Bindings: WorkerEnv }>) {
  try {
    const userToken = getUserToken(c);
    const db = createDatabaseService(c.env.DB);

    // Parse form data
    const formData = await c.req.formData();
    const submissionType = formData.get('submission_type') as string;
    
    // Validate submission type
    if (!submissionType || !['new_artwork', 'edit_artwork', 'additional_info'].includes(submissionType)) {
      throw new ValidationApiError([{
        field: 'submission_type',
        message: 'Must be one of: new_artwork, edit_artwork, additional_info',
        code: 'invalid_enum'
      }]);
    }

    // Parse the unified submission request
    const submissionData: UnifiedSubmissionRequest = {
      submission_type: submissionType as any,
      // Common fields
      note: formData.get('note') as string || undefined,
      title: formData.get('title') as string || undefined,
      description: formData.get('description') as string || undefined,
      created_by: formData.get('created_by') as string || undefined,
    };

    // Parse type-specific fields
    if (submissionType === 'new_artwork') {
      const lat = parseFloat(formData.get('lat') as string);
      const lon = parseFloat(formData.get('lon') as string);
      const type_id = formData.get('type_id') as string;

      if (isNaN(lat) || isNaN(lon) || !type_id) {
        throw new ValidationApiError([
          { field: 'lat', message: 'Valid latitude required for new artwork', code: 'required' },
          { field: 'lon', message: 'Valid longitude required for new artwork', code: 'required' },
          { field: 'type_id', message: 'Artwork type required for new artwork', code: 'required' }
        ]);
      }

      submissionData.lat = lat;
      submissionData.lon = lon;
      submissionData.type_id = type_id;
    } else if (submissionType === 'edit_artwork') {
      const target_artwork_id = formData.get('target_artwork_id') as string;
      const field_changes_str = formData.get('field_changes') as string;

      if (!target_artwork_id || !field_changes_str) {
        throw new ValidationApiError([
          { field: 'target_artwork_id', message: 'Target artwork ID required for edits', code: 'required' },
          { field: 'field_changes', message: 'Field changes required for edits', code: 'required' }
        ]);
      }

      let field_changes;
      try {
        field_changes = JSON.parse(field_changes_str);
      } catch (error) {
        throw new ValidationApiError([{
          field: 'field_changes',
          message: 'Field changes must be valid JSON',
          code: 'invalid_format'
        }]);
      }

      submissionData.target_artwork_id = target_artwork_id;
      submissionData.field_changes = field_changes;
    } else if (submissionType === 'additional_info') {
      const target_artwork_id = formData.get('target_artwork_id') as string;

      if (!target_artwork_id) {
        throw new ValidationApiError([{
          field: 'target_artwork_id',
          message: 'Target artwork ID required for additional info',
          code: 'required'
        }]);
      }

      submissionData.target_artwork_id = target_artwork_id;
    }

    // Parse tags if provided
    const tagsStr = formData.get('tags') as string;
    if (tagsStr) {
      try {
        submissionData.tags = JSON.parse(tagsStr);
      } catch (error) {
        throw new ValidationApiError([{
          field: 'tags',
          message: 'Tags must be valid JSON object',
          code: 'invalid_format'
        }]);
      }
    }

    // Validate and process photos
    const photoFiles: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('photo') && value instanceof File) {
        photoFiles.push(value);
      }
    }

    if (photoFiles.length > 0) {
      validatePhotoFiles(photoFiles);
      submissionData.photos = photoFiles;
    }

    // STEP 1: Record consent first (required before submission)
    const submissionId = generateUUID();
    const consentVersion = formData.get('consent_version') as string || CONSENT_VERSION;
    const consentTextHash = generateConsentTextHash({
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true,
    });

    const consentParams = {
      anonymousToken: userToken,
      contentType: 'submission' as any, // Will update this type
      contentId: submissionId,
      consentVersion,
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '0.0.0.0',
      consentTextHash,
      db: c.env.DB,
    };

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

    // STEP 2: Check for nearby artworks (for new_artwork submissions)
    let nearbyArtworks: NearbyArtworkInfo[] = [];
    if (submissionType === 'new_artwork' && submissionData.lat && submissionData.lon) {
      const nearby = await db.findNearbyArtworks(
        submissionData.lat,
        submissionData.lon,
        500, // 500m radius for duplicate detection
        5 // Limit to 5 nearby artworks
      );

      nearbyArtworks = nearby.map(artwork => ({
        id: artwork.id,
        lat: artwork.lat,
        lon: artwork.lon,
        type_name: artwork.type_name,
        distance_meters: Math.round(artwork.distance_km * 1000),
        photos: safeJsonParse<string[]>(artwork.tags, []),
      }));
    }

    // STEP 3: Create submission record
    const now = new Date().toISOString();
    const submissionRecord: Partial<SubmissionRecord> = {
      id: submissionId,
      user_token: userToken,
      submission_type: submissionType as any,
      // Location fields (for new_artwork)
      lat: submissionData.lat || null,
      lon: submissionData.lon || null,
      type_id: submissionData.type_id || null,
      // Target reference (for edits/additional_info)
      target_artwork_id: submissionData.target_artwork_id || null,
      // Content fields
      note: submissionData.note || null,
      photos: '[]', // Will be updated after photo processing
      tags: submissionData.tags ? JSON.stringify(submissionData.tags) : '{}',
      title: submissionData.title || null,
      description: submissionData.description || null,
      created_by: submissionData.created_by || null,
      // Edit-specific data
      field_changes: submissionData.field_changes ? JSON.stringify(submissionData.field_changes) : null,
      // Moderation workflow
      status: 'pending',
      moderator_notes: null,
      reviewed_at: null,
      reviewed_by: null,
      // Audit trail
      created_at: now,
      updated_at: now,
    };

    // Insert submission into database
    const insertStmt = c.env.DB.prepare(`
      INSERT INTO submissions (
        id, user_token, submission_type, lat, lon, type_id, target_artwork_id,
        note, photos, tags, title, description, created_by, field_changes,
        status, moderator_notes, reviewed_at, reviewed_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await insertStmt.bind(
      submissionRecord.id,
      submissionRecord.user_token,
      submissionRecord.submission_type,
      submissionRecord.lat,
      submissionRecord.lon,
      submissionRecord.type_id,
      submissionRecord.target_artwork_id,
      submissionRecord.note,
      submissionRecord.photos,
      submissionRecord.tags,
      submissionRecord.title,
      submissionRecord.description,
      submissionRecord.created_by,
      submissionRecord.field_changes,
      submissionRecord.status,
      submissionRecord.moderator_notes,
      submissionRecord.reviewed_at,
      submissionRecord.reviewed_by,
      submissionRecord.created_at,
      submissionRecord.updated_at
    ).run();

    // STEP 4: Process photos if any were uploaded
    let photoUrls: string[] = [];
    if (photoFiles.length > 0) {
      photoUrls = await processAndUploadPhotos(c.env, photoFiles, submissionId);

      // Update submission with photo URLs
      const updateStmt = c.env.DB.prepare(`
        UPDATE submissions SET photos = ?, updated_at = ? WHERE id = ?
      `);
      await updateStmt.bind(
        JSON.stringify(photoUrls),
        new Date().toISOString(),
        submissionId
      ).run();
    }

    // STEP 5: Create response
    const response: UnifiedSubmissionResponse = {
      id: submissionId,
      submission_type: submissionType as any,
      status: 'pending',
      message: `${submissionType.replace('_', ' ')} submission received and is pending review`,
    };

    // Add type-specific response data
    if (submissionType === 'new_artwork' && nearbyArtworks.length > 0) {
      response.nearby_artworks = nearbyArtworks;
    } else if ((submissionType === 'edit_artwork' || submissionType === 'additional_info') && submissionData.target_artwork_id) {
      // Get target artwork info
      try {
        const targetArtwork = await db.getArtworkById(submissionData.target_artwork_id);
        if (targetArtwork) {
          response.target_artwork = {
            id: targetArtwork.id,
            title: targetArtwork.title || null,
            location: { lat: targetArtwork.lat, lon: targetArtwork.lon },
          };
        }
      } catch (error) {
        console.warn('Failed to fetch target artwork info:', error);
      }
    }

    console.info('Unified submission completed successfully:', {
      submissionId,
      submissionType,
      consentId: consentRecord.id,
      userToken,
      photoCount: photoUrls.length,
      hasNearbyArtworks: nearbyArtworks.length > 0,
    });

    return c.json(createSuccessResponse(response), 201);
  } catch (error) {
    console.error('Unified submission failed:', error);
    
    if (error instanceof ValidationApiError || error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to process submission',
      'SUBMISSION_FAILED',
      500,
      { details: { error: error instanceof Error ? error.message : 'Unknown error' } }
    );
  }
}

/**
 * GET /api/submissions - List submissions with filtering
 * Admin/moderator endpoint to view all submissions or user endpoint to view their own
 */
export async function getSubmissionsList(c: Context<{ Bindings: WorkerEnv }>) {
  try {
    const userToken = getUserToken(c);
    const { searchParams } = new URL(c.req.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const per_page = Math.min(parseInt(searchParams.get('per_page') || '20'), 100);
    const submission_type = searchParams.get('submission_type');
    const status = searchParams.get('status');
    const user_filter = searchParams.get('user_token'); // Admin only
    
    // Check if user is admin/moderator (simplified for now)
    const isAdmin = false; // TODO: Implement proper admin check
    
    // Build query
    let whereClause = 'WHERE 1=1';
    const bindings: any[] = [];
    
    // Non-admin users can only see their own submissions
    if (!isAdmin) {
      whereClause += ' AND user_token = ?';
      bindings.push(userToken);
    } else if (user_filter) {
      whereClause += ' AND user_token = ?';
      bindings.push(user_filter);
    }
    
    if (submission_type && ['new_artwork', 'edit_artwork', 'additional_info'].includes(submission_type)) {
      whereClause += ' AND submission_type = ?';
      bindings.push(submission_type);
    }
    
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      whereClause += ' AND status = ?';
      bindings.push(status);
    }
    
    // Count total matching submissions
    const countStmt = c.env.DB.prepare(`
      SELECT COUNT(*) as total FROM submissions ${whereClause}
    `);
    const countResult = await countStmt.bind(...bindings).first() as { total: number } | null;
    const total = countResult?.total || 0;
    
    // Get submissions with pagination
    const offset = (page - 1) * per_page;
    const selectStmt = c.env.DB.prepare(`
      SELECT * FROM submissions 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const results = await selectStmt.bind(...bindings, per_page, offset).all();
    const submissions = results.results as SubmissionRecord[];
    
    // Parse JSON fields and create API response format
    const submissionsApi: SubmissionApiResponse[] = submissions.map(submission => ({
      ...submission,
      photos_parsed: safeJsonParse<string[]>(submission.photos || '[]', []),
      tags_parsed: safeJsonParse<Record<string, unknown>>(submission.tags || '{}', {}),
      field_changes_parsed: submission.field_changes 
        ? safeJsonParse<Record<string, { old: string | null; new: string | null }>>(submission.field_changes, {})
        : undefined,
    }));
    
    const response: SubmissionsListResponse = {
      submissions: submissionsApi,
      total,
      page,
      per_page,
      has_more: offset + per_page < total,
    };
    
    return c.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Failed to get submissions list:', error);
    throw new ApiError(
      'Failed to retrieve submissions',
      'SUBMISSIONS_FETCH_FAILED',
      500,
      { details: { error: error instanceof Error ? error.message : 'Unknown error' } }
    );
  }
}

/**
 * GET /api/submissions/:id - Get single submission by ID
 */
export async function getSubmissionById(c: Context<{ Bindings: WorkerEnv }>) {
  try {
    const userToken = getUserToken(c);
    const submissionId = c.req.param('id');
    
    if (!submissionId) {
      throw new ValidationApiError([{
        field: 'id',
        message: 'Submission ID is required',
        code: 'required'
      }]);
    }
    
    // Get submission
    const stmt = c.env.DB.prepare(`
      SELECT * FROM submissions WHERE id = ?
    `);
    const submission = await stmt.bind(submissionId).first() as SubmissionRecord | null;
    
    if (!submission) {
      throw new ApiError('Submission not found', 'SUBMISSION_NOT_FOUND', 404);
    }
    
    // Check permission - users can only see their own submissions unless they're admin
    const isAdmin = false; // TODO: Implement proper admin check
    if (!isAdmin && submission.user_token !== userToken) {
      throw new ApiError('Access denied', 'ACCESS_DENIED', 403);
    }
    
    // Parse JSON fields and create API response
    const submissionApi: SubmissionApiResponse = {
      ...submission,
      photos_parsed: safeJsonParse<string[]>(submission.photos || '[]', []),
      tags_parsed: safeJsonParse<Record<string, unknown>>(submission.tags || '{}', {}),
      field_changes_parsed: submission.field_changes 
        ? safeJsonParse<Record<string, { old: string | null; new: string | null }>>(submission.field_changes, {})
        : undefined,
    };
    
    return c.json(createSuccessResponse(submissionApi));
  } catch (error) {
    console.error('Failed to get submission:', error);
    
    if (error instanceof ValidationApiError || error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to retrieve submission',
      'SUBMISSION_FETCH_FAILED',
      500,
      { details: { error: error instanceof Error ? error.message : 'Unknown error' } }
    );
  }
}