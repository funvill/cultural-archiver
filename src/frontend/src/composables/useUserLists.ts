/**
 * Composable for managing user lists and artwork membership
 * Provides reactive access to user's Visited, Starred, and Loved lists
 */

import { ref, computed, type Ref } from 'vue';
import { apiService as api } from '../services/api';
import type { ListApiResponse, ArtworkApiResponse } from '../../../shared/types';

export interface UserListsState {
  visited: Set<string>;
  starred: Set<string>;
  loved: Set<string>;
  submissions: Set<string>;
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
  submissionsArtworks: Ref<Set<string>>;
  
  // Methods
  fetchUserLists: () => Promise<void>;
  isArtworkInList: (artworkId: string, listType: 'visited' | 'starred' | 'loved' | 'submissions') => boolean;
  addToList: (artworkId: string, listType: 'visited' | 'starred' | 'loved' | 'submissions') => Promise<boolean>;
  removeFromList: (artworkId: string, listType: 'visited' | 'starred' | 'loved' | 'submissions') => Promise<boolean>;
  refreshLists: () => Promise<void>;
}

// Global cache to avoid fetching multiple times
const globalUserListsCache = ref<ListApiResponse[]>([]);
const globalCacheTimestamp = ref<number>(0);
const globalIsLoading = ref(false);
const globalError = ref<string | null>(null);
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useUserLists(): UserListsApi {
  // Use global refs instead of creating new local ones
  const lists = globalUserListsCache;
  const isLoading = globalIsLoading;
  const error = globalError;

  // Computed sets for fast O(1) artwork membership lookup
  const visitedArtworks = computed(() => {
    const visitedList = globalUserListsCache.value.find(list => 
      list.is_system_list && list.name === 'Visited'
    );
    
    if (!visitedList?.items) return new Set<string>();
    
    return new Set(visitedList.items.map(artwork => artwork.id));
  });

  const starredArtworks = computed(() => {
    const starredList = globalUserListsCache.value.find(list => 
      list.is_system_list && list.name === 'Starred'
    );
    
    if (!starredList?.items) return new Set<string>();
    
    return new Set(starredList.items.map(artwork => artwork.id));
  });

  const lovedArtworks = computed(() => {
    const lovedList = globalUserListsCache.value.find(list => 
      list.is_system_list && list.name === 'Loved'
    );
    
    if (!lovedList?.items) return new Set<string>();
    
    return new Set(lovedList.items.map(artwork => artwork.id));
  });

  const submissionsArtworks = computed(() => {
    const submissionsList = globalUserListsCache.value.find(list =>
      list.is_system_list && list.name === 'Submissions'
    );

    if (!submissionsList?.items) return new Set<string>();

    return new Set(submissionsList.items.map(artwork => artwork.id));
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
      return;
    }

    // Prevent concurrent requests
    if (globalIsLoading.value) {
      console.log('[useUserLists] Already loading, skipping duplicate request');
      return;
    }

    globalIsLoading.value = true;
    globalError.value = null;

    try {
      const response = await api.getUserLists();
      
      if (response.success) {
        const userLists = response.data || [];
        
        // For each system list, fetch its items to get artwork IDs
        const systemLists = (userLists as ListApiResponse[]).filter((list: ListApiResponse) => list.is_system_list);
        const listsWithItems: ListApiResponse[] = [];
        
        for (const list of systemLists) {
          try {
            const detailsResponse = await api.getListDetails(list.id, 1, 100); // Get up to 100 items (API limit)
            if (detailsResponse.success && detailsResponse.data) {
              listsWithItems.push({
                ...list,
                items: (detailsResponse.data.items || []) as ArtworkApiResponse[],
                item_count: (detailsResponse.data.total || 0) as number
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
        const customLists = (userLists as ListApiResponse[]).filter((list: ListApiResponse) => !list.is_system_list);
        listsWithItems.push(...customLists);
        
        globalUserListsCache.value = listsWithItems;
        
        // Update global cache
        globalCacheTimestamp.value = Date.now();
        
        console.log('[useUserLists] Fetched and cached user lists:', {
          totalLists: listsWithItems.length,
          systemLists: systemLists.length,
          customLists: customLists.length,
          timestamp: new Date().toISOString()
        });
        
      } else {
        globalError.value = 'Failed to fetch user lists';
      }
    } catch (err) {
      globalError.value = err instanceof Error ? err.message : 'Failed to fetch user lists';
      console.error('Error fetching user lists:', err);
    } finally {
      globalIsLoading.value = false;
    }
  };

  // Check if artwork is in a specific list
  const isArtworkInList = (artworkId: string, listType: 'visited' | 'starred' | 'loved' | 'submissions'): boolean => {
    switch (listType) {
      case 'visited':
        return visitedArtworks.value.has(artworkId);
      case 'starred':
        return starredArtworks.value.has(artworkId);
      case 'loved':
        return lovedArtworks.value.has(artworkId);
      case 'submissions':
        return submissionsArtworks.value.has(artworkId);
      default:
        return false;
    }
  };

  // Add artwork to a list
  const addToList = async (artworkId: string, listType: 'visited' | 'starred' | 'loved' | 'submissions'): Promise<boolean> => {
    const listNames = {
      visited: 'Visited',
      starred: 'Starred', 
      loved: 'Loved',
      submissions: 'Submissions'
    } as const;
    
    const targetList = globalUserListsCache.value.find(list => 
      list.is_system_list && list.name === (listNames as Record<string,string>)[listType]
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
  const removeFromList = async (artworkId: string, listType: 'visited' | 'starred' | 'loved' | 'submissions'): Promise<boolean> => {
    const listNames = {
      visited: 'Visited',
      starred: 'Starred',
      loved: 'Loved',
      submissions: 'Submissions'
    } as const;
    
    const targetList = globalUserListsCache.value.find(list => 
      list.is_system_list && list.name === (listNames as Record<string,string>)[listType]
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
        
        // Update global cache timestamp to indicate fresh data
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

  // Initialize lists on first access - only if cache is empty and not already loading
  if (globalUserListsCache.value.length === 0 && !globalIsLoading.value && globalCacheTimestamp.value === 0) {
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
    submissionsArtworks,
    
    // Methods
    fetchUserLists,
    isArtworkInList,
    addToList,
    removeFromList,
    refreshLists
  };
}