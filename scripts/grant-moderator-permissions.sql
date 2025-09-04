-- Grant Moderator Permissions Script
-- Grants moderator permissions to steven@abluestar.com and moderator@funvill.com
-- Run this script against your D1 database

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Check if users exist and create them if needed
-- Note: We'll use UUIDs that can be claimed later when they log in

-- First user: steven@abluestar.com
INSERT OR IGNORE INTO users (uuid, email, created_at, status, email_verified_at)
VALUES (
    '550e8400-e29b-41d4-a716-446655440001', -- UUID for steven@abluestar.com
    'steven@abluestar.com',
    datetime('now'),
    'active',
    datetime('now')
);

-- Second user: moderator@funvill.com  
INSERT OR IGNORE INTO users (uuid, email, created_at, status, email_verified_at)
VALUES (
    '550e8400-e29b-41d4-a716-446655440002', -- UUID for moderator@funvill.com
    'moderator@funvill.com',
    datetime('now'),
    'active', 
    datetime('now')
);

-- Grant moderator permissions to steven@abluestar.com
INSERT OR IGNORE INTO user_permissions (id, user_uuid, permission, granted_by, granted_at, notes)
VALUES (
    '6ba7b810-9dad-11d1-80b4-00c04fd430c1', -- Permission ID for steven@abluestar.com
    '550e8400-e29b-41d4-a716-446655440001', -- UUID for steven@abluestar.com
    'moderator',
    'system', -- Granted by system
    datetime('now'),
    'Granted moderator permissions via management script for project administration'
);

-- Grant moderator permissions to moderator@funvill.com
INSERT OR IGNORE INTO user_permissions (id, user_uuid, permission, granted_by, granted_at, notes)
VALUES (
    '6ba7b810-9dad-11d1-80b4-00c04fd430c2', -- Permission ID for moderator@funvill.com
    '550e8400-e29b-41d4-a716-446655440002', -- UUID for moderator@funvill.com
    'moderator',
    'system', -- Granted by system
    datetime('now'),
    'Granted moderator permissions via management script for project moderation'
);

-- Verify the permissions were granted correctly
SELECT 
    u.email,
    u.uuid,
    up.permission,
    up.granted_at,
    up.granted_by,
    up.notes,
    up.is_active
FROM users u
JOIN user_permissions up ON u.uuid = up.user_uuid
WHERE u.email IN ('steven@abluestar.com', 'moderator@funvill.com')
AND up.is_active = 1
ORDER BY u.email;

-- Log this action in the admin_actions table for audit trail
INSERT INTO admin_actions (id, admin_uuid, action_type, target_uuid, permission_type, old_value, new_value, reason, metadata)
VALUES (
    lower(hex(randomblob(16))), -- Random ID
    'system', -- Admin performing action
    'grant_permission',
    '550e8400-e29b-41d4-a716-446655440001', -- steven@abluestar.com
    'moderator',
    'null',
    '{"permission":"moderator","granted_at":"' || datetime('now') || '"}',
    'Granted moderator permissions via management script',
    '{"script":"grant-moderator-permissions.sql","method":"direct_sql"}'
);

INSERT INTO admin_actions (id, admin_uuid, action_type, target_uuid, permission_type, old_value, new_value, reason, metadata)  
VALUES (
    lower(hex(randomblob(16))), -- Random ID
    'system', -- Admin performing action
    'grant_permission', 
    '550e8400-e29b-41d4-a716-446655440002', -- moderator@funvill.com
    'moderator',
    'null',
    '{"permission":"moderator","granted_at":"' || datetime('now') || '"}',
    'Granted moderator permissions via management script',
    '{"script":"grant-moderator-permissions.sql","method":"direct_sql"}'
);

-- Final summary
SELECT 
    'Summary' as result_type,
    COUNT(*) as users_with_moderator_permissions
FROM user_permissions 
WHERE permission = 'moderator' 
AND is_active = 1
AND user_uuid IN (
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002'
);
