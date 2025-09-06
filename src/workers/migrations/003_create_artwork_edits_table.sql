-- Create artwork edits table for community editing system
-- Generated on: 2025-09-04T22:55:00.000Z
-- Purpose: Store proposed edits to artwork records in flexible key-value format
-- PRD: prd-artwork-editing-system.md
-- Updated for D1 compatibility: 2025-01-08 (removed PRAGMA)

-- D1 COMPATIBILITY NOTE: Removed PRAGMA foreign_keys = ON (not supported in D1)

-- Table: artwork_edits
-- Stores proposed edits to artwork records using key-value pairs for flexibility
CREATE TABLE artwork_edits (
    edit_id TEXT PRIMARY KEY,                              -- Unique edit identifier (UUID)
    artwork_id TEXT NOT NULL,                              -- Reference to artwork being edited
    user_token TEXT NOT NULL,                              -- User proposing the edit
    field_name TEXT NOT NULL,                              -- Field being edited (e.g., 'title', 'description', 'created_by', 'tags')
    field_value_old TEXT,                                  -- Original value before edit (JSON for complex types)
    field_value_new TEXT,                                  -- Proposed new value (JSON for complex types)
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    moderator_notes TEXT,                                  -- Feedback from moderator on rejection
    reviewed_at TEXT,                                      -- Timestamp when moderated
    reviewed_by TEXT,                                      -- Moderator who reviewed (user_token)
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')), -- When edit was submitted
    FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX idx_artwork_edits_artwork_id ON artwork_edits(artwork_id);
CREATE INDEX idx_artwork_edits_user_token ON artwork_edits(user_token);
CREATE INDEX idx_artwork_edits_status ON artwork_edits(status);
CREATE INDEX idx_artwork_edits_submitted_at ON artwork_edits(submitted_at DESC);

-- Composite index for moderation queue queries (status + submitted_at)
CREATE INDEX idx_artwork_edits_moderation_queue ON artwork_edits(status, submitted_at DESC);

-- Index for user pending edits queries
CREATE INDEX idx_artwork_edits_user_pending ON artwork_edits(user_token, artwork_id, status) WHERE status = 'pending';