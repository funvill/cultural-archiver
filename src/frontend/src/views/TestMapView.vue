<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MapComponent from '../components/MapComponent.vue';
import type { ArtworkPin } from '../types/index';

// Mock data generation for testing map filtering
const mockArtworks = ref<ArtworkPin[]>([]);
const isLoading = ref(true);

// Vancouver area coordinates for realistic testing
const VANCOUVER_CENTER = { lat: 49.2827, lng: -123.1207 };
const COORDINATE_RANGE = 0.1; // Approximately 11km range

// Artwork types for variety
const ARTWORK_TYPES = [
  'mural',
  'sculpture', 
  'installation',
  'monument',
  'graffiti',
  'mosaic'
];



// Generate random coordinate within Vancouver area
function generateRandomCoordinate() {
  return {
    lat: VANCOUVER_CENTER.lat + (Math.random() - 0.5) * COORDINATE_RANGE,
    lng: VANCOUVER_CENTER.lng + (Math.random() - 0.5) * COORDINATE_RANGE
  };
}

// Generate mock artwork data
function generateMockArtwork(type: 'normal' | 'visited' | 'starred' | 'unknown', index: number): ArtworkPin {
  const coord = generateRandomCoordinate();
  const artworkType = ARTWORK_TYPES[Math.floor(Math.random() * ARTWORK_TYPES.length)] || 'sculpture';
  
  return {
    id: `mock-${type}-${index}`,
    title: `${type.charAt(0).toUpperCase() + type.slice(1)} ${artworkType} ${index + 1}`,
    latitude: coord.lat,
    longitude: coord.lng,
    type: artworkType,
    photos: [`https://picsum.photos/400/300?random=${index}`]
  };
}

// Generate all mock data
function generateAllMockData() {
  const artworks: ArtworkPin[] = [];
  
  // Generate 250 of each type as specified in requirements
  for (let i = 0; i < 250; i++) {
    artworks.push(generateMockArtwork('normal', i));
    artworks.push(generateMockArtwork('visited', i));  
    artworks.push(generateMockArtwork('starred', i));
    artworks.push(generateMockArtwork('unknown', i));
  }
  
  // Simple shuffle to avoid type issues
  return artworks.sort(() => Math.random() - 0.5);
}

// Handle artwork click events
function handleArtworkClick(artwork: ArtworkPin) {
  console.log('[TestMap] Artwork clicked:', artwork);
  // In a real implementation, this would navigate to artwork detail
  alert(`Clicked: ${artwork.title || 'Untitled'}\nType: ${artwork.type}`);
}

function handlePreviewArtwork(artwork: ArtworkPin) {
  console.log('[TestMap] Preview artwork:', artwork);
}

function handleDismissPreview() {
  console.log('[TestMap] Dismiss preview');
}

function handleMapMove(bounds: any) {
  console.log('[TestMap] Map moved:', bounds);
}

function handleLocationFound(location: any) {
  console.log('[TestMap] Location found:', location);
}

// Initialize mock data on component mount
onMounted(() => {
  console.log('[TestMap] Generating mock data...');
  mockArtworks.value = generateAllMockData();
  isLoading.value = false;
  console.log(`[TestMap] Generated ${mockArtworks.value.length} mock artworks`);
  
  // Log distribution by type
  const distribution = mockArtworks.value.reduce((acc: Record<string, number>, artwork: ArtworkPin) => {
    const title = artwork.title || '';
    const key = title.toLowerCase().includes('unknown') ? 'unknown' : 
                title.toLowerCase().includes('visited') ? 'visited' :
                title.toLowerCase().includes('starred') ? 'starred' : 'normal';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  
  console.log('[TestMap] Distribution:', distribution);
});
</script>

<template>
  <div class="test-map-view h-screen flex flex-col">
    <!-- Development Warning Banner -->
    <div class="bg-yellow-500 text-black px-4 py-2 text-center font-medium">
      🚧 Development Test Page - Not for Production Use
    </div>
    
    <!-- Test Info Panel -->
    <div class="bg-gray-100 border-b px-4 py-3">
      <h1 class="text-lg font-semibold mb-2">Map Filtering Test Page</h1>
      <div class="text-sm text-gray-600 space-y-1">
        <p><strong>Total Mock Artworks:</strong> {{ mockArtworks.length.toLocaleString() }}</p>
        <p><strong>Distribution:</strong> 250 Normal, 250 Visited, 250 Starred, 250 Unknown</p>
        <p><strong>Purpose:</strong> Testing map filtering functionality with realistic data volume</p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p class="text-gray-600">Generating mock data...</p>
      </div>
    </div>

    <!-- Map Component -->
    <div v-else class="flex-1 relative">
      <MapComponent
        :artworks="mockArtworks"
        :center="{ latitude: VANCOUVER_CENTER.lat, longitude: VANCOUVER_CENTER.lng }"
        :zoom="12"
        :show-user-location="true"
        @artwork-click="handleArtworkClick"
        @preview-artwork="handlePreviewArtwork"  
        @dismiss-preview="handleDismissPreview"
        @map-move="handleMapMove"
        @location-found="handleLocationFound"
      />
    </div>

    <!-- Debug Info (Development Only) -->
    <div class="bg-gray-50 border-t px-4 py-2 text-xs text-gray-500">
      <strong>Debug:</strong> Mock data generated locally • No API calls • Vancouver coordinates • 
      <span class="font-mono">{{ mockArtworks.length }}</span> total markers
    </div>
  </div>
</template>

<style scoped>
.test-map-view {
  /* Ensure full height usage */
  min-height: 100vh;
}
</style>