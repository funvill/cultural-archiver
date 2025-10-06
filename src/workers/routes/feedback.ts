/**
 * Feedback route handlers for user-submitted feedback (POST /api/feedback)
 * Allows users to report issues with artworks or artists to moderators
 *
 * Features:
 * - Anonymous feedback submission (with optional user_token)
 * - Rate limiting per user_token and IP address
 * - Subject validation (artwork/artist must exist)
 * - Private to moderators only (not public-facing)
 */

import type { Context } from 'hono';
import type {
  WorkerEnv,
  CreateFeedbackRequest,
  CreateFeedbackResponse,
} from '../types';
import { ApiError } from '../lib/errors';
import { MAX_FEEDBACK_NOTE_LENGTH } from '../../shared/types';

/**
 * POST /api/feedback - Create feedback record
 * Public endpoint (no authentication required)
 * Rate limited per user_token and IP
 */
export async function createFeedback(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  try {
    // 1. Parse and validate request body
    const body = await c.req.json<CreateFeedbackRequest>();

    // 2. Validate required fields
    if (!body.subject_type || !['artwork', 'artist'].includes(body.subject_type)) {
      throw new ApiError('Invalid subject_type', 'VALIDATION_ERROR', 400);
    }

    if (!body.subject_id || typeof body.subject_id !== 'string') {
      throw new ApiError('subject_id is required', 'VALIDATION_ERROR', 400);
    }

    if (!body.issue_type || !['missing', 'incorrect_info', 'other', 'comment'].includes(body.issue_type)) {
      throw new ApiError('Invalid issue_type', 'VALIDATION_ERROR', 400);
    }

    if (!body.note || typeof body.note !== 'string') {
      throw new ApiError('note is required', 'VALIDATION_ERROR', 400);
    }

    const trimmedNote = body.note.trim();
    if (trimmedNote.length === 0) {
      throw new ApiError('note cannot be empty', 'VALIDATION_ERROR', 400);
    }

    if (trimmedNote.length > MAX_FEEDBACK_NOTE_LENGTH) {
      throw new ApiError(`note must be ${MAX_FEEDBACK_NOTE_LENGTH} characters or less`, 'VALIDATION_ERROR', 400);
    }

    // 3. Check rate limits using existing rate_limiting table
    const userToken = body.user_token || null;
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    
    // Check user_token rate limit (10 per hour)
    if (userToken) {
      const userLimit = await c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM feedback 
         WHERE user_token = ? AND created_at > datetime('now', '-1 hour')`
      ).bind(userToken).first<{ count: number }>();

      if (userLimit && userLimit.count >= 10) {
        throw new ApiError('Rate limit exceeded. Please try again later.', 'RATE_LIMIT_EXCEEDED', 429);
      }
    }

    // Check IP rate limit (20 per hour for anonymous users)
    const ipLimit = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM feedback 
       WHERE ip_address = ? AND created_at > datetime('now', '-1 hour')`
    ).bind(ipAddress).first<{ count: number }>();

    if (ipLimit && ipLimit.count >= 20) {
      throw new ApiError('Rate limit exceeded. Please try again later.', 'RATE_LIMIT_EXCEEDED', 429);
    }

    // 4. Verify subject exists (skip validation for general feedback)
    const isGeneralFeedback = body.subject_id === 'general-feedback';
    
    if (!isGeneralFeedback) {
      let subjectExists = false;
      if (body.subject_type === 'artwork') {
        const artwork = await c.env.DB.prepare(
          'SELECT id FROM artwork WHERE id = ?'
        ).bind(body.subject_id).first();
        subjectExists = !!artwork;
      } else if (body.subject_type === 'artist') {
        const artist = await c.env.DB.prepare(
          'SELECT id FROM artists WHERE id = ?'
        ).bind(body.subject_id).first();
        subjectExists = !!artist;
      }

      if (!subjectExists) {
        throw new ApiError(`${body.subject_type} not found`, 'NOT_FOUND', 404);
      }
    }

    // 5. Create feedback record
    const feedbackId = crypto.randomUUID();
    const userAgent = c.req.header('User-Agent') || null;
    const createdAt = new Date().toISOString();

    await c.env.DB.prepare(`
      INSERT INTO feedback (
        id, subject_type, subject_id, user_token, issue_type, note, 
        status, created_at, ip_address, user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
    `).bind(
      feedbackId,
      body.subject_type,
      body.subject_id,
      userToken,
      body.issue_type,
      trimmedNote,
      createdAt,
      ipAddress,
      userAgent
    ).run();

    // 7. Return success response
    const response: CreateFeedbackResponse = {
      id: feedbackId,
      status: 'open',
      created_at: createdAt,
      message: 'Feedback submitted successfully. Moderators will review your report.',
    };

    return c.json(response, 201);

  } catch (error) {
    console.error('Error creating feedback:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to create feedback', 'FEEDBACK_CREATE_ERROR', 500);
  }
}
