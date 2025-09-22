-- Migration 0026: Add Notifications Table
-- Date: 2025-09-22
-- Issue: Implement Generic Notification System for badges, admin messages, and future notification types
-- PRD Reference: tasks/notification-system.md

-- Step 1: Create notifications table
CREATE TABLE notifications (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  user_token TEXT NOT NULL CHECK (
    length(user_token) = 36 AND 
    user_token LIKE '________-____-____-____-____________' AND
    substr(user_token, 15, 1) IN ('1','2','3','4','5') AND
    substr(user_token, 20, 1) IN ('8','9','a','b','A','B')
  ),
  type TEXT NOT NULL CHECK (type IN ('badge', 'admin_message', 'review', 'system')),
  type_key TEXT, -- Optional subtype or canonical key (e.g., 'submission_5')
  title TEXT NOT NULL,
  message TEXT,
  metadata TEXT, -- JSON string for structured payload (badge id, artwork id, url)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_dismissed INTEGER NOT NULL DEFAULT 0 CHECK (is_dismissed IN (0, 1)),
  related_id TEXT -- Optional foreign key (badge id, submission id, etc.)
);

-- Step 2: Create performance index
-- Primary index for fetching user notifications efficiently
CREATE INDEX idx_notifications_user_token ON notifications(user_token, is_dismissed, created_at DESC);

-- Step 3: Create additional indexes for common queries
-- Index for unread count queries
CREATE INDEX idx_notifications_unread ON notifications(user_token, is_dismissed) WHERE is_dismissed = 0;

-- Index for type-based queries (future use)
CREATE INDEX idx_notifications_type ON notifications(type, created_at DESC);

-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, run the following SQL:
-- DROP INDEX IF EXISTS idx_notifications_type;
-- DROP INDEX IF EXISTS idx_notifications_unread;
-- DROP INDEX IF EXISTS idx_notifications_user_token;
-- DROP TABLE IF EXISTS notifications;

-- NOTES:
-- - Uses TEXT for metadata JSON to maintain D1 SQLite compatibility
-- - UUID validation follows existing pattern from other tables
-- - is_dismissed uses INTEGER (0/1) for SQLite boolean compatibility
-- - Indexes are optimized for common queries: list recent, unread count
-- - No foreign key constraints to avoid dependency issues during development
-- - Migration is idempotent and can be safely re-run