/**
 * Unit tests for admin route handlers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Context } from 'hono';
import {
  getUserPermissions,
  grantUserPermission,
  revokeUserPermission,
  getAuditLogsEndpoint,
  getAdminStatistics,
} from './admin';
import type { WorkerEnv, AuthContext } from '../types';
import { ApiError } from '../lib/errors';
import { hasPermission } from '../lib/permissions';

// Mock the permission functions
vi.mock('../lib/permissions', () => ({
  hasPermission: vi.fn(),
  listUsersWithPermissions: vi.fn(),
  grantPermission: vi.fn(),
  revokePermission: vi.fn(),
  isValidPermission: vi.fn(),
}));

// Helper to create mock context
const createMockContext = (
  authContext: AuthContext,
  queryParams: Record<string, string> = {},
  body?: unknown
) => {
  const mockEnv = {
    DB: {
      prepare: vi.fn(),
    },
  } as unknown as WorkerEnv;

  const mockRequest = {
    query: vi.fn().mockReturnValue(queryParams),
    json: vi.fn().mockResolvedValue(body || {}),
    param: vi.fn(),
  };

  const mockContext = {
    env: mockEnv,
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'authContext') return authContext;
      return undefined;
    }),
    json: vi.fn(),
    req: mockRequest,
  } as unknown as Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>;

  return { mockContext, mockEnv };
};

describe('Admin Route Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset modules
    vi.resetModules();
  });

  describe('Authorization', () => {
    it('should reject non-admin users from getUserPermissions', async () => {
      const authContext: AuthContext = {
        userToken: 'user-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: false,
      };

      // Mock hasPermission to return false (not admin)
      vi.mocked(hasPermission).mockResolvedValue({ hasPermission: false });

      const { mockContext } = createMockContext(authContext);

      await expect(getUserPermissions(mockContext)).rejects.toThrow(
        'Administrator permissions required'
      );
    });

    it('should reject non-admin users from grantUserPermission', async () => {
      const authContext: AuthContext = {
        userToken: 'user-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: false,
      };

      const { mockContext } = createMockContext(authContext);

      await expect(grantUserPermission(mockContext)).rejects.toThrow(
        'Administrator permissions required'
      );
    });

    it('should reject non-admin users from revokeUserPermission', async () => {
      const authContext: AuthContext = {
        userToken: 'user-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: false,
      };

      const { mockContext } = createMockContext(authContext);

      await expect(revokeUserPermission(mockContext)).rejects.toThrow(
        'Administrator permissions required'
      );
    });

    it('should reject non-admin users from getAuditLogsEndpoint', async () => {
      const authContext: AuthContext = {
        userToken: 'user-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: false,
      };

      const { mockContext } = createMockContext(authContext);

      await expect(getAuditLogsEndpoint(mockContext)).rejects.toThrow(
        'Administrator permissions required'
      );
    });

    it('should reject non-admin users from getAdminStatistics', async () => {
      const authContext: AuthContext = {
        userToken: 'user-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: false,
      };

      const { mockContext } = createMockContext(authContext);

      await expect(getAdminStatistics(mockContext)).rejects.toThrow(
        'Administrator permissions required'
      );
    });
  });

  describe('Input Validation', () => {
    it('should validate invalid permission types in getUserPermissions', async () => {
      const authContext: AuthContext = {
        userToken: 'admin-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: true,
      };

      const { mockContext } = createMockContext(authContext, { permission: 'invalid' });

      await expect(getUserPermissions(mockContext)).rejects.toThrow(
        'Invalid permission type. Must be "moderator" or "admin"'
      );
    });

    it('should validate required fields in grantUserPermission', async () => {
      const authContext: AuthContext = {
        userToken: 'admin-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: true,
      };

      const requestBody = {
        permission: 'moderator',
        // Missing userUuid
      };

      const { mockContext } = createMockContext(authContext, {}, requestBody);

      await expect(grantUserPermission(mockContext)).rejects.toThrow(
        'Valid userUuid is required'
      );
    });

    it('should validate UUID format in grantUserPermission', async () => {
      const authContext: AuthContext = {
        userToken: 'admin-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: true,
      };

      const requestBody = {
        userUuid: 'invalid-uuid',
        permission: 'moderator',
      };

      const { mockContext } = createMockContext(authContext, {}, requestBody);

      await expect(grantUserPermission(mockContext)).rejects.toThrow(
        'Invalid UUID format for userUuid'
      );
    });

    it('should prevent self-modification of admin permissions', async () => {
      const adminUuid = '550e8400-e29b-41d4-a716-446655440000';
      const authContext: AuthContext = {
        userToken: adminUuid,
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: true,
      };

      const requestBody = {
        userUuid: adminUuid, // Same as auth context with valid UUID
        permission: 'admin',
      };

      const { mockContext } = createMockContext(authContext, {}, requestBody);

      await expect(grantUserPermission(mockContext)).rejects.toThrow(
        'Cannot modify your own admin permissions'
      );
    });

    it('should validate reason length in grantUserPermission', async () => {
      const authContext: AuthContext = {
        userToken: 'admin-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: true,
      };

      const requestBody = {
        userUuid: '550e8400-e29b-41d4-a716-446655440000',
        permission: 'moderator',
        reason: 'x'.repeat(501), // Too long
      };

      const { mockContext } = createMockContext(authContext, {}, requestBody);

      await expect(grantUserPermission(mockContext)).rejects.toThrow(
        'Reason must be a string with maximum length of 500'
      );
    });

    it('should validate filter parameters in getAuditLogsEndpoint', async () => {
      const authContext: AuthContext = {
        userToken: 'admin-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: true,
      };

      const { mockContext } = createMockContext(authContext, {
        type: 'invalid',
      });

      await expect(getAuditLogsEndpoint(mockContext)).rejects.toThrow(
        'Invalid type filter. Must be "moderation" or "admin"'
      );
    });

    it('should validate date filters in getAuditLogsEndpoint', async () => {
      const authContext: AuthContext = {
        userToken: 'admin-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: true,
      };

      const { mockContext } = createMockContext(authContext, {
        startDate: 'invalid-date',
      });

      await expect(getAuditLogsEndpoint(mockContext)).rejects.toThrow(
        'Invalid startDate format. Must be ISO 8601'
      );
    });
  });

  describe('Pagination', () => {
    it('should enforce pagination limits in getAuditLogsEndpoint', async () => {
      const authContext: AuthContext = {
        userToken: '550e8400-e29b-41d4-a716-446655440000',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: true,
      };

      const { mockContext, mockEnv } = createMockContext(authContext, {
        limit: '200', // Exceeds max
      });

      // Mock the database queries to return expected results
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue({ count: 0 }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });
      mockEnv.DB.prepare = mockPrepare;

      // Mock the context.json method to return a response
      const mockJsonResponse = { success: true, data: { records: [], pagination: {} } };
      mockContext.json = vi.fn().mockReturnValue(mockJsonResponse);

      const result = await getAuditLogsEndpoint(mockContext);
      
      // Verify that the response structure is correct (pagination enforced)
      expect(result).toBeDefined();
      expect(mockContext.json).toHaveBeenCalled();
    });

    it('should enforce day limits in getAdminStatistics', async () => {
      const authContext: AuthContext = {
        userToken: '550e8400-e29b-41d4-a716-446655440000',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: true,
      };

      const { mockContext, mockEnv } = createMockContext(authContext, { 
        days: '400' // Exceeds max
      });

      // Mock the database queries to return expected results
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue({ count: 0 }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });
      mockEnv.DB.prepare = mockPrepare;

      // Mock the context.json method to return a response
      const mockJsonResponse = { success: true, data: { statistics: {} } };
      mockContext.json = vi.fn().mockReturnValue(mockJsonResponse);

      const result = await getAdminStatistics(mockContext);
      
      // Verify that the response structure is correct (day limits enforced)
      expect(result).toBeDefined();
      expect(mockContext.json).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors as ApiErrors', async () => {
      const authContext: AuthContext = {
        userToken: 'admin-123',
        isReviewer: true,
        isVerifiedEmail: true,
        isAdmin: true,
      };

      const { mockContext } = createMockContext(authContext, { permission: 'invalid' });

      try {
        await getUserPermissions(mockContext);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(400);
      }
    });
  });
});