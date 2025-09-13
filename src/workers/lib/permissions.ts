/**
 * Permission Management Utilities
 *
 * Provides functions for checking, granting, and revoking user permissions
 * with database-backed role management and caching for performance.
 */

import type { AuthContext } from '../types';

// Permission types that can be granted
export type Permission = 'moderator' | 'admin';

// Enhanced auth context with permissions
export interface EnhancedAuthContext extends AuthContext {
  permissions: Permission[];
  isAdmin: boolean;
}

// Permission check result
export interface PermissionCheckResult {
  hasPermission: boolean;
  permission?: Permission | undefined;
  grantedAt?: string | undefined;
  grantedBy?: string | undefined;
}

// Cache for permission lookups to reduce database queries
// Implemented as LRU cache with size limits to prevent memory leaks
const permissionCache = new Map<string, { permissions: Permission[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000; // Maximum number of entries to prevent memory leaks

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

    // Query database using new user_roles table
    const stmt = db.prepare(`
      SELECT role, granted_at, granted_by
      FROM user_roles
      WHERE user_token = ? AND role = ? AND is_active = 1
      LIMIT 1
    `);

    const result = (await stmt.bind(userUuid, permission).first()) as
      | { role: string; granted_at?: string; granted_by?: string }
      | null;

    if (result && typeof result.role === 'string') {
      // Update cache
      updatePermissionCache(userUuid, [result.role as Permission]);

      return {
        hasPermission: true,
        permission: result.role as Permission,
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

    // Query database using new user_roles table
    const placeholders = permissions.map(() => '?').join(',');
    const stmt = db.prepare(`
      SELECT role, granted_at, granted_by
      FROM user_roles
      WHERE user_token = ? AND role IN (${placeholders}) AND is_active = 1
      ORDER BY 
        CASE role 
          WHEN 'admin' THEN 1 
          WHEN 'moderator' THEN 2 
          ELSE 3 
        END
      LIMIT 1
    `);

    const result = (await stmt.bind(userUuid, ...permissions).first()) as
      | { role: string; granted_at?: string; granted_by?: string }
      | null;

    if (result && typeof result.role === 'string') {
      // Update cache with found permission
      updatePermissionCache(userUuid, [result.role as Permission]);

      return {
        hasPermission: true,
        permission: result.role as Permission,
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
export async function getUserPermissions(db: D1Database, userUuid: string): Promise<Permission[]> {
  try {
    // Check cache first
    const cached = getCachedPermissions(userUuid);
    if (cached) {
      return cached.permissions;
    }

    // Query database using new user_roles table
    const stmt = db.prepare(`
      SELECT role
      FROM user_roles
      WHERE user_token = ? AND is_active = 1
      ORDER BY 
        CASE role 
          WHEN 'admin' THEN 1 
          WHEN 'moderator' THEN 2 
          ELSE 3 
        END
    `);

    const results = await stmt.bind(userUuid).all();

    if (results.success) {
      const permissions = results.results.map(
        row => (row as { role: Permission }).role
      );
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

    // Insert new role using new user_roles table
    const stmt = db.prepare(`
      INSERT INTO user_roles (id, user_token, role, granted_by, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = await stmt
      .bind(permissionId, userUuid, permission, grantedBy, notes || null)
      .run();

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

    // Revoke the permission (soft delete) using new user_roles table
    const stmt = db.prepare(`
      UPDATE user_roles
      SET is_active = 0, revoked_at = datetime('now'), revoked_by = ?, notes = COALESCE(notes || ' | ', '') || ?
      WHERE user_token = ? AND role = ? AND is_active = 1
    `);

    const revokeReason = reason || 'Permission revoked';
  const result = await stmt.bind(revokedBy, revokeReason, userUuid, permission).run();

  if (result.success && result.meta && result.meta.changes && result.meta.changes > 0) {
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
  permission?: Permission,
  search?: string
): Promise<
  Array<{
    user_uuid: string;
    email?: string;
    permissions: Array<{
      permission: Permission;
      granted_at: string;
      granted_by: string;
      notes?: string | undefined;
    }>;
  }>
> {
  try {
    let whereClause = 'WHERE up.is_active = 1';
    const bindings: unknown[] = [];

    if (permission) {
      whereClause += ' AND up.permission = ?';
      bindings.push(permission);
    }

    if (search && search.trim()) {
      whereClause += ' AND (LOWER(u.email) LIKE ? OR up.user_uuid LIKE ?)';
      const pattern = `%${search.trim().toLowerCase()}%`;
      bindings.push(pattern, pattern);
    }

    // NOTE: users table primary key column is 'uuid' (see docs/database.md), not 'user_uuid'.
    // The previous JOIN used u.user_uuid which caused a runtime SQL error ("no such column: u.user_uuid")
    // leading to the catch block returning an empty array and the admin UI showing no users.
    const stmt = db.prepare(`
      SELECT up.user_uuid, up.permission, up.granted_at, up.granted_by, up.notes, u.email
      FROM user_permissions up
      LEFT JOIN users u ON u.uuid = up.user_uuid
      ${whereClause}
      ORDER BY up.user_uuid,
        CASE up.permission 
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
    const userMap = new Map<
      string,
      Array<{
        permission: Permission;
        granted_at: string;
        granted_by: string;
        notes?: string;
      }>
    >();

    for (const row of results.results) {
      const record = row as {
        user_uuid: string;
        permission: Permission;
        granted_at: string;
        granted_by: string;
        notes?: string;
        email?: string | null;
      };

      if (!userMap.has(record.user_uuid)) {
        userMap.set(record.user_uuid, []);
      }

      userMap.get(record.user_uuid)!.push({
        permission: record.permission,
        granted_at: record.granted_at,
        granted_by: record.granted_by,
        ...(record.notes && { notes: record.notes }),
      });
    }

    // To preserve email we need a secondary map (since we only stored permissions array above)
    const emailMap = new Map<string, string | undefined>();
    for (const row of results.results) {
      const r = row as { user_uuid: string; email?: string | null };
      if (!emailMap.has(r.user_uuid)) {
        emailMap.set(r.user_uuid, r.email ?? undefined);
      }
    }

    return Array.from(userMap.entries()).map(([user_uuid, permissions]) => {
      const email = emailMap.get(user_uuid);
      return {
        user_uuid,
        ...(email ? { email } : {}),
        permissions,
      };
    });
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
): Promise<EnhancedAuthContext> {
  const permissions = await getUserPermissions(db, authContext.userToken);

  return {
    ...authContext,
    permissions,
  // Deprecated flag maintained
  // Deprecated alias: keep true when moderator/admin present
  isReviewer: permissions.includes('moderator') || permissions.includes('admin'),
  isModerator: permissions.includes('moderator') || permissions.includes('admin'),
  canReview: permissions.includes('moderator') || permissions.includes('admin'),
  isAdmin: permissions.includes('admin'),
  };
}

// Cache management functions with LRU eviction
function getCachedPermissions(
  userUuid: string
): { permissions: Permission[]; timestamp: number } | null {
  const cached = permissionCache.get(userUuid);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    // Move to end (most recently used) in LRU order
    permissionCache.delete(userUuid);
    permissionCache.set(userUuid, cached);
    return cached;
  }
  // Remove expired entry
  if (cached) {
    permissionCache.delete(userUuid);
  }
  return null;
}

function updatePermissionCache(userUuid: string, permissions: Permission[]): void {
  // Implement LRU eviction if cache is full
  if (permissionCache.size >= MAX_CACHE_SIZE && !permissionCache.has(userUuid)) {
    // Remove least recently used (first entry)
    const firstKey = permissionCache.keys().next().value;
    if (firstKey) {
      permissionCache.delete(firstKey);
    }
  }
  
  // Remove existing entry if present (for LRU reordering)
  permissionCache.delete(userUuid);
  
  // Add to end (most recently used)
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
