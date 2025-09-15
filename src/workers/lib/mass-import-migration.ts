// ================================
// Mass Import Migration Script
// ================================
// Updates existing mass import scripts to work with new unified schema

import type { D1Database } from '@cloudflare/workers-types';
import { 
  processImportFile,
  type MassImportRecord,
  type MassImportConfig,
  type MassImportResult 
} from './mass-import-new.js';

// ================================
// Legacy to New Schema Migration
// ================================

/**
 * Converts legacy mass import data format to new schema format
 */
export function migrateLegacyImportData(legacyData: any[]): MassImportRecord[] {
  return legacyData.map(item => convertLegacyRecord(item));
}

function convertLegacyRecord(legacyItem: any): MassImportRecord {
  // Map common legacy fields to new schema
  const record: MassImportRecord = {
    source_id: legacyItem.id || legacyItem.source_id || crypto.randomUUID(),
    title: legacyItem.title || legacyItem.name || 'Untitled',
    lat: parseFloat(legacyItem.lat || legacyItem.latitude),
    lon: parseFloat(legacyItem.lon || legacyItem.longitude),
    source_type: 'api_import'
  };

  // Map artist information - will be handled through artwork_artists relationship
  if (legacyItem.artist || legacyItem.created_by || legacyItem.artist_name) {
    // Store artist name for later processing in artwork_artists table
    record.artist_name = legacyItem.artist || legacyItem.created_by || legacyItem.artist_name;
  }

  // Map optional fields
  if (legacyItem.year || legacyItem.year_created || legacyItem.date) {
    const year = parseInt(legacyItem.year || legacyItem.year_created || legacyItem.date);
    if (!isNaN(year)) {
      record.year_created = year;
    }
  }

  if (legacyItem.medium || legacyItem.material) {
    record.medium = legacyItem.medium || legacyItem.material;
  }

  if (legacyItem.dimensions || legacyItem.size) {
    record.dimensions = legacyItem.dimensions || legacyItem.size;
  }

  if (legacyItem.description || legacyItem.desc) {
    record.description = legacyItem.description || legacyItem.desc;
  }

  // Map location fields
  if (legacyItem.address) record.address = legacyItem.address;
  if (legacyItem.neighborhood || legacyItem.area) {
    record.neighborhood = legacyItem.neighborhood || legacyItem.area;
  }
  if (legacyItem.city) record.city = legacyItem.city;
  if (legacyItem.region || legacyItem.state || legacyItem.province) {
    record.region = legacyItem.region || legacyItem.state || legacyItem.province;
  }
  if (legacyItem.country) record.country = legacyItem.country;

  // Map photos
  if (legacyItem.photos) {
    if (Array.isArray(legacyItem.photos)) {
      record.photos = legacyItem.photos;
    } else if (typeof legacyItem.photos === 'string') {
      record.photos = [legacyItem.photos];
    }
  }

  // Map tags - convert various tag formats
  const tags: Record<string, string> = {};
  
  if (legacyItem.tags) {
    if (typeof legacyItem.tags === 'object' && !Array.isArray(legacyItem.tags)) {
      Object.assign(tags, legacyItem.tags);
    } else if (typeof legacyItem.tags === 'string') {
      try {
        const parsed = JSON.parse(legacyItem.tags);
        if (typeof parsed === 'object') {
          Object.assign(tags, parsed);
        }
      } catch {
        // If not JSON, treat as a single tag
        tags.general = legacyItem.tags;
      }
    }
  }

  // Add common metadata tags
  if (legacyItem.type || legacyItem.artwork_type) {
    tags.artwork_type = legacyItem.type || legacyItem.artwork_type;
  }
  if (legacyItem.style) {
    tags.style = legacyItem.style;
  }
  if (legacyItem.condition) {
    tags.condition = legacyItem.condition;
  }

  if (Object.keys(tags).length > 0) {
    record.tags = tags;
  }

  // Add metadata for traceability
  record.metadata = {
    legacy_import: true,
    original_fields: Object.keys(legacyItem),
    imported_at: new Date().toISOString()
  };

  return record;
}

// ================================
// Vancouver Public Art Migration
// ================================

/**
 * Specifically handles Vancouver public art data format
 */
export function migrateVancouverArtData(vancouverData: any[]): MassImportRecord[] {
  return vancouverData.map(item => {
    const record: MassImportRecord = {
      source_id: item.trackid || item.id || crypto.randomUUID(),
      title: item.title || item.sitename || 'Untitled Vancouver Public Art',
      lat: parseFloat(item.lat || item.latitude),
      lon: parseFloat(item.lon || item.longitude),
      source_type: 'osm_import',
      city: 'Vancouver',
      region: 'British Columbia',
      country: 'Canada'
    };

    // Vancouver-specific mappings
    if (item.artists || item.artist) {
      record.artist_name = item.artists || item.artist;
    }

    if (item.yearofinstallation || item.year) {
      const year = parseInt(item.yearofinstallation || item.year);
      if (!isNaN(year)) {
        record.year_created = year;
      }
    }

    if (item.primarymaterial || item.material) {
      record.medium = item.primarymaterial || item.material;
    }

    if (item.description || item.descriptionofwork) {
      record.description = item.description || item.descriptionofwork;
    }

    if (item.neighbourhood) {
      record.neighborhood = item.neighbourhood;
    }

    if (item.address || item.siteaddress) {
      record.address = item.address || item.siteaddress;
    }

    // Vancouver-specific tags
    const tags: Record<string, string> = {
      artwork_type: item.type || 'public_art',
      data_source: 'vancouver_open_data'
    };

    if (item.ownership) {
      tags.ownership = item.ownership;
    }
    if (item.status) {
      tags.status = item.status;
    }
    if (item.publicartpolicy) {
      tags.public_art_policy = item.publicartpolicy;
    }

    record.tags = tags;

    // Add Vancouver-specific metadata
    record.metadata = {
      vancouver_import: true,
      trackid: item.trackid,
      imported_at: new Date().toISOString(),
      original_source: 'Vancouver Open Data Portal'
    };

    return record;
  });
}

// ================================
// OSM Import Migration
// ================================

/**
 * Handles OpenStreetMap data format
 */
export function migrateOSMData(osmData: any[]): MassImportRecord[] {
  return osmData.map(item => {
    const record: MassImportRecord = {
      source_id: item.id?.toString() || crypto.randomUUID(),
      title: item.tags?.name || item.tags?.title || 'Unnamed OSM Artwork',
      lat: item.lat || (item.geometry?.coordinates?.[1]),
      lon: item.lon || (item.geometry?.coordinates?.[0]),
      source_type: 'osm_import'
    };

    const tags = item.tags || {};

    // OSM artist mapping
    if (tags.artist || tags['artist:name'] || tags.author) {
      record.artist_name = tags.artist || tags['artist:name'] || tags.author;
    }

    // OSM year mapping
    if (tags.start_date || tags.year || tags['construction:year']) {
      const yearStr = tags.start_date || tags.year || tags['construction:year'];
      const year = parseInt(yearStr);
      if (!isNaN(year)) {
        record.year_created = year;
      }
    }

    // OSM material/medium
    if (tags.material || tags.medium) {
      record.medium = tags.material || tags.medium;
    }

    // OSM description
    if (tags.description || tags.note) {
      record.description = tags.description || tags.note;
    }

    // OSM location
    if (tags['addr:street'] && tags['addr:housenumber']) {
      record.address = `${tags['addr:housenumber']} ${tags['addr:street']}`;
    } else if (tags['addr:street']) {
      record.address = tags['addr:street'];
    }

    if (tags['addr:city']) record.city = tags['addr:city'];
    if (tags['addr:state'] || tags['addr:province']) {
      record.region = tags['addr:state'] || tags['addr:province'];
    }
    if (tags['addr:country']) record.country = tags['addr:country'];

    // Convert OSM tags
    const convertedTags: Record<string, string> = {
      artwork_type: tags.artwork_type || tags.tourism || 'artwork',
      data_source: 'openstreetmap'
    };

    // Preserve important OSM tags
    const preserveTags = [
      'tourism', 'historic', 'memorial', 'monument', 'statue',
      'artwork_type', 'sculpture', 'mural', 'installation'
    ];

    for (const tag of preserveTags) {
      if (tags[tag]) {
        convertedTags[tag] = tags[tag];
      }
    }

    record.tags = convertedTags;

    record.metadata = {
      osm_import: true,
      osm_id: item.id,
      osm_version: item.version,
      osm_changeset: item.changeset,
      imported_at: new Date().toISOString()
    };

    return record;
  });
}

// ================================
// Wrapper Functions for Existing Scripts
// ================================

/**
 * Drop-in replacement for legacy mass import function
 */
export async function runMassImport(
  db: D1Database,
  data: any[],
  options: {
    sourceType?: 'vancouver' | 'osm' | 'generic';
    batchSize?: number;
    autoApprove?: boolean;
    dryRun?: boolean;
    importerToken?: string;
    sourceName?: string;
  } = {}
): Promise<MassImportResult> {
  // Convert legacy data to new format
  let convertedData: MassImportRecord[];
  
  switch (options.sourceType) {
    case 'vancouver':
      convertedData = migrateVancouverArtData(data);
      break;
    case 'osm':
      convertedData = migrateOSMData(data);
      break;
    default:
      convertedData = migrateLegacyImportData(data);
  }

  // Configure import
  const config: MassImportConfig = {
    batchSize: options.batchSize || 10,
    autoApprove: options.autoApprove || false,
    duplicateCheckRadius: 500,
    importerToken: options.importerToken || 'MASS_IMPORT_SYSTEM',
    dryRun: options.dryRun || false,
    sourceName: options.sourceName || 'Legacy Import',
    skipDuplicates: true,
    createArtists: true
  };

  return processImportFile(db, convertedData, config);
}

// ================================
// Utility Functions
// ================================

export function validateCoordinates(lat: number, lon: number): boolean {
  return !isNaN(lat) && !isNaN(lon) && 
         lat >= -90 && lat <= 90 && 
         lon >= -180 && lon <= 180;
}

export function cleanTitle(title: string): string {
  return title?.trim()?.replace(/\s+/g, ' ') || 'Untitled';
}

export function extractYear(dateString: string): number | undefined {
  if (!dateString) return undefined;
  
  const yearMatch = dateString.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    return parseInt(yearMatch[0]);
  }
  
  return undefined;
}