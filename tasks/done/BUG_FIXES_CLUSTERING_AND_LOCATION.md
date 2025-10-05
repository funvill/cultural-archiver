# Critical Bug Fixes - Visited Icons and Location Marker

**Date:** October 5, 2025  
**Issue:** Two critical rendering bugs affecting map functionality

## Bug 1: Visited Artwork Icons Not Showing When Clustering Enabled

### Problem
When "Enable marker clustering" was turned ON, visited artwork markers did not display with checkmarks. When clustering was OFF, the checkmarks displayed correctly.

### Root Cause
In `MapComponent.vue`, when preparing artwork points for the clustering algorithm, the code was only passing basic properties (`id`, `lat`, `lon`, `title`, `type`) but was **NOT** including the `visited` and `starred` flags.

**Before (line 259-265):**
```javascript
const artworkPoints = (props.artworks || []).map((a: any) => ({
  id: a.id,
  lat: a.latitude,
  lon: a.longitude,
  title: a.title || 'Untitled',
  type: a.type || 'default'
}));
```

When the clustering algorithm returned individual (non-clustered) points, it preserved the properties using spread operator (`...tc.singlePoint`), but since `visited` and `starred` were never in the original point data, they were lost.

### Solution
Modified the artwork point mapping to include `visited` and `starred` flags:

**After:**
```javascript
const artworkPoints = (props.artworks || []).map((a: any) => {
  const visited = visitedArtworks.value instanceof Set ? visitedArtworks.value.has(a.id) : false;
  const starred = starredArtworks.value instanceof Set ? starredArtworks.value.has(a.id) : false;
  
  return {
    id: a.id,
    lat: a.latitude,
    lon: a.longitude,
    title: a.title || 'Untitled',
    type: a.type || 'default',
    // Pass visited/starred flags so they're preserved in clustered output
    visited,
    starred
  };
});
```

### Changes Made
**File:** `src/frontend/src/components/MapComponent.vue`

1. **Line ~259-270:** Updated point mapping to include `visited` and `starred` properties
2. **Line ~275-280:** Added diagnostic logging to track visited/starred counts in input points
3. **Line ~285-295:** Enhanced cluster generation logging to verify properties are preserved in output

### Diagnostic Output
The fix includes comprehensive logging:
```javascript
console.log('[MAP DIAGNOSTIC] Loading points for clustering:', {
  totalPoints: artworkPoints.length,
  visitedInPoints: artworkPoints.filter(p => p.visited).length,
  starredInPoints: artworkPoints.filter(p => p.starred).length
});

console.log('[MAP DIAGNOSTIC] Clustering enabled - clusters generated:', {
  totalClusters: clusters.length,
  visitedMarkers: clusters.filter(c => !c.properties.cluster && c.properties.visited).length,
  starredMarkers: clusters.filter(c => !c.properties.cluster && c.properties.starred).length,
  // ... more diagnostic info
});
```

---

## Bug 2: User Location Marker Not Displaying on Map

### Problem
The user location marker (person icon with view cone) was not visible on the map when GPS location was obtained, even though the code was executing and adding the marker to the map.

### Root Cause
In the CSS styles, there was a rule that hides ALL Leaflet marker icons when WebGL rendering is active:

**Before (line 2203):**
```css
.webgl-active .leaflet-marker-icon:not(.marker-cluster-icon),
```

This rule was intended to hide artwork markers to prevent duplicates (since WebGL renders them), but it was also hiding the user location marker which should always be visible as a DOM element.

### Solution
Modified the CSS selector to exclude the user location marker class:

**After:**
```css
.webgl-active .leaflet-marker-icon:not(.marker-cluster-icon):not(.custom-user-location-icon-wrapper),
```

Now the rule explicitly excludes both:
1. `.marker-cluster-icon` - Cluster icons (intentionally visible in non-WebGL mode)
2. `.custom-user-location-icon-wrapper` - User location marker (always visible)

### Changes Made
**File:** `src/frontend/src/components/MapComponent.vue`

**Line ~2200-2210:** Updated CSS selector to preserve user location marker visibility

```css
/* When WebGL overlay is active we typically want to hide the DOM markers to avoid
   duplicate visuals. Keep marker cluster icons visible (they use .marker-cluster).
   Also keep user location marker visible.
   The .webgl-active class is applied to the map root when WebGL is mounted. */
.webgl-active .leaflet-marker-icon:not(.marker-cluster-icon):not(.custom-user-location-icon-wrapper),
.webgl-active .leaflet-marker-pane .artwork-marker,
/* ... other selectors ... */
{
  opacity: 0 !important;
  pointer-events: none !important;
  transform: scale(0.9) !important;
}
```

### Why This Works
1. **WebGL rendering:** Artwork markers are rendered via WebGL (deck.gl) for performance
2. **User location is special:** It's always a single marker, doesn't need WebGL optimization
3. **DOM rendering preferred:** The user location marker with view cone SVG is best rendered as a DOM element for proper interaction and visual fidelity
4. **Z-index already set:** The marker already has `z-index: 11000` to stay above artwork markers

---

## Testing Steps

### Test Bug Fix #1 (Visited Icons with Clustering)
1. Sign in to the application
2. Mark several artworks as "visited" in your lists
3. Navigate to map view
4. Open filters and ensure "Enable marker clustering" is **ON**
5. Check browser console for diagnostic logs showing visited counts
6. Zoom to various levels and verify visited markers show checkmarks
7. Expected: Visited artworks display with checkmark icons at all zoom levels

### Test Bug Fix #2 (Location Marker Visibility)
1. Navigate to map view
2. Click "Find My Location" button
3. Grant GPS permission if prompted
4. Check browser console for GPS diagnostic logs
5. Expected: Blue location marker with view cone appears on map
6. Expected: Marker is visible and interactive (can click for popup)
7. Test at various zoom levels to ensure marker stays visible

### Combined Test
1. Enable location tracking AND visited artwork filtering
2. Enable clustering
3. Verify both work together:
   - User location marker is visible
   - Visited artwork icons show checkmarks
   - Clustering works correctly at different zoom levels

---

## Files Modified

1. **src/frontend/src/components/MapComponent.vue**
   - Added `visited` and `starred` properties to clustering input data
   - Enhanced diagnostic logging for clustering
   - Fixed CSS to preserve user location marker visibility

---

## Build Verification

✅ **Frontend build successful:**
```bash
npm run build:frontend
# Built in 11.74s
```

No breaking changes. All changes are backward compatible.

---

## Technical Notes

### Clustering Data Flow
```
Artworks (props)
  → Map with visited/starred flags from userLists
  → Transform to ArtworkPoint[] with visited/starred
  → Load into useGridCluster
  → getClusters() returns ClusterFeature[] 
  → Properties preserved via spread operator
  → WebGL renders with IconLayer for visited/starred
```

### User Location Marker Layers
- **Leaflet Layer:** `userLocationMarker` (DOM element)
- **Z-index:** 11000 (above artwork markers at 200-10000)
- **CSS Class:** `custom-user-location-icon-wrapper`
- **Visibility:** Always visible, even when WebGL is active
- **Interaction:** Clickable, shows "Your current location" popup

### Icon Rendering Priority
1. **User location:** Always DOM (this fix ensures it stays visible)
2. **Visited/Starred artworks:** WebGL IconLayer with atlas
3. **Normal artworks:** WebGL ScatterplotLayer
4. **Clusters:** WebGL ScatterplotLayer with text overlay

---

## Console Diagnostic Filtering

All new diagnostics use the `[MAP DIAGNOSTIC]` prefix. Filter browser console:
```
[MAP DIAGNOSTIC]
```

Key log messages to watch for:
- "Loading points for clustering" - Shows visited/starred counts in input
- "Clustering enabled - clusters generated" - Shows preserved properties in output
- "Icon Atlas Status" - Shows visited/starred marker counts
- "GPS position obtained" - Shows location data when marker is added

---

## Related Components

- **MapWebGLLayer.vue** - Renders visited/starred icons using deck.gl IconLayer
- **useGridCluster.ts** - Clustering algorithm (preserves arbitrary properties)
- **iconAtlas.ts** - Icon image loading and atlas creation
- **mapSettings.ts** - Stores clustering enabled/disabled preference

---

## Performance Impact

✅ **No negative performance impact:**
- Adding two boolean properties to clustering data is negligible
- CSS change is a selector modification (no runtime cost)
- Diagnostic logging is minimal and can be removed later if needed

---

## Future Improvements

Consider these potential enhancements:
1. Add toggle to show/hide diagnostic logging
2. Create separate CSS class for "always visible markers"
3. Consider rendering user location in WebGL for consistency (low priority)
4. Add visual indicator when visited markers are filtered/clustered
