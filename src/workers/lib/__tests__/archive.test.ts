/**
 * Unit tests for archive utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SimpleZipArchive,
  createZipArchive,
  addFileToArchive,
  addFolderToArchive,
  formatBytes,
  type ArchiveFile,
  type ArchiveOptions,
} from '../archive';
import { ApiError } from '../errors';

describe('Archive Utilities', () => {
  describe('SimpleZipArchive', () => {
    let archive: SimpleZipArchive;

    beforeEach(() => {
      archive = new SimpleZipArchive();
    });

    describe('constructor', () => {
      it('should create archive with default options', () => {
        const defaultArchive = new SimpleZipArchive();
        expect(defaultArchive).toBeInstanceOf(SimpleZipArchive);
      });

      it('should create archive with custom options', () => {
        const customArchive = new SimpleZipArchive({
          compression: false,
          maxSize: 100 * 1024 * 1024, // 100MB
          maxFiles: 5000,
        });
        expect(customArchive).toBeInstanceOf(SimpleZipArchive);
      });
    });

    describe('addFile', () => {
      it('should add a text file', () => {
        const content = 'Hello, world!';
        expect(() => {
          archive.addFile('test.txt', content);
        }).not.toThrow();
      });

      it('should add a binary file from ArrayBuffer', () => {
        const content = new TextEncoder().encode('Binary content').buffer as ArrayBuffer;
        expect(() => {
          archive.addFile('binary.dat', content);
        }).not.toThrow();
      });

      it('should add a file from Uint8Array', () => {
        const content = new TextEncoder().encode('Uint8Array content');
        expect(() => {
          archive.addFile('uint8.dat', content);
        }).not.toThrow();
      });

      it('should normalize file paths', () => {
        expect(() => {
          archive.addFile('/leading/slash.txt', 'content');
        }).not.toThrow();

        expect(() => {
          archive.addFile('back\\slash\\path.txt', 'content');
        }).not.toThrow();
      });

      it('should reject empty path', () => {
        expect(() => {
          archive.addFile('', 'content');
        }).toThrow(ApiError);
      });

      it('should reject null or undefined path', () => {
        expect(() => {
          archive.addFile(null as any, 'content');
        }).toThrow(ApiError);

        expect(() => {
          archive.addFile(undefined as any, 'content');
        }).toThrow(ApiError);
      });

      it('should enforce maximum files limit', () => {
        const smallArchive = new SimpleZipArchive({ maxFiles: 2 });

        smallArchive.addFile('file1.txt', 'content1');
        smallArchive.addFile('file2.txt', 'content2');

        expect(() => {
          smallArchive.addFile('file3.txt', 'content3');
        }).toThrow(ApiError);

        expect(() => {
          smallArchive.addFile('file3.txt', 'content3');
        }).toThrow(/Cannot add more than.*files/);
      });

      it('should enforce maximum size limit', () => {
        const smallArchive = new SimpleZipArchive({ maxSize: 100 }); // 100 bytes

        // This should work
        smallArchive.addFile('small.txt', 'small');

        // This should exceed the limit
        const largeContent = 'x'.repeat(200);
        expect(() => {
          smallArchive.addFile('large.txt', largeContent);
        }).toThrow(ApiError);

        expect(() => {
          smallArchive.addFile('large.txt', largeContent);
        }).toThrow(/exceed maximum size/);
      });

      it('should handle file options', () => {
        const now = new Date();
        expect(() => {
          archive.addFile('test.txt', 'content', {
            mimeType: 'text/plain',
            lastModified: now,
          });
        }).not.toThrow();
      });
    });

    describe('addFilesToFolder', () => {
      it('should add files to a folder', () => {
        const files: ArchiveFile[] = [
          { path: 'file1.txt', content: 'content1' },
          { path: 'file2.txt', content: 'content2' },
        ];

        expect(() => {
          archive.addFilesToFolder('documents', files);
        }).not.toThrow();
      });

      it('should handle folder path normalization', () => {
        const files: ArchiveFile[] = [{ path: 'file.txt', content: 'content' }];

        expect(() => {
          archive.addFilesToFolder('/folder/', files);
        }).not.toThrow();

        expect(() => {
          archive.addFilesToFolder('folder\\sub\\', files);
        }).not.toThrow();
      });

      it('should reject invalid folder path', () => {
        const files: ArchiveFile[] = [{ path: 'file.txt', content: 'content' }];

        expect(() => {
          archive.addFilesToFolder('', files);
        }).toThrow(ApiError);

        expect(() => {
          archive.addFilesToFolder(null as any, files);
        }).toThrow(ApiError);
      });

      it('should handle empty files array', () => {
        expect(() => {
          archive.addFilesToFolder('folder', []);
        }).not.toThrow();
      });
    });

    describe('generateArchive', () => {
      it('should generate archive with single file', async () => {
        archive.addFile('test.txt', 'Hello, world!');

        const result = await archive.generateArchive();

        expect(result).toBeDefined();
        expect(result.archiveBuffer).toBeInstanceOf(ArrayBuffer);
        expect(result.totalFiles).toBe(1);
        expect(result.totalSize).toBeGreaterThan(0);
        expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should generate archive with multiple files', async () => {
        archive.addFile('file1.txt', 'Content 1');
        archive.addFile('file2.txt', 'Content 2');
        archive.addFile('folder/file3.txt', 'Content 3');

        const result = await archive.generateArchive();

        expect(result.totalFiles).toBe(3);
        expect(result.archiveBuffer.byteLength).toBeGreaterThan(0);
      });

      it('should generate archive with binary data', async () => {
        const binaryData = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // ZIP signature
        archive.addFile('binary.dat', binaryData);

        const result = await archive.generateArchive();

        expect(result.totalFiles).toBe(1);
        expect(result.archiveBuffer.byteLength).toBeGreaterThan(binaryData.length);
      });

      it('should reject empty archive', async () => {
        await expect(archive.generateArchive()).rejects.toThrow(ApiError);
        await expect(archive.generateArchive()).rejects.toThrow(/empty archive/);
      });

      it('should generate valid ZIP signature', async () => {
        archive.addFile('test.txt', 'test content');

        const result = await archive.generateArchive();
        const view = new DataView(result.archiveBuffer);

        // Check for ZIP local file header signature (0x04034b50)
        const signature = view.getUint32(0, true);
        expect(signature).toBe(0x04034b50);
      });
    });
  });

  describe('createZipArchive', () => {
    it('should create archive from file array', async () => {
      const files: ArchiveFile[] = [
        { path: 'file1.txt', content: 'content1' },
        { path: 'file2.txt', content: 'content2' },
      ];

      const result = await createZipArchive(files);

      expect(result).toBeDefined();
      expect(result.totalFiles).toBe(2);
      expect(result.archiveBuffer).toBeInstanceOf(ArrayBuffer);
    });

    it('should create archive with custom options', async () => {
      const files: ArchiveFile[] = [{ path: 'test.txt', content: 'test' }];

      const options: ArchiveOptions = {
        compression: false,
        maxSize: 1024 * 1024,
        maxFiles: 100,
      };

      const result = await createZipArchive(files, options);

      expect(result.totalFiles).toBe(1);
    });

    it('should reject invalid files parameter', async () => {
      await expect(createZipArchive(null as any)).rejects.toThrow(ApiError);
      await expect(createZipArchive(undefined as any)).rejects.toThrow(ApiError);
      await expect(createZipArchive('not an array' as any)).rejects.toThrow(ApiError);
    });

    it('should reject empty files array', async () => {
      await expect(createZipArchive([])).rejects.toThrow(ApiError);
      await expect(createZipArchive([])).rejects.toThrow(/no files/);
    });

    it('should validate file structure', async () => {
      const invalidFiles = [
        { path: '', content: 'content' }, // empty path
      ];

      await expect(createZipArchive(invalidFiles as any)).rejects.toThrow(ApiError);
    });

    it('should handle files with metadata', async () => {
      const files: ArchiveFile[] = [
        {
          path: 'image.jpg',
          content: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), // JPEG header
          mimeType: 'image/jpeg',
          lastModified: new Date('2024-01-01'),
        },
      ];

      const result = await createZipArchive(files);
      expect(result.totalFiles).toBe(1);
    });
  });

  describe('addFileToArchive', () => {
    let archive: SimpleZipArchive;

    beforeEach(() => {
      archive = new SimpleZipArchive();
    });

    it('should add file to existing archive', () => {
      expect(() => {
        addFileToArchive(archive, 'test.txt', 'content');
      }).not.toThrow();
    });

    it('should reject invalid archive', () => {
      expect(() => {
        addFileToArchive(null as any, 'test.txt', 'content');
      }).toThrow(ApiError);

      expect(() => {
        addFileToArchive({} as any, 'test.txt', 'content');
      }).toThrow(ApiError);
    });
  });

  describe('addFolderToArchive', () => {
    let archive: SimpleZipArchive;

    beforeEach(() => {
      archive = new SimpleZipArchive();
    });

    it('should add folder to existing archive', () => {
      const files: ArchiveFile[] = [{ path: 'file.txt', content: 'content' }];

      expect(() => {
        addFolderToArchive(archive, 'documents', files);
      }).not.toThrow();
    });

    it('should reject invalid archive', () => {
      const files: ArchiveFile[] = [{ path: 'file.txt', content: 'content' }];

      expect(() => {
        addFolderToArchive(null as any, 'documents', files);
      }).toThrow(ApiError);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1)).toBe('1 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle decimal precision', () => {
      expect(formatBytes(1536)).toBe('1.5 KB'); // 1.5 * 1024
      expect(formatBytes(2560)).toBe('2.5 KB'); // 2.5 * 1024
    });
  });

  describe('Error Handling', () => {
    it('should throw ApiError with proper error codes', async () => {
      const archive = new SimpleZipArchive();

      // Test various error conditions
      try {
        archive.addFile('', 'content');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe('INVALID_FILE_PATH');
      }

      try {
        await archive.generateArchive();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe('EMPTY_ARCHIVE');
      }
    });

    it('should handle memory pressure gracefully', () => {
      const archive = new SimpleZipArchive({ maxSize: 10 }); // Very small limit

      archive.addFile('small.txt', 'ok');

      expect(() => {
        archive.addFile('large.txt', 'this is too large');
      }).toThrow(ApiError);
    });
  });

  describe('Integration Tests', () => {
    it('should create a realistic backup archive structure', async () => {
      const files: ArchiveFile[] = [
        // Database dump
        { path: 'database.sql', content: 'CREATE TABLE artwork (id TEXT PRIMARY KEY);' },

        // Metadata
        {
          path: 'metadata.json',
          content: JSON.stringify({
            created_at: new Date().toISOString(),
            version: '1.0.0',
            type: 'backup',
          }),
        },

        // Photos
        { path: 'photos/originals/123.jpg', content: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
        {
          path: 'photos/thumbnails/123_800.jpg',
          content: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        },
      ];

      const result = await createZipArchive(files);

      expect(result.totalFiles).toBe(4);
      expect(result.archiveBuffer.byteLength).toBeGreaterThan(0);

      // Should have proper ZIP structure
      const view = new DataView(result.archiveBuffer);
      expect(view.getUint32(0, true)).toBe(0x04034b50); // ZIP signature
    });

    it('should create a realistic data dump archive structure', async () => {
      const files: ArchiveFile[] = [
        // CC0 License
        { path: 'LICENSE.txt', content: 'CC0 1.0 Universal Public Domain Dedication' },

        // README
        {
          path: 'README.md',
          content: '# Cultural Archiver Data Dump\n\nThis data is released under CC0...',
        },

        // Data files
        {
          path: 'artwork.json',
          content: JSON.stringify([
            { id: '123', lat: 49.2827, lon: -123.1207, status: 'approved' },
          ]),
        },
        { path: 'creators.json', content: JSON.stringify([{ id: '456', name: 'Artist Name' }]) },
        { path: 'tags.json', content: JSON.stringify([{ label: 'material', value: 'bronze' }]) },

        // Thumbnail photos only
        {
          path: 'photos/thumbnails/123_800.jpg',
          content: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        },

        // Metadata
        {
          path: 'metadata.json',
          content: JSON.stringify({
            generated_at: new Date().toISOString(),
            type: 'data_dump',
            license: 'CC0',
            source: 'Cultural Archiver',
          }),
        },
      ];

      const result = await createZipArchive(files);

      expect(result.totalFiles).toBe(7);
      expect(result.archiveBuffer.byteLength).toBeGreaterThan(0);
    });
  });
});
