/**
 * Input validation middleware using Zod schemas
 * Provides consistent validation for API requests
 */

import type { Context, Next } from 'hono';
import { z } from 'zod';
import type { WorkerEnv } from '../types';
import { ValidationApiError } from '../lib/errors';
import { isValidLatitude, isValidLongitude } from '../lib/spatial';
import { MAX_NOTE_LENGTH, MAX_PHOTOS_PER_SUBMISSION, ARTWORK_TYPES, MIN_SEARCH_RADIUS, MAX_SEARCH_RADIUS } from '../types';

// Extend the Hono context types
declare module 'hono' {
  interface ContextVariableMap {
    validated_body: Record<string, unknown>;
    validated_query: Record<string, unknown>;
    validated_params: Record<string, unknown>;
    validated_files: File[];
  }
}

// ================================
// Coordinate Validation Schemas
// ================================

export const coordinateSchema = z.object({
  lat: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .refine(isValidLatitude, 'Invalid latitude format'),
  lon: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .refine(isValidLongitude, 'Invalid longitude format'),
});

// ================================
// Submission Validation Schemas
// ================================

export const logbookSubmissionSchema = z.object({
  lat: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  lon: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  note: z
    .string()
    .max(MAX_NOTE_LENGTH, `Note must be ${MAX_NOTE_LENGTH} characters or less`)
    .optional(),
  type: z.enum(ARTWORK_TYPES).optional(),
});

// ================================
// Discovery Validation Schemas
// ================================

export const nearbyArtworksQuerySchema = z.object({
  lat: z.string().regex(/^-?\d+\.?\d*$/, 'Latitude must be a valid number'),
  lon: z.string().regex(/^-?\d+\.?\d*$/, 'Longitude must be a valid number'),
  radius: z
    .string()
    .regex(/^\d+\.?\d*$/, 'Radius must be a valid positive number')
    .optional(),
  limit: z.string().regex(/^\d+$/, 'Limit must be a valid integer').optional(),
});

export const artworkIdSchema = z.object({
  id: z.string().uuid('Artwork ID must be a valid UUID'),
});

// ================================
// User Management Validation Schemas
// ================================

export const userSubmissionsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, 'Page must be a valid integer').optional(),
  per_page: z.string().regex(/^\d+$/, 'Per page must be a valid integer').optional(),
});

// ================================
// Authentication Validation Schemas
// ================================

export const magicLinkRequestSchema = z.object({
  email: z.string().email('Invalid email format').max(254, 'Email must be 254 characters or less'),
});

export const consumeMagicLinkSchema = z.object({
  token: z
    .string()
    .min(32, 'Token must be at least 32 characters')
    .max(128, 'Token must be 128 characters or less'),
});

// ================================
// Review/Moderation Validation Schemas
// ================================

export const reviewSubmissionSchema = z.object({
  submission_id: z.string().uuid('Submission ID must be a valid UUID'),
  action: z.enum(['approve', 'reject'], {
    errorMap: () => ({ message: 'Action must be either "approve" or "reject"' }),
  }),
  rejection_reason: z
    .string()
    .max(500, 'Rejection reason must be 500 characters or less')
    .optional(),
  artwork_overrides: z
    .object({
      lat: z.number().min(-90).max(90).optional(),
      lon: z.number().min(-180).max(180).optional(),
      type_id: z.enum(ARTWORK_TYPES).optional(),
      tags: z.record(z.string()).optional(),
    })
    .optional(),
  link_to_existing_artwork: z.string().uuid('Existing artwork ID must be a valid UUID').optional(),
});

// ================================
// Validation Middleware Functions
// ================================

/**
 * Generic validation middleware factory
 */
export function validateSchema<T extends Record<string, unknown>>(
  schema: z.ZodSchema<T>,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return async (c: Context<{ Bindings: WorkerEnv }>, next: Next): Promise<void | Response> => {
    try {
      let data: unknown;

      switch (source) {
        case 'body':
          try {
            data = await c.req.json();
          } catch {
            throw new ValidationApiError([
              { field: 'body', message: 'Invalid JSON in request body', code: 'INVALID_JSON' },
            ]);
          }
          break;
        case 'query':
          data = Object.fromEntries(new URL(c.req.url).searchParams.entries());
          break;
        case 'params':
          data = c.req.param();
          break;
      }

      const result = schema.safeParse(data);

      if (!result.success) {
        const validationErrors = result.error.errors.map(error => ({
          field: error.path.join('.') || 'unknown',
          message: error.message,
          code: error.code.toUpperCase(),
        }));

        throw new ValidationApiError(validationErrors);
      }

      // Store validated data in context
      c.set(`validated_${source}`, result.data);
    } catch (error) {
      if (error instanceof ValidationApiError) {
        throw error;
      }
      throw new ValidationApiError([
        { field: source, message: `Validation failed for ${source}`, code: 'VALIDATION_ERROR' },
      ]);
    }

    await next();
  };
}

/**
 * Specific validation middleware for common use cases
 */

export const validateLogbookSubmission = validateSchema(logbookSubmissionSchema, 'body');

// Custom validation for query parameters that need number conversion
export async function validateNearbyArtworksQuery(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const url = new URL(c.req.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const radius = url.searchParams.get('radius');
  const limit = url.searchParams.get('limit');

  const validationErrors = [];

  // Validate required lat/lon
  if (!lat) {
    validationErrors.push({ field: 'lat', message: 'Latitude is required', code: 'REQUIRED' });
  } else {
    const latNum = parseFloat(lat);
    if (isNaN(latNum) || !isValidLatitude(latNum)) {
      validationErrors.push({ field: 'lat', message: 'Invalid latitude', code: 'INVALID' });
    }
  }

  if (!lon) {
    validationErrors.push({ field: 'lon', message: 'Longitude is required', code: 'REQUIRED' });
  } else {
    const lonNum = parseFloat(lon);
    if (isNaN(lonNum) || !isValidLongitude(lonNum)) {
      validationErrors.push({ field: 'lon', message: 'Invalid longitude', code: 'INVALID' });
    }
  }

  // Validate optional radius
  if (radius) {
    const radiusNum = parseFloat(radius);
    if (isNaN(radiusNum) || radiusNum < MIN_SEARCH_RADIUS || radiusNum > MAX_SEARCH_RADIUS) {
      validationErrors.push({
        field: 'radius',
        message: `Radius must be between ${MIN_SEARCH_RADIUS} and ${MAX_SEARCH_RADIUS} meters`,
        code: 'INVALID',
      });
    }
  }

  // Validate optional limit
  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      validationErrors.push({
        field: 'limit',
        message: 'Limit must be between 1 and 100',
        code: 'INVALID',
      });
    }
  }

  if (validationErrors.length > 0) {
    throw new ValidationApiError(validationErrors);
  }

  // Store parsed values
  c.set('validated_query', {
    lat: parseFloat(lat!),
    lon: parseFloat(lon!),
    radius: radius ? parseFloat(radius) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });

  await next();
}

// Custom validation for bounds query parameters
export async function validateBoundsQuery(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const url = new URL(c.req.url);
  const north = url.searchParams.get('north');
  const south = url.searchParams.get('south');
  const east = url.searchParams.get('east');
  const west = url.searchParams.get('west');

  const validationErrors = [];

  // Validate required bounds
  if (!north) {
    validationErrors.push({ field: 'north', message: 'North bound is required', code: 'REQUIRED' });
  } else {
    const northNum = parseFloat(north);
    if (isNaN(northNum) || !isValidLatitude(northNum)) {
      validationErrors.push({ field: 'north', message: 'Invalid north latitude', code: 'INVALID' });
    }
  }

  if (!south) {
    validationErrors.push({ field: 'south', message: 'South bound is required', code: 'REQUIRED' });
  } else {
    const southNum = parseFloat(south);
    if (isNaN(southNum) || !isValidLatitude(southNum)) {
      validationErrors.push({ field: 'south', message: 'Invalid south latitude', code: 'INVALID' });
    }
  }

  if (!east) {
    validationErrors.push({ field: 'east', message: 'East bound is required', code: 'REQUIRED' });
  } else {
    const eastNum = parseFloat(east);
    if (isNaN(eastNum) || !isValidLongitude(eastNum)) {
      validationErrors.push({ field: 'east', message: 'Invalid east longitude', code: 'INVALID' });
    }
  }

  if (!west) {
    validationErrors.push({ field: 'west', message: 'West bound is required', code: 'REQUIRED' });
  } else {
    const westNum = parseFloat(west);
    if (isNaN(westNum) || !isValidLongitude(westNum)) {
      validationErrors.push({ field: 'west', message: 'Invalid west longitude', code: 'INVALID' });
    }
  }

  // Validate bounds make sense (north > south, east != west)
  if (north && south) {
    const northNum = parseFloat(north);
    const southNum = parseFloat(south);
    if (northNum <= southNum) {
      validationErrors.push({ 
        field: 'bounds', 
        message: 'North bound must be greater than south bound', 
        code: 'INVALID' 
      });
    }
  }

  if (validationErrors.length > 0) {
    throw new ValidationApiError(validationErrors);
  }

  // Store parsed values
  c.set('validated_query', {
    north: parseFloat(north!),
    south: parseFloat(south!),
    east: parseFloat(east!),
    west: parseFloat(west!),
  });

  await next();
}

export const validateArtworkId = validateSchema(artworkIdSchema, 'params');

// Custom validation for user submissions query
export async function validateUserSubmissionsQuery(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const url = new URL(c.req.url);
  const page = url.searchParams.get('page');
  const per_page = url.searchParams.get('per_page');

  const validationErrors = [];

  // Validate optional page
  if (page) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      validationErrors.push({
        field: 'page',
        message: 'Page must be 1 or greater',
        code: 'INVALID',
      });
    }
  }

  // Validate optional per_page
  if (per_page) {
    const perPageNum = parseInt(per_page, 10);
    if (isNaN(perPageNum) || perPageNum < 1 || perPageNum > 100) {
      validationErrors.push({
        field: 'per_page',
        message: 'Per page must be between 1 and 100',
        code: 'INVALID',
      });
    }
  }

  if (validationErrors.length > 0) {
    throw new ValidationApiError(validationErrors);
  }

  // Store parsed values
  c.set('validated_query', {
    page: page ? parseInt(page, 10) : undefined,
    per_page: per_page ? parseInt(per_page, 10) : undefined,
  });

  await next();
}

export const validateMagicLinkRequest = validateSchema(magicLinkRequestSchema, 'body');
export const validateConsumeMagicLink = validateSchema(consumeMagicLinkSchema, 'body');
export const validateReviewSubmission = validateSchema(reviewSubmissionSchema, 'body');

/**
 * Validate file uploads (for photo submissions)
 */
export async function validateFileUploads(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  try {
    const contentType = c.req.header('Content-Type');

    if (!contentType?.includes('multipart/form-data')) {
      await next();
      return;
    }

    const formData = await c.req.formData();
    const files: File[] = [];

    // Collect all files from form data
    for (const [, value] of formData.entries()) {
      if (typeof value === 'object' && value && 'size' in value && 'type' in value) {
        files.push(value as File);
      }
    }

    // Validate file count
    if (files.length > MAX_PHOTOS_PER_SUBMISSION) {
      throw new ValidationApiError([
        {
          field: 'photos',
          message: `Maximum ${MAX_PHOTOS_PER_SUBMISSION} photos allowed`,
          code: 'TOO_MANY_FILES',
        },
      ]);
    }

    // Validate each file
    const validationErrors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;

      // Check file size (15MB max)
      if (file.size > 15 * 1024 * 1024) {
        validationErrors.push({
          field: `photos[${i}]`,
          message: 'File size must be 15MB or less',
          code: 'FILE_TOO_LARGE',
        });
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        validationErrors.push({
          field: `photos[${i}]`,
          message: 'File must be an image',
          code: 'INVALID_FILE_TYPE',
        });
      }

      // Check supported image types
      const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!supportedTypes.includes(file.type)) {
        validationErrors.push({
          field: `photos[${i}]`,
          message: 'Image must be JPEG, PNG, WebP, or GIF format',
          code: 'UNSUPPORTED_IMAGE_TYPE',
        });
      }
    }

    if (validationErrors.length > 0) {
      throw new ValidationApiError(validationErrors);
    }

    // Store validated files in context
    c.set('validated_files', files);
  } catch (error) {
    if (error instanceof ValidationApiError) {
      throw error;
    }
    throw new ValidationApiError([
      { field: 'photos', message: 'File validation failed', code: 'FILE_VALIDATION_ERROR' },
    ]);
  }

  await next();
}

/**
 * Helper function to get validated data from context
 */
export function getValidatedData<T>(c: Context, source: 'body' | 'query' | 'params'): T {
  return c.get(`validated_${source}`) as T;
}

/**
 * Helper function to get validated files from context
 */
export function getValidatedFiles(c: Context): File[] {
  return c.get('validated_files') || [];
}

/**
 * Validate UUID parameter
 */
/**
 * Validate logbook submission from form data (for file uploads) or JSON (for text-only submissions)
 */
export async function validateLogbookFormData(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  try {
    const contentType = c.req.header('Content-Type');
    
    // Handle multipart form data (with files)
    if (contentType?.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const validationErrors = [];

      // Extract and validate latitude
      const latValue = formData.get('latitude')?.toString();
      if (!latValue) {
        validationErrors.push({ field: 'latitude', message: 'Latitude is required', code: 'REQUIRED' });
      } else {
        const lat = parseFloat(latValue);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          validationErrors.push({ field: 'latitude', message: 'Latitude must be between -90 and 90', code: 'INVALID' });
        }
      }

      // Extract and validate longitude
      const lonValue = formData.get('longitude')?.toString();
      if (!lonValue) {
        validationErrors.push({ field: 'longitude', message: 'Longitude is required', code: 'REQUIRED' });
      } else {
        const lon = parseFloat(lonValue);
        if (isNaN(lon) || lon < -180 || lon > 180) {
          validationErrors.push({ field: 'longitude', message: 'Longitude must be between -180 and 180', code: 'INVALID' });
        }
      }

      // Extract and validate optional note
      const note = formData.get('note')?.toString();
      if (note && note.length > MAX_NOTE_LENGTH) {
        validationErrors.push({ 
          field: 'note', 
          message: `Note must be ${MAX_NOTE_LENGTH} characters or less`, 
          code: 'TOO_LONG' 
        });
      }

      if (validationErrors.length > 0) {
        throw new ValidationApiError(validationErrors);
      }

      // Store validated data in context for later use
      const validatedData = {
        lat: parseFloat(latValue!),
        lon: parseFloat(lonValue!),
        ...(note && { note })
      };
      
      c.set('validated_body', validatedData);
    }
    // Handle JSON data (text-only submissions)
    else if (contentType?.includes('application/json')) {
      const jsonData = await c.req.json();
      
      // Validate using Zod schema
      const result = logbookSubmissionSchema.parse(jsonData);
      
      // Store validated data in context
      c.set('validated_body', result);
    }
    // Handle URL-encoded form data (simple form submissions)
    else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await c.req.parseBody();
      const validationErrors = [];

      // Extract and validate latitude
      const latValue = formData.latitude?.toString();
      if (!latValue) {
        validationErrors.push({ field: 'latitude', message: 'Latitude is required', code: 'REQUIRED' });
      } else {
        const lat = parseFloat(latValue);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          validationErrors.push({ field: 'latitude', message: 'Latitude must be between -90 and 90', code: 'INVALID' });
        }
      }

      // Extract and validate longitude
      const lonValue = formData.longitude?.toString();
      if (!lonValue) {
        validationErrors.push({ field: 'longitude', message: 'Longitude is required', code: 'REQUIRED' });
      } else {
        const lon = parseFloat(lonValue);
        if (isNaN(lon) || lon < -180 || lon > 180) {
          validationErrors.push({ field: 'longitude', message: 'Longitude must be between -180 and 180', code: 'INVALID' });
        }
      }

      // Extract and validate optional note
      const note = formData.note?.toString();
      if (note && note.length > MAX_NOTE_LENGTH) {
        validationErrors.push({ 
          field: 'note', 
          message: `Note must be ${MAX_NOTE_LENGTH} characters or less`, 
          code: 'TOO_LONG' 
        });
      }

      if (validationErrors.length > 0) {
        throw new ValidationApiError(validationErrors);
      }

      // Store validated data in context
      const validatedData = {
        lat: parseFloat(latValue!),
        lon: parseFloat(lonValue!),
        ...(note && { note })
      };
      
      c.set('validated_body', validatedData);
    }
    else {
      // Unsupported content type
      throw new ValidationApiError([
        { 
          field: 'content-type', 
          message: 'Content-Type must be multipart/form-data, application/json, or application/x-www-form-urlencoded', 
          code: 'UNSUPPORTED_CONTENT_TYPE' 
        }
      ]);
    }

    await next();
  } catch (error) {
    if (error instanceof ValidationApiError) {
      throw error;
    }
    throw new ValidationApiError([
      { field: 'form', message: 'Form data validation failed', code: 'FORM_VALIDATION_ERROR' },
    ]);
  }
}

export function validateUUID(paramName: string = 'id') {
  return async (c: Context<{ Bindings: WorkerEnv }>, next: Next): Promise<void | Response> => {
    const value = c.req.param(paramName);

    if (!value) {
      throw new ValidationApiError([
        { field: paramName, message: `${paramName} is required`, code: 'REQUIRED' },
      ]);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(value)) {
      throw new ValidationApiError([
        { field: paramName, message: `${paramName} must be a valid UUID`, code: 'INVALID_UUID' },
      ]);
    }

    await next();
  };
}
