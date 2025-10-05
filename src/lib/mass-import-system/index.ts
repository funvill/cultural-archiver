/**
 * Cultural Archiver Mass Import System
 *
 * A comprehensive library for automated ingestion of public art data from
 * external sources like government open data portals.
 *
 * @version 1.0.0
 * @author Steven Smethurst
 * @license MIT
 */

// ================================
// Core Types and Interfaces
// ================================

export type {
  MassImportConfig,
  ImportProgress,
  RawImportData,
  PhotoInfo,
  ValidationError,
  ValidationResult,
  ProcessedImportData,
  DuplicateCandidate,
  DuplicateDetectionResult,
  ImportResult,
  BatchResult,
  ImportSession,
  DryRunReport,
  DataSourceMapper,
  VancouverArtworkData,
} from './types';

export { RawImportDataSchema, CoordinateSchema, PhotoInfoSchema } from './types';

// ================================
// Core Library Functions
// ================================

export { validateImportData, MASS_IMPORT_USER_TOKEN, VANCOUVER_BOUNDS } from './lib/validation.js';

export {
  LocationEnhancer,
  type LocationEnhancementOptions,
  type LocationEnhancementResult,
} from './lib/location-enhancer.js';

export {
  detectDuplicates,
  checkExternalIdDuplicate,
  type ExistingArtwork,
} from './lib/duplicate-detection.js';

export { MassImportAPIClient, DryRunAPIClient } from './lib/api-client.js';

// ================================
// Data Source Importers
// ================================

export { VancouverMapper, validateVancouverData } from './importers/vancouver.js';

// ================================
// CLI and Processing
// ================================

export { MassImportProcessor } from './cli/processor.js';

import type { MassImportConfig } from './types';

// ================================
// Constants
// ================================

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: MassImportConfig = {
  apiEndpoint: 'https://api.publicartregistry.com',
  massImportUserToken: 'a0000000-1000-4000-8000-000000000002', // MASS_IMPORT_USER_UUID from shared/constants.ts
  batchSize: 50,
  maxRetries: 3,
  retryDelay: 1000,
  duplicateDetectionRadius: 50, // meters
  titleSimilarityThreshold: 0.8,
  dryRun: false,
};

/**
 * Library version information
 */
export const VERSION = '1.0.0';

/**
 * Supported data sources
 */
export const SUPPORTED_DATA_SOURCES = ['vancouver-opendata', 'generic'] as const;

// ================================
// Utility Functions
// ================================

/**
 * Create a default configuration with optional overrides
 */
export function createDefaultConfig(overrides: Partial<MassImportConfig> = {}): MassImportConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  };
}

/**
 * Validate configuration object
 */
export function validateConfig(config: Partial<MassImportConfig>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.apiEndpoint) {
    errors.push('API endpoint is required');
  } else {
    try {
      new URL(config.apiEndpoint);
    } catch {
      errors.push('API endpoint must be a valid URL');
    }
  }

  if (!config.massImportUserToken) {
    errors.push('Mass import user token is required');
  } else if (!/^[0-9a-f-]{36}$/i.test(config.massImportUserToken)) {
    errors.push('Mass import user token must be a valid UUID');
  }

  if (config.batchSize !== undefined) {
    if (!Number.isInteger(config.batchSize) || config.batchSize < 1 || config.batchSize > 1000) {
      errors.push('Batch size must be an integer between 1 and 1000');
    }
  }

  if (config.maxRetries !== undefined) {
    if (!Number.isInteger(config.maxRetries) || config.maxRetries < 0 || config.maxRetries > 10) {
      errors.push('Max retries must be an integer between 0 and 10');
    }
  }

  if (config.retryDelay !== undefined) {
    if (
      !Number.isInteger(config.retryDelay) ||
      config.retryDelay < 0 ||
      config.retryDelay > 10000
    ) {
      errors.push('Retry delay must be an integer between 0 and 10000 milliseconds');
    }
  }

  if (config.duplicateDetectionRadius !== undefined) {
    if (
      !Number.isFinite(config.duplicateDetectionRadius) ||
      config.duplicateDetectionRadius < 1 ||
      config.duplicateDetectionRadius > 5000
    ) {
      errors.push('Duplicate detection radius must be a number between 1 and 5000 meters');
    }
  }

  if (config.titleSimilarityThreshold !== undefined) {
    if (
      !Number.isFinite(config.titleSimilarityThreshold) ||
      config.titleSimilarityThreshold < 0 ||
      config.titleSimilarityThreshold > 1
    ) {
      errors.push('Title similarity threshold must be a number between 0 and 1');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get library information
 */
export function getLibraryInfo(): {
  name: string;
  version: string;
  description: string;
  supportedDataSources: string[];
  author: string;
  license: string;
} {
  return {
    name: '@cultural-archiver/mass-import',
    version: VERSION,
    description:
      'Mass import library for Cultural Archiver - automated ingestion of public art data',
    supportedDataSources: [...SUPPORTED_DATA_SOURCES],
    author: 'Steven Smethurst',
    license: 'MIT',
  };
}
