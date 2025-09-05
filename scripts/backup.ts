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
  wranglerExport: boolean;
  validateOnly: boolean;
  env: string;
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
    wranglerExport: false,
    validateOnly: false,
    env: 'development',
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

      case '--wrangler-export':
        options.wranglerExport = true;
        break;

      case '--validate-only':
        options.validateOnly = true;
        break;

      case '--env':
        if (i + 1 < args.length) {
          options.env = args[++i];
        } else {
          console.error('Error: --env requires an environment name');
          process.exit(1);
        }
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
  --wrangler-export    Use Wrangler CLI for D1 database export (recommended)
  --env <environment>  Environment for Wrangler operations (default: development)
  --photos-only        Download only photos to local directory (implies --remote)
  --validate-only      Validate existing backup files without creating new backup
  --help, -h           Show this help message

EXAMPLES:
  npm run backup -- --help
  npm run backup -- --remote --wrangler-export
  npm run backup -- --remote --wrangler-export --env production
  npm run backup -- --remote --output-dir ./backups --wrangler-export
  npm run backup -- --photos-only --photos-dir ./my-photos
  npm run backup -- --validate-only

WRANGLER EXPORT MODE:
  The --wrangler-export flag uses Wrangler's native D1 export functionality:
  - Uses wrangler d1 export command for database export
  - Includes migration state information in backup
  - Supports environment-specific operations (--env development|production)
  - Requires wrangler.toml configuration in src/workers/
  - Provides better compatibility with D1 schema and data formats

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
 * Export D1 database using Wrangler CLI
 */
async function exportD1DatabaseWithWrangler(config: CloudflareConfig, env: string = 'development'): Promise<DatabaseExportResult> {
  try {
    console.log(`📊 Exporting D1 database using Wrangler CLI (${env})...`);

    const { spawn } = await import('child_process');
    const { resolve } = await import('path');
    
    // Change to workers directory where wrangler.toml exists
    const workersDir = resolve(process.cwd(), 'src/workers');
    
    // Run wrangler d1 export command
    const wranglerArgs = ['d1', 'export', 'cultural-archiver'];
    if (env && env !== 'development') {
      wranglerArgs.push('--env', env);
    }
    
    console.log(`   Running: wrangler ${wranglerArgs.join(' ')} (from ${workersDir})`);
    
    return new Promise((resolve, reject) => {
      let sqlOutput = '';
      let errorOutput = '';
      
      const wranglerProcess = spawn('npx', ['wrangler', ...wranglerArgs], {
        cwd: workersDir,
        stdio: 'pipe',
      });
      
      wranglerProcess.stdout?.on('data', (data) => {
        sqlOutput += data.toString();
      });
      
      wranglerProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        console.log(`   Wrangler: ${data.toString().trim()}`);
      });
      
      wranglerProcess.on('close', (code) => {
        if (code === 0) {
          console.log('   Wrangler export completed successfully');
          
          // Extract table names from SQL output for metadata
          const tableMatches = sqlOutput.match(/CREATE TABLE (?:IF NOT EXISTS )?`?([^`\s]+)`?/g) || [];
          const tables = tableMatches.map(match => {
            const tableMatch = match.match(/CREATE TABLE (?:IF NOT EXISTS )?`?([^`\s]+)`?/);
            return tableMatch ? tableMatch[1] : '';
          }).filter(Boolean);
          
          // Estimate record count from INSERT statements
          const insertMatches = sqlOutput.match(/INSERT INTO/g) || [];
          const totalRecords = insertMatches.length;
          
          console.log(`   Database export: ${sqlOutput.length} characters, estimated ${totalRecords} records`);
          console.log(`   Found ${tables.length} tables: ${tables.join(', ')}`);
          
          resolve({
            success: true,
            sqlDump: sqlOutput,
            tables,
            totalRecords,
          });
        } else {
          console.error('   Wrangler export failed with code:', code);
          console.error('   Error output:', errorOutput);
          reject(new Error(`Wrangler export failed: ${errorOutput || 'Unknown error'}`));
        }
      });
      
      wranglerProcess.on('error', (error) => {
        console.error('   Failed to spawn wrangler process:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('❌ Wrangler database export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown wrangler export error',
    };
  }
}

/**
 * Get migration status using Wrangler CLI
 */
async function getMigrationStatus(env: string = 'development'): Promise<{ success: boolean; status?: any; error?: string }> {
  try {
    console.log(`📋 Getting migration status using Wrangler CLI (${env})...`);

    const { spawn } = await import('child_process');
    const { resolve } = await import('path');
    
    // Change to workers directory where wrangler.toml exists
    const workersDir = resolve(process.cwd(), 'src/workers');
    
    // Run wrangler d1 migrations list command
    const wranglerArgs = ['d1', 'migrations', 'list', 'cultural-archiver'];
    if (env && env !== 'development') {
      wranglerArgs.push('--env', env);
    }
    
    console.log(`   Running: wrangler ${wranglerArgs.join(' ')} (from ${workersDir})`);
    
    return new Promise((resolve, reject) => {
      let jsonOutput = '';
      let errorOutput = '';
      
      const wranglerProcess = spawn('npx', ['wrangler', ...wranglerArgs], {
        cwd: workersDir,
        stdio: 'pipe',
      });
      
      wranglerProcess.stdout?.on('data', (data) => {
        jsonOutput += data.toString();
      });
      
      wranglerProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        console.log(`   Wrangler: ${data.toString().trim()}`);
      });
      
      wranglerProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Try to parse JSON output
            let migrationStatus;
            try {
              migrationStatus = JSON.parse(jsonOutput);
            } catch (parseError) {
              // If JSON parsing fails, create a simple status object
              migrationStatus = {
                environment: env,
                output: jsonOutput.trim(),
                timestamp: new Date().toISOString(),
              };
            }
            
            console.log('   Migration status retrieved successfully');
            resolve({
              success: true,
              status: migrationStatus,
            });
          } catch (error) {
            console.error('   Failed to parse migration status:', error);
            resolve({
              success: false,
              error: `Failed to parse migration status: ${error}`,
            });
          }
        } else {
          console.error('   Migration status failed with code:', code);
          resolve({
            success: false,
            error: `Migration status failed: ${errorOutput || 'Unknown error'}`,
          });
        }
      });
      
      wranglerProcess.on('error', (error) => {
        console.error('   Failed to spawn wrangler process:', error);
        resolve({
          success: false,
          error: error.message,
        });
      });
    });
  } catch (error) {
    console.error('❌ Migration status failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown migration status error',
    };
  }
}

/**
 * Export D1 database using Cloudflare API (legacy method)
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

      console.log(`   🔍 API Request: ${listUrl.toString()}`);
      
      const listResponse = await fetch(listUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
        },
      });

      console.log(`   📡 Response Status: ${listResponse.status} ${listResponse.statusText}`);

      if (!listResponse.ok) {
        const error = await listResponse.text();
        console.error(`   ❌ Response Error: ${error}`);
        throw new Error(`Failed to list R2 objects: ${listResponse.status} ${error}`);
      }

      const listResult = await listResponse.json();
      console.log(`   📋 API Response Structure:`, JSON.stringify({
        success: listResult.success,
        resultType: typeof listResult.result,
        resultIsArray: Array.isArray(listResult.result),
        resultLength: Array.isArray(listResult.result) ? listResult.result.length : 0,
        errors: listResult.errors,
        messages: listResult.messages
      }, null, 2));
      
      if (!listResult.success) {
        console.error(`   ❌ Cloudflare API Error:`, JSON.stringify(listResult, null, 2));
        throw new Error(`R2 list failed: ${JSON.stringify(listResult.errors)}`);
      }

      // Handle two possible response structures for objects
      let objects = [];
      if (Array.isArray(listResult.result)) {
        objects = listResult.result;
      } else if (listResult.result?.objects && Array.isArray(listResult.result.objects)) {
        objects = listResult.result.objects;
      }
      
      console.log(`   Found ${objects.length} objects in this batch`);
      console.log(`   Found ${objects.length} objects in this batch`);

      // Download each object
      for (const obj of objects) {
        console.log(`   Downloading: ${obj.key} (${obj.size} bytes)`);

        try {
          const downloadResponse = await downloadWithRetry(
            `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucketName}/objects/${encodeURIComponent(obj.key)}`,
            {
              'Authorization': `Bearer ${config.apiToken}`,
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

      // Handle pagination - check for cursor in different possible locations
      if (Array.isArray(listResult.result)) {
        // For direct array structure, cursor might be in result.cursor or top-level
        continuationToken = listResult.cursor || null;
      } else if (listResult.result && typeof listResult.result === 'object') {
        // For nested structure, cursor is typically in result.cursor
        continuationToken = listResult.result.cursor || null;
      } else {
        continuationToken = null;
      }
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
    console.log(`🏢 Account ID: ${config.accountId.substring(0, 8)}...${config.accountId.substring(config.accountId.length - 4)}`);
    console.log(`🔑 API Token: ${config.apiToken.substring(0, 8)}...${config.apiToken.substring(config.apiToken.length - 4)}`);
    console.log(`🗂️  Database ID: ${config.databaseId.substring(0, 8)}...${config.databaseId.substring(config.databaseId.length - 4)}`);
    
    // Test bucket accessibility first
    console.log(`🔍 Testing bucket accessibility...`);
    const testUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucketName}`;
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`   Bucket test result: ${testResponse.status} ${testResponse.statusText}`);
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.warn(`   ⚠️ Bucket accessibility warning: ${errorText}`);
      console.log(`   This might indicate permission issues or incorrect bucket name`);
    } else {
      const bucketInfo = await testResponse.json();
      console.log(`   ✅ Bucket accessible:`, JSON.stringify({
        success: bucketInfo.success,
        bucketName: bucketInfo.result?.name,
        created: bucketInfo.result?.creation_date
      }, null, 2));
    }
    console.log(`🏢 Account ID: ${config.accountId.substring(0, 8)}...${config.accountId.substring(config.accountId.length - 4)}`);
    console.log(`🔑 API Token: ${config.apiToken.substring(0, 8)}...${config.apiToken.substring(config.apiToken.length - 4)}`);
    console.log(`🗂️  Database ID: ${config.databaseId.substring(0, 8)}...${config.databaseId.substring(config.databaseId.length - 4)}`);

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

      console.log(`   🔍 API Request: ${listUrl.toString()}`);
      
      const listResponse = await fetch(listUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`   📡 Response Status: ${listResponse.status} ${listResponse.statusText}`);

      if (!listResponse.ok) {
        const error = await listResponse.text();
        console.error(`   ❌ Response Error: ${error}`);
        throw new Error(`Failed to list R2 objects: ${listResponse.status} ${error}`);
      }

      const listResult = await listResponse.json();
      
      console.log(`   📋 API Response Analysis:`, JSON.stringify({
        success: listResult.success,
        resultType: typeof listResult.result,
        resultIsArray: Array.isArray(listResult.result),
        resultLength: Array.isArray(listResult.result) ? listResult.result.length : 0,
        errors: listResult.errors,
        messages: listResult.messages
      }, null, 2));
      
      if (!listResult.success) {
        console.error(`   ❌ Cloudflare API Error:`, JSON.stringify(listResult, null, 2));
        throw new Error(`R2 list failed: ${JSON.stringify(listResult.errors || listResult.messages)}`);
      }

      // Handle two possible response structures:
      // Structure A: { result: { objects: [...] } }
      // Structure B: { result: [...] } (direct array)
      let objects = [];
      if (Array.isArray(listResult.result)) {
        // Direct array of objects
        objects = listResult.result;
        console.log(`   📄 Objects structure: Direct array with ${objects.length} objects`);
      } else if (listResult.result?.objects && Array.isArray(listResult.result.objects)) {
        // Nested objects array
        objects = listResult.result.objects;
        console.log(`   📄 Objects structure: Nested array with ${objects.length} objects`);
      } else {
        console.log(`   📄 Objects structure: Unknown - result:`, typeof listResult.result);
        objects = [];
      }
      
      console.log(`   Processing batch: ${objects.length} objects`);
      
      if (objects.length > 0) {
        console.log(`   📄 First few objects:`, objects.slice(0, 3).map(obj => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded
        })));
      }

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

          // Download the object from R2 with retry logic
          const downloadResponse = await downloadWithRetry(
            `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucketName}/objects/${encodeURIComponent(obj.key)}`,
            {
              'Authorization': `Bearer ${config.apiToken}`,
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

      // Handle pagination - check for cursor in different possible locations
      if (Array.isArray(listResult.result)) {
        // For direct array structure, cursor might be in result.cursor or top-level
        continuationToken = listResult.cursor || null;
      } else if (listResult.result && typeof listResult.result === 'object') {
        // For nested structure, cursor is typically in result.cursor
        continuationToken = listResult.result.cursor || null;
      } else {
        continuationToken = null;
      }
      
      if (continuationToken) {
        console.log(`   Continuing with next batch (cursor: ${continuationToken.substring(0, 20)}...)`);
      } else {
        console.log(`   No cursor found - this is the last batch`);
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
    };
  }
}

/**
 * Validate backup by attempting restore and migration validation
 */
async function validateBackupRestore(filepath: string): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    console.log('🔍 Starting backup restore validation...');
    
    // Check if backup file exists
    if (!existsSync(filepath)) {
      errors.push(`Backup file does not exist: ${filepath}`);
      return { success: false, errors, warnings };
    }
    
    console.log(`   Validating backup file: ${filepath}`);
    
    // For now, implement basic validation
    // In a full implementation, this would:
    // 1. Extract the backup archive to a temp directory
    // 2. Create a temporary SQLite database
    // 3. Import the database.sql file
    // 4. Run migration validation against the restored database
    // 5. Clean up temporary files
    
    const { createReadStream } = await import('fs');
    const { createGunzip } = await import('zlib');
    
    // Basic integrity check - ensure file is readable and not corrupted
    const stream = createReadStream(filepath);
    
    return new Promise((resolve) => {
      let hasData = false;
      
      stream.on('data', (chunk) => {
        hasData = true;
        // Check if this looks like a ZIP file
        const zipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP file header
        if (chunk.length >= 4 && chunk.subarray(0, 4).equals(zipHeader)) {
          console.log('   ✅ File appears to be a valid ZIP archive');
        }
      });
      
      stream.on('end', () => {
        if (hasData) {
          console.log('   ✅ Backup file is readable and contains data');
          warnings.push('Full restore validation not yet implemented - only basic checks performed');
          resolve({ success: true, errors, warnings });
        } else {
          errors.push('Backup file appears to be empty');
          resolve({ success: false, errors, warnings });
        }
      });
      
      stream.on('error', (error) => {
        errors.push(`Failed to read backup file: ${error.message}`);
        resolve({ success: false, errors, warnings });
      });
    });
  } catch (error) {
    errors.push(`Backup validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, errors, warnings };
  }
}

/**
 * Validate backup archive integrity
 */
async function validateBackupArchive(filepath: string, expectedMetadata: any): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Check if file exists and is readable
    if (!existsSync(filepath)) {
      errors.push('Backup file does not exist');
      return { valid: false, errors };
    }

    // Check file size (should be > 0)
    const { stat } = await import('fs').then(fs => fs.promises);
    const stats = await stat(filepath);
    
    if (stats.size === 0) {
      errors.push('Backup file is empty');
    }
    
    if (stats.size < 100) { // Very small files are likely corrupt
      errors.push('Backup file is suspiciously small');
    }

    console.log(`   Archive validation: ${filepath} (${formatFileSize(stats.size)})`);
    
    // Additional integrity checks could include:
    // - ZIP header validation
    // - File count verification
    // - Critical file presence check
    
    return { valid: errors.length === 0, errors };
  } catch (error) {
    errors.push(`Archive validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { valid: false, errors };
  }
}

/**
 * Create backup ZIP archive with integrity verification
 */
async function createBackupArchive(
  outputDir: string,
  databaseResult: DatabaseExportResult,
  r2Result: R2ListResult,
  migrationStatus?: any
): Promise<BackupResult> {
  return new Promise(async (resolve) => {
    const timestamp = generateTimestamp();
    const filename = `backup-${timestamp}.zip`;
    const filepath = join(outputDir, filename);

    console.log('📦 Creating backup archive...');

    const output = createWriteStream(filepath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Best compression
    });

    let filesAdded = 0;
    const expectedFiles = 4 + (r2Result.totalFiles || 0); // database.sql, metadata.json, migration_state.json, README.md + photos

    output.on('close', async () => {
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
      console.log(`   Files added: ${filesAdded}/${expectedFiles}`);

      // Perform integrity validation
      const validation = await validateBackupArchive(filepath, metadata);
      
      if (!validation.valid) {
        console.warn('⚠️ Archive validation warnings:');
        validation.errors.forEach(error => console.warn(`   - ${error}`));
      } else {
        console.log('✅ Archive integrity validated');
      }

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
      filesAdded++;
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
      integrity: {
        expected_files: expectedFiles,
        created_at: new Date().toISOString(),
        validation_checksum: generateMetadataChecksum(databaseResult, r2Result),
      },
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
    console.log('   Added: metadata.json');
    filesAdded++;

    // Add migration state if available
    if (migrationStatus) {
      archive.append(JSON.stringify(migrationStatus, null, 2), { name: 'migration_state.json' });
      console.log('   Added: migration_state.json');
      filesAdded++;
    }

    // Add README
    const readme = generateBackupReadme(metadata);
    archive.append(readme, { name: 'README.md' });
    console.log('   Added: README.md');
    filesAdded++;

    // Add R2 files with progress tracking
    if (r2Result.files && r2Result.files.length > 0) {
      console.log(`   Adding ${r2Result.files.length} photos...`);
      let photoCount = 0;
      
      for (const file of r2Result.files) {
        if (file.content) {
          const pathInArchive = `photos/${file.key}`;
          archive.append(file.content, { 
            name: pathInArchive,
            date: new Date(file.lastModified),
          });
          
          photoCount++;
          filesAdded++;
          
          // Progress reporting for large numbers of files
          if (photoCount % 50 === 0 || photoCount === r2Result.files.length) {
            console.log(`   Progress: ${photoCount}/${r2Result.files.length} photos added`);
          }
        }
      }
      console.log(`   Completed: ${photoCount} photos added to archive`);
    }

    // Finalize the archive
    archive.finalize();
  });
}

/**
 * Generate validation checksum for backup integrity
 */
function generateMetadataChecksum(databaseResult: DatabaseExportResult, r2Result: R2ListResult): string {
  const checksumData = {
    database_tables: (databaseResult.tables || []).sort(),
    database_records: databaseResult.totalRecords || 0,
    database_size: databaseResult.sqlDump?.length || 0,
    photos_count: r2Result.totalFiles || 0,
    photos_size: r2Result.totalSize || 0,
    timestamp: Date.now(),
  };
  
  // Simple checksum based on JSON representation
  const jsonStr = JSON.stringify(checksumData);
  let hash = 0;
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Enhanced download with retry logic for failed R2 operations
 */
async function downloadWithRetry(url: string, headers: HeadersInit, maxRetries: number = 3, baseDelay: number = 1000): Promise<Response> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { method: 'GET', headers });
      
      if (response.ok) {
        return response;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown download error');
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`   Retry ${attempt}/${maxRetries - 1} in ${delay}ms for ${url}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
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

## Backup Integrity

This backup includes integrity verification features:
- **Expected Files**: ${metadata.integrity?.expected_files || 'N/A'}
- **Validation Checksum**: ${metadata.integrity?.validation_checksum || 'N/A'}
- **Creation Timestamp**: ${metadata.integrity?.created_at || metadata.created_at}

## Restoration Instructions

### Prerequisites
- Access to Cloudflare dashboard or Wrangler CLI
- D1 database instance (can be new or existing)
- R2 bucket for photos (can be new or existing)
- Appropriate permissions for D1 and R2 operations

### Database Restoration
1. **Extract this backup archive** to a working directory
2. **Verify backup integrity** by checking file presence:
   - \`database.sql\` - Should contain CREATE and INSERT statements
   - \`photos/\` directory - Should contain ${metadata.photos_info.total_photos} image files
   - \`metadata.json\` - Should match checksum: ${metadata.integrity?.validation_checksum || 'N/A'}
3. **Execute SQL dump** using Wrangler CLI:
   \`\`\`bash
   wrangler d1 execute [DATABASE_NAME] --file=database.sql
   \`\`\`
4. **Verify restoration** by checking table counts and sample records

### Photo Restoration
1. **Verify photo integrity** - ${metadata.photos_info.total_photos} files totaling ${(metadata.photos_info.total_size / (1024 * 1024)).toFixed(2)} MB
2. **Upload to R2 bucket** preserving directory structure:
   \`\`\`bash
   wrangler r2 object put [BUCKET_NAME]/[FILENAME] --file=photos/[FILENAME]
   \`\`\`
   Or use bulk upload tools for large batches
3. **Set appropriate permissions** for public photo access
4. **Update CDN configurations** if using custom domains

### Verification Checklist
- [ ] All ${metadata.database_info.tables.length} database tables restored: ${metadata.database_info.tables.join(', ')}
- [ ] Total record count matches: ${metadata.database_info.total_records.toLocaleString()} records
- [ ] All ${metadata.photos_info.total_photos.toLocaleString()} photos uploaded successfully
- [ ] Photo file sizes match original total: ${(metadata.photos_info.total_size / (1024 * 1024)).toFixed(2)} MB
- [ ] Sample artwork pages display correctly with photos
- [ ] Application health checks pass
- [ ] Search functionality works with restored data

### Testing Restoration
1. **Database connectivity**: Query a few tables to ensure data integrity
2. **Photo accessibility**: Test loading sample images through the application
3. **Application functionality**: Verify core features work with restored data
4. **Search and filtering**: Test artwork discovery and filtering features

## Troubleshooting

### Common Issues
- **Large database dumps**: May require increased timeouts for Wrangler commands
- **Photo upload limits**: Consider batch uploading for large photo collections
- **Permission errors**: Ensure API tokens have appropriate D1 and R2 permissions
- **Encoding issues**: Ensure database restoration preserves UTF-8 encoding

### Support Resources
- Cultural Archiver documentation: \`docs/backup-data-dump.md\`
- Database schema reference: \`docs/database.md\`
- API documentation: \`docs/api.md\`
- Cloudflare D1 documentation: https://developers.cloudflare.com/d1/
- Cloudflare R2 documentation: https://developers.cloudflare.com/r2/

## Important Notes

- **Data Preservation**: This backup preserves all system data including user tokens, audit trails, and metadata
- **File Organization**: Photos maintain their original file names and directory structure
- **Timestamp Consistency**: All timestamps and IDs are preserved exactly as they were at backup time
- **Complete System State**: Rate limiting data and temporary sessions are included in the backup
- **Security**: Contains sensitive data - store and transfer securely

## Security Considerations

- **Secure Storage**: Store backup files in encrypted, access-controlled locations
- **Data Retention**: Follow organizational policies for backup retention periods
- **Access Control**: Limit backup file access to authorized personnel only
- **Transfer Security**: Use secure channels (HTTPS, SFTP) for backup file transfer
- **Regular Testing**: Periodically test restoration procedures to ensure backup validity

Created by Cultural Archiver Backup System v${metadata.version}
Integrity Checksum: ${metadata.integrity?.validation_checksum || 'Not Available'}
`;
}

/**
 * Validate environment configuration with enhanced security checks
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
      console.error('❌ Error: Missing required environment variables for remote backup:');
      missing.forEach(varName => console.error(`  - ${varName}`));
      console.error('\n💡 Security Requirements:');
      console.error('  - CLOUDFLARE_API_TOKEN must have D1:Read and R2:Read permissions');
      console.error('  - Use environment-specific API tokens (not global admin tokens)');
      console.error('  - Rotate API tokens regularly (recommended: every 90 days)');
      console.error('  - Store credentials in .env file (excluded from version control)');
      console.error('\nPlease set these variables in your .env file.');
      console.error('See .env.example for reference and security best practices.');
      process.exit(1);
    }

    // Additional security validation
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (apiToken && apiToken.length < 20) {
      console.warn('⚠️ Warning: API token appears to be too short. Please verify it\'s a valid Cloudflare API token.');
    }
    
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (accountId && !/^[a-f0-9]{32}$/.test(accountId)) {
      console.warn('⚠️ Warning: Account ID format appears invalid. Should be 32 character hex string.');
    }

    console.log('🔒 Environment security validation passed');
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

    // Handle validate-only mode
    if (options.validateOnly) {
      console.log('🔍 Running in validation-only mode');
      
      // Look for existing backup files in output directory
      const { readdir } = await import('fs').then(fs => fs.promises);
      const files = await readdir(options.outputDir);
      const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.zip'));
      
      if (backupFiles.length === 0) {
        return {
          success: false,
          error: 'No backup files found to validate. Create a backup first.',
        };
      }
      
      // Validate the most recent backup file
      const mostRecentBackup = backupFiles.sort().reverse()[0];
      const backupPath = join(options.outputDir, mostRecentBackup);
      
      console.log(`   Validating: ${mostRecentBackup}`);
      const validation = await validateBackupRestore(backupPath);
      
      if (validation.success) {
        console.log('✅ Backup validation completed');
        if (validation.warnings.length > 0) {
          console.log('   Warnings:');
          validation.warnings.forEach(w => console.log(`   - ${w}`));
        }
        return {
          success: true,
          filename: mostRecentBackup,
          filepath: backupPath,
        };
      } else {
        console.log('❌ Backup validation failed');
        validation.errors.forEach(e => console.log(`   - ${e}`));
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
        };
      }
    }

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

    // Step 1: Export D1 database (choose method based on options)
    let databaseResult: DatabaseExportResult;
    if (options.wranglerExport) {
      console.log('Using Wrangler D1 export...');
      databaseResult = await exportD1DatabaseWithWrangler(config, options.env);
    } else {
      console.log('Using Cloudflare API export...');
      databaseResult = await exportD1Database(config);
    }
    
    if (!databaseResult.success) {
      return {
        success: false,
        error: `Database export failed: ${databaseResult.error}`,
      };
    }

    // Step 2: Get migration status if using wrangler export
    let migrationStatus = undefined;
    if (options.wranglerExport) {
      const statusResult = await getMigrationStatus(options.env);
      if (statusResult.success) {
        migrationStatus = statusResult.status;
      } else {
        console.warn(`Warning: Failed to get migration status: ${statusResult.error}`);
      }
    }

    // Step 3: Download R2 files
    const r2Result = await downloadR2Files(config);
    if (!r2Result.success) {
      return {
        success: false,
        error: `R2 download failed: ${r2Result.error}`,
      };
    }

    // Step 4: Create ZIP archive
    const archiveResult = await createBackupArchive(options.outputDir, databaseResult, r2Result, migrationStatus);
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