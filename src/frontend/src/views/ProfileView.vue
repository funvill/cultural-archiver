<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { apiService } from '../services/api';
import type { SubmissionRecord } from '../../../shared/types';
import type { UserProfile } from '../types/index';

type SubmissionWithData = SubmissionRecord & {
  data_parsed?: {
    title?: string;
    photos?: { url: string }[];
    lat?: number;
    lon?: number;
    tags?: { [key: string]: any };
  };
  artwork_type_name?: string;
};

const submissions = ref<SubmissionWithData[]>([]);
const profile = ref<UserProfile | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
const filterStatus = ref('all');
const sortOrder = ref<'newest' | 'oldest'>('newest');

const filteredAndSortedSubmissions = computed(() => {
  let processed = submissions.value.map(s => {
    const data_parsed: SubmissionWithData['data_parsed'] = {};
    if (s.submission_type === 'new_artwork' || s.submission_type === 'artwork_edit') {
      if (s.field_changes) {
        try {
          const changes = JSON.parse(s.field_changes);
          data_parsed.title = changes.title?.new || changes.title;
          data_parsed.tags = changes.tags?.new || changes.tags;
        } catch (e) {
          console.error('Error parsing field_changes', e);
        }
      }
      if (s.photos) {
        try {
          data_parsed.photos = JSON.parse(s.photos);
        } catch (e) {
          console.error('Error parsing photos', e);
        }
      }
      if (s.lat !== null && s.lat !== undefined) {
        data_parsed.lat = s.lat;
      }
      if (s.lon !== null && s.lon !== undefined) {
        data_parsed.lon = s.lon;
      }
    }
    
    let artwork_type_name = 'Submission';
    if (data_parsed.tags?.artwork_type) {
      artwork_type_name = (data_parsed.tags.artwork_type as string).replace(/_/g, ' ');
    }

    return { ...s, data_parsed, artwork_type_name };
  });

  if (filterStatus.value !== 'all') {
    processed = processed.filter((s: SubmissionWithData) => s.status === filterStatus.value);
  }

  processed.sort((a: SubmissionWithData, b: SubmissionWithData) => {
    const dateA = new Date(a.submitted_at).getTime();
    const dateB = new Date(b.submitted_at).getTime();
    return sortOrder.value === 'newest' ? dateB - dateA : dateA - dateB;
  });

  return processed;
});

const submissionStats = computed(() => {
  return submissions.value.reduce(
    (acc: { total: number; pending: number; approved: number; rejected: number }, s: SubmissionWithData) => {
      acc.total++;
      if (s.status === 'pending') acc.pending++;
      else if (s.status === 'approved') acc.approved++;
      else if (s.status === 'rejected') acc.rejected++;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0 },
  );
});

async function fetchUserProfile() {
  const authStore = useAuthStore();
  if (!authStore.token) {
    error.value = 'User not authenticated.';
    isLoading.value = false;
    return;
  }
  try {
    isLoading.value = true;
    const response = await apiService.getUserProfile();
    if (response.data) {
      profile.value = response.data;
    }
    await fetchUserSubmissions();
  } catch (err) {
    error.value = 'Failed to fetch user profile.';
    console.error(err);
  } finally {
    isLoading.value = false;
  }
}

async function fetchUserSubmissions() {
  try {
    const response = await apiService.getUserSubmissions();
    if (response.data) {
      submissions.value = response.data.submissions;
    }
  } catch (err) {
    error.value = 'Failed to fetch user submissions.';
    console.error(err);
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

onMounted(fetchUserProfile);
</script>

<template>
  <div class="profile-view p-4 sm:p-6 lg:p-8">
    <div v-if="isLoading" class="text-center">
      <p>Loading profile...</p>
    </div>
    <div v-if="error" class="text-center text-red-500">
      <p>{{ error }}</p>
    </div>

    <div v-if="!isLoading && !error && profile">
      <header class="mb-8">
        <h1 class="text-3xl font-bold tracking-tight text-gray-900">My Profile</h1>
        <p class="mt-2 text-lg text-gray-600">
          Welcome back, <span class="font-semibold">{{ profile.debug?.user_info?.email || 'Contributor' }}</span>.
        </p>
      </header>

      <!-- Stats Section -->
      <section class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-sm font-medium text-gray-500">Total Submissions</h3>
          <p class="mt-2 text-3xl font-bold">{{ submissionStats.total }}</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-sm font-medium text-gray-500">Approved</h3>
          <p class="mt-2 text-3xl font-bold text-green-600">{{ submissionStats.approved }}</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-sm font-medium text-gray-500">Pending</h3>
          <p class="mt-2 text-3xl font-bold text-yellow-600">{{ submissionStats.pending }}</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-sm font-medium text-gray-500">Rejected</h3>
          <p class="mt-2 text-3xl font-bold text-red-600">{{ submissionStats.rejected }}</p>
        </div>
      </section>

      <!-- Submissions List -->
      <section>
        <div class="flex flex-wrap items-center justify-between mb-4 gap-4">
          <h2 class="text-2xl font-bold">My Submissions</h2>
          <div class="flex flex-wrap items-center gap-4">
            <div>
              <label for="filter-status" class="sr-only">Filter by status</label>
              <select
                id="filter-status"
                v-model="filterStatus"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label for="sort-order" class="sr-only">Sort order</label>
              <select
                id="sort-order"
                v-model="sortOrder"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        <div class="bg-white shadow overflow-hidden rounded-md">
          <ul role="list" class="divide-y divide-gray-200">
            <li v-for="submission in filteredAndSortedSubmissions" :key="submission.id" class="p-4 sm:p-6">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="flex-grow">
                  <div class="flex items-center gap-3">
                    <span
                      :class="getStatusClass(submission.status)"
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
                    >
                      {{ submission.status }}
                    </span>
                    <h3 class="text-lg font-semibold text-gray-800">
                      <router-link
                        v-if="submission.artwork_id"
                        :to="`/artwork/${submission.artwork_id}`"
                        class="hover:underline"
                      >
                        {{ submission.data_parsed?.title || submission.artwork_type_name || 'Artwork Submission' }}
                      </router-link>
                      <span v-else>
                        {{ submission.data_parsed?.title || submission.artwork_type_name || 'Artwork Submission' }}
                      </span>
                    </h3>
                  </div>
                  <p class="mt-1 text-sm text-gray-500">
                    Submitted on {{ formatDate(submission.submitted_at) }}
                  </p>
                </div>

                <div class="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                  <div class="flex items-center justify-end gap-4">
                    <div
                      v-if="submission.data_parsed?.photos && submission.data_parsed?.photos.length > 0"
                      class="w-16 h-16 bg-gray-100 rounded-md overflow-hidden"
                    >
                      <img
                        v-if="submission.data_parsed?.photos[0]?.url"
                        :src="submission.data_parsed?.photos[0]?.url"
                        alt="Submission photo"
                        class="w-full h-full object-cover"
                      />
                    </div>
                    <div class="text-right">
                      <p class="text-sm font-medium text-gray-900">
                        {{ submission.submission_type.replace(/_/g, ' ') }}
                      </p>
                      <p v-if="submission.lat && submission.lon" class="text-xs text-gray-500">
                        {{ submission.lat.toFixed(4) }}, {{ submission.lon.toFixed(4) }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.profile-view {
  min-height: 100vh;
  background-color: #f9fafb;
}

/* Text clamping for multiline truncation */
.line-clamp-2 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
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
    grid-template-columns: 1fr;
  }

  .profile-view .lg\:col-span-1 {
    order: 2;
  }

  .profile-view .lg\:col-span-3 {
    order: 1;
  }
}
</style>
