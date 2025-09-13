-- Add user_roles table alongside existing user_permissions
-- This is a simpler approach than the complete schema replacement in 0014

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

-- Migrate existing permissions to roles
-- Convert 'reviewer' to 'moderator' role
INSERT OR IGNORE INTO user_roles (id, user_token, role, granted_by, granted_at, is_active)
SELECT 
  'role-' || user_id || '-' || permission_type,
  user_id,
  CASE 
    WHEN permission_type = 'reviewer' THEN 'moderator'
    WHEN permission_type = 'admin' THEN 'admin'
    ELSE 'user'
  END,
  COALESCE(granted_by, 'migration'),
  granted_at,
  1
FROM user_permissions 
WHERE permission_type IN ('reviewer', 'admin');