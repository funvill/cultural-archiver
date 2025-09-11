-- Base Schema Migration - Create essential tables first
-- Generated: 2025-09-09T09:00:00Z
-- Purpose: Create base tables required for Cultural Archiver

-- ================================
-- Core Artwork Table
-- ================================
CREATE TABLE artwork (
  id TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  type_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tags TEXT DEFAULT '{}',
  title TEXT,
  description TEXT,
  created_by TEXT
);

-- ================================
-- Artwork Types
-- ================================
CREATE TABLE artwork_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

-- ================================
-- Logbook/Submissions Table
-- ================================
CREATE TABLE logbook (
  id TEXT PRIMARY KEY,
  artwork_id TEXT,
  user_token TEXT NOT NULL,
  lat REAL,
  lon REAL,
  note TEXT,
  photos TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

-- ================================
-- Users Table
-- ================================
CREATE TABLE users (
  uuid TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_login TEXT,
  email_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

-- ================================
-- User Permissions
-- ================================
CREATE TABLE user_permissions (
  id TEXT PRIMARY KEY,
  user_uuid TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);

-- ================================
-- Basic Indexes
-- ================================
CREATE INDEX idx_artwork_lat_lon ON artwork(lat, lon);
CREATE INDEX idx_artwork_status ON artwork(status);
CREATE INDEX idx_logbook_user_token ON logbook(user_token);
CREATE INDEX idx_logbook_status ON logbook(status);

-- ================================
-- Insert Default Data
-- ================================
INSERT INTO artwork_types VALUES 
('sculpture', 'Sculpture', 'Three-dimensional artwork', datetime('now')),
('mural', 'Mural', 'Wall-mounted painted artwork', datetime('now')),
('installation', 'Installation', 'Large-scale mixed-media artwork', datetime('now')),
('statue', 'Statue', 'Sculptural representation', datetime('now'));

INSERT INTO artwork VALUES 
('SAMPLE-artwork-approved-1', 49.2827, -123.1207, 'sculpture', datetime('now'), 'approved', '{"material": "bronze"}', 'Sample Sculpture', 'A bronze sculpture', 'Unknown Artist');