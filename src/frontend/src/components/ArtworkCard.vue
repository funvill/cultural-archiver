<script setup lang="ts">
import { computed } from 'vue';
import type { SearchResult } from '../types';
import { getImageSizedURL } from '../utils/image';

// Props interface
interface Props {
  artwork: SearchResult;
  loading?: boolean;
  compact?: boolean;
  showDistance?: boolean;
  clickable?: boolean;
  showAddReport?: boolean; // New prop for showing "Add Report" button
}

// Emits interface
interface Emits {
  (e: 'click', artwork: SearchResult): void;
  (e: 'imageLoad'): void;
  (e: 'imageError'): void;
  (e: 'addReport', artwork: SearchResult): void; // New emit for Add Report button
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  compact: false,
  showDistance: false,
  clickable: true,
  showAddReport: false,
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
    // Use thumbnail variant for card images
    return getImageSizedURL(props.artwork.recent_photo, 'thumbnail');
  }

  // Assume it's a relative path from the API
  return getImageSizedURL(props.artwork.recent_photo, 'thumbnail');
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

const artistName = computed(() => {
  // First priority: Check for linked artists from the new artist system
  if ((props.artwork as any).artists && Array.isArray((props.artwork as any).artists) && (props.artwork as any).artists.length > 0) {
    return (props.artwork as any).artists.map((a: any) => a.name).join(', ');
  }
  
  // Second priority: explicit artwork property if present
  // Some backends provide `artist_name` at top level, others inside tags
  if ((props.artwork as any).artist_name) return (props.artwork as any).artist_name;
  if (props.artwork.tags && typeof props.artwork.tags === 'object') {
    // common keys that might contain artist/author
    return (
      (props.artwork.tags as any).artist ||
      (props.artwork.tags as any).artist_name ||
      (props.artwork.tags as any).creator ||
      (props.artwork.tags as any).author ||
      ''
    );
  }

  return '';
});

const materialYear = computed(() => {
  const tags = props.artwork.tags as Record<string, unknown> | null;
  if (!tags) return '';
  const m = (tags as any).material;
  const y = (tags as any).year;
  if (m && y) return `${m} · ${y}`;
  if (m) return String(m);
  if (y) return String(y);
  return '';
});

// Methods
function handleClick(): void {
  if (props.clickable && !props.loading) {
    emit('click', props.artwork);
  }
}

function handleAddReport(event: Event): void {
  event.stopPropagation(); // Prevent card click
  if (!props.loading) {
    emit('addReport', props.artwork);
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
    class="artwork-card rounded-xl shadow-sm border-1 transition-all duration-300 ease-in-out hover:shadow-2xl transform-gpu overflow-hidden"
    :style="{ background: 'var(--md-surface, white)', borderColor: 'var(--md-outline, rgba(0,0,0,0.08))' }"
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
  <div class="flex-shrink-0 w-32 h-full relative overflow-hidden rounded-l-lg" :style="{ background: 'var(--md-surface-variant, #f3f4f6)' }">
        <img
          v-if="hasPhoto && photoUrl"
          :src="photoUrl"
          :alt="`Photo of ${artworkTitle}`"
          class="w-full h-full object-cover block"
          @load="handleImageLoad"
          @error="handleImageError"
        />
        <div
          v-else
    class="w-full h-full flex items-center justify-center"
          :style="{ background: 'var(--md-surface-variant, #fafafa)' }"
          aria-hidden="true"
        >
          <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" :style="{ color: 'var(--md-outline, #9ca3af)' }">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        <!-- No Photo overlay text when no photo -->
        <div
          v-if="!hasPhoto"
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <span class="text-xs font-medium px-2 py-1 rounded" :style="{ background: 'rgba(0,0,0,0.6)', color: '#ffffff' }">
            {{ photoCount }}
          </span>
        </div>

        <!-- Optional overlay badge slot (e.g., moderation status) -->
        <div class="absolute top-2 left-2 z-10 badge-slot">
          <slot name="badge"></slot>
        </div>

        <!-- Loading overlay -->
        <div
          v-if="loading"
          class="absolute inset-0 flex items-center justify-center"
          :style="{ background: 'color-mix(in srgb, var(--md-surface, white) 75%, transparent)' }"
        >
          <div class="animate-spin rounded-full h-4 w-4" :style="{ borderBottomColor: 'var(--md-primary, #2563eb)', borderWidth: '2px', borderStyle: 'solid' }"></div>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 p-3 min-w-0">
        <h3 class="text-sm font-medium text-gray-900 truncate mb-1">
          {{ artworkTitle }}
        </h3>
        <!-- Show artist in compact layout when available -->
        <p v-if="artistName" class="text-xs text-gray-500 truncate mb-1">
          {{ artistName }}
        </p>
        <!-- Artwork type as clickable badge -->
        <div class="mb-1">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity" :style="{ background: 'var(--md-primary-container, #e0e7ff)', color: 'var(--md-on-primary-container, #1e40af)' }">
            {{ artworkType }}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs text-gray-500">
          <span v-if="distanceText">{{ distanceText }}</span>
        </div>
      </div>
    </div>

    <!-- Full Layout -->
  <div v-else class="overflow-hidden rounded-xl">
      <!-- Photo with overlayed text -->
      <div class="aspect-w-1 aspect-h-1 bg-gray-100 relative">
        <img
          v-if="hasPhoto && photoUrl"
          :src="photoUrl"
          :alt="`Photo of ${artworkTitle}`"
          class="w-full h-full object-cover block"
          @load="handleImageLoad"
          @error="handleImageError"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center bg-gray-50"
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

        <!-- No Photo overlay text when no photo -->
        <div
          v-if="!hasPhoto"
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <span class="text-sm font-medium px-3 py-1.5 rounded" :style="{ background: 'rgba(0,0,0,0.6)', color: '#ffffff' }">
            {{ photoCount }}
          </span>
        </div>

        <!-- Optional overlay badge slot (e.g., moderation status) -->
        <div class="absolute top-2 left-2 z-10 badge-slot">
          <slot name="badge"></slot>
        </div>

        <!-- Loading overlay -->
        <div
          v-if="loading"
          class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center"
        >
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>

        <!-- Photo count badge (top-right) - solid chip with high contrast -->
        <div
          v-if="artwork.photo_count && artwork.photo_count > 1"
          class="photo-count-overlay absolute top-2 right-2 text-xs px-2 py-1 rounded-full z-10 flex items-center gap-1"
          :style="{ background: 'rgba(0,0,0,0.7)', color: '#ffffff' }"
        >
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {{ photoCount }}
        </div>

        <!-- Type badge (top-left) - solid chip -->
        <div class="type-badge-overlay absolute top-2 left-2 z-10">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :style="{ background: 'rgba(0,0,0,0.7)', color: '#ffffff' }">{{ artworkType }}</span>
        </div>

        <!-- Bottom overlay with title + artist + type -->
          <div class="text-overlay absolute left-0 right-0 bottom-0 p-3 text-white z-10" :style="{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%)' }">
          <h3 class="text-base md:text-xl font-semibold leading-tight line-clamp-2" :style="{ color: '#ffffff' }">{{ artworkTitle }}</h3>
          <p v-if="artistName" class="text-xs mt-1.5 truncate" :style="{ color: 'var(--md-on-surface-variant, #e5e7eb)' }">{{ artistName }}</p>
          <!-- Artwork type as clickable badge -->
          <div class="mt-1.5">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity" :style="{ background: 'rgba(255,255,255,0.25)', color: '#ffffff', backdropFilter: 'blur(8px)' }">
              {{ artworkType }}
            </span>
          </div>
          <!-- Always show distance if requested (even when artist exists) -->
          <p v-if="showDistance && distanceText" class="text-xs mt-1" :style="{ color: 'var(--md-on-surface-variant, #e5e7eb)' }">{{ distanceText }}</p>
          <!-- Show material/year if available as secondary meta -->
          <p v-if="materialYear" class="text-xs mt-1" :style="{ color: 'var(--md-on-surface-variant, #cbd5e1)' }">{{ materialYear }}</p>
        </div>
      </div>

      <!-- Add Report Button (only shown when showAddReport is true) -->
      <div v-if="showAddReport" class="mt-2 px-3 pb-3">
        <button
          @click="handleAddReport"
          :disabled="!!loading"
          class="w-full px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          :style="{ background: 'var(--md-primary, #2563eb)', color: 'var(--md-on-primary, #fff)', border: '1px solid transparent' }"
        >
          <svg
            class="w-4 h-4 inline-block mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add photo to Artwork
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* Line clamp utility for multiline text truncation */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  /* Define standard property for compatibility */
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Aspect ratio utility for responsive images */
.aspect-w-1 {
  position: relative;
  width: 100%;
  overflow: hidden; /* Prevent overlays from extending outside */
}
.aspect-w-1::before {
  content: '';
  display: block;
  padding-bottom: calc(1 / 1 * 100%); /* Square ratio */
}

.aspect-h-1 > img {
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

/* Specific overrides for our overlay elements - ensuring they stay within bounds */
.aspect-h-1 .photo-count-overlay {
  position: absolute !important;
  top: 0.5rem !important;
  right: 0.5rem !important;
  z-index: 15 !important;
}

.aspect-h-1 .type-badge-overlay {
  position: absolute !important;
  top: 0.5rem !important;
  left: 0.5rem !important;
  z-index: 10 !important;
}

.aspect-h-1 .text-overlay {
  position: absolute !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 20 !important;
}

/* Ensure chips have clear contrast and slightly larger tappable area on mobile */
.photo-count-overlay, .type-badge-overlay span {
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}

/* Slightly increase padding of text overlay on small screens for readability */
.text-overlay {
  padding: 0.75rem !important;
}

/* Ensure overlay badges are not stretched to full size by the aspect ratio helper */
.badge-slot {
  position: absolute !important;
  width: auto !important;
  height: auto !important;
  pointer-events: none;
}

/* High-specificity override so the aspect helper cannot stretch the badge slot */
.aspect-w-1.aspect-h-1 > .badge-slot {
  position: absolute !important;
  width: auto !important;
  height: auto !important;
  top: 0.5rem !important;
  left: 0.5rem !important;
  right: auto !important;
  bottom: auto !important;
  inset: auto !important;
}

/* Small visual tweak: ensure badge content doesn't inherit the full-image clipping */
.badge-slot > * {
  display: inline-block;
  pointer-events: auto;
}

/* Exciting hover animation - grow and shake */
.artwork-card:hover {
  transform: scale(1.05) translateY(-5px);
  animation: shake-and-settle 0.6s ease-in-out;
}

@keyframes shake-and-settle {
  0% {
    transform: scale(1) translateY(0);
  }
  15% {
    transform: scale(1.05) translateY(-5px) rotateZ(1deg);
  }
  30% {
    transform: scale(1.05) translateY(-5px) rotateZ(-1deg);
  }
  45% {
    transform: scale(1.05) translateY(-5px) rotateZ(0.5deg);
  }
  60% {
    transform: scale(1.05) translateY(-5px) rotateZ(-0.5deg);
  }
  75% {
    transform: scale(1.05) translateY(-5px) rotateZ(0.2deg);
  }
  100% {
    transform: scale(1.05) translateY(-5px) rotateZ(0);
  }
}


</style>
