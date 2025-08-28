# PRD: MVP Database Migration

## Introduction/Overview

This PRD outlines the migration from the current art collection management
database schema to a new MVP schema optimized for crowdsourced public art
mapping. The current schema is designed for traditional art collection
management, but the MVP requires a simpler, location-focused approach for public
art discovery and community submissions.

The migration will completely replace the existing database schema with four
core tables: `artwork`, `artwork_types`, `logbook`, and `tags`, designed to
support geospatial queries, community submissions, and moderation workflows.

## Goals

1. **Replace Legacy Schema**: Completely migrate from the current art collection
   schema to the MVP public art mapping schema
2. **Enable Spatial Queries**: Support efficient radius-based searches for
   artworks by geographic location
3. **Support Community Workflows**: Enable pending/approved/rejected status
   flows for community-submitted content
4. **Maintain Data Integrity**: Ensure proper relationships, constraints, and
   indexes for optimal performance at city scale (1,000-10,000 artworks)
5. **Provide Test Coverage**: Include comprehensive TypeScript test functions to
   validate the new schema

## User Stories

1. **As a developer**, I want to run a migration script that completely replaces
   the existing database schema so that the application can support the MVP
   functionality.

2. **As a backend developer**, I want spatial indexes on latitude/longitude so
   that I can efficiently query artworks within a radius of a given point.

3. **As a system administrator**, I want the migration to include sample data
   with clear labeling so that I can immediately test the new schema with
   realistic data.

4. **As a frontend developer**, I want updated TypeScript types that match the
   new schema so that I can build the MVP UI with proper type safety.

5. **As a QA engineer**, I want predefined test functions that validate CRUD
   operations so that I can verify the migration was successful.

## Functional Requirements

### 1. Schema Migration

1.1. The migration MUST drop all existing tables from the current schema 1.2.
The migration MUST create four new tables: `artwork`, `artwork_types`,
`logbook`, and `tags` 1.3. The migration MUST be implemented as a new file
`002_mvp_schema.sql` 1.4. The migration MUST target SQLite (Cloudflare D1)
compatibility

### 2. Artwork Types Table

2.1. The `artwork_types` table MUST include the following fields:

- `id` (TEXT PRIMARY KEY)
- `name` (TEXT NOT NULL UNIQUE) - Human-readable type name
- `description` (TEXT) - Optional description of the artwork type
- `created_at` (TEXT NOT NULL DEFAULT datetime('now'))

  2.2. The `artwork_types` table MUST be pre-populated with the following
  values:

- 'public_art' - "Public art installations and commissioned works"
- 'street_art' - "Street art, murals, and graffiti"
- 'monument' - "Monuments, memorials, and commemorative structures"
- 'sculpture' - "Sculptural works and installations"
- 'other' - "Other types of public artwork"

  2.3. The `artwork_types` table MUST have an index on `name` for lookup queries

### 3. Artwork Table

3.1. The `artwork` table MUST include the following fields:

- `id` (TEXT PRIMARY KEY)
- `lat` (REAL NOT NULL) - Latitude coordinate
- `lon` (REAL NOT NULL) - Longitude coordinate
- `type_id` (TEXT NOT NULL) - Foreign key reference to artwork_types.id
- `created_at` (TEXT NOT NULL DEFAULT datetime('now'))
- `status` (TEXT CHECK constraint with values: 'pending', 'approved', 'removed')
- `tags` (TEXT) - JSON object for key-value pairs like
  `{"material": "bronze", "style": "modern"}`

  3.2. The `artwork` table MUST have a foreign key constraint on `type_id`
  referencing `artwork_types.id` 3.3. The `artwork` table MUST have a composite
  index on `(lat, lon)` for spatial queries 3.4. The `artwork` table MUST have
  an index on `status` for filtering 3.5. The `artwork` table MUST have an index
  on `type_id` for type-based filtering 3.6. The `artwork` table MUST enforce
  NOT NULL constraints on `lat`, `lon`, `type_id`, `created_at`, and `status`

### 4. Logbook Table

4.1. The `logbook` table MUST include the following fields:

- `id` (TEXT PRIMARY KEY)
- `artwork_id` (TEXT) - Foreign key reference to artwork.id
- `user_token` (TEXT NOT NULL) - Anonymous UUID or authenticated user identifier
- `note` (TEXT) - Optional submission note, limited to 500 characters at
  application level
- `photos` (TEXT) - JSON array of R2 URLs like `["url1", "url2", "url3"]`
- `status` (TEXT CHECK constraint with values: 'pending', 'approved',
  'rejected')
- `created_at` (TEXT NOT NULL DEFAULT datetime('now'))

  4.2. The `logbook` table MUST have a foreign key constraint on `artwork_id`
  with CASCADE delete 4.3. The `logbook` table MUST have an index on
  `artwork_id` for relationship queries 4.4. The `logbook` table MUST have an
  index on `status` for moderation workflows 4.5. The `logbook` table MUST have
  an index on `user_token` for user-specific queries

### 5. Tags Table

5.1. The `tags` table MUST include the following fields:

- `id` (TEXT PRIMARY KEY)
- `artwork_id` (TEXT) - Foreign key reference to artwork.id
- `logbook_id` (TEXT) - Foreign key reference to logbook.id
- `label` (TEXT NOT NULL) - Tag category like "material", "style", "condition"
- `value` (TEXT NOT NULL) - Tag value like "bronze", "modern", "good"
- `created_at` (TEXT NOT NULL DEFAULT datetime('now'))

  5.2. The `tags` table MUST have foreign key constraints on both `artwork_id`
  and `logbook_id` with CASCADE delete 5.3. The `tags` table MUST have indexes
  on `artwork_id`, `logbook_id`, and `label` for efficient querying 5.4. The
  `tags` table MUST allow NULL values for either `artwork_id` OR `logbook_id`
  (not both)

### 6. Sample Data

6.1. The migration MUST include sample data covering all status combinations
6.2. Sample data MUST be clearly labeled with "SAMPLE" prefix in relevant text
fields 6.3. Sample data MUST include at least:

- All 5 artwork types in the `artwork_types` table
- 2 artworks with status 'pending', 'approved', and 'removed' each
- 3 logbook entries with status 'pending', 'approved', and 'rejected' each
- 5 tag entries demonstrating the key-value structure
- Realistic Vancouver-area coordinates for geographic testing

### 7. TypeScript Types Update

7.1. The `src/shared/types.ts` file MUST be updated to match the new schema 7.2.
New interfaces MUST be created for `ArtworkRecord`, `ArtworkTypeRecord`,
`LogbookRecord`, and `TagRecord` 7.3. Existing interfaces that conflict with the
new schema MUST be removed or renamed 7.4. Type guards MUST be created for the
new status enums and artwork types 7.5. Constants MUST be exported for valid
status values and artwork types

### 8. Test Functions

8.1. TypeScript test functions MUST be created to validate CRUD operations on
all four tables 8.2. Test functions MUST verify:

- Basic INSERT operations on all tables
- Foreign key relationship integrity (artwork types, artwork-logbook
  relationships)
- Status enum validation
- Spatial query functionality (inserting and querying by lat/lon)
- JSON field parsing for tags and photos arrays

  8.3. Test functions MUST be executable and return boolean success/failure
  results

### 9. Database Documentation

9.1. A comprehensive database documentation file MUST be created at
`/docs/database.md` 9.2. The documentation MUST include:

- Complete table schemas with field descriptions
- Relationship diagrams or descriptions
- Index explanations and performance considerations
- Sample queries for common operations
- Status workflow documentation

  9.3. The `.github/copilot-instructions.md` file MUST be updated to reference
  the database documentation 9.4. Copilot instructions MUST include guidance for
  developers working with the database schema

## Non-Goals (Out of Scope)

1. **Data Migration**: This migration does not attempt to preserve or convert
   existing data
2. **Authentication System**: User token validation logic is not included in the
   database schema
3. **Photo Storage**: R2 bucket setup and photo upload handling are separate
   concerns
4. **Advanced Spatial Features**: Complex geometric queries, PostGIS-style
   functions, or map projections
5. **Performance Tuning**: Query optimization beyond basic indexing
6. **Backup/Recovery**: Backup strategies for production deployments

## Technical Considerations

1. **SQLite Limitations**: The schema must work within SQLite/Cloudflare D1
   constraints (no advanced spatial types)
2. **JSON Handling**: JSON fields will be stored as TEXT and parsed at the
   application level
3. **Foreign Key Support**: Ensure foreign key constraints are enabled in SQLite
   configuration
4. **Index Strategy**: Composite (lat,lon) index should be sufficient for radius
   queries using haversine formula
5. **Migration Dependencies**: This migration replaces `001_initial_schema.sql`
   and should be run on a fresh database

## Success Metrics

1. **Migration Execution**: The `002_mvp_schema.sql` file executes without
   errors on a fresh SQLite database
2. **Schema Validation**: All tables, indexes, and constraints are created as
   specified
3. **Sample Data**: All sample records are inserted successfully and queryable
4. **Type Safety**: TypeScript compilation succeeds with the updated type
   definitions
5. **Test Coverage**: All test functions pass, demonstrating CRUD operations
   work correctly
6. **Performance**: Basic spatial queries (500m radius) execute in under 100ms
   with sample data
7. **Documentation**: Database documentation is complete and accessible, Copilot
   instructions are updated

## Open Questions

1. Should the migration include a script to export existing data to JSON before
   the destructive migration?
2. Do we need additional indexes for common query patterns beyond the specified
   ones?
3. Should the TypeScript types include validation functions or just type
   definitions?
4. Is there a specific format required for the test functions (Jest, custom,
   etc.)?

## Implementation Notes

- The migration should include minimal but clear comments explaining each
  table's purpose
- Foreign key constraints should be explicitly enabled where needed
- Sample data should use realistic Vancouver coordinates (approximately 49.2827°
  N, 123.1207° W)
- Test functions should be self-contained and not require external test
  frameworks
- Consider using UUIDs for sample IDs to avoid conflicts with real data
