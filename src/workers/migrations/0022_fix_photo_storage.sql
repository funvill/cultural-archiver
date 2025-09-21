-- Migration 0022: Fix photo storage and aggregate logbook photos
-- Date: 2025-09-21
-- Issue: Photos were being stored in tags._photos instead of dedicated photos field
--         and approved logbook entries needed photo aggregation

-- Step 1: Update existing artworks to move photos from tags._photos to photos field
UPDATE artwork 
SET photos = (
  SELECT json_extract(tags, '$._photos')
  FROM artwork AS a2 
  WHERE a2.id = artwork.id 
  AND json_extract(tags, '$._photos') IS NOT NULL
),
tags = (
  SELECT json_remove(tags, '$._photos')
  FROM artwork AS a2 
  WHERE a2.id = artwork.id
  AND json_extract(tags, '$._photos') IS NOT NULL
)
WHERE json_extract(tags, '$._photos') IS NOT NULL;

-- Step 2: Move photos from approved logbook submissions to their associated artworks
-- where the artwork doesn't already have photos
UPDATE artwork 
SET photos = (
  SELECT s.photos
  FROM submissions s
  WHERE s.artwork_id = artwork.id 
    AND s.submission_type = 'logbook_entry'
    AND s.status = 'approved'
    AND s.photos IS NOT NULL
    AND s.photos != 'null'
    AND s.photos != '[]'
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE artwork.photos IS NULL
  AND EXISTS (
    SELECT 1 
    FROM submissions s
    WHERE s.artwork_id = artwork.id 
      AND s.submission_type = 'logbook_entry'
      AND s.status = 'approved'
      AND s.photos IS NOT NULL
      AND s.photos != 'null'
      AND s.photos != '[]'
  );