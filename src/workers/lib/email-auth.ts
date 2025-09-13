/**
 * Magic Link Email System
 * Implements secure magic link generation, validation, email sending with Resend,
 * and rate limiting for the Cultural Archiver authentication system.
 */

import type { WorkerEnv } from '../types';
import type {
  MagicLinkRecord,
  RateLimitRecord,
  MagicLinkRequest,
  MagicLinkResponse,
  ConsumeMagicLinkRequest,
  ConsumeMagicLinkResponse,
} from '../../shared/types';
import {
  isValidEmail,
  RATE_LIMIT_MAGIC_LINKS_PER_EMAIL_PER_HOUR,
  RATE_LIMIT_MAGIC_LINKS_PER_IP_PER_HOUR,
  MAGIC_LINK_EXPIRY_HOURS,
  MAGIC_LINK_TOKEN_LENGTH,
} from '../../shared/types';
import { getUserByEmail, createUserWithUUIDClaim, updateUserEmailVerified } from './auth';
import { sendMagicLinkEmailWithResend } from './resend-email';

// Local rate limit info interface for magic link rate limiting
interface MagicLinkRateLimitInfo {
  identifier: string;
  identifier_type: 'email' | 'ip';
  requests_remaining: number;
  window_reset_at: string;
  is_blocked: boolean;
  blocked_until?: string;
}

// ================================
// Magic Link Token Generation
// ================================

/**
 * Generate a cryptographically secure magic link token
 * Uses Web Crypto API to generate 32 secure random bytes (64 hex characters)
 */
export function generateMagicLinkToken(): string {
  // Generate 32 secure random bytes
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Convert to hex string (64 characters)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate magic link token format
 */
export function validateMagicLinkToken(token: string): { isValid: boolean; error?: string } {
  if (!token) {
    return { isValid: false, error: 'Token is required' };
  }

  if (token.length !== MAGIC_LINK_TOKEN_LENGTH) {
    return { isValid: false, error: `Token must be ${MAGIC_LINK_TOKEN_LENGTH} characters long` };
  }

  if (!/^[a-f0-9]+$/i.test(token)) {
    return { isValid: false, error: 'Token must be hexadecimal' };
  }

  return { isValid: true };
}

// ================================
// Rate Limiting Functions
// ================================

/**
 * Check rate limit for an identifier (email or IP)
 */
export async function checkRateLimit(
  env: WorkerEnv,
  identifier: string,
  identifierType: 'email' | 'ip'
): Promise<MagicLinkRateLimitInfo> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

  const maxRequests =
    identifierType === 'email'
      ? RATE_LIMIT_MAGIC_LINKS_PER_EMAIL_PER_HOUR
      : RATE_LIMIT_MAGIC_LINKS_PER_IP_PER_HOUR;

  try {
    // Get current rate limit record
    const stmt = env.DB.prepare(`
      SELECT * FROM rate_limiting 
      WHERE identifier = ? AND identifier_type = ?
    `);

    const record = (await stmt.bind(identifier, identifierType).first()) as RateLimitRecord | null;

    if (!record) {
      // No existing record - create new one
      const insertStmt = env.DB.prepare(`
        INSERT INTO rate_limiting (identifier, identifier_type, request_count, window_start, last_request_at)
        VALUES (?, ?, 1, ?, ?)
      `);

      await insertStmt.bind(identifier, identifierType, now.toISOString(), now.toISOString()).run();

      return {
        identifier,
        identifier_type: identifierType,
        requests_remaining: maxRequests - 1,
        window_reset_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        is_blocked: false,
      };
    }

    const windowStartTime = new Date(record.window_start);
    const isCurrentWindow = windowStartTime > windowStart;

    if (!isCurrentWindow) {
      // Window has expired - reset counter
      const updateStmt = env.DB.prepare(`
        UPDATE rate_limiting 
        SET request_count = 1, window_start = ?, last_request_at = ?, blocked_until = NULL
        WHERE identifier = ? AND identifier_type = ?
      `);

      await updateStmt.bind(now.toISOString(), now.toISOString(), identifier, identifierType).run();

      return {
        identifier,
        identifier_type: identifierType,
        requests_remaining: maxRequests - 1,
        window_reset_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        is_blocked: false,
      };
    }

    // Check if currently blocked
    if (record.blocked_until && new Date(record.blocked_until) > now) {
      return {
        identifier,
        identifier_type: identifierType,
        requests_remaining: 0,
        window_reset_at: new Date(windowStartTime.getTime() + 60 * 60 * 1000).toISOString(),
        is_blocked: true,
        blocked_until: record.blocked_until,
      };
    }

    // Check if over limit
    if (record.request_count >= maxRequests) {
      // Block for remainder of window
      const blockUntil = new Date(windowStartTime.getTime() + 60 * 60 * 1000);

      const updateStmt = env.DB.prepare(`
        UPDATE rate_limiting 
        SET blocked_until = ?, last_request_at = ?
        WHERE identifier = ? AND identifier_type = ?
      `);

      await updateStmt
        .bind(blockUntil.toISOString(), now.toISOString(), identifier, identifierType)
        .run();

      return {
        identifier,
        identifier_type: identifierType,
        requests_remaining: 0,
        window_reset_at: blockUntil.toISOString(),
        is_blocked: true,
        blocked_until: blockUntil.toISOString(),
      };
    }

    // Increment counter
    const updateStmt = env.DB.prepare(`
      UPDATE rate_limiting 
      SET request_count = request_count + 1, last_request_at = ?
      WHERE identifier = ? AND identifier_type = ?
    `);

    await updateStmt.bind(now.toISOString(), identifier, identifierType).run();

    return {
      identifier,
      identifier_type: identifierType,
      requests_remaining: maxRequests - (record.request_count + 1),
      window_reset_at: new Date(windowStartTime.getTime() + 60 * 60 * 1000).toISOString(),
      is_blocked: false,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, be conservative and block
    return {
      identifier,
      identifier_type: identifierType,
      requests_remaining: 0,
      window_reset_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      is_blocked: true,
    };
  }
}

// ================================
// Magic Link Database Operations
// ================================

/**
 * Create a magic link record in the database
 */
export async function createMagicLinkRecord(
  env: WorkerEnv,
  email: string,
  _anonymousUUID: string,
  ipAddress?: string,
  userAgent?: string
): Promise<MagicLinkRecord> {
  const token = generateMagicLinkToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_EXPIRY_HOURS * 60 * 60 * 1000);

  // Check if this is for an existing user or account creation
  const existingUser = await getUserByEmail(env, email);
  const isSignup = !existingUser;

  const stmt = env.DB.prepare(`
    INSERT INTO magic_links (
      token, email, user_uuid, created_at, expires_at,
      ip_address, user_agent, is_signup
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await stmt
    .bind(
      token,
      email.toLowerCase().trim(),
      existingUser?.uuid || null,
      now.toISOString(),
      expiresAt.toISOString(),
      ipAddress || null,
      userAgent || null,
      isSignup
    )
    .run();

  const record: MagicLinkRecord = {
    token,
    email: email.toLowerCase().trim(),
    user_uuid: existingUser?.uuid || null,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    used_at: null,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    is_signup: isSignup,
  };

  console.info(`Magic link created: ${email} (${isSignup ? 'signup' : 'login'})`);
  return record;
}

/**
 * Get magic link record by token
 */
export async function getMagicLinkRecord(
  env: WorkerEnv,
  token: string
): Promise<MagicLinkRecord | null> {
  const stmt = env.DB.prepare('SELECT * FROM magic_links WHERE token = ?');
  const result = await stmt.bind(token).first();
  return result as MagicLinkRecord | null;
}

/**
 * Mark magic link as used
 */
export async function markMagicLinkUsed(env: WorkerEnv, token: string): Promise<void> {
  const now = new Date().toISOString();
  const stmt = env.DB.prepare('UPDATE magic_links SET used_at = ? WHERE token = ?');
  await stmt.bind(now, token).run();
}

// ================================
// Magic Link Email Sending
// ================================

/**
 * Send magic link email using Resend
 */
export async function sendMagicLinkEmail(
  env: WorkerEnv,
  magicLinkRecord: MagicLinkRecord,
  frontendUrl: string,
  anonymousSubmissions?: number
): Promise<void> {
  const magicLink = `${frontendUrl}/verify?token=${magicLinkRecord.token}`;
  const expiresAt = new Date(magicLinkRecord.expires_at).toLocaleString();

  try {
    await sendMagicLinkEmailWithResend(
      env,
      magicLinkRecord.email,
      magicLink,
      magicLinkRecord.is_signup,
      expiresAt,
      anonymousSubmissions
    );

    console.info(`Magic link email sent successfully to: ${magicLinkRecord.email}`);
  } catch (error) {
    console.error('Failed to send magic link email:', error);

    // Fallback: Log the magic link for manual access in development
    console.log('=== DEVELOPMENT FALLBACK: MAGIC LINK EMAIL ===');
    console.log('To:', magicLinkRecord.email);
    console.log('Magic Link:', magicLink);
    console.log('Expires:', expiresAt);
    console.log('Is Signup:', magicLinkRecord.is_signup);
    if (anonymousSubmissions) {
      console.log('Anonymous Submissions:', anonymousSubmissions);
    }
    console.log('============================================');

    // Store the magic link in KV for development access
    try {
      await env.SESSIONS.put(
        `dev-magic-link:${magicLinkRecord.email}`,
        JSON.stringify({
          token: magicLinkRecord.token,
          magicLink,
          expiresAt,
          created: new Date().toISOString(),
        }),
        { expirationTtl: MAGIC_LINK_EXPIRY_HOURS * 60 * 60 }
      );
    } catch (kvError) {
      console.error('Failed to store dev magic link in KV:', kvError);
    }

    // Re-throw the error so the calling code can handle it appropriately
    throw new Error(
      `Email delivery failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ================================
// Magic Link Request and Consumption
// ================================

/**
 * Request a magic link (signup or login)
 */
export async function requestMagicLink(
  env: WorkerEnv,
  request: MagicLinkRequest,
  anonymousUUID: string,
  ipAddress?: string,
  userAgent?: string
): Promise<MagicLinkResponse> {
  // Validate email
  if (!isValidEmail(request.email)) {
    return {
      success: false,
      message: 'Please enter a valid email address',
    };
  }

  const email = request.email.toLowerCase().trim();

  try {
    // Check rate limits for both email and IP
    const emailRateLimit = await checkRateLimit(env, email, 'email');
    const ipRateLimit = ipAddress ? await checkRateLimit(env, ipAddress, 'ip') : null;

    console.log('Rate limit check passed:', {
      emailBlocked: emailRateLimit.is_blocked,
      ipBlocked: ipRateLimit?.is_blocked,
      emailRemaining: emailRateLimit.requests_remaining,
      ipRemaining: ipRateLimit?.requests_remaining,
    });

    if (emailRateLimit.is_blocked) {
      return {
        success: false,
        message: `Too many requests for this email address. Please try again at ${new Date(emailRateLimit.window_reset_at).toLocaleTimeString()}.`,
        rate_limit_remaining: 0,
        rate_limit_reset_at: emailRateLimit.window_reset_at,
      };
    }

    if (ipRateLimit?.is_blocked) {
      return {
        success: false,
        message: `Too many requests from this IP address. Please try again at ${new Date(ipRateLimit.window_reset_at).toLocaleTimeString()}.`,
        rate_limit_remaining: 0,
        rate_limit_reset_at: ipRateLimit.window_reset_at,
      };
    }

    // Count anonymous submissions for this UUID
    const submissionsStmt = env.DB.prepare(`
      SELECT COUNT(*) as count FROM submissions WHERE user_token = ?
    `);
    const submissionsResult = await submissionsStmt.bind(anonymousUUID).first();
    const anonymousSubmissions = (submissionsResult as { count: number } | null)?.count || 0;

    console.log('Anonymous submissions count:', anonymousSubmissions);

    // Create magic link record
    console.log('Creating magic link record for:', email);
    const magicLinkRecord = await createMagicLinkRecord(
      env,
      email,
      anonymousUUID,
      ipAddress,
      userAgent
    );

    console.log('Magic link record created successfully:', magicLinkRecord.token);

    // Send email
    console.log('Attempting to send email...');
    await sendMagicLinkEmail(env, magicLinkRecord, env.FRONTEND_URL, anonymousSubmissions);

    console.log('Email sent successfully!');

    return {
      success: true,
      message: magicLinkRecord.is_signup
        ? 'Account creation email sent! Check your inbox and click the link to create your account.'
        : 'Sign-in email sent! Check your inbox and click the link to access your account.',
      rate_limit_remaining: Math.min(
        emailRateLimit.requests_remaining,
        ipRateLimit?.requests_remaining ?? emailRateLimit.requests_remaining
      ),
      rate_limit_reset_at: emailRateLimit.window_reset_at,
    };
  } catch (error) {
    console.error('Magic link request error:', error);
    return {
      success: false,
      message: 'Unable to send email at this time. Please try again later.',
    };
  }
}

/**
 * Consume a magic link token
 */
export async function consumeMagicLink(
  env: WorkerEnv,
  request: ConsumeMagicLinkRequest,
  currentUUID: string
): Promise<ConsumeMagicLinkResponse> {
  // Validate token format
  const tokenValidation = validateMagicLinkToken(request.token);
  if (!tokenValidation.isValid) {
    return {
      success: false,
      message: 'Invalid verification link format',
    };
  }

  try {
    // Get magic link record
    const magicLinkRecord = await getMagicLinkRecord(env, request.token);

    if (!magicLinkRecord) {
      return {
        success: false,
        message: 'Invalid or expired verification link',
      };
    }

    // Check if already used
    if (magicLinkRecord.used_at) {
      return {
        success: false,
        message: 'This verification link has already been used',
      };
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(magicLinkRecord.expires_at);
    if (expiresAt <= now) {
      return {
        success: false,
        message: 'This verification link has expired. Please request a new one.',
      };
    }

    // Mark as used
    await markMagicLinkUsed(env, request.token);

    let userUUID: string;
    let isNewAccount = false;

    if (magicLinkRecord.is_signup) {
      // Account creation - claim the current UUID
      try {
        const user = await createUserWithUUIDClaim(env, magicLinkRecord.email, currentUUID);
        userUUID = user.uuid;
        isNewAccount = true;

        // Mark email as verified
        await updateUserEmailVerified(env, userUUID);
      } catch (error) {
        console.error('Account creation error:', error);
        return {
          success: false,
          message: 'Unable to create account. This email may already be registered.',
        };
      }
    } else {
      // Login - use the account UUID
      if (!magicLinkRecord.user_uuid) {
        return {
          success: false,
          message: 'Invalid verification link - no associated account',
        };
      }

      userUUID = magicLinkRecord.user_uuid;

      // Mark email as verified and update last login
      await updateUserEmailVerified(env, userUUID);
      // Note: updateUserLastLogin would be called by the auth middleware
    }

    return {
      success: true,
      message: isNewAccount
        ? 'Account created successfully! Welcome to Cultural Archiver.'
        : 'Successfully signed in! Welcome back.',
      user_token: userUUID,
      is_new_account: isNewAccount,
    };
  } catch (error) {
    console.error('Magic link consumption error:', error);
    return {
      success: false,
      message: 'Unable to verify link at this time. Please try again.',
    };
  }
}

// ================================
// Cleanup and Maintenance
// ================================

/**
 * Clean up expired magic links and rate limit records
 */
export async function cleanupExpiredMagicLinks(env: WorkerEnv): Promise<{
  magic_links_cleaned: number;
  rate_limits_cleaned: number;
}> {
  const now = new Date().toISOString();

  try {
    // Clean up expired magic links
    const magicLinkStmt = env.DB.prepare(`
      DELETE FROM magic_links 
      WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < datetime('now', '-1 day'))
    `);
    const magicLinkResult = await magicLinkStmt.bind(now).run();

    // Clean up old rate limit records (older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rateLimitStmt = env.DB.prepare(`
      DELETE FROM rate_limiting 
      WHERE window_start < ? AND (blocked_until IS NULL OR blocked_until < ?)
    `);
    const rateLimitResult = await rateLimitStmt.bind(oneDayAgo, now).run();

    const magicLinksDeleted = (magicLinkResult as { changes?: number }).changes || 0;
    const rateLimitsDeleted = (rateLimitResult as { changes?: number }).changes || 0;

    console.info(
      `Cleaned up ${magicLinksDeleted} magic links and ${rateLimitsDeleted} rate limit records`
    );

    return {
      magic_links_cleaned: magicLinksDeleted,
      rate_limits_cleaned: rateLimitsDeleted,
    };
  } catch (error) {
    console.error('Cleanup error:', error);
    return {
      magic_links_cleaned: 0,
      rate_limits_cleaned: 0,
    };
  }
}
