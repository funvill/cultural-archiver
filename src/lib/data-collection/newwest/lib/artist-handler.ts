/**
 * Artist Handler for New Westminster Public Art Registry
 *
 * Manages artist data collection and deduplication.
 */

import type { ArtistData } from './parser.js';
import { logger } from './logger.js';

export interface NormalizedArtist {
  id: string;
  name: string;
  biography?: string;
  birthYear?: string;
  deathYear?: string;
  website?: string;
  sourceUrl: string;
  parsedAt: string;
}

export class ArtistHandler {
  private artists: Map<string, NormalizedArtist> = new Map();

  /**
   * Add an artist to the collection (with deduplication)
   */
  addArtist(artistData: ArtistData): void {
    const id = this.generateId(artistData);
    
    if (this.artists.has(id)) {
      logger.debug(`Artist already exists: ${artistData.name}`);
      return;
    }

    const normalized: NormalizedArtist = {
      id,
      name: artistData.name,
      ...(artistData.biography !== undefined && { biography: artistData.biography }),
      ...(artistData.birthYear !== undefined && { birthYear: artistData.birthYear }),
      ...(artistData.deathYear !== undefined && { deathYear: artistData.deathYear }),
      ...(artistData.website !== undefined && { website: artistData.website }),
      sourceUrl: artistData.sourceUrl,
      parsedAt: new Date().toISOString()
    };

    this.artists.set(id, normalized);
    logger.debug(`Added artist: ${artistData.name} (${id})`);
  }

  /**
   * Check if an artist exists by URL
   */
  hasArtist(url: string): boolean {
    return Array.from(this.artists.values()).some(artist => artist.sourceUrl === url);
  }

  /**
   * Get artist by ID
   */
  getArtist(id: string): NormalizedArtist | undefined {
    return this.artists.get(id);
  }

  /**
   * Get all artists
   */
  getAllArtists(): NormalizedArtist[] {
    return Array.from(this.artists.values());
  }

  /**
   * Get count of unique artists
   */
  getCount(): number {
    return this.artists.size;
  }

  /**
   * Generate a unique ID for an artist
   */
  private generateId(artistData: ArtistData): string {
    // Use canonical URL as ID if available
    if (artistData.sourceUrl) {
      return this.slugify(artistData.sourceUrl);
    }

    // Fallback to name-based ID
    return this.slugify(artistData.name);
  }

  /**
   * Convert string to URL-safe slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Normalize artist name for comparison
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find artist by name (fuzzy match)
   */
  findByName(name: string): NormalizedArtist | undefined {
    const normalized = this.normalizeName(name);
    
    for (const artist of this.artists.values()) {
      if (this.normalizeName(artist.name) === normalized) {
        return artist;
      }
    }

    return undefined;
  }

  /**
   * Get artists with incomplete biographies
   */
  getArtistsWithoutBiography(): NormalizedArtist[] {
    return Array.from(this.artists.values()).filter(
      artist => !artist.biography || artist.biography.length < 50
    );
  }

  /**
   * Print summary statistics
   */
  printSummary(): void {
    const total = this.getCount();
    const withBio = Array.from(this.artists.values()).filter(a => a.biography && a.biography.length > 50).length;
    const withDates = Array.from(this.artists.values()).filter(a => a.birthYear || a.deathYear).length;

    logger.info('\n📊 Artist Collection Summary:');
    logger.info(`   Total artists: ${total}`);
    logger.info(`   With biography: ${withBio} (${Math.round(withBio / total * 100)}%)`);
    logger.info(`   With dates: ${withDates} (${Math.round(withDates / total * 100)}%)`);
  }
}
