/**
 * Admin Service Tests
 *
 * Comprehensive unit tests for the admin API service layer,
 * including permission management and audit log functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from '../admin';
import { apiService } from '../api';
import type {
  GrantPermissionRequest,
  RevokePermissionRequest,
  AuditLogQuery,
} from '../../../../shared/types';

// Mock the API service
vi.mock('../api', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('AdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserPermissions', () => {
    it('should fetch users with permissions without filters', async () => {
      const mockResponse = {
        users: [
          {
            user_uuid: 'user-1',
            email: 'user1@example.com',
            permissions: [
              {
                permission: 'moderator' as const,
                granted_at: '2025-01-03T10:00:00Z',
                granted_by: 'admin-1',
                notes: 'Initial moderator',
              },
            ],
          },
        ],
        total: 1,
      };

      vi.mocked(apiService.get).mockResolvedValue(mockResponse);

      const result = await adminService.getUserPermissions();

      expect(apiService.get).toHaveBeenCalledWith('/api/admin/permissions');
      expect(result).toEqual(mockResponse);
    });

    it('should fetch users with permissions with filters', async () => {
      const mockResponse = {
        users: [],
        total: 0,
        page: 1,
        per_page: 20,
      };

      vi.mocked(apiService.get).mockResolvedValue(mockResponse);

      const filters = {
        permission: 'admin' as const,
        search: 'test@example.com',
        page: 1,
        perPage: 20,
      };

      await adminService.getUserPermissions(filters);

      expect(apiService.get).toHaveBeenCalledWith(
        '/api/admin/permissions?permission=admin&search=test%40example.com&page=1&per_page=20'
      );
    });

    it('should handle API errors when fetching permissions', async () => {
      const mockError = new Error('Permission denied');
      vi.mocked(apiService.get).mockRejectedValue(mockError);

      await expect(adminService.getUserPermissions()).rejects.toThrow('Permission denied');
    });
  });

  describe('grantPermission', () => {
    it('should grant permission to a user', async () => {
      const mockResponse = {
        success: true,
        message: 'Permission granted successfully',
        user_uuid: 'user-1',
        permission: 'moderator' as const,
        granted_by: 'admin-1',
      };

      vi.mocked(apiService.post).mockResolvedValue(mockResponse);

      const request: GrantPermissionRequest = {
        userUuid: 'user-1',
        permission: 'moderator',
        reason: 'Experienced contributor',
      };

      const result = await adminService.grantPermission(request);

      expect(apiService.post).toHaveBeenCalledWith('/api/admin/permissions/grant', request);
      expect(result).toEqual(mockResponse);
    });

    it('should handle validation errors when granting permission', async () => {
      const mockError = new Error('Invalid user UUID');
      vi.mocked(apiService.post).mockRejectedValue(mockError);

      const request: GrantPermissionRequest = {
        userUuid: 'invalid-uuid',
        permission: 'admin',
      };

      await expect(adminService.grantPermission(request)).rejects.toThrow('Invalid user UUID');
    });
  });

  describe('revokePermission', () => {
    it('should revoke permission from a user', async () => {
      const mockResponse = {
        success: true,
        message: 'Permission revoked successfully',
        user_uuid: 'user-1',
        permission: 'moderator' as const,
      };

      vi.mocked(apiService.post).mockResolvedValue(mockResponse);

      const request: RevokePermissionRequest = {
        userUuid: 'user-1',
        permission: 'moderator',
        reason: 'Role no longer needed',
      };

      const result = await adminService.revokePermission(request);

      expect(apiService.post).toHaveBeenCalledWith('/api/admin/permissions/revoke', request);
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when revoking permission', async () => {
      const mockError = new Error('Permission not found');
      vi.mocked(apiService.post).mockRejectedValue(mockError);

      const request: RevokePermissionRequest = {
        userUuid: 'user-1',
        permission: 'admin',
        reason: 'User requested removal',
      };

      await expect(adminService.revokePermission(request)).rejects.toThrow('Permission not found');
    });
  });

  describe('getAuditLogs', () => {
    it('should fetch audit logs without filters', async () => {
      const mockResponse = {
        logs: [
          {
            id: 'audit-1',
            type: 'moderation' as const,
            actor_uuid: 'user-1',
            actor_email: 'moderator@example.com',
            action: 'approved',
            target: 'submission-1',
            details: { decision: 'approved', reason: 'Good quality' },
            created_at: '2025-01-03T10:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        has_more: false,
      };

      vi.mocked(apiService.get).mockResolvedValue(mockResponse);

      const result = await adminService.getAuditLogs();

      expect(apiService.get).toHaveBeenCalledWith('/api/admin/audit');
      expect(result).toEqual(mockResponse);
    });

    it('should fetch audit logs with filters', async () => {
      const mockResponse = {
        logs: [],
        total: 0,
        page: 1,
        limit: 25,
        has_more: false,
      };

      vi.mocked(apiService.get).mockResolvedValue(mockResponse);

      const query: AuditLogQuery = {
        type: 'admin',
        actor: 'admin-1',
        action_type: 'grant_permission',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-03T23:59:59Z',
        page: 1,
        limit: 25,
      };

      await adminService.getAuditLogs(query);

      expect(apiService.get).toHaveBeenCalledWith(
        '/api/admin/audit?type=admin&actor=admin-1&action_type=grant_permission&start_date=2025-01-01T00%3A00%3A00Z&end_date=2025-01-03T23%3A59%3A59Z&page=1&limit=25'
      );
    });

    it('should handle errors when fetching audit logs', async () => {
      const mockError = new Error('Access denied');
      vi.mocked(apiService.get).mockRejectedValue(mockError);

      await expect(adminService.getAuditLogs()).rejects.toThrow('Access denied');
    });
  });

  describe('getStatistics', () => {
    it('should fetch statistics with default timeframe', async () => {
      const mockResponse = {
        total_decisions: 150,
        decisions_by_type: {
          approved: 120,
          rejected: 20,
          skipped: 10,
        },
        total_admin_actions: 25,
        admin_actions_by_type: {
          grant_permission: 15,
          revoke_permission: 5,
          view_audit_logs: 5,
        },
        active_moderators: 3,
        active_admins: 2,
        date_range: {
          start: '2024-12-04T00:00:00Z',
          end: '2025-01-03T23:59:59Z',
          days: 30,
        },
      };

      vi.mocked(apiService.get).mockResolvedValue(mockResponse);

      const result = await adminService.getStatistics();

      expect(apiService.get).toHaveBeenCalledWith('/api/admin/statistics?days=30');
      expect(result).toEqual(mockResponse);
    });

    it('should fetch statistics with custom timeframe', async () => {
      const mockResponse = {
        total_decisions: 500,
        decisions_by_type: {
          approved: 400,
          rejected: 70,
          skipped: 30,
        },
        total_admin_actions: 50,
        admin_actions_by_type: {
          grant_permission: 30,
          revoke_permission: 10,
          view_audit_logs: 10,
        },
        active_moderators: 5,
        active_admins: 3,
        date_range: {
          start: '2024-10-05T00:00:00Z',
          end: '2025-01-03T23:59:59Z',
          days: 90,
        },
      };

      vi.mocked(apiService.get).mockResolvedValue(mockResponse);

      const result = await adminService.getStatistics(90);

      expect(apiService.get).toHaveBeenCalledWith('/api/admin/statistics?days=90');
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when fetching statistics', async () => {
      const mockError = new Error('Statistics unavailable');
      vi.mocked(apiService.get).mockRejectedValue(mockError);

      await expect(adminService.getStatistics()).rejects.toThrow('Statistics unavailable');
    });
  });
});