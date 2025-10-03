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
  // Allow pointer events so we can show hand cursor when over markers
  // Keep canvas non-interactive so Leaflet handles dragging/panning;
  // we'll listen on the map container and query deck for picks.
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '400' // Above markers (200) but below controls (800+)
  mapContainer.appendChild(canvas)

  // Cast Deck constructor to any to avoid TypeScript instantiation depth errors
  deck.value = new (Deck as any)({
    canvas: canvas,
    initialViewState: getLeafletViewState(),
    controller: false, // Leaflet handles all interactions
    layers: []
  })

  // Add container-level mouse listeners so we can pick deck objects without
  // blocking Leaflet's pan/drag handling. The canvas remains pointer-events:none.
  try {
    const container = props.map.getContainer();

  // track hover id if needed in future (not used currently)

    const handleMove = (ev: MouseEvent) => {
      if (!deck.value) return;
      try {
        const rect = (container as HTMLElement).getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        // deck.pickObject expects screen coordinates
        const pickInfo = (deck.value as any).pickObject({x, y});
        if (pickInfo && pickInfo.object) {
          (container as HTMLElement).style.cursor = 'pointer';
        } else {
          (container as HTMLElement).style.cursor = '';
        }
      } catch (e) {
        // ignore
      }
    };

    const handleClick = (ev: MouseEvent) => {
      if (!deck.value) return;
      try {
        const rect = (container as HTMLElement).getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        const pickInfo = (deck.value as any).pickObject({x, y});
        if (pickInfo && pickInfo.object) {
          const obj = pickInfo.object as ClusterFeature;
          if (obj.properties && obj.properties.cluster) {
            emit('clusterClick', obj);
          } else {
            emit('markerClick', obj);
          }
        }
      } catch (e) {
        // ignore
      }
    };

    container.addEventListener('mousemove', handleMove);
    container.addEventListener('click', handleClick);

    // cleanup on unmount
    const removeHandlers = () => {
      try { container.removeEventListener('mousemove', handleMove); } catch {}
      try { container.removeEventListener('click', handleClick); } catch {}
    };
    // Attach to deck for later cleanup in onUnmounted
    (deck.value as any)._ca_containerHandlers = removeHandlers;
  } catch (e) {
    // ignore
  }

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
  // To avoid deck.gl reacting to Vue proxies we deep-clone the incoming
  // `props.clusters` into plain JS structures. JSON-based cloning is safe for
  // this dataset (numbers/strings) and strips Vue Proxy wrappers.
  let rawClone: any[] = []
  try {
    rawClone = JSON.parse(JSON.stringify(props.clusters || []))
  } catch (e) {
    // Fallback: shallow copy if structured cloning fails for some reason
    rawClone = (props.clusters || []).map((c: any) => ({ ...c }))
  }

  const clustersDataPlain: any[] = rawClone.map((c: any) => ({
    type: c.type,
    id: c.id,
    properties: { ...(c.properties || {}) },
    geometry: { type: c.geometry?.type || 'Point', coordinates: [c.geometry?.coordinates?.[0], c.geometry?.coordinates?.[1]] }
  }))

  // Use fresh array copies to avoid accidentally passing proxied arrays.
  const scatterDataPlain = clustersDataPlain.slice()
  // Create light-weight update trigger keys (primitive string) so deck.gl
  // sees only primitives (Edge's Proxy handling can be stricter than Chrome).
  const scatterUpdateKey = scatterDataPlain.map((d: any) => d.id).join('|')

  // Text layer data (only clusters) - use a copied array
  const clusterData: any[] = clustersDataPlain.filter((d: any) => d.properties && d.properties.cluster).slice()

  // Compute id-based keys for updateTriggers and capture current zoom as a
  // plain number so updateTriggers contain only primitive values.
  const clusterUpdateKey = clusterData.map((d: any) => d.id).join('|')
  const currentZoomPlain = props.map ? (props.map.getZoom() as number) : 0

  // ScatterplotLayer for rendering markers and clusters (use plain arrays)
  const finalScatter = new ScatterplotLayer({
    id: 'artwork-clusters',
  data: scatterDataPlain.slice(),
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
        const approxTextWidth = label.length * fontSize * 0.7
        const minRadiusForText = Math.ceil(approxTextWidth / 2) + 25

        // Base sizes that provide good starting points at each zoom
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
          baseSize = 70
        } else if (currentZoom <= 14) {
          baseSize = 60
        } else if (currentZoom <= 15) {
          baseSize = 50
        } else {
          baseSize = 40
        }

        const countScale = Math.log(pointCount + 1) * 10
        const finalSize = Math.max(baseSize + countScale, minRadiusForText)
        return finalSize
      }

      // Individual markers: larger for easier mobile tapping
      let markerSize: number
      if (currentZoom <= 8) {
        markerSize = 20
      } else if (currentZoom <= 10) {
        markerSize = 16
      } else if (currentZoom <= 12) {
        markerSize = 14
      } else if (currentZoom <= 14) {
        markerSize = 12
      } else {
        markerSize = 10
      }
      return markerSize
    },
    getFillColor: (d: ClusterFeature): [number, number, number] => {
      if (d.properties.cluster) {
        return [251, 146, 60]
      }
      const type = (d.properties.type as string) || 'default'
      const color = colorMap[type]
      if (color) return color
      return [107, 114, 128]
    },
    getLineColor: [255, 255, 255],
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
      getPosition: scatterUpdateKey,
      getRadius: scatterUpdateKey,
      getFillColor: scatterUpdateKey
    }
  })

  // TextLayer for displaying point counts on clusters
  const finalText = new TextLayer({
    id: 'cluster-labels',
  data: clusterData.slice(),
    pickable: false,
    getPosition: (d: ClusterFeature) => [d.geometry.coordinates[0], d.geometry.coordinates[1]],
    getText: (d: ClusterFeature) => {
      const count = d.properties.point_count || 0
      if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`
      }
      return count.toString()
    },
    getSize: () => {
      const currentZoom = props.map?.getZoom() || 13
      if (currentZoom <= 8) {
        return 28
      } else if (currentZoom <= 9) {
        return 26
      } else if (currentZoom <= 10) {
        return 24
      } else if (currentZoom <= 12) {
        return 20
      } else if (currentZoom <= 14) {
        return 16
      } else {
        return 14
      }
    },
    getColor: [255, 255, 255],
    getAngle: 0,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'bold',
    updateTriggers: {
      getPosition: clusterUpdateKey,
      getText: clusterUpdateKey,
      getSize: [clusterUpdateKey, currentZoomPlain]
    }
  })

  // Finally set deck props with non-reactive data arrays
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

  // Remove container-level handlers first if we stored a remover
  try {
    if (deck.value && (deck.value as any)._ca_containerHandlers) {
      try { (deck.value as any)._ca_containerHandlers(); } catch {}
      (deck.value as any)._ca_containerHandlers = null;
    }
  } catch (e) {
    // ignore
  }

  // Clean up deck.gl instance
  try {
    if (deck.value) {
      deck.value.finalize()
      deck.value = null
    }
  } catch (e) {
    // ignore
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
  /* Do not capture pointer events in the overlay div so Leaflet remains interactive. */
  pointer-events: none;
  /* Let Leaflet handle interactions */
  z-index: 400;
}
</style>
