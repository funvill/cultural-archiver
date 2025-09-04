/**
 * Admin Database Update Route
 * Temporary endpoint to update Steven's permissions
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { createSuccessResponse } from '../lib/errors';
import { grantPermission } from '../lib/permissions';

const STEVEN_UUID = '6c970b24-f64a-49d9-8c5f-8ae23cc2af47';
const STEVEN_EMAIL = 'steven@abluestar.com';

/**
 * POST /api/dev/update-steven-permissions
 * Temporary endpoint to update Steven's user record and permissions
 */
export async function updateStevenPermissions(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  try {
    console.log('=== Starting Steven Permission Update ===');
    
    // Step 0: Check database schema first
    console.log('🔍 Checking database schema...');
    try {
      const schemaQuery = c.env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_permissions'");
      const schemaResult = await schemaQuery.first();
      console.log('user_permissions table schema:', schemaResult);
      
      const usersSchemaQuery = c.env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
      const usersSchemaResult = await usersSchemaQuery.first();
      console.log('users table schema:', usersSchemaResult);
    } catch (error) {
      console.log('Schema check error (tables might not exist):', error);
    }
    
    // Step 1: Check current user state
    console.log('📋 Checking current user state...');
    try {
      const userQuery = c.env.DB.prepare('SELECT * FROM users WHERE uuid = ? OR email = ? LIMIT 1');
      const currentUser = await userQuery.bind(STEVEN_UUID, STEVEN_EMAIL).first();
      
      if (currentUser) {
        console.log('✅ User found:', {
          uuid: currentUser.uuid,
          email: currentUser.email,
          status: currentUser.status,
          emailVerified: currentUser.email_verified_at ? 'yes' : 'no'
        });
      } else {
        console.log('❌ User not found, will create...');
      }
    } catch (error) {
      console.log('User check error (users table might not exist):', error);
    }
    
    // Step 2: Check if user_permissions table exists
    console.log('📋 Checking permissions table...');
    try {
      const permQuery = c.env.DB.prepare('SELECT COUNT(*) as count FROM user_permissions LIMIT 1');
      const permResult = await permQuery.first();
      console.log('✅ user_permissions table exists, record count check:', permResult);
    } catch (error) {
      console.log('❌ user_permissions table does not exist or has schema issues:', error);
      // Return early information about what we found
      return c.json({
        success: false,
        error: 'Database schema not ready - permissions table missing or has schema issues',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          recommendation: 'Run database migrations first'
        }
      }, 500);
    }
    
    // Step 3: Create or update user if users table exists
    console.log('🔧 Creating/updating user record...');
    
    try {
      // First try to create user (if doesn't exist)
      const insertStmt = c.env.DB.prepare(`
        INSERT OR IGNORE INTO users (uuid, email, created_at, status, email_verified_at)
        VALUES (?, ?, datetime('now'), 'active', datetime('now'))
      `);
      
      const insertResult = await insertStmt.bind(STEVEN_UUID, STEVEN_EMAIL).run();
      console.log('User insert result:', insertResult.success);
      
      // Then update to ensure email is verified and status is active
      const updateStmt = c.env.DB.prepare(`
        UPDATE users 
        SET email_verified_at = datetime('now'), 
            status = 'active'
        WHERE uuid = ?
      `);
      
      const updateResult = await updateStmt.bind(STEVEN_UUID).run();
      console.log('✅ User record updated:', updateResult.success);
    } catch (error) {
      console.error('❌ Failed to create/update user:', error);
      return c.json({
        success: false,
        error: 'Failed to create/update user record',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
    
    // Step 4: Grant permissions using the proper schema
    console.log('🔑 Granting permissions...');
    
    const results: {
      userCreated: boolean;
      permissions: Record<string, unknown>;
      kvStoreUpdated: boolean;
      kvError?: string;
    } = {
      userCreated: true,
      permissions: {},
      kvStoreUpdated: false
    };
    
    // Check if user_permissions table has is_active column
    try {
      const testQuery = c.env.DB.prepare('SELECT is_active FROM user_permissions LIMIT 1');
      await testQuery.first();
      console.log('✅ is_active column exists, using full grantPermission function');
      
      // Use the grantPermission function
      const moderatorResult = await grantPermission(
        c.env.DB,
        STEVEN_UUID,
        'moderator',
        'system',
        `Granted moderator permissions via admin endpoint for ${STEVEN_EMAIL}`
      );
      results.permissions.moderator = moderatorResult;
      
      const adminResult = await grantPermission(
        c.env.DB,
        STEVEN_UUID,
        'admin',
        'system',
        `Granted admin permissions via admin endpoint for ${STEVEN_EMAIL}`
      );
      results.permissions.admin = adminResult;
      
    } catch (error) {
      console.log('❌ is_active column missing, using manual INSERT:', error);
      
      // Manually insert permissions without is_active column
      try {
        const moderatorId = crypto.randomUUID();
        const adminId = crypto.randomUUID();
        
        const moderatorStmt = c.env.DB.prepare(`
          INSERT OR IGNORE INTO user_permissions (id, user_uuid, permission, granted_by, granted_at, notes)
          VALUES (?, ?, 'moderator', 'system', datetime('now'), ?)
        `);
        
        const moderatorResult = await moderatorStmt.bind(
          moderatorId, 
          STEVEN_UUID, 
          `Granted moderator permissions via admin endpoint for ${STEVEN_EMAIL}`
        ).run();
        
        const adminStmt = c.env.DB.prepare(`
          INSERT OR IGNORE INTO user_permissions (id, user_uuid, permission, granted_by, granted_at, notes)
          VALUES (?, ?, 'admin', 'system', datetime('now'), ?)
        `);
        
        const adminResult = await adminStmt.bind(
          adminId, 
          STEVEN_UUID, 
          `Granted admin permissions via admin endpoint for ${STEVEN_EMAIL}`
        ).run();
        
        results.permissions.moderator = { success: moderatorResult.success, permissionId: moderatorId };
        results.permissions.admin = { success: adminResult.success, permissionId: adminId };
        
      } catch (manualError) {
        console.error('❌ Manual permission insert failed:', manualError);
        results.permissions.error = manualError instanceof Error ? manualError.message : 'Manual insert failed';
      }
    }
    
    // Step 5: Update KV store for email verification
    console.log('📧 Updating email verification in KV store...');
    if (c.env.SESSIONS) {
      try {
        await c.env.SESSIONS.put(`email:${STEVEN_UUID}`, JSON.stringify({
          email: STEVEN_EMAIL,
          verified_at: new Date().toISOString(),
          method: 'admin_update'
        }));
        results.kvStoreUpdated = true;
        console.log('✅ Email verification updated in KV store');
      } catch (error) {
        console.error('❌ Failed to update email verification in KV store:', error);
        results.kvError = error instanceof Error ? error.message : 'KV update failed';
      }
    } else {
      console.warn('⚠️  SESSIONS KV namespace not available');
    }
    
    console.log('🎉 Permission update completed!');
    console.log('Final result:', JSON.stringify(results, null, 2));
    
    return c.json(createSuccessResponse(results));
    
  } catch (error) {
    console.error('❌ Failed to update Steven permissions:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
}
