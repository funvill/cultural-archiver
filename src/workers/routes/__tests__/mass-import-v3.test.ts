/**
 * Tests for Mass Import v3 Endpoint - Phase 1
 * 
 * Tests routing, authentication, and type detection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleMassImportV3 } from '../mass-import-v3';
import type { WorkerEnv } from '../../types';
import type { Context } from 'hono';

// Mock database
const mockDb = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
  }),
};

const mockEnv = { DB: mockDb as unknown as WorkerEnv['DB'] } as unknown as WorkerEnv;

// Create mock Hono context
function createMockContext(
  headers: Record<string, string> = {},
  body: unknown = {}
): Context<{ Bindings: WorkerEnv }> {
  const ctx = {
    req: {
      header: vi.fn().mockImplementation((key: string) => headers[key.toLowerCase()]),
      json: vi.fn().mockResolvedValue(body),
    },
    json: vi.fn().mockImplementation((data: any, status?: number) => {
      return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
    env: mockEnv,
  } as unknown as Context<{ Bindings: WorkerEnv }>;
  return ctx;
}

describe('Mass Import v3 - Phase 1: Routing & Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 for missing Authorization header', async () => {
      const ctx = createMockContext({}, { type: 'Feature' });
      const response = await handleMassImportV3(ctx);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for invalid bearer token', async () => {
      const ctx = createMockContext(
        { authorization: 'Bearer invalid-token-12345' },
        { type: 'Feature' }
      );

      // Mock DB to return no user
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      const response = await handleMassImportV3(ctx);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for non-admin user', async () => {
      const ctx = createMockContext(
        { authorization: 'Bearer user-token-123' },
        { type: 'Feature' }
      );

      // Mock DB to return user but no admin role
      const mockPrepare = vi.fn();
      mockPrepare
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ id: 'user-123' }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null), // No admin role
        });

      mockDb.prepare = mockPrepare;

      const response = await handleMassImportV3(ctx);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
      expect(data.error.message).toContain('admin');
    });

    it('should accept valid admin token', async () => {
      const ctx = createMockContext(
        { authorization: 'Bearer admin-token-123' },
        {
          type: 'Feature',
          id: 'test-123',
          geometry: { type: 'Point', coordinates: [-123.0, 49.0] },
          properties: { title: 'Test', source: 'test', source_url: 'http://test.com' },
        }
      );

      // Mock DB to return user with admin role
      const mockPrepare = vi.fn();
      mockPrepare
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ id: 'admin-123' }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ role: 'admin' }),
        });

      mockDb.prepare = mockPrepare;

      const response = await handleMassImportV3(ctx);

      // Should not be 401 (will be 500 since handler not implemented yet)
      expect(response.status).not.toBe(401);
    });
  });

  describe('Type Detection', () => {
    beforeEach(() => {
      // Mock admin authentication for all type detection tests
      const mockPrepare = vi.fn();
      mockPrepare
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ id: 'admin-123' }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ role: 'admin' }),
        });

      mockDb.prepare = mockPrepare;
    });

    it('should return 400 for invalid JSON', async () => {
      const ctx = createMockContext({ authorization: 'Bearer admin-token' }, {});

      // Mock JSON parsing error
      ctx.req.json = vi.fn().mockRejectedValue(new Error('Invalid JSON'));

      const response = await handleMassImportV3(ctx);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing type field', async () => {
      const ctx = createMockContext(
        { authorization: 'Bearer admin-token' },
        { id: 'test-123' }
      );

      const response = await handleMassImportV3(ctx);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_TYPE');
    });

    it('should return 400 for invalid type field', async () => {
      const ctx = createMockContext(
        { authorization: 'Bearer admin-token' },
        { type: 'InvalidType', id: 'test-123' }
      );

      const response = await handleMassImportV3(ctx);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_TYPE');
      expect(data.error.details?.expectedTypes).toEqual(['Feature', 'Artist']);
    });

    it('should route to artwork handler for type "Feature"', async () => {
      const ctx = createMockContext(
        { authorization: 'Bearer admin-token' },
        {
          type: 'Feature',
          id: 'node/publicart117',
          geometry: { type: 'Point', coordinates: [-123.0, 49.0] },
          properties: { title: 'Test Artwork', source: 'test', source_url: 'http://test.com' },
        }
      );

      const response = await handleMassImportV3(ctx);

      // Artwork handler is implemented, expect database error without proper DB setup
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error.code).toBe('DATABASE_ERROR');
    });

    it('should route to artist handler for type "Artist"', async () => {
      const ctx = createMockContext(
        { authorization: 'Bearer admin-token' },
        {
          type: 'Artist',
          id: 'artist-123',
          name: 'Test Artist',
          properties: { source: 'test', source_url: 'http://test.com' },
        }
      );

      const response = await handleMassImportV3(ctx);

      // Artist handler is implemented, expect error due to DB method not being available
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return structured error responses', async () => {
      const ctx = createMockContext({}, { type: 'Feature' });
      const response = await handleMassImportV3(ctx);

      const data = await response.json();
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code');
      expect(data.error).toHaveProperty('message');
    });
  });
});
