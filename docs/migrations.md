# Database Migrations

This guide covers the Cultural Archiver database migration system using Cloudflare's native D1 migration capabilities.

## Overview

The Cultural Archiver uses **Wrangler's native D1 migration system** for database schema management. This provides proper state tracking, environment isolation, and robust error handling.

### Key Features

- **Native D1 Compatibility**: Uses Wrangler CLI for all migration operations
- **State Tracking**: Wrangler automatically tracks which migrations have been applied to each environment
- **Environment Isolation**: Separate migration state for development, staging, and production
- **D1 Validation**: Built-in validation to prevent D1-incompatible SQL patterns
- **Sequential Numbering**: Enforced 4-digit sequential numbering (0001*, 0002*, etc.)

## Quick Start

### Development Workflow

```bash
# Create a new migration
npm run migrate:create "add_new_table"

# Validate all migrations for D1 compatibility
npm run migrate:validate

# Apply pending migrations to development environment
npm run migrate:dev

# Check migration status
npm run migrate:status
```

### Production Workflow

```bash
# Check production migration status
npm run migrate:status:prod

# Apply migrations to production (requires confirmation)
npm run migrate:prod

# Rollback last migration if needed (emergency use only)
npm run migrate:rollback:prod
```

## Migration Commands

### Development Commands

| Command                                | Description                                         |
| -------------------------------------- | --------------------------------------------------- |
| `npm run migrate:create "description"` | Create new migration with D1-compatible template    |
| `npm run migrate:dev`                  | Apply pending migrations to development environment |
| `npm run migrate:status`               | Show migration status for development environment   |
| `npm run migrate:rollback`             | Rollback last migration in development              |
| `npm run migrate:validate`             | Validate all migrations for D1 compatibility        |

### Production Commands

| Command                         | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| `npm run migrate:prod`          | Apply pending migrations to production environment |
| `npm run migrate:status:prod`   | Show migration status for production environment   |
| `npm run migrate:rollback:prod` | Emergency rollback of last production migration    |

### Under the Hood

All migration commands use Wrangler CLI:

- `migrate:create` → Runs scaffolding script to create numbered migration files
- `migrate:dev` → `wrangler d1 migrations apply cultural-archiver --env development`
- `migrate:prod` → `wrangler d1 migrations apply cultural-archiver --env production`
- `migrate:status` → `wrangler d1 migrations list cultural-archiver`

## Creating Migrations

### Using the Migration Generator

```bash
# Create a new migration
npm run migrate:create "add_user_preferences_table"

# This creates: migrations/0003_add_user_preferences_table.sql
```

The generator automatically:

- Determines the next sequential number (0001, 0002, etc.)
- Creates a file with D1-compatible template
- Includes proper header comments with timestamp and description

### Migration File Structure

```
migrations/
├── 0001_consolidated_baseline.sql     # Initial schema
├── 0002_create_data_dumps_table.sql   # Data export functionality
├── 0003_create_artwork_edits_table.sql # Edit tracking
├── 0004_add_artwork_edit_fields.sql   # Additional edit fields
└── templates/
    └── d1-template.sql                # Template for new migrations
```

### D1-Compatible Migration Template

```sql
-- Migration: Add user preferences table
-- Generated: 2025-01-15 14:30:22
-- Environment: Compatible with Cloudflare D1

-- Add your migration here
CREATE TABLE user_preferences (
    id TEXT PRIMARY KEY,
    user_token TEXT NOT NULL,
    theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es', 'fr')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add indexes
CREATE INDEX idx_user_preferences_user_token ON user_preferences(user_token);
CREATE INDEX idx_user_preferences_theme ON user_preferences(theme);

-- Add sample data (optional - remove for production)
INSERT INTO user_preferences (id, user_token, theme, language) VALUES
('pref-1', 'user-123', 'dark', 'en'),
('pref-2', 'user-456', 'light', 'es');
```

## D1 Compatibility Guidelines

### ✅ Supported SQL Features

**Table Operations**

- `CREATE TABLE` with basic constraints
- `DROP TABLE IF EXISTS`
- `ALTER TABLE ADD COLUMN` (with limitations)

**Data Types**

- `TEXT` (recommended for most use cases)
- `INTEGER` (for numbers, timestamps)
- `REAL` (for floating-point numbers)
- `BLOB` (for binary data)

**Constraints**

- `PRIMARY KEY`
- `NOT NULL`
- `DEFAULT` values
- Simple `CHECK` constraints with `IN()` clauses
- `FOREIGN KEY` references

**Functions**

- `datetime('now')` for timestamps
- Basic math functions
- String functions like `upper()`, `lower()`

### ❌ Prohibited Patterns

**The migration validator will flag these issues:**

**PRAGMA Statements**

```sql
-- ❌ Not supported in D1
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
```

**WITHOUT ROWID Tables**

```sql
-- ❌ Not supported in D1
CREATE TABLE example (id TEXT PRIMARY KEY) WITHOUT ROWID;
```

**AUTOINCREMENT**

```sql
-- ❌ Use UUIDs instead
CREATE TABLE example (id INTEGER PRIMARY KEY AUTOINCREMENT);

-- ✅ Recommended approach
CREATE TABLE example (id TEXT PRIMARY KEY);
-- Use uuid() function or client-generated UUIDs
```

**Complex CHECK Constraints**

```sql
-- ❌ Functions in CHECK constraints may not work
CHECK (length(name) > 0)
CHECK (email LIKE '%@%')

-- ✅ Simple value checks work fine
CHECK (status IN ('active', 'inactive'))
CHECK (priority BETWEEN 1 AND 5)
```

**Temporary Tables & Views**

```sql
-- ❌ Not supported in migrations
CREATE TEMPORARY TABLE temp_data (...);
CREATE VIEW artwork_summary AS ...;
```

## Migration Validation

### Automatic Validation

```bash
# Validate all migrations
npm run migrate:validate

# Example output:
🔍 D1 Migration Validation Results
==================================
✅ 0001_consolidated_baseline.sql - Valid
⚠️  0002_add_complex_check.sql
   Warnings:
   • Line 15: Complex CHECK constraints may not be fully supported
     💡 Suggestion: Use simple CHECK constraints with IN() clauses
❌ 0003_invalid_pragma.sql - ERRORS FOUND
   • Line 3: PRAGMA statements not supported in D1
     💡 Suggestion: Remove PRAGMA statements
```

### Validation Rules

The validator checks for:

- **Prohibited patterns**: PRAGMA, WITHOUT ROWID, AUTOINCREMENT, ATTACH
- **Complex CHECK constraints**: Using functions like length(), LIKE patterns
- **Temporary objects**: Temporary tables, views in migrations
- **Syntax issues**: Basic SQL syntax validation

### Fixing Validation Errors

**Remove PRAGMA statements**

```sql
-- ❌ Remove this
PRAGMA foreign_keys = ON;

-- ✅ D1 handles foreign keys automatically
```

**Simplify CHECK constraints**

```sql
-- ❌ Complex constraint
CHECK (length(name) > 0 AND name NOT LIKE '%test%')

-- ✅ Simple constraint
CHECK (name != '')
```

**Use UUIDs instead of AUTOINCREMENT**

```sql
-- ❌ Not supported
id INTEGER PRIMARY KEY AUTOINCREMENT

-- ✅ Use UUIDs
id TEXT PRIMARY KEY
-- Generate UUIDs in application code
```

## Environment Management

### Development Environment

**Local D1 database for development:**

- Fast reset capabilities for clean development environments
- Automatic migration application during development setup
- No confirmation prompts for development operations

```bash
# Apply all pending migrations
npm run migrate:dev

# Check what's been applied
npm run migrate:status

# Rollback last migration (development only)
npm run migrate:rollback
```

### Production Environment

**Protected production database with safety checks:**

- Confirmation prompts for destructive operations
- Audit logging of all production migration activities
- Emergency rollback capabilities

```bash
# Check production status first
npm run migrate:status:prod

# Apply with confirmation (safer)
npm run migrate:prod

# Emergency rollback (use with caution)
npm run migrate:rollback:prod
```

### Environment Consistency

```bash
# Compare environments
npm run migrate:status        # Development
npm run migrate:status:prod   # Production

# Ensure both environments are in sync before deployments
```

## Migration State Tracking

Wrangler automatically tracks migration state:

- **Applied migrations**: Stored in D1's internal metadata
- **Pending migrations**: Determined by comparing files vs. applied state
- **Consistency validation**: Automatic prevention of re-running completed migrations
- **Environment isolation**: Separate tracking for development/production

### Migration Status Output

```bash
$ npm run migrate:status

Applied migrations:
✅ 0001_consolidated_baseline.sql (applied 2025-01-10)
✅ 0002_create_data_dumps_table.sql (applied 2025-01-11)
✅ 0003_create_artwork_edits_table.sql (applied 2025-01-12)

Pending migrations:
⏳ 0004_add_user_preferences_table.sql
⏳ 0005_add_search_indexes.sql
```

## Rollback and Recovery

### Development Rollbacks

```bash
# Rollback last migration (development only)
npm run migrate:rollback

# This will:
# 1. Identify the last applied migration
# 2. Run any rollback SQL if provided
# 3. Update migration state tracking
```

### Production Emergency Rollbacks

```bash
# Emergency production rollback (use with extreme caution)
npm run migrate:rollback:prod

# Always verify status before and after:
npm run migrate:status:prod
```

### Best Practices for Rollbacks

1. **Test rollbacks in development first**
2. **Have a data backup before production rollbacks**
3. **Document the reason for rollback**
4. **Verify application functionality after rollback**
5. **Plan forward-fix migrations when possible**

## Troubleshooting

### Common Issues

**Migration State Mismatch**

```bash
# Symptom: Wrangler reports different state than expected
# Solution: Check both environments
npm run migrate:status
npm run migrate:status:prod
```

**D1 Compatibility Errors**

```bash
# Symptom: SQLITE_AUTH errors during migration
# Solution: Run validation and fix issues
npm run migrate:validate
```

**Missing Migrations**

```bash
# Symptom: Migration files not found
# Solution: Ensure you're running from project root
cd /path/to/cultural-archiver
npm run migrate:status
```

**Wrangler Authentication**

```bash
# Symptom: Authentication errors
# Solution: Login to Wrangler
npx wrangler login
npx wrangler whoami
```

### Debug Mode

Add debug logging to migration commands:

```bash
# Enable debug output
WRANGLER_LOG=debug npm run migrate:dev

# Check wrangler.toml configuration
cd src/workers && npx wrangler d1 list
```

### Recovery Procedures

**Corrupted Migration State**

1. Take full database backup
2. Compare development vs. production schema
3. Manually synchronize if needed
4. Resume normal migration workflow

**Failed Migration**

1. Check error logs carefully
2. Fix the problematic SQL in migration file
3. Re-run migration after fixes
4. Validate with `migrate:status`

## Best Practices

### Migration Design

1. **Keep migrations small and focused** - One logical change per migration
2. **Test in development first** - Always validate migrations locally
3. **Use descriptive names** - Clear description of what the migration does
4. **Include rollback strategy** - Plan how to undo changes if needed
5. **Document complex changes** - Add comments explaining business logic

### Team Workflow

1. **Coordinate migration numbering** - Avoid conflicts in sequential numbering
2. **Review migrations in PRs** - Include migration review in code review process
3. **Deploy in order** - Apply migrations in the same order across environments
4. **Backup before production** - Always take backup before production migrations

### Performance Considerations

1. **Add indexes thoughtfully** - Consider query patterns and performance impact
2. **Batch large data operations** - Split large updates into smaller chunks
3. **Test with realistic data** - Use production-like datasets for testing
4. **Monitor migration duration** - Track time for migrations to complete

## Integration with Backup System

The migration system integrates with the backup system:

```bash
# Backups include migration state information
npm run backup:dev        # Includes development migration state
npm run backup:remote     # Includes production migration state

# Backup files contain:
# - database.sql (from wrangler d1 export)
# - migration_state.json (current migration status)
# - photos/ (all R2 photos)
# - metadata.json (backup information)
```

This ensures backups are consistent with migration state and can be properly restored.

## Advanced Usage

### Custom Migration Templates

Create custom templates in `migrations/templates/`:

```sql
-- migrations/templates/table-template.sql
-- Template for new table creation
-- Generated: {{ timestamp }}

CREATE TABLE {{ table_name }} (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_{{ table_name }}_created_at ON {{ table_name }}(created_at);
```

### Migration Scripts

For complex data migrations, combine SQL with application logic:

```javascript
// scripts/migrate-data.ts
// Run after SQL migration to transform data
import { migrateArtworkTags } from './lib/data-migration';

async function main() {
  await migrateArtworkTags();
  console.log('Data migration completed');
}
```

### CI/CD Integration

Add migration validation to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Validate Migrations
  run: npm run migrate:validate

- name: Check Migration Status
  run: npm run migrate:status
```

This ensures migrations are valid before merging to main branch.
