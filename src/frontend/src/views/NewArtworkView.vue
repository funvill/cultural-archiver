<script setup lang="ts">
/**
 * NewArtworkView - Third screen of the 3-screen fast workflow
 * Simplified form for adding artwork details after photo upload and location detection
 */
import { ref, onMounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MapPinIcon, CheckCircleIcon, ArrowLeftIcon, XMarkIcon } from '@heroicons/vue/24/outline';
// Reference icons to satisfy lint (template uses them)
void [MapPinIcon, CheckCircleIcon, ArrowLeftIcon, XMarkIcon];
import { useAuthStore } from '../stores/auth';
import { artworkSubmissionService } from '../services/artworkSubmission';
import type { Coordinates } from '../types';
import ConsentSection from '../components/FastWorkflow/ConsentSection.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Session data from fast upload
// Prefer in-memory Pinia store (contains previews) but fallback to sessionStorage
import { useFastUploadSessionStore } from '../stores/fastUploadSession';
// Lazy-load Leaflet when opening modal (dynamic import); CSS here so Vite bundles it once
// eslint-disable-next-line import/no-unresolved
import 'leaflet/dist/leaflet.css';
const fastStore = useFastUploadSessionStore();
const fastUploadSession = ref<{
  photos: Array<{id: string; name: string; preview?: string}>;
  location: Coordinates | null;
  detectedSources?: any;
} | null>(null);

// Form data
const formData = ref({
  title: '', // Optional per new requirement
  description: '',
  artist: '',
  materials: '',
  artworkType: '',
  access: '',
  condition: 'good',
  location: null as Coordinates | null,
  notes: '' // Removed from UI but keep for potential future use
});

// UI state
const isSubmitting = ref(false);
// Removed unused showLocationPicker flag from earlier design
const submitError = ref<string | null>(null);
const submitSuccess = ref(false);
const redirectCountdown = ref(5);

// Consent state
const consentCheckboxes = ref({
  ageVerification: false,
  cc0Licensing: false,
  publicCommons: false,
  freedomOfPanorama: false,
});

// Computed
const isFromFastUpload = computed(() => route.query.from === 'fast-upload');
const allConsentsAccepted = computed(() => {
  return Object.values(consentCheckboxes.value).every(Boolean);
});
const canSubmit = computed(() => {
  const photosLen = fastUploadSession.value?.photos ? fastUploadSession.value.photos.length : 0;
  return formData.value.location !== null && photosLen > 0 && allConsentsAccepted.value; // title no longer required, consent required
});

// Predefined options
const artworkTypes = [
  'Sculpture', 'Mural', 'Street Art', 'Monument', 'Installation',
  'Mosaic', 'Statue', 'Relief', 'Fountain', 'Architecture', 'tiny_library', 'Other'
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

// Map modal state
const showLocationModal = ref(false);
const tempLocation = ref<Coordinates | null>(null);

// Consent section ref
const consentSection = ref<InstanceType<typeof ConsentSection> | null>(null);

// Methods
async function handleSubmit() {
  if (!canSubmit.value) return;
  
  isSubmitting.value = true;
  submitError.value = null;
  
  try {
    // Ensure user token
    await authStore.ensureUserToken();
    
    // Prepare submission data
    const consentData = {
      ...consentCheckboxes.value,
      consentVersion: '2025-01-01', // Use current consent version
      consentedAt: new Date().toISOString(),
    };
    
    // Log consent data for audit trail
    console.log('Submitting with consent data:', consentData);
    
    const submission: any = {
      // Title optional now
      title: formData.value.title || undefined,
      description: formData.value.description || undefined,
      artist: formData.value.artist || undefined,
      materials: formData.value.materials || undefined,
      artworkType: formData.value.artworkType || undefined,
      access: formData.value.access || undefined,
      condition: formData.value.condition,
      latitude: formData.value.location!.latitude,
      longitude: formData.value.location!.longitude,
      // Notes removed from UI; send only if present (future)
      notes: undefined,
      // Include consent data
      consent: consentData,
  photos: fastStore.photos.map((p: { file?: File }) => p.file).filter((f: File | undefined): f is File => !!f)
    };

    // Guard: if photos missing (e.g. page reload wiped File objects), abort with message
    if (submission.photos.length === 0) {
      console.warn('[FAST SUBMIT] No in-memory file objects available. Fast store photo entries:', fastStore.photos.length);
      submitError.value = 'Photo data not available (likely page reload). Please go back and re-upload your photos.';
      isSubmitting.value = false;
      return;
    }
  console.info('[FAST SUBMIT] Submitting fast artwork with files:', submission.photos.map((f: File) => ({ name: f.name, size: f.size, type: f.type })));
    
    // Submit artwork
  await artworkSubmissionService.submitArtwork({
      userToken: authStore.token || authStore.getUserToken(),
      ...submission,
      photos: submission.photos,
    });
    
    submitSuccess.value = true;
    
    // Clear consent checkboxes and disable submit button
    consentSection.value?.resetConsents();
    
    // Scroll to top to show success notification
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Clear session data
    sessionStorage.removeItem('fast-upload-session');
    
    // Start countdown and redirect to map page after 5 seconds
    redirectCountdown.value = 5;
    const countdownInterval = setInterval(() => {
      redirectCountdown.value--;
      if (redirectCountdown.value <= 0) {
        clearInterval(countdownInterval);
        router.push('/');
      }
    }, 1000);
    
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

function handleConsentChanged(consents: any) {
  consentCheckboxes.value = consents;
}

function openLocationPicker() {
  tempLocation.value = formData.value.location ? { ...formData.value.location } : (fastUploadSession.value?.location || null);
  showLocationModal.value = true;
  // Initialize map after next tick
  // Use a short staged sequence so the modal has laid out before Leaflet measures the container.
  setTimeout(() => {
    initPickerMapWithVisibilityRetry();
  }, 50);
}

let pickerMap: any = null;
let leafletMod: any = null;
async function loadLeaflet() {
  if (leafletMod) return leafletMod;
  try {
    leafletMod = await import('leaflet');
    // Fix default icon paths (optional – avoids 404s if markers added later)
    if (leafletMod.Icon && (leafletMod.Icon.Default as any)) {
      const Default = leafletMod.Icon.Default as any;
      if (Default && Default.imagePath === undefined) {
        // Vite inlines images; this prevents broken marker icons if we later use them
        Default.mergeOptions({ imagePath: '' });
      }
    }
  } catch (e) {
    console.warn('Leaflet failed to load:', e);
  }
  return leafletMod;
}

async function initPickerMap(force = false) {
  if (typeof window === 'undefined' || !showLocationModal.value) return;
  const L = await loadLeaflet();
  if (!L) return;
  const container = document.getElementById('picker-map');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  if (!force && (rect.width === 0 || rect.height === 0)) {
    // Container not yet visible/sized – defer
    setTimeout(initPickerMap, 60);
    return;
  }
  if (pickerMap) {
    pickerMap.invalidateSize();
    return;
  }
  const center = tempLocation.value || { latitude: 49.2827, longitude: -123.1207 };
  pickerMap = L.map(container, { attributionControl: false }).setView([
    center.latitude,
    center.longitude,
  ], 18);
  const tileUrls = [
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    // Fallback (will only be used manually via console if needed)
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
  ];
  const primaryLayer = L.tileLayer(tileUrls[0], { maxZoom: 19 });
  primaryLayer.addTo(pickerMap);
  primaryLayer.on('tileerror', (e: any) => {
    console.warn('Primary tile layer error', e?.error || e);
  });
  pickerMap.on('move', () => {
    const c = pickerMap.getCenter();
    tempLocation.value = { latitude: c.lat, longitude: c.lng };
  });
  // Extra invalidate steps to combat hidden-render sizing issues
  nextTick(() => {
    requestAnimationFrame(() => pickerMap?.invalidateSize());
    setTimeout(() => pickerMap?.invalidateSize(), 250);
    setTimeout(() => pickerMap?.invalidateSize(), 1000);
  });
}

function initPickerMapWithVisibilityRetry(attempt = 0) {
  // Limit attempts to avoid runaway timers
  if (!showLocationModal.value) return;
  if (attempt > 10) {
    console.warn('[MAP PICKER] Forcing map init after repeated size retries');
    initPickerMap(true);
    return;
  }
  const container = document.getElementById('picker-map');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  if (rect.width < 50 || rect.height < 50) {
    setTimeout(() => initPickerMapWithVisibilityRetry(attempt + 1), 80);
  } else {
    initPickerMap();
  }
}

function cancelLocationModal() {
  showLocationModal.value = false;
  pickerMap?.remove?.();
  pickerMap = null;
}

function confirmLocationModal() {
  if (tempLocation.value) {
    formData.value.location = { ...tempLocation.value };
  }
  cancelLocationModal();
}

onMounted(async () => {
  // Load fast upload session data
  // Prefer in-memory store (has previews). Fallback to sessionStorage JSON.
  if (fastStore.photos.length > 0) {
    fastUploadSession.value = { photos: fastStore.photos as any, location: fastStore.location };
    if (fastStore.location) {
      formData.value.location = fastStore.location;
    }
  } else {
    const sessionData = sessionStorage.getItem('fast-upload-session');
    if (sessionData && isFromFastUpload.value) {
      try {
        const parsed = JSON.parse(sessionData);
        fastUploadSession.value = parsed;
        if (parsed?.location) formData.value.location = parsed.location;
      } catch (error) {
        console.error('Failed to load session data:', error);
        router.push('/add');
      }
    } else if (isFromFastUpload.value) {
      router.push('/add');
    }
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
              <p class="text-green-600 text-sm mt-1">
                Submission received and pending review. 
                <span class="font-medium">Redirecting to map in {{ redirectCountdown }} seconds...</span>
              </p>
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
                
                <!-- Title (Optional) -->
                <div class="mb-4">
                  <label for="title" class="block text-sm font-medium text-gray-700 mb-2">
                    Artwork Title <span class="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="title"
                    v-model="formData.title"
                    type="text"
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

              <!-- Notes removed per new simplified workflow -->

              <!-- Consent Section -->
              <div class="mt-8">
                <ConsentSection
                  ref="consentSection"
                  consent-version="2025-01-01"
                  @consentChanged="handleConsentChanged"
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
                  :src="photo.preview || ''"
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
              <li>• A title helps but is optional</li>
              <li>• Include artist information if known</li>
              <li>• Describe unique features or context</li>
              <li>• Note the condition accurately</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Location Picker Modal -->
    <div v-if="showLocationModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50" @click="cancelLocationModal" />
      <div class="relative bg-white w-full max-w-xl rounded-lg shadow-xl overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b">
          <h3 class="text-lg font-semibold text-gray-900">Select Location</h3>
          <button @click="cancelLocationModal" class="p-2 rounded hover:bg-gray-100"><XMarkIcon class="w-5 h-5" /></button>
        </div>
        <div class="relative">
          <div id="picker-map" class="h-80 w-full"></div>
          <!-- Center Pin (fixed overlay while map pans) -->
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center z-10" aria-hidden="true">
            <div class="relative -mt-5 flex flex-col items-center">
              <!-- Pin icon -->
              <svg class="w-9 h-9 text-red-600 drop-shadow animate-pin-bounce" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" d="M12 2.25c-3.728 0-6.75 2.97-6.75 6.64 0 1.586.68 3.225 1.57 4.751.884 1.515 2.012 2.945 2.992 4.094a32.724 32.724 0 002.01 2.194l.012.012.002.002a.75.75 0 001.07 0s.005-.005.012-.012a32.685 32.685 0 002.01-2.194c.98-1.149 2.108-2.579 2.992-4.094.89-1.526 1.57-3.165 1.57-4.751 0-3.67-3.022-6.64-6.75-6.64zm0 9.19a2.55 2.55 0 100-5.1 2.55 2.55 0 000 5.1z" clip-rule="evenodd" />
              </svg>
              <!-- Crosshair ring -->
              <div class="absolute top-full mt-1 w-6 h-6 border-2 border-red-400/60 rounded-full"></div>
            </div>
          </div>
        </div>
        <div class="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-600">
          <div>
            <div>Lat: {{ tempLocation?.latitude?.toFixed(6) || '...' }}</div>
            <div>Lng: {{ tempLocation?.longitude?.toFixed(6) || '...' }}</div>
          </div>
          <div class="space-x-2">
            <button @click="cancelLocationModal" class="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
            <button @click="confirmLocationModal" class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Update Location</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional scoped styles can be added here when needed */
</style>
<style>
/* Ensure Leaflet internal panes render above white background in modal */
#picker-map.leaflet-container {
  background: #f1f5f9; /* light slate */
  outline: none;
  min-height: 20rem;
}
#picker-map .leaflet-tile-pane img {
  image-rendering: auto;
}
.animate-pin-bounce {
  animation: pin-bounce 1.2s ease-in-out infinite;
  transform-origin: 50% 90%;
}
@keyframes pin-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
</style>