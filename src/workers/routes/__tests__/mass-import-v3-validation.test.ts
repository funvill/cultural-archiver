/**
 * Tests for Mass Import v3 Validation Layer - Phase 2
 * 
 * Tests Zod schemas, coordinate validation, and sanitization.
 */

import { describe, it, expect } from 'vitest';
import {
  ArtworkFeatureSchema,
  ArtistSchema,
  CoordinatesSchema,
  UrlSchema,
} from '../mass-import-v3/validation';
import {
  sanitizeMarkdown,
  validateCoordinates,
  parseArtistField,
  isValidUrl,
  generateUUID,
} from '../mass-import-v3/utils';

describe('Mass Import v3 - Phase 2: Validation', () => {
  describe('Coordinate Validation', () => {
    it('should accept valid coordinates', () => {
      expect(() => CoordinatesSchema.parse([-123.003613, 49.225237])).not.toThrow();
      expect(() => CoordinatesSchema.parse([-180, -90])).not.toThrow();
      expect(() => CoordinatesSchema.parse([180, 90])).not.toThrow();
    });

    it('should reject latitude out of range', () => {
      expect(() => CoordinatesSchema.parse([-123.0, 91])).toThrow();
      expect(() => CoordinatesSchema.parse([-123.0, -91])).toThrow();
    });

    it('should reject longitude out of range', () => {
      expect(() => CoordinatesSchema.parse([181, 49.0])).toThrow();
      expect(() => CoordinatesSchema.parse([-181, 49.0])).toThrow();
    });

    it('should reject (0, 0) coordinates', () => {
      expect(() => CoordinatesSchema.parse([0, 0])).toThrow(/not allowed/);
    });

    it('validateCoordinates helper should return error for invalid coords', () => {
      expect(validateCoordinates(-123.0, 91)).toContain('out of range');
      expect(validateCoordinates(181, 49.0)).toContain('out of range');
      expect(validateCoordinates(0, 0)).toContain('likely an error');
      expect(validateCoordinates(-123.0, 49.0)).toBeNull();
    });
  });

  describe('URL Validation', () => {
    it('should accept valid HTTP and HTTPS URLs', () => {
      expect(() => UrlSchema.parse('http://example.com')).not.toThrow();
      expect(() => UrlSchema.parse('https://example.com')).not.toThrow();
      expect(() => UrlSchema.parse('https://example.com/path?query=value')).not.toThrow();
    });

    it('should reject invalid URLs', () => {
      expect(() => UrlSchema.parse('not-a-url')).toThrow();
      expect(() => UrlSchema.parse('ftp://example.com')).toThrow();
      expect(() => UrlSchema.parse('')).toThrow();
    });

    it('isValidUrl helper should validate URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('Artwork Feature Schema', () => {
    const validArtwork = {
      type: 'Feature' as const,
      id: 'node/publicart117',
      geometry: {
        type: 'Point' as const,
        coordinates: [-123.003613, 49.225237] as [number, number],
      },
      properties: {
        source: 'https://burnabyartgallery.ca',
        source_url: 'https://collections.burnabyartgallery.ca/link/publicart117',
        title: 'blacktail',
        description: 'A beautiful sculpture',
        artwork_type: 'sculpture',
        material: 'aluminum',
        start_date: '2015',
        artist: 'Muse Atelier',
      },
    };

    it('should accept valid artwork GeoJSON', () => {
      expect(() => ArtworkFeatureSchema.parse(validArtwork)).not.toThrow();
    });

    it('should reject missing required fields', () => {
      const missingTitle = { ...validArtwork };
      delete (missingTitle.properties as any).title;
      expect(() => ArtworkFeatureSchema.parse(missingTitle)).toThrow(/title/i);

      const missingSource = { ...validArtwork };
      delete (missingSource.properties as any).source;
      expect(() => ArtworkFeatureSchema.parse(missingSource)).toThrow(/source/i);

      const missingSourceUrl = { ...validArtwork };
      delete (missingSourceUrl.properties as any).source_url;
      expect(() => ArtworkFeatureSchema.parse(missingSourceUrl)).toThrow(/source_url/i);
    });

    it('should reject invalid type', () => {
      const invalidType = { ...validArtwork, type: 'Artist' };
      expect(() => ArtworkFeatureSchema.parse(invalidType)).toThrow();
    });

    it('should reject invalid geometry type', () => {
      const invalidGeometry = {
        ...validArtwork,
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
      };
      expect(() => ArtworkFeatureSchema.parse(invalidGeometry)).toThrow();
    });

    it('should reject invalid coordinates', () => {
      const invalidCoords = {
        ...validArtwork,
        geometry: { type: 'Point', coordinates: [0, 0] },
      };
      expect(() => ArtworkFeatureSchema.parse(invalidCoords)).toThrow(/not allowed/);
    });

    it('should accept optional fields', () => {
      const minimalArtwork = {
        type: 'Feature' as const,
        id: 'test-123',
        geometry: {
          type: 'Point' as const,
          coordinates: [-123.0, 49.0] as [number, number],
        },
        properties: {
          source: 'test',
          source_url: 'http://test.com',
          title: 'Test Artwork',
        },
      };
      expect(() => ArtworkFeatureSchema.parse(minimalArtwork)).not.toThrow();
    });

    it('should allow additional properties', () => {
      const withExtra = {
        type: 'Feature' as const,
        id: 'node/publicart117',
        geometry: {
          type: 'Point' as const,
          coordinates: [-123.003613, 49.225237] as [number, number],
        },
        properties: {
          source: 'https://burnabyartgallery.ca',
          source_url: 'https://collections.burnabyartgallery.ca/link/publicart117',
          title: 'blacktail',
          description: 'A beautiful sculpture',
          artwork_type: 'sculpture',
          material: 'aluminum',
          start_date: '2015',
          artist: 'Muse Atelier',
          custom_field: 'custom value',
          another_field: 123,
        },
      };
      expect(() => ArtworkFeatureSchema.parse(withExtra)).not.toThrow();
    });
  });

  describe('Artist Schema', () => {
    const validArtist = {
      type: 'Artist' as const,
      id: 'artist-muse-atelier',
      name: 'Muse Atelier',
      description: 'Artist biography',
      properties: {
        source: 'https://burnabyartgallery.ca',
        source_url: 'https://collections.burnabyartgallery.ca/link/artists1307',
        birth_date: '1928',
        death_date: '2016',
        website: 'http://www.example.com',
      },
    };

    it('should accept valid artist data', () => {
      expect(() => ArtistSchema.parse(validArtist)).not.toThrow();
    });

    it('should reject missing required fields', () => {
      const missingName = { ...validArtist };
      delete (missingName as any).name;
      expect(() => ArtistSchema.parse(missingName)).toThrow(/name/i);

      const missingSource = { ...validArtist };
      delete (missingSource.properties as any).source;
      expect(() => ArtistSchema.parse(missingSource)).toThrow(/source/i);
    });

    it('should reject invalid type', () => {
      const invalidType = { ...validArtist, type: 'Feature' };
      expect(() => ArtistSchema.parse(invalidType)).toThrow();
    });

    it('should accept optional fields', () => {
      const minimalArtist = {
        type: 'Artist' as const,
        id: 'artist-123',
        name: 'Test Artist',
        properties: {
          source: 'test',
          source_url: 'http://test.com',
        },
      };
      expect(() => ArtistSchema.parse(minimalArtist)).not.toThrow();
    });

    it('should validate website URL if provided', () => {
      const invalidWebsite = {
        ...validArtist,
        properties: {
          ...validArtist.properties,
          website: 'not-a-url',
        },
      };
      expect(() => ArtistSchema.parse(invalidWebsite)).toThrow();
    });
  });

  describe('Markdown Sanitization', () => {
    it('should remove <script> tags', () => {
      const dirty = 'Some text <script>alert("XSS")</script> more text';
      const clean = sanitizeMarkdown(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('Some text');
      expect(clean).toContain('more text');
    });

    it('should remove <iframe> tags', () => {
      const dirty = 'Text <iframe src="evil.com"></iframe> more';
      const clean = sanitizeMarkdown(dirty);
      expect(clean).not.toContain('<iframe>');
      expect(clean).toContain('Text');
      expect(clean).toContain('more');
    });

    it('should remove inline event handlers', () => {
      const dirty = '<div onclick="alert(1)">Click me</div>';
      const clean = sanitizeMarkdown(dirty);
      expect(clean).not.toContain('onclick');
    });

    it('should preserve safe Markdown', () => {
      const safe = '# Heading\n\nSome **bold** and *italic* text.\n\n- List item';
      const clean = sanitizeMarkdown(safe);
      expect(clean).toBe(safe);
    });

    it('should handle empty strings', () => {
      expect(sanitizeMarkdown('')).toBe('');
    });
  });

  describe('Artist Field Parsing', () => {
    it('should parse single artist', () => {
      const artists = parseArtistField('John Doe');
      expect(artists).toEqual(['John Doe']);
    });

    it('should parse comma-separated artists', () => {
      const artists = parseArtistField('John Doe, Jane Smith, Bob Johnson');
      expect(artists).toEqual(['John Doe', 'Jane Smith', 'Bob Johnson']);
    });

    it('should trim whitespace', () => {
      const artists = parseArtistField('  John Doe  ,  Jane Smith  ');
      expect(artists).toEqual(['John Doe', 'Jane Smith']);
    });

    it('should handle empty string', () => {
      const artists = parseArtistField('');
      expect(artists).toEqual([]);
    });

    it('should handle undefined', () => {
      const artists = parseArtistField(undefined);
      expect(artists).toEqual([]);
    });

    it('should filter out empty names', () => {
      const artists = parseArtistField('John Doe,,Jane Smith,  ,Bob');
      expect(artists).toEqual(['John Doe', 'Jane Smith', 'Bob']);
    });
  });

  describe('UUID Generation', () => {
    it('should generate valid UUID format', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });
});
