/**
 * Test Suite for Data Pipeline
 * 
 * Tests the core data proc    test('should handle exporter errors gracefully', async () => {
      const mockData = generateTestRawData(2);
      const mockImporter = testEnvironment.createMockImporter('TestImporter', { mockData });
      const mockExporter = testEnvironment.createMockExporter('ErrorExporter', {
        shouldThrowError: true
      });
      
      pipeline = new DataPipeline(mockImporter, mockExporter);
      
      const options: ProcessingOptions = {
        inputFile: 'test-data.json',
        dryRun: false,
        generateReport: false
      };
      
      // Expect the pipeline to throw an error when exporter fails
      await expect(pipeline.process(mockData, options)).rejects.toThrow('Mock configuration error');
    }); orchestrates
 * importer → exporter workflows.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { DataPipeline } from '../lib/data-pipeline.js';
import { testEnvironment, generateTestRawData } from './test-utils.js';
import type { ProcessingOptions } from '../types/plugin.js';

describe('DataPipeline', () => {
  let pipeline: DataPipeline;

  beforeEach(() => {
    testEnvironment.clearAll();
  });

  describe('Pipeline Execution', () => {
    test('should execute importer → exporter workflow successfully', async () => {
      // Setup plugins
      const mockData = generateTestRawData(3);
      const mockImporter = testEnvironment.createMockImporter('TestImporter', { mockData });
      const mockExporter = testEnvironment.createMockExporter('TestExporter');

      pipeline = new DataPipeline(mockImporter, mockExporter);

      const options: ProcessingOptions = {
        inputFile: 'test-data.json',
        dryRun: false,
        batchSize: 10,
        generateReport: true,
      };

      // Execute pipeline with mock data source
      const result = await pipeline.process({}, options);

      // Verify results
      expect(result.importedCount).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.exportResult).toBeDefined();

      // Verify data was passed through correctly
      const exportedData = mockExporter.getExportedData();
      expect(exportedData).toHaveLength(3);
      expect(exportedData[0].title).toBe('Test Artwork 1');
    });

    test('should handle importer errors gracefully', async () => {
      const mockImporter = testEnvironment.createMockImporter('ErrorImporter', {
        shouldThrowError: true,
      });
      const mockExporter = testEnvironment.createMockExporter('TestExporter');

      pipeline = new DataPipeline(mockImporter, mockExporter);

      const options: ProcessingOptions = {
        inputFile: 'test-data.json',
        dryRun: false,
        generateReport: false,
      };

      // Expect the pipeline to throw an error when importer fails
      await expect(pipeline.process({}, options)).rejects.toThrow('Mock importer error');
    });

    test('should handle exporter errors gracefully', async () => {
      const mockData = generateTestRawData(2);
      const mockImporter = testEnvironment.createMockImporter('TestImporter', { mockData });
      const mockExporter = testEnvironment.createMockExporter('ErrorExporter', {
        shouldThrowError: true,
      });

      pipeline = new DataPipeline(mockImporter, mockExporter);

      const options: ProcessingOptions = {
        inputFile: 'test-data.json',
        dryRun: false,
        generateReport: false,
      };

      // Expect the pipeline to throw an error when exporter fails
      await expect(pipeline.process(mockData, options)).rejects.toThrow('Mock configuration error');
    });
  });

  describe('Data Validation', () => {
    test('should validate data through pipeline', async () => {
      const mockData = generateTestRawData(2);
      const mockImporter = testEnvironment.createMockImporter('ValidatingImporter', { mockData });
      const mockExporter = testEnvironment.createMockExporter('TestExporter');

      pipeline = new DataPipeline(mockImporter, mockExporter);

      const options: ProcessingOptions = {
        inputFile: 'test-data.json',
        dryRun: false,
        generateReport: false,
      };

      const result = await pipeline.process({}, options);

      expect(result.importedCount).toBe(2);
      expect(result.summary).toBeDefined();
    });

    test('should handle validation failures', async () => {
      const mockImporter = testEnvironment.createMockImporter('FailingImporter', {
        shouldFailValidation: true,
      });
      const mockExporter = testEnvironment.createMockExporter('TestExporter');

      pipeline = new DataPipeline(mockImporter, mockExporter);

      const options: ProcessingOptions = {
        inputFile: 'test-data.json',
        dryRun: false,
        generateReport: false,
      };

      // Expect the pipeline to throw an error when validation fails
      await expect(pipeline.process({}, options)).rejects.toThrow('Input data validation failed');
    });
  });

  describe('Configuration Handling', () => {
    test('should handle dry run mode', async () => {
      const mockData = generateTestRawData(1);
      const mockImporter = testEnvironment.createMockImporter('DryRunImporter', { mockData });
      const mockExporter = testEnvironment.createMockExporter('DryRunExporter');

      pipeline = new DataPipeline(mockImporter, mockExporter);

      const options: ProcessingOptions = {
        inputFile: 'test-data.json',
        dryRun: true,
        generateReport: false,
      };

      const result = await pipeline.process({}, options);

      expect(result.importedCount).toBe(1);
      expect(result.summary).toBeDefined();
    });
  });

  describe('Batch Processing', () => {
    test('should process datasets with specified batch size', async () => {
      const mockData = generateTestRawData(25); // Larger dataset
      const mockImporter = testEnvironment.createMockImporter('BatchImporter', { mockData });
      const mockExporter = testEnvironment.createMockExporter('BatchExporter');

      pipeline = new DataPipeline(mockImporter, mockExporter);

      const options: ProcessingOptions = {
        inputFile: 'test-data.json',
        dryRun: false,
        batchSize: 10,
        generateReport: false,
      };

      const result = await pipeline.process({}, options);

      expect(result.importedCount).toBe(25);
      expect(result.summary).toBeDefined();

      // All data should have been exported despite batching
      const exportedData = mockExporter.getExportedData();
      expect(exportedData).toHaveLength(25);
    });
  });

  describe('Progress Tracking', () => {
    test('should provide detailed execution results', async () => {
      const mockData = generateTestRawData(3);
      const mockImporter = testEnvironment.createMockImporter('ProgressImporter', { mockData });
      const mockExporter = testEnvironment.createMockExporter('ProgressExporter');

      pipeline = new DataPipeline(mockImporter, mockExporter);

      const options: ProcessingOptions = {
        inputFile: 'test-data.json',
        dryRun: false,
        generateReport: true,
      };

      const result = await pipeline.process({}, options);

      expect(result.importedCount).toBe(3);
      expect(result.summary).toBeDefined();
      expect(result.exportResult).toBeDefined();
    });
  });
});
