<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ArtworkCard from '../components/ArtworkCard.vue';
import PaginationControls from '../components/PaginationControls.vue';
import SortControls from '../components/SortControls.vue';
import SkeletonCard from '../components/SkeletonCard.vue';
import LoadingSpinner from '../components/LoadingSpinner.vue';
import { apiService } from '../services/api';
import type { ArtworkApiResponse } from '../../../shared/types';
import type { SearchResult } from '../types';

const route = useRoute();
const router = useRouter();

// State
const artworks = ref<ArtworkApiResponse[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const totalItems = ref(0);
const currentPage = ref(1);
const totalPages = ref(1);
const pageSize = ref(30);
const currentSort = ref<'updated_desc' | 'title_asc' | 'created_desc'>('updated_desc');

// Convert ArtworkApiResponse to SearchResult for ArtworkCard compatibility
const artworksAsSearchResults = computed(() => {
  return artworks.value.map((artwork): SearchResult => ({
    id: artwork.id,
    lat: artwork.lat,
    lon: artwork.lon,
    type_name: artwork.type_name || 'Unknown',
    tags: artwork.tags_parsed || null,
    recent_photo: artwork.recent_photo || null,
    photo_count: artwork.photo_count || 0,
  }));
});

// Sort options
const sortOptions = [
  { value: 'updated_desc', label: 'Last Updated' },
  { value: 'title_asc', label: 'Title A-Z' },
  { value: 'created_desc', label: 'Creation Date' },
];

// Computed
const hasResults = computed(() => artworks.value.length > 0);
const isEmptyState = computed(() => !loading.value && !hasResults.value && !error.value);

// Page title with dynamic page number
const pageTitle = computed(() => {
  const baseTitle = 'Artworks | Cultural Archiver';
  if (currentPage.value > 1) {
    return `Artworks (Page ${currentPage.value}) | Cultural Archiver`;
  }
  return baseTitle;
});

// Update page title
watch(pageTitle, (newTitle) => {
  document.title = newTitle;
}, { immediate: true });

// Initialize from URL parameters
function initializeFromUrl(): void {
  const urlPage = parseInt(route.query.page as string) || 1;
  const urlLimit = parseInt(route.query.limit as string) || 30;
  const urlSort = (route.query.sort as string) || 'updated_desc';

  currentPage.value = Math.max(urlPage, 1);
  pageSize.value = [10, 30, 50].includes(urlLimit) ? urlLimit : 30;
  currentSort.value = ['updated_desc', 'title_asc', 'created_desc'].includes(urlSort) 
    ? urlSort as typeof currentSort.value 
    : 'updated_desc';
}

// Update URL parameters
function updateUrl(): void {
  const query: Record<string, string> = {};
  
  if (currentPage.value > 1) {
    query.page = currentPage.value.toString();
  }
  
  if (pageSize.value !== 30) {
    query.limit = pageSize.value.toString();
  }
  
  if (currentSort.value !== 'updated_desc') {
    query.sort = currentSort.value;
  }

  router.replace({ query });
}

// Load artworks data
async function loadArtworks(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const response = await apiService.getArtworksList(
      currentPage.value,
      pageSize.value,
      currentSort.value
    );

    if (response.data) {
      artworks.value = response.data.items;
      totalItems.value = response.data.totalItems;
      totalPages.value = response.data.totalPages;
      currentPage.value = response.data.currentPage;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (err) {
    console.error('Failed to load artworks:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load artworks';
    
    // If page not found error, redirect to page 1
    if (error.value.includes('Page not found') || error.value.includes('does not exist')) {
      if (currentPage.value > 1) {
        currentPage.value = 1;
        updateUrl();
        return loadArtworks();
      }
    }
  } finally {
    loading.value = false;
  }
}

// Event handlers
function handlePageChange(page: number): void {
  currentPage.value = page;
  updateUrl();
  loadArtworks();
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handlePageSizeChange(newSize: number): void {
  // Calculate new page to keep current top item in view as per PRD
  const currentTopItem = (currentPage.value - 1) * pageSize.value + 1;
  const newPage = Math.ceil(currentTopItem / newSize);
  
  pageSize.value = newSize;
  currentPage.value = Math.max(newPage, 1);
  updateUrl();
  loadArtworks();
}

function handleSortChange(newSort: string): void {
  currentSort.value = newSort as typeof currentSort.value;
  currentPage.value = 1; // Reset to first page when sorting
  updateUrl();
  loadArtworks();
}

function handleArtworkClick(artwork: SearchResult): void {
  router.push(`/artwork/${artwork.id}`);
}

function handleRetry(): void {
  loadArtworks();
}

// Watch for external URL changes
watch(() => route.query, () => {
  initializeFromUrl();
  loadArtworks();
}, { deep: true });

// Initial load
onMounted(() => {
  initializeFromUrl();
  loadArtworks();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Artworks</h1>
            <p class="mt-1 text-sm text-gray-600">
              Browse all approved artworks in our collection
            </p>
          </div>
          
          <!-- Sort Controls -->
          <SortControls
            :current-sort="currentSort"
            :options="sortOptions"
            :loading="loading"
            @sort-change="handleSortChange"
          />
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Error State -->
      <div v-if="error" class="text-center py-12">
        <div class="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <h3 class="text-lg font-medium text-red-800 mb-2">
            Failed to Load Artworks
          </h3>
          <p class="text-red-600 mb-4">{{ error }}</p>
          <button
            @click="handleRetry"
            class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500"
          >
            Try Again
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="isEmptyState" class="text-center py-12">
        <div class="max-w-md mx-auto">
          <div class="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">
            No artwork found
          </h3>
          <p class="text-gray-500 mb-4">
            Be the first to submit something!
          </p>
          <router-link
            to="/submit"
            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
          >
            Submit Artwork
          </router-link>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="loading && !hasResults">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <SkeletonCard v-for="i in pageSize" :key="i" />
        </div>
      </div>

      <!-- Results Grid -->
      <div v-else>
        <!-- Results Count -->
        <div class="mb-6">
          <p class="text-sm text-gray-600">
            <span v-if="!loading">
              {{ totalItems.toLocaleString() }} artwork{{ totalItems === 1 ? '' : 's' }} found
            </span>
            <LoadingSpinner v-else class="inline-block w-4 h-4" />
          </p>
        </div>

        <!-- Artworks Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          <ArtworkCard
            v-for="artwork in artworksAsSearchResults"
            :key="artwork.id"
            :artwork="artwork"
            :loading="loading"
            @click="handleArtworkClick"
          />
        </div>

        <!-- Pagination -->
        <PaginationControls
          :current-page="currentPage"
          :total-pages="totalPages"
          :total-items="totalItems"
          :page-size="pageSize"
          :loading="loading"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        />
      </div>
    </div>
  </div>
</template>