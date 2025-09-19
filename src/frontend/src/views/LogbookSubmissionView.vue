<script setup lang="ts">
/**
 * LogbookSubmissionView - Page for submitting logbook entries to existing artworks
 * Allows users to document their visits by uploading photos and optional information
 */
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { 
  PhotoIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/vue/24/outline';
import type { ArtworkDetailResponse } from '../../../shared/types';

const route = useRoute();
const router = useRouter();

// Props
interface Props {
  artworkId: string;
}

const props = defineProps<Props>();

// State
const artwork = ref<ArtworkDetailResponse | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

// Form state
const selectedPhoto = ref<File | null>(null);
const photoPreview = ref<string | null>(null);
const condition = ref<string>('');
const artworkType = ref<string>('');
const access = ref<string>('');
const artist = ref<string>('');
const material = ref<string>('');

// UI state
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);

// Computed
const artworkId = computed(() => props.artworkId || route.params.artworkId as string);

const isOnCooldown = computed(() => {
  return artwork.value?.userLogbookStatus?.onCooldown || false;
});

const cooldownDate = computed(() => {
  if (!artwork.value?.userLogbookStatus?.cooldownUntil) return null;
  return new Date(artwork.value.userLogbookStatus.cooldownUntil);
});

const cooldownMessage = computed(() => {
  if (!isOnCooldown.value || !cooldownDate.value) return '';
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  });
  
  return `Looks like you've been here recently! Come back after ${formatter.format(cooldownDate.value)} to log another visit.`;
});

const canSubmit = computed(() => {
  return !isOnCooldown.value && selectedPhoto.value && !isSubmitting.value;
});

// Methods
async function fetchArtworkDetails() {
  if (!artworkId.value) {
    error.value = 'Artwork ID is required';
    isLoading.value = false;
    return;
  }

  try {
    isLoading.value = true;
    error.value = null;

    // TODO: Replace with actual API call
    const response = await fetch(`/api/artworks/${artworkId.value}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('userToken') || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch artwork details: ${response.statusText}`);
    }

    const data = await response.json();
    artwork.value = data.data;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load artwork details';
    console.error('Failed to fetch artwork details:', err);
  } finally {
    isLoading.value = false;
  }
}

function handlePhotoChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (file) {
    selectedPhoto.value = file;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      photoPreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

function removePhoto() {
  selectedPhoto.value = null;
  photoPreview.value = null;
}

async function handleSubmit() {
  if (!canSubmit.value) return;

  try {
    isSubmitting.value = true;
    submitError.value = null;

    const formData = new FormData();
    if (selectedPhoto.value) {
      formData.append('photos', selectedPhoto.value);
    }
    formData.append('submission_type', 'logbook');
    formData.append('artwork_id', artworkId.value);
    
    // Add question answers
    const answers = [];
    if (condition.value) {
      answers.push(`Condition: ${condition.value}`);
    }
    if (answers.length > 0) {
      formData.append('notes', answers.join('; '));
    }

    // Add optional field updates
    if (artworkType.value) formData.append('artwork_type', artworkType.value);
    if (access.value) formData.append('access', access.value);
    if (artist.value) formData.append('artist', artist.value);
    if (material.value) formData.append('material', material.value);

    // TODO: Replace with actual API call
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('userToken') || ''}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Submission failed: ${response.statusText}`);
    }

    // Success - show notification and redirect
    // TODO: Replace with actual toast notification
    alert('Logbook entry submitted for review!');
    
    // Navigate back to artwork detail
    router.push(`/artwork/${artworkId.value}`);
    
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : 'Submission failed';
    console.error('Failed to submit logbook entry:', err);
  } finally {
    isSubmitting.value = false;
  }
}

function goBack() {
  router.back();
}

// Lifecycle
onMounted(() => {
  fetchArtworkDetails();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      
      <!-- Header with visual distinction -->
      <div class="bg-green-600 text-white px-6 py-4 rounded-t-lg">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">Log a Visit</h1>
            <p class="text-green-100 mt-1">Document your visit to this artwork</p>
          </div>
          <button
            @click="goBack"
            class="text-green-100 hover:text-white transition-colors"
          >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div class="bg-white shadow-lg rounded-b-lg overflow-hidden">
        <!-- Loading State -->
        <div v-if="isLoading" class="p-8 text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p class="mt-4 text-gray-600">Loading artwork details...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="p-8 text-center">
          <ExclamationTriangleIcon class="h-12 w-12 text-red-500 mx-auto" />
          <h3 class="mt-4 text-lg font-medium text-gray-900">Failed to Load Artwork</h3>
          <p class="mt-2 text-gray-600">{{ error }}</p>
          <button
            @click="fetchArtworkDetails"
            class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>

        <!-- Cooldown State -->
        <div v-else-if="isOnCooldown" class="p-8 text-center">
          <CheckCircleIcon class="h-12 w-12 text-green-500 mx-auto" />
          <h3 class="mt-4 text-lg font-medium text-gray-900">Recent Visit Recorded</h3>
          <p class="mt-2 text-gray-600">{{ cooldownMessage }}</p>
          <button
            @click="goBack"
            class="mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Go Back
          </button>
        </div>

        <!-- Main Form -->
        <div v-else-if="artwork" class="p-6">
          <!-- Artwork Info -->
          <div class="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 class="text-lg font-semibold text-gray-900 mb-2">
              {{ artwork.title || 'Untitled Artwork' }}
            </h2>
            <div class="text-sm text-gray-600 space-y-1">
              <p v-if="artwork.artist_name">Artist: {{ artwork.artist_name }}</p>
              <p>Type: {{ artwork.type_name?.replace(/_/g, ' ') }}</p>
            </div>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Photo Upload (Required) -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Photo of your visit <span class="text-red-500">*</span>
              </label>
              <p class="text-sm text-gray-600 mb-3">
                Upload a photo showing the artwork as proof of your visit
              </p>

              <div v-if="!selectedPhoto" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <PhotoIcon class="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p class="text-sm text-gray-600 mb-2">Click to select a photo</p>
                <input
                  type="file"
                  accept="image/*"
                  @change="handlePhotoChange"
                  class="hidden"
                  id="photo-upload"
                />
                <label
                  for="photo-upload"
                  class="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                >
                  Choose Photo
                </label>
              </div>

              <div v-else class="space-y-3">
                <div class="relative">
                  <img
                    v-if="photoPreview"
                    :src="photoPreview"
                    alt="Preview"
                    class="w-full h-64 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    @click="removePhoto"
                    class="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p class="text-sm text-gray-600">{{ selectedPhoto.name }}</p>
              </div>
            </div>

            <!-- Condition Assessment -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                What is the current condition? (Optional)
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50" :class="{ 'border-blue-500 bg-blue-50': condition === 'Good' }">
                  <input type="radio" v-model="condition" value="Good" class="sr-only" />
                  <div class="w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center" :class="{ 'border-blue-500': condition === 'Good' }">
                    <div v-if="condition === 'Good'" class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <span class="text-sm">Good</span>
                </label>
                <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50" :class="{ 'border-blue-500 bg-blue-50': condition === 'Damaged' }">
                  <input type="radio" v-model="condition" value="Damaged" class="sr-only" />
                  <div class="w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center" :class="{ 'border-blue-500': condition === 'Damaged' }">
                    <div v-if="condition === 'Damaged'" class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <span class="text-sm">Damaged</span>
                </label>
                <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50" :class="{ 'border-blue-500 bg-blue-50': condition === 'Missing' }">
                  <input type="radio" v-model="condition" value="Missing" class="sr-only" />
                  <div class="w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center" :class="{ 'border-blue-500': condition === 'Missing' }">
                    <div v-if="condition === 'Missing'" class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <span class="text-sm">Missing</span>
                </label>
                <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50" :class="{ 'border-blue-500 bg-blue-50': condition === 'Removed' }">
                  <input type="radio" v-model="condition" value="Removed" class="sr-only" />
                  <div class="w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center" :class="{ 'border-blue-500': condition === 'Removed' }">
                    <div v-if="condition === 'Removed'" class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <span class="text-sm">Removed</span>
                </label>
              </div>
            </div>

            <!-- Help Us Improve This Listing -->
            <div>
              <h3 class="text-lg font-medium text-gray-900 mb-4">Help Us Improve This Listing</h3>
              <p class="text-sm text-gray-600 mb-4">
                Fill in any missing information you know about this artwork
              </p>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Only show fields if they're missing from the artwork -->
                <div v-if="!artwork.type_name || artwork.type_name === 'unknown'">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Artwork Type</label>
                  <input
                    type="text"
                    v-model="artworkType"
                    placeholder="e.g., sculpture, mural, statue"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div v-if="!artwork.tags_parsed?.access">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Access</label>
                  <select v-model="access" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select access level</option>
                    <option value="public">Public</option>
                    <option value="restricted">Restricted</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div v-if="!artwork.artist_name">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Artist</label>
                  <input
                    type="text"
                    v-model="artist"
                    placeholder="Artist name"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div v-if="!artwork.tags_parsed?.material">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Material</label>
                  <input
                    type="text"
                    v-model="material"
                    placeholder="e.g., bronze, stone, paint"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <!-- Submit Error -->
            <div v-if="submitError" class="p-4 bg-red-50 border border-red-200 rounded-md">
              <div class="flex">
                <ExclamationTriangleIcon class="h-5 w-5 text-red-400" />
                <div class="ml-3">
                  <p class="text-sm text-red-800">{{ submitError }}</p>
                </div>
              </div>
            </div>

            <!-- Submit Buttons -->
            <div class="flex space-x-4">
              <button
                type="button"
                @click="goBack"
                class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="!canSubmit"
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="isSubmitting" class="flex items-center justify-center">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </span>
                <span v-else>Submit Logbook Entry</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>