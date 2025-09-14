/**
 * Unit tests for permission management utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
// Ensure D1Database type is available (declared in global.d.ts)
/// <reference types="../global" />
import {
  hasPermission,
  hasAnyPermission,
  getUserPermissions,
  grantPermission,
  revokePermission,
  listUsersWithPermissions,
  isAdmin,
  isModerator,
  enhanceAuthContext,
  clearPermissionCache,
  isValidPermission,
} from '../permissions';
import type { AuthContext } from '../../types';

// Fallback declaration if global augmentation not picked up in test environment
// (Vitest isolated modules may skip the global.d.ts without explicit import)
// This mirrors minimal subset used in tests.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface D1PreparedStatementTest {
  bind: (...values: unknown[]) => D1PreparedStatementTest;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<{ success: boolean; meta?: { changes?: number } }>;
  all: <T = unknown>() => Promise<{ success: boolean; results: T[] }>;
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface D1Database {
  prepare: (query: string) => D1PreparedStatementTest;
  exec?: (query: string) => Promise<unknown>;
}

// Mock D1Database for testing
const createMockDB = (): D1Database => {
  const mockDB = {
    prepare: vi.fn(),
    exec: vi.fn(),
  };

  return mockDB as unknown as D1Database;
};

describe('Permission Management', () => {
  let db: D1Database;

  beforeEach(() => {
    // Clear permission cache
    clearPermissionCache();
    db = createMockDB();
  });

  describe('Permission Validation', () => {
    it('should validate permission types correctly', () => {
      expect(isValidPermission('moderator')).toBe(true);
      expect(isValidPermission('admin')).toBe(true);
      expect(isValidPermission('invalid')).toBe(false);
      expect(isValidPermission('')).toBe(false);
    });
  });

  describe('Permission Checking', () => {
    it('should check specific permissions correctly', async () => {
      // Mock database response for moderator permission
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            role: 'moderator',
            granted_at: '2025-01-03T15:30:00Z',
            granted_by: 'admin-1',
          }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const result = await hasPermission(db, 'user-1', 'moderator');
      expect(result.hasPermission).toBe(true);
      expect(result.permission).toBe('moderator');
      expect(result.grantedBy).toBe('admin-1');
    });

    it('should return false for non-existent permissions', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const result = await hasPermission(db, 'user-1', 'admin');
      expect(result.hasPermission).toBe(false);
    });

    it('should check multiple permissions correctly', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            role: 'admin',
            granted_at: '2025-01-03T15:30:00Z',
            granted_by: 'system',
          }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const result = await hasAnyPermission(db, 'user-2', ['moderator', 'admin']);
      expect(result.hasPermission).toBe(true);
      expect(result.permission).toBe('admin');
    });

    it('should get all user permissions', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            success: true,
            results: [{ role: 'moderator' }, { role: 'admin' }],
          }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const permissions = await getUserPermissions(db, 'user-1');
      expect(permissions).toEqual(['moderator', 'admin']);
    });

    it('should use convenience functions correctly', async () => {
      // Mock for admin check
      const mockPrepareAdmin = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            role: 'admin',
            granted_at: '2025-01-03T15:30:00Z',
            granted_by: 'system',
          }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepareAdmin);

      expect(await isAdmin(db, 'admin-user')).toBe(true);

      // Mock for moderator check (any permission)
      const mockPrepareModerator = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            role: 'moderator',
            granted_at: '2025-01-03T15:30:00Z',
            granted_by: 'admin-1',
          }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepareModerator);

      expect(await isModerator(db, 'moderator-user')).toBe(true);
    });
  });

  describe('Permission Granting', () => {
    it('should grant permissions successfully', async () => {
      let callCount = 0;
      const mockPrepare = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call - check existing permission
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
            }),
          };
        } else {
          // Second call - insert new permission
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          };
        }
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const result = await grantPermission(db, 'new-user', 'moderator', 'admin-1', 'Test grant');
      expect(result.success).toBe(true);
      expect(result.permissionId).toBeDefined();
    });

    it('should not grant duplicate permissions', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            role: 'moderator',
            granted_at: '2025-01-03T15:30:00Z',
            granted_by: 'admin-1',
          }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const result = await grantPermission(db, 'user-test', 'moderator', 'admin-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('already has this permission');
    });
  });

  describe('Permission Revoking', () => {
    it('should revoke permissions successfully', async () => {
      let callCount = 0;
      const mockPrepare = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call - hasPermission check
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                role: 'moderator',
                granted_at: '2025-01-03T15:30:00Z',
                granted_by: 'admin-1',
              }),
            }),
          };
        } else {
          // Second call - revoke permission UPDATE
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({
                success: true,
                meta: { changes: 1 },
              }),
            }),
          };
        }
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const result = await revokePermission(
        db,
        'user-revoke',
        'moderator',
        'admin-1',
        'Test revoke'
      );
      expect(result.success).toBe(true);
    });

    it('should not revoke non-existent permissions', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const result = await revokePermission(db, 'user-revoke', 'admin', 'admin-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not have this permission');
    });
  });

  describe('Permission Listing', () => {
    it('should list all users with permissions', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            success: true,
            results: [
              {
                user_uuid: 'user-1',
                permission: 'moderator',
                granted_at: '2025-01-03T15:30:00Z',
                granted_by: 'admin-1',
                notes: 'Test permission',
                email: 'user1@example.com'
              },
              {
                user_uuid: 'user-2',
                permission: 'admin',
                granted_at: '2025-01-03T15:35:00Z',
                granted_by: 'system',
                notes: null,
                email: 'admin@example.com'
              },
            ],
          }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const users = await listUsersWithPermissions(db);
      expect(users).toHaveLength(2);
      expect(users[0]?.user_uuid).toBe('user-1');
      expect(users[0]?.permissions[0]?.permission).toBe('moderator');
      expect(users[1]?.user_uuid).toBe('user-2');
      expect(users[1]?.permissions[0]?.permission).toBe('admin');
      // Email should be preserved
      expect(users.find(u => u.user_uuid === 'user-1')?.email).toBe('user1@example.com');
      expect(users.find(u => u.user_uuid === 'user-2')?.email).toBe('admin@example.com');
    });

    it('should apply search filter (email match) when provided', async () => {
      const capturedQueries: string[] = [];
      const mockAll = vi.fn().mockResolvedValue({
        success: true,
        results: [
          {
            user_uuid: 'user-2',
            permission: 'admin',
            granted_at: '2025-01-03T15:35:00Z',
            granted_by: 'system',
            notes: null,
            email: 'admin@example.com'
          },
        ],
      });

      const mockPrepare = vi.fn().mockImplementation((q: string) => {
        capturedQueries.push(q);
        return {
          bind: vi.fn().mockReturnValue({
            all: mockAll,
          }),
        };
      });

      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const users = await listUsersWithPermissions(db, undefined, 'admin');
      expect(users).toHaveLength(1);
      expect(users[0]?.email).toBe('admin@example.com');
      // Ensure SQL added the search predicate referencing LOWER(u.email)
      const joinedQuery = capturedQueries.join('\n');
      expect(joinedQuery).toContain('LOWER(u.email) LIKE');
    });
  });

  describe('Auth Context Enhancement', () => {
    it('should enhance auth context with permissions', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            success: true,
            results: [{ role: 'moderator' }],
          }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const baseContext: AuthContext = {
        userToken: 'auth-user-1',
        isReviewer: false,
        isVerifiedEmail: false,
        isAdmin: false,
      };

      const enhanced = await enhanceAuthContext(db, baseContext);
      expect(enhanced.permissions).toEqual(['moderator']);
      expect(enhanced.isReviewer).toBe(true);
      expect(enhanced.isAdmin).toBe(false);
    });

    it('should handle admin permissions correctly', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            success: true,
            results: [{ role: 'admin' }],
          }),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const baseContext: AuthContext = {
        userToken: 'auth-user-2',
        isReviewer: false,
        isVerifiedEmail: false,
        isAdmin: false,
      };

      const enhanced = await enhanceAuthContext(db, baseContext);
      expect(enhanced.permissions).toEqual(['admin']);
      expect(enhanced.isReviewer).toBe(true);
      expect(enhanced.isAdmin).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully in permission checks', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const result = await hasPermission(db, 'user', 'moderator');
      expect(result.hasPermission).toBe(false);
    });

    it('should handle database errors gracefully in user permissions', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const permissions = await getUserPermissions(db, 'user');
      expect(permissions).toEqual([]);
    });

    it('should handle database errors gracefully in permission listing', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });
      (db.prepare as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockPrepare);

      const users = await listUsersWithPermissions(db);
      expect(users).toEqual([]);
    });
  });
});
