# Tasks: Artwork Details Page Implementation

## Relevant Files

- `src/frontend/src/views/ArtworkDetailView.vue` - Main artwork detail page component (already exists, needs major refactoring)
- `src/frontend/src/views/__tests__/ArtworkDetailView.test.ts` - Unit tests for ArtworkDetailView (already exists, needs updates)
- `src/frontend/src/components/PhotoCarousel.vue` - New reusable photo carousel component
- `src/frontend/src/components/__tests__/PhotoCarousel.test.ts` - Unit tests for PhotoCarousel component
- `src/frontend/src/components/MiniMap.vue` - New mini map component for artwork location
- `src/frontend/src/components/__tests__/MiniMap.test.ts` - Unit tests for MiniMap component
- `src/frontend/src/components/TagBadge.vue` - New component for styled tag badges
- `src/frontend/src/components/__tests__/TagBadge.test.ts` - Unit tests for TagBadge component
- `src/frontend/src/components/LogbookTimeline.vue` - New component for paginated journal entries
- `src/frontend/src/components/__tests__/LogbookTimeline.test.ts` - Unit tests for LogbookTimeline component
- `src/frontend/src/services/api.ts` - API service layer (needs artwork detail endpoint)
- `src/frontend/src/stores/artworks.ts` - Artwork store (needs artwork detail fetching)
- `src/frontend/src/stores/__tests__/artworks.test.ts` - Unit tests for artwork store updates
- `src/shared/types.ts` - Shared TypeScript types (may need creator types)
- `src/workers/routes/discovery.ts` - Backend API route for artwork details (already exists)
- `migrations/005_add_creators_table.sql` - Database migration for creator relationships
- `src/workers/lib/database.ts` - Database utility functions for creator queries
- `src/workers/lib/__tests__/database.test.ts` - Unit tests for database creator functions

### Notes

- The existing `ArtworkDetailView.vue` has basic structure but needs complete redesign for MVP requirements
- PhotoCarousel, MiniMap, TagBadge, and LogbookTimeline are new components that need to be created
- Creator relationship tables need to be added to database schema
- API endpoint for detailed artwork information already exists but may need extension for creator data
- All components should follow existing Tailwind CSS and accessibility patterns from the codebase

## Tasks

- [x] 1.0 Database Schema Extension for Creator Management
  - [x] 1.1 Create migration file `006_add_creators_table.sql` with creators table (id, name, bio, created_at)
  - [x] 1.2 Create artwork_creators junction table (artwork_id, creator_id, role, created_at)
  - [x] 1.3 Add indexes for creator queries (creator name, artwork-creator relationships)
  - [x] 1.4 Update database utility functions in `src/workers/lib/database.ts` for creator CRUD operations
  - [x] 1.5 Add creator-related TypeScript interfaces to `src/shared/types.ts`
  - [x] 1.6 Write unit tests for creator database functions
  - [x] 1.7 Run migration and test with sample creator data

- [x] 2.0 Backend API Enhancement for Artwork Details
  - [x] 2.1 Extend `ArtworkDetailResponse` type to include creator information and parsed metadata
  - [x] 2.2 Update discovery route in `src/workers/routes/discovery.ts` to fetch creator data
  - [x] 2.3 Add logic to aggregate logbook entries with pagination support (10 per page)
  - [x] 2.4 Implement tag parsing and organization logic for metadata display
  - [x] 2.5 Add creator name aggregation for comma-separated display format
  - [x] 2.6 Handle data conflict resolution (most recent approved entry logic)
  - [x] 2.7 Write integration tests for enhanced artwork detail endpoint

- [ ] 3.0 Frontend Component Development
  - [ ] 3.1 Create `PhotoCarousel.vue` component with left/right navigation and keyboard support
  - [ ] 3.2 Add touch/swipe gesture support to PhotoCarousel for mobile devices
  - [ ] 3.3 Implement dot indicators and photo counter in PhotoCarousel
  - [ ] 3.4 Add full-screen photo modal functionality to PhotoCarousel
  - [ ] 3.5 Create CC0 license watermark overlay and submission date display
  - [ ] 3.6 Build `MiniMap.vue` component using existing Leaflet configuration
  - [ ] 3.7 Add zoom controls and Google Maps directions link to MiniMap
  - [ ] 3.8 Create `TagBadge.vue` component with pill-style design
  - [ ] 3.9 Implement "show more" functionality for TagBadge lists (5 initial, expand option)
  - [ ] 3.10 Build `LogbookTimeline.vue` component with pagination
  - [ ] 3.11 Add "Load more" button functionality to LogbookTimeline
  - [ ] 3.12 Write comprehensive unit tests for all new components
  - [ ] 3.13 Ensure all components follow WCAG AA accessibility guidelines

- [ ] 4.0 ArtworkDetailView Page Implementation
  - [ ] 4.1 Refactor existing `ArtworkDetailView.vue` to use new component structure
  - [ ] 4.2 Implement progressive loading with skeleton screens for each section
  - [ ] 4.3 Add required information sections (Title, Description, Creators, Location)
  - [ ] 4.4 Implement fallback logic for missing data ("Unknown Artwork Title", "Add description" placeholders)
  - [ ] 4.5 Integrate PhotoCarousel component with lazy loading
  - [ ] 4.6 Add MiniMap component with proper sizing and controls
  - [ ] 4.7 Implement TagBadge display for artwork metadata and tags
  - [ ] 4.8 Integrate LogbookTimeline component for journal entries
  - [ ] 4.9 Add CC0 licensing disclaimer and attribution information
  - [ ] 4.10 Implement 404 error handling for missing or inaccessible artworks
  - [ ] 4.11 Add loading states and error boundaries for all sections

- [ ] 5.0 Routing and Navigation Integration
  - [ ] 5.1 Verify existing `/artwork/[id]` route configuration in router
  - [ ] 5.2 Update MapComponent popup "View Details" buttons to use correct routing
  - [ ] 5.3 Ensure proper navigation from map markers to artwork detail pages
  - [ ] 5.4 Add breadcrumb navigation and back button functionality
  - [ ] 5.5 Implement proper URL parameter validation and error handling
  - [ ] 5.6 Test deep linking and bookmark functionality for artwork URLs

- [ ] 6.0 Responsive Design and Mobile Optimization
  - [ ] 6.1 Implement mobile-first layout with vertical stacking on small screens
  - [ ] 6.2 Optimize PhotoCarousel for touch interactions and swipe gestures
  - [ ] 6.3 Adjust MiniMap sizing and controls for mobile devices
  - [ ] 6.4 Ensure TagBadge components wrap properly on narrow screens
  - [ ] 6.5 Optimize LogbookTimeline spacing and readability on mobile
  - [ ] 6.6 Test and adjust all breakpoints (320px to 1920px) per project standards
  - [ ] 6.7 Verify touch-friendly button sizes and spacing throughout
  - [ ] 6.8 Test performance on 3G connections with image lazy loading

- [ ] 7.0 Testing and Quality Assurance
  - [ ] 7.1 Update existing `ArtworkDetailView.test.ts` with new component structure
  - [ ] 7.2 Write unit tests for PhotoCarousel component interactions
  - [ ] 7.3 Create unit tests for MiniMap component functionality
  - [ ] 7.4 Add unit tests for TagBadge and LogbookTimeline components
  - [ ] 7.5 Write integration tests for full artwork detail page workflow
  - [ ] 7.6 Test accessibility with screen readers and keyboard navigation
  - [ ] 7.7 Perform cross-browser testing (Chrome, Firefox, Safari, Edge)
  - [ ] 7.8 Conduct mobile device testing on iOS and Android
  - [ ] 7.9 Validate performance metrics (2-second load time on 3G)
  - [ ] 7.10 Test error scenarios (network failures, missing data, invalid IDs)
  - [ ] 7.11 Verify all user stories from PRD are satisfied
  - [ ] 7.12 Run full test suite and fix any regressions
