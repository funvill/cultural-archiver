<!--
  Artwork Selector Modal (Simplified)
-->

<template>
  <div class="artwork-selector-modal w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg p-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
        Select Existing Artwork
      </h3>
      <button
        @click="$emit('close')"
        class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <XMarkIcon class="w-6 h-6" />
      </button>
    </div>

    <div v-if="nearbyArtworks.length > 0" class="space-y-3 max-h-96 overflow-y-auto">
      <div
        v-for="artwork in nearbyArtworks"
        :key="artwork.id"
        class="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
        :class="selectedArtwork === artwork.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''"
        @click="selectArtwork(artwork.id)"
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
            <p class="text-sm text-gray-600 dark:text-gray-300">
              {{ artwork.distance_meters }}m away
            </p>
            <p v-if="artwork.similarity_explanation" class="text-sm text-blue-600 dark:text-blue-400">
              {{ artwork.similarity_explanation }}
            </p>
          </div>

          <input
            type="radio"
            :checked="selectedArtwork === artwork.id"
            class="w-4 h-4 text-blue-600 focus:ring-blue-500"
            @change="selectArtwork(artwork.id)"
          />
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8">
      <PhotoIcon class="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <p class="text-gray-600 dark:text-gray-300">No nearby artworks found</p>
    </div>

    <div class="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      <button
        @click="$emit('close')"
        class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
      >
        Cancel
      </button>
      <button
        @click="confirmSelection"
        :disabled="!selectedArtwork"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        Select Artwork
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { XMarkIcon, PhotoIcon } from '@heroicons/vue/24/outline';
import type { SimilarityCandidate } from '../../stores/artworkSubmission';

interface Props {
  nearbyArtworks: SimilarityCandidate[];
  selectedArtwork: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'artwork-selected': [artworkId: string];
  'close': [];
}>();

const localSelected = ref(props.selectedArtwork);

function selectArtwork(artworkId: string) {
  localSelected.value = artworkId;
}

function confirmSelection() {
  if (localSelected.value) {
    emit('artwork-selected', localSelected.value);
  }
}
</script>