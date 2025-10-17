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

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (!v || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

const sanitizeArg = (value: unknown, seen: WeakSet<object> = new WeakSet(), depth = 0): unknown => {
  // Avoid deep recursion and circular refs
  const MAX_DEPTH = 5;
  if (depth > MAX_DEPTH) return '[MAX_DEPTH]';

  if (value === null || typeof value !== 'object') return value;

  // Protect against logging complex host objects (DOM nodes, Window, Map, Set, Function wrappers)
  if (!isPlainObject(value) && !Array.isArray(value)) {
    // For iterables like Map/Set, show size; for other host objects, show a brief type label
    try {
      if (value instanceof Map) return `[Map size=${value.size}]`;
      if (value instanceof Set) return `[Set size=${value.size}]`;
    } catch {
      // ignore instanceof failures across realms
    }
    const ctorName = (value as any)?.constructor?.name;
    return ctorName ? `[${ctorName}]` : '[Object]';
  }

  if (seen.has(value as object)) return '[Circular]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    return (value as unknown[]).map(v => sanitizeArg(v, seen, depth + 1));
  }

  const entry = value as Record<string, unknown>;
  const clone: Record<string, unknown> = {};

  Object.keys(entry).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('token') || lowerKey.includes('authorization')) {
      clone[key] = '[REDACTED]';
    } else {
      try {
        clone[key] = sanitizeArg(entry[key], seen, depth + 1);
      } catch (err) {
        clone[key] = `[SanitizeError:${(err as Error).message}]`;
      }
    }
  });

  return clone;
};

const sanitizeArgs = (args: unknown[]): unknown[] => args.map(v => sanitizeArg(v));

const shouldLog = (configured: LogLevel, requested: LogLevel): boolean =>
  levelIndex(requested) >= levelIndex(configured);

export const createLogger = (options: LoggerOptions = {}): Logger => {
  const resolvedLevel =
    options.level ?? discoverGlobalLevel() ?? DEFAULT_LEVEL;
  const moduleLabel = options.module ? `[${options.module}]` : '';

  const emit = (level: LogLevel, ...args: unknown[]): void => {
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
