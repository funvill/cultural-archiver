-- Migration 0035: Fix admin_actions and user_permissions compatibility
-- Date: 2025-10-07
-- Description: Create admin_actions audit table if missing and add user_uuid column
--              to user_permissions to maintain backward-compatible queries.

PRAGMA foreign_keys=OFF;

-- Create admin_actions table expected by audit logging utilities
CREATE TABLE IF NOT EXISTS admin_actions (
  id TEXT PRIMARY KEY,
  admin_uuid TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_uuid TEXT,
  permission_type TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add indexes to improve query performance for admin actions
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_uuid ON admin_actions(admin_uuid);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at DESC);

-- Ensure user_permissions has a user_uuid column used by newer queries
-- Note: ALTER TABLE ADD COLUMN is safe when column does not already exist.
-- If the column exists this statement may fail in older SQLite versions; apply carefully via migrations tooling.
ALTER TABLE user_permissions ADD COLUMN user_uuid TEXT;

-- Populate the new column from existing user_token data for compatibility
UPDATE user_permissions SET user_uuid = user_token WHERE user_uuid IS NULL;

-- Create index on the new column for active permissions queries
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_uuid ON user_permissions(user_uuid) WHERE is_active = 1;

PRAGMA foreign_keys=ON;

-- Rollback notes: this migration is additive (creates table and adds column).
-- To rollback in worst-case: drop table admin_actions; ALTER TABLE to recreate original user_permissions table without user_uuid
