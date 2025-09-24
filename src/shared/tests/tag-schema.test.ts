/**
 * Unit tests for tag schema and validation system
 */

import { describe, it, expect } from 'vitest';
import {
  TAG_DEFINITIONS,
  TAG_CATEGORIES,
  getTagsByCategory,
  getTagDefinition,
  getValidTagKeys,
  generateOSMTags,
  isValidTagKey,
  getTagEnumValues,
} from '../tag-schema.js';
import {
  validateTagValue,
  validateStructuredTags,
  getValidationSummary,
  sanitizeTagValue,
  sanitizeStructuredTags,
} from '../tag-validation.js';

describe('Tag Schema', () => {
  describe('Tag Definitions', () => {
    it('should have all 15 essential tags defined', () => {
      const tagKeys = getValidTagKeys();
      expect(tagKeys).toHaveLength(15);

      // Check for required tags
      expect(tagKeys).toContain('tourism');
      expect(tagKeys).toContain('artwork_type');
      expect(tagKeys).toContain('name');
      expect(tagKeys).toContain('artist_name');
      expect(tagKeys).toContain('material');
      expect(tagKeys).toContain('height');
      expect(tagKeys).toContain('start_date');
      expect(tagKeys).toContain('access');
      expect(tagKeys).toContain('fee');
      expect(tagKeys).toContain('subject');
      expect(tagKeys).toContain('style');
      expect(tagKeys).toContain('condition');
      expect(tagKeys).toContain('website');
      expect(tagKeys).toContain('wikipedia');
      expect(tagKeys).toContain('description');
    });

    it('should organize tags into 5 categories', () => {
      const categories = Object.keys(TAG_CATEGORIES);
      expect(categories).toHaveLength(5);
      expect(categories).toContain('physical_properties');
      expect(categories).toContain('historical_info');
      expect(categories).toContain('location_details');
      expect(categories).toContain('artwork_classification');
      expect(categories).toContain('reference_data');
    });

    it('should have valid tag definitions', () => {
      Object.values(TAG_DEFINITIONS).forEach(tag => {
        expect(tag.key).toBeTruthy();
        expect(tag.label).toBeTruthy();
        expect(tag.description).toBeTruthy();
        expect(tag.category).toBeTruthy();
        expect(tag.dataType).toBeTruthy();
        expect(typeof tag.required).toBe('boolean');
      });
    });

    it('should group tags by category correctly', () => {
      const tagsByCategory = getTagsByCategory();

      // Check that each category has tags
      Object.values(tagsByCategory).forEach(categoryTags => {
        expect(categoryTags.length).toBeGreaterThan(0);
      });

      // Check specific tag placements
      expect(tagsByCategory.physical_properties.some(t => t.key === 'material')).toBe(true);
      expect(tagsByCategory.historical_info.some(t => t.key === 'artist_name')).toBe(true);
      expect(tagsByCategory.artwork_classification.some(t => t.key === 'tourism')).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    it('should validate tag keys correctly', () => {
      expect(isValidTagKey('tourism')).toBe(true);
      expect(isValidTagKey('invalid_key')).toBe(false);
    });

    it('should get tag definitions by key', () => {
      const def = getTagDefinition('tourism');
      expect(def).toBeDefined();
      expect(def?.key).toBe('tourism');
    });

    it('should get enum values for enum tags', () => {
      const enumValues = getTagEnumValues('artwork_type');
      expect(enumValues).toBeDefined();
      expect(enumValues).toContain('statue');
      expect(enumValues).toContain('mural');
    });

    it('should generate OSM tags correctly', () => {
      const structuredTags = {
        tourism: 'artwork',
        artwork_type: 'statue',
        name: 'Test Statue',
        height: 5.5,
      };

      const osmTags = generateOSMTags(structuredTags);
      expect(osmTags.tourism).toBe('artwork');
      expect(osmTags.artwork_type).toBe('statue');
      expect(osmTags.name).toBe('Test Statue');
      expect(osmTags.height).toBe('5.5');
    });
  });
});

describe('Tag Validation', () => {
  describe('Enum Validation', () => {
    it('should validate valid enum values', () => {
      const definition = TAG_DEFINITIONS.artwork_type;
      if (!definition) throw new Error('Definition not found');
      const result = validateTagValue('statue', definition);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid enum values', () => {
      const definition = TAG_DEFINITIONS.artwork_type;
      if (!definition) throw new Error('Definition not found');
      const result = validateTagValue('invalid_type', definition);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid value');
    });
  });

  describe('Text Validation', () => {
    it('should validate text within length limits', () => {
      const definition = TAG_DEFINITIONS.name;
      if (!definition) throw new Error('Definition not found');
      const result = validateTagValue('Test Artwork Name', definition);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject text exceeding length limits', () => {
      const definition = TAG_DEFINITIONS.name;
      if (!definition) throw new Error('Definition not found');
      const longText = 'A'.repeat(300); // Exceeds 200 char limit
      const result = validateTagValue(longText, definition);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('characters or less');
    });
  });

  describe('Number Validation', () => {
    it('should validate numbers within range', () => {
      const definition = TAG_DEFINITIONS.height;
      if (!definition) throw new Error('Definition not found');
      const result = validateTagValue(5.5, definition);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject numbers outside valid range', () => {
      const definition = TAG_DEFINITIONS.height;
      if (!definition) throw new Error('Definition not found');
      const result = validateTagValue(-1, definition);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('at least');
    });

    it('should reject non-numeric values', () => {
      const definition = TAG_DEFINITIONS.height;
      if (!definition) throw new Error('Definition not found');
      const result = validateTagValue('not a number', definition);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('valid number');
    });
  });

  describe('Date Validation', () => {
    it('should validate various date formats', () => {
      const definition = TAG_DEFINITIONS.start_date;
      if (!definition) throw new Error('Definition not found');

      expect(validateTagValue('2023', definition).isValid).toBe(true);
      expect(validateTagValue('2023-07', definition).isValid).toBe(true);
      expect(validateTagValue('2023-07-15', definition).isValid).toBe(true);
    });

    it('should reject invalid date formats', () => {
      const definition = TAG_DEFINITIONS.start_date;
      if (!definition) throw new Error('Definition not found');

      expect(validateTagValue('23', definition).isValid).toBe(false);
      expect(validateTagValue('2023-13', definition).isValid).toBe(false);
      expect(validateTagValue('2023-07-32', definition).isValid).toBe(false);
    });
  });

  describe('URL Validation', () => {
    it('should validate valid URLs', () => {
      const definition = TAG_DEFINITIONS.website;
      if (!definition) throw new Error('Definition not found');

      expect(validateTagValue('https://example.com', definition).isValid).toBe(true);
      expect(validateTagValue('http://example.org', definition).isValid).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const definition = TAG_DEFINITIONS.website;
      if (!definition) throw new Error('Definition not found');

      expect(validateTagValue('not-a-url', definition).isValid).toBe(false);
      expect(validateTagValue('ftp://example.com', definition).isValid).toBe(false);
    });

    it('should warn about HTTP URLs', () => {
      const definition = TAG_DEFINITIONS.website;
      if (!definition) throw new Error('Definition not found');
      const result = validateTagValue('http://example.com', definition);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('HTTP instead of HTTPS');
    });
  });

  describe('Yes/No Validation', () => {
    it('should validate yes/no values', () => {
      const definition = TAG_DEFINITIONS.fee;
      if (!definition) throw new Error('Definition not found');

      expect(validateTagValue('yes', definition).isValid).toBe(true);
      expect(validateTagValue('no', definition).isValid).toBe(true);
    });

    it('should reject invalid yes/no values', () => {
      const definition = TAG_DEFINITIONS.fee;
      if (!definition) throw new Error('Definition not found');

      expect(validateTagValue('maybe', definition).isValid).toBe(false);
      expect(validateTagValue('true', definition).isValid).toBe(false);
    });
  });

  describe('Batch Validation', () => {
    it('should validate structured tags object', () => {
      const tags = {
        tourism: 'artwork',
        artwork_type: 'statue',
        name: 'Test Statue',
        height: 5.5,
      };

      const results = validateStructuredTags(tags, TAG_DEFINITIONS);

      expect(Object.keys(results)).toHaveLength(4);
      Object.values(results).forEach(result => {
        expect(result.isValid).toBe(true);
      });
    });

    it('should identify validation errors in batch', () => {
      const tags = {
        tourism: 'invalid',
        height: 'not a number',
        unknown_tag: 'value',
      };

      const results = validateStructuredTags(tags, TAG_DEFINITIONS);

      expect(results.tourism?.isValid).toBe(false);
      expect(results.height?.isValid).toBe(false);
      expect(results.unknown_tag?.isValid).toBe(false);
    });

    it('should generate validation summary', () => {
      const validationResults = {
        tourism: { isValid: true, errors: [], warnings: [] },
        height: { isValid: false, errors: ['Invalid number'], warnings: [] },
        name: { isValid: true, errors: [], warnings: ['Warning message'] },
      };

      const summary = getValidationSummary(validationResults);

      expect(summary.isValid).toBe(false);
      expect(summary.totalErrors).toBe(1);
      expect(summary.totalWarnings).toBe(1);
    });
  });

  describe('Sanitization', () => {
    it('should sanitize text values', () => {
      expect(sanitizeTagValue('  test  ', 'text')).toBe('test');
    });

    it('should sanitize enum values', () => {
      expect(sanitizeTagValue('STATUE', 'enum')).toBe('statue');
    });

    it('should sanitize number values', () => {
      expect(sanitizeTagValue('5.5', 'number')).toBe(5.5);
      expect(sanitizeTagValue('invalid', 'number')).toBe('invalid');
    });

    it('should sanitize structured tags object', () => {
      const tags = {
        name: '  Test Name  ',
        artwork_type: 'STATUE',
        height: '5.5',
      };

      const sanitized = sanitizeStructuredTags(tags, TAG_DEFINITIONS);

      expect(sanitized.name).toBe('Test Name');
      expect(sanitized.artwork_type).toBe('statue');
      expect(sanitized.height).toBe(5.5);
    });
  });
});
