/**
 * Mass Import v3 Artist Import Handler
 * 
 * Handles importing artist records from JSON format.
 */

import type { WorkerEnv } from '../../types';
import { createDatabaseError } from './errors';
import { createLogger } from '../../../shared/logger';
import { ArtistSchema, type ArtistImport } from './validation';
import { formatValidationErrors, sanitizeMarkdown, generateUUID } from './utils';
import { ZodError } from 'zod';

const log = createLogger({ module: 'mass-import-v3:artist' });

/**
 * Success response for artist import
 */
export interface ArtistImportSuccessResponse {
  success: true;
  data: {
    id: string;
    sourceId: string;
    type: 'artist';
    status: 'created' | 'existing';
    name: string;
  };
}

/**
 * Handle artist import
 * 
 * @param data - Artist data (not yet validated)
 * @param env - Worker environment bindings
 * @param userId - Admin user ID performing the import
 * @returns Success response with created/existing artist details
 */
export async function handleArtistImport(
  data: any,
  env: WorkerEnv,
  userId: string
): Promise<ArtistImportSuccessResponse> {
  const verbose = env.MASS_IMPORT_VERBOSE === '1' || env.MASS_IMPORT_VERBOSE === 'true';
  const startTime = Date.now();
  
  log.info('Handling artist import', { sourceId: data?.id, name: data?.name, userId });

  // Step 1: Validate artist data with Zod schema
  if (verbose) log.debug('Step 1: Validating artist data');
  let validatedData: ArtistImport;
  try {
    validatedData = ArtistSchema.parse(data);
    if (verbose) log.debug('Validation successful', { name: validatedData.name });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Validation failed', { errors: error.errors });
      throw formatValidationErrors(error);
    }
    throw error;
  }

  // Step 2: Sanitize description if present
  if (verbose) log.debug('Step 2: Sanitizing description');
  if (validatedData.description) {
    validatedData.description = sanitizeMarkdown(validatedData.description);
  }

  // Step 3: Check if artist exists by name
  if (verbose) log.debug('Step 3: Checking for existing artist', { name: validatedData.name });
  let existingArtist: { id: string; name: string } | null = null;
  
  try {
    existingArtist = await env.DB.prepare(
      'SELECT id, name FROM artists WHERE name = ?'
    )
      .bind(validatedData.name)
      .first<{ id: string; name: string }>();
  } catch (error) {
    log.error('Failed to check for existing artist', {
      error: error instanceof Error ? error.message : String(error),
      name: validatedData.name,
    });
    throw createDatabaseError('Failed to query artist database');
  }

  if (existingArtist) {
    // Artist already exists, return existing
    const duration = Date.now() - startTime;
    log.info('Artist already exists', { artistId: existingArtist.id, name: validatedData.name, duration });
    // If incoming import requests auto-approval, update existing artist to approved
    try {
      const incomingStatus = (validatedData.properties && (validatedData.properties as any).status) || null;
      if (incomingStatus === 'approved') {
        await env.DB.prepare(`UPDATE artists SET status = ?, updated_at = ? WHERE id = ?`)
          .bind('approved', Date.now(), existingArtist.id)
          .run();
        log.info('Upgraded existing artist to approved', { artistId: existingArtist.id });
      }
    } catch (err) {
      // Non-fatal: log and continue returning existing record
      log.warn('Failed to upgrade existing artist status', { error: err instanceof Error ? err.message : String(err), artistId: existingArtist.id });
    }
    
    return {
      success: true,
      data: {
        id: existingArtist.id,
        sourceId: validatedData.id,
        type: 'artist',
        status: 'existing',
        name: existingArtist.name,
      },
    };
  }

  // Step 4: Generate UUID for new artist
  if (verbose) log.debug('Step 4: Generating UUID for new artist');
  const artistId = generateUUID();
  const now = Date.now();

  // Step 5: Build tags JSON with source ID and all properties
  if (verbose) log.debug('Step 5: Building tags JSON');
  const tags: Record<string, any> = {
    source_id: validatedData.id,
    source: validatedData.properties.source,
    source_url: validatedData.properties.source_url,
  };

  // Copy all other properties to tags
  for (const [key, value] of Object.entries(validatedData.properties)) {
    if (key !== 'source' && key !== 'source_url') {
      tags[key] = value;
    }
  }

  const tagsJson = JSON.stringify(tags);

  // Step 6: Create artist record
  if (verbose) log.debug('Step 6: Creating artist record', { artistId, name: validatedData.name });
  try {
  // Determine desired status: mass-import-created artists should be approved by default
  // Allow incoming request to explicitly request a status, otherwise default to 'approved'
  const desiredStatus = (validatedData.properties && (validatedData.properties as any).status) || 'approved';

    await env.DB.prepare(
      `INSERT INTO artists 
       (id, name, description, aliases, tags, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        artistId,
        validatedData.name,
        validatedData.description || null,
        null, // No aliases for mass import
        tagsJson,
        desiredStatus,
        now,
        now
      )
      .run();

    log.info('Created artist record', { artistId, name: validatedData.name });
  } catch (error) {
    log.error('Failed to create artist', {
      error: error instanceof Error ? error.message : String(error),
      artistId,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw createDatabaseError('Failed to create artist record');
  }

  // Step 7: Build success response
  const duration = Date.now() - startTime;
  if (verbose) log.debug('Step 7: Building response', { duration });
  
  return {
    success: true,
    data: {
      id: artistId,
      sourceId: validatedData.id,
      type: 'artist',
      status: 'created',
      name: validatedData.name,
    },
  };
}
