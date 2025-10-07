/**
 * Mass Import System - Shared Types and Interfaces
 *
 * Comprehensive types for mass importing artwork data from external sources
 * with duplicate detection, structured tagging, and bulk approval workflows.
 */

import { MASS_IMPORT_USER_UUID } from './constants';

export interface MassImportConfig {
  /** Data source identifier (e.g., 'vancouver-public-art') */
  source: string;

  /** Path to data file or URL */
  data_file: string;

  /** Processing mode - sequential prioritizes completeness */
  processing_mode: 'sequential' | 'parallel';

  /** Radius in meters for duplicate detection (default: 50m) */
  duplicate_radius_meters: number;

  /** Field mappings from source data to platform fields */
  field_mappings: FieldMappings;

  /** Tag mappings from source data to structured tags */
  tag_mappings: TagMappings;

  /** Photo processing configuration */
  photo_config?: PhotoConfig;

  /** License and attribution configuration */
  license_config: LicenseConfig;

  /** Batch processing configuration */
  batch_config?: BatchConfig;
}

export interface FieldMappings {
  /** Source field for artwork title */
  title: string;

  /** Source field for description */
  description?: string;

  /** Source field for notes/additional info */
  notes?: string;

  /** Coordinate field mappings */
  coordinates: {
    lat: string;
    lon: string;
  };
}

export interface TagMappings {
  /** Static tag values to apply to all imports */
  [tagKey: string]: string | TagMappingRule;
}

export interface TagMappingRule {
  /** Source field to extract value from */
  source_field: string;

  /** Optional transformation to apply to value */
  transform?: 'lowercase_with_underscores' | 'array_to_comma_separated' | 'year_format';

  /** Validation rules to apply */
  validation?: string;

  /** Prefix to add to mapped value */
  prefix?: string;

  /** Template with placeholders for complex mappings */
  template?: string;
}

export interface PhotoConfig {
  /** Source field containing photo URL or URLs */
  source_field: string;

  /** Source field for photo credits */
  credits_field?: string;

  /** Download timeout in seconds */
  download_timeout: number;

  /** Whether to retry failed photo downloads */
  retry_on_failure: boolean;
}

export interface LicenseConfig {
  /** License tag to apply (e.g., 'CC0', 'CC-BY-SA-4.0') */
  license_tag: string;

  /** Attribution text to append to descriptions */
  attribution_text: string;
}

export interface BatchConfig {
  /** Number of records to process in each batch */
  batch_size: number;

  /** Delay between batches in milliseconds */
  batch_delay_ms: number;

  /** Maximum concurrent API requests */
  max_concurrent: number;
}

/**
 * Mass Import Processing Results
 */
export interface MassImportResults {
  /** Import session identifier */
  import_id: string;

  /** Data source name */
  source: string;

  /** Whether this was a dry run */
  dry_run: boolean;

  /** Import start time */
  started_at: string;

  /** Import completion time */
  completed_at: string;

  /** Overall processing statistics */
  statistics: ImportStatistics;

  /** Records that were successfully processed */
  successful_records: ProcessedRecord[];

  /** Records that failed processing */
  failed_records: FailedRecord[];

  /** Duplicate matches found */
  duplicate_matches: DuplicateMatch[];

  /** Tag validation results */
  tag_validation_summary: TagValidationSummary;
}

export interface ImportStatistics {
  /** Total records in source data */
  total_records: number;

  /** Successfully processed records */
  successful: number;

  /** Failed records */
  failed: number;

  /** Records skipped as duplicates */
  skipped_duplicates: number;

  /** Records with photo processing issues */
  photo_failures: number;

  /** Records with tag validation warnings */
  tag_warnings: number;

  /** Processing time in milliseconds */
  processing_time_ms: number;
}

export interface ProcessedRecord {
  /** Source record identifier */
  external_id: string;

  /** Generated artwork/logbook ID */
  created_id: string;

  /** Record title */
  title: string;

  /** Applied tags */
  applied_tags: Record<string, string>;

  /** Photo processing status */
  photo_status: 'success' | 'failed' | 'none';

  /** Processing notes */
  notes?: string[];
}

export interface FailedRecord {
  /** Source record identifier */
  external_id: string;

  /** Record title if available */
  title?: string;

  /** Error type */
  error_type: 'validation' | 'duplicate' | 'api' | 'photo' | 'tags';

  /** Error message */
  error_message: string;

  /** Additional error details */
  error_details?: any;

  /** Source record data for debugging */
  source_record?: any;
}

export interface DuplicateMatch {
  /** Source record identifier */
  external_id: string;

  /** Existing artwork ID that matches */
  existing_artwork_id: string;

  /** Similarity score (0-1) */
  similarity_score: number;

  /** Matching criteria details */
  match_details: {
    distance_meters?: number;
    title_similarity?: number;
    tag_overlap?: number;
    external_id_match?: boolean;
  };

  /** Action taken */
  action: 'skipped' | 'merged' | 'flagged';

  /** Optional notes about the match */
  notes?: string;
}

export interface MassImportDuplicateInfo {
  artworkId: string;
  existingArtworkId: string;
  confidenceScore: number;
  scoreBreakdown: {
    title: number;
    artist: number;
    location: number;
    tags: number;
  };
}

export interface TagValidationSummary {
  /** Total tags processed */
  total_tags: number;

  /** Successfully validated tags */
  valid_tags: number;

  /** Tags with validation warnings */
  warning_tags: number;

  /** Tags that failed validation */
  invalid_tags: number;

  /** Tag validation details by category */
  validation_details: {
    [tagKey: string]: TagValidationResult;
  };
}

export interface TagValidationResult {
  /** Number of times this tag was applied */
  applied_count: number;

  /** Number of validation warnings */
  warning_count: number;

  /** Number of validation failures */
  error_count: number;

  /** Common validation messages */
  messages: string[];
}

/**
 * Bulk Approval Operations
 */
export interface BulkApprovalConfig {
  /** Data source to approve */
  source: string;

  /** Batch size for approval operations */
  batch_size: number;

  /** Explicit confirmation required */
  confirm: boolean;

  /** Optional filters */
  filters?: {
    import_batch_id?: string;
    date_range?: {
      from: string;
      to: string;
    };
    tag_filters?: Record<string, string>;
  };
}

export interface BulkApprovalResults {
  /** Approval operation ID */
  approval_id: string;

  /** Data source */
  source: string;

  /** Operation timestamp */
  executed_at: string;

  /** Records successfully approved */
  approved_count: number;

  /** Records that failed approval */
  failed_count: number;

  /** Failed approval details */
  failed_records: {
    id: string;
    error: string;
  }[];

  /** Rollback information (24-hour window) */
  rollback_info: {
    rollback_id: string;
    expires_at: string;
  };
}

/**
 * Import Processing Context
 */
export interface ImportContext {
  /** Import configuration */
  config: MassImportConfig;

  /** API authentication token */
  api_token: string;

  /** Base API URL */
  api_base_url: string;

  /** Import session ID */
  import_id: string;

  /** Whether this is a dry run */
  dry_run: boolean;

  /** Progress callback for reporting */
  onProgress?: (progress: ImportProgress) => void;

  /** Error callback for reporting */
  onError?: (error: ImportError) => void;
}

export interface ImportProgress {
  /** Current processing stage */
  stage: 'validation' | 'duplicate_check' | 'processing' | 'photos' | 'completion';

  /** Records processed so far */
  processed: number;

  /** Total records to process */
  total: number;

  /** Current record being processed */
  current_record?: {
    external_id: string;
    title: string;
  };

  /** Progress message */
  message: string;
}

export interface ImportError {
  /** Error severity */
  severity: 'warning' | 'error' | 'critical';

  /** Error type */
  type: 'validation' | 'api' | 'network' | 'duplicate' | 'tag' | 'photo';

  /** Error message */
  message: string;

  /** Additional context */
  context?: any;

  /** Record identifier if applicable */
  record_id?: string;
}

/**
 * Export interfaces for library consumers
 */
export interface MassImportLibraryInterface {
  /** Execute dry run validation */
  dryRun(data: any[], context: ImportContext): Promise<MassImportResults>;

  /** Execute actual import */
  processImport(data: any[], context: ImportContext): Promise<MassImportResults>;

  /** Retry failed photo downloads */
  retryPhotos(importResults: MassImportResults, context: ImportContext): Promise<MassImportResults>;

  /** Execute bulk approval */
  bulkApprove(config: BulkApprovalConfig, context: ImportContext): Promise<BulkApprovalResults>;

  /** Validate import configuration */
  validateConfig(config: MassImportConfig): Promise<ConfigValidationResult>;
}

export interface ConfigValidationResult {
  /** Whether configuration is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];

  /** Configuration summary */
  summary: {
    estimated_records?: number;
    required_fields_mapped: boolean;
    tag_mappings_valid: boolean;
    photo_config_valid: boolean;
  };
}

/**
 * Constants for mass import system
 */
export const MASS_IMPORT_CONSTANTS = {
  /** Default duplicate detection radius in meters */
  DEFAULT_DUPLICATE_RADIUS_METERS: 50,

  /** Default batch size for processing */
  DEFAULT_BATCH_SIZE: 50,

  /** Default concurrent request limit */
  DEFAULT_MAX_CONCURRENT: 5,

  /** Default photo download timeout */
  DEFAULT_PHOTO_TIMEOUT_SECONDS: 30,

  /** Mass import user UUID */
  MASS_IMPORT_USER_UUID,

  /** Required tags for all mass imports */
  REQUIRED_IMPORT_TAGS: ['source', 'import_date', 'license'] as const,

  /** Default similarity thresholds for duplicate detection */
  DUPLICATE_THRESHOLDS: {
    HIGH_SIMILARITY: 0.85,
    MODERATE_SIMILARITY: 0.7,
    LOW_SIMILARITY: 0.55,
  },

  /** Tag transformation functions */
  TAG_TRANSFORMS: {
    LOWERCASE_WITH_UNDERSCORES: 'lowercase_with_underscores',
    ARRAY_TO_COMMA_SEPARATED: 'array_to_comma_separated',
    YEAR_FORMAT: 'year_format',
  } as const,

  /** Import report file patterns */
  REPORT_FILES: {
    DRY_RUN_SUMMARY: '{source}-dry-run-summary-{date}.json',
    DRY_RUN_ERRORS: '{source}-dry-run-errors-{date}.json',
    IMPORT_SUMMARY: '{source}-import-{date}.json',
    APPROVAL_SUMMARY: '{source}-approval-{date}.json',
  },
} as const;

// ================================
// Mass Import V2 API Types
// ================================

/**
 * RawImportData schema compatible with CLI plugin system
 * This matches the output format from CLI importers/plugins
 */
export interface RawImportData {
  // Core location and identification
  lat: number; // -90 to 90
  lon: number; // -180 to 180
  title: string; // 1-200 chars
  description?: string; // max 1000 chars

  // Artist and creation info
  artist?: string; // max 500 chars
  created_by?: string; // max 500 chars
  yearOfInstallation?: string;

  // Physical properties
  material?: string; // max 200 chars
  type?: string; // max 100 chars

  // Location details
  address?: string; // max 500 chars
  neighborhood?: string; // max 200 chars
  siteName?: string; // max 300 chars

  // Photos
  photos?: Array<{
    url: string; // valid URL
    caption?: string;
    credit?: string;
    filename?: string;
  }>;
  primaryPhotoUrl?: string; // valid URL

  // Attribution and tracking
  source: string; // Required: data source identifier, max 100 chars
  sourceUrl?: string; // valid URL
  externalId?: string; // max 200 chars
  license?: string; // max 200 chars

  // Additional metadata
  tags?: Record<string, string | number | boolean>;
  status?: 'active' | 'inactive' | 'removed' | 'unknown';
}

/**
 * Mass Import Request V2 - Complete rewrite for unified submissions system
 */
export interface MassImportRequestV2 {
  metadata: {
    importId: string; // UUID for tracking this import batch
    source: {
      pluginName: string;
      pluginVersion?: string;
      originalDataSource: string; // e.g., "vancouver-open-data"
    };
    timestamp: string; // ISO 8601 timestamp
  };
  config: {
    duplicateThreshold: number; // Default: 0.7
    enableTagMerging: boolean; // Default: true
    createMissingArtists: boolean; // Default: true
    batchSize: number; // Default: 10, max: 10
    // Optional deduplication weights override
    duplicateWeights?: {
      gps: number; // default: 0.6
      title: number; // default: 0.25
      artist: number; // default: 0.2
      referenceIds: number; // default: 0.5
      tagSimilarity: number; // default: 0.05
    };
  };
  data: {
    artworks?: Array<RawImportData>;
    artists?: Array<RawImportData>;
  };
}

/**
 * Detailed deduplication scoring breakdown
 */
export interface DuplicationScore {
  gps: number;
  title: number;
  artist: number;
  referenceIds: number;
  tagSimilarity: number;
  total: number;
}

/**
 * Validation error for specific fields
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Mass Import Response V2 - Comprehensive response format
 */
export interface MassImportResponseV2 {
  importId: string;
  summary: {
    totalRequested: number;
    totalProcessed: number;
    totalSucceeded: number;
    totalFailed: number;
    totalDuplicates: number;
    processingTimeMs: number;
  };
  results: {
    artworks: {
      created: Array<{
        id: string; // UUID of created artwork
        title: string;
        submissionId: string;
      }>;
      duplicates: Array<{
        title: string;
        existingId: string;
        confidenceScore: number;
        scoreBreakdown: DuplicationScore;
        error: 'DUPLICATE_DETECTED';
      }>;
      failed: Array<{
        title: string;
        error: string;
        validationErrors?: ValidationError[];
      }>;
    };
    artists: {
      created: Array<{
        id: string; // UUID of created artist
        name: string;
        submissionId: string;
      }>;
      autoCreated: Array<{
        id: string; // UUID of auto-created artist
        name: string;
        reason: string;
        sourceArtworkId: string;
      }>;
      duplicates: Array<{
        name: string;
        existingId: string;
        confidenceScore: number;
        error: 'DUPLICATE_DETECTED' | 'DUPLICATE_DETECTED_BIO_UPDATED';
      }>;
      failed: Array<{
        name: string;
        error: string;
      }>;
    };
  };
  auditTrail: {
    importStarted: string;
    importCompleted: string;
    batchesProcessed: number;
    tagsMerged: number;
    photosDownloaded: number;
    photosUploaded: number;
    systemUserToken: string;
  };
}

/**
 * Artist auto-creation configuration
 */
export interface ArtistAutoCreationConfig {
  createMissingArtists: boolean;
  similarityThreshold: number; // default: 0.95 for strong matches
  autoLinkArtwork: boolean; // default: true
}

/**
 * Mass import system configuration with defaults
 */
export interface MassImportSystemConfig {
  defaultUserToken: string; // UUID for mass import system user
  autoApprove: boolean; // Always true for mass imports
  requireConsent: boolean; // False for mass imports (system content)
  timeoutMs: number; // 1-minute maximum processing time per import
  maxBatchSize: number; // Maximum 10 records per batch
}

/**
 * Import error types for structured error handling
 */
export interface ImportErrorV2 {
  recordIndex: number;
  recordType: 'artwork' | 'artist';
  recordTitle: string;
  errorType: 'validation' | 'duplicate' | 'database' | 'network';
  errorMessage: string;
  validationErrors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  suggestedFix?: string;
}
