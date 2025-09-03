-- Simple schema fix that can be run directly via wrangler
-- Uses a different approach that doesn't rely on specific database configuration

-- Just create the essential tables with a simpler structure
CREATE TABLE IF NOT EXISTS logbook_temp (
    id TEXT PRIMARY KEY,
    artwork_id TEXT,
    user_token TEXT NOT NULL,
    lat REAL,
    lon REAL,
    note TEXT,
    photos TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy data from existing logbook if it exists
INSERT OR IGNORE INTO logbook_temp (id, artwork_id, user_token, note, photos, status, created_at)
SELECT id, artwork_id, user_token, note, photos, status, created_at FROM logbook;

-- Drop the old table and rename the new one
DROP TABLE IF EXISTS logbook;
ALTER TABLE logbook_temp RENAME TO logbook;
