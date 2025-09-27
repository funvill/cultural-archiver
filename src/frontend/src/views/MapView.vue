<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import MapComponent from '../components/MapComponent.vue';
import ArtworkCard from '../components/ArtworkCard.vue';
import MapFiltersModal from '../components/MapFiltersModal.vue';
import { useArtworksStore } from '../stores/artworks';
import { useMapPreviewStore } from '../stores/mapPreview';
import { useMapFilters } from '../composables/useMapFilters';
import { apiService } from '../services/api';
import type { ArtworkPin, Coordinates, MapPreview, SearchResult } from '../types';
import { AdjustmentsHorizontalIcon } from '@heroicons/vue/24/outline';

const router = useRouter();
const route = useRoute();
const artworksStore = useArtworksStore();
const mapPreviewStore = useMapPreviewStore();
const mapFilters = useMapFilters();

// List filtering state (legacy support for URL params)
const currentListId = ref<string | null>(null);
const listArtworks = ref<ArtworkPin[]>([]);
const listInfo = ref<any>(null);
const listFilterActive = ref(false);

// Map filters modal state
const showFiltersModal = ref(false);

// Filtered artworks for display
const displayedArtworks = ref<ArtworkPin[]>([]);

// Computed properties
const mapCenter = computed(() => artworksStore.mapCenter);
const mapZoom = computed(() => artworksStore.mapZoom);
const artworks = computed(() => {
  // Use filtered list artworks if legacy list filtering is active
  if (listFilterActive.value && listArtworks.value.length > 0) {
    console.log('[MARKER DEBUG] MapView using list-filtered artworks:', {
      listArtworksLength: listArtworks.value.length,
      listId: currentListId.value,
      timestamp: new Date().toISOString(),
    });
    return listArtworks.value;
  }

  // Use displayedArtworks which may be filtered by map filters
  return displayedArtworks.value;
});

// Update displayed artworks when store or filters change
const updateDisplayedArtworks = async () => {
  const storeArtworks = artworksStore.artworks;
  
  // Apply map filters if any are active
  if (mapFilters.hasActiveFilters.value) {
    console.log('[MAP FILTERS] Applying filters to store artworks');
    displayedArtworks.value = await mapFilters.applyFilters(storeArtworks);
  } else {
    displayedArtworks.value = storeArtworks;
  }
};

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

// List filtering functions
async function loadListArtworks(listId: string) {
  try {
    listFilterActive.value = true;
    // Page through list items using per-page limit 100 (server enforces max 100)
    const pageSize = 100;
    let page = 1;
    let accumulated: any[] = [];
    let listMeta: any = null;

    while (true) {
      const resp = await apiService.getListDetails(listId, page, pageSize);
      if (!resp || !resp.success || !resp.data) {
        // Stop on failure
        console.error('Failed to load list page:', page, resp?.error);
        listFilterActive.value = false;
        listArtworks.value = [];
        listInfo.value = null;
        return;
      }

      if (!listMeta) listMeta = resp.data.list;
      const items = resp.data.items || [];
      accumulated.push(...items);

      if (!resp.data.has_more) break;
      page += 1;
    }

    listInfo.value = listMeta;
    // Convert accumulated items to ArtworkPin format
    listArtworks.value = accumulated.map((artwork: any) => ({
      id: artwork.id,
      latitude: artwork.lat,
      longitude: artwork.lon,
      type: artwork.type_name || 'other',
      title: artwork.title,
      artist_name: null,
      photos: artwork.photos,
      recent_photo: artwork.photos?.[0]?.url || null,
      photo_count: artwork.photos?.length || 0,
    }));

    console.log('[MAP DEBUG] Loaded list artworks:', {
      listId,
      listName: listInfo.value?.name,
      artworkCount: listArtworks.value.length,
    });
  } catch (error) {
    console.error('Error loading list artworks:', error);
    listFilterActive.value = false;
    listArtworks.value = [];
    listInfo.value = null;
  }
}

function clearListFilter() {
  currentListId.value = null;
  listFilterActive.value = false;
  listArtworks.value = [];
  listInfo.value = null;
}

// Map filters handlers
const handleOpenFilters = () => {
  showFiltersModal.value = true;
};

const handleCloseFilters = () => {
  showFiltersModal.value = false;
};

const handleFiltersChanged = async () => {
  console.log('[MAP FILTERS] Filters changed, updating displayed artworks');
  await updateDisplayedArtworks();
};

// Advanced Feature: Quick filter reset from banner
const handleQuickResetFilters = async () => {
  console.log('[MAP FILTERS] Quick reset triggered from banner');
  mapFilters.resetFilters();
  await updateDisplayedArtworks();
};

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

  // Initialize displayed artworks
  updateDisplayedArtworks();
});

// Watch for artwork store changes to update display
watch(
  () => artworksStore.artworks,
  async () => {
    await updateDisplayedArtworks();
  },
  { deep: true }
);

// Watch for filter changes
watch(
  () => mapFilters.hasActiveFilters.value,
  async () => {
    await updateDisplayedArtworks();
  }
);

// Watch for URL parameter changes to enable/disable list filtering
watch(
  () => route.query.list,
  async (newListId: unknown) => {
    if (newListId && typeof newListId === 'string') {
      currentListId.value = newListId;
      await loadListArtworks(newListId);
    } else {
      clearListFilter();
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="map-view h-full w-full relative">
    <!-- Map Filters Banner with Enhanced Features -->
    <div 
      v-if="mapFilters.hasActiveFilters.value && !listFilterActive"
      class="absolute top-4 left-4 right-16 z-40 bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-sm"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <AdjustmentsHorizontalIcon class="w-5 h-5 text-amber-600 mr-2 flex-shrink-0" />
          <span class="text-sm font-medium text-amber-900">
            {{ mapFilters.activeFilterDescription.value }}
          </span>
        </div>
        <!-- Advanced Feature: Reset Button in Banner -->
        <button
          @click="handleQuickResetFilters"
          class="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200 transition-colors"
          title="Reset all filters"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Legacy List Filter Indicator -->
    <div 
      v-if="listFilterActive && listInfo"
      class="absolute top-4 left-4 right-16 z-40 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v0a2 2 0 01-2 2H10a2 2 0 01-2-2v0z" />
          </svg>
          <span class="text-sm font-medium text-blue-900">
            Showing list: {{ listInfo.name }} ({{ listArtworks.length }} artworks)
          </span>
        </div>
        <button 
          @click="clearListFilter(); $router.push('/')"
          class="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Show All
        </button>
      </div>
    </div>

    <!-- Map Filters Button -->
    <div class="absolute top-4 right-4 z-30">
      <button
        @click="handleOpenFilters"
        class="bg-white shadow-md rounded-full p-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        title="Map filters"
        aria-label="Open map filters"
      >
        <AdjustmentsHorizontalIcon 
          class="w-5 h-5"
          :class="mapFilters.hasActiveFilters.value ? 'text-amber-600' : 'text-gray-700'"
        />
        <!-- Active indicator -->
        <div 
          v-if="mapFilters.hasActiveFilters.value" 
          class="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white"
        ></div>
      </button>
    </div>

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

    <!-- Map Filters Modal -->
    <MapFiltersModal
      :is-open="showFiltersModal"
      @update:is-open="handleCloseFilters"
      @filters-changed="handleFiltersChanged"
    />
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
