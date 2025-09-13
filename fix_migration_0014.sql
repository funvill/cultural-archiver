-- Manual application of migration 0014
-- Drop all existing tables (except migrations)
DROP TABLE IF EXISTS artwork_artists;
DROP TABLE IF EXISTS artwork_types;
DROP TABLE IF EXISTS artist_edits;
DROP TABLE IF EXISTS user_permissions;
DROP TABLE IF EXISTS logbook;
DROP TABLE IF EXISTS consent;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS artwork;
DROP TABLE IF EXISTS artists;

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

-- User management tables
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  uuid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  display_name TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  permissions TEXT, -- JSON array of permissions
  consent_version TEXT,
  consent_agreed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE consent (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  anonymous_token TEXT,
  consent_text_hash TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  agreed_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT,
  user_agent TEXT,
  form_data TEXT, -- JSON object
  page_context TEXT, -- JSON object
  UNIQUE(user_id, consent_version),
  UNIQUE(anonymous_token, consent_version)
);

-- Sample data
INSERT INTO artwork (id, title, description, artist_names, lat, lon, address, tags, photos, status, created_at, updated_at) VALUES 
('SAMPLE-artwork-approved-1', 'Sample Artwork', 'A beautiful piece of street art', '["Unknown Artist"]', 49.2827, -123.1207, '123 Art Street, Vancouver, BC', '{"artwork_type": "mural", "medium": "paint", "year": "2023"}', '["sample-photo-1.jpg"]', 'approved', datetime('now'), datetime('now'));

INSERT INTO artists (id, name, bio, website, tags, photos, status, created_at, updated_at) VALUES 
('unknown-artist', 'Unknown Artist', 'Artist profile for unknown or anonymous artists', NULL, '{}', '[]', 'approved', datetime('now'), datetime('now'));

-- Indexes for performance
CREATE INDEX idx_artwork_status ON artwork(status);
CREATE INDEX idx_artwork_location ON artwork(lat, lon);
CREATE INDEX idx_artwork_created_at ON artwork(created_at);
CREATE INDEX idx_artwork_tags_type ON artwork(json_extract(tags, '$.artwork_type'));

CREATE INDEX idx_artists_status ON artists(status);
CREATE INDEX idx_artists_name ON artists(name);
CREATE INDEX idx_artists_created_at ON artists(created_at);

CREATE INDEX idx_users_uuid ON users(uuid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_anonymous ON users(is_anonymous);

CREATE INDEX idx_consent_user_id ON consent(user_id);
CREATE INDEX idx_consent_anonymous_token ON consent(anonymous_token);
CREATE INDEX idx_consent_version ON consent(consent_version);