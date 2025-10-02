<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ArtworkCard from '../components/ArtworkCard.vue';
import BadgeGrid from '../components/BadgeGrid.vue';
import ProfileNameEditor from '../components/ProfileNameEditor.vue';
import { apiService } from '../services/api';
import ThemeToggle from '../components/ThemeToggle.vue';
import type { SubmissionRecord, UserBadgeResponse, ListApiResponse } from '../../../shared/types';
import type {
  UserProfile,
  SearchResult,
  ArtworkDetailResponse as ArtworkDetails,
} from '../types/index';

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

// Lists management state  
const userLists = ref<ListApiResponse[]>([]);
const listsLoading = ref(false);
const listsError = ref<string | null>(null);

function toSearchResult(submission: SubmissionWithData): SearchResult {
  // If this submission is linked to an artwork, prefer the artwork details for card display
  const linked = submission.artwork_id ? artworksById.value[submission.artwork_id] : undefined;

  // Best-effort title and artist with safe fallbacks
  const titleFromSubmission =
    submission.data_parsed?.title ||
    (submission.data_parsed?.tags?.title as string | undefined) ||
    (submission.data_parsed?.tags?.name as string | undefined) ||
    null;

  const artistFromSubmission = (submission.data_parsed?.tags?.artist as string | undefined) || null;

  const photos = submission.data_parsed?.photos || [];
  const recentPhotoFromSubmission =
    photos.length > 0 && photos[0]?.url ? String(photos[0].url) : null;

  // Determine card fields
  const id = linked?.id || submission.artwork_id || submission.id;
  const lat = linked?.lat ?? submission.lat ?? 0;
  const lon = linked?.lon ?? submission.lon ?? 0;
  const typeName =
    linked?.type_name ||
    (submission.data_parsed?.tags?.artwork_type as string) ||
    submission.artwork_type_name ||
    'artwork';

  // Title: prefer artwork.title, then submission, else explicit fallback
  const resolvedTitle =
    linked?.title && linked.title.trim().length > 0
      ? linked.title
      : titleFromSubmission && titleFromSubmission.trim().length > 0
        ? titleFromSubmission
        : 'Unknown Artwork Title';

  // Artist: prefer artwork.artist_name/created_by, then submission tag, else fallback
  const resolvedArtist =
    linked?.artist_name && linked.artist_name.trim().length > 0
      ? linked.artist_name
      : linked?.created_by && linked.created_by.trim().length > 0
        ? linked.created_by
        : artistFromSubmission && artistFromSubmission.trim().length > 0
          ? artistFromSubmission
          : 'Unknown Artist';

  // Photo and counts: prefer submission photos for the thumbnail, fallback to artwork if none
  const recentPhoto = recentPhotoFromSubmission
    ? recentPhotoFromSubmission
    : Array.isArray(linked?.photos) && linked!.photos[0]
      ? String(linked!.photos[0])
      : null;
  const photoCount =
    (photos.length || 0) > 0
      ? photos.length
      : Array.isArray(linked?.photos)
        ? linked!.photos.length
        : 0;

  const tags =
    (linked?.tags_parsed as Record<string, unknown>) ||
    (submission.data_parsed?.tags as Record<string, unknown>) ||
    null;

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
    (
      acc: { total: number; pending: number; approved: number; rejected: number },
      s: SubmissionWithData
    ) => {
      acc.total++;
      if (s.status === 'pending') acc.pending++;
      else if (s.status === 'approved') acc.approved++;
      else if (s.status === 'rejected') acc.rejected++;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0 }
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
    await Promise.all([fetchUserSubmissions(), fetchUserBadges()]);
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
    if (response && (response as any).data && (response as any).data.submissions) {
      submissions.value = (response as any).data.submissions as SubmissionWithData[];
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
  results.forEach(r => {
    if (r) {
      artworksById.value[r.id] = r.details;
    }
  });
}

function getStatusClass(status: string) {
  switch (status) {
    case 'approved':
      return 'theme-success theme-on-success';
    case 'pending':
      return 'theme-warning theme-on-warning';
    case 'rejected':
      return 'theme-error theme-on-error';
    default:
      return 'theme-surface-variant theme-on-surface-variant';
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

// Theme persistence and application moved into `ThemeToggle` component

// Computed properties to separate system and user lists
const systemLists = computed(() => {
  return userLists.value.filter((list: ListApiResponse) => list.is_system_list);
});

const customUserLists = computed(() => {
  return userLists.value.filter((list: ListApiResponse) => !list.is_system_list);
});

// Lists management methods
async function fetchUserLists() {
  try {
    listsLoading.value = true;
    listsError.value = null;
    const response = await apiService.getUserLists();

    if (response && (response as any).success && (response as any).data) {
      const listsData = (response as any).data as any[];
      // Filter out private lists (server may use visibility or is_private)
      userLists.value = listsData.filter((list) => !list.is_private && list.visibility !== 'private') as ListApiResponse[];
    } else {
      listsError.value = (response as any)?.error || 'Failed to load lists';
    }
  } catch (err) {
    console.error('Failed to fetch user lists:', err);
    listsError.value = 'Failed to load lists';
  } finally {
    listsLoading.value = false;
  }
}

function handleListClick(list: ListApiResponse) {
  router.push(`/lists/${list.id}`);
}


onMounted(() => {
  fetchUserProfile();
  fetchUserLists();
  // Theme initialization moved to main.ts (applies saved localStorage theme on startup)
});
</script>

<template>
  <div class="profile-view p-4 sm:p-6 lg:p-8">
    <div v-if="isLoading" class="text-center">
      <p>Loading profile...</p>
    </div>
    <div v-if="error" class="text-center theme-error">
      <p>{{ error }}</p>
    </div>

    <div v-if="!isLoading && !error && profile">
      <header class="mb-8">
        <h1 class="text-3xl font-bold tracking-tight theme-on-background">My Profile</h1>
        <p class="mt-2 text-lg theme-muted">
          Welcome back,
          <span class="font-semibold">{{ profile.debug?.user_info?.email || 'Contributor' }}</span
          >.
        </p>
      </header>

      <!-- Stats Section -->
      <section class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div class="p-6 rounded-lg shadow theme-surface">
          <h3 class="text-sm font-medium theme-muted">Total Submissions</h3>
          <p class="mt-2 text-3xl font-bold theme-on-surface">{{ submissionStats.total }}</p>
        </div>
        <div class="p-6 rounded-lg shadow theme-surface">
          <h3 class="text-sm font-medium theme-muted">Approved</h3>
          <p class="mt-2 text-3xl font-bold theme-on-success">{{ submissionStats.approved }}</p>
        </div>
        <div class="p-6 rounded-lg shadow theme-surface">
          <h3 class="text-sm font-medium theme-muted">Pending</h3>
          <p class="mt-2 text-3xl font-bold theme-on-warning">{{ submissionStats.pending }}</p>
        </div>
        <div class="p-6 rounded-lg shadow theme-surface">
          <h3 class="text-sm font-medium theme-muted">Rejected</h3>
          <p class="mt-2 text-3xl font-bold theme-on-error">{{ submissionStats.rejected }}</p>
        </div>
      </section>

      <!-- Profile Name Section -->
      <section class="mb-8">
        <div class="p-6 rounded-lg shadow theme-surface">
          <h2 class="text-xl font-semibold theme-on-surface mb-4">Profile Settings</h2>
            <ProfileNameEditor
            :currentProfileName="currentProfileName"
            @profileUpdated="onProfileUpdated"
          />

          <!-- Theme selector -->
          <div class="mt-6">
            <ThemeToggle />
          </div>
        </div>
      </section>

      <!-- Badges Section -->
      <section class="mb-8">
        <div class="p-6 rounded-lg shadow theme-surface">
          <BadgeGrid :badges="userBadges" :loading="badgesLoading" />
        </div>
      </section>

      <!-- My Lists Section -->
      <section class="mb-8">
        <div class="p-6 rounded-lg shadow theme-surface">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold theme-on-surface">My Lists</h2>
            <p class="text-sm theme-muted">{{ userLists.length }} lists</p>
          </div>

          <!-- Loading State -->
          <div v-if="listsLoading" class="text-center py-8">
            <div class="inline-flex items-center">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 theme-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading lists...
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="listsError" class="text-center py-8">
            <p class="theme-error">{{ listsError }}</p>
            <button 
              @click="fetchUserLists"
              class="mt-2 text-sm font-medium theme-primary"
              :style="{ color: 'var(--md-primary, #2563eb)' }"
            >
              Try Again
            </button>
          </div>

          <!-- Empty State -->
          <div v-else-if="userLists.length === 0" class="text-center py-8">
            <svg class="mx-auto h-12 w-12 mb-4 theme-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 812-2h4a2 2 0 012 2v0a2 2 0 01-2 2H10a2 2 0 01-2-2v0z" />
            </svg>
            <h3 class="text-lg font-medium theme-on-surface mb-2">No Lists Yet</h3>
            <p class="theme-on-surface-variant mb-4">Create your first list by visiting an artwork page and clicking "Add to List".</p>
            <button 
              @click="$router.push('/')"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md theme-primary theme-on-primary"
            >
              Explore Artworks
            </button>
          </div>

          <!-- Lists Content -->
          <div v-else class="space-y-8">
            <!-- System Lists Section -->
            <div v-if="systemLists.length > 0">
              <h3 class="text-lg font-semibold theme-on-surface mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2 theme-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
                </svg>
                System Lists
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div 
                  v-for="list in systemLists" 
                  :key="list.id"
                  @click="handleListClick(list)"
                  class="rounded-lg p-4 border theme-border hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <div class="flex items-start justify-between mb-3">
                    <h4 class="font-semibold theme-on-surface truncate pr-2">{{ list.name }}</h4>
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 theme-primary-container theme-on-primary-container">
                      System
                    </span>
                  </div>
                  
                  <div class="flex items-center justify-between text-sm theme-on-surface-variant">
                    <span>{{ list.item_count || 0 }} artworks</span>
                    <span>{{ formatDateSafe(list.updated_at, list.created_at) }}</span>
                  </div>
                  
                  <div class="mt-2 flex items-center text-xs theme-muted">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    {{ list.visibility === 'private' ? 'Private' : 'Unlisted' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- User Lists Section -->
            <div v-if="customUserLists.length > 0">
              <h3 class="text-lg font-semibold theme-on-surface mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2 theme-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                My Custom Lists
                <span class="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium theme-surface-variant theme-on-surface-variant">
                  {{ customUserLists.length }}
                </span>
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div 
                  v-for="list in customUserLists" 
                  :key="list.id"
                  @click="handleListClick(list)"
                  class="rounded-lg p-4 border theme-border hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <div class="flex items-start justify-between mb-3">
                    <h4 class="font-semibold theme-on-surface truncate pr-2">{{ list.name }}</h4>
                  </div>
                  
                  <div class="flex items-center justify-between text-sm theme-on-surface-variant">
                    <span>{{ list.item_count || 0 }} artworks</span>
                    <span>{{ formatDateSafe(list.updated_at, list.created_at) }}</span>
                  </div>
                  
                  <div class="mt-2 flex items-center text-xs theme-muted">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    {{ list.visibility === 'private' ? 'Private' : 'Unlisted' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty State for Custom Lists -->
            <div v-if="systemLists.length > 0 && customUserLists.length === 0" class="text-center py-6">
              <svg class="mx-auto h-10 w-10 mb-3 theme-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <h4 class="text-md font-medium theme-on-surface mb-2">Create Your First Custom List</h4>
              <p class="text-sm theme-on-surface-variant mb-3">Organize your favorite artworks into custom collections.</p>
              <button 
                @click="$router.push('/')"
                class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md theme-primary theme-on-primary"
              >
                Browse Artworks
              </button>
            </div>
          </div>
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
              <span class="text-xs theme-outline">
                {{ submission.submission_type.replace(/_/g, ' ') }}
              </span>
              <span class="text-xs theme-outline">
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
  background-color: var(--md-content-background, #f9fafb);
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
