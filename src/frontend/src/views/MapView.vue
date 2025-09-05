<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MapComponent from '../components/MapComponent.vue';
import { useArtworksStore } from '../stores/artworks';
import type { ArtworkPin, Coordinates } from '../types';

const router = useRouter();
const artworksStore = useArtworksStore();

// Computed properties
const mapCenter = computed(() => artworksStore.mapCenter);
const mapZoom = computed(() => artworksStore.mapZoom);
const artworks = computed(() => artworksStore.artworks);

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
  // Load artworks if we have a location
  if (artworksStore.currentLocation) {
    artworksStore.fetchNearbyArtworks();
  }
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
