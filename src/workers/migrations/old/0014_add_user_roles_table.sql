-- Add user_roles table for role-based permissions
-- Date: 2025-01-14
-- Description: Creates user_roles table for managing user access levels

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_token ON user_roles(user_token) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role) WHERE is_active = 1;