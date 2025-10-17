/**
 * Township of Langley Public Art Scraper
 *
 * Scrapes artworks listed on:
 *   https://www.tol.ca/en/arts-culture/public-art.aspx
 *
 * The page contains accordion sections by community/artist. Each expanded section
 * contains a table where each row is an artwork with columns:
 *   1) Images/addresses (image link + title + location name + street address)
 *   2) Artist name
 *   3) Year installed
 *   4) Project (artwork type)
 *   5) Description (multiple paragraphs)
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { ArtworkFeature } from '../shared/types';
import { ScraperBase } from '../shared/scraper-base';
import { logger } from '../shared/logger';
import { LocationService } from '../../../lib/location/service';

export class TownshipLangleyScraper extends ScraperBase {
  private readonly baseUrl = 'https://www.tol.ca';
  private readonly listUrl = `${this.baseUrl}/en/arts-culture/public-art.aspx`;
  private readonly locationService: LocationService;

  constructor() {
    super('township-langley', '1.0.0');
    this.locationService = new LocationService();
  }

  protected getSourceUrl(): string {
    return this.listUrl;
  }

  async scrape(): Promise<void> {
    logger.info('Starting Township of Langley Public Art scraper');

    // Single page contains all artworks
    const html = await this.httpClient.fetch(this.listUrl);
    const $ = cheerio.load(html);

    // Find all tables inside the main content that look like artwork listings
    const tables = $('main table');
    logger.info(`Found ${tables.length} tables to inspect`);

    let foundArtworks = 0;

    // Collect row data first to allow async geocoding in a simple for..of loop
    type RowData = {
      title: string;
      park: string | undefined;
      streetAddress: string | undefined;
      artistName: string | undefined;
      startYear: string | undefined;
      artworkType: string | undefined;
      description: string | undefined;
      photos: string[];
      sectionAnchor: string | undefined;
    };
    const rows: RowData[] = [];

    tables.each((_ti, table) => {
      const $table = $(table);

      // Identify section anchor from the previous heading if present
      let sectionAnchor: string | undefined;
      const prevHeading = $table.prevAll('h2').first();
      if (prevHeading.length) {
        const headingText = prevHeading.text().trim();
        if (headingText) {
          sectionAnchor = `#${headingText.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '')}`;
        }
      }

      // Map header labels to column indices based on first row
      const headerRow = $table.find('tr').first();
      if (headerRow.length === 0) return;
      const headerMap: Record<string, number> = {};
      const headerCells = headerRow.find('th, td');
      headerCells.each((idx, cell) => {
        const label = $(cell).text().toLowerCase();
        if (/image|images|address|addresses/.test(label)) headerMap['images'] = idx;
        if (label.includes('artist')) headerMap['artist'] = idx;
        if (label.includes('year')) headerMap['year'] = idx;
        if (label.includes('project')) headerMap['project'] = idx;
        if (label.includes('description')) headerMap['description'] = idx;
      });

      // Fallback: if we didn't detect standard labels but there are 5 header cells,
      // assume the canonical order [images, artist, year, project, description].
      if (Object.keys(headerMap).length === 0 && headerCells.length >= 5) {
        headerMap['images'] = 0;
        headerMap['artist'] = 1;
        headerMap['year'] = 2;
        headerMap['project'] = 3;
        headerMap['description'] = 4;
      }

  // Require at least the first column (images/addresses). Others are optional and handled defensively.
  if (headerMap['images'] === undefined) return;

      $table.find('tr').slice(1).each((_ri, row) => {
    const $cells = $(row).find('td');
    if ($cells.length === 0) return; // not a data row

  const firstIdx = headerMap['images'];
  const artistIdx = headerMap['artist'];
  const yearIdx = headerMap['year'];
  const typeIdx = headerMap['project'];
  const descIdx = headerMap['description'];

  const firstCell = firstIdx !== undefined ? $cells.eq(firstIdx) : cheerio.load('<td/>')('td');
  const artistCell = artistIdx !== undefined ? $cells.eq(artistIdx) : cheerio.load('<td/>')('td');
  const yearCell = yearIdx !== undefined ? $cells.eq(yearIdx) : cheerio.load('<td/>')('td');
  const typeCell = typeIdx !== undefined ? $cells.eq(typeIdx) : cheerio.load('<td/>')('td');
  const descCell = descIdx !== undefined ? $cells.eq(descIdx) : cheerio.load('<td/>')('td');

  const firstEl = firstCell.get(0) as unknown as Element;
  if (!firstEl) return; // cannot parse without the first column
  const photos = this.extractPhotosFromCell($, firstEl, this.baseUrl);
  let { title, park, streetAddress } = this.extractTitleAndAddress($, firstEl);
  if (!title && prevHeading.length) {
    title = prevHeading.text().trim();
  }
  const descEl = descCell.get(0) as unknown as Element | undefined;
  const description = descEl ? this.extractDescription($, descEl) : '';
        // Prefer artist cell text; if it looks wrong/like an address, fall back to section heading
        let artistName = artistCell.text().trim();
        const sectionArtist = prevHeading.length ? prevHeading.text().trim() : undefined;
        if (!this.isPlausibleArtistName(artistName)) {
          if (sectionArtist && this.isPlausibleArtistName(sectionArtist)) {
            artistName = sectionArtist;
          } else {
            artistName = '';
          }
        }
  let parsedStartYear = (yearCell.text() || '').replace(/["']/g, '').replace(/[^0-9]/g, '').trim();
  let parsedArtworkType = (typeCell.text() || '').trim();
        // Heuristic: sometimes columns are flipped; if 'project' cell is just a year, swap
        if (/^\d{4}$/.test(parsedArtworkType) && !/^\d{4}$/.test(parsedStartYear)) {
          parsedStartYear = parsedArtworkType;
          parsedArtworkType = (yearCell.text() || '').trim();
        }

        // If artist cell is implausible/empty but the project cell looks like a person name,
        // treat the project cell as the artist and clear artwork type.
        if (!this.isPlausibleArtistName(artistName) && this.isPlausibleArtistName(parsedArtworkType)) {
          artistName = parsedArtworkType;
          parsedArtworkType = '';
        }

        if (title) {
          rows.push({
            title,
            park,
            streetAddress,
            artistName,
            startYear: parsedStartYear || undefined,
            artworkType: parsedArtworkType || undefined,
            description,
            photos,
            sectionAnchor,
          });
        }
      });
    });

    // Process rows sequentially with geocoding and limits
    for (const row of rows) {
      if (this.limit !== undefined && this.artworks.length >= this.limit) {
        break;
      }

      try {
        const { title, park, streetAddress, artistName, startYear, artworkType, description, photos, sectionAnchor } = row;

  // Build ID slug with multiple parts to avoid collisions across sections
  const idParts = [title, park, streetAddress, artistName, startYear, sectionAnchor].filter(Boolean) as string[];
  const idSlug = this.toSlug(idParts.join(' '));
        let id = `township-langley/${idSlug}`;

        // If ID collides, try to disambiguate using a short token from photo/description/address
        if (this.isDuplicate(id)) {
          const tokenSource = (photos[0] || description || addrFull || '').toString();
          const token = this.toSlug(tokenSource).slice(-12);
          const altSlug = token ? `${idSlug}-${token}` : `${idSlug}-alt`;
          const altId = `township-langley/${altSlug}`;
          if (this.isDuplicate(altId)) {
            this.stats.duplicates++;
            continue;
          }
          id = altId;
        }

    const addrParts = [park, streetAddress].filter(Boolean) as string[];
    const addrFull = (addrParts.join(', ') + (addrParts.length ? ', ' : '') + 'Township of Langley, BC, Canada').trim();

        let coordinates: [number, number] = [0, 0];
        if (addrFull) {
          try {
            const geo = await this.locationService.geocodeAddress(addrFull);
            if (geo) {
              coordinates = [geo.lon, geo.lat];
            }
          } catch (e) {
            logger.warn('Geocoding failed', { address: addrFull, error: (e as Error).message });
          }
        }

        // Build a more specific source_url if we have a section anchor
        const sourceUrl = sectionAnchor ? `${this.listUrl}${sectionAnchor}` : this.listUrl;

        const artwork: ArtworkFeature = {
          type: 'Feature',
          id,
          geometry: {
            type: 'Point',
            coordinates,
          },
          properties: {
            '@id': id,
            tourism: 'artwork',
            name: title,
            ...(artistName && { artist_name: artistName }),
            ...(startYear && { start_date: startYear }),
            ...(artworkType && { artwork_type: artworkType }),
            ...(description && { description }),
            ...(addrFull && { 'addr:full': addrFull }),
            ...(photos.length > 0 && { image: photos[0], photos }),
            source: this.getSourceUrl(),
            source_url: sourceUrl,
          },
        };

        this.artworks.push(artwork);
        this.stats.success++;
        foundArtworks++;

        if (artistName) {
          const artistId = this.generateArtistId(artistName);
          this.trackArtist(artistName, artistId, sourceUrl);
        }

        await this.rateLimiter.wait();
      } catch (error) {
        this.stats.failed++;
        logger.error('Failed to process artwork row', { error: (error as Error).message });
      }
    }

    logger.info(`Scraping complete. Parsed ${foundArtworks} artworks`);
  }

  private isPlausibleArtistName(name: string | undefined): boolean {
    if (!name) return false;
    const trimmed = name.trim();
    if (!trimmed) return false;
    // Likely not an artist if it contains digits (addresses) or common address words
    if (/[0-9]/.test(trimmed)) return false;
  const addressWords = /(avenue|ave\b|street|st\b|road|rd\b|drive|dr\b|park|trail|channel|island|airport|church|glover|mavis|willoughby|murrayville|fort\s+langley|rural)/i;
    if (addressWords.test(trimmed)) return false;
    // Too long likely indicates description text
    if (trimmed.length > 100) return false;
    return true;
  }

  private extractPhotosFromCell($: CheerioAPI, firstCellEl: Element, baseUrl: string): string[] {
    const urls: string[] = [];
    $(firstCellEl).find('a').each((_i: number, a: Element) => {
      const href = a && a.attribs && a.attribs['href'] ? a.attribs['href'] : '';
      if (!href) return;
      const lower = href.toLowerCase();
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) {
        const full = href.startsWith('http') ? href : `${baseUrl}${href}`;
        urls.push(full);
      }
    });
    return [...new Set(urls)];
  }

  private extractTitleAndAddress($: CheerioAPI, firstCellEl: Element): {
    title: string;
    park?: string;
    streetAddress?: string;
  } {
    // Collect paragraph texts, ignoring the link label
    const texts: string[] = [];
    $(firstCellEl)
      .find('p')
      .each((_i: number, p: Element) => {
        const t = $(p).text().trim();
        if (!t) return;
        if (/opens in new window/i.test(t)) return; // skip link label
        texts.push(t);
      });

    if (texts.length === 0) {
      return { title: '' };
    }

    const hasDigits = (s: string) => /\d/.test(s);
    const addressHint = /(avenue|ave\b|street|st\b|road|rd\b|drive|dr\b|hwy|highway|mavis|glover|mary|university|airport|mavis|mary|mcmillan|glover|mavis|murrayville|fort\s+langley)/i;
    const placeHint = /(park|airport|plaza|trail|channel|island|university|school|church)/i;
    const titleHint = /(heritage|mural|photo|marker|hummingbirds|torch|heart|lily|sunflowers|columbine|ocean|forest|gift|feather|map|in\s+harmony)/i;

    // Identify address line (prefer the last line with digits or address-like hints)
    let streetAddress: string | undefined;
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (hasDigits(t) || addressHint.test(t)) {
        streetAddress = t;
        break;
      }
    }

    // Identify a plausible title: prefer a line that either matches titleHint or has no digits and is not just a location/place label
    let title = '';
    for (const t of texts) {
      if (t === streetAddress) continue;
      if (titleHint.test(t)) {
        title = t;
        break;
      }
    }
    if (!title) {
      for (const t of texts) {
        if (t === streetAddress) continue;
        if (!hasDigits(t) && !placeHint.test(t)) {
          title = t;
          break;
        }
      }
    }
    // Fallback: if still no title, pick the first non-address line
    if (!title) {
      title = texts.find(t => t !== streetAddress) || texts[0];
    }

    // Identify park/community line: the first non-title line that looks like a place and not an address
    let park: string | undefined;
    for (const t of texts) {
      if (t === streetAddress) continue;
      if (t === title) continue;
      if (!hasDigits(t) && placeHint.test(t)) {
        park = t;
        break;
      }
    }

    return { title, park, streetAddress };
  }

  private extractDescription($: CheerioAPI, descCellEl: Element): string {
    const parts: string[] = [];
    $(descCellEl).find('p').each((_i: number, p: Element) => {
      const txt = $(p).text().trim();
      if (txt) parts.push(txt);
    });
    return parts.join('\n\n');
  }

  private toSlug(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .substring(0, 80);
  }

  private generateArtistId(artistName: string): string {
    const normalized = artistName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 24);
    return `townshiplangley/${normalized}`;
  }
}

export default TownshipLangleyScraper;
