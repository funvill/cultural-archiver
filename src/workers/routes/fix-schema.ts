/**
 * Fix Permissions Schema Route
 * Temporary endpoint to fix the missing is_active column
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { createSuccessResponse } from '../lib/errors';

/**
 * POST /api/dev/fix-permissions-schema
 * Fix the missing is_active column in user_permissions table
 */
export async function fixPermissionsSchema(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  try {
    console.log('=== Fixing Permissions Schema ===');

    const results: Array<{
      step: string;
      success: boolean;
      note?: string;
      error?: string;
      changes?: number;
      data?: unknown;
    }> = [];

    // Step 1: Add is_active column
    console.log('🔧 Adding is_active column...');
    try {
      const addColumnStmt = c.env.DB.prepare(`
        ALTER TABLE user_permissions 
        ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
      `);
      const addResult = await addColumnStmt.run();
      results.push({ step: 'add_column', success: addResult.success });
      console.log('✅ Added is_active column:', addResult.success);
    } catch (error) {
      console.log('ℹ️ Column might already exist:', error);
      results.push({
        step: 'add_column',
        success: false,
        note: 'Column might already exist',
        error: String(error),
      });
    }

    // Step 2: Update existing records
    console.log('🔧 Updating existing records...');
    try {
      const updateStmt = c.env.DB.prepare(`
        UPDATE user_permissions 
        SET is_active = 1 
        WHERE is_active IS NULL OR is_active = 0
      `);
      const updateResult = await updateStmt.run();
      results.push({
        step: 'update_records',
        success: updateResult.success,
        changes: updateResult.meta?.changes,
      });
      console.log(
        '✅ Updated records:',
        updateResult.success,
        'changes:',
        updateResult.meta?.changes
      );
    } catch (error) {
      console.error('❌ Failed to update records:', error);
      results.push({ step: 'update_records', success: false, error: String(error) });
    }

    // Step 3: Verify the fix
    console.log('🔍 Verifying the fix...');
    try {
      const verifyStmt = c.env.DB.prepare(`
        SELECT COUNT(*) as total_permissions, 
               SUM(is_active) as active_permissions 
        FROM user_permissions
      `);
      const verifyResult = await verifyStmt.first();
      results.push({ step: 'verify', success: true, data: verifyResult });
      console.log('✅ Verification result:', verifyResult);
    } catch (error) {
      console.error('❌ Failed to verify:', error);
      results.push({ step: 'verify', success: false, error: String(error) });
    }

    // Step 4: Check Steven's permissions
    console.log("🔍 Checking Steven's permissions...");
    try {
      const stevenStmt = c.env.DB.prepare(`
        SELECT user_uuid, permission, granted_by, granted_at, is_active
        FROM user_permissions 
        WHERE user_uuid = '6c970b24-f64a-49d9-8c5f-8ae23cc2af47'
      `);
      const stevenResult = await stevenStmt.all();
      results.push({
        step: 'steven_permissions',
        success: stevenResult.success,
        data: stevenResult.results,
      });
      console.log("✅ Steven's permissions:", stevenResult.results);
    } catch (error) {
      console.error("❌ Failed to check Steven's permissions:", error);
      results.push({ step: 'steven_permissions', success: false, error: String(error) });
    }

    console.log('🎉 Schema fix completed!');

    return c.json(
      createSuccessResponse({
        message: 'Permissions schema fix completed',
        steps: results,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error('❌ Failed to fix permissions schema:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
}
