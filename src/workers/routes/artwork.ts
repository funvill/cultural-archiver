/**
 * Artwork editing route handlers
 *
 * Provides endpoints for community editing of artwork details:
 * - POST /api/artwork/{id}/edit - Submit edit proposals  
 * - GET /api/artwork/{id}/pending-edits - Check user's pending edits
 */

import type { Context } from 'hono';
import type { 
  WorkerEnv, 
  CreateArtworkEditRequest,
  ArtworkEditSubmissionResponse,
  PendingEditsResponse
} from '../types';
import { ArtworkEditsService } from '../lib/artwork-edits';
import { createSuccessResponse, ValidationApiError, NotFoundError } from '../lib/errors';
import { getUserToken } from '../middleware/auth';
import { getValidatedData } from '../middleware/validation';

/**
 * POST /api/artwork/:id/edit - Submit artwork edit proposals
 * Allows authenticated users to propose edits to artwork details
 */
export async function submitArtworkEdit(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  const artworkId = c.req.param('id');
  
  if (!artworkId) {
    throw new ValidationApiError('Artwork ID is required');
  }

  // Get and validate request body
  const requestBody = await c.req.json().catch(() => {
    throw new ValidationApiError('Invalid JSON in request body');
  });

  // Validate required fields
  if (!requestBody.edits || !Array.isArray(requestBody.edits)) {
    throw new ValidationApiError('edits array is required');
  }

  if (requestBody.edits.length === 0) {
    throw new ValidationApiError('At least one edit is required');
  }

  // Validate each edit
  for (const edit of requestBody.edits) {
    if (!edit.field_name || typeof edit.field_name !== 'string') {
      throw new ValidationApiError('Each edit must have a field_name');
    }

    // Validate allowed field names
    const allowedFields = ['title', 'description', 'created_by', 'tags'];
    if (!allowedFields.includes(edit.field_name)) {
      throw new ValidationApiError(`Invalid field name: ${edit.field_name}. Allowed: ${allowedFields.join(', ')}`);
    }

    // field_value_old and field_value_new can be null, but must be provided
    if (!('field_value_old' in edit) || !('field_value_new' in edit)) {
      throw new ValidationApiError('Each edit must have field_value_old and field_value_new properties');
    }
  }

  const artworkEditsService = new ArtworkEditsService(c.env.DB);

  try {
    // Check rate limiting - 500 edits per 24 hours
    const recentEditCount = await artworkEditsService.getUserPendingEditCount(userToken, 24);
    if (recentEditCount >= 500) {
      throw new ValidationApiError('Rate limit exceeded. You can submit up to 500 edits per 24-hour period.');
    }

    // Check if user already has pending edits for this artwork
    const existingPendingEdits = await artworkEditsService.getUserPendingEdits(userToken, artworkId);
    if (existingPendingEdits.length > 0) {
      throw new ValidationApiError('You already have pending edits for this artwork. Please wait for them to be reviewed.');
    }

    // Submit the edits
    const editRequest: CreateArtworkEditRequest = {
      artwork_id: artworkId,
      user_token: userToken,
      edits: requestBody.edits
    };

    const editIds = await artworkEditsService.submitArtworkEdit(editRequest);

    const response: ArtworkEditSubmissionResponse = {
      edit_ids: editIds,
      message: 'Your changes have been submitted for review',
      status: 'pending'
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
    throw new ValidationApiError('Artwork ID is required');
  }

  const artworkEditsService = new ArtworkEditsService(c.env.DB);

  try {
    const pendingEdits = await artworkEditsService.getUserPendingEdits(userToken, artworkId);
    
    const response: PendingEditsResponse = {
      has_pending_edits: pendingEdits.length > 0,
      pending_fields: pendingEdits.map(edit => edit.field_name),
      submitted_at: pendingEdits.length > 0 ? pendingEdits[0].submitted_at : undefined
    };

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
    throw new ValidationApiError('Artwork ID is required');
  }

  // Get and validate request body (same validation as submitArtworkEdit)
  const requestBody = await c.req.json().catch(() => {
    throw new ValidationApiError('Invalid JSON in request body');
  });

  if (!requestBody.edits || !Array.isArray(requestBody.edits)) {
    throw new ValidationApiError('edits array is required');
  }

  if (requestBody.edits.length === 0) {
    throw new ValidationApiError('At least one edit is required');
  }

  const allowedFields = ['title', 'description', 'created_by', 'tags'];
  
  for (const edit of requestBody.edits) {
    if (!edit.field_name || typeof edit.field_name !== 'string') {
      throw new ValidationApiError('Each edit must have a field_name');
    }

    if (!allowedFields.includes(edit.field_name)) {
      throw new ValidationApiError(`Invalid field name: ${edit.field_name}. Allowed: ${allowedFields.join(', ')}`);
    }

    if (!('field_value_old' in edit) || !('field_value_new' in edit)) {
      throw new ValidationApiError('Each edit must have field_value_old and field_value_new properties');
    }
  }

  // Check if artwork exists
  const artworkExists = await c.env.DB
    .prepare('SELECT id FROM artwork WHERE id = ?')
    .bind(artworkId)
    .first();

  if (!artworkExists) {
    throw new NotFoundError(`Artwork not found: ${artworkId}`);
  }

  // Check rate limiting
  const artworkEditsService = new ArtworkEditsService(c.env.DB);
  const recentEditCount = await artworkEditsService.getUserPendingEditCount(userToken, 24);
  
  const response = {
    valid: true,
    message: 'Edit request is valid',
    rate_limit_info: {
      edits_used: recentEditCount,
      edits_remaining: Math.max(0, 500 - recentEditCount),
      rate_limit: 500,
      window_hours: 24
    }
  };

  if (recentEditCount >= 500) {
    return c.json(createSuccessResponse({
      ...response,
      valid: false,
      message: 'Rate limit exceeded. You can submit up to 500 edits per 24-hour period.'
    }));
  }

  return c.json(createSuccessResponse(response));
}