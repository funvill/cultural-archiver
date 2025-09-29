<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { marked } from 'marked';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import PhotoCarousel from '../components/PhotoCarousel.vue';
import TagBadge from '../components/TagBadge.vue';
import { useAnnouncer } from '../composables/useAnnouncer';
import type { ArtistApiResponse } from '../../../shared/types';

// Props
interface Props {
  id: string;
}

const props = defineProps<Props>();

// Stores and routing
const authStore = useAuthStore();
const router = useRouter();

// Announcer for screen reader feedback
const { announceError, announceSuccess } = useAnnouncer();

// State
const loading = ref(true);
const error = ref<string | null>(null);
const artist = ref<ArtistApiResponse | null>(null);

// Template refs
const keyInput = ref<HTMLInputElement>();
const valueInput = ref<HTMLInputElement>();

// Edit mode state
const isEditMode = ref(false);
const editLoading = ref(false);
const editError = ref<string | null>(null);
const showCancelDialog = ref(false);
const showSuccessModal = ref(false);
const hasPendingEdits = ref(false);
const pendingEditSubmittedAt = ref<string | null>(null);

// Edit form data
const editData = ref({
  name: '',
  description: '',
  tags: {} as Record<string, unknown>,
});

// Track original values for dirty checking
const originalData = ref({
  name: '',
  description: '',
  tags: {} as Record<string, unknown>,
});

// Rendered bio (sanitized). marked may be async depending on configuration,
// so compute this reactively and support async parsing.
const renderedBio = ref<string>('');
watch(
  () => artist.value?.description,
  async (desc) => {
    if (!desc) {
      renderedBio.value = '';
      return;
    }
    try {
      const parsed = await marked(desc as string);
      renderedBio.value = sanitizeHtml(parsed as string);
    } catch (err) {
      console.error('Failed to render artist bio markdown:', err);
      renderedBio.value = '';
    }
  },
  { immediate: true }
);

const hasUnsavedChanges = computed(() => {
  return (
    editData.value.name !== originalData.value.name ||
    editData.value.description !== originalData.value.description ||
    JSON.stringify(editData.value.tags) !== JSON.stringify(originalData.value.tags)
  );
});

const artworkPhotos = computed(() => {
  if (!artist.value?.artworks) return [];
  return artist.value.artworks
    .filter(artwork => artwork.recent_photo)
    .map(artwork => artwork.recent_photo!);
});

// Functions
async function loadArtist() {
  try {
    loading.value = true;
    error.value = null;

    const response = await fetch(`/api/artists/${props.id}`);

    if (!response.ok) {
      if (response.status === 404) {
        error.value = 'Artist not found';
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    artist.value = result.data;

    // Set form data
    if (artist.value) {
      editData.value = {
        name: artist.value.name,
        description: artist.value.description || '',
        tags: artist.value.tags_parsed || {},
      };
      originalData.value = { ...editData.value };
    }
  } catch (err) {
    console.error('Failed to load artist:', err);
    error.value = 'Failed to load artist details. Please try again.';
    announceError('Failed to load artist details');
  } finally {
    loading.value = false;
  }
}

async function checkPendingEdits() {
  if (!authStore.isAuthenticated) return;

  try {
    const response = await fetch(`/api/artists/${props.id}/pending-edits`);
    if (response.ok) {
      const result = await response.json();
      hasPendingEdits.value = result.data.has_pending_edits;
      pendingEditSubmittedAt.value = result.data.submitted_at || null;
    }
  } catch (err) {
    console.error('Failed to check pending edits:', err);
  }
}

function startEdit() {
  if (!authStore.isAuthenticated) {
    announceError('Please log in to edit artist information');
    return;
  }

  if (hasPendingEdits.value) {
    announceError('You have pending edits for this artist that are awaiting moderation');
    return;
  }

  isEditMode.value = true;
  editError.value = null;
}

function cancelEdit() {
  if (hasUnsavedChanges.value) {
    showCancelDialog.value = true;
  } else {
    isEditMode.value = false;
  }
}

function confirmCancel() {
  editData.value = { ...originalData.value };
  isEditMode.value = false;
  showCancelDialog.value = false;
  editError.value = null;
}

async function saveEdit() {
  if (!hasUnsavedChanges.value) {
    isEditMode.value = false;
    return;
  }

  try {
    editLoading.value = true;
    editError.value = null;

    // Build edits array
    const edits = [];

    if (editData.value.name !== originalData.value.name) {
      edits.push({
        field_name: 'name',
        field_value_old: originalData.value.name,
        field_value_new: editData.value.name,
      });
    }

    if (editData.value.description !== originalData.value.description) {
      edits.push({
        field_name: 'description',
        field_value_old: originalData.value.description,
        field_value_new: editData.value.description,
      });
    }

    if (JSON.stringify(editData.value.tags) !== JSON.stringify(originalData.value.tags)) {
      edits.push({
        field_name: 'tags',
        field_value_old: JSON.stringify(originalData.value.tags),
        field_value_new: JSON.stringify(editData.value.tags),
      });
    }

    if (edits.length === 0) {
      isEditMode.value = false;
      return;
    }

    const response = await fetch(`/api/artists/${props.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ edits }),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    // Success
    isEditMode.value = false;
    showSuccessModal.value = true;
    hasPendingEdits.value = true;
    announceSuccess('Artist edits submitted for moderation');
  } catch (err) {
    console.error('Failed to save artist edits:', err);
    editError.value = err instanceof Error ? err.message : 'Failed to save changes';
    announceError('Failed to save artist edits');
  } finally {
    editLoading.value = false;
  }
}

function navigateToArtwork(artworkId: string) {
  router.push(`/artwork/${artworkId}`);
}

function addTag(key: string, value: string) {
  editData.value.tags[key] = value;
}

function removeTag(key: string) {
  delete editData.value.tags[key];
}

function addTagFromInputs() {
  const keyEl = keyInput.value;
  const valueEl = valueInput.value;

  if (keyEl && valueEl && keyEl.value && valueEl.value) {
    addTag(keyEl.value, valueEl.value);
    keyEl.value = '';
    valueEl.value = '';
  }
}

// Lifecycle
onMounted(() => {
  loadArtist();
  checkPendingEdits();
});

function focusValueInput(): void {
  const el = valueInput.value as HTMLInputElement | undefined;
  if (el) el.focus();
}
</script>

<template>
  <div class="container mx-auto px-4 py-6 max-w-6xl">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading artist details...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <div class="text-red-600 mb-4">
        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">{{ error }}</h2>
      <button @click="loadArtist" class="text-blue-600 hover:text-blue-700 underline">
        Try Again
      </button>
    </div>

    <!-- Artist Content -->
    <div v-else-if="artist" class="space-y-8">
      <!-- Header -->
      <div class="border-b border-gray-200 pb-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div class="flex-1">
            <h1 v-if="!isEditMode" class="text-3xl font-bold text-gray-900">
              {{ artist.name }}
            </h1>
            <div v-else>
              <label for="edit-name" class="block text-sm font-medium text-gray-700 mb-1">
                Artist Name
              </label>
              <input
                id="edit-name"
                v-model="editData.name"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter artist name"
              />
            </div>

            <div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <span v-if="artist.artwork_count">
                {{ artist.artwork_count }} artwork{{ artist.artwork_count !== 1 ? 's' : '' }}
              </span>
              <span>Active</span>
            </div>
          </div>

          <!-- Edit Controls -->
          <div class="flex items-center gap-3">
            <div v-if="hasPendingEdits" class="text-sm">
              <div class="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span>Edits pending moderation</span>
              </div>
            </div>

            <div v-if="!isEditMode">
              <button
                @click="startEdit"
                :disabled="hasPendingEdits"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit Artist Info
              </button>
            </div>

            <div v-else class="flex items-center gap-2">
              <button
                @click="cancelEdit"
                class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                @click="saveEdit"
                :disabled="editLoading || !hasUnsavedChanges"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="editLoading">Saving...</span>
                <span v-else>Save Changes</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Edit Error -->
        <div v-if="editError" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-red-800">{{ editError }}</p>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Left Column: Biography and Tags -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Biography -->
          <div class="bg-white rounded-lg border border-gray-200 p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Biography</h2>

            <div v-if="!isEditMode">
              <!-- eslint-disable-next-line vue/no-v-html -- TODO: sanitize rendered markdown before binding -->
              <div
                v-if="artist.description"
                class="prose prose-gray max-w-none"
                v-html="renderedBio"
              ></div>
              <p v-else class="text-gray-500 italic">No biography available.</p>
            </div>

            <div v-else>
              <label for="edit-description" class="block text-sm font-medium text-gray-700 mb-2">
                Biography (Markdown supported)
              </label>
              <textarea
                id="edit-description"
                v-model="editData.description"
                rows="8"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter artist biography, artist statement, or CV..."
              ></textarea>
            </div>
          </div>

          <!-- Tags -->
          <div class="bg-white rounded-lg border border-gray-200 p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Information</h2>

            <div v-if="!isEditMode">
              <div v-if="Object.keys(artist.tags_parsed || {}).length > 0" class="space-y-3">
                <div v-for="[key, value] in Object.entries(artist.tags_parsed || {})" :key="key">
                  <TagBadge :tags="{ [key]: String(value) }" />
                </div>
              </div>
              <p v-else class="text-gray-500 italic">No additional information available.</p>
            </div>

            <div v-else>
              <div class="space-y-3 mb-4">
                <div
                  v-for="[key, value] in Object.entries(editData.tags)"
                  :key="key"
                  class="flex items-center gap-2 p-2 bg-gray-50 rounded"
                >
                  <span class="text-sm font-medium text-gray-700">{{ key }}:</span>
                  <span class="text-sm text-gray-600">{{ value }}</span>
                  <button
                    @click="removeTag(key)"
                    class="text-red-600 hover:text-red-700"
                    aria-label="Remove tag"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="flex gap-2">
                <input
                  ref="keyInput"
                  type="text"
                  placeholder="Key (e.g., website)"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  @keydown.enter="focusValueInput"
                />
                <input
                  ref="valueInput"
                  type="text"
                  placeholder="Value"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  @keydown.enter="addTagFromInputs"
                />
                <button
                  @click="addTagFromInputs"
                  class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Artworks -->
        <div class="space-y-6">
          <!-- Artwork Gallery -->
          <div class="bg-white rounded-lg border border-gray-200 p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Artworks</h2>

            <div v-if="artist.artworks && artist.artworks.length > 0" class="space-y-4">
              <div
                v-for="artwork in artist.artworks"
                :key="artwork.id"
                class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                @click="navigateToArtwork(artwork.id)"
              >
                <div v-if="artwork.recent_photo" class="aspect-w-16 aspect-h-9">
                  <img
                    :src="artwork.recent_photo"
                    :alt="artwork.title || 'Artwork'"
                    class="w-full h-32 object-cover"
                  />
                </div>
                <div class="p-3">
                  <h3 class="font-medium text-gray-900">{{ artwork.title || 'Untitled' }}</h3>
                  <p class="text-sm text-gray-600 mt-1">{{ artwork.type_name }}</p>
                  <p v-if="artwork.photo_count" class="text-xs text-gray-500 mt-1">
                    {{ artwork.photo_count }} photo{{ artwork.photo_count !== 1 ? 's' : '' }}
                  </p>
                </div>
              </div>
            </div>

            <p v-else class="text-gray-500 italic">No artworks found for this artist.</p>
          </div>

          <!-- Photo Gallery -->
          <div
            v-if="artworkPhotos.length > 0"
            class="bg-white rounded-lg border border-gray-200 p-6"
          >
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Recent Photos</h2>
            <PhotoCarousel
              :photos="artworkPhotos"
              @photoSelect="
                index => {
                  if (artist?.artworks?.[index]) {
                    navigateToArtwork(artist.artworks[index].id);
                  }
                }
              "
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Cancel Confirmation Dialog -->
    <div
      v-if="showCancelDialog"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Discard Changes?</h3>
        <p class="text-gray-600 mb-6">
          You have unsaved changes. Are you sure you want to discard them?
        </p>
        <div class="flex gap-3 justify-end">
          <button
            @click="showCancelDialog = false"
            class="px-4 py-2 text-gray-600 hover:text-gray-700"
          >
            Keep Editing
          </button>
          <button
            @click="confirmCancel"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>

    <!-- Success Modal -->
    <div
      v-if="showSuccessModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              class="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900">Changes Submitted</h3>
        </div>
        <p class="text-gray-600 mb-6">
          Your edits have been submitted for moderation and will be reviewed by our team.
        </p>
        <div class="flex justify-end">
          <button
            @click="showSuccessModal = false"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
</style>
