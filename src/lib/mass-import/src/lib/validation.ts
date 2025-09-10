/**
 * Mass Import System - Data Validation and Transformation
 * 
 * This module handles validation and transformation of raw import data
 * using the structured tag system and coordinate bounds checking.
 */

// Note: These imports would need to be resolved in the actual implementation
// For now, we'll mock the tag validation functionality
// import { validateTags } from '@cultural-archiver/shared/tag-validation';
// import type { StructuredTags } from '@cultural-archiver/shared/tag-schema';
import type {
  RawImportData,
  ProcessedImportData,
  ValidationResult,
  ValidationError,
  MassImportConfig,
} from '../types';

// ================================
// Constants
// ================================

// Mass Import User UUID for attribution
export const MASS_IMPORT_USER_TOKEN = '00000000-0000-0000-0000-000000000002';

// Vancouver coordinate bounds for validation
export const VANCOUVER_BOUNDS = {
  north: 49.31,
  south: 49.20,
  west: -123.25,
  east: -123.02,
};

// ================================
// Core Validation Functions
// ================================

/**
 * Validate and transform raw import data into processable format
 */
export function validateImportData(
  rawData: RawImportData,
  config: MassImportConfig
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validate coordinates
  const coordValidation = validateCoordinates(rawData.lat, rawData.lon, config);
  errors.push(...coordValidation.errors);
  warnings.push(...coordValidation.warnings);

  // Validate and transform tags
  const tagValidation = validateAndTransformTags(rawData);
  errors.push(...tagValidation.errors);
  warnings.push(...tagValidation.warnings);

  // Validate photos
  const photoValidation = validatePhotos(rawData.photos?.map(p => {
    const photo: { url: string; caption?: string; credit?: string } = {
      url: p.url,
    };
    if (p.caption) photo.caption = p.caption;
    if (p.credit) photo.credit = p.credit;
    return photo;
  }) || []);
  errors.push(...photoValidation.errors);
  warnings.push(...photoValidation.warnings);

  // Check for required fields
  const requiredValidation = validateRequiredFields(rawData);
  errors.push(...requiredValidation.errors);
  warnings.push(...requiredValidation.warnings);

  const isValid = errors.length === 0;

  if (!isValid) {
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Transform to processed format
  const processedData = transformToProcessedData(rawData, tagValidation.tags!);

  return {
    isValid: true,
    errors,
    warnings,
    data: processedData,
  };
}

/**
 * Validate coordinate bounds and precision
 */
function validateCoordinates(
  lat: number,
  lon: number,
  config: MassImportConfig
): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Basic coordinate validation (already handled by Zod schema)
  if (lat < -90 || lat > 90) {
    errors.push({
      field: 'lat',
      message: `Latitude ${lat} is outside valid range (-90 to 90)`,
      severity: 'error',
      code: 'INVALID_LATITUDE',
    });
  }

  if (lon < -180 || lon > 180) {
    errors.push({
      field: 'lon',
      message: `Longitude ${lon} is outside valid range (-180 to 180)`,
      severity: 'error',
      code: 'INVALID_LONGITUDE',
    });
  }

  // Check if coordinates are in Vancouver (warning for Vancouver imports)
  if (config.apiEndpoint.includes('vancouver') || config.apiEndpoint.includes('van')) {
    if (!isWithinVancouverBounds(lat, lon)) {
      warnings.push({
        field: 'coordinates',
        message: `Coordinates (${lat}, ${lon}) appear to be outside Vancouver metropolitan area`,
        severity: 'warning',
        code: 'OUTSIDE_EXPECTED_BOUNDS',
      });
    }
  }

  // Check for suspicious precision (too many decimal places might indicate data quality issues)
  const latPrecision = countDecimalPlaces(lat);
  const lonPrecision = countDecimalPlaces(lon);
  
  if (latPrecision > 8 || lonPrecision > 8) {
    warnings.push({
      field: 'coordinates',
      message: `Coordinates have unusually high precision (${latPrecision}, ${lonPrecision} decimal places)`,
      severity: 'warning',
      code: 'HIGH_PRECISION_COORDINATES',
    });
  }

  return { errors, warnings };
}

/**
 * Validate and transform tags using the structured tag system
 */
function validateAndTransformTags(rawData: RawImportData): {
  errors: ValidationError[];
  warnings: ValidationError[];
  tags?: Record<string, string | number | boolean>;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Start with provided tags or empty object
  const tags: Record<string, string | number | boolean> = rawData.tags || {};

  // Map standard fields to structured tags
  mapStandardFieldsToTags(rawData, tags);

  // Add attribution tags
  addAttributionTags(rawData, tags);

  try {
    // Validate using a mock tag validation for now
    // In the actual implementation, this would use the existing tag validation system
    const mockValidation = mockValidateTags(tags);
    
    if (!mockValidation.valid) {
      mockValidation.errors.forEach(error => {
        errors.push({
          field: 'tags',
          message: error,
          severity: 'error',
          code: 'TAG_VALIDATION_ERROR',
        });
      });
    }

    return { errors, warnings, tags };
  } catch (error) {
    errors.push({
      field: 'tags',
      message: `Tag validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
      code: 'TAG_VALIDATION_EXCEPTION',
    });

    return { errors, warnings };
  }
}

/**
 * Map standard raw data fields to structured tags
 */
function mapStandardFieldsToTags(
  rawData: RawImportData,
  tags: Record<string, string | number | boolean>
): void {
  // Physical properties
  if (rawData.material && !tags.material) {
    tags.material = rawData.material.toLowerCase();
  }

  // Artwork classification
  if (rawData.type && !tags.artwork_type) {
    tags.artwork_type = mapArtworkType(rawData.type);
  }

  // Historical information
  if (rawData.yearOfInstallation && !tags.start_date) {
    tags.start_date = rawData.yearOfInstallation;
  }

  if ((rawData.artist || rawData.created_by) && !tags.artist) {
    const artist = rawData.artist || rawData.created_by;
    if (artist) {
      tags.artist = artist;
    }
  }

  // Location details
  if (rawData.address && !tags.addr_full) {
    tags.addr_full = rawData.address;
  }
}

/**
 * Add attribution and source tracking tags
 */
function addAttributionTags(
  rawData: RawImportData,
  tags: Record<string, string | number | boolean>
): void {
  // Data source attribution
  tags.source = rawData.source;
  
  if (rawData.sourceUrl) {
    tags.source_url = rawData.sourceUrl;
  }

  if (rawData.externalId) {
    tags.external_id = rawData.externalId;
  }

  if (rawData.license) {
    tags.license = rawData.license;
  }

  // Import metadata
  const importDate = new Date().toISOString().split('T')[0];
  if (importDate) {
    tags.import_date = importDate;
  }
  tags.import_method = 'mass_import';
}

/**
 * Map artwork types to standardized values
 */
function mapArtworkType(type: string): string {
  const normalized = type.toLowerCase().trim();
  
  const typeMap: Record<string, string> = {
    'sculpture': 'sculpture',
    'mural': 'mural',
    'installation': 'installation',
    'monument': 'monument',
    'statue': 'sculpture',
    'fountain': 'fountain',
    'mosaic': 'mosaic',
    'relief': 'relief',
    'painting': 'painting',
    'mixed media': 'mixed_media',
    'public art': 'public_art',
  };

  return typeMap[normalized] || normalized;
}

/**
 * Validate photo information
 */
function validatePhotos(photos: Array<{ url: string; caption?: string; credit?: string }>): {
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  photos.forEach((photo, index) => {
    // Validate URL format (basic check - more detailed validation would be done during actual fetching)
    try {
      new URL(photo.url);
    } catch {
      errors.push({
        field: `photos[${index}].url`,
        message: `Invalid photo URL: ${photo.url}`,
        severity: 'error',
        code: 'INVALID_PHOTO_URL',
      });
    }

    // Check for common image file extensions
    const url = photo.url.toLowerCase();
    const hasImageExtension = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => 
      url.includes(ext)
    );
    
    if (!hasImageExtension && !url.includes('image') && !url.includes('photo')) {
      warnings.push({
        field: `photos[${index}].url`,
        message: `Photo URL doesn't appear to point to an image file: ${photo.url}`,
        severity: 'warning',
        code: 'SUSPICIOUS_PHOTO_URL',
      });
    }
  });

  return { errors, warnings };
}

/**
 * Validate required fields
 */
function validateRequiredFields(rawData: RawImportData): {
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Title is required and should be meaningful
  if (!rawData.title || rawData.title.trim().length < 2) {
    errors.push({
      field: 'title',
      message: 'Title is required and must be at least 2 characters long',
      severity: 'error',
      code: 'MISSING_TITLE',
    });
  }

  // Source is required for attribution
  if (!rawData.source || rawData.source.trim().length === 0) {
    errors.push({
      field: 'source',
      message: 'Source is required for proper attribution',
      severity: 'error',
      code: 'MISSING_SOURCE',
    });
  }

  // Warn about missing artist information
  if (!rawData.artist && !rawData.created_by) {
    warnings.push({
      field: 'artist',
      message: 'No artist information provided',
      severity: 'warning',
      code: 'MISSING_ARTIST',
    });
  }

  // Warn about missing description
  if (!rawData.description || rawData.description.trim().length < 10) {
    warnings.push({
      field: 'description',
      message: 'Description is missing or very short',
      severity: 'warning',
      code: 'SHORT_DESCRIPTION',
    });
  }

  return { errors, warnings };
}

/**
 * Transform validated raw data into processed format
 */
function transformToProcessedData(
  rawData: RawImportData,
  tags: Record<string, string | number | boolean>
): ProcessedImportData {
  // Build note field from description and address (not title - title goes in separate field)
  const noteParts: string[] = [];
  
  if (rawData.description) {
    noteParts.push(`Description: ${rawData.description}`);
  }
  
  if (rawData.address) {
    noteParts.push(`Address: ${rawData.address}`);
  }

  const note = noteParts.join('\n\n');

  // Include title and description in tags for approval process
  const enhancedTags = { ...tags };
  if (rawData.title) {
    enhancedTags.title = rawData.title;
  }
  if (rawData.description) {
    enhancedTags.description = rawData.description;
  }
  if (rawData.artist || rawData.created_by) {
    enhancedTags.artist = rawData.artist || rawData.created_by || '';
  }

  const result: ProcessedImportData = {
    lat: rawData.lat,
    lon: rawData.lon,
    title: rawData.title || 'Untitled Artwork',
    note: note,
    tags: enhancedTags,
    photos: rawData.photos || [],
    source: rawData.source,
    importBatchId: generateBatchId(),
    importTimestamp: new Date().toISOString(),
  };

  if (rawData.sourceUrl) {
    result.sourceUrl = rawData.sourceUrl;
  }

  if (rawData.externalId) {
    result.externalId = rawData.externalId;
  }

  return result;
}

// ================================
// Helper Functions
// ================================

/**
 * Check if coordinates are within Vancouver bounds
 */
function isWithinVancouverBounds(lat: number, lon: number): boolean {
  return (
    lat >= VANCOUVER_BOUNDS.south &&
    lat <= VANCOUVER_BOUNDS.north &&
    lon >= VANCOUVER_BOUNDS.west &&
    lon <= VANCOUVER_BOUNDS.east
  );
}

/**
 * Count decimal places in a number
 */
function countDecimalPlaces(value: number): number {
  const str = value.toString();
  const decimalIndex = str.indexOf('.');
  return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
}

/**
 * Generate a unique batch ID
 */
function generateBatchId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `batch_${timestamp}_${random}`;
}

/**
 * Mock tag validation for development
 * In production, this would use the actual tag validation system
 */
function mockValidateTags(tags: Record<string, string | number | boolean>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Basic validation - check for obviously invalid values
  for (const [key, value] of Object.entries(tags)) {
    if (value === null || value === undefined || value === '') {
      errors.push(`Tag '${key}' has empty value`);
    }
    
    if (typeof value === 'string' && value.length > 1000) {
      errors.push(`Tag '${key}' value is too long (max 1000 characters)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}