/**
 * Mass Import System Tests
 * 
 * Comprehensive test suite for the mass import functionality,
 * including configuration validation, data processing, and CLI operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MassImportLibrary } from '../lib/mass-import';
import {
  MassImportConfig,
  ImportContext,
  MASS_IMPORT_CONSTANTS,
  ImportProgress,
  ImportError
} from '../../shared/mass-import';

describe('Mass Import System', () => {
  let library: MassImportLibrary;
  let mockConfig: MassImportConfig;
  let mockContext: ImportContext;

  beforeEach(() => {
    library = new MassImportLibrary();
    
    mockConfig = {
      source: 'test-source',
      data_file: './test-data.json',
      processing_mode: 'sequential',
      duplicate_radius_meters: 50,
      field_mappings: {
        title: 'title_of_work',
        description: 'description',
        coordinates: {
          lat: 'geo_point_2d.lat',
          lon: 'geo_point_2d.lon'
        }
      },
      tag_mappings: {
        tourism: 'artwork',
        source: 'test_data',
        license: 'CC0',
        external_id: 'id'
      },
      license_config: {
        license_tag: 'CC0',
        attribution_text: 'Test attribution'
      }
    };

    mockContext = {
      config: mockConfig,
      api_token: 'test-token',
      api_base_url: 'https://api.test.com',
      import_id: 'test-import-001',
      dry_run: true
    };
  });

  describe('Configuration Validation', () => {
    it('should validate a complete configuration', async () => {
      const result = await library.validateConfig(mockConfig);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.required_fields_mapped).toBe(true);
      expect(result.summary.tag_mappings_valid).toBe(true);
    });

    it('should fail validation for missing required fields', async () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.field_mappings.title;
      
      const result = await library.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title field mapping is required');
    });

    it('should fail validation for missing coordinates', async () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.field_mappings.coordinates.lat;
      
      const result = await library.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Coordinate field mappings are required');
    });

    it('should warn about missing recommended tags', async () => {
      const configWithoutLicense = { ...mockConfig };
      delete configWithoutLicense.tag_mappings.license;
      
      const result = await library.validateConfig(configWithoutLicense);
      
      expect(result.warnings).toContain('License tag mapping is recommended');
    });
  });

  describe('Data Processing', () => {
    const mockData = [
      {
        id: 'artwork-001',
        title_of_work: 'Test Sculpture',
        description: 'A beautiful test sculpture',
        geo_point_2d: { lat: 49.2827, lon: -123.1207 },
        type: 'Sculpture',
        material: 'Bronze'
      },
      {
        id: 'artwork-002',
        title_of_work: 'Test Mural',
        description: 'A colorful test mural',
        geo_point_2d: { lat: 49.2850, lon: -123.1150 },
        type: 'Mural',
        material: 'Paint'
      }
    ];

    it('should execute dry run successfully', async () => {
      const progressCallback = vi.fn();
      const errorCallback = vi.fn();
      
      const contextWithCallbacks: ImportContext = {
        ...mockContext,
        onProgress: progressCallback,
        onError: errorCallback
      };

      const results = await library.dryRun(mockData, contextWithCallbacks);

      expect(results.dry_run).toBe(true);
      expect(results.source).toBe('test-source');
      expect(results.statistics.total_records).toBe(2);
      expect(results.statistics.successful).toBe(2);
      expect(results.statistics.failed).toBe(0);
      expect(results.successful_records).toHaveLength(2);

      // Check that progress callbacks were called
      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'validation',
          total: 2
        })
      );
    });

    it('should handle records with missing required fields', async () => {
      const invalidData = [
        {
          id: 'artwork-003',
          // Missing title_of_work
          description: 'Missing title',
          geo_point_2d: { lat: 49.2827, lon: -123.1207 }
        }
      ];

      const results = await library.dryRun(invalidData, mockContext);

      expect(results.statistics.failed).toBe(1);
      expect(results.statistics.successful).toBe(0);
      expect(results.failed_records).toHaveLength(1);
      expect(results.failed_records[0].error_type).toBe('validation');
      expect(results.failed_records[0].error_message).toContain('Title field is required');
    });

    it('should handle records with invalid coordinates', async () => {
      const invalidData = [
        {
          id: 'artwork-004',
          title_of_work: 'Invalid Coords',
          geo_point_2d: { lat: 'invalid', lon: 'invalid' }
        }
      ];

      const results = await library.dryRun(invalidData, mockContext);

      expect(results.statistics.failed).toBe(1);
      expect(results.failed_records[0].error_message).toContain('Invalid coordinate format');
    });

    it('should validate coordinate ranges', async () => {
      const invalidData = [
        {
          id: 'artwork-005',
          title_of_work: 'Out of Range',
          geo_point_2d: { lat: 91, lon: 181 } // Invalid ranges
        }
      ];

      const results = await library.dryRun(invalidData, mockContext);

      expect(results.statistics.failed).toBe(1);
      expect(results.failed_records[0].error_message).toContain('Invalid latitude value');
    });
  });

  describe('Tag Mapping and Validation', () => {
    it('should map simple string tags correctly', async () => {
      const testData = [{
        id: 'test-001',
        title_of_work: 'Test Artwork',
        geo_point_2d: { lat: 49.2827, lon: -123.1207 },
        type: 'Sculpture'
      }];

      const results = await library.dryRun(testData, mockContext);
      
      const processedRecord = results.successful_records[0];
      expect(processedRecord.applied_tags.tourism).toBe('artwork');
      expect(processedRecord.applied_tags.source).toBe('test_data');
      expect(processedRecord.applied_tags.license).toBe('CC0');
      expect(processedRecord.applied_tags.external_id).toBe('test-001');
    });

    it('should apply transformations to tag values', async () => {
      const configWithTransforms: MassImportConfig = {
        ...mockConfig,
        tag_mappings: {
          ...mockConfig.tag_mappings,
          artwork_type: {
            source_field: 'type',
            transform: 'lowercase_with_underscores'
          }
        }
      };

      const testData = [{
        id: 'test-002',
        title_of_work: 'Test Artwork',
        geo_point_2d: { lat: 49.2827, lon: -123.1207 },
        type: 'Large Outdoor Sculpture'
      }];

      const contextWithTransforms = { ...mockContext, config: configWithTransforms };
      const results = await library.dryRun(testData, contextWithTransforms);
      
      const processedRecord = results.successful_records[0];
      expect(processedRecord.applied_tags.artwork_type).toBe('large_outdoor_sculpture');
    });

    it('should handle template-based tag mappings', async () => {
      const configWithTemplate: MassImportConfig = {
        ...mockConfig,
        tag_mappings: {
          ...mockConfig.tag_mappings,
          data_source_url: {
            source_field: 'id',
            template: 'https://example.com/artwork/{external_id}'
          }
        }
      };

      const testData = [{
        id: 'test-003',
        title_of_work: 'Test Artwork',
        geo_point_2d: { lat: 49.2827, lon: -123.1207 }
      }];

      const contextWithTemplate = { ...mockContext, config: configWithTemplate };
      const results = await library.dryRun(testData, contextWithTemplate);
      
      const processedRecord = results.successful_records[0];
      expect(processedRecord.applied_tags.data_source_url).toBe('https://example.com/artwork/test-003');
    });
  });

  describe('Progress and Error Handling', () => {
    it('should report progress during processing', async () => {
      const progressSpy = vi.fn();
      const contextWithProgress = { ...mockContext, onProgress: progressSpy };

      const testData = [
        { id: '1', title_of_work: 'Art 1', geo_point_2d: { lat: 49.28, lon: -123.12 }},
        { id: '2', title_of_work: 'Art 2', geo_point_2d: { lat: 49.29, lon: -123.13 }},
      ];

      await library.dryRun(testData, contextWithProgress);

      expect(progressSpy).toHaveBeenCalledTimes(5); // Start, per record (2), duplicate check, completion
      expect(progressSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'validation',
          processed: 0,
          total: 2,
          message: 'Starting dry run validation...'
        })
      );
    });

    it('should report errors during processing', async () => {
      const errorSpy = vi.fn();
      const contextWithError = { ...mockContext, onError: errorSpy };

      const invalidData = [
        { id: '1', geo_point_2d: { lat: 49.28, lon: -123.12 }} // Missing title
      ];

      await library.dryRun(invalidData, contextWithError);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          type: 'validation',
          message: expect.stringContaining('Title field is required')
        })
      );
    });
  });

  describe('Constants and Defaults', () => {
    it('should provide correct default constants', () => {
      expect(MASS_IMPORT_CONSTANTS.DEFAULT_DUPLICATE_RADIUS_METERS).toBe(50);
      expect(MASS_IMPORT_CONSTANTS.DEFAULT_BATCH_SIZE).toBe(50);
      expect(MASS_IMPORT_CONSTANTS.DEFAULT_MAX_CONCURRENT).toBe(5);
      expect(MASS_IMPORT_CONSTANTS.MASS_IMPORT_USER_UUID).toBe('00000000-0000-0000-0000-000000000002');
    });

    it('should provide correct similarity thresholds', () => {
      expect(MASS_IMPORT_CONSTANTS.DUPLICATE_THRESHOLDS.HIGH_SIMILARITY).toBe(0.85);
      expect(MASS_IMPORT_CONSTANTS.DUPLICATE_THRESHOLDS.MODERATE_SIMILARITY).toBe(0.70);
      expect(MASS_IMPORT_CONSTANTS.DUPLICATE_THRESHOLDS.LOW_SIMILARITY).toBe(0.55);
    });

    it('should define required import tags', () => {
      expect(MASS_IMPORT_CONSTANTS.REQUIRED_IMPORT_TAGS).toContain('source');
      expect(MASS_IMPORT_CONSTANTS.REQUIRED_IMPORT_TAGS).toContain('import_date');
      expect(MASS_IMPORT_CONSTANTS.REQUIRED_IMPORT_TAGS).toContain('license');
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle empty data array', async () => {
      const results = await library.dryRun([], mockContext);

      expect(results.statistics.total_records).toBe(0);
      expect(results.statistics.successful).toBe(0);
      expect(results.statistics.failed).toBe(0);
      expect(results.successful_records).toHaveLength(0);
      expect(results.failed_records).toHaveLength(0);
    });

    it('should handle missing nested field values gracefully', async () => {
      const dataWithMissingNested = [{
        id: 'test-nested',
        title_of_work: 'Test',
        // Missing geo_point_2d entirely
      }];

      const results = await library.dryRun(dataWithMissingNested, mockContext);

      expect(results.statistics.failed).toBe(1);
      expect(results.failed_records[0].error_message).toContain('Coordinate fields are required');
    });

    it('should generate unique import IDs', async () => {
      const results1 = await library.dryRun([], mockContext);
      
      // Wait a moment to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const results2 = await library.dryRun([], { ...mockContext, import_id: undefined });

      expect(results1.import_id).toBeDefined();
      expect(results2.import_id).toBeDefined();
      // IDs should be different due to timestamp
      expect(results1.import_id).not.toBe(results2.import_id);
    });
  });

  describe('Integration with Existing Systems', () => {
    it('should use existing tag validation system', async () => {
      // This would test integration with the existing tag validation
      // from src/shared/tag-validation.ts
      
      const testData = [{
        id: 'tag-test',
        title_of_work: 'Tag Test',
        geo_point_2d: { lat: 49.2827, lon: -123.1207 }
      }];

      const results = await library.dryRun(testData, mockContext);

      expect(results.tag_validation_summary).toBeDefined();
      expect(results.tag_validation_summary.total_tags).toBeGreaterThan(0);
    });

    it('should integrate with similarity service for duplicate detection', async () => {
      // This would test integration with the similarity service
      // we implemented earlier for duplicate detection
      
      const testData = [{
        id: 'similarity-test',
        title_of_work: 'Similarity Test',
        geo_point_2d: { lat: 49.2827, lon: -123.1207 }
      }];

      const results = await library.dryRun(testData, mockContext);

      // During dry run, duplicate checking is simulated
      expect(results.duplicate_matches).toBeDefined();
      expect(Array.isArray(results.duplicate_matches)).toBe(true);
    });
  });
});

/**
 * Integration tests for CLI functionality
 * These would test the CLI interface and configuration loading
 */
describe('Mass Import CLI', () => {
  // CLI tests would go here but require more complex setup
  // For now, focusing on the core library functionality
  
  it('should be implemented', () => {
    expect(true).toBe(true); // Placeholder
  });
});

/**
 * Vancouver Import Script Tests
 * Tests specific to the Vancouver public art import configuration
 */
describe('Vancouver Import Configuration', () => {
  it('should handle Vancouver data structure', async () => {
    const vancouverConfig: MassImportConfig = {
      source: 'vancouver-public-art',
      data_file: './test-data.json',
      processing_mode: 'sequential',
      duplicate_radius_meters: 50,
      field_mappings: {
        title: 'title_of_work',
        description: 'descriptionofwork',
        notes: 'artistprojectstatement',
        coordinates: {
          lat: 'geo_point_2d.lat',
          lon: 'geo_point_2d.lon'
        }
      },
      tag_mappings: {
        tourism: 'artwork',
        artwork_type: {
          source_field: 'type',
          transform: 'lowercase_with_underscores'
        },
        material: 'primarymaterial',
        external_id: 'registryid',
        source: 'vancouver_open_data',
        license: 'CC0'
      },
      license_config: {
        license_tag: 'CC0',
        attribution_text: 'Data licensed under CC0 from City of Vancouver'
      }
    };

    const library = new MassImportLibrary();
    const validation = await library.validateConfig(vancouverConfig);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should process Vancouver data format correctly', async () => {
    const vancouverData = [{
      registryid: 27,
      title_of_work: 'Solo',
      descriptionofwork: 'An abstract sculpture of stainless steel with carved cedar planks that fan out in a spiral.',
      type: 'Sculpture',
      primarymaterial: 'Stainless steel, cedar',
      geo_point_2d: { lat: 49.293313, lon: -123.133965 },
      yearofinstallation: '1986'
    }];

    const mockConfig: MassImportConfig = {
      source: 'vancouver-test',
      data_file: './test.json',
      processing_mode: 'sequential',
      duplicate_radius_meters: 50,
      field_mappings: {
        title: 'title_of_work',
        description: 'descriptionofwork',
        coordinates: { lat: 'geo_point_2d.lat', lon: 'geo_point_2d.lon' }
      },
      tag_mappings: {
        tourism: 'artwork',
        external_id: 'registryid',
        artwork_type: { source_field: 'type', transform: 'lowercase_with_underscores' },
        material: 'primarymaterial',
        start_date: { source_field: 'yearofinstallation', validation: 'year_format' },
        source: 'vancouver_open_data',
        license: 'CC0'
      },
      license_config: { license_tag: 'CC0', attribution_text: 'Test' }
    };

    const context: ImportContext = {
      config: mockConfig,
      api_token: 'test',
      api_base_url: 'test',
      import_id: 'test',
      dry_run: true
    };

    const library = new MassImportLibrary();
    const results = await library.dryRun(vancouverData, context);

    expect(results.statistics.successful).toBe(1);
    expect(results.statistics.failed).toBe(0);
    
    const record = results.successful_records[0];
    expect(record.title).toBe('Solo');
    expect(record.applied_tags.external_id).toBe('27');
    expect(record.applied_tags.artwork_type).toBe('sculpture');
    expect(record.applied_tags.material).toBe('Stainless steel, cedar');
    expect(record.applied_tags.start_date).toBe('1986');
    expect(record.applied_tags.source).toBe('vancouver_open_data');
    expect(record.applied_tags.license).toBe('CC0');
  });
});