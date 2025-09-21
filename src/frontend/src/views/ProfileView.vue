<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ArtworkCard from '../components/ArtworkCard.vue';
import BadgeGrid from '../components/BadgeGrid.vue';
import ProfileNameEditor from '../components/ProfileNameEditor.vue';
import { apiService } from '../services/api';
import type { SubmissionRecord, UserBadgeResponse } from '../../../shared/types';
import type { UserProfile, SearchResult, ArtworkDetailResponse as ArtworkDetails } from '../types/index';

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
const router = useRouter();
// Cache of linked artwork details by ID for better cards
const artworksById = ref<Record<string, ArtworkDetails>>({});

// Badge system state
const userBadges = ref<UserBadgeResponse['user_badges']>([]);
const badgesLoading = ref(false);
const currentProfileName = ref<string | null>(null);

function toSearchResult(submission: SubmissionWithData): SearchResult {
  // If this submission is linked to an artwork, prefer the artwork details for card display
  const linked = submission.artwork_id ? artworksById.value[submission.artwork_id] : undefined;

  // Best-effort title and artist with safe fallbacks
  const titleFromSubmission = submission.data_parsed?.title ||
    (submission.data_parsed?.tags?.title as string | undefined) ||
    (submission.data_parsed?.tags?.name as string | undefined) ||
    null;

  const artistFromSubmission = (submission.data_parsed?.tags?.artist as string | undefined) || null;

  const photos = submission.data_parsed?.photos || [];
  const recentPhotoFromSubmission = photos.length > 0 && photos[0]?.url ? String(photos[0].url) : null;

  // Determine card fields
  const id = linked?.id || submission.artwork_id || submission.id;
  const lat = linked?.lat ?? submission.lat ?? 0;
  const lon = linked?.lon ?? submission.lon ?? 0;
  const typeName = linked?.type_name || (submission.data_parsed?.tags?.artwork_type as string) || submission.artwork_type_name || 'artwork';

  // Title: prefer artwork.title, then submission, else explicit fallback
  const resolvedTitle = (linked?.title && linked.title.trim().length > 0)
    ? linked.title
    : (titleFromSubmission && titleFromSubmission.trim().length > 0)
      ? titleFromSubmission
      : 'Unknown Artwork Title';

  // Artist: prefer artwork.artist_name/created_by, then submission tag, else fallback
  const resolvedArtist = (linked?.artist_name && linked.artist_name.trim().length > 0)
    ? linked.artist_name
    : (linked?.created_by && linked.created_by.trim().length > 0)
      ? linked.created_by
      : (artistFromSubmission && artistFromSubmission.trim().length > 0)
        ? artistFromSubmission
        : 'Unknown Artist';

  // Photo and counts: prefer submission photos for the thumbnail, fallback to artwork if none
  const recentPhoto = recentPhotoFromSubmission
    ? recentPhotoFromSubmission
    : (Array.isArray(linked?.photos) && linked!.photos[0])
      ? String(linked!.photos[0])
      : null;
  const photoCount = (photos.length || 0) > 0
    ? photos.length
    : (Array.isArray(linked?.photos) ? linked!.photos.length : 0);

  const tags = (linked?.tags_parsed as Record<string, unknown>) || (submission.data_parsed?.tags as Record<string, unknown>) || null;

  return {
    id,
    lat,
    lon,
    type_name: String(typeName),
    title: resolvedTitle,
    artist_name: resolvedArtist,
    tags,
    recent_photo: recentPhoto,
    photo_count: photoCount,
    distance_km: null,
  };
}

function onCardClick(artwork: SearchResult): void {
  // Only navigate if this submission is linked to an existing artwork
  if (
    artwork &&
    artwork.id &&
    submissions.value.some((s: SubmissionWithData) => s.artwork_id === artwork.id)
  ) {
    router.push(`/artwork/${artwork.id}`);
  }
}

const filteredAndSortedSubmissions = computed(() => {
  let processed = submissions.value.map((s: SubmissionWithData) => {
    const data_parsed: SubmissionWithData['data_parsed'] = {};
    // Parse field_changes to extract proposed title/tags when present
    if (s.field_changes) {
      try {
        const changes = JSON.parse(s.field_changes);
        data_parsed.title = changes.title?.new || changes.title;
        data_parsed.tags = changes.tags?.new || changes.tags;
      } catch (e) {
        console.error('Error parsing field_changes', e);
      }
    }
    // Always attempt to parse photos JSON if present (applies to artwork_photos/logbook entries too)
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
  try {
    isLoading.value = true;
    const response = await apiService.getUserProfile();
    if (response.data) {
      profile.value = response.data;
      // Extract profile name from the response (may not be available in current UserProfile type)
      // TODO: Update UserProfile type to include profile_name when backend is updated
      currentProfileName.value = null;
    }
    await Promise.all([
      fetchUserSubmissions(),
      fetchUserBadges()
    ]);
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
      // Fetch linked artwork details for better cards (title/photo/artist)
      await fetchLinkedArtworks();
    }
  } catch (err) {
    error.value = 'Failed to fetch user submissions.';
    console.error(err);
  }
}

async function fetchLinkedArtworks() {
  const ids: string[] = Array.from(
    new Set(
      submissions.value
        .map((s: SubmissionWithData) => s.artwork_id)
        .filter((id: string | null): id is string => !!id)
    )
  );
  const missing: string[] = ids.filter((id: string) => !artworksById.value[id]);
  if (missing.length === 0) return;
  const results = await Promise.all(
    missing.map(async (id: string) => {
      try {
        const details = await apiService.getArtworkDetails(id);
        return { id, details } as { id: string; details: ArtworkDetails };
      } catch (e) {
        console.warn('Failed to load artwork details for submission', id, e);
        return null;
      }
    })
  );
  results.forEach((r) => {
    if (r) {
      artworksById.value[r.id] = r.details;
    }
  });
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

function formatDateSafe(primary?: string | null, fallback?: string | null) {
  const dStr = primary || fallback || '';
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Badge system methods
async function fetchUserBadges() {
  try {
    badgesLoading.value = true;
    const response = await apiService.getUserBadges();
    if (response.success && response.data) {
      userBadges.value = response.data.user_badges;
    }
  } catch (err) {
    console.error('Failed to fetch user badges:', err);
    // Don't show error for badges, just fail silently
  } finally {
    badgesLoading.value = false;
  }
}

function onProfileUpdated(newProfileName: string) {
  currentProfileName.value = newProfileName;
  // Optionally refetch profile data
  // fetchUserProfile();
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

      <!-- Profile Name Section -->
      <section class="mb-8">
        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Profile Settings</h2>
          <ProfileNameEditor 
            :currentProfileName="currentProfileName"
            @profile-updated="onProfileUpdated"
          />
        </div>
      </section>

      <!-- Badges Section -->
      <section class="mb-8">
        <div class="bg-white p-6 rounded-lg shadow">
          <BadgeGrid :badges="userBadges" :loading="badgesLoading" />
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

        <!-- Use the same grid sizing as search results -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="submission in filteredAndSortedSubmissions" :key="submission.id">
            <ArtworkCard
              :artwork="toSearchResult(submission)"
              :clickable="!!submission.artwork_id"
              :show-distance="false"
              @click="onCardClick"
            >
              <!-- Moderation state badge on thumbnail -->
              <template #badge>
                <span
                  :class="getStatusClass(submission.status)"
                  class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-opacity-90"
                >
                  {{ submission.status.charAt(0).toUpperCase() + submission.status.slice(1) }}
                </span>
              </template>
            </ArtworkCard>

            <!-- Meta below the card -->
            <div class="mt-2 flex items-center justify-between">
              <span class="text-xs text-gray-500">
                {{ submission.submission_type.replace(/_/g, ' ') }}
              </span>
              <span class="text-xs text-gray-500">
                {{ formatDateSafe(submission.submitted_at, submission.created_at) }}
                <span v-if="submission.lat && submission.lon">
                  • {{ submission.lat.toFixed(4) }}, {{ submission.lon.toFixed(4) }}
                </span>
              </span>
            </div>
          </div>
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
