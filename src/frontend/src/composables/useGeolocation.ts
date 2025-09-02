/**
 * Geolocation services composable for getting user location
 */

import { ref, computed } from 'vue'
import type { Coordinates } from '../types'

export function useGeolocation() { // eslint-disable-line @typescript-eslint/explicit-function-return-type
  const position = ref<Coordinates | null>(null)
  const error = ref<string | null>(null)
  const isLoading = ref(false)
  const isWatching = ref(false)
  const watchId = ref<number | null>(null)

  // Computed state
  const hasLocation = computed(() => !!position.value)
  const hasPermission = computed(() => hasLocation.value && !error.value)

  // Default fallback coordinates (Vancouver, Canada)
  const FALLBACK_COORDINATES: Coordinates = {
    latitude: 49.2827,
    longitude: -123.1207
  }

  /**
   * Request user's current position
   */
  const getCurrentPosition = async (): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const errorMsg = 'Geolocation is not supported by this browser'
        error.value = errorMsg
        reject(new Error(errorMsg))
        return
      }

      isLoading.value = true
      error.value = null

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: Coordinates = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          }
          position.value = coords
          isLoading.value = false
          resolve(coords)
        },
        (err) => {
          isLoading.value = false
          let errorMsg = 'Failed to get location'
          
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMsg = 'Location access denied by user'
              break
            case err.POSITION_UNAVAILABLE:
              errorMsg = 'Location information unavailable'
              break
            case err.TIMEOUT:
              errorMsg = 'Location request timed out'
              break
          }
          
          error.value = errorMsg
          reject(new Error(errorMsg))
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      )
    })
  }

  /**
   * Watch user's position changes
   */
  const watchPosition = (): void => {
    if (!navigator.geolocation || isWatching.value) {
      return
    }

    isWatching.value = true
    error.value = null

    watchId.value = navigator.geolocation.watchPosition(
      (pos) => {
        position.value = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }
      },
      (err) => {
        let errorMsg = 'Failed to watch location'
        
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMsg = 'Location access denied'
            stopWatching()
            break
          case err.POSITION_UNAVAILABLE:
            errorMsg = 'Location unavailable'
            break
          case err.TIMEOUT:
            errorMsg = 'Location timeout'
            break
        }
        
        error.value = errorMsg
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000 // 1 minute
      }
    )
  }

  /**
   * Stop watching position changes
   */
  const stopWatching = (): void => {
    if (watchId.value !== null) {
      navigator.geolocation.clearWatch(watchId.value)
      watchId.value = null
    }
    isWatching.value = false
  }

  /**
   * Request location with fallback to default coordinates
   */
  const getLocationWithFallback = async (): Promise<Coordinates> => {
    try {
      return await getCurrentPosition()
    } catch (err) {
      console.warn('Geolocation failed, using fallback coordinates:', err)
      position.value = FALLBACK_COORDINATES
      return FALLBACK_COORDINATES
    }
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = coord1.latitude * Math.PI / 180
    const φ2 = coord2.latitude * Math.PI / 180
    const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180
    const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c // Distance in meters
  }

  /**
   * Check if coordinates are within a radius
   */
  const isWithinRadius = (
    center: Coordinates,
    point: Coordinates,
    radiusMeters: number
  ): boolean => {
    return calculateDistance(center, point) <= radiusMeters
  }

  /**
   * Format coordinates for display
   */
  const formatCoordinates = (coords: Coordinates): string => {
    return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
  }

  /**
   * Check if geolocation is available
   */
  const isSupported = computed(() => 'geolocation' in navigator)

  /**
   * Clear error state
   */
  const clearError = (): void => {
    error.value = null
  }

  return {
    // State
    position,
    error,
    isLoading,
    isWatching,
    hasLocation,
    hasPermission,
    isSupported,

    // Actions
    getCurrentPosition,
    watchPosition,
    stopWatching,
    getLocationWithFallback,
    clearError,

    // Utilities
    calculateDistance,
    isWithinRadius,
    formatCoordinates,
    FALLBACK_COORDINATES
  }
}
