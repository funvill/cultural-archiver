/**
 * Frontend tag schema service - provides client-side access to structured tag definitions
 * 
 * This mirrors the backend tag schema but provides it in a format optimized for frontend use.
 * Tag schema is maintained in application code and updated with releases.
 */

export interface TagDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
  dataType: 'enum' | 'text' | 'number' | 'date' | 'yes_no' | 'url' | 'wikidata_id';
  required?: boolean;
  enumValues?: string[];
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  helpUrl?: string;
}

export interface TagCategory {
  key: string;
  label: string;
  description: string;
  order: number;
}

// Tag categories organized for display
export const TAG_CATEGORIES: TagCategory[] = [
  {
    key: 'classification',
    label: 'Artwork Classification',
    description: 'Basic artwork identification and categorization',
    order: 1,
  },
  {
    key: 'physical',
    label: 'Physical Properties',
    description: 'Material, dimensions, and physical characteristics',
    order: 2,
  },
  {
    key: 'historical',
    label: 'Historical Information',
    description: 'Creation dates, artists, and historical context',
    order: 3,
  },
  {
    key: 'location',
    label: 'Location Details',
    description: 'Access information and location-specific data',
    order: 4,
  },
  {
    key: 'reference',
    label: 'Reference Data',
    description: 'External links and reference information',
    order: 5,
  },
];

// Essential 15 tags from PRD
export const TAG_DEFINITIONS: TagDefinition[] = [
  // Artwork Classification
  {
    key: 'artwork_type',
    label: 'Artwork Type',
    description: 'Primary type or form of the artwork',
    category: 'classification',
    dataType: 'enum',
    enumValues: ['statue', 'mural', 'sculpture', 'installation', 'monument', 'mosaic', 'graffiti', 'street_art', 'tiny_library'],
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:artwork_type',
  },
  {
    key: 'subject',
    label: 'Subject Matter',
    description: 'What the artwork depicts or represents',
    category: 'classification',
    dataType: 'text',
    maxLength: 200,
    placeholder: 'e.g., "historical figure", "abstract", "nature"',
  },
  {
    key: 'style',
    label: 'Artistic Style',
    description: 'Artistic style or movement',
    category: 'classification',
    dataType: 'text',
    maxLength: 100,
    placeholder: 'e.g., "modern", "classical", "street art"',
  },

  // Physical Properties
  {
    key: 'material',
    label: 'Material',
    description: 'Primary construction material',
    category: 'physical',
    dataType: 'text',
    maxLength: 100,
    placeholder: 'e.g., "bronze", "concrete", "paint on wall"',
  },
  {
    key: 'height',
    label: 'Height (meters)',
    description: 'Height in meters',
    category: 'physical',
    dataType: 'number',
    min: 0,
    max: 1000,
    placeholder: 'Height in meters (e.g., 2.4)',
  },
  {
    key: 'condition',
    label: 'Condition',
    description: 'Current physical condition',
    category: 'physical',
    dataType: 'enum',
    enumValues: ['excellent', 'good', 'fair', 'poor'],
  },

  // Historical Information
  {
    key: 'start_date',
    label: 'Installation Date',
    description: 'When the artwork was created or installed',
    category: 'historical',
    dataType: 'date',
    placeholder: 'YYYY or YYYY-MM-DD (e.g., 1998 or 2011-07-15)',
  },

  // Location Details
  {
    key: 'access',
    label: 'Public Access',
    description: 'Whether the public can access this artwork',
    category: 'location',
    dataType: 'enum',
    enumValues: ['yes', 'private', 'customers', 'no'],
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:access',
  },
  {
    key: 'fee',
    label: 'Fee Required',
    description: 'Whether an admission fee is required',
    category: 'location',
    dataType: 'yes_no',
  },

  // Reference Data
  {
    key: 'website',
    label: 'Website',
    description: 'Related website URL',
    category: 'reference',
    dataType: 'url',
    placeholder: 'https://example.org/artwork-info',
  },
  {
    key: 'wikipedia',
    label: 'Wikipedia',
    description: 'Wikipedia article reference',
    category: 'reference',
    dataType: 'text',
    maxLength: 200,
    placeholder: 'en:Article_Name',
    helpUrl: 'https://wiki.openstreetmap.org/wiki/Key:wikipedia',
  },
];

// Helper functions
export function getTagDefinition(key: string): TagDefinition | undefined {
  return TAG_DEFINITIONS.find(def => def.key === key);
}

export function getTagsByCategory(categoryKey: string): TagDefinition[] {
  return TAG_DEFINITIONS.filter(def => def.category === categoryKey);
}

export function getCategoryByKey(key: string): TagCategory | undefined {
  return TAG_CATEGORIES.find(cat => cat.key === key);
}

export function getCategoriesOrderedForDisplay(): TagCategory[] {
  return [...TAG_CATEGORIES].sort((a, b) => a.order - b.order);
}

export function getAllTagKeysAlphabetically(): TagDefinition[] {
  return [...TAG_DEFINITIONS].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Validate a tag value against its definition
 */
export function validateTagValue(key: string, value: string): { valid: boolean; error?: string } {
  const definition = getTagDefinition(key);
  if (!definition) {
    return { valid: false, error: 'Unknown tag key' };
  }

  if (!value.trim()) {
    if (definition.required) {
      return { valid: false, error: 'This tag is required' };
    }
    return { valid: true };
  }

  const trimmedValue = value.trim();

  // Data type validation
  switch (definition.dataType) {
    case 'enum':
      if (definition.enumValues && !definition.enumValues.includes(trimmedValue)) {
        return {
          valid: false,
          error: `Must be one of: ${definition.enumValues.join(', ')}`,
        };
      }
      break;

    case 'number':
      const num = parseFloat(trimmedValue);
      if (isNaN(num)) {
        return { valid: false, error: 'Must be a valid number' };
      }
      if (definition.min !== undefined && num < definition.min) {
        return { valid: false, error: `Must be at least ${definition.min}` };
      }
      if (definition.max !== undefined && num > definition.max) {
        return { valid: false, error: `Must be at most ${definition.max}` };
      }
      break;

    case 'date':
      // Accept YYYY or YYYY-MM-DD format
      const dateRegex = /^\d{4}(-\d{2}-\d{2})?$/;
      if (!dateRegex.test(trimmedValue)) {
        return { valid: false, error: 'Must be in format YYYY or YYYY-MM-DD' };
      }
      break;

    case 'yes_no':
      if (!['yes', 'no'].includes(trimmedValue.toLowerCase())) {
        return { valid: false, error: 'Must be "yes" or "no"' };
      }
      break;

    case 'url':
      try {
        new URL(trimmedValue);
      } catch {
        return { valid: false, error: 'Must be a valid URL' };
      }
      break;

    case 'wikidata_id':
      const wikidataRegex = /^Q\d+$/;
      if (!wikidataRegex.test(trimmedValue)) {
        return { valid: false, error: 'Must be a valid Wikidata ID (e.g., Q12345)' };
      }
      break;

    case 'text':
      if (definition.maxLength && trimmedValue.length > definition.maxLength) {
        return {
          valid: false,
          error: `Must be ${definition.maxLength} characters or less`,
        };
      }
      break;
  }

  return { valid: true };
}

/**
 * Format tag value for display
 */
export function formatTagValueForDisplay(key: string, value: string): string {
  const definition = getTagDefinition(key);
  if (!definition) return value;

  switch (definition.dataType) {
    case 'yes_no':
      return value.toLowerCase() === 'yes' ? 'Yes' : 'No';
    
    case 'date':
      // Format dates nicely
      if (value.length === 4) {
        return value; // Just year
      }
      try {
        const date = new Date(value);
        return date.toLocaleDateString();
      } catch {
        return value;
      }

    case 'url':
      // Show domain for URLs
      try {
        const url = new URL(value);
        return `${url.hostname}...`;
      } catch {
        return value;
      }

    default:
      return value;
  }
}

/**
 * Export data in OpenStreetMap compatible format
 */
export function exportToOpenStreetMapFormat(tags: Record<string, string>): Record<string, string> {
  const osmTags: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(tags)) {
    // Core OSM tags don't get prefixed
    if (['artwork_type', 'material', 'height', 'start_date', 'access', 'fee', 'website', 'wikipedia'].includes(key)) {
      osmTags[key] = value;
    } else {
      // Custom tags get "ca:" prefix
      osmTags[`ca:${key}`] = value;
    }
  }
  
  return osmTags;
}

/**
 * Schema versioning for future updates
 */
export const SCHEMA_VERSION = '1.0.0';

export function getSchemaInfo(): {
  version: string;
  lastModified: string;
  tagCount: number;
  categoryCount: number;
} {
  return {
    version: SCHEMA_VERSION,
    lastModified: '2024-12-19',
    tagCount: TAG_DEFINITIONS.length,
    categoryCount: TAG_CATEGORIES.length,
  };
}