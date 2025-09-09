-- Migration: Replace legacy 'reviewer' permission with 'moderator'
-- Date: 2025-09-08
-- Description:
--   If any rows in user_permissions still reference the deprecated
--   'reviewer' permission, convert them to 'moderator'. Then remove any
--   duplicate (user_uuid, permission) pairs that may result.
-- Rollback Strategy (manual):
--   To undo (not normally required), you could re-insert a 'reviewer'
--   row for affected users based on historical audit logs. No automatic
--   down migration is provided because the permission type is obsolete.

BEGIN TRANSACTION;

-- Upgrade any lingering 'reviewer' permissions to 'moderator'
UPDATE user_permissions
SET permission = 'moderator'
WHERE permission = 'reviewer';

-- Deduplicate in case a user already had 'moderator'
DELETE FROM user_permissions
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM user_permissions GROUP BY user_uuid, permission
);

COMMIT;

-- Verification (optional when running manually):
-- SELECT permission, COUNT(*) cnt FROM user_permissions GROUP BY permission;