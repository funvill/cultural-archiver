<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { useMapFilters } from '../composables/useMapFilters';
import { useAuthStore } from '../stores/auth';
import { useMapSettings } from '../stores/mapSettings';

interface Props {
  isOpen: boolean;
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void;
  (e: 'applySettings'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Composables
const mapFilters = useMapFilters();
const authStore = useAuthStore();
const mapSettings = useMapSettings();

// Computed properties
const isAuthenticated = computed(() => authStore.isAuthenticated);

// Methods
function closeModal(): void {
  emit('update:isOpen', false);
}

function handleApplySettings(): void {
  emit('applySettings');
  closeModal();
}

function handleResetAllFilters(): void {
  mapFilters.resetFilters();
}

function toggleClustering(): void {
  mapSettings.toggleClustering();
}

// Keyboard handling
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.isOpen) {
    closeModal();
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <!-- Modal Backdrop -->
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50 flex items-center justify-center"
    @click="closeModal"
  >
    <!-- Full Screen Modal Content -->
    <div
      class="bg-white w-full h-full max-w-full max-h-full flex flex-col md:w-[90vw] md:h-[90vh] md:max-w-4xl md:rounded-lg md:shadow-xl"
      @click.stop
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Map Options</h2>
          <div class="flex items-center space-x-2">
            <button
              @click="handleResetAllFilters"
              class="text-sm text-red-600 hover:text-red-700 focus:ring-2 focus:ring-red-500 px-3 py-1 rounded transition-colors"
            >
              Clear All Filters
            </button>
            <button
              @click="closeModal"
              class="p-2 hover:bg-gray-200 rounded-full transition-colors"
              aria-label="Close settings"
            >
              <XMarkIcon class="h-6 w-6 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-8">
        <!-- Simple Filters Section (Authenticated Users Only) -->
        <div v-if="isAuthenticated">
          <h3 class="text-base font-semibold text-gray-900 mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
          </h3>
          
          <div class="space-y-4">
            <!-- Hide Visited Artworks -->
            <div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <label class="relative inline-flex items-center cursor-pointer" @click="mapFilters.toggleHideVisited()">
                <input
                  type="checkbox"
                  :checked="mapFilters.filtersState.hideVisited"
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2 cursor-pointer"
                  :class="mapFilters.filtersState.hideVisited ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-gray-100 border-gray-300 shadow-inner'"
                >
                  <div
                    class="dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200 pointer-events-none"
                    :class="mapFilters.filtersState.hideVisited ? 'translate-x-5 bg-white' : 'translate-x-0 bg-gray-50'"
                  ></div>
                </div>
              </label>
              
              <div class="flex-1">
                <div class="flex items-center">
                  <span class="text-sm font-medium text-gray-900">Hide visited artworks</span>
                </div>
                <p class="text-xs mt-1 text-gray-600">
                  Hide artworks that you have marked as visited from the map display.
                </p>
              </div>
            </div>

            <!-- Show Artworks Without Photos -->
            <div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <label class="relative inline-flex items-center cursor-pointer" @click="mapFilters.toggleShowArtworksWithoutPhotos()">
                <input
                  type="checkbox"
                  :checked="mapFilters.filtersState.showArtworksWithoutPhotos"
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2 cursor-pointer"
                  :class="mapFilters.filtersState.showArtworksWithoutPhotos ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-gray-100 border-gray-300 shadow-inner'"
                >
                  <div
                    class="dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200 pointer-events-none"
                    :class="mapFilters.filtersState.showArtworksWithoutPhotos ? 'translate-x-5 bg-white' : 'translate-x-0 bg-gray-50'"
                  ></div>
                </div>
              </label>
              
              <div class="flex-1">
                <div class="flex items-center">
                  <span class="text-sm font-medium text-gray-900">Show artworks without photos</span>
                </div>
                <p class="text-xs mt-1 text-gray-600">
                  When off, artworks that do not have photos yet are hidden from the map.
                </p>
              </div>
            </div>

            <!-- Show Removed Artworks -->
            <div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <label class="relative inline-flex items-center cursor-pointer" @click="mapFilters.toggleShowRemoved()">
                <input
                  type="checkbox"
                  :checked="mapFilters.filtersState.showRemoved"
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2 cursor-pointer"
                  :class="mapFilters.filtersState.showRemoved ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-gray-100 border-gray-300 shadow-inner'"
                >
                  <div
                    class="dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200 pointer-events-none"
                    :class="mapFilters.filtersState.showRemoved ? 'translate-x-5 bg-white' : 'translate-x-0 bg-gray-50'"
                  ></div>
                </div>
              </label>
              
              <div class="flex-1">
                <div class="flex items-center">
                  <span class="text-sm font-medium text-gray-900">Show removed artworks</span>
                </div>
                <p class="text-xs mt-1 text-gray-600">
                  Include artworks that have been removed or are of unknown status.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Display Options removed: cluster toggle is moved to main map controls -->

        <!-- Display Options Section -->
        <div>
          <h3 class="text-base font-semibold text-gray-900 mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Display Options
          </h3>
          
          <div class="space-y-4">
            <!-- Enable Marker Clustering -->
            <div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <label class="relative inline-flex items-center cursor-pointer" @click="toggleClustering()">
                <input
                  type="checkbox"
                  :checked="mapSettings.clusteringEnabled"
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2 cursor-pointer"
                  :class="mapSettings.clusteringEnabled ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-gray-100 border-gray-300 shadow-inner'"
                >
                  <div
                    class="dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200 pointer-events-none"
                    :class="mapSettings.clusteringEnabled ? 'translate-x-5 bg-white' : 'translate-x-0 bg-gray-50'"
                  ></div>
                </div>
              </label>
              
              <div class="flex-1">
                <div class="flex items-center">
                  <span class="text-sm font-medium text-gray-900">Enable Marker Clustering</span>
                </div>
                <p class="text-xs mt-1 text-gray-600">
                  Group nearby artworks into numbered clusters at higher zoom levels (zoom > 14).
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Artwork Type Filters Section -->
        <div>
          <h3 class="text-base font-semibold text-gray-900 mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Artwork Types
          </h3>
          
          <p class="text-sm text-gray-600 mb-4">
            Select which types of artworks to display on the map. Each colored circle shows the marker color used.
          </p>

          <!-- Control buttons -->
          <div class="flex gap-2 mb-4">
            <button
              @click="mapFilters.setAllArtworkTypes(true)"
              class="text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Enable All
            </button>
            <button
              @click="mapFilters.setAllArtworkTypes(false)"
              class="text-sm bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              Disable All
            </button>
          </div>

          <!-- Artwork types grid with toggles -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div
              v-for="artworkType in mapFilters.filtersState.artworkTypes"
              :key="artworkType.key"
              class="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="artworkType.enabled"
                  @change="mapFilters.toggleArtworkType(artworkType.key)"
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2"
                  :class="artworkType.enabled ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-gray-100 border-gray-300 shadow-inner'"
                >
                  <div
                    class="dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200"
                    :class="artworkType.enabled ? 'translate-x-5 bg-white' : 'translate-x-0 bg-gray-50'"
                  ></div>
                </div>
              </label>
              
              <div class="ml-3 flex items-center min-w-0 flex-1">
                <span
                  class="inline-block w-4 h-4 rounded-full mr-2 border border-white shadow-sm flex-shrink-0"
                  :style="{ backgroundColor: artworkType.color }"
                ></span>
                <span class="truncate text-sm text-gray-700">{{ artworkType.label }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Authentication Required State -->
        <div v-if="!isAuthenticated" class="text-center py-8">
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <svg class="w-12 h-12 text-amber-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p class="text-amber-800 font-medium mb-2">Sign In Required</p>
            <p class="text-sm text-amber-700">
              Sign in to access filtering options for visited and removed artworks.
            </p>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex-shrink-0">
        <div class="flex justify-between items-center">
          <div class="text-sm text-gray-500">
            {{ mapFilters.hasActiveFilters.value ? 'Filters will be applied to map display' : 'No filters currently active' }}
          </div>
          <div class="flex space-x-3">
            <button
              @click="closeModal"
              class="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleApplySettings"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Apply Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom toggle switch styles */
.dot {
  transition: transform 0.2s ease-in-out;
}
</style>