# Migration System Archive - 2025-01-08

## Removed NPM Scripts (from package.json)

The following scripts were removed as part of migrating from custom migration system to Wrangler native D1 migrations:

- `migrate`: `npx tsx migrations/migrate.ts`
- `migrate:list`: `npx tsx migrations/migrate.ts list`  
- `migrate:help`: `npx tsx migrations/migrate.ts help`
- `migrate:remote`: `cross-env MIGRATE_REMOTE=true npx tsx migrations/migrate.ts`
- `migrate:up`: `npx tsx migrations/migrate.ts up`

These will be replaced with new Wrangler-based scripts in subsequent commits.

## Archived Files

- `migrations/migrate.ts` → `migrations/archive/custom-system/migrate.ts`
- `migrations/mock-schema.sql` → `migrations/archive/custom-system/mock-schema.sql`  
- `migrations/test-schema.sql` → `migrations/archive/custom-system/test-schema.sql`

See `migrations/archive/custom-system/README.md` for full details.