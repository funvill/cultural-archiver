-- Complete database replacement - removes ALL existing tables
-- and creates optimized schema from scratch

-- Drop all existing tables
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS admin_actions;
DROP TABLE IF EXISTS data_dumps;
DROP TABLE IF EXISTS logbook;
DROP TABLE IF EXISTS artwork_edits;
DROP TABLE IF EXISTS artist_edits;
DROP TABLE IF EXISTS consent;
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS moderation_decisions;
DROP TABLE IF EXISTS user_permissions;
DROP TABLE IF EXISTS artwork;
DROP TABLE IF EXISTS artists;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS user_activity;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS user_roles;


-- Core content tables
CREATE TABLE artwork (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  artist_names TEXT, -- JSON array of artist names
  lat REAL,
  lon REAL,
  address TEXT,
  tags TEXT, -- JSON structured metadata
  photos TEXT, -- JSON array of photo URLs
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

-- Unified submissions table (replaces logbook, artwork_edits, artist_edits)
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  artwork_id TEXT,
  artist_id TEXT,
  user_token TEXT NOT NULL,
  submission_type TEXT NOT NULL CHECK (submission_type IN (
    'new_artwork', 'artwork_edit', 'artwork_photos', 'new_artist', 'artist_edit'
  )),
  field_changes TEXT, -- JSON: {"title": {"old": "...", "new": "..."}}
  photos TEXT, -- JSON array: ["url1", "url2"]
  note TEXT CHECK (length(note) <= 500),
  lat REAL CHECK (lat BETWEEN -90 AND 90),
  lon REAL CHECK (lon BETWEEN -180 AND 180),

  -- Integrated consent tracking
  consent_version TEXT NOT NULL,
  consent_text_hash TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,

  -- Moderation workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderator_notes TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,

  CHECK (
    (artwork_id IS NOT NULL AND artist_id IS NULL) OR
    (artwork_id IS NULL AND artist_id IS NOT NULL) OR
    (artwork_id IS NULL AND artist_id IS NULL AND submission_type IN ('new_artwork', 'new_artist'))
  )
);

-- Unified user activity tracking (replaces rate_limits, auth_sessions)
CREATE TABLE user_activity (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('email', 'ip', 'user_token')),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('rate_limit', 'auth_session', 'submission')),
  window_start TEXT,
  request_count INTEGER DEFAULT 0,
  session_data TEXT, -- JSON for session info
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  UNIQUE(identifier, activity_type, window_start)
);

-- Comprehensive audit log (replaces moderation_decisions, admin_actions)
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_token TEXT NOT NULL,
  user_role TEXT CHECK (user_role IN ('admin', 'moderator', 'user')),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'submission_approved', 'submission_rejected', 'submission_created',
    'user_permission_granted', 'user_permission_revoked',
    'artwork_created', 'artwork_updated', 'artwork_deleted',
    'artist_created', 'artist_updated', 'artist_deleted'
  )),
  target_type TEXT CHECK (target_type IN ('submission', 'artwork', 'artist', 'user')),
  target_id TEXT,
  reason TEXT,
  metadata TEXT, -- JSON for additional context
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (target_id) REFERENCES artwork(id) ON DELETE SET NULL,
  FOREIGN KEY (target_id) REFERENCES artists(id) ON DELETE SET NULL
);

-- Role-based permissions (replaces current user_permissions complexity)
CREATE TABLE user_roles (
  id TEXT PRIMARY KEY,
  user_token TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'user', 'banned')),
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  revoked_by TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  UNIQUE(user_token, role) WHERE is_active = 1
);

-- Performance indexes
CREATE INDEX idx_artwork_status_created ON artwork(status, created_at DESC);
CREATE INDEX idx_artwork_coordinates ON artwork(lat, lon) WHERE lat IS NOT NULL AND lon IS NOT NULL;
CREATE INDEX idx_artwork_tags_type ON artwork(json_extract(tags, '$.tags.artwork_type'));

CREATE INDEX idx_artists_status_created ON artists(status, created_at DESC);

CREATE INDEX idx_submissions_artwork_id ON submissions(artwork_id);
CREATE INDEX idx_submissions_artist_id ON submissions(artist_id);
CREATE INDEX idx_submissions_user_token ON submissions(user_token);
CREATE INDEX idx_submissions_moderation_queue ON submissions(status, submitted_at DESC);

CREATE INDEX idx_user_activity_identifier ON user_activity(identifier, activity_type);
CREATE INDEX idx_user_activity_expires ON user_activity(expires_at);

CREATE INDEX idx_audit_log_user_token ON audit_log(user_token);
CREATE INDEX idx_audit_log_action_type ON audit_log(action_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

CREATE INDEX idx_user_roles_user_token ON user_roles(user_token) WHERE is_active = 1;
CREATE INDEX idx_user_roles_role ON user_roles(role) WHERE is_active = 1;
