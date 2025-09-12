<script setup lang="ts">
import { computed } from 'vue';
import type { ArtistApiResponse } from '../../../shared/types';

// Props interface
interface Props {
  artist: ArtistApiResponse;
  loading?: boolean;
  compact?: boolean;
  clickable?: boolean;
}

// Emits interface
interface Emits {
  (e: 'click', artist: ArtistApiResponse): void;
  (e: 'imageLoad'): void;
  (e: 'imageError'): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  compact: false,
  clickable: true,
});

const emit = defineEmits<Emits>();

// Computed
const artistName = computed(() => {
  return props.artist.name || 'Unknown Artist';
});

const shortBio = computed(() => {
  return props.artist.short_bio || props.artist.description || '';
});

const artworkCount = computed(() => {
  const count = props.artist.artwork_count || 0;
  if (count === 0) return 'No artworks';
  if (count === 1) return '1 artwork';
  return `${count} artworks`;
});

const avatarUrl = computed(() => {
  // For now, use a placeholder avatar based on first letter
  // This can be enhanced later with actual avatar images
  return null;
});

const avatarInitial = computed(() => {
  return artistName.value.charAt(0).toUpperCase();
});

const avatarColor = computed(() => {
  // Generate a consistent color based on artist name
  const colors = [
    'bg-blue-500',
    'bg-green-500', 
    'bg-purple-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-teal-500',
  ];
  
  const hash = artistName.value.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  return colors[hash % colors.length];
});

// Methods
function handleClick(): void {
  if (props.clickable && !props.loading) {
    emit('click', props.artist);
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
  <div
    :class="{
      'cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200': clickable && !loading,
      'opacity-60': loading,
      'p-3': compact,
      'p-4': !compact,
    }"
    class="bg-white rounded-lg shadow-md border border-gray-200"
    :tabindex="clickable ? 0 : -1"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <!-- Loading State -->
    <div v-if="loading" class="animate-pulse">
      <div class="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-3"></div>
      <div class="h-4 bg-gray-200 rounded mb-2"></div>
      <div class="h-3 bg-gray-200 rounded mb-2"></div>
      <div class="h-3 bg-gray-200 rounded w-2/3"></div>
    </div>

    <!-- Artist Content -->
    <div v-else class="text-center">
      <!-- Avatar -->
      <div class="mb-3 flex justify-center">
        <div
          v-if="!avatarUrl"
          :class="[avatarColor, 'w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl']"
        >
          {{ avatarInitial }}
        </div>
        <img
          v-else
          :src="avatarUrl"
          :alt="`${artistName} avatar`"
          class="w-16 h-16 rounded-full object-cover"
          loading="lazy"
          @load="handleImageLoad"
          @error="handleImageError"
        />
      </div>

      <!-- Artist Name -->
      <h3 class="font-semibold text-gray-900 text-lg mb-2 line-clamp-2">
        {{ artistName }}
      </h3>

      <!-- Artwork Count -->
      <p class="text-sm text-gray-600 mb-2">
        {{ artworkCount }}
      </p>

      <!-- Short Bio -->
      <p
        v-if="shortBio"
        class="text-sm text-gray-500 line-clamp-3"
        :class="{ 'line-clamp-2': compact }"
      >
        {{ shortBio }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>