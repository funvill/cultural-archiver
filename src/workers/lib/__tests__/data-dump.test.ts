/**
 * Unit tests for data dump system
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import {
  filterApprovedArtwork,
  sanitizeUserData,
  exportArtworkAsJSON,
  exportCreatorsAsJSON,
  exportTagsAsJSON,
  exportArtworkCreatorsAsJSON,
  collectThumbnailPhotos,
  generateCC0License,
  generateDataDumpReadme,
  createDataDumpArchive,
  generatePublicDataDump,
  type ExportArtworkData,
  type DataDumpMetadata,
} from '../data-dump';
import type { WorkerEnv } from '../../types';

// Mock the archive module (relative to lib directory, one level up from __tests__)
vi.mock('../archive', () => ({
  createZipArchive: vi.fn().mockResolvedValue({
    archiveBuffer: new ArrayBuffer(2048),
    totalFiles: 7,
    totalSize: 2048,
    createdAt: new Date().toISOString(),
  }),
}));

describe('Data Dump System', () => {
  // Mock D1 database
  const mockDb = {
    prepare: vi.fn(),
  } as unknown as D1Database;

  // Mock WorkerEnv
  const mockEnv: WorkerEnv = {
    DB: mockDb,
    PHOTOS_BUCKET: {
      get: vi.fn(),
    } as any,
  } as WorkerEnv;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('filterApprovedArtwork', () => {
    it('should filter and return only approved artwork', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [
            {
              id: '123',
              lat: 49.2827,
              lon: -123.1207,
              type_id: 'sculpture',
              created_at: '2024-01-01T12:00:00Z',
              tags: '{"material": "bronze", "style": "modern"}',
              photos: '["photo1.jpg", "photo2_800.jpg"]',
              type_name: 'Sculpture',
            },
            {
              id: '456',
              lat: 49.2828,
              lon: -123.1208,
              type_id: 'mural',
              created_at: '2024-01-02T12:00:00Z',
              tags: null,
              photos: null,
              type_name: 'Mural',
            },
          ],
        }),
      });

      const result = await filterApprovedArtwork(mockDb);

      expect(result.success).toBe(true);
      expect(result.artworks).toHaveLength(2);
      expect(result.total_count).toBe(2);

      const firstArtwork = result.artworks![0];
      expect(firstArtwork.id).toBe('123');
      expect(firstArtwork.lat).toBe(49.2827);
      expect(firstArtwork.tags).toEqual({ material: 'bronze', style: 'modern' });
      expect(firstArtwork.photos).toEqual(['photo1.jpg', 'photo2_800.jpg']);
      expect(firstArtwork.type_name).toBe('Sculpture');

      const secondArtwork = result.artworks![1];
      expect(secondArtwork.id).toBe('456');
      expect(secondArtwork.tags).toBeUndefined();
      expect(secondArtwork.photos).toBeUndefined();
    });

    it('should handle database query failure', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: false,
          error: 'Database connection failed',
        }),
      });

      const result = await filterApprovedArtwork(mockDb);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to query approved artwork');
    });

    it('should handle malformed JSON in tags and photos gracefully', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [
            {
              id: '123',
              lat: 49.0,
              lon: -123.0,
              type_id: 'test',
              created_at: '2024-01-01T12:00:00Z',
              tags: 'invalid json{',
              photos: '[invalid json',
              type_name: 'Test',
            },
          ],
        }),
      });

      // Mock console.warn to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await filterApprovedArtwork(mockDb);

      expect(result.success).toBe(true);
      expect(result.artworks).toHaveLength(1);

      const artwork = result.artworks![0];
      expect(artwork.tags).toBeUndefined();
      expect(artwork.photos).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledTimes(2); // Should warn about both parsing failures

      consoleSpy.mockRestore();
    });
  });

  describe('sanitizeUserData', () => {
    it('should remove sensitive fields from data', () => {
      const data = {
        id: '123',
        name: 'Public Data',
        user_token: 'secret-token',
        email: 'user@example.com',
        ip_address: '192.168.1.1',
        lat: 49.0,
        lon: -123.0,
        moderation_notes: 'Internal notes',
        created_at: '2024-01-01T12:00:00Z',
      };

      const sanitized = sanitizeUserData(data);

      expect(sanitized).toEqual({
        id: '123',
        name: 'Public Data',
        lat: 49.0,
        lon: -123.0,
        created_at: '2024-01-01T12:00:00Z',
      });

      // Ensure sensitive fields are removed
      expect(sanitized.user_token).toBeUndefined();
      expect(sanitized.email).toBeUndefined();
      expect(sanitized.ip_address).toBeUndefined();
      expect(sanitized.moderation_notes).toBeUndefined();
    });

    it('should handle empty data objects', () => {
      const sanitized = sanitizeUserData({});
      expect(sanitized).toEqual({});
    });

    it('should preserve non-sensitive data completely', () => {
      const data = {
        id: '123',
        name: 'Test',
        lat: 49.0,
        lon: -123.0,
        tags: { material: 'bronze' },
        photos: ['photo1.jpg'],
        created_at: '2024-01-01T12:00:00Z',
      };

      const sanitized = sanitizeUserData(data);
      expect(sanitized).toEqual(data);
    });
  });

  describe('exportArtworkAsJSON', () => {
    it('should export artwork as formatted JSON', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [
            {
              id: '123',
              lat: 49.2827,
              lon: -123.1207,
              type_id: 'sculpture',
              created_at: '2024-01-01T12:00:00Z',
              tags: '{"material": "bronze"}',
              photos: '["photo1.jpg"]',
              type_name: 'Sculpture',
            },
          ],
        }),
      });

      const result = await exportArtworkAsJSON(mockDb);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.json_content).toBeDefined();

      const parsedJson = JSON.parse(result.json_content!);
      expect(parsedJson).toHaveLength(1);
      expect(parsedJson[0].id).toBe('123');
      expect(parsedJson[0].tags).toEqual({ material: 'bronze' });
    });

    it('should handle filtering failure', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: false,
        }),
      });

      const result = await exportArtworkAsJSON(mockDb);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('exportCreatorsAsJSON', () => {
    it('should export creators as formatted JSON', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [
            {
              id: '456',
              name: 'Artist Name',
              bio: 'Famous sculptor',
              created_at: '2024-01-01T12:00:00Z',
            },
            {
              id: '789',
              name: 'Another Artist',
              bio: null,
              created_at: '2024-01-02T12:00:00Z',
            },
          ],
        }),
      });

      const result = await exportCreatorsAsJSON(mockDb);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);

      const parsedJson = JSON.parse(result.json_content!);
      expect(parsedJson).toHaveLength(2);
      expect(parsedJson[0].name).toBe('Artist Name');
      expect(parsedJson[0].bio).toBe('Famous sculptor');
      expect(parsedJson[1].bio).toBeUndefined(); // null converted to undefined
    });

    it('should handle database query failure', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: false,
        }),
      });

      const result = await exportCreatorsAsJSON(mockDb);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to query creators');
    });
  });

  describe('exportTagsAsJSON', () => {
    it('should export tags for approved artwork only', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      // First call: artwork query (approved artwork with tags)
      mockPrepare.mockReturnValueOnce({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [
            {
              id: 'art-1',
              tags: JSON.stringify({ material: 'bronze', style: 'modern', _internal: 'skip' }),
              created_at: '2024-01-01T12:00:00Z',
            },
          ],
        }),
      });

      // Second call: artists query (approved artists with tags)
      mockPrepare.mockReturnValueOnce({
        all: vi.fn().mockResolvedValue({ success: true, results: [] }),
      });

      const result = await exportTagsAsJSON(mockDb);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);

      const parsedJson = JSON.parse(result.json_content!) as Array<{
        id: string;
        label: string;
        value: string;
        created_at: string;
      }>;
      expect(parsedJson).toHaveLength(2);
      // Should include the two user-facing tags from artwork.tags
      const labels = parsedJson.map(t => t.label);
      const values = parsedJson.map(t => t.value);
      expect(labels).toContain('material');
      expect(values).toContain('bronze');
      expect(labels).toContain('style');
      expect(values).toContain('modern');
    });
  });

  describe('exportArtworkCreatorsAsJSON', () => {
    it('should export artwork-creator relationships', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [
            {
              artwork_id: '123',
              creator_id: '456',
              role: 'artist',
              created_at: '2024-01-01T12:00:00Z',
            },
            {
              artwork_id: '123',
              creator_id: '789',
              role: 'architect',
              created_at: '2024-01-01T12:00:00Z',
            },
          ],
        }),
      });

      const result = await exportArtworkCreatorsAsJSON(mockDb);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);

      const parsedJson = JSON.parse(result.json_content!);
      expect(parsedJson).toHaveLength(2);
      expect(parsedJson[0].artwork_id).toBe('123');
      expect(parsedJson[0].creator_id).toBe('456');
      expect(parsedJson[0].role).toBe('artist');
    });
  });

  describe('collectThumbnailPhotos', () => {
    it('should collect thumbnail photos from approved artwork', async () => {
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;

      const approvedArtwork: ExportArtworkData[] = [
        {
          id: '123',
          lat: 49.0,
          lon: -123.0,
          type_id: 'test',
          created_at: '2024-01-01T12:00:00Z',
          photos: [
            'https://photos.domain.com/photos/original_123.jpg',
            'https://photos.domain.com/photos/thumbnails/artwork_123_800.jpg',
          ],
        },
        {
          id: '456',
          lat: 49.0,
          lon: -123.0,
          type_id: 'test',
          created_at: '2024-01-01T12:00:00Z',
          photos: ['https://photos.domain.com/photos/thumbnails/artwork_456_800.jpg'],
        },
      ];

      // Mock successful photo downloads
      const mockImageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
      mockBucket.get.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(mockImageData.buffer),
      });

      const result = await collectThumbnailPhotos(mockEnv, approvedArtwork);

      expect(result.success).toBe(true);
      expect(result.photos).toHaveLength(2); // Only thumbnails, not originals
      expect(result.total_count).toBe(2);
      expect(result.total_size).toBeGreaterThan(0);

      // Check that photos have correct paths and content
      const firstPhoto = result.photos![0];
      expect(firstPhoto.path).toMatch(/^photos\/thumbnails\//);
      expect(firstPhoto.content).toBeInstanceOf(ArrayBuffer);
      expect(firstPhoto.mimeType).toMatch(/^image\//);
    });

    it('should handle missing PHOTOS_BUCKET', async () => {
      const envWithoutBucket = { ...mockEnv, PHOTOS_BUCKET: undefined };

      const result = await collectThumbnailPhotos(envWithoutBucket as WorkerEnv, []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('PHOTOS_BUCKET not configured');
    });

    it('should handle failed photo downloads gracefully', async () => {
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;

      const approvedArtwork: ExportArtworkData[] = [
        {
          id: '123',
          lat: 49.0,
          lon: -123.0,
          type_id: 'test',
          created_at: '2024-01-01T12:00:00Z',
          photos: [
            'https://photos.domain.com/photos/thumbnails/good_800.jpg',
            'https://photos.domain.com/photos/thumbnails/missing_800.jpg',
          ],
        },
      ];

      // First photo succeeds, second fails
      const mockImageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      mockBucket.get
        .mockResolvedValueOnce({
          arrayBuffer: vi.fn().mockResolvedValue(mockImageData.buffer),
        })
        .mockResolvedValueOnce(null); // Simulate failed download

      const result = await collectThumbnailPhotos(mockEnv, approvedArtwork);

      expect(result.success).toBe(true);
      expect(result.photos).toHaveLength(1); // Only the successful photo
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0]).toContain('missing_800.jpg');
    });

    it('should filter out non-thumbnail photos', async () => {
      const approvedArtwork: ExportArtworkData[] = [
        {
          id: '123',
          lat: 49.0,
          lon: -123.0,
          type_id: 'test',
          created_at: '2024-01-01T12:00:00Z',
          photos: [
            'https://photos.domain.com/photos/original_123.jpg', // Should be excluded
            'https://photos.domain.com/photos/artwork_123_800.jpg', // Should be included
            'https://photos.domain.com/photos/thumbnail_123.jpg', // Should be included
          ],
        },
      ];

      const mockImageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;
      mockBucket.get.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(mockImageData.buffer),
      });

      const result = await collectThumbnailPhotos(mockEnv, approvedArtwork);

      expect(result.success).toBe(true);
      expect(result.photos).toHaveLength(2); // Only thumbnails
      expect(mockBucket.get).toHaveBeenCalledTimes(2); // Should not call for original
    });
  });

  describe('generateCC0License', () => {
    it('should generate valid CC0 license text', () => {
      const license = generateCC0License();

      expect(license).toContain('CC0 1.0 Universal');
      expect(license).toContain('Public Domain Dedication');
      expect(license).toContain('creativecommons.org');
      expect(license.length).toBeGreaterThan(100);
    });
  });

  describe('generateDataDumpReadme', () => {
    it('should generate comprehensive README content', () => {
      const metadata: DataDumpMetadata = {
        version: '1.0.0',
        generated_at: '2024-01-01T12:00:00Z',
        license: 'CC0',
        source: 'Cultural Archiver Test',
        description: 'Test data dump',
        data_info: {
          total_artworks: 100,
          total_creators: 50,
          total_tags: 200,
          total_photos: 150,
        },
        filter_info: {
          status_filter: 'approved',
          excluded_fields: ['user_token', 'email'],
          photo_types: 'thumbnails_only',
        },
        file_structure: {
          'artwork.json': 'Artwork data',
          'creators.json': 'Creator data',
        },
      };

      const readme = generateDataDumpReadme(metadata);

      expect(readme).toContain('Cultural Archiver Public Data Dump');
      expect(readme).toContain('2024-01-01T12:00:00Z');
      expect(readme).toContain('CC0');
      expect(readme).toContain('100'); // artwork count
      expect(readme).toContain('artwork.json');
      expect(readme).toContain('creators.json');
      expect(readme.length).toBeGreaterThan(1000); // Should be comprehensive
    });
  });

  describe('createDataDumpArchive', () => {
    it('should create archive with all required files', async () => {
      const artworkJson = JSON.stringify([{ id: '123', name: 'Test' }]);
      const creatorsJson = JSON.stringify([{ id: '456', name: 'Artist' }]);
      const tagsJson = JSON.stringify([{ id: '789', label: 'material' }]);
      const relationshipsJson = JSON.stringify([{ artwork_id: '123', creator_id: '456' }]);
      const photos = [{ path: 'photo1.jpg', content: new Uint8Array([1, 2, 3]).buffer }];
      const metadata: DataDumpMetadata = {
        version: '1.0.0',
        generated_at: '2024-01-01T12:00:00Z',
        license: 'CC0',
        source: 'Test',
        description: 'Test data dump',
        data_info: { total_artworks: 1, total_creators: 1, total_tags: 1, total_photos: 1 },
        filter_info: {
          status_filter: 'approved',
          excluded_fields: [],
          photo_types: 'thumbnails_only',
        },
        file_structure: {},
      };

      const archiveBuffer = await createDataDumpArchive(
        artworkJson,
        creatorsJson,
        tagsJson,
        relationshipsJson,
        photos,
        metadata
      );

      expect(archiveBuffer).toBeInstanceOf(ArrayBuffer);
      expect(archiveBuffer.byteLength).toBeGreaterThan(0);

      // Verify that createZipArchive was called with correct files
      const { createZipArchive } = await import('../archive');
      expect(createZipArchive).toHaveBeenCalled();

      const callArgs = (createZipArchive as any).mock.calls[0];
      const archiveFiles = callArgs[0];

      // Should include all required files
      expect(archiveFiles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'LICENSE.txt' }),
          expect.objectContaining({ path: 'README.md' }),
          expect.objectContaining({ path: 'artwork.json' }),
          expect.objectContaining({ path: 'creators.json' }),
          expect.objectContaining({ path: 'tags.json' }),
          expect.objectContaining({ path: 'artwork_creators.json' }),
          expect.objectContaining({ path: 'metadata.json' }),
        ])
      );
    });
  });

  describe('generatePublicDataDump', () => {
    it('should generate complete data dump successfully', async () => {
      // Mock successful database queries
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [
            {
              id: '123',
              lat: 49.0,
              lon: -123.0,
              type_id: 'test',
              created_at: '2024-01-01T12:00:00Z',
              tags: '{}',
              photos: '["test_800.jpg"]',
              type_name: 'Test',
            },
          ],
        }),
      });

      // Mock successful photo collection
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;
      mockBucket.get.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      });

      const result = await generatePublicDataDump(mockEnv);

      expect(result.success).toBe(true);
      expect(result.data_dump_file).toBeInstanceOf(ArrayBuffer);
      expect(result.filename).toMatch(/^datadump-\d{4}-\d{2}-\d{2}\.zip$/);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.license).toBe('CC0');
      expect(result.metadata!.source).toBe('Cultural Archiver');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle artwork export failure', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: false,
        }),
      });

      const result = await generatePublicDataDump(mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Artwork export failed');
    });

    it('should include warnings in result', async () => {
      // Mock successful database operations
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [
            {
              id: '123',
              lat: 49.0,
              lon: -123.0,
              type_id: 'test',
              created_at: '2024-01-01T12:00:00Z',
              tags: '{}',
              photos: '["good_800.jpg", "bad_800.jpg"]',
              type_name: 'Test',
            },
          ],
        }),
      });

      // Mock photo collection with failures
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;
      mockBucket.get
        .mockResolvedValueOnce({
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
        })
        .mockResolvedValueOnce(null); // Failed download

      const result = await generatePublicDataDump(mockEnv);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings!.some(w => w.includes('bad_800.jpg'))).toBe(true);
    });

    it('should generate proper filename format', async () => {
      // Mock minimal successful operations
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ success: true, results: [] }),
      });

      const mockBucket = mockEnv.PHOTOS_BUCKET as any;
      mockBucket.get.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      });

      const result = await generatePublicDataDump(mockEnv);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/^datadump-\d{4}-\d{2}-\d{2}\.zip$/);

      // Should use date format (not datetime)
      expect(result.filename).not.toContain('T');
      expect(result.filename).not.toContain(':');
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected database errors', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValue({
        all: vi.fn().mockRejectedValue(new Error('Database connection lost')),
      });

      const result = await filterApprovedArtwork(mockDb);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection lost');
    });

    it('should handle R2 bucket errors gracefully', async () => {
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;
      mockBucket.get.mockRejectedValue(new Error('R2 service unavailable'));

      const approvedArtwork: ExportArtworkData[] = [
        {
          id: '123',
          lat: 49.0,
          lon: -123.0,
          type_id: 'test',
          created_at: '2024-01-01T12:00:00Z',
          photos: ['test_800.jpg'],
        },
      ];

      const result = await collectThumbnailPhotos(mockEnv, approvedArtwork);

      expect(result.success).toBe(true); // Should succeed with warnings
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain('test_800.jpg');
    });

    it('should handle archive creation failures', async () => {
      // Mock createZipArchive to fail
      const { createZipArchive } = await import('../archive');
      (createZipArchive as any).mockRejectedValueOnce(new Error('Archive creation failed'));

      await expect(
        createDataDumpArchive('{}', '{}', '{}', '{}', [], {} as DataDumpMetadata)
      ).rejects.toThrow('Failed to create data dump archive');
    });
  });

  describe('Data Integrity', () => {
    it('should properly sanitize sensitive fields across all data types', async () => {
      const sensitiveData = {
        id: '123',
        public_field: 'visible',
        user_token: 'secret',
        email: 'user@example.com',
        ip_address: '192.168.1.1',
        moderation_notes: 'private',
        admin_comments: 'internal',
      };

      const sanitized = sanitizeUserData(sensitiveData);

      expect(sanitized).toHaveProperty('id');
      expect(sanitized).toHaveProperty('public_field');
      expect(sanitized).not.toHaveProperty('user_token');
      expect(sanitized).not.toHaveProperty('email');
      expect(sanitized).not.toHaveProperty('ip_address');
      expect(sanitized).not.toHaveProperty('moderation_notes');
      expect(sanitized).not.toHaveProperty('admin_comments');
    });

    it('should include only approved artwork status', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [],
        }),
      });

      await filterApprovedArtwork(mockDb);

      // Verify that the SQL query filters for approved status
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE a.status = 'approved'")
      );
    });

    it.skip('should generate complete metadata structure', async () => {
      // Mock successful operations with known counts
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [
            {
              id: '1',
              lat: 49.0,
              lon: -123.0,
              type_id: 'test',
              created_at: '2024-01-01T12:00:00Z',
              tags: '{}',
              photos: '[]',
              type_name: 'Test',
            },
            {
              id: '2',
              lat: 49.1,
              lon: -123.1,
              type_id: 'test',
              created_at: '2024-01-02T12:00:00Z',
              tags: '{}',
              photos: '[]',
              type_name: 'Test',
            },
          ], // 2 items
        }),
      });

      const mockBucket = mockEnv.PHOTOS_BUCKET as any;
      mockBucket.get.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      });

      const result = await generatePublicDataDump(mockEnv);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();

      const metadata = result.metadata!;
      expect(metadata.version).toBeDefined();
      expect(metadata.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(metadata.license).toBe('CC0');
      expect(metadata.data_info.total_artworks).toBe(2);
      expect(metadata.filter_info.status_filter).toBe('approved');
      expect(metadata.filter_info.photo_types).toBe('thumbnails_only');
      expect(metadata.file_structure).toHaveProperty('LICENSE.txt');
      expect(metadata.file_structure).toHaveProperty('README.md');
      expect(metadata.file_structure).toHaveProperty('artwork.json');
    });
  });
});
