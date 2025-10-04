/**
 * Mass Import System - OpenStreetMap GeoJSON Mapper
 *
 * This module handles mapping OpenStreetMap GeoJSON artwork data to the internal format,
 * including field transformation, coordinate validation, and structured tag application.
 */

import type { RawImportData, ValidationResult, DataSourceMapper } from '../types';
import { validateImportData } from '../lib/validation.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================
// OSM GeoJSON Data Types
// ================================

interface OSMFeature {
  type: 'Feature';
  id: string; // e.g., "node/4343692187" or "way/108143913"
  properties: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    artist_name?: string;
    artwork_type?: string;
    material?: string;
    tourism?: string;
    website?: string;
    wikipedia?: string;
    wikidata?: string;
    year?: string;
    description?: string;
    wheelchair?: string;
    [key: string]: string | number | boolean | undefined; // Allow for other OSM tags
  };
  geometry: {
    type: 'Point' | 'Polygon' | 'LineString' | 'MultiPoint' | 'MultiPolygon' | 'MultiLineString';
    coordinates: number[] | number[][] | number[][][];
  };
}

interface OSMGeoJSON {
  type: 'FeatureCollection';
  features: OSMFeature[];
}

interface OSMConfig {
  defaultConfig: {
    user_uuid: string;
    duplicateThreshold: number;
    duplicateDetectionRadius?: number;
    attribution: {
      source: string;
      license: string;
      attribution_text: string;
    };
    fieldMappings: Record<string, string>;
    validation: {
      requireName: boolean;
      requireCoordinates: boolean;
      skipIncomplete: boolean;
      generateTitleFromLocation?: boolean;
    };
  };
  presets: Record<string, Record<string, unknown>>;
  batchProcessing: {
    defaultBatchSize: number;
    maxBatchSize: number;
    processingMode: string;
    retryFailedBatches: boolean;
    maxRetries: number;
    retryDelayMs: number;
  };
}

// Cached config
let osmConfigCache: OSMConfig | null = null;

// ================================
// Configuration Loading
// ================================

/**
 * Load OSM configuration
 */
export function loadOSMConfig(): OSMConfig {
  if (osmConfigCache) {
    return osmConfigCache;
  }

  const configPath = path.join(__dirname, 'osm-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`OSM config file not found: ${configPath}`);
  }

  const configContent = fs.readFileSync(configPath, 'utf-8');
  osmConfigCache = JSON.parse(configContent) as OSMConfig;
  return osmConfigCache;
}

// ================================
// Coordinate Extraction
// ================================

/**
 * Extract coordinates from OSM geometry
 * Handles Point, Polygon, and other geometry types
 */
function extractCoordinates(geometry: OSMFeature['geometry']): { lat: number; lon: number } | null {
  switch (geometry.type) {
    case 'Point': {
      const coords = geometry.coordinates as number[];
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const [lon, lat] = coords;
        return { lat, lon };
      }
      break;
    }

    case 'Polygon': {
      // Use first coordinate of outer ring
      const polygon = geometry.coordinates as number[][][];
      if (
        polygon.length > 0 &&
        polygon[0] &&
        polygon[0].length > 0 &&
        polygon[0][0] &&
        polygon[0][0].length >= 2
      ) {
        const [lon, lat] = polygon[0][0];
        if (typeof lon === 'number' && typeof lat === 'number') {
          return { lat, lon };
        }
      }
      break;
    }

    case 'LineString': {
      // Use first coordinate
      const lineString = geometry.coordinates as number[][];
      if (lineString.length > 0 && lineString[0] && lineString[0].length >= 2) {
        const [lon, lat] = lineString[0];
        if (typeof lon === 'number' && typeof lat === 'number') {
          return { lat, lon };
        }
      }
      break;
    }

    case 'MultiPoint': {
      // Use first point
      const multiPoint = geometry.coordinates as number[][];
      if (multiPoint.length > 0 && multiPoint[0] && multiPoint[0].length >= 2) {
        const [lon, lat] = multiPoint[0];
        if (typeof lon === 'number' && typeof lat === 'number') {
          return { lat, lon };
        }
      }
      break;
    }

    default:
      console.warn(`Unsupported geometry type: ${geometry.type}`);
      return null;
  }

  return null;
}

// ================================
// Title Generation
// ================================

/**
 * Generate a title from OSM properties
 */
function generateTitle(properties: OSMFeature['properties']): string {
  // Try name first
  if (properties.name && typeof properties.name === 'string' && properties.name.trim()) {
    return properties.name.trim();
  }

  // Try artwork type + location info
  if (properties.artwork_type && typeof properties.artwork_type === 'string') {
    let title = properties.artwork_type;

    // Add material if available
    if (properties.material && typeof properties.material === 'string') {
      title += ` (${properties.material})`;
    }

    return title;
  }

  // Try tourism type
  if (properties.tourism && typeof properties.tourism === 'string') {
    return `${properties.tourism.charAt(0).toUpperCase()}${properties.tourism.slice(1)}`;
  }

  // Last resort: use OSM ID
  return `OSM Artwork`;
}

// ================================
// Tag Processing
// ================================

/**
 * Convert OSM properties to structured tags
 */
function processOSMTags(
  feature: OSMFeature,
  config: OSMConfig
): Record<string, string | number | boolean> {
  const tags: Record<string, string | number | boolean> = {};
  const { properties } = feature;

  // Attribution tags (always include)
  tags['Source'] = config.defaultConfig.attribution.source;
  tags['License'] = config.defaultConfig.attribution.license;
  tags['Attribution'] = config.defaultConfig.attribution.attribution_text;
  tags['External ID'] = feature.id;

  // OSM-specific metadata
  if (properties.osm_type) {
    tags['OSM Type'] = properties.osm_type;
  }
  if (properties.osm_id) {
    tags['OSM ID'] = properties.osm_id;
  }

  // Artwork properties as tags
  const tagMappings: Record<string, string> = {
    artwork_type: 'Artwork Type',
    material: 'Material',
    tourism: 'Tourism Category',
    wheelchair: 'Wheelchair Access',
    year: 'Year',
    website: 'Website',
    wikipedia: 'Wikipedia',
    wikidata: 'Wikidata',
  };

  for (const [osmKey, tagLabel] of Object.entries(tagMappings)) {
    const value = properties[osmKey];
    if (value !== null && value !== undefined && value !== '') {
      tags[tagLabel] = value;
    }
  }

  // Add all other non-mapped properties as tags with OSM prefix
  const mappedKeys = new Set([
    'name',
    'artist_name',
    'description',
    'osm_type',
    'osm_id',
    ...Object.keys(tagMappings),
  ]);

  for (const [key, value] of Object.entries(properties)) {
    if (!mappedKeys.has(key) && value !== null && value !== undefined && value !== '') {
      tags[`OSM: ${key}`] = value;
    }
  }

  return tags;
}

// ================================
// Main Mapper Implementation
// ================================

/**
 * Map OSM GeoJSON feature to internal format
 */
function mapOSMData(data: OSMFeature): RawImportData {
  const config = loadOSMConfig();
  const { properties } = data;

  // Extract coordinates
  const coords = extractCoordinates(data.geometry);
  if (!coords) {
    throw new Error(`Could not extract coordinates from feature ${data.id}`);
  }

  // Generate title
  const title = generateTitle(properties);

  // Process tags
  const tags = processOSMTags(data, config);

  // Map to internal format
  const mapped: RawImportData = {
    // Core location and identification
    lat: coords.lat,
    lon: coords.lon,
    title: title,
    description: typeof properties.description === 'string' ? properties.description : undefined,

    // Artist and creation info
    artist: typeof properties.artist_name === 'string' ? properties.artist_name : undefined,
    created_by: typeof properties.artist_name === 'string' ? properties.artist_name : undefined,
    yearOfInstallation: typeof properties.year === 'string' ? properties.year : undefined,

    // Physical properties
    material: typeof properties.material === 'string' ? properties.material : undefined,
    type:
      typeof properties.artwork_type === 'string'
        ? properties.artwork_type
        : typeof properties.tourism === 'string'
          ? properties.tourism
          : undefined,

    // Attribution and tracking
    source: 'openstreetmap',
    sourceUrl: typeof properties.website === 'string' ? properties.website : undefined,
    externalId: data.id,
    license: config.defaultConfig.attribution.license,

    // Additional metadata
    tags: tags,
    status: 'active',
  };

  return mapped;
}

/**
 * OSM GeoJSON Data Source Mapper
 */
export const OSMMapper: DataSourceMapper = {
  name: 'osm',
  version: '1.0.0',

  /**
   * Map OSM GeoJSON feature to internal format and validate
   */
  mapData: (data: OSMFeature): ValidationResult => {
    try {
      const mapped = mapOSMData(data);
      // Load OSM config for validation settings
      const osmConfig = loadOSMConfig();
      const configRadius = osmConfig.defaultConfig.duplicateDetectionRadius || 10000; // 10km default for OSM

      // Create config for validation
      const config = {
        apiEndpoint: 'https://api.publicartregistry.com',
        massImportUserToken: 'a0000000-1000-4000-8000-000000000002', // MASS_IMPORT_USER_UUID from shared/constants.ts
        batchSize: 50,
        maxRetries: 3,
        retryDelay: 1000,
        duplicateDetectionRadius: configRadius,
        titleSimilarityThreshold: 0.7,
        dryRun: false,
      };
      return validateImportData(mapped, config);
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            field: 'general',
            message: error instanceof Error ? error.message : 'Unknown validation error',
            severity: 'error',
          },
        ],
        warnings: [],
      };
    }
  },

  /**
   * Generate import ID for OSM features
   */
  generateImportId: (data: OSMFeature): string => {
    return `osm-${data.id.replace('/', '-')}`;
  },
};

// ================================
// Helper Functions for CLI
// ================================

/**
 * Load OSM GeoJSON data from file
 */
export function loadOSMData(filePath: string): OSMFeature[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`OSM GeoJSON file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const geoJSON = JSON.parse(content) as OSMGeoJSON;

  if (geoJSON.type !== 'FeatureCollection') {
    throw new Error('OSM file must be a GeoJSON FeatureCollection');
  }

  if (!Array.isArray(geoJSON.features)) {
    throw new Error('GeoJSON features must be an array');
  }

  console.log(`📍 Loaded ${geoJSON.features.length} OSM features from ${filePath}`);

  // Filter features for artwork-related items
  const artworkFeatures = geoJSON.features.filter(feature => {
    const props = feature.properties;
    return props.tourism === 'artwork' || props.artwork_type || props.artist_name || props.name; // Include named features that might be art
  });

  console.log(`🎨 Found ${artworkFeatures.length} potential artwork features`);

  return artworkFeatures;
}

/**
 * Get processing statistics for OSM data
 */
export function getOSMProcessingStats(data: OSMFeature[]): Record<string, number> {
  const stats: Record<string, number> = {
    'Total Features': data.length,
    'With Names': 0,
    'With Artists': 0,
    'With Websites': 0,
    Points: 0,
    Polygons: 0,
    'Other Geometries': 0,
  };

  for (const feature of data) {
    const props = feature.properties;
    const geom = feature.geometry;

    if (props?.name) {
      stats['With Names'] = (stats['With Names'] || 0) + 1;
    }
    if (props?.artist_name) {
      stats['With Artists'] = (stats['With Artists'] || 0) + 1;
    }
    if (props?.website) {
      stats['With Websites'] = (stats['With Websites'] || 0) + 1;
    }

    if (geom?.type) {
      switch (geom.type) {
        case 'Point':
          stats['Points'] = (stats['Points'] || 0) + 1;
          break;
        case 'Polygon':
        case 'MultiPolygon':
          stats['Polygons'] = (stats['Polygons'] || 0) + 1;
          break;
        default:
          stats['Other Geometries'] = (stats['Other Geometries'] || 0) + 1;
      }
    }
  }

  return stats;
}

/**
 * Get default OSM data path
 */
export function getDefaultOSMDataPath(): string {
  return 'src/data-collection/osm/output/merged/merged-artworks.geojson';
}

export default OSMMapper;
