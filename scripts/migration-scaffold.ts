#!/usr/bin/env node
/**
 * Migration Scaffolding Tool for Cultural Archiver
 * Creates new D1-compatible migration files with proper numbering and templates
 *
 * Usage: npm run migrate:create "migration_name"
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);
const migrationsDir = join(projectRoot, 'migrations');
const templatesDir = join(migrationsDir, 'templates');

class MigrationScaffolder {
  async getNextMigrationNumber(): Promise<number> {
    try {
      const files = await readdir(migrationsDir);
      const migrationFiles = files
        .filter(file => file.match(/^\d{3,4}_.*\.sql$/)) // Match both 3 and 4 digit prefixes
        .map(file => {
          const match = file.match(/^(\d{3,4})_/);
          return match
            ? {
                number: parseInt(match[1]),
                filename: file,
              }
            : null;
        })
        .filter(item => item !== null)
        .sort((a, b) => a!.number - b!.number);

      if (migrationFiles.length === 0) {
        return 1;
      }

      return migrationFiles[migrationFiles.length - 1]!.number + 1;
    } catch (error) {
      console.error('❌ Error reading migrations directory:', error);
      return 1;
    }
  }

  formatMigrationNumber(num: number): string {
    return num.toString().padStart(4, '0');
  }

  sanitizeMigrationName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);
  }

  async loadTemplate(): Promise<string> {
    try {
      const templatePath = join(templatesDir, 'd1-template.sql');
      return await readFile(templatePath, 'utf-8');
    } catch (error) {
      console.error('❌ Error loading template:', error);
      console.error('Expected template at:', join(templatesDir, 'd1-template.sql'));
      // Fallback minimal template
      return `-- Migration: [MIGRATION_NAME]
-- Created: [TIMESTAMP]
-- Author: [AUTHOR]
-- Description: [DESCRIPTION]

-- ================================
-- MIGRATION CONTENT START
-- ================================

-- Add your D1-compatible SQL here

-- ================================
-- MIGRATION CONTENT END  
-- ================================`;
    }
  }

  async openInEditor(filepath: string): Promise<void> {
    const editors = [
      process.env.EDITOR,
      process.env.VISUAL,
      'code', // VS Code
      'subl', // Sublime Text
      'atom', // Atom
      'vim', // Vim
      'nano', // Nano
    ].filter(Boolean);

    for (const editor of editors) {
      try {
        const child = spawn(editor!, [filepath], {
          stdio: 'inherit',
          detached: true,
        });

        child.unref(); // Don't wait for editor to close
        console.log(`📝 Opened in ${editor}: ${filepath}`);
        return;
      } catch (error) {
        // Try next editor
        continue;
      }
    }

    console.log('💡 No editor found. Edit manually:', filepath);
  }

  async createMigration(name: string): Promise<void> {
    if (!name || name.trim() === '') {
      console.error('❌ Migration name is required');
      console.error('Usage: npm run migrate:create "migration_name"');
      process.exit(1);
    }

    console.log('🚀 Creating new migration...');

    // Ensure migrations directory exists
    if (!existsSync(migrationsDir)) {
      console.log('📁 Creating migrations directory...');
      await mkdir(migrationsDir, { recursive: true });
    }

    // Ensure templates directory exists  
    if (!existsSync(templatesDir)) {
      console.log('📁 Creating templates directory...');
      await mkdir(templatesDir, { recursive: true });
    }

    const nextNumber = await this.getNextMigrationNumber();
    const sanitizedName = this.sanitizeMigrationName(name);
    const migrationNumber = this.formatMigrationNumber(nextNumber);
    const filename = `${migrationNumber}_${sanitizedName}.sql`;
    const filepath = join(migrationsDir, filename);

    console.log(`📝 Migration number: ${migrationNumber}`);
    console.log(`📂 File: ${filename}`);

    // Load and customize template
    let template = await this.loadTemplate();
    const timestamp = new Date().toISOString();
    const author = process.env.USER || process.env.USERNAME || 'Developer';

    template = template
      .replace(/\[MIGRATION_NAME\]/g, name)
      .replace(/\[TIMESTAMP\]/g, timestamp)
      .replace(/\[AUTHOR\]/g, author)
      .replace(/\[DESCRIPTION\]/g, `Migration to ${name.toLowerCase()}`);

    try {
      await writeFile(filepath, template, 'utf-8');
      console.log(`✅ Created migration: ${filename}`);
      console.log(`📍 Path: ${filepath}`);

      // Try to open in editor (optional, non-blocking)
      if (process.env.CI !== 'true' && process.env.NODE_ENV !== 'test') {
        await this.openInEditor(filepath);
      }

      console.log('');
      console.log('📋 Next steps:');
      console.log('1. Edit the migration file and add your SQL');
      console.log('2. Validate: npm run migrate:validate');
      console.log('3. Apply: npm run migrate:dev');
      console.log('');
      console.log('⚠️  Remember: Only use D1-compatible SQL features!');
      console.log('See migrations/README.md for compatibility guidelines.');
    } catch (error) {
      console.error('❌ Error creating migration file:', error);
      console.error('Path:', filepath);
      console.error('Directory exists:', existsSync(dirname(filepath)));
      process.exit(1);
    }
  }

  showHelp(): void {
    console.log('Migration Scaffolding Tool - Cultural Archiver');
    console.log('');
    console.log('Usage:');
    console.log('  npm run migrate:create "migration_name"');
    console.log('  npx tsx scripts/migration-scaffold.ts "migration_name"');
    console.log('');
    console.log('Examples:');
    console.log('  npm run migrate:create "add_user_permissions"');
    console.log('  npm run migrate:create "create_analytics_table"');
    console.log('  npm run migrate:create "fix_artwork_coordinates"');
    console.log('');
    console.log('PowerShell (Windows) usage:');
    console.log('  npm run migrate:create add_user_permissions');
    console.log('  npm run migrate:create \\"add_user_permissions\\"');
    console.log('');
    console.log('Features:');
    console.log('  • Automatic sequential numbering (0001, 0002, ...)');
    console.log('  • D1-compatible template with guidelines');
    console.log('  • Name sanitization and validation');
    console.log('  • Metadata injection (timestamp, author)');
    console.log('');
    console.log('Troubleshooting:');
    console.log('  • If no file is created, check write permissions');
    console.log('  • On Windows, try without quotes around the migration name');
    console.log('  • Run directly: npx tsx scripts/migration-scaffold.ts your_name');
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle empty arguments with more helpful messaging
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    const scaffolder = new MigrationScaffolder();
    scaffolder.showHelp();
    return;
  }

  // Check for common argument parsing issues
  if (args.length === 0 || !args[0] || args[0].trim() === '') {
    console.error('❌ Error: Migration name is required');
    console.error('');
    console.error('Usage: npm run migrate:create "your_migration_name"');
    console.error('');
    console.error('Examples:');
    console.error('  npm run migrate:create "add_user_table"');
    console.error('  npm run migrate:create "fix_artwork_indexes"');
    console.error('');
    console.error('💡 If you\'re on Windows PowerShell, try:');
    console.error('  npm run migrate:create add_user_table');
    console.error('  npm run migrate:create \\"add_user_table\\"');
    process.exit(1);
  }

  const migrationName = args[0];
  const scaffolder = new MigrationScaffolder();
  
  try {
    await scaffolder.createMigration(migrationName);
  } catch (error) {
    console.error('❌ Failed to create migration:', error instanceof Error ? error.message : String(error));
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Check that you have write permissions to the migrations directory');
    console.error('2. Ensure the migrations/templates directory exists');
    console.error('3. Try running with npx directly: npx tsx scripts/migration-scaffold.ts "your_name"');
    process.exit(1);
  }
}

// Run if called directly
// Check if this file is being run directly (works with tsx and various environments)
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('migration-scaffold.ts') ||
  process.argv[1].endsWith('migration-scaffold.js') ||
  import.meta.url === `file://${process.argv[1]}`
);

if (isMainModule) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { MigrationScaffolder };
