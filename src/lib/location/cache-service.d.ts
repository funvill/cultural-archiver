import type { LocationCacheRecord, LocationResult } from '../../shared/types.js';
export declare class LocationCacheService {
    private db;
    private dbPath;
    constructor(dbPath?: string);
    private initializeDatabase;
    /**
     * Round coordinates to 6 decimal places for consistent cache keys
     */
    private roundCoordinate;
    /**
     * Get location from cache
     */
    getLocation(lat: number, lon: number): LocationCacheRecord | null;
    /**
     * Store location in cache
     */
    storeLocation(locationData: Omit<LocationCacheRecord, 'created_at'>): void;
    /**
     * Get all unique coordinates from cache
     */
    getAllCoordinates(): Array<{
        lat: number;
        lon: number;
    }>;
    /**
     * Get cache statistics
     */
    getStats(): {
        totalEntries: number;
        oldestEntry: string | null;
        newestEntry: string | null;
    };
    /**
     * Check if coordinates exist in cache
     */
    hasLocation(lat: number, lon: number): boolean;
    /**
     * Convert LocationCacheRecord to LocationResult
     */
    toLocationResult(record: LocationCacheRecord): LocationResult;
    /**
     * Close database connection
     */
    close(): void;
    /**
     * Get database file path
     */
    getDbPath(): string;
}
//# sourceMappingURL=cache-service.d.ts.map