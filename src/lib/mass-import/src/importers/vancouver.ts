/**
 * Mass Import System - Vancouver Open Data Mapper
 * 
 * This module handles mapping Vancouver Public Art dataset to the internal format,
 * including field transformation, coordinate validation, and structured tag application.
 */

import type {
  VancouverArtworkData,
  RawImportData,
  ValidationResult,
  DataSourceMapper,
  PhotoInfo,
} from '../types';
import { validateImportData, VANCOUVER_BOUNDS } from '../lib/validation';

// ================================
// Vancouver Data Mapper
// ================================

export const VancouverMapper: DataSourceMapper = {
  name: 'Vancouver Open Data',
  version: '1.0.0',

  /**
   * Map Vancouver artwork data to internal format
   */
  mapData(rawData: VancouverArtworkData): ValidationResult {
    try {
      // Transform Vancouver data to RawImportData format
      const mappedData = mapVancouverToRawData(rawData);
      
      // Use the standard validation with Vancouver-specific config
      const config = {
        apiEndpoint: 'https://art-api.abluestar.com',
        massImportUserToken: '00000000-0000-0000-0000-000000000002',
        batchSize: 50,
        maxRetries: 3,
        retryDelay: 1000,
        duplicateDetectionRadius: 50, // 50m for dense urban environment
        titleSimilarityThreshold: 0.8,
        dryRun: false,
      };

      return validateImportData(mappedData, config);
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'mapping',
          message: `Failed to map Vancouver data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
          code: 'MAPPING_ERROR',
        }],
        warnings: [],
      };
    }
  },

  /**
   * Validate that coordinates are within Vancouver bounds
   */
  validateBounds(lat: number, lon: number): boolean {
    return (
      lat >= VANCOUVER_BOUNDS.south &&
      lat <= VANCOUVER_BOUNDS.north &&
      lon >= VANCOUVER_BOUNDS.west &&
      lon <= VANCOUVER_BOUNDS.east
    );
  },

  /**
   * Generate import ID from Vancouver registry ID
   */
  generateImportId(data: VancouverArtworkData): string {
    return `vancouver_${data.registryid}`;
  },
};

// ================================
// Data Transformation Functions
// ================================

/**
 * Transform Vancouver artwork data to RawImportData format
 */
function mapVancouverToRawData(data: VancouverArtworkData): RawImportData {
  // Extract coordinates
  const lat = data.geo_point_2d.lat;
  const lon = data.geo_point_2d.lon;

  // Build title (required field)
  let title = data.title_of_work || 'Untitled Artwork';
  if (title.length > 200) {
    title = title.substring(0, 197) + '...';
  }

  // Build description from available fields
  const descriptionParts: string[] = [];
  
  if (data.descriptionofwork) {
    descriptionParts.push(data.descriptionofwork);
  }
  
  if (data.artistprojectstatement) {
    descriptionParts.push(`Artist Statement: ${data.artistprojectstatement}`);
  }

  const description = descriptionParts.join('\n\n');

  // Extract artist information
  const artist = extractArtistName(data);

  // Build address from site information
  const address = buildAddress(data);

  // Process photo information
  const photos = extractPhotoInfo(data);

  // Build structured tags
  const tags = buildStructuredTags(data);

  return {
    lat,
    lon,
    title,
    description: description.length > 1000 ? description.substring(0, 997) + '...' : description,
    artist,
    yearOfInstallation: data.yearofinstallation,
    material: data.primarymaterial,
    type: data.type,
    address,
    neighborhood: data.neighbourhood || data.geo_local_area,
    siteName: data.sitename,
    photos,
    source: 'vancouver-opendata',
    sourceUrl: data.url,
    externalId: data.registryid.toString(),
    license: 'Open Government Licence – Vancouver',
    tags,
    status: mapVancouverStatus(data.status),
  };
}

/**
 * Extract artist name from Vancouver data
 */
function extractArtistName(data: VancouverArtworkData): string | undefined {
  // Vancouver has artist IDs in an array, but we don't have the mapping
  // For now, we'll need to extract from other fields or use placeholder
  
  // Check if artist info is embedded in statement or description
  if (data.artistprojectstatement) {
    const artistMatch = data.artistprojectstatement.match(/Artist:?\s*([^,\n]+)/i);
    if (artistMatch && artistMatch[1]) {
      return artistMatch[1].trim();
    }
  }

  // For now, return undefined - this would need artist mapping table
  return data.artists && data.artists.length > 0 
    ? `Artist ID: ${data.artists.join(', ')}` 
    : undefined;
}

/**
 * Build address string from Vancouver location data
 */
function buildAddress(data: VancouverArtworkData): string | undefined {
  const addressParts: string[] = [];

  if (data.siteaddress) {
    addressParts.push(data.siteaddress);
  }

  if (data.sitename && data.sitename !== data.siteaddress) {
    addressParts.push(data.sitename);
  }

  if (data.neighbourhood) {
    addressParts.push(data.neighbourhood);
  }

  addressParts.push('Vancouver, BC, Canada');

  return addressParts.length > 1 ? addressParts.join(', ') : undefined;
}

/**
 * Extract photo information from Vancouver data
 */
function extractPhotoInfo(data: VancouverArtworkData): PhotoInfo[] {
  const photos: PhotoInfo[] = [];

  if (data.photourl && data.photourl.url) {
    photos.push({
      url: data.photourl.url,
      caption: `Photo of ${data.title_of_work}`,
      credit: data.photocredits,
      filename: data.photourl.filename,
    });
  }

  return photos;
}

/**
 * Build structured tags from Vancouver data
 */
function buildStructuredTags(data: VancouverArtworkData): Record<string, string | number | boolean> {
  const tags: Record<string, string | number | boolean> = {};

  // Physical properties
  if (data.primarymaterial) {
    tags.material = normalizeMaterial(data.primarymaterial);
  }

  // Artwork classification
  if (data.type) {
    tags.artwork_type = normalizeArtworkType(data.type);
  }

  // Historical information
  if (data.yearofinstallation) {
    tags.start_date = data.yearofinstallation;
  }

  // Location details
  if (data.ownership) {
    tags.operator = data.ownership;
  }

  if (data.locationonsite) {
    tags.location = data.locationonsite;
  }

  // Vancouver-specific tags
  const neighbourhood = data.neighbourhood || data.geo_local_area;
  if (neighbourhood) {
    tags.neighbourhood = neighbourhood;
  }
  tags.registry_id = data.registryid.toString();

  // Status mapping
  if (data.status) {
    tags.condition = normalizeCondition(data.status);
  }

  return tags;
}

/**
 * Map Vancouver status to artwork condition
 */
function mapVancouverStatus(status: string): 'active' | 'inactive' | 'removed' | 'unknown' {
  const normalized = status.toLowerCase().trim();
  
  const statusMap: Record<string, 'active' | 'inactive' | 'removed' | 'unknown'> = {
    'in place': 'active',
    'installed': 'active',
    'active': 'active',
    'removed': 'removed',
    'demolished': 'removed',
    'relocated': 'inactive',
    'in storage': 'inactive',
    'unknown': 'unknown',
  };

  return statusMap[normalized] || 'unknown';
}

/**
 * Normalize material names to standard values
 */
function normalizeMaterial(material: string): string {
  const normalized = material.toLowerCase().trim();
  
  // Handle common Vancouver material patterns
  const materialMap: Record<string, string> = {
    'stainless steel': 'steel',
    'mild steel': 'steel',
    'corten steel': 'steel',
    'weathering steel': 'steel',
    'bronze': 'bronze',
    'aluminum': 'aluminium',
    'aluminium': 'aluminium',
    'concrete': 'concrete',
    'stone': 'stone',
    'granite': 'stone',
    'marble': 'stone',
    'wood': 'wood',
    'cedar': 'wood',
    'glass': 'glass',
    'ceramic': 'ceramic',
    'fiberglass': 'plastic',
    'fibreglass': 'plastic',
  };

  // Check for direct matches
  for (const [key, value] of Object.entries(materialMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  // Handle compound materials (take first recognized material)
  const parts = normalized.split(/[,;\/\s]+/);
  for (const part of parts) {
    const trimmedPart = part.trim();
    if (materialMap[trimmedPart]) {
      return materialMap[trimmedPart];
    }
  }

  // Return normalized original if no mapping found
  return normalized;
}

/**
 * Normalize artwork type to standard values
 */
function normalizeArtworkType(type: string): string {
  const normalized = type.toLowerCase().trim();
  
  const typeMap: Record<string, string> = {
    'sculpture': 'sculpture',
    'statue': 'sculpture',
    'fountain': 'fountain',
    'mural': 'mural',
    'wall mural': 'mural',
    'mosaic': 'mosaic',
    'installation': 'installation',
    'public art installation': 'installation',
    'monument': 'monument',
    'memorial': 'monument',
    'relief': 'relief',
    'bas-relief': 'relief',
    'painting': 'painting',
    'mixed media': 'mixed_media',
    'public art': 'public_art',
  };

  return typeMap[normalized] || normalized;
}

/**
 * Normalize condition status
 */
function normalizeCondition(status: string): string {
  const normalized = status.toLowerCase().trim();
  
  const conditionMap: Record<string, string> = {
    'in place': 'good',
    'installed': 'good',
    'good': 'good',
    'fair': 'fair',
    'poor': 'poor',
    'removed': 'removed',
    'demolished': 'removed',
    'relocated': 'unknown',
    'in storage': 'unknown',
  };

  return conditionMap[normalized] || 'unknown';
}

// ================================
// Validation Helpers
// ================================

/**
 * Validate Vancouver-specific data quality
 */
export function validateVancouverData(data: VancouverArtworkData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!data.registryid) {
    errors.push('Missing registry ID');
  }

  if (!data.title_of_work || data.title_of_work.trim().length === 0) {
    errors.push('Missing or empty title');
  }

  if (!data.geo_point_2d || !data.geo_point_2d.lat || !data.geo_point_2d.lon) {
    errors.push('Missing or invalid coordinates');
  }

  // Coordinate bounds validation
  if (data.geo_point_2d && data.geo_point_2d.lat && data.geo_point_2d.lon) {
    if (!VancouverMapper.validateBounds!(data.geo_point_2d.lat, data.geo_point_2d.lon)) {
      warnings.push('Coordinates appear to be outside Vancouver bounds');
    }
  }

  // Data quality checks
  if (!data.descriptionofwork && !data.artistprojectstatement) {
    warnings.push('No description or artist statement provided');
  }

  if (!data.primarymaterial) {
    warnings.push('No material information provided');
  }

  if (!data.yearofinstallation) {
    warnings.push('No installation year provided');
  }

  if (!data.photourl || !data.photourl.url) {
    warnings.push('No photo URL provided');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}