# PRD: Database Migration System (Simplified)

## Overview

Implement a focused database migration system for the Cultural Archiver project using Cloudflare D1's built-in migration capabilities through Wrangler CLI. This system will provide basic database export, migration, and import functionality through PowerShell-compatible npm scripts with minimal error handling to start.

## Goals

### 1. Database Export

- **Command**: `npm run database:export`
- **Function**: Export current production database to `_backup_database/database_YYYY-MMM-DD.sql`
- **Implementation**: Use `wrangler d1 export` command

### 2. Database Migration

- **Command**: `npm run database:migration`
- **Function**: Apply pending migrations to production database
- **Implementation**: Use `wrangler d1 migrations apply` command

### 3. Database Import

- **Command**: `npm run database:import <file.sql>`
- **Function**: Replace entire database with imported SQL file
- **Implementation**: Basic file validation only (exists, readable, non-empty)

## Technical Requirements

### Migration File Structure

```text
src/workers/migrations/
├── 0001_initial_schema.sql
├── 0002_add_user_system.sql
├── 0003_add_spatial_index.sql
├── 0004_add_photo_processing.sql
├── 0005_add_tag_system.sql
└── 0006_structured_tag_schema.sql
```

### Database Configuration

- **Primary Config**: `src/workers/wrangler.toml`
- **Environment Support**: Development and Production environments
- **Database Binding**: `DB` binding name
- **Database IDs**:
  - Development: `b64d04af-79d9-4573-8adb-97f0e3946962`
  - Production: Same ID (needs verification)

### Backup Directory Structure

```text
_backup_database/
├── database_2025-Sep-07.sql
├── database_2025-Sep-06.sql
└── database_2025-Sep-05.sql
```

## AI Agent Migration Guidelines

### Overview for AI Agents

When creating database migration files for the Cultural Archiver project, AI agents must follow these specific guidelines to ensure compatibility with Cloudflare D1 and maintain database integrity.

### Migration File Creation Process

#### Step 1: Use Wrangler to Create Migration File

```bash
# AI agents should first run this command to create the migration file
cd src/workers
npm run database:create-migration
```

This creates a new migration file with automatic numbering: `NNNN_migration_name.sql`

#### Step 2: Database Schema Reference

**Current Database Schema**: See `docs/database.md` for complete schema
**Key Tables**:
- `artwork` - Main artwork records with spatial data (lat, lon)
- `users` - User authentication system
- `magic_links` - Email verification tokens
- `submissions` - Artwork submission queue
- `photos` - Photo metadata and processing status

### Migration File Structure Requirements

#### File Header (Required)

```sql
-- Migration: NNNN_descriptive_name
-- Description: Brief description of what this migration does
-- Created: YYYY-MM-DD
-- Dependencies: List any previous migrations this depends on

-- Cloudflare D1 Compatible Migration
-- SQLite dialect only - NO PostgreSQL or MySQL specific syntax
```

#### SQLite Compatibility Rules (Critical)

**✅ ALLOWED - SQLite/D1 Compatible:**
```sql
-- Basic table creation
CREATE TABLE table_name (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Add columns
ALTER TABLE table_name ADD COLUMN new_column TEXT;

-- Create indexes
CREATE INDEX idx_table_field ON table_name(field);

-- Insert data
INSERT INTO table_name (name) VALUES ('value');
```

**❌ FORBIDDEN - Not supported in D1:**
```sql
-- NO foreign key constraints
ALTER TABLE table_name ADD CONSTRAINT fk_name FOREIGN KEY (field) REFERENCES other_table(id);

-- NO stored procedures or functions
CREATE FUNCTION my_function() RETURNS TEXT AS $$...$$;

-- NO triggers
CREATE TRIGGER trigger_name BEFORE INSERT ON table_name...;

-- NO advanced data types
CREATE TABLE table_name (uuid UUID, timestamp TIMESTAMP);

-- NO DROP COLUMN (limited support)
ALTER TABLE table_name DROP COLUMN column_name;  -- Use with caution
```

### Spatial Data Handling

**Geographic Coordinates**:
```sql
-- Store as REAL (float) columns
ALTER TABLE artwork ADD COLUMN lat REAL;
ALTER TABLE artwork ADD COLUMN lon REAL;

-- Create spatial indexes for performance
CREATE INDEX idx_artwork_lat ON artwork(lat);
CREATE INDEX idx_artwork_lon ON artwork(lon);
CREATE INDEX idx_artwork_spatial ON artwork(lat, lon);
```

**Spatial Query Patterns**:
```sql
-- Bounding box queries (±0.0045 degrees ~= 500m)
SELECT * FROM artwork 
WHERE lat BETWEEN ? - 0.0045 AND ? + 0.0045 
  AND lon BETWEEN ? - 0.0045 AND ? + 0.0045;
```

### JSON Data Handling

**Store as TEXT, parse at application level**:
```sql
-- Correct way to store JSON in D1
ALTER TABLE artwork ADD COLUMN tags TEXT; -- JSON string
ALTER TABLE artwork ADD COLUMN photos TEXT; -- JSON array string

-- Example data insertion
INSERT INTO artwork (tags, photos) VALUES (
    '["street-art", "mural", "outdoor"]',
    '[{"url": "photo1.jpg", "thumbnail": "thumb1.jpg"}]'
);
```

### Common Migration Patterns

#### Adding New Table
```sql
-- Migration: 0007_add_user_preferences
-- Description: Add user preference storage
-- Created: 2025-09-07

CREATE TABLE user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_uuid TEXT NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_user_preferences_user_uuid ON user_preferences(user_uuid);
CREATE UNIQUE INDEX idx_user_preferences_unique ON user_preferences(user_uuid, preference_key);
```

#### Adding Column with Index
```sql
-- Migration: 0008_add_artwork_status
-- Description: Add status tracking to artwork submissions
-- Created: 2025-09-07

ALTER TABLE artwork ADD COLUMN status TEXT DEFAULT 'pending';

-- Add index for status queries
CREATE INDEX idx_artwork_status ON artwork(status);

-- Update existing records
UPDATE artwork SET status = 'approved' WHERE id IS NOT NULL;
```

#### Data Migration Pattern
```sql
-- Migration: 0009_migrate_tag_structure
-- Description: Convert old tag format to new structured format
-- Created: 2025-09-07

-- Create temporary table for data transformation
CREATE TABLE artwork_tags_temp (
    artwork_id INTEGER,
    tag_data TEXT
);

-- Migrate existing data (example)
INSERT INTO artwork_tags_temp (artwork_id, tag_data)
SELECT id, tags FROM artwork WHERE tags IS NOT NULL;

-- Update main table with transformed data
UPDATE artwork 
SET tags = (
    SELECT tag_data 
    FROM artwork_tags_temp 
    WHERE artwork_tags_temp.artwork_id = artwork.id
)
WHERE id IN (SELECT artwork_id FROM artwork_tags_temp);

-- Clean up temporary table
DROP TABLE artwork_tags_temp;
```

### Testing and Validation

#### Migration Testing Checklist for AI Agents

```sql
-- Always include these validation queries at the end
-- Test that new columns exist
PRAGMA table_info(table_name);

-- Test that indexes were created
PRAGMA index_list(table_name);

-- Test data integrity
SELECT COUNT(*) FROM table_name WHERE new_column IS NOT NULL;

-- Test spatial queries work (if applicable)
SELECT COUNT(*) FROM artwork 
WHERE lat BETWEEN 49.2 AND 49.3 AND lon BETWEEN -123.2 AND -123.1;
```

### Error Handling in Migrations

```sql
-- Use transactions for complex migrations
BEGIN TRANSACTION;

-- Your migration operations here
ALTER TABLE artwork ADD COLUMN new_field TEXT;
CREATE INDEX idx_new_field ON artwork(new_field);

-- Validate the changes worked
-- If this fails, the transaction will rollback
SELECT COUNT(*) FROM artwork WHERE 1=1; -- Simple validation

COMMIT;
```

### Common AI Agent Mistakes to Avoid

1. **Using PostgreSQL syntax** - D1 is SQLite, not PostgreSQL
2. **Creating foreign key constraints** - Not supported in D1
3. **Using advanced data types** - Stick to INTEGER, TEXT, REAL, BLOB
4. **Forgetting indexes** - Always add indexes for columns that will be queried
5. **Not handling NULL values** - Be explicit about NULL handling
6. **Complex JOIN operations in migrations** - Keep migrations simple
7. **Using stored procedures** - Not supported in D1

### Migration File Naming Convention

AI agents should use descriptive names:
- `0001_initial_schema.sql`
- `0002_add_user_authentication.sql`  
- `0003_add_spatial_indexes.sql`
- `0004_add_photo_processing.sql`
- `0005_extend_artwork_metadata.sql`
- `0006_add_tag_system.sql`

### Pre-Migration Checklist for AI Agents

Before creating any migration:
1. ✅ Read current database schema from `docs/database.md`
2. ✅ Understand the existing table relationships
3. ✅ Check what indexes already exist  
4. ✅ Verify the migration is SQLite/D1 compatible
5. ✅ Include proper header comments
6. ✅ Test queries are included for validation
7. ✅ Migration is atomic (use transactions if needed)

## Implementation Plan

### Phase 1: All Core Features Together

#### 1.1 Create Migration Directory Structure

- [ ] Create `src/workers/migrations/` directory
- [ ] Test basic `wrangler d1 migrations` commands

#### 1.2 Update Package.json Scripts

- [ ] Add `database:export` script (PowerShell-compatible)
- [ ] Add `database:migration` script (both dev and production)
- [ ] Add `database:import` script (basic file validation)
- [ ] Add `database:status` script (show pending migrations)
- [ ] Add `database:create-migration` script (use Wrangler built-in)

#### 1.3 Create Backup Directory

- [ ] Ensure `_backup_database/` directory exists
- [ ] Add to `.gitignore` to prevent committing backup files

#### 1.4 Create AI Agent Documentation

- [ ] Create `docs/migration-guide-for-ai-agents.md` with comprehensive guidelines
- [ ] Include SQLite/D1 compatibility rules and examples
- [ ] Document spatial data handling patterns
- [ ] Provide migration file templates and validation checklists

### Phase 2: Implementation Details

#### 2.1 Database Export Script (PowerShell-Compatible)

```json
{
  "database:export": "cd src/workers; wrangler d1 export cultural-archiver --output ../../_backup_database/database_$(Get-Date -Format yyyy-MMM-dd).sql --env production",
  "database:export:dev": "cd src/workers; wrangler d1 export cultural-archiver --output ../../_backup_database/database_dev_$(Get-Date -Format yyyy-MMM-dd).sql --env development"
}
```

#### 2.2 Migration Management Scripts (Use Wrangler Built-ins)

```json
{
  "database:migration": "cd src/workers; wrangler d1 migrations apply cultural-archiver --env production",
  "database:migration:dev": "cd src/workers; wrangler d1 migrations apply cultural-archiver --env development",
  "database:status": "cd src/workers; wrangler d1 migrations list cultural-archiver --env production",
  "database:create-migration": "cd src/workers; wrangler d1 migrations create cultural-archiver"
}
```

#### 2.3 Import Script (Basic File Validation)

```json
{
  "database:import": "powershell -Command \"if (Test-Path $args[0]) { cd src/workers; wrangler d1 execute cultural-archiver --file ../../$args[0] --env production } else { Write-Host 'File not found: ' $args[0] }\""
}
```

#### 3.1 Migration Management Scripts

```json
## Technical Specifications (Simplified)

### Environment Configuration

#### Wrangler Configuration (`src/workers/wrangler.toml`)

```toml
# Existing configuration supports migrations - no changes needed
# Migrations will be stored in: src/workers/migrations/
# Database bindings already configured for both environments
```

### Migration File Management

- **Use Wrangler built-in commands only**: `wrangler d1 migrations create/list/apply`
- **Standard naming**: Wrangler will handle file naming automatically
- **No custom rollback**: Rely on Wrangler's migration system

### PowerShell Compatibility

- **Use PowerShell-specific syntax**: `Get-Date`, `Test-Path`, `Write-Host`
- **PowerShell commands embedded in npm scripts**
- **No cross-platform compatibility needed initially**

### Error Handling (Minimal)

- **Basic error messages** from Wrangler commands
- **Simple exit codes** (0 for success, non-zero for failure)
- **File existence checks** for import operations
- **No retry logic or detailed logging**

### Backup File Management

- **No automatic cleanup** - keep all backup files indefinitely
- **Manual management** of backup directory
- **Simple timestamped naming**: `database_YYYY-MMM-DD.sql`

## Success Criteria (Focused)

### Core Requirements

1. ✅ All three commands work together in first implementation
2. ✅ Both development and production environments supported
3. ✅ PowerShell-compatible commands that run on Windows
4. ✅ Basic file validation for imports (exists, readable, non-empty)
5. ✅ Uses existing Wrangler authentication without additional setup

### Implementation Scope

- **Single implementation phase** with all three features
- **Wrangler built-in migration management** only
- **PowerShell-specific commands** and syntax
- **Minimal error handling** for initial version
- **No automatic backup cleanup** or retention policies

## Acceptance Criteria

- [ ] `npm run database:export` creates timestamped backup files for both environments
- [ ] `npm run database:migration` applies pending migrations using Wrangler built-ins
- [ ] `npm run database:import <file.sql>` validates file exists and imports to database
- [ ] `npm run database:status` shows pending migrations
- [ ] `npm run database:create-migration` creates new migration files
- [ ] All commands work in Windows PowerShell without additional dependencies
- [ ] Uses existing Wrangler configuration and authentication
```

#### 3.2 Migration Features

- [ ] Apply pending migrations to specified environment
- [ ] Show migration status and pending migrations
- [ ] Create new migration files with proper naming
- [ ] Rollback capability (if supported by Wrangler)

### Phase 4: Import Functionality

#### 4.1 Import Script with Safety Checks

```json
{
  "database:import": "node scripts/database-import.js"
}
```

#### 4.2 Import Safety Script (`scripts/database-import.js`)

```javascript
// PowerShell-compatible Node.js script with safety features:
// 1. Validate input file exists and is readable
// 2. Show destructive operation warning with database details
// 3. Require explicit confirmation ("yes" typed fully)
// 4. Create automatic backup before import
// 5. Clear existing database
// 6. Import new database from file
// 7. Verify import success and show statistics
```

#### 4.3 Import Features

- [ ] File validation (exists, readable, valid SQL)
- [ ] Interactive confirmation with database details
- [ ] Pre-import database backup
- [ ] Progress indicators for large imports
- [ ] Post-import validation and statistics

### Phase 5: Documentation and Testing

#### 5.1 Create Documentation

- [ ] Update `docs/database.md` with migration procedures
- [ ] Create `docs/migration-guide.md` with step-by-step instructions
- [ ] Document migration file naming conventions
- [ ] Add troubleshooting section

#### 5.2 Testing Strategy

- [ ] Test export functionality with development database
- [ ] Test migration application with sample migrations
- [ ] Test import functionality with exported files
- [ ] Verify PowerShell compatibility on Windows
- [ ] Test error handling and edge cases

## Technical Specifications

### Environment Configuration

#### Wrangler Configuration (`src/workers/wrangler.toml`)

```toml
# Existing configuration supports migrations
# No changes needed to wrangler.toml

# Migrations will be stored in:
# src/workers/migrations/

# Database bindings already configured:
# Development: cultural-archiver (b64d04af-79d9-4573-8adb-97f0e3946962)
# Production: cultural-archiver (same ID)
```

### Migration File Naming Convention

- Format: `NNNN_descriptive_name.sql`
- Examples:
  - `0001_initial_schema.sql`
  - `0002_add_user_authentication.sql`
  - `0003_add_spatial_indexes.sql`

### PowerShell Compatibility

- Use Node.js scripts instead of shell scripts for cross-platform compatibility
- Leverage `wrangler` CLI commands through npm scripts
- Handle Windows path separators correctly
- Use PowerShell-compatible date formatting: `Get-Date -Format yyyy-MMM-dd`

### Error Handling

- Validate Wrangler installation and authentication
- Check database connectivity before operations
- Provide clear error messages for common issues
- Implement retry logic for network operations

## Security Considerations

### Export Security

- Never export to publicly accessible directories
- Exclude sensitive configuration from exports
- Validate export file permissions

### Import Security

- Validate SQL file contents before import
- Sanitize file paths to prevent directory traversal
- Require explicit confirmation for destructive operations
- Log all import operations with timestamps

### Migration Security

- Require authentication for production migrations
- Validate migration file integrity
- Support dry-run mode for testing
- Maintain migration history and audit trail

## Success Criteria

### Functional Requirements

1. ✅ `npm run database:export` creates timestamped backup files
2. ✅ `npm run database:migration` applies pending migrations successfully
3. ✅ `npm run database:import <file>` replaces database after confirmation
4. ✅ All operations work on Windows PowerShell
5. ✅ Error handling provides clear, actionable feedback

### Usability Requirements

- Commands provide clear progress indicators
- Destructive operations require explicit confirmation
- Help text available for all commands
- Compatible with existing development workflow

## Dependencies

### Required Tools

- Node.js >=22.0.0 (already required)
- Wrangler CLI (already installed)
- PowerShell (Windows default)

### Required Packages

- No additional npm packages needed
- Leverage existing Wrangler configuration
- Use built-in Node.js modules for file operations

## Risks and Mitigation

## Future Enhancements

### Integration Features

- CI/CD pipeline integration
- Automated testing of migrations
- Production deployment gates
- Database health monitoring

## Acceptance Criteria

- [ ] All three core commands (`export`, `migration`, `import`) work correctly
- [ ] PowerShell compatibility verified on Windows
- [ ] Documentation updated with migration procedures
- [ ] Test coverage for all migration operations
- [ ] Security review completed for destructive operations
- [ ] Integration with existing backup system (`scripts/backup.ts`)

## Implementation Notes

### PowerShell-Specific Considerations

- Date formatting uses PowerShell syntax: `$(Get-Date -Format yyyy-MMM-dd)`
- Directory changes use `cd` which works in both CMD and PowerShell
- File operations leverage Node.js for cross-platform compatibility
- Error handling includes PowerShell-specific exit codes

### Integration with Existing Systems

- Builds on existing backup system in `scripts/backup.ts`
- Uses same database configuration as current Workers setup
- Follows existing project structure and naming conventions
- Compatible with current CI/CD pipeline
