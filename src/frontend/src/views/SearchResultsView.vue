<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MagnifyingGlassIcon, PhotoIcon } from '@heroicons/vue/24/outline';
import { apiService } from '../services/api';

// Router
const route = useRoute();
const router = useRouter();

// State
const results = ref<any[]>([]);
const isLoading = ref(false);
const hasMore = ref(false);
const currentPage = ref(1);
const totalResults = ref(0);

// Computed
const query = computed(() => route.query.q as string || '');

// Methods
async function performSearch(page = 1, append = false): Promise<void> {
  if (!query.value.trim()) {
    results.value = [];
    return;
  }

  isLoading.value = true;

  try {
    const response = await apiService.searchArtworks(
      query.value,
      page,
      20, // per page
      'approved'
    );

    if (response.success && response.data) {
      if (append) {
        results.value.push(...response.data.artworks);
      } else {
        results.value = response.data.artworks;
      }

      hasMore.value = response.data.pagination.has_more;
      currentPage.value = response.data.pagination.page;
      totalResults.value = response.data.pagination.total;
    }
  } catch (error) {
    console.error('Search failed:', error);
    // Handle error (could show toast notification)
  } finally {
    isLoading.value = false;
  }
}

function loadMore(): void {
  performSearch(currentPage.value + 1, true);
}

function handleItemClick(item: any): void {
  router.push(`/artwork/${item.id}`);
}

// Watch for query changes
watch(() => query.value, () => {
  performSearch();
}, { immediate: true });

// Lifecycle
onMounted(() => {
  if (query.value) {
    performSearch();
  }
});
</script>

<template>
  <div class="search-results-view">
    <!-- Search Header -->
  <div class="bg-white shadow-sm border-b border-gray-200 theme-surface">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold theme-on-background">Search Results</h1>
          <div class="text-sm theme-muted">
            {{ totalResults }} results{{ query ? ` for "${query}"` : '' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Search Results Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center items-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2" style="border-color: rgb(var(--md-primary));"></div>
        <span class="ml-3 theme-muted">Searching...</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="!results.length && !isLoading" class="text-center py-12">
        <MagnifyingGlassIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900">No results found</h3>
        <p class="mt-1 text-sm text-gray-500">
          {{ query ? `Try searching for something else.` : 'Enter a search query to get started.' }}
        </p>
      </div>

      <!-- Results Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div 
          v-for="item in results" 
          :key="item.id"
          class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
          @click="handleItemClick(item)"
        >
          <!-- Item Image -->
          <div class="aspect-square bg-gray-100">
            <img 
              v-if="item.photos && item.photos.length > 0"
              :src="item.photos[0]?.thumbnail_url || item.photos[0]?.url"
              :alt="item.title || 'Artwork'"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <PhotoIcon class="h-12 w-12 text-gray-400" />
            </div>
          </div>
          
          <!-- Item Details -->
          <div class="p-4">
            <h3 class="text-lg font-semibold text-gray-900 truncate">
              {{ item.title || 'Untitled' }}
            </h3>
            <p v-if="item.artist_name" class="text-sm text-gray-600 truncate mt-1">
              by {{ item.artist_name }}
            </p>
            <p v-if="item.location_description" class="text-sm text-gray-500 truncate mt-2">
              📍 {{ item.location_description }}
            </p>
            <div v-if="item.tags && Array.isArray(item.tags) && item.tags.length > 0" class="mt-3">
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="tag in item.tags.slice(0, 3)" 
                  :key="tag"
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium theme-primary-container theme-on-primary-container"
                >
                  {{ tag }}
                </span>
                <span 
                  v-if="item.tags.length > 3"
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                >
                  +{{ item.tags.length - 3 }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Load More Button -->
      <div v-if="hasMore && !isLoading" class="text-center mt-8">
        <button 
          @click="loadMore"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm theme-primary theme-on-primary focus:outline-none focus:ring-2 focus:ring-offset-2"
          style="--tw-ring-color: var(--md-sys-color-primary);"
        >
          Load More
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-results-view {
  min-height: 100vh;
  background-color: var(--md-content-background, #f9fafb);
}
</style>