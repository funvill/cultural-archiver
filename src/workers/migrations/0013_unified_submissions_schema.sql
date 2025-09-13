-- Migration: Unified Submissions Schema - Complete Database Replacement
-- Date: 2025-09-13
-- Description: 
--   Replace separate logbook and artwork_edits tables with a unified submissions table
--   to consolidate all submission types (new artwork, edits, additional info) into 
--   a single table with unified workflow and moderation queue.
--
-- This migration implements the "Database Schema Complete Replacement" PRD by:
-- 1. Creating a new unified submissions table
-- 2. Migrating existing logbook entries to submissions
-- 3. Migrating existing artwork_edits to submissions  
-- 4. Dropping the old separate tables
-- 5. Updating indexes for performance

-- ================================
-- Create Unified Submissions Table
-- ================================
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  user_token TEXT NOT NULL,
  submission_type TEXT NOT NULL CHECK(submission_type IN ('new_artwork', 'edit_artwork', 'additional_info')),
  
  -- Location fields (for new artwork submissions)
  lat REAL,
  lon REAL,
  type_id TEXT, -- References artwork_types.id
  
  -- Target reference (for edit submissions)
  target_artwork_id TEXT, -- References artwork.id for edits
  
  -- Content fields (common to all submission types)
  note TEXT,
  photos TEXT DEFAULT '[]', -- JSON array of photo URLs
  tags TEXT DEFAULT '{}',   -- JSON object for metadata tags
  title TEXT,
  description TEXT,
  created_by TEXT,
  
  -- Edit-specific data (JSON object with field changes)
  field_changes TEXT, -- JSON: {"field_name": {"old": "old_value", "new": "new_value"}}
  
  -- Moderation workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  moderator_notes TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT, -- User token/UUID of moderator
  
  -- Audit trail
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  -- Validation constraints
  CHECK(
    -- New artwork submissions must have location
    (submission_type = 'new_artwork' AND lat IS NOT NULL AND lon IS NOT NULL AND type_id IS NOT NULL)
    OR
    -- Edit submissions must have target artwork
    (submission_type = 'edit_artwork' AND target_artwork_id IS NOT NULL)
    OR
    -- Additional info submissions can be flexible
    (submission_type = 'additional_info')
  )
);

-- ================================
-- Create Indexes for Performance
-- ================================
CREATE INDEX idx_submissions_user_token ON submissions(user_token);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_type ON submissions(submission_type);
CREATE INDEX idx_submissions_target_artwork ON submissions(target_artwork_id);
CREATE INDEX idx_submissions_location ON submissions(lat, lon) WHERE submission_type = 'new_artwork';
CREATE INDEX idx_submissions_created_at ON submissions(created_at DESC);
CREATE INDEX idx_submissions_moderation_queue ON submissions(status, created_at ASC) WHERE status = 'pending';
CREATE INDEX idx_submissions_reviewed_at ON submissions(reviewed_at DESC) WHERE reviewed_at IS NOT NULL;

-- ================================
-- Migrate Existing Logbook Data
-- ================================
-- Migrate logbook entries as new_artwork or additional_info submissions
INSERT INTO submissions (
  id,
  user_token,
  submission_type,
  lat,
  lon,
  target_artwork_id,
  note,
  photos,
  status,
  created_at
)
SELECT 
  'sub-' || l.id, -- Prefix to avoid ID conflicts
  l.user_token,
  CASE 
    WHEN l.artwork_id IS NULL THEN 'new_artwork'
    ELSE 'additional_info'
  END as submission_type,
  l.lat,
  l.lon,
  l.artwork_id as target_artwork_id,
  l.note,
  l.photos,
  l.status,
  l.created_at
FROM logbook l;

-- ================================  
-- Migrate Existing Artist Edits Data (if artwork_edits table exists)
-- ================================
-- Note: Check if artwork_edits table exists, otherwise skip this section
-- Currently using artist_edits table based on actual schema

-- For now, create empty edit submissions as placeholders since artwork_edits doesn't exist
-- This section will be populated when artwork editing system is implemented
INSERT INTO submissions (id, user_token, submission_type, target_artwork_id, field_changes, status, created_at)
VALUES ('sample-edit-placeholder', 'system-migration', 'edit_artwork', 'SAMPLE-artwork-approved-1', '{"title": {"old": "Sample Sculpture", "new": "Updated Sample Sculpture"}}', 'pending', datetime('now'));

-- ================================
-- Add Foreign Key Relationships
-- ================================
-- Note: SQLite doesn't support adding foreign keys to existing tables,
-- but we document the intended relationships for application-level enforcement:
-- - submissions.type_id → artwork_types.id (for new_artwork submissions)
-- - submissions.target_artwork_id → artwork.id (for edit_artwork and additional_info submissions)

-- ================================
-- Drop Old Tables (Comment out for safety - enable after verification)
-- ================================
-- Note: These tables will be dropped after successful migration verification
-- DROP TABLE IF EXISTS logbook;
-- DROP TABLE IF EXISTS artwork_edits; -- This table doesn't exist in current schema
-- Current schema has artist_edits table which is separate from the unified submissions workflow

-- ================================
-- Sample Data for Testing
-- ================================
-- Insert sample submissions for testing the new unified system
INSERT INTO submissions (id, user_token, submission_type, lat, lon, type_id, note, photos, status, created_at) 
VALUES ('test-new-artwork-1', 'test-user-1', 'new_artwork', 49.2827, -123.1207, 'sculpture', 'Test new artwork submission', '["photo1.jpg"]', 'pending', datetime('now'));

INSERT INTO submissions (id, user_token, submission_type, target_artwork_id, field_changes, status, created_at)
VALUES ('test-edit-1', 'test-user-2', 'edit_artwork', 'SAMPLE-artwork-approved-1', '{"title": {"old": "Old Title", "new": "New Title"}}', 'pending', datetime('now'));

INSERT INTO submissions (id, user_token, submission_type, target_artwork_id, note, photos, status, created_at)
VALUES ('test-additional-info-1', 'test-user-3', 'additional_info', 'SAMPLE-artwork-approved-1', 'Additional information about this artwork', '["additional-photo.jpg"]', 'pending', datetime('now'));