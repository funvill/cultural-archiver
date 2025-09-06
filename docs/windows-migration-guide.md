# Windows PowerShell Migration Guide

This guide provides Windows PowerShell-specific instructions for running database migrations in the Cultural Archiver project.

## Overview

The Cultural Archiver uses a dual-directory migration system for cross-platform compatibility:

- **`/migrations`** - Authoritative source for all migration files
- **`/src/workers/migrations`** - Working copy used by Cloudflare Wrangler

This approach ensures compatibility with Windows PowerShell while maintaining a clean project structure.

## Prerequisites

### 1. Environment Setup

```powershell
# Install Node.js dependencies
npm install

# Set Cloudflare API token (required for production)
$env:CLOUDFLARE_API_TOKEN="your-d1-token-here"
```

### 2. Verify Setup

```powershell
# Check migration files exist
Get-ChildItem migrations/*.sql

# Test migration synchronization
npm run migrate:sync

# Check migration status
npm run migrate:status
```

## Migration Commands

### Synchronization

The `migrate:sync` command copies migration files from `/migrations` to `/src/workers/migrations`:

```powershell
# Synchronize migrations (run this first)
npm run migrate:sync
```

### Development Migrations

```powershell
# Apply all pending migrations to development database
npm run migrate:dev

# Check migration status
npm run migrate:status

# Rollback last migration (if needed)
npm run migrate:rollback
```

### Production Migrations

```powershell
# Interactive production migration with safety checks
npm run migrate:prod

# Dry run (preview only)
npm run migrate:prod:dry-run

# Check production migration status
npm run migrate:status:prod
```

### Migration 006 Specific

```powershell
# Comprehensive deployment of structured tag system
npm run migrate:006:prod
```

## Windows-Specific Features

### File Copying Instead of Symbolic Links

Unlike Unix systems, Windows doesn't easily support symbolic links without administrator privileges. The migration system uses file copying:

```powershell
# Automatic synchronization included in migration commands
npm run migrate:dev     # Includes sync step
npm run migrate:prod    # Includes sync step

# Manual synchronization if needed
npm run migrate:sync
```

### PowerShell Environment Variables

```powershell
# Set environment variables for current session
$env:CLOUDFLARE_API_TOKEN="your-token"

# Verify token is set
echo $env:CLOUDFLARE_API_TOKEN

# Set permanently (optional)
[Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "your-token", "User")
```

### Path Handling

The system uses `./migrations` relative paths in `wrangler.toml` for Windows compatibility:

```toml
[env.production]
migrations_dir = "./migrations"  # Local to src/workers directory
```

## Troubleshooting

### "No migrations present" Error

**Solution:**
```powershell
# Synchronize migration files
npm run migrate:sync

# Verify files were copied
Get-ChildItem src/workers/migrations/*.sql
```

### "Not authorized: SQLITE_AUTH" Error

**Solutions:**
```powershell
# 1. Set API token
$env:CLOUDFLARE_API_TOKEN="your-token-with-d1-permissions"

# 2. Test database connectivity
cd src/workers
npx wrangler d1 info cultural-archiver --env production
```

### PowerShell Execution Policy

If you encounter execution policy errors:

```powershell
# Check current policy
Get-ExecutionPolicy

# Allow scripts for current user (if needed)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Migration Workflow

### 1. Development

```powershell
# Start development
npm run dev

# Apply new migrations
npm run migrate:dev

# Test application
# Visit http://localhost:5173
```

### 2. Production Deployment

```powershell
# Pre-deployment checks
npm run test
npm run build

# Create backup
npm run backup:remote

# Deploy migration 006 (guided process)
npm run migrate:006:prod

# Monitor application
npm run log
```

## Best Practices

### 1. Always Synchronize First

Before running any migration commands, ensure files are synchronized:

```powershell
npm run migrate:sync && npm run migrate:dev
```

### 2. Use the Guided Scripts

For production deployments, use the guided scripts that include safety checks:

```powershell
# Recommended for production
npm run migrate:006:prod

# Instead of manual commands
# npm run migrate:prod
```

### 3. Verify After Changes

Always check migration status after applying changes:

```powershell
npm run migrate:status:prod
```

## File Structure

```
cultural-archiver/
├── migrations/                    # Authoritative source
│   ├── 001_consolidated_baseline.sql
│   ├── 002_create_data_dumps_table.sql
│   ├── ...
│   └── 006_structured_tag_schema.sql
├── src/workers/
│   ├── migrations/               # Working copy (auto-generated)
│   │   ├── 001_consolidated_baseline.sql
│   │   └── ...
│   └── wrangler.toml            # Points to ./migrations
└── scripts/
    ├── sync-migrations.ts       # Synchronization tool
    └── run-migration-006.ts     # Production deployment
```

## Security Notes

- Store API tokens securely using environment variables
- Never commit tokens to source control
- Use production tokens only on secure systems
- Consider using `wrangler secret` for production secrets

## Getting Help

### Debug Information

When reporting issues, include:

```powershell
# System information
node --version
npm --version
npx wrangler --version
$PSVersionTable.PSVersion

# Migration status
npm run migrate:status:prod

# Recent logs
npm run log
```

### Common Issues

1. **Migration files not found**: Run `npm run migrate:sync`
2. **Permission denied**: Check API token and database configuration
3. **PowerShell execution policy**: Set appropriate execution policy
4. **Path issues**: Ensure forward slashes in paths, even on Windows

For additional help, see:
- `docs/migration-006-troubleshooting.md`
- `docs/migrations.md` 
- GitHub Issues with "migration-006" label