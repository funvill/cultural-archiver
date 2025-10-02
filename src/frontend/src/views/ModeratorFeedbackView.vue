<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { apiService } from '../services/api';
import type { FeedbackRecord } from '../../../shared/types';

// Router and auth
const router = useRouter();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref<string | null>(null);
const feedback = ref<FeedbackRecord[]>([]);
const total = ref(0);
const currentPage = ref(1);
const perPage = ref(20);

// Filters
const statusFilter = ref<'open' | 'archived' | 'resolved' | 'all'>('open');
const subjectTypeFilter = ref<'all' | 'artwork' | 'artist'>('all');
const issueTypeFilter = ref<'all' | 'missing' | 'incorrect_info' | 'other' | 'comment'>('all');

// Review state
const reviewingId = ref<string | null>(null);
const reviewAction = ref<'archive' | 'resolve' | null>(null);
const reviewNotes = ref('');
const showReviewDialog = ref(false);
const selectedFeedback = ref<FeedbackRecord | null>(null);

// Computed
const filteredFeedback = computed(() => {
  return feedback.value;
});

const hasMore = computed(() => {
  return currentPage.value * perPage.value < total.value;
});

const statistics = computed(() => {
  const stats = {
    total: total.value,
    open: 0,
    archived: 0,
    resolved: 0,
  };

  feedback.value.forEach(item => {
    if (item.status === 'open') stats.open++;
    else if (item.status === 'archived') stats.archived++;
    else if (item.status === 'resolved') stats.resolved++;
  });

  return stats;
});

// Methods
async function loadFeedback() {
  try {
    loading.value = true;
    error.value = null;

    const params = new URLSearchParams({
      page: currentPage.value.toString(),
      per_page: perPage.value.toString(),
    });

    if (statusFilter.value !== 'all') {
      params.append('status', statusFilter.value);
    }
    if (subjectTypeFilter.value !== 'all') {
      params.append('subject_type', subjectTypeFilter.value);
    }
    if (issueTypeFilter.value !== 'all') {
      params.append('issue_type', issueTypeFilter.value);
    }

    const response = (await apiService.get(`/moderation/feedback?${params.toString()}`)) as {
      success: boolean;
      data?: { feedback: FeedbackRecord[]; total: number };
      error?: string;
    };

    if (response.success && response.data) {
      feedback.value = response.data.feedback || [];
      total.value = response.data.total || 0;
    } else {
      throw new Error(response.error || 'Failed to load feedback');
    }
  } catch (err) {
    console.error('Error loading feedback:', err);
    
    // Check for authentication error
    if (err instanceof Error && err.message.includes('403')) {
      router.push('/?error=reviewer_required');
      return;
    }
    
    error.value = err instanceof Error ? err.message : 'Failed to load feedback';
  } finally {
    loading.value = false;
  }
}

function openReviewDialog(item: FeedbackRecord, action: 'archive' | 'resolve') {
  selectedFeedback.value = item;
  reviewAction.value = action;
  reviewNotes.value = '';
  showReviewDialog.value = true;
}

async function submitReview() {
  if (!selectedFeedback.value || !reviewAction.value) return;

  try {
    reviewingId.value = selectedFeedback.value.id;

    const response = (await apiService.post(
      `/moderation/feedback/${selectedFeedback.value.id}/review`,
      {
        action: reviewAction.value,
        review_notes: reviewNotes.value.trim() || undefined,
      }
    )) as {
      success: boolean;
      error?: string;
    };

    if (!response.success) {
      throw new Error(response.error || 'Failed to review feedback');
    }

    // Close dialog and refresh
    showReviewDialog.value = false;
    selectedFeedback.value = null;
    reviewAction.value = null;
    reviewNotes.value = '';
    
    // Reload feedback list
    await loadFeedback();
  } catch (err) {
    console.error('Error reviewing feedback:', err);
    error.value = err instanceof Error ? err.message : 'Failed to review feedback';
  } finally {
    reviewingId.value = null;
  }
}

function cancelReview() {
  showReviewDialog.value = false;
  selectedFeedback.value = null;
  reviewAction.value = null;
  reviewNotes.value = '';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

function getIssueTypeLabel(issueType: string): string {
  const labels: Record<string, string> = {
    missing: 'Missing',
    incorrect_info: 'Incorrect Info',
    other: 'Other',
    comment: 'Comment',
  };
  return labels[issueType] || issueType;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-800',
    archived: 'bg-gray-100 text-gray-800',
    resolved: 'bg-green-100 text-green-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function nextPage() {
  if (hasMore.value) {
    currentPage.value++;
    loadFeedback();
  }
}

function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
    loadFeedback();
  }
}

function applyFilters() {
  currentPage.value = 1;
  loadFeedback();
}

// Lifecycle
onMounted(() => {
  // Check permissions
  if (!authStore.canReview) {
    router.push('/?error=reviewer_required');
    return;
  }

  loadFeedback();
});
</script>

<template>
  <div class="moderator-feedback-view min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Feedback Moderation</h1>
            <p class="mt-2 text-lg text-gray-600">Review user-reported issues and feedback</p>
          </div>
          <div>
            <router-link
              to="/review"
              class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              Review Queue
            </router-link>
          </div>
        </div>

        <!-- Statistics -->
        <div class="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-yellow-50 rounded-lg p-4 text-center">
            <p class="text-2xl font-bold text-yellow-900">{{ statistics.open }}</p>
            <p class="text-sm text-yellow-700">Open</p>
          </div>
          <div class="bg-green-50 rounded-lg p-4 text-center">
            <p class="text-2xl font-bold text-green-900">{{ statistics.resolved }}</p>
            <p class="text-sm text-green-700">Resolved</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-4 text-center">
            <p class="text-2xl font-bold text-gray-900">{{ statistics.archived }}</p>
            <p class="text-sm text-gray-700">Archived</p>
          </div>
          <div class="bg-blue-50 rounded-lg p-4 text-center">
            <p class="text-2xl font-bold text-blue-900">{{ statistics.total }}</p>
            <p class="text-sm text-blue-700">Total</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status-filter"
              v-model="statusFilter"
              @change="applyFilters"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="archived">Archived</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div>
            <label for="subject-type-filter" class="block text-sm font-medium text-gray-700 mb-1">
              Subject Type
            </label>
            <select
              id="subject-type-filter"
              v-model="subjectTypeFilter"
              @change="applyFilters"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="artwork">Artwork</option>
              <option value="artist">Artist</option>
            </select>
          </div>

          <div>
            <label for="issue-type-filter" class="block text-sm font-medium text-gray-700 mb-1">
              Issue Type
            </label>
            <select
              id="issue-type-filter"
              v-model="issueTypeFilter"
              @change="applyFilters"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="missing">Missing</option>
              <option value="incorrect_info">Incorrect Info</option>
              <option value="comment">Comment</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div class="flex items-end">
            <button
              @click="loadFeedback"
              class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <svg
          class="animate-spin h-12 w-12 mx-auto mb-4 text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p class="text-gray-600">Loading feedback...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12 bg-white rounded-lg shadow">
        <svg
          class="w-16 h-16 mx-auto mb-4 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <p class="text-gray-600 mb-4">{{ error }}</p>
        <button
          @click="loadFeedback"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="filteredFeedback.length === 0"
        class="text-center py-12 bg-white rounded-lg shadow"
      >
        <svg
          class="w-16 h-16 mx-auto mb-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">No Feedback Found</h3>
        <p class="text-gray-600">
          {{ statusFilter === 'open' ? 'All feedback has been reviewed!' : 'No feedback matches the selected filters.' }}
        </p>
      </div>

      <!-- Feedback List -->
      <div v-else class="space-y-4">
        <div
          v-for="item in filteredFeedback"
          :key="item.id"
          class="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <!-- Header -->
              <div class="flex items-center gap-3 mb-3">
                <span
                  :class="getStatusColor(item.status)"
                  class="px-2 py-1 text-xs font-medium rounded"
                >
                  {{ item.status.toUpperCase() }}
                </span>
                <span class="text-sm text-gray-500">
                  {{ item.subject_type === 'artwork' ? '🎨 Artwork' : '👤 Artist' }}
                </span>
                <span class="text-sm text-gray-500">•</span>
                <span class="text-sm text-gray-500">
                  {{ getIssueTypeLabel(item.issue_type) }}
                </span>
                <span class="text-sm text-gray-500">•</span>
                <span class="text-sm text-gray-500">{{ formatDate(item.created_at) }}</span>
              </div>

              <!-- Feedback Note -->
              <p class="text-gray-900 mb-3 whitespace-pre-wrap">{{ item.note }}</p>

              <!-- Subject Link -->
              <div class="mb-3">
                <router-link
                  :to="`/${item.subject_type}s/${item.subject_id}`"
                  class="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  target="_blank"
                >
                  View {{ item.subject_type }} →
                </router-link>
              </div>

              <!-- Review Info (if reviewed) -->
              <div v-if="item.reviewed_at" class="mt-3 pt-3 border-t border-gray-200">
                <p class="text-sm text-gray-600">
                  Reviewed {{ formatDate(item.reviewed_at) }}
                  <span v-if="item.review_notes" class="ml-2">
                    - {{ item.review_notes }}
                  </span>
                </p>
              </div>
            </div>

            <!-- Actions -->
            <div v-if="item.status === 'open'" class="flex flex-col gap-2 ml-4">
              <button
                @click="openReviewDialog(item, 'resolve')"
                :disabled="!!reviewingId"
                class="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Resolve
              </button>
              <button
                @click="openReviewDialog(item, 'archive')"
                :disabled="!!reviewingId"
                class="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="!loading && filteredFeedback.length > 0" class="mt-6 flex items-center justify-between bg-white rounded-lg shadow p-4">
        <div class="text-sm text-gray-700">
          Showing {{ (currentPage - 1) * perPage + 1 }} to {{ Math.min(currentPage * perPage, total) }} of {{ total }} feedback items
        </div>
        <div class="flex gap-2">
          <button
            @click="previousPage"
            :disabled="currentPage === 1"
            class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            @click="nextPage"
            :disabled="!hasMore"
            class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Review Dialog -->
    <div
      v-if="showReviewDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="cancelReview"
    >
      <div class="w-full max-w-lg bg-white rounded-lg shadow-xl p-6">
        <h3 class="text-xl font-semibold mb-3">
          {{ reviewAction === 'resolve' ? 'Resolve Feedback' : 'Archive Feedback' }}
        </h3>
        <p class="text-sm text-gray-600 mb-4">
          {{ reviewAction === 'resolve' 
            ? 'Mark this feedback as resolved. This indicates the issue has been addressed.' 
            : 'Archive this feedback. This hides it from the queue without taking action.' 
          }}
        </p>

        <div class="mb-4">
          <label for="review-notes" class="block text-sm font-medium text-gray-700 mb-1">
            Review Notes (optional)
          </label>
          <textarea
            id="review-notes"
            v-model="reviewNotes"
            placeholder="Add any notes about your decision..."
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div class="flex justify-end gap-3">
          <button
            @click="cancelReview"
            :disabled="!!reviewingId"
            class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            @click="submitReview"
            :disabled="!!reviewingId"
            :class="reviewAction === 'resolve' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'"
            class="px-4 py-2 text-white rounded-md disabled:opacity-50 transition-colors"
          >
            {{ reviewingId ? 'Processing...' : (reviewAction === 'resolve' ? 'Resolve' : 'Archive') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
</style>
