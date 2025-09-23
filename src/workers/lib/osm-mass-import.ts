/**
 * OpenStreetMap Mass Import Parser
 *
 * Parses OSM GeoJSON artwork data and converts it to mass-import format
 * with proper field mappings, validation, and attribution.
 */

import { MASS_IMPORT_USER_UUID } from '../../shared/constants.js';

// Import interfaces from shared types
interface MassImportPayload {
  user_uuid: string;
  duplicateThreshold?: number;
  importer?: string;
  artwork: {
    title: string;
    description?: string;
    lat: number;
    lon: number;
    photos?: Array<{ url: string }>;
    created_by?: string;
  };
  logbook?: Array<{
    note?: string;
    timestamp?: string;
    tags?: Array<{ label: string; value: string }>;
  }>;
}

export interface OSMFeature {
  type: 'Feature';
  id: string; // e.g., "node/4343692187"
  properties: {
    osm_type: 'node' | 'way' | 'relation';
    osm_id: number;
    name?: string;
    artist_name?: string;
    artwork_type?: string;
    material?: string;
    tourism: 'artwork';
    website?: string;
    [key: string]: any;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
}

export interface OSMGeoJSON {
  type: 'FeatureCollection';
  features: OSMFeature[];
}

export interface OSMImportConfig {
  /** User UUID for imports (uses MASS_IMPORT_USER_UUID) */
  user_uuid: string;

  /** Duplicate detection threshold (0.7 recommended) */
  duplicateThreshold: number;

  /** Source attribution */
  attribution: {
    source: string;
    license: string;
    attribution_text: string;
  };

  /** Field mappings from OSM properties to platform fields */
  fieldMappings: {
    title: string;
    artist: string;
    description?: string;
  };

  /** Validation rules */
  validation: {
    requireName: boolean;
    requireCoordinates: boolean;
    skipIncomplete: boolean;
  };
}

export interface OSMImportResult {
  total: number;
  valid: number;
  skipped: number;
  errors: Array<{ feature_id: string; error: string }>;
  payloads: MassImportPayload[];
}

/**
 * Default OSM import configuration
 */
export const DEFAULT_OSM_CONFIG: OSMImportConfig = {
  user_uuid: MASS_IMPORT_USER_UUID,
  duplicateThreshold: 0.7,
  attribution: {
    source: 'OpenStreetMap',
    license: '[ODbL](https://www.openstreetmap.org/copyright)',
    attribution_text: '© OpenStreetMap contributors',
  },
  fieldMappings: {
    title: 'name',
    artist: 'artist_name',
    description: 'description',
  },
  validation: {
    requireName: true,
    requireCoordinates: true,
    skipIncomplete: true,
  },
};

/**
 * Parse OSM GeoJSON and convert to mass-import payloads
 */
export function parseOSMGeoJSON(
  geoJSON: OSMGeoJSON,
  config: Partial<OSMImportConfig> = {}
): OSMImportResult {
  const cfg = { ...DEFAULT_OSM_CONFIG, ...config };
  const result: OSMImportResult = {
    total: geoJSON.features.length,
    valid: 0,
    skipped: 0,
    errors: [],
    payloads: [],
  };

  for (const feature of geoJSON.features) {
    try {
      const payload = convertOSMFeatureToPayload(feature, cfg);

      if (payload) {
        result.payloads.push(payload);
        result.valid++;
      } else {
        result.skipped++;
      }
    } catch (error) {
      result.errors.push({
        feature_id: feature.id || 'unknown',
        error: error instanceof Error ? error.message : String(error),
      });
      result.skipped++;
    }
  }

  return result;
}

/**
 * Convert single OSM feature to mass-import payload
 */
function convertOSMFeatureToPayload(
  feature: OSMFeature,
  config: OSMImportConfig
): MassImportPayload | null {
  // Validation: check required fields
  if (config.validation.requireName && !feature.properties.name) {
    if (config.validation.skipIncomplete) return null;
    throw new Error('Missing required field: name');
  }

  if (config.validation.requireCoordinates) {
    const [lon, lat] = feature.geometry.coordinates;
    if (!isValidCoordinate(lat, lon)) {
      if (config.validation.skipIncomplete) return null;
      throw new Error('Invalid coordinates');
    }
  }

  const [lon, lat] = feature.geometry.coordinates;

  // Build core tags with OSM attribution
  const coreTags = [
    { label: 'Source', value: config.attribution.source },
    { label: 'License', value: config.attribution.license },
    { label: 'Attribution', value: config.attribution.attribution_text },
    { label: 'External ID', value: feature.id },
  ];

  // Add OSM-specific metadata tags
  if (feature.properties.osm_type) {
    coreTags.push({ label: 'OSM Type', value: feature.properties.osm_type });
  }
  if (feature.properties.osm_id) {
    coreTags.push({ label: 'OSM ID', value: feature.properties.osm_id.toString() });
  }

  // Smart mapping: extract common fields as tags
  const propertyTags = mapOSMPropertiesToTags(feature.properties);
  const allTags = [...coreTags, ...propertyTags];

  // Build artwork object
  const artwork = {
    title:
      feature.properties[config.fieldMappings.title] ||
      feature.properties.name ||
      'Untitled Artwork',
    lat,
    lon,
    created_by: feature.properties[config.fieldMappings.artist] || feature.properties.artist_name,
  };

  // Add description if available
  let artworkWithDescription: any = artwork;
  if (config.fieldMappings.description && feature.properties[config.fieldMappings.description]) {
    artworkWithDescription.description = feature.properties[config.fieldMappings.description];
  }

  return {
    user_uuid: config.user_uuid,
    duplicateThreshold: config.duplicateThreshold,
    importer: 'osm-geojson-importer',
    artwork: artworkWithDescription,
    logbook: [
      {
        note: `Imported from OpenStreetMap (${feature.id})`,
        tags: allTags,
      },
    ],
  };
}

/**
 * Map OSM properties to structured tags
 */
function mapOSMPropertiesToTags(
  properties: OSMFeature['properties']
): Array<{ label: string; value: string }> {
  const tags: Array<{ label: string; value: string }> = [];

  // Common OSM artwork fields with smart labeling
  const fieldMappings: Record<string, string> = {
    artwork_type: 'Artwork Type',
    material: 'Material',
    website: 'Website',
    tourism: 'Tourism Type',
    artist: 'Artist',
    creator: 'Creator',
    start_date: 'Created Date',
    inscription: 'Inscription',
  };

  // Process known fields
  for (const [osmField, label] of Object.entries(fieldMappings)) {
    if (properties[osmField]) {
      tags.push({ label, value: String(properties[osmField]) });
    }
  }

  // Process other fields (excluding system fields)
  const systemFields = new Set(['osm_type', 'osm_id', 'name', 'artist_name', 'description']);

  for (const [key, value] of Object.entries(properties)) {
    if (!systemFields.has(key) && !fieldMappings[key] && value != null) {
      // Convert field name to readable label
      const label = key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      tags.push({ label, value: String(value) });
    }
  }

  return tags;
}

/**
 * Validate coordinate values
 */
function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !isNaN(lat) &&
    !isNaN(lon)
  );
}

/**
 * Load and parse OSM GeoJSON file
 */
export async function loadOSMGeoJSON(_filePath: string): Promise<OSMGeoJSON> {
  // In Cloudflare Workers, we'd use fetch() or R2
  // For now, assume the caller provides the parsed JSON
  throw new Error('File loading not implemented - provide parsed GeoJSON object');
}

/**
 * Generate import summary report
 */
export function generateImportSummary(result: OSMImportResult): string {
  const successRate = ((result.valid / result.total) * 100).toFixed(1);

  let summary = `OSM Import Summary:\n`;
  summary += `Total features: ${result.total}\n`;
  summary += `Valid imports: ${result.valid} (${successRate}%)\n`;
  summary += `Skipped: ${result.skipped}\n`;
  summary += `Errors: ${result.errors.length}\n`;

  if (result.errors.length > 0) {
    summary += `\nError details:\n`;
    result.errors.forEach(err => {
      summary += `- ${err.feature_id}: ${err.error}\n`;
    });
  }

  return summary;
}
