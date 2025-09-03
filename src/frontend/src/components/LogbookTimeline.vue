<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAnnouncer } from '../composables/useAnnouncer'

// Types
interface LogbookEntry {
  id: string
  note: string | null
  photos_parsed: string[]
  created_at: string
  user_token: string
  status: 'pending' | 'approved' | 'rejected'
}

// Props interface
interface Props {
  entries: LogbookEntry[]
  loading?: boolean
  hasMore?: boolean
  perPage?: number
  emptyMessage?: string
  showPhotos?: boolean
}

// Emits interface
interface Emits {
  (e: 'loadMore'): void
  (e: 'entryClick', entry: LogbookEntry): void
  (e: 'photoClick', photoUrl: string, entry: LogbookEntry): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  hasMore: false,
  perPage: 10,
  emptyMessage: 'No journal entries available',
  showPhotos: true
})

const emit = defineEmits<Emits>()

// Announcer for screen reader feedback
const { announceInfo, announceError } = useAnnouncer()

// State
const loadingMore = ref(false)

// Computed
const sortedEntries = computed(() => {
  return [...props.entries].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
})

const hasEntries = computed(() => sortedEntries.value.length > 0)

// Methods
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    console.warn('Invalid date string:', dateString)
    return 'Unknown date'
  }
}

function formatRelativeDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) {
      return 'Today'
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7)
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30)
      return `${months} ${months === 1 ? 'month' : 'months'} ago`
    } else {
      const years = Math.floor(diffInDays / 365)
      return `${years} ${years === 1 ? 'year' : 'years'} ago`
    }
  } catch (error) {
    return 'Unknown'
  }
}

function getUserDisplayName(userToken: string): string {
  // For MVP, just show "Anonymous" or first/last few chars of token
  if (userToken.startsWith('SAMPLE')) {
    return 'Sample User'
  }
  return `User ${userToken.slice(0, 4)}...${userToken.slice(-4)}`
}

function getPhotoAltText(_photoUrl: string, entry: LogbookEntry, index: number): string {
  const totalPhotos = entry.photos_parsed.length
  const user = getUserDisplayName(entry.user_token)
  const date = formatRelativeDate(entry.created_at)
  
  return `Photo ${index + 1} of ${totalPhotos} from journal entry by ${user}, ${date}`
}

function handleEntryClick(entry: LogbookEntry): void {
  emit('entryClick', entry)
  announceInfo(`Opened journal entry from ${formatRelativeDate(entry.created_at)}`)
}

function handlePhotoClick(photoUrl: string, entry: LogbookEntry): void {
  emit('photoClick', photoUrl, entry)
  announceInfo('Opened photo in fullscreen view')
}

async function handleLoadMore(): Promise<void> {
  if (loadingMore.value || props.loading) return
  
  try {
    loadingMore.value = true
    emit('loadMore')
    announceInfo('Loading more journal entries...')
  } catch (error) {
    announceError('Failed to load more entries')
  } finally {
    loadingMore.value = false
  }
}

function truncateNote(note: string, maxLength: number = 200): { text: string; isTruncated: boolean } {
  if (note.length <= maxLength) {
    return { text: note, isTruncated: false }
  }
  
  const truncated = note.slice(0, maxLength).trim()
  const lastSpace = truncated.lastIndexOf(' ')
  const finalText = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated
  
  return { text: `${finalText}...`, isTruncated: true }
}
</script>

<template>
  <div class="logbook-timeline">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-2">Community Journal</h2>
      <p class="text-sm text-gray-600">
        Community observations and updates about this artwork
      </p>
    </div>

    <!-- Empty state -->
    <div v-if="!hasEntries && !loading" class="text-center py-8">
      <svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <p class="text-gray-500 text-lg mb-2">{{ emptyMessage }}</p>
      <p class="text-gray-400 text-sm">Be the first to add a journal entry about this artwork</p>
    </div>

    <!-- Timeline entries -->
    <div v-else-if="hasEntries" class="space-y-6">
      <article
        v-for="(entry, index) in sortedEntries"
        :key="entry.id"
        class="relative bg-white rounded-lg border border-gray-200 p-6 hover:shadow-sm transition-shadow duration-200 focus-within:ring-2 focus-within:ring-blue-500"
        :aria-label="`Journal entry ${index + 1} of ${sortedEntries.length}`"
      >
        <!-- Timeline connector (not shown for first entry) -->
        <div 
          v-if="index < sortedEntries.length - 1"
          class="absolute left-8 top-16 bottom-0 w-0.5 bg-gray-200"
          aria-hidden="true"
        />

        <!-- Entry header -->
        <div class="flex items-start space-x-4">
          <!-- Avatar/Icon -->
          <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
            </svg>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <!-- Header info -->
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="text-sm font-medium text-gray-900">
                  {{ getUserDisplayName(entry.user_token) }}
                </p>
                <p class="text-xs text-gray-500">
                  <time :datetime="entry.created_at" :title="formatDate(entry.created_at)">
                    {{ formatRelativeDate(entry.created_at) }}
                  </time>
                </p>
              </div>
              
              <!-- Entry menu button (placeholder for future features) -->
              <button
                @click="handleEntryClick(entry)"
                class="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                :aria-label="`View full entry from ${formatRelativeDate(entry.created_at)}`"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>

            <!-- Entry note -->
            <div v-if="entry.note" class="mb-4">
              <p class="text-gray-700 leading-relaxed">
                {{ truncateNote(entry.note).text }}
              </p>
              <button
                v-if="truncateNote(entry.note).isTruncated"
                @click="handleEntryClick(entry)"
                class="text-blue-600 hover:text-blue-800 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                Read more
              </button>
            </div>

            <!-- Entry photos -->
            <div v-if="showPhotos && entry.photos_parsed.length > 0" class="mb-4">
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <button
                  v-for="(photo, photoIndex) in entry.photos_parsed.slice(0, 4)"
                  :key="photoIndex"
                  @click="handlePhotoClick(photo, entry)"
                  class="relative aspect-square bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  :aria-label="getPhotoAltText(photo, entry, photoIndex)"
                >
                  <img
                    :src="photo"
                    :alt="getPhotoAltText(photo, entry, photoIndex)"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                  
                  <!-- More photos indicator -->
                  <div
                    v-if="photoIndex === 3 && entry.photos_parsed.length > 4"
                    class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-sm font-medium"
                  >
                    +{{ entry.photos_parsed.length - 4 }}
                  </div>
                </button>
              </div>
            </div>

            <!-- Status indicator (only show for non-approved entries) -->
            <div v-if="entry.status !== 'approved'" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium">
              <span
                :class="{
                  'bg-yellow-100 text-yellow-800': entry.status === 'pending',
                  'bg-red-100 text-red-800': entry.status === 'rejected'
                }"
                class="px-2 py-1 rounded-full"
              >
                {{ entry.status }}
              </span>
            </div>
          </div>
        </div>
      </article>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-8">
      <div class="text-center">
        <svg class="animate-spin h-8 w-8 mx-auto mb-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-600">Loading journal entries...</p>
      </div>
    </div>

    <!-- Load more button -->
    <div v-if="hasMore && hasEntries" class="mt-6 text-center">
      <button
        @click="handleLoadMore"
        :disabled="!!(loadingMore || loading)"
        class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg
          v-if="loadingMore"
          class="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ loadingMore ? 'Loading...' : 'Load More Entries' }}
      </button>
    </div>

    <!-- Screen reader status updates -->
    <div class="sr-only" aria-live="polite">
      <span v-if="hasEntries">
        Showing {{ sortedEntries.length }} journal entries.
        {{ hasMore ? 'More entries available.' : 'All entries loaded.' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
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

/* Loading animation */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Smooth transitions */
.logbook-timeline article {
  transition: all 0.15s ease-in-out;
}

.logbook-timeline button {
  transition: all 0.15s ease-in-out;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .logbook-timeline article {
    border-color: currentColor;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .logbook-timeline * {
    transition: none !important;
    animation: none !important;
  }
}

/* Ensure proper spacing on smaller screens */
@media (max-width: 640px) {
  .logbook-timeline article {
    padding: 1rem;
  }
  
  .logbook-timeline .space-y-6 > * + * {
    margin-top: 1rem;
  }
}
</style>