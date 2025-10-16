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
  const timings: Record<string, number> = {}; // Track timing breakdown
  
  log.info('Handling artwork import', { sourceId: data?.id, userId });

  // Step 1: Validate artwork data with Zod schema
  const t1 = Date.now();
  if (verbose) log.debug('Step 1: Validating artwork data');
  let validatedData: ArtworkFeature;
  try {
    validatedData = ArtworkFeatureSchema.parse(data);
    timings.validation = Date.now() - t1;
    if (verbose) log.debug('Validation successful', { 
      title: validatedData.properties.title,
      hasPhotos: !!validatedData.properties.photos?.length,
      duration: timings.validation
    });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Validation failed', { errors: error.errors });
      throw formatValidationErrors(error);
    }
    throw error;
  }

  // Step 2: Sanitize description if present
  const t2 = Date.now();
  if (verbose) log.debug('Step 2: Sanitizing description');
  if (validatedData.properties.description) {
    validatedData.properties.description = sanitizeMarkdown(validatedData.properties.description);
  }
  timings.sanitization = Date.now() - t2;

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

  // Copy all other properties to tags (exclude title, description, artist, artists, photos, and metadata fields)
  for (const [key, value] of Object.entries(validatedData.properties)) {
    if (key !== 'title' && key !== 'description' && key !== 'artist' && key !== 'artists' && key !== 'photos' && key !== 'skipDuplicateDetection') {
      tags[key] = value;
    }
  }
  
  // Preserve artists array in tags for frontend display
  if (Array.isArray(validatedData.properties.artists) && validatedData.properties.artists.length > 0) {
    tags.artists = validatedData.properties.artists;
  } else if (validatedData.properties.artist) {
    // If only legacy artist string exists, convert to array in tags
    tags.artists = parseArtistField(validatedData.properties.artist);
  }

  // Step 5: Process artist field(s) - OPTIMIZED with batch queries
  const t5 = Date.now();
  if (verbose) log.debug('Step 5: Processing artist field(s)', { artistField: validatedData.properties.artists || validatedData.properties.artist });
  // Accept either artists array (preferred) or legacy artist string
  let artistNames: string[] = [];
  if (Array.isArray(validatedData.properties.artists) && validatedData.properties.artists.length > 0) {
    artistNames = validatedData.properties.artists.map(a => String(a).trim()).filter(Boolean);
  } else if (validatedData.properties.artist) {
    artistNames = parseArtistField(validatedData.properties.artist);
  }
  const linkedArtists: Array<{ id: string; name: string; status: 'linked' | 'created' }> = [];

  if (artistNames.length > 0) {
    try {
      // OPTIMIZATION: Batch lookup all artists with single query using IN clause
      const placeholders = artistNames.map(() => '?').join(', ');
      const artistLookupQuery = `SELECT id, name FROM artists WHERE name IN (${placeholders})`;
      
      if (verbose) log.debug('Batch lookup artists', { count: artistNames.length });
      const artistQueryResult = await env.DB.prepare(artistLookupQuery)
        .bind(...artistNames)
        .all<{ id: string; name: string }>();

      // Create map of found artists
      const foundArtistsMap = new Map<string, { id: string; name: string }>();
      if (artistQueryResult && Array.isArray(artistQueryResult.results)) {
        for (const artist of artistQueryResult.results) {
          foundArtistsMap.set(artist.name, artist);
        }
      }

      // Identify artists that need to be created
      const artistsToCreate: Array<{ id: string; name: string; tags: string }> = [];
      
      for (const artistName of artistNames) {
        const existingArtist = foundArtistsMap.get(artistName);
        
        if (existingArtist) {
          // Link existing artist
          linkedArtists.push({
            id: existingArtist.id,
            name: existingArtist.name,
            status: 'linked',
          });
          // Attempt to upgrade existing artist to approved when linking from mass-import
          try {
            await env.DB.prepare(`UPDATE artists SET status = ?, updated_at = ? WHERE id = ?`)
              .bind('approved', now, existingArtist.id)
              .run();
            if (verbose) log.debug('Upgraded existing artist to approved during artwork import', { artistId: existingArtist.id });
          } catch (err) {
            log.warn('Failed to upgrade linked artist to approved', { artistId: existingArtist.id, error: err instanceof Error ? err.message : String(err) });
          }
          if (verbose) log.debug('Found existing artist', { artistId: existingArtist.id, name: artistName });
        } else {
          // Prepare new stub artist for batch insert
          const newArtistId = generateUUID();
          const artistTags = JSON.stringify({
            source_id: `auto-created-from-${validatedData.id}`,
            auto_created: true,
            created_from_artwork: artworkId,
          });

          artistsToCreate.push({
            id: newArtistId,
            name: artistName,
            tags: artistTags,
          });

          linkedArtists.push({
            id: newArtistId,
            name: artistName,
            status: 'created',
          });
        }
      }

      // OPTIMIZATION: Batch insert new artists using D1 batch API
      if (artistsToCreate.length > 0) {
        if (verbose) log.debug('Batch creating artists', { count: artistsToCreate.length });
        
        const batchStatements = artistsToCreate.map(artist =>
          env.DB.prepare(
            'INSERT INTO artists (id, name, description, aliases, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            artist.id,
            artist.name,
            null, // No description for auto-created artists
            null, // No aliases
            artist.tags,
            'approved', // Auto-approve artists created during artwork import
            now,
            now
          )
        );

        await env.DB.batch(batchStatements);
        log.info('Batch created artists', { count: artistsToCreate.length });
      }
      
    } catch (error) {
      log.error('Failed to process artists', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw createDatabaseError('Failed to process artist records');
    }
  }
  timings.artistProcessing = Date.now() - t5;

  // Step 6: Process photos if provided
  const t6 = Date.now();
  if (verbose) log.debug('Step 6: Processing photos', { photoCount: validatedData.properties.photos?.length || 0 });
  let photosJson = JSON.stringify([]);
  const photoErrors: Array<{ index: number; url: string; error: string }> = [];

  if (validatedData.properties.photos && validatedData.properties.photos.length > 0) {
    try {
      const photoResult = await processPhotos(validatedData.properties.photos as PhotoInput[], env);
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
  timings.photoProcessing = Date.now() - t6;

  // Step 7: Create artwork record
  const t7 = Date.now();
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

    timings.artworkCreation = Date.now() - t7;
    log.info('Created artwork record', { artworkId, title: validatedData.properties.title, duration: timings.artworkCreation });
  } catch (error) {
    log.error('Failed to create artwork', {
      error: error instanceof Error ? error.message : '[TypeError]',
      artworkId,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw createDatabaseError('Failed to create artwork record');
  }

  // Step 8: Create artist links - OPTIMIZED with batch operations
  const t8 = Date.now();
  if (verbose) log.debug('Step 8: Creating artist links', { artistCount: linkedArtists.length });
  
  if (linkedArtists.length > 0) {
    try {
      // OPTIMIZATION: Batch insert all artist links with D1 batch API
      const linkStatements = linkedArtists.map(artist =>
        env.DB.prepare(
          'INSERT INTO artwork_artists (artwork_id, artist_id, role, created_at) VALUES (?, ?, ?, ?)'
        ).bind(artworkId, artist.id, 'primary', now)
      );

      await env.DB.batch(linkStatements);
      timings.artistLinking = Date.now() - t8;
      log.info('Batch linked artists to artwork', { artworkId, artistCount: linkedArtists.length, duration: timings.artistLinking });
      
    } catch (error) {
      log.error('Failed to link artists', {
        error: error instanceof Error ? error.message : String(error),
        artworkId,
      });
      // Don't throw - artwork is created, links are nice-to-have
    }
  } else {
    timings.artistLinking = 0;
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
    timings.total = duration;
    log.info('Artwork import completed', {
      artworkId,
      duration,
      artistsLinked: linkedArtists.length,
      photosProcessed: response.data.photosProcessed?.successful || 0,
      timings, // Include detailed timing breakdown
    });
  }

  return response;
}
