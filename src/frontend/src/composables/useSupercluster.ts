/**
 * Composable for Supercluster-based marker clustering
 * Provides high-performance clustering for tens of thousands of markers
 */
import { ref, computed, type ComputedRef } from 'vue'
import Supercluster from 'supercluster'

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
  id?: number
  properties: {
    cluster?: boolean
    cluster_id?: number
    point_count?: number
    point_count_abbreviated?: string
    [key: string]: unknown
  }
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
}

export interface SuperclusterConfig {
  radius?: number
  maxZoom?: number
  minZoom?: number
  minPoints?: number
  nodeSize?: number
  extent?: number
  log?: boolean
}

const DEFAULT_CONFIG: SuperclusterConfig = {
  radius: 200,  // Cluster radius in pixels (at maxZoom). Higher = more aggressive clustering
  maxZoom: 10,  // Generate clusters up to zoom 10 (lower = bigger clusters at low zoom)
  minZoom: 0,   // Minimum zoom level at which clusters are generated
  minPoints: 2, // Minimum points to form a cluster (2 = any nearby points cluster)
  nodeSize: 64, // Size of the KD-tree node. Affects performance and memory usage
  extent: 512,  // (Tiles) Tile extent. Radius is calculated relative to this value
  log: true     // Enable logging for debugging
}

export interface UseSuperclusterReturn {
  isReady: ComputedRef<boolean>
  pointCount: ComputedRef<number>
  indexingTime: ComputedRef<number>
  loadPoints: (artworkData: ArtworkPoint[]) => void
  getClusters: (bbox: [number, number, number, number], zoom: number) => ClusterFeature[]
  getClusterExpansionZoom: (clusterId: number) => number
  getClusterLeaves: (clusterId: number, limit?: number, offset?: number) => ClusterFeature[]
  getClusterChildren: (clusterId: number) => ClusterFeature[]
  clear: () => void
}

export function useSupercluster(config: SuperclusterConfig = {}): UseSuperclusterReturn {
  const index = ref<Supercluster | null>(null)
  const isReady = ref(false)
  const pointCount = ref(0)
  const indexingTime = ref(0)

  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  /**
   * Initialize Supercluster index with artwork points
   */
  function loadPoints(artworkData: ArtworkPoint[]): void {
    const startTime = performance.now()

    // Convert artwork data to GeoJSON features
    const geoJsonPoints: ClusterFeature[] = artworkData.map((artwork) => ({
      type: 'Feature',
      properties: {
        id: artwork.id,
        title: artwork.title,
        type: artwork.type,
        cluster: false
      },
      geometry: {
        type: 'Point',
        coordinates: [artwork.lon, artwork.lat]
      }
    }))

    // Create Supercluster index
    const cluster = new Supercluster(mergedConfig)
    cluster.load(geoJsonPoints)

    index.value = cluster
    pointCount.value = geoJsonPoints.length
    isReady.value = true
    indexingTime.value = performance.now() - startTime

    if (mergedConfig.log) {
      console.log(`Supercluster indexed ${pointCount.value} points in ${indexingTime.value.toFixed(2)}ms`)
    }
  }

  /**
   * Get clusters for current viewport bounds and zoom level
   * @param bbox - [west, south, east, north] in degrees
   * @param zoom - Map zoom level (integer)
   */
  function getClusters(bbox: [number, number, number, number], zoom: number): ClusterFeature[] {
    if (!index.value || !isReady.value) {
      console.warn('Supercluster not ready')
      return []
    }

    const startTime = performance.now()
    const clusters = index.value.getClusters(bbox, Math.floor(zoom))
    
    if (mergedConfig.log) {
      console.log(`getClusters returned ${clusters.length} items in ${(performance.now() - startTime).toFixed(2)}ms`)
    }

    return clusters as ClusterFeature[]
  }

  /**
   * Get the zoom level at which a cluster will expand into children
   * @param clusterId - The cluster_id from cluster properties
   */
  function getClusterExpansionZoom(clusterId: number): number {
    if (!index.value || !isReady.value) {
      return mergedConfig.maxZoom || 16
    }
    return index.value.getClusterExpansionZoom(clusterId)
  }

  /**
   * Get all individual points within a cluster
   * @param clusterId - The cluster_id from cluster properties
   * @param limit - Max number of points to return
   * @param offset - Pagination offset
   */
  function getClusterLeaves(
    clusterId: number,
    limit: number = 10,
    offset: number = 0
  ): ClusterFeature[] {
    if (!index.value || !isReady.value) {
      return []
    }
    return index.value.getLeaves(clusterId, limit, offset) as ClusterFeature[]
  }

  /**
   * Get immediate children of a cluster at the next zoom level
   * @param clusterId - The cluster_id from cluster properties
   */
  function getClusterChildren(clusterId: number): ClusterFeature[] {
    if (!index.value || !isReady.value) {
      return []
    }
    return index.value.getChildren(clusterId) as ClusterFeature[]
  }

  /**
   * Clear the index and reset state
   */
  function clear(): void {
    index.value = null
    isReady.value = false
    pointCount.value = 0
    indexingTime.value = 0
  }

  return {
    // State
    isReady: computed(() => isReady.value),
    pointCount: computed(() => pointCount.value),
    indexingTime: computed(() => indexingTime.value),

    // Methods
    loadPoints,
    getClusters,
    getClusterExpansionZoom,
    getClusterLeaves,
    getClusterChildren,
    clear
  }
}
