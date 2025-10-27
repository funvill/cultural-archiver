-- Fix Clerk User ID Link for Admin Account
-- This script links the Clerk user_id to the correct admin account
-- and removes the duplicate account created during Clerk signup

-- Step 1: Delete the duplicate user account created during Clerk signup FIRST
-- This account has no submissions or activity other than system lists
-- Must delete this first to avoid UNIQUE constraint on clerk_user_id
DELETE FROM users 
WHERE uuid = 'a00a4857-1829-4c2d-8483-b1c8afbabf4a';

-- Step 2: Update the admin account (steven@abluestar.com) with Clerk user_id
UPDATE users 
SET clerk_user_id = 'user_34MfKoXVsLDz0usdiPsMS6JW9jT',
    profile_name = 'funvill'
WHERE uuid = '3db6be1e-0adb-44f5-862c-028987727018';

-- Step 3: Update user_roles to reference the correct UUID instead of Clerk ID
-- The user_roles table stores roles by Clerk ID, which is correct
-- No changes needed here as the system looks up users by clerk_user_id

-- Verification queries (run these to confirm the fix):
-- SELECT * FROM users WHERE clerk_user_id = 'user_34MfKoXVsLDz0usdiPsMS6JW9jT';
-- SELECT * FROM user_roles WHERE clerk_user_id = 'user_34MfKoXVsLDz0usdiPsMS6JW9jT';
