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
    console.log(`[ARTIST_MATCHING_DEBUG] Starting artist search for: "${artistName}"`);

    if (!artistName?.trim()) {
      console.log(`[ARTIST_MATCHING_DEBUG] Empty artist name provided, returning empty result`);
      return { matches: [], isExact: false, isAmbiguous: false };
    }

    const normalizedName = this.normalizeArtistName(artistName);
    console.log(
      `[ARTIST_MATCHING_DEBUG] Normalized artist name: "${artistName}" -> "${normalizedName}"`
    );
    const matches: ArtistMatch[] = [];

    // Pass 1: Exact match
    console.log(`[ARTIST_MATCHING_DEBUG] Pass 1: Searching for exact matches`);
    const exactMatches = await this.db.searchArtistsByNormalizedName(normalizedName);
    console.log(`[ARTIST_MATCHING_DEBUG] Found ${exactMatches.length} exact matches`);

    for (const match of exactMatches) {
      console.log(
        `[ARTIST_MATCHING_DEBUG] Exact match found: ID=${match.id}, Name="${match.name}"`
      );
      matches.push({
        ...match,
        score: 1.0,
        matchType: 'exact',
      });
    }

    // If we have exact matches, return immediately
    if (matches.length > 0) {
      const result = {
        matches,
        isExact: true,
        isAmbiguous: matches.length > 1,
        bestMatch: matches[0],
      };
      console.log(
        `[ARTIST_MATCHING_DEBUG] Returning exact matches: ${matches.length} found, ambiguous=${result.isAmbiguous}, best="${result.bestMatch?.name}"`
      );
      return result;
    }

    // Pass 2: Token-based matching
    console.log(`[ARTIST_MATCHING_DEBUG] Pass 2: No exact matches, trying token-based matching`);
    const tokens = normalizedName.split(' ').filter(t => t.length > 1); // Ignore single characters
    console.log(`[ARTIST_MATCHING_DEBUG] Using tokens: [${tokens.join(', ')}]`);

    if (tokens.length > 0) {
      const tokenMatches = await this.db.searchArtistsByTokens(tokens);
      console.log(`[ARTIST_MATCHING_DEBUG] Found ${tokenMatches.length} token matches`);

      for (const match of tokenMatches) {
        if (match.score >= 0.7) {
          // Only include high-confidence token matches
          console.log(
            `[ARTIST_MATCHING_DEBUG] High-confidence token match: ID=${match.id}, Name="${match.name}", Score=${match.score}`
          );
          matches.push({
            id: match.id,
            name: match.name,
            score: match.score,
            matchType: 'token',
          });
        } else {
          console.log(
            `[ARTIST_MATCHING_DEBUG] Low-confidence token match discarded: ID=${match.id}, Name="${match.name}", Score=${match.score}`
          );
        }
      }
    }

    // Pass 3: Fuzzy matching (simplified implementation)
    if (matches.length === 0) {
      console.log(
        `[ARTIST_MATCHING_DEBUG] Pass 3: No token matches, fuzzy matching not implemented yet`
      );
      // For now, we'll skip complex fuzzy matching and rely on exact + token matching
      // This can be enhanced with Levenshtein distance or similar algorithms
    }

    // Sort matches by score (highest first)
    matches.sort((a, b) => b.score - a.score);
    console.log(`[ARTIST_MATCHING_DEBUG] Sorted ${matches.length} matches by score`);

    // Determine if results are ambiguous (multiple high-scoring matches)
    const highScoreMatches = matches.filter(m => m.score >= 0.85);
    const isAmbiguous = highScoreMatches.length > 1;
    console.log(
      `[ARTIST_MATCHING_DEBUG] High-score matches (≥0.85): ${highScoreMatches.length}, isAmbiguous=${isAmbiguous}`
    );

    const result = {
      matches,
      isExact: false,
      isAmbiguous,
      bestMatch: matches.length > 0 ? matches[0] : undefined,
    };

    console.log(
      `[ARTIST_MATCHING_DEBUG] Final result: ${matches.length} matches, bestMatch="${result.bestMatch?.name}" (score=${result.bestMatch?.score})`
    );

    return result;
  }

  /**
   * Create artist from Vancouver JSON data
   */
  async createArtistFromVancouverData(
    artistName: string,
    vancouverData: VancouverArtistData
  ): Promise<string> {
    console.log(`[ARTIST_CREATION_DEBUG] Creating artist from Vancouver data for: "${artistName}"`);
    console.log(
      `[ARTIST_CREATION_DEBUG] Vancouver data: ID=${vancouverData.artistid}, firstname="${vancouverData.firstname}", lastname="${vancouverData.lastname}"`
    );

    const fullName = `${vancouverData.firstname} ${vancouverData.lastname}`.trim();
    console.log(`[ARTIST_CREATION_DEBUG] Constructed full name: "${fullName}"`);

    // Build description from biography
    const description = vancouverData.biography || undefined;
    if (description) {
      console.log(
        `[ARTIST_CREATION_DEBUG] Found biography (${description.length} chars): "${description.substring(0, 100)}..."`
      );
    } else {
      console.log(`[ARTIST_CREATION_DEBUG] No biography available`);
    }

    // Build tags object with Vancouver metadata
    const tags: Record<string, string> = {};
    if (vancouverData.country) {
      tags.country = vancouverData.country;
      console.log(`[ARTIST_CREATION_DEBUG] Added country tag: "${vancouverData.country}"`);
    }
    if (vancouverData.website) {
      tags.website = vancouverData.website;
      console.log(`[ARTIST_CREATION_DEBUG] Added website tag: "${vancouverData.website}"`);
    }
    if (vancouverData.artisturl) {
      tags.vancouver_url = vancouverData.artisturl;
      console.log(`[ARTIST_CREATION_DEBUG] Added Vancouver URL tag: "${vancouverData.artisturl}"`);
    }
    if (vancouverData.photo) {
      tags.photo_url = vancouverData.photo;
      console.log(`[ARTIST_CREATION_DEBUG] Added photo URL tag: "${vancouverData.photo}"`);
    }

    console.log(`[ARTIST_CREATION_DEBUG] Final tags object: ${JSON.stringify(tags)}`);

    const artistId = await this.db.createArtistFromMassImport({
      name: fullName,
      ...(description && { description }),
      tags,
      source: 'vancouver-mass-import',
      sourceData: {
        artistid: vancouverData.artistid,
        original_name: artistName,
      },
    });

    console.log(`[ARTIST_CREATION_DEBUG] Successfully created artist with ID: ${artistId}`);
    return artistId;
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
    console.log(
      `[VANCOUVER_ARTIST_LOOKUP_DEBUG] Searching for Vancouver artist: "${artistName}" in ${vancouverData.length} records`
    );

    if (!artistName?.trim() || vancouverData.length === 0) {
      console.log(
        `[VANCOUVER_ARTIST_LOOKUP_DEBUG] Empty search name or no Vancouver data, returning null`
      );
      return null;
    }

    const normalizedSearchName = this.normalizeArtistName(artistName);
    console.log(
      `[VANCOUVER_ARTIST_LOOKUP_DEBUG] Normalized search name: "${normalizedSearchName}"`
    );

    // Try exact match first
    console.log(`[VANCOUVER_ARTIST_LOOKUP_DEBUG] Pass 1: Trying exact name match`);
    for (const data of vancouverData) {
      const fullName = `${data.firstname} ${data.lastname}`.trim();
      const normalizedFullName = this.normalizeArtistName(fullName);

      console.log(
        `[VANCOUVER_ARTIST_LOOKUP_DEBUG] Comparing "${normalizedSearchName}" vs "${normalizedFullName}" (ID: ${data.artistid})`
      );

      if (normalizedFullName === normalizedSearchName) {
        console.log(
          `[VANCOUVER_ARTIST_LOOKUP_DEBUG] Exact match found: ID=${data.artistid}, Name="${fullName}"`
        );
        return data;
      }
    }

    console.log(
      `[VANCOUVER_ARTIST_LOOKUP_DEBUG] Pass 2: No exact match, trying token-based matching`
    );

    // Try matching individual name parts
    const searchTokens = normalizedSearchName.split(' ').filter(t => t.length > 1);
    console.log(`[VANCOUVER_ARTIST_LOOKUP_DEBUG] Search tokens: [${searchTokens.join(', ')}]`);

    for (const data of vancouverData) {
      const normalizedFirstName = this.normalizeArtistName(data.firstname);
      const normalizedLastName = this.normalizeArtistName(data.lastname);

      const matchesFirst = searchTokens.some(
        token => normalizedFirstName.includes(token) || token.includes(normalizedFirstName)
      );
      const matchesLast = searchTokens.some(
        token => normalizedLastName.includes(token) || token.includes(normalizedLastName)
      );

      console.log(
        `[VANCOUVER_ARTIST_LOOKUP_DEBUG] Testing ID=${data.artistid} "${data.firstname} ${data.lastname}": first_match=${matchesFirst}, last_match=${matchesLast}`
      );

      if (matchesFirst && matchesLast) {
        const fullName = `${data.firstname} ${data.lastname}`.trim();
        console.log(
          `[VANCOUVER_ARTIST_LOOKUP_DEBUG] Token match found: ID=${data.artistid}, Name="${fullName}"`
        );
        return data;
      }
    }

    console.log(`[VANCOUVER_ARTIST_LOOKUP_DEBUG] No Vancouver artist found for "${artistName}"`);
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
