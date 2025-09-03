/**
 * Permission Management Utilities
 *
 * Provides functions for checking, granting, and revoking user permissions
 * with database-backed role management and caching for performance.
 */

import type { WorkerEnv, AuthContext } from '../types';

// Permission types that can be granted
export type Permission = 'moderator' | 'admin';

// Permission check result
export interface PermissionCheckResult {
  hasPermission: boolean;
  permission?: Permission;
  grantedAt?: string;
  grantedBy?: string;
}

// Cache for permission lookups to reduce database queries
const permissionCache = new Map<string, { permissions: Permission[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(
  db: D1Database,
  userUuid: string,
  permission: Permission
): Promise<PermissionCheckResult> {
  try {
    // Check cache first
    const cached = getCachedPermissions(userUuid);
    if (cached && cached.permissions.includes(permission)) {
      return { hasPermission: true, permission };
    }

    // Query database
    const stmt = db.prepare(`
      SELECT permission, granted_at, granted_by
      FROM user_permissions
      WHERE user_uuid = ? AND permission = ? AND is_active = 1
      LIMIT 1
    `);

    const result = await stmt.bind(userUuid, permission).first();

    if (result) {
      // Update cache
      updatePermissionCache(userUuid, [permission]);
      
      return {
        hasPermission: true,
        permission: result.permission as Permission,
        grantedAt: result.granted_at as string,
        grantedBy: result.granted_by as string,
      };
    }

    return { hasPermission: false };
  } catch (error) {
    console.error('Permission check error:', error);
    return { hasPermission: false };
  }
}

/**
 * Check if a user has any of the specified permissions
 */
export async function hasAnyPermission(
  db: D1Database,
  userUuid: string,
  permissions: Permission[]
): Promise<PermissionCheckResult> {
  try {
    // Check cache first
    const cached = getCachedPermissions(userUuid);
    if (cached) {
      const hasAny = permissions.some(p => cached.permissions.includes(p));
      if (hasAny) {
        const foundPermission = permissions.find(p => cached.permissions.includes(p));
        return { hasPermission: true, permission: foundPermission };
      }
    }

    // Query database
    const placeholders = permissions.map(() => '?').join(',');
    const stmt = db.prepare(`
      SELECT permission, granted_at, granted_by
      FROM user_permissions
      WHERE user_uuid = ? AND permission IN (${placeholders}) AND is_active = 1
      ORDER BY 
        CASE permission 
          WHEN 'admin' THEN 1 
          WHEN 'moderator' THEN 2 
          ELSE 3 
        END
      LIMIT 1
    `);

    const result = await stmt.bind(userUuid, ...permissions).first();

    if (result) {
      // Update cache with found permission
      updatePermissionCache(userUuid, [result.permission as Permission]);
      
      return {
        hasPermission: true,
        permission: result.permission as Permission,
        grantedAt: result.granted_at as string,
        grantedBy: result.granted_by as string,
      };
    }

    return { hasPermission: false };
  } catch (error) {
    console.error('Multi-permission check error:', error);
    return { hasPermission: false };
  }
}

/**
 * Get all active permissions for a user
 */
export async function getUserPermissions(
  db: D1Database,
  userUuid: string
): Promise<Permission[]> {
  try {
    // Check cache first
    const cached = getCachedPermissions(userUuid);
    if (cached) {
      return cached.permissions;
    }

    // Query database
    const stmt = db.prepare(`
      SELECT permission
      FROM user_permissions
      WHERE user_uuid = ? AND is_active = 1
      ORDER BY 
        CASE permission 
          WHEN 'admin' THEN 1 
          WHEN 'moderator' THEN 2 
          ELSE 3 
        END
    `);

    const results = await stmt.bind(userUuid).all();

    if (results.success) {
      const permissions = results.results.map(row => (row as { permission: Permission }).permission);
      updatePermissionCache(userUuid, permissions);
      return permissions;
    }

    return [];
  } catch (error) {
    console.error('Get user permissions error:', error);
    return [];
  }
}

/**
 * Grant a permission to a user
 */
export async function grantPermission(
  db: D1Database,
  userUuid: string,
  permission: Permission,
  grantedBy: string,
  notes?: string
): Promise<{ success: boolean; permissionId?: string; error?: string }> {
  try {
    // Check if permission already exists and is active
    const existing = await hasPermission(db, userUuid, permission);
    if (existing.hasPermission) {
      return { success: false, error: 'User already has this permission' };
    }

    // Generate permission ID
    const permissionId = crypto.randomUUID();

    // Insert new permission
    const stmt = db.prepare(`
      INSERT INTO user_permissions (id, user_uuid, permission, granted_by, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = await stmt.bind(permissionId, userUuid, permission, grantedBy, notes || null).run();

    if (result.success) {
      // Clear cache for this user
      clearUserPermissionCache(userUuid);
      
      return { success: true, permissionId };
    }

    return { success: false, error: 'Failed to insert permission record' };
  } catch (error) {
    console.error('Grant permission error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Revoke a permission from a user
 */
export async function revokePermission(
  db: D1Database,
  userUuid: string,
  permission: Permission,
  revokedBy: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if permission exists and is active
    const existing = await hasPermission(db, userUuid, permission);
    if (!existing.hasPermission) {
      return { success: false, error: 'User does not have this permission' };
    }

    // Revoke the permission (soft delete)
    const stmt = db.prepare(`
      UPDATE user_permissions
      SET is_active = 0, revoked_at = datetime('now'), revoked_by = ?, notes = COALESCE(notes || ' | ', '') || ?
      WHERE user_uuid = ? AND permission = ? AND is_active = 1
    `);

    const revokeReason = reason || 'Permission revoked';
    const result = await stmt.bind(revokedBy, revokeReason, userUuid, permission).run();

    if (result.success && result.changes > 0) {
      // Clear cache for this user
      clearUserPermissionCache(userUuid);
      
      return { success: true };
    }

    return { success: false, error: 'No active permission found to revoke' };
  } catch (error) {
    console.error('Revoke permission error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * List all users with permissions (for admin interface)
 */
export async function listUsersWithPermissions(
  db: D1Database,
  permission?: Permission
): Promise<Array<{
  user_uuid: string;
  permissions: Array<{
    permission: Permission;
    granted_at: string;
    granted_by: string;
    notes?: string;
  }>;
}>> {
  try {
    let whereClause = 'WHERE is_active = 1';
    let bindings: unknown[] = [];

    if (permission) {
      whereClause += ' AND permission = ?';
      bindings.push(permission);
    }

    const stmt = db.prepare(`
      SELECT user_uuid, permission, granted_at, granted_by, notes
      FROM user_permissions
      ${whereClause}
      ORDER BY user_uuid, 
        CASE permission 
          WHEN 'admin' THEN 1 
          WHEN 'moderator' THEN 2 
          ELSE 3 
        END
    `);

    const results = await stmt.bind(...bindings).all();

    if (!results.success) {
      return [];
    }

    // Group by user
    const userMap = new Map<string, Array<{
      permission: Permission;
      granted_at: string;
      granted_by: string;
      notes?: string;
    }>>();

    for (const row of results.results) {
      const record = row as {
        user_uuid: string;
        permission: Permission;
        granted_at: string;
        granted_by: string;
        notes?: string;
      };

      if (!userMap.has(record.user_uuid)) {
        userMap.set(record.user_uuid, []);
      }

      userMap.get(record.user_uuid)!.push({
        permission: record.permission,
        granted_at: record.granted_at,
        granted_by: record.granted_by,
        notes: record.notes || undefined,
      });
    }

    return Array.from(userMap.entries()).map(([user_uuid, permissions]) => ({
      user_uuid,
      permissions,
    }));
  } catch (error) {
    console.error('List users with permissions error:', error);
    return [];
  }
}

/**
 * Check if user is an admin (convenience function)
 */
export async function isAdmin(db: D1Database, userUuid: string): Promise<boolean> {
  const result = await hasPermission(db, userUuid, 'admin');
  return result.hasPermission;
}

/**
 * Check if user is a moderator or admin (convenience function)
 */
export async function isModerator(db: D1Database, userUuid: string): Promise<boolean> {
  const result = await hasAnyPermission(db, userUuid, ['moderator', 'admin']);
  return result.hasPermission;
}

/**
 * Enhanced auth context with database-backed permissions
 */
export async function enhanceAuthContext(
  db: D1Database,
  authContext: AuthContext
): Promise<AuthContext & { permissions: Permission[] }> {
  const permissions = await getUserPermissions(db, authContext.userToken);
  
  return {
    ...authContext,
    permissions,
    isReviewer: permissions.includes('moderator') || permissions.includes('admin'),
    isAdmin: permissions.includes('admin'),
  };
}

// Cache management functions
function getCachedPermissions(userUuid: string): { permissions: Permission[]; timestamp: number } | null {
  const cached = permissionCache.get(userUuid);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached;
  }
  return null;
}

function updatePermissionCache(userUuid: string, permissions: Permission[]): void {
  permissionCache.set(userUuid, {
    permissions,
    timestamp: Date.now(),
  });
}

function clearUserPermissionCache(userUuid: string): void {
  permissionCache.delete(userUuid);
}

/**
 * Clear all permission cache (useful for testing)
 */
export function clearPermissionCache(): void {
  permissionCache.clear();
}

/**
 * Validate permission type
 */
export function isValidPermission(permission: string): permission is Permission {
  return permission === 'moderator' || permission === 'admin';
}