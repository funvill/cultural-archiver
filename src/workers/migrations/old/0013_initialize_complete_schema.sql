-- Migration: Initialize complete database schema
-- Date: 2025-01-14
-- Description: Creates all core tables for the unified submissions system

-- Core content tables
CREATE TABLE artwork (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  artist_names TEXT, -- JSON array of artist names
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  address TEXT,
  tags TEXT, -- JSON structured metadata
  photos TEXT, -- JSON array of photo URLs
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT -- Creator/artist name(s) (editable field)
);

CREATE TABLE artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT,
  website TEXT,
  tags TEXT, -- JSON structured metadata
  photos TEXT, -- JSON array of photo URLs
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Unified submissions system
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('logbook_entry','artwork_edit','artist_edit','new_artwork','new_artist')),
  user_token TEXT NOT NULL,
  email TEXT,
  submitter_name TEXT,
  artwork_id TEXT,
  artist_id TEXT,
  lat REAL,
  lon REAL,
  notes TEXT,
  photos TEXT, -- JSON array of photo URLs
  tags TEXT, -- JSON object of structured tags
  old_data TEXT, -- JSON object of original data (for edits)
  new_data TEXT, -- JSON object of proposed changes (for edits)
  verification_status TEXT CHECK (verification_status IN ('pending','verified','unverified')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_token TEXT,
  review_notes TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- User system tables
CREATE TABLE users (
  uuid TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT,
  email_verified_at TEXT,
  status TEXT CHECK (status IN ('active','suspended'))
);

-- Authentication tables
CREATE TABLE magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  user_uuid TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  ip_address TEXT,
  user_agent TEXT,
  is_signup BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE
);

CREATE TABLE rate_limiting (
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('email','ip')),
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now')),
  last_request_at TEXT NOT NULL DEFAULT (datetime('now')),
  blocked_until TEXT,
  PRIMARY KEY (identifier, identifier_type)
);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_uuid TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  device_info TEXT,
  FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE
);

-- Consent system
CREATE TABLE consent (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  user_id TEXT,
  anonymous_token TEXT,
  consent_version TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('artwork','logbook')),
  content_id TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  consent_text_hash TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(uuid) ON DELETE CASCADE
);

-- Audit and logging tables
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_token TEXT NOT NULL,
  moderator_token TEXT,
  action_data TEXT, -- JSON string
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_activity (
  id TEXT PRIMARY KEY,
  user_token TEXT NOT NULL,
  user_type TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata TEXT, -- JSON string
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_artwork_lat_lon ON artwork(lat, lon);
CREATE INDEX IF NOT EXISTS idx_artwork_status ON artwork(status);
CREATE INDEX IF NOT EXISTS idx_artwork_created_at ON artwork(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_status ON artists(status);

CREATE INDEX IF NOT EXISTS idx_submissions_user_token ON submissions(user_token);
CREATE INDEX IF NOT EXISTS idx_submissions_artwork_id ON submissions(artwork_id);
CREATE INDEX IF NOT EXISTS idx_submissions_artist_id ON submissions(artist_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_submissions_location ON submissions(lat, lon);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires_at ON magic_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_magic_links_used_at ON magic_links(used_at);
CREATE INDEX IF NOT EXISTS idx_magic_links_created_at ON magic_links(created_at);

CREATE INDEX IF NOT EXISTS idx_rate_limiting_identifier ON rate_limiting(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limiting_window_start ON rate_limiting(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limiting_blocked_until ON rate_limiting(blocked_until);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_uuid ON auth_sessions(user_uuid);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_last_accessed ON auth_sessions(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_consent_user_id ON consent(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_anonymous_token ON consent(anonymous_token);
CREATE INDEX IF NOT EXISTS idx_consent_content ON consent(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_consent_version ON consent(consent_version);
CREATE INDEX IF NOT EXISTS idx_consent_created_at ON consent(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_token ON audit_log(user_token);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_token ON user_activity(user_token);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);