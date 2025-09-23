<script setup lang="ts">
import { useArtworkFilters } from '../composables/useArtworkFilters';

// Props
interface Props {
  title?: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  showControlButtons?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Additional Filters',
  description: 'Filter artworks by photos and condition',
  collapsible: true,
  defaultCollapsed: true,
  showControlButtons: true,
});

// Composables
const {
  artworkFilters,
  allFiltersEnabled,
  toggleFilter,
  enableAllFilters,
  disableAllFilters,
  resetToDefaults,
} = useArtworkFilters();

// Local state for collapsible functionality
import { ref } from 'vue';
const isCollapsed = ref(props.defaultCollapsed);

function toggleCollapsed(): void {
  isCollapsed.value = !isCollapsed.value;
}
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-lg p-4">
    <!-- Header -->
    <div
      class="flex items-center justify-between cursor-pointer"
      :class="{ 'mb-4': !collapsible || !isCollapsed }"
      @click="collapsible ? toggleCollapsed() : undefined"
    >
      <div>
        <h3 class="text-lg font-medium text-gray-900">{{ title }}</h3>
        <p v-if="description" class="text-sm text-gray-600 mt-1">{{ description }}</p>
      </div>

      <!-- Collapse toggle -->
      <button
        v-if="collapsible"
        type="button"
        class="p-1 rounded-md hover:bg-gray-100 focus:ring-2 focus:ring-blue-500"
        :aria-label="isCollapsed ? 'Expand filters' : 'Collapse filters'"
      >
        <svg
          class="w-5 h-5 text-gray-500 transition-transform duration-200"
          :class="{ 'rotate-180': !isCollapsed }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </div>

    <!-- Filters Content -->
    <div v-if="!collapsible || !isCollapsed" class="space-y-4">
      <!-- Control Buttons -->
      <div v-if="showControlButtons" class="flex flex-wrap gap-2 pb-4 border-b border-gray-200">
        <button
          @click="enableAllFilters"
          :disabled="allFiltersEnabled"
          class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enable All
        </button>

        <button
          @click="disableAllFilters"
          :disabled="!allFiltersEnabled"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Disable All
        </button>

        <button
          @click="resetToDefaults"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500"
        >
          Reset
        </button>
      </div>

      <!-- Filter Toggles -->
      <div class="space-y-3">
        <div v-for="filter in artworkFilters" :key="filter.key" class="flex items-start space-x-3">
          <!-- Toggle Switch -->
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              :checked="filter.enabled"
              @change="toggleFilter(filter.key)"
              class="sr-only"
            />
            <div
              class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer transition-colors duration-200"
              :class="filter.enabled ? 'bg-blue-600' : 'bg-gray-200'"
            >
              <div
                class="dot absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform duration-200"
                :class="filter.enabled ? 'translate-x-full' : 'translate-x-0'"
              ></div>
            </div>
          </label>

          <!-- Filter Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2">
              <span
                class="text-sm font-medium transition-colors duration-200"
                :class="filter.enabled ? 'text-gray-900' : 'text-gray-500'"
              >
                {{ filter.label }}
              </span>
              <span
                v-if="filter.enabled"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                Active
              </span>
            </div>
            <p
              class="text-xs mt-1 transition-colors duration-200"
              :class="filter.enabled ? 'text-gray-600' : 'text-gray-400'"
            >
              {{ filter.description }}
            </p>
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
