<script setup lang="ts">
import { computed } from 'vue';
import type { SearchResult } from '../types';

// Props interface
interface Props {
  artwork: SearchResult;
  loading?: boolean;
  compact?: boolean;
  showDistance?: boolean;
  clickable?: boolean;
}

// Emits interface
interface Emits {
  (e: 'click', artwork: SearchResult): void;
  (e: 'imageLoad'): void;
  (e: 'imageError'): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  compact: false,
  showDistance: false,
  clickable: true,
});

const emit = defineEmits<Emits>();

// Computed
const artworkTitle = computed(() => {
  // Prefer explicit title when available
  if (typeof props.artwork.title === 'string' && props.artwork.title.trim().length > 0) {
    return props.artwork.title.trim();
  }
  // Try to get title from tags
  if (props.artwork.tags && typeof props.artwork.tags === 'object') {
    const title = props.artwork.tags.title || props.artwork.tags.name;
    if (title && typeof title === 'string') {
      return title;
    }
  }

  // Fallback to type name
  return props.artwork.type_name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
});

const artworkType = computed(() => {
  return props.artwork.type_name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
});

const hasPhoto = computed(() => !!props.artwork.recent_photo);

const photoUrl = computed(() => {
  if (!props.artwork.recent_photo) return null;

  // Handle different photo URL formats
  if (props.artwork.recent_photo.startsWith('http')) {
    return props.artwork.recent_photo;
  }

  // Assume it's a relative path from the API
  return props.artwork.recent_photo;
});

const distanceText = computed(() => {
  if (!props.showDistance || !props.artwork.distance_km) return null;

  const distance = props.artwork.distance_km;
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m away`;
  }
  return `${distance.toFixed(1)}km away`;
});

const photoCount = computed(() => {
  const count = props.artwork.photo_count || 0;
  if (count === 0) return 'No photos';
  if (count === 1) return '1 photo';
  return `${count} photos`;
});

// Methods
function handleClick(): void {
  if (props.clickable && !props.loading) {
    emit('click', props.artwork);
  }
}

function handleImageLoad(): void {
  emit('imageLoad');
}

function handleImageError(): void {
  emit('imageError');
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.clickable && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    handleClick();
  }
}
</script>

<template>
  <article
    class="bg-white rounded-lg shadow-sm border border-gray-200 transition-all duration-200 ease-in-out hover:shadow-md hover:border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
    :class="{
      'cursor-pointer': clickable && !loading,
      'cursor-default': !clickable || loading,
      'opacity-50': loading,
      'h-32': compact,
      'h-auto': !compact,
    }"
    :tabindex="clickable ? 0 : -1"
    role="button"
    :aria-label="`View artwork: ${artworkTitle}`"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <!-- Compact Layout -->
    <div v-if="compact" class="flex h-full">
      <!-- Photo Thumbnail -->
      <div class="flex-shrink-0 w-32 h-full relative overflow-hidden rounded-l-lg bg-gray-100">
        <img
          v-if="hasPhoto && photoUrl"
          :src="photoUrl"
          :alt="`Photo of ${artworkTitle}`"
          class="w-full h-full object-cover"
          @load="handleImageLoad"
          @error="handleImageError"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center bg-gray-50"
          aria-hidden="true"
        >
          <svg class="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        <!-- Loading overlay -->
        <div
          v-if="loading"
          class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center"
        >
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 p-3 min-w-0">
        <h3 class="text-sm font-medium text-gray-900 truncate mb-1">
          {{ artworkTitle }}
        </h3>
        <p class="text-xs text-gray-600 mb-1">
          {{ artworkType }}
        </p>
        <div class="flex items-center justify-between text-xs text-gray-500">
          <span>{{ photoCount }}</span>
          <span v-if="distanceText">{{ distanceText }}</span>
        </div>
      </div>
    </div>

    <!-- Full Layout -->
    <div v-else class="overflow-hidden">
      <!-- Photo -->
      <div class="aspect-w-16 aspect-h-12 bg-gray-100 relative">
        <img
          v-if="hasPhoto && photoUrl"
          :src="photoUrl"
          :alt="`Photo of ${artworkTitle}`"
          class="w-full h-48 object-cover"
          @load="handleImageLoad"
          @error="handleImageError"
        />
        <div
          v-else
          class="w-full h-48 flex items-center justify-center bg-gray-50"
          aria-hidden="true"
        >
          <svg
            class="w-12 h-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        <!-- Loading overlay -->
        <div
          v-if="loading"
          class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center"
        >
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>

        <!-- Photo count badge -->
        <div
          v-if="artwork.photo_count > 1"
          class="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded"
        >
          {{ artwork.photo_count }} photos
        </div>
      </div>

      <!-- Content -->
      <div class="p-4">
        <h3 class="text-lg font-medium text-gray-900 mb-2 line-clamp-2">
          {{ artworkTitle }}
        </h3>
        <p v-if="artwork.artist_name" class="text-sm text-gray-600 mb-1 line-clamp-1">
          {{ artwork.artist_name }}
        </p>

        <div class="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
          >
            {{ artworkType }}
          </span>
          <span v-if="distanceText" class="text-xs">
            {{ distanceText }}
          </span>
        </div>

        <!-- Additional artwork details if available in tags -->
        <div v-if="artwork.tags" class="text-sm text-gray-500 space-y-1">
          <div v-if="!artwork.artist_name && artwork.tags.artist" class="flex items-center">
            <span class="font-medium">Artist:</span>
            <span class="ml-1 truncate">{{ artwork.tags.artist }}</span>
          </div>
          <div v-if="artwork.tags.material" class="flex items-center">
            <span class="font-medium">Material:</span>
            <span class="ml-1 truncate">{{ artwork.tags.material }}</span>
          </div>
          <div v-if="artwork.tags.year || artwork.tags.year_of_installation" class="flex items-center">
            <span class="font-medium">Year:</span>
            <span class="ml-1">{{ artwork.tags.year || artwork.tags.year_of_installation }}</span>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* Line clamp utility for multiline text truncation */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Aspect ratio utility for responsive images */
.aspect-w-16 {
  position: relative;
  width: 100%;
}
.aspect-w-16::before {
  content: '';
  display: block;
  padding-bottom: calc(12 / 16 * 100%);
}
.aspect-h-12 > * {
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
</style>
