/**
 * Server-side Tag Validation Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ServerTagValidationService } from '../lib/tag-validation';
import type { StructuredTags } from '../../shared/tag-schema';

describe('ServerTagValidationService', () => {
  let service: ServerTagValidationService;

  beforeEach(() => {
    service = new ServerTagValidationService();
  });

  describe('Tag Validation', () => {
    it('should validate valid structured tags', () => {
      const validTags: StructuredTags = {
        artwork_type: 'statue',
        material: 'bronze',
        height: 5.5,
        access: 'yes',
        fee: 'no',
        condition: 'excellent',
      };

      const result = service.validateTags(validTags);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized_tags).toBeDefined();
    });

    it('should reject invalid tags but accept unknown tags', () => {
      const invalidTags: StructuredTags = {
        artwork_type: 'not_an_enum_value',
        height: 'not_a_number',
        website: 'not-a-url',
        unknown_tag: 'some_value', // This should be accepted as valid text
      };

      const result = service.validateTags(invalidTags);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3); // Only 3 errors now (artwork_type, height, website)
      expect(result.errors.some(e => e.key === 'artwork_type')).toBe(true);
      expect(result.errors.some(e => e.key === 'height')).toBe(true);
      expect(result.errors.some(e => e.key === 'website')).toBe(true);
      expect(result.errors.some(e => e.key === 'unknown_tag')).toBe(false); // Should NOT have error
    });

    it('should accept unknown tags as valid text', () => {
      const tagsWithUnknown: StructuredTags = {
        artwork_type: 'statue', // Valid known tag
        material: 'bronze', // Valid known tag
        operator: 'City of Vancouver', // Unknown tag - should be accepted
        source: 'vancouver-opendata', // Unknown tag - should be accepted
        license: 'Open Government Licence', // Unknown tag - should be accepted
      };

      const result = service.validateTags(tagsWithUnknown);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.sanitized_tags?.operator).toBe('City of Vancouver');
      expect(result.sanitized_tags?.source).toBe('vancouver-opendata');
      expect(result.sanitized_tags?.license).toBe('Open Government Licence');
    });

    it('should provide helpful suggestions for errors', () => {
      const invalidTags: StructuredTags = {
        artwork_type: 'invalid_type',
        height: -5,
      };

      const result = service.validateTags(invalidTags);

      expect(result.valid).toBe(false);

      const artworkTypeError = result.errors.find(e => e.key === 'artwork_type');
      expect(artworkTypeError?.suggestions).toBeDefined();
      expect(artworkTypeError?.suggestions?.some(s => s.includes('Valid values:'))).toBe(true);

      const heightError = result.errors.find(e => e.key === 'height');
      expect(heightError?.suggestions).toBeDefined();
    });

    it('should handle empty tags gracefully', () => {
      const result = service.validateTags({});

      expect(result.valid).toBe(true); // no tags are required anymore
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Single Tag Validation', () => {
    it('should validate single valid tags', () => {
      const result = service.validateSingleTag('artwork_type', 'statue');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unknown tag keys', () => {
      const result = service.validateSingleTag('unknown_key', 'some_value');

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Unknown tag key');
    });

    it('should validate enum values strictly', () => {
      // Valid enum
      expect(service.validateSingleTag('access', 'yes').isValid).toBe(true);

      // Invalid enum
      expect(service.validateSingleTag('access', 'maybe').isValid).toBe(false);
    });

    it('should validate numbers with range checking', () => {
      // Valid number
      expect(service.validateSingleTag('height', 5.5).isValid).toBe(true);

      // Invalid: negative
      expect(service.validateSingleTag('height', -1).isValid).toBe(false);

      // Invalid: too large
      expect(service.validateSingleTag('height', 300).isValid).toBe(false);
    });

    it('should validate dates in multiple formats', () => {
      expect(service.validateSingleTag('start_date', '2023').isValid).toBe(true);
      expect(service.validateSingleTag('start_date', '2023-07').isValid).toBe(true);
      expect(service.validateSingleTag('start_date', '2023-07-15').isValid).toBe(true);

      // Invalid formats
      expect(service.validateSingleTag('start_date', '23').isValid).toBe(false);
      expect(service.validateSingleTag('start_date', '2023-13').isValid).toBe(false);
    });

    it('should validate URLs', () => {
      expect(service.validateSingleTag('website', 'https://example.com').isValid).toBe(true);
      expect(service.validateSingleTag('website', 'http://example.org').isValid).toBe(true);

      // Should warn about HTTP
      const httpResult = service.validateSingleTag('website', 'http://example.com');
      expect(httpResult.isValid).toBe(true);
      expect(httpResult.warnings.length).toBeGreaterThan(0);

      // Invalid URLs
      expect(service.validateSingleTag('website', 'not-a-url').isValid).toBe(false);
    });

    it('should validate yes/no values', () => {
      expect(service.validateSingleTag('fee', 'yes').isValid).toBe(true);
      expect(service.validateSingleTag('fee', 'no').isValid).toBe(true);

      // Invalid
      expect(service.validateSingleTag('fee', 'maybe').isValid).toBe(false);
      expect(service.validateSingleTag('fee', 'true').isValid).toBe(false);
    });
  });

  describe('OSM Export Generation', () => {
    it('should generate OpenStreetMap compatible tags', () => {
      const tags: StructuredTags = {
        artwork_type: 'statue',
        material: 'bronze',
        height: 5.5,
        website: 'https://example.com',
      };

      const osmTags = service.generateOSMExport(tags);

      expect(osmTags.artwork_type).toBe('statue');
      expect(osmTags.material).toBe('bronze');
      expect(osmTags.height).toBe('5.5');
      expect(osmTags.website).toBe('https://example.com');
    });

    it('should exclude empty values from OSM export', () => {
      const tags: StructuredTags = {
        artwork_type: 'statue',
        material: '',
        height: 0, // This should be included as it's a valid value
      };

      const osmTags = service.generateOSMExport(tags);

      expect(osmTags.artwork_type).toBe('statue');
      expect(osmTags.material).toBeUndefined();
      expect(osmTags.height).toBe('0');
    });

    it('should use ca: prefix for unmapped tags', () => {
      const tags: StructuredTags = {
        artwork_type: 'sculpture',
        condition: 'good', // This doesn't have explicit OSM mapping in our schema
      };

      const osmTags = service.generateOSMExport(tags);

      expect(osmTags.artwork_type).toBe('sculpture');
      // condition should either use its OSM mapping or get ca: prefix
      expect(osmTags.condition || osmTags['ca:condition']).toBe('good');
    });
  });

  describe('Artwork Edit Validation', () => {
    it('should validate tags for artwork editing', () => {
      const oldTags: StructuredTags = {
        artwork_type: 'mural',
        material: 'paint',
      };

      const newTags: StructuredTags = {
        artwork_type: 'statue', // Changed type
        material: 'bronze', // Changed material
        height: 5.5, // Added new tag
      };

      const result = service.validateForArtworkEdit(oldTags, newTags);

      expect(result.valid).toBe(true);

      // Should have warning about changing core identification tag
      const hasArtworkTypeWarning = result.warnings.some(w => w.message.includes('Artwork Type'));
      expect(hasArtworkTypeWarning).toBe(true);
    });

    it('should warn about removing required tags', () => {
      const oldTags: StructuredTags = {
        artwork_type: 'statue',
        material: 'bronze',
      };

      const newTags: StructuredTags = {
        // artwork_type still present
        artwork_type: 'statue',
        // material removed - this is allowed since no tags are required
      };

      const result = service.validateForArtworkEdit(oldTags, newTags);

      expect(result.valid).toBe(true); // no tags are required anymore
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Structured Tags Data Creation', () => {
    it('should create structured tags data with metadata', () => {
      const tags: StructuredTags = {
        artwork_type: 'statue',
        material: 'bronze',
      };

      const structuredData = service.createStructuredTagsData(tags, '1.0.0');

      expect(structuredData.tags).toEqual(tags);
      expect(structuredData.version).toBe('1.0.0');
      expect(structuredData.lastModified).toBeTruthy();
      expect(new Date(structuredData.lastModified)).toBeInstanceOf(Date);
    });

    it('should use default version if not provided', () => {
      const tags: StructuredTags = { artwork_type: 'statue' };
      const structuredData = service.createStructuredTagsData(tags);

      expect(structuredData.version).toBe('1.0.0');
    });
  });

  describe('Error Code Generation', () => {
    it('should generate appropriate error codes', () => {
      const invalidTags: StructuredTags = {
        // Testing various invalid tag values
        artwork_type: 'invalid_enum_value',
        height: 'not_a_number',
        start_date: 'invalid_date_format',
        website: 'not-a-url',
        unknown_tag: 'value', // This should be accepted as valid text
      };

      const result = service.validateTags(invalidTags);

      expect(result.valid).toBe(false);

      // Check that validation fails for invalid values, not missing required tags
      const artworkTypeError = result.errors.find(e => e.key === 'artwork_type');
      expect(artworkTypeError?.code).toBe('invalid_enum');

      const heightError = result.errors.find(e => e.key === 'height');
      expect(heightError?.code).toBe('invalid_format');

      const dateError = result.errors.find(e => e.key === 'start_date');
      expect(dateError?.code).toBe('invalid_format');

      const urlError = result.errors.find(e => e.key === 'website');
      expect(urlError?.code).toBe('invalid_format');

      // Unknown tag should NOT have an error anymore
      const unknownError = result.errors.find(e => e.key === 'unknown_tag');
      expect(unknownError).toBeUndefined();
    });
  });

  describe('Integration Edge Cases', () => {
    it('should ignore internal underscore-prefixed tags', () => {
      const tags: StructuredTags = {
        artwork_type: 'statue',
        _photos: 'https://example.com/internal.jpg',
        _internal_meta: 'ignore-me',
      } as unknown as StructuredTags; // casting to allow underscore keys

      const result = service.validateTags(tags);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      // Sanitized tags should not contain the internal keys
      expect(result.sanitized_tags?._photos).toBeUndefined();
      expect(result.sanitized_tags?._internal_meta).toBeUndefined();
      expect(result.sanitized_tags?.artwork_type).toBe('statue');
    });
    it('should handle malformed input gracefully', () => {
      // Test with various malformed inputs
      expect(() => service.validateTags(null as unknown as StructuredTags)).not.toThrow();
      expect(() => service.validateTags(undefined as unknown as StructuredTags)).not.toThrow();
      expect(() =>
        service.validateTags('not an object' as unknown as StructuredTags)
      ).not.toThrow();
    });

    it('should provide consistent validation between single and batch validation', () => {
      const tags: StructuredTags = {
        artwork_type: 'invalid_value',
        height: -5,
      };

      const batchResult = service.validateTags(tags);
      const singleResult1 = service.validateSingleTag('artwork_type', 'invalid_value');
      const singleResult2 = service.validateSingleTag('height', -5);

      expect(batchResult.valid).toBe(false);
      expect(singleResult1.isValid).toBe(false);
      expect(singleResult2.isValid).toBe(false);
    });
  });
});
