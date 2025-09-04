/**
 * Unit tests for photo processing utilities
 *
 * Tests the photo processing pipeline including file validation,
 * upload to R2 and Cloudflare Images, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  validatePhotoFile, 
  validatePhotoFiles,
  generateSecureFilename, 
  generateDateFolder,
  generateR2Key,
  generatePhotoUrl,
  deleteFromR2,
  type FileValidationResult
} from './photos';
import type { WorkerEnv } from '../types';

// Mock environment
const mockEnv: WorkerEnv = {
  PHOTOS_BUCKET: {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    head: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ objects: [] })
  } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  CLOUDFLARE_IMAGES_ENABLED: 'false',
  CLOUDFLARE_ACCOUNT_ID: 'test-account',
  R2_PUBLIC_URL: 'https://test.r2.dev',
  PHOTOS_BASE_URL: 'https://test.photos.com',
  DB: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  SESSIONS: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  CACHE: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  RATE_LIMITS: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  MAGIC_LINKS: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ENVIRONMENT: 'test',
  FRONTEND_URL: 'http://localhost:3000',
  LOG_LEVEL: 'debug',
  API_VERSION: '1.0.0',
  RESEND_API_KEY: 'test-resend-key',
  EMAIL_FROM_ADDRESS: 'test@example.com',
  EMAIL_FROM_NAME: 'Test Cultural Archiver',
  EMAIL_REPLY_TO: 'test@example.com',
  EMAIL_ENABLED: 'true'
};

// Mock File class for testing
class MockFile extends File {
  constructor(content: string, name: string, options: { type?: string; lastModified?: number } = {}) {
    const blob = new Blob([content], { type: options.type || 'image/jpeg' });
    super([blob], name, options);
  }
}

describe('Photo Processing Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('File Validation', () => {
    it('should validate JPEG files correctly', () => {
      const file = new MockFile('test content', 'test.jpg', { type: 'image/jpeg' });
      const result: FileValidationResult = validatePhotoFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate PNG files correctly', () => {
      const file = new MockFile('test content', 'test.png', { type: 'image/png' });
      const result: FileValidationResult = validatePhotoFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('image/png');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate WebP files correctly', () => {
      const file = new MockFile('test content', 'test.webp', { type: 'image/webp' });
      const result: FileValidationResult = validatePhotoFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('image/webp');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unsupported file types', () => {
      const file = new MockFile('test content', 'test.gif', { type: 'image/gif' });
      const result: FileValidationResult = validatePhotoFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File type image/gif is not supported. Supported types: image/jpeg, image/jpg, image/png, image/webp, image/heic, image/heif');
    });

    it('should reject files that are too large', () => {
      const largeContent = 'x'.repeat(16 * 1024 * 1024); // 16MB
      const file = new MockFile(largeContent, 'large.jpg', { type: 'image/jpeg' });
      const result: FileValidationResult = validatePhotoFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size 16MB exceeds maximum of 15MB');
    });

    it('should reject empty files', () => {
      const file = new MockFile('', 'empty.jpg', { type: 'image/jpeg' });
      const result: FileValidationResult = validatePhotoFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should validate multiple files correctly', () => {
      const files = [
        new MockFile('content1', 'photo1.jpg', { type: 'image/jpeg' }),
        new MockFile('content2', 'photo2.png', { type: 'image/png' }),
        new MockFile('content3', 'photo3.webp', { type: 'image/webp' })
      ];
      
      const result = validatePhotoFiles(files);
      
      expect(result.validFiles).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject too many files', () => {
      const files = Array.from({ length: 4 }, (_, i) =>
        new MockFile(`content${i}`, `photo${i}.jpg`, { type: 'image/jpeg' })
      );
      
      const result = validatePhotoFiles(files);
      
      expect(result.validFiles).toHaveLength(0);
      expect(result.errors).toContain('Too many files. Maximum 3 photos allowed per submission');
    });
  });

  describe('Filename Generation', () => {
    it('should generate secure filenames with timestamp and UUID', () => {
      const filename1 = generateSecureFilename('test.jpg', 'image/jpeg');
      const filename2 = generateSecureFilename('test.jpg', 'image/jpeg');
      
      expect(filename1).not.toBe(filename2);
      expect(filename1).toMatch(/^\d{8}-\d{6}-[a-f0-9\-]{8,}-test\.jpg$/);
    });

    it('should generate date folder structure', () => {
      const folder = generateDateFolder();
      
      expect(folder).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    });

    it('should generate R2 keys with date folder', () => {
      const filename = 'test-file.jpg';
      const key = generateR2Key(filename);
      
      expect(key).toMatch(/^photos\/\d{4}\/\d{2}\/\d{2}\/test-file\.jpg$/);
    });

    it('should generate R2 keys with custom folder', () => {
      const filename = 'test-file.jpg';
      const folder = 'custom/folder';
      const key = generateR2Key(filename, folder);
      
      expect(key).toMatch(/^custom\/folder\/\d{4}\/\d{2}\/\d{2}\/test-file\.jpg$/);
    });
  });

  describe('Photo URL Generation', () => {
    it('should generate correct photo URLs', () => {
      const key = '2025/08/28/test-image.jpg';
      const url = generatePhotoUrl(mockEnv, key);
      
      expect(url).toBe('https://test.photos.com/2025/08/28/test-image.jpg');
    });

    it('should handle URL generation with custom base URL', () => {
      const customEnv = { ...mockEnv, PHOTOS_BASE_URL: 'https://custom.photos.com' };
      const key = '2025/08/28/test-image.jpg';
      const url = generatePhotoUrl(customEnv, key);
      
      expect(url).toBe('https://custom.photos.com/2025/08/28/test-image.jpg');
    });
  });

  describe('Photo Deletion', () => {
    it('should delete photos from R2 successfully', async () => {
      const key = '2025/08/28/test-image.jpg';
      
      await deleteFromR2(mockEnv, key);
      
      expect(mockEnv.PHOTOS_BUCKET.delete).toHaveBeenCalledWith(key);
    });

    it('should handle R2 deletion errors gracefully', async () => {
      vi.mocked(mockEnv.PHOTOS_BUCKET.delete).mockRejectedValueOnce(new Error('Delete failed'));
      
      const key = '2025/08/28/test-image.jpg';
      
      // Should not throw, just log the error
      await expect(deleteFromR2(mockEnv, key)).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid file types consistently', () => {
      const file = new MockFile('test content', 'test.bmp', { type: 'image/bmp' });
      const result = validatePhotoFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File type image/bmp is not supported. Supported types: image/jpeg, image/jpg, image/png, image/webp, image/heic, image/heif');
    });

    it('should handle missing file names', () => {
      const file = new MockFile('test content', '', { type: 'image/jpeg' });
      const result = validatePhotoFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File name is required');
    });
  });

  describe('Performance', () => {
    it('should validate files efficiently', () => {
      const files = Array.from({ length: 3 }, (_, i) =>
        new MockFile(`content${i}`, `photo${i}.jpg`, { type: 'image/jpeg' })
      );
      
      const startTime = Date.now();
      const result = validatePhotoFiles(files);
      const endTime = Date.now();
      
      expect(result.validFiles).toHaveLength(3);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it('should generate unique filenames quickly', () => {
      const startTime = Date.now();
      const filenames = Array.from({ length: 100 }, () =>
        generateSecureFilename('test.jpg', 'image/jpeg')
      );
      const endTime = Date.now();
      
      const uniqueFilenames = new Set(filenames);
      expect(uniqueFilenames.size).toBe(100); // All should be unique
      expect(endTime - startTime).toBeLessThan(500); // Should be fast
    });
  });
});