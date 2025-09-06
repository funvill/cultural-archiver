/**
 * Cultural Archiver Mass Import System
 * 
 * A comprehensive TypeScript library for importing public art data
 * from external sources with validation, duplicate detection, and
 * integration with the Cultural Archiver platform.
 * 
 * @author Steven Smethurst
 * @version 1.0.0
 */

// Core library exports
export { MassImportLibrary } from './mass-import.js';

// Type definitions
export type {
  ImportConfig,
  ImportRecord,
  ProcessingResult,
  ProcessingError,
  ProcessingWarning,
  ImportStatistics,
} from './types.js';

// Validation schemas and constants
export {
  ImportConfigSchema,
  ImportRecordSchema,
  CoordinateSchema,
  isValidImportRecord,
  isValidImportConfig,
  MASS_IMPORT_USER_ID,
  VANCOUVER_BOUNDS,
  DEFAULT_DUPLICATE_RADIUS,
  DEFAULT_FUZZY_THRESHOLD,
  DEFAULT_BATCH_SIZE,
  MAX_RETRIES,
} from './types.js';

// Vancouver data mapper
export {
  mapVancouverRecord,
  isValidVancouverRecord,
  filterVancouverRecordsByBounds,
  getVancouverDataQuality,
} from './vancouver-mapper.js';

export type { VancouverRecord } from './vancouver-mapper.js';