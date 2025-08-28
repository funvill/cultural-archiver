<template>
  <div class="photo-upload bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">
        Upload Photos
      </h2>
      <p class="text-gray-600">
        Share photos of public art to contribute to the cultural archive.
        You can upload up to 3 photos per submission.
      </p>
    </div>

    <!-- Consent Check -->
    <div v-if="!hasValidConsent" class="mb-6">
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <h3 class="text-sm font-medium text-yellow-800 mb-2">
          Consent Required
        </h3>
        <p class="text-sm text-yellow-700 mb-3">
          Before uploading photos, you need to provide consent for legal use
          and distribution of your contributions.
        </p>
        <button
          @click="showConsentForm = true"
          class="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
        >
          Provide Consent
        </button>
      </div>
    </div>

    <!-- Upload Interface -->
    <div v-if="hasValidConsent" class="space-y-6">
      <!-- File Drop Zone -->
      <div
        @drop="handleDrop"
        @dragover.prevent
        @dragenter.prevent
        class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
        :class="{ 'border-blue-500 bg-blue-50': isDragging }"
      >
        <svg
          class="mx-auto h-12 w-12 text-gray-400"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <div class="mt-4">
          <p class="text-lg font-medium text-gray-900">
            Drop your photos here, or
            <button
              @click="triggerFileInput"
              class="text-blue-600 hover:text-blue-800 underline"
            >
              browse
            </button>
          </p>
          <p class="text-sm text-gray-600 mt-2">
            Supports JPEG, PNG, WebP, and HEIC files up to 15MB each
          </p>
        </div>
      </div>

      <!-- Hidden File Input -->
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
        @change="handleFileSelect"
        class="hidden"
      />

      <!-- Selected Files Preview -->
      <div v-if="selectedFiles.length > 0" class="space-y-4">
        <h3 class="text-lg font-medium text-gray-900">
          Selected Photos ({{ selectedFiles.length }}/3)
        </h3>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="(file, index) in selectedFiles"
            :key="file.id"
            class="relative bg-gray-50 rounded-lg overflow-hidden"
          >
            <!-- Image Preview -->
            <div class="aspect-w-16 aspect-h-9">
              <img
                :src="file.preview"
                :alt="file.name"
                class="w-full h-32 object-cover"
              />
            </div>
            
            <!-- File Info -->
            <div class="p-3">
              <p class="text-sm font-medium text-gray-900 truncate">
                {{ file.name }}
              </p>
              <p class="text-xs text-gray-600">
                {{ formatFileSize(file.size) }}
              </p>
              
              <!-- EXIF Info -->
              <div v-if="file.exifData" class="mt-2 text-xs text-gray-600">
                <p v-if="file.exifData.gps">
                  📍 GPS: {{ file.exifData.gps.latitude?.toFixed(4) }}, {{ file.exifData.gps.longitude?.toFixed(4) }}
                </p>
                <p v-if="file.exifData.camera?.make">
                  📷 {{ file.exifData.camera.make }} {{ file.exifData.camera.model }}
                </p>
              </div>
            </div>
            
            <!-- Remove Button -->
            <button
              @click="removeFile(index)"
              class="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700 transition-colors"
            >
              ×
            </button>
            
            <!-- Upload Progress -->
            <div v-if="file.uploading" class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div class="text-white text-center">
                <svg class="animate-spin h-8 w-8 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-sm">Uploading...</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Location Input -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium text-gray-900">
          Artwork Location
        </h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="latitude" class="block text-sm font-medium text-gray-700 mb-1">
              Latitude
            </label>
            <input
              id="latitude"
              v-model="locationData.latitude"
              type="number"
              step="any"
              placeholder="49.2827"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label for="longitude" class="block text-sm font-medium text-gray-700 mb-1">
              Longitude
            </label>
            <input
              id="longitude"
              v-model="locationData.longitude"
              type="number"
              step="any"
              placeholder="-123.1207"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <button
          @click="getCurrentLocation"
          :disabled="isGettingLocation"
          class="text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
        >
          {{ isGettingLocation ? 'Getting location...' : 'Use current location' }}
        </button>
      </div>

      <!-- Description -->
      <div>
        <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
          Description (Optional)
        </label>
        <textarea
          id="description"
          v-model="description"
          rows="3"
          maxlength="500"
          placeholder="Describe the artwork, its context, or any interesting details..."
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        ></textarea>
        <p class="text-xs text-gray-600 mt-1">
          {{ description.length }}/500 characters
        </p>
      </div>

      <!-- Error Messages -->
      <div v-if="errors.length > 0" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 class="text-sm font-medium text-red-800 mb-2">
          Please correct the following errors:
        </h3>
        <ul class="text-sm text-red-700 space-y-1">
          <li v-for="error in errors" :key="error">• {{ error }}</li>
        </ul>
      </div>

      <!-- Submit Button -->
      <div class="flex justify-end space-x-4">
        <button
          type="button"
          @click="$emit('cancel')"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="!canSubmit || isSubmitting"
          class="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="isSubmitting" class="flex items-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Submitting...
          </span>
          <span v-else>
            Submit Photos
          </span>
        </button>
      </div>
    </div>

    <!-- Consent Form Modal -->
    <div
      v-if="showConsentForm"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <div class="bg-white rounded-lg max-w-3xl w-full max-h-screen overflow-y-auto">
        <ConsentForm
          @submit="handleConsentSubmit"
          @cancel="showConsentForm = false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ConsentForm from './ConsentForm.vue'

// Component props
interface Props {
  apiBaseUrl?: string
  userToken?: string
}

const props = withDefaults(defineProps<Props>(), {
  apiBaseUrl: '/api'
})

// Component emits
interface Emits {
  (e: 'success', data: any): void
  (e: 'cancel'): void
  (e: 'error', error: string): void
}

const emit = defineEmits<Emits>()

// File interface
interface PhotoFile {
  id: string
  name: string
  size: number
  type: string
  file: File
  preview: string
  exifData?: any
  uploading?: boolean
}

// State
const selectedFiles = ref<PhotoFile[]>([])
const showConsentForm = ref(false)
const hasValidConsent = ref(false)
const isDragging = ref(false)
const isSubmitting = ref(false)
const isGettingLocation = ref(false)
const fileInput = ref<HTMLInputElement>()

const locationData = ref({
  latitude: null as number | null,
  longitude: null as number | null
})

const description = ref('')
const errors = ref<string[]>([])

// Constants
const MAX_FILES = 3
const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB
const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']

// Computed properties
const canSubmit = computed(() => {
  return selectedFiles.value.length > 0 &&
         locationData.value.latitude !== null &&
         locationData.value.longitude !== null &&
         hasValidConsent.value &&
         !isSubmitting.value
})

// Lifecycle
onMounted(() => {
  checkConsentStatus()
})

// Methods
async function checkConsentStatus() {
  try {
    // Check if user has valid consent
    // This would typically call an API endpoint
    // For now, we'll assume consent is needed
    hasValidConsent.value = false
  } catch (error) {
    console.error('Failed to check consent status:', error)
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) {
    addFiles(Array.from(input.files))
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
  
  if (event.dataTransfer?.files) {
    addFiles(Array.from(event.dataTransfer.files))
  }
}

async function addFiles(files: File[]) {
  errors.value = []
  
  for (const file of files) {
    if (selectedFiles.value.length >= MAX_FILES) {
      errors.value.push(`Maximum ${MAX_FILES} files allowed`)
      break
    }
    
    if (!validateFile(file)) {
      continue
    }
    
    const photoFile: PhotoFile = {
      id: generateId(),
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      preview: await createPreview(file)
    }
    
    // Extract EXIF data
    try {
      photoFile.exifData = await extractExifData(file)
    } catch (error) {
      console.warn('Failed to extract EXIF data:', error)
    }
    
    selectedFiles.value.push(photoFile)
  }
}

function validateFile(file: File): boolean {
  if (!SUPPORTED_TYPES.includes(file.type)) {
    errors.value.push(`Unsupported file type: ${file.name}`)
    return false
  }
  
  if (file.size > MAX_FILE_SIZE) {
    errors.value.push(`File too large: ${file.name} (max ${formatFileSize(MAX_FILE_SIZE)})`)
    return false
  }
  
  if (file.size === 0) {
    errors.value.push(`File is empty: ${file.name}`)
    return false
  }
  
  return true
}

function removeFile(index: number) {
  const file = selectedFiles.value[index]
  URL.revokeObjectURL(file.preview)
  selectedFiles.value.splice(index, 1)
}

async function createPreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.readAsDataURL(file)
  })
}

async function extractExifData(file: File): Promise<any> {
  // This would use an EXIF library like exifr
  // For now, return mock data
  return {
    gps: {
      latitude: 49.2827,
      longitude: -123.1207
    },
    camera: {
      make: 'Apple',
      model: 'iPhone 12 Pro'
    }
  }
}

function getCurrentLocation() {
  if (!navigator.geolocation) {
    errors.value.push('Geolocation is not supported by this browser')
    return
  }
  
  isGettingLocation.value = true
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locationData.value.latitude = position.coords.latitude
      locationData.value.longitude = position.coords.longitude
      isGettingLocation.value = false
    },
    (error) => {
      console.error('Geolocation error:', error)
      errors.value.push('Failed to get current location')
      isGettingLocation.value = false
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes
    }
  )
}

async function handleSubmit() {
  if (!canSubmit.value) return
  
  errors.value = []
  isSubmitting.value = true
  
  try {
    const formData = new FormData()
    
    // Add files
    selectedFiles.value.forEach((photoFile, index) => {
      formData.append(`photos`, photoFile.file)
    })
    
    // Add location data
    formData.append('latitude', locationData.value.latitude!.toString())
    formData.append('longitude', locationData.value.longitude!.toString())
    
    // Add description
    if (description.value.trim()) {
      formData.append('note', description.value.trim())
    }
    
    // Submit to API
    const response = await fetch(`${props.apiBaseUrl}/logbook`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${props.userToken}`
      },
      body: formData
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Upload failed')
    }
    
    const result = await response.json()
    emit('success', result)
    
  } catch (error) {
    console.error('Upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Upload failed'
    errors.value.push(errorMessage)
    emit('error', errorMessage)
  } finally {
    isSubmitting.value = false
  }
}

async function handleConsentSubmit(consentData: any) {
  try {
    // Submit consent to API
    const response = await fetch(`${props.apiBaseUrl}/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.userToken}`
      },
      body: JSON.stringify(consentData)
    })
    
    if (!response.ok) {
      throw new Error('Failed to submit consent')
    }
    
    hasValidConsent.value = true
    showConsentForm.value = false
    
  } catch (error) {
    console.error('Consent submission error:', error)
    errors.value.push('Failed to submit consent')
  }
}

// Utility functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}
</script>

<style scoped>
.photo-upload {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* Aspect ratio utilities for image previews */
.aspect-w-16 {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
}

.aspect-w-16 > img {
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

/* Drag and drop styling */
.border-dashed {
  border-style: dashed;
}

/* Loading animations */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Responsive grid adjustments */
@media (max-width: 640px) {
  .photo-upload {
    @apply p-4;
  }
  
  .grid-cols-3 {
    @apply grid-cols-1;
  }
}

/* Focus states for accessibility */
input:focus,
textarea:focus,
button:focus {
  @apply outline-none ring-2 ring-blue-500 ring-offset-2;
}

/* File input hidden styling */
input[type="file"] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
</style>