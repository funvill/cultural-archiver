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

export class DatabaseService {
  constructor(private db: any) {} // Use any for D1Database compatibility

  // ================================
  // Artwork Operations
  // ================================

  async createArtwork(data: CreateArtworkRequest): Promise<ArtworkRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO artwork (id, lat, lon, type_id, created_at, status, tags)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `);
    
    const tagsJson = data.tags ? JSON.stringify(data.tags) : null;
    await stmt.bind(id, data.lat, data.lon, data.type_id, now, tagsJson).run();
    
    return {
      id,
      lat: data.lat,
      lon: data.lon,
      type_id: data.type_id,
      created_at: now,
      status: 'pending',
      tags: tagsJson,
    };
  }

  async getArtworkById(id: string): Promise<ArtworkRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM artwork WHERE id = ?');
    const result = await stmt.bind(id).first();
    return result as ArtworkRecord || null;
  }

  async getArtworkWithDetails(id: string): Promise<ArtworkRecord & { type_name: string } | null> {
    const stmt = this.db.prepare(`
      SELECT a.*, at.name as type_name
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
      WHERE a.id = ? AND a.status = 'approved'
    `);
    const result = await stmt.bind(id).first();
    return result as (ArtworkRecord & { type_name: string }) || null;
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
    
    const results = await stmt.bind(
      lat, lat, lon, lon,  // for distance calculation
      minLat, maxLat, minLon, maxLon,  // for bounding box
      limit
    ).all();
    
    // Convert distance_sq to actual distance and filter by radius
    return (results.results as any[]).map((artwork: any) => {
      const distanceKm = Math.sqrt(artwork.distance_sq) * 111; // Convert degrees to km
      return {
        ...artwork,
        distance_km: distanceKm,
      };
    }).filter((artwork: any) => artwork.distance_km <= radius / 1000);
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
    await stmt.bind(id, data.artwork_id || null, data.user_token, data.note || null, photosJson, now).run();
    
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
    return result as LogbookRecord || null;
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

  async getUserSubmissions(userToken: string, page: number = 1, perPage: number = 20): Promise<{
    submissions: (LogbookRecord & { artwork_lat?: number; artwork_lon?: number; artwork_type_name?: string })[];
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
      submissions: results.results as (LogbookRecord & { artwork_lat?: number; artwork_lon?: number; artwork_type_name?: string })[],
      total: (countResult as any)?.total || 0,
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
    return result as ArtworkTypeRecord || null;
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
    
    await stmt.bind(id, data.artwork_id || null, data.logbook_id || null, data.label, data.value, now).run();
    
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
        message: error instanceof Error ? error.message : 'Unknown database error' 
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
    return (result as any)?.count || 0;
  }
}

// Helper function to create database service instance
export function createDatabaseService(db: any): DatabaseService {
  return new DatabaseService(db);
}