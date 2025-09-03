<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useArtworksStore } from '../stores/artworks'
import PhotoCarousel from '../components/PhotoCarousel.vue'
import MiniMap from '../components/MiniMap.vue'
import TagBadge from '../components/TagBadge.vue'
import LogbookTimeline from '../components/LogbookTimeline.vue'
import { useAnnouncer } from '../composables/useAnnouncer'

// Props
interface Props {
  id: string
}

const props = defineProps<Props>()

// Stores and routing
const artworksStore = useArtworksStore()
const router = useRouter()

// Announcer for screen reader feedback
const { announceError, announceSuccess } = useAnnouncer()

// State
const loading = ref(true)
const error = ref<string | null>(null)
const currentPhotoIndex = ref(0)
const showFullscreenPhoto = ref(false)
const fullscreenPhotoUrl = ref<string>('')

// Computed
const artwork = computed(() => {
  return artworksStore.artworkById(props.id)
})

const artworkTitle = computed(() => {
  if (!artwork.value) return 'Unknown Artwork'
  
  // Try to get title from tags_parsed first, then fallback
  const title = artwork.value.tags_parsed?.title as string
  return title || 'Unknown Artwork Title'
})

const artworkDescription = computed(() => {
  if (!artwork.value) return null
  
  const description = artwork.value.tags_parsed?.description as string
  return description || null
})

const artworkCreators = computed(() => {
  if (!artwork.value?.tags_parsed?.creator) {
    return 'Unknown'
  }
  
  return artwork.value.tags_parsed.creator as string
})

const artworkTags = computed(() => {
  if (!artwork.value?.tags_parsed) return {}
  
  // Filter out special fields like title, description, artist
  const filteredTags = { ...artwork.value.tags_parsed }
  delete filteredTags.title
  delete filteredTags.description
  delete filteredTags.artist
  
  return filteredTags
})

const artworkPhotos = computed(() => {
  return artwork.value?.photos || []
})

const logbookEntries = computed(() => {
  return artwork.value?.logbook_entries || []
})

// Lifecycle
onMounted(async () => {
  try {
    loading.value = true
    error.value = null
    
    // Validate ID parameter
    if (!props.id || props.id.trim() === '') {
      error.value = 'Invalid artwork ID provided.'
      announceError('Invalid artwork ID')
      return
    }
    
    // Check if ID is in valid format (UUID pattern or sample data format)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const sampleDataPattern = /^SAMPLE-artwork-.+$/i
    if (!uuidPattern.test(props.id) && !sampleDataPattern.test(props.id)) {
      error.value = 'Invalid artwork ID format. Please check the URL and try again.'
      announceError('Invalid artwork ID format')
      return
    }
    
    // Try to load artwork from store first
    let artworkData = artworksStore.artworkById(props.id)
    
    if (!artworkData) {
      // If not in store, fetch from API
      await artworksStore.fetchArtwork(props.id)
      artworkData = artworksStore.artworkById(props.id)
      
      if (!artworkData) {
        error.value = `Artwork with ID "${props.id}" was not found. It may have been removed or is pending approval.`
        announceError('Artwork not found')
        return
      }
    }
    
    announceSuccess(`Loaded artwork details: ${artworkTitle.value}`)
    
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load artwork'
    if (message.includes('404') || message.includes('not found')) {
      error.value = `Artwork with ID "${props.id}" was not found. It may have been removed or is pending approval.`
    } else if (message.includes('network') || message.includes('fetch')) {
      error.value = 'Unable to load artwork details. Please check your internet connection and try again.'
    } else {
      error.value = message
    }
    announceError('Failed to load artwork details')
  } finally {
    loading.value = false
  }
})

// Methods
function handlePhotoFullscreen(photoUrl: string): void {
  fullscreenPhotoUrl.value = photoUrl
  showFullscreenPhoto.value = true
}

function closeFullscreenPhoto(): void {
  showFullscreenPhoto.value = false
  fullscreenPhotoUrl.value = ''
}

function handleTagClick(tag: { label: string; value: string }): void {
  // Future: implement tag filtering or search
  console.log('Tag clicked:', tag)
}

function handleLogbookEntryClick(entry: any): void {
  // Future: implement entry detail view
  console.log('Logbook entry clicked:', entry)
}

function handleLogbookPhotoClick(photoUrl: string): void {
  handlePhotoFullscreen(photoUrl)
}

function handleLoadMoreEntries(): void {
  // Future: implement pagination
  console.log('Load more entries requested')
}

function goToMap(): void {
  router.push('/')
}

function getArtworkTypeEmoji(typeName: string): string {
  const typeMap: Record<string, string> = {
    'public_art': '🎨',
    'street_art': '🎭',
    'monument': '🗿',
    'sculpture': '⚱️',
    'other': '🏛️'
  }
  return typeMap[typeName] || '🏛️'
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && showFullscreenPhoto.value) {
    closeFullscreenPhoto()
  }
}

// Add keyboard listener
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="artwork-detail-view min-h-screen bg-gray-50">
    <!-- Loading State -->
    <div v-if="loading" class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <svg class="animate-spin h-12 w-12 mx-auto mb-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-600">Loading artwork details...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="min-h-screen flex items-center justify-center">
      <div class="text-center max-w-md mx-auto px-4">
        <svg class="h-16 w-16 mx-auto mb-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Artwork Not Found</h1>
        <p class="text-gray-600 mb-6">{{ error }}</p>
        <button
          @click="goToMap"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          ← Back to Map
        </button>
      </div>
    </div>

    <!-- Artwork Content -->
    <div v-else-if="artwork" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <!-- Breadcrumb Navigation -->
      <nav aria-label="Breadcrumb" class="mb-4">
        <ol class="flex items-center space-x-2 text-sm text-gray-500">
          <li>
            <button
              @click="goToMap"
              class="hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              Map
            </button>
          </li>
          <li>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </li>
          <li class="text-gray-900 font-medium" aria-current="page">
            {{ artworkTitle }}
          </li>
        </ol>
      </nav>

      <!-- Header with back button -->
      <div class="mb-6">
        <button
          @click="goToMap"
          class="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Map
        </button>
        
        <!-- Title and Type -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
          <div class="flex items-center gap-2">
            <span class="text-2xl sm:text-3xl" aria-hidden="true">{{ getArtworkTypeEmoji(artwork.type_name || '') }}</span>
            <span class="text-xs sm:text-sm font-medium text-blue-600 bg-blue-100 px-2 sm:px-3 py-1 rounded-full">
              {{ (artwork.type_name || 'other').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }}
            </span>
          </div>
        </div>
        
        <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 leading-tight">{{ artworkTitle }}</h1>
        
        <div v-if="artworkCreators !== 'Unknown'" class="text-base sm:text-lg text-gray-600 mb-4">
          by {{ artworkCreators }}
        </div>
      </div>

      <!-- Main content grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <!-- Left column - Main content -->
        <div class="lg:col-span-2 space-y-6 lg:space-y-8">
          <!-- Photo Gallery -->
          <section aria-labelledby="photos-heading">
            <h2 id="photos-heading" class="sr-only">Photo Gallery</h2>
            <PhotoCarousel
              :photos="artworkPhotos"
              v-model:currentIndex="currentPhotoIndex"
              :alt-text-prefix="artworkTitle"
              @fullscreen="handlePhotoFullscreen"
            />
          </section>

          <!-- Description -->
          <section v-if="artworkDescription" aria-labelledby="description-heading">
            <h2 id="description-heading" class="text-xl font-semibold text-gray-900 mb-3">Description</h2>
            <div class="prose prose-gray max-w-none">
              <p class="text-gray-700 leading-relaxed">{{ artworkDescription }}</p>
            </div>
          </section>

          <!-- Add description placeholder -->
          <section v-else aria-labelledby="description-heading">
            <h2 id="description-heading" class="text-xl font-semibold text-gray-900 mb-3">Description</h2>
            <div class="text-gray-500 italic bg-gray-100 p-4 rounded-lg">
              Add description - No description available for this artwork yet.
            </div>
          </section>

          <!-- Tags and Metadata -->
          <section v-if="Object.keys(artworkTags).length > 0" aria-labelledby="metadata-heading">
            <h2 id="metadata-heading" class="text-xl font-semibold text-gray-900 mb-3">Details</h2>
            <TagBadge
              :tags="artworkTags"
              :max-visible="5"
              color-scheme="blue"
              variant="compact"
              @tag-click="handleTagClick"
            />
          </section>

          <!-- Journal Timeline -->
          <section aria-labelledby="journal-heading">
            <LogbookTimeline
              :entries="logbookEntries"
              :loading="false"
              :has-more="false"
              @entry-click="handleLogbookEntryClick"
              @photo-click="handleLogbookPhotoClick"
              @load-more="handleLoadMoreEntries"
            />
          </section>
        </div>

        <!-- Right column - Sidebar -->
        <div class="lg:col-span-1">
          <div class="space-y-6 lg:sticky lg:top-8">
            <!-- Location -->
            <section aria-labelledby="location-heading" class="bg-white rounded-lg border border-gray-200 p-6">
              <h2 id="location-heading" class="text-lg font-semibold text-gray-900 mb-4">Location</h2>
              <MiniMap
                :latitude="artwork.lat"
                :longitude="artwork.lon"
                :title="artworkTitle"
                height="200px"
                :zoom="16"
              />
            </section>

            <!-- Artwork Info -->
            <section aria-labelledby="info-heading" class="bg-white rounded-lg border border-gray-200 p-6">
              <h2 id="info-heading" class="text-lg font-semibold text-gray-900 mb-4">Information</h2>
              
              <dl class="space-y-3">
                <div>
                  <dt class="text-sm font-medium text-gray-600">Creators</dt>
                  <dd class="text-sm text-gray-900">{{ artworkCreators }}</dd>
                </div>
                
                <div>
                  <dt class="text-sm font-medium text-gray-600">Type</dt>
                  <dd class="text-sm text-gray-900">{{ (artwork.type_name || 'other').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }}</dd>
                </div>
                
                <div>
                  <dt class="text-sm font-medium text-gray-600">Status</dt>
                  <dd class="text-sm">
                    <span 
                      class="inline-block px-2 py-1 text-xs font-medium rounded-full"
                      :class="{
                        'bg-green-100 text-green-800': artwork.status === 'approved',
                        'bg-yellow-100 text-yellow-800': artwork.status === 'pending',
                        'bg-red-100 text-red-800': artwork.status === 'removed'
                      }"
                    >
                      {{ artwork.status }}
                    </span>
                  </dd>
                </div>
                
                <div>
                  <dt class="text-sm font-medium text-gray-600">Added</dt>
                  <dd class="text-sm text-gray-900">
                    {{ new Date(artwork.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) }}
                  </dd>
                </div>
              </dl>
            </section>

            <!-- CC0 License Information -->
            <section aria-labelledby="license-heading" class="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <h2 id="license-heading" class="text-lg font-semibold text-gray-900 mb-3">License</h2>
              <div class="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>CC0 Public Domain:</strong> All user-contributed content is released under CC0 license.
                </p>
                <p class="text-xs text-gray-500">
                  Note: Underlying artworks may still be copyrighted. This license only applies to user submissions.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>

    <!-- Fullscreen Photo Modal -->
    <div
      v-if="showFullscreenPhoto"
      class="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
      @click="closeFullscreenPhoto"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen photo view"
    >
      <button
        @click="closeFullscreenPhoto"
        class="absolute top-4 right-4 text-white hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white rounded z-10"
        aria-label="Close fullscreen photo"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      <img
        :src="fullscreenPhotoUrl"
        :alt="`Fullscreen view of ${artworkTitle}`"
        class="max-w-full max-h-full object-contain"
        @click.stop
      />
    </div>
  </div>
</template>

<style scoped>
.artwork-detail-view {
  /* Custom styles if needed */
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

/* Smooth transitions */
.artwork-detail-view button {
  transition: all 0.15s ease-in-out;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .artwork-detail-view .bg-white {
    border: 1px solid currentColor;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .artwork-detail-view * {
    transition: none !important;
    animation: none !important;
  }
}
</style>