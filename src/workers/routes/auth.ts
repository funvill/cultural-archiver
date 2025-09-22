/**
 * Authentication route handlers for UUID-based authentication with magic links
 *
 * Implements the complete authentication system supporting:
 * - Anonymous users with UUID-based tokens
 * - Account creation with UUID claiming
 * - Magic link authentication for existing users
 * - Cross-device login with UUID replacement
 * - Session management and logout
 */

import type { Context } from 'hono';
import type { WorkerEnv, AuthContext } from '../types';
import type {
  MagicLinkRequest,
  ConsumeMagicLinkRequest,
  AuthStatusResponse,
} from '../../shared/types';
import { createApiSuccessResponse, createApiErrorResponse } from '../../shared/types';
import {
  generateUUID,
  getUserByEmail,
  getUserByUUID,
  createSession,
  deactivateSession,
  getUserSessions,
} from '../lib/auth';
import { requestMagicLink as createMagicLinkForRequest, consumeMagicLink } from '../lib/email-auth';
import { ApiError } from '../lib/errors';
import { BadgeService } from '../lib/badges';

/**
 * POST /api/auth/request-magic-link
 * Request a magic link for account creation or login
 */
export async function requestMagicLink(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const { email }: MagicLinkRequest = await c.req.json();

    if (!email || typeof email !== 'string') {
      throw new ApiError('Valid email address is required', 'INVALID_EMAIL', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const currentUUID = authContext.userToken;
    const clientIP =
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

    // Check if user already exists
    const existingUser = await getUserByEmail(c.env, normalizedEmail);
    const isSignup = !existingUser;

    // Use the existing requestMagicLink function from email-auth
    const magicLinkResult = await createMagicLinkForRequest(
      c.env,
      { email: normalizedEmail }, // Pass as MagicLinkRequest object
      currentUUID,
      clientIP
    );

    // Check if request was successful
    if (!magicLinkResult.success) {
      throw new ApiError(
        magicLinkResult.message || 'Failed to create magic link',
        'MAGIC_LINK_CREATION_FAILED',
        400
      );
    }

    // The response from requestMagicLink doesn't include token for security
    // We just return success message
    return c.json({
      success: true,
      data: {
        message: isSignup
          ? 'Account creation magic link sent successfully'
          : 'Login magic link sent successfully',
        email: normalizedEmail,
        is_signup: isSignup,
        rate_limit_remaining: magicLinkResult.rate_limit_remaining,
        rate_limit_reset_at: magicLinkResult.rate_limit_reset_at,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Magic link request error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to send magic link', 'MAGIC_LINK_REQUEST_ERROR', 500);
  }
}

/**
 * POST /api/auth/verify-magic-link
 * Verify and consume magic link token for authentication
 */
export async function verifyMagicLink(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const { token }: ConsumeMagicLinkRequest = await c.req.json();

    console.log('[MAGIC LINK DEBUG] Starting verification:', {
      token: token?.substring(0, 8) + '...',
      currentUUID: authContext.userToken,
      timestamp: new Date().toISOString(),
    });

    if (!token || typeof token !== 'string') {
      throw new ApiError('Valid magic link token is required', 'INVALID_TOKEN', 400);
    }

    const currentUUID = authContext.userToken;

    // Consume magic link using existing function
    console.log('[MAGIC LINK DEBUG] Consuming magic link with UUID:', currentUUID);
    const authResult = await consumeMagicLink(
      c.env,
      { token }, // Pass as ConsumeMagicLinkRequest object
      currentUUID
    );

    console.log('[MAGIC LINK DEBUG] Magic link consumption result:', {
      success: authResult.success,
      message: authResult.message,
      user_token: authResult.user_token,
      is_new_account: authResult.is_new_account,
    });

    // Check if consumption was successful
    if (!authResult.success) {
      throw new ApiError(
        authResult.message || 'Failed to verify magic link',
        'MAGIC_LINK_VERIFICATION_FAILED',
        400
      );
    }

    // Create new session using existing function - need to get user UUID from the result
    const userUUID = authResult.user_token || currentUUID;
    console.log('[MAGIC LINK DEBUG] Creating session for user UUID:', userUUID);

    const sessionInfo = await createSession(c.env, {
      user_uuid: userUUID,
      ip_address: c.req.header('CF-Connecting-IP') || 'unknown',
      user_agent: c.req.header('User-Agent') || 'unknown',
    });

    console.log('[MAGIC LINK DEBUG] Session created:', {
      sessionToken: sessionInfo.token?.substring(0, 8) + '...',
      expires: sessionInfo.session.expires_at,
    });

    // Get user details from database to include correct email
    let userRecord = null;
    try {
      userRecord = await getUserByUUID(c.env, userUUID);
      console.log('[MAGIC LINK DEBUG] User record retrieved:', {
        uuid: userRecord?.uuid,
        email: userRecord?.email,
        emailVerified: !!userRecord?.email_verified_at,
      });
    } catch (error) {
      console.warn(
        '[MAGIC LINK DEBUG] Failed to get user record after magic link verification:',
        error
      );
    }

    // Prepare response data
    const responseData = {
      success: true,
      message: authResult.is_new_account ? 'Account created successfully' : 'Login successful',
      user: {
        uuid: userUUID,
        email: userRecord?.email || 'unknown@example.com',
        created_at: userRecord?.created_at || new Date().toISOString(),
        email_verified_at: userRecord?.email_verified_at || new Date().toISOString(),
      },
      session: {
        token: sessionInfo.token,
        expires_at: sessionInfo.session.expires_at,
      },
      uuid_replaced: currentUUID !== userUUID,
      is_new_account: authResult.is_new_account || false,
    };

    // Set authentication cookies - use ApiResponse wrapper
    const response = c.json(createApiSuccessResponse(responseData, responseData.message));

    // Set session cookie (httpOnly, secure)
    response.headers.set(
      'Set-Cookie',
      `session_token=${sessionInfo.token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}` // 7 days
    );

    // Set user UUID cookie for frontend
    response.headers.set(
      'Set-Cookie',
      `user_token=${userUUID}; Secure; SameSite=Strict; Path=/; Max-Age=${365 * 24 * 60 * 60}` // 1 year
    );

    console.log('[MAGIC LINK DEBUG] Magic link verification completed successfully:', {
      userUUID,
      email: userRecord?.email,
      isNewAccount: authResult.is_new_account,
      uuidReplaced: currentUUID !== userUUID,
      sessionToken: sessionInfo.token?.substring(0, 8) + '...',
      cookiesSet: ['session_token', 'user_token'],
    });

    // Check and award email verification badge
    try {
      const badgeService = new BadgeService(c.env.DB);
      const awardedBadges = await badgeService.checkEmailVerificationBadge(userUUID);
      
      if (awardedBadges.length > 0) {
        console.log(`User ${userUUID} earned ${awardedBadges.length} badges from email verification:`, 
          awardedBadges.map(b => b.badge_key));
      }
    } catch (badgeError) {
      // Log badge errors but don't fail the verification
      console.warn('Badge checking failed during email verification:', badgeError);
    }

    return response;
  } catch (error) {
    console.error('Magic link verification error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to verify magic link', 'MAGIC_LINK_VERIFY_ERROR', 500);
  }
}

/**
 * POST /api/auth/logout
 * Log out current user and generate new anonymous UUID
 */
export async function logout(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const sessionToken =
      c.req.header('Authorization')?.replace('Bearer ', '') ||
      c.req.header('Cookie')?.match(/session_token=([^;]+)/)?.[1];

    // Deactivate current session if exists
    if (sessionToken) {
      try {
        await deactivateSession(c.env, sessionToken);
      } catch (error) {
        console.warn('Failed to deactivate session during logout:', error);
        // Continue with logout even if session deactivation fails
      }
    }

    // Generate new anonymous UUID
    const newAnonymousUUID = generateUUID();

    // Wrap in ApiResponse format to match frontend expectations
    const responseData = {
      success: true,
      message: 'Logged out successfully',
      new_user_token: newAnonymousUUID,
    };

    const response = c.json({
      success: true,
      data: responseData,
      timestamp: new Date().toISOString(),
    });

    // Clear authentication cookies
    response.headers.set(
      'Set-Cookie',
      'session_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
    );

    response.headers.set(
      'Set-Cookie',
      `user_token=${newAnonymousUUID}; Secure; SameSite=Strict; Path=/; Max-Age=${365 * 24 * 60 * 60}` // 1 year
    );

    return response;
  } catch (error) {
    console.error('Logout error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to logout', 'LOGOUT_ERROR', 500);
  }
}

/**
 * GET /api/auth/status
 * Get current authentication status
 */
export async function getAuthStatus(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const sessionToken =
      c.req.header('Authorization')?.replace('Bearer ', '') ||
      c.req.header('Cookie')?.match(/session_token=([^;]+)/)?.[1];

    console.log('[AUTH STATUS DEBUG] Processing auth status request:', {
      userToken: authContext.userToken,
      hasSessionToken: !!sessionToken,
      endpoint: c.req.url,
      timestamp: new Date().toISOString(),
    });

    // Simple implementation using available functions
    let user = null;
    let session = null;
    let isAuthenticated = false;

    // Check if user exists
    if (authContext.userToken) {
      try {
        console.log('[AUTH STATUS DEBUG] Looking up user by UUID:', authContext.userToken);
        const userRecord = await getUserByUUID(c.env, authContext.userToken);
        if (userRecord) {
          isAuthenticated = true;
          user = {
            uuid: userRecord.uuid,
            email: userRecord.email,
            created_at: userRecord.created_at,
            last_login: userRecord.last_login,
            email_verified_at: userRecord.email_verified_at,
            status: userRecord.status,
          };
          console.log('[AUTH STATUS DEBUG] User found:', {
            uuid: user.uuid,
            email: user.email,
            isAuthenticated: true,
          });
        } else {
          console.log('[AUTH STATUS DEBUG] No user record found for UUID:', authContext.userToken);
        }
      } catch (error) {
        console.warn(
          '[AUTH STATUS DEBUG] Failed to get user info during auth status check:',
          error
        );
      }
    }

    // Check session if token exists
    if (sessionToken) {
      try {
        const sessionInfo = await getUserSessions(c.env, authContext.userToken);
        if (sessionInfo && sessionInfo.length > 0) {
          // Note: SessionInfo doesn't have a token field, so we can't match by token
          // Just use the first active session
          const activeSession = sessionInfo[0];
          if (activeSession) {
            session = {
              token: sessionToken, // Use the token we have
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default 7 days
              created_at: activeSession.created_at,
            };
          }
        }
      } catch (error) {
        console.warn('Failed to get session info during auth status check:', error);
      }
    }

    const response: AuthStatusResponse = {
      user_token: authContext.userToken,
      is_authenticated: isAuthenticated,
      is_anonymous: !isAuthenticated,
      // Transitional role exposure (kept minimal – profile endpoint has full detail)
      // Deprecated: is_reviewer mirrors is_moderator
      // Not part of original AuthStatusResponse type; appended dynamically for migration period
      ...(authContext && {
        is_reviewer: authContext.isReviewer || authContext.isModerator || false,
        is_moderator: authContext.isModerator || authContext.isReviewer || false,
        can_review: authContext.canReview || authContext.isModerator || authContext.isReviewer || false,
        is_admin: !!authContext.isAdmin,
        is_email_verified: !!authContext.isVerifiedEmail,
      }),
      user: user
        ? {
            uuid: user.uuid,
            email: user.email,
            created_at: user.created_at,
            last_login: user.last_login,
            email_verified_at: user.email_verified_at,
            status: user.status,
          }
        : null,
      session: session,
    };

    console.log('[AUTH STATUS DEBUG] Returning auth status:', {
      user_token: response.user_token,
      is_authenticated: response.is_authenticated,
      is_anonymous: response.is_anonymous,
      has_user: !!response.user,
      has_session: !!response.session,
      user_email: response.user?.email,
    });

    // CRITICAL FIX: Wrap in ApiResponse format to match frontend expectations
    return c.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Auth status error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to get authentication status', 'AUTH_STATUS_ERROR', 500);
  }
}



/**
 * Development helper: Get magic link for email when Resend fails
 * GET /api/auth/dev-magic-link?email=user@example.com
 */
export async function getDevMagicLink(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  try {
    if (c.env.ENVIRONMENT === 'production') {
      // Only allow in development or when Resend is failing
      const email = c.req.query('email');
      if (!email) {
        throw new ApiError('Email parameter required', 'MISSING_EMAIL', 400);
      }

      // Check if we have a stored magic link for this email
      const storedLink = await c.env.SESSIONS.get(`dev-magic-link:${email}`);
      if (!storedLink) {
        return c.json(createApiErrorResponse('No magic link found for this email'), 404);
      }

      const linkData = JSON.parse(storedLink);
      return c.json(
        createApiSuccessResponse({
          message: 'Development magic link (Resend fallback)',
          email: email,
          magic_link: linkData.magicLink,
          token: linkData.token,
          expires_at: linkData.expiresAt,
          created_at: linkData.created,
        })
      );
    }

    throw new ApiError('Development endpoint not available', 'FORBIDDEN', 403);
  } catch (error) {
    console.error('Dev magic link error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve development magic link', 'DEV_MAGIC_LINK_ERROR', 500);
  }
}
