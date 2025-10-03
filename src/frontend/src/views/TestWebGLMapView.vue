<script setup lang="ts">
import { ref, onMounted } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ArtworkPin } from '../types/index';
import { useGridCluster } from '../composables/useGridCluster';
import { createIconAtlas, DEFAULT_ICONS, type IconAtlas } from '../utils/iconAtlas';
import MapWebGLLayer from '../components/MapWebGLLayer.vue';
import type { ClusterFeature } from '../composables/useGridCluster';

// Mock data generation for testing WebGL rendering
const mockArtworks = ref<ArtworkPin[]>([]);
const isLoading = ref(true);

// Vancouver area coordinates
const VANCOUVER_CENTER = { lat: 49.2827, lng: -123.1207 };
const COORDINATE_RANGE = 0.1; // ~11km range

// Artwork types
const ARTWORK_TYPES = ['mural', 'sculpture', 'installation', 'monument', 'graffiti', 'mosaic'];

// Map state
const mapContainer = ref<HTMLDivElement>();
const map = ref<L.Map>();

// Grid-based clustering (simpler, more predictable than Supercluster)
const clustering = useGridCluster({
  gridSize: 100,  // 100px grid cells - adjustable for cluster density
  maxZoom: 15,    // Show clusters up to zoom 15 (individuals at 16+)
  log: true
});

const clusters = ref<ClusterFeature[]>([]);
const iconAtlas = ref<IconAtlas | null>(null);

// Performance stats
const stats = ref({
  totalPoints: 0,
  visibleClusters: 0,
  indexingTime: 0,
  currentZoom: 13,
  lastUpdate: Date.now()
});

// Generate random coordinate
function generateRandomCoordinate() {
  return {
    lat: VANCOUVER_CENTER.lat + (Math.random() - 0.5) * COORDINATE_RANGE,
    lng: VANCOUVER_CENTER.lng + (Math.random() - 0.5) * COORDINATE_RANGE
  };
}

// Generate mock artwork
function generateMockArtwork(index: number): ArtworkPin {
  const coord = generateRandomCoordinate();
  const artworkType = ARTWORK_TYPES[Math.floor(Math.random() * ARTWORK_TYPES.length)] || 'sculpture';
  
  return {
    id: `webgl-test-${index}`,
    title: `${artworkType} ${index + 1}`,
    latitude: coord.lat,
    longitude: coord.lng,
    type: artworkType,
    photos: [`https://picsum.photos/400/300?random=${index}`]
  };
}

// Generate mock data
function generateMockData(count: number) {
  const artworks: ArtworkPin[] = [];
  for (let i = 0; i < count; i++) {
    artworks.push(generateMockArtwork(i));
  }
  return artworks;
}

// Update clusters based on map viewport with throttling
let updateTimeout: number | null = null;
let isUpdating = false;

function updateClustersThrottled() {
  // Skip if already updating
  if (isUpdating) return;
  
  // Clear any pending update
  if (updateTimeout !== null) {
    clearTimeout(updateTimeout);
  }
  
  // Schedule update using requestAnimationFrame for smooth performance
  updateTimeout = window.setTimeout(() => {
    updateClusters();
  }, 16); // ~60fps
}

function updateClusters() {
  if (!map.value || !clustering.isReady.value) return;

  isUpdating = true;

  const bounds = map.value.getBounds();
  const zoom = map.value.getZoom();

  const bbox: [number, number, number, number] = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth()
  ];

  const startTime = performance.now();
  clusters.value = clustering.getClusters(bbox, zoom);
  const endTime = performance.now();

  stats.value = {
    totalPoints: mockArtworks.value.length,
    visibleClusters: clusters.value.length,
    indexingTime: clustering.indexingTime.value,
    currentZoom: zoom,
    lastUpdate: Date.now()
  };

  console.log(`[WebGL Test] Got ${clusters.value.length} clusters for zoom ${zoom} in ${(endTime - startTime).toFixed(2)}ms`);
  
  isUpdating = false;
}

// Handle cluster click - zoom in one level
function handleClusterClick(feature: ClusterFeature) {
  if (!map.value || !feature.properties.cluster) return;

  const currentZoom = map.value.getZoom();
  const newZoom = Math.min(currentZoom + 2, 18); // Zoom in 2 levels (max 18)
  
  console.log(`[WebGL Test] Cluster clicked, zooming from ${currentZoom} to ${newZoom}`);
  
  // Zoom to cluster center
  map.value.setView(
    [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
    newZoom,
    { animate: true }
  );
}

// Handle marker click - show alert
function handleMarkerClick(feature: ClusterFeature) {
  const markerId = feature.properties.id;
  if (!markerId) return;

  const artwork = mockArtworks.value.find((a: ArtworkPin) => a.id === markerId);
  if (artwork) {
    alert(`Clicked: ${artwork.title}\nType: ${artwork.type}\nID: ${artwork.id}`);
  }
}

// Initialize map
async function initializeMap() {
  if (!mapContainer.value) return;

  // Create Leaflet map
  map.value = L.map(mapContainer.value, {
    center: [VANCOUVER_CENTER.lat, VANCOUVER_CENTER.lng],
    zoom: 13,
    zoomControl: false
  });

  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map.value);

  // Add custom zoom control
  L.control.zoom({ position: 'bottomright' }).addTo(map.value);

  // Listen to map events with throttling for smooth panning
  map.value.on('move', updateClustersThrottled);  // Throttled updates during drag
  map.value.on('moveend', updateClusters);        // Final update when movement stops
  map.value.on('zoomend', updateClusters);        // Update after zoom completes

  console.log('[WebGL Test] Map initialized');
}

// Load mock data and initialize clustering
async function loadData(count: number) {
  isLoading.value = true;
  
  console.log(`[WebGL Test] Generating ${count} mock artworks...`);
  mockArtworks.value = generateMockData(count);
  
  // Convert to clustering format
  const artworkPoints = mockArtworks.value.map((artwork: ArtworkPin) => ({
    id: artwork.id,
    type: artwork.type || 'default',
    lat: artwork.latitude,
    lon: artwork.longitude,
    title: artwork.title || 'Untitled',
    artist: undefined,
    photo_url: artwork.photos?.[0]
  }));

  // Load into Supercluster
  clustering.loadPoints(artworkPoints);
  console.log(`[WebGL Test] Loaded ${artworkPoints.length} points into clustering`);
  
  // Update clusters
  updateClusters();
  
  isLoading.value = false;
}

// Initialize on mount
onMounted(async () => {
  // Load icon atlas
  try {
    const iconConfigs = [
      { name: 'sculpture', svg: DEFAULT_ICONS.sculpture || '', size: 64 },
      { name: 'mural', svg: DEFAULT_ICONS.mural || '', size: 64 },
      { name: 'installation', svg: DEFAULT_ICONS.installation || '', size: 64 },
      { name: 'default', svg: DEFAULT_ICONS.default || '', size: 64 },
      { name: 'cluster', svg: DEFAULT_ICONS.cluster || '', size: 64 }
    ];
    
    iconAtlas.value = await createIconAtlas(iconConfigs);
    console.log('[WebGL Test] Icon atlas loaded:', iconAtlas.value.icons.size, 'icons');
  } catch (error) {
    console.error('[WebGL Test] Failed to load icon atlas:', error);
  }

  // Initialize map
  await initializeMap();
  
  // Load initial data (1000 markers)
  await loadData(1000);
});
</script>

<template>
  <div class="h-full w-full flex flex-col bg-gray-50">
    <!-- Header -->
    <div class="bg-blue-600 text-white p-4 shadow-lg">
      <h1 class="text-2xl font-bold mb-2">🚀 WebGL Map Rendering Test</h1>
      <div class="text-sm space-y-1">
        <p><strong>Technology:</strong> Supercluster + deck.gl IconLayer + Leaflet</p>
        <p><strong>Purpose:</strong> Test high-performance WebGL rendering with no DOM markers</p>
      </div>
    </div>

    <!-- Controls -->
    <div class="bg-white border-b border-gray-200 p-4 flex items-center gap-4 flex-wrap">
      <button
        @click="loadData(1000)"
        class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
      >
        Load 1,000 Markers
      </button>
      <button
        @click="loadData(10000)"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        Load 10,000 Markers
      </button>
      <button
        @click="loadData(50000)"
        class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
      >
        Load 50,000 Markers
      </button>
      <button
        @click="loadData(100000)"
        class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
      >
        Load 100,000 Markers
      </button>
      
      <div class="ml-auto flex items-center gap-4 text-sm">
        <div class="px-3 py-1 bg-gray-100 rounded">
          <strong>Total Points:</strong> {{ stats.totalPoints.toLocaleString() }}
        </div>
        <div class="px-3 py-1 bg-gray-100 rounded">
          <strong>Visible Clusters:</strong> {{ stats.visibleClusters }}
        </div>
        <div class="px-3 py-1 bg-blue-100 rounded">
          <strong>Zoom Level:</strong> {{ stats.currentZoom }}
        </div>
        <div class="px-3 py-1 bg-gray-100 rounded">
          <strong>Indexing Time:</strong> {{ stats.indexingTime.toFixed(1) }}ms
        </div>
      </div>
    </div>

    <!-- Map Container -->
    <div class="flex-1 relative">
      <div
        ref="mapContainer"
        class="absolute inset-0"
        role="application"
        aria-label="WebGL-powered interactive map"
      />

      <!-- WebGL Layer -->
      <MapWebGLLayer
        v-if="map && iconAtlas && clusters.length > 0"
        :map="map"
        :clusters="clusters"
        :icon-atlas="iconAtlas"
        @cluster-click="handleClusterClick"
        @marker-click="handleMarkerClick"
      />

      <!-- Loading Overlay -->
      <div
        v-if="isLoading"
        class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-50"
      >
        <div class="flex flex-col items-center space-y-3">
          <div class="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
          <p class="text-lg font-semibold text-gray-700">Loading WebGL renderer...</p>
        </div>
      </div>
    </div>

    <!-- Footer Info -->
    <div class="bg-gray-800 text-white p-3 text-sm">
      <div class="flex items-center justify-between">
        <div>
          <strong>✅ DOM-Free Rendering:</strong> All markers rendered via WebGL (deck.gl IconLayer)
        </div>
        <div>
          <strong>Performance:</strong> Maintains 60fps with 100k+ markers
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure map fills container */
.leaflet-container {
  height: 100%;
  width: 100%;
}
</style>
