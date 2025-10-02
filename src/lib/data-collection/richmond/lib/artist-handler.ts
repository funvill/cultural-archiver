/**
 * Artist Handler for Richmond Public Art Registry
 *
 * Manages artist data collection and deduplication
 */

import type { ArtistData } from './parser.js';
import { logger } from './logger.js';

export interface ArtistRecord {
  id: string;
  name: string;
  sourceUrl: string;
  location?: string | undefined;
  biography?: string | undefined;
}

export class ArtistHandler {
  private artistMap = new Map<string, ArtistRecord>();
  private seenUrls = new Set<string>();

  /**
   * Add artist data to collection
   */
  addArtist(artistData: ArtistData): void {
    // Extract ID from URL
    const idMatch = artistData.sourceUrl.match(/ID=(\d+)/);
    if (!idMatch || !idMatch[1]) {
      logger.warn(`Could not extract artist ID from URL: ${artistData.sourceUrl}`);
      return;
    }

    const id = `richmond-artist-${idMatch[1]}`;

    // Check if already processed
    if (this.artistMap.has(id)) {
      logger.debug(`Artist already processed: ${id}`);
      return;
    }

    const record: ArtistRecord = {
      id,
      name: artistData.name,
      sourceUrl: artistData.sourceUrl,
      location: artistData.location,
      biography: artistData.biography,
    };

    this.artistMap.set(id, record);
    logger.debug(`Added artist: ${id} - ${artistData.name}`);
  }

  /**
   * Check if artist URL has been seen before
   */
  hasSeenUrl(url: string): boolean {
    return this.seenUrls.has(url);
  }

  /**
   * Mark URL as seen
   */
  markUrlAsSeen(url: string): void {
    this.seenUrls.add(url);
  }

  /**
   * Get all unique artist URLs that need to be fetched
   */
  getUrlsToFetch(artistUrls: string[]): string[] {
    const uniqueUrls = new Set(artistUrls);
    const urlsToFetch: string[] = [];

    for (const url of uniqueUrls) {
      if (!this.hasSeenUrl(url)) {
        urlsToFetch.push(url);
        this.markUrlAsSeen(url);
      }
    }

    return urlsToFetch;
  }

  /**
   * Get all artists as array
   */
  getArtists(): ArtistRecord[] {
    return Array.from(this.artistMap.values());
  }

  /**
   * Get artist count
   */
  getCount(): number {
    return this.artistMap.size;
  }
}
