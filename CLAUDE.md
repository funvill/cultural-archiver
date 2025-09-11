# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Environment

**Platform Requirements:**
- Developed on Windows using PowerShell - use PowerShell-compatible commands
- Node.js >= 22.0.0 (required for native TypeScript support)
- Uses Playwright-MCP tools when available

**Key Development Commands:**
```powershell
npm run dev                    # Start both frontend and backend servers
npm run build                  # Build both frontend and workers for production  
npm run test                   # Run complete test suite (539+ tests)
npm run lint                   # ESLint with Vue/TypeScript rules
npm run type-check             # TypeScript compiler checks across all workspaces
npm run quality                # Run lint + type-check + test (comprehensive)
```

**Database Commands (PowerShell):**
```powershell
npm run database:migration:dev     # Apply migrations to development
npm run database:export:dev        # Export development database
npm run database:status:dev        # Check migration status
```

## Architecture Overview

**Cultural Archiver** is a production-ready community platform for documenting public art, built as a monorepo with separate frontend and backend deployments.

### Tech Stack
- **Frontend**: Vue 3 + TypeScript + Tailwind CSS + Vite
  - Deployed as Cloudflare Worker with static assets (NOT Pages)
  - Configured via `src/frontend/wrangler.jsonc`
- **Backend**: Cloudflare Workers + TypeScript + Hono framework  
  - API endpoints at separate domain (`art-api.abluestar.com`)
  - Configured via `src/workers/wrangler.toml`
- **Database**: SQLite (Cloudflare D1) with spatial indexing
- **Storage**: Cloudflare R2 for photo processing pipeline
- **State**: Pinia stores with reactive TypeScript interfaces

### Project Structure
```
cultural-archiver/
├── src/
│   ├── frontend/          # Vue 3 SPA with worker deployment
│   ├── workers/           # Hono API with comprehensive endpoints
│   └── shared/            # Shared TypeScript types
├── docs/                  # Complete API and deployment docs
└── migrations/            # Database migration scripts
```

### Key Architectural Patterns

**Database Design:**
- All interfaces defined in `src/shared/types.ts`
- Migration system with sequential numbering (`0001_*.sql`)
- Spatial queries with bounding box optimization
- Anonymous UUID tokens for submissions

**API Architecture:**
- RESTful endpoints with consistent error handling
- Rate limiting: 10 submissions/day, 60 queries/hour per user
- Multi-tier authentication: anonymous → email verified → reviewer → admin
- Comprehensive middleware stack (auth, validation, rate limiting)

**Photo Processing:**
- EXIF GPS extraction for automatic location detection
- R2 storage with thumbnail generation (800px max)
- Original + processed variants with CDN serving

## Critical Development Notes

**TypeScript Standards:**
- Strict mode enabled across all workspaces
- Shared types in `src/shared/types.ts` - update when changing schema
- Use type guards for status validation (`isValidArtworkStatus`)

**Database Migrations:**
- SQLite-compatible syntax only (D1 limitation)
- Use `TEXT` for JSON, `REAL` for coordinates
- Sequential numbering: `0001_description.sql`
- Test in development first, document in `/docs/database.md`

**Testing Requirements:**
- All tests must pass before deployment
- Frontend: Vitest + Vue Test Utils (261 tests)
- Backend: Vitest + Miniflare (278 tests)
- Mock external dependencies (Leaflet, geolocation APIs)

**Authentication System:**
- Anonymous UUIDs by default with optional email verification
- Magic link system for email verification
- Permission levels: user → reviewer (5+ approved) → admin
- Session management via KV storage

**Spatial Queries:**
- Use ±0.0045 degrees (~500m) for initial DB filtering
- Haversine formula for precise distance calculations
- Default search radius: 500m, max: 10km

## Production Configuration

**Environments:**
- Production: `art.abluestar.com` (frontend), `art-api.abluestar.com` (API)
- Photo serving: `art-photos.abluestar.com` or direct R2 URLs
- Development: `localhost:8787` for both frontend and backend

**Cloudflare Resources:**
- D1 Database: `cultural-archiver`
- KV Namespaces: SESSIONS, CACHE, RATE_LIMITS, MAGIC_LINKS  
- R2 Bucket: PHOTOS_BUCKET
- Workers: Separate deployments for frontend and API

**Key Features:**
- Fast Photo-First Workflow: 3-screen submission (≤20s completion)
- Intelligent duplicate detection via similarity engine
- Content moderation with review queue
- Mass import system for bulk photo processing
- Export capabilities for OpenStreetMap integration

## Development Workflow

1. **Setup**: `npm install && npm run build`
2. **Development**: `npm run dev` (starts both frontend/backend)  
3. **Quality Check**: `npm run quality` (lint + type-check + test)
4. **Database**: Apply migrations before code changes affecting schema
5. **Deployment**: Separate builds for frontend worker and API worker

**Important**: Never commit sensitive information (API keys, tokens). Use placeholder values in wrangler.toml for public repositories.