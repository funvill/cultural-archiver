/**
 * Authentication route handlers for magic link email verification
 * 
 * Provides endpoints for requesting and consuming magic links for email verification.
 * This allows users to verify their email addresses without traditional passwords.
 */

import type { Context } from 'hono';
import type { WorkerEnv, AuthContext } from '../../shared/types';
import { 
  createMagicLink,
  sendMagicLinkEmail,
  consumeMagicLink,
  getDevMagicLink,
} from '../lib/email';
import { ApiError } from '../lib/errors';

/**
 * POST /api/auth/magic-link
 * Request a magic link to be sent to email address
 */
export async function requestMagicLink(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const { email } = await c.req.json();
    
    // Validate email format (already validated by middleware, but double-check)
    if (!email || typeof email !== 'string') {
      throw new ApiError(
        'Valid email address is required',
        'INVALID_EMAIL',
        400
      );
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    const userToken = authContext.userToken;
    
    // Check if user already has a verified email
    const existingEmailData = await c.env.SESSIONS.get(`email:${userToken}`);
    if (existingEmailData) {
      const emailData = JSON.parse(existingEmailData);
      if (emailData.email === normalizedEmail) {
        return c.json({
          message: 'Email is already verified for this account',
          email: normalizedEmail,
          already_verified: true,
        });
      }
    }
    
    // Check rate limiting for magic link requests (max 3 per hour per email)
    const rateLimitKey = `magic-rate:${normalizedEmail}`;
    const currentRequests = await c.env.SESSIONS.get(rateLimitKey);
    const requestCount = currentRequests ? parseInt(currentRequests) : 0;
    
    if (requestCount >= 3) {
      throw new ApiError(
        'Too many verification requests. Please wait before requesting another link.',
        'RATE_LIMITED',
        429,
        { 
          details: {
            resetTime: 'in 1 hour',
            maxRequests: 3,
          }
        }
      );
    }
    
    // Update rate limit counter
    await c.env.SESSIONS.put(
      rateLimitKey,
      (requestCount + 1).toString(),
      { expirationTtl: 3600 } // 1 hour
    );
    
    // Create magic link
    const { token, expiresAt } = await createMagicLink(
      c.env,
      normalizedEmail,
      userToken,
      c.req.raw
    );
    
    // Generate magic link URL
    const baseUrl = c.env.FRONTEND_URL || 'https://cultural-archiver.com';
    const magicLinkUrl = `${baseUrl}/auth/verify?token=${token}`;
    
    // Send email
    await sendMagicLinkEmail(
      c.env,
      normalizedEmail,
      magicLinkUrl,
      expiresAt,
      c.req.raw
    );
    
    // Success response (don't expose token or other sensitive data)
    return c.json({
      message: 'Verification email sent successfully',
      email: normalizedEmail,
      expires_at: expiresAt.toISOString(),
      expires_in_minutes: 30,
    });
    
  } catch (error) {
    console.error('Magic link request error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to send verification email',
      'MAGIC_LINK_REQUEST_ERROR',
      500
    );
  }
}

/**
 * POST /api/auth/consume
 * Consume a magic link token to verify email
 */
export async function consumeMagicLinkToken(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const { token } = await c.req.json();
    
    if (!token || typeof token !== 'string') {
      throw new ApiError(
        'Valid verification token is required',
        'INVALID_TOKEN',
        400
      );
    }
    
    // Consume the magic link
    const { userToken, email } = await consumeMagicLink(c.env, token);
    
    // Verify that the token belongs to the current user
    const authContext = c.get('authContext');
    if (userToken !== authContext.userToken) {
      throw new ApiError(
        'Verification token does not match current user',
        'TOKEN_USER_MISMATCH',
        400
      );
    }
    
    // Success response
    return c.json({
      message: 'Email verified successfully',
      email,
      verified_at: new Date().toISOString(),
      user_token: userToken,
    });
    
  } catch (error) {
    console.error('Magic link consumption error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to verify email',
      'MAGIC_LINK_CONSUME_ERROR',
      500
    );
  }
}

/**
 * GET /api/auth/verify-status
 * Check current email verification status
 */
export async function getVerificationStatus(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const userToken = authContext.userToken;
    
    // Check if user has verified email
    const emailData = await c.env.SESSIONS.get(`email:${userToken}`);
    
    if (!emailData) {
      return c.json({
        verified: false,
        email: null,
        verified_at: null,
      });
    }
    
    const data = JSON.parse(emailData);
    
    return c.json({
      verified: true,
      email: data.email,
      verified_at: data.verifiedAt,
      verification_method: data.verificationMethod || 'magic_link',
    });
    
  } catch (error) {
    console.error('Verification status error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to check verification status',
      'VERIFICATION_STATUS_ERROR',
      500
    );
  }
}

/**
 * DELETE /api/auth/unverify
 * Remove email verification (for testing or user request)
 */
export async function removeEmailVerification(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const userToken = authContext.userToken;
    
    // Remove email verification from KV
    await c.env.SESSIONS.delete(`email:${userToken}`);
    
    return c.json({
      message: 'Email verification removed successfully',
      verified: false,
    });
    
  } catch (error) {
    console.error('Remove verification error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to remove email verification',
      'REMOVE_VERIFICATION_ERROR',
      500
    );
  }
}

/**
 * GET /api/auth/dev/magic-link
 * Development helper to get magic link for email (development only)
 */
export async function getDevMagicLinkEndpoint(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  if (c.env.ENVIRONMENT === 'production') {
    throw new ApiError(
      'Development endpoint not available in production',
      'FORBIDDEN',
      403
    );
  }
  
  try {
    const { email } = c.req.query();
    
    if (!email) {
      throw new ApiError(
        'Email parameter is required',
        'MISSING_EMAIL',
        400
      );
    }
    
    const magicLink = await getDevMagicLink(c.env, email);
    
    if (!magicLink) {
      return c.json({
        message: 'No magic link found for this email',
        email,
        magic_link: null,
      }, 404);
    }
    
    return c.json({
      message: 'Magic link found',
      email,
      magic_link: magicLink,
      note: 'This endpoint is only available in development',
    });
    
  } catch (error) {
    console.error('Dev magic link error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to retrieve development magic link',
      'DEV_MAGIC_LINK_ERROR',
      500
    );
  }
}

/**
 * POST /api/auth/resend
 * Resend verification email (with rate limiting)
 */
export async function resendVerificationEmail(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const userToken = authContext.userToken;
    
    // Check if user has a verified email already
    const emailData = await c.env.SESSIONS.get(`email:${userToken}`);
    if (emailData) {
      const data = JSON.parse(emailData);
      return c.json({
        message: 'Email is already verified',
        email: data.email,
        already_verified: true,
      });
    }
    
    // Get email from request body
    const { email } = await c.req.json();
    
    if (!email) {
      throw new ApiError(
        'Email address is required for resending verification',
        'MISSING_EMAIL',
        400
      );
    }
    
    // Use the same logic as requestMagicLink but with different messaging
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check rate limiting (stricter for resends: max 2 per hour)
    const rateLimitKey = `resend-rate:${normalizedEmail}`;
    const currentRequests = await c.env.SESSIONS.get(rateLimitKey);
    const requestCount = currentRequests ? parseInt(currentRequests) : 0;
    
    if (requestCount >= 2) {
      throw new ApiError(
        'Too many resend requests. Please wait before requesting another verification email.',
        'RATE_LIMITED',
        429,
        { 
          details: {
            resetTime: 'in 1 hour',
            maxRequests: 2,
          }
        }
      );
    }
    
    // Update rate limit counter
    await c.env.SESSIONS.put(
      rateLimitKey,
      (requestCount + 1).toString(),
      { expirationTtl: 3600 } // 1 hour
    );
    
    // Create new magic link
    const { token, expiresAt } = await createMagicLink(
      c.env,
      normalizedEmail,
      userToken,
      c.req.raw
    );
    
    // Generate magic link URL
    const baseUrl = c.env.FRONTEND_URL || 'https://cultural-archiver.com';
    const magicLinkUrl = `${baseUrl}/auth/verify?token=${token}`;
    
    // Send email
    await sendMagicLinkEmail(
      c.env,
      normalizedEmail,
      magicLinkUrl,
      expiresAt,
      c.req.raw
    );
    
    return c.json({
      message: 'Verification email resent successfully',
      email: normalizedEmail,
      expires_at: expiresAt.toISOString(),
      expires_in_minutes: 30,
    });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to resend verification email',
      'RESEND_ERROR',
      500
    );
  }
}