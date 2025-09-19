<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PlusIcon } from '@heroicons/vue/24/outline';
import SearchInput from '../components/SearchInput.vue';
import ArtworkCard from '../components/ArtworkCard.vue';
import ArtworkTypeFilter from '../components/ArtworkTypeFilter.vue';
import SkeletonCard from '../components/SkeletonCard.vue';
import { useSearchStore } from '../stores/search';
import { useFastUploadSessionStore } from '../stores/fastUploadSession';
import { useInfiniteScroll } from '../composables/useInfiniteScroll';
import { useArtworkTypeFilters } from '../composables/useArtworkTypeFilters';
import type { SearchResult, Coordinates } from '../types/index';



const route = useRoute();
const router = useRouter();
const searchStore = useSearchStore();

// State
const searchInputRef = ref<InstanceType<typeof SearchInput>>();
const searchResultsRef = ref<HTMLElement>();
const showEmptyState = ref(false);
const showSearchTips = ref(true);
// Removed photo search mode

// Fast upload session data
// Fast upload session (prefer in-memory Pinia store which contains previews)
const fastUploadSession = ref<{
  photos: Array<{id: string; name: string; preview?: string}>;
  location: Coordinates | null;
  detectedSources: unknown;
} | null>(null);
const fastUploadStore = useFastUploadSessionStore();
const isFromFastUpload = computed(() => !!fastUploadSession.value && route.query.source === 'fast-upload');
// Track whether we've attempted auto redirect to new artwork to avoid loops
const autoRedirectedToNew = ref(false);

// Computed
const currentQuery = computed(() => (route.params.query as string) || '');
const isSearchActive = computed(() => currentQuery.value.length > 0);
const hasResults = computed(() => searchStore.hasResults);
const isLoading = computed(() => searchStore.isLoading);
const error = computed(() => searchStore.error);
const suggestions = computed(() => searchStore.suggestions);
const recentQueries = computed(() => searchStore.recentQueries);

// Artwork type filtering
const { filterArtworks } = useArtworkTypeFilters();

// Filter search results by artwork type
const filteredResults = computed(() => {
  if (!hasResults.value) {
    return [];
  }
  return filterArtworks(searchStore.results);
});

const filteredTotal = computed(() => filteredResults.value.length);

// Enhanced search tips with structured tag examples
const searchTips = [
  'Try "tag:artwork_type:statue" to find specific artwork types',
  'Search "tag:material:bronze" to find artworks by material',
  'Use "tag:artist_name:banksy" to find works by specific artists',
  'Search "tag:access:yes" to find publicly accessible artworks',
  'Try "mural tag:year:2020" to combine text and tag searches',
  'Use "tag:condition:excellent" to find well-preserved pieces',
  'Search "sculpture downtown" for location-based queries',
  'Try "tag:height" to find artworks with height information',
];

// Infinite scroll setup
const { targetRef: loadMoreRef } = useInfiniteScroll(() => searchStore.loadMore(), {
  enabled: true,
  threshold: 0.1,
});

// Methods
function handleSearch(query: string): void {
  if (query.trim().length === 0) {
    router.push('/search');
    return;
  }

  // Update URL with search query
  const normalizedQuery = query.trim();
  if (normalizedQuery !== currentQuery.value) {
    router.push(`/search/${encodeURIComponent(normalizedQuery)}`);
  }
}

function handleSearchInput(query: string): void {
  searchStore.setQuery(query);
  performSearch(query); // Update results live as user types

  // Get suggestions for non-empty queries
  if (query.trim().length > 0) {
    searchStore.fetchSuggestions(query.trim());
    showSearchTips.value = false;
  } else {
    showSearchTips.value = true;
  }
}

function handleSuggestionSelect(suggestion: string): void {
  handleSearch(suggestion);
}

function handleArtworkClick(artwork: SearchResult): void {
  if (isFromFastUpload.value) {
    // If from fast upload, this means adding a logbook entry to existing artwork
    router.push(`/artwork/${artwork.id}?action=add-logbook&from=fast-upload`);
  } else {
    // Normal artwork detail view
    router.push(`/artwork/${artwork.id}`);
  }
}

function handleAddReport(artwork: SearchResult): void {
  // Navigate directly to logbook submission page
  router.push(`/logbook/${artwork.id}`);
}

function handleAddNewArtwork(): void {
  // Navigate to simplified artwork details form
  router.push('/artwork/new?from=fast-upload');
}

function handleRecentQueryClick(query: string): void {
  handleSearch(query);
}

function getTipSearchTerm(tip: string): string {
  const match = tip.match(/"([^"]+)"/);
  return match ? match[1] || tip : tip;
}

function clearSearch(): void {
  searchStore.clearSearch();
  router.push('/search');
  showSearchTips.value = true;
  nextTick(() => {
    searchInputRef.value?.focus();
  });
}

function performSearch(query: string): void {
  if (query.trim().length === 0) {
    searchStore.clearSearch();
    showEmptyState.value = false;
    return;
  }

  showSearchTips.value = false;
  showEmptyState.value = false;
  searchStore.performSearch(query.trim());
}

// Watch for route changes and mode parameter
watch(
  () => route.params.query,
  (newQuery: unknown) => {
    const query = (newQuery as string) || '';

    if (query !== searchStore.query) {
      searchStore.setQuery(query);
      performSearch(query);
    }
  },
  { immediate: true }
);

// Watch for route query parameter changes (lat/lng coordinates from new image uploads)
watch(
  () => ({ 
    lat: route.query.lat, 
    lng: route.query.lng, 
    source: route.query.source,
    storePhotos: fastUploadStore.photos,
    storeLocation: fastUploadStore.location,
    storeDetectedSources: fastUploadStore.detectedSources
  }),
  (newQuery: { lat: unknown; lng: unknown; source: unknown; storePhotos: any; storeLocation: any; storeDetectedSources: any }, 
   oldQuery?: { lat: unknown; lng: unknown; source: unknown; storePhotos: any; storeLocation: any; storeDetectedSources: any }) => {
    // Only handle fast-upload source with coordinates
    if (newQuery.source !== 'fast-upload') return;
    if (!newQuery.lat || !newQuery.lng) return;
    
    // Check if coordinates actually changed or if store data changed
    const coordsChanged = newQuery.lat !== oldQuery?.lat || newQuery.lng !== oldQuery?.lng;
    const storePhotosChanged = newQuery.storePhotos !== oldQuery?.storePhotos;
    const storeLocationChanged = newQuery.storeLocation !== oldQuery?.storeLocation;
    
    if (!coordsChanged && !storePhotosChanged && !storeLocationChanged) return;

    // Parse coordinates
    const lat = parseFloat(newQuery.lat as string);
    const lng = parseFloat(newQuery.lng as string);
    
    if (isNaN(lat) || isNaN(lng)) return;

    // Update fast upload session with new coordinates and latest store data
    const newLocation = { latitude: lat, longitude: lng };
    
    // Always update session with latest store data
    fastUploadSession.value = {
      photos: fastUploadStore.photos.map((p: {id: string, name: string, preview?: string}) => {
        const base = { id: p.id, name: p.name } as { id: string; name: string; preview?: string };
        if (p.preview) base.preview = p.preview;
        return base;
      }),
      location: newLocation,
      detectedSources: fastUploadStore.detectedSources || newQuery.storeDetectedSources,
    };
    
    // Trigger new location search if coordinates changed
    if (coordsChanged) {
      performLocationSearch(lat, lng);
    }
  },
  { immediate: true, deep: true }
);

// Removed photo search mode watcher

// Watch for empty state after search completes
watch([isLoading, hasResults, isSearchActive], ([loading, results, active]: [boolean, boolean, boolean]) => {
  if (!loading && active && !results) {
    showEmptyState.value = true;
  } else {
    showEmptyState.value = false;
  }
});

// Lifecycle
onMounted(() => {
  searchStore.initialize();

  // Check for fast upload session data
  const sessionData = sessionStorage.getItem('fast-upload-session');
  if (sessionData && route.query.source === 'fast-upload') {
    try {
      const parsed = JSON.parse(sessionData);
      // Merge with Pinia store to add previews (sessionStorage intentionally omits them for size)
      const previewLookup: Record<string, string | undefined> = {};
  fastUploadStore.photos.forEach((p: {id: string, preview?: string}) => { if (p.id) previewLookup[p.id] = p.preview; });
      fastUploadSession.value = {
        photos: (parsed.photos || []).map((p: any) => ({
          id: p.id,
            name: p.name,
            preview: previewLookup[p.id],
        })),
        location: parsed.location || fastUploadStore.location || null,
        detectedSources: parsed.detectedSources || fastUploadStore.detectedSources || null,
      };
      
      // If we have location data, perform automatic search
      if (fastUploadSession.value?.location) {
        const { latitude, longitude } = fastUploadSession.value.location;
        // Perform location-based search for nearby artworks
        performLocationSearch(latitude, longitude);
      }
    } catch (error) {
      console.error('Failed to parse fast upload session data:', error);
      sessionStorage.removeItem('fast-upload-session');
    }
  } else if (route.query.source === 'fast-upload' && fastUploadStore.hasPhotos) {
    // Fallback if sessionStorage missing but store still populated
    fastUploadSession.value = {
      photos: fastUploadStore.photos.map((p: {id: string, name: string, preview?: string}) => {
        const base = { id: p.id, name: p.name } as { id: string; name: string; preview?: string };
        if (p.preview) base.preview = p.preview;
        return base;
      }),
      location: fastUploadStore.location,
      detectedSources: fastUploadStore.detectedSources,
    };
  }

  // Focus search input on mount for normal search
  if (!isFromFastUpload.value) {
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  }
});

// Watch for zero nearby results after a fast-upload location search and redirect directly to new artwork form
watch([
  isFromFastUpload,
  () => fastUploadSession.value?.location,
  hasResults,
  isLoading
], ([fromFast, loc, results, loading]: [boolean, Coordinates | null | undefined, boolean, boolean]) => {
  if (!fromFast) return;
  if (!loc) return; // need a location
  if (loading) return; // wait until search completes
  if (results) return; // only when zero results
  if (autoRedirectedToNew.value) return; // prevent repeat
  // We consider search attempted when searchStore.hasSearched or a location search set query
  if (searchStore.query.startsWith('Near (') && searchStore.hasSearched) {
    autoRedirectedToNew.value = true;
    router.push('/artwork/new?from=fast-upload&reason=auto-no-nearby');
  }
});

function performLocationSearch(latitude: number, longitude: number): void {
  // Use the search store to perform a location-based search
  // This would need to be implemented in the search store
  searchStore.performLocationSearch({ latitude, longitude });
}

// Note: Legacy multi-add refresh logic (event + watcher) removed as fast-add now overwrites
// prior selections when the user clicks Add again. This simplifies the UX: each Add starts
// a new flow rather than appending and re-searching. If future requirements reintroduce
// multi-select accumulation across separate Add clicks, restore logic from git history.

function getArtworkTitle(artwork: SearchResult): string {
  // Prefer explicit title field when available
  if (typeof artwork.title === 'string' && artwork.title.trim().length > 0) {
    return artwork.title.trim();
  }
  const tags = (artwork.tags as Record<string, unknown> | null) || null;
  if (tags && typeof tags === 'object') {
    const maybeTitle = (tags as any).title;
    const maybeName = (tags as any).name;
    const title = [maybeTitle, maybeName].find(
      (v) => typeof v === 'string' && v.trim().length > 0
    ) as string | undefined;
    if (title) return title;
  }
  // Fallback to a humanized type name rather than generic "Untitled"
  return artwork.type_name
    ? artwork.type_name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    : 'Untitled';
}

// Register global event listener (done after initial mount logic has parsed first session)
// (Removed legacy global 'fast-upload-session-updated' listener – overwrite model does not append.)

// Note: We intentionally do not fall back to the uploaded preview for
// artwork cards to avoid misleading thumbnails for artworks with zero photos.

function getArtworkImage(artwork: SearchResult): string | null {
  // Only ever show the artwork's own recent photo for the card.
  // Do NOT fall back to the user's uploaded preview, as this causes
  // incorrect thumbnails for unrelated artworks with zero photos.
  return artwork.recent_photo && artwork.recent_photo.trim().length > 0
    ? artwork.recent_photo
    : null;
}

// Helper functions for location method display
function getLocationMethodText(detectedSources: any): string {
  if (!detectedSources) return 'Unknown';
  
  // Check which method was successfully used (in order of preference/accuracy)
  if (detectedSources.exif?.detected && detectedSources.exif?.coordinates) {
    return 'Photo EXIF data';
  }
  if (detectedSources.browser?.detected && detectedSources.browser?.coordinates) {
    return 'Device GPS';
  }
  if (detectedSources.ip?.detected && detectedSources.ip?.coordinates) {
    return 'IP location';
  }
  
  return 'Manual entry';
}

function getLocationMethodStyle(detectedSources: any): string {
  const method = getLocationMethodText(detectedSources);
  
  switch (method) {
    case 'Photo EXIF data':
      return 'bg-green-100 text-green-800 border border-green-200';
    case 'Device GPS':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'IP location':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    case 'Manual entry':
      return 'bg-purple-100 text-purple-800 border border-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-200';
  }
}

function getLocationMethodDescription(detectedSources: any): string {
  const method = getLocationMethodText(detectedSources);
  
  switch (method) {
    case 'Photo EXIF data':
      return 'Location extracted from photo metadata - most accurate';
    case 'Device GPS':
      return 'Location from device GPS sensor - high accuracy';
    case 'IP location':
      return 'Location approximated from IP address - lower accuracy';
    case 'Manual entry':
      return 'Location entered manually by user';
    default:
      return 'Location detection method unknown';
  }
}

onUnmounted(() => {
  // Clear any pending debounced searches
  searchStore.clearSearch();
});
</script>

<template>
  <div class="search-view min-h-screen bg-gray-50">
    <!-- Header with Search Mode Tabs -->
    <div class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <!-- Search Mode Selector -->
        <div class="flex justify-center mb-4">
          <!-- Removed search mode selector (photo search) -->
        </div>

        <!-- Text Search Input -->
  <div class="flex items-center space-x-4">
          <!-- Back Button for Mobile -->
          <button
            class="lg:hidden p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
            @click="$router.back()"
            aria-label="Go back"
          >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <!-- Search Input -->
          <div class="flex-1">
            <SearchInput
              ref="searchInputRef"
              :model-value="searchStore.query"
              :suggestions="suggestions"
              :loading="isLoading"
              placeholder="Search artworks... try: mural, tag:street-art"
              @update:model-value="handleSearchInput"
              @search="handleSearch"
              @suggestion-select="handleSuggestionSelect"
              @clear="clearSearch"
            />
          </div>
        </div>

        <!-- Photo search indicator removed -->
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Photo search removed -->

      <!-- Fast Upload Results (from photo upload workflow) -->
  <div v-if="isFromFastUpload && fastUploadSession">
        <div class="mb-6">
          <!-- Uploaded Photos Summary -->
          <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">
              Your Photos ({{ fastUploadSession.photos.length }})
            </h2>
            <div class="flex space-x-4 overflow-x-auto">
              <div
                v-for="photo in fastUploadSession.photos"
                :key="photo.id"
                class="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center text-[10px] text-gray-500"
              >
                <img
                  v-if="photo.preview"
                  :src="photo.preview"
                  :alt="photo.name"
                  class="w-20 h-20 object-cover rounded-lg"
                />
                <span v-else>No preview</span>
              </div>
            </div>
            <div v-if="fastUploadSession.location" class="mt-4 text-sm text-gray-600">
              <div class="flex items-center space-x-2">
                <strong>Location detected:</strong> 
                <span>{{ fastUploadSession.location.latitude.toFixed(6) }}, {{ fastUploadSession.location.longitude.toFixed(6) }}</span>
              </div>
              <div v-if="fastUploadSession.detectedSources" class="mt-2 space-y-1">
                <div class="flex items-center space-x-2">
                  <span class="text-xs font-medium">Method:</span>
                  <span class="text-xs px-2 py-1 rounded-full" :class="getLocationMethodStyle(fastUploadSession.detectedSources)">
                    {{ getLocationMethodText(fastUploadSession.detectedSources) }}
                  </span>
                </div>
                <div class="text-xs text-gray-500">
                  {{ getLocationMethodDescription(fastUploadSession.detectedSources) }}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Instructions -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-blue-900">What would you like to do?</h3>
                <div class="mt-2 text-sm text-blue-700">
                  <p><strong>Add to existing artwork:</strong> Click on any artwork card below to add your photos as a new logbook entry</p>
                  <p><strong>Create new artwork:</strong> Click "Add New Artwork" if you don't see a match</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Search Results with Add New Artwork Card -->
        <div class="space-y-6">
          <!-- Add New Artwork Card (always first) -->
          <div class="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-dashed border-green-300 rounded-lg p-6 hover:border-green-400 hover:bg-gradient-to-r hover:from-green-100 hover:to-blue-100 transition-all cursor-pointer"
               @click="handleAddNewArtwork">
            <div class="flex items-center justify-center space-x-4">
              <div class="flex-shrink-0">
                <div class="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <PlusIcon class="w-6 h-6 text-white" />
                </div>
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900">Add New Artwork</h3>
                <p class="text-gray-600">Don't see a match? Create a new artwork entry with your photos</p>
              </div>
              <div class="flex-shrink-0">
                <svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
          
          <!-- Nearby Artworks Results -->
          <div v-if="hasResults">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              Nearby Artworks ({{ searchStore.totalResults }} found)
            </h3>
            <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div
                v-for="artwork in searchStore.results"
                :key="artwork.id"
                class="bg-white rounded-lg shadow hover:shadow-md transition cursor-pointer border border-gray-200 p-4 flex flex-col"
                @click="handleArtworkClick(artwork)"
              >
                <div class="aspect-video w-full mb-3 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                  <img
                    v-if="getArtworkImage(artwork)"
                    :src="getArtworkImage(artwork) || ''"
                    :alt="getArtworkTitle(artwork)"
                    class="object-cover w-full h-full"
                  />
                  <div v-else class="text-gray-400 text-sm">No photo</div>
                </div>
                <h4 class="font-semibold text-gray-900 text-sm line-clamp-1 mb-0.5">
                  {{ getArtworkTitle(artwork) }}
                </h4>
                <p v-if="artwork.artist_name" class="text-xs text-gray-600 mb-2 line-clamp-1">
                  {{ artwork.artist_name }}
                </p>
                <div class="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                  <div v-if="artwork.distance_km != null">
                    <span class="font-medium text-gray-700">Distance:</span>
                    {{ artwork.distance_km.toFixed(2) }} km
                  </div>
                  <div v-if="artwork.similarity_score != null">
                    <span class="font-medium text-gray-700">Similarity:</span>
                    {{ (artwork.similarity_score * 100).toFixed(0) }}%
                  </div>
                  <div>
                    <span class="font-medium text-gray-700">Photos:</span>
                    {{ artwork.photo_count }}
                  </div>
                  <div>
                    <span class="font-medium text-gray-700">Type:</span>
                    {{ artwork.type_name }}
                  </div>
                </div>
                <div class="mt-auto flex justify-end">
                  <span class="inline-flex items-center text-blue-600 text-xs font-medium">Select ➜</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Loading State -->
          <div v-else-if="isLoading" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard v-for="n in 6" :key="n" />
          </div>
          
          <!-- No Results -->
          <div v-else-if="searchStore.hasSearched" class="text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 class="mt-4 text-lg font-medium text-gray-900">No artworks found nearby</h3>
            <p class="mt-2 text-gray-600">
              No artworks were found near the detected location. You can create a new artwork entry above.
            </p>
          </div>
        </div>
      </div>

      <!-- Text Search Results -->
      <div v-else>
        <!-- Search Tips (shown when no active search) -->
        <div v-if="showSearchTips && !isSearchActive" class="text-center py-12">
        <div class="mx-auto max-w-md">
          <svg
            class="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          <h2 class="text-lg font-medium text-gray-900 mb-2">Search for Artworks</h2>

          <p class="text-gray-600 mb-6">
            Discover public art, murals, sculptures, and monuments in your area
          </p>

          <!-- Tag Search Help -->
          <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 class="text-sm font-medium text-blue-900 mb-2">🏷️ Advanced Tag Search</h3>
            <div class="text-xs text-blue-700 space-y-1">
              <div><strong>tag:key</strong> - Find artworks with a specific tag (e.g., <em>tag:material</em>)</div>
              <div><strong>tag:key:value</strong> - Find specific tag values (e.g., <em>tag:artist_name:banksy</em>)</div>
              <div><strong>Mix searches</strong> - Combine text and tags (e.g., <em>mural tag:year:2020</em>)</div>
            </div>
          </div>

          <!-- Search Tips -->
          <div class="space-y-2 text-sm text-gray-500">
            <p class="font-medium text-gray-700 mb-3">Try searching for:</p>
            <div v-for="tip in searchTips" :key="tip" class="text-left">
              <button
                class="text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus:underline"
                @click="handleSearch(getTipSearchTerm(tip))"
              >
                {{ tip }}
              </button>
            </div>
          </div>

          <!-- Recent Searches -->
          <div v-if="recentQueries.length > 0" class="mt-8">
            <h3 class="text-sm font-medium text-gray-700 mb-3">Recent Searches</h3>
            <div class="flex flex-wrap gap-2 justify-center">
              <button
                v-for="query in recentQueries.slice(0, 5)"
                :key="query"
                class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
                @click="handleRecentQueryClick(query)"
              >
                {{ query }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading && !hasResults" class="space-y-6">
        <div class="text-center py-4">
          <p class="text-gray-600">Searching for "{{ searchStore.query }}"...</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard :count="6" />
        </div>
      </div>

      <!-- Error State -->
      <div v-if="error" class="text-center py-12">
        <div class="mx-auto max-w-md">
          <svg
            class="mx-auto h-12 w-12 text-red-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>

          <h2 class="text-lg font-medium text-gray-900 mb-2">Search Error</h2>

          <p class="text-gray-600 mb-4">
            {{ error }}
          </p>

          <button
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            @click="performSearch(searchStore.query)"
          >
            Try Again
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="showEmptyState" class="text-center py-12">
        <div class="mx-auto max-w-md">
          <svg
            class="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.438-.896-6.015-2.36L5 13l.707.707A7.962 7.962 0 0012 15z"
            />
          </svg>

          <h2 class="text-lg font-medium text-gray-900 mb-2">No artworks found</h2>

          <p class="text-gray-600 mb-4">
            Try searching with different keywords or check your spelling.
          </p>

          <div class="space-y-2 text-sm text-gray-500">
            <p>Suggestions:</p>
            <ul class="space-y-1">
              <li>• Try broader terms like "art" or "mural"</li>
              <li>• Check for typos in your search</li>
              <li>• Try different artwork types like "sculpture" or "monument"</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Search Results -->
      <div v-if="hasResults" class="space-y-6">
        <!-- Results Header -->
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-medium text-gray-900">
            {{ filteredTotal }} of {{ searchStore.total }} {{ searchStore.total === 1 ? 'artwork' : 'artworks' }} shown
            <span v-if="searchStore.query" class="text-gray-600"
              >for "{{ searchStore.query }}"</span
            >
          </h2>

          <button
            v-if="searchStore.query"
            class="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
            @click="clearSearch"
          >
            Clear search
          </button>
        </div>

        <!-- Artwork Type Filters -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <ArtworkTypeFilter 
            title="Filter by Artwork Type"
            description="Select which types of artworks to show in search results"
            :columns="3"
            :compact="false"
            :collapsible="true"
            :default-collapsed="true"
            :show-control-buttons="true"
          />
        </div>

        <!-- Results Grid -->
        <div ref="searchResultsRef" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ArtworkCard
            v-for="artwork in filteredResults"
            :key="artwork.id"
            :artwork="artwork"
            :show-distance="false"
            :show-add-report="isFromFastUpload"
            @click="handleArtworkClick"
            @add-report="handleAddReport"
          />

          <!-- Loading More Skeleton Cards -->
          <template v-if="isLoading && hasResults">
            <SkeletonCard :count="3" />
          </template>
        </div>

        <!-- Load More Trigger -->
        <div v-if="searchStore.canLoadMore" ref="loadMoreRef" class="text-center py-4">
          <div v-if="isLoading" class="text-gray-600">Loading more artworks...</div>
          <button
            v-else
            class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            @click="searchStore.loadMore"
          >
            Load More Artworks
          </button>
        </div>
      </div>
      
      </div> <!-- Close text search results -->
    </div>
  </div>
</template>

<style scoped>
/* Ensure smooth transitions */
.search-view {
  transition: all 0.2s ease-in-out;
}

/* Custom scrollbar for better UX on desktop */
@media (min-width: 1024px) {
  .search-view {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e0 #f7fafc;
  }

  .search-view::-webkit-scrollbar {
    width: 8px;
  }

  .search-view::-webkit-scrollbar-track {
    background: #f7fafc;
  }

  .search-view::-webkit-scrollbar-thumb {
    background-color: #cbd5e0;
    border-radius: 4px;
  }

  .search-view::-webkit-scrollbar-thumb:hover {
    background-color: #a0aec0;
  }
}
</style>
