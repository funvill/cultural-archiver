-- Add data dumps table for storing public data dump generation records
-- Generated on: 2025-09-04T17:45:00.000Z
-- Purpose: Track admin-generated public data dumps with metadata and download URLs

-- Table: data_dumps
CREATE TABLE data_dumps (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL, -- datadump-YYYY-MM-DD.zip format
    size INTEGER NOT NULL, -- file size in bytes
    r2_key TEXT NOT NULL, -- R2 storage key for the dump file
    download_url TEXT NOT NULL, -- public download URL
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    generated_by TEXT NOT NULL, -- admin user token who generated the dump
    total_artworks INTEGER NOT NULL DEFAULT 0,
    total_creators INTEGER NOT NULL DEFAULT 0,
    total_tags INTEGER NOT NULL DEFAULT 0,
    total_photos INTEGER NOT NULL DEFAULT 0,
    warnings TEXT -- JSON array of warning messages, null if no warnings
);

-- Index on generated_at for listing dumps chronologically
CREATE INDEX idx_data_dumps_generated_at ON data_dumps(generated_at DESC);

-- Index on generated_by for admin audit trails
CREATE INDEX idx_data_dumps_generated_by ON data_dumps(generated_by);