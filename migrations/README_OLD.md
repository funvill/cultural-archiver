# Database Migrations

This directory contains database migration files for the Cultural Archiver project.

## Quick Start

1. **Setup Environment Variables**
   ```powershell
   # Copy the example file
   cp .env.example .env
   
   # Edit .env and fill in your Cloudflare credentials
   notepad .env
   ```

2. **Required Environment Variables**
   ```env
   D1_DATABASE_ID=your_d1_database_id_here
   CLOUDFLARE_API_TOKEN=your_api_token_here
   CLOUDFLARE_ACCOUNT_ID=your_account_id_here
   ```

3. **Run Migrations**
   ```powershell
   # Run all migrations
   npm run migrate
   
   # List available migrations
   npm run migrate:list
   
   # Get help
   npm run migrate:help
   
   # Force remote execution (production)
   npm run migrate:remote
   ```

## Database Schema Consolidation

**New in 2025**: The database schema has been consolidated from 8 separate migration files into a single baseline schema for easier setup and maintenance.

### Current Schema Structure

- **001_consolidated_baseline.sql** - Complete current database schema (replaces migrations 001-008)
- **archive/** - Original migration files preserved for reference
- **tools/** - Database management tools

### Consolidated Setup (2-Minute Process)

```powershell
# Option 1: Run consolidated migration (recommended for new databases)
npm run migrate

# Option 2: Recreate database with sample data
npm run recreate-db

# Option 3: Recreate database without sample data  
npm run recreate-db:no-data
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run migrate` | Run all pending migrations (starts with consolidated baseline) |
| `npm run migrate:list` | List all available migrations |
| `npm run migrate:help` | Show help and usage information |
| `npm run migrate:remote` | Force remote database execution |
| `npm run extract-schema` | Extract current database schema to file |
| `npm run extract-schema:test` | Test database connection |
| `npm run recreate-db` | Recreate database with consolidated schema + sample data |
| `npm run recreate-db:no-data` | Recreate database with schema only |
| `npm run test:migrations` | Run migration tool tests |

## Schema Management Tools

### Schema Extraction
Extract the current database schema to a timestamped file:
```powershell
npm run extract-schema baseline-backup.sql
```

### Database Recreation
**⚠️ WARNING: This permanently deletes all database data!**
```powershell
# With sample data (recommended for development)
npm run recreate-db

# Schema only (recommended for production)
npm run recreate-db:no-data

# Force mode (skips confirmation - DANGEROUS!)
npx tsx migrations/tools/recreate-database.ts --force
```

## Sample Data

The consolidated schema includes sample data with:
- **3 predefined users**: `sampledata@funvill.com`, `massimport@funvill.com`, `steven@abluestar.com`
- **3 sample artworks** with Vancouver area coordinates (within 100m of 49.2679864,-123.0239578)  
- **9 sample logbook entries** with proper foreign key relationships
- **Sample moderation records** assigned to `steven@abluestar.com`
- **Consistent timestamps** defaulting to January 1, 2025

## Environment Variables

### Required
- `D1_DATABASE_ID` - Your Cloudflare D1 database ID
- `CLOUDFLARE_API_TOKEN` - API token with D1:Edit permissions  
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

### Optional
- `D1_DATABASE_NAME` - Database name (default: `cultural-archiver-dev`)
- `NODE_ENV` - Set to `production` for production migrations
- `MIGRATE_REMOTE` - Set to `true` to force remote execution

## Migration Files

The current structure:
```
migrations/
├── 001_consolidated_baseline.sql  # Complete current schema (NEW)
├── archive/                       # Archived historical migrations
│   ├── 001_initial_schema.sql     # Original 8 migration files
│   ├── 002_mvp_schema.sql
│   ├── ...
│   └── README.md                  # Archive documentation  
├── tools/                         # Database management tools
│   ├── extract-schema.ts          # Schema extraction tool
│   ├── recreate-database.ts       # Database recreation tool
│   ├── sample-data.sql            # Sample data definitions
│   └── *.test.ts                  # Tool test files
├── migrate.ts                     # Migration runner
└── README.md                      # This file
```

Future migrations will be numbered sequentially: `002_feature_name.sql`, `003_next_feature.sql`, etc.

## Getting Cloudflare Credentials

1. **Database ID**: 
   - Go to Cloudflare Dashboard → D1 → Your Database
   - Copy the Database ID from the right sidebar

2. **API Token**:
   - Go to Cloudflare Dashboard → My Profile → API Tokens
   - Create a token with `D1:Edit` permissions
   - Copy the token to your `.env` file

3. **Account ID**:
   - Go to Cloudflare Dashboard → Right sidebar
   - Copy your Account ID

## Troubleshooting

### "wrangler command not found"
The migration script uses `npx wrangler` to ensure wrangler is available. Make sure you have Node.js installed.

### "D1_DATABASE_ID not configured"
Create a `.env` file in the project root and add your database credentials.

### "Migration failed"
Check that:
- Your API token has the correct permissions
- The database ID is correct
- You have network access to Cloudflare

### Local vs Remote Execution
- By default, migrations run against your remote Cloudflare database
- Set `MIGRATE_REMOTE=true` to force remote execution
- Set `NODE_ENV=production` for production migrations

### Schema Consolidation Issues
If you encounter issues with the consolidated schema:
1. Check the `archive/` directory for original migrations
2. Use `npm run extract-schema` to get current state
3. Use `npm run recreate-db` to reset to known good state

## Examples

```powershell
# Basic setup and migration
cp .env.example .env
# Edit .env with your credentials
npm run migrate

# Extract current schema for backup
npm run extract-schema production-backup-2025-01-01.sql

# Reset development database with sample data
npm run recreate-db

# Run a specific migration (if you add migration 002 in future)
npm run migrate up 002

# List migrations to see what's available
npm run migrate:list

# Force remote execution
npm run migrate:remote

# Test database connection
npm run extract-schema:test
```

## Migration History

The Cultural Archiver project originally had 8 migration files from rapid development iterations. These have been consolidated into a single baseline schema on 2025-01-01 to simplify setup and maintenance.

See `archive/README.md` for complete historical information and rationale for the consolidation.

## Security Notes

- Never commit your `.env` file to version control
- Use API tokens with minimal required permissions
- Consider using different databases for development and production
- The recreation tools include safety confirmations to prevent accidental data loss
