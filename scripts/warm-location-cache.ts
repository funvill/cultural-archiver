#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { LocationService } from '../src/lib/location/service.js';

interface CoordinatePair {
  lat: number;
  lon: number;
}

interface ImportRecord {
  lat?: number;
  lon?: number;
  latitude?: number;
  longitude?: number;
}

class LocationCacheWarmer {
  private locationService: LocationService;
  private processedCount = 0;
  private errorCount = 0;
  private skippedCount = 0;
  private startTime = Date.now();

  constructor() {
    this.locationService = new LocationService();
  }

  /**
   * Extract coordinates from various file formats
   */
  private extractCoordinatesFromFile(filePath: string): CoordinatePair[] {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf-8');

    let data: ImportRecord[];

    try {
      if (ext === '.json' || ext === '.geojson') {
        const parsed = JSON.parse(content);

        // Handle GeoJSON format
        if (
          parsed &&
          typeof parsed === 'object' &&
          'type' in parsed &&
          (parsed as Record<string, unknown>)['type'] === 'FeatureCollection' &&
          Array.isArray((parsed as Record<string, unknown>)['features'])
        ) {
          const features = (parsed as unknown as Record<string, unknown>)['features'] as unknown[];
          data = features.map((feature: unknown) => {
            if (typeof feature === 'object' && feature !== null) {
              const f = feature as Record<string, unknown>;
              const geom = f['geometry'];
              if (
                typeof geom === 'object' &&
                geom !== null &&
                (geom as Record<string, unknown>)['type'] === 'Point' &&
                Array.isArray((geom as Record<string, unknown>)['coordinates'])
              ) {
                const coords = (geom as Record<string, unknown>)['coordinates'] as unknown[];
                const lon = coords[0] as number;
                const lat = coords[1] as number;
                return { lat, lon };
              }
            }
            return {} as ImportRecord;
          });
        } else {
          // Handle regular JSON array/object
          data = Array.isArray(parsed) ? parsed : [parsed];
        }
      } else if (ext === '.csv') {
        // Simple CSV parser - assumes first row is headers
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const record: ImportRecord = {};

          headers.forEach((header, index) => {
            const value = values[index];
            if (header.includes('lat') && !isNaN(parseFloat(value))) {
              record.lat = parseFloat(value);
            } else if (header.includes('lon') && !isNaN(parseFloat(value))) {
              record.lon = parseFloat(value);
            } else if (header.includes('latitude') && !isNaN(parseFloat(value))) {
              record.latitude = parseFloat(value);
            } else if (header.includes('longitude') && !isNaN(parseFloat(value))) {
              record.longitude = parseFloat(value);
            }
          });

          return record;
        });
      } else {
        throw new Error(
          `Unsupported file format: ${ext}. Supported formats: .json, .geojson, .csv`
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to parse file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Extract coordinates with fallback patterns and support for nested shapes
    const coordinates: CoordinatePair[] = [];
    for (const record of data) {
      const r = record as unknown;

      // Helper to validate numeric lat/lon ranges
      const pushIfValid = (lat: unknown, lon: unknown): boolean => {
        if (typeof lat === 'number' && typeof lon === 'number') {
          if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            coordinates.push({ lat, lon });
            return true;
          }
        }
        return false;
      };

      // 1) Vancouver Open Data: geo_point_2d { lat, lon }
      if (typeof r === 'object' && r !== null && 'geo_point_2d' in (r as Record<string, unknown>)) {
        const gp = (r as Record<string, unknown>)['geo_point_2d'];
        if (typeof gp === 'object' && gp !== null) {
          const lat = (gp as Record<string, unknown>)['lat'];
          const lon = (gp as Record<string, unknown>)['lon'];
          if (pushIfValid(lat, lon)) continue;
        }
      }

      // 2) Geo feature stored on record.geom or record.geometry (common in Vancouver export)
      if (typeof r === 'object' && r !== null) {
        const maybeGeom =
          (r as Record<string, unknown>)['geom'] ?? (r as Record<string, unknown>)['geometry'];
        if (typeof maybeGeom === 'object' && maybeGeom !== null) {
          const innerGeom = ((maybeGeom as Record<string, unknown>)['geometry'] ??
            maybeGeom) as unknown;
          if (
            typeof innerGeom === 'object' &&
            innerGeom !== null &&
            'type' in (innerGeom as Record<string, unknown>) &&
            (innerGeom as Record<string, unknown>)['type'] === 'Point' &&
            Array.isArray((innerGeom as Record<string, unknown>)['coordinates'])
          ) {
            const coords = (innerGeom as Record<string, unknown>)['coordinates'] as unknown[];
            const lon = coords[0] as unknown;
            const lat = coords[1] as unknown;
            if (pushIfValid(lat, lon)) continue;
          }
        }
      }

      // 3) Fallback: top-level lat/lon or latitude/longitude or nested location fields
      if (typeof r === 'object' && r !== null) {
        const top = r as Record<string, unknown>;
        const lat = (top['lat'] ??
          top['latitude'] ??
          (top['location'] && (top['location'] as Record<string, unknown>)['lat']) ??
          (top['location'] && (top['location'] as Record<string, unknown>)['latitude'])) as unknown;
        const lon = (top['lon'] ??
          top['longitude'] ??
          (top['location'] && (top['location'] as Record<string, unknown>)['lon']) ??
          (top['location'] &&
            (top['location'] as Record<string, unknown>)['longitude'])) as unknown;
        if (pushIfValid(lat, lon)) continue;
      }
    }

    return coordinates;
  }

  /**
   * Get unique coordinates to avoid duplicates
   */
  private getUniqueCoordinates(coordinates: CoordinatePair[]): CoordinatePair[] {
    const seen = new Set<string>();
    const unique: CoordinatePair[] = [];

    for (const coord of coordinates) {
      // Round to 6 decimal places for consistent comparison
      const lat = Math.round(coord.lat * 1000000) / 1000000;
      const lon = Math.round(coord.lon * 1000000) / 1000000;
      const key = `${lat},${lon}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ lat, lon });
      }
    }

    return unique;
  }

  /**
   * Log progress information
   */
  private logProgress(current: number, total: number): void {
    const elapsed = Date.now() - this.startTime;
    const rate = current / (elapsed / 1000); // per second
    const remaining = total - current;
    const eta = remaining / rate; // seconds

    const etaFormatted =
      eta > 3600
        ? `${Math.floor(eta / 3600)}h ${Math.floor((eta % 3600) / 60)}m`
        : `${Math.floor(eta / 60)}m ${Math.floor(eta % 60)}s`;

    console.log(
      `Progress: ${current}/${total} (${((current / total) * 100).toFixed(1)}%) | ` +
        `Rate: ${rate.toFixed(2)}/sec | ETA: ${etaFormatted} | ` +
        `Errors: ${this.errorCount} | Skipped: ${this.skippedCount}`
    );
  }

  /**
   * Warm the cache with coordinates from the provided file
   */
  async warmCache(filePath: string): Promise<void> {
    console.log(`🌟 Starting cache warming from: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Extract coordinates from file
    console.log('📍 Extracting coordinates...');
    const allCoordinates = this.extractCoordinatesFromFile(filePath);
    const uniqueCoordinates = this.getUniqueCoordinates(allCoordinates);

    console.log(
      `Found ${allCoordinates.length} total coordinates, ${uniqueCoordinates.length} unique`
    );

    // Filter out coordinates already in cache
    const uncachedCoordinates = uniqueCoordinates.filter(
      coord => !this.locationService.hasLocationInCache(coord.lat, coord.lon)
    );

    console.log(
      `${uniqueCoordinates.length - uncachedCoordinates.length} already in cache, ${uncachedCoordinates.length} to fetch`
    );

    if (uncachedCoordinates.length === 0) {
      console.log('✅ All coordinates already cached!');
      return;
    }

    // Show initial stats
    const initialStats = this.locationService.getCacheStats();
    console.log(`📊 Current cache: ${initialStats.totalEntries} entries`);

    // Process each coordinate
    console.log(`🚀 Processing ${uncachedCoordinates.length} coordinates...`);
    console.log(
      `⏱️  Estimated time: ${Math.ceil((uncachedCoordinates.length * this.locationService.getRateLimitDelay()) / 1000 / 60)} minutes`
    );

    for (let i = 0; i < uncachedCoordinates.length; i++) {
      const coord = uncachedCoordinates[i];

      try {
        // Wait for rate limit if needed
        const waitTime = this.locationService.getTimeUntilNextRequest();
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Fetch location data
        await this.locationService.getLocation(coord.lat, coord.lon);
        this.processedCount++;

        // Log progress every 10 items
        if ((i + 1) % 10 === 0 || i === uncachedCoordinates.length - 1) {
          this.logProgress(i + 1, uncachedCoordinates.length);
        }
      } catch (error) {
        this.errorCount++;
        console.error(
          `❌ Error processing ${coord.lat}, ${coord.lon}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        // Continue processing other coordinates
        continue;
      }
    }

    // Final stats
    const finalStats = this.locationService.getCacheStats();
    const elapsed = Date.now() - this.startTime;

    console.log('\n✅ Cache warming completed!');
    console.log(
      `📊 Final cache: ${finalStats.totalEntries} entries (${finalStats.totalEntries - initialStats.totalEntries} added)`
    );
    console.log(
      `⏱️  Total time: ${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`
    );
    console.log(`✅ Processed: ${this.processedCount}`);
    console.log(`❌ Errors: ${this.errorCount}`);
    console.log(`⏭️  Skipped: ${this.skippedCount}`);

    if (this.errorCount > 0) {
      console.log(`\n⚠️  ${this.errorCount} errors occurred during processing`);
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.locationService.close();
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run warm-cache <import-file>');
    console.error('');
    console.error('Examples:');
    console.error('  npm run warm-cache data/vancouver-public-art.json');
    console.error('  npm run warm-cache data/artworks.csv');
    process.exit(1);
  }

  const filePath = args[0];
  const warmer = new LocationCacheWarmer();

  try {
    await warmer.warmCache(filePath);
  } catch (error) {
    console.error(`💥 Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  } finally {
    warmer.cleanup();
  }
}

// Handle cleanup on process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, cleaning up...');
  process.exit(0);
});

// Run if this script is executed directly
main().catch(console.error);
