# Goal

Improve Leaflet map performance when rendering and interacting with large numbers (hundreds to tens of thousands) of markers. The test map is at [https://art.abluestar.com/test-map](https://art.abluestar.com/test-map) which reproduces the issue.

This document lists techniques, tradeoffs, prioritized experiments, and small code snippets to try in the project.

## Summary / Quick wins

- Use marker clustering (Leaflet.markercluster or Supercluster + canvas/regular layers) to drastically reduce DOM elements at typical zoom levels.
- Use Canvas or WebGL rendering for markers instead of DOM/SVG when markers are numerous (Leaflet's Canvas layer, Leaflet.heat, or mapbox-gl / deck.gl migration for WebGL).
- Avoid per-marker heavy work during render: no complex Vue components for each marker; use lightweight icons or single canvas draw calls.
- Virtualize and show only markers within viewport/padding using spatial index (rbush / supercluster) and pre-filtering by bbox.
- Debounce map events and batch updates to avoid re-render thrash on pan/zoom.

## Concrete techniques (ranked)

1. Marker clustering (fastest to implement)

**Option A: Leaflet.markercluster (DOM-based)**
- Library: `leaflet.markercluster` with `MarkerClusterGroup`
- Pros: Easy integration, DOM markers, interactive features preserved
- Cons: Still creates DOM elements for clusters; performance limited at scale

**Option B: Supercluster (programmatic clustering)**
- Library: `supercluster` (2.3k stars, used by 244k projects, powers Mapbox GL JS)
- Performance: Can handle millions of points (demonstrated with 6M points in Leaflet)
- API: `getClusters(bbox, zoom)`, `getTile(z, x, y)`, configurable radius/zoom levels
- Use cases: Server-side precomputation, client-side with custom rendering, tile-based approaches
- Pros: Ultra-fast clustering algorithm, works with any renderer (Canvas, WebGL, DOM)
- Cons: Requires custom rendering integration; more implementation work

2. Use Canvas or WebGL rendering (best for tens of thousands)

- Options:
  - Leaflet's built-in Canvas renderer for vector layers and custom canvas layers for points.
  - `Leaflet.Canvas-Markers` plugin (renders icons on canvas)
  - `mapbox-gl` or `deck.gl` migration for full WebGL rendering.
- Pros: vastly fewer DOM nodes, GPU-accelerated rendering, smooth pan/zoom.
- Cons: interactive features (click, hover, tooltips) need hit-testing; more implementation work.

3. Viewport-based rendering (proven technique from live flight maps)

- **Core technique**: Only render markers within current map bounds using `map.getBounds().contains([lat, lon])` 
- Clear all markers on `moveend` event, then re-add only visible ones (real-world tested with 1,500+ markers)
- Use `rbush` or `supercluster` for faster spatial queries on very large datasets (10k+ points)
- Example: limit to points within bbox +- 0.05 degrees or first N results sorted by relevance

4. Simplify marker creation and reuse icons

- Use a small set of shared L.Icon objects instead of constructing new DOM for each marker. Reuse DOM nodes when possible.
- Avoid embedding Vue components inside popups/markers. Render popups lazily on click.

5. Batch updates and debounce user events

- Debounce map moveend / zoomend and batch marker updates instead of reacting to every mousemove. Use requestAnimationFrame for canvas draws.

6. Precompute clusters / server-side tiling

- For very large datasets, precompute clusters with `supercluster` and serve cluster tiles as vector tiles or a small JSON for each bbox/zoom.
- Use a vector-tile or quadkey approach to fetch only needed points per viewport/zoom.

7. Use Web Workers

- Move heavy computations (clustering, indexing, geospatial filtering, building icon canvases) to a Web Worker to keep UI thread responsive.

8. Lazy load marker details and images

- Load photos and rich content only when a marker is clicked or when the popup opens. Use thumbnail placeholders for icons.

## Implementation suggestions and code snippets

- Marker clustering with Leaflet.markercluster (DOM-based)

```js
import L from 'leaflet'
import 'leaflet.markercluster'

const markers = L.markerClusterGroup({ chunkedLoading: true, chunkInterval: 200 })
points.forEach(p => {
  const m = L.marker([p.lat, p.lon], { title: p.title })
  markers.addLayer(m)
})
map.addLayer(markers)
```

- Supercluster with custom rendering (high-performance clustering)

```js
import Supercluster from 'supercluster'

// Initialize with optimized settings
const index = new Supercluster({
  radius: 40,        // cluster radius in pixels
  maxZoom: 16,       // max zoom for clustering
  minZoom: 0,        // min zoom for clustering
  minPoints: 2,      // minimum points to form cluster
  nodeSize: 64       // KD-tree leaf node size (affects performance)
})

// Load GeoJSON points (one time)
const geoJsonPoints = artworkData.map(artwork => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [artwork.lon, artwork.lat] },
  properties: { id: artwork.id, title: artwork.title, type: artwork.type }
}))
index.load(geoJsonPoints)

// Get clusters for current viewport and zoom
function updateClustersOnMap() {
  const bounds = map.getBounds()
  const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
  const zoom = map.getZoom()
  
  const clusters = index.getClusters(bbox, zoom)
  
  // Clear existing markers
  map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer) })
  
  clusters.forEach(cluster => {
    const [lng, lat] = cluster.geometry.coordinates
    
    if (cluster.properties.cluster) {
      // Render cluster marker
      const size = Math.min(cluster.properties.point_count / 10 + 20, 50)
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style="background: #ff6b6b; color: white; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${cluster.properties.point_count}</div>`,
          iconSize: [size, size]
        })
      })
      
      // Click to expand cluster
      marker.on('click', () => {
        const expansionZoom = index.getClusterExpansionZoom(cluster.properties.cluster_id)
        map.flyTo([lat, lng], expansionZoom)
      })
      
      marker.addTo(map)
    } else {
      // Render individual point
      const marker = L.marker([lat, lng], {
        icon: getReusableIcon(cluster.properties.type),
        title: cluster.properties.title
      })
      marker.addTo(map)
    }
  })
}

map.on('moveend', updateClustersOnMap)
map.on('zoomend', updateClustersOnMap)
```

- Viewport-based marker rendering (based on real 1,500-marker flight map)

```js
let currentMarkers = []

const renderMarkersInViewport = () => {
  if (!map) return
  
  // Get current map bounds
  const bounds = map.getBounds()
  
  // Remove all existing markers
  currentMarkers.forEach(marker => map.removeLayer(marker))
  currentMarkers = []
  
  // Add only markers within viewport
  allArtworkData.forEach(artwork => {
    if (bounds.contains([artwork.lat, artwork.lon])) {
      const marker = L.marker([artwork.lat, artwork.lon], {
        icon: getReusableIcon(artwork.type), // reuse icon instances
        title: artwork.title
      })
      marker.addTo(map)
      currentMarkers.push(marker)
    }
  })
}

// Re-render on map move
map.on('moveend', renderMarkersInViewport)
```

- Canvas renderer with rbush filtering (sketch)

```js
import RBush from 'rbush'

const tree = new RBush()
tree.load(points.map(p => ({ minX: p.lon, minY: p.lat, maxX: p.lon, maxY: p.lat, data: p })))

function drawCanvasPoints() {
  const bounds = map.getBounds()
  const results = tree.search({
    minX: bounds.getWest(),
    minY: bounds.getSouth(),
    maxX: bounds.getEast(),
    maxY: bounds.getNorth()
  })
  // clear canvas then draw results in one pass
}

map.on('moveend', () => requestAnimationFrame(drawCanvasPoints))
```

## Prioritized experiments (what to try, in order)

1. **Viewport-based rendering** (proven with 1,500 markers): Implement `bounds.contains()` filtering on `moveend`. This is the fastest, most reliable test for moderate datasets.

2. **Supercluster + custom rendering** (for 10k+ markers): Implement client-side clustering with `getClusters(bbox, zoom)`. Proven to handle millions of points and powers Mapbox GL JS.

3. Add `leaflet.markercluster` with `chunkedLoading: true` and measure FPS and interaction. Good fallback if custom clustering is too complex.

4. **Hybrid approach**: Combine Supercluster clustering with viewport-based filtering - cluster data at low zoom levels, switch to viewport rendering at higher zoom levels.

5. Implement `rbush`-based viewport filtering + reuse icons. Measure memory and render time for 10k+ markers without clustering.

6. Replace markers with a Canvas layer that draws points for the current viewport (use requestAnimationFrame + debounced moveend). Add simple hit-testing by searching the rbush index in a small pixel-radius.

7. **Server-side precomputation**: Generate clusters with Supercluster at build time, serve via tiles using `getTile(z, x, y)` API for massive datasets.

8. If maximum performance needed, consider migrating the map view to a WebGL stack (Mapbox GL or deck.gl) for millions of points.

## Benchmarking & metrics to collect

- Track: initial load time, marker update time on pan/zoom, frames per second during pan, memory usage, and time-to-interactive.
- Use browser Performance tab and record FPS during pan; use console.time/console.timeEnd around heavy operations.
- Add simple telemetry for number of DOM nodes and count of L.Marker instances.

## Real-world case study insights (from flight map with 1,500 markers)

**What worked:**

- Viewport-based rendering with `bounds.contains()` + `moveend` events eliminated most performance issues
- Still lags when fully zoomed out (all markers visible), but dramatic improvement when zoomed in
- DOM markers retained full flexibility for real-time icon customization (size, color, shape changes)

**What didn't work:**

- Canvas rendering was too inflexible for dynamic icon customization needs
- Clustering was incompatible with requirement to show each marker individually

**Key implementation details:**

- Clear all markers before adding new ones (avoid memory leaks)
- Use `moveend` event, not `move` (avoids excessive re-rendering during pan)
- Built with Next.js + React-Leaflet stack

## Edge cases and UX tradeoffs

- Clustering hides individual points; consider allowing users to toggle clustering or show a density heatmap instead.
- Canvas rendering loses native DOM events; implement click-to-popup with a nearest-point hit-test.
- Server-side precomputation increases complexity but reduces client CPU/memory.
- Viewport rendering creates visible "pop-in" of markers as user pans; consider small padding around bounds.

## Supercluster configuration options

**Basic configuration:**
```js
const index = new Supercluster({
  radius: 40,        // Cluster radius in pixels (default: 40)
  maxZoom: 16,       // Max zoom for clustering (default: 16)
  minZoom: 0,        // Min zoom for clustering (default: 0)
  minPoints: 2,      // Minimum points to form cluster (default: 2)
  nodeSize: 64,      // KD-tree leaf node size - affects performance (default: 64)
  extent: 512,       // Tile extent for radius calculation (default: 512)
  generateId: false, // Generate IDs for input features (default: false)
  log: false         // Enable performance logging (default: false)
})
```

**Advanced features:**
- **Property aggregation**: Use `map`/`reduce` functions to calculate cluster properties (sum, avg, max, etc.)
- **Tile-based serving**: Use `getTile(z, x, y)` for vector tile integration
- **Cluster expansion**: Use `getClusterExpansionZoom(clusterId)` for "click to zoom" functionality
- **Pagination**: Use `getLeaves(clusterId, limit, offset)` for large cluster inspection
- **TypeScript support**: Install `@types/supercluster` for full type definitions

**Performance tuning:**
- Increase `nodeSize` (64-512) for better performance with large datasets
- Adjust `radius` based on your map's pixel density and zoom levels
- Use `log: true` during development to measure indexing time

## Quick recommended starting config

**For < 1,000 markers**: Start with viewport-based rendering
**For 1,000-10,000 markers**: Try `leaflet.markercluster` with chunked loading
**For 10,000+ markers**: Implement Supercluster with custom rendering
**For millions of markers**: Use Supercluster with server-side tile generation

Example npm packages: `leaflet.markercluster`, `supercluster`, `rbush`, `@types/supercluster`

## Follow-ups and small changes to try next

- **Priority 1**: Implement viewport-based rendering first - this has proven results with 1,500+ markers
- **Priority 2**: Test Supercluster integration - it's proven to handle millions of points and powers major mapping libraries
- Add screenshots or gif benchmarks from [https://art.abluestar.com/test-map](https://art.abluestar.com/test-map) before/after each experiment
- Create a performance comparison between viewport rendering, Leaflet.markercluster, and Supercluster with same dataset
- Try `chunkedLoading` and `chunkProgress` options on MarkerClusterGroup to keep UI responsive while adding many markers
- Implement Supercluster with property aggregation to show artwork counts, types, or date ranges per cluster
- Test Supercluster's tile-based API (`getTile(z, x, y)`) for potential server-side optimization
- Implement a minimal Canvas draw layer in a feature-flagged branch for comparison
- Test with live flight map approach at [vateye.app](https://vateye.app/) for reference implementation
- Benchmark Supercluster `nodeSize` values (64, 128, 256, 512) with your specific dataset size
- Consider adding small padding around bounds (±0.001 degrees) to reduce marker "pop-in" effect during pan

---

If you'd like, I can also implement a small POC branch in this repo that wires up markercluster with chunked loading and RBush viewport filtering so you can directly compare. Tell me which approach to implement first (cluster quick-win or canvas POC).
