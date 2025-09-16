-- Migration: Add artwork_artists linking table for many-to-many relationships
-- Date: 2025-01-14
-- Description: Creates artwork_artists table for managing relationships between artworks and artists

-- Create artwork_artists linking table for many-to-many relationships
CREATE TABLE artwork_artists (
    artwork_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'artist', -- e.g., 'primary', 'contributor', 'artist'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (artwork_id, artist_id),
    FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_artwork_artists_artwork_id ON artwork_artists(artwork_id);
CREATE INDEX IF NOT EXISTS idx_artwork_artists_artist_id ON artwork_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_artwork_artists_role ON artwork_artists(role);

-- Add comment for documentation
-- This table enables many-to-many relationships between artworks and artists
-- Supporting collaborative works and proper attribution tracking