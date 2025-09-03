# GitHub Copilot Instructions

- Devloped on a windows computer using powershell. The commands should be powershell compliant.
- Use Playwright-MCP over simple brower


## Project Overview

Cultural Archiver is a **production-ready** crowdsourced public art mapping application built with:

- **Frontend**: Vue 3 + TypeScript + Tailwind CSS + Vite (WCAG AA compliant, 82 unit tests passing)
- **Backend**: Cloudflare Workers + TypeScript + Hono framework (54 tests passing)  
- **Database**: SQLite (Cloudflare D1) with spatial indexing
- **Storage**: Cloudflare R2 for photo processing pipeline
- **State**: Pinia stores with reactive TypeScript interfaces
- **Testing**: Comprehensive unit test suite with mocked API services (82 tests across 9 test files)
- **Quality**: Type-safe codebase with minimal ESLint errors (1 error, 100 warnings), enhanced error handling

## Current Development Status

✅ **MVP Complete** - All core features implemented and tested:
- Interactive map with artwork discovery and clustering
- Photo upload with EXIF location extraction and R2 storage
- User authentication via anonymous tokens + magic link verification
- Content moderation workflow with reviewer interface
- Mobile-first responsive design (320px to 1920px)
- Comprehensive accessibility implementation (WCAG AA)
- Full API integration with error handling and retry logic

## Testing Infrastructure

### Frontend Testing
- **Unit Tests**: 82 tests passing across 9 test files for comprehensive component coverage
- **Test Framework**: Vitest with Vue Test Utils and jsdom environment
- **Test Coverage**: Components, views, composables, and API integration
- **Testing Strategy**: Focus on component interfaces, user interactions, and accessibility features
- **Test Files**:
  - `AppShell.test.ts` - Application shell and navigation
  - `MapComponent.test.ts` - Interactive map functionality
  - `Modal.test.ts` - Global modal system
  - `PhotoUpload.test.ts` - File upload and consent workflow
  - `ArtworkDetailView.test.ts` - Artwork detail pages
  - `HomeView.test.ts` - Landing page and navigation
  - `MapView.test.ts` - Main map interface
  - `ProfileView.test.ts` - User profile management
  - `SubmitView.test.ts` - Artwork submission workflow

### Testing Best Practices
- Mock external dependencies (Leaflet, API calls, geolocation)
- Test component behavior rather than implementation details
- Include accessibility testing in component tests
- Verify error states and loading conditions
- Focus on user-facing functionality over internal details

## Database Schema

**Important**: Always refer to `/docs/database.md` for the complete database schema documentation.

The database uses four main tables:

- `artwork_types` - Predefined artwork categories (public_art, street_art, monument, sculpture, other)
- `artwork` - Core artwork locations with lat/lon coordinates and status workflow
- `logbook` - Community submissions and entries linked to artworks
- `tags` - Flexible key-value tagging system

### Key Relationships

- artwork.type_id → artwork_types.id (required foreign key)
- logbook.artwork_id → artwork.id (optional foreign key for new submissions)
- tags can link to either artwork OR logbook entries

### Status Workflows

- **Artwork**: pending → approved → removed
- **Logbook**: pending → approved/rejected

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

## File Structure

- `/src/frontend/` - Vue 3 application
- `/src/workers/` - Cloudflare Workers API with complete backend implementation
  - `/routes/` - API endpoint handlers (auth, discovery, submissions, user, review)
  - `/middleware/` - Authentication, rate limiting, and validation middleware
  - `/lib/` - Utilities for database, photos, email, spatial queries, and errors
  - `/tests/` - Comprehensive test suite with 54 tests across 5 test suites
- `/src/shared/` - Shared TypeScript types and utilities
- `/migrations/` - Database migration files with MVPschema
- `/docs/` - Complete project documentation including API specs, deployment guides, and troubleshooting

## Testing

### Frontend Testing
- **Unit Tests**: 7 tests passing for critical components (AppShell, MapComponent, SubmitView)
- **Test Framework**: Vitest with Vue Test Utils and jsdom environment
- **Mocking Strategy**: Comprehensive API service mocking and Leaflet component mocking
- **Coverage Areas**: Component rendering, user interactions, error handling, accessibility features

### Backend Testing
- Test functions should validate CRUD operations on all tables
- Include foreign key relationship integrity tests
- Test spatial query functionality with sample coordinates
- Validate JSON field parsing for tags and photos

### Testing Best Practices
- Mock external dependencies (Leaflet, API calls, geolocation)
- Test component behavior rather than implementation details
- Include accessibility testing in component tests
- Verify error states and loading conditions

## Common Patterns

### Creating Artwork from Logbook Submission

```typescript
// When approving a logbook entry, either:
// 1. Link to existing artwork if coordinates match (~100m)
// 2. Create new artwork and link the logbook entry
```

### Handling Photos

```typescript
// Photos array format in logbook.photos:
['https://r2-url/original-photo1.jpg', 'https://r2-url/original-photo2.jpg'];
```

### Tagging Structure

```typescript
// artwork.tags format (JSON object):
{"material": "bronze", "style": "modern", "condition": "good"}

// tags table (relational, for flexibility):
{label: "material", value: "bronze", artwork_id: "..."}
```

## Migration Notes

- Current migration (002_mvp_schema.sql) completely replaces the legacy schema
- Includes sample data labeled with "SAMPLE" prefix
- Uses realistic Vancouver coordinates for testing
- Foreign key constraints must be enabled in SQLite configuration

When working on this project, always consider the MVP requirements: simple submission workflow, efficient spatial queries, and moderation-friendly status management.

## Other instructions

- Steven's Rules - .github\instructions\steven.instructions.md
- Typescript's Best pratices - .github\instructions\typescript.instructions.md
