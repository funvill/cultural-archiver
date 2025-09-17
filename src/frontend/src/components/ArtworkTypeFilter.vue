<script setup lang="ts">
import { ref } from 'vue';
import { useArtworkTypeFilters, type ArtworkTypeToggle } from '../composables/useArtworkTypeFilters';

interface Props {
  title?: string;
  description?: string;
  showControlButtons?: boolean;
  columns?: 1 | 2 | 3;
  compact?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

interface Emits {
  typeToggled: [artworkType: ArtworkTypeToggle];
  allEnabled: [];
  allDisabled: [];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const {
  artworkTypes,
  enableAllTypes,
  disableAllTypes,
} = useArtworkTypeFilters();

// Collapsible state
const isCollapsed = ref(props.defaultCollapsed ?? false);

function toggleCollapsed(): void {
  isCollapsed.value = !isCollapsed.value;
}

function handleArtworkTypeToggle(artworkType: ArtworkTypeToggle): void {
  emit('typeToggled', artworkType);
}

function handleEnableAll(): void {
  enableAllTypes();
  emit('allEnabled');
}

function handleDisableAll(): void {
  disableAllTypes();
  emit('allDisabled');
}

// Grid classes based on columns prop
const getGridClasses = (columns: number = 3): string => {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  };
  return columnClasses[columns as keyof typeof columnClasses] || columnClasses[3];
};
</script>

<template>
  <div class="artwork-type-filter">
    <!-- Header with collapsible toggle -->
    <div v-if="!props.compact" class="flex items-center justify-between mb-3">
      <div>
        <h3 class="text-sm font-medium text-gray-900 mb-1">
          {{ props.title || 'Artwork Types Filtering' }}
        </h3>
        <p class="text-xs text-gray-600">
          {{ props.description || 'Select which types of artworks to display. Each colored circle shows the marker color used.' }}
        </p>
      </div>
      <button 
        v-if="props.collapsible"
        @click="toggleCollapsed"
        class="flex items-center text-xs text-gray-600 hover:text-gray-900 focus:outline-none focus:text-gray-900 transition-colors ml-4"
        :aria-expanded="!isCollapsed"
        :aria-label="isCollapsed ? 'Show filters' : 'Hide filters'"
      >
        <span class="mr-1">{{ isCollapsed ? 'Show' : 'Hide' }}</span>
        <svg 
          class="w-4 h-4 transition-transform duration-200" 
          :class="{ 'rotate-180': !isCollapsed }"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
    
    <!-- Collapsible content -->
    <div v-if="!isCollapsed || !props.collapsible" class="space-y-3">
      <!-- Control buttons -->
      <div v-if="props.showControlButtons !== false" class="flex gap-2">
        <button
          @click="handleEnableAll"
          class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
        >
          Enable All
        </button>
        <button
          @click="handleDisableAll"
          class="text-xs bg-gray-600 text-white px-3 py-1.5 rounded hover:bg-gray-700 focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 transition-colors"
        >
          Disable All
        </button>
      </div>
      
      <!-- Artwork types grid -->
      <div class="grid gap-1.5" :class="getGridClasses(props.columns)">
        <div v-for="artworkType in artworkTypes" :key="artworkType.key" class="flex items-center">
          <input
            :id="`artwork-type-${artworkType.key}`"
            type="checkbox"
            class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
            v-model="artworkType.enabled"
            @change="handleArtworkTypeToggle(artworkType)"
          />
          <label 
            :for="`artwork-type-${artworkType.key}`" 
            class="ml-2 flex items-center text-xs text-gray-700 select-none min-w-0 cursor-pointer"
          >
            <span 
              class="inline-block w-3 h-3 rounded-full mr-1.5 border border-white shadow-sm flex-shrink-0"
              :style="{ backgroundColor: artworkType.color }"
            ></span>
            <span class="truncate">{{ artworkType.label }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>