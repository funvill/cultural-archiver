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

- [ ] 1.0 Setup Core Application Architecture
  - [ ] 1.1 Install required dependencies (Leaflet, vue-leaflet, EXIF parsing library)
  - [ ] 1.2 Configure Vue Router with all required routes (/, /submit, /artwork/:id, /profile, /review)
  - [ ] 1.3 Create shared TypeScript types for frontend components
  - [ ] 1.4 Set up Pinia stores for auth and artwork state management
  - [ ] 1.5 Configure environment variables for API base URL and development settings

- [ ] 2.0 Implement App Shell & Navigation System
  - [ ] 2.1 Replace existing App.vue with mobile-first header layout
  - [ ] 2.2 Create AppShell component with logo, title, and navigation buttons
  - [ ] 2.3 Implement responsive slide-out drawer for mobile navigation (768px breakpoint)
  - [ ] 2.4 Add navigation icons using Heroicons and proper accessibility labels
  - [ ] 2.5 Implement keyboard navigation for drawer menu
  - [ ] 2.6 Add conditional Review tab visibility based on user permissions

- [ ] 3.0 Develop Main Map Page with Leaflet Integration
  - [ ] 3.1 Create MapComponent with Leaflet and OpenStreetMap tiles
  - [ ] 3.2 Implement geolocation request and Vancouver fallback
  - [ ] 3.3 Add artwork pin clustering for zoomed out views
  - [ ] 3.4 Create artwork pin popup modals with hero photo and "View Details" button
  - [ ] 3.5 Implement 500m radius artwork loading with background data fetching
  - [ ] 3.6 Add map error handling with retry functionality
  - [ ] 3.7 Create MapView component integrating map with app shell

- [ ] 4.0 Build Submit/Add Page with Photo Upload
  - [ ] 4.1 Create SubmitView layout with location display and nearby artwork list
  - [ ] 4.2 Integrate existing PhotoUpload component with new workflow requirements
  - [ ] 4.3 Implement EXIF location extraction and nearby artwork list updates
  - [ ] 4.4 Add "Create new artwork here" and "Don't see your artwork? Create new" options
  - [ ] 4.5 Create form fields for optional note (500 char limit) and artwork type selection
  - [ ] 4.6 Update ConsentForm component to single checkbox with modal details
  - [ ] 4.7 Implement photo upload with automatic quality reduction for slow connections
  - [ ] 4.8 Add submission confirmation screen with review timeline explanation
  - [ ] 4.9 Handle photo location conflicts by showing mixed distance-sorted artwork lists

- [ ] 5.0 Create Artwork Details Page
  - [ ] 5.1 Create ArtworkDetailView component with horizontal photo carousel
  - [ ] 5.2 Implement PhotoGallery component for newest-first photo display
  - [ ] 5.3 Add small location map showing artwork position
  - [ ] 5.4 Display artwork metadata (type, optional fields like title/artist/year/material)
  - [ ] 5.5 Create "Add a logbook entry" link with pre-selection functionality
  - [ ] 5.6 Show chronological approved logbook entries
  - [ ] 5.7 Handle artwork loading states and not found errors

- [ ] 6.0 Implement Profile Page
  - [ ] 6.1 Create ProfileView with approved/pending submission grouping
  - [ ] 6.2 Design submission cards with photo thumbnail, status badge, and date
  - [ ] 6.3 Implement clickable cards navigation to artwork details
  - [ ] 6.4 Hide rejected submissions from user view
  - [ ] 6.5 Add immediate visibility for pending submissions
  - [ ] 6.6 Implement pagination for large submission lists

- [ ] 7.0 Build Reviewer Interface
  - [ ] 7.1 Create ReviewView component with permission-based access
  - [ ] 7.2 Implement submission queue organization by location/artwork
  - [ ] 7.3 Add submission details display with nearby artwork map
  - [ ] 7.4 Show merge suggestions for submissions within 50m of existing artwork
  - [ ] 7.5 Create approve/reject action buttons with confirmation dialogs
  - [ ] 7.6 Implement batch processing capabilities for efficient moderation
  - [ ] 7.7 Add simple queue navigation without field editing

- [ ] 8.0 Implement API Integration & Services
  - [ ] 8.1 Create API service with user token header management
  - [ ] 8.2 Implement artwork discovery endpoints (nearby search, details)
  - [ ] 8.3 Add submission endpoints with FormData photo upload handling
  - [ ] 8.4 Create user management endpoints (submissions, profile)
  - [ ] 8.5 Implement review endpoints with proper permission handling
  - [ ] 8.6 Add proper CORS configuration and error response handling
  - [ ] 8.7 Handle API rate limiting with user-friendly error messages

- [ ] 9.0 Add Authentication & User Token Management
  - [ ] 9.1 Create useAuth composable for token management
  - [ ] 9.2 Implement user token persistence and UUID generation handling
  - [ ] 9.3 Add magic link email verification workflow
  - [ ] 9.4 Create login/logout UI components and flows
  - [ ] 9.5 Implement email verification status checking
  - [ ] 9.6 Add reviewer permission detection and UI conditional rendering

- [ ] 10.0 Implement Error Handling & Loading States
  - [ ] 10.1 Create ErrorBoundary component for app-wide error catching
  - [ ] 10.2 Implement network error handling with retry mechanisms
  - [ ] 10.3 Add form validation with immediate user feedback
  - [ ] 10.4 Handle location and camera permission errors with clear messaging
  - [ ] 10.5 Implement upload progress indicators and failure recovery
  - [ ] 10.6 Add rate limiting error handling (429 responses) with reset time display
  - [ ] 10.7 Create consistent loading states for all async operations

- [ ] 11.0 Ensure Accessibility & Responsive Design
  - [ ] 11.1 Implement WCAG AA keyboard navigation throughout application
  - [ ] 11.2 Ensure color contrast compliance for all UI elements
  - [ ] 11.3 Add proper ARIA labels and screen reader support
  - [ ] 11.4 Test and verify mobile-first responsive design (320px to 1920px)
  - [ ] 11.5 Implement focus management for modal dialogs and navigation
  - [ ] 11.6 Add image alt text and form error announcements for screen readers

- [ ] 12.0 Testing & Quality Assurance
  - [ ] 12.1 Write unit tests for critical components (AppShell, MapComponent, SubmitView)
  - [ ] 12.2 Create integration tests for submission workflow
  - [ ] 12.3 Test API service error handling and retry logic
  - [ ] 12.4 Verify mobile responsiveness on iOS Safari and Android Chrome
  - [ ] 12.5 Conduct accessibility testing with keyboard-only navigation
  - [ ] 12.6 Test photo upload workflow with various file sizes and network conditions
  - [ ] 12.7 Validate 60-second submission workflow performance target
