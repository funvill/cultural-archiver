/**
 * Database utilities for Cloudflare D1 operations
 * Provides prepared statements and helper functions for artwork, logbook, and tag operations
 */

import { generateUUID } from '../../shared/constants.js';
import type {
  ArtworkRecord,
  LogbookRecord,
  TagRecord,
  CreateArtworkRequest,
  CreateSubmissionEntryRequest,
  CreateTagRequest,
} from '../types';

// Database result interfaces
interface ArtworkWithDistance extends ArtworkRecord {
  type_name: string;
  distance_sq: number;
  distance_km: number;
  artist_name?: string;
}

export class DatabaseService {
  constructor(public db: D1Database) {} // Make db public for direct SQL access when needed

  // ================================
  // Artwork Operations
  // ================================

  async createArtwork(data: CreateArtworkRequest): Promise<string> {
    const id = generateUUID();
    const now = new Date().toISOString();

    // Insert artwork with all available fields including photos
    const stmt = this.db.prepare(`
      INSERT INTO artwork (id, lat, lon, created_at, updated_at, status, tags, photos, title, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tagsJson = data.tags ? JSON.stringify(data.tags) : null;
    const status = data.status || 'pending'; // Default to 'pending' if not specified
    await stmt.bind(
      id, 
      data.lat, 
      data.lon, 
      now, 
      now, // updated_at
      status, 
      tagsJson,
      data.photos || null,
      data.title || null,
      data.description || null, 
      data.created_by || null
    ).run();

    // Create artwork_type tag if not present
    const artworkType: string =
      data.tags && typeof (data.tags as Record<string, unknown>)['artwork_type'] === 'string'
        ? (data.tags as Record<string, unknown>)['artwork_type'] as string
        : 'unknown';
    await this.createTag({
      artwork_id: id,
      label: 'artwork_type',
      value: artworkType
    });

    return id;
  }

  async getArtworkById(id: string): Promise<ArtworkRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM artwork WHERE id = ?');
    const result = await stmt.bind(id).first();
    return result ? (result as unknown as ArtworkRecord) : null;
  }

  async getArtworkWithDetails(id: string): Promise<(ArtworkRecord & { type_name: string; artist_name?: string }) | null> {
    try {
      // Query artwork table with artist information - join with artwork_artists and artists tables
      const stmt = this.db.prepare(`
        SELECT a.*, 
               COALESCE(json_extract(a.tags, '$.artwork_type'), 'unknown') as type_name,
               COALESCE(art.name, a.created_by, 'Unknown Artist') as artist_name
        FROM artwork a
        LEFT JOIN artwork_artists aa ON a.id = aa.artwork_id AND aa.role = 'primary'
        LEFT JOIN artists art ON aa.artist_id = art.id
        WHERE a.id = ? AND a.status = 'approved'
      `);
      const result = await stmt.bind(id).first();
      if (!result) {
        console.log('[DB DEBUG] getArtworkWithDetails: Artwork not found or not approved', { id });
        return null;
      }
      return result as unknown as ArtworkRecord & { type_name: string; artist_name?: string };
    } catch (err) {
      console.error('[DB ERROR] getArtworkWithDetails failed', err);
      throw err;
    }
  }

  async findNearbyArtworks(
    lat: number,
    lon: number,
    radius: number = 500,
    limit: number = 20
  ): Promise<ArtworkWithDistance[]> {
    // Convert radius from meters to degrees (approximate)
    const radiusDegrees = radius / 111000; // ~111km per degree

    const stmt = this.db.prepare(`
      SELECT a.*, 
             COALESCE(json_extract(a.tags, '$.artwork_type'), 'unknown') as type_name,
             json_extract(a.tags, '$.artist') as artist_name,
             (
               (? - a.lat) * (? - a.lat) + 
               (? - a.lon) * (? - a.lon)
             ) as distance_sq
      FROM artwork a
      WHERE a.status = 'approved'
        AND a.lat BETWEEN ? AND ?
        AND a.lon BETWEEN ? AND ?
      ORDER BY distance_sq ASC
      LIMIT ?
    `);

    const minLat = lat - radiusDegrees;
    const maxLat = lat + radiusDegrees;
    const minLon = lon - radiusDegrees;
    const maxLon = lon + radiusDegrees;

    const results = await stmt
      .bind(
        lat,
        lat,
        lon,
        lon, // for distance calculation
        minLat,
        maxLat,
        minLon,
        maxLon, // for bounding box
        limit
      )
      .all();

    // Convert distance_sq to actual distance and filter by radius
    return (results.results as unknown as ArtworkWithDistance[])
      .map((artwork: ArtworkWithDistance) => {
        const distanceKm = Math.sqrt(artwork.distance_sq) * 111; // Convert degrees to km
        return {
          ...artwork,
          distance_km: distanceKm,
        };
      })
      .filter((artwork: ArtworkWithDistance) => artwork.distance_km <= radius / 1000);
  }

  async findArtworksInBounds(
    north: number,
    south: number,
    east: number,
    west: number,
    limit: number = 100
  ): Promise<ArtworkWithDistance[]> {
    const stmt = this.db.prepare(`
      SELECT a.*, 
             COALESCE(json_extract(a.tags, '$.artwork_type'), 'unknown') as type_name,
             json_extract(a.tags, '$.artist') as artist_name
      FROM artwork a
      WHERE a.status = 'approved'
        AND a.lat BETWEEN ? AND ?
        AND a.lon BETWEEN ? AND ?
      ORDER BY a.created_at DESC
      LIMIT ?
    `);

    const results = await stmt
      .bind(
        south, // min lat
        north, // max lat
        west, // min lon
        east, // max lon
        limit
      )
      .all();

    // For bounds queries, we don't calculate distance, so set to 0
    return (results.results as unknown as (ArtworkRecord & { type_name: string; artist_name?: string })[]).map(
      artwork => ({
        ...artwork,
        distance_km: 0,
        distance_sq: 0,
      }) as ArtworkWithDistance
    );
  }

  async updateArtworkStatus(id: string, status: ArtworkRecord['status']): Promise<void> {
    const stmt = this.db.prepare('UPDATE artwork SET status = ? WHERE id = ?');
    await stmt.bind(status, id).run();
  }

  // ================================
  // Logbook Operations
  // ================================

  async createLogbookEntry(data: CreateSubmissionEntryRequest): Promise<LogbookRecord> {
    const id = generateUUID();
    const now = new Date().toISOString();

    // Use submissions table with logbook_entry submission_type
    const stmt = this.db.prepare(`
      INSERT INTO submissions (id, artwork_id, user_token, lat, lon, notes, photos, status, created_at, submission_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'logbook_entry')
    `);

    const photosJson = data.photos ? JSON.stringify(data.photos) : null;
    await stmt.bind(
      id,
      data.artwork_id || null,
      data.user_token,
      data.lat || null,
      data.lon || null,
      data.notes || null,
      photosJson,
      now
    ).run();

    return {
      id,
      artwork_id: data.artwork_id || null,
      user_token: data.user_token,
      lat: data.lat || null,
      lon: data.lon || null,
      notes: data.notes || null,
      photos: photosJson,
      status: 'pending',
      created_at: now,
    };
  }

  async getLogbookById(id: string): Promise<LogbookRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM submissions WHERE id = ? AND submission_type = "logbook_entry"');
    const result = await stmt.bind(id).first();
    return result ? (result as unknown as LogbookRecord) : null;
  }

  async getLogbookEntriesForArtwork(
    artworkId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<LogbookRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM submissions 
      WHERE artwork_id = ? AND status = 'approved' AND submission_type = 'logbook_entry'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const results = await stmt.bind(artworkId, limit, offset).all();
    return results.results as unknown as LogbookRecord[];
  }

  async getUserSubmissions(
    userToken: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<{
    submissions: (LogbookRecord & {
      artwork_lat?: number;
      artwork_lon?: number;
      artwork_type_name?: string;
    })[];
    total: number;
  }> {
    console.log(
      `[DB DEBUG] getUserSubmissions called with token: ${userToken}, page: ${page}, perPage: ${perPage}`
    );
    const offset = (page - 1) * perPage;

    // Get submissions (exclude rejected)
    const query = `
      SELECT s.*, 
             a.lat as artwork_lat, 
             a.lon as artwork_lon, 
             COALESCE(json_extract(a.tags, '$.artwork_type'), 'unknown') as artwork_type_name
      FROM submissions s
      LEFT JOIN artwork a ON s.artwork_id = a.id
      WHERE s.user_token = ? 
        AND s.status != 'rejected' 
        AND s.submission_type = 'logbook_entry'
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;
    console.log(`[DB DEBUG] Executing query: ${query}`);
    console.log(`[DB DEBUG] Query parameters: [${userToken}, ${perPage}, ${offset}]`);

    const stmt = this.db.prepare(query);
    const results = await stmt.bind(userToken, perPage, offset).all();
    console.log(`[DB DEBUG] Query returned ${results.results?.length || 0} results`);
    console.log(`[DB DEBUG] Raw results:`, JSON.stringify(results.results, null, 2));

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM submissions 
      WHERE user_token = ? AND status != 'rejected' AND submission_type = 'logbook_entry'
    `;
    console.log(`[DB DEBUG] Executing count query: ${countQuery}`);
    const countStmt = this.db.prepare(countQuery);
    const countResult = await countStmt.bind(userToken).first();
    console.log(`[DB DEBUG] Count result:`, countResult);

    return {
      submissions: results.results as unknown as (LogbookRecord & {
        artwork_lat?: number;
        artwork_lon?: number;
        artwork_type_name?: string;
      })[],
      total: (countResult as { total: number } | null)?.total || 0,
    };
  }

  async getPendingSubmissions(): Promise<LogbookRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM submissions 
      WHERE status = 'pending' AND submission_type = 'logbook_entry'
      ORDER BY created_at ASC
    `);
    const results = await stmt.bind().all();
    return results.results as unknown as LogbookRecord[];
  }

  async updateLogbookStatus(id: string, status: LogbookRecord['status']): Promise<void> {
    const stmt = this.db.prepare('UPDATE submissions SET status = ? WHERE id = ? AND submission_type = ?');
    await stmt.bind(status, id, 'logbook_entry').run();
  }

  async updateLogbookPhotos(id: string, photoUrls: string[]): Promise<void> {
    const stmt = this.db.prepare('UPDATE submissions SET photos = ? WHERE id = ? AND submission_type = ?');
    await stmt.bind(JSON.stringify(photoUrls), id, 'logbook_entry').run();
  }

  async linkLogbookToArtwork(logbookId: string, artworkId: string): Promise<void> {
    const stmt = this.db.prepare('UPDATE submissions SET artwork_id = ? WHERE id = ? AND submission_type = ?');
    await stmt.bind(artworkId, logbookId, 'logbook_entry').run();
  }

  // ================================
  // Tag Operations
  // ================================

  async createTag(data: CreateTagRequest): Promise<TagRecord> {
    const id = generateUUID();
    const now = new Date().toISOString();

    if (data.artwork_id) {
      // Get current tags from artwork
      const artworkStmt = this.db.prepare('SELECT tags FROM artwork WHERE id = ?');
      const artwork = await artworkStmt.bind(data.artwork_id).first() as { tags?: string } | null;
      
      let currentTags: Record<string, string | number | boolean> = {};
      if (artwork?.tags) {
        try {
          currentTags = JSON.parse(artwork.tags);
        } catch (e) {
          console.warn('Failed to parse existing artwork tags', e);
        }
      }
      
      // Add new tag
      currentTags[data.label] = data.value;
      
      // Update artwork with new tags (artwork table doesn't have updated_at column)
      const updateStmt = this.db.prepare('UPDATE artwork SET tags = ? WHERE id = ?');
      await updateStmt.bind(JSON.stringify(currentTags), data.artwork_id).run();
      
    } else if (data.logbook_id) {
      // Get current tags from submission/logbook
      const logbookStmt = this.db.prepare('SELECT tags FROM submissions WHERE id = ?');
      const logbook = await logbookStmt.bind(data.logbook_id).first() as { tags?: string } | null;
      
      let currentTags: Record<string, string | number | boolean> = {};
      if (logbook?.tags) {
        try {
          currentTags = JSON.parse(logbook.tags);
        } catch (e) {
          console.warn('Failed to parse existing logbook tags', e);
        }
      }
      
      // Add new tag
      currentTags[data.label] = data.value;
      
      // Update submission with new tags (submissions table has updated_at column)
      const updateSubmissionStmt = this.db.prepare('UPDATE submissions SET tags = ?, updated_at = datetime("now") WHERE id = ?');
      await updateSubmissionStmt.bind(JSON.stringify(currentTags), data.logbook_id).run();
    }

    return {
      id,
      artwork_id: data.artwork_id || null,
      logbook_id: data.logbook_id || null,
      label: data.label,
      value: data.value,
      created_at: now,
    };
  }

  async getTagsForArtwork(artworkId: string): Promise<TagRecord[]> {
    // With the new schema, tags are stored as JSON in the artwork table
    const stmt = this.db.prepare('SELECT tags FROM artwork WHERE id = ?');
    const result = await stmt.bind(artworkId).first() as { tags?: string } | null;
    
    if (!result || !result.tags) {
      return [];
    }
    
    try {
      const tags = JSON.parse(result.tags);
      // Convert JSON object to TagRecord array format
      return Object.entries(tags).map(([label, value]) => ({
        id: `${artworkId}-${label}`,
        artwork_id: artworkId,
        logbook_id: null,
        label,
        value: String(value),
        created_at: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('Failed to parse artwork tags JSON', e);
      return [];
    }
  }

  async getTagsForLogbook(logbookId: string): Promise<TagRecord[]> {
    // With the new schema, tags are stored as JSON in the submissions table  
    const stmt = this.db.prepare("SELECT tags FROM submissions WHERE id = ? AND submission_type = 'logbook_entry'");
    const result = await stmt.bind(logbookId).first() as { tags?: string } | null;
    
    if (!result || !result.tags) {
      return [];
    }
    
    try {
      const tags = JSON.parse(result.tags);
      // Convert JSON object to TagRecord array format
      return Object.entries(tags).map(([label, value]) => ({
        id: `${logbookId}-${label}`,
        artwork_id: null,
        logbook_id: logbookId,
        label,
        value: String(value),
        created_at: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('Failed to parse logbook tags JSON', e);
      return [];
    }
  }

  // Get all unique artwork types from tags
  async getAllArtworkTypes(): Promise<string[]> {
    const stmt = this.db.prepare(`
      SELECT DISTINCT json_extract(tags, '$.artwork_type') as type
      FROM artwork 
      WHERE json_extract(tags, '$.artwork_type') IS NOT NULL
      ORDER BY type
    `);
    const results = await stmt.all();
    return (results.results as unknown as { type: string }[])
      .map(row => row.type)
      .filter(type => type && type !== 'null');
  }

  // ================================
  // Utility Methods
  // ================================

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message?: string }> {
    try {
      const stmt = this.db.prepare('SELECT 1 as test');
      await stmt.first();
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  async getUserTokenSubmissionCount24h(userToken: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM submissions 
      WHERE user_token = ? AND created_at > ? AND submission_type = 'logbook_entry'
    `);
    const result = await stmt.bind(userToken, twentyFourHoursAgo).first();
    return (result as { count: number } | null)?.count || 0;
  }

  async getCreatorsForArtwork(artworkId: string): Promise<{ id: string; name: string; role: string }[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT a.id, a.name, aa.role
        FROM artists a
        JOIN artwork_artists aa ON a.id = aa.artist_id
        WHERE aa.artwork_id = ? AND a.status = 'active'
        ORDER BY aa.created_at ASC
      `);

      const results = await stmt.bind(artworkId).all();
      return results.results as unknown as { id: string; name: string; role: string }[];
    } catch (error) {
      // Return empty array if artist tables don't exist yet
      console.warn('Artist tables not found, returning empty artists list:', error);
      return [];
    }
  }

  // Get artists from the new artist system
  async getArtistsForArtwork(artworkId: string): Promise<{ id: string; name: string; role: string }[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT a.id, a.name, aa.role
        FROM artists a
        JOIN artwork_artists aa ON a.id = aa.artist_id
        WHERE aa.artwork_id = ? AND a.status = 'active'
        ORDER BY aa.created_at ASC
      `);

      const results = await stmt.bind(artworkId).all();
      return results.results as unknown as { id: string; name: string; role: string }[];
    } catch (error) {
      // Return empty array if artist tables don't exist yet
      console.warn('Artist tables not found, returning empty artists list:', error);
      return [];
    }
  }

  // ================================
  // Artist Operations for Mass Import
  // ================================

  async searchArtistsByNormalizedName(normalizedName: string): Promise<{ id: string; name: string }[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT id, name 
        FROM artists 
        WHERE LOWER(TRIM(name)) = ? AND status = 'active'
        ORDER BY created_at ASC
      `);

      const results = await stmt.bind(normalizedName).all();
      return results.results as unknown as { id: string; name: string }[];
    } catch (error) {
      console.warn('Error searching artists by normalized name:', error);
      return [];
    }
  }

  async searchArtistsByTokens(tokens: string[]): Promise<{ id: string; name: string; score: number }[]> {
    if (tokens.length === 0) return [];

    try {
      // Build a query that checks if all tokens are present in the artist name
      const tokenConditions = tokens.map(() => 'LOWER(name) LIKE ?').join(' AND ');
      const stmt = this.db.prepare(`
        SELECT id, name 
        FROM artists 
        WHERE ${tokenConditions} AND status = 'active'
        ORDER BY created_at ASC
      `);

      const tokenParams = tokens.map(token => `%${token}%`);
      const results = await stmt.bind(...tokenParams).all();
      
      // Add simple scoring based on how many tokens match
      return (results.results as unknown as { id: string; name: string }[]).map(artist => ({
        ...artist,
        score: this.calculateTokenMatchScore(artist.name, tokens)
      }));
    } catch (error) {
      console.warn('Error searching artists by tokens:', error);
      return [];
    }
  }

  private calculateTokenMatchScore(artistName: string, searchTokens: string[]): number {
    const artistTokens = this.normalizeArtistName(artistName).split(' ').filter(t => t);
    const matchingTokens = searchTokens.filter(searchToken => 
      artistTokens.some(artistToken => artistToken.includes(searchToken) || searchToken.includes(artistToken))
    );
    return matchingTokens.length / searchTokens.length;
  }

  async createArtistFromMassImport(data: {
    name: string;
    description?: string;
    tags?: Record<string, string>;
    source: string;
    sourceData?: unknown;
  }): Promise<string> {
    const id = generateUUID();
    const now = new Date().toISOString();

    // Build tags object with source metadata
    const importMetadata: Record<string, unknown> = {
      source: data.source,
      imported_at: now,
    };
    if (data.sourceData !== undefined) {
      (importMetadata as Record<string, unknown>).source_data = data.sourceData;
    }
    const tags: Record<string, unknown> = {
      ...(data.tags ?? {}),
      import_metadata: importMetadata,
    };

    const stmt = this.db.prepare(`
      INSERT INTO artists (id, name, description, tags, created_at, updated_at, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `);

    await stmt.bind(
      id,
      data.name,
      data.description || null,
      JSON.stringify(tags),
      now,
      now
    ).run();

    console.log(`[DB] Created artist for mass import: ${id} - ${data.name}`);
    return id;
  }

  async linkArtworkToArtist(artworkId: string, artistId: string, role: string = 'artist'): Promise<string> {
    const id = generateUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO artwork_artists (id, artwork_id, artist_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    await stmt.bind(id, artworkId, artistId, role, now).run();
    console.log(`[DB] Linked artwork ${artworkId} to artist ${artistId} with role ${role}`);
    return id;
  }

  private normalizeArtistName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .toLowerCase()
      .normalize('NFKD') // Decompose diacritics
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s-]/g, ''); // Remove punctuation except hyphens
  }

  // Legacy getArtworksForCreator function removed - used non-existent artwork_creators table
}

// Helper function to create database service instance
export function createDatabaseService(db: D1Database): DatabaseService {
  return new DatabaseService(db);
}

// ================================
// Individual Function Exports (for legacy compatibility)
// ================================

export async function insertArtwork(
  db: D1Database,
  artwork: Omit<ArtworkRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  const service = createDatabaseService(db);

  // Parse existing tags and extract artwork_type if present
  let parsedTags = {};
  try {
    parsedTags = artwork.tags ? JSON.parse(artwork.tags) : {};
  } catch (error) {
    console.warn('[DATABASE] Failed to parse artwork tags, using empty object', error);
  }

  // Convert artwork to CreateArtworkRequest format - include title, description, and created_by
  // Only include these fields if they have non-null values
  const createRequest: CreateArtworkRequest = {
    lat: artwork.lat,
    lon: artwork.lon,
    tags: parsedTags,
    status: artwork.status, // Pass through the status
    ...(artwork.title && { title: artwork.title }), // Only include if not null/empty
    ...(artwork.description && { description: artwork.description }), // Only include if not null/empty
    ...(artwork.created_by && { created_by: artwork.created_by }), // Only include if not null/empty
  };

  return service.createArtwork(createRequest);
}

export async function updateLogbookStatus(
  db: D1Database,
  id: string,
  status: LogbookRecord['status'],
  artworkId?: string
): Promise<void> {
  const service = createDatabaseService(db);
  await service.updateLogbookStatus(id, status);
  if (artworkId) {
    await service.linkLogbookToArtwork(id, artworkId);
  }
}

export async function updateLogbookPhotos(
  db: D1Database,
  id: string,
  photoUrls: string[]
): Promise<void> {
  const service = createDatabaseService(db);
  await service.updateLogbookPhotos(id, photoUrls);
}

export async function findNearbyArtworks(
  db: D1Database,
  lat: number,
  lon: number,
  radiusMeters: number = 500
): Promise<ArtworkRecord[]> {
  const service = createDatabaseService(db);
  return service.findNearbyArtworks(lat, lon, radiusMeters);
}

export async function findLogbookById(db: D1Database, id: string): Promise<LogbookRecord | null> {
  const service = createDatabaseService(db);
  return service.getLogbookById(id);
}

export async function insertTags(
  db: D1Database,
  tags: Array<{ label: string; value: string; artwork_id?: string; logbook_id?: string | null }>
): Promise<void> {
  const service = createDatabaseService(db);
  for (const tag of tags) {
    if (tag.artwork_id || tag.logbook_id) {
      const createRequest: CreateTagRequest = {
        label: tag.label,
        value: tag.value,
        ...(tag.artwork_id && { artwork_id: tag.artwork_id }),
        ...(tag.logbook_id && { logbook_id: tag.logbook_id }),
      };
      await service.createTag(createRequest);
    }
  }
}

export async function findArtworkById(db: D1Database, id: string): Promise<ArtworkRecord | null> {
  const service = createDatabaseService(db);
  return service.getArtworkById(id);
}

export async function updateArtworkPhotos(
  db: D1Database,
  id: string,
  photoUrls: string[]
): Promise<void> {
  // Store photos in the dedicated photos field (not in tags._photos)
  const photosJson = JSON.stringify(photoUrls);
  
  const stmt = db.prepare(`
    UPDATE artwork
    SET photos = ?
    WHERE id = ?
  `);
  await stmt.bind(photosJson, id).run();
}

export function getPhotosFromArtwork(artwork: ArtworkRecord): string[] {
  // First try the dedicated photos field
  if (artwork.photos) {
    try {
      const photos = JSON.parse(artwork.photos);
      if (Array.isArray(photos)) return photos;
    } catch {
      // Fall through to legacy check
    }
  }
  
  // Legacy fallback: check tags._photos for existing data
  if (artwork.tags) {
    try {
      const tags = JSON.parse(artwork.tags);
      if (Array.isArray(tags._photos)) return tags._photos;
    } catch {
      // Ignore parse errors
    }
  }
  
  return [];
}

// ================================
// Creator Helper Functions
// ================================

export async function getCreatorsForArtwork(
  db: D1Database,
  artworkId: string
): Promise<{ id: string; name: string; role: string }[]> {
  const service = createDatabaseService(db);
  return service.getCreatorsForArtwork(artworkId);
}

// ================================
// Logbook Functions
// ================================

/**
 * Check if a user is on cooldown for submitting logbook entries for a specific artwork
 * Users can only submit one logbook entry per artwork every 30 days
 */
export async function getLogbookCooldownStatus(
  db: D1Database,
  artworkId: string,
  userToken: string
): Promise<{ onCooldown: boolean; cooldownUntil?: string }> {
  try {
    // Check for any approved or pending logbook entry from this user for this artwork in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const stmt = db.prepare(`
      SELECT created_at FROM submissions 
      WHERE user_token = ? 
        AND artwork_id = ? 
        AND submission_type = 'logbook_entry'
        AND status IN ('pending', 'approved')
        AND created_at > ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    const result = await stmt.bind(userToken, artworkId, thirtyDaysAgo).first<{ created_at: string }>();
    
    if (!result) {
      return { onCooldown: false };
    }
    
    // Calculate when the cooldown expires (30 days from the last submission)
    const lastSubmission = new Date(result.created_at);
    const cooldownUntil = new Date(lastSubmission.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return {
      onCooldown: true,
      cooldownUntil: cooldownUntil.toISOString(),
    };
  } catch (error) {
    console.error('Failed to check logbook cooldown status:', error);
    // Return no cooldown on error to allow submission (fail open)
    return { onCooldown: false };
  }
}
