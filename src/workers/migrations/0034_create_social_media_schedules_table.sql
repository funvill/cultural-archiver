-- Migration 0031: Create social_media_schedules table for scheduling social media posts
-- Purpose: Allow admins to schedule artwork posts to various social media platforms
-- Date: 2025-10-07

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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE SET NULL
);

-- Index for finding scheduled posts by date and social type
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_date_type ON social_media_schedules(scheduled_date, social_type);

-- Index for filtering by status (scheduled posts for cron job)
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_status ON social_media_schedules(status);

-- Index for filtering by social media type
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_social_type ON social_media_schedules(social_type);

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_created_at ON social_media_schedules(created_at DESC);

-- Index for finding posts by artwork (to check if already scheduled)
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_artwork ON social_media_schedules(artwork_id);

-- Index for finding posts by user (admin who scheduled)
CREATE INDEX IF NOT EXISTS idx_social_media_schedules_user ON social_media_schedules(user_id);
