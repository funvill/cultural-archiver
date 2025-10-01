/**
 * Verbose Logging System for Burnaby Art Gallery Data Collector
 *
 * Provides debug-level logging for every action taken during scraping.
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

class Logger {
  private logs: LogEntry[] = [];
  private startTime: number = Date.now();

  /**
   * Log a debug message
   */
  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = { timestamp, level, message, data };

    this.logs.push(entry);

    // Console output with color coding
    const color = this.getColor(level);
    const prefix = `[${timestamp}] [${level}]`;
    
    if (data !== undefined) {
      console.log(color, prefix, message, data);
    } else {
      console.log(color, prefix, message);
    }
  }

  /**
   * Get console color for log level
   */
  private getColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '\x1b[90m'; // Gray
      case LogLevel.INFO:
        return '\x1b[36m'; // Cyan
      case LogLevel.WARN:
        return '\x1b[33m'; // Yellow
      case LogLevel.ERROR:
        return '\x1b[31m'; // Red
      default:
        return '\x1b[0m'; // Reset
    }
  }

  /**
   * Get elapsed time since logger was created
   */
  getElapsedTime(): string {
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Generate summary statistics
   */
  getSummary(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    warnings: LogEntry[];
    errors: LogEntry[];
    elapsedTime: string;
  } {
    const byLevel = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
    };

    const warnings: LogEntry[] = [];
    const errors: LogEntry[] = [];

    for (const entry of this.logs) {
      byLevel[entry.level]++;
      if (entry.level === LogLevel.WARN) {
        warnings.push(entry);
      } else if (entry.level === LogLevel.ERROR) {
        errors.push(entry);
      }
    }

    return {
      total: this.logs.length,
      byLevel,
      warnings,
      errors,
      elapsedTime: this.getElapsedTime(),
    };
  }

  /**
   * Print final summary report
   */
  printSummary(stats: {
    artworksFound: number;
    artistsFound: number;
    filesWritten: string[];
  }): void {
    const summary = this.getSummary();

    console.log('\n' + '='.repeat(60));
    console.log('FINAL SUMMARY REPORT');
    console.log('='.repeat(60));
    
    console.log('\n📊 Collection Statistics:');
    console.log(`  Total Artworks Found: ${stats.artworksFound}`);
    console.log(`  Total Artists Found: ${stats.artistsFound}`);
    console.log(`  Files Written: ${stats.filesWritten.length}`);
    stats.filesWritten.forEach((file) => {
      console.log(`    - ${file}`);
    });

    console.log('\n📝 Logging Statistics:');
    console.log(`  Total Log Entries: ${summary.total}`);
    console.log(`  Debug: ${summary.byLevel[LogLevel.DEBUG]}`);
    console.log(`  Info: ${summary.byLevel[LogLevel.INFO]}`);
    console.log(`  Warnings: ${summary.byLevel[LogLevel.WARN]}`);
    console.log(`  Errors: ${summary.byLevel[LogLevel.ERROR]}`);

    if (summary.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      summary.warnings.forEach((warn) => {
        console.log(`  - ${warn.message}`);
      });
    }

    if (summary.errors.length > 0) {
      console.log('\n❌ Errors:');
      summary.errors.forEach((err) => {
        console.log(`  - ${err.message}`);
      });
    }

    console.log(`\n⏱️  Total Execution Time: ${summary.elapsedTime}`);
    console.log('='.repeat(60) + '\n');
  }
}

// Singleton logger instance
export const logger = new Logger();
