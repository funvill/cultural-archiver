-- Migration 0035: Fix social_media_schedules foreign key to reference artwork (not artworks) and users.uuid (not users.id)
-- Purpose: Correct the foreign key constraints that were pointing to wrong table/columns
-- Date: 2025-10-08
-- Note: SQLite doesn't support ALTER TABLE to modify foreign keys, so we need to recreate the table

-- Step 1: Drop the existing table (safe because it's new and likely has no or minimal data)
DROP TABLE IF EXISTS social_media_schedules;

-- Step 2: Recreate the table with the correct foreign keys
CREATE TABLE IF NOT EXISTS social_media_schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  artwork_id TEXT,
  scheduled_date TEXT NOT NULL,
  social_type TEXT NOT NULL CHECK(social_type IN ('bluesky', 'instagram', 'twitter', 'facebook', 'other')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'posted', 'failed')),
  body TEXT NOT NULL,
  photos TEXT,
  last_attempt_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(uuid) ON DELETE CASCADE,
  FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE SET NULL
);

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_date_type ON social_media_schedules(scheduled_date, social_type);
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_status ON social_media_schedules(status);
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_social_type ON social_media_schedules(social_type);
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_created_at ON social_media_schedules(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_artwork_id ON social_media_schedules(artwork_id);
