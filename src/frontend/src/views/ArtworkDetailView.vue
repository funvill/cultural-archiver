<template>
  <div class="artwork-detail-view">
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
          @click="$router.push('/')"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          ← Back to Map
        </button>
      </div>
    </div>

    <!-- Artwork Content -->
    <div v-else-if="artwork" class="max-w-6xl mx-auto">
      <!-- Hero Section -->
      <div class="relative">
        <!-- Photo Gallery -->
        <div v-if="artwork.photos && artwork.photos.length > 0" class="relative h-96 md:h-[500px] bg-gray-900">
          <!-- Main Photo -->
          <img
            :src="artwork.photos[currentPhotoIndex] || ''"
            :alt="getPhotoAltText(currentPhotoIndex)"
            class="w-full h-full object-cover"
          />
          
          <!-- Photo Navigation -->
          <div v-if="artwork.photos.length > 1" class="absolute inset-0 flex items-center justify-between p-4">
            <button
              @click="previousPhoto"
              class="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              @click="nextPhoto"
              class="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <!-- Photo Counter -->
          <div v-if="artwork.photos.length > 1" class="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
            {{ currentPhotoIndex + 1 }} / {{ artwork.photos.length }}
          </div>
        </div>
        
        <!-- Fallback for no photos -->
        <div v-else class="h-96 md:h-[500px] bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
          <div class="text-center text-white">
            <svg class="w-16 h-16 mx-auto mb-4 opacity-70" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
            </svg>
            <p class="text-lg opacity-90">{{ getArtworkTypeEmoji(artwork.type_name) }} {{ getArtworkTypeName(artwork.type_name) }}</p>
          </div>
        </div>

        <!-- Back Button -->
        <button
          @click="$router.push('/')"
          class="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <!-- Content Section -->
      <div class="px-4 sm:px-6 lg:px-8 py-8">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Main Content -->
          <div class="lg:col-span-2">
            <!-- Title and Type -->
            <div class="mb-6">
              <div class="flex items-center gap-3 mb-2">
                <span class="text-3xl">{{ getArtworkTypeEmoji(artwork.type_name) }}</span>
                <span class="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  {{ getArtworkTypeName(artwork.type_name) }}
                </span>
              </div>
              <h1 class="text-3xl font-bold text-gray-900 mb-2">
                {{ (artwork.tags_parsed?.title as string) || 'Untitled Artwork' }}
              </h1>
              <p v-if="artwork.tags_parsed?.artist" class="text-lg text-gray-600">
                by {{ artwork.tags_parsed?.artist }}
              </p>
            </div>

            <!-- Description -->
            <div v-if="artwork.tags_parsed?.description" class="mb-8">
              <h2 class="text-xl font-semibold text-gray-900 mb-3">Description</h2>
              <p class="text-gray-700 leading-relaxed">{{ artwork.tags_parsed?.description }}</p>
            </div>

            <!-- Tags -->
            <div v-if="artwork.tags && Object.keys(artwork.tags).length > 0" class="mb-8">
              <h2 class="text-xl font-semibold text-gray-900 mb-3">Details</h2>
              <div class="space-y-2">
                <div
                  v-for="(value, key) in artwork.tags"
                  :key="key"
                  class="flex items-center gap-2"
                >
                  <span class="text-sm font-medium text-gray-600 capitalize min-w-[80px]">
                    {{ key }}:
                  </span>
                  <span class="text-sm text-gray-900 bg-gray-100 px-2 py-1 rounded">
                    {{ value }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Photo Thumbnails -->
            <div v-if="artwork.photos && artwork.photos.length > 1" class="mb-8">
              <h2 class="text-xl font-semibold text-gray-900 mb-3">Photo Gallery</h2>
              <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
                <button
                  v-for="(photo, index) in artwork.photos"
                  :key="index"
                  @click="currentPhotoIndex = index"
                  class="aspect-square bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
                  :class="{ 'ring-2 ring-blue-500': index === currentPhotoIndex }"
                >
                  <img
                    :src="photo"
                    :alt="getPhotoAltText(index)"
                    class="w-full h-full object-cover"
                  />
                </button>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="lg:col-span-1">
            <div class="bg-white rounded-lg border border-gray-200 p-6 sticky top-4">
              <!-- Location -->
              <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-3">Location</h3>
                <div class="space-y-2">
                  <p class="text-sm text-gray-600">
                    📍 {{ artwork.lat?.toFixed(6) }}, {{ artwork.lon?.toFixed(6) }}
                  </p>
                  <button
                    @click="openInMaps"
                    class="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Open in Maps →
                  </button>
                </div>
              </div>

              <!-- Status -->
              <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-3">Status</h3>
                <span 
                  class="inline-block px-2 py-1 text-xs font-medium rounded-full"
                  :class="getStatusBadgeClass(artwork.status)"
                >
                  {{ artwork.status }}
                </span>
              </div>

              <!-- Submission Info -->
              <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-3">Submitted</h3>
                <p class="text-sm text-gray-600">
                  {{ formatDate(artwork.created_at) }}
                </p>
              </div>

              <!-- Actions -->
              <div class="space-y-3">
                <button
                  @click="$router.push('/')"
                  class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View on Map
                </button>
                <button
                  @click="reportIssue"
                  class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Report an Issue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useArtworksStore } from '../stores/artworks'
import { globalModal } from '../composables/useModal'

// Props
interface Props {
  id: string
}

const props = defineProps<Props>()

// Stores and routing
const artworksStore = useArtworksStore()

// State
const loading = ref(true)
const error = ref<string | null>(null)
const currentPhotoIndex = ref(0)

// Computed
const artwork = computed(() => {
  return artworksStore.artworkById(props.id)
})

// Lifecycle
onMounted(async () => {
  try {
    loading.value = true
    error.value = null
    
    // Try to load artwork from store first
    let artworkData = artworksStore.artworkById(props.id)
    
    if (!artworkData) {
      // If not in store, fetch from API
      await artworksStore.fetchArtwork(props.id)
      artworkData = artworksStore.artworkById(props.id)
      
      if (!artworkData) {
        error.value = `Artwork with ID "${props.id}" was not found.`
        return
      }
    }
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load artwork'
  } finally {
    loading.value = false
  }
})

// Methods
function previousPhoto() {
  if (artwork.value?.photos && artwork.value.photos.length > 1) {
    currentPhotoIndex.value = 
      currentPhotoIndex.value === 0 
        ? artwork.value.photos.length - 1 
        : currentPhotoIndex.value - 1
  }
}

function nextPhoto() {
  if (artwork.value?.photos && artwork.value.photos.length > 1) {
    currentPhotoIndex.value = 
      currentPhotoIndex.value === artwork.value.photos.length - 1 
        ? 0 
        : currentPhotoIndex.value + 1
  }
}

function getArtworkTypeEmoji(type: string): string {
  const typeMap: Record<string, string> = {
    'public_art': '🎨',
    'street_art': '🎭',
    'monument': '🗿',
    'sculpture': '⚱️',
    'other': '🏛️'
  }
  return typeMap[type] || '🏛️'
}

function getArtworkTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    'public_art': 'Public Art',
    'street_art': 'Street Art',
    'monument': 'Monument',
    'sculpture': 'Sculpture',
    'other': 'Other'
  }
  return typeMap[type] || 'Unknown'
}

function getPhotoAltText(photoIndex: number): string {
  if (!artwork.value) return 'Artwork photo'
  
  const title = artwork.value.tags_parsed?.title as string
  const artist = artwork.value.tags_parsed?.artist as string
  const type = getArtworkTypeName(artwork.value.type_name)
  const photoNumber = photoIndex + 1
  const totalPhotos = artwork.value.photos?.length || 1
  
  let altText = ''
  
  if (title) {
    altText = `Photo ${photoNumber} of ${totalPhotos} of "${title}"`
    if (artist) {
      altText += ` by ${artist}`
    }
    altText += ` (${type})`
  } else if (artist) {
    altText = `Photo ${photoNumber} of ${totalPhotos} of ${type} by ${artist}`
  } else {
    altText = `Photo ${photoNumber} of ${totalPhotos} of ${type}`
  }
  
  return altText
}

function getStatusBadgeClass(status: string): string {
  const statusMap: Record<string, string> = {
    'approved': 'bg-green-100 text-green-800 border border-green-200',
    'pending': 'bg-yellow-100 text-yellow-900 border border-yellow-200',
    'removed': 'bg-red-100 text-red-800 border border-red-200'
  }
  return statusMap[status] || 'bg-gray-100 text-gray-900 border border-gray-200'
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return 'Unknown'
  }
}

function openInMaps() {
  if (artwork.value?.lat && artwork.value?.lon) {
    const url = `https://www.google.com/maps?q=${artwork.value.lat},${artwork.value.lon}`
    window.open(url, '_blank')
  }
}

async function reportIssue() {
  await globalModal.showAlert(
    'Issue reporting functionality will be implemented in a future update. If you need to report a problem with this artwork, please contact us directly.',
    'Feature Coming Soon'
  )
}
</script>

<style scoped>
.artwork-detail-view {
  min-height: 100vh;
  background-color: #f9fafb;
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

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .artwork-detail-view .grid {
    @apply grid-cols-1;
  }
  
  .sticky {
    @apply relative;
  }
}
</style>