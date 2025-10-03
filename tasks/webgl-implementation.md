# Supercluster + WebGL Implementation

This implementation provides high-performance marker rendering for tens of thousands of points using Supercluster clustering and WebGL rendering via deck.gl.

## Installation

### Required Dependencies

Run the following commands to install the required packages:

```powershell
# Navigate to frontend directory
cd src/frontend

# Install core packages
npm install supercluster deck.gl

# Install deck.gl modules (use quotes for PowerShell)
npm install "@deck.gl/core" "@deck.gl/layers"

# Install optional loaders
npm install "@loaders.gl/images"

# Install TypeScript types
npm install --save-dev "@types/supercluster"
```

Alternatively, add these to `src/frontend/package.json` dependencies:

```json
{
  "dependencies": {
    "supercluster": "^8.0.1",
    "deck.gl": "^9.0.0",
    "@deck.gl/core": "^9.0.0",
    "@deck.gl/layers": "^9.0.0",
    "@loaders.gl/images": "^4.0.0"
  },
  "devDependencies": {
    "@types/supercluster": "^7.1.3"
  }
}
```

Then run `npm install` in the frontend directory.

## Implementation Status

### Completed ✅

✅ Development plan added to `/tasks/plan-map-performance-issues.md`  
✅ Dependencies installed (supercluster, deck.gl, @deck.gl/core, @deck.gl/layers, @loaders.gl/images)  
✅ Supercluster composable created (`src/frontend/src/composables/useSupercluster.ts`)  
✅ Icon atlas utility created (`src/frontend/src/utils/iconAtlas.ts`)  
✅ WebGL layer component created (`src/frontend/src/components/MapWebGLLayer.vue`)  
✅ All linting errors fixed  

### Ready for Integration 🔄

⏳ **Next Step:** Integrate into `MapComponent.vue` (see [Integration Guide](./webgl-integration-guide.md))  
⏳ Test with real artwork data  
⏳ Benchmark performance (FPS, GPU memory, indexing time)  
⏳ A/B test with feature flag  

### Pending ⚠️

⏳ Performance testing and benchmarking  
⏳ Production deployment with feature flag  
⏳ User acceptance testing  

## Files Created

1. **`src/frontend/src/composables/useSupercluster.ts`**
   - Provides Supercluster index management
   - Methods: `loadPoints()`, `getClusters()`, `getClusterExpansionZoom()`
   - Configurable clustering parameters (radius, maxZoom, minPoints, nodeSize)
   - Performance logging and timing metrics

2. **`src/frontend/src/utils/iconAtlas.ts`**
   - SVG rasterization to ImageBitmap/Image
   - Icon atlas creation and caching
   - Default SVG icons for common artwork types
   - GPU-friendly texture preparation

3. **`src/frontend/src/components/MapWebGLLayer.vue`**
   - deck.gl IconLayer integration with Leaflet
   - Syncs viewport with Leaflet map (move/zoom events)
   - Handles cluster and marker rendering via WebGL
   - Click event handling for clusters (expand) and markers (view)

## Next Steps

1. **Install dependencies** (see Installation section above)

2. **Create WebGL layer component** (`src/frontend/components/MapWebGLLayer.vue`)
   - Integrate deck.gl IconLayer or ScatterplotLayer
   - Sync with Leaflet map viewport
   - Handle click/hover interactions
   - Render clusters and individual markers

3. **Update MapView** (`src/frontend/views/MapView.vue`)
   - Initialize Supercluster with artwork data
   - Pass clusters to WebGL layer on map move/zoom
   - Add feature flag for A/B testing

4. **Test and benchmark**
   - Measure FPS with 10k, 50k, 100k markers
   - Compare with current DOM-based rendering
   - Profile GPU memory usage

## Usage Example

### Basic Clustering

```typescript
import { useSupercluster } from '@/composables/useSupercluster'

const clustering = useSupercluster({
  radius: 40,
  maxZoom: 16,
  minPoints: 2,
  log: true // Enable performance logging
})

// Load artwork data
clustering.loadPoints(artworkData)

// Get clusters for current viewport
const bounds = map.getBounds()
const bbox = [
  bounds.getWest(),
  bounds.getSouth(),
  bounds.getEast(),
  bounds.getNorth()
]
const clusters = clustering.getClusters(bbox, map.getZoom())
```

### Icon Atlas

```typescript
import { createIconAtlas, DEFAULT_ICONS } from '@/utils/iconAtlas'

const iconConfigs = [
  { name: 'sculpture', svg: DEFAULT_ICONS.sculpture, size: 64 },
  { name: 'mural', svg: DEFAULT_ICONS.mural, size: 64 },
  { name: 'cluster', svg: DEFAULT_ICONS.cluster, size: 64 }
]

const atlas = await createIconAtlas(iconConfigs)
```

## Configuration

### Supercluster Options

- **radius** (default: 40): Cluster radius in pixels
- **maxZoom** (default: 16): Maximum zoom level for clustering
- **minZoom** (default: 0): Minimum zoom level for clustering
- **minPoints** (default: 2): Minimum points required to form a cluster
- **nodeSize** (default: 64): KD-tree node size (affects query performance)

### Performance Tuning

- Increase `nodeSize` (64-512) for faster queries with large datasets
- Adjust `radius` for tighter or looser clustering
- Use `log: true` during development to measure indexing time
- Pre-load icon atlas on app initialization

## Troubleshooting

### PowerShell Package Installation Issues

If you encounter issues with `@` symbols in package names, use quotes:

```powershell
npm install "@deck.gl/core"
```

Or use the `--prefix` flag:

```powershell
npm --prefix src/frontend install supercluster
```

### TypeScript Errors

Make sure to install TypeScript definitions:

```powershell
npm install --save-dev "@types/supercluster"
```

Deck.gl includes built-in TypeScript definitions.

## Performance Expectations

Based on deck.gl and Supercluster benchmarks:

- **10k markers**: 60fps smooth pan/zoom
- **50k markers**: 60fps with clustering enabled
- **100k+ markers**: 60fps with optimized clustering and viewport culling
- **GPU memory**: ~10-50MB for icon textures (depending on atlas size)
- **Indexing time**: ~100-200ms for 100k points (one-time cost)

## References

- [Supercluster GitHub](https://github.com/mapbox/supercluster)
- [deck.gl Documentation](https://deck.gl/)
- [Mapbox Blog: Clustering Millions of Points](https://blog.mapbox.com/clustering-millions-of-points-on-a-map-with-supercluster-272046ec5c97)
