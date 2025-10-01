/**
 * Moderator feedback route handlers (GET/POST /api/moderation/feedback)
 * Allows moderators to list, filter, and review user-submitted feedback
 *
 * Features:
 * - List feedback with filtering (status, subject_type, issue_type)
 * - Pagination support
 * - Review actions (archive, resolve)
 * - Moderator authentication required
 */

import type { Context } from 'hono';
import type {
  WorkerEnv,
  AuthContext,
  FeedbackRecord,
  FeedbackListResponse,
  ReviewFeedbackRequest,
  ReviewFeedbackResponse,
} from '../../types';
import { ApiError } from '../../lib/errors';

/**
 * GET /api/moderation/feedback - List feedback for moderators
 * Requires moderator authentication
 * Query params: status, subject_type, issue_type, page, per_page
 */
export async function listFeedback(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    // 1. Verify moderator authentication
    const authContext = c.get('authContext');
    if (!authContext.canReview) {
      throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // 2. Parse query parameters
    const status = c.req.query('status') || 'open';
    const subjectType = c.req.query('subject_type');
    const issueType = c.req.query('issue_type');
    const page = parseInt(c.req.query('page') || '1', 10);
    const perPage = Math.min(parseInt(c.req.query('per_page') || '20', 10), 100);

    // 3. Validate parameters
    if (!['open', 'archived', 'resolved'].includes(status)) {
      throw new ApiError('Invalid status parameter', 'VALIDATION_ERROR', 400);
    }

    if (subjectType && !['artwork', 'artist'].includes(subjectType)) {
      throw new ApiError('Invalid subject_type parameter', 'VALIDATION_ERROR', 400);
    }

    if (page < 1) {
      throw new ApiError('Invalid page parameter', 'VALIDATION_ERROR', 400);
    }

    // 4. Build SQL query with filters
    const params: (string | number)[] = [];
    let whereClause = 'WHERE status = ?';
    params.push(status);

    if (subjectType) {
      whereClause += ' AND subject_type = ?';
      params.push(subjectType);
    }

    if (issueType) {
      whereClause += ' AND issue_type = ?';
      params.push(issueType);
    }

    // 5. Execute query with pagination
    const offset = (page - 1) * perPage;
    const query = `SELECT * FROM feedback ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(perPage, offset);

    const results = await c.env.DB.prepare(query).bind(...params).all<FeedbackRecord>();

    // 6. Get total count
    const countQuery = `SELECT COUNT(*) as total FROM feedback ${whereClause}`;
    const countParams = params.slice(0, params.length - 2); // Remove LIMIT and OFFSET
    const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();
    const total = countResult?.total || 0;

    // 7. Build response
    const response: FeedbackListResponse = {
      feedback: results.results || [],
      total,
      page,
      per_page: perPage,
      has_more: (page * perPage) < total,
    };

    return c.json(response);

  } catch (error) {
    console.error('Error listing feedback:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to list feedback', 'FEEDBACK_LIST_ERROR', 500);
  }
}

/**
 * POST /api/moderation/feedback/:id/review - Review feedback (archive/resolve)
 * Requires moderator authentication
 */
export async function reviewFeedback(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    // 1. Verify moderator authentication
    const authContext = c.get('authContext');
    if (!authContext.canReview) {
      throw new ApiError('Moderator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // 2. Parse request
    const feedbackId = c.req.param('id');
    if (!feedbackId) {
      throw new ApiError('Feedback ID is required', 'VALIDATION_ERROR', 400);
    }

    const body = await c.req.json<ReviewFeedbackRequest>();

    // 3. Validate action
    if (!body.action || !['archive', 'resolve', 'apply_changes'].includes(body.action)) {
      throw new ApiError('Invalid action parameter', 'VALIDATION_ERROR', 400);
    }

    // Note: 'apply_changes' is a future enhancement - for now, we just resolve
    if (body.action === 'apply_changes') {
      throw new ApiError('apply_changes action is not yet implemented', 'NOT_IMPLEMENTED', 501);
    }

    // 4. Check if feedback exists
    const existing = await c.env.DB.prepare(
      'SELECT * FROM feedback WHERE id = ?'
    ).bind(feedbackId).first<FeedbackRecord>();

    if (!existing) {
      throw new ApiError('Feedback not found', 'NOT_FOUND', 404);
    }

    // 5. Update feedback record
    const newStatus = body.action === 'archive' ? 'archived' : 'resolved';
    const reviewedAt = new Date().toISOString();
    const reviewNotes = body.review_notes || null;

    await c.env.DB.prepare(`
      UPDATE feedback 
      SET status = ?, reviewed_at = ?, moderator_token = ?, review_notes = ?
      WHERE id = ?
    `).bind(
      newStatus,
      reviewedAt,
      authContext.userToken,
      reviewNotes,
      feedbackId
    ).run();

    // 6. Fetch updated record
    const updated = await c.env.DB.prepare(
      'SELECT * FROM feedback WHERE id = ?'
    ).bind(feedbackId).first<FeedbackRecord>();

    if (!updated) {
      throw new ApiError('Failed to retrieve updated feedback', 'DATABASE_ERROR', 500);
    }

    // 7. Build response
    const response: ReviewFeedbackResponse = {
      feedback: updated,
      message: `Feedback ${newStatus} successfully`,
    };

    return c.json(response);

  } catch (error) {
    console.error('Error reviewing feedback:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to review feedback', 'FEEDBACK_REVIEW_ERROR', 500);
  }
}
