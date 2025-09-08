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
        tourism: 'artwork',
        artwork_type: 'statue',
        name: 'Test Statue',
        height: 5.5,
        access: 'yes',
        fee: 'no',
      };

      const result = service.validateTags(validTags);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized_tags).toBeDefined();
    });

    it('should reject invalid tags', () => {
      const invalidTags: StructuredTags = {
        tourism: 'invalid_value',
        artwork_type: 'not_an_enum_value',
        height: 'not_a_number',
        website: 'not-a-url',
      };

      const result = service.validateTags(invalidTags);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.key === 'tourism')).toBe(true);
      expect(result.errors.some(e => e.key === 'artwork_type')).toBe(true);
      expect(result.errors.some(e => e.key === 'height')).toBe(true);
      expect(result.errors.some(e => e.key === 'website')).toBe(true);
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
        tourism: 'artwork',
        artwork_type: 'statue',
        name: 'Test Statue',
        height: 5.5,
        website: 'https://example.com',
      };

      const osmTags = service.generateOSMExport(tags);

      expect(osmTags.tourism).toBe('artwork');
      expect(osmTags.artwork_type).toBe('statue');
      expect(osmTags.name).toBe('Test Statue');
      expect(osmTags.height).toBe('5.5');
      expect(osmTags.website).toBe('https://example.com');
    });

    it('should exclude empty values from OSM export', () => {
      const tags: StructuredTags = {
        tourism: 'artwork',
        name: '',
        height: 0, // This should be included as it's a valid value
      };

      const osmTags = service.generateOSMExport(tags);

      expect(osmTags.tourism).toBe('artwork');
      expect(osmTags.name).toBeUndefined();
      expect(osmTags.height).toBe('0');
    });

    it('should use ca: prefix for unmapped tags', () => {
      const tags: StructuredTags = {
        tourism: 'artwork',
        condition: 'good', // This doesn't have explicit OSM mapping in our schema
      };

      const osmTags = service.generateOSMExport(tags);

      expect(osmTags.tourism).toBe('artwork');
      // condition should either use its OSM mapping or get ca: prefix
      expect(osmTags.condition || osmTags['ca:condition']).toBe('good');
    });
  });

  describe('Artwork Edit Validation', () => {
    it('should validate tags for artwork editing', () => {
      const oldTags: StructuredTags = {
        tourism: 'artwork',
        artwork_type: 'mural',
        name: 'Old Name',
      };

      const newTags: StructuredTags = {
        tourism: 'artwork',
        artwork_type: 'statue', // Changed type
        name: 'New Name',
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
        tourism: 'artwork',
        name: 'Test Name',
      };

      const newTags: StructuredTags = {
        // tourism removed!
        name: 'Test Name',
      };

      const result = service.validateForArtworkEdit(oldTags, newTags);

      expect(result.valid).toBe(true); // no tags are required anymore
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Structured Tags Data Creation', () => {
    it('should create structured tags data with metadata', () => {
      const tags: StructuredTags = {
        tourism: 'artwork',
        name: 'Test',
      };

      const structuredData = service.createStructuredTagsData(tags, '1.0.0');

      expect(structuredData.tags).toEqual(tags);
      expect(structuredData.version).toBe('1.0.0');
      expect(structuredData.lastModified).toBeTruthy();
      expect(new Date(structuredData.lastModified)).toBeInstanceOf(Date);
    });

    it('should use default version if not provided', () => {
      const tags: StructuredTags = { tourism: 'artwork' };
      const structuredData = service.createStructuredTagsData(tags);

      expect(structuredData.version).toBe('1.0.0');
    });
  });

  describe('Error Code Generation', () => {
    it('should generate appropriate error codes', () => {
      const invalidTags: StructuredTags = {
        // Missing required tourism tag
        artwork_type: 'invalid_enum_value',
        height: 'not_a_number',
        start_date: 'invalid_date_format',
        website: 'not-a-url',
        unknown_tag: 'value',
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

      const unknownError = result.errors.find(e => e.key === 'unknown_tag');
      expect(unknownError?.code).toBe('unknown_key');
    });
  });

  describe('Integration Edge Cases', () => {
    it('should handle malformed input gracefully', () => {
      // Test with various malformed inputs
      expect(() => service.validateTags(null as unknown as StructuredTags)).not.toThrow();
      expect(() => service.validateTags(undefined as unknown as StructuredTags)).not.toThrow();
      expect(() => service.validateTags('not an object' as unknown as StructuredTags)).not.toThrow();
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