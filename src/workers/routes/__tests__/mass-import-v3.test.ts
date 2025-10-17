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
    it('should return 401 for missing auth header', async () => {
      const ctx = createMockContext(
        {},
        { type: 'Feature', id: 'test-1', geometry: { type: 'Point', coordinates: [-123, 49] } }
      );

      const response = await handleMassImportV3(ctx);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for invalid bearer token', async () => {
      const ctx = createMockContext(
        { authorization: 'Bearer invalid-token' },
        { type: 'Feature', id: 'test-1', geometry: { type: 'Point', coordinates: [-123, 49] } }
      );

      const response = await handleMassImportV3(ctx);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for non-admin user', async () => {
      const ctx = createMockContext(
        { authorization: 'Bearer regular-user-token' },
        { type: 'Feature', id: 'test-1', geometry: { type: 'Point', coordinates: [-123, 49] } }
      );

      const response = await handleMassImportV3(ctx);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
      expect(data.error.message).toContain('Invalid authentication token');
    });

    it('should accept valid admin token', async () => {
      const SYSTEM_ADMIN_UUID = 'a0000000-1000-4000-8000-000000000001';
      const ctx = createMockContext(
        { authorization: `Bearer ${SYSTEM_ADMIN_UUID}` },
        {
          type: 'Feature',
          id: 'test-123',
          geometry: { type: 'Point', coordinates: [-123.0, 49.0] },
          properties: { title: 'Test', source: 'test', source_url: 'http://test.com' },
        }
      );

      const response = await handleMassImportV3(ctx);

      // Should not be 401 (will be 500 since handler not implemented yet)
      expect(response.status).not.toBe(401);
    });
  });

  describe('Type Detection', () => {
    const SYSTEM_ADMIN_UUID = 'a0000000-1000-4000-8000-000000000001';

    it('should return 400 for invalid JSON', async () => {
      const ctx = createMockContext({ authorization: `Bearer ${SYSTEM_ADMIN_UUID}` }, {});

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
        { authorization: `Bearer ${SYSTEM_ADMIN_UUID}` },
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
        { authorization: `Bearer ${SYSTEM_ADMIN_UUID}` },
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
        { authorization: `Bearer ${SYSTEM_ADMIN_UUID}` },
        {
          type: 'Feature',
          id: 'node/publicart117',
          geometry: { type: 'Point', coordinates: [-123.0, 49.0] },
          properties: { title: 'Test Artwork', source: 'test', source_url: 'http://test.com' },
        }
      );

      const response = await handleMassImportV3(ctx);

      // Artwork handler is now implemented with working mock DB, expect 200 success
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.type).toBe('artwork');
    });

    it('should route to artist handler for type "Artist"', async () => {
      const ctx = createMockContext(
        { authorization: `Bearer ${SYSTEM_ADMIN_UUID}` },
        {
          type: 'Artist',
          id: 'artist-123',
          name: 'Test Artist',
          properties: { source: 'test', source_url: 'http://test.com' },
        }
      );

      const response = await handleMassImportV3(ctx);

      // Artist handler is now implemented with working mock DB, expect 200 success
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.type).toBe('artist');
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
