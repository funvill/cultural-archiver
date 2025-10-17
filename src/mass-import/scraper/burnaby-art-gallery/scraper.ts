/**
 * Burnaby Art Gallery Scraper
 * Scrapes artwork and artist data from Burnaby Art Gallery Public Art Registry
 */

import * as cheerio from 'cheerio';
import type { ArtworkFeature } from '../shared/types';
import { ScraperBase } from '../shared/scraper-base';
import { logger } from '../shared/logger';

export class BurnabyArtGalleryScraper extends ScraperBase {
	private readonly baseUrl = 'https://collections.burnabyartgallery.ca';
	private readonly searchUrl = `${this.baseUrl}/list`;

	constructor() {
		super('burnaby-art-gallery', '1.0.0');
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
	 * Main scraper logic
	 */
	async scrape(): Promise<void> {
		let page = 1;
		let hasMorePages = true;

		while (hasMorePages && (!this.maxPages || page <= this.maxPages)) {
			logger.info(`Fetching page ${page}`);

			const url = this.buildSearchUrl(page);
			const html = await this.httpClient.fetch(url);

			const artworkLinks = this.extractArtworkLinks(html);
			logger.info(`Found ${artworkLinks.length} artworks on page ${page}`);

			if (artworkLinks.length === 0) {
				hasMorePages = false;
				break;
			}

			for (const link of artworkLinks) {
				// Check if we've reached the limit
				if (this.limit && this.stats.success >= this.limit) {
					logger.info(`Reached limit of ${this.limit} artworks`);
					hasMorePages = false;
					break;
				}

				await this.scrapeArtwork(link);
				await this.rateLimiter.wait();
			}

			page++;
		}

		logger.info(`Scraping complete`, {
			pages: page - 1,
			artworks: this.artworks.length,
			artists: this.artists.size,
		});
	}

	/**
	 * Build search URL with pagination
	 */
	private buildSearchUrl(page: number): string {
		const params = new URLSearchParams({
			q: '',
			p: page.toString(),
			ps: '200',
			sort: 'title_sort asc',
			src_facet: 'Public Art Registry',
		});
		return `${this.searchUrl}?${params.toString()}`;
	}

	/**
	 * Extract artwork links from list page
	 */
	private extractArtworkLinks(html: string): string[] {
		const $ = cheerio.load(html);
		const links: string[] = [];

		// Find all links to artwork pages
		$('a[href*="/link/publicart"]').each((_index: number, element: cheerio.Element) => {
			const href = $(element).attr('href');
			if (href) {
				// Skip mailto:, javascript:, and other non-HTTP protocols
				if (href.includes(':') && !href.startsWith('http') && !href.startsWith('/')) {
					return; // Skip this link
				}

				// Build full URL
				let fullUrl = href;
				if (!href.startsWith('http')) {
					// Handle both absolute paths (/link/publicart123) and relative paths
					fullUrl = href.startsWith('/') ? `${this.baseUrl}${href}` : `${this.baseUrl}/${href}`;
				}

				// Only add valid HTTP(S) URLs
				if (fullUrl.startsWith('http')) {
					links.push(fullUrl);
				}
			}
		});

		return [...new Set(links)]; // Remove duplicates
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

			// Extract ID from URL (e.g., publicart46)
			const match = url.match(/publicart(\d+)/);
			if (!match) {
				logger.error('Could not extract ID from URL', { url });
				this.stats.failed++;
				return;
			}

			const id = `burnabyartgallery/publicart${match[1]}`;

			// Check for duplicates
			if (this.isDuplicate(id)) {
				logger.debug(`Duplicate artwork: ${id}`);
				this.stats.duplicates++;
				this.stats.skipped++;
				return;
			}

			// Extract basic fields
			const title = this.extractTitle($);
			if (!title) {
				logger.warn('No title found', { id, url });
				this.stats.failed++;
				return;
			}

			// Extract coordinates
			const coordinates = this.extractCoordinates($);
			if (!coordinates) {
				logger.warn('No coordinates found', { id, title, url });
				this.stats.failed++;
				return;
			}

			// Extract other fields
			const rawArtist = this.extractArtist($);
			const artist = this.normalizeArtistName(rawArtist);
			const type = this.extractType($);
			const location = this.extractLocation($);
			const date = this.extractDate($);
			const description = this.extractDescription($);
			const photos = this.extractPhotos($);
			const medium = this.extractMedium($);
			const technique = this.extractTechnique($);
			const dimensions = this.extractDimensions($);
			const keywords = this.extractKeywords($);
			const owner = this.extractOwner($);
			const category = this.extractCategory($);
			const accessionNumber = this.extractAccessionNumber($);

			// Create artwork feature
			const artwork: ArtworkFeature = {
				type: 'Feature',
				id,
				geometry: {
					type: 'Point',
					coordinates,
				},
							properties: {
					source: this.baseUrl,
					source_url: url,
					title,
					description: this.convertToMarkdown(description),
					artwork_type: type?.toLowerCase(),
								// Emit artists as an array (new v3-friendly shape). Keep single artist as one-element array.
								...(artist ? { artists: [artist] } : {}),
					location,
					start_date: date,
					photos,
					...(medium.length > 0 && { medium: medium.join(', ') }),
					...(technique.length > 0 && { technique: technique.join(', ') }),
					...(dimensions && { dimensions }),
					...(keywords.length > 0 && { keywords }),
					...(owner && { owner }),
					...(category && { category }),
					...(accessionNumber && { accession_number: accessionNumber }),
				},
			};

			// Validate
			if (this.validator.validateArtwork(artwork)) {
				this.artworks.push(artwork);
				this.stats.success++;
				logger.debug(`Successfully scraped artwork`, { id, title });

				// Track artist (use normalized name)
				if (artist) {
					const artistId = this.generateArtistId(artist);
					const artistUrl = this.extractArtistBiographyLink($);
					this.trackArtist(artist, artistId, artistUrl);
				}
			} else {
				logger.warn('Artwork validation failed', { id, title });
				this.stats.failed++;
			}
		} catch (error) {
			logger.error('Failed to scrape artwork', { url, error: (error as Error).message });
			this.stats.failed++;
		}
	}

	/**
	 * Extract title from page
	 */
	private extractTitle($: cheerio.CheerioAPI): string {
		// Burnaby Art Gallery uses h3 for artwork titles
		let title =
			$('h3').first().text().trim() ||
			$('h2').first().text().trim() ||
			$('h1').first().text().trim() ||
			$('.title').first().text().trim() ||
			$('meta[property="og:title"]').attr('content')?.trim() ||
			'';

		// Clean up title
		title = title.replace(/\s+/g, ' ').trim();
		return title;
	}

	/**
	 * Extract coordinates from page
	 */
	private extractCoordinates($: cheerio.CheerioAPI): [number, number] | null {
		// Method 1: Look for embedded map data in scripts
		const scripts = $('script');
		for (let i = 0; i < scripts.length; i++) {
			const scriptContent = $(scripts[i]).html() || '';

			// Look for coordinate patterns
			const coordMatch =
				scriptContent.match(/[-]?\d+\.\d+,\s*[-]?\d+\.\d+/) ||
				scriptContent.match(/lat[^0-9-]+([0-9.-]+)[^0-9-]+lon[^0-9-]+([0-9.-]+)/i) ||
				scriptContent.match(/lon[^0-9-]+([0-9.-]+)[^0-9-]+lat[^0-9-]+([0-9.-]+)/i);

			if (coordMatch) {
				const coords = coordMatch[0].split(',').map((s: string) => parseFloat(s.trim()));
				if (coords.length === 2) {
					const [first, second] = coords;
					// Determine if it's lat,lon or lon,lat based on ranges
					if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
						// first is lat, second is lon
						if (this.validator.validateCoordinates(first, second)) {
							return [second, first]; // Return as [lon, lat]
						}
					} else if (Math.abs(first) <= 180 && Math.abs(second) <= 90) {
						// first is lon, second is lat
						if (this.validator.validateCoordinates(second, first)) {
							return [first, second]; // Return as [lon, lat]
						}
					}
				}
			}
		}

		// Method 2: Look for meta tags
		const lat = parseFloat($('meta[property="geo:latitude"]').attr('content') || '');
		const lon = parseFloat($('meta[property="geo:longitude"]').attr('content') || '');

		if (this.validator.validateCoordinates(lat, lon)) {
			return [lon, lat];
		}

		// Method 3: Look for coordinates in page text
		const bodyText = $('body').text();
		const textMatch = bodyText.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
		if (textMatch) {
			const num1 = parseFloat(textMatch[1]);
			const num2 = parseFloat(textMatch[2]);

			if (Math.abs(num1) <= 90 && Math.abs(num2) <= 180) {
				if (this.validator.validateCoordinates(num1, num2)) {
					return [num2, num1];
				}
			}
		}

		return null;
	}

	/**
	 * Extract artist name from page
	 */
	private extractArtist($: cheerio.CheerioAPI): string {
		// Look for "Artist" in dt (term) tags, then get the next dd (definition)
		let artist = '';
		
		$('dt').each((_index, element) => {
			const text = $(element).text().trim();
			if (text === 'Artist') {
				// Get the next dd sibling
				const dd = $(element).next('dd');
				artist = dd.text().trim();
				return false; // Break the loop
			}
		});

		return artist;
	}

	/**
	 * Normalize artist display name.
	 * If the name is in "Last, First" form, swap to "First Last" and remove commas.
	 * Otherwise return trimmed name.
	 */
	private normalizeArtistName(name: string): string {
		if (!name) return '';
		const trimmed = name.trim();
		// Handle common case: "Last, First" -> "First Last"
		if (trimmed.includes(',')) {
			// Split on comma and remove empty tokens
			const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
			// If there are at least two parts, assume first is last name and the next is first (may include middle names)
			if (parts.length >= 2) {
				const last = parts[0];
				const rest = parts.slice(1).join(' ');
				return `${rest} ${last}`.replace(/\s+/g, ' ').trim();
			}
			// Fallback: remove commas
			return trimmed.replace(/,/g, '').replace(/\s+/g, ' ').trim();
		}
		return trimmed;
	}

	/**
	 * Extract artwork type from page
	 */
	private extractType($: cheerio.CheerioAPI): string {
		// Look for "Type" in dt tags
		let type = '';
		
		$('dt').each((_index, element) => {
			const text = $(element).text().trim();
			if (text === 'Type') {
				const dd = $(element).next('dd');
				type = dd.text().trim();
				return false; // Break the loop
			}
		});

		return type;
	}

	/**
	 * Extract location from page
	 */
	private extractLocation($: cheerio.CheerioAPI): string {
		// Look for "Location" in dt tags
		let location = '';
		
		$('dt').each((_index, element) => {
			const text = $(element).text().trim();
			if (text === 'Location') {
				const dd = $(element).next('dd');
				location = dd.text().trim();
				return false; // Break the loop
			}
		});

		return location;
	}

	/**
	 * Extract date from page
	 */
	private extractDate($: cheerio.CheerioAPI): string {
		// Look for "Date" in dt tags
		let date = '';
		
		$('dt').each((_index, element) => {
			const text = $(element).text().trim();
			if (text === 'Date') {
				const dd = $(element).next('dd');
				date = dd.text().trim();
				return false; // Break the loop
			}
		});

		return date;
	}

	/**
	 * Extract description from page
	 */
	private extractDescription($: cheerio.CheerioAPI): string {
		// Look for "About" in dt tags
		let description = '';
		
		$('dt').each((_index, element) => {
			const text = $(element).text().trim();
			if (text === 'About') {
				const dd = $(element).next('dd');
				description = dd.text().trim();
				return false; // Break the loop
			}
		});

		// Convert to markdown if we have content
		if (description) {
			return this.convertToMarkdown(description);
		}

		return description;
	}

	/**
	 * Extract medium (materials) from page
	 */
	private extractMedium($: cheerio.CheerioAPI): string[] {
		const media: string[] = [];

		$('dt').each((_index: number, element: cheerio.Element) => {
			const text = $(element).text().trim();
			if (text === 'Medium') {
				let sibling = $(element).next();
				while (sibling.length && sibling.is('dd')) {
					const value = sibling.text().trim();
					if (value) {
						media.push(value);
					}
					sibling = sibling.next();
				}
			}
		});

		return media;
	}

	/**
	 * Extract technique from page
	 */
	private extractTechnique($: cheerio.CheerioAPI): string[] {
		const techniques: string[] = [];

		$('dt').each((_index: number, element: cheerio.Element) => {
			const text = $(element).text().trim();
			if (text === 'Technique') {
				let sibling = $(element).next();
				while (sibling.length && sibling.is('dd')) {
					const value = sibling.text().trim();
					if (value) {
						techniques.push(value);
					}
					sibling = sibling.next();
				}
			}
		});

		return techniques;
	}

	/**
	 * Extract dimensions from page
	 */
	private extractDimensions($: cheerio.CheerioAPI): string | undefined {
		let dimensions: string | undefined;

		$('dt').each((_index: number, element: cheerio.Element) => {
			const text = $(element).text().trim();
			if (text === 'Dimensions') {
				const dd = $(element).next('dd');
				if (dd.length) {
					dimensions = dd.text().trim();
				}
			}
		});

		return dimensions;
	}

	/**
	 * Extract keywords (topics/tags) from page
	 */
	private extractKeywords($: cheerio.CheerioAPI): string[] {
		const keywords: string[] = [];

		$('dt').each((_index: number, element: cheerio.Element) => {
			const text = $(element).text().trim();
			if (text === 'Keywords') {
				let sibling = $(element).next();
				while (sibling.length && sibling.is('dd')) {
					const value = sibling.text().trim();
					if (value) {
						keywords.push(value);
					}
					sibling = sibling.next();
				}
			}
		});

		return keywords;
	}

	/**
	 * Extract owner from page
	 */
	private extractOwner($: cheerio.CheerioAPI): string | undefined {
		let owner: string | undefined;

		$('dt').each((_index: number, element: cheerio.Element) => {
			const text = $(element).text().trim();
			if (text === 'Owner') {
				const dd = $(element).next('dd');
				if (dd.length) {
					owner = dd.text().trim();
				}
			}
		});

		return owner;
	}

	/**
	 * Extract category from page
	 */
	private extractCategory($: cheerio.CheerioAPI): string | undefined {
		let category: string | undefined;

		$('dt').each((_index: number, element: cheerio.Element) => {
			const text = $(element).text().trim();
			if (text === 'Category') {
				const dd = $(element).next('dd');
				if (dd.length) {
					category = dd.text().trim();
				}
			}
		});

		return category;
	}

	/**
	 * Extract accession number from page
	 */
	private extractAccessionNumber($: cheerio.CheerioAPI): string | undefined {
		let accessionNumber: string | undefined;

		$('dt').each((_index: number, element: cheerio.Element) => {
			const text = $(element).text().trim();
			if (text === 'Accession Number') {
				const dd = $(element).next('dd');
				if (dd.length) {
					accessionNumber = dd.text().trim();
				}
			}
		});

		return accessionNumber;
	}

	/**
	 * Extract photo URLs from page
	 */
	private extractPhotos($: cheerio.CheerioAPI): string[] {
		const photos: string[] = [];

		// Find images (excluding small thumbnails, icons, and logos)
		$('img').each((_index: number, element: cheerio.Element) => {
			const src = $(element).attr('src') || $(element).attr('data-src');
			if (src) {
				const lowerSrc = src.toLowerCase();
				// Skip thumbnails, icons, logos (case-insensitive)
				if (lowerSrc.includes('thumb') || 
				    lowerSrc.includes('icon') || 
				    lowerSrc.includes('logo') ||
				    lowerSrc.includes('-logo.')) {
					return;
				}
				
				const fullUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
				if (this.validator.validateUrl(fullUrl)) {
					photos.push(fullUrl);
				}
			}
		});

		// Remove duplicates and limit to 10 photos maximum (v3 endpoint validation requirement)
		return [...new Set(photos)].slice(0, 10);
	}

	/**
	 * Generate artist ID from name
	 */
	private generateArtistId(artistName: string): string {
		const normalized = artistName
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '')
			.substring(0, 20);
		return `burnabyartgallery/${normalized}`;
	}

	/**
	 * Extract artist biography link from artwork page
	 */
	private extractArtistBiographyLink($: cheerio.CheerioAPI): string {
		let artistUrl = '';

		$('dt').each((_index, element) => {
			const text = $(element).text().trim();
			if (text === 'Artist Biography') {
				const dd = $(element).next('dd');
				const link = dd.find('a').first();
				if (link.length) {
					const href = link.attr('href');
					if (href) {
						artistUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
					}
				}
			}
		});

		return artistUrl || this.baseUrl; // Fallback to base URL
	}

	/**
	 * Build artist URL from name (deprecated - use extractArtistBiographyLink instead)
	 */
	private buildArtistUrl(artistName: string): string {
		const encoded = encodeURIComponent(artistName);
		return `${this.baseUrl}/list?objectType_facet=artist&artist_facet=${encoded}`;
	}

	/**
	 * Scrape artist details from their page
	 */
	async scrapeArtistDetails(artistId: string, artistName: string, url: string): Promise<void> {
		try {
			logger.debug('Scraping artist details', { artistId, artistName, url });
			
			const html = await this.httpClient.fetch(url);
			const $ = cheerio.load(html);
			
			const biography = this.extractArtistBiography($);
			const birthDate = this.extractArtistBirthDate($);
			const deathDate = this.extractArtistDeathDate($);
			const websites = this.extractArtistWebsites($);
			
			logger.debug('Extracted artist fields', { biography: biography?.substring(0, 50), birthDate, deathDate, websitesCount: websites.length });
			
			// Find existing artist
			const existingArtist = this.artists.get(artistId);
			logger.debug('Looking for existing artist', { artistId, found: !!existingArtist, totalArtists: this.artists.size });
			
			if (existingArtist) {
				// Update with additional details
				if (biography) {
					existingArtist.description = this.convertToMarkdown(biography);
					existingArtist.properties.biography = this.convertToMarkdown(biography); // Keep in properties for backwards compatibility
				}
				if (birthDate) {
					existingArtist.properties.birth_date = birthDate;
				}
				if (deathDate) {
					existingArtist.properties.death_date = deathDate;
				}
				if (websites.length > 0) {
					existingArtist.properties.websites = websites;
					if (websites[0]) {
						existingArtist.properties.website = websites[0]; // First website as primary
					}
				}
				logger.debug('Updated artist details', { artistId, artistName });
			} else {
				logger.warn('Artist not found in tracked artists', { artistId, artistName });
			}
		} catch (error) {
			logger.error('Failed to scrape artist details', { url, error: (error as Error).message });
		}
	}

	/**
	 * Extract artist biography from page
	 */
	private extractArtistBiography($: cheerio.CheerioAPI): string | undefined {
		let biography: string | undefined;

		$('dt').each((_index, element) => {
			const text = $(element).text().trim();
			if (text === 'Biography') {
				const dd = $(element).next('dd');
				if (dd.length) {
					biography = dd.text().trim();
				}
			}
		});

		return biography;
	}

	/**
	 * Extract artist birth date from page
	 */
	private extractArtistBirthDate($: cheerio.CheerioAPI): string | undefined {
		let birthDate: string | undefined;

		$('dt').each((_index, element) => {
			const text = $(element).text().trim();
			if (text === 'Birth Date') {
				const dd = $(element).next('dd');
				if (dd.length) {
					birthDate = dd.text().trim();
				}
			}
		});

		return birthDate;
	}

	/**
	 * Extract artist death date from page
	 */
	private extractArtistDeathDate($: cheerio.CheerioAPI): string | undefined {
		let deathDate: string | undefined;

		$('dt').each((_index, element) => {
			const text = $(element).text().trim();
			if (text === 'Death Date') {
				const dd = $(element).next('dd');
				if (dd.length) {
					deathDate = dd.text().trim();
				}
			}
		});

		return deathDate;
	}

	/**
	 * Extract artist websites from page
	 */
	private extractArtistWebsites($: cheerio.CheerioAPI): string[] {
		const websites: string[] = [];

		// Look for "Websites" heading and following links
		$('h5').each((_index, element) => {
			const heading = $(element).text().trim();
			if (heading === 'Websites') {
				// Find next links after this heading
				let sibling = $(element).next();
				while (sibling.length && !sibling.is('h5')) {
					if (sibling.is('a')) {
						const href = sibling.attr('href');
						if (href && !href.startsWith('mailto:') && !href.startsWith('#')) {
							// Add http:// if missing
							const url = href.startsWith('http') ? href : `https://${href}`;
							if (this.validator.validateUrl(url)) {
								websites.push(url);
							}
						}
					}
					sibling = sibling.next();
				}
			}
		});

		return websites;
	}
}
