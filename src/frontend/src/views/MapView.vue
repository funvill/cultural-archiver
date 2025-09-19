<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import MapComponent from '../components/MapComponent.vue';
import { useArtworksStore } from '../stores/artworks';
import type { ArtworkPin, Coordinates } from '../types';

const router = useRouter();
const artworksStore = useArtworksStore();

// Computed properties
const mapCenter = computed(() => artworksStore.mapCenter);
const mapZoom = computed(() => artworksStore.mapZoom);
const artworks = computed(() => {
  const storeArtworks = artworksStore.artworks;
  console.log('[MARKER DEBUG] MapView artworks computed property triggered:', {
    storeArtworksLength: storeArtworks.length,
    timestamp: new Date().toISOString()
  });
  return storeArtworks;
});

// Event handlers
function handleArtworkClick(artwork: ArtworkPin) {
  // Navigate to artwork details page
  router.push(`/artwork/${artwork.id}`);
}

function handleMapMove(data: { center: Coordinates; zoom: number }) {
  // Store updates are handled in MapComponent
  console.log('Map moved to:', data.center, 'zoom:', data.zoom);
}

function handleLocationFound(location: Coordinates) {
  console.log('User location found:', location);
  // Fetch nearby artworks
  artworksStore.fetchNearbyArtworks(location);
}

// Initialize on mount
onMounted(() => {
  // Restore last map position from localStorage if available
  try {
    const saved = localStorage.getItem('map:lastState');
    if (saved) {
      const parsed = JSON.parse(saved) as { center: Coordinates; zoom: number };
      if (parsed?.center?.latitude && parsed?.center?.longitude && typeof parsed.zoom === 'number') {
        // Set store first so MapComponent receives the props at initial render
        artworksStore.setMapCenter(parsed.center);
        artworksStore.setMapZoom(parsed.zoom);
      }
    }
  } catch (e) {
    console.warn('Failed to restore map state', e);
  }

  // Load artworks after store initialized; use currentLocation if present
  if (artworksStore.currentLocation) {
    artworksStore.fetchNearbyArtworks();
  }

  // Watch for changes to persist (simple interval to avoid adding watchers here)
  const persist = () => {
    try {
      localStorage.setItem(
        'map:lastState',
        JSON.stringify({ center: artworksStore.mapCenter, zoom: artworksStore.mapZoom })
      );
    } catch (e) {
      /* ignore */
    }
  };
  // Persist immediately and then periodically
  persist();
  const interval = setInterval(persist, 4000);
  window.addEventListener('beforeunload', persist);

  onUnmounted(() => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', persist);
  });
});
</script>

<template>
  <div class="map-view h-full w-full">
    <MapComponent
      :center="mapCenter"
      :zoom="mapZoom"
      :artworks="artworks"
      @artwork-click="handleArtworkClick"
      @map-move="handleMapMove"
      @location-found="handleLocationFound"
    />
  </div>
</template>

<style scoped>
.map-view {
  /* Ensure full height minus app header */
  height: calc(100vh - 4rem);
}
</style>
