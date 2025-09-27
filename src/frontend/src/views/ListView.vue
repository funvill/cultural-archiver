<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import ArtworkCard from '../components/ArtworkCard.vue';
import { apiService } from '../services/api';

// Props
interface Props {
  id: string;
}

const props = defineProps<Props>();

// Stores and routing
const router = useRouter();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref<string | null>(null);
const list = ref<any>(null);
const artworks = ref<any[]>([]);
const currentPage = ref(1);
const totalPages = ref(1);
const hasMore = ref(false);

// Bulk operations state
const selectedArtworks = ref<Set<string>>(new Set());
const isSelectionMode = ref(false);
const bulkRemoveLoading = ref(false);

// Computed
const isOwner = computed(() => {
  return authStore.token && list.value && list.value.owner_user_id === authStore.token;
});

const canBulkRemove = computed(() => {
  return isOwner.value && !list.value?.is_readonly && selectedArtworks.value.size > 0;
});

const allSelected = computed(() => {
  return artworks.value.length > 0 && artworks.value.every(artwork => selectedArtworks.value.has(artwork.id));
});

// Load list data
const loadList = async (page = 1) => {
  loading.value = page === 1; // Only show loading spinner for first page
  error.value = null;
  
  try {
    const response = await apiService.getListDetails(props.id, page, 50);
    
    if (response.success && response.data) {
      list.value = response.data.list;
      
      if (page === 1) {
        artworks.value = response.data.items;
      } else {
        artworks.value.push(...response.data.items);
      }
      
      currentPage.value = response.data.page;
      totalPages.value = Math.ceil(response.data.total / response.data.per_page);
      hasMore.value = response.data.has_more;
    } else {
      error.value = response.error || 'Failed to load list';
    }
  } catch (err) {
    console.error('Error loading list:', err);
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      error.value = 'List not found. It may have been deleted by its owner.';
    } else {
      error.value = err instanceof Error ? err.message : 'Failed to load list';
    }
  } finally {
    loading.value = false;
  }
};

// Load more items
const loadMore = async () => {
  if (hasMore.value && !loading.value) {
    await loadList(currentPage.value + 1);
  }
};

// Go back
const goBack = () => {
  router.go(-1);
};

// Bulk operations
const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value;
  if (!isSelectionMode.value) {
    selectedArtworks.value.clear();
  }
};

const toggleArtworkSelection = (artworkId: string) => {
  if (selectedArtworks.value.has(artworkId)) {
    selectedArtworks.value.delete(artworkId);
  } else {
    selectedArtworks.value.add(artworkId);
  }
};

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedArtworks.value.clear();
  } else {
    artworks.value.forEach(artwork => selectedArtworks.value.add(artwork.id));
  }
};

const bulkRemoveItems = async () => {
  if (!canBulkRemove.value || selectedArtworks.value.size === 0) return;
  
  bulkRemoveLoading.value = true;
  error.value = null;
  
  try {
    const artworkIds = Array.from(selectedArtworks.value);
    const response = await apiService.removeArtworksFromList(props.id, artworkIds);
    
    if (response.success) {
      // Remove items from local state
      artworks.value = artworks.value.filter(artwork => !selectedArtworks.value.has(artwork.id));
      selectedArtworks.value.clear();
      isSelectionMode.value = false;
      
      // Update list item count
      if (list.value) {
        list.value.item_count -= artworkIds.length;
      }
    } else {
      error.value = response.error || 'Failed to remove items';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to remove items';
  } finally {
    bulkRemoveLoading.value = false;
  }
};

// Initialize
onMounted(() => {
  loadList(1);
});
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
    <!-- Loading state -->
    <div v-if="loading && !list" class="flex items-center justify-center py-12">
      <div class="flex items-center">
        <svg class="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="ml-3 text-gray-600">Loading list...</span>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <h1 class="text-2xl font-bold text-gray-900 mb-2 mt-4">List Not Found</h1>
      <p class="text-gray-600 mb-6">{{ error }}</p>
      <button @click="goBack"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
        ← Go Back
      </button>
    </div>

    <!-- List content -->
    <div v-else-if="list">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <button @click="goBack" 
            class="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ list.name }}</h1>
            <p class="text-gray-600">
              {{ list.item_count }} artwork{{ list.item_count === 1 ? '' : 's' }}
              <span v-if="isSelectionMode && selectedArtworks.size > 0" class="ml-2">
                ({{ selectedArtworks.size }} selected)
              </span>
            </p>
            
            <!-- System list indicator -->
            <div v-if="list.is_system_list" class="mt-2">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                System List
              </span>
            </div>
          </div>

          <!-- Actions for list owner -->
          <div v-if="isOwner" class="flex items-center space-x-2">
            <!-- List filtering actions -->
            <div v-if="artworks.length > 0" class="flex items-center space-x-2 mr-4">
              <button 
                @click="$router.push(`/?list=${props.id}`)"
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3a9 9 0 1118 0 9 9 0 01-18 0z" />
                </svg>
                View on Map
              </button>
            </div>
            
            <!-- Bulk operations -->
            <div v-if="artworks.length > 0 && !list.is_readonly">
              <button 
                v-if="!isSelectionMode"
                @click="toggleSelectionMode"
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M4.7 9.3l4.8 4.8 10.4-10.4" />
                </svg>
                Select Items
              </button>
              
              <!-- Selection mode controls -->
              <div v-else class="flex items-center space-x-2">
                <button 
                  @click="toggleSelectAll"
                  class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {{ allSelected ? 'Deselect All' : 'Select All' }}
                </button>
                
                <button 
                  @click="bulkRemoveItems"
                  :disabled="!canBulkRemove || bulkRemoveLoading"
                  class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <svg v-if="bulkRemoveLoading" class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove Selected ({{ selectedArtworks.size }})
                </button>
                
                <button 
                  @click="toggleSelectionMode"
                  class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="artworks.length === 0" class="text-center py-16 bg-gray-50 rounded-lg">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900">No artworks yet</h3>
        <p class="mt-2 text-gray-600">
          <span v-if="isOwner">Start building your collection by adding artworks from their detail pages.</span>
          <span v-else>This list is empty.</span>
        </p>
      </div>

      <!-- Artworks grid -->
      <div v-else>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <!-- Selectable artwork cards -->
          <div 
            v-for="artwork in artworks" 
            :key="artwork.id"
            :class="[
              'relative group cursor-pointer',
              isSelectionMode && selectedArtworks.has(artwork.id) ? 'ring-2 ring-blue-500' : ''
            ]"
            @click="isSelectionMode ? toggleArtworkSelection(artwork.id) : (artwork.id ? $router.push(`/artwork/${artwork.id}`) : null)"
          >
            <!-- Selection checkbox overlay (only visible in selection mode) -->
            <div 
              v-if="isSelectionMode" 
              class="absolute top-2 left-2 z-10"
            >
              <input 
                type="checkbox"
                :checked="selectedArtworks.has(artwork.id)"
                @click.stop
                @change="toggleArtworkSelection(artwork.id)"
                class="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            
            <!-- Missing artwork card -->
            <div v-if="!artwork.id || !artwork.title" class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center min-h-[200px] flex flex-col justify-center">
              <svg class="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 class="text-lg font-medium text-gray-700 mb-1">Artwork No Longer Available</h3>
              <p class="text-sm text-gray-500">This artwork has been removed or is no longer accessible.</p>
            </div>
            
            <!-- Normal artwork card -->
            <ArtworkCard 
              v-else
              :artwork="artwork"
              :show-distance="false"
              :class="isSelectionMode ? 'pointer-events-none' : ''"
            />
          </div>
        </div>

        <!-- Load more button -->
        <div v-if="hasMore" class="mt-8 text-center">
          <button 
            @click="loadMore"
            :disabled="loading"
            class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <span v-if="loading" class="flex items-center">
              <svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </span>
            <span v-else>Load More</span>
          </button>
        </div>

        <!-- Pagination info -->
        <div v-if="totalPages > 1" class="mt-4 text-center text-sm text-gray-500">
          Page {{ currentPage }} of {{ totalPages }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Component styles are handled by Tailwind CSS */
</style>