-- Migration: Recreate all tables with proper UUID constraints
-- Date: 2025-09-14
-- Description: Drop all existing tables and recreate them with built-in UUID validation constraints
--              This is a development-only migration that will destroy all existing data

-- Drop all existing tables (order matters due to foreign key relationships)
DROP TABLE IF EXISTS artwork_artists;
DROP TABLE IF EXISTS consent;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS magic_links;
DROP TABLE IF EXISTS user_activity;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS user_permissions;
DROP TABLE IF EXISTS rate_limiting;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS artwork;
DROP TABLE IF EXISTS artists;
DROP TABLE IF EXISTS users;

-- Recreate all tables with proper UUID constraints built-in
-- Core content tables
CREATE TABLE artwork (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
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
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
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
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  submission_type TEXT NOT NULL CHECK (submission_type IN ('logbook_entry','artwork_edit','artist_edit','new_artwork','new_artist')),
  user_token TEXT NOT NULL,
  email TEXT,
  submitter_name TEXT,
  artwork_id TEXT CHECK (artwork_id IS NULL OR (
    length(artwork_id) = 36 AND 
    artwork_id LIKE '________-____-____-____-____________' AND
    substr(artwork_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(artwork_id, 20, 1) IN ('8','9','a','b','A','B')
  )),
  artist_id TEXT CHECK (artist_id IS NULL OR (
    length(artist_id) = 36 AND 
    artist_id LIKE '________-____-____-____-____________' AND
    substr(artist_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(artist_id, 20, 1) IN ('8','9','a','b','A','B')
  )),
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
  uuid TEXT PRIMARY KEY CHECK (
    length(uuid) = 36 AND 
    uuid LIKE '________-____-____-____-____________' AND
    substr(uuid, 15, 1) IN ('1','2','3','4','5') AND
    substr(uuid, 20, 1) IN ('8','9','a','b','A','B')
  ),
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
  user_uuid TEXT CHECK (user_uuid IS NULL OR (
    length(user_uuid) = 36 AND 
    user_uuid LIKE '________-____-____-____-____________' AND
    substr(user_uuid, 15, 1) IN ('1','2','3','4','5') AND
    substr(user_uuid, 20, 1) IN ('8','9','a','b','A','B')
  )),
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
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  user_uuid TEXT NOT NULL CHECK (
    length(user_uuid) = 36 AND 
    user_uuid LIKE '________-____-____-____-____________' AND
    substr(user_uuid, 15, 1) IN ('1','2','3','4','5') AND
    substr(user_uuid, 20, 1) IN ('8','9','a','b','A','B')
  ),
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
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  created_at TEXT NOT NULL,
  user_id TEXT CHECK (user_id IS NULL OR (
    length(user_id) = 36 AND 
    user_id LIKE '________-____-____-____-____________' AND
    substr(user_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(user_id, 20, 1) IN ('8','9','a','b','A','B')
  )),
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
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
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
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
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

-- User roles and permissions
CREATE TABLE user_roles (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  user_token TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'user', 'banned')),
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  revoked_by TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  UNIQUE(user_token, role)
);

CREATE TABLE user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  permission TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  UNIQUE(user_token, permission, resource_type, resource_id)
);

-- artwork_artists linking table (foreign keys)
CREATE TABLE artwork_artists (
  artwork_id TEXT NOT NULL CHECK (
    length(artwork_id) = 36 AND 
    artwork_id LIKE '________-____-____-____-____________' AND
    substr(artwork_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(artwork_id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  artist_id TEXT NOT NULL CHECK (
    length(artist_id) = 36 AND 
    artist_id LIKE '________-____-____-____-____________' AND
    substr(artist_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(artist_id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'collaborator', 'credited')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (artwork_id, artist_id),
  FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
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

CREATE INDEX IF NOT EXISTS idx_user_roles_user_token ON user_roles(user_token) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role) WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_token ON user_permissions(user_token) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission) WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_artwork_artists_artwork_id ON artwork_artists(artwork_id);
CREATE INDEX IF NOT EXISTS idx_artwork_artists_artist_id ON artwork_artists(artist_id);

-- Insert sample data with proper UUIDs for testing
INSERT OR IGNORE INTO users (uuid, email, status, created_at) VALUES 
('a0000000-1000-4000-8000-000000000001', 'steven@abluestar.com', 'active', datetime('now')),
('b0000000-1000-4000-8000-000000000010', 'sample.user@example.com', 'active', datetime('now'));

INSERT OR IGNORE INTO user_roles (id, user_token, role, granted_by, granted_at, is_active, notes) VALUES 
('f0000000-1000-4000-8000-000000000501', 'b0000000-1000-4000-8000-000000000010', 'user', 'a0000000-1000-4000-8000-000000000001', datetime('now'), 1, 'Sample user role for testing'),
('f0000000-1000-4000-8000-000000000502', 'a0000000-1000-4000-8000-000000000001', 'admin', 'a0000000-1000-4000-8000-000000000001', datetime('now'), 1, 'System admin role');

INSERT OR IGNORE INTO artists (id, name, bio, status, created_at) VALUES 
('d0000000-1000-4000-8000-000000000201', 'Sample Artist 1', 'A sample artist for testing purposes', 'approved', datetime('now')),
('d0000000-1000-4000-8000-000000000202', 'Sample Artist 2', 'Another sample artist for testing', 'approved', datetime('now')),
('d0000000-1000-4000-8000-000000000203', 'Sample Artist 3', 'Third sample artist for testing', 'pending', datetime('now'));

INSERT OR IGNORE INTO artwork (id, title, description, lat, lon, status, created_at, created_by) VALUES 
('c0000000-1000-4000-8000-000000000101', 'Sample Artwork 1', 'A sample artwork for testing purposes', 49.2827, -123.1207, 'approved', datetime('now'), 'Sample Artist 1'),
('c0000000-1000-4000-8000-000000000102', 'Sample Artwork 2', 'Another sample artwork for testing', 49.2841, -123.1067, 'approved', datetime('now'), 'Sample Artist 2'),
('c0000000-1000-4000-8000-000000000103', 'Sample Artwork 3', 'Third sample artwork for testing', 49.2605, -123.2460, 'pending', datetime('now'), 'Sample Artist 3');

INSERT OR IGNORE INTO artwork_artists (artwork_id, artist_id, role, created_at) VALUES 
('c0000000-1000-4000-8000-000000000101', 'd0000000-1000-4000-8000-000000000201', 'primary', datetime('now')),
('c0000000-1000-4000-8000-000000000102', 'd0000000-1000-4000-8000-000000000202', 'primary', datetime('now')),
('c0000000-1000-4000-8000-000000000103', 'd0000000-1000-4000-8000-000000000203', 'primary', datetime('now'));

INSERT OR IGNORE INTO submissions (id, submission_type, user_token, artwork_id, status, created_at, notes) VALUES 
('e0000000-1000-4000-8000-000000000301', 'logbook_entry', 'b0000000-1000-4000-8000-000000000010', 'c0000000-1000-4000-8000-000000000101', 'approved', datetime('now'), 'Sample submission 1'),
('e0000000-1000-4000-8000-000000000302', 'artwork_edit', 'b0000000-1000-4000-8000-000000000010', 'c0000000-1000-4000-8000-000000000102', 'pending', datetime('now'), 'Sample submission 2'),
('e0000000-1000-4000-8000-000000000303', 'new_artwork', 'b0000000-1000-4000-8000-000000000010', NULL, 'pending', datetime('now'), 'Sample submission 3');
