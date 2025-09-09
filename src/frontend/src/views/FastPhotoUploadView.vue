<script setup lang="ts">
/**
 * FastPhotoUploadView - First screen of the new 3-screen workflow
 * 1. User uploads photos
 * 2. System detects location from EXIF/browser/IP
 * 3. Automatically redirects to search results with nearby artworks
 */
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { 
  PhotoIcon, 
  MapPinIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import { useGeolocation } from '../composables/useGeolocation';
import { extractExifData, createImagePreview } from '../utils/image';
import type { ExifData } from '../utils/image';
import type { Coordinates } from '../types';
import { useFastUploadSessionStore } from '../stores/fastUploadSession';

const router = useRouter();
const { getCurrentPosition } = useGeolocation();

// State for photo uploads
interface PhotoFile {
  id: string;
  name: string;
  file: File;
  preview: string;
  exifData?: ExifData;
}

const selectedFiles = ref<PhotoFile[]>([]);
const isDragOver = ref(false);
const isProcessing = ref(false);

// State for location detection
const locationSources = ref({
  exif: { detected: false, error: false, coordinates: null as Coordinates | null },
  browser: { detected: false, error: false, coordinates: null as Coordinates | null },
  ip: { detected: false, error: false, coordinates: null as Coordinates | null }
});

const finalLocation = ref<Coordinates | null>(null);
const hasNavigated = ref(false);
const showManualLocation = ref(false);

// File input ref
const fileInputRef = ref<HTMLInputElement>();

// Handle file selection
async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    await processFiles(Array.from(target.files));
  }
}

// Handle drag and drop
function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragOver.value = true;
}

function handleDragLeave() {
  isDragOver.value = false;
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragOver.value = false;
  
  const files = Array.from(event.dataTransfer?.files || []);
  await processFiles(files);
}

// Process uploaded files
async function processFiles(files: File[]) {
  isProcessing.value = true;
  
  const imageFiles = files.filter(file => file.type.startsWith('image/'));
  
  for (const file of imageFiles) {
    try {
      const preview = await createImagePreview(file);
      const exifData = await extractExifData(file);
      
      const photoFile: PhotoFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        file,
        preview,
        exifData
      };
      
      selectedFiles.value.push(photoFile);
      
      // Check for EXIF location data
      if (exifData.latitude && exifData.longitude && !locationSources.value.exif.detected) {
        locationSources.value.exif = {
          detected: true,
          error: false,
          coordinates: {
            latitude: exifData.latitude,
            longitude: exifData.longitude
          }
        };
        finalLocation.value = locationSources.value.exif.coordinates;
      }
    } catch (error) {
      console.error('Failed to process file:', file.name, error);
    }
  }
  
  isProcessing.value = false;
  
  // Start location detection if no EXIF location found
  if (!locationSources.value.exif.detected) {
    await detectLocation();
  }
}

// Detect location from browser and IP
async function detectLocation() {
  // Try browser geolocation
  try {
    const browserCoords = await getCurrentPosition();
    locationSources.value.browser = {
      detected: true,
      error: false,
      coordinates: browserCoords
    };
    if (!finalLocation.value) {
      finalLocation.value = browserCoords;
    }
  } catch (error) {
    locationSources.value.browser = {
      detected: false,
      error: true,
      coordinates: null
    };
  }
  
  // IP-based location is typically handled server-side
  // For now, mark as not available unless we implement an IP geolocation service
  locationSources.value.ip = {
    detected: false,
    error: true,
    coordinates: null
  };
}

// Remove a photo
function removePhoto(photoId: string) {
  selectedFiles.value = selectedFiles.value.filter((photo: PhotoFile) => photo.id !== photoId);
  
  // If we removed the photo that had EXIF location, try to detect again
  const hasExifLocation = selectedFiles.value.some((photo: PhotoFile) => 
    photo.exifData?.latitude && photo.exifData?.longitude
  );
  
  if (!hasExifLocation && locationSources.value.exif.detected) {
    locationSources.value.exif = { detected: false, error: false, coordinates: null };
    finalLocation.value = locationSources.value.browser.coordinates || null;
  }
}

// Proceed to search results (auto-triggered)
function proceedToSearch() {
  if (selectedFiles.value.length === 0) return;
  if (!finalLocation.value) return;
  if (hasNavigated.value) return;
  hasNavigated.value = true;

  const store = useFastUploadSessionStore();
  // Build metadata including preview for in-memory store (better UX on next screen)
  // We'll strip previews before persisting to sessionStorage to avoid quota issues
  const metaWithPreview = selectedFiles.value.map((photo: PhotoFile) => ({
    id: photo.id,
    name: photo.name,
    preview: photo.preview,
    exifLat: photo.exifData?.latitude ?? undefined,
    exifLon: photo.exifData?.longitude ?? undefined,
  file: photo.file,
  }));
  // Lightweight version (no previews) for sessionStorage only
  const meta = metaWithPreview.map((p: typeof metaWithPreview[number]) => ({ id: p.id, name: p.name, exifLat: p.exifLat, exifLon: p.exifLon }));

  const payload = {
    photos: metaWithPreview,
    location: finalLocation.value,
    detectedSources: locationSources.value,
  };

  // Cast to align with store expected type (undefined allowed due to optional chain handling)
  store.setSession(payload as any);

  // Attempt to persist minimal payload to sessionStorage with safety checks
  try {
  const json = JSON.stringify({ ...payload, photos: meta });
    // Guard against very large payloads (arbitrary 200kB limit)
    if (json.length < 200_000) {
      sessionStorage.setItem('fast-upload-session', json);
    } else {
      // Fallback: store only location
      sessionStorage.setItem(
        'fast-upload-session',
    JSON.stringify({ photos: meta.slice(0, 5), location: payload.location })
      );
    }
  } catch (e) {
    console.warn('Failed to persist fast upload session (quota or serialization issue):', e);
    // Best-effort: store just location if possible
    try {
      sessionStorage.setItem(
        'fast-upload-session',
    JSON.stringify({ photos: meta.slice(0, 3), location: payload.location })
      );
    } catch {}
  }

  const query = new URLSearchParams({ mode: 'photo', source: 'fast-upload' });
  if (finalLocation.value) {
    query.set('lat', finalLocation.value.latitude.toString());
    query.set('lng', finalLocation.value.longitude.toString());
  }
  router.push(`/search?${query.toString()}`);
}

// Trigger file input
function triggerFileInput() {
  fileInputRef.value?.click();
}

// Show manual location picker
function showManualLocationPicker() {
  showManualLocation.value = true;
  // TODO: Implement map picker component
}

// Attempt automatic navigation when conditions satisfied
function maybeAutoNavigate() {
  if (!isProcessing.value && selectedFiles.value.length > 0 && finalLocation.value && !hasNavigated.value) {
    proceedToSearch();
  }
}

// Watch relevant sources
watch([finalLocation, () => selectedFiles.value.length, isProcessing], () => {
  maybeAutoNavigate();
});
</script>

<template>
  <div class="fast-photo-upload min-h-screen bg-gray-50 py-8 px-4">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Add Artwork</h1>
        <p class="text-lg text-gray-600">
          Upload photos and we'll automatically search for nearby artworks
        </p>
      </div>

      <!-- Step 1: Photo Upload -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <div class="flex items-center mb-4">
          <div class="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full mr-3">
            <span class="text-sm font-bold">1</span>
          </div>
          <h2 class="text-xl font-semibold text-gray-900">Upload Photos</h2>
        </div>

        <!-- Drag and Drop Area -->
        <div
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @click="triggerFileInput"
          class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50"
          :class="{
            'border-blue-400 bg-blue-50': isDragOver,
            'border-green-400 bg-green-50': selectedFiles.length > 0
          }"
        >
          <PhotoIcon class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p class="text-lg font-medium text-gray-700 mb-2">
            {{ selectedFiles.length > 0 ? `${selectedFiles.length} photo(s) selected` : 'Drop photos here or click to select' }}
          </p>
          <p class="text-sm text-gray-500">
            Supports JPG, PNG, WebP up to 10MB each
          </p>
          
          <input
            ref="fileInputRef"
            type="file"
            multiple
            accept="image/*"
            @change="handleFileSelect"
            class="hidden"
          />
        </div>

        <!-- Selected Photos Preview -->
        <div v-if="selectedFiles.length > 0" class="mt-6">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Selected Photos</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div
              v-for="photo in selectedFiles"
              :key="photo.id"
              class="relative group"
            >
              <img
                :src="photo.preview"
                :alt="photo.name"
                class="w-full h-24 object-cover rounded-lg"
              />
              <button
                @click.stop="removePhoto(photo.id)"
                class="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XMarkIcon class="w-4 h-4" />
              </button>
              <div class="absolute bottom-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 rounded">
                {{ photo.name.length > 15 ? photo.name.substring(0, 12) + '...' : photo.name }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Location Detection -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-6" v-if="selectedFiles.length > 0">
        <div class="flex items-center mb-4">
          <div class="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full mr-3">
            <span class="text-sm font-bold">2</span>
          </div>
          <h2 class="text-xl font-semibold text-gray-900">Detecting Location</h2>
        </div>

        <div class="space-y-3">
          <!-- EXIF Location Detection -->
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center">
              <PhotoIcon class="w-5 h-5 text-gray-500 mr-3" />
              <span class="text-sm font-medium text-gray-700">Photo GPS Data</span>
            </div>
            <div class="flex items-center">
              <CheckCircleIcon 
                v-if="locationSources.exif.detected" 
                class="w-5 h-5 text-green-500 mr-2" 
              />
              <ExclamationTriangleIcon 
                v-else 
                class="w-5 h-5 text-red-500 mr-2" 
              />
              <span class="text-sm text-gray-600">
                {{ locationSources.exif.detected ? 'Found' : 'Not available' }}
              </span>
            </div>
          </div>

          <!-- Browser Location Detection -->
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center">
              <MapPinIcon class="w-5 h-5 text-gray-500 mr-3" />
              <span class="text-sm font-medium text-gray-700">Browser Location</span>
            </div>
            <div class="flex items-center">
              <CheckCircleIcon 
                v-if="locationSources.browser.detected" 
                class="w-5 h-5 text-green-500 mr-2" 
              />
              <ExclamationTriangleIcon 
                v-else 
                class="w-5 h-5 text-red-500 mr-2" 
              />
              <span class="text-sm text-gray-600">
                {{ locationSources.browser.detected ? 'Detected' : (locationSources.browser.error ? 'Denied' : 'Detecting...') }}
              </span>
            </div>
          </div>

          <!-- IP Location Detection -->
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-gray-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.559-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.559.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clip-rule="evenodd" />
              </svg>
              <span class="text-sm font-medium text-gray-700">IP Address Location</span>
            </div>
            <div class="flex items-center">
              <ExclamationTriangleIcon class="w-5 h-5 text-red-500 mr-2" />
              <span class="text-sm text-gray-600">Not available</span>
            </div>
          </div>
        </div>

        <!-- Manual Location Button -->
        <div class="mt-4 text-center">
          <button
            @click="showManualLocationPicker"
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <MapPinIcon class="w-4 h-4 mr-2" />
            Set Location Manually
          </button>
        </div>

        <!-- Current Location Display -->
        <div v-if="finalLocation" class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-center">
            <CheckCircleIcon class="w-5 h-5 text-green-500 mr-2" />
            <span class="text-sm font-medium text-green-700">Location detected:</span>
            <span class="text-sm text-green-600 ml-2">
              {{ finalLocation.latitude.toFixed(6) }}, {{ finalLocation.longitude.toFixed(6) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Auto navigation status -->
      <div class="text-center" v-if="selectedFiles.length > 0 && !hasNavigated">
        <p class="text-sm text-gray-500" v-if="!finalLocation">Detecting location...</p>
        <p class="text-sm text-gray-500" v-else>Loading nearby artworks...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styles can be added here if needed */
</style>