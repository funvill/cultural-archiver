/**
 * New Westminster Public Art Registry Scraper
 *
 * Scrapes public art data from https://www.newwestcity.ca/public-art-registry
 * Extracts artwork details, artist information, and photos.
 */

import * as cheerio from 'cheerio';
import type { ArtworkFeature } from '../shared/types';
import { ScraperBase } from '../shared/scraper-base';
import { logger } from '../shared/logger';

export class NewWestCityScraper extends ScraperBase {
  private readonly baseUrl = 'https://www.newwestcity.ca';
  private readonly listUrl = `${this.baseUrl}/public-art-registry`;

  constructor() {
    super('new-west-city', '1.0.0');
  }

  protected getSourceUrl(): string {
    return this.baseUrl;
  }

  /**
   * Main scraping method
   */
  async scrape(): Promise<void> {
    logger.info('Starting New Westminster Public Art Registry scraper');

    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages && (this.maxPages === undefined || currentPage <= this.maxPages)) {
      logger.info(`Scraping page ${currentPage}`);

      const pageUrl = this.buildSearchUrl(currentPage);
      const html = await this.httpClient.fetch(pageUrl);
      const $ = cheerio.load(html);

      // Extract artwork links
      const artworkLinks = this.extractArtworkLinks($);
      logger.info(`Found ${artworkLinks.length} artworks on page ${currentPage}`);

      // Scrape each artwork
      for (let i = 0; i < artworkLinks.length; i++) {
        if (this.limit !== undefined && this.artworks.length >= this.limit) {
          logger.info(`Reached limit of ${this.limit} artworks`);
          hasMorePages = false;
          break;
        }

        const link = artworkLinks[i];
        if (!link) continue;

        logger.info(`Scraping artwork ${i + 1}/${artworkLinks.length}: ${link}`);

        try {
          await this.scrapeArtwork(link);
        } catch (error) {
          logger.error(`Failed to scrape artwork ${link}:`, error as Record<string, unknown>);
        }

        await this.rateLimiter.wait();
      }

      // Check for next page
      const nextLink = $('a:contains("Next")').attr('href');
      if (!nextLink || nextLink === '#') {
        hasMorePages = false;
      }

      currentPage++;
    }

    logger.info(`Scraping complete. Found ${this.artworks.length} artworks and ${this.artists.size} artists`);
  }

  /**
   * Build URL for search page
   */
  private buildSearchUrl(page: number): string {
    if (page === 1) {
      return this.listUrl;
    }
    return `${this.baseUrl}/public-art-registry/main/557/site_art_installations/page${page}.php`;
  }

  /**
   * Extract artwork detail page links from list page
   */
  private extractArtworkLinks($: cheerio.CheerioAPI): string[] {
    const links: string[] = [];

    // Find all "View details" links in the list
    $('a:contains("View details")').each((_, element) => {
      const href = $(element).attr('href');
      if (href && href.includes('/public-art/')) {
        const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        links.push(fullUrl);
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

    // Extract ID from URL (e.g., "foreshore" from "foreshore.php")
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1] ?? '';
    const artworkId = filename.replace('.php', '');
    const id = `newwestcity/${artworkId}`;

    // Check for duplicates
    if (this.isDuplicate(id)) {
      logger.warn(`Skipping duplicate artwork: ${id}`);
      return;
    }

    // Extract basic fields
    const title = this.extractTitle($);
    const artistName = this.extractArtist($);
    const coordinates = await this.extractCoordinates($);
    const location = this.extractLocation($);
    const description = this.extractDescription($);
    const photos = this.extractPhotos($);

    // Extract metadata from "Artwork details" section
    const artwork_type = this.extractType($);
    const start_date = this.extractInstallationYear($);
    const end_date = this.extractRemovalYear($);
    const medium = this.extractMedium($);
    const neighbourhood = this.extractNeighbourhood($);

    // Create artwork feature
    const artwork: ArtworkFeature = {
      type: 'Feature',
      id,
      geometry: {
        type: 'Point',
        coordinates: coordinates || [0, 0],
      },
      properties: {
        title,
        description,
        artist: artistName,
        ...(artwork_type && { artwork_type }),
        location,
        ...(start_date && { start_date }),
        ...(end_date && { end_date }),
        photos,
        ...(medium && { medium }),
        owner: 'City of New Westminster',
        ...(neighbourhood && { category: neighbourhood }),
        source: 'newwestcity',
        source_url: url,
      },
    };

    this.artworks.push(artwork);
    this.stats.success++;

    // Track artist
    if (artistName) {
      const artistId = this.generateArtistId(artistName);
      this.trackArtist(artistName, artistId, url);
      
      // Extract artist details
      const artistBiography = this.extractArtistBiography($);
      const artistWebsite = this.extractArtistWebsite($);

      if (artistBiography || artistWebsite) {
        const existingArtist = this.artists.get(artistId);

        if (existingArtist) {
          if (artistBiography) {
            existingArtist.properties.biography = artistBiography;
          }
          
          if (artistWebsite) {
            existingArtist.properties.websites = [artistWebsite];
            existingArtist.properties.website = artistWebsite;
          }
        }
      }
    }
  }

  /**
   * Extract title from h1 or page heading
   */
  private extractTitle($: cheerio.CheerioAPI): string {
    // Try multiple selectors
    let title = $('h1').first().text().trim();
    if (!title) {
      title = $('.page-title').text().trim();
    }
    if (!title) {
      const titleText = $('title').text();
      const parts = titleText.split('|');
      title = (parts[0] ?? '').trim();
    }
    return title;
  }

  /**
   * Extract artist name
   */
  private extractArtist($: cheerio.CheerioAPI): string {
    // Artist name is in a div with class "artist"
    const artistElement = $('.artist');
    if (artistElement.length > 0) {
      return artistElement.text().trim();
    }
    
    return '';
  }

  /**
   * Extract metadata bundle and parse individual fields
   */
  private getMetadataText($: cheerio.CheerioAPI): string {
    // Find all text that contains typical metadata patterns
    let metadataText = '';
    let shortestLength = Infinity;
    
    $('*').each((_, element) => {
      const text = $(element).text();
      if (text.includes('Neighbourhood:') && text.includes('Installation year:')) {
        // We want the shortest text that contains these fields (most specific container)
        if (text.length < shortestLength) {
          metadataText = text;
          shortestLength = text.length;
        }
      }
    });
    
    return metadataText;
  }

  /**
   * Generic metadata field extractor
   */
  private extractMetadataField($: cheerio.CheerioAPI, fieldName: string): string {
    const fullText = this.getMetadataText($);
    
    if (!fullText) {
      return '';
    }
    
    // Parse metadata by splitting on field names
    // The fields are: Neighbourhood:, Installation year:, Removal year:, Status:, Type:, Primary materials:, Address:
    const fields = [
      'Neighbourhood:',
      'Installation year:',
      'Removal year:',
      'Status:',
      'Type:',
      'Primary materials:',
      'Address:'
    ];
    
    // Find our field
    const cleanFieldName = fieldName.trim();
    const fieldIndex = fullText.indexOf(cleanFieldName);
    
    if (fieldIndex === -1) {
      return '';
    }
    
    // Extract text after the field name
    const afterField = fullText.substring(fieldIndex + cleanFieldName.length);
    
    // Find the next field marker
    let nextFieldIndex = afterField.length;
    for (const field of fields) {
      if (field === cleanFieldName) continue; // Skip our own field
      const idx = afterField.indexOf(field);
      if (idx !== -1 && idx < nextFieldIndex) {
        nextFieldIndex = idx;
      }
    }
    
    // Extract and clean the value
    const value = afterField.substring(0, nextFieldIndex).trim();
    return value;
  }  /**
   * Extract coordinates by geocoding the address
   */
  private async extractCoordinates($: cheerio.CheerioAPI): Promise<[number, number] | undefined> {
    // First try to extract from JavaScript map_markers variable
    const scripts = $('script');
    for (let i = 0; i < scripts.length; i++) {
      const scriptContent = $(scripts[i]).html() || '';
      
      // Look for map_markers pattern: map_markers = [{lat: 49.2000155, lng: -122.9117314, ...}];
      const markerMatch = scriptContent.match(/map_markers\s*=\s*\[\{lat:\s*(-?\d+\.?\d*),\s*lng:\s*(-?\d+\.?\d*)/);
      if (markerMatch && markerMatch[1] && markerMatch[2]) {
        const lat = parseFloat(markerMatch[1]);
        const lng = parseFloat(markerMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          logger.info(`Coordinates extracted from map: [${lat}, ${lng}]`);
          return [lat, lng];
        }
      }
    }
    
    const address = this.extractAddress($);
    if (address) {
      logger.info(`Address found: ${address} (no map coordinates found, geocoding not implemented)`);
    } else {
      logger.warn('No address or coordinates found');
    }
    
    return undefined;
  }

  /**
   * Extract address from metadata
   */
  private extractAddress($: cheerio.CheerioAPI): string {
    // Use the generic metadata extractor
    return this.extractMetadataField($, 'Address:');
  }

  /**
   * Extract location (neighbourhood + address)
   */
  private extractLocation($: cheerio.CheerioAPI): string {
    const neighbourhood = this.extractNeighbourhood($);
    const address = this.extractAddress($);
    
    if (neighbourhood && address) {
      return `${neighbourhood}, ${address}`;
    }
    return address || neighbourhood || '';
  }

  /**
   * Extract neighbourhood
   */
  private extractNeighbourhood($: cheerio.CheerioAPI): string {
    return this.extractMetadataField($, 'Neighbourhood:');
  }

  /**
   * Extract description from "About the Artwork" section
   */
  private extractDescription($: cheerio.CheerioAPI): string {
    const sections: string[] = [];

    // About the Artwork
    const aboutArtwork = $('h3:contains("About the Artwork"), h3:contains("ABOUT THE ARTWORK")').first();
    if (aboutArtwork.length > 0) {
      const content: string[] = [];
      let current = aboutArtwork.next();
      
      while (current.length > 0 && current.prop('tagName') !== 'H3') {
        if (current.prop('tagName') === 'P') {
          const text = current.text().trim();
          if (text) {
            content.push(text);
          }
        }
        current = current.next();
      }
      
      if (content.length > 0) {
        sections.push(content.join('\n\n'));
      }
    }

    // Artist Statement (but not About the Artist)
    const artistStatement = $('h3:contains("Artist Statement"), h3:contains("ARTIST STATEMENT")').first();
    if (artistStatement.length > 0) {
      const content: string[] = [];
      let current = artistStatement.next();
      
      while (current.length > 0 && current.prop('tagName') !== 'H3') {
        if (current.prop('tagName') === 'P') {
          const text = current.text().trim();
          // Stop at "About the Artist" paragraph
          if (text.startsWith('About the Artist') || text.startsWith('ABOUT THE ARTIST')) {
            break;
          }
          // Skip the artist name signature line
          if (text && !text.match(/^[\w\s]+,\s*\d{4}-\d{2}-\d{2}$/)) {
            content.push(text);
          }
        }
        current = current.next();
      }
      
      if (content.length > 0) {
        sections.push('Artist Statement:\n\n' + content.join('\n\n'));
      }
    }

    // Background
    const background = $('h3:contains("Background")').first();
    if (background.length > 0) {
      const content: string[] = [];
      let current = background.next();
      
      while (current.length > 0 && current.prop('tagName') !== 'H3') {
        if (current.prop('tagName') === 'P') {
          const text = current.text().trim();
          if (text) {
            content.push(text);
          }
        }
        current = current.next();
      }
      
      if (content.length > 0) {
        sections.push('Background:\n\n' + content.join('\n\n'));
      }
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Extract artist biography from "About the Artist" section
   */
  private extractArtistBiography($: cheerio.CheerioAPI): string {
    const content: string[] = [];
    
    // "About the Artist" appears as a paragraph within the artist statement section
    // It's not a heading, just a paragraph with that text
    let foundAboutArtist = false;
    let paragraphsAfterMarker = 0;
    const maxParagraphs = 10; // Collect up to 10 paragraphs of bio
    
    $('p').each((_, element) => {
      const text = $(element).text().trim();
      
      // Check if this paragraph contains "About the Artist"
      if (text === 'About the Artist' || text === 'ABOUT THE ARTIST' || text.includes('About the Artist')) {
        foundAboutArtist = true;
        logger.info('Found "About the Artist" marker');
        return true; // Continue to next paragraph
      }
      
      // If we found the marker, collect subsequent paragraphs
      if (foundAboutArtist && paragraphsAfterMarker < maxParagraphs) {
        // Stop at certain markers or empty paragraphs
        if (!text || 
            text.startsWith('Special Thanks') ||
            text.startsWith('Back to') || 
            text.startsWith('Public Art Registry') ||
            text.startsWith('Photo credit:')) {
          logger.info(`Stopped at: ${text.substring(0, 50)}`);
          return false; // Stop iteration
        }
        
        content.push(text);
        paragraphsAfterMarker++;
      }
      
      return true; // Continue iteration
    });

    const biography = content.join('\n\n');
    if (biography) {
      logger.info(`Extracted artist biography: ${biography.length} characters`);
    } else {
      logger.warn('No artist biography found');
    }
    
    return biography;
  }

  /**
   * Extract artist website from "More About the Artist" link
   */
  private extractArtistWebsite($: cheerio.CheerioAPI): string {
    const moreLink = $('a:contains("More About the Artist")').first();
    return moreLink.attr('href')?.trim() || '';
  }

  /**
   * Extract photos from image gallery
   */
  private extractPhotos($: cheerio.CheerioAPI): string[] {
    const photos: string[] = [];

    // Photos are typically in a carousel/list structure near the top of the page
    // Look for images that are part of the artwork display (not UI elements)
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt');
      
      if (src) {
        // Filter out UI elements
        const isUIElement = src.includes('logo') || 
                           src.includes('icon') || 
                           src.includes('banner') ||
                           src.includes('sprite') ||
                           src.includes('/assets/') ||
                           alt?.toLowerCase().includes('logo');
        
        // Include images that look like artwork photos
        const isArtworkPhoto = src.includes('/images/') || 
                              src.includes('/photos/') ||
                              src.includes('public-art') ||
                              src.match(/\.(jpg|jpeg|png|gif)(\?|$)/i);
        
        if (!isUIElement && isArtworkPhoto) {
          const fullUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
          if (!photos.includes(fullUrl)) {
            photos.push(fullUrl);
          }
        }
      }
    });

    return photos;
  }

  /**
   * Extract artwork type from metadata
   */
  private extractType($: cheerio.CheerioAPI): string {
    return this.extractMetadataField($, 'Type:');
  }

  /**
   * Extract installation year from metadata
   */
  private extractInstallationYear($: cheerio.CheerioAPI): string {
    return this.extractMetadataField($, 'Installation year:');
  }

  /**
   * Extract removal year from metadata (for temporary artworks)
   */
  private extractRemovalYear($: cheerio.CheerioAPI): string {
    return this.extractMetadataField($, 'Removal year:');
  }

  /**
   * Extract primary materials/medium from metadata
   */
  private extractMedium($: cheerio.CheerioAPI): string {
    return this.extractMetadataField($, 'Primary materials:');
  }

  /**
   * Generate consistent artist ID from name
   */
  private generateArtistId(name: string): string {
    return `newwestcity/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }
}
