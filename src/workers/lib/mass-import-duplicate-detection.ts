/**
 * Mass Import Duplicate Detection Service
 * 
 * Handles duplicate detection during mass import operations by:
 * 1. Querying existing artworks within 100m radius
 * 2. Calculating similarity scores using PRD algorithm
 * 3. Filtering duplicates above threshold
 * 4. Providing detailed duplicate information for reports
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { 
  MassImportSimilarityQuery,
  MassImportCandidate,
  MassImportSimilarityResult
} from '../../shared/mass-import-similarity';
import { createMassImportSimilarityStrategy } from '../../shared/mass-import-similarity';
import { createDatabaseService } from './database';

// ================================
// Service Types
// ================================

export interface MassImportDuplicateRequest {
  title: string;
  description?: string;
  lat: number;
  lon: number;
  artist?: string;           // From created_by or artist field
  tags?: Record<string, string>;
  duplicateThreshold?: number; // Default: 0.7
}

export interface MassImportDuplicateResult {
  isDuplicate: boolean;
  duplicateInfo?: {
    artworkId: string;
    title: string;
    confidenceScore: number;
    scoreBreakdown: {
      title: number;
      artist: number;
      location: number;
      tags: number;
    };
    existingArtworkId: string;
    existingArtworkUrl: string;
  };
  candidatesChecked: number;
}

// ================================
// Duplicate Detection Service
// ================================

export class MassImportDuplicateDetectionService {
  private readonly similarityStrategy;
  private readonly SEARCH_RADIUS_METERS = 100; // PRD: query within 100m

  constructor(
    private readonly database: D1Database,
    baseUrl: string = 'https://art.abluestar.com'
  ) {
    this.similarityStrategy = createMassImportSimilarityStrategy(baseUrl);
  }

  /**
   * Check for duplicates of the given artwork import data
   */
  async checkForDuplicates(request: MassImportDuplicateRequest): Promise<MassImportDuplicateResult> {
    const threshold = request.duplicateThreshold ?? 0.7;

    // 1. Find nearby existing artworks within 100m radius
    const candidates = await this.findNearbyArtworks(
      request.lat, 
      request.lon, 
      this.SEARCH_RADIUS_METERS
    );

    if (candidates.length === 0) {
      return {
        isDuplicate: false,
        candidatesChecked: 0
      };
    }

    // 2. Build similarity query from import request
    const query: MassImportSimilarityQuery = {
      coordinates: { lat: request.lat, lon: request.lon },
      ...(request.title && { title: request.title }),
      ...(request.artist && { artist: request.artist }),
      ...(request.tags && { tags: request.tags })
    };

    // 3. Calculate similarity scores for all candidates
    let bestMatch: MassImportSimilarityResult | null = null;

    for (const candidate of candidates) {
      try {
        const result = this.similarityStrategy.calculateSimilarity(query, candidate, threshold);
        
        // Keep track of best match (highest score)
        if (!bestMatch || result.confidenceScore > bestMatch.confidenceScore) {
          bestMatch = result;
        }
      } catch (error) {
        console.warn(`Failed to calculate similarity for artwork ${candidate.id}:`, error);
        // Continue with other candidates
      }
    }

    // 4. Return results
    if (bestMatch && bestMatch.isDuplicate) {
      return {
        isDuplicate: true,
        duplicateInfo: {
          artworkId: bestMatch.artworkId,
          title: request.title,
          confidenceScore: bestMatch.confidenceScore,
          scoreBreakdown: bestMatch.scoreBreakdown,
          existingArtworkId: bestMatch.existingArtworkId,
          existingArtworkUrl: bestMatch.existingArtworkUrl
        },
        candidatesChecked: candidates.length
      };
    }

    return {
      isDuplicate: false,
      candidatesChecked: candidates.length
    };
  }

  /**
   * Find existing approved artworks within radius
   * Uses spatial indexing for performance
   */
  private async findNearbyArtworks(
    lat: number, 
    lon: number, 
    radiusMeters: number
  ): Promise<MassImportCandidate[]> {
    // Convert radius to approximate degrees for initial filtering
    // 1 degree ≈ 111km, so radiusMeters / 111000 gives degrees
    const radiusDegrees = radiusMeters / 111000;
    const latMin = lat - radiusDegrees;
    const latMax = lat + radiusDegrees;
    const lonMin = lon - radiusDegrees;  
    const lonMax = lon + radiusDegrees;

    const db = createDatabaseService(this.database);

    try {
      // Query using spatial index for initial filtering
      const results = await db.db.prepare(`
        SELECT 
          id,
          lat,
          lon,
          title,
          created_by,
          tags
        FROM artwork 
        WHERE status = 'approved'
          AND lat BETWEEN ? AND ?
          AND lon BETWEEN ? AND ?
        ORDER BY 
          (lat - ?) * (lat - ?) + (lon - ?) * (lon - ?)
        LIMIT 50
      `).bind(
        latMin, latMax,
        lonMin, lonMax,
        lat, lat, lon, lon
      ).all();

      const candidates: MassImportCandidate[] = [];

      // Filter by exact distance and convert to candidate format
      for (const row of results.results) {
        const record = row as {
          id: string;
          lat: number;
          lon: number;
          title: string | null;
          created_by: string | null;
          tags: string | null;
        };

        // Calculate exact distance using haversine formula
        const distance = this.calculateHaversineDistance(
          lat, lon, 
          record.lat, record.lon
        );

        if (distance <= radiusMeters) {
          candidates.push({
            id: record.id,
            coordinates: { lat: record.lat, lon: record.lon },
            title: record.title,
            created_by: record.created_by,
            tags: record.tags
          });
        }
      }

      return candidates;

    } catch (error) {
      console.error('Failed to query nearby artworks:', error);
      throw new Error('Database query failed during duplicate detection');
    }
  }

  /**
   * Calculate distance between two coordinates using haversine formula
   */
  private calculateHaversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// ================================
// Factory Function
// ================================

/**
 * Create a duplicate detection service instance
 */
export function createMassImportDuplicateDetectionService(
  database: D1Database,
  baseUrl?: string
): MassImportDuplicateDetectionService {
  return new MassImportDuplicateDetectionService(database, baseUrl);
}