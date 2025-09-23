/**
 * Artwork editing route handlers
 *
 * Provides endpoints for community editing of artwork details:
 * - POST /api/artwork/{id}/edit - Submit edit proposals
 * - GET /api/artwork/{id}/pending-edits - Check user's pending edits
 * - GET /api/artwork/{id}/export/osm - Export artwork in OpenStreetMap format
 */

import type { Context } from 'hono';
import type { ArtworkEditSubmissionResponse, PendingEditsResponse } from '../../shared/types';
import type { ArtworkRecord, WorkerEnv } from '../types'; // Use local workers type
import { isRateLimitingEnabled } from '../types';
import {
  getUserPendingArtworkEdits,
  getUserSubmissionCount,
  createArtworkEditFromFields,
} from '../lib/submissions';
import { createSuccessResponse, ValidationApiError, NotFoundError } from '../lib/errors';
import { getUserToken } from '../middleware/auth';
import { validateOSMExportData, createExportResponse, generateOSMXMLFile } from '../lib/osm-export';

/**
 * POST /api/artwork/:id/edit - Submit artwork edit proposals
 * Allows authenticated users to propose edits to artwork details
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

  // Get and validate request body
  const requestBody = await c.req.json().catch(() => {
    throw new ValidationApiError([
      {
        field: 'request_body',
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
      },
    ]);
  });

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

    // Validate allowed field names
    const allowedFields = ['title', 'description', 'created_by', 'tags'];
    if (!allowedFields.includes(edit.field_name)) {
      throw new ValidationApiError([
        {
          field: 'field_name',
          message: `Invalid field name: ${edit.field_name}. Allowed: ${allowedFields.join(', ')}`,
          code: 'INVALID_FIELD_NAME',
        },
      ]);
    }

    // field_value_old and field_value_new can be null, but must be provided
    if (!('field_value_old' in edit) || !('field_value_new' in edit)) {
      throw new ValidationApiError([
        {
          field: 'field_values',
          message: 'Each edit must have field_value_old and field_value_new properties',
          code: 'REQUIRED_FIELD',
        },
      ]);
    }
  }

  try {
    // Check rate limiting - 500 edits per 24 hours (only if rate limiting is enabled)
    if (isRateLimitingEnabled(c.env)) {
      const recentEditCount = await getUserSubmissionCount(c.env.DB, userToken, 'artwork_edit', 24);
      if (recentEditCount >= 500) {
        throw new ValidationApiError([
          {
            field: 'rate_limit',
            message: 'Rate limit exceeded. You can submit up to 500 edits per 24-hour period.',
            code: 'RATE_LIMIT_EXCEEDED',
          },
        ]);
      }
    }

    // Check if user already has pending edits for this artwork
    const existingPendingEdits = await getUserPendingArtworkEdits(c.env.DB, userToken, artworkId);
    if (existingPendingEdits.length > 0) {
      throw new ValidationApiError([
        {
          field: 'pending_edits',
          message:
            'You already have pending edits for this artwork. Please wait for them to be reviewed.',
          code: 'PENDING_EDITS_EXIST',
        },
      ]);
    }

    // Submit the edits using the new submissions system
    const submissionId = await createArtworkEditFromFields(c.env.DB, {
      userToken,
      artworkId,
      edits: requestBody.edits,
    });

    const response: ArtworkEditSubmissionResponse = {
      edit_ids: [submissionId], // Return submission ID as edit_ids for compatibility
      message: 'Your changes have been submitted for review',
      status: 'pending',
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError(`Artwork not found: ${artworkId}`);
    }
    throw error;
  }
}

/**
 * GET /api/artwork/:id/pending-edits - Check user's pending edits for artwork
 * Returns information about any pending edits the user has submitted
 */
export async function getUserPendingEdits(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
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
    const pendingEdits = await getUserPendingArtworkEdits(c.env.DB, userToken, artworkId);

    const response: PendingEditsResponse = {
      has_pending_edits: pendingEdits.length > 0,
      pending_fields: pendingEdits.flatMap(edit => {
        try {
          const newData = edit.new_data ? JSON.parse(edit.new_data) : {};
          return Object.keys(newData);
        } catch {
          return ['artwork_edit']; // fallback if JSON parsing fails
        }
      }),
    };

    if (pendingEdits.length > 0) {
      const firstEdit = pendingEdits[0];
      if (firstEdit?.created_at) {
        response.submitted_at = firstEdit.created_at;
      }
    }

    return c.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Failed to get user pending edits:', error);
    throw error;
  }
}

/**
 * POST /api/artwork/:id/edit/validate - Validate edit request without submitting
 * Useful for client-side validation feedback
 */
export async function validateArtworkEdit(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
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

  // Get and validate request body (same validation as submitArtworkEdit)
  const requestBody = await c.req.json().catch(() => {
    throw new ValidationApiError([
      {
        field: 'request_body',
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
      },
    ]);
  });

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

  const allowedFields = ['title', 'description', 'created_by', 'tags'];

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
          message: 'Each edit must have field_value_old and field_value_new properties',
          code: 'REQUIRED_FIELD',
        },
      ]);
    }
  }

  // Check if artwork exists
  const artworkExists = await c.env.DB.prepare('SELECT id FROM artwork WHERE id = ?')
    .bind(artworkId)
    .first();

  if (!artworkExists) {
    throw new NotFoundError(`Artwork not found: ${artworkId}`);
  }

  // Check rate limiting using submissions system (only if rate limiting is enabled)
  let recentEditCount = 0;
  if (isRateLimitingEnabled(c.env)) {
    recentEditCount = await getUserSubmissionCount(c.env.DB, userToken, 'artwork_edit', 24);
  }

  const response = {
    valid: true,
    message: 'Edit request is valid',
    rate_limit_info: {
      edits_used: recentEditCount,
      edits_remaining: Math.max(0, 500 - recentEditCount),
      rate_limit: 500,
      window_hours: 24,
      enabled: isRateLimitingEnabled(c.env),
    },
  };

  if (isRateLimitingEnabled(c.env) && recentEditCount >= 500) {
    return c.json(
      createSuccessResponse({
        ...response,
        valid: false,
        message: 'Rate limit exceeded. You can submit up to 500 edits per 24-hour period.',
      })
    );
  }

  return c.json(createSuccessResponse(response));
}

/**
 * GET /api/artwork/:id/export/osm - Export artwork in OpenStreetMap format
 * Generates OSM-compatible export of artwork data with structured tags
 */
export async function exportArtworkToOSM(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
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

  const query = c.req.query();
  const format = query.format || 'json'; // json, xml, or validation

  // Validate format parameter
  if (!['json', 'xml', 'validation'].includes(format)) {
    throw new ValidationApiError([
      {
        field: 'format',
        message: 'Invalid format. Supported: json, xml, validation',
        code: 'INVALID_PARAMETER',
      },
    ]);
  }

  // Get artwork data
  const artworkResult = await c.env.DB.prepare('SELECT * FROM artwork WHERE id = ? AND status = ?')
    .bind(artworkId, 'approved')
    .first();

  if (!artworkResult) {
    throw new NotFoundError(`Approved artwork not found: ${artworkId}`);
  }

  const artwork = artworkResult as unknown as ArtworkRecord;

  // Handle different export formats
  if (format === 'validation') {
    // Return validation results only
    const validation = validateOSMExportData(artwork);
    return c.json(
      createSuccessResponse({
        artwork_id: artworkId,
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
      })
    );
  }

  if (format === 'xml') {
    // Return OSM XML format
    try {
      const xmlContent = generateOSMXMLFile([artwork]);
      return new Response(xmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="artwork-${artworkId}.osm"`,
        },
      });
    } catch (error) {
      throw new ValidationApiError([
        {
          field: 'export',
          message: error instanceof Error ? error.message : 'Export failed',
          code: 'EXPORT_ERROR',
        },
      ]);
    }
  }

  // Default JSON format
  const exportRequest = {
    artwork_ids: [artworkId],
  };

  const response = createExportResponse([artwork], exportRequest);

  return c.json(createSuccessResponse(response));
}
