<!--
  Location Picker Modal Component
  Simple map-based location selection (placeholder implementation)
-->

<script setup lang="ts">
import { ref, computed } from 'vue';
import { XMarkIcon, MapIcon } from '@heroicons/vue/24/outline';
import type { LocationData } from '../../stores/artworkSubmission';

interface Props {
  initialLocation?: LocationData | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  locationSelected: [lat: number, lon: number, address?: string];
  close: [];
}>();

// Local state
const searchQuery = ref('');
const coordinates = ref({
  lat: props.initialLocation?.lat || 49.2827,
  lon: props.initialLocation?.lon || -123.1207,
});

// Preset locations for quick selection
const presetLocations = [
  { name: 'Vancouver Downtown', lat: 49.2827, lon: -123.1207 },
  { name: 'English Bay', lat: 49.2855, lon: -123.142 },
  { name: 'Stanley Park', lat: 49.2916, lon: -123.1419 },
  { name: 'Gastown', lat: 49.2845, lon: -123.1065 },
];

// Computed
const isValidLocation = computed(() => {
  return (
    !isNaN(coordinates.value.lat) &&
    !isNaN(coordinates.value.lon) &&
    Math.abs(coordinates.value.lat) <= 90 &&
    Math.abs(coordinates.value.lon) <= 180
  );
});

// Methods
function handleSearch() {
  // Parse coordinate input like "49.2827, -123.1207"
  const coordMatch = searchQuery.value.match(/([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)/);
  if (coordMatch && coordMatch[1] && coordMatch[2]) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lon)) {
      coordinates.value = { lat, lon };
    }
  }
  // In a real implementation, you would also do geocoding here
}

function setPresetLocation(preset: { name: string; lat: number; lon: number }) {
  coordinates.value = { lat: preset.lat, lon: preset.lon };
  searchQuery.value = preset.name;
}

function handleLocationSelect() {
  if (isValidLocation.value) {
    emit(
      'locationSelected',
      coordinates.value.lat,
      coordinates.value.lon,
      searchQuery.value || undefined
    );
  }
}
</script>

<template>
  <div class="location-picker-modal w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg p-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Select Artwork Location</h3>
      <button
        @click="$emit('close')"
        class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <XMarkIcon class="w-6 h-6" />
      </button>
    </div>

    <!-- Simplified location input for now -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Search for location or enter coordinates
        </label>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Enter address, landmark, or lat,lon coordinates"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          @keyup.enter="handleSearch"
        />
      </div>

      <!-- Coordinate inputs -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Latitude
          </label>
          <input
            v-model.number="coordinates.lat"
            type="number"
            step="any"
            placeholder="49.2827"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Longitude
          </label>
          <input
            v-model.number="coordinates.lon"
            type="number"
            step="any"
            placeholder="-123.1207"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <!-- Map placeholder -->
      <div
        class="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600"
      >
        <div class="text-center">
          <MapIcon class="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p class="text-gray-500 dark:text-gray-400">Interactive map will be implemented here</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
            For now, please enter coordinates directly
          </p>
        </div>
      </div>

      <!-- Preset locations (example) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Quick locations (Vancouver area)
        </label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            v-for="preset in presetLocations"
            :key="preset.name"
            @click="setPresetLocation(preset)"
            class="p-2 text-left text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded border border-gray-200 dark:border-gray-600"
          >
            <div class="font-medium">{{ preset.name }}</div>
            <div class="text-gray-500 dark:text-gray-400 text-xs">
              {{ preset.lat.toFixed(4) }}, {{ preset.lon.toFixed(4) }}
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      <button
        @click="$emit('close')"
        class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
      >
        Cancel
      </button>
      <button
        @click="handleLocationSelect"
        :disabled="!isValidLocation"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Select Location
      </button>
    </div>
  </div>
</template>
