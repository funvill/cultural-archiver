# Troubleshooting Guide

This guide covers common issues, debugging techniques, and solutions for the Cultural Archiver Worker API.

## Table of Contents

- [API Issues](#api-issues)
- [Database Problems](#database-problems)
- [Migration Issues](#migration-issues)
- [Authentication & Rate Limiting](#authentication--rate-limiting)
- [Consent System Issues](#consent-system-issues)
- [Photo Processing](#photo-processing)
- [Cloudflare Services](#cloudflare-services)
- [Development Environment](#development-environment)
- [Performance Issues](#performance-issues)
- [Deployment Problems](#deployment-problems)

## API Issues

### 500 Internal Server Error

**Symptoms:**

- All API endpoints returning 500 errors
- Worker fails to start or crashes during requests

**Common Causes:**

1. **Environment variables not set**
2. **Database connection issues**
3. **Syntax errors in TypeScript code**
4. **Missing KV/R2 bindings**

**Solutions:**

```bash
# Check worker logs
wrangler tail cultural-archiver-api

# Verify environment variables
wrangler secret list

# Test worker locally
cd src/workers && npm run dev

# Check wrangler.toml configuration
cat wrangler.toml
```

**Check environment variables:**

```bash
# Verify all required environment variables are set
wrangler secret list

# Required secrets for production:
# - DATABASE_ID (D1 database identifier)
# - PHOTOS_BUCKET (R2 bucket name)
# - SESSIONS_KV (KV namespace for sessions)
# - RATE_LIMITS_KV (KV namespace for rate limiting)
# - MAGIC_LINKS_KV (KV namespace for magic links)
# - CACHE_KV (KV namespace for caching)

# Check wrangler.toml bindings match your Cloudflare resources
```

### 404 Not Found Errors

**Symptoms:**

- Specific API endpoints returning 404
- Frontend routes not working

**Common Causes:**

1. **Endpoint not defined in worker routes**
2. **Frontend SPA routing misconfigured**
3. **Cloudflare routing issues**

**Solutions:**

```bash
# Check if endpoint exists in current codebase
grep -r "app\.(get|post|put|delete)" src/workers/index.ts

# Test specific endpoint locally
curl -X GET http://localhost:8787/api/status
curl -X GET http://localhost:8787/health

# Check frontend SPA routing in wrangler.jsonc
cat src/frontend/wrangler.jsonc
```

**Current API endpoints that should work:**

- `GET /health` - Health check
- `GET /api/status` - API status with authentication
- `POST /api/logbook` - Submit photo/artwork
- `GET /api/artworks/nearby` - Find nearby artworks
- `GET /api/me/profile` - User profile
- `POST /api/auth/request-magic-link` - Request authentication
- `GET /api/review/queue` - Moderation queue (admin/moderator only)

```typescript
// Add to worker for debugging
console.log('Environment check:', {
  hasD1: !!env.DB,
  hasKV: !!env.RATE_LIMITS,
  hasR2: !!env.PHOTOS,
  environment: env.ENVIRONMENT,
});
```

### 404 Not Found for API Endpoints

**Symptoms:**

- Specific endpoints return 404
- Routes seem to be missing

**Common Causes:**

1. **Route not registered in main index.ts**
2. **Incorrect path patterns**
3. **Middleware blocking requests**

**Solutions:**

```typescript
// Verify route registration in src/workers/index.ts
app.route('/api/submissions', submissionRoutes); // Unified submissions endpoint
app.route('/api/logbook', submissionRoutes); // Legacy compatibility
app.route('/api/artworks', discoveryRoutes);
app.route('/api/me', userRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/review', reviewRoutes);

// Add debug middleware to log all requests
app.use('*', async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
});
```

### CORS Issues

**Symptoms:**

- Browser requests blocked with CORS errors
- Frontend can't access API

**Solutions:**

```typescript
// Add CORS middleware in index.ts
import { cors } from 'hono/cors';

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'https://cultural-archiver.pages.dev'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);
```

## Database Problems

### Connection Errors

**Symptoms:**

- Database queries failing with connection errors
- "Database is locked" errors

**Solutions:**

```bash
# Check D1 database status
wrangler d1 info cultural-archiver-db

# Test database connection
wrangler d1 execute cultural-archiver-db --command="SELECT 1"

# Reset local database
rm -rf .wrangler/state
wrangler d1 execute cultural-archiver-db --local --file=../../migrations/002_mvp_schema.sql
```

### SQL Syntax Errors

**Common Issues:**

```sql
-- ❌ Wrong: Using unsupported SQLite features
SELECT artwork.*, ROW_NUMBER() OVER (ORDER BY id) as row_num FROM artwork;

-- ✅ Correct: Use supported SQLite syntax
SELECT artwork.* FROM artwork ORDER BY id LIMIT 20 OFFSET 0;
```

**Debug SQL queries:**

```typescript
// Add query logging in database.ts
const executeQuery = async (env: Env, query: string, params: any[] = []) => {
  console.log('Executing query:', query, 'with params:', params);
  try {
    const result = await env.DB.prepare(query)
      .bind(...params)
      .all();
    console.log('Query result:', result);
    return result;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};
```

### Missing Tables or Columns

**Symptoms:**

- "Table doesn't exist" errors
- "No such column" errors

**Solutions:**

```bash
# Check database schema using new migration system
npm run migrate:status

# Re-run migrations using migration system
npm run migrate:dev     # Development environment
npm run migrate:prod    # Production environment (use with caution)

# Validate migrations for D1 compatibility
npm run migrate:validate

# Check database structure via Wrangler
cd src/workers
npx wrangler d1 execute cultural-archiver --command=".schema" --env development
```

## Migration Issues

### SQLITE_AUTH Errors During Migration

**Symptoms:**

- Migration fails with `SQLITE_AUTH` error
- Error messages about unauthorized operations
- Migration appears to hang or fail silently

**Common Causes:**

1. **D1-incompatible SQL patterns** in migration files
2. **PRAGMA statements** not supported in D1
3. **Complex CHECK constraints** using unsupported functions
4. **WITHOUT ROWID tables** or **AUTOINCREMENT** usage

**Solutions:**

```bash
# Validate all migrations for D1 compatibility
npm run migrate:validate

# Check specific migration file for issues
npx tsx scripts/validate-migration.ts migrations/0003_problematic_migration.sql

# Fix common D1 compatibility issues:
# - Remove PRAGMA statements
# - Replace AUTOINCREMENT with UUIDs
# - Simplify CHECK constraints
# - Remove WITHOUT ROWID modifiers
```

### Migration State Mismatch

**Symptoms:**

- Migrations report different state than expected
- "Migration already applied" errors when migration seems missing
- Inconsistent state between development and production

**Diagnosis:**

```bash
# Check migration status in both environments
npm run migrate:status      # Development
npm run migrate:status:prod # Production

# Compare migration file lists
ls -la migrations/

# Check Wrangler authentication
cd src/workers && npx wrangler whoami
```

**Solutions:**

```bash
# Re-authenticate with Wrangler if needed
npx wrangler login

# Verify wrangler.toml configuration
cd src/workers && cat wrangler.toml

# Manual state reconciliation (use with caution)
cd src/workers
npx wrangler d1 migrations list cultural-archiver --env development
npx wrangler d1 migrations list cultural-archiver --env production
```

### Failed Migration Recovery

**Symptoms:**

- Migration fails partway through execution
- Database left in inconsistent state
- Subsequent migrations won't run

**Recovery Steps:**

```bash
# 1. Take immediate backup
npm run backup:dev  # or backup:remote for production

# 2. Check migration status
npm run migrate:status

# 3. Identify the failed migration
# Look for partial application or error logs

# 4. Fix the problematic migration file
# Edit the SQL to address D1 compatibility issues

# 5. Try to rollback if possible (development only)
npm run migrate:rollback

# 6. Re-apply corrected migration
npm run migrate:dev
```

**For production recovery:**

1. **DO NOT attempt rollback without full backup**
2. **Test recovery procedure in development first**
3. **Consider manual database repair if needed**
4. **Document all recovery steps taken**

### Migration Validation Errors

**Common D1 Validation Issues:**

**PRAGMA Statements**

```sql
-- ❌ This will fail validation
PRAGMA foreign_keys = ON;

-- ✅ Remove PRAGMA statements - D1 handles these automatically
-- (No replacement needed)
```

**AUTOINCREMENT Usage**

```sql
-- ❌ Not supported in D1
CREATE TABLE example (
    id INTEGER PRIMARY KEY AUTOINCREMENT
);

-- ✅ Use UUIDs instead
CREATE TABLE example (
    id TEXT PRIMARY KEY  -- Generate UUID in application
);
```

**Complex CHECK Constraints**

```sql
-- ❌ Functions in CHECK may not work
CHECK (length(email) > 0 AND email LIKE '%@%')

-- ✅ Use simple checks
CHECK (email != '')
```

**WITHOUT ROWID Tables**

```sql
-- ❌ Not supported in D1
CREATE TABLE cache (key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID;

-- ✅ Standard table structure
CREATE TABLE cache (key TEXT PRIMARY KEY, value TEXT);
```

### Wrangler CLI Issues

**Command Not Found**

```bash
# Install Wrangler globally
npm install -g wrangler

# Or use npx for project-local version
npx wrangler --version

# Check PATH if global install doesn't work
echo $PATH
which wrangler
```

**Authentication Problems**

```bash
# Login to Wrangler
npx wrangler login

# Verify authentication
npx wrangler whoami

# Check API token permissions (if using token)
# Ensure token has D1:Edit permissions
```

**Configuration Issues**

```bash
# Verify wrangler.toml exists and is valid
cd src/workers
cat wrangler.toml

# Check database binding configuration
npx wrangler d1 list

# Validate environment configuration
npx wrangler d1 migrations list cultural-archiver --env development
```

### Migration Performance Issues

**Slow Migration Execution**

- Large migrations may timeout in Wrangler
- Network latency affecting remote operations
- Complex queries taking too long

**Solutions:**

```bash
# Break large migrations into smaller chunks
# Use batch operations for data migrations
# Consider separate data migration scripts for complex transformations

# Monitor migration progress
WRANGLER_LOG=debug npm run migrate:dev

# Check D1 database size and limits
cd src/workers && npx wrangler d1 info cultural-archiver
```

### Emergency Migration Recovery

**When migrations are completely broken:**

1. **Take full backup immediately**
2. **Document current database state**
3. **Identify last known good migration**
4. **Plan recovery strategy**
5. **Test recovery in development first**

**Recovery Commands:**

```bash
# Create emergency backup
npm run backup:validate  # Check existing backups first
npm run backup:remote    # Create new backup

# Export current schema for analysis
cd src/workers
npx wrangler d1 export cultural-archiver --env production > emergency-schema.sql

# Compare with expected schema from migration files
# Plan manual reconciliation if needed
```

## Authentication & Rate Limiting

### Invalid Authentication Tokens

**Symptoms:**

- 401 Unauthorized responses
- "Invalid token" errors

**Debug authentication:**

```typescript
// Add token validation logging
const validateUserToken = (token: string) => {
  console.log('Validating token:', token);

  if (!token) {
    console.log('No token provided');
    return false;
  }

  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
  console.log('Token format valid:', isValidUUID);

  return isValidUUID;
};
```

### Rate Limiting Not Working

**Symptoms:**

- Rate limits not enforced
- Users can exceed limits

**Debug rate limiting:**

```bash
# Check KV namespace
wrangler kv:key list --binding=RATE_LIMITS

# Get specific rate limit data
wrangler kv:key get "rate:submit:test-token:2024-01-15" --binding=RATE_LIMITS

# Clear rate limits for testing
wrangler kv:key delete "rate:submit:test-token:2024-01-15" --binding=RATE_LIMITS
```

### Magic Link Email Issues

**Symptoms:**

- Magic link emails not sent
- Email links not working

**Debug email system:**

```typescript
// Check email configuration in development
if (env.ENVIRONMENT === 'development') {
  console.log('Magic link (dev mode):', `${env.MAGIC_LINK_BASE_URL}/auth/verify?token=${token}`);
  // Email will be logged to console instead of sent
}

// Verify email service configuration
console.log('Email config:', {
  hasApiKey: !!env.EMAIL_API_KEY,
  fromAddress: env.EMAIL_FROM,
  baseUrl: env.MAGIC_LINK_BASE_URL,
});
```

## Photo Processing

### Upload Failures

**Symptoms:**

- Photo uploads return errors
- Files not appearing in R2 bucket

**Debug photo uploads:**

```typescript
// Add detailed logging in photo processing
const uploadPhotoToR2 = async (file: File, env: Env) => {
  console.log('Processing file:', {
    name: file.name,
    size: file.size,
    type: file.type,
  });

  try {
    const buffer = await file.arrayBuffer();
    console.log('File buffer size:', buffer.byteLength);

    const key = generatePhotoKey();
    console.log('Upload key:', key);

    const result = await env.PHOTOS.put(key, buffer);
    console.log('Upload result:', result);

    return result;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
```

### File Type Validation Issues

**Common Problems:**

```typescript
// ❌ Wrong: Only checking file extension
const isValidImage = (filename: string) => {
  return filename.endsWith('.jpg') || filename.endsWith('.png');
};

// ✅ Correct: Check MIME type and magic numbers
const isValidImage = (file: File) => {
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  return supportedTypes.includes(file.type);
};
```

### R2 Storage Issues

**Check R2 bucket access:**

```bash
# List R2 buckets
wrangler r2 bucket list

# Check bucket permissions
wrangler r2 bucket get cultural-archiver-photos

# Test file upload
echo "test content" | wrangler r2 object put cultural-archiver-photos test.txt

# List uploaded files
wrangler r2 object list cultural-archiver-photos --prefix="submissions/"
```

## Consent System Issues

### Missing Consent Records for Approved Artworks

**Symptoms:**

- Artworks exist in database but no corresponding consent records
- Approved artworks from submissions missing consent

**Cause:**

The approval process wasn't creating artwork consent records when converting submissions to artworks.

**Solution:**

Fixed in `review.ts` - the approval process now creates artwork consent records:

```typescript
// Enhanced approval process creates artwork consent
const artworkConsentRecord = await recordConsent({
  userId: userToken && userToken.length > 36 ? userToken : undefined,
  anonymousToken: userToken && userToken.length <= 36 ? userToken : undefined,
  contentType: 'artwork',
  contentId: artworkId,
  consentVersion: CONSENT_VERSION,
  ipAddress: clientIP,
  consentTextHash: artworkConsentTextHash,
  db: c.env.DB,
});
```

### Submission Failures with Consent Errors

**Symptoms:**

- "Either userId or anonymousToken must be provided" errors
- Fast artwork submissions failing completely

**Cause:**

Missing `ensureUserToken` middleware on submission routes causing empty user tokens.

**Solution:**

Add `ensureUserToken` middleware to all submission routes:

```typescript
// Fixed middleware order in index.ts
app.use('/api/artworks/fast', ensureUserToken);
app.use('/api/artworks/fast', addUserTokenToResponse);
app.use('/api/artworks/fast', handleFastPhotoUpload);
```

### Double-Hashed Consent Text

**Symptoms:**

- Different consent_text_hash values for same consent text
- Hash verification failures

**Cause:**

The `recordConsent()` function was re-hashing already-hashed consent text.

**Solution:**

Use pre-computed hash directly in database storage:

```typescript
// Fixed - use the already-computed hash directly
await db
  .prepare(insertQuery)
  .bind(
    consentId,
    now,
    userId || null,
    anonymousToken || null,
    consentVersion,
    contentType,
    contentId,
    ipAddress,
    consentTextHash // Use the already-hashed value directly
  )
  .run();
```

### Debug Consent Issues

**Check consent for specific content:**

```sql
SELECT * FROM consent
WHERE content_type = 'artwork'
AND content_id = 'your-artwork-id-here';
```

**Verify consent hash generation:**

```javascript
const crypto = require('crypto');
const text = 'Cultural Archiver Consent v2025-09-09.v2 - Artwork Submission';
const hash = await crypto.webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
console.log(
  Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
);
```

**Monitor consent creation patterns:**

```sql
SELECT
  content_type,
  consent_version,
  COUNT(*) as consent_count,
  DATE(created_at) as consent_date
FROM consent
GROUP BY content_type, consent_version, DATE(created_at)
ORDER BY consent_date DESC;
```

**See Also:** [Consent System Documentation](./consent-system.md) for detailed implementation guide.

## Cloudflare Services

### KV Namespace Issues

**Symptoms:**

- KV operations failing
- Rate limiting not working

**Debug KV issues:**

```bash
# Check KV namespace bindings
wrangler kv:namespace list

# Verify namespace ID in wrangler.toml
grep -A 5 "kv_namespaces" wrangler.toml

# Test KV operations
wrangler kv:key put "test-key" "test-value" --binding=RATE_LIMITS
wrangler kv:key get "test-key" --binding=RATE_LIMITS
```

### D1 Database Issues

**Common Problems:**

```bash
# Database not found
wrangler d1 list

# Wrong database ID in wrangler.toml
wrangler d1 info your-database-name

# Migration issues
wrangler d1 execute your-database-name --file=migrations/002_mvp_schema.sql --remote
```

### R2 Bucket Configuration

**Check bucket setup:**

```bash
# Verify bucket exists
wrangler r2 bucket list

# Check bucket configuration
wrangler r2 bucket get cultural-archiver-photos

# Test bucket access
echo "test" | wrangler r2 object put cultural-archiver-photos test.txt --content-type="text/plain"
```

## Development Environment

### Wrangler Development Issues

**Common Problems:**

```bash
# Wrangler not starting
npm install -g wrangler@latest
wrangler --version

# Port conflicts
wrangler dev --port 8788

# Environment variable issues
cp .dev.vars.example .dev.vars
# Edit .dev.vars with correct values
```

### TypeScript Compilation Errors

**Fix common TypeScript issues:**

```bash
# Check TypeScript configuration
npx tsc --noEmit

# Install missing types
npm install --save-dev @types/node @cloudflare/workers-types

# Fix import issues
npm install hono @hono/node-server
```

### Node.js Version Issues

**Ensure correct Node.js version:**

```bash
# Check Node.js version (require 18+)
node --version

# Update Node.js if needed
nvm install 18
nvm use 18

# Clear npm cache if having install issues
npm cache clean --force
```

## Performance Issues

### Slow API Responses

**Debug performance:**

```typescript
// Add timing middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`${c.req.method} ${c.req.url} - ${duration}ms`);

  if (duration > 1000) {
    console.warn('Slow request detected:', {
      method: c.req.method,
      url: c.req.url,
      duration: `${duration}ms`,
    });
  }
});
```

### Database Query Performance

**Optimize spatial queries:**

```sql
-- ❌ Slow: No spatial indexing
SELECT * FROM artwork WHERE
  ABS(lat - 49.2827) < 0.01 AND
  ABS(lon - (-123.1207)) < 0.01;

-- ✅ Fast: Use bounding box with indexes
SELECT * FROM artwork WHERE
  lat BETWEEN 49.2727 AND 49.2927 AND
  lon BETWEEN -123.1307 AND -123.1107;
```

### Memory Usage Issues

**Monitor worker memory:**

```typescript
// Add memory monitoring
const logMemoryUsage = () => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memory = process.memoryUsage();
    console.log('Memory usage:', {
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
    });
  }
};
```

## Deployment Problems

### Build Failures

**Common build issues:**

```bash
# TypeScript compilation errors
npm run type-check

# ESLint errors
npm run lint

# Missing dependencies
npm install

# Clear build cache
rm -rf dist/ node_modules/
npm install
npm run build
```

### Wrangler Deployment Issues

**Debug deployment:**

```bash
# Check authentication
wrangler whoami

# Verify account and zone settings
wrangler deploy --dry-run

# Check deployment logs
wrangler tail cultural-archiver-api --format=pretty

# Deploy with verbose logging
wrangler deploy --compatibility-date=2024-01-15 --verbose
```

### Environment Variable Problems

**Verify secrets in production:**

```bash
# List all secrets
wrangler secret list

# Update secret value
wrangler secret put EMAIL_API_KEY

# Delete incorrect secret
wrangler secret delete WRONG_SECRET_NAME
```

## Monitoring and Logging

### Enable Comprehensive Logging

```typescript
// Production logging setup
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data ? JSON.stringify(data) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error instanceof Error ? error.stack : error);
  },
};

// Use throughout application
logger.info('Processing submission', {
  userId: userToken,
  coordinates: { lat, lon },
});
```

### Health Check Endpoint

```typescript
// Add health check for monitoring
app.get('/health', async c => {
  const checks = {
    database: false,
    kv: false,
    r2: false,
  };

  try {
    // Test database
    await c.env.DB.prepare('SELECT 1').first();
    checks.database = true;
  } catch (error) {
    logger.error('Database health check failed', error);
  }

  try {
    // Test KV
    await c.env.RATE_LIMITS.get('health-check');
    checks.kv = true;
  } catch (error) {
    logger.error('KV health check failed', error);
  }

  try {
    // Test R2
    await c.env.PHOTOS.head('health-check.txt');
    checks.r2 = true;
  } catch (error) {
    logger.error('R2 health check failed', error);
  }

  const allHealthy = Object.values(checks).every(check => check);

  return c.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    allHealthy ? 200 : 503
  );
});
```

## Getting Help

### Community Resources

1. **Cloudflare Workers Discord**: Real-time help from community
2. **GitHub Issues**: Report bugs and request features
3. **Cloudflare Documentation**: Official guides and references

### Debug Information to Include

When reporting issues, include:

```bash
# System information
node --version
npm --version
wrangler --version

# Project configuration
cat package.json | grep -A 10 -B 2 "dependencies"
cat wrangler.toml

# Error logs
wrangler tail cultural-archiver-api --format=json | tail -20

# Database schema
wrangler d1 execute cultural-archiver-db --command=".schema" --local
```

### Performance Monitoring

```typescript
// Add to production deployment
const performanceMonitor = {
  requests: 0,
  errors: 0,
  totalDuration: 0,
  slowRequests: 0,

  record(duration: number, success: boolean) {
    this.requests++;
    this.totalDuration += duration;

    if (!success) this.errors++;
    if (duration > 1000) this.slowRequests++;
  },

  getStats() {
    return {
      requests: this.requests,
      errors: this.errors,
      errorRate: this.requests > 0 ? (this.errors / this.requests) * 100 : 0,
      avgDuration: this.requests > 0 ? this.totalDuration / this.requests : 0,
      slowRequests: this.slowRequests,
    };
  },
};
```

This troubleshooting guide should help you identify and resolve most common issues with the Cultural Archiver Worker API. For issues not covered here, check the logs first, then consult the specific service documentation (Cloudflare Workers, D1, KV, R2) for more detailed debugging information.
