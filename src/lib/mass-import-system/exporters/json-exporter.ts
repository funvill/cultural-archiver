/**
 * Mass Import Plugin System - JSON File Exporter
 *
 * This plugin exports unified data to JSON files with configurable formatting,
 * batch processing, and comprehensive error handling.
 */

import type { ExporterPlugin, ExporterConfig, ExportResult } from '../types/plugin.js';
import type { RawImportData, ValidationResult } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// ================================
// JSON Exporter Configuration
// ================================

export interface JsonExporterConfig extends ExporterConfig {
  outputPath: string;
  format?: 'array' | 'lines' | 'pretty'; // JSON format style
  indent?: number; // Indentation for pretty formatting
  splitFiles?: boolean; // Split into multiple files
  recordsPerFile?: number; // Records per file when splitting
  includeMetadata?: boolean; // Include export metadata
  compression?: boolean; // Enable gzip compression
}

export interface JsonExporterOptions {
  validateSchema?: boolean;
  backupExisting?: boolean;
  createDirectories?: boolean;
}

// ================================
// JSON File Exporter Plugin
// ================================

export class JsonExporter implements ExporterPlugin {
  name = 'json';
  description = 'Export data to JSON files with configurable formatting and batch processing';

  metadata = {
    name: 'json',
    description: 'Export data to JSON files with configurable formatting and batch processing',
    version: '1.0.0',
    author: 'Cultural Archiver',
    supportedFormats: ['array', 'lines', 'pretty'],
    requiredFields: ['outputPath'],
    optionalFields: [
      'format',
      'indent',
      'splitFiles',
      'recordsPerFile',
      'includeMetadata',
      'compression',
    ],
  };

  supportedFormats = ['array', 'lines', 'pretty'];
  requiresNetwork = false;
  outputType = 'file' as const;

  private config: JsonExporterConfig | null = null;
  private options: JsonExporterOptions = {};

  // ================================
  // Plugin Interface Implementation
  // ================================

  async configure(options: Record<string, unknown>): Promise<void> {
    this.options = {
      validateSchema: true,
      backupExisting: false,
      createDirectories: true,
      ...options,
    } as JsonExporterOptions;

    console.log(`🔧 JSON Exporter configured:`, this.options);
  }

  async validate(config: ExporterConfig): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      const jsonConfig = config as JsonExporterConfig;

      // Validate required fields
      if (!jsonConfig.outputPath) {
        errors.push('outputPath is required');
      }

      // Validate output path format
      if (jsonConfig.outputPath && !jsonConfig.outputPath.endsWith('.json')) {
        errors.push('outputPath must end with .json extension');
      }

      // Validate format option
      if (jsonConfig.format && !['array', 'lines', 'pretty'].includes(jsonConfig.format)) {
        errors.push('format must be one of: array, lines, pretty');
      }

      // Validate indent
      if (jsonConfig.indent !== undefined && (jsonConfig.indent < 0 || jsonConfig.indent > 10)) {
        errors.push('indent must be between 0 and 10');
      }

      // Validate split configuration
      if (jsonConfig.splitFiles && jsonConfig.recordsPerFile && jsonConfig.recordsPerFile < 1) {
        errors.push('recordsPerFile must be greater than 0 when splitFiles is enabled');
      }

      // Check if output directory exists (if creating directories is disabled)
      if (!this.options.createDirectories && jsonConfig.outputPath) {
        const outputDir = path.dirname(jsonConfig.outputPath);
        try {
          await fs.access(outputDir);
        } catch {
          errors.push(`Output directory does not exist: ${outputDir}`);
        }
      }
    } catch (error) {
      errors.push(
        `Configuration validation error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors: errors.map(error => ({
        field: 'config',
        message: error,
        severity: 'error' as const,
      })),
      warnings: [],
    };
  }

  async export(data: RawImportData[], config: ExporterConfig): Promise<ExportResult> {
    const startTime = Date.now();

    try {
      this.config = config as JsonExporterConfig;

      // Validate configuration
      const validation = await this.validate(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors?.join(', ')}`);
      }

      console.log(`📤 Starting JSON export of ${data.length} records...`);

      // Prepare output directory
      await this.prepareOutputDirectory();

      // Backup existing file if requested
      if (this.options.backupExisting) {
        await this.backupExistingFile();
      }

      // Export data based on configuration
      let exportResult: ExportResult;

      if (this.config.splitFiles) {
        exportResult = await this.exportSplitFiles(data);
      } else {
        exportResult = await this.exportSingleFile(data);
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ JSON export completed in ${processingTime}ms`);

      return {
        ...exportResult,
        summary: `${exportResult.summary} (${processingTime}ms)`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'JSON export failed';
      console.error(`❌ JSON export failed:`, error);

      return {
        success: false,
        recordsProcessed: data.length,
        recordsSuccessful: 0,
        recordsFailed: data.length,
        recordsSkipped: 0,
        recordsDuplicate: 0,
        errors: [{ field: 'export', message: errorMessage, severity: 'error' }],
        summary: `JSON export failed: ${errorMessage}`,
      };
    }
  }

  // ================================
  // Export Implementation Methods
  // ================================

  private async prepareOutputDirectory(): Promise<void> {
    if (!this.config?.outputPath) return;

    if (this.options.createDirectories) {
      const outputDir = path.dirname(this.config.outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }
  }

  private async backupExistingFile(): Promise<void> {
    if (!this.config?.outputPath) return;

    try {
      await fs.access(this.config.outputPath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = this.config.outputPath.replace('.json', `_backup_${timestamp}.json`);
      await fs.copyFile(this.config.outputPath, backupPath);
      console.log(`💾 Backed up existing file to: ${backupPath}`);
    } catch {
      // File doesn't exist, no backup needed
    }
  }

  private async exportSingleFile(data: RawImportData[]): Promise<ExportResult> {
    if (!this.config?.outputPath) {
      throw new Error('Output path not configured');
    }

    try {
      // Format data based on configuration
      const formattedData = await this.formatData(data);

      // Write to file
      await fs.writeFile(this.config.outputPath, formattedData, 'utf-8');

      console.log(`💾 Exported ${data.length} records to: ${this.config.outputPath}`);

      return {
        success: true,
        recordsProcessed: data.length,
        recordsSuccessful: data.length,
        recordsFailed: 0,
        recordsSkipped: 0,
        recordsDuplicate: 0,
        summary: `Successfully exported ${data.length} records to JSON file: ${this.config.outputPath}`,
      };
    } catch (error) {
      throw new Error(
        `Failed to write JSON file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async exportSplitFiles(data: RawImportData[]): Promise<ExportResult> {
    if (!this.config?.outputPath || !this.config.recordsPerFile) {
      throw new Error('Split file configuration incomplete');
    }

    const recordsPerFile = this.config.recordsPerFile;
    const totalFiles = Math.ceil(data.length / recordsPerFile);
    const outputFiles: string[] = [];

    for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
      const startIndex = fileIndex * recordsPerFile;
      const endIndex = Math.min(startIndex + recordsPerFile, data.length);
      const fileData = data.slice(startIndex, endIndex);

      // Generate file path with index
      const fileExtension = path.extname(this.config.outputPath);
      const baseName = path.basename(this.config.outputPath, fileExtension);
      const dirName = path.dirname(this.config.outputPath);
      const fileName = `${baseName}_part${fileIndex + 1}${fileExtension}`;
      const filePath = path.join(dirName, fileName);

      // Format and write file data
      const formattedData = await this.formatData(fileData);
      await fs.writeFile(filePath, formattedData, 'utf-8');

      outputFiles.push(filePath);

      console.log(`💾 Exported ${fileData.length} records to: ${filePath}`);
    }

    return {
      success: true,
      recordsProcessed: data.length,
      recordsSuccessful: data.length,
      recordsFailed: 0,
      recordsSkipped: 0,
      recordsDuplicate: 0,
      summary: `Successfully exported ${data.length} records to ${totalFiles} JSON files in ${path.dirname(this.config.outputPath)}`,
    };
  }

  private async formatData(data: RawImportData[]): Promise<string> {
    const format = this.config?.format ?? 'pretty';
    const indent = this.config?.indent ?? 2;
    const includeMetadata = this.config?.includeMetadata ?? false;

    let outputData: unknown = data;

    // Add metadata if requested
    if (includeMetadata) {
      outputData = {
        metadata: {
          exportTime: new Date().toISOString(),
          recordCount: data.length,
          exporter: this.name,
          version: this.metadata.version,
        },
        data,
      };
    }

    // Format based on style
    switch (format) {
      case 'array':
        return JSON.stringify(outputData);

      case 'lines':
        if (Array.isArray(outputData)) {
          return outputData.map(record => JSON.stringify(record)).join('\n');
        } else {
          return JSON.stringify(outputData);
        }

      case 'pretty':
      default:
        return JSON.stringify(outputData, null, indent);
    }
  }

  // ================================
  // Utility Methods
  // ================================

  getCapabilities(): string[] {
    return [
      'batch-processing',
      'file-splitting',
      'format-options',
      'compression',
      'backup',
      'metadata-inclusion',
    ];
  }

  getSupportedFormats(): string[] {
    return ['array', 'lines', 'pretty'];
  }
}
