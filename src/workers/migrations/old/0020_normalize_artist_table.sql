-- Migration 0020: Normalize Artist Table
-- Phase 3 of Database Normalization
-- Goal: Remove redundant website field and rename bio → description
-- Date: 2025-01-27

-- Step 1: Add new description column
ALTER TABLE artists ADD COLUMN description TEXT;

-- Step 2: Copy bio data to description column
UPDATE artists SET description = bio WHERE bio IS NOT NULL;

-- Step 3: Remove old bio column
ALTER TABLE artists DROP COLUMN bio;

-- Step 4: Remove website column (website data should be in tags)
ALTER TABLE artists DROP COLUMN website;

-- Update sample artist data to use description field
UPDATE artists 
SET description = 'Unknown artist - details to be updated when information becomes available'
WHERE id = '00000000-0000-0000-0000-000000000001' AND description IS NULL;

-- Verify schema changes
-- Expected result: artists table should have description field but no bio or website fields
SELECT sql FROM sqlite_master WHERE type='table' AND name='artists';