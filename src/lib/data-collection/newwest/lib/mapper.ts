/**
 * Data Mapper for New Westminster Public Art Registry
 *
 * Transforms parsed artwork data into GeoJSON format.
 */

import type { ArtworkData } from './parser.js';
import { logger } from './logger.js';

export interface GeoJSONFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    title: string;
    description: string;
    location: string;
    year?: string;
    medium?: string;
    dimensions?: string;
    status?: string;
    type?: string;
    neighbourhood?: string;
    removalYear?: string;
    photos: string[];
    artistNames: string[];
    sourceUrl: string;
    artworkUrl: string;
    parsedAt: string;
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export class DataMapper {
  /**
   * Create a GeoJSON FeatureCollection from artwork data
   */
  createFeatureCollection(artworks: Array<Partial<ArtworkData>>): GeoJSONFeatureCollection {
    logger.info('Mapping artworks to GeoJSON...');

    const features: GeoJSONFeature[] = [];
    let skippedCount = 0;

    for (const artwork of artworks) {
      // Skip artworks without coordinates
      if (!artwork.coordinates) {
        logger.debug(`Skipping artwork without coordinates: ${artwork.title || artwork.url}`);
        skippedCount++;
        continue;
      }

      // Skip artworks without required fields
      if (!artwork.title || !artwork.url) {
        logger.warn(`Skipping artwork with missing required fields: ${artwork.url}`);
        skippedCount++;
        continue;
      }

      try {
        const feature = this.createFeature(artwork as ArtworkData);
        features.push(feature);
      } catch (error) {
        logger.error(`Failed to map artwork: ${artwork.url}`, error);
        skippedCount++;
      }
    }

    if (skippedCount > 0) {
      logger.warn(`⚠️  Skipped ${skippedCount} artworks due to missing coordinates or required fields`);
    }

    logger.info(`✅ Mapped ${features.length} artworks to GeoJSON features`);

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Create a single GeoJSON feature from artwork data
   */
  private createFeature(artwork: ArtworkData): GeoJSONFeature {
    if (!artwork.coordinates) {
      throw new Error('Artwork missing coordinates');
    }

    return {
      type: 'Feature',
      id: artwork.id,
      geometry: {
        type: 'Point',
        coordinates: [artwork.coordinates.lon, artwork.coordinates.lat]
      },
      properties: {
        title: artwork.title,
        description: artwork.description || '',
        location: artwork.location || '',
        ...(artwork.year !== undefined && { year: artwork.year }),
        ...(artwork.medium !== undefined && { medium: artwork.medium }),
        ...(artwork.dimensions !== undefined && { dimensions: artwork.dimensions }),
        ...(artwork.status !== undefined && { status: artwork.status }),
        ...(artwork.type !== undefined && { type: artwork.type }),
        ...(artwork.neighbourhood !== undefined && { neighbourhood: artwork.neighbourhood }),
        ...(artwork.removalYear !== undefined && { removalYear: artwork.removalYear }),
        photos: artwork.photos || [],
        artistNames: artwork.artistNames || [],
        sourceUrl: 'https://www.newwestcity.ca/public-art/',
        artworkUrl: this.normalizeSourceUrl(artwork.url),
        parsedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Normalize source URL to relative path format
   * Converts https://www.newwestcity.ca/public-art/slug.php to /public-art/slug
   */
  private normalizeSourceUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove .php extension and return path only
      return urlObj.pathname.replace(/\.php$/, '');
    } catch {
      // If not a valid URL, return as-is
      return url;
    }
  }

  /**
   * Validate GeoJSON coordinates
   */
  validateCoordinates(lon: number, lat: number): boolean {
    // Longitude must be between -180 and 180
    if (lon < -180 || lon > 180) {
      logger.warn(`Invalid longitude: ${lon}`);
      return false;
    }

    // Latitude must be between -90 and 90
    if (lat < -90 || lat > 90) {
      logger.warn(`Invalid latitude: ${lat}`);
      return false;
    }

    return true;
  }

  /**
   * Calculate bounding box for all features
   */
  calculateBoundingBox(features: GeoJSONFeature[]): [number, number, number, number] | null {
    if (features.length === 0) {
      return null;
    }

    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;

    for (const feature of features) {
      const [lon, lat] = feature.geometry.coordinates;
      minLon = Math.min(minLon, lon);
      minLat = Math.min(minLat, lat);
      maxLon = Math.max(maxLon, lon);
      maxLat = Math.max(maxLat, lat);
    }

    return [minLon, minLat, maxLon, maxLat];
  }
}
