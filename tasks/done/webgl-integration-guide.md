# WebGL Layer Integration Guide

This guide explains how to integrate the Supercluster + WebGL rendering solution into your existing Leaflet-based map component.

## Overview

The WebGL implementation consists of three core parts:

1. **useSupercluster composable** (`src/frontend/src/composables/useSupercluster.ts`)
   - Manages clustering logic using Supercluster library
   - Converts artwork data to GeoJSON format
   - Returns clusters for current viewport bounds and zoom level

2. **iconAtlas utility** (`src/frontend/src/utils/iconAtlas.ts`)
   - Rasterizes SVG icons to ImageBitmap for GPU rendering
   - Caches icons to avoid repeated conversion
   - Includes 5 default SVG icons (sculpture, mural, installation, default, cluster)

3. **MapWebGLLayer component** (`src/frontend/src/components/MapWebGLLayer.vue`)
   - deck.gl IconLayer integration with Leaflet
   - Renders clusters and markers via WebGL
   - Syncs viewport with Leaflet map
   - Handles click events for clusters (expand) and markers (view)

## Integration Steps

### Step 1: Import Dependencies

Add the following imports to your map component (e.g., `MapComponent.vue`):

```typescript
import { useSupercluster } from '../composables/useSupercluster'
import { createIconAtlas, DEFAULT_ICONS, type IconAtlas } from '../utils/iconAtlas'
import MapWebGLLayer from './MapWebGLLayer.vue'
import type { ClusterFeature } from '../composables/useSupercluster'
```

### Step 2: Initialize State

Add reactive state for clustering and icon atlas:

```typescript
// Clustering state
const clustering = useSupercluster({
  radius: 40,          // Cluster radius in pixels
  maxZoom: 16,         // Max zoom for clustering
  minPoints: 2,        // Min points to form a cluster
  log: true            // Enable performance logging
})

const clusters = ref<ClusterFeature[]>([])
const iconAtlas = ref<IconAtlas | null>(null)
const useWebGLRendering = ref(true) // Feature flag
```

### Step 3: Load Icon Atlas

Load and cache icons on component mount:

```typescript
onMounted(async () => {
  // Load icon atlas
  try {
    const iconConfigs = [
      { name: 'sculpture', svg: DEFAULT_ICONS.sculpture, size: 64 },
      { name: 'mural', svg: DEFAULT_ICONS.mural, size: 64 },
      { name: 'installation', svg: DEFAULT_ICONS.installation, size: 64 },
      { name: 'default', svg: DEFAULT_ICONS.default, size: 64 },
      { name: 'cluster', svg: DEFAULT_ICONS.cluster, size: 64 }
    ]
    
    iconAtlas.value = await createIconAtlas(iconConfigs)
    console.log('Icon atlas loaded:', iconAtlas.value.icons.size, 'icons')
  } catch (error) {
    console.error('Failed to load icon atlas:', error)
  }
  
  // ... rest of your mount logic
})
```

### Step 4: Load Artwork Data into Supercluster

When artwork data loads, convert it to clustering format:

```typescript
// Watch for artwork data changes
watch(() => artworksStore.artworks, (newArtworks) => {
  if (!newArtworks || newArtworks.length === 0) return

  // Convert to ArtworkPoint format
  const artworkPoints = newArtworks.map(artwork => ({
    id: String(artwork.id),
    type: artwork.type || 'default',
    lat: artwork.lat,
    lon: artwork.lon,
    title: artwork.title,
    artist: artwork.artist,
    photo_url: artwork.photos?.[0]?.url_thumb || artwork.photos?.[0]?.url
  }))

  // Load into Supercluster
  clustering.loadPoints(artworkPoints)
  
  // Update clusters for current viewport
  updateClusters()
})
```

### Step 5: Update Clusters on Map Move/Zoom

Create a function to update clusters when the map viewport changes:

```typescript
function updateClusters() {
  if (!map.value || !clustering.isReady.value) return

  const bounds = map.value.getBounds()
  const zoom = map.value.getZoom()

  // Get clusters for current viewport
  const bbox: [number, number, number, number] = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth()
  ]

  clusters.value = clustering.getClusters(bbox, zoom)
  
  if (clustering.indexingTime.value > 0) {
    console.log(`Got ${clusters.value.length} clusters for zoom ${zoom}`)
  }
}
```

Then call `updateClusters()` on map events:

```typescript
// After map initialization
map.value.on('moveend', updateClusters)
map.value.on('zoomend', updateClusters)
```

### Step 6: Add MapWebGLLayer to Template

Add the WebGL layer component to your template:

```vue
<template>
  <!-- Existing map container -->
  <div ref="mapContainer" class="map-container">
    <!-- Map will be initialized here -->
  </div>

  <!-- WebGL rendering layer -->
  <MapWebGLLayer
    v-if="useWebGLRendering && map && iconAtlas"
    :map="map"
    :clusters="clusters"
    :icon-atlas="iconAtlas"
    :visible="true"
    @marker-click="handleMarkerClick"
    @cluster-click="handleClusterClick"
  />
</template>
```

### Step 7: Handle Click Events

Implement click handlers for markers and clusters:

```typescript
/**
 * Handle marker click - show artwork details
 */
function handleMarkerClick(feature: ClusterFeature) {
  const artworkId = feature.properties.id as string
  
  // Use existing logic to show artwork details
  if (artworkId) {
    emit('artworkClick', artworkId)
    // Or navigate to artwork detail page
    // router.push(`/artwork/${artworkId}`)
  }
}

/**
 * Handle cluster click - zoom in to expand cluster
 */
function handleClusterClick(feature: ClusterFeature, expansionZoom: number) {
  if (!map.value) return

  const [lng, lat] = feature.geometry.coordinates
  
  // Zoom to expansion zoom level
  map.value.flyTo([lat, lng], expansionZoom, {
    duration: 0.5
  })
}
```

### Step 8: Feature Flag for A/B Testing

You can toggle between WebGL and DOM-based rendering:

```typescript
const useWebGLRendering = ref(false) // Start with DOM rendering

// Toggle function
function toggleRenderingMode() {
  useWebGLRendering.value = !useWebGLRendering.value
  
  if (useWebGLRendering.value) {
    // Hide DOM markers
    if (markerClusterGroup.value) {
      map.value?.removeLayer(markerClusterGroup.value)
    }
    // Update clusters for WebGL
    updateClusters()
  } else {
    // Restore DOM markers
    updateMarkers() // Your existing marker update logic
  }
}
```

## Complete Example

Here's a minimal complete example:

```vue
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import L from 'leaflet'
import { useSupercluster } from '../composables/useSupercluster'
import { createIconAtlas, DEFAULT_ICONS } from '../utils/iconAtlas'
import MapWebGLLayer from './MapWebGLLayer.vue'
import type { ClusterFeature } from '../composables/useSupercluster'
import { useArtworksStore } from '../stores/artworks'

const artworksStore = useArtworksStore()
const mapContainer = ref<HTMLDivElement>()
const map = ref<L.Map>()

// Clustering state
const clustering = useSupercluster({ radius: 40, maxZoom: 16, log: true })
const clusters = ref<ClusterFeature[]>([])
const iconAtlas = ref(null)

// Update clusters for current viewport
function updateClusters() {
  if (!map.value || !clustering.isReady.value) return

  const bounds = map.value.getBounds()
  const zoom = map.value.getZoom()
  const bbox = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth()
  ]

  clusters.value = clustering.getClusters(bbox, zoom)
}

// Handle marker click
function handleMarkerClick(feature: ClusterFeature) {
  console.log('Marker clicked:', feature.properties)
}

// Handle cluster click
function handleClusterClick(feature: ClusterFeature, zoom: number) {
  if (!map.value) return
  const [lng, lat] = feature.geometry.coordinates
  map.value.flyTo([lat, lng], zoom, { duration: 0.5 })
}

onMounted(async () => {
  // Load icon atlas
  iconAtlas.value = await createIconAtlas([
    { name: 'default', svg: DEFAULT_ICONS.default, size: 64 },
    { name: 'cluster', svg: DEFAULT_ICONS.cluster, size: 64 }
  ])

  // Initialize Leaflet map
  if (mapContainer.value) {
    map.value = L.map(mapContainer.value).setView([49.2827, -123.1207], 13)
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map.value)
    
    // Update clusters on map move
    map.value.on('moveend', updateClusters)
    map.value.on('zoomend', updateClusters)
  }

  // Fetch artworks
  await artworksStore.fetchArtworks()
})

// Load artwork data into clustering
watch(() => artworksStore.artworks, (artworks) => {
  if (!artworks.length) return

  const points = artworks.map(a => ({
    id: String(a.id),
    type: a.type || 'default',
    lat: a.lat,
    lon: a.lon,
    title: a.title
  }))

  clustering.loadPoints(points)
  updateClusters()
})
</script>

<template>
  <div class="relative w-full h-full">
    <div ref="mapContainer" class="w-full h-full" />
    
    <MapWebGLLayer
      v-if="map && iconAtlas && clustering.isReady.value"
      :map="map"
      :clusters="clusters"
      :icon-atlas="iconAtlas"
      @marker-click="handleMarkerClick"
      @cluster-click="handleClusterClick"
    />
  </div>
</template>
```

## Performance Tips

1. **Use Progressive Loading**
   - Load icon atlas on app initialization
   - Cache Supercluster index once data is loaded
   - Only update clusters on moveend/zoomend (not on every move)

2. **Optimize Cluster Configuration**
   - Increase `radius` (40-80px) for fewer, larger clusters
   - Lower `maxZoom` (14-16) to cluster at higher zoom levels
   - Increase `nodeSize` (64-512) for faster queries with large datasets

3. **Feature Flag Rollout**
   - Start with WebGL disabled by default
   - Add settings toggle for users to opt-in
   - Monitor performance metrics (FPS, GPU memory)
   - Gradually increase adoption based on metrics

4. **Error Handling**
   - Gracefully fall back to DOM rendering if WebGL fails
   - Log errors for debugging but don't block user experience
   - Test on various devices and browsers

## Troubleshooting

### "Cannot find module" errors

Make sure dependencies are installed:

```powershell
cd src/frontend
npm install
```

### Icons not appearing

1. Check that icon atlas loaded successfully
2. Verify icon names match in `getIcon()` calls
3. Check browser console for SVG rasterization errors

### Viewport not syncing

1. Verify Leaflet map instance is passed to MapWebGLLayer
2. Check that map events (move/zoom/zoomend) are firing
3. Look for deck.gl initialization errors in console

### Performance issues

1. Reduce cluster radius or increase minPoints
2. Increase nodeSize for faster queries
3. Disable performance logging (`log: false`)
4. Check GPU memory usage in browser DevTools

## Next Steps

1. **Integration** - Follow steps above to integrate into MapComponent.vue
2. **Testing** - Test with various dataset sizes (100, 1k, 10k, 50k markers)
3. **Benchmarking** - Measure FPS, GPU memory, and indexing time
4. **Optimization** - Tune clustering parameters based on performance data
5. **Rollout** - Deploy with feature flag, monitor metrics, increase adoption

## References

- [Supercluster Documentation](https://github.com/mapbox/supercluster)
- [deck.gl IconLayer](https://deck.gl/docs/api-reference/layers/icon-layer)
- [Leaflet Integration Guide](https://deck.gl/docs/get-started/using-with-map#leaflet)
