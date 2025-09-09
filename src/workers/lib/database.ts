/**
 * Database utilities for Cloudflare D1 operations
 * Provides prepared statements and helper functions for artwork, logbook, and tag operations
 */

import type {
  ArtworkRecord,
  LogbookRecord,
  TagRecord,
  ArtworkTypeRecord,
  CreateArtworkRequest,
  CreateLogbookEntryRequest,
  CreateTagRequest,
  CreatorRecord,
  CreateCreatorRequest,
  CreateArtworkCreatorRequest,
  ArtworkCreatorInfo,
} from '../types';

// Database result interfaces
interface ArtworkWithDistance extends ArtworkRecord {
  type_name: string;
  distance_sq: number;
  distance_km: number;
}

export class DatabaseService {
  constructor(public db: D1Database) {} // Make db public for direct SQL access when needed

  // ================================
  // Artwork Operations
  // ================================

  async createArtwork(data: CreateArtworkRequest): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // For MVP, we'll add photos as NULL since the current schema doesn't have it
    const stmt = this.db.prepare(`
      INSERT INTO artwork (id, lat, lon, type_id, created_at, status, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const tagsJson = data.tags ? JSON.stringify(data.tags) : null;
    const status = data.status || 'pending'; // Default to 'pending' if not specified
    await stmt.bind(id, data.lat, data.lon, data.type_id, now, status, tagsJson).run();

    return id;
  }

  async getArtworkById(id: string): Promise<ArtworkRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM artwork WHERE id = ?');
    const result = await stmt.bind(id).first();
    return result ? (result as unknown as ArtworkRecord) : null;
  }

  async getArtworkWithDetails(id: string): Promise<(ArtworkRecord & { type_name: string }) | null> {
    try {
      // Primary query with LEFT JOIN for type name (safe if table exists)
      const stmt = this.db.prepare(`
        SELECT a.*, COALESCE(at.name, 'Unknown') as type_name
        FROM artwork a
        LEFT JOIN artwork_types at ON a.type_id = at.id
        WHERE a.id = ? AND a.status = 'approved'
      `);
      const result = await stmt.bind(id).first();
      if (!result) {
        console.log('[DB DEBUG] getArtworkWithDetails: Artwork not found or not approved', { id });
        return null;
      }
      const typedResult = result as unknown as ArtworkRecord & { type_name: string };
      if (typedResult.type_name === 'Unknown') {
        console.warn('[DB WARN] Artwork found but artwork_types entry missing or unmapped', {
          id,
          type_id: typedResult.type_id,
        });
      }
      return typedResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/no such table: artwork_types/i.test(message)) {
        // Fallback: table not present (older prod schema). Return artwork anyway.
        console.warn('[DB WARN] artwork_types table missing; falling back to artwork-only query');
        try {
          const fallbackStmt = this.db.prepare(`
            SELECT a.*, 'Unknown' as type_name
            FROM artwork a
            WHERE a.id = ? AND a.status = 'approved'
          `);
          const fallbackResult = await fallbackStmt.bind(id).first();
            if (!fallbackResult) {
              return null;
            }
            return fallbackResult as unknown as ArtworkRecord & { type_name: string };
        } catch (innerErr) {
          console.error('[DB ERROR] Fallback artwork-only query failed', innerErr);
          throw innerErr;
        }
      }
      console.error('[DB ERROR] getArtworkWithDetails failed unexpectedly', err);
      throw err;
    }
  }

  async findNearbyArtworks(
    lat: number,
    lon: number,
    radius: number = 500,
    limit: number = 20
  ): Promise<(ArtworkRecord & { type_name: string; distance_km: number })[]> {
    // Convert radius from meters to degrees (approximate)
    const radiusDegrees = radius / 111000; // ~111km per degree

    const stmt = this.db.prepare(`
      SELECT a.*, at.name as type_name,
             (
               (? - a.lat) * (? - a.lat) + 
               (? - a.lon) * (? - a.lon)
             ) as distance_sq
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
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
  ): Promise<(ArtworkRecord & { type_name: string; distance_km: number })[]> {
    const stmt = this.db.prepare(`
      SELECT a.*, at.name as type_name
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
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
    return (results.results as unknown as (ArtworkRecord & { type_name: string })[]).map(
      artwork => ({
        ...artwork,
        distance_km: 0,
      })
    );
  }

  async updateArtworkStatus(id: string, status: ArtworkRecord['status']): Promise<void> {
    const stmt = this.db.prepare('UPDATE artwork SET status = ? WHERE id = ?');
    await stmt.bind(status, id).run();
  }

  // ================================
  // Logbook Operations
  // ================================

  async createLogbookEntry(data: CreateLogbookEntryRequest): Promise<LogbookRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // First try with lat/lon columns, fallback to basic columns if they don't exist
    let stmt;
    let bindParams;

    try {
      // Try the full schema with lat/lon columns
      stmt = this.db.prepare(`
        INSERT INTO logbook (id, artwork_id, user_token, lat, lon, note, photos, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `);

      const photosJson = data.photos ? JSON.stringify(data.photos) : null;
      bindParams = [
        id,
        data.artwork_id || null,
        data.user_token,
        data.lat || null,
        data.lon || null,
        data.note || null,
        photosJson,
        now,
      ];

      await stmt.bind(...bindParams).run();
    } catch (error) {
      console.log('[DATABASE] lat/lon columns not found, trying fallback schema...', error);

      // Fallback to basic schema without lat/lon columns
      stmt = this.db.prepare(`
        INSERT INTO logbook (id, artwork_id, user_token, note, photos, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `);

      const photosJson = data.photos ? JSON.stringify(data.photos) : null;
      bindParams = [
        id,
        data.artwork_id || null,
        data.user_token,
        data.note || null,
        photosJson,
        now,
      ];

      await stmt.bind(...bindParams).run();
    }

    const photosJson = data.photos ? JSON.stringify(data.photos) : null;

    return {
      id,
      artwork_id: data.artwork_id || null,
      user_token: data.user_token,
      lat: data.lat || null,
      lon: data.lon || null,
      note: data.note || null,
      photos: photosJson,
      status: 'pending',
      created_at: now,
    };
  }

  async getLogbookById(id: string): Promise<LogbookRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM logbook WHERE id = ?');
    const result = await stmt.bind(id).first();
    return result ? (result as unknown as LogbookRecord) : null;
  }

  async getLogbookEntriesForArtwork(
    artworkId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<LogbookRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM logbook 
      WHERE artwork_id = ? AND status = 'approved'
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
      SELECT l.*, a.lat as artwork_lat, a.lon as artwork_lon, at.name as artwork_type_name
      FROM logbook l
      LEFT JOIN artwork a ON l.artwork_id = a.id
      LEFT JOIN artwork_types at ON a.type_id = at.id
      WHERE l.user_token = ? AND l.status != 'rejected'
      ORDER BY l.created_at DESC
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
      SELECT COUNT(*) as total FROM logbook 
      WHERE user_token = ? AND status != 'rejected'
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
      SELECT * FROM logbook 
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `);
    const results = await stmt.bind().all();
    return results.results as unknown as LogbookRecord[];
  }

  async updateLogbookStatus(id: string, status: LogbookRecord['status']): Promise<void> {
    const stmt = this.db.prepare('UPDATE logbook SET status = ? WHERE id = ?');
    await stmt.bind(status, id).run();
  }

  async updateLogbookPhotos(id: string, photoUrls: string[]): Promise<void> {
    const stmt = this.db.prepare('UPDATE logbook SET photos = ? WHERE id = ?');
    await stmt.bind(JSON.stringify(photoUrls), id).run();
  }

  async linkLogbookToArtwork(logbookId: string, artworkId: string): Promise<void> {
    const stmt = this.db.prepare('UPDATE logbook SET artwork_id = ? WHERE id = ?');
    await stmt.bind(artworkId, logbookId).run();
  }

  // ================================
  // Artwork Types Operations
  // ================================

  async getAllArtworkTypes(): Promise<ArtworkTypeRecord[]> {
    const stmt = this.db.prepare('SELECT * FROM artwork_types ORDER BY name');
    const results = await stmt.bind().all();
    return results.results as unknown as ArtworkTypeRecord[];
  }

  async getArtworkTypeById(id: string): Promise<ArtworkTypeRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM artwork_types WHERE id = ?');
    const result = await stmt.bind(id).first();
    return result ? (result as unknown as ArtworkTypeRecord) : null;
  }

  async getArtworkTypeByName(name: string): Promise<ArtworkTypeRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM artwork_types WHERE name = ?');
    const result = await stmt.bind(name).first();
    return result ? (result as unknown as ArtworkTypeRecord) : null;
  }

  // ================================
  // Tag Operations
  // ================================

  async createTag(data: CreateTagRequest): Promise<TagRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO tags (id, artwork_id, logbook_id, label, value, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    await stmt
      .bind(id, data.artwork_id || null, data.logbook_id || null, data.label, data.value, now)
      .run();

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
    const stmt = this.db.prepare('SELECT * FROM tags WHERE artwork_id = ?');
    const results = await stmt.bind(artworkId).all();
    return results.results as unknown as TagRecord[];
  }

  async getTagsForLogbook(logbookId: string): Promise<TagRecord[]> {
    const stmt = this.db.prepare('SELECT * FROM tags WHERE logbook_id = ?');
    const results = await stmt.bind(logbookId).all();
    return results.results as unknown as TagRecord[];
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
      SELECT COUNT(*) as count FROM logbook 
      WHERE user_token = ? AND created_at > ?
    `);
    const result = await stmt.bind(userToken, twentyFourHoursAgo).first();
    return (result as { count: number } | null)?.count || 0;
  }

  // ================================
  // Creator Operations
  // ================================

  async createCreator(data: CreateCreatorRequest): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO creators (id, name, bio, created_at)
      VALUES (?, ?, ?, ?)
    `);

    await stmt.bind(id, data.name, data.bio || null, now).run();
    return id;
  }

  async getCreatorById(id: string): Promise<CreatorRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM creators WHERE id = ?');
    const result = await stmt.bind(id).first();
    return result ? (result as unknown as CreatorRecord) : null;
  }

  async getCreatorByName(name: string): Promise<CreatorRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM creators WHERE name = ?');
    const result = await stmt.bind(name).first();
    return result ? (result as unknown as CreatorRecord) : null;
  }

  async linkArtworkToCreator(data: CreateArtworkCreatorRequest): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO artwork_creators (id, artwork_id, creator_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    await stmt.bind(id, data.artwork_id, data.creator_id, data.role || 'artist', now).run();
    return id;
  }

  async getCreatorsForArtwork(artworkId: string): Promise<ArtworkCreatorInfo[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT c.id, c.name, c.bio, ac.role
        FROM creators c
        JOIN artwork_creators ac ON c.id = ac.creator_id
        WHERE ac.artwork_id = ?
        ORDER BY ac.created_at ASC
      `);

      const results = await stmt.bind(artworkId).all();
      return (results.results as unknown[]).map(
        (rowRaw): ArtworkCreatorInfo => {
          const row = rowRaw as {
            id: string;
            name: string;
            bio: string | null;
            role: string;
          };
          return {
            id: row.id,
            name: row.name,
            bio: row.bio,
            role: row.role,
          };
        }
      );
    } catch (error) {
      // Return empty array if creators tables don't exist yet
      console.warn('Creators tables not found, returning empty creators list:', error);
      return [];
    }
  }

  async getArtworksForCreator(creatorId: string): Promise<ArtworkRecord[]> {
    const stmt = this.db.prepare(`
      SELECT a.*
      FROM artwork a
      JOIN artwork_creators ac ON a.id = ac.artwork_id
      WHERE ac.creator_id = ?
      ORDER BY a.created_at DESC
    `);

    const results = await stmt.bind(creatorId).all();
    return results.results as unknown as ArtworkRecord[];
  }
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

  // Convert artwork to CreateArtworkRequest format
  const createRequest: CreateArtworkRequest = {
    lat: artwork.lat,
    lon: artwork.lon,
    type_id: artwork.type_id,
    tags: artwork.tags ? JSON.parse(artwork.tags) : {},
    status: artwork.status, // Pass through the status
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
  // Store photos in the root tags JSON under _photos key.
  // BUGFIX: Previous implementation discarded photoUrls when tags was NULL, always writing an empty array.
  // We now always persist the provided photoUrls.
  const photosJson = JSON.stringify(photoUrls);
  // Lightweight debug toggle – relies on PHOTO_DEBUG env read elsewhere; here we just emit.
  try {
    // eslint-disable-next-line no-console
    console.info('[PHOTO][DB] updateArtworkPhotos begin', { artworkId: id, count: photoUrls.length });
  } catch {}
  const stmt = db.prepare(`
    UPDATE artwork
    SET tags = CASE
      WHEN tags IS NULL THEN json_set(json('{}'), '$._photos', json(?))
      ELSE json_set(tags, '$._photos', json(?))
    END
    WHERE id = ?
  `);
  await stmt.bind(photosJson, photosJson, id).run();
  try {
    // eslint-disable-next-line no-console
    console.info('[PHOTO][DB] updateArtworkPhotos success', { artworkId: id });
  } catch {}
}

export function getPhotosFromArtwork(artwork: ArtworkRecord): string[] {
  if (!artwork.tags) return [];
  try {
    const tags = JSON.parse(artwork.tags);
    return Array.isArray(tags._photos) ? tags._photos : [];
  } catch {
    return [];
  }
}

export async function getArtworkTypeByName(
  db: D1Database,
  name: string
): Promise<ArtworkTypeRecord | null> {
  const service = createDatabaseService(db);
  return service.getArtworkTypeByName(name);
}

// ================================
// Creator Helper Functions
// ================================

export async function createCreator(db: D1Database, data: CreateCreatorRequest): Promise<string> {
  const service = createDatabaseService(db);
  return service.createCreator(data);
}

export async function findCreatorById(db: D1Database, id: string): Promise<CreatorRecord | null> {
  const service = createDatabaseService(db);
  return service.getCreatorById(id);
}

export async function findCreatorByName(
  db: D1Database,
  name: string
): Promise<CreatorRecord | null> {
  const service = createDatabaseService(db);
  return service.getCreatorByName(name);
}

export async function linkArtworkToCreator(
  db: D1Database,
  data: CreateArtworkCreatorRequest
): Promise<string> {
  const service = createDatabaseService(db);
  return service.linkArtworkToCreator(data);
}

export async function getCreatorsForArtwork(
  db: D1Database,
  artworkId: string
): Promise<ArtworkCreatorInfo[]> {
  const service = createDatabaseService(db);
  return service.getCreatorsForArtwork(artworkId);
}

export async function getArtworksForCreator(
  db: D1Database,
  creatorId: string
): Promise<ArtworkRecord[]> {
  const service = createDatabaseService(db);
  return service.getArtworksForCreator(creatorId);
}
