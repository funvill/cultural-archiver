/**
 * Map Settings Store
 * Manages user preferences for map display including clustering behavior
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { canUseLocalStorage } from '../lib/isClient';

const CLUSTERING_STORAGE_KEY = 'map_clustering_enabled';

export const useMapSettings = defineStore('mapSettings', () => {
  // Clustering preference (default: enabled)
  const clusteringEnabled = ref(true);

  /**
   * Initialize settings from localStorage (safe to call on client)
   */
  function initializeSettings(): void {
    if (!canUseLocalStorage()) {
      console.log('[MAP DIAGNOSTIC] localStorage unavailable; skipping map settings initialization');
      return;
    }

    const saved = localStorage.getItem(CLUSTERING_STORAGE_KEY);
    if (saved !== null) {
      clusteringEnabled.value = saved === 'true';
      console.log('[MAP DIAGNOSTIC] Clustering setting loaded from localStorage:', clusteringEnabled.value);
    } else {
      console.log('[MAP DIAGNOSTIC] No saved clustering setting, using default:', clusteringEnabled.value);
    }
  }

  /**
   * Toggle clustering on/off
   */
  function toggleClustering(): void {
    clusteringEnabled.value = !clusteringEnabled.value;
    if (canUseLocalStorage()) {
      try {
        localStorage.setItem(CLUSTERING_STORAGE_KEY, String(clusteringEnabled.value));
      } catch (e) {
        console.warn('[MAP DIAGNOSTIC] Failed to persist clustering setting:', e);
      }
    }
    console.log('[MAP DIAGNOSTIC] Clustering toggled to:', clusteringEnabled.value);
  }

  /**
   * Set clustering enabled state
   */
  function setClusteringEnabled(enabled: boolean): void {
    clusteringEnabled.value = enabled;
    if (canUseLocalStorage()) {
      try {
        localStorage.setItem(CLUSTERING_STORAGE_KEY, String(enabled));
      } catch (e) {
        console.warn('[MAP DIAGNOSTIC] Failed to persist clustering setting:', e);
      }
    }
    console.log('[MAP DIAGNOSTIC] Clustering set to:', enabled);
  }

  // Note: Do not initialize automatically on store creation to keep SSR safe.
  // Call initializeSettings() from client-side entry or components (onMounted) if desired.

  return {
    clusteringEnabled,
    toggleClustering,
    setClusteringEnabled,
    initializeSettings,
  };
});
