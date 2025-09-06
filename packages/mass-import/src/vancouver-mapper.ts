import type { ImportRecord } from './types.js';

/**
 * Vancouver Open Data Mapper
 * 
 * This module handles the transformation of Vancouver Public Art data
 * from the city's open data format to the Cultural Archiver import format.
 */

// Vancouver Open Data record interface
export interface VancouverRecord {
  registryid: number;
  title_of_work: string;
  artistprojectstatement?: string;
  type: string;
  status: string;
  sitename?: string;
  siteaddress?: string;
  primarymaterial?: string;
  url?: string;
  photourl?: {
    url: string;
    filename: string;
    width: number;
    height: number;
    mimetype: string;
  };
  ownership?: string;
  neighbourhood?: string;
  locationonsite?: string;
  geom: {
    type: 'Feature';
    geometry: {
      coordinates: [number, number]; // [lon, lat]
      type: 'Point';
    };
    properties: Record<string, unknown>;
  };
  geo_local_area?: string;
  descriptionofwork?: string;
  artists?: string[];
  photocredits?: string;
  yearofinstallation?: string;
  geo_point_2d: {
    lon: number;
    lat: number;
  };
}

/**
 * Map Vancouver record to Cultural Archiver import record
 */
export function mapVancouverRecord(vancouverRecord: VancouverRecord): ImportRecord {
  // Extract coordinates
  const { lat, lon } = vancouverRecord.geo_point_2d;
  
  // Build description from multiple fields
  const descriptionParts: string[] = [];
  
  if (vancouverRecord.descriptionofwork) {
    descriptionParts.push(vancouverRecord.descriptionofwork);
  }
  
  if (vancouverRecord.artistprojectstatement) {
    descriptionParts.push(`Artist Statement: ${vancouverRecord.artistprojectstatement}`);
  }
  
  if (vancouverRecord.sitename) {
    descriptionParts.push(`Location: ${vancouverRecord.sitename}`);
  }
  
  if (vancouverRecord.siteaddress) {
    descriptionParts.push(`Address: ${vancouverRecord.siteaddress}`);
  }
  
  if (vancouverRecord.locationonsite) {
    descriptionParts.push(`Site Details: ${vancouverRecord.locationonsite}`);
  }

  // Build creator information
  const createdByParts: string[] = [];
  if (vancouverRecord.artists?.length) {
    createdByParts.push(`Artist ID(s): ${vancouverRecord.artists.join(', ')}`);
  }
  
  // Extract photo URLs
  const photoUrls: string[] = [];
  if (vancouverRecord.photourl?.url) {
    photoUrls.push(vancouverRecord.photourl.url);
  }

  // Map to structured tags using the Cultural Archiver tag schema
  const tags = mapVancouverTags(vancouverRecord);

  return {
    externalId: `vancouver-${vancouverRecord.registryid}`,
    lat,
    lon,
    title: vancouverRecord.title_of_work || `Artwork #${vancouverRecord.registryid}`,
    description: descriptionParts.length > 0 ? descriptionParts.join('\n\n') : undefined,
    createdBy: createdByParts.length > 0 ? createdByParts.join('; ') : undefined,
    photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    tags,
    metadata: {
      vancouverRegistryId: vancouverRecord.registryid,
      vancouverUrl: vancouverRecord.url,
      originalRecord: vancouverRecord,
    },
  };
}

/**
 * Map Vancouver data to Cultural Archiver structured tags
 */
function mapVancouverTags(record: VancouverRecord): Record<string, string | number | boolean> {
  const tags: Record<string, string | number | boolean> = {};

  // Required base tag for OpenStreetMap compatibility
  tags.tourism = 'artwork';

  // Artwork classification
  if (record.type) {
    tags.artwork_type = mapArtworkType(record.type);
  }

  // Material information
  if (record.primarymaterial) {
    tags.material = normalizeText(record.primarymaterial);
  }

  // Location and administrative information
  if (record.neighbourhood) {
    tags.addr_neighbourhood = normalizeText(record.neighbourhood);
  }
  
  if (record.geo_local_area) {
    tags.addr_city = normalizeText(record.geo_local_area);
  }

  // Ownership and institutional information
  if (record.ownership) {
    tags.operator = normalizeText(record.ownership);
  }

  // Installation date
  if (record.yearofinstallation) {
    const year = parseInt(record.yearofinstallation, 10);
    if (!isNaN(year) && year > 1800 && year <= new Date().getFullYear()) {
      tags.start_date = year;
    }
  }

  // Status information
  if (record.status) {
    tags.condition = mapCondition(record.status);
  }

  // Source attribution (required for mass imports)
  tags.source = 'vancouver-opendata';
  tags.source_ref = `https://opendata.vancouver.ca/explore/dataset/public-art/table/?refine.registryid=${record.registryid}`;
  
  // License information
  tags.source_license = 'Open Data License';
  
  // Import metadata
  const importDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  if (importDate) {
    tags.import_date = importDate;
  }
  tags.import_batch_id = `vancouver-${new Date().toISOString().split('T')[0]}`;

  return tags;
}

/**
 * Map Vancouver artwork type to standard artwork_type values
 */
function mapArtworkType(vancouverType: string): string {
  const normalized = normalizeText(vancouverType);
  
  const typeMapping: Record<string, string> = {
    'sculpture': 'sculpture',
    'mural': 'mural',
    'installation': 'installation',
    'monument': 'monument',
    'mosaic': 'mosaic',
    'painting': 'mural',
    'fountain': 'sculpture',
    'statue': 'statue',
    'relief': 'sculpture',
    'memorial': 'monument',
  };

  // Check for exact matches first
  if (typeMapping[normalized]) {
    return typeMapping[normalized];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(typeMapping)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Default to sculpture if no match
  return 'sculpture';
}

/**
 * Map Vancouver status to condition tag
 */
function mapCondition(status: string): string {
  const normalized = normalizeText(status);
  
  const conditionMapping: Record<string, string> = {
    'in place': 'good',
    'installed': 'good',
    'active': 'good',
    'removed': 'poor',
    'damaged': 'poor',
    'missing': 'poor',
    'relocated': 'good',
    'restored': 'excellent',
  };

  return conditionMapping[normalized] || 'unknown';
}

/**
 * Normalize text for consistent tagging
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/-+/g, '_') // Replace hyphens with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Validate Vancouver record has required fields
 */
export function isValidVancouverRecord(record: unknown): record is VancouverRecord {
  if (!record || typeof record !== 'object') {
    return false;
  }

  const r = record as Partial<VancouverRecord>;
  
  return Boolean(
    typeof r.registryid === 'number' &&
    typeof r.title_of_work === 'string' &&
    r.title_of_work.length > 0 &&
    r.geo_point_2d &&
    typeof r.geo_point_2d.lat === 'number' &&
    typeof r.geo_point_2d.lon === 'number' &&
    r.geo_point_2d.lat >= -90 &&
    r.geo_point_2d.lat <= 90 &&
    r.geo_point_2d.lon >= -180 &&
    r.geo_point_2d.lon <= 180
  );
}

/**
 * Filter Vancouver records by bounds
 */
export function filterVancouverRecordsByBounds(
  records: VancouverRecord[],
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }
): VancouverRecord[] {
  return records.filter(record => {
    const { lat, lon } = record.geo_point_2d;
    return (
      lat >= bounds.south &&
      lat <= bounds.north &&
      lon >= bounds.west &&
      lon <= bounds.east
    );
  });
}

/**
 * Get Vancouver data quality statistics
 */
export function getVancouverDataQuality(records: VancouverRecord[]): {
  total: number;
  withPhotos: number;
  withArtists: number;
  withDescriptions: number;
  withMaterial: number;
  withYear: number;
  missingCoordinates: number;
} {
  let withPhotos = 0;
  let withArtists = 0;
  let withDescriptions = 0;
  let withMaterial = 0;
  let withYear = 0;
  let missingCoordinates = 0;

  for (const record of records) {
    if (record.photourl?.url) withPhotos++;
    if (record.artists?.length) withArtists++;
    if (record.descriptionofwork) withDescriptions++;
    if (record.primarymaterial) withMaterial++;
    if (record.yearofinstallation) withYear++;
    if (!record.geo_point_2d?.lat || !record.geo_point_2d?.lon) missingCoordinates++;
  }

  return {
    total: records.length,
    withPhotos,
    withArtists,
    withDescriptions,
    withMaterial,
    withYear,
    missingCoordinates,
  };
}