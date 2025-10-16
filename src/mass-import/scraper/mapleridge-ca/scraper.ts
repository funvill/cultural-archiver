/**
 * Maple Ridge Public Art Scraper
 *
 * Scrapes public art installations from the City of Maple Ridge website.
 *
 * Source: https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art
 *
 * Features:
 * - Paginated listing with multiple artworks per page
 * - Metadata extracted from .field elements with .field__label and .field__item
 * - Multiple photos per artwork (3 images found on example page)
 * - Artist names in format: "Rebecca Bayer and David Gregory (SpaceMakePlace Design)"
 * - Dates in format: "January 31, 2020"
 * - Addresses geocoded to GPS coordinates using LocationService
 * - Outputs OSM-compatible GeoJSON format
 *
 * Example artwork:
 * https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art/maple-ridge-community-mosaic
 */

import * as cheerio from 'cheerio';
import type { ArtworkFeature } from '../shared/types';
import { ScraperBase } from '../shared/scraper-base';
import { logger } from '../shared/logger';
import { LocationService } from '../../../lib/location/service';

export class MapleRidgeScraper extends ScraperBase {
  private readonly baseUrl = 'https://www.mapleridge.ca';
  private readonly listingUrl = `${this.baseUrl}/parks-recreation/arts-theatre/public-art`;
  private readonly locationService: LocationService;

  constructor() {
    super('mapleridge-ca', '1.0.0');
    this.locationService = new LocationService();
  }

  protected getSourceUrl(): string {
    return 'https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art/';
  }

  /**
   * Main scraping method
   */
  async scrape(): Promise<void> {
    logger.info('Starting Maple Ridge Public Art scraper');

    // Collect artwork links from all pages
    const artworkLinks: string[] = [];
    
    // Scrape page 1
    logger.info('Fetching page 1');
    const html1 = await this.httpClient.fetch(this.listingUrl);
    const $1 = cheerio.load(html1);
    const links1 = this.extractArtworkLinks($1);
    artworkLinks.push(...links1);
    logger.info(`Found ${links1.length} artworks on page 1`);

    // Check for page 2 using the specific pagination structure
    const page2Link = $1('nav.pager a')
      .filter((_, el) => $1(el).text().includes('Page 2'))
      .attr('href');
    
    if (page2Link) {
      logger.info('Fetching page 2');
      const page2Url = page2Link.startsWith('http') 
        ? page2Link 
        : `https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art${page2Link}`;
      await this.rateLimiter.wait();
      const html2 = await this.httpClient.fetch(page2Url);
      const $2 = cheerio.load(html2);
      const links2 = this.extractArtworkLinks($2);
      artworkLinks.push(...links2);
      logger.info(`Found ${links2.length} artworks on page 2`);
    }

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

    logger.info('Scraping complete', {
      artworks: this.artworks.length,
      artists: this.artists.size,
    });
  }

  /**
   * Extract artwork links from listing page
   */
  private extractArtworkLinks($: cheerio.CheerioAPI): string[] {
    const links: string[] = [];

    // Find all article elements with artwork links
    $('article h3 a').each((_, element) => {
      const href = $(element).attr('href');
      if (href && href.includes('/public-art/')) {
        // Convert relative URL to absolute
        const absoluteUrl = href.startsWith('http')
          ? href
          : `${this.baseUrl}${href}`;
        links.push(absoluteUrl);
      }
    });

    return links;
  }

  /**
   * Scrapes a single artwork page
   */
  private async scrapeArtwork(url: string): Promise<void> {
    logger.debug(`Scraping artwork: ${url}`);

    const html = await this.httpClient.fetch(url);
    const $ = cheerio.load(html);

    // Extract title from h1
    const name = $('h1').first().text().trim();
    if (!name) {
      logger.warn(`No title found for ${url}`);
      this.stats.failed++;
      return;
    }

    // Extract metadata fields
    const artistNameRaw = this.extractFieldValue($, 'Artist Name');
    const status = this.extractFieldValue($, 'Project Status');
    const artType = this.extractFieldValue($, 'Art Project Type');
    const location = this.extractFieldValue($, 'Location');
    const address = this.extractFieldValue($, 'Address');

    // Parse artist names into array (comma-separated)
    const artists: string[] = [];
    if (artistNameRaw) {
      // Split by comma and trim whitespace
      artists.push(
        ...artistNameRaw
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
      );
    }

    // Extract date from time element
    let startDate: string | undefined;
    const timeElement = $('time[datetime]').first();
    if (timeElement.length) {
      const datetime = timeElement.attr('datetime');
      if (datetime) {
        // Convert "2020-01-31T12:00:00Z" to "2020"
        startDate = datetime.split('-')[0];
      }
    }

    // Extract description from first paragraph in content area
    let description: string | undefined;
    const contentParagraphs = $('.field--name-field-row-content p');
    if (contentParagraphs.length > 0) {
      description = contentParagraphs.first().text().trim();
    }

    // Extract artist bio from "About the Artist" or "About the Artists" section
    let artist_bio: string | undefined;
    const aboutHeading = $('h3')
      .filter((_, el) => {
        const text = $(el).text().trim();
        return text === 'About the Artist' || text === 'About the Artists';
      })
      .first();
    if (aboutHeading.length) {
      // Collect all paragraphs after the heading until the next heading or end
      const bioParagraphs: string[] = [];
      let nextEl = aboutHeading.next();
      while (nextEl.length && nextEl.prop('tagName') === 'P') {
        const text = nextEl.text().trim();
        if (text) {
          bioParagraphs.push(text);
        }
        nextEl = nextEl.next();
      }
      if (bioParagraphs.length > 0) {
        artist_bio = bioParagraphs.join('\n\n');
      }
    }

    // Extract all photo URLs from article images (excluding map tiles and leaflet markers)
    const photos: string[] = [];
    $('article img').each((_, element) => {
      const src = $(element).attr('src');
      if (
        src &&
        !src.includes('tile.openstreetmap.org') &&
        !src.includes('leaflet') &&
        !src.includes('marker-')
      ) {
        // Convert relative URLs to absolute
        const absoluteSrc = src.startsWith('http')
          ? src
          : `${this.baseUrl}${src}`;
        photos.push(absoluteSrc);
      }
    });

    // Geocode the address to get GPS coordinates
    let coordinates: [number, number] = [0, 0];
    if (address) {
      try {
        const geocoded = await this.locationService.geocodeAddress(address);
        if (geocoded) {
          coordinates = [geocoded.lon, geocoded.lat];
          logger.debug(
            `Geocoded "${address}" to [${coordinates[0]}, ${coordinates[1]}]`
          );
        } else {
          logger.warn(`Failed to geocode address: ${address}`);
        }
      } catch (error) {
        logger.warn(
          `Error geocoding address "${address}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Build OSM-compatible properties
    const properties = {
      source: this.getSourceUrl(),
      source_url: url,
      '@id': url,
      tourism: 'artwork',
      name,
      ...(artistNameRaw && { artist_name: artistNameRaw }),
      ...(artists.length > 0 && { artists }),
      ...(photos.length > 0 && {
        image: photos[0],
        photos,
      }),
      ...(address && { 'addr:full': address }),
      ...(startDate && { start_date: startDate }),
      ...(description && { description }),
      ...(artist_bio && { artist_bio }),
      // Add metadata as separate properties
      ...(status && { status }),
      ...(artType && { artwork_type: artType }),
      ...(location && { location }),
    };

    // Create artwork feature
    const artwork: ArtworkFeature = {
      type: 'Feature',
      id: url,
      geometry: {
        type: 'Point',
        coordinates,
      },
      properties,
    };

    this.artworks.push(artwork);
    this.stats.success++;

    // Track each artist individually with bio
    if (artists.length > 0) {
      for (const artistName of artists) {
        // Generate artist ID from name
        const artistId = artistName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        // Track artist with bio if available
        if (!this.artists.has(artistId)) {
          logger.debug(`Tracking new artist: ${artistName}`, { artistId });
          this.artists.set(artistId, {
            type: 'Artist',
            id: artistId,
            name: artistName,
            ...(artist_bio && { description: artist_bio }),
            properties: {
              source: this.getSourceUrl(),
              source_url: url,
              ...(artist_bio && { biography: artist_bio }),
            },
          });
        }
      }
    }
  }

  /**
   * Extract value from a field with a specific label
   * Handles the pattern: <div class="field__label">Label</div><div class="field__item">Value</div>
   */
  private extractFieldValue(
    $: cheerio.CheerioAPI,
    label: string
  ): string | undefined {
    const field = $('.field__label')
      .filter((_, el) => $(el).text().trim() === label)
      .parent();

    if (field.length) {
      const value = field.find('.field__item').text().trim();
      return value || undefined;
    }

    return undefined;
  }
}
