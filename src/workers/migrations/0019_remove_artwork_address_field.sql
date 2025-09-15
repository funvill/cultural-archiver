-- Migration 0019: Remove artwork.address field
-- Phase 2 of Database Normalization
-- 
-- This migration removes the redundant address field from the artwork table.
-- Location information should be stored in the structured tags system instead
-- of having dedicated database columns for address data.
--
-- Benefits:
-- - Eliminates redundant data storage (address info duplicated in tags)
-- - Simplifies data model by using consistent tag system for all metadata
-- - Removes inconsistency between address field and location tags
-- - Makes location data more structured and queryable
--
-- Impact: The address field will be completely removed. Any address information
-- should be stored in the artwork tags using the existing location_details category.

-- Remove the address column from artwork table
ALTER TABLE artwork DROP COLUMN address;