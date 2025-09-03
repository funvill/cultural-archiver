-- Cultural Archiver - Fix Missing Location Data in Logbook
-- Migration: 004_add_logbook_location.sql
-- Purpose: Add latitude and longitude columns to logbook table to store submission locations
-- Author: GitHub Copilot
-- Date: 2025-09-02

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ================================
-- Add Location Data to Logbook Table
-- ================================

-- Add latitude column to logbook table
-- This stores the submitted location for new artwork submissions
ALTER TABLE logbook ADD COLUMN lat REAL;

-- Add longitude column to logbook table  
-- This stores the submitted location for new artwork submissions
ALTER TABLE logbook ADD COLUMN lon REAL;

-- Create index for spatial queries on logbook submissions
-- This allows efficient nearby submission queries during moderation
CREATE INDEX IF NOT EXISTS idx_logbook_lat_lon ON logbook(lat, lon);

-- ================================
-- Update Data Types Documentation
-- ================================

-- The logbook table now stores location data for submissions that don't yet have an artwork_id
-- Workflow:
-- 1. User submits with lat/lon -> stored in logbook.lat, logbook.lon, artwork_id=NULL
-- 2. Moderator approves -> either:
--    a) Link to existing artwork: set artwork_id, keep lat/lon for reference
--    b) Create new artwork: create artwork record, set artwork_id, keep lat/lon for reference
-- 3. User queries show location from artwork.lat/lon if artwork_id exists, otherwise logbook.lat/lon
