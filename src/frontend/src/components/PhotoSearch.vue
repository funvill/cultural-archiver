<!--
  Photo-First Search Component
  Dedicated interface for searching artworks by photo before submission
  Priority 1 UX improvement: Separate photo search from submission workflow
-->

<template>
  <div class="photo-search max-w-4xl mx-auto p-6 space-y-6">
    <!-- Search Header -->
    <div class="text-center">
      <div class="flex items-center justify-center mb-4">
        <CameraIcon class="w-12 h-12 text-blue-600 mr-3" />
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Search by Photo
        </h1>
      </div>
      <p class="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
        Upload a photo to find similar artworks in our database. Perfect for identifying existing pieces before adding new submissions.
      </p>
    </div>

    <!-- Quick Photo Upload -->
    <div class="photo-upload-card bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <div class="p-8">
        <!-- Upload Zone -->
        <div 
          class="upload-zone border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center transition-all duration-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          :class="{ 
            'border-blue-500 bg-blue-50 dark:bg-blue-900/20': isDragging,
            'cursor-pointer': !isSearching 
          }"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragenter="handleDragEnter"
          @dragleave="handleDragLeave"
          @click="!isSearching && triggerFileSelect()"
        >
          <div v-if="!searchPhoto" class="space-y-4">
            <CameraIcon class="w-16 h-16 text-gray-400 mx-auto" />
            <div>
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Drop your photo here or click to select
              </h3>
              <p class="text-gray-600 dark:text-gray-300">
                JPG, PNG, WebP • Max 10MB • Best results with clear, well-lit photos
              </p>
            </div>
          </div>

          <!-- Photo Preview -->
          <div v-else class="space-y-4">
            <div class="relative inline-block">
              <img 
                :src="searchPhoto" 
                alt="Search photo"
                class="max-h-48 rounded-lg shadow-md"
              />
              <button
                v-if="!isSearching"
                @click.stop="clearPhoto"
                class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <XMarkIcon class="w-5 h-5" />
              </button>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300">
              {{ isSearching ? 'Searching for similar artworks...' : 'Click search to find similar artworks' }}
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="mt-6 flex justify-center space-x-4">
          <button
            v-if="!searchPhoto"
            @click="triggerFileSelect"
            :disabled="isSearching"
            class="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CameraIcon class="w-5 h-5 inline mr-2" />
            Choose Photo
          </button>
          
          <template v-else>
            <button
              @click="performSearch"
              :disabled="isSearching"
              class="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <span v-if="isSearching" class="flex items-center">
                <LoadingSpinner class="w-5 h-5 mr-2" />
                Searching...
              </span>
              <span v-else class="flex items-center">
                <MagnifyingGlassIcon class="w-5 h-5 mr-2" />
                Search Similar
              </span>
            </button>
            
            <button
              @click="clearPhoto"
              :disabled="isSearching"
              class="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 disabled:opacity-50 transition-colors"
            >
              Try Another Photo
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="searchResults.length > 0" class="results-section">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          Similar Artworks Found
        </h2>
        <div class="text-sm text-gray-600 dark:text-gray-300">
          Found {{ searchResults.length }} similar artwork{{ searchResults.length !== 1 ? 's' : '' }}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="result in searchResults"
          :key="result.id"
          class="result-card bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow cursor-pointer"
          @click="handleResultClick(result)"
        >
          <div class="p-4">
            <!-- Photo Comparison -->
            <div class="flex space-x-3 mb-4">
              <div class="flex-1">
                <p class="text-xs text-gray-500 mb-1">Your Photo</p>
                <img 
                  v-if="searchPhoto"
                  :src="searchPhoto" 
                  alt="Your search photo"
                  class="w-full h-24 object-cover rounded-lg"
                />
              </div>
              <div class="flex items-center">
                <ArrowRightIcon class="w-5 h-5 text-gray-400" />
              </div>
              <div class="flex-1">
                <p class="text-xs text-gray-500 mb-1">Found Artwork</p>
                <img 
                  :src="result.recent_photo || '/placeholder-artwork.jpg'" 
                  alt="Similar artwork"
                  class="w-full h-24 object-cover rounded-lg"
                />
              </div>
            </div>

            <!-- Similarity Score -->
            <div class="mb-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Similarity</span>
                <span class="text-sm font-bold" :class="getSimilarityColor(result.similarity_score)">
                  {{ Math.round(result.similarity_score * 100) }}%
                </span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  class="h-2 rounded-full transition-all" 
                  :class="getSimilarityBarColor(result.similarity_score)"
                  :style="{ width: `${result.similarity_score * 100}%` }"
                ></div>
              </div>
            </div>

            <!-- Artwork Info -->
            <div class="space-y-2">
              <h3 class="font-semibold text-gray-900 dark:text-white">
                {{ result.type_name || 'Unknown Type' }}
              </h3>
              <div class="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <MapPinIcon class="w-4 h-4 mr-1" />
                <span>{{ result.distance_km ? `${result.distance_km.toFixed(1)}km away` : 'Distance unknown' }}</span>
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-300">
                {{ result.photo_count || 0 }} photo{{ result.photo_count !== 1 ? 's' : '' }} available
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="border-t border-gray-200 dark:border-gray-700 p-4">
            <div class="flex space-x-2">
              <button 
                class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                @click.stop="viewArtwork(result)"
              >
                View Details
              </button>
              <button 
                class="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                @click.stop="addToArtwork(result)"
              >
                Add Photos
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Results State -->
    <div v-else-if="hasSearched && !isSearching" class="no-results text-center py-12">
      <ExclamationCircleIcon class="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        No Similar Artworks Found
      </h3>
      <p class="text-gray-600 dark:text-gray-300 mb-6">
        We couldn't find any artworks similar to your photo. This might be a new piece!
      </p>
      <div class="flex justify-center space-x-4">
        <button
          @click="submitNewArtwork"
          class="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Submit as New Artwork
        </button>
        <button
          @click="clearPhoto"
          class="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 transition-colors"
        >
          Try Another Photo
        </button>
      </div>
    </div>

    <!-- Hidden File Input -->
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="handleFileSelect"
    />
  </div>
</template>


<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  CameraIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowRightIcon,
  MapPinIcon,
  ExclamationCircleIcon,
} from '@heroicons/vue/24/outline';
import LoadingSpinner from './LoadingSpinner.vue';
import type { ArtworkWithPhotos } from '../types';

// Define local interface for similarity results since it's not exported from types
interface SimilarityResult {
  similarity_score: number;
}

// State
const fileInput = ref<HTMLInputElement>();
const searchPhoto = ref<string>();
const isDragging = ref(false);
const isSearching = ref(false);
const hasSearched = ref(false);
const searchResults = ref<(ArtworkWithPhotos & SimilarityResult)[]>([]);

const router = useRouter();

// Methods
function triggerFileSelect() {
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    processPhoto(file);
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  
  const files = event.dataTransfer?.files;
  if (files?.length && files[0]) {
    processPhoto(files[0]);
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
}

function handleDragEnter() {
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function processPhoto(file: File) {
  // Validate file type and size
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    alert('Please select a valid image file (JPG, PNG, or WebP)');
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    alert('File size must be less than 10MB');
    return;
  }

  // Create preview URL
  const reader = new FileReader();
  reader.onload = (e) => {
    searchPhoto.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

function clearPhoto() {
  searchPhoto.value = undefined;
  searchResults.value = [];
  hasSearched.value = false;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

async function performSearch() {
  if (!searchPhoto.value) return;
  
  isSearching.value = true;
  hasSearched.value = true;
  
  try {
    // Note: In real implementation, this would convert photo to file for API
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API delay
    
    // Mock results for demonstration
    searchResults.value = [
      {
        id: 'mock-1',
        type_name: 'Street Mural',
        distance_km: 0.3,
        photo_count: 5,
        recent_photo: 'https://picsum.photos/300/200?random=1',
        similarity_score: 0.87,
        lat: 49.2827,
        lon: -123.1207,
      },
      {
        id: 'mock-2', 
        type_name: 'Abstract Sculpture',
        distance_km: 1.2,
        photo_count: 3,
        recent_photo: 'https://picsum.photos/300/200?random=2',
        similarity_score: 0.72,
        lat: 49.2820,
        lon: -123.1200,
      },
    ] as (ArtworkWithPhotos & SimilarityResult)[];
    
  } catch (error) {
    console.error('Search failed:', error);
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

function getSimilarityColor(score: number): string {
  if (score >= 0.8) return 'text-red-600';
  if (score >= 0.6) return 'text-orange-600';
  return 'text-green-600';
}

function getSimilarityBarColor(score: number): string {
  if (score >= 0.8) return 'bg-red-500';
  if (score >= 0.6) return 'bg-orange-500';
  return 'bg-green-500';
}

function handleResultClick(result: ArtworkWithPhotos & SimilarityResult) {
  // Could expand the card or show more details
  console.log('Clicked result:', result);
}

function viewArtwork(result: ArtworkWithPhotos & SimilarityResult) {
  router.push(`/artwork/${result.id}`);
}

function addToArtwork(result: ArtworkWithPhotos & SimilarityResult) {
  // Navigate to submission with pre-selected artwork
  router.push({
    path: '/submit',
    query: { 
      artwork_id: result.id,
      photo: searchPhoto.value 
    }
  });
}

function submitNewArtwork() {
  // Navigate to submission with the search photo
  router.push({
    path: '/submit',
    query: { 
      photo: searchPhoto.value,
      new_artwork: 'true'
    }
  });
}
</script>

<style scoped>
.photo-upload-card {
  transition: all 0.3s ease;
}

.photo-upload-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.result-card {
  transition: all 0.2s ease;
}

.result-card:hover {
  transform: translateY(-2px);
}

.upload-zone {
  transition: all 0.2s ease;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .photo-search {
    padding: 1rem;
  }
  
  .photo-upload-card .p-8 {
    padding: 1.5rem;
  }
  
  .upload-zone {
    padding: 2rem;
  }
}
</style>