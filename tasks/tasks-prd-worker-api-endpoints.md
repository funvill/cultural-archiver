# Tasks: Worker API Endpoints (Cloudflare Workers)

## Relevant Files

- `src/workers/index.ts` - Main worker entry point, needs complete refactoring for API endpoints
- `src/workers/routes/submissions.ts` - New file for logbook submission endpoints (POST /api/logbook)
- `src/workers/routes/submissions.test.ts` - Unit tests for submission endpoints
- `src/workers/routes/discovery.ts` - New file for artwork discovery endpoints (GET /api/artworks/nearby, GET /api/artworks/:id)
- `src/workers/routes/discovery.test.ts` - Unit tests for discovery endpoints
- `src/workers/routes/user.ts` - New file for user management endpoints (GET /api/me/submissions)
- `src/workers/routes/user.test.ts` - Unit tests for user management endpoints
- `src/workers/routes/auth.ts` - New file for authentication endpoints (POST /api/auth/magic-link, POST /api/auth/consume)
- `src/workers/routes/auth.test.ts` - Unit tests for authentication endpoints
- `src/workers/routes/review.ts` - New file for moderation endpoints (POST /api/review/approve, POST /api/review/reject)
- `src/workers/routes/review.test.ts` - Unit tests for moderation endpoints
- `src/workers/middleware/auth.ts` - Authentication middleware for user tokens and reviewer permissions
- `src/workers/middleware/auth.test.ts` - Unit tests for authentication middleware
- `src/workers/middleware/rateLimit.ts` - Rate limiting middleware using Cloudflare KV
- `src/workers/middleware/rateLimit.test.ts` - Unit tests for rate limiting middleware
- `src/workers/middleware/validation.ts` - Input validation middleware using Zod schemas
- `src/workers/middleware/validation.test.ts` - Unit tests for validation middleware
- `src/workers/lib/database.ts` - Database query utilities and helpers for D1 operations
- `src/workers/lib/database.test.ts` - Unit tests for database utilities
- `src/workers/lib/photos.ts` - Photo processing utilities for R2 uploads and EXIF handling
- `src/workers/lib/photos.test.ts` - Unit tests for photo processing utilities
- `src/workers/lib/email.ts` - Email utilities for magic link sending via Cloudflare Email Workers
- `src/workers/lib/email.test.ts` - Unit tests for email utilities
- `src/workers/lib/spatial.ts` - Geospatial utilities for bounding box queries and distance calculations
- `src/workers/lib/spatial.test.ts` - Unit tests for spatial utilities
- `src/workers/lib/errors.ts` - Error handling utilities and response formatting
- `src/workers/lib/errors.test.ts` - Unit tests for error handling utilities
- `src/shared/types.ts` - Needs updates for API request/response types and validation schemas
- `src/workers/wrangler.toml` - Needs updates for KV namespaces and environment variables
- `README.md` - Needs updates with API documentation and setup instructions
- `.github/copilot-instructions.md` - Needs updates with new API patterns and worker architecture
- `docs/api.md` - New file for complete API endpoint documentation with examples
- `docs/deployment.md` - New file for Cloudflare Workers, KV, and R2 deployment guide
- `docs/development.md` - New file for local development setup and debugging guide
- `docs/rate-limiting.md` - New file documenting rate limiting configuration and monitoring
- `docs/photo-processing.md` - New file for R2 bucket structure and EXIF handling documentation
- `docs/troubleshooting.md` - New file for common API and infrastructure troubleshooting

### Notes

- Unit tests should be placed in a testing folder
- Use `npm run test` from the workers directory to run tests
- The existing worker has basic routing with Hono but needs complete API implementation
- Database schema is already in place with proper indexes for spatial queries
- Rate limiting will use Cloudflare KV namespaces that need to be configured

## Tasks

- [x] 1.0 Set up Core Infrastructure and Utilities
  - [x] 1.1 Update shared types (`src/shared/types.ts`) with MVP-specific API request/response interfaces
  - [x] 1.2 Create database utilities (`src/workers/lib/database.ts`) with prepared statements for artwork, logbook, and tag operations
  - [x] 1.3 Create spatial utilities (`src/workers/lib/spatial.ts`) for bounding box calculations and coordinate validation
  - [x] 1.4 Create error handling utilities (`src/workers/lib/errors.ts`) with consistent response formatting and progressive disclosure
  - [x] 1.5 Update Cloudflare configuration (`src/workers/wrangler.toml`) with KV namespaces for rate limiting and magic links
  - [x] 1.6 Set up testing infrastructure with Jest configuration for worker environment

- [ ] 2.0 Implement Authentication and Rate Limiting Middleware
  - [ ] 2.1 Create authentication middleware (`src/workers/middleware/auth.ts`) for user token generation and validation
  - [ ] 2.2 Implement reviewer permission checking using database `is_reviewer` flag
  - [ ] 2.3 Create rate limiting middleware (`src/workers/middleware/rateLimit.ts`) using KV counters for per-user-token limits
  - [ ] 2.4 Implement rate limit enforcement (10 submissions/day, 60 queries/hour per user token)
  - [ ] 2.5 Create input validation middleware (`src/workers/middleware/validation.ts`) using Zod schemas
  - [ ] 2.6 Write comprehensive tests for all middleware components

- [ ] 3.0 Implement Submission Endpoints (POST /api/logbook)
  - [ ] 3.1 Create submission route handler (`src/workers/routes/submissions.ts`) with multipart form data support
  - [ ] 3.2 Implement coordinate validation (lat/lon bounds checking)
  - [ ] 3.3 Add photo file validation (type, size limits, max 3 photos per submission)
  - [ ] 3.4 Integrate with photo processing pipeline for immediate upload to R2
  - [ ] 3.5 Create logbook database entry with 'pending' status
  - [ ] 3.6 Implement nearby artwork detection and user confirmation UI logic
  - [ ] 3.7 Add rate limiting integration for submission endpoints
  - [ ] 3.8 Write unit tests for submission validation and database operations

- [ ] 4.0 Implement Discovery Endpoints (GET /api/artworks/nearby, GET /api/artworks/:id)
  - [ ] 4.1 Create discovery route handler (`src/workers/routes/discovery.ts`) with geospatial query support
  - [ ] 4.2 Implement nearby artworks endpoint with bounding box spatial queries
  - [ ] 4.3 Add query parameter validation (lat, lon, radius, limit) with defaults
  - [ ] 4.4 Implement artwork detail endpoint with logbook timeline aggregation
  - [ ] 4.5 Add photo URL inclusion from R2 bucket for approved artwork
  - [ ] 4.6 Implement configurable result limits (default 20, max 100)
  - [ ] 4.7 Add rate limiting integration for discovery endpoints
  - [ ] 4.8 Write unit tests for spatial queries and response formatting

- [ ] 5.0 Implement User Management Endpoints (GET /api/me/submissions)
  - [ ] 5.1 Create user route handler (`src/workers/routes/user.ts`) with token-based user identification
  - [ ] 5.2 Implement user submissions listing with status filtering (exclude rejected)
  - [ ] 5.3 Add pagination support with default limit of 20 items
  - [ ] 5.4 Include submission timestamps and status information
  - [ ] 5.5 Add rate limiting integration for user endpoints
  - [ ] 5.6 Write unit tests for user data retrieval and privacy compliance

- [ ] 6.0 Implement Authentication Endpoints (Magic Links)
  - [ ] 6.1 Create authentication route handler (`src/workers/routes/auth.ts`) for magic link workflow
  - [ ] 6.2 Create email utilities (`src/workers/lib/email.ts`) for Cloudflare Email Workers integration
  - [ ] 6.3 Implement magic link generation with secure tokens and expiration
  - [ ] 6.4 Create simple HTML email template for verification links
  - [ ] 6.5 Implement magic link consumption endpoint with token validation
  - [ ] 6.6 Add email-to-user-token binding in database or KV storage
  - [ ] 6.7 Add token cleanup and invalidation after use
  - [ ] 6.8 Write unit tests for email sending and token validation

- [ ] 7.0 Implement Photo Processing Pipeline
  - [ ] 7.1 Create photo utilities (`src/workers/lib/photos.ts`) for R2 operations and image processing
  - [ ] 7.2 Implement file upload validation (MIME type detection, size checks)
  - [ ] 7.3 Add filename sanitization using timestamp + UUID format
  - [ ] 7.4 Implement image resizing to 800px longest edge while maintaining aspect ratio
  - [ ] 7.5 Add EXIF data preservation and permalink injection in comment field
  - [ ] 7.6 Implement date-based folder structure (YYYY/MM/DD) in R2 storage
  - [ ] 7.7 Add error handling and cleanup for failed uploads
  - [ ] 7.8 Write unit tests for photo processing and R2 operations

- [ ] 8.0 Implement Moderation Endpoints (Review/Approve/Reject)
  - [ ] 8.1 Create review route handler (`src/workers/routes/review.ts`) with reviewer permission enforcement
  - [ ] 8.2 Implement submission approval endpoint with artwork creation/linking logic
  - [ ] 8.3 Add nearby artwork detection for reviewers (within ~100m radius)
  - [ ] 8.4 Implement submission data to artwork data conversion with reviewer overrides
  - [ ] 8.5 Add photo migration from logbook to artwork on approval
  - [ ] 8.6 Implement submission rejection endpoint with R2 cleanup
  - [ ] 8.7 Add audit logging for approval/rejection decisions
  - [ ] 8.8 Write unit tests for moderation workflows and data integrity

- [ ] 9.0 Integration Testing and Error Handling Refinement
  - [ ] 9.1 Refactor main worker entry point (`src/workers/index.ts`) to use new route handlers
  - [ ] 9.2 Add comprehensive error handling with HTTP status codes and user-friendly messages
  - [ ] 9.3 Implement progressive error disclosure (simple message + details option)
  - [ ] 9.4 Set up integration tests for complete API workflows
  - [ ] 9.5 Test rate limiting behavior under various usage patterns
  - [ ] 9.6 Validate photo processing pipeline end-to-end
  - [ ] 9.7 Test moderation workflows with sample data
  - [ ] 9.8 Performance testing for spatial queries and concurrent operations

- [ ] 10.0 Update Documentation and Developer Resources
  - [ ] 10.1 Update main `README.md` with API endpoint documentation and setup instructions
  - [ ] 10.2 Update `.github/copilot-instructions.md` with new API patterns and worker architecture
  - [ ] 10.3 Create API documentation (`docs/api.md`) with complete endpoint specifications and examples
  - [ ] 10.4 Create deployment guide (`docs/deployment.md`) for Cloudflare Workers, KV, and R2 setup
  - [ ] 10.5 Create developer setup guide (`docs/development.md`) for local testing and debugging
  - [ ] 10.6 Document rate limiting configuration and monitoring (`docs/rate-limiting.md`)
  - [ ] 10.7 Create photo processing documentation (`docs/photo-processing.md`) with R2 bucket structure and EXIF handling
  - [ ] 10.8 Add troubleshooting guide (`docs/troubleshooting.md`) for common API and infrastructure issues
