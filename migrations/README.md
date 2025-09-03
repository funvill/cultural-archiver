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

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run migrate` | Run all pending migrations |
| `npm run migrate:list` | List all available migrations |
| `npm run migrate:help` | Show help and usage information |
| `npm run migrate:remote` | Force remote database execution |

## Environment Variables

### Required
- `D1_DATABASE_ID` - Your Cloudflare D1 database ID
- `CLOUDFLARE_API_TOKEN` - API token with D1:Edit permissions

### Optional
- `D1_DATABASE_NAME` - Database name (default: `cultural-archiver-dev`)
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `NODE_ENV` - Set to `production` for production migrations
- `MIGRATE_REMOTE` - Set to `true` to force remote execution

## Migration Files

Migrations are numbered sequentially and follow the pattern:
```
001_initial_schema.sql
002_mvp_schema.sql
003_consent_audit_schema.sql
...
```

## Getting Cloudflare Credentials

1. **Database ID**: 
   - Go to Cloudflare Dashboard → D1 → Your Database
   - Copy the Database ID from the right sidebar

2. **API Token**:
   - Go to Cloudflare Dashboard → My Profile → API Tokens
   - Create a token with `D1:Edit` permissions
   - Copy the token to your `.env` file

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

## Examples

```powershell
# Basic setup and migration
cp .env.example .env
# Edit .env with your credentials
npm run migrate

# Run a specific migration
npm run migrate up 001

# List migrations to see what's available
npm run migrate:list

# Force remote execution
npm run migrate:remote
```

## Security Notes

- Never commit your `.env` file to version control
- Use API tokens with minimal required permissions
- Consider using different databases for development and production
