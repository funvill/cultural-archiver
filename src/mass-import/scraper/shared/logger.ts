/**
 * Simple logger for scrapers with console output
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
	private level: LogLevel = 'info';
	private levels: Record<LogLevel, number> = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
	};

	setLevel(level: LogLevel): void {
		this.level = level;
	}

	debug(message: string, meta?: Record<string, unknown>): void {
		this.log('debug', message, meta);
	}

	info(message: string, meta?: Record<string, unknown>): void {
		this.log('info', message, meta);
	}

	warn(message: string, meta?: Record<string, unknown>): void {
		this.log('warn', message, meta);
	}

	error(message: string, meta?: Record<string, unknown>): void {
		this.log('error', message, meta);
	}

	private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
		if (this.levels[level] < this.levels[this.level]) {
			return;
		}

		const timestamp = new Date().toISOString();
		const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
		const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';

		console.log(`${prefix} ${message}${metaStr}`);
	}
}

export const logger = new Logger();
