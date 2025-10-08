-- Migration 0036: Fix users foreign key constraint in social_media_schedules
-- The social_media_schedules table is referencing users(id) but should reference users(uuid)
-- This migration also ensures the artwork FK is correct (artwork.id not artworks.id)
-- SQLite requires dropping and recreating the table to change foreign key constraints

-- Drop the existing table
DROP TABLE IF EXISTS social_media_schedules;

-- Recreate with correct foreign key constraints
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_scheduled_date ON social_media_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_status ON social_media_schedules(status);
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_user_id ON social_media_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_artwork_id ON social_media_schedules(artwork_id);
