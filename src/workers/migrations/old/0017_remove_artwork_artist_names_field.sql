-- Migration: Remove artwork.artist_names field and add artists.aliases field
-- Date: 2025-09-15
-- Description: Phase 1 of database normalization - eliminate redundant artist_names field
--              in favor of normalized artist relationships via artwork_artists table

-- Add aliases field to artists table for "also known as" functionality
ALTER TABLE artists ADD COLUMN aliases TEXT; -- JSON array of alternative names

-- Create "Unknown Artist" record for cases where artist is not known
INSERT OR IGNORE INTO artists (id, name, bio, status, created_at, updated_at) VALUES 
('d0000000-1000-4000-8000-000000000001', 'Unknown Artist', 'This artist record represents artworks where the creator is unknown or anonymous.', 'approved', datetime('now'), datetime('now'));

-- Create sample artist for demonstration
INSERT OR IGNORE INTO artists (id, name, bio, status, created_at, updated_at, aliases) VALUES 
('d0000000-1000-4000-8000-000000000999', 'John Smith', 'A sample artist with aliases', 'approved', datetime('now'), datetime('now'), '["J. Smith", "Johnny Smith"]');

-- Note: The artist_names column will be removed after all code is updated
-- This is a two-step migration to ensure zero downtime:
-- Step 1: Add aliases field and Unknown Artist record (this migration)
-- Step 2: Remove artist_names column (next migration after code updates)

-- Create index on aliases field for searching
CREATE INDEX IF NOT EXISTS idx_artists_aliases ON artists(aliases);

-- Update sample data to link artworks with artists through artwork_artists table
-- This ensures existing sample data continues to work during the transition
UPDATE artwork_artists SET role = 'primary' WHERE role IS NULL OR role = '';

-- Add any missing artwork-artist relationships for sample data
INSERT OR IGNORE INTO artwork_artists (artwork_id, artist_id, role, created_at) 
SELECT a.id, d.id, 'primary', datetime('now')
FROM artwork a, artists d
WHERE a.id IN ('c0000000-1000-4000-8000-000000000101', 'c0000000-1000-4000-8000-000000000102', 'c0000000-1000-4000-8000-000000000103')
AND d.id IN ('d0000000-1000-4000-8000-000000000201', 'd0000000-1000-4000-8000-000000000202', 'd0000000-1000-4000-8000-000000000203')
AND NOT EXISTS (
    SELECT 1 FROM artwork_artists aa 
    WHERE aa.artwork_id = a.id AND aa.artist_id = d.id
);