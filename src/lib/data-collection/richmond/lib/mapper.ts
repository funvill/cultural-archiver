/**
 * Data Mapper for Richmond Public Art Registry
 *
 * Maps parsed artwork data to GeoJSON format
 */

import type { ArtworkData } from './parser.js';
import { logger } from './logger.js';

export interface GeoJSONFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  properties: {
    title: string;
    artistNames: string[];
    artistIds: string[];
    description: string;
    year?: string | undefined;
    materials?: string | undefined;
    address?: string | undefined;
    area?: string | undefined;
    location?: string | undefined;
    program?: string | undefined;
    ownership?: string | undefined;
    sponsor?: string | undefined;
    photos: string[];
    status?: string | undefined;
    sourceUrl: string;
    source: string;
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export class DataMapper {
  private sourceName: string;

  constructor(sourceName: string) {
    this.sourceName = sourceName;
  }

  /**
   * Map artwork data to GeoJSON feature
   */
  mapArtworkToFeature(artwork: ArtworkData): GeoJSONFeature | null {
    try {
      // Generate artist IDs from URLs
      const artistIds = artwork.artistLinks.map(link => {
        const match = link.match(/ID=(\d+)/);
        return match ? `richmond-artist-${match[1]}` : '';
      }).filter(Boolean);

      const feature: GeoJSONFeature = {
        type: 'Feature',
        id: `richmond-${artwork.id}`,
        geometry: artwork.coordinates
          ? {
              type: 'Point',
              coordinates: [artwork.coordinates.lon, artwork.coordinates.lat],
            }
          : null,
        properties: {
          title: artwork.title,
          artistNames: artwork.artistNames,
          artistIds,
          description: artwork.description,
          year: artwork.year,
          materials: artwork.materials,
          address: artwork.address,
          area: artwork.area,
          location: artwork.location,
          program: artwork.program,
          ownership: artwork.ownership,
          sponsor: artwork.sponsor,
          photos: artwork.photos,
          status: artwork.status || 'permanent',
          sourceUrl: artwork.url,
          source: this.sourceName,
        },
      };

      return feature;

    } catch (error) {
      logger.error(`Error mapping artwork to feature: ${error}`);
      return null;
    }
  }

  /**
   * Create GeoJSON FeatureCollection from artwork array
   */
  createFeatureCollection(artworks: ArtworkData[]): GeoJSONFeatureCollection {
    const features: GeoJSONFeature[] = [];

    for (const artwork of artworks) {
      const feature = this.mapArtworkToFeature(artwork);
      if (feature) {
        features.push(feature);
      }
    }

    logger.info(`Mapped ${features.length} artworks to GeoJSON features`);

    return {
      type: 'FeatureCollection',
      features,
    };
  }
}
