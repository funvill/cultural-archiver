import type {
  ImportConfig,
  ImportRecord,
  ProcessingResult,
  ProcessingError,
  ProcessingWarning,
  ImportStatistics,
} from './types.js';
import {
  DEFAULT_DUPLICATE_RADIUS,
  DEFAULT_FUZZY_THRESHOLD,
  MASS_IMPORT_USER_ID,
  ImportConfigSchema,
  ImportRecordSchema,
} from './types.js';

/**
 * Core Mass Import Library
 * 
 * This class handles the main import processing logic, including:
 * - Data validation and transformation
 * - Duplicate detection
 * - API integration with existing logbook endpoints
 * - Dry-run functionality
 */
export class MassImportLibrary {
  private config: ImportConfig;
  private statistics: ImportStatistics;
  private errors: ProcessingError[] = [];
  private warnings: ProcessingWarning[] = [];

  constructor(config: ImportConfig) {
    const validated = ImportConfigSchema.parse(config);
    this.config = {
      ...validated,
      bounds: validated.bounds || undefined,
    };
    this.statistics = this.initializeStatistics();
  }

  /**
   * Process a batch of import records
   */
  async processImport(records: ImportRecord[]): Promise<ProcessingResult> {
    console.info(`Starting mass import processing: ${records.length} records`);
    
    this.resetCounters();
    const validRecords = await this.validateRecords(records);
    
    if (this.config.dryRun) {
      return this.processDryRun(validRecords);
    }
    
    return this.processActualImport(validRecords);
  }

  /**
   * Perform dry-run validation without API calls
   */
  async processDryRun(records: ImportRecord[]): Promise<ProcessingResult> {
    console.info('Running dry-run validation...');
    
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      try {
        // Validate record structure
        const validation = ImportRecordSchema.safeParse(record);
        if (!validation.success) {
          this.addError(record.externalId, 
            `Validation failed: ${validation.error.message}`, 
            'validation', 
            { issues: validation.error.issues }
          );
          failureCount++;
          continue;
        }

        // Check for potential duplicates
        const duplicateCheck = await this.checkForDuplicates(record);
        if (duplicateCheck.isDuplicate) {
          this.addWarning(record.externalId,
            `Potential duplicate detected: ${duplicateCheck.reason}`,
            'coordinate_validation',
            { duplicateInfo: duplicateCheck }
          );
        }

        // Validate tags
        const tagValidation = this.validateTags(record.tags);
        if (!tagValidation.isValid) {
          this.addWarning(record.externalId,
            `Tag validation issues: ${tagValidation.issues.join(', ')}`,
            'tag_mapping',
            { tagIssues: tagValidation.issues }
          );
        }

        // Check photo URLs
        if (record.photoUrls?.length) {
          for (const photoUrl of record.photoUrls) {
            if (!this.isValidPhotoUrl(photoUrl)) {
              this.addWarning(record.externalId,
                `Invalid photo URL: ${photoUrl}`,
                'photo_processing',
                { photoUrl }
              );
            }
          }
        }

        successCount++;
        this.updateStatistics(record);

      } catch (error) {
        this.addError(record.externalId,
          `Processing error: ${error instanceof Error ? error.message : String(error)}`,
          'validation',
          { error: String(error) }
        );
        failureCount++;
      }
    }

    return {
      totalRecords: records.length,
      successCount,
      failureCount,
      skippedCount,
      errors: this.errors,
      warnings: this.warnings,
      statistics: this.statistics,
    };
  }

  /**
   * Process actual import with API calls
   */
  private async processActualImport(records: ImportRecord[]): Promise<ProcessingResult> {
    console.info('Processing actual import with API calls...');
    
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    // Process in batches to respect rate limits
    const batchSize = this.config.batchSize || 50;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      
      for (const record of batch) {
        try {
          // Check for duplicates first
          const duplicateCheck = await this.checkForDuplicates(record);
          if (duplicateCheck.isDuplicate) {
            this.addWarning(record.externalId,
              `Skipping duplicate: ${duplicateCheck.reason}`,
              'coordinate_validation',
              { duplicateInfo: duplicateCheck }
            );
            skippedCount++;
            continue;
          }

          // Submit to API
          const result = await this.submitToAPI(record);
          if (result.success) {
            successCount++;
            this.updateStatistics(record);
          } else {
            failureCount++;
            this.addError(record.externalId,
              `API submission failed: ${result.error}`,
              'api',
              { response: result }
            );
          }

        } catch (error) {
          failureCount++;
          this.addError(record.externalId,
            `Processing error: ${error instanceof Error ? error.message : String(error)}`,
            'network',
            { error: String(error) }
          );
        }
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < records.length) {
        await this.delay(1000); // 1 second delay between batches
      }
    }

    return {
      totalRecords: records.length,
      successCount,
      failureCount,
      skippedCount,
      errors: this.errors,
      warnings: this.warnings,
      statistics: this.statistics,
    };
  }

  /**
   * Validate records against schema
   */
  private async validateRecords(records: ImportRecord[]): Promise<ImportRecord[]> {
    const validRecords: ImportRecord[] = [];
    
    for (const record of records) {
      const validation = ImportRecordSchema.safeParse(record);
      if (validation.success) {
        validRecords.push(validation.data);
      } else {
        this.addError(record.externalId || 'unknown',
          `Record validation failed: ${validation.error.message}`,
          'validation',
          { record, issues: validation.error.issues }
        );
      }
    }

    return validRecords;
  }

  /**
   * Check for potential duplicates using geographic proximity and title matching
   */
  private async checkForDuplicates(record: ImportRecord): Promise<{
    isDuplicate: boolean;
    reason?: string;
    matchedRecords?: unknown[];
  }> {
    try {
      // Query existing artworks near this location
      const radius = DEFAULT_DUPLICATE_RADIUS / 1000; // Convert to km
      const response = await fetch(
        `${this.config.apiBaseUrl}/api/discover/artworks-nearby?` +
        `lat=${record.lat}&lon=${record.lon}&radius=${radius}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // If we can't check for duplicates, warn but don't fail
        this.addWarning(record.externalId,
          'Unable to check for duplicates - proceeding with import',
          'coordinate_validation'
        );
        return { isDuplicate: false };
      }

      const nearby = await response.json() as { data?: { artworks?: Array<{ title?: string }> } };
      const artworks = nearby.data?.artworks || [];

      // Check for exact title matches
      const titleMatches = artworks.filter((artwork: { title?: string }) => 
        artwork.title && this.fuzzyMatch(record.title, artwork.title, DEFAULT_FUZZY_THRESHOLD)
      );

      if (titleMatches.length > 0) {
        return {
          isDuplicate: true,
          reason: `Similar title found within ${DEFAULT_DUPLICATE_RADIUS}m`,
          matchedRecords: titleMatches,
        };
      }

      return { isDuplicate: false };

    } catch (error) {
      this.addWarning(record.externalId,
        'Error checking for duplicates - proceeding with import',
        'coordinate_validation',
        { error: String(error) }
      );
      return { isDuplicate: false };
    }
  }

  /**
   * Submit record to API
   */
  private async submitToAPI(record: ImportRecord): Promise<{
    success: boolean;
    error?: string;
    submissionId?: string;
  }> {
    try {
      const formData = new FormData();
      
      // Add core fields
      formData.append('lat', record.lat.toString());
      formData.append('lon', record.lon.toString());
      formData.append('note', this.buildNoteFromRecord(record));
      formData.append('tags', JSON.stringify(record.tags));

      // Add source attribution
      formData.append('source', this.config.source);
      formData.append('external_id', record.externalId);

      const response = await fetch(`${this.config.apiBaseUrl}/api/logbook`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'X-User-Token': MASS_IMPORT_USER_ID,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json() as { data?: { id?: string } };
      return {
        success: true,
        submissionId: result.data?.id,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build note field from record data
   */
  private buildNoteFromRecord(record: ImportRecord): string {
    const parts: string[] = [];
    
    if (record.title) {
      parts.push(`Title: ${record.title}`);
    }
    
    if (record.description) {
      parts.push(`Description: ${record.description}`);
    }
    
    if (record.createdBy) {
      parts.push(`Created by: ${record.createdBy}`);
    }
    
    parts.push(`Source: ${this.config.source}`);
    parts.push(`External ID: ${record.externalId}`);
    
    return parts.join('\n\n');
  }

  /**
   * Validate tags against schema
   */
  private validateTags(tags: Record<string, string | number | boolean>): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check for required tags
    if (!tags.tourism) {
      issues.push('Missing required "tourism" tag');
    }
    
    // Add source attribution tags
    if (!tags.source) {
      tags.source = this.config.source;
    }
    
    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Check if photo URL is valid
   */
  private isValidPhotoUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Fuzzy string matching
   */
  private fuzzyMatch(str1: string, str2: string, threshold: number): boolean {
    const normalize = (s: string): string => s.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const a = normalize(str1);
    const b = normalize(str2);
    
    if (a === b) return true;
    
    // Simple Levenshtein-based similarity
    const distance = this.levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);
    const similarity = 1 - (distance / maxLength);
    
    return similarity >= threshold;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array(b.length + 1).fill(0).map(() => Array(a.length + 1).fill(0));
    
    for (let i = 0; i <= a.length; i++) {
      matrix[0]![i] = i;
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[j]![0] = j;
    }
    
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitution = matrix[j - 1]![i - 1]! + (a[i - 1] !== b[j - 1] ? 1 : 0);
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1, // deletion
          matrix[j - 1]![i]! + 1, // insertion
          substitution // substitution
        );
      }
    }
    
    return matrix[b.length]![a.length]!;
  }

  /**
   * Add processing error
   */
  private addError(
    externalId: string,
    message: string,
    type: ProcessingError['type'],
    context?: Record<string, unknown>
  ): void {
    this.errors.push({
      externalId,
      message,
      type,
      context: context || undefined,
    });
  }

  /**
   * Add processing warning
   */
  private addWarning(
    externalId: string,
    message: string,
    type: ProcessingWarning['type'],
    context?: Record<string, unknown>
  ): void {
    this.warnings.push({
      externalId,
      message,
      type,
      context: context || undefined,
    });
  }

  /**
   * Update statistics with record data
   */
  private updateStatistics(record: ImportRecord): void {
    // Update geographic bounds
    this.statistics.geographicBounds.north = Math.max(
      this.statistics.geographicBounds.north,
      record.lat
    );
    this.statistics.geographicBounds.south = Math.min(
      this.statistics.geographicBounds.south,
      record.lat
    );
    this.statistics.geographicBounds.east = Math.max(
      this.statistics.geographicBounds.east,
      record.lon
    );
    this.statistics.geographicBounds.west = Math.min(
      this.statistics.geographicBounds.west,
      record.lon
    );

    // Update tag statistics
    const tagCount = Object.keys(record.tags).length;
    this.statistics.tagStatistics.totalTags += tagCount;
    this.statistics.tagStatistics.appliedTags += tagCount;

    // Update photo statistics
    const photoCount = record.photoUrls?.length || 0;
    this.statistics.photoStatistics.totalPhotos += photoCount;
    this.statistics.photoStatistics.processedPhotos += photoCount;
  }

  /**
   * Initialize statistics
   */
  private initializeStatistics(): ImportStatistics {
    return {
      recordsByStatus: {},
      photoStatistics: {
        totalPhotos: 0,
        processedPhotos: 0,
        failedPhotos: 0,
      },
      tagStatistics: {
        totalTags: 0,
        appliedTags: 0,
        failedTags: 0,
      },
      geographicBounds: {
        north: -90,
        south: 90,
        east: -180,
        west: 180,
      },
    };
  }

  /**
   * Reset counters for new processing run
   */
  private resetCounters(): void {
    this.errors = [];
    this.warnings = [];
    this.statistics = this.initializeStatistics();
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}