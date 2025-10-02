-- Migration 0030: Create feedback table for moderator-only user feedback
-- Purpose: Allow users to report issues (missing artwork, incorrect info) privately to moderators
-- Date: 2025-09-30

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK(subject_type IN ('artwork', 'artist')),
  subject_id TEXT NOT NULL,
  user_token TEXT,
  issue_type TEXT NOT NULL CHECK(issue_type IN ('missing', 'incorrect_info', 'other', 'comment')),
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'archived', 'resolved')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  moderator_token TEXT,
  review_notes TEXT,
  ip_address TEXT,
  user_agent TEXT
);

-- Index for querying feedback by subject (artwork or artist)
CREATE INDEX IF NOT EXISTS idx_feedback_subject ON feedback(subject_type, subject_id);

-- Index for filtering by status (open, archived, resolved)
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- Index for sorting by creation date (moderators want newest first)
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Index for moderator review tracking
CREATE INDEX IF NOT EXISTS idx_feedback_moderator ON feedback(moderator_token, reviewed_at);
