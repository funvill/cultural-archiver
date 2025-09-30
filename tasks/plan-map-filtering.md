# Map Filtering Implementation Plan

**Document Version**: 1.0  
**Created**: September 29, 2025  
**Project**: Cultural Archiver  
**Based on**: `feature-map-filtering.md` and `questions-map-filtering.md`

## Overview

This document provides a comprehensive implementation plan for adding map filtering capabilities to the Cultural Archiver application. The feature allows users to filter map markers based on artwork status (Unknown/removed), user lists (Visited, Starred, Loved), and artwork types, with enhanced marker styling and performance optimizations.

## Current Architecture Analysis

### Existing Components
- **MapComponent.vue**: Main map implementation using Leaflet with clustering
- **MapView.vue**: View wrapper containing the map component
- **API Service**: Complete user lists system (`/api/me/lists`, system lists: Visited, Starred, Loved)
- **Performance**: Already optimized with viewport-based loading and canvas markers
- **Clustering**: Implemented with `leaflet.markercluster`

### Current Marker System
- Uses `L.circleMarker` with color-coded styling (amber for statues, indigo for murals, etc.)
- Viewport-based loading with intelligent caching
- Clustering enabled with user toggle (`clusterEnabled` state)
- Progressive loading for large datasets (1000+ markers)

## Tasks

### **1.0 Create Test Map Page** ✅ COMPLETED
- [x] **1.1** Create `/test-map` route in frontend router
- [x] **1.2** Create `TestMapView.vue` component with mock data generation
  - Generate 250 markers each for: Normal, Visited, Starred, Unknown status
  - Include mock artwork data with required fields (id, title, coordinates, type, status)
  - Use realistic Vancouver area coordinates for testing
- [x] **1.3** Import and use existing `MapComponent` in test view
- [x] **1.4** Add development-only route guard to prevent production access

**Implementation Notes**: 
- Mock data should include all artwork types to test type filtering
- Use consistent ID format matching production data
- Test page should not make API calls - generate data locally

### **2.0 Enhanced Marker System** ✅ COMPLETED

- [x] **2.1** Update marker creation logic in `MapComponent.vue`
  - Modify `updateArtworkMarkers()` to handle new marker types
  - Add marker style variants: Normal (circle), Visited (gray flag), Starred (golden star), Unknown (dashed circle)
- [x] **2.2** Create marker icon factory functions
  - `createNormalMarker()`: Current circle marker implementation
  - `createVisitedMarker()`: Gray flag icon using Leaflet divIcon
  - `createStarredMarker()`: Golden star icon using Leaflet divIcon  
  - `createUnknownMarker()`: Circle with dashed border using CSS styling
- [x] **2.3** Update marker update logic to preserve performance
  - Ensure new marker types work with existing clustering
  - Maintain viewport-based loading compatibility
  - Test with 1000+ markers for performance regression

**Implementation Notes**:
- Use consistent sizing (32x32px) for all marker types to maintain clustering
- Flag and star icons should use Leaflet `divIcon` with custom HTML/CSS
- Unknown markers use existing `circleMarker` with CSS border modification
- Ensure click events work correctly for all marker types

### **3.0 User Lists Integration** ✅ COMPLETED

- [x] **3.1** Create user lists service composable `useUserLists.ts`
  - Fetch system lists (Visited, Starred, Loved) from `/api/me/lists`
  - Implement caching with TTL and head request optimization
  - Handle authentication state changes
- [x] **3.2** Update `MapComponent.vue` to consume user lists
  - Add user lists as reactive state
  - Implement marker classification logic (visited, starred, normal)
  - Add list loading state management
- [x] **3.3** Add list refresh functionality
  - Manual refresh capability for updated lists
  - Automatic refresh on authentication changes
- [x] **3.4** Handle unauthenticated users gracefully
  - Show all markers as "Normal" when not signed in
  - Disable list-based filtering options

**Implementation Notes**:
- System lists API endpoint: `GET /api/me/lists` (already implemented)
- Cache lists in localStorage with timestamp for TTL
- Lists format: `{ id, name, is_system_list, item_count, ... }`
- Artwork belongs to list if `artwork.id` exists in list items

### **4.0 Map Options Dialog Enhancement** ✅ COMPLETED
- [x] **4.1** Update existing map options dialog in `MapComponent.vue`
  - Make dialog full-screen and scrollable
  - Add "Apply Settings" button to commit changes
  - Implement temporary state management for pending changes
- [x] **4.2** Add filtering sections to dialog
  - **Simplified Filters**: "Hide Visited Artworks", "Show Removed Artworks" toggles
  - **Artwork Types Section**: Existing type filter toggles with toggle switches
- [x] **4.3** Add filter reset functionality
  - "Clear All Filters" button at top of dialog
  - Reset to default state (all filters off except approved status)
- [x] **4.4** Update dialog styling for mobile responsiveness
  - Ensure proper touch targets (44px minimum)
  - Scrollable content with fixed header/footer
  - Proper spacing between sections

**Implementation Notes**:
- Use existing dialog component structure in `MapComponent.vue`
- Dialog should overlay entire screen (z-index management)
- Group filters with clear visual separation (borders/backgrounds)
- Apply button commits temporary state to main component state

### **5.0 Filter State Management** ✅ COMPLETED
- [x] **5.1** Create filter state composable `useMapFilters.ts`
  - Reactive filter state object
  - localStorage persistence for user preferences
  - Filter validation and sanitization
- [x] **5.2** Implement filter logic functions
  - `shouldShowArtwork(artwork, filters, userLists)`: Boolean filter function
  - `getMarkerType(artwork, userLists)`: Returns marker type enum
  - `getFilterSummary(filters)`: Returns human-readable filter description
- [x] **5.3** Add filter persistence
  - Save active filters to localStorage on change
  - Restore filters on component mount
  - Clear filters on logout (remove user-specific filters)

**Implementation Notes**:
- Filter object structure: `{ showUnknown: boolean, hideVisited: boolean, showOnlyStarred: boolean, artworkTypes: string[] }`
- Use `watch()` for reactive filter application
- Debounce filter application to prevent excessive re-renders

### **6.0 Active Filter Banner** ✅ COMPLETED
- [x] **6.1** Create `FilterBanner.vue` component
  - Display active filter summary at top of map
  - "Clear All Filters" quick action button
  - Hide when no filters active
- [x] **6.2** Integrate banner with `MapView.vue`
  - Position above map component
  - Pass active filters as props
  - Handle filter clearing events
- [x] **6.3** Add responsive styling
  - Mobile-friendly banner that doesn't obstruct map
  - Clear visual hierarchy (background, text contrast)
  - Animation for show/hide states

**Implementation Notes**:
- Banner should be non-intrusive but clearly visible
- Use theme-aware styling (light/dark mode support)
- Banner text examples: "Showing only starred artworks", "Hiding 45 visited artworks"

### **7.0 Filter Application Logic** ✅ COMPLETED
- [x] **7.1** Update `MapComponent.vue` marker filtering
  - Integrate filter logic into `updateArtworkMarkers()`
  - Apply filters before marker creation to maintain performance
  - Update marker counts in clusters to reflect filtered data
- [x] **7.2** Implement zero-results handling
  - Detect when filters result in no visible markers
  - Show appropriate message in filter banner
  - Provide "Clear Filters" quick action
- [x] **7.3** Add filter performance optimization
  - Pre-filter artwork data before marker processing
  - Use Set/Map for efficient list membership checks
  - Debounce filter changes to prevent excessive updates

**Implementation Notes**:
- Filter before clustering to ensure accurate cluster counts
- Use efficient data structures for list lookups (Set for O(1) contains)
- Maintain existing viewport loading performance

### **8.0 Clustering Behavior Updates** ✅ COMPLETED
- [x] **8.1** Update clustering configuration
  - Force clustering at zoom levels 1-12 (existing requirement)
  - Ensure filtered markers cluster correctly
  - Update cluster counts to reflect visible (filtered) markers only
- [x] **8.2** Test clustering with different filter combinations
  - Verify cluster behavior with mixed marker types
  - Ensure cluster click/expand works with filtered data
  - Test performance with large filtered datasets

**Implementation Notes**:
- Existing cluster configuration may need minimal updates
- Cluster spiderfy should show correct marker types
- No major changes needed - clusters work with any markers

### **9.0 Testing and Quality Assurance** ✅ COMPLETED
- [x] **9.1** Create unit tests for filter logic
  - Test `useMapFilters` composable functions
  - Test marker type classification logic
  - Test filter persistence and restoration
- [x] **9.2** Create integration tests
  - Test filter application with mock user lists
  - Test authentication state changes
  - Test component interaction (dialog → banner → map)
- [x] **9.3** Performance testing
  - Test with 1000+ markers and various filter combinations
  - Verify no regression in existing map performance
  - Test on mobile devices for responsiveness
- [x] **9.4** User acceptance testing
  - Test all user stories from requirements
  - Verify filter persistence across browser sessions
  - Test unauthenticated and authenticated user flows

**Implementation Notes**:
- Use existing test setup (Vitest + Vue Test Utils)
- Mock user lists API calls in tests
- Test edge cases (empty lists, network failures, etc.)

## Technical Specifications

### Filter Object Structure
```typescript
interface MapFilters {
  showUnknown: boolean;           // Default: false
  hideVisited: boolean;           // Default: false  
  showOnlyStarred: boolean;       // Default: false
  artworkTypes: string[];         // Default: all types enabled
}
```

### Marker Type Enum
```typescript
enum MarkerType {
  NORMAL = 'normal',
  VISITED = 'visited', 
  STARRED = 'starred',
  UNKNOWN = 'unknown'
}
```

### User Lists API Integration
- **Endpoint**: `GET /api/me/lists`
- **System Lists**: Visited, Starred, Loved (auto-created)
- **Caching**: localStorage with TTL, head request for freshness
- **Authentication**: Graceful handling of unauthenticated state

## Dependencies

### Existing Dependencies (No Changes)
- Leaflet.js (map rendering)
- leaflet.markercluster (clustering)
- Vue 3 Composition API
- Pinia (if needed for global state)

### New Dependencies (None Required)
All functionality can be implemented with existing project dependencies.

## Performance Considerations

### Existing Optimizations (Preserve)
- Viewport-based loading with bounds caching
- Canvas-based circle markers for performance
- Marker clustering for dense areas
- Progressive loading for large datasets

### New Optimizations
- Pre-filter data before marker creation
- Use Set/Map for efficient list membership checks
- Debounce filter changes (250ms)
- Cache user lists with TTL to reduce API calls

## Mobile Considerations

- Full-screen filter dialog for mobile usability
- Touch-friendly toggle controls (44px minimum)
- Responsive filter banner that doesn't obstruct map
- Preserve existing mobile map performance

## Error Handling

- Network failures when loading user lists
- Invalid filter state recovery
- Authentication state changes during filtering
- Empty result sets with clear user messaging

## Future Enhancements (Out of Scope)

- Custom user list filtering
- Advanced filter combinations (AND/OR logic)
- Filter presets/saved filter states
- Map layer toggles
- Batch artwork operations from filtered results

## Acceptance Criteria

### Must Have (MVP)
- [ ] Users can toggle "Show Unknown Artworks" filter
- [ ] Authenticated users can hide visited artworks  
- [ ] Authenticated users can show only starred artworks
- [ ] Filter state persists across browser sessions
- [ ] Active filters display in banner with clear all option
- [ ] No performance regression with existing map functionality
- [ ] Works on mobile devices with touch-friendly controls

### Should Have
- [ ] Test page with 1000 mock markers for development
- [ ] Graceful handling of unauthenticated users
- [ ] Filter combinations work correctly together
- [ ] Zero results message when no artworks match filters

### Nice to Have
- [ ] Smooth animations for filter changes
- [ ] Keyboard navigation for filter dialog
- [ ] Filter usage analytics/telemetry

## Handoff Notes

This implementation builds on the existing robust map architecture without requiring major refactoring. The current performance optimizations (viewport loading, clustering, canvas markers) are preserved and enhanced. The new filtering system integrates cleanly with the existing user lists API and authentication system.

Key architectural decisions:
1. **Preserve Performance**: Filter before marker creation to maintain current performance
2. **Leverage Existing APIs**: Use implemented user lists system without changes
3. **Progressive Enhancement**: Unauthenticated users get basic functionality
4. **Mobile-First**: All new UI components follow existing responsive patterns

The implementation can be developed incrementally, with the test page providing immediate feedback and the filter system being built layer by layer on the solid existing foundation.