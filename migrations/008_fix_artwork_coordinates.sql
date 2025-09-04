-- Cultural Archiver - Fix Artwork Coordinates
-- Migration: 008_fix_artwork_coordinates.sql
-- Purpose: Update artwork coordinates that were incorrectly set to Vancouver defaults
-- Author: GitHub Copilot
-- Date: 2025-09-04

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ================================
-- Fix Artwork Coordinates from Logbook Data
-- ================================

-- Update artworks that have default Vancouver coordinates (49.2827, -123.1207)
-- but have logbook entries with the correct coordinates
UPDATE artwork 
SET 
    lat = (
        SELECT l.lat 
        FROM logbook l 
        WHERE l.artwork_id = artwork.id 
        AND l.lat IS NOT NULL 
        AND l.status = 'approved'
        ORDER BY l.created_at ASC 
        LIMIT 1
    ),
    lon = (
        SELECT l.lon 
        FROM logbook l 
        WHERE l.artwork_id = artwork.id 
        AND l.lon IS NOT NULL 
        AND l.status = 'approved'
        ORDER BY l.created_at ASC 
        LIMIT 1
    )
WHERE 
    -- Only update artworks with default Vancouver coordinates
    artwork.lat = 49.2827 
    AND artwork.lon = -123.1207
    -- That have logbook entries with valid coordinates
    AND EXISTS (
        SELECT 1 
        FROM logbook l 
        WHERE l.artwork_id = artwork.id 
        AND l.lat IS NOT NULL 
        AND l.lon IS NOT NULL
        AND l.status = 'approved'
        -- Exclude entries that also have the default coordinates (safety check)
        AND NOT (l.lat = 49.2827 AND l.lon = -123.1207)
    );

-- ================================
-- Verification Query (for manual testing)
-- ================================

-- To verify the fix worked, run this query after migration:
-- SELECT 
--     a.id,
--     a.lat as artwork_lat,
--     a.lon as artwork_lon,
--     l.lat as logbook_lat,
--     l.lon as logbook_lon,
--     l.created_at as logbook_created
-- FROM artwork a
-- JOIN logbook l ON a.id = l.artwork_id
-- WHERE l.status = 'approved'
-- ORDER BY a.id, l.created_at;

-- ================================
-- Documentation
-- ================================

-- This migration fixes artworks that were created with hardcoded Vancouver coordinates
-- (49.2827, -123.1207) due to a bug in the parseSubmissionData function that fell back
-- to default coordinates when JSON parsing failed.
--
-- The fix:
-- 1. Identifies artworks with exactly the default Vancouver coordinates
-- 2. Checks if they have approved logbook entries with valid coordinates
-- 3. Updates the artwork coordinates to match the earliest logbook entry
--
-- Safety measures:
-- - Only updates artworks with exact default coordinates
-- - Only uses coordinates from approved logbook entries
-- - Excludes logbook entries that also have default coordinates
-- - Uses the earliest logbook entry for consistency
