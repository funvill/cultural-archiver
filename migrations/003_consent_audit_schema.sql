-- Cultural Archiver - Consent and Audit Logging Schema Migration
-- Migration: 003_consent_audit_schema.sql
-- Purpose: Add consent tracking and audit logging capabilities
-- Author: Cultural Archiver System
-- Date: 2025-08-28

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ================================
-- Consent Tracking Enhancements
-- ================================

-- Add consent_version field to track consent changes
-- This allows us to detect when users need to re-consent
-- due to legal terms updates
ALTER TABLE logbook ADD COLUMN consent_version TEXT DEFAULT '1.0.0';

-- Add processing_status field to track submission workflow
-- This helps with moderation and batch processing
ALTER TABLE logbook ADD COLUMN processing_status TEXT CHECK (processing_status IN ('uploading', 'processing', 'ready', 'failed')) DEFAULT 'ready';

-- ================================
-- Audit Logging Table
-- ================================

-- Create audit_logs table for content moderation tracking
-- This table records all moderation actions for accountability
-- and provides a complete audit trail for all changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'submission_created',
        'submission_approved', 
        'submission_rejected',
        'artwork_created',
        'artwork_updated',
        'artwork_removed',
        'consent_collected',
        'consent_updated',
        'email_verified',
        'photo_uploaded',
        'photo_processed',
        'batch_processed'
    )),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('artwork', 'logbook', 'user', 'photo', 'consent')),
    entity_id TEXT NOT NULL,
    user_token TEXT NOT NULL,
    moderator_token TEXT, -- NULL for system actions
    action_data TEXT, -- JSON data specific to the action
    reason TEXT, -- For rejections and removals
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints where applicable
    FOREIGN KEY (entity_id) REFERENCES logbook(id) ON DELETE CASCADE,
    FOREIGN KEY (user_token) REFERENCES logbook(user_token) ON DELETE CASCADE
);

-- ================================
-- Consent Storage Table 
-- ================================

-- Create consent_records table for persistent consent tracking
-- This table stores user consent independently of submissions
-- allowing for consent version management and re-consent workflows
CREATE TABLE IF NOT EXISTS consent_records (
    id TEXT PRIMARY KEY,
    user_token TEXT NOT NULL,
    consent_version TEXT NOT NULL DEFAULT '1.0.0',
    age_verification BOOLEAN NOT NULL DEFAULT FALSE,
    cc0_licensing BOOLEAN NOT NULL DEFAULT FALSE,
    public_commons BOOLEAN NOT NULL DEFAULT FALSE,
    freedom_of_panorama BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address TEXT,
    user_agent TEXT,
    consented_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT, -- For time-limited consents
    revoked_at TEXT, -- If user revokes consent
    
    -- Ensure one active consent per user per version
    UNIQUE(user_token, consent_version)
);

-- ================================
-- Enhanced Photo Metadata Table
-- ================================

-- Create photo_metadata table for detailed photo processing tracking
-- This supports advanced photo processing pipeline with variants and EXIF data
CREATE TABLE IF NOT EXISTS photo_metadata (
    id TEXT PRIMARY KEY,
    photo_url TEXT NOT NULL, -- Original R2 or Cloudflare Images URL
    logbook_entry_id TEXT NOT NULL,
    variant_type TEXT CHECK (variant_type IN ('original', 'thumbnail', '200px', '400px', '800px', '1200px')) DEFAULT 'original',
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    aspect_ratio REAL,
    dominant_color TEXT, -- Hex color for progressive loading
    exif_processed BOOLEAN DEFAULT FALSE,
    permalink_injected BOOLEAN DEFAULT FALSE,
    gps_latitude REAL,
    gps_longitude REAL,
    camera_make TEXT,
    camera_model TEXT,
    taken_at TEXT, -- From EXIF DateTime
    processing_status TEXT CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    cloudflare_image_id TEXT, -- For Cloudflare Images integration
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (logbook_entry_id) REFERENCES logbook(id) ON DELETE CASCADE
);

-- ================================
-- Indexes for Performance
-- ================================

-- Audit log indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_token);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Consent record indexes
CREATE INDEX IF NOT EXISTS idx_consent_user_version ON consent_records(user_token, consent_version);
CREATE INDEX IF NOT EXISTS idx_consent_consented_at ON consent_records(consented_at);
CREATE INDEX IF NOT EXISTS idx_consent_expires_at ON consent_records(expires_at);

-- Photo metadata indexes
CREATE INDEX IF NOT EXISTS idx_photo_metadata_logbook ON photo_metadata(logbook_entry_id);
CREATE INDEX IF NOT EXISTS idx_photo_metadata_variant ON photo_metadata(variant_type);
CREATE INDEX IF NOT EXISTS idx_photo_metadata_status ON photo_metadata(processing_status);
CREATE INDEX IF NOT EXISTS idx_photo_metadata_gps ON photo_metadata(gps_latitude, gps_longitude);
CREATE INDEX IF NOT EXISTS idx_photo_metadata_cloudflare ON photo_metadata(cloudflare_image_id);

-- Enhanced logbook indexes for new fields
CREATE INDEX IF NOT EXISTS idx_logbook_consent_version ON logbook(consent_version);
CREATE INDEX IF NOT EXISTS idx_logbook_processing_status ON logbook(processing_status);

-- ================================
-- Sample Audit Log Data
-- ================================

-- Insert sample audit log entries for testing
INSERT OR REPLACE INTO audit_logs (
    id, action_type, entity_type, entity_id, user_token, 
    action_data, created_at
) VALUES 
(
    'SAMPLE-audit-001',
    'submission_created',
    'logbook',
    'SAMPLE-logbook-001',
    'SAMPLE-user-001',
    '{"submission_type": "new_artwork", "photos_count": 2, "location": "Vancouver, BC"}',
    '2025-08-28 19:00:00'
),
(
    'SAMPLE-audit-002', 
    'submission_approved',
    'logbook',
    'SAMPLE-logbook-001',
    'SAMPLE-user-001',
    '{"approved_by": "moderator-001", "artwork_created": "SAMPLE-artwork-001"}',
    '2025-08-28 19:30:00'
),
(
    'SAMPLE-audit-003',
    'consent_collected',
    'consent',
    'SAMPLE-consent-001',
    'SAMPLE-user-002',
    '{"consent_version": "1.0.0", "all_consents": true}',
    '2025-08-28 20:00:00'
);

-- ================================
-- Sample Consent Records
-- ================================

-- Insert sample consent records for testing
INSERT OR REPLACE INTO consent_records (
    id, user_token, consent_version, age_verification,
    cc0_licensing, public_commons, freedom_of_panorama,
    consented_at
) VALUES 
(
    'SAMPLE-consent-001',
    'SAMPLE-user-001',
    '1.0.0',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    '2025-08-28 18:00:00'
),
(
    'SAMPLE-consent-002',
    'SAMPLE-user-002', 
    '1.0.0',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    '2025-08-28 19:00:00'
);

-- ================================
-- Sample Photo Metadata
-- ================================

-- Insert sample photo metadata for testing
INSERT OR REPLACE INTO photo_metadata (
    id, photo_url, logbook_entry_id, variant_type,
    file_size, mime_type, width, height,
    exif_processed, permalink_injected,
    gps_latitude, gps_longitude,
    camera_make, camera_model,
    processing_status
) VALUES 
(
    'SAMPLE-photo-meta-001',
    'https://photos.cultural-archiver.com/2025/08/28/sample-001-original.jpg',
    'SAMPLE-logbook-001',
    'original',
    2048576,
    'image/jpeg',
    3000,
    2000,
    TRUE,
    TRUE,
    49.2827,
    -123.1207,
    'Canon',
    'EOS R5',
    'completed'
),
(
    'SAMPLE-photo-meta-002',
    'https://photos.cultural-archiver.com/2025/08/28/sample-001-thumb.jpg',
    'SAMPLE-logbook-001',
    'thumbnail',
    204857,
    'image/jpeg',
    800,
    533,
    TRUE,
    TRUE,
    49.2827,
    -123.1207,
    'Canon',
    'EOS R5',
    'completed'
);

-- ================================
-- Update existing sample data
-- ================================

-- Update existing logbook entries with new fields
UPDATE logbook 
SET 
    consent_version = '1.0.0',
    processing_status = 'ready'
WHERE id LIKE 'SAMPLE-%';

-- ================================
-- Verification Queries
-- ================================

-- These queries verify the migration was successful
-- (These are comments for reference, not executed)

-- Verify audit logs table structure:
-- PRAGMA table_info(audit_logs);

-- Verify consent records table structure:
-- PRAGMA table_info(consent_records);

-- Verify photo metadata table structure:  
-- PRAGMA table_info(photo_metadata);

-- Verify sample data count:
-- SELECT COUNT(*) FROM audit_logs WHERE id LIKE 'SAMPLE-%';
-- SELECT COUNT(*) FROM consent_records WHERE id LIKE 'SAMPLE-%';
-- SELECT COUNT(*) FROM photo_metadata WHERE id LIKE 'SAMPLE-%';

-- ================================
-- Migration Notes
-- ================================

-- This migration adds:
-- 1. Audit logging for all moderation actions
-- 2. Persistent consent tracking with versioning
-- 3. Enhanced photo metadata for advanced processing
-- 4. Comprehensive indexes for performance
-- 5. Sample data for immediate testing

-- The migration is designed to be backwards compatible
-- with existing logbook and artwork tables while 
-- extending functionality for production use.

-- Foreign key constraints ensure referential integrity
-- while CASCADE deletes maintain data consistency.