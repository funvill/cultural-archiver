-- Fix missing editable fields in artwork table
-- Generated on: 2025-09-05T16:15:00.000Z
-- Purpose: Add missing editable fields that should exist from migration 004
-- This migration is idempotent and safe to run multiple times
-- Updated for D1 compatibility: 2025-01-08 (removed PRAGMA)

-- D1 COMPATIBILITY NOTE: Removed PRAGMA foreign_keys = ON (not supported in D1)

-- Add editable fields to artwork table if they don't exist
-- Note: SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so we handle this carefully

-- Add title column if it doesn't exist
ALTER TABLE artwork ADD COLUMN title TEXT;

-- Add description column if it doesn't exist  
ALTER TABLE artwork ADD COLUMN description TEXT;

-- Add created_by column if it doesn't exist
ALTER TABLE artwork ADD COLUMN created_by TEXT;

-- Create indexes if they don't exist (using IF NOT EXISTS is supported for indexes)
CREATE INDEX IF NOT EXISTS idx_artwork_title ON artwork(title);
CREATE INDEX IF NOT EXISTS idx_artwork_description ON artwork(description);  
CREATE INDEX IF NOT EXISTS idx_artwork_created_by ON artwork(created_by);

-- Update existing artwork records to have empty values for new fields
UPDATE artwork SET 
    title = COALESCE(title, ''),
    description = COALESCE(description, ''),
    created_by = COALESCE(created_by, '')
WHERE title IS NULL OR description IS NULL OR created_by IS NULL;
