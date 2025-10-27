-- Migration 0039: Remove UUID Constraints for Clerk User IDs
-- Date: 2025-01-21
-- Issue: Support Clerk user IDs (user_XXXX format) in addition to standard UUIDs
-- Reference: Admin authentication with Clerk user IDs

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- We need to recreate the tables without UUID-only constraints

-- Step 1: Recreate lists table with flexible owner_user_id
CREATE TABLE lists_new (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  owner_user_id TEXT NOT NULL,  -- Removed UUID constraint to accept Clerk user IDs
  name TEXT NOT NULL CHECK (length(name) <= 255 AND length(trim(name)) > 0),
  visibility TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('unlisted', 'private')),
  is_readonly INTEGER NOT NULL DEFAULT 0 CHECK (is_readonly IN (0, 1)),
  is_system_list INTEGER NOT NULL DEFAULT 0 CHECK (is_system_list IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 2: Copy data from old table
INSERT INTO lists_new SELECT * FROM lists;

-- Step 3: Drop old table
DROP TABLE lists;

-- Step 4: Rename new table
ALTER TABLE lists_new RENAME TO lists;

-- Step 5: Recreate indexes
CREATE INDEX idx_lists_owner_user_id ON lists(owner_user_id, updated_at DESC);
CREATE INDEX idx_lists_name_per_user ON lists(owner_user_id, name);
CREATE INDEX idx_lists_system ON lists(is_system_list, owner_user_id) WHERE is_system_list = 1;

-- Step 6: Recreate list_items table with flexible user_id (if needed)
-- Note: list_items already has no UUID constraint on user fields, only on id
-- The foreign key to lists.id will still work

-- Rollback instructions (commented out):
-- This migration removes security constraints, so rollback would need to:
-- 1. Verify all owner_user_id values are valid UUIDs
-- 2. Recreate table with original UUID constraints
-- 3. This is only safe if no Clerk user IDs have been added
