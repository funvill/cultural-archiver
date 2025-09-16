-- Migration: Remove artist_names column from artwork table
-- Date: 2025-09-15
-- Description: Phase 1b of database normalization - complete removal of artist_names field
--              This migration removes the redundant artist_names column now that
--              all code has been updated to use the artwork_artists relationship table

-- Remove the artist_names column from artwork table
-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
PRAGMA foreign_keys=off;

-- Create the new artwork table without artist_names column
CREATE TABLE artwork_new (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  title TEXT,
  description TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  address TEXT,
  tags TEXT, -- JSON structured metadata
  photos TEXT, -- JSON array of photo URLs
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT -- Creator/artist name(s) (editable field)
);

-- Copy data from old table to new table (excluding artist_names)
INSERT INTO artwork_new (
  id, title, description, lat, lon, address, tags, photos, 
  status, created_at, updated_at, created_by
)
SELECT 
  id, title, description, lat, lon, address, tags, photos,
  status, created_at, updated_at, created_by
FROM artwork;

-- Drop the old table
DROP TABLE artwork;

-- Rename the new table to the original name
ALTER TABLE artwork_new RENAME TO artwork;

-- Recreate indexes for performance
CREATE INDEX IF NOT EXISTS idx_artwork_lat_lon ON artwork(lat, lon);
CREATE INDEX IF NOT EXISTS idx_artwork_status ON artwork(status);
CREATE INDEX IF NOT EXISTS idx_artwork_created_at ON artwork(created_at DESC);

PRAGMA foreign_keys=on;

-- Verify that all sample artwork has corresponding artist relationships
-- Insert missing relationships for sample data if needed
INSERT OR IGNORE INTO artwork_artists (artwork_id, artist_id, role, created_at)
SELECT a.id, 'd0000000-1000-4000-8000-000000000001', 'primary', datetime('now')
FROM artwork a
WHERE a.id IN ('c0000000-1000-4000-8000-000000000101', 'c0000000-1000-4000-8000-000000000102', 'c0000000-1000-4000-8000-000000000103')
AND NOT EXISTS (
    SELECT 1 FROM artwork_artists aa 
    WHERE aa.artwork_id = a.id
);

-- Ensure all artworks have at least one artist relationship
UPDATE artwork_artists SET role = 'primary' WHERE role IS NULL OR role = '';