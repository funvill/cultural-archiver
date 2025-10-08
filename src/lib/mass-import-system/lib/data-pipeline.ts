/**
 * Mass Import Plugin System - Data Pipeline
 *
 * This module orchestrates the flow of data from importers through exporters,
 * handles configuration loading, error management, and progress tracking.
 */

import type {
  ImporterPlugin,
  ExporterPlugin,
  ImporterConfig,
  ExporterConfig,
  ProcessingOptions,
  PipelineResult,
  ProcessingSummary,
  ExportResult,
  ProcessingReport,
} from '../types/plugin.js';
import type { RawImportData } from '../types/index.js';
import { ReportTracker } from './report-tracker.js';
import { LocationEnhancer } from './location-enhancer.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ================================
// Data Pipeline Class
// ================================

export class DataPipeline {
  constructor(
    private importer: ImporterPlugin,
    private exporter: ExporterPlugin
  ) {}

  /**
   * Process data through the importer → exporter pipeline
   */
  async process(inputData: unknown, options: ProcessingOptions): Promise<PipelineResult> {
    const startTime = Date.now();

    // 1. Initialize report tracker
    const reportTracker = new ReportTracker(options.generateReport ?? false);
    reportTracker.startOperation({
      importer: this.importer.name,
      exporter: this.exporter.name,
      inputFile: options.inputFile ?? 'unknown',
      parameters: {
        ...(options.dryRun !== undefined && { dryRun: options.dryRun }),
        ...(options.batchSize !== undefined && { batchSize: options.batchSize }),
        ...(options.generateReport !== undefined && { generateReport: options.generateReport }),
        ...(options.inputFile !== undefined && { inputFile: options.inputFile }),
        ...(options.reportPath !== undefined && { reportPath: options.reportPath }),
        ...(options.exporterOptions && { exporterOptions: options.exporterOptions }),
        ...(options.exporterConfig && { exporterConfig: options.exporterConfig }),
      },
    });

    try {
      // 2. Load importer-specific configuration
      // If an importerConfig was passed via options and it's non-empty, use it.
      // Otherwise, try to load the importer-specific config file.
      let importerConfig: ImporterConfig;
      if (options.importerConfig && Object.keys(options.importerConfig).length > 0) {
        importerConfig = options.importerConfig;
      } else {
        importerConfig = await this.loadImporterConfig();
      }

      // 3. Validate input data with importer
      console.log(`🔍 Validating input data with ${this.importer.name} importer...`);
      const validation = await this.importer.validateData(inputData);

      if (!validation.isValid) {
        const errorMessage = 'Input data validation failed';
        reportTracker.recordFailure('validation', 'validation_failed', validation.errors);

        // Format error messages for better CLI output
        const errorMessages = validation.errors?.map(err => `${err.field}: ${err.message}`) || [
          'Unknown validation error',
        ];
        throw new Error(`${errorMessage}: ${errorMessages.join('; ')}`);
      }

      console.log(`✅ Input data validation passed`);

      // 4. Transform data using importer
      console.log(`🔄 Transforming data with ${this.importer.name} importer...`);
      let unifiedData = await this.importer.mapData(inputData, importerConfig);

      // 4.1. Apply offset if specified (skip first N records)
      if (options.offset && options.offset > 0) {
        const originalCount = unifiedData.length;
        unifiedData = unifiedData.slice(options.offset);
        console.log(
          `⏭️  Skipped first ${options.offset} records (${unifiedData.length} remaining from ${originalCount} total)`
        );
      }

      // 4.2. Apply limit if specified (take first N records after offset)
      if (options.limit && options.limit > 0) {
        const preLimit = unifiedData.length;
        unifiedData = unifiedData.slice(0, options.limit);
        console.log(`🔢 Limited to ${options.limit} records (from ${preLimit} after offset)`);
      }

      reportTracker.recordProcessedRecords(unifiedData.length);

      console.log(`✅ Transformed ${unifiedData.length} records`);

      // 4.3. Enhance with location data only when explicitly enabled (opt-in)
      if (options.locationEnhancement && options.locationEnhancement.enabled === true) {
        console.log(`🌍 Enhancing records with location data...`);
        const locationEnhancer = new LocationEnhancer(options.locationEnhancement);

        try {
          const enhancementResult = await locationEnhancer.enhanceRecords(unifiedData);
          unifiedData = enhancementResult.records;

          console.log(
            `✅ Location enhancement completed: ${enhancementResult.result.fromCache} from cache, ${enhancementResult.result.fromApi} from API`
          );

          // TODO: Track enhancement stats in the report when available
        } finally {
          locationEnhancer.close();
        }
      }

      // 5. Configure exporter
      console.log(`⚙️ Configuring ${this.exporter.name} exporter...`);
      await this.exporter.configure(options.exporterOptions ?? {});

      // 6. Export processed data with detailed tracking
      console.log(`📤 Exporting data with ${this.exporter.name} exporter...`);
      const exportResult = await this.exportWithTracking(
        unifiedData,
        options.exporterConfig ?? {},
        reportTracker,
        options
      );

      // 6a. Track duplicate count in report tracker
      if (exportResult.recordsDuplicate !== undefined) {
        reportTracker.setDuplicateCount(exportResult.recordsDuplicate);
      }

      // 7. Generate final report if requested
      if (options.generateReport) {
        const report = await reportTracker.generateReport();
        await this.saveReport(report, options.reportPath);
      }

      // 8. Generate summary
      const processingTime = Date.now() - startTime;
      const summary = this.generateSummary(unifiedData, exportResult, processingTime);

      return {
        importedCount: unifiedData.length,
        exportResult,
        summary,
        ...(options.generateReport && { report: await reportTracker.generateReport() }),
      };
    } catch (error) {
      // Handle pipeline errors
      reportTracker.recordError(
        'pipeline_error',
        error instanceof Error ? error.message : 'Unknown pipeline error',
        error
      );

      if (options.generateReport) {
        const report = await reportTracker.generateReport();
        await this.saveReport(report, options.reportPath);
      }

      throw error;
    }
  }

  // ================================
  // Configuration Management
  // ================================

  /**
   * Load importer-specific configuration
   */
  private async loadImporterConfig(): Promise<ImporterConfig> {
    try {
      // Check for importer-specific config file
      const configFileName = `${this.importer.name}-config.json`;
      
      // Resolve path based on the current file location in the compiled structure
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      // From dist/lib/mass-import-system/lib/data-pipeline.js, go to dist/importers
      const configPath = path.join(currentDir, '../../../../importers', configFileName);

      try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent) as ImporterConfig;
        console.log(`📋 Loaded configuration for ${this.importer.name} importer`);
        return config;
      } catch (configError) {
        // Config file not found or invalid, use defaults
        console.log(`⚠️ No configuration file found for ${this.importer.name}, using defaults`);
        return {};
      }
    } catch (error) {
      console.warn(`Warning: Failed to load importer configuration:`, error);
      return {};
    }
  }

  // ================================
  // Export Processing
  // ================================

  /**
   * Export data with detailed tracking for each record
   */
  private async exportWithTracking(
    unifiedData: RawImportData[],
    exportConfig: ExporterConfig,
    tracker: ReportTracker,
    options: ProcessingOptions
  ): Promise<ExportResult> {
    try {
      // Validate exporter configuration
      const configValidation = await this.exporter.validate(exportConfig);
      if (!configValidation.isValid) {
        throw new Error(
          `Exporter configuration validation failed: ${configValidation.errors?.join(', ')}`
        );
      }

      // Process records in batches if specified
      const batchSize = exportConfig.batchSize ?? 50;
      const batches: RawImportData[][] = [];

      for (let i = 0; i < unifiedData.length; i += batchSize) {
        batches.push(unifiedData.slice(i, i + batchSize));
      }

      let totalSuccessful = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      let totalDuplicates = 0;
      const allErrors: string[] = [];
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = options.maxConsecutiveErrors ?? 5;

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        if (!batch) continue; // Skip undefined batches

        console.log(
          `📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} records)`
        );

        try {
          const batchResult = await this.exporter.export(batch, exportConfig);

          totalSuccessful += batchResult.recordsSuccessful;
          totalFailed += batchResult.recordsFailed;
          totalSkipped += batchResult.recordsSkipped;
          totalDuplicates += batchResult.recordsDuplicate || 0;

          // Check for batch-level failures
          if (batchResult.recordsFailed === batch.length) {
            // All records in batch failed - increment consecutive errors
            consecutiveErrors++;
            console.error(
              `⚠️  All ${batch.length} records in batch ${batchIndex + 1} failed (consecutive errors: ${consecutiveErrors}/${maxConsecutiveErrors})`
            );

            if (consecutiveErrors >= maxConsecutiveErrors) {
              const errorMsg = `Aborting: ${consecutiveErrors} consecutive batch failures detected. This usually indicates the API server is down or misconfigured.`;
              console.error(`🛑 ${errorMsg}`);
              throw new Error(errorMsg);
            }
          } else if (batchResult.recordsSuccessful > 0) {
            // At least some records succeeded - reset counter
            consecutiveErrors = 0;
          }

          if (batchResult.errors) {
            allErrors.push(...batchResult.errors.map(e => e.message));
          }

          // Track individual records for reporting
          if (batchResult.details?.processedRecords) {
            for (const recordResult of batchResult.details.processedRecords) {
              switch (recordResult.status) {
                case 'success':
                  tracker.recordSuccess(
                    recordResult.externalId,
                    'exported',
                    recordResult.recordData
                  );
                  break;
                case 'failed':
                  tracker.recordFailure(
                    recordResult.externalId,
                    'export_failed',
                    recordResult.error,
                    recordResult.recordData
                  );
                  break;
                case 'skipped':
                  tracker.recordSkipped(
                    recordResult.externalId,
                    recordResult.reason ?? 'skipped',
                    recordResult.recordData
                  );
                  break;
              }
            }
          } else {
            // Fallback: track batch-level results if detailed results aren't available
            for (const record of batch) {
              const externalId = this.importer.generateImportId(record);
              if (batchResult.success) {
                tracker.recordSuccess(externalId, 'exported', record);
              } else {
                tracker.recordFailure(externalId, 'export_failed', batchResult.summary, record);
              }
            }
          }
        } catch (batchError) {
          console.error(`❌ Batch ${batchIndex + 1} failed:`, batchError);
          totalFailed += batch.length;

          // Track failed records in this batch
          for (const record of batch) {
            const externalId = this.importer.generateImportId(record);
            tracker.recordFailure(externalId, 'batch_error', batchError, record);
          }

          allErrors.push(
            batchError instanceof Error ? batchError.message : 'Batch processing error'
          );
        }
      }

      // Return aggregated results
      return {
        success: totalFailed === 0,
        recordsProcessed: unifiedData.length,
        recordsSuccessful: totalSuccessful,
        recordsFailed: totalFailed,
        recordsSkipped: totalSkipped,
        recordsDuplicate: totalDuplicates,
        ...(allErrors.length > 0 && {
          errors: allErrors.map(msg => ({
            field: 'export',
            message: msg,
            severity: 'error' as const,
          })),
        }),
        summary: `Processed ${unifiedData.length} records: ${totalSuccessful} successful, ${totalFailed} failed, ${totalSkipped} skipped`,
      };
    } catch (error) {
      // Handle export-level errors
      const errorMessage = error instanceof Error ? error.message : 'Export processing failed';
      console.error(`❌ Export failed:`, error);

      // Track all records as failed
      for (const record of unifiedData) {
        const externalId = this.importer.generateImportId(record);
        tracker.recordFailure(externalId, 'export_error', error, record);
      }

      return {
        success: false,
        recordsProcessed: unifiedData.length,
        recordsSuccessful: 0,
        recordsFailed: unifiedData.length,
        recordsSkipped: 0,
        errors: [{ field: 'export', message: errorMessage, severity: 'error' }],
        summary: `Export failed: ${errorMessage}`,
      };
    }
  }

  // ================================
  // Report Management
  // ================================

  /**
   * Save processing report to file
   */
  private async saveReport(report: ProcessingReport, reportPath?: string): Promise<void> {
    try {
      // Generate human-readable timestamp: YYYY-MM-DD-HHMMSS
      const now = new Date();
      const timestamp =
        now.getFullYear() +
        '-' +
        String(now.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(now.getDate()).padStart(2, '0') +
        '-' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');

      const defaultPath = `./reports/mass-import-${timestamp}.json`;
      const outputPath = reportPath ?? defaultPath;

      // Ensure reports directory exists
      const reportsDir = path.dirname(outputPath);
      await fs.mkdir(reportsDir, { recursive: true });

      // Write report file
      await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`📊 Report saved to: ${outputPath}`);
    } catch (error) {
      console.error(`⚠️ Failed to save report:`, error);
    }
  }

  // ================================
  // Summary Generation
  // ================================

  /**
   * Generate processing summary
   */
  private generateSummary(
    importedData: RawImportData[],
    exportResult: ExportResult,
    processingTime: number
  ): ProcessingSummary {
    const totalRecords = importedData.length;
    const successfulRecords = exportResult.recordsSuccessful;
    const failedRecords = exportResult.recordsFailed;
    const skippedRecords = exportResult.recordsSkipped;
    const duplicateRecords = exportResult.recordsDuplicate || 0;

    return {
      totalRecords,
      successfulRecords,
      failedRecords,
      skippedRecords,
      duplicateRecords,
      processingTime,
      averageRecordTime: totalRecords > 0 ? processingTime / totalRecords : 0,
    };
  }
}

export default DataPipeline;
