# Map Icons and Clustering Issues

**Date**: October 4, 2025  
**Status**: Open  
**Priority**: High  
**Component**: Frontend - MapComponent.vue, MapWebGLLayer.vue

## Overview

Multiple issues related to map icon rendering, clustering behavior, and user location features that need to be addressed before release.

## Issues

### 1. Browser Inconsistency: Clustering Behavior Differs Between Chrome and Edge

**Problem**: Chrome and Microsoft Edge show different clustering behaviors despite both being logged in with the same user account.

- **Chrome (First Screenshot)**: Shows individual artwork markers (no clustering)
- **Microsoft Edge (Second Screenshot)**: Shows orange numbered cluster circles

**Expected Behavior**: Both browsers should display the same clustering state for the same zoom level and map position.

**Current State**: 
- Both browsers are at the same location (Vancouver, BC)
- Both are zoomed to similar levels
- Chrome displays ~285 individual markers
- Edge displays ~20-30 cluster circles

**Potential Causes**:
- Different localStorage state between browsers
- Browser-specific rendering differences in deck.gl
- Viewport/zoom calculation differences
- Cached state causing inconsistency

**Files to Check**:
- `src/frontend/src/components/MapComponent.vue` - Line 230-305 (clustering logic)
- `src/frontend/src/stores/mapSettings.ts` - Clustering preference storage
- localStorage key: Check if clustering preference is stored and synced

**Debug Steps**:
1. Open browser dev tools console in both browsers
2. Check localStorage for clustering-related keys
3. Check console logs for `[BUILD WEBGL CLUSTERS] Starting build` messages
4. Compare `effectiveClusterEnabled` values between browsers
5. Verify zoom levels are identical: `map.getZoom()`

---

### 2. Add User Control for Clustering in Map Settings

**Problem**: Users cannot manually enable/disable clustering. The feature is currently controlled only by zoom level (> 14).

**Requirement**: Add a toggle switch in the map settings menu to allow users to manually disable/enable clustering regardless of zoom level.

**Implementation Plan**:

1. **Add Setting to mapSettings Store** (`src/frontend/src/stores/mapSettings.ts`):
   ```typescript
   export const useMapSettings = defineStore('mapSettings', () => {
     // Existing settings...
     const clusteringEnabled = ref(true) // Default: enabled
     
     function toggleClustering() {
       clusteringEnabled.value = !clusteringEnabled.value
       localStorage.setItem('map_clustering_enabled', String(clusteringEnabled.value))
     }
     
     // Load from localStorage on init
     onMounted(() => {
       const saved = localStorage.getItem('map_clustering_enabled')
       if (saved !== null) {
         clusteringEnabled.value = saved === 'true'
       }
     })
     
     return {
       clusteringEnabled,
       toggleClustering,
       // ...other exports
     }
   })
   ```

2. **Update MapComponent.vue** - Modify `effectiveClusterEnabled` computed (around line 162):
   ```typescript
   const effectiveClusterEnabled = computed(() => {
     const z = map.value?.getZoom() ?? props.zoom ?? 15
     const mapSettings = useMapSettings()
     // Only cluster if user preference is enabled AND zoom is appropriate
     return mapSettings.clusteringEnabled && z > 14
   })
   ```

3. **Add UI Control to MapSettingsDialog.vue**:
   - Add toggle switch in the map settings dialog
   - Label: "Enable Marker Clustering"
   - Description: "Group nearby artworks into numbered clusters at higher zoom levels"

4. **Update Watcher** (MapComponent.vue line ~1865):
   - Ensure clustering preference changes trigger cluster rebuild

**Acceptance Criteria**:
- [ ] Setting persists across browser sessions (localStorage)
- [ ] Toggle immediately updates map without reload
- [ ] Setting is synced to mapSettings store
- [ ] Works consistently across Chrome and Edge
- [ ] Default value is `true` (clustering enabled)

---

### 3. Visited Icons Not Showing in Microsoft Edge

**Problem**: Despite successful implementation (confirmed by console logs), the gray checkmark "visited" icons are not visible on the map in Microsoft Edge.

**Current Implementation Status**:
- ✅ Icon SVG definitions created (`src/frontend/src/utils/iconAtlas.ts`)
- ✅ Icon atlas creation working (confirmed: `[ICON ATLAS] Icon atlas created successfully`)
- ✅ Visited flags correctly set in buildWebGLClusters (confirmed: `visitedCount: 1`)
- ✅ IconLayer created in MapWebGLLayer.vue (lines 358-430)
- ✅ Watcher triggers on user list changes (line ~1865)
- ❌ Icons not rendering visibly in Microsoft Edge

**Debug Findings** (from console logs):
```
[WEBGL CLUSTERS] Built clusters: {totalCount: 285, visitedCount: 1, starredCount: 0}
[ICON LAYER] Searching for visited/starred artworks: {totalCount: 285, visitedArtwork: Object}
[ICON LAYER] Creating IconLayer: {hasIconAtlas: true, isReady: true, totalMarkers: 285, filteredMarkerData: ???}
```

**Potential Issues**:
1. **Icon Atlas Canvas Creation** (MapWebGLLayer.vue lines 377-391):
   - Edge may handle canvas rendering differently
   - ImageBitmap drawing might fail silently
   - Icon mapping coordinates may be incorrect

2. **deck.gl IconLayer Rendering**:
   - Edge may have WebGL compatibility issues
   - Z-index/layer ordering may hide icons beneath ScatterplotLayer
   - Icon size may be too small to see

3. **Browser-Specific ImageBitmap Support**:
   - Check if Edge supports createImageBitmap API
   - Verify ImageBitmap to canvas drawing works in Edge

**Debugging Steps**:
1. Open Edge browser console and check for:
   - Canvas rendering errors
   - WebGL warnings
   - IconLayer creation logs
   
2. Add temporary logging in MapWebGLLayer.vue (line ~385):
   ```typescript
   console.log('[ICON ATLAS DEBUG]', {
     canvas: canvas,
     canvasWidth: canvas.width,
     canvasHeight: canvas.height,
     iconMapping: iconMapping,
     context: !!ctx,
     visitedIcon: props.iconAtlas?.icons.get('visited'),
     starredIcon: props.iconAtlas?.icons.get('starred')
   })
   ```

3. Verify icon layer is added to deck.gl layers array (line ~428):
   ```typescript
   const layers = [finalScatter, textLayer]
   if (iconMarkerLayer) {
     console.log('[DEBUG] Adding icon layer to deck.gl')
     layers.push(iconMarkerLayer)
   }
   ```

4. Check if icons are being rendered but obscured:
   - Try increasing icon size in getSize (line ~408)
   - Verify iconMarkerLayer appears AFTER ScatterplotLayer in layers array
   - Add z-index/pickingRadius to make icons more prominent

**Quick Fix to Test**:
In MapWebGLLayer.vue, try forcing icon visibility:
```typescript
getSize: () => 80, // Increase from 20-40
opacity: 1.0,
pickingRadius: 10,
```

---

### 4. User Location Button - Behavior and Icon Issues

**Problem**: Multiple issues with the current location button and user location display.

#### 4a. Location Button Should Be One-Time Action (Not Toggle)

**Current Behavior**: Location button might be implemented as a toggle that continuously tracks user position.

**Required Behavior**:
- Single click centers map on user's current location at zoom level 15
- Does NOT continuously follow user as they move
- User can pan/zoom away from their location freely after initial centering
- Button remains clickable to re-center when needed

**Implementation**:
```typescript
// In MapComponent.vue
async function centerOnUserLocation() {
  try {
    const position = await getCurrentPosition()
    if (map.value) {
      // One-time center action
      map.value.setView(
        [position.coords.latitude, position.coords.longitude],
        15, // Fixed zoom level
        { animate: true, duration: 0.5 }
      )
    }
  } catch (error) {
    console.error('Failed to get user location:', error)
    showError('Unable to access your location')
  }
}
```

#### 4b. User Location Icon Not Showing

**Problem**: Person icon does not appear on map at user's location.

**Requirements**:
- Show person/avatar icon at user's GPS coordinates
- Icon should be visually distinct from circular artwork markers
- Icon should be larger than artwork markers
- Include directional "view cone" showing device orientation
- Must appear on top of all other icons (highest z-index)
- Update position independently when user moves (not tied to map viewport)

**Implementation Requirements**:

1. **Create User Location Icon**:
   - Design: Person/avatar silhouette (not a circle)
   - Size: 48-64px (larger than artwork markers)
   - Color: Distinct color (suggest: blue #2196F3)
   - View cone: Semi-transparent wedge showing heading direction

2. **Icon Location** (`src/frontend/src/utils/iconAtlas.ts`):
   ```typescript
   userLocation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
     <!-- Person icon -->
     <circle cx="32" cy="20" r="10" fill="#2196F3"/>
     <path d="M 32 30 L 20 50 L 24 50 L 32 35 L 40 50 L 44 50 Z" fill="#2196F3"/>
     <!-- Outer circle/ring -->
     <circle cx="32" cy="32" r="30" fill="none" stroke="#2196F3" stroke-width="3" opacity="0.5"/>
   </svg>`,
   
   userLocationCone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
     <!-- View cone wedge (45° spread) -->
     <path d="M 50 50 L 100 25 A 50 50 0 0 1 100 75 Z" fill="#2196F3" opacity="0.3"/>
   </svg>`
   ```

3. **Add Geolocation Tracking** (separate from map centering):
   ```typescript
   const userLocation = ref<{lat: number, lon: number, heading: number} | null>(null)
   let watchId: number | null = null
   
   function startLocationTracking() {
     if ('geolocation' in navigator) {
       watchId = navigator.geolocation.watchPosition(
         (position) => {
           userLocation.value = {
             lat: position.coords.latitude,
             lon: position.coords.longitude,
             heading: position.coords.heading || 0
           }
         },
         (error) => console.error('Location tracking error:', error),
         { enableHighAccuracy: true, maximumAge: 5000 }
       )
     }
   }
   
   onUnmounted(() => {
     if (watchId) {
       navigator.geolocation.clearWatch(watchId)
     }
   })
   ```

4. **Add User Location Layer to MapWebGLLayer.vue**:
   ```typescript
   // Add after IconLayer creation (line ~430)
   let userLocationLayer = null
   if (props.userLocation) {
     userLocationLayer = new IconLayer({
       id: 'user-location',
       data: [props.userLocation],
       pickable: false, // Don't allow clicking
       iconAtlas: props.iconAtlas?.icons.get('userLocation'),
       iconMapping: { user: { x: 0, y: 0, width: 64, height: 64 } },
       getIcon: () => 'user',
       getPosition: (d: any) => [d.lon, d.lat],
       getSize: 64, // Larger than artwork markers
       getAngle: (d: any) => d.heading || 0, // Rotate based on heading
       // Ensure it's on top
       parameters: {
         depthTest: false
       }
     })
   }
   
   // Add to layers array LAST (highest z-index)
   const layers = [finalScatter, textLayer]
   if (iconMarkerLayer) layers.push(iconMarkerLayer)
   if (userLocationLayer) layers.push(userLocationLayer) // On top
   ```

**Acceptance Criteria**:
- [ ] Location button centers map once per click (no toggle behavior)
- [ ] Person icon appears at user's GPS coordinates
- [ ] Icon is visually distinct (not a circle) and larger than artwork markers
- [ ] View cone shows device orientation
- [ ] Icon stays on top of all other map elements
- [ ] Position updates independently when user moves (geolocation.watchPosition)
- [ ] User can pan away from their location after centering
- [ ] Works in both Chrome and Edge

---

## Testing Checklist

### Browser Testing
- [ ] Test in Chrome (latest)
- [ ] Test in Microsoft Edge (latest)
- [ ] Test in Firefox (latest)
- [ ] Test in Safari (if applicable)

### Clustering
- [ ] Verify clustering toggle persists in localStorage
- [ ] Test clustering at zoom levels 13, 14, 15, 16
- [ ] Verify same behavior in Chrome and Edge
- [ ] Test with clustering disabled manually

### Visited Icons
- [ ] Verify visited icon appears in Chrome
- [ ] Verify visited icon appears in Edge
- [ ] Verify gray checkmark design is visible
- [ ] Test with 1, 5, 10+ visited artworks
- [ ] Verify icons appear above regular markers

### User Location
- [ ] Location button centers map once
- [ ] Person icon appears at GPS location
- [ ] Icon is larger than artwork markers
- [ ] View cone shows orientation
- [ ] Icon stays on top of other icons
- [ ] Can pan away after centering
- [ ] Test with location permission denied

---

## Files to Modify

1. **`src/frontend/src/stores/mapSettings.ts`** - Add clustering preference
2. **`src/frontend/src/components/MapComponent.vue`** - Update clustering logic, add location tracking
3. **`src/frontend/src/components/MapWebGLLayer.vue`** - Fix icon rendering, add user location layer
4. **`src/frontend/src/components/MapSettingsDialog.vue`** - Add clustering toggle UI
5. **`src/frontend/src/utils/iconAtlas.ts`** - Add user location icon SVGs

---

## Debug Logging to Remove After Fixes

Once issues are resolved, remove excessive debug logging from:
- MapComponent.vue (lines ~233-237, 294-299, 1867-1872)
- MapWebGLLayer.vue (lines ~363-377, ~381-393)

Search for console.log statements with prefixes:
- `[BUILD WEBGL CLUSTERS]`
- `[WEBGL CLUSTERS]`
- `[ICON LAYER]`
- `[WATCH]`

Keep only essential error logging.

---

## Related Documentation

- [API Documentation](../docs/api.md)
- [Frontend Architecture](../docs/frontend-architecture.md)
- [Leaflet Documentation](https://leafletjs.com/)
- [deck.gl IconLayer](https://deck.gl/docs/api-reference/layers/icon-layer)
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
