import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { c as canUseLocalStorage, a as apiService, b as getErrorMessage, m as isNetworkError } from '../ssr-entry-server.js';

const CACHE_KEY = "map:artworkPins:v1";
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
function now() {
  return Date.now();
}
function loadAll() {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
  }
  return {};
}
function saveAll(data) {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
  }
}
function isExpired(pin, ttlMs = DEFAULT_TTL_MS) {
  return now() - pin.cachedAt > ttlMs;
}
const mapCache = {
  // Return non-expired pins that fall within bounds
  getPinsInBounds(bounds, ttlMs = DEFAULT_TTL_MS) {
    const all = loadAll();
    const list = [];
    for (const id in all) {
      const p = all[id];
      if (!p) continue;
      if (isExpired(p, ttlMs)) continue;
      if (p.latitude <= bounds.north && p.latitude >= bounds.south && p.longitude <= bounds.east && p.longitude >= bounds.west) {
        const { cachedAt, ...pin } = p;
        list.push(pin);
      }
    }
    return list;
  },
  // Upsert pins, stamping cachedAt
  upsertPins(pins) {
    if (!pins?.length) return;
    const all = loadAll();
    const stamp = now();
    for (const pin of pins) {
      all[pin.id] = {
        ...all[pin.id],
        ...pin,
        cachedAt: stamp
      };
    }
    saveAll(all);
  },
  // Remove expired entries
  prune(ttlMs = DEFAULT_TTL_MS) {
    const all = loadAll();
    let changed = false;
    for (const id in all) {
      const p = all[id];
      if (!p) continue;
      if (isExpired(p, ttlMs)) {
        delete all[id];
        changed = true;
      }
    }
    if (changed) saveAll(all);
  },
  // Clear cache completely
  clear() {
    if (!canUseLocalStorage()) return;
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
    }
  },
  // For stats/diagnostics
  size() {
    const all = loadAll();
    return Object.keys(all).length;
  }
};

const useArtworksStore = defineStore("artworks", () => {
  const artworks = ref([]);
  const currentLocation = ref(null);
  const mapCenter = ref({ latitude: 49.2827, longitude: -123.1207 });
  const mapZoom = ref(15);
  const mapBounds = ref(null);
  const isLoading = ref(false);
  const error = ref(null);
  const lastFetchLocation = ref(null);
  const fetchRadius = ref(500);
  const MAX_NEARBY_RADIUS = 5e4;
  const artworkCache = ref(/* @__PURE__ */ new Map());
  const nearbyArtworks = computed(() => {
    if (!currentLocation.value) return artworks.value;
    return artworks.value.filter((artwork) => {
      const distance = calculateDistance(currentLocation.value, {
        latitude: artwork.latitude,
        longitude: artwork.longitude
      });
      return distance <= fetchRadius.value;
    });
  });
  const artworkById = computed(() => {
    return (id) => artworkCache.value.get(id);
  });
  const hasLocationPermission = computed(() => !!currentLocation.value);
  function setCurrentLocation(location) {
    currentLocation.value = location;
    if (!lastFetchLocation.value) {
      mapCenter.value = location;
    }
  }
  function persistMapState() {
    if (!canUseLocalStorage()) return;
    try {
      window.localStorage.setItem(
        "map:lastState",
        JSON.stringify({ center: mapCenter.value, zoom: mapZoom.value })
      );
    } catch (e) {
      console.warn("[ARTWORKS] Failed to persist map state to localStorage:", e);
    }
  }
  function setMapCenter(center) {
    mapCenter.value = center;
    persistMapState();
  }
  function setMapZoom(zoom) {
    mapZoom.value = zoom;
    persistMapState();
  }
  function setMapBounds(bounds) {
    mapBounds.value = bounds;
  }
  function setArtworks(artworkList) {
    artworks.value = artworkList;
    error.value = null;
  }
  function addArtwork(artwork) {
    const existingIndex = artworks.value.findIndex((a) => a.id === artwork.id);
    if (existingIndex >= 0) {
      artworks.value[existingIndex] = artwork;
    } else {
      artworks.value.push(artwork);
    }
  }
  function removeArtwork(artworkId) {
    const index = artworks.value.findIndex((a) => a.id === artworkId);
    if (index >= 0) {
      artworks.value.splice(index, 1);
    }
    artworkCache.value.delete(artworkId);
  }
  function setLoading(loading) {
    isLoading.value = loading;
  }
  function setError(errorMessage) {
    error.value = errorMessage;
  }
  function clearError() {
    error.value = null;
  }
  function cacheArtwork(id, artwork) {
    artworkCache.value.set(id, artwork);
  }
  async function fetchNearbyArtworks(location) {
    const targetLocation = location || currentLocation.value;
    if (!targetLocation) {
      setError("Location is required to fetch nearby artworks");
      return;
    }
    if (lastFetchLocation.value && calculateDistance(targetLocation, lastFetchLocation.value) < 100) {
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
      const apiArtworks = response.data?.artworks || [];
      const artworkPins = apiArtworks.map(
        (artwork) => {
          const pin = {
            id: artwork.id,
            latitude: artwork.lat,
            longitude: artwork.lon,
            type: artwork.type_name || "unknown",
            photos: []
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
      console.error("Error fetching nearby artworks:", err);
      if (isNetworkError(err)) {
        setTimeout(() => {
          fetchNearbyArtworks(location);
        }, 2e3);
      }
    } finally {
      setLoading(false);
    }
  }
  async function fetchArtwork(id) {
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
      console.error("Error fetching artwork details:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }
  async function refreshArtwork(id) {
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
      console.error("Failed to refresh artwork details:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }
  async function fetchArtworksInBounds(bounds) {
    setLoading(true);
    clearError();
    try {
      try {
        mapCache.prune();
        const cachedPins = mapCache.getPinsInBounds(bounds);
        if (cachedPins.length) {
          const existingIndexById2 = /* @__PURE__ */ new Map();
          artworks.value.forEach((a, i) => existingIndexById2.set(a.id, i));
          cachedPins.forEach((pin) => {
            const existingIdx = existingIndexById2.get(pin.id);
            if (existingIdx !== void 0) {
              artworks.value[existingIdx] = { ...artworks.value[existingIdx], ...pin };
            } else {
              artworks.value.push(pin);
            }
          });
        }
      } catch {
      }
      const centerLat = (bounds.north + bounds.south) / 2;
      const centerLon = (bounds.east + bounds.west) / 2;
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
      if (effectiveRadius > MAX_NEARBY_RADIUS) {
        await fetchArtworksInBoundsTiled(bounds, MAX_NEARBY_RADIUS);
        return;
      }
      const response = await apiService.getNearbyArtworks(
        centerLat,
        centerLon,
        effectiveRadius,
        250,
        { minimal: true }
      );
      const apiArtworks = response.data?.artworks || [];
      const artworkPins = apiArtworks.map(
        (artwork) => {
          const pin = {
            id: artwork.id,
            latitude: artwork.lat,
            longitude: artwork.lon,
            type: artwork.type_name || "unknown",
            photos: []
          };
          if (artwork.recent_photo) {
            pin.photos = [artwork.recent_photo];
          }
          return pin;
        }
      );
      const existingIndexById = /* @__PURE__ */ new Map();
      artworks.value.forEach((a, i) => existingIndexById.set(a.id, i));
      artworkPins.forEach((pin) => {
        const existingIdx = existingIndexById.get(pin.id);
        if (existingIdx !== void 0) {
          artworks.value[existingIdx] = {
            ...artworks.value[existingIdx],
            ...pin
          };
        } else {
          artworks.value.push(pin);
        }
      });
      console.log("[DEBUG] Session artwork cache size:", artworks.value.length);
      try {
        mapCache.upsertPins(artworkPins);
      } catch {
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error("Error fetching artworks in bounds:", err);
    } finally {
      setLoading(false);
    }
  }
  async function fetchArtworksInBoundsBatched(bounds, initialBatchSize = 500, onProgress) {
    setLoading(true);
    clearError();
    const performanceMetrics = [];
    let currentBatchSize = initialBatchSize;
    const minBatchSize = 100;
    const maxBatchSize = 1e3;
    const targetBatchTime = 1e3;
    try {
      try {
        mapCache.prune();
        const cachedPins = mapCache.getPinsInBounds(bounds);
        if (cachedPins.length) {
          const existingIndexById = /* @__PURE__ */ new Map();
          artworks.value.forEach((a, i) => existingIndexById.set(a.id, i));
          cachedPins.forEach((pin) => {
            const existingIdx = existingIndexById.get(pin.id);
            if (existingIdx !== void 0) {
              artworks.value[existingIdx] = { ...artworks.value[existingIdx], ...pin };
            } else {
              artworks.value.push(pin);
            }
          });
        }
      } catch {
      }
      const centerLat = (bounds.north + bounds.south) / 2;
      const centerLon = (bounds.east + bounds.west) / 2;
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
      if (effectiveRadius > MAX_NEARBY_RADIUS) {
        await fetchArtworksInBoundsTiled(bounds, MAX_NEARBY_RADIUS);
        return;
      }
      let offset = 0;
      let totalLoaded = 0;
      let allArtworkPins = [];
      let batchNumber = 0;
      while (true) {
        batchNumber++;
        const batchStartTime = performance.now();
        try {
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
          if (apiArtworks.length === 0) {
            break;
          }
          const batchPins = apiArtworks.map(
            (artwork) => {
              const pin = {
                id: artwork.id,
                latitude: artwork.lat,
                longitude: artwork.lon,
                type: artwork.type_name || "unknown",
                photos: []
              };
              if (artwork.recent_photo) {
                pin.photos = [artwork.recent_photo];
              }
              return pin;
            }
          );
          allArtworkPins.push(...batchPins);
          totalLoaded += batchPins.length;
          const existingIndexById = /* @__PURE__ */ new Map();
          artworks.value.forEach((a, i) => existingIndexById.set(a.id, i));
          batchPins.forEach((pin) => {
            const existingIdx = existingIndexById.get(pin.id);
            if (existingIdx !== void 0) {
              artworks.value[existingIdx] = {
                ...artworks.value[existingIdx],
                ...pin
              };
            } else {
              artworks.value.push(pin);
            }
          });
          const avgTime = performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length;
          if (onProgress) {
            onProgress({
              loaded: totalLoaded,
              total: totalLoaded + (batchPins.length === currentBatchSize ? currentBatchSize : 0),
              // Estimate
              batch: batchPins,
              batchSize: currentBatchSize,
              avgTime
            });
          }
          if (performanceMetrics.length >= 2) {
            if (batchTime > targetBatchTime && currentBatchSize > minBatchSize) {
              currentBatchSize = Math.max(minBatchSize, Math.round(currentBatchSize * 0.8));
              console.log(
                `[Progressive Loading] Reduced batch size to ${currentBatchSize} (${batchTime.toFixed(0)}ms batch time)`
              );
            } else if (batchTime < targetBatchTime * 0.5 && currentBatchSize < maxBatchSize) {
              currentBatchSize = Math.min(maxBatchSize, Math.round(currentBatchSize * 1.2));
              console.log(
                `[Progressive Loading] Increased batch size to ${currentBatchSize} (${batchTime.toFixed(0)}ms batch time)`
              );
            }
          }
          if (apiArtworks.length < currentBatchSize) {
            break;
          }
          offset += currentBatchSize;
          const dynamicDelay = Math.max(10, Math.min(100, batchTime / 10));
          await new Promise((resolve) => setTimeout(resolve, dynamicDelay));
        } catch (batchError) {
          console.warn(`Error loading batch ${batchNumber} at offset ${offset}:`, batchError);
          if (currentBatchSize > minBatchSize) {
            currentBatchSize = Math.max(minBatchSize, Math.round(currentBatchSize * 0.5));
            console.log(
              `[Progressive Loading] Reduced batch size to ${currentBatchSize} due to error`
            );
            continue;
          }
          break;
        }
      }
      const avgBatchTime = performanceMetrics.length > 0 ? performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length : 0;
      console.log(
        `[Progressive Loading] Complete. ${totalLoaded} artworks loaded in ${batchNumber} batches. Avg batch time: ${avgBatchTime.toFixed(0)}ms`
      );
      try {
        mapCache.upsertPins(allArtworkPins);
      } catch {
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error("Error in progressive artwork loading:", err);
    } finally {
      setLoading(false);
    }
  }
  async function fetchArtworksInBoundsTiled(bounds, tileRadius = MAX_NEARBY_RADIUS, concurrency = 4) {
    setLoading(true);
    clearError();
    try {
      const latSpan = bounds.north - bounds.south;
      const lonSpan = bounds.east - bounds.west;
      const centerLat = (bounds.north + bounds.south) / 2;
      const latMetersPerDeg = 111320;
      const lonMetersPerDeg = 111320 * Math.cos(centerLat * Math.PI / 180);
      const widthMeters = Math.max(1, lonSpan * lonMetersPerDeg);
      const heightMeters = Math.max(1, latSpan * latMetersPerDeg);
      const tileSideMeters = tileRadius * Math.SQRT2;
      const cols = Math.max(1, Math.ceil(widthMeters / tileSideMeters));
      const rows = Math.max(1, Math.ceil(heightMeters / tileSideMeters));
      const lonStep = lonSpan / cols;
      const latStep = latSpan / rows;
      const centers = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lat = bounds.south + (r + 0.5) * latStep;
          const lon = bounds.west + (c + 0.5) * lonStep;
          centers.push({ lat, lon });
        }
      }
      console.log("[Tiled Fetch] bounds ->", { rows, cols, centers: centers.length });
      let index = 0;
      const results = [];
      async function worker() {
        while (true) {
          const i = index++;
          if (i >= centers.length) return;
          const center = centers[i];
          if (!center) {
            continue;
          }
          const centerLat2 = center.lat;
          const centerLon = center.lon;
          try {
            const resp = await apiService.getNearbyArtworks(
              centerLat2,
              centerLon,
              tileRadius,
              250,
              { minimal: true }
            );
            const apiArtworks = resp.data?.artworks || [];
            const pins = apiArtworks.map((artwork) => {
              const a = artwork;
              const optional = a;
              return {
                id: a.id,
                latitude: a.lat,
                longitude: a.lon,
                type: optional.type_name || "unknown",
                photos: optional.recent_photo ? [optional.recent_photo] : []
              };
            });
            results.push(...pins);
            const existingIndexById = /* @__PURE__ */ new Map();
            artworks.value.forEach((a, i2) => existingIndexById.set(a.id, i2));
            pins.forEach((pin) => {
              const existingIdx = existingIndexById.get(pin.id);
              if (existingIdx !== void 0) {
                artworks.value[existingIdx] = { ...artworks.value[existingIdx], ...pin };
              } else {
                artworks.value.push(pin);
              }
            });
          } catch (tileErr) {
            console.warn("[Tiled Fetch] tile request failed for center", center, tileErr);
          }
        }
      }
      const workers = [];
      for (let i = 0; i < Math.min(concurrency, centers.length); i++) {
        workers.push(worker());
      }
      await Promise.all(workers);
      try {
        mapCache.upsertPins(results);
      } catch {
      }
      console.log(`[Tiled Fetch] loaded ${results.length} pins across ${centers.length} tiles`);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error("Error fetching tiled artworks:", err);
    } finally {
      setLoading(false);
    }
  }
  async function getArtworksForSubmission(location) {
    try {
      const response = await apiService.getNearbyArtworks(
        location.latitude,
        location.longitude,
        100,
        // Smaller radius for submission
        10,
        // Limit results
        { minimal: true }
      );
      const apiArtworks = response.data?.artworks || [];
      const artworkPins = apiArtworks.map(
        (artwork) => {
          const pin = {
            id: artwork.id,
            latitude: artwork.lat,
            longitude: artwork.lon,
            type: artwork.type_name || "unknown",
            photos: []
          };
          if (artwork.recent_photo) {
            pin.photos = [artwork.recent_photo];
          }
          return pin;
        }
      );
      return artworkPins;
    } catch (err) {
      console.warn("Error fetching artworks for submission:", err);
      return [];
    }
  }
  function calculateDistance(coord1, coord2) {
    const R = 6371e3;
    const φ1 = coord1.latitude * Math.PI / 180;
    const φ2 = coord2.latitude * Math.PI / 180;
    const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  function reset() {
    artworks.value = [];
    artworkCache.value.clear();
    lastFetchLocation.value = null;
    error.value = null;
    isLoading.value = false;
  }
  function clearMapCache() {
    try {
      mapCache.clear();
    } catch {
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
    clearMapCache
  };
});

export { useArtworksStore as u };
//# sourceMappingURL=artworks-EQolhOHu.js.map
