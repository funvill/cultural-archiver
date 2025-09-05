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
      expect(result.tags).toHaveLength(0);
      expect(result.filters).toEqual({});
    });

    it('should handle empty queries', () => {
      const result = parseSearchQuery('');

      expect(result.text).toBe('');
      expect(result.tags).toHaveLength(0);
      expect(result.filters).toEqual({});
    });

    it('should trim whitespace', () => {
      const result = parseSearchQuery('  street art  ');

      expect(result.text).toBe('street art');
    });
  });
});
