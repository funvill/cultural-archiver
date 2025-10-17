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
	
	// Title/Name (OSM uses 'name', legacy uses 'title')
	title?: string;
	name?: string; // OSM-style name
	
	// OSM-specific fields
	'@id'?: string; // OSM ID
	tourism?: string; // OSM tag (e.g., 'artwork')
	historic?: string; // OSM historic tag
	
	description?: string; // Markdown
	artwork_type?: string;
	
	// Artist information (supports both formats)
	artist?: string; // Single artist name or comma-separated
	artist_name?: string; // OSM-style artist name
	artists?: string[]; // Multiple artists array
	
	// Location information
	location?: string;
	'addr:full'?: string; // OSM-style full address
	
	// Date information
	start_date?: string;
	end_date?: string;
	
	// Physical properties
	material?: string;
	medium?: string; // Materials used (e.g., "aluminum, concrete")
	technique?: string; // Techniques used (e.g., "metal fabrication, concrete installation")
	dimensions?: string;
	
	// Additional metadata
	keywords?: string[]; // Tags/topics
	owner?: string;
	category?: string;
	accession_number?: string;
	
	// Media
	photos?: string[]; // Array of photo URLs
	image?: string; // OSM-style single image URL
	
	notes?: string; // Additional notes
	
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
	description?: string; // Description/biography in Markdown (v3 format)
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
