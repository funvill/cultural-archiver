/**
 * OpenStreetMap Export Service
 * Provides functionality to export artwork data in OpenStreetMap-compatible format
 */

import type { ArtworkRecord } from '../types';
import type { StructuredTagsData, OSMExportResponse } from '../../shared/types';
import { generateOSMTags } from '../../shared/tag-schema';
import { safeJsonParse } from './errors';

/**
 * Convert artwork record to OSM-compatible format
 */
export function artworkToOSMExport(artwork: ArtworkRecord): {
  id: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
  created_at: string;
  updated_at: string;
} {
  // Parse structured tags
  const parsedTags = safeJsonParse<StructuredTagsData>(artwork.tags || '{}', {
    tags: {},
    version: '1.0.0',
    lastModified: new Date().toISOString(),
  });
  const structuredTags = parsedTags.tags || {};

  // Generate OSM-compatible tags using the schema mapping
  const osmTags = generateOSMTags(structuredTags);

  // Always ensure tourism=artwork is present (required for OSM)
  osmTags.tourism = 'artwork';

  // Add location data - updated to match the right format
  return {
    id: artwork.id,
    lat: artwork.lat,
    lon: artwork.lon,
    tags: osmTags,
    created_at: artwork.created_at,
    updated_at: artwork.created_at, // Use created_at since updated_at doesn't exist
  };
}

/**
 * Export multiple artworks to OSM format
 */
export function exportArtworksToOSM(artworks: ArtworkRecord[]): Array<{
  id: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
  created_at: string;
  updated_at: string;
}> {
  return artworks
    .filter(artwork => {
      // Only export approved artworks with valid coordinates
      return (
        artwork.status === 'approved' &&
        artwork.lat !== null &&
        artwork.lon !== null &&
        !isNaN(artwork.lat) &&
        !isNaN(artwork.lon)
      );
    })
    .map(artworkToOSMExport);
}

/**
 * Validate artwork data for OSM export compatibility
 */
export function validateOSMExportData(artwork: ArtworkRecord): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (artwork.status !== 'approved') {
    errors.push('Artwork must be approved for export');
  }

  if (artwork.lat === null || artwork.lon === null) {
    errors.push('Artwork must have valid coordinates');
  }

  if (isNaN(artwork.lat) || isNaN(artwork.lon)) {
    errors.push('Coordinates must be valid numbers');
  }

  // Coordinate range validation
  if (artwork.lat < -90 || artwork.lat > 90) {
    errors.push('Latitude must be between -90 and 90 degrees');
  }

  if (artwork.lon < -180 || artwork.lon > 180) {
    errors.push('Longitude must be between -180 and 180 degrees');
  }

  // Validate structured tags if present
  const parsedTags = safeJsonParse<StructuredTagsData>(artwork.tags || '{}', {
    tags: {},
    version: '1.0.0',
    lastModified: new Date().toISOString(),
  });
  if (parsedTags.tags && Object.keys(parsedTags.tags).length > 0) {
    // For now, just skip the structured validation to avoid import issues
    // TODO: Add proper structured tag validation
  }

  // Check for essential OSM fields
  const osmData = artworkToOSMExport(artwork);
  if (!osmData.tags.name && !osmData.tags['ca:name']) {
    warnings.push('Artwork has no name - consider adding one for better OSM integration');
  }

  if (!osmData.tags.artist_name && !osmData.tags['ca:artist_name']) {
    warnings.push('Artwork has no artist information');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate OSM XML format for a single artwork (for advanced users)
 */
export function generateOSMXML(artwork: ArtworkRecord, nodeId: number = -1): string {
  const validation = validateOSMExportData(artwork);
  if (!validation.valid) {
    throw new Error(`Cannot export invalid artwork: ${validation.errors.join(', ')}`);
  }

  const osmData = artworkToOSMExport(artwork);

  let xml = `  <node id="${nodeId}" version="1" lat="${osmData.lat}" lon="${osmData.lon}">\n`;

  // Add tags
  Object.entries(osmData.tags).forEach(([key, value]) => {
    // Escape XML special characters
    const escapedKey = key
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const escapedValue = String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    xml += `    <tag k="${escapedKey}" v="${escapedValue}" />\n`;
  });

  xml += `  </node>\n`;

  return xml;
}

/**
 * Generate complete OSM XML file for multiple artworks
 */
export function generateOSMXMLFile(artworks: ArtworkRecord[]): string {
  const validArtworks = artworks.filter(artwork => {
    const validation = validateOSMExportData(artwork);
    return validation.valid;
  });

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<osm version="0.6" generator="Cultural Archiver Export">\n`;

  validArtworks.forEach((artwork, index) => {
    xml += generateOSMXML(artwork, -(index + 1)); // Use negative IDs for new nodes
  });

  xml += `</osm>\n`;

  return xml;
}

/**
 * Format export response with metadata
 */
export function createExportResponse(
  artworks: ArtworkRecord[],
  _request: { artwork_ids?: string[]; format?: string; bounds?: string; limit?: number }
): OSMExportResponse {
  const exportData = exportArtworksToOSM(artworks);

  return {
    success: true,
    data: {
      artworks: exportData.map(artwork => ({
        id: artwork.id,
        lat: artwork.lat,
        lon: artwork.lon,
        osm_tags: artwork.tags,
      })),
      metadata: {
        total_artworks: artworks.length,
        export_timestamp: new Date().toISOString(),
        schema_version: '1.0.0',
      },
    },
  };
}
