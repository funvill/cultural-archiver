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
  // Optional artist name(s) parsed directly from the artwork page
  artist?: string;
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

  // ...existing code... (attribute extractor removed because it's unused in this parser)

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
      data.title = this.extractText(html, titleTagPattern)
        .replace(' - Burnaby Art Gallery', '')
        .replace(' - Collections', '');
    }

    logger.debug(`  Title: ${data.title || '(not found)'}`);

    // Extract coordinates from embedded map or structured data
    const coords = this.extractCoordinates(html);
    if (coords) {
      data.coordinates = coords;
      logger.debug(`  Coordinates: ${coords.lat}, ${coords.lon}`);
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

    // Attempt to extract artist name(s) from the artwork page itself.
    // Look for label 'Artist:' or anchor text for linked artist(s).
    let artistName = this.extractFieldByLabel(html, 'artist') || '';
    if (!artistName) {
      // Try to locate an anchor around the artist link and capture the link text
      const artistAnchorPattern = /<a[^>]+href=["'](?:[^"']*\/link\/artists\d+|\/list[^"']*artist_facet=[^"']+)["'][^>]*>([^<]+)<\/a>/i;
      const m = html.match(artistAnchorPattern);
      if (m && m[1]) {
        artistName = this.decodeHtmlEntities(m[1]).replace(/<[^>]+>/g, '').trim();
      }
    }

    if (artistName) {
      // Normalize simple "Last, First" to "First Last"
      const normalized = artistName.includes(',')
        ? artistName.split(',').map(s => s.trim()).reverse().join(' ').replace(/\s+/g, ' ').trim()
        : artistName.trim();
      data.artist = normalized;
      logger.debug(`  Artist parsed from artwork page: ${normalized}`);
    }

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
    if (match && typeof match[1] === 'string' && typeof match[2] === 'string') {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      if (this.isValidCoordinate(lat, lon)) {
        return { lat, lon };
      }
    }
    
    // Pattern 2: Google Maps query parameter
    const gmapsPattern = /[?&]query=([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)/;
    match = html.match(gmapsPattern);
    if (match && typeof match[1] === 'string' && typeof match[2] === 'string') {
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
    
    if (latMatch && typeof latMatch[1] === 'string' && lonMatch && typeof lonMatch[1] === 'string') {
      const lat = parseFloat(latMatch[1]);
      const lon = parseFloat(lonMatch[1]);
      if (this.isValidCoordinate(lat, lon)) {
        return { lat, lon };
      }
    }

    // Pattern 4: JSON-LD or structured data
    const jsonLdPattern = /"latitude"\s*:\s*([+-]?\d+\.?\d*)\s*,\s*"longitude"\s*:\s*([+-]?\d+\.?\d*)/;
    match = html.match(jsonLdPattern);
    if (match && typeof match[1] === 'string' && typeof match[2] === 'string') {
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
    const lower = label.toLowerCase();
    // Special handling for keywords: try to collect anchors or comma-separated lists
    if (lower === 'keywords') {
      // Collect all <dd> elements that follow a <dt>Keywords</dt>
      // Some pages list each keyword in its own <dd> with an <a> inside.
      const ddAllPattern = /<dt[^>]*>\s*Keywords\s*<\/dt>\s*([\s\S]*?)(?=<dt|<h|<section|<\/dl|<\/table|$)/i;
      let m = html.match(ddAllPattern);
      const collected: string[] = [];

      if (m && m[1]) {
        const block = m[1];
        // Find all <dd>...</dd> inside the block
        const ddPattern = /<dd[^>]*>([\s\S]*?)<\/dd>/gi;
        let ddMatch;
        while ((ddMatch = ddPattern.exec(block)) !== null) {
          if (!ddMatch[1]) continue;
          const inner = ddMatch[1];
          // Prefer anchor texts
          const anchors: string[] = [];
          let aMatch;
          const aPattern = /<a[^>]*>([^<]+)<\/a>/gi;
          while ((aMatch = aPattern.exec(inner)) !== null) {
            if (aMatch[1]) anchors.push(this.decodeHtmlEntities(aMatch[1].trim()));
          }
          if (anchors.length > 0) {
            collected.push(...anchors.map(s => s.replace(/\s+/g, ' ').trim()));
            continue;
          }

          // Fallback: strip tags and split by commas
          const text = this.decodeHtmlEntities(inner).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text) collected.push(...text.split(',').map(s => s.trim()).filter(Boolean));
        }
      }

      // As a fallback, look for inline lists after a Keywords label
      if (collected.length === 0) {
        const inlinePattern = /(?:Keywords)\s*:?([\s\S]{0,300}?)(?:<\/p>|<br|<\/div>|<dt|<h|$)/i;
        m = html.match(inlinePattern);
        if (m && m[1]) {
          const text = this.decodeHtmlEntities(m[1]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text) collected.push(...text.split(',').map(s => s.trim()).filter(Boolean));
        }
      }

      if (collected.length > 0) {
        // Deduplicate while preserving order
        const seenSet = new Set<string>();
        const result: string[] = [];
        for (const k of collected) {
          const key = k.trim();
          if (!seenSet.has(key) && key !== '') {
            seenSet.add(key);
            result.push(key);
          }
        }
        return result.join(', ');
      }

      return '';
    }
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
        let url = String(match[1]);

        // Convert relative media paths to absolute URLs hosted at collections.burnabyartgallery.ca
        if (!url.startsWith('http')) {
          // Ensure leading slash
          url = url.startsWith('/') ? `https://collections.burnabyartgallery.ca${url}` : `https://collections.burnabyartgallery.ca/${url}`;
        }

        // Strip width query parameter (e.g., ?width=280) or any width= param
        try {
          const u = new URL(url);
          if (u.searchParams.has('width')) {
            u.searchParams.delete('width');
          }
          // Also remove any empty trailing ?
          url = u.origin + u.pathname + (u.search ? `?${u.searchParams.toString()}` : '');
        } catch (e) {
          // If URL parsing fails, fallback to simple regex removal
          url = url.replace(/\?width=\d+/i, '');
        }

        // Filter thumbnails or derivative images
        if (!seen.has(url) && !url.toLowerCase().includes('thumbnail')) {
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
          // Ensure we assign a defined string (fallback to empty string)
          data.biography = bioPairs[0] || '';
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
