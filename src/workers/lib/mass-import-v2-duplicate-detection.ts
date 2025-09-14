/**
 * Mass Import V2 Duplicate Detection Service
 * 
 * Enhanced duplicate detection for unified submissions system supporting:
 * 1. Both artwork and artist duplicate detection
 * 2. Configurable scoring weights from CLI plugin system
 * 3. Sophisticated tag merging logic
 * 4. Integration with MassImportRequestV2/ResponseV2 format
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { 
  RawImportData,
  DuplicationScore,
  ValidationError,
  MassImportRequestV2
} from '../../shared/mass-import';
import { createDatabaseService } from './database';

// ================================
// V2 Service Types
// ================================

export interface DuplicateDetectionWeights {
  gps: number; // default: 0.6
  title: number; // default: 0.25  
  artist: number; // default: 0.2
  referenceIds: number; // default: 0.5
  tagSimilarity: number; // default: 0.05
}

export interface ArtworkDuplicateRequest {
  data: RawImportData;
  threshold: number;
  weights?: DuplicateDetectionWeights;
}

export interface ArtistDuplicateRequest {
  name: string;
  website?: string;
  bio?: string;
  externalId?: string;
  threshold: number;
  weights?: DuplicateDetectionWeights;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  existingId?: string;
  confidenceScore?: number;
  scoreBreakdown?: DuplicationScore;
  candidatesChecked: number;
}

export interface TagMergeResult {
  newTagsAdded: number;
  tagsOverwritten: number;
  totalTags: number;
  mergedTags: Record<string, string>;
}

// ================================
// Default Configuration
// ================================

const DEFAULT_ARTWORK_WEIGHTS: DuplicateDetectionWeights = {
  gps: 0.6,
  title: 0.25,
  artist: 0.2,
  referenceIds: 0.5,
  tagSimilarity: 0.05
};

const DEFAULT_ARTIST_WEIGHTS: DuplicateDetectionWeights = {
  gps: 0.0, // Artists don't have GPS locations
  title: 0.5, // Name match is primary indicator
  artist: 0.0, // Not applicable for artists
  referenceIds: 0.5,
  tagSimilarity: 0.15
};

const GPS_SEARCH_RADIUS_DEGREES = 0.0045; // ~500m at mid-latitudes

// ================================
// Mass Import V2 Duplicate Detection Service
// ================================

export class MassImportV2DuplicateDetectionService {
  private db: ReturnType<typeof createDatabaseService>;

  constructor(database: D1Database) {
    this.db = createDatabaseService(database);
  }

  /**
   * Check for artwork duplicates with configurable weights
   */
  async checkArtworkDuplicates(request: ArtworkDuplicateRequest): Promise<DuplicateDetectionResult> {
    const weights = { ...DEFAULT_ARTWORK_WEIGHTS, ...request.weights };
    const data = request.data;

    // 1. Find nearby artworks using spatial index
    const candidates = await this.findNearbyArtworks(data.lat, data.lon);
    
    if (candidates.length === 0) {
      return {
        isDuplicate: false,
        candidatesChecked: 0
      };
    }

    console.log(`[DUPLICATE_V2] Checking ${candidates.length} artwork candidates for: "${data.title}"`);

    // 2. Calculate similarity scores for each candidate
    let bestMatch: { score: number; candidate: any; breakdown: DuplicationScore } | null = null;

    for (const candidate of candidates) {
      const breakdown = this.calculateArtworkSimilarity(data, candidate, weights);
      
      if (breakdown.total > (bestMatch?.score || 0)) {
        bestMatch = {
          score: breakdown.total,
          candidate,
          breakdown
        };
      }
    }

    // 3. Check if best match exceeds threshold
    if (bestMatch && bestMatch.score >= request.threshold) {
      console.log(`[DUPLICATE_V2] Duplicate detected: ${bestMatch.score.toFixed(3)} >= ${request.threshold}`);
      
      return {
        isDuplicate: true,
        existingId: bestMatch.candidate.id,
        confidenceScore: bestMatch.score,
        scoreBreakdown: bestMatch.breakdown,
        candidatesChecked: candidates.length
      };
    }

    console.log(`[DUPLICATE_V2] No duplicates found. Best score: ${bestMatch?.score.toFixed(3) || 0}`);
    
    return {
      isDuplicate: false,
      candidatesChecked: candidates.length
    };
  }

  /**
   * Check for artist duplicates
   */
  async checkArtistDuplicates(request: ArtistDuplicateRequest): Promise<DuplicateDetectionResult> {
    const weights = { ...DEFAULT_ARTIST_WEIGHTS, ...request.weights };

    // 1. Find existing artists with similar names
    const candidates = await this.findSimilarArtists(request.name);
    
    if (candidates.length === 0) {
      return {
        isDuplicate: false,
        candidatesChecked: 0
      };
    }

    console.log(`[DUPLICATE_V2] Checking ${candidates.length} artist candidates for: "${request.name}"`);

    // 2. Calculate similarity scores
    let bestMatch: { score: number; candidate: any; breakdown: DuplicationScore } | null = null;

    for (const candidate of candidates) {
      const breakdown = this.calculateArtistSimilarity(request, candidate, weights);
      
      if (breakdown.total > (bestMatch?.score || 0)) {
        bestMatch = {
          score: breakdown.total,
          candidate,
          breakdown
        };
      }
    }

    // 3. Check threshold
    if (bestMatch && bestMatch.score >= request.threshold) {
      console.log(`[DUPLICATE_V2] Artist duplicate detected: ${bestMatch.score.toFixed(3)} >= ${request.threshold}`);
      
      return {
        isDuplicate: true,
        existingId: bestMatch.candidate.id,
        confidenceScore: bestMatch.score,
        scoreBreakdown: bestMatch.breakdown,
        candidatesChecked: candidates.length
      };
    }

    return {
      isDuplicate: false,
      candidatesChecked: candidates.length
    };
  }

  /**
   * Merge tags into existing artwork/artist record
   */
  async mergeTagsIntoExisting(
    entityType: 'artwork' | 'artist',
    entityId: string, 
    newTags: Record<string, string | number | boolean>
  ): Promise<TagMergeResult> {
    const tableName = entityType === 'artwork' ? 'artwork' : 'artists';
    
    // Get existing record
    const existing = await this.db.db.prepare(`
      SELECT tags FROM ${tableName} WHERE id = ?
    `).bind(entityId).first();

    if (!existing) {
      throw new Error(`${entityType} ${entityId} not found`);
    }

    // Parse existing tags
    const existingTags: Record<string, any> = existing.tags ? 
      JSON.parse(existing.tags as string) : {};

    // Merge logic: add new tags that don't exist, preserve existing values
    let newTagsAdded = 0;
    let tagsOverwritten = 0;
    const mergedTags = { ...existingTags };

    for (const [key, value] of Object.entries(newTags)) {
      if (!Object.prototype.hasOwnProperty.call(existingTags, key)) {
        mergedTags[key] = value;
        newTagsAdded++;
      } else if (existingTags[key] === null || existingTags[key] === undefined || existingTags[key] === '') {
        // Only overwrite if existing value is empty/null
        mergedTags[key] = value;
        tagsOverwritten++;
      }
      // Otherwise preserve original tag value
    }

    // Update record if changes were made
    if (newTagsAdded > 0 || tagsOverwritten > 0) {
      await this.db.db.prepare(`
        UPDATE ${tableName} SET tags = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(JSON.stringify(mergedTags), entityId).run();

      console.log(`[TAG_MERGE] Updated ${entityType} ${entityId}: +${newTagsAdded} new, ${tagsOverwritten} overwritten`);
    }

    return {
      newTagsAdded,
      tagsOverwritten,
      totalTags: Object.keys(mergedTags).length,
      mergedTags
    };
  }

  // ================================
  // Private Helper Methods
  // ================================

  /**
   * Find nearby artworks using spatial index
   */
  private async findNearbyArtworks(lat: number, lon: number): Promise<any[]> {
    const minLat = lat - GPS_SEARCH_RADIUS_DEGREES;
    const maxLat = lat + GPS_SEARCH_RADIUS_DEGREES;
    const minLon = lon - GPS_SEARCH_RADIUS_DEGREES;
    const maxLon = lon + GPS_SEARCH_RADIUS_DEGREES;

    const result = await this.db.db.prepare(`
      SELECT id, title, created_by, lat, lon, tags
      FROM artwork 
      WHERE status = 'approved'
        AND lat BETWEEN ? AND ?
        AND lon BETWEEN ? AND ?
    `).bind(minLat, maxLat, minLon, maxLon).all();

    return result.results || [];
  }

  /**
   * Find artists with similar names
   */
  private async findSimilarArtists(name: string): Promise<any[]> {
    // Use LIKE for basic fuzzy matching - can be enhanced with more sophisticated algorithms
    const searchPattern = `%${name.toLowerCase()}%`;
    
    const result = await this.db.db.prepare(`
      SELECT id, name, bio, tags
      FROM artists 
      WHERE status = 'approved'
        AND LOWER(name) LIKE ?
    `).bind(searchPattern).all();

    return result.results || [];
  }

  /**
   * Calculate artwork similarity score
   */
  private calculateArtworkSimilarity(
    incoming: RawImportData,
    candidate: any,
    weights: DuplicateDetectionWeights
  ): DuplicationScore {
    // GPS similarity (distance-based)
    const distance = this.calculateDistance(incoming.lat, incoming.lon, candidate.lat, candidate.lon);
    const gpsScore = Math.max(0, 1 - (distance / 500)) * weights.gps; // 500m max distance

    // Title similarity
    const titleScore = this.calculateTextSimilarity(incoming.title, candidate.title || '') * weights.title;

    // Artist similarity
    const incomingArtist = incoming.artist || incoming.created_by || '';
    const candidateArtist = candidate.created_by || '';
    const artistScore = this.calculateTextSimilarity(incomingArtist, candidateArtist) * weights.artist;

    // Reference ID similarity
    const refScore = this.calculateReferenceIdSimilarity(incoming, candidate) * weights.referenceIds;

    // Tag similarity
    const tagScore = this.calculateTagSimilarity(incoming.tags || {}, candidate.tags) * weights.tagSimilarity;

    const total = gpsScore + titleScore + artistScore + refScore + tagScore;

    return {
      gps: gpsScore,
      title: titleScore,
      artist: artistScore,
      referenceIds: refScore,
      tagSimilarity: tagScore,
      total
    };
  }

  /**
   * Calculate artist similarity score
   */
  private calculateArtistSimilarity(
    incoming: ArtistDuplicateRequest,
    candidate: any,
    weights: DuplicateDetectionWeights
  ): DuplicationScore {
    // Name similarity (primary indicator)
    const nameScore = this.calculateTextSimilarity(incoming.name, candidate.name || '') * weights.title; // Using title weight for name

    // Website/reference similarity
    const refScore = incoming.externalId ? 
      this.calculateTextSimilarity(incoming.externalId, candidate.id || '') * weights.referenceIds : 0;

    // Bio similarity (if available)
    const bioScore = incoming.bio && candidate.bio ? 
      this.calculateTextSimilarity(incoming.bio, candidate.bio) * weights.tagSimilarity : 0;

    const total = nameScore + refScore + bioScore;

    return {
      gps: 0, // Not applicable for artists
      title: nameScore,
      artist: 0, // Not applicable
      referenceIds: refScore,
      tagSimilarity: bioScore,
      total
    };
  }

  /**
   * Calculate Haversine distance between two points
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate text similarity using Levenshtein distance
   */
  private calculateTextSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    
    return maxLength === 0 ? 0 : 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[s2.length][s1.length];
  }

  /**
   * Calculate reference ID similarity
   */
  private calculateReferenceIdSimilarity(incoming: RawImportData, candidate: any): number {
    if (!incoming.externalId) return 0;
    
    // Check if external ID matches existing ID or any reference fields
    const candidateRefs = [
      candidate.id,
      candidate.source_id,
      candidate.external_id
    ].filter(Boolean);

    for (const ref of candidateRefs) {
      if (ref === incoming.externalId) {
        return 1; // Exact match
      }
    }

    return 0;
  }

  /**
   * Calculate tag similarity
   */
  private calculateTagSimilarity(incomingTags: Record<string, any>, candidateTags: string | null): number {
    if (!candidateTags || Object.keys(incomingTags).length === 0) return 0;
    
    try {
      const existing = JSON.parse(candidateTags);
      const incomingKeys = Object.keys(incomingTags);
      const existingKeys = Object.keys(existing);
      
      if (incomingKeys.length === 0 || existingKeys.length === 0) return 0;
      
      // Calculate Jaccard similarity for tag keys
      const intersection = incomingKeys.filter(key => existingKeys.includes(key));
      const union = [...new Set([...incomingKeys, ...existingKeys])];
      
      return intersection.length / union.length;
    } catch {
      return 0;
    }
  }
}

/**
 * Factory function to create the service
 */
export function createMassImportV2DuplicateDetectionService(database: D1Database): MassImportV2DuplicateDetectionService {
  return new MassImportV2DuplicateDetectionService(database);
}