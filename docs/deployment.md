# Cultural Archiver Deployment Guide

This guide covers deploying the Cultural Archiver Worker API to Cloudflare Workers, along with setting up the required Cloudflare services (D1, KV, R2).

## Prerequisites

- Cloudflare account with Workers plan
- Wrangler CLI installed and authenticated
- Node.js 18+ and npm
- Git repository access

## Overview

The Cultural Archiver API requires the following Cloudflare services:

- **Cloudflare Workers**: API runtime
- **D1 Database**: SQLite-compatible database for artwork and submissions
- **KV Storage**: Rate limiting, sessions, and magic links
- **R2 Storage**: Photo uploads and static assets

## Initial Setup

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. Clone and Setup Repository

```bash
git clone https://github.com/funvill/cultural-archiver.git
cd cultural-archiver
npm install
cd src/workers
npm install
```

### 3. Configure Wrangler

Update `src/workers/wrangler.toml` with your Cloudflare account details:

```toml
name = "cultural-archiver-api"
main = "index.ts"
compatibility_date = "2024-01-15"
compatibility_flags = ["nodejs_compat"]

[env.production]
name = "cultural-archiver-api"

[env.staging]
name = "cultural-archiver-api-staging"

# Variables will be set via CLI
[vars]
ENVIRONMENT = "production"
FRONTEND_URL = "https://art.abluestar.com"
LOG_LEVEL = "info"
```

## Database Setup (D1)

### 1. Create D1 Database

```bash
# Production
wrangler d1 create cultural-archiver-db

# Staging (optional)
wrangler d1 create cultural-archiver-db-staging
```

### 2. Update wrangler.toml

Add the database binding to your `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cultural-archiver-db"
database_id = "your-database-id-from-step-1"
```

### 3. Run Migrations

```bash
# Apply database schema
wrangler d1 execute cultural-archiver-db --file=../../migrations/002_mvp_schema.sql

# Verify schema
wrangler d1 execute cultural-archiver-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 4. Load Sample Data (Optional)

```bash
# Load sample artwork types and data
wrangler d1 execute cultural-archiver-db --file=../../migrations/sample_data.sql
```

## KV Storage Setup

### 1. Create KV Namespaces

```bash
# Production namespaces
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "RATE_LIMITS"
wrangler kv:namespace create "MAGIC_LINKS"

# Staging namespaces (optional)
wrangler kv:namespace create "SESSIONS" --preview
wrangler kv:namespace create "RATE_LIMITS" --preview
wrangler kv:namespace create "MAGIC_LINKS" --preview
```

### 2. Update wrangler.toml

Add KV bindings:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-sessions-namespace-id"

[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "your-rate-limits-namespace-id"

[[kv_namespaces]]
binding = "MAGIC_LINKS"
id = "your-magic-links-namespace-id"
```

## R2 Storage Setup

### 1. Create R2 Bucket

```bash
# Create bucket for photos
wrangler r2 bucket create cultural-archiver-photos

# Optional: Create staging bucket
wrangler r2 bucket create cultural-archiver-photos-staging
```

### 2. Configure CORS (Optional)

Create `cors.json`:

```json
[
  {
    "AllowedOrigins": ["https://art.abluestar.com", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Apply CORS:

```bash
wrangler r2 bucket cors put cultural-archiver-photos --config cors.json
```

### 3. Update wrangler.toml

Add R2 binding:

```toml
[[r2_buckets]]
binding = "PHOTOS_BUCKET"
bucket_name = "cultural-archiver-photos"
```

## Environment Variables and Secrets

### 1. Set Environment Variables

```bash
# Production
wrangler secret put SMTP_API_KEY --name cultural-archiver-api
wrangler secret put JWT_SECRET --name cultural-archiver-api

# Set public variables
wrangler secret put ENVIRONMENT --name cultural-archiver-api
# Enter: production

wrangler secret put FRONTEND_URL --name cultural-archiver-api
# Enter: https://art.abluestar.com

wrangler secret put LOG_LEVEL --name cultural-archiver-api
# Enter: info
```

### 2. Optional: Email Service Setup

If using external email service for magic links:

```bash
wrangler secret put EMAIL_SERVICE_API_KEY --name cultural-archiver-api
wrangler secret put EMAIL_FROM_ADDRESS --name cultural-archiver-api
```

## Build and Deploy

### 1. Build the Worker

```bash
cd src/workers
npm run build
```

### 2. Deploy to Staging (Optional)

```bash
wrangler deploy --env staging
```

Test the staging deployment:

```bash
curl https://cultural-archiver-api-staging.your-subdomain.workers.dev/api/artworks/nearby?lat=49.2827&lon=-123.1207
```

### 3. Deploy to Production

```bash
wrangler deploy --env production
```

### 4. Verify Deployment

```bash
# Test API health
curl https://cultural-archiver-api.your-subdomain.workers.dev/api/artworks/nearby?lat=49.2827&lon=-123.1207

# Test database connectivity
curl https://cultural-archiver-api.your-subdomain.workers.dev/api/review/stats
```

## Custom Domain Setup (Optional)

### 1. Add Custom Domain

In Cloudflare Dashboard:

1. Go to Workers & Pages
2. Select your worker
3. Go to Custom Domains
4. Add `art-api.abluestar.com`

### 2. Update DNS

Add CNAME record:

```
art-api.abluestar.com -> cultural-archiver-api.your-subdomain.workers.dev
```

### 3. Update Frontend Configuration

Update your frontend to use the custom domain:

```javascript
const API_BASE_URL = 'https://art-api.abluestar.com';
```

## Monitoring and Logging

### 1. Enable Workers Analytics

In Cloudflare Dashboard:

1. Go to Workers & Pages
2. Select your worker
3. Enable Analytics

### 2. Set Up Alerts

Configure alerts for:

- High error rates (>5%)
- Response time anomalies
- CPU/memory usage spikes

### 3. Log Monitoring

Use `wrangler tail` for real-time logs:

```bash
wrangler tail --name cultural-archiver-api
```

## Maintenance and Updates

### 1. Database Migrations

For schema updates:

```bash
# Create migration file
touch migrations/003_new_feature.sql

# Apply migration
wrangler d1 execute cultural-archiver-db --file=migrations/003_new_feature.sql
```

### 2. Zero-Downtime Deployments

```bash
# Deploy with gradual rollout
wrangler deploy --env production --compatibility-date 2024-01-15
```

### 3. Rollback Strategy

```bash
# Rollback to previous version
wrangler rollback --name cultural-archiver-api
```

## Backup and Recovery

### 1. Database Backups

```bash
# Export database
wrangler d1 export cultural-archiver-db --output backup.sql

# Schedule regular backups (add to CI/CD)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
wrangler d1 export cultural-archiver-db --output "backups/db_backup_$DATE.sql"
```

### 2. KV Namespace Backups

```bash
# List all keys
wrangler kv:key list --namespace-id your-sessions-namespace-id > sessions_keys.json

# Backup values (script needed for bulk export)
node backup-kv.js
```

### 3. R2 Bucket Backups

```bash
# Use rclone or similar tool for R2 backups
rclone sync cultural-archiver-photos: ./photo-backups/
```

## Performance Optimization

### 1. Worker Configuration

Optimize `wrangler.toml`:

```toml
[env.production]
compatibility_date = "2024-01-15"
usage_model = "bundled"  # or "unbound" for heavy workloads

[build]
command = "npm run build"
```

### 2. Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_artwork_location ON artwork(lat, lon);
CREATE INDEX idx_artwork_status ON artwork(status);
CREATE INDEX idx_logbook_user ON logbook(user_token);
CREATE INDEX idx_logbook_created ON logbook(created_at);
```

### 3. Caching Strategy

```javascript
// Cache static responses
const cache = caches.default;
const cacheKey = new Request(url.toString(), request);
const cachedResponse = await cache.match(cacheKey);

if (cachedResponse) {
  return cachedResponse;
}
```

## Security Considerations

### 1. Rate Limiting

Ensure rate limits are properly configured:

```javascript
// Implement progressive rate limiting
const limits = {
  submissions: { daily: 10, burst: 3 },
  queries: { hourly: 60, burst: 10 },
};
```

### 2. Input Validation

Always validate user inputs:

```javascript
// Coordinate validation
if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
  throw new ValidationError('Invalid coordinates');
}
```

### 3. Photo Security

Implement secure photo handling:

```javascript
// Validate file types
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
if (!allowedTypes.includes(file.type)) {
  throw new ValidationError('Invalid file type');
}
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**

   ```bash
   # Check D1 binding
   wrangler d1 info cultural-archiver-db
   ```

2. **KV Namespace Issues**

   ```bash
   # List namespaces
   wrangler kv:namespace list
   ```

3. **R2 Access Issues**

   ```bash
   # Test R2 access
   wrangler r2 bucket list
   ```

4. **Worker CPU/Memory Limits**
   - Monitor usage in Cloudflare Dashboard
   - Optimize heavy operations
   - Consider splitting into multiple workers

### Debug Mode

Enable debug logging:

```bash
wrangler secret put LOG_LEVEL --name cultural-archiver-api
# Enter: debug
```

### Performance Issues

```bash
# Monitor worker performance
wrangler tail --name cultural-archiver-api --format pretty
```

## Cost Management

### 1. Monitor Usage

- Workers: 100,000 requests/day free
- D1: 100,000 reads/day free, 50,000 writes/day free
- KV: 100,000 reads/day free, 1,000 writes/day free
- R2: 10GB storage free

### 2. Optimize Costs

- Use appropriate worker plan
- Implement efficient caching
- Optimize database queries
- Clean up unused KV keys
- Implement photo cleanup for rejected submissions

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          npm install
          cd src/workers && npm install

      - name: Run tests
        run: cd src/workers && npm test

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: 'src/workers'
          command: deploy --env production
```

This deployment guide provides a comprehensive setup process for the Cultural Archiver Worker API on Cloudflare's platform.
