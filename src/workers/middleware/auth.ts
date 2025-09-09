/**
 * Authentication middleware for user token generation and validation
 * Handles anonymous user tokens and reviewer permission checking
 */

import type { Context, Next } from 'hono';
import type { WorkerEnv } from '../types';
import { UnauthorizedError, ForbiddenError } from '../lib/errors';

// One-time deprecation warning emitter for legacy reviewer flag usage
let hasWarnedReviewerDeprecation = false;
function warnReviewerDeprecation(source: string): void {
  if (!hasWarnedReviewerDeprecation) {
    hasWarnedReviewerDeprecation = true;
    // Cloudflare Workers: console.warn is acceptable for operational notices
    console.warn(
      `[DEPRECATION] 'isReviewer' flag accessed (${source}). This alias will be removed in a future release. ` +
        `Use 'isModerator' (role) and/or 'canReview' (capability). See migration note in CHANGELOG and permissions audit.`
    );
  }
}

export interface AuthContext {
  userToken: string;
  /** Deprecated: will be removed after migration; use isModerator or canReview */
  isReviewer: boolean;
  /** True if user has moderator permission (or higher). */
  isModerator: boolean;
  /** User can perform review actions (alias of isModerator or admin). */
  canReview: boolean;
  isVerifiedEmail: boolean;
  isAdmin?: boolean;
}

// Extend the Hono context types
declare module 'hono' {
  interface ContextVariableMap {
    userToken: string;
    authContext: AuthContext;
    isNewToken: boolean;
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
  let isNewToken = false;

  if (!userToken) {
    // Check for X-User-Token header (used by frontend)
    userToken = c.req.header('X-User-Token');
  }

  if (!userToken) {
    // Check for token in cookie (for browser requests)
    const cookieHeader = c.req.header('Cookie');

    userToken = cookieHeader
      ?.split(';')
      .find(cookie => cookie.trim().startsWith('user_token='))
      ?.split('=')[1];
  }

  // Validate token format if we have one (should be UUID v4 only)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (userToken && !uuidRegex.test(userToken)) {
    userToken = undefined; // Clear invalid token
  }

  // Only generate new token if we don't have a valid one
  if (!userToken) {
    userToken = generateUserToken();
    isNewToken = true;
  }

  // Store in context for use by route handlers
  c.set('userToken', userToken);
  c.set('isNewToken', isNewToken); // Track if this is a new token
  c.set('authContext', {
    userToken,
    isReviewer: false,
    isModerator: false,
    canReview: false,
    isVerifiedEmail: false,
  });

  await next();
}

/**
 * Middleware to check if user has reviewer permissions
 * Uses database-backed permission system with fallback to legacy logic
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
    // Check database-backed permissions only - no legacy fallbacks
    const { isModerator } = await import('../lib/permissions');
    const hasModerator = await isModerator(c.env.DB, userToken);

    if (!hasModerator) {
      throw new ForbiddenError('Moderator permissions required');
    }

    // Update auth context (set all related flags)
    const authContext = c.get('authContext');
    authContext.isReviewer = true; // deprecated
    authContext.isModerator = true;
    authContext.canReview = true;
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
 * Middleware to check if user has admin permissions
 * Requires a valid user token and admin permission in database
 */
export async function requireAdmin(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const userToken = c.get('userToken');

  if (!userToken) {
    throw new UnauthorizedError('User token required');
  }

  try {
    // Check database-backed admin permissions
    const { isAdmin } = await import('../lib/permissions');
    const hasAdminPermission = await isAdmin(c.env.DB, userToken);

    if (!hasAdminPermission) {
      throw new ForbiddenError('Administrator permissions required');
    }

    // Update auth context
    const authContext = c.get('authContext');
  authContext.isReviewer = true; // deprecated
  authContext.isModerator = true;
  authContext.canReview = true;
    authContext.isAdmin = true;
    c.set('authContext', authContext);

    await next();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw error;
    }
    throw new UnauthorizedError('Failed to verify admin permissions');
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
      // Skip email verification check in development if KV namespace is not available
      if (!c.env.SESSIONS) {
        console.warn('Email verification disabled: SESSIONS KV namespace not available');
      } else {
        // Check if user has verified email stored in KV
        const emailData = await c.env.SESSIONS.get(`email:${userToken}`);

        if (emailData) {
          const authContext = c.get('authContext');
          authContext.isVerifiedEmail = true;
          c.set('authContext', authContext);
        }
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
  const isNewToken = c.get('isNewToken');

  if (userToken) {
    // Add token to response headers
    c.res.headers.set('X-User-Token', userToken);

    // Only set cookie if this is a new token (not when using existing token)
    if (isNewToken) {
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
      console.log(`[AUTH DEBUG] Set cookie for new token: ${userToken}`);
    } else {
      console.log(`[AUTH DEBUG] Preserving existing token, not setting cookie: ${userToken}`);
    }
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
  isModerator: false,
  canReview: false,
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
/**
 * @deprecated Use isModeratorUser(c) or canReview(c) instead.
 * Will be removed after deprecation period.
 */
export function isReviewer(c: Context): boolean {
  warnReviewerDeprecation('middleware.auth.isReviewer()');
  const authContext = getAuthContext(c);
  return authContext.isReviewer || authContext.isModerator || authContext.canReview || false;
}

export function isModeratorUser(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.isModerator || authContext.isAdmin || false;
}

export function canReview(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.canReview || authContext.isModerator || authContext.isAdmin || authContext.isReviewer || false;
}

/**
 * Check if current user has verified email
 */
export function hasVerifiedEmail(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.isVerifiedEmail;
}
