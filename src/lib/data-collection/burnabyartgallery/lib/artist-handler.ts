/**
 * Artist Data Handler for Burnaby Art Gallery
 *
 * Manages artist data collection and deduplication.
 */

import type { ArtistData } from './parser.js';
import { logger } from './logger.js';

/**
 * Normalize artist names so that "Last, First" becomes "First Last".
 * Handles multiple artists separated by " and " or " & ".
 */
export function normalizeArtistName(name: string | undefined): string {
  if (!name) return '';
  // Split combined artist strings like "Last, One and Last, Two" or "A & B"
  const parts = name.split(/\s+(?:and|&)\s+/i).map(p => p.trim()).filter(Boolean);

  const normalizedParts = parts.map((part) => {
    if (part.includes(',')) {
      // "Last, First Middle" -> "First Middle Last"
      const pieces = part.split(',').map(s => s.trim()).filter(Boolean);
      if (pieces.length >= 2) {
        const last = pieces[0];
        const rest = pieces.slice(1).join(', ');
        return `${rest} ${last}`.replace(/\s+/g, ' ').trim();
      }
    }
    return part;
  });

  // Join multiple artists back using ' and '
  return normalizedParts.join(' and ');
}

export interface ArtistRecord {
  source: string;
  source_url: string;
  name: string;
  type: 'Artist';
  biography?: string;
  'birth date'?: string;
  'death date'?: string;
  websites?: string;
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

    // Normalize the stored artist name (e.g. "Fafard, Joe" -> "Joe Fafard")
    const normalized = normalizeArtistName(artistData.name);

    // Build artist record but omit empty string fields so exported JSON doesn't contain blank tags
    const base: Partial<ArtistRecord> = {
      source: this.source,
      source_url: artistData.sourceUrl,
      name: normalized || (artistData.name as string),
      type: 'Artist',
    };

    if (artistData.biography && artistData.biography.trim() !== '') {
      base.biography = artistData.biography;
    }
    if (artistData.birthDate && String(artistData.birthDate).trim() !== '') {
      base['birth date'] = String(artistData.birthDate);
    }
    if (artistData.deathDate && String(artistData.deathDate).trim() !== '') {
      base['death date'] = String(artistData.deathDate);
    }
    if (artistData.websites && String(artistData.websites).trim() !== '') {
      base.websites = String(artistData.websites);
    }

    // Cast to full ArtistRecord; missing optional fields will not be present in JSON
    this.artists.set(key, base as ArtistRecord);
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
