# Goal

Improve map performance when rendering and interacting with tens of thousands of markers. Markers must NOT be DOM-based. They should be rendered using Canvas or WebGL, support clustering at configured zoom levels, and ideally be able to use SVG icons (or images) while preserving high performance.

This document lists non-DOM techniques, tradeoffs, recommended experiments, and explicit answers about SVG/image support for each approach.

## Summary / Quick wins (non-DOM)

- Use programmatic clustering (Supercluster) and feed the clustered data to a non-DOM renderer (Canvas or WebGL).
- Prefer WebGL (deck.gl or Mapbox GL) for the highest throughput and GPU-accelerated rendering when handling tens of thousands of markers.
- Canvas is a simpler, highly-performant option for many use-cases and keeps control over custom drawing and hit-testing.
- Use spatial indexing (rbush) and viewport culling to minimize the number of points drawn each frame.
- Offload heavy work (clustering, indexing, image rasterization) to Web Workers to keep the UI thread free.
- Debounce/batch map events and use requestAnimationFrame for draw scheduling.

## Concrete techniques (ranked, DOM-free)

1. Supercluster (programmatic clustering)

- What it is: a very fast clustering/indexing library that returns clusters and points for a given bbox and zoom.
- Why use it: scales to millions of points; cluster decisions are deterministic and fast; supports tile APIs for server-side serving.
- Renderer-agnostic: Supercluster only produces GeoJSON-like cluster features; you must render them using Canvas or WebGL.

2. WebGL rendering (recommended for tens of thousands+)

- What it is: GPU-based rendering using libraries such as deck.gl or Mapbox GL JS.
- Why use it: highest throughput and smoothest pan/zoom; can render tens or hundreds of thousands of textured markers as point sprites.
- SVG/images: supported by using textures (convert SVG to texture or use pre-rasterized PNG atlases); per-feature styling can be passed as attributes to shaders.

3. Canvas rendering (practical and flexible)

- What it is: CPU rasterization to a canvas element (single element, no per-marker DOM). Many implementations perform well for tens of thousands if drawing is optimized.
- Why use it: simpler than WebGL; full control over hit-testing and drawing; easier to integrate with existing Leaflet map layers that support canvas overlays.
- SVG/images: supported by rasterizing SVG to an Image (data URL) or by using a sprite atlas; keep images cached and preloaded to avoid draw-time decoding.

4. Spatial indexing + viewport culling (rbush)

- What it is: an R-tree (rbush) to quickly query points inside the viewport bbox. Use this to limit work each frame.
- Why use it: reduces draw count dramatically and pairs well with both Canvas and WebGL renderers.

5. Server-side precomputation / vector tiles

- What it is: run Supercluster during build or on server to produce pre-clustered tiles (or use Supercluster's getTile API). Serve tiles and render them client-side using Canvas/WebGL.
- Why use it: offloads indexing and clustering to a server; enables very large datasets without heavy client indexing.

6. Web Workers for heavy work

- What it is: run clustering/indexing/image rasterization in a worker thread and post back the minimal rendering payload to the UI.
- Why use it: keeps the main thread responsive during indexing, rasterization, and large data loads.

## Implementation notes (no DOM, no code samples)

The rest of this document avoids DOM-based options and contains no code blocks. Below are practical notes and explicit answers about SVG/image support for each non-DOM option.

Supercluster (programmatic clustering)
- Supports clustering at configured zoom levels. It is renderer-agnostic and only produces cluster/point features. Use it to compute clusters server-side or client-side and pass the clusters to a Canvas or WebGL renderer. Supercluster itself does not render — it only returns data.
- Images/SVG: Supercluster can carry properties that identify which icon to draw (for example an image name or SVG id). Rendering of images/SVG is the responsibility of the renderer (Canvas or WebGL). So yes, Supercluster works with images/SVG provided the renderer accepts them.

WebGL renderers (deck.gl, Mapbox GL)
- Performance: best option for tens of thousands+ markers — GPU renders many textured point sprites with minimal CPU cost.
- Images: supported via textures. SVGs should be rasterized to textures (PNG or data-URL) or converted to signed distance fields (SDF) if you need crisp scaling. Mapbox GL supports icon images in a sprite atlas and can render symbol layers with collision/placement logic.
- SVG icons: not directly vector-rendered by WebGL; typical approach is to rasterize SVGs to textures ahead of time or at load time (offscreen) and use those textures for point sprites. For dynamic color/shape changes, use a small set of pre-rendered variants or shader-based tinting.

Canvas renderer
- Performance: very good for many thousands of markers if drawing is batched and images are cached. Simpler to implement than WebGL for custom drawing and hit-testing.
- Images: supported by drawing Image objects onto canvas. SVG icons should be pre-rasterized into Image objects (data URLs or <img> loads). Keep a sprite atlas or cached images to avoid repeated decoding.
- SVG icons: supported after rasterization. If you must keep SVG scalable, consider rendering into multiple resolution variants or using an offscreen canvas to rasterize on demand in a Web Worker.

Spatial index (rbush)
- Purpose: fast spatial filtering to retrieve only points inside a viewport or tile. Works with any renderer to reduce draw counts.
- Images/SVG: rbush is only an index; it can store properties that refer to image/svg ids for the renderer to use.

Server-side precomputation / vector tiles
- Purpose: precompute clusters using Supercluster and serve as vector tiles. The client receives only the needed clusters/points for the current tile/zoom and renders them with Canvas or WebGL.
- Images/SVG: server can supply image ids or tile-level sprite references; the client uses those to draw textures. This is ideal for very large datasets to minimize client CPU and memory usage.

Web Workers
- Purpose: offload Supercluster indexing, rbush population, and SVG rasterization to keep the main thread responsive.
- Images/SVG: rasterize SVG in a worker using OffscreenCanvas (if supported) or serialize a rasterized image back to main thread as an ImageBitmap for fast drawImage calls in canvas or texture uploads in WebGL.

## Prioritized experiments (DOM-free)

1. Supercluster + WebGL (deck.gl or Mapbox GL): cluster on client or server and render point sprites as textures. Verify rendering throughput and GPU memory usage. Confirm SVG workflow (rasterize SVG to textures or supply PNG variants).

2. Supercluster + Canvas + Web Worker: cluster in worker, rasterize SVG to ImageBitmap in worker (OffscreenCanvas) if available, send ImageBitmap to main thread for canvas draws. Measure main-thread time and FPS.

3. Canvas + rbush viewport culling: use rbush to fetch visible points and draw them onto a single canvas layer. Use a sprite atlas for marker images to minimize drawImage overhead.

4. Server-side Supercluster + vector tiles + WebGL client: precompute tiles and serve cluster tiles, client requests only needed tiles; client uses WebGL to render tile payloads.

5. Fallback experiments: test different `nodeSize`/radius parameters for clustering and dataset sizes; benchmark rasterization pipelines for SVG -> texture.

## Benchmarking & metrics to collect

- Track: initial load time, cluster/index time, marker draw time on pan/zoom, frames per second during pan, GPU memory usage (for WebGL), and time-to-interactive.
- Measure main-thread work time; record worker thread times for indexing and rasterization.
- Track image/texture decode and upload times, and count of draw calls per frame.

## Real-world notes and UX tradeoffs

- Large-scale rendering always involves tradeoffs between fidelity and performance. The common patterns are:
  - Cluster at low zoom to reduce render count; un-cluster at higher zoom to show individual markers.
  - Rasterize SVGs to textures (PNG/ImageBitmap) for very fast draws. If you need fully vector icons at any zoom, a WebGL vector approach is required but more complex.
  - Expect some "pop-in" when using viewport culling; mitigate with small bbox padding or progressive rendering.
  - Canvas provides easier hit-testing; WebGL requires either CPU-side hit-tests (rbush) or GPU picking techniques.

## Supercluster notes (non-code)

- Supercluster provides flexible clustering options (radius, max/min zoom, node size) and supports property aggregation. Use it to compute clusters and feed to Canvas/WebGL renderers.
- Use `getClusters(bbox, zoom)` semantics when deciding cluster content for a viewport/zoom.

Performance tuning guidance:
- Increase `nodeSize` to trade memory for faster queries when you have very large datasets.
- Tweak `radius` according to pixel density and desired cluster tightness. These are cluster-time settings; rendering remains separate.

## Quick recommended starting config (DOM-free)

- For 10k–100k markers: Supercluster + WebGL renderer (deck.gl or Mapbox GL) with textures for icons.
- For 10k–50k markers and simpler integration: Supercluster + Canvas renderer with Web Worker-based clustering and ImageBitmap sprite atlas.
- For millions of points: server-side Supercluster -> vector tiles + WebGL client.

Suggested tools: `supercluster`, `rbush`, `deck.gl` or `mapbox-gl`, Web Workers, OffscreenCanvas/ImageBitmap for rasterization.

## Follow-ups and next steps

1. Implement a small Supercluster + WebGL POC that: loads clustered data, uses pre-rasterized SVG textures (ImageBitmaps) for icons, and measures FPS for your dataset.
2. Implement a Supercluster + Canvas POC with worker-based clustering and SVG rasterization via OffscreenCanvas. Compare main-thread impact vs WebGL.
3. If you want images for markers, prepare a sprite atlas and test image upload/texture usage; measure decode/upload times.
4. If SVG fidelity at arbitrary scale is required, evaluate SDF or vector-on-GPU solutions (more complex) or accept rasterized Sx variants.

If you'd like I can create the POC branches and benchmark runs; tell me whether you prefer a WebGL-first (best performance) or Canvas-first (easier integration) POC.

---

## Development plan: Supercluster + WebGL implementation

This section provides a step-by-step development plan for implementing the Supercluster + WebGL approach in the cultural-archiver project.

### Architecture overview

- **Data layer**: Supercluster indexes all artwork points and provides clustered data for current viewport/zoom
- **Rendering layer**: deck.gl IconLayer or ScatterplotLayer renders point sprites with textures on WebGL canvas
- **Integration layer**: Vue component wraps deck.gl and synchronizes with Leaflet map state (viewport, zoom, interactions)
- **Icon pipeline**: SVG icons are pre-rasterized to ImageBitmap or loaded as PNG textures; stored in a texture atlas or individual texture cache

### Phase 1: Dependencies and setup

1. Install required packages:
   - `supercluster` - clustering algorithm
   - `deck.gl` - WebGL rendering framework
   - `@deck.gl/core` - core deck.gl functionality
   - `@deck.gl/layers` - standard layers (IconLayer, ScatterplotLayer)
   - `@loaders.gl/images` - optional: image loading utilities

2. Install types (if using TypeScript):
   - `@types/supercluster`
   - deck.gl includes built-in TypeScript definitions

### Phase 2: Clustering logic (backend or frontend composable)

1. Create a clustering service or composable (`src/frontend/composables/useSupercluster.ts`):
   - Initialize Supercluster with configuration (radius: 40, maxZoom: 16, minZoom: 0, minPoints: 2, nodeSize: 64)
   - Load GeoJSON points from artwork API
   - Expose method: `getClusters(bbox, zoom)` to fetch clusters for current viewport
   - Expose method: `getClusterExpansionZoom(clusterId)` for click-to-zoom interaction

2. Decide on client-side vs server-side clustering:
   - **Client-side**: load all artwork data once, run Supercluster in browser (fast for <100k points)
   - **Server-side**: add API endpoint that runs Supercluster and returns clusters for bbox/zoom (better for millions of points)
   - **Hybrid**: use Web Worker to run Supercluster off main thread

### Phase 3: Icon/texture preparation

1. SVG icon rasterization strategy:
   - Option A: Pre-rasterize SVGs to PNG at build time (multiple sizes: 32px, 64px, 128px) and bundle
   - Option B: Rasterize SVGs to ImageBitmap at load time using OffscreenCanvas in a worker
   - Option C: Use existing icon images if already available

2. Create icon utility (`src/frontend/utils/iconAtlas.ts`):
   - Function: `rasterizeSVG(svgString, size)` returns ImageBitmap or data URL
   - Function: `loadIconAtlas(iconMap)` loads and caches all icons
   - Store icons in a Map for quick lookup by artwork type

### Phase 4: WebGL layer component

1. Create Vue component (`src/frontend/components/MapWebGLLayer.vue`):
   - Accept props: `clusters` (from Supercluster), `iconMap`, `zoom`, `onMarkerClick`
   - Use deck.gl `IconLayer` or `ScatterplotLayer` to render points
   - Sync deck.gl viewport with Leaflet map state (lat, lon, zoom, bearing)
   - Handle click events and emit to parent for popup/detail view

2. Deck.gl layer configuration:
   - IconLayer for textured icons with per-point icon selection
   - Use `getIcon` accessor to map cluster properties to cached icon
   - Use `getSize` for dynamic sizing based on cluster count
   - Enable picking for click/hover interactions

3. Leaflet integration:
   - Overlay deck.gl canvas on top of Leaflet map using L.DomOverlay or custom pane
   - Listen to Leaflet `moveend` and `zoomend` events to update deck.gl viewport
   - Ensure deck.gl canvas matches Leaflet container size and position

### Phase 5: Integration with MapView

1. Update `src/frontend/views/MapView.vue`:
   - Import `useSupercluster` composable
   - Import `MapWebGLLayer` component
   - On map ready: initialize Supercluster with artwork data
   - On `moveend`/`zoomend`: compute clusters for viewport and pass to `MapWebGLLayer`
   - Replace or augment existing marker rendering with WebGL layer

2. Feature flag (optional):
   - Add toggle to switch between DOM markers and WebGL rendering for A/B testing
   - Store preference in settings or URL param

### Phase 6: Performance optimization

1. Debounce viewport updates:
   - Use `requestAnimationFrame` or debounce `moveend` events to avoid excessive cluster recomputation
   - Batch updates when zoom and pan happen simultaneously

2. Web Worker for clustering (optional):
   - Move Supercluster indexing and `getClusters` calls to worker
   - Post clustered results back to main thread
   - Measure improvement in main-thread responsiveness

3. Icon caching and preloading:
   - Preload all icons on app init or map mount
   - Use ImageBitmap for zero-copy transfer to GPU
   - Measure texture upload time and GPU memory usage

### Phase 7: Testing and benchmarking

1. Functional tests:
   - Verify clusters appear/disappear correctly on zoom in/out
   - Test click-to-expand for clusters
   - Test individual marker clicks for artwork detail view
   - Verify icon rendering with correct textures

2. Performance benchmarks:
   - Measure FPS during continuous pan/zoom with 10k, 50k, 100k points
   - Track GPU memory usage (Chrome DevTools > Performance > Memory)
   - Measure initial load time and Supercluster indexing time
   - Compare before/after with current DOM-based rendering

3. Visual QA:
   - Confirm icons render crisply at all zoom levels
   - Check for texture artifacts or blurriness
   - Verify cluster styling (size, color, count labels if applicable)

### File structure

```
src/frontend/
  composables/
    useSupercluster.ts          # Clustering logic and Supercluster index
  components/
    MapWebGLLayer.vue            # Deck.gl layer integration
  utils/
    iconAtlas.ts                 # SVG rasterization and icon cache
  views/
    MapView.vue                  # Updated to use WebGL layer
  workers/
    clustering.worker.ts         # Optional: Web Worker for clustering
```

### Configuration and tuning

- Supercluster settings: adjust `radius` (cluster tightness), `maxZoom` (when to stop clustering), `nodeSize` (query performance)
- Deck.gl settings: `getSize` (icon size), `opacity`, `pickable`, `updateTriggers` for reactive updates
- Icon resolution: balance between quality (higher res) and GPU memory (lower res)

### Rollout strategy

1. Implement in a feature branch: `feature/webgl-clustering`
2. Test locally with production dataset export
3. Deploy to staging environment for QA
4. Measure performance with real users (via feature flag)
5. Gradual rollout to production with monitoring

### Expected outcomes

- 10x+ FPS improvement for maps with 10k+ markers
- Smooth 60fps pan/zoom at all scales
- Reduced main-thread blocking (no DOM manipulation per marker)
- GPU memory usage: ~10-50MB for icon textures (depending on atlas size)
- Initial load time: +100-200ms for Supercluster indexing (one-time cost)

### Next steps after implementation

1. Add server-side tile-based clustering for millions of points
2. Implement SDF (signed distance field) icons for crisp scaling at any resolution
3. Add heatmap layer for very dense areas
4. Optimize Web Worker pipeline for clustering and rasterization
