/**
 * Basic unit tests for database utilities
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createDatabaseService } from '../lib/database';

// Mock Cloudflare D1 database for testing
const mockDB = {
  prepare: (_query: string): object => ({
    bind: (..._params: unknown[]): object => ({
      first: async (): Promise<null> => null,
      all: async (): Promise<{ results: unknown[] }> => ({ results: [] }),
      run: async (): Promise<{ success: boolean; meta: { changes: number } }> => ({
        success: true,
        meta: { changes: 1 },
      }),
    }),
    first: async (): Promise<null> => null,
    all: async (): Promise<{ results: unknown[] }> => ({ results: [] }),
    run: async (): Promise<{ success: boolean; meta: { changes: number } }> => ({
      success: true,
      meta: { changes: 1 },
    }),
  }),
  batch: async (
    statements: unknown[]
  ): Promise<{ success: boolean; meta: { changes: number } }[]> => {
    return statements.map(() => ({ success: true, meta: { changes: 1 } }));
  },
  exec: async (_query: string): Promise<{ results: unknown[] }> => ({ results: [] }),
};

describe('Database Service', (): void => {
  let dbService: ReturnType<typeof createDatabaseService>;

  beforeAll((): void => {
    dbService = createDatabaseService(mockDB as D1Database);
  });

  it('should create database service', (): void => {
    expect(dbService).toBeDefined();
    expect(typeof dbService.findNearbyArtworks).toBe('function');
    expect(typeof dbService.getArtworkById).toBe('function');
    expect(typeof dbService.createLogbookEntry).toBe('function');
  });

  it('should handle findNearbyArtworks query', async () => {
    const result = await dbService.findNearbyArtworks(49.2827, -123.1207, 1000, 20);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle getArtworkById query', async () => {
    const mockId = '550e8400-e29b-41d4-a716-446655440000';
    const result = await dbService.getArtworkById(mockId);
    expect(result).toBeNull(); // Mock returns null
  });

  it('should handle createLogbookEntry', async () => {
    const entry = {
      lat: 49.2827,
      lon: -123.1207,
      notes: 'Test entry',
      tags: { style: 'modern' },
      photos: ['photo1.jpg'],
      user_token: 'test-token',
    };

    const result = await dbService.createLogbookEntry(entry);
    expect(result).toBeDefined();
  });
});
