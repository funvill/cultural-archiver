-- Migration: Add title, description, and created_by fields to artwork table
-- Date: 2025-01-08
-- Description: Adds structured fields to artwork table to support fast workflow

-- Add new columns to artwork table
ALTER TABLE artwork ADD COLUMN title TEXT;
ALTER TABLE artwork ADD COLUMN description TEXT;
ALTER TABLE artwork ADD COLUMN created_by TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_artwork_title ON artwork(title);
CREATE INDEX IF NOT EXISTS idx_artwork_created_by ON artwork(created_by);
