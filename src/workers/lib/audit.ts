/**
 * Audit Logging Utilities
 *
 * Provides comprehensive logging of moderation decisions and admin actions
 * for transparency, accountability, and security monitoring.
 */

import type { Context } from 'hono';

// Audit decision types
export type ModerationDecision = 'approved' | 'rejected' | 'skipped';
export type AdminActionType =
  | 'grant_permission'
  | 'revoke_permission'
  | 'view_audit_logs'
  | 'manual_social_post';

// Interfaces for audit records
export interface ModerationAuditData {
  submissionId: string;
  moderatorUuid: string;
  decision: ModerationDecision;
  reason?: string | undefined;
  artworkId?: string | undefined;
  actionTaken?: 'create_new' | 'link_existing' | undefined;
  photosProcessed?: number | undefined;
  metadata?: {
    ip?: string | undefined;
    userAgent?: string | undefined;
    sessionId?: string | undefined;
    referrer?: string | undefined;
    [key: string]: unknown;
  };
}

export interface AdminAuditData {
  adminUuid: string;
  actionType: AdminActionType;
  targetUuid?: string | undefined;
  permissionType?: 'moderator' | 'admin' | undefined;
  oldValue?: string | undefined; // JSON string for complex changes
  newValue?: string | undefined; // JSON string for complex changes
  reason?: string | undefined;
  metadata?: {
    ip?: string | undefined;
    userAgent?: string | undefined;
    sessionId?: string | undefined;
    [key: string]: unknown;
  };
}

// Result interfaces
export interface AuditLogRecord {
  id: string;
  type: 'moderation' | 'admin';
  created_at: string;
  // Union of both types - fields will be null if not applicable
  submission_id?: string | undefined;
  moderator_uuid?: string | undefined;
  admin_uuid?: string | undefined;
  decision?: ModerationDecision | undefined;
  action_type?: AdminActionType | undefined;
  reason?: string | undefined;
  metadata?: string | undefined; // JSON string
  artwork_id?: string | undefined;
  target_uuid?: string | undefined;
  permission_type?: string | undefined;
}

export interface AuditLogQuery {
  type?: 'moderation' | 'admin' | undefined;
  userUuid?: string | undefined; // Filter by moderator or admin
  targetUuid?: string | undefined; // For admin actions
  decision?: ModerationDecision | undefined;
  actionType?: AdminActionType | undefined;
  startDate?: string | undefined; // ISO date string
  endDate?: string | undefined; // ISO date string
  page?: number | undefined;
  limit?: number | undefined;
}

export interface AuditLogResult {
  records: AuditLogRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Log a moderation decision
 */
export async function logModerationDecision(
  db: D1Database,
  auditData: ModerationAuditData
): Promise<{ success: boolean; auditId?: string; error?: string }> {
  try {
    const auditId = crypto.randomUUID();

    // Prepare metadata JSON
    const metadataJson = auditData.metadata ? JSON.stringify(auditData.metadata) : null;

    const stmt = db.prepare(`
      INSERT INTO moderation_decisions (
        id, submission_id, moderator_uuid, decision, reason, 
        metadata, artwork_id, action_taken, photos_processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt
      .bind(
        auditId,
        auditData.submissionId,
        auditData.moderatorUuid,
        auditData.decision,
        auditData.reason || null,
        metadataJson,
        auditData.artworkId || null,
        auditData.actionTaken || null,
        auditData.photosProcessed || 0
      )
      .run();

    if (result.success) {
      return { success: true, auditId };
    }

    return { success: false, error: 'Failed to insert audit record' };
  } catch (error) {
    console.error('Moderation audit logging error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Log an admin action
 */
export async function logAdminAction(
  db: D1Database,
  auditData: AdminAuditData
): Promise<{ success: boolean; auditId?: string; error?: string }> {
  try {
    const auditId = crypto.randomUUID();

    // Prepare metadata JSON
    const metadataJson = auditData.metadata ? JSON.stringify(auditData.metadata) : null;

    const stmt = db.prepare(`
      INSERT INTO admin_actions (
        id, admin_uuid, action_type, target_uuid, permission_type,
        old_value, new_value, reason, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt
      .bind(
        auditId,
        auditData.adminUuid,
        auditData.actionType,
        auditData.targetUuid || null,
        auditData.permissionType || null,
        auditData.oldValue || null,
        auditData.newValue || null,
        auditData.reason || null,
        metadataJson
      )
      .run();

    if (result.success) {
      return { success: true, auditId };
    }

    return { success: false, error: 'Failed to insert admin audit record' };
  } catch (error) {
    console.error('Admin audit logging error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Retrieve audit logs with filtering and pagination
 */
export async function getAuditLogs(
  db: D1Database,
  query: AuditLogQuery = {}
): Promise<AuditLogResult> {
  try {
    const {
      type,
      userUuid,
      targetUuid,
      decision,
      actionType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    // Build the query based on type
    let sqlQuery: string;
    let countQuery: string;
    const bindings: unknown[] = [];
    const conditions: string[] = [];

    if (type === 'moderation') {
      sqlQuery = `
        SELECT 
          'moderation' as type,
          id,
          submission_id,
          moderator_uuid,
          decision,
          reason,
          metadata,
          artwork_id,
          created_at
        FROM moderation_decisions
      `;
      countQuery = 'SELECT COUNT(*) as total FROM moderation_decisions';

      if (userUuid) {
        conditions.push('moderator_uuid = ?');
        bindings.push(userUuid);
      }
      if (decision) {
        conditions.push('decision = ?');
        bindings.push(decision);
      }
    } else if (type === 'admin') {
      sqlQuery = `
        SELECT 
          'admin' as type,
          id,
          admin_uuid,
          action_type,
          target_uuid,
          permission_type,
          old_value,
          new_value,
          reason,
          metadata,
          created_at
        FROM admin_actions
      `;
      countQuery = 'SELECT COUNT(*) as total FROM admin_actions';

      if (userUuid) {
        conditions.push('admin_uuid = ?');
        bindings.push(userUuid);
      }
      if (targetUuid) {
        conditions.push('target_uuid = ?');
        bindings.push(targetUuid);
      }
      if (actionType) {
        conditions.push('action_type = ?');
        bindings.push(actionType);
      }
    } else {
      // Combined query
      sqlQuery = `
        SELECT 
          'moderation' as type,
          id,
          submission_id,
          moderator_uuid,
          decision,
          reason,
          metadata,
          artwork_id,
          created_at,
          NULL as admin_uuid,
          NULL as action_type,
          NULL as target_uuid,
          NULL as permission_type,
          NULL as old_value,
          NULL as new_value
        FROM moderation_decisions
        UNION ALL
        SELECT 
          'admin' as type,
          id,
          NULL as submission_id,
          NULL as moderator_uuid,
          NULL as decision,
          reason,
          metadata,
          NULL as artwork_id,
          created_at,
          admin_uuid,
          action_type,
          target_uuid,
          permission_type,
          old_value,
          new_value
        FROM admin_actions
      `;
      countQuery = `
        SELECT (
          (SELECT COUNT(*) FROM moderation_decisions) + 
          (SELECT COUNT(*) FROM admin_actions)
        ) as total
      `;
    }

    // Add date filters
    if (startDate) {
      conditions.push('created_at >= ?');
      bindings.push(startDate);
    }
    if (endDate) {
      conditions.push('created_at <= ?');
      bindings.push(endDate);
    }

    // Apply conditions
    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(' AND ')}`;
      sqlQuery += whereClause;
      if (type !== undefined) {
        countQuery += whereClause;
      }
    }

    // Add ordering and pagination
    sqlQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * limit;
    bindings.push(limit, offset);

    // Execute queries
    const [recordsResult, countResult] = await Promise.all([
      db
        .prepare(sqlQuery)
        .bind(...bindings)
        .all(),
      db
        .prepare(countQuery)
        .bind(...(type !== undefined ? bindings.slice(0, -2) : []))
        .first(),
    ]);

    if (!recordsResult.success) {
      throw new Error('Failed to fetch audit records');
    }

    const total = (countResult as { total: number } | null)?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const records: AuditLogRecord[] = recordsResult.results.map(row => {
      const record = row as Record<string, unknown>;
      return {
        id: record.id as string,
        type: record.type as 'moderation' | 'admin',
        created_at: record.created_at as string,
        submission_id: record.submission_id as string | undefined,
        moderator_uuid: record.moderator_uuid as string | undefined,
        admin_uuid: record.admin_uuid as string | undefined,
        decision: record.decision as ModerationDecision | undefined,
        action_type: record.action_type as AdminActionType | undefined,
        reason: record.reason as string | undefined,
        metadata: record.metadata as string | undefined,
        artwork_id: record.artwork_id as string | undefined,
        target_uuid: record.target_uuid as string | undefined,
        permission_type: record.permission_type as string | undefined,
      };
    });

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  } catch (error) {
    console.error('Audit log retrieval error:', error);
    return {
      records: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasMore: false,
      },
    };
  }
}

/**
 * Get audit statistics for dashboard
 */
export async function getAuditStatistics(
  db: D1Database,
  days: number = 30
): Promise<{
  moderation: {
    totalDecisions: number;
    approved: number;
    rejected: number;
    skipped: number;
    recentActivity: Array<{ date: string; count: number; decision: ModerationDecision }>;
  };
  admin: {
    totalActions: number;
    permissionGrants: number;
    permissionRevokes: number;
    recentActivity: Array<{ date: string; count: number; action_type: AdminActionType }>;
  };
}> {
  try {
    const dateFilter = `date('now', '-${days} days')`;

    // Moderation statistics
    const moderationStatsStmt = db.prepare(`
      SELECT 
        decision,
        COUNT(*) as count
      FROM moderation_decisions
      WHERE created_at >= ${dateFilter}
      GROUP BY decision
    `);

    const moderationActivityStmt = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        decision,
        COUNT(*) as count
      FROM moderation_decisions
      WHERE created_at >= ${dateFilter}
      GROUP BY DATE(created_at), decision
      ORDER BY date DESC
    `);

    // Admin statistics
    const adminStatsStmt = db.prepare(`
      SELECT 
        action_type,
        COUNT(*) as count
      FROM admin_actions
      WHERE created_at >= ${dateFilter}
      GROUP BY action_type
    `);

    const adminActivityStmt = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        action_type,
        COUNT(*) as count
      FROM admin_actions
      WHERE created_at >= ${dateFilter}
      GROUP BY DATE(created_at), action_type
      ORDER BY date DESC
    `);

    const [moderationStats, moderationActivity, adminStats, adminActivity] = await Promise.all([
      moderationStatsStmt.all(),
      moderationActivityStmt.all(),
      adminStatsStmt.all(),
      adminActivityStmt.all(),
    ]);

    // Process moderation statistics
    const moderationCounts = { approved: 0, rejected: 0, skipped: 0 };
    if (moderationStats.success) {
      for (const row of moderationStats.results) {
        const record = row as { decision: ModerationDecision; count: number };
        moderationCounts[record.decision] = record.count;
      }
    }

    const moderationRecentActivity = moderationActivity.success
      ? moderationActivity.results.map(row => {
          const record = row as { date: string; decision: ModerationDecision; count: number };
          return {
            date: record.date,
            count: record.count,
            decision: record.decision,
          };
        })
      : [];

    // Process admin statistics
    const adminCounts = {
      grant_permission: 0,
      revoke_permission: 0,
      view_audit_logs: 0,
      manual_social_post: 0,
    };
    if (adminStats.success) {
      for (const row of adminStats.results) {
        const record = row as { action_type: AdminActionType; count: number };
        adminCounts[record.action_type] = record.count;
      }
    }

    const adminRecentActivity = adminActivity.success
      ? adminActivity.results.map(row => {
          const record = row as { date: string; action_type: AdminActionType; count: number };
          return {
            date: record.date,
            count: record.count,
            action_type: record.action_type,
          };
        })
      : [];

    return {
      moderation: {
        totalDecisions:
          moderationCounts.approved + moderationCounts.rejected + moderationCounts.skipped,
        approved: moderationCounts.approved,
        rejected: moderationCounts.rejected,
        skipped: moderationCounts.skipped,
        recentActivity: moderationRecentActivity,
      },
      admin: {
        totalActions:
          adminCounts.grant_permission +
          adminCounts.revoke_permission +
          adminCounts.view_audit_logs,
        permissionGrants: adminCounts.grant_permission,
        permissionRevokes: adminCounts.revoke_permission,
        recentActivity: adminRecentActivity,
      },
    };
  } catch (error) {
    console.error('Audit statistics error:', error);
    return {
      moderation: {
        totalDecisions: 0,
        approved: 0,
        rejected: 0,
        skipped: 0,
        recentActivity: [],
      },
      admin: {
        totalActions: 0,
        permissionGrants: 0,
        permissionRevokes: 0,
        recentActivity: [],
      },
    };
  }
}

/**
 * Extract session metadata from request context
 */
export function extractSessionMetadata(c: Context): {
  ip?: string;
  userAgent?: string;
  referrer?: string;
  sessionId?: string;
} {
  try {
    const headers = c.req.header();

    const result: {
      ip?: string;
      userAgent?: string;
      referrer?: string;
      sessionId?: string;
    } = {};

    const ip = headers['cf-connecting-ip'] || headers['x-forwarded-for'] || headers['x-real-ip'];
    if (ip) result.ip = ip;

    const userAgent = headers['user-agent'];
    if (userAgent) result.userAgent = userAgent;

    const referrer = headers['referer'] || headers['referrer'];
    if (referrer) result.referrer = referrer;

    const sessionId = headers['x-session-id'];
    if (sessionId) result.sessionId = sessionId;

    return result;
  } catch (error) {
    console.warn('Failed to extract session metadata:', error);
    return {};
  }
}

/**
 * Create audit context for moderation decisions
 */
export function createModerationAuditContext(
  c: Context,
  submissionId: string,
  moderatorUuid: string,
  decision: ModerationDecision,
  options: {
    reason?: string;
    artworkId?: string;
    actionTaken?: 'create_new' | 'link_existing';
    photosProcessed?: number;
  } = {}
): ModerationAuditData {
  const metadata = extractSessionMetadata(c);

  return {
    submissionId,
    moderatorUuid,
    decision,
    reason: options.reason,
    artworkId: options.artworkId,
    actionTaken: options.actionTaken,
    photosProcessed: options.photosProcessed,
    metadata,
  };
}

/**
 * Create audit context for admin actions
 */
export function createAdminAuditContext(
  c: Context,
  adminUuid: string,
  actionType: AdminActionType,
  options: {
    targetUuid?: string;
    permissionType?: 'moderator' | 'admin';
    oldValue?: unknown;
    newValue?: unknown;
    reason?: string;
  } = {}
): AdminAuditData {
  const metadata = extractSessionMetadata(c);

  return {
    adminUuid,
    actionType,
    targetUuid: options.targetUuid,
    permissionType: options.permissionType,
    oldValue: options.oldValue !== undefined ? JSON.stringify(options.oldValue) : undefined,
    newValue: options.newValue !== undefined ? JSON.stringify(options.newValue) : undefined,
    reason: options.reason,
    metadata,
  };
}
