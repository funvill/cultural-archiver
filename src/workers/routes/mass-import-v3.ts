/**
 * Mass Import v3 Endpoint
 * 
 * POST /api/mass-import/v3
 * 
 * Accepts individual artwork (GeoJSON Feature) or artist (JSON) items,
 * validates them, stores them in the database, and returns success/failure status.
 * 
 * This endpoint is stateless - it processes one item at a time.
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { createLogger } from '../../shared/logger';
import {
  MassImportError,
  createErrorResponse,
  createAuthError,
  createInvalidTypeError,
} from './mass-import-v3/errors';
import { handleArtworkImport } from './mass-import-v3/artwork-handler';
import { handleArtistImport } from './mass-import-v3/artist-handler';

const log = createLogger({ module: 'mass-import-v3' });

/**
 * Authenticate admin user from bearer token
 */
async function authenticateAdmin(c: Context<{ Bindings: WorkerEnv }>): Promise<string> {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createAuthError('Missing or invalid Authorization header');
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Query database for user with this token
  const db = c.env.DB;
  const userResult = await db
    .prepare('SELECT id FROM users WHERE user_token = ?')
    .bind(token)
    .first<{ id: string }>();

  if (!userResult) {
    throw createAuthError('Invalid authentication token');
  }

  // Check if user has admin role
  const roleResult = await db
    .prepare('SELECT role FROM user_roles WHERE user_id = ? AND role = ?')
    .bind(userResult.id, 'admin')
    .first<{ role: string }>();

  if (!roleResult) {
    throw createAuthError('Insufficient permissions - admin role required');
  }

  log.info('Admin authenticated', { userId: userResult.id });
  return userResult.id;
}

/**
 * Detect request type and route to appropriate handler
 */
function detectRequestType(data: any): 'artwork' | 'artist' | 'unknown' {
  if (!data || typeof data !== 'object') {
    return 'unknown';
  }

  // Check for GeoJSON Feature (artwork)
  if (data.type === 'Feature') {
    return 'artwork';
  }

  // Check for Artist
  if (data.type === 'Artist') {
    return 'artist';
  }

  return 'unknown';
}

/**
 * Main handler for mass import v3 endpoint
 */
export async function handleMassImportV3(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const verbose = c.env.MASS_IMPORT_VERBOSE === '1' || c.env.MASS_IMPORT_VERBOSE === 'true';
  const startTime = Date.now();
  
  try {
    // Step 1: Authenticate admin user
    if (verbose) log.debug('Step 1: Authenticating admin user');
    const userId = await authenticateAdmin(c);

    // Step 2: Parse request body
    if (verbose) log.debug('Step 2: Parsing request body');
    let requestData: any;
    try {
      requestData = await c.req.json();
      if (verbose) log.debug('JSON parsed successfully', { type: requestData?.type, id: requestData?.id });
    } catch (error) {
      log.warn('Failed to parse JSON', { error: error instanceof Error ? error.message : String(error) });
      throw new MassImportError(
        'Invalid JSON in request body',
        'VALIDATION_ERROR',
        400,
        { reason: error instanceof Error ? error.message : 'Failed to parse JSON' }
      );
    }

    // Step 3: Detect request type
    if (verbose) log.debug('Step 3: Detecting request type');
    const requestType = detectRequestType(requestData);

    if (requestType === 'unknown') {
      const receivedType = requestData?.type;
      throw createInvalidTypeError(receivedType);
    }

    log.info('Processing mass import request', {
      type: requestType,
      userId,
      sourceId: requestData.id,
    });

    // Step 4: Route to appropriate handler
    if (verbose) log.debug('Step 4: Routing to handler', { type: requestType });
    let response;
    if (requestType === 'artwork') {
      response = await handleArtworkImport(requestData, c.env, userId);
    } else {
      response = await handleArtistImport(requestData, c.env, userId);
    }

    // Step 5: Return success response
    const duration = Date.now() - startTime;
    if (verbose) {
      log.info('Mass import completed successfully', {
        type: requestType,
        duration,
        status: response.data.status,
      });
    }
    
    return c.json(response, 200);

  } catch (error) {
    // Handle known MassImportError
    if (error instanceof MassImportError) {
      log.warn('Mass import error', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return c.json(createErrorResponse(error), error.statusCode as any);
    }

    // Handle unexpected errors
    log.error('Unexpected error in mass import', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const internalError = new MassImportError(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      500
    );
    return c.json(createErrorResponse(internalError), 500);
  }
}
