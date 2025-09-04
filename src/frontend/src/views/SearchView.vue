<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SearchInput from '../components/SearchInput.vue'
import ArtworkCard from '../components/ArtworkCard.vue'
import SkeletonCard from '../components/SkeletonCard.vue'
import { useSearchStore } from '../stores/search'
import { useInfiniteScroll } from '../composables/useInfiniteScroll'
import type { SearchResult } from '../types'

const route = useRoute()
const router = useRouter()
const searchStore = useSearchStore()

// State
const searchInputRef = ref<InstanceType<typeof SearchInput>>()
const searchResultsRef = ref<HTMLElement>()
const showEmptyState = ref(false)
const showSearchTips = ref(true)

// Computed
const currentQuery = computed(() => route.params.query as string || '')
const isSearchActive = computed(() => currentQuery.value.length > 0)
const hasResults = computed(() => searchStore.hasResults)
const isLoading = computed(() => searchStore.isLoading)
const error = computed(() => searchStore.error)
const suggestions = computed(() => searchStore.suggestions)
const recentQueries = computed(() => searchStore.recentQueries)

// Sample search tips
const searchTips = [
  'Try searching for "mural" to find street art',
  'Search "sculpture" to discover 3D artworks',
  'Look for "monument" to find commemorative pieces',
  'Use "street_art" to find graffiti and urban art',
  'Search specific materials like "bronze" or "stone"'
]

// Infinite scroll setup
const { targetRef: loadMoreRef } = useInfiniteScroll(
  () => searchStore.loadMore(),
  { enabled: true, threshold: 0.1 }
)

// Methods
function handleSearch(query: string): void {
  if (query.trim().length === 0) {
    router.push('/search')
    return
  }

  // Update URL with search query
  const normalizedQuery = query.trim()
  if (normalizedQuery !== currentQuery.value) {
    router.push(`/search/${encodeURIComponent(normalizedQuery)}`)
  }
}

function handleSearchInput(query: string): void {
  searchStore.setQuery(query)
  
  // Get suggestions for non-empty queries
  if (query.trim().length > 0) {
    searchStore.fetchSuggestions(query.trim())
    showSearchTips.value = false
  } else {
    showSearchTips.value = true
  }
}

function handleSuggestionSelect(suggestion: string): void {
  handleSearch(suggestion)
}

function handleArtworkClick(artwork: SearchResult): void {
  router.push(`/artwork/${artwork.id}`)
}

function handleRecentQueryClick(query: string): void {
  handleSearch(query)
}

function getTipSearchTerm(tip: string): string {
  const match = tip.match(/"([^"]+)"/)
  return match ? (match[1] || tip) : tip
}

function clearSearch(): void {
  searchStore.clearSearch()
  router.push('/search')
  showSearchTips.value = true
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

function performSearch(query: string): void {
  if (query.trim().length === 0) {
    searchStore.clearSearch()
    showEmptyState.value = false
    return
  }

  showSearchTips.value = false
  showEmptyState.value = false
  searchStore.performSearch(query.trim())
}

// Watch for route changes
watch(
  () => route.params.query,
  (newQuery) => {
    const query = newQuery as string || ''
    
    if (query !== searchStore.query) {
      searchStore.setQuery(query)
      performSearch(query)
    }
  },
  { immediate: true }
)

// Watch for empty state after search completes
watch(
  [isLoading, hasResults, isSearchActive],
  ([loading, results, active]) => {
    if (!loading && active && !results) {
      showEmptyState.value = true
    } else {
      showEmptyState.value = false
    }
  }
)

// Lifecycle
onMounted(() => {
  searchStore.initialize()
  
  // Focus search input on mount
  nextTick(() => {
    searchInputRef.value?.focus()
  })
})

onUnmounted(() => {
  // Clear any pending debounced searches
  searchStore.clearSearch()
})
</script>

<template>
  <div class="search-view min-h-screen bg-gray-50">
    <!-- Header with Search Input -->
    <div class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center space-x-4">
          <!-- Back Button for Mobile -->
          <button
            class="lg:hidden p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
            @click="$router.back()"
            aria-label="Go back"
          >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
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
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Search Tips (shown when no active search) -->
      <div 
        v-if="showSearchTips && !isSearchActive"
        class="text-center py-12"
      >
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
          
          <h2 class="text-lg font-medium text-gray-900 mb-2">
            Search for Artworks
          </h2>
          
          <p class="text-gray-600 mb-6">
            Discover public art, murals, sculptures, and monuments in your area
          </p>

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
                class="
                  px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full
                  hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500
                  transition-colors duration-200
                "
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
          
          <h2 class="text-lg font-medium text-gray-900 mb-2">
            Search Error
          </h2>
          
          <p class="text-gray-600 mb-4">
            {{ error }}
          </p>
          
          <button
            class="
              inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
              text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            "
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
          
          <h2 class="text-lg font-medium text-gray-900 mb-2">
            No artworks found
          </h2>
          
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
            {{ searchStore.total }} {{ searchStore.total === 1 ? 'artwork' : 'artworks' }} found
            <span v-if="searchStore.query" class="text-gray-600">for "{{ searchStore.query }}"</span>
          </h2>
          
          <button
            v-if="searchStore.query"
            class="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
            @click="clearSearch"
          >
            Clear search
          </button>
        </div>

        <!-- Results Grid -->
        <div 
          ref="searchResultsRef"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <ArtworkCard
            v-for="artwork in searchStore.results"
            :key="artwork.id"
            :artwork="artwork"
            :show-distance="false"
            @click="handleArtworkClick"
          />

          <!-- Loading More Skeleton Cards -->
          <template v-if="isLoading && hasResults">
            <SkeletonCard :count="3" />
          </template>
        </div>

        <!-- Load More Trigger -->
        <div
          v-if="searchStore.canLoadMore"
          ref="loadMoreRef"
          class="text-center py-4"
        >
          <div v-if="isLoading" class="text-gray-600">
            Loading more artworks...
          </div>
          <button
            v-else
            class="
              inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md
              text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            "
            @click="searchStore.loadMore"
          >
            Load More Artworks
          </button>
        </div>
      </div>
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