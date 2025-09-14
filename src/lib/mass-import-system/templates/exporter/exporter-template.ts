/**
 * {{PLUGIN_NAME}} Exporter Plugin Template
 * 
 * Description: {{PLUGIN_DESCRIPTION}}
 * Output Format: {{OUTPUT_FORMAT}}
 * Network Required: {{REQUIRES_NETWORK}}
 */

import type { 
  ExporterPlugin, 
  ExporterConfig, 
  ExporterOptions,
  PluginMetadata
} from '../types/plugin.js';
import type { RawImportData, ValidationResult, ValidationError } from '../types/index.js';

// ================================
// Plugin Configuration Interface
// ================================

export interface {{PLUGIN_CLASS_NAME}}Config extends ExporterConfig {
  // Add your specific configuration fields here
  outputPath?: string;
  // Example configuration fields:
  // apiEndpoint?: string;
  // formatOptions?: Record<string, unknown>;
  // batchSize?: number;
}

// ================================
// Export Result Interfaces
// ================================

interface {{PLUGIN_CLASS_NAME}}ExportResult {
  success: boolean;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  recordsSkipped: number;
  errors?: ValidationError[];
  summary?: string;
  outputLocation?: string;
}

// ================================
// Plugin Implementation
// ================================

export class {{PLUGIN_CLASS_NAME}} implements ExporterPlugin {
  // Plugin metadata
  name = '{{PLUGIN_KEBAB_NAME}}';
  description = '{{PLUGIN_DESCRIPTION}}';
  metadata: PluginMetadata = {
    name: '{{PLUGIN_KEBAB_NAME}}',
    description: '{{PLUGIN_DESCRIPTION}}',
    version: '1.0.0',
    author: '{{AUTHOR_NAME}}',
    supportedFormats: [{{SUPPORTED_FORMATS_ARRAY}}],
    requiredFields: [],
    optionalFields: []
  };

  // Plugin capabilities
  supportedFormats = [{{SUPPORTED_FORMATS_ARRAY}}];
  requiresNetwork = {{REQUIRES_NETWORK}};
  outputType: 'file' | 'api' | 'stream' | 'console' = '{{OUTPUT_TYPE}}';

  // ================================
  // Core Plugin Methods (Required)
  // ================================

  /**
   * Export processed data to destination
   */
  async export(data: RawImportData[], config: {{PLUGIN_CLASS_NAME}}Config): Promise<{{PLUGIN_CLASS_NAME}}ExportResult> {
    console.log(`🚀 Starting {{PLUGIN_NAME}} export with ${data.length} records...`);

    try {
      // Initialize export process
      await this.initializeExport(config);

      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      const errors: ValidationError[] = [];

      // Process data in batches or individually
      for (const record of data) {
        try {
          await this.exportSingleRecord(record, config);
          successCount++;
        } catch (error) {
          console.warn(`Failed to export record ${record.externalId}: ${error instanceof Error ? error.message : String(error)}`);
          failedCount++;
          errors.push({
            field: 'record',
            message: error instanceof Error ? error.message : String(error),
            severity: 'error'
          });
        }
      }

      // Finalize export process
      await this.finalizeExport(config);

      const result: {{PLUGIN_CLASS_NAME}}ExportResult = {
        success: failedCount === 0,
        recordsProcessed: data.length,
        recordsSuccessful: successCount,
        recordsFailed: failedCount,
        recordsSkipped: skippedCount,
        ...(errors.length > 0 && { errors }),
        summary: `Exported ${successCount}/${data.length} records successfully`,
        ...(config.outputPath && { outputLocation: config.outputPath })
      };

      console.log(`✅ {{PLUGIN_NAME}} export completed: ${result.summary}`);
      return result;

    } catch (error) {
      throw new Error(`{{PLUGIN_NAME}} export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Configure the exporter with options
   */
  async configure(options: ExporterOptions): Promise<void> {
    // TODO: Implement configuration logic
    // Example:
    // if (options.verbose) {
    //   console.log('{{PLUGIN_NAME}} exporter configured with verbose output');
    // }
    
    console.log('{{PLUGIN_NAME}} exporter configured');
  }

  /**
   * Validate exporter configuration
   */
  async validate(config: {{PLUGIN_CLASS_NAME}}Config): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // TODO: Add your validation logic here
    // Example:
    // if (!config.outputPath) {
    //   errors.push({
    //     field: 'outputPath',
    //     message: 'Output path is required',
    //     severity: 'error'
    //   });
    // }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ================================
  // Private Helper Methods
  // ================================

  /**
   * Initialize export process (setup connections, create directories, etc.)
   */
  private async initializeExport(config: {{PLUGIN_CLASS_NAME}}Config): Promise<void> {
    // TODO: Implement initialization logic
    // Examples:
    // - Create output directories
    // - Establish API connections
    // - Initialize file writers
    // - Setup authentication
    
    console.log('Initializing {{PLUGIN_NAME}} export...');
  }

  /**
   * Export a single record
   */
  private async exportSingleRecord(record: RawImportData, config: {{PLUGIN_CLASS_NAME}}Config): Promise<void> {
    // TODO: Implement single record export logic
    // Examples:
    // - Transform record to target format
    // - Write to file
    // - Send via API
    // - Stream to output
    
    console.log(`Exporting record: ${record.title} (${record.externalId})`);
    
    // Placeholder implementation
    const transformedRecord = this.transformRecord(record);
    await this.writeRecord(transformedRecord, config);
  }

  /**
   * Finalize export process (close connections, cleanup, etc.)
   */
  private async finalizeExport(config: {{PLUGIN_CLASS_NAME}}Config): Promise<void> {
    // TODO: Implement finalization logic
    // Examples:
    // - Close file handles
    // - Disconnect from APIs
    // - Generate summary reports
    // - Cleanup temporary files
    
    console.log('Finalizing {{PLUGIN_NAME}} export...');
  }

  /**
   * Transform record to target format
   */
  private transformRecord(record: RawImportData): unknown {
    // TODO: Implement record transformation
    // Transform the standardized record to your target format
    
    return {
      // Example transformation
      id: record.externalId,
      title: record.title,
      description: record.description,
      location: {
        latitude: record.lat,
        longitude: record.lon
      },
      source: record.source,
      tags: record.tags || {},
      // Add your specific transformation logic here
    };
  }

  /**
   * Write/send transformed record
   */
  private async writeRecord(transformedRecord: unknown, config: {{PLUGIN_CLASS_NAME}}Config): Promise<void> {
    // TODO: Implement record writing/sending
    // Examples:
    // - Append to file
    // - POST to API
    // - Add to batch
    // - Stream output
    
    // Placeholder - just log the record
    if (config.outputPath) {
      console.log(`Would write to ${config.outputPath}:`, transformedRecord);
    } else {
      console.log('Transformed record:', transformedRecord);
    }
  }
}

// ================================
// Plugin Export
// ================================

// Export the plugin instance
export const {{PLUGIN_INSTANCE_NAME}} = new {{PLUGIN_CLASS_NAME}}();