#!/usr/bin/env tsx
/**
 * Cultural Archiver Backup Command
 * Generates complete system backups including database and R2 photos
 * 
 * Usage:
 *   npm run backup [options]
 *   
 * Options:
 *   --output-dir <dir>  Directory to save backup file (default: current directory)
 *   --remote           Use remote Cloudflare resources (default: local development)
 *   --help             Show this help message
 */

import { writeFileSync, existsSync, mkdirSync, createWriteStream } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import archiver from 'archiver';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '..', '.env') });

interface BackupOptions {
  outputDir: string;
  remote: boolean;
  help: boolean;
  photosOnly: boolean;
  photosDir: string;
}

/**
 * Cloudflare API configuration
 */
interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  databaseId: string;
  bucketName: string;
}

/**
 * Database export result
 */
interface DatabaseExportResult {
  success: boolean;
  sqlDump?: string;
  error?: string;
  tables?: string[];
  totalRecords?: number;
}

/**
 * R2 file list result
 */
interface R2File {
  key: string;
  size: number;
  etag: string;
  lastModified: string;
  content?: Buffer;
}

interface R2ListResult {
  success: boolean;
  files?: R2File[];
  error?: string;
  totalFiles?: number;
  totalSize?: number;
}

/**
 * Backup generation result
 */
interface BackupResult {
  success: boolean;
  filename?: string;
  filepath?: string;
  size?: number;
  error?: string;
  metadata?: {
    databaseInfo: {
      tables: string[];
      totalRecords: number;
      size: number;
    };
    photosInfo: {
      totalFiles: number;
      totalSize: number;
    };
    createdAt: string;
    version: string;
  };
}

/**
 * Parse command line arguments
 */
function parseArguments(): BackupOptions {
  const args = process.argv.slice(2);
  const options: BackupOptions = {
    outputDir: process.cwd(),
    remote: false,
    help: false,
    photosOnly: false,
    photosDir: './r2-photos-backup',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--output-dir':
        if (i + 1 < args.length) {
          options.outputDir = resolve(args[++i]);
        } else {
          console.error('Error: --output-dir requires a directory path');
          process.exit(1);
        }
        break;

      case '--photos-dir':
        if (i + 1 < args.length) {
          options.photosDir = resolve(args[++i]);
        } else {
          console.error('Error: --photos-dir requires a directory path');
          process.exit(1);
        }
        break;

      case '--remote':
        options.remote = true;
        break;

      case '--photos-only':
        options.photosOnly = true;
        options.remote = true; // Photos-only mode requires remote access
        break;

      case '--help':
      case '-h':
        options.help = true;
        break;

      default:
        console.error(`Error: Unknown option "${arg}"`);
        process.exit(1);
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
Cultural Archiver Backup Command

USAGE:
  npm run backup [options]

OPTIONS:
  --output-dir <dir>   Directory to save backup file (default: current directory)
  --photos-dir <dir>   Directory to save photos when using --photos-only (default: ./r2-photos-backup)
  --remote             Use remote Cloudflare resources (REQUIRED for real backups)
  --photos-only        Download only photos to local directory (implies --remote)
  --help, -h           Show this help message

EXAMPLES:
  npm run backup -- --help
  npm run backup -- --remote
  npm run backup -- --remote --output-dir ./backups
  npm run backup -- --photos-only --photos-dir ./my-photos

PHOTO-ONLY MODE:
  The --photos-only flag downloads all R2 photos directly to a local directory:
  - Downloads all original and thumbnail images
  - Preserves the original file structure and names
  - Skips files that already exist with the same size
  - Handles large buckets with pagination
  - Creates subdirectories as needed
  - Provides detailed progress and error reporting

ENVIRONMENT VARIABLES:
  The following environment variables must be set for remote backups:
  - CLOUDFLARE_ACCOUNT_ID    Your Cloudflare Account ID
  - CLOUDFLARE_API_TOKEN     Cloudflare API token with D1:Read, R2:Read permissions
  - D1_DATABASE_ID           D1 database ID to backup
  - R2_BUCKET_NAME           R2 bucket name containing photos

  Set these in your .env file (see .env.example for reference).

BACKUP CONTENTS:
  Full backup mode (default):
  ✅ Complete D1 database dump (all tables, data, and schema)
  ✅ All R2 photos (originals and thumbnails) 
  ✅ Metadata with backup statistics and information
  ✅ Restoration instructions and documentation
  ✅ Valid ZIP archive compatible with standard tools

  Photos-only mode (--photos-only):
  ✅ All R2 photos downloaded to local directory
  ✅ Original file structure preserved
  ✅ Duplicate detection and skipping
  ✅ Progress reporting and error handling

NOTES:
  - Backup files are named: backup-YYYY-MM-DD-HHMMSS.zip
  - Remote mode connects to actual Cloudflare D1 and R2 resources
  - Local mode is not yet implemented (use --remote for real backups)
  - Photos-only mode creates a local mirror of your R2 bucket
  - Generated backups include complete restoration instructions
  - Archives can be opened with any standard ZIP tool

REQUIREMENTS:
  - Node.js with Cloudflare API access
  - Valid Cloudflare credentials with appropriate permissions
  - D1 database and R2 bucket must exist and be accessible
`);
}

/**
 * Get Cloudflare configuration from environment
 */
function getCloudflareConfig(): CloudflareConfig {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const databaseId = process.env.D1_DATABASE_ID;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !apiToken || !databaseId || !bucketName) {
    throw new Error('Missing required Cloudflare environment variables');
  }

  return {
    accountId,
    apiToken,
    databaseId,
    bucketName,
  };
}

/**
 * Export D1 database using Cloudflare API
 */
async function exportD1Database(config: CloudflareConfig): Promise<DatabaseExportResult> {
  try {
    console.log('📊 Exporting D1 database...');

    // First, get the list of tables
    const tablesResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        }),
      }
    );

    if (!tablesResponse.ok) {
      const error = await tablesResponse.text();
      throw new Error(`Failed to fetch tables: ${tablesResponse.status} ${error}`);
    }

    const tablesResult = await tablesResponse.json();
    if (!tablesResult.success || !tablesResult.result?.[0]?.results) {
      throw new Error('Failed to retrieve database tables');
    }

    const tables = tablesResult.result[0].results.map((row: any) => row.name);
    console.log(`   Found ${tables.length} tables: ${tables.join(', ')}`);

    let sqlDump = '';
    let totalRecords = 0;

    // Add header comments
    sqlDump += `-- Cultural Archiver Database Backup\n`;
    sqlDump += `-- Generated: ${new Date().toISOString()}\n`;
    sqlDump += `-- Tables: ${tables.join(', ')}\n\n`;
    sqlDump += `PRAGMA foreign_keys = OFF;\n`;
    sqlDump += `BEGIN TRANSACTION;\n\n`;

    // Export each table
    for (const tableName of tables) {
      console.log(`   Exporting table: ${tableName}`);

      // Get table schema
      const schemaResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sql: `SELECT sql FROM sqlite_master WHERE type='table' AND name = '${tableName}' AND sql IS NOT NULL`,
          }),
        }
      );

      if (!schemaResponse.ok) {
        console.warn(`   Warning: Failed to get schema for table ${tableName}`);
        continue;
      }

      const schemaResult = await schemaResponse.json();
      if (schemaResult.success && schemaResult.result?.[0]?.results?.[0]?.sql) {
        sqlDump += `-- Table structure for ${tableName}\n`;
        sqlDump += `DROP TABLE IF EXISTS ${tableName};\n`;
        sqlDump += `${schemaResult.result[0].results[0].sql};\n\n`;
      }

      // Get table data
      const dataResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sql: `SELECT * FROM ${tableName}`,
          }),
        }
      );

      if (!dataResponse.ok) {
        console.warn(`   Warning: Failed to get data for table ${tableName}`);
        continue;
      }

      const dataResult = await dataResponse.json();
      if (dataResult.success && dataResult.result?.[0]?.results?.length > 0) {
        const rows = dataResult.result[0].results;
        const recordCount = rows.length;
        totalRecords += recordCount;

        console.log(`   Table ${tableName}: ${recordCount} records`);
        sqlDump += `-- Data for table ${tableName}\n`;

        // Get column names from first row
        const columns = Object.keys(rows[0]);

        // Generate INSERT statements
        for (const row of rows) {
          const values = columns.map(col => {
            const value = row[col];
            if (value === null || value === undefined) {
              return 'NULL';
            } else if (typeof value === 'string') {
              return `'${value.replace(/'/g, "''")}'`;
            } else if (typeof value === 'number') {
              return value.toString();
            } else {
              return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
            }
          });

          sqlDump += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sqlDump += '\n';
      } else {
        console.log(`   Table ${tableName}: empty or no data`);
      }
    }

    // Close transaction
    sqlDump += `COMMIT;\n`;
    sqlDump += `PRAGMA foreign_keys = ON;\n\n`;
    sqlDump += `-- Backup completed: ${new Date().toISOString()}\n`;
    sqlDump += `-- Total records: ${totalRecords}\n`;

    console.log(`   Database export completed: ${sqlDump.length} characters, ${totalRecords} records`);

    return {
      success: true,
      sqlDump,
      tables,
      totalRecords,
    };
  } catch (error) {
    console.error('❌ Database export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database export error',
    };
  }
}

/**
 * List and download all files from R2 bucket
 */
async function downloadR2Files(config: CloudflareConfig): Promise<R2ListResult> {
  try {
    console.log('📸 Downloading R2 photos...');

    const files: R2File[] = [];
    let continuationToken: string | undefined;
    let totalSize = 0;

    do {
      // List objects in bucket
      const listUrl = new URL(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucketName}/objects`);
      if (continuationToken) {
        listUrl.searchParams.set('cursor', continuationToken);
      }

      const listResponse = await fetch(listUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
        },
      });

      if (!listResponse.ok) {
        const error = await listResponse.text();
        throw new Error(`Failed to list R2 objects: ${listResponse.status} ${error}`);
      }

      const listResult = await listResponse.json();
      if (!listResult.success) {
        throw new Error(`R2 list failed: ${JSON.stringify(listResult.errors)}`);
      }

      const objects = listResult.result?.objects || [];
      console.log(`   Found ${objects.length} objects in this batch`);

      // Download each object
      for (const obj of objects) {
        console.log(`   Downloading: ${obj.key} (${obj.size} bytes)`);

        try {
          const downloadResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucketName}/objects/${encodeURIComponent(obj.key)}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${config.apiToken}`,
              },
            }
          );

          if (!downloadResponse.ok) {
            console.warn(`   Warning: Failed to download ${obj.key}: ${downloadResponse.status}`);
            continue;
          }

          const content = Buffer.from(await downloadResponse.arrayBuffer());

          files.push({
            key: obj.key,
            size: obj.size || content.length,
            etag: obj.etag,
            lastModified: obj.uploaded,
            content,
          });

          totalSize += obj.size || content.length;
        } catch (downloadError) {
          console.warn(`   Warning: Failed to download ${obj.key}:`, downloadError);
        }
      }

      continuationToken = listResult.result?.cursor;
    } while (continuationToken);

    console.log(`   R2 download completed: ${files.length} files, ${totalSize} bytes total`);

    return {
      success: true,
      files,
      totalFiles: files.length,
      totalSize,
    };
  } catch (error) {
    console.error('❌ R2 download failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown R2 download error',
    };
  }
}

/**
 * Download all photos from R2 bucket to a local directory
 * This creates a local backup of all photo files with their original structure
 */
export interface R2LocalDownloadResult {
  success: boolean;
  localDirectory?: string;
  totalFiles?: number;
  totalSize?: number;
  downloadedFiles?: string[];
  skippedFiles?: string[];
  error?: string;
  warnings?: string[];
}

export async function downloadR2PhotosToDirectory(
  config: CloudflareConfig, 
  localDirectory: string = './r2-photos-backup'
): Promise<R2LocalDownloadResult> {
  try {
    console.log(`📸 Downloading R2 photos to local directory: ${localDirectory}`);
    console.log(`🔧 Using bucket: ${config.bucketName}`);

    // Create the local directory if it doesn't exist
    const fullPath = resolve(localDirectory);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      console.log(`   Created directory: ${fullPath}`);
    }

    const downloadedFiles: string[] = [];
    const skippedFiles: string[] = [];
    const warnings: string[] = [];
    let continuationToken: string | undefined;
    let totalSize = 0;
    let totalFiles = 0;

    do {
      // List objects in bucket with pagination
      const listUrl = new URL(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucketName}/objects`);
      if (continuationToken) {
        listUrl.searchParams.set('cursor', continuationToken);
      }
      listUrl.searchParams.set('per_page', '1000'); // Maximum items per page

      const listResponse = await fetch(listUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!listResponse.ok) {
        const error = await listResponse.text();
        throw new Error(`Failed to list R2 objects: ${listResponse.status} ${error}`);
      }

      const listResult = await listResponse.json();
      if (!listResult.success) {
        throw new Error(`R2 list failed: ${JSON.stringify(listResult.errors || listResult.messages)}`);
      }

      const objects = listResult.result?.objects || [];
      console.log(`   Processing batch: ${objects.length} objects`);

      // Process each object in the batch
      for (const obj of objects) {
        totalFiles++;
        const fileName = obj.key;
        const localFilePath = join(fullPath, fileName);
        
        try {
          // Create subdirectories if the key contains path separators
          const localFileDir = dirname(localFilePath);
          if (!existsSync(localFileDir)) {
            mkdirSync(localFileDir, { recursive: true });
          }

          // Check if file already exists and has the same size
          if (existsSync(localFilePath)) {
            const stats = await import('fs').then(fs => fs.promises.stat(localFilePath));
            if (stats.size === obj.size) {
              console.log(`   Skipping (exists): ${fileName} (${obj.size} bytes)`);
              skippedFiles.push(fileName);
              continue;
            }
          }

          console.log(`   Downloading: ${fileName} (${obj.size} bytes)`);

          // Download the object from R2
          const downloadResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucketName}/objects/${encodeURIComponent(obj.key)}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${config.apiToken}`,
              },
            }
          );

          if (!downloadResponse.ok) {
            const errorText = await downloadResponse.text();
            warnings.push(`Failed to download ${fileName}: ${downloadResponse.status} ${errorText}`);
            console.warn(`   Warning: Failed to download ${fileName}: ${downloadResponse.status}`);
            skippedFiles.push(fileName);
            continue;
          }

          // Get file content
          const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());
          
          // Write to local file
          writeFileSync(localFilePath, fileBuffer);
          
          downloadedFiles.push(fileName);
          totalSize += obj.size || fileBuffer.length;
          
          console.log(`   Saved: ${localFilePath} (${formatFileSize(obj.size || fileBuffer.length)})`);
        } catch (downloadError) {
          const errorMsg = `Failed to process ${fileName}: ${downloadError}`;
          warnings.push(errorMsg);
          console.warn(`   Warning: ${errorMsg}`);
          skippedFiles.push(fileName);
        }
      }

      // Handle pagination
      continuationToken = listResult.result?.cursor;
      if (continuationToken) {
        console.log(`   Continuing with next batch (cursor: ${continuationToken.substring(0, 20)}...)`);
      }
    } while (continuationToken);

    console.log('\n' + '='.repeat(50));
    console.log('📸 R2 PHOTO DOWNLOAD COMPLETED');
    console.log('='.repeat(50));
    console.log(`Local Directory: ${fullPath}`);
    console.log(`Total Files Processed: ${totalFiles}`);
    console.log(`Downloaded: ${downloadedFiles.length} files`);
    console.log(`Skipped: ${skippedFiles.length} files`);
    console.log(`Total Size: ${formatFileSize(totalSize)}`);
    
    if (warnings.length > 0) {
      console.log(`Warnings: ${warnings.length}`);
      console.log('='.repeat(50));
    }

    return {
      success: true,
      localDirectory: fullPath,
      totalFiles: downloadedFiles.length,
      totalSize,
      downloadedFiles,
      skippedFiles: skippedFiles.length > 0 ? skippedFiles : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('❌ R2 local download failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown R2 local download error',
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

/**
 * Create backup ZIP archive
 */
async function createBackupArchive(
  outputDir: string,
  databaseResult: DatabaseExportResult,
  r2Result: R2ListResult
): Promise<BackupResult> {
  return new Promise((resolve) => {
    const timestamp = generateTimestamp();
    const filename = `backup-${timestamp}.zip`;
    const filepath = join(outputDir, filename);

    console.log('📦 Creating backup archive...');

    const output = createWriteStream(filepath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Best compression
    });

    output.on('close', () => {
      const metadata = {
        databaseInfo: {
          tables: databaseResult.tables || [],
          totalRecords: databaseResult.totalRecords || 0,
          size: databaseResult.sqlDump?.length || 0,
        },
        photosInfo: {
          totalFiles: r2Result.totalFiles || 0,
          totalSize: r2Result.totalSize || 0,
        },
        createdAt: new Date().toISOString(),
        version: '1.0.0',
      };

      console.log(`   Archive created: ${filename}`);
      console.log(`   Archive size: ${formatFileSize(archive.pointer())}`);

      resolve({
        success: true,
        filename,
        filepath,
        size: archive.pointer(),
        metadata,
      });
    });

    output.on('error', (error) => {
      console.error('❌ Archive creation failed:', error);
      resolve({
        success: false,
        error: error.message,
      });
    });

    archive.on('warning', (warning) => {
      console.warn('⚠️ Archive warning:', warning);
    });

    archive.on('error', (error) => {
      console.error('❌ Archive error:', error);
      resolve({
        success: false,
        error: error.message,
      });
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Add database dump
    if (databaseResult.sqlDump) {
      archive.append(databaseResult.sqlDump, { name: 'database.sql' });
      console.log('   Added: database.sql');
    }

    // Add metadata
    const metadata = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      database_info: {
        tables: databaseResult.tables || [],
        total_records: databaseResult.totalRecords || 0,
        size_estimate: databaseResult.sqlDump?.length || 0,
      },
      photos_info: {
        total_photos: r2Result.totalFiles || 0,
        total_size: r2Result.totalSize || 0,
      },
      backup_type: 'full' as const,
      generator: 'Cultural Archiver Backup System',
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
    console.log('   Added: metadata.json');

    // Add README
    const readme = generateBackupReadme(metadata);
    archive.append(readme, { name: 'README.md' });
    console.log('   Added: README.md');

    // Add R2 files
    if (r2Result.files && r2Result.files.length > 0) {
      for (const file of r2Result.files) {
        if (file.content) {
          const pathInArchive = `photos/${file.key}`;
          archive.append(file.content, { 
            name: pathInArchive,
            date: new Date(file.lastModified),
          });
          console.log(`   Added: ${pathInArchive} (${formatFileSize(file.size)})`);
        }
      }
    }

    // Finalize the archive
    archive.finalize();
  });
}

/**
 * Generate README content for backup restoration
 */
function generateBackupReadme(metadata: any): string {
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
 * Validate environment configuration
 */
function validateEnvironment(options: BackupOptions): void {
  if (options.remote) {
    const requiredVars = [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'D1_DATABASE_ID',
      'R2_BUCKET_NAME'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.error('Error: Missing required environment variables for remote backup:');
      missing.forEach(varName => console.error(`  - ${varName}`));
      console.error('\nPlease set these variables in your .env file or environment.');
      console.error('See .env.example for reference.');
      process.exit(1);
    }
  }

  // Validate output directory
  if (!existsSync(options.outputDir)) {
    try {
      mkdirSync(options.outputDir, { recursive: true });
      console.log(`Created output directory: ${options.outputDir}`);
    } catch (error) {
      console.error(`Error: Failed to create output directory "${options.outputDir}":`, error);
      process.exit(1);
    }
  }
}

/**
 * Generate timestamp for backup filename
 */
function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Perform real backup generation
 */
async function performBackup(options: BackupOptions): Promise<BackupResult> {
  if (!options.remote) {
    // For local mode, we would need Miniflare integration
    // For now, suggest using remote mode for actual backups
    console.log('⚠️  Local mode not yet implemented.');
    console.log('   Local mode would require Miniflare integration for D1/R2 simulation.');
    console.log('   Please use --remote flag for actual production backups.');
    console.log();
    
    return {
      success: false,
      error: 'Local mode not implemented. Use --remote for actual backups.',
    };
  }

  try {
    // Get Cloudflare configuration
    const config = getCloudflareConfig();

    // Handle photos-only mode
    if (options.photosOnly) {
      console.log('📸 Running in photos-only mode - downloading R2 photos to local directory');
      const photosResult = await downloadR2PhotosToDirectory(config, options.photosDir);
      
      if (photosResult.success) {
        return {
          success: true,
          filename: `photos-downloaded-to-${options.photosDir}`,
          filepath: photosResult.localDirectory,
          size: photosResult.totalSize || 0,
          metadata: {
            databaseInfo: {
              tables: [],
              totalRecords: 0,
              size: 0,
            },
            photosInfo: {
              totalFiles: photosResult.totalFiles || 0,
              totalSize: photosResult.totalSize || 0,
            },
            createdAt: new Date().toISOString(),
            version: '1.0.0',
          },
        };
      } else {
        return {
          success: false,
          error: `Photos download failed: ${photosResult.error}`,
        };
      }
    }

    // Step 1: Export D1 database
    const databaseResult = await exportD1Database(config);
    if (!databaseResult.success) {
      return {
        success: false,
        error: `Database export failed: ${databaseResult.error}`,
      };
    }

    // Step 2: Download R2 files
    const r2Result = await downloadR2Files(config);
    if (!r2Result.success) {
      return {
        success: false,
        error: `R2 download failed: ${r2Result.error}`,
      };
    }

    // Step 3: Create ZIP archive
    const archiveResult = await createBackupArchive(options.outputDir, databaseResult, r2Result);
    if (!archiveResult.success) {
      return {
        success: false,
        error: `Archive creation failed: ${archiveResult.error}`,
      };
    }

    return archiveResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown backup error',
    };
  }
}

/**
 * Main backup function
 */
async function main(): Promise<void> {
  console.log('Cultural Archiver Backup Tool v1.0.0');
  console.log('=====================================\n');

  const options = parseArguments();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  try {
    // Validate environment and configuration
    console.log('⚙️  Validating environment configuration...');
    validateEnvironment(options);

    // Display configuration
    console.log(`📁 Output directory: ${options.outputDir}`);
    if (options.photosOnly) {
      console.log(`📸 Photos directory: ${options.photosDir}`);
      console.log(`🔄 Mode: Photos-only download`);
    }
    console.log(`☁️  Environment: ${options.remote ? 'Remote (Cloudflare)' : 'Local (Development)'}`);
    console.log();

    // Perform backup
    console.log('🚀 Starting backup process...');
    const startTime = Date.now();
    
    const result = await performBackup(options);
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('\n' + '='.repeat(50));
    
    if (result.success) {
      if (options.photosOnly) {
        console.log('✅ PHOTOS DOWNLOAD COMPLETED SUCCESSFULLY');
        console.log('='.repeat(50));
        
        console.log(`\nLocal Directory: ${result.filepath}`);
        console.log(`Total Files: ${result.metadata?.photosInfo.totalFiles.toLocaleString() || 0}`);
        console.log(`Total Size: ${formatFileSize(result.size || 0)}`);
        console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
        
        console.log('\n🎯 All R2 photos have been downloaded to your local directory.');
        console.log('📁 You can now browse, backup, or process the photos locally.');
        
        // Try to open the photos directory
        try {
          const { spawn } = await import('child_process');
          const platform = process.platform;
          
          if (platform === 'win32') {
            spawn('explorer', [result.filepath!.replace(/\//g, '\\')]);
          } else if (platform === 'darwin') {
            spawn('open', [result.filepath!]);
          } else {
            spawn('xdg-open', [result.filepath!]);
          }
          
          console.log('\n📂 Opening photos directory...');
        } catch (error) {
          // Ignore errors opening directory
        }
      } else {
        console.log('✅ BACKUP COMPLETED SUCCESSFULLY');
        console.log('='.repeat(50));
        
        console.log(`\nBackup File: ${result.filename}`);
        console.log(`File Path: ${result.filepath}`);
        console.log(`File Size: ${formatFileSize(result.size || 0)}`);
        console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
        
        if (result.metadata) {
          console.log(`\nDatabase:`);
          console.log(`  Tables: ${result.metadata.databaseInfo.tables.length} (${result.metadata.databaseInfo.tables.join(', ')})`);
          console.log(`  Records: ${result.metadata.databaseInfo.totalRecords.toLocaleString()}`);
          console.log(`  SQL Size: ${formatFileSize(result.metadata.databaseInfo.size)}`);
          
          console.log(`\nPhotos:`);
          console.log(`  Files: ${result.metadata.photosInfo.totalFiles.toLocaleString()}`);
          console.log(`  Total Size: ${formatFileSize(result.metadata.photosInfo.totalSize)}`);
        }
        
        console.log('\n✨ Backup archive contains:');
        console.log('  • database.sql - Complete database dump');
        console.log('  • photos/ - All original and thumbnail images');
        console.log('  • metadata.json - Backup information and statistics');
        console.log('  • README.md - Restoration instructions');

        // Open file location (platform-specific)
        try {
          const { spawn } = await import('child_process');
          const platform = process.platform;
          
          if (platform === 'win32') {
            spawn('explorer', ['/select,', result.filepath!.replace(/\//g, '\\')]);
          } else if (platform === 'darwin') {
            spawn('open', ['-R', result.filepath!]);
          } else {
            spawn('xdg-open', [options.outputDir]);
          }
          
          console.log('\n📂 Opening file location...');
        } catch (error) {
          // Ignore errors opening file location
        }
      }
    } else {
      console.log('❌ BACKUP FAILED');
      console.log('='.repeat(50));
      console.log(`\nError: ${result.error}`);
      console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
      
      if (!options.remote) {
        console.log('\n💡 Suggestions:');
        console.log('  • Use --remote flag for production backups');
        console.log('  • Ensure environment variables are set in .env file');
        console.log('  • Check Cloudflare API credentials and permissions');
      }
    }
    
    console.log('\n' + '='.repeat(50));

  } catch (error) {
    console.error('\n❌ Backup failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    
    process.exit(1);
  }
}

// Run the backup command
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { main as runBackup };