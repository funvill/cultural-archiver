<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { AdjustmentsHorizontalIcon } from '@heroicons/vue/24/solid';
import { useMapFilters } from '../composables/useMapFilters';
import { useAuthStore } from '../stores/auth';

interface Props {
  isOpen: boolean;
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void;
  (e: 'filtersChanged'): void;
  (e: 'clusterChanged', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Composables
const mapFilters = useMapFilters();
const authStore = useAuthStore();

// Local state
const isLoadingData = ref(false);
const searchQuery = ref(''); // Advanced Feature: Search functionality
const clusterEnabled = ref(true); // Cluster markers toggle

// Load cluster setting from localStorage
onMounted(() => {
  const saved = localStorage.getItem('map:clusterEnabled');
  if (saved !== null) {
    clusterEnabled.value = saved === 'true';
  }
});

// Computed properties
const isAuthenticated = computed(() => authStore.isAuthenticated);
const hasUserLists = computed(() => mapFilters.availableUserLists.value.length > 0);
const hasAdvancedFeatures = computed(() => isAuthenticated.value && mapFilters.analytics.value.filterUsageCount.size > 0);
const recentFilters = computed(() => {
  // Get recently used filters from analytics
  const recent = mapFilters.analytics.value.recentlyUsed || [];
  return recent.slice(0, 5); // Show last 5
});

// Advanced Feature: Filtered lists based on search query
const filteredUserLists = computed(() => {
  if (!searchQuery.value.trim()) {
    return mapFilters.availableUserLists.value;
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  return mapFilters.availableUserLists.value.filter(list => 
    list.name.toLowerCase().includes(query)
  );
});

// Methods
function closeModal() {
  emit('update:isOpen', false);
}

function handleClusterToggle() {
  localStorage.setItem('map:clusterEnabled', clusterEnabled.value.toString());
  emit('clusterChanged', clusterEnabled.value);
}

function handleToggleWantToSee() {
  mapFilters.toggleFilter('wantToSee');
  emit('filtersChanged');
}

function handleToggleNotSeenByMe() {
  mapFilters.toggleFilter('notSeenByMe');
  emit('filtersChanged');
}

function handleToggleUserList(listId: string) {
  mapFilters.toggleFilter(`list:${listId}`);
  emit('filtersChanged');
}

function handleResetFilters() {
  mapFilters.resetAllFilters();
  emit('filtersChanged');
}

function handleApplyFilters() {
  // Emit filters changed and close modal
  emit('filtersChanged');
  closeModal();
}

function handleApplyRecentFilter(filter: any) {
  // Apply a recently used filter configuration
  // This would restore a saved filter state
  console.log('Applying recent filter:', filter);
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
    });
  } catch {
    return 'Recently';
  }
}

// Load data when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && isAuthenticated.value) {
    isLoadingData.value = true;
    try {
      await mapFilters.loadUserLists();
    } catch (error) {
      console.error('Error loading user lists:', error);
    } finally {
      isLoadingData.value = false;
    }
  }
});

// Handle escape key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.isOpen) {
    closeModal();
  }
};

// Mount/unmount keyboard listeners
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
      class="bg-white w-full h-full max-w-full max-h-full overflow-hidden md:w-[90vw] md:h-[90vh] md:max-w-4xl md:rounded-lg md:shadow-xl"
      @click.stop
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <AdjustmentsHorizontalIcon class="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Map Filters</h2>
              <p class="text-xs text-gray-600 mt-1">Control which artworks are displayed on the map</p>
            </div>
          </div>
          <button
            @click="closeModal"
            class="p-2 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Close filters"
          >
            <XMarkIcon class="h-6 w-6 text-gray-500" />
          </button>
        </div>
        
        <!-- Quick Actions -->
        <div class="flex items-center justify-between mt-4">
          <div class="text-sm text-gray-600">
            {{ mapFilters.hasActiveFilters.value ? mapFilters.activeFilterDescription.value : 'No filters active' }}
          </div>
          <button
            @click="handleResetFilters"
            :disabled="!mapFilters.hasActiveFilters.value"
            class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      </div>

      <!-- Content Area - Scrollable -->
      <div class="flex-1 overflow-y-auto">
        <div class="px-6 py-6 space-y-8">
          <!-- Filter Documentation -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 class="text-sm font-semibold text-blue-900 mb-2 flex items-center">
              <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              How Map Filters Work
            </h3>
            <div class="text-xs text-blue-800 space-y-2">
              <p><strong>List Filters (OR logic):</strong> When multiple list filters are active, artworks from ANY selected list will be shown.</p>
              <p><strong>"Not Seen by Me" (Subtractive):</strong> This filter removes visited artworks from the result set and is always applied last.</p>
              <p><strong>Visual Priority:</strong> Markers show status - gray for visited, gold for "Want to See", colored for type-based defaults.</p>
            </div>
          </div>

          <!-- Display Options Section -->
          <div>
            <h3 class="text-base font-semibold text-gray-900 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
              Display Options
            </h3>
            
            <!-- Cluster Toggle -->
            <div class="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  v-model="clusterEnabled"
                  @change="handleClusterToggle"
                  class="sr-only"
                />
                <div
                  class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors"
                  :class="clusterEnabled ? 'bg-blue-600' : 'bg-gray-200'"
                >
                  <div
                    class="dot absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform"
                    :class="clusterEnabled ? 'translate-x-5' : 'translate-x-0'"
                  ></div>
                </div>
              </label>
              
              <div class="flex-1">
                <div class="flex items-center">
                  <h4 class="text-sm font-medium text-gray-900">Cluster Markers</h4>
                  <span
                    v-if="clusterEnabled"
                    class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    Enabled
                  </span>
                </div>
                <p class="text-xs mt-1 text-gray-600">
                  Group nearby markers together for cleaner map display. Useful for high-density areas.
                </p>
              </div>
            </div>
          </div>

          <!-- Authentication Required State -->
          <div v-if="!isAuthenticated" class="text-center py-8">
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <svg class="w-12 h-12 text-amber-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 class="text-lg font-medium text-amber-900 mb-2">Sign In for Advanced Filtering</h3>
              <p class="text-sm text-amber-800 mb-4">Unlock powerful filtering features like "Want to See" lists and custom list filtering by signing in to your account.</p>
              <p class="text-xs text-amber-700">Display options like marker clustering are available without signing in.</p>
            </div>
          </div>

          <!-- Filter Controls for Authenticated Users -->
          <div v-else class="space-y-8">
            <p class="text-sm text-green-600">✓ Signed in - All filtering features available</p>
            
            <!-- System Lists Section -->
            <div>
              <h3 class="text-base font-semibold text-gray-900 mb-4">System Lists</h3>
              <div class="space-y-4">
                <!-- Want to See Filter -->
                <div class="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      :checked="mapFilters.isFilterEnabled('wantToSee')"
                      @change="handleToggleWantToSee"
                      class="sr-only"
                    />
                    <div
                      class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors"
                      :class="mapFilters.isFilterEnabled('wantToSee') ? 'bg-blue-600' : 'bg-gray-200'"
                    >
                      <div
                        class="dot absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform"
                        :class="mapFilters.isFilterEnabled('wantToSee') ? 'translate-x-5' : 'translate-x-0'"
                      ></div>
                    </div>
                  </label>
                  
                  <div class="flex-1">
                    <div class="flex items-center">
                      <h4 class="text-sm font-medium text-gray-900">Want to See</h4>
                      <span
                        v-if="mapFilters.isFilterEnabled('wantToSee')"
                        class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        Active
                      </span>
                    </div>
                    <p class="text-xs mt-1 text-gray-600">
                      Display only artworks you've saved to your "Want to See" wishlist. Perfect for planning art exploration routes.
                    </p>
                  </div>
                </div>

                <!-- Not Seen by Me Filter -->
                <div class="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      :checked="mapFilters.isFilterEnabled('notSeenByMe')"
                      @change="handleToggleNotSeenByMe"
                      class="sr-only"
                    />
                    <div
                      class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-orange-500 transition-colors"
                      :class="mapFilters.isFilterEnabled('notSeenByMe') ? 'bg-orange-600' : 'bg-gray-200'"
                    >
                      <div
                        class="dot absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform"
                        :class="mapFilters.isFilterEnabled('notSeenByMe') ? 'translate-x-5' : 'translate-x-0'"
                      ></div>
                    </div>
                  </label>
                  
                  <div class="flex-1">
                    <div class="flex items-center">
                      <h4 class="text-sm font-medium text-gray-900">Not Seen by Me</h4>
                      <span
                        v-if="mapFilters.isFilterEnabled('notSeenByMe')"
                        class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
                      >
                        Active
                      </span>
                    </div>
                    <p class="text-xs mt-1 text-gray-600">
                      Hide artworks you've already visited or logged. Great for discovering new locations in familiar areas.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- User Lists Section -->
            <div v-if="hasUserLists">
              <h3 class="text-base font-semibold text-gray-900 mb-4">Your Custom Lists</h3>
              <div class="space-y-3">
                <div 
                  v-for="list in mapFilters.availableUserLists.value" 
                  :key="list.id"
                  class="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      :checked="mapFilters.isFilterEnabled(`list:${list.id}`)"
                      @change="() => handleToggleUserList(list.id)"
                      class="sr-only"
                    />
                    <div
                      class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-green-500 transition-colors"
                      :class="mapFilters.isFilterEnabled(`list:${list.id}`) ? 'bg-green-600' : 'bg-gray-200'"
                    >
                      <div
                        class="dot absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform"
                        :class="mapFilters.isFilterEnabled(`list:${list.id}`) ? 'translate-x-5' : 'translate-x-0'"
                      ></div>
                    </div>
                  </label>
                  
                  <div class="flex-1">
                    <div class="flex items-center">
                      <h4 class="text-sm font-medium text-gray-900">{{ list.name }}</h4>
                      <span
                        v-if="mapFilters.isFilterEnabled(`list:${list.id}`)"
                        class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                      >
                        Active
                      </span>
                    </div>
                    <p class="text-xs mt-1 text-gray-600">
                      {{ list.item_count || 0 }} item{{ (list.item_count || 0) !== 1 ? 's' : '' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- No Custom Lists Message -->
            <div v-else class="text-center py-8">
              <div class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6">
                <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 class="text-sm font-medium text-gray-900 mb-2">No Custom Lists Yet</h3>
                <p class="text-xs text-gray-500 mb-4">Create custom lists to organize artworks by theme, location, or any criteria that matters to you.</p>
                <p class="text-xs text-gray-400">Visit artwork detail pages to add items to lists, or create new lists from your profile.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex-shrink-0">
        <div class="flex justify-between items-center">
          <div class="text-xs text-gray-500">
            {{ mapFilters.hasActiveFilters.value ? 'Filters applied to map display' : 'No filters currently active' }}
          </div>
          <div class="flex space-x-3">
            <button
              @click="closeModal"
              class="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Close
            </button>
            <button
              @click="handleApplyFilters"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
            
            <!-- Advanced Feature: Search Bar for Lists -->
            <div v-if="hasUserLists && mapFilters.availableUserLists.value.length > 3" class="mb-3">
              <div class="relative">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search your lists..."
                  class="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg class="absolute left-2.5 top-2.5 h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/>
                </svg>
              </div>
            </div>
            
            <!-- Loading User Lists -->
            <div v-if="mapFilters.isLoadingLists.value" class="text-center py-4">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto"></div>
              <p class="text-xs text-gray-500 mt-1">Loading lists...</p>
            </div>

            <!-- Recently Used Lists (if any) -->
            <div v-else-if="recentlyUsedLists.length > 0 && !searchQuery" class="mb-4">
              <p class="text-xs text-gray-500 mb-2">Recently Used</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="list in recentlyUsedLists"
                  :key="`recent-${list.id}`"
                  @click="() => handleToggleUserList(list.id)"
                  class="px-3 py-1 text-xs rounded-full border transition-colors"
                  :class="mapFilters.isFilterEnabled('userList', list.id) 
                    ? 'bg-blue-100 text-blue-800 border-blue-200' 
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'"
                >
                  {{ list.name }}
                </button>
              </div>
            </div>

            <!-- User Lists -->
            <div v-else-if="hasUserLists" class="space-y-3 max-h-48 overflow-y-auto">
              <!-- Show filtered results -->
              <div v-if="searchQuery && filteredUserLists.length === 0" class="text-center py-4 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-600">No lists found matching "{{ searchQuery }}"</p>
              </div>
              
              <div
                v-for="list in searchQuery ? filteredUserLists : mapFilters.availableUserLists.value"
                :key="list.id"
                class="flex items-start space-x-3"
              >
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="mapFilters.isFilterEnabled('userList', list.id)"
                    @change="() => handleToggleUserList(list.id)"
                    class="sr-only"
                  />
                  <div
                    class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors"
                    :class="mapFilters.isFilterEnabled('userList', list.id) ? 'bg-blue-600' : 'bg-gray-200'"
                  >
                    <div
                      class="dot absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform"
                      :class="mapFilters.isFilterEnabled('userList', list.id) ? 'translate-x-5' : 'translate-x-0'"
                    ></div>
                  </div>
                </label>
                
                <div class="flex-1">
                  <div class="flex items-center">
                    <h4 class="text-sm font-medium text-gray-900">{{ list.name }}</h4>
                    <span
                      v-if="mapFilters.isFilterEnabled('userList', list.id)"
                      class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      Active
                    </span>
                  </div>
                  <p class="text-xs mt-1 text-gray-600">
                    {{ list.item_count || 0 }} item{{ (list.item_count || 0) !== 1 ? 's' : '' }}
                  </p>
                </div>
              </div>
            </div>

            <!-- No User Lists -->
            <div v-else class="text-center py-6 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">You haven't created any lists yet.</p>
              <p class="text-xs text-gray-500 mt-1">Create lists from artwork detail pages to organize your favorites.</p>
            </div>
          </div>

          <!-- Map Display Options Section -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 mb-3">Map Display</h3>
            
            <!-- Cluster Markers Toggle -->
            <div class="flex items-start space-x-3 mb-4">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="clusterEnabled"
                  @change="handleToggleCluster"
                  class="sr-only"
                />
                <div
                  class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-green-500 transition-colors"
                  :class="clusterEnabled ? 'bg-green-600' : 'bg-gray-200'"
                >
                  <div
                    class="dot absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform"
                    :class="clusterEnabled ? 'translate-x-5' : 'translate-x-0'"
                  ></div>
                </div>
              </label>
              
              <div class="flex-1">
                <div class="flex items-center">
                  <h4 class="text-sm font-medium text-gray-900">Cluster Markers</h4>
                  <span
                    v-if="clusterEnabled"
                    class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                  >
                    Active
                  </span>
                </div>
                <p class="text-xs mt-1 text-gray-600">
                  Group nearby artworks together for cleaner map display
                </p>
              </div>
            </div>
          </div>

          <!-- Subtractive Filters Section -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 mb-3">Advanced Filters</h3>
            
            <!-- Not Seen by Me Filter -->
            <div class="flex items-start space-x-3">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="mapFilters.isFilterEnabled('notSeenByMe')"
                  @change="handleToggleNotSeenByMe"
                  class="sr-only"
                />
                <div
                  class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-orange-500 transition-colors"
                  :class="mapFilters.isFilterEnabled('notSeenByMe') ? 'bg-orange-600' : 'bg-gray-200'"
                >
                  <div
                    class="dot absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform"
                    :class="mapFilters.isFilterEnabled('notSeenByMe') ? 'translate-x-5' : 'translate-x-0'"
                  ></div>
                </div>
              </label>
              
              <div class="flex-1">
                <div class="flex items-center">
                  <h4 class="text-sm font-medium text-gray-900">Not Seen by Me</h4>
                  <span
                    v-if="mapFilters.isFilterEnabled('notSeenByMe')"
                    class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
                  >
                    Active
                  </span>
                </div>
                <p class="text-xs mt-1 text-gray-600">
                  Hide artworks you've already visited or logged
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <button
          @click="closeModal"
          class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          Apply Filters
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom toggle switch styles */
.dot {
  transition: transform 0.2s ease-in-out;
}

/* Smooth scrolling for lists */
.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e0 transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: #cbd5e0;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: #a0aec0;
}
</style>