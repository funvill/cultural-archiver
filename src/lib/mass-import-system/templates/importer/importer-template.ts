/**
 * {{PLUGIN_NAME}} Importer Plugin Template
 * 
 * Description: {{PLUGIN_DESCRIPTION}}
 * Data Source: {{DATA_SOURCE}}
 * Supported Formats: {{SUPPORTED_FORMATS}}
 */

import type { 
  ImporterPlugin, 
  ImporterConfig, 
  PluginMetadata
} from '../types/plugin.js';
import type { RawImportData, ValidationResult, ValidationError } from '../types/index.js';

// ================================
// Plugin Configuration Interface
// ================================

export interface {{PLUGIN_CLASS_NAME}}Config extends ImporterConfig {
  // Add your specific configuration fields here
  dataFile: string;
  // Example configuration fields:
  // processingMode: 'sequential' | 'parallel';
  // customMappings: Record<string, string>;
  // filterCriteria: string[];
}

// ================================
// Data Source Interfaces
// ================================

interface {{DATA_TYPE_NAME}} {
  // Define the structure of your source data here
  // Example fields:
  // id: string;
  // name: string;
  // latitude: number;
  // longitude: number;
  // [key: string]: unknown;
}

// ================================
// Plugin Implementation
// ================================

export class {{PLUGIN_CLASS_NAME}} implements ImporterPlugin {
  // Plugin metadata
  name = '{{PLUGIN_KEBAB_NAME}}';
  description = '{{PLUGIN_DESCRIPTION}}';
  metadata: PluginMetadata = {
    name: '{{PLUGIN_KEBAB_NAME}}',
    description: '{{PLUGIN_DESCRIPTION}}',
    version: '1.0.0',
    author: '{{AUTHOR_NAME}}',
    supportedFormats: [{{SUPPORTED_FORMATS_ARRAY}}],
    requiredFields: [{{REQUIRED_FIELDS_ARRAY}}],
    optionalFields: [{{OPTIONAL_FIELDS_ARRAY}}]
  };

  // Configuration schema for validation
  configSchema = {
    type: 'object',
    properties: {
      dataFile: { type: 'string' },
      // Add your configuration schema here
    },
    required: ['dataFile']
  };

  // Plugin capabilities
  supportedFormats = [{{SUPPORTED_FORMATS_ARRAY}}];
  requiredFields = [{{REQUIRED_FIELDS_ARRAY}}];
  optionalFields = [{{OPTIONAL_FIELDS_ARRAY}}];

  // ================================
  // Core Plugin Methods (Required)
  // ================================

  /**
   * Map source data to standardized import format
   */
  async mapData(sourceData: unknown, config: {{PLUGIN_CLASS_NAME}}Config): Promise<RawImportData[]> {
    // Validate that sourceData is in expected format
    if (!Array.isArray(sourceData)) {
      throw new Error('{{PLUGIN_NAME}} data must be an array of records');
    }

    const mappedData: RawImportData[] = [];

    for (const record of sourceData as {{DATA_TYPE_NAME}}[]) {
      try {
        const mappedRecord = await this.mapSingleRecord(record, config);
        mappedData.push(mappedRecord);
      } catch (error) {
        console.warn(`Failed to map record: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }

    return mappedData;
  }

  /**
   * Validate source data structure
   */
  async validateData(sourceData: unknown): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check if data is in expected format
    if (!Array.isArray(sourceData)) {
      errors.push({
        field: 'sourceData',
        message: 'Source data must be an array of records',
        severity: 'error'
      });
      return { isValid: false, errors, warnings };
    }

    // Validate sample records
    const sampleSize = Math.min(10, sourceData.length);
    for (let i = 0; i < sampleSize; i++) {
      const record = sourceData[i] as {{DATA_TYPE_NAME}};
      
      // Add your validation logic here
      // Example:
      // if (!record.id) {
      //   errors.push({
      //     field: `record[${i}].id`,
      //     message: `Record ${i}: Missing required field 'id'`,
      //     severity: 'error'
      //   });
      // }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate unique import ID for record
   */
  generateImportId(record: unknown): string {
    const dataRecord = record as {{DATA_TYPE_NAME}};
    
    // Create a unique ID based on your data structure
    // Examples:
    // return `{{PLUGIN_KEBAB_NAME}}-${dataRecord.id}`;
    // return `{{PLUGIN_KEBAB_NAME}}-${dataRecord.name.replace(/\s+/g, '-').toLowerCase()}`;
    
    return `{{PLUGIN_KEBAB_NAME}}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default data path for this importer (optional)
   */
  getDefaultDataPath(): string {
    return './data/{{PLUGIN_KEBAB_NAME}}-data.json';
  }

  // ================================
  // Private Helper Methods
  // ================================

  /**
   * Map a single record to standardized format
   */
  private async mapSingleRecord(record: {{DATA_TYPE_NAME}}, config: {{PLUGIN_CLASS_NAME}}Config): Promise<RawImportData> {
    // Extract required fields
    // const title = record.name || 'Untitled';
    // const { latitude: lat, longitude: lon } = record;

    // TODO: Replace with your actual field mapping
    const mappedRecord: RawImportData = {
      lat: 0, // TODO: Extract from your data
      lon: 0, // TODO: Extract from your data
      title: 'TODO: Extract title', // TODO: Extract from your data
      description: '', // TODO: Extract from your data (optional)
      source: '{{PLUGIN_KEBAB_NAME}}',
      externalId: this.generateImportId(record),
      tags: {}, // TODO: Build tags from your data
      // Add other fields as needed
    };

    return mappedRecord;
  }

  /**
   * Extract and validate coordinates from record
   */
  private extractCoordinates(record: {{DATA_TYPE_NAME}}): { lat: number; lon: number } {
    // TODO: Implement coordinate extraction based on your data structure
    // Example:
    // const lat = record.latitude;
    // const lon = record.longitude;
    
    // if (typeof lat !== 'number' || typeof lon !== 'number') {
    //   throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    // }
    
    // return { lat, lon };
    
    throw new Error('Coordinate extraction not implemented');
  }

  /**
   * Build tags object from record data
   */
  private buildTags(record: {{DATA_TYPE_NAME}}): Record<string, string> {
    const tags: Record<string, string> = {};

    // TODO: Add your tag mapping logic here
    // Example:
    // if (record.category) {
    //   tags.category = record.category;
    // }
    
    return tags;
  }
}

// ================================
// Plugin Export
// ================================

// Export the plugin instance
export const {{PLUGIN_INSTANCE_NAME}} = new {{PLUGIN_CLASS_NAME}}();