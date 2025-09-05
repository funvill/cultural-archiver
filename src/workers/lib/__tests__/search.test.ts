/**
 * Tests for search functionality
 * Tests search utilities and API endpoints
 */

import { describe, it, expect } from 'vitest';
import { validateSearchQuery, parseSearchQuery } from '../search';

describe('Search Utilities', () => {
  describe('validateSearchQuery', () => {
    it('should validate normal queries', () => {
      const result = validateSearchQuery('street art');

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('street art');
      expect(result.error).toBeUndefined();
    });

    it('should reject empty queries', () => {
      const result = validateSearchQuery('');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Search query cannot be empty');
    });

    it('should reject whitespace-only queries', () => {
      const result = validateSearchQuery('   ');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Search query cannot be empty');
    });

    it('should reject overly long queries', () => {
      const longQuery = 'a'.repeat(201);
      const result = validateSearchQuery(longQuery);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Search query too long (max 200 characters)');
      expect(result.sanitized).toHaveLength(200);
    });

    it('should sanitize excessive whitespace', () => {
      const result = validateSearchQuery('  street    art  ');

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('street art');
    });
  });

  describe('parseSearchQuery', () => {
    it('should parse simple text queries', () => {
      const result = parseSearchQuery('street art');

      expect(result.text).toBe('street art');
      expect(result.tagKeys).toHaveLength(0);
      expect(result.tagPairs).toHaveLength(0);
      expect(result.filters).toEqual({});
    });

    it('should handle empty queries', () => {
      const result = parseSearchQuery('');

      expect(result.text).toBe('');
      expect(result.tagKeys).toHaveLength(0);
      expect(result.tagPairs).toHaveLength(0);
      expect(result.filters).toEqual({});
    });

    it('should trim whitespace', () => {
      const result = parseSearchQuery('  street art  ');

      expect(result.text).toBe('street art');
    });

    it('should parse tag key searches', () => {
      const result = parseSearchQuery('tag:material street art');

      expect(result.text).toBe('street art');
      expect(result.tagKeys).toEqual(['material']);
      expect(result.tagPairs).toHaveLength(0);
    });

    it('should parse tag key-value searches', () => {
      const result = parseSearchQuery('tag:material:bronze tag:artist:banksy street art');

      expect(result.text).toBe('street art');
      expect(result.tagKeys).toHaveLength(0);
      expect(result.tagPairs).toEqual([
        { key: 'material', value: 'bronze' },
        { key: 'artist', value: 'banksy' }
      ]);
    });

    it('should handle mixed tag and text searches', () => {
      const result = parseSearchQuery('tag:artwork_type tag:material:bronze modern sculpture');

      expect(result.text).toBe('modern sculpture');
      expect(result.tagKeys).toEqual(['artwork_type']);
      expect(result.tagPairs).toEqual([{ key: 'material', value: 'bronze' }]);
    });

    it('should handle case insensitive tag syntax', () => {
      const result = parseSearchQuery('TAG:Material:BRONZE Tag:Artist street');

      expect(result.text).toBe('street');
      expect(result.tagKeys).toEqual(['artist']);
      expect(result.tagPairs).toEqual([{ key: 'material', value: 'BRONZE' }]);
    });
  });
});
