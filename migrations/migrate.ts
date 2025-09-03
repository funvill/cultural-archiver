#!/usr/bin/env node
/**
 * Database Migration Runner for Cultural Archiver
 * Uses Node.js v23+ native TypeScript support
 *
 * Run with: npm run migrate
 * Usage: npm run migrate [up|down] [migration-number]
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MigrationInfo {
  number: string;
  name: string;
  filename: string;
  path: string;
}

interface DatabaseConfig {
  databaseId: string | undefined;
  databaseName: string;
  accountId: string | undefined;
  apiToken: string | undefined;
}

class MigrationRunner {
  private migrationsDir: string;
  private config: DatabaseConfig;

  constructor() {
    this.migrationsDir = __dirname;
    this.config = this.loadConfig();
  }

  private loadConfig(): DatabaseConfig {
    // Load configuration from environment variables
    const config: DatabaseConfig = {
      databaseId: process.env.D1_DATABASE_ID,
      databaseName: process.env.D1_DATABASE_NAME || 'cultural-archiver-dev',
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
    };

    // Validate required environment variables for production migrations
    if (!config.databaseId) {
      console.warn('⚠️  D1_DATABASE_ID not set in environment variables');
    }
    if (!config.accountId) {
      console.warn('⚠️  CLOUDFLARE_ACCOUNT_ID not set in environment variables');
    }
    if (!config.apiToken) {
      console.warn('⚠️  CLOUDFLARE_API_TOKEN not set in environment variables');
    }

    return config;
  }

  private async getMigrations(): Promise<MigrationInfo[]> {
    try {
      const files = await readdir(this.migrationsDir);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql') && /^\d{3}_/.test(file))
        .sort();

      return migrationFiles.map(filename => {
        const parts = filename.replace('.sql', '').split('_');
        const number = parts[0];
        if (!number) {
          throw new Error(`Invalid migration filename format: ${filename}`);
        }
        const nameParts = parts.slice(1);
        return {
          number,
          name: nameParts.join('_'),
          filename,
          path: join(this.migrationsDir, filename),
        };
      });
    } catch (error) {
      console.error('Error reading migrations directory:', error);
      return [];
    }
  }

  private async readMigrationFile(migrationPath: string): Promise<string> {
    try {
      return await readFile(migrationPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read migration file: ${migrationPath}`);
    }
  }

  private async executeSqlWithWrangler(sql: string, migrationName: string): Promise<boolean> {
    console.log(`Executing migration: ${migrationName}`);

    if (!this.config.databaseId) {
      console.error('❌ D1_DATABASE_ID not configured. Cannot execute migration.');
      console.log('💡 To run migrations against Cloudflare D1:');
      console.log('   1. Set D1_DATABASE_ID environment variable in .env file');
      console.log('   2. Set CLOUDFLARE_API_TOKEN environment variable in .env file');
      console.log('   3. Ensure wrangler is configured with your API token');
      console.log('   4. Run: npm run migrate');
      return false;
    }

    if (!this.config.apiToken) {
      console.error('❌ CLOUDFLARE_API_TOKEN not configured. Cannot execute migration.');
      console.log('💡 Set CLOUDFLARE_API_TOKEN in your .env file');
      return false;
    }

    try {
      // For production, we'll use wrangler CLI to execute migrations
      const { spawn } = await import('child_process');

      // Create temporary file for migration
      const { writeFile, unlink } = await import('fs/promises');
      const tempFile = join(this.migrationsDir, `temp_${Date.now()}.sql`);

      await writeFile(tempFile, sql);

      // Prepare wrangler command for production database
      const wranglerArgs = [
        'd1',
        'execute',
        this.config.databaseName, // Use database name from wrangler.toml
        '--file',
        tempFile,
        '--env',
        'development', // Use development environment
      ];

      // Add remote flag to ensure we're hitting the actual database
      if (process.env.NODE_ENV === 'production' || process.env.MIGRATE_REMOTE === 'true') {
        wranglerArgs.push('--remote');
      }

      console.log(`🔧 Running: npx wrangler ${wranglerArgs.join(' ')}`);

      // Execute with wrangler using npx to ensure it's found
      // Change to workers directory where wrangler.toml is located
      const workersDir = join(dirname(this.migrationsDir), 'src', 'workers');
      
      const result = await new Promise<boolean>((resolve, reject) => {
        const wrangler = spawn('npx', ['wrangler', ...wranglerArgs], { 
          stdio: 'inherit',
          cwd: workersDir, // Run from workers directory
          env: {
            ...process.env,
            CLOUDFLARE_API_TOKEN: this.config.apiToken,
          },
          shell: true, // Use shell for Windows compatibility
        });

        wrangler.on('close', code => {
          unlink(tempFile).catch(console.warn); // Clean up temp file
          resolve(code === 0);
        });

        wrangler.on('error', error => {
          unlink(tempFile).catch(console.warn); // Clean up temp file
          reject(error);
        });
      });

      return result;
    } catch (error) {
      console.error(`Failed to execute migration ${migrationName}:`, error);
      return false;
    }
  }

  private async executeSqlDirect(sql: string, migrationName: string): Promise<boolean> {
    console.log(`📝 Migration SQL for ${migrationName}:`);
    console.log('----------------------------------------');
    console.log(sql);
    console.log('----------------------------------------');

    console.log('💡 To execute this migration:');
    console.log('   1. Copy the SQL above');
    console.log('   2. Run: wrangler d1 execute [database-name] --command="<SQL>"');
    console.log('   or save to file and run: wrangler d1 execute [database-name] --file=<file>');

    return true;
  }

  public async runMigration(migrationNumber?: string): Promise<void> {
    const migrations = await this.getMigrations();

    if (migrations.length === 0) {
      console.log('No migrations found.');
      return;
    }

    let migrationsToRun: MigrationInfo[];

    if (migrationNumber) {
      migrationsToRun = migrations.filter(m => m.number === migrationNumber);
      if (migrationsToRun.length === 0) {
        console.error(`Migration ${migrationNumber} not found.`);
        return;
      }
    } else {
      migrationsToRun = migrations;
    }

    console.log(`🚀 Running ${migrationsToRun.length} migration(s)...`);
    console.log(`📁 Database: ${this.config.databaseName}`);
    console.log('');

    for (const migration of migrationsToRun) {
      console.log(`📦 Processing migration ${migration.number}: ${migration.name}`);

      try {
        const sql = await this.readMigrationFile(migration.path);

        // Choose execution method based on configuration
        let success: boolean;
        if (this.config.databaseId && this.config.apiToken) {
          // Execute directly with wrangler if we have database ID and API token
          success = await this.executeSqlWithWrangler(sql, migration.name);
        } else {
          // Fall back to showing SQL for manual execution
          console.warn('⚠️  Missing required environment variables for automatic execution.');
          console.log('💡 Either set D1_DATABASE_ID and CLOUDFLARE_API_TOKEN in .env, or copy the SQL below:');
          success = await this.executeSqlDirect(sql, migration.name);
        }

        if (success) {
          console.log(`✅ Migration ${migration.number} completed successfully`);
        } else {
          console.error(`❌ Migration ${migration.number} failed`);
          break;
        }
      } catch (error) {
        console.error(`❌ Error processing migration ${migration.number}:`, error);
        break;
      }

      console.log('');
    }

    console.log('🎉 Migration process completed!');
  }

  public async listMigrations(): Promise<void> {
    const migrations = await this.getMigrations();

    console.log('📋 Available migrations:');
    console.log('');

    if (migrations.length === 0) {
      console.log('No migrations found.');
      return;
    }

    migrations.forEach(migration => {
      console.log(`  ${migration.number} - ${migration.name}`);
    });

    console.log('');
    console.log(`Total: ${migrations.length} migration(s)`);
  }

  public showHelp(): void {
    console.log('Cultural Archiver Migration Runner');
    console.log('');
    console.log('Usage:');
    console.log('  npm run migrate                    Run all migrations');
    console.log('  npm run migrate up                 Run all migrations (alias)');
    console.log('  npm run migrate up 001             Run specific migration');
    console.log('  npm run migrate list               List all migrations');
    console.log('  npm run migrate help               Show this help');
    console.log('');
    console.log('Required Environment Variables (.env file):');
    console.log('  D1_DATABASE_ID         Cloudflare D1 Database ID');
    console.log('  CLOUDFLARE_API_TOKEN   Cloudflare API Token with D1:Edit permission');
    console.log('');
    console.log('Optional Environment Variables:');
    console.log('  D1_DATABASE_NAME       Database name (default: cultural-archiver-dev)');
    console.log('  CLOUDFLARE_ACCOUNT_ID  Cloudflare Account ID');
    console.log('  NODE_ENV              Set to "production" for remote database');
    console.log('  MIGRATE_REMOTE        Set to "true" to force remote execution');
    console.log('');
    console.log('Examples:');
    console.log('  npm run migrate                    # Run all migrations with .env config');
    console.log('  npm run migrate up 001             # Run specific migration');
    console.log('  npm run migrate list               # List available migrations');
    console.log('');
    console.log('Setup:');
    console.log('  1. Copy .env.example to .env');
    console.log('  2. Fill in your Cloudflare credentials');
    console.log('  3. Run: npm run migrate');
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'up';
  const migrationNumber = args[1];

  const runner = new MigrationRunner();

  switch (command) {
    case 'up':
      await runner.runMigration(migrationNumber);
      break;
    case 'list':
      await runner.listMigrations();
      break;
    case 'help':
    case '--help':
    case '-h':
      runner.showHelp();
      break;
    default:
      if (command.match(/^\d{3}$/)) {
        // If first argument is a number, treat as migration number
        await runner.runMigration(command);
      } else {
        console.error(`Unknown command: ${command}`);
        runner.showHelp();
        process.exit(1);
      }
  }
}

// Only run if this file is executed directly
// Check if this file is being run directly (not imported)
const isMainModule = import.meta.url.includes('migrate.ts') && 
  (process.argv[1]?.includes('migrate.ts') || process.argv[1]?.includes('tsx'));

if (isMainModule) {
  main().catch(error => {
    console.error('Migration runner error:', error);
    process.exit(1);
  });
}

export { MigrationRunner };
