// ================================
// Mass Import Service - New Unified Schema
// ================================
// Updated mass-import functionality for the new 6-table schema

import type { D1Database } from '@cloudflare/workers-types';
import type { 
  NewArtworkRecord, 
  NewArtistRecord
} from '../../shared/types.js';
import { createSubmission, approveSubmission } from './submissions.js';
import { recordUserActivity } from './user-activity.js';
import { createAuditLog } from './audit-log.js';

// ================================
// Mass Import Types
// ================================

export interface MassImportRecord {
  source_id: string; // Original ID from source system
  title: string;
  artist_name?: string; // Single artist name (replaces artist_names)
  year_created?: number;
  medium?: string;
  dimensions?: string;
  lat: number;
  lon: number;
  address?: string;
  neighborhood?: string;
  city?: string;
  region?: string;
  country?: string;
  description?: string;
  photos?: string[]; // Array of photo URLs
  tags?: Record<string, string>; // Key-value metadata
  source_type: 'osm_import' | 'manual_entry' | 'api_import';
  metadata?: Record<string, unknown>; // Additional source-specific data
}

export interface MassImportConfig {
  batchSize: number;
  autoApprove: boolean; // Whether to automatically approve submissions
  duplicateCheckRadius: number; // In meters
  importerToken: string; // User token for the import system
  dryRun: boolean;
  sourceName: string; // Name of the data source
  skipDuplicates: boolean;
  createArtists: boolean; // Whether to create artist records
}

export interface MassImportResult {
  totalRecords: number;
  successfulImports: number;
  duplicatesSkipped: number;
  failedImports: number;
  createdArtworks: string[];
  createdArtists: string[];
  createdSubmissions: string[];
  errors: string[];
  warnings: string[];
  processingTimeMs: number;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateId?: string;
  distance?: number;
  confidence?: number;
}

// ================================
// Core Mass Import Functions
// ================================

export async function importArtworkBatch(
  db: D1Database,
  records: MassImportRecord[],
  config: MassImportConfig
): Promise<MassImportResult> {
  const startTime = Date.now();
  const result: MassImportResult = {
    totalRecords: records.length,
    successfulImports: 0,
    duplicatesSkipped: 0,
    failedImports: 0,
    createdArtworks: [],
    createdArtists: [],
    createdSubmissions: [],
    errors: [],
    warnings: [],
    processingTimeMs: 0
  };

  // Log the import session
  await recordUserActivity(db, config.importerToken, 'user_token', 'submission', {
    importType: 'mass_import',
    sourceName: config.sourceName,
    recordCount: records.length,
    dryRun: config.dryRun
  });

  for (const record of records) {
    try {
      // Check for duplicates
      if (config.skipDuplicates) {
        const duplicateCheck = await checkForDuplicates(db, record, config.duplicateCheckRadius);
        if (duplicateCheck.isDuplicate) {
          result.duplicatesSkipped++;
          result.warnings.push(`Skipped duplicate: ${record.title} near ${duplicateCheck.duplicateId}`);
          continue;
        }
      }

      if (config.dryRun) {
        result.successfulImports++;
        continue;
      }

      // Create artist record if needed
      let artistId: string | undefined;
      if (config.createArtists && record.artist_name) {
        artistId = await createArtistFromImport(db, record, config);
        if (artistId) {
          result.createdArtists.push(artistId);
        }
      }

      // Create submission for the artwork
      const submissionId = await createArtworkSubmission(db, record, config, artistId);
      result.createdSubmissions.push(submissionId);

      // Auto-approve if configured
      if (config.autoApprove) {
        const approved = await approveSubmission(db, submissionId, config.importerToken, 'Auto-approved mass import');
        if (approved) {
          // Get the created artwork ID from the submission
          const artworkId = await getArtworkIdFromSubmission(db, submissionId);
          if (artworkId) {
            result.createdArtworks.push(artworkId);
          }
        }
      }

      result.successfulImports++;

    } catch (error) {
      result.failedImports++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to import ${record.title}: ${errorMsg}`);
    }
  }

  result.processingTimeMs = Date.now() - startTime;

  // Audit log the import session
  await createAuditLog(db, {
    entityType: 'submission',
    entityId: 'mass_import_session',
    action: 'create',
    userToken: config.importerToken,
    metadata: {
      importResult: result,
      config: {
        sourceName: config.sourceName,
        batchSize: config.batchSize,
        autoApprove: config.autoApprove,
        dryRun: config.dryRun
      }
    }
  });

  return result;
}

async function createArtworkSubmission(
  db: D1Database,
  record: MassImportRecord,
  config: MassImportConfig,
  artistId?: string
): Promise<string> {
  // Prepare the new artwork data
  const newArtworkData: Partial<NewArtworkRecord> = {
    title: record.title,
    artist_name: record.artist_name || null,
    year_created: record.year_created || null,
    medium: record.medium || null,
    dimensions: record.dimensions || null,
    lat: record.lat,
    lon: record.lon,
    address: record.address || null,
    neighborhood: record.neighborhood || null,
    city: record.city || null,
    region: record.region || null,
    country: record.country || null,
    photos: record.photos ? JSON.stringify(record.photos) : null,
    tags: record.tags ? JSON.stringify(record.tags) : null,
    description: record.description || null,
    source_type: record.source_type === 'api_import' ? 'manual_entry' : record.source_type as 'user_submission' | 'osm_import' | 'manual_entry',
    source_id: record.source_id
  };

  return createSubmission(db, {
    submissionType: 'new_artwork',
    userToken: config.importerToken,
    lat: record.lat,
    lon: record.lon,
    notes: `Mass import from ${config.sourceName}. Source ID: ${record.source_id}`,
    ...(record.photos && { photos: record.photos }),
    ...(record.tags && { tags: record.tags }),
    newData: newArtworkData,
    verificationStatus: config.autoApprove ? 'verified' : 'pending',
    ...(artistId && { artistId })
  });
}

async function createArtistFromImport(
  db: D1Database,
  record: MassImportRecord,
  config: MassImportConfig
): Promise<string | undefined> {
  if (!record.artist_name) return undefined;

  // Check if artist already exists
  const existingArtist = await findExistingArtist(db, record.artist_name);
  if (existingArtist) {
    return existingArtist.id;
  }

  // Create new artist submission
  const newArtistData: Partial<NewArtistRecord> = {
    name: record.artist_name,
    biography: null,
    birth_year: null,
    death_year: null,
    nationality: null,
    website: null,
    social_media: null,
    notes: `Created during mass import from ${config.sourceName}`,
    source_type: record.source_type === 'api_import' || record.source_type === 'osm_import' ? 'manual_entry' : record.source_type as 'user_submission' | 'manual_entry',
    source_id: record.source_id
  };

  const submissionId = await createSubmission(db, {
    submissionType: 'new_artist',
    userToken: config.importerToken,
    notes: `Artist created during mass import from ${config.sourceName}`,
    newData: newArtistData,
    verificationStatus: config.autoApprove ? 'verified' : 'pending'
  });

  // Auto-approve if configured
  if (config.autoApprove) {
    const approved = await approveSubmission(db, submissionId, config.importerToken, 'Auto-approved mass import artist');
    if (approved) {
      const artistId = await getArtistIdFromSubmission(db, submissionId);
      return artistId || undefined;
    }
  }

  return undefined;
}

// ================================
// Duplicate Detection Functions
// ================================

export async function checkForDuplicates(
  db: D1Database,
  record: MassImportRecord,
  radiusMeters: number = 500
): Promise<DuplicateCheckResult> {
  // Use spatial bounding box for initial filtering
  const latDelta = radiusMeters / 111320; // Approximate meters to degrees
  const lonDelta = radiusMeters / (111320 * Math.cos(record.lat * Math.PI / 180));

  const nearbyArtworks = await db.prepare(`
    SELECT a.id, a.title, a.lat, a.lon, art.name as primary_artist_name
    FROM artwork a
    LEFT JOIN artwork_artists aa ON a.id = aa.artwork_id AND aa.role = 'primary'
    LEFT JOIN artists art ON aa.artist_id = art.id
    WHERE a.lat BETWEEN ? AND ? 
    AND a.lon BETWEEN ? AND ?
    AND a.status = 'approved'
  `).bind(
    record.lat - latDelta,
    record.lat + latDelta,
    record.lon - lonDelta,
    record.lon + lonDelta
  ).all<{id: string, title: string, lat: number, lon: number, primary_artist_name: string | null}>();

  for (const artwork of nearbyArtworks.results || []) {
    const distance = calculateDistance(record.lat, record.lon, artwork.lat, artwork.lon);
    
    if (distance <= radiusMeters) {
      // Check title similarity
      const titleSimilarity = calculateStringSimilarity(record.title, artwork.title);
      
      // Check artist similarity if both have artists
      let artistSimilarity = 0;
      if (record.artist_name && artwork.primary_artist_name) {
        artistSimilarity = calculateStringSimilarity(record.artist_name, artwork.primary_artist_name);
      }

      // Calculate overall confidence
      const confidence = Math.max(titleSimilarity, artistSimilarity);
      
      // Consider it a duplicate if high similarity and close distance
      if (confidence > 0.8 && distance < 50) {
        return {
          isDuplicate: true,
          duplicateId: artwork.id,
          distance,
          confidence
        };
      }
    }
  }

  return { isDuplicate: false };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  
  // Simple Levenshtein distance-based similarity
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLength);
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));
  
  for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j]![i] = Math.min(
        matrix[j]![i - 1]! + 1,     // deletion
        matrix[j - 1]![i]! + 1,     // insertion
        matrix[j - 1]![i - 1]! + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length]![str1.length]!;
}

// ================================
// Helper Functions
// ================================

async function findExistingArtist(
  db: D1Database, 
  artistName: string
): Promise<{id: string} | null> {
  const result = await db.prepare(`
    SELECT id FROM artists 
    WHERE LOWER(name) = LOWER(?) 
    AND status = 'active'
    LIMIT 1
  `).bind(artistName.trim()).first<{id: string}>();

  return result || null;
}

async function getArtworkIdFromSubmission(
  db: D1Database,
  submissionId: string
): Promise<string | null> {
  const result = await db.prepare(`
    SELECT artwork_id FROM submissions 
    WHERE id = ? AND artwork_id IS NOT NULL
  `).bind(submissionId).first<{artwork_id: string}>();

  return result?.artwork_id || null;
}

async function getArtistIdFromSubmission(
  db: D1Database,
  submissionId: string
): Promise<string | null> {
  const result = await db.prepare(`
    SELECT artist_id FROM submissions 
    WHERE id = ? AND artist_id IS NOT NULL
  `).bind(submissionId).first<{artist_id: string}>();

  return result?.artist_id || null;
}

// ================================
// Validation Functions
// ================================

export function validateImportRecord(record: MassImportRecord): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!record.title?.trim()) {
    errors.push('Title is required');
  }
  if (typeof record.lat !== 'number' || isNaN(record.lat)) {
    errors.push('Valid latitude is required');
  }
  if (typeof record.lon !== 'number' || isNaN(record.lon)) {
    errors.push('Valid longitude is required');
  }
  if (!record.source_id?.trim()) {
    errors.push('Source ID is required');
  }

  // Coordinate bounds check
  if (record.lat < -90 || record.lat > 90) {
    errors.push('Latitude must be between -90 and 90');
  }
  if (record.lon < -180 || record.lon > 180) {
    errors.push('Longitude must be between -180 and 180');
  }

  // Warnings for missing optional data
  if (!record.artist_name?.trim()) {
    warnings.push('No artist name provided');
  }
  if (!record.description?.trim()) {
    warnings.push('No description provided');
  }
  if (!record.year_created) {
    warnings.push('No creation year provided');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ================================
// Batch Processing Functions
// ================================

export async function processImportFile(
  db: D1Database,
  records: MassImportRecord[],
  config: MassImportConfig
): Promise<MassImportResult> {
  // Validate all records first
  const validRecords: MassImportRecord[] = [];
  const invalidRecords: string[] = [];

  for (const record of records) {
    const validation = validateImportRecord(record);
    if (validation.valid) {
      validRecords.push(record);
    } else {
      invalidRecords.push(`${record.title || 'Unknown'}: ${validation.errors.join(', ')}`);
    }
  }

  // Process in batches
  const batches: MassImportRecord[][] = [];
  for (let i = 0; i < validRecords.length; i += config.batchSize) {
    batches.push(validRecords.slice(i, i + config.batchSize));
  }

  let aggregatedResult: MassImportResult = {
    totalRecords: records.length,
    successfulImports: 0,
    duplicatesSkipped: 0,
    failedImports: invalidRecords.length,
    createdArtworks: [],
    createdArtists: [],
    createdSubmissions: [],
    errors: invalidRecords,
    warnings: [],
    processingTimeMs: 0
  };

  for (const batch of batches) {
    const batchResult = await importArtworkBatch(db, batch, config);
    
    // Aggregate results
    aggregatedResult.successfulImports += batchResult.successfulImports;
    aggregatedResult.duplicatesSkipped += batchResult.duplicatesSkipped;
    aggregatedResult.failedImports += batchResult.failedImports;
    aggregatedResult.createdArtworks.push(...batchResult.createdArtworks);
    aggregatedResult.createdArtists.push(...batchResult.createdArtists);
    aggregatedResult.createdSubmissions.push(...batchResult.createdSubmissions);
    aggregatedResult.errors.push(...batchResult.errors);
    aggregatedResult.warnings.push(...batchResult.warnings);
    aggregatedResult.processingTimeMs += batchResult.processingTimeMs;
  }

  return aggregatedResult;
}