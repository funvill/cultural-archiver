/**
 * Tests for Mass Import System Library
 * 
 * Tests the core library functionality without CLI execution.
 */

import { describe, it, expect } from 'vitest';
import { 
  createDefaultConfig,
  validateConfig,
  getLibraryInfo,
} from './index.js';

describe('Mass Import System Library', () => {
  describe('Library Configuration', () => {
    it('should create valid default configuration', () => {
      const config = createDefaultConfig();
      expect(config).toMatchObject({
        apiEndpoint: 'https://art-api.abluestar.com',
        massImportUserToken: '00000000-0000-0000-0000-000000000002',
        batchSize: 50,
        maxRetries: 3,
        retryDelay: 1000,
        duplicateDetectionRadius: 50,
        titleSimilarityThreshold: 0.8,
        dryRun: false,
      });
    });

    it('should validate configuration correctly', () => {
      const validConfig = createDefaultConfig();
      const validation = validateConfig(validConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const invalidConfig = {
        apiEndpoint: 'not-a-url',
        massImportUserToken: 'not-a-uuid',
        batchSize: -1,
      };
      const validation = validateConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should provide library information', () => {
      const info = getLibraryInfo();
      expect(info).toMatchObject({
        name: '@cultural-archiver/mass-import',
        version: '1.0.0',
        description: 'Mass import library for Cultural Archiver - automated ingestion of public art data',
        author: 'Steven Smethurst',
        license: 'MIT',
      });
      expect(info.supportedDataSources).toContain('vancouver-opendata');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate API endpoint format', () => {
      const invalidEndpoints = ['not-a-url', 'ftp://invalid.com', ''];
      
      invalidEndpoints.forEach(endpoint => {
        const validation = validateConfig({ apiEndpoint: endpoint });
        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });

    it('should validate UUID format for token', () => {
      const invalidTokens = ['not-a-uuid', '12345', ''];
      
      invalidTokens.forEach(token => {
        const validation = validateConfig({ massImportUserToken: token });
        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });

    it('should validate numeric ranges', () => {
      const config = createDefaultConfig();
      
      // Test batch size
      expect(validateConfig({ ...config, batchSize: -1 }).isValid).toBe(false);
      expect(validateConfig({ ...config, batchSize: 1001 }).isValid).toBe(false);
      expect(validateConfig({ ...config, batchSize: 50 }).isValid).toBe(true);
      
      // Test similarity threshold
      expect(validateConfig({ ...config, titleSimilarityThreshold: -0.1 }).isValid).toBe(false);
      expect(validateConfig({ ...config, titleSimilarityThreshold: 1.1 }).isValid).toBe(false);
      expect(validateConfig({ ...config, titleSimilarityThreshold: 0.8 }).isValid).toBe(true);
    });
  });

  describe('Library Information', () => {
    it('should provide correct supported data sources', () => {
      const info = getLibraryInfo();
      expect(info.supportedDataSources).toContain('vancouver-opendata');
      expect(info.supportedDataSources).toContain('generic');
    });

    it('should have proper versioning', () => {
      const info = getLibraryInfo();
      expect(info.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});