# Testing Guide for Cultural Archiver Worker API

## Overview

This guide explains how to test the Cultural Archiver Worker API endpoints that have been implemented according to the tasks in `tasks/tasks-prd-worker-api-endpoints.md`.

## What's Been Implemented ✅

Based on the tasks file, the following features have been completed:

### ✅ Core Infrastructure (Tasks 1.0-2.0)

- Database utilities with prepared statements
- Spatial utilities for geolocation queries
- Error handling with consistent response formatting
- Authentication middleware with user token support
- Rate limiting middleware using KV storage
- Input validation using Zod schemas

### ✅ API Endpoints (Tasks 3.0-5.0)

- **Submission Endpoints**: `POST /api/logbook`
- **Discovery Endpoints**: `GET /api/artworks/nearby`, `GET /api/artworks/:id`
- **User Management**: `GET /api/me/submissions`, `GET /api/me/profile`
- **Health/Status**: `GET /health`, `GET /api/status`

### ⏳ Pending Implementation (Tasks 6.0-10.0)

- Magic link authentication endpoints
- Photo processing pipeline
- Moderation/review endpoints
- Complete integration testing
- Documentation updates

## Testing Methods

### 1. Unit Tests

Run the unit tests that verify core functionality:

```bash
# Navigate to workers directory
cd src/workers

# Install dependencies (if not already done)
npm install

# Run tests once
npm test -- --run

# Run tests in watch mode
npm test

# Run tests with coverage
npm run test:coverage
```

**Current Test Status**: ✅ 6 tests passing

- Database service functionality
- Basic infrastructure setup

### 2. Local Development Server

Start the development server for manual API testing:

```bash
# From project root
npm run dev

# Or from workers directory
cd src/workers
npm run dev
```

The API will be available at: `http://127.0.0.1:8787`

### 3. Manual API Testing

#### Using the Provided Test Script

Run the JavaScript test script:

```bash
# From project root
node test-api.js
```

This script tests:

- Health check endpoint
- API status endpoint
- Nearby artworks endpoint
- User authentication requirements
- 404 error handling
- Legacy redirects

#### Using Postman/Insomnia

Import the provided collection file: `postman-collection.json`

Key endpoints to test:

**Health & Status**

```
GET /health
GET /api/status
```

**Discovery (requires user token)**

```
GET /api/artworks/nearby?lat=49.2827&lon=-123.1207&radius=1000
GET /api/artworks/{id}
```

**User Management (requires user token)**

```
GET /api/me/submissions
GET /api/me/profile
```

**Submissions (requires user token + form data)**

```
POST /api/logbook
Content-Type: multipart/form-data
Body: lat, lon, notes, tags, photos
```

#### Using cURL

Basic health check:

```bash
curl http://127.0.0.1:8787/health
```

Nearby artworks with user token:

```bash
curl -H "X-User-Token: your-token-here" \
  "http://127.0.0.1:8787/api/artworks/nearby?lat=49.2827&lon=-123.1207&radius=1000"
```

### 4. Database Testing

The database utilities can be tested independently:

```bash
# Run database migration first
npm run migrate

# Then test database operations
cd src/workers
npm test test/database.test.ts
```

## Authentication Testing

Most API endpoints require a user token in the `X-User-Token` header. For testing:

1. **Generate a test token**: Use any UUID generator or `crypto.randomUUID()` in browser console
2. **Add to requests**: Include header `X-User-Token: your-uuid-here`
3. **Rate limiting**: Each token has limits (10 submissions/day, 60 queries/hour)

## Expected Responses

### Successful Responses

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-08-28T...",
    "user_token": "uuid"
  }
}
```

### Error Responses

```json
{
  "error": "Error Type",
  "message": "Human-readable message",
  "details": { ... },
  "timestamp": "2025-08-28T..."
}
```

## Common Test Scenarios

### 1. Rate Limiting

- Make 11 submissions in quick succession → Should get rate limited
- Make 61 queries in quick succession → Should get rate limited

### 2. Input Validation

- Send invalid coordinates → Should get validation error
- Send missing required fields → Should get validation error
- Send files that are too large → Should get validation error

### 3. Spatial Queries

- Test with various coordinates around Vancouver
- Test with edge cases (north pole, international date line)
- Test with different radius values

### 4. User Token Management

- Test without token → Should get authentication error
- Test with invalid token format → Should get validation error
- Test token persistence across requests

## Debugging

### Check Logs

```bash
# Workers logs in development
cd src/workers
npm run dev
# Check terminal output for errors
```

### Database Inspection

```bash
# Run database tests to verify connectivity
npm test test/database.test.ts

# Check migration status
npm run migrate
```

### Environment Variables

Ensure your `.env` file has required variables:

- `D1_DATABASE_ID`
- `KV_SESSIONS_ID`
- `R2_BUCKET_NAME`
- `FRONTEND_URL`

## Next Steps

To complete testing coverage, implement the remaining tasks:

1. **Magic Link Authentication** (Task 6.0)
2. **Photo Processing Pipeline** (Task 7.0)
3. **Moderation Endpoints** (Task 8.0)
4. **Integration Testing** (Task 9.0)

Each of these will require additional test files and testing strategies.

## Test File Locations

- `src/workers/test/setup.test.ts` - Basic infrastructure tests ✅
- `src/workers/test/database.test.ts` - Database utility tests ✅
- `test-api.js` - Manual API testing script ✅
- `postman-collection.json` - API testing collection ✅

## Troubleshooting

**Tests failing?**

- Check TypeScript compilation: `npm run type-check`
- Verify dependencies: `npm install`
- Check environment setup: Database migrations ran successfully

**API not responding?**

- Verify development server is running on port 8787
- Check Cloudflare Workers configuration in `wrangler.toml`
- Ensure database migrations completed successfully

**Rate limiting issues?**

- Wait for rate limit windows to reset
- Use different user tokens for testing
- Check KV namespace configuration
