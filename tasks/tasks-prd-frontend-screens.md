# Tasks: Frontend Screens (Vue + Tailwind + shadcn/ui)

Based on PRD: `prd-frontend-screens.md`

## Relevant Files

- `src/frontend/src/App.vue` - Main application component (replace existing basic structure)
- `src/frontend/src/main.ts` - Application entry point (already exists, needs routing updates)
- `src/frontend/src/router/index.ts` - Vue Router configuration (new file)
- `src/frontend/src/stores/auth.ts` - Authentication state management using Pinia
- `src/frontend/src/stores/artworks.ts` - Artwork data and map state management
- `src/frontend/src/services/api.ts` - API client for backend integration
- `src/frontend/src/services/location.ts` - Geolocation and spatial utilities
- `src/frontend/src/components/AppShell.vue` - Top navigation and drawer component
- `src/frontend/src/components/MapComponent.vue` - Leaflet map integration
- `src/frontend/src/components/ArtworkCard.vue` - Reusable artwork display component
- `src/frontend/src/components/PhotoGallery.vue` - Photo carousel and display component
- `src/frontend/src/components/ConsentForm.vue` - Already exists, may need updates
- `src/frontend/src/components/PhotoUpload.vue` - Already exists, integrate with new workflow
- `src/frontend/src/components/ErrorBoundary.vue` - Error handling component
- `src/frontend/src/views/MapView.vue` - Main map page
- `src/frontend/src/views/SubmitView.vue` - Submission form page
- `src/frontend/src/views/ArtworkDetailView.vue` - Individual artwork details
- `src/frontend/src/views/ProfileView.vue` - User submission history
- `src/frontend/src/views/ReviewView.vue` - Reviewer interface
- `src/frontend/src/composables/useAuth.ts` - Authentication composable
- `src/frontend/src/composables/useGeolocation.ts` - Location services composable
- `src/frontend/src/composables/useApi.ts` - API interaction composable
- `src/frontend/src/utils/validation.ts` - Form validation utilities
- `src/frontend/src/utils/image.ts` - Image processing and EXIF utilities
- `src/frontend/src/types/index.ts` - Frontend-specific type definitions

### Test Files

- `src/frontend/src/components/__tests__/AppShell.test.ts` - Navigation component tests
- `src/frontend/src/components/__tests__/MapComponent.test.ts` - Map component tests
- `src/frontend/src/views/__tests__/MapView.test.ts` - Map view integration tests
- `src/frontend/src/services/__tests__/api.test.ts` - API service tests
- `src/frontend/src/composables/__tests__/useAuth.test.ts` - Authentication composable tests

### Notes

- Leverage existing `ConsentForm.vue` and `PhotoUpload.vue` components with necessary updates
- Use Pinia for state management (already configured in main.ts)
- Implement mobile-first responsive design with Tailwind CSS
- Integrate with existing API endpoints documented in the backend
- Follow Vue 3 Composition API patterns throughout

## Tasks

- [x] 1.0 Setup Core Application Architecture
  - [x] 1.1 Install required dependencies (Leaflet, vue-leaflet, EXIF parsing library)
  - [x] 1.2 Configure Vue Router with all required routes (/, /submit, /artwork/:id, /profile, /review)
  - [x] 1.3 Create shared TypeScript types for frontend components
  - [x] 1.4 Set up Pinia stores for auth and artwork state management
  - [x] 1.5 Configure environment variables for API base URL and development settings

- [x] 2.0 Implement App Shell & Navigation System
  - [x] 2.1 Replace existing App.vue with mobile-first header layout
  - [x] 2.2 Create AppShell component with logo, title, and navigation buttons
  - [x] 2.3 Implement responsive slide-out drawer for mobile navigation (768px breakpoint)
  - [x] 2.4 Add navigation icons using Heroicons and proper accessibility labels
  - [x] 2.5 Implement keyboard navigation for drawer menu
  - [x] 2.6 Add conditional Review tab visibility based on user permissions

- [x] 3.0 Develop Main Map Page with Leaflet Integration
  - [x] 3.1 Create MapComponent with Leaflet and OpenStreetMap tiles
  - [x] 3.2 Implement geolocation request and Vancouver fallback
  - [x] 3.3 Add artwork pin clustering for zoomed out views
  - [x] 3.4 Create artwork pin popup modals with hero photo and "View Details" button
  - [x] 3.5 Implement 500m radius artwork loading with background data fetching
  - [x] 3.6 Add map error handling with retry functionality
  - [x] 3.7 Create MapView component integrating map with app shell

- [x] 4.0 Build Submit/Add Page with Photo Upload
  - [x] 4.1 Create SubmitView layout with location display and nearby artwork list
  - [x] 4.2 Integrate existing PhotoUpload component with new workflow requirements
  - [x] 4.3 Implement EXIF location extraction and nearby artwork list updates
  - [x] 4.4 Add "Create new artwork here" and "Don't see your artwork? Create new" options
  - [x] 4.5 Create form fields for optional note (500 char limit) and artwork type selection
  - [x] 4.6 Update ConsentForm component to single checkbox with modal details
  - [x] 4.7 Implement photo upload with automatic quality reduction for slow connections
  - [x] 4.8 Add submission confirmation screen with review timeline explanation
  - [x] 4.9 Handle photo location conflicts by showing mixed distance-sorted artwork lists

- [x] 5.0 Create Artwork Details Page
  - [x] 5.1 Create ArtworkDetailView component with horizontal photo carousel
  - [x] 5.2 Implement PhotoGallery component for newest-first photo display
  - [x] 5.3 Add small location map showing artwork position
  - [x] 5.4 Display artwork metadata (type, optional fields like title/artist/year/material)
  - [x] 5.5 Create "Add a logbook entry" link with pre-selection functionality
  - [x] 5.6 Show chronological approved logbook entries
  - [x] 5.7 Handle artwork loading states and not found errors

- [x] 6.0 Implement Profile Page
  - [x] 6.1 Create ProfileView with approved/pending submission grouping
  - [x] 6.2 Design submission cards with photo thumbnail, status badge, and date
  - [x] 6.3 Implement clickable cards navigation to artwork details
  - [x] 6.4 Hide rejected submissions from user view
  - [x] 6.5 Add immediate visibility for pending submissions
  - [x] 6.6 Implement pagination for large submission lists

- [x] 7.0 Build Reviewer Interface
  - [x] 7.1 Create ReviewView component with permission-based access
  - [x] 7.2 Implement submission queue organization by location/artwork
  - [x] 7.3 Add submission details display with nearby artwork map
  - [x] 7.4 Show merge suggestions for submissions within 50m of existing artwork
  - [x] 7.5 Create approve/reject action buttons with confirmation dialogs
  - [x] 7.6 Implement batch processing capabilities for efficient moderation
  - [x] 7.7 Add simple queue navigation without field editing

- [x] 8.0 Implement API Integration & Services
  - [x] 8.1 Create API service with user token header management
  - [x] 8.2 Implement artwork discovery endpoints (nearby search, details)
  - [x] 8.3 Add submission endpoints with FormData photo upload handling
  - [x] 8.4 Create user management endpoints (submissions, profile)
  - [x] 8.5 Implement review endpoints with proper permission handling
  - [x] 8.6 Add proper CORS configuration and error response handling
  - [x] 8.7 Handle API rate limiting with user-friendly error messages

- [x] 9.0 Add Authentication & User Token Management
  - [x] 9.1 Create useAuth composable for token management
  - [x] 9.2 Implement user token persistence and UUID generation handling
  - [x] 9.3 Add magic link email verification workflow
  - [x] 9.4 Create login/logout UI components and flows
  - [x] 9.5 Implement email verification status checking
  - [x] 9.6 Add reviewer permission detection and UI conditional rendering

- [x] 10.0 Implement Error Handling & Loading States
  - [x] 10.1 Create ErrorBoundary component for app-wide error catching
  - [x] 10.2 Implement network error handling with retry mechanisms
  - [x] 10.3 Add form validation with immediate user feedback
  - [x] 10.4 Handle location and camera permission errors with clear messaging
  - [x] 10.5 Implement upload progress indicators and failure recovery
  - [x] 10.6 Add rate limiting error handling (429 responses) with reset time display
  - [x] 10.7 Create consistent loading states for all async operations

- [ ] 11.0 Ensure Accessibility & Responsive Design
  - [x] 11.1 Implement WCAG AA keyboard navigation throughout application
  - [x] 11.2 Ensure color contrast compliance for all UI elements
  - [x] 11.3 Add proper ARIA labels and screen reader support
  - [x] 11.4 Test and verify mobile-first responsive design (320px to 1920px)
  - [x] 11.5 Implement focus management for modal dialogs and navigation
  - [x] 11.6 Add image alt text and form error announcements for screen readers

- [ ] 12.0 Testing & Quality Assurance
  - [x] 12.1 Write unit tests for critical components (AppShell, MapComponent, SubmitView)
  - [x] 12.2 Create integration tests for submission workflow
  - [x] 12.3 Test API service error handling and retry logic
  - [ ] 12.4 Verify mobile responsiveness on iOS Safari and Android Chrome
  - [ ] 12.5 Conduct accessibility testing with keyboard-only navigation
  - [ ] 12.6 Test photo upload workflow with various file sizes and network conditions
  - [ ] 12.7 Validate 60-second submission workflow performance target
