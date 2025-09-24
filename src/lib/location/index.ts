/**
 * Location Services Module
 *
 * This module provides comprehensive location services including:
 * - Reverse geocoding with Nominatim API
 * - Local SQLite caching for performance
 * - Rate limiting and error handling
 * - Integration with mass import systems
 */

export { LocationCacheService } from './cache-service.js';
export { NominatimApiClient } from './nominatim-client.js';
export { LocationService } from './service.js';

// Re-export types from shared module
export type {
  LocationCacheRecord,
  NominatimResponse,
  LocationLookupOptions,
  LocationResult,
} from '../../shared/types.js';
