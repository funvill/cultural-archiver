# Migration 006 Troubleshooting Guide

This guide helps resolve common issues when deploying migration 006 (Structured Tag Schema) to production.

## Quick Diagnosis

### Issue: "No migrations present" or "migrations folder not found"

**Symptoms:**
```
✘ [ERROR] No migrations present at /path/to/migrations
▲ [WARNING] No migrations folder found
```

**Solution (Windows PowerShell Compatible):**
1. Check that migrations exist in the correct location:
   ```powershell
   Get-ChildItem migrations/006_structured_tag_schema.sql
   ```

2. Synchronize migrations for Windows compatibility:
   ```powershell
   npm run migrate:sync
   ```

3. Verify wrangler.toml configuration:
   ```toml
   [env.production]
   migrations_dir = "./migrations"
   ```

**Background:**
The system uses dual migration directories for cross-platform compatibility:
- `/migrations` - Authoritative source
- `/src/workers/migrations` - Copy for wrangler (Windows compatible)

The `migrate:sync` command copies files instead of using symbolic links, ensuring Windows PowerShell compatibility.

### Issue: "Not authorized: SQLITE_AUTH" 

**Symptoms:**
```
✘ [ERROR] Migration failed with SQLITE_AUTH
```

**Root Causes:**
- Missing or invalid CLOUDFLARE_API_TOKEN
- Incorrect database permissions
- Wrong database ID in production config
- Running in CI environment without credentials

**Solutions:**

1. **Set API Token:**
   ```bash
   export CLOUDFLARE_API_TOKEN="your-token-here"
   ```

2. **Verify Token Permissions:**
   Token needs:
   - Account:D1:Edit
   - Zone:Zone:Read (for your domain)
   - Account:Account Details:Read

3. **Check Database Configuration:**
   ```bash
   cd src/workers
   npx wrangler d1 info cultural-archiver --env production
   ```

4. **Verify Database ID:**
   Ensure `wrangler.toml` has correct production database ID:
   ```toml
   [[env.production.d1_databases]]
   binding = "DB"
   database_name = "cultural-archiver"
   database_id = "YOUR-ACTUAL-PROD-DATABASE-ID"
   ```

### Issue: "Migration validation failed"

**Symptoms:**
```
❌ Migration validation failed!
Fix validation errors before proceeding
```

**Solution:**
1. Run validation to see specific errors:
   ```bash
   npm run migrate:validate 006_structured_tag_schema.sql
   ```

2. Check for D1 compatibility issues:
   - No PRAGMA statements
   - No WITHOUT ROWID tables
   - No AUTOINCREMENT
   - Simple CHECK constraints only

### Issue: "Tests are failing"

**Symptoms:**
```
❌ Tests are failing!
Fix failing tests before proceeding to production
```

**Solution:**
1. Run migration-specific tests:
   ```bash
   npx vitest migrations/test/006_structured_tag_schema.test.ts --run
   ```

2. Run full test suite:
   ```bash
   npm run test
   ```

3. Check for missing dependencies:
   ```bash
   npm install
   ```

## Step-by-Step Resolution

### Step 1: Environment Setup

1. **Install Dependencies:**
   ```powershell
   npm install
   ```

2. **Synchronize Migrations (Windows Compatible):**
   ```powershell
   npm run migrate:sync
   ```

3. **Set Environment Variables:**
   ```powershell
   # Get your API token from: https://dash.cloudflare.com/profile/api-tokens
   $env:CLOUDFLARE_API_TOKEN="your-token-with-d1-permissions"
   ```

4. **Verify Database Access:**
   ```powershell
   cd src/workers
   npx wrangler d1 info cultural-archiver --env production
   ```

### Step 2: Pre-flight Checks

1. **Validate Migration:**
   ```powershell
   npm run migrate:validate 006_structured_tag_schema.sql
   ```

2. **Test Migration Logic:**
   ```powershell
   npx vitest migrations/test/006_structured_tag_schema.test.ts --run
   ```

3. **Check Current Migration State:**
   ```powershell
   npm run migrate:status:prod
   ```

### Step 3: Create Backup

**Critical:** Always backup before migration!

```bash
npm run backup:remote
```

### Step 4: Apply Migration

**Option A: Using the guided script**
```bash
npm run migrate:006:prod
```

**Option B: Manual application**
```bash
npm run migrate:prod
```

**Option C: Dry run first**
```bash
npm run migrate:prod:dry-run
```

### Step 5: Verify Success

1. **Check Migration Status:**
   ```bash
   npm run migrate:status:prod
   ```

2. **Test Application:**
   - Create new artwork with tags
   - View existing artwork
   - Test search functionality
   - Verify moderation interface

## Common Error Messages

### "CLOUDFLARE_API_TOKEN environment variable"
- **Cause:** No API token set
- **Fix:** `export CLOUDFLARE_API_TOKEN="your-token"`

### "database_id not found"
- **Cause:** Wrong database ID in wrangler.toml
- **Fix:** Update production database_id with actual value

### "Migration already applied"
- **Cause:** Migration 006 was already run
- **Fix:** Check `migrate:status:prod` to confirm current state

### "Invalid JSON in migration"
- **Cause:** Syntax error in migration file
- **Fix:** Run `migrate:validate` to find specific issues

## Recovery Procedures

### If Migration Fails Midway

1. **Check Migration Status:**
   ```bash
   npm run migrate:status:prod
   ```

2. **Review Logs:**
   ```bash
   cd src/workers
   npx wrangler d1 info cultural-archiver --env production
   ```

3. **Rollback if Needed:**
   ```bash
   npm run migrate:rollback:prod
   ```

4. **Restore from Backup:**
   Follow backup restoration procedures if rollback is insufficient

### If Application Breaks After Migration

1. **Check Logs:**
   ```bash
   npm run log
   ```

2. **Test Database Queries:**
   Verify tag data is accessible and in correct format

3. **Rollback Migration:**
   ```bash
   npm run migrate:rollback:prod
   ```

## Prevention

### Before Running Migration

- [ ] All tests passing
- [ ] Recent backup created
- [ ] Correct database configuration
- [ ] Valid API credentials
- [ ] Team notified
- [ ] Maintenance window scheduled

### Testing Checklist

- [ ] Migration validation passes
- [ ] Unit tests pass  
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Load testing (if applicable)

## Getting Help

### Debug Information to Collect

When reporting issues, include:

1. **Command run:**
   ```bash
   # The exact command that failed
   ```

2. **Error output:**
   ```
   # Complete error message and stack trace
   ```

3. **Environment info:**
   ```bash
   node --version
   npm --version
   npx wrangler --version
   ```

4. **Migration status:**
   ```bash
   npm run migrate:status:prod
   ```

### Contact Information

- **Repository:** https://github.com/funvill/cultural-archiver
- **Issues:** Create GitHub issue with "migration-006" label
- **Discord:** #cultural-archiver channel (if available)

## Advanced Recovery

### Manual Database Repair

If migration corrupts data, you may need to manually fix records:

```sql
-- Example: Fix corrupted tag structures
UPDATE artwork 
SET tags = json_object(
  'tags', CASE 
    WHEN json_valid(tags) THEN json_extract(tags, '$')
    ELSE json_object()
  END,
  'version', '1.0.0',
  'lastModified', datetime('now')
)
WHERE tags IS NOT NULL 
  AND (
    NOT json_valid(tags) 
    OR json_extract(tags, '$.version') IS NULL
  );
```

**Warning:** Only run manual SQL if you understand the consequences and have a backup.

### Performance Monitoring

After migration, monitor:

- Database query performance
- API response times
- Memory usage
- Search functionality speed
- Tag validation performance

Use these commands for monitoring:
```bash
# Check recent logs
npm run log

# Monitor performance
npx wrangler tail cultural-archiver-api --format pretty
```