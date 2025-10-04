import type { LocationResult, LocationLookupOptions } from '../../shared/types.js';
export declare class LocationService {
    private cacheService;
    private apiClient;
    constructor(cacheDbPath?: string);
    /**
     * Get location with cache-first strategy
     */
    getLocation(lat: number, lon: number, options?: LocationLookupOptions): Promise<LocationResult>;
    /**
     * Check if location exists in cache
     */
    hasLocationInCache(lat: number, lon: number): boolean;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        totalEntries: number;
        oldestEntry: string | null;
        newestEntry: string | null;
    };
    /**
     * Get all cached coordinates
     */
    getAllCachedCoordinates(): Array<{
        lat: number;
        lon: number;
    }>;
    /**
     * Get time until next API request is allowed
     */
    getTimeUntilNextRequest(): number;
    /**
     * Get rate limit delay
     */
    getRateLimitDelay(): number;
    /**
     * Close database connection
     */
    close(): void;
    /**
     * Get cache database path
     */
    getCacheDbPath(): string;
}
//# sourceMappingURL=service.d.ts.map