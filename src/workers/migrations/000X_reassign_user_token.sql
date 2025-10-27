-- Migration: 000X_reassign_user_token.sql
-- Purpose: This migration is intentionally empty
-- Admin/moderator roles were already manually granted to user_34MfKoXVsLDz0usdiPsMS6JW9jT
-- Clerk user IDs are now supported via updated isValidUUID() function and removed UUID constraints
-- No data reassignment needed - keeping this file to track migration history

-- No operations needed
SELECT 1;

-- Rollback notes:
-- To roll back, reverse the token swaps or restore from a DB backup.
