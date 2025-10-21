-- Migration 0037: Add clerk_user_id column to users table
-- Date: 2025-10-20
-- Description: Add clerk_user_id column to users table to link with Clerk authentication

PRAGMA foreign_keys=OFF;

-- Add clerk_user_id column to users table
ALTER TABLE users ADD COLUMN clerk_user_id TEXT NULL;

-- Create index for clerk_user_id lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);

-- Create unique constraint to prevent duplicate Clerk user IDs
CREATE UNIQUE INDEX IF NOT EXISTS unique_users_clerk_user_id ON users(clerk_user_id) WHERE clerk_user_id IS NOT NULL;

PRAGMA foreign_keys=ON;

-- Rollback notes: 
-- To rollback, drop the indexes and use CREATE TABLE AS SELECT to exclude the column:
-- DROP INDEX IF EXISTS idx_users_clerk_user_id;
-- DROP INDEX IF EXISTS unique_users_clerk_user_id;
-- Then recreate users table without clerk_user_id column