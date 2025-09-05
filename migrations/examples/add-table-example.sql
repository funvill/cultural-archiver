-- Migration: Add New Table Example
-- Created: [TIMESTAMP]
-- Author: [AUTHOR]
-- Description: Example showing how to add a new table with indexes
--
-- ================================
-- D1 COMPATIBILITY NOTES:
-- ================================
-- ✅ DO USE:
--   - Standard CREATE TABLE, INSERT, UPDATE, DELETE, DROP statements
--   - Standard SQLite data types: TEXT, INTEGER, REAL, BLOB
--   - Basic indexes: CREATE INDEX
--   - Foreign key constraints (declared but not enforced)
--   - CHECK constraints with simple conditions
--   - DEFAULT values with literals or functions like datetime('now')
--
-- ❌ DO NOT USE:
--   - PRAGMA statements (especially PRAGMA foreign_keys = ON)
--   - WITHOUT ROWID tables  
--   - AUTOINCREMENT keyword
--   - Complex CHECK constraints using functions like length()
--   - ATTACH/DETACH database commands
--   - Triggers, views, or stored procedures
--   - Custom collation sequences
--   - Full-text search extensions
--
-- ================================
-- MIGRATION CONTENT START
-- ================================

-- Create a new table for storing categories
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for better query performance
CREATE INDEX idx_categories_name ON categories(name);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);
CREATE INDEX idx_categories_is_active ON categories(is_active);
CREATE INDEX idx_categories_created_at ON categories(created_at);

-- Insert some default categories
INSERT INTO categories (id, name, description, color, sort_order) VALUES 
  ('cat-sculpture', 'Sculpture', 'Three-dimensional artworks and installations', '#8B5A2B', 1),
  ('cat-mural', 'Mural', 'Large-scale wall paintings and street art', '#FF6B35', 2),
  ('cat-installation', 'Installation', 'Site-specific artistic installations', '#4ECDC4', 3),
  ('cat-performance', 'Performance', 'Temporary performance art events', '#FFE66D', 4);

-- ================================
-- MIGRATION CONTENT END  
-- ================================