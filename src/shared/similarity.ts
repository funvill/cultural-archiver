/**
 * Similarity scoring system for artwork deduplication.
 * Provides pluggable similarity signals for distance, title fuzzy matching, and tag overlap.
 */

import type { Coordinates } from './geo';
import { calculateDistance } from './geo';

// ================================
// Similarity Configuration Constants
// ================================

// Similarity thresholds for duplicate detection
export const SIMILARITY_THRESHOLD_WARN = 0.65; // Show warning badge
export const SIMILARITY_THRESHOLD_HIGH = 0.80; // Require explicit confirmation

// Weights for different similarity signals (must sum to 1.0)
export const SIMILARITY_WEIGHTS = {
  distance: 0.5,     // Geographic proximity
  title: 0.35,       // Title fuzzy matching
  tags: 0.15,        // Tag/type overlap
} as const;

// Distance normalization parameters
export const DISTANCE_NORMALIZATION = {
  maxDistanceMeters: 1000, // Distance beyond which similarity = 0
  optimalDistanceMeters: 50, // Distance at which similarity = 1
} as const;

// Title matching parameters
export const TITLE_MATCHING = {
  minTitleLength: 3, // Minimum title length for comparison
  stopWords: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'] as const,
} as const;

// ================================
// Similarity Types
// ================================

export interface SimilaritySignal {
  type: 'distance' | 'title' | 'tags';
  rawScore: number;      // 0-1 before weighting
  weightedScore: number; // 0-1 after applying weight
  metadata?: Record<string, unknown>;
}

export interface SimilarityResult {
  artworkId: string;
  overallScore: number;  // 0-1 composite score
  signals: SimilaritySignal[];
  threshold: 'none' | 'warn' | 'high';
  metadata: {
    distance?: number | undefined;
    title?: string | undefined;
    tags?: string[] | undefined;
  };
}

export interface SimilarityQuery {
  coordinates: Coordinates;
  title?: string;
  tags?: string[];
  radiusMeters?: number;
}

export interface CandidateArtwork {
  id: string;
  coordinates: Coordinates;
  title?: string | null;
  tags?: string | null; // JSON string or null
  type_name?: string;
  distance_meters?: number;
}

// ================================
// Similarity Strategy Interface
// ================================

export interface SimilarityStrategy {
  name: string;
  version: string;
  calculateSimilarity(query: SimilarityQuery, candidate: CandidateArtwork): SimilarityResult;
}

// ================================
// Default Similarity Implementation
// ================================

export class DefaultSimilarityStrategy implements SimilarityStrategy {
  name = 'default';
  version = '1.0.0';

  calculateSimilarity(query: SimilarityQuery, candidate: CandidateArtwork): SimilarityResult {
    const signals: SimilaritySignal[] = [];

    // Distance signal (always calculated)
    const distanceSignal = this.calculateDistanceSignal(query.coordinates, candidate.coordinates);
    signals.push(distanceSignal);

    // Title signal (if both have titles)
    if (query.title && candidate.title) {
      const titleSignal = this.calculateTitleSignal(query.title, candidate.title);
      signals.push(titleSignal);
    }

    // Tag signal (if both have tags)
    if (query.tags && candidate.tags) {
      const parsedCandidateTags = this.parseTags(candidate.tags);
      if (parsedCandidateTags.length > 0) {
        const tagSignal = this.calculateTagSignal(query.tags, parsedCandidateTags);
        signals.push(tagSignal);
      }
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(signals);

    // Determine threshold
    const threshold = this.getThreshold(overallScore);

    return {
      artworkId: candidate.id,
      overallScore,
      signals,
      threshold,
      metadata: {
        distance: candidate.distance_meters,
        title: candidate.title || undefined,
        tags: this.parseTags(candidate.tags || ''),
      },
    };
  }

  private calculateDistanceSignal(queryCoords: Coordinates, candidateCoords: Coordinates): SimilaritySignal {
    const distance = calculateDistance(queryCoords, candidateCoords);
    
    // Normalize distance to 0-1 score (closer = higher score)
    let rawScore = 0;
    if (distance <= DISTANCE_NORMALIZATION.optimalDistanceMeters) {
      rawScore = 1;
    } else if (distance <= DISTANCE_NORMALIZATION.maxDistanceMeters) {
      rawScore = 1 - (distance - DISTANCE_NORMALIZATION.optimalDistanceMeters) / 
                     (DISTANCE_NORMALIZATION.maxDistanceMeters - DISTANCE_NORMALIZATION.optimalDistanceMeters);
    }

    return {
      type: 'distance',
      rawScore,
      weightedScore: rawScore * SIMILARITY_WEIGHTS.distance,
      metadata: { distanceMeters: distance },
    };
  }

  private calculateTitleSignal(queryTitle: string, candidateTitle: string): SimilaritySignal {
    const normalizedQuery = this.normalizeTitle(queryTitle);
    const normalizedCandidate = this.normalizeTitle(candidateTitle);

    // Skip if either title is too short after normalization
    if (normalizedQuery.length < TITLE_MATCHING.minTitleLength || 
        normalizedCandidate.length < TITLE_MATCHING.minTitleLength) {
      return {
        type: 'title',
        rawScore: 0,
        weightedScore: 0,
        metadata: { reason: 'title_too_short' },
      };
    }

    // Use Jaro-Winkler similarity (simplified implementation)
    const rawScore = this.calculateJaroWinklerSimilarity(normalizedQuery, normalizedCandidate);

    return {
      type: 'title',
      rawScore,
      weightedScore: rawScore * SIMILARITY_WEIGHTS.title,
      metadata: {
        queryNormalized: normalizedQuery,
        candidateNormalized: normalizedCandidate,
      },
    };
  }

  private calculateTagSignal(queryTags: string[], candidateTags: string[]): SimilaritySignal {
    if (queryTags.length === 0 || candidateTags.length === 0) {
      return {
        type: 'tags',
        rawScore: 0,
        weightedScore: 0,
        metadata: { reason: 'no_tags_to_compare' },
      };
    }

    // Calculate Jaccard similarity (intersection / union)
    const querySet = new Set(queryTags.map(tag => tag.toLowerCase()));
    const candidateSet = new Set(candidateTags.map(tag => tag.toLowerCase()));
    
    const intersection = new Set([...querySet].filter(tag => candidateSet.has(tag)));
    const union = new Set([...querySet, ...candidateSet]);
    
    const rawScore = intersection.size / union.size;

    return {
      type: 'tags',
      rawScore,
      weightedScore: rawScore * SIMILARITY_WEIGHTS.tags,
      metadata: {
        queryTags,
        candidateTags,
        commonTags: Array.from(intersection),
        intersectionSize: intersection.size,
        unionSize: union.size,
      },
    };
  }

  private calculateOverallScore(signals: SimilaritySignal[]): number {
    // Sum weighted scores
    let totalScore = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      totalScore += signal.weightedScore;
      
      // Add the weight that was actually applied
      if (signal.type === 'distance') totalWeight += SIMILARITY_WEIGHTS.distance;
      else if (signal.type === 'title') totalWeight += SIMILARITY_WEIGHTS.title;
      else if (signal.type === 'tags') totalWeight += SIMILARITY_WEIGHTS.tags;
    }

    // If not all signals were available, normalize by the weights we actually used
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private getThreshold(score: number): 'none' | 'warn' | 'high' {
    if (score >= SIMILARITY_THRESHOLD_HIGH) return 'high';
    if (score >= SIMILARITY_THRESHOLD_WARN) return 'warn';
    return 'none';
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => !TITLE_MATCHING.stopWords.includes(word as any))
      .join(' ')
      .trim();
  }

  private parseTags(tagsJson: string): string[] {
    if (!tagsJson) return [];
    
    try {
      const parsed = JSON.parse(tagsJson);
      
      // Handle different tag formats
      if (Array.isArray(parsed)) {
        return parsed.filter(tag => typeof tag === 'string');
      } else if (typeof parsed === 'object' && parsed !== null) {
        // Extract values from key-value pairs or structured tags
        const values: string[] = [];
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'string') {
            values.push(value);
          } else if (key === 'tags' && typeof value === 'object') {
            // Handle structured format: { tags: { material: 'bronze' } }
            for (const tagValue of Object.values(value as Record<string, unknown>)) {
              if (typeof tagValue === 'string') {
                values.push(tagValue);
              }
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

  private calculateJaroWinklerSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Simplified Jaro-Winkler implementation
    const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);

    let matches = 0;

    // Find matches
    for (let i = 0; i < s1.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, s2.length);

      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    // Count transpositions
    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    const jaro = (matches / s1.length + matches / s2.length + 
                  (matches - transpositions / 2) / matches) / 3;

    // Winkler modification (give bonus for common prefix)
    let prefix = 0;
    for (let i = 0; i < Math.min(s1.length, s2.length) && i < 4; i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }

    return jaro + (0.1 * prefix * (1 - jaro));
  }
}

// ================================
// Utility Functions
// ================================

/**
 * Create a default similarity strategy instance
 */
export function createDefaultSimilarityStrategy(): SimilarityStrategy {
  return new DefaultSimilarityStrategy();
}

/**
 * Filter similarity results by threshold
 */
export function filterByThreshold(
  results: SimilarityResult[], 
  threshold: 'warn' | 'high'
): SimilarityResult[] {
  return results.filter(result => {
    if (threshold === 'warn') {
      return result.threshold === 'warn' || result.threshold === 'high';
    }
    return result.threshold === 'high';
  });
}

/**
 * Sort similarity results by score (descending)
 */
export function sortBySimilarity(results: SimilarityResult[]): SimilarityResult[] {
  return results.sort((a, b) => b.overallScore - a.overallScore);
}

/**
 * Get similarity explanation for display
 */
export function getSimilarityExplanation(result: SimilarityResult): string {
  const { signals, overallScore } = result;
  const explanations: string[] = [];

  for (const signal of signals) {
    if (signal.type === 'distance' && signal.metadata?.distanceMeters) {
      const distance = Math.round(signal.metadata.distanceMeters as number);
      explanations.push(`${distance}m away`);
    } else if (signal.type === 'title' && signal.rawScore > 0.5) {
      explanations.push('similar title');
    } else if (signal.type === 'tags' && signal.rawScore > 0.3) {
      explanations.push('matching tags');
    }
  }

  const scorePercent = Math.round(overallScore * 100);
  return explanations.length > 0 
    ? `${scorePercent}% similar (${explanations.join(', ')})`
    : `${scorePercent}% similar`;
}