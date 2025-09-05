-- Migration: Add Column Example
-- Created: [TIMESTAMP]
-- Author: [AUTHOR]
-- Description: Example showing how to safely add columns to existing tables
--
-- ================================
-- D1 COMPATIBILITY NOTES:
-- ================================
-- ✅ DO USE:
--   - ALTER TABLE ADD COLUMN with DEFAULT values
--   - NOT NULL columns with DEFAULT values
--   - CHECK constraints with simple conditions
--   - Standard SQLite data types: TEXT, INTEGER, REAL, BLOB
--
-- ❌ DO NOT USE:
--   - ALTER TABLE DROP COLUMN (not supported in older SQLite)
--   - ALTER TABLE RENAME COLUMN (use CREATE new table + copy data instead)
--   - Complex DEFAULT expressions
--   - Adding columns without DEFAULT if table has data
--
-- ================================
-- MIGRATION CONTENT START
-- ================================

-- Add new columns to existing artworks table
ALTER TABLE artworks ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' 
    CHECK (visibility IN ('public', 'private', 'unlisted'));

ALTER TABLE artworks ADD COLUMN featured INTEGER NOT NULL DEFAULT 0 
    CHECK (featured IN (0, 1));

ALTER TABLE artworks ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE artworks ADD COLUMN last_viewed_at TEXT;

ALTER TABLE artworks ADD COLUMN metadata_version INTEGER NOT NULL DEFAULT 1;

-- Add index for new visibility and featured columns
CREATE INDEX idx_artworks_visibility ON artworks(visibility);
CREATE INDEX idx_artworks_featured ON artworks(featured) WHERE featured = 1;
CREATE INDEX idx_artworks_view_count ON artworks(view_count);

-- ================================
-- MIGRATION CONTENT END  
-- ================================