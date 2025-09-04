/**
 * Debug Permissions Route
 * Temporary endpoint to debug permission checking for Steven
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { createSuccessResponse } from '../lib/errors';
import { hasPermission, isAdmin, isModerator, getUserPermissions } from '../lib/permissions';

const STEVEN_UUID = '6c970b24-f64a-49d9-8c5f-8ae23cc2af47';

/**
 * GET /api/dev/debug-steven-permissions
 * Debug endpoint to check permission logic
 */
export async function debugStevenPermissions(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  try {
    console.log('=== Debugging Steven Permission Checks ===');
    
    // Step 1: Raw database query for permissions
    console.log('🔍 Raw database query...');
    const rawQuery = c.env.DB.prepare(`
      SELECT * FROM user_permissions 
      WHERE user_uuid = ?
      ORDER BY granted_at DESC
    `);
    const rawResults = await rawQuery.bind(STEVEN_UUID).all();
    console.log('Raw permissions query result:', rawResults);
    
    // Step 2: Test individual permission checks
    console.log('🔍 Testing individual permission checks...');
    
    const moderatorCheck = await hasPermission(c.env.DB, STEVEN_UUID, 'moderator');
    console.log('Moderator permission check:', moderatorCheck);
    
    const adminCheck = await hasPermission(c.env.DB, STEVEN_UUID, 'admin');
    console.log('Admin permission check:', adminCheck);
    
    // Step 3: Test convenience functions
    console.log('🔍 Testing convenience functions...');
    
    const isAdminResult = await isAdmin(c.env.DB, STEVEN_UUID);
    console.log('isAdmin() result:', isAdminResult);
    
    const isModeratorResult = await isModerator(c.env.DB, STEVEN_UUID);
    console.log('isModerator() result:', isModeratorResult);
    
    // Step 4: Test getUserPermissions function
    console.log('🔍 Testing getUserPermissions function...');
    
    const userPermissions = await getUserPermissions(c.env.DB, STEVEN_UUID);
    console.log('getUserPermissions() result:', userPermissions);
    
    // Step 5: Check cache state
    console.log('🔍 Checking permission cache...');
    // Note: We can't directly access the cache from outside the permissions module
    
    const result = {
      user_uuid: STEVEN_UUID,
      raw_database_query: {
        success: rawResults.success,
        count: rawResults.success ? rawResults.results.length : 0,
        results: rawResults.success ? rawResults.results : []
      },
      individual_checks: {
        moderator: moderatorCheck,
        admin: adminCheck
      },
      convenience_functions: {
        isAdmin: isAdminResult,
        isModerator: isModeratorResult
      },
      user_permissions_function: userPermissions,
      timestamp: new Date().toISOString()
    };
    
    console.log('🎉 Debug completed!');
    console.log('Debug result:', JSON.stringify(result, null, 2));
    
    return c.json(createSuccessResponse(result));
    
  } catch (error) {
    console.error('❌ Failed to debug permissions:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
}
