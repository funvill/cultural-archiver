/**
 * Vancouver Public Art Importer Plugin
 * 
 * Imports artwork data from Vancouver's Open Data portal
 * with structured field mapping and tag transformation.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { 
  ImporterPlugin, 
  ImporterConfig, 
  PluginMetadata
} from '../types/plugin.js';
import type { RawImportData, ValidationResult, ValidationError, PhotoInfo } from '../types/index.js';

// ================================
// Plugin Configuration
// ================================

interface TagMapping {
  source_field: string;
  transform?: string;
  validation?: string;
}

export interface VancouverPublicArtConfig extends ImporterConfig {
  dataFile: string;
  processingMode: 'sequential' | 'parallel';
  duplicateRadiusMeters: number;
  fieldMappings: {
    title: string;
    description: string;
    notes: string;
    coordinates: {
      lat: string;
      lon: string;
    };
  };
  tagMappings: Record<string, string | TagMapping>;
}

// ================================
// Data Interfaces
// ================================

interface VancouverArtworkRecord {
  registryid: number;
  title_of_work: string;
  descriptionofwork?: string;
  artistprojectstatement?: string;
  geo_point_2d: {
    lat: number;
    lon: number;
  };
  type: string;
  artists: string[] | string | undefined;
  primarymaterial?: string;
  yearofinstallation: string;
  sitename?: string;
  siteaddress?: string;
  status: string;
  url?: string;
  neighbourhood: string;
  ownership?: string;
  photourl?: VancouverPhotoInfo;
  photocredits?: string | null;
  [key: string]: unknown;
}

interface VancouverPhotoInfo {
  url: string;
  filename: string;
  width?: number;
  height?: number;
  mimetype?: string;
  [key: string]: unknown;
}

interface VancouverArtistRecord {
  artistid: number;
  firstname: string;
  lastname: string;
  artisturl?: string;
  biography?: string;
  country?: string;
  [key: string]: unknown;
}

// ================================
// Plugin Implementation
// ================================

export class VancouverPublicArtImporter implements ImporterPlugin {
  // Plugin metadata
  name = 'vancouver-public-art';
  description = 'Imports artwork data from Vancouver Open Data portal with structured field mapping';
  metadata: PluginMetadata = {
    name: 'vancouver-public-art',
    description: 'Vancouver Public Art Importer',
    version: '1.0.0',
    author: 'Cultural Archiver Team',
    supportedFormats: ['json'],
    requiredFields: ['title_of_work', 'geo_point_2d'],
    optionalFields: ['descriptionofwork', 'artistprojectstatement', 'artists', 'type']
  };

  // Artist lookup cache
  private artistLookup: Map<string, VancouverArtistRecord> = new Map();

  // Configuration schema for validation
  configSchema = {
    type: 'object',
    properties: {
      dataFile: { type: 'string' },
      processingMode: { type: 'string', enum: ['sequential', 'parallel'] },
      duplicateRadiusMeters: { type: 'number', minimum: 0 },
      fieldMappings: { type: 'object' },
      tagMappings: { type: 'object' }
    },
    required: ['dataFile', 'fieldMappings', 'tagMappings']
  };

  // Plugin capabilities
  supportedFormats = ['json'];
  requiredFields = ['title_of_work', 'geo_point_2d'];
  optionalFields = ['descriptionofwork', 'artistprojectstatement', 'artists', 'type'];

  // ================================
  // Core Plugin Methods
  // ================================

  /**
   * Map source data to standardized import format
   */
  async mapData(sourceData: unknown, config: VancouverPublicArtConfig): Promise<RawImportData[]> {
    if (!Array.isArray(sourceData)) {
      throw new Error('Vancouver Public Art data must be an array of artwork records');
    }

    // Load artist lookup data
    await this.loadArtistLookup();

    const mappedData: RawImportData[] = [];

    for (const record of sourceData as VancouverArtworkRecord[]) {
      try {
        const mappedRecord = await this.mapSingleRecord(record, config);
        mappedData.push(mappedRecord);
      } catch (error) {
        console.warn(`Failed to map record: ${error instanceof Error ? error.message : String(error)}`);
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

    // Check if data is an array
    if (!Array.isArray(sourceData)) {
      errors.push({
        field: 'sourceData',
        message: 'Source data must be an array of artwork records',
        severity: 'error'
      });
      return { isValid: false, errors, warnings };
    }

    // Validate sample records
    const sampleSize = Math.min(10, sourceData.length);
    for (let i = 0; i < sampleSize; i++) {
      const record = sourceData[i] as VancouverArtworkRecord;
      
      // Check required fields
      if (!record.title_of_work) {
        errors.push({
          field: `record[${i}].title_of_work`,
          message: `Record ${i}: Missing required field 'title_of_work'`,
          severity: 'error'
        });
      }
      
      if (!record.geo_point_2d || typeof record.geo_point_2d.lat !== 'number' || typeof record.geo_point_2d.lon !== 'number') {
        errors.push({
          field: `record[${i}].geo_point_2d`,
          message: `Record ${i}: Missing or invalid geo_point_2d coordinates`,
          severity: 'error'
        });
      }

      // Check coordinate validity
      if (record.geo_point_2d) {
        const { lat, lon } = record.geo_point_2d;
        if (lat < -90 || lat > 90) {
          errors.push({
            field: `record[${i}].geo_point_2d.lat`,
            message: `Record ${i}: Invalid latitude ${lat}`,
            severity: 'error'
          });
        }
        if (lon < -180 || lon > 180) {
          errors.push({
            field: `record[${i}].geo_point_2d.lon`,
            message: `Record ${i}: Invalid longitude ${lon}`,
            severity: 'error'
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate unique import ID for record
   */
  generateImportId(record: unknown): string {
    const artworkRecord = record as VancouverArtworkRecord;
    // Create deterministic ID based on title and coordinates
    const title = artworkRecord.title_of_work?.replace(/\s+/g, '-').toLowerCase() || 'untitled';
    const lat = artworkRecord.geo_point_2d?.lat?.toFixed(6) || '0';
    const lon = artworkRecord.geo_point_2d?.lon?.toFixed(6) || '0';
    return `vancouver-public-art-${title}-${lat}-${lon}`;
  }

  /**
   * Get default data path for this importer
   */
  getDefaultDataPath(): string {
    return './tasks/public-art.json';
  }

  // ================================
  // Private Helper Methods
  // ================================

  /**
   * Extract photos from Vancouver photourl field
   */
  private extractPhotos(record: VancouverArtworkRecord): PhotoInfo[] {
    const photos: PhotoInfo[] = [];

    // Check if photourl exists and has a URL
    if (record.photourl?.url) {
      const photoInfo: PhotoInfo = {
        url: record.photourl.url,
        filename: record.photourl.filename || undefined,
        credit: record.photocredits || undefined,
      };

      // Add caption if we can derive one from the title or description
      if (record.title_of_work) {
        photoInfo.caption = `Photo of "${record.title_of_work}"`;
      }

      photos.push(photoInfo);
    }

    return photos;
  }

  /**
   * Map a single artwork record to standardized format
   */
  private async mapSingleRecord(record: VancouverArtworkRecord, config: VancouverPublicArtConfig): Promise<RawImportData> {
    // Extract coordinates
    const coordinates = this.extractCoordinates(record, config.fieldMappings.coordinates);
    
    // Build description from artist project statement
    const description = this.buildDescription(record);
    
    // Get artist names from IDs
    const artistNames = this.lookupArtistNames(record.artists);
    
    // Build comprehensive tags
    const tags = await this.buildComprehensiveTags(record, config.tagMappings);

    // Extract photos from photourl field
    const photos = this.extractPhotos(record);

    // Map core fields
    const mappedRecord: RawImportData = {
      lat: coordinates.lat,
      lon: coordinates.lon,
      title: record.title_of_work || 'Untitled',
      description,
      artist: artistNames.join(', '), // Add artist field at top level
      source: 'vancouver-public-art',
      externalId: this.generateImportId(record),
      tags,
      photos,
    };

    return mappedRecord;
  }

  /**
   * Load artist lookup data from the artists JSON file
   */
  private async loadArtistLookup(): Promise<void> {
    if (this.artistLookup.size > 0) {
      return; // Already loaded
    }

    try {
      // Try multiple possible paths for the artist lookup file
      const possiblePaths = [
        path.resolve('src/lib/mass-import-system/importers/public-art-artists.json'),
        path.resolve('./importers/public-art-artists.json'),
        path.join(process.cwd(), 'src/lib/mass-import-system/importers/public-art-artists.json'),
        path.join(process.cwd(), 'importers/public-art-artists.json')
      ];

      let artistsData: string | null = null;
      for (const artistsFilePath of possiblePaths) {
        try {
          artistsData = await fs.readFile(artistsFilePath, 'utf-8');
          console.log(`📋 Loaded artist lookup from: ${artistsFilePath}`);
          break;
        } catch (error) {
          // Try next path
          continue;
        }
      }

      if (!artistsData) {
        console.warn('⚠️ Could not find artist lookup file, artist IDs will not be resolved to names');
        return;
      }

      const artists = JSON.parse(artistsData) as VancouverArtistRecord[];
      
      // Build lookup map
      for (const artist of artists) {
        this.artistLookup.set(String(artist.artistid), artist);
      }
      
      console.log(`📋 Loaded ${this.artistLookup.size} artists into lookup table`);
    } catch (error) {
      console.warn('Failed to load artist lookup data:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Build description from artist project statement and metadata
   */
  private buildDescription(record: VancouverArtworkRecord): string {
    const parts: string[] = [];
    
    // Add artist project statement if available
    if (record.artistprojectstatement) {
      // Clean up the statement - remove extra quotes and normalize
      let statement = record.artistprojectstatement.trim();
      if (statement.startsWith('"') && statement.endsWith('"')) {
        statement = statement.slice(1, -1);
      }
      parts.push(`**Artist Project Statement**: ${statement}`);
    }
    
    // Add description of work if available and different from statement
    if (record.descriptionofwork && record.descriptionofwork !== record.artistprojectstatement) {
      parts.push(`**Description**: ${record.descriptionofwork}`);
    }
    
    // Add import source attribution
    if (record.registryid) {
      parts.push(`\nImported from Vancouver Open Data (registryid: ${record.registryid})`);
    }
    
    return parts.join('\n\n');
  }

  /**
   * Look up artist names from artist IDs
   */
  private lookupArtistNames(artistIds: string[] | string | undefined): string[] {
    if (!artistIds) {
      return [];
    }
    
    // Handle case where artistIds might be a string or not an array
    let idsArray: string[];
    if (typeof artistIds === 'string') {
      idsArray = [artistIds];
    } else if (Array.isArray(artistIds)) {
      idsArray = artistIds;
    } else {
      console.warn('artistIds is not an array or string:', typeof artistIds, artistIds);
      return [];
    }
    
    const names: string[] = [];
    
    for (const artistId of idsArray) {
      const artist = this.artistLookup.get(String(artistId));
      if (artist) {
        const fullName = `${artist.firstname} ${artist.lastname}`.trim();
        names.push(fullName);
      } else {
        console.warn(`Artist ID ${artistId} not found in lookup table`);
        names.push(`Artist ID ${artistId}`);
      }
    }
    
    return names;
  }

  /**
   * Build comprehensive tags including all relevant metadata
   */
  private async buildComprehensiveTags(record: VancouverArtworkRecord, tagMappings: Record<string, string | TagMapping>): Promise<Record<string, string>> {
    const tags: Record<string, string> = {};

    // Add core mapped tags
    const basicTags = await this.buildTags(record, tagMappings);
    Object.assign(tags, basicTags);

    // Add comprehensive metadata tags
    if (record.registryid) tags.registryid = String(record.registryid);
    if (record.type) tags.type = record.type;
    if (record.status) tags.status = record.status;
    if (record.sitename) tags.sitename = record.sitename;
    if (record.siteaddress) tags.siteaddress = record.siteaddress;
    if (record.ownership) tags.ownership = record.ownership;
    if (record.neighbourhood) tags.neighbourhood = record.neighbourhood;
    if (record.yearofinstallation) tags.yearofinstallation = record.yearofinstallation;
    if (record.primarymaterial) tags.primarymaterial = record.primarymaterial;

    // Add raw artist IDs as well for reference
    if (record.artists) {
      if (Array.isArray(record.artists)) {
        tags.artist_ids = record.artists.join(',');
      } else if (typeof record.artists === 'string') {
        tags.artist_ids = record.artists;
      }
    }

    // Add artwork type indicator
    tags.content_type = 'artwork';

    return tags;
  }

  /**
   * Extract coordinates from record using field mapping
   */
  private extractCoordinates(record: VancouverArtworkRecord, coordinateMapping: { lat: string; lon: string }): { lat: number; lon: number } {
    const lat = this.getNestedFieldValue(record, coordinateMapping.lat) as number;
    const lon = this.getNestedFieldValue(record, coordinateMapping.lon) as number;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new Error(`Invalid coordinates in record: lat=${lat}, lon=${lon}`);
    }

    return { lat, lon };
  }

  /**
   * Build tags object using configured tag mappings
   */
  private async buildTags(record: VancouverArtworkRecord, tagMappings: Record<string, string | TagMapping>): Promise<Record<string, string>> {
    const tags: Record<string, string> = {};

    // Process each tag mapping
    for (const [tagName, mapping] of Object.entries(tagMappings)) {
      try {
        let value: string;

        if (typeof mapping === 'string') {
          // Simple field mapping
          value = this.getFieldValue(record, mapping) || '';
        } else if (typeof mapping === 'object' && mapping.source_field) {
          // Complex mapping with transformation
          const rawValue = this.getFieldValue(record, mapping.source_field);
          const transform = mapping.transform || mapping.validation || 'none';
          value = this.applyTransformation(rawValue, transform);
        } else {
          // Static value
          value = String(mapping);
        }

        if (value) {
          tags[tagName] = value;
        }
      } catch (error) {
        console.warn(`Failed to map tag '${tagName}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return tags;
  }

  /**
   * Get field value using dot notation path
   */
  private getFieldValue(record: VancouverArtworkRecord, fieldPath: string): string {
    return String(this.getNestedFieldValue(record, fieldPath) || '');
  }

  /**
   * Get nested field value using dot notation
   */
  private getNestedFieldValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' && key in current 
        ? (current as Record<string, unknown>)[key] 
        : undefined;
    }, obj);
  }

  /**
   * Apply data transformation based on transform type
   */
  private applyTransformation(value: unknown, transform: string): string {
    if (!value) return '';

    const stringValue = String(value);

    switch (transform) {
      case 'lowercase_with_underscores':
        return stringValue.toLowerCase().replace(/\s+/g, '_');
      
      case 'array_to_comma_separated':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return stringValue;
      
      case 'year_format':
        // Extract year from various date formats
        const yearMatch = stringValue.match(/\d{4}/);
        return yearMatch ? yearMatch[0] : '';
      
      case 'normalize_neighbourhood':
        return stringValue.trim().replace(/\s+/g, ' ');
      
      case 'none':
      default:
        return stringValue;
    }
  }
}

// ================================
// Plugin Export
// ================================

// Export the plugin instance
export const vancouverPublicArtImporter = new VancouverPublicArtImporter();