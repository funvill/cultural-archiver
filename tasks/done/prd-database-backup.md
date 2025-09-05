# PRD: Database Schema Consolidation

## Introduction/Overview

The Cultural Archiver project has undergone significant database changes during initial development, resulting in 8 migration files that reflect the rapid iteration phase. Now that the database schema has stabilized, we need to consolidate the current production schema into a clean baseline to simplify future migrations and development workflows.

This feature will create tools to extract the current production database schema and provide scripts to rebuild databases from scratch with this consolidated schema, eliminating the need to run through all historical migrations for new environments.

## Goals

1. **Simplify Database Setup**: Reduce complex migration chains to a single baseline schema
2. **Improve Development Workflow**: Enable quick database resets for development/production environments
3. **Maintain Schema Integrity**: Ensure extracted schema perfectly matches current production state
4. **Preserve Migration System**: Keep existing migration infrastructure for future schema changes
5. **Enable Clean Environments**: Provide ability to start with fresh databases containing sample data

## User Stories

- **As a developer**, I want to quickly set up a clean database environment so that I can start development without running through 8+ migration files
- **As a team lead**, I want to consolidate our migration history so that new team members can easily understand the current database structure
- **As a developer**, I want to reset my local database to a known good state so that I can test features with consistent data
- **As a DevOps engineer**, I want to extract the current production schema so that I can set up new environments that match production exactly

## Functional Requirements

1. **Schema Extraction Script** 1.1. The system must provide a script that connects to the production Cloudflare D1 database 1.2. The script must extract complete table structures including CREATE TABLE statements 1.3. The script must extract all indexes, constraints, and triggers 1.4. The script must save the extracted schema to a versioned SQL file 1.5. The script must exclude data content (schema only)

2. **Database Recreation Script** 2.1. The system must provide a script that drops all existing tables (with confirmation) 2.2. The script must apply the extracted schema to rebuild the database structure 2.3. The script must insert predefined sample data for all tables 2.4. The script must maintain referential integrity during sample data insertion 2.5. The script must verify the rebuilt database matches the extracted schema

3. **Migration System Integration** 3.1. The system must preserve the existing migration infrastructure (`migrate.ts`, npm scripts) 3.2. The system must continue migration numbering from 009+ for future changes 3.3. The system must delete existing migration files (001-008) 3.4. The system must document the consolidation process in migration README

4. **Sample Data Requirements** 4.1. The system must include sample artwork records with valid coordinates 4.2. The system must include sample user tokens and authentication data
   - UUID: `00000000-0000-0000-0000-000000000001`, Email: `sampledata@funvill.com`
   - UUID: `00000000-0000-0000-0000-000000000002`, Email: `massimport@funvill.com`
   - UUID: `6c970b24-f64a-49d9-8c5f-8ae23cc2af47`, Email: `steven@abluestar.com` 4.3. The system must include sample logbook entries linked to artwork 4.4. The system must include sample moderation records in various states 4.5. All sample data must be clearly marked as test data

5. **Safety and Validation** 5.1. The system must require explicit confirmation before dropping tables 5.2. The system must validate database connection before destructive operations 5.3. The system must verify schema integrity after recreation 5.4. The system must provide clear error messages for any failures

## Non-Goals (Out of Scope)

- **Data Migration**: This feature will not preserve existing data during recreation
- **Multi-Database Support**: This feature will only support Cloudflare D1 databases
- **Backup Management**: This feature will not handle production data backups
- **CI/CD Integration**: This feature will not include automated pipeline integration
- **Schema Versioning**: This feature will not track schema version history beyond the baseline

## Design Considerations

- **Script Location**: Create new scripts in `/migrations/tools/` directory
- **File Naming**: Use consistent naming pattern (`extract-schema.ts`, `recreate-database.ts`)
- **Configuration**: Leverage existing environment variables (D1_DATABASE_ID, CLOUDFLARE_API_TOKEN)
- **Integration**: Follow existing TypeScript patterns and error handling approaches
- **Documentation**: Update migration README with consolidation workflow

## Technical Considerations

- **Cloudflare D1 API**: Utilize Cloudflare REST API for schema extraction
- **TypeScript Environment**: Build scripts using existing TypeScript configuration
- **Error Handling**: Implement robust error handling matching current migration patterns
- **Dependencies**: Reuse existing dependencies (no new packages required)
- **Environment Detection**: Ensure scripts can differentiate between local/staging/production
- **SQL Generation**: Generate clean, formatted SQL that's human-readable

## Success Metrics

- **Setup Time Reduction**: New developer database setup time reduced from 10+ minutes to under 2 minutes
- **Migration Simplification**: Reduce initial migration count from 8 files to 1 baseline + future migrations
- **Developer Satisfaction**: Team feedback indicates improved development workflow
- **Error Reduction**: Eliminate migration-related setup errors for new environments

## Resolved Questions

1. **Schema File Naming**: ✅ **RESOLVED** - The extracted schema file should include a timestamp or version identifier for traceability
2. **Sample Data Volume**: ✅ **RESOLVED** - Include specific sample records:
   - **Users**: Three predefined users as specified in requirements
   - **Artworks**: All 3 existing artworks assigned to `massimport@funvill.com`
   - **Logbook**: All 9 existing logbook entries assigned to `massimport@funvill.com`
   - **Moderation**: All moderation records assigned to `steven@abluestar.com`
3. **Archive Strategy**: ✅ **RESOLVED** - Move old migration files to `migrations/archive/` directory
4. **Schema File Format**: ✅ **RESOLVED** - Single consolidated SQL file with all CREATE statements (no documentation comments)
5. **Script Execution Context**: ✅ **RESOLVED** - Scripts should support running against production databases (with appropriate safety checks)
6. **Migration History**: ✅ **RESOLVED** - Reset migration numbering to start from 001 (the baseline schema becomes migration 001)
7. **Validation Depth**: ✅ **RESOLVED** - Validation should verify table existence only (not field-by-field comparison)
8. **Environment Variables**: ✅ **RESOLVED** - No additional environment variables needed (use existing D1_DATABASE_ID, CLOUDFLARE_API_TOKEN)
9. **Sample Data Integrity**: ✅ **RESOLVED** - Sample data specifications:
   - **Foreign Keys**: Hardcoded relationships that make logical sense for sample data
   - **Coordinates**: All artwork locations within 100m of "49.2679864,-123.0239578" (Vancouver area)
   - **Timestamps**: Default all timestamps to January 1, 2025

## Open Questions

1. **Documentation Updates**: Which documentation files need updates:
   - Migration README with new workflow instructions?
   - Development setup guide with simplified database setup?
   - API documentation if sample data affects endpoints?
