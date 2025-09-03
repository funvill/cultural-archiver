-- Cultural Archiver Creator Management Schema
-- Adds creators table and artwork-creator relationships for detailed artwork attribution
-- Version: 006
-- Date: 2024-DEC-31

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ================================
-- Creators Table
-- Individual artists and creators who make artwork
-- ================================
CREATE TABLE creators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bio TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for creator name searches
CREATE INDEX idx_creators_name ON creators(name);

-- ================================
-- Artwork Creators Junction Table
-- Many-to-many relationship between artworks and creators
-- Supports multiple creators per artwork and role specification
-- ================================
CREATE TABLE artwork_creators (
    id TEXT PRIMARY KEY,
    artwork_id TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    role TEXT DEFAULT 'artist', -- artist, designer, architect, etc.
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE
);

-- Indexes for relationship queries
CREATE INDEX idx_artwork_creators_artwork_id ON artwork_creators(artwork_id);
CREATE INDEX idx_artwork_creators_creator_id ON artwork_creators(creator_id);
CREATE UNIQUE INDEX idx_artwork_creators_unique ON artwork_creators(artwork_id, creator_id, role);

-- ================================
-- Sample data for testing
-- ================================

-- Sample creators
INSERT INTO creators (id, name, bio) VALUES
    ('SAMPLE-creator-1', 'SAMPLE Emily Chen', 'SAMPLE: Contemporary sculptor specializing in bronze works'),
    ('SAMPLE-creator-2', 'SAMPLE David Martinez', 'SAMPLE: Street artist and muralist active in Vancouver'),
    ('SAMPLE-creator-3', 'SAMPLE Sarah Thompson', 'SAMPLE: Public art designer and urban planner'),
    ('SAMPLE-creator-unknown', 'Unknown Artist', 'Placeholder for artworks with unknown creators');

-- Link existing sample artworks to creators
INSERT INTO artwork_creators (id, artwork_id, creator_id, role) VALUES
    ('SAMPLE-ac-1', 'SAMPLE-artwork-approved-1', 'SAMPLE-creator-1', 'artist'),
    ('SAMPLE-ac-2', 'SAMPLE-artwork-approved-2', 'SAMPLE-creator-2', 'artist'),
    ('SAMPLE-ac-3', 'SAMPLE-artwork-pending-1', 'SAMPLE-creator-3', 'designer'),
    ('SAMPLE-ac-4', 'SAMPLE-artwork-pending-2', 'SAMPLE-creator-2', 'artist');

-- Log the schema migration
INSERT INTO logbook (id, artwork_id, user_token, note, photos, status) VALUES
    ('migration-log-006', NULL, 'system', 'SAMPLE: Creator Management Schema Migration Complete - Added creators and artwork_creators tables for proper artist attribution', '[]', 'approved');