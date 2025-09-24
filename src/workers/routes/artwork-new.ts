/**
 * Artwork route handlers - Updated for New Unified Schema
 * Handles artwork-related endpoints using the new unified submissions table
 *
 * UPDATED: Uses new submissions service instead of legacy artwork-edits table
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { createSuccessResponse, ValidationApiError, NotFoundError, ApiError } from '../lib/errors';
import { getUserToken } from '../middleware/auth';
import { CONSENT_VERSION } from '../../shared/consent';

// Import new unified services
import { createArtworkEdit } from '../lib/submissions.js';
import { recordUserActivity } from '../lib/user-activity.js';
import { createAuditLog } from '../lib/audit-log.js';
import { hasPermission } from '../lib/user-roles.js';
import { recordConsent, generateConsentTextHash } from '../lib/consent-new.js';

// ================================
// Request/Response Types
// ================================

interface ArtworkEditRequest {
  field_name: string;
  field_value_old: unknown;
  field_value_new: unknown;
  notes?: string;
  consent_version?: string;
}

interface SubmitArtworkEditRequest {
  edits: ArtworkEditRequest[];
  notes?: string;
  consent_version?: string;
}

interface ArtworkEditResponse {
  submission_id: string;
  artwork_id: string;
  edits_count: number;
  status: 'pending';
  message: string;
}

interface PendingEditsResponse {
  pending_edits: Array<{
    id: string;
    field_name: string;
    old_value: unknown;
    new_value: unknown;
    submitted_at: string;
    status: 'pending' | 'approved' | 'rejected';
  }>;
  total_count: number;
}

// ================================
// Main Route Handlers
// ================================

/**
 * POST /api/artwork/:id/edit - Submit artwork edit proposals
 */
export async function submitArtworkEdit(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  const artworkId = c.req.param('id');

  if (!artworkId) {
    throw new ValidationApiError([
      {
        field: 'artwork_id',
        message: 'Artwork ID is required',
        code: 'REQUIRED_FIELD',
      },
    ]);
  }

  try {
    // Parse and validate request body
    const requestBody = (await c.req.json().catch(() => {
      throw new ValidationApiError([
        {
          field: 'request_body',
          message: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
        },
      ]);
    })) as SubmitArtworkEditRequest;

    // Validate required fields
    if (!requestBody.edits || !Array.isArray(requestBody.edits)) {
      throw new ValidationApiError([
        {
          field: 'edits',
          message: 'edits array is required',
          code: 'REQUIRED_FIELD',
        },
      ]);
    }

    if (requestBody.edits.length === 0) {
      throw new ValidationApiError([
        {
          field: 'edits',
          message: 'At least one edit is required',
          code: 'ARRAY_MIN_LENGTH',
        },
      ]);
    }

    // Validate each edit
    const allowedFields = [
      'title',
      'description',
      'artist_names',
      'year_created',
      'medium',
      'dimensions',
      'tags',
    ];
    for (const edit of requestBody.edits) {
      if (!edit.field_name || typeof edit.field_name !== 'string') {
        throw new ValidationApiError([
          {
            field: 'field_name',
            message: 'Each edit must have a field_name',
            code: 'REQUIRED_FIELD',
          },
        ]);
      }

      if (!allowedFields.includes(edit.field_name)) {
        throw new ValidationApiError([
          {
            field: 'field_name',
            message: `Invalid field name: ${edit.field_name}. Allowed: ${allowedFields.join(', ')}`,
            code: 'INVALID_FIELD_NAME',
          },
        ]);
      }

      if (!('field_value_old' in edit) || !('field_value_new' in edit)) {
        throw new ValidationApiError([
          {
            field: 'field_values',
            message: 'Both field_value_old and field_value_new are required',
            code: 'REQUIRED_FIELD',
          },
        ]);
      }
    }

    // Check if user has permission to edit artworks
    const canEdit = await hasPermission(c.env.DB, userToken, 'artwork.edit');
    if (!canEdit) {
      // Rate limit for non-privileged users
      await recordUserActivity(c.env.DB, userToken, 'user_token', 'submission');
    }

    // Check if artwork exists
    const artworkExists = await c.env.DB.prepare(
      `
      SELECT id, title, artist_names, year_created, medium, dimensions, description, tags 
      FROM artwork WHERE id = ?
    `
    )
      .bind(artworkId)
      .first();

    if (!artworkExists) {
      throw new NotFoundError('Artwork not found');
    }

    // Record consent
    const clientIP =
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
    const consentVersion = requestBody.consent_version || CONSENT_VERSION;
    const consentTextHash = await generateConsentTextHash(
      `Cultural Archiver Consent v${consentVersion} - Artwork Edit`
    );

    const consentRecord = await recordConsent({
      userId: userToken,
      contentType: 'artwork' as const,
      contentId: artworkId,
      consentVersion,
      ipAddress: clientIP,
      consentTextHash,
      db: c.env.DB,
    });

    // Build old and new data objects
    const oldData: Record<string, unknown> = {};
    const newData: Record<string, unknown> = {};

    for (const edit of requestBody.edits) {
      oldData[edit.field_name] = edit.field_value_old;
      newData[edit.field_name] = edit.field_value_new;
    }

    // Create artwork edit submission using the new submissions service
    const artworkEditData: Parameters<typeof createArtworkEdit>[1] = {
      userToken,
      artworkId,
      oldData,
      newData,
    };

    if (requestBody.notes) {
      artworkEditData.notes = requestBody.notes;
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
      oldData,
      newData,
      metadata: {
        submission_type: 'artwork_edit',
        artwork_id: artworkId,
        edits_count: requestBody.edits.length,
        consent_id: consentRecord.id,
      },
    });

    const response: ArtworkEditResponse = {
      submission_id: submissionId,
      artwork_id: artworkId,
      edits_count: requestBody.edits.length,
      status: 'pending',
      message: 'Artwork edit submitted successfully and is pending review',
    };

    return c.json(createSuccessResponse(response), 201);
  } catch (error) {
    console.error('Error submitting artwork edit:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to submit artwork edit', 'ARTWORK_EDIT_FAILED', 500, {
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

/**
 * GET /api/artwork/:id/pending-edits - Get user's pending edits for artwork
 */
export async function getPendingEdits(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  const artworkId = c.req.param('id');

  if (!artworkId) {
    throw new ValidationApiError([
      {
        field: 'artwork_id',
        message: 'Artwork ID is required',
        code: 'REQUIRED_FIELD',
      },
    ]);
  }

  try {
    // Get pending artwork edit submissions for this user and artwork
    const pendingSubmissions = await c.env.DB.prepare(
      `
      SELECT id, old_data, new_data, created_at, status, notes
      FROM submissions
      WHERE submission_type = 'artwork_edit' 
      AND artwork_id = ? 
      AND user_token = ?
      AND status IN ('pending', 'approved', 'rejected')
      ORDER BY created_at DESC
    `
    )
      .bind(artworkId, userToken)
      .all();

    const pendingEdits = [];

    if (pendingSubmissions.results) {
      for (const submission of pendingSubmissions.results) {
        const sub = submission as {
          id: string;
          old_data: string | null;
          new_data: string | null;
          created_at: string;
          status: string;
        };
        const oldData = sub.old_data ? JSON.parse(sub.old_data) : {};
        const newData = sub.new_data ? JSON.parse(sub.new_data) : {};

        // Convert the old/new data format back to individual field edits
        for (const fieldName of Object.keys(newData)) {
          pendingEdits.push({
            id: sub.id,
            field_name: fieldName,
            old_value: oldData[fieldName],
            new_value: newData[fieldName],
            submitted_at: sub.created_at,
            status: sub.status as 'pending' | 'approved' | 'rejected',
          });
        }
      }
    }

    const response: PendingEditsResponse = {
      pending_edits: pendingEdits,
      total_count: pendingEdits.length,
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Error getting pending edits:', error);

    throw new ApiError('Failed to retrieve pending edits', 'PENDING_EDITS_FAILED', 500, {
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

/**
 * GET /api/artwork/:id - Get artwork details
 */
export async function getArtworkDetails(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const artworkId = c.req.param('id');

  if (!artworkId) {
    throw new ValidationApiError([
      {
        field: 'artwork_id',
        message: 'Artwork ID is required',
        code: 'REQUIRED_FIELD',
      },
    ]);
  }

  try {
    // Get artwork details
    const artwork = await c.env.DB.prepare(
      `
      SELECT id, title, artist_names, year_created, medium, dimensions,
             lat, lon, neighborhood, city, region, country,
             description, photos, tags, status, source_type, source_id,
             created_at, updated_at
      FROM artwork 
      WHERE id = ? AND status = 'approved'
    `
    )
      .bind(artworkId)
      .first();

    if (!artwork) {
      throw new NotFoundError('Artwork not found');
    }

    // Parse JSON fields
    const artworkData = artwork as {
      id: string;
      title: string;
      artist_names: string | null;
      year_created: number | null;
      medium: string | null;
      dimensions: string | null;
      lat: number;
      lon: number;
      neighborhood: string | null;
      city: string | null;
      region: string | null;
      country: string | null;
      description: string | null;
      photos: string | null;
      tags: string | null;
      status: string;
      source_type: string;
      source_id: string | null;
      created_at: string;
      updated_at: string;
    };

    const result: Record<string, unknown> = { ...artworkData };

    if (artworkData.photos) {
      result.photos = JSON.parse(artworkData.photos);
    }
    if (artworkData.tags) {
      result.tags = JSON.parse(artworkData.tags);
    }

    return c.json(createSuccessResponse(result));
  } catch (error) {
    console.error('Error getting artwork details:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve artwork details', 'ARTWORK_DETAILS_FAILED', 500, {
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

/**
 * GET /api/artwork/:id/export/osm - Export artwork in OpenStreetMap format
 */
export async function exportArtworkOSM(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const artworkId = c.req.param('id');

  if (!artworkId) {
    throw new ValidationApiError([
      {
        field: 'artwork_id',
        message: 'Artwork ID is required',
        code: 'REQUIRED_FIELD',
      },
    ]);
  }

  try {
    // Get artwork details
    const artwork = await c.env.DB.prepare(
      `
      SELECT id, title, artist_names, year_created, medium,
             lat, lon, description, tags
      FROM artwork 
      WHERE id = ? AND status = 'approved'
    `
    )
      .bind(artworkId)
      .first();

    if (!artwork) {
      throw new NotFoundError('Artwork not found');
    }

    const artworkData = artwork as {
      id: string;
      title: string | null;
      artist_names: string | null;
      year_created: number | null;
      medium: string | null;
      lat: number;
      lon: number;
      description: string | null;
      tags: string | null;
    };

    // Parse tags if they exist
    let tags: Record<string, string> = {};
    if (artworkData.tags) {
      tags = JSON.parse(artworkData.tags);
    }

    // Build OSM XML format with proper types
    const osmTags: Record<string, string> = {
      tourism: 'artwork',
      name: artworkData.title || '',
      artist_name: artworkData.artist_names || '',
      start_date: artworkData.year_created ? artworkData.year_created.toString() : '',
      material: artworkData.medium || '',
      description: artworkData.description || '',
      ...tags, // Include any additional tags
    };

    // Remove empty tags
    Object.keys(osmTags).forEach(key => {
      if (!osmTags[key]) {
        delete osmTags[key];
      }
    });

    const osmData = {
      node: {
        id: -1, // Negative ID for new nodes
        lat: artworkData.lat,
        lon: artworkData.lon,
        tags: osmTags,
      },
    };

    // Generate XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="Cultural Archiver">
  <node id="${osmData.node.id}" lat="${osmData.node.lat}" lon="${osmData.node.lon}">
${Object.entries(osmData.node.tags)
  .map(([key, value]) => `    <tag k="${key}" v="${value}"/>`)
  .join('\n')}
  </node>
</osm>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="artwork_${artworkId}.osm"`,
      },
    });
  } catch (error) {
    console.error('Error exporting artwork to OSM:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to export artwork to OSM format', 'OSM_EXPORT_FAILED', 500, {
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}
