# GitHub Copilot Instructions

## Very important, Read and understand these first.

- Use Playwright-MCP over `simple browser` to debugging
- When starting a devlopment server for testing, use `npm run devout`. This produces a log file `dev-server-logs.txt` that contains the server logs
- [ ] `npm run test` passes with 0 failures
- [ ] `npm run build` completes with 0 errors
- The project has been released. Double check and review all changes to the database. Check the `docs\database.md` document for field and table names. Keep this document up to date after each migration.
- Artwork table is called "artwork" (singular) not artworks (plural) with a `s`
- When I say "update documentation", review and update the `docs` folder. 
## Settings

- Primary domain: `publicartregistry.com`
- Staging domain: `test.publicartregistry.com`
- Primary email: `support@publicartregistry.com`
- API documentation. `/docs/api.md`
  - Backend API: `api.publicartregistry.com`
  - Photos: `photos.publicartregistry.com`
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
  - Configured via `src/frontend/wrangler.jsonc` with `assets.directory: "./dist"`. Built-in SPA configuration handles routing
  - Serves static files through Worker runtime at `publicartregistry.com`
- **Backend Deployment**
  - Separate Cloudflare Worker at `api.publicartregistry.com`
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
  - `/src/components/` - Reusable Vue components (PhotoCarousel, MiniMap, TagBadge)
  - `/src/views/` - Page-level components (ArtworkDetailView, MapView, SubmitView)
  - `/src/stores/` - Pinia state management
  - `/src/services/` - API service layer with proper error handling
  - `/src/test/` - Test utilities and mocks
- `/src/workers/` - Cloudflare Workers API with complete backend implementation
  - `/routes/` - API endpoint handlers (auth, discovery, submissions, user, review)
  - `/middleware/` - Authentication, rate limiting, and validation middleware
  - `/lib/` - Utilities for database, photos, email, spatial queries, and errors
  - `/migrations/` - Database migration SQL files with sequential numbering
  - `/test/` - Comprehensive test suite with 170+ tests across 5 test suites
- `/src/shared/` - Shared TypeScript types and utilities
- `/src/lib` - Utilities
- `/docs/` - Complete project documentation including API specs, deployment guides, and troubleshooting
- `/tasks/` - Current tasks and project requirements documents
- `/_backup_database/` - Database export files and backup storage (excluded from git)

## Development Guidelines

### TypeScript Types

- All database interfaces are defined in `src/shared/types.ts`
- Use the provided type guards for status validation
- Follow the existing naming conventions (Record suffix for DB types)
- Leverage TypeScript strict mode and proper type inference

### Vue.js Best Practices

- Use Composition API with `<script setup lang="ts">`
- Follow mobile-first responsive design principles
- Use Tailwind CSS utility classes with semantic component structure
- Implement proper loading states and error boundaries

### API Design

- Follow RESTful conventions with proper HTTP status codes
- Return consistent error responses with descriptive messages
- Validate coordinates and enforce 500-character note limits

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

### Database Queries

- Use the spatial index for lat/lon queries: `WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`
- Always filter by status for public-facing queries: `WHERE status = 'approved'`
- JSON fields (tags, photos) are stored as TEXT - parse at application level

## Database Migration System

The project includes a comprehensive database migration system for managing Cloudflare D1 database schema changes and data operations.

### Migration Commands (PowerShell Compatible)

**Export Database:**

```powershell
npm run database:export:dev     # Export development database
npm run database:export:prod    # Export production database
```

**Apply Migrations:**

```powershell
npm run database:migration:dev     # Apply migrations to development
npm run database:migration:prod    # Apply migrations to production
```

**Import SQL Files:**

```powershell
npm run database:import:dev <file.sql>     # Import to development
npm run database:import:prod <file.sql>    # Import to production
```

**Migration Status:**

```powershell
npm run database:status:dev     # Check migration status for development
npm run database:status:prod    # Check migration status for production
npm run database:status:staging # Check migration status for staging
```

### Migration File Structure

- **Location**: `src/workers/migrations/`
- **Naming**: Use sequential numbering: `0001_description.sql`, `0002_add_table.sql`
- **Tracking**: Applied migrations are tracked in `d1_migrations` table automatically
- **Backup**: Database exports are stored in `_backup_database/` directory

### Migration File Guidelines

**File Naming Convention:**

```
0001_initial_schema.sql
0002_add_user_table.sql
0003_add_indexes.sql
0004_modify_constraints.sql
```

**SQL Compatibility Requirements:**

- Use SQLite-compatible syntax (Cloudflare D1 is SQLite-based)
- Avoid MySQL/PostgreSQL specific features
- Use `TEXT` for JSON storage, not native JSON type
- Use `REAL` for floating-point numbers (lat/lon coordinates)
- Include proper constraints and indexes

**Migration Best Practices:**

- Include rollback instructions in comments when possible
- Test migrations on development database first
- Use transactions for multi-statement migrations
- Document schema changes in `/docs/database.md`
- Follow existing table naming conventions (snake_case)

### Database Schema Management

**Schema Documentation:**

- Current schema is documented in `/docs/database.md`
- Update documentation when migrations change schema
- Include relationship diagrams and constraints

**Type Safety:**

- Database interfaces are defined in `src/shared/types.ts`
- Update TypeScript types when adding/modifying tables
- Use proper type guards for status validation

**AI Agent Guidelines for Migration Creation:**

- Check existing schema in `/docs/database.md` before creating migrations
- Use sequential numbering starting from next available number
- Follow SQLite syntax and D1 compatibility requirements
- Include proper indexes for performance
- Test migrations in development environment first
- Document breaking changes and provide migration instructions
