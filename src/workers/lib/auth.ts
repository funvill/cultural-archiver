/**
 * Core Authentication Logic
 * Handles UUID generation, user creation with UUID claiming, session management,
 * and cross-device login functionality for the Cultural Archiver authentication system.
 */

import type { WorkerEnv } from '../types';
import type {
  UserRecord,
  AuthSessionRecord,
  UUIDClaimInfo,
  CreateSessionRequest,
  SessionInfo,
} from '../../shared/types';
import { isValidUUID, isValidEmail } from '../../shared/types';
import { generateUUID as generateUUIDFromConstants } from '../../shared/constants.js';

// ================================
// UUID Generation and Validation
// ================================

/**
 * Generate a cryptographically secure UUID v4
 * Uses the Web Crypto API for secure random generation
 */
export function generateUUID(): string {
  return generateUUIDFromConstants();
}

/**
 * Validate UUID format and return validation result
 */
export function validateUUID(uuid: string): { isValid: boolean; error?: string } {
  if (!uuid) {
    return { isValid: false, error: 'UUID is required' };
  }

  if (!isValidUUID(uuid)) {
    return { isValid: false, error: 'Invalid UUID format' };
  }

  return { isValid: true };
}

/**
 * Generate UUID with collision detection and retry logic
 * Retries up to 3 times if collision detected (extremely rare)
 */
export async function generateUniqueUUID(env: WorkerEnv): Promise<string> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const uuid = generateUUID();

    // Check for collision in users table
    const stmt = env.DB.prepare('SELECT uuid FROM users WHERE uuid = ?');
    const existing = await stmt.bind(uuid).first();

    if (!existing) {
      return uuid;
    }

    // Log collision (extremely rare event worth monitoring)
    console.warn(`UUID collision detected on attempt ${attempt}: ${uuid}`);

    if (attempt === maxRetries) {
      throw new Error('Failed to generate unique UUID after maximum retries');
    }
  }

  throw new Error('UUID generation failed');
}

// ================================
// User Creation and UUID Claiming
// ================================

/**
 * Create a new user account and claim the provided anonymous UUID
 * This is the one-time window when users can claim their anonymous submissions
 */
export async function createUserWithUUIDClaim(
  env: WorkerEnv,
  email: string,
  anonymousUUID: string
): Promise<UserRecord> {
  // Validate inputs
  if (!isValidEmail(email)) {
    throw new Error('Invalid email address format');
  }

  const uuidValidation = validateUUID(anonymousUUID);
  if (!uuidValidation.isValid) {
    throw new Error(uuidValidation.error || 'Invalid UUID');
  }

  const now = new Date().toISOString();

  try {
    // Check if email already exists
    const existingUser = await getUserByEmail(env, email);
    if (existingUser) {
      throw new Error('Email address is already registered');
    }

    // Check if UUID is already claimed by another user
    const existingUUIDUser = await getUserByUUID(env, anonymousUUID);
    if (existingUUIDUser) {
      throw new Error('UUID is already claimed by another account');
    }

    // Create the user with claimed UUID
    const stmt = env.DB.prepare(`
      INSERT INTO users (uuid, email, created_at, status)
      VALUES (?, ?, ?, 'active')
    `);

    await stmt.bind(anonymousUUID, email.toLowerCase().trim(), now).run();

    // Return the created user
    const user: UserRecord = {
      uuid: anonymousUUID,
      email: email.toLowerCase().trim(),
      created_at: now,
      last_login: null,
      email_verified_at: null,
      status: 'active',
    };

    console.info(`User created with UUID claim: ${email} -> ${anonymousUUID}`);
    return user;
  } catch (error) {
    console.error('Failed to create user with UUID claim:', error);
    throw error;
  }
}

/**
 * Get information about UUID claiming eligibility
 * Checks if the anonymous UUID can be claimed and provides context
 */
export async function getUUIDClaimInfo(
  env: WorkerEnv,
  anonymousUUID: string,
  email: string
): Promise<UUIDClaimInfo> {
  const uuidValidation = validateUUID(anonymousUUID);
  if (!uuidValidation.isValid) {
    return {
      anonymous_uuid: anonymousUUID,
      email: email,
      can_claim: false,
      existing_submissions_count: 0,
    };
  }

  // Check if UUID is already claimed
  const existingUser = await getUserByUUID(env, anonymousUUID);
  if (existingUser) {
    return {
      anonymous_uuid: anonymousUUID,
      email: email,
      can_claim: false,
      existing_submissions_count: 0,
    };
  }

  // Count existing submissions for this UUID
  const stmt = env.DB.prepare(`
    SELECT COUNT(*) as count 
    FROM submissions 
    WHERE user_token = ? AND submission_type = 'logbook_entry'
  `);
  const result = await stmt.bind(anonymousUUID).first();
  const submissionCount = (result as { count: number } | null)?.count || 0;

  return {
    anonymous_uuid: anonymousUUID,
    email: email,
    can_claim: true,
    existing_submissions_count: submissionCount,
  };
}

// ================================
// User Lookup Functions
// ================================

/**
 * Get user by UUID
 */
export async function getUserByUUID(env: WorkerEnv, uuid: string): Promise<UserRecord | null> {
  const stmt = env.DB.prepare('SELECT * FROM users WHERE uuid = ?');
  const result = await stmt.bind(uuid).first();
  return result as UserRecord | null;
}

/**
 * Get user by email address
 */
export async function getUserByEmail(env: WorkerEnv, email: string): Promise<UserRecord | null> {
  const stmt = env.DB.prepare('SELECT * FROM users WHERE email = ?');
  const result = await stmt.bind(email.toLowerCase().trim()).first();
  return result as UserRecord | null;
}

/**
 * Update user's last login timestamp
 */
export async function updateUserLastLogin(env: WorkerEnv, uuid: string): Promise<void> {
  const now = new Date().toISOString();
  const stmt = env.DB.prepare('UPDATE users SET last_login = ? WHERE uuid = ?');
  await stmt.bind(now, uuid).run();
}

/**
 * Update user's email verification timestamp
 */
export async function updateUserEmailVerified(env: WorkerEnv, uuid: string): Promise<void> {
  const now = new Date().toISOString();
  const stmt = env.DB.prepare('UPDATE users SET email_verified_at = ? WHERE uuid = ?');
  await stmt.bind(now, uuid).run();
}

// ================================
// Session Management
// ================================

/**
 * Create a secure hash of a session token
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a secure session token (for client storage)
 */
export function generateSessionToken(): string {
  // Generate 32 secure random bytes as hex string
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new authentication session
 */
export async function createSession(
  env: WorkerEnv,
  request: CreateSessionRequest
): Promise<{ session: AuthSessionRecord; token: string }> {
  const sessionId = generateUUID();
  const sessionToken = generateSessionToken();
  const tokenHash = await hashToken(sessionToken);
  const now = new Date().toISOString();

  const stmt = env.DB.prepare(`
    INSERT INTO auth_sessions (
      id, user_uuid, token_hash, created_at, last_accessed_at,
      ip_address, user_agent, is_active, device_info
    ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)
  `);

  const deviceInfo = request.device_info ? JSON.stringify(request.device_info) : null;

  await stmt
    .bind(
      sessionId,
      request.user_uuid,
      tokenHash,
      now,
      now,
      request.ip_address,
      request.user_agent,
      deviceInfo
    )
    .run();

  const session: AuthSessionRecord = {
    id: sessionId,
    user_uuid: request.user_uuid,
    token_hash: tokenHash,
    created_at: now,
    last_accessed_at: now,
    expires_at: null, // Persistent session
    ip_address: request.ip_address || null,
    user_agent: request.user_agent || null,
    is_active: true,
    device_info: deviceInfo,
  };

  return { session, token: sessionToken };
}

/**
 * Validate a session token and return session info
 */
export async function validateSession(
  env: WorkerEnv,
  token: string
): Promise<AuthSessionRecord | null> {
  try {
    const tokenHash = await hashToken(token);

    const stmt = env.DB.prepare(`
      SELECT * FROM auth_sessions 
      WHERE token_hash = ? AND is_active = TRUE
    `);

    const session = (await stmt.bind(tokenHash).first()) as AuthSessionRecord | null;

    if (session) {
      // Update last accessed timestamp
      const now = new Date().toISOString();
      const updateStmt = env.DB.prepare(`
        UPDATE auth_sessions 
        SET last_accessed_at = ? 
        WHERE id = ?
      `);
      await updateStmt.bind(now, session.id).run();

      session.last_accessed_at = now;
    }

    return session;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Deactivate a session (logout)
 */
export async function deactivateSession(env: WorkerEnv, sessionId: string): Promise<void> {
  const stmt = env.DB.prepare('UPDATE auth_sessions SET is_active = FALSE WHERE id = ?');
  await stmt.bind(sessionId).run();
}

/**
 * Deactivate all sessions for a user (global logout)
 */
export async function deactivateAllUserSessions(env: WorkerEnv, userUUID: string): Promise<void> {
  const stmt = env.DB.prepare('UPDATE auth_sessions SET is_active = FALSE WHERE user_uuid = ?');
  await stmt.bind(userUUID).run();
}

/**
 * Get active sessions for a user
 */
export async function getUserSessions(env: WorkerEnv, userUUID: string): Promise<SessionInfo[]> {
  const stmt = env.DB.prepare(`
    SELECT id, user_uuid, created_at, last_accessed_at, ip_address, user_agent
    FROM auth_sessions 
    WHERE user_uuid = ? AND is_active = TRUE
    ORDER BY last_accessed_at DESC
  `);

  const results = await stmt.bind(userUUID).all();

  return (results.results || []).map((row: Record<string, unknown>): SessionInfo => {
    const session: SessionInfo = {
      id: row.id as string,
      user_uuid: row.user_uuid as string,
      created_at: row.created_at as string,
      last_accessed_at: row.last_accessed_at as string,
      is_current: false, // Will be set by caller based on current session
    };

    if (row.ip_address && row.ip_address !== null) {
      session.ip_address = row.ip_address as string;
    }

    if (row.user_agent && row.user_agent !== null) {
      session.user_agent = row.user_agent as string;
    }

    return session;
  });
}

// ================================
// UUID Replacement for Cross-Device Login
// ================================

/**
 * Replace browser UUID with account UUID for cross-device login
 * This ensures users see their content when logging in from a different device
 */
export function replaceUUIDForCrossDeviceLogin(
  browserUUID: string,
  accountUUID: string
): { needsReplacement: boolean; newUUID: string } {
  if (browserUUID === accountUUID) {
    return {
      needsReplacement: false,
      newUUID: accountUUID,
    };
  }

  // Different UUIDs - replace browser UUID with account UUID
  console.info(`Cross-device login detected: ${browserUUID} -> ${accountUUID}`);

  return {
    needsReplacement: true,
    newUUID: accountUUID,
  };
}

// ================================
// Session Cleanup Utilities
// ================================

/**
 * Clean up expired and inactive sessions
 * Should be run periodically to maintain database performance
 */
export async function cleanupExpiredSessions(env: WorkerEnv): Promise<number> {
  // Remove inactive sessions older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const stmt = env.DB.prepare(`
    DELETE FROM auth_sessions 
    WHERE is_active = FALSE 
    AND last_accessed_at < ?
  `);

  const result = await stmt.bind(thirtyDaysAgo.toISOString()).run();

  const changes = (result as { changes?: number }).changes || 0;
  console.info(`Cleaned up ${changes} expired sessions`);
  return changes;
}

/**
 * Get authentication statistics for monitoring
 */
export async function getAuthStats(env: WorkerEnv): Promise<{
  total_users: number;
  verified_users: number;
  active_sessions: number;
  users_created_today: number;
}> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const queries = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as count FROM users').first(),
    env.DB.prepare(
      'SELECT COUNT(*) as count FROM users WHERE email_verified_at IS NOT NULL'
    ).first(),
    env.DB.prepare('SELECT COUNT(*) as count FROM auth_sessions WHERE is_active = TRUE').first(),
    env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE created_at LIKE ?')
      .bind(`${today}%`)
      .first(),
  ]);

  type CountResult = { count: number } | null;

  return {
    total_users: (queries[0] as CountResult)?.count || 0,
    verified_users: (queries[1] as CountResult)?.count || 0,
    active_sessions: (queries[2] as CountResult)?.count || 0,
    users_created_today: (queries[3] as CountResult)?.count || 0,
  };
}
