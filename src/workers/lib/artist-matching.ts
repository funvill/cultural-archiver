/**
 * Artist Matching Service for Mass Import
 * 
 * Provides artist name normalization, matching algorithms, and artist creation 
 * functionality for the mass import system.
 */

import { DatabaseService } from './database';

export interface ArtistMatch {
  id: string;
  name: string;
  score: number;
  matchType: 'exact' | 'token' | 'fuzzy';
}

export interface ArtistMatchingResult {
  matches: ArtistMatch[];
  isExact: boolean;
  isAmbiguous: boolean;
  bestMatch?: ArtistMatch | undefined;
}

export interface VancouverArtistData {
  artistid: number;
  firstname: string;
  lastname: string;
  artisturl?: string;
  biography?: string;
  country?: string;
  photo?: string;
  website?: string;
}

export class ArtistMatchingService {
  constructor(private db: DatabaseService) {}

  /**
   * Normalize artist name for consistent matching
   */
  normalizeArtistName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .toLowerCase()
      .normalize('NFKD') // Decompose diacritics
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s-]/g, ''); // Remove punctuation except hyphens
  }

  /**
   * Find matching artists using multi-pass algorithm
   */
  async findMatchingArtists(artistName: string): Promise<ArtistMatchingResult> {
    if (!artistName?.trim()) {
      return { matches: [], isExact: false, isAmbiguous: false };
    }

    const normalizedName = this.normalizeArtistName(artistName);
    const matches: ArtistMatch[] = [];

    // Pass 1: Exact match
    const exactMatches = await this.db.searchArtistsByNormalizedName(normalizedName);
    for (const match of exactMatches) {
      matches.push({
        ...match,
        score: 1.0,
        matchType: 'exact'
      });
    }

    // If we have exact matches, return immediately
    if (matches.length > 0) {
      return {
        matches,
        isExact: true,
        isAmbiguous: matches.length > 1,
        bestMatch: matches[0]
      };
    }

    // Pass 2: Token-based matching
    const tokens = normalizedName.split(' ').filter(t => t.length > 1); // Ignore single characters
    if (tokens.length > 0) {
      const tokenMatches = await this.db.searchArtistsByTokens(tokens);
      for (const match of tokenMatches) {
        if (match.score >= 0.7) { // Only include high-confidence token matches
          matches.push({
            id: match.id,
            name: match.name,
            score: match.score,
            matchType: 'token'
          });
        }
      }
    }

    // Pass 3: Fuzzy matching (simplified implementation)
    if (matches.length === 0) {
      // For now, we'll skip complex fuzzy matching and rely on exact + token matching
      // This can be enhanced with Levenshtein distance or similar algorithms
    }

    // Sort matches by score (highest first)
    matches.sort((a, b) => b.score - a.score);

    // Determine if results are ambiguous (multiple high-scoring matches)
    const highScoreMatches = matches.filter(m => m.score >= 0.85);
    const isAmbiguous = highScoreMatches.length > 1;

    return {
      matches,
      isExact: false,
      isAmbiguous,
      bestMatch: matches.length > 0 ? matches[0] : undefined
    };
  }

  /**
   * Create artist from Vancouver JSON data
   */
  async createArtistFromVancouverData(
    artistName: string,
    vancouverData: VancouverArtistData
  ): Promise<string> {
    const fullName = `${vancouverData.firstname} ${vancouverData.lastname}`.trim();
    
    // Build description from biography
    const description = vancouverData.biography || undefined;
    
    // Build tags object with Vancouver metadata
    const tags: Record<string, string> = {};
    if (vancouverData.country) tags.country = vancouverData.country;
    if (vancouverData.website) tags.website = vancouverData.website;
    if (vancouverData.artisturl) tags.vancouver_url = vancouverData.artisturl;
    if (vancouverData.photo) tags.photo_url = vancouverData.photo;

    return await this.db.createArtistFromMassImport({
      name: fullName,
      ...(description && { description }),
      tags,
      source: 'vancouver-mass-import',
      sourceData: {
        artistid: vancouverData.artistid,
        original_name: artistName
      }
    });
  }

  /**
   * Load Vancouver artist data from JSON file
   */
  loadVancouverArtistData(): VancouverArtistData[] {
    try {
      // Note: In a real implementation, this would load from the JSON file
      // For now, we'll return an empty array and handle the file loading in the endpoint
      return [];
    } catch (error) {
      console.warn('Failed to load Vancouver artist data:', error);
      return [];
    }
  }

  /**
   * Find Vancouver artist data by name
   */
  findVancouverArtistByName(
    artistName: string,
    vancouverData: VancouverArtistData[]
  ): VancouverArtistData | null {
    if (!artistName?.trim() || vancouverData.length === 0) {
      return null;
    }

    const normalizedSearchName = this.normalizeArtistName(artistName);

    // Try exact match first
    for (const data of vancouverData) {
      const fullName = `${data.firstname} ${data.lastname}`.trim();
      const normalizedFullName = this.normalizeArtistName(fullName);
      
      if (normalizedFullName === normalizedSearchName) {
        return data;
      }
    }

    // Try matching individual name parts
    const searchTokens = normalizedSearchName.split(' ').filter(t => t.length > 1);
    for (const data of vancouverData) {
      const normalizedFirstName = this.normalizeArtistName(data.firstname);
      const normalizedLastName = this.normalizeArtistName(data.lastname);
      
      const matchesFirst = searchTokens.some(token => 
        normalizedFirstName.includes(token) || token.includes(normalizedFirstName)
      );
      const matchesLast = searchTokens.some(token => 
        normalizedLastName.includes(token) || token.includes(normalizedLastName)
      );

      if (matchesFirst && matchesLast) {
        return data;
      }
    }

    return null;
  }

  /**
   * Generate search page URL for artist
   */
  generateArtistSearchUrl(artistName: string): string {
    const encoded = encodeURIComponent(artistName.trim());
    return `/search?artist=${encoded}`;
  }
}