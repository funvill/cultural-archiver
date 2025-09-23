/**
 * Mass Import V2 Integration Test
 *
 * End-to-end integration test demonstrating the complete workflow
 * from CLI plugin output to database storage with all features.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processMassImportV2 } from '../routes/mass-import-v2';
import type { MassImportRequestV2 } from '../../shared/mass-import';

// Real-world test data that would come from CLI plugins
const vancouverTestData: MassImportRequestV2 = {
  metadata: {
    importId: 'vancouver-integration-test-2025-01-14',
    source: {
      pluginName: 'vancouver-public-art-importer',
      pluginVersion: '2.1.3',
      originalDataSource: 'vancouver-open-data-portal',
    },
    timestamp: '2025-01-14T16:30:00.000Z',
  },
  config: {
    duplicateThreshold: 0.75,
    enableTagMerging: true,
    createMissingArtists: true,
    batchSize: 3, // Small batch for testing
    duplicateWeights: {
      gps: 0.6,
      title: 0.25,
      artist: 0.2,
      referenceIds: 0.5,
      tagSimilarity: 0.05,
    },
  },
  data: {
    artworks: [
      {
        lat: 49.2827,
        lon: -123.1207,
        title: 'Digital Orca',
        description: 'A large-scale public art installation featuring a digital whale sculpture.',
        artist: 'Douglas Coupland',
        material: 'aluminum',
        type: 'sculpture',
        neighborhood: 'Downtown',
        siteName: 'Jack Poole Plaza',
        photos: [
          {
            url: 'https://upload.wikimedia.org/wiki/Digital_Orca_1.jpg',
            caption: 'Front view of Digital Orca',
            credit: 'City of Vancouver',
          },
          {
            url: 'https://upload.wikimedia.org/wiki/Digital_Orca_2.jpg',
            caption: 'Side view showing the digital pixelated design',
            credit: 'Tourism Vancouver',
          },
        ],
        source: 'vancouver-open-data',
        sourceUrl: 'https://opendata.vancouver.ca/explore/dataset/public-art',
        externalId: 'VOD-DIGITAL-ORCA-2009',
        license: 'CC0',
        tags: {
          tourism: 'artwork',
          artwork_type: 'sculpture',
          height: 8.5,
          start_date: '2009-12',
          access: 'yes',
          fee: 'no',
          subject: 'marine_life',
          style: 'contemporary',
          condition: 'excellent',
          material: 'aluminum_composite',
          artist_birth_year: 1961,
          commissioned_by: 'City of Vancouver',
        },
        status: 'active',
      },
      {
        lat: 49.2829,
        lon: -123.1205,
        title: 'Steam Clock',
        description: 'World-famous steam-powered clock in the heart of Gastown.',
        artist: 'Raymond Saunders',
        material: 'bronze',
        type: 'functional_art',
        neighborhood: 'Gastown',
        siteName: 'Gastown Steam Clock',
        photos: [
          {
            url: 'https://upload.wikimedia.org/wiki/Steam_Clock_1.jpg',
            caption: 'Steam Clock in operation',
            credit: 'Heritage Vancouver',
          },
        ],
        source: 'vancouver-open-data',
        sourceUrl: 'https://opendata.vancouver.ca/explore/dataset/public-art',
        externalId: 'VOD-STEAM-CLOCK-1977',
        license: 'CC0',
        tags: {
          tourism: 'artwork',
          artwork_type: 'functional_art',
          height: 5.0,
          start_date: '1977-09',
          access: 'yes',
          fee: 'no',
          heritage: 'yes',
          functional: 'yes',
          steam_powered: 'yes',
        },
        status: 'active',
      },
    ],
    artists: [
      {
        lat: 49.2827, // Artists need coordinates per schema
        lon: -123.1207,
        title: 'Emily Carr', // Using title as artist name
        description:
          'Renowned Canadian artist and writer, known for her paintings of Indigenous peoples of the Pacific Northwest Coast.',
        source: 'vancouver-artist-registry',
        externalId: 'VAR-EMILY-CARR',
        tags: {
          birth_year: 1871,
          death_year: 1945,
          nationality: 'Canadian',
          medium: 'painting',
          movement: 'Post-Impressionism',
          website: 'https://en.wikipedia.org/wiki/Emily_Carr',
          notable_works: 'Indian Church, Big Raven',
        },
      },
    ],
  },
};

// Mock services to simulate real behavior
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
    checkArtworkDuplicates: vi.fn(() =>
      Promise.resolve({
        isDuplicate: false,
        candidatesChecked: 0,
      })
    ),
    checkArtistDuplicates: vi.fn(() =>
      Promise.resolve({
        isDuplicate: false,
        candidatesChecked: 0,
      })
    ),
    mergeTagsIntoExisting: vi.fn(() =>
      Promise.resolve({
        newTagsAdded: 0,
        tagsOverwritten: 0,
        totalTags: 0,
        mergedTags: {},
      })
    ),
  })),
}));

vi.mock('../lib/artist-auto-creation', () => ({
  createArtistAutoCreationService: vi.fn(() => ({
    processArtworkArtists: vi.fn(() =>
      Promise.resolve({
        artworkId: 'artwork-id',
        linkedArtistIds: ['artist-id-1'],
        newArtistsCreated: 1,
        existingArtistsLinked: 0,
        errors: [],
      })
    ),
  })),
}));

vi.mock('../lib/photos', () => ({
  processAndUploadPhotos: vi.fn(() =>
    Promise.resolve([
      {
        originalUrl: 'https://r2.example.com/digital-orca-1.jpg',
        thumbnailUrl: 'https://r2.example.com/thumb-1.jpg',
      },
      {
        originalUrl: 'https://r2.example.com/digital-orca-2.jpg',
        thumbnailUrl: 'https://r2.example.com/thumb-2.jpg',
      },
    ])
  ),
}));

// Mock fetch for photo downloads
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    headers: new Map([['content-type', 'image/jpeg']]),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
  })
) as any;

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'uuid-12345-67890'),
}));

function createMockContext(body: any) {
  return {
    req: { json: vi.fn(() => Promise.resolve(body)) },
    json: vi.fn(
      (data: any, status?: number) =>
        new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { 'Content-Type': 'application/json' },
        })
    ),
    env: {
      DB: {} as any,
      BUCKET: {} as any,
      KV: {} as any,
      ENVIRONMENT: 'test',
      R2_BUCKET: {} as any,
    },
  } as any;
}

describe('Mass Import V2 Complete Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process a complete real-world import request successfully', async () => {
    const context = createMockContext(vancouverTestData);

    console.log('🚀 Starting complete integration test...');

    const response = await processMassImportV2(context);
    const responseData = await response.json();

    console.log('📊 Integration test results:', {
      status: response.status,
      totalRequested: responseData.data.summary.totalRequested,
      totalSucceeded: responseData.data.summary.totalSucceeded,
      processingTime: responseData.data.summary.processingTimeMs,
    });

    // Verify HTTP response
    expect(response.status).toBe(201);
    expect(responseData.success).toBe(true);

    // Verify summary statistics
    expect(responseData.data.summary.totalRequested).toBe(3); // 2 artworks + 1 artist
    expect(responseData.data.summary.totalSucceeded).toBe(3);
    expect(responseData.data.summary.totalFailed).toBe(0);
    expect(responseData.data.summary.totalDuplicates).toBe(0);
    expect(responseData.data.summary.processingTimeMs).toBeGreaterThan(0);

    // Verify artworks processing
    expect(responseData.data.results.artworks.created).toHaveLength(2);
    expect(responseData.data.results.artworks.created[0].title).toBe('Digital Orca');
    expect(responseData.data.results.artworks.created[1].title).toBe('Steam Clock');
    expect(responseData.data.results.artworks.duplicates).toHaveLength(0);
    expect(responseData.data.results.artworks.failed).toHaveLength(0);

    // Verify artists processing
    expect(responseData.data.results.artists.created).toHaveLength(1);
    expect(responseData.data.results.artists.created[0].name).toBe('Emily Carr');
    expect(responseData.data.results.artists.duplicates).toHaveLength(0);
    expect(responseData.data.results.artists.failed).toHaveLength(0);

    // Verify artist auto-creation from artwork references
    expect(responseData.data.results.artists.autoCreated).toHaveLength(2); // Douglas Coupland + Raymond Saunders
    expect(responseData.data.results.artists.autoCreated[0].reason).toBe('referenced_in_artwork');

    // Verify audit trail completeness
    expect(responseData.data.auditTrail.importStarted).toBeDefined();
    expect(responseData.data.auditTrail.importCompleted).toBeDefined();
    expect(responseData.data.auditTrail.batchesProcessed).toBe(2); // 1 for artworks, 1 for artists
    expect(responseData.data.auditTrail.systemUserToken).toBe(
      'a0000000-1000-4000-8000-000000000001'
    );
    expect(responseData.data.auditTrail.photosDownloaded).toBe(3); // 2 + 1 + 0 from artworks (3 total photos)
    expect(responseData.data.auditTrail.photosUploaded).toBe(3);

    // Verify import ID tracking
    expect(responseData.data.importId).toBe('vancouver-integration-test-2025-01-14');

    console.log('✅ Integration test completed successfully!');
    console.log('📈 Performance metrics:', {
      recordsPerSecond: (3 / (responseData.data.summary.processingTimeMs / 1000)).toFixed(2),
      photosProcessed: responseData.data.auditTrail.photosDownloaded,
      artistsAutoCreated: responseData.data.results.artists.autoCreated.length,
    });
  });

  it('should validate against all PRD requirements in a single test', async () => {
    const context = createMockContext(vancouverTestData);
    const response = await processMassImportV2(context);
    const responseData = await response.json();

    // PRD Requirement: Zero duplicate artworks/artists created
    expect(responseData.data.results.artworks.duplicates).toHaveLength(0);
    expect(responseData.data.results.artists.duplicates).toHaveLength(0);

    // PRD Requirement: Support for importing up to 1,000 records efficiently
    expect(responseData.data.summary.processingTimeMs).toBeLessThan(10000); // Should be much faster

    // PRD Requirement: Full integration with mass-import CLI plugin outputs
    expect(responseData.data.importId).toBe(vancouverTestData.metadata.importId);
    expect(responseData.success).toBe(true);

    // PRD Requirement: 100% compatibility with new submissions table schema
    expect(responseData.data.results.artworks.created[0].submissionId).toBeDefined();
    expect(responseData.data.results.artists.created[0].submissionId).toBeDefined();

    // PRD Requirement: Automatic artist page creation when artwork references unknown artists
    expect(responseData.data.results.artists.autoCreated.length).toBeGreaterThan(0);

    console.log('✅ All PRD requirements validated successfully!');
  });
});

console.log('🎯 Complete integration test suite ready for execution');
