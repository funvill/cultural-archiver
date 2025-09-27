<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
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
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Composables
const mapFilters = useMapFilters();
const authStore = useAuthStore();

// Local state
const isLoadingData = ref(false);
const searchQuery = ref(''); // Advanced Feature: Search functionality

// Computed properties
const isAuthenticated = computed(() => authStore.isAuthenticated);
const hasUserLists = computed(() => mapFilters.availableUserLists.value.length > 0);

// Advanced Feature: Filtered lists based on search query
const filteredUserLists = computed(() => {
  if (!searchQuery.value.trim()) {
    return mapFilters.availableUserLists.value;
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  return mapFilters.availableUserLists.value.filter(list => 
    list.name.toLowerCase().includes(query) ||
    (list.description && list.description.toLowerCase().includes(query))
  );
});

// Advanced Feature: Quick access to recently used filters
const recentlyUsedLists = computed(() => {
  // Get lists that are currently active
  const activeLists = mapFilters.availableUserLists.value.filter(list => 
    mapFilters.isFilterEnabled('userList', list.id)
  );
  return activeLists.slice(0, 3); // Show top 3 recently used
});

// Methods
const closeModal = () => {
  emit('update:isOpen', false);
};

const handleResetFilters = () => {
  mapFilters.resetFilters();
  emit('filtersChanged');
};

const handleToggleWantToSee = () => {
  mapFilters.toggleWantToSee();
  emit('filtersChanged');
};

const handleToggleUserList = (listId: string) => {
  mapFilters.toggleUserList(listId);
  emit('filtersChanged');
};

const handleToggleNotSeenByMe = () => {
  mapFilters.toggleNotSeenByMe();
  emit('filtersChanged');
};

// Load data when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && isAuthenticated.value) {
    isLoadingData.value = true;
    try {
      await mapFilters.loadUserLists();
    } catch (error) {
      console.error('Failed to load user lists:', error);
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

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});
</script>

<template>
  <!-- Modal Backdrop -->
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4"
    @click="closeModal"
  >
    <!-- Modal Content -->
    <div
      class="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden"
      @click.stop
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <AdjustmentsHorizontalIcon class="h-6 w-6 text-blue-600 mr-2" />
            <h2 class="text-lg font-semibold text-gray-900">Map Filters</h2>
          </div>
          <button
            @click="closeModal"
            class="p-1 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Close filters"
          >
            <XMarkIcon class="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        <!-- Reset Button -->
        <button
          @click="handleResetFilters"
          :disabled="!mapFilters.hasActiveFilters.value"
          class="mt-3 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Reset Filters
        </button>
      </div>

      <!-- Content -->
      <div class="px-6 py-4 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
        <!-- Loading State -->
        <div v-if="isLoadingData" class="text-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p class="text-sm text-gray-500 mt-2">Loading your lists...</p>
        </div>

        <!-- Authentication Required -->
        <div v-else-if="!isAuthenticated" class="text-center py-8">
          <p class="text-sm text-gray-600">Sign in to use advanced filtering features like "Want to See" and custom lists.</p>
          <p class="text-xs text-gray-500 mt-2">Some basic filters are available without signing in.</p>
        </div>

        <!-- Filter Controls -->
        <div v-else class="space-y-6">
          <!-- System Lists Section -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 mb-3">System Lists</h3>
            
            <!-- Want to See Filter -->
            <div class="flex items-start space-x-3">
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
                  Show only artworks from your "Want to See" list
                </p>
              </div>
            </div>
          </div>

          <!-- User Lists Section -->
          <div v-if="hasUserLists || mapFilters.isLoadingLists.value">
            <h3 class="text-sm font-medium text-gray-900 mb-3">Your Lists</h3>
            
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
                  <p v-if="list.description" class="text-xs mt-0.5 text-gray-500">
                    {{ list.description }}
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