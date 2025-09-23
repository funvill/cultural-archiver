/**
 * OpenStreetMap Importer Plugin
 *
 * Imports artwork data from OpenStreetMap GeoJSON files
 * with support for artwork, monument, and other art-related features.
 */

import type { ImporterPlugin, ImporterConfig, PluginMetadata } from '../types/plugin.js';
import type { RawImportData, ValidationResult, ValidationError } from '../types/index.js';

// ================================
// Plugin Configuration
// ================================

export interface OSMImporterConfig extends ImporterConfig {
  preset: string;
  includeFeatureTypes: string[];
  excludeTags?: Record<string, string[]>;
  tagMappings: Record<string, string>;
  descriptionFields: string[];
  artistFields: string[];
  yearFields: string[];
}

// ================================
// GeoJSON Data Interfaces
// ================================

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: Record<string, unknown>;
}

interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// ================================
// Plugin Implementation
// ================================

export class OSMImporter implements ImporterPlugin {
  // Plugin metadata
  name = 'osm-artwork';
  description = 'Imports artwork and monument data from OpenStreetMap GeoJSON files';
  metadata: PluginMetadata = {
    name: 'osm-artwork',
    description: 'OpenStreetMap Artwork Importer',
    version: '1.0.0',
    author: 'Cultural Archiver Team',
    supportedFormats: ['geojson', 'json'],
    requiredFields: ['geometry.coordinates', 'properties'],
    optionalFields: ['properties.name', 'properties.artist_name', 'properties.start_date'],
  };

  // Configuration schema for validation
  configSchema = {
    type: 'object',
    properties: {
      preset: { type: 'string' },
      includeFeatureTypes: { type: 'array', items: { type: 'string' } },
      excludeTags: { type: 'object' },
      tagMappings: { type: 'object' },
      descriptionFields: { type: 'array', items: { type: 'string' } },
      artistFields: { type: 'array', items: { type: 'string' } },
      yearFields: { type: 'array', items: { type: 'string' } },
    },
    required: ['preset', 'includeFeatureTypes', 'tagMappings'],
  };

  // Plugin capabilities
  supportedFormats = ['geojson', 'json'];
  requiredFields = ['geometry.coordinates', 'properties'];
  optionalFields = ['properties.name', 'properties.artist_name', 'properties.start_date'];

  // ================================
  // Core Plugin Methods
  // ================================

  /**
   * Map source data to standardized import format
   */
  async mapData(sourceData: unknown, config: OSMImporterConfig): Promise<RawImportData[]> {
    // Handle both direct GeoJSON data and parsed JSON
    let geoJsonData: GeoJSONData;

    if (typeof sourceData === 'string') {
      try {
        geoJsonData = JSON.parse(sourceData) as GeoJSONData;
      } catch (error) {
        throw new Error(
          `Failed to parse GeoJSON: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      geoJsonData = sourceData as GeoJSONData;
    }

    if (!geoJsonData.features || !Array.isArray(geoJsonData.features)) {
      throw new Error('Invalid GeoJSON: missing or invalid features array');
    }

    const mappedData: RawImportData[] = [];

    for (const feature of geoJsonData.features) {
      try {
        // Filter features based on configuration
        if (!this.shouldIncludeFeature(feature, config)) {
          continue;
        }

        const mappedRecord = await this.mapSingleFeature(feature, config);
        mappedData.push(mappedRecord);
      } catch (error) {
        console.warn(
          `Failed to map OSM feature: ${error instanceof Error ? error.message : String(error)}`
        );
        continue;
      }
    }

    return mappedData;
  }

  /**
   * Validate source data structure
   */
  async validateData(sourceData: unknown): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Parse and validate GeoJSON structure
    let geoJsonData: GeoJSONData;

    try {
      if (typeof sourceData === 'string') {
        geoJsonData = JSON.parse(sourceData) as GeoJSONData;
      } else {
        geoJsonData = sourceData as GeoJSONData;
      }
    } catch (error) {
      errors.push({
        field: 'sourceData',
        message: `Failed to parse input as JSON. The osm-artwork importer expects a GeoJSON file. Error: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    // Check for basic data structure indicators to provide helpful error messages
    if (!geoJsonData || typeof geoJsonData !== 'object') {
      errors.push({
        field: 'sourceData',
        message:
          'Input data is not a valid object. The osm-artwork importer requires a GeoJSON FeatureCollection file with geographic artwork data.',
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    // Validate GeoJSON structure
    if (geoJsonData.type !== 'FeatureCollection') {
      const actualType = geoJsonData.type || 'undefined';
      errors.push({
        field: 'type',
        message: `Expected GeoJSON FeatureCollection but found type: "${actualType}". The osm-artwork importer only accepts GeoJSON files exported from OpenStreetMap or similar sources. Please ensure your input file is a valid GeoJSON FeatureCollection.`,
        severity: 'error',
      });
    }

    if (!geoJsonData.features || !Array.isArray(geoJsonData.features)) {
      const hasFeatures = 'features' in geoJsonData;
      const featuresType = hasFeatures ? typeof geoJsonData.features : 'missing';
      errors.push({
        field: 'features',
        message: `GeoJSON FeatureCollection must contain a "features" array (found: ${featuresType}). Your input file appears to be in a different format. The osm-artwork importer expects GeoJSON data with geographic features containing artwork, monuments, or other art objects.`,
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    // Check if features array is empty
    if (geoJsonData.features.length === 0) {
      errors.push({
        field: 'features',
        message:
          'GeoJSON FeatureCollection contains no features. The input file appears to be valid GeoJSON but has no artwork data. Please ensure your export includes geographic features with artwork, monuments, or other art objects.',
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    // Validate sample features
    const sampleSize = Math.min(10, geoJsonData.features.length);
    for (let i = 0; i < sampleSize; i++) {
      const feature = geoJsonData.features[i];

      if (!feature) {
        errors.push({
          field: `features[${i}]`,
          message: `Feature ${i}: Feature is null or undefined. This suggests corrupted GeoJSON data.`,
          severity: 'error',
        });
        continue;
      }

      if (!feature.geometry || feature.geometry.type !== 'Point') {
        warnings.push({
          field: `features[${i}].geometry`,
          message: `Feature ${i}: Only Point geometries are supported for artwork locations. LineString and Polygon features will be skipped.`,
          severity: 'warning',
        });
        continue;
      }

      if (
        !feature.geometry.coordinates ||
        !Array.isArray(feature.geometry.coordinates) ||
        feature.geometry.coordinates.length !== 2
      ) {
        errors.push({
          field: `features[${i}].geometry.coordinates`,
          message: `Feature ${i}: Invalid coordinates format. Expected [longitude, latitude] array but found: ${JSON.stringify(feature.geometry.coordinates)}`,
          severity: 'error',
        });
        continue;
      }

      // Validate coordinate ranges
      const [lon, lat] = feature.geometry.coordinates;
      if (typeof lat !== 'number' || lat < -90 || lat > 90) {
        errors.push({
          field: `features[${i}].geometry.coordinates[1]`,
          message: `Feature ${i}: Invalid latitude ${lat}. Latitude must be a number between -90 and 90 degrees.`,
          severity: 'error',
        });
      }
      if (typeof lon !== 'number' || lon < -180 || lon > 180) {
        errors.push({
          field: `features[${i}].geometry.coordinates[0]`,
          message: `Feature ${i}: Invalid longitude ${lon}. Longitude must be a number between -180 and 180 degrees.`,
          severity: 'error',
        });
      }
    }

    // Add helpful guidance if there were errors
    if (errors.length > 0) {
      errors.push({
        field: 'help',
        message: `The osm-artwork importer requires GeoJSON files with artwork data. Expected format: {"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": {...}}]}. If you have a different file format, try using a different importer plugin.`,
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate unique import ID for feature
   */
  generateImportId(record: unknown): string {
    // Handle RawImportData (already transformed)
    if (record && typeof record === 'object' && 'externalId' in record) {
      const rawData = record as RawImportData;
      return (
        rawData.externalId ||
        this.generateIdFromCoordinates(rawData.lat, rawData.lon, rawData.title)
      );
    }

    // Handle GeoJSON feature (original data)
    const feature = record as GeoJSONFeature;
    if (!feature.geometry?.coordinates) {
      return `osm-unknown-${Date.now()}`;
    }

    const props = feature.properties || {};

    // Try to use OSM ID if available
    if (props.id || props.osm_id) {
      return `osm-${props.id || props.osm_id}`;
    }

    // Fallback to coordinates and name
    const [lon, lat] = feature.geometry.coordinates;
    const name = String(props.name || props.title || 'unnamed');
    return this.generateIdFromCoordinates(lat, lon, name);
  }

  /**
   * Generate ID from coordinates and name
   */
  private generateIdFromCoordinates(lat: number, lon: number, name: string): string {
    const cleanName = String(name).replace(/\s+/g, '-').toLowerCase();
    return `osm-${cleanName}-${lat.toFixed(6)}-${lon.toFixed(6)}`;
  }

  /**
   * Get default data path for this importer
   */
  getDefaultDataPath(): string {
    return './data/osm-artwork.geojson';
  }

  // ================================
  // Private Helper Methods
  // ================================

  /**
   * Check if feature should be included based on configuration
   */
  private shouldIncludeFeature(feature: GeoJSONFeature, config: OSMImporterConfig): boolean {
    const props = feature.properties || {};

    // Check if feature type is included
    const tourism = props.tourism as string;
    const historic = props.historic as string;
    const artworkType = props.artwork_type as string;

    const featureTypes = [tourism, historic, artworkType].filter(Boolean);
    const hasIncludedType = featureTypes.some(type => config.includeFeatureTypes.includes(type));

    if (!hasIncludedType) {
      return false;
    }

    // Check exclusion rules
    if (config.excludeTags) {
      for (const [tag, excludeValues] of Object.entries(config.excludeTags)) {
        const value = props[tag] as string;
        if (value && excludeValues.includes(value)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Map a single GeoJSON feature to standardized format
   */
  private async mapSingleFeature(
    feature: GeoJSONFeature,
    config: OSMImporterConfig
  ): Promise<RawImportData> {
    const props = feature.properties || {};
    const [lon, lat] = feature.geometry.coordinates;

    // Extract core fields
    const title = this.extractTitle(props);
    let description = this.extractDescription(props, config.descriptionFields);
    const artist = this.extractArtist(props, config.artistFields);
    const year = this.extractYear(props, config.yearFields);

    // Build tags using configured mappings (exclude description fields)
    const tags = this.buildTags(props, config.tagMappings, config.descriptionFields);

    // Generate external ID first so we can use it in the description
    const externalId = this.generateImportId(feature);

    // Enhance description with OSM source attribution
    const osmAttribution = `\n\nImported from Open Street Maps (node: ${externalId})`;
    description = description ? description + osmAttribution : osmAttribution.trim();

    // Map to standardized format
    const mappedRecord: RawImportData = {
      lat,
      lon,
      title: title || 'Unnamed Artwork',
      description,
      source: 'openstreetmap',
      externalId,
      tags,
      ...(artist && { artist }),
      ...(year && { yearOfInstallation: year }),
    };

    return mappedRecord;
  }

  /**
   * Extract title from OSM properties
   */
  private extractTitle(props: Record<string, unknown>): string {
    const titleFields = ['name', 'title', 'name:en', 'official_name'];

    for (const field of titleFields) {
      const value = props[field];
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  /**
   * Extract description from configured fields
   */
  private extractDescription(props: Record<string, unknown>, descriptionFields: string[]): string {
    const descriptions: string[] = [];

    for (const field of descriptionFields) {
      const value = props[field];
      if (value && typeof value === 'string' && value.trim()) {
        descriptions.push(value.trim());
      }
    }

    return descriptions.join(' | ');
  }

  /**
   * Extract artist information from configured fields
   */
  private extractArtist(props: Record<string, unknown>, artistFields: string[]): string {
    for (const field of artistFields) {
      const value = props[field];
      if (value && typeof value === 'string' && value.trim()) {
        // Replace " and " with "," to properly separate multiple artists
        return value.trim().replace(/ and /g, ', ');
      }
    }

    return '';
  }

  /**
   * Extract year from configured fields
   */
  private extractYear(props: Record<string, unknown>, yearFields: string[]): string {
    for (const field of yearFields) {
      const value = props[field];
      if (value) {
        const stringValue = String(value);
        // Extract 4-digit year
        const yearMatch = stringValue.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          return yearMatch[0];
        }
      }
    }

    return '';
  }

  /**
   * Build tags object using configured mappings
   */
  private buildTags(
    props: Record<string, unknown>,
    tagMappings: Record<string, string>,
    descriptionFields: string[]
  ): Record<string, string> {
    const tags: Record<string, string> = {};

    // Copy all original OSM tags first, excluding description fields
    for (const [key, value] of Object.entries(props)) {
      if (value && typeof value === 'string' && value.trim()) {
        // Skip description fields - they should not be in tags
        if (!descriptionFields.includes(key)) {
          tags[key] = value.trim();
        }
      }
    }

    // Apply configured tag mappings (these can override OSM tags)
    for (const [outputTag, sourceField] of Object.entries(tagMappings)) {
      const value = props[sourceField];
      if (value && typeof value === 'string' && value.trim()) {
        // Skip description fields - they should not be in tags
        if (!descriptionFields.includes(sourceField)) {
          tags[outputTag] = value.trim();
        }
      }
    }

    return tags;
  }
}

// ================================
// Plugin Export
// ================================

// Export the plugin instance
export const osmImporter = new OSMImporter();
