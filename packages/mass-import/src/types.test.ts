import { describe, it, expect } from 'vitest';
import { 
  ImportConfigSchema, 
  ImportRecordSchema, 
  isValidImportRecord,
  isValidImportConfig,
  MASS_IMPORT_USER_ID,
  VANCOUVER_BOUNDS 
} from '../src/types.js';

describe('Mass Import Types', () => {
  describe('ImportConfigSchema', () => {
    it('should validate correct configuration', () => {
      const config = {
        apiBaseUrl: 'https://api.example.com',
        apiToken: 'test-token',
        source: 'test-source',
        batchSize: 25,
        dryRun: false
      };

      const result = ImportConfigSchema.parse(config);
      expect(result.apiBaseUrl).toBe(config.apiBaseUrl);
      expect(result.batchSize).toBe(25);
    });

    it('should apply default values', () => {
      const config = {
        apiBaseUrl: 'https://api.example.com',
        apiToken: 'test-token',
        source: 'test-source'
      };

      const result = ImportConfigSchema.parse(config);
      expect(result.batchSize).toBe(50); // Default value
      expect(result.dryRun).toBe(false); // Default value
    });

    it('should reject invalid URLs', () => {
      const config = {
        apiBaseUrl: 'not-a-url',
        apiToken: 'test-token',
        source: 'test-source'
      };

      expect(() => ImportConfigSchema.parse(config)).toThrow();
    });

    it('should validate bounds if provided', () => {
      const config = {
        apiBaseUrl: 'https://api.example.com',
        apiToken: 'test-token',
        source: 'test-source',
        bounds: {
          north: 49.32,
          south: 49.2,
          east: -123.0,
          west: -123.3
        }
      };

      const result = ImportConfigSchema.parse(config);
      expect(result.bounds).toEqual(config.bounds);
    });
  });

  describe('ImportRecordSchema', () => {
    it('should validate correct import record', () => {
      const record = {
        externalId: 'test-123',
        lat: 49.293313,
        lon: -123.133965,
        title: 'Test Artwork',
        description: 'A test description',
        createdBy: 'Test Artist',
        photoUrls: ['https://example.com/photo.jpg'],
        tags: {
          tourism: 'artwork',
          artwork_type: 'sculpture',
          material: 'bronze'
        },
        metadata: {
          originalSource: 'test-data'
        }
      };

      const result = ImportRecordSchema.parse(record);
      expect(result.externalId).toBe('test-123');
      expect(result.tags.tourism).toBe('artwork');
    });

    it('should reject invalid coordinates', () => {
      const record = {
        externalId: 'test-123',
        lat: 200, // Invalid latitude
        lon: -123.133965,
        title: 'Test Artwork',
        tags: { tourism: 'artwork' }
      };

      expect(() => ImportRecordSchema.parse(record)).toThrow();
    });

    it('should reject titles that are too long', () => {
      const record = {
        externalId: 'test-123',
        lat: 49.293313,
        lon: -123.133965,
        title: 'A'.repeat(201), // Too long
        tags: { tourism: 'artwork' }
      };

      expect(() => ImportRecordSchema.parse(record)).toThrow();
    });

    it('should validate photo URLs', () => {
      const record = {
        externalId: 'test-123',
        lat: 49.293313,
        lon: -123.133965,
        title: 'Test Artwork',
        photoUrls: ['not-a-url'], // Invalid URL
        tags: { tourism: 'artwork' }
      };

      expect(() => ImportRecordSchema.parse(record)).toThrow();
    });
  });

  describe('Type Guards', () => {
    it('isValidImportRecord should work correctly', () => {
      const validRecord = {
        externalId: 'test-123',
        lat: 49.293313,
        lon: -123.133965,
        title: 'Test Artwork',
        tags: { tourism: 'artwork' }
      };

      const invalidRecord = {
        externalId: 'test-123',
        lat: 200, // Invalid
        lon: -123.133965,
        title: 'Test Artwork',
        tags: { tourism: 'artwork' }
      };

      expect(isValidImportRecord(validRecord)).toBe(true);
      expect(isValidImportRecord(invalidRecord)).toBe(false);
    });

    it('isValidImportConfig should work correctly', () => {
      const validConfig = {
        apiBaseUrl: 'https://api.example.com',
        apiToken: 'test-token',
        source: 'test-source'
      };

      const invalidConfig = {
        apiBaseUrl: 'not-a-url',
        apiToken: 'test-token',
        source: 'test-source'
      };

      expect(isValidImportConfig(validConfig)).toBe(true);
      expect(isValidImportConfig(invalidConfig)).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should export correct mass import user ID', () => {
      expect(MASS_IMPORT_USER_ID).toBe('00000000-0000-0000-0000-000000000002');
    });

    it('should export Vancouver bounds', () => {
      expect(VANCOUVER_BOUNDS.north).toBeGreaterThan(VANCOUVER_BOUNDS.south);
      expect(VANCOUVER_BOUNDS.east).toBeGreaterThan(VANCOUVER_BOUNDS.west);
      expect(VANCOUVER_BOUNDS.north).toBeCloseTo(49.32, 1);
      expect(VANCOUVER_BOUNDS.south).toBeCloseTo(49.2, 1);
    });
  });
});