/**
 * Mass Import System - Vancouver Open Data Mapper
 *
 * This module handles mapping Vancouver Public Art dataset to the internal format,
 * including field transformation, coordinate validation, and structured tag application.
 */

import type {
  VancouverArtworkData,
  RawImportData,
  ValidationResult,
  DataSourceMapper,
  PhotoInfo,
} from '../types';
import { validateImportData, VANCOUVER_BOUNDS } from '../lib/validation.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================
// Artist Data Types
// ================================

interface VancouverArtist {
  artistid: number;
  firstname: string | null;
  lastname: string;
  artisturl?: string;
  biography?: string;
  country?: string | null;
  photo?: string | null;
  photocredit?: string | null;
  website?: string | null;
}

// Cached artist lookup map
let artistLookupCache: Map<number, string> | null = null;

// ================================
// Artist Data Loading
// ================================

/**
 * Convert a Vancouver artist ID to an artist name
 * @param artistId - The artist ID to look up
 * @returns Artist name or fallback format "Vancouver Open data Artist ID=###"
 */
function getArtistNameById(artistId: number | string): string {
  const artistLookup = loadArtistLookup();

  try {
    // Convert to number if it's a string
    const id = typeof artistId === 'string' ? parseInt(artistId, 10) : artistId;

    if (isNaN(id)) {
      console.log(
        `[VANCOUVER_ARTIST_DEBUG] Invalid artist ID format: "${artistId}" - using fallback format`
      );
      return `Vancouver Open data Artist ID=${artistId}`;
    }

    // Look up the artist name in our cached data
    const artistName = artistLookup.get(id);

    if (artistName && artistName.trim()) {
      console.log(
        `[VANCOUVER_ARTIST_DEBUG] Found artist name for ID ${id}: "${artistName.trim()}"`
      );
      return artistName.trim();
    }

    // Fallback format if artist not found
    console.log(
      `[VANCOUVER_ARTIST_DEBUG] No artist data found for ID ${id} - using fallback format`
    );
    return `Vancouver Open data Artist ID=${id}`;
  } catch (error) {
    console.warn(`[VANCOUVER_ARTIST_DEBUG] Error processing artist ID: ${artistId}`, error);
    return `Vancouver Open data Artist ID=${artistId}`;
  }
}

/**
 * Load artist data from the JSON file and create a lookup map
 */
function loadArtistLookup(): Map<number, string> {
  if (artistLookupCache) {
    return artistLookupCache;
  }

  try {
    // Prefer bundled importers data in the mass-import package, fall back to workspace tasks
    const possiblePaths = [
      path.resolve(__dirname, './public-art-artists.json'),
      path.resolve(__dirname, '../importers/public-art-artists.json'),
      path.resolve(process.cwd(), 'src/lib/mass-import-system/importers/public-art-artists.json'),
      path.resolve(process.cwd(), 'tasks/public-art-artists.json'),
    ];

    let artistData: VancouverArtist[] | null = null;
    let usedPath = '';

    for (const artistPath of possiblePaths) {
      try {
        if (fs.existsSync(artistPath)) {
          const rawData = fs.readFileSync(artistPath, 'utf-8');
          artistData = JSON.parse(rawData) as VancouverArtist[];
          usedPath = artistPath;
          break;
        }
      } catch (error) {
        // Continue to next path
        continue;
      }
    }

    if (!artistData) {
      console.warn(
        '[VANCOUVER_ARTIST_DEBUG] Could not load Vancouver artist data file. Artist names will not be resolved.'
      );
      artistLookupCache = new Map();
      return artistLookupCache;
    }

    console.log(`[VANCOUVER_ARTIST_DEBUG] Loaded ${artistData.length} artists from ${usedPath}`);

    // Create the lookup map
    artistLookupCache = new Map();

    for (const artist of artistData) {
      // Build artist name from firstname and lastname
      const nameParts: string[] = [];

      if (artist.firstname && artist.firstname.trim()) {
        nameParts.push(artist.firstname.trim());
      }

      if (artist.lastname && artist.lastname.trim()) {
        nameParts.push(artist.lastname.trim());
      }

      const fullName = nameParts.join(' ').trim();

      if (fullName) {
        artistLookupCache.set(artist.artistid, fullName);
        console.log(
          `[VANCOUVER_ARTIST_DEBUG] Mapped artist ID ${artist.artistid} -> "${fullName}"`
        );
      } else {
        console.log(
          `[VANCOUVER_ARTIST_DEBUG] No valid name found for artist ID ${artist.artistid} (firstname: "${artist.firstname}", lastname: "${artist.lastname}")`
        );
      }
    }

    console.log(
      `[VANCOUVER_ARTIST_DEBUG] Created artist lookup map with ${artistLookupCache.size} entries`
    );
    return artistLookupCache;
  } catch (error) {
    console.error('Error loading Vancouver artist data:', error);
    artistLookupCache = new Map();
    return artistLookupCache;
  }
}

// ================================
// Vancouver Data Mapper
// ================================

export const VancouverMapper: DataSourceMapper = {
  name: 'Vancouver Open Data',
  version: '1.0.0',

  /**
   * Map Vancouver artwork data to internal format
   */
  mapData(rawData: VancouverArtworkData): ValidationResult {
    try {
      // Transform Vancouver data to RawImportData format
      const mappedData = mapVancouverToRawData(rawData);

      // Handle null return (artwork should be skipped)
      if (!mappedData) {
        return {
          isValid: false,
          errors: [
            {
              field: 'coordinates',
              message: `Artwork ${rawData.registryid} skipped: No valid coordinates found`,
              severity: 'error',
              code: 'MISSING_COORDINATES',
            },
          ],
          warnings: [],
        };
      }

      // Use the standard validation with Vancouver-specific config
      const config = {
        apiEndpoint: 'https://api.publicartregistry.com',
        massImportUserToken: 'a0000000-1000-4000-8000-000000000002', // MASS_IMPORT_USER_UUID from shared/constants.ts
        batchSize: 50,
        maxRetries: 3,
        retryDelay: 1000,
        duplicateDetectionRadius: 50, // 50m for dense urban environment
        titleSimilarityThreshold: 0.8,
        dryRun: false,
      };

      return validateImportData(mappedData, config);
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            field: 'mapping',
            message: `Failed to map Vancouver data: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error',
            code: 'MAPPING_ERROR',
          },
        ],
        warnings: [],
      };
    }
  },

  /**
   * Validate that coordinates are within Vancouver bounds
   */
  validateBounds(lat: number, lon: number): boolean {
    return (
      lat >= VANCOUVER_BOUNDS.south &&
      lat <= VANCOUVER_BOUNDS.north &&
      lon >= VANCOUVER_BOUNDS.west &&
      lon <= VANCOUVER_BOUNDS.east
    );
  },

  /**
   * Generate import ID from Vancouver registry ID
   */
  generateImportId(data: VancouverArtworkData): string {
    return `vancouver_${data.registryid}`;
  },
};

// ================================
// Data Transformation Functions
// ================================

/**
 * Transform Vancouver artwork data to RawImportData format
 */
function mapVancouverToRawData(data: VancouverArtworkData): RawImportData | null {
  // Extract coordinates with proper null checking
  let lat: number | undefined;
  let lon: number | undefined;

  if (data.geo_point_2d?.lat && data.geo_point_2d?.lon) {
    lat = data.geo_point_2d.lat;
    lon = data.geo_point_2d.lon;
  } else if (data.geom?.geometry?.coordinates && Array.isArray(data.geom.geometry.coordinates)) {
    [lon, lat] = data.geom.geometry.coordinates; // GeoJSON is [lon, lat]
  }

  if (!lat || !lon || !isFinite(lat) || !isFinite(lon)) {
    console.warn(
      `Skipping artwork ${data.registryid} (${data.title_of_work}): No valid coordinates found`
    );
    return null; // Skip this artwork
  }

  // Validate coordinates are within Vancouver bounds
  if (!VancouverMapper.validateBounds!(lat, lon)) {
    console.warn(
      `Artwork ${data.registryid} (${data.title_of_work}): Coordinates (${lat}, ${lon}) are outside Vancouver bounds`
    );
    // Continue processing but log the warning - these might still be valid artworks
  }

  // Build title (required field)
  let title = data.title_of_work || 'Untitled Artwork';
  if (title.length > 200) {
    title = title.substring(0, 197) + '...';
  }

  // Build description from available fields
  const descriptionParts: string[] = [];

  if (data.descriptionofwork) {
    descriptionParts.push(`**Description Of Work**\n${data.descriptionofwork}\n\n`);
  }

  if (data.artistprojectstatement) {
    descriptionParts.push(`**Artist statement**\n${data.artistprojectstatement}\n\n`);
  }

  // Add additional metadata fields
  const metadataParts: string[] = [];

  if (data.registryid) {
    metadataParts.push(`**Registry ID:** ${data.registryid}`);
  }

  if (data.status) {
    metadataParts.push(`**Status:** ${data.status}`);
  }

  if (data.sitename) {
    metadataParts.push(`**Site Name:** ${data.sitename}`);
  }

  if (data.siteaddress) {
    metadataParts.push(`**Site Address:** ${data.siteaddress}`);
  }

  if (data.primarymaterial) {
    metadataParts.push(`**Primary Material:** ${data.primarymaterial}`);
  }

  if (data.locationonsite) {
    metadataParts.push(`**Location on Site:** ${data.locationonsite}`);
  }

  if (data.artists && data.artists.length > 0) {
    metadataParts.push(`**Artists:** ${data.artists.join(', ')}`);
  }

  if (data.yearofinstallation) {
    metadataParts.push(`**Year of Installation:** ${data.yearofinstallation}`);
  }

  // Combine all parts
  const allParts = [...descriptionParts];
  if (metadataParts.length > 0) {
    allParts.push(`**Additional Information:**\n${metadataParts.join('\n\n')}`);
  }

  // Add data source attribution
  allParts.push(
    'Imported from Vancouver Open Data - [Open Government Licence](https://opendata.vancouver.ca/explore/dataset/public-art/).'
  );

  const description = allParts.join('\n\n');

  // Extract artist information
  const artist = extractArtistName(data);

  // Process photo information
  const photos = extractPhotoInfo(data);

  // Build structured tags
  const tags = buildStructuredTags(data);

  return {
    lat,
    lon,
    title,
    description,
    artist,
    yearOfInstallation: data.yearofinstallation,
    material: data.primarymaterial,
    type: data.type,
    neighborhood: data.neighbourhood || data.geo_local_area,
    siteName: data.sitename,
    photos,
    source: 'vancouver-opendata',
    sourceUrl: data.url,
    externalId: data.registryid.toString(),
    license: 'Open Government Licence – Vancouver',
    tags,
    status: mapVancouverStatus(data.status),
  };
}

/**
 * Extract artist name from Vancouver data using artist ID lookup
 */
/**
 * Extract artist name from Vancouver artwork data
 * Returns comma-separated list of artist names if multiple artists
 */
function extractArtistName(data: VancouverArtworkData): string | undefined {
  if (!data.artists || data.artists.length === 0) {
    console.log(
      `[VANCOUVER_ARTIST_DEBUG] No artists found for artwork ${data.registryid} (${data.title_of_work})`
    );
    return undefined;
  }

  console.log(
    `[VANCOUVER_ARTIST_DEBUG] Processing ${data.artists.length} artist(s) for artwork ${data.registryid} (${data.title_of_work}): [${data.artists.join(', ')}]`
  );

  const artistNames: string[] = [];

  // Convert each artist ID to name using our dedicated function
  for (const artistIdStr of data.artists) {
    console.log(`[VANCOUVER_ARTIST_DEBUG] Looking up artist ID: ${artistIdStr}`);
    const artistName = getArtistNameById(artistIdStr);
    console.log(`[VANCOUVER_ARTIST_DEBUG] Artist ID ${artistIdStr} resolved to: "${artistName}"`);
    artistNames.push(artistName);
  }

  const finalArtistString = artistNames.length > 0 ? artistNames.join(', ') : undefined;
  console.log(
    `[VANCOUVER_ARTIST_DEBUG] Final artist string for artwork ${data.registryid}: "${finalArtistString}"`
  );

  // Return comma-separated list of artist names
  return finalArtistString;
}

/**
 * Extract photo information from Vancouver data
 */
function extractPhotoInfo(data: VancouverArtworkData): PhotoInfo[] {
  const photos: PhotoInfo[] = [];

  if (data.photourl && data.photourl.url) {
    photos.push({
      url: data.photourl.url,
      caption: `Photo of ${data.title_of_work}`,
      credit: data.photocredits,
      filename: data.photourl.filename,
    });
  }

  return photos;
}

/**
 * Build structured tags from Vancouver data
 * All dataset fields become tags in the logbook entry for comprehensive metadata tracking
 */
function buildStructuredTags(
  data: VancouverArtworkData
): Record<string, string | number | boolean> {
  const tags: Record<string, string | number | boolean> = {};

  // Core identification
  tags.registry_id = data.registryid.toString();
  tags.external_id = data.registryid.toString(); // For duplicate detection

  // Add source tag for bulk approval filtering
  tags.source = 'vancouver-opendata';

  // Physical properties - use standard 'materials' tag
  if (data.primarymaterial) {
    tags.materials = normalizeMaterial(data.primarymaterial);
    tags.primary_material = data.primarymaterial; // Keep original for reference
  }

  // Artwork classification - use standard 'artwork_type' tag mapped from 'type' field
  if (data.type) {
    tags.artwork_type = normalizeArtworkType(data.type);
    tags.type = data.type; // Keep original for reference
  }

  // Historical information - use standard 'installation_date' tag
  if (data.yearofinstallation) {
    tags.installation_date = data.yearofinstallation;
    tags.start_date = data.yearofinstallation; // Keep legacy tag for compatibility
    tags.year_of_installation = data.yearofinstallation; // Keep original for reference
  }

  // Location details - all dataset fields become tags
  if (data.ownership) {
    tags.operator = data.ownership;
    tags.ownership = data.ownership; // Keep original for reference
  }

  if (data.locationonsite) {
    tags.location = data.locationonsite;
    tags.location_on_site = data.locationonsite; // Keep original for reference
  }

  if (data.sitename) {
    tags.site_name = data.sitename;
  }

  if (data.siteaddress) {
    tags['addr:full'] = data.siteaddress;
    tags.site_address = data.siteaddress; // Also keep as site_address for consistency
  }

  // Neighbourhood information
  const neighbourhood = data.neighbourhood || data.geo_local_area;
  if (neighbourhood) {
    tags.neighbourhood = neighbourhood;
  }

  if (data.geo_local_area && data.geo_local_area !== data.neighbourhood) {
    tags.geo_local_area = data.geo_local_area;
  }

  // Status information - use standard 'condition' tag with proper mapping
  if (data.status) {
    tags.condition = mapVancouverStatusToCondition(data.status);
    tags.status = data.status; // Keep original for reference
  }

  // Artist information (if available as array)
  if (data.artists && data.artists.length > 0) {
    tags.artist_ids = data.artists.join(', ');
    // The artist names are handled separately in the extractArtistName function
  }

  // Web resources - use standard 'website' tag
  if (data.url) {
    tags.website = data.url;
    tags.source_url = data.url; // Keep for reference
  }

  // Photo information
  if (data.photourl?.url) {
    tags.photo_url = data.photourl.url;
    if (data.photourl.filename) {
      tags.photo_filename = data.photourl.filename;
    }
  }

  if (data.photocredits) {
    tags.photo_credits = data.photocredits;
  }

  // Description fields (if available) - store as tags for searchability
  if (data.descriptionofwork) {
    tags.has_description = true;
    // Don't store full description as tag due to length, but mark its presence
  }

  if (data.artistprojectstatement) {
    tags.has_artist_statement = true;
    // Don't store full statement as tag due to length, but mark its presence
  }

  // Additional Vancouver-specific metadata
  tags.data_source = 'vancouver_open_data';
  tags.license = 'Open Government Licence – Vancouver';

  // Add a Vancouver-specific identifier for filtering
  tags.city = 'vancouver';
  tags.province = 'british_columbia';
  tags.country = 'canada';

  return tags;
}

/**
 * Map Vancouver status to standard condition values
 * Based on the specific status values found in Vancouver data
 */
function mapVancouverStatusToCondition(status: string): string {
  const normalized = status.toLowerCase().trim();

  // Map based on the specified requirements
  const statusMap: Record<string, string> = {
    'no longer in place': 'removed',
    'in place': 'good',
    'in progress': 'unknown',
    deaccessioned: 'removed',
    // Additional common variations
    installed: 'good',
    active: 'good',
    removed: 'removed',
    demolished: 'removed',
    relocated: 'unknown',
    'in storage': 'unknown',
    unknown: 'unknown',
  };

  return statusMap[normalized] || 'unknown';
}

/**
 * Map Vancouver status to artwork condition
 * @deprecated Use mapVancouverStatusToCondition instead
 */
function mapVancouverStatus(status: string): 'active' | 'inactive' | 'removed' | 'unknown' {
  const normalized = status.toLowerCase().trim();

  const statusMap: Record<string, 'active' | 'inactive' | 'removed' | 'unknown'> = {
    'in place': 'active',
    installed: 'active',
    active: 'active',
    removed: 'removed',
    demolished: 'removed',
    relocated: 'inactive',
    'in storage': 'inactive',
    unknown: 'unknown',
  };

  return statusMap[normalized] || 'unknown';
}

/**
 * Normalize material names to standard values
 */
function normalizeMaterial(material: string): string {
  const normalized = material.toLowerCase().trim();

  // Handle common Vancouver material patterns
  const materialMap: Record<string, string> = {
    'stainless steel': 'steel',
    'mild steel': 'steel',
    'corten steel': 'steel',
    'weathering steel': 'steel',
    bronze: 'bronze',
    aluminum: 'aluminium',
    aluminium: 'aluminium',
    concrete: 'concrete',
    stone: 'stone',
    granite: 'stone',
    marble: 'stone',
    wood: 'wood',
    cedar: 'wood',
    glass: 'glass',
    ceramic: 'ceramic',
    fiberglass: 'plastic',
    fibreglass: 'plastic',
  };

  // Check for direct matches
  for (const [key, value] of Object.entries(materialMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  // Handle compound materials (take first recognized material)
  const parts = normalized.split(/[,;\/\s]+/);
  for (const part of parts) {
    const trimmedPart = part.trim();
    if (materialMap[trimmedPart]) {
      return materialMap[trimmedPart];
    }
  }

  // Return normalized original if no mapping found
  return normalized;
}

/**
 * Normalize artwork type to standard values
 */
function normalizeArtworkType(type: string): string {
  const normalized = type.toLowerCase().trim();

  const typeMap: Record<string, string> = {
    sculpture: 'sculpture',
    statue: 'sculpture',
    fountain: 'fountain',
    mural: 'mural',
    'wall mural': 'mural',
    mosaic: 'mosaic',
    installation: 'installation',
    'public art installation': 'installation',
    monument: 'monument',
    memorial: 'monument',
    relief: 'relief',
    'bas-relief': 'relief',
    painting: 'painting',
    'mixed media': 'mixed_media',
    'public art': 'public_art',
  };

  return typeMap[normalized] || normalized;
}

// ================================
// Validation Helpers
// ================================

/**
 * Validate Vancouver-specific data quality
 */
export function validateVancouverData(data: VancouverArtworkData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!data.registryid) {
    errors.push('Missing registry ID');
  }

  if (!data.title_of_work || data.title_of_work.trim().length === 0) {
    errors.push('Missing or empty title');
  }

  if (!data.geo_point_2d) {
    errors.push('Missing coordinates (geo_point_2d is null)');
  } else if (!data.geo_point_2d.lat || !data.geo_point_2d.lon) {
    errors.push('Missing or invalid coordinates (lat/lon missing from geo_point_2d)');
  }

  // Coordinate bounds validation
  if (data.geo_point_2d && data.geo_point_2d.lat && data.geo_point_2d.lon) {
    if (!VancouverMapper.validateBounds!(data.geo_point_2d.lat, data.geo_point_2d.lon)) {
      warnings.push('Coordinates appear to be outside Vancouver bounds');
    }
  }

  // Data quality checks
  if (!data.descriptionofwork && !data.artistprojectstatement) {
    warnings.push('No description or artist statement provided');
  }

  if (!data.primarymaterial) {
    warnings.push('No material information provided');
  }

  if (!data.yearofinstallation) {
    warnings.push('No installation year provided');
  }

  if (!data.photourl || !data.photourl.url) {
    warnings.push('No photo URL provided');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Export the standalone artist lookup function for external use
export { getArtistNameById };
