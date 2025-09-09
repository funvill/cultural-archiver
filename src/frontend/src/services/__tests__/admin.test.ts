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
} from '../../../shared/types';

// Mock the API service
vi.mock('../api', () => ({
  apiService: {
    getAdminPermissions: vi.fn(),
    grantAdminPermission: vi.fn(),
    revokeAdminPermission: vi.fn(),
    getAdminAuditLogs: vi.fn(),
    getAdminStatistics: vi.fn(),
    generateDataDump: vi.fn(),
    getDataDumps: vi.fn(),
  },
}));

describe('AdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserPermissions', () => {
    it('should fetch users with permissions without filters', async () => {
      const mockResponse = {
        success: true,
        data: {
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
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.getAdminPermissions).mockResolvedValue(mockResponse);

      const result = await adminService.getUserPermissions();

  // Updated expectation: method now takes (permission, search)
  expect(apiService.getAdminPermissions).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual(mockResponse.data);
    });

    it('should fetch users with permissions with filters', async () => {
      const mockResponse = {
        success: true,
        data: {
          users: [],
          total: 0,
          page: 1,
          per_page: 20,
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.getAdminPermissions).mockResolvedValue(mockResponse);

      const filters = {
        permission: 'admin' as const,
        search: 'test@example.com',
        page: 1,
        perPage: 20,
      };

      await adminService.getUserPermissions(filters);

  // Updated expectation: includes search term as second argument
  expect(apiService.getAdminPermissions).toHaveBeenCalledWith('admin', 'test@example.com');
    });

    it('should handle API errors when fetching permissions', async () => {
      const mockError = new Error('Permission denied');
      vi.mocked(apiService.getAdminPermissions).mockRejectedValue(mockError);

      await expect(adminService.getUserPermissions()).rejects.toThrow('Permission denied');
    });
  });

  describe('grantPermission', () => {
    it('should grant permission to a user', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          message: 'Permission granted successfully',
          user_uuid: 'user-1',
          permission: 'moderator' as const,
          granted_by: 'admin-1',
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.grantAdminPermission).mockResolvedValue(mockResponse);

      const request: GrantPermissionRequest = {
        userUuid: 'user-1',
        permission: 'moderator',
        reason: 'Experienced contributor',
      };

      const result = await adminService.grantPermission(request);

      expect(apiService.grantAdminPermission).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle validation errors when granting permission', async () => {
      const mockError = new Error('Invalid user UUID');
      vi.mocked(apiService.grantAdminPermission).mockRejectedValue(mockError);

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
        data: {
          success: true,
          message: 'Permission revoked successfully',
          user_uuid: 'user-1',
          permission: 'moderator' as const,
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.revokeAdminPermission).mockResolvedValue(mockResponse);

      const request: RevokePermissionRequest = {
        userUuid: 'user-1',
        permission: 'moderator',
        reason: 'Role no longer needed',
      };

      const result = await adminService.revokePermission(request);

      expect(apiService.revokeAdminPermission).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle errors when revoking permission', async () => {
      const mockError = new Error('Permission not found');
      vi.mocked(apiService.revokeAdminPermission).mockRejectedValue(mockError);

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
        success: true,
        data: {
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
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.getAdminAuditLogs).mockResolvedValue(mockResponse);

      const result = await adminService.getAuditLogs();

      expect(apiService.getAdminAuditLogs).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResponse.data);
    });

    it('should fetch audit logs with filters', async () => {
      const mockResponse = {
        success: true,
        data: {
          logs: [],
          total: 0,
          page: 1,
          limit: 25,
          has_more: false,
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.getAdminAuditLogs).mockResolvedValue(mockResponse);

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

      expect(apiService.getAdminAuditLogs).toHaveBeenCalledWith({
        type: 'admin',
        actor: 'admin-1',
        action_type: 'grant_permission',
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2025-01-03T23:59:59Z',
        page: '1',
        limit: '25',
      });
    });

    it('should handle errors when fetching audit logs', async () => {
      const mockError = new Error('Access denied');
      vi.mocked(apiService.getAdminAuditLogs).mockRejectedValue(mockError);

      await expect(adminService.getAuditLogs()).rejects.toThrow('Access denied');
    });
  });

  describe('getStatistics', () => {
    it('should fetch statistics with default timeframe', async () => {
      const mockResponse = {
        success: true,
        data: {
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
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.getAdminStatistics).mockResolvedValue(mockResponse);

      const result = await adminService.getStatistics();

      expect(apiService.getAdminStatistics).toHaveBeenCalledWith(30);
      expect(result).toEqual(mockResponse.data);
    });

    it('should fetch statistics with custom timeframe', async () => {
      const mockResponse = {
        success: true,
        data: {
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
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.getAdminStatistics).mockResolvedValue(mockResponse);

      const result = await adminService.getStatistics(90);

      expect(apiService.getAdminStatistics).toHaveBeenCalledWith(90);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle errors when fetching statistics', async () => {
      const mockError = new Error('Statistics unavailable');
      vi.mocked(apiService.getAdminStatistics).mockRejectedValue(mockError);

      await expect(adminService.getStatistics()).rejects.toThrow('Statistics unavailable');
    });
  });

  describe('generateDataDump', () => {
    it('should generate a new data dump successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          data: {
            dump_id: 'dump-123',
            filename: 'datadump-2025-01-03.zip',
            size: 1024000,
            download_url: 'https://example.com/datadump-2025-01-03.zip',
            generated_at: '2025-01-03T10:00:00Z',
            metadata: {
              total_artworks: 150,
              total_creators: 45,
              total_tags: 200,
              total_photos: 300,
            },
          },
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.generateDataDump).mockResolvedValue(mockResponse);

      const result = await adminService.generateDataDump();

      expect(apiService.generateDataDump).toHaveBeenCalledWith();
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle generation errors', async () => {
      const mockResponse = {
        success: false,
        error: 'Insufficient data for dump generation',
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.generateDataDump).mockResolvedValue(mockResponse);

      await expect(adminService.generateDataDump()).rejects.toThrow(
        'Insufficient data for dump generation'
      );
    });

    it('should handle API errors during generation', async () => {
      const mockError = new Error('Network error');
      vi.mocked(apiService.generateDataDump).mockRejectedValue(mockError);

      await expect(adminService.generateDataDump()).rejects.toThrow('Network error');
    });
  });

  describe('getDataDumps', () => {
    it('should fetch list of data dumps successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          data: {
            dumps: [
              {
                id: 'dump-123',
                filename: 'datadump-2025-01-03.zip',
                size: 1024000,
                download_url: 'https://example.com/datadump-2025-01-03.zip',
                generated_at: '2025-01-03T10:00:00Z',
                generated_by: 'admin-1',
                metadata: {
                  total_artworks: 150,
                  total_creators: 45,
                  total_tags: 200,
                  total_photos: 300,
                },
                warnings: [],
              },
              {
                id: 'dump-124',
                filename: 'datadump-2025-01-02.zip',
                size: 980000,
                download_url: 'https://example.com/datadump-2025-01-02.zip',
                generated_at: '2025-01-02T15:30:00Z',
                generated_by: 'admin-2',
                metadata: {
                  total_artworks: 140,
                  total_creators: 42,
                  total_tags: 190,
                  total_photos: 285,
                },
                warnings: ['Some photos could not be processed'],
              },
            ],
            total: 2,
            retrieved_at: '2025-01-03T11:00:00Z',
          },
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.getDataDumps).mockResolvedValue(mockResponse);

      const result = await adminService.getDataDumps();

      expect(apiService.getDataDumps).toHaveBeenCalledWith();
      expect(result).toEqual(mockResponse.data);
      expect(result.data?.dumps).toHaveLength(2);
      expect(result.data?.total).toBe(2);
    });

    it('should handle empty data dump list', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          data: {
            dumps: [],
            total: 0,
            retrieved_at: '2025-01-03T11:00:00Z',
          },
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.getDataDumps).mockResolvedValue(mockResponse);

      const result = await adminService.getDataDumps();

      expect(result.data?.dumps).toHaveLength(0);
      expect(result.data?.total).toBe(0);
    });

    it('should handle API errors when fetching data dumps', async () => {
      const mockError = new Error('Access denied');
      vi.mocked(apiService.getDataDumps).mockRejectedValue(mockError);

      await expect(adminService.getDataDumps()).rejects.toThrow('Access denied');
    });

    it('should handle unsuccessful API response', async () => {
      const mockResponse = {
        success: false,
        error: 'Database connection failed',
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiService.getDataDumps).mockResolvedValue(mockResponse);

      await expect(adminService.getDataDumps()).rejects.toThrow('Database connection failed');
    });
  });
});
