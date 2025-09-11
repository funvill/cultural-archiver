/**
 * Mass Import System - Main Processor
 * 
 * This module orchestrates the mass import process, handling batch processing,
 * progress tracking, and error handling.
 */

import ora from 'ora';
import chalk from 'chalk';
import type {
  MassImportConfig,
  ImportSession,
  BatchResult,
  ImportResult,
  DataSourceMapper,
} from '../types';
import { MassImportAPIClient, DryRunAPIClient } from '../lib/api-client.js';
import { validateImportData } from '../lib/validation.js';
import { RawImportDataSchema } from '../types/index.js';

// Import cancellation state from CLI
let isCancelled = false;
export const setCancellationState = (cancelled: boolean): void => {
  isCancelled = cancelled;
};

export const checkCancellation = (): boolean => {
  return isCancelled;
};

// ================================
// Main Processor Class
// ================================

export class MassImportProcessor {
  private config: MassImportConfig;
  private apiClient: MassImportAPIClient | DryRunAPIClient;
  private mapper?: DataSourceMapper;

  constructor(config: MassImportConfig) {
    this.config = config;
    this.apiClient = config.dryRun 
      ? new DryRunAPIClient(config) 
      : new MassImportAPIClient(config);
  }

  /**
   * Set data source mapper
   */
  setMapper(mapper: DataSourceMapper): void {
    this.mapper = mapper;
  }

  /**
   * Process import data with batch handling and progress tracking
   */
  async processData(
    rawData: any[],
    options: {
      source: string;
      dryRun?: boolean;
      continueOnError?: boolean;
    }
  ): Promise<ImportSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const startTime = new Date().toISOString();

    console.log(chalk.blue(`🚀 Starting import session: ${sessionId}`));
    console.log(chalk.gray(`Records: ${rawData.length}`));
    console.log(chalk.gray(`Batch size: ${this.config.batchSize}`));
    console.log(chalk.gray(`Mode: ${options.dryRun ? 'DRY RUN' : 'IMPORT'}`));

    const session: ImportSession = {
      sessionId,
      startTime,
      config: this.config,
      batches: [],
      summary: {
        totalRecords: rawData.length,
        successfulImports: 0,
        failedImports: 0,
        skippedDuplicates: 0,
        totalPhotos: 0,
        successfulPhotos: 0,
        failedPhotos: 0,
      },
    };

    try {
      // Split data into batches
      const batches = this.createBatches(rawData);
      console.log(chalk.blue(`📦 Created ${batches.length} batches`));

      // Process each batch
      let batchIndex = 0;
      for (const batch of batches) {
        // Check for cancellation before each batch
        if (checkCancellation()) {
          console.log(chalk.yellow('\n⚠️ Operation cancelled - returning partial results'));
          break;
        }
        
        batchIndex++;
        
        console.log(chalk.blue(`\n🔄 Processing batch ${batchIndex}/${batches.length}`));
        
        const batchResult = await this.processBatch(batch, batchIndex, options);
        session.batches.push(batchResult);

        // Update session summary
        this.updateSessionSummary(session, batchResult);

        // Display batch progress
        this.displayBatchProgress(batchResult, batchIndex, batches.length);

        // Check if we should continue on batch failures
        if (batchResult.summary.failed > 0 && !options.continueOnError) {
          console.log(chalk.yellow('⚠️ Stopping due to batch failures (use --continue-on-error to continue)'));
          break;
        }
      }

      session.endTime = new Date().toISOString();
      
      // Display final summary
      this.displayFinalSummary(session);

      return session;

    } catch (error) {
      console.error(chalk.red('❌ Import session failed:'), error);
      session.endTime = new Date().toISOString();
      throw error;
    }
  }

  /**
   * Create batches from raw data
   */
  private createBatches(rawData: any[]): any[][] {
    const batches: any[][] = [];
    
    for (let i = 0; i < rawData.length; i += this.config.batchSize) {
      const batch = rawData.slice(i, i + this.config.batchSize);
      batches.push(batch);
    }

    return batches;
  }

  /**
   * Process a single batch of records
   */
  private async processBatch(
    batch: any[],
    batchIndex: number,
    options: { source: string; dryRun?: boolean; continueOnError?: boolean }
  ): Promise<BatchResult> {
    const batchId = `batch_${batchIndex}_${Date.now()}`;
    const results: ImportResult[] = [];

    const spinner = ora(`Processing batch ${batchIndex} (${batch.length} records)`).start();

    try {
      for (let i = 0; i < batch.length; i++) {
        // Check for cancellation before each record
        if (checkCancellation()) {
          console.log(chalk.yellow(`⚠️ Batch ${batchIndex} cancelled - returning partial results`));
          break;
        }
        
        const rawRecord = batch[i];
        
        try {
          // Update spinner with current record
          spinner.text = `Processing batch ${batchIndex}: ${i + 1}/${batch.length}`;

          // Process single record
          const result = await this.processRecord(rawRecord, options);
          results.push(result);

          // Small delay to prevent overwhelming the API
          if (!options.dryRun && i < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (error) {
          // Handle individual record failures
          const recordId = this.extractRecordId(rawRecord);
          const title = this.extractRecordTitle(rawRecord);
          results.push({
            id: recordId,
            title: title,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            warnings: [],
            duplicateDetection: { isDuplicate: false, candidates: [] },
            photosProcessed: 0,
            photosFailed: 0,
          });

          console.warn(chalk.yellow(`⚠️ Record ${recordId} failed: ${error}`));
        }
      }

      spinner.succeed(`Batch ${batchIndex} completed`);

    } catch (error) {
      spinner.fail(`Batch ${batchIndex} failed`);
      throw error;
    }

    // Calculate batch summary
    const summary = {
      total: batch.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      skipped: results.filter(r => r.duplicateDetection.isDuplicate).length,
      duplicates: results.filter(r => r.duplicateDetection.isDuplicate).length,
    };

    return {
      batchId,
      results,
      summary,
    };
  }

  /**
   * Process a single record
   */
  private async processRecord(
    rawRecord: any,
    options: { source: string; dryRun?: boolean }
  ): Promise<ImportResult> {
    const recordId = this.extractRecordId(rawRecord);
    const title = this.extractRecordTitle(rawRecord);
    
    console.log(`[RECORD_PROCESSING_DEBUG] Starting record ${recordId}: "${title}"`);
    
    // Step 1: Use mapper if available (for non-standard data formats like Vancouver)
    let validationResult;
    if (this.mapper) {
      console.log(`[RECORD_PROCESSING_DEBUG] Using mapper for record ${recordId}`);
      validationResult = this.mapper.mapData(rawRecord);
      
      if (validationResult.isValid && validationResult.data?.tags) {
        const artistFromTags = validationResult.data.tags.artist || validationResult.data.tags.created_by;
        if (artistFromTags) {
          console.log(`[RECORD_PROCESSING_DEBUG] Mapped artist for record ${recordId}: "${artistFromTags}"`);
        } else {
          console.log(`[RECORD_PROCESSING_DEBUG] No artist found in tags for record ${recordId}`);
        }
      } else {
        console.log(`[RECORD_PROCESSING_DEBUG] No artist mapped for record ${recordId}`);
      }
    } else {
      // Step 1b: Validate raw data format using schema for standard format
      console.log(`[RECORD_PROCESSING_DEBUG] Using schema validation for record ${recordId}`);
      const parseResult = RawImportDataSchema.safeParse({
        ...rawRecord,
        source: options.source,
      });

      if (!parseResult.success) {
        console.log(`[RECORD_PROCESSING_DEBUG] Schema validation failed for record ${recordId}:`, parseResult.error.errors);
        return {
          id: recordId,
          title: title,
          success: false,
          error: `Invalid data format: ${parseResult.error.errors.map(e => e.message).join(', ')}`,
          warnings: [],
          duplicateDetection: { isDuplicate: false, candidates: [] },
          photosProcessed: 0,
          photosFailed: 0,
        };
      }

      validationResult = validateImportData(parseResult.data, this.config);
    }

    if (!validationResult.isValid) {
      console.log(`[RECORD_PROCESSING_DEBUG] Validation failed for record ${recordId}:`, validationResult.errors);
      return {
        id: recordId,
        title: title,
        success: false,
        error: `Validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
        warnings: validationResult.warnings.map(w => w.message),
        duplicateDetection: { isDuplicate: false, candidates: [] },
        photosProcessed: 0,
        photosFailed: 0,
      };
    }

    console.log(`[RECORD_PROCESSING_DEBUG] Record ${recordId} validation successful, submitting to API...`);

    // Step 2: Submit to API
    return await this.apiClient.submitImportRecord(validationResult.data!);
  }

  /**
   * Extract record ID from raw record for tracking
   */
  private extractRecordId(rawRecord: Record<string, unknown>): string {
    // Try various common ID fields
    return (
      rawRecord.id ||
      rawRecord.registryid ||
      rawRecord.external_id ||
      rawRecord.uuid ||
      `record_${Date.now()}_${Math.random().toString(36).substring(2)}`
    ) as string;
  }

  /**
   * Extract record title from raw record for tracking
   */
  private extractRecordTitle(rawRecord: Record<string, unknown>): string {
    // Try various common title fields
    return (
      rawRecord.title ||
      rawRecord.title_of_work ||
      rawRecord.name ||
      'Unknown'
    ) as string;
  }

  /**
   * Update session summary with batch results
   */
  private updateSessionSummary(session: ImportSession, batchResult: BatchResult): void {
    session.summary.successfulImports += batchResult.summary.successful;
    session.summary.failedImports += batchResult.summary.failed;
    session.summary.skippedDuplicates += batchResult.summary.duplicates;

    // Update photo counts
    for (const result of batchResult.results) {
      session.summary.totalPhotos += result.photosProcessed + result.photosFailed;
      session.summary.successfulPhotos += result.photosProcessed;
      session.summary.failedPhotos += result.photosFailed;
    }
  }

  /**
   * Display batch progress
   */
  private displayBatchProgress(
    batchResult: BatchResult,
    batchIndex: number,
    totalBatches: number
  ): void {
    const { summary } = batchResult;
    
    console.log(chalk.gray(`  ✅ Successful: ${summary.successful}`));
    console.log(chalk.gray(`  ❌ Failed: ${summary.failed}`));
    console.log(chalk.gray(`  ⚠️ Duplicates: ${summary.duplicates}`));
    
    const progress = ((batchIndex / totalBatches) * 100).toFixed(1);
    console.log(chalk.blue(`  📈 Progress: ${progress}% (${batchIndex}/${totalBatches} batches)`));
  }

  /**
   * Display final import summary
   */
  private displayFinalSummary(session: ImportSession): void {
    console.log('\n' + chalk.blue('🎯 Import Summary:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green(`✅ Successful imports: ${session.summary.successfulImports}`));
    console.log(chalk.red(`❌ Failed imports: ${session.summary.failedImports}`));
    console.log(chalk.yellow(`⚠️ Skipped duplicates: ${session.summary.skippedDuplicates}`));
    console.log(chalk.blue(`📷 Photos processed: ${session.summary.successfulPhotos}/${session.summary.totalPhotos}`));
    
    const successRate = ((session.summary.successfulImports / session.summary.totalRecords) * 100).toFixed(1);
    console.log(chalk.blue(`📈 Success rate: ${successRate}%`));
    
    if (session.endTime && session.startTime) {
      const duration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
      const durationMinutes = (duration / 60000).toFixed(1);
      console.log(chalk.blue(`⏱️ Duration: ${durationMinutes} minutes`));
    }
    
    console.log(chalk.blue(`📋 Session ID: ${session.sessionId}`));
  }
}