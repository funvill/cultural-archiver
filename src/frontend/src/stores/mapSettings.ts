/**
 * Map Settings Store
 * Manages user preferences for map display including clustering behavior
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

const CLUSTERING_STORAGE_KEY = 'map_clustering_enabled';

export const useMapSettings = defineStore('mapSettings', () => {
  // Clustering preference (default: enabled)
  const clusteringEnabled = ref(true);

  /**
   * Initialize settings from localStorage
   */
  function initializeSettings() {
    const saved = localStorage.getItem(CLUSTERING_STORAGE_KEY);
    if (saved !== null) {
      clusteringEnabled.value = saved === 'true';
    }
  }

  /**
   * Toggle clustering on/off
   */
  function toggleClustering() {
    clusteringEnabled.value = !clusteringEnabled.value;
    localStorage.setItem(CLUSTERING_STORAGE_KEY, String(clusteringEnabled.value));
  }

  /**
   * Set clustering enabled state
   */
  function setClusteringEnabled(enabled: boolean) {
    clusteringEnabled.value = enabled;
    localStorage.setItem(CLUSTERING_STORAGE_KEY, String(enabled));
  }

  // Initialize on store creation
  initializeSettings();

  return {
    clusteringEnabled,
    toggleClustering,
    setClusteringEnabled,
  };
});
