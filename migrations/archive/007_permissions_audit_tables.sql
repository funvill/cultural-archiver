-- Cultural Archiver Permission Management and Audit Schema
-- Adds user permissions and comprehensive audit logging for enhanced moderation
-- Version: 007
-- Date: 2025-JAN-03

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ================================
-- User Permissions Table
-- Database-backed role management system
-- ================================
CREATE TABLE user_permissions (
    id TEXT PRIMARY KEY,
    user_uuid TEXT NOT NULL,
    permission TEXT NOT NULL CHECK (permission IN ('moderator', 'admin')),
    granted_by TEXT NOT NULL, -- admin user_uuid who granted this permission
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT NULL,
    revoked_by TEXT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    notes TEXT -- reason for granting/revoking
);

-- Indexes for permission lookups
CREATE UNIQUE INDEX idx_user_permissions_active ON user_permissions(user_uuid, permission) WHERE is_active = 1;
CREATE INDEX idx_user_permissions_user ON user_permissions(user_uuid);
CREATE INDEX idx_user_permissions_permission ON user_permissions(permission);
CREATE INDEX idx_user_permissions_granted_by ON user_permissions(granted_by);

-- ================================
-- Moderation Decisions Audit Table
-- Comprehensive logging of all moderation actions
-- ================================
CREATE TABLE moderation_decisions (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL, -- logbook entry ID
    moderator_uuid TEXT NOT NULL, -- who made the decision
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'skipped')),
    reason TEXT, -- reason for rejection or notes
    metadata TEXT, -- JSON: IP, user agent, session info
    artwork_id TEXT, -- created or linked artwork ID (for approvals)
    action_taken TEXT, -- 'create_new', 'link_existing', or NULL for rejections
    photos_processed INTEGER DEFAULT 0, -- number of photos migrated
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for audit queries
CREATE INDEX idx_moderation_decisions_submission ON moderation_decisions(submission_id);
CREATE INDEX idx_moderation_decisions_moderator ON moderation_decisions(moderator_uuid);
CREATE INDEX idx_moderation_decisions_decision ON moderation_decisions(decision);
CREATE INDEX idx_moderation_decisions_created_at ON moderation_decisions(created_at);
CREATE INDEX idx_moderation_decisions_artwork ON moderation_decisions(artwork_id) WHERE artwork_id IS NOT NULL;

-- ================================
-- Admin Actions Audit Table
-- Logging of administrative permission changes
-- ================================
CREATE TABLE admin_actions (
    id TEXT PRIMARY KEY,
    admin_uuid TEXT NOT NULL, -- admin performing the action
    action_type TEXT NOT NULL CHECK (action_type IN ('grant_permission', 'revoke_permission', 'view_audit_logs')),
    target_uuid TEXT, -- user being affected (for permission changes)
    permission_type TEXT, -- 'moderator' or 'admin' (for permission actions)
    old_value TEXT, -- previous state (JSON for complex changes)
    new_value TEXT, -- new state (JSON for complex changes)
    reason TEXT, -- reason for the action
    metadata TEXT, -- JSON: IP, user agent, session info
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for admin audit queries
CREATE INDEX idx_admin_actions_admin ON admin_actions(admin_uuid);
CREATE INDEX idx_admin_actions_target ON admin_actions(target_uuid) WHERE target_uuid IS NOT NULL;
CREATE INDEX idx_admin_actions_type ON admin_actions(action_type);
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at);

-- ================================
-- Sample data for testing permission system
-- ================================

-- Create some sample admin and moderator users
INSERT INTO user_permissions (id, user_uuid, permission, granted_by, notes) VALUES
    ('SAMPLE-perm-admin-1', 'SAMPLE-admin-user-001', 'admin', 'system', 'SAMPLE: Initial system admin for testing'),
    ('SAMPLE-perm-admin-2', 'SAMPLE-admin-user-002', 'admin', 'SAMPLE-admin-user-001', 'SAMPLE: Secondary admin user'),
    ('SAMPLE-perm-mod-1', 'SAMPLE-moderator-001', 'moderator', 'SAMPLE-admin-user-001', 'SAMPLE: Primary moderator for testing'),
    ('SAMPLE-perm-mod-2', 'SAMPLE-moderator-002', 'moderator', 'SAMPLE-admin-user-001', 'SAMPLE: Secondary moderator for testing'),
    ('SAMPLE-perm-mod-3', 'SAMPLE-moderator-003', 'moderator', 'SAMPLE-admin-user-002', 'SAMPLE: Third moderator for load testing');

-- Sample moderation decisions for audit trail testing
INSERT INTO moderation_decisions (id, submission_id, moderator_uuid, decision, reason, artwork_id, action_taken, photos_processed, metadata) VALUES
    ('SAMPLE-decision-1', 'SAMPLE-logbook-approved-1', 'SAMPLE-moderator-001', 'approved', 'Good quality artwork submission', 'SAMPLE-artwork-approved-1', 'create_new', 2, '{"ip":"192.168.1.100","user_agent":"Mozilla/5.0","session_id":"sample-session-1"}'),
    ('SAMPLE-decision-2', 'SAMPLE-logbook-approved-2', 'SAMPLE-moderator-002', 'approved', 'Linked to existing artwork', 'SAMPLE-artwork-approved-2', 'link_existing', 1, '{"ip":"192.168.1.101","user_agent":"Mozilla/5.0","session_id":"sample-session-2"}'),
    ('SAMPLE-decision-3', 'SAMPLE-logbook-rejected-1', 'SAMPLE-moderator-001', 'rejected', 'Poor image quality, not suitable for archive', NULL, NULL, 0, '{"ip":"192.168.1.100","user_agent":"Mozilla/5.0","session_id":"sample-session-3"}'),
    ('SAMPLE-decision-4', 'SAMPLE-logbook-rejected-2', 'SAMPLE-moderator-003', 'rejected', 'Inappropriate content', NULL, NULL, 0, '{"ip":"192.168.1.102","user_agent":"Mozilla/5.0","session_id":"sample-session-4"}');

-- Sample admin actions for audit trail testing
INSERT INTO admin_actions (id, admin_uuid, action_type, target_uuid, permission_type, old_value, new_value, reason, metadata) VALUES
    ('SAMPLE-admin-1', 'SAMPLE-admin-user-001', 'grant_permission', 'SAMPLE-moderator-001', 'moderator', 'null', '{"permission":"moderator","granted_at":"2025-01-03T15:30:00Z"}', 'Initial moderator setup', '{"ip":"192.168.1.200","user_agent":"Mozilla/5.0","session_id":"admin-session-1"}'),
    ('SAMPLE-admin-2', 'SAMPLE-admin-user-001', 'grant_permission', 'SAMPLE-admin-user-002', 'admin', 'null', '{"permission":"admin","granted_at":"2025-01-03T15:35:00Z"}', 'Adding secondary admin for redundancy', '{"ip":"192.168.1.200","user_agent":"Mozilla/5.0","session_id":"admin-session-2"}'),
    ('SAMPLE-admin-3', 'SAMPLE-admin-user-002', 'grant_permission', 'SAMPLE-moderator-002', 'moderator', 'null', '{"permission":"moderator","granted_at":"2025-01-03T15:40:00Z"}', 'Expanding moderation team', '{"ip":"192.168.1.201","user_agent":"Mozilla/5.0","session_id":"admin-session-3"}');

-- Log the schema migration
INSERT INTO logbook (id, artwork_id, user_token, note, photos, status) VALUES
    ('migration-log-007', NULL, 'system', 'SAMPLE: Permission Management and Audit Schema Migration Complete - Added user_permissions, moderation_decisions, and admin_actions tables for enhanced moderation system', '[]', 'approved');