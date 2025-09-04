# Tasks: Search Page Implementation

## Relevant Files

- `src/frontend/src/views/SearchView.vue` - New main search page component (to be created)
- `src/frontend/src/views/__tests__/SearchView.test.ts` - Unit tests for SearchView component
- `src/frontend/src/router/index.ts` - Router configuration for search route
- `src/frontend/src/components/ArtworkCard.vue` - Reusable artwork card component (to be created)
- `src/frontend/src/components/__tests__/ArtworkCard.test.ts` - Unit tests for ArtworkCard component
- `src/frontend/src/components/SearchInput.vue` - Search input component with icon and placeholder (to be created)
- `src/frontend/src/components/__tests__/SearchInput.test.ts` - Unit tests for SearchInput component
- `src/frontend/src/components/SkeletonCard.vue` - Loading skeleton for artwork cards (to be created)
- `src/frontend/src/components/__tests__/SkeletonCard.test.ts` - Unit tests for SkeletonCard component
- `src/frontend/src/stores/search.ts` - Pinia store for search state management (to be created)
- `src/frontend/src/stores/__tests__/search.test.ts` - Unit tests for search store
- `src/frontend/src/services/api.ts` - API service extensions for search functionality
- `src/frontend/src/composables/useInfiniteScroll.ts` - Composable for infinite scroll functionality (to be created)
- `src/frontend/src/composables/__tests__/useInfiniteScroll.test.ts` - Unit tests for infinite scroll composable
- `src/workers/routes/search.ts` - Backend search API endpoint (to be created)
- `src/workers/routes/__tests__/search.test.ts` - Unit tests for search API endpoint
- `src/workers/lib/search.ts` - Search utility functions and FTS implementation (to be created)
- `src/workers/lib/__tests__/search.test.ts` - Unit tests for search utilities
- `src/frontend/src/components/AppShell.vue` - Navigation component to add search link

### Notes

- The existing `searchArtworks` function in `src/workers/routes/discovery.ts` provides a basic foundation but needs enhancement for proper full-text search
- ArtworkCard component should be reusable and follow the existing design patterns from ArtworkDetailView and other components
- Search functionality should integrate with the existing spatial indexing for potential location-based search in future
- All components should follow existing Tailwind CSS and accessibility patterns from the codebase
- The search store should integrate with the existing API service layer for error handling consistency

## Tasks

- [ ] 1.0 Backend Search Implementation
  - [ ] 1.1 Create search utility functions in `src/workers/lib/search.ts` with full-text search across artwork titles, descriptions, and notes
  - [ ] 1.2 Implement SQLite FTS (Full-Text Search) configuration for artwork and logbook tables
  - [ ] 1.3 Create search API endpoint in `src/workers/routes/search.ts` with GET `/api/search` handler
  - [ ] 1.4 Add search route to main worker index with proper middleware (rate limiting, validation)
  - [ ] 1.5 Implement search query parsing and validation (handle empty queries, length limits)
  - [ ] 1.6 Add search result pagination support with infinite scroll compatibility
  - [ ] 1.7 Optimize search queries for performance (proper indexing, query limits)
  - [ ] 1.8 Add comprehensive unit tests for search functionality and edge cases

- [ ] 2.0 Frontend API Integration
  - [ ] 2.1 Extend `src/frontend/src/services/api.ts` with `searchArtworks(query, page)` method
  - [ ] 2.2 Create search store in `src/frontend/src/stores/search.ts` with Pinia state management
  - [ ] 2.3 Implement search state management (query, results, loading, error, pagination)
  - [ ] 2.4 Add search result caching and deduplication logic
  - [ ] 2.5 Implement search debouncing to prevent excessive API calls
  - [ ] 2.6 Add proper error handling and retry logic for search API calls
  - [ ] 2.7 Create search-specific TypeScript interfaces and types
  - [ ] 2.8 Write unit tests for API service extensions and search store

- [ ] 3.0 Search Page UI Components
  - [ ] 3.1 Create `SearchInput.vue` component with search icon, placeholder text, and proper accessibility
  - [ ] 3.2 Build `ArtworkCard.vue` component displaying title, thumbnail, and responsive grid layout
  - [ ] 3.3 Create `SkeletonCard.vue` component for loading states with proper dimensions
  - [ ] 3.4 Implement infinite scroll composable in `src/frontend/src/composables/useInfiniteScroll.ts`
  - [ ] 3.5 Add search tips and examples component for empty state
  - [ ] 3.6 Create "No results found" state component with proper messaging
  - [ ] 3.7 Ensure all components follow Tailwind CSS design system and mobile-first responsive design
  - [ ] 3.8 Implement proper ARIA labels and keyboard navigation for accessibility
  - [ ] 3.9 Add loading animations and smooth transitions between states
  - [ ] 3.10 Write comprehensive unit tests for all new UI components

- [ ] 4.0 Search View and Navigation
  - [ ] 4.1 Create main `SearchView.vue` component with search input and results grid
  - [ ] 4.2 Add `/search/{query}` route to Vue Router configuration in `src/frontend/src/router/index.ts`
  - [ ] 4.3 Add "Search" navigation link to `AppShell.vue` component
  - [ ] 4.4 Implement URL parameter handling for search queries and deep linking
  - [ ] 4.5 Add search page title and meta information
  - [ ] 4.6 Implement proper page state management (initial load, search tips, results, empty states)
  - [ ] 4.7 Add artwork card click handlers to navigate to artwork detail pages
  - [ ] 4.8 Ensure proper mobile and desktop layouts with responsive design
  - [ ] 4.9 Implement search analytics and user interaction tracking (optional)
  - [ ] 4.10 Add comprehensive integration tests for search page workflow

- [x] 5.0 Testing and Quality Assurance
  - [x] 5.1 Write unit tests for backend search utilities and API endpoints
  - [x] 5.2 Create unit tests for frontend search store and API integration
  - [x] 5.3 Add component tests for SearchInput, ArtworkCard, and SkeletonCard components
  - [x] 5.4 Write integration tests for complete search workflow (query → API → results)
  - [x] 5.5 Test infinite scroll functionality with various data scenarios
  - [x] 5.6 Validate accessibility compliance (WCAG AA) for all search components
  - [x] 5.7 Test responsive design across different screen sizes (320px to 1920px)
  - [x] 5.8 Perform performance testing with large result sets and slow connections
  - [x] 5.9 Test error scenarios (network failures, empty queries, invalid responses)
  - [x] 5.10 Validate search functionality works with existing artwork data and edge cases
