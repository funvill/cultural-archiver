/**
 * HTML Parser for New Westminster Public Art Registry
 *
 * Extracts data from HTML using only built-in Node.js modules.
 * Uses regex and string manipulation instead of external parsing librar    // Extract full description from .group-left content area (About the Artwork + Artist Statement)
    const groupLeftMatch = html.match(/<div[^>]*class=["'][^"']*group-left[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class=["'][^"']*artist["']/is);
    if (groupLeftMatch && groupLeftMatch[1]) {
      // Extract all paragraphs from group-left (includes About the Artwork and Artist Statement sections)
      const paragraphs: string[] = [];
      const pPattern = /<p[^>]*>(.*?)<\/p>/gis;
      let pMatch;
      while ((pMatch = pPattern.exec(groupLeftMatch[1])) !== null) {
        if (pMatch[1]) {
          const text = this.decodeHtmlEntities(pMatch[1]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text.length > 20 && !text.includes('Back to') && !text.includes('Photo credit:')) {
            paragraphs.push(text);
          }
        }
      }
      artwork.description = paragraphs.join(' ');
    }This is a STUB implementation. Update the parsing logic after inspecting
 * the actual HTML structure of the New Westminster website.
 */

import { logger } from './logger.js';

export interface ArtworkData {
  id: string;
  url: string;
  title: string;
  coordinates?: { lat: number; lon: number };
  description: string;
  year?: string;
  medium?: string;
  dimensions?: string;
  location: string;
  photos: string[];
  artistLinks: string[];
  artistNames: string[];
  status?: string;          // Temporary/Permanent
  type?: string;            // Installation/Mural/Sculpture
  neighbourhood?: string;   // Downtown/Queensborough/etc
  removalYear?: string;     // For temporary installations
}

export interface ArtistData {
  name: string;
  sourceUrl: string;
  biography?: string;
  birthYear?: string;
  deathYear?: string;
  website?: string;
}

export class HTMLParser {
  /**
   * Extract text content from HTML tag
   */
  private extractText(html: string, pattern: RegExp): string {
    const match = html.match(pattern);
    if (!match || !match[1]) {
      return '';
    }

    // Decode HTML entities and clean up whitespace
    return this.decodeHtmlEntities(match[1])
      .replace(/<[^>]+>/g, '') // Remove any remaining HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract attribute value from HTML tag
   * 
   * Note: Utility method for future parser enhancements - uncomment when needed
   */
  /*
  private extractAttribute(html: string, pattern: RegExp): string {
    const match = html.match(pattern);
    return match && match[1] ? match[1].trim() : '';
  }
  */

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  /**
   * Extract artwork URLs from index page
   * 
   * Based on actual website inspection: artwork links follow pattern /public-art/[slug].php
   */
  parseArtworkIndex(html: string, baseUrl: string): string[] {
    logger.debug('Parsing artwork index page...');

    // Pattern matches: href="https://www.newwestcity.ca/public-art/great-grandmother-tree-and-spiral-to-the-sky.php"
    // or href="/public-art/great-grandmother-tree-and-spiral-to-the-sky.php"
    const pattern = /href=["'](?:https:\/\/www\.newwestcity\.ca)?(\/public-art\/[^"']+\.php)["']/gi;
    
    const urls: string[] = [];
    const seen = new Set<string>();

    let match;
    while ((match = pattern.exec(html)) !== null) {
      const urlMatch = match[1];
      if (!urlMatch) continue;
      
      const url = this.normalizeUrl(urlMatch, baseUrl);
      
      // Skip pagination links and non-detail pages
      if (url.includes('page') && url.match(/page\d+\.php$/)) {
        continue;
      }

      // Deduplicate
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }

    logger.info(`Found ${urls.length} artwork URLs`);
    
    return urls;
  }

  /**
   * Normalize URL (convert relative to absolute)
   */
  private normalizeUrl(url: string, baseUrl: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    
    if (url.startsWith('/')) {
      return `${baseUrl}${url}`;
    }
    
    return `${baseUrl}/${url}`;
  }

  /**
   * Extract "Next" button URL from pagination
   * 
   * Based on website inspection: pagination uses "Next" button that links to:
   * - page2.php, page3.php, page4.php for subsequent pages
   * - Returns null when no "Next" link found (last page)
   */
  extractNextPageUrl(html: string, baseUrl: string): string | null {
    logger.debug('Checking for Next button...');

    // Look for "Next" link in pagination table
    // Pattern: <a href="...">Next</a>
    const nextPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>\s*Next\s*<\/a>/i;
    const match = nextPattern.exec(html);

    if (match && match[1]) {
      const nextUrl = match[1];
      
      // If the URL is relative, make it absolute
      if (nextUrl.startsWith('http')) {
        logger.debug(`Found Next URL: ${nextUrl}`);
        return nextUrl;
      } else {
        const absoluteUrl = new URL(nextUrl, baseUrl).href;
        logger.debug(`Found Next URL (relative): ${nextUrl} -> ${absoluteUrl}`);
        return absoluteUrl;
      }
    }

    logger.debug('No Next button found (last page)');
    return null;
  }

  /**
   * Parse artwork detail page
   * 
   * Based on actual website inspection of New Westminster public art pages
   */
  parseArtworkDetail(html: string, url: string): Partial<ArtworkData> {
    logger.debug(`Parsing artwork detail: ${url}`);

    const artwork: Partial<ArtworkData> = {
      id: this.extractIdFromUrl(url),
      url,
      title: '',
      description: '',
      location: '',
      photos: [],
      artistLinks: [],
      artistNames: []
    };

    // Title: Found in <h1> within .group-left or standalone h1
    artwork.title = 
      this.extractText(html, /<div[^>]*class=["'][^"']*group-left[^"']*["'][^>]*>[\s\S]*?<h1[^>]*>(.*?)<\/h1>/is) ||
      this.extractText(html, /<h1[^>]*>(.*?)<\/h1>/is) ||
      this.extractText(html, /<title>(.*?)<\/title>/is).replace(/\s*\|.*$/, '').trim();

    // Description: Extract all content from "About the Artwork" through "Artist Statement" sections
    // This includes the full artwork description and artist statement
    const contentMatch = html.match(/<div[^>]*class=["'][^"']*page-text[^"']*["'][^>]*>([\s\S]*?)<\/div>/is);
    if (contentMatch && contentMatch[1]) {
      // Extract all paragraphs including Artist Statement
      const paragraphs: string[] = [];
      const pPattern = /<p[^>]*>(.*?)<\/p>/gis;
      let pMatch;
      while ((pMatch = pPattern.exec(contentMatch[1])) !== null) {
        if (pMatch[1]) {
          const text = this.decodeHtmlEntities(pMatch[1]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          // Skip "Special Thanks" and navigation links
          if (text.length > 20 && !text.includes('Special Thanks') && !text.includes('Public Art Registry') && !text.includes('Back to Public Art')) {
            paragraphs.push(text);
          }
        }
      }
      artwork.description = paragraphs.join(' ');
    }

    // Extract artist name from .artist div (appears after group-left content)
    const artistMatch = html.match(/<div[^>]*class=["'][^"']*artist[^"']*["'][^>]*>(.*?)<\/div>/is);
    if (artistMatch && artistMatch[1]) {
      const artistName = this.decodeHtmlEntities(artistMatch[1]).replace(/<[^>]+>/g, '').trim();
      if (artistName && artistName.length > 1) {
        artwork.artistNames = [artistName];
      }
    }

    // Extract details from .details section (neighbourhood, status, type, address, removal year, etc.)
    // The structure is: <div class="sb-element display_point address"><div class="details-label">Address:</div>TEXT</div>
    
    // Address - match the pattern with nested divs
    const addressMatch = html.match(/<div[^>]*class=["'][^"']*address[^"']*["'][^>]*>\s*<div[^>]*class=["']details-label["'][^>]*>Address:<\/div>\s*([^<]+)/is);
    if (addressMatch && addressMatch[1]) {
      artwork.location = this.decodeHtmlEntities(addressMatch[1]).trim();
    }

    // Installation year - same nested pattern
    const yearMatch = html.match(/<div[^>]*class=["'][^"']*installation_date[^"']*["'][^>]*>\s*<div[^>]*class=["']details-label["'][^>]*>Installation year:<\/div>\s*(\d{4})/is);
    if (yearMatch && yearMatch[1]) {
      artwork.year = yearMatch[1];
    }

    // Status (Temporary/Permanent)
    const statusMatch = html.match(/<div[^>]*class=["'][^"']*status[^"']*["'][^>]*>\s*<div[^>]*class=["']details-label["'][^>]*>Status:<\/div>\s*([^<]+)/is);
    if (statusMatch && statusMatch[1]) {
      artwork.status = this.decodeHtmlEntities(statusMatch[1]).trim();
    }

    // Type (Installation/Mural/Sculpture)
    const typeMatch = html.match(/<div[^>]*class=["'][^"']*type[^"']*["'][^>]*>\s*<div[^>]*class=["']details-label["'][^>]*>Type:<\/div>\s*([^<]+)/is);
    if (typeMatch && typeMatch[1]) {
      artwork.type = this.decodeHtmlEntities(typeMatch[1]).trim();
    }

    // Neighbourhood
    const neighbourhoodMatch = html.match(/<div[^>]*class=["'][^"']*neighbourhood[^"']*["'][^>]*>\s*<div[^>]*class=["']details-label["'][^>]*>Neighbourhood:<\/div>\s*([^<]+)/is);
    if (neighbourhoodMatch && neighbourhoodMatch[1]) {
      artwork.neighbourhood = this.decodeHtmlEntities(neighbourhoodMatch[1]).trim();
    }

    // Removal year (for temporary installations)
    const removalYearMatch = html.match(/<div[^>]*class=["'][^"']*removal_date[^"']*["'][^>]*>\s*<div[^>]*class=["']details-label["'][^>]*>Removal year:<\/div>\s*(\d{4})/is);
    if (removalYearMatch && removalYearMatch[1]) {
      artwork.removalYear = removalYearMatch[1];
    }

    // Coordinates from Google Maps JavaScript
    const coordinates = this.extractCoordinates(html);
    if (coordinates) {
      artwork.coordinates = coordinates;
    }

    // Photos from slideshow - extract base domain for absolute path URLs
    const urlObj = new URL(url);
    const baseDomain = `${urlObj.protocol}//${urlObj.host}`;
    artwork.photos = this.extractPhotos(html, baseDomain);

    logger.debug(`Parsed artwork: ${artwork.title || 'Unknown'}`);
    
    return artwork;
  }

  /**
   * Extract ID from URL
   */
  private extractIdFromUrl(url: string): string {
    const match = url.match(/\/([^\/]+)\/?$/);
    return match && match[1] ? match[1] : url;
  }

  /**
   * Extract coordinates from HTML (Google Maps JavaScript)
   * 
   * Based on website inspection: coordinates are embedded in Google Maps script tags
   */
  private extractCoordinates(html: string): { lat: number; lon: number } | undefined {
    // Pattern 1: Google Maps JavaScript - lat: 49.2000155, lng: -122.9117314
    const latMatch = html.match(/lat[:\s]+(-?\d+\.?\d+)/i);
    const lngMatch = html.match(/lng[:\s]+(-?\d+\.?\d+)/i);
    
    if (latMatch && lngMatch && latMatch[1] && lngMatch[1]) {
      const lat = parseFloat(latMatch[1]);
      const lon = parseFloat(lngMatch[1]);
      
      // Validate coordinates are in reasonable range for New Westminster
      if (lat > 49.1 && lat < 49.3 && lon < -122.8 && lon > -123.0) {
        logger.debug(`Found coordinates: ${lat}, ${lon}`);
        return { lat, lon };
      }
    }

    // Pattern 2: Google Maps URL format - ll=49.200016,-122.911731
    const llMatch = html.match(/[?&]ll=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
    if (llMatch && llMatch[1] && llMatch[2]) {
      return {
        lat: parseFloat(llMatch[1]),
        lon: parseFloat(llMatch[2])
      };
    }

    // Pattern 3: Data attributes (fallback)
    const dataLatMatch = html.match(/data-lat(?:itude)?=["'](-?\d+\.?\d*)["']/i);
    const dataLonMatch = html.match(/data-lon(?:gitude)?=["'](-?\d+\.?\d*)["']/i);
    
    if (dataLatMatch && dataLonMatch && dataLatMatch[1] && dataLonMatch[1]) {
      return {
        lat: parseFloat(dataLatMatch[1]),
        lon: parseFloat(dataLonMatch[1])
      };
    }

    logger.debug('No coordinates found in HTML');
    return undefined;
  }

  /**
   * Extract photo URLs from HTML
   * 
   * Based on website inspection: photos are in /database/images/ directory in slideshow
   */
  private extractPhotos(html: string, baseUrl: string): string[] {
    const photos: string[] = [];
    const seen = new Set<string>();

    // New Westminster stores photos in /database/images/ directory
    const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let match;
    
    while ((match = imgPattern.exec(html)) !== null) {
      const src = match[1];
      if (!src) continue;
      
      // Only include artwork photos from /database/images/ directory
      if (src.includes('/database/images/')) {
        // Filter out thumbnails, icons, logos, and UI elements
        if (src.includes('_thumb') || src.includes('icon_') || src.includes('logo') || 
            src.includes('sprite') || src.includes('button') || src.includes('banner') ||
            src.includes('Anvil') || src.includes('favicon')) {
          continue;
        }
        
        // Must be an image file
        if (!src.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          continue;
        }

        const fullUrl = this.normalizeUrl(src, baseUrl);
        
        if (!seen.has(fullUrl)) {
          seen.add(fullUrl);
          photos.push(fullUrl);
        }
      }
    }

    logger.debug(`Extracted ${photos.length} photos`);
    return photos;
  }



  /**
   * Parse artist detail page
   * 
   * Note: New Westminster site doesn't have separate artist pages.
   * Artist information is included in artwork pages.
   * This method is kept for compatibility but returns minimal data.
   */
  parseArtistDetail(html: string, url: string): ArtistData {
    logger.debug(`Parsing artist detail: ${url}`);

    const artist: ArtistData = {
      name: '',
      sourceUrl: url
    };

    // Extract artist name from page title or h1
    artist.name = 
      this.extractText(html, /<h1[^>]*>(.*?)<\/h1>/is) ||
      this.extractText(html, /<title>(.*?)<\/title>/is).replace(/\s*\|.*$/, '').trim();

    // Look for "About the Artist" section if present
    const aboutArtistMatch = html.match(/<h3[^>]*>About the Artist<\/h3>([\s\S]*?)(?:<h3|<div[^>]*class=["'][^"']*group-right)/is);
    if (aboutArtistMatch && aboutArtistMatch[1]) {
      const paragraphs: string[] = [];
      const pPattern = /<p[^>]*>(.*?)<\/p>/gis;
      let pMatch;
      while ((pMatch = pPattern.exec(aboutArtistMatch[1])) !== null && paragraphs.length < 5) {
        if (pMatch[1]) {
          const text = this.decodeHtmlEntities(pMatch[1]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text.length > 20) {
            paragraphs.push(text);
          }
        }
      }
      artist.biography = paragraphs.join(' ');
    }

    logger.debug(`Parsed artist: ${artist.name || 'Unknown'}`);

    return artist;
  }
}
