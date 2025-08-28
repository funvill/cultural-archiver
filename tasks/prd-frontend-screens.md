# Product Requirements Document: Frontend Screens (Vue + Tailwind + shadcn/ui)

## Introduction/Overview

This feature implements the complete user-facing interface for the Cultural
Archiver MVP, providing a mobile-first web application for discovering,
submitting, and managing public art submissions. The frontend enables users to
view approved artworks on an interactive map, submit new artwork with photos and
metadata, view detailed artwork information, and manage their submission
history. The interface prioritizes simplicity and speed, targeting a 60-second
happy path for new submissions while maintaining WCAG AA accessibility
standards.

## Goals

1. Enable users to discover approved public artworks within 500m of their
   location via an interactive map
2. Provide a streamlined submission workflow for new artwork with photo uploads
   and optional metadata
3. Allow users to add logbook entries to existing artworks with photos and notes
4. Implement a simple reviewer interface for content moderation (approve/reject
   workflow)
5. Maintain mobile-first responsive design that works on 90% mobile usage
6. Achieve sub-60 second submission workflow for the happy path
7. Meet WCAG AA accessibility standards for keyboard navigation and color
   contrast

## User Stories

**As a public art explorer**, I want to view a map of nearby approved artworks
so that I can discover cultural sites around my location.

**As a community contributor**, I want to submit photos and information about
new public art so that others can discover these cultural assets.

**As a community contributor**, I want to add photos and notes to existing
artwork entries so that I can contribute additional perspectives and
documentation.

**As a returning user**, I want to view my submission history so that I can
track the status of my contributions.

**As a content reviewer**, I want to review pending submissions with location
context so that I can efficiently moderate community contributions.

**As a mobile user**, I want the interface to work seamlessly on my phone so
that I can contribute while exploring my city.

## Functional Requirements

### 1. App Shell & Navigation

1.1. The application must display a top app bar with left-aligned logo and
"Cultural Archiver" title  
1.2. The app bar must include navigation buttons: (+) Add, Login/Logout, About
(i), Help (?), Profile  
1.3. Navigation buttons must collapse to a slide-out drawer menu on screens
smaller than 768px  
1.4. The slide-out drawer must overlay with dark background, slide from the
left, and close via X button or outside tap  
1.5. All navigation buttons must include appropriate icons  
1.6. The drawer menu must be accessible via keyboard navigation

### 2. Main Map Page

2.1. The page must display a full-screen Leaflet map with OpenStreetMap tiles  
2.2. The map must request and use user's geolocation on initial load  
2.3. If location permission is denied, the map must default to Vancouver
downtown with a message explaining reduced functionality  
2.4. The map must load immediately, then fetch artwork data in the background  
2.5. The map must display approved artwork pins within 500m radius of user
location  
2.6. The map must start at 0.5km radius zoom level around user location  
2.7. The map must show clustered pins when zoomed out, individual pins when
zoomed in  
2.8. Pin taps must display a modal popup with hero photo and "View Details"
button  
2.9. If map fails to load, the system must show an error message with retry
option

### 3. Submit/Add Page

3.1. The page must show user's current location and list existing artworks
sorted by distance  
3.2. The list must include "Don't see your artwork? Create new" as last option  
3.3. Users must be able to upload up to 3 photos (first required, second and
third optional/progressive)  
3.4. Photo uploads must process in background with loading indicator  
3.5. The system must extract location data from photo EXIF and update nearby
artwork list accordingly  
3.6. If photo location differs from current location, both locations' artworks
must be shown mixed in distance-sorted list  
3.7. For slow connections, photos must automatically reduce quality to ensure
faster uploads  
3.8. Users must be able to add an optional note (≤1000 characters, completely
optional)  
3.9. Users must be able to select artwork type from database options
(public_art, street_art, monument, sculpture, other)  
3.10. The page must display current location information  
3.11. Users must check a single consent checkbox listing all required consents
(age 18+, CC0 license, public commons, FoP awareness)  
3.12. The consent checkbox must link to "Learn more" details in modal popups  
3.13. If consent is not checked, the system must show a modal dialog explaining
why consent is required  
3.14. Upon submission, users must see a confirmation screen explaining the
review process timeline

### 4. Artwork Details Page

4.1. The page must display a horizontal scrolling photo carousel at the top
showing newest photos first  
4.2. The page must show artwork location on a small map  
4.3. The page must display artwork type and any present optional fields (title,
artist, year, material)  
4.4. The page must include an "Add a logbook entry" link that redirects to
Submit page with artwork pre-selected  
4.5. The page must show all approved logbook entries for the artwork in
chronological order

### 5. Profile Page

5.1. The page must list user's submissions with approved items grouped at top,
pending at bottom  
5.2. Each submission must show photo thumbnail, status badge, and submission
date  
5.3. Submission cards must be clickable to navigate to artwork details page  
5.4. The page must not display rejected submissions  
5.5. Pending submissions must be visible immediately after submission

### 6. Reviewer Interface

6.1. Reviewers must have access via an additional tab/page with appropriate
permissions  
6.2. The interface must organize submissions by location/artwork for batch
processing  
6.3. The review interface must show submission details alongside a map
displaying nearby existing artworks  
6.4. The system must show reviewers merge suggestions when submissions are
within 50m of existing artwork  
6.5. Reviewers must be able to approve or reject submissions  
6.6. Reviewers must be able to decide whether to merge with existing artwork or
create new artwork entry  
6.7. The interface must be a simple queue system without field editing
capabilities in MVP

### 7. Error Handling & Network

7.1. The system must handle network errors with clear error messages 7.2. The
system must validate form inputs and show appropriate validation errors  
7.3. The system must handle location and camera permission errors with
explanatory messages  
7.4. Upload failures must show clear error messages with retry options

### 8. Responsive Design

8.1. The application must maintain mobile-first design principles  
8.2. On larger screens, the application must scale the mobile design larger
(simple responsive)  
8.3. The application must work correctly on iOS Safari, Android Chrome, and
desktop Chrome/Firefox

### 9. Accessibility

9.1. The application must meet WCAG AA standards for keyboard navigation  
9.2. The application must meet WCAG AA standards for color contrast  
9.3. All interactive elements must be keyboard accessible  
9.4. All images must have appropriate alt text  
9.5. Form errors must be clearly announced to screen readers

## Non-Goals (Out of Scope)

- Advanced search and filtering capabilities (Phase 2)
- User nicknames and social features (Phase 2)
- Offline support and data synchronization (Phase 2)
- Push notifications (Phase 2)
- Advanced moderation tools and duplicate detection (Phase 1.5)
- Multi-language support (Phase 2)
- Advanced photo editing capabilities (Phase 2)
- Desktop-optimized layouts (maintain mobile-first approach)
- Real-time collaborative features (Phase 2)
- Advanced analytics and user tracking (Phase 2)

## Design Considerations

- **Framework**: Vue 3 with TypeScript for type safety and maintainability
- **Styling**: Tailwind CSS with shadcn/ui components for consistent design
  system
- **Map**: Leaflet with OpenStreetMap tiles for reliable mapping functionality
- **Mobile-First**: Design and test on mobile devices first, scale up for larger
  screens
- **Progressive Enhancement**: Load core functionality first, enhance with
  additional features
- **Component Architecture**: Create reusable components for artwork cards,
  photo galleries, and form elements
- **Loading States**: Show appropriate loading indicators for all async
  operations
- **Error Boundaries**: Implement error boundaries to prevent complete app
  crashes

## Technical Considerations

- **API Integration**: Interface with existing Cloudflare Workers API endpoints
- **Photo Handling**: Implement client-side photo resizing to 800px before
  upload
- **State Management**: Use Vue 3 composition API for local state, consider
  Pinia for global state if needed
- **Routing**: Implement Vue Router for navigation between pages
- **Location Services**: Integrate with browser geolocation API with appropriate
  fallbacks
- **File Uploads**: Handle photo uploads with progress indicators and error
  handling
- **Performance**: Implement lazy loading for images and optimize bundle size
- **Security**: Sanitize user inputs and implement proper content security
  policies

## Success Metrics

- **User Engagement**: 90% of users complete submission workflow within 60
  seconds
- **Mobile Usage**: Interface works correctly on iOS Safari and Android Chrome
- **Accessibility**: Pass automated WCAG AA compliance testing
- **Error Rates**: Less than 5% of submissions fail due to frontend errors
- **Load Performance**: Initial page load under 3 seconds on mobile networks
- **User Completion**: 80% of users who start submission process complete it
  successfully
- **Reviewer Efficiency**: Reviewers can process submissions 50% faster than
  manual processes

## Open Questions

1. Should we implement basic analytics tracking for user interactions to inform
   future improvements?
2. Do we need specific error tracking integration (e.g., Sentry) for production
   monitoring?
3. Should the consent modal include links to legal documents hosted elsewhere or
   embedded text?
4. What specific automated tests should be prioritized for the critical path
   testing requirement?
5. Should we implement any client-side caching for artwork data to improve
   performance on repeat visits?

## Acceptance Criteria

- All core user flows (view map → submit artwork → review workflow) function
  correctly on mobile devices
- Keyboard navigation works for all interactive elements without mouse
  dependency
- Color contrast meets WCAG AA standards across all interface elements
- Happy path submission workflow completes in under 60 seconds
- Application works correctly on iOS Safari, Android Chrome, and desktop
  browsers
- Error handling provides clear, actionable feedback for all failure scenarios
- Responsive design maintains usability across screen sizes from 720px to 1920px
- All form validation provides immediate, clear feedback to users
- Photo upload process handles network interruptions gracefully
- Reviewer interface enables efficient batch processing of submissions
