import type {
  LocationResult,
  LocationLookupOptions,
  NominatimResponse,
} from '../../shared/types.js';
import { LocationCacheService } from './cache-service.js';
import { NominatimApiClient } from './nominatim-client.js';

export class LocationService {
  private cacheService: LocationCacheService;
  private apiClient: NominatimApiClient;

  constructor(cacheDbPath?: string) {
    this.cacheService = new LocationCacheService(cacheDbPath);
    this.apiClient = new NominatimApiClient();
  }

  /**
   * Get location with cache-first strategy
   */
  async getLocation(
    lat: number,
    lon: number,
    options: LocationLookupOptions = {}
  ): Promise<LocationResult> {
    const useCache = options.useCache !== false; // Default to true

    // Try cache first if enabled
    if (useCache) {
      const cachedResult = this.cacheService.getLocation(lat, lon);
      if (cachedResult) {
        return this.cacheService.toLocationResult(cachedResult);
      }
    }

    // Fetch from API if not in cache
    try {
      const result = await this.apiClient.reverseGeocode(lat, lon, options);

      // Store in cache for future use (if cache is enabled)
      if (useCache) {
        // We need the raw response to store, but the current API doesn't return it
        // For now, we'll create a minimal raw response from the result
        const rawResponse: NominatimResponse = {
          place_id: 0,
          licence: '',
          osm_type: '',
          osm_id: 0,
          lat: result.lat.toString(),
          lon: result.lon.toString(),
          category: '',
          type: '',
          place_rank: 0,
          importance: 0,
          addresstype: '',
          name: '',
          display_name: result.display_name,
          address: {
            ...(result.country_code && { country_code: result.country_code }),
            ...(result.country && { country: result.country }),
            ...(result.state && { state: result.state }),
            ...(result.city && { city: result.city }),
            ...(result.suburb && { suburb: result.suburb }),
            ...(result.neighbourhood && { neighbourhood: result.neighbourhood }),
            ...(result.road && { road: result.road }),
            ...(result.postcode && { postcode: result.postcode }),
          },
          boundingbox: ['', '', '', ''],
        };

        const cacheRecord = NominatimApiClient.toLocationCacheRecord(result, rawResponse);
        this.cacheService.storeLocation(cacheRecord);
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to get location for coordinates ${lat}, ${lon}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if location exists in cache
   */
  hasLocationInCache(lat: number, lon: number): boolean {
    return this.cacheService.hasLocation(lat, lon);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  } {
    return this.cacheService.getStats();
  }

  /**
   * Get all cached coordinates
   */
  getAllCachedCoordinates(): Array<{ lat: number; lon: number }> {
    return this.cacheService.getAllCoordinates();
  }

  /**
   * Geocode an address to coordinates with cache-first strategy
   */
  async geocodeAddress(
    address: string,
    options: LocationLookupOptions = {}
  ): Promise<LocationResult | null> {
    const useCache = options.useCache !== false; // Default to true

    // Try cache first if enabled - use address as a lookup key
    if (useCache) {
      const cachedResult = this.cacheService.getLocationByAddress(address);
      if (cachedResult) {
        return this.cacheService.toLocationResult(cachedResult);
      }
    }

    // Fetch from API if not in cache
    try {
      const result = await this.apiClient.geocode(address, options);

      if (!result) {
        return null; // No results found
      }

      // Store in cache for future use (if cache is enabled)
      if (useCache) {
        // Create a minimal raw response from the result
        const rawResponse: NominatimResponse = {
          place_id: 0,
          licence: '',
          osm_type: '',
          osm_id: 0,
          lat: result.lat.toString(),
          lon: result.lon.toString(),
          category: '',
          type: '',
          place_rank: 0,
          importance: 0,
          addresstype: '',
          name: '',
          display_name: result.display_name,
          address: {
            ...(result.country_code && { country_code: result.country_code }),
            ...(result.country && { country: result.country }),
            ...(result.state && { state: result.state }),
            ...(result.city && { city: result.city }),
            ...(result.suburb && { suburb: result.suburb }),
            ...(result.neighbourhood && { neighbourhood: result.neighbourhood }),
            ...(result.road && { road: result.road }),
            ...(result.postcode && { postcode: result.postcode }),
          },
          boundingbox: ['', '', '', ''],
        };

        const cacheRecord = NominatimApiClient.toLocationCacheRecord(result, rawResponse);
        // Add address to cache record for lookup
        const cacheRecordWithAddress = {
          ...cacheRecord,
          address_query: address,
        };
        this.cacheService.storeLocationWithAddress(cacheRecordWithAddress);
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to geocode address "${address}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get time until next API request is allowed
   */
  getTimeUntilNextRequest(): number {
    return this.apiClient.getTimeUntilNextRequest();
  }

  /**
   * Get rate limit delay
   */
  getRateLimitDelay(): number {
    return this.apiClient.getRateLimitDelay();
  }

  /**
   * Close database connection
   */
  close(): void {
    this.cacheService.close();
  }

  /**
   * Get cache database path
   */
  getCacheDbPath(): string {
    return this.cacheService.getDbPath();
  }
}
