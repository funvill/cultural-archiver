type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const DEFAULT_LEVEL: LogLevel = 'info';

export interface LoggerOptions {
  module?: string;
  level?: LogLevel;
}

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const levelIndex = (level: LogLevel): number => LOG_LEVELS.indexOf(level);

export const toLogLevel = (value: unknown): LogLevel | undefined => {
  if (typeof value !== 'string') return undefined;
  const lower = value.toLowerCase() as LogLevel;
  return LOG_LEVELS.includes(lower) ? lower : undefined;
};

const discoverGlobalLevel = (): LogLevel | undefined => {
  // Check process.env first (Node/vite build)
  try {
    if (typeof process !== 'undefined' && process?.env?.LOG_LEVEL) {
      const level = toLogLevel(process.env.LOG_LEVEL);
      if (level) return level;
    }
  } catch {
    // ignore reference errors
  }

  // Cloudflare/workers: allow attaching global level
  try {
    if (typeof globalThis !== 'undefined') {
      const globalRecord = globalThis as Record<string, unknown>;
      const maybeWindowValue = globalRecord['window'];
      const maybeWindow =
        typeof maybeWindowValue === 'object' && maybeWindowValue !== null
          ? (maybeWindowValue as Record<string, unknown>)
          : undefined;

      const candidates = [
        globalRecord['__LOG_LEVEL__'],
        globalRecord['LOG_LEVEL'],
        maybeWindow?.['__LOG_LEVEL__'],
        maybeWindow?.['LOG_LEVEL'],
      ];

      for (const candidate of candidates) {
        const level = toLogLevel(candidate);
        if (level) return level;
      }
    }
  } catch {
    // ignore
  }

  return undefined;
};

const sanitizeArg = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;

  // Shallow clone to avoid mutating original references
  if (Array.isArray(value)) {
    return value.map(sanitizeArg);
  }

  const entry = value as Record<string, unknown>;
  const clone: Record<string, unknown> = {};

  Object.keys(entry).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('token') || lowerKey.includes('authorization')) {
      clone[key] = '[REDACTED]';
    } else {
      clone[key] = sanitizeArg(entry[key]);
    }
  });

  return clone;
};

const sanitizeArgs = (args: unknown[]): unknown[] => args.map(sanitizeArg);

const shouldLog = (configured: LogLevel, requested: LogLevel): boolean =>
  levelIndex(requested) >= levelIndex(configured);

export const createLogger = (options: LoggerOptions = {}): Logger => {
  const resolvedLevel =
    options.level ?? discoverGlobalLevel() ?? DEFAULT_LEVEL;
  const moduleLabel = options.module ? `[${options.module}]` : '';

  const emit = (level: LogLevel, ...args: unknown[]) => {
    if (!shouldLog(resolvedLevel, level)) return;

    const payload = sanitizeArgs(args);
    const parts: unknown[] = [];

    if (moduleLabel) parts.push(moduleLabel);

    switch (level) {
      case 'debug':
        console.debug(...parts, ...payload);
        break;
      case 'info':
        console.info(...parts, ...payload);
        break;
      case 'warn':
        console.warn(...parts, ...payload);
        break;
      case 'error':
      default:
        console.error(...parts, ...payload);
        break;
    }
  };

  return {
    debug: (...args: unknown[]) => emit('debug', ...args),
    info: (...args: unknown[]) => emit('info', ...args),
    warn: (...args: unknown[]) => emit('warn', ...args),
    error: (...args: unknown[]) => emit('error', ...args),
  };
};

export type { LogLevel };
