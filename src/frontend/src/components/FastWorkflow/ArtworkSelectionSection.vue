<!--
  Artwork Selection Section
  Choose between creating new artwork or adding to existing artwork
-->

<template>
  <div class="artwork-selection-section">
    <div class="mb-6">
      <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Create New or Add to Existing?
      </h4>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Choose whether this is a new artwork or if you're adding photos to an existing artwork.
      </p>
    </div>

    <!-- High Similarity Warning -->
    <div v-if="similarityWarnings.length > 0" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start">
        <ExclamationTriangleIcon class="w-6 h-6 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
        <div class="flex-1">
          <h5 class="font-medium text-red-900 dark:text-red-100 mb-2">
            High Similarity Detected
          </h5>
          <p class="text-sm text-red-800 dark:text-red-200 mb-4">
            We found {{ similarityWarnings.length }} existing artwork{{ similarityWarnings.length !== 1 ? 's' : '' }} 
            that appear very similar to what you're submitting. Please review carefully to avoid duplicates.
          </p>
          <div class="space-y-3">
            <div
              v-for="artwork in similarityWarnings"
              :key="artwork.id"
              class="p-3 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-lg"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <img
                    v-if="artwork.photos?.[0]"
                    :src="artwork.photos[0]"
                    :alt="artwork.type_name"
                    class="w-12 h-12 object-cover rounded-lg"
                  />
                  <div v-else class="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <PhotoIcon class="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <h6 class="font-medium text-gray-900 dark:text-white">
                      {{ artwork.type_name }}
                    </h6>
                    <p class="text-sm text-gray-600 dark:text-gray-300">
                      {{ artwork.distance_meters }}m away • {{ artwork.similarity_explanation }}
                    </p>
                  </div>
                </div>
                <div class="flex space-x-2">
                  <button
                    @click="selectExistingArtwork(artwork.id)"
                    class="text-sm bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-700"
                  >
                    Add Photos Here
                  </button>
                  <router-link
                    :to="`/artwork/${artwork.id}`"
                    target="_blank"
                    class="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  >
                    View Details
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Selection Options -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Create New Artwork -->
      <div
        class="selection-option p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer transition-all"
        :class="isNewArtwork ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'hover:border-gray-300 dark:hover:border-gray-600'"
        @click="selectNewArtwork"
      >
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <div 
              class="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              :class="isNewArtwork ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
            >
              <PlusIcon class="w-6 h-6" />
            </div>
          </div>
          
          <div class="ml-4 flex-1">
            <h5 class="font-medium text-gray-900 dark:text-white mb-2">
              Create New Artwork
            </h5>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
              This is a new cultural artwork that hasn't been documented before. 
              You'll need to provide a title and basic details.
            </p>
            
            <div class="flex items-center">
              <input
                type="radio"
                name="artwork-selection"
                :checked="isNewArtwork"
                class="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600"
                @change="selectNewArtwork"
              />
              <span class="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                Create new artwork entry
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Add to Existing Artwork -->
      <div
        class="selection-option p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer transition-all"
        :class="!isNewArtwork ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'hover:border-gray-300 dark:hover:border-gray-600'"
        @click="showArtworkSelector = true"
      >
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <div 
              class="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              :class="!isNewArtwork ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
            >
              <PhotoIcon class="w-6 h-6" />
            </div>
          </div>
          
          <div class="ml-4 flex-1">
            <h5 class="font-medium text-gray-900 dark:text-white mb-2">
              Add to Existing Artwork
            </h5>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Add your photos to an artwork that's already been documented. 
              This creates a new logbook entry.
            </p>
            
            <div class="flex items-center">
              <input
                type="radio"
                name="artwork-selection"
                :checked="!isNewArtwork"
                class="w-4 h-4 text-green-600 focus:ring-green-500 dark:focus:ring-green-600"
                @change="showArtworkSelector = true"
              />
              <span class="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                Add photos to existing
              </span>
            </div>

            <!-- Selected Artwork Display -->
            <div v-if="selectedArtwork && selectedArtworkData" class="mt-3 p-3 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 rounded-lg">
              <div class="flex items-center space-x-3">
                <img
                  v-if="selectedArtworkData.photos?.[0]"
                  :src="selectedArtworkData.photos[0]"
                  :alt="selectedArtworkData.type_name"
                  class="w-10 h-10 object-cover rounded-lg"
                />
                <div v-else class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <PhotoIcon class="w-5 h-5 text-gray-400" />
                </div>
                <div class="flex-1">
                  <h6 class="font-medium text-gray-900 dark:text-white text-sm">
                    {{ selectedArtworkData.type_name }}
                  </h6>
                  <p class="text-xs text-gray-600 dark:text-gray-300">
                    {{ selectedArtworkData.distance_meters }}m away
                  </p>
                </div>
                <button
                  @click.stop="showArtworkSelector = true"
                  class="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Nearby Artworks Selector (when needed) -->
    <div v-if="nearbyArtworks.length > 0 && !isNewArtwork && !selectedArtwork" class="mt-6">
      <h5 class="font-medium text-gray-900 dark:text-white mb-4">
        Select an existing artwork to add photos to:
      </h5>
      <div class="space-y-3 max-h-64 overflow-y-auto">
        <div
          v-for="artwork in nearbyArtworks"
          :key="artwork.id"
          class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer transition-colors"
          @click="selectExistingArtwork(artwork.id)"
        >
          <div class="flex items-center space-x-4">
            <img
              v-if="artwork.photos?.[0]"
              :src="artwork.photos[0]"
              :alt="artwork.type_name"
              class="w-16 h-16 object-cover rounded-lg"
            />
            <div v-else class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <PhotoIcon class="w-8 h-8 text-gray-400" />
            </div>
            
            <div class="flex-1">
              <h6 class="font-medium text-gray-900 dark:text-white mb-1">
                {{ artwork.type_name }}
              </h6>
              <div class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div class="flex items-center">
                  <MapPinIcon class="w-4 h-4 mr-1" />
                  <span>{{ artwork.distance_meters }}m away</span>
                </div>
                <div v-if="artwork.similarity_explanation" class="flex items-center">
                  <ScaleIcon class="w-4 h-4 mr-1" />
                  <span>{{ artwork.similarity_explanation }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center">
              <SimilarityBadge v-if="artwork.similarity_threshold" :threshold="artwork.similarity_threshold" />
              <ChevronRightIcon class="w-5 h-5 text-gray-400 ml-2" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Artwork Selector Modal -->
    <Modal 
      v-if="showArtworkSelector" 
      :isOpen="showArtworkSelector"
      @close="showArtworkSelector = false"
    >
      <ArtworkSelectorModal
        :nearby-artworks="nearbyArtworks"
        :selected-artwork="selectedArtwork"
        @artwork-selected="handleArtworkSelected"
        @close="showArtworkSelector = false"
      />
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  PlusIcon,
  PhotoIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  ScaleIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline';
import type { SimilarityCandidate } from '../../stores/artworkSubmission';
import Modal from '../Modal.vue';
import SimilarityBadge from './SimilarityBadge.vue';
import ArtworkSelectorModal from './ArtworkSelectorModal.vue';

interface Props {
  nearbyArtworks: SimilarityCandidate[];
  selectedArtwork: string | null;
  similarityWarnings: SimilarityCandidate[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'select-artwork': [artworkId: string];
  'select-new': [];
}>();

// Local state
const showArtworkSelector = ref(false);

// Computed
const isNewArtwork = computed(() => props.selectedArtwork === null);
const selectedArtworkData = computed(() => {
  if (!props.selectedArtwork) return null;
  return props.nearbyArtworks.find(a => a.id === props.selectedArtwork) || null;
});

// Methods
function selectNewArtwork() {
  emit('select-new');
}

function selectExistingArtwork(artworkId: string) {
  emit('select-artwork', artworkId);
  showArtworkSelector.value = false;
}

function handleArtworkSelected(artworkId: string) {
  selectExistingArtwork(artworkId);
}
</script>

<style scoped>
.selection-option {
  transition: all 0.2s ease;
}

.selection-option:hover {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}
</style>