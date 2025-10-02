/**
 * Verbose Logging System for New Westminster Public Art Registry Data Collector
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
   * Get all logged entries
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Print a summary of key statistics
   */
  printSummary(data: {
    artworksFound: number;
    artistsFound: number;
    filesWritten: string[];
  }): void {
    const elapsedTime = this.getElapsedTime();
    const errors = this.getLogsByLevel(LogLevel.ERROR).length;
    const warnings = this.getLogsByLevel(LogLevel.WARN).length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 Collection Summary');
    console.log('='.repeat(60));
    console.log(`⏱️  Elapsed Time: ${elapsedTime}`);
    console.log(`🖼️  Artworks Found: ${data.artworksFound}`);
    console.log(`👤 Artists Found: ${data.artistsFound}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`\n📁 Files Written:`);
    data.filesWritten.forEach((file) => {
      console.log(`   - ${file}`);
    });
    console.log('='.repeat(60));
  }

  /**
   * Print a progress bar
   */
  printProgress(current: number, total: number, label: string): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 40;
    const filledLength = Math.round((barLength * current) / total);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    process.stdout.write(`\r${label}: [${bar}] ${percentage}% (${current}/${total})`);
    
    if (current === total) {
      process.stdout.write('\n');
    }
  }
}

// Export singleton instance
export const logger = new Logger();
