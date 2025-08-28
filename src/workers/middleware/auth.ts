/**
 * Authentication middleware for user token generation and validation
 * Handles anonymous user tokens and reviewer permission checking
 */

import type { Context, Next } from 'hono';
import type { WorkerEnv } from '../../shared/types';
import { UnauthorizedError, ForbiddenError } from '../lib/errors';

export interface AuthContext {
  userToken: string;
  isReviewer: boolean;
  isVerifiedEmail: boolean;
}

// Extend the Hono context types
declare module 'hono' {
  interface ContextVariableMap {
    userToken: string;
    authContext: AuthContext;
  }
}

/**
 * Generate or retrieve anonymous user token
 * Creates a new UUID token if none exists in request
 */
export function generateUserToken(): string {
  return crypto.randomUUID();
}

/**
 * Middleware to ensure user has a token (anonymous or authenticated)
 * Automatically generates anonymous token if none provided
 */
export async function ensureUserToken(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  let userToken = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!userToken) {
    // Check for token in cookie (for browser requests)
    userToken = c.req
      .header('Cookie')
      ?.split(';')
      .find(cookie => cookie.trim().startsWith('user_token='))
      ?.split('=')[1];
  }

  if (!userToken) {
    // Generate new anonymous token
    userToken = generateUserToken();
  }

  // Validate token format (should be UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userToken)) {
    userToken = generateUserToken();
  }

  // Store in context for use by route handlers
  c.set('userToken', userToken);
  c.set('authContext', {
    userToken,
    isReviewer: false,
    isVerifiedEmail: false,
  });

  await next();
}

/**
 * Middleware to check if user has reviewer permissions
 * Requires a valid user token and reviewer flag in database
 */
export async function requireReviewer(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const userToken = c.get('userToken');

  if (!userToken) {
    throw new UnauthorizedError('User token required');
  }

  try {
    // For MVP, we'll check if the user token matches a known reviewer token
    // This is a simplified approach - in production, you'd have a proper user/role system
    const stmt = c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM logbook 
      WHERE user_token = ? AND status = 'approved'
      HAVING count >= 5
    `);
    const result = await stmt.bind(userToken).first();
    const isReviewer = (result as { count: number } | null)?.count >= 5; // Users with 5+ approved submissions can review

    if (!isReviewer) {
      throw new ForbiddenError('Reviewer permissions required');
    }

    // Update auth context
    const authContext = c.get('authContext');
    authContext.isReviewer = true;
    c.set('authContext', authContext);

    await next();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw error;
    }
    throw new UnauthorizedError('Failed to verify reviewer permissions');
  }
}

/**
 * Middleware to check if user has verified email
 * Optional - enhances user experience but not required for MVP
 */
export async function checkEmailVerification(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const userToken = c.get('userToken');

  if (userToken) {
    try {
      // Check if user has verified email stored in KV
      const emailData = await c.env.SESSIONS.get(`email:${userToken}`);

      if (emailData) {
        const authContext = c.get('authContext');
        authContext.isVerifiedEmail = true;
        c.set('authContext', authContext);
      }
    } catch (error) {
      // Email verification check failed - continue without verification
      console.warn('Email verification check failed:', error);
    }
  }

  await next();
}

/**
 * Middleware to add user token to response headers/cookies
 * Ensures frontend can persist the anonymous token
 */
export async function addUserTokenToResponse(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  await next();

  const userToken = c.get('userToken');

  if (userToken) {
    // Add token to response headers
    c.res.headers.set('X-User-Token', userToken);

    // Add as secure cookie for browser requests
    const isProduction = c.env.ENVIRONMENT === 'production';
    const cookieOptions = [
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      'Max-Age=31536000', // 1 year
      ...(isProduction ? ['Secure'] : []),
    ].join('; ');

    c.res.headers.set('Set-Cookie', `user_token=${userToken}; ${cookieOptions}`);
  }
}

/**
 * Get auth context from request context
 */
export function getAuthContext(c: Context): AuthContext {
  return (
    c.get('authContext') || {
      userToken: '',
      isReviewer: false,
      isVerifiedEmail: false,
    }
  );
}

/**
 * Get user token from request context
 */
export function getUserToken(c: Context): string {
  return c.get('userToken') || '';
}

/**
 * Check if current user is a reviewer
 */
export function isReviewer(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.isReviewer;
}

/**
 * Check if current user has verified email
 */
export function hasVerifiedEmail(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.isVerifiedEmail;
}
