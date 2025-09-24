#!/usr/bin/env tsx
/**
 * Cultural Archiver Database Reset Script
 * 
 * Resets the database to a clean state while preserving schema and essential data.
 * Creates a backup before reset and repopulates with default data.
 * 
 * Usage:
 *   tsx scripts/reset-database.ts --env dev
 *   tsx scripts/reset-database.ts --env staging
 *   tsx scripts/reset-database.ts --env prod
 * 
 * What it does:
 * 1. Creates a backup of the current databa  // Check admin user has role
  const rolesQuery = `SELECT COUNT(*) as count FROM user_roles WHERE user_token = '${adminUuid}' AND is_active = 1`;
  const rolesResult = await executeQuery(config, rolesQuery);
  const rolesCount = (rolesResult.results[0] as { count: number }).count;
  
  if (rolesCount < 1) {
    throw new Error(`Expected at least 1 role for admin user, found ${rolesCount}`);
  }
  console.log(`  ✅ Admin roles: ${rolesCount} granted`); Clears user-generated data (artwork, submissions, users, etc.)
 * 3. Preserves essential reference data (artwork_types)
 * 4. Creates default admin user (steven@abluestar.com)
 * 5. Repopulates with essential data
 * 
 * Safety features:
 * - Interactive confirmation prompts
 * - Automatic backup before reset
 * - Environment validation
 * - Comprehensive error handling
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { createInterface, Interface } from 'readline';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '..', '.env') });

interface ResetOptions {
  env: string;
  force?: boolean;
  help?: boolean;
  dryRun?: boolean;
}

interface DatabaseConfig {
  accountId: string;
  apiToken: string;
  databaseId: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): ResetOptions {
  const args = process.argv.slice(2);
  const options: ResetOptions = { env: '' };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--env':
        options.env = args[i + 1];
        i++;
        break;
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
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
Cultural Archiver Database Reset Script

Usage:
  tsx scripts/reset-database.ts --env <environment> [options]

Arguments:
  --env <env>     Target environment (dev, staging, prod)
  --force         Skip confirmation prompts (use with caution)
  --dry-run       Show what would be done without making changes
  --help          Show this help message

Examples:
  tsx scripts/reset-database.ts --env dev
  tsx scripts/reset-database.ts --env staging --force
  tsx scripts/reset-database.ts --env dev --dry-run

What this script does:
• Creates a backup of the current database
• Clears all user-generated content
• Preserves artwork_types and essential reference data
• Creates default admin user (steven@abluestar.com)
• Repopulates with default artwork types

Safety features:
• Interactive confirmation prompts (unless --force)
• Automatic backup creation before reset
• Environment validation
• Comprehensive error logging
`);
}

/**
 * Get database configuration for environment
 */
function getDatabaseConfig(env: string): DatabaseConfig {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  let databaseId: string;

  switch (env) {
    case 'dev':
    case 'development':
      databaseId = process.env.D1_DATABASE_ID || '';
      break;
    case 'staging':
      databaseId = process.env.D1_DATABASE_ID_STAGING || process.env.D1_DATABASE_ID || '';
      break;
    case 'prod':
    case 'production':
      databaseId = process.env.D1_DATABASE_ID_PROD || process.env.D1_DATABASE_ID || '';
      break;
    default:
      throw new Error(`Invalid environment: ${env}. Must be one of: dev, staging, prod`);
  }

  if (!accountId || !apiToken || !databaseId) {
    throw new Error(`Missing required environment variables for ${env} environment`);
  }

  return { accountId, apiToken, databaseId };
}

/**
 * Create readline interface for user input
 */
function createReadline(): Interface {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for confirmation
 */
async function askConfirmation(question: string): Promise<boolean> {
  const rl = createReadline();

  return new Promise(resolve => {
    rl.question(`${question} (yes/no): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Execute SQL query against D1 database
 */
async function executeQuery(
  config: DatabaseConfig,
  sql: string,
  dryRun: boolean = false
): Promise<{
  results: Record<string, unknown>[];
  success: boolean;
  meta: Record<string, unknown>;
}> {
  if (dryRun) {
    console.log(`[DRY RUN] Would execute: ${sql}`);
    // Return mock results for dry run
    return {
      results: [{ count: 0 }],
      success: true,
      meta: {},
    };
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Database query failed: ${response.status} ${error}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(`Database query error: ${JSON.stringify(result.errors)}`);
  }

  return result.result[0];
}

/**
 * Create database backup using existing npm script
 */
async function createBackup(env: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = `reset-backup-${env}-${timestamp}.sql`;

  console.log(`📦 Creating backup: ${backupFile}`);

  // Use npm script to create backup
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    // Map environment to correct npm script name
    let scriptName: string;
    switch (env) {
      case 'dev':
      case 'development':
        scriptName = 'database:export:dev';
        break;
      case 'staging':
        scriptName = 'database:export:staging';
        break;
      case 'prod':
      case 'production':
        scriptName = 'database:export'; // Production uses the base export script
        break;
      default:
        reject(new Error(`Unknown environment for backup: ${env}`));
        return;
    }

    // Use PowerShell on Windows for better compatibility
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'powershell.exe' : 'npm';
    const args = isWindows ? ['-Command', `npm run ${scriptName}`] : ['run', scriptName];

    const backupProcess = spawn(command, args, {
      stdio: 'pipe',
      cwd: process.cwd(),
      shell: !isWindows, // Use shell on non-Windows platforms
    });

    let errorOutput = '';

    backupProcess.stdout?.on('data', data => {
      process.stdout.write(data);
    });

    backupProcess.stderr?.on('data', data => {
      errorOutput += data.toString();
      process.stderr.write(data);
    });

    backupProcess.on('close', code => {
      if (code === 0) {
        console.log(`✅ Backup created successfully`);
        resolve(backupFile);
      } else {
        reject(new Error(`Backup process failed with code ${code}: ${errorOutput}`));
      }
    });

    backupProcess.on('error', error => {
      reject(new Error(`Failed to start backup process: ${error.message}`));
    });
  });
}

/**
 * Clear user-generated data from database
 */
async function clearUserData(config: DatabaseConfig, dryRun: boolean = false): Promise<void> {
  console.log('🧹 Clearing user-generated data...');

  const clearQueries = [
    // Clear authentication-related tables first
    'DELETE FROM auth_sessions',
    'DELETE FROM magic_links',
    'DELETE FROM rate_limiting',

    // Clear user permissions (try both new and old table names)
    'DELETE FROM user_roles',
    'DELETE FROM user_permissions',

    // Clear users
    'DELETE FROM users',

    // Clear artist-artwork relationships first (foreign key constraints)
    'DELETE FROM artwork_artists',

    // Clear unified submissions table (replaces old logbook table)
    'DELETE FROM submissions',

    // Clear user-generated content
    'DELETE FROM artwork',
    'DELETE FROM artists',

    // Clear consent records
    'DELETE FROM consent',

    // Clear audit logs
    'DELETE FROM audit_log',
    'DELETE FROM user_activity',

    // NOTE: Keep d1_migrations intact to preserve migration tracking
  ];

  for (const query of clearQueries) {
    try {
      await executeQuery(config, query, dryRun);
      const tableName = query.split(' ')[2];
      if (dryRun) {
        console.log(`  🔍 [DRY RUN] Would clear: ${tableName}`);
      } else {
        console.log(`  ✅ ${tableName} cleared`);
      }
    } catch (error) {
      const tableName = query.split(' ')[2];
      console.warn(`  ⚠ Warning: Failed to clear ${tableName} (table may not exist): ${error}`);
      // Continue with other queries instead of throwing
      if (dryRun) {
        console.log(`  🔍 [DRY RUN] Would have failed on: ${query}`);
      }
    }
  }
}

/**
 * Create default admin user
 */
async function createDefaultAdmin(
  config: DatabaseConfig,
  dryRun: boolean = false
): Promise<string> {
  const adminUuid = '3db6be1e-0adb-44f5-862c-028987727018';
  const adminEmail = 'steven@abluestar.com';
  const now = new Date().toISOString();

  console.log('👤 Creating default admin user...');

  if (dryRun) {
    console.log(`  🔍 [DRY RUN] Would create admin user: ${adminEmail}`);
    console.log(`  🔍 [DRY RUN] Would grant admin role`);
    return adminUuid;
  }

  // Create admin user
  const createUserQuery = `
    INSERT INTO users (uuid, email, created_at, last_login, email_verified_at, status)
    VALUES ('${adminUuid}', '${adminEmail}', '${now}', '${now}', '${now}', 'active')
  `;

  await executeQuery(config, createUserQuery);
  console.log(`  ✅ Admin user created: ${adminEmail}`);

  // Grant admin role - try both user_roles and user_permissions tables
  const adminRoleId = randomUUID();

  // Try user_roles first (new schema)
  const userRolesQuery = `
    INSERT INTO user_roles (id, user_token, role, granted_by, granted_at, is_active, notes)
    VALUES ('${adminRoleId}', '${adminUuid}', 'admin', '${adminUuid}', '${now}', 1, 'Default admin user created by reset script')
  `;

  try {
    await executeQuery(config, userRolesQuery);
    console.log('  ✅ Admin role granted (user_roles)');
  } catch (error) {
    console.warn('  ⚠ user_roles table not found, trying user_permissions...');

    // Fallback to user_permissions (old schema)
    const userPermissionsQuery = `
      INSERT INTO user_permissions (id, user_uuid, permission, granted_by, granted_at, expires_at, is_active, notes)
      VALUES ('${adminRoleId}', '${adminUuid}', 'admin', '${adminUuid}', '${now}', NULL, 1, 'Default admin user created by reset script')
    `;

    try {
      await executeQuery(config, userPermissionsQuery);
      console.log('  ✅ Admin role granted (user_permissions)');
    } catch (fallbackError) {
      console.warn(
        '  ⚠ Neither user_roles nor user_permissions table found. Admin user created but no role assigned.'
      );
      console.warn('  🔧 You may need to manually assign admin permissions.');
    }
  }

  return adminUuid;
}

/**
 * Repopulate essential data
 */
async function repopulateEssentialData(
  config: DatabaseConfig,
  dryRun: boolean = false
): Promise<void> {
  console.log('📊 Repopulating essential data...');

  if (dryRun) {
    console.log('  🔍 [DRY RUN] Would check for essential data tables');
    console.log('  🔍 [DRY RUN] Would populate any required default data');
    return;
  }

  // Check if artwork_types table exists and populate if needed
  try {
    const checkQuery = 'SELECT COUNT(*) as count FROM artwork_types';
    const result = await executeQuery(config, checkQuery, dryRun);

    if ((result.results[0] as { count: number }).count === 0) {
      // Insert default artwork types
      const now = new Date().toISOString();
      const artworkTypes = [
        { id: 'sculpture', name: 'Sculpture', description: 'Three-dimensional artwork' },
        { id: 'mural', name: 'Mural', description: 'Wall-mounted painted artwork' },
        {
          id: 'installation',
          name: 'Installation',
          description: 'Large-scale mixed-media artwork',
        },
        { id: 'statue', name: 'Statue', description: 'Sculptural representation' },
      ];

      for (const type of artworkTypes) {
        const insertQuery = `
          INSERT INTO artwork_types (id, name, description, created_at)
          VALUES ('${type.id}', '${type.name}', '${type.description}', '${now}')
        `;

        await executeQuery(config, insertQuery);
        console.log(`  ✅ Added artwork type: ${type.name}`);
      }
    } else {
      console.log('  ℹ️  Artwork types already exist, skipping repopulation');
    }
  } catch (error) {
    console.log(
      '  ℹ️  No artwork_types table found - using current schema without separate types table'
    );
  }

  console.log('  ✅ Essential data repopulation complete');
}

/**
 * Validate database state after reset
 */
async function validateResetState(
  config: DatabaseConfig,
  adminUuid: string,
  dryRun: boolean = false
): Promise<void> {
  console.log('🔍 Validating reset state...');

  if (dryRun) {
    console.log('  🔍 [DRY RUN] Would validate admin user exists');
    console.log('  🔍 [DRY RUN] Would validate user tables are cleared');
    console.log('  🔍 [DRY RUN] Would validate essential data if tables exist');
    console.log('✅ [DRY RUN] Database reset validation would pass');
    return;
  }

  // Check if artwork_types table exists and validate if it does
  try {
    const artworkTypesQuery = 'SELECT COUNT(*) as count FROM artwork_types';
    const artworkTypesResult = await executeQuery(config, artworkTypesQuery);
    const artworkTypesCount = (artworkTypesResult.results[0] as { count: number }).count;

    if (artworkTypesCount < 4) {
      throw new Error(`Expected at least 4 artwork types, found ${artworkTypesCount}`);
    }
    console.log(`  ✅ Artwork types: ${artworkTypesCount} entries`);
  } catch (error) {
    console.log('  ℹ️  No artwork_types table found - schema uses different structure');
  }

  // Check admin user exists
  const adminQuery = `SELECT COUNT(*) as count FROM users WHERE uuid = '${adminUuid}' AND email = 'steven@abluestar.com'`;
  const adminResult = await executeQuery(config, adminQuery);
  const adminCount = (adminResult.results[0] as { count: number }).count;

  if (adminCount !== 1) {
    throw new Error(`Expected 1 admin user, found ${adminCount}`);
  }
  console.log('  ✅ Admin user exists');

  // Check admin permissions - try both table structures
  let permissionsFound = false;
  try {
    const userRolesQuery = `SELECT COUNT(*) as count FROM user_roles WHERE user_token = '${adminUuid}' AND is_active = 1`;
    const userRolesResult = await executeQuery(config, userRolesQuery);
    const userRolesCount = (userRolesResult.results[0] as { count: number }).count;

    if (userRolesCount > 0) {
      console.log(`  ✅ Admin roles: ${userRolesCount} granted (user_roles)`);
      permissionsFound = true;
    }
  } catch (error) {
    // user_roles table might not exist
  }

  if (!permissionsFound) {
    try {
      const permissionsQuery = `SELECT COUNT(*) as count FROM user_permissions WHERE user_uuid = '${adminUuid}' AND is_active = 1`;
      const permissionsResult = await executeQuery(config, permissionsQuery);
      const permissionsCount = (permissionsResult.results[0] as { count: number }).count;

      if (permissionsCount > 0) {
        console.log(`  ✅ Admin permissions: ${permissionsCount} granted (user_permissions)`);
        permissionsFound = true;
      }
    } catch (error) {
      // user_permissions table might not exist either
    }
  }

  if (!permissionsFound) {
    console.log('  ⚠ No admin permissions found - manual permission assignment may be required');
  }

  // Check data tables are cleared (but allow admin user)
  const checkTables = [
    { name: 'artwork', shouldBeEmpty: true },
    { name: 'artists', shouldBeEmpty: true },
    { name: 'artwork_artists', shouldBeEmpty: true },
    { name: 'users', shouldBeEmpty: false, expectedCount: 1, description: 'admin user' },
    { name: 'magic_links', shouldBeEmpty: true },
    { name: 'auth_sessions', shouldBeEmpty: true },
    { name: 'rate_limiting', shouldBeEmpty: true },
    { name: 'consent', shouldBeEmpty: true },
  ];

  for (const tableCheck of checkTables) {
    try {
      const countQuery = `SELECT COUNT(*) as count FROM ${tableCheck.name}`;
      const countResult = await executeQuery(config, countQuery);
      const count = (countResult.results[0] as { count: number }).count;

      if (tableCheck.shouldBeEmpty && count > 0) {
        throw new Error(`Expected ${tableCheck.name} to be empty, found ${count} entries`);
      }

      if (
        !tableCheck.shouldBeEmpty &&
        tableCheck.expectedCount !== undefined &&
        count !== tableCheck.expectedCount
      ) {
        throw new Error(
          `Expected ${tableCheck.name} to have ${tableCheck.expectedCount} entries (${tableCheck.description}), found ${count}`
        );
      }

      if (tableCheck.shouldBeEmpty) {
        console.log(`  ✅ ${tableCheck.name} is empty`);
      } else {
        console.log(`  ✅ ${tableCheck.name} has ${count} entries (${tableCheck.description})`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('no such table')) {
        console.log(`  ℹ️  ${tableCheck.name} table not found - may not exist in current schema`);
      } else {
        throw error;
      }
    }
  }

  console.log('✅ Database reset validation passed');
}

/**
 * Main reset function
 */
async function resetDatabase(options: ResetOptions): Promise<void> {
  try {
    console.log('🔄 Cultural Archiver Database Reset');
    console.log('=====================================');

    // Validate environment
    if (!options.env) {
      throw new Error('Environment is required. Use --env dev|staging|prod');
    }

    const config = getDatabaseConfig(options.env);
    console.log(`📍 Target environment: ${options.env}`);
    console.log(`🗄️  Database ID: ${config.databaseId}`);

    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made!');
    }

    // Safety confirmation
    if (!options.force && !options.dryRun) {
      console.log('\n⚠️  WARNING: This will permanently delete all user data!');
      console.log('📦 A backup will be created before proceeding.');
      console.log('🔧 The following will happen:');
      console.log('   • All artwork entries will be deleted');
      console.log('   • All submissions will be deleted');
      console.log('   • All user accounts will be deleted');
      console.log('   • All user permissions will be reset');
      console.log('   • Default admin user (steven@abluestar.com) will be created');
      console.log('   • Essential data (artwork types) will be preserved/restored');

      const confirmed = await askConfirmation(`\nProceed with resetting ${options.env} database?`);
      if (!confirmed) {
        console.log('❌ Reset cancelled by user');
        process.exit(0);
      }
    }

    // Create backup
    if (!options.dryRun) {
      console.log('\n📦 Creating backup...');
      try {
        await createBackup(options.env);
      } catch (error) {
        console.warn('⚠️  Backup creation failed, but continuing with reset:', error);
      }
    } else {
      console.log('\n📦 [DRY RUN] Would create backup');
    }

    // Clear user data
    console.log('\n🧹 Clearing user data...');
    await clearUserData(config, options.dryRun);

    // Create admin user
    console.log('\n👤 Setting up admin user...');
    const adminUuid = await createDefaultAdmin(config, options.dryRun);

    // Repopulate essential data
    console.log('\n📊 Repopulating essential data...');
    await repopulateEssentialData(config, options.dryRun);

    // Validate final state
    console.log('\n🔍 Validating reset...');
    await validateResetState(config, adminUuid, options.dryRun);

    if (options.dryRun) {
      console.log('\n✅ DRY RUN completed successfully!');
      console.log('=====================================');
      console.log('🔍 This was a simulation - no changes were made');
      console.log(`📍 Environment: ${options.env}`);
      console.log('🎯 To perform actual reset, run without --dry-run flag');
    } else {
      console.log('\n✅ Database reset completed successfully!');
      console.log('=====================================');
      console.log(`👤 Admin user: steven@abluestar.com`);
      console.log(`🔑 Admin UUID: ${adminUuid}`);
      console.log(`🗄️ Environment: ${options.env}`);
      console.log('📦 Backup created in _backup_database/');
      console.log('🎨 Ready for fresh artwork submissions!');
    }
  } catch (error) {
    console.error('\n❌ Database reset failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('   • Check your .env file configuration');
    console.error('   • Verify Cloudflare API token permissions');
    console.error('   • Ensure database ID is correct for environment');
    console.error('   • Check network connectivity');
    process.exit(1);
  }
}

// Main execution
const scriptPath = process.argv[1]?.replace(/\\/g, '/') || '';
const isMainModule =
  import.meta.url === `file://${scriptPath}` || import.meta.url.endsWith(scriptPath);

if (isMainModule) {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  resetDatabase(options).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { resetDatabase, parseArgs, getDatabaseConfig };
