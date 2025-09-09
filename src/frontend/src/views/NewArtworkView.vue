<script setup lang="ts">
/**
 * NewArtworkView - Third screen of the 3-screen fast workflow
 * Simplified form for adding artwork details after photo upload and location detection
 */
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MapPinIcon, CheckCircleIcon, ArrowLeftIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '../stores/auth';
import { artworkSubmissionService } from '../services/artworkSubmission';
import type { Coordinates } from '../types';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Session data from fast upload
const fastUploadSession = ref<{
  photos: Array<{id: string; name: string; preview: string}>;
  location: Coordinates | null;
  detectedSources: any;
} | null>(null);

// Form data
const formData = ref({
  title: '',
  description: '',
  artist: '',
  year: '',
  materials: '',
  artworkType: '',
  access: '',
  condition: 'good',
  location: null as Coordinates | null,
  notes: ''
});

// UI state
const isSubmitting = ref(false);
const showLocationPicker = ref(false);
const submitError = ref<string | null>(null);
const submitSuccess = ref(false);

// Computed
const isFromFastUpload = computed(() => route.query.from === 'fast-upload');
const canSubmit = computed(() => {
  return formData.value.title.trim().length > 0 && 
         formData.value.location !== null &&
         fastUploadSession.value?.photos.length > 0;
});

// Predefined options
const artworkTypes = [
  'Sculpture', 'Mural', 'Street Art', 'Monument', 'Installation', 
  'Mosaic', 'Statue', 'Relief', 'Fountain', 'Architecture', 'Other'
];

const accessOptions = [
  { value: 'public', label: 'Public - Open to everyone' },
  { value: 'restricted', label: 'Restricted - Limited access' },
  { value: 'private', label: 'Private - Not publicly accessible' }
];

const conditionOptions = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'damaged', label: 'Damaged' }
];

// Methods
async function handleSubmit() {
  if (!canSubmit.value) return;
  
  isSubmitting.value = true;
  submitError.value = null;
  
  try {
    // Ensure user token
    await authStore.ensureUserToken();
    
    // Prepare submission data
    const submission = {
      title: formData.value.title,
      description: formData.value.description || undefined,
      artist: formData.value.artist || undefined,
      year: formData.value.year ? parseInt(formData.value.year) : undefined,
      materials: formData.value.materials || undefined,
      artworkType: formData.value.artworkType || undefined,
      access: formData.value.access || undefined,
      condition: formData.value.condition,
      latitude: formData.value.location!.latitude,
      longitude: formData.value.location!.longitude,
      notes: formData.value.notes || undefined,
      // For now, we'll need to handle photo upload separately
      // In a real implementation, we'd need to convert the session photos back to File objects
      photos: [] // TODO: Handle photo files from session
    };
    
    // Submit artwork
    const result = await artworkSubmissionService.submitArtwork({
      userToken: authStore.userToken!,
      ...submission
    });
    
    submitSuccess.value = true;
    
    // Clear session data
    sessionStorage.removeItem('fast-upload-session');
    
    // Redirect to artwork detail or success page
    setTimeout(() => {
      router.push(`/artwork/${result.id}`);
    }, 2000);
    
  } catch (error) {
    console.error('Submission failed:', error);
    submitError.value = error instanceof Error ? error.message : 'Submission failed. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
}

function goBack() {
  router.back();
}

function openLocationPicker() {
  showLocationPicker.value = true;
  // TODO: Implement map picker component
}

onMounted(async () => {
  // Load fast upload session data
  const sessionData = sessionStorage.getItem('fast-upload-session');
  if (sessionData && isFromFastUpload.value) {
    try {
      fastUploadSession.value = JSON.parse(sessionData);
      
      // Pre-fill location from session
      if (fastUploadSession.value?.location) {
        formData.value.location = fastUploadSession.value.location;
      }
    } catch (error) {
      console.error('Failed to load session data:', error);
      // Redirect back if no session data
      router.push('/add');
    }
  } else if (isFromFastUpload.value) {
    // No session data but came from fast upload - redirect back
    router.push('/add');
  }
  
  // Ensure user token is available
  await authStore.ensureUserToken();
});
</script>

<template>
  <div class="new-artwork-view min-h-screen bg-gray-50 py-8 px-4">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center mb-8">
        <button
          @click="goBack"
          class="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Go back"
        >
          <ArrowLeftIcon class="w-5 h-5" />
        </button>
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Add New Artwork</h1>
          <p class="text-gray-600 mt-1">Fill in the details for your new artwork submission</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Form -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-lg shadow-md p-6">
            <!-- Success Message -->
            <div v-if="submitSuccess" class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div class="flex items-center">
                <CheckCircleIcon class="w-5 h-5 text-green-500 mr-2" />
                <span class="text-green-800 font-medium">Artwork submitted successfully!</span>
              </div>
              <p class="text-green-600 text-sm mt-1">Redirecting to artwork page...</p>
            </div>

            <!-- Error Message -->
            <div v-if="submitError" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div class="text-red-800">
                <strong>Submission failed:</strong> {{ submitError }}
              </div>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-6">
              <!-- Required Fields -->
              <div>
                <h3 class="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                
                <!-- Title (Required) -->
                <div class="mb-4">
                  <label for="title" class="block text-sm font-medium text-gray-700 mb-2">
                    Artwork Title <span class="text-red-500">*</span>
                  </label>
                  <input
                    id="title"
                    v-model="formData.title"
                    type="text"
                    required
                    placeholder="Enter artwork title"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <!-- Description -->
                <div class="mb-4">
                  <label for="description" class="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    v-model="formData.description"
                    rows="3"
                    placeholder="Describe the artwork (optional)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <!-- Optional Details -->
              <div>
                <h3 class="text-lg font-medium text-gray-900 mb-4">Additional Details (Optional)</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- Artist -->
                  <div>
                    <label for="artist" class="block text-sm font-medium text-gray-700 mb-2">
                      Artist
                    </label>
                    <input
                      id="artist"
                      v-model="formData.artist"
                      type="text"
                      placeholder="Artist name"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <!-- Year -->
                  <div>
                    <label for="year" class="block text-sm font-medium text-gray-700 mb-2">
                      Year
                    </label>
                    <input
                      id="year"
                      v-model="formData.year"
                      type="number"
                      min="1800"
                      max="2030"
                      placeholder="Creation year"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <!-- Artwork Type -->
                  <div>
                    <label for="artworkType" class="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <select
                      id="artworkType"
                      v-model="formData.artworkType"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select type</option>
                      <option v-for="type in artworkTypes" :key="type" :value="type">
                        {{ type }}
                      </option>
                    </select>
                  </div>

                  <!-- Materials -->
                  <div>
                    <label for="materials" class="block text-sm font-medium text-gray-700 mb-2">
                      Materials
                    </label>
                    <input
                      id="materials"
                      v-model="formData.materials"
                      type="text"
                      placeholder="e.g., Bronze, Steel, Paint"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <!-- Access -->
                  <div>
                    <label for="access" class="block text-sm font-medium text-gray-700 mb-2">
                      Access
                    </label>
                    <select
                      id="access"
                      v-model="formData.access"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select access level</option>
                      <option v-for="option in accessOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </div>

                  <!-- Condition -->
                  <div>
                    <label for="condition" class="block text-sm font-medium text-gray-700 mb-2">
                      Condition
                    </label>
                    <select
                      id="condition"
                      v-model="formData.condition"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option v-for="option in conditionOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Notes -->
              <div>
                <label for="notes" class="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  id="notes"
                  v-model="formData.notes"
                  rows="3"
                  placeholder="Any additional information about this artwork"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <!-- Submit Button -->
              <div class="flex justify-end">
                <button
                  type="submit"
                  :disabled="!canSubmit || isSubmitting"
                  class="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="isSubmitting">Submitting...</span>
                  <span v-else>Submit Artwork</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Photos -->
          <div class="bg-white rounded-lg shadow-md p-6" v-if="fastUploadSession?.photos.length">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Photos ({{ fastUploadSession.photos.length }})</h3>
            <div class="grid grid-cols-2 gap-3">
              <div v-for="photo in fastUploadSession.photos" :key="photo.id">
                <img
                  :src="photo.preview"
                  :alt="photo.name"
                  class="w-full h-20 object-cover rounded-lg"
                />
              </div>
            </div>
          </div>

          <!-- Location -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Location</h3>
            
            <div v-if="formData.location" class="space-y-3">
              <div class="flex items-center text-green-600">
                <CheckCircleIcon class="w-5 h-5 mr-2" />
                <span class="text-sm font-medium">Location set</span>
              </div>
              <div class="text-sm text-gray-600">
                <div>Lat: {{ formData.location.latitude.toFixed(6) }}</div>
                <div>Lng: {{ formData.location.longitude.toFixed(6) }}</div>
              </div>
              <button
                @click="openLocationPicker"
                type="button"
                class="text-sm text-blue-600 hover:text-blue-700"
              >
                Change location
              </button>
            </div>
            
            <div v-else class="space-y-3">
              <div class="flex items-center text-red-600">
                <MapPinIcon class="w-5 h-5 mr-2" />
                <span class="text-sm font-medium">Location required</span>
              </div>
              <button
                @click="openLocationPicker"
                type="button"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Set Location
              </button>
            </div>
          </div>

          <!-- Help -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 class="text-sm font-medium text-blue-900 mb-2">Tips for Better Submissions</h3>
            <ul class="text-xs text-blue-700 space-y-1">
              <li>• Use a descriptive title</li>
              <li>• Include artist information if known</li>
              <li>• Describe unique features or context</li>
              <li>• Note the condition accurately</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.new-artwork-view {
  /* Custom styles if needed */
}
</style>