# PRD: Cloudflare D1 Database Migration System Overhaul

## Introduction/Overview

The Cultural Archiver project currently uses a custom migration system that has proven problematic during development. system lacks migration state tracking, fails on Cloudflare D1 restrictions, has poor error handling, and attempts to re-run completed migrations causing `SQLITE_AUTH` errors. This PRD outlines a complete overhaul to use Cloudflare's native D1 migration system, providing proper state tracking, environment isolation, and robust error handling.

This migration system overhaul will establish a reliable foundation for ongoing feature development and database schema evolution while maintaining backward compatibility with existing data.

## Problems with Current System

### Critical Issues Identified

1. **No Migration State Tracking**: The current system tries to run ALL migrations every time, causing conflicts when migrations have already been applied
2. **D1 Compatibility Issues**: Migrations fail with `SQLITE_AUTH` errors due to unsupported SQLite features:
   - `PRAGMA foreign_keys = ON;` statements
   - `WITHOUT ROWID` table modifiers
   - Complex `CHECK` constraints using functions like `length()`
3. **Poor Error Handling**: Failed migrations don't provide actionable error messages or recovery paths
4. **Environment Confusion**: No clear separation between development and production database operations
5. **Manual Dependency on Wrangler**: Custom spawning of wrangler CLI processes is error-prone and inconsistent

### Current System Architecture Problems

- **Custom Migration Runner**: `migrations/migrate.ts` reinvents functionality that Wrangler already provides
- **No Rollback Capability**: Cannot undo problematic migrations
- **No Atomic Operations**: Migrations can partially fail, leaving database in inconsistent state
- **Inconsistent Naming**: Migration files use inconsistent numbering schemes

## Goals

1. **Implement Native D1 Migration System**: Replace custom migration runner with Wrangler's built-in migration capabilities
2. **Establish Migration State Tracking**: Ensure migrations run only once and track completion status
3. **Enable Environment Isolation**: Separate development, staging, and production migration workflows
4. **Provide Rollback Capabilities**: Support reverting problematic migrations
5. **Improve Developer Experience**: Simplify migration creation, testing, and deployment processes
6. **Ensure D1 Compatibility**: Establish clear guidelines for D1-compatible migration patterns
7. **Integrate Backup System**: Update the existing backup system to work seamlessly with the new migration architecture

## User Stories

### For Developers

1. **As a developer**, I want to create a new migration with `npm run migrate:create "add_feature_table"` so that I can add new database features systematically
2. **As a developer**, I want to apply pending migrations to my local development database with `npm run migrate:dev` so that my database stays in sync with the team
3. **As a developer**, I want to see which migrations have been applied with `npm run migrate:status` so that I can understand my database state
4. **As a developer**, I want D1-compatible migration templates so that I don't encounter `SQLITE_AUTH` errors during development

### For DevOps/Administrators

5. **As a system administrator**, I want to apply migrations to production with `npm run migrate:prod` so that I can deploy database changes safely
6. **As a system administrator**, I want to rollback the last migration with `npm run migrate:rollback` so that I can recover from problematic deployments
7. **As a system administrator**, I want migration status reports for all environments so that I can verify deployment consistency

### For Team Collaboration

8. **As a team lead**, I want standardized migration naming and numbering so that team members can work on database changes without conflicts
9. **As a team member**, I want clear migration guidelines documented so that I can create compatible migrations independently

### For Backup and Disaster Recovery

10. **As a system administrator**, I want the backup system to work with the new migration architecture so that I can create reliable disaster recovery snapshots
11. **As a system administrator**, I want `npm run backup:remote` to export the production database using Wrangler's native D1 export so that backups are consistent with the migration system
12. **As a developer**, I want `npm run backup` to work with my local D1 database so that I can create development backups for testing
13. **As a system administrator**, I want the backup system to include R2 photos alongside the database export so that I have complete system snapshots

## Functional Requirements

### 1. Migration System Architecture

1.1. **Replace Custom System**: Remove existing `migrations/migrate.ts` and related npm scripts
1.2. **Use Wrangler Native Commands**: Leverage `wrangler d1 migrations` commands for all operations
1.3. **Maintain Migration Directory**: Keep `migrations/` directory structure compatible with Wrangler requirements
1.4. **Sequential Numbering**: Enforce sequential 4-digit numbering: `0001_`, `0002_`, etc.

### 2. Environment Management

2.1. **Development Environment**: 
   - Local D1 database for development and testing
   - Automatic migration application during development setup
   - Fast reset capabilities for clean development environments

2.2. **Production Environment**:
   - Protected production database with confirmation prompts
   - Audit logging of all production migration activities  
   - Rollback capabilities for emergency recovery

2.3. **Environment Isolation**:
   - Separate migration state tracking per environment
   - Clear environment indicators in all commands
   - Prevention of accidental cross-environment operations

### 3. Migration State Tracking

3.1. **Applied Migration Tracking**: Wrangler automatically tracks which migrations have been applied to each environment
3.2. **Status Reporting**: Commands to show migration status across environments
3.3. **Consistency Validation**: Ability to verify all environments have consistent migration states
3.4. **Conflict Prevention**: Automatic prevention of re-running completed migrations

### 4. Migration Creation and Management

4.1. **Template Generation**: Command to create new migration files with proper naming and D1-compatible templates
4.2. **Migration Validation**: Pre-flight checks for D1 compatibility before applying migrations
4.3. **Atomic Operations**: Each migration runs in a transaction with automatic rollback on failure
4.4. **Documentation Integration**: Auto-generation of migration documentation and change logs

### 5. D1 Compatibility Guidelines

5.1. **Prohibited Patterns**: Clear documentation of unsupported SQLite features in D1
5.2. **Template Examples**: Pre-built migration templates for common operations (add table, add index, etc.)
5.3. **Validation Rules**: Automated checks to prevent common D1 compatibility issues
5.4. **Error Message Improvements**: Clear error messages with suggested fixes for D1 issues

### 6. Backup System Integration

6.1. **D1 Export Integration**: Update backup system to use Wrangler's native D1 export functionality instead of custom SQL dumping
6.2. **Environment-Aware Backups**: Support separate backup workflows for development and production environments
6.3. **Migration-Consistent Exports**: Ensure backup database exports are compatible with the new migration system structure
6.4. **R2 Photo Backup**: Maintain existing R2 photo backup functionality alongside the updated database export
6.5. **Backup Validation**: Add validation to ensure backup integrity and restorability with the new migration system

### 7. Documentation Updates

7.1. **Migration Documentation**: Completely rewrite `/docs/migrations.md` to reflect the new Wrangler-based migration system
7.2. **Development Guide Updates**: Update `/docs/development.md` to use new migration commands for local setup
7.3. **Deployment Guide Updates**: Update `/docs/deployment.md` to use new migration commands for production deployment
7.4. **Database Documentation**: Update `/docs/database.md` to reference new migration system and remove outdated custom migration references
7.5. **Troubleshooting Updates**: Update `/docs/troubleshooting.md` to replace old migration troubleshooting with new system guidance
7.6. **Backup Documentation**: Update `/docs/backup-data-dump.md` to reflect new Wrangler D1 export integration
7.7. **Production Deployment**: Update `/docs/production-deployment-fix.md` to use new migration commands

## Non-Goals (Out of Scope)

1. **Data Migration Tools**: This PRD focuses on schema migrations, not data transformation utilities
2. **Multi-Database Support**: Only Cloudflare D1 support is required
3. **GUI Migration Tools**: Command-line interface is sufficient
4. **Advanced Rollback Features**: Only single-step rollback required for MVP
5. **Migration Performance Optimization**: Focus on correctness over speed
6. **Migration Scheduling**: No automated migration scheduling required

## Technical Specifications

### Migration File Structure

```text
migrations/
├── 0001_initial_schema.sql         # Clean baseline schema
├── 0002_add_data_dumps.sql        # Existing migration (already applied)
├── 0003_add_artwork_edits.sql     # Existing migration (already applied)  
├── 0004_add_user_permissions.sql  # Future migrations
└── README.md                      # Migration documentation
```

### NPM Scripts (New)

```json
{
  "scripts": {
    "migrate:create": "cd src/workers && npx wrangler d1 migrations create cultural-archiver",
    "migrate:dev": "cd src/workers && npx wrangler d1 migrations apply cultural-archiver --env development",
    "migrate:prod": "cd src/workers && npx wrangler d1 migrations apply cultural-archiver --env production",
    "migrate:status": "cd src/workers && npx wrangler d1 migrations list cultural-archiver",
    "migrate:status:prod": "cd src/workers && npx wrangler d1 migrations list cultural-archiver --env production",
    "migrate:rollback": "cd src/workers && npx wrangler d1 migrations rollback cultural-archiver",
    "migrate:validate": "cd src/workers && npx wrangler d1 migrations validate cultural-archiver",
    "backup": "npx tsx scripts/backup.ts --wrangler-export",
    "backup:remote": "npx tsx scripts/backup.ts --wrangler-export --remote",
    "backup:photos": "npx tsx scripts/backup.ts --photos-only",
    "backup:dev": "npx tsx scripts/backup.ts --wrangler-export --env development",
    "backup:validate": "npx tsx scripts/backup.ts --validate-only"
  }
}
```

### D1-Compatible Migration Template

```sql
-- Migration: Add new feature table
-- Generated: YYYY-MM-DD HH:MM:SS
-- Environment: Compatible with Cloudflare D1

-- Add your migration here
CREATE TABLE example_table (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- Add indexes
CREATE INDEX idx_example_table_name ON example_table(name);
CREATE INDEX idx_example_table_status ON example_table(status);

-- Add sample data (optional)
INSERT INTO example_table (id, name) VALUES 
('sample-1', 'Sample Record 1'),
('sample-2', 'Sample Record 2');
```

### D1 Compatibility Rules

#### ✅ Supported Patterns
- Standard `CREATE TABLE` with basic constraints
- Simple `CHECK` constraints with `IN()` clauses  
- Standard indexes with `CREATE INDEX`
- Foreign key constraints
- Default values using SQLite functions like `datetime('now')`

#### ❌ Prohibited Patterns
- `PRAGMA` statements (not needed in D1)
- `WITHOUT ROWID` table modifiers  
- Complex `CHECK` constraints using functions like `length()`
- `AUTOINCREMENT` (use UUIDs instead)
- Temporary tables or views in migrations
- `ATTACH` or `DETACH` database operations

### Backup System Integration Specifications

#### Updated Backup Workflow

```bash
# Development backup (local D1 database)
npm run backup              # Uses wrangler d1 export + R2 download

# Production backup (remote D1 database)
npm run backup:remote       # Uses wrangler d1 export --remote + R2 download

# Photos-only backup (existing functionality)
npm run backup:photos       # Downloads R2 photos only

# Backup validation (ensures restoration compatibility)
npm run backup:validate     # Validates backup integrity with migration system
```

#### Backup System Changes Required

1. **Replace Custom SQL Export**: Switch from custom SQL dumping to `wrangler d1 export`
2. **Environment Detection**: Use wrangler.toml environment configuration for backup targets
3. **Migration Compatibility**: Ensure exported schema matches current migration state
4. **Validation Integration**: Add backup validation that tests restoration with migration system

#### Updated Backup File Structure

```text
backup-2025-09-04-143022.zip
├── database.sql              # Generated by wrangler d1 export
├── migration_state.json      # Current migration state info
├── photos/
│   ├── originals/           # R2 photos (unchanged)
│   └── thumbnails/          # R2 thumbnails (unchanged)  
├── metadata.json            # Backup metadata (enhanced)
└── README.md               # Restoration guide (updated)
```

## Documentation Impact Analysis

### Files Requiring Updates

The migration system overhaul will require updates to multiple documentation files that currently reference the old migration system or database setup procedures.

#### High Priority Updates (Critical Path)

1. **`/docs/migrations.md`** - Complete rewrite required
   - **Current State**: Documents Wrangler's built-in system but may have outdated commands
   - **Required Changes**: Update all commands to match new npm scripts, add D1 compatibility guidelines
   - **Impact**: Primary migration documentation for developers

2. **`/docs/development.md`** - Database setup section needs updates
   - **Current State**: References old migration files and manual D1 commands
   - **Required Changes**: Replace database setup steps with new npm migration commands
   - **Impact**: New developer onboarding will be broken without updates

3. **`/docs/deployment.md`** - Production deployment process updates
   - **Current State**: May reference old migration processes
   - **Required Changes**: Update production migration steps to use new npm scripts
   - **Impact**: Production deployments could fail without proper migration commands

#### Medium Priority Updates

4. **`/docs/database.md`** - Schema documentation updates
   - **Current State**: Contains comprehensive database schema information
   - **Required Changes**: Update references to migration system, add new migration state tracking
   - **Impact**: Developer reference documentation accuracy

5. **`/docs/troubleshooting.md`** - Migration troubleshooting updates  
   - **Current State**: Contains numerous `wrangler d1` commands and old migration references
   - **Required Changes**: Update troubleshooting steps to use new npm scripts, add D1 compatibility error solutions
   - **Impact**: Developer support and debugging capabilities

6. **`/docs/backup-data-dump.md`** - Backup system integration updates
   - **Current State**: Documents current backup system with custom SQL export
   - **Required Changes**: Update to reflect Wrangler D1 export integration
   - **Impact**: System administration and disaster recovery procedures

#### Low Priority Updates

7. **`/docs/production-deployment-fix.md`** - Production fix procedures
   - **Current State**: May reference old migration commands
   - **Required Changes**: Update any migration commands to use new npm scripts
   - **Impact**: Emergency production fixes

### Documentation Update Requirements

#### Content Standards
- **Consistency**: All documentation must use the new npm migration scripts instead of direct wrangler commands
- **Accuracy**: Remove references to old custom migration system (`migrate.ts`)  
- **Completeness**: Include D1 compatibility guidelines and troubleshooting
- **Clarity**: Provide clear examples for both development and production environments

#### Update Checklist
- [ ] Replace all `npx tsx migrations/migrate.ts` references with appropriate npm scripts
- [ ] Update all `wrangler d1` commands to use new npm script equivalents where appropriate
- [ ] Add D1 compatibility sections where database operations are discussed
- [ ] Include environment-specific instructions (development vs production)
- [ ] Update backup and restoration procedures to use new Wrangler export functionality
- [ ] Add troubleshooting sections for common D1 migration issues

## Implementation Plan

### Phase 1: System Migration (Week 1)

1. **Archive Current System**: Move existing migration files to `migrations/archive/`
2. **Create New Migration Structure**: Set up Wrangler-compatible migration files
3. **Update NPM Scripts**: Replace custom scripts with Wrangler commands
4. **Update Documentation**: Rewrite `/docs/migrations.md` and update all database-related documentation
5. **Update Backup System**: Modify backup scripts to use Wrangler's D1 export functionality
6. **Test Development Workflow**: Validate new system works in development

### Phase 2: Production Migration

1. **Production State Assessment**: Document current production database state
2. **Migration Reconciliation**: Create baseline migration matching current production
3. **Production Testing**: Validate migration system against production database
4. **Team Training**: Train team members on new migration workflow

### Phase 3: Enhancement and Documentation

1. **Validation Tools**: Create pre-flight compatibility checks
2. **Template Generation**: Build migration templates for common operations
3. **CI/CD Integration**: Add migration checks to deployment pipeline
4. **Performance Testing**: Validate migration performance at scale

## Success Metrics

1. **Migration Reliability**: 100% success rate for properly formatted migrations
2. **Developer Productivity**: Reduce migration-related development friction by 80%
3. **Error Reduction**: Eliminate `SQLITE_AUTH` and migration conflict errors
4. **Team Adoption**: All team members successfully using new migration system within 2
5. **Database Consistency**: All environments maintain consistent migration state

## Dependencies

1. **Wrangler CLI**: Version 4.33.2+ with D1 migration support
2. **Cloudflare D1**: Production database access and permissions
3. **Team Coordination**: All developers must migrate simultaneously to avoid conflicts
4. **Documentation**: Updated developer onboarding materials

## Open Questions

1. **Migration Numbering**: Should we restart from 0001 or continue from current sequence?
   - *Recommendation*: Restart from 0001 with consolidated baseline for clarity

2. **Rollback Strategy**: How many rollback steps should be supported?
   - *Recommendation*: Single-step rollback for MVP, expand later if needed

3. **CI/CD Integration**: Should migrations run automatically in CI/CD pipeline?
   - *Recommendation*: Add validation checks in CI, but require manual production deployment

## Conclusion

This migration system overhaul addresses critical reliability and usability issues with the current system while establishing a robust foundation for ongoing database evolution. By leveraging Cloudflare's native D1 migration capabilities, we eliminate custom code complexity while gaining professional-grade migration management features.

The new system will significantly improve developer productivity, reduce database-related errors, and provide the reliability needed for production database management as the Cultural Archiver platform scales.
