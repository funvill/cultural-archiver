-- Cultural Archiver Authentication System Tables
-- Implements UUID-based anonymous users with magic link authentication
-- Version: 005  
-- Date: 2025-JAN-03

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ================================
-- Users Table
-- Core table for authenticated users with UUID claiming
-- ================================
CREATE TABLE users (
    uuid TEXT PRIMARY KEY,  -- User's claimed UUID (same as anonymous token)
    email TEXT NOT NULL UNIQUE,  -- User's email address
    created_at TEXT NOT NULL DEFAULT (datetime('now')),  -- Account creation timestamp
    last_login TEXT,  -- Last login timestamp (NULL for new accounts)
    email_verified_at TEXT,  -- When email was verified via magic link (NULL if not verified)
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),  -- Account status
    CONSTRAINT users_uuid_format CHECK (uuid LIKE '________-____-4___-____-____________')  -- UUID v4 format validation
);

-- Indexes for user queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_last_login ON users(last_login);

-- ================================
-- Magic Links Table
-- Secure tokens for email-based authentication
-- ================================
CREATE TABLE magic_links (
    token TEXT PRIMARY KEY,  -- Cryptographically secure token (32+ bytes)
    email TEXT NOT NULL,  -- Target email address
    user_uuid TEXT,  -- Associated user UUID (NULL for new account creation)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),  -- Token generation timestamp
    expires_at TEXT NOT NULL,  -- Token expiration (1 hour from creation)
    used_at TEXT,  -- When token was consumed (NULL if not used)
    ip_address TEXT,  -- IP address that requested the magic link
    user_agent TEXT,  -- User agent that requested the magic link
    is_signup BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE for account creation, FALSE for login
    FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE,
    CONSTRAINT magic_link_token_length CHECK (length(token) >= 64),  -- Min 32 bytes = 64 hex chars
    CONSTRAINT magic_link_expires_valid CHECK (expires_at > created_at),
    CONSTRAINT magic_link_used_valid CHECK (used_at IS NULL OR used_at >= created_at)
);

-- Indexes for magic link queries and cleanup
CREATE INDEX idx_magic_links_email ON magic_links(email);
CREATE INDEX idx_magic_links_expires_at ON magic_links(expires_at);
CREATE INDEX idx_magic_links_used_at ON magic_links(used_at);
CREATE INDEX idx_magic_links_created_at ON magic_links(created_at);

-- ================================
-- Rate Limiting Table  
-- Track request rates for magic link abuse prevention
-- ================================
CREATE TABLE rate_limiting (
    identifier TEXT NOT NULL,  -- Email address or IP address
    identifier_type TEXT NOT NULL CHECK (identifier_type IN ('email', 'ip')),  -- Type of identifier
    request_count INTEGER NOT NULL DEFAULT 0,  -- Number of requests in current window
    window_start TEXT NOT NULL DEFAULT (datetime('now')),  -- Start of current rate limit window
    last_request_at TEXT NOT NULL DEFAULT (datetime('now')),  -- Timestamp of most recent request
    blocked_until TEXT,  -- Block identifier until this time (NULL if not blocked)
    PRIMARY KEY (identifier, identifier_type),
    CONSTRAINT rate_limit_count_positive CHECK (request_count >= 0),
    CONSTRAINT rate_limit_window_valid CHECK (last_request_at >= window_start)
);

-- Indexes for rate limiting queries and cleanup
CREATE INDEX idx_rate_limiting_identifier ON rate_limiting(identifier);
CREATE INDEX idx_rate_limiting_window_start ON rate_limiting(window_start);
CREATE INDEX idx_rate_limiting_blocked_until ON rate_limiting(blocked_until);

-- ================================
-- Authentication Sessions Table
-- Track active authentication sessions across devices
-- ================================
CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY,  -- Session identifier (UUID)
    user_uuid TEXT NOT NULL,  -- Associated user UUID
    token_hash TEXT NOT NULL,  -- Hash of the session token for security
    created_at TEXT NOT NULL DEFAULT (datetime('now')),  -- Session creation timestamp
    last_accessed_at TEXT NOT NULL DEFAULT (datetime('now')),  -- Last access timestamp
    expires_at TEXT,  -- Session expiration (NULL for persistent sessions)
    ip_address TEXT,  -- IP address of session
    user_agent TEXT,  -- User agent of session
    is_active BOOLEAN NOT NULL DEFAULT TRUE,  -- Session active status
    device_info TEXT,  -- Optional device fingerprint/info (JSON)
    FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE,
    CONSTRAINT auth_session_hash_length CHECK (length(token_hash) = 64),  -- SHA-256 hash
    CONSTRAINT auth_session_accessed_valid CHECK (last_accessed_at >= created_at)
);

-- Indexes for session management
CREATE INDEX idx_auth_sessions_user_uuid ON auth_sessions(user_uuid);
CREATE INDEX idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX idx_auth_sessions_last_accessed ON auth_sessions(last_accessed_at);
CREATE INDEX idx_auth_sessions_active ON auth_sessions(is_active);

-- ================================
-- Sample Data for Testing
-- ================================

-- Sample users (using SAMPLE prefix for easy identification)
INSERT INTO users (uuid, email, created_at, last_login, email_verified_at, status) VALUES
    ('SAMPLE01-1234-4567-8901-123456789012', 'alice@example.com', '2024-12-01 10:00:00', '2024-12-27 15:30:00', '2024-12-01 10:15:00', 'active'),
    ('SAMPLE02-2345-4567-8901-123456789012', 'bob@example.com', '2024-12-15 14:20:00', '2024-12-26 09:45:00', '2024-12-15 14:35:00', 'active'),
    ('SAMPLE03-3456-4567-8901-123456789012', 'charlie@example.com', '2024-12-20 16:45:00', NULL, NULL, 'active');  -- New user, never logged in

-- Sample expired magic links (for testing cleanup)
INSERT INTO magic_links (token, email, user_uuid, created_at, expires_at, used_at, is_signup) VALUES
    ('SAMPLE_TOKEN_64_CHARACTERS_LONG_EXPIRED_MAGIC_LINK_FOR_TESTING_123', 'alice@example.com', 'SAMPLE01-1234-4567-8901-123456789012', '2024-12-01 10:00:00', '2024-12-01 11:00:00', '2024-12-01 10:15:00', FALSE),
    ('SAMPLE_TOKEN_64_CHARACTERS_LONG_EXPIRED_UNUSED_LINK_FOR_TESTING_456', 'expired@example.com', NULL, '2024-12-01 08:00:00', '2024-12-01 09:00:00', NULL, TRUE);

-- Sample rate limiting entries
INSERT INTO rate_limiting (identifier, identifier_type, request_count, window_start, last_request_at) VALUES
    ('alice@example.com', 'email', 2, '2024-12-27 15:00:00', '2024-12-27 15:30:00'),
    ('192.168.1.100', 'ip', 5, '2024-12-27 14:00:00', '2024-12-27 15:45:00'),
    ('spam@example.com', 'email', 15, '2024-12-27 10:00:00', '2024-12-27 10:55:00');

-- Sample active sessions
INSERT INTO auth_sessions (id, user_uuid, token_hash, created_at, last_accessed_at, ip_address, user_agent, is_active) VALUES
    ('SAMPLE-session-1234-5678-9012-345678901234', 'SAMPLE01-1234-4567-8901-123456789012', 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890', '2024-12-27 15:30:00', '2024-12-27 16:45:00', '192.168.1.101', 'Mozilla/5.0 (Sample Browser)', TRUE),
    ('SAMPLE-session-2345-6789-0123-456789012345', 'SAMPLE02-2345-4567-8901-123456789012', 'b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1', '2024-12-26 09:45:00', '2024-12-27 08:20:00', '192.168.1.102', 'Mozilla/5.0 (Sample Mobile)', TRUE);

-- Update logbook entries to reference authenticated users
UPDATE logbook SET user_token = 'SAMPLE01-1234-4567-8901-123456789012' WHERE id = 'SAMPLE-logbook-approved-1';
UPDATE logbook SET user_token = 'SAMPLE02-2345-4567-8901-123456789012' WHERE id = 'SAMPLE-logbook-approved-2';
UPDATE logbook SET user_token = 'SAMPLE03-3456-4567-8901-123456789012' WHERE id = 'SAMPLE-logbook-pending-1';

-- Log the schema migration
INSERT INTO logbook (id, artwork_id, user_token, note, photos, status) VALUES
    ('migration-log-005', NULL, 'system', 'Authentication System Migration Complete - Added users, magic_links, rate_limiting, and auth_sessions tables with comprehensive indexes and constraints', '[]', 'approved');