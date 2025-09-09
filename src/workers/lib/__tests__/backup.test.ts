/**
 * Unit tests for backup system
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import {
  generateDatabaseDump,
  collectR2Photos,
  generateBackupMetadata,
  createBackupArchive,
  generateFullBackup,
  verifyBackupIntegrity,
  type DatabaseDumpResult,
  type PhotoCollectionResult,
  type BackupMetadata,
  type BackupResult,
} from '../backup';
import type { WorkerEnv } from '../../types';

// Mock the archive module (relative to lib directory, one level up from __tests__)
vi.mock('../archive', () => ({
  createZipArchive: vi.fn().mockResolvedValue({
    archiveBuffer: new ArrayBuffer(1024),
    totalFiles: 3,
    totalSize: 1024,
    createdAt: new Date().toISOString(),
  }),
}));

describe('Backup System', () => {
  // Mock D1 database
  const mockDb = {
    prepare: vi.fn(),
  } as unknown as D1Database;

  // Mock WorkerEnv
  const mockEnv: WorkerEnv = {
    DB: mockDb,
    PHOTOS_BUCKET: {
      list: vi.fn(),
      get: vi.fn(),
    } as any,
  } as WorkerEnv;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDatabaseDump', () => {
    it('should generate complete database dump', async () => {
      // Mock database responses
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      // Mock tables query
      mockPrepare.mockReturnValueOnce({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [{ name: 'artwork' }, { name: 'logbook' }],
        }),
      });

      // Mock schema and data queries for each table
      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            sql: 'CREATE TABLE artwork (id TEXT PRIMARY KEY, lat REAL, lon REAL);',
          }),
        }),
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [
            { id: '123', lat: 49.2827, lon: -123.1207, status: 'approved' },
            { id: '456', lat: 49.2828, lon: -123.1208, status: 'pending' },
          ],
        }),
      });

      const result = await generateDatabaseDump(mockDb);

      expect(result.success).toBe(true);
      expect(result.sql_dump).toBeDefined();
      expect(result.sql_dump).toContain('CREATE TABLE artwork');
      expect(result.sql_dump).toContain('INSERT INTO artwork');
      expect(result.sql_dump).toContain('PRAGMA foreign_keys = OFF');
      expect(result.sql_dump).toContain('BEGIN TRANSACTION');
      expect(result.sql_dump).toContain('COMMIT');
      expect(result.tables).toEqual(['artwork', 'logbook']);
      expect(result.total_records).toBeGreaterThan(0);
    });

    it('should handle empty tables', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      mockPrepare.mockReturnValueOnce({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [{ name: 'empty_table' }],
        }),
      });

      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            sql: 'CREATE TABLE empty_table (id TEXT PRIMARY KEY);',
          }),
        }),
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [],
        }),
      });

      const result = await generateDatabaseDump(mockDb);

      expect(result.success).toBe(true);
      expect(result.total_records).toBe(0);
      expect(result.sql_dump).toContain('empty_table');
    });

    it('should handle database errors gracefully', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: false,
          error: 'Database connection failed',
        }),
      });

      const result = await generateDatabaseDump(mockDb);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to retrieve database tables');
    });

    it('should escape SQL strings properly', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;

      mockPrepare.mockReturnValueOnce({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [{ name: 'test_table' }],
        }),
      });

      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            sql: 'CREATE TABLE test_table (id TEXT, note TEXT);',
          }),
        }),
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [
            { id: '123', note: "Test with 'single quotes'" },
            { id: '456', note: null },
          ],
        }),
      });

      const result = await generateDatabaseDump(mockDb);

      expect(result.success).toBe(true);
      expect(result.sql_dump).toContain("'Test with ''single quotes'''");
      expect(result.sql_dump).toContain('NULL');
    });
  });

  describe('collectR2Photos', () => {
    it('should collect all photos from R2 bucket', async () => {
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;

      // Mock list response
      mockBucket.list.mockResolvedValue({
        objects: [
          { key: 'original_123.jpg', size: 1024, uploaded: new Date().toISOString() },
          { key: 'thumbnail_123_800.jpg', size: 512, uploaded: new Date().toISOString() },
          { key: 'original_456.png', size: 2048, uploaded: new Date().toISOString() },
        ],
      });

      // Mock get responses
      const mockImageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
      mockBucket.get.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(mockImageData.buffer),
      });

      const result = await collectR2Photos(mockEnv);

      expect(result.success).toBe(true);
      expect(result.photos).toHaveLength(3);
      expect(result.originals_count).toBe(2); // original_123.jpg, original_456.png
      expect(result.thumbnails_count).toBe(1); // thumbnail_123_800.jpg
      expect(result.total_size).toBeGreaterThan(0);

      // Check photo structure
      const firstPhoto = result.photos![0];
      expect(firstPhoto.path).toMatch(/^photos\//);
      expect(firstPhoto.content).toBeInstanceOf(ArrayBuffer);
      expect(firstPhoto.mimeType).toBeDefined();
    });

    it('should handle empty R2 bucket', async () => {
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;

      mockBucket.list.mockResolvedValue({
        objects: [],
      });

      const result = await collectR2Photos(mockEnv);

      expect(result.success).toBe(true);
      expect(result.photos).toHaveLength(0);
      expect(result.originals_count).toBe(0);
      expect(result.thumbnails_count).toBe(0);
      expect(result.total_size).toBe(0);
    });

    it('should handle missing PHOTOS_BUCKET', async () => {
      const envWithoutBucket = { ...mockEnv, PHOTOS_BUCKET: undefined };

      const result = await collectR2Photos(envWithoutBucket as WorkerEnv);

      expect(result.success).toBe(false);
      expect(result.error).toContain('PHOTOS_BUCKET not configured');
    });

    it('should handle R2 errors gracefully', async () => {
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;

      mockBucket.list.mockRejectedValue(new Error('R2 connection failed'));

      const result = await collectR2Photos(mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toContain('R2 connection failed');
    });

    it('should handle individual photo download failures', async () => {
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;

      mockBucket.list.mockResolvedValue({
        objects: [
          { key: 'good_photo.jpg', size: 1024 },
          { key: 'bad_photo.jpg', size: 512 },
        ],
      });

      // First photo succeeds, second fails
      const mockImageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      mockBucket.get
        .mockResolvedValueOnce({
          arrayBuffer: vi.fn().mockResolvedValue(mockImageData.buffer),
        })
        .mockResolvedValueOnce(null); // Simulate failed download

      const result = await collectR2Photos(mockEnv);

      expect(result.success).toBe(true);
      expect(result.photos).toHaveLength(1); // Only the successful photo
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0]).toContain('bad_photo.jpg');
    });

    it('should correctly identify photo types by naming convention', async () => {
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;

      mockBucket.list.mockResolvedValue({
        objects: [
          { key: 'image.jpg', size: 1024 },
          { key: 'image_800.jpg', size: 512 },
          { key: 'thumbnail_image.png', size: 256 },
        ],
      });

      const mockImageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      mockBucket.get.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(mockImageData.buffer),
      });

      const result = await collectR2Photos(mockEnv);

      expect(result.success).toBe(true);
      expect(result.originals_count).toBe(1); // image.jpg
      expect(result.thumbnails_count).toBe(2); // image_800.jpg, thumbnail_image.png
    });
  });

  describe('generateBackupMetadata', () => {
    it('should generate complete metadata', () => {
      const databaseResult: DatabaseDumpResult = {
        success: true,
        sql_dump: 'CREATE TABLE test (id TEXT);',
        tables: ['artwork', 'logbook'],
        total_records: 100,
      };

      const photoResult: PhotoCollectionResult = {
        success: true,
        photos: [],
        originals_count: 50,
        thumbnails_count: 50,
        total_size: 1024 * 1024,
      };

      const metadata = generateBackupMetadata(databaseResult, photoResult);

      expect(metadata.version).toBeDefined();
      expect(metadata.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(metadata.backup_type).toBe('full');
      expect(metadata.generator).toContain('Cultural Archiver');

      expect(metadata.database_info.tables).toEqual(['artwork', 'logbook']);
      expect(metadata.database_info.total_records).toBe(100);
      expect(metadata.database_info.size_estimate).toBeGreaterThan(0);

      expect(metadata.photos_info.total_photos).toBe(100);
      expect(metadata.photos_info.originals_count).toBe(50);
      expect(metadata.photos_info.thumbnails_count).toBe(50);
      expect(metadata.photos_info.total_size).toBe(1024 * 1024);
    });

    it('should handle missing data gracefully', () => {
      const databaseResult: DatabaseDumpResult = { success: false };
      const photoResult: PhotoCollectionResult = { success: false };

      const metadata = generateBackupMetadata(databaseResult, photoResult);

      expect(metadata.database_info.tables).toEqual([]);
      expect(metadata.database_info.total_records).toBe(0);
      expect(metadata.photos_info.total_photos).toBe(0);
    });
  });

  describe('createBackupArchive', () => {
    it('should create archive with database, photos, and metadata', async () => {
      const databaseDump = 'CREATE TABLE test (id TEXT);';
      const photos = [{ path: 'photo1.jpg', content: new Uint8Array([1, 2, 3]).buffer }];
      const metadata: BackupMetadata = {
        version: '1.0.0',
        created_at: new Date().toISOString(),
        database_info: { tables: ['test'], total_records: 1, size_estimate: 100 },
        photos_info: { total_photos: 1, originals_count: 1, thumbnails_count: 0, total_size: 1024 },
        backup_type: 'full',
        generator: 'test',
      };

      const archiveBuffer = await createBackupArchive(databaseDump, photos, metadata);

      expect(archiveBuffer).toBeInstanceOf(ArrayBuffer);
      expect(archiveBuffer.byteLength).toBeGreaterThan(0);
    });

    it('should generate proper README content', async () => {
      const databaseDump = 'CREATE TABLE test (id TEXT);';
      const photos: any[] = [];
      const metadata: BackupMetadata = {
        version: '1.0.0',
        created_at: '2024-01-01T12:00:00Z',
        database_info: { tables: ['artwork', 'logbook'], total_records: 1000, size_estimate: 5000 },
        photos_info: {
          total_photos: 50,
          originals_count: 25,
          thumbnails_count: 25,
          total_size: 10485760,
        },
        backup_type: 'full',
        generator: 'Cultural Archiver Backup System',
      };

      const archiveBuffer = await createBackupArchive(databaseDump, photos, metadata);

      // Archive should be created successfully
      expect(archiveBuffer).toBeInstanceOf(ArrayBuffer);

      // The createZipArchive mock should have been called with proper files
  const { createZipArchive } = await import('../archive');
      expect(createZipArchive).toHaveBeenCalled();

      const callArgs = (createZipArchive as any).mock.calls[0];
      const archiveFiles = callArgs[0];

      expect(archiveFiles).toHaveLength(3); // database.sql, metadata.json, README.md
      expect(archiveFiles.some((f: any) => f.path === 'database.sql')).toBe(true);
      expect(archiveFiles.some((f: any) => f.path === 'metadata.json')).toBe(true);
      expect(archiveFiles.some((f: any) => f.path === 'README.md')).toBe(true);

      // Check README content
      const readmeFile = archiveFiles.find((f: any) => f.path === 'README.md');
      expect(readmeFile.content).toContain('Cultural Archiver Backup');
      expect(readmeFile.content).toContain('2024-01-01T12:00:00Z');
      expect(readmeFile.content).toContain('artwork, logbook');
      expect(readmeFile.content).toContain('1,000');
      expect(readmeFile.content).toContain('50');
      expect(readmeFile.content).toContain('10.00 MB');
    });
  });

  describe('verifyBackupIntegrity', () => {
    it('should verify backup integrity successfully', async () => {
      const databaseResult: DatabaseDumpResult = {
        success: true,
        sql_dump: 'CREATE TABLE test (id TEXT);',
        tables: ['test'],
        total_records: 10,
      };

      const photoResult: PhotoCollectionResult = {
        success: true,
        photos: [
          {
            path: 'photos/test.jpg',
            content: new Uint8Array([1, 2, 3]).buffer,
            mimeType: 'image/jpeg',
          },
        ],
        originals_count: 1,
        thumbnails_count: 0,
        total_size: 1024,
      };

      const backupResult: BackupResult = {
        success: true,
        backup_file: new ArrayBuffer(1024),
        filename: 'test-backup.zip',
        size: 1024,
        metadata: {
          version: '1.0.0',
          created_at: new Date().toISOString(),
          database_info: {
            tables: ['test'],
            total_records: 10,
            size_estimate: 100,
          },
          photos_info: {
            total_photos: 1,
            originals_count: 1,
            thumbnails_count: 0,
            total_size: 1024,
          },
          backup_type: 'full',
          generator: 'test',
        },
      };

      const verification = await verifyBackupIntegrity(backupResult, databaseResult, photoResult);

      expect(verification.valid).toBe(true);
      expect(verification.issues).toHaveLength(0);
      expect(verification.summary).toContain('10 records');
      expect(verification.summary).toContain('1 photos');
    });

    it('should detect integrity issues', async () => {
      const databaseResult: DatabaseDumpResult = {
        success: true,
        tables: ['test1', 'test2'],
        total_records: 100,
      };

      const photoResult: PhotoCollectionResult = {
        success: true,
        photos: [1, 2, 3].map(() => ({ path: 'test.jpg', content: new ArrayBuffer(100) })),
        total_size: 300,
      };

      const backupResult: BackupResult = {
        success: true,
        backup_file: new ArrayBuffer(50), // Too small
        size: 50,
        metadata: {
          version: '1.0.0',
          created_at: new Date().toISOString(),
          database_info: {
            tables: ['test1'], // Missing one table
            total_records: 90, // Wrong count
            size_estimate: 100,
          },
          photos_info: {
            total_photos: 2, // Wrong count
            originals_count: 2,
            thumbnails_count: 0,
            total_size: 200, // Wrong size
          },
          backup_type: 'full',
          generator: 'test',
        },
      };

      const verification = await verifyBackupIntegrity(backupResult, databaseResult, photoResult);

      expect(verification.valid).toBe(false);
      expect(verification.issues.length).toBeGreaterThan(0);
      expect(verification.issues.some(issue => issue.includes('Table count mismatch'))).toBe(true);
      expect(verification.issues.some(issue => issue.includes('Record count mismatch'))).toBe(true);
      expect(verification.issues.some(issue => issue.includes('Photo count mismatch'))).toBe(true);
      expect(verification.issues.some(issue => issue.includes('suspiciously small'))).toBe(true);
    });

    it('should handle failed backup verification', async () => {
      const databaseResult: DatabaseDumpResult = { success: true };
      const photoResult: PhotoCollectionResult = { success: true };
      const backupResult: BackupResult = { success: false, error: 'Backup failed' };

      const verification = await verifyBackupIntegrity(backupResult, databaseResult, photoResult);

      expect(verification.valid).toBe(false);
      expect(verification.issues).toContain('Backup creation failed or backup file missing');
      expect(verification.summary).toBe('Backup creation failed');
    });
  });

  describe('generateFullBackup with verification', () => {
    it('should generate complete backup successfully', async () => {
      // Mock successful database dump
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValueOnce({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [{ name: 'artwork' }],
        }),
      });
      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            sql: 'CREATE TABLE artwork (id TEXT);',
          }),
        }),
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [{ id: '123', lat: 49.0, lon: -123.0 }],
        }),
      });

      // Mock successful photo collection
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;
      mockBucket.list.mockResolvedValue({
        objects: [{ key: 'test.jpg', size: 1024 }],
      });
      mockBucket.get.mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      });

      const result = await generateFullBackup(mockEnv);

      expect(result.success).toBe(true);
      expect(result.backup_file).toBeInstanceOf(ArrayBuffer);
      expect(result.filename).toMatch(/^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.zip$/);
      expect(result.metadata).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle database failure', async () => {
      // Mock database failure
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({
          success: false,
          error: 'Database error',
        }),
      });

      const result = await generateFullBackup(mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database dump failed');
    });

    it('should handle photo collection failure', async () => {
      // Mock successful database dump
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValueOnce({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [{ name: 'artwork' }],
        }),
      });
      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            sql: 'CREATE TABLE artwork (id TEXT);',
          }),
        }),
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [],
        }),
      });

      // Mock photo collection failure
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;
      mockBucket.list.mockRejectedValue(new Error('R2 error'));

      const result = await generateFullBackup(mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Photo collection failed');
    });

    it('should include warnings in result', async () => {
      // Mock successful database dump
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValueOnce({
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [{ name: 'artwork' }],
        }),
      });
      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            sql: 'CREATE TABLE artwork (id TEXT);',
          }),
        }),
        all: vi.fn().mockResolvedValue({
          success: true,
          results: [],
        }),
      });

      // Mock photo collection with warnings
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;
      mockBucket.list.mockResolvedValue({
        objects: [
          { key: 'good.jpg', size: 1024 },
          { key: 'bad.jpg', size: 512 },
        ],
      });
      mockBucket.get
        .mockResolvedValueOnce({
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
        })
        .mockResolvedValueOnce(null); // Failed download

      const result = await generateFullBackup(mockEnv);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0]).toContain('bad.jpg');
    });

    it('should generate proper filename format', async () => {
      // Mock successful operations
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValueOnce({
        all: vi.fn().mockResolvedValue({ success: true, results: [] }),
      });
      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ sql: 'CREATE TABLE test (id TEXT);' }),
        }),
        all: vi.fn().mockResolvedValue({ success: true, results: [] }),
      });

      const mockBucket = mockEnv.PHOTOS_BUCKET as any;
      mockBucket.list.mockResolvedValue({ objects: [] });

      const result = await generateFullBackup(mockEnv);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.zip$/);

      // Should not contain colons (replaced with dashes)
      expect(result.filename).not.toContain(':');
      expect(result.filename!.endsWith('.zip')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database timeout gracefully', async () => {
      const mockPrepare = mockDb.prepare as MockedFunction<any>;
      mockPrepare.mockReturnValue({
        all: vi.fn().mockRejectedValue(new Error('Query timeout')),
      });

      const result = await generateDatabaseDump(mockDb);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query timeout');
    });

    it('should handle R2 rate limiting', async () => {
      const mockBucket = mockEnv.PHOTOS_BUCKET as any;
      mockBucket.list.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await collectR2Photos(mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should handle archive creation failures', async () => {
      // Mock createZipArchive to fail
  const { createZipArchive } = await import('../archive');
      (createZipArchive as any).mockRejectedValueOnce(new Error('Archive creation failed'));

      await expect(createBackupArchive('sql', [], {} as BackupMetadata)).rejects.toThrow(
        'Failed to create backup archive'
      );
    });
  });
});
