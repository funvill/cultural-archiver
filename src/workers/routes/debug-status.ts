/**
 * Debug Status Endpoint
 * 
 * Provides comprehensive user and system information for debugging
 * Accessible at: /api/debug/status
 * 
 * This endpoint requires authentication and provides detailed information about:
 * - User database record
 * - Clerk authentication status
 * - User roles and permissions
 * - Recent submissions
 * - User lists
 */

import { Hono } from 'hono';
import type { WorkerEnv } from '../types';
import { getAuthContext, ensureUserToken } from '../middleware/clerk-auth';
import { createLogger } from '../../shared/logger';

const log = createLogger({ module: 'workers:routes:debug-status' });

const debugStatus = new Hono<{ Bindings: WorkerEnv }>();

// Apply authentication middleware to all routes
debugStatus.use('*', ensureUserToken);

/**
 * GET /api/debug/status
 * Get comprehensive debug information about current user
 */
debugStatus.get('/', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const clerkUserId = (c as any).clerkUserId as string | undefined;
    const clerkAuthenticated = (c as any).clerkAuthenticated as boolean;
    const clerkUserData = (c as any).clerkUserData as any;
    const db = c.env.DB;

    // System information
    const systemInfo = {
      environment: c.env.ENVIRONMENT || 'unknown',
      timestamp: new Date().toISOString(),
      api_version: '1.0.0',
      database_connected: !!db,
    };

    // Authentication context
    const authInfo = {
      user_token: authContext.userToken,
      clerk_user_id: clerkUserId || null,
      is_clerk_authenticated: clerkAuthenticated,
      is_verified_email: authContext.isVerifiedEmail,
      is_admin: authContext.isAdmin,
      is_moderator: authContext.isModerator,
      can_review: authContext.canReview,
      clerk_email: clerkUserData?.emailAddresses?.[0]?.emailAddress || null,
    };

    // Initialize response data
    let userRecord: any = null;
    let userRoles: any[] = [];
    let recentSubmissions: any[] = [];
    let userLists: any[] = [];

    // If user is authenticated (either Clerk or legacy), fetch detailed information
    if (authContext.userToken) {
      try {
        // 1. Get user record from database
        if (clerkUserId) {
          // Look up by Clerk ID
          userRecord = await db
            .prepare('SELECT * FROM users WHERE clerk_user_id = ?')
            .bind(clerkUserId)
            .first();
        } else {
          // Look up by UUID (legacy authentication)
          userRecord = await db
            .prepare('SELECT * FROM users WHERE uuid = ?')
            .bind(authContext.userToken)
            .first();
        }

        // 2. Get user roles
        const rolesResult = await db
          .prepare(`
            SELECT 
              role,
              granted_by,
              granted_at,
              is_active,
              notes
            FROM user_roles
            WHERE user_token = ?
            ORDER BY granted_at DESC
          `)
          .bind(authContext.userToken)
          .all();
        
        userRoles = rolesResult.results || [];

        // 3. Get last 3 submissions
        const submissionsResult = await db
          .prepare(`
            SELECT 
              id,
              submission_type,
              artwork_id,
              artist_id,
              status,
              created_at,
              notes,
              lat,
              lon
            FROM submissions
            WHERE user_token = ?
            ORDER BY created_at DESC
            LIMIT 3
          `)
          .bind(authContext.userToken)
          .all();
        
        recentSubmissions = submissionsResult.results || [];

        // 4. Get user lists
        const listsResult = await db
          .prepare(`
            SELECT 
              l.id,
              l.name,
              l.visibility,
              l.is_readonly,
              l.is_system_list,
              l.created_at,
              l.updated_at,
              COUNT(li.id) as item_count
            FROM lists l
            LEFT JOIN list_items li ON l.id = li.list_id
            WHERE l.owner_user_id = ?
            GROUP BY l.id
            ORDER BY l.created_at DESC
          `)
          .bind(authContext.userToken)
          .all();
        
        userLists = listsResult.results || [];

      } catch (dbError) {
        log.error('Failed to fetch user debug data', { error: dbError });
      }
    }

    // Build comprehensive response
    const debugData = {
      system: systemInfo,
      authentication: authInfo,
      user: {
        database_record: userRecord,
        roles: userRoles,
        permissions: {
          is_admin: authContext.isAdmin,
          is_moderator: authContext.isModerator,
          can_review: authContext.canReview,
        },
      },
      recent_activity: {
        submissions: recentSubmissions.map(sub => ({
          id: sub.id,
          type: sub.submission_type,
          status: sub.status,
          created_at: sub.created_at,
          artwork_id: sub.artwork_id || null,
          artist_id: sub.artist_id || null,
          has_location: !!(sub.lat && sub.lon),
          has_notes: !!sub.notes,
        })),
      },
      lists: userLists.map(list => ({
        id: list.id,
        name: list.name,
        visibility: list.visibility,
        is_readonly: !!list.is_readonly,
        is_system_list: !!list.is_system_list,
        item_count: list.item_count || 0,
        created_at: list.created_at,
      })),
      debug_info: {
        has_clerk_token: !!clerkUserId,
        has_database_user: !!userRecord,
        user_lookup_method: clerkUserId ? 'clerk_user_id' : 'uuid',
        active_roles_count: userRoles.filter((r: any) => r.is_active).length,
        total_submissions: recentSubmissions.length,
        total_lists: userLists.length,
      },
    };

    return c.json(debugData);

  } catch (error) {
    log.error('Debug status endpoint error', { error });
    return c.json({
      error: 'Failed to fetch debug status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

export { debugStatus };
