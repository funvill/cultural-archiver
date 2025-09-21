<script setup lang="ts">
/**
 * LogbookSubmissionView - Page for submitting logbook entries to existing artworks
 * Allows users to document their visits by uploading photos and optional information
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { 
  PhotoIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/vue/24/outline';
import { useLogbookSubmissionStore } from '../stores/logbookSubmission';
import { useFastUploadSessionStore } from '../stores/fastUploadSession';
import ConsentSection from '../components/FastWorkflow/ConsentSection.vue';

const route = useRoute();
const router = useRouter();
const store = useLogbookSubmissionStore();
const fastUploadStore = useFastUploadSessionStore();

// Props
interface Props {
  artworkId: string;
}

const props = defineProps<Props>();

// Consent section ref and state
const consentSection = ref<InstanceType<typeof ConsentSection> | null>(null);
const consentCheckboxes = ref({
  cc0Licensing: false,
  termsAndGuidelines: false,
  photoRights: false,
});

// Computed
const artworkId = computed(() => props.artworkId || route.params.artworkId as string);

const allConsentsAccepted = computed(() => {
  return Object.values(consentCheckboxes.value).every(Boolean);
});

const canSubmit = computed(() => {
  // Allow submission if either store has photo OR we have fast upload photo
  const hasValidPhoto = store.hasPhoto || hasExistingPhoto.value;
  return !store.isOnCooldown && 
         hasValidPhoto && 
         !store.isSubmitting && 
         !store.isLoadingArtwork &&
         !!store.artwork &&
         allConsentsAccepted.value;
});

// Fast upload session detection
const isFromFastUpload = computed(() => {
  return route.query.source === 'fast-upload'
})

// Local session data (loaded from sessionStorage)
const fastUploadSessionData = ref<{
  photos: any[];
  location: any;
  detectedSources: any;
} | null>(null)

const hasExistingPhoto = computed(() => {
  return isFromFastUpload.value && (
    // Check Pinia store first (has File objects)
    (fastUploadStore.hasPhotos && fastUploadStore.photos.length > 0) ||
    // Fallback to sessionStorage data
    (fastUploadSessionData.value?.photos && fastUploadSessionData.value.photos.length > 0)
  )
})

const fastUploadPhotoName = computed(() => {
  if (!hasExistingPhoto.value) return null
  
  // Check Pinia store first
  if (fastUploadStore.hasPhotos && fastUploadStore.photos.length > 0) {
    return fastUploadStore.photos[0]?.name || 'Unknown filename'
  }
  
  // Fallback to sessionStorage data
  if (fastUploadSessionData.value?.photos && fastUploadSessionData.value.photos.length > 0) {
    return fastUploadSessionData.value.photos[0]?.name || 'Unknown filename'
  }
  
  return null
})

const fastUploadPhotoPreview = computed(() => {
  if (!hasExistingPhoto.value) return null
  
  // Check Pinia store first (has preview URLs)
  if (fastUploadStore.hasPhotos && fastUploadStore.photos.length > 0) {
    return fastUploadStore.photos[0]?.preview || null
  }
  
  // sessionStorage doesn't have previews (intentionally omitted for size)
  return null
})

const fastUploadPhotoFile = computed(() => {
  if (!hasExistingPhoto.value) return null
  
  // Only Pinia store has File objects (not persisted to sessionStorage)
  if (fastUploadStore.hasPhotos && fastUploadStore.photos.length > 0) {
    return fastUploadStore.photos[0]?.file || null
  }
  
  return null
})

// Form handlers
function handlePhotoChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (file) {
    store.setPhoto(file);
  }
}

async function handleSubmit() {
  if (!canSubmit.value) return;

  try {
    // If we have fast upload photo but no photo in store, set the fast upload photo
    if (hasExistingPhoto.value && !store.hasPhoto && fastUploadPhotoFile.value) {
      store.setPhoto(fastUploadPhotoFile.value);
    }
    
    const result = await store.submitLogbookEntry(artworkId.value);
    
    if (result.success) {
      // Redirect to artwork page with success parameter to show toast there
      router.push({
        path: `/artwork/${artworkId.value}`,
        query: { submitted: 'true' }
      });
    }
  } catch (error) {
    console.error('Submission failed:', error);
    // Error handling is managed by the store
  }
}

function handleConsentChanged(consents: any) {
  consentCheckboxes.value = consents;
}

function goBack() {
  router.back();
}

// Watch for artwork ID changes
watch(artworkId, (newId: string) => {
  if (newId) {
    store.fetchArtworkDetails(newId);
  }
}, { immediate: true });

// Lifecycle
onMounted(() => {
  // Load fast upload session data from sessionStorage if available
  if (isFromFastUpload.value) {
    const sessionData = sessionStorage.getItem('fast-upload-session');
    if (sessionData) {
      try {
        fastUploadSessionData.value = JSON.parse(sessionData);
        console.log('[LOGBOOK DEBUG] Loaded session data from sessionStorage:', {
          photosCount: fastUploadSessionData.value?.photos?.length || 0,
          firstPhotoName: fastUploadSessionData.value?.photos?.[0]?.name
        });
      } catch (error) {
        console.error('[LOGBOOK] Failed to parse fast upload session data:', error);
        fastUploadSessionData.value = null;
      }
    }
    
    // Auto-set the fast upload photo in the store if available from Pinia store
    if (fastUploadPhotoFile.value && !store.hasPhoto) {
      console.log('[LOGBOOK DEBUG] Auto-setting fast upload photo in store from Pinia');
      store.setPhoto(fastUploadPhotoFile.value);
    }
  }
  
  console.log('[LOGBOOK DEBUG] Component mounted:', {
    isFromFastUpload: isFromFastUpload.value,
    hasExistingPhoto: hasExistingPhoto.value,
    fastUploadPhotoName: fastUploadPhotoName.value,
    source: route.query.source,
    sessionDataLoaded: !!fastUploadSessionData.value
  })
  
  // Clear any previous form data
  store.clearForm();
  store.clearErrors();
  
  // Note: Fast upload photos are already uploaded to backend during fast upload
  // We don't try to set File objects since they don't persist across navigation
  if (hasExistingPhoto.value) {
    console.log('[LOGBOOK] Fast upload photo detected:', fastUploadPhotoName.value)
    console.log('[LOGBOOK] Photo was already uploaded during fast upload process')
  }
  
  if (artworkId.value) {
    store.fetchArtworkDetails(artworkId.value);
  }
});
</script>

<template>
  <div data-testid="logbook-submission-view" class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      
      <!-- Header with visual distinction -->
      <div data-testid="submission-header" class="bg-green-600 text-white px-6 py-4 rounded-t-lg">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">Log a Visit</h1>
            <p data-testid="log-visit-banner" class="text-green-100 mt-1">Document your visit to this artwork</p>
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
        <div v-if="store.isLoadingArtwork" data-testid="loading-spinner" class="p-8 text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p class="mt-4 text-gray-600">Loading artwork details...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="store.artworkError" data-testid="error-state" class="p-8 text-center">
          <ExclamationTriangleIcon class="h-12 w-12 text-red-500 mx-auto" />
          <h3 class="mt-4 text-lg font-medium text-gray-900">Failed to Load Artwork</h3>
          <p class="mt-2 text-gray-600">{{ store.artworkError }}</p>
          <button
            @click="store.fetchArtworkDetails(artworkId)"
            data-testid="try-again-button"
            class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>

        <!-- Cooldown State -->
        <div v-else-if="store.isOnCooldown" data-testid="cooldown-state" class="p-8 text-center">
          <CheckCircleIcon class="h-12 w-12 text-green-500 mx-auto" />
          <h3 class="mt-4 text-lg font-medium text-gray-900">Recent Visit Recorded</h3>
          <p class="mt-2 text-gray-600">{{ store.cooldownMessage }}</p>
          <button
            @click="goBack"
            data-testid="cooldown-go-back"
            class="mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Go Back
          </button>
        </div>

        <!-- Main Form -->
        <div v-else-if="store.artwork" data-testid="main-form" class="p-6">
          <!-- Artwork Info -->
          <div data-testid="artwork-info" class="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 class="text-lg font-semibold text-gray-900 mb-2">
              {{ store.artwork.title || 'Untitled Artwork' }}
            </h2>
            <div class="text-sm text-gray-600 space-y-1">
              <p v-if="store.artwork.artist_name">Artist: {{ store.artwork.artist_name }}</p>
              <p>Type: {{ store.artwork.type_name?.replace(/_/g, ' ') }}</p>
            </div>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Photo Upload (Required) -->
            <div data-testid="photo-upload-section">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Photo of your visit <span class="text-red-500">*</span>
              </label>
              <p class="text-sm text-gray-600 mb-3">
                <span v-if="!isFromFastUpload">Upload a photo showing the artwork as proof of your visit</span>
                <span v-else>Photo from your fast upload session has been automatically selected</span>
              </p>

              <!-- Fast Upload Photo Preview and Notice -->
              <div v-if="hasExistingPhoto" class="space-y-4">
                <!-- Preview Image -->
                <div v-if="fastUploadPhotoPreview" class="relative">
                  <img
                    :src="fastUploadPhotoPreview"
                    alt="Fast upload photo preview"
                    class="w-full h-64 object-cover rounded-lg"
                  />
                  <div class="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                    Fast Upload Photo
                  </div>
                </div>
                
                <!-- Notice Banner -->
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div class="flex items-start">
                    <CheckCircleIcon class="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h4 class="text-sm font-medium text-green-900">Photo Selected</h4>
                      <p class="text-sm text-green-700 mt-1">
                        Photo "{{ fastUploadPhotoName }}" from your fast upload session is ready for submission.
                      </p>
                    </div>
                  </div>
                </div>
                
                <!-- Option to change photo -->
                <div class="text-center">
                  <input
                    type="file"
                    accept="image/*"
                    @change="handlePhotoChange"
                    class="hidden"
                    id="photo-upload-change"
                  />
                  <label
                    for="photo-upload-change"
                    class="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Use Different Photo
                  </label>
                </div>
              </div>

              <!-- Normal Photo Upload (when not from fast upload and no photo selected) -->
              <div v-else-if="!store.selectedPhoto" data-testid="photo-input" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
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

              <!-- Photo Preview (when photo is selected) -->
              <div v-else data-testid="photo-preview" class="space-y-3">
                <div class="relative">
                  <img
                    v-if="store.photoPreview"
                    :src="store.photoPreview"
                    alt="Preview"
                    class="w-full h-64 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    @click="store.removePhoto"
                    data-testid="remove-photo-button"
                    class="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p class="text-sm text-gray-600">{{ store.selectedPhoto?.name }}</p>
              </div>
            </div>

            <!-- Condition Assessment -->
            <div data-testid="condition-section">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                What is the current condition? (Optional)
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50" :class="{ 'border-blue-500 bg-blue-50': store.condition === 'Good' }">
                  <input type="radio" v-model="store.condition" value="Good" class="sr-only" />
                  <div class="w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center" :class="{ 'border-blue-500': store.condition === 'Good' }">
                    <div v-if="store.condition === 'Good'" class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <span class="text-sm">Good</span>
                </label>
                <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50" :class="{ 'border-blue-500 bg-blue-50': store.condition === 'Damaged' }">
                  <input type="radio" v-model="store.condition" value="Damaged" class="sr-only" />
                  <div class="w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center" :class="{ 'border-blue-500': store.condition === 'Damaged' }">
                    <div v-if="store.condition === 'Damaged'" class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <span class="text-sm">Damaged</span>
                </label>
                <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50" :class="{ 'border-blue-500 bg-blue-50': store.condition === 'Missing' }">
                  <input type="radio" v-model="store.condition" value="Missing" class="sr-only" />
                  <div class="w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center" :class="{ 'border-blue-500': store.condition === 'Missing' }">
                    <div v-if="store.condition === 'Missing'" class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <span class="text-sm">Missing</span>
                </label>
                <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50" :class="{ 'border-blue-500 bg-blue-50': store.condition === 'Removed' }">
                  <input type="radio" v-model="store.condition" value="Removed" class="sr-only" />
                  <div class="w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center" :class="{ 'border-blue-500': store.condition === 'Removed' }">
                    <div v-if="store.condition === 'Removed'" class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <span class="text-sm">Removed</span>
                </label>
              </div>
            </div>

            <!-- Help Us Improve This Listing -->
            <div data-testid="improvement-section">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Help Us Improve This Listing</h3>
              <p class="text-sm text-gray-600 mb-4">
                Fill in any missing information you know about this artwork
              </p>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Only show fields if they're missing from the artwork -->
                <div v-if="!store.artwork.type_name || store.artwork.type_name === 'unknown'">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Artwork Type</label>
                  <input
                    type="text"
                    v-model="store.artworkType"
                    placeholder="e.g., sculpture, mural, statue"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div v-if="!store.artwork.tags_parsed?.access">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Access</label>
                  <select v-model="store.access" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select access level</option>
                    <option value="public">Public</option>
                    <option value="restricted">Restricted</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div v-if="!store.artwork.artist_name">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Artist</label>
                  <input
                    type="text"
                    v-model="store.artist"
                    placeholder="Artist name"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div v-if="!store.artwork.tags_parsed?.material">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Material</label>
                  <input
                    type="text"
                    v-model="store.material"
                    placeholder="e.g., bronze, stone, paint"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <!-- Submit Error -->
            <div v-if="store.submitError" class="p-4 bg-red-50 border border-red-200 rounded-md">
              <div class="flex">
                <ExclamationTriangleIcon class="h-5 w-5 text-red-400" />
                <div class="ml-3">
                  <p class="text-sm text-red-800">{{ store.submitError }}</p>
                </div>
              </div>
            </div>

            <!-- Consent Section -->
            <div class="mt-8">
              <ConsentSection
                ref="consentSection"
                consent-version="2025-01-01"
                @consentChanged="handleConsentChanged"
              />
            </div>

            <!-- Submit Buttons -->
            <div class="flex space-x-4">
              <button
                type="button"
                @click="goBack"
                data-testid="cancel-button"
                class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="!canSubmit"
                data-testid="submit-button"
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="store.isSubmitting" class="flex items-center justify-center">
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