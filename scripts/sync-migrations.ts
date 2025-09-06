#!/usr/bin/env node
/**
 * Migration Synchronization Tool - Windows Compatible
 * 
 * This script synchronizes migration files between the root /migrations directory
 * and the /src/workers/migrations directory to ensure Windows PowerShell compatibility.
 * 
 * Wrangler on Windows has issues with relative paths, so we maintain migrations
 * in both locations:
 * - /migrations (authoritative source)
 * - /src/workers/migrations (copy for wrangler)
 * 
 * Usage:
 *   npx tsx scripts/sync-migrations.ts
 *   npm run migrate:sync
 */

import { readdir, copyFile, mkdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);
const sourceMigrationsDir = join(projectRoot, 'migrations');
const targetMigrationsDir = join(projectRoot, 'src', 'workers', 'migrations');

class MigrationSyncer {
  async ensureDirectoryExists(path: string): Promise<void> {
    if (!existsSync(path)) {
      await mkdir(path, { recursive: true });
      console.log(`📁 Created directory: ${path}`);
    }
  }

  async getMigrationFiles(directory: string): Promise<string[]> {
    try {
      const files = await readdir(directory);
      return files.filter(file => file.endsWith('.sql')).sort();
    } catch (error) {
      console.warn(`⚠️  Could not read directory ${directory}: ${error}`);
      return [];
    }
  }

  async copyMigrationFile(fileName: string): Promise<void> {
    const sourcePath = join(sourceMigrationsDir, fileName);
    const targetPath = join(targetMigrationsDir, fileName);

    try {
      // Check if source file exists
      await stat(sourcePath);
      
      // Copy file
      await copyFile(sourcePath, targetPath);
      console.log(`✅ Copied: ${fileName}`);
    } catch (error) {
      console.error(`❌ Failed to copy ${fileName}: ${error}`);
    }
  }

  async syncMigrations(): Promise<void> {
    console.log('🔄 Synchronizing Migration Files');
    console.log('================================');
    console.log(`Source: ${sourceMigrationsDir}`);
    console.log(`Target: ${targetMigrationsDir}`);
    console.log('');

    // Ensure target directory exists
    await this.ensureDirectoryExists(targetMigrationsDir);

    // Get migration files from source
    const sourceFiles = await this.getMigrationFiles(sourceMigrationsDir);
    const targetFiles = await this.getMigrationFiles(targetMigrationsDir);

    console.log(`📊 Found ${sourceFiles.length} source migrations`);
    console.log(`📊 Found ${targetFiles.length} target migrations`);
    console.log('');

    if (sourceFiles.length === 0) {
      console.warn('⚠️  No migration files found in source directory');
      return;
    }

    // Copy all migration files
    for (const fileName of sourceFiles) {
      await this.copyMigrationFile(fileName);
    }

    // Report missing files in target
    const missingInTarget = sourceFiles.filter(file => !targetFiles.includes(file));
    const extraInTarget = targetFiles.filter(file => !sourceFiles.includes(file));

    console.log('');
    console.log('📋 Synchronization Summary:');
    console.log(`   • Source files: ${sourceFiles.length}`);
    console.log(`   • Target files: ${targetFiles.length}`);
    console.log(`   • Files copied: ${sourceFiles.length}`);
    
    if (missingInTarget.length > 0) {
      console.log(`   • Previously missing: ${missingInTarget.join(', ')}`);
    }
    
    if (extraInTarget.length > 0) {
      console.log(`   ⚠️  Extra files in target: ${extraInTarget.join(', ')}`);
      console.log('   These files exist in workers/migrations but not in root migrations');
    }

    console.log('');
    console.log('✅ Migration synchronization complete!');
    console.log('');
    console.log('💡 Usage Notes:');
    console.log('   • Root /migrations directory is the authoritative source');
    console.log('   • /src/workers/migrations is automatically synchronized');
    console.log('   • Run this script after adding new migration files');
    console.log('   • Works on Windows, macOS, and Linux');
  }

  static showHelp(): void {
    console.log('Migration Synchronization Tool - Cultural Archiver');
    console.log('');
    console.log('Purpose:');
    console.log('  Synchronize migration files between root and workers directories');
    console.log('  Ensures Windows PowerShell compatibility with wrangler');
    console.log('');
    console.log('Usage:');
    console.log('  npx tsx scripts/sync-migrations.ts');
    console.log('  npm run migrate:sync');
    console.log('');
    console.log('Directories:');
    console.log('  Source: /migrations (authoritative)');
    console.log('  Target: /src/workers/migrations (for wrangler)');
    console.log('');
    console.log('Windows Compatibility:');
    console.log('  • Uses file copying instead of symbolic links');
    console.log('  • Works with PowerShell and Command Prompt');
    console.log('  • No administrator privileges required');
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    MigrationSyncer.showHelp();
    return;
  }

  const syncer = new MigrationSyncer();
  await syncer.syncMigrations();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Migration sync failed:', error);
    process.exit(1);
  });
}

export { MigrationSyncer };