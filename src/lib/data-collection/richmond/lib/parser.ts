/**
 * HTML Parser for Richmond Public Art Registry
 *
 * Extracts data from HTML using regex and string manipulation.
 * Handles ASP.NET ViewState, GPS coordinates from URLs, and multiple artists.
 */

import { logger } from './logger.js';

export interface ArtworkData {
  id: string;
  url: string;
  title: string;
  coordinates?: { lat: number; lon: number } | undefined;
  description: string;
  year?: string | undefined;
  materials?: string | undefined;
  address?: string | undefined;
  area?: string | undefined;
  location?: string | undefined;
  program?: string | undefined;
  ownership?: string | undefined;
  sponsor?: string | undefined;
  photos: string[];
  artistLinks: string[];
  artistNames: string[];
  status?: string | undefined;
}

export interface ArtistData {
  name: string;
  sourceUrl: string;
  location?: string | undefined;
  biography?: string | undefined;
}

export interface ViewStateData {
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
}

export class HTMLParser {
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
      .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  /**
   * Extract text content from HTML, removing tags
   */
  private extractText(html: string): string {
    return this.decodeHtmlEntities(html)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract ViewState data from ASP.NET page
   */
  extractViewState(html: string): ViewStateData | null {
    // Allow for optional attributes (like id="...") between name and value
    const viewStateMatch = html.match(/name="__VIEWSTATE"[^>]*value="([^"]+)"/i);
    const viewStateGeneratorMatch = html.match(/name="__VIEWSTATEGENERATOR"[^>]*value="([^"]+)"/i);
    const eventValidationMatch = html.match(/name="__EVENTVALIDATION"[^>]*value="([^"]+)"/i);

    if (!viewStateMatch || !viewStateGeneratorMatch || !eventValidationMatch) {
      logger.warn('Failed to extract ViewState data');
      return null;
    }

    return {
      viewState: viewStateMatch[1] || '',
      viewStateGenerator: viewStateGeneratorMatch[1] || '',
      eventValidation: eventValidationMatch[1] || '',
    };
  }

  /**
   * Extract total results count from index page
   */
  extractResultsCount(html: string): number | null {
    // "Showing 1 to 12 of 381 results"
    const match = html.match(/Showing\s+\d+\s+to\s+\d+\s+of\s+(\d+)\s+results/i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  /**
   * Extract artwork IDs from index page
   */
  parseArtworkIndex(html: string, baseUrl: string): string[] {
    const urls: string[] = [];
    
    // Debug: log a sample of the HTML to understand structure
    logger.debug('Parsing index page HTML...');
    
    // Try multiple patterns to match the artwork links
    const patterns = [
      /<a[^>]*href=["']PublicArt\.aspx\?ID=(\d+)["'][^>]*>/gi,
      /<a[^>]+href=["']\s*PublicArt\.aspx\?ID=(\d+)\s*["'][^>]*>/gi,
      /href=["']PublicArt\.aspx\?ID=(\d+)["']/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      
      while ((match = pattern.exec(html)) !== null) {
        if (match[1]) {
          const url = `${baseUrl}/culture/howartworks/publicart/collection/PublicArt.aspx?ID=${match[1]}`;
          urls.push(url);
        }
      }
      
      if (urls.length > 0) {
        logger.debug(`Found ${urls.length} URLs with pattern: ${pattern}`);
        break;
      }
    }
    
    if (urls.length === 0) {
      logger.warn('No artwork URLs found in index page');
      // Log a snippet of HTML for debugging
      const snippet = html.substring(0, 2000);
      logger.debug(`HTML snippet: ${snippet}`);
    }

    // Deduplicate
    return Array.from(new Set(urls));
  }

  /**
   * Extract GPS coordinates from any LocationsMap link URL found in the HTML
   * Tries a simple regex first, then searches for an href and parses query params.
   */
  private extractCoordinates(html: string, baseUrl: string): { lat: number; lon: number } | undefined {
    // Decode HTML entities first so &amp; doesn't break query parsing
    const decoded = this.decodeHtmlEntities(html);

    // First try simple regex for common pattern after decoding
    const simplePattern = /LocationsMap\.aspx\?[Xx]=(-?\d+\.?\d*)[&][Yy]=(-?\d+\.?\d*)/i;
    const simpleMatch = decoded.match(simplePattern);
    if (simpleMatch && simpleMatch[1] && simpleMatch[2]) {
      const lon = parseFloat(simpleMatch[1]);
      const lat = parseFloat(simpleMatch[2]);
      if (!isNaN(lon) && !isNaN(lat)) return { lat, lon };
    }

    // Fallback: find any href that contains LocationsMap.aspx and parse its query params
    const hrefPattern = /href=["']([^"']*LocationsMap\.aspx[^"']*)["']/gi;
    let m;
    while ((m = hrefPattern.exec(decoded)) !== null) {
      const raw = m[1] || '';
      try {
        // Resolve relative URLs against baseUrl
        // Use decoded raw so querystring contains plain '&'
        const resolved = new URL(raw, baseUrl).toString();
        const u = new URL(resolved);
        // searchParams is case-sensitive for keys; check both
        const x = u.searchParams.get('x') ?? u.searchParams.get('X');
        const y = u.searchParams.get('y') ?? u.searchParams.get('Y');
        if (x && y) {
          const lon = parseFloat(x);
          const lat = parseFloat(y);
          if (!isNaN(lon) && !isNaN(lat)) return { lat, lon };
        }
      } catch (err) {
        // ignore and continue
      }
    }

    return undefined;
  }

  /**
   * Extract artist links and names
   */
  private extractArtists(html: string): { links: string[]; names: string[] } {
    const links: string[] = [];
    const names: string[] = [];
    
    // Pattern: <a href="Artist.aspx?ID=164">Nancy Chew</a>
    const pattern = /<a[^>]*href=["']Artist\.aspx\?ID=(\d+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = pattern.exec(html)) !== null) {
      if (match[1] && match[2]) {
        const url = `https://www.richmond.ca/culture/howartworks/publicart/collection/Artist.aspx?ID=${match[1]}`;
        const name = this.extractText(match[2]);
        links.push(url);
        names.push(name);
      }
    }
    
    return { links, names };
  }

  /**
   * Extract photos from carousel
   */
  private extractPhotos(html: string, pageUrlOrBase: string): string[] {
    const photos: string[] = [];
    // Prefer images inside the artwork image container (carousel)
    const containerPatterns = [
      /<div[^>]*id=["']ctl00_main_viewArtwork_rptImages["'][^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class=["'][^"']*image-row__images[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class=["'][^"']*image-row[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    ];

    let searchHtml: string | null = null;
    for (const p of containerPatterns) {
      const m = html.match(p);
      if (m && m[1]) {
        searchHtml = m[1];
        break;
      }
    }

    // If no container found, fall back to whole document
    if (!searchHtml) searchHtml = html;

    // Extract all img tags within the chosen HTML
    const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = imgPattern.exec(html)) !== null) {
      if (match[1]) {
        let photoUrl = match[1].trim();

        // Resolve relative URLs against the artwork page URL when possible
        try {
          const resolved = new URL(photoUrl, pageUrlOrBase).toString();
          photoUrl = resolved;
        } catch (err) {
          // fallback: naive prefix using base
          if (photoUrl.startsWith('/')) {
            photoUrl = pageUrlOrBase + photoUrl;
          } else if (!photoUrl.startsWith('http')) {
            photoUrl = pageUrlOrBase + '/' + photoUrl;
          }
        }

        // Avoid duplicates
        // Filter out obvious site-wide assets (logos, banners, analytics images)
        const lower = photoUrl.toLowerCase();
        const skipPatterns = ['/shared/assets', '/__shared/', 'logo', 'googlelogo', 'footerimage', 'browsealoud', 'siteanalyze'];
        let skip = false;
        for (const p of skipPatterns) {
          if (lower.includes(p)) { skip = true; break; }
        }

        if (!skip) {
          if (!photos.includes(photoUrl)) photos.push(photoUrl);
        }
      }
    }

    return photos;
  }

  /**
   * Parse artwork detail page
   */
  parseArtworkDetail(html: string, url: string, baseUrl: string): ArtworkData | null {
    try {
      // Extract ID from URL
      const idMatch = url.match(/ID=(\d+)/);
      if (!idMatch || !idMatch[1]) {
        logger.warn(`Could not extract ID from URL: ${url}`);
        return null;
      }
      const id = idMatch[1];

      // Extract title from <h1>
      const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
      if (!titleMatch || !titleMatch[1]) {
        logger.warn(`Could not extract title for ID ${id}`);
        return null;
      }
      const title = this.extractText(titleMatch[1]);

  // Extract GPS coordinates from address link
  const coordinates = this.extractCoordinates(html, baseUrl);
      if (!coordinates) {
        logger.debug(`No coordinates found for artwork ${id}: ${title}`);
      }

      // Extract artists
      const artists = this.extractArtists(html);

      // Extract address: prefer the HyperLinkMap anchor, fallback to any LocationsMap link text
      let address: string | undefined;
      try {
        // Look for the explicit HyperLinkMap id first
        const mapLinkMatch = html.match(/<a[^>]*id=["']ctl00_main_viewArtwork_HyperLinkMap["'][^>]*>([\s\S]*?)<\/a>/i);
        if (mapLinkMatch && mapLinkMatch[1]) {
          // extract inner text
          address = this.extractText(mapLinkMatch[1]);
        } else {
          // fallback: any anchor linking to LocationsMap.aspx
          const hrefTextMatch = html.match(/<a[^>]*href=["'][^"']*LocationsMap\.aspx[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
          if (hrefTextMatch && hrefTextMatch[1]) {
            address = this.extractText(hrefTextMatch[1]);
          }
        }
      } catch (err) {
        // ignore
      }

      // Extract year - often in breadcrumb or near title
      let year: string | undefined;
      const yearMatch = html.match(/<div[^>]*class=["'][^"']*year[^"']*["'][^>]*>"?(\d{4})"?<\/div>/i);
      if (yearMatch && yearMatch[1]) {
        year = yearMatch[1];
      }

      // address already attempted above (HyperLinkMap or LocationsMap link text)

      // Extract area
      let area: string | undefined;
      const areaPatterns = [
        // Richmond specific: <strong>Area:</strong><span id="ctl00_main_viewArtwork_lblArea">...</span>
        /<strong>Area:<\/strong>\s*<span[^>]*id=["']ctl00_main_viewArtwork_lblArea["'][^>]*>([\s\S]*?)<\/span>/i,
        // General: <strong>Area:</strong><span>...</span>
        /<strong>Area:<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/i,
        // Text node after strong tag
        /<strong>Area:<\/strong>\s*([^<\n]+)/is,
      ];
      for (const p of areaPatterns) {
        const m = html.match(p);
        if (m && m[1]) {
          area = this.extractText(m[1]);
          break;
        }
      }

      // Extract location details
      let location: string | undefined;
      const locationPatterns = [
        // Richmond specific: <strong>Location:</strong><span id="ctl00_main_viewArtwork_lblLocation">...</span>
        /<strong>Location:<\/strong>\s*<span[^>]*id=["']ctl00_main_viewArtwork_lblLocation["'][^>]*>([\s\S]*?)<\/span>/i,
        // General: <strong>Location:</strong><span>...</span>
        /<strong>Location:<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/i,
        // Text node after strong tag
        /<strong>Location:<\/strong>\s*([^<\n]+)/is,
      ];
      for (const p of locationPatterns) {
        const m = html.match(p);
        if (m && m[1]) {
          location = this.extractText(m[1]);
          break;
        }
      }

      // Extract materials (try a few HTML layouts)
      let materials: string | undefined;
      const materialsPatterns = [
        // Richmond specific: <strong>Materials:</strong><span id="ctl00_main_viewArtwork_lblMaterial">...</span>
        /<strong>Materials:<\/strong>\s*<span[^>]*id=["']ctl00_main_viewArtwork_lblMaterial["'][^>]*>([\s\S]*?)<\/span>/i,
        // General: <strong>Materials:</strong><span>...</span>
        /<strong>Materials:<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/i,
        // Text node after strong tag: <strong>Materials:</strong>Text
        /<strong>Materials:<\/strong>\s*([^<\n]+)/is,
        // Paragraph with strong label: <p><strong>Materials:</strong>Text</p>
        /<p[^>]*>\s*<strong>Materials:<\/strong>\s*([^<]+)/is,
        /<dt>\s*Materials\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i,
        /<label[^>]*>Materials[:\s]*<\/label>\s*([^<]+)/i,
        /<th[^>]*>\s*Materials\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i,
        /<b>\s*Materials:?\s*<\/b>\s*([^<]+)/i,
        /<b>\s*Material:?\s*<\/b>\s*([^<]+)/i,
        /<div[^>]*class=["'][^"']*materials[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        /<span[^>]*class=["'][^"']*materials[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
      ];
      for (const p of materialsPatterns) {
        const m = html.match(p);
        if (m && m[1]) {
          // normalize whitespace and paragraphs
          const raw = m[1];
          // join paragraphs inside capture if present
          const paras: string[] = [];
          const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
          let mm: RegExpExecArray | null;
          while ((mm = pRe.exec(raw)) !== null) {
            if (mm[1]) paras.push(this.extractText(mm[1]));
          }
          if (paras.length > 0) {
            materials = paras.join('\n\n');
          } else {
            materials = this.extractText(raw);
          }
          materials = materials || undefined;
          break;
        }
      }

      // Extra loose fallbacks: look for 'Materials:' text anywhere followed by content
      if (!materials) {
        const loose = html.match(/Materials[:\s]*<\/?\w*[^>]*>\s*([^<\n]{10,})/i);
        if (loose && loose[1]) materials = this.extractText(loose[1]);
      }

      // Table row pattern: <tr><td>Materials</td><td>...</td></tr>
      if (!materials) {
        const tr = html.match(/<tr[^>]*>\s*<td[^>]*>\s*(?:Materials|Material)\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/i);
        if (tr && tr[1]) materials = this.extractText(tr[1]);
      }

      // Keyword-based fallback: find sentence/phrase mentioning known material words
      if (!materials) {
        const keywordRe = /([^.\n]{20,100}?\b(Ductal|Bronze|concrete|steel|wood|patina|UHPC|glass)[^.\n]{0,100}?\.)/i;
        const k = html.match(keywordRe);
        if (k && k[1]) {
          materials = this.extractText(k[1]);
        }
      }

      // Extract program
      let program: string | undefined;
      const programMatch = html.match(/<strong>Program:<\/strong>\s*([^<]+)/is);
      if (programMatch && programMatch[1]) {
        program = this.extractText(programMatch[1]);
      }

      // Extract ownership
      let ownership: string | undefined;
      const ownershipMatch = html.match(/<strong>Ownership:<\/strong>\s*([^<]+)/is);
      if (ownershipMatch && ownershipMatch[1]) {
        ownership = this.extractText(ownershipMatch[1]);
      }

      // Extract sponsor
      let sponsor: string | undefined;
      const sponsorMatch = html.match(/<strong>Sponsored By:<\/strong>\s*([^<]+)/is);
      if (sponsorMatch && sponsorMatch[1]) {
        sponsor = this.extractText(sponsorMatch[1]);
      }

      // Extract description sections (preserve multiple paragraphs)
      let description = '';

      const extractSection = (heading: string): string => {
        const re = new RegExp(`<h2[^>]*>${heading}<\/h2>([\\s\\S]*?)(?=<h2|$)`, 'i');
        const sec = html.match(re);
        if (!sec || !sec[1]) return '';
        const inner = sec[1];
        // collect all <p>...</p> blocks within the section
        const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        let m: RegExpExecArray | null;
        const paras: string[] = [];
        while ((m = pRe.exec(inner)) !== null) {
          if (m[1]) paras.push(this.extractText(m[1]));
        }
        // if no <p> blocks, fallback to stripping tags from the whole section
        if (paras.length === 0) {
          const txt = this.extractText(inner);
          if (txt) paras.push(txt);
        }
        return paras.join('\n\n');
      };

      const descPart = extractSection('Description of Work');
      const artistStmt = extractSection('Artist Statement');
      if (descPart) {
        description += 'Description of Work\n' + descPart;
      }
      if (artistStmt) {
        if (description) description += '\n\n';
        description += 'Artist Statement\n' + artistStmt;
      }

      // Extract photos (pass artwork page URL so relative img paths resolve correctly)
      const photos = this.extractPhotos(html, url);

      // Ensure address is populated: prefer HyperLinkMap, then explicit Address field, then any LocationsMap anchor text
      if (!address) {
        // Try <strong>Address:</strong> label
        const addrStrong = html.match(/<strong>Address:<\/strong>\s*([^<]+)/is);
        if (addrStrong && addrStrong[1]) {
          address = this.extractText(addrStrong[1]);
        }
      }

      // Check for "No longer on display" status
      let status: string | undefined;
      if (html.includes('No longer on display')) {
        status = 'removed';
      }

      return {
        id,
        url,
        title,
        coordinates,
        description,
        year,
        materials,
        address,
        area,
        location,
        program,
        ownership,
        sponsor,
        photos,
        artistLinks: artists.links,
        artistNames: artists.names,
        status,
      };

    } catch (error) {
      logger.error(`Error parsing artwork detail: ${error}`);
      return null;
    }
  }

  /**
   * Parse artist detail page
   */
  parseArtistDetail(html: string, url: string): ArtistData | null {
    try {
      // Extract name from <h1>
      const nameMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
      if (!nameMatch || !nameMatch[1]) {
        logger.warn(`Could not extract artist name from: ${url}`);
        return null;
      }
      const name = this.extractText(nameMatch[1]);

      // Extract location
      let location: string | undefined;
      const locationMatch = html.match(/<div[^>]*class=["'][^"']*artist[^"']*["'][^>]*>\s*<i[^>]*><\/i>\s*([^<]+)</is);
      if (locationMatch && locationMatch[1]) {
        location = this.extractText(locationMatch[1]);
      }

      // Extract biography
      let biography: string | undefined;
      const bioMatch = html.match(/<h2[^>]*>Biography<\/h2>\s*<p[^>]*>(.*?)<\/p>/is);
      if (bioMatch && bioMatch[1]) {
        biography = this.extractText(bioMatch[1]);
      }

      return {
        name,
        sourceUrl: url,
        location,
        biography,
      };

    } catch (error) {
      logger.error(`Error parsing artist detail: ${error}`);
      return null;
    }
  }
}
