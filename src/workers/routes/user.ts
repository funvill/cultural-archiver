/**
 * User management route handlers
 * Handles GET /api/me/submissions and user-related operations
 */

import type { Context } from 'hono';
import type { WorkerEnv, UserSubmissionsResponse, UserSubmissionInfo } from '../types';
import { createDatabaseService } from '../lib/database';
import { createSuccessResponse, UnauthorizedError } from '../lib/errors';
import { getUserToken, getAuthContext } from '../middleware/auth';
import { getValidatedData } from '../middleware/validation';
import { getRateLimitStatus } from '../middleware/rateLimit';
import { safeJsonParse } from '../lib/errors';

// Interfaces for database results
interface UserStatsResult {
  total_submissions: number;
  approved_submissions: number;
  pending_submissions: number;
  first_submission_at: string | null;
  last_submission_at: string | null;
}

interface RecentSubmissionsResult {
  count: number;
}

interface LastActiveResult {
  last_active: string;
}

/**
 * GET /api/me/submissions - User's Submissions
 * Returns user's pending and approved submissions
 */
export async function getUserSubmissions(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);

  if (!userToken) {
    throw new UnauthorizedError('User token required');
  }

  const validatedQuery = getValidatedData<{
    page?: number;
    per_page?: number;
  }>(c, 'query');

  const db = createDatabaseService(c.env.DB);

  // Set defaults
  const page = validatedQuery.page || 1;
  const perPage = validatedQuery.per_page || 20;

  try {
    // Get user submissions (excludes rejected)
    const result = await db.getUserSubmissions(userToken, page, perPage);

    // Format submissions with parsed photos
    const submissions: UserSubmissionInfo[] = result.submissions.map(submission => ({
      ...submission,
      photos_parsed: safeJsonParse<string[]>(submission.photos, []),
    }));

    const response: UserSubmissionsResponse = {
      submissions,
      total: result.total,
      page,
      per_page: perPage,
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Failed to get user submissions:', error);
    throw error;
  }
}

/**
 * GET /api/me/profile - User Profile Information
 * Returns user statistics and profile data
 */
export async function getUserProfile(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  const authContext = getAuthContext(c);

  if (!userToken) {
    throw new UnauthorizedError('User token required');
  }

  const db = createDatabaseService(c.env.DB);

  try {
    // Get user submission statistics
    const submissionStats = await getUserSubmissionStats(db.db, userToken);

    // Get rate limit status
    const rateLimitStatus = await getRateLimitStatus(c.env.RATE_LIMITS, userToken);

    // Get user preferences (if any stored in KV)
    const preferences = await getUserPreferences(c.env.SESSIONS, userToken);

    // Get debug information
    const userDetailedInfo = await getUserDetailedInfo(c.env, userToken);
    const userPermissions = await getUserPermissionsInfo(c.env, userToken);

    // Check database-backed permissions for accurate display
    const { isAdmin, isModerator } = await import('../lib/permissions');
    const isUserAdmin = await isAdmin(c.env.DB, userToken);
    const isUserModerator = await isModerator(c.env.DB, userToken);

    const profile = {
      user_token: userToken,
      // Deprecated: is_reviewer mirrors is_moderator for backward compatibility
      is_reviewer: isUserModerator,
      is_moderator: isUserModerator,
      can_review: isUserModerator || isUserAdmin,
      is_verified_email: authContext.isVerifiedEmail,
      statistics: submissionStats,
      rate_limits: rateLimitStatus,
      preferences,
      created_at: submissionStats.first_submission_at || new Date().toISOString(),
      debug: {
        user_info: userDetailedInfo,
        permissions: userPermissions.map(p => ({
          permission: p.permission,
          granted_at: p.granted_at,
          granted_by: p.granted_by,
          granted_by_email: p.granted_by_email,
          revoked_at: p.revoked_at,
          notes: p.notes,
          is_active: !p.revoked_at,
        })),
        auth_context: {
          user_token: userToken,
          // Deprecated alias
          is_reviewer: isUserModerator,
          is_moderator: isUserModerator,
          can_review: isUserModerator || isUserAdmin,
          is_admin: isUserAdmin,
          is_verified_email: authContext.isVerifiedEmail,
          is_authenticated: !!userDetailedInfo,
        },
        request_headers: {
          authorization: c.req.header('authorization') ? '[PRESENT]' : 'None',
          user_token: c.req.header('x-user-token') ? '[PRESENT]' : 'None',
          user_agent: c.req.header('user-agent') || 'Unknown',
        },
        rate_limits: {
          email_blocked: 'No', // Rate limit status doesn't track blocked status in current implementation
          ip_blocked: 'No',
          submissions_remaining: rateLimitStatus.submissions_remaining,
          queries_remaining: rateLimitStatus.queries_remaining,
        },
        timestamp: new Date().toISOString(),
      },
    };

    return c.json(createSuccessResponse(profile));
  } catch (error) {
    console.error('Failed to get user profile:', error);
    throw error;
  }
}

/**
 * PUT /api/me/preferences - Update User Preferences
 * Allows users to update their preferences
 */
export async function updateUserPreferences(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);

  if (!userToken) {
    throw new UnauthorizedError('User token required');
  }

  try {
    const preferences = await c.req.json();

    // Validate preferences structure
    const validPreferences = validateUserPreferences(preferences);

    // Store in KV
    await c.env.SESSIONS.put(
      `preferences:${userToken}`,
      JSON.stringify(validPreferences),
      { expirationTtl: 31536000 } // 1 year
    );

    return c.json(
      createSuccessResponse({
        message: 'Preferences updated successfully',
        preferences: validPreferences,
      })
    );
  } catch (error) {
    console.error('Failed to update user preferences:', error);
    throw error;
  }
}

/**
 * DELETE /api/me/account - Delete User Account
 * Allows users to delete their account and all associated data
 */
export async function deleteUserAccount(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);

  if (!userToken) {
    throw new UnauthorizedError('User token required');
  }

  const db = createDatabaseService(c.env.DB);

  try {
    // Note: This is a soft delete - we mark submissions as deleted but keep for audit
    // In a production system, you might want to anonymize rather than delete

    // Update all user submissions to remove personal data
    const deleteStmt = db.db.prepare(`
      UPDATE logbook 
      SET user_token = 'deleted-user', note = '[deleted]'
      WHERE user_token = ? AND status != 'approved'
    `);

    await deleteStmt.bind(userToken).run();

    // Remove user data from KV
    await Promise.all([
      c.env.SESSIONS.delete(`email:${userToken}`),
      c.env.SESSIONS.delete(`preferences:${userToken}`),
      c.env.RATE_LIMITS.delete(`rate_limit:submissions:${userToken}`),
      c.env.RATE_LIMITS.delete(`rate_limit:queries:${userToken}`),
    ]);

    return c.json(
      createSuccessResponse({
        message: 'Account deleted successfully',
        user_token: null,
      })
    );
  } catch (error) {
    console.error('Failed to delete user account:', error);
    throw error;
  }
}

/**
 * Get user submission statistics
 */
async function getUserSubmissionStats(
  db: D1Database,
  userToken: string
): Promise<{
  total_submissions: number;
  approved_submissions: number;
  pending_submissions: number;
  first_submission_at: string | null;
  last_submission_at: string | null;
}> {
  try {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_submissions,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_submissions,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_submissions,
        MIN(created_at) as first_submission_at,
        MAX(created_at) as last_submission_at
      FROM logbook 
      WHERE user_token = ? AND status != 'rejected'
    `);

    const result = await stmt.bind(userToken).first();
    return result
      ? (result as unknown as UserStatsResult)
      : {
          total_submissions: 0,
          approved_submissions: 0,
          pending_submissions: 0,
          first_submission_at: null,
          last_submission_at: null,
        };
  } catch (error) {
    console.error('Failed to get user submission stats:', error);
    return {
      total_submissions: 0,
      approved_submissions: 0,
      pending_submissions: 0,
      first_submission_at: null,
      last_submission_at: null,
    };
  }
}

/**
 * Get user preferences from KV storage
 */
async function getUserPreferences(
  kv: KVNamespace,
  userToken: string
): Promise<Record<string, unknown>> {
  try {
    const preferencesData = await kv.get(`preferences:${userToken}`);
    if (preferencesData) {
      return JSON.parse(preferencesData);
    }
  } catch (error) {
    console.warn('Failed to get user preferences:', error);
  }

  // Return default preferences
  return {
    email_notifications: false,
    privacy_level: 'standard',
    preferred_radius: 500,
    auto_submit: false,
  };
}

/**
 * Validate user preferences structure
 */
function validateUserPreferences(preferences: Record<string, unknown>): Record<string, unknown> {
  const validPreferences: Record<string, unknown> = {};

  // Email notifications
  if (typeof preferences.email_notifications === 'boolean') {
    validPreferences.email_notifications = preferences.email_notifications;
  }

  // Privacy level
  if (
    typeof preferences.privacy_level === 'string' &&
    ['minimal', 'standard', 'enhanced'].includes(preferences.privacy_level)
  ) {
    validPreferences.privacy_level = preferences.privacy_level;
  }

  // Preferred radius
  if (
    typeof preferences.preferred_radius === 'number' &&
    preferences.preferred_radius >= 50 &&
    preferences.preferred_radius <= 10000
  ) {
    validPreferences.preferred_radius = preferences.preferred_radius;
  }

  // Auto submit
  if (typeof preferences.auto_submit === 'boolean') {
    validPreferences.auto_submit = preferences.auto_submit;
  }

  // Theme preference
  if (
    typeof preferences.theme === 'string' &&
    ['light', 'dark', 'auto'].includes(preferences.theme)
  ) {
    validPreferences.theme = preferences.theme;
  }

  // Language preference
  if (typeof preferences.language === 'string' && preferences.language.length <= 10) {
    validPreferences.language = preferences.language;
  }

  return validPreferences;
}

/**
 * Get user activity summary
 * Useful for engagement analytics
 */
export async function getUserActivity(
  c: Context<{ Bindings: WorkerEnv }>,
  userToken: string
): Promise<{
  recent_submissions: number;
  recent_queries: number;
  activity_score: number;
  last_active: string | null;
}> {
  const db = createDatabaseService(c.env.DB);

  try {
    // Get recent submission activity (last 30 days)
    const recentSubmissionsStmt = db.db.prepare(`
      SELECT COUNT(*) as count
      FROM logbook 
      WHERE user_token = ? 
        AND created_at > datetime('now', '-30 days')
        AND status != 'rejected'
    `);

    const recentSubmissions = await recentSubmissionsStmt.bind(userToken).first();
    const submissionCount = (recentSubmissions as RecentSubmissionsResult | null)?.count || 0;

    // Get rate limit data to estimate query activity
    const rateLimitStatus = await getRateLimitStatus(c.env.RATE_LIMITS, userToken);
    const queryActivity = 60 - rateLimitStatus.queries_remaining; // Rough estimate

    // Calculate activity score (0-100)
    const activityScore = Math.min(100, submissionCount * 10 + queryActivity * 0.5);

    // Get last submission time as proxy for last active
    const lastActiveStmt = db.db.prepare(`
      SELECT MAX(created_at) as last_active
      FROM logbook
      WHERE user_token = ?
    `);

    const lastActiveResult = await lastActiveStmt.bind(userToken).first();
    const lastActive = (lastActiveResult as LastActiveResult | null)?.last_active || null;

    return {
      recent_submissions: submissionCount,
      recent_queries: queryActivity,
      activity_score: Math.round(activityScore),
      last_active: lastActive,
    };
  } catch (error) {
    console.error('Failed to get user activity:', error);
    return {
      recent_submissions: 0,
      recent_queries: 0,
      activity_score: 0,
      last_active: null,
    };
  }
}

/**
 * Export user data (GDPR compliance)
 * Returns all user data in a portable format
 */
export async function exportUserData(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);

  if (!userToken) {
    throw new UnauthorizedError('User token required');
  }

  const db = createDatabaseService(c.env.DB);

  try {
    // Get all user submissions
    const submissionsStmt = db.db.prepare(`
      SELECT * FROM logbook WHERE user_token = ?
    `);
    const submissions = await submissionsStmt.bind(userToken).all();

    // Get user preferences
    const preferences = await getUserPreferences(c.env.SESSIONS, userToken);

    // Get submission statistics
    const stats = await getUserSubmissionStats(db.db, userToken);

    const exportData = {
      export_date: new Date().toISOString(),
      user_token: userToken,
      statistics: stats,
      preferences,
      submissions: submissions.results,
      note: 'This export contains all data associated with your account.',
    };

    // Set headers for file download
    c.res.headers.set('Content-Type', 'application/json');
    c.res.headers.set(
      'Content-Disposition',
      `attachment; filename="cultural-archiver-export-${userToken.substring(0, 8)}.json"`
    );

    return c.json(exportData);
  } catch (error) {
    console.error('Failed to export user data:', error);
    throw error;
  }
}

/**
 * POST /api/test-email - Test Email Configuration
 * Sends a test email to verify Resend configuration
 * Development/testing endpoint only
 */
export async function sendTestEmail(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  // Only allow in development/staging environments
  if (c.env.ENVIRONMENT === 'production') {
    return c.json({ error: 'Test endpoint not available in production' }, 403);
  }

  try {
    const { sendTestEmail: sendTestEmailFn } = await import('../lib/resend-email');

    // Get email from request body or use default test email
    const body = await c.req.json().catch(() => ({}));
    const testEmail = body.email || '1633@funvill.com';

    console.log('Sending test email to:', testEmail);

    const result = await sendTestEmailFn(c.env, testEmail);

    if (result.success) {
      return c.json({
        success: true,
        message: 'Test email sent successfully!',
        email_id: result.id,
        sent_to: testEmail,
      });
    } else {
      return c.json(
        {
          success: false,
          error: result.error,
          sent_to: testEmail,
        },
        500
      );
    }
  } catch (error) {
    console.error('Test email failed:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Check worker logs for more information',
      },
      500
    );
  }
}

/**
 * Get detailed user information for debug purposes
 */
async function getUserDetailedInfo(
  env: WorkerEnv,
  userToken: string
): Promise<{
  uuid: string;
  email: string | null;
  email_verified: boolean;
  status: string;
  created_at: string;
  updated_at: string | null;
} | null> {
  try {
    const stmt = env.DB.prepare(`
      SELECT uuid, email, email_verified_at, status, created_at, last_login
      FROM users 
      WHERE uuid = ?
    `);

    const result = await stmt.bind(userToken).first();

    if (!result) {
      return null;
    }

    // Transform the result to match the expected format
    return {
      uuid: result.uuid as string,
      email: result.email as string | null,
      email_verified: !!(result.email_verified_at as string | null),
      status: result.status as string,
      created_at: result.created_at as string,
      updated_at: result.last_login as string | null,
    };
  } catch (error) {
    console.error('Error getting user detailed info:', error);
    return null;
  }
}

/**
 * Get user permissions information for debug purposes
 */
async function getUserPermissionsInfo(
  env: WorkerEnv,
  userToken: string
): Promise<
  Array<{
    permission: string;
    granted_at: string;
    granted_by: string;
    granted_by_email: string | null;
    revoked_at: string | null;
    notes: string | null;
  }>
> {
  try {
    const stmt = env.DB.prepare(`
      SELECT up.permission, up.granted_at, up.granted_by, up.revoked_at, up.notes,
             u_granter.email as granted_by_email
      FROM user_permissions up
      LEFT JOIN users u_granter ON up.granted_by = u_granter.uuid
      WHERE up.user_uuid = ?
      ORDER BY up.granted_at DESC
    `);

    const results = await stmt.bind(userToken).all();
    return results.success
      ? (results.results as Array<{
          permission: string;
          granted_at: string;
          granted_by: string;
          granted_by_email: string | null;
          revoked_at: string | null;
          notes: string | null;
        }>)
      : [];
  } catch (error) {
    console.error('Error getting user permissions info:', error);
    return [];
  }
}
