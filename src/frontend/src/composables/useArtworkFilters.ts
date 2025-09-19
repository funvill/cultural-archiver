import { ref, computed, type Ref, type ComputedRef } from 'vue';

export interface ArtworkFilter {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

// Default additional artwork filters
const DEFAULT_ARTWORK_FILTERS: ArtworkFilter[] = [
  { 
    key: 'hasPhotos', 
    label: 'Has Photos', 
    description: 'Show only artworks with photos',
    enabled: false 
  },
  { 
    key: 'isActive', 
    label: 'Active Artworks', 
    description: 'Hide removed artworks (tag:condition:removed)',
    enabled: true 
  },
];

/**
 * Composable for managing additional artwork filters beyond type filtering
 * Provides shared state and logic for filtering artworks by photos and condition
 */
export function useArtworkFilters(): {
  artworkFilters: Ref<ArtworkFilter[]>;
  enabledFilters: ComputedRef<string[]>;
  allFiltersEnabled: ComputedRef<boolean>;
  anyFilterEnabled: ComputedRef<boolean>;
  isFilterEnabled: (filterKey: string) => boolean;
  filterArtworks: <T extends { 
    photo_count?: number; 
    tags?: Record<string, unknown> | null; 
    tags_parsed?: Record<string, unknown> | null; 
  }>(artworks: T[]) => T[];
  toggleFilter: (key: string) => void;
  enableAllFilters: () => void;
  disableAllFilters: () => void;
  resetToDefaults: () => void;
} {
  // Reactive state
  const artworkFilters = ref<ArtworkFilter[]>([...DEFAULT_ARTWORK_FILTERS]);

  // Computed properties
  const enabledFilters = computed(() => 
    artworkFilters.value.filter(filter => filter.enabled).map(filter => filter.key)
  );

  const allFiltersEnabled = computed(() => 
    artworkFilters.value.every(filter => filter.enabled)
  );

  const anyFilterEnabled = computed(() => 
    artworkFilters.value.some(filter => filter.enabled)
  );

  // Core filter logic
  function isFilterEnabled(filterKey: string): boolean {
    const filter = artworkFilters.value.find(f => f.key === filterKey);
    return filter ? filter.enabled : false;
  }

  // Check if artwork has condition:removed tag
  function hasRemovedCondition(tags_parsed: Record<string, unknown> | null | undefined): boolean {
    if (!tags_parsed) return false;
    
    // Check for condition tag with value "removed"
    if (tags_parsed.condition === 'removed') {
      return true;
    }
    
    // Check for nested condition object
    if (tags_parsed.condition && typeof tags_parsed.condition === 'object' && 
        tags_parsed.condition !== null && 'removed' in tags_parsed.condition) {
      return true;
    }
    
    return false;
  }

  // Filter function for artwork arrays
  function filterArtworks<T extends { 
    photo_count?: number; 
    tags?: Record<string, unknown> | null; 
    tags_parsed?: Record<string, unknown> | null; 
  }>(artworks: T[]): T[] {
    return artworks.filter(artwork => {
      // Apply "Has Photos" filter
      if (isFilterEnabled('hasPhotos')) {
        const photoCount = artwork.photo_count || 0;
        if (photoCount === 0) {
          return false;
        }
      }
      
      // Apply "Active Artworks" filter (exclude removed)
      if (isFilterEnabled('isActive')) {
        const tagsToCheck = artwork.tags_parsed || artwork.tags;
        if (hasRemovedCondition(tagsToCheck)) {
          return false;
        }
      }
      
      return true;
    });
  }

  // Utility functions
  function toggleFilter(key: string): void {
    const filter = artworkFilters.value.find(f => f.key === key);
    if (filter) {
      filter.enabled = !filter.enabled;
    }
  }

  function enableAllFilters(): void {
    artworkFilters.value.forEach(filter => {
      filter.enabled = true;
    });
  }

  function disableAllFilters(): void {
    artworkFilters.value.forEach(filter => {
      filter.enabled = false;
    });
  }

  function resetToDefaults(): void {
    artworkFilters.value = [...DEFAULT_ARTWORK_FILTERS];
  }

  return {
    // State
    artworkFilters,
    
    // Computed
    enabledFilters,
    allFiltersEnabled,
    anyFilterEnabled,
    
    // Methods
    isFilterEnabled,
    filterArtworks,
    toggleFilter,
    enableAllFilters,
    disableAllFilters,
    resetToDefaults,
  };
}