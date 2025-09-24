/**
 * Authentication middleware for user token generation and validation
 * Handles anonymous user tokens and reviewer permission checking
 */

import type { Context, Next } from 'hono';
import type { WorkerEnv } from '../types';
import { UnauthorizedError, ForbiddenError } from '../lib/errors';
import { getUserPermissions } from '../lib/permissions';

export interface AuthContext {
  userToken: string;
  /** True if user has moderator role (or admin role which inherits moderator privileges). */
  isModerator: boolean;
  /** Derived permission: true if user can review submissions (moderator or admin role). */
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

  // Get user permissions from database
  try {
    const permissions = await getUserPermissions(c.env.DB, userToken);
    const isAdmin = permissions.includes('admin');
    const isModerator = permissions.includes('moderator');

    // canReview is derived from roles: admins and moderators can review
    const canReview = isAdmin || isModerator;

    c.set('authContext', {
      userToken,
      isModerator: isModerator || isAdmin, // Admins have moderator privileges
      canReview,
      isVerifiedEmail: false, // Will be set by checkEmailVerification middleware
      isAdmin,
    });
  } catch (error) {
    console.warn('Failed to check user permissions:', error);
    // Fallback to no permissions on error
    c.set('authContext', {
      userToken,
      isModerator: false,
      canReview: false,
      isVerifiedEmail: false,
      isAdmin: false,
    });
  }

  await next();
}

/**
 * Middleware to check if user has review permissions
 * Requires either moderator or admin role
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
    // Check if user has moderator OR admin role (both can review)
    const permissions = await getUserPermissions(c.env.DB, userToken);
    const hasReviewPermission = permissions.includes('moderator') || permissions.includes('admin');

    if (!hasReviewPermission) {
      throw new ForbiddenError('Moderator or admin permissions required');
    }

    // Update auth context (set all related flags)
    const authContext = c.get('authContext');
    authContext.isModerator = permissions.includes('moderator') || permissions.includes('admin');
    authContext.canReview = true;
    authContext.isAdmin = permissions.includes('admin');
    c.set('authContext', authContext);

    await next();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw error;
    }
    throw new UnauthorizedError('Failed to verify review permissions');
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
 * Checks both KV store (session-based) and database (permanent user record)
 */
export async function checkEmailVerification(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const userToken = c.get('userToken');

  if (userToken) {
    try {
      let isEmailVerified = false;

      // First, check database for permanent user record with email verification
      try {
        const stmt = c.env.DB.prepare(`
          SELECT email_verified_at 
          FROM users 
          WHERE uuid = ? AND email_verified_at IS NOT NULL
          LIMIT 1
        `);
        const result = await stmt.bind(userToken).first();

        if (result && result.email_verified_at) {
          isEmailVerified = true;
        }
      } catch (dbError) {
        console.warn('Database email verification check failed:', dbError);
      }

      // If not verified via database, check KV store for session-based verification
      if (!isEmailVerified && c.env.SESSIONS) {
        const emailData = await c.env.SESSIONS.get(`email:${userToken}`);
        if (emailData) {
          isEmailVerified = true;
        }
      } else if (!c.env.SESSIONS) {
        console.warn('Email verification fallback: SESSIONS KV namespace not available');
      }

      // Update auth context if email is verified
      if (isEmailVerified) {
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

export function isModeratorUser(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.isModerator || authContext.isAdmin || false;
}

export function canReview(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.canReview || authContext.isModerator || authContext.isAdmin || false;
}

/**
 * Check if current user has verified email
 */
export function hasVerifiedEmail(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.isVerifiedEmail;
}
