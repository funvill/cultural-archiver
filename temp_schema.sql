-- Simple table creation from migration 0014
-- Core content tables
CREATE TABLE IF NOT EXISTS artwork (
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

CREATE TABLE IF NOT EXISTS artists (
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
CREATE TABLE IF NOT EXISTS submissions (
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
CREATE TABLE IF NOT EXISTS user_activity (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('email', 'ip', 'user_token')),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('rate_limit', 'auth_session', 'submission')),
  window_start TEXT,
  request_count INTEGER DEFAULT 0,
  session_data TEXT, -- JSON for session info
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(identifier, identifier_type, activity_type, window_start)
);

-- User management (simplified)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User permissions (for backward compatibility)
CREATE TABLE IF NOT EXISTS user_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  permission_type TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  granted_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, permission_type)
);

-- Magic links for email verification
CREATE TABLE IF NOT EXISTS magic_links (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  action TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_artwork_coordinates ON artwork(lat, lon);
CREATE INDEX IF NOT EXISTS idx_artwork_status ON artwork(status);
CREATE INDEX IF NOT EXISTS idx_artwork_updated_at ON artwork(updated_at);
CREATE INDEX IF NOT EXISTS idx_artists_status ON artists(status);
CREATE INDEX IF NOT EXISTS idx_submissions_artwork_id ON submissions(artwork_id);
CREATE INDEX IF NOT EXISTS idx_submissions_artist_id ON submissions(artist_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_token ON submissions(user_token);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_user_activity_identifier ON user_activity(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);