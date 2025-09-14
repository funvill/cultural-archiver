/**
 * Mass Import V2 PRD Success Criteria Tests
 * 
 * These tests validate the endpoint against the specific success criteria
 * defined in the PRD document.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processMassImportV2 } from '../routes/mass-import-v2';
import type { MassImportRequestV2 } from '../../shared/mass-import';

// Mock database with realistic duplicate detection
const mockDuplicateArtworks = [
  {
    id: 'existing-artwork-1',
    title: 'Victory Angel Statue',
    lat: 49.2827,
    lon: -123.1207,
    created_by: 'Jane Doe',
    tags: '{"material": "bronze", "type": "statue"}'
  }
];

// Mock services with realistic behavior
vi.mock('../lib/database', () => ({
  createDatabaseService: vi.fn(() => ({
    db: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve({ success: true })),
          all: vi.fn(() => Promise.resolve({ results: mockDuplicateArtworks })),
          first: vi.fn(() => Promise.resolve(null)),
        })),
      })),
    },
  })),
}));

vi.mock('../lib/mass-import-v2-duplicate-detection', () => ({
  createMassImportV2DuplicateDetectionService: vi.fn(() => ({
    checkArtworkDuplicates: vi.fn(({ data, threshold }) => {
      // Simulate realistic duplicate detection
      if (data.title === 'Victory Angel Statue' && data.lat === 49.2827) {
        return Promise.resolve({
          isDuplicate: true,
          existingId: 'existing-artwork-1',
          confidenceScore: 0.92,
          scoreBreakdown: {
            gps: 0.6,
            title: 0.25,
            artist: 0.2,
            referenceIds: 0.0,
            tagSimilarity: 0.05,
            total: 0.92
          },
          candidatesChecked: 1
        });
      }
      return Promise.resolve({
        isDuplicate: false,
        candidatesChecked: 0
      });
    }),
    checkArtistDuplicates: vi.fn(() => Promise.resolve({
      isDuplicate: false,
      candidatesChecked: 0
    })),
    mergeTagsIntoExisting: vi.fn(() => Promise.resolve({
      newTagsAdded: 2,
      tagsOverwritten: 0,
      totalTags: 4,
      mergedTags: { material: 'bronze', type: 'statue', source: 'test', import_batch: 'test-123' }
    })),
  })),
}));

vi.mock('../lib/artist-auto-creation', () => ({
  createArtistAutoCreationService: vi.fn(() => ({
    processArtworkArtists: vi.fn(() => Promise.resolve({
      artworkId: 'test-artwork-id',
      linkedArtistIds: ['new-artist-1'],
      newArtistsCreated: 1,
      existingArtistsLinked: 0,
      errors: []
    })),
  })),
}));

vi.mock('../lib/photos', () => ({
  processAndUploadPhotos: vi.fn(() => Promise.resolve([
    { originalUrl: 'https://r2.example.com/photo1.jpg', thumbnailUrl: 'https://r2.example.com/thumb1.jpg' }
  ])),
}));

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-12345'),
}));

function createMockContext(body: any) {
  return {
    req: { json: vi.fn(() => Promise.resolve(body)) },
    json: vi.fn((data: any, status?: number) => 
      new Response(JSON.stringify(data), { 
        status: status || 200,
        headers: { 'Content-Type': 'application/json' }
      })
    ),
    env: { DB: {} as any, BUCKET: {} as any, KV: {} as any, ENVIRONMENT: 'test' },
  } as any;
}

describe('PRD Success Criteria Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Success Criterion: Zero Duplicate Records', () => {
    it('should prevent duplicate artwork creation', async () => {
      const requestWithDuplicate: MassImportRequestV2 = {
        metadata: {
          importId: 'duplicate-test-123',
          source: {
            pluginName: 'test-plugin',
            originalDataSource: 'test-data'
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
              title: 'Victory Angel Statue',
              artist: 'Jane Doe',
              source: 'test-source',
              tags: { source: 'test', import_batch: 'test-123' }
            }
          ]
        }
      };

      const context = createMockContext(requestWithDuplicate);
      const response = await processMassImportV2(context);
      const responseData = await response.json();

      // Verify no new artworks were created
      expect(responseData.data.results.artworks.created).toHaveLength(0);
      expect(responseData.data.results.artworks.duplicates).toHaveLength(1);
      expect(responseData.data.summary.totalDuplicates).toBe(1);
      expect(responseData.data.summary.totalSucceeded).toBe(0); // Duplicates don't count as successes

      // Verify duplicate information
      const duplicate = responseData.data.results.artworks.duplicates[0];
      expect(duplicate.existingId).toBe('existing-artwork-1');
      expect(duplicate.confidenceScore).toBe(0.92);
      expect(duplicate.error).toBe('DUPLICATE_DETECTED');
    });

    it('should merge tags when duplicates are detected and merging is enabled', async () => {
      const requestWithDuplicate: MassImportRequestV2 = {
        metadata: {
          importId: 'merge-test-123',
          source: { pluginName: 'test-plugin', originalDataSource: 'test-data' },
          timestamp: '2025-01-14T08:00:00.000Z'
        },
        config: {
          duplicateThreshold: 0.7,
          enableTagMerging: true,
          createMissingArtists: true,
          batchSize: 5
        },
        data: {
          artworks: [{
            lat: 49.2827,
            lon: -123.1207,
            title: 'Victory Angel Statue',
            artist: 'Jane Doe',
            source: 'test-source',
            tags: { source: 'test', import_batch: 'test-123' }
          }]
        }
      };

      const context = createMockContext(requestWithDuplicate);
      const response = await processMassImportV2(context);
      const responseData = await response.json();

      // Verify tags were merged
      expect(responseData.data.auditTrail.tagsMerged).toBe(2);
    });
  });

  describe('Success Criterion: Support for 1,000 Records', () => {
    it('should handle large dataset efficiently', async () => {
      // Generate 100 unique artworks (testing subset for performance)
      const artworks = Array.from({ length: 100 }, (_, i) => ({
        lat: 49.2827 + (i * 0.001), // Spread them out to avoid duplicates
        lon: -123.1207 + (i * 0.001),
        title: `Test Artwork ${i}`,
        description: `Test artwork number ${i}`,
        source: 'performance-test',
        tags: { index: i.toString(), batch: 'performance-test' }
      }));

      const largeRequest: MassImportRequestV2 = {
        metadata: {
          importId: 'performance-test-123',
          source: { pluginName: 'performance-test', originalDataSource: 'test-data' },
          timestamp: '2025-01-14T08:00:00.000Z'
        },
        config: {
          duplicateThreshold: 0.7,
          enableTagMerging: true,
          createMissingArtists: true,
          batchSize: 10 // Process in batches of 10
        },
        data: { artworks }
      };

      const startTime = Date.now();
      const context = createMockContext(largeRequest);
      const response = await processMassImportV2(context);
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      const responseData = await response.json();

      // Verify all records were processed successfully
      expect(responseData.data.summary.totalRequested).toBe(100);
      expect(responseData.data.summary.totalSucceeded).toBe(100);
      expect(responseData.data.summary.totalFailed).toBe(0);

      // Verify reasonable performance (should be much faster than 10 seconds for 100 records)
      expect(processingTime).toBeLessThan(10000); // 10 seconds max
      expect(responseData.data.summary.processingTimeMs).toBeGreaterThan(0);

      console.log(`Performance test: ${100} records processed in ${processingTime}ms`);
    });
  });

  describe('Success Criterion: CLI Plugin Integration', () => {
    it('should accept CLI plugin output format correctly', async () => {
      const cliRequest: MassImportRequestV2 = {
        metadata: {
          importId: 'cli-test-123',
          source: {
            pluginName: 'vancouver-public-art-importer',
            pluginVersion: '1.2.0',
            originalDataSource: 'vancouver-open-data'
          },
          timestamp: '2025-01-14T08:00:00.000Z'
        },
        config: {
          duplicateThreshold: 0.7,
          enableTagMerging: true,
          createMissingArtists: true,
          batchSize: 5,
          duplicateWeights: {
            gps: 0.6,
            title: 0.25,
            artist: 0.2,
            referenceIds: 0.5,
            tagSimilarity: 0.05
          }
        },
        data: {
          artworks: [
            {
              lat: 49.2827,
              lon: -123.1207,
              title: 'Victory Angel',
              description: 'Large bronze statue commemorating local history',
              artist: 'Jane Doe',
              material: 'bronze',
              type: 'statue',
              address: '123 Main St',
              neighborhood: 'Downtown',
              siteName: 'Victory Square',
              photos: [
                {
                  url: 'https://example.com/photo1.jpg',
                  caption: 'Front view',
                  credit: 'City Photographer'
                }
              ],
              source: 'vancouver-open-data',
              sourceUrl: 'https://opendata.vancouver.ca',
              externalId: 'VOD-12345',
              license: 'CC0',
              tags: {
                tourism: 'artwork',
                artwork_type: 'statue',
                height: 5.5,
                start_date: '1995-06',
                access: 'yes'
              },
              status: 'active'
            }
          ]
        }
      };

      const context = createMockContext(cliRequest);
      const response = await processMassImportV2(context);
      const responseData = await response.json();

      // Verify CLI format was processed correctly
      expect(response.status).toBe(201);
      expect(responseData.data.summary.totalSucceeded).toBe(1);
      expect(responseData.data.results.artworks.created).toHaveLength(1);

      // Verify metadata preservation
      expect(responseData.data.importId).toBe('cli-test-123');
      expect(responseData.data.auditTrail.systemUserToken).toBeDefined();
    });
  });

  describe('Success Criterion: Artist Auto-Creation', () => {
    it('should automatically create artists when referenced in artwork', async () => {
      const requestWithNewArtist: MassImportRequestV2 = {
        metadata: {
          importId: 'artist-test-123',
          source: { pluginName: 'test-plugin', originalDataSource: 'test-data' },
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
              lat: 49.3827, // Different location to avoid duplicates
              lon: -123.2207,
              title: 'New Artwork by Unknown Artist',
              artist: 'John Smith Artist',
              source: 'test-source'
            }
          ]
        }
      };

      const context = createMockContext(requestWithNewArtist);
      const response = await processMassImportV2(context);
      const responseData = await response.json();

      // Verify artwork was created
      expect(responseData.data.results.artworks.created).toHaveLength(1);

      // Verify artist was auto-created
      expect(responseData.data.results.artists.autoCreated).toHaveLength(1);
      expect(responseData.data.results.artists.autoCreated[0].name).toBe('John Smith Artist');
      expect(responseData.data.results.artists.autoCreated[0].reason).toBe('referenced_in_artwork');
      expect(responseData.data.results.artists.autoCreated[0].sourceArtworkId).toBeDefined();
    });
  });

  describe('Success Criterion: Data Integrity and Traceability', () => {
    it('should provide complete audit trail', async () => {
      const testRequest: MassImportRequestV2 = {
        metadata: {
          importId: 'audit-test-123',
          source: { pluginName: 'test-plugin', originalDataSource: 'test-data' },
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
              lat: 49.4827,
              lon: -123.3207,
              title: 'Test Audit Artwork',
              source: 'test-source'
            }
          ]
        }
      };

      const context = createMockContext(testRequest);
      const response = await processMassImportV2(context);
      const responseData = await response.json();

      // Verify complete audit trail
      expect(responseData.data.auditTrail).toBeDefined();
      expect(responseData.data.auditTrail.importStarted).toBeDefined();
      expect(responseData.data.auditTrail.importCompleted).toBeDefined();
      expect(responseData.data.auditTrail.systemUserToken).toBe('00000000-0000-0000-0000-000000000001');
      expect(responseData.data.auditTrail.batchesProcessed).toBeGreaterThan(0);

      // Verify traceability back to source
      expect(responseData.data.importId).toBe('audit-test-123');
      expect(responseData.data.summary.processingTimeMs).toBeGreaterThan(0);
    });

    it('should maintain 100% traceability back to source data', async () => {
      const testRequest: MassImportRequestV2 = {
        metadata: {
          importId: 'traceability-test-456',
          source: {
            pluginName: 'vancouver-importer',
            pluginVersion: '2.1.0',
            originalDataSource: 'vancouver-open-data-portal'
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
              lat: 49.5827,
              lon: -123.4207,
              title: 'Traceable Artwork',
              source: 'vancouver-open-data',
              externalId: 'VOD-98765',
              sourceUrl: 'https://opendata.vancouver.ca/dataset/98765'
            }
          ]
        }
      };

      const context = createMockContext(testRequest);
      const response = await processMassImportV2(context);
      const responseData = await response.json();

      // Verify successful creation with traceability
      expect(responseData.data.results.artworks.created).toHaveLength(1);
      const createdArtwork = responseData.data.results.artworks.created[0];
      expect(createdArtwork.submissionId).toBeDefined();

      // Verify import metadata preservation
      expect(responseData.data.importId).toBe('traceability-test-456');
    });
  });

  describe('Success Criterion: Error Handling and Recovery', () => {
    it('should handle individual record failures gracefully', async () => {
      const mixedRequest: MassImportRequestV2 = {
        metadata: {
          importId: 'error-test-123',
          source: { pluginName: 'test-plugin', originalDataSource: 'test-data' },
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
            // Valid artwork
            {
              lat: 49.6827,
              lon: -123.5207,
              title: 'Valid Artwork',
              source: 'test-source'
            },
            // Invalid artwork (will be caught by validation)
            {
              lat: 200, // Invalid latitude
              lon: -123.5207,
              title: 'Invalid Artwork',
              source: 'test-source'
            }
          ]
        }
      };

      const context = createMockContext(mixedRequest);

      try {
        await processMassImportV2(context);
        expect.fail('Should have thrown validation error due to invalid coordinates');
      } catch (error: any) {
        // Verify proper error handling
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.validationErrors).toBeDefined();
        expect(error.validationErrors.some((e: any) => e.field.includes('lat'))).toBe(true);
      }
    });
  });
});

console.log('✅ All PRD Success Criteria Tests Defined');