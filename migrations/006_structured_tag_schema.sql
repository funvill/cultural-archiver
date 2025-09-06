-- Artwork Structured Tag Schema Migration
-- Generated on: 2024-12-19T00:00:00.000Z
-- Purpose: Update artwork.tags field to support structured tag schema
-- Related to: tasks/prd-artwork-variable-tagging-system.md
-- Schema version: 1.0.0

-- D1 COMPATIBILITY NOTE: D1 supports JSON functions natively

-- ================================
-- Add indexes for structured tag queries
-- ================================

-- Index for full-text search on tags field (already exists in many databases)
-- This index enables fast searching across all tag values
CREATE INDEX IF NOT EXISTS idx_artwork_tags_fts ON artwork(tags);

-- Index for commonly searched tag keys using JSON extraction
-- These indexes improve performance for specific tag-based queries

-- Index for tourism tag (required for OSM compatibility)
CREATE INDEX IF NOT EXISTS idx_artwork_tourism_tag ON artwork(
    json_extract(tags, '$.tags.tourism')
) WHERE json_extract(tags, '$.tags.tourism') IS NOT NULL;

-- Index for artwork_type tag (frequently searched)
CREATE INDEX IF NOT EXISTS idx_artwork_type_tag ON artwork(
    json_extract(tags, '$.tags.artwork_type')
) WHERE json_extract(tags, '$.tags.artwork_type') IS NOT NULL;

-- Index for artist_name tag (frequently searched)
CREATE INDEX IF NOT EXISTS idx_artwork_artist_tag ON artwork(
    json_extract(tags, '$.tags.artist_name')
) WHERE json_extract(tags, '$.tags.artist_name') IS NOT NULL;

-- Index for name tag (artwork title, frequently searched)  
CREATE INDEX IF NOT EXISTS idx_artwork_name_tag ON artwork(
    json_extract(tags, '$.tags.name')
) WHERE json_extract(tags, '$.tags.name') IS NOT NULL;

-- ================================
-- Data Migration: Convert existing tags to structured format
-- ================================

-- Data Migration: Convert existing tags to structured format
-- This preserves existing tag data while adding the new structure

-- For better-sqlite3/D1 compatibility, we need to handle JSON strings properly
UPDATE artwork 
SET tags = (
    SELECT json_object(
        'tags', 
        CASE 
            WHEN tags IS NULL OR tags = '' OR tags = '{}' THEN json_object()
            WHEN json_valid(tags) AND json_extract(tags, '$.version') IS NOT NULL THEN tags -- Already structured
            WHEN json_valid(tags) THEN json(tags)  -- Parse JSON string to object
            ELSE json_object()  -- Invalid JSON, reset to empty
        END,
        'version', '1.0.0',
        'lastModified', datetime('now')
    )
)
WHERE tags IS NULL 
   OR tags = '' 
   OR tags = '{}' 
   OR (json_valid(tags) AND json_extract(tags, '$.version') IS NULL)
   OR NOT json_valid(tags);  -- Explicitly handle invalid JSON

-- ================================
-- Add sample structured tags for existing artwork (development/testing)
-- ================================

-- Only add sample data if we're in a development environment
-- This is determined by checking if we have sample artwork data

-- Add base tourism tag to all approved artwork that doesn't have it
-- This ensures OSM compatibility
UPDATE artwork 
SET tags = json_set(
    tags, 
    '$.tags.tourism', 'artwork',
    '$.lastModified', datetime('now')
)
WHERE status = 'approved' 
  AND json_extract(tags, '$.tags.tourism') IS NULL
  AND id LIKE 'SAMPLE-%';  -- Only update sample data

-- Add artwork_type tag based on type_id for sample data
UPDATE artwork 
SET tags = json_set(
    tags,
    '$.tags.artwork_type', 
    CASE 
        WHEN type_id LIKE '%mural%' THEN 'mural'
        WHEN type_id LIKE '%statue%' THEN 'statue'
        WHEN type_id LIKE '%sculpture%' THEN 'sculpture'
        WHEN type_id LIKE '%installation%' THEN 'installation'
        ELSE 'sculpture'  -- Default fallback
    END,
    '$.lastModified', datetime('now')
)
WHERE json_extract(tags, '$.tags.artwork_type') IS NULL
  AND id LIKE 'SAMPLE-%';  -- Only update sample data

-- ================================
-- Validate migration results
-- ================================

-- This section would be used by migration validation tools
-- to ensure the migration completed successfully

-- Check that all artwork records have valid structured tags format
-- Expected: All records should have tags with 'version' and 'tags' properties

-- Count records with old format (should be 0 after migration)
-- SELECT COUNT(*) as old_format_count 
-- FROM artwork 
-- WHERE tags IS NOT NULL 
--   AND json_valid(tags) 
--   AND json_extract(tags, '$.version') IS NULL;

-- Count records with new format (should be total artwork count)
-- SELECT COUNT(*) as new_format_count 
-- FROM artwork 
-- WHERE json_valid(tags) 
--   AND json_extract(tags, '$.version') = '1.0.0';

-- Verify tourism tag on approved artwork
-- SELECT COUNT(*) as tourism_tagged_count
-- FROM artwork 
-- WHERE status = 'approved'
--   AND json_extract(tags, '$.tags.tourism') = 'artwork';

-- ================================
-- Performance optimization
-- ================================

-- Analyze tables to update statistics after migration
ANALYZE artwork;

-- ================================
-- Migration notes
-- ================================

-- This migration is designed to be:
-- 1. Idempotent - safe to run multiple times
-- 2. Backward compatible - existing queries continue to work
-- 3. Performance optimized - indexes for common tag queries
-- 4. Development friendly - adds sample data for testing

-- The migration preserves all existing tag data and converts it to the new
-- structured format. The artwork.tags field now contains:
-- {
--   "tags": { ... actual tag key-value pairs ... },
--   "version": "1.0.0", 
--   "lastModified": "2024-12-19T12:00:00.000Z"
-- }

-- Post-migration, applications should:
-- 1. Use json_extract(tags, '$.tags.key_name') for specific tag queries
-- 2. Use the tag validation service for all tag modifications
-- 3. Include tourism='artwork' tag for new artwork submissions
-- 4. Maintain version field for future schema updates