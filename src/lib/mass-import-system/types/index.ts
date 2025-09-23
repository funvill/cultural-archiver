/**
 * Mass Import System - Core Types and Interfaces
 *
 * This module defines the types and interfaces used throughout the mass import system.
 */

import { z } from 'zod';

// ================================
// Configuration Types
// ================================

export interface MassImportConfig {
  apiEndpoint: string;
  massImportUserToken: string;
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  duplicateDetectionRadius: number; // meters
  titleSimilarityThreshold: number; // 0-1
  dryRun: boolean;
}

export interface ImportProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  currentBatch: number;
  totalBatches: number;
}

// ================================
// Input Data Schemas
// ================================

export const CoordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const PhotoInfoSchema = z.object({
  url: z.string().url(),
  caption: z.string().optional(),
  credit: z.string().optional(),
  filename: z.string().optional(),
});

export const RawImportDataSchema = z.object({
  // Core location and identification
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),

  // Artist and creation info
  artist: z.string().max(500).optional(),
  created_by: z.string().max(500).optional(),
  yearOfInstallation: z.string().optional(),

  // Physical properties
  material: z.string().max(200).optional(),
  type: z.string().max(100).optional(),

  // Location details (no address field - use tags instead)
  neighborhood: z.string().max(200).optional(),
  siteName: z.string().max(300).optional(),

  // Photos
  photos: z.array(PhotoInfoSchema).optional(),
  primaryPhotoUrl: z.string().url().optional(),

  // Attribution and tracking
  source: z.string().max(100), // Required: data source identifier
  sourceUrl: z.string().url().optional(),
  externalId: z.string().max(200).optional(),
  license: z.string().max(200).optional(),

  // Additional metadata
  tags: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  status: z.enum(['active', 'inactive', 'removed', 'unknown']).optional(),
});

export type RawImportData = z.infer<typeof RawImportDataSchema>;
export type PhotoInfo = z.infer<typeof PhotoInfoSchema>;

// ================================
// Validation and Processing Results
// ================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  data?: ProcessedImportData;
}

export interface ProcessedImportData {
  // Core submission fields
  lat: number;
  lon: number;
  title: string;
  note?: string;

  // Structured tags (mapped from raw data)
  tags: Record<string, string | number | boolean>;

  // Photos for processing
  photos: PhotoInfo[];

  // Attribution and metadata
  source: string;
  sourceUrl?: string;
  externalId?: string;
  importBatchId: string;
  importTimestamp: string;
}

// ================================
// Duplicate Detection
// ================================

export interface DuplicateCandidate {
  id: string;
  title?: string;
  lat: number;
  lon: number;
  distance: number; // meters
  titleSimilarity: number; // 0-1
  confidence: number; // 0-1
  reason: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  candidates: DuplicateCandidate[];
  bestMatch?: DuplicateCandidate;
}

// ================================
// Import Results
// ================================

export interface ImportResult {
  id: string;
  title: string;
  success: boolean;
  error?: string;
  warnings: string[];
  duplicateDetection: DuplicateDetectionResult;
  submissionId?: string;
  photosProcessed: number;
  photosFailed: number;
}

export interface BatchResult {
  batchId: string;
  results: ImportResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    duplicates: number;
  };
}

export interface ImportSession {
  sessionId: string;
  startTime: string;
  endTime?: string;
  config: MassImportConfig;
  batches: BatchResult[];
  summary: {
    totalRecords: number;
    successfulImports: number;
    failedImports: number;
    skippedDuplicates: number;
    totalPhotos: number;
    successfulPhotos: number;
    failedPhotos: number;
  };
}

// ================================
// CLI and Reporting Types
// ================================

export interface DryRunReport {
  summary: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    duplicateRecords: number;
    totalPhotos: number;
    validPhotos: number;
    invalidPhotos: number;
  };
  errors: Array<{
    recordIndex: number;
    recordId?: string;
    errors: ValidationError[];
  }>;
  duplicates: Array<{
    recordIndex: number;
    recordId?: string;
    duplicateDetection: DuplicateDetectionResult;
  }>;
  photosIssues: Array<{
    recordIndex: number;
    photoUrl: string;
    issue: string;
  }>;
}

// ================================
// Data Source Specific Types
// ================================

export interface DataSourceMapper {
  name: string;
  version: string;
  mapData(rawData: any): ValidationResult;
  validateBounds?(lat: number, lon: number): boolean;
  generateImportId?(data: any): string;
}

// Vancouver Open Data specific types
export interface VancouverArtworkData {
  registryid: number;
  title_of_work: string;
  artistprojectstatement?: string;
  type: string;
  status: string;
  sitename?: string;
  siteaddress?: string;
  primarymaterial?: string;
  url?: string;
  photourl?: {
    url: string;
    filename?: string;
    width?: number;
    height?: number;
  };
  ownership?: string;
  neighbourhood?: string;
  locationonsite?: string;
  geo_point_2d: {
    lat: number;
    lon: number;
  } | null;
  geom?: {
    type: string;
    geometry?: {
      coordinates: [number, number];
      type: string;
    };
  } | null;
  geo_local_area?: string;
  descriptionofwork?: string;
  artists?: string[];
  photocredits?: string;
  yearofinstallation?: string;
}
