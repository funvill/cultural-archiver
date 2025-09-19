-- 0021 removed - standardizing on reviewer_token and review_notes
-- This migration intentionally does nothing to avoid altering the schema.
-- Kept for numbering continuity.
PRAGMA defer_foreign_keys=TRUE;
BEGIN TRANSACTION;
-- no-op
COMMIT;
