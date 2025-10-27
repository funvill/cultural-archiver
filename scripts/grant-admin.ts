#!/usr/bin/env tsx
/**
 * Cultural Archiver - Grant Admin Privileges Script
 * 
 * Grants admin and reviewer permissions to a user token in the production database.
 * 
 * Usage:
 *   npx tsx scripts/grant-admin.ts <user_token> [--env prod|staging|dev]
 * 
 * Examples:
 *   npx tsx scripts/grant-admin.ts user_34MfKoXVsLDz0usdiPsMS6JW9jT --env prod
 *   npx tsx scripts/grant-admin.ts 3db6be1e-0adb-44f5-862c-028987727018 --env staging
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '..', '.env') });

interface DatabaseConfig {
  accountId: string;
  apiToken: string;
  databaseId: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { userToken: string; env: string } {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Cultural Archiver - Grant Admin Privileges

Usage:
  npx tsx scripts/grant-admin.ts <user_token> [--env <environment>]

Arguments:
  user_token      The user token (UUID or Clerk user ID) to grant admin privileges
  --env <env>     Target environment (dev, staging, prod). Default: prod

Examples:
  npx tsx scripts/grant-admin.ts user_34MfKoXVsLDz0usdiPsMS6JW9jT --env prod
  npx tsx scripts/grant-admin.ts 3db6be1e-0adb-44f5-862c-028987727018 --env staging
    `);
    process.exit(0);
  }

  let userToken = '';
  let env = 'prod'; // Default to production

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env') {
      env = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      userToken = args[i];
    }
  }

  if (!userToken) {
    console.error('❌ Error: user_token is required');
    console.error('Usage: npx tsx scripts/grant-admin.ts <user_token> [--env prod|staging|dev]');
    process.exit(1);
  }

  return { userToken, env };
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
    console.error(`❌ Missing required environment variables for ${env} environment`);
    console.error('Required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, D1_DATABASE_ID');
    process.exit(1);
  }

  return { accountId, apiToken, databaseId };
}

/**
 * Execute SQL query against D1 database
 */
async function executeQuery(
  config: DatabaseConfig,
  sql: string
): Promise<{
  results: Record<string, unknown>[];
  success: boolean;
}> {
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
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(`Database query failed: ${JSON.stringify(result.errors)}`);
  }

  return result.result[0];
}

/**
 * Check if user already has a role
 */
async function checkExistingRole(
  config: DatabaseConfig,
  userToken: string,
  role: string
): Promise<boolean> {
  const query = `
    SELECT COUNT(*) as count 
    FROM user_roles 
    WHERE user_token = '${userToken}' 
      AND role = '${role}' 
      AND is_active = 1
  `;

  const result = await executeQuery(config, query);
  const count = (result.results[0] as { count: number }).count;
  return count > 0;
}

/**
 * Grant a role to a user
 */
async function grantRole(
  config: DatabaseConfig,
  userToken: string,
  role: string
): Promise<void> {
  const now = new Date().toISOString();
  const roleId = crypto.randomUUID();
  
  const query = `
    INSERT OR REPLACE INTO user_roles (id, user_token, role, granted_by, granted_at, is_active, notes)
    VALUES ('${roleId}', '${userToken}', '${role}', 'grant-admin-script', '${now}', 1, 'Granted by grant-admin.ts script')
  `;

  await executeQuery(config, query);
}

/**
 * Main function
 */
async function main() {
  const { userToken, env } = parseArgs();

  console.log('\n🔐 Cultural Archiver - Grant Admin Privileges');
  console.log('═'.repeat(60));
  console.log(`👤 User Token: ${userToken}`);
  console.log(`🌍 Environment: ${env.toUpperCase()}`);
  console.log('═'.repeat(60));

  try {
    // Get database configuration
    const config = getDatabaseConfig(env);
    console.log(`\n📊 Database ID: ${config.databaseId}`);

    // Check and grant admin role
    console.log('\n🔍 Checking admin role...');
    const hasAdmin = await checkExistingRole(config, userToken, 'admin');
    
    if (hasAdmin) {
      console.log('  ✅ User already has admin role');
    } else {
      console.log('  ➕ Granting admin role...');
      await grantRole(config, userToken, 'admin');
      console.log('  ✅ Admin role granted');
    }

    // Check and grant moderator role (reviewer)
    console.log('\n🔍 Checking moderator role...');
    const hasModerator = await checkExistingRole(config, userToken, 'moderator');
    
    if (hasModerator) {
      console.log('  ✅ User already has moderator role');
    } else {
      console.log('  ➕ Granting moderator role...');
      await grantRole(config, userToken, 'moderator');
      console.log('  ✅ Moderator role granted');
    }

    console.log('\n🎉 SUCCESS! Admin privileges granted');
    console.log('═'.repeat(60));
    console.log(`\n👤 User: ${userToken}`);
    console.log('🔑 Roles: admin, moderator');
    console.log(`🌍 Environment: ${env.toUpperCase()}\n`);

  } catch (error) {
    console.error('\n❌ ERROR:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
