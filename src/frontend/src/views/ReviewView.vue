<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { globalModal } from '../composables/useModal'

// Types
interface ReviewSubmission {
  id: string
  title?: string
  note?: string
  photos: string[]
  latitude: number
  longitude: number
  type: string
  status: string
  created_at: string
  user_token: string
  priority?: 'normal' | 'high'
  nearby_artworks?: any[]
  currentPhotoIndex?: number
}

interface Statistics {
  pending: number
  approvedToday: number
  rejectedToday: number
  total: number
}

// Store and router
const authStore = useAuthStore()
const router = useRouter()

// State
const loading = ref(true)
const error = ref<string | null>(null)
const submissions = ref<ReviewSubmission[]>([])
const statistics = ref<Statistics>({
  pending: 0,
  approvedToday: 0,
  rejectedToday: 0,
  total: 0
})

const filterType = ref('all')
const sortBy = ref('created_at')
const currentPage = ref(1)
const pageSize = 6
const processingId = ref<string | null>(null)
const action = ref<'approve' | 'reject' | null>(null)

// Computed
const filteredSubmissions = computed(() => {
  let filtered = submissions.value.filter(s => s.status === 'pending')

  // Filter by type
  if (filterType.value !== 'all') {
    filtered = filtered.filter(s => s.type === filterType.value)
  }

  // Sort
  filtered.sort((a, b) => {
    if (sortBy.value === 'priority') {
      // High priority first
      if (a.priority === 'high' && b.priority !== 'high') return -1
      if (b.priority === 'high' && a.priority !== 'high') return 1
    }
    
    // Then by created date (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return filtered
})

const totalPages = computed(() => 
  Math.ceil(filteredSubmissions.value.length / pageSize)
)

const startIndex = computed(() => 
  (currentPage.value - 1) * pageSize
)

const endIndex = computed(() => 
  startIndex.value + pageSize
)

const paginatedSubmissions = computed(() => 
  filteredSubmissions.value.slice(startIndex.value, endIndex.value)
)

// Lifecycle
onMounted(() => {
  // TODO: Check if user has reviewer permissions
  loadSubmissions()
})

// Methods
async function loadSubmissions() {
  if (!authStore.token) {
    error.value = 'Authentication required for review access'
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  try {
    // Load submissions
    const submissionsResponse = await fetch('/api/review/submissions', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!submissionsResponse.ok) {
      throw new Error('Failed to load submissions for review')
    }

    const submissionsData = await submissionsResponse.json()
    submissions.value = (submissionsData.submissions || []).map((s: ReviewSubmission) => ({
      ...s,
      currentPhotoIndex: 0
    }))

    // Load statistics
    const statsResponse = await fetch('/api/review/statistics', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (statsResponse.ok) {
      const statsData = await statsResponse.json()
      statistics.value = statsData.statistics
    }

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load review data'
  } finally {
    loading.value = false
  }
}

function previousPhoto(submission: ReviewSubmission) {
  if (submission.photos && submission.photos.length > 1) {
    submission.currentPhotoIndex = 
      (submission.currentPhotoIndex || 0) === 0 
        ? submission.photos.length - 1 
        : (submission.currentPhotoIndex || 0) - 1
  }
}

function nextPhoto(submission: ReviewSubmission) {
  if (submission.photos && submission.photos.length > 1) {
    submission.currentPhotoIndex = 
      (submission.currentPhotoIndex || 0) === submission.photos.length - 1 
        ? 0 
        : (submission.currentPhotoIndex || 0) + 1
  }
}

async function approveSubmission(submission: ReviewSubmission) {
  processingId.value = submission.id
  action.value = 'approve'

  try {
    const response = await fetch(`/api/review/submissions/${submission.id}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to approve submission')
    }

    // Remove from list
    submissions.value = submissions.value.filter(s => s.id !== submission.id)
    statistics.value.pending--
    statistics.value.approvedToday++

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to approve submission'
  } finally {
    processingId.value = null
    action.value = null
  }
}

async function rejectSubmission(submission: ReviewSubmission) {
  const reason = await globalModal.showPrompt({
    title: 'Reject Submission',
    message: 'Please provide a reason for rejection (optional):',
    inputLabel: 'Reason',
    placeholder: 'Enter rejection reason...',
    multiline: true,
    maxLength: 500,
    variant: 'warning',
    confirmText: 'Reject',
    cancelText: 'Cancel'
  })
  
  // User cancelled
  if (reason === null) return
  
  processingId.value = submission.id
  action.value = 'reject'

  try {
    const response = await fetch(`/api/review/submissions/${submission.id}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    })

    if (!response.ok) {
      throw new Error('Failed to reject submission')
    }

    // Remove from list
    submissions.value = submissions.value.filter(s => s.id !== submission.id)
    statistics.value.pending--
    statistics.value.rejectedToday++

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to reject submission'
  } finally {
    processingId.value = null
    action.value = null
  }
}

function viewOnMap(submission: ReviewSubmission) {
  router.push(`/?lat=${submission.latitude}&lon=${submission.longitude}&zoom=18`)
}

async function flagForReview(submission: ReviewSubmission) {
  const reason = await globalModal.showPrompt({
    title: 'Flag for Senior Review',
    message: 'Please provide a reason for flagging this submission:',
    inputLabel: 'Reason',
    placeholder: 'Enter flag reason...',
    multiline: true,
    maxLength: 500,
    required: true,
    variant: 'warning',
    confirmText: 'Flag',
    cancelText: 'Cancel'
  })
  
  // User cancelled or no reason provided
  if (!reason) return

  try {
    const response = await fetch(`/api/review/submissions/${submission.id}/flag`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    })

    if (!response.ok) {
      throw new Error('Failed to flag submission')
    }

    submission.priority = 'high'
    
    // Show success message
    await globalModal.showAlert(
      'Submission has been flagged for senior review and moved to high priority.',
      'Flagged Successfully'
    )

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to flag submission'
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

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch {
    return 'Unknown'
  }
}
</script>

<template>
  <div class="review-view">
    <!-- Page Header -->
    <div class="bg-white border-b border-gray-200 py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Review Queue</h1>
            <p class="mt-2 text-lg text-gray-600">
              Review and moderate community submissions
            </p>
          </div>
          <div class="flex items-center space-x-4">
            <!-- Filter Controls -->
            <select
              v-model="filterType"
              class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="public_art">Public Art</option>
              <option value="street_art">Street Art</option>
              <option value="monument">Monument</option>
              <option value="sculpture">Sculpture</option>
              <option value="other">Other</option>
            </select>
            
            <select
              v-model="sortBy"
              class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="created_at">Date Submitted</option>
              <option value="priority">Priority</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Statistics Bar -->
    <div class="bg-blue-50 border-b border-blue-200 py-4">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="text-center">
            <p class="text-2xl font-bold text-blue-900">{{ statistics.pending }}</p>
            <p class="text-sm text-blue-700">Pending Review</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-green-900">{{ statistics.approvedToday }}</p>
            <p class="text-sm text-green-700">Approved Today</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-red-900">{{ statistics.rejectedToday }}</p>
            <p class="text-sm text-red-700">Rejected Today</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-gray-900">{{ statistics.total }}</p>
            <p class="text-sm text-gray-700">Total Submissions</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <svg class="animate-spin h-12 w-12 mx-auto mb-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-600">Loading submissions...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <svg class="h-12 w-12 mx-auto mb-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p class="text-gray-600 mb-4">{{ error }}</p>
        <button
          @click="loadSubmissions"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredSubmissions.length === 0" class="text-center py-12">
        <svg class="h-12 w-12 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-gray-600 mb-4">No submissions pending review</p>
        <p class="text-sm text-gray-600">Great job! All submissions have been reviewed.</p>
      </div>

      <!-- Submissions Grid -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          v-for="submission in paginatedSubmissions"
          :key="submission.id"
          class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
        >
          <!-- Photo Gallery -->
          <div class="relative">
            <div v-if="submission.photos && submission.photos.length > 0" class="aspect-w-16 aspect-h-9 bg-gray-100">
              <img
                :src="submission.photos[submission.currentPhotoIndex || 0] || ''"
                :alt="`Submission photo ${(submission.currentPhotoIndex || 0) + 1}`"
                class="w-full h-48 object-cover"
              />
              
              <!-- Photo Navigation -->
              <div v-if="submission.photos.length > 1" class="absolute inset-0 flex items-center justify-between p-2">
                <button
                  @click="previousPhoto(submission)"
                  class="bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-70"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  @click="nextPhoto(submission)"
                  class="bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-70"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              <!-- Photo Counter -->
              <div v-if="submission.photos.length > 1" class="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                {{ (submission.currentPhotoIndex || 0) + 1 }} / {{ submission.photos.length }}
              </div>
            </div>
            
            <!-- No Photos Placeholder -->
            <div v-else class="h-48 bg-gray-100 flex items-center justify-center">
              <svg class="w-12 h-12 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
              </svg>
            </div>

            <!-- Priority Badge -->
            <div 
              v-if="submission.priority === 'high'"
              class="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 text-xs font-medium rounded"
            >
              High Priority
            </div>
          </div>

          <!-- Content -->
          <div class="p-6">
            <!-- Header -->
            <div class="flex items-start justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold text-gray-900">
                  {{ submission.title || 'Untitled Submission' }}
                </h3>
                <p class="text-sm text-gray-600">
                  Submitted {{ formatDate(submission.created_at) }}
                </p>
              </div>
              <span class="text-2xl">{{ getArtworkTypeEmoji(submission.type) }}</span>
            </div>

            <!-- Description -->
            <div v-if="submission.note" class="mb-4">
              <p class="text-sm text-gray-700 line-clamp-3">{{ submission.note }}</p>
            </div>

            <!-- Metadata -->
            <div class="space-y-2 mb-4">
              <div class="flex items-center text-sm text-gray-600">
                <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                </svg>
                {{ submission.latitude?.toFixed(4) }}, {{ submission.longitude?.toFixed(4) }}
              </div>
              
              <div class="flex items-center text-sm text-gray-600">
                <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                </svg>
                User: {{ submission.user_token?.slice(0, 8) || 'Anonymous' }}...
              </div>
              
              <div v-if="submission.nearby_artworks && submission.nearby_artworks.length > 0" class="flex items-center text-sm text-yellow-600">
                <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                {{ submission.nearby_artworks.length }} nearby artwork(s)
              </div>
            </div>

            <!-- Actions -->
            <div class="flex space-x-3">
              <button
                @click="approveSubmission(submission)"
                :disabled="processingId === submission.id"
                class="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                <span v-if="processingId === submission.id && action === 'approve'" class="flex items-center justify-center">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Approving...
                </span>
                <span v-else>✓ Approve</span>
              </button>
              
              <button
                @click="rejectSubmission(submission)"
                :disabled="processingId === submission.id"
                class="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                <span v-if="processingId === submission.id && action === 'reject'" class="flex items-center justify-center">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Rejecting...
                </span>
                <span v-else>✗ Reject</span>
              </button>
            </div>

            <!-- Additional Actions -->
            <div class="mt-3 flex space-x-3 text-sm">
              <button
                @click="viewOnMap(submission)"
                class="text-blue-600 hover:text-blue-800 underline"
              >
                View on Map
              </button>
              <button
                @click="flagForReview(submission)"
                class="text-yellow-600 hover:text-yellow-800 underline"
              >
                Flag for Senior Review
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="mt-8 flex items-center justify-between">
        <div class="text-sm text-gray-700">
          Showing {{ startIndex + 1 }} to {{ Math.min(endIndex, filteredSubmissions.length) }} of {{ filteredSubmissions.length }} submissions
        </div>
        <div class="flex space-x-2">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span class="px-3 py-1 text-sm">
            Page {{ currentPage }} of {{ totalPages }}
          </span>
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-view {
  min-height: 100vh;
  background-color: #f9fafb;
}

/* Text clamping for multiline truncation */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  .review-view .grid {
    @apply grid-cols-1;
  }
}
</style>