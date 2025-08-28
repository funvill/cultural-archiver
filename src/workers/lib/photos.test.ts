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
  } as any,
  CLOUDFLARE_IMAGES_ENABLED: 'false',
  CLOUDFLARE_ACCOUNT_ID: 'test-account',
  R2_PUBLIC_URL: 'https://test.r2.dev',
  PHOTOS_BASE_URL: 'https://test.photos.com',
  DB: {} as any,
  SESSIONS: {} as any,
  CACHE: {} as any,
  RATE_LIMITS: {} as any,
  MAGIC_LINKS: {} as any,
  ENVIRONMENT: 'test',
  FRONTEND_URL: 'http://localhost:3000',
  LOG_LEVEL: 'debug',
  API_VERSION: '1.0.0',
  EMAIL_API_KEY: '',
  EMAIL_FROM: 'test@example.com'
};

// Mock File class for testing
class MockFile extends File {
  constructor(content: string, name: string, options: FilePropertyBag = {}) {
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
      expect(result.errors).toContain('Unsupported file type: image/gif');
    });

    it('should reject files that are too large', () => {
      const largeContent = 'x'.repeat(16 * 1024 * 1024); // 16MB
      const file = new MockFile(largeContent, 'large.jpg', { type: 'image/jpeg' });
      const result: FileValidationResult = validatePhotoFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File too large: 16777216 bytes (max: 15728640 bytes)');
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
      expect(result.errors).toContain('Too many photos: 4 (max: 3)');
    });
  });

  describe('Filename Generation', () => {
    it('should generate secure filenames with timestamp and UUID', () => {
      const filename1 = generateSecureFilename('test.jpg', 'image/jpeg');
      const filename2 = generateSecureFilename('test.jpg', 'image/jpeg');
      
      expect(filename1).not.toBe(filename2);
      expect(filename1).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-[a-f0-9\-]{36}\.jpg$/);
    });

    it('should generate date folder structure', () => {
      const folder = generateDateFolder();
      
      expect(folder).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    });

    it('should generate R2 keys with date folder', () => {
      const filename = 'test-file.jpg';
      const key = generateR2Key(filename);
      
      expect(key).toMatch(/^\d{4}\/\d{2}\/\d{2}\/test-file\.jpg$/);
    });

    it('should generate R2 keys with custom folder', () => {
      const filename = 'test-file.jpg';
      const folder = 'custom/folder';
      const key = generateR2Key(filename, folder);
      
      expect(key).toBe('custom/folder/test-file.jpg');
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
      
      await expect(deleteFromR2(mockEnv, key)).rejects.toThrow('Failed to delete photo from R2: Delete failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid file types consistently', () => {
      const file = new MockFile('test content', 'test.bmp', { type: 'image/bmp' });
      const result = validatePhotoFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported file type: image/bmp');
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