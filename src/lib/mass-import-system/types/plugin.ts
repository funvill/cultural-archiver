/**
 * Mass Import Plugin System - Plugin Interfaces and Types
 *
 * This module defines the standardized interfaces for importer and exporter plugins
 * in the modular mass import system.
 */

import type { RawImportData, ValidationResult } from './index.js';

// ================================
// Common Plugin Types
// ================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

export interface PluginMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
  supportedFormats: string[];
  requiredFields: string[];
  optionalFields: string[];
}

// ================================
// Importer Plugin Interface
// ================================

export interface ImporterConfig {
  // Generic configuration that can be extended by specific importers
  [key: string]: unknown;
}

export interface ImporterPlugin {
  // Plugin metadata
  name: string;
  description: string;
  metadata: PluginMetadata;

  // Configuration schema for validation
  configSchema: object;

  // Core plugin methods
  mapData(sourceData: unknown, config: ImporterConfig): Promise<RawImportData[]>;
  validateData(sourceData: unknown): Promise<ValidationResult>;
  generateImportId(record: unknown): string;

  // Optional methods
  getDefaultDataPath?(): string;

  // Plugin capabilities
  supportedFormats: string[];
  requiredFields: string[];
  optionalFields: string[];
}

// ================================
// Exporter Plugin Interface
// ================================

export interface ExporterConfig {
  // Common exporter configuration
  outputPath?: string;
  apiEndpoint?: string;
  batchSize?: number;
  dryRun?: boolean;
  [key: string]: unknown;
}

export interface ExporterOptions {
  verbose?: boolean;
  reportPath?: string;
  [key: string]: unknown;
}

export interface ExportResult {
  success: boolean;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  recordsSkipped: number;
  recordsDuplicate?: number; // New field for tracking duplicate records
  errors?: ValidationError[];
  summary?: string;
  details?: ExportResultDetails;
}

export interface ExportResultDetails {
  processedRecords: ExportRecordResult[];
  timing: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  configuration: ExporterConfig;
}

export interface ExportRecordResult {
  externalId: string;
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
  error?: string;
  recordData?: RawImportData;
  duplicateInfo?: Record<string, unknown>;
}

export interface ExporterPlugin {
  // Plugin metadata
  name: string;
  description: string;
  metadata: PluginMetadata;

  // Core plugin methods
  export(data: RawImportData[], config: ExporterConfig): Promise<ExportResult>;
  configure(options: ExporterOptions): Promise<void>;
  validate(config: ExporterConfig): Promise<ValidationResult>;

  // Plugin capabilities
  supportedFormats: string[];
  requiresNetwork: boolean;
  outputType: 'file' | 'api' | 'stream' | 'console';
}

// ================================
// Plugin Registry Types
// ================================

export interface PluginRegistryEntry<T extends ImporterPlugin | ExporterPlugin> {
  name: string;
  plugin: T;
  configPath?: string;
  isValid: boolean;
  validationErrors?: ValidationError[];
}

export interface PluginValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ================================
// Data Pipeline Types
// ================================

export interface ProcessingOptions {
  generateReport?: boolean;
  reportPath?: string;
  verbose?: boolean;
  dryRun?: boolean;
  batchSize?: number;
  limit?: number;
  offset?: number;
  inputFile?: string;
  importerConfig?: ImporterConfig;
  exporterOptions?: ExporterOptions;
  exporterConfig?: ExporterConfig;
  // Maximum consecutive errors before aborting (default: 5)
  maxConsecutiveErrors?: number;
  // Location enhancement options
  locationEnhancement?: {
    enabled?: boolean;
    cacheDbPath?: string;
    requestTimeout?: number;
    failOnErrors?: boolean;
    tagFields?: {
      displayName?: string;
      country?: string;
      state?: string;
      city?: string;
      suburb?: string;
      neighbourhood?: string;
    };
  };
}

export interface PipelineResult {
  importedCount: number;
  exportResult: ExportResult;
  summary: ProcessingSummary;
  report?: ProcessingReport;
}

export interface ProcessingSummary {
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  skippedRecords: number;
  duplicateRecords?: number; // New field for tracking duplicate records
  processingTime: number;
  averageRecordTime: number;
}

// ================================
// Reporting System Types
// ================================

export interface ReportRecord {
  id: string;
  externalId: string;
  status: 'successful' | 'failed' | 'skipped' | 'other';
  reason?: string;
  error?: unknown;
  data?: RawImportData;
  timestamp: string;
  processingTime?: number;
  duplicateInfo?: {
    type: 'artwork' | 'artist';
    existingId: string;
    existingTitle?: string;
    confidenceScore?: number;
    scoreBreakdown?: {
      gps?: number;
      title?: number;
      artist?: number;
      referenceIds?: number;
      tagSimilarity?: number;
      total?: number;
    };
    reason?: string;
  };
}

export interface ReportSummary {
  totalRecords: number;
  successful: number;
  failed: number;
  skipped: number;
  other: number;
  duplicateRecords?: number; // Track duplicate records detected during export
  successRate: number;
  processingTime: number;
  averageRecordTime: number;
}

export interface ReportMetadata {
  operation: {
    importer: string;
    exporter: string;
    inputFile: string;
    startTime: string;
    endTime: string;
    duration: number;
  };
  parameters: {
    cliFlags: string[];
    importerConfig: object;
    exporterConfig: object;
    batchSize?: number;
    dryRun?: boolean;
  };
  environment: {
    nodeVersion: string;
    platform: string;
    timestamp: string;
  };
}

export interface ProcessingReport {
  metadata: ReportMetadata;
  summary: ReportSummary;
  records: ReportRecord[];
  errors: ReportError[];
}

export interface ReportError {
  type: 'validation' | 'processing' | 'export' | 'system';
  message: string;
  details?: unknown;
  timestamp: string;
}

// ================================
// Unified Import Data (Enhanced)
// ================================

export type UnifiedImportData = RawImportData;

// ================================
// Plugin Template Types
// ================================

export interface PluginTemplate {
  name: string;
  description: string;
  type: 'importer' | 'exporter';
  template: 'basic' | 'advanced' | 'api' | 'file';
  files: PluginTemplateFile[];
}

export interface PluginTemplateFile {
  path: string;
  content: string;
  isConfig?: boolean;
}
