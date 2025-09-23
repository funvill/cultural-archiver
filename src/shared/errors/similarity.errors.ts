/**
 * Typed error classes for similarity calculations and related operations
 * Replaces generic catch blocks with specific, actionable error types
 */

// ================================
// Base Error Classes
// ================================

/**
 * Base class for all similarity-related errors
 */
export abstract class SimilarityError extends Error {
  abstract readonly code: string;
  readonly timestamp: Date;
  readonly context: Record<string, unknown> | undefined;
  declare cause?: Error;

  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;

    if (cause) {
      this.cause = cause;
    }

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert error to JSON for logging/API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      cause:
        this.cause instanceof Error
          ? {
              name: this.cause.name,
              message: this.cause.message,
            }
          : undefined,
    };
  }
}

// ================================
// Similarity Calculation Errors
// ================================

/**
 * Error during similarity calculation for a specific artwork
 */
export class SimilarityCalculationError extends SimilarityError {
  readonly code = 'SIMILARITY_CALCULATION_FAILED';

  constructor(artworkId: string, cause: Error, context?: Record<string, unknown>) {
    super(
      `Similarity calculation failed for artwork ${artworkId}: ${cause.message}`,
      { artworkId, ...context },
      cause
    );
  }
}

/**
 * Error in distance calculation between coordinates
 */
export class DistanceCalculationError extends SimilarityError {
  readonly code = 'DISTANCE_CALCULATION_FAILED';

  constructor(
    coords1: { lat: number; lon: number },
    coords2: { lat: number; lon: number },
    cause: Error
  ) {
    super(`Distance calculation failed between coordinates`, { coords1, coords2 }, cause);
  }
}

/**
 * Error in title similarity calculation
 */
export class TitleSimilarityError extends SimilarityError {
  readonly code = 'TITLE_SIMILARITY_FAILED';

  constructor(title1: string, title2: string, cause: Error) {
    super(`Title similarity calculation failed`, { title1, title2 }, cause);
  }
}

/**
 * Error in tag similarity calculation
 */
export class TagSimilarityError extends SimilarityError {
  readonly code = 'TAG_SIMILARITY_FAILED';

  constructor(tags1: string[], tags2: string[], cause: Error) {
    super(`Tag similarity calculation failed`, { tags1, tags2 }, cause);
  }
}

// ================================
// Configuration Errors
// ================================

/**
 * Error in similarity configuration validation
 */
export class SimilarityConfigurationError extends SimilarityError {
  readonly code = 'SIMILARITY_CONFIG_INVALID';

  constructor(message: string, context?: Record<string, unknown>) {
    super(`Similarity configuration error: ${message}`, context);
  }
}

// ================================
// Service-Level Errors
// ================================

/**
 * Error in similarity service operations
 */
export class SimilarityServiceError extends SimilarityError {
  readonly code = 'SIMILARITY_SERVICE_ERROR';

  constructor(operation: string, cause: Error, context?: Record<string, unknown>) {
    super(
      `Similarity service operation '${operation}' failed: ${cause.message}`,
      { operation, ...context },
      cause
    );
  }
}

/**
 * Error during duplicate detection process
 */
export class DuplicateDetectionError extends SimilarityError {
  readonly code = 'DUPLICATE_DETECTION_FAILED';

  constructor(queryInfo: Record<string, unknown>, cause: Error) {
    super(`Duplicate detection failed`, { query: queryInfo }, cause);
  }
}

// ================================
// Input Validation Errors
// ================================

/**
 * Error for invalid input data in similarity operations
 */
export class SimilarityInputError extends SimilarityError {
  readonly code = 'SIMILARITY_INPUT_INVALID';

  constructor(field: string, value: unknown, reason: string) {
    super(`Invalid input for ${field}: ${reason}`, { field, value, reason });
  }
}

/**
 * Error for missing required data in similarity operations
 */
export class SimilarityDataMissingError extends SimilarityError {
  readonly code = 'SIMILARITY_DATA_MISSING';

  constructor(field: string, context?: Record<string, unknown>) {
    super(`Required similarity data missing: ${field}`, { field, ...context });
  }
}

// ================================
// Utility Functions
// ================================

/**
 * Check if an error is a similarity-related error
 */
export function isSimilarityError(error: unknown): error is SimilarityError {
  return error instanceof SimilarityError;
}

/**
 * Extract error code from similarity error, or return generic code for other errors
 */
export function getSimilarityErrorCode(error: unknown): string {
  if (isSimilarityError(error)) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

/**
 * Create error context for logging with safe serialization
 */
export function createErrorContext(data: Record<string, unknown>): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    try {
      // Ensure values are JSON-serializable
      JSON.stringify(value);
      context[key] = value;
    } catch {
      // Fall back to string representation for non-serializable values
      context[key] = String(value);
    }
  }

  return context;
}

/**
 * Wrap a function to catch and rethrow errors with proper typing
 */
export function wrapSimilarityOperation<T extends any[], R>(
  operation: string,
  fn: (...args: T) => R
): (...args: T) => R {
  return (...args: T): R => {
    try {
      return fn(...args);
    } catch (error) {
      if (error instanceof SimilarityError) {
        throw error; // Re-throw similarity errors as-is
      }

      // Wrap unknown errors
      throw new SimilarityServiceError(
        operation,
        error instanceof Error ? error : new Error(String(error)),
        createErrorContext({ args })
      );
    }
  };
}

/**
 * Async version of wrapSimilarityOperation
 */
export function wrapAsyncSimilarityOperation<T extends any[], R>(
  operation: string,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof SimilarityError) {
        throw error; // Re-throw similarity errors as-is
      }

      // Wrap unknown errors
      throw new SimilarityServiceError(
        operation,
        error instanceof Error ? error : new Error(String(error)),
        createErrorContext({ args })
      );
    }
  };
}
