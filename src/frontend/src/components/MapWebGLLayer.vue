<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Deck } from '@deck.gl/core'
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { ClusterFeature } from '../composables/useGridCluster'
import type { IconAtlas } from '../utils/iconAtlas'
import type L from 'leaflet'

interface WebGLLayerProps {
  map: L.Map | null
  clusters: ClusterFeature[]
  iconAtlas: IconAtlas | null
  visible?: boolean
}

const props = withDefaults(defineProps<WebGLLayerProps>(), {
  visible: true
})

const emit = defineEmits(['markerClick', 'clusterClick'])

const containerRef = ref<HTMLDivElement>()
const deck = ref<Deck | null>(null)

/**
 * Initialize deck.gl with Leaflet map sync
 */
function initDeck() {
  if (!containerRef.value || !props.map) return

  const mapContainer = props.map.getContainer()
  const canvas = document.createElement('canvas')
  canvas.id = 'deck-canvas'
  canvas.style.position = 'absolute'
  canvas.style.pointerEvents = 'all'
  canvas.style.zIndex = '400' // Above markers (200) but below controls (800+)
  mapContainer.appendChild(canvas)

  deck.value = new Deck({
    canvas: canvas,
    initialViewState: getLeafletViewState(),
    controller: false, // Leaflet handles all interactions
    layers: []
  })

  syncViewport()
}

/**
 * Get current Leaflet viewport as deck.gl view state
 */
function getLeafletViewState() {
  if (!props.map) return { longitude: 0, latitude: 0, zoom: 0 }

  const center = props.map.getCenter()
  const zoom = props.map.getZoom()

  return {
    longitude: center.lng,
    latitude: center.lat,
    zoom: zoom - 1, // deck.gl zoom is offset by 1 from Leaflet
    pitch: 0,
    bearing: 0
  }
}

/**
 * Sync deck.gl viewport with Leaflet map on move/zoom
 */
function syncViewport() {
  if (!props.map || !deck.value) return

  const handleViewportChange = () => {
    if (!deck.value) return
    deck.value.setProps({
      viewState: getLeafletViewState()
    })
  }

  // Sync on every Leaflet map move
  props.map.on('move', handleViewportChange)
  props.map.on('zoom', handleViewportChange)
  props.map.on('zoomend', handleViewportChange)

  // Initial sync
  handleViewportChange()
}

/**
 * Update deck.gl layers with current cluster data
 */
function updateLayers(): void {
  if (!deck.value) return

  // Color mapping for different artwork types
  const colorMap: Record<string, [number, number, number]> = {
    sculpture: [244, 63, 94], // red-500
    mural: [59, 130, 246], // blue-500
    installation: [168, 85, 247], // purple-500
    default: [107, 114, 128] // gray-500
  }

  // ScatterplotLayer for rendering markers and clusters
  const scatterplotLayer = new ScatterplotLayer({
    id: 'artwork-clusters',
    data: props.clusters,
    pickable: true,
    opacity: 0.8,
    stroked: true,
    filled: true,
    // Render radii in screen pixels so we can use pixel-based cluster radii
    radiusUnits: 'pixels',
    radiusScale: 1,
  radiusMinPixels: 10,  // Minimum marker size for mobile
  radiusMaxPixels: 500, // Increased maximum so very large clusters can fit labels
    lineWidthMinPixels: 2,
    getPosition: (d: ClusterFeature) => [d.geometry.coordinates[0], d.geometry.coordinates[1]],
    getRadius: (d: ClusterFeature) => {
      // Get current zoom level
      const currentZoom = props.map?.getZoom() || 13

      if (d.properties.cluster) {
        // If the clustering function has supplied a pixel radius, use it directly
        const suppliedPx = (d.properties as any).cluster_radius_pixels as number | undefined
        if (typeof suppliedPx === 'number' && suppliedPx > 0) {
          return suppliedPx
        }
        const pointCount = d.properties.point_count || 10

        // Compute label text first to ensure we size the circle appropriately
        const count = pointCount
        let label = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count.toString()
        
        // Determine font size used by TextLayer for this zoom
        let fontSize: number
        if (currentZoom <= 8) fontSize = 28
        else if (currentZoom <= 10) fontSize = 24
        else if (currentZoom <= 12) fontSize = 20
        else if (currentZoom <= 14) fontSize = 16
        else fontSize = 14

        // Calculate minimum radius needed to contain the text
        // Use 0.7 multiplier for better width estimation (bold font is wider)
        // Add 25px padding to ensure text never touches circle edge
        const approxTextWidth = label.length * fontSize * 0.7
        const minRadiusForText = Math.ceil(approxTextWidth / 2) + 25

        // Base sizes that provide good starting points at each zoom
        // These are now just minimums - actual size will be at least minRadiusForText
        let baseSize: number
        if (currentZoom <= 8) {
          baseSize = 150
        } else if (currentZoom <= 10) {
          baseSize = 120
        } else if (currentZoom <= 11) {
          baseSize = 100
        } else if (currentZoom <= 12) {
          baseSize = 80
        } else if (currentZoom <= 13) {
          baseSize = 70  // Increased from 60
        } else if (currentZoom <= 14) {
          baseSize = 60  // Increased from 45
        } else if (currentZoom <= 15) {
          baseSize = 50  // Increased from 35
        } else {
          baseSize = 40  // Increased from 20
        }

        // Count-based bonus (logarithmic) - provides additional size for larger clusters
        const countScale = Math.log(pointCount + 1) * 10  // Increased from 8 to 10

        // Final size is the maximum of base+bonus and text requirement
        const finalSize = Math.max(baseSize + countScale, minRadiusForText)

        // Cap by radiusMaxPixels (deck.gl will clamp when rendering)
        return finalSize
      }

      // Individual markers: larger for easier mobile tapping
      // Scale single-marker size at lower zooms so markers remain visible and tappable when zoomed out.
      let markerSize: number
      if (currentZoom <= 8) {
        markerSize = 20 // 40px diameter at very low zoom
      } else if (currentZoom <= 10) {
        markerSize = 16 // 32px diameter
      } else if (currentZoom <= 12) {
        markerSize = 14 // 28px diameter
      } else if (currentZoom <= 14) {
        markerSize = 12 // 24px diameter
      } else {
        markerSize = 10 // 20px diameter at high zoom
      }
      return markerSize
    },
    getFillColor: (d: ClusterFeature): [number, number, number] => {
      // Clusters are orange
      if (d.properties.cluster) {
        return [251, 146, 60] // orange-400
      }
      // Individual markers use their type color
      const type = (d.properties.type as string) || 'default'
      const color = colorMap[type]
      if (color) return color
      return [107, 114, 128] // fallback to gray-500
    },
    getLineColor: [255, 255, 255], // white outline
    getLineWidth: 2,
    onClick: (info: any) => {
      if (info.object) {
        const feature = info.object as ClusterFeature
        if (feature.properties.cluster) {
          emit('clusterClick', feature)
        } else {
          emit('markerClick', feature)
        }
      }
    },
    updateTriggers: {
      getPosition: props.clusters,
      getRadius: props.clusters,
      getFillColor: props.clusters
    }
  })

  // TextLayer for displaying point counts on clusters
  // To avoid deck.gl trying to dereference Vue proxies we create a plain JS copy of cluster data
  const clustersDataPlain: any[] = props.clusters.map((c: ClusterFeature) => ({
    type: c.type,
    id: c.id,
    properties: { ...(c.properties as Record<string, unknown>) },
    geometry: { type: c.geometry.type, coordinates: [c.geometry.coordinates[0], c.geometry.coordinates[1]] }
  }))

  const clusterData: any[] = clustersDataPlain.filter((d: any) => d.properties && d.properties.cluster)

  const textLayer = new TextLayer({
    id: 'cluster-labels',
  data: clusterData,
    pickable: false,
    getPosition: (d: ClusterFeature) => [d.geometry.coordinates[0], d.geometry.coordinates[1]],
    getText: (d: ClusterFeature) => {
      const count = d.properties.point_count || 0
      // Use abbreviated format for large numbers (e.g., 1.2k)
      if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`
      }
      return count.toString()
    },
    getSize: () => {
      const currentZoom = props.map?.getZoom() || 13

      // Text size scales smoothly with zoom level to match larger cluster markers
      if (currentZoom <= 8) {
        return 28  // Very large text for massive clusters at low zoom
      } else if (currentZoom <= 9) {
        return 26  // Slightly smaller at zoom 9
      } else if (currentZoom <= 10) {
        return 24  // Large text at zoom 10
      } else if (currentZoom <= 12) {
        return 20  // Medium-large text at zoom 11-12
      } else if (currentZoom <= 14) {
        return 16  // Medium text at zoom 13-14
      } else {
        return 14  // Normal text at zoom 15+
      }
    },
    getColor: [255, 255, 255], // white text
    getAngle: 0,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'bold',
    updateTriggers: {
      getPosition: clusterData,
      getText: clusterData,
      getSize: [clusterData, props.map?.getZoom()]
    }
  })

  // Use plain data for scatterplot as well to avoid reactive proxies
  const scatterDataPlain = clustersDataPlain as any[]

  // Build layers with plain arrays so deck.gl doesn't interact with Vue proxies
  // (Don't call setProps on layer instances - instead create new Layer instances
  // with the desired props and pass them to Deck.)
  const finalScatter = new ScatterplotLayer({ ...scatterplotLayer.props, data: scatterDataPlain })
  const finalText = new TextLayer({ ...textLayer.props, data: clusterData })

  deck.value.setProps({ layers: [finalScatter, finalText] })
}

/**
 * Resize deck.gl canvas to match Leaflet container
 */
function handleResize() {
  if (!deck.value || !props.map) return

  const container = props.map.getContainer()
  const canvas = document.getElementById('deck-canvas') as HTMLCanvasElement

  if (canvas) {
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight
    deck.value.setProps({
      width: container.clientWidth,
      height: container.clientHeight
    })
  }
}

// Watch for cluster data changes
watch(() => props.clusters, () => {
  updateLayers()
}, { deep: true })

// Watch for icon atlas changes
watch(() => props.iconAtlas, () => {
  updateLayers()
})

// Watch for visibility changes
watch(() => props.visible, () => {
  updateLayers()
})

// Watch for map changes
watch(() => props.map, (newMap: L.Map | null) => {
  if (newMap && !deck.value) {
    nextTick(() => {
      initDeck()
      updateLayers()
    })
  }
})

onMounted(() => {
  if (props.map) {
    nextTick(() => {
      initDeck()
      updateLayers()
    })
  }

  // Handle window resize
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)

  // Clean up deck.gl instance
  if (deck.value) {
    deck.value.finalize()
    deck.value = null
  }

  // Remove canvas
  const canvas = document.getElementById('deck-canvas')
  if (canvas) {
    canvas.remove()
  }
})
</script>

<template>
  <!-- Overlay canvas for deck.gl WebGL rendering -->
  <div ref="containerRef" class="webgl-overlay"></div>
</template>

<style scoped>
.webgl-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* Let Leaflet handle interactions */
  z-index: 400;
}
</style>
