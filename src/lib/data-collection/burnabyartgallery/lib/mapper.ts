/**
 * Data Mapper for Burnaby Art Gallery
 *
 * Transforms scraped artwork data into GeoJSON Feature format.
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
    source: string;
    source_url: string;
    name: string;
    artwork_type: string;
    location: string;
    date: string;
    medium: string;
    technique: string;
    dimensions: string;
    keywords: string;
    owner: string;
    category: string;
    'accession number': string;
    collection: string;
    description: string;
    photos: string[];
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export class DataMapper {
  private readonly source = 'https://burnabyartgallery.ca';

  /**
   * Map artwork data to GeoJSON Feature
   */
  mapToGeoJSON(artwork: Partial<ArtworkData>): GeoJSONFeature | null {
    // Validate required fields
    if (!artwork.coordinates) {
      logger.warn(`Skipping artwork without coordinates: ${artwork.url || 'unknown'}`);
      return null;
    }

    if (!artwork.title) {
      logger.warn(`Skipping artwork without title: ${artwork.url || 'unknown'}`);
      return null;
    }

    if (!artwork.id) {
      logger.warn(`Skipping artwork without ID: ${artwork.url || 'unknown'}`);
      return null;
    }

    const feature: GeoJSONFeature = {
      type: 'Feature',
      id: artwork.id,
      geometry: {
        type: 'Point',
        coordinates: [artwork.coordinates.lon, artwork.coordinates.lat],
      },
      properties: {
        source: this.source,
        source_url: artwork.url || '',
        name: artwork.title,
        artwork_type: artwork.artworkType || 'unknown',
        location: artwork.location || '',
        date: artwork.date || '',
        medium: artwork.medium || '',
        technique: artwork.technique || '',
        dimensions: artwork.dimensions || '',
        keywords: artwork.keywords || '',
        owner: artwork.owner || '',
        category: artwork.category || '',
        'accession number': artwork.accessionNumber || '',
        collection: artwork.collection || '',
        description: artwork.description || '',
        photos: artwork.photos || [],
      },
    };

    logger.debug(`Mapped artwork to GeoJSON: ${feature.id} - ${feature.properties.name}`);
    return feature;
  }

  /**
   * Create GeoJSON FeatureCollection from multiple artworks
   */
  createFeatureCollection(artworks: Array<Partial<ArtworkData>>): GeoJSONFeatureCollection {
    const features: GeoJSONFeature[] = [];

    for (const artwork of artworks) {
      const feature = this.mapToGeoJSON(artwork);
      if (feature) {
        features.push(feature);
      }
    }

    logger.info(`Created GeoJSON FeatureCollection with ${features.length} features`);

    return {
      type: 'FeatureCollection',
      features,
    };
  }
}
