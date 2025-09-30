/**
 * Composable for managing user lists and artwork membership
 * Provides reactive access to user's Visited, Starred, and Loved lists
 */

import { ref, computed, type Ref } from 'vue';
import { apiService as api } from '../services/api';
import type { ListApiResponse } from '../../../shared/types';

export interface UserListsState {
  visited: Set<string>;
  starred: Set<string>;
  loved: Set<string>;
}

export interface UserListsApi {
  // State
  lists: Ref<ListApiResponse[]>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  
  // Computed sets for fast lookup
  visitedArtworks: Ref<Set<string>>;
  starredArtworks: Ref<Set<string>>;
  lovedArtworks: Ref<Set<string>>;
  
  // Methods
  fetchUserLists: () => Promise<void>;
  isArtworkInList: (artworkId: string, listType: 'visited' | 'starred' | 'loved') => boolean;
  addToList: (artworkId: string, listType: 'visited' | 'starred' | 'loved') => Promise<boolean>;
  removeFromList: (artworkId: string, listType: 'visited' | 'starred' | 'loved') => Promise<boolean>;
  refreshLists: () => Promise<void>;
}

// Global cache to avoid fetching multiple times
const globalUserListsCache = ref<ListApiResponse[]>([]);
const globalCacheTimestamp = ref<number>(0);
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useUserLists(): UserListsApi {
  const lists = ref<ListApiResponse[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed sets for fast O(1) artwork membership lookup
  const visitedArtworks = computed(() => {
    const visitedList = lists.value.find(list => 
      list.is_system_list && list.name === 'Visited'
    );
    
    if (!visitedList?.items) return new Set<string>();
    
    return new Set(visitedList.items.map(artwork => artwork.id));
  });

  const starredArtworks = computed(() => {
    const starredList = lists.value.find(list => 
      list.is_system_list && list.name === 'Starred'
    );
    
    if (!starredList?.items) return new Set<string>();
    
    return new Set(starredList.items.map(artwork => artwork.id));
  });

  const lovedArtworks = computed(() => {
    const lovedList = lists.value.find(list => 
      list.is_system_list && list.name === 'Loved'
    );
    
    if (!lovedList?.items) return new Set<string>();
    
    return new Set(lovedList.items.map(artwork => artwork.id));
  });

  // Check if data is cached and still fresh
  const isCacheFresh = (): boolean => {
    return globalUserListsCache.value.length > 0 && 
           (Date.now() - globalCacheTimestamp.value) < CACHE_DURATION;
  };

  // Fetch user lists from API
  const fetchUserLists = async (): Promise<void> => {
    // Use cache if available and fresh
    if (isCacheFresh()) {
      lists.value = globalUserListsCache.value;
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await api.getUserLists();
      
      if (response.success) {
        const userLists = response.data || [];
        
        // For each system list, fetch its items to get artwork IDs
        const systemLists = userLists.filter((list: ListApiResponse) => list.is_system_list);
        const listsWithItems: ListApiResponse[] = [];
        
        for (const list of systemLists) {
          try {
            const detailsResponse = await api.getListDetails(list.id, 1, 100); // Get up to 100 items (API limit)
            if (detailsResponse.success) {
              listsWithItems.push({
                ...list,
                items: detailsResponse.data.items || [],
                item_count: detailsResponse.data.total || 0
              });
            } else {
              // If we can't get list details, include the list without items
              listsWithItems.push(list);
            }
          } catch (err) {
            console.warn(`Failed to fetch details for list ${list.name}:`, err);
            listsWithItems.push(list);
          }
        }
        
        // Also include non-system lists (user-created lists)
        const customLists = userLists.filter((list: ListApiResponse) => !list.is_system_list);
        listsWithItems.push(...customLists);
        
        lists.value = listsWithItems;
        
        // Update global cache
        globalUserListsCache.value = listsWithItems;
        globalCacheTimestamp.value = Date.now();
        
      } else {
        error.value = 'Failed to fetch user lists';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch user lists';
      console.error('Error fetching user lists:', err);
    } finally {
      isLoading.value = false;
    }
  };

  // Check if artwork is in a specific list
  const isArtworkInList = (artworkId: string, listType: 'visited' | 'starred' | 'loved'): boolean => {
    switch (listType) {
      case 'visited':
        return visitedArtworks.value.has(artworkId);
      case 'starred':
        return starredArtworks.value.has(artworkId);
      case 'loved':
        return lovedArtworks.value.has(artworkId);
      default:
        return false;
    }
  };

  // Add artwork to a list
  const addToList = async (artworkId: string, listType: 'visited' | 'starred' | 'loved'): Promise<boolean> => {
    const listNames = {
      visited: 'Visited',
      starred: 'Starred', 
      loved: 'Loved'
    };
    
    const targetList = lists.value.find(list => 
      list.is_system_list && list.name === listNames[listType]
    );
    
    if (!targetList) {
      console.error(`${listNames[listType]} list not found`);
      return false;
    }

    try {
      const response = await api.addArtworkToList(targetList.id, artworkId);
      
      if (response.success) {
        // Update local cache - add to the list
        if (targetList.items) {
          // Avoid duplicates
          if (!targetList.items.some(item => item.id === artworkId)) {
            // We don't have the full artwork data, so we'll refresh the list
            await refreshLists();
          }
        } else {
          await refreshLists();
        }
        return true;
      } else {
        console.error(`Failed to add artwork to ${listNames[listType]} list:`, response.error);
        return false;
      }
    } catch (err) {
      console.error(`Error adding artwork to ${listNames[listType]} list:`, err);
      return false;
    }
  };

  // Remove artwork from a list
  const removeFromList = async (artworkId: string, listType: 'visited' | 'starred' | 'loved'): Promise<boolean> => {
    const listNames = {
      visited: 'Visited',
      starred: 'Starred',
      loved: 'Loved'
    };
    
    const targetList = lists.value.find(list => 
      list.is_system_list && list.name === listNames[listType]
    );
    
    if (!targetList) {
      console.error(`${listNames[listType]} list not found`);
      return false;
    }

    try {
      const response = await api.removeArtworksFromList(targetList.id, [artworkId]);
      
      if (response.success) {
        // Update local cache - remove from the list
        if (targetList.items) {
          targetList.items = targetList.items.filter(item => item.id !== artworkId);
          if (targetList.item_count !== undefined) {
            targetList.item_count = Math.max(0, targetList.item_count - 1);
          }
        }
        
        // Update global cache
        globalUserListsCache.value = lists.value;
        globalCacheTimestamp.value = Date.now();
        
        return true;
      } else {
        console.error(`Failed to remove artwork from ${listNames[listType]} list:`, response.error);
        return false;
      }
    } catch (err) {
      console.error(`Error removing artwork from ${listNames[listType]} list:`, err);
      return false;
    }
  };

  // Refresh lists (invalidate cache and refetch)
  const refreshLists = async (): Promise<void> => {
    globalCacheTimestamp.value = 0; // Invalidate cache
    await fetchUserLists();
  };

  // Initialize lists on first access
  if (lists.value.length === 0 && !isLoading.value) {
    fetchUserLists();
  }

  return {
    // State
    lists,
    isLoading,
    error,
    
    // Computed sets
    visitedArtworks,
    starredArtworks,
    lovedArtworks,
    
    // Methods
    fetchUserLists,
    isArtworkInList,
    addToList,
    removeFromList,
    refreshLists
  };
}