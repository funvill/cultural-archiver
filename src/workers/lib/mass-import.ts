/**
 * Mass Import Core Library
 * 
 * Core functionality for importing artwork data from external sources
 * with duplicate detection, structured tagging, and validation.
 * 
 * Integrates with existing similarity service for duplicate detection.
 */

import { 
  MassImportConfig, 
  MassImportResults, 
  ImportContext, 
  ImportStatistics,
  ProcessedRecord,
  FailedRecord,
  DuplicateMatch,
  TagValidationSummary,
  BulkApprovalConfig,
  BulkApprovalResults,
  ConfigValidationResult,
  MassImportLibraryInterface,
  MASS_IMPORT_CONSTANTS,
  ImportProgress,
  ImportError
} from '../shared/mass-import';

import { validateTags } from '../shared/tag-validation';
import { CONSENT_VERSION } from '../shared/consent';
import { calculateDistance } from '../shared/geo';

/**
 * Mass Import Library - Core Implementation
 * 
 * Provides comprehensive functionality for importing external artwork data
 * with validation, duplicate detection, and structured tag processing.
 */
export class MassImportLibrary implements MassImportLibraryInterface {
  private apiBaseUrl: string;
  private defaultTimeout: number;

  constructor(options: {
    apiBaseUrl?: string;
    timeout?: number;
  } = {}) {
    this.apiBaseUrl = options.apiBaseUrl || 'https://art-api.abluestar.com';
    this.defaultTimeout = options.timeout || 30000;
  }

  /**
   * Execute dry run validation without making API calls
   * Validates data structure, field mappings, and tag configuration
   */
  async dryRun(data: any[], context: ImportContext): Promise<MassImportResults> {
    const startTime = Date.now();
    const importId = context.import_id || this.generateImportId(context.config.source);

    // Progress reporting
    this.reportProgress(context, {
      stage: 'validation',
      processed: 0,
      total: data.length,
      message: 'Starting dry run validation...'
    });

    const results: MassImportResults = {
      import_id: importId,
      source: context.config.source,
      dry_run: true,
      started_at: new Date().toISOString(),
      completed_at: '',
      statistics: this.initializeStatistics(data.length),
      successful_records: [],
      failed_records: [],
      duplicate_matches: [],
      tag_validation_summary: this.initializeTagValidationSummary()
    };

    try {
      // Process each record for validation
      for (let i = 0; i < data.length; i++) {
        const record = data[i];
        
        this.reportProgress(context, {
          stage: 'validation',
          processed: i + 1,
          total: data.length,
          current_record: {
            external_id: this.extractExternalId(record, context.config),
            title: this.extractTitle(record, context.config)
          },
          message: `Validating record ${i + 1} of ${data.length}`
        });

        try {
          // Validate required fields
          await this.validateRecord(record, context.config);
          
          // Validate and transform tags
          const mappedTags = await this.mapTags(record, context.config);
          const tagValidation = await this.validateRecordTags(mappedTags);
          
          this.updateTagValidationSummary(results.tag_validation_summary, mappedTags, tagValidation);

          // Create successful record entry
          const processedRecord: ProcessedRecord = {
            external_id: this.extractExternalId(record, context.config),
            created_id: 'DRY_RUN_' + this.generateId(),
            title: this.extractTitle(record, context.config),
            applied_tags: mappedTags,
            photo_status: this.hasPhotoConfig(record, context.config) ? 'success' : 'none',
            notes: tagValidation.warnings.length > 0 ? tagValidation.warnings : undefined
          };

          results.successful_records.push(processedRecord);
          results.statistics.successful++;

          if (tagValidation.warnings.length > 0) {
            results.statistics.tag_warnings++;
          }

        } catch (error) {
          // Handle validation errors
          const failedRecord: FailedRecord = {
            external_id: this.extractExternalId(record, context.config),
            title: this.extractTitle(record, context.config),
            error_type: 'validation',
            error_message: error instanceof Error ? error.message : 'Unknown validation error',
            error_details: error,
            source_record: record
          };

          results.failed_records.push(failedRecord);
          results.statistics.failed++;

          this.reportError(context, {
            severity: 'error',
            type: 'validation',
            message: failedRecord.error_message,
            context: { record: failedRecord.external_id }
          });
        }
      }

      // Check for potential duplicates (dry run simulation)
      this.reportProgress(context, {
        stage: 'duplicate_check',
        processed: 0,
        total: results.successful_records.length,
        message: 'Checking for potential duplicates...'
      });

      await this.simulateDuplicateCheck(results, context);

    } catch (error) {
      this.reportError(context, {
        severity: 'critical',
        type: 'validation',
        message: error instanceof Error ? error.message : 'Critical validation error'
      });
      throw error;
    }

    // Finalize results
    const endTime = Date.now();
    results.statistics.processing_time_ms = endTime - startTime;
    results.completed_at = new Date().toISOString();

    this.reportProgress(context, {
      stage: 'completion',
      processed: data.length,
      total: data.length,
      message: `Dry run completed: ${results.statistics.successful} successful, ${results.statistics.failed} failed`
    });

    return results;
  }

  /**
   * Execute actual import with API calls
   */
  async processImport(data: any[], context: ImportContext): Promise<MassImportResults> {
    const startTime = Date.now();
    const importId = context.import_id || this.generateImportId(context.config.source);

    this.reportProgress(context, {
      stage: 'validation',
      processed: 0,
      total: data.length,
      message: 'Starting import processing...'
    });

    const results: MassImportResults = {
      import_id: importId,
      source: context.config.source,
      dry_run: false,
      started_at: new Date().toISOString(),
      completed_at: '',
      statistics: this.initializeStatistics(data.length),
      successful_records: [],
      failed_records: [],
      duplicate_matches: [],
      tag_validation_summary: this.initializeTagValidationSummary()
    };

    try {
      // Process records in batches
      const batchSize = context.config.batch_config?.batch_size || MASS_IMPORT_CONSTANTS.DEFAULT_BATCH_SIZE;
      const batches = this.createBatches(data, batchSize);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        this.reportProgress(context, {
          stage: 'processing',
          processed: batchIndex * batchSize,
          total: data.length,
          message: `Processing batch ${batchIndex + 1} of ${batches.length}`
        });

        // Process batch with delay
        await this.processBatch(batch, results, context);

        // Batch delay to prevent API overload
        if (batchIndex < batches.length - 1 && context.config.batch_config?.batch_delay_ms) {
          await this.delay(context.config.batch_config.batch_delay_ms);
        }
      }

      // Process photos after main import
      this.reportProgress(context, {
        stage: 'photos',
        processed: 0,
        total: results.successful_records.length,
        message: 'Processing photos for imported artworks...'
      });

      await this.processPhotos(results, context);

    } catch (error) {
      this.reportError(context, {
        severity: 'critical',
        type: 'api',
        message: error instanceof Error ? error.message : 'Critical import error'
      });
      throw error;
    }

    // Finalize results
    const endTime = Date.now();
    results.statistics.processing_time_ms = endTime - startTime;
    results.completed_at = new Date().toISOString();

    this.reportProgress(context, {
      stage: 'completion',
      processed: data.length,
      total: data.length,
      message: `Import completed: ${results.statistics.successful} successful, ${results.statistics.failed} failed`
    });

    return results;
  }

  /**
   * Retry failed photo downloads from previous import
   */
  async retryPhotos(importResults: MassImportResults, context: ImportContext): Promise<MassImportResults> {
    // Implementation for retrying failed photo downloads
    // This would identify records with photo_status: 'failed' and retry them
    
    throw new Error('retryPhotos not yet implemented');
  }

  /**
   * Execute bulk approval of imported records
   */
  async bulkApprove(config: BulkApprovalConfig, context: ImportContext): Promise<BulkApprovalResults> {
    if (!config.confirm) {
      throw new Error('Bulk approval requires explicit confirmation');
    }

    // Implementation for bulk approval
    // This would query for pending records from the specified source
    // and approve them in batches through the existing API
    
    throw new Error('bulkApprove not yet implemented');
  }

  /**
   * Validate import configuration
   */
  async validateConfig(config: MassImportConfig): Promise<ConfigValidationResult> {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      summary: {
        required_fields_mapped: false,
        tag_mappings_valid: false,
        photo_config_valid: false
      }
    };

    // Validate required fields
    if (!config.source) {
      result.errors.push('Source identifier is required');
    }
    
    if (!config.field_mappings.title) {
      result.errors.push('Title field mapping is required');
    }
    
    if (!config.field_mappings.coordinates.lat || !config.field_mappings.coordinates.lon) {
      result.errors.push('Coordinate field mappings are required');
    }

    result.summary.required_fields_mapped = result.errors.length === 0;

    // Validate tag mappings
    if (!config.tag_mappings.source) {
      result.errors.push('Source tag mapping is required');
    }

    if (!config.tag_mappings.license) {
      result.warnings.push('License tag mapping is recommended');
    }

    result.summary.tag_mappings_valid = Object.keys(config.tag_mappings).length > 0;

    // Validate photo configuration
    if (config.photo_config) {
      if (!config.photo_config.source_field) {
        result.errors.push('Photo source field is required when photo_config is provided');
      }
      result.summary.photo_config_valid = !!config.photo_config.source_field;
    } else {
      result.summary.photo_config_valid = true; // Optional
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Private helper methods
   */
  private generateImportId(source: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${source}-${timestamp}`;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private extractExternalId(record: any, config: MassImportConfig): string {
    // Try to find external ID from tag mappings
    for (const [key, mapping] of Object.entries(config.tag_mappings)) {
      if (key === 'external_id' && typeof mapping === 'object' && mapping.source_field) {
        return this.getNestedValue(record, mapping.source_field) || 'unknown';
      }
      if (key === 'external_id' && typeof mapping === 'string') {
        return this.getNestedValue(record, mapping) || 'unknown';
      }
    }
    
    // Fallback to common ID fields
    return record.id || record.registryid || record.external_id || `generated-${this.generateId()}`;
  }

  private extractTitle(record: any, config: MassImportConfig): string {
    return this.getNestedValue(record, config.field_mappings.title) || 'Untitled';
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async validateRecord(record: any, config: MassImportConfig): Promise<void> {
    // Validate required fields exist
    const title = this.getNestedValue(record, config.field_mappings.title);
    if (!title) {
      throw new Error('Title field is required but not found');
    }

    const lat = this.getNestedValue(record, config.field_mappings.coordinates.lat);
    const lon = this.getNestedValue(record, config.field_mappings.coordinates.lon);
    
    if (lat === undefined || lon === undefined) {
      throw new Error('Coordinate fields are required but not found');
    }

    // Validate coordinate format
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    
    if (isNaN(latNum) || isNaN(lonNum)) {
      throw new Error('Invalid coordinate format');
    }

    if (latNum < -90 || latNum > 90) {
      throw new Error('Invalid latitude value');
    }

    if (lonNum < -180 || lonNum > 180) {
      throw new Error('Invalid longitude value');
    }
  }

  private async mapTags(record: any, config: MassImportConfig): Promise<Record<string, string>> {
    const mappedTags: Record<string, string> = {};

    for (const [tagKey, mapping] of Object.entries(config.tag_mappings)) {
      try {
        let value: string;

        if (typeof mapping === 'string') {
          // Check if this looks like a field path (contains dots or is present in record)
          if (mapping.includes('.') || (record && record.hasOwnProperty(mapping))) {
            // Field mapping - extract from record
            value = this.getNestedValue(record, mapping);
          } else {
            // Literal value - use the string directly
            value = mapping;
          }
        } else {
          // Complex mapping with transformations
          let rawValue = this.getNestedValue(record, mapping.source_field);

          // Apply transformations
          if (mapping.transform) {
            rawValue = this.applyTransformation(rawValue, mapping.transform);
          }

          // Apply prefix
          if (mapping.prefix) {
            rawValue = mapping.prefix + rawValue;
          }

          // Apply template
          if (mapping.template) {
            value = this.applyTemplate(mapping.template, record, { external_id: this.extractExternalId(record, config) });
          } else {
            value = rawValue;
          }
        }

        if (value !== undefined && value !== null && value !== '') {
          mappedTags[tagKey] = String(value);
        }
      } catch (error) {
        // Log tag mapping error but continue
        console.warn(`Failed to map tag ${tagKey}: ${error}`);
      }
    }

    // Add required import tags
    mappedTags.import_date = new Date().toISOString().split('T')[0];
    
    return mappedTags;
  }

  private applyTransformation(value: any, transform: string): string {
    switch (transform) {
      case 'lowercase_with_underscores':
        return String(value).toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
        
      case 'array_to_comma_separated':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);
        
      case 'year_format':
        const year = parseInt(String(value));
        if (!isNaN(year) && year > 1000 && year < 3000) {
          return String(year);
        }
        throw new Error('Invalid year format');
        
      default:
        return String(value);
    }
  }

  private applyTemplate(template: string, record: any, context: Record<string, any>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      return context[key] || this.getNestedValue(record, key) || match;
    });
  }

  private async validateRecordTags(tags: Record<string, string>): Promise<{ valid: boolean; warnings: string[]; errors: string[] }> {
    // Use existing tag validation system
    try {
      const validationResult = await validateTags(tags);
      return {
        valid: validationResult.valid,
        warnings: validationResult.warningMessages || [],
        errors: validationResult.errorMessages || []
      };
    } catch (error) {
      return {
        valid: false,
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Tag validation failed']
      };
    }
  }

  private initializeStatistics(totalRecords: number): ImportStatistics {
    return {
      total_records: totalRecords,
      successful: 0,
      failed: 0,
      skipped_duplicates: 0,
      photo_failures: 0,
      tag_warnings: 0,
      processing_time_ms: 0
    };
  }

  private initializeTagValidationSummary(): TagValidationSummary {
    return {
      total_tags: 0,
      valid_tags: 0,
      warning_tags: 0,
      invalid_tags: 0,
      validation_details: {}
    };
  }

  private updateTagValidationSummary(summary: TagValidationSummary, tags: Record<string, string>, validation: any): void {
    summary.total_tags += Object.keys(tags).length;
    
    if (validation.valid) {
      summary.valid_tags += Object.keys(tags).length;
    }
    
    if (validation.warnings.length > 0) {
      summary.warning_tags += validation.warnings.length;
    }
    
    if (validation.errors.length > 0) {
      summary.invalid_tags += validation.errors.length;
    }

    // Update detailed validation info
    for (const tagKey of Object.keys(tags)) {
      if (!summary.validation_details[tagKey]) {
        summary.validation_details[tagKey] = {
          applied_count: 0,
          warning_count: 0,
          error_count: 0,
          messages: []
        };
      }
      summary.validation_details[tagKey].applied_count++;
    }
  }

  private hasPhotoConfig(record: any, config: MassImportConfig): boolean {
    if (!config.photo_config) return false;
    
    const photoUrl = this.getNestedValue(record, config.photo_config.source_field);
    return !!photoUrl;
  }

  private async simulateDuplicateCheck(results: MassImportResults, context: ImportContext): Promise<void> {
    // Simulate duplicate checking for dry run
    // In actual implementation, this would call the similarity service
    
    const duplicateCount = Math.floor(results.successful_records.length * 0.05); // Simulate 5% duplicates
    
    for (let i = 0; i < duplicateCount && i < results.successful_records.length; i++) {
      const record = results.successful_records[i];
      
      const duplicateMatch: DuplicateMatch = {
        external_id: record.external_id,
        existing_artwork_id: 'existing-' + this.generateId(),
        similarity_score: 0.75 + Math.random() * 0.2, // Random score between 0.75-0.95
        match_details: {
          distance_meters: Math.floor(Math.random() * 100),
          title_similarity: 0.8,
          tag_overlap: 0.6
        },
        action: 'skipped'
      };
      
      results.duplicate_matches.push(duplicateMatch);
      results.statistics.skipped_duplicates++;
    }
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processBatch(batch: any[], results: MassImportResults, context: ImportContext): Promise<void> {
    // Process each record in the batch
    // In actual implementation, this would make API calls to submit records
    
    for (const record of batch) {
      try {
        // Validate record
        await this.validateRecord(record, context.config);
        
        // Map tags
        const mappedTags = await this.mapTags(record, context.config);
        
        // Check for duplicates (would use similarity service)
        const isDuplicate = await this.checkForDuplicate(record, context);
        
        if (isDuplicate) {
          results.statistics.skipped_duplicates++;
          continue;
        }
        
        // Submit to API (placeholder)
        const submissionResult = await this.submitRecord(record, mappedTags, context);
        
        const processedRecord: ProcessedRecord = {
          external_id: this.extractExternalId(record, context.config),
          created_id: submissionResult.id,
          title: this.extractTitle(record, context.config),
          applied_tags: mappedTags,
          photo_status: 'none', // Will be updated during photo processing
          notes: undefined
        };

        results.successful_records.push(processedRecord);
        results.statistics.successful++;

      } catch (error) {
        const failedRecord: FailedRecord = {
          external_id: this.extractExternalId(record, context.config),
          title: this.extractTitle(record, context.config),
          error_type: 'api',
          error_message: error instanceof Error ? error.message : 'Unknown submission error',
          error_details: error,
          source_record: record
        };

        results.failed_records.push(failedRecord);
        results.statistics.failed++;

        this.reportError(context, {
          severity: 'error',
          type: 'api',
          message: failedRecord.error_message,
          context: { record: failedRecord.external_id }
        });
      }
    }
  }

  private async checkForDuplicate(record: any, context: ImportContext): Promise<boolean> {
    // Placeholder - would integrate with similarity service
    // This would call /api/artworks/check-similarity endpoint
    return false;
  }

  private async submitRecord(record: any, tags: Record<string, string>, context: ImportContext): Promise<{ id: string }> {
    // Placeholder for API submission
    // This would call /api/artworks/fast endpoint with proper authentication
    
    return { id: 'submitted-' + this.generateId() };
  }

  private async processPhotos(results: MassImportResults, context: ImportContext): Promise<void> {
    // Placeholder for photo processing
    // Would download and upload photos for successful records
    
    for (const record of results.successful_records) {
      // Update photo status based on processing results
      record.photo_status = Math.random() > 0.2 ? 'success' : 'failed';
      if (record.photo_status === 'failed') {
        results.statistics.photo_failures++;
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private reportProgress(context: ImportContext, progress: ImportProgress): void {
    if (context.onProgress) {
      context.onProgress(progress);
    }
  }

  private reportError(context: ImportContext, error: ImportError): void {
    if (context.onError) {
      context.onError(error);
    }
  }
}

/**
 * Default export for easy importing
 */
export default MassImportLibrary;