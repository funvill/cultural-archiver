/**
 * Data dump system for public CC0-licensed artwork data export
 * Provides filtered, sanitized data for researchers and developers
 */

import type { WorkerEnv } from '../types';
import { ApiError } from './errors';
import { createZipArchive, type ArchiveFile } from './archive';

// Configuration constants
const MAX_DATA_DUMP_SIZE = 500 * 1024 * 1024; // 500MB limit for public data dumps
const DATA_DUMP_VERSION = '1.0.0';

/**
 * Fields to exclude from public data dumps (blacklist approach)
 */
const SENSITIVE_FIELDS = {
  // User-specific data
  user_token: true,
  email: true,
  ip_address: true,
  session_data: true,

  // Rate limiting and security data
  rate_limit_data: true,
  auth_tokens: true,
  magic_tokens: true,

  // Private admin data
  moderation_notes: true,
  admin_comments: true,
  internal_flags: true,

  // System internals
  created_by_admin: true,
  reviewed_by: true,
  rejection_reason: true,
} as const;

/**
 * Data dump metadata information
 */
export interface DataDumpMetadata {
  version: string;
  generated_at: string;
  license: 'CC0';
  source: string;
  description: string;
  data_info: {
    total_artworks: number;
    total_creators: number;
    total_tags: number;
    total_photos: number;
  };
  filter_info: {
    status_filter: 'approved';
    excluded_fields: string[];
    photo_types: 'thumbnails_only';
  };
  file_structure: Record<string, string>;
}

/**
 * Data dump generation result
 */
export interface DataDumpResult {
  success: boolean;
  data_dump_file?: ArrayBuffer;
  filename?: string;
  metadata?: DataDumpMetadata;
  size?: number;
  error?: string;
  warnings?: string[];
}

/**
 * Approved artwork data structure for export
 */
export interface ExportArtworkData {
  id: string;
  lat: number;
  lon: number;
  type_id: string;
  created_at: string;
  tags?: Record<string, unknown>;
  photos?: string[];
  type_name?: string;
}

/**
 * Creator data structure for export
 */
export interface ExportCreatorData {
  id: string;
  name: string;
  bio?: string;
  created_at: string;
}

/**
 * Tag data structure for export
 */
export interface ExportTagData {
  id: string;
  label: string;
  value: string;
  created_at: string;
}

/**
 * Artwork-Creator relationship for export
 */
export interface ExportArtworkCreatorData {
  artwork_id: string;
  creator_id: string;
  role: string;
  created_at: string;
}

/**
 * Filter approved artwork with public fields only
 */
export async function filterApprovedArtwork(db: D1Database): Promise<{
  success: boolean;
  artworks?: ExportArtworkData[];
  total_count?: number;
  error?: string;
}> {
  try {
    console.log('[DATA_DUMP] Starting approved artwork filtering...');
    const startTime = Date.now();

    // Get approved artwork with type names
    const artworkQuery = await db
      .prepare(
        `
      SELECT 
        a.id,
        a.lat,
        a.lon,
        a.type_id,
        a.created_at,
        a.tags,
        a.photos,
        at.name as type_name
      FROM artwork a
      LEFT JOIN artwork_types at ON a.type_id = at.id
      WHERE a.status = 'approved'
      ORDER BY a.created_at DESC
    `
      )
      .all();

    if (!artworkQuery.success) {
      throw new Error('Failed to query approved artwork');
    }

    const artworks: ExportArtworkData[] = (artworkQuery.results as Array<
      {
        id: string;
        lat: number;
        lon: number;
        type_id: string;
        created_at: string;
        tags?: string | null;
        photos?: string | null;
        type_name?: string | null;
      }
    >).map((row) => {
      const artwork: ExportArtworkData = {
        id: row.id,
        lat: row.lat,
        lon: row.lon,
        type_id: row.type_id,
        created_at: row.created_at,
      };

      // Parse tags if present
      if (row.tags) {
        try {
          artwork.tags = JSON.parse(row.tags);
        } catch (e) {
          console.warn(`[DATA_DUMP] Failed to parse tags for artwork ${row.id}:`, e);
        }
      }

      // Parse photos if present
      if (row.photos) {
        try {
          artwork.photos = JSON.parse(row.photos);
        } catch (e) {
          console.warn(`[DATA_DUMP] Failed to parse photos for artwork ${row.id}:`, e);
        }
      }

      // Add type name if available
      if (row.type_name) {
        artwork.type_name = row.type_name;
      }

      return artwork;
    });

    const endTime = Date.now();
    console.log(
      `[DATA_DUMP] Filtered ${artworks.length} approved artworks in ${endTime - startTime}ms`
    );

    return {
      success: true,
      artworks,
      total_count: artworks.length,
    };
  } catch (error) {
    console.error('[DATA_DUMP] Approved artwork filtering failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown artwork filtering error',
    };
  }
}

/**
 * Sanitize data by removing sensitive fields
 */
export function sanitizeUserData(data: Record<string, unknown>): Partial<Record<string, unknown>> {
  const sanitized: Partial<Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!(key in SENSITIVE_FIELDS)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Export approved artwork as JSON
 */
export async function exportArtworkAsJSON(db: D1Database): Promise<{
  success: boolean;
  json_content?: string;
  count?: number;
  error?: string;
}> {
  try {
    console.log('[DATA_DUMP] Exporting artwork as JSON...');

    const result = await filterApprovedArtwork(db);
    if (!result.success) {
      const errorResult: {
        success: false;
        json_content?: string;
        count?: number;
        error?: string;
      } = {
        success: false,
      };

      if (result.error) {
        errorResult.error = result.error;
      }

      return errorResult;
    }

    // Sanitize all artwork data
  const sanitizedArtworks = result.artworks!.map(artwork => sanitizeUserData(artwork as unknown as Record<string, unknown>));

    const jsonContent = JSON.stringify(sanitizedArtworks, null, 2);
    console.log(`[DATA_DUMP] Exported ${result.total_count} artworks as JSON`);

    const successResult: {
      success: true;
      json_content: string;
      count?: number;
      error?: string;
    } = {
      success: true,
      json_content: jsonContent,
    };

    if (result.total_count !== undefined) {
      successResult.count = result.total_count;
    }

    return successResult;
  } catch (error) {
    console.error('[DATA_DUMP] Artwork JSON export failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown JSON export error',
    };
  }
}

/**
 * Export creators as JSON
 */
export async function exportCreatorsAsJSON(db: D1Database): Promise<{
  success: boolean;
  json_content?: string;
  count?: number;
  error?: string;
}> {
  try {
    console.log('[DATA_DUMP] Exporting creators as JSON...');

    // Get all creators (they don't have sensitive data typically)
    const creatorsQuery = await db
      .prepare(
        `
      SELECT id, name, bio, created_at
      FROM creators
      ORDER BY created_at DESC
    `
      )
      .all();

    if (!creatorsQuery.success) {
      throw new Error('Failed to query creators');
    }

    const creators: ExportCreatorData[] = (creatorsQuery.results as Array<{
      id: string; name: string; bio?: string | null; created_at: string;
    }>).map((row) => {
      const creator: ExportCreatorData = {
        id: row.id,
        name: row.name,
        created_at: row.created_at,
        ...(row.bio ? { bio: row.bio } : {}),
      };
      return creator;
    });

    // Sanitize creator data (though typically no sensitive fields)
  const sanitizedCreators = creators.map(creator => sanitizeUserData(creator as unknown as Record<string, unknown>));

    const jsonContent = JSON.stringify(sanitizedCreators, null, 2);
    console.log(`[DATA_DUMP] Exported ${creators.length} creators as JSON`);

    return {
      success: true,
      json_content: jsonContent,
      count: creators.length,
    };
  } catch (error) {
    console.error('[DATA_DUMP] Creators JSON export failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown creators export error',
    };
  }
}

/**
 * Export tags as JSON
 */
export async function exportTagsAsJSON(db: D1Database): Promise<{
  success: boolean;
  json_content?: string;
  count?: number;
  error?: string;
}> {
  try {
    console.log('[DATA_DUMP] Exporting tags as JSON...');

    // Aggregate tag key/value pairs from artwork.tags JSON for approved artworks
    const artworksWithTags = await db
      .prepare(
        `
      SELECT id, tags, created_at
      FROM artwork
      WHERE status = 'approved' AND tags IS NOT NULL
    `
      )
      .all();

    if (!artworksWithTags.success) {
      throw new Error('Failed to query artwork tags');
    }

    const tagSet = new Map<string, ExportTagData>();
    (artworksWithTags.results as Array<{ id: string; tags: string; created_at: string }>).forEach(
      (row) => {
        try {
          const parsed = JSON.parse(row.tags || '{}') as Record<string, unknown>;
          for (const [label, value] of Object.entries(parsed)) {
            if (value === undefined || value === null) continue;
            // Skip internal keys
            if (label.startsWith('_')) continue;
            const valStr = Array.isArray(value) ? JSON.stringify(value) : String(value);
            const key = `${label}::${valStr}`;
            if (!tagSet.has(key)) {
              tagSet.set(key, {
                id: `${row.id}-${label}`,
                label,
                value: valStr,
                created_at: row.created_at,
              });
            }
          }
        } catch (e) {
          console.warn(`[DATA_DUMP] Failed to parse artwork.tags for ${row.id}:`, e);
        }
      }
    );

    const tags: ExportTagData[] = Array.from(tagSet.values()).sort((a, b) => {
      if (a.label === b.label) return a.value.localeCompare(b.value);
      return a.label.localeCompare(b.label);
    });

    // Sanitize tag data
  const sanitizedTags = tags.map(tag => sanitizeUserData(tag as unknown as Record<string, unknown>));

    const jsonContent = JSON.stringify(sanitizedTags, null, 2);
    console.log(`[DATA_DUMP] Exported ${tags.length} tags as JSON (from artwork JSON)`);

    return {
      success: true,
      json_content: jsonContent,
      count: tags.length,
    };
  } catch (error) {
    console.error('[DATA_DUMP] Tags JSON export failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown tags export error',
    };
  }
}

/**
 * Export artwork-creator relationships as JSON
 */
export async function exportArtworkCreatorsAsJSON(db: D1Database): Promise<{
  success: boolean;
  json_content?: string;
  count?: number;
  error?: string;
}> {
  try {
    console.log('[DATA_DUMP] Exporting artwork-creator relationships as JSON...');

    // Get relationships for approved artwork only
    const relationshipsQuery = await db
      .prepare(
        `
      SELECT ac.artwork_id, ac.creator_id, ac.role, ac.created_at
      FROM artwork_creators ac
      INNER JOIN artwork a ON ac.artwork_id = a.id
      WHERE a.status = 'approved'
      ORDER BY ac.created_at DESC
    `
      )
      .all();

    if (!relationshipsQuery.success) {
      throw new Error('Failed to query artwork-creator relationships');
    }

    const relationships: ExportArtworkCreatorData[] = (relationshipsQuery.results as Array<{
      artwork_id: string; creator_id: string; role: string; created_at: string;
    }>).map(
      (row) => ({
        artwork_id: row.artwork_id,
        creator_id: row.creator_id,
        role: row.role,
        created_at: row.created_at,
      })
    );

    // Sanitize relationship data
  const sanitizedRelationships = relationships.map(rel => sanitizeUserData(rel as unknown as Record<string, unknown>));

    const jsonContent = JSON.stringify(sanitizedRelationships, null, 2);
    console.log(
      `[DATA_DUMP] Exported ${relationships.length} artwork-creator relationships as JSON`
    );

    return {
      success: true,
      json_content: jsonContent,
      count: relationships.length,
    };
  } catch (error) {
    console.error('[DATA_DUMP] Artwork-creators JSON export failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown relationships export error',
    };
  }
}

/**
 * Collect thumbnail photos for approved artwork only
 */
export async function collectThumbnailPhotos(
  env: WorkerEnv,
  approvedArtwork: ExportArtworkData[]
): Promise<{
  success: boolean;
  photos?: ArchiveFile[];
  total_count?: number;
  total_size?: number;
  error?: string;
  warnings?: string[];
}> {
  try {
    console.log('[DATA_DUMP] Starting thumbnail photo collection...');
    const startTime = Date.now();

    if (!env.PHOTOS_BUCKET) {
      throw new Error('PHOTOS_BUCKET not configured');
    }

    const photos: ArchiveFile[] = [];
    let totalSize = 0;
    const warnings: string[] = [];

    // Collect photo URLs from approved artwork
    const photoUrls = new Set<string>();
    for (const artwork of approvedArtwork) {
      if (artwork.photos && Array.isArray(artwork.photos)) {
        for (const photoUrl of artwork.photos) {
          // Only include thumbnails (800px versions)
          if (photoUrl.includes('_800') || photoUrl.includes('thumbnail')) {
            photoUrls.add(photoUrl);
          }
        }
      }
    }

    console.log(`[DATA_DUMP] Found ${photoUrls.size} thumbnail URLs to collect`);

    // Download each thumbnail photo
    for (const photoUrl of photoUrls) {
      try {
        // Extract the R2 key from the URL
        // Assuming URL format like: https://photos.domain.com/photos/thumbnails/artwork_123_800.jpg
        const urlPath = new URL(photoUrl).pathname;
        const r2Key = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;

        console.log(`[DATA_DUMP] Processing thumbnail: ${r2Key}`);

        // Get the object from R2
        const r2Object = await env.PHOTOS_BUCKET.get(r2Key);

        if (!r2Object) {
          warnings.push(`Failed to download thumbnail: ${photoUrl}`);
          continue;
        }

        // Get the content as ArrayBuffer
        const content = await r2Object.arrayBuffer();

        // Determine content type from file extension
        const getContentType = (key: string): string => {
          const ext = key.split('.').pop()?.toLowerCase();
          switch (ext) {
            case 'jpg':
            case 'jpeg':
              return 'image/jpeg';
            case 'png':
              return 'image/png';
            case 'webp':
              return 'image/webp';
            default:
              return 'image/jpeg'; // Default fallback
          }
        };

        photos.push({
          path: `photos/thumbnails/${r2Key.split('/').pop() || r2Key}`,
          content,
          mimeType: getContentType(r2Key),
          lastModified: new Date(),
        });

        totalSize += content.byteLength;
      } catch (photoError) {
        console.warn(`[DATA_DUMP] Warning: Failed to process thumbnail ${photoUrl}:`, photoError);
        warnings.push(`Failed to process thumbnail ${photoUrl}: ${photoError}`);
      }
    }

    const endTime = Date.now();
    console.log(`[DATA_DUMP] Thumbnail collection completed in ${endTime - startTime}ms`);
    console.log(
      `[DATA_DUMP] Collected ${photos.length} thumbnails, total size: ${totalSize} bytes`
    );

    if (warnings.length > 0) {
      console.warn(`[DATA_DUMP] Thumbnail collection completed with ${warnings.length} warnings`);
    }

    const result: {
      success: true;
      photos: ArchiveFile[];
      total_count: number;
      total_size: number;
      error?: string;
      warnings?: string[];
    } = {
      success: true,
      photos,
      total_count: photos.length,
      total_size: totalSize,
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  } catch (error) {
    console.error('[DATA_DUMP] Thumbnail photo collection failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown photo collection error',
    };
  }
}

/**
 * Generate CC0 license text
 */
export function generateCC0License(): string {
  return `CC0 1.0 Universal (CC0 1.0)
Public Domain Dedication

This work has been identified as being free of known restrictions under copyright
law, including all related and neighboring rights.

You can copy, modify, distribute and perform the work, even for commercial purposes,
all without asking permission.

DISCLAIMER:
The person who associated a work with this deed has dedicated the work to the public
domain by waiving all of his or her rights to the work worldwide under copyright law,
including all related and neighboring rights, to the extent allowed by law.

You can copy, modify, distribute and perform the work, even for commercial purposes,
all without asking permission.

Unless expressly stated otherwise, the person who identified the work makes no
warranties about the work, and disclaims liability for all uses of the work, to the
fullest extent permitted by applicable law.

When using or citing the work, you should not imply endorsement by the author or
the affirmer.

For more information: https://creativecommons.org/publicdomain/zero/1.0/
`;
}

/**
 * Generate data dump README content
 */
export function generateDataDumpReadme(metadata: DataDumpMetadata): string {
  return `# Cultural Archiver Public Data Dump

## Overview

This data dump contains public artwork information from the Cultural Archiver platform,
released under the CC0 1.0 Universal Public Domain Dedication. This means you can use
this data for any purpose without restrictions.

## Data Information

- **Generated**: ${metadata.generated_at}
- **Version**: ${metadata.version}
- **License**: ${metadata.license}
- **Source**: ${metadata.source}

## Dataset Contents

### Statistics
- **Total Artworks**: ${metadata.data_info.total_artworks.toLocaleString()}
- **Total Creators**: ${metadata.data_info.total_creators.toLocaleString()}
- **Total Tags**: ${metadata.data_info.total_tags.toLocaleString()}
- **Total Photos**: ${metadata.data_info.total_photos.toLocaleString()}

### Data Files

${Object.entries(metadata.file_structure)
  .map(([file, description]) => `- **${file}**: ${description}`)
  .join('\n')}

### Photos
- Contains thumbnail images (800px) for approved artwork
- All photos are in JPEG, PNG, or WebP format
- Original photo metadata may be preserved where available

## Data Filtering

This public dataset includes only:
- Artwork with "approved" status
- Public metadata fields only
- Thumbnail-sized photos (not full resolution originals)

The following sensitive information is **excluded**:
- User tokens, email addresses, and personal identifiers
- IP addresses and session data
- Moderation notes and admin comments  
- Rate limiting and security data
- Rejected or pending submissions

## File Formats

All data files are in JSON format with UTF-8 encoding. The JSON is formatted with
proper indentation for readability.

### Schema Information

#### artwork.json
Each artwork record contains:
- \`id\`: Unique artwork identifier
- \`lat\`, \`lon\`: Artwork location coordinates  
- \`type_id\`: Artwork type/category identifier
- \`created_at\`: Timestamp when artwork was added
- \`tags\`: Key-value metadata (materials, style, etc.)
- \`photos\`: Array of thumbnail photo URLs
- \`type_name\`: Human-readable artwork type

#### creators.json
Each creator record contains:
- \`id\`: Unique creator identifier
- \`name\`: Creator name
- \`bio\`: Creator biography (optional)
- \`created_at\`: Timestamp when creator was added

#### tags.json
Each tag record contains:
- \`id\`: Unique tag identifier
- \`label\`: Tag category (e.g., "material", "style")
- \`value\`: Tag value (e.g., "bronze", "modern")
- \`created_at\`: Timestamp when tag was created

#### artwork_creators.json
Each relationship record contains:
- \`artwork_id\`: Reference to artwork
- \`creator_id\`: Reference to creator
- \`role\`: Creator's role (e.g., "artist", "architect")
- \`created_at\`: Timestamp when relationship was established

## Usage Examples

### Research Applications
- Academic research on public art distribution and patterns
- Urban planning and cultural mapping studies
- Art history and cultural heritage documentation

### Developer Applications
- Building complementary mapping or discovery applications
- Creating art recommendation systems
- Developing cultural tourism tools

### Data Analysis
- Geographic analysis of public art placement
- Temporal trends in public art installation
- Material and style analysis across different regions

## Attribution

While not required by the CC0 license, we appreciate attribution when possible:

"Data sourced from Cultural Archiver (${metadata.source}) - ${metadata.generated_at}"

## Data Quality Notes

- Geographic coordinates are provided as-is from user submissions
- Photo availability may vary between artworks
- Some artwork may have incomplete metadata depending on submission quality
- Creator information is based on user-provided data and may require verification

## Updates

This is a point-in-time snapshot of the Cultural Archiver database. For the most
current information, visit the live platform at the source URL above.

New data dumps may be generated periodically. Check the generation timestamp to
determine the recency of this dataset.

## Support

For questions about this dataset or the Cultural Archiver platform:
- Review the platform documentation
- Check the API documentation for integration options
- Contact the platform maintainers through the official channels

## Technical Details

- Archive format: ZIP with JSON files and photo directory
- Character encoding: UTF-8
- Coordinate system: WGS84 (latitude/longitude)
- Photo formats: JPEG, PNG, WebP
- JSON formatting: Pretty-printed with 2-space indentation

---

Generated by Cultural Archiver Data Dump System v${metadata.version}
Licensed under CC0 1.0 Universal Public Domain Dedication
`;
}

/**
 * Create complete data dump archive
 */
export async function createDataDumpArchive(
  artworkJson: string,
  creatorsJson: string,
  tagsJson: string,
  artworkCreatorsJson: string,
  photos: ArchiveFile[],
  metadata: DataDumpMetadata
): Promise<ArrayBuffer> {
  try {
    console.log('[DATA_DUMP] Creating data dump archive...');
    const startTime = Date.now();

    const archiveFiles: ArchiveFile[] = [
      // License
      {
        path: 'LICENSE.txt',
        content: generateCC0License(),
        mimeType: 'text/plain',
        lastModified: new Date(),
      },

      // README
      {
        path: 'README.md',
        content: generateDataDumpReadme(metadata),
        mimeType: 'text/markdown',
        lastModified: new Date(),
      },

      // Data files
      {
        path: 'artwork.json',
        content: artworkJson,
        mimeType: 'application/json',
        lastModified: new Date(),
      },
      {
        path: 'creators.json',
        content: creatorsJson,
        mimeType: 'application/json',
        lastModified: new Date(),
      },
      {
        path: 'tags.json',
        content: tagsJson,
        mimeType: 'application/json',
        lastModified: new Date(),
      },
      {
        path: 'artwork_creators.json',
        content: artworkCreatorsJson,
        mimeType: 'application/json',
        lastModified: new Date(),
      },

      // Metadata
      {
        path: 'metadata.json',
        content: JSON.stringify(metadata, null, 2),
        mimeType: 'application/json',
        lastModified: new Date(),
      },
    ];

    // Add all thumbnail photos
    archiveFiles.push(...photos);

    console.log(`[DATA_DUMP] Creating archive with ${archiveFiles.length} files...`);

    // Create the ZIP archive
    const result = await createZipArchive(archiveFiles, {
      compression: true,
      maxSize: MAX_DATA_DUMP_SIZE,
    });

    const endTime = Date.now();
    console.log(`[DATA_DUMP] Data dump archive created in ${endTime - startTime}ms`);
    console.log(`[DATA_DUMP] Archive size: ${result.totalSize} bytes (${result.totalFiles} files)`);

    return result.archiveBuffer;
  } catch (error) {
    console.error('[DATA_DUMP] Data dump archive creation failed:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to create data dump archive', 'DATA_DUMP_ARCHIVE_FAILED', 500, {
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

/**
 * Main data dump generation function
 */
export async function generatePublicDataDump(env: WorkerEnv): Promise<DataDumpResult> {
  const warnings: string[] = [];

  try {
    console.log('[DATA_DUMP] Starting public data dump generation...');
    const overallStartTime = Date.now();

    // Step 1: Export artwork data
    const artworkResult = await exportArtworkAsJSON(env.DB);
    if (!artworkResult.success) {
      return {
        success: false,
        error: `Artwork export failed: ${artworkResult.error}`,
      };
    }

    // Step 2: Export creators data
    const creatorsResult = await exportCreatorsAsJSON(env.DB);
    if (!creatorsResult.success) {
      return {
        success: false,
        error: `Creators export failed: ${creatorsResult.error}`,
      };
    }

    // Step 3: Export tags data
    const tagsResult = await exportTagsAsJSON(env.DB);
    if (!tagsResult.success) {
      return {
        success: false,
        error: `Tags export failed: ${tagsResult.error}`,
      };
    }

    // Step 4: Export artwork-creator relationships
    const relationshipsResult = await exportArtworkCreatorsAsJSON(env.DB);
    if (!relationshipsResult.success) {
      return {
        success: false,
        error: `Relationships export failed: ${relationshipsResult.error}`,
      };
    }

    // Step 5: Collect thumbnail photos
    const artworkData = await filterApprovedArtwork(env.DB);
    const photoResult = await collectThumbnailPhotos(env, artworkData.artworks || []);
    if (!photoResult.success) {
      return {
        success: false,
        error: `Photo collection failed: ${photoResult.error}`,
      };
    }

    if (photoResult.warnings && photoResult.warnings.length > 0) {
      warnings.push(...photoResult.warnings);
    }

    // Step 6: Generate metadata
    const metadata: DataDumpMetadata = {
      version: DATA_DUMP_VERSION,
      generated_at: new Date().toISOString(),
      license: 'CC0',
      source: 'Cultural Archiver',
      description: 'Public artwork data from Cultural Archiver platform',
      data_info: {
        total_artworks: artworkResult.count || 0,
        total_creators: creatorsResult.count || 0,
        total_tags: tagsResult.count || 0,
        total_photos: photoResult.total_count || 0,
      },
      filter_info: {
        status_filter: 'approved',
        excluded_fields: Object.keys(SENSITIVE_FIELDS),
        photo_types: 'thumbnails_only',
      },
      file_structure: {
        'LICENSE.txt': 'CC0 1.0 Universal Public Domain Dedication',
        'README.md': 'Dataset documentation and usage guide',
        'artwork.json': 'Approved public artwork records with location and metadata',
        'creators.json': 'Artist and creator information',
        'tags.json': 'Structured metadata tags for categorization',
        'artwork_creators.json': 'Relationships between artworks and their creators',
        'photos/thumbnails/': 'Thumbnail photos (800px) for approved artwork',
        'metadata.json': 'Technical metadata about this dataset',
      },
    };

    // Step 7: Create archive
    const archiveBuffer = await createDataDumpArchive(
      artworkResult.json_content!,
      creatorsResult.json_content!,
      tagsResult.json_content!,
      relationshipsResult.json_content!,
      photoResult.photos!,
      metadata
    );

    // Generate filename with date (not time for public dumps)
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
    const filename = `datadump-${date}.zip`;

    const overallEndTime = Date.now();
    console.log(`[DATA_DUMP] Public data dump completed in ${overallEndTime - overallStartTime}ms`);
    console.log(`[DATA_DUMP] Data dump file: ${filename} (${archiveBuffer.byteLength} bytes)`);

    const successResult: DataDumpResult = {
      success: true,
      data_dump_file: archiveBuffer,
      filename,
      metadata,
      size: archiveBuffer.byteLength,
    };

    if (warnings.length > 0) {
      successResult.warnings = warnings;
    }

    return successResult;
  } catch (error) {
    console.error('[DATA_DUMP] Public data dump failed:', error);

    const errorResult: DataDumpResult = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown data dump error',
    };

    if (warnings.length > 0) {
      errorResult.warnings = warnings;
    }

    return errorResult;
  }
}
