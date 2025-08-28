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
} from '../../shared/types';

// Database result interfaces
interface ArtworkWithDistance extends ArtworkRecord {
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
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `);

    const tagsJson = data.tags ? JSON.stringify(data.tags) : null;
    await stmt.bind(id, data.lat, data.lon, data.type_id, now, tagsJson).run();

    return id;
  }

  async getArtworkById(id: string): Promise<ArtworkRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM artwork WHERE id = ?');
    const result = await stmt.bind(id).first();
    return (result as unknown as ArtworkRecord) || null;
  }

  async getArtworkWithDetails(id: string): Promise<(ArtworkRecord & { type_name: string }) | null> {
    const stmt = this.db.prepare(`
      SELECT a.*, at.name as type_name
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
      WHERE a.id = ? AND a.status = 'approved'
    `);
    const result = await stmt.bind(id).first();
    return (result as ArtworkRecord & { type_name: string }) || null;
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
    return (results.results as ArtworkWithDistance[])
      .map((artwork: ArtworkWithDistance) => {
        const distanceKm = Math.sqrt(artwork.distance_sq) * 111; // Convert degrees to km
        return {
          ...artwork,
          distance_km: distanceKm,
        };
      })
      .filter((artwork: ArtworkWithDistance) => artwork.distance_km <= radius / 1000);
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

    const stmt = this.db.prepare(`
      INSERT INTO logbook (id, artwork_id, user_token, note, photos, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `);

    const photosJson = data.photos ? JSON.stringify(data.photos) : null;
    await stmt
      .bind(id, data.artwork_id || null, data.user_token, data.note || null, photosJson, now)
      .run();

    return {
      id,
      artwork_id: data.artwork_id || null,
      user_token: data.user_token,
      note: data.note || null,
      photos: photosJson,
      status: 'pending',
      created_at: now,
    };
  }

  async getLogbookById(id: string): Promise<LogbookRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM logbook WHERE id = ?');
    const result = await stmt.bind(id).first();
    return (result as LogbookRecord) || null;
  }

  async getLogbookEntriesForArtwork(artworkId: string): Promise<LogbookRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM logbook 
      WHERE artwork_id = ? AND status = 'approved'
      ORDER BY created_at DESC
    `);
    const results = await stmt.bind(artworkId).all();
    return results.results as LogbookRecord[];
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
    const offset = (page - 1) * perPage;

    // Get submissions (exclude rejected)
    const stmt = this.db.prepare(`
      SELECT l.*, a.lat as artwork_lat, a.lon as artwork_lon, at.name as artwork_type_name
      FROM logbook l
      LEFT JOIN artwork a ON l.artwork_id = a.id
      LEFT JOIN artwork_types at ON a.type_id = at.id
      WHERE l.user_token = ? AND l.status != 'rejected'
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(userToken, perPage, offset).all();

    // Get total count
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM logbook 
      WHERE user_token = ? AND status != 'rejected'
    `);
    const countResult = await countStmt.bind(userToken).first();

    return {
      submissions: results.results as (LogbookRecord & {
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
    return results.results as LogbookRecord[];
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
    return results.results as ArtworkTypeRecord[];
  }

  async getArtworkTypeById(id: string): Promise<ArtworkTypeRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM artwork_types WHERE id = ?');
    const result = await stmt.bind(id).first();
    return (result as ArtworkTypeRecord) || null;
  }

  async getArtworkTypeByName(name: string): Promise<ArtworkTypeRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM artwork_types WHERE name = ?');
    const result = await stmt.bind(name).first();
    return result as ArtworkTypeRecord | null;
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
    return results.results as TagRecord[];
  }

  async getTagsForLogbook(logbookId: string): Promise<TagRecord[]> {
    const stmt = this.db.prepare('SELECT * FROM tags WHERE logbook_id = ?');
    const results = await stmt.bind(logbookId).all();
    return results.results as TagRecord[];
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
  // For MVP, since photos field doesn't exist in artwork table,
  // we'll store photos in the tags field as a special key
  const stmt = db.prepare(`
    UPDATE artwork 
    SET tags = CASE 
      WHEN tags IS NULL THEN json('{"_photos": []}')
      ELSE json_set(tags, '$._photos', json(?))
    END 
    WHERE id = ?
  `);
  await stmt.bind(JSON.stringify(photoUrls), id).run();
}

export async function getArtworkTypeByName(
  db: D1Database,
  name: string
): Promise<ArtworkTypeRecord | null> {
  const service = createDatabaseService(db);
  return service.getArtworkTypeByName(name);
}
