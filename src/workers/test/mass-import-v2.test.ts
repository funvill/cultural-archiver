/**
 * Mass Import V2 API Endpoint Tests
 * 
 * Test suite for the new mass import V2 endpoint that integrates with
 * the CLI plugin system and supports the unified submissions schema.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { processMassImportV2 } from '../routes/mass-import-v2';
import type { WorkerEnv } from '../types';
import type { MassImportRequestV2 } from '../../shared/mass-import';

// Mock the external dependencies
vi.mock('../lib/photos', () => ({
  processAndUploadPhotos: vi.fn(() => Promise.resolve([
    { originalUrl: 'https://example.com/photo1.jpg', thumbnailUrl: 'https://example.com/thumb1.jpg' }
  ])),
}));

vi.mock('../lib/database', () => ({
  createDatabaseService: vi.fn(() => ({
    db: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve({ success: true })),
          all: vi.fn(() => Promise.resolve({ results: [] })),
          first: vi.fn(() => Promise.resolve(null)),
        })),
      })),
    },
  })),
}));

vi.mock('../lib/mass-import-v2-duplicate-detection', () => ({
  createMassImportV2DuplicateDetectionService: vi.fn(() => ({
    checkArtworkDuplicates: vi.fn(() => Promise.resolve({
      isDuplicate: false,
      candidatesChecked: 0
    })),
    checkArtistDuplicates: vi.fn(() => Promise.resolve({
      isDuplicate: false,
      candidatesChecked: 0
    })),
    mergeTagsIntoExisting: vi.fn(() => Promise.resolve({
      newTagsAdded: 0,
      tagsOverwritten: 0,
      totalTags: 0,
      mergedTags: {}
    })),
  })),
}));

vi.mock('../lib/artist-auto-creation', () => ({
  createArtistAutoCreationService: vi.fn(() => ({
    processArtworkArtists: vi.fn(() => Promise.resolve({
      artworkId: 'test-artwork-id',
      linkedArtistIds: [],
      newArtistsCreated: 0,
      existingArtistsLinked: 0,
      errors: []
    })),
  })),
}));

// Mock fetch for photo downloading
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock crypto.randomUUID
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid-12345'),
}));

// Create mock environment and context
function createMockEnv(): WorkerEnv {
  return {
    DB: {} as any,
    BUCKET: {} as any,
    KV: {} as any,
    ENVIRONMENT: 'test'
  };
}

function createMockContext(body: any) {
  return {
    req: {
      json: vi.fn(() => Promise.resolve(body))
    },
    json: vi.fn((data: any, status?: number) => {
      return new Response(JSON.stringify(data), { 
        status: status || 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }),
    env: createMockEnv(),
  } as any;
}

// Valid test request
const validRequest: MassImportRequestV2 = {
  metadata: {
    importId: 'test-import-123',
    source: {
      pluginName: 'vancouver-test-plugin',
      pluginVersion: '1.0.0',
      originalDataSource: 'vancouver-open-data'
    },
    timestamp: '2025-01-14T08:00:00.000Z'
  },
  config: {
    duplicateThreshold: 0.7,
    enableTagMerging: true,
    createMissingArtists: true,
    batchSize: 5
  },
  data: {
    artworks: [
      {
        lat: 49.2827,
        lon: -123.1207,
        title: 'Test Artwork',
        description: 'A test artwork for validation',
        artist: 'Test Artist',
        source: 'test-source',
        tags: { material: 'bronze', type: 'statue' }
      }
    ]
  }
};

describe('Mass Import V2 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Request Validation', () => {
    it('should validate a complete valid request', async () => {
      const context = createMockContext(validRequest);
      
      const response = await processMassImportV2(context);
      
      expect(response.status).toBe(201);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.importId).toBe('test-import-123');
    });

    it('should reject request without metadata', async () => {
      const invalidRequest = { ...validRequest };
      delete (invalidRequest as any).metadata;
      
      const context = createMockContext(invalidRequest);
      
      try {
        await processMassImportV2(context);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.validationErrors).toBeDefined();
      }
    });

    it('should reject request with invalid coordinates', async () => {
      const invalidRequest = {
        ...validRequest,
        data: {
          artworks: [{
            ...validRequest.data.artworks![0],
            lat: 100, // Invalid latitude
            lon: -123.1207
          }]
        }
      };
      
      const context = createMockContext(invalidRequest);
      
      try {
        await processMassImportV2(context);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.validationErrors.some((e: any) => e.field.includes('lat'))).toBe(true);
      }
    });

    it('should reject request with batch size too large', async () => {
      const invalidRequest = {
        ...validRequest,
        config: {
          ...validRequest.config,
          batchSize: 15 // Too large
        }
      };
      
      const context = createMockContext(invalidRequest);
      
      try {
        await processMassImportV2(context);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.validationErrors.some((e: any) => e.field.includes('batchSize'))).toBe(true);
      }
    });
  });

  describe('Response Format', () => {
    it('should return correct response structure for successful import', async () => {
      const context = createMockContext(validRequest);
      
      const response = await processMassImportV2(context);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.data.importId).toBe('test-import-123');
      expect(responseData.data.summary).toBeDefined();
      expect(responseData.data.summary.totalRequested).toBe(1);
      expect(responseData.data.results).toBeDefined();
      expect(responseData.data.results.artworks).toBeDefined();
      expect(responseData.data.results.artists).toBeDefined();
      expect(responseData.data.auditTrail).toBeDefined();
      expect(responseData.data.auditTrail.systemUserToken).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('should handle mixed artwork and artist data', async () => {
      const mixedRequest = {
        ...validRequest,
        data: {
          artworks: [validRequest.data.artworks![0]],
          artists: [{
            lat: 49.2827,
            lon: -123.1207,
            title: 'Test Artist Name',
            description: 'A test artist biography',
            source: 'test-source',
            tags: { website: 'https://example.com' }
          }]
        }
      };
      
      const context = createMockContext(mixedRequest);
      
      const response = await processMassImportV2(context);
      const responseData = await response.json();
      
      expect(responseData.data.summary.totalRequested).toBe(2);
      expect(responseData.data.results.artworks.created).toHaveLength(1);
      expect(responseData.data.results.artists.created).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty data gracefully', async () => {
      const emptyRequest = {
        ...validRequest,
        data: {}
      };
      
      const context = createMockContext(emptyRequest);
      
      try {
        await processMassImportV2(context);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.validationErrors.some((e: any) => e.code === 'EMPTY_DATA')).toBe(true);
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      const context = {
        req: {
          json: vi.fn(() => Promise.reject(new Error('Invalid JSON')))
        },
        json: vi.fn(),
        env: createMockEnv(),
      } as any;
      
      try {
        await processMassImportV2(context);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('MASS_IMPORT_ERROR');
      }
    });
  });
});

describe('Mass Import V2 Integration', () => {
  it('should process complete workflow successfully', async () => {
    const context = createMockContext(validRequest);
    
    const response = await processMassImportV2(context);
    
    expect(response.status).toBe(201);
    const responseData = await response.json();
    
    // Verify response structure
    expect(responseData.success).toBe(true);
    expect(responseData.data.summary.totalSucceeded).toBe(1);
    expect(responseData.data.summary.totalFailed).toBe(0);
    expect(responseData.data.summary.processingTimeMs).toBeGreaterThan(0);
    
    // Verify audit trail
    expect(responseData.data.auditTrail.importStarted).toBeDefined();
    expect(responseData.data.auditTrail.importCompleted).toBeDefined();
    expect(responseData.data.auditTrail.systemUserToken).toBeDefined();
  });
});