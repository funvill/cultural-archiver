/**
 * Composable for managing map filtering functionality
 * Implements requirements from tasks/prd-map-filtering.md
 */

import { ref, computed, watch, type Ref } from 'vue';
import type { ArtworkPin, ListApiResponse } from '../types';
import { apiService } from '../services/api';
import { SPECIAL_LIST_NAMES } from '../../../shared/types';

export interface MapFilter {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  type: 'list' | 'system' | 'subtractive';
  listId?: string;
}

interface MapFilterState {
  wantToSee: boolean;
  userLists: string[]; // Array of list IDs
  notSeenByMe: boolean;
}

/**
 * Composable for managing map filtering state and operations
 * Provides filtering logic for the main map view
 */
export function useMapFilters() {
  // Internal state
  const filterState = ref<MapFilterState>({
    wantToSee: false,
    userLists: [],
    notSeenByMe: false,
  });

  const availableUserLists = ref<ListApiResponse[]>([]);
  const isLoadingLists = ref(false);
  const systemLists = ref<Map<string, string>>(new Map()); // listName -> listId mapping

  // Load filter state from localStorage on initialization
  const loadPersistedState = () => {
    try {
      const saved = localStorage.getItem('mapFilters:state');
      if (saved) {
        const parsedState = JSON.parse(saved);
        filterState.value = { ...filterState.value, ...parsedState };
      }
    } catch (error) {
      console.warn('[MAP FILTERS] Failed to load persisted state:', error);
    }
  };

  // Save filter state to localStorage
  const persistState = () => {
    try {
      localStorage.setItem('mapFilters:state', JSON.stringify(filterState.value));
    } catch (error) {
      console.warn('[MAP FILTERS] Failed to persist state:', error);
    }
  };

  // Watch for state changes to persist automatically
  watch(filterState, persistState, { deep: true });

  // Computed properties
  const hasActiveFilters = computed(() => {
    return (
      filterState.value.wantToSee ||
      filterState.value.userLists.length > 0 ||
      filterState.value.notSeenByMe
    );
  });

  const activeFilterSummary = computed(() => {
    const active: string[] = [];
    
    if (filterState.value.wantToSee) {
      active.push('Want to See');
    }
    
    if (filterState.value.userLists.length > 0) {
      // Show count for user lists
      const count = filterState.value.userLists.length;
      active.push(`${count} Custom List${count > 1 ? 's' : ''}`);
    }
    
    if (filterState.value.notSeenByMe) {
      active.push('Not Seen by Me');
    }

    return active;
  });

  const activeFilterDescription = computed(() => {
    const summary = activeFilterSummary.value;
    if (summary.length === 0) return '';
    return `Filters active: ${summary.join(', ')}`;
  });

  // Load available user lists from API
  const loadUserLists = async () => {
    try {
      isLoadingLists.value = true;
      
      // Get user's custom lists
      const userListsResponse = await apiService.getUserLists();
      const allLists = userListsResponse.data || [];
      
      // Separate system lists from user-created lists
      availableUserLists.value = allLists.filter(list => !list.is_system_list);
      
      // Store system lists mapping for future use
      systemLists.value.clear();
      allLists.filter(list => list.is_system_list).forEach(list => {
        systemLists.value.set(list.name, list.id);
      });
      
      console.log('[MAP FILTERS] Loaded user lists:', {
        userListsCount: availableUserLists.value.length,
        systemListsCount: systemLists.value.size,
        systemListNames: Array.from(systemLists.value.keys()),
      });
      
    } catch (error) {
      console.error('[MAP FILTERS] Failed to load user lists:', error);
      availableUserLists.value = [];
    } finally {
      isLoadingLists.value = false;
    }
  };

  // Toggle Want to See filter
  const toggleWantToSee = () => {
    filterState.value.wantToSee = !filterState.value.wantToSee;
  };

  // Toggle user list filter
  const toggleUserList = (listId: string) => {
    const index = filterState.value.userLists.indexOf(listId);
    if (index === -1) {
      filterState.value.userLists.push(listId);
    } else {
      filterState.value.userLists.splice(index, 1);
    }
  };

  // Toggle "Not Seen by Me" filter
  const toggleNotSeenByMe = () => {
    filterState.value.notSeenByMe = !filterState.value.notSeenByMe;
  };

  // Check if a specific filter is enabled
  const isFilterEnabled = (type: 'wantToSee' | 'notSeenByMe' | 'userList', listId?: string): boolean => {
    switch (type) {
      case 'wantToSee':
        return filterState.value.wantToSee;
      case 'notSeenByMe':
        return filterState.value.notSeenByMe;
      case 'userList':
        return listId ? filterState.value.userLists.includes(listId) : false;
      default:
        return false;
    }
  };

  // Reset all filters to default state
  const resetFilters = () => {
    filterState.value = {
      wantToSee: false,
      userLists: [],
      notSeenByMe: false,
    };
  };

  // Apply filters to an artwork array
  const applyFilters = async (artworks: ArtworkPin[]): Promise<ArtworkPin[]> => {
    if (!hasActiveFilters.value) {
      return artworks;
    }

    console.log('[MAP FILTERS] Applying filters to artworks:', {
      inputCount: artworks.length,
      filterState: filterState.value,
    });

    let filteredArtworks = artworks;

    // Phase 1: Apply additive filters (OR logic)
    if (filterState.value.wantToSee || filterState.value.userLists.length > 0) {
      const includeSet = new Set<string>();

      // Add artworks from Want to See list if enabled
      if (filterState.value.wantToSee) {
        try {
          const wantToSeeListId = systemLists.value.get(SPECIAL_LIST_NAMES.WANT_TO_SEE);
          if (wantToSeeListId) {
            const listDetails = await apiService.getListDetails(wantToSeeListId);
            const listArtworks = listDetails.data?.items || [];
            
            // Convert API response artworks to include in filter
            listArtworks.forEach((artwork: any) => {
              includeSet.add(artwork.id);
            });
          } else {
            console.warn('[MAP FILTERS] Want to See system list not found');
          }
        } catch (error) {
          console.error('[MAP FILTERS] Failed to load Want to See list:', error);
        }
      }

      // Add artworks from enabled user lists
      for (const listId of filterState.value.userLists) {
        try {
          const listDetails = await apiService.getListDetails(listId);
          const listArtworks = listDetails.data?.items || [];
          
          // Convert API response artworks to ArtworkPin format
          listArtworks.forEach((artwork: any) => {
            includeSet.add(artwork.id);
          });
        } catch (error) {
          console.error('[MAP FILTERS] Failed to load user list:', listId, error);
        }
      }

      // If we have any items in the include set, filter to only those
      if (includeSet.size > 0) {
        filteredArtworks = filteredArtworks.filter((artwork) => includeSet.has(artwork.id));
      } else if (filterState.value.wantToSee || filterState.value.userLists.length > 0) {
        // If filters are enabled but no items found, show empty results
        filteredArtworks = [];
      }
    }

    // Phase 2: Apply subtractive filter (Not Seen by Me)
    if (filterState.value.notSeenByMe) {
      const excludeSet = new Set<string>();

      try {
        // Load "Been Here" (Have seen) list
        const beenHereListId = systemLists.value.get(SPECIAL_LIST_NAMES.HAVE_SEEN);
        if (beenHereListId) {
          const listDetails = await apiService.getListDetails(beenHereListId);
          const listArtworks = listDetails.data?.items || [];
          
          listArtworks.forEach((artwork: any) => {
            excludeSet.add(artwork.id);
          });
        } else {
          console.warn('[MAP FILTERS] Have seen system list not found');
        }

        // TODO: Add "Logged" list when that system is defined
        // For now, we consider "Have seen" as visited

      } catch (error) {
        console.error('[MAP FILTERS] Failed to load visited lists for exclusion:', error);
      }

      // Remove visited artworks from the result if any were found
      if (excludeSet.size > 0) {
        filteredArtworks = filteredArtworks.filter((artwork) => !excludeSet.has(artwork.id));
      }
    }

    console.log('[MAP FILTERS] Filter results:', {
      originalCount: artworks.length,
      filteredCount: filteredArtworks.length,
      removedCount: artworks.length - filteredArtworks.length,
    });

    return filteredArtworks;
  };

  // Initialize the composable
  loadPersistedState();

  return {
    // State
    filterState: filterState as Ref<Readonly<MapFilterState>>,
    availableUserLists: availableUserLists as Ref<Readonly<ListApiResponse[]>>,
    isLoadingLists: isLoadingLists as Ref<boolean>,
    
    // Computed
    hasActiveFilters,
    activeFilterSummary,
    activeFilterDescription,
    
    // Methods
    loadUserLists,
    toggleWantToSee,
    toggleUserList,
    toggleNotSeenByMe,
    isFilterEnabled,
    resetFilters,
    applyFilters,
  };
}