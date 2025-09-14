// ================================
// User Roles Service - New Unified Schema
// ================================
// Manages role-based permissions for administrative functions

import type { D1Database } from '@cloudflare/workers-types';
import type { UserRoleRecord } from '../../shared/types.js';

// ================================
// Core Role Management Functions
// ================================

export async function createUserRole(
  db: D1Database,
  roleData: {
    userToken: string;
    role: 'admin' | 'moderator' | 'curator' | 'reviewer';
    permissions: string[]; // Array of permission strings
    grantedBy: string;
    expiresAt?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  await db.prepare(`
    INSERT INTO user_roles (
      id, user_token, role, permissions, granted_by, granted_at,
      expires_at, metadata, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    roleData.userToken,
    roleData.role,
    JSON.stringify(roleData.permissions),
    roleData.grantedBy,
    now,
    roleData.expiresAt || null,
    roleData.metadata ? JSON.stringify(roleData.metadata) : null,
    'active',
    now,
    now
  ).run();

  return id;
}

export async function getUserRole(
  db: D1Database,
  id: string
): Promise<UserRoleRecord | null> {
  const result = await db.prepare(`
    SELECT * FROM user_roles WHERE id = ?
  `).bind(id).first<UserRoleRecord>();

  return result || null;
}

export async function getUserRolesByToken(
  db: D1Database,
  userToken: string,
  includeExpired: boolean = false
): Promise<UserRoleRecord[]> {
  let query = `
    SELECT * FROM user_roles 
    WHERE user_token = ? AND status = 'active'
  `;
  
  if (!includeExpired) {
    query += ` AND (expires_at IS NULL OR expires_at > datetime('now'))`;
  }
  
  query += ` ORDER BY granted_at DESC`;
  
  const results = await db.prepare(query).bind(userToken).all<UserRoleRecord>();
  return results.results || [];
}

export async function updateUserRole(
  db: D1Database,
  id: string,
  updates: Partial<UserRoleRecord>
): Promise<boolean> {
  const setClause = Object.keys(updates)
    .map(key => `${key} = ?`)
    .join(', ');
  
  const values = Object.values(updates);
  
  const result = await db.prepare(`
    UPDATE user_roles 
    SET ${setClause}, updated_at = datetime('now')
    WHERE id = ?
  `).bind(...values, id).run();

  return result.success;
}

export async function revokeUserRole(
  db: D1Database,
  id: string,
  revokedBy: string,
  reason?: string
): Promise<boolean> {
  const result = await db.prepare(`
    UPDATE user_roles 
    SET status = 'revoked', revoked_by = ?, revoked_at = datetime('now'),
        metadata = json_patch(COALESCE(metadata, '{}'), ?)
    WHERE id = ?
  `).bind(
    revokedBy,
    JSON.stringify({ revokeReason: reason || 'No reason provided' }),
    id
  ).run();

  return result.success;
}

// ================================
// Permission Checking Functions
// ================================

export async function hasPermission(
  db: D1Database,
  userToken: string,
  requiredPermission: string
): Promise<boolean> {
  const roles = await getUserRolesByToken(db, userToken, false);
  
  for (const role of roles) {
    try {
      if (!role.permissions) continue; // Skip roles without permissions
      const permissions = JSON.parse(role.permissions) as string[];
      if (permissions.includes(requiredPermission) || permissions.includes('*')) {
        return true;
      }
    } catch (error) {
      console.error('Error parsing permissions for role:', role.id, error);
    }
  }
  
  return false;
}

export async function hasRole(
  db: D1Database,
  userToken: string,
  requiredRole: 'admin' | 'moderator' | 'curator' | 'reviewer'
): Promise<boolean> {
  const roles = await getUserRolesByToken(db, userToken, false);
  return roles.some(role => role.role === requiredRole);
}

export async function hasAnyRole(
  db: D1Database,
  userToken: string,
  requiredRoles: ('admin' | 'moderator' | 'curator' | 'reviewer')[]
): Promise<boolean> {
  const roles = await getUserRolesByToken(db, userToken, false);
  return roles.some(role => {
    // Type guard to ensure role matches expected type
    const adminRole = role.role as 'admin' | 'moderator' | 'curator' | 'reviewer';
    return requiredRoles.includes(adminRole);
  });
}

export async function getUserPermissions(
  db: D1Database,
  userToken: string
): Promise<{
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
  canModerate: boolean;
  canCurate: boolean;
  canReview: boolean;
}> {
  const roles = await getUserRolesByToken(db, userToken, false);
  
  const allPermissions = new Set<string>();
  const userRoles = new Set<string>();
  
  for (const role of roles) {
    userRoles.add(role.role);
    try {
      if (!role.permissions) continue; // Skip roles without permissions
      const permissions = JSON.parse(role.permissions) as string[];
      permissions.forEach(permission => allPermissions.add(permission));
    } catch (error) {
      console.error('Error parsing permissions for role:', role.id, error);
    }
  }
  
  return {
    roles: Array.from(userRoles),
    permissions: Array.from(allPermissions),
    isAdmin: userRoles.has('admin'),
    canModerate: userRoles.has('admin') || userRoles.has('moderator'),
    canCurate: userRoles.has('admin') || userRoles.has('curator'),
    canReview: userRoles.has('admin') || userRoles.has('moderator') || userRoles.has('reviewer')
  };
}

// ================================
// Administrative Functions
// ================================

export async function getAllRoles(
  db: D1Database,
  filters: {
    role?: 'admin' | 'moderator' | 'curator' | 'reviewer';
    status?: 'active' | 'revoked' | 'expired';
    grantedBy?: string;
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<UserRoleRecord[]> {
  let query = `SELECT * FROM user_roles WHERE 1=1`;
  const params: (string | number)[] = [];
  
  if (filters.role) {
    query += ` AND role = ?`;
    params.push(filters.role);
  }
  
  if (filters.status) {
    query += ` AND status = ?`;
    params.push(filters.status);
  } else if (!filters.includeExpired) {
    query += ` AND (expires_at IS NULL OR expires_at > datetime('now'))`;
  }
  
  if (filters.grantedBy) {
    query += ` AND granted_by = ?`;
    params.push(filters.grantedBy);
  }
  
  query += ` ORDER BY granted_at DESC`;
  
  if (filters.limit) {
    query += ` LIMIT ?`;
    params.push(filters.limit);
    
    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(filters.offset);
    }
  }
  
  const results = await db.prepare(query).bind(...params).all<UserRoleRecord>();
  return results.results || [];
}

export async function getRoleStatistics(
  db: D1Database
): Promise<{
  totalRoles: number;
  activeRoles: number;
  revokedRoles: number;
  expiredRoles: number;
  rolesByType: Record<string, number>;
  rolesByGranter: Record<string, number>;
}> {
  const results = await db.prepare(`
    SELECT 
      role,
      status,
      granted_by,
      CASE 
        WHEN expires_at IS NOT NULL AND expires_at < datetime('now') THEN 'expired'
        ELSE status 
      END as effective_status,
      COUNT(*) as count
    FROM user_roles 
    GROUP BY role, status, granted_by
  `).all<{
    role: string;
    status: string;
    granted_by: string;
    effective_status: string;
    count: number;
  }>();

  const stats = {
    totalRoles: 0,
    activeRoles: 0,
    revokedRoles: 0,
    expiredRoles: 0,
    rolesByType: {} as Record<string, number>,
    rolesByGranter: {} as Record<string, number>
  };

  for (const row of results.results || []) {
    stats.totalRoles += row.count;
    
    switch (row.effective_status) {
      case 'active':
        stats.activeRoles += row.count;
        break;
      case 'revoked':
        stats.revokedRoles += row.count;
        break;
      case 'expired':
        stats.expiredRoles += row.count;
        break;
    }
    
    stats.rolesByType[row.role] = (stats.rolesByType[row.role] || 0) + row.count;
    stats.rolesByGranter[row.granted_by] = (stats.rolesByGranter[row.granted_by] || 0) + row.count;
  }

  return stats;
}

// ================================
// Role Templates and Presets
// ================================

export const ROLE_PERMISSIONS = {
  admin: [
    '*', // Admin has all permissions
  ],
  moderator: [
    'submissions.approve',
    'submissions.reject',
    'submissions.view',
    'artwork.edit',
    'artwork.approve',
    'logbook.moderate',
    'users.view',
    'audit.view'
  ],
  curator: [
    'artwork.create',
    'artwork.edit',
    'artist.create',
    'artist.edit',
    'submissions.review',
    'tags.edit',
    'metadata.edit'
  ],
  reviewer: [
    'submissions.view',
    'submissions.review',
    'artwork.view',
    'artist.view',
    'logbook.view'
  ]
} as const;

export async function createRoleFromTemplate(
  db: D1Database,
  userToken: string,
  role: 'admin' | 'moderator' | 'curator' | 'reviewer',
  grantedBy: string,
  options: {
    expiresAt?: string;
    additionalPermissions?: string[];
    metadata?: Record<string, unknown>;
  } = {}
): Promise<string> {
  const basePermissions = [...ROLE_PERMISSIONS[role]];
  const permissions = options.additionalPermissions 
    ? [...basePermissions, ...options.additionalPermissions]
    : basePermissions;
  
  return createUserRole(db, {
    userToken,
    role,
    permissions,
    grantedBy,
    ...(options.expiresAt && { expiresAt: options.expiresAt }),
    ...(options.metadata && { metadata: options.metadata })
  });
}

// ================================
// Cleanup and Maintenance Functions
// ================================

export async function cleanExpiredRoles(
  db: D1Database
): Promise<number> {
  const result = await db.prepare(`
    UPDATE user_roles 
    SET status = 'expired', updated_at = datetime('now')
    WHERE expires_at IS NOT NULL 
    AND expires_at < datetime('now') 
    AND status = 'active'
  `).run();

  return result.meta.changes || 0;
}

export async function extendRoleExpiry(
  db: D1Database,
  id: string,
  newExpiryDate: string,
  extendedBy: string
): Promise<boolean> {
  const result = await db.prepare(`
    UPDATE user_roles 
    SET expires_at = ?, updated_at = datetime('now'),
        metadata = json_patch(COALESCE(metadata, '{}'), ?)
    WHERE id = ? AND status = 'active'
  `).bind(
    newExpiryDate,
    JSON.stringify({ 
      extendedBy, 
      extendedAt: new Date().toISOString(),
      previousExpiry: null // Will be filled by trigger if needed
    }),
    id
  ).run();

  return result.success;
}

// ================================
// Security Functions
// ================================

export async function auditRoleChanges(
  _db: D1Database,
  action: 'grant' | 'revoke' | 'extend' | 'modify',
  roleId: string,
  performedBy: string,
  targetUser: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  // This would integrate with the audit log service
  // For now, we'll just log to console in development
  console.log('Role audit:', {
    action,
    roleId,
    performedBy,
    targetUser,
    details,
    timestamp: new Date().toISOString()
  });
}

export async function validateRoleTransition(
  _currentRole: string | null,
  newRole: 'admin' | 'moderator' | 'curator' | 'reviewer',
  _grantedBy: string,
  grantedByRoles: string[]
): Promise<{ valid: boolean; reason?: string }> {
  // Admins can grant any role
  if (grantedByRoles.includes('admin')) {
    return { valid: true };
  }
  
  // Moderators can only grant reviewer and curator roles
  if (grantedByRoles.includes('moderator')) {
    if (newRole === 'reviewer' || newRole === 'curator') {
      return { valid: true };
    }
    return { 
      valid: false, 
      reason: 'Moderators can only grant reviewer and curator roles' 
    };
  }
  
  // Curators can only grant reviewer roles
  if (grantedByRoles.includes('curator')) {
    if (newRole === 'reviewer') {
      return { valid: true };
    }
    return { 
      valid: false, 
      reason: 'Curators can only grant reviewer roles' 
    };
  }
  
  return { 
    valid: false, 
    reason: 'Insufficient permissions to grant roles' 
  };
}