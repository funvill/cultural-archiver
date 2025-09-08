-- 0007_remove_internal_photo_tags.sql
-- Date: 2025-09-08
-- Purpose: Remove internal `_photos` keys from artwork.tags JSON blobs.
-- This cleans up legacy records where upload pipeline stored a _photos key
-- that is now treated as an internal-only metadata field and ignored by validation.
-- Idempotent: running multiple times has no adverse effect.

-- Strategy:
-- 1. For structured format {"tags":{...}, "version":..., "lastModified":...}
--    use json_remove on $.tags._photos if present.
-- 2. For legacy flat JSON objects with top-level _photos, remove via json_remove.
-- 3. If json_remove not applicable (invalid JSON), leave row unchanged.

-- Note: Cloudflare D1 supports JSON1 functions (json_valid, json_extract, json_remove).

BEGIN TRANSACTION;

-- Update structured tags objects
UPDATE artwork
SET tags = json_remove(tags, '$.tags._photos')
WHERE tags LIKE '%_photos%'
  AND json_valid(tags) = 1
  AND json_extract(tags, '$.tags._photos') IS NOT NULL;

-- Update legacy flat tag objects
UPDATE artwork
SET tags = json_remove(tags, '$._photos')
WHERE tags LIKE '%_photos%'
  AND json_valid(tags) = 1
  AND json_extract(tags, '$._photos') IS NOT NULL;

COMMIT;

-- Verification (non-fatal): count remaining occurrences (for manual review)
-- SELECT COUNT(*) AS remaining_internal_photos FROM artwork WHERE tags LIKE '%_photos%';
