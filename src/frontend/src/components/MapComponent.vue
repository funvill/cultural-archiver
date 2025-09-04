<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ExclamationTriangleIcon, ExclamationCircleIcon, XMarkIcon, MapPinIcon, PlusIcon, MinusIcon } from '@heroicons/vue/24/outline'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordinates, ArtworkPin, MapComponentProps } from '../types'
import { useArtworksStore } from '../stores/artworks'
import { useRouter } from 'vue-router'

// Props
const props = withDefaults(defineProps<MapComponentProps>(), {
  zoom: 15,
  showUserLocation: true
})

// Emits
interface Emits {
  (e: 'artworkClick', artwork: ArtworkPin): void
  (e: 'mapMove', data: { center: Coordinates; zoom: number }): void
  (e: 'locationFound', location: Coordinates): void
}

const emit = defineEmits<Emits>()

// State
const mapContainer = ref<HTMLDivElement>()
const map = ref<L.Map>()
const isLoading = ref(true)
const isLocating = ref(false)
const error = ref<string | null>(null)
const showLocationNotice = ref(false)
const hasGeolocation = ref(!!navigator.geolocation)
const userLocationMarker = ref<L.Marker | null>(null)
const artworkMarkers = ref<L.Marker[]>([])
const markerClusterGroup = ref<L.LayerGroup | null>(null)

// Store
const artworksStore = useArtworksStore()

// Router for navigation
const router = useRouter()

// Default coordinates (Vancouver - near sample data for testing)
const DEFAULT_CENTER = { latitude: 49.2815, longitude: -123.122 }

// Custom icon for artworks
const createArtworkIcon = (type: string) => {
  const iconMap: { [key: string]: string } = {
    public_art: '🎨',
    street_art: '🎭',
    monument: '🗿',
    sculpture: '⚱️',
    other: '📍'
  }
  
  return L.divIcon({
    html: `<div class="artwork-marker bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-lg border-2 border-white cursor-pointer">${iconMap[type] || '📍'}</div>`,
    className: 'custom-artwork-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  })
}

// Custom icon for user location
const createUserLocationIcon = () => {
  return L.divIcon({
    html: `<div class="user-location-marker bg-blue-500 rounded-full w-4 h-4 border-2 border-white shadow-lg animate-pulse"></div>`,
    className: 'custom-user-location-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })
}

// Initialize map
async function initializeMap() {
  if (!mapContainer.value) {
    console.error('Map container not found')
    return
  }

  console.log('Initializing map with container:', mapContainer.value)
  console.log('Container dimensions:', {
    offsetWidth: mapContainer.value.offsetWidth,
    offsetHeight: mapContainer.value.offsetHeight,
    clientWidth: mapContainer.value.clientWidth,
    clientHeight: mapContainer.value.clientHeight
  })

  try {
    isLoading.value = true
    error.value = null

    console.log('Creating Leaflet map...')

    // Create map
    map.value = L.map(mapContainer.value, {
      center: props.center ? [props.center.latitude, props.center.longitude] : [DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude],
      zoom: props.zoom,
      zoomControl: false, // We'll use custom controls
      attributionControl: true
    })

    console.log('Map created successfully:', map.value)

    // Ensure the container has the proper Leaflet classes
    if (mapContainer.value) {
      mapContainer.value.classList.add('leaflet-container')
      mapContainer.value.style.position = 'relative'
      console.log('Added leaflet-container class to map container')
    }

    // Add tile layer with error handling
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' // Transparent 1x1 pixel
    }).addTo(map.value)

    // Add error handling for tile loading
    tileLayer.on('tileerror', (e) => {
      console.error('Tile loading error:', e)
      console.error('Tile error details:', {
        coords: e.coords,
        error: e.error,
        tile: e.tile
      })
    })

    tileLayer.on('tileload', (e) => {
      console.log('Tile loaded successfully:', e.coords)
      // Apply fixes whenever a tile loads
      nextTick(() => {
        forceMapDimensions()
      })
    })

    tileLayer.on('tileloadstart', (e) => {
      console.log('Tile load started:', e.coords)
    })

    console.log('Tile layer added to map')

    // Force Leaflet containers to have proper classes and dimensions
    const forceMapDimensions = () => {
      if (mapContainer.value) {
        // Ensure container has leaflet-container class
        mapContainer.value.classList.add('leaflet-container')
        
        // Force dimensions on all Leaflet elements
        const mapPanes = mapContainer.value.querySelectorAll('.leaflet-pane')
        mapPanes.forEach(pane => {
          if (pane.classList.contains('leaflet-map-pane')) {
            ;(pane as HTMLElement).style.width = '100%'
            ;(pane as HTMLElement).style.height = '100%'
            ;(pane as HTMLElement).style.position = 'absolute'
            ;(pane as HTMLElement).style.left = '0px'
            ;(pane as HTMLElement).style.top = '0px'
          }
          if (pane.classList.contains('leaflet-tile-pane')) {
            ;(pane as HTMLElement).style.width = '100%'
            ;(pane as HTMLElement).style.height = '100%'
            ;(pane as HTMLElement).style.position = 'absolute'
            ;(pane as HTMLElement).style.left = '0px'
            ;(pane as HTMLElement).style.top = '0px'
            ;(pane as HTMLElement).style.zIndex = '200'
            
            // Force tile images to display
            const tileImages = pane.querySelectorAll('img')
            tileImages.forEach(img => {
              ;(img as HTMLImageElement).style.width = '256px'
              ;(img as HTMLImageElement).style.height = '256px'
              ;(img as HTMLImageElement).style.display = 'block'
              ;(img as HTMLImageElement).style.visibility = 'visible'
              ;(img as HTMLImageElement).style.opacity = '1'
            })
          }
        })
        console.log('Applied dimension fixes to Leaflet containers')
      }
    }

    // Apply fixes immediately and after a delay
    forceMapDimensions()
    setTimeout(forceMapDimensions, 100)
    setTimeout(forceMapDimensions, 500)
    setTimeout(forceMapDimensions, 1000)

    // Debug: Check if Leaflet styles are applied
    setTimeout(() => {
      if (mapContainer.value) {
        const leafletContainer = mapContainer.value.querySelector('.leaflet-container')
        console.log('Leaflet container found:', leafletContainer)
        if (leafletContainer) {
          const styles = (leafletContainer as HTMLElement).style
          console.log('Leaflet container styles:', {
            position: styles.position,
            width: styles.width,
            height: styles.height,
            zIndex: styles.zIndex
          })
        }
        
        // Check for tile layers
        const tileLayers = mapContainer.value.querySelectorAll('.leaflet-tile-pane img')
        console.log('Tile images found:', tileLayers.length)
        if (tileLayers.length > 0) {
          const firstTile = tileLayers[0] as HTMLImageElement
          console.log('First tile image:', {
            src: firstTile.src,
            width: firstTile.width,
            height: firstTile.height,
            naturalWidth: firstTile.naturalWidth,
            naturalHeight: firstTile.naturalHeight
          })
        }
      }
    }, 500)

    // Force map to resize after initialization
    setTimeout(() => {
      if (map.value) {
        console.log('Forcing map resize...')
        map.value.invalidateSize()
        console.log('Map bounds after resize:', map.value.getBounds())
        console.log('Map center after resize:', map.value.getCenter())
        console.log('Map zoom after resize:', map.value.getZoom())
      }
    }, 100)

    // Initialize marker cluster group
    // Note: We would need to install leaflet.markercluster for this
    // For now, we'll use a simple layer group
    markerClusterGroup.value = L.layerGroup().addTo(map.value)

    // Setup event listeners
    map.value.on('moveend', handleMapMove)
    map.value.on('zoomend', handleMapMove)


    // Request user location if enabled, otherwise use default
    if (props.showUserLocation && hasGeolocation.value) {
      await requestUserLocation()
    } else {
      // No geolocation: show notice, but set default location and allow map to work
      showLocationNotice.value = true
      artworksStore.setCurrentLocation(DEFAULT_CENTER)
      if (map.value) {
        map.value.setView([DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], props.zoom)
      }
      
      // Auto-dismiss location notice after 10 seconds to show the map
      setTimeout(() => {
        showLocationNotice.value = false
      }, 10000)
    }

    // Load initial artworks
    await loadArtworks()

  } catch (err) {
    console.error('Map initialization error:', err)
    error.value = 'Failed to initialize map. Please check your internet connection and try again.'
    // Dismiss location notice on error to show map
    showLocationNotice.value = false
  } finally {
    isLoading.value = false
  }
}

// Request user location
async function requestUserLocation() {

  if (!hasGeolocation.value) {
    // No geolocation: set default location, show notice, allow map to work
    artworksStore.setCurrentLocation(DEFAULT_CENTER)
    if (map.value) {
      map.value.setView([DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], props.zoom)
    }
    addUserLocationMarker(DEFAULT_CENTER)
  emit('locationFound', DEFAULT_CENTER)
    showLocationNotice.value = true
    return
  }

  isLocating.value = true
  
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      })
    })

    const userLocation: Coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    }

    // Update store
    artworksStore.setCurrentLocation(userLocation)
    
    // Center map on user location
    if (map.value) {
      map.value.setView([userLocation.latitude, userLocation.longitude], props.zoom)
    }

    // Add user location marker
    addUserLocationMarker(userLocation)
    
    // Emit location found event
  emit('locationFound', userLocation)
    
    // Hide location notice
    showLocationNotice.value = false

  } catch (err) {
    // On error (denied, unavailable, etc): set default location, show notice, allow map to work
    console.warn('Geolocation error:', err)
    artworksStore.setCurrentLocation(DEFAULT_CENTER)
    if (map.value) {
      map.value.setView([DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], props.zoom)
    }
    addUserLocationMarker(DEFAULT_CENTER)
  emit('locationFound', DEFAULT_CENTER)
    showLocationNotice.value = true
  } finally {
    isLocating.value = false
  }
}

// Add user location marker
function addUserLocationMarker(location: Coordinates) {
  if (!map.value) return

  // Remove existing marker
  if (userLocationMarker.value) {
    map.value.removeLayer(userLocationMarker.value as any)
  }

  // Add new marker
  userLocationMarker.value = L.marker(
    [location.latitude, location.longitude],
    { icon: createUserLocationIcon() }
  ).addTo(map.value!)
    .bindPopup('Your current location')
}

// Load artworks on map
async function loadArtworks() {
  if (!map.value) return

  try {
    // Get current map bounds
    const bounds = map.value.getBounds()
    const mapBounds = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    }

    // Fetch artworks in bounds
    await artworksStore.fetchArtworksInBounds(mapBounds)
    
    // Update markers
    updateArtworkMarkers()
    
  } catch (err) {
    console.error('Error loading artworks:', err)
  }
}

// Update artwork markers
function updateArtworkMarkers() {
  if (!map.value || !markerClusterGroup.value) return

  // Clear existing markers
  artworkMarkers.value.forEach((marker) => {
    if (markerClusterGroup.value) {
      markerClusterGroup.value.removeLayer(marker as any)
    }
  })
  artworkMarkers.value = []

  // Add new markers
  console.log('Creating markers for artworks:', artworksStore.artworks.length)
  artworksStore.artworks.forEach((artwork: ArtworkPin) => {
    console.log('Creating marker for artwork:', artwork.id, 'at', artwork.latitude, artwork.longitude)
    
    const marker = L.marker(
      [artwork.latitude, artwork.longitude],
      { icon: createArtworkIcon(artwork.type) }
    )

    // Remove popup binding - we want direct navigation instead of popups
    // This prevents the popup pane from interfering with marker clicks
    
    // Add click handler to marker itself for direct navigation
    marker.on('click', () => {
      console.log('Marker clicked for artwork:', artwork.id)
      // Navigate directly to artwork details page on marker click
      router.push(`/artwork/${artwork.id}`)
      emit('artworkClick', artwork)
    })

    if (markerClusterGroup.value) {
      markerClusterGroup.value.addLayer(marker as any)
    }
    artworkMarkers.value.push(marker)
  })
  console.log('Created', artworkMarkers.value.length, 'markers')
}

// Handle map movement
function handleMapMove() {
  if (!map.value) return

  const center = map.value.getCenter()
  const zoom = map.value.getZoom()
  
  const coordinates: Coordinates = {
    latitude: center.lat,
    longitude: center.lng
  }

  // Update store
  artworksStore.setMapCenter(coordinates)
  artworksStore.setMapZoom(zoom)

  // Emit map move event
  emit('mapMove', { center: coordinates, zoom })

  // Debounced artwork loading to prevent infinite loops
  debounceLoadArtworks()
}

// Debounced artwork loading
let loadArtworksTimeout: ReturnType<typeof setTimeout> | null = null
function debounceLoadArtworks() {
  if (loadArtworksTimeout) {
    clearTimeout(loadArtworksTimeout)
  }
  loadArtworksTimeout = setTimeout(() => {
    loadArtworks()
  }, 500) // Wait 500ms after user stops moving map
}

// Map control methods
function zoomIn() {
  if (map.value) {
    map.value.zoomIn()
  }
}

function zoomOut() {
  if (map.value) {
    map.value.zoomOut()
  }
}

function centerOnUserLocation() {
  requestUserLocation()
}

function requestLocation() {
  requestUserLocation()
}

function clearError() {
  error.value = null
}

function retryMapLoad() {
  error.value = null
  initializeMap()
}

// Global function for popup buttons
;(window as any).viewArtworkDetails = (artworkId: string) => {
  router.push(`/artwork/${artworkId}`)
}

// Watch for props changes
watch(() => props.artworks, () => {
  updateArtworkMarkers()
}, { deep: true })

watch(() => props.center, (newCenter) => {
  if (newCenter && map.value) {
    const current = map.value.getCenter();
    // Only update if the new center is different (avoid recursive updates)
    if (
      Math.abs(current.lat - newCenter.latitude) > 1e-6 ||
      Math.abs(current.lng - newCenter.longitude) > 1e-6
    ) {
      map.value.setView([newCenter.latitude, newCenter.longitude], map.value.getZoom());
    }
  }
})

// Handle window resize
const handleResize = () => {
  if (map.value) {
    console.log('Window resized, invalidating map size')
    map.value.invalidateSize()
  }
}

// Watch for container size changes
watch(() => mapContainer.value, (newContainer) => {
  if (newContainer && map.value) {
    console.log('Map container changed, invalidating size')
    nextTick(() => {
      map.value?.invalidateSize()
    })
  }
})

// Lifecycle
onMounted(async () => {
  await nextTick()
  await initializeMap()
  
  // Add window resize listener
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // Remove window resize listener
  window.removeEventListener('resize', handleResize)
  
  if (map.value) {
    map.value.remove()
  }
})
</script>

<template>
  <div class="map-component h-full w-full relative">
    <!-- Map Container -->
    <div 
      ref="mapContainer" 
      class="h-full w-full relative z-0"
      :class="{ 'opacity-50': isLoading }"
      role="application"
      aria-label="Interactive map showing public artwork locations"
      :aria-busy="isLoading"
    />
    
    <!-- Loading Overlay -->
    <div 
      v-if="isLoading" 
      class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10"
      role="status"
      aria-live="polite"
    >
      <div class="flex flex-col items-center space-y-2">
        <div 
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
          aria-hidden="true"
        ></div>
        <p class="text-sm text-gray-600">Loading map...</p>
      </div>
    </div>

    <!-- Location Permission Notice -->
    <div 
      v-if="showLocationNotice" 
      class="absolute top-4 left-4 right-4 bg-yellow-100 border border-yellow-300 rounded-lg p-3 z-30"
      role="alert"
      aria-live="assertive"
    >
      <div class="flex items-start space-x-2">
        <ExclamationTriangleIcon class="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
        <div class="flex-1">
          <p class="text-sm text-yellow-800 font-medium">Location Access Needed</p>
          <p class="text-xs text-yellow-700 mb-2">
            Enable location access to see nearby artworks and improve your experience.
          </p>
          <div class="flex flex-col sm:flex-row gap-2">
            <button 
              @click="requestLocation"
              class="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 focus:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors"
            >
              Enable Location
            </button>
            <a
              href="/help#location-access-faq"
              class="text-xs text-yellow-700 underline hover:text-yellow-800 focus:text-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 rounded px-1"
            >
              Why is this needed?
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Map Controls -->
    <div class="absolute bottom-4 right-4 flex flex-col space-y-2 z-20">
      <!-- Current Location Button -->
      <button 
        v-if="hasGeolocation"
        @click="centerOnUserLocation"
        :disabled="isLocating"
        class="bg-white shadow-md rounded-full p-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        :title="isLocating ? 'Getting location...' : 'Center on current location'"
        :aria-label="isLocating ? 'Getting current location...' : 'Center map on current location'"
      >
        <MapPinIcon v-if="!isLocating" class="w-5 h-5 text-gray-700" />
        <div v-else class="w-5 h-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
      </button>

      <!-- Zoom Controls -->
      <div class="bg-white shadow-md rounded-lg overflow-hidden">
        <button 
          @click="zoomIn"
          class="block w-full px-3 py-2 text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors border-b border-gray-200"
          title="Zoom in"
          aria-label="Zoom in on map"
        >
          <PlusIcon class="w-4 h-4 mx-auto" aria-hidden="true" />
        </button>
        <button 
          @click="zoomOut"
          class="block w-full px-3 py-2 text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors"
          title="Zoom out"
          aria-label="Zoom out on map"
        >
          <MinusIcon class="w-4 h-4 mx-auto" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <div 
      v-if="error" 
      class="absolute top-4 left-4 right-4 bg-red-100 border border-red-300 rounded-lg p-3 z-20"
      role="alert"
      aria-live="assertive"
    >
      <div class="flex items-start space-x-2">
        <ExclamationCircleIcon class="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div class="flex-1">
          <p class="text-sm text-red-800 font-medium">Map Error</p>
          <p class="text-xs text-red-700">{{ error }}</p>
          <button 
            @click="retryMapLoad"
            class="mt-2 text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
        <button 
          @click="clearError"
          class="text-red-600 hover:text-red-800"
          aria-label="Dismiss error"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<style>
/* Custom marker styles */
.custom-artwork-icon,
.custom-user-location-icon {
  background: transparent !important;
  border: none !important;
}

.artwork-marker {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.artwork-marker:hover {
  transform: scale(1.1);
}

.user-location-marker {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Popup styles */
.leaflet-popup-content {
  margin: 8px !important;
}

.artwork-popup img {
  margin-bottom: 8px;
}

/* Fix Leaflet icon paths */
.leaflet-default-icon-path {
  background-image: url('https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png');
}

/* Ensure Leaflet containers have proper dimensions */
.leaflet-container {
  height: 100% !important;
  width: 100% !important;
  position: relative !important;
}

.leaflet-map-pane {
  height: 100% !important;
  width: 100% !important;
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
}

.leaflet-tile-pane {
  height: 100% !important;
  width: 100% !important;
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  z-index: 200 !important;
}

.leaflet-pane {
  width: 100% !important;
  height: 100% !important;
}

/* Force Leaflet tiles to display properly */
.leaflet-tile {
  width: 256px !important;
  height: 256px !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: absolute !important;
}

.leaflet-tile-container {
  width: 100% !important;
  height: 100% !important;
}

/* Map container specific overrides */
.map-component .leaflet-container {
  height: 100% !important;
  width: 100% !important;
}

.map-component [role="application"] {
  height: 100% !important;
  width: 100% !important;
  position: relative !important;
}

/* Ensure tiles are always visible */
.map-component .leaflet-tile-pane img {
  width: 256px !important;
  height: 256px !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

/* Fix marker clicking by disabling pointer events on interfering Leaflet panes */
.map-component .leaflet-popup-pane,
.map-component .leaflet-tooltip-pane {
  pointer-events: none !important;
}
</style>