/**
 * Location Enhancement Module for Mass Import System
 * 
 * This module enriches import data with human-readable location names
 * using a cache-first strategy with Nominatim fallback.
 */

import type { RawImportData } from '../types/index.js';
import { LocationService } from '../../location/service.js';

export interface LocationEnhancementOptions {
  /** Whether to enable location enhancement */
  enabled?: boolean;
  /** Custom cache database path */
  cacheDbPath?: string;
  /** Timeout for API requests in milliseconds */
  requestTimeout?: number;
  /** Whether to fail on location lookup errors */
  failOnErrors?: boolean;
  /** Fields to add location data to in tags */
  tagFields?: {
    displayName?: string;
    country?: string;
    state?: string;
    city?: string;
    suburb?: string;
    neighbourhood?: string;
  };
}

export interface LocationEnhancementResult {
  /** Number of records processed */
  processed: number;
  /** Number of records enhanced from cache */
  fromCache: number;
  /** Number of records enhanced from API */
  fromApi: number;
  /** Number of records skipped due to missing coordinates */
  skippedMissingCoords: number;
  /** Number of records that failed location lookup */
  failed: number;
  /** Processing time in milliseconds */
  processingTime: number;
}

export class LocationEnhancer {
  private locationService: LocationService;
  private options: Required<LocationEnhancementOptions>;

  constructor(options: LocationEnhancementOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      cacheDbPath: options.cacheDbPath,
      requestTimeout: options.requestTimeout ?? 10000,
      failOnErrors: options.failOnErrors ?? false,
      tagFields: {
        displayName: 'location_display_name',
        country: 'location_country',
        state: 'location_state',
        city: 'location_city',
        suburb: 'location_suburb',
        neighbourhood: 'location_neighbourhood',
        ...options.tagFields
      }
    };

    this.locationService = new LocationService(this.options.cacheDbPath);
  }

  /**
   * Enhance an array of import records with location data
   */
  async enhanceRecords(records: RawImportData[]): Promise<{
    records: RawImportData[];
    result: LocationEnhancementResult;
  }> {
    if (!this.options.enabled) {
      return {
        records,
        result: {
          processed: 0,
          fromCache: 0,
          fromApi: 0,
          skippedMissingCoords: 0,
          failed: 0,
          processingTime: 0
        }
      };
    }

    const startTime = Date.now();
    let processed = 0;
    let fromCache = 0;
    let fromApi = 0;
    let skippedMissingCoords = 0;
    let failed = 0;

    console.log(`🌍 Starting location enhancement for ${records.length} records...`);

    // Get initial cache stats
    const initialStats = this.locationService.getCacheStats();
    console.log(`📊 Current cache: ${initialStats.totalEntries} entries`);

    const enhancedRecords: RawImportData[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      processed++;

      // Check if record has valid coordinates
      if (!record.lat || !record.lon || isNaN(record.lat) || isNaN(record.lon)) {
        skippedMissingCoords++;
        enhancedRecords.push(record);
        continue;
      }

      try {
        // Check cache first
        let location;
        let source: 'cache' | 'api';

        if (this.locationService.hasLocationInCache(record.lat, record.lon)) {
          location = await this.locationService.getLocation(record.lat, record.lon, { useCache: true });
          source = 'cache';
          fromCache++;
        } else {
          // Wait for rate limit if needed
          const waitTime = this.locationService.getTimeUntilNextRequest();
          if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }

          location = await this.locationService.getLocation(record.lat, record.lon, {
            useCache: true,
            timeout: this.options.requestTimeout
          });
          source = 'api';
          fromApi++;
        }

        // Add location data to record tags
        const enhancedRecord = this.addLocationToRecord(record, location);
        enhancedRecords.push(enhancedRecord);

        // Log progress every 50 items or at the end
        if ((i + 1) % 50 === 0 || i === records.length - 1) {
          console.log(`📍 Progress: ${i + 1}/${records.length} | Cache: ${fromCache} | API: ${fromApi} | Failed: ${failed}`);
        }

      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (this.options.failOnErrors) {
          throw new Error(`Location enhancement failed for record ${i + 1} (${record.lat}, ${record.lon}): ${errorMessage}`);
        }

        console.warn(`⚠️ Failed to get location for record ${i + 1} (${record.lat}, ${record.lon}): ${errorMessage}`);
        enhancedRecords.push(record); // Add original record without enhancement
      }
    }

    const processingTime = Date.now() - startTime;
    const finalStats = this.locationService.getCacheStats();

    console.log(`✅ Location enhancement completed!`);
    console.log(`📊 Final cache: ${finalStats.totalEntries} entries (${finalStats.totalEntries - initialStats.totalEntries} added)`);
    console.log(`⏱️  Processing time: ${Math.floor(processingTime / 60000)}m ${Math.floor((processingTime % 60000) / 1000)}s`);

    const result: LocationEnhancementResult = {
      processed,
      fromCache,
      fromApi,
      skippedMissingCoords,
      failed,
      processingTime
    };

    return {
      records: enhancedRecords,
      result
    };
  }

  /**
   * Add location data to a record's tags
   */
  private addLocationToRecord(record: RawImportData, location: any): RawImportData {
    const enhancedRecord = { ...record };
    
    // Ensure tags object exists
    if (!enhancedRecord.tags || typeof enhancedRecord.tags !== 'object') {
      enhancedRecord.tags = {};
    }

    // Add location fields to tags based on configuration
    const tagFields = this.options.tagFields;
    
    if (tagFields.displayName && location.display_name) {
      enhancedRecord.tags[tagFields.displayName] = location.display_name;
    }
    
    if (tagFields.country && location.country) {
      enhancedRecord.tags[tagFields.country] = location.country;
    }
    
    if (tagFields.state && location.state) {
      enhancedRecord.tags[tagFields.state] = location.state;
    }
    
    if (tagFields.city && location.city) {
      enhancedRecord.tags[tagFields.city] = location.city;
    }
    
    if (tagFields.suburb && location.suburb) {
      enhancedRecord.tags[tagFields.suburb] = location.suburb;
    }
    
    if (tagFields.neighbourhood && location.neighbourhood) {
      enhancedRecord.tags[tagFields.neighbourhood] = location.neighbourhood;
    }

    return enhancedRecord;
  }

  /**
   * Get current cache statistics
   */
  getCacheStats(): { totalEntries: number; oldestEntry: string | null; newestEntry: string | null } {
    return this.locationService.getCacheStats();
  }

  /**
   * Check if coordinates exist in cache
   */
  hasLocationInCache(lat: number, lon: number): boolean {
    return this.locationService.hasLocationInCache(lat, lon);
  }

  /**
   * Close the location service and cleanup resources
   */
  close(): void {
    this.locationService.close();
  }
}