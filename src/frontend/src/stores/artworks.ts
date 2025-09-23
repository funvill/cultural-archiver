import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { ArtworkPin, Coordinates, MapBounds, ArtworkDetails } from '../types';
import type { MinimalArtworkPin, ArtworkWithPhotos } from '../../../shared/types';
import { apiService, getErrorMessage, isNetworkError } from '../services/api';
import { mapCache } from '../utils/mapCache';

/**
 * Artwork and map state management store
 */
export const useArtworksStore = defineStore('artworks', () => {
  // State
  const artworks = ref<ArtworkPin[]>([]);
  const currentLocation = ref<Coordinates | null>(null);
  const mapCenter = ref<Coordinates>({ latitude: 49.2827, longitude: -123.1207 }); // Vancouver default
  const mapZoom = ref(15);
  const mapBounds = ref<MapBounds | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastFetchLocation = ref<Coordinates | null>(null);
  const fetchRadius = ref(500); // 500 meters default

  // Cache for individual artworks
  const artworkCache = ref<Map<string, ArtworkDetails>>(new Map());

  // Computed getters
  const nearbyArtworks = computed(() => {
    if (!currentLocation.value) return artworks.value;

    return artworks.value.filter(artwork => {
      const distance = calculateDistance(currentLocation.value!, {
        latitude: artwork.latitude,
        longitude: artwork.longitude,
      });
      return distance <= fetchRadius.value;
    });
  });

  const artworkById = computed((): ((id: string) => ArtworkDetails | undefined) => {
    return (id: string) => artworkCache.value.get(id);
  });

  const hasLocationPermission = computed(() => !!currentLocation.value);

  // Actions
  function setCurrentLocation(location: Coordinates): void {
    currentLocation.value = location;

    // Update map center to user location if not manually moved
    if (!lastFetchLocation.value) {
      mapCenter.value = location;
    }
  }

  // Persist map state to localStorage
  function persistMapState(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        'map:lastState',
        JSON.stringify({ center: mapCenter.value, zoom: mapZoom.value })
      );
    } catch {
      /* ignore */
    }
  }

  function setMapCenter(center: Coordinates): void {
    mapCenter.value = center;
    persistMapState();
  }

  function setMapZoom(zoom: number): void {
    mapZoom.value = zoom;
    persistMapState();
  }

  function setMapBounds(bounds: MapBounds): void {
    mapBounds.value = bounds;
  }

  function setArtworks(artworkList: ArtworkPin[]): void {
    artworks.value = artworkList;
    error.value = null;
  }

  function addArtwork(artwork: ArtworkPin): void {
    const existingIndex = artworks.value.findIndex(a => a.id === artwork.id);
    if (existingIndex >= 0) {
      artworks.value[existingIndex] = artwork;
    } else {
      artworks.value.push(artwork);
    }
  }

  function removeArtwork(artworkId: string): void {
    const index = artworks.value.findIndex(a => a.id === artworkId);
    if (index >= 0) {
      artworks.value.splice(index, 1);
    }
    artworkCache.value.delete(artworkId);
  }

  function setLoading(loading: boolean): void {
    isLoading.value = loading;
  }

  function setError(errorMessage: string | null): void {
    error.value = errorMessage;
  }

  function clearError(): void {
    error.value = null;
  }

  // Cache individual artwork details
  function cacheArtwork(id: string, artwork: ArtworkDetails): void {
    artworkCache.value.set(id, artwork);
  }

  // Fetch nearby artworks from API
  async function fetchNearbyArtworks(location?: Coordinates): Promise<void> {
    const targetLocation = location || currentLocation.value;
    if (!targetLocation) {
      setError('Location is required to fetch nearby artworks');
      return;
    }

    // Skip if we recently fetched for this location
    if (
      lastFetchLocation.value &&
      calculateDistance(targetLocation, lastFetchLocation.value) < 100
    ) {
      return;
    }

    setLoading(true);
    clearError();

    try {
      const response = await apiService.getNearbyArtworks(
        targetLocation.latitude,
        targetLocation.longitude,
        fetchRadius.value,
        250,
        { minimal: true }
      );

      // The API now returns a full API response with { success: true, data: { artworks: [...] } }
      const apiArtworks = response.data?.artworks || [];

      // Convert the API response to ArtworkPin format
      const artworkPins: ArtworkPin[] = apiArtworks.map(
        (artwork: MinimalArtworkPin | ArtworkWithPhotos): ArtworkPin => {
          const pin: ArtworkPin = {
            id: artwork.id,
            latitude: artwork.lat,
            longitude: artwork.lon,
            type: artwork.type_name || 'unknown',
            photos: [],
          };
          if (artwork.recent_photo) {
            pin.photos = [artwork.recent_photo];
          }
          return pin;
        }
      );

      setArtworks(artworkPins);
      lastFetchLocation.value = targetLocation;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Error fetching nearby artworks:', err);

      // If it's a network error, retry once
      if (isNetworkError(err)) {
        setTimeout(() => {
          fetchNearbyArtworks(location);
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  }

  // Fetch individual artwork details
  async function fetchArtwork(id: string): Promise<ArtworkDetails | null> {
    // Return cached if available
    if (artworkCache.value.has(id)) {
      return artworkCache.value.get(id) || null;
    }

    setLoading(true);
    clearError();

    try {
      const artwork = await apiService.getArtworkDetails(id);

      if (artwork) {
        cacheArtwork(id, artwork);
        return artwork;
      }

      return null;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Error fetching artwork details:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  // Refresh individual artwork details (bypass cache)
  async function refreshArtwork(id: string): Promise<ArtworkDetails | null> {
    setLoading(true);
    clearError();

    try {
      const artwork = await apiService.getArtworkDetails(id);

      if (artwork) {
        cacheArtwork(id, artwork);
        return artwork;
      }

      return null;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Failed to refresh artwork details:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }

  // Search artworks by bounds (for map view)
  async function fetchArtworksInBounds(bounds: MapBounds): Promise<void> {
    setLoading(true);
    clearError();

    try {
      // 1) Load cached pins first for instant UI while network fetch happens
      try {
        mapCache.prune(); // drop expired
        const cachedPins = mapCache.getPinsInBounds(bounds);
        if (cachedPins.length) {
          const existingIndexById = new Map<string, number>();
          artworks.value.forEach((a, i) => existingIndexById.set(a.id, i));
          cachedPins.forEach(pin => {
            const existingIdx = existingIndexById.get(pin.id);
            if (existingIdx !== undefined) {
              artworks.value[existingIdx] = { ...artworks.value[existingIdx], ...pin };
            } else {
              artworks.value.push(pin);
            }
          });
        }
      } catch {
        /* ignore cache errors */
      }

      // Use center point of bounds for nearby search
      const centerLat = (bounds.north + bounds.south) / 2;
      const centerLon = (bounds.east + bounds.west) / 2;

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
      );

      const effectiveRadius = Math.max(radius, 200); // Allow smaller than 500 for tighter view but minimum 200m
      fetchRadius.value = Math.round(effectiveRadius);
      const response = await apiService.getNearbyArtworks(
        centerLat,
        centerLon,
        effectiveRadius,
        250,
        { minimal: true }
      );

      const apiArtworks = response.data?.artworks || [];
      const artworkPins: ArtworkPin[] = apiArtworks.map(
        (artwork: MinimalArtworkPin | ArtworkWithPhotos): ArtworkPin => {
          const pin: ArtworkPin = {
            id: artwork.id,
            latitude: artwork.lat,
            longitude: artwork.lon,
            type: artwork.type_name || 'unknown',
            photos: [],
          };
          if (artwork.recent_photo) {
            pin.photos = [artwork.recent_photo];
          }
          return pin;
        }
      );

      // ==============================================
      // Session Cache Merge Strategy
      // ==============================================
      // Requirement: "The map pins should be cached in the browsers memory only for that session"
      // We therefore DO NOT replace the existing list. We merge new/updated pins into the
      // reactive in‑memory array and keep previously fetched pins even if they fall outside
      // the current viewport. They will naturally clear on page refresh (session scope).

      const existingIndexById = new Map<string, number>();
      artworks.value.forEach((a, i) => existingIndexById.set(a.id, i));

      artworkPins.forEach(pin => {
        const existingIdx = existingIndexById.get(pin.id);
        if (existingIdx !== undefined) {
          // Merge (keep any existing fields like title/photos if already populated)
          artworks.value[existingIdx] = {
            ...artworks.value[existingIdx],
            ...pin,
          };
        } else {
          artworks.value.push(pin);
        }
      });

      console.log('[DEBUG] Session artwork cache size:', artworks.value.length);

      // 3) Persist pins to persistent cache for future loads
      try {
        mapCache.upsertPins(artworkPins);
      } catch {
        /* ignore cache errors */
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Error fetching artworks in bounds:', err);
    } finally {
      setLoading(false);
    }
  }

  // Progressive loading functionality for large datasets with adaptive batch sizing
  async function fetchArtworksInBoundsBatched(
    bounds: MapBounds,
    initialBatchSize: number = 500,
    onProgress?: (progress: {
      loaded: number;
      total: number;
      batch: ArtworkPin[];
      batchSize: number;
      avgTime: number;
    }) => void
  ): Promise<void> {
    setLoading(true);
    clearError();

    // Performance tracking for adaptive batch sizing
    const performanceMetrics: number[] = [];
    let currentBatchSize = initialBatchSize;
    const minBatchSize = 100;
    const maxBatchSize = 1000;
    const targetBatchTime = 1000; // Target 1 second per batch

    try {
      // 1) Load cached pins first for instant UI
      try {
        mapCache.prune();
        const cachedPins = mapCache.getPinsInBounds(bounds);
        if (cachedPins.length) {
          const existingIndexById = new Map<string, number>();
          artworks.value.forEach((a, i) => existingIndexById.set(a.id, i));
          cachedPins.forEach(pin => {
            const existingIdx = existingIndexById.get(pin.id);
            if (existingIdx !== undefined) {
              artworks.value[existingIdx] = { ...artworks.value[existingIdx], ...pin };
            } else {
              artworks.value.push(pin);
            }
          });
        }
      } catch {
        /* ignore cache errors */
      }

      // Use center point of bounds for nearby search
      const centerLat = (bounds.north + bounds.south) / 2;
      const centerLon = (bounds.east + bounds.west) / 2;

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
      );

      const effectiveRadius = Math.max(radius, 200);
      fetchRadius.value = Math.round(effectiveRadius);

      // Progressive batch loading with adaptive sizing
      let offset = 0;
      let totalLoaded = 0;
      let allArtworkPins: ArtworkPin[] = [];
      let batchNumber = 0;

      while (true) {
        batchNumber++;
        const batchStartTime = performance.now();

        try {
          // Fetch batch with current batch size
          const response = await apiService.getNearbyArtworks(
            centerLat,
            centerLon,
            effectiveRadius,
            currentBatchSize,
            { minimal: true }
          );

          const batchEndTime = performance.now();
          const batchTime = batchEndTime - batchStartTime;
          performanceMetrics.push(batchTime);

          const apiArtworks = response.data?.artworks || [];

          // If no results or fewer than batch size, this is the last batch
          if (apiArtworks.length === 0) {
            break;
          }

          // Convert API response to ArtworkPin format
          const batchPins: ArtworkPin[] = apiArtworks.map(
            (artwork: MinimalArtworkPin | ArtworkWithPhotos): ArtworkPin => {
              const pin: ArtworkPin = {
                id: artwork.id,
                latitude: artwork.lat,
                longitude: artwork.lon,
                type: artwork.type_name || 'unknown',
                photos: [],
              };
              if (artwork.recent_photo) {
                pin.photos = [artwork.recent_photo];
              }
              return pin;
            }
          );

          allArtworkPins.push(...batchPins);
          totalLoaded += batchPins.length;

          // Merge batch into reactive store immediately for progressive UI updates
          const existingIndexById = new Map<string, number>();
          artworks.value.forEach((a, i) => existingIndexById.set(a.id, i));

          batchPins.forEach(pin => {
            const existingIdx = existingIndexById.get(pin.id);
            if (existingIdx !== undefined) {
              artworks.value[existingIdx] = {
                ...artworks.value[existingIdx],
                ...pin,
              };
            } else {
              artworks.value.push(pin);
            }
          });

          // Calculate average batch time for progress reporting
          const avgTime = performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length;

          // Call progress callback with performance metrics
          if (onProgress) {
            onProgress({
              loaded: totalLoaded,
              total: totalLoaded + (batchPins.length === currentBatchSize ? currentBatchSize : 0), // Estimate
              batch: batchPins,
              batchSize: currentBatchSize,
              avgTime,
            });
          }

          // Adaptive batch sizing based on performance
          if (performanceMetrics.length >= 2) {
            // If batch took too long, reduce batch size
            if (batchTime > targetBatchTime && currentBatchSize > minBatchSize) {
              currentBatchSize = Math.max(minBatchSize, Math.round(currentBatchSize * 0.8));
              console.log(
                `[Progressive Loading] Reduced batch size to ${currentBatchSize} (${batchTime.toFixed(0)}ms batch time)`
              );
            }
            // If batch was fast and we have room to grow, increase batch size
            else if (batchTime < targetBatchTime * 0.5 && currentBatchSize < maxBatchSize) {
              currentBatchSize = Math.min(maxBatchSize, Math.round(currentBatchSize * 1.2));
              console.log(
                `[Progressive Loading] Increased batch size to ${currentBatchSize} (${batchTime.toFixed(0)}ms batch time)`
              );
            }
          }

          // Break if we got fewer results than batch size (end of data)
          if (apiArtworks.length < currentBatchSize) {
            break;
          }

          offset += currentBatchSize;

          // Dynamic delay based on performance - faster for good performance, slower for poor performance
          const dynamicDelay = Math.max(10, Math.min(100, batchTime / 10));
          await new Promise(resolve => setTimeout(resolve, dynamicDelay));
        } catch (batchError) {
          console.warn(`Error loading batch ${batchNumber} at offset ${offset}:`, batchError);

          // On error, try reducing batch size for next attempt
          if (currentBatchSize > minBatchSize) {
            currentBatchSize = Math.max(minBatchSize, Math.round(currentBatchSize * 0.5));
            console.log(
              `[Progressive Loading] Reduced batch size to ${currentBatchSize} due to error`
            );
            continue; // Try again with smaller batch
          }

          break; // Stop on error if already at minimum batch size
        }
      }

      const avgBatchTime =
        performanceMetrics.length > 0
          ? performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length
          : 0;

      console.log(
        `[Progressive Loading] Complete. ${totalLoaded} artworks loaded in ${batchNumber} batches. Avg batch time: ${avgBatchTime.toFixed(0)}ms`
      );

      // Persist all pins to cache
      try {
        mapCache.upsertPins(allArtworkPins);
      } catch {
        /* ignore cache errors */
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Error in progressive artwork loading:', err);
    } finally {
      setLoading(false);
    }
  }

  // Get artworks for submission (nearby list)
  async function getArtworksForSubmission(location: Coordinates): Promise<ArtworkPin[]> {
    try {
      const response = await apiService.getNearbyArtworks(
        location.latitude,
        location.longitude,
        100, // Smaller radius for submission
        10, // Limit results
        { minimal: true }
      );

      // The API now returns a full API response with { success: true, data: { artworks: [...] } }
      const apiArtworks = response.data?.artworks || [];

      // Convert the API response to ArtworkPin format
      const artworkPins: ArtworkPin[] = apiArtworks.map(
        (artwork: MinimalArtworkPin | ArtworkWithPhotos): ArtworkPin => {
          const pin: ArtworkPin = {
            id: artwork.id,
            latitude: artwork.lat,
            longitude: artwork.lon,
            type: artwork.type_name || 'unknown',
            photos: [],
          };
          if (artwork.recent_photo) {
            pin.photos = [artwork.recent_photo];
          }
          return pin;
        }
      );

      return artworkPins;
    } catch (err) {
      console.warn('Error fetching artworks for submission:', err);
      return [];
    }
  }

  // Utility function to calculate distance between two coordinates
  function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Reset store state
  function reset(): void {
    artworks.value = [];
    artworkCache.value.clear();
    lastFetchLocation.value = null;
    error.value = null;
    isLoading.value = false;
  }

  // Cache management (for UI button)
  function clearMapCache(): void {
    try {
      mapCache.clear();
    } catch {
      /* ignore */
    }
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
    fetchArtworksInBoundsBatched,
    getArtworksForSubmission,
    calculateDistance,
    reset,
    clearMapCache,
  };
});
