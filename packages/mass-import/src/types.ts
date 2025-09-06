import { z } from 'zod';

/**
 * Mass Import System Types
 * 
 * This file defines the core types and schemas for the mass import system.
 * It integrates with existing Cultural Archiver types without modifying them.
 */

// ================================
// Core Import Types
// ================================

export interface ImportConfig {
  /** API base URL for the Cultural Archiver API */
  apiBaseUrl: string;
  /** Authentication token for the mass-import user account */
  apiToken: string;
  /** Source identifier for this import (e.g., 'vancouver-public-art') */
  source: string;
  /** Maximum number of records to process in a single batch */
  batchSize?: number;
  /** Enable dry-run mode (validation only, no API calls) */
  dryRun?: boolean;
  /** Coordinate bounds for filtering records */
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface ImportRecord {
  /** External ID from the source system */
  externalId: string;
  /** Artwork coordinates */
  lat: number;
  lon: number;
  /** Artwork title */
  title: string;
  /** Artwork description */
  description?: string;
  /** Creator/artist information */
  createdBy?: string;
  /** Photo URLs from external source */
  photoUrls?: string[];
  /** Tags to apply to this artwork */
  tags: Record<string, string | number | boolean>;
  /** Source-specific metadata */
  metadata?: Record<string, unknown>;
}

export interface ProcessingResult {
  /** Total records processed */
  totalRecords: number;
  /** Successfully processed records */
  successCount: number;
  /** Failed records */
  failureCount: number;
  /** Skipped records (duplicates, etc.) */
  skippedCount: number;
  /** Processing errors */
  errors: ProcessingError[];
  /** Processing warnings */
  warnings: ProcessingWarning[];
  /** Statistics about the import */
  statistics: ImportStatistics;
}

export interface ProcessingError {
  /** External ID of the record that failed */
  externalId: string;
  /** Error message */
  message: string;
  /** Error type */
  type: 'validation' | 'api' | 'network' | 'photo' | 'duplicate';
  /** Additional context */
  context?: Record<string, unknown>;
}

export interface ProcessingWarning {
  /** External ID of the record */
  externalId: string;
  /** Warning message */
  message: string;
  /** Warning type */
  type: 'tag_mapping' | 'photo_processing' | 'coordinate_validation';
  /** Additional context */
  context?: Record<string, unknown>;
}

export interface ImportStatistics {
  /** Records by status */
  recordsByStatus: Record<string, number>;
  /** Photo processing statistics */
  photoStatistics: {
    totalPhotos: number;
    processedPhotos: number;
    failedPhotos: number;
  };
  /** Tag application statistics */
  tagStatistics: {
    totalTags: number;
    appliedTags: number;
    failedTags: number;
  };
  /** Geographic distribution */
  geographicBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

// ================================
// Validation Schemas
// ================================

export const CoordinateSchema = z.object({
  lat: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  lon: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
});

export const ImportRecordSchema = z.object({
  externalId: z.string().min(1, 'External ID is required'),
  lat: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  lon: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  description: z.string().max(2000, 'Description must be under 2000 characters').optional(),
  createdBy: z.string().max(200, 'Creator must be under 200 characters').optional(),
  photoUrls: z.array(z.string().url('Invalid photo URL')).optional(),
  tags: z.record(z.union([z.string(), z.number(), z.boolean()])),
  metadata: z.record(z.unknown()).optional(),
});

export const ImportConfigSchema = z.object({
  apiBaseUrl: z.string().url('Invalid API base URL'),
  apiToken: z.string().min(1, 'API token is required'),
  source: z.string().min(1, 'Source identifier is required'),
  batchSize: z.number().min(1).max(1000).optional().default(50),
  dryRun: z.boolean().optional().default(false),
  bounds: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  }).optional(),
});

// ================================
// Type Guards
// ================================

export const isValidImportRecord = (record: unknown): record is ImportRecord => {
  return ImportRecordSchema.safeParse(record).success;
};

export const isValidImportConfig = (config: unknown): config is ImportConfig => {
  return ImportConfigSchema.safeParse(config).success;
};

// ================================
// Constants
// ================================

/** Mass import user account UUID */
export const MASS_IMPORT_USER_ID = '00000000-0000-0000-0000-000000000002';

/** Default coordinate bounds for Vancouver area */
export const VANCOUVER_BOUNDS = {
  north: 49.32,
  south: 49.2,
  east: -123.0,
  west: -123.3,
} as const;

/** Default duplicate detection radius in meters */
export const DEFAULT_DUPLICATE_RADIUS = 50;

/** Default fuzzy matching threshold (0-1) */
export const DEFAULT_FUZZY_THRESHOLD = 0.8;

/** Default batch size for processing */
export const DEFAULT_BATCH_SIZE = 50;

/** Maximum retries for failed operations */
export const MAX_RETRIES = 3;