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
    describe('path mapping', () => {
      it('should map originals/ to artworks/ for variants', () => {
        const result = generateVariantKey('originals/2025/10/04/image.jpg', 'medium');
        expect(result).toBe('artworks/2025/10/04/image__1024x1024.jpg');
      });

      it('should map originals/ to artworks/ for thumbnail', () => {
        const result = generateVariantKey('originals/2025/10/04/image.jpg', 'thumbnail');
        expect(result).toBe('artworks/2025/10/04/image__400x400.jpg');
      });

      it('should map originals/ to artworks/ for large', () => {
        const result = generateVariantKey('originals/2025/10/04/image.jpg', 'large');
        expect(result).toBe('artworks/2025/10/04/image__1200x1200.jpg');
      });

      it('should preserve submissions/ path', () => {
        const result = generateVariantKey('submissions/2025/10/04/image.jpg', 'thumbnail');
        expect(result).toBe('submissions/2025/10/04/image__400x400.jpg');
      });

      it('should preserve artworks/ path (already correct)', () => {
        const result = generateVariantKey('artworks/2025/10/04/image.jpg', 'medium');
        expect(result).toBe('artworks/2025/10/04/image__1024x1024.jpg');
      });

      it('should map legacy photos/ to artworks/', () => {
        const result = generateVariantKey('photos/2025/10/04/image.jpg', 'medium');
        expect(result).toBe('artworks/2025/10/04/image__1024x1024.jpg');
      });

      it('should handle unknown prefix by keeping as-is', () => {
        const result = generateVariantKey('unknown/path/image.jpg', 'thumbnail');
        expect(result).toBe('unknown/path/image__400x400.jpg');
      });
    });

    describe('file format handling', () => {
      it('should generate correct variant key for JPEG', () => {
        const result = generateVariantKey('originals/abc123.jpg', 'thumbnail');
        expect(result).toBe('artworks/abc123__400x400.jpg');
      });

      it('should generate correct variant key for PNG', () => {
        const result = generateVariantKey('originals/xyz789.png', 'medium');
        expect(result).toBe('artworks/xyz789__1024x1024.png');
      });

      it('should handle paths without extension', () => {
        const result = generateVariantKey('originals/noext', 'thumbnail');
        expect(result).toBe('artworks/noext__400x400');
      });

      it('should handle multiple dots in filename', () => {
        const result = generateVariantKey('originals/image.backup.jpg', 'medium');
        expect(result).toBe('artworks/image.backup__1024x1024.jpg');
      });
    });

    describe('original variant', () => {
      it('should return original key unchanged for "original" variant', () => {
        const result = generateVariantKey('originals/2025/10/04/image.jpg', 'original');
        expect(result).toBe('originals/2025/10/04/image.jpg');
      });

      it('should not map paths for original variant', () => {
        const result = generateVariantKey('photos/legacy.jpg', 'original');
        expect(result).toBe('photos/legacy.jpg');
      });
    });

    describe('edge cases', () => {
      it('should handle deeply nested paths', () => {
        const result = generateVariantKey('originals/2025/10/04/subfolder/deep/image.jpg', 'medium');
        expect(result).toBe('artworks/2025/10/04/subfolder/deep/image__1024x1024.jpg');
      });

      it('should handle filename-only paths', () => {
        const result = generateVariantKey('image.jpg', 'thumbnail');
        expect(result).toBe('image__400x400.jpg');
      });

      it('should handle UUID-like filenames', () => {
        const result = generateVariantKey(
          'originals/2025/10/04/20251004-100533-9623e4a5-mass-import-v2-17595.jpg',
          'medium'
        );
        expect(result).toBe('artworks/2025/10/04/20251004-100533-9623e4a5-mass-import-v2-17595__1024x1024.jpg');
      });
    });
  });

  describe('parseVariantKey', () => {
    describe('reverse path mapping', () => {
      it('should map artworks/ variant back to originals/', () => {
        const result = parseVariantKey('artworks/2025/10/04/image__1024x1024.jpg');
        expect(result.originalKey).toBe('originals/2025/10/04/image.jpg');
        expect(result.variant).toBe('medium');
      });

      it('should map artworks/ thumbnail back to originals/', () => {
        const result = parseVariantKey('artworks/2025/10/04/image__400x400.jpg');
        expect(result.originalKey).toBe('originals/2025/10/04/image.jpg');
        expect(result.variant).toBe('thumbnail');
      });

      it('should map artworks/ large back to originals/', () => {
        const result = parseVariantKey('artworks/2025/10/04/image__1200x1200.jpg');
        expect(result.originalKey).toBe('originals/2025/10/04/image.jpg');
        expect(result.variant).toBe('large');
      });

      it('should preserve submissions/ path', () => {
        const result = parseVariantKey('submissions/2025/10/04/image__400x400.jpg');
        expect(result.originalKey).toBe('submissions/2025/10/04/image.jpg');
        expect(result.variant).toBe('thumbnail');
      });

      it('should map legacy photos/ back to originals/', () => {
        const result = parseVariantKey('photos/2025/10/04/image__1024x1024.jpg');
        expect(result.originalKey).toBe('originals/2025/10/04/image.jpg');
        expect(result.variant).toBe('medium');
      });
    });

    describe('round-trip consistency', () => {
      it('should maintain consistency: generate → parse → generate', () => {
        const original = 'originals/2025/10/04/image.jpg';
        const variant: PhotoVariant = 'medium';
        
        const variantKey = generateVariantKey(original, variant);
        expect(variantKey).toBe('artworks/2025/10/04/image__1024x1024.jpg');
        
        const parsed = parseVariantKey(variantKey);
        expect(parsed.originalKey).toBe(original);
        expect(parsed.variant).toBe(variant);
        
        const regenerated = generateVariantKey(parsed.originalKey, parsed.variant);
        expect(regenerated).toBe(variantKey);
      });

      it('should handle submissions round-trip', () => {
        const original = 'submissions/2025/10/04/image.jpg';
        const variant: PhotoVariant = 'thumbnail';
        
        const variantKey = generateVariantKey(original, variant);
        expect(variantKey).toBe('submissions/2025/10/04/image__400x400.jpg');
        
        const parsed = parseVariantKey(variantKey);
        expect(parsed.originalKey).toBe(original);
        expect(parsed.variant).toBe(variant);
      });
    });

    describe('non-variant keys', () => {
      it('should return original for non-variant keys', () => {
        const result = parseVariantKey('originals/normal.jpg');
        expect(result.originalKey).toBe('originals/normal.jpg');
        expect(result.variant).toBe('original');
      });

      it('should handle paths without variant marker', () => {
        const result = parseVariantKey('artworks/2025/10/04/image.jpg');
        expect(result.originalKey).toBe('artworks/2025/10/04/image.jpg');
        expect(result.variant).toBe('original');
      });
    });

    describe('malformed keys', () => {
      it('should handle malformed variant keys as original', () => {
        const result1 = parseVariantKey('artworks/test__abc.jpg');
        expect(result1.variant).toBe('original');
        
        const result2 = parseVariantKey('artworks/test__400x.jpg');
        expect(result2.variant).toBe('original');
        
        const result3 = parseVariantKey('artworks/test__x400.jpg');
        expect(result3.variant).toBe('original');
      });

      it('should handle unknown dimensions as original', () => {
        const result = parseVariantKey('artworks/test__999x999.jpg');
        expect(result.variant).toBe('original');
        expect(result.originalKey).toBe('originals/test.jpg'); // Still maps path
      });
    });

    describe('file formats', () => {
      it('should parse PNG variants', () => {
        const result = parseVariantKey('artworks/xyz__1024x1024.png');
        expect(result.originalKey).toBe('originals/xyz.png');
        expect(result.variant).toBe('medium');
      });

      it('should handle files without extension', () => {
        const result = parseVariantKey('artworks/noext__400x400');
        expect(result.originalKey).toBe('originals/noext');
        expect(result.variant).toBe('thumbnail');
      });

      it('should handle nested paths in variant keys', () => {
        const result = parseVariantKey('artworks/2024/03/deep/path/image__1024x1024.jpg');
        expect(result.originalKey).toBe('originals/2024/03/deep/path/image.jpg');
        expect(result.variant).toBe('medium');
      });
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
