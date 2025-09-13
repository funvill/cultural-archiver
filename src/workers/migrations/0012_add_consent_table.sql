-- Migration: Add centralized consent table and remove consent_version columns
-- Date: 2025-09-11
-- Description:
--   Create a dedicated consent table to centralize consent tracking by removing
--   consent_version from resource tables (artwork, logbook) and creating a 
--   flexible consent system that supports both authenticated users and anonymous
--   submissions with proper legal compliance audit trail.

-- Create the consent table with all required fields
CREATE TABLE consent (
  id TEXT PRIMARY KEY,                    -- UUID
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id TEXT,                          -- References users.uuid, nullable for anonymous
  anonymous_token TEXT,                  -- UUID for anonymous users, nullable for authenticated
  consent_version TEXT NOT NULL,         -- Frontend-provided policy version
  content_type TEXT NOT NULL,            -- 'artwork', 'logbook', etc.
  content_id TEXT NOT NULL,              -- Resource ID of the content
  ip_address TEXT NOT NULL,              -- For legal compliance
  consent_text_hash TEXT NOT NULL,       -- Hash of exact consent text shown
  
  -- Constraints: Exactly one of user_id OR anonymous_token must be non-null (enforced at application level)
  UNIQUE(user_id, anonymous_token, content_type, content_id, consent_version)
);

-- Create indexes for efficient queries
CREATE INDEX idx_consent_content_type_id ON consent(content_type, content_id);
CREATE INDEX idx_consent_user_id ON consent(user_id);
CREATE INDEX idx_consent_anonymous_token ON consent(anonymous_token);
CREATE INDEX idx_consent_version ON consent(consent_version);
CREATE INDEX idx_consent_created_at ON consent(created_at);

-- Drop the existing consent version indexes first before removing the columns
DROP INDEX IF EXISTS idx_artwork_consent_version;
DROP INDEX IF EXISTS idx_logbook_consent_version;

-- Remove consent_version columns from artwork and logbook tables
-- This centralizes consent tracking in the dedicated consent table
ALTER TABLE artwork DROP COLUMN consent_version;
ALTER TABLE logbook DROP COLUMN consent_version;

-- Sample data for testing the consent system
-- Mass import reserved UUID for system-generated content
INSERT INTO consent (id, user_id, anonymous_token, consent_version, content_type, content_id, ip_address, consent_text_hash) 
VALUES 
('consent-test-1', '00000000-0000-0000-0000-000000000002', NULL, '2025-09-08.v1', 'artwork', 'SAMPLE-artwork-approved-1', '127.0.0.1', 'hash123'),
('consent-test-2', NULL, 'test-anonymous-token', '2025-09-08.v1', 'logbook', 'test-logbook-1', '127.0.0.1', 'hash456');