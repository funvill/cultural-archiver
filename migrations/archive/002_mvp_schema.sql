-- Cultural Archiver MVP Database Schema
-- Complete schema replacement for crowdsourced public art mapping
-- Version: 002
-- Date: 2024-DEC-27

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ================================
-- Drop existing tables (destructive migration)
-- ================================
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS logbook;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS artworks;

-- ================================
-- Artwork Types Table
-- Pre-defined categories for public artwork
-- ================================
CREATE TABLE artwork_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for artwork type lookups
CREATE INDEX idx_artwork_types_name ON artwork_types(name);

-- ================================
-- Artwork Table  
-- Core table for public artwork locations with geospatial data
-- ================================
CREATE TABLE artwork (
    id TEXT PRIMARY KEY,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    type_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'removed')),
    tags TEXT, -- JSON object for key-value metadata like {"material": "bronze", "style": "modern"}
    FOREIGN KEY (type_id) REFERENCES artwork_types(id)
);

-- Indexes for spatial queries and filtering
CREATE INDEX idx_artwork_lat_lon ON artwork(lat, lon);
CREATE INDEX idx_artwork_status ON artwork(status);
CREATE INDEX idx_artwork_type_id ON artwork(type_id);

-- ================================
-- Logbook Table
-- Community submissions and entries for artworks
-- ================================
CREATE TABLE logbook (
    id TEXT PRIMARY KEY,
    artwork_id TEXT,
    user_token TEXT NOT NULL,
    note TEXT,
    photos TEXT, -- JSON array of R2 URLs like ["url1", "url2", "url3"]
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE
);

-- Indexes for moderation and user queries
CREATE INDEX idx_logbook_artwork_id ON logbook(artwork_id);
CREATE INDEX idx_logbook_status ON logbook(status);
CREATE INDEX idx_logbook_user_token ON logbook(user_token);

-- ================================
-- Tags Table
-- Flexible key-value tagging system for artworks and logbook entries
-- ================================
CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    artwork_id TEXT,
    logbook_id TEXT,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE,
    FOREIGN KEY (logbook_id) REFERENCES logbook(id) ON DELETE CASCADE
);

-- Indexes for tag queries
CREATE INDEX idx_tags_artwork_id ON tags(artwork_id);
CREATE INDEX idx_tags_logbook_id ON tags(logbook_id);
CREATE INDEX idx_tags_label ON tags(label);

-- ================================
-- Pre-populate artwork types
-- ================================
INSERT INTO artwork_types (id, name, description) VALUES
    ('public_art', 'public_art', 'Public art installations and commissioned works'),
    ('street_art', 'street_art', 'Street art, murals, and graffiti'),
    ('monument', 'monument', 'Monuments, memorials, and commemorative structures'),
    ('sculpture', 'sculpture', 'Sculptural works and installations'),
    ('other', 'other', 'Other types of public artwork');

-- ================================
-- Sample data for testing
-- ================================

-- Sample artworks with Vancouver coordinates (49.2827° N, 123.1207° W area)
INSERT INTO artwork (id, lat, lon, type_id, status, tags) VALUES
    ('SAMPLE-artwork-pending-1', 49.2827, -123.1207, 'public_art', 'pending', '{"material": "bronze", "condition": "new"}'),
    ('SAMPLE-artwork-pending-2', 49.2840, -123.1195, 'street_art', 'pending', '{"style": "modern", "artist": "SAMPLE Artist"}'),
    ('SAMPLE-artwork-approved-1', 49.2815, -123.1220, 'monument', 'approved', '{"material": "stone", "year": "1995"}'),
    ('SAMPLE-artwork-approved-2', 49.2850, -123.1180, 'sculpture', 'approved', '{"condition": "good", "material": "metal"}'),
    ('SAMPLE-artwork-removed-1', 49.2800, -123.1250, 'other', 'removed', '{"reason": "damaged", "removed_date": "2024-01-15"}'),
    ('SAMPLE-artwork-removed-2', 49.2860, -123.1160, 'public_art', 'removed', '{"reason": "relocated"}');

-- Sample logbook entries
INSERT INTO logbook (id, artwork_id, user_token, note, photos, status) VALUES
    ('SAMPLE-logbook-pending-1', 'SAMPLE-artwork-approved-1', 'user-token-1', 'SAMPLE: New artwork spotted in downtown area', '["https://sample-r2-url.com/photo1.jpg"]', 'pending'),
    ('SAMPLE-logbook-pending-2', 'SAMPLE-artwork-approved-2', 'user-token-2', 'SAMPLE: Condition update - some weathering visible', '["https://sample-r2-url.com/photo2.jpg", "https://sample-r2-url.com/photo3.jpg"]', 'pending'),
    ('SAMPLE-logbook-pending-3', NULL, 'user-token-3', 'SAMPLE: New submission without existing artwork', '["https://sample-r2-url.com/photo4.jpg"]', 'pending'),
    ('SAMPLE-logbook-approved-1', 'SAMPLE-artwork-approved-1', 'user-token-4', 'SAMPLE: Great condition, recently cleaned', '[]', 'approved'),
    ('SAMPLE-logbook-approved-2', 'SAMPLE-artwork-approved-2', 'user-token-5', 'SAMPLE: Popular spot for photos', '["https://sample-r2-url.com/photo5.jpg"]', 'approved'),
    ('SAMPLE-logbook-approved-3', 'SAMPLE-artwork-pending-1', 'user-token-6', 'SAMPLE: Confirmed installation complete', '[]', 'approved'),
    ('SAMPLE-logbook-rejected-1', 'SAMPLE-artwork-approved-1', 'user-token-7', 'SAMPLE: Inappropriate content', '[]', 'rejected'),
    ('SAMPLE-logbook-rejected-2', NULL, 'user-token-8', 'SAMPLE: Duplicate submission', '["https://sample-r2-url.com/photo6.jpg"]', 'rejected'),
    ('SAMPLE-logbook-rejected-3', 'SAMPLE-artwork-approved-2', 'user-token-9', 'SAMPLE: Spam submission', '[]', 'rejected');

-- Sample tags demonstrating key-value structure
INSERT INTO tags (id, artwork_id, logbook_id, label, value) VALUES
    ('SAMPLE-tag-1', 'SAMPLE-artwork-approved-1', NULL, 'material', 'bronze'),
    ('SAMPLE-tag-2', 'SAMPLE-artwork-approved-1', NULL, 'style', 'classical'),
    ('SAMPLE-tag-3', 'SAMPLE-artwork-approved-2', NULL, 'condition', 'excellent'),
    ('SAMPLE-tag-4', NULL, 'SAMPLE-logbook-approved-1', 'maintenance', 'cleaned'),
    ('SAMPLE-tag-5', NULL, 'SAMPLE-logbook-approved-2', 'popularity', 'high');

-- Log the schema migration
INSERT INTO logbook (id, artwork_id, user_token, note, photos, status) VALUES
    ('migration-log-002', NULL, 'system', 'SAMPLE: MVP Database Schema Migration Complete - Created artwork_types, artwork, logbook, and tags tables with geospatial indexing', '[]', 'approved');