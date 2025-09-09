-- Migration: Add title, description, and created_by fields to artwork table
-- Date: 2025-01-08
-- Description: Adds structured fields to artwork table to support fast workflow
-- Note: Columns already exist in base schema, just adding indexes

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_artwork_title ON artwork(title);
CREATE INDEX IF NOT EXISTS idx_artwork_created_by ON artwork(created_by);
