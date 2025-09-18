# Progress: Map Markers Disappearing Issue

**Date Started**: September 17, 2025  
**Author**: GitHub Copilot  
**Issue**: Map markers disappear when navigating back to map from artwork page

## Problem Description

Users report that when they:
1. Load the main map (with lots of markers visible)
2. Navigate to an artwork page
3. Press "Back" in the browser

The map loads but markers are missing at the original center location. Markers only appear when panning around.

## Console Log Analysis

From the provided logs, we can see:
- API calls are working (nearby artworks API returns data)
- Map is being re-initialized properly
- Session artwork cache shows 629 items
- Map dimensions and zoom level are correct
- No errors in console

Key observation: `MapComponent.vue:309 Leaflet container found: null` - this may be significant.

## Major Tasks Progress

### ✅ Task 1: Create Progress Tracking Document
- [X] Created this progress file following WithMem.prompt.md format
- [X] Documented problem description and initial observations
- [X] Set up task structure for systematic investigation

**Summary**: Progress tracking established. Ready to begin technical investigation.

### ✅ Task 2: Analyze Issue and Console Logs

- [X] Review map component lifecycle
- [X] Understand marker state management  
- [X] Analyze API response handling

**Summary**: Console logs show API calls are working and data is being fetched correctly (629 artworks in cache). No errors. The issue appears to be in marker rendering, not data fetching.

### ✅ Task 3: Examine MapComponent Code

- [X] Investigate MapComponent.vue
- [X] Check MapView.vue  
- [X] Review marker rendering logic
- [X] Identify marker lifecycle issues

**Summary**: Found critical issue! The `updateArtworkMarkers()` function uses `artworksStore.artworks` instead of `props.artworks`, bypassing the component prop system and Vue's reactivity.

### ✅ Task 4: Investigate Marker Persistence Logic
- [X] Check how markers are cached
- [X] Review route navigation handling
- [X] Examine component cleanup/restore

**Summary**: Root cause identified - the component has a watcher on `props.artworks` but `updateArtworkMarkers()` ignores props and accesses the store directly, creating synchronization issues.

### ✅ Task 5: Reproduce and Test Issue
- [X] Set up local environment (dev server running via npm run devout)
- [X] Access application at http://localhost:5173
- [X] Confirm development environment ready

**Summary**: Development environment is running properly. Frontend and backend servers are operational.

### ✅ Task 6: Identify Root Cause
- [X] Determine why markers aren't restored
- [X] Check for timing issues
- [X] Identify missing state restoration

**Summary**: **ROOT CAUSE FOUND**: In `MapComponent.vue` line 599, `updateArtworkMarkers()` uses `artworksStore.artworks.filter()` instead of `(props.artworks || []).filter()`. This bypasses Vue's prop reactivity system and causes timing issues when returning to the map.

### ✅ Task 7: Implement Fix
- [X] Develop solution based on root cause
- [X] Test fix in development
- [X] Ensure no regressions

**Summary**: **FIX IMPLEMENTED**: Changed line 599 in MapComponent.vue from `artworksStore.artworks.filter()` to `(props.artworks || []).filter()` to use proper component architecture and ensure reactivity works correctly.

### ✅ Task 8: Test and Verify Fix
- [X] Test complete navigation flow
- [X] Verify markers persist correctly
- [X] Identify remaining issues

**Summary**: **INITIAL FIX INSUFFICIENT**: Problem still occurred after first fix. This revealed that the issue was not just about using props vs store, but also about timing between Vue's reactivity system and marker updates.

### ✅ Task 9: Deeper Investigation of Remaining Issues
- [X] Investigate component lifecycle timing issues
- [X] Analyze Vue reactivity synchronization problems
- [X] Identify additional fixes needed

**Summary**: **ROOT CAUSE REFINED**: The issue was a timing problem where `updateArtworkMarkers()` was called immediately after `artworksStore.fetchArtworksInBounds()`, but Vue's reactivity system hadn't updated the props yet. The progressive loading already used `nextTick()` correctly.

### ✅ Task 10: Implement Comprehensive Timing Fixes
- [X] Add `await nextTick()` before `updateArtworkMarkers()` in `loadArtworks()` 
- [X] Add `await nextTick()` before `updateArtworkMarkers()` in `clearMapCacheAndReload()`
- [X] Verify TypeScript compilation
- [X] Build frontend successfully

**Summary**: **COMPREHENSIVE FIX COMPLETED**: 
1. **Props Fix**: Changed `updateArtworkMarkers()` to use `(props.artworks || [])` instead of `artworksStore.artworks`
2. **Timing Fix**: Added `await nextTick()` calls before `updateArtworkMarkers()` to ensure Vue reactivity has updated props
3. **Architecture Fix**: Now properly follows Vue component architecture with props flowing down and events flowing up

### ⏳ Task 11: Test Comprehensive Fixes
- [ ] Test complete navigation flow
- [ ] Verify markers persist correctly
- [ ] Run full test suite

## Technical Notes

### Initial Observations:
- Map re-initialization appears to work correctly
- API calls are successful and return data
- The issue seems to be in marker rendering/restoration, not data fetching
- `Leaflet container found: null` in logs may indicate a DOM/timing issue

### Next Steps:
1. Examine the MapComponent.vue code to understand marker lifecycle
2. Check how markers are added/removed during navigation
3. Investigate potential race conditions or timing issues

## Handoff Information

This investigation is following a systematic approach to identify why map markers disappear during navigation. The problem appears to be in the frontend marker management rather than backend data issues, as API calls are working correctly.

**Key Files to Investigate:**
- `src/frontend/src/components/MapComponent.vue`
- `src/frontend/src/views/MapView.vue`
- `src/frontend/src/stores/artworks.ts`
- `src/frontend/src/services/api.ts`

**Reproduction Environment:**
- Windows PowerShell
- Browser navigation: Map → Artwork page → Back button
- Expected: Markers remain visible at original location
- Actual: Markers missing until user pans around