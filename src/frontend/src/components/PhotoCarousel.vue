<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useAnnouncer } from '../composables/useAnnouncer'

// Props interface
interface Props {
  photos: string[]
  currentIndex?: number
  showLicenseInfo?: boolean
  showSubmissionDate?: boolean
  altTextPrefix?: string
}

// Emits interface
interface Emits {
  (e: 'update:currentIndex', index: number): void
  (e: 'fullscreen', photoUrl: string): void
  (e: 'photoSelect', index: number): void
}

const props = withDefaults(defineProps<Props>(), {
  currentIndex: 0,
  showLicenseInfo: true,
  showSubmissionDate: false,
  altTextPrefix: 'Artwork photo'
})

const emit = defineEmits<Emits>()

// Announcer for screen reader feedback
const { announceInfo } = useAnnouncer()

// State
const carouselRef = ref<HTMLElement>()
const touchStartX = ref(0)
const touchStartY = ref(0)
const isDragging = ref(false)
const isFullscreen = ref(false)

// Computed
const currentPhotoIndex = computed({
  get: () => props.currentIndex,
  set: (value) => emit('update:currentIndex', value)
})

const hasMultiplePhotos = computed(() => props.photos.length > 1)

const currentPhoto = computed(() => {
  if (props.photos.length === 0) return null
  return props.photos[currentPhotoIndex.value] || props.photos[0]
})

const photoAltText = computed(() => {
  if (props.photos.length === 0) return 'No photos available'
  const current = currentPhotoIndex.value + 1
  const total = props.photos.length
  return `${props.altTextPrefix} ${current} of ${total}`
})

// Methods
function previousPhoto(): void {
  if (!hasMultiplePhotos.value) return
  
  const newIndex = currentPhotoIndex.value === 0 
    ? props.photos.length - 1 
    : currentPhotoIndex.value - 1
    
  currentPhotoIndex.value = newIndex
  announceInfo(`Photo ${newIndex + 1} of ${props.photos.length}`)
}

function nextPhoto(): void {
  if (!hasMultiplePhotos.value) return
  
  const newIndex = currentPhotoIndex.value === props.photos.length - 1 
    ? 0 
    : currentPhotoIndex.value + 1
    
  currentPhotoIndex.value = newIndex
  announceInfo(`Photo ${newIndex + 1} of ${props.photos.length}`)
}

function goToPhoto(index: number): void {
  if (index >= 0 && index < props.photos.length) {
    currentPhotoIndex.value = index
    emit('photoSelect', index)
    announceInfo(`Selected photo ${index + 1} of ${props.photos.length}`)
  }
}

function openFullscreen(): void {
  if (currentPhoto.value) {
    emit('fullscreen', currentPhoto.value)
    announceInfo('Opened photo in fullscreen view')
  }
}

// Touch/swipe handlers
function handleTouchStart(event: TouchEvent): void {
  if (event.touches.length !== 1) return
  
  touchStartX.value = event.touches[0].clientX
  touchStartY.value = event.touches[0].clientY
  isDragging.value = true
}

function handleTouchEnd(event: TouchEvent): void {
  if (!isDragging.value || event.changedTouches.length !== 1) return
  
  const touchEndX = event.changedTouches[0].clientX
  const touchEndY = event.changedTouches[0].clientY
  
  const deltaX = touchEndX - touchStartX.value
  const deltaY = touchEndY - touchStartY.value
  
  // Check if horizontal swipe (more horizontal than vertical)
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
    if (deltaX > 0) {
      previousPhoto()
    } else {
      nextPhoto()
    }
  }
  
  isDragging.value = false
}

// Keyboard navigation
function handleKeydown(event: KeyboardEvent): void {
  if (!carouselRef.value) return
  
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      previousPhoto()
      break
    case 'ArrowRight':
      event.preventDefault()
      nextPhoto()
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      openFullscreen()
      break
    case 'Home':
      event.preventDefault()
      goToPhoto(0)
      break
    case 'End':
      event.preventDefault()
      goToPhoto(props.photos.length - 1)
      break
  }
}

// Focus management
function focusCarousel(): void {
  nextTick(() => {
    carouselRef.value?.focus()
  })
}

// Watch for changes to announce updates
watch(() => props.photos.length, (newLength, oldLength) => {
  if (newLength !== oldLength) {
    announceInfo(`Photo gallery updated. ${newLength} ${newLength === 1 ? 'photo' : 'photos'} available`)
  }
})

// Lifecycle
onMounted(() => {
  // Auto-focus when component is mounted
  focusCarousel()
})
</script>

<template>
  <div class="photo-carousel">
    <!-- Main photo display -->
    <div 
      v-if="currentPhoto"
      ref="carouselRef"
      class="relative bg-gray-900 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
      tabindex="0"
      role="img"
      :aria-label="photoAltText"
      :aria-describedby="hasMultiplePhotos ? 'photo-navigation-help' : undefined"
      @keydown="handleKeydown"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
      @click="openFullscreen"
    >
      <!-- Photo -->
      <img
        :src="currentPhoto"
        :alt="photoAltText"
        class="w-full h-64 md:h-96 object-cover cursor-pointer"
        loading="lazy"
      />
      
      <!-- Navigation arrows (only shown if multiple photos) -->
      <div v-if="hasMultiplePhotos" class="absolute inset-0 flex items-center justify-between p-4 pointer-events-none">
        <button
          @click.stop="previousPhoto"
          class="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all pointer-events-auto focus:outline-none focus:ring-2 focus:ring-blue-400"
          :aria-label="`Previous photo (${currentPhotoIndex} of ${props.photos.length})`"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <button
          @click.stop="nextPhoto"
          class="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all pointer-events-auto focus:outline-none focus:ring-2 focus:ring-blue-400"
          :aria-label="`Next photo (${currentPhotoIndex + 2} of ${props.photos.length})`"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      <!-- Photo counter -->
      <div v-if="hasMultiplePhotos" class="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
        {{ currentPhotoIndex + 1 }} / {{ props.photos.length }}
      </div>
      
      <!-- CC0 License info (if enabled) -->
      <div v-if="showLicenseInfo" class="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
        CC0
      </div>
      
      <!-- Fullscreen hint -->
      <div class="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs opacity-75">
        Click for fullscreen
      </div>
    </div>
    
    <!-- Fallback for no photos -->
    <div v-else class="h-64 md:h-96 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center rounded-lg">
      <div class="text-center text-white">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-70" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
        </svg>
        <p class="text-lg opacity-90">No photos available</p>
      </div>
    </div>
    
    <!-- Dot indicators (only shown if multiple photos) -->
    <div v-if="hasMultiplePhotos" class="flex justify-center mt-4 space-x-2">
      <button
        v-for="(photo, index) in props.photos"
        :key="index"
        @click="goToPhoto(index)"
        class="w-3 h-3 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
        :class="index === currentPhotoIndex ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'"
        :aria-label="`Go to photo ${index + 1}`"
        :aria-current="index === currentPhotoIndex ? 'true' : 'false'"
      />
    </div>
    
    <!-- Screen reader navigation help -->
    <div v-if="hasMultiplePhotos" id="photo-navigation-help" class="sr-only">
      Use arrow keys to navigate between photos, Enter or Space to open fullscreen, Home for first photo, End for last photo
    </div>
  </div>
</template>

<style scoped>
.photo-carousel {
  /* Ensure proper touch event handling */
  touch-action: pan-y pinch-zoom;
}

/* Screen reader only class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Smooth transitions for focus states */
.photo-carousel button {
  transition: all 0.15s ease-in-out;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .photo-carousel .bg-black {
    background-color: black;
  }
  
  .photo-carousel .text-white {
    color: white;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .photo-carousel * {
    transition: none !important;
    animation: none !important;
  }
}
</style>