-- Update User Permissions for steven@abluestar.com
-- Grant both moderator and admin permissions to user with UUID: 6c970b24-f64a-49d9-8c5f-8ae23cc2af47

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- First, let's check the current state of the user
SELECT 'Current user state:' as check_type;
SELECT uuid, email, created_at, email_verified_at, status 
FROM users 
WHERE uuid = '6c970b24-f64a-49d9-8c5f-8ae23cc2af47' OR email = 'steven@abluestar.com';

-- Check current permissions
SELECT 'Current permissions:' as check_type;
SELECT up.id, up.user_uuid, up.permission, up.granted_by, up.granted_at, up.is_active, up.notes
FROM user_permissions up
WHERE up.user_uuid = '6c970b24-f64a-49d9-8c5f-8ae23cc2af47' AND up.is_active = 1;

-- Create user if they don't exist (with verified email)
INSERT OR IGNORE INTO users (uuid, email, created_at, status, email_verified_at)
VALUES (
    '6c970b24-f64a-49d9-8c5f-8ae23cc2af47',
    'steven@abluestar.com',
    datetime('now'),
    'active',
    datetime('now')  -- Mark email as verified
);

-- Update email verification if user already exists
UPDATE users 
SET email_verified_at = datetime('now'),
    status = 'active'
WHERE uuid = '6c970b24-f64a-49d9-8c5f-8ae23cc2af47';

-- Grant moderator permission (check if not already exists)
INSERT OR IGNORE INTO user_permissions (id, user_uuid, permission, granted_by, granted_at, notes)
VALUES (
    lower(hex(randomblob(16))), -- Generate a random UUID-like string
    '6c970b24-f64a-49d9-8c5f-8ae23cc2af47',
    'moderator',
    'system',
    datetime('now'),
    'Granted moderator permissions via administrative script for steven@abluestar.com'
);

-- Grant admin permission (check if not already exists)
INSERT OR IGNORE INTO user_permissions (id, user_uuid, permission, granted_by, granted_at, notes)
VALUES (
    lower(hex(randomblob(16))), -- Generate a random UUID-like string
    '6c970b24-f64a-49d9-8c5f-8ae23cc2af47',
    'admin',
    'system',
    datetime('now'),
    'Granted admin permissions via administrative script for steven@abluestar.com'
);

-- Verify the updates
SELECT 'Updated user state:' as check_type;
SELECT uuid, email, created_at, email_verified_at, status 
FROM users 
WHERE uuid = '6c970b24-f64a-49d9-8c5f-8ae23cc2af47';

SELECT 'Updated permissions:' as check_type;
SELECT up.id, up.user_uuid, up.permission, up.granted_by, up.granted_at, up.is_active, up.notes
FROM user_permissions up
WHERE up.user_uuid = '6c970b24-f64a-49d9-8c5f-8ae23cc2af47' AND up.is_active = 1
ORDER BY up.permission;
