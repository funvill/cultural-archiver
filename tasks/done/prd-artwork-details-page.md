# PRD: Artwork Details Page

## Introduction/Overview

The Artwork Details Page is the central view for any individual artwork in the Cultural Archiver application. It serves as the **single source of truth** for information about an artwork, aggregating all community-contributed data including photos, descriptions, creator information, and metadata. The page must work equally well when only minimal data is available (photo + location) and when enriched by community contributions (title, creator, tags, descriptions, etc).

**Goal**: Create a comprehensive, accessible, and engaging artwork detail page that encourages learning, collecting, and contributing while maintaining simplicity for both data-rich and minimal-data artworks.

## Goals

1. **Information Aggregation**: Display all approved community-contributed information about an artwork in a single, organized view
2. **Progressive Enhancement**: Function effectively with minimal data (location + photo) while scaling gracefully as more information is added
3. **User Engagement**: Encourage users to learn about artworks and contribute additional information
4. **Mobile-First Experience**: Provide optimal viewing and interaction on all device sizes
5. **Performance**: Load efficiently with progressive content loading and optimized images
6. **Accessibility**: Ensure WCAG AA compliance for all users

## User Stories

- **As a map explorer**, I want to click on a map marker and see detailed information about an artwork so that I can learn more about the art in my area
- **As a cultural enthusiast**, I want to view high-quality photos of an artwork in a gallery format so that I can appreciate the artwork's details and different perspectives
- **As a researcher**, I want to see structured metadata about an artwork (creator, medium, installation date) so that I can gather comprehensive information for my work
- **As a mobile user**, I want to view artwork details and get directions to the location so that I can visit the artwork in person
- **As a community member**, I want to see the history and community engagement around an artwork through journal entries so that I understand its cultural significance
- **As an accessibility user**, I want all content to be properly labeled and navigable with assistive technologies

## Functional Requirements

### 1. Page Access and Navigation

1.1. Users can access the page by clicking map markers or from search results 1.2. Page URL follows the pattern `/artwork/[id]` where `id` is the artwork's unique identifier 1.3. Page is accessible to anonymous users without authentication 1.4. Display 404 error page if artwork ID doesn't exist or has no approved data

### 2. Photo Gallery

2.1. Display approved photos in a carousel format with left/right arrow navigation 2.2. Support keyboard navigation (arrow keys) and touch/swipe gestures on mobile 2.3. Include dot indicators showing current photo position 2.4. Enable full-screen photo viewing when photos are clicked 2.5. Display CC0 license as small watermark in corner of each photo 2.6. Show submission date overlay on each photo (from logbook submission date) 2.7. Show submitter username or "Anonymous" (default to Anonymous in MVP) 2.8. Display "No photos available" placeholder when no photos exist 2.9. Implement lazy loading for gallery images

### 3. Required Information Sections

3.1. **Title**: Display artwork title or "Unknown Artwork Title" if not available 3.2. **Description**: Show rendered markdown description or "Add description" placeholder text 3.3. **Creators**: Display comma-separated list of creator names (no links in MVP) 3.4. **Location**: Show interactive mini map with zoom controls and "Get Directions" link

### 4. Creator Information Management

4.1. Build full creator table structure in database (artwork-creator relationship table) 4.2. Display creator names as plain text in comma-separated format 4.3. Show "Unknown" when no creator information is available 4.4. Support multiple creators per artwork

### 5. Mini Map Component

5.1. Display interactive map at city block zoom level 5.2. Include zoom in/out controls (no panning required) 5.3. Show artwork location with marker 5.4. Include "Get Directions" button that generates Google Maps URL 5.5. Use same map provider as main application map

### 6. Tags and Metadata

6.1. Display tags as styled badge/pill components 6.2. Show maximum 5 tags initially with "show more" option for additional tags 6.3. Display key-value metadata fields (Style, Medium, Creation Date, etc.) only when data exists 6.4. Hide metadata sections entirely when no data is available

### 7. Journal/Timeline

7.1. Display approved logbook entries in chronological order (most recent first) 7.2. Show simplified date and note text only for each entry 7.3. Implement pagination with "Load more" button (10 entries per page) 7.4. Hide journal section if no entries exist

### 8. Data Handling

8.1. For conflicting information, display most recent approved entry 8.2. Progressive loading: show sections as data becomes available 8.3. Handle missing optional sections by hiding them entirely 8.4. Display required sections with appropriate placeholder text when data is missing

### 9. Mobile Responsiveness

9.1. Stack all sections vertically on mobile devices 9.2. Ensure touch-friendly navigation for photo carousel 9.3. Optimize mini map size and controls for mobile interaction

### 10. Licensing and Attribution

10.1. Display CC0 license disclaimer: "All user-contributed content is CC0. Underlying artworks may still be copyrighted." 10.2. Show license information prominently but unobtrusively

## Non-Goals (Out of Scope)

- **Editing Functionality**: No "Add Information" or "Edit" buttons in MVP
- **Creator Profile Pages**: Creator names displayed as text only, no linking
- **User Authentication Features**: No user-specific content or permissions
- **Advanced Search Integration**: No search functionality within the detail page
- **Social Features**: No commenting, rating, or sharing functionality beyond existing journal entries
- **SEO Optimization**: No URL slugs or advanced metadata in MVP
- **Advanced Photo Features**: No photo comparison, filtering, or advanced metadata display
- **Offline Functionality**: No offline viewing or caching
- **Print Optimization**: No special print layouts or functionality

## Design Considerations

- **Component Reuse**: Leverage existing map component from main application
- **Responsive Design**: Mobile-first approach with progressive enhancement for larger screens
- **Loading States**: Progressive loading with skeleton screens for each section
- **Error States**: Clear 404 page design for missing or inaccessible artworks
- **Accessibility**: Proper ARIA labels, keyboard navigation, and screen reader support
- **Photo Optimization**: Implement image lazy loading and appropriate sizing for different screen densities

## Technical Considerations

- **Database Schema**: Extend existing artwork/logbook structure to support creator relationships
- **API Integration**: Use existing `ArtworkDetailResponse` type from shared types
- **Photo Storage**: Integrate with existing Cloudflare R2 photo processing pipeline
- **Map Integration**: Reuse Leaflet configuration from main map component
- **Routing**: Integrate with existing Vue Router configuration
- **Performance**: Implement lazy loading for images and paginated content loading

## Success Metrics

- **Page Load Performance**: Page loads within 2 seconds on 3G connection
- **User Engagement**: Users spend average of 60+ seconds viewing artwork details
- **Mobile Usage**: 70%+ of page views successfully completed on mobile devices
- **Error Rate**: Less than 1% of page loads result in errors
- **Accessibility Score**: Maintain WCAG AA compliance with 95%+ automated testing score
- **Photo Interaction**: 40%+ of users interact with photo gallery (swipe, click, navigate)

## Open Questions

1. **Photo Resolution**: What image sizes should be served for different screen densities and connection speeds?
2. **Caching Strategy**: How long should artwork data be cached on the client side?
3. **Analytics**: What specific user interactions should be tracked for future feature development?
4. **Content Moderation**: How should inappropriate or disputed content be handled in the detail view?
5. **Future Creator Integration**: What creator profile information should be captured now to support future creator pages?
6. **Search Integration**: How will this page integrate with the future search functionality?

## Implementation Priority

### Phase MVP

- Basic page structure and routing
- Photo gallery with carousel functionality
- Required information sections with fallbacks
- Mini map integration
- Basic responsive design
- Enhanced loading states and error handling
- Full accessibility implementation
- Performance optimizations
- Advanced photo features (full-screen modal)

### Phase Future

- Creator profile linking
- Edit/contribution functionality
- Advanced metadata display
- Social features integration
