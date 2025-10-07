/**
 * Generic Artist JSON Importer Plugin
 *
 * Imports artist data from JSON files following a standard format.
 * This importer is designed to work with any artist JSON file that follows
 * the structure used by Burnaby Art Gallery and similar sources.
 *
 * Expected JSON Format:
 * [
 *   {
 *     "source": "https://example.com",
 *     "source_url": "https://example.com/artist/123",
 *     "name": "Artist Name",
 *     "type": "Artist",
 *     "biography": "Artist biography text...",
 *     "birth date": "1950",      // optional
 *     "death date": "2020",      // optional
 *     "websites": "https://..."  // optional
 *   },
 *   ...
 * ]
 */

import type { ImporterPlugin, ImporterConfig, PluginMetadata, ValidationError } from '../types/plugin.js';
import type { RawImportData, ValidationResult } from '../types/index.js';

// ================================
// Plugin Configuration
// ================================

export interface ArtistJsonImporterConfig extends ImporterConfig {
  /**
   * Custom weights for duplicate detection
   * Higher title weight since name is primary match criteria for artists
   */
  duplicateWeights?: {
    gps: number;
    title: number;
    artist: number;
    referenceIds: number;
    tagSimilarity: number;
  };
  /**
   * Lower threshold for name-based matching
   */
  duplicateThreshold?: number;
}

// ================================
// Artist Data Interface
// ================================

interface ArtistJsonRecord {
  source: string;
  source_url: string;
  name: string;
  type?: string;
  biography?: string;
  'birth date'?: string;
  'death date'?: string;
  websites?: string;
  // Allow additional fields
  [key: string]: any;
}

// ================================
// Plugin Implementation
// ================================

export class ArtistJsonImporter implements ImporterPlugin {
  // Plugin metadata
  name = 'artist-json';
  description = 'Generic importer for artist data from JSON files (Burnaby format)';
  metadata: PluginMetadata = {
    name: 'artist-json',
    description: 'Generic Artist JSON Importer - supports Burnaby format and similar',
    version: '1.0.0',
    author: 'Cultural Archiver Team',
    supportedFormats: ['json'],
    requiredFields: ['name', 'source'],
    optionalFields: ['biography', 'type', 'birth date', 'death date', 'websites', 'source_url'],
  };

  // Configuration schema for validation
  configSchema = {
    type: 'object',
    properties: {
      duplicateWeights: {
        type: 'object',
        properties: {
          gps: { type: 'number' },
          title: { type: 'number' },
          artist: { type: 'number' },
          referenceIds: { type: 'number' },
          tagSimilarity: { type: 'number' },
        },
      },
      duplicateThreshold: { type: 'number' },
    },
    required: [],
  };

  // Plugin capabilities
  supportedFormats = ['json'];
  requiredFields = ['name', 'source'];
  optionalFields = ['biography', 'type', 'birth date', 'death date', 'websites', 'source_url'];

  // Default configuration optimized for artist matching
  private readonly defaultConfig: ArtistJsonImporterConfig = {
    duplicateWeights: {
      gps: 0.0,
      title: 1.0, // Name is the primary match criteria for artists
      artist: 0.0,
      referenceIds: 0.0, // Don't use reference IDs (would compare to UUID)
      tagSimilarity: 0.0,
    },
    duplicateThreshold: 0.25, // Lower threshold for name-only matching
  };

  // ================================
  // Core Plugin Methods
  // ================================

  /**
   * Map source data to standardized import format
   */
  async mapData(sourceData: unknown, _config: ArtistJsonImporterConfig): Promise<RawImportData[]> {
    // Handle both direct JSON data and parsed JSON
    let artistsData: ArtistJsonRecord[];

    if (typeof sourceData === 'string') {
      try {
        artistsData = JSON.parse(sourceData) as ArtistJsonRecord[];
      } catch (error) {
        throw new Error(
          `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      artistsData = sourceData as ArtistJsonRecord[];
    }

    if (!Array.isArray(artistsData)) {
      throw new Error('Invalid JSON: expected an array of artist objects');
    }

    const mappedData: RawImportData[] = [];

    for (const artist of artistsData) {
      try {
        const mappedRecord = this.mapSingleArtist(artist);
        mappedData.push(mappedRecord);
      } catch (error) {
        console.warn(
          `Failed to map artist: ${error instanceof Error ? error.message : String(error)}`
        );
        continue;
      }
    }

    return mappedData;
  }

  /**
   * Map a single artist record
   */
  private mapSingleArtist(artist: ArtistJsonRecord): RawImportData {
    // Build tags from metadata
    const tags: Record<string, string> = {
      source: artist.source,
    };

    // Add optional source URL
    if (artist.source_url) {
      tags.source_url = artist.source_url;
    }

    // Add type if available
    if (artist.type) {
      tags.type = artist.type;
    }

    // Add birth/death dates if available
    if (artist['birth date']) {
      tags.birth_date = artist['birth date'];
    }
    if (artist['death date']) {
      tags.death_date = artist['death date'];
    }

    // Add websites if available
    if (artist.websites && artist.websites.trim()) {
      tags.websites = artist.websites;
    }

    // Generate external ID from name (for deduplication)
    const externalId = `artist-json-${artist.name.toLowerCase().replace(/\s+/g, '-')}`;

    return {
      lat: 0, // Artists don't have geographic location
      lon: 0,
      title: artist.name,
      description: artist.biography || undefined,
      source: artist.source,
      tags,
      externalId,
      photos: [],
    };
  }

  /**
   * Validate input data structure
   */
  async validateData(data: unknown): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check if data is parseable JSON
    let parsed: any;
    try {
      if (typeof data === 'string') {
        parsed = JSON.parse(data);
      } else {
        parsed = data;
      }
    } catch (error) {
      errors.push({
        field: 'data',
        message: 'Input is not valid JSON',
        code: 'INVALID_JSON',
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    // Check if it's an array
    if (!Array.isArray(parsed)) {
      errors.push({
        field: 'data',
        message: 'Expected an array of artist objects',
        code: 'INVALID_STRUCTURE',
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    // Check if array is not empty
    if (parsed.length === 0) {
      errors.push({
        field: 'data',
        message: 'Artist array is empty',
        code: 'EMPTY_ARRAY',
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    // Validate first few records to ensure correct structure
    const samplesToCheck = Math.min(3, parsed.length);
    for (let i = 0; i < samplesToCheck; i++) {
      const artist = parsed[i];

      if (!artist || typeof artist !== 'object') {
        errors.push({
          field: `artists[${i}]`,
          message: 'Artist record must be an object',
          code: 'INVALID_RECORD',
          severity: 'error',
        });
        continue;
      }

      // Required fields
      if (!artist.name || typeof artist.name !== 'string') {
        errors.push({
          field: `artists[${i}].name`,
          message: 'Artist name is required and must be a string',
          code: 'MISSING_REQUIRED_FIELD',
          severity: 'error',
        });
      }

      if (!artist.source || typeof artist.source !== 'string') {
        errors.push({
          field: `artists[${i}].source`,
          message: 'Artist source is required and must be a string',
          code: 'MISSING_REQUIRED_FIELD',
          severity: 'error',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate unique import ID for an artist record
   */
  generateImportId(record: unknown): string {
    // Handle RawImportData (already transformed)
    if (record && typeof record === 'object' && 'externalId' in record) {
      const rawData = record as RawImportData;
      return rawData.externalId || `artist-unknown-${Date.now()}`;
    }

    // Handle raw artist JSON data
    const artist = record as ArtistJsonRecord;
    if (artist.name) {
      return `artist-json-${artist.name.toLowerCase().replace(/\s+/g, '-')}`;
    }

    return `artist-unknown-${Date.now()}`;
  }

  /**
   * Get sample/preview of mapped data
   */
  async getSample(sourceData: unknown, sampleSize: number = 3): Promise<RawImportData[]> {
    const mapped = await this.mapData(sourceData, {});
    return mapped.slice(0, sampleSize);
  }

  /**
   * Get the default configuration for this importer
   * This is used by the CLI to set optimal duplicate detection settings
   */
  getDefaultConfig(): ArtistJsonImporterConfig {
    return { ...this.defaultConfig };
  }
}

// ================================
// Plugin Factory & Registration
// ================================

export const artistJsonImporter = new ArtistJsonImporter();
