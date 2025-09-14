/**
 * Test Utilities for Mass Import Plugin System
 * 
 * Provides utilities for mocking plugins, creating test data,
 * and validating plugin behavior across the system.
 */

import type { ImporterPlugin, ExporterPlugin, ImporterConfig, ExporterConfig, ExportResult, PluginMetadata } from '../types/plugin.js';
import type { RawImportData, ValidationResult } from '../types/index.js';

// ================================
// Mock Plugin Implementations
// ================================

export class MockImporterPlugin implements ImporterPlugin {
  public readonly name: string;
  public readonly description: string;
  public readonly metadata: PluginMetadata;
  public readonly configSchema: object;
  public readonly supportedFormats: string[];
  public readonly requiredFields: string[];
  public readonly optionalFields: string[];

  private mockData: RawImportData[];
  private shouldFailValidation: boolean;
  private shouldThrowError: boolean;

  constructor(
    name = 'MockImporter',
    options: {
      mockData?: RawImportData[];
      shouldFailValidation?: boolean;
      shouldThrowError?: boolean;
      version?: string;
      description?: string;
      supportedFormats?: string[];
    } = {}
  ) {
    this.name = name;
    this.description = options.description || 'Mock importer for testing';
    this.supportedFormats = options.supportedFormats || ['json'];
    this.requiredFields = ['lat', 'lon', 'title', 'source'];
    this.optionalFields = ['description', 'artist', 'photos'];
    this.configSchema = {};
    
    this.metadata = {
      name: this.name,
      description: this.description,
      version: options.version || '1.0.0',
      author: 'Test Framework',
      supportedFormats: this.supportedFormats,
      requiredFields: this.requiredFields,
      optionalFields: this.optionalFields
    };

    this.mockData = options.mockData || this.getDefaultMockData();
    this.shouldFailValidation = options.shouldFailValidation || false;
    this.shouldThrowError = options.shouldThrowError || false;
  }

  async mapData(_sourceData: unknown, _config: ImporterConfig): Promise<RawImportData[]> {
    if (this.shouldThrowError) {
      throw new Error('Mock importer error');
    }
    return this.mockData;
  }

  async validateData(_sourceData: unknown): Promise<ValidationResult> {
    if (this.shouldFailValidation) {
      return {
        isValid: false,
        errors: [
          { field: 'test', message: 'Mock validation error', severity: 'error' as const }
        ],
        warnings: [
          { field: 'test', message: 'Mock validation warning', severity: 'warning' as const }
        ]
      };
    }

    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  generateImportId(record: unknown): string {
    const data = record as RawImportData;
    return `mock-${data.title?.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
  }

  getDefaultDataPath(): string {
    return './test-data.json';
  }

  private getDefaultMockData(): RawImportData[] {
    return [
      {
        lat: 49.2827,
        lon: -123.1207,
        title: 'Mock Artwork 1',
        description: 'First mock artwork',
        source: 'test-source',
        artist: 'Test Artist',
        tags: { category: 'test', type: 'mock' }
      },
      {
        lat: 49.2845,
        lon: -123.1203,
        title: 'Mock Artwork 2',
        description: 'Second mock artwork',
        source: 'test-source',
        artist: 'Test Artist 2',
        tags: { category: 'test', type: 'sculpture' }
      }
    ];
  }
}

export class MockExporterPlugin implements ExporterPlugin {
  public readonly name: string;
  public readonly description: string;
  public readonly metadata: PluginMetadata;
  public readonly supportedFormats: string[];
  public readonly requiresNetwork: boolean;
  public readonly outputType: 'file' | 'api' | 'stream' | 'console';

  private exportedData: RawImportData[] = [];
  private shouldThrowError: boolean;
  private exportConfig: ExporterConfig = {};

  constructor(
    name = 'MockExporter',
    options: {
      shouldThrowError?: boolean;
      version?: string;
      description?: string;
      supportedFormats?: string[];
      requiresNetwork?: boolean;
      outputType?: 'file' | 'api' | 'stream' | 'console';
    } = {}
  ) {
    this.name = name;
    this.description = options.description || 'Mock exporter for testing';
    this.supportedFormats = options.supportedFormats || ['json'];
    this.requiresNetwork = options.requiresNetwork || false;
    this.outputType = options.outputType || 'file';
    this.shouldThrowError = options.shouldThrowError || false;
    
    this.metadata = {
      name: this.name,
      description: this.description,
      version: options.version || '1.0.0',
      author: 'Test Framework',
      supportedFormats: this.supportedFormats,
      requiredFields: [],
      optionalFields: []
    };
  }

  async export(data: RawImportData[], config: ExporterConfig): Promise<ExportResult> {
    if (this.shouldThrowError) {
      throw new Error('Mock exporter error');
    }
    
    this.exportedData = [...data];
    this.exportConfig = config;

    return {
      success: true,
      recordsProcessed: data.length,
      recordsSuccessful: data.length,
      recordsFailed: 0,
      recordsSkipped: 0,
      summary: `Successfully exported ${data.length} records`,
      details: {
        processedRecords: data.map(record => ({
          externalId: record.externalId || 'unknown',
          status: 'success' as const,
          recordData: record
        })),
        timing: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 100
        },
        configuration: config
      }
    };
  }

  async configure(config: ExporterConfig): Promise<void> {
    if (this.shouldThrowError) {
      throw new Error('Mock configuration error');
    }
    this.exportConfig = config;
  }

  async validate(_config: ExporterConfig): Promise<ValidationResult> {
    if (this.shouldThrowError) {
      return {
        isValid: false,
        errors: [
          { field: 'config', message: 'Mock exporter validation error', severity: 'error' as const }
        ],
        warnings: []
      };
    }

    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  // Test helper methods
  getExportedData(): RawImportData[] {
    return [...this.exportedData];
  }

  getExportConfig(): ExporterConfig {
    return this.exportConfig;
  }

  clearExportedData(): void {
    this.exportedData = [];
  }
}

// ================================
// Test Data Generators
// ================================

export function generateTestRawData(count: number = 5): RawImportData[] {
  const rawData: RawImportData[] = [];
  
  for (let i = 1; i <= count; i++) {
    rawData.push({
      lat: 49.2827 + (Math.random() - 0.5) * 0.01,
      lon: -123.1207 + (Math.random() - 0.5) * 0.01,
      title: `Test Artwork ${i}`,
      description: `Description for test artwork ${i}`,
      source: 'test-source',
      externalId: `test-${i}`,
      artist: `Test Artist ${i}`,
      tags: { 
        category: 'test', 
        type: `artwork-${i}`,
        generated: true 
      }
    });
  }

  return rawData;
}

export function generateTestImporterConfig(): ImporterConfig {
  return {
    dataFile: './test-data.json',
    processingMode: 'sequential'
  };
}

export function generateTestExporterConfig(): ExporterConfig {
  return {
    outputPath: './test-output.json',
    batchSize: 10,
    dryRun: false
  };
}

// ================================
// Test Assertions
// ================================

export function assertValidRawImportData(data: RawImportData): void {
  if (typeof data.lat !== 'number' || typeof data.lon !== 'number') {
    throw new Error('Invalid coordinates format');
  }
  
  if (data.lat < -90 || data.lat > 90) {
    throw new Error('Invalid latitude value');
  }
  
  if (data.lon < -180 || data.lon > 180) {
    throw new Error('Invalid longitude value');
  }
  
  if (!data.title || typeof data.title !== 'string') {
    throw new Error('Title is required and must be a string');
  }
  
  if (!data.source || typeof data.source !== 'string') {
    throw new Error('Source is required and must be a string');
  }
  
  if (data.description && typeof data.description !== 'string') {
    throw new Error('Description must be a string');
  }
  
  if (data.tags && typeof data.tags !== 'object') {
    throw new Error('Tags must be an object');
  }
  
  if (data.photos && !Array.isArray(data.photos)) {
    throw new Error('Photos must be an array');
  }
}

export function assertValidationResult(result: ValidationResult): void {
  if (typeof result.isValid !== 'boolean') {
    throw new Error('ValidationResult.isValid must be boolean');
  }
  
  if (!Array.isArray(result.errors)) {
    throw new Error('ValidationResult.errors must be array');
  }
  
  if (!Array.isArray(result.warnings)) {
    throw new Error('ValidationResult.warnings must be array');
  }
  
  // Validate error structure
  result.errors.forEach((error, index) => {
    if (!error.field || typeof error.field !== 'string') {
      throw new Error(`Error ${index}: field is required and must be string`);
    }
    if (!error.message || typeof error.message !== 'string') {
      throw new Error(`Error ${index}: message is required and must be string`);
    }
    if (!error.severity || !['error', 'warning'].includes(error.severity)) {
      throw new Error(`Error ${index}: severity must be 'error' or 'warning'`);
    }
  });
}

export function assertPluginInterface(plugin: ImporterPlugin | ExporterPlugin): void {
  if (!plugin.name || typeof plugin.name !== 'string') {
    throw new Error('Plugin must have a string name');
  }
  
  if (!plugin.description || typeof plugin.description !== 'string') {
    throw new Error('Plugin must have a string description');
  }
  
  if (!plugin.metadata || typeof plugin.metadata !== 'object') {
    throw new Error('Plugin must have metadata object');
  }
  
  if (!Array.isArray(plugin.supportedFormats)) {
    throw new Error('Plugin must have supportedFormats array');
  }
  
  // Check importer-specific interface
  if ('mapData' in plugin) {
    const importerPlugin = plugin as ImporterPlugin;
    
    if (typeof importerPlugin.mapData !== 'function') {
      throw new Error('Importer must have mapData method');
    }
    
    if (typeof importerPlugin.validateData !== 'function') {
      throw new Error('Importer must have validateData method');
    }
    
    if (typeof importerPlugin.generateImportId !== 'function') {
      throw new Error('Importer must have generateImportId method');
    }
    
    if (!Array.isArray(importerPlugin.requiredFields)) {
      throw new Error('Importer must have requiredFields array');
    }
    
    if (!Array.isArray(importerPlugin.optionalFields)) {
      throw new Error('Importer must have optionalFields array');
    }
  }
  
  // Check exporter-specific interface
  if ('export' in plugin) {
    const exporterPlugin = plugin as ExporterPlugin;
    
    if (typeof exporterPlugin.export !== 'function') {
      throw new Error('Exporter must have export method');
    }
    
    if (typeof exporterPlugin.configure !== 'function') {
      throw new Error('Exporter must have configure method');
    }
    
    if (typeof exporterPlugin.validate !== 'function') {
      throw new Error('Exporter must have validate method');
    }
    
    if (typeof exporterPlugin.requiresNetwork !== 'boolean') {
      throw new Error('Exporter must have requiresNetwork boolean');
    }
    
    if (!['file', 'api', 'stream', 'console'].includes(exporterPlugin.outputType)) {
      throw new Error('Exporter must have valid outputType');
    }
  }
}

// ================================
// Test Environment Setup
// ================================

export class TestEnvironment {
  private mockImporters: Map<string, MockImporterPlugin> = new Map();
  private mockExporters: Map<string, MockExporterPlugin> = new Map();

  createMockImporter(name: string, options?: {
    mockData?: RawImportData[];
    shouldFailValidation?: boolean;
    shouldThrowError?: boolean;
    version?: string;
    description?: string;
    supportedFormats?: string[];
  }): MockImporterPlugin {
    const importer = new MockImporterPlugin(name, options);
    this.mockImporters.set(name, importer);
    return importer;
  }

  createMockExporter(name: string, options?: {
    shouldThrowError?: boolean;
    version?: string;
    description?: string;
    supportedFormats?: string[];
    requiresNetwork?: boolean;
    outputType?: 'file' | 'api' | 'stream' | 'console';
  }): MockExporterPlugin {
    const exporter = new MockExporterPlugin(name, options);
    this.mockExporters.set(name, exporter);
    return exporter;
  }

  getMockImporter(name: string): MockImporterPlugin | undefined {
    return this.mockImporters.get(name);
  }

  getMockExporter(name: string): MockExporterPlugin | undefined {
    return this.mockExporters.get(name);
  }

  clearAll(): void {
    this.mockImporters.clear();
    this.mockExporters.clear();
  }

  getAllMockImporters(): ImporterPlugin[] {
    return Array.from(this.mockImporters.values());
  }

  getAllMockExporters(): ExporterPlugin[] {
    return Array.from(this.mockExporters.values());
  }
}

export const testEnvironment = new TestEnvironment();