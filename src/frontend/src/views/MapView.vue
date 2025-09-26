<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import MapComponent from '../components/MapComponent.vue';
import ArtworkCard from '../components/ArtworkCard.vue';
import { useArtworksStore } from '../stores/artworks';
import { useMapPreviewStore } from '../stores/mapPreview';
import type { ArtworkPin, Coordinates, MapPreview, SearchResult } from '../types';

const router = useRouter();
const artworksStore = useArtworksStore();
const mapPreviewStore = useMapPreviewStore();

// Computed properties
const mapCenter = computed(() => artworksStore.mapCenter);
const mapZoom = computed(() => artworksStore.mapZoom);
const artworks = computed(() => {
  const storeArtworks = artworksStore.artworks;
  console.log('[MARKER DEBUG] MapView artworks computed property triggered:', {
    storeArtworksLength: storeArtworks.length,
    timestamp: new Date().toISOString(),
  });
  return storeArtworks;
});

// Preview state
const currentPreview = computed(() => mapPreviewStore.currentPreview);
const isPreviewVisible = computed(() => {
  const visible = mapPreviewStore.isVisible;
  console.log('[MAPVIEW DEBUG] Preview visibility computed:', {
    visible,
    hasCurrentPreview: !!mapPreviewStore.currentPreview,
    currentPreviewId: mapPreviewStore.currentPreview?.id,
    timestamp: new Date().toISOString()
  });
  return visible;
});

// Shake animation state
const shouldShake = ref(false);
const lastPreviewId = ref<string | null>(null);

// Convert MapPreview to SearchResult for ArtworkCard
const previewAsSearchResult = computed((): SearchResult | null => {
  if (!currentPreview.value) return null;
  
  return {
    id: currentPreview.value.id,
    lat: currentPreview.value.lat,
    lon: currentPreview.value.lon,
    type_name: 'artwork', // Default type name
    title: currentPreview.value.title,
    artist_name: null,
    tags: {
      description: currentPreview.value.description,
    },
    recent_photo: currentPreview.value.thumbnailUrl || null,
    photo_count: currentPreview.value.thumbnailUrl ? 1 : 0,
    distance_km: null,
  };
});

// Event handlers
function handleArtworkClick(artwork: ArtworkPin) {
  // Navigate to artwork details page
  router.push(`/artwork/${artwork.id}`);
}

function handlePreviewArtwork(preview: MapPreview) {
  console.log('[MAPVIEW DEBUG] handlePreviewArtwork called with:', preview);
  
  // Check if this is a different artwork (trigger shake)
  if (lastPreviewId.value !== preview.id) {
    shouldShake.value = true;
    lastPreviewId.value = preview.id;
    
    // Reset shake animation after it completes
    setTimeout(() => {
      shouldShake.value = false;
    }, 600); // Match animation duration (0.6s)
  }
  
  // Show the preview card
  mapPreviewStore.showPreview(preview);
  console.log('[MAPVIEW DEBUG] Preview store updated, isVisible:', mapPreviewStore.isVisible);
}

function handleDismissPreview() {
  console.log('[MAPVIEW DEBUG] handleDismissPreview called');
  // Dismiss the preview card when map pans
  mapPreviewStore.hidePreview();
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

function handlePreviewClick(artwork: SearchResult) {
  console.log('[MAPVIEW DEBUG] handlePreviewClick called for artwork:', artwork.id);
  // Navigate to artwork details page
  mapPreviewStore.hidePreview();
  router.push(`/artwork/${artwork.id}`);
}

// Initialize on mount
onMounted(() => {
  // Restore last map position from localStorage if available
  try {
    const saved = localStorage.getItem('map:lastState');
    if (saved) {
      const parsed = JSON.parse(saved) as { center: Coordinates; zoom: number };
      if (
        parsed?.center?.latitude &&
        parsed?.center?.longitude &&
        typeof parsed.zoom === 'number'
      ) {
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
  <div class="map-view h-full w-full relative">
    <MapComponent
      :center="mapCenter"
      :zoom="mapZoom"
      :artworks="artworks"
      @artwork-click="handleArtworkClick"
      @preview-artwork="handlePreviewArtwork"
      @dismiss-preview="handleDismissPreview"
      @map-move="handleMapMove"
      @location-found="handleLocationFound"
    />
    
    <!-- Map Preview using ArtworkCard -->
    <div
      v-if="previewAsSearchResult && isPreviewVisible"
      class="map-preview-wrapper fixed bottom-32 left-1/2 transform -translate-x-1/2 w-80 max-w-[calc(100vw-2rem)] z-50 transition-transform duration-200"
      :class="{ 'animate-shake': shouldShake }"
      style="z-index: 1000;"
    >
      <ArtworkCard
        :artwork="previewAsSearchResult"
        :clickable="true"
        :compact="true"
        class="shadow-xl"
        @click="handlePreviewClick"
      />
    </div>
  </div>
</template>

<style scoped>
.map-view {
  /* Ensure full height minus app header */
  height: calc(100vh - 4rem);
  /* Relative positioning for absolute-positioned MapPreviewCard */
  position: relative;
}

@keyframes shake-and-settle {
  0% {
    transform: translateX(-50%) scale(1) translateY(0);
  }
  15% {
    transform: translateX(-50%) scale(1.05) translateY(-5px) rotateZ(1deg);
  }
  30% {
    transform: translateX(-50%) scale(1.05) translateY(-5px) rotateZ(-1deg);
  }
  45% {
    transform: translateX(-50%) scale(1.05) translateY(-5px) rotateZ(0.5deg);
  }
  60% {
    transform: translateX(-50%) scale(1.05) translateY(-5px) rotateZ(-0.5deg);
  }
  75% {
    transform: translateX(-50%) scale(1.05) translateY(-5px) rotateZ(0.2deg);
  }
  100% {
    transform: translateX(-50%) scale(1.05) translateY(-5px) rotateZ(0);
  }
}

.animate-shake {
  animation: shake-and-settle 0.6s ease-in-out;
}
</style>
