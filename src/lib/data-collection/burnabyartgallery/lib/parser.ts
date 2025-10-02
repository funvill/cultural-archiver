/**
 * HTML Parser for Burnaby Art Gallery
 *
 * Extracts data from HTML using only built-in Node.js modules.
 * Uses regex and string manipulation instead of external parsing libraries.
 */

import { logger } from './logger.js';

export interface ArtworkData {
  id: string;
  url: string;
  title: string;
  coordinates?: { lat: number; lon: number };
  description: string;
  date: string;
  medium: string;
  technique: string;
  dimensions: string;
  location: string;
  keywords: string;
  owner: string;
  category: string;
  accessionNumber: string;
  collection: string;
  artworkType: string;
  photos: string[];
  artistLinks: string[];
}

export interface ArtistData {
  name: string;
  sourceUrl: string;
  biography?: string;
  birthDate: string;
  deathDate: string;
  websites: string;
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
   */
  private extractAttribute(html: string, pattern: RegExp): string {
    const match = html.match(pattern);
    return match && match[1] ? match[1].trim() : '';
  }

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
   */
  parseArtworkIndex(html: string, baseUrl: string): string[] {
    logger.debug('Parsing artwork index page...');

    // Pattern to match artwork permalink URLs (both relative and absolute)
    // Matches: /link/publicartXX or https://collections.burnabyartgallery.ca/link/publicartXX
    const linkPattern = /href=["'](?:https:\/\/collections\.burnabyartgallery\.ca)?(\/link\/publicart\d+)["']/gi;
    const urls: string[] = [];
    const seen = new Set<string>();

    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const urlMatch = match[1];
      if (!urlMatch) continue;
      
      let url = urlMatch;
      
      // Convert relative URL to absolute
      if (!url.startsWith('http')) {
        url = url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
      }

      // Deduplicate
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }

    logger.info(`Found ${urls.length} unique artwork URLs`);
    return urls;
  }

  /**
   * Detect total number of pages from index
   */
  detectTotalPages(html: string): number {
    // Look for pagination indicators
    // Common patterns: "Page 1 of 3", "Showing 1-200 of 114 results"
    
    // Try to find total results count
    const resultPattern = /(\d+)\s+results?/i;
    const match = html.match(resultPattern);
    
    if (match && match[1]) {
      const totalResults = parseInt(match[1], 10);
      logger.debug(`Detected ${totalResults} total results`);
      
      // Assuming 200 results per page (from config)
      return Math.ceil(totalResults / 200);
    }

    // Fallback: look for highest page number
    const pagePattern = /[?&]p=(\d+)/g;
    let maxPage = 1;
    let pageMatch;
    
    while ((pageMatch = pagePattern.exec(html)) !== null) {
      if (pageMatch[1]) {
        const pageNum = parseInt(pageMatch[1], 10);
        if (pageNum > maxPage) {
          maxPage = pageNum;
        }
      }
    }

    logger.debug(`Detected maximum page number: ${maxPage}`);
    return maxPage;
  }

  /**
   * Parse artwork detail page
   */
  parseArtworkDetail(html: string, url: string): Partial<ArtworkData> {
    logger.debug(`Parsing artwork detail: ${url}`);

    const data: Partial<ArtworkData> = {
      url,
      id: this.extractArtworkId(url),
    };

    // Extract title - usually in <h1> or <title> tag
    const titlePattern = /<h1[^>]*>(.*?)<\/h1>/is;
    data.title = this.extractText(html, titlePattern);
    if (!data.title) {
      // Fallback to title tag
      const titleTagPattern = /<title>(.*?)<\/title>/is;
      data.title = this.extractText(html, titleTagPattern).replace(' - Burnaby Art Gallery', '');
    }

    logger.debug(`  Title: ${data.title || '(not found)'}`);

    // Extract coordinates from embedded map or structured data
    data.coordinates = this.extractCoordinates(html);
    if (data.coordinates) {
      logger.debug(`  Coordinates: ${data.coordinates.lat}, ${data.coordinates.lon}`);
    } else {
      logger.warn(`  No coordinates found for: ${url}`);
    }

    // Extract description (labeled as "about" on the website)
    data.description = this.extractFieldByLabel(html, 'about') || '';

    // Extract metadata fields
    data.date = this.extractFieldByLabel(html, 'date');
    data.medium = this.extractFieldByLabel(html, 'medium');
    data.technique = this.extractFieldByLabel(html, 'technique');
    data.dimensions = this.extractFieldByLabel(html, 'dimensions');
    data.location = this.extractFieldByLabel(html, 'location');
    data.keywords = this.extractFieldByLabel(html, 'keywords');
    data.owner = this.extractFieldByLabel(html, 'owner');
    data.category = this.extractFieldByLabel(html, 'category');
    data.accessionNumber = this.extractFieldByLabel(html, 'accession number');
    data.collection = this.extractFieldByLabel(html, 'collection');
    data.artworkType = this.extractFieldByLabel(html, 'type') || this.extractFieldByLabel(html, 'artwork type') || 'unknown';

    // Extract photos
    data.photos = this.extractPhotos(html);
    logger.debug(`  Photos found: ${data.photos.length}`);

    // Extract artist links
    data.artistLinks = this.extractArtistLinks(html);
    logger.debug(`  Artist links found: ${data.artistLinks.length}`);

    return data;
  }

  /**
   * Extract artwork ID from URL
   */
  private extractArtworkId(url: string): string {
    const match = url.match(/\/link\/(publicart\d+)/);
    return match ? `node/${match[1]}` : '';
  }

  /**
   * Extract coordinates from HTML
   */
  private extractCoordinates(html: string): { lat: number; lon: number } | undefined {
    // Look for common coordinate patterns in maps/structured data
    
    // Pattern 1: Direct coordinate pair in paragraph (e.g., "49.278845,-122.915511")
    const coordPairPattern = /<p[^>]*>\s*([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)\s*<\/p>/;
    let match = html.match(coordPairPattern);
    if (match && match[1] && match[2]) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      if (this.isValidCoordinate(lat, lon)) {
        return { lat, lon };
      }
    }
    
    // Pattern 2: Google Maps query parameter
    const gmapsPattern = /[?&]query=([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)/;
    match = html.match(gmapsPattern);
    if (match && match[1] && match[2]) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      if (this.isValidCoordinate(lat, lon)) {
        return { lat, lon };
      }
    }

    // Pattern 3: Latitude/Longitude labels
    const latPattern = /latitude[:\s]*([+-]?\d+\.?\d*)/i;
    const lonPattern = /longitude[:\s]*([+-]?\d+\.?\d*)/i;
    
    const latMatch = html.match(latPattern);
    const lonMatch = html.match(lonPattern);
    
    if (latMatch && latMatch[1] && lonMatch && lonMatch[1]) {
      const lat = parseFloat(latMatch[1]);
      const lon = parseFloat(lonMatch[1]);
      if (this.isValidCoordinate(lat, lon)) {
        return { lat, lon };
      }
    }

    // Pattern 4: JSON-LD or structured data
    const jsonLdPattern = /"latitude"\s*:\s*([+-]?\d+\.?\d*)\s*,\s*"longitude"\s*:\s*([+-]?\d+\.?\d*)/;
    match = html.match(jsonLdPattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      if (this.isValidCoordinate(lat, lon)) {
        return { lat, lon };
      }
    }

    return undefined;
  }

  /**
   * Validate coordinates
   */
  private isValidCoordinate(lat: number, lon: number): boolean {
    return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  /**
   * Extract field by label (e.g., "Date:", "Medium:", etc.)
   */
  private extractFieldByLabel(html: string, label: string): string {
    // Special handling for biography: capture multi-paragraph content and sections
    if (label.toLowerCase() === 'biography') {
      const bioPatterns = [
        // <dt>Biography</dt><dd>...multiple tags...</dd>
        /<dt[^>]*>\s*Biography\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i,
        // <h3>Biography</h3> ... <p>...</p>
        /<h[1-6][^>]*>\s*Biography\s*<\/h[1-6]>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i,
        // <section class="biography">...</section>
        /<section[^>]*class=["']?[^"']*biography[^"']*["']?[^>]*>([\s\S]*?)<\/section>/i,
      ];

      for (const p of bioPatterns) {
        const m = html.match(p);
        if (m && m[1]) {
          // Decode and strip tags but preserve paragraphs as spaces
          const decoded = this.decodeHtmlEntities(m[1]).replace(/<br\s*\/?>(\s*)/gi, '\n').replace(/<\/p>\s*<p>/gi, '\n');
          const cleaned = decoded.replace(/<[^>]+>/g, '').replace(/\s+\n\s+/g, '\n').replace(/\s+/g, ' ').trim();
          return cleaned;
        }
      }
    }

    // Pattern: <label>Field Name:</label> <value>Content</value>
    // or <dt>Field Name</dt><dd>Content</dd>
    const patterns = [
      new RegExp(`<(?:label|dt|th)[^>]*>\\s*${label}\\s*:?\\s*</(?:label|dt|th)>\\s*<(?:span|dd|td)[^>]*>(.*?)</(?:span|dd|td)>`, 'is'),
      new RegExp(`<(?:strong|b)>\\s*${label}\\s*:?\\s*</(?:strong|b)>\\s*([^<]+)`, 'is'),
      new RegExp(`${label}\\s*:?\\s*</(?:label|dt|th)>\\s*([^<]+)`, 'is'),
    ];

    for (const pattern of patterns) {
      const text = this.extractText(html, pattern);
      if (text) {
        return text;
      }
    }

    return '';
  }

  /**
   * Extract photo URLs from page
   */
  private extractPhotos(html: string): string[] {
    const photos: string[] = [];
    const seen = new Set<string>();

    // Look for images in media galleries or with specific patterns
    const patterns = [
      /src=["'](https:\/\/collections\.burnabyartgallery\.ca\/media\/[^"']+)["']/gi,
      /<img[^>]+src=["']([^"']*\/media\/[^"']+)["']/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (!match[1]) continue;
        const url = String(match[1]);
        if (!seen.has(url) && !url.includes('thumbnail')) {
          seen.add(url);
          photos.push(url);
        }
      }
    }

    return photos;
  }

  /**
   * Extract artist links from page
   */
  private extractArtistLinks(html: string): string[] {
    const links: string[] = [];
    const seen = new Set<string>();
    // Prefer the "View artist biography" expanded link which includes ct=expand
    // Example: /list?q=&p=1&ps=&ct=expand&objectType_facet=artist000000|Artist&artist_facet=jacqueshuet000000|Jacques%20Huet
    const expandPattern = /href=["']([^"']*ct=expand[^"']*artist_facet=[^"']+)["']/gi;

    let match;
    while ((match = expandPattern.exec(html)) !== null) {
      if (!match[1]) continue;

      let url = match[1].replace(/&amp;/g, '&');
      if (!url.startsWith('http')) {
        url = `https://collections.burnabyartgallery.ca${url.startsWith('/') ? '' : '/'}${url}`;
      }

      if (!seen.has(url)) {
        seen.add(url);
        links.push(url);
      }
    }

    // Fallback: older/alternate "Artist" link (search URL without ct=expand)
    if (links.length === 0) {
      const pattern = /href=["']([^"']*artist_facet=[^"']+)["']/gi;
      while ((match = pattern.exec(html)) !== null) {
        if (!match[1]) continue;
        let url = match[1].replace(/&amp;/g, '&');
        if (!url.startsWith('http')) {
          url = `https://collections.burnabyartgallery.ca${url.startsWith('/') ? '' : '/'}${url}`;
        }

        if (!seen.has(url)) {
          seen.add(url);
          links.push(url);
        }
      }
    }

    return links;
  }

  /**
   * Parse artist detail page
   */
  parseArtistDetail(html: string, url: string): Partial<ArtistData> {
    logger.debug(`Parsing artist detail: ${url}`);

    const data: Partial<ArtistData> = {
      sourceUrl: url,
    };

    // If this is a search URL, try to extract the permalink to the actual artist page
    if (url.includes('artist_facet=') && url.includes('/list?')) {
      // Look for permalink in the search results (prefer the first permalink found)
      const permalinkPattern = /href=["']([^"']*\/link\/artists\d+)["']/i;
      const permalinkMatch = html.match(permalinkPattern);

      if (permalinkMatch && permalinkMatch[1]) {
        let permalink = permalinkMatch[1];
        if (!permalink.startsWith('http')) {
          permalink = `https://collections.burnabyartgallery.ca${permalink.startsWith('/') ? '' : '/'}${permalink}`;
        }
        // Update the source URL to use the permalink instead of search URL
        data.sourceUrl = permalink;
        logger.debug(`  Found artist permalink: ${permalink}`);

        // Important: search/list pages often contain truncated biographies (with ellipsis).
        // If we have a permalink, do not attempt to extract the biography from the search
        // page. The main workflow will fetch the permalink and re-parse the full page.
        return data;
      }
      // If no permalink was found, fall through and extract whatever is available on the list page
    }

    // Extract artist name from URL first (more reliable)
    const nameMatch = url.match(/artist_facet=[^|]+\|([^&]+)/);
    if (nameMatch && nameMatch[1]) {
      data.name = decodeURIComponent(nameMatch[1]).replace(/\+/g, ' ').replace(/%20/g, ' ');
    }

    // If not found in URL, try to extract from page heading
    if (!data.name) {
      const headingMatch = html.match(/<h3[^>]*>([^<]+)<\/h3>/i);
      if (headingMatch && headingMatch[1]) {
        data.name = headingMatch[1].trim();
      }
    }

    // Extract biography
    data.biography = this.extractFieldByLabel(html, 'biography') || this.extractFieldByLabel(html, 'about') || '';

    // If this is a permalink page, try to extract the biography from the detailed citation
    // block (which contains the full text), otherwise pick the longest Biography <dd>.
    const isPermalink = data.sourceUrl && String(data.sourceUrl).includes('/link/artists');
    if (isPermalink) {
      // Try to find the .and-citation-detail block which usually contains the full biography
      const detailBlock = html.match(/<div[^>]*class=["'][^"']*and-citation-detail[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      if (detailBlock && detailBlock[1]) {
        const bioInDetail = detailBlock[1].match(/<dt>\s*Biography\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
        if (bioInDetail && bioInDetail[1]) {
          const cleaned = this.decodeHtmlEntities(bioInDetail[1]).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          if (cleaned) {
            data.biography = cleaned;
          }
        }
      }

      // Fallback: find all Biography <dt>/<dd> pairs and choose the longest candidate
      if (!data.biography || data.biography.length < 120) {
        const bioPairs: string[] = [];
        const pairPattern = /<dt>\s*Biography\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/ig;
        let pm;
        while ((pm = pairPattern.exec(html)) !== null) {
          if (pm[1]) {
            const cleaned = this.decodeHtmlEntities(pm[1]).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (cleaned) bioPairs.push(cleaned);
          }
        }

        if (bioPairs.length > 0) {
          bioPairs.sort((a, b) => b.length - a.length);
          data.biography = bioPairs[0];
        }
      }
    }

    // Extract dates
    data.birthDate = this.extractFieldByLabel(html, 'birth date') || this.extractFieldByLabel(html, 'born') || '';
    data.deathDate = this.extractFieldByLabel(html, 'death date') || this.extractFieldByLabel(html, 'died') || '';

    // Extract websites
    data.websites = this.extractFieldByLabel(html, 'websites') || this.extractFieldByLabel(html, 'website') || '';

    logger.debug(`  Artist: ${data.name || '(not found)'}`);

    return data;
  }
}
