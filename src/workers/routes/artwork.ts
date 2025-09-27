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
import { createSuccessResponse, ValidationApiError, NotFoundError, UnauthorizedError } from '../lib/errors';
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

/**
 * GET /api/artwork/:id/membership - Get user's list membership status for an artwork
 * Returns which special lists (loved, beenHere, wantToSee) the artwork is in for the current user
 */
export async function getArtworkMembership(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
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

  if (!userToken) {
    // Return default states for unauthenticated users
    return c.json(createSuccessResponse({
      loved: false,
      beenHere: false,
      wantToSee: false,
      inAnyList: false,
    }));
  }

  try {
    const db = c.env.DB;

    // Check membership in special lists
    const membershipQuery = `
      SELECT 
        l.special_list_name,
        CASE WHEN li.artwork_id IS NOT NULL THEN 1 ELSE 0 END as is_member
      FROM (
        SELECT 'loved' as special_list_name
        UNION SELECT 'beenHere' as special_list_name  
        UNION SELECT 'wantToSee' as special_list_name
      ) l
      LEFT JOIN lists ls ON ls.user_token = ? AND ls.special_list_name = l.special_list_name
      LEFT JOIN list_items li ON li.list_id = ls.list_id AND li.artwork_id = ?
    `;

    const membershipResults = await db.prepare(membershipQuery)
      .bind(userToken, artworkId)
      .all();

    // Check if artwork is in any custom lists
    const customListQuery = `
      SELECT COUNT(*) as count
      FROM list_items li
      JOIN lists l ON l.list_id = li.list_id
      WHERE l.user_token = ? AND li.artwork_id = ? AND l.special_list_name IS NULL
    `;

    const customListResult = await db.prepare(customListQuery)
      .bind(userToken, artworkId)
      .first();

    // Build response
    const membership = {
      loved: false,
      beenHere: false,
      wantToSee: false,
      inAnyList: false,
    };

    // Process special list memberships
    if (membershipResults.success && membershipResults.results) {
      for (const row of membershipResults.results) {
        const listName = (row as any).special_list_name;
        const isMember = (row as any).is_member === 1;
        
        if (listName === 'loved') membership.loved = isMember;
        else if (listName === 'beenHere') membership.beenHere = isMember;
        else if (listName === 'wantToSee') membership.wantToSee = isMember;
      }
    }

    // Check custom lists
    if (customListResult && (customListResult as any).count > 0) {
      membership.inAnyList = true;
    } else {
      // Also true if in any special list
      membership.inAnyList = membership.loved || membership.beenHere || membership.wantToSee;
    }

    return c.json(createSuccessResponse(membership));

  } catch (error) {
    console.error('Failed to get artwork membership:', error);
    throw error;
  }
}

/**
 * POST /api/artwork/:id/lists/:listType - Toggle artwork in a specific special list
 * Supports: loved, beenHere, wantToSee
 */
export async function toggleArtworkListMembership(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  const artworkId = c.req.param('id');
  const listType = c.req.param('listType');

  if (!userToken) {
    throw new UnauthorizedError('Authentication required to manage lists');
  }

  if (!artworkId) {
    throw new ValidationApiError([
      {
        field: 'artwork_id',
        message: 'Artwork ID is required',
        code: 'REQUIRED_FIELD',
      },
    ]);
  }

  if (!listType || !['loved', 'beenHere', 'wantToSee'].includes(listType)) {
    throw new ValidationApiError([
      {
        field: 'listType',
        message: 'List type must be one of: loved, beenHere, wantToSee',
        code: 'INVALID_VALUE',
      },
    ]);
  }

  const requestBody = await c.req.json().catch(() => ({}));
  const action = requestBody.action; // 'add' or 'remove'

  if (!action || !['add', 'remove'].includes(action)) {
    throw new ValidationApiError([
      {
        field: 'action',
        message: 'Action must be either "add" or "remove"',
        code: 'INVALID_VALUE',
      },
    ]);
  }

  try {
    const db = c.env.DB;

    // First, ensure the user has the special list
    const ensureListQuery = `
      INSERT OR IGNORE INTO lists (list_id, user_token, name, special_list_name, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `;

    const listId = `${userToken}-${listType}`;
    const listNames = {
      loved: 'Loved',
      beenHere: 'Been Here', 
      wantToSee: 'Want to See'
    };

    await db.prepare(ensureListQuery)
      .bind(listId, userToken, listNames[listType as keyof typeof listNames], listType)
      .run();

    if (action === 'add') {
      // Add artwork to list
      const addQuery = `
        INSERT OR IGNORE INTO list_items (list_id, artwork_id, added_at)
        VALUES (?, ?, datetime('now'))
      `;
      
      await db.prepare(addQuery)
        .bind(listId, artworkId)
        .run();

    } else {
      // Remove artwork from list
      const removeQuery = `
        DELETE FROM list_items 
        WHERE list_id = ? AND artwork_id = ?
      `;
      
      await db.prepare(removeQuery)
        .bind(listId, artworkId)
        .run();
    }

    return c.json(createSuccessResponse({ 
      message: `Artwork ${action === 'add' ? 'added to' : 'removed from'} ${listType} list`,
      action,
      listType 
    }));

  } catch (error) {
    console.error(`Failed to ${action} artwork to ${listType} list:`, error);
    throw error;
  }
}

/**
 * GET /api/artwork/:id/counts - Get public engagement counts for an artwork
 * Returns public counts for loved, beenHere, wantToSee without requiring authentication
 */
export async function getArtworkCounts(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
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
    const db = c.env.DB;

    // Get public counts for each special list type
    const countsQuery = `
      SELECT 
        l.special_list_name,
        COUNT(li.artwork_id) as count
      FROM (
        SELECT 'loved' as special_list_name
        UNION SELECT 'beenHere' as special_list_name  
        UNION SELECT 'wantToSee' as special_list_name
      ) l
      LEFT JOIN lists ls ON ls.special_list_name = l.special_list_name
      LEFT JOIN list_items li ON li.list_id = ls.list_id AND li.artwork_id = ?
      GROUP BY l.special_list_name
    `;

    const countsResults = await db.prepare(countsQuery)
      .bind(artworkId)
      .all();

    // Get total unique users who have this artwork in any list
    const totalUsersQuery = `
      SELECT COUNT(DISTINCT l.user_token) as total_users
      FROM list_items li
      JOIN lists l ON l.list_id = li.list_id
      WHERE li.artwork_id = ?
    `;

    const totalUsersResult = await db.prepare(totalUsersQuery)
      .bind(artworkId)
      .first();

    // Build response
    const counts = {
      loved: 0,
      beenHere: 0,
      wantToSee: 0,
      totalUsers: 0,
    };

    // Process special list counts
    if (countsResults.success && countsResults.results) {
      for (const row of countsResults.results) {
        const listName = (row as any).special_list_name;
        const count = (row as any).count || 0;
        
        if (listName === 'loved') counts.loved = count;
        else if (listName === 'beenHere') counts.beenHere = count;
        else if (listName === 'wantToSee') counts.wantToSee = count;
      }
    }

    // Set total users count
    if (totalUsersResult) {
      counts.totalUsers = (totalUsersResult as any).total_users || 0;
    }

    return c.json(createSuccessResponse(counts));

  } catch (error) {
    console.error('Failed to get artwork counts:', error);
    throw error;
  }
}
