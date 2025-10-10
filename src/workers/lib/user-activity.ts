// ================================
// User Activity Service - New Unified Schema
// ================================
// Replaces rate_limits and auth_sessions tables with unified user_activity

import type { D1Database } from '@cloudflare/workers-types';
import type { UserActivityRecord } from '../../shared/types.js';
import { generateUUID } from '../../shared/utils/uuid.js';

// ================================
// Core User Activity Operations
// ================================

export async function recordUserActivity(
  db: D1Database,
  identifier: string,
  identifierType: 'email' | 'ip' | 'user_token',
  activityType: 'rate_limit' | 'auth_session' | 'submission',
  sessionData?: Record<string, unknown>
): Promise<string> {
  const id = generateUUID();
  const windowStart = getWindowStart(activityType);

  await db
    .prepare(
      `
    INSERT INTO user_activity (
      id, identifier, identifier_type, activity_type, 
      window_start, request_count, session_data, 
      last_activity_at, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(identifier, activity_type, window_start) 
    DO UPDATE SET 
      request_count = request_count + 1,
      last_activity_at = datetime('now')
  `
    )
    .bind(
      id,
      identifier,
      identifierType,
      activityType,
      windowStart,
      1,
      sessionData ? JSON.stringify(sessionData) : null,
      new Date().toISOString(),
      new Date().toISOString(),
      getExpiresAt(activityType)
    )
    .run();

  return id;
}

export async function getUserActivity(
  db: D1Database,
  identifier: string,
  activityType: 'rate_limit' | 'auth_session' | 'submission',
  windowStart?: string
): Promise<UserActivityRecord | null> {
  const window = windowStart || getWindowStart(activityType);

  const result = await db
    .prepare(
      `
    SELECT * FROM user_activity 
    WHERE identifier = ? AND activity_type = ? AND window_start = ?
  `
    )
    .bind(identifier, activityType, window)
    .first<UserActivityRecord>();

  return result || null;
}

export async function updateUserActivity(
  db: D1Database,
  id: string,
  updates: Partial<UserActivityRecord>
): Promise<boolean> {
  const setClause = Object.keys(updates)
    .map(key => `${key} = ?`)
    .join(', ');

  const values = Object.values(updates);

  const result = await db
    .prepare(
      `
    UPDATE user_activity 
    SET ${setClause}, last_activity_at = datetime('now')
    WHERE id = ?
  `
    )
    .bind(...values, id)
    .run();

  return result.success;
}

// ================================
// Rate Limiting Functions
// ================================

export async function checkRateLimit(
  db: D1Database,
  identifier: string,
  identifierType: 'email' | 'ip' | 'user_token',
  limit: number
): Promise<{
  allowed: boolean;
  remainingRequests: number;
  resetTime: string;
  windowStart: string;
}> {
  const windowStart = getWindowStart('rate_limit');
  const activity = await getUserActivity(db, identifier, 'rate_limit', windowStart);

  const requestCount = activity?.request_count || 0;
  const allowed = requestCount < limit;

  if (allowed) {
    await recordUserActivity(db, identifier, identifierType, 'rate_limit');
  }

  return {
    allowed,
    remainingRequests: Math.max(0, limit - requestCount - (allowed ? 1 : 0)),
    resetTime: getNextWindowStart('rate_limit'),
    windowStart,
  };
}

export async function resetRateLimit(db: D1Database, identifier: string): Promise<boolean> {
  const result = await db
    .prepare(
      `
    DELETE FROM user_activity 
    WHERE identifier = ? AND activity_type = 'rate_limit'
  `
    )
    .bind(identifier)
    .run();

  return result.success;
}

// ================================
// Session Management Functions
// ================================

export async function createSession(
  db: D1Database,
  userToken: string,
  sessionData: {
    userUuid?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: Record<string, unknown>;
  }
): Promise<string> {
  const sessionId = await recordUserActivity(
    db,
    userToken,
    'user_token',
    'auth_session',
    sessionData
  );

  return sessionId;
}

export async function getSession(
  db: D1Database,
  userToken: string
): Promise<UserActivityRecord | null> {
  return getUserActivity(db, userToken, 'auth_session');
}

export async function updateSession(
  db: D1Database,
  userToken: string,
  sessionData: Record<string, unknown>
): Promise<boolean> {
  const session = await getSession(db, userToken);
  if (!session) return false;

  return updateUserActivity(db, session.id, {
    session_data: JSON.stringify(sessionData),
  });
}

export async function deleteSession(db: D1Database, userToken: string): Promise<boolean> {
  const result = await db
    .prepare(
      `
    DELETE FROM user_activity 
    WHERE identifier = ? AND activity_type = 'auth_session'
  `
    )
    .bind(userToken)
    .run();

  return result.success;
}

export async function cleanExpiredSessions(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `
    DELETE FROM user_activity 
    WHERE activity_type = 'auth_session' 
    AND expires_at IS NOT NULL 
    AND expires_at < datetime('now')
  `
    )
    .run();

  return result.meta.changes || 0;
}

// ================================
// Submission Tracking Functions
// ================================

export async function trackSubmission(
  db: D1Database,
  userToken: string,
  submissionData: {
    submissionId: string;
    submissionType: string;
    artworkId?: string;
    artistId?: string;
  }
): Promise<string> {
  return recordUserActivity(db, userToken, 'user_token', 'submission', submissionData);
}

export async function getUserSubmissionActivity(
  db: D1Database,
  userToken: string,
  windowStart?: string
): Promise<UserActivityRecord[]> {
  const window = windowStart || getWindowStart('submission');

  const results = await db
    .prepare(
      `
    SELECT * FROM user_activity 
    WHERE identifier = ? AND activity_type = 'submission' AND window_start >= ?
    ORDER BY created_at DESC
  `
    )
    .bind(userToken, window)
    .all<UserActivityRecord>();

  return results.results || [];
}

// ================================
// Cleanup and Maintenance Functions
// ================================

export async function cleanExpiredActivity(
  db: D1Database,
  activityType?: 'rate_limit' | 'auth_session' | 'submission'
): Promise<number> {
  let query = `
    DELETE FROM user_activity 
    WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
  `;

  const params: string[] = [];

  if (activityType) {
    query += ` AND activity_type = ?`;
    params.push(activityType);
  }

  const result = await db
    .prepare(query)
    .bind(...params)
    .run();
  return result.meta.changes || 0;
}

export async function getUserActivityStats(
  db: D1Database,
  identifier: string
): Promise<{
  totalSessions: number;
  totalSubmissions: number;
  rateLimitHits: number;
  lastActivity: string | null;
}> {
  const stats = await db
    .prepare(
      `
    SELECT 
      activity_type,
      COUNT(*) as count,
      MAX(last_activity_at) as last_activity
    FROM user_activity 
    WHERE identifier = ?
    GROUP BY activity_type
  `
    )
    .bind(identifier)
    .all<{
      activity_type: string;
      count: number;
      last_activity: string;
    }>();

  const result = {
    totalSessions: 0,
    totalSubmissions: 0,
    rateLimitHits: 0,
    lastActivity: null as string | null,
  };

  for (const stat of stats.results || []) {
    switch (stat.activity_type) {
      case 'auth_session':
        result.totalSessions = stat.count;
        break;
      case 'submission':
        result.totalSubmissions = stat.count;
        break;
      case 'rate_limit':
        result.rateLimitHits = stat.count;
        break;
    }

    if (!result.lastActivity || stat.last_activity > result.lastActivity) {
      result.lastActivity = stat.last_activity;
    }
  }

  return result;
}

// ================================
// Helper Functions
// ================================

function getWindowStart(activityType: 'rate_limit' | 'auth_session' | 'submission'): string {
  const now = new Date();

  switch (activityType) {
    case 'rate_limit':
      // Hourly windows
      now.setMinutes(0, 0, 0);
      return now.toISOString();
    case 'submission':
      // Daily windows
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    case 'auth_session':
      // Session windows don't need time-based windowing
      return now.toISOString();
    default:
      return now.toISOString();
  }
}

function getNextWindowStart(activityType: 'rate_limit' | 'auth_session' | 'submission'): string {
  const now = new Date();

  switch (activityType) {
    case 'rate_limit':
      now.setHours(now.getHours() + 1, 0, 0, 0);
      return now.toISOString();
    case 'submission':
      now.setDate(now.getDate() + 1);
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    case 'auth_session':
      return now.toISOString();
    default:
      return now.toISOString();
  }
}

function getExpiresAt(activityType: 'rate_limit' | 'auth_session' | 'submission'): string {
  const now = new Date();

  switch (activityType) {
    case 'rate_limit':
      // Rate limit windows expire after 25 hours (1 hour + buffer)
      now.setHours(now.getHours() + 25);
      return now.toISOString();
    case 'auth_session':
      // Sessions expire after 30 days
      now.setDate(now.getDate() + 30);
      return now.toISOString();
    case 'submission':
      // Submission tracking expires after 7 days
      now.setDate(now.getDate() + 7);
      return now.toISOString();
    default:
      // Default 24 hour expiry
      now.setDate(now.getDate() + 1);
      return now.toISOString();
  }
}
