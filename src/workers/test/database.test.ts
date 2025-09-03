/**
 * Basic unit tests for database utilities
 */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, beforeAll } from 'vitest';
import { createDatabaseService } from '../lib/database';

// Mock Cloudflare D1 database for testing
const mockDB = {
  prepare: (_query: string) => ({
    bind: (..._params: unknown[]) => mockStatement,
    first: async (): Promise<unknown> => null,
    all: async () => ({
      results: [],
      success: true,
      meta: {
        changes: 1,
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
      },
    }),
    run: async () => ({
      success: true,
      results: [],
      meta: {
        changes: 1,
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
      },
    }),
    raw: async (): Promise<unknown[]> => [],
  }),
  batch: async (_statements: unknown[]) => {
    return _statements.map(() => ({
      success: true,
      results: [],
      meta: {
        changes: 1,
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
      },
    }));
  },
  exec: async (_query: string) => ({
    count: 0,
    duration: 0,
  }),
  withSession: (_constraintOrBookmark?: string) => ({
    getBookmark: (): null => null,
    ...mockDB,
  }),
  dump: async (): Promise<ArrayBuffer> => new ArrayBuffer(0),
} as unknown as D1Database;

// Helper variable for statement reference
const mockStatement = {
  bind: (..._params: unknown[]) => typeof mockStatement,
  first: async (): Promise<unknown> => null,
  all: async () => ({
    results: [],
    success: true,
    meta: {
      changes: 1,
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: 0,
      last_row_id: 0,
      changed_db: false,
    },
  }),
  run: async () => ({
    success: true,
    results: [],
    meta: {
      changes: 1,
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: 0,
      last_row_id: 0,
      changed_db: false,
    },
  }),
  raw: async (): Promise<unknown[]> => [],
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

  // Creator-related tests
  it('should handle createCreator', async () => {
    const creator = {
      name: 'Test Artist',
      bio: 'A test artist for unit testing',
    };

    const result = await dbService.createCreator(creator);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should handle getCreatorById query', async () => {
    const mockId = '550e8400-e29b-41d4-a716-446655440000';
    const result = await dbService.getCreatorById(mockId);
    expect(result).toBeNull(); // Mock returns null
  });

  it('should handle getCreatorByName query', async () => {
    const result = await dbService.getCreatorByName('Test Artist');
    expect(result).toBeNull(); // Mock returns null
  });

  it('should handle linkArtworkToCreator', async () => {
    const link = {
      artwork_id: '550e8400-e29b-41d4-a716-446655440000',
      creator_id: '660e8400-e29b-41d4-a716-446655440001',
      role: 'artist',
    };

    const result = await dbService.linkArtworkToCreator(link);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should handle getCreatorsForArtwork query', async () => {
    const mockArtworkId = '550e8400-e29b-41d4-a716-446655440000';
    const result = await dbService.getCreatorsForArtwork(mockArtworkId);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0); // Mock returns empty array
  });

  it('should handle getArtworksForCreator query', async () => {
    const mockCreatorId = '660e8400-e29b-41d4-a716-446655440001';
    const result = await dbService.getArtworksForCreator(mockCreatorId);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0); // Mock returns empty array
  });
});
