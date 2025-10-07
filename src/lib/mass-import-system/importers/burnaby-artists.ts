/**
 * Burnaby Artists Importer Plugin
 *
 * Imports artist data from Burnaby Art Gallery JSON files
 * with support for biographies and metadata.
 */

import * as fs from 'fs/promises';
import type { ImporterPlugin, ImporterConfig, PluginMetadata } from '../types/plugin.js';
import type { RawImportData, ValidationResult, ValidationError } from '../types/index.js';

// ================================
// Plugin Configuration
// ================================

export interface BurnabyArtistsImporterConfig extends ImporterConfig {
  // No additional config needed for now
}

// ================================
// Burnaby Artist Data Interface
// ================================

interface BurnabyArtist {
  source: string;
  source_url: string;
  name: string;
  type: string;
  biography: string;
  'birth date'?: string;
  'death date'?: string;
  websites?: string;
}

// ================================
// Plugin Implementation
// ================================

export class BurnabyArtistsImporter implements ImporterPlugin {
  // Plugin metadata
  name = 'burnaby-artists';
  description = 'Imports artist data from Burnaby Art Gallery JSON files';
  metadata: PluginMetadata = {
    name: 'burnaby-artists',
    description: 'Burnaby Art Gallery Artists Importer',
    version: '1.0.0',
    author: 'Cultural Archiver Team',
    supportedFormats: ['json'],
    requiredFields: ['name'],
    optionalFields: ['biography', 'birth date', 'death date', 'websites'],
  };

  // Configuration schema for validation
  configSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  // Plugin capabilities
  supportedFormats = ['json'];
  requiredFields = ['name'];
  optionalFields = ['biography', 'birth date', 'death date', 'websites'];

  // ================================
  // Core Plugin Methods
  // ================================

  /**
   * Map source data to standardized import format
   */
  async mapData(sourceData: unknown, config: BurnabyArtistsImporterConfig): Promise<RawImportData[]> {
    // Handle both direct JSON data and parsed JSON
    let artistsData: BurnabyArtist[];

    if (typeof sourceData === 'string') {
      try {
        artistsData = JSON.parse(sourceData) as BurnabyArtist[];
      } catch (error) {
        throw new Error(
          `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      artistsData = sourceData as BurnabyArtist[];
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
          `Failed to map Burnaby artist: ${error instanceof Error ? error.message : String(error)}`
        );
        continue;
      }
    }

    return mappedData;
  }

  /**
   * Map a single artist record
   */
  private mapSingleArtist(artist: BurnabyArtist): RawImportData {
    // Build tags from metadata
    const tags: Record<string, string> = {
      source: artist.source,
      source_url: artist.source_url,
      type: artist.type,
    };

    // Add birth/death dates if available
    if (artist['birth date']) {
      tags.birth_date = artist['birth date'];
    }
    if (artist['death date']) {
      tags.death_date = artist['death date'];
    }
    if (artist.websites && artist.websites.trim()) {
      tags.websites = artist.websites;
    }

    return {
      title: artist.name,
      description: artist.biography || undefined,
      source: artist.source,
      tags,
      externalId: `burnaby-artist-${artist.name.toLowerCase().replace(/\s+/g, '-')}`,
      photos: [],
    };
  }

  /**
   * Validate input data structure
   */
  async validateInput(data: unknown): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

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
        details: error instanceof Error ? error.message : String(error),
      });
      return { valid: false, errors };
    }

    // Check if it's an array
    if (!Array.isArray(parsed)) {
      errors.push({
        field: 'data',
        message: 'Expected an array of artist objects',
        code: 'INVALID_STRUCTURE',
        details: `Found type: ${typeof parsed}`,
      });
      return { valid: false, errors };
    }

    // Check if array is not empty
    if (parsed.length === 0) {
      errors.push({
        field: 'data',
        message: 'Artist array is empty',
        code: 'EMPTY_ARRAY',
      });
      return { valid: false, errors };
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
        });
        continue;
      }

      if (!artist.name || typeof artist.name !== 'string') {
        errors.push({
          field: `artists[${i}].name`,
          message: 'Artist name is required and must be a string',
          code: 'MISSING_REQUIRED_FIELD',
        });
      }

      if (!artist.source || typeof artist.source !== 'string') {
        errors.push({
          field: `artists[${i}].source`,
          message: 'Artist source is required and must be a string',
          code: 'MISSING_REQUIRED_FIELD',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get sample/preview of mapped data
   */
  async getSample(sourceData: unknown, sampleSize: number = 3): Promise<RawImportData[]> {
    const mapped = await this.mapData(sourceData, {});
    return mapped.slice(0, sampleSize);
  }
}

// ================================
// Plugin Factory & Registration
// ================================

export const burnabyArtistsImporter = new BurnabyArtistsImporter();
