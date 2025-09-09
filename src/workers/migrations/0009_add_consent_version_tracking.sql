-- Migration: Add consent version tracking for fast photo-first workflow
-- Date: 2025-09-09
-- Description: 
--   Add consent_version column to artwork and logbook tables to track which 
--   version of consent terms was accepted for each submission. This enables
--   the fast photo-first workflow to enforce current consent requirements
--   and provides audit trail for legal compliance.

-- Add consent_version to artwork table
ALTER TABLE artwork ADD COLUMN consent_version TEXT;

-- Add consent_version to logbook table  
ALTER TABLE logbook ADD COLUMN consent_version TEXT;

-- Create index for efficient consent version queries
CREATE INDEX idx_artwork_consent_version ON artwork(consent_version);
CREATE INDEX idx_logbook_consent_version ON logbook(consent_version);

-- Update existing records with a default consent version
-- These represent submissions made before consent version tracking
UPDATE artwork SET consent_version = '2025-09-08.v0' WHERE consent_version IS NULL;
UPDATE logbook SET consent_version = '2025-09-08.v0' WHERE consent_version IS NULL;

-- Sample data for testing the new consent version tracking
-- (These would be created through the normal submission process)
-- INSERT INTO artwork (id, lat, lon, type_id, consent_version, status) 
-- VALUES ('test-artwork-consent-1', 49.2827, -123.1207, 'public_art', '2025-09-08.v1', 'pending');