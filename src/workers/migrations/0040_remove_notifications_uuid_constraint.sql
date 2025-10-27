-- Migration 0040: Remove UUID Constraint from Notifications Table
-- Date: 2025-01-21
-- Issue: Support Clerk user IDs (user_XXXX format) in notifications.user_token
-- Reference: Admin authentication with Clerk user IDs

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- We need to recreate the table without UUID-only constraint on user_token

-- Step 1: Recreate notifications table with flexible user_token
CREATE TABLE notifications_new (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  user_token TEXT NOT NULL,  -- Removed UUID constraint to accept Clerk user IDs
  type TEXT NOT NULL CHECK (type IN ('badge', 'admin_message', 'review', 'system')),
  type_key TEXT,
  title TEXT NOT NULL,
  message TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_dismissed INTEGER NOT NULL DEFAULT 0 CHECK (is_dismissed IN (0, 1)),
  related_id TEXT
);

-- Step 2: Copy data from old table
INSERT INTO notifications_new SELECT * FROM notifications;

-- Step 3: Drop old table
DROP TABLE notifications;

-- Step 4: Rename new table
ALTER TABLE notifications_new RENAME TO notifications;

-- Step 5: Recreate indexes
CREATE INDEX idx_notifications_user_token ON notifications(user_token, is_dismissed, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_token, is_dismissed) WHERE is_dismissed = 0;
CREATE INDEX idx_notifications_type ON notifications(type, created_at DESC);

-- Rollback instructions (commented out):
-- This migration removes security constraints, so rollback would need to:
-- 1. Verify all user_token values are valid UUIDs
-- 2. Recreate table with original UUID constraints
-- 3. This is only safe if no Clerk user IDs have been added
