/**
 * Surrey Public Art Collection Scraper
 *
 * Scrapes public art data from https://www.surrey.ca/arts-culture/public-art/permanent-public-art-collection
 * Extracts artwork details, artist information, and photos.
 */

import * as cheerio from 'cheerio';
import type { ArtworkFeature, ArtistRecord } from '../shared/types';
import { ScraperBase } from '../shared/scraper-base';
import { logger } from '../shared/logger';
import { LocationService } from '../../../lib/location/service';

export class SurreyCAScraper extends ScraperBase {
  private readonly baseUrl = 'https://www.surrey.ca';
  private readonly collectionUrl = `${this.baseUrl}/arts-culture/public-art/permanent-public-art-collection`;
  private readonly locationService: LocationService;

  constructor() {
    super('surrey-ca', '1.0.0');
    this.locationService = new LocationService();
  }

  protected getSourceUrl(): string {
    return 'https://www.surrey.ca/arts-culture/public-art/';
  }

  /**
   * Main scraping method
   */
  async scrape(): Promise<void> {
    logger.info('Starting Surrey Public Art Collection scraper');

    // Fetch the collection page
    const html = await this.httpClient.fetch(this.collectionUrl);
    const $ = cheerio.load(html);

    // Extract all artwork links from sidebar navigation
    const artworkLinks = this.extractArtworkLinks($);
    logger.info(`Found ${artworkLinks.length} total artworks`);

    // Apply limit if set
    const linksToProcess = this.limit ? artworkLinks.slice(0, this.limit) : artworkLinks;
    logger.info(`Processing ${linksToProcess.length} artworks`);

    // Scrape each artwork
    for (let i = 0; i < linksToProcess.length; i++) {
      const link = linksToProcess[i];
      if (!link) continue;

      logger.info(`Scraping artwork ${i + 1}/${linksToProcess.length}: ${link}`);

      try {
        await this.scrapeArtwork(link);
      } catch (error) {
        logger.error(`Failed to scrape artwork ${link}:`, error as Record<string, unknown>);
      }

      await this.rateLimiter.wait();
    }

    logger.info(`Scraping complete. Found ${this.artworks.length} artworks and ${this.artists.size} artists`);
  }

  /**
   * Extract artwork detail page links from collection page
   */
  private extractArtworkLinks($: cheerio.CheerioAPI): string[] {
    const links: string[] = [];

    // Find all links in the sidebar navigation that point to artwork pages
    $('nav a').each((_, element) => {
      const href = $(element).attr('href');
      if (href && href.includes('/arts-culture/public-art/permanent-public-art-collection/') && href.length > 60) {
        const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        // Avoid duplicates
        if (!links.includes(fullUrl)) {
          links.push(fullUrl);
        }
      }
    });

    return links;
  }

  /**
   * Scrape individual artwork page
   */
  private async scrapeArtwork(url: string): Promise<void> {
    const html = await this.httpClient.fetch(url);
    const $ = cheerio.load(html);

    // Extract ID from URL slug
    const urlParts = url.split('/');
    const slug = urlParts[urlParts.length - 1] ?? '';
    const id = `surrey-ca/${slug}`;

    // Check for duplicates
    if (this.isDuplicate(id)) {
      logger.warn(`Skipping duplicate artwork: ${id}`);
      return;
    }

    // Extract basic fields
    const title = this.extractTitle($);
    const artistNames = this.extractArtists($);
    const location = this.extractLocation($);
    const description = this.extractDescription($);
    const photos = this.extractPhotos($);
    const year = this.extractYear($);
    const category = this.extractCategory($);
    const developer = this.extractDeveloper($);

    // Geocode the location to get GPS coordinates
    let coordinates: [number, number] = [0, 0];
    if (location) {
      // Clean up location for geocoding - extract address if in parentheses
      let cleanLocation = location;
      const addressMatch = location.match(/\(([^)]+)\)/);
      if (addressMatch && addressMatch[1]) {
        cleanLocation = addressMatch[1];
      }
      
      logger.debug(`Geocoding location: ${cleanLocation}`);
      const geoResult = await this.locationService.geocodeAddress(
        `${cleanLocation}, Surrey, BC, Canada`
      );

      if (geoResult) {
        coordinates = [geoResult.lon, geoResult.lat];
        logger.debug(`Found coordinates: ${coordinates[0]}, ${coordinates[1]}`);
      } else {
        logger.warn(`Could not geocode location: ${location}`);
      }
    }

    // Create artwork feature with OSM-compatible properties
    const artwork: ArtworkFeature = {
      type: 'Feature',
      id,
      geometry: {
        type: 'Point',
        coordinates,
      },
      properties: {
        '@id': id, // OSM-style ID
        tourism: 'artwork', // OSM tag for artwork
        name: title,
        ...(artistNames.length > 0 && { artist_name: artistNames.join(', ') }),
        start_date: year,
        description,
        ...(photos && photos.length > 0 && { image: photos[0] }), // First photo as main image
        photos, // Full photos array for import
        'addr:full': location, // OSM-style address
        source: this.getSourceUrl(),
        source_url: url,
        notes: this.buildNotes(category, developer),
      },
    };

    // Create artist records
    for (const artistName of artistNames) {
      if (artistName && !this.artists.has(artistName)) {
        const artistBio = this.extractArtistBio($);
        const artist: ArtistRecord = {
          type: 'Artist',
          id: `surrey-ca/${this.sanitizeArtistName(artistName)}`,
          name: artistName,
          description: artistBio,
          properties: {
            source: this.getSourceUrl(),
            source_url: url,
            biography: artistBio,
          },
        };
        this.artists.set(artistName, artist);
      }
    }

    this.artworks.push(artwork);
  }

  /**
   * Extract artwork title from page
   */
  private extractTitle($: cheerio.CheerioAPI): string {
    return $('h1').first().text().trim();
  }

  /**
   * Extract artist names from metadata
   */
  private extractArtists($: cheerio.CheerioAPI): string[] {
    const artistText = this.extractMetadataField($, 'Artists:') || this.extractMetadataField($, 'Artist:');
    if (!artistText) return [];

    // Handle multiple artist formats:
    // "Artist1 and Artist2", "Artist1, Artist2", "Artist1, Artist2, & Artist3"
    const artists = artistText
      .split(/\s+and\s+|,\s*/)
      .map(name => name.replace(/^&\s+/, '').trim())
      .filter(name => name.length > 0);

    return artists;
  }

  /**
   * Extract location from metadata
   */
  private extractLocation($: cheerio.CheerioAPI): string {
    return this.extractMetadataField($, 'Location:');
  }

  /**
   * Extract category from metadata
   */
  private extractCategory($: cheerio.CheerioAPI): string {
    return this.extractMetadataField($, 'Category:');
  }

  /**
   * Extract developer from metadata
   */
  private extractDeveloper($: cheerio.CheerioAPI): string {
    return this.extractMetadataField($, 'Developer:');
  }

  /**
   * Extract year installed from metadata
   */
  private extractYear($: cheerio.CheerioAPI): string {
    const yearText = this.extractMetadataField($, 'Year Installed:');
    return yearText ? yearText.trim() : '';
  }

  /**
   * Extract a metadata field from the paragraph containing bold labels
   */
  private extractMetadataField($: cheerio.CheerioAPI, fieldLabel: string): string {
    let result = '';

    $('p').each((_, element) => {
      const $p = $(element);
      const html = $p.html() || '';

      // Check if this paragraph contains the field label (with or without trailing space in strong tag)
      if (html.includes(`<strong>${fieldLabel}</strong>`) || html.includes(`<strong>${fieldLabel} </strong>`)) {
        // Get all text nodes and strong elements
        $p.contents().each((__, node) => {
          if (node.type === 'tag' && node.name === 'strong') {
            const strongText = $(node).text().trim();
            if (strongText === fieldLabel) {
              // Found the label, extract text until next strong tag or <br>
              let nextNode = node.nextSibling;
              while (nextNode) {
                if (nextNode.type === 'text') {
                  result += nextNode.data || '';
                } else if (nextNode.type === 'tag') {
                  // Stop at next strong tag or br tag
                  if (nextNode.name === 'strong' || nextNode.name === 'br') {
                    break;
                  }
                }
                nextNode = nextNode.nextSibling;
              }
            }
          }
        });
      }
    });

    return result.trim();
  }

  /**
   * Extract description from page sections
   */
  private extractDescription($: cheerio.CheerioAPI): string {
    const sections: string[] = [];

    // Get first paragraph (short description)
    const firstPara = $('article p').first().text().trim();
    if (firstPara && firstPara.length > 20) {
      sections.push(firstPara);
    }

    // Get "About [Title]" section
    $('h2').each((_, element) => {
      const heading = $(element).text().trim();
      if (heading.startsWith('About ') && !heading.includes('Artist')) {
        // Get paragraphs following this heading until next heading
        const paragraphs: string[] = [];
        let nextElem = $(element).next();
        while (nextElem.length > 0 && nextElem.prop('tagName') === 'P') {
          const text = nextElem.text().trim();
          if (text) paragraphs.push(text);
          nextElem = nextElem.next();
        }
        if (paragraphs.length > 0) {
          sections.push(paragraphs.join('\n\n'));
        }
      }
    });

    return sections.join('\n\n');
  }

  /**
   * Extract artist bio from "About the Artist" section
   */
  private extractArtistBio($: cheerio.CheerioAPI): string {
    const bioSections: string[] = [];

    $('h2').each((_, element) => {
      const heading = $(element).text().trim();
      if (heading === 'About the Artist') {
        // Get all paragraphs following this heading until next heading
        let nextElem = $(element).next();
        while (nextElem.length > 0 && nextElem.prop('tagName') === 'P') {
          const text = nextElem.text().trim();
          if (text) bioSections.push(text);
          nextElem = nextElem.next();
        }
      }
    });

    return bioSections.join('\n\n');
  }

  /**
   * Sanitize artist name for use in ID
   */
  private sanitizeArtistName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Extract photos from page
   */
  private extractPhotos($: cheerio.CheerioAPI): string[] {
    const photos: string[] = [];

    // Get images from the image list at bottom of page
    $('article img').each((_, element) => {
      const src = $(element).attr('src');
      if (!src) return;

      const lowerSrc = src.toLowerCase();

      // Include images from specific paths
      const includePatterns = ['/sites/default/files/', 'public', 'art'];
      const hasInclude = includePatterns.some(pattern => lowerSrc.includes(pattern));

      // Exclude common non-artwork images
      const excludePatterns = ['logo', 'icon', 'banner', 'sprite'];
      const hasExclude = excludePatterns.some(pattern => lowerSrc.includes(pattern));

      if (hasInclude && !hasExclude) {
        // Get high-resolution version if available
        let photoUrl = src;
        const parent = $(element).parent();
        if (parent.prop('tagName') === 'A') {
          const href = parent.attr('href');
          if (href) {
            photoUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          }
        } else {
          photoUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
        }

        if (!photos.includes(photoUrl)) {
          photos.push(photoUrl);
        }
      }
    });

    return photos;
  }

  /**
   * Build notes field from category and developer
   */
  private buildNotes(category: string, developer: string): string {
    const notes: string[] = [];

    if (category) {
      notes.push(`Category: ${category}`);
    }

    if (developer) {
      notes.push(`Developer: ${developer}`);
    }

    return notes.join('\n');
  }
}
