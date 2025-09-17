/**
 * Tests for GET /api/artworks/nearby minimal mode (map pins)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNearbyArtworks } from '../discovery';
import type { WorkerEnv } from '../../types';
import type { Context } from 'hono';

// Mock validation middleware to inject minimal query
vi.mock('../../middleware/validation', () => ({
  getValidatedData: vi.fn(),
}));

// Mock database service to control findNearbyArtworks results
vi.mock('../../lib/database', () => ({
  createDatabaseService: vi.fn().mockImplementation(() => ({
    findNearbyArtworks: vi.fn().mockResolvedValue(mockNearbyArtworks),
  })),
}));

// Note: use real error helpers; no mock needed

// Sample nearby data returned by DB layer
const mockNearbyArtworks = [
  {
    id: 'art-1',
    lat: 49.2827,
    lon: -123.1207,
    type_name: 'mural',
    photos: '["https://example.com/a.jpg","https://example.com/b.jpg"]',
  },
  {
    id: 'art-2',
    lat: 49.28,
    lon: -123.12,
    type_name: 'statue',
    photos: null,
  },
];

// Helper: create mock Hono context
function createMockContext(params: Record<string, string> = {}): Context<{ Bindings: WorkerEnv }> {
  // Provide only the fields accessed in route code (DB is passed into createDatabaseService mock)
  const mockEnv = { DB: {} } as unknown as WorkerEnv;
  const ctx = {
    req: {
      param: vi.fn().mockImplementation((key: string) => params[key]),
      json: vi.fn(),
    },
    json: vi.fn(<T>(obj: T) => obj), // return the payload directly for assertions
    header: vi.fn(),
    env: mockEnv,
  } as unknown as Context<{ Bindings: WorkerEnv }>;
  return ctx;
}

describe('Discovery Route - Nearby minimal mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns compact minimal payload with recent_photo when available', async () => {
    const { getValidatedData } = await import('../../middleware/validation');
    vi.mocked(getValidatedData).mockReturnValue({
      lat: 49.2827,
      lon: -123.1207,
      radius: 500,
      limit: 50,
      minimal: true,
    });

    const c = createMockContext();
    const result = await getNearbyArtworks(c) as unknown as {
      success: boolean;
      data: {
        artworks: Array<{ id: string; lat: number; lon: number; type_name: string; recent_photo: string | null }>;
        total: number;
        search_center: { lat: number; lon: number };
        search_radius: number;
      };
    };

    // Ensure createSuccessResponse wrapper shape is present
    expect(result).toMatchObject({ success: true });
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data.artworks)).toBe(true);
    expect(result.data.total).toBe(2);
    expect(result.data.search_center).toEqual({ lat: 49.2827, lon: -123.1207 });
    expect(result.data.search_radius).toBe(500);

    // Validate minimal items shape
    const [a, b] = result.data.artworks;
    expect(a).toEqual({
      id: 'art-1',
      lat: 49.2827,
      lon: -123.1207,
      type_name: 'mural',
      recent_photo: 'https://example.com/a.jpg', // first parsed photo
    });
    expect(b).toEqual({
      id: 'art-2',
      lat: 49.28,
      lon: -123.12,
      type_name: 'statue',
      recent_photo: null,
    });
  });
});
