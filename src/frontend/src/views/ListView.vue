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

// Computed
const isOwner = computed(() => {
  return authStore.token && list.value && list.value.owner_user_id === authStore.token;
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
            <!-- Future: Edit, Delete, Share buttons could go here -->
            <span class="text-sm text-gray-500">Owner</span>
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
          <ArtworkCard 
            v-for="artwork in artworks" 
            :key="artwork.id"
            :artwork="artwork"
            :show-distance="false"
          />
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