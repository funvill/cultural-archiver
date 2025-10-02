<<<<<<< HEAD
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
=======
﻿<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
>>>>>>> 982fdc3 (Better filter banner)
import { useRouter, useRoute } from 'vue-router';
import MapComponent from '../components/MapComponent.vue';
import ArtworkCard from '../components/ArtworkCard.vue';
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
// Keep a normalized telemetry snapshot so modal always receives a predictable object
const cacheTelemetryRef = ref<{ userListsHit: number; userListsMiss: number; listDetailsHit: number; listDetailsMiss: number } | null>(null);

// Telemetry polling for modal display
let telemetryPollHandle: ReturnType<typeof setInterval> | null = null;
function startTelemetryPolling() {
  stopTelemetryPolling();
  // Poll immediately and then regularly while modal is open
  try {
    if (mapComponentRef.value && typeof (mapComponentRef.value as any).getCacheTelemetry === 'function') {
      // Prefer exposed getter
      const t = (mapComponentRef.value as any).getCacheTelemetry();
      cacheTelemetryRef.value = {
        userListsHit: t?.userListsHit || 0,
        userListsMiss: t?.userListsMiss || 0,
        listDetailsHit: t?.listDetailsHit || 0,
        listDetailsMiss: t?.listDetailsMiss || 0,
      };
    } else {
      // Fallback: read persisted telemetry from localStorage if present
      try {
        const raw = localStorage.getItem('map:cacheTelemetry');
        if (raw) {
          const parsed = JSON.parse(raw);
          cacheTelemetryRef.value = {
            userListsHit: parsed?.userListsHit || 0,
            userListsMiss: parsed?.userListsMiss || 0,
            listDetailsHit: parsed?.listDetailsHit || 0,
            listDetailsMiss: parsed?.listDetailsMiss || 0,
          };
        }
      } catch (e) {
        /* ignore */
      }
    }
  } catch (e) {
    /* ignore */
  }
  telemetryPollHandle = setInterval(() => {
    try {
      if (mapComponentRef.value && typeof (mapComponentRef.value as any).getCacheTelemetry === 'function') {
        const t = (mapComponentRef.value as any).getCacheTelemetry();
        cacheTelemetryRef.value = {
          userListsHit: t?.userListsHit || 0,
          userListsMiss: t?.userListsMiss || 0,
          listDetailsHit: t?.listDetailsHit || 0,
          listDetailsMiss: t?.listDetailsMiss || 0,
        };
      } else {
        try {
          const raw = localStorage.getItem('map:cacheTelemetry');
          if (raw) {
            const parsed = JSON.parse(raw);
            cacheTelemetryRef.value = {
              userListsHit: parsed?.userListsHit || 0,
              userListsMiss: parsed?.userListsMiss || 0,
              listDetailsHit: parsed?.listDetailsHit || 0,
              listDetailsMiss: parsed?.listDetailsMiss || 0,
            };
          }
        } catch (e) {
          /* ignore */
        }
      }
    } catch (e) {
      /* ignore */
    }
  }, 2000);
}

function stopTelemetryPolling() {
  if (telemetryPollHandle) {
    clearInterval(telemetryPollHandle as any);
    telemetryPollHandle = null;
  }
}

// BroadcastChannel for cross-tab telemetry sync
let bc: BroadcastChannel | null = null;
onMounted(() => {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('map-cache');
      bc.onmessage = (ev: MessageEvent) => {
        try {
          const msg = ev.data || {};
          if (msg && msg.type === 'telemetry' && msg.payload) {
            cacheTelemetryRef.value = {
              userListsHit: msg.payload.userListsHit || 0,
              userListsMiss: msg.payload.userListsMiss || 0,
              listDetailsHit: msg.payload.listDetailsHit || 0,
              listDetailsMiss: msg.payload.listDetailsMiss || 0,
            };
          } else if (msg && msg.type === 'clearCaches') {
            cacheTelemetryRef.value = { userListsHit: 0, userListsMiss: 0, listDetailsHit: 0, listDetailsMiss: 0 };
          }
        } catch (e) {
          /* ignore */
        }
      };
    }
  } catch (e) {
    /* ignore */
  }
});

onUnmounted(() => {
  try { if (bc) { bc.close(); bc = null; } } catch (e) {}
});

// Ref for MapComponent so we can call exposed methods
const mapComponentRef = ref<InstanceType<typeof MapComponent> | null>(null);

// Displayed artworks with reactive filtering
const displayedArtworks = ref<ArtworkPin[]>([]);

// Computed properties
const mapCenter = computed(() => artworksStore.mapCenter);
const mapZoom = computed(() => artworksStore.mapZoom);
const hasActiveMapFilters = computed(() => mapFilters.hasActiveFilters.value);
const artworks = computed(() => {
  console.log('[ARTWORKS COMPUTED] Recomputing artworks:', {
    listFilterActive: listFilterActive.value,
    listArtworksLength: listArtworks.value.length,
    displayedArtworksLength: displayedArtworks.value.length,
    storeArtworksLength: artworksStore.artworks.length,
    hasMapFilters: mapFilters.hasActiveFilters.value,
    refreshTrigger: mapFilters.refreshTrigger.value // Force reactivity
  });
  
  // Use filtered list artworks if legacy list filtering is active
  if (listFilterActive.value && listArtworks.value.length > 0) {
    console.log('[MARKER DEBUG] MapView using list-filtered artworks:', {
      listArtworksLength: listArtworks.value.length,
      listId: currentListId.value,
      timestamp: new Date().toISOString(),
    });
    return listArtworks.value;
  }

  // Use the displayedArtworks ref that gets updated by the watchers
  console.log('[ARTWORKS COMPUTED] Using displayedArtworks:', {
    displayedCount: displayedArtworks.value.length,
    hasActiveFilters: mapFilters.hasActiveFilters.value,
    timestamp: new Date().toISOString(),
  });
  return displayedArtworks.value;
});

// Update displayed artworks when store or filters change
const updateDisplayedArtworks = async () => {
  const storeArtworks = artworksStore.artworks;
  
  console.log('[MAP FILTERS] updateDisplayedArtworks called:', {
    storeArtworksLength: storeArtworks.length,
    hasActiveFilters: mapFilters.hasActiveFilters.value,
    currentDisplayedLength: displayedArtworks.value.length
  });
  
  // Apply map filters if any are active
  if (mapFilters.hasActiveFilters.value) {
    console.log('[MAP FILTERS] Applying filters to store artworks');
    const filtered = await mapFilters.applyFilters(storeArtworks);
    console.log('[MAP FILTERS] Filtered artworks:', {
      originalCount: storeArtworks.length,
      filteredCount: filtered.length
    });
    displayedArtworks.value = filtered;
  } else {
    console.log('[MAP FILTERS] No active filters, using all store artworks');
    displayedArtworks.value = storeArtworks;
  }
  
  // Ensure Vue reactivity system picks up the change
  await nextTick();
  console.log('[MAP FILTERS] Display artworks updated:', {
    finalCount: displayedArtworks.value.length,
    firstFew: displayedArtworks.value.slice(0, 3).map((a: ArtworkPin) => ({ id: a.id, title: a.title }))
  });
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

<<<<<<< HEAD
      const data = resp.data as { list?: any; items?: any[]; has_more?: boolean };
      if (!listMeta) listMeta = data.list;
      const items = data.items || [];
=======
      if (!listMeta) listMeta = resp.data.list;
      const items = (resp.data.items || []) as any[];
>>>>>>> 79cbe81 (data-collectors, linting)
      accumulated.push(...items);

      if (!data.has_more) break;
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
  // Close any existing artwork preview dialog when opening map options
  mapPreviewStore.clearPreview();
  showFiltersModal.value = true;
  // When opening filters, try to read telemetry from map component and attach to mapFilters for modal display
  try {
    if (mapComponentRef.value && typeof (mapComponentRef.value as any).getCacheTelemetry === 'function') {
      const t = (mapComponentRef.value as any).getCacheTelemetry();
      cacheTelemetryRef.value = t;
    }
  } catch (e) {
    /* ignore */
  }
  // Start live polling so metrics update while modal is open
  startTelemetryPolling();
};

const handleCloseFilters = () => {
  showFiltersModal.value = false;
  stopTelemetryPolling();
};

const handleFiltersChanged = async () => {
  console.log('[MAP FILTERS] Filters changed event received, updating displayed artworks');
  console.log('[MAP FILTERS] Current filter state:', {
    hasActiveFilters: mapFilters.hasActiveFilters.value,
    wantToSee: (mapFilters.filterState as any).value?.wantToSee,
    notSeenByMe: (mapFilters.filterState as any).value?.notSeenByMe,
    userListsCount: Array.isArray((mapFilters.filterState as any).value?.userLists) ? (mapFilters.filterState as any).value.userLists.length : 0
  });
  await updateDisplayedArtworks();
};

// Advanced Feature: Quick filter reset from banner
const handleQuickResetFilters = async () => {
  console.log('[MAP FILTERS] Quick reset triggered from banner');
  mapFilters.resetFilters();
  await updateDisplayedArtworks();
};

// Handle cluster setting change from filters modal
const handleClusterChanged = (enabled: boolean) => {
  console.log('[MAP FILTERS] Cluster setting changed:', enabled);
  // The MapComponent will automatically pick up the change from localStorage
  // No additional action needed here as the MapComponent watches localStorage
};

function handleResetCacheTelemetry() {
  try {
    if (mapComponentRef.value && typeof (mapComponentRef.value as any).resetCacheTelemetry === 'function') {
      (mapComponentRef.value as any).resetCacheTelemetry();
      // Update mapFilters display copy
      if (typeof (mapComponentRef.value as any).getCacheTelemetry === 'function') {
        (mapFilters as any).cacheTelemetry = (mapComponentRef.value as any).getCacheTelemetry();
      }
    }
  } catch (e) {
    /* ignore */
  }
}

// Handle telemetry update events from MapComponent
function handleTelemetryUpdate(t: any) {
  try {
    cacheTelemetryRef.value = {
      userListsHit: t?.userListsHit || 0,
      userListsMiss: t?.userListsMiss || 0,
      listDetailsHit: t?.listDetailsHit || 0,
      listDetailsMiss: t?.listDetailsMiss || 0,
    };
  } catch (e) {
    /* ignore */
  }
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

  // Initialize displayed artworks
  displayedArtworks.value = artworksStore.artworks;

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

// Watch for filter changes - including specific filter state changes
watch(
  [
    () => mapFilters.hasActiveFilters.value,
    () => mapFilters.filterState.value.wantToSee,
    () => mapFilters.filterState.value.notSeenByMe,
    () => mapFilters.filterState.value.userLists,
    () => mapFilters.refreshTrigger.value, // Force reactivity trigger
  ],
  async () => {
    console.log('[MAP FILTERS] Filter state changed, updating displayed artworks');
    await updateDisplayedArtworks();
  },
  { deep: true }
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
    <!-- Active Filters Banner --><!-- List Filter Indicator -->
    <div 
      v-if="mapFilters.hasActiveFilters.value && !listFilterActive"
      class="absolute top-4 left-4 right-20 z-40 bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-sm"
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
      class="absolute left-4 right-4 z-40 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm"
      :class="{ 'top-4': !hasActiveMapFilters, 'top-20': hasActiveMapFilters }"
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

    <!-- Map Controls Stack - Right Side -->
    <div class="absolute top-4 right-4 z-30 flex flex-col space-y-2">
      <!-- Map Filters Button - Top Position -->
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
      ref="mapComponentRef"
      @artwork-click="handleArtworkClick"
      @preview-artwork="handlePreviewArtwork"
      @dismiss-preview="handleDismissPreview"
      @map-move="handleMapMove"
      @location-found="handleLocationFound"
  @telemetry-update="handleTelemetryUpdate"
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
      @cluster-changed="handleClusterChanged"
      @clearListCaches="() => mapComponentRef && mapComponentRef.clearListCaches && mapComponentRef.clearListCaches()"
    @resetCacheTelemetry="handleResetCacheTelemetry"
  :cache-telemetry="cacheTelemetryRef ?? { userListsHit: 0, userListsMiss: 0, listDetailsHit: 0, listDetailsMiss: 0 }"
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

