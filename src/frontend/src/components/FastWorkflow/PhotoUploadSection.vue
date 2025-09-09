<!--
  Photo Upload Section for Fast Photo-First Workflow
  Handles photo uploads with preview and EXIF extraction
-->

<script setup lang="ts">
import { ref } from 'vue';
import {
  PhotoIcon,
  XMarkIcon,
  MapPinIcon,
  ClockIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';
import type { SubmissionPhoto } from '../../stores/artworkSubmission';

interface Props {
  photos: SubmissionPhoto[];
}

interface UploadProgress {
  name: string;
  percent: number;
  status: 'processing' | 'extracting' | 'complete' | 'error';
}

const props = defineProps<Props>();
const emit = defineEmits<{
  photosAdded: [files: File[]];
  photoRemoved: [index: number];
}>();

// Local state
const isDragging = ref(false);
const uploadProgress = ref<UploadProgress[]>([]);
const uploadErrors = ref<string[]>([]);

// File validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Methods
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    processFiles(Array.from(input.files));
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  
  if (event.dataTransfer?.files) {
    processFiles(Array.from(event.dataTransfer.files));
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
}

function handleDragEnter(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault();
  // Only set to false if leaving the entire drop area
  const currentTarget = event.currentTarget as Element;
  const relatedTarget = event.relatedTarget as Node | null;
  if (!currentTarget?.contains(relatedTarget)) {
    isDragging.value = false;
  }
}

async function processFiles(files: File[]) {
  uploadErrors.value = [];
  const validFiles: File[] = [];
  
  // Validate files
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      uploadErrors.value.push(`${file.name}: Unsupported file type. Use JPG, PNG, or WebP.`);
      continue;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      uploadErrors.value.push(`${file.name}: File too large. Maximum size is 10MB.`);
      continue;
    }
    
    validFiles.push(file);
  }
  
  if (validFiles.length === 0) return;
  
  // Initialize progress tracking
  uploadProgress.value = validFiles.map(file => ({
    name: file.name,
    percent: 0,
    status: 'processing' as const,
  }));
  
  try {
    // Process files with simulated progress
    for (let i = 0; i < validFiles.length; i++) {
      const progress = uploadProgress.value[i];
      if (!progress) continue;
      
      // Simulate processing progress
      progress.status = 'processing';
      progress.percent = 20;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      progress.status = 'extracting';
      progress.percent = 60;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      progress.percent = 100;
      progress.status = 'complete';
    }
    
    // Emit the files to parent
    emit('photosAdded', validFiles);
    
    // Clear progress after a delay
    setTimeout(() => {
      uploadProgress.value = [];
    }, 1000);
    
  } catch (error) {
    console.error('Error processing files:', error);
    uploadErrors.value.push('Failed to process some files. Please try again.');
    uploadProgress.value = [];
  }
}

function removePhoto(index: number) {
  emit('photoRemoved', index);
}

function clearAll() {
  for (let i = props.photos.length - 1; i >= 0; i--) {
    emit('photoRemoved', i);
  }
}

function formatDate(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return 'Unknown date';
  }
}
</script>

<template>
  <div class="photo-upload-section">
    <div class="mb-6">
      <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Upload Photos
      </h4>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Add photos of the cultural artwork. We'll try to extract location data from your photos automatically.
      </p>
    </div>

    <!-- Upload Area -->
    <div 
      class="upload-area border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center transition-colors"
      :class="{ 
        'border-blue-500 bg-blue-50 dark:bg-blue-900/20': isDragging,
        'hover:border-gray-400 dark:hover:border-gray-500': !isDragging 
      }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
    >
      <PhotoIcon class="w-12 h-12 text-gray-400 mx-auto mb-4" />
      
      <div class="space-y-2">
        <p class="text-lg font-medium text-gray-900 dark:text-white">
          Drop photos here or click to select
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-300">
          Supports JPG, PNG, WebP up to 10MB each
        </p>
      </div>
      
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        @change="handleFileSelect"
      />
      
      <button
        type="button"
        @click="(($refs.fileInput as HTMLInputElement)?.click())"
        class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Select Photos
      </button>
    </div>

    <!-- Upload Progress -->
    <div v-if="uploadProgress.length > 0" class="mt-6">
      <h5 class="font-medium text-gray-900 dark:text-white mb-3">Processing Photos</h5>
      <div class="space-y-2">
        <div 
          v-for="progress in uploadProgress" 
          :key="progress.name"
          class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <div class="flex-1">
            <div class="flex justify-between items-center mb-1">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ progress.name }}</span>
              <span class="text-xs text-gray-500">{{ progress.status }}</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                :style="{ width: `${progress.percent}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Photo Previews -->
    <div v-if="photos.length > 0" class="mt-6">
      <div class="flex items-center justify-between mb-4">
        <h5 class="font-medium text-gray-900 dark:text-white">
          Uploaded Photos ({{ photos.length }})
        </h5>
        <button
          v-if="photos.length > 0"
          @click="clearAll"
          class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        >
          Clear All
        </button>
      </div>
      
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div 
          v-for="(photo, index) in photos" 
          :key="index"
          class="relative group aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
        >
          <img 
            :src="photo.url"
            :alt="`Photo ${index + 1}`"
            class="w-full h-full object-cover"
            loading="lazy"
          />
          
          <!-- Remove Button -->
          <button
            @click="removePhoto(index)"
            class="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove photo"
          >
            <XMarkIcon class="w-4 h-4" />
          </button>
          
          <!-- EXIF Info -->
          <div v-if="photo.exifData" class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-2 text-xs">
            <div v-if="photo.exifData.lat && photo.exifData.lon" class="flex items-center">
              <MapPinIcon class="w-3 h-3 mr-1" />
              <span>Location detected</span>
            </div>
            <div v-if="photo.exifData.timestamp" class="flex items-center mt-1">
              <ClockIcon class="w-3 h-3 mr-1" />
              <span>{{ formatDate(photo.exifData.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Tips -->
    <div v-if="photos.length === 0" class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h5 class="flex items-center font-medium text-blue-900 dark:text-blue-100 mb-2">
        <InformationCircleIcon class="w-5 h-5 mr-2" />
        Photo Tips
      </h5>
      <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1">
        <li>• Photos with GPS location data will help us place the artwork automatically</li>
        <li>• Take clear, well-lit photos that show the artwork clearly</li>
        <li>• Multiple angles and close-ups help with identification</li>
        <li>• We'll check for similar artworks to prevent duplicates</li>
      </ul>
    </div>

    <!-- Error Display -->
    <div v-if="uploadErrors.length > 0" class="mt-6">
      <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <h5 class="flex items-center font-medium text-red-900 dark:text-red-100 mb-2">
          <ExclamationTriangleIcon class="w-5 h-5 mr-2" />
          Upload Errors
        </h5>
        <ul class="text-sm text-red-800 dark:text-red-200 space-y-1">
          <li v-for="error in uploadErrors" :key="error">• {{ error }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-area {
  transition: all 0.2s ease;
}

.upload-area:hover {
  background-color: rgb(249 250 251);
}

.dark .upload-area:hover {
  background-color: rgb(17 24 39);
}

.aspect-square {
  aspect-ratio: 1;
}
</style>