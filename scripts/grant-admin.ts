#!/usr/bin/env tsx
/**
 * Cultural Archiver Admin Privileges Script
 *
 * Grants admin privileges to a user by email address.
 * This script is designed for the common use case of granting admin access to steven@abluestar.com
 * and can be used for other users as well.
 *
 * Usage:
 *   tsx scripts/grant-admin.ts --env dev --email steven@abluestar.com
 *   tsx scripts/grant-admin.ts --env staging --email user@example.com
 *   tsx scripts/grant-admin.ts --env prod --email steven@abluestar.com
 *
 * What it does:
 * 1. Finds the user by email address in the users table
 * 2. Checks if the user already has admin privileges
 * 3. Grants admin role if not already present
 * 4. Creates user record if email doesn't exist
 *
 * Safety features:
 * - Environment validation
 * - User confirmation prompts
 * - Comprehensive error handling
 * - Dry run mode available
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

interface GrantAdminOptions {
  env: string;
  email?: string;
  force?: boolean;
  help?: boolean;
  dryRun?: boolean;
  fixOrphaned?: boolean;
}

interface DatabaseConfig {
  databaseId: string;
  accountId: string;
  apiToken: string;
}

interface User {
  uuid: string;
  email: string;
  status: string;
  created_at: string;
}

interface UserRole {
  id: string;
  user_token: string;
  role: string;
  is_active: number;
  granted_at: string;
}

/**
 * Parse command line arguments
 */
function parseArguments(): GrantAdminOptions {
  const args = process.argv.slice(2);
  const options: Partial<GrantAdminOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--env':
        options.env = args[++i];
        break;
      case '--email':
        options.email = args[++i];
        break;
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--fix-orphaned':
        options.fixOrphaned = true;
        break;
      case '--help':
        options.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`❌ Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options as GrantAdminOptions;
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
🔐 Cultural Archiver Admin Privileges Script

Usage: tsx scripts/grant-admin.ts [options]

Options:
  --env <environment>     Target environment (dev, staging, prod)
  --email <email>         Email address to grant admin privileges to
  --force                 Skip confirmation prompts
  --dry-run              Show what would be done without making changes
  --help                 Show this help message

Examples:
  tsx scripts/grant-admin.ts --env dev --email steven@abluestar.com
  tsx scripts/grant-admin.ts --env prod --email steven@abluestar.com --force
  tsx scripts/grant-admin.ts --env staging --email user@example.com --dry-run

Common use case:
  Grant admin privileges to steven@abluestar.com in development:
  tsx scripts/grant-admin.ts --env dev --email steven@abluestar.com
`);
}

/**
 * Validate arguments
 */
function validateArguments(options: GrantAdminOptions): void {
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.env) {
    console.error('❌ Environment is required. Use --env dev|staging|prod');
    process.exit(1);
  }

  if (!['dev', 'staging', 'prod'].includes(options.env)) {
    console.error('❌ Environment must be dev, staging, or prod');
    process.exit(1);
  }

  if (!options.email && !options.fixOrphaned) {
    console.error('❌ Email is required unless using --fix-orphaned. Use --email <email>');
    process.exit(1);
  }

  if (options.fixOrphaned && options.email) {
    console.error('❌ Cannot use both --email and --fix-orphaned options together');
    process.exit(1);
  }

  // Validate email format only if email is provided
  if (options.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(options.email)) {
      console.error('❌ Invalid email format');
      process.exit(1);
    }
  }
}

/**
 * Get database configuration for environment
 */
function getDatabaseConfig(env: string): DatabaseConfig {
  // Use the same database ID for all environments as defined in .env
  const databaseId = process.env.D1_DATABASE_ID;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!databaseId || !accountId || !apiToken) {
    console.error(`❌ Missing Cloudflare configuration for ${env} environment`);
    console.error('Required environment variables:');
    console.error('  D1_DATABASE_ID');
    console.error('  CLOUDFLARE_ACCOUNT_ID');
    console.error('  CLOUDFLARE_API_TOKEN');
    process.exit(1);
  }

  return { databaseId, accountId, apiToken };
}

/**
 * Execute a database query
 */
async function executeQuery(
  config: DatabaseConfig,
  sql: string
): Promise<{ results: unknown[]; meta: { duration: number } }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Database query failed: ${JSON.stringify(result.errors)}`);
    }

    return result.result[0];
  } catch (error) {
    console.error(`❌ Database query failed: ${error}`);
    throw error;
  }
}

/**
 * Find user by email
 */
async function findUserByEmail(config: DatabaseConfig, email: string): Promise<User | null> {
  const query = `SELECT uuid, email, status, created_at FROM users WHERE email = '${email}' LIMIT 1`;

  try {
    const result = await executeQuery(config, query);

    if (result.results && result.results.length > 0) {
      return result.results[0] as User;
    }

    return null;
  } catch (error) {
    console.error(`❌ Failed to find user by email: ${error}`);
    throw error;
  }
}

/**
 * Find existing admin roles without user records
 */
async function findOrphanedAdminRoles(config: DatabaseConfig): Promise<UserRole[]> {
  const query = `
    SELECT ur.id, ur.user_token, ur.role, ur.is_active, ur.granted_at
    FROM user_roles ur
    LEFT JOIN users u ON ur.user_token = u.uuid
    WHERE ur.role = 'admin' AND ur.is_active = 1 AND u.uuid IS NULL
  `;

  try {
    const result = await executeQuery(config, query);
    return result.results as UserRole[];
  } catch (error) {
    console.error(`❌ Failed to find orphaned admin roles: ${error}`);
    throw error;
  }
}

/**
 * Create user record for existing admin token
 */
async function createUserForAdminToken(
  config: DatabaseConfig,
  userToken: string,
  dryRun: boolean = false
): Promise<void> {
  const now = new Date().toISOString();

  // Generate email and profile based on the known admin token
  let email = 'admin@api.publicartregistry.com';
  let profileName = 'admin';

  if (userToken === '3db6be1e-0adb-44f5-862c-028987727018') {
    email = 'steven@abluestar.com';
    profileName = 'steven';
  }

  if (dryRun) {
    console.log(`  🔍 [DRY RUN] Would create user record for admin token: ${userToken}`);
    console.log(`  📧 Email: ${email}, Profile: ${profileName}`);
    return;
  }

  const query = `
    INSERT INTO users (uuid, email, created_at, last_login, email_verified_at, status, profile_name)
    VALUES ('${userToken}', '${email}', '${now}', '${now}', '${now}', 'active', '${profileName}')
  `;

  try {
    await executeQuery(config, query);
    console.log(`  ✅ User record created for admin token: ${userToken}`);
    console.log(`  📧 Email: ${email}, Profile: ${profileName}`);
  } catch (error) {
    console.error(`❌ Failed to create user record for admin token: ${error}`);
    throw error;
  }
}

/**
 * Check if user has admin role
 */
async function checkUserAdminRole(
  config: DatabaseConfig,
  userToken: string
): Promise<UserRole | null> {
  const query = `
    SELECT id, user_token, role, is_active, granted_at 
    FROM user_roles 
    WHERE user_token = '${userToken}' AND role = 'admin' AND is_active = 1 
    LIMIT 1
  `;

  try {
    const result = await executeQuery(config, query);

    if (result.results && result.results.length > 0) {
      return result.results[0] as UserRole;
    }

    return null;
  } catch (error) {
    console.error(`❌ Failed to check admin role: ${error}`);
    throw error;
  }
}

/**
 * Create user record
 */
async function createUser(
  config: DatabaseConfig,
  email: string,
  dryRun: boolean = false
): Promise<string> {
  const userUuid =
    email === 'steven@abluestar.com' ? '3db6be1e-0adb-44f5-862c-028987727018' : randomUUID();
  const now = new Date().toISOString();

  // Set profile name based on email
  let profileName = null;
  if (email === 'steven@abluestar.com') {
    profileName = 'steven';
  } else if (email.includes('@')) {
    // Use the part before @ as profile name, but ensure it's valid
    const username = email.split('@')[0];
    // Clean username to match profile name requirements (3-20 chars, alphanumeric + dash, no start/end dash)
    profileName = username.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 20);
    if (profileName.length < 3) {
      profileName = null; // Will be set later by user
    }
    if (profileName && (profileName.startsWith('-') || profileName.endsWith('-'))) {
      profileName = profileName.replace(/^-+|-+$/g, '');
    }
    if (profileName && profileName.length < 3) {
      profileName = null;
    }
  }

  if (dryRun) {
    console.log(
      `  🔍 [DRY RUN] Would create user: ${email} with UUID: ${userUuid}${profileName ? ` and profile: ${profileName}` : ''}`
    );
    return userUuid;
  }

  const query = `
    INSERT INTO users (uuid, email, created_at, last_login, email_verified_at, status, profile_name)
    VALUES ('${userUuid}', '${email}', '${now}', '${now}', '${now}', 'active', ${profileName ? `'${profileName}'` : 'NULL'})
  `;

  try {
    await executeQuery(config, query);
    console.log(`  ✅ User created: ${email}${profileName ? ` with profile: ${profileName}` : ''}`);
    console.log(`  🔑 User UUID: ${userUuid}`);
    return userUuid;
  } catch (error) {
    console.error(`❌ Failed to create user: ${error}`);
    throw error;
  }
}

/**
 * Grant admin role to user
 */
async function grantAdminRole(
  config: DatabaseConfig,
  userToken: string,
  email: string,
  dryRun: boolean = false
): Promise<void> {
  const roleId = randomUUID();
  const now = new Date().toISOString();

  if (dryRun) {
    console.log(`  🔍 [DRY RUN] Would grant admin role to user: ${email}`);
    return;
  }

  const query = `
    INSERT INTO user_roles (id, user_token, role, granted_by, granted_at, is_active, notes)
    VALUES ('${roleId}', '${userToken}', 'admin', 'system', '${now}', 1, 'Admin privileges granted by grant-admin script')
  `;

  try {
    await executeQuery(config, query);
    console.log(`  ✅ Admin role granted to: ${email}`);
  } catch (error) {
    console.error(`❌ Failed to grant admin role: ${error}`);
    throw error;
  }
}

/**
 * Prompt for user confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl: Interface = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${message} (y/N): `, answer => {
      rl.close();
      resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
    });
  });
}

/**
 * Main function to grant admin privileges
 */
async function grantAdminPrivileges(options: GrantAdminOptions): Promise<void> {
  if (!options.email) {
    throw new Error('Email is required for granting admin privileges');
  }

  console.log(`\n🔐 Cultural Archiver Admin Privileges Script`);
  console.log(`📧 Email: ${options.email}`);
  console.log(`🌍 Environment: ${options.env}`);
  console.log(`${options.dryRun ? '🔍 DRY RUN MODE - No changes will be made' : ''}\n`);

  // Get database configuration
  const config = getDatabaseConfig(options.env);
  console.log(`📊 Database ID: ${config.databaseId}\n`);

  // Confirmation for production
  if (options.env === 'prod' && !options.force && !options.dryRun) {
    const confirmed = await promptConfirmation(
      '⚠️  You are about to modify the PRODUCTION database. Are you sure?'
    );

    if (!confirmed) {
      console.log('❌ Operation cancelled by user');
      process.exit(0);
    }
  }

  try {
    // Find user by email
    console.log(`🔍 Looking for user with email: ${options.email}`);
    const existingUser = await findUserByEmail(config, options.email);

    let userToken: string;

    if (existingUser) {
      console.log(`  ✅ User found: ${existingUser.uuid}`);
      console.log(`  📅 Created: ${existingUser.created_at}`);
      console.log(`  📊 Status: ${existingUser.status}`);
      userToken = existingUser.uuid;

      // Check if user already has admin role
      console.log(`\n🔍 Checking admin privileges...`);
      const adminRole = await checkUserAdminRole(config, userToken);

      if (adminRole) {
        console.log(`  ✅ User already has admin privileges`);
        console.log(`  📅 Granted: ${adminRole.granted_at}`);
        console.log(`\n🎉 No action needed - user already has admin privileges!`);
        return;
      } else {
        console.log(`  ❌ User does not have admin privileges`);
      }
    } else {
      console.log(`  ❌ User not found - will create new user`);

      if (!options.force && !options.dryRun) {
        const confirmed = await promptConfirmation(`Create new user account for ${options.email}?`);

        if (!confirmed) {
          console.log('❌ Operation cancelled by user');
          process.exit(0);
        }
      }

      console.log(`\n👤 Creating user account...`);
      userToken = await createUser(config, options.email, options.dryRun);
    }

    // Grant admin role
    console.log(`\n🔐 Granting admin privileges...`);
    await grantAdminRole(config, userToken, options.email, options.dryRun);

    if (options.dryRun) {
      console.log(`\n🔍 DRY RUN COMPLETE - No actual changes were made`);
    } else {
      console.log(`\n🎉 Admin privileges successfully granted to: ${options.email}`);
      console.log(`🔑 User token: ${userToken}`);
    }
  } catch (error) {
    console.error(`\n❌ Failed to grant admin privileges: ${error}`);
    process.exit(1);
  }
}

/**
 * Fix orphaned admin roles (admin roles without user records)
 */
async function fixOrphanedAdminRoles(
  config: DatabaseConfig,
  dryRun: boolean = false
): Promise<void> {
  console.log('\n🔍 Checking for admin roles without user records...');

  const orphanedRoles = await findOrphanedAdminRoles(config);

  if (orphanedRoles.length === 0) {
    console.log('✅ No orphaned admin roles found');
    return;
  }

  console.log(`\n⚠️  Found ${orphanedRoles.length} admin role(s) without user records:`);
  for (const role of orphanedRoles) {
    console.log(`  📝 User Token: ${role.user_token} (granted: ${role.granted_at})`);
  }

  if (dryRun) {
    console.log('\n🔍 [DRY RUN] Would create user records for these admin tokens');
    for (const role of orphanedRoles) {
      await createUserForAdminToken(config, role.user_token, true);
    }
    return;
  }

  console.log('\n🔧 Creating user records for orphaned admin tokens...');
  for (const role of orphanedRoles) {
    await createUserForAdminToken(config, role.user_token, false);
  }

  console.log('✅ All orphaned admin roles have been fixed');
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const options = parseArguments();
    validateArguments(options);

    if (options.fixOrphaned) {
      // Fix orphaned admin roles
      const config = getDatabaseConfig(options.env);
      await fixOrphanedAdminRoles(config, options.dryRun);
    } else {
      // Grant admin privileges to specific email
      await grantAdminPrivileges(options);
    }
  } catch (error) {
    console.error(`❌ Script failed: ${error}`);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
