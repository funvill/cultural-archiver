/**
 * Mass Import Duplication Detection - Similarity Strategy
 * 
 * Implements the exact scoring algorithm specified in the PRD:
 * - Title match: +0.2 points (Levenshtein distance)
 * - Artist match: +0.2 points (split comma-separated artists)  
 * - Location proximity: +0.3 points (distance-weighted within 50m)
 * - Tag matches: +0.05 per matching tag
 * - Threshold: 0.7 default, configurable
 */

import type { Coordinates } from './geo';
import { calculateDistance } from './geo';

// ================================
// Mass Import Similarity Types
// ================================

export interface MassImportSimilarityQuery {
  coordinates: Coordinates;
  title?: string;
  artist?: string;
  tags?: Record<string, string>;
}

export interface MassImportCandidate {
  id: string;
  coordinates: Coordinates;
  title?: string | null;
  created_by?: string | null;  // User UUID who submitted the artwork
  tags?: string | null;        // JSON string containing artist and other metadata
}

export interface MassImportSimilarityResult {
  artworkId: string;
  confidenceScore: number;      // 0-1 overall score
  scoreBreakdown: {
    title: number;              // 0-0.2
    artist: number;             // 0-0.2
    location: number;           // 0-0.3
    tags: number;               // 0-N*0.05
  };
  isDuplicate: boolean;         // score >= threshold
  existingArtworkId: string;
  existingArtworkUrl: string;
}

// ================================
// Mass Import Similarity Strategy
// ================================

export class MassImportSimilarityStrategy {
  private readonly POINTS_TITLE = 0.25;      // Increased from 0.2 - title is very important for public art
  private readonly POINTS_ARTIST = 0.15;     // Decreased from 0.2 - artist format may vary  
  private readonly POINTS_LOCATION = 0.4;    // Increased from 0.3 - location is most reliable for artwork
  private readonly POINTS_PER_TAG = 0.04;    // Decreased from 0.05 - supporting evidence, not dominant
  private readonly LOCATION_RADIUS_METERS = 25; // Decreased from 50 - more precise for public art

  constructor(
    private readonly baseUrl: string = 'https://art.abluestar.com'
  ) {}

  /**
   * Calculate similarity between import item and existing artwork
   */
  calculateSimilarity(
    query: MassImportSimilarityQuery,
    candidate: MassImportCandidate,
    threshold: number = 0.7
  ): MassImportSimilarityResult {
    const scoreBreakdown = {
      title: 0,
      artist: 0,
      location: 0,
      tags: 0
    };

    // 1. Title Match (+0.2 points max)
    if (query.title != null && candidate.title != null) {
      const titleSimilarity = this.calculateTitleSimilarity(query.title, candidate.title);
      scoreBreakdown.title = titleSimilarity * this.POINTS_TITLE;
      
      // Debug logging for title matching
      if (titleSimilarity === 0 && query.title === candidate.title) {
        console.warn(`[SIMILARITY] Title mismatch despite identical strings: "${query.title}" vs "${candidate.title}"`);
      }
    }

    // 2. Artist Match (+0.2 points max)
    if (query.artist) {
      // Extract artist from candidate's tags, not from created_by (which is user UUID)
      let candidateArtist: string | null = null;
      
      if (candidate.tags) {
        try {
          const candidateTags = JSON.parse(candidate.tags);
          candidateArtist = candidateTags.artist || candidateTags.created_by || null;
        } catch (error) {
          console.warn(`[SIMILARITY] Failed to parse candidate tags:`, error);
        }
      }
      
      if (candidateArtist) {
        const artistSimilarity = this.calculateArtistSimilarity(query.artist, candidateArtist);
        scoreBreakdown.artist = artistSimilarity * this.POINTS_ARTIST;
        
        console.log(`[SIMILARITY] Artist comparison: "${query.artist}" vs "${candidateArtist}" = ${artistSimilarity.toFixed(3)}`);
      } else {
        console.log(`[SIMILARITY] No artist found in candidate tags for artwork ${candidate.id}`);
      }
    }

    // 3. Location Proximity (+0.3 points max)
    scoreBreakdown.location = this.calculateLocationSimilarity(
      query.coordinates,
      candidate.coordinates
    );

    // 4. Tag Matches (+0.05 per matching tag)
    if (query.tags && candidate.tags) {
      scoreBreakdown.tags = this.calculateTagSimilarity(
        query.tags,
        candidate.tags
      );
      
      // Debug logging for tag matching
      if (scoreBreakdown.tags === 0 && Object.keys(query.tags).length > 0) {
        console.warn(`[SIMILARITY] No tag matches found despite ${Object.keys(query.tags).length} query tags`);
        console.debug(`[SIMILARITY] Query tags:`, query.tags);
        try {
          const candidateTagsParsed = JSON.parse(candidate.tags);
          console.debug(`[SIMILARITY] Candidate tags:`, candidateTagsParsed);
        } catch (e) {
          console.debug(`[SIMILARITY] Candidate tags (raw):`, candidate.tags);
        }
      }
    }

    // Calculate total confidence score
    const confidenceScore = scoreBreakdown.title + 
                           scoreBreakdown.artist + 
                           scoreBreakdown.location + 
                           scoreBreakdown.tags;

    const isDuplicate = confidenceScore >= threshold;

    return {
      artworkId: candidate.id,
      confidenceScore,
      scoreBreakdown,
      isDuplicate,
      existingArtworkId: candidate.id,
      existingArtworkUrl: `${this.baseUrl}/artwork/${candidate.id}`
    };
  }

  /**
   * Title similarity using Levenshtein distance with standard normalization
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    const normalized1 = this.normalizeString(title1);
    const normalized2 = this.normalizeString(title2);

    // Only return 0 for null/undefined, not empty strings
    if (normalized1 == null || normalized2 == null) {
      return 0;
    }

    // Handle empty strings after normalization
    if (normalized1.length === 0 || normalized2.length === 0) {
      return normalized1.length === normalized2.length ? 1 : 0;
    }

    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    // Convert distance to similarity (0-1)
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  /**
   * Artist similarity - split comma-separated artists and match any
   */
  private calculateArtistSimilarity(artist1: string, artist2: string): number {
    const artists1 = this.splitArtists(artist1);
    const artists2 = this.splitArtists(artist2);

    let maxSimilarity = 0;

    // Check each artist from query against all candidates
    for (const queryArtist of artists1) {
      for (const candidateArtist of artists2) {
        const similarity = this.calculateTitleSimilarity(queryArtist, candidateArtist);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    }

    return maxSimilarity;
  }

  /**
   * Location proximity using exact PRD formula:
   * max(0, 0.3 * (1 - distance_meters / 50))
   */
  private calculateLocationSimilarity(coords1: Coordinates, coords2: Coordinates): number {
    const distanceMeters = calculateDistance(coords1, coords2);
    
    // PRD formula: max(0, 0.3 * (1 - distance_meters / 50))
    return Math.max(0, this.POINTS_LOCATION * (1 - distanceMeters / this.LOCATION_RADIUS_METERS));
  }

  /**
   * Tag matches - fuzzy match on labels and values, +0.05 per match
   */
  private calculateTagSimilarity(queryTags: Record<string, string>, candidateTagsJson: string): number {
    let candidateTags: Record<string, string>;
    
    try {
      const parsed = JSON.parse(candidateTagsJson);
      
      // Handle different tag formats
      if (parsed.tags && typeof parsed.tags === 'object') {
        candidateTags = parsed.tags;
      } else if (typeof parsed === 'object') {
        candidateTags = parsed;
      } else {
        return 0;
      }
    } catch {
      return 0;
    }

    let matchCount = 0;
    const queryEntries = Object.entries(queryTags);
    const candidateEntries = Object.entries(candidateTags);

    // Check for fuzzy matches on both labels and values
    for (const [queryLabel, queryValue] of queryEntries) {
      let matched = false;
      
      for (const [candidateLabel, candidateValue] of candidateEntries) {
        // Exact label match with exact value match gets priority
        if (queryLabel === candidateLabel && String(queryValue) === String(candidateValue)) {
          matchCount++;
          matched = true;
          break;
        }
        
        // Fuzzy label match
        if (this.fuzzyStringMatch(queryLabel, candidateLabel)) {
          matchCount++;
          matched = true;
          break;
        }
        
        // Fuzzy value match (only if no label match found yet)
        if (!matched && this.fuzzyStringMatch(String(queryValue), String(candidateValue))) {
          matchCount++;
          matched = true;
          break;
        }
      }
    }

    return matchCount * this.POINTS_PER_TAG;
  }

  /**
   * Normalize string for comparison: lowercase + remove punctuation + trim
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .trim();
  }

  /**
   * Split artist names on separators (&, and, ,)
   */
  private splitArtists(artistString: string): string[] {
    return artistString
      .split(/[&,]|\band\b/i)
      .map(artist => artist.trim())
      .filter(artist => artist.length > 0);
  }

  /**
   * Fuzzy string matching for tags (simple normalization + equality)
   */
  private fuzzyStringMatch(str1: string, str2: string): boolean {
    const normalized1 = this.normalizeString(str1);
    const normalized2 = this.normalizeString(str2);
    return normalized1 === normalized2;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create matrix
    const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= len1; i++) {
      matrix[i]![0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0]![j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j]! + 1,     // deletion
            matrix[i]![j - 1]! + 1,     // insertion
            matrix[i - 1]![j - 1]! + 1  // substitution
          );
        }
      }
    }

    return matrix[len1]![len2]!;
  }
}

// ================================
// Utility Functions
// ================================

/**
 * Create a mass import similarity strategy instance
 */
export function createMassImportSimilarityStrategy(baseUrl?: string): MassImportSimilarityStrategy {
  return new MassImportSimilarityStrategy(baseUrl);
}