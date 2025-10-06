import { describe, it, expect } from 'vitest';
import {
  generateVariantKey,
  parseVariantKey,
  validateImageData,
  getContentType,
  getCacheHeaders,
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
      expect(result).toBe('photos/xyz789__1024x1024.png');
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
      expect(result).toBe('photos/2024/03/image__1024x1024.jpg');
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
      expect(result.variant).toBe('thumbnail');
    });

    it('should parse medium variant', () => {
      const result = parseVariantKey('photos/xyz__1024x1024.png');
      expect(result.originalKey).toBe('photos/xyz.png');
      expect(result.variant).toBe('medium');
    });

    it('should parse large variant', () => {
      const result = parseVariantKey('photos/test__1200x1200.jpg');
      expect(result.originalKey).toBe('photos/test.jpg');
      expect(result.variant).toBe('large');
    });

    it('should return original for non-variant keys', () => {
      const result = parseVariantKey('photos/normal.jpg');
      expect(result.originalKey).toBe('photos/normal.jpg');
      expect(result.variant).toBe('original');
    });

    it('should handle malformed variant keys as original', () => {
      const result1 = parseVariantKey('photos/test__abc.jpg');
      expect(result1.variant).toBe('original');
      
      const result2 = parseVariantKey('photos/test__400x.jpg');
      expect(result2.variant).toBe('original');
      
      const result3 = parseVariantKey('photos/test__x400.jpg');
      expect(result3.variant).toBe('original');
    });

    it('should handle nested paths in variant keys', () => {
      const result = parseVariantKey('photos/2024/03/image__1024x1024.jpg');
      expect(result.originalKey).toBe('photos/2024/03/image.jpg');
      expect(result.variant).toBe('medium');
    });
  });

  describe('validateImageData', () => {
    it('should validate JPEG magic bytes (FF D8 FF)', () => {
      const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
      expect(validateImageData(jpegData, 'image/jpeg')).toBe(true);
    });

    it('should validate PNG magic bytes (89 50 4E 47)', () => {
      const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
      expect(validateImageData(pngData, 'image/png')).toBe(true);
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
      ]).buffer;
      expect(validateImageData(webpData, 'image/webp')).toBe(true);
    });

    it('should reject invalid image data', () => {
      const invalidData = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
      expect(() => validateImageData(invalidData, 'image/jpeg')).toThrow('INVALID_IMAGE_DATA');
    });

    it('should reject empty data', () => {
      const emptyData = new Uint8Array([]).buffer;
      expect(() => validateImageData(emptyData, 'image/jpeg')).toThrow();
    });

    it('should reject unsupported content types', () => {
      const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
      expect(() => validateImageData(jpegData, 'image/bmp')).toThrow('UNSUPPORTED_IMAGE_TYPE');
    });
  });

  describe('getContentType', () => {
    it('should detect JPEG from magic bytes', () => {
      const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
      expect(getContentType(jpegData)).toBe('image/jpeg');
    });

    it('should detect PNG from magic bytes', () => {
      const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
      expect(getContentType(pngData)).toBe('image/png');
    });

    it('should detect WebP from magic bytes', () => {
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
      ]).buffer;
      expect(getContentType(webpData)).toBe('image/webp');
    });

    it('should default to JPEG for unknown data', () => {
      const unknownData = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
      expect(getContentType(unknownData)).toBe('image/jpeg');
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
