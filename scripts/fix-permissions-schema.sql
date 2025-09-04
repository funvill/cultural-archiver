-- Add is_active column to user_permissions table for local development
-- This fixes the permission checking issue

-- Add the missing is_active column
ALTER TABLE user_permissions ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

-- Update existing records to be active
UPDATE user_permissions SET is_active = 1 WHERE is_active IS NULL OR is_active = 0;

-- Verify the fix
SELECT 'Updated permissions table schema:' as check_type;
SELECT COUNT(*) as total_permissions, 
       SUM(is_active) as active_permissions 
FROM user_permissions;

-- Show Steven's permissions
SELECT 'Steven permissions after fix:' as check_type;
SELECT user_uuid, permission, granted_by, granted_at, is_active
FROM user_permissions 
WHERE user_uuid = '6c970b24-f64a-49d9-8c5f-8ae23cc2af47';
