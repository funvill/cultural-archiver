<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { XMarkIcon, AdjustmentsHorizontalIcon } from '@heroicons/vue/24/outline';
import { useMapFilters } from '../composables/useMapFilters';
import { useUserLists } from '../composables/useUserLists';
import { useAuthStore } from '../stores/auth';

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
const userLists = useUserLists();
const authStore = useAuthStore();

// Local state
const isLoadingUserLists = ref(false);

// Computed properties
const isAuthenticated = computed(() => authStore.isAuthenticated);
const hasUserLists = computed(() => userLists.lists.value.length > 0);

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

// Load user lists when modal opens and user is authenticated
async function loadUserListsIfNeeded(): Promise<void> {
  if (isAuthenticated.value && !hasUserLists.value && !isLoadingUserLists.value) {
    isLoadingUserLists.value = true;
    try {
      await mapFilters.syncUserLists();
    } catch (error) {
      console.warn('Failed to load user lists:', error);
    } finally {
      isLoadingUserLists.value = false;
    }
  }
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
  if (props.isOpen) {
    loadUserListsIfNeeded();
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

// Watch for modal open to load data
function onModalOpen(): void {
  loadUserListsIfNeeded();
}

// Call when modal opens
if (props.isOpen) {
  onModalOpen();
}
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
      <div class="px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <AdjustmentsHorizontalIcon class="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Map Settings</h2>
              <p class="text-sm text-gray-600 mt-1">Control map display and filtering options</p>
            </div>
          </div>
          <button
            @click="closeModal"
            class="p-2 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Close settings"
          >
            <XMarkIcon class="h-6 w-6 text-gray-500" />
          </button>
        </div>
        
        <!-- Quick Actions Bar -->
        <div v-if="mapFilters.hasActiveFilters.value" class="flex items-center justify-between mt-4">
          <div class="text-sm text-gray-600">
            {{ mapFilters.activeFilterDescription.value }}
          </div>
          <button
            @click="handleResetAllFilters"
            class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      </div>

      <!-- Content Area - Scrollable -->
      <div class="flex-1 overflow-y-auto min-h-0">
        <div class="px-6 py-6 space-y-8">
          
          <!-- Display Options Section -->
          <div>
            <h3 class="text-base font-semibold text-gray-900 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
              Display Options
            </h3>
            
            <!-- Cluster Toggle -->
            <div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="mapFilters.filtersState.clusterEnabled"
                  @change="mapFilters.toggleClusterEnabled"
                  class="sr-only"
                />
                <div
                  class="w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2"
                  :class="mapFilters.filtersState.clusterEnabled ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-gray-100 border-gray-300 shadow-inner'"
                >
                  <div
                    class="dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200"
                    :class="mapFilters.filtersState.clusterEnabled ? 'translate-x-5 bg-white' : 'translate-x-0 bg-gray-50'"
                  ></div>
                </div>
              </label>
              
              <div class="flex-1">
                <div class="flex items-center">
                  <span class="text-sm font-medium text-gray-900">Cluster markers</span>
                </div>
                <p class="text-xs mt-1 text-gray-600">
                  Group nearby markers together for cleaner map display. Useful for high-density areas.
                </p>
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

            <!-- Artwork types grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="artworkType in mapFilters.filtersState.artworkTypes"
                :key="artworkType.key"
                class="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <input
                  :id="`type-${artworkType.key}`"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                  :checked="artworkType.enabled"
                  @change="mapFilters.toggleArtworkType(artworkType.key)"
                />
                <label
                  :for="`type-${artworkType.key}`"
                  class="ml-3 flex items-center text-sm text-gray-700 select-none min-w-0 cursor-pointer"
                >
                  <span
                    class="inline-block w-4 h-4 rounded-full mr-2 border border-white shadow-sm flex-shrink-0"
                    :style="{ backgroundColor: artworkType.color }"
                  ></span>
                  <span class="truncate">{{ artworkType.label }}</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Status Filters Section -->
          <div>
            <h3 class="text-base font-semibold text-gray-900 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Artwork Status
            </h3>
            
            <p class="text-sm text-gray-600 mb-4">
              Filter artworks by their approval status.
            </p>

            <div class="space-y-3">
              <div class="flex items-center p-3 bg-gray-50 rounded-lg">
                <input
                  id="status-approved"
                  type="checkbox"
                  class="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  :checked="mapFilters.filtersState.statusFilters.approved"
                  @change="mapFilters.toggleStatusFilter('approved')"
                />
                <label for="status-approved" class="ml-3 text-sm text-gray-700 cursor-pointer">
                  <span class="font-medium text-green-700">Approved</span> - Verified and published artworks
                </label>
              </div>
              
              <div class="flex items-center p-3 bg-gray-50 rounded-lg">
                <input
                  id="status-pending"
                  type="checkbox"
                  class="h-4 w-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                  :checked="mapFilters.filtersState.statusFilters.pending"
                  @change="mapFilters.toggleStatusFilter('pending')"
                />
                <label for="status-pending" class="ml-3 text-sm text-gray-700 cursor-pointer">
                  <span class="font-medium text-yellow-700">Pending</span> - Awaiting review and approval
                </label>
              </div>
              
              <div class="flex items-center p-3 bg-gray-50 rounded-lg">
                <input
                  id="status-rejected"
                  type="checkbox"
                  class="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  :checked="mapFilters.filtersState.statusFilters.rejected"
                  @change="mapFilters.toggleStatusFilter('rejected')"
                />
                <label for="status-rejected" class="ml-3 text-sm text-gray-700 cursor-pointer">
                  <span class="font-medium text-red-700">Rejected</span> - Not approved for publication
                </label>
              </div>
            </div>
          </div>

          <!-- User Lists Section (Authenticated Users Only) -->
          <div v-if="isAuthenticated">
            <h3 class="text-base font-semibold text-gray-900 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              My Lists
            </h3>
            
            <p class="text-sm text-gray-600 mb-4">
              Show only artworks from your personal lists.
            </p>

            <div v-if="isLoadingUserLists" class="text-center py-8">
              <div class="inline-flex items-center">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                <span class="text-sm text-gray-600">Loading your lists...</span>
              </div>
            </div>

            <div v-else-if="hasUserLists" class="space-y-3">
              <div
                v-for="listFilter in mapFilters.filtersState.userListFilters"
                :key="listFilter.listId"
                class="flex items-center p-3 bg-gray-50 rounded-lg"
              >
                <input
                  :id="`list-${listFilter.listId}`"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  :checked="listFilter.enabled"
                  @change="mapFilters.toggleUserListFilter(listFilter.listId)"
                />
                <label :for="`list-${listFilter.listId}`" class="ml-3 text-sm text-gray-700 cursor-pointer">
                  {{ listFilter.name }}
                </label>
              </div>
            </div>

            <div v-else class="text-center py-8">
              <div class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6">
                <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p class="text-gray-500 font-medium mb-2">No Lists Yet</p>
                <p class="text-sm text-gray-400">
                  Create lists by starring, visiting, or loving artworks on the map.
                </p>
              </div>
            </div>
          </div>

          <!-- Authentication Required State -->
          <div v-else class="text-center py-8">
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <svg class="w-12 h-12 text-amber-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p class="text-amber-800 font-medium mb-2">Sign In Required</p>
              <p class="text-sm text-amber-700">
                Sign in to access personal lists and advanced filtering options.
              </p>
            </div>
          </div>

          <!-- Personal Submissions Filter (Authenticated Users Only) -->
          <div v-if="isAuthenticated">
            <h3 class="text-base font-semibold text-gray-900 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Submissions
            </h3>
            
            <div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="mapFilters.filtersState.showOnlyMySubmissions"
                  @change="mapFilters.toggleShowOnlyMySubmissions"
                  class="sr-only"
                />
                <div
                  class="w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2"
                  :class="mapFilters.filtersState.showOnlyMySubmissions ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-gray-100 border-gray-300 shadow-inner'"
                >
                  <div
                    class="dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200"
                    :class="mapFilters.filtersState.showOnlyMySubmissions ? 'translate-x-5 bg-white' : 'translate-x-0 bg-gray-50'"
                  ></div>
                </div>
              </label>
              
              <div class="flex-1">
                <div class="flex items-center">
                  <span class="text-sm font-medium text-gray-900">Show only my submissions</span>
                </div>
                <p class="text-xs mt-1 text-gray-600">
                  Display only artworks that you have submitted to the platform.
                </p>
              </div>
            </div>
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