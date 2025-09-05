#!/usr/bin/env node
/**
 * Migration Scaffolding Tool for Cultural Archiver
 * Creates new D1-compatible migration files with proper numbering and templates
 * 
 * Usage: npm run migrate:create "migration_name"
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);
const migrationsDir = join(projectRoot, 'migrations');
const templatesDir = join(migrationsDir, 'templates');

interface MigrationInfo {
    number: number;
    filename: string;
}

class MigrationScaffolder {
    async getNextMigrationNumber(): Promise<number> {
        try {
            const files = await readdir(migrationsDir);
            const migrationFiles = files
                .filter(file => file.match(/^\d{4}_.*\.sql$/))
                .map(file => ({
                    number: parseInt(file.substring(0, 4)),
                    filename: file
                }))
                .sort((a, b) => a.number - b.number);

            if (migrationFiles.length === 0) {
                return 1;
            }

            return migrationFiles[migrationFiles.length - 1].number + 1;
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

    async createMigration(name: string): Promise<void> {
        if (!name || name.trim() === '') {
            console.error('❌ Migration name is required');
            console.error('Usage: npm run migrate:create "migration_name"');
            process.exit(1);
        }

        console.log('🚀 Creating new migration...');
        
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
        console.log('Features:');
        console.log('  • Automatic sequential numbering (0001, 0002, ...)');
        console.log('  • D1-compatible template with guidelines');
        console.log('  • Name sanitization and validation');
        console.log('  • Metadata injection (timestamp, author)');
    }
}

// Main execution
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        const scaffolder = new MigrationScaffolder();
        scaffolder.showHelp();
        return;
    }

    const migrationName = args[0];
    const scaffolder = new MigrationScaffolder();
    await scaffolder.createMigration(migrationName);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

export { MigrationScaffolder };