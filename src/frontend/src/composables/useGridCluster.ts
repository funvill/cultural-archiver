/**
 * Composable for simple grid-based marker clustering
 * Alternative to Supercluster with more intuitive, predictable clustering behavior
 * 
 * How it works:
 * - Divides the map into a grid at each zoom level
 * - Points in the same grid cell form a cluster
 * - Grid size determines cluster density (larger = fewer, bigger clusters)
 */
import { ref, computed, type ComputedRef } from 'vue'

export interface ArtworkPoint {
  id: string
  lat: number
  lon: number
  title: string
  type: string
  [key: string]: unknown
}

export interface ClusterFeature {
  type: 'Feature'
  id?: string
  properties: {
    cluster?: boolean
    cluster_id?: string
    point_count?: number
    point_count_abbreviated?: string
    // Store first point's properties for single-point clusters
    id?: string
    title?: string
    type?: string
    [key: string]: unknown
  }
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
}

export interface GridClusterConfig {
  /**
   * Grid cell size in pixels at each zoom level
   * Larger = fewer, bigger clusters
   * Smaller = more, smaller clusters
   * 
   * Examples:
   * - 50px: Very tight clustering, many small clusters
   * - 100px: Moderate clustering (default)
   * - 200px: Aggressive clustering, few large clusters
   */
  gridSize?: number
  
  /**
   * Minimum zoom level where clustering happens
   * Below this zoom, all points cluster
   */
  minZoom?: number
  
  /**
   * Maximum zoom level where clustering happens
   * Above this zoom, individual points show
   * 
   * Example: maxZoom: 14 means:
   * - Zoom 0-14: Show clusters
   * - Zoom 15+: Show individual points
   */
  maxZoom?: number
  
  /**
   * Enable debug logging
   */
  log?: boolean
  /**
   * Percentage growth per zoom-level below maxZoom (e.g. 0.12 = 12% larger per zoom step)
   * As zoom decreases (smaller zoom numbers) cluster markers grow by this percentage per zoom step.
   */
  sizeIncreasePerZoom?: number
}

const DEFAULT_CONFIG: GridClusterConfig = {
  gridSize: 100,  // 100px grid cells - good balance
  minZoom: 0,     // Cluster at all zoom levels
  maxZoom: 14,    // Stop clustering at zoom 14 (show individuals at 15+)
  log: false,
  // default: 12% growth per zoom-step below maxZoom
  sizeIncreasePerZoom: 0.12
}

export interface UseGridClusterReturn {
  isReady: ComputedRef<boolean>
  pointCount: ComputedRef<number>
  indexingTime: ComputedRef<number>
  loadPoints: (artworkData: ArtworkPoint[]) => void
  getClusters: (bbox: [number, number, number, number], zoom: number) => ClusterFeature[]
  clear: () => void
}

/**
 * Convert longitude to pixel X coordinate at given zoom level
 */
function lonToPixel(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * Math.pow(2, zoom) * 256
}

/**
 * Convert latitude to pixel Y coordinate at given zoom level
 */
function latToPixel(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom) * 256
}

/**
 * Convert pixel X coordinate to longitude at given zoom level
 * (Reserved for future viewport filtering)
 */
function _pixelToLon(x: number, zoom: number): number {
  return (x / (Math.pow(2, zoom) * 256)) * 360 - 180
}

/**
 * Convert pixel Y coordinate to latitude at given zoom level
 * (Reserved for future viewport filtering)
 */
function _pixelToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / (Math.pow(2, zoom) * 256)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export function useGridCluster(config: GridClusterConfig = {}): UseGridClusterReturn {
  const points = ref<ArtworkPoint[]>([])
  const isReady = ref(false)
  const pointCount = ref(0)
  const indexingTime = ref(0)

  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  /**
   * Load artwork points into the clustering system
   */
  function loadPoints(artworkData: ArtworkPoint[]): void {
    const startTime = performance.now()
    
    points.value = artworkData
    pointCount.value = artworkData.length
    isReady.value = true
    indexingTime.value = performance.now() - startTime

    if (mergedConfig.log) {
      console.log(`[GridCluster] Loaded ${pointCount.value} points in ${indexingTime.value.toFixed(2)}ms`)
      console.log(`[GridCluster] Config: gridSize=${mergedConfig.gridSize}px, maxZoom=${mergedConfig.maxZoom}`)
    }
  }

  /**
   * Get clusters for current viewport and zoom level
   * 
   * @param bbox - [west, south, east, north] in degrees - filters to viewport
   * @param zoom - Current map zoom level
   * @returns Array of cluster features
   */
  function getClusters(bbox: [number, number, number, number], zoom: number): ClusterFeature[] {
    if (!isReady.value || points.value.length === 0) {
      console.warn('[GridCluster] Not ready or no points loaded')
      return []
    }

    const startTime = performance.now()
    const clusterZoom = Math.floor(zoom)
    
    // Viewport culling: only process points in the visible area
    // Add 10% padding to avoid pop-in at edges
    const [west, south, east, north] = bbox
    const lonPadding = (east - west) * 0.1
    const latPadding = (north - south) * 0.1
    
    const visiblePoints = points.value.filter(point => 
      point.lon >= west - lonPadding &&
      point.lon <= east + lonPadding &&
      point.lat >= south - latPadding &&
      point.lat <= north + latPadding
    )

    if (mergedConfig.log) {
      console.log(`[GridCluster] Viewport culling: ${visiblePoints.length}/${points.value.length} points visible`)
    }

    // If zoom is above maxZoom, return individual points (no clustering)
    if (clusterZoom > (mergedConfig.maxZoom ?? 14)) {
      const individualPoints: ClusterFeature[] = visiblePoints.map(point => ({
        type: 'Feature',
        id: point.id,
        properties: {
          cluster: false,
          ...point
        },
        geometry: {
          type: 'Point',
          coordinates: [point.lon, point.lat]
        }
      }))

      if (mergedConfig.log) {
        console.log(`[GridCluster] Zoom ${clusterZoom} > maxZoom ${mergedConfig.maxZoom}, returning ${individualPoints.length} individual points`)
      }

      return individualPoints
    }

    // Create grid clusters (only from visible points)
    const baseGridSize = mergedConfig.gridSize ?? 100

    // This keeps clustering deterministic and predictable across viewports.
    // Higher multipliers at low zoom levels create more spacing between clusters to prevent overlaps.
    const zoomMultipliers: Record<number, number> = {
      7: 2.5,   // Very aggressive clustering with large spacing
      8: 2.2,   // Aggressive clustering
      9: 2.0,   // More spacing between clusters
      10: 1.8,  // Moderate spacing
      11: 1.5,  // Standard spacing
      12: 1.3   // Tighter spacing as zoom increases
    }

    // Use static multiplier for the current zoom or 1 if none defined
    let multiplier = zoomMultipliers[clusterZoom] ?? 1

    // Clamp multiplier to a reasonable range in case config changes
    multiplier = Math.min(Math.max(multiplier, 1.0), 4.0)
    

    const gridSize = Math.max(8, Math.round(baseGridSize * multiplier))
    const gridMap = new Map<string, ArtworkPoint[]>()

    // Assign each visible point to a grid cell
    for (const point of visiblePoints) {
      // Map longitude/latitude to pixel grid at current zoom and bucket by effective grid size
      const x = Math.floor(lonToPixel(point.lon, clusterZoom) / gridSize)
      const y = Math.floor(latToPixel(point.lat, clusterZoom) / gridSize)
      const gridKey = `${x},${y}`

      if (!gridMap.has(gridKey)) {
        gridMap.set(gridKey, [])
      }
      gridMap.get(gridKey)!.push(point)
    }

    // Convert grid cells to cluster features
    // We'll build clusters, compute a pixel radius (so text fits inside),
    // then resolve overlaps in pixel space and convert adjusted positions back to lon/lat.
    type TempCluster = {
      id: string
      isCluster: boolean
      count: number
      centroidLat: number
      centroidLon: number
      // pixel positions used for collision resolution
      px: number
      py: number
      radiusPx: number
      // original single point (for non-cluster)
      singlePoint?: ArtworkPoint
    }

    const tempClusters: TempCluster[] = []
    let clusterIdCounter = 0

    for (const [_gridKey, gridPoints] of gridMap.entries()) {
      if (gridPoints.length === 1) {
        const point = gridPoints[0]!
        const id = point.id
        const px = lonToPixel(point.lon, clusterZoom)
        const py = latToPixel(point.lat, clusterZoom)
        // single-point marker radius (approx marker + padding)
        const radiusPx = Math.max(10, Math.round((mergedConfig.gridSize ?? 100) * 0.08))

        tempClusters.push({
          id,
          isCluster: false,
          count: 1,
          centroidLat: point.lat,
          centroidLon: point.lon,
          px,
          py,
          radiusPx,
          singlePoint: point
        })
      } else {
        // centroid
        let sumLat = 0
        let sumLon = 0
        for (const point of gridPoints) {
          sumLat += point.lat
          sumLon += point.lon
        }

        const centroidLat = sumLat / gridPoints.length
        const centroidLon = sumLon / gridPoints.length
        const count = gridPoints.length
        const clusterId = `cluster_${clusterIdCounter++}`

        // Estimate text width for count label. Conservative average char width.
        const countStr = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : `${count}`
        const avgCharPx = 8 // average char width in px at default font-size
        const textWidth = Math.max(16, Math.round(countStr.length * avgCharPx) + 8)

  // base visual radius depends on baseGridSize to keep clusters legible at different configs
  const base = Math.round((baseGridSize * 0.12) * (multiplier ?? 1))

  // Normalize configured sizeIncreasePerZoom: accept either fraction (0.12) or percent (12 or 12.0)
  let per = mergedConfig.sizeIncreasePerZoom ?? 0.12
  if (per > 1) per = per / 100

  // number of zoom steps below maxZoom (positive when clusterZoom < maxZoom)
  const zoomStepsBelowMax = Math.max(0, (mergedConfig.maxZoom ?? 14) - clusterZoom)
  let sizeMultiplier = 1 + zoomStepsBelowMax * per
  // clamp multiplier to a sane range
  sizeMultiplier = Math.min(Math.max(sizeMultiplier, 1.0), 4.0)

  let radiusPx = Math.max(12, Math.round(textWidth / 2) + 8, base)
  radiusPx = Math.round(radiusPx * sizeMultiplier)

        const px = lonToPixel(centroidLon, clusterZoom)
        const py = latToPixel(centroidLat, clusterZoom)

        tempClusters.push({
          id: clusterId,
          isCluster: true,
          count,
          centroidLat,
          centroidLon,
          px,
          py,
          radiusPx
        })
      }
    }

    // Resolve collisions between cluster circles in pixel space.
    // Simple iterative push-apart algorithm (O(n^2) but clusters are usually small per viewport).
    const maxIters = 12
    const overlapPadding = 4 // extra pixels between circles

    for (let iter = 0; iter < maxIters; iter++) {
      let moved = false
      for (let i = 0; i < tempClusters.length; i++) {
        for (let j = i + 1; j < tempClusters.length; j++) {
          const a = tempClusters[i]!
          const b = tempClusters[j]!

          // Skip pushing single points very aggressively; keep their positions mostly fixed
          // but still avoid visual overlap with cluster circles.
          const dx = b.px - a.px
          const dy = b.py - a.py
          let dist = Math.sqrt(dx * dx + dy * dy)
          const minDist = a.radiusPx + b.radiusPx + overlapPadding

          if (dist < 0.0001) {
            // practically identical positions - jitter slightly
            const jitter = 1 + (iter % 3)
            const angle = (Math.random() - 0.5) * Math.PI * 2
            a.px -= Math.cos(angle) * jitter
            a.py -= Math.sin(angle) * jitter
            b.px += Math.cos(angle) * jitter
            b.py += Math.sin(angle) * jitter
            moved = true
            dist = Math.sqrt((b.px - a.px) ** 2 + (b.py - a.py) ** 2)
          }

          if (dist < minDist) {
            const overlap = (minDist - dist) / 2
            // direction vector from a to b
            const ux = dx / (dist || 1)
            const uy = dy / (dist || 1)

            // reduce movement for single points so they don't drift too far
            const aFactor = a.isCluster ? 1 : 0.3
            const bFactor = b.isCluster ? 1 : 0.3

            a.px -= ux * overlap * aFactor
            a.py -= uy * overlap * aFactor
            b.px += ux * overlap * bFactor
            b.py += uy * overlap * bFactor
            moved = true
          }
        }
      }
      if (!moved) break
    }

    // Build final ClusterFeature array from resolved pixel positions
    const clusters: ClusterFeature[] = []
    for (const tc of tempClusters) {
      // convert pixel back to lon/lat for rendering
      const lon = _pixelToLon(tc.px, clusterZoom)
      const lat = _pixelToLat(tc.py, clusterZoom)

      if (!tc.isCluster && tc.singlePoint) {
        clusters.push({
          type: 'Feature',
          id: tc.singlePoint.id,
          properties: {
            cluster: false,
            ...tc.singlePoint
          },
          geometry: {
            type: 'Point',
            coordinates: [tc.singlePoint.lon, tc.singlePoint.lat]
          }
        })
      } else {
        const count = tc.count
        let countAbbr = count.toString()
        if (count >= 1000) countAbbr = `${(count / 1000).toFixed(1)}k`

        clusters.push({
          type: 'Feature',
          id: tc.id,
          properties: {
            cluster: true,
            cluster_id: tc.id,
            point_count: tc.count,
            point_count_abbreviated: countAbbr,
            // Provide pixel radius to renderer so it can size the circle and center text correctly
            cluster_radius_pixels: tc.radiusPx
          },
          geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          }
        })
      }
    }

    if (mergedConfig.log) {
      const clusterCount = clusters.filter(c => c.properties.cluster).length
      const singleCount = clusters.filter(c => !c.properties.cluster).length
      const elapsed = performance.now() - startTime
      console.log(`[GridCluster] Zoom ${clusterZoom}: gridSize=${gridSize}px (base ${baseGridSize}px * mult ${multiplier}) -> ${clusterCount} clusters + ${singleCount} singles = ${clusters.length} total (${elapsed.toFixed(2)}ms)`)
    }

    return clusters
  }

  /**
   * Clear all points and reset state
   */
  function clear(): void {
    points.value = []
    isReady.value = false
    pointCount.value = 0
    indexingTime.value = 0
    
    if (mergedConfig.log) {
      console.log('[GridCluster] Cleared all points')
    }
  }

  return {
    isReady: computed(() => isReady.value),
    pointCount: computed(() => pointCount.value),
    indexingTime: computed(() => indexingTime.value),
    loadPoints,
    getClusters,
    clear
  }
}
