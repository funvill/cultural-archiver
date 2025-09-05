import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ArtworkPin, Coordinates, MapBounds, ArtworkDetails, ArtworkWithPhotos } from '../types'
import { apiService, getErrorMessage, isNetworkError } from '../services/api'

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
  const artworkCache = ref<Map<string, ArtworkDetails>>(new Map())

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

  const artworkById = computed((): ((id: string) => ArtworkDetails | undefined) => {
    return (id: string) => artworkCache.value.get(id)
  })

  const hasLocationPermission = computed(() => !!currentLocation.value)

  // Actions
  function setCurrentLocation(location: Coordinates): void {
    currentLocation.value = location
    
    // Update map center to user location if not manually moved
    if (!lastFetchLocation.value) {
      mapCenter.value = location
    }
  }

  function setMapCenter(center: Coordinates): void {
    mapCenter.value = center
  }

  function setMapZoom(zoom: number): void {
    mapZoom.value = zoom
  }

  function setMapBounds(bounds: MapBounds): void {
    mapBounds.value = bounds
  }

  function setArtworks(artworkList: ArtworkPin[]): void {
    artworks.value = artworkList
    error.value = null
  }

  function addArtwork(artwork: ArtworkPin): void {
    const existingIndex = artworks.value.findIndex(a => a.id === artwork.id)
    if (existingIndex >= 0) {
      artworks.value[existingIndex] = artwork
    } else {
      artworks.value.push(artwork)
    }
  }

  function removeArtwork(artworkId: string): void {
    const index = artworks.value.findIndex(a => a.id === artworkId)
    if (index >= 0) {
      artworks.value.splice(index, 1)
    }
    artworkCache.value.delete(artworkId)
  }

  function setLoading(loading: boolean): void {
    isLoading.value = loading
  }

  function setError(errorMessage: string | null): void {
    error.value = errorMessage
  }

  function clearError(): void {
    error.value = null
  }

  // Cache individual artwork details
  function cacheArtwork(id: string, artwork: ArtworkDetails): void {
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

    setLoading(true)
    clearError()

    try {
      const response = await apiService.getNearbyArtworks(
        targetLocation.latitude,
        targetLocation.longitude,
        fetchRadius.value
      )

      // The API now returns a full API response with { success: true, data: { artworks: [...] } }
      const apiArtworks = response.data?.artworks || [];

      // Convert the API response to ArtworkPin format
      const artworkPins: ArtworkPin[] = apiArtworks.map((artwork: ArtworkWithPhotos): ArtworkPin => {
        const pin: ArtworkPin = {
          id: artwork.id,
          latitude: artwork.lat,
          longitude: artwork.lon,
          type: artwork.type_name || 'unknown',
          photos: []
        }
        
        // Handle photos from recent_photo
        if (artwork.recent_photo) {
          pin.photos = [artwork.recent_photo];
        }
        
        // Only set title if it's available in tags
        if (artwork.tags) {
          try {
            const parsedTags = typeof artwork.tags === 'string' ? JSON.parse(artwork.tags) : artwork.tags;
            if (typeof parsedTags?.title === 'string') {
              pin.title = parsedTags.title;
            }
          } catch (e) {
            console.warn('Failed to parse artwork tags:', e);
          }
        }
        
        return pin
      })

      setArtworks(artworkPins)
      lastFetchLocation.value = targetLocation
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      console.error('Error fetching nearby artworks:', err)
      
      // If it's a network error, retry once
      if (isNetworkError(err)) {
        setTimeout(() => {
          fetchNearbyArtworks(location)
        }, 2000)
      }
    } finally {
      setLoading(false)
    }
  }

  // Fetch individual artwork details
  async function fetchArtwork(id: string): Promise<ArtworkDetails | null> {
    // Return cached if available
    if (artworkCache.value.has(id)) {
      return artworkCache.value.get(id) || null
    }

    setLoading(true)
    clearError()

    try {
      const artwork = await apiService.getArtworkDetails(id)
      
      if (artwork) {
        cacheArtwork(id, artwork)
        return artwork
      }
      
      return null
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      console.error('Error fetching artwork details:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Refresh individual artwork details (bypass cache)
  async function refreshArtwork(id: string): Promise<ArtworkDetails | null> {
    setLoading(true)
    clearError()

    try {
      const artwork = await apiService.getArtworkDetails(id)
      
      if (artwork) {
        cacheArtwork(id, artwork)
        return artwork
      }
      
      return null
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      console.error('Failed to refresh artwork details:', err)
      return null
    } finally {
      setLoading(false)
    }
  }

  // Search artworks by bounds (for map view)
  async function fetchArtworksInBounds(bounds: MapBounds): Promise<void> {
    setLoading(true)
    clearError()

    try {
      // Use center point of bounds for nearby search
      const centerLat = (bounds.north + bounds.south) / 2
      const centerLon = (bounds.east + bounds.west) / 2
      
      // Calculate approximate radius from bounds
      const radius = Math.min(
        calculateDistance(
          { latitude: bounds.north, longitude: centerLon },
          { latitude: bounds.south, longitude: centerLon }
        ) / 2,
        calculateDistance(
          { latitude: centerLat, longitude: bounds.east },
          { latitude: centerLat, longitude: bounds.west }
        ) / 2
      )

      const response = await apiService.getNearbyArtworks(
        centerLat,
        centerLon,
        Math.max(radius, 500) // Minimum 500m radius
      )

      console.log('[DEBUG] API response received:', response);
      console.log('[DEBUG] Response structure:', {
        hasArtworks: !!response.data?.artworks,
        artworksLength: response.data?.artworks ? response.data.artworks.length : 0,
        responseKeys: Object.keys(response),
        responseType: typeof response
      });
      
      // The API now returns a full API response with { success: true, data: { artworks: [...] } }
      console.log('[DEBUG] response.data.artworks type:', typeof response.data?.artworks);
      console.log('[DEBUG] response.data.artworks value:', response.data?.artworks);
      console.log('[DEBUG] response.data.artworks array check:', Array.isArray(response.data?.artworks));
      const apiArtworks = response.data?.artworks || [];
      console.log('[DEBUG] Extracted artworks:', apiArtworks.length, 'artworks found');
      console.log('[DEBUG] First artwork if any:', apiArtworks[0]);      // Convert the API response to ArtworkPin format
      const artworkPins: ArtworkPin[] = apiArtworks.map((artwork: ArtworkWithPhotos): ArtworkPin => {
        console.log('[DEBUG] Converting artwork to pin:', artwork);
        const pin: ArtworkPin = {
          id: artwork.id,
          latitude: artwork.lat,
          longitude: artwork.lon,
          type: artwork.type_name || 'unknown',
          photos: []
        }
        
        // Handle photos from recent_photo or extract from API response
        if (artwork.recent_photo) {
          pin.photos = [artwork.recent_photo];
        }
        
        // Only set title if it's available in tags
        if (artwork.tags) {
          try {
            const parsedTags = typeof artwork.tags === 'string' ? JSON.parse(artwork.tags) : artwork.tags;
            if (typeof parsedTags?.title === 'string') {
              pin.title = parsedTags.title;
            }
          } catch (e) {
            console.warn('Failed to parse artwork tags:', e);
          }
        }
        
        return pin
      })

      console.log('[DEBUG] Converted to ArtworkPin format:', artworkPins.length, 'pins');
      console.log('[DEBUG] Pin details:', artworkPins);

      setArtworks(artworkPins)
      console.log('[DEBUG] Artworks set in store. Total count:', artworks.value.length);
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      console.error('Error fetching artworks in bounds:', err)
    } finally {
      setLoading(false)
    }
  }

  // Get artworks for submission (nearby list)
  async function getArtworksForSubmission(location: Coordinates): Promise<ArtworkPin[]> {
    try {
      const response = await apiService.getNearbyArtworks(
        location.latitude,
        location.longitude,
        100, // Smaller radius for submission
        10   // Limit results
      )

      // The API now returns a full API response with { success: true, data: { artworks: [...] } }
      const apiArtworks = response.data?.artworks || [];

      // Convert the API response to ArtworkPin format
      const artworkPins: ArtworkPin[] = apiArtworks.map((artwork: ArtworkWithPhotos): ArtworkPin => {
        const pin: ArtworkPin = {
          id: artwork.id,
          latitude: artwork.lat,
          longitude: artwork.lon,
          type: artwork.type_name || 'unknown',
          photos: []
        }
        
        // Handle photos from recent_photo
        if (artwork.recent_photo) {
          pin.photos = [artwork.recent_photo];
        }
        
        // Only set title if it's available in tags
        if (artwork.tags) {
          try {
            const parsedTags = typeof artwork.tags === 'string' ? JSON.parse(artwork.tags) : artwork.tags;
            if (typeof parsedTags?.title === 'string') {
              pin.title = parsedTags.title;
            }
          } catch (e) {
            console.warn('Failed to parse artwork tags:', e);
          }
        }
        
        return pin
      })

      return artworkPins
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
  function reset(): void {
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
    refreshArtwork,
    fetchArtworksInBounds,
    getArtworksForSubmission,
    calculateDistance,
    reset,
  }
})