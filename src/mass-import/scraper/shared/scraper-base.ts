/**
 * Base scraper class with common functionality
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
	ArtworkFeature,
	ArtworkCollection,
	ArtistRecord,
	ArtistCollection,
	ScraperStats,
	ScraperOptions,
} from './types';
import { logger } from './logger';
import { Validator } from './validator';
import { RateLimiter } from './rate-limiter';
import { HttpClient } from './http-client';

export abstract class ScraperBase {
	protected artworks: ArtworkFeature[] = [];
	protected artists: Map<string, ArtistRecord> = new Map();
	protected seenIds: Set<string> = new Set();
	protected stats: ScraperStats = {
		total: 0,
		success: 0,
		failed: 0,
		skipped: 0,
		duplicates: 0,
	};

	protected validator: Validator;
	protected rateLimiter: RateLimiter;
	protected httpClient: HttpClient;

	protected maxPages?: number;
	protected limit?: number;

	constructor(
		protected scraperName: string,
		protected scraperVersion: string
	) {
		this.validator = new Validator();
		this.rateLimiter = new RateLimiter(1500, 500); // 1.5s + 0-500ms jitter
		this.httpClient = new HttpClient();
	}

	setMaxPages(maxPages: number): void {
		this.maxPages = maxPages;
	}

	setLimit(limit: number): void {
		this.limit = limit;
	}

	/**
	 * Abstract method to be implemented by specific scrapers
	 */
	abstract scrape(): Promise<void>;

	/**
	 * Run the scraper and save output files
	 */
	async run(options: ScraperOptions): Promise<void> {
		const startTime = Date.now();
		logger.info(`Starting scraper: ${this.scraperName} v${this.scraperVersion}`);

		if (options.verbose) {
			logger.setLevel('debug');
		}

		try {
			// Run the scraper
			await this.scrape();

			// Save output files
			await this.saveOutput(options.outputDir);

			const duration = ((Date.now() - startTime) / 1000).toFixed(2);
			logger.info(`Scraper completed in ${duration}s`, {
				total: this.stats.total,
				success: this.stats.success,
				failed: this.stats.failed,
				skipped: this.stats.skipped,
				duplicates: this.stats.duplicates,
			});
		} catch (error) {
			logger.error('Scraper failed', { error: (error as Error).message });
			throw error;
		}
	}

	/**
	 * Save output files
	 */
	protected async saveOutput(outputDir: string): Promise<void> {
		// Ensure output directory exists
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Save artworks GeoJSON
		const artworkCollection: ArtworkCollection = {
			type: 'FeatureCollection',
			metadata: {
				scraper: this.scraperName,
				version: this.scraperVersion,
				source: this.getSourceUrl(),
				scrapedAt: new Date().toISOString(),
				totalItems: this.artworks.length,
			},
			features: this.artworks,
		};

		const artworkPath = path.join(outputDir, `${this.scraperName}-artworks.geojson`);
		fs.writeFileSync(artworkPath, JSON.stringify(artworkCollection, null, 2));
		logger.info(`Saved ${this.artworks.length} artworks to ${artworkPath}`);

		// Save artists JSON
		const artistCollection: ArtistCollection = {
			metadata: {
				scraper: this.scraperName,
				version: this.scraperVersion,
				source: this.getSourceUrl(),
				scrapedAt: new Date().toISOString(),
				totalItems: this.artists.size,
			},
			artists: Array.from(this.artists.values()),
		};

		const artistPath = path.join(outputDir, `${this.scraperName}-artists.json`);
		fs.writeFileSync(artistPath, JSON.stringify(artistCollection, null, 2));
		logger.info(`Saved ${this.artists.size} artists to ${artistPath}`);

		// Also write a flat array of artists (legacy importer/CLI expects a top-level array)
		const artistFlatPath = path.join(outputDir, `${this.scraperName}-artists-flat.json`);
		fs.writeFileSync(artistFlatPath, JSON.stringify(Array.from(this.artists.values()), null, 2));
		logger.info(`Saved flat artists array to ${artistFlatPath}`);
	}

	/**
	 * Track artist for later processing
	 */
	protected trackArtist(artistName: string, artistId: string, artistUrl: string): void {
		if (!this.artists.has(artistId)) {
			logger.debug(`Tracking new artist: ${artistName}`, { artistId });
			this.artists.set(artistId, {
				type: 'Artist',
				id: artistId,
				name: artistName,
				properties: {
					source: this.getSourceUrl(),
					source_url: artistUrl,
				},
			});
		}
	}

	/**
	 * Check if ID has been seen (for duplicate detection)
	 */
	protected isDuplicate(id: string): boolean {
		if (this.seenIds.has(id)) {
			return true;
		}
		this.seenIds.add(id);
		return false;
	}

	/**
	 * Get the base source URL
	 */
	protected abstract getSourceUrl(): string;

	/**
	 * Convert HTML to Markdown (basic implementation)
	 */
	protected convertToMarkdown(html: string): string {
		if (!html) return '';

		// Remove script tags
		let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

		// Convert common HTML tags to Markdown
		text = text.replace(/<br\s*\/?>/gi, '\n');
		text = text.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
		text = text.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
		text = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
		text = text.replace(/<em>(.*?)<\/em>/gi, '*$1*');
		text = text.replace(/<i>(.*?)<\/i>/gi, '*$1*');

		// Remove remaining HTML tags
		text = text.replace(/<[^>]+>/g, '');

		// Decode HTML entities
		text = text.replace(/&nbsp;/g, ' ');
		text = text.replace(/&amp;/g, '&');
		text = text.replace(/&lt;/g, '<');
		text = text.replace(/&gt;/g, '>');
		text = text.replace(/&quot;/g, '"');
		text = text.replace(/&#39;/g, "'");

		// Clean up whitespace
		text = text.replace(/\n{3,}/g, '\n\n');
		text = text.trim();

		return text;
	}
}
