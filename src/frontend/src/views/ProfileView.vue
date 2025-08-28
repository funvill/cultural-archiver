<template>
  <div class="profile-view">
    <!-- Page Header -->
    <div class="bg-white border-b border-gray-200 py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">My Profile</h1>
            <p class="mt-2 text-lg text-gray-600">
              Manage your submissions and account settings
            </p>
          </div>
          <div class="flex items-center space-x-3">
            <div class="text-right">
              <p class="text-sm font-medium text-gray-900">
                {{ authStore.isEmailVerified ? 'Verified User' : 'Anonymous User' }}
              </p>
              <p class="text-xs text-gray-600">
                {{ authStore.token ? `ID: ${authStore.token.slice(0, 8)}...` : 'Not authenticated' }}
              </p>
            </div>
            <div 
              class="w-10 h-10 rounded-full flex items-center justify-center"
              :class="authStore.isEmailVerified ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <!-- Sidebar -->
        <div class="lg:col-span-1">
          <nav class="space-y-1">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors"
              :class="activeTab === tab.id 
                ? 'bg-blue-100 text-blue-700' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'"
            >
              <div class="flex items-center">
                <component :is="tab.icon" class="mr-3 h-5 w-5" />
                {{ tab.name }}
                <span v-if="tab.count !== undefined" class="ml-auto text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                  {{ tab.count }}
                </span>
              </div>
            </button>
          </nav>
        </div>

        <!-- Content Area -->
        <div class="lg:col-span-3">
          <!-- Statistics Cards -->
          <div v-if="activeTab === 'overview'" class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg border border-gray-200">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div class="ml-4">
                  <p class="text-sm font-medium text-gray-600">Total Submissions</p>
                  <p class="text-2xl font-semibold text-gray-900">{{ submissions.length }}</p>
                </div>
              </div>
            </div>

            <div class="bg-white p-6 rounded-lg border border-gray-200">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div class="ml-4">
                  <p class="text-sm font-medium text-gray-600">Approved</p>
                  <p class="text-2xl font-semibold text-gray-900">{{ approvedCount }}</p>
                </div>
              </div>
            </div>

            <div class="bg-white p-6 rounded-lg border border-gray-200">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div class="ml-4">
                  <p class="text-sm font-medium text-gray-600">Pending Review</p>
                  <p class="text-2xl font-semibold text-gray-900">{{ pendingCount }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Submissions List -->
          <div class="bg-white rounded-lg border border-gray-200">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200">
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-gray-900">
                  {{ getTabTitle(activeTab) }}
                </h2>
                <div class="flex items-center space-x-2">
                  <select
                    v-model="sortBy"
                    class="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="created_at">Date Created</option>
                    <option value="status">Status</option>
                  </select>
                  <button
                    @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
                    class="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100"
                  >
                    {{ sortOrder === 'asc' ? '↑' : '↓' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="p-8 text-center">
              <svg class="animate-spin h-8 w-8 mx-auto mb-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p class="text-gray-600">Loading submissions...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="p-8 text-center">
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
            <div v-else-if="filteredSubmissions.length === 0" class="p-8 text-center">
              <svg class="h-12 w-12 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p class="text-gray-600 mb-4">
                {{ activeTab === 'overview' ? 'No submissions yet' : `No ${activeTab} submissions` }}
              </p>
              <button
                @click="$router.push('/submit')"
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Submit Your First Artwork
              </button>
            </div>

            <!-- Submissions List -->
            <div v-else class="divide-y divide-gray-200">
              <div
                v-for="submission in paginatedSubmissions"
                :key="submission.id"
                class="p-6 hover:bg-gray-50 transition-colors"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <!-- Submission Header -->
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center space-x-3">
                        <h3 class="text-lg font-medium text-gray-900">
                          {{ submission.title || 'Untitled Submission' }}
                        </h3>
                        <span 
                          class="inline-block px-2 py-1 text-xs font-medium rounded-full"
                          :class="getStatusBadgeClass(submission.status)"
                        >
                          {{ submission.status }}
                        </span>
                      </div>
                      <div class="text-sm text-gray-600">
                        {{ formatDate(submission.created_at) }}
                      </div>
                    </div>

                    <!-- Photos Preview -->
                    <div v-if="submission.photos && submission.photos.length > 0" class="flex space-x-2 mb-3">
                      <img
                        v-for="(photo, index) in submission.photos.slice(0, 3)"
                        :key="index"
                        :src="photo"
                        :alt="`Photo ${index + 1}`"
                        class="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                      <div
                        v-if="submission.photos.length > 3"
                        class="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-xs text-gray-600"
                      >
                        +{{ submission.photos.length - 3 }}
                      </div>
                    </div>

                    <!-- Description -->
                    <p v-if="submission.note" class="text-sm text-gray-700 mb-3 line-clamp-2">
                      {{ submission.note }}
                    </p>

                    <!-- Location -->
                    <div class="flex items-center text-sm text-gray-600 mb-3">
                      <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                      </svg>
                      {{ submission.latitude?.toFixed(4) }}, {{ submission.longitude?.toFixed(4) }}
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center space-x-4">
                      <button
                        v-if="submission.artwork_id"
                        @click="$router.push(`/artwork/${submission.artwork_id}`)"
                        class="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        View Artwork →
                      </button>
                      <button
                        @click="viewSubmissionDetails(submission)"
                        class="text-sm text-gray-600 hover:text-gray-800 underline"
                      >
                        View Details
                      </button>
                      <button
                        v-if="submission.status === 'pending'"
                        @click="editSubmission(submission)"
                        class="text-sm text-gray-600 hover:text-gray-800 underline"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="px-6 py-4 border-t border-gray-200">
              <div class="flex items-center justify-between">
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

// Types
interface Submission {
  id: string
  title?: string
  note?: string
  photos: string[]
  latitude: number
  longitude: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  artwork_id?: string
}

// Store and router
const authStore = useAuthStore()

// State
const loading = ref(true)
const error = ref<string | null>(null)
const submissions = ref<Submission[]>([])
const activeTab = ref('overview')
const sortBy = ref('created_at')
const sortOrder = ref<'asc' | 'desc'>('desc')
const currentPage = ref(1)
const pageSize = 10

// Tab configuration
const tabs = computed(() => [
  {
    id: 'overview',
    name: 'Overview',
    icon: 'svg',
    count: submissions.value.length
  },
  {
    id: 'pending',
    name: 'Pending',
    icon: 'svg',
    count: pendingCount.value
  },
  {
    id: 'approved',
    name: 'Approved',
    icon: 'svg',
    count: approvedCount.value
  },
  {
    id: 'rejected',
    name: 'Rejected',
    icon: 'svg',
    count: rejectedCount.value
  }
])

// Computed
const approvedCount = computed(() => 
  submissions.value.filter(s => s.status === 'approved').length
)

const pendingCount = computed(() => 
  submissions.value.filter(s => s.status === 'pending').length
)

const rejectedCount = computed(() => 
  submissions.value.filter(s => s.status === 'rejected').length
)

const filteredSubmissions = computed(() => {
  let filtered = submissions.value

  // Filter by tab
  if (activeTab.value !== 'overview') {
    filtered = filtered.filter(s => s.status === activeTab.value)
  }

  // Sort
  filtered.sort((a, b) => {
    let aVal: any = a[sortBy.value as keyof Submission]
    let bVal: any = b[sortBy.value as keyof Submission]

    if (sortBy.value === 'created_at') {
      aVal = new Date(aVal).getTime()
      bVal = new Date(bVal).getTime()
    }

    if (sortOrder.value === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
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
  loadSubmissions()
})

// Methods
async function loadSubmissions() {
  if (!authStore.token) {
    error.value = 'Please log in to view your submissions'
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  try {
    const response = await fetch('/api/user/submissions', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to load submissions')
    }

    const data = await response.json()
    submissions.value = data.submissions || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load submissions'
  } finally {
    loading.value = false
  }
}

function getTabTitle(tabId: string): string {
  const titleMap: Record<string, string> = {
    'overview': 'All Submissions',
    'pending': 'Pending Review',
    'approved': 'Approved Submissions',
    'rejected': 'Rejected Submissions'
  }
  return titleMap[tabId] || 'Submissions'
}

function getStatusBadgeClass(status: string): string {
  const statusMap: Record<string, string> = {
    'approved': 'bg-green-100 text-green-800 border border-green-200',
    'pending': 'bg-yellow-100 text-yellow-900 border border-yellow-200',
    'rejected': 'bg-red-100 text-red-800 border border-red-200'
  }
  return statusMap[status] || 'bg-gray-100 text-gray-900 border border-gray-200'
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return 'Unknown'
  }
}

function viewSubmissionDetails(submission: Submission) {
  // TODO: Implement submission details modal or page
  console.log('View submission details:', submission)
}

function editSubmission(submission: Submission) {
  // TODO: Implement submission editing
  console.log('Edit submission:', submission)
}
</script>

<style scoped>
.profile-view {
  min-height: 100vh;
  background-color: #f9fafb;
}

/* Text clamping for multiline truncation */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  .profile-view .grid {
    @apply grid-cols-1;
  }
  
  .profile-view .lg\:col-span-1 {
    @apply order-2;
  }
  
  .profile-view .lg\:col-span-3 {
    @apply order-1;
  }
}
</style>