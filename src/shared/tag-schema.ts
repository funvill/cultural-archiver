/**
 * Artwork Variable Tagging System - Tag Schema Definition
 * 
 * This module defines the structured tag schema for artwork metadata,
 * including validation rules, categories, and OpenStreetMap compatibility.
 */

// ================================
// Core Tag Schema Types
// ================================

// Prefix used for internal/system-only tag keys that should never be user-editable
// or pass through validation/output (e.g. _photos). These are stripped server-side.
export const INTERNAL_TAG_PREFIX = '_';

export type TagDataType = 'enum' | 'text' | 'number' | 'date' | 'yes_no' | 'url' | 'wikidata_id';

export interface TagDefinition {
  key: string;
  label: string;
  description: string;
  category: TagCategory;
  dataType: TagDataType;
  required: boolean;
  enumValues?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    maxLength?: number;
  };
  osmMapping?: string; // OpenStreetMap key mapping
  helpUrl?: string; // Link to OpenStreetMap wiki or documentation
  examples?: string[];
}

export type TagCategory = 
  | 'physical_properties'
  | 'historical_info' 
  | 'location_details'
  | 'artwork_classification'
  | 'reference_data';

export interface CategoryInfo {
  key: TagCategory;
  label: string;
  description: string;
  icon?: string;
  displayOrder: number;
}

export interface StructuredTags {
  [key: string]: string | number | boolean;
}

export interface TagValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TagSchemaVersion {
  version: string;
  releaseDate: string;
  changes: string[];
}

// ================================
// Tag Categories Definition
// ================================

export const TAG_CATEGORIES: Record<TagCategory, CategoryInfo> = {
  physical_properties: {
    key: 'physical_properties',
    label: 'Physical Properties',
    description: 'Material composition, dimensions, and physical condition',
    icon: 'cube',
    displayOrder: 1,
  },
  historical_info: {
    key: 'historical_info', 
    label: 'Historical Information',
    description: 'Creation date, artist information, and historical context',
    icon: 'calendar',
    displayOrder: 2,
  },
  location_details: {
    key: 'location_details',
    label: 'Location Details', 
    description: 'Access information, fees, and location-specific attributes',
    icon: 'map-pin',
    displayOrder: 3,
  },
  artwork_classification: {
    key: 'artwork_classification',
    label: 'Artwork Classification',
    description: 'Type, style, subject matter, and descriptive information',
    icon: 'tag',
    displayOrder: 4,
  },
  reference_data: {
    key: 'reference_data',
    label: 'Reference Data',
    description: 'External links, documentation, and additional resources',
    icon: 'external-link',
    displayOrder: 5,
  },
};

// ================================
// Core Tag Definitions (15 Essential Tags)
// ================================

export const TAG_DEFINITIONS: Record<string, TagDefinition> = {
  // Artwork Classification
  artwork_type: {
    key: 'artwork_type',
    label: 'Artwork Type',
    description: 'Specific type or form of the artwork',
    category: 'artwork_classification',
    dataType: 'enum',
    required: false,
    enumValues: ['statue', 'mural', 'sculpture', 'installation', 'monument', 'mosaic', 'graffiti', 'street_art', 'tiny_library'],
    osmMapping: 'artwork_type',
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:artwork_type',
    examples: ['statue', 'mural', 'sculpture', 'tiny_library'],
  },

  subject: {
    key: 'subject',
    label: 'Subject Matter',
    description: 'Theme or subject depicted in the artwork',
    category: 'artwork_classification',
    dataType: 'text',
    required: false,
    validation: {
      maxLength: 200,
    },
    osmMapping: 'subject',
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:subject',
    examples: ['historical figure', 'abstract', 'nature', 'animals'],
  },

  style: {
    key: 'style',
    label: 'Artistic Style',
    description: 'Artistic style or movement',
    category: 'artwork_classification',
    dataType: 'text',
    required: false,
    validation: {
      maxLength: 100,
    },
    osmMapping: 'style',
    examples: ['modern', 'classical', 'contemporary', 'street art', 'abstract'],
  },

  // Historical Information
  start_date: {
    key: 'start_date',
    label: 'Installation Date',
    description: 'Date when the artwork was created or installed (YYYY, YYYY-MM, or YYYY-MM-DD)',
    category: 'historical_info',
    dataType: 'date',
    required: false,
    validation: {
      pattern: '^\\d{4}(-\\d{2}(-\\d{2})?)?$',
    },
    osmMapping: 'start_date',
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:start_date',
    examples: ['1998', '2011-07', '2011-07-15'],
  },

  // Physical Properties  
  material: {
    key: 'material',
    label: 'Material',
    description: 'Primary construction material',
    category: 'physical_properties',
    dataType: 'text',
    required: false,
    validation: {
      maxLength: 200,
    },
    osmMapping: 'material',
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:material',
    examples: ['bronze', 'concrete', 'paint on wall', 'steel', 'stone'],
  },

  height: {
    key: 'height',
    label: 'Height (meters)',
    description: 'Height of the artwork in meters',
    category: 'physical_properties',
    dataType: 'number',
    required: false,
    validation: {
      min: 0.1,
      max: 200,
    },
    osmMapping: 'height',
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:height',
    examples: ['2.4', '15.5', '0.8'],
  },

  condition: {
    key: 'condition',
    label: 'Condition',
    description: 'Current physical condition of the artwork',
    category: 'physical_properties',
    dataType: 'enum',
    required: false,
    enumValues: ['excellent', 'good', 'fair', 'poor', 'damaged'],
    osmMapping: 'condition',
    examples: ['excellent', 'good', 'fair'],
  },

  // Location Details
  access: {
    key: 'access',
    label: 'Access',
    description: 'Public accessibility of the artwork',
    category: 'location_details',
    dataType: 'enum',
    required: false,
    enumValues: ['yes', 'private', 'customers', 'no', 'permissive'],
    osmMapping: 'access',
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:access',
    examples: ['yes', 'private', 'customers'],
  },

  fee: {
    key: 'fee',
    label: 'Admission Fee',
    description: 'Whether an admission fee is required',
    category: 'location_details',
    dataType: 'yes_no',
    required: false,
    osmMapping: 'fee',
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:fee',
    examples: ['no', 'yes'],
  },

  // Reference Data
  website: {
    key: 'website',
    label: 'Website',
    description: 'Official website or related URL',
    category: 'reference_data',
    dataType: 'url',
    required: false,
    validation: {
      pattern: '^https?:\\/\\/.+',
    },
    osmMapping: 'website',
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:website',
    examples: ['https://example.org/artwork-info'],
  },

  wikipedia: {
    key: 'wikipedia',
    label: 'Wikipedia',
    description: 'Wikipedia article reference (format: language:Article_Name)',
    category: 'reference_data',
    dataType: 'text',
    required: false,
    validation: {
      pattern: '^[a-z]{2,3}:.+',
      maxLength: 200,
    },
    osmMapping: 'wikipedia',
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:wikipedia',
    examples: ['en:Statue_of_Liberty', 'fr:Tour_Eiffel'],
  },
  // Classification helper - free-form keyword indexing
  keywords: {
    key: 'keywords',
    label: 'Keywords',
    description: 'Comma separated list of descriptive keywords used for search refinement',
    category: 'artwork_classification',
    dataType: 'text',
    required: false,
    validation: {
      maxLength: 500,
    },
    examples: ['landmark, outdoor, bronze, abstract'],
  },
};

// ================================
// Schema Version Information
// ================================

export const TAG_SCHEMA_VERSION: TagSchemaVersion = {
  version: '1.0.0',
  releaseDate: '2024-12-19',
  changes: [
    'Initial implementation of structured tag schema',
    '15 essential tags across 5 categories',
    'OpenStreetMap-compatible validation and export support',
    'Comprehensive validation framework for all data types',
  ],
};

// ================================
// Utility Functions
// ================================

/**
 * Get all tag definitions organized by category
 */
export function getTagsByCategory(): Record<TagCategory, TagDefinition[]> {
  const result: Record<TagCategory, TagDefinition[]> = {
    physical_properties: [],
    historical_info: [],
    location_details: [],
    artwork_classification: [],
    reference_data: [],
  };

  Object.values(TAG_DEFINITIONS).forEach(tag => {
    result[tag.category].push(tag);
  });

  return result;
}

/**
 * Get tag definition by key
 */
export function getTagDefinition(key: string): TagDefinition | undefined {
  return TAG_DEFINITIONS[key];
}

/**
 * Get all valid tag keys
 */
export function getValidTagKeys(): string[] {
  return Object.keys(TAG_DEFINITIONS);
}

/**
 * Get tags that are required
 */
export function getRequiredTags(): TagDefinition[] {
  return Object.values(TAG_DEFINITIONS).filter(tag => tag.required);
}

/**
 * Generate OpenStreetMap-compatible tags with "ca:" prefix
 */
export function generateOSMTags(structuredTags: StructuredTags): Record<string, string> {
  const osmTags: Record<string, string> = {};

  Object.entries(structuredTags).forEach(([key, value]) => {
    const definition = getTagDefinition(key);
    if (definition && value !== undefined && value !== null && value !== '') {
      const osmKey = definition.osmMapping || `ca:${key}`;
      osmTags[osmKey] = String(value);
    }
  });

  return osmTags;
}

/**
 * Get category information with sorted display order
 */
export function getCategoriesOrderedForDisplay(): CategoryInfo[] {
  return Object.values(TAG_CATEGORIES).sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Check if a tag key is valid
 */
export function isValidTagKey(key: string): boolean {
  return key in TAG_DEFINITIONS;
}

/**
 * Get all enum values for a specific tag
 */
export function getTagEnumValues(key: string): string[] | undefined {
  const definition = getTagDefinition(key);
  return definition?.enumValues;
}