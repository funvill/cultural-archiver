/**
 * Artist Auto-Creation Service for Mass Import V2
 * 
 * Handles automatic artist creation and linking for mass import operations:
 * 1. Fuzzy search for existing artists with high similarity threshold (>95%)
 * 2. Auto-create artist records when createMissingArtists flag is enabled
 * 3. Link artworks to artists via artwork_artists table
 * 4. Handle multiple artist names from single artwork
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ArtworkArtistRecord } from '../../shared/types';
import { createDatabaseService } from './database';
import type { RawImportData } from '../../shared/mass-import';
import { generateUUID } from '../../shared/constants';

// ================================
// Service Types
// ================================

export interface ArtistMatchResult {
  id: string;
  name: string;
  score: number; // similarity score 0-1
}

export interface ArtistAutoCreationResult {
  artistId: string;
  wasCreated: boolean; // true if new artist, false if existing
  linkedToArtwork: boolean;
  name: string;
  score?: number; // similarity score for existing matches
}

export interface ArtistAutoCreationConfig {
  createMissingArtists: boolean;
  similarityThreshold: number; // default: 0.95 for strong matches
  autoLinkArtwork: boolean; // default: true
  systemUserToken: string;
}

export interface ArtistLinkingResult {
  artworkId: string;
  linkedArtistIds: string[];
  newArtistsCreated: number;
  existingArtistsLinked: number;
  errors: string[];
}

// ================================
// Artist Auto-Creation Service
// ================================

export class ArtistAutoCreationService {
  private db: ReturnType<typeof createDatabaseService>;

  constructor(database: D1Database) {
    this.db = createDatabaseService(database);
  }

  /**
   * Process artist names from artwork data and handle creation/linking
   */
  async processArtworkArtists(
    artworkId: string,
    artworkData: RawImportData,
    config: ArtistAutoCreationConfig
  ): Promise<ArtistLinkingResult> {
    const result: ArtistLinkingResult = {
      artworkId,
      linkedArtistIds: [],
      newArtistsCreated: 0,
      existingArtistsLinked: 0,
      errors: []
    };

    // Extract artist names from artwork data
    const artistNames = this.extractArtistNames(artworkData);
    
    if (artistNames.length === 0) {
      console.log(`[ARTIST_AUTO] No artist names found for artwork ${artworkId}`);
      return result;
    }

    console.log(`[ARTIST_AUTO] Processing ${artistNames.length} artists for artwork ${artworkId}: ${artistNames.join(', ')}`);

    // Process each artist name
    for (const artistName of artistNames) {
      try {
        const artistResult = await this.processSingleArtist(artistName, artworkData, config);
        
        if (artistResult.artistId) {
          // Link artist to artwork
          if (config.autoLinkArtwork) {
            await this.linkArtworkToArtist(artworkId, artistResult.artistId, 'primary');
            result.linkedArtistIds.push(artistResult.artistId);
            
            if (artistResult.wasCreated) {
              result.newArtistsCreated++;
              console.log(`[ARTIST_AUTO] Created and linked new artist: ${artistName} (${artistResult.artistId})`);
            } else {
              result.existingArtistsLinked++;
              console.log(`[ARTIST_AUTO] Linked to existing artist: ${artistName} (${artistResult.artistId}), score: ${artistResult.score?.toFixed(3)}`);
            }
          }
        }
      } catch (error) {
        const errorMsg = `Failed to process artist "${artistName}": ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        console.error(`[ARTIST_AUTO] ${errorMsg}`);
      }
    }

    console.log(`[ARTIST_AUTO] Completed processing: ${result.newArtistsCreated} created, ${result.existingArtistsLinked} linked, ${result.errors.length} errors`);
    return result;
  }

  /**
   * Process a single artist name - find existing or create new
   */
  async processSingleArtist(
    artistName: string,
    artworkData: RawImportData,
    config: ArtistAutoCreationConfig
  ): Promise<ArtistAutoCreationResult> {
    // 1. Search for existing artists with fuzzy matching
    const existingMatches = await this.findMatchingArtists(artistName);
    
    // 2. Check for high-confidence match
    const strongMatch = existingMatches.find(match => match.score >= config.similarityThreshold);
    
    if (strongMatch) {
      console.log(`[ARTIST_AUTO] Strong match found for "${artistName}": ${strongMatch.name} (score: ${strongMatch.score.toFixed(3)})`);
      
      return {
        artistId: strongMatch.id,
        wasCreated: false,
        linkedToArtwork: false, // Will be handled by caller
        name: strongMatch.name,
        score: strongMatch.score
      };
    }

    // 3. Create new artist if configured to do so
    if (config.createMissingArtists) {
      const newArtistId = await this.createArtistFromArtworkData(artistName, artworkData, config);
      
      console.log(`[ARTIST_AUTO] Created new artist for "${artistName}": ${newArtistId}`);
      
      return {
        artistId: newArtistId,
        wasCreated: true,
        linkedToArtwork: false, // Will be handled by caller
        name: artistName
      };
    }

    // 4. No match found and not configured to create
    console.log(`[ARTIST_AUTO] No strong match found for "${artistName}" and createMissingArtists is disabled`);
    
    throw new Error(`Artist "${artistName}" not found and auto-creation is disabled`);
  }

  /**
   * Find existing artists with fuzzy name matching
   */
  async findMatchingArtists(searchName: string): Promise<ArtistMatchResult[]> {
    // Get all approved artists for fuzzy matching
    const result = await this.db.db.prepare(`
      SELECT id, name, description, tags
      FROM artists
      WHERE status = 'approved'
      ORDER BY name
    `).all();

    const allArtists = (result.results || []) as any[];
    const matches: ArtistMatchResult[] = [];

    // Calculate similarity scores for each artist
    for (const artist of allArtists) {
      const score = this.calculateNameSimilarity(searchName, artist.name as string);
      
      if (score > 0.5) { // Only include reasonable matches
        matches.push({
          id: artist.id as string,
          name: artist.name as string,
          score
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);
    
    console.log(`[ARTIST_AUTO] Found ${matches.length} potential matches for "${searchName}"`);
    
    return matches;
  }

  /**
   * Create new artist record from artwork data
   */
  async createArtistFromArtworkData(
    artistName: string,
    artworkData: RawImportData,
    _config: ArtistAutoCreationConfig // Prefix with underscore to indicate intentionally unused
  ): Promise<string> {
    const artistId = generateUUID();
    const timestamp = new Date().toISOString();

    // Build artist tags from source data
    const artistTags = {
      source: artworkData.source,
      created_reason: 'auto_created_from_artwork',
      original_artwork_source: artworkData.externalId || '',
      import_batch: timestamp,
      auto_created: true
    };

    // Create artist record
    await this.db.db.prepare(`
      INSERT INTO artists (
        id, name, description, tags, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'approved', ?, ?)
    `).bind(
      artistId,
      artistName,
      null, // Bio will be filled by future edits
      JSON.stringify(artistTags),
      timestamp,
      timestamp
    ).run();

    console.log(`[ARTIST_AUTO] Created artist record: ${artistId} for "${artistName}"`);
    
    return artistId;
  }

  /**
   * Link artwork to artist via artwork_artists table
   */
  async linkArtworkToArtist(
    artworkId: string,
    artistId: string,
    role: string = 'primary'
  ): Promise<void> {
    // Check if link already exists
    const existing = await this.db.db.prepare(`
      SELECT artwork_id FROM artwork_artists 
      WHERE artwork_id = ? AND artist_id = ?
    `).bind(artworkId, artistId).first();

    if (existing) {
      console.log(`[ARTIST_AUTO] Link already exists between artwork ${artworkId} and artist ${artistId}`);
      return;
    }

    // Create the link
    await this.db.db.prepare(`
      INSERT INTO artwork_artists (artwork_id, artist_id, role, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).bind(artworkId, artistId, role).run();

    console.log(`[ARTIST_AUTO] Linked artwork ${artworkId} to artist ${artistId} with role "${role}"`);
  }

  /**
   * Get artists linked to an artwork
   */
  async getArtworkArtists(artworkId: string): Promise<ArtworkArtistRecord[]> {
    const result = await this.db.db.prepare(`
      SELECT aa.artwork_id, aa.artist_id, aa.role, aa.created_at, a.name
      FROM artwork_artists aa
      JOIN artists a ON aa.artist_id = a.id
      WHERE aa.artwork_id = ?
      ORDER BY aa.created_at
    `).bind(artworkId).all();

    return (result.results || []).map((row: any) => ({
      artwork_id: row.artwork_id as string,
      artist_id: row.artist_id as string,
      role: row.role as string,
      created_at: row.created_at as string
    }));
  }

  // ================================
  // Private Helper Methods
  // ================================

  /**
   * Extract artist names from artwork data
   */
  private extractArtistNames(artworkData: RawImportData): string[] {
    const names: string[] = [];

    // Check artist field
    if (artworkData.artist) {
      names.push(...this.parseArtistString(artworkData.artist));
    }

    // Check created_by field
    if (artworkData.created_by) {
      names.push(...this.parseArtistString(artworkData.created_by));
    }

    // Remove duplicates and empty strings
    return [...new Set(names.filter(name => name.trim().length > 0))];
  }

  /**
   * Parse artist string that might contain multiple names
   */
  private parseArtistString(artistStr: string): string[] {
    // Handle common separators: comma, semicolon, ampersand, "and"
    const separators = /[,;]+|\s+and\s+|\s*&\s*/i;
    
    return artistStr
      .split(separators)
      .map(name => name.trim())
      .filter(name => name.length > 0);
  }

  /**
   * Calculate name similarity using normalized string matching
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;
    
    // Normalize names: lowercase, remove extra spaces
    const n1 = name1.toLowerCase().replace(/\s+/g, ' ').trim();
    const n2 = name2.toLowerCase().replace(/\s+/g, ' ').trim();
    
    if (n1 === n2) return 1.0;
    
    // Use Levenshtein distance for similarity
    const distance = this.levenshteinDistance(n1, n2);
    const maxLength = Math.max(n1.length, n2.length);
    
    return maxLength === 0 ? 0 : 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    // Initialize matrix with proper dimensions and default values
    const matrix: number[][] = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = new Array(str1.length + 1).fill(0);
    }
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i]![0] = i; // Non-null assertion since we just created the array
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j; // Non-null assertion since we just created the array
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1,
            matrix[i]![j - 1]! + 1,
            matrix[i - 1]![j]! + 1
          );
        }
      }
    }
    
    return matrix[str2.length]![str1.length]!; // Non-null assertion for final result
  }
}

/**
 * Factory function to create the service
 */
export function createArtistAutoCreationService(database: D1Database): ArtistAutoCreationService {
  return new ArtistAutoCreationService(database);
}