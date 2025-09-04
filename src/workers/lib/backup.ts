/**
 * Backup system for complete database and R2 photo backup
 * Provides disaster recovery capabilities with full system state preservation
 */

import type { WorkerEnv } from '../types';
import { ApiError } from './errors';
import { createZipArchive, type ArchiveFile } from './archive';

// Configuration constants
const MAX_BACKUP_SIZE = 1024 * 1024 * 1024; // 1GB limit for backup files
const BACKUP_VERSION = '1.0.0';

/**
 * Backup metadata information
 */
export interface BackupMetadata {
  version: string;
  created_at: string;
  database_info: {
    tables: string[];
    total_records: number;
    size_estimate: number;
  };
  photos_info: {
    total_photos: number;
    originals_count: number;
    thumbnails_count: number;
    total_size: number;
  };
  backup_type: 'full' | 'incremental';
  generator: string;
}

/**
 * Backup generation result
 */
export interface BackupResult {
  success: boolean;
  backup_file?: ArrayBuffer;
  filename?: string;
  metadata?: BackupMetadata;
  size?: number;
  error?: string;
  warnings?: string[];
}

/**
 * Database dump result
 */
export interface DatabaseDumpResult {
  success: boolean;
  sql_dump?: string;
  tables?: string[];
  total_records?: number;
  error?: string;
}

/**
 * R2 photo collection result
 */
export interface PhotoCollectionResult {
  success: boolean;
  photos?: ArchiveFile[];
  originals_count?: number;
  thumbnails_count?: number;
  total_size?: number;
  error?: string;
  warnings?: string[];
}

/**
 * Generate complete database dump with all tables and data
 */
export async function generateDatabaseDump(db: D1Database): Promise<DatabaseDumpResult> {
  try {
    console.log('[BACKUP] Starting database dump generation...');
    const startTime = Date.now();

    // Get list of tables
    const tablesResult = await db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' 
      ORDER BY name
    `).all();

    if (!tablesResult.success) {
      throw new Error('Failed to retrieve database tables');
    }

    const tables = tablesResult.results.map((row: any) => row.name);
    console.log(`[BACKUP] Found ${tables.length} tables:`, tables);

    let sqlDump = '';
    let totalRecords = 0;

    // Add header comments
    sqlDump += `-- Cultural Archiver Database Backup\n`;
    sqlDump += `-- Generated: ${new Date().toISOString()}\n`;
    sqlDump += `-- Version: ${BACKUP_VERSION}\n`;
    sqlDump += `-- Tables: ${tables.join(', ')}\n\n`;

    // Add pragmas for better restore reliability
    sqlDump += `PRAGMA foreign_keys = OFF;\n`;
    sqlDump += `BEGIN TRANSACTION;\n\n`;

    // Generate schema and data for each table
    for (const tableName of tables) {
      console.log(`[BACKUP] Processing table: ${tableName}`);

      try {
        // Get table schema
        const schemaResult = await db.prepare(`
          SELECT sql FROM sqlite_master 
          WHERE type='table' AND name = ? AND sql IS NOT NULL
        `).bind(tableName).first();

        if (schemaResult?.sql) {
          sqlDump += `-- Table structure for ${tableName}\n`;
          sqlDump += `DROP TABLE IF EXISTS ${tableName};\n`;
          sqlDump += `${schemaResult.sql};\n\n`;
        }

        // Get table data
        const dataResult = await db.prepare(`SELECT * FROM ${tableName}`).all();
        
        if (dataResult.success && dataResult.results.length > 0) {
          console.log(`[BACKUP] Table ${tableName}: ${dataResult.results.length} records`);
          totalRecords += dataResult.results.length;

          sqlDump += `-- Data for table ${tableName}\n`;
          
          // Get column names
          const firstRow = dataResult.results[0] as Record<string, any>;
          const columns = Object.keys(firstRow);
          
          // Generate INSERT statements in batches for better performance
          const batchSize = 100;
          for (let i = 0; i < dataResult.results.length; i += batchSize) {
            const batch = dataResult.results.slice(i, i + batchSize);
            
            for (const row of batch) {
              const values = columns.map(col => {
                const value = row[col];
                if (value === null || value === undefined) {
                  return 'NULL';
                } else if (typeof value === 'string') {
                  // Escape single quotes in strings
                  return `'${value.replace(/'/g, "''")}'`;
                } else if (typeof value === 'number') {
                  return value.toString();
                } else {
                  // For other types (objects, arrays), convert to JSON string
                  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
                }
              });
              
              sqlDump += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            }
          }
          sqlDump += '\n';
        } else {
          console.log(`[BACKUP] Table ${tableName}: empty or no data`);
        }
      } catch (tableError) {
        console.warn(`[BACKUP] Warning: Failed to backup table ${tableName}:`, tableError);
        sqlDump += `-- WARNING: Failed to backup table ${tableName}: ${tableError}\n\n`;
      }
    }

    // Close transaction
    sqlDump += `COMMIT;\n`;
    sqlDump += `PRAGMA foreign_keys = ON;\n\n`;
    sqlDump += `-- Backup completed: ${new Date().toISOString()}\n`;
    sqlDump += `-- Total records: ${totalRecords}\n`;

    const endTime = Date.now();
    console.log(`[BACKUP] Database dump completed in ${endTime - startTime}ms`);
    console.log(`[BACKUP] Dump size: ${sqlDump.length} characters, ${totalRecords} total records`);

    return {
      success: true,
      sql_dump: sqlDump,
      tables,
      total_records: totalRecords,
    };
  } catch (error) {
    console.error('[BACKUP] Database dump failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database dump error',
    };
  }
}

/**
 * Collect all photos from R2 bucket (originals and thumbnails)
 */
export async function collectR2Photos(env: WorkerEnv): Promise<PhotoCollectionResult> {
  try {
    console.log('[BACKUP] Starting R2 photo collection...');
    const startTime = Date.now();

    if (!env.PHOTOS_BUCKET) {
      throw new Error('PHOTOS_BUCKET not configured');
    }

    const photos: ArchiveFile[] = [];
    let originalsCount = 0;
    let thumbnailsCount = 0;
    let totalSize = 0;
    const warnings: string[] = [];

    // List all objects in the bucket
    const listResult = await env.PHOTOS_BUCKET.list();
    console.log(`[BACKUP] Found ${listResult.objects.length} objects in R2 bucket`);

    for (const object of listResult.objects) {
      try {
        console.log(`[BACKUP] Processing: ${object.key} (${object.size} bytes)`);

        // Download the object
        const r2Object = await env.PHOTOS_BUCKET.get(object.key);
        
        if (!r2Object) {
          warnings.push(`Failed to download object: ${object.key}`);
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
            case 'heic':
              return 'image/heic';
            case 'heif':
              return 'image/heif';
            default:
              return 'application/octet-stream';
          }
        };

        photos.push({
          path: `photos/${object.key}`,
          content,
          mimeType: getContentType(object.key),
          lastModified: object.uploaded ? new Date(object.uploaded) : new Date(),
        });

        totalSize += object.size || content.byteLength;

        // Count originals vs thumbnails based on naming convention
        if (object.key.includes('_800') || object.key.includes('thumbnail')) {
          thumbnailsCount++;
        } else {
          originalsCount++;
        }
      } catch (photoError) {
        console.warn(`[BACKUP] Warning: Failed to process photo ${object.key}:`, photoError);
        warnings.push(`Failed to process photo ${object.key}: ${photoError}`);
      }
    }

    const endTime = Date.now();
    console.log(`[BACKUP] R2 photo collection completed in ${endTime - startTime}ms`);
    console.log(`[BACKUP] Collected ${photos.length} photos (${originalsCount} originals, ${thumbnailsCount} thumbnails), total size: ${totalSize} bytes`);

    if (warnings.length > 0) {
      console.warn(`[BACKUP] Photo collection completed with ${warnings.length} warnings`);
    }

    return {
      success: true,
      photos,
      originals_count: originalsCount,
      thumbnails_count: thumbnailsCount,
      total_size: totalSize,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('[BACKUP] R2 photo collection failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown photo collection error',
    };
  }
}

/**
 * Generate backup metadata
 */
export function generateBackupMetadata(
  databaseResult: DatabaseDumpResult,
  photoResult: PhotoCollectionResult
): BackupMetadata {
  return {
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    database_info: {
      tables: databaseResult.tables || [],
      total_records: databaseResult.total_records || 0,
      size_estimate: databaseResult.sql_dump?.length || 0,
    },
    photos_info: {
      total_photos: (photoResult.originals_count || 0) + (photoResult.thumbnails_count || 0),
      originals_count: photoResult.originals_count || 0,
      thumbnails_count: photoResult.thumbnails_count || 0,
      total_size: photoResult.total_size || 0,
    },
    backup_type: 'full',
    generator: 'Cultural Archiver Backup System',
  };
}

/**
 * Create complete backup archive
 */
export async function createBackupArchive(
  databaseDump: string,
  photos: ArchiveFile[],
  metadata: BackupMetadata
): Promise<ArrayBuffer> {
  try {
    console.log('[BACKUP] Creating backup archive...');
    const startTime = Date.now();

    const archiveFiles: ArchiveFile[] = [
      // Database dump
      {
        path: 'database.sql',
        content: databaseDump,
        mimeType: 'application/sql',
        lastModified: new Date(),
      },
      
      // Metadata
      {
        path: 'metadata.json',
        content: JSON.stringify(metadata, null, 2),
        mimeType: 'application/json',
        lastModified: new Date(),
      },
      
      // README for backup restoration
      {
        path: 'README.md',
        content: generateBackupReadme(metadata),
        mimeType: 'text/markdown',
        lastModified: new Date(),
      },
    ];

    // Add all photos
    archiveFiles.push(...photos);

    console.log(`[BACKUP] Creating archive with ${archiveFiles.length} files...`);

    // Create the ZIP archive
    const result = await createZipArchive(archiveFiles, {
      compression: true,
      maxSize: MAX_BACKUP_SIZE,
    });

    const endTime = Date.now();
    console.log(`[BACKUP] Backup archive created in ${endTime - startTime}ms`);
    console.log(`[BACKUP] Archive size: ${result.totalSize} bytes (${result.totalFiles} files)`);

    return result.archiveBuffer;
  } catch (error) {
    console.error('[BACKUP] Backup archive creation failed:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      'Failed to create backup archive',
      'BACKUP_ARCHIVE_FAILED',
      500,
      { details: { error: error instanceof Error ? error.message : 'Unknown error' } }
    );
  }
}

/**
 * Generate README content for backup restoration
 */
function generateBackupReadme(metadata: BackupMetadata): string {
  return `# Cultural Archiver Backup

## Backup Information

- **Created**: ${metadata.created_at}
- **Version**: ${metadata.version}
- **Type**: ${metadata.backup_type}
- **Generator**: ${metadata.generator}

## Contents

### Database
- **Tables**: ${metadata.database_info.tables.join(', ')}
- **Total Records**: ${metadata.database_info.total_records.toLocaleString()}
- **SQL Dump Size**: ${metadata.database_info.size_estimate.toLocaleString()} characters

### Photos
- **Total Photos**: ${metadata.photos_info.total_photos.toLocaleString()}
- **Originals**: ${metadata.photos_info.originals_count.toLocaleString()}
- **Thumbnails**: ${metadata.photos_info.thumbnails_count.toLocaleString()}
- **Total Size**: ${(metadata.photos_info.total_size / (1024 * 1024)).toFixed(2)} MB

## Restoration Instructions

### Database Restoration
1. Extract this backup archive
2. Ensure you have access to a D1 database instance
3. Execute the SQL dump: \`wrangler d1 execute [DATABASE_NAME] --file=database.sql\`
4. Verify data integrity by checking table counts and key records

### Photo Restoration
1. The \`photos/\` directory contains all original and thumbnail images
2. Upload all photos to your R2 bucket preserving the directory structure
3. Ensure proper permissions are set for public photo access
4. Update any CDN or URL configurations as needed

### Verification
- Check that all tables listed above are present in the restored database
- Verify photo counts match the numbers above
- Test a few artwork detail pages to ensure photos are loading correctly
- Run the application health check endpoint to verify system integrity

## Important Notes

- This backup preserves all system data including user tokens, audit trails, and metadata
- Photos maintain their original file names and directory structure
- All timestamps and IDs are preserved exactly as they were at backup time
- Rate limiting data and temporary sessions are included in the backup

## Support

If you encounter issues during restoration, refer to:
- Cultural Archiver documentation: \`docs/backup-data-dump.md\`
- Database schema documentation: \`docs/database.md\`
- API documentation: \`docs/api.md\`

Created by Cultural Archiver Backup System v${metadata.version}
`;
}

/**
 * Main backup generation function
 */
export async function generateFullBackup(env: WorkerEnv): Promise<BackupResult> {
  const warnings: string[] = [];
  
  try {
    console.log('[BACKUP] Starting full system backup...');
    const overallStartTime = Date.now();

    // Step 1: Generate database dump
    const databaseResult = await generateDatabaseDump(env.DB);
    if (!databaseResult.success) {
      return {
        success: false,
        error: `Database dump failed: ${databaseResult.error}`,
      };
    }

    // Step 2: Collect R2 photos
    const photoResult = await collectR2Photos(env);
    if (!photoResult.success) {
      return {
        success: false,
        error: `Photo collection failed: ${photoResult.error}`,
      };
    }

    if (photoResult.warnings && photoResult.warnings.length > 0) {
      warnings.push(...photoResult.warnings);
    }

    // Step 3: Generate metadata
    const metadata = generateBackupMetadata(databaseResult, photoResult);

    // Step 4: Create archive
    const archiveBuffer = await createBackupArchive(
      databaseResult.sql_dump!,
      photoResult.photos!,
      metadata
    );

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-${timestamp}.zip`;

    const overallEndTime = Date.now();
    console.log(`[BACKUP] Full backup completed in ${overallEndTime - overallStartTime}ms`);
    console.log(`[BACKUP] Backup file: ${filename} (${archiveBuffer.byteLength} bytes)`);

    return {
      success: true,
      backup_file: archiveBuffer,
      filename,
      metadata,
      size: archiveBuffer.byteLength,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('[BACKUP] Full backup failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown backup error',
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}