-- Cultural Archiver Database Schema
-- Initial schema for artwork, tags, and logbook management
-- Version: 001
-- Date: 2024-11-06

-- ================================
-- Artworks Table
-- ================================
CREATE TABLE IF NOT EXISTS artworks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    description TEXT,
    medium TEXT,
    dimensions TEXT,
    created_date TEXT, -- ISO 8601 date string
    acquisition_date TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601 datetime
    condition TEXT,
    location TEXT,
    value REAL, -- Monetary value
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'damaged', 'missing')),
    tags TEXT, -- JSON array of tag IDs
    photo_urls TEXT, -- JSON array of R2 URLs
    metadata TEXT, -- JSON object for flexible additional data
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for artworks table
CREATE INDEX IF NOT EXISTS idx_artworks_artist ON artworks(artist);
CREATE INDEX IF NOT EXISTS idx_artworks_status ON artworks(status);
CREATE INDEX IF NOT EXISTS idx_artworks_medium ON artworks(medium);
CREATE INDEX IF NOT EXISTS idx_artworks_location ON artworks(location);
CREATE INDEX IF NOT EXISTS idx_artworks_created_at ON artworks(created_at);
CREATE INDEX IF NOT EXISTS idx_artworks_updated_at ON artworks(updated_at);

-- ================================
-- Tags Table
-- ================================
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT, -- Hex color code for UI
    category TEXT, -- Group tags by category
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for tags table
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);

-- ================================
-- Logbook Table
-- ================================
CREATE TABLE IF NOT EXISTS logbook (
    id TEXT PRIMARY KEY,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('artwork_added', 'artwork_updated', 'event_logged', 'maintenance', 'note')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    related_artwork_id TEXT,
    metadata TEXT, -- JSON object for additional structured data
    photos TEXT, -- JSON array of R2 URLs for supporting photos
    timestamp TEXT NOT NULL DEFAULT (datetime('now')), -- When the event occurred
    created_at TEXT NOT NULL DEFAULT (datetime('now')), -- When the entry was recorded
    FOREIGN KEY (related_artwork_id) REFERENCES artworks(id) ON DELETE SET NULL
);

-- Indexes for logbook table
CREATE INDEX IF NOT EXISTS idx_logbook_entry_type ON logbook(entry_type);
CREATE INDEX IF NOT EXISTS idx_logbook_related_artwork_id ON logbook(related_artwork_id);
CREATE INDEX IF NOT EXISTS idx_logbook_timestamp ON logbook(timestamp);
CREATE INDEX IF NOT EXISTS idx_logbook_created_at ON logbook(created_at);

-- ================================
-- Photos Table (for better file management)
-- ================================
CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_url TEXT NOT NULL, -- R2 URL for original image
    thumbnail_url TEXT, -- R2 URL for thumbnail
    size INTEGER NOT NULL, -- File size in bytes
    mime_type TEXT NOT NULL,
    artwork_id TEXT,
    logbook_entry_id TEXT,
    metadata TEXT, -- JSON object for EXIF data, etc.
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (artwork_id) REFERENCES artworks(id) ON DELETE CASCADE,
    FOREIGN KEY (logbook_entry_id) REFERENCES logbook(id) ON DELETE CASCADE
);

-- Indexes for photos table
CREATE INDEX IF NOT EXISTS idx_photos_artwork_id ON photos(artwork_id);
CREATE INDEX IF NOT EXISTS idx_photos_logbook_entry_id ON photos(logbook_entry_id);
CREATE INDEX IF NOT EXISTS idx_photos_uploaded_at ON photos(uploaded_at);

-- ================================
-- Users Table (for future authentication)
-- ================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'curator', 'viewer')),
    password_hash TEXT, -- For future password authentication
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ================================
-- Sessions Table (for authentication)
-- ================================
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for sessions table
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ================================
-- Triggers for automatic updated_at timestamps
-- ================================

-- Trigger for artworks updated_at
CREATE TRIGGER IF NOT EXISTS trigger_artworks_updated_at
    AFTER UPDATE ON artworks
    FOR EACH ROW
BEGIN
    UPDATE artworks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger for tags updated_at
CREATE TRIGGER IF NOT EXISTS trigger_tags_updated_at
    AFTER UPDATE ON tags
    FOR EACH ROW
BEGIN
    UPDATE tags SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger for users updated_at
CREATE TRIGGER IF NOT EXISTS trigger_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ================================
-- Initial Data (optional)
-- ================================

-- Insert default admin user (password should be changed immediately)
INSERT OR IGNORE INTO users (id, email, name, role, password_hash)
VALUES (
    'admin-' || hex(randomblob(8)),
    'admin@cultural-archiver.local',
    'System Administrator',
    'admin',
    NULL -- Password will be set through authentication system
);

-- Insert default tags for common artwork categories
INSERT OR IGNORE INTO tags (id, name, description, category, color)
VALUES 
    ('tag-' || hex(randomblob(8)), 'Painting', 'Traditional painted artworks', 'Medium', '#FF6B6B'),
    ('tag-' || hex(randomblob(8)), 'Sculpture', 'Three-dimensional artworks', 'Medium', '#4ECDC4'),
    ('tag-' || hex(randomblob(8)), 'Photography', 'Photographic works', 'Medium', '#45B7D1'),
    ('tag-' || hex(randomblob(8)), 'Digital Art', 'Computer-generated artworks', 'Medium', '#96CEB4'),
    ('tag-' || hex(randomblob(8)), 'Mixed Media', 'Artworks using multiple mediums', 'Medium', '#FFEAA7'),
    ('tag-' || hex(randomblob(8)), 'Contemporary', 'Modern contemporary works', 'Period', '#DDA0DD'),
    ('tag-' || hex(randomblob(8)), 'Abstract', 'Abstract artistic style', 'Style', '#FFD93D'),
    ('tag-' || hex(randomblob(8)), 'Portrait', 'Portrait artworks', 'Subject', '#FF7675'),
    ('tag-' || hex(randomblob(8)), 'Landscape', 'Landscape artworks', 'Subject', '#00B894'),
    ('tag-' || hex(randomblob(8)), 'Still Life', 'Still life compositions', 'Subject', '#E17055');

-- Log the schema creation
INSERT INTO logbook (id, entry_type, title, description, timestamp)
VALUES (
    'log-' || hex(randomblob(8)),
    'maintenance',
    'Database Schema Initialized',
    'Created initial database schema with tables for artworks, tags, logbook, photos, users, and sessions. Includes indexes and triggers for optimal performance.',
    datetime('now')
);