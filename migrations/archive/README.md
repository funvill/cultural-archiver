# Archived Migration Files

This directory contains the original 8 migration files that were consolidated into `001_consolidated_baseline.sql` on 2025-01-01.

## Migration History

The Cultural Archiver project underwent rapid iteration during initial development, resulting in 8 sequential migration files. These migrations have been consolidated to simplify database setup for new environments.

### Original Migration Files (Archived)

1. **001_initial_schema.sql** (2024-11-06)
   - Initial database schema with artworks, tags, logbook, photos, and users tables
   - Basic authentication session management
   - Automatic timestamp triggers

2. **002_mvp_schema.sql** (2024-12-27)
   - Complete schema replacement for crowdsourced public art mapping
   - Added artwork_types, spatial indexing, anonymous user tokens
   - Destructive migration that dropped and recreated all tables

3. **003_consent_audit_schema.sql** (2024-12-30)
   - Added consent_records table for legal compliance
   - Enhanced photo_metadata table with EXIF processing
   - Added comprehensive indexing for performance

4. **004_add_logbook_location.sql** (2024-12-30)
   - Added lat/lon coordinates to logbook table
   - Spatial indexing for logbook location queries

5. **005_authentication_tables.sql** (2025-01-03)
   - UUID-based anonymous users with magic link authentication
   - Users, magic_links, rate_limiting, and auth_sessions tables
   - Comprehensive security and session management

6. **006_add_creators_table.sql** (2024-12-31)
   - Creators table and artwork_creators junction table
   - Many-to-many relationship between artworks and creators
   - Support for role specification (artist, designer, architect, etc.)

7. **007_permissions_audit_tables.sql** (2025-01-03)
   - User permissions and comprehensive audit logging
   - Database-backed role management system
   - Admin action tracking and moderation decisions

8. **008_fix_artwork_coordinates.sql** (2025-01-04)
   - Bug fix for artwork coordinates that were set to Vancouver defaults
   - Updated artwork coordinates from logbook data where applicable

## Consolidation Rationale

### Problems Addressed

- **Complex Setup**: New developers had to run 8+ migration files to set up a database
- **Migration Chain Fragility**: Long migration chains are prone to failures
- **Schema Understanding**: Multiple files made it difficult to understand current state
- **Development Workflow**: Time-consuming database resets during development

### Solution Benefits

- **Single Baseline**: All current schema in one consolidated file
- **Faster Setup**: Database setup reduced from 10+ minutes to under 2 minutes
- **Clear State**: Current schema is immediately visible and understandable
- **Simplified Maintenance**: Future migrations build on a clean foundation

## Sample Data

The consolidated schema includes sample data generation with:

- **Three predefined users** (as specified in requirements)
- **Sample artworks** near Vancouver coordinates (within 100m of 49.2679864,-123.0239578)
- **Sample logbook entries** with proper foreign key relationships
- **Sample moderation records** assigned to specified administrators
- **Consistent timestamps** defaulting to January 1, 2025

## Migration Infrastructure

The existing migration system (`migrate.ts`) continues to work normally:
- Future migrations will be numbered 002, 003, etc.
- The migration tracking system recognizes the new baseline
- All existing npm scripts continue to function

## Recovery Information

If you need to understand changes made in the original migrations:
1. All original migration files are preserved in this archive
2. The consolidated schema represents the final state after applying all 8 migrations
3. The consolidation was performed manually by analyzing each migration file
4. Sample data matches the patterns established in the original migrations

## Tool Information

The database consolidation was performed using custom tools:
- `migrations/tools/extract-schema.ts` - Schema extraction from Cloudflare D1
- `migrations/tools/recreate-database.ts` - Database recreation with sample data
- Manual analysis and consolidation of all migration files

For questions about this consolidation, refer to the Cultural Archiver documentation or the migration tools in the `tools/` directory.