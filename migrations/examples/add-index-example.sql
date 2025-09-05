-- Migration: Add Index Example
-- Created: [TIMESTAMP]
-- Author: [AUTHOR]
-- Description: Example showing how to add indexes to existing tables
--
-- ================================
-- D1 COMPATIBILITY NOTES:
-- ================================
-- ✅ DO USE:
--   - Standard CREATE INDEX statements
--   - Single-column and multi-column indexes
--   - UNIQUE indexes
--   - Partial indexes with WHERE conditions
--
-- ❌ DO NOT USE:
--   - Expression indexes with complex functions
--   - Indexes on computed columns
--   - Full-text search indexes
--   - Custom collation in indexes
--
-- ================================
-- MIGRATION CONTENT START
-- ================================

-- Add indexes to improve query performance on existing tables

-- Index for artwork location queries (composite index for lat/lon)
CREATE INDEX idx_artworks_location ON artworks(lat, lon);

-- Index for artwork status and approval queries
CREATE INDEX idx_artworks_status_created ON artworks(status, created_at);

-- Index for user token lookups
CREATE INDEX idx_artworks_user_token ON artworks(user_token);

-- Partial index for approved artworks only (more efficient)
CREATE INDEX idx_artworks_approved_location ON artworks(lat, lon) 
    WHERE status = 'approved';

-- Index for artwork submissions by date range
CREATE INDEX idx_artworks_submitted_date ON artworks(submitted_at);

-- Index for artwork tags (if stored as JSON, index the column)
CREATE INDEX idx_artworks_tags ON artworks(tags);

-- ================================
-- MIGRATION CONTENT END  
-- ================================