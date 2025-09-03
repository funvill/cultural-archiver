<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import type { Map, LatLng, Marker } from 'leaflet'

// Props interface
interface Props {
  latitude: number
  longitude: number
  zoom?: number
  height?: string
  title?: string
  showZoomControls?: boolean
  showDirectionsLink?: boolean
}

// Emits interface
interface Emits {
  (e: 'mapReady', map: Map): void
  (e: 'markerClick', coordinates: { lat: number; lng: number }): void
}

const props = withDefaults(defineProps<Props>(), {
  zoom: 16,
  height: '200px',
  title: 'Artwork location',
  showZoomControls: true,
  showDirectionsLink: true
})

const emit = defineEmits<Emits>()

// State
const mapContainer = ref<HTMLElement>()
const map = ref<Map>()
const marker = ref<Marker>()
const isLoading = ref(true)
const hasError = ref(false)

// Computed directions URL
const directionsUrl = computed(() => {
  return `https://www.google.com/maps?q=${props.latitude},${props.longitude}`
})

// Map setup
async function initializeMap(): Promise<void> {
  if (!mapContainer.value) return

  try {
    isLoading.value = true
    hasError.value = false

    // Dynamic import of Leaflet to avoid SSR issues
    const L = await import('leaflet')
    
    // Create map
    const mapInstance = L.map(mapContainer.value, {
      zoomControl: props.showZoomControls,
      scrollWheelZoom: false, // Prevent accidental zooming
      doubleClickZoom: true,
      touchZoom: true,
      keyboard: true,
      attributionControl: true
    }).setView([props.latitude, props.longitude], props.zoom)

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(mapInstance)

    // Add marker
    const markerInstance = L.marker([props.latitude, props.longitude])
      .addTo(mapInstance)
      .bindPopup(props.title)

    // Store references
    map.value = mapInstance
    marker.value = markerInstance

    // Emit map ready event
    emit('mapReady', mapInstance)

    // Handle marker click
    markerInstance.on('click', () => {
      emit('markerClick', { lat: props.latitude, lng: props.longitude })
    })

    isLoading.value = false
  } catch (error) {
    console.error('Failed to initialize map:', error)
    hasError.value = true
    isLoading.value = false
  }
}

// Update map location when props change
async function updateMapLocation(): Promise<void> {
  if (!map.value || !marker.value) return

  // Dynamic import for consistency
  const L = await import('leaflet')
  const newLatLng = L.latLng(props.latitude, props.longitude)
  
  map.value.setView(newLatLng, props.zoom)
  marker.value.setLatLng(newLatLng)
  marker.value.bindPopup(props.title).openPopup()
}

// Open directions in new tab
function openDirections(): void {
  window.open(directionsUrl.value, '_blank', 'noopener,noreferrer')
}

// Keyboard navigation
function handleKeydown(event: KeyboardEvent): void {
  if (!map.value) return

  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      openDirections()
      break
    case '+':
    case '=':
      event.preventDefault()
      map.value.zoomIn()
      break
    case '-':
      event.preventDefault()
      map.value.zoomOut()
      break
  }
}

// Watch for prop changes
watch(
  [() => props.latitude, () => props.longitude, () => props.zoom],
  () => {
    if (map.value) {
      updateMapLocation()
    }
  },
  { deep: true }
)

watch(() => props.title, (newTitle) => {
  if (marker.value) {
    marker.value.bindPopup(newTitle)
  }
})

// Lifecycle
onMounted(async () => {
  await nextTick()
  await initializeMap()
})

onUnmounted(() => {
  if (map.value) {
    map.value.remove()
  }
})

// Import Leaflet CSS
import('leaflet/dist/leaflet.css')
</script>

<template>
  <div class="mini-map">
    <!-- Map container -->
    <div class="relative rounded-lg overflow-hidden border border-gray-200">
      <!-- Loading state -->
      <div 
        v-if="isLoading" 
        class="absolute inset-0 flex items-center justify-center bg-gray-100 z-10"
        :style="{ height: props.height }"
      >
        <div class="text-center">
          <svg class="animate-spin h-8 w-8 mx-auto mb-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-sm text-gray-600">Loading map...</p>
        </div>
      </div>

      <!-- Error state -->
      <div 
        v-if="hasError" 
        class="absolute inset-0 flex items-center justify-center bg-gray-100 z-10"
        :style="{ height: props.height }"
      >
        <div class="text-center text-gray-600">
          <svg class="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p class="text-sm">Failed to load map</p>
        </div>
      </div>

      <!-- Map element -->
      <div
        ref="mapContainer"
        class="w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        :style="{ height: props.height }"
        tabindex="0"
        role="application"
        :aria-label="`Interactive map showing ${props.title} at coordinates ${props.latitude}, ${props.longitude}`"
        @keydown="handleKeydown"
      />
    </div>

    <!-- Map controls and info -->
    <div class="mt-3 space-y-2">
      <!-- Coordinates display -->
      <div class="flex items-center text-sm text-gray-600">
        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
        </svg>
        <span>{{ props.latitude.toFixed(6) }}, {{ props.longitude.toFixed(6) }}</span>
      </div>

      <!-- Directions link -->
      <div v-if="showDirectionsLink" class="flex">
        <button
          @click="openDirections"
          class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Get Directions
          <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>

      <!-- Keyboard shortcuts help -->
      <div class="text-xs text-gray-500">
        <p>Keyboard: Enter/Space for directions, +/- to zoom</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mini-map {
  /* Ensure proper focus styles */
  --focus-ring: theme('colors.blue.500');
}

/* Loading animation */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Leaflet map styling adjustments */
.mini-map :deep(.leaflet-container) {
  font-family: inherit;
}

.mini-map :deep(.leaflet-popup-content) {
  font-size: 14px;
  line-height: 1.4;
}

.mini-map :deep(.leaflet-control-zoom) {
  border: none;
  border-radius: 6px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.mini-map :deep(.leaflet-control-zoom a) {
  background-color: white;
  color: #374151;
  border: none;
  width: 32px;
  height: 32px;
  line-height: 32px;
  font-size: 16px;
  font-weight: 600;
}

.mini-map :deep(.leaflet-control-zoom a:hover) {
  background-color: #f3f4f6;
  color: #1f2937;
}

.mini-map :deep(.leaflet-control-zoom a:focus) {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .mini-map :deep(.leaflet-control-zoom a) {
    border: 1px solid currentColor;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .animate-spin {
    animation: none;
  }
  
  .mini-map :deep(.leaflet-zoom-animated) {
    transition: none !important;
  }
}
</style>