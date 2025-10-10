// ================================
// Audit Log Service - New Unified Schema
// ================================
// Replaces various audit trails with unified audit_log table

import type { D1Database } from '@cloudflare/workers-types';
import type { AuditLogRecord } from '../../shared/types.js';
import { generateUUID } from '../../shared/utils/uuid.js';

// ================================
// Core Audit Logging Functions
// ================================

export async function createAuditLog(
  db: D1Database,
  logData: {
    entityType: 'artwork' | 'artist' | 'submission' | 'user_activity' | 'user_role';
    entityId: string;
    action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'view' | 'export';
    userToken?: string | undefined;
    moderatorToken?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    oldData?: Record<string, unknown> | undefined;
    newData?: Record<string, unknown> | undefined;
    metadata?: Record<string, unknown> | undefined;
    reason?: string | undefined;
  }
): Promise<string> {
  const id = generateUUID();
  const now = new Date().toISOString();

  // Combine old_data, new_data, and metadata into action_data JSON
  const actionData: Record<string, unknown> = {};
  if (logData.oldData) actionData.old_data = logData.oldData;
  if (logData.newData) actionData.new_data = logData.newData;
  if (logData.metadata) actionData.metadata = logData.metadata;

  await db
    .prepare(
      `
    INSERT INTO audit_log (
      id, entity_type, entity_id, action_type, user_token, moderator_token,
      action_data, reason, ip_address, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .bind(
      id,
      logData.entityType,
      logData.entityId,
      logData.action,
      logData.userToken || null,
      logData.moderatorToken || null,
      Object.keys(actionData).length > 0 ? JSON.stringify(actionData) : null,
      logData.reason || null,
      logData.ipAddress || null,
      logData.userAgent || null,
      now
    )
    .run();

  return id;
}

export async function getAuditLog(db: D1Database, id: string): Promise<AuditLogRecord | null> {
  const result = await db
    .prepare(
      `
    SELECT * FROM audit_log WHERE id = ?
  `
    )
    .bind(id)
    .first<AuditLogRecord>();

  return result || null;
}

export async function getAuditLogs(
  db: D1Database,
  filters: {
    entityType?: 'artwork' | 'artist' | 'submission' | 'user_activity' | 'user_role';
    entityId?: string;
    action?: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'view' | 'export';
    userToken?: string;
    ipAddress?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<AuditLogRecord[]> {
  let query = `SELECT * FROM audit_log WHERE 1=1`;
  const params: (string | number)[] = [];

  if (filters.entityType) {
    query += ` AND entity_type = ?`;
    params.push(filters.entityType);
  }

  if (filters.entityId) {
    query += ` AND entity_id = ?`;
    params.push(filters.entityId);
  }

  if (filters.action) {
    query += ` AND action_type = ?`;
    params.push(filters.action);
  }

  if (filters.userToken) {
    query += ` AND user_token = ?`;
    params.push(filters.userToken);
  }

  if (filters.ipAddress) {
    query += ` AND ip_address = ?`;
    params.push(filters.ipAddress);
  }

  if (filters.startDate) {
    query += ` AND created_at >= ?`;
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    query += ` AND created_at <= ?`;
    params.push(filters.endDate);
  }

  query += ` ORDER BY created_at DESC`;

  if (filters.limit) {
    query += ` LIMIT ?`;
    params.push(filters.limit);

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(filters.offset);
    }
  }

  const results = await db
    .prepare(query)
    .bind(...params)
    .all<AuditLogRecord>();
  return results.results || [];
}

// ================================
// Entity-Specific Audit Functions
// ================================

export async function auditArtworkChange(
  db: D1Database,
  artworkId: string,
  action: 'create' | 'update' | 'delete' | 'approve' | 'view',
  userToken?: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
  context?: {
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  return createAuditLog(db, {
    entityType: 'artwork',
    entityId: artworkId,
    action,
    userToken,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    oldData,
    newData,
    metadata: context?.metadata,
  });
}

export async function auditArtistChange(
  db: D1Database,
  artistId: string,
  action: 'create' | 'update' | 'delete' | 'approve' | 'view',
  userToken?: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
  context?: {
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  return createAuditLog(db, {
    entityType: 'artist',
    entityId: artistId,
    action,
    userToken,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    oldData,
    newData,
    metadata: context?.metadata,
  });
}

export async function auditSubmissionChange(
  db: D1Database,
  submissionId: string,
  action: 'create' | 'update' | 'approve' | 'reject',
  userToken?: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
  context?: {
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  return createAuditLog(db, {
    entityType: 'submission',
    entityId: submissionId,
    action,
    userToken,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    oldData,
    newData,
    metadata: context?.metadata,
  });
}

export async function auditUserActivityChange(
  db: D1Database,
  activityId: string,
  action: 'create' | 'update' | 'delete',
  userToken?: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
  context?: {
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  return createAuditLog(db, {
    entityType: 'user_activity',
    entityId: activityId,
    action,
    userToken,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    oldData,
    newData,
    metadata: context?.metadata,
  });
}

export async function auditUserRoleChange(
  db: D1Database,
  roleId: string,
  action: 'create' | 'update' | 'delete',
  userToken?: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
  context?: {
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  return createAuditLog(db, {
    entityType: 'user_role',
    entityId: roleId,
    action,
    userToken,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    oldData,
    newData,
    metadata: context?.metadata,
  });
}

// ================================
// Security and Privacy Functions
// ================================

export async function auditDataExport(
  db: D1Database,
  userToken: string,
  exportType: 'user_data' | 'artwork_data' | 'full_database',
  recordCount: number,
  context?: {
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  return createAuditLog(db, {
    entityType: 'user_activity',
    entityId: userToken,
    action: 'export',
    userToken,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    metadata: {
      exportType,
      recordCount,
      ...context?.metadata,
    },
  });
}

export async function auditSuspiciousActivity(
  db: D1Database,
  entityType: 'artwork' | 'artist' | 'submission' | 'user_activity',
  entityId: string,
  suspiciousAction: string,
  riskLevel: 'low' | 'medium' | 'high',
  context?: {
    userToken?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  return createAuditLog(db, {
    entityType,
    entityId,
    action: 'view', // Mark as view for suspicious activity tracking
    userToken: context?.userToken,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    metadata: {
      suspiciousAction,
      riskLevel,
      flaggedAt: new Date().toISOString(),
      ...context?.metadata,
    },
  });
}

// ================================
// Analytics and Reporting Functions
// ================================

export async function getAuditStatistics(
  db: D1Database,
  dateRange?: { start: string; end: string }
): Promise<{
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsByEntity: Record<string, number>;
  uniqueUsers: number;
  uniqueIPs: number;
}> {
  let query = `
    SELECT 
      action,
      entity_type,
      user_token,
      ip_address,
      COUNT(*) as count
    FROM audit_log
  `;
  const params: string[] = [];

  if (dateRange) {
    query += ` WHERE created_at BETWEEN ? AND ?`;
    params.push(dateRange.start, dateRange.end);
  }

  query += ` GROUP BY action, entity_type, user_token, ip_address`;

  const results = await db
    .prepare(query)
    .bind(...params)
    .all<{
      action: string;
      entity_type: string;
      user_token: string | null;
      ip_address: string | null;
      count: number;
    }>();

  const stats = {
    totalActions: 0,
    actionsByType: {} as Record<string, number>,
    actionsByEntity: {} as Record<string, number>,
    uniqueUsers: new Set<string>(),
    uniqueIPs: new Set<string>(),
  };

  for (const row of results.results || []) {
    stats.totalActions += row.count;
    stats.actionsByType[row.action] = (stats.actionsByType[row.action] || 0) + row.count;
    stats.actionsByEntity[row.entity_type] =
      (stats.actionsByEntity[row.entity_type] || 0) + row.count;

    if (row.user_token) {
      stats.uniqueUsers.add(row.user_token);
    }
    if (row.ip_address) {
      stats.uniqueIPs.add(row.ip_address);
    }
  }

  return {
    totalActions: stats.totalActions,
    actionsByType: stats.actionsByType,
    actionsByEntity: stats.actionsByEntity,
    uniqueUsers: stats.uniqueUsers.size,
    uniqueIPs: stats.uniqueIPs.size,
  };
}

export async function getUserActivity(
  db: D1Database,
  userToken: string,
  dateRange?: { start: string; end: string },
  limit: number = 100
): Promise<AuditLogRecord[]> {
  const params: {
    userToken: string;
    limit: number;
    startDate?: string;
    endDate?: string;
  } = {
    userToken,
    limit,
  };

  if (dateRange?.start) {
    params.startDate = dateRange.start;
  }

  if (dateRange?.end) {
    params.endDate = dateRange.end;
  }

  return getAuditLogs(db, params);
}

export async function getEntityHistory(
  db: D1Database,
  entityType: 'artwork' | 'artist' | 'submission' | 'user_activity' | 'user_role',
  entityId: string,
  limit: number = 50
): Promise<AuditLogRecord[]> {
  return getAuditLogs(db, {
    entityType,
    entityId,
    limit,
  });
}

export async function getSecurityEvents(
  db: D1Database,
  dateRange?: { start: string; end: string },
  limit: number = 100
): Promise<AuditLogRecord[]> {
  let query = `
    SELECT * FROM audit_log 
    WHERE metadata IS NOT NULL 
    AND json_extract(metadata, '$.suspiciousAction') IS NOT NULL
  `;
  const params: (string | number)[] = [];

  if (dateRange) {
    query += ` AND created_at BETWEEN ? AND ?`;
    params.push(dateRange.start, dateRange.end);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  const results = await db
    .prepare(query)
    .bind(...params)
    .all<AuditLogRecord>();
  return results.results || [];
}

// ================================
// Cleanup and Maintenance Functions
// ================================

export async function cleanOldAuditLogs(
  db: D1Database,
  retentionPeriodDays: number = 365
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionPeriodDays);

  const result = await db
    .prepare(
      `
    DELETE FROM audit_log 
    WHERE created_at < ?
    AND json_extract(metadata, '$.suspiciousAction') IS NULL
  `
    )
    .bind(cutoffDate.toISOString())
    .run();

  return result.meta.changes || 0;
}

export async function archiveSecurityEvents(
  db: D1Database,
  archivePeriodDays: number = 90
): Promise<AuditLogRecord[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - archivePeriodDays);

  // Get events to archive
  const events = await db
    .prepare(
      `
    SELECT * FROM audit_log 
    WHERE created_at < ?
    AND json_extract(metadata, '$.suspiciousAction') IS NOT NULL
    ORDER BY created_at DESC
  `
    )
    .bind(cutoffDate.toISOString())
    .all<AuditLogRecord>();

  return events.results || [];
}
