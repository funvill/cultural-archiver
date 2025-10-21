<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useArtworksStore } from '../stores/artworks';
import { globalModal } from '../composables/useModal';
import { useToasts } from '../composables/useToasts';
import { useAnalytics } from '../composables/useAnalytics';
import { apiService, getErrorMessage } from '../services/api';
import { createApiUrl } from '../utils/api-config';
import ArtworkEditDiffs from '../components/ArtworkEditDiffs.vue';
import ArtistEditDiffs from '../components/ArtistEditDiffs.vue';
import type { ArtworkEditReviewData, FeedbackRecord } from '../../../shared/types';

// Initialize analytics
const analytics = useAnalytics();

// Types
interface ReviewSubmission {
  id: string;
  // If the submission already has an associated artwork record (pending or linked), include it
  artwork_id?: string;
  title?: string;
  note?: string;
  photos: string[];
  latitude: number;
  longitude: number;
  type: string;
  status: string;
  created_at: string;
  user_token: string;
  priority?: 'normal' | 'high';
  nearby_artworks?: any[];
  currentPhotoIndex?: number;
}

interface Statistics {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  total: number;
}

// Store and router
const authStore = useAuthStore();
const artworksStore = useArtworksStore();
const router = useRouter();
const route = useRoute();

// State
const loading = ref(true);
const error = ref<string | null>(null);
const submissions = ref<ReviewSubmission[]>([]);
const artworkEdits = ref<ArtworkEditReviewData[]>([]);
const feedback = ref<FeedbackRecord[]>([]);
const feedbackTotal = ref(0);
const currentTab = ref<'submissions' | 'edits' | 'artist-edits' | 'feedback'>('submissions');
const statistics = ref<Statistics>({
  pending: 0,
  approvedToday: 0,
  rejectedToday: 0,
  total: 0,
});

const filterType = ref('all');
// Search box for locating a specific submission/artwork UUID
const searchId = ref('');
const sortBy = ref('created_at');
const currentPage = ref(1);
const pageSize = 6;
const processingId = ref<string | null>(null);
const action = ref<'approve' | 'reject' | null>(null);

// Computed
const filteredSubmissions = computed(() => {
  if (currentTab.value !== 'submissions') return [];

  const searching = !!searchId.value.trim();

  // If searching, start from ALL submissions (any status) so deep links work even if status changed.
  // Otherwise default to pending-only view.
  let base = searching
    ? submissions.value.slice()
    : submissions.value.filter((s: ReviewSubmission) => s.status === 'pending');

  // Filter by type only when not searching (keep search broad). If searching and filterType != all, still respect filter.
  if (filterType.value !== 'all') {
    base = base.filter((s: ReviewSubmission) => s.type === filterType.value);
  }

  if (searching) {
    const term = searchId.value.trim().toLowerCase();
    base = base.filter((s: ReviewSubmission) => {
      if (s.id.toLowerCase().includes(term)) return true;
      if (s.artwork_id && s.artwork_id.toLowerCase().includes(term)) return true;
      return false;
    });
  }

  // Sort: prioritize pending + high priority when mixed results from search
  base.sort((a: ReviewSubmission, b: ReviewSubmission) => {
    if (sortBy.value === 'priority') {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
    }
    // Keep pending before non-pending when searching to surface actionable items
    if (searching && a.status !== b.status) {
      if (a.status === 'pending') return -1;
      if (b.status === 'pending') return 1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return base;
});

const filteredArtworkEdits = computed(() => {
  if (currentTab.value !== 'edits') return [];

  let filtered = artworkEdits.value.slice();

  if (searchId.value.trim()) {
    const term = searchId.value.trim().toLowerCase();
    filtered = filtered.filter(
      (e: any) =>
        (e.id && e.id.toLowerCase().includes(term)) ||
        (e.artwork_id && e.artwork_id.toLowerCase().includes(term))
    );
  }

  // Sort by submitted date (newest first)
  filtered.sort((a: any, b: any) => {
    return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
  });

  return filtered;
});

const totalPages = computed(() => {
  const items =
    currentTab.value === 'submissions' ? filteredSubmissions.value : filteredArtworkEdits.value;
  return Math.ceil(items.length / pageSize);
});

const startIndex = computed(() => (currentPage.value - 1) * pageSize);

const endIndex = computed(() => startIndex.value + pageSize);

const paginatedSubmissions = computed(() =>
  filteredSubmissions.value.slice(startIndex.value, endIndex.value)
);

const paginatedArtworkEdits = computed(() =>
  filteredArtworkEdits.value.slice(startIndex.value, endIndex.value)
);

const filteredArtistEdits = computed(() => {
  if (currentTab.value !== 'artist-edits') return [];
  let filtered = artistEdits.value.slice();
  if (searchId.value.trim()) {
    const term = searchId.value.trim().toLowerCase();
    filtered = filtered.filter(
      (e: any) => (e.id && e.id.toLowerCase().includes(term)) || (e.artist_id && e.artist_id.toLowerCase().includes(term))
    );
  }
  filtered.sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  return filtered;
});

const paginatedArtistEdits = computed(() => filteredArtistEdits.value.slice(startIndex.value, endIndex.value));

// Lifecycle
onMounted(() => {
  // Pre-populate search from query parameter (deep link support)
  const initial = (route.query.searchId as string) || '';
  if (initial) {
    searchId.value = initial;
  }
  loadData();
});

// Sync searchId changes into the route query (replace to avoid history spam)
watch(searchId, (val: string) => {
  const q = { ...route.query } as Record<string, any>;
  if (val) q.searchId = val;
  else delete q.searchId;
  router.replace({ query: q });
  currentPage.value = 1; // reset pagination when searching
  // Attempt on-demand fetch of a specific submission if not already present
  if (val.trim()) {
    ensureSubmissionLoaded(val.trim());
  }
});

// Methods
async function loadData() {
  if (!authStore.token) {
    await globalModal.showError(
      'You must be signed in to access the review queue.',
      'Authentication Required'
    );
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
  await Promise.all([loadSubmissions(), loadArtworkEdits(), loadArtistEdits(), loadFeedback()]);
    // After initial load, if a deep link searchId was provided ensure it's loaded
    if (searchId.value.trim()) {
      await ensureSubmissionLoaded(searchId.value.trim());
    }
  } catch (err) {
    console.error('[ReviewView] Error loading data:', err);
    error.value = getErrorMessage(err);

    // Show user-friendly error modal for critical failures
    await globalModal.showError(
      `Failed to load review queue: ${getErrorMessage(err)}`,
      'Review Queue Error'
    );
  } finally {
    loading.value = false;
  }
}

async function loadArtistEdits() {
  try {
    console.log('[ReviewView] Loading artist edits for moderation...');
    const response = await apiService.getArtistEdits(1, 100);
    const data = response as any;
    if (data && data.edits) {
      // Normalize items so each edit has a top-level `id` (fallback to edit_ids[0])
      const normalized = (data.edits || []).map((e: any) => ({
        ...e,
        id: e.id || (Array.isArray(e.edit_ids) && e.edit_ids.length > 0 ? e.edit_ids[0] : undefined),
      }));

      // store artist edits separately on a new ref
      (artistEdits as any).value = normalized;
      console.log('[ReviewView] Loaded artist edits:', (artistEdits as any).value.length);
    } else {
      (artistEdits as any).value = [];
    }
  } catch (err) {
    console.error('[ReviewView] Error loading artist edits:', err);
    (artistEdits as any).value = [];
  }
}

// New ref to hold artist edits
const artistEdits = ref<any[]>([]);

/**
 * Ensure a submission for the given ID is loaded (deep-link support).
 * If not in current submissions list, attempt direct fetch via API.
 */
async function ensureSubmissionLoaded(id: string) {
  const lower = id.toLowerCase();
  const exists = submissions.value.some(
    (s: ReviewSubmission) =>
      s.id.toLowerCase() === lower || (s.artwork_id && s.artwork_id.toLowerCase() === lower)
  );
  if (exists) return;
  // Basic UUID format check to avoid unnecessary requests
  if (!/^[0-9a-fA-F-]{32,36}$/.test(id)) return;
  try {
    const resp = await apiService.getSubmissionForReview(id);
    const data: any = (resp as any).data || resp; // handle wrapped/unwrapped
    if (data && data.id) {
      const mapped: ReviewSubmission = {
        id: data.id,
        artwork_id: data.artwork_id || data.artworkId || undefined,
        title: data.title || '',
        note: data.note || '',
        photos: data.photos || [],
        latitude: data.lat || data.latitude || 0,
        longitude: data.lon || data.longitude || 0,
        type: data.type || 'other',
        status: data.status || 'pending',
        created_at: data.created_at || new Date().toISOString(),
        user_token: data.user_token || '',
        priority: data.priority || 'normal',
        nearby_artworks: data.nearby_artworks || [],
        currentPhotoIndex: 0,
      };
      submissions.value = [mapped, ...submissions.value];
    }
  } catch (e) {
    // Silent: not found or permission issue
    console.warn('[ReviewView] ensureSubmissionLoaded failed for', id, e);
  }
}

async function loadArtworkEdits() {
  try {
    console.log('[ReviewView] Loading artwork edits for moderation...');

    const response = await apiService.getArtworkEdits(1, 100);

    console.log('[ReviewView] Artwork edits response:', response);

    const responseData = response as any;
    if (responseData.edits && Array.isArray(responseData.edits)) {
      artworkEdits.value = responseData.edits;

      console.log('[ReviewView] Processed artwork edits:', artworkEdits.value.length);
    } else {
      console.warn('[ReviewView] No artwork edits in response:', responseData);
      artworkEdits.value = [];
    }
  } catch (err) {
    console.error('[ReviewView] Error loading artwork edits:', err);

    // Show user-friendly error modal
    await globalModal.showError(
      `Failed to load artwork edits for review: ${getErrorMessage(err)}`,
      'Review Queue Error'
    );

    // Also surface a transient toast for non-critical load issues
    const { error: toastError } = useToasts();
    toastError(`Could not load artwork edits: ${getErrorMessage(err)}`);

    // Don't throw - let the submission loading continue
  }
}

async function loadFeedback() {
  try {
    console.log('[ReviewView] Loading feedback for moderation...');

    const params = new URLSearchParams({
      page: '1',
      per_page: '100',
      status: 'open', // Only show open feedback by default
    });

    const response = (await apiService.get(`/moderation/feedback?${params.toString()}`)) as {
      feedback: FeedbackRecord[];
      total: number;
      page: number;
      per_page: number;
      has_more: boolean;
    };

    feedback.value = response.feedback || [];
    feedbackTotal.value = response.total || 0;
    console.log('[ReviewView] Loaded feedback:', feedback.value.length);
  } catch (err) {
    console.error('[ReviewView] Error loading feedback:', err);

    // Show user-friendly error modal
    await globalModal.showError(
      `Failed to load feedback for review: ${getErrorMessage(err)}`,
      'Review Queue Error'
    );

    feedback.value = [];
  }
}

function extractArtworkTitle(artworkId: string): string {
  // TODO: This could be enhanced to fetch artwork titles or include them in the API response
  return `Artwork ${artworkId.substring(0, 8)}...`;
}

async function loadSubmissions() {
  try {
    console.log('[ReviewView] Loading review queue using apiService...');

    // Use the proper API service method
    const response = await apiService.getReviewQueue('pending', undefined, 1, 100);

    console.log('[ReviewView] Review queue response:', response);

    // The backend returns { submissions: [...], pagination: {...} }
    // But the apiService expects PaginatedResponse format with items
    // Let's access the response data directly since it doesn't match
    const responseData = response as any;

    if (responseData.submissions && Array.isArray(responseData.submissions)) {
      submissions.value = responseData.submissions.map((item: any) => ({
        id: item.id,
        artwork_id: item.artwork_id || item.artworkId || undefined,
        title: item.title || '',
        note: item.note || '',
        photos: item.photos || [],
        latitude: item.lat || item.latitude || 0,
        longitude: item.lon || item.longitude || 0,
        type: item.type || 'other',
        status: item.status || 'pending',
        created_at: item.created_at || new Date().toISOString(),
        user_token: item.user_token || '',
        priority: item.priority || 'normal',
        nearby_artworks: item.nearby_artworks || [],
        currentPhotoIndex: 0,
      }));

      console.log('[ReviewView] Processed submissions:', submissions.value.length);
    } else {
      console.warn('[ReviewView] No submissions in response:', responseData);
      submissions.value = [];
    }

    // Load statistics (if the stats endpoint exists)
    try {
      const statsResponse = await apiService.getReviewStats();
      if (statsResponse.data) {
        // Calculate today's counts from recent activity
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const todayActivity =
          statsResponse.data.recent_activity?.filter((activity: any) => activity.date === today) ||
          [];

        const approvedToday =
          todayActivity.find((activity: any) => activity.status === 'approved')?.count || 0;
        const rejectedToday =
          todayActivity.find((activity: any) => activity.status === 'rejected')?.count || 0;

        statistics.value = {
          pending: statsResponse.data.status_counts.pending || 0,
          approvedToday: approvedToday,
          rejectedToday: rejectedToday,
          total:
            (statsResponse.data.status_counts.pending || 0) +
            (statsResponse.data.status_counts.approved || 0) +
            (statsResponse.data.status_counts.rejected || 0),
        };

        console.log('[ReviewView] Statistics calculated:', statistics.value);
      }
    } catch (statsError) {
      console.warn('[ReviewView] Failed to load statistics:', statsError);
      // Don't show error modal for stats - this is non-critical
    }
  } catch (err) {
    console.error('[ReviewView] Error loading submissions:', err);

    // Show user-friendly error modal for submissions loading failure
    await globalModal.showError(
      `Failed to load submissions for review: ${getErrorMessage(err)}`,
      'Review Queue Error'
    );

    // Let loadData handle the error
    throw err;
  }
}

function previousPhoto(submission: ReviewSubmission) {
  if (submission.photos && submission.photos.length > 1) {
    submission.currentPhotoIndex =
      (submission.currentPhotoIndex || 0) === 0
        ? submission.photos.length - 1
        : (submission.currentPhotoIndex || 0) - 1;
  }
}

function nextPhoto(submission: ReviewSubmission) {
  if (submission.photos && submission.photos.length > 1) {
    submission.currentPhotoIndex =
      (submission.currentPhotoIndex || 0) === submission.photos.length - 1
        ? 0
        : (submission.currentPhotoIndex || 0) + 1;
  }
}

async function approveSubmission(submission: ReviewSubmission) {
  processingId.value = submission.id;
  action.value = 'approve';

  try {
    console.log('[ReviewView] Approving submission:', submission.id);

    let approvalAction = 'create_new';
    let artworkId: string | undefined = undefined;

    // For logbook entries with an existing artwork_id, automatically link to that artwork
    if (submission.type === 'logbook_entry' && submission.artwork_id) {
      approvalAction = 'link_existing';
      artworkId = submission.artwork_id;
    } else if (submission.nearby_artworks && submission.nearby_artworks.length > 0) {
      // If there are nearby artworks, let the reviewer choose
      const choice = await globalModal.showConfirmModal({
        title: 'Approval Decision',
        message: `This submission has ${submission.nearby_artworks.length} nearby artwork(s). Do you want to create a new artwork or link to an existing one?`,
        confirmText: 'Create New',
        cancelText: 'Link to Existing',
      });

      if (!choice) {
        // User chose to link to existing - for now, we'll link to the closest nearby artwork
        // In a more sophisticated UI, we'd show a list to choose from
        approvalAction = 'link_existing';
        artworkId = submission.nearby_artworks[0].id;
      }
      // If choice is true, we keep 'create_new' as default
    }

    // Prepare the request body with the action
    const requestBody: { action: string; artwork_id?: string } = {
      action: approvalAction,
    };

    if (artworkId) {
      requestBody.artwork_id = artworkId;
    }

    // Use the proper API service method with the action
    await apiService.approveSubmissionWithAction(submission.id, requestBody);

    console.log('[ReviewView] Submission approved successfully with action:', approvalAction);

    // Track approval
    analytics.trackEvent('review_approve_submission', {
      event_category: 'submission',
      event_label: approvalAction,
      submission_type: submission.type,
    });

    // Remove from list
    submissions.value = submissions.value.filter((s: ReviewSubmission) => s.id !== submission.id);
    statistics.value.pending--;
    statistics.value.approvedToday++;
  } catch (err) {
    console.error('[ReviewView] Error approving submission:', err);
    error.value = getErrorMessage(err);
  } finally {
    processingId.value = null;
    action.value = null;
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
    cancelText: 'Cancel',
  });

  // User cancelled
  if (reason === null) return;

  processingId.value = submission.id;
  action.value = 'reject';

  try {
    console.log('[ReviewView] Rejecting submission:', submission.id, 'with reason:', reason);

    // Use the proper API service method
    await apiService.rejectSubmission(submission.id, reason || undefined);

    console.log('[ReviewView] Submission rejected successfully');

    // Track rejection
    analytics.trackEvent('review_reject_submission', {
      event_category: 'submission',
      event_label: reason ? 'with_reason' : 'no_reason',
      submission_type: submission.type,
    });

    // Remove from list
    submissions.value = submissions.value.filter((s: ReviewSubmission) => s.id !== submission.id);
    statistics.value.pending--;
    statistics.value.rejectedToday++;
  } catch (err) {
    console.error('[ReviewView] Error rejecting submission:', err);
    error.value = getErrorMessage(err);
  } finally {
    processingId.value = null;
    action.value = null;
  }
}

function viewOnMap(submission: ReviewSubmission) {
  router.push(`/?lat=${submission.latitude}&lon=${submission.longitude}&zoom=18`);
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
    cancelText: 'Cancel',
  });

  // User cancelled or no reason provided
  if (!reason) return;

  try {
    const response = await fetch(createApiUrl(`/review/submissions/${submission.id}/flag`), {
      method: 'POST',
      headers: {
        'X-User-Token': authStore.token || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      throw new Error('Failed to flag submission');
    }

    submission.priority = 'high';

    // Show success message
    await globalModal.showAlert(
      'Submission has been flagged for senior review and moved to high priority.',
      'Flagged Successfully'
    );
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to flag submission';
  }
}

function getArtworkTypeEmoji(type: string): string {
  const typeMap: Record<string, string> = {
    public_art: '🎨',
    street_art: '🎭',
    monument: '🗿',
    sculpture: '⚱️',
    logbook_entry: '📖', // Add emoji for logbook entries
    other: '🏛️',
  };
  return typeMap[type] || '🏛️';
}

function getSubmissionTypeLabel(type: string): string {
  const labelMap: Record<string, string> = {
    logbook_entry: 'Logbook Entry',
    public_art: 'Public Art',
    street_art: 'Street Art',
    monument: 'Monument',
    sculpture: 'Sculpture',
    other: 'Other',
  };
  return labelMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function parseLogbookNotes(notes: string): {
  condition?: string;
  userNotes?: string;
  rawNotes: string;
} {
  if (!notes) return { rawNotes: '' };

  // Try to extract condition assessment from notes
  const conditionMatch = notes.match(/Condition:\s*([^;]+)/i);
  const condition = conditionMatch?.[1]?.trim();

  // Extract user notes (everything that's not a structured answer)
  let userNotes = notes;
  if (conditionMatch) {
    userNotes = userNotes.replace(/Condition:\s*[^;]+;?\s*/i, '').trim();
  }

  const result: { condition?: string; userNotes?: string; rawNotes: string } = {
    rawNotes: notes,
  };

  if (condition) {
    result.condition = condition;
  }

  if (userNotes) {
    result.userNotes = userNotes;
  }

  return result;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
}

// Artwork Edit Methods
async function approveArtworkEdit(edit: ArtworkEditReviewData) {
  const editId = edit.edit_ids?.[0];
  if (!editId) return;

  processingId.value = editId;
  action.value = 'approve';

  try {
    await apiService.approveArtworkEdit(editId, true);

    console.log('[ReviewView] Artwork edit approved successfully');

    // Refresh the artwork data to show updated values
    if (edit.artwork_id) {
      try {
        await artworksStore.refreshArtwork(edit.artwork_id);
        console.log('[ReviewView] Artwork data refreshed after approval');
      } catch (refreshError) {
        console.warn('[ReviewView] Failed to refresh artwork data:', refreshError);
        // Don't fail the approval if refresh fails
      }
    }

    // Remove from list
    artworkEdits.value = artworkEdits.value.filter(
      (e: ArtworkEditReviewData) => e.edit_ids?.[0] !== editId
    );

    // Update statistics
    statistics.value.pending = Math.max(0, statistics.value.pending - 1);
    statistics.value.approvedToday++;
  } catch (err) {
    console.error('[ReviewView] Error approving artwork edit:', err);
    error.value = getErrorMessage(err);
  } finally {
    processingId.value = null;
    action.value = null;
  }
}

async function rejectArtworkEdit(edit: ArtworkEditReviewData) {
  const editId = edit.edit_ids?.[0];
  if (!editId) return;

  const reason = await globalModal.showPrompt({
    title: 'Reject Artwork Edit',
    message: 'Please provide a reason for rejecting this edit (optional):',
    inputLabel: 'Reason',
    placeholder: 'Enter rejection reason...',
    multiline: true,
    maxLength: 500,
    required: false,
    variant: 'danger',
    confirmText: 'Reject',
    cancelText: 'Cancel',
  });

  // User cancelled
  if (reason === null) return;

  processingId.value = editId;
  action.value = 'reject';

  try {
    await apiService.rejectArtworkEdit(editId, reason || '');

    console.log('[ReviewView] Artwork edit rejected successfully');

    // Remove from list
    artworkEdits.value = artworkEdits.value.filter(
      (e: ArtworkEditReviewData) => e.edit_ids?.[0] !== editId
    );

    // Update statistics
    statistics.value.pending = Math.max(0, statistics.value.pending - 1);
    statistics.value.rejectedToday++;
  } catch (err) {
    console.error('[ReviewView] Error rejecting artwork edit:', err);
    error.value = getErrorMessage(err);
  } finally {
    processingId.value = null;
    action.value = null;
  }
}

// Artist Edit Methods
async function approveArtistEditItem(edit: any) {
  const editId = edit.id || (Array.isArray(edit.edit_ids) ? edit.edit_ids[0] : undefined);
  if (!editId) return;

  processingId.value = editId;
  action.value = 'approve';

  try {
    await apiService.approveArtistEdit(editId);
    console.log('[ReviewView] Artist edit approved successfully');

  // Remove from list (support legacy edit_ids shape)
  artistEdits.value = artistEdits.value.filter((e: any) => (e.id || (Array.isArray(e.edit_ids) ? e.edit_ids[0] : undefined)) !== editId);

    // Update stats
    statistics.value.pending = Math.max(0, statistics.value.pending - 1);
    statistics.value.approvedToday++;
  } catch (err) {
    console.error('[ReviewView] Error approving artist edit:', err);
    error.value = getErrorMessage(err);
  } finally {
    processingId.value = null;
    action.value = null;
  }
}

async function rejectArtistEditItem(edit: any) {
  const editId = edit.id || (Array.isArray(edit.edit_ids) ? edit.edit_ids[0] : undefined);
  if (!editId) return;

  const reason = await globalModal.showPrompt({
    title: 'Reject Artist Edit',
    message: 'Please provide a reason for rejecting this edit (optional):',
    inputLabel: 'Reason',
    placeholder: 'Enter rejection reason...',
    multiline: true,
    maxLength: 500,
    required: false,
    variant: 'danger',
    confirmText: 'Reject',
    cancelText: 'Cancel',
  });

  if (reason === null) return;

  processingId.value = editId;
  action.value = 'reject';

  try {
    await apiService.rejectArtistEdit(editId, reason || '');
    console.log('[ReviewView] Artist edit rejected successfully');

  // Remove from list (support legacy edit_ids shape)
  artistEdits.value = artistEdits.value.filter((e: any) => (e.id || (Array.isArray(e.edit_ids) ? e.edit_ids[0] : undefined)) !== editId);

    // Update stats
    statistics.value.pending = Math.max(0, statistics.value.pending - 1);
    statistics.value.rejectedToday++;
  } catch (err) {
    console.error('[ReviewView] Error rejecting artist edit:', err);
    error.value = getErrorMessage(err);
  } finally {
    processingId.value = null;
    action.value = null;
  }
}

// Feedback review functions
async function resolveFeedback(item: FeedbackRecord) {
  const notes = await globalModal.showPrompt({
    title: 'Resolve Feedback',
    message: 'Mark this feedback as resolved. Optionally add notes about your decision:',
    inputLabel: 'Review Notes (optional)',
    placeholder: 'Add any notes about how this was resolved...',
    multiline: true,
    maxLength: 500,
    required: false,
    confirmText: 'Resolve',
    cancelText: 'Cancel',
  });

  // User cancelled
  if (notes === null) return;

  processingId.value = item.id;
  action.value = 'approve';

  try {
    await apiService.post(`/moderation/feedback/${item.id}/review`, {
      action: 'resolve',
      review_notes: notes || undefined,
    });

    // Remove from list on success
    feedback.value = feedback.value.filter((f: FeedbackRecord) => f.id !== item.id);
  } catch (err) {
    console.error('[ReviewView] Error resolving feedback:', err);
    error.value = getErrorMessage(err);
  } finally {
    processingId.value = null;
    action.value = null;
  }
}

async function archiveFeedback(item: FeedbackRecord) {
  const notes = await globalModal.showPrompt({
    title: 'Archive Feedback',
    message: 'Archive this feedback without taking action. Optionally add notes:',
    inputLabel: 'Review Notes (optional)',
    placeholder: 'Add any notes about why this was archived...',
    multiline: true,
    maxLength: 500,
    required: false,
    confirmText: 'Archive',
    cancelText: 'Cancel',
  });

  // User cancelled
  if (notes === null) return;

  processingId.value = item.id;
  action.value = 'reject';

  try {
    await apiService.post(`/moderation/feedback/${item.id}/review`, {
      action: 'archive',
      review_notes: notes || undefined,
    });

    // Remove from list on success
    feedback.value = feedback.value.filter((f: FeedbackRecord) => f.id !== item.id);
  } catch (err) {
    console.error('[ReviewView] Error archiving feedback:', err);
    error.value = getErrorMessage(err);
  } finally {
    processingId.value = null;
    action.value = null;
  }
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

function formatArtworkEditSummary(edit: ArtworkEditReviewData): string {
  const fieldCount = edit.diffs.length;
  const fields = edit.diffs.map(diff => {
    // Provide more descriptive field names
    switch (diff.field_name) {
      case 'tags':
        return 'structured tags';
      case 'created_by':
        return 'artist/creator';
      default:
        return diff.field_name;
    }
  });

  // Check if this is primarily a tag edit
  const hasTagEdit = edit.diffs.some(diff => diff.field_name === 'tags');
  const tagOnlyEdit = fieldCount === 1 && hasTagEdit;

  if (tagOnlyEdit) {
    return 'Structured tag updates';
  }

  return `${fieldCount} field${fieldCount > 1 ? 's' : ''}: ${fields.join(', ')}`;
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
            <p class="mt-2 text-lg text-gray-600">Review and moderate community submissions</p>
          </div>
          <div class="flex items-center space-x-4">
            <!-- Filter Controls (only for submissions tab) -->
            <template v-if="currentTab === 'submissions'">
              <!-- ID Search -->
              <div class="relative">
                <input
                  v-model="searchId"
                  type="text"
                  placeholder="Search UUID..."
                  class="border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                />
                <svg
                  class="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
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
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav class="flex space-x-8" aria-label="Tabs">
          <button
            :class="[
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              currentTab === 'submissions'
                ? 'theme-primary theme-on-primary-container'
                : 'border-transparent theme-outline hover:theme-on-surface hover:border-gray-300',
            ]"
            @click="
              currentTab = 'submissions';
              currentPage = 1;
            "
          >
            New Submissions
            <span
              v-if="filteredSubmissions.length > 0"
              :class="[
                'ml-2 py-0.5 px-2 rounded-full text-xs font-medium',
                currentTab === 'submissions'
                  ? 'theme-primary-container theme-on-primary-container'
                  : 'bg-gray-100 text-gray-600',
              ]"
            >
              {{ filteredSubmissions.length }}
            </span>
          </button>
          <button
            :class="[
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              currentTab === 'edits'
                ? 'theme-primary theme-on-primary-container'
                : 'border-transparent theme-outline hover:theme-on-surface hover:border-gray-300',
            ]"
            @click="
              currentTab = 'edits';
              currentPage = 1;
            "
          >
            Artwork Edits
            <span
              v-if="filteredArtworkEdits.length > 0"
              :class="[
                'ml-2 py-0.5 px-2 rounded-full text-xs font-medium',
                currentTab === 'edits' ? 'theme-primary-container theme-on-primary-container' : 'bg-gray-100 text-gray-600',
              ]"
            >
              {{ filteredArtworkEdits.length }}
            </span>
          </button>
          <button
            :class="[
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              currentTab === 'artist-edits'
                ? 'theme-primary theme-on-primary-container'
                : 'border-transparent theme-outline hover:theme-on-surface hover:border-gray-300',
            ]"
            @click="currentTab = 'artist-edits'; currentPage = 1;"
          >
            Artist Edits
            <span
              v-if="artistEdits.length > 0"
              :class="[
                'ml-2 py-0.5 px-2 rounded-full text-xs font-medium',
                currentTab === 'artist-edits' ? 'theme-primary-container theme-on-primary-container' : 'bg-gray-100 text-gray-600',
              ]"
            >
              {{ artistEdits.length }}
            </span>
          </button>
          <button
            :class="[
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              currentTab === 'feedback'
                ? 'theme-primary theme-on-primary-container'
                : 'border-transparent theme-outline hover:theme-on-surface hover:border-gray-300',
            ]"
            @click="
              currentTab = 'feedback';
              currentPage = 1;
            "
          >
            User Feedback
            <span
              v-if="feedback.length > 0"
              :class="[
                'ml-2 py-0.5 px-2 rounded-full text-xs font-medium',
                currentTab === 'feedback' ? 'theme-primary-container theme-on-primary-container' : 'bg-gray-100 text-gray-600',
              ]"
            >
              {{ feedback.length }}
            </span>
          </button>
        </nav>
      </div>
    </div>

    <!-- Statistics Bar -->
    <div class="bg-blue-50 border-b border-blue-200 py-4">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="text-center">
            <p class="text-2xl font-bold theme-warning">{{ statistics.pending }}</p>
            <p class="text-sm theme-warning">Pending Review</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold theme-success">{{ statistics.approvedToday }}</p>
            <p class="text-sm theme-success">Approved Today</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold theme-error">{{ statistics.rejectedToday }}</p>
            <p class="text-sm theme-error">Rejected Today</p>
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
        <svg
          class="animate-spin h-12 w-12 mx-auto mb-4"
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
        <p class="text-gray-600">Loading submissions...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <svg
          class="h-12 w-12 mx-auto mb-4 theme-error"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
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
          @click="loadData"
          class="px-4 py-2 theme-primary theme-on-primary rounded-md"
        >
          Retry
        </button>
      </div>

      <!-- Submissions Tab Content -->
      <template v-else-if="currentTab === 'submissions'">
        <!-- Empty State -->
        <div v-if="filteredSubmissions.length === 0" class="text-center py-12">
          <svg
            class="h-12 w-12 mx-auto mb-4 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0114 0z"
            />
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
              <div
                v-if="submission.photos && submission.photos.length > 0"
                class="aspect-w-16 aspect-h-9 bg-gray-100"
              >
                <img
                  :src="submission.photos[submission.currentPhotoIndex || 0] || ''"
                  :alt="`Submission photo ${(submission.currentPhotoIndex || 0) + 1}`"
                  class="w-full h-48 object-cover"
                />

                <!-- Photo Navigation -->
                <div
                  v-if="submission.photos.length > 1"
                  class="absolute inset-0 flex items-center justify-between p-2"
                >
                  <button
                    @click="previousPhoto(submission)"
                    class="bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-70"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <button
                    @click="nextPhoto(submission)"
                    class="bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-70"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>

                <!-- Photo Counter -->
                <div
                  v-if="submission.photos.length > 1"
                  class="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs"
                >
                  {{ (submission.currentPhotoIndex || 0) + 1 }} / {{ submission.photos.length }}
                </div>
              </div>

              <!-- No Photos Placeholder -->
              <div v-else class="h-48 bg-gray-100 flex items-center justify-center">
                <svg class="w-12 h-12 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>

              <!-- Priority Badge -->
              <div
                v-if="submission.priority === 'high'"
                class="absolute top-2 left-2 theme-error theme-on-error px-2 py-1 text-xs font-medium rounded"
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
                    <span
                      v-if="submission.type === 'logbook_entry'"
                      class="inline-flex items-center"
                    >
                      <span class="mr-2">📖</span>
                      {{ getSubmissionTypeLabel(submission.type) }}
                      <span
                        v-if="submission.title && submission.title !== 'Untitled Submission'"
                        class="ml-2 text-gray-600"
                      >
                        - {{ submission.title }}
                      </span>
                    </span>
                    <span v-else>
                      {{ submission.title || 'Untitled Submission' }}
                    </span>
                  </h3>
                  <p class="text-sm text-gray-600">
                    Submitted {{ formatDate(submission.created_at) }}
                  </p>
                </div>
                <span class="text-2xl">{{ getArtworkTypeEmoji(submission.type) }}</span>
              </div>

              <!-- Description -->
              <div v-if="submission.note" class="mb-4">
                <!-- Logbook Entry: Show structured answers -->
                <div v-if="submission.type === 'logbook_entry'" class="space-y-3">
                  <template
                    v-if="
                      parseLogbookNotes(submission.note).condition ||
                      parseLogbookNotes(submission.note).userNotes
                    "
                  >
                    <!-- Condition Assessment -->
                    <div
                      v-if="parseLogbookNotes(submission.note).condition"
                      class="bg-blue-50 border border-blue-200 rounded-lg p-3"
                    >
                      <h4 class="text-sm font-semibold theme-primary mb-1">Condition Assessment</h4>
                      <p class="text-sm theme-primary">
                        {{ parseLogbookNotes(submission.note).condition }}
                      </p>
                    </div>

                    <!-- User Notes -->
                    <div
                      v-if="parseLogbookNotes(submission.note).userNotes"
                      class="bg-gray-50 border border-gray-200 rounded-lg p-3"
                    >
                      <h4 class="text-sm font-semibold text-gray-900 mb-1">Additional Notes</h4>
                      <p class="text-sm text-gray-700">
                        {{ parseLogbookNotes(submission.note).userNotes }}
                      </p>
                    </div>
                  </template>

                  <!-- Fallback to raw notes if parsing fails -->
                  <div v-else class="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <h4 class="text-sm font-semibold text-gray-900 mb-1">Notes</h4>
                    <p class="text-sm text-gray-700">{{ submission.note }}</p>
                  </div>
                </div>

                <!-- Regular Submission: Show notes as before -->
                <p v-else class="text-sm text-gray-700 line-clamp-3">{{ submission.note }}</p>
              </div>

              <!-- Metadata -->
              <div class="space-y-2 mb-4">
                <div class="flex items-center text-sm text-gray-600">
                  <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  {{ submission.latitude?.toFixed(4) }}, {{ submission.longitude?.toFixed(4) }}
                </div>

                <div class="flex items-center text-sm text-gray-600">
                  <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  User: {{ submission.user_token?.slice(0, 8) || 'Anonymous' }}...
                </div>

                <div
                  v-if="submission.nearby_artworks && submission.nearby_artworks.length > 0"
                  class="flex items-center text-sm theme-warning"
                >
                  <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  {{ submission.nearby_artworks.length }} nearby artwork(s)
                </div>
              </div>

              <!-- Actions -->
              <div class="flex space-x-3">
                <button
                  @click="approveSubmission(submission)"
                  :disabled="processingId === submission.id"
                  class="flex-1 px-4 py-2 theme-success theme-on-success text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
                  style="--tw-ring-color: var(--md-sys-color-success);"
                >
                  <span
                    v-if="processingId === submission.id && action === 'approve'"
                    class="flex items-center justify-center"
                  >
                    <svg
                      class="animate-spin -ml-1 mr-2 h-4 w-4"
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
                    Approving...
                  </span>
                  <span v-else>✓ Approve</span>
                </button>

                <button
                  @click="rejectSubmission(submission)"
                  :disabled="processingId === submission.id"
                  class="flex-1 px-4 py-2 theme-error theme-on-error text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
                  style="--tw-ring-color: var(--md-sys-color-error);"
                >
                  <span
                    v-if="processingId === submission.id && action === 'reject'"
                    class="flex items-center justify-center"
                  >
                    <svg
                      class="animate-spin -ml-1 mr-2 h-4 w-4"
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
                    Rejecting...
                  </span>
                  <span v-else>✗ Reject</span>
                </button>
              </div>

              <!-- Additional Actions -->
              <div class="mt-3 flex space-x-3 text-sm">
                <button
                  @click="viewOnMap(submission)"
                  class="theme-primary underline"
                >
                  View on Map
                </button>
                <button
                  @click="flagForReview(submission)"
                  class="theme-warning underline"
                >
                  Flag for Senior Review
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Artwork Edits Tab Content -->
      <template v-else-if="currentTab === 'edits'">
        <!-- Empty State -->
        <div v-if="filteredArtworkEdits.length === 0" class="text-center py-12">
          <svg
            class="h-12 w-12 mx-auto mb-4 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <p class="text-gray-600 mb-4">No artwork edits pending review</p>
          <p class="text-sm text-gray-600">All artwork edits have been reviewed.</p>
        </div>

        <!-- Artwork Edits List -->
        <div v-else class="space-y-6">
          <div
            v-for="edit in paginatedArtworkEdits"
            :key="edit.edit_ids?.[0] || edit.artwork_id"
            class="bg-white rounded-lg border border-gray-200 shadow-sm p-6"
          >
            <!-- Edit Header -->
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <div class="flex items-center space-x-2 mb-1">
                  <h3 class="text-lg font-medium text-gray-900">
                    {{ extractArtworkTitle(edit.artwork_id) }}
                  </h3>

                  <!-- Change type indicators -->
                  <div class="flex items-center space-x-1">
                    <span
                      v-if="edit.diffs.some(d => d.field_name === 'tags')"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
                      title="Includes structured tag changes"
                    >
                      🏷️ Tags
                    </span>
                    <span
                      v-if="edit.diffs.some(d => d.field_name === 'title')"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium theme-primary-container theme-on-primary-container"
                    >
                      📝 Title
                    </span>
                    <span
                      v-if="edit.diffs.some(d => d.field_name === 'description')"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium theme-success-container theme-on-success-container"
                    >
                      📖 Description
                    </span>
                    <span
                      v-if="edit.diffs.some(d => d.field_name === 'created_by')"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700"
                    >
                      👤 Artist
                    </span>
                  </div>
                  <router-link
                    :to="`/artwork/${edit.artwork_id}`"
                    class="theme-primary text-sm underline flex items-center"
                    target="_blank"
                  >
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    View Details
                  </router-link>
                </div>
                <p class="text-sm text-gray-600">
                  {{ formatArtworkEditSummary(edit) }} • Submitted
                  {{ new Date(edit.submitted_at).toLocaleDateString() }}
                </p>
              </div>
              <div class="flex items-center space-x-2 ml-4">
                <button
                  @click="approveArtworkEdit(edit)"
                  :disabled="processingId === edit.edit_ids?.[0]"
                  class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md theme-success theme-on-success focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style="--tw-ring-color: var(--md-sys-color-success);"
                >
                  <span
                    v-if="processingId === edit.edit_ids?.[0] && action === 'approve'"
                    class="flex items-center"
                  >
                    <svg
                      class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                    Approving...
                  </span>
                  <span v-else>Approve</span>
                </button>
                <button
                  @click="rejectArtworkEdit(edit)"
                  :disabled="processingId === edit.edit_ids?.[0]"
                  class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md theme-error theme-on-error focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style="--tw-ring-color: var(--md-sys-color-error);"
                >
                  <span
                    v-if="processingId === edit.edit_ids?.[0] && action === 'reject'"
                    class="flex items-center"
                  >
                    <svg
                      class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
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
                    Rejecting...
                  </span>
                  <span v-else>Reject</span>
                </button>
              </div>
            </div>

            <!-- Enhanced Diff Display with Structured Tag Support -->
            <ArtworkEditDiffs :diffs="edit.diffs" />
          </div>
        </div>
      </template>

      <!-- Artist Edits Tab Content -->
      <template v-else-if="currentTab === 'artist-edits'">
        <div v-if="filteredArtistEdits.length === 0" class="text-center py-12">
          <p class="text-gray-600 mb-4">No artist edits pending review</p>
          <p class="text-sm text-gray-600">All artist edits have been reviewed.</p>
        </div>

        <div v-else class="space-y-6">
          <div
            v-for="edit in paginatedArtistEdits"
            :key="edit.id"
            class="bg-white rounded-lg border border-gray-200 shadow-sm p-6"
          >
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <div class="flex items-center space-x-2 mb-1">
                  <h3 class="text-lg font-medium text-gray-900">{{ edit.artist_name || edit.artist_id }}</h3>
                  <router-link
                    v-if="edit.artist_id"
                    :to="`/artists/${edit.artist_id}`"
                    class="theme-primary text-sm underline flex items-center"
                    target="_blank"
                  >
                    View Artist
                  </router-link>
                </div>
                <p class="text-sm text-gray-600">
                  Submitted {{ formatDate(edit.submitted_at) }}
                </p>
              </div>
              <div class="flex items-center space-x-2 ml-4">
                <button
                  @click="approveArtistEditItem(edit)"
                  :disabled="processingId === edit.id"
                  class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md theme-success theme-on-success focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style="--tw-ring-color: var(--md-sys-color-success);"
                >
                  <span v-if="processingId === edit.id && action === 'approve'" class="flex items-center">
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Approving...
                  </span>
                  <span v-else>Approve</span>
                </button>

                <button
                  @click="rejectArtistEditItem(edit)"
                  :disabled="processingId === edit.id"
                  class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md theme-error theme-on-error focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style="--tw-ring-color: var(--md-sys-color-error);"
                >
                  <span v-if="processingId === edit.id && action === 'reject'" class="flex items-center">
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2-647z"></path>
                    </svg>
                    Rejecting...
                  </span>
                  <span v-else>Reject</span>
                </button>
              </div>
            </div>

            <!-- Diffs -->
            <ArtistEditDiffs :diffs="edit.diffs || []" />
          </div>
        </div>
      </template>

      <!-- User Feedback Tab -->
      <template v-if="currentTab === 'feedback'">
        <!-- Empty State -->
        <div
          v-if="feedback.length === 0"
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
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">No Feedback Found</h3>
          <p class="text-gray-600">All feedback has been reviewed!</p>
        </div>

        <!-- Feedback List -->
        <div v-else class="space-y-4">
          <div
            v-for="item in feedback"
            :key="item.id"
            class="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <!-- Header -->
                <div class="flex items-center gap-3 mb-3">
                  <span class="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                    OPEN
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
                    :to="`/${item.subject_type}/${item.subject_id}`"
                    class="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    target="_blank"
                  >
                    View {{ item.subject_type }} →
                  </router-link>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex flex-col gap-2 ml-4">
                <button
                  @click="resolveFeedback(item)"
                  :disabled="!!processingId"
                  class="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Resolve
                </button>
                <button
                  @click="archiveFeedback(item)"
                  :disabled="!!processingId"
                  class="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Pagination (works for both tabs) -->
      <div v-if="totalPages > 1" class="mt-8 flex items-center justify-between">
        <div class="text-sm text-gray-700">
          <span v-if="currentTab === 'submissions'">
            Showing {{ startIndex + 1 }} to {{ Math.min(endIndex, filteredSubmissions.length) }} of
            {{ filteredSubmissions.length }} submissions
          </span>
          <span v-else-if="currentTab === 'edits'">
            Showing {{ startIndex + 1 }} to {{ Math.min(endIndex, filteredArtworkEdits.length) }} of
            {{ filteredArtworkEdits.length }} artwork edits
          </span>
          <span v-else>
            Showing {{ feedback.length }} feedback item{{ feedback.length !== 1 ? 's' : '' }}
          </span>
        </div>
        <div class="flex space-x-2">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span class="px-3 py-1 text-sm"> Page {{ currentPage }} of {{ totalPages }} </span>
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
  background-color: var(--md-content-background, #f9fafb);
}

/* Text clamping for multiline truncation */
.line-clamp-3 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
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
