import { ref, computed, type Ref, type ComputedRef } from 'vue';

export interface ArtworkTypeToggle {
  key: string;
  label: string;
  enabled: boolean;
  color: string;
}

// Default artwork type filters with consistent styling
const DEFAULT_ARTWORK_TYPES: ArtworkTypeToggle[] = [
  { key: 'mural', label: 'Mural', enabled: true, color: '#4f46e5' },
  { key: 'sculpture', label: 'Sculpture', enabled: true, color: '#059669' },
  { key: 'monument', label: 'Monument', enabled: true, color: '#e11d48' },
  { key: 'installation', label: 'Installation', enabled: true, color: '#c026d3' },
  { key: 'statue', label: 'Statue', enabled: true, color: '#d97706' },
  { key: 'mosaic', label: 'Mosaic', enabled: true, color: '#0891b2' },
  { key: 'graffiti', label: 'Graffiti', enabled: true, color: '#ca8a04' },
  { key: 'street_art', label: 'Street Art', enabled: true, color: '#db2777' },
  { key: 'tiny_library', label: 'Tiny Library', enabled: true, color: '#0d9488' },
  { key: 'memorial_or_monument', label: 'Memorial', enabled: true, color: '#e11d48' },
  { key: 'totem_pole', label: 'Totem Pole', enabled: true, color: '#d97706' },
  { key: 'fountain_or_water_feature', label: 'Fountain', enabled: true, color: '#0891b2' },
  { key: 'two-dimensional_artwork', label: '2D Artwork', enabled: true, color: '#4f46e5' },
  { key: 'site-integrated_work', label: 'Site-Integrated Work', enabled: true, color: '#c026d3' },
  { key: 'media_work', label: 'Media Work', enabled: true, color: '#db2777' },
  { key: 'figurative', label: 'Figurative', enabled: true, color: '#059669' },
  { key: 'bust', label: 'Bust', enabled: true, color: '#d97706' },
  { key: 'socially_engaged_art', label: 'Social Art', enabled: true, color: '#db2777' },
  { key: 'relief', label: 'Relief', enabled: true, color: '#0891b2' },
  { key: 'stone', label: 'Stone', enabled: true, color: '#78716c' },
  { key: 'gateway', label: 'Gateway', enabled: true, color: '#2563eb' },
  { key: 'other', label: 'Other', enabled: true, color: '#6366f1' },
  { key: 'unknown', label: 'Unknown', enabled: true, color: '#6b7280' },
];

/**
 * Composable for managing artwork type filters
 * Provides shared state and logic for filtering artworks by type across components
 */
export function useArtworkTypeFilters(): {
  artworkTypes: Ref<ArtworkTypeToggle[]>;
  enabledTypes: ComputedRef<string[]>;
  allTypesEnabled: ComputedRef<boolean>;
  anyTypeEnabled: ComputedRef<boolean>;
  isArtworkTypeEnabled: (artworkType: string) => boolean;
  filterArtworks: <T extends { type_name?: string | null }>(artworks: T[]) => T[];
  toggleArtworkType: (key: string) => void;
  enableAllTypes: () => void;
  disableAllTypes: () => void;
  resetToDefaults: () => void;
  getTypeColor: (artworkType: string) => string;
} {
  // Reactive state
  const artworkTypes = ref<ArtworkTypeToggle[]>([...DEFAULT_ARTWORK_TYPES]);

  // Computed properties
  const enabledTypes = computed(() => 
    artworkTypes.value.filter(type => type.enabled).map(type => type.key)
  );

  const allTypesEnabled = computed(() => 
    artworkTypes.value.every(type => type.enabled)
  );

  const anyTypeEnabled = computed(() => 
    artworkTypes.value.some(type => type.enabled)
  );

  // Core filter logic
  function isArtworkTypeEnabled(artworkType: string): boolean {
    const normalizedType = artworkType.toLowerCase();
    const typeToggle = artworkTypes.value.find((toggle: ArtworkTypeToggle) => toggle.key === normalizedType);
    
    // If we find a matching filter, return its enabled state
    if (typeToggle) {
      return typeToggle.enabled;
    }
    
    // For unknown types, treat them as "Other" category
    // Only show unknown types if the "Other" filter is enabled
    const otherToggle = artworkTypes.value.find((toggle: ArtworkTypeToggle) => toggle.key === 'other');
    return otherToggle ? otherToggle.enabled : false;
  }

  // Filter function for artwork arrays
  function filterArtworks<T extends { type_name?: string | null }>(artworks: T[]): T[] {
    return artworks.filter(artwork => {
      const typeName = artwork.type_name || 'Unknown';
      return isArtworkTypeEnabled(typeName);
    });
  }

  // Utility functions
  function toggleArtworkType(key: string): void {
    const typeToggle = artworkTypes.value.find(type => type.key === key);
    if (typeToggle) {
      typeToggle.enabled = !typeToggle.enabled;
    }
  }

  function enableAllTypes(): void {
    artworkTypes.value.forEach(type => {
      type.enabled = true;
    });
  }

  function disableAllTypes(): void {
    artworkTypes.value.forEach(type => {
      type.enabled = false;
    });
  }

  function resetToDefaults(): void {
    artworkTypes.value = [...DEFAULT_ARTWORK_TYPES];
  }

  function getTypeColor(artworkType: string): string {
    const normalizedType = artworkType.toLowerCase();
    const typeToggle = artworkTypes.value.find(type => type.key === normalizedType);
    
    if (typeToggle) {
      return typeToggle.color;
    }
    
    // Fallback to "Other" color for unknown types
    const otherToggle = artworkTypes.value.find(type => type.key === 'other');
    return otherToggle?.color || '#6366f1';
  }

  return {
    // State
    artworkTypes,
    
    // Computed
    enabledTypes,
    allTypesEnabled,
    anyTypeEnabled,
    
    // Methods
    isArtworkTypeEnabled,
    filterArtworks,
    toggleArtworkType,
    enableAllTypes,
    disableAllTypes,
    resetToDefaults,
    getTypeColor,
  };
}