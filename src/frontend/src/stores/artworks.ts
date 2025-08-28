import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ArtworkPin, Coordinates, MapBounds } from '../types'

/**
 * Artwork and map state management store
 */
export const useArtworksStore = defineStore('artworks', () => {
  // State
  const artworks = ref<ArtworkPin[]>([])
  const currentLocation = ref<Coordinates | null>(null)
  const mapCenter = ref<Coordinates>({ latitude: 49.2827, longitude: -123.1207 }) // Vancouver default
  const mapZoom = ref(15)
  const mapBounds = ref<MapBounds | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastFetchLocation = ref<Coordinates | null>(null)
  const fetchRadius = ref(500) // 500 meters default

  // Cache for individual artworks
  const artworkCache = ref<Map<string, any>>(new Map())

  // Computed getters
  const nearbyArtworks = computed(() => {
    if (!currentLocation.value) return artworks.value

    return artworks.value.filter(artwork => {
      const distance = calculateDistance(
        currentLocation.value!,
        { latitude: artwork.latitude, longitude: artwork.longitude }
      )
      return distance <= fetchRadius.value
    })
  })

  const artworkById = computed(() => {
    return (id: string) => artworkCache.value.get(id)
  })

  const hasLocationPermission = computed(() => !!currentLocation.value)

  // Actions
  function setCurrentLocation(location: Coordinates) {
    currentLocation.value = location
    
    // Update map center to user location if not manually moved
    if (!lastFetchLocation.value) {
      mapCenter.value = location
    }
  }

  function setMapCenter(center: Coordinates) {
    mapCenter.value = center
  }

  function setMapZoom(zoom: number) {
    mapZoom.value = zoom
  }

  function setMapBounds(bounds: MapBounds) {
    mapBounds.value = bounds
  }

  function setArtworks(artworkList: ArtworkPin[]) {
    artworks.value = artworkList
    error.value = null
  }

  function addArtwork(artwork: ArtworkPin) {
    const existingIndex = artworks.value.findIndex(a => a.id === artwork.id)
    if (existingIndex >= 0) {
      artworks.value[existingIndex] = artwork
    } else {
      artworks.value.push(artwork)
    }
  }

  function removeArtwork(artworkId: string) {
    const index = artworks.value.findIndex(a => a.id === artworkId)
    if (index >= 0) {
      artworks.value.splice(index, 1)
    }
    artworkCache.value.delete(artworkId)
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function setError(errorMessage: string | null) {
    error.value = errorMessage
  }

  function clearError() {
    error.value = null
  }

  // Cache individual artwork details
  function cacheArtwork(id: string, artwork: any) {
    artworkCache.value.set(id, artwork)
  }

  // Fetch nearby artworks from API
  async function fetchNearbyArtworks(location?: Coordinates): Promise<void> {
    const targetLocation = location || currentLocation.value
    if (!targetLocation) {
      setError('Location is required to fetch nearby artworks')
      return
    }

    // Skip if we recently fetched for this location
    if (lastFetchLocation.value && 
        calculateDistance(targetLocation, lastFetchLocation.value) < 100) {
      return
    }

    isLoading.value = true
    clearError()

    try {
      const params = new URLSearchParams({
        lat: targetLocation.latitude.toString(),
        lon: targetLocation.longitude.toString(),
        radius: fetchRadius.value.toString()
      })

      const response = await fetch(`/api/artworks/nearby?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch nearby artworks')
      }

      const data = await response.json()
      setArtworks(data.artworks || [])
      lastFetchLocation.value = targetLocation
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch artworks'
      setError(message)
      console.error('Error fetching nearby artworks:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Fetch individual artwork details
  async function fetchArtwork(id: string): Promise<any> {
    // Return cached if available
    if (artworkCache.value.has(id)) {
      return artworkCache.value.get(id)
    }

    isLoading.value = true
    clearError()

    try {
      const response = await fetch(`/api/artworks/${id}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Artwork not found')
        }
        throw new Error('Failed to fetch artwork details')
      }

      const artwork = await response.json()
      cacheArtwork(id, artwork)
      return artwork
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch artwork'
      setError(message)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Search artworks by bounds (for map view)
  async function fetchArtworksInBounds(bounds: MapBounds): Promise<void> {
    isLoading.value = true
    clearError()

    try {
      const params = new URLSearchParams({
        north: bounds.north.toString(),
        south: bounds.south.toString(),
        east: bounds.east.toString(),
        west: bounds.west.toString()
      })

      const response = await fetch(`/api/artworks/bounds?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch artworks in area')
      }

      const data = await response.json()
      setArtworks(data.artworks || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch artworks'
      setError(message)
      console.error('Error fetching artworks in bounds:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Get artworks for submission (nearby list)
  async function getArtworksForSubmission(location: Coordinates): Promise<ArtworkPin[]> {
    try {
      const params = new URLSearchParams({
        lat: location.latitude.toString(),
        lon: location.longitude.toString(),
        radius: '100' // Smaller radius for submission
      })

      const response = await fetch(`/api/artworks/nearby?${params}`)
      
      if (!response.ok) {
        console.warn('Failed to fetch nearby artworks for submission')
        return []
      }

      const data = await response.json()
      return data.artworks || []
    } catch (err) {
      console.warn('Error fetching artworks for submission:', err)
      return []
    }
  }

  // Utility function to calculate distance between two coordinates
  function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180
    const φ2 = (coord2.latitude * Math.PI) / 180
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }

  // Reset store state
  function reset() {
    artworks.value = []
    artworkCache.value.clear()
    lastFetchLocation.value = null
    error.value = null
    isLoading.value = false
  }

  return {
    // State
    artworks,
    currentLocation,
    mapCenter,
    mapZoom,
    mapBounds,
    isLoading,
    error,
    fetchRadius,
    
    // Computed
    nearbyArtworks,
    artworkById,
    hasLocationPermission,
    
    // Actions
    setCurrentLocation,
    setMapCenter,
    setMapZoom,
    setMapBounds,
    setArtworks,
    addArtwork,
    removeArtwork,
    setLoading,
    setError,
    clearError,
    cacheArtwork,
    fetchNearbyArtworks,
    fetchArtwork,
    fetchArtworksInBounds,
    getArtworksForSubmission,
    calculateDistance,
    reset,
  }
})