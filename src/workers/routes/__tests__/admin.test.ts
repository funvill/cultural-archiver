/**
 * Admin Data Dump Routes Tests
 * Tests for admin-only data dump generation and listing endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Context } from 'hono';
import type { WorkerEnv, AuthContext } from '../../types';
import { generateDataDump, listDataDumps } from '../admin';
import { ApiError } from '../../lib/errors';

// Mock dependencies
vi.mock('../../lib/data-dump', () => ({
  generatePublicDataDump: vi.fn(),
}));

vi.mock('../../lib/permissions', () => ({
  hasPermission: vi.fn(),
}));

vi.mock('../../lib/audit', () => ({
  logAdminAction: vi.fn(),
  createAdminAuditContext: vi.fn(),
}));

import { generatePublicDataDump } from '../lib/data-dump';
import { hasPermission } from '../../lib/permissions';
import { logAdminAction, createAdminAuditContext } from '../../lib/audit';

// Mock context setup
const createMockContext = (
  authContext: AuthContext,
  env: Partial<WorkerEnv> = {},
  queryParams: Record<string, string> = {}
): Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }> => {
  const mockDB = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ success: true, results: [] }),
      }),
    }),
  };

  const mockBucket = {
    put: vi.fn().mockResolvedValue(undefined),
  };

  const mockEnv: WorkerEnv = {
    DB: mockDB as any,
    PHOTOS_BUCKET: mockBucket as any,
    R2_PUBLIC_URL: 'https://example.com',
    ...env,
  } as WorkerEnv;

  return {
    get: vi.fn().mockReturnValue(authContext),
    env: mockEnv,
    req: {
      query: vi.fn().mockReturnValue(queryParams),
    },
    json: vi.fn().mockImplementation(data => new Response(JSON.stringify(data))),
  } as any;
};

const mockAuthContext: AuthContext = {
  userToken: 'admin-user-123',
  isAnonymous: false,
  user: {
    uuid: 'admin-user-123',
    email: 'admin@example.com',
    created_at: '2025-01-01T00:00:00.000Z',
    last_login: null,
    email_verified_at: '2025-01-01T00:00:00.000Z',
    status: 'active',
  },
  session: null,
};

describe('Admin Data Dump Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDataDump', () => {
    it('should generate data dump successfully for admin user', async () => {
      // Setup mocks
      vi.mocked(hasPermission).mockResolvedValue({ hasPermission: true });
      vi.mocked(generatePublicDataDump).mockResolvedValue({
        success: true,
        data_dump_file: new ArrayBuffer(1024),
        filename: 'datadump-2025-09-04.zip',
        size: 1024,
        metadata: {
          version: '1.0.0',
          generated_at: '2025-09-04T17:45:00.000Z',
          license: 'CC0',
          source: 'Cultural Archiver',
          description: 'Test dump',
          data_info: {
            total_artworks: 5,
            total_creators: 3,
            total_tags: 10,
            total_photos: 8,
          },
          filter_info: {
            status_filter: 'approved',
            excluded_fields: [],
            photo_types: 'thumbnails_only',
          },
          file_structure: {},
        },
        warnings: ['Test warning'],
      });
      vi.mocked(createAdminAuditContext).mockReturnValue({} as any);
      vi.mocked(logAdminAction).mockResolvedValue({ success: true });

      const mockContext = createMockContext(mockAuthContext);

      // Execute
      const response = await generateDataDump(mockContext);
      const responseData = await response.json();

      // Verify
      expect(hasPermission).toHaveBeenCalledWith(mockContext.env.DB, 'admin-user-123', 'admin');
      expect(generatePublicDataDump).toHaveBeenCalledWith(mockContext.env);
      expect(mockContext.env.PHOTOS_BUCKET!.put).toHaveBeenCalled();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeDefined();
      expect(responseData.data.filename).toMatch(/datadump-\d{4}-\d{2}-\d{2}\.zip/);
      expect(responseData.data.size).toBe(1024);
      expect(responseData.data.metadata.total_artworks).toBe(5);
      expect(responseData.warnings).toEqual(['Test warning']);
    });

    it('should reject non-admin users', async () => {
      // Setup mocks
      vi.mocked(hasPermission).mockResolvedValue({ hasPermission: false });

      const mockContext = createMockContext(mockAuthContext);

      // Execute & Verify
      await expect(generateDataDump(mockContext)).rejects.toThrow(ApiError);
      await expect(generateDataDump(mockContext)).rejects.toThrow(
        'Administrator permissions required'
      );
    });

    it('should handle data dump generation failure', async () => {
      // Setup mocks
      vi.mocked(hasPermission).mockResolvedValue({ hasPermission: true });
      vi.mocked(generatePublicDataDump).mockResolvedValue({
        success: false,
        error: 'Database query failed',
      });

      const mockContext = createMockContext(mockAuthContext);

      // Execute & Verify
      await expect(generateDataDump(mockContext)).rejects.toThrow(ApiError);
      await expect(generateDataDump(mockContext)).rejects.toThrow('Database query failed');
    });

    it('should handle missing storage bucket', async () => {
      // Setup mocks
      vi.mocked(hasPermission).mockResolvedValue({ hasPermission: true });
      vi.mocked(generatePublicDataDump).mockResolvedValue({
        success: true,
        data_dump_file: new ArrayBuffer(1024),
        size: 1024,
        metadata: {} as any,
      });

      const mockContext = createMockContext(mockAuthContext, { PHOTOS_BUCKET: undefined });

      // Execute & Verify
      await expect(generateDataDump(mockContext)).rejects.toThrow(ApiError);
      await expect(generateDataDump(mockContext)).rejects.toThrow('Storage not configured');
    });

    it('should handle R2 upload failure', async () => {
      // Setup mocks
      vi.mocked(hasPermission).mockResolvedValue({ hasPermission: true });
      vi.mocked(generatePublicDataDump).mockResolvedValue({
        success: true,
        data_dump_file: new ArrayBuffer(1024),
        size: 1024,
        metadata: {
          data_info: {
            total_artworks: 5,
            total_creators: 3,
            total_tags: 10,
            total_photos: 8,
          },
        } as any,
      });

      const mockBucket = {
        put: vi.fn().mockRejectedValue(new Error('R2 upload failed')),
      };

      const mockContext = createMockContext(mockAuthContext, { PHOTOS_BUCKET: mockBucket as any });

      // Execute & Verify
      await expect(generateDataDump(mockContext)).rejects.toThrow('Failed to generate data dump');
    });
  });

  describe('listDataDumps', () => {
    it('should list data dumps successfully for admin user', async () => {
      // Setup mocks
      vi.mocked(hasPermission).mockResolvedValue({ hasPermission: true });

      const mockDumps = [
        {
          id: 'dump-1',
          filename: 'datadump-2025-09-04.zip',
          size: 1024,
          download_url: 'https://example.com/dump-1.zip',
          generated_at: '2025-09-04T17:45:00.000Z',
          generated_by: 'admin-user-123',
          total_artworks: 5,
          total_creators: 3,
          total_tags: 10,
          total_photos: 8,
          warnings: null,
        },
        {
          id: 'dump-2',
          filename: 'datadump-2025-09-03.zip',
          size: 2048,
          download_url: 'https://example.com/dump-2.zip',
          generated_at: '2025-09-03T17:45:00.000Z',
          generated_by: 'admin-user-456',
          total_artworks: 10,
          total_creators: 5,
          total_tags: 20,
          total_photos: 15,
          warnings: '["Test warning"]',
        },
      ];

      const mockContext = createMockContext(mockAuthContext);
      mockContext.env.DB.prepare().bind().all.mockResolvedValue({
        success: true,
        results: mockDumps,
      });

      vi.mocked(createAdminAuditContext).mockReturnValue({} as any);
      vi.mocked(logAdminAction).mockResolvedValue({ success: true });

      // Execute
      const response = await listDataDumps(mockContext);
      const responseData = await response.json();

      // Verify
      expect(hasPermission).toHaveBeenCalledWith(mockContext.env.DB, 'admin-user-123', 'admin');

      expect(responseData.success).toBe(true);
      expect(responseData.data.dumps).toHaveLength(2);
      expect(responseData.data.dumps[0].id).toBe('dump-1');
      expect(responseData.data.dumps[0].warnings).toBeUndefined();
      expect(responseData.data.dumps[1].warnings).toEqual(['Test warning']);
      expect(responseData.data.total).toBe(2);
    });

    it('should reject non-admin users', async () => {
      // Setup mocks
      vi.mocked(hasPermission).mockResolvedValue({ hasPermission: false });

      const mockContext = createMockContext(mockAuthContext);

      // Execute & Verify
      await expect(listDataDumps(mockContext)).rejects.toThrow(ApiError);
      await expect(listDataDumps(mockContext)).rejects.toThrow(
        'Administrator permissions required'
      );
    });

    it('should handle pagination parameters', async () => {
      // Setup mocks
      vi.mocked(hasPermission).mockResolvedValue({ hasPermission: true });

      const mockContext = createMockContext(mockAuthContext, {}, { page: '2', limit: '10' });
      mockContext.env.DB.prepare().bind().all.mockResolvedValue({
        success: true,
        results: [],
      });

      vi.mocked(createAdminAuditContext).mockReturnValue({} as any);
      vi.mocked(logAdminAction).mockResolvedValue({ success: true });

      // Execute
      const response = await listDataDumps(mockContext);
      const responseData = await response.json();

      // Verify pagination was applied
      expect(mockContext.env.DB.prepare().bind).toHaveBeenCalledWith(10, 10); // limit, offset
      expect(responseData.success).toBe(true);
    });

    it('should handle database query failure', async () => {
      // Setup mocks
      vi.mocked(hasPermission).mockResolvedValue({ hasPermission: true });

      const mockContext = createMockContext(mockAuthContext);
      mockContext.env.DB.prepare().bind().all.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      // Execute & Verify
      await expect(listDataDumps(mockContext)).rejects.toThrow(ApiError);
      await expect(listDataDumps(mockContext)).rejects.toThrow('Failed to retrieve data dumps');
    });
  });
});
