/**
 * Mass Import Plugin System - Report Tracker
 *
 * This module provides comprehensive tracking and reporting for mass import operations,
 * including individual record processing, timing, and detailed error reporting.
 */

import type {
  ReportRecord,
  ReportSummary,
  ReportMetadata,
  ProcessingReport,
  ReportError,
} from '../types/plugin.js';
import type { RawImportData } from '../types/index.js';
import * as os from 'os';

// ================================
// Operation Parameters Interface
// ================================

export interface OperationParams {
  importer: string;
  exporter: string;
  inputFile: string;
  parameters: Record<string, unknown>;
}

// ================================
// Report Tracker Class
// ================================

export class ReportTracker {
  private enabled: boolean;
  private records: ReportRecord[] = [];
  private errors: ReportError[] = [];
  private metadata: ReportMetadata | null = null;
  private startTime: Date;
  private recordStartTimes: Map<string, number> = new Map();
  private duplicateCount: number = 0; // Track duplicate records

  constructor(enabled: boolean) {
    this.enabled = enabled;
    this.startTime = new Date();
  }

  // ================================
  // Operation Management
  // ================================

  /**
   * Start tracking an operation
   */
  startOperation(params: OperationParams): void {
    if (!this.enabled) return;

    this.startTime = new Date();
    this.metadata = {
      operation: {
        importer: params.importer,
        exporter: params.exporter,
        inputFile: params.inputFile,
        startTime: this.startTime.toISOString(),
        endTime: '', // Will be set when operation completes
        duration: 0, // Will be calculated when operation completes
      },
      parameters: {
        cliFlags: this.extractCliFlags(params.parameters),
        importerConfig: this.extractConfig(params.parameters, 'importer'),
        exporterConfig: this.extractConfig(params.parameters, 'exporter'),
        ...(this.extractNumber(params.parameters, 'batchSize') !== undefined && {
          batchSize: this.extractNumber(params.parameters, 'batchSize')!,
        }),
        ...(this.extractBoolean(params.parameters, 'dryRun') !== undefined && {
          dryRun: this.extractBoolean(params.parameters, 'dryRun')!,
        }),
      },
      environment: {
        nodeVersion: process.version,
        platform: `${os.platform()} ${os.release()}`,
        timestamp: new Date().toISOString(),
      },
    };

    console.log(`📊 Report tracking started for ${params.importer} → ${params.exporter}`);
  }

  /**
   * Record that records have been processed (for summary statistics)
   */
  recordProcessedRecords(count: number): void {
    if (!this.enabled) return;
    console.log(`📈 Processing ${count} records...`);
  }

  // ================================
  // Record Tracking
  // ================================

  /**
   * Record a successful operation for a specific record
   */
  recordSuccess(externalId: string, reason: string, data?: RawImportData): void {
    if (!this.enabled) return;

    const processingTime = this.calculateRecordTime(externalId);

    const record: ReportRecord = {
      id: this.generateRecordId(),
      externalId,
      status: 'successful',
      reason,
      timestamp: new Date().toISOString(),
      ...(data && { data }),
      ...(processingTime !== undefined && { processingTime }),
    };

    this.records.push(record);
  }

  /**
   * Record a failed operation for a specific record
   */
  recordFailure(externalId: string, reason: string, error?: unknown, data?: RawImportData): void {
    if (!this.enabled) return;

    const processingTime = this.calculateRecordTime(externalId);

    const record: ReportRecord = {
      id: this.generateRecordId(),
      externalId,
      status: 'failed',
      reason,
      timestamp: new Date().toISOString(),
      ...(error !== undefined && { error: this.sanitizeError(error) }),
      ...(data && { data }),
      ...(processingTime !== undefined && { processingTime }),
    };

    this.records.push(record);

    // Also add to errors collection for quick access
    this.errors.push({
      type: 'processing',
      message: `Record ${externalId} failed: ${reason}`,
      details: this.sanitizeError(error),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record a skipped operation for a specific record
   */
  recordSkipped(
    externalId: string, 
    reason: string, 
    data?: RawImportData, 
    duplicateInfo?: ReportRecord['duplicateInfo']
  ): void {
    if (!this.enabled) return;

    const processingTime = this.calculateRecordTime(externalId);

    const record: ReportRecord = {
      id: this.generateRecordId(),
      externalId,
      status: 'skipped',
      reason,
      timestamp: new Date().toISOString(),
      ...(data && { data }),
      ...(processingTime !== undefined && { processingTime }),
      ...(duplicateInfo && { duplicateInfo }),
    };

    this.records.push(record);
  }

  /**
   * Record an operation with custom status
   */
  recordOther(externalId: string, reason: string, data?: RawImportData): void {
    if (!this.enabled) return;

    const processingTime = this.calculateRecordTime(externalId);

    const record: ReportRecord = {
      id: this.generateRecordId(),
      externalId,
      status: 'other',
      reason,
      timestamp: new Date().toISOString(),
      ...(data && { data }),
      ...(processingTime !== undefined && { processingTime }),
    };

    this.records.push(record);
  }

  /**
   * Set the count of duplicate records detected during export
   */
  setDuplicateCount(count: number): void {
    if (!this.enabled) return;
    this.duplicateCount = count;
  }

  // ================================
  // Error Tracking
  // ================================

  /**
   * Record a system-level error
   */
  recordError(type: string, message: string, details?: unknown): void {
    if (!this.enabled) return;

    this.errors.push({
      type: type as ReportError['type'],
      message,
      details: this.sanitizeError(details),
      timestamp: new Date().toISOString(),
    });
  }

  // ================================
  // Report Generation
  // ================================

  /**
   * Generate a complete processing report
   */
  async generateReport(): Promise<ProcessingReport> {
    if (!this.enabled) {
      throw new Error('Report generation is disabled');
    }

    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    // Update metadata with completion information
    if (this.metadata) {
      this.metadata.operation.endTime = endTime.toISOString();
      this.metadata.operation.duration = duration;
    }

    const summary = this.calculateSummary(duration);

    return {
      metadata: this.metadata!,
      summary,
      records: this.records,
      errors: this.errors,
    };
  }

  /**
   * Get current report state (for progress tracking)
   */
  getReport(): Partial<ProcessingReport> {
    if (!this.enabled) {
      return { records: [], errors: [] };
    }

    const currentTime = new Date();
    const duration = currentTime.getTime() - this.startTime.getTime();
    const summary = this.calculateSummary(duration);

    return {
      summary,
      records: this.records,
      errors: this.errors,
    };
  }

  // ================================
  // Summary Calculation
  // ================================

  /**
   * Calculate summary statistics
   */
  private calculateSummary(duration: number): ReportSummary {
    const total = this.records.length;
    const successful = this.records.filter(r => r.status === 'successful').length;
    const failed = this.records.filter(r => r.status === 'failed').length;
    const skipped = this.records.filter(r => r.status === 'skipped').length;
    const other = this.records.filter(r => r.status === 'other').length;

    // Calculate average processing time per record
    const recordsWithTiming = this.records.filter(r => typeof r.processingTime === 'number');
    const totalRecordTime = recordsWithTiming.reduce((sum, r) => sum + (r.processingTime || 0), 0);
    const averageRecordTime =
      recordsWithTiming.length > 0 ? totalRecordTime / recordsWithTiming.length : 0;

    return {
      totalRecords: total,
      successful,
      failed,
      skipped,
      other,
      duplicateRecords: this.duplicateCount,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      processingTime: duration,
      averageRecordTime,
    };
  }

  // ================================
  // Utility Methods
  // ================================

  /**
   * Calculate processing time for a specific record
   */
  private calculateRecordTime(externalId: string): number | undefined {
    const startTime = this.recordStartTimes.get(externalId);
    if (startTime) {
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      this.recordStartTimes.delete(externalId);
      return processingTime;
    }
    return undefined;
  }

  /**
   * Start timing for a specific record
   */
  startRecordTiming(externalId: string): void {
    if (!this.enabled) return;
    this.recordStartTimes.set(externalId, Date.now());
  }

  /**
   * Generate a unique record ID
   */
  private generateRecordId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize error objects for JSON serialization
   */
  private sanitizeError(error: unknown): unknown {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (typeof error === 'object' && error !== null) {
      try {
        // Try to serialize the object
        JSON.stringify(error);
        return error;
      } catch {
        // If serialization fails, convert to string
        return String(error);
      }
    }

    return error;
  }

  /**
   * Extract CLI flags from parameters
   */
  private extractCliFlags(params: Record<string, unknown>): string[] {
    const flags: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'boolean' && value) {
        flags.push(`--${key}`);
      } else if (typeof value === 'string' || typeof value === 'number') {
        flags.push(`--${key}`, String(value));
      }
    }

    return flags;
  }

  /**
   * Extract configuration object from parameters
   */
  private extractConfig(params: Record<string, unknown>, type: 'importer' | 'exporter'): object {
    const configKey = `${type}Config`;
    const config = params[configKey];
    return typeof config === 'object' && config !== null ? config : {};
  }

  /**
   * Extract number value from parameters
   */
  private extractNumber(params: Record<string, unknown>, key: string): number | undefined {
    const value = params[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  /**
   * Extract boolean value from parameters
   */
  private extractBoolean(params: Record<string, unknown>, key: string): boolean | undefined {
    const value = params[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return undefined;
  }

  // ================================
  // Statistics and Analysis
  // ================================

  /**
   * Get processing statistics by status
   */
  getStatsByStatus(): Record<string, number> {
    const stats: Record<string, number> = {
      successful: 0,
      failed: 0,
      skipped: 0,
      other: 0,
    };

    for (const record of this.records) {
      stats[record.status] = (stats[record.status] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get error statistics by type
   */
  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const error of this.errors) {
      stats[error.type] = (stats[error.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    totalProcessingTime: number;
    averageRecordTime: number;
    recordsPerSecond: number;
    recordsWithTiming: number;
  } {
    const currentTime = Date.now();
    const totalProcessingTime = currentTime - this.startTime.getTime();

    const recordsWithTiming = this.records.filter(r => typeof r.processingTime === 'number');
    const totalRecordTime = recordsWithTiming.reduce((sum, r) => sum + (r.processingTime || 0), 0);
    const averageRecordTime =
      recordsWithTiming.length > 0 ? totalRecordTime / recordsWithTiming.length : 0;

    const recordsPerSecond =
      totalProcessingTime > 0 ? (this.records.length / totalProcessingTime) * 1000 : 0;

    return {
      totalProcessingTime,
      averageRecordTime,
      recordsPerSecond,
      recordsWithTiming: recordsWithTiming.length,
    };
  }

  /**
   * Check if reporting is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current record count
   */
  getRecordCount(): number {
    return this.records.length;
  }

  /**
   * Get current error count
   */
  getErrorCount(): number {
    return this.errors.length;
  }
}

export default ReportTracker;
