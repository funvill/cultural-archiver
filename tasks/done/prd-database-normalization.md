# PRD: Database Normalization

**Date:** September 14, 2025  
**Status:** In Discussion  
**Priority:** Medium  

## Executive Summary

This PRD outlines a comprehensive database normalization effort to reduce complexity, eliminate redundant fields, and improve data integrity in the Cultural Archiver database. The normalization is structured into **3 independent phases** that can be implemented simultaneously or in any order.

### Phase Overview

**Phase 1: Remove `artwork.artist_names` Field** (22 tasks)
- **Goal:** Eliminate redundant artist names field in favor of normalized artist relationships
- **Impact:** Removes data duplication between `artwork.artist_names` and `artists` table
- **Effort:** ~20 hours (complex due to mass import system updates)

**Phase 2: Remove `artwork.address` Field** (16 tasks)  
- **Goal:** Remove redundant address field, rely on tag system for location metadata
- **Impact:** Simplifies location data storage using existing tag infrastructure
- **Effort:** ~12 hours (moderate complexity, well-defined scope)

**Phase 3: Normalize Artist Table** (19 tasks)
- **Goal:** Remove redundant website field and fix bio/description naming inconsistency  
- **Impact:** Eliminates SQL aliases and consolidates artist metadata in tag system
- **Effort:** ~14 hours (moderate complexity, clear migration path)

### Business Benefits

- **Data Integrity:** Eliminates duplicate storage and potential inconsistencies
- **Simplified Queries:** Removes need for complex JOIN vs field access decisions
- **Consistent Architecture:** All metadata handled through standardized tag system
- **Developer Experience:** Cleaner APIs, fewer edge cases, better type safety

### Risk Assessment

**Low Risk Implementation:**
- ✅ Prerelease status allows clean break approach with no backward compatibility needed
- ✅ Each phase is independent and can be implemented/tested separately
- ✅ Comprehensive test coverage ensures regression detection
- ✅ Database can be reset and recreated if issues arise

## Current Database Redundancy Issues

### 1. Artist Names Redundancy

**Problem:** The `artwork` table contains an `artist_names` field (JSON array) while also having a proper many-to-many relationship through the `artwork_artists` table linking to individual `artists` records.

**Current Structure:**

- `artwork.artist_names` - JSON array of artist names (TEXT field)
- `artists` table - Individual artist records with full profiles
- `artwork_artists` - Many-to-many linking table (artwork_id, artist_id, role)

**Analysis:**

- Data duplication: Artist names stored in both `artwork.artist_names` and `artists.name`
- Potential inconsistency: If an artist's name changes in the `artists` table, the `artwork.artist_names` field becomes stale
- Complexity: Two different ways to query for artist information

## Discussion Notes

### Question: Can we remove the `artwork.artist_names` field?

**Arguments for removal:**

1. **Data Normalization**: Artist information should be stored once in the `artists` table
2. **Referential Integrity**: Changes to artist names would automatically propagate
3. **Consistency**: Single source of truth for artist data
4. **Query Efficiency**: Join queries are standard SQL practice

**Migration Considerations:**

- Need to ensure all artwork has corresponding artist records before removal
- Update API endpoints that currently read from `artist_names`
- Modify frontend components that display artist information
- Update mass import system to create artist records

**Query Impact Analysis Needed:**

- Performance comparison: JOIN vs direct field access
- Review all current usage of `artist_names` field
- Identify API endpoints that would need updates

## Implementation Plan - Phased Approach

### Overview

This normalization will be implemented in **phases**, each focusing on a single database schema change. Each phase includes complete database migration, source code updates, and validation to ensure the system remains functional.

**Testing Requirements for Each Phase:**
- [ ] `npm run test` passes with 0 failures
- [ ] `npm run build` completes with 0 errors
- [ ] Manual verification of affected functionality

---

## Phase 1: Remove `artwork.artist_names` Field

**Goal:** Eliminate redundant artist names field in favor of normalized artist relationships

### Database Changes
- [ ] **1.1** Create database migration to remove `artist_names` column from `artwork` table
- [ ] **1.2** Create "Unknown Artist" record with `UNKNOWN_ARTIST_UUID`
- [ ] **1.3** Add `aliases` field to `artists` table for "also known as" functionality
- [ ] **1.4** Apply migration to development database

### Type Definition Updates
- [ ] **1.5** Remove `artist_names` field from `ArtworkRecord` interface
- [ ] **1.6** Remove `artist_names` field from `NewArtworkRecord` interface
- [ ] **1.7** Remove `artist_names` field from `ArtworkApiResponse` interface
- [ ] **1.8** Update any other types that reference artist_names

### API Endpoint Updates
- [ ] **1.9** Update discovery endpoints to use JOIN queries instead of artist_names
  - [ ] `src/workers/routes/discovery.ts` - Remove artist_names processing
  - [ ] `src/workers/routes/discovery-new.ts` - Remove artist_names processing
- [ ] **1.10** Update submissions endpoint to create artist relationships
  - [ ] `src/workers/routes/submissions-new.ts` - Remove artist_names field handling
- [ ] **1.11** Update mass import endpoints
  - [ ] `src/workers/routes/mass-import-v2.ts` - Remove artist_names from queries

### Mass Import System Updates
- [ ] **1.12** Implement fuzzy artist name matching algorithm
- [ ] **1.13** Update mass import to create or link to existing artist records
- [ ] **1.14** Handle "Unknown Artist" cases automatically
- [ ] **1.15** Support minimal artist record creation

### Frontend Updates
- [ ] **1.16** Update components to expect artist objects instead of name strings
- [ ] **1.17** Modify artwork display to show linked artist information
- [ ] **1.18** Update search functionality to query artist relationships

### Testing & Validation
- [ ] **1.19** Run `npm run test` and fix any failures
- [ ] **1.20** Run `npm run build` and fix any build errors
- [ ] **1.21** Verify artwork display shows correct artist information
- [ ] **1.22** Verify mass import creates proper artist relationships

---

## Phase 2: Remove `artwork.address` Field

**Goal:** Remove redundant address field, rely on tag system for location metadata

### Database Changes
- [ ] **2.1** Create database migration to remove `address` column from `artwork` table
- [ ] **2.2** Apply migration to development database

### Type Definition Updates
- [ ] **2.3** Remove `address` field from `NewArtworkRecord` interface
- [ ] **2.4** Remove `address` field from artwork-related request interfaces

### API Endpoint Updates
- [ ] **2.5** Remove address field handling from submissions endpoints
  - [ ] `src/workers/routes/submissions-new.ts` - Remove address field assignment
- [ ] **2.6** Remove address mapping in OSM export
  - [ ] `src/workers/routes/artwork-new.ts` - Remove address to 'addr:full' mapping
- [ ] **2.7** Update submission processing
  - [ ] `src/workers/lib/submissions.ts` - Remove address handling

### Mass Import System Updates
- [ ] **2.8** Update validation to not process address field
  - [ ] `src/lib/mass-import-system/lib/validation.ts` - Remove address processing
- [ ] **2.9** Modify vancouver importer to not build address strings
  - [ ] `src/lib/mass-import-system/importers/vancouver.ts` - Remove address building
- [ ] **2.10** Update mass import migration utilities
  - [ ] `src/workers/lib/mass-import-migration.ts` - Remove address mapping

### Test Updates
- [ ] **2.11** Remove address fields from test data
  - [ ] `src/workers/test/mass-import-v2-prd-criteria.test.ts`
  - [ ] `src/workers/test/mass-import-v2-integration.test.ts`
- [ ] **2.12** Update integration tests to not expect address field

### Testing & Validation
- [ ] **2.13** Run `npm run test` and fix any failures
- [ ] **2.14** Run `npm run build` and fix any build errors
- [ ] **2.15** Verify artwork submissions work without address field
- [ ] **2.16** Verify mass import processes location data correctly

---

## Phase 3: Normalize Artist Table (Remove `website`, Rename `bio` → `description`)

**Goal:** Remove redundant website field and fix bio/description naming inconsistency

### Database Changes
- [ ] **3.1** Create database migration to:
  - [ ] Remove `website` column from `artists` table
  - [ ] Rename `bio` column to `description` in `artists` table
- [ ] **3.2** Apply migration to development database

### SQL Query Updates
- [ ] **3.3** Remove `bio as description` aliases in all query files
  - [ ] `src/workers/routes/discovery-new.ts` - Update artist queries
  - [ ] `src/workers/routes/artists.ts` - Update artist queries
- [ ] **3.4** Update INSERT/UPDATE queries to use `description` field
- [ ] **3.5** Update mass import queries to use new field names
  - [ ] `src/workers/routes/mass-import-v2.ts` - Update artist processing

### Type Definition Updates
- [ ] **3.6** Remove `website` field from `NewArtistRecord` interface
- [ ] **3.7** Rename `biography` to `description` in `NewArtistRecord` interface
- [ ] **3.8** Update API response types to reflect schema changes

### Mass Import System Updates
- [ ] **3.9** Update mass import to use tags for website data
- [ ] **3.10** Modify artist processing to use description field
  - [ ] `src/workers/routes/mass-import.ts` - Update field references
- [ ] **3.11** Update artist creation logic to handle websites via tags

### Test Updates
- [ ] **3.12** Remove website fields from artist test data
  - [ ] `src/workers/test/mass-import-artist-core.test.ts`
  - [ ] `src/workers/routes/__tests__/artists.test.ts`
- [ ] **3.13** Update tests to use description instead of bio
- [ ] **3.14** Verify tag-based website functionality works correctly

### Testing & Validation
- [ ] **3.15** Run `npm run test` and fix any failures
- [ ] **3.16** Run `npm run build` and fix any build errors
- [ ] **3.17** Verify artist profiles display correctly
- [ ] **3.18** Verify website information appears in artist tags
- [ ] **3.19** Verify mass import handles artist data correctly

---

## Final Validation

### System-Wide Testing

- [ ] **3.20** Run complete test suite: `npm run test`
- [ ] **3.21** Run production build: `npm run build`
- [ ] **3.22** Test artwork discovery and display
- [ ] **3.23** Test artist profile pages
- [ ] **3.24** Test submission workflows
- [ ] **3.25** Test mass import functionality
- [ ] **3.26** Verify database schema matches TypeScript interfaces

### Documentation Updates

- [ ] **3.27** Update database schema documentation (`docs/database.md`)
- [ ] **3.28** Update API documentation if needed
- [ ] **3.29** Update mass import documentation

---

## Phase Dependencies

- **Phase 1** can be started immediately
- **Phase 2** can be started immediately (independent of Phase 1)
- **Phase 3** can be started immediately (independent of other phases)

All phases are **independent** and can be worked on simultaneously or in any order, but each phase should be **completed fully** before moving to the next to maintain system stability.

## Rollback Strategy

Since this is **prerelease** with **data loss acceptable**:
- Database can be reset and recreated if issues arise
- No backward compatibility or data migration required
- Clean break approach for all changes

## Additional Database Issues to Discuss

### 2. Address Field Redundancy

**Decision:** Drop `artwork.address` field entirely

**Problem:** The `artwork` table contains a dedicated `address` field, but addresses are location metadata that should be stored in the structured `tags` system.

**Current Structure:**

- `artwork.address` - TEXT field for street addresses
- `artwork.tags` - JSON object containing structured metadata
- Tag schema already has `location_details` category

**Analysis:**

- Inconsistent data storage: Some location data in dedicated fields, some in tags
- Tag system already supports location information (city, province, country)
- Address is metadata, not a core structural property like lat/lon coordinates

**Code References Found:**

**Database Schema:**
- `src/workers/migrations/0013_initialize_complete_schema.sql:13` - address TEXT column definition
- `src/workers/migrations/0016_enforce_uuid_constraints.sql:35` - address TEXT column definition

**API Usage:**
- `src/workers/routes/submissions-new.ts:391` - Sets address field in new artwork submissions
- `src/workers/routes/artwork-new.ts:472` - Maps address to OSM 'addr:full' tag
- `src/workers/lib/submissions.ts:461` - Uses address in submission processing
- `src/workers/lib/mass-import-new.ts:190` - Maps address during import
- `src/workers/lib/mass-import-migration.ts` - Multiple address mappings (lines 61, 168, 169, 247, 249)

**Type Definitions:**
- `src/shared/types.ts:100` - Optional address field in NewArtworkRecord interface

**Test Files:**
- `src/workers/test/mass-import-v2-prd-criteria.test.ts:282` - Test data with address
- `src/workers/test/mass-import-v2-integration.test.ts:46,89` - Integration tests with addresses

**Mass Import System:**
- `src/lib/mass-import-system/lib/validation.ts:245,412` - Address validation and processing
- `src/lib/mass-import-system/importers/vancouver.ts:398` - Address building function

**Implementation Requirements:**

**Database Changes:**
- [ ] Remove `address` column from `artwork` table in new migration
- [ ] Update any existing data (not needed - prerelease allows data loss)

**API Updates:**
- [ ] Remove address field from `NewArtworkSubmissionRequest` interface
- [ ] Update `submissions-new.ts` to not set address field
- [ ] Remove address mapping in `artwork-new.ts` OSM export
- [ ] Update `submissions.ts` to handle address removal

**Type Definition Updates:**
- [ ] Remove address field from `NewArtworkRecord` interface in `types.ts`

**Mass Import System Updates:**
- [ ] Update validation.ts to not process address field
- [ ] Modify vancouver importer to not build address strings
- [ ] Update mass-import-migration.ts to skip address mapping

**Test Updates:**
- [ ] Remove address fields from test data
- [ ] Update integration tests to not expect address field

### 3. Artist Table Normalization Issues

**Decision:** Remove `website` field and rename `bio` to `description`

#### Website Field Redundancy

**Problem:** The `artists` table contains a dedicated `website` field, but the tag system already supports website URLs with proper validation and OSM mapping.

**Current Structure:**

- `artists.website` - TEXT field for artist websites
- `artists.tags` - JSON object containing structured metadata
- Tag schema already has `website` tag with URL validation and OSM mapping

**Analysis:**

- Data duplication: Website can be stored in both dedicated field and tags
- Tag system provides better validation (URL type checking)
- Tag system provides OSM compatibility (`website` key)
- Inconsistent with artwork model which uses tags for all metadata

#### Bio to Description Field Rename

**Problem:** Database schema uses `bio` field but TypeScript interfaces use `description`, requiring SQL aliases (`bio as description`) to bridge the gap.

**Current Structure:**

- Database: `artists.bio` TEXT field
- TypeScript: `ArtistRecord.description` field  
- SQL queries: `SELECT bio as description` for compatibility
- API responses: Uses `description` field name

**Analysis:**

- Naming inconsistency between database and application layer
- SQL aliases add complexity and confusion
- API already uses `description` naming convention
- "Description" is more generic and consistent with artwork model

**Code References Found:**

**Database Schema:**
- `src/workers/migrations/0013_initialize_complete_schema.sql:25,26` - bio and website columns
- `src/workers/migrations/0016_enforce_uuid_constraints.sql:52,53` - bio and website columns

**SQL Queries with Aliases:**
- `src/workers/routes/discovery-new.ts:406,417` - `bio as description`
- `src/workers/routes/artists.ts:65,76,154` - `bio as description`

**Mass Import System:**
- `src/workers/routes/mass-import-v2.ts:544,603` - Uses bio field
- `src/workers/routes/mass-import.ts:278` - References biography field
- `src/workers/test/mass-import-artist-core.test.ts` - Mixed bio/description usage

**Type Definitions:**
- `src/shared/types.ts` - ArtistRecord uses description, NewArtistRecord has biography and website fields

**Tag System:**
- `src/shared/tag-schema.ts:290-301` - Website tag already defined with URL validation

**Implementation Requirements:**

**Database Changes:**
- [ ] Remove `website` column from `artists` table
- [ ] Rename `bio` column to `description` in `artists` table
- [ ] Update migration to handle schema changes

**SQL Query Updates:**
- [ ] Remove `bio as description` aliases in all query files
- [ ] Update INSERT/UPDATE queries to use `description` field
- [ ] Update mass import queries to use new field names

**Type Definition Updates:**
- [ ] Remove website field from `NewArtistRecord` interface
- [ ] Rename biography to description in `NewArtistRecord` interface
- [ ] Update API response types to reflect schema changes

**Mass Import System Updates:**
- [ ] Update mass import to use tags for website data
- [ ] Modify artist processing to use description field
- [ ] Update test data to remove website fields and use description

**Test Updates:**
- [ ] Remove website fields from artist test data
- [ ] Update tests to use description instead of bio
- [ ] Verify tag-based website functionality works correctly
