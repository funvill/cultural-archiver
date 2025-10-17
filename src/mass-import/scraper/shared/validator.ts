/**
 * Data validator for scraped artwork and artist data
 */

import type { ArtworkFeature, ArtistRecord } from './types';

export class Validator {
	/**
	 * Validate coordinates are in valid range
	 */
	validateCoordinates(lat: number, lon: number): boolean {
		if (isNaN(lat) || isNaN(lon)) {
			return false;
		}

		// Check ranges
		if (lat < -90 || lat > 90) {
			return false;
		}

		if (lon < -180 || lon > 180) {
			return false;
		}

		// Reject (0, 0) as likely error
		if (lat === 0 && lon === 0) {
			return false;
		}

		return true;
	}

	/**
	 * Validate URL format
	 */
	validateUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Validate artwork feature
	 */
	validateArtwork(artwork: ArtworkFeature): boolean {
		// Check required fields
		if (!artwork.id || !artwork.id.trim()) {
			return false;
		}

		if (!artwork.properties.title || !artwork.properties.title.trim()) {
			return false;
		}

		if (!artwork.properties.source || !this.validateUrl(artwork.properties.source)) {
			return false;
		}

		if (!artwork.properties.source_url || !this.validateUrl(artwork.properties.source_url)) {
			return false;
		}

		// Validate coordinates
		const [lon, lat] = artwork.geometry.coordinates;
		if (!this.validateCoordinates(lat, lon)) {
			return false;
		}

		return true;
	}

	/**
	 * Validate artist record
	 */
	validateArtist(artist: ArtistRecord): boolean {
		// Check required fields
		if (!artist.id || !artist.id.trim()) {
			return false;
		}

		if (!artist.name || !artist.name.trim()) {
			return false;
		}

		if (!artist.properties.source || !this.validateUrl(artist.properties.source)) {
			return false;
		}

		if (!artist.properties.source_url || !this.validateUrl(artist.properties.source_url)) {
			return false;
		}

		return true;
	}
}
