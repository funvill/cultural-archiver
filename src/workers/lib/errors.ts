/**
 * Error handling utilities with consistent response formatting and progressive disclosure
 * Provides standardized error responses following the PRD specification
 */

import type { Context } from 'hono';
import type { ApiErrorResponse, ValidationError, WorkerEnv } from '../types';
import { createApiErrorResponse } from '../../shared/types';

export interface ErrorOptions {
  showDetails?: boolean;
  correlationId?: string;
  statusCode?: number;
}

/**
 * Custom error class for API errors with structured information
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown> | undefined;
  public readonly validationErrors: ValidationError[] | undefined;
  public readonly showDetails: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 400,
    options: {
      details?: Record<string, unknown>;
      validationErrors?: ValidationError[];
      showDetails?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = options.details;
    this.validationErrors = options.validationErrors;
    this.showDetails = options.showDetails ?? true;
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationApiError extends ApiError {
  constructor(validationErrors: ValidationError[], message?: string) {
    // Use the first validation error's message if only one error and no custom message
    const firstError = validationErrors[0];
    const finalMessage =
      message ||
      (validationErrors.length === 1 && firstError?.message
        ? firstError.message
        : 'Validation failed');

    super(finalMessage, 'VALIDATION_ERROR', 400, {
      validationErrors,
      showDetails: true,
    });
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends ApiError {
  constructor(retryAfter: number, message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, {
      details: { retry_after: retryAfter },
      showDetails: true,
    });
  }
}

/**
 * Not found error
 */
export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;

    super(message, 'NOT_FOUND', 404, {
      details: { resource, id },
      showDetails: false,
    });
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', 401, {
      showDetails: false,
    });
  }
}

/**
 * Forbidden error
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Access forbidden') {
    super('FORBIDDEN', message, 403, {
      showDetails: false,
    });
  }
}

/**
 * Internal server error
 */
export class InternalServerError extends ApiError {
  constructor(message = 'Internal server error', details?: Record<string, unknown>) {
    super('INTERNAL_ERROR', message, 500, {
      ...(details && { details }),
      showDetails: false, // Don't expose internal details in production
    });
  }
}

/**
 * Create validation error for a single field
 */
export function createFieldError(
  field: string,
  message: string,
  code: string = 'INVALID'
): ValidationError {
  return { field, message, code };
}

/**
 * Create multiple validation errors
 */
export function createValidationErrors(
  errors: Array<{ field: string; message: string; code?: string }>
): ValidationError[] {
  return errors.map(error => createFieldError(error.field, error.message, error.code));
}

/**
 * Format error response according to PRD specification with progressive disclosure
 */
export function formatErrorResponse(
  error: ApiError | Error,
  environment: string = 'production',
  options: ErrorOptions = {}
): ApiErrorResponse {
  const isProduction = environment === 'production';
  const showDetails =
    options.showDetails ?? (!isProduction || (error instanceof ApiError && error.showDetails));

  if (error instanceof ApiError) {
    const response: ApiErrorResponse = {
      error: error.code,
      message: error.message,
    };

    if (showDetails) {
      response.details = {};

      if (error.validationErrors && error.validationErrors.length > 0) {
        response.details.validation_errors = error.validationErrors;
      }

      if (error.details) {
        Object.assign(response.details, error.details);
      }

      response.show_details = true;
    }

    if (options.correlationId) {
      response.details = response.details || {};
      response.details.correlation_id = options.correlationId;
    }

    return response;
  }

  // Handle unexpected errors
  const response: ApiErrorResponse = {
    error: 'INTERNAL_ERROR',
    message: isProduction ? 'Something went wrong' : error.message,
  };

  if (showDetails && !isProduction) {
    response.details = {
      stack: error.stack,
      show_details: true,
    };
  }

  if (options.correlationId) {
    response.details = response.details || {};
    response.details.correlation_id = options.correlationId;
  }

  return response;
}

/**
 * Send error response using Hono context
 */
export function sendErrorResponse(
  c: Context<{ Bindings: WorkerEnv }>,
  error: ApiError | Error,
  options: ErrorOptions = {}
): Response {
  const environment = c.env?.ENVIRONMENT || 'production';
  const statusCode = error instanceof ApiError ? error.statusCode : options.statusCode || 500;

  // Generate correlation ID for debugging
  const correlationId = options.correlationId || crypto.randomUUID().substring(0, 8);

  // Log error for debugging
  const logLevel = c.env?.LOG_LEVEL || 'warn';
  if (['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    console.error(`[${correlationId}] API Error:`, {
      error: error.message,
      stack: error.stack,
      statusCode,
      path: c.req.path,
      method: c.req.method,
    });
  }

  const errorResponse = formatErrorResponse(error, environment, {
    ...options,
    correlationId,
  });

  // Wrap error response in ApiResponse format to match frontend expectations
  const apiResponse = {
    ...createApiErrorResponse(errorResponse.error, errorResponse.message),
    ...(errorResponse.details && { details: errorResponse.details }),
    ...(errorResponse.show_details !== undefined && { show_details: errorResponse.show_details }),
  };

  // Add special headers for rate limiting
  if (error instanceof RateLimitError && error.details?.retry_after) {
    return c.json(apiResponse, statusCode as 429, {
      'Retry-After': error.details.retry_after.toString(),
    });
  }

  return c.json(apiResponse, statusCode as 400 | 401 | 403 | 404 | 429 | 500);
}

/**
 * Wrap async route handlers with error handling
 */
export function withErrorHandling<T extends Context>(
  handler: (c: T) => Promise<Response>
): (c: T) => Promise<Response> {
  return async (c: T) => {
    try {
      return await handler(c);
    } catch (error) {
      if (error instanceof ApiError) {
        return sendErrorResponse(c as Context<{ Bindings: WorkerEnv }>, error);
      }

      // Log unexpected errors
      console.error('Unexpected error in route handler:', error);

      return sendErrorResponse(
        c as Context<{ Bindings: WorkerEnv }>,
        new InternalServerError('An unexpected error occurred')
      );
    }
  };
}

/**
 * Validate required fields and throw validation error if missing
 */
export function validateRequired(data: Record<string, unknown>, requiredFields: string[]): void {
  const errors: ValidationError[] = [];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(createFieldError(field, `${field} is required`, 'REQUIRED'));
    }
  }

  if (errors.length > 0) {
    throw new ValidationApiError(errors);
  }
}

/**
 * Validate field types and throw validation error if incorrect
 */
export function validateTypes(
  data: Record<string, unknown>,
  fieldTypes: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>
): void {
  const errors: ValidationError[] = [];

  for (const [field, expectedType] of Object.entries(fieldTypes)) {
    const value = data[field];
    if (value === undefined || value === null) continue;

    let isValid = false;
    switch (expectedType) {
      case 'string':
        isValid = typeof value === 'string';
        break;
      case 'number':
        isValid = typeof value === 'number' && !isNaN(value);
        break;
      case 'boolean':
        isValid = typeof value === 'boolean';
        break;
      case 'array':
        isValid = Array.isArray(value);
        break;
      case 'object':
        isValid = typeof value === 'object' && !Array.isArray(value);
        break;
    }

    if (!isValid) {
      errors.push(createFieldError(field, `${field} must be a ${expectedType}`, 'INVALID_TYPE'));
    }
  }

  if (errors.length > 0) {
    throw new ValidationApiError(errors);
  }
}

import { createApiSuccessResponse, type ApiResponse } from '../../shared/types';

/**
 * Create a success response that returns data in ApiResponse format
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return createApiSuccessResponse(data, message);
}

/**
 * Helper to safely parse JSON with error handling and size limits
 */
export function safeJsonParse<T>(
  jsonString: string | null,
  defaultValue: T,
  maxSizeBytes: number = 1024 * 1024
): T {
  if (!jsonString) return defaultValue;

  // Check size limit to prevent DoS attacks
  const sizeBytes = new TextEncoder().encode(jsonString).length;
  if (sizeBytes > maxSizeBytes) {
    console.warn(`JSON string too large: ${sizeBytes} bytes > ${maxSizeBytes} limit`);
    return defaultValue;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return defaultValue;
  }
}
