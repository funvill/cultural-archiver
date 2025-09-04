# Tasks: Database Schema Consolidation

## Relevant Files

- `migrations/tools/extract-schema.ts` - Script to extract current production database schema from Cloudflare D1
- `migrations/tools/extract-schema.test.ts` - Unit tests for schema extraction script
- `migrations/tools/recreate-database.ts` - Script to recreate database with consolidated schema and sample data
- `migrations/tools/recreate-database.test.ts` - Unit tests for database recreation script
- `migrations/001_consolidated_baseline.sql` - New consolidated baseline schema file (replaces all existing migrations)
- `migrations/tools/sample-data.sql` - Sample data definitions for development/testing environments
- `migrations/archive/001_initial_schema.sql` - Archived migration file (moved from root)
- `migrations/archive/002_mvp_schema.sql` - Archived migration file (moved from root)
- `migrations/archive/003_consent_audit_schema.sql` - Archived migration file (moved from root)
- `migrations/archive/004_add_logbook_location.sql` - Archived migration file (moved from root)
- `migrations/archive/005_authentication_tables.sql` - Archived migration file (moved from root)
- `migrations/archive/006_add_creators_table.sql` - Archived migration file (moved from root)
- `migrations/archive/007_permissions_audit_tables.sql` - Archived migration file (moved from root)
- `migrations/archive/008_fix_artwork_coordinates.sql` - Archived migration file (moved from root)
- `migrations/README.md` - Updated documentation with consolidation workflow
- `package.json` - Updated npm scripts for new database management commands

### Notes

- Unit tests should be placed alongside the tool files in `migrations/tools/` directory
- Use `npm run test:migrations` to run migration-related tests
- Scripts will leverage existing Cloudflare D1 API and wrangler CLI patterns
- All tools will use existing environment variables (D1_DATABASE_ID, CLOUDFLARE_API_TOKEN)

## Tasks

- [ ] 1.0 Create Database Schema Extraction Tool
  - [ ] 1.1 Create `migrations/tools/` directory structure
  - [ ] 1.2 Implement schema extraction script using Cloudflare D1 API to query table structures
  - [ ] 1.3 Add functionality to extract CREATE TABLE statements with all constraints and indexes
  - [ ] 1.4 Implement timestamp-based versioning for extracted schema files
  - [ ] 1.5 Add validation to ensure extracted schema excludes data content (schema only)
  - [ ] 1.6 Create comprehensive unit tests for schema extraction functionality
  - [ ] 1.7 Add error handling for network failures and invalid database connections
  - [ ] 1.8 Implement environment detection (local/staging/production) with safety checks
- [ ] 2.0 Create Database Recreation Tool
  - [ ] 2.1 Implement database recreation script with explicit confirmation prompts
  - [ ] 2.2 Add functionality to drop all existing tables with safety validation
  - [ ] 2.3 Implement schema application from consolidated baseline file
  - [ ] 2.4 Create sample data insertion with referential integrity validation
  - [ ] 2.5 Add post-recreation verification to ensure schema integrity
  - [ ] 2.6 Implement comprehensive error handling and rollback capabilities
  - [ ] 2.7 Create unit tests for database recreation functionality
  - [ ] 2.8 Add progress indicators and detailed logging for long-running operations
- [ ] 3.0 Generate Consolidated Baseline Schema
  - [ ] 3.1 Run schema extraction tool against current production database
  - [ ] 3.2 Create clean, formatted SQL file with all current table structures
  - [ ] 3.3 Validate extracted schema against existing migration results
  - [ ] 3.4 Create `migrations/001_consolidated_baseline.sql` as new baseline
  - [ ] 3.5 Ensure baseline includes all indexes, constraints, and triggers
  - [ ] 3.6 Add schema version comments and metadata to baseline file
- [ ] 4.0 Create Sample Data Management System
  - [ ] 4.1 Design sample data structure with predefined user tokens (UUID format)
  - [ ] 4.2 Create sample artwork records with coordinates near Vancouver (within 100m of 49.2679864,-123.0239578)
  - [ ] 4.3 Generate sample logbook entries linked to artworks with proper foreign key relationships
  - [ ] 4.4 Create sample moderation records in various states assigned to specified users
  - [ ] 4.5 Implement sample authentication data for three specified users
  - [ ] 4.6 Add clear test data markers and consistent timestamps (default: January 1, 2025)
  - [ ] 4.7 Create validation script to verify sample data integrity and relationships
  - [ ] 4.8 Implement sample data insertion as part of database recreation process
- [ ] 5.0 Archive Historical Migrations
  - [ ] 5.1 Create `migrations/archive/` directory structure
  - [ ] 5.2 Move existing migration files 001-008 to archive directory
  - [ ] 5.3 Update file references and documentation to reflect archived location
  - [ ] 5.4 Create archive README explaining migration history and consolidation rationale
  - [ ] 5.5 Verify no active references to archived migration files in codebase
- [ ] 6.0 Update Migration Infrastructure
  - [ ] 6.1 Update migration numbering system to restart from 001 (baseline schema)
  - [ ] 6.2 Modify `migrate.ts` to recognize new baseline schema as starting point
  - [ ] 6.3 Ensure migration system continues to work for future migrations (009+)
  - [ ] 6.4 Add npm scripts for new database management commands (extract-schema, recreate-db)
  - [ ] 6.5 Update TypeScript configuration to include tools directory
  - [ ] 6.6 Create test scripts for migration tools in package.json
- [ ] 7.0 Update Documentation and Scripts
  - [ ] 7.1 Update `migrations/README.md` with consolidation workflow instructions
  - [ ] 7.2 Document new database setup process for developers (simplified 2-minute setup)
  - [ ] 7.3 Add troubleshooting section for schema extraction and recreation tools
  - [ ] 7.4 Update development setup guide with new database initialization process
  - [ ] 7.5 Create team onboarding documentation reflecting simplified setup
  - [ ] 7.6 Document sample data specifications and usage guidelines
  - [ ] 7.7 Add validation commands and verification steps to documentation
