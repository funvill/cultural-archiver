<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { marked } from 'marked';
import { useRouter, useRoute } from 'vue-router';
import { useArtworksStore } from '../stores/artworks';
import { useAuthStore } from '../stores/auth';
import PhotoCarousel from '../components/PhotoCarousel.vue';
import MiniMap from '../components/MiniMap.vue';
import TagBadge from '../components/TagBadge.vue';
import TagEditor from '../components/TagEditor.vue';
import AddToListDialog from '../components/AddToListDialog.vue';
import ArtworkActionBar from '../components/ArtworkActionBar.vue';
import FeedbackDialog from '../components/FeedbackDialog.vue';
import AuthModal from '../components/AuthModal.vue';
// import LogbookTimeline from '../components/LogbookTimeline.vue';
import { useAnnouncer } from '../composables/useAnnouncer';
import { apiService } from '../services/api';

// Props
interface Props {
  id: string;
}

const props = defineProps<Props>();

// Stores and routing
const artworksStore = useArtworksStore();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

// Announcer for screen reader feedback
const { announceError, announceSuccess } = useAnnouncer();

// Toast state for submission success
const showToast = ref(false);
const toastMessage = ref('');

// Add to list dialog state
const showAddToListDialog = ref(false);

// Feedback dialog state
const showFeedbackDialog = ref(false);
const feedbackMode = ref<'missing' | 'comment'>('comment');

// Auth modal state
const showAuthModal = ref(false);

// State
const loading = ref(true);
const error = ref<string | null>(null);
// When artwork is pending/unavailable, attempt to discover originating submission ID
const originatingSubmissionId = ref<string | null>(null);
const currentPhotoIndex = ref(0);
const showFullscreenPhoto = ref(false);
const fullscreenPhotoUrl = ref<string>('');

// Edit mode state
const isEditMode = ref(false);
const editLoading = ref(false);
const editError = ref<string | null>(null);
const showCancelDialog = ref(false);
const showSuccessModal = ref(false);
const hasPendingEdits = ref(false);
const pendingFields = ref<string[]>([]);

// Edit form data
const editData = ref({
  title: '',
  description: '',
  creators: '',
  tags: { keywords: '' } as Record<string, string>, // Structured tags instead of string array
});

// Computed
const artwork = computed(() => {
  return artworksStore.artworkById(props.id);
});

const artworkTitle = computed(() => {
  if (!artwork.value) return 'Unknown Artwork';

  // First try the new editable title field from the database
  if (artwork.value.title && artwork.value.title.trim()) {
    return artwork.value.title.trim();
  }

  // Fallback to tags_parsed for backward compatibility
  const title = artwork.value.tags_parsed?.title as string;
  return title || 'Unknown Artwork Title';
});

const artworkDescription = computed(() => {
  if (!artwork.value) return null;

  // First try the new editable description field from the database
  if (artwork.value.description && artwork.value.description.trim()) {
    return artwork.value.description.trim();
  }

  // Fallback to tags_parsed for backward compatibility
  const tagDescription = artwork.value.tags_parsed?.description as string;
  if (tagDescription && tagDescription.trim()) return tagDescription.trim();

  // Final fallback to first logbook entry note
  const firstEntry = artwork.value.logbook_entries?.[0];
  const noteDescription = firstEntry?.notes;
  if (noteDescription && noteDescription.trim()) return noteDescription.trim();

  return null;
});

const artworkCreators = computed(() => {
  if (!artwork.value) return 'Unknown';

  // First try the new artist_name field extracted from tags
  if (artwork.value.artist_name && artwork.value.artist_name.trim()) {
    return artwork.value.artist_name.trim();
  }

  // Second try tags_parsed for artist information (Vancouver mass import data)
  if (artwork.value?.tags_parsed?.artist) {
    return artwork.value.tags_parsed.artist as string;
  }

  // Third try tags_parsed for backward compatibility with other artist fields
  if (artwork.value?.tags_parsed?.creator) {
    return artwork.value.tags_parsed.creator as string;
  }

  // Fourth try tags_parsed for artist_ids (Vancouver import has numeric artist IDs)
  if (artwork.value?.tags_parsed?.artist_ids) {
    return `Artist ID: ${artwork.value.tags_parsed.artist_ids}`;
  }

  // Last fallback - only use created_by if it doesn't look like a UUID
  if (artwork.value.created_by && artwork.value.created_by.trim()) {
    const createdBy = artwork.value.created_by.trim();
    // Don't show UUIDs as artist names (mass import user tokens)
    if (!createdBy.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return createdBy;
    }
  }

  return 'Unknown';
});

// Artists from the new artist system
const artworkArtists = computed(() => {
  return artwork.value?.artists || [];
});

const hasArtistLinks = computed(() => {
  return artworkArtists.value.length > 0;
});

function navigateToArtist(artistId: string) {
  router.push(`/artist/${artistId}`);
}

// When MiniMap emits 'mapReady' provide a final invalidateSize retry from
// the parent. This helps with edge cases where the child initializes the
// map while the parent's layout is not fully settled.
function handleChildMapReady(mapInstance: any) {
  try {
    console.debug('[ArtworkDetailView] child mapReady received', { mapInstance });
    if (!mapInstance) return;
    // Attempt a few retries spaced across frames/timeouts
    if (typeof mapInstance.invalidateSize === 'function') {
      mapInstance.invalidateSize();
      requestAnimationFrame(() => mapInstance.invalidateSize());
      setTimeout(() => mapInstance.invalidateSize(), 150);
      setTimeout(() => mapInstance.invalidateSize(), 500);
    }
  } catch (err) {
    // ignore
  }
}

const artworkTags = computed(() => {
  if (!artwork.value?.tags_parsed) return {};

  // Convert legacy tags_parsed format to structured tags
  const filteredTags = { ...artwork.value.tags_parsed };

  // Remove special fields that are handled separately
  delete filteredTags.title;
  delete filteredTags.description;
  delete filteredTags.artist;
  delete filteredTags.creator;
  // Remove internal/system tags (prefixed with underscore)
  Object.keys(filteredTags).forEach(k => {
    if (k.startsWith('_')) {
      delete (filteredTags as any)[k];
    }
  });

  // Convert to structured tags format (string values only)
  const structuredTags: Record<string, string> = {};
  Object.entries(filteredTags).forEach(([key, value]) => {
    if (value != null) {
      structuredTags[key] = String(value);
    }
  });

  return structuredTags;
});

// Extract keywords (comma separated) from structured tags if present
const keywordList = computed(() => {
  const kwRaw =
    (artworkTags.value as any).keywords || (artwork.value?.tags_parsed?.keywords as string);
  if (!kwRaw) return [] as string[];
  return kwRaw
    .split(',')
    .map((k: string) => k.trim())
    .filter((k: string) => k.length > 0)
    .slice(0, 100); // safety limit
});

// Tags to show in details exclude keywords (handled separately)
const displayTags = computed(() => {
  const clone = { ...artworkTags.value } as Record<string, string>;
  delete clone.keywords; // keywords rendered separately
  
  // Double-safety: ensure no internal tags leak
  Object.keys(clone).forEach(k => {
    if (k.startsWith('_')) delete clone[k];
  });
  
  // Filter out reference/original tags that are kept for compatibility
  // but shouldn't be displayed to users (we show the normalized versions instead)
  const referenceTagsToHide = [
    'primarymaterial',    // Show 'material' instead
    'yearofinstallation', // Show 'start_date' instead  
    'vancouver_status',   // Show 'status' instead
    'type',              // Show 'artwork_type' instead
  ];
  
  referenceTagsToHide.forEach(tag => {
    delete clone[tag];
  });
  
  return clone;
});

// Two-way binding helper to guarantee string type for keywords input
const keywordsField = computed<string>({
  get() {
    const kw = (editData.value.tags as any).keywords;
    return typeof kw === 'string' ? kw : '';
  },
  set(val: string) {
    editData.value.tags.keywords = val;
  },
});

// Ref to TagEditor for triggering edit on tag click while in edit mode
const tagEditorRef = ref<any | null>(null);

const artworkPhotos = computed(() => {
  if (!artwork.value?.photos) return [] as string[];
  // Photos may be strings or objects; normalize to URL strings and deduplicate
  const urls: string[] = (artwork.value.photos || []).map((p: any) => {
    if (!p) return '';
    if (typeof p === 'string') return p;
    // Known shape: { url, thumbnail_url }
    return p.url || p.thumbnail_url || '';
  });
  return Array.from(new Set(urls)).filter((u: string) => !!u && u.length > 0);
});

// const logbookEntries = computed(() => {
//   return artwork.value?.logbook_entries || [];
// });

// NOTE: Title-level edit/add buttons were removed; edit availability handled elsewhere

const displayTitle = computed(() => {
  return isEditMode.value ? editData.value.title : artworkTitle.value;
});

const displayDescription = computed(() => {
  return isEditMode.value ? editData.value.description : artworkDescription.value;
});

// Render markdown (very limited) for safe display
const renderedDescription = computed(() => {
  const raw = displayDescription.value || '';
  if (!raw) return '';
  // Configure marked for very basic output (no HTML by default)
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
  const html = marked.parse(raw);
  return sanitizeMarkdownHtml(html as string);
});

// Basic sanitizer (not full-proof; for stronger security consider a library like DOMPurify)
function sanitizeMarkdownHtml(input: string): string {
  return (
    input
      // Remove script tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Remove on*="..." event handlers
      .replace(/ on[a-zA-Z]+="[^"]*"/g, '')
      .replace(/ on[a-zA-Z]+='[^']*'/g, '')
      // Remove javascript: URLs
      .replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"')
      .replace(/href\s*=\s*'javascript:[^']*'/gi, "href='#'")
  );
}

const displayCreators = computed(() => {
  return isEditMode.value ? editData.value.creators : artworkCreators.value;
});

const displayCreatorsList = computed(() => {
  const creators = displayCreators.value;
  if (creators === 'Unknown' || !creators) return [];

  // Split on comma and clean up names, filtering out system-generated values
  return creators
    .split(',')
    .map((name: string) => name.trim())
    .filter((name: string) => {
      // Filter out empty names, UUIDs, and artist IDs
      if (!name || name === 'Unknown') return false;
      if (name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
        return false;
      if (name.startsWith('Artist ID:')) return false;
      return true;
    });
});

const hasDisplayableCreators = computed(() => {
  return displayCreatorsList.value.length > 0;
});

const hasUnsavedChanges = computed(() => {
  if (!artwork.value) return false;

  return (
    editData.value.title !== artworkTitle.value ||
    editData.value.description !== (artworkDescription.value || '') ||
    editData.value.creators !== artworkCreators.value ||
    JSON.stringify(editData.value.tags) !== JSON.stringify(artworkTags.value)
  );
});

// Lifecycle
onMounted(async () => {
  try {
    loading.value = true;
    error.value = null;

    // Validate ID parameter
    if (!props.id || props.id.trim() === '') {
      error.value = 'Invalid artwork ID provided.';
      announceError('Invalid artwork ID');
      return;
    }

    // Check if ID is in valid format (UUID pattern or sample data format)
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const sampleDataPattern = /^SAMPLE-artwork-.+$/i;
    if (!uuidPattern.test(props.id) && !sampleDataPattern.test(props.id)) {
      error.value = 'Invalid artwork ID format. Please check the URL and try again.';
      announceError('Invalid artwork ID format');
      return;
    }

    // Always refresh artwork data to get latest updates (including approved edits)
    const artworkData = await artworksStore.refreshArtwork(props.id);

    if (!artworkData) {
      error.value = `Artwork with ID "${props.id}" was not found. It may have been removed or is pending approval.`;
      announceError('Artwork not found');
      // Try to locate a submission whose artwork_id matches this ID (best-effort, moderator only)
      if (authStore?.canReview) {
        try {
          // Heuristic: call review queue (small limit) and scan for matching artwork_id
          // Use apiService.getReviewQueue if available in this scope; lazy import fallback
          // We keep it lightweight to avoid large queries.
          // @ts-ignore - dynamic access
          const reviewModule = await import('../services/api');
          const queueResp: any = await reviewModule.apiService.getReviewQueue(
            'pending',
            undefined,
            1,
            25
          );
          const submissionsList =
            (queueResp as any).submissions || queueResp?.data?.submissions || [];
          const match = submissionsList.find((s: any) => s.artwork_id && s.artwork_id === props.id);
          if (match) {
            originatingSubmissionId.value = match.id;
          }
        } catch (e) {
          // Silent – non-critical
          console.warn('[ArtworkDetailView] Failed to resolve originating submission ID:', e);
        }
      }
      return;
    }

    announceSuccess(`Loaded artwork details: ${artworkTitle.value}`);

    // Check for pending edits if user is authenticated
    if (authStore.isAuthenticated) {
      await checkPendingEdits();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load artwork';
    if (message.includes('404') || message.includes('not found')) {
      error.value = `Artwork with ID "${props.id}" was not found. It may have been removed or is pending approval.`;
      if (authStore?.canReview) {
        try {
          const reviewModule = await import('../services/api');
          const queueResp: any = await reviewModule.apiService.getReviewQueue(
            'pending',
            undefined,
            1,
            25
          );
          const submissionsList =
            (queueResp as any).submissions || queueResp?.data?.submissions || [];
          const match = submissionsList.find((s: any) => s.artwork_id && s.artwork_id === props.id);
          if (match) {
            originatingSubmissionId.value = match.id;
          }
        } catch (e) {
          console.warn('[ArtworkDetailView] Fallback submission lookup failed:', e);
        }
      }
    } else if (message.includes('network') || message.includes('fetch')) {
      error.value =
        'Unable to load artwork details. Please check your internet connection and try again.';
    } else {
      error.value = message;
    }
    announceError('Failed to load artwork details');
  } finally {
    loading.value = false;

    // Check for submission success parameter
    if (route.query.submitted === 'true') {
      showSuccessToast('Logbook entry submitted for review!');
      // Clean up the URL parameter
      router.replace({ path: route.path });
    }
  }
});

// Methods
function showSuccessToast(message: string) {
  toastMessage.value = message;
  showToast.value = true;
  setTimeout(() => {
    showToast.value = false;
  }, 5000);
}

function handlePhotoFullscreen(photoUrl: string): void {
  fullscreenPhotoUrl.value = photoUrl;
  showFullscreenPhoto.value = true;
}

function closeFullscreenPhoto(): void {
  showFullscreenPhoto.value = false;
  fullscreenPhotoUrl.value = '';
}

function handleTagClick(tag: { label?: string; value?: string; key?: string }): void {
  if (isEditMode.value) {
    // In edit mode clicking a tag should open it for editing inside TagEditor
    // We emit a custom DOM event to TagEditor via a ref approach (future improvement).
    // For now just announce.
    announceSuccess(`Ready to edit tag ${tag.key || tag.label}`);
    return;
  }
  // Navigate to search using tag key/value
  if (tag.key && tag.value) {
    router.push(`/search/tag:${encodeURIComponent(tag.key)}:${encodeURIComponent(tag.value)}`);
  }
}

// function handleLogbookEntryClick(entry: any): void {
//   // Future: implement entry detail view
//   console.log('Logbook entry clicked:', entry);
// }

// function handleLogbookPhotoClick(photoUrl: string): void {
//   handlePhotoFullscreen(photoUrl);
// }

// function handleLoadMoreEntries(): void {
//   // Future: implement pagination
//   console.log('Load more entries requested');
// }

function goToMap(): void {
  router.push('/');
}

// Add-to-list dialog is opened by the action bar component; removed local opener

function handleAddedToList(listNames: string): void {
  showToast.value = true;
  toastMessage.value = `Added to list: ${listNames}`;
  setTimeout(() => {
    showToast.value = false;
  }, 3000);
}

// Edit mode methods
function enterEditMode(): void {
  if (!artwork.value || hasPendingEdits.value) return;

  // Initialize edit data with current values
  editData.value = {
    title: artworkTitle.value,
    description: artworkDescription.value || '',
    creators: artworkCreators.value,
    tags: { keywords: '', ...artworkTags.value }, // Copy structured tags, ensure keywords key exists
  };

  isEditMode.value = true;
  editError.value = null;
  announceSuccess('Entering edit mode');
}

function cancelEdit(): void {
  if (hasUnsavedChanges.value) {
    showCancelDialog.value = true;
  } else {
    exitEditMode();
  }
}

function confirmCancel(): void {
  showCancelDialog.value = false;
  exitEditMode();
}

function exitEditMode(): void {
  isEditMode.value = false;
  editError.value = null;
  showCancelDialog.value = false;
  announceSuccess('Exited edit mode');
}

async function saveEdit(): Promise<void> {
  if (!artwork.value || !authStore.isAuthenticated) return;

  editLoading.value = true;
  editError.value = null;

  try {
    // Prepare edit changes
    const edits = [];

    // Title edit
    if (editData.value.title !== artworkTitle.value) {
      edits.push({
        field_name: 'title',
        field_value_old: artworkTitle.value,
        field_value_new: editData.value.title,
      });
    }

    // Description edit
    const currentDescription = artworkDescription.value || '';
    if (editData.value.description !== currentDescription) {
      edits.push({
        field_name: 'description',
        field_value_old: currentDescription,
        field_value_new: editData.value.description,
      });
    }

    // Creators edit
    if (editData.value.creators !== artworkCreators.value) {
      edits.push({
        field_name: 'created_by',
        field_value_old: artworkCreators.value,
        field_value_new: editData.value.creators,
      });
    }

    // Tags edit - send structured tags as JSON to backend
    const originalTags = artworkTags.value;
    const hasTagChanges = JSON.stringify(editData.value.tags) !== JSON.stringify(originalTags);

    if (hasTagChanges) {
      edits.push({
        field_name: 'tags',
        field_value_old: JSON.stringify(originalTags),
        field_value_new: JSON.stringify(editData.value.tags),
      });
    }

    if (edits.length === 0) {
      announceError('No changes to save');
      exitEditMode();
      return;
    }

    // Submit edits to API
    const response = await apiService.submitArtworkEdit(artwork.value.id, edits);

    if (response.success) {
      announceSuccess('Your changes have been submitted for review');
      showSuccessModal.value = true;
      exitEditMode();
    } else {
      throw new Error(response.message || 'Failed to submit edits');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save changes';
    editError.value = message;
    announceError('Failed to save changes: ' + message);
  } finally {
    editLoading.value = false;
  }
}

// Check for pending edits
async function checkPendingEdits(): Promise<void> {
  if (!artwork.value || !authStore.isAuthenticated) return;

  try {
    const response = await apiService.getPendingEdits(artwork.value.id);
    if (response.success && response.data) {
      hasPendingEdits.value = response.data.has_pending_edits;
      pendingFields.value = response.data.pending_fields || [];
    }
  } catch (err) {
    // Silently fail - this is not critical functionality
    console.log('Failed to check pending edits:', err);
  }
}

// Action Bar Methods
function handleActionBarAuthRequired(): void {
  // Show the authentication modal
  showAuthModal.value = true;
}

function handleActionBarEditArtwork(): void {
  enterEditMode();
}

function handleActionBarAddLog(): void {
  if (!authStore.isAuthenticated) {
    handleActionBarAuthRequired();
    return;
  }
  
  // Navigate to logbook page for this artwork
  router.push(`/logbook/${props.id}`);
}

function handleActionBarShare(): void {
  // Action bar handles the sharing logic
  announceSuccess('Artwork shared');
}

// Feedback Methods
function handleReportMissing(): void {
  feedbackMode.value = 'missing';
  showFeedbackDialog.value = true;
}

function handleReportIssue(): void {
  feedbackMode.value = 'comment';
  showFeedbackDialog.value = true;
}

function handleFeedbackSuccess(): void {
  showFeedbackDialog.value = false;
  announceSuccess('Thank you for your feedback! Moderators will review it shortly.');
  showToast.value = true;
  toastMessage.value = 'Feedback submitted successfully';
  setTimeout(() => {
    showToast.value = false;
  }, 3000);
}

function handleFeedbackCancel(): void {
  showFeedbackDialog.value = false;
}

// (Previously had getArtworkTypeEmoji() for icon display above title; removed per product request.)
</script>

<template>
  <div class="artwork-detail-view theme-background">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <svg class="animate-spin h-12 w-12 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none"
          viewBox="0 0 24 24" :style="{ color: 'rgb(var(--md-primary))' }">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
          </path>
        </svg>
  <p :style="{ color: 'rgba(var(--md-on-background),0.9)' }">Loading artwork details...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center py-20">
      <div class="text-center max-w-md mx-auto px-4">
  <svg class="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" :style="{ color: 'rgb(var(--md-error))' }">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
  <h1 class="text-2xl font-bold mb-2" :style="{ color: 'rgb(var(--md-on-background))' }">
          <template v-if="authStore?.canReview && error?.includes('pending approval')">
            Artwork Pending Approval
          </template>
          <template v-else> Artwork Not Found </template>
        </h1>
  <p class="mb-6" :style="{ color: 'rgba(var(--md-on-background),0.85)' }">{{ error }}</p>
        <div v-if="authStore?.canReview && originatingSubmissionId" class="mb-4 text-sm text-gray-700">
          <p class="mb-1">Originating submission ID:</p>
          <code class="px-2 py-1 rounded text-xs" :style="{ background: 'rgba(var(--md-surface),0.06)', color: 'rgb(var(--md-on-surface))' }">{{
            originatingSubmissionId
          }}</code>
        </div>
        <!-- Moderator deep link: only show if user has reviewer permissions -->
        <div v-if="authStore?.canReview && props.id && error?.includes('pending approval')" class="mb-6">
          <p class="text-sm text-gray-700 mb-2">
            If this artwork was just submitted it may still be pending. You can review it now:
          </p>
          <router-link :to="{ path: '/review', query: { searchId: originatingSubmissionId || props.id } }"
            class="inline-block px-3 py-2 text-sm rounded"
            :style="{ background: 'rgba(var(--md-warning),0.08)', color: 'rgb(var(--md-on-warning))' }">
            <template v-if="originatingSubmissionId">Open Review Queue (submission
              {{ originatingSubmissionId.substring(0, 8) }}…)</template>
            <template v-else>Open Review Queue for {{ props.id.substring(0, 8) }}…</template>
          </router-link>
        </div>
        <button @click="goToMap"
          class="px-4 py-2 theme-primary rounded-lg hover:opacity-95 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
          ← Back to Map
        </button>
      </div>
    </div>

    <!-- Artwork Content -->
    <div v-else-if="artwork" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <!-- Photo Gallery - Full width at top -->
      <section aria-labelledby="photos-heading" :class="{ 'opacity-60': isEditMode }" class="mb-6 lg:mb-8">
        <h2 id="photos-heading" class="sr-only">Photo Gallery</h2>
        <div class="relative">
          <PhotoCarousel :photos="artworkPhotos" v-model:currentIndex="currentPhotoIndex"
            :alt-text-prefix="artworkTitle" @fullscreen="handlePhotoFullscreen" />

          <!-- Edit mode overlay for photos -->
          <div v-if="isEditMode"
            class="absolute inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center rounded-lg">
            <div class="text-center p-4">
              <svg class="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p class="text-sm font-medium theme-muted">Photos cannot be edited</p>
              <p class="text-xs text-gray-500 mt-1">
                Photo editing is not available in this version
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Action Bar - Social actions below photo -->
      <ArtworkActionBar
        :artwork-id="props.id"
        :user-id="authStore.user?.id || null"
        :permissions="{ canEdit: authStore.isAuthenticated }"
        @auth-required="handleActionBarAuthRequired"
        @edit-artwork="handleActionBarEditArtwork"
        @add-log="handleActionBarAddLog"
        @share-artwork="handleActionBarShare"
      />

      <!-- Feedback Buttons -->
      <div v-if="!isEditMode" class="flex gap-2 mb-6">
        <button
          @click="handleReportMissing"
          class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors"
          :style="{ 
            background: 'rgba(var(--md-error-container), 0.1)', 
            color: 'rgb(var(--md-error))',
            border: '1px solid rgba(var(--md-error), 0.2)'
          }"
          type="button"
        >
          <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-1.964-1.333-2.732 0L3.082 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Report Missing
        </button>
        <button
          @click="handleReportIssue"
          class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors"
          :style="{ 
            background: 'rgba(var(--md-surface-variant), 0.5)', 
            color: 'rgb(var(--md-on-surface-variant))',
            border: '1px solid rgba(var(--md-outline), 0.3)'
          }"
          type="button"
        >
          <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          Report Issue
        </button>
      </div>

      <!-- Artwork Details - Title, Artist, and Description -->
  <section aria-labelledby="artwork-details-heading" class="mb-6 theme-surface rounded-lg border theme-border p-6">
        <h2 id="artwork-details-heading" class="sr-only">Artwork Details</h2>
        
        <!-- Title (editable in edit mode) -->
        <div v-if="!isEditMode">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
            <div class="flex items-center gap-3">
              <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold theme-on-background leading-tight">
                {{ displayTitle }}
              </h1>
              <!-- View count badge (anonymized metric) -->
              <div v-if="artwork && artwork.view_count != null" class="ml-2">
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 theme-on-surface"
                  title="Anonymized view count">
                  <svg class="w-3 h-3 mr-1 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {{ artwork?.view_count ?? 0 }}
                </span>
              </div>
            </div>

            <!-- Inline title action buttons removed per design: actions available in the action bar below the photos -->
          </div>
        </div>
        <div v-else class="mb-4 ">
          <label for="edit-title" class="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input id="edit-title" v-model="editData.title" type="text" maxlength="512"
            class="block w-full text-2xl sm:text-3xl font-bold text-gray-900 bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter artwork title..." />
          <p class="mt-1 text-sm text-gray-500">{{ editData.title.length }}/512 characters</p>
        </div>

        <!-- Artists and Creators -->
        <div v-if="!isEditMode" class="text-base sm:text-lg text-gray-600 mb-4">
          <!-- Linked Artists (new system) -->
          <div v-if="hasArtistLinks" class="flex items-center gap-1 flex-wrap">
            <span>by</span>
            <span v-for="(artist, index) in artworkArtists" :key="artist.id">
              <button @click="navigateToArtist(artist.id)"
                class="font-medium hover:underline focus:outline-none rounded"
                :style="{ color: 'rgb(var(--md-primary))' }">
                {{ artist.name }}
              </button>
              <span v-if="index < artworkArtists.length - 1">, </span>
            </span>
          </div>
          <!-- Fallback to legacy creator info if no linked artists -->
          <div v-else-if="hasDisplayableCreators" class="flex items-center gap-1 flex-wrap">
            <span>by</span>
            <span v-for="(creatorName, index) in displayCreatorsList" :key="creatorName">
              <span class="text-gray-700 font-medium">
                {{ creatorName }}
              </span>
              <span v-if="index < displayCreatorsList.length - 1">, </span>
            </span>
          </div>
          <div v-else class="text-gray-500 italic">Artist unknown</div>
        </div>
        <div v-else-if="isEditMode" class="mb-4">
          <label for="edit-creators" class="block text-sm font-medium text-gray-700 mb-1">Created by</label>
          <input id="edit-creators" v-model="editData.creators" type="text"
            class="block w-full text-base sm:text-lg text-gray-600 bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter creators (comma separated)..." />
        </div>

        <!-- Description (combined with title and artist) -->
        <div v-if="!isEditMode" class="mt-6 pt-6 border-t border-gray-200">
          <h3 class="text-lg font-medium theme-on-surface mb-3">Description</h3>
          
          <!-- Display mode -->
          <!-- eslint-disable-next-line vue/no-v-html -- TODO: sanitize rendered markdown before binding -->
          <div v-if="displayDescription"
            class="prose prose-gray max-w-none theme-on-surface leading-relaxed" v-html="renderedDescription"></div>

          <!-- Empty description in display mode -->
          <div v-else class="theme-muted italic theme-surface p-4 rounded-lg">
            Add description - No description available for this artwork yet.
          </div>
        </div>
        
        <!-- Description edit mode -->
        <div v-else class="mt-6 pt-6 border-t border-gray-200">
          <label for="edit-description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea id="edit-description" v-model="editData.description" rows="4"
            class="block w-full bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
            placeholder="Enter artwork description..."></textarea>
          <div class="text-xs text-gray-500 space-y-1 mt-2">
            <p class="font-medium">Markdown tips:</p>
            <ul class="list-disc ml-4 space-y-0.5">
              <li><code>**bold**</code> → <strong>bold</strong></li>
              <li><code># Heading 1</code>, <code>## Heading 2</code></li>
              <li><code>* item</code> for bullet lists</li>
              <li><code>[text](https://link)</code> for links</li>
              <li><code>_italic_</code> → <em>italic</em></li>
            </ul>
          </div>
        </div>

        <!-- Edit mode controls -->
        <div v-if="isEditMode" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div class="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div class="flex items-center gap-2 text-blue-700">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span class="font-medium">Edit Mode</span>
            </div>

            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button @click="cancelEdit" :disabled="editLoading" aria-label="Cancel editing"
                class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed">
                Cancel
              </button>

              <button @click="saveEdit" :disabled="editLoading || !editData.title.trim()" aria-label="Save changes"
                class="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                <svg v-if="editLoading" class="w-4 h-4 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                  </path>
                </svg>
                <span v-else>
                  <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {{ editLoading ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </div>

          <!-- Edit error message -->
          <div v-if="editError" class="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {{ editError }}
          </div>
        </div>
      </section>

      <!-- Main content - Single column layout -->
      <div class="space-y-6 lg:space-y-8 ">
        <!-- Journal Timeline -->
        <!--
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
          -->

        <!-- Location -->
        <section aria-labelledby="location-heading" class="bg-white rounded-lg border border-gray-200 p-6"
          :class="{ 'opacity-60': isEditMode }">
          <h2 id="location-heading" class="text-lg font-semibold text-gray-900 mb-4">
            Location
          </h2>
          <div class="relative">
            <MiniMap v-if="artwork && artwork.lat != null && artwork.lon != null" :latitude="artwork?.lat"
              :longitude="artwork?.lon" :title="artworkTitle" height="200px" :zoom="16" @mapReady="handleChildMapReady" />
            <!-- Inline square Directions link removed; map control provides directions -->
            <div v-else class="text-gray-500 text-sm">Location information not available</div>

            <!-- Edit mode overlay for location -->
            <div v-if="isEditMode"
              class="absolute inset-0 bg-gray-100 bg-opacity-90 flex items-center justify-center rounded">
              <div class="text-center p-2">
                <svg class="w-8 h-8 mx-auto mb-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p class="text-xs font-medium text-gray-600">Location cannot be edited</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Combined Info + Details Section -->
        <section aria-labelledby="info-details-heading" class="bg-white rounded-lg border border-gray-200 p-6">
          <h2 id="info-details-heading" class="text-lg font-semibold text-gray-900 mb-4">
            Information & Details
          </h2>

          <!-- Always show Added first -->
          <div class="mb-4">
            <dt class="text-sm font-medium text-gray-600">Added</dt>
            <dd class="text-sm text-gray-900">
              {{
                new Date(artwork?.created_at || '').toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              }}
            </dd>
          </div>

          <!-- Keywords separate row -->
          <div v-if="!isEditMode && keywordList.length" class="mb-4">
            <div class="text-sm font-medium text-gray-600 mb-1">Keywords</div>
            <div class="flex flex-wrap gap-1">
              <button v-for="kw in keywordList" :key="kw"
                class="px-2 py-0.5 text-xs rounded-full focus:outline-none"
                :style="{ background: 'rgba(var(--md-primary),0.08)', color: 'rgb(var(--md-primary))' }"
                @click="router.push(`/search/${encodeURIComponent(kw)}`)">
                {{ kw }}
              </button>
            </div>
          </div>

          <!-- Display mode tags (excluding keywords) -->
          <div v-if="!isEditMode && Object.keys(displayTags).length > 0">
            <TagBadge :tags="displayTags" :max-visible="8" color-scheme="blue" variant="compact" :show-categories="true"
              :collapsible="false" @tag-click="handleTagClick"
              @tagSearch="(tag) => { router.push(`/search/${encodeURIComponent(tag.value)}`); }" />
          </div>
          <div v-else-if="!isEditMode" class="text-gray-500 italic text-sm">
            No additional details available.
          </div>

          <!-- Edit mode -->
          <div v-else class="space-y-4">
            <!-- Keywords editor (simple textarea) -->
            <div>
              <label for="edit-keywords" class="block text-sm font-medium text-gray-700 mb-1">Keywords (comma
                separated)</label>
              <textarea id="edit-keywords" v-model="keywordsField" maxlength="500" rows="2"
                class="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="outdoor, landmark, bronze, abstract"></textarea>
              <p class="text-xs text-gray-500 mt-1">
                {{ (editData.tags.keywords || '').length }}/500 characters. Separate with
                commas.
              </p>
            </div>
            <TagEditor ref="tagEditorRef" v-model="editData.tags" :disabled="editLoading" :max-tags="30"
              @tagAdded="key => announceSuccess(`Tag '${key}' added`)"
              @tagRemoved="key => announceSuccess(`Tag '${key}' removed`)" />
          </div>
        </section>

        <!-- CC0 License Information -->
        <section aria-labelledby="license-heading" class="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h2 id="license-heading" class="text-lg font-semibold text-gray-900 mb-3">License</h2>
          <div class="text-sm text-gray-600 space-y-2">
            <p>
              <strong>CC0 Public Domain:</strong> All user-contributed content is released under
              CC0 license.
            </p>
            <p class="text-xs text-gray-500">
              Note: Underlying artworks may still be copyrighted. This license only applies to
              user submissions.
            </p>
          </div>
        </section>
      </div>
    </div>

    <!-- Fullscreen Photo Modal -->
    <div v-if="showFullscreenPhoto" class="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
      @click="closeFullscreenPhoto" role="dialog" aria-modal="true" aria-label="Fullscreen photo view">
      <button @click="closeFullscreenPhoto"
        class="absolute top-4 right-4 text-white hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white rounded z-10"
        aria-label="Close fullscreen photo">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <img :src="fullscreenPhotoUrl" :alt="`Fullscreen view of ${artworkTitle}`"
        class="max-w-full max-h-full object-contain" @click.stop />
    </div>

    <!-- Success Modal -->
    <div v-if="showSuccessModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      role="dialog" aria-modal="true" aria-labelledby="success-modal-title" @click.self="showSuccessModal = false">
      <div class="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div class="flex items-center justify-center mb-4">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h3 id="success-modal-title" class="text-xl font-bold text-gray-900 text-center mb-2">
          Changes Submitted Successfully!
        </h3>

        <p class="text-gray-600 text-center mb-6">
          Your edits have been sent to our moderation team for review. You'll be able to see the
          updated artwork once your changes are approved.
        </p>

        <div class="flex justify-center">
          <button @click="showSuccessModal = false"
            class="px-6 py-2 theme-success rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500">
            Got it!
          </button>
        </div>
      </div>
    </div>

    <!-- Cancel confirmation dialog -->
    <div v-if="showCancelDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div class="p-4 sm:p-6">
          <div class="flex items-center mb-4">
            <svg class="w-6 h-6 text-amber-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor"
              viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 id="cancel-dialog-title" class="text-lg font-medium text-gray-900">
              Discard Changes?
            </h3>
          </div>

          <p class="text-gray-600 mb-6 text-sm sm:text-base">
            You have unsaved changes. Are you sure you want to discard them?
          </p>

          <div class="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <button @click="showCancelDialog = false"
              class="px-4 py-2 text-sm font-medium theme-on-surface bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 order-2 sm:order-1">
              Keep Editing
            </button>
            <button @click="confirmCancel"
              class="px-4 py-2 text-sm font-medium theme-error rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 order-1 sm:order-2">
              Discard Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Success Toast -->
  <div v-if="showToast" data-testid="success-toast"
    class="fixed bottom-4 left-1/2 transform -translate-x-1/2 transition-transform duration-300 ease-in-out z-50"
    :class="{ 'translate-y-0': showToast, 'translate-y-full': !showToast }">
  <div class="theme-success px-6 py-3 rounded-lg shadow-lg flex items-center">
      <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clip-rule="evenodd"></path>
      </svg>
      <span>{{ toastMessage }}</span>
    </div>
  </div>

  <!-- Add to List Dialog -->
  <AddToListDialog 
    v-if="artwork"
    v-model="showAddToListDialog"
    :artwork-id="props.id"
  @addedToList="handleAddedToList"
  />

  <!-- Feedback Dialog -->
  <FeedbackDialog
    v-if="artwork"
    :open="showFeedbackDialog"
    subject-type="artwork"
    :subject-id="props.id"
    :mode="feedbackMode"
    @success="handleFeedbackSuccess"
    @cancel="handleFeedbackCancel"
  />

  <!-- Auth Modal -->
  <AuthModal
    :is-open="showAuthModal"
    @close="showAuthModal = false"
    @success="showAuthModal = false"
  />
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
