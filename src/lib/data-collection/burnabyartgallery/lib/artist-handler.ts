/**
 * Artist Data Handler for Burnaby Art Gallery
 *
 * Manages artist data collection and deduplication.
 */

import type { ArtistData } from './parser.js';
import { logger } from './logger.js';

export interface ArtistRecord {
  source: string;
  source_url: string;
  name: string;
  type: 'Artist';
  biography: string;
  'birth date': string;
  'death date': string;
  websites: string;
}

export class ArtistHandler {
  private readonly source = 'https://burnabyartgallery.ca';
  private artists: Map<string, ArtistRecord> = new Map();

  /**
   * Add or update artist data
   */
  addArtist(artistData: Partial<ArtistData>): void {
    if (!artistData.name || !artistData.sourceUrl) {
      logger.warn('Skipping artist without name or source URL');
      return;
    }

    // Use source URL as the unique key for deduplication
    const key = artistData.sourceUrl;

    if (this.artists.has(key)) {
      logger.debug(`Artist already exists, skipping: ${artistData.name}`);
      return;
    }

    const artist: ArtistRecord = {
      source: this.source,
      source_url: artistData.sourceUrl,
      name: artistData.name,
      type: 'Artist',
      biography: artistData.biography || '',
      'birth date': artistData.birthDate || '',
      'death date': artistData.deathDate || '',
      websites: artistData.websites || '',
    };

    this.artists.set(key, artist);
    logger.debug(`Added artist: ${artist.name}`);
  }

  /**
   * Get all unique artists
   */
  getAllArtists(): ArtistRecord[] {
    const artists = Array.from(this.artists.values());
    logger.info(`Total unique artists collected: ${artists.length}`);
    return artists;
  }

  /**
   * Get artist count
   */
  getCount(): number {
    return this.artists.size;
  }

  /**
   * Check if artist already exists
   */
  hasArtist(sourceUrl: string): boolean {
    return this.artists.has(sourceUrl);
  }
}
