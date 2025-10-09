/**
 * Admin Route Handlers
 *
 * Provides admin-only endpoints for permission management, audit log viewing,
 * and system administration with proper authorization and rate limiting.
 */

import type { Context } from 'hono';
import type { WorkerEnv, AuthContext } from '../types';
import type {} from '../../shared/types';
import { isValidUUID } from '../../shared/utils/uuid.js';
import { ApiError } from '../lib/errors';
import { BadgeService } from '../lib/badges';
import {
  listUsersWithPermissions,
  grantPermission,
  revokePermission,
  isValidPermission,
  hasPermission,
  type Permission,
} from '../lib/permissions';
import {
  getAuditLogs,
  getAuditStatistics,
  logAdminAction,
  createAdminAuditContext,
  type AuditLogQuery,
  type AdminActionType,
} from '../lib/audit';

// Constants for input validation
const MAX_REASON_LENGTH = 500;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;

// Interfaces for request validation
interface GrantPermissionRequest {
  userUuid: string;
  permission: 'moderator' | 'admin';
  reason?: string;
}

interface RevokePermissionRequest {
  userUuid: string;
  permission: 'moderator' | 'admin';
  reason?: string;
}

/**
 * GET /api/admin/permissions
 * List all users with permissions (admin only)
 */
export async function getUserPermissions(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Get query parameters
    const { permission: filterPermission, search } = c.req.query();

    // Validate permission filter if provided
    if (filterPermission && !isValidPermission(filterPermission)) {
      throw new ApiError(
        'Invalid permission type. Must be "moderator" or "admin"',
        'INVALID_PERMISSION',
        400
      );
    }

    // Get users with permissions
    const users = await listUsersWithPermissions(
      c.env.DB,
      filterPermission as Permission | undefined,
      search
    );

    // Log admin action for audit trail
    const auditContext = createAdminAuditContext(c, authContext.userToken, 'view_audit_logs', {
      reason: `Viewed user permissions${filterPermission ? ` (filtered by ${filterPermission})` : ''}`,
    });

    const auditResult = await logAdminAction(c.env.DB, auditContext);
    if (!auditResult.success) {
      console.warn('Failed to log admin action:', auditResult.error);
    }

    return c.json({
      success: true,
      data: {
        users,
        total: users.length,
        filter: filterPermission || null,
        search: search || null,
        retrieved_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get user permissions error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve user permissions', 'PERMISSIONS_RETRIEVAL_ERROR', 500);
  }
}

/**
 * POST /api/admin/permissions/grant
 * Grant permission to a user (admin only)
 */
export async function grantUserPermission(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Parse and validate request body
    const body = await c.req.json();
    const { userUuid, permission, reason }: GrantPermissionRequest = body;

    // Validate required fields
    if (!userUuid || typeof userUuid !== 'string') {
      throw new ApiError('Valid userUuid is required', 'INVALID_USER_UUID', 400);
    }

    if (!permission || !isValidPermission(permission)) {
      throw new ApiError(
        'Valid permission is required. Must be "moderator" or "admin"',
        'INVALID_PERMISSION',
        400
      );
    }

    // Validate optional fields
    if (reason && (typeof reason !== 'string' || reason.length > MAX_REASON_LENGTH)) {
      throw new ApiError(
        `Reason must be a string with maximum length of ${MAX_REASON_LENGTH}`,
        'INVALID_REASON',
        400
      );
    }

    // Validate UUID format
    if (!isValidUUID(userUuid)) {
      throw new ApiError('Invalid UUID format for userUuid', 'INVALID_UUID_FORMAT', 400);
    }

    // Prevent self-modification of admin permissions
    if (userUuid === authContext.userToken && permission === 'admin') {
      throw new ApiError(
        'Cannot modify your own admin permissions',
        'SELF_MODIFICATION_FORBIDDEN',
        400
      );
    }

    // Grant the permission
    const result = await grantPermission(db, userUuid, permission, authContext.userToken, reason);

    if (!result.success) {
      throw new ApiError(
        result.error || 'Failed to grant permission',
        'PERMISSION_GRANT_FAILED',
        400
      );
    }

    // Log admin action for audit trail
    const auditContext = createAdminAuditContext(c, authContext.userToken, 'grant_permission', {
      targetUuid: userUuid,
      permissionType: permission,
      oldValue: null,
      newValue: { permission, granted_at: new Date().toISOString() },
      reason: reason || 'Permission granted via admin interface',
    });

    const auditResult = await logAdminAction(c.env.DB, auditContext);
    if (!auditResult.success) {
      console.warn('Failed to log admin action:', auditResult.error);
    }

    return c.json({
      success: true,
      data: {
        permission_id: result.permissionId,
        user_uuid: userUuid,
        permission,
        granted_by: authContext.userToken,
        granted_at: new Date().toISOString(),
        reason: reason || null,
      },
    });
  } catch (error) {
    console.error('Grant permission error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to grant permission', 'PERMISSION_GRANT_ERROR', 500);
  }
}

/**
 * POST /api/admin/permissions/revoke
 * Revoke permission from a user (admin only)
 */
export async function revokeUserPermission(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Parse and validate request body
    const body = await c.req.json();
    const { userUuid, permission, reason }: RevokePermissionRequest = body;

    // Validate required fields
    if (!userUuid || typeof userUuid !== 'string') {
      throw new ApiError('Valid userUuid is required', 'INVALID_USER_UUID', 400);
    }

    if (!permission || !isValidPermission(permission)) {
      throw new ApiError(
        'Valid permission is required. Must be "moderator" or "admin"',
        'INVALID_PERMISSION',
        400
      );
    }

    // Validate optional fields
    if (reason && (typeof reason !== 'string' || reason.length > MAX_REASON_LENGTH)) {
      throw new ApiError(
        `Reason must be a string with maximum length of ${MAX_REASON_LENGTH}`,
        'INVALID_REASON',
        400
      );
    }

    // Validate UUID format
    if (!isValidUUID(userUuid)) {
      throw new ApiError('Invalid UUID format for userUuid', 'INVALID_UUID_FORMAT', 400);
    }

    // Prevent self-modification of admin permissions
    if (userUuid === authContext.userToken && permission === 'admin') {
      throw new ApiError(
        'Cannot revoke your own admin permissions',
        'SELF_MODIFICATION_FORBIDDEN',
        400
      );
    }

    // Revoke the permission
    const result = await revokePermission(db, userUuid, permission, authContext.userToken, reason);

    if (!result.success) {
      throw new ApiError(
        result.error || 'Failed to revoke permission',
        'PERMISSION_REVOKE_FAILED',
        400
      );
    }

    // Log admin action for audit trail
    const auditContext = createAdminAuditContext(c, authContext.userToken, 'revoke_permission', {
      targetUuid: userUuid,
      permissionType: permission,
      oldValue: { permission, revoked_at: new Date().toISOString() },
      newValue: null,
      reason: reason || 'Permission revoked via admin interface',
    });

    const auditResult = await logAdminAction(c.env.DB, auditContext);
    if (!auditResult.success) {
      console.warn('Failed to log admin action:', auditResult.error);
    }

    return c.json({
      success: true,
      data: {
        user_uuid: userUuid,
        permission,
        revoked_by: authContext.userToken,
        revoked_at: new Date().toISOString(),
        reason: reason || null,
      },
    });
  } catch (error) {
    console.error('Revoke permission error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to revoke permission', 'PERMISSION_REVOKE_ERROR', 500);
  }
}

/**
 * GET /api/admin/audit
 * Get audit logs with filtering and pagination (admin only)
 */
export async function getAuditLogsEndpoint(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Parse query parameters
    const queryParams = c.req.query();
    const {
      type,
      userUuid,
      targetUuid,
      decision,
      actionType,
      startDate,
      endDate,
      page: pageStr,
      limit: limitStr,
    } = queryParams;

    // Validate and parse pagination
    const page = pageStr ? Math.max(1, parseInt(pageStr)) : 1;
    const limit = limitStr
      ? Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, parseInt(limitStr)))
      : 20;

    // Validate type filter
    if (type && !['moderation', 'admin'].includes(type)) {
      throw new ApiError(
        'Invalid type filter. Must be "moderation" or "admin"',
        'INVALID_TYPE_FILTER',
        400
      );
    }

    // Validate decision filter
    if (decision && !['approved', 'rejected', 'skipped'].includes(decision)) {
      throw new ApiError(
        'Invalid decision filter. Must be "approved", "rejected", or "skipped"',
        'INVALID_DECISION_FILTER',
        400
      );
    }

    // Validate actionType filter
    if (
      actionType &&
      !['grant_permission', 'revoke_permission', 'view_audit_logs'].includes(actionType)
    ) {
      throw new ApiError(
        'Invalid actionType filter. Must be "grant_permission", "revoke_permission", or "view_audit_logs"',
        'INVALID_ACTION_TYPE_FILTER',
        400
      );
    }

    // Validate date filters
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ApiError('Invalid startDate format. Must be ISO 8601', 'INVALID_START_DATE', 400);
    }

    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ApiError('Invalid endDate format. Must be ISO 8601', 'INVALID_END_DATE', 400);
    }

    // Build audit query
    const auditQuery: AuditLogQuery = {
      type: type as 'moderation' | 'admin' | undefined,
      userUuid,
      targetUuid,
      decision: decision as 'approved' | 'rejected' | 'skipped' | undefined,
      actionType: actionType as AdminActionType | undefined,
      startDate,
      endDate,
      page,
      limit,
    };

    // Get audit logs
    const result = await getAuditLogs(db, auditQuery);

    // Log admin action for audit trail
    const auditContext = createAdminAuditContext(c, authContext.userToken, 'view_audit_logs', {
      reason: `Viewed audit logs (page ${page}, ${limit} per page)${type ? `, type: ${type}` : ''}`,
    });

    const auditLogResult = await logAdminAction(c.env.DB, auditContext);
    if (!auditLogResult.success) {
      console.warn('Failed to log admin action:', auditLogResult.error);
    }

    return c.json({
      success: true,
      data: {
        records: result.records,
        pagination: result.pagination,
        filters: {
          type: type || null,
          userUuid: userUuid || null,
          targetUuid: targetUuid || null,
          decision: decision || null,
          actionType: actionType || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
        retrieved_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve audit logs', 'AUDIT_LOGS_RETRIEVAL_ERROR', 500);
  }
}

/**
 * GET /api/admin/statistics
 * Get comprehensive system and audit statistics (admin only)
 */
export async function getAdminStatistics(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Get query parameters
    const { days: daysStr } = c.req.query();
    const days = daysStr ? Math.max(1, Math.min(365, parseInt(daysStr))) : 30;

    // Get audit statistics
    const auditStats = await getAuditStatistics(db, days);

    // Get permission statistics
    const users = await listUsersWithPermissions(c.env.DB);
    const permissionStats = {
      totalUsers: users.length,
      moderators: users.filter(u => u.permissions.some(p => p.permission === 'moderator')).length,
      admins: users.filter(u => u.permissions.some(p => p.permission === 'admin')).length,
      activePermissions: users.reduce((sum, u) => sum + u.permissions.length, 0),
    };

    // Log admin action for audit trail
    const auditContext = createAdminAuditContext(c, authContext.userToken, 'view_audit_logs', {
      reason: `Viewed admin statistics (${days} days)`,
    });

    const auditResult = await logAdminAction(c.env.DB, auditContext);
    if (!auditResult.success) {
      console.warn('Failed to log admin action:', auditResult.error);
    }

    return c.json({
      success: true,
      data: {
        period_days: days,
        permissions: permissionStats,
        audit: auditStats,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get admin statistics error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve admin statistics', 'ADMIN_STATS_ERROR', 500);
  }
}

// Note: Data dump generation and listing endpoints were removed as part of decommissioning
// the public data dump system.

// ================================
// Badge Management Endpoints (Admin Only)
// ================================

/**
 * GET /api/admin/badges
 * Get all badges with statistics (admin only)
 */
export async function getAdminBadges(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const badgeService = new BadgeService(db);
    const badgesWithStats = await badgeService.getBadgeStatistics();

    return c.json({
      success: true,
      data: {
        badges: badgesWithStats,
        total: badgesWithStats.length,
        retrieved_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get admin badges error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve badge statistics', 'BADGE_STATS_ERROR', 500);
  }
}

/**
 * POST /api/admin/badges
 * Create a new badge (admin only)
 */
export async function createAdminBadge(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Parse and validate request body
    const body = await c.req.json();
    const {
      badge_key,
      title,
      description,
      icon_emoji,
      category,
      level,
      threshold_type,
      threshold_value,
    } = body;

    // Validate required fields
    if (!badge_key || typeof badge_key !== 'string' || badge_key.length < 2) {
      throw new ApiError(
        'Valid badge_key is required (minimum 2 characters)',
        'INVALID_BADGE_KEY',
        400
      );
    }

    if (!title || typeof title !== 'string' || title.length < 2) {
      throw new ApiError('Valid title is required (minimum 2 characters)', 'INVALID_TITLE', 400);
    }

    if (!description || typeof description !== 'string' || description.length < 10) {
      throw new ApiError(
        'Valid description is required (minimum 10 characters)',
        'INVALID_DESCRIPTION',
        400
      );
    }

    if (!icon_emoji || typeof icon_emoji !== 'string' || icon_emoji.length < 1) {
      throw new ApiError('Valid icon_emoji is required', 'INVALID_ICON', 400);
    }

    if (!category || typeof category !== 'string') {
      throw new ApiError('Valid category is required', 'INVALID_CATEGORY', 400);
    }

    if (typeof level !== 'number' || level < 1) {
      throw new ApiError('Valid level is required (minimum 1)', 'INVALID_LEVEL', 400);
    }

    if (!threshold_type || typeof threshold_type !== 'string') {
      throw new ApiError('Valid threshold_type is required', 'INVALID_THRESHOLD_TYPE', 400);
    }

    // Validate threshold_type values
    const validThresholdTypes = [
      'email_verified',
      'submission_count',
      'photo_count',
      'account_age',
    ];
    if (!validThresholdTypes.includes(threshold_type)) {
      throw new ApiError(
        `Invalid threshold_type. Must be one of: ${validThresholdTypes.join(', ')}`,
        'INVALID_THRESHOLD_TYPE',
        400
      );
    }

    // threshold_value validation depends on threshold_type
    if (threshold_type === 'email_verified') {
      // For email_verified, threshold_value should be null
      if (threshold_value !== null && threshold_value !== undefined) {
        throw new ApiError(
          'threshold_value must be null for email_verified badges',
          'INVALID_THRESHOLD_VALUE',
          400
        );
      }
    } else {
      // For other types, threshold_value must be a positive number
      if (typeof threshold_value !== 'number' || threshold_value < 1) {
        throw new ApiError(
          'threshold_value must be a positive number for non-verification badges',
          'INVALID_THRESHOLD_VALUE',
          400
        );
      }
    }

    const badgeService = new BadgeService(db);

    // Check if badge_key already exists
    const existingBadges = await badgeService.getAllBadges();
    const keyExists = existingBadges.some(b => b.badge_key === badge_key);
    if (keyExists) {
      throw new ApiError('Badge key already exists', 'DUPLICATE_BADGE_KEY', 400);
    }

    // Create the badge
    const badgeId = await badgeService.createBadge({
      badge_key,
      title,
      description,
      icon_emoji,
      category,
      level,
      threshold_type,
      threshold_value: threshold_type === 'email_verified' ? null : threshold_value,
    });

    return c.json({
      success: true,
      data: {
        badge_id: badgeId,
        badge_key,
        title,
        description,
        icon_emoji,
        category,
        level,
        threshold_type,
        threshold_value: threshold_type === 'email_verified' ? null : threshold_value,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Create badge error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to create badge', 'BADGE_CREATE_ERROR', 500);
  }
}

/**
 * PUT /api/admin/badges/:id
 * Update an existing badge (admin only)
 */
export async function updateAdminBadge(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const badgeId = c.req.param('id');
    if (!badgeId) {
      throw new ApiError('Badge ID is required', 'MISSING_BADGE_ID', 400);
    }

    // Parse request body
    const body = await c.req.json();
    const updates = body;

    // Validate that the badge exists
    const badgeService = new BadgeService(db);
    const existingBadge = await badgeService.getBadgeById(badgeId);
    if (!existingBadge) {
      throw new ApiError('Badge not found', 'BADGE_NOT_FOUND', 404);
    }

    // Validate updates
    if (
      updates.title !== undefined &&
      (typeof updates.title !== 'string' || updates.title.length < 2)
    ) {
      throw new ApiError('Title must be at least 2 characters', 'INVALID_TITLE', 400);
    }

    if (
      updates.description !== undefined &&
      (typeof updates.description !== 'string' || updates.description.length < 10)
    ) {
      throw new ApiError('Description must be at least 10 characters', 'INVALID_DESCRIPTION', 400);
    }

    if (updates.level !== undefined && (typeof updates.level !== 'number' || updates.level < 1)) {
      throw new ApiError('Level must be a positive number', 'INVALID_LEVEL', 400);
    }

    if (updates.threshold_type !== undefined) {
      const validThresholdTypes = [
        'email_verified',
        'submission_count',
        'photo_count',
        'account_age',
      ];
      if (!validThresholdTypes.includes(updates.threshold_type)) {
        throw new ApiError(
          `Invalid threshold_type. Must be one of: ${validThresholdTypes.join(', ')}`,
          'INVALID_THRESHOLD_TYPE',
          400
        );
      }
    }

    // Update the badge
    await badgeService.updateBadge(badgeId, updates);

    // Get updated badge for response
    const updatedBadge = await badgeService.getBadgeById(badgeId);

    return c.json({
      success: true,
      data: updatedBadge,
    });
  } catch (error) {
    console.error('Update badge error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to update badge', 'BADGE_UPDATE_ERROR', 500);
  }
}

/**
 * DELETE /api/admin/badges/:id
 * Deactivate a badge (admin only)
 */
export async function deactivateAdminBadge(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const badgeId = c.req.param('id');
    if (!badgeId) {
      throw new ApiError('Badge ID is required', 'MISSING_BADGE_ID', 400);
    }

    // Validate that the badge exists
    const badgeService = new BadgeService(db);
    const existingBadge = await badgeService.getBadgeById(badgeId);
    if (!existingBadge) {
      throw new ApiError('Badge not found', 'BADGE_NOT_FOUND', 404);
    }

    // Deactivate the badge
    await badgeService.deactivateBadge(badgeId);

    return c.json({
      success: true,
      data: {
        badge_id: badgeId,
        deactivated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Deactivate badge error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to deactivate badge', 'BADGE_DEACTIVATE_ERROR', 500);
  }
}
