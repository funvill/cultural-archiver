-- Migration: Add artist tables for artist profile pages
-- Date: 2025-01-08
-- Description: Creates artists, artwork_artists, and artist_edits tables for dedicated artist pages

-- ================================
-- Artists Table
-- ================================
CREATE TABLE artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT, -- Markdown biography/artist statement
  tags TEXT DEFAULT '{}', -- JSON object for metadata (website, birth_year, etc.)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- ================================
-- Artwork Artists Junction Table
-- ================================
CREATE TABLE artwork_artists (
  id TEXT PRIMARY KEY,
  artwork_id TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  role TEXT DEFAULT 'artist',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
  UNIQUE(artwork_id, artist_id, role) -- Allow same artist with different roles
);

-- ================================
-- Artist Edits Table for Moderation
-- ================================
CREATE TABLE artist_edits (
  edit_id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL,
  user_token TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_value_old TEXT,
  field_value_new TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderator_notes TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- ================================
-- Indexes for Performance
-- ================================
CREATE INDEX idx_artists_name ON artists(name);
CREATE INDEX idx_artists_status ON artists(status);
CREATE INDEX idx_artists_created_at ON artists(created_at);

CREATE INDEX idx_artwork_artists_artwork_id ON artwork_artists(artwork_id);
CREATE INDEX idx_artwork_artists_artist_id ON artwork_artists(artist_id);
CREATE INDEX idx_artwork_artists_role ON artwork_artists(role);

CREATE INDEX idx_artist_edits_artist_id ON artist_edits(artist_id);
CREATE INDEX idx_artist_edits_user_token ON artist_edits(user_token);
CREATE INDEX idx_artist_edits_status ON artist_edits(status);
CREATE INDEX idx_artist_edits_submitted_at ON artist_edits(submitted_at DESC);
CREATE INDEX idx_artist_edits_moderation_queue ON artist_edits(status, submitted_at DESC);

-- ================================
-- Sample Data for Testing
-- ================================
INSERT INTO artists (id, name, description, tags) VALUES 
('sample-artist-1', 'Unknown Artist', 'Artist profile for unknown or anonymous artists', '{"website": "", "birth_year": ""}');

-- Link sample artwork to sample artist
INSERT INTO artwork_artists (id, artwork_id, artist_id, role) VALUES 
('sample-link-1', 'SAMPLE-artwork-approved-1', 'sample-artist-1', 'artist');