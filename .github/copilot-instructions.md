# GitHub Copilot Instructions

## Very important, Read and understand these first. 

- Developed on a Windows computer using PowerShell. Commands should be PowerShell compliant. Use PowerShell syntax instead
  - Use `Invoke-WebRequest` instead of `curl`
- Use Playwright-MCP over simple browser tools when available.
- When starting a devlopment server for testing, use `npm run dev` in the project root to start the frontend and backend test servers. 
- All unit tests must pass. Run `npm run test` in the project root.
- Build must work `npm run build`. 


## Project Overview

Cultural Archiver is a **production-ready** crowdsourced public art mapping application built with:


- **Frontend**: Vue 3 + TypeScript + Tailwind CSS + Vite deployed as Cloudflare Worker with static assets (WCAG AA compliant, 82 unit tests passing)
- **Backend**: Cloudflare Workers + TypeScript + Hono framework (170+ tests with some failures)  
- **Database**: SQLite (Cloudflare D1) with spatial indexing
- **Storage**: Cloudflare R2 for photo processing pipeline
- **State**: Pinia stores with reactive TypeScript interfaces
- **Testing**: Comprehensive unit test suite with mocked API services (261 total tests across 19 test files)
- **Quality**: Type-safe codebase with active ESLint configuration, enhanced error handling

## Deployment Architecture

### Frontend Deployment
- **NOT Cloudflare Pages** - Uses Cloudflare Worker with static assets
- Configured via `src/frontend/wrangler.jsonc` with `assets.directory: "./dist"`
- Serves static files through Worker runtime at `art.abluestar.com`
- Uses `assets.not_found_handling: "single-page-application"` for automatic SPA routing
- Cloudflare automatically serves `index.html` for client-side routes like `/verify`, `/artwork/*`, etc.
- No custom worker script needed - built-in SPA configuration handles routing

### Backend Deployment  
- Separate Cloudflare Worker at `art-api.abluestar.com`
- Configured via `src/workers/wrangler.toml`
- Handles API endpoints, database operations, and business logic

## Current Development Status

✅ **MVP Complete + Artwork Details Enhancement** - All core features implemented and tested:
- Interactive map with artwork discovery, clustering, and **clickable markers for navigation**
- **Rich artwork details pages** with PhotoCarousel, MiniMap, TagBadge, and LogbookTimeline components
- Photo upload with EXIF location extraction and R2 storage
- User authentication via anonymous tokens + magic link verification
- Content moderation workflow with reviewer interface
- **Mobile-first responsive design** (320px to 1920px) with touch-optimized UI
- Comprehensive accessibility implementation (WCAG AA)
- Full API integration with error handling and retry logic
- **Enhanced routing and navigation** with breadcrumbs and direct marker clicks

## Recent Enhancements (v1.1+)

### New Components
- **PhotoCarousel**: Touch/swipe support, fullscreen modal, keyboard navigation, lazy loading
- **MiniMap**: Interactive location display with Google Maps directions integration
- **TagBadge**: Smart tag management with expandable display (5 initial, "show more")
- **LogbookTimeline**: Community journal entries with chronological display and pagination

### Mobile Optimization
- Touch-friendly button sizes (44px minimum) throughout
- Enhanced swipe gestures and touch interactions
- Progressive disclosure based on screen size
- Mobile-responsive controls and layouts

### Navigation Improvements
- Clickable map markers that navigate directly to artwork details
- Breadcrumb navigation with accessibility labels
- Enhanced URL parameter validation (UUID format checking)
- Robust error handling for invalid artwork IDs

## Testing Infrastructure

### Frontend Testing
- **Unit Tests**: 82 tests passing across 9 test files for comprehensive component coverage
- **Test Framework**: Vitest with Vue Test Utils and jsdom environment
- **Test Coverage**: Components, views, composables, and API integration
- **Testing Strategy**: Focus on component interfaces, user interactions, and accessibility features
- **New Component Tests**:
  - `PhotoCarousel.test.ts` - Photo gallery with touch interactions
  - `MiniMap.test.ts` - Interactive mini-map functionality
  - `TagBadge.test.ts` - Tag display and expansion
  - `LogbookTimeline.test.ts` - Community timeline features

### Backend Testing
- **Unit Tests**: 170+ tests across 5 test suites (6 failing tests in rate limiting/email)
- **Test Framework**: Vitest with Miniflare for Workers environment
- **Coverage Areas**: Authentication, database operations, API endpoints, moderation workflow
- **Known Issues**: Rate limiting and email service tests have some failures

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
- `creators` - Artist/creator information with proper foreign key relationships

### Key Relationships

- artwork.type_id → artwork_types.id (required foreign key)
- artwork.creator_id → creators.id (optional foreign key)
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
- Leverage TypeScript strict mode and proper type inference

### Frontend Component Development

#### Vue.js Best Practices
- Use Composition API with `<script setup lang="ts">`
- Implement proper accessibility (ARIA labels, keyboard navigation, focus management)
- Follow mobile-first responsive design principles
- Use Tailwind CSS utility classes with semantic component structure
- Implement proper loading states and error boundaries

#### Component Architecture
- **PhotoCarousel**: Touch/swipe gestures, keyboard shortcuts, fullscreen modal
- **MiniMap**: Leaflet integration with responsive controls and directions
- **TagBadge**: Expandable tag display with proper keyboard navigation
- **LogbookTimeline**: Chronological entries with pagination and responsive photo grids

#### Testing Patterns
```typescript
// Component testing example
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import PhotoCarousel from '../PhotoCarousel.vue'

describe('PhotoCarousel', () => {
  it('handles touch gestures correctly', async () => {
    const wrapper = mount(PhotoCarousel, {
      props: { photos: mockPhotos }
    })
    
    // Test touch interactions
    await wrapper.find('.carousel-container').trigger('touchstart')
    expect(wrapper.emitted('swipe')).toBeTruthy()
  })
})
```

### Database Queries

- Use the spatial index for lat/lon queries: `WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`
- Always filter by status for public-facing queries: `WHERE status = 'approved'`
- JSON fields (tags, photos) are stored as TEXT - parse at application level
- Use proper foreign key relationships for creators and artwork types

### API Design

- Follow RESTful conventions with proper HTTP status codes
- Return consistent error responses with descriptive messages
- Rate limit submissions (10/day per user token, 60/hour for lookups)
- Validate coordinates and enforce character limits (500 for notes)
- Implement pagination for large datasets (logbook entries: 10 per page)

### Backend Development Patterns

#### Hono Framework Usage
```typescript
// API route example
import { Hono } from 'hono'
import { validateArtworkId } from '../middleware/validation'

const app = new Hono()

app.get('/artworks/:id', validateArtworkId, async (c) => {
  const { id } = c.req.param()
  const artwork = await getArtworkWithDetails(c.env, id)
  
  if (!artwork) {
    return c.json({ error: 'Artwork not found' }, 404)
  }
  
  return c.json({ success: true, data: artwork })
})
```

#### Database Operations
```typescript
// Database query example
export async function getArtworkWithDetails(env: Env, artworkId: string) {
  const query = `
    SELECT a.*, c.name as creator_name, c.bio as creator_bio
    FROM artwork a
    LEFT JOIN creators c ON a.creator_id = c.id
    WHERE a.id = ? AND a.status = 'approved'
  `
  
  const result = await env.DB.prepare(query).bind(artworkId).first()
  return result ? mapArtworkRecord(result) : null
}
```

### Security & Privacy

- Use anonymous user tokens (UUIDs) for submissions
- Support optional email verification via magic links
- Implement age gates and content consent workflows
- Store original photos + generate 800px thumbnails
- Validate all input data with Zod schemas
- Implement proper CORS and rate limiting

### Spatial Queries

- Use ±0.0045 degrees (~500m) for initial filtering
- Implement haversine formula for precise distance calculations
- Default radius is 500 meters for nearby artwork searches
- Index lat/lon columns for performance

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
- `/migrations/` - Database migration files with current schema
- `/docs/` - Complete project documentation including API specs, deployment guides, and troubleshooting

## Testing

### Frontend Testing
- **Unit Tests**: 82 tests passing for critical components and views
- **Test Framework**: Vitest with Vue Test Utils and jsdom environment
- **Mocking Strategy**: Comprehensive API service mocking and Leaflet component mocking
- **Coverage Areas**: Component rendering, user interactions, error handling, accessibility features
- **New Component Coverage**: PhotoCarousel touch interactions, MiniMap responsiveness, TagBadge expansion

### Backend Testing
- Test functions validate CRUD operations on all tables
- Include foreign key relationship integrity tests
- Test spatial query functionality with sample coordinates
- Validate JSON field parsing for tags and photos
- **Known Issues**: Some rate limiting and email tests failing (6 out of 176 tests)

### Testing Best Practices
- Mock external dependencies (Leaflet, API calls, geolocation)
- Test component behavior rather than implementation details
- Include accessibility testing in component tests
- Verify error states and loading conditions
- Test touch interactions and responsive breakpoints

## Common Patterns

### Creating Artwork from Logbook Submission

```typescript
// When approving a logbook entry, either:
// 1. Link to existing artwork if coordinates match (~100m)
// 2. Create new artwork and link the logbook entry
```

### Handling Photos with PhotoCarousel

```typescript
// Photos array format in logbook.photos:
['https://r2-url/original-photo1.jpg', 'https://r2-url/original-photo2.jpg'];

// PhotoCarousel component usage:
<PhotoCarousel 
  :photos="artwork.photos"
  :alt-text="artwork.title || 'Artwork photos'"
  @fullscreen="handleFullscreen"
/>
```

### Responsive Component Development

```typescript
// Use Tailwind responsive classes for mobile-first design
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- Mobile: 1 column, Tablet: 2 columns, Desktop: 3 columns -->
</div>

// Implement touch-friendly button sizes (44px minimum)
<button class="min-h-[44px] min-w-[44px] touch-manipulation">
```

### Tagging Structure

```typescript
// artwork.tags format (JSON object):
{"material": "bronze", "style": "modern", "condition": "good"}

// TagBadge component usage:
<TagBadge 
  :tags="artwork.tags"
  :max-visible="5"
  variant="default"
/>
```

## Migration Notes

- Current migration (006_add_creators_table.sql) includes creator management
- All migrations include sample data labeled with "SAMPLE" prefix
- Uses realistic Vancouver coordinates for testing
- Foreign key constraints must be enabled in SQLite configuration

## Quality Standards

### Code Quality Issues
- **Security vulnerabilities**: 15 moderate severity (esbuild, undici, deprecated Miniflare v2)
- **TypeScript version**: Using 5.9.2 but @typescript-eslint supports <5.6.0
- **Node version**: Requires >=22.0.0 for full compatibility
- **Test failures**: 6 backend tests failing (rate limiting and email services)

### Performance Considerations
- Implement lazy loading for photos and components
- Use proper pagination for large datasets
- Optimize database queries with spatial indexing
- Minimize bundle size with code splitting

When working on this project, always consider:
- **Mobile-first design**: Start with 320px width and enhance upward
- **Accessibility**: WCAG AA compliance with proper ARIA labels and keyboard navigation
- **Touch interactions**: 44px minimum button sizes and proper gesture handling
- **Progressive enhancement**: Features should work with minimal data and scale with rich content
- **Error boundaries**: Comprehensive error handling with user-friendly messages
- **Performance**: Lazy loading, efficient queries, and optimized rendering

## Other Instructions

- Steven's Rules - .github\instructions\steven.instructions.md
- TypeScript Best Practices - .github\instructions\typescript.instructions.md
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

