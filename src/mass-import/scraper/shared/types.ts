/**
 * Shared type definitions for mass import scrapers
 */

// GeoJSON Feature for artwork
export interface ArtworkFeature {
	type: 'Feature';
	id: string;
	geometry: {
		type: 'Point';
		coordinates: [number, number]; // [lon, lat]
	};
	properties: ArtworkProperties;
}

export interface ArtworkProperties {
	source: string; // Root domain
	source_url: string; // Full URL to artwork page
	title: string;
	description?: string; // Markdown
	artwork_type?: string;
	artist?: string; // Single artist name or comma-separated
	artists?: string[]; // Multiple artists
	location?: string;
	start_date?: string;
	end_date?: string;
	material?: string;
	medium?: string; // Materials used (e.g., "aluminum, concrete")
	technique?: string; // Techniques used (e.g., "metal fabrication, concrete installation")
	dimensions?: string;
	keywords?: string[]; // Tags/topics
	owner?: string;
	category?: string;
	accession_number?: string;
	photos?: string[]; // Array of photo URLs
	[key: string]: unknown; // Allow additional properties
}

// GeoJSON FeatureCollection
export interface ArtworkCollection {
	type: 'FeatureCollection';
	metadata: ScraperMetadata;
	features: ArtworkFeature[];
}

// Artist record
export interface ArtistRecord {
	type: 'Artist';
	id: string;
	name: string;
	biography?: string; // Biography in Markdown
	properties: ArtistProperties;
}

export interface ArtistProperties {
	source: string;
	source_url: string;
	birth_date?: string;
	death_date?: string;
	website?: string;
	websites?: string[]; // Multiple websites
	biography?: string; // Biography in markdown
	[key: string]: unknown; // Allow additional properties
}

// Artist collection
export interface ArtistCollection {
	metadata: ScraperMetadata;
	artists: ArtistRecord[];
}

// Scraper metadata
export interface ScraperMetadata {
	scraper: string;
	version: string;
	source: string;
	scrapedAt: string; // ISO 8601 timestamp
	totalItems: number;
}

// Scraper statistics
export interface ScraperStats {
	total: number;
	success: number;
	failed: number;
	skipped: number;
	duplicates: number;
}

// Scraper options
export interface ScraperOptions {
	outputDir: string;
	maxPages?: number;
	verbose?: boolean;
}
