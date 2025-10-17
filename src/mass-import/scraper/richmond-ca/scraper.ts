/**
 * Richmond, BC Public Art Scraper
 * Scrapes artwork and artist data from Richmond's Public Art Registry
 */

import * as cheerio from 'cheerio';
import type { ArtworkFeature } from '../shared/types';
import { ScraperBase } from '../shared/scraper-base';
import { logger } from '../shared/logger';

export class RichmondCAScraper extends ScraperBase {
	private readonly baseUrl = 'https://www.richmond.ca';
	private readonly searchUrl = `${this.baseUrl}/culture/howartworks/publicart/collection/Search.aspx`;

	constructor() {
		super('richmond-ca', '1.0.0');
	}

	protected getSourceUrl(): string {
		return this.baseUrl;
	}

	/**
	 * Override run to add artist detail scraping
	 */
	override async run(options: { outputDir: string; verbose?: boolean }): Promise<void> {
		const startTime = Date.now();
		logger.info(`Starting scraper: ${this.scraperName} v${this.scraperVersion}`);

		if (options.verbose) {
			logger.setLevel('debug');
		}

		try {
			// Run the main scraper to collect artworks and track artists
			await this.scrape();

			// Scrape artist details
			logger.info(`Scraping details for ${this.artists.size} artists`);
			for (const artist of this.artists.values()) {
				await this.scrapeArtistDetails(artist.id, artist.name, artist.properties.source_url);
			}

			// Save output files
			await this.saveOutput(options.outputDir);

			const duration = ((Date.now() - startTime) / 1000).toFixed(2);
			logger.info(`Scraper completed in ${duration}s`, {
				total: this.stats.total,
				success: this.stats.success,
				failed: this.stats.failed,
				skipped: this.stats.skipped,
				duplicates: this.stats.duplicates,
				artists: this.artists.size,
			});
		} catch (error) {
			logger.error('Scraper failed', { error: (error as Error).message });
			throw error;
		}
	}

	/**
	 * Main scraping logic
	 */
	async scrape(): Promise<void> {
		logger.info(`Collecting artwork links from all pages...`);

		const allArtworkLinks: string[] = [];
		let page = 1;
		let hasMorePages = true;
		let currentHtml = await this.httpClient.fetch(this.searchUrl);

		while (hasMorePages) {
			logger.info(`Fetching page ${page}`);

			const artworkLinks = this.extractArtworkLinks(currentHtml);
			logger.info(`Found ${artworkLinks.length} artworks on page ${page}`);

			if (artworkLinks.length === 0) {
				hasMorePages = false;
				break;
			}

			allArtworkLinks.push(...artworkLinks);

			// Check if there's a next page by looking for pagination links
			const nextPageData = this.extractNextPagePostData(currentHtml, page + 1);
			if (nextPageData) {
				page++;
				logger.debug(`Fetching next page using ASP.NET postback...`);
				currentHtml = await this.fetchNextPage(nextPageData);
			} else {
				hasMorePages = false;
			}
		}

		// Remove duplicates
		const uniqueArtworkLinks = Array.from(new Set(allArtworkLinks));
		logger.info(`Total unique artwork links collected: ${uniqueArtworkLinks.length}`);

		// Now scrape each artwork
		for (const link of uniqueArtworkLinks) {
			// Check if we've reached the limit
			if (this.limit && this.stats.success >= this.limit) {
				logger.info(`Reached limit of ${this.limit} artworks`);
				break;
			}

			await this.scrapeArtwork(link);
			await this.rateLimiter.wait();
		}

		logger.info(`Scraping complete`, {
			pages: page,
			artworks: this.artworks.length,
			artists: this.artists.size,
		});
	}

	/**
	 * Extract artwork links from search results page
	 */
	private extractArtworkLinks(html: string): string[] {
		const $ = cheerio.load(html);
		const links: string[] = [];

		// Find all artwork links - they follow pattern PublicArt.aspx?ID=XXX
		$('a[href*="PublicArt.aspx?ID="]').each((_, element) => {
			const href = $(element).attr('href');
			if (href) {
				const fullUrl = new URL(href, `${this.baseUrl}/culture/howartworks/publicart/collection/`).href;
				links.push(fullUrl);
			}
		});

		// Remove duplicates
		return Array.from(new Set(links));
	}

	/**
	 * Scrape individual artwork page
	 */
	private async scrapeArtwork(url: string): Promise<void> {
		this.stats.total++;

		try {
			logger.debug(`Scraping artwork: ${url}`);

			const html = await this.httpClient.fetch(url);
			const $ = cheerio.load(html);

			// Extract artwork ID from URL
			const artworkId = this.extractArtworkId(url);
			if (!artworkId) {
				logger.error('Failed to extract artwork ID', { url });
				this.stats.failed++;
				return;
			}

			// Check for duplicates
			if (this.seenIds.has(artworkId)) {
				logger.debug(`Skipping duplicate artwork: ${artworkId}`);
				this.stats.duplicates++;
				return;
			}

			// Extract title from h1
			const title = $('h1').first().text().trim();
			if (!title) {
				logger.error('Missing artwork title', { url });
				this.stats.failed++;
				return;
			}

			// Extract coordinates from location link
			const locationLink = $('a[href*="LocationsMap.aspx"]').first();
			const coords = this.extractCoordinates(locationLink.attr('href'));

			if (!coords) {
				logger.error('Missing coordinates', { url, title });
				this.stats.failed++;
				return;
			}

			// Extract artists
			const artistData = this.extractArtists($);

			// Extract metadata fields
			const area = this.extractMetadataField($, 'Area:');
			const locationDetail = this.extractMetadataField($, 'Location:');
			const materials = this.extractMetadataField($, 'Materials:');
			const program = this.extractMetadataField($, 'Program:');
			const ownership = this.extractMetadataField($, 'Ownership:');
			const sponsoredBy = this.extractMetadataField($, 'Sponsored By:');

			// Get address from location link
			const locationAddress = locationLink.text().trim();
			
			// Combine location details if we have both
			const location = [locationAddress, locationDetail].filter((x) => x).join(' - ');

			// Extract year from title (e.g., "(Coyote) koyo-te, through the bog (2020)")
			const yearMatch = title.match(/\((\d{4})\)\s*$/);
			const year = yearMatch ? yearMatch[1] : undefined;

			// Remove year from title if present
			const cleanTitle = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();

			// Extract description
			const description = this.extractDescription($);

			// Extract photos (pass URL for correct relative path resolution)
			const photos = this.extractPhotos($, url);

			// Create artwork feature in OSM-compatible format
			const artworkSlug = cleanTitle.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '');
			
			const artwork: ArtworkFeature = {
				type: 'Feature',
				id: `osm-${artworkSlug}-${coords[1].toFixed(6)}--${coords[0].toFixed(6)}`,
				geometry: {
					type: 'Point',
					coordinates: coords,
				},
				properties: {
					// Core properties (required)
					title: cleanTitle,
					
					// OSM-required properties
					tourism: 'artwork',
					name: cleanTitle,
					artist_name: artistData.artistNames.join('; '),
					artwork_type: 'sculpture', // Default type, could be enhanced
					
					// Additional metadata
					...(description && { description }),
					...(artistData.artistNames.length > 0 && { artists: artistData.artistNames }),
					...(year && { start_date: year }),
					...(materials && { material: materials }),
					...(location && { subject: location }), // OSM uses 'subject' for location context
					
					// Source tracking
					source: this.baseUrl,
					source_url: url,
					
					// Tags object for additional metadata (OSM standard)
					tags: {
						source: this.baseUrl,
						source_url: url,
						title: cleanTitle,
						...(location && { location }),
						...(year && { start_date: year }),
						...(materials && { material: materials }),
						...(ownership && { owner: ownership }),
						...(program && { category: program }),
						...(area && { area }),
						...(sponsoredBy && { sponsored_by: sponsoredBy }),
					},
					
					// Photo URLs
					...(photos.length > 0 && { photos }),
				},
			};

			// Validate and add artwork
			if (this.validator.validateArtwork(artwork)) {
				this.artworks.push(artwork);
				this.stats.success++;
				logger.debug(`Successfully scraped artwork: ${cleanTitle}`);

				// Track artists
				for (const artistInfo of artistData.artists) {
					this.trackArtist(artistInfo.name, artistInfo.id, artistInfo.url);
				}
			} else {
				this.stats.failed++;
				logger.error('Artwork validation failed', { url, title: cleanTitle });
			}

			this.seenIds.add(artworkId);
		} catch (error) {
			this.stats.failed++;
			logger.error('Failed to scrape artwork', {
				url,
				error: (error as Error).message,
			});
		}
	}

	/**
	 * Extract artwork ID from URL
	 */
	private extractArtworkId(url: string): string | null {
		const match = url.match(/ID=(\d+)/);
		return match ? `richmond-ca-${match[1]}` : null;
	}

	/**
	 * Extract coordinates from LocationsMap.aspx URL
	 * Format: LocationsMap.aspx?x=-122.966809&y=49.177886
	 * or: LocationsMap.aspx?X=-122.966809&Y=49.177886
	 */
	private extractCoordinates(href: string | undefined): [number, number] | null {
		if (!href) return null;

		const urlParams = new URLSearchParams(href.split('?')[1]);
		const lon = parseFloat(urlParams.get('x') || urlParams.get('X') || '');
		const lat = parseFloat(urlParams.get('y') || urlParams.get('Y') || '');

		if (isNaN(lon) || isNaN(lat)) {
			return null;
		}

		return [lon, lat];
	}

	/**
	 * Extract artists with their IDs and URLs
	 */
	private extractArtists($: cheerio.CheerioAPI): {
		artists: Array<{ id: string; name: string; url: string }>;
		artistNames: string[];
	} {
		const artists: Array<{ id: string; name: string; url: string }> = [];
		const artistNames: string[] = [];

		// Find all artist links
		$('a[href*="Artist.aspx?ID="]').each((_, element) => {
			const $el = $(element);
			const href = $el.attr('href');
			const name = $el.text().trim();

			if (href && name) {
				const idMatch = href.match(/ID=(\d+)/);
				if (idMatch) {
					const id = `richmond-ca-artist-${idMatch[1]}`;
					const url = new URL(href, `${this.baseUrl}/culture/howartworks/publicart/collection/`).href;
					artists.push({ id, name, url });
					artistNames.push(name);
				}
			}
		});

		return { artists, artistNames };
	}

	/**
	 * Extract metadata field value
	 * Fields are in format: <strong>Field Name:</strong> Value
	 * with possible other <strong> fields following on same line
	 */
	private extractMetadataField($: cheerio.CheerioAPI, fieldName: string): string {
		let value = '';

		$('p').each((_, element): boolean | void => {
			const $p = $(element);
			const $strong = $p.find('strong').filter((_, el) => $(el).text().trim() === fieldName);
			
			if ($strong.length > 0) {
				// Get the parent paragraph's HTML
				const html = $p.html() || '';
				
				// Split by <strong> tags to get segments
				const segments = html.split(/<\/?strong>/gi);
				
				// Find the index where our field name appears
				let fieldIndex = -1;
				for (let i = 0; i < segments.length; i++) {
					const segment = segments[i];
					if (segment && segment.trim() === fieldName) {
						fieldIndex = i;
						break;
					}
				}
				
				// Get the value after our field name
				if (fieldIndex >= 0 && fieldIndex + 1 < segments.length) {
					const nextSegment = segments[fieldIndex + 1];
					if (nextSegment) {
						value = nextSegment;
						
						// Stop at the next strong tag (next field)
						const nextFieldMarker = value.indexOf('<strong>');
						if (nextFieldMarker !== -1) {
							value = value.substring(0, nextFieldMarker);
						}
						
						// Clean up HTML tags and whitespace
						value = value.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
					}
				}
				
				return false; // Break the loop
			}
		});

		return value;
	}

	/**
	 * Extract ASP.NET form data needed for pagination
	 */
	private extractNextPagePostData(html: string, pageNumber: number): Record<string, string> | null {
		const $ = cheerio.load(html);

		// Extract ONLY the essential ASP.NET and search form fields
		const formData: Record<string, string> = {};
		
		// Essential ASP.NET ViewState fields
		const essentialFields = [
			'__EVENTTARGET',
			'__EVENTARGUMENT', 
			'__VIEWSTATE',
			'__VIEWSTATEGENERATOR',
			'__EVENTVALIDATION',
			// Search form fields (must be preserved to maintain search context)
			'ctl00$main$tbKeyword',
			'ctl00$main$tbArtist',
			'ctl00$main$tbArtwork',
			'ctl00$main$ddlArea',
			'ctl00$main$ddlYearFrom',
			'ctl00$main$ddlYearTo'
		];
		
		essentialFields.forEach(fieldName => {
			const $field = $(`[name="${fieldName}"]`);
			if ($field.length > 0) {
				formData[fieldName] = $field.attr('value') || $field.val() as string || '';
			}
		});

		// Look for pagination link for the next page
		const allPageLinks = $('a[href*="rptPager"][href*="btnPage"]');
		let nextPageControl: string | null = null;
		
		allPageLinks.each((_, el): boolean | void => {
			const href = $(el).attr('href') || '';
			const text = $(el).text().trim();
			
			if (text === String(pageNumber)) {
				const match = href.match(/__doPostBack\('([^']+)'/);
				if (match && match[1]) {
					nextPageControl = match[1];
					return false; // Break
				}
			}
		});

		if (!nextPageControl) {
			logger.debug(`No pagination link found for page ${pageNumber}`);
			return null;
		}

		if (!formData.__VIEWSTATE || !formData.__EVENTVALIDATION) {
			logger.warn('Missing ASP.NET viewstate fields');
			return null;
		}

		logger.debug(`Found next page control: ${nextPageControl}`);

		// Set event target for pagination
		formData.__EVENTTARGET = nextPageControl;
		formData.__EVENTARGUMENT = '';

		return formData;
	}

	/**
	 * Fetch next page using ASP.NET postback
	 */
	private async fetchNextPage(formData: Record<string, string>): Promise<string> {
		const response = await fetch(this.searchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
				'Referer': this.searchUrl,
				'Origin': this.baseUrl,
			},
			body: new URLSearchParams(formData).toString(),
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
		}

		await this.rateLimiter.wait();
		return await response.text();
	}

	/**
	 * Extract description from "Description of Work" and "Artist Statement" sections
	 */
	private extractDescription($: cheerio.CheerioAPI): string {
		const sections: string[] = [];

		// Find "Description of Work" section
		$('h2').each((_, element) => {
			const $h2 = $(element);
			const heading = $h2.text().trim();

			if (heading === 'Description of Work' || heading === 'Artist Statement') {
				// Get all <p> tags following this h2 until the next h2
				let $current = $h2.next();
				const paragraphs: string[] = [];

				while ($current.length && $current.prop('tagName') !== 'H2') {
					if ($current.prop('tagName') === 'P') {
						const text = $current.text().trim();
						if (text) {
							paragraphs.push(text);
						}
					}
					$current = $current.next();
				}

				if (paragraphs.length > 0) {
					sections.push(`**${heading}**\n\n${paragraphs.join('\n\n')}`);
				}
			}
		});

		return sections.join('\n\n');
	}

	/**
	 * Extract photos from carousel
	 */
	private extractPhotos($: cheerio.CheerioAPI, pageUrl: string): string[] {
		const photos: string[] = [];

		// Photos are in a carousel region with relative paths
		// Page URL: /culture/howartworks/publicart/collection/PublicArt.aspx?ID=XXX
		// Image src: images/Filename.jpg (relative)
		// Need to resolve relative to page URL, not base URL
		$('region[role="carousel"] img, [class*="carousel"] img, figure img').each((_, element) => {
			const src = $(element).attr('src');
			if (src && !src.includes('data:image') && !src.includes('logo') && !src.includes('banner')) {
				// Convert relative URLs to absolute using the page URL as base
				const fullUrl = new URL(src, pageUrl).href;
				photos.push(fullUrl);
			}
		});

		return Array.from(new Set(photos));
	}

	/**
	 * Scrape artist details from artist page
	 */
	private async scrapeArtistDetails(artistId: string, artistName: string, artistUrl: string): Promise<void> {
		try {
			logger.debug(`Scraping artist details: ${artistName}`);

			const html = await this.httpClient.fetch(artistUrl);
			const $ = cheerio.load(html);

			// Extract location (e.g., "Vancouver, Canada")
			const location = $('.artist-location, [class*="location"]').first().text().trim();

			// Extract biography
			let biography = '';
			$('h2').each((_, element): boolean | void => {
				const $h2 = $(element);
				if ($h2.text().trim() === 'Biography') {
					const $bio = $h2.next('p');
					biography = $bio.text().trim();
					return false; // Break loop
				}
			});

			// Update artist record
			const artist = this.artists.get(artistId);
			if (artist) {
				if (location) {
					artist.properties.location = location;
				}
				if (biography) {
					artist.properties.biography = biography;
					artist.description = biography; // v3 format
				}
			}

			await this.rateLimiter.wait();
		} catch (error) {
			logger.error('Failed to scrape artist details', {
				artistId,
				artistName,
				error: (error as Error).message,
			});
		}
	}
}
