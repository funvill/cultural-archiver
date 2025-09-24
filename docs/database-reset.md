# Database Reset Script Documentation

## Overview

The `reset-database.ts` script provides a safe and comprehensive way to reset the Cultural Archiver database to a clean development state while preserving essential schema and reference data.

## Features

✅ **Safe Reset Process**

- Interactive confirmation prompts (bypass with `--force`)
- Automatic backup creation before reset
- Environment validation
- Comprehensive error handling with rollback guidance

✅ **Smart Data Management**

- Preserves essential reference data (artwork_types)
- Clears all user-generated content
- Creates default admin user automatically
- Validates final database state

✅ **Multi-Environment Support**

- Development (`dev`)
- Staging (`staging`)
- Production (`prod`)
- Environment-specific configuration

## Dry Run Mode - Test Safely! 🔍

The reset script includes a comprehensive dry-run mode that simulates the entire reset process without making any actual changes to your database.

### When to Use Dry Run

✅ **Before First Time Use** - Verify the script works with your environment  
✅ **Testing New Environments** - Validate configuration before actual reset  
✅ **Debugging Issues** - Troubleshoot problems without data loss risk  
✅ **Documentation/Training** - Show the reset process safely  
✅ **CI/CD Pipeline Testing** - Validate automation scripts

### Dry Run Commands

```powershell
# Test development reset
npm run database:reset:dev:dry-run

# Test staging reset
npm run database:reset:staging:dry-run

# Test production reset (completely safe)
npm run database:reset:prod:dry-run

# Manual dry run
npx tsx scripts/reset-database.ts --env dev --dry-run
```

### What Dry Run Shows

The dry-run mode provides complete visibility into what the reset would do:

```
🔄 Cultural Archiver Database Reset
=====================================
📍 Target environment: dev
🗄️  Database ID: b64d04af...
🔍 DRY RUN MODE - No changes will be made!

📦 [DRY RUN] Would create backup

🧹 Clearing user data...
  🔍 [DRY RUN] Would execute: DELETE FROM user_permissions
  🔍 [DRY RUN] Would clear: user_permissions
  🔍 [DRY RUN] Would execute: DELETE FROM magic_links
  🔍 [DRY RUN] Would clear: magic_links
  (... continues for all tables ...)

👤 Creating default admin user...
  🔍 [DRY RUN] Would create admin user: steven@abluestar.com
  🔍 [DRY RUN] Would grant admin permissions
  🔍 [DRY RUN] Would grant moderator permissions

📊 Repopulating essential data...
  🔍 [DRY RUN] Would check artwork_types count
  🔍 [DRY RUN] Would add default artwork types if needed

🔍 Validating reset...
  🔍 [DRY RUN] Would validate artwork types count
  🔍 [DRY RUN] Would validate admin user exists
  🔍 [DRY RUN] Would validate admin permissions
  🔍 [DRY RUN] Would validate user tables are empty
✅ [DRY RUN] Database reset validation would pass

✅ DRY RUN completed successfully!
=====================================
🔍 This was a simulation - no changes were made
📍 Environment: dev
🎯 To perform actual reset, run without --dry-run flag
```

### Dry Run Safety Features

🛡️ **Zero Database Impact** - No SQL queries executed against database  
🛡️ **No Backup Creation** - Skips backup process entirely  
🛡️ **Mock Responses** - Returns simulated results for validation  
🛡️ **Full Process Simulation** - Shows exact same steps as real reset  
🛡️ **Environment Validation** - Still validates configuration and credentials

## Usage

### Quick Commands (Recommended)

```powershell
# Reset development database
npm run database:reset:dev

# Reset staging database
npm run database:reset:staging

# Reset production database (use with extreme caution!)
npm run database:reset:prod

# DRY RUN MODES - Test without making changes
npm run database:reset:dev:dry-run
npm run database:reset:staging:dry-run
npm run database:reset:prod:dry-run
```

### Direct Script Execution

```powershell
# Interactive reset with confirmation
tsx scripts/reset-database.ts --env dev

# Force reset without prompts (automation)
tsx scripts/reset-database.ts --env staging --force

# DRY RUN - See what would happen without making changes
tsx scripts/reset-database.ts --env dev --dry-run

# Show help
tsx scripts/reset-database.ts --help
```

## What Gets Reset

### 🧹 **Cleared Tables (User Data)**

- `artwork` - All artwork submissions
- `logbook` - All logbook entries
- `users` - All user accounts
- `user_permissions` - All user permissions
- `magic_links` - Authentication tokens
- `auth_sessions` - Active sessions
- `rate_limiting` - Rate limit tracking

### 🔒 **Preserved Tables (Reference Data)**

- `artwork_types` - Artwork categories (sculpture, mural, etc.)
- `d1_migrations` - Migration history
- Database schema and indexes

### 🆕 **Repopulated Data**

- Default artwork types (4 categories)
- Admin user: `steven@abluestar.com`
- Admin permissions: `admin` + `moderator`

## Security & Safety

### 🔐 **Access Control**

- Requires valid environment configuration in `.env`
- Uses Cloudflare API authentication
- Environment-specific database targeting

### 🔒 **Safety Mechanisms**

- **Interactive Confirmation**: Requires explicit "yes" for destructive operations
- **Automatic Backup**: Creates timestamped backup before reset
- **State Validation**: Verifies database state after reset
- **Error Recovery**: Provides troubleshooting guidance on failures

### ⚠️ **Production Warnings**

- Production resets require manual confirmation
- Extra confirmation prompts for prod environment
- Backup creation is mandatory (cannot be skipped)

## Backup System

### 📦 **Automatic Backups**

- Filename: `reset-backup-{env}-{timestamp}.sql`
- Location: `_backup_database/` directory
- Format: Complete SQL dump with schema and data
- Created before any destructive operations

### 🔄 **Recovery Process**

If reset fails or you need to rollback:

```powershell
# Import the backup file
$env:IMPORT_FILE="_backup_database/reset-backup-dev-2025-09-09T15-30-00.sql"
npm run database:import:dev
```

## Configuration

### 📋 **Required Environment Variables**

```env
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token

# Database IDs by Environment
D1_DATABASE_ID=dev_database_id                    # Development
D1_DATABASE_ID_STAGING=staging_database_id        # Staging
D1_DATABASE_ID_PROD=production_database_id        # Production
```

### 🔧 **Environment Mapping**

- `dev`/`development` → `D1_DATABASE_ID`
- `staging` → `D1_DATABASE_ID_STAGING` (fallback to `D1_DATABASE_ID`)
- `prod`/`production` → `D1_DATABASE_ID_PROD` (fallback to `D1_DATABASE_ID`)

## Admin User Details

The script automatically creates a default admin user:

```
Email: steven@abluestar.com
UUID: <randomly generated>
Status: active
Email Verified: yes
Permissions: admin, moderator
Created: <reset timestamp>
```

This user can immediately:

- Review and approve submissions
- Access admin panel
- Manage other users
- Perform moderation tasks

## Validation & Testing

### ✅ **Post-Reset Validation**

The script automatically verifies:

1. **Artwork Types**: At least 4 default types exist
2. **Admin User**: Single admin user with correct email
3. **Permissions**: Admin has both admin and moderator permissions
4. **Empty Tables**: All user data tables are properly cleared
5. **Data Integrity**: No orphaned records or constraint violations

### 🧪 **Development Workflow**

```powershell
# 1. Reset development database
npm run database:reset:dev

# 2. Verify application starts correctly
npm run dev

# 3. Test basic functionality
# - User registration
# - Artwork submission
# - Admin login

# 4. Run test suite
npm run test
```

## Troubleshooting

### ❌ **Common Errors**

**Environment Configuration**

```
Error: Missing required environment variables for dev environment
```

→ Check `.env` file has `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `D1_DATABASE_ID`

**API Authentication**

```
Error: Database query failed: 401 Unauthorized
```

→ Verify `CLOUDFLARE_API_TOKEN` has Workers:Edit and D1:Edit permissions

**Database Connection**

```
Error: Database query failed: 404 Not Found
```

→ Check `D1_DATABASE_ID` is correct for target environment

**Backup Failures**

```
Warning: Backup creation failed, but continuing with reset
```

→ Non-fatal; reset continues but manual backup recommended

### 🔧 **Recovery Steps**

If reset fails partway through:

1. **Check backup file exists**: `_backup_database/reset-backup-*`
2. **Import backup if needed**: Use `npm run database:import:dev`
3. **Review error logs**: Script provides detailed error context
4. **Re-run after fixing**: Address root cause and retry reset

### 📞 **Support Escalation**

For persistent issues:

1. Include full error output and environment details
2. Check Cloudflare dashboard for API rate limits
3. Verify database exists and is accessible
4. Test basic wrangler commands work: `wrangler d1 list`

## Integration with Development Workflow

### 🔄 **Typical Use Cases**

**Feature Development**

```powershell
# Clean slate for new feature branch
npm run database:reset:dev
# Develop and test feature
# Reset again for next developer
```

**Testing & QA**

```powershell
# Reset staging for QA testing
npm run database:reset:staging
# Load test data
# Execute test scenarios
```

**Demo Preparation**

```powershell
# Clean demo environment
npm run database:reset:staging
# Import curated demo data
# Verify demo workflow
```

### 🏗️ **CI/CD Integration**

For automated testing pipelines:

```yaml
# Example GitHub Actions step
- name: Reset test database
  run: tsx scripts/reset-database.ts --env dev --force
  env:
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    D1_DATABASE_ID: ${{ secrets.D1_DATABASE_ID }}
```

## Security Considerations

### 🔐 **Access Control**

- Script requires valid Cloudflare API credentials
- Environment variables control database access
- No hardcoded credentials or database IDs

### 🛡️ **Data Protection**

- Automatic backup creation (cannot be disabled)
- Interactive confirmations for destructive operations
- Comprehensive logging of all operations
- Validation of final state before completion

### 🚨 **Production Safety**

- Extra confirmation prompts for production environment
- Detailed warnings about data loss
- Backup verification before proceeding
- Rollback guidance in error messages

## Limitations

### ⚠️ **Current Limitations**

- Cannot selectively preserve specific user data
- Backup process depends on external npm scripts
- No automatic rollback on partial failure
- Limited to Cloudflare D1 databases

### 🔮 **Future Enhancements**

- Selective data preservation options
- Integrated rollback mechanism
- Custom initialization scripts support
- Support for other database providers
