import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { LocationCacheRecord, LocationResult } from '../../shared/types.js';

export class LocationCacheService {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Default to _data/location-cache.sqlite
    this.dbPath = dbPath || path.join(process.cwd(), '_data', 'location-cache.sqlite');
    
    // Ensure directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create the location_cache table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS location_cache (
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0',
        display_name TEXT NOT NULL,
        country_code TEXT,
        country TEXT,
        state TEXT,
        city TEXT,
        suburb TEXT,
        neighbourhood TEXT,
        road TEXT,
        postcode TEXT,
        raw_response TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (lat, lon)
      )
    `);

    // Create index for fast lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_location_cache_coords 
      ON location_cache (lat, lon)
    `);

    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Round coordinates to 6 decimal places for consistent cache keys
   */
  private roundCoordinate(coord: number): number {
    return Math.round(coord * 1000000) / 1000000;
  }

  /**
   * Get location from cache
   */
  getLocation(lat: number, lon: number): LocationCacheRecord | null {
    const roundedLat = this.roundCoordinate(lat);
    const roundedLon = this.roundCoordinate(lon);

    const stmt = this.db.prepare(`
      SELECT * FROM location_cache 
      WHERE lat = ? AND lon = ?
    `);

    const result = stmt.get(roundedLat, roundedLon) as LocationCacheRecord | undefined;
    return result || null;
  }

  /**
   * Store location in cache
   */
  storeLocation(locationData: Omit<LocationCacheRecord, 'created_at'>): void {
    const roundedLat = this.roundCoordinate(locationData.lat);
    const roundedLon = this.roundCoordinate(locationData.lon);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO location_cache (
        lat, lon, version, display_name, country_code, country, state, city,
        suburb, neighbourhood, road, postcode, raw_response, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      roundedLat,
      roundedLon,
      locationData.version,
      locationData.display_name,
      locationData.country_code,
      locationData.country,
      locationData.state,
      locationData.city,
      locationData.suburb,
      locationData.neighbourhood,
      locationData.road,
      locationData.postcode,
      locationData.raw_response,
      new Date().toISOString()
    );
  }

  /**
   * Get all unique coordinates from cache
   */
  getAllCoordinates(): Array<{ lat: number; lon: number }> {
    const stmt = this.db.prepare('SELECT lat, lon FROM location_cache');
    return stmt.all() as Array<{ lat: number; lon: number }>;
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalEntries: number; oldestEntry: string | null; newestEntry: string | null } {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM location_cache');
    const countResult = countStmt.get() as { count: number };

    const oldestStmt = this.db.prepare('SELECT MIN(created_at) as oldest FROM location_cache');
    const oldestResult = oldestStmt.get() as { oldest: string | null };

    const newestStmt = this.db.prepare('SELECT MAX(created_at) as newest FROM location_cache');
    const newestResult = newestStmt.get() as { newest: string | null };

    return {
      totalEntries: countResult.count,
      oldestEntry: oldestResult.oldest,
      newestEntry: newestResult.newest
    };
  }

  /**
   * Check if coordinates exist in cache
   */
  hasLocation(lat: number, lon: number): boolean {
    const roundedLat = this.roundCoordinate(lat);
    const roundedLon = this.roundCoordinate(lon);

    const stmt = this.db.prepare(`
      SELECT 1 FROM location_cache 
      WHERE lat = ? AND lon = ? 
      LIMIT 1
    `);

    return stmt.get(roundedLat, roundedLon) !== undefined;
  }

  /**
   * Convert LocationCacheRecord to LocationResult
   */
  toLocationResult(record: LocationCacheRecord): LocationResult {
    return {
      lat: record.lat,
      lon: record.lon,
      display_name: record.display_name,
      country_code: record.country_code,
      country: record.country,
      state: record.state,
      city: record.city,
      suburb: record.suburb,
      neighbourhood: record.neighbourhood,
      road: record.road,
      postcode: record.postcode,
      source: 'cache',
      last_updated: record.created_at
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database file path
   */
  getDbPath(): string {
    return this.dbPath;
  }
}