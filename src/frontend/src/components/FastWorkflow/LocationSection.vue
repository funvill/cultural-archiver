<!--
  Location Section for Fast Photo-First Workflow
  Handles location detection and displays nearby artworks
-->

<template>
  <div class="location-section">
    <div class="mb-6">
      <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Artwork Location
      </h4>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        We need to know where the artwork is located to check for duplicates and help others find it.
      </p>
    </div>

    <!-- Location Status -->
    <div v-if="location" class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-start">
        <CheckCircleIcon class="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
        <div class="flex-1">
          <h5 class="font-medium text-green-900 dark:text-green-100 mb-1">
            Location Detected
          </h5>
          <div class="text-sm text-green-800 dark:text-green-200 space-y-1">
            <div>
              <strong>Coordinates:</strong> {{ location.lat.toFixed(6) }}, {{ location.lon.toFixed(6) }}
            </div>
            <div>
              <strong>Source:</strong> {{ formatLocationSource(location.source) }}
              <span v-if="location.accuracy" class="ml-2">
                (±{{ Math.round(location.accuracy) }}m accuracy)
              </span>
            </div>
            <div v-if="location.address">
              <strong>Address:</strong> {{ location.address }}
            </div>
          </div>
          <button 
            @click="showLocationPicker = true"
            class="mt-2 text-sm text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 underline"
          >
            Change Location
          </button>
        </div>
      </div>
    </div>

    <!-- Location Error -->
    <div v-if="error && !location" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start">
        <ExclamationTriangleIcon class="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
        <div class="flex-1">
          <h5 class="font-medium text-red-900 dark:text-red-100 mb-1">
            Location Error
          </h5>
          <p class="text-sm text-red-800 dark:text-red-200 mb-3">
            {{ error }}
          </p>
          <div class="flex space-x-3">
            <button 
              @click="tryGeolocation"
              :disabled="loading"
              class="text-sm bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-700 disabled:opacity-50"
            >
              Try Again
            </button>
            <button 
              @click="showLocationPicker = true"
              class="text-sm bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-700"
            >
              Set Manually
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Location Detection Options -->
    <div v-if="!location && !error" class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Auto-detect Location -->
        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div class="flex items-start">
            <MapPinIcon class="w-6 h-6 text-blue-500 mt-1 mr-3 flex-shrink-0" />
            <div class="flex-1">
              <h5 class="font-medium text-gray-900 dark:text-white mb-2">
                Auto-detect Location
              </h5>
              <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Use your device's GPS to automatically detect the artwork location.
              </p>
              <button
                @click="tryGeolocation"
                :disabled="loading"
                class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <span v-if="loading" class="flex items-center">
                  <LoadingSpinner class="w-4 h-4 mr-2" />
                  Detecting...
                </span>
                <span v-else class="flex items-center">
                  <MapPinIcon class="w-4 h-4 mr-2" />
                  Detect My Location
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Manual Location -->
        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div class="flex items-start">
            <CursorArrowRippleIcon class="w-6 h-6 text-green-500 mt-1 mr-3 flex-shrink-0" />
            <div class="flex-1">
              <h5 class="font-medium text-gray-900 dark:text-white mb-2">
                Set Location Manually
              </h5>
              <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Click on a map to pinpoint the exact location of the artwork.
              </p>
              <button
                @click="showLocationPicker = true"
                class="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center"
              >
                <MapIcon class="w-4 h-4 mr-2" />
                Choose on Map
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Nearby Artworks Section -->
    <div v-if="location" class="mt-8">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h5 class="font-medium text-gray-900 dark:text-white">
            Nearby Artworks
          </h5>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Check for existing artworks to avoid duplicates
          </p>
        </div>
        <button
          @click="$emit('checkSimilarity')"
          :disabled="similarityLoading"
          class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="similarityLoading" class="flex items-center">
            <LoadingSpinner class="w-4 h-4 mr-2" />
            Checking...
          </span>
          <span v-else>Check for Similar</span>
        </button>
      </div>

      <!-- Nearby Artworks List -->
      <div v-if="nearbyArtworks.length > 0" class="space-y-4">
        <div
          v-for="artwork in nearbyArtworks"
          :key="artwork.id"
          class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          :class="getSimilarityBorderClass(artwork)"
        >
          <div class="flex items-start space-x-4">
            <!-- Artwork Photo -->
            <div class="flex-shrink-0">
              <img
                v-if="artwork.recent_photo"
                :src="artwork.recent_photo"
                :alt="artwork.type_name"
                class="w-16 h-16 object-cover rounded-lg"
              />
              <div v-else class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <PhotoIcon class="w-8 h-8 text-gray-400" />
              </div>
            </div>

            <!-- Artwork Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2 mb-1">
                <h6 class="font-medium text-gray-900 dark:text-white truncate">
                  {{ artwork.type_name }}
                </h6>
                <SimilarityBadge v-if="artwork.similarity_threshold" :threshold="artwork.similarity_threshold" />
              </div>
              
              <div class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div class="flex items-center">
                  <MapPinIcon class="w-4 h-4 mr-1 flex-shrink-0" />
                  <span>{{ artwork.distance_meters }}m away</span>
                </div>
                
                <div v-if="artwork.similarity_explanation" class="flex items-center">
                  <ScaleIcon class="w-4 h-4 mr-1 flex-shrink-0" />
                  <span>{{ artwork.similarity_explanation }}</span>
                </div>
                
                <div v-if="artwork.photo_count" class="flex items-center">
                  <PhotoIcon class="w-4 h-4 mr-1 flex-shrink-0" />
                  <span>{{ artwork.photo_count }} photo{{ artwork.photo_count !== 1 ? 's' : '' }}</span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex-shrink-0">
              <router-link
                :to="`/artwork/${artwork.id}`"
                class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                target="_blank"
              >
                View Details →
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- No Nearby Artworks -->
      <div v-else-if="!similarityLoading" class="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
        <CheckCircleIcon class="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h6 class="font-medium text-gray-900 dark:text-white mb-2">
          No Similar Artworks Found
        </h6>
        <p class="text-sm text-gray-600 dark:text-gray-300">
          Great! This appears to be a new artwork that hasn't been documented yet.
        </p>
      </div>
    </div>

    <!-- Location Picker Modal -->
    <Modal 
      v-if="showLocationPicker" 
      :isOpen="showLocationPicker"
      @close="showLocationPicker = false"
    >
      <LocationPickerModal
        :initial-location="location"
        @locationSelected="handleLocationSelected"
        @close="showLocationPicker = false"
      />
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  MapIcon,
  PhotoIcon,
  ScaleIcon,
  CursorArrowRippleIcon,
} from '@heroicons/vue/24/outline';
import type { LocationData, SimilarityCandidate } from '../../stores/artworkSubmission';
import Modal from '../Modal.vue';
import LoadingSpinner from '../LoadingSpinner.vue';
import SimilarityBadge from './SimilarityBadge.vue';
import LocationPickerModal from './LocationPickerModal.vue';

interface Props {
  location: LocationData | null;
  loading: boolean;
  error: string | null;
  nearbyArtworks: SimilarityCandidate[];
  similarityLoading: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  locationDetected: [];
  locationManual: [lat: number, lon: number, address?: string];
  checkSimilarity: [];
}>();

// Local state
const showLocationPicker = ref(false);

// Methods
function formatLocationSource(source: string): string {
  switch (source) {
    case 'exif': return 'Photo metadata';
    case 'geolocation': return 'Device GPS';
    case 'ip': return 'IP location';
    case 'manual': return 'Manual selection';
    default: return source;
  }
}

function tryGeolocation() {
  emit('location-detected');
}

function handleLocationSelected(lat: number, lon: number, address?: string) {
  emit('location-manual', lat, lon, address);
  showLocationPicker.value = false;
}

function getSimilarityBorderClass(artwork: SimilarityCandidate): string {
  if (artwork.similarity_threshold === 'high') {
    return 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/10';
  } else if (artwork.similarity_threshold === 'warning') {
    return 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/10';
  }
  return '';
}
</script>