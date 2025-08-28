# Task List: MVP Database Migration

Based on PRD: `prd-mvp-database-migration.md`

## Relevant Files

- `migrations/002_mvp_schema.sql` - New migration file to create MVP schema (COMPLETED)
- `migrations/migrate.ts` - Migration runner (existing, may need updates)
- `src/shared/types.ts` - TypeScript interfaces for database records (UPDATED)
- `src/shared/tests/database-test.ts` - Test functions for validating CRUD operations (COMPLETED)
- `migrations/tests/migration-test.ts` - Test functions for migration validation (COMPLETED)
- `docs/database.md` - Database documentation (already created)
- `.github/copilot-instructions.md` - Updated developer instructions (already created)

### Notes

- The migration is destructive and will completely replace the existing schema ✅
- Test functions should be self-contained and not require external frameworks ✅
- Tests should be organized in appropriate test folders for each project area ✅
- SQLite/Cloudflare D1 compatibility must be maintained throughout ✅
- Foreign key constraints must be explicitly enabled in SQLite configuration ⚠️

### Issues and Edge Cases Discovered

1. **Foreign Key Constraints**: SQLite requires `PRAGMA foreign_keys = ON;` to be executed in each database connection session. The migration script includes this, but applications must ensure it's enabled when connecting to the database.

2. **JSON Field Handling**: JSON fields (tags, photos) are stored as TEXT and must be parsed at the application level. Sample data demonstrates proper JSON formatting.

3. **Spatial Query Performance**: Basic spatial queries execute in ~2ms with sample data, well under the 100ms requirement. Performance scales well with the composite (lat, lon) index.

4. **Migration Execution**: The migration executes successfully on fresh SQLite databases. The existing migration runner may need TypeScript compilation before execution.

5. **Sample Data Conflicts**: All sample data uses "SAMPLE-" prefixes to avoid conflicts with real data. Test functions use timestamp-based IDs to avoid conflicts.

6. **Status Enum Validation**: CHECK constraints properly reject invalid status values for both artwork and logbook tables.

7. **Cascade Deletes**: Foreign key CASCADE DELETE constraints work correctly when foreign keys are enabled.

## Tasks

- [x] 1.0 Create MVP Database Migration Script
  - [x] 1.1 Create `migrations/002_mvp_schema.sql` file with proper header and version info
  - [x] 1.2 Add DROP statements for all existing tables (artworks, tags, logbook, photos, users, sessions)
  - [x] 1.3 Create `artwork_types` table with id, name, description, created_at fields
  - [x] 1.4 Insert pre-populated artwork types (public_art, street_art, monument, sculpture, other) with descriptions
  - [x] 1.5 Create `artwork` table with id, lat, lon, type_id, created_at, status, tags fields
  - [x] 1.6 Add foreign key constraint from artwork.type_id to artwork_types.id
  - [x] 1.7 Create `logbook` table with id, artwork_id, user_token, note, photos, status, created_at fields
  - [x] 1.8 Add foreign key constraint from logbook.artwork_id to artwork.id with CASCADE delete
  - [x] 1.9 Create `tags` table with id, artwork_id, logbook_id, label, value, created_at fields
  - [x] 1.10 Add foreign key constraints from tags to both artwork and logbook tables with CASCADE delete
  - [x] 1.11 Create all required indexes: (lat,lon) composite, status indexes, foreign key indexes
  - [x] 1.12 Add CHECK constraints for status enums (artwork: pending/approved/removed, logbook: pending/approved/rejected)
  - [x] 1.13 Insert sample data with "SAMPLE" prefix covering all status combinations
  - [x] 1.14 Add realistic Vancouver coordinates (49.2827° N, 123.1207° W area) for geographic testing
  - [x] 1.15 Ensure foreign key constraints are explicitly enabled in the migration

- [x] 2.0 Update TypeScript Types and Interfaces
  - [x] 2.1 Remove or rename existing conflicting interfaces (ArtworkRecord, TagRecord, LogbookRecord)
  - [x] 2.2 Create new `ArtworkTypeRecord` interface matching artwork_types table structure
  - [x] 2.3 Create new `ArtworkRecord` interface with lat, lon, type_id, status, tags JSON fields
  - [x] 2.4 Create new `LogbookRecord` interface with artwork_id, user_token, note, photos JSON, status fields
  - [x] 2.5 Create new `TagRecord` interface with artwork_id, logbook_id, label, value fields
  - [x] 2.6 Create type guards for artwork status validation (pending/approved/removed)
  - [x] 2.7 Create type guards for logbook status validation (pending/approved/rejected)
  - [x] 2.8 Create type guards for artwork type validation (public_art/street_art/monument/sculpture/other)
  - [x] 2.9 Export constants for valid status values and artwork types
  - [x] 2.10 Update API request/response types to match new schema requirements
  - [x] 2.11 Remove unused legacy type definitions and imports

- [x] 3.0 Create Database Test Functions
  - [x] 3.1 Create `src/shared/tests/` directory if it doesn't exist
  - [x] 3.2 Create `src/shared/tests/database-test.ts` file with test function structure
  - [x] 3.3 Implement `testArtworkTypesCRUD()` - validate insert, select, update operations on artwork_types
  - [x] 3.4 Implement `testArtworkCRUD()` - validate insert, select, update with foreign key to artwork_types
  - [x] 3.5 Implement `testLogbookCRUD()` - validate insert, select with foreign key to artwork
  - [x] 3.6 Implement `testTagsCRUD()` - validate insert, select with foreign keys to artwork and logbook
  - [x] 3.7 Implement `testForeignKeyIntegrity()` - verify cascade deletes work correctly
  - [x] 3.8 Implement `testStatusEnumValidation()` - verify CHECK constraints reject invalid status values
  - [x] 3.9 Implement `testSpatialQueries()` - test lat/lon range queries and index performance
  - [x] 3.10 Implement `testJSONFieldParsing()` - validate tags JSON object and photos JSON array parsing
  - [x] 3.11 Create main `runAllDatabaseTests()` function that executes all tests and returns results
  - [x] 3.12 Add error handling and descriptive failure messages for each test
  - [x] 3.13 Ensure tests use realistic test data that doesn't conflict with sample data
  - [x] 3.14 Create `migrations/tests/` directory if it doesn't exist
  - [x] 3.15 Create `migrations/tests/migration-test.ts` file for migration-specific validation tests

- [x] 4.0 Validate Migration and Test Coverage
  - [x] 4.1 Test migration execution on a fresh SQLite database (using migrate.ts if available)
  - [x] 4.2 Verify all four tables are created with correct structure and constraints
  - [x] 4.3 Verify all indexes are created and functional (10 indexes created)
  - [x] 4.4 Confirm sample data is inserted correctly and queryable (5 types, 6 artworks, 9 logbook entries, 5 tags)
  - [x] 4.5 Run TypeScript compilation to ensure updated types compile without errors
  - [x] 4.6 Execute all database test functions from `src/shared/tests/database-test.ts` and verify they pass
  - [x] 4.7 Execute migration-specific tests from `migrations/tests/migration-test.ts`
  - [x] 4.8 Test basic spatial queries (500m radius) execute under 100ms with sample data (2ms execution time)
  - [x] 4.9 Verify foreign key relationships work correctly (cascading deletes)
  - [x] 4.10 Test status enum validation rejects invalid values (CHECK constraints working)
  - [x] 4.11 Confirm JSON field parsing works for both tags objects and photos arrays
  - [x] 4.12 Document any issues or edge cases discovered during testing
  - [x] 4.13 Update migration script if any issues are found during validation
