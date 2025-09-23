#!/usr/bin/env tsx
/**
 * Cultural Archiver Local Database Reset Script
 *
 * Resets the LOCAL SQLite database used by `wrangler dev` to a clean state.
 * This is different from the main reset script which targets remote Cloudflare D1.
 *
 * Usage:
 *   tsx scripts/reset-local-database.ts [--force] [--dry-run] [--help]
 *
 * What it does:
 * 1. Creates a backup of the current local database
 * 2. Deletes the local SQLite files used by wrangler dev
 * 3. Applies migrations to recreate the schema
 * 4. Optionally creates an admin user for testing
 *
 * Safety features:
 * - Interactive confirmation prompts
 * - Automatic backup before reset
 * - Dry-run mode to see what would happen
 * - Warns if dev server might be running
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, copyFileSync, rmSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ResetOptions {
  force?: boolean;
  help?: boolean;
  dryRun?: boolean;
  createAdmin?: boolean;
}

const LOCAL_DB_PATH = resolve(
  __dirname,
  '..',
  'src',
  'workers',
  '.wrangler',
  'state',
  'v3',
  'd1',
  'miniflare-D1DatabaseObject'
);
const BACKUP_DIR = resolve(__dirname, '..', '_backup_database');

/**
 * Parse command line arguments
 */
function parseArgs(): ResetOptions {
  const args = process.argv.slice(2);
  const options: ResetOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--create-admin':
        options.createAdmin = true;
        break;
      case '--help':
        options.help = true;
        break;
      default:
        if (!args[i].startsWith('--')) {
          console.error(`Unknown argument: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
Cultural Archiver Local Database Reset Script

Usage:
  tsx scripts/reset-local-database.ts [options]

Options:
  --force         Skip confirmation prompts (use with caution)
  --dry-run       Show what would be done without making changes
  --create-admin  Create an admin user after reset
  --help          Show this help message

Examples:
  tsx scripts/reset-local-database.ts
  tsx scripts/reset-local-database.ts --force --create-admin
  tsx scripts/reset-local-database.ts --dry-run

What this script does:
• Creates a backup of the current local database
• Deletes local SQLite files used by wrangler dev
• Applies migrations to recreate database schema
• Optionally creates an admin user for testing

Important:
• This only affects the LOCAL database used by 'npm run dev'
• Stop the development server before running this script
• Use 'npm run database:reset:dev' for remote database reset
`);
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${message} (yes/no): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Create backup of local database
 */
function backupLocalDatabase(dryRun: boolean = false): string | null {
  if (!existsSync(LOCAL_DB_PATH)) {
    console.log('📦 No local database found to backup');
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = `local-database-backup-${timestamp}.zip`;

  if (dryRun) {
    console.log(`📦 [DRY RUN] Would create backup: ${backupFile}`);
    return backupFile;
  }

  try {
    // Ensure backup directory exists
    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Copy all SQLite files to backup directory
    const files = readdirSync(LOCAL_DB_PATH);
    const sqliteFiles = files.filter(
      f => f.endsWith('.sqlite') || f.endsWith('.sqlite-wal') || f.endsWith('.sqlite-shm')
    );

    if (sqliteFiles.length > 0) {
      // Create a simple backup by copying the main SQLite file
      const mainDbFile = sqliteFiles.find(f => f.endsWith('.sqlite')) || sqliteFiles[0];
      const backupDbPath = resolve(BACKUP_DIR, `local-database-backup-${timestamp}.sqlite`);
      copyFileSync(resolve(LOCAL_DB_PATH, mainDbFile), backupDbPath);
      console.log(`📦 Local database backed up to: ${backupDbPath}`);
      return backupDbPath;
    } else {
      console.log('📦 No SQLite files found to backup');
      return null;
    }
  } catch (error) {
    console.error(`❌ Failed to create backup: ${error}`);
    throw error;
  }
}

/**
 * Delete local database files
 */
function deleteLocalDatabase(dryRun: boolean = false): void {
  if (!existsSync(LOCAL_DB_PATH)) {
    console.log('🗑️  No local database files to delete');
    return;
  }

  if (dryRun) {
    console.log('🗑️  [DRY RUN] Would delete local database files');
    return;
  }

  try {
    rmSync(LOCAL_DB_PATH, { recursive: true, force: true });
    console.log('🗑️  Local database files deleted');
  } catch (error) {
    console.error(`❌ Failed to delete local database: ${error}`);
    throw error;
  }
}

/**
 * Apply database migrations
 */
function applyMigrations(dryRun: boolean = false): void {
  if (dryRun) {
    console.log('🔧 [DRY RUN] Would apply database migrations');
    return;
  }

  try {
    console.log('🔧 Applying database migrations...');
    execSync(
      'npx wrangler d1 migrations apply cultural-archiver --env development --config src/workers/wrangler.toml',
      {
        cwd: resolve(__dirname, '..'),
        stdio: 'inherit',
      }
    );
    console.log('✅ Database migrations applied successfully');
  } catch (error) {
    console.error(`❌ Failed to apply migrations: ${error}`);
    throw error;
  }
}

/**
 * Create admin user for testing
 */
function createAdminUser(dryRun: boolean = false): void {
  if (dryRun) {
    console.log('👤 [DRY RUN] Would create admin user');
    return;
  }

  const adminUuid = '3db6be1e-0adb-44f5-862c-028987727018';
  const adminEmail = 'steven@abluestar.com';
  const now = new Date().toISOString();
  const roleId = randomUUID();

  try {
    console.log('👤 Creating admin user...');

    // Create admin user with correct schema
    const createUserCommand = `npx wrangler d1 execute cultural-archiver --command="INSERT INTO users (uuid, email, created_at, last_login, email_verified_at, status) VALUES ('${adminUuid}', '${adminEmail}', '${now}', '${now}', '${now}', 'active');" --env development --local --config src/workers/wrangler.toml`;

    execSync(createUserCommand, {
      cwd: resolve(__dirname, '..'),
      stdio: 'inherit',
    });

    // Grant admin role (try both table structures for compatibility)
    try {
      const grantRoleCommand = `npx wrangler d1 execute cultural-archiver --command="INSERT INTO user_roles (id, user_token, role, granted_by, granted_at, is_active, notes) VALUES ('${roleId}', '${adminUuid}', 'admin', '${adminUuid}', '${now}', 1, 'Local development admin user');" --env development --local --config src/workers/wrangler.toml`;

      execSync(grantRoleCommand, {
        cwd: resolve(__dirname, '..'),
        stdio: 'inherit',
      });
      console.log('✅ Admin user created with role');
    } catch (roleError) {
      console.warn('⚠ Admin user created but role assignment failed (table may not exist)');
    }
  } catch (error) {
    console.error(`❌ Failed to create admin user: ${error}`);
    throw error;
  }
}

/**
 * Remove sample data inserted by migrations
 */
function removeSampleData(dryRun: boolean = false): void {
  if (dryRun) {
    console.log('🧹 [DRY RUN] Would remove sample data from migrations');
    return;
  }

  try {
    console.log('🧹 Removing sample data...');
    const clearCommand = `npx wrangler d1 execute cultural-archiver --command="DELETE FROM submissions WHERE id LIKE 'e0000000-%'; DELETE FROM artwork_artists WHERE artwork_id LIKE 'c0000000-%'; DELETE FROM artwork WHERE id LIKE 'c0000000-%'; DELETE FROM artists WHERE id LIKE 'd0000000-%'; DELETE FROM user_roles WHERE user_token LIKE '%0000000-%'; DELETE FROM users WHERE uuid LIKE '%0000000-%';" --env development --local --config src/workers/wrangler.toml`;

    execSync(clearCommand, {
      cwd: resolve(__dirname, '..'),
      stdio: 'inherit',
    });
    console.log('✅ Sample data removed');
  } catch (error) {
    console.warn(`⚠ Warning: Failed to remove sample data: ${error}`);
    // Don't throw - this is not critical
  }
}

/**
 * Check if development server might be running
 */
function checkDevServer(): void {
  try {
    // Try to detect if wrangler dev is running by checking for typical ports
    const netstatOutput = execSync('netstat -ano | findstr :8787', { encoding: 'utf8' });
    if (netstatOutput.trim()) {
      console.log(
        '⚠️  WARNING: Port 8787 appears to be in use (development server may be running)'
      );
      console.log('📋 Please stop the development server with Ctrl+C before proceeding');
    }
  } catch (error) {
    // Port check failed, continue silently
  }
}

/**
 * Main reset function
 */
async function resetLocalDatabase(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  console.log('🔄 Cultural Archiver Local Database Reset');
  console.log('=========================================');

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
  }

  // Check for running dev server
  checkDevServer();

  // Show what will happen
  console.log('🔧 The following will happen:');
  console.log('   • Local SQLite database files will be deleted');
  console.log('   • Database schema will be recreated via migrations');
  console.log('   • Sample data from migrations will be removed');
  if (options.createAdmin) {
    console.log('   • Admin user (steven@abluestar.com) will be created');
  }
  console.log('   • A backup will be created before reset');

  // Confirm unless forced
  if (!options.force && !options.dryRun) {
    const confirmed = await promptConfirmation('⚠️  Proceed with resetting local database?');
    if (!confirmed) {
      console.log('❌ Operation cancelled');
      return;
    }
  }

  try {
    // Create backup
    const backupFile = backupLocalDatabase(options.dryRun);
    if (backupFile) {
      console.log(`✅ Backup created: ${backupFile}`);
    }

    // Delete local database
    deleteLocalDatabase(options.dryRun);

    // Apply migrations
    applyMigrations(options.dryRun);

    // Remove sample data
    removeSampleData(options.dryRun);

    // Create admin user if requested
    if (options.createAdmin) {
      createAdminUser(options.dryRun);
    }

    if (options.dryRun) {
      console.log('✅ [DRY RUN] Local database reset simulation completed');
    } else {
      console.log('✅ Local database reset completed successfully!');
      console.log('=====================================');
      console.log('🎨 Ready for development!');
      console.log('💡 Start the dev server with: npm run dev');
      if (options.createAdmin) {
        console.log('👤 Admin user: steven@abluestar.com');
        console.log('🔑 Admin UUID: 3db6be1e-0adb-44f5-862c-028987727018');
      }
    }
  } catch (error) {
    console.error('❌ Local database reset failed:', error);
    console.log('🔧 Troubleshooting:');
    console.log('   • Make sure the development server is stopped');
    console.log('   • Check file permissions in .wrangler directory');
    console.log('   • Verify wrangler CLI is installed and working');
    process.exit(1);
  }
}

// Run the script
resetLocalDatabase().catch(console.error);
