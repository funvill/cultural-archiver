import { describe, it, expect } from 'vitest';
import {
  generateVariantKey,
  parseVariantKey,
  validateImageData,
  getContentType,
  getCacheHeaders,
  VARIANT_SUFFIX_PATTERN,
} from '../lib/image-processing';
import type { PhotoVariant } from '../../shared/types';

describe('Image Processing', () => {
  describe('generateVariantKey', () => {
    it('should generate correct variant key for JPEG', () => {
      const result = generateVariantKey('photos/abc123.jpg', 'thumbnail');
      expect(result).toBe('photos/abc123__400x400.jpg');
    });

    it('should generate correct variant key for PNG', () => {
      const result = generateVariantKey('photos/xyz789.png', 'medium');
      expect(result).toBe('photos/xyz789__800x800.png');
    });

    it('should generate correct variant key for large variant', () => {
      const result = generateVariantKey('photos/test.jpg', 'large');
      expect(result).toBe('photos/test__1200x1200.jpg');
    });

    it('should handle paths without extension', () => {
      const result = generateVariantKey('photos/noext', 'thumbnail');
      expect(result).toBe('photos/noext__400x400');
    });

    it('should handle nested paths', () => {
      const result = generateVariantKey('photos/2024/03/image.jpg', 'medium');
      expect(result).toBe('photos/2024/03/image__800x800.jpg');
    });

    it('should return original key for "original" variant', () => {
      const result = generateVariantKey('photos/original.jpg', 'original');
      expect(result).toBe('photos/original.jpg');
    });
  });

  describe('parseVariantKey', () => {
    it('should parse variant key correctly', () => {
      const result = parseVariantKey('photos/abc123__400x400.jpg');
      expect(result.originalKey).toBe('photos/abc123.jpg');
      expect(result.width).toBe(400);
      expect(result.height).toBe(400);
    });

    it('should parse medium variant', () => {
      const result = parseVariantKey('photos/xyz__800x800.png');
      expect(result.originalKey).toBe('photos/xyz.png');
      expect(result.width).toBe(800);
      expect(result.height).toBe(800);
    });

    it('should parse large variant', () => {
      const result = parseVariantKey('photos/test__1200x1200.jpg');
      expect(result.originalKey).toBe('photos/test.jpg');
      expect(result.width).toBe(1200);
      expect(result.height).toBe(1200);
    });

    it('should return null for non-variant keys', () => {
      const result = parseVariantKey('photos/normal.jpg');
      expect(result).toBeNull();
    });

    it('should return null for malformed variant keys', () => {
      expect(parseVariantKey('photos/test__abc.jpg')).toBeNull();
      expect(parseVariantKey('photos/test__400x.jpg')).toBeNull();
      expect(parseVariantKey('photos/test__x400.jpg')).toBeNull();
    });

    it('should handle nested paths in variant keys', () => {
      const result = parseVariantKey('photos/2024/03/image__800x800.jpg');
      expect(result?.originalKey).toBe('photos/2024/03/image.jpg');
      expect(result?.width).toBe(800);
      expect(result?.height).toBe(800);
    });
  });

  describe('VARIANT_SUFFIX_PATTERN', () => {
    it('should match valid variant suffixes', () => {
      expect('test__400x400.jpg'.match(VARIANT_SUFFIX_PATTERN)).toBeTruthy();
      expect('test__800x800.png'.match(VARIANT_SUFFIX_PATTERN)).toBeTruthy();
      expect('test__1200x1200.webp'.match(VARIANT_SUFFIX_PATTERN)).toBeTruthy();
    });

    it('should not match invalid suffixes', () => {
      expect('test.jpg'.match(VARIANT_SUFFIX_PATTERN)).toBeNull();
      expect('test__abc.jpg'.match(VARIANT_SUFFIX_PATTERN)).toBeNull();
      expect('test__400.jpg'.match(VARIANT_SUFFIX_PATTERN)).toBeNull();
    });
  });

  describe('validateImageData', () => {
    it('should validate JPEG magic bytes (FF D8 FF)', () => {
      const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      expect(validateImageData(jpegData)).toBe(true);
    });

    it('should validate PNG magic bytes (89 50 4E 47)', () => {
      const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      expect(validateImageData(pngData)).toBe(true);
    });

    it('should validate WebP magic bytes (RIFF...WEBP)', () => {
      const webpData = new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46,
        0x00,
        0x00,
        0x00,
        0x00,
        0x57,
        0x45,
        0x42,
        0x50,
      ]);
      expect(validateImageData(webpData)).toBe(true);
    });

    it('should reject invalid image data', () => {
      const invalidData = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      expect(validateImageData(invalidData)).toBe(false);
    });

    it('should reject empty data', () => {
      const emptyData = new Uint8Array([]);
      expect(validateImageData(emptyData)).toBe(false);
    });

    it('should reject data shorter than 4 bytes', () => {
      const shortData = new Uint8Array([0xff, 0xd8]);
      expect(validateImageData(shortData)).toBe(false);
    });
  });

  describe('getContentType', () => {
    it('should return correct MIME type for JPEG', () => {
      expect(getContentType('test.jpg')).toBe('image/jpeg');
      expect(getContentType('test.jpeg')).toBe('image/jpeg');
      expect(getContentType('TEST.JPG')).toBe('image/jpeg');
    });

    it('should return correct MIME type for PNG', () => {
      expect(getContentType('test.png')).toBe('image/png');
      expect(getContentType('TEST.PNG')).toBe('image/png');
    });

    it('should return correct MIME type for WebP', () => {
      expect(getContentType('test.webp')).toBe('image/webp');
      expect(getContentType('TEST.WEBP')).toBe('image/webp');
    });

    it('should return correct MIME type for HEIC', () => {
      expect(getContentType('test.heic')).toBe('image/heic');
      expect(getContentType('TEST.HEIC')).toBe('image/heic');
    });

    it('should return application/octet-stream for unknown extensions', () => {
      expect(getContentType('test.txt')).toBe('application/octet-stream');
      expect(getContentType('test')).toBe('application/octet-stream');
    });

    it('should handle paths without extensions', () => {
      expect(getContentType('noextension')).toBe('application/octet-stream');
    });
  });

  describe('getCacheHeaders', () => {
    it('should return correct cache headers for thumbnail variant', () => {
      const headers = getCacheHeaders('thumbnail');
      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
      expect(headers['CDN-Cache-Control']).toBe('public, max-age=31536000');
    });

    it('should return correct cache headers for medium variant', () => {
      const headers = getCacheHeaders('medium');
      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
      expect(headers['CDN-Cache-Control']).toBe('public, max-age=31536000');
    });

    it('should return correct cache headers for large variant', () => {
      const headers = getCacheHeaders('large');
      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
      expect(headers['CDN-Cache-Control']).toBe('public, max-age=31536000');
    });

    it('should return shorter cache for original', () => {
      const headers = getCacheHeaders('original');
      expect(headers['Cache-Control']).toBe('public, max-age=86400');
      expect(headers['CDN-Cache-Control']).toBe('public, max-age=86400');
    });

    it('should include correct Vary header', () => {
      const headers = getCacheHeaders('thumbnail');
      expect(headers['Vary']).toBe('Accept');
    });
  });
});
