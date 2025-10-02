/**
 * Test Suite for Plugin Registry
 *
 * Tests the plugin discovery, validation, and registration functionality.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../lib/plugin-registry.js';
import { testEnvironment, assertPluginInterface } from './test-utils.js';
import type { ImporterPlugin /*, ExporterPlugin */ } from '../types/plugin.js';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
    testEnvironment.clearAll();
  });

  describe('Plugin Registration', () => {
    test('should register valid importer plugin', () => {
      const mockImporter = testEnvironment.createMockImporter('TestImporter');

      // Registration should not throw
      expect(() => {
        registry.registerImporter(mockImporter);
      }).not.toThrow();

      expect(registry.getImporter('TestImporter')).toBe(mockImporter);
    });

    test('should register valid exporter plugin', () => {
      const mockExporter = testEnvironment.createMockExporter('TestExporter');

      // Registration should not throw
      expect(() => {
        registry.registerExporter(mockExporter);
      }).not.toThrow();

      expect(registry.getExporter('TestExporter')).toBe(mockExporter);
    });

    test('should handle invalid plugin gracefully', () => {
      const invalidPlugin = { name: 'Invalid' } as unknown as ImporterPlugin;

      // Should not throw during registration, but plugin won't be retrievable
      expect(() => {
        registry.registerImporter(invalidPlugin);
      }).not.toThrow();

      // Plugin should not be retrievable due to validation failure
      expect(registry.getImporter('Invalid')).toBeUndefined();
    });

    test('should prevent duplicate plugin registration by overwriting', () => {
      const mockImporter1 = testEnvironment.createMockImporter('Duplicate');
      const mockImporter2 = testEnvironment.createMockImporter('Duplicate');

      registry.registerImporter(mockImporter1);
      registry.registerImporter(mockImporter2); // Should overwrite

      expect(registry.getImporter('Duplicate')).toBe(mockImporter2);
    });
  });

  describe('Plugin Discovery', () => {
    test('should list all registered importers', () => {
      const importer1 = testEnvironment.createMockImporter('Importer1');
      const importer2 = testEnvironment.createMockImporter('Importer2');

      registry.registerImporter(importer1);
      registry.registerImporter(importer2);

      const importers = registry.getAllImporters();
      expect(importers).toHaveLength(2);
      expect(importers.map(i => i.name)).toContain('Importer1');
      expect(importers.map(i => i.name)).toContain('Importer2');
    });

    test('should list all registered exporters', () => {
      const exporter1 = testEnvironment.createMockExporter('Exporter1');
      const exporter2 = testEnvironment.createMockExporter('Exporter2');

      registry.registerExporter(exporter1);
      registry.registerExporter(exporter2);

      const exporters = registry.getAllExporters();
      expect(exporters).toHaveLength(2);
      expect(exporters.map(e => e.name)).toContain('Exporter1');
      expect(exporters.map(e => e.name)).toContain('Exporter2');
    });

    test('should return empty arrays when no plugins registered', () => {
      expect(registry.getAllImporters()).toHaveLength(0);
      expect(registry.getAllExporters()).toHaveLength(0);
    });

    test('should list plugin names', () => {
      const importer1 = testEnvironment.createMockImporter('TestImporter');
      const exporter1 = testEnvironment.createMockExporter('TestExporter');

      registry.registerImporter(importer1);
      registry.registerExporter(exporter1);

      expect(registry.listImporters()).toContain('TestImporter');
      expect(registry.listExporters()).toContain('TestExporter');
    });
  });

  describe('Plugin Validation', () => {
    test('should validate plugin interfaces correctly', () => {
      const mockImporter = testEnvironment.createMockImporter('ValidImporter');
      const mockExporter = testEnvironment.createMockExporter('ValidExporter');

      expect(() => assertPluginInterface(mockImporter)).not.toThrow();
      expect(() => assertPluginInterface(mockExporter)).not.toThrow();
    });

    test('should detect missing required methods', () => {
      const incompleteImporter = {
        name: 'Incomplete',
        description: 'Missing methods',
        metadata: {
          name: 'Incomplete',
          description: 'Missing methods',
          version: '1.0.0',
          author: 'Test',
          supportedFormats: ['json'],
          requiredFields: [],
          optionalFields: [],
        },
        configSchema: {},
        requiredFields: [],
        optionalFields: [],
        // Missing mapData and validateData methods but has importer-specific properties
      } as unknown as ImporterPlugin;

      expect(() => assertPluginInterface(incompleteImporter)).toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle plugin execution errors gracefully', () => {
      const errorImporter = testEnvironment.createMockImporter('ErrorImporter', {
        shouldThrowError: true,
      });

      // Plugin registration should succeed even if plugin might error during execution
      expect(() => {
        registry.registerImporter(errorImporter);
      }).not.toThrow();

      // Plugin should still be registered (errors happen during execution, not registration)
      expect(registry.getImporter('ErrorImporter')).toBe(errorImporter);
    });

    test('should provide helpful error messages for invalid plugins', () => {
      const invalidPlugin = { name: '' } as unknown as ImporterPlugin;

      expect(() => {
        assertPluginInterface(invalidPlugin);
      }).toThrow(/Plugin must have/);
    });
  });
});
