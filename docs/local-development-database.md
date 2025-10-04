# Local Development Database Setup

## Understanding Local vs Remote Databases

When working with this project, there are **two different databases**:

### 1. **Local Database** (for `npm run dev`)
- **Location**: Physical SQLite file at `src/workers/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`
- **Used by**: `wrangler dev` (your local development server)
- **Access**: Direct file access, no internet required
- **Scope**: Only on your machine
- **Speed**: Very fast

### 2. **Remote Dev Database** (Cloudflare D1)
- **Location**: Cloudflare's infrastructure
- **Used by**: Deployed workers, shared development environment
- **Access**: Cloudflare API (requires internet + API token)
- **Scope**: Shared across team/machines
- **Speed**: Network-dependent

## Common Confusion

The `--env dev` flag in many scripts refers to the **remote** Cloudflare D1 development database, NOT your local database!

| Script Command | Target Database |
|---|---|
| `npm run dev` | **Local** SQLite file |
| `npm run admin:grant` (`--env dev`) | **Remote** Cloudflare D1 |
| `npm run database:reset:local` | **Local** SQLite file |
| `npm run database:reset:dev` | **Remote** Cloudflare D1 |

## Setting Up Local Admin Access

### The Easy Way (Recommended)

**Stop your dev server**, then run:

```powershell
npm run database:reset:local
```

This will:
1. Backup your current local database
2. Delete the local SQLite files
3. Apply all migrations
4. **Automatically create an admin user** (steven@abluestar.com)

Then restart your dev server:

```powershell
npm run dev
```

### Admin User Details

The local reset script creates:
- **Email**: `steven@abluestar.com`
- **UUID**: `3db6be1e-0adb-44f5-862c-028987727018`
- **Role**: `admin`
- **Status**: `active`

Your browser stores this UUID in localStorage under the key `user-token`. The admin panel will appear automatically when this token is detected.

## Troubleshooting

### "Admin panel still not showing"

1. **Clear browser localStorage**:
   ```javascript
   // In browser console (F12)
   localStorage.removeItem('user-token');
   location.reload();
   ```

2. **Verify dev server is using local database**:
   - Stop dev server completely (Ctrl+C)
   - Run `npm run database:reset:local`
   - Restart `npm run dev`
   - Refresh browser

### "Database file locked" or "EPERM" error

This means the dev server is still running and has the SQLite file open:
- Stop the dev server first (Ctrl+C in the terminal running `npm run dev`)
- Run the database reset
- Restart the dev server

### "User created but no admin role"

The reset script should create both the user AND the admin role. If somehow you have a user but no admin privileges:

```powershell
# Check what databases exist
ls src/workers/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/

# Nuclear option: delete everything and start fresh
npm run database:reset:local --force
```

## Remote Development Database

To grant admin on the **remote** Cloudflare D1 development database (not your local one):

```powershell
npm run admin:grant
```

This is useful when:
- You're deploying to a staging environment
- Multiple developers share the same dev database
- You want to test the full Cloudflare stack

## Quick Reference

```powershell
# Local development (most common)
npm run dev                       # Start local dev server
npm run database:reset:local      # Reset local DB + create admin

# Remote dev database
npm run admin:grant               # Grant admin on remote dev DB
npm run database:reset:dev        # Reset remote dev DB

# Production (be careful!)
npm run admin:grant:prod          # Grant admin on production
npm run database:reset:prod       # Reset production (dangerous!)
```

## Best Practices

1. **Always stop the dev server** before running database operations
2. Use `database:reset:local` for local development
3. Use `admin:grant` (without `:local`) for remote databases
4. Don't confuse `--env dev` (remote) with local development
5. The local database is rebuilt from migrations - data is temporary
