import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { MapPreview } from '../types';

/**
 * Map preview state management store
 * Handles the MapPreviewCard component state
 */
export const useMapPreviewStore = defineStore('mapPreview', () => {
  // State
  const currentPreview = ref<MapPreview | null>(null);
  const isVisible = ref(false);
  const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);

  // Computed
  const hasPreview = computed(() => !!currentPreview.value);

  // Actions
  function showPreview(preview: MapPreview): void {
    // Clear any existing debounce timer
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value);
      debounceTimer.value = null;
    }

    // Debounce rapid clicks (80ms as specified in PRD)
    debounceTimer.value = setTimeout(() => {
      currentPreview.value = preview;
      isVisible.value = true;
      debounceTimer.value = null;
    }, 80);
  }

  function hidePreview(): void {
    // Clear any existing debounce timer
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value);
      debounceTimer.value = null;
    }

    isVisible.value = false;
    // Keep the preview data for a moment to allow animations
    setTimeout(() => {
      if (!isVisible.value) {
        currentPreview.value = null;
      }
    }, 300); // Match animation duration
  }

  function updatePreview(preview: MapPreview): void {
    // Update existing preview (for when user clicks different marker)
    currentPreview.value = preview;
    // Keep it visible
    isVisible.value = true;
  }

  function clearPreview(): void {
    // Immediate clear without animations
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value);
      debounceTimer.value = null;
    }
    
    currentPreview.value = null;
    isVisible.value = false;
  }

  return {
    // State
    currentPreview,
    isVisible,
    
    // Computed
    hasPreview,
    
    // Actions
    showPreview,
    hidePreview,
    updatePreview,
    clearPreview,
  };
});

// Export the type for the store
export type MapPreviewStore = ReturnType<typeof useMapPreviewStore>;