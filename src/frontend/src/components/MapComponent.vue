<template>
  <div class="map-component h-full w-full relative">
    <!-- Map Container -->
    <div 
      ref="mapContainer" 
      class="h-full w-full"
      :class="{ 'opacity-50': isLoading }"
    />
    
    <!-- Loading Overlay -->
    <div 
      v-if="isLoading" 
      class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10"
    >
      <div class="flex flex-col items-center space-y-2">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="text-sm text-gray-600">Loading map...</p>
      </div>
    </div>

    <!-- Location Permission Notice -->
    <div 
      v-if="showLocationNotice" 
      class="absolute top-4 left-4 right-4 bg-yellow-100 border border-yellow-300 rounded-lg p-3 z-20"
    >
      <div class="flex items-start space-x-2">
        <ExclamationTriangleIcon class="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
        <div class="flex-1">
          <p class="text-sm text-yellow-800 font-medium">Location Access Needed</p>
          <p class="text-xs text-yellow-700">
            Enable location access to see nearby artworks and improve your experience.
          </p>
          <button 
            @click="requestLocation"
            class="mt-2 text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 focus:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors"
          >
            Enable Location
          </button>
        </div>
        <button 
          @click="dismissLocationNotice"
          class="text-yellow-600 hover:text-yellow-800 focus:text-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 rounded"
          aria-label="Dismiss location notice"
        >
          <XMarkIcon class="w-4 h-4" aria-hidden="true" />
        </button>
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

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ExclamationTriangleIcon, ExclamationCircleIcon, XMarkIcon, MapPinIcon, PlusIcon, MinusIcon } from '@heroicons/vue/24/outline'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordinates, ArtworkPin, MapComponentProps } from '../types'
import { useArtworksStore } from '../stores/artworks'

// Props
const props = withDefaults(defineProps<MapComponentProps>(), {
  zoom: 15,
  showUserLocation: true
})

// Emits
interface Emits {
  (e: 'artwork-click', artwork: ArtworkPin): void
  (e: 'map-move', data: { center: Coordinates; zoom: number }): void
  (e: 'location-found', location: Coordinates): void
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

// Default coordinates (Vancouver)
const DEFAULT_CENTER = { latitude: 49.2827, longitude: -123.1207 }

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
    html: `<div class="artwork-marker bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-lg border-2 border-white">${iconMap[type] || '📍'}</div>`,
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
  if (!mapContainer.value) return

  try {
    isLoading.value = true
    error.value = null

    // Create map
    map.value = L.map(mapContainer.value, {
      center: props.center ? [props.center.latitude, props.center.longitude] : [DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude],
      zoom: props.zoom,
      zoomControl: false, // We'll use custom controls
      attributionControl: true
    })

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map.value)

    // Initialize marker cluster group
    // Note: We would need to install leaflet.markercluster for this
    // For now, we'll use a simple layer group
    markerClusterGroup.value = L.layerGroup().addTo(map.value)

    // Setup event listeners
    map.value.on('moveend', handleMapMove)
    map.value.on('zoomend', handleMapMove)

    // Request user location if enabled
    if (props.showUserLocation && hasGeolocation.value) {
      await requestUserLocation()
    } else if (!hasGeolocation.value) {
      showLocationNotice.value = true
    }

    // Load initial artworks
    await loadArtworks()

  } catch (err) {
    console.error('Map initialization error:', err)
    error.value = 'Failed to initialize map. Please check your internet connection and try again.'
  } finally {
    isLoading.value = false
  }
}

// Request user location
async function requestUserLocation() {
  if (!hasGeolocation.value) return

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
    emit('location-found', userLocation)
    
    // Hide location notice
    showLocationNotice.value = false

  } catch (err) {
    console.warn('Geolocation error:', err)
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
  ).addTo(map.value)
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
  artworkMarkers.value.forEach(marker => {
    if (markerClusterGroup.value) {
      markerClusterGroup.value.removeLayer(marker as any)
    }
  })
  artworkMarkers.value = []

  // Add new markers
  artworksStore.artworks.forEach(artwork => {
    const marker = L.marker(
      [artwork.latitude, artwork.longitude],
      { icon: createArtworkIcon(artwork.type) }
    )

    // Create popup content
    const popupContent = `
      <div class="artwork-popup max-w-xs">
        <div class="mb-2">
          ${artwork.photos[0] ? `<img src="${artwork.photos[0]}" alt="Artwork" class="w-full h-24 object-cover rounded" />` : ''}
        </div>
        <h3 class="font-semibold text-sm mb-1">${artwork.title || 'Untitled Artwork'}</h3>
        <p class="text-xs text-gray-600 mb-2">Type: ${artwork.type.replace('_', ' ')}</p>
        <button onclick="viewArtworkDetails('${artwork.id}')" class="w-full bg-blue-600 text-white text-xs py-1 px-2 rounded hover:bg-blue-700 transition-colors">
          View Details
        </button>
      </div>
    `

    marker.bindPopup(popupContent)
    marker.on('click', () => {
      emit('artwork-click', artwork)
    })

    if (markerClusterGroup.value) {
      markerClusterGroup.value.addLayer(marker as any)
    }
    artworkMarkers.value.push(marker)
  })
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
  emit('map-move', { center: coordinates, zoom })

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

function dismissLocationNotice() {
  showLocationNotice.value = false
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
  // This would typically use the router
  console.log('View artwork details:', artworkId)
  // router.push(`/artwork/${artworkId}`)
}

// Watch for props changes
watch(() => props.artworks, () => {
  updateArtworkMarkers()
}, { deep: true })

watch(() => props.center, (newCenter) => {
  if (newCenter && map.value) {
    map.value.setView([newCenter.latitude, newCenter.longitude], map.value.getZoom())
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
</script>

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
</style>