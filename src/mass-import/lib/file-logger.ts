/**
 * File Logger for Mass Import CLI
 * 
 * Captures console output to both console and log file
 */

import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';

export class FileLogger {
  private logFilePath: string;
  private logStream: fs.WriteStream | null = null;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  };

  constructor(logDir: string = './logs/mass-import', prefix: string = 'import') {
    // Create timestamp for log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const logFileName = `${prefix}-${timestamp}.log`;
    
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    this.logFilePath = path.join(logDir, logFileName);
    
    // Store original console methods
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
    };
  }

  /**
   * Start logging to file
   */
  start(): void {
    // Create write stream
    this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    
    // Write header
    const header = `=== Mass Import Log - ${new Date().toISOString()} ===\n`;
    this.logStream.write(header);
    
    // Override console methods
    const writeToFile = (level: string, ...args: unknown[]): void => {
      if (this.logStream) {
        const timestamp = new Date().toISOString();
        const message = format(...args);
        const strippedMessage = this.stripAnsi(message);
        this.logStream.write(`[${timestamp}] [${level}] ${strippedMessage}\n`);
      }
    };

    console.log = (...args: unknown[]): void => {
      this.originalConsole.log(...args);
      writeToFile('LOG', ...args);
    };

    console.error = (...args: unknown[]): void => {
      this.originalConsole.error(...args);
      writeToFile('ERROR', ...args);
    };

    console.warn = (...args: unknown[]): void => {
      this.originalConsole.warn(...args);
      writeToFile('WARN', ...args);
    };

    console.info = (...args: unknown[]): void => {
      this.originalConsole.info(...args);
      writeToFile('INFO', ...args);
    };
  }

  /**
   * Stop logging and restore original console
   */
  stop(): void {
    // Restore original console methods
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    
    // Close stream
    if (this.logStream) {
      const footer = `\n=== Log End - ${new Date().toISOString()} ===\n`;
      this.logStream.write(footer);
      this.logStream.end();
      this.logStream = null;
    }
  }

  /**
   * Get the log file path
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * Strip ANSI color codes from text
   */
  private stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }
}
