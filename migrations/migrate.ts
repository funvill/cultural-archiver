#!/usr/bin/env node
/**
 * Database Migration Runner for Cultural Archiver
 * Uses Node.js v23+ native TypeScript support
 *
 * Run with: node migrate.ts
 * Usage: node migrate.ts [up|down] [migration-number]
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
  databaseId?: string;
  databaseName?: string;
  accountId?: string;
  apiToken?: string;
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
    return {
      databaseId: process.env.D1_DATABASE_ID,
      databaseName: process.env.D1_DATABASE_NAME || 'cultural-archiver-dev',
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
    };
  }

  private async getMigrations(): Promise<MigrationInfo[]> {
    try {
      const files = await readdir(this.migrationsDir);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql') && /^\d{3}_/.test(file))
        .sort();

      return migrationFiles.map(filename => {
        const [number, ...nameParts] = filename.replace('.sql', '').split('_');
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
      console.warn('⚠️  D1_DATABASE_ID not configured. Cannot execute migration.');
      console.log('💡 To run migrations against Cloudflare D1:');
      console.log('   1. Set D1_DATABASE_ID environment variable');
      console.log('   2. Ensure wrangler is configured with your API token');
      console.log('   3. Run: wrangler d1 execute [database-name] --file=<migration-file>');
      return false;
    }

    try {
      // For development, we'll use wrangler CLI to execute migrations
      const { spawn } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(spawn);

      // Create temporary file for migration
      const { writeFile, unlink } = await import('fs/promises');
      const tempFile = join(this.migrationsDir, `temp_${Date.now()}.sql`);

      await writeFile(tempFile, sql);

      // Execute with wrangler
      const result = await new Promise<boolean>((resolve, reject) => {
        const wrangler = spawn(
          'wrangler',
          [
            'd1',
            'execute',
            this.config.databaseName!,
            '--file',
            tempFile,
            '--local', // Remove this flag for production database
          ],
          { stdio: 'inherit' }
        );

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
          success = await this.executeSqlWithWrangler(sql, migration.name);
        } else {
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
    console.log('  node migrate.ts                    Run all migrations');
    console.log('  node migrate.ts up                 Run all migrations (alias)');
    console.log('  node migrate.ts up 001             Run specific migration');
    console.log('  node migrate.ts list               List all migrations');
    console.log('  node migrate.ts help               Show this help');
    console.log('');
    console.log('Environment Variables:');
    console.log('  D1_DATABASE_ID         Cloudflare D1 Database ID');
    console.log('  D1_DATABASE_NAME       Database name (default: cultural-archiver-dev)');
    console.log('  CLOUDFLARE_ACCOUNT_ID  Cloudflare Account ID');
    console.log('  CLOUDFLARE_API_TOKEN   Cloudflare API Token');
    console.log('');
    console.log('Examples:');
    console.log('  D1_DATABASE_ID=abc123 node migrate.ts');
    console.log('  node migrate.ts up 001');
    console.log('  node migrate.ts list');
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
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Migration runner error:', error);
    process.exit(1);
  });
}

export { MigrationRunner };
