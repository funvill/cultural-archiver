-- Migration: Replace artwork.type_id with artwork_type tag
-- Date: 2025-09-12
-- Description: Migrates artwork types from relational model to tag-based system
-- Related: tasks/prd-artwork.type_id.md

-- ================================
-- Data Migration: Move type_id data to tags table
-- ================================

-- Migrate existing artwork types to tags table
-- Insert artwork_type tag for each artwork based on its current type_id
INSERT INTO tags (id, artwork_id, logbook_id, label, value, created_at)
SELECT 
    lower(hex(randomblob(16))) as id,  -- Generate UUID
    a.id as artwork_id,
    NULL as logbook_id,
    'artwork_type' as label,
    COALESCE(at.name, 'unknown') as value,
    datetime('now') as created_at
FROM artwork a
LEFT JOIN artwork_types at ON a.type_id = at.id
WHERE NOT EXISTS (
    -- Don't insert duplicate artwork_type tags
    SELECT 1 FROM tags t 
    WHERE t.artwork_id = a.id 
    AND t.label = 'artwork_type'
);

-- ================================
-- Schema Changes: Remove old relational model
-- ================================

-- Remove the foreign key constraint by dropping and recreating the artwork table
-- First, create a backup of the artwork table without the type_id column
CREATE TABLE artwork_new AS
SELECT 
    id,
    lat,
    lon,
    created_at,
    status,
    tags,
    title,
    description,
    created_by
FROM artwork;

-- Drop the old artwork table (this removes the foreign key constraint)
DROP TABLE artwork;

-- Rename the new table to artwork
ALTER TABLE artwork_new RENAME TO artwork;

-- Recreate indexes on the new artwork table
CREATE INDEX idx_artwork_lat_lon ON artwork(lat, lon);
CREATE INDEX idx_artwork_status ON artwork(status);
CREATE INDEX idx_artwork_tags_fts ON artwork(tags);
CREATE INDEX idx_artwork_title ON artwork(title);
CREATE INDEX idx_artwork_description ON artwork(description);
CREATE INDEX idx_artwork_created_by ON artwork(created_by);

-- ================================
-- Drop artwork_types table
-- ================================

-- Drop the artwork_types table as it's no longer needed
DROP TABLE artwork_types;

-- ================================
-- Add indexes for artwork_type tag queries
-- ================================

-- Add index for efficient artwork_type tag queries
CREATE INDEX idx_tags_artwork_type ON tags(artwork_id, value) 
WHERE label = 'artwork_type';

-- Add index for artwork_type label filtering
CREATE INDEX idx_tags_label_artwork_type ON tags(label, value) 
WHERE label = 'artwork_type';

-- ================================
-- Validation and cleanup
-- ================================

-- Ensure all artworks have an artwork_type tag
-- Add 'unknown' artwork_type for any artwork missing the tag
INSERT INTO tags (id, artwork_id, logbook_id, label, value, created_at)
SELECT 
    lower(hex(randomblob(16))) as id,
    a.id as artwork_id,
    NULL as logbook_id,
    'artwork_type' as label,
    'unknown' as value,
    datetime('now') as created_at
FROM artwork a
WHERE NOT EXISTS (
    SELECT 1 FROM tags t 
    WHERE t.artwork_id = a.id 
    AND t.label = 'artwork_type'
);

-- ================================
-- Performance optimization
-- ================================

-- Analyze tables to update statistics after migration
ANALYZE artwork;
ANALYZE tags;

-- ================================
-- Migration notes
-- ================================

-- This migration is designed to:
-- 1. Preserve all existing artwork type data by migrating to tags
-- 2. Remove the rigid relational model (artwork_types table and type_id column)
-- 3. Enable flexible, user-editable artwork types through the tags system
-- 4. Ensure all artworks have an artwork_type tag (defaulting to 'unknown')
-- 5. Add proper indexes for efficient tag-based queries

-- Post-migration, applications should:
-- 1. Query artwork types using: SELECT value FROM tags WHERE artwork_id = ? AND label = 'artwork_type'
-- 2. Filter by artwork type using: JOIN tags ON tags.artwork_id = artwork.id AND tags.label = 'artwork_type' AND tags.value = ?
-- 3. Create new artwork_type tags when submitting new artwork
-- 4. Allow users to edit artwork_type through the standard tag editing interface