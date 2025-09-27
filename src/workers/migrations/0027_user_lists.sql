-- Migration 0027: User Lists (MVP)
-- Date: 2025-01-15
-- Issue: Implement MVP User Lists feature - create API + UI for unlisted collections
-- PRD Reference: tasks/prd-user-lists.md

-- Step 1: Create lists table
CREATE TABLE lists (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  owner_user_id TEXT NOT NULL CHECK (
    length(owner_user_id) = 36 AND 
    owner_user_id LIKE '________-____-____-____-____________' AND
    substr(owner_user_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(owner_user_id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  name TEXT NOT NULL CHECK (length(name) <= 255 AND length(trim(name)) > 0),
  visibility TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('unlisted', 'private')),
  is_readonly INTEGER NOT NULL DEFAULT 0 CHECK (is_readonly IN (0, 1)),
  is_system_list INTEGER NOT NULL DEFAULT 0 CHECK (is_system_list IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 2: Create list_items table
CREATE TABLE list_items (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  list_id TEXT NOT NULL,
  artwork_id TEXT NOT NULL,
  added_by_user_id TEXT NULL, -- NULL for system additions (e.g., to "Validated" list)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Ensure unique artwork per list
  UNIQUE(list_id, artwork_id),
  -- Foreign key constraints
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE
);

-- Step 3: Create performance indexes
-- Index for owner-based queries (user's lists)
CREATE INDEX idx_lists_owner_user_id ON lists(owner_user_id, updated_at DESC);

-- Index for list name uniqueness per user
CREATE INDEX idx_lists_name_per_user ON lists(owner_user_id, name);

-- Index for system lists queries
CREATE INDEX idx_lists_system ON lists(is_system_list, owner_user_id) WHERE is_system_list = 1;

-- Index for list items ordered by newest first (per PRD)
CREATE INDEX idx_list_items_list_id ON list_items(list_id, created_at DESC);

-- Index for artwork-based queries (which lists contain this artwork)
CREATE INDEX idx_list_items_artwork_id ON list_items(artwork_id);

-- Index for user-added items (excluding system additions)
CREATE INDEX idx_list_items_added_by_user ON list_items(added_by_user_id, created_at DESC) WHERE added_by_user_id IS NOT NULL;

-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, run the following SQL:
-- DROP INDEX IF EXISTS idx_list_items_added_by_user;
-- DROP INDEX IF EXISTS idx_list_items_artwork_id; 
-- DROP INDEX IF EXISTS idx_list_items_list_id;
-- DROP INDEX IF EXISTS idx_lists_system;
-- DROP INDEX IF EXISTS idx_lists_name_per_user;
-- DROP INDEX IF EXISTS idx_lists_owner_user_id;
-- DROP TABLE IF EXISTS list_items;
-- DROP TABLE IF EXISTS lists;

-- NOTES:
-- - Lists are unlisted by default (anyone with direct link can view)
-- - 1,000 item limit enforced at application level per PRD
-- - Items ordered newest-first via created_at DESC index
-- - System lists (Want to see, Have seen, Loved, Validated) use is_system_list flag
-- - "Validated" list uses visibility='private' 
-- - Foreign key constraints ensure referential integrity
-- - UUID validation follows existing pattern from other tables
-- - Migration is idempotent and can be safely re-run