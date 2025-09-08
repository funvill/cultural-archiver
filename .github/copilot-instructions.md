# GitHub Copilot Instructions

## Very important, Read and understand these first.

- Developed on a Windows computer using PowerShell. Commands should be PowerShell compliant. Use PowerShell syntax instead
  - Use `Invoke-WebRequest` instead of `curl`
- Use Playwright-MCP over `simple browser` tools when available.
- When starting a devlopment server for testing, use `npm run dev` in the project root to start the frontend and backend test servers.
- All unit tests must pass. Run `npm run test` in the project root.
- Build must work `npm run build`.

## Settings

- Primary domain: `art.abluestar.com`
- Primary email: `support@art.abluestar.com`
- API documentation. `/docs/api.md`
  - Backend API: `art-api.abluestar.com`
- Database Schema documentation: `/docs/database.md`

## Tech stack

- **Frontend**: Vue 3 + TypeScript + Tailwind CSS + Vite deployed as Cloudflare Worker with static assets
- **Backend**: Cloudflare Workers + TypeScript + Hono framework
- **Database**: SQLite (Cloudflare D1) with spatial indexing
- **Storage**: Cloudflare R2 for photo processing pipeline
- **State**: Pinia stores with reactive TypeScript interfaces

## Notes

- **Frontend Deployment**
  - **NOT Cloudflare Pages** - Uses Cloudflare Worker with static assets
  - Configured via `src/frontend/wrangler.jsonc` with `assets.directory: "./dist"`
  - Serves static files through Worker runtime at `art.abluestar.com`
  - Uses `assets.not_found_handling: "single-page-application"` for automatic SPA routing
  - Cloudflare automatically serves `index.html` for client-side routes like `/ verify`, `/artwork/*`, etc.
  - No custom worker script needed - built-in SPA configuration handles routing
- **Backend Deployment**
  - Separate Cloudflare Worker at `art-api.abluestar.com`
  - Configured via `src/workers/wrangler.toml`
  - Handles API endpoints, database operations, and business logic
- **Test Framework**:
  - Frontend: Vitest with Vue Test Utils and jsdom environment
  - Backend: Vitest with Miniflare for Workers environment
  - Testing Best Practices
    - Mock external dependencies (Leaflet, API calls, geolocation)
    - Test component behavior rather than implementation details
    - Verify error states and loading conditions
    - Focus on user-facing functionality over internal details
- Steven's Rules - .github\instructions\steven.instructions.md
- TypeScript Best Practices - .github\instructions\typescript.instructions.md

## File Structure

- `/src/frontend/` - Vue 3 application with TypeScript
  - `/src/components/` - Reusable Vue components (PhotoCarousel, MiniMap, TagBadge, LogbookTimeline)
  - `/src/views/` - Page-level components (ArtworkDetailView, MapView, SubmitView)
  - `/src/stores/` - Pinia state management
  - `/src/services/` - API service layer with proper error handling
  - `/src/test/` - Test utilities and mocks
- `/src/workers/` - Cloudflare Workers API with complete backend implementation
  - `/routes/` - API endpoint handlers (auth, discovery, submissions, user, review)
  - `/middleware/` - Authentication, rate limiting, and validation middleware
  - `/lib/` - Utilities for database, photos, email, spatial queries, and errors
  - `/test/` - Comprehensive test suite with 170+ tests across 5 test suites
- `/src/shared/` - Shared TypeScript types and utilities
- `/docs/` - Complete project documentation including API specs, deployment guides, and troubleshooting
- `/tests/` - Current tasks

## Development Guidelines

### TypeScript Types

- All database interfaces are defined in `src/shared/types.ts`
- Use the provided type guards for status validation
- Follow the existing naming conventions (Record suffix for DB types)
- Leverage TypeScript strict mode and proper type inference

### Frontend Component Development

#### Vue.js Best Practices

- Use Composition API with `<script setup lang="ts">`
- Follow mobile-first responsive design principles
- Use Tailwind CSS utility classes with semantic component structure
- Implement proper loading states and error boundaries

### API Design

- Follow RESTful conventions with proper HTTP status codes
- Return consistent error responses with descriptive messages
- Rate limit submissions (10/day per user token, 60/hour for lookups)
- Validate coordinates and enforce character limits (500 for notes)
- Implement pagination for large datasets (logbook entries: 10 per page)

### Backend Development Patterns

### Security & Privacy

- Use anonymous user tokens (UUIDs) for submissions
- Support optional email verification via magic links
- Store original photos + generate 800px thumbnails
- Validate all input data with Zod schemas
- Implement proper CORS and rate limiting

### Spatial Queries

- Use ±0.0045 degrees (~500m) for initial filtering
- Implement haversine formula for precise distance calculations
- Default radius is 500 meters for nearby artwork searches
- Index lat/lon columns for performance

## Development Guidelines

### TypeScript Types

- All database interfaces are defined in `src/shared/types.ts`
- Use the provided type guards for status validation
- Follow the existing naming conventions (Record suffix for DB types)

### Database Queries

- Use the spatial index for lat/lon queries: `WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`
- Always filter by status for public-facing queries: `WHERE status = 'approved'`
- JSON fields (tags, photos) are stored as TEXT - parse at application level

### API Design

- Follow RESTful conventions
- Return consistent error responses with proper HTTP status codes
- Rate limit submissions (10/day per user token, 60/hour for lookups)
- Validate coordinates and enforce 500-character note limits

### Security & Privacy

- Use anonymous user tokens (UUIDs) for submissions
- Support optional email verification via magic links
- Implement age gates and content consent workflows
- Store original photos + generate 800px thumbnails

### Spatial Queries

- Use ±0.0045 degrees (~500m) for initial filtering
- Implement haversine formula for precise distance calculations
- Default radius is 500 meters for nearby artwork searches
