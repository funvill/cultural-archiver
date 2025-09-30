import { computed, reactive, watch } from 'vue';
import { useUserLists } from './useUserLists';
import type { ListApiResponse } from '../../../shared/types';

// Types
export interface ArtworkTypeFilter {
  key: string;
  label: string;
  color: string;
  enabled: boolean;
}

export interface StatusFilter {
  approved: boolean;
  pending: boolean;
  rejected: boolean;
}

export interface UserListFilter {
  listId: string;
  name: string;
  enabled: boolean;
}

export interface MapFiltersState {
  artworkTypes: ArtworkTypeFilter[];
  statusFilters: StatusFilter;
  userListFilters: UserListFilter[];
  clusterEnabled: boolean;
  showOnlyMySubmissions: boolean;
  hideVisited: boolean;
  showRemoved: boolean;
}

// Default artwork types with colors (matches existing system)
const DEFAULT_ARTWORK_TYPES: ArtworkTypeFilter[] = [
  { key: 'sculpture', label: 'Sculpture', color: '#3B82F6', enabled: true },
  { key: 'mural', label: 'Mural', color: '#EF4444', enabled: true },
  { key: 'installation', label: 'Installation', color: '#10B981', enabled: true },
  { key: 'monument', label: 'Monument', color: '#F59E0B', enabled: true },
  { key: 'graffiti', label: 'Graffiti', color: '#8B5CF6', enabled: true },
  { key: 'mosaic', label: 'Mosaic', color: '#06B6D4', enabled: true },
  { key: 'fountain', label: 'Fountain', color: '#84CC16', enabled: true },
  { key: 'statue', label: 'Statue', color: '#F97316', enabled: true },
  { key: 'poster', label: 'Poster', color: '#EC4899', enabled: true },
  { key: 'sign', label: 'Sign', color: '#6B7280', enabled: true },
  { key: 'other', label: 'Other', color: '#64748B', enabled: true },
];

const DEFAULT_STATUS_FILTERS: StatusFilter = {
  approved: true,
  pending: false,
  rejected: false,
};

// Global reactive state
let globalFiltersState = reactive<MapFiltersState>({
  artworkTypes: DEFAULT_ARTWORK_TYPES.map(type => ({ ...type })),
  statusFilters: { ...DEFAULT_STATUS_FILTERS },
  userListFilters: [],
  clusterEnabled: true,
  showOnlyMySubmissions: false,
  hideVisited: false,
  showRemoved: false,
});

let isInitialized = false;

export function useMapFilters() {
  const userLists = useUserLists();

  // Initialize from localStorage on first use
  if (!isInitialized) {
    loadFiltersFromStorage();
    isInitialized = true;
  }

  // Computed properties
  const hasActiveFilters = computed(() => {
    // Check if any artwork types are disabled
    const someTypesDisabled = globalFiltersState.artworkTypes.some(type => !type.enabled);
    
    // Check if only approved status is selected (default)
    const nonDefaultStatus = !globalFiltersState.statusFilters.approved || 
                           globalFiltersState.statusFilters.pending || 
                           globalFiltersState.statusFilters.rejected;
    
    // Check if any user list filters are enabled
    const userListFiltersActive = globalFiltersState.userListFilters.some(filter => filter.enabled);
    
    // Check if showing only user's submissions
    const showingOnlyMySubmissions = globalFiltersState.showOnlyMySubmissions;
    
    // Check new simple filters
    const hideVisitedActive = globalFiltersState.hideVisited;
    const showRemovedActive = globalFiltersState.showRemoved;

    return someTypesDisabled || nonDefaultStatus || userListFiltersActive || showingOnlyMySubmissions || hideVisitedActive || showRemovedActive;
  });

  const activeFilterCount = computed(() => {
    let count = 0;
    
    // Count disabled artwork types
    count += globalFiltersState.artworkTypes.filter(type => !type.enabled).length;
    
    // Count non-default status filters
    if (!globalFiltersState.statusFilters.approved) count++;
    if (globalFiltersState.statusFilters.pending) count++;
    if (globalFiltersState.statusFilters.rejected) count++;
    
    // Count enabled user list filters
    count += globalFiltersState.userListFilters.filter(filter => filter.enabled).length;
    
    // Count "only my submissions" filter
    if (globalFiltersState.showOnlyMySubmissions) count++;
    
    // Count new simple filters
    if (globalFiltersState.hideVisited) count++;
    if (globalFiltersState.showRemoved) count++;
    
    return count;
  });

  const activeFilterDescription = computed(() => {
    if (!hasActiveFilters.value) return 'No filters active';
    
    const parts: string[] = [];
    
    const disabledTypes = globalFiltersState.artworkTypes.filter(type => !type.enabled);
    if (disabledTypes.length > 0) {
      parts.push(`${disabledTypes.length} type${disabledTypes.length !== 1 ? 's' : ''} hidden`);
    }
    
    const enabledUserLists = globalFiltersState.userListFilters.filter(filter => filter.enabled);
    if (enabledUserLists.length > 0) {
      parts.push(`${enabledUserLists.length} list${enabledUserLists.length !== 1 ? 's' : ''} active`);
    }
    
    if (globalFiltersState.showOnlyMySubmissions) {
      parts.push('only my submissions');
    }
    
    if (!globalFiltersState.statusFilters.approved || 
        globalFiltersState.statusFilters.pending || 
        globalFiltersState.statusFilters.rejected) {
      parts.push('custom status filters');
    }
    
    return parts.join(', ');
  });

  // Methods
  function loadFiltersFromStorage(): void {
    try {
      const saved = localStorage.getItem('mapFilters:state');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Merge with defaults to handle new fields
        if (parsed.artworkTypes) {
          // Update existing types, add new ones if they don't exist
          DEFAULT_ARTWORK_TYPES.forEach(defaultType => {
            const existingType = parsed.artworkTypes.find((t: ArtworkTypeFilter) => t.key === defaultType.key);
            if (existingType) {
              // Update existing with saved enabled state
              const stateType = globalFiltersState.artworkTypes.find(t => t.key === defaultType.key);
              if (stateType) {
                stateType.enabled = existingType.enabled;
              }
            }
          });
        }
        
        if (parsed.statusFilters) {
          Object.assign(globalFiltersState.statusFilters, parsed.statusFilters);
        }
        
        if (parsed.userListFilters) {
          globalFiltersState.userListFilters = parsed.userListFilters;
        }
        
        if (typeof parsed.clusterEnabled === 'boolean') {
          globalFiltersState.clusterEnabled = parsed.clusterEnabled;
        }
        
        if (typeof parsed.showOnlyMySubmissions === 'boolean') {
          globalFiltersState.showOnlyMySubmissions = parsed.showOnlyMySubmissions;
        }
        
        if (typeof parsed.hideVisited === 'boolean') {
          globalFiltersState.hideVisited = parsed.hideVisited;
        }
        
        if (typeof parsed.showRemoved === 'boolean') {
          globalFiltersState.showRemoved = parsed.showRemoved;
        }
      }
    } catch (error) {
      console.warn('Failed to load map filters from storage:', error);
    }
  }

  function saveFiltersToStorage(): void {
    try {
      localStorage.setItem('mapFilters:state', JSON.stringify(globalFiltersState));
    } catch (error) {
      console.warn('Failed to save map filters to storage:', error);
    }
  }

  function resetFilters(): void {
    // Reset artwork types
    globalFiltersState.artworkTypes.forEach(type => {
      type.enabled = true;
    });
    
    // Reset status filters
    Object.assign(globalFiltersState.statusFilters, DEFAULT_STATUS_FILTERS);
    
    // Reset user list filters
    globalFiltersState.userListFilters.forEach(filter => {
      filter.enabled = false;
    });
    
    // Reset other options
    globalFiltersState.showOnlyMySubmissions = false;
    globalFiltersState.hideVisited = false;
    globalFiltersState.showRemoved = false;
    
    saveFiltersToStorage();
  }

  function toggleArtworkType(typeKey: string): void {
    const type = globalFiltersState.artworkTypes.find(t => t.key === typeKey);
    if (type) {
      type.enabled = !type.enabled;
      saveFiltersToStorage();
    }
  }

  function setAllArtworkTypes(enabled: boolean): void {
    globalFiltersState.artworkTypes.forEach(type => {
      type.enabled = enabled;
    });
    saveFiltersToStorage();
  }

  function toggleStatusFilter(status: keyof StatusFilter): void {
    globalFiltersState.statusFilters[status] = !globalFiltersState.statusFilters[status];
    saveFiltersToStorage();
  }

  function toggleUserListFilter(listId: string): void {
    const filter = globalFiltersState.userListFilters.find(f => f.listId === listId);
    if (filter) {
      filter.enabled = !filter.enabled;
      saveFiltersToStorage();
    }
  }

  function toggleClusterEnabled(): void {
    globalFiltersState.clusterEnabled = !globalFiltersState.clusterEnabled;
    saveFiltersToStorage();
  }

  function toggleShowOnlyMySubmissions(): void {
    globalFiltersState.showOnlyMySubmissions = !globalFiltersState.showOnlyMySubmissions;
    saveFiltersToStorage();
  }

  function toggleHideVisited(): void {
    globalFiltersState.hideVisited = !globalFiltersState.hideVisited;
    saveFiltersToStorage();
  }

  function toggleShowRemoved(): void {
    globalFiltersState.showRemoved = !globalFiltersState.showRemoved;
    saveFiltersToStorage();
  }

  // Sync user lists when they're available
  async function syncUserLists(): Promise<void> {
    try {
      await userLists.fetchUserLists();
      
      // Add new user lists that aren't in our filters yet
      userLists.lists.value.forEach((list: ListApiResponse) => {
        const existing = globalFiltersState.userListFilters.find(f => f.listId === list.id);
        if (!existing) {
          globalFiltersState.userListFilters.push({
            listId: list.id,
            name: list.name,
            enabled: false,
          });
        } else {
          // Update name in case it changed
          existing.name = list.name;
        }
      });
      
      // Remove filters for lists that no longer exist
      globalFiltersState.userListFilters = globalFiltersState.userListFilters.filter(filter => 
        userLists.lists.value.some((list: ListApiResponse) => list.id === filter.listId)
      );
      
      saveFiltersToStorage();
    } catch (error) {
      console.warn('Failed to sync user lists with filters:', error);
    }
  }

  // Filter checking methods for MapComponent
  function shouldShowArtwork(artwork: any): boolean {
    // Check artwork type filter
    const typeEnabled = globalFiltersState.artworkTypes.find(type => 
      type.key === artwork.artwork_type
    )?.enabled ?? true; // Show by default if type not found
    
    if (!typeEnabled) return false;
    
    // Check "Hide Visited" filter
    if (globalFiltersState.hideVisited) {
      const isVisited = userLists.isArtworkInList(artwork.id, 'visited');
      if (isVisited) return false;
    }
    
    // Check status filter - if "Show Removed" is disabled, hide unknown/removed artwork
    const status = artwork.status || 'approved';
    if (!globalFiltersState.showRemoved && status === 'unknown') {
      return false;
    }
    
    // Always show approved artwork, only show pending/rejected if status filters allow
    if (status === 'pending' && !globalFiltersState.statusFilters.pending) return false;
    if (status === 'rejected' && !globalFiltersState.statusFilters.rejected) return false;
    
    // Check user list filters (if any are enabled)
    const enabledUserLists = globalFiltersState.userListFilters.filter(f => f.enabled);
    if (enabledUserLists.length > 0) {
      // Artwork must be in at least one enabled user list
      const isInEnabledList = enabledUserLists.some(filter => {
        // Find the actual list to determine its type
        const list = userLists.lists.value.find(l => l.id === filter.listId);
        if (!list) return false;
        
        if (list.name === 'Visited') {
          return userLists.isArtworkInList(artwork.id, 'visited');
        } else if (list.name === 'Starred') {
          return userLists.isArtworkInList(artwork.id, 'starred');
        } else if (list.name === 'Loved') {
          return userLists.isArtworkInList(artwork.id, 'loved');
        }
        return false;
      });
      
      if (!isInEnabledList) return false;
    }
    
    // Check "only my submissions" filter
    if (globalFiltersState.showOnlyMySubmissions) {
      // This would require access to user token or submission info
      // For now, we'll assume this is handled by the API query
    }
    
    return true;
  }

  // Auto-save on changes
  watch(globalFiltersState, saveFiltersToStorage, { deep: true });

  return {
    // State
    filtersState: globalFiltersState,
    
    // Computed
    hasActiveFilters,
    activeFilterCount,
    activeFilterDescription,
    
    // Methods
    resetFilters,
    toggleArtworkType,
    setAllArtworkTypes,
    toggleStatusFilter,
    toggleUserListFilter,
    toggleClusterEnabled,
    toggleShowOnlyMySubmissions,
    toggleHideVisited,
    toggleShowRemoved,
    syncUserLists,
    shouldShowArtwork,
    
    // Storage
    saveFiltersToStorage,
    loadFiltersFromStorage,
  };
}