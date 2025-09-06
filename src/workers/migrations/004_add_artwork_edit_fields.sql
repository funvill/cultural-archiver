-- Add editable fields to artwork table for editing system
-- Generated on: 2025-01-09T00:00:00.000Z
-- Purpose: Add missing fields that can be edited through the artwork editing system
-- Related to: tasks-prd-artwork-editing-system.md
-- Updated for D1 compatibility: 2025-01-08 (removed PRAGMA)

-- D1 COMPATIBILITY NOTE: Removed PRAGMA foreign_keys = ON (not supported in D1)

-- Add editable fields to artwork table
ALTER TABLE artwork ADD COLUMN title TEXT;
ALTER TABLE artwork ADD COLUMN description TEXT;
ALTER TABLE artwork ADD COLUMN created_by TEXT; -- Creator/artist name(s)

-- Create index for text search on title and description
CREATE INDEX idx_artwork_title ON artwork(title);
CREATE INDEX idx_artwork_description ON artwork(description);
CREATE INDEX idx_artwork_created_by ON artwork(created_by);

-- Update existing artwork records to have empty values for new fields
-- This prevents NULL issues in the edit system
UPDATE artwork SET 
    title = '',
    description = '',
    created_by = ''
WHERE title IS NULL OR description IS NULL OR created_by IS NULL;