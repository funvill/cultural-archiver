# Database Migrations - Wrangler Native D1 System

The Cultural Archiver uses Cloudflare's native D1 migration system via Wrangler CLI for reliable, state-tracked database migrations.

## Quick Start

```powershell
# Create a new migration
npm run migrate:create "add_example_table"

# Apply migrations to development
npm run migrate:dev

# Check migration status
npm run migrate:status

# Apply migrations to production (requires confirmation)
npm run migrate:prod
```

## Migration Naming Convention

- **Sequential 4-digit numbering**: `0001_`, `0002_`, `0003_`, etc.
- **Descriptive names**: `0001_initial_schema.sql`, `0002_add_user_permissions.sql`
- **D1 compatibility required**: All migrations must be D1-compatible (see templates/)

## D1 Compatibility Rules

### ✅ Supported Features

- Standard CREATE TABLE, INSERT, UPDATE, DELETE, DROP statements
- SQLite data types: TEXT, INTEGER, REAL, BLOB
- Basic indexes: CREATE INDEX
- Foreign key constraints (declared but not enforced in D1)
- Simple CHECK constraints: `status IN ('active', 'inactive')`
- DEFAULT values: literals or `datetime('now')`

### ❌ Prohibited Features (Will Cause SQLITE_AUTH Errors)

- `PRAGMA` statements (especially `PRAGMA foreign_keys = ON`)
- `WITHOUT ROWID` tables
- `AUTOINCREMENT` keyword
- Complex CHECK constraints: `length(field) > 10`
- `ATTACH`/`DETACH` database commands
- Triggers, views, or stored procedures
- Custom collation sequences
- Full-text search extensions

## Available Commands

| Command                         | Description                              |
| ------------------------------- | ---------------------------------------- |
| `npm run migrate:create "name"` | Create new migration from template       |
| `npm run migrate:dev`           | Apply pending migrations to development  |
| `npm run migrate:prod`          | Apply pending migrations to production   |
| `npm run migrate:status`        | Show migration status for development    |
| `npm run migrate:status:prod`   | Show migration status for production     |
| `npm run migrate:validate`      | Validate migrations for D1 compatibility |
| `npm run migrate:rollback`      | Rollback last migration (emergency use)  |

## Environment Setup

The migration system uses the environment configuration from `src/workers/wrangler.toml`:

- **Development**: Uses local D1 database for testing
- **Production**: Uses production D1 database with confirmation prompts

No additional environment variables required - Wrangler handles authentication automatically.

## Migration Templates

Use `migrations/templates/d1-template.sql` as a starting point for new migrations. The template includes:

- D1 compatibility guidelines
- Common patterns and examples
- Prohibited features list
- Migration metadata headers

## Migration History

### Current Active Migrations

- **0001_consolidated_baseline.sql** - Complete current database schema (replaces historical migrations 001-008)
- **002_create_data_dumps_table.sql** - Data dump functionality
- **003_create_artwork_edits_table.sql** - Artwork editing system
- **004_add_artwork_edit_fields.sql** - Additional edit fields
- **005_fix_missing_editable_fields.sql** - Field fixes
- **006_structured_tag_schema.sql** - Structured tag system with schema validation

### Archived System

The original custom migration system has been archived to `migrations/archive/custom-system/`. See the archive README for details about the migration to Wrangler native system.

## Troubleshooting

### Common D1 Errors

**SQLITE_AUTH Error**: Your migration contains prohibited D1 features

- Remove `PRAGMA` statements
- Replace `WITHOUT ROWID` with standard tables
- Simplify complex `CHECK` constraints
- Use `npm run migrate:validate` to check compatibility

**Migration Already Applied Error**: Use proper migration state tracking

- Check status: `npm run migrate:status`
- Wrangler automatically prevents re-running completed migrations

**Environment Confusion**: Ensure you're targeting the correct environment

- Development: `npm run migrate:dev`
- Production: `npm run migrate:prod` (requires confirmation)

## Examples

```sql
-- ✅ GOOD: D1-compatible migration
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

## Structured Tag System Migration

### Migration 006: Structured Tag Schema

The structured tag system migration (`006_structured_tag_schema.sql`) transforms the artwork tagging system from unstructured JSON to a validated schema-based approach.

**Key Changes**:
- Preserves all existing tag data during migration
- Adds performance indexes for common tag-based queries
- Implements comprehensive data validation
- Maintains backward compatibility with legacy formats

**Migration Process**:
1. **Preserve existing data**: All current tags are maintained in original format
2. **Add indexes**: Optimized for common tag searches (`material`, `artwork_type`, `artist_name`)
3. **Schema validation**: JSON validation constraint ensures data integrity
4. **Performance optimization**: Efficient querying for large datasets

**Post-Migration Verification**:
```bash
# Verify migration was applied successfully
npm run migrate:status

# Check tag data integrity
npm run migrate:verify:tags
```

**Data Compatibility**:
- **Legacy format**: Still supported for existing artworks
- **New format**: Enforced for new tag submissions  
- **Migration**: Automatic conversion during first edit
- **Rollback**: Safe rollback preserves all original data

**Common Tag Queries After Migration**:
```sql
-- Find artworks by type (optimized with new indexes)
SELECT * FROM artwork 
WHERE json_extract(tags, '$.tags.artwork_type') = 'statue';

-- Find artworks by material
SELECT * FROM artwork 
WHERE json_extract(tags, '$.tags.material') = 'bronze';

-- Find artworks by artist
SELECT * FROM artwork 
WHERE json_extract(tags, '$.tags.artist_name') LIKE '%doe%';
```
```

```sql
-- ❌ BAD: Will cause SQLITE_AUTH errors
PRAGMA foreign_keys = ON;  -- Prohibited

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- AUTOINCREMENT prohibited
    name TEXT CHECK (length(name) > 0)     -- Complex CHECK prohibited
) WITHOUT ROWID;  -- WITHOUT ROWID prohibited
```
