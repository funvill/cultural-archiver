/**
 * Update Steven's User Permissions Script
 * 
 * This script updates the permissions for steven@abluestar.com (UUID: 6c970b24-f64a-49d9-8c5f-8ae23cc2af47)
 * to grant both moderator and admin permissions and ensure email verification is set correctly.
 */

import { grantPermission } from '../src/workers/lib/permissions';

// D1Database type for Cloudflare Workers
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  error?: string;
  meta: {
    served_by: string;
    duration: number;
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
  };
}

interface D1ExecResult {
  count: number;
  duration: number;
}

// User information
const STEVEN_UUID = '6c970b24-f64a-49d9-8c5f-8ae23cc2af47';
const STEVEN_EMAIL = 'steven@abluestar.com';
const SYSTEM_ADMIN_UUID = 'system';

interface UserRecord {
  uuid: string;
  email: string;
  created_at: string;
  last_login?: string;
  email_verified_at?: string;
  status: string;
}

interface PermissionRecord {
  id: string;
  user_uuid: string;
  permission: string;
  granted_by: string;
  granted_at: string;
  is_active: number;
  notes?: string;
}

/**
 * Check current user state
 */
async function checkUserState(db: D1Database): Promise<UserRecord | null> {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE uuid = ? OR email = ? LIMIT 1');
    const result = await stmt.bind(STEVEN_UUID, STEVEN_EMAIL).first();
    return result as UserRecord | null;
  } catch (error) {
    console.error('Error checking user state:', error);
    return null;
  }
}

/**
 * Check current permissions
 */
async function checkUserPermissions(db: D1Database): Promise<PermissionRecord[]> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM user_permissions 
      WHERE user_uuid = ? AND is_active = 1
      ORDER BY permission
    `);
    const result = await stmt.bind(STEVEN_UUID).all();
    return result.results as PermissionRecord[];
  } catch (error) {
    console.error('Error checking user permissions:', error);
    return [];
  }
}

/**
 * Create or update user record
 */
async function ensureUserExists(db: D1Database): Promise<boolean> {
  try {
    // First try to create user (if doesn't exist)
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO users (uuid, email, created_at, status, email_verified_at)
      VALUES (?, ?, datetime('now'), 'active', datetime('now'))
    `);
    
    await insertStmt.bind(STEVEN_UUID, STEVEN_EMAIL).run();

    // Then update to ensure email is verified and status is active
    const updateStmt = db.prepare(`
      UPDATE users 
      SET email_verified_at = datetime('now'), 
          status = 'active'
      WHERE uuid = ?
    `);
    
    const result = await updateStmt.bind(STEVEN_UUID).run();
    return result.success;
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    return false;
  }
}

/**
 * Main execution function
 */
export async function updateStevenPermissions(db: D1Database): Promise<void> {
  console.log('=== Updating Steven\'s User Permissions ===');
  console.log(`User: ${STEVEN_EMAIL}`);
  console.log(`UUID: ${STEVEN_UUID}`);
  console.log('');

  // Check current state
  console.log('📋 Checking current user state...');
  const currentUser = await checkUserState(db);
  if (currentUser) {
    console.log('✅ User found:', {
      uuid: currentUser.uuid,
      email: currentUser.email,
      status: currentUser.status,
      emailVerified: currentUser.email_verified_at ? 'yes' : 'no',
      createdAt: currentUser.created_at
    });
  } else {
    console.log('❌ User not found, will create...');
  }

  console.log('');
  console.log('📋 Checking current permissions...');
  const currentPermissions = await checkUserPermissions(db);
  if (currentPermissions.length > 0) {
    console.log('✅ Current permissions:');
    currentPermissions.forEach(perm => {
      console.log(`  - ${perm.permission} (granted by: ${perm.granted_by}, at: ${perm.granted_at})`);
    });
  } else {
    console.log('❌ No permissions found');
  }

  console.log('');
  console.log('🔧 Ensuring user exists with verified email...');
  const userCreated = await ensureUserExists(db);
  if (userCreated) {
    console.log('✅ User record updated/created successfully');
  } else {
    console.error('❌ Failed to create/update user record');
    return;
  }

  console.log('');
  console.log('🔑 Granting permissions...');

  // Grant moderator permission
  console.log('  Granting moderator permission...');
  const moderatorResult = await grantPermission(
    db,
    STEVEN_UUID,
    'moderator',
    SYSTEM_ADMIN_UUID,
    `Granted moderator permissions via administrative script for ${STEVEN_EMAIL}`
  );

  if (moderatorResult.success) {
    console.log('  ✅ Moderator permission granted');
  } else if (moderatorResult.error?.includes('already has')) {
    console.log('  ℹ️  Moderator permission already exists');
  } else {
    console.error('  ❌ Failed to grant moderator permission:', moderatorResult.error);
  }

  // Grant admin permission
  console.log('  Granting admin permission...');
  const adminResult = await grantPermission(
    db,
    STEVEN_UUID,
    'admin',
    SYSTEM_ADMIN_UUID,
    `Granted admin permissions via administrative script for ${STEVEN_EMAIL}`
  );

  if (adminResult.success) {
    console.log('  ✅ Admin permission granted');
  } else if (adminResult.error?.includes('already has')) {
    console.log('  ℹ️  Admin permission already exists');
  } else {
    console.error('  ❌ Failed to grant admin permission:', adminResult.error);
  }

  console.log('');
  console.log('🔍 Verifying final state...');
  
  // Check final user state
  const finalUser = await checkUserState(db);
  if (finalUser) {
    console.log('✅ Final user state:', {
      uuid: finalUser.uuid,
      email: finalUser.email,
      status: finalUser.status,
      emailVerified: finalUser.email_verified_at ? 'yes' : 'no',
      emailVerifiedAt: finalUser.email_verified_at
    });
  }

  // Check final permissions
  const finalPermissions = await checkUserPermissions(db);
  console.log('✅ Final permissions:');
  if (finalPermissions.length > 0) {
    finalPermissions.forEach(perm => {
      console.log(`  - ${perm.permission} (granted by: ${perm.granted_by}, at: ${perm.granted_at})`);
    });
  } else {
    console.log('  ❌ No permissions found');
  }

  console.log('');
  console.log('🎉 Permission update completed!');
}

// If running directly (for testing)
if (require.main === module) {
  console.error('This script requires a D1 database connection. Use it within a Cloudflare Worker context.');
}
