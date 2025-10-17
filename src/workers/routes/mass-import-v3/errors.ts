/**
 * Mass Import v3 Error Types and Handlers
 * 
 * Defines error classes and error response formatting for the mass import endpoint.
 */

/**
 * Base error class for mass import operations
 */
export class MassImportError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'MassImportError';
  }
}

/**
 * Error codes and their corresponding HTTP status codes
 */
export const ERROR_CODES = {
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401 },
  INVALID_TYPE: { code: 'INVALID_TYPE', status: 400 },
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', status: 400 },
  INVALID_COORDINATES: { code: 'INVALID_COORDINATES', status: 400 },
  MISSING_REQUIRED_FIELD: { code: 'MISSING_REQUIRED_FIELD', status: 400 },
  INVALID_PHOTO: { code: 'INVALID_PHOTO', status: 400 },
  DATABASE_ERROR: { code: 'DATABASE_ERROR', status: 500 },
  PHOTO_UPLOAD_ERROR: { code: 'PHOTO_UPLOAD_ERROR', status: 500 },
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', status: 500 },
} as const;

/**
 * Error response type
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Create an error response object
 */
export function createErrorResponse(error: MassImportError): ErrorResponse {
  return {
    success: false as const,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    },
  };
}

/**
 * Create a validation error
 */
export function createValidationError(
  message: string,
  field?: string,
  value?: any,
  reason?: string
): MassImportError {
  return new MassImportError(
    message,
    ERROR_CODES.VALIDATION_ERROR.code,
    ERROR_CODES.VALIDATION_ERROR.status,
    field ? { field, value, reason } : undefined
  );
}

/**
 * Create an authentication error
 */
export function createAuthError(message = 'Missing or invalid authentication token'): MassImportError {
  return new MassImportError(
    message,
    ERROR_CODES.UNAUTHORIZED.code,
    ERROR_CODES.UNAUTHORIZED.status
  );
}

/**
 * Create a database error (sanitized for security)
 */
export function createDatabaseError(message = 'Database operation failed'): MassImportError {
  return new MassImportError(
    message,
    ERROR_CODES.DATABASE_ERROR.code,
    ERROR_CODES.DATABASE_ERROR.status
  );
}

/**
 * Create an invalid type error
 */
export function createInvalidTypeError(receivedType?: string): MassImportError {
  return new MassImportError(
    'Request type must be "Feature" (artwork) or "Artist"',
    ERROR_CODES.INVALID_TYPE.code,
    ERROR_CODES.INVALID_TYPE.status,
    receivedType ? { receivedType, expectedTypes: ['Feature', 'Artist'] } : undefined
  );
}
