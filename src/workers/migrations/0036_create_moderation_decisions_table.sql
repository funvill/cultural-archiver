-- Migration 0036: Create moderation_decisions table
-- Date: 2025-10-07
-- Description: Create moderation_decisions audit table used by audit logging utilities

PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS moderation_decisions (
  id TEXT PRIMARY KEY,
  submission_id TEXT,
  moderator_uuid TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT,
  metadata TEXT,
  artwork_id TEXT,
  action_taken TEXT,
  photos_processed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_moderation_decisions_moderator_uuid ON moderation_decisions(moderator_uuid);
CREATE INDEX IF NOT EXISTS idx_moderation_decisions_created_at ON moderation_decisions(created_at DESC);

PRAGMA foreign_keys=ON;

-- Rollback notes: This migration creates an additive table. Dropping it will remove moderation audit history.
