<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import MChip from './MChip.vue';
import AddToListDialog from './AddToListDialog.vue';
import { useAuthStore } from '../stores/auth';
import { apiService } from '../services/api';
import { useAnnouncer } from '../composables/useAnnouncer';

// Props interface
interface Props {
  artworkId: string;
  userId?: string | null;
  permissions?: { canEdit: boolean };
  initialListStates?: {
    loved?: boolean;
    visited?: boolean;
    starred?: boolean;
    inAnyList?: boolean;
  };
}

// Emits interface
interface Emits {
  (e: 'authRequired'): void;
  (e: 'editArtwork'): void;
  (e: 'addLog'): void;
  (e: 'shareArtwork'): void;
}

const props = withDefaults(defineProps<Props>(), {
  permissions: () => ({ canEdit: false }),
});

const emit = defineEmits<Emits>();

// Composables
const authStore = useAuthStore();
const { announceError, announceSuccess } = useAnnouncer();

// Local state
const listStates = ref({
  loved: false,
  visited: false,
  starred: false,
  inAnyList: false,
});

const loadingStates = ref({
  loved: false,
  visited: false,
  starred: false,
  bookmark: false,
  share: false,
});

// Public counts for each action (visible to all users)
const publicCounts = ref({
  loved: 0,
  visited: 0,
  starred: 0,
});

// Success animation states
const successAnimations = ref({
  loved: false,
  visited: false,
  starred: false,
});

const initialLoading = ref(true);
const showAddToListDialog = ref(false);

// Debounce map to prevent duplicate requests
const pendingRequests = ref(new Set<string>());

// Computed properties
const isAuthenticated = computed(() => authStore.isAuthenticated);
const canEdit = computed(() => props.permissions?.canEdit || false);

const chipData = computed(() => [
  {
    id: 'loved',
    icon: 'heart',
    label: 'Loved',
    active: listStates.value.loved,
    loading: loadingStates.value.loved,
    ...(publicCounts.value.loved > 0 && { count: publicCounts.value.loved }),
    showSuccessAnimation: successAnimations.value.loved,
    ariaLabel: listStates.value.loved 
      ? 'Remove from Loved list - currently in list' 
      : 'Add to Loved list - not in list',
    action: () => toggleListMembership('loved'),
  },
  {
    id: 'visited',
    icon: 'flag',
    label: 'Visited',
    active: listStates.value.visited,
    loading: loadingStates.value.visited,
    ...(publicCounts.value.visited > 0 && { count: publicCounts.value.visited }),
    showSuccessAnimation: successAnimations.value.visited,
    ariaLabel: listStates.value.visited 
      ? 'Remove from Visited list - currently in list' 
      : 'Add to Visited list - not in list',
    action: () => toggleListMembership('visited'),
  },
  {
    id: 'starred',
    icon: 'star',
    label: 'Starred',
    active: listStates.value.starred,
    loading: loadingStates.value.starred,
    ...(publicCounts.value.starred > 0 && { count: publicCounts.value.starred }),
    showSuccessAnimation: successAnimations.value.starred,
    ariaLabel: listStates.value.starred 
      ? 'Remove from Starred list - currently in list' 
      : 'Add to Starred list - not in list',
    action: () => toggleListMembership('starred'),
  },
  {
    id: 'bookmark',
    icon: 'bookmark',
    label: 'Add to List',
    active: listStates.value.inAnyList,
    loading: loadingStates.value.bookmark,
    ariaLabel: 'Manage lists - open list selection modal',
    action: () => openAddToListDialog(),
  },
  {
    id: 'addLog',
    icon: 'document-add',
    label: 'Add Log',
    active: false,
    loading: false,
    ariaLabel: 'Add a log entry for this artwork',
    action: () => handleAddLog(),
  },
  {
    id: 'share',
    icon: 'share',
    label: 'Share',
    active: false,
    loading: loadingStates.value.share,
    ariaLabel: 'Share this artwork',
    action: () => handleShare(),
  },
  ...(canEdit.value ? [{
    id: 'edit',
    icon: 'pencil',
    label: 'Edit',
    active: false,
    loading: false,
    ariaLabel: 'Edit this artwork',
    action: () => handleEdit(),
  }] : []),
]);

// Lifecycle
onMounted(async () => {
  // Use initial states if provided, set them first
  if (props.initialListStates) {
    // Update each property individually to preserve reactivity
    if ('loved' in props.initialListStates)
      listStates.value.loved = !!props.initialListStates.loved;
    if ('visited' in props.initialListStates)
      listStates.value.visited = !!props.initialListStates.visited;
    if ('starred' in props.initialListStates)
      listStates.value.starred = !!props.initialListStates.starred;
    if ('inAnyList' in props.initialListStates)
      listStates.value.inAnyList = !!props.initialListStates.inAnyList;
    initialLoading.value = false;
  }
  
  // Always fetch public counts (available to everyone)
  try {
    await fetchPublicCounts();
  } catch (error) {
    // Don't fail the component if counts fail
    console.error('Failed to fetch public counts:', error);
  }
  
  // Fetch membership states if needed
  if (!props.initialListStates && isAuthenticated.value) {
    try {
      await fetchMembershipStates();
    } catch (error) {
      console.error('Failed to fetch membership states:', error);
      initialLoading.value = false;
    }
  } else if (!props.initialListStates) {
    initialLoading.value = false;
  }
});

// Watch for authentication changes
watch(() => authStore.isAuthenticated, async (newAuth) => {
  if (newAuth && !props.initialListStates) {
    await fetchMembershipStates();
  }
});

// Methods
async function fetchMembershipStates(): Promise<void> {
  if (!props.userId && !isAuthenticated.value) {
    initialLoading.value = false;
    return;
  }

  try {
    initialLoading.value = true;
    // This endpoint would need to be implemented in the backend
    const response = await apiService.get<{
      success: boolean;
      data?: {
        loved?: boolean;
        visited?: boolean;
        starred?: boolean;
        inAnyList?: boolean;
      };
    }>(`/artwork/${props.artworkId}/membership`);
    if (response.success && response.data) {
      // Update each property individually to preserve reactivity
      console.debug('[ArtworkActionBar] fetchMembershipStates response', response.data);
      listStates.value.loved = response.data.loved || false;
      listStates.value.visited = response.data.visited || false;
      listStates.value.starred = response.data.starred || false;
      listStates.value.inAnyList = response.data.inAnyList || false;
      console.debug('[ArtworkActionBar] After fetchMembershipStates: listStates', JSON.parse(JSON.stringify(listStates.value)));
    }
  } catch (error) {
    console.error('Failed to fetch membership states:', error);
    // Keep default states and allow interactions
  } finally {
    initialLoading.value = false;
  }
}

// Fetch public counts for the artwork (available to all users)
async function fetchPublicCounts() {
  try {
    const response = await apiService.get<{
      success: boolean;
      data?: {
        loved?: number;
        visited?: number;
        starred?: number;
      };
    }>(`/artwork/${props.artworkId}/counts`);
    
    if (response.success && response.data) {
      publicCounts.value = {
        loved: response.data.loved || 0,
        visited: response.data.visited || 0,
        starred: response.data.starred || 0,
      };
    }
  } catch (error) {
    console.error('Failed to fetch public counts:', error);
    // Keep default counts (0) - not critical for functionality
  }
}

async function toggleListMembership(listType: 'loved' | 'visited' | 'starred'): Promise<void> {
  // Check authentication
  if (!isAuthenticated.value) {
    emit('authRequired');
    return;
  }

  // Prevent duplicate requests
  const requestKey = `toggle-${listType}`;
  if (pendingRequests.value.has(requestKey)) {
    return;
  }

  pendingRequests.value.add(requestKey);
  loadingStates.value[listType] = true;

  // Store original state for potential revert
  const originalState = listStates.value[listType];
  console.debug(`[ArtworkActionBar] Before optimistic update: listStates.${listType} =`, originalState);
  // Optimistic update
  listStates.value[listType] = !originalState;
  console.debug(`[ArtworkActionBar] After optimistic update: listStates.${listType} =`, listStates.value[listType]);

  try {
    // This endpoint would need to be implemented in the backend
    const action = originalState ? 'remove' : 'add';
    const response = await apiService.post<{
      success: boolean;
      message?: string;
    }>(`/artwork/${props.artworkId}/lists/${listType}`, {
      action,
    });

    if (!response.success) {
      throw new Error(response.message || `Failed to ${action} artwork ${listType} list`);
    }

    // Refetch membership states to ensure consistency
    await fetchMembershipStates();

    announceSuccess(
      originalState 
        ? `Removed from ${getListDisplayName(listType)} list`
        : `Added to ${getListDisplayName(listType)} list`
    );
    
    // Trigger success animation
    triggerSuccessAnimation(listType);
    
    // Refresh public counts after successful action
    await fetchPublicCounts();
    
    // Also refresh membership states to ensure consistency
    if (isAuthenticated.value) {
      await fetchMembershipStates();
    }
  } catch (error) {
    console.error(`Failed to toggle ${listType}:`, error);
    
    // Revert optimistic update
    listStates.value[listType] = originalState;
    
    announceError("Couldn't update list. Please try again.");
  } finally {
    loadingStates.value[listType] = false;
    pendingRequests.value.delete(requestKey);
  }
}

function getListDisplayName(listType: string): string {
  const names: Record<string, string> = {
    loved: 'Loved',
    visited: 'Visited',
    starred: 'Starred',
  };
  return names[listType] || listType;
}

// Trigger success animation for a specific chip
function triggerSuccessAnimation(listType: 'loved' | 'visited' | 'starred'): void {
  successAnimations.value[listType] = true;
  
  // Reset animation after it completes
  setTimeout(() => {
    successAnimations.value[listType] = false;
  }, 500);
}

function openAddToListDialog(): void {
  // Check authentication
  if (!isAuthenticated.value) {
    emit('authRequired');
    return;
  }

  showAddToListDialog.value = true;
}

async function handleAddedToList(): Promise<void> {
  // Refetch membership states after list changes
  await fetchMembershipStates();
  showAddToListDialog.value = false;
  announceSuccess('Updated artwork lists');
}

function handleAddLog(): void {
  if (!isAuthenticated.value) {
    emit('authRequired');
    return;
  }
  
  emit('addLog');
}

function handleEdit(): void {
  if (!isAuthenticated.value) {
    emit('authRequired');
    return;
  }

  emit('editArtwork');
}

async function handleShare(): Promise<void> {
  loadingStates.value.share = true;

  try {
    const shareData = {
      title: `Artwork - Cultural Archiver`,
      text: 'Check out this artwork on Cultural Archiver',
      url: window.location.href,
    };

    // Try native Web Share API first
    if (navigator.share) {
      await navigator.share(shareData);
      announceSuccess('Shared successfully');
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(window.location.href);
      announceSuccess('Link copied to clipboard');
    }

    emit('shareArtwork');
  } catch (error) {
    console.error('Failed to share:', error);
    
    // Fallback: try to copy to clipboard
    try {
      await navigator.clipboard.writeText(window.location.href);
      announceSuccess('Link copied to clipboard');
    } catch (clipboardError) {
      console.error('Failed to copy to clipboard:', clipboardError);
      announceError('Failed to share. Please copy the URL manually.');
    }
  } finally {
    loadingStates.value.share = false;
  }
}
</script>

<template>
  <div class="artwork-action-bar" data-testid="artwork-action-bar">
    <!-- Divider above -->
    <hr class="border-t border-gray-200 my-4" />

    <!-- Action bar container -->
    <div class="flex flex-wrap justify-center gap-2 sm:gap-3 px-4 py-2" role="toolbar" aria-label="Artwork actions">
      <MChip
        v-for="chip in chipData"
        :key="chip.id"
        :icon="chip.icon"
        :label="chip.label"
        :active="chip.active"
        :loading="initialLoading || chip.loading"
        :show-success-animation="'showSuccessAnimation' in chip ? chip.showSuccessAnimation : false"
        :aria-label="chip.ariaLabel"
        :show-label="true"
        variant="outlined"
        size="md"
        :data-testid="`chip-${chip.id}`"
        v-bind="'count' in chip && chip.count > 0 ? { count: chip.count } : {}"
        @click="chip.action"
        class="min-w-0"
      />
    </div>

    <!-- Divider below -->
    <hr class="border-t border-gray-200 my-4" />

    <!-- Add to List Dialog -->
    <AddToListDialog
      v-if="showAddToListDialog && isAuthenticated"
      :model-value="showAddToListDialog"
      :artwork-id="artworkId"
      data-testid="add-to-list-dialog"
      @update:model-value="showAddToListDialog = $event"
  @addedToList="handleAddedToList"
    />

    <!-- Screen reader announcements -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      <span v-if="initialLoading">Loading artwork actions...</span>
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

/* Ensure action bar has proper spacing */
.artwork-action-bar {
  margin: 1rem 0;
}

/* Responsive adjustments */
@media (min-width: 768px) {
  .artwork-action-bar .flex {
    gap: 1rem;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .artwork-action-bar hr {
    border-color: currentColor;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .artwork-action-bar * {
    transition: none !important;
    animation: none !important;
  }
}
</style>