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

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface BackupOptions {
  outputDir: string;
  remote: boolean;
  help: boolean;
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

      case '--remote':
        options.remote = true;
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
  --output-dir <dir>  Directory to save backup file (default: current directory)
  --remote           Use remote Cloudflare resources (default: local development)
  --help, -h         Show this help message

EXAMPLES:
  npm run backup
  npm run backup -- --output-dir ./backups
  npm run backup -- --remote --output-dir ./production-backups

ENVIRONMENT VARIABLES:
  The following environment variables must be set for remote backups:
  - CLOUDFLARE_ACCOUNT_ID
  - CLOUDFLARE_API_TOKEN
  - D1_DATABASE_ID
  - R2_BUCKET_NAME

NOTES:
  - Backup files are named with timestamp: backup-YYYY-MM-DD-HHMMSS.zip
  - Local development uses miniflare simulation of Cloudflare services
  - Remote backups connect to actual Cloudflare D1 and R2 resources
  - Generated backup includes database SQL dump, all photos, and restoration instructions

IMPLEMENTATION STATUS:
  This backup command is a foundation for implementing actual backup functionality.
  To complete the implementation:
  
  1. Integrate with the backup system in src/workers/lib/backup.ts
  2. Add Cloudflare API integration for remote backups
  3. Use Miniflare for local development testing
  4. Add environment variable validation
  
  Current version provides the CLI structure and argument parsing.
`);
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
 * Create sample backup file for demonstration
 */
function createSampleBackup(outputDir: string): string {
  const timestamp = generateTimestamp();
  const filename = `backup-${timestamp}.zip`;
  const filepath = join(outputDir, filename);
  
  // Create a sample backup content
  const sampleContent = {
    metadata: {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      database_info: {
        tables: ['artwork', 'creators', 'tags', 'artwork_creators'],
        total_records: 150,
        size_estimate: 45000,
      },
      photos_info: {
        total_photos: 75,
        originals_count: 75,
        thumbnails_count: 75,
        total_size: 12500000,
      },
      backup_type: 'full' as const,
      generator: 'Cultural Archiver Backup System',
    },
    note: 'This is a sample backup file generated by the backup command scaffold. To implement actual backup functionality, integrate with src/workers/lib/backup.ts',
  };
  
  // Write sample content as JSON for now
  writeFileSync(filepath, JSON.stringify(sampleContent, null, 2));
  
  return filepath;
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
    console.log(`☁️  Environment: ${options.remote ? 'Remote (Cloudflare)' : 'Local (Development)'}`);
    console.log();

    console.log('🚧 IMPLEMENTATION NOTE:');
    console.log('This backup command provides the CLI foundation for backup functionality.');
    console.log('To complete implementation, integrate with src/workers/lib/backup.ts');
    console.log();

    // Create sample backup for demonstration
    console.log('📦 Creating sample backup file...');
    const filepath = createSampleBackup(options.outputDir);

    // Display summary
    console.log('\n' + '='.repeat(50));
    console.log('BACKUP COMMAND COMPLETED');
    console.log('='.repeat(50));
    
    console.log(`\nBackup File: ${filepath}`);
    console.log(`File Type: Sample/Demo (JSON format)`);
    
    console.log(`\nNext Steps:`);
    console.log(`  1. Integrate with backup library in src/workers/lib/backup.ts`);
    console.log(`  2. Add Cloudflare API integration for remote operations`);
    console.log(`  3. Implement actual ZIP archive generation`);
    console.log(`  4. Add database and R2 photo collection`);
    
    console.log('\n' + '='.repeat(50));

    // Open file location (platform-specific)
    try {
      const { spawn } = await import('child_process');
      const platform = process.platform;
      
      if (platform === 'win32') {
        spawn('explorer', ['/select,', filepath.replace(/\//g, '\\')]);
      } else if (platform === 'darwin') {
        spawn('open', ['-R', filepath]);
      } else {
        spawn('xdg-open', [options.outputDir]);
      }
      
      console.log('\n📂 Opening file location...');
    } catch (error) {
      // Ignore errors opening file location
    }

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