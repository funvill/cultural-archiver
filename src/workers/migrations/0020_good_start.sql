PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE artists (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  name TEXT NOT NULL,
  tags TEXT, 
  photos TEXT, 
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, aliases TEXT, description TEXT);
CREATE TABLE submissions (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  submission_type TEXT NOT NULL CHECK (submission_type IN ('logbook_entry','artwork_edit','artist_edit','new_artwork','new_artist')),
  user_token TEXT NOT NULL,
  email TEXT,
  submitter_name TEXT,
  artwork_id TEXT CHECK (artwork_id IS NULL OR (
    length(artwork_id) = 36 AND 
    artwork_id LIKE '________-____-____-____-____________' AND
    substr(artwork_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(artwork_id, 20, 1) IN ('8','9','a','b','A','B')
  )),
  artist_id TEXT CHECK (artist_id IS NULL OR (
    length(artist_id) = 36 AND 
    artist_id LIKE '________-____-____-____-____________' AND
    substr(artist_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(artist_id, 20, 1) IN ('8','9','a','b','A','B')
  )),
  lat REAL,
  lon REAL,
  notes TEXT,
  photos TEXT, 
  tags TEXT, 
  old_data TEXT, 
  new_data TEXT, 
  verification_status TEXT CHECK (verification_status IN ('pending','verified','unverified')), 
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_token TEXT,
  review_notes TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
CREATE TABLE users (
  uuid TEXT PRIMARY KEY CHECK (
    length(uuid) = 36 AND 
    uuid LIKE '________-____-____-____-____________' AND
    substr(uuid, 15, 1) IN ('1','2','3','4','5') AND
    substr(uuid, 20, 1) IN ('8','9','a','b','A','B')
  ),
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT,
  email_verified_at TEXT,
  status TEXT CHECK (status IN ('active','suspended'))
);
CREATE TABLE magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  user_uuid TEXT CHECK (user_uuid IS NULL OR (
    length(user_uuid) = 36 AND 
    user_uuid LIKE '________-____-____-____-____________' AND
    substr(user_uuid, 15, 1) IN ('1','2','3','4','5') AND
    substr(user_uuid, 20, 1) IN ('8','9','a','b','A','B')
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  ip_address TEXT,
  user_agent TEXT,
  is_signup BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE
);
CREATE TABLE rate_limiting (
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('email','ip')),
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now')),
  last_request_at TEXT NOT NULL DEFAULT (datetime('now')),
  blocked_until TEXT,
  PRIMARY KEY (identifier, identifier_type)
);
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  user_uuid TEXT NOT NULL CHECK (
    length(user_uuid) = 36 AND 
    user_uuid LIKE '________-____-____-____-____________' AND
    substr(user_uuid, 15, 1) IN ('1','2','3','4','5') AND
    substr(user_uuid, 20, 1) IN ('8','9','a','b','A','B')
  ),
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  device_info TEXT,
  FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE
);
CREATE TABLE consent (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  created_at TEXT NOT NULL,
  user_id TEXT CHECK (user_id IS NULL OR (
    length(user_id) = 36 AND 
    user_id LIKE '________-____-____-____-____________' AND
    substr(user_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(user_id, 20, 1) IN ('8','9','a','b','A','B')
  )),
  anonymous_token TEXT,
  consent_version TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('artwork','logbook')),
  content_id TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  consent_text_hash TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(uuid) ON DELETE CASCADE
);
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_token TEXT NOT NULL,
  moderator_token TEXT,
  action_data TEXT, 
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE user_activity (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  user_token TEXT NOT NULL,
  user_type TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata TEXT, 
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE user_roles (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
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
CREATE TABLE user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  permission TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  UNIQUE(user_token, permission, resource_type, resource_id)
);
CREATE TABLE artwork_artists (
  artwork_id TEXT NOT NULL CHECK (
    length(artwork_id) = 36 AND 
    artwork_id LIKE '________-____-____-____-____________' AND
    substr(artwork_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(artwork_id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  artist_id TEXT NOT NULL CHECK (
    length(artist_id) = 36 AND 
    artist_id LIKE '________-____-____-____-____________' AND
    substr(artist_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(artist_id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'collaborator', 'credited')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (artwork_id, artist_id),
  FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "artwork" (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  title TEXT,
  description TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  tags TEXT, 
  photos TEXT, 
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT 
);
DELETE FROM sqlite_sequence;