<script setup lang="ts">
import { computed } from 'vue';
import { useMapFilters } from '../composables/useMapFilters';

const mapFilters = useMapFilters();

const hasActiveFilters = computed(() => mapFilters.hasActiveFilters.value);
const activeFilterCount = computed(() => mapFilters.activeFilterCount.value);
const activeFilterDescription = computed(() => mapFilters.activeFilterDescription.value);

function clearAllFilters() {
  mapFilters.resetFilters();
}
</script>

<template>
  <div 
    v-if="hasActiveFilters"
    class="absolute top-4 left-4 right-4 z-40 bg-orange-50 border border-orange-200 rounded-lg p-3 shadow-sm"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <svg class="w-5 h-5 text-orange-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
        </svg>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-orange-900">
            {{ activeFilterCount }} {{ activeFilterCount === 1 ? 'filter' : 'filters' }} active
          </div>
          <div class="text-xs text-orange-700 truncate">
            {{ activeFilterDescription }}
          </div>
        </div>
      </div>
      <button 
        @click="clearAllFilters"
        class="ml-3 text-orange-600 hover:text-orange-800 text-sm font-medium whitespace-nowrap"
      >
        Clear All
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Filter banner styling is handled via Tailwind classes */
</style>