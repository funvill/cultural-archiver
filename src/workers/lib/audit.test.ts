/**
 * Unit tests for audit logging utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Context } from 'hono';
import {
  logModerationDecision,
  logAdminAction,
  getAuditLogs,
  getAuditStatistics,
  extractSessionMetadata,
  createModerationAuditContext,
  createAdminAuditContext,
  type ModerationAuditData,
  type AdminAuditData,
  type AuditLogQuery,
} from './audit';

// Mock D1Database for testing
const createMockDB = () => {
  const mockDB = {
    prepare: vi.fn(),
  };
  return mockDB as unknown as D1Database;
};

// Mock Hono Context for testing
const createMockContext = (headers: Record<string, string> = {}) => {
  return {
    req: {
      header: vi.fn().mockReturnValue(headers),
    },
  } as unknown as Context;
};

describe('Audit Logging', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createMockDB();
  });

  describe('Moderation Decision Logging', () => {
    it('should log moderation decision successfully', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const auditData: ModerationAuditData = {
        submissionId: 'submission-123',
        moderatorUuid: 'moderator-456',
        decision: 'approved',
        reason: 'Good quality artwork',
        artworkId: 'artwork-789',
        actionTaken: 'create_new',
        photosProcessed: 2,
        metadata: {
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          sessionId: 'session-123',
        },
      };

      const result = await logModerationDecision(db, auditData);

      expect(result.success).toBe(true);
      expect(result.auditId).toBeDefined();
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO moderation_decisions'));
    });

    it('should handle moderation logging errors gracefully', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: false }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const auditData: ModerationAuditData = {
        submissionId: 'submission-123',
        moderatorUuid: 'moderator-456',
        decision: 'rejected',
        reason: 'Poor quality',
      };

      const result = await logModerationDecision(db, auditData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to insert audit record');
    });

    it('should handle database errors in moderation logging', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const auditData: ModerationAuditData = {
        submissionId: 'submission-123',
        moderatorUuid: 'moderator-456',
        decision: 'skipped',
      };

      const result = await logModerationDecision(db, auditData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('Admin Action Logging', () => {
    it('should log admin action successfully', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const auditData: AdminAuditData = {
        adminUuid: 'admin-123',
        actionType: 'grant_permission',
        targetUuid: 'user-456',
        permissionType: 'moderator',
        oldValue: 'null',
        newValue: '{"permission":"moderator","granted_at":"2025-01-03T15:30:00Z"}',
        reason: 'New moderator appointment',
        metadata: {
          ip: '192.168.1.200',
          userAgent: 'Mozilla/5.0',
        },
      };

      const result = await logAdminAction(db, auditData);

      expect(result.success).toBe(true);
      expect(result.auditId).toBeDefined();
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO admin_actions'));
    });

    it('should handle admin logging errors gracefully', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: false }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const auditData: AdminAuditData = {
        adminUuid: 'admin-123',
        actionType: 'revoke_permission',
        targetUuid: 'user-456',
        permissionType: 'moderator',
        reason: 'Policy violation',
      };

      const result = await logAdminAction(db, auditData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to insert admin audit record');
    });

    it('should handle database errors in admin logging', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const auditData: AdminAuditData = {
        adminUuid: 'admin-123',
        actionType: 'view_audit_logs',
      };

      const result = await logAdminAction(db, auditData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('Audit Log Retrieval', () => {
    it('should retrieve moderation audit logs', async () => {
      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              success: true,
              results: [
                {
                  type: 'moderation',
                  id: 'audit-1',
                  submission_id: 'submission-123',
                  moderator_uuid: 'moderator-456',
                  decision: 'approved',
                  reason: 'Good quality',
                  metadata: '{"ip":"192.168.1.100"}',
                  artwork_id: 'artwork-789',
                  created_at: '2025-01-03T15:30:00Z',
                },
              ],
            }),
          }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ total: 1 }),
          }),
        });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const query: AuditLogQuery = {
        type: 'moderation',
        userUuid: 'moderator-456',
        page: 1,
        limit: 10,
      };

      const result = await getAuditLogs(db, query);

      expect(result.records).toHaveLength(1);
      expect(result.records[0]?.type).toBe('moderation');
      expect(result.records[0]?.decision).toBe('approved');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should retrieve admin audit logs', async () => {
      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              success: true,
              results: [
                {
                  type: 'admin',
                  id: 'audit-2',
                  admin_uuid: 'admin-123',
                  action_type: 'grant_permission',
                  target_uuid: 'user-456',
                  permission_type: 'moderator',
                  old_value: 'null',
                  new_value: '{"permission":"moderator"}',
                  reason: 'New moderator',
                  metadata: '{"ip":"192.168.1.200"}',
                  created_at: '2025-01-03T15:35:00Z',
                },
              ],
            }),
          }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ total: 1 }),
          }),
        });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const query: AuditLogQuery = {
        type: 'admin',
        userUuid: 'admin-123',
        page: 1,
        limit: 10,
      };

      const result = await getAuditLogs(db, query);

      expect(result.records).toHaveLength(1);
      expect(result.records[0]?.type).toBe('admin');
      expect(result.records[0]?.action_type).toBe('grant_permission');
      expect(result.pagination.total).toBe(1);
    });

    it('should retrieve combined audit logs', async () => {
      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({
              success: true,
              results: [
                {
                  type: 'moderation',
                  id: 'audit-1',
                  submission_id: 'submission-123',
                  moderator_uuid: 'moderator-456',
                  decision: 'approved',
                  created_at: '2025-01-03T15:30:00Z',
                  admin_uuid: null,
                  action_type: null,
                },
                {
                  type: 'admin',
                  id: 'audit-2',
                  admin_uuid: 'admin-123',
                  action_type: 'grant_permission',
                  created_at: '2025-01-03T15:25:00Z',
                  submission_id: null,
                  moderator_uuid: null,
                  decision: null,
                },
              ],
            }),
          }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ total: 2 }),
          }),
        });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const result = await getAuditLogs(db, { page: 1, limit: 10 });

      expect(result.records).toHaveLength(2);
      expect(result.records[0]?.type).toBe('moderation');
      expect(result.records[1]?.type).toBe('admin');
      expect(result.pagination.total).toBe(2);
    });

    it('should handle pagination correctly', async () => {
      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ success: true, results: [] }),
          }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ total: 25 }),
          }),
        });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const result = await getAuditLogs(db, { page: 2, limit: 10 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should handle retrieval errors gracefully', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ success: false }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const result = await getAuditLogs(db);

      expect(result.records).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('Audit Statistics', () => {
    it('should retrieve audit statistics successfully', async () => {
      const mockPrepare = vi.fn()
        .mockReturnValueOnce({
          all: vi.fn().mockResolvedValue({
            success: true,
            results: [
              { decision: 'approved', count: 15 },
              { decision: 'rejected', count: 5 },
              { decision: 'skipped', count: 2 },
            ],
          }),
        })
        .mockReturnValueOnce({
          all: vi.fn().mockResolvedValue({
            success: true,
            results: [
              { date: '2025-01-03', decision: 'approved', count: 10 },
              { date: '2025-01-02', decision: 'approved', count: 5 },
              { date: '2025-01-03', decision: 'rejected', count: 3 },
            ],
          }),
        })
        .mockReturnValueOnce({
          all: vi.fn().mockResolvedValue({
            success: true,
            results: [
              { action_type: 'grant_permission', count: 3 },
              { action_type: 'revoke_permission', count: 1 },
              { action_type: 'view_audit_logs', count: 10 },
            ],
          }),
        })
        .mockReturnValueOnce({
          all: vi.fn().mockResolvedValue({
            success: true,
            results: [
              { date: '2025-01-03', action_type: 'grant_permission', count: 2 },
              { date: '2025-01-02', action_type: 'view_audit_logs', count: 5 },
            ],
          }),
        });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const stats = await getAuditStatistics(db, 7);

      expect(stats.moderation.totalDecisions).toBe(22);
      expect(stats.moderation.approved).toBe(15);
      expect(stats.moderation.rejected).toBe(5);
      expect(stats.moderation.skipped).toBe(2);
      expect(stats.moderation.recentActivity).toHaveLength(3);

      expect(stats.admin.totalActions).toBe(14);
      expect(stats.admin.permissionGrants).toBe(3);
      expect(stats.admin.permissionRevokes).toBe(1);
      expect(stats.admin.recentActivity).toHaveLength(2);
    });

    it('should handle statistics errors gracefully', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        all: vi.fn().mockRejectedValue(new Error('Database error')),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const stats = await getAuditStatistics(db);

      expect(stats.moderation.totalDecisions).toBe(0);
      expect(stats.admin.totalActions).toBe(0);
      expect(stats.moderation.recentActivity).toEqual([]);
      expect(stats.admin.recentActivity).toEqual([]);
    });
  });

  describe('Session Metadata Extraction', () => {
    it('should extract session metadata from request headers', () => {
      const mockContext = createMockContext({
        'cf-connecting-ip': '192.168.1.100',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'referer': 'https://example.com/admin',
        'x-session-id': 'session-123',
      });

      const metadata = extractSessionMetadata(mockContext);

      expect(metadata.ip).toBe('192.168.1.100');
      expect(metadata.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
      expect(metadata.referrer).toBe('https://example.com/admin');
      expect(metadata.sessionId).toBe('session-123');
    });

    it('should handle missing headers gracefully', () => {
      const mockContext = createMockContext({});

      const metadata = extractSessionMetadata(mockContext);

      expect(metadata.ip).toBeUndefined();
      expect(metadata.userAgent).toBeUndefined();
      expect(metadata.referrer).toBeUndefined();
      expect(metadata.sessionId).toBeUndefined();
    });

    it('should handle header extraction errors', () => {
      const mockContext = {
        req: {
          header: vi.fn().mockImplementation(() => {
            throw new Error('Header extraction failed');
          }),
        },
      } as unknown as Context;

      const metadata = extractSessionMetadata(mockContext);

      expect(metadata).toEqual({});
    });
  });

  describe('Audit Context Creation', () => {
    it('should create moderation audit context', () => {
      const mockContext = createMockContext({
        'cf-connecting-ip': '192.168.1.100',
        'user-agent': 'Mozilla/5.0',
        'x-session-id': 'session-123',
      });

      const auditContext = createModerationAuditContext(
        mockContext,
        'submission-123',
        'moderator-456',
        'approved',
        {
          reason: 'Good quality artwork',
          artworkId: 'artwork-789',
          actionTaken: 'create_new',
          photosProcessed: 2,
        }
      );

      expect(auditContext.submissionId).toBe('submission-123');
      expect(auditContext.moderatorUuid).toBe('moderator-456');
      expect(auditContext.decision).toBe('approved');
      expect(auditContext.reason).toBe('Good quality artwork');
      expect(auditContext.artworkId).toBe('artwork-789');
      expect(auditContext.actionTaken).toBe('create_new');
      expect(auditContext.photosProcessed).toBe(2);
      expect(auditContext.metadata?.ip).toBe('192.168.1.100');
      expect(auditContext.metadata?.userAgent).toBe('Mozilla/5.0');
      expect(auditContext.metadata?.sessionId).toBe('session-123');
    });

    it('should create admin audit context', () => {
      const mockContext = createMockContext({
        'cf-connecting-ip': '192.168.1.200',
        'user-agent': 'Mozilla/5.0 Admin',
      });

      const auditContext = createAdminAuditContext(
        mockContext,
        'admin-123',
        'grant_permission',
        {
          targetUuid: 'user-456',
          permissionType: 'moderator',
          oldValue: null,
          newValue: { permission: 'moderator', granted_at: '2025-01-03T15:30:00Z' },
          reason: 'New moderator appointment',
        }
      );

      expect(auditContext.adminUuid).toBe('admin-123');
      expect(auditContext.actionType).toBe('grant_permission');
      expect(auditContext.targetUuid).toBe('user-456');
      expect(auditContext.permissionType).toBe('moderator');
      expect(auditContext.oldValue).toBe('null');
      expect(auditContext.newValue).toBe('{"permission":"moderator","granted_at":"2025-01-03T15:30:00Z"}');
      expect(auditContext.reason).toBe('New moderator appointment');
      expect(auditContext.metadata?.ip).toBe('192.168.1.200');
      expect(auditContext.metadata?.userAgent).toBe('Mozilla/5.0 Admin');
    });
  });
});