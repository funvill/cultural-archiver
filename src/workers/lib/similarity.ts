/**
 * Similarity scoring service for artwork deduplication
 * Integrates with discovery endpoints to provide similarity-enhanced results
 */

import type { 
  SimilarityStrategy,
  SimilarityResult,
  SimilarityQuery,
  CandidateArtwork,
} from '../../shared/similarity';
import {
  DefaultSimilarityStrategy,
  sortBySimilarity,
  filterByThreshold,
} from '../../shared/similarity';

// ================================
// Service Interface
// ================================

export interface SimilarityServiceOptions {
  strategy?: SimilarityStrategy;
  maxCandidates?: number;
  includeMetadata?: boolean;
}

export interface EnhancedArtworkResult {
  id: string;
  lat: number;
  lon: number;
  type_name: string;
  distance_meters: number;
  title?: string | null | undefined;
  tags?: string | null | undefined;
  photos?: string[] | null | undefined;
  // Similarity enhancements
  similarity_score?: number | undefined;
  similarity_threshold?: 'none' | 'warn' | 'high' | undefined;
  similarity_signals?: Array<{
    type: string;
    score: number;
    metadata?: Record<string, unknown> | undefined;
  }> | undefined;
}

// ================================
// Similarity Service Implementation
// ================================

export class SimilarityService {
  private strategy: SimilarityStrategy;
  private includeMetadata: boolean;

  constructor(options: SimilarityServiceOptions = {}) {
    this.strategy = options.strategy || new DefaultSimilarityStrategy();
    this.includeMetadata = options.includeMetadata ?? false;
  }

  /**
   * Calculate similarity scores for a list of candidate artworks
   */
  calculateSimilarityScores(
    query: SimilarityQuery,
    candidates: CandidateArtwork[]
  ): SimilarityResult[] {
    const results: SimilarityResult[] = [];

    for (const candidate of candidates) {
      try {
        const result = this.strategy.calculateSimilarity(query, candidate);
        results.push(result);
      } catch (error) {
        console.warn(`Similarity calculation failed for artwork ${candidate.id}:`, error);
        // Continue with other candidates - don't let one failure break everything
      }
    }

    return sortBySimilarity(results);
  }

  /**
   * Enhance nearby artwork results with similarity scores
   */
  enhanceNearbyResults(
    query: SimilarityQuery,
    nearbyArtworks: Array<{
      id: string;
      lat: number;
      lon: number;
      type_name: string;
      distance_km: number;
      title?: string | null | undefined;
      tags?: string | null | undefined;
      photos?: string[] | null | undefined;
    }>
  ): EnhancedArtworkResult[] {
    // Convert to candidate format
    const candidates: CandidateArtwork[] = nearbyArtworks.map(artwork => ({
      id: artwork.id,
      coordinates: { lat: artwork.lat, lon: artwork.lon },
      title: artwork.title ?? null,
      tags: artwork.tags ?? null,
      type_name: artwork.type_name,
      distance_meters: Math.round(artwork.distance_km * 1000),
    }));

    // Calculate similarity scores
    let similarityResults: SimilarityResult[] = [];
    try {
      similarityResults = this.calculateSimilarityScores(query, candidates);
    } catch (error) {
      console.error('Similarity service failed, falling back to distance-only results:', error);
      // Graceful degradation - return original results without similarity scores
      return nearbyArtworks.map(artwork => ({
        ...artwork,
        distance_meters: Math.round(artwork.distance_km * 1000),
      }));
    }

    // Create map for efficient lookup
    const similarityMap = new Map<string, SimilarityResult>();
    similarityResults.forEach(result => {
      similarityMap.set(result.artworkId, result);
    });

    // Enhance original results
    const enhancedResults: EnhancedArtworkResult[] = nearbyArtworks.map(artwork => {
      const similarity = similarityMap.get(artwork.id);
      
      const enhanced: EnhancedArtworkResult = {
        ...artwork,
        distance_meters: Math.round(artwork.distance_km * 1000),
      };

      if (similarity) {
        enhanced.similarity_score = similarity.overallScore;
        enhanced.similarity_threshold = similarity.threshold;

        if (this.includeMetadata && similarity.signals.length > 0) {
          enhanced.similarity_signals = similarity.signals.map(signal => ({
            type: signal.type,
            score: signal.rawScore,
            metadata: signal.metadata ?? undefined,
          }));
        }
      }

      return enhanced;
    });

    // Sort by composite relevance: similarity score (if available) then distance
    return enhancedResults.sort((a, b) => {
      // If both have similarity scores, sort by similarity first
      if (a.similarity_score !== undefined && b.similarity_score !== undefined) {
        const scoreDiff = b.similarity_score - a.similarity_score;
        if (Math.abs(scoreDiff) > 0.01) { // Significant difference
          return scoreDiff;
        }
      }
      
      // Fall back to distance sorting
      return a.distance_meters - b.distance_meters;
    });
  }

  /**
   * Get high-confidence duplicate candidates
   */
  getHighSimilarityMatches(
    query: SimilarityQuery,
    candidates: CandidateArtwork[]
  ): SimilarityResult[] {
    const results = this.calculateSimilarityScores(query, candidates);
    return filterByThreshold(results, 'high');
  }

  /**
   * Get warning-level similarity matches
   */
  getWarningSimilarityMatches(
    query: SimilarityQuery,
    candidates: CandidateArtwork[]
  ): SimilarityResult[] {
    const results = this.calculateSimilarityScores(query, candidates);
    return filterByThreshold(results, 'warn');
  }

  /**
   * Check if a submission would create a likely duplicate
   */
  checkForDuplicates(
    query: SimilarityQuery,
    candidates: CandidateArtwork[]
  ): {
    hasHighSimilarity: boolean;
    hasWarningSimilarity: boolean;
    highSimilarityMatches: SimilarityResult[];
    warningSimilarityMatches: SimilarityResult[];
    topMatch?: SimilarityResult | undefined;
  } {
    try {
      const allResults = this.calculateSimilarityScores(query, candidates);
      const highMatches = filterByThreshold(allResults, 'high');
      const warningMatches = filterByThreshold(allResults, 'warn');

      return {
        hasHighSimilarity: highMatches.length > 0,
        hasWarningSimilarity: warningMatches.length > 0,
        highSimilarityMatches: highMatches,
        warningSimilarityMatches: warningMatches,
        topMatch: allResults.length > 0 ? allResults[0] : undefined,
      };
    } catch (error) {
      console.error('Duplicate check failed:', error);
      // Graceful degradation
      return {
        hasHighSimilarity: false,
        hasWarningSimilarity: false,
        highSimilarityMatches: [],
        warningSimilarityMatches: [],
      };
    }
  }

  /**
   * Update similarity strategy (for testing or configuration)
   */
  setStrategy(strategy: SimilarityStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Get current strategy info
   */
  getStrategyInfo(): { name: string; version: string } {
    return {
      name: this.strategy.name,
      version: this.strategy.version,
    };
  }
}

// ================================
// Factory Functions
// ================================

/**
 * Create similarity service with default configuration
 */
export function createSimilarityService(options: SimilarityServiceOptions = {}): SimilarityService {
  return new SimilarityService(options);
}

/**
 * Create similarity service for development/testing with metadata
 */
export function createDevSimilarityService(): SimilarityService {
  return new SimilarityService({
    includeMetadata: true,
  });
}

// ================================
// Utility Functions
// ================================

/**
 * Convert artwork database record to candidate format
 */
export function artworkToCandidate(artwork: {
  id: string;
  lat: number;
  lon: number;
  title?: string | null | undefined;
  tags?: string | null | undefined;
  type_name?: string | undefined;
}): CandidateArtwork {
  return {
    id: artwork.id,
    coordinates: { lat: artwork.lat, lon: artwork.lon },
    title: artwork.title ?? null,
    tags: artwork.tags ?? null,
    type_name: artwork.type_name ?? undefined,
  };
}

/**
 * Parse tags from various formats for similarity comparison
 */
export function parseTagsForSimilarity(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  
  try {
    const parsed = JSON.parse(tagsJson);
    
    if (Array.isArray(parsed)) {
      return parsed.filter(tag => typeof tag === 'string');
    }
    
    if (typeof parsed === 'object' && parsed !== null) {
      const values: string[] = [];
      
      // Handle different tag formats
      if ('tags' in parsed && typeof parsed.tags === 'object') {
        // Structured format: { tags: { material: 'bronze' } }
        for (const value of Object.values(parsed.tags as Record<string, unknown>)) {
          if (typeof value === 'string') {
            values.push(value);
          }
        }
      } else {
        // Flat format: { material: 'bronze', type: 'sculpture' }
        for (const value of Object.values(parsed)) {
          if (typeof value === 'string') {
            values.push(value);
          }
        }
      }
      
      return values;
    }
    
    return [];
  } catch {
    return [];
  }
}