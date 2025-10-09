<!--
  Location Picker Modal Component
  Interactive map-based location selection with draggable marker
-->

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  initialLat?: number;
  initialLon?: number;
}

const props = defineProps<Props>();
// Use array form to avoid strict defineEmits map constraints
const emit = defineEmits(['locationSelected', 'close']) as unknown as (
  (event: string, ...args: any[]) => void
);

// Local state
const mapContainer = ref<HTMLDivElement>();
const map = ref<L.Map>();
const marker = ref<L.Marker>();
const coordinates = ref({
  lat: props.initialLat || 49.2827,
  lon: props.initialLon || -123.1207,
});

// Computed
const isValidLocation = computed(() => {
  return (
    !isNaN(coordinates.value.lat) &&
    !isNaN(coordinates.value.lon) &&
    Math.abs(coordinates.value.lat) <= 90 &&
    Math.abs(coordinates.value.lon) <= 180
  );
});

// Initialize map
onMounted(async () => {
  await nextTick();
  
  if (!mapContainer.value) {
    console.error('Map container not found');
    return;
  }

  // Add a delay to ensure modal is fully rendered and visible
  setTimeout(() => {
    if (!mapContainer.value) return;

    try {
      // Create map
      map.value = L.map(mapContainer.value, {
        zoomControl: true,
      }).setView([coordinates.value.lat, coordinates.value.lon], 15);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map.value);

      // Force map to update its size multiple times to ensure proper rendering
      setTimeout(() => {
        if (map.value) {
          map.value.invalidateSize();
        }
      }, 100);
      
      setTimeout(() => {
        if (map.value) {
          map.value.invalidateSize();
        }
      }, 300);
      
      setTimeout(() => {
        if (map.value) {
          map.value.invalidateSize();
        }
      }, 500);

      // Create custom icon
      const customIcon = L.divIcon({
        className: 'custom-marker-icon',
        html: `
      <div style="position: relative;">
        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 26 16 26s16-17.163 16-26C32 7.163 24.837 0 16 0z" fill="#2563EB"/>
          <circle cx="16" cy="16" r="6" fill="white"/>
        </svg>
      </div>
    `,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      });

      // Add draggable marker
      marker.value = L.marker([coordinates.value.lat, coordinates.value.lon], {
        icon: customIcon,
        draggable: true,
      }).addTo(map.value);

      // Update coordinates when marker is dragged
      marker.value.on('dragend', () => {
        if (!marker.value) return;
        const pos = marker.value.getLatLng();
        coordinates.value = { lat: pos.lat, lon: pos.lng };
      });

      // Allow clicking on map to move marker
      map.value.on('click', (e: L.LeafletMouseEvent) => {
        coordinates.value = { lat: e.latlng.lat, lon: e.latlng.lng };
        if (marker.value) {
          marker.value.setLatLng(e.latlng);
        }
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, 100);
});

// Cleanup
onUnmounted(() => {
  if (map.value) {
    map.value.remove();
  }
});

// Methods
function handleLocationSelect() {
  if (isValidLocation.value) {
    emit('locationSelected', coordinates.value.lat, coordinates.value.lon);
  }
}

function updateMapFromCoordinates() {
  if (isValidLocation.value && map.value && marker.value) {
    const latlng = L.latLng(coordinates.value.lat, coordinates.value.lon);
    marker.value.setLatLng(latlng);
    map.value.setView(latlng);
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
    @click.self="() => emit('close')"
  >
    <div class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Select Location</h3>
        <button
          @click="() => emit('close')"
          class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Close"
        >
          <XMarkIcon class="w-6 h-6" />
        </button>
      </div>

      <!-- Map Container -->
      <div class="relative">
        <div
          ref="mapContainer"
          class="w-full h-96 bg-gray-100 dark:bg-gray-700"
          style="height: 384px; min-height: 384px;"
        ></div>
      </div>

      <!-- Coordinates Display and Manual Input -->
      <div class="p-6 border-t border-gray-200 dark:border-gray-700">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Latitude
            </label>
            <input
              v-model.number="coordinates.lat"
              type="number"
              step="0.000001"
              @change="updateMapFromCoordinates"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Longitude
            </label>
            <input
              v-model.number="coordinates.lon"
              type="number"
              step="0.000001"
              @change="updateMapFromCoordinates"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Drag the pin on the map or click to set the location. You can also enter coordinates manually above.
        </p>

        <!-- Actions -->
        <div class="flex justify-end space-x-3">
          <button
            @click="() => emit('close')"
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            @click="handleLocationSelect"
            :disabled="!isValidLocation"
            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Update Location
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure map controls are visible */
:deep(.leaflet-control-zoom) {
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

:deep(.leaflet-control-zoom a) {
  color: #000;
  background-color: #fff;
}

:deep(.leaflet-control-zoom a:hover) {
  background-color: #f4f4f4;
}

/* Custom marker styling */
:deep(.custom-marker-icon) {
  background: none;
  border: none;
}
</style>
