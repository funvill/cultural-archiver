# Production Deployment Fix Guide

## Problem Diagnosis

The production API at `https://art-api.abluestar.com` is returning "Hello World!" instead of proper API responses. This indicates a **deployment configuration issue**, not a code issue.

## Root Cause

The production environment in `wrangler.toml` has placeholder values for critical Cloudflare bindings:
- D1 Database ID: `PLACEHOLDER_PROD_DB_ID`
- KV Namespace IDs: `PLACEHOLDER_PROD_*_ID`
- Missing actual resource configurations

## Solution Steps

### 1. Verify Current Configuration

```bash
# Check current configuration issues
node verify-deployment.js production
```

### 2. Create Production Resources in Cloudflare Dashboard

#### D1 Database:
1. Go to Cloudflare Dashboard > D1
2. Create database named `cultural-archiver-prod`
3. Copy the Database ID
4. Run migrations using the migration system: `npm run migrate:prod`

#### KV Namespaces:
1. Go to Cloudflare Dashboard > KV
2. Create namespaces:
   - `cultural-archiver-sessions-prod`
   - `cultural-archiver-cache-prod`
   - `cultural-archiver-rate-limits-prod`
   - `cultural-archiver-magic-links-prod`
3. Copy each namespace ID

#### R2 Bucket:
1. Go to Cloudflare Dashboard > R2
2. Verify bucket `cultural-archiver-photos` exists
3. Ensure it's in the correct account

### 3. Update wrangler.toml

Replace placeholder values in `src/workers/wrangler.toml`:

```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "cultural-archiver-prod"
database_id = "ACTUAL_DATABASE_ID_HERE"  # Replace with real ID

[[env.production.kv_namespaces]]
binding = "SESSIONS"
id = "ACTUAL_SESSIONS_KV_ID_HERE"  # Replace with real ID

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "ACTUAL_CACHE_KV_ID_HERE"  # Replace with real ID

[[env.production.kv_namespaces]]
binding = "RATE_LIMITS"
id = "ACTUAL_RATE_LIMITS_KV_ID_HERE"  # Replace with real ID

[[env.production.kv_namespaces]]
binding = "MAGIC_LINKS"
id = "ACTUAL_MAGIC_LINKS_KV_ID_HERE"  # Replace with real ID
```

### 4. Deploy with Correct Configuration

```bash
cd src/workers
wrangler deploy --env production
```

### 5. Verify Custom Domain Configuration

1. Go to Cloudflare Dashboard > Workers & Pages
2. Find worker: `cultural-archiver-workers-prod`
3. Check Custom Domains tab
4. Ensure `art-api.abluestar.com` points to this worker
5. If not, add the custom domain

### 6. Test Deployment

```bash
# Should now return proper API responses instead of "Hello World!"
node debug-deployment.js https://art-api.abluestar.com
```

## Quick Fix Commands

```bash
# 1. Verify configuration
node verify-deployment.js production

# 2. Deploy (after fixing wrangler.toml)
cd src/workers && wrangler deploy --env production

# 3. Test deployment
node debug-deployment.js https://art-api.abluestar.com
```

## Common Issues

### "Hello World!" Response
- **Cause**: Wrong worker deployed or missing bindings
- **Fix**: Verify custom domain points to correct worker name

### 500 Errors with Missing Bindings Message
- **Cause**: Worker deployed but resource IDs are placeholders
- **Fix**: Update wrangler.toml with actual resource IDs

### 404 on All Endpoints
- **Cause**: Worker not deployed or routing issue
- **Fix**: Redeploy worker and check domain configuration

## Verification

After deployment, the health endpoint should return:
```json
{
  "status": "healthy",
  "environment": {
    "environment": "production",
    "version": "1.0.0"
  },
  "summary": {
    "healthy_checks": "10/10",
    "overall_health": "10/10 checks passing"
  }
}
```

## Contact

If issues persist after following this guide, check:
1. Cloudflare Dashboard for worker deployment status
2. Worker logs: `wrangler tail --name cultural-archiver-workers-prod`
3. Custom domain configuration in Cloudflare Dashboard