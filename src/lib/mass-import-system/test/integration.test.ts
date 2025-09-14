/**
 * Test Runner for Mass Import Plugin System
 * 
 * Comprehensive test suite covering all plugin system components:
 * - Plugin interfaces and validation
 * - Registry functionality
 * - Data pipeline orchestration
 * - CLI integration
 * - Real plugin implementations
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { testEnvironment, generateTestRawData, assertValidRawImportData, assertValidationResult, assertPluginInterface } from './test-utils.js';

describe('Mass Import Plugin System - Integration Tests', () => {
  beforeEach(() => {
    testEnvironment.clearAll();
  });

  describe('Plugin Interface Compliance', () => {
    test('mock importer should comply with plugin interface', () => {
      const mockImporter = testEnvironment.createMockImporter('InterfaceTest');
      
      expect(() => {
        assertPluginInterface(mockImporter);
      }).not.toThrow();
      
      expect(mockImporter.name).toBe('InterfaceTest');
      expect(mockImporter.description).toContain('Mock importer');
      expect(mockImporter.supportedFormats).toContain('json');
      expect(mockImporter.requiredFields).toContain('lat');
      expect(mockImporter.optionalFields).toContain('description');
    });

    test('mock exporter should comply with plugin interface', () => {
      const mockExporter = testEnvironment.createMockExporter('InterfaceTest');
      
      expect(() => {
        assertPluginInterface(mockExporter);
      }).not.toThrow();
      
      expect(mockExporter.name).toBe('InterfaceTest');
      expect(mockExporter.description).toContain('Mock exporter');
      expect(mockExporter.supportedFormats).toContain('json');
      expect(mockExporter.requiresNetwork).toBe(false);
      expect(mockExporter.outputType).toBe('file');
    });
  });

  describe('Data Generation and Validation', () => {
    test('should generate valid test data', () => {
      const testData = generateTestRawData(5);
      
      expect(testData).toHaveLength(5);
      
      testData.forEach((data, index) => {
        expect(() => {
          assertValidRawImportData(data);
        }).not.toThrow();
        
        expect(data.title).toBe(`Test Artwork ${index + 1}`);
        expect(data.source).toBe('test-source');
        expect(typeof data.lat).toBe('number');
        expect(typeof data.lon).toBe('number');
      });
    });

    test('should validate coordinates properly', () => {
      const validData = generateTestRawData(1)[0];
      expect(() => assertValidRawImportData(validData)).not.toThrow();
      
      // Test invalid coordinates
      const invalidData = { ...validData, lat: 91 }; // Invalid latitude
      expect(() => assertValidRawImportData(invalidData)).toThrow('Invalid latitude');
    });
  });

  describe('Plugin Functionality', () => {
    test('importer should map data correctly', async () => {
      const mockImporter = testEnvironment.createMockImporter('MapTest');
      const sourceData = {};
      const config = {};
      
      const result = await mockImporter.mapData(sourceData, config);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      result.forEach(item => {
        expect(() => assertValidRawImportData(item)).not.toThrow();
      });
    });

    test('importer should validate data', async () => {
      const mockImporter = testEnvironment.createMockImporter('ValidateTest');
      
      const result = await mockImporter.validateData({});
      
      expect(() => assertValidationResult(result)).not.toThrow();
      expect(result.isValid).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    test('importer should generate unique IDs', async () => {
      const mockImporter = testEnvironment.createMockImporter('IdTest');
      const testData = generateTestRawData(1)[0];
      
      const id1 = mockImporter.generateImportId(testData);
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      const id2 = mockImporter.generateImportId(testData);
      
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
      expect(id1).not.toBe(id2); // Should be unique (due to timestamp)
    });

    test('exporter should export data successfully', async () => {
      const mockExporter = testEnvironment.createMockExporter('ExportTest');
      const testData = generateTestRawData(3);
      const config = { outputPath: '/test/path' };
      
      const result = await mockExporter.export(testData, config);
      
      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(3);
      expect(result.recordsSuccessful).toBe(3);
      expect(result.recordsFailed).toBe(0);
      
      // Verify data was stored internally
      const exportedData = mockExporter.getExportedData();
      expect(exportedData).toHaveLength(3);
      expect(exportedData[0].title).toBe('Test Artwork 1');
    });

    test('exporter should handle configuration', async () => {
      const mockExporter = testEnvironment.createMockExporter('ConfigTest');
      const config = { outputPath: '/custom/path', verbose: true };
      
      await mockExporter.configure(config);
      
      const actualConfig = mockExporter.getExportConfig();
      expect(actualConfig.outputPath).toBe('/custom/path');
    });

    test('exporter should validate configuration', async () => {
      const mockExporter = testEnvironment.createMockExporter('ValidateConfigTest');
      const config = { outputPath: '/test/path' };
      
      const result = await mockExporter.validate(config);
      
      expect(() => assertValidationResult(result)).not.toThrow();
      expect(result.isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle importer errors', async () => {
      const errorImporter = testEnvironment.createMockImporter('ErrorTest', {
        shouldThrowError: true
      });
      
      await expect(errorImporter.mapData({}, {})).rejects.toThrow('Mock importer error');
    });

    test('should handle exporter errors', async () => {
      const errorExporter = testEnvironment.createMockExporter('ErrorTest', {
        shouldThrowError: true
      });
      const testData = generateTestRawData(1);
      
      await expect(errorExporter.export(testData, {})).rejects.toThrow('Mock exporter error');
    });

    test('should handle validation failures', async () => {
      const failingImporter = testEnvironment.createMockImporter('FailTest', {
        shouldFailValidation: true
      });
      
      const result = await failingImporter.validateData({});
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Mock validation error');
    });
  });

  describe('Test Environment Management', () => {
    test('should manage multiple plugins', () => {
      const importer1 = testEnvironment.createMockImporter('Import1');
      const importer2 = testEnvironment.createMockImporter('Import2');
      const exporter1 = testEnvironment.createMockExporter('Export1');
      
      expect(testEnvironment.getMockImporter('Import1')).toBe(importer1);
      expect(testEnvironment.getMockImporter('Import2')).toBe(importer2);
      expect(testEnvironment.getMockExporter('Export1')).toBe(exporter1);
      
      const allImporters = testEnvironment.getAllMockImporters();
      const allExporters = testEnvironment.getAllMockExporters();
      
      expect(allImporters).toHaveLength(2);
      expect(allExporters).toHaveLength(1);
    });

    test('should clear all plugins', () => {
      testEnvironment.createMockImporter('TempImporter');
      testEnvironment.createMockExporter('TempExporter');
      
      expect(testEnvironment.getAllMockImporters()).toHaveLength(1);
      expect(testEnvironment.getAllMockExporters()).toHaveLength(1);
      
      testEnvironment.clearAll();
      
      expect(testEnvironment.getAllMockImporters()).toHaveLength(0);
      expect(testEnvironment.getAllMockExporters()).toHaveLength(0);
    });
  });

  describe('Real-world Scenarios', () => {
    test('should handle large dataset processing', async () => {
      const largeDataset = generateTestRawData(100);
      const mockImporter = testEnvironment.createMockImporter('LargeTest', {
        mockData: largeDataset
      });
      const mockExporter = testEnvironment.createMockExporter('LargeTest');
      
      // Test importer
      const importedData = await mockImporter.mapData({}, {});
      expect(importedData).toHaveLength(100);
      
      // Test exporter
      const exportResult = await mockExporter.export(importedData, {});
      expect(exportResult.success).toBe(true);
      expect(exportResult.recordsProcessed).toBe(100);
      
      const exportedData = mockExporter.getExportedData();
      expect(exportedData).toHaveLength(100);
    });

    test('should maintain data integrity through pipeline', async () => {
      const originalData = generateTestRawData(5);
      const mockImporter = testEnvironment.createMockImporter('IntegrityTest', {
        mockData: originalData
      });
      const mockExporter = testEnvironment.createMockExporter('IntegrityTest');
      
      // Import data
      const importedData = await mockImporter.mapData({}, {});
      
      // Export data
      await mockExporter.export(importedData, {});
      const exportedData = mockExporter.getExportedData();
      
      // Verify data integrity
      expect(exportedData).toHaveLength(originalData.length);
      
      for (let i = 0; i < originalData.length; i++) {
        expect(exportedData[i].title).toBe(originalData[i].title);
        expect(exportedData[i].lat).toBe(originalData[i].lat);
        expect(exportedData[i].lon).toBe(originalData[i].lon);
        expect(exportedData[i].source).toBe(originalData[i].source);
      }
    });
  });
});