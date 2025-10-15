/**
 * Mass Import v3 Artwork Import Handler
 * 
 * Handles importing artwork records from GeoJSON Feature format.
 */

import type { WorkerEnv } from '../../types';
import { createDatabaseError } from './errors';
import { createLogger } from '../../../shared/logger';
import { ArtworkFeatureSchema, type ArtworkFeature } from './validation';
import { formatValidationErrors, sanitizeMarkdown, parseArtistField, generateUUID } from './utils';
import { processPhotos, buildPhotosJson, type PhotoInput } from './photo-handler';
import { ZodError } from 'zod';

const log = createLogger({ module: 'mass-import-v3:artwork' });

/**
 * Success response for artwork import
 */
export interface ArtworkImportSuccessResponse {
  success: true;
  data: {
    id: string;
    sourceId: string;
    type: 'artwork';
    status: 'created';
    title: string;
    artists?: Array<{
      id: string;
      name: string;
      status: 'linked' | 'created';
    }>;
    photos?: Array<{
      url: string;
      status: 'uploaded';
    }>;
    photosProcessed?: {
      total: number;
      successful: number;
      failed: number;
    };
    photoErrors?: Array<{
      index: number;
      url: string;
      error: string;
    }>;
  };
}

/**
 * Handle artwork import
 * 
 * @param data - Artwork GeoJSON Feature (not yet validated)
 * @param env - Worker environment bindings
 * @param userId - Admin user ID performing the import
 * @returns Success response with created artwork details
 */
export async function handleArtworkImport(
  data: any,
  env: WorkerEnv,
  userId: string
): Promise<ArtworkImportSuccessResponse> {
  const verbose = env.MASS_IMPORT_VERBOSE === '1' || env.MASS_IMPORT_VERBOSE === 'true';
  const startTime = Date.now();
  
  log.info('Handling artwork import', { sourceId: data?.id, userId });

  // Step 1: Validate artwork data with Zod schema
  if (verbose) log.debug('Step 1: Validating artwork data');
  let validatedData: ArtworkFeature;
  try {
    validatedData = ArtworkFeatureSchema.parse(data);
    if (verbose) log.debug('Validation successful', { 
      title: validatedData.properties.title,
      hasPhotos: !!validatedData.properties.photos?.length 
    });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Validation failed', { errors: error.errors });
      throw formatValidationErrors(error);
    }
    throw error;
  }

  // Step 2: Sanitize description if present
  if (verbose) log.debug('Step 2: Sanitizing description');
  if (validatedData.properties.description) {
    validatedData.properties.description = sanitizeMarkdown(validatedData.properties.description);
  }

  // Step 3: Generate UUID for database ID
  const artworkId = generateUUID();
  const now = Date.now();
  const [lon, lat] = validatedData.geometry.coordinates;

  // Step 4: Build tags JSON with source ID and all properties
  const tags: Record<string, any> = {
    source_id: validatedData.id,
    source: validatedData.properties.source,
    source_url: validatedData.properties.source_url,
  };

  // Copy all other properties to tags
  for (const [key, value] of Object.entries(validatedData.properties)) {
    if (key !== 'title' && key !== 'description' && key !== 'artist') {
      tags[key] = value;
    }
  }

  // Step 5: Process artist field(s)
  if (verbose) log.debug('Step 5: Processing artist field(s)', { artistField: validatedData.properties.artist });
  const artistNames = parseArtistField(validatedData.properties.artist);
  const linkedArtists: Array<{ id: string; name: string; status: 'linked' | 'created' }> = [];

  for (const artistName of artistNames) {
    try {
      // Search for existing artist by name
      if (verbose) log.debug('Searching for artist', { name: artistName });
      const existingArtist = await env.DB.prepare(
        'SELECT id, name FROM artists WHERE name = ?'
      )
        .bind(artistName)
        .first<{ id: string; name: string }>();

      if (existingArtist) {
        // Link existing artist
        linkedArtists.push({
          id: existingArtist.id,
          name: existingArtist.name,
          status: 'linked',
        });
        log.info('Found existing artist', { artistId: existingArtist.id, name: artistName });
      } else {
        // Create new stub artist
        if (verbose) log.debug('Creating new artist', { name: artistName });
        const newArtistId = generateUUID();
        const artistTags = JSON.stringify({
          source_id: `auto-created-from-${validatedData.id}`,
          auto_created: true,
          created_from_artwork: artworkId,
        });

        await env.DB.prepare(
          'INSERT INTO artists (id, name, description, aliases, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
          .bind(
            newArtistId,
            artistName,
            null, // No description for auto-created artists
            null, // No aliases
            artistTags,
            now,
            now
          )
          .run();

        linkedArtists.push({
          id: newArtistId,
          name: artistName,
          status: 'created',
        });
        log.info('Created new artist', { artistId: newArtistId, name: artistName });
      }
    } catch (error) {
      log.error('Failed to process artist', {
        name: artistName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw createDatabaseError('Failed to process artist record');
    }
  }

  // Step 6: Process photos if provided
  if (verbose) log.debug('Step 6: Processing photos', { photoCount: validatedData.properties.photos?.length || 0 });
  let photosJson = JSON.stringify([]);
  const photoErrors: Array<{ index: number; url: string; error: string }> = [];

  if (validatedData.properties.photos && validatedData.properties.photos.length > 0) {
    try {
      const photoResult = await processPhotos(validatedData.properties.photos as PhotoInput[]);
      photosJson = buildPhotosJson(photoResult.photos);

      // Collect photo errors but continue with artwork creation
      if (photoResult.errors.length > 0) {
        photoErrors.push(...photoResult.errors);
        log.warn('Some photos failed to process', {
          total: validatedData.properties.photos.length,
          successful: photoResult.photos.length,
          failed: photoResult.errors.length,
        });
      } else {
        log.info('All photos processed successfully', {
          count: photoResult.photos.length,
        });
      }
    } catch (error) {
      log.error('Photo processing failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Continue with artwork creation even if photos fail
    }
  }

  // Step 7: Create artwork record
  if (verbose) log.debug('Step 7: Creating artwork record', { artworkId, title: validatedData.properties.title });
  const tagsJson = JSON.stringify(tags);

  try {
    await env.DB.prepare(
      `INSERT INTO artwork 
       (id, title, description, lat, lon, tags, photos, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        artworkId,
        validatedData.properties.title,
        validatedData.properties.description || null,
        lat,
        lon,
        tagsJson,
        photosJson,
        'approved', // Auto-approve mass imports
        now,
        now
      )
      .run();

    log.info('Created artwork record', { artworkId, title: validatedData.properties.title });
  } catch (error) {
    log.error('Failed to create artwork', {
      error: error instanceof Error ? error.message : '[TypeError]',
      artworkId,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw createDatabaseError('Failed to create artwork record');
  }

  // Step 8: Create artist links
  if (verbose) log.debug('Step 8: Creating artist links', { artistCount: linkedArtists.length });
  for (const artist of linkedArtists) {
    try {
      await env.DB.prepare(
        'INSERT INTO artwork_artists (artwork_id, artist_id, role, created_at) VALUES (?, ?, ?, ?)'
      )
        .bind(artworkId, artist.id, 'artist', now)
        .run();

      log.info('Linked artist to artwork', { artworkId, artistId: artist.id });
    } catch (error) {
      log.error('Failed to link artist', {
        error: error instanceof Error ? error.message : String(error),
        artworkId,
        artistId: artist.id,
      });
      // Continue with other artists even if one fails
    }
  }

  // Step 9: Build success response
  const duration = Date.now() - startTime;
  if (verbose) log.debug('Step 9: Building response', { duration });
  
  const response: ArtworkImportSuccessResponse = {
    success: true,
    data: {
      id: artworkId,
      sourceId: validatedData.id,
      type: 'artwork',
      status: 'created',
      title: validatedData.properties.title,
    },
  };

  // Add artists if any were linked
  if (linkedArtists.length > 0) {
    response.data.artists = linkedArtists;
  }

  // Add photo count and errors if applicable
  if (validatedData.properties.photos && validatedData.properties.photos.length > 0) {
    const photosParsed = JSON.parse(photosJson);
    response.data.photosProcessed = {
      total: validatedData.properties.photos.length,
      successful: photosParsed.length,
      failed: photoErrors.length,
    };

    if (photoErrors.length > 0) {
      response.data.photoErrors = photoErrors;
    }
  }

  if (verbose) {
    log.info('Artwork import completed', {
      artworkId,
      duration,
      artistsLinked: linkedArtists.length,
      photosProcessed: response.data.photosProcessed?.successful || 0,
    });
  }

  return response;
}
