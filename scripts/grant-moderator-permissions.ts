/**
 * Grant Moderator Permissions Script
 * 
 * This script grants moderator permissions to specified email addresses.
 * It handles user creation if they don't exist and uses the permission system.
 */

import { grantPermission } from '../src/workers/lib/permissions';

// Users to grant moderator permissions
const MODERATOR_EMAILS = [
  'steven@abluestar.com',
  'moderator@funvill.com'
];

// Admin user UUID (system admin for granting permissions)
const SYSTEM_ADMIN_UUID = 'system';

interface UserRecord {
  uuid: string;
  email: string;
  created_at: string;
  last_login?: string;
  email_verified_at?: string;
  status: string;
}

/**
 * Check if a user exists by email
 */
async function findUserByEmail(db: D1Database, email: string): Promise<UserRecord | null> {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    const result = await stmt.bind(email).first();
    return result as UserRecord | null;
  } catch (error) {
    console.error(`Error finding user ${email}:`, error);
    return null;
  }
}

/**
 * Create a new user with email and generated UUID
 */
async function createUser(db: D1Database, email: string): Promise<UserRecord | null> {
  try {
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO users (uuid, email, created_at, status, email_verified_at)
      VALUES (?, ?, ?, 'active', ?)
    `);
    
    const result = await stmt.bind(uuid, email, now, now).run();
    
    if (result.success) {
      console.log(`✅ Created new user: ${email} with UUID: ${uuid}`);
      return {
        uuid,
        email,
        created_at: now,
        email_verified_at: now,
        status: 'active'
      };
    } else {
      console.error(`❌ Failed to create user ${email}:`, result.error);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error creating user ${email}:`, error);
    return null;
  }
}

/**
 * Grant moderator permission to a user
 */
async function grantModeratorPermission(db: D1Database, userUuid: string, email: string): Promise<boolean> {
  try {
    const result = await grantPermission(
      db,
      userUuid,
      'moderator',
      SYSTEM_ADMIN_UUID,
      `Granted moderator permissions to ${email} via management script`
    );
    
    if (result.success) {
      console.log(`✅ Granted moderator permissions to ${email} (${userUuid})`);
      return true;
    } else {
      console.error(`❌ Failed to grant moderator permissions to ${email}:`, result.error);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error granting moderator permissions to ${email}:`, error);
    return false;
  }
}

/**
 * Main function to process all moderator emails
 */
async function grantModeratorPermissions(db: D1Database): Promise<void> {
  console.log('🚀 Starting moderator permission grant process...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const email of MODERATOR_EMAILS) {
    console.log(`📧 Processing ${email}...`);
    
    // Check if user exists
    let user = await findUserByEmail(db, email);
    
    if (!user) {
      console.log(`   User not found, creating new user...`);
      user = await createUser(db, email);
      
      if (!user) {
        console.error(`   ❌ Failed to create user for ${email}`);
        errorCount++;
        continue;
      }
    } else {
      console.log(`   ✅ Found existing user: ${user.uuid}`);
    }
    
    // Grant moderator permission
    const granted = await grantModeratorPermission(db, user.uuid, email);
    
    if (granted) {
      successCount++;
    } else {
      errorCount++;
    }
    
    console.log(''); // Add spacing between users
  }
  
  console.log('📊 Summary:');
  console.log(`   ✅ Successfully processed: ${successCount} users`);
  console.log(`   ❌ Failed to process: ${errorCount} users`);
  console.log(`   📧 Total emails: ${MODERATOR_EMAILS.length}`);
}

/**
 * Export for use in other scripts or environments
 */
export { grantModeratorPermissions, MODERATOR_EMAILS };

/**
 * Direct execution with environment variable
 * Usage: node scripts/grant-moderator-permissions.js
 */
if (typeof process !== 'undefined' && process.env.DB_BINDING) {
  // This would be used if running in a Node.js environment with appropriate bindings
  console.log('This script needs to be run in a Cloudflare Workers environment with D1 database access.');
  console.log('Use wrangler commands or the admin API endpoints instead.');
}
