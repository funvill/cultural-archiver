/**
 * Mass Import Plugin System - Console Output Exporter
 * 
 * This plugin outputs unified data to console with various formatting options,
 * progress indicators, and comprehensive logging capabilities.
 */

import type {
  ExporterPlugin,
  ExporterConfig,
  ExportResult,
} from '../types/plugin.js';
import type { RawImportData, ValidationResult } from '../types/index.js';

// ================================
// Console Exporter Configuration
// ================================

export interface ConsoleExporterConfig extends ExporterConfig {
  format?: 'table' | 'json' | 'compact' | 'detailed'; // Output format
  showProgress?: boolean; // Show progress indicators
  colorOutput?: boolean; // Enable color formatting
  maxDisplayRecords?: number; // Limit records displayed
  includeMetadata?: boolean; // Show metadata information
  sortBy?: string; // Field to sort by
  filterBy?: Record<string, unknown>; // Filter criteria
}

export interface ConsoleExporterOptions {
  verbose?: boolean;
  quiet?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

// ================================
// Console Colors and Formatting
// ================================

const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
} as const;

// ================================
// Console Output Exporter Plugin
// ================================

export class ConsoleExporter implements ExporterPlugin {
  name = 'console';
  description = 'Output data to console with various formatting and progress options';
  
  metadata = {
    name: 'console',
    description: 'Output data to console with various formatting and progress options',
    version: '1.0.0',
    author: 'Cultural Archiver',
    supportedFormats: ['table', 'json', 'compact', 'detailed'],
    requiredFields: [],
    optionalFields: ['format', 'showProgress', 'colorOutput', 'maxDisplayRecords', 'includeMetadata', 'sortBy', 'filterBy'],
  };
  
  supportedFormats = ['table', 'json', 'compact', 'detailed'];
  requiresNetwork = false;
  outputType = 'console' as const;

  private config: ConsoleExporterConfig | null = null;
  private options: ConsoleExporterOptions = {};
  private useColors = true;

  // ================================
  // Plugin Interface Implementation
  // ================================

  async configure(options: Record<string, unknown>): Promise<void> {
    this.options = {
      verbose: false,
      quiet: false,
      logLevel: 'info',
      ...options,
    } as ConsoleExporterOptions;
    
    // Check if colors should be disabled (non-TTY environments)
    this.useColors = process.stdout.isTTY && !this.options.quiet;
    
    if (!this.options.quiet) {
      console.log(this.colorize(`🔧 Console Exporter configured:`, 'cyan'), this.options);
    }
  }

  async validate(config: ExporterConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const consoleConfig = config as ConsoleExporterConfig;
      
      // Validate format option
      if (consoleConfig.format && !this.supportedFormats.includes(consoleConfig.format)) {
        errors.push(`format must be one of: ${this.supportedFormats.join(', ')}`);
      }
      
      // Validate maxDisplayRecords
      if (consoleConfig.maxDisplayRecords !== undefined && consoleConfig.maxDisplayRecords < 1) {
        errors.push('maxDisplayRecords must be greater than 0');
      }
      
      // Warn about performance with large datasets
      if (!consoleConfig.maxDisplayRecords) {
        warnings.push('Consider setting maxDisplayRecords for large datasets to avoid console overflow');
      }
      
      // Validate sortBy field
      if (consoleConfig.sortBy && typeof consoleConfig.sortBy !== 'string') {
        errors.push('sortBy must be a string field name');
      }
      
    } catch (error) {
      errors.push(`Configuration validation error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.map(error => ({ field: 'config', message: error, severity: 'error' as const })),
      warnings: warnings.map(warning => ({ field: 'config', message: warning, severity: 'warning' as const })),
    };
  }

  async export(data: RawImportData[], config: ExporterConfig): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      this.config = config as ConsoleExporterConfig;
      
      // Validate configuration
      const validation = await this.validate(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors?.map(e => e.message).join(', ')}`);
      }
      
      if (!this.options.quiet) {
        console.log(this.colorize(`📤 Starting console export of ${data.length} records...`, 'blue'));
      }
      
      // Process and filter data
      const processedData = await this.processData(data);
      
      // Export data based on format
      await this.outputData(processedData);
      
      const processingTime = Date.now() - startTime;
      
      if (!this.options.quiet) {
        console.log(this.colorize(`✅ Console export completed in ${processingTime}ms`, 'green'));
      }
      
      return {
        success: true,
        recordsProcessed: data.length,
        recordsSuccessful: processedData.length,
        recordsFailed: 0,
        recordsSkipped: data.length - processedData.length,
        summary: `Successfully exported ${processedData.length} records to console (${processingTime}ms)`,
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Console export failed';
      console.error(this.colorize(`❌ Console export failed:`, 'red'), error);
      
      return {
        success: false,
        recordsProcessed: data.length,
        recordsSuccessful: 0,
        recordsFailed: data.length,
        recordsSkipped: 0,
        errors: [{ field: 'export', message: errorMessage, severity: 'error' }],
        summary: `Console export failed: ${errorMessage}`,
      };
    }
  }

  // ================================
  // Data Processing Methods
  // ================================

  private async processData(data: RawImportData[]): Promise<RawImportData[]> {
    let processedData = [...data];
    
    // Apply filtering if configured
    if (this.config?.filterBy) {
      processedData = this.applyFilters(processedData, this.config.filterBy);
    }
    
    // Apply sorting if configured
    if (this.config?.sortBy) {
      processedData = this.applySorting(processedData, this.config.sortBy);
    }
    
    // Limit display records if configured
    if (this.config?.maxDisplayRecords && processedData.length > this.config.maxDisplayRecords) {
      const originalLength = processedData.length;
      processedData = processedData.slice(0, this.config.maxDisplayRecords);
      
      if (!this.options.quiet) {
        console.log(this.colorize(`ℹ️ Displaying ${processedData.length} of ${originalLength} records`, 'yellow'));
      }
    }
    
    return processedData;
  }

  private applyFilters(data: RawImportData[], filters: Record<string, unknown>): RawImportData[] {
    return data.filter(record => {
      for (const [field, value] of Object.entries(filters)) {
        const recordValue = (record as Record<string, unknown>)[field];
        if (recordValue !== value) {
          return false;
        }
      }
      return true;
    });
  }

  private applySorting(data: RawImportData[], sortField: string): RawImportData[] {
    return data.sort((a, b) => {
      const aValue = (a as Record<string, unknown>)[sortField];
      const bValue = (b as Record<string, unknown>)[sortField];
      
      // Convert to string for comparison to avoid type issues
      const aStr = String(aValue ?? '');
      const bStr = String(bValue ?? '');
      
      if (aStr < bStr) return -1;
      if (aStr > bStr) return 1;
      return 0;
    });
  }

  // ================================
  // Output Formatting Methods
  // ================================

  private async outputData(data: RawImportData[]): Promise<void> {
    const format = this.config?.format ?? 'table';
    
    // Show metadata if requested
    if (this.config?.includeMetadata) {
      this.outputMetadata(data);
    }
    
    // Output data based on format
    switch (format) {
      case 'table':
        this.outputTable(data);
        break;
        
      case 'json':
        this.outputJson(data);
        break;
        
      case 'compact':
        this.outputCompact(data);
        break;
        
      case 'detailed':
        this.outputDetailed(data);
        break;
        
      default:
        this.outputTable(data);
    }
  }

  private outputMetadata(data: RawImportData[]): void {
    console.log(this.colorize('\\n=== Export Metadata ===', 'cyan'));
    console.log(`Records: ${data.length}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Format: ${this.config?.format ?? 'table'}`);
    console.log(`Exporter: ${this.name} v${this.metadata.version}`);
    console.log(this.colorize('========================\\n', 'cyan'));
  }

  private outputTable(data: RawImportData[]): void {
    if (data.length === 0) {
      console.log(this.colorize('No records to display', 'yellow'));
      return;
    }
    
    // Simple table format - would need a proper table library for production
    console.log(this.colorize('\\n=== Records (Table Format) ===', 'bright'));
    
    // Get common fields from first record
    const sampleRecord = data[0];
    if (!sampleRecord) {
      console.log(this.colorize('No records to display', 'yellow'));
      return;
    }
    
    const fields = Object.keys(sampleRecord).slice(0, 5); // Limit fields for readability
    
    // Header
    console.log(fields.map(field => this.colorize(field.padEnd(20), 'cyan')).join(' | '));
    console.log(fields.map(() => '--------------------').join('-|-'));
    
    // Rows
    data.forEach((record, index) => {
      const row = fields.map(field => {
        const value = (record as Record<string, unknown>)[field];
        const strValue = String(value ?? '').slice(0, 18);
        return strValue.padEnd(20);
      }).join(' | ');
      
      console.log(row);
      
      // Show progress for large datasets
      if (this.config?.showProgress && (index + 1) % 50 === 0) {
        console.log(this.colorize(`... (${index + 1}/${data.length} records shown)`, 'gray'));
      }
    });
    
    console.log(this.colorize('===============================\\n', 'bright'));
  }

  private outputJson(data: RawImportData[]): void {
    console.log(this.colorize('\\n=== Records (JSON Format) ===', 'bright'));
    console.log(JSON.stringify(data, null, 2));
    console.log(this.colorize('==============================\\n', 'bright'));
  }

  private outputCompact(data: RawImportData[]): void {
    console.log(this.colorize('\\n=== Records (Compact Format) ===', 'bright'));
    
    data.forEach((record, index) => {
      const recordObj = record as Record<string, unknown>;
      const title = recordObj.title || recordObj.name || `Record ${index + 1}`;
      const location = recordObj.lat && recordObj.lon ? 
        `[${recordObj.lat}, ${recordObj.lon}]` : 'No location';
      
      console.log(`${this.colorize(`${index + 1}.`, 'blue')} ${title} ${this.colorize(location, 'gray')}`);
    });
    
    console.log(this.colorize('=================================\\n', 'bright'));
  }

  private outputDetailed(data: RawImportData[]): void {
    console.log(this.colorize('\\n=== Records (Detailed Format) ===', 'bright'));
    
    data.forEach((record, index) => {
      console.log(this.colorize(`\\n--- Record ${index + 1} ---`, 'cyan'));
      
      Object.entries(record).forEach(([key, value]) => {
        const formattedValue = typeof value === 'object' ? 
          JSON.stringify(value, null, 2) : String(value);
        console.log(`${this.colorize(key + ':', 'magenta')} ${formattedValue}`);
      });
    });
    
    console.log(this.colorize('==================================\\n', 'bright'));
  }

  // ================================
  // Utility Methods
  // ================================

  private colorize(text: string, color: keyof typeof Colors): string {
    if (!this.useColors) return text;
    return `${Colors[color]}${text}${Colors.reset}`;
  }

  getCapabilities(): string[] {
    return [
      'realtime-output',
      'color-formatting',
      'multiple-formats',
      'filtering',
      'sorting',
      'progress-display',
    ];
  }

  getSupportedFormats(): string[] {
    return this.supportedFormats;
  }
}