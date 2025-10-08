-- Migration: 0032_add_artist_id_link_updates.sql
-- Purpose: create audit table for linking artworks that include numeric artist_ids in tags
PRAGMA defer_foreign_keys=TRUE;

CREATE TABLE IF NOT EXISTS artist_id_link_updates (
  artwork_id TEXT PRIMARY KEY,
  artist_ids_raw TEXT,
  chosen_artist_id INTEGER,
  chosen_artist_uuid TEXT,
  chosen_artist_name TEXT,
  old_artist_name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_artist_id_link_updates_chosen_uuid ON artist_id_link_updates(chosen_artist_uuid);

-- End migration
