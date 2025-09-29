/**
 * Composable for managing map filtering functionality
 * Implements requirements from tasks/prd-map-filtering.md
 * Enhanced with advanced features and performance optimizations
 */

import { ref, computed, watch, type Ref } from 'vue';
import type { ArtworkPin, ListApiResponse } from '../types';
import { apiService } from '../services/api';
import { SPECIAL_LIST_NAMES } from '../../../shared/types';

// Advanced Feature: Filter usage analytics
interface FilterAnalytics {
  filterUsageCount: Map<string, number>;
  lastUsedFilters: string[];
  filterCombinations: Map<string, number>;
  sessionStartTime: number;
  totalFilterApplications: number;
}

// Advanced Feature: Filter presets for quick access
interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: MapFilterState;
  createdAt: number;
  lastUsed: number;
  usageCount: number;
}

// Advanced Feature: Export/Import functionality
interface FilterExport {
  version: string;
  exportDate: number;
  presets: FilterPreset[];
  analytics: Omit<FilterAnalytics, 'filterUsageCount' | 'filterCombinations'> & {
    filterUsageCount: [string, number][];
    filterCombinations: [string, number][];
  };
}

// Performance cache for API results
interface ListCache {
  data: any[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

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

// Global instance for singleton pattern
let mapFiltersInstance: any = null;

/**
 * Composable for managing map filtering state and operations
 * Provides filtering logic for the main map view
 * Uses singleton pattern to ensure shared state across components
 */
export function useMapFilters() {
  // Return existing instance if already created
  if (mapFiltersInstance) {
    return mapFiltersInstance;
  }
  
  // Create new instance only on first call
  // Internal state
  const filterState = ref<MapFilterState>({
    wantToSee: false,
    userLists: [],
    notSeenByMe: false,
  });

  const availableUserLists = ref<ListApiResponse[]>([]);
  const isLoadingLists = ref(false);
  const systemLists = ref<Map<string, string>>(new Map()); // listName -> listId mapping
  
  // Advanced Features: Performance and analytics
  const listCache = ref<Map<string, ListCache>>(new Map());
  const analytics = ref<FilterAnalytics>({
    filterUsageCount: new Map(),
    lastUsedFilters: [],
    filterCombinations: new Map(),
    sessionStartTime: Date.now(),
    totalFilterApplications: 0,
  });
  
  // Advanced Feature: Filter presets
  const filterPresets = ref<FilterPreset[]>([]);
  
  // Cache TTL: 5 minutes
  const CACHE_TTL = 5 * 60 * 1000;

  // Advanced Feature: Helper function to get filter label
  function getFilterLabel(filterId: string): string {
    if (filterId === 'wantToSee') return 'Want to See';
    if (filterId === 'notSeenByMe') return 'Not Seen by Me';
    if (filterId.startsWith('list:')) {
      const listId = filterId.replace('list:', '');
      const list = availableUserLists.value.find(l => l.id === listId);
      return list?.name || 'Unknown List';
    }
    return filterId;
  }

  // Advanced Feature: Recently used filters for quick access
  const recentlyUsedFilters = computed(() => {
    return Array.from(analytics.value.filterUsageCount.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([filterId, count]) => ({
        filterId,
        count,
        label: getFilterLabel(filterId),
      }));
  });

  // Computed properties
  const hasActiveFilters = computed(() => {
    return filterState.value.wantToSee || 
           filterState.value.userLists.length > 0 || 
           filterState.value.notSeenByMe;
  });

  const activeFilterCount = computed(() => {
    let count = 0;
    if (filterState.value.wantToSee) count++;
    if (filterState.value.notSeenByMe) count++;
    count += filterState.value.userLists.length;
    return count;
  });

  const activeFilterSummary = computed(() => {
    const filters: string[] = [];
    if (filterState.value.wantToSee) filters.push('Want to See');
    if (filterState.value.notSeenByMe) filters.push('Not Seen by Me');
    filterState.value.userLists.forEach(listId => {
      const list = availableUserLists.value.find(l => l.id === listId);
      if (list) filters.push(list.name);
    });
    return filters;
  });

  const activeFilterDescription = computed(() => {
    const summary = activeFilterSummary.value;
    if (summary.length === 0) return 'No filters active';
    if (summary.length === 1) return `Filter active: ${summary[0]}`;
    if (summary.length === 2) return `Filters active: ${summary.join(' and ')}`;
    return `Filters active: ${summary.slice(0, -1).join(', ')} and ${summary[summary.length - 1]}`;
  });

  // Advanced Feature: Filter recommendations based on usage
  const getFilterRecommendations = computed(() => {
    const recommendations = [];
    
    // Recommend frequently used filters that aren't currently active
    const topFilters = Array.from(analytics.value.filterUsageCount.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    for (const [filterId, usage] of topFilters) {
      if (!isCurrentlyActive(filterId)) {
        recommendations.push({
          filterId,
          reason: `Used ${usage} times recently`,
          type: 'frequent' as const,
        });
      }
    }
    
    return recommendations;
  });

  // Advanced Feature: Get filter performance metrics
  const getFilterMetrics = computed(() => {
    const sessionDuration = Date.now() - analytics.value.sessionStartTime;
    const avgFilterApplications = sessionDuration > 0 
      ? analytics.value.totalFilterApplications / (sessionDuration / (60 * 1000)) // per minute
      : 0;
    
    return {
      sessionDuration: Math.floor(sessionDuration / 1000), // in seconds
      totalFilterApplications: analytics.value.totalFilterApplications,
      averageApplicationsPerMinute: avgFilterApplications,
      totalUniqueFiltersUsed: analytics.value.filterUsageCount.size,
      mostUsedFilter: Array.from(analytics.value.filterUsageCount.entries())
        .sort(([,a], [,b]) => b - a)?.[0]?.[0] || 'none',
      cacheHitRate: calculateCacheHitRate(),
    };
  });

  // Helper function to check if filter is currently active
  function isCurrentlyActive(filterId: string): boolean {
    if (filterId === 'wantToSee') return filterState.value.wantToSee;
    if (filterId === 'notSeenByMe') return filterState.value.notSeenByMe;
    if (filterId.startsWith('list:')) {
      const listId = filterId.replace('list:', '');
      return filterState.value.userLists.includes(listId);
    }
    return false;
  }

  // Helper function to calculate cache hit rate
  function calculateCacheHitRate(): number {
    // This would need to be tracked during cache operations
    // For now, return a placeholder
    return 0.7; // 70% placeholder
  }

  // Methods
  async function loadUserLists() {
    if (isLoadingLists.value) return;
    
    isLoadingLists.value = true;
    try {
      const response = await apiService.getUserLists();
      // Handle both API response format and direct array format
      const lists = Array.isArray(response) ? response : response.data || [];
      availableUserLists.value = lists;
      
      // Build system lists mapping
      systemLists.value.clear();
      lists.forEach(list => {
        // Check both is_system flag AND known system list names as fallback
        const isSystemList = list.is_system || Object.values(SPECIAL_LIST_NAMES).includes(list.name);
        if (isSystemList && list.name) {
          systemLists.value.set(list.name, list.id);
        }
      });
      
      console.log('[MAP FILTERS] Loaded user lists:', {
        total: lists.length,
        systemLists: Array.from(systemLists.value.entries()),
        allLists: lists.map(l => ({ name: l.name, is_system: l.is_system, id: l.id })),
      });
    } catch (error) {
      console.error('[MAP FILTERS] Failed to load user lists:', error);
      availableUserLists.value = [];
    } finally {
      isLoadingLists.value = false;
    }
  }

  // Force refresh trigger for immediate updates
  const refreshTrigger = ref(0);
  
  function forceRefresh() {
    refreshTrigger.value++;
    console.log('[MAP FILTERS] Force refresh triggered:', refreshTrigger.value);
  }

  function toggleWantToSee() {
    filterState.value.wantToSee = !filterState.value.wantToSee;
    console.log('[MAP FILTERS] Toggled Want to See:', filterState.value.wantToSee);
    trackFilterUsage('wantToSee');
    saveStateToStorage();
    forceRefresh();
  }

  function toggleUserList(listId: string) {
    const index = filterState.value.userLists.indexOf(listId);
    if (index === -1) {
      filterState.value.userLists.push(listId);
    } else {
      filterState.value.userLists.splice(index, 1);
    }
    console.log('[MAP FILTERS] Toggled User List:', listId, 'Active lists:', filterState.value.userLists);
    trackFilterUsage(`list:${listId}`);
    saveStateToStorage();
    forceRefresh();
  }

  function toggleNotSeenByMe() {
    filterState.value.notSeenByMe = !filterState.value.notSeenByMe;
    console.log('[MAP FILTERS] Toggled Not Seen by Me:', filterState.value.notSeenByMe);
    trackFilterUsage('notSeenByMe');
    saveStateToStorage();
    forceRefresh();
  }

  function isFilterEnabled(filterId: string): boolean {
    if (filterId === 'wantToSee') return filterState.value.wantToSee;
    if (filterId === 'notSeenByMe') return filterState.value.notSeenByMe;
    if (filterId.startsWith('list:')) {
      const listId = filterId.replace('list:', '');
      return filterState.value.userLists.includes(listId);
    }
    return false;
  }

  function resetFilters() {
    filterState.value = {
      wantToSee: false,
      userLists: [],
      notSeenByMe: false,
    };
    saveStateToStorage();
  }

  // Advanced Feature: Smart caching for list details
  async function getCachedListDetails(listId: string): Promise<any[]> {
    const cacheKey = `list-${listId}`;
    const cached = listCache.value.get(cacheKey);
    
    // Check if cache is still valid
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log('[MAP FILTERS] Using cached list data for:', listId);
      return cached.data;
    }
    
    // Fetch fresh data
    try {
      const listDetails = await apiService.getListDetails(listId);
      const items = listDetails.data?.items || [];
      
      // Cache the result
      listCache.value.set(cacheKey, {
        data: items,
        timestamp: Date.now(),
        ttl: CACHE_TTL,
      });
      
      return items;
    } catch (error) {
      console.error('[MAP FILTERS] Failed to fetch list details:', listId, error);
      return [];
    }
  }

  // Advanced Feature: Track filter usage for analytics
  function trackFilterUsage(filterId: string) {
    const currentCount = analytics.value.filterUsageCount.get(filterId) || 0;
    analytics.value.filterUsageCount.set(filterId, currentCount + 1);
    
    // Update recently used filters
    const recentIndex = analytics.value.lastUsedFilters.indexOf(filterId);
    if (recentIndex !== -1) {
      analytics.value.lastUsedFilters.splice(recentIndex, 1);
    }
    analytics.value.lastUsedFilters.unshift(filterId);
    
    // Keep only last 10 recently used filters
    if (analytics.value.lastUsedFilters.length > 10) {
      analytics.value.lastUsedFilters = analytics.value.lastUsedFilters.slice(0, 10);
    }
    
    analytics.value.totalFilterApplications++;
    saveAnalyticsToStorage();
  }

  // Advanced Feature: Create filter preset
  function createPreset(name: string, description: string = ''): FilterPreset {
    const preset: FilterPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      filters: { ...filterState.value },
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 1,
    };
    
    filterPresets.value.push(preset);
    savePresetsToStorage();
    
    return preset;
  }

  // Advanced Feature: Apply filter preset
  function applyPreset(presetId: string) {
    const preset = filterPresets.value.find(p => p.id === presetId);
    if (!preset) return;
    
    // Update usage tracking
    preset.lastUsed = Date.now();
    preset.usageCount++;
    
    // Apply the preset filters
    filterState.value = { ...preset.filters };
    
    // Track analytics
    trackFilterUsage(`preset:${presetId}`);
    
    savePresetsToStorage();
  }

  // Advanced Feature: Delete filter preset
  function deletePreset(presetId: string) {
    const index = filterPresets.value.findIndex(p => p.id === presetId);
    if (index !== -1) {
      filterPresets.value.splice(index, 1);
      savePresetsToStorage();
    }
  }

  // Advanced Feature: Export filter configuration
  function exportFilters(): string {
    const exportData: FilterExport = {
      version: '1.0.0',
      exportDate: Date.now(),
      presets: filterPresets.value,
      analytics: {
        ...analytics.value,
        filterUsageCount: Array.from(analytics.value.filterUsageCount.entries()),
        filterCombinations: Array.from(analytics.value.filterCombinations.entries()),
      },
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  // Advanced Feature: Import filter configuration
  function importFilters(jsonData: string): boolean {
    try {
      const importData: FilterExport = JSON.parse(jsonData);
      
      // Validate import data
      if (!importData.version || !importData.presets) {
        throw new Error('Invalid import format');
      }
      
      // Import presets
      filterPresets.value = importData.presets;
      
      // Import analytics if available
      if (importData.analytics) {
        analytics.value = {
          ...importData.analytics,
          filterUsageCount: new Map(importData.analytics.filterUsageCount),
          filterCombinations: new Map(importData.analytics.filterCombinations),
        };
      }
      
      savePresetsToStorage();
      saveAnalyticsToStorage();
      
      return true;
    } catch (error) {
      console.error('[MAP FILTERS] Failed to import filters:', error);
      return false;
    }
  }

  // Main filter application function
  async function applyFilters(artworks: ArtworkPin[]): Promise<ArtworkPin[]> {
    console.log('[MAP FILTERS] Applying filters to:', artworks.length, 'artworks');
    console.log('[MAP FILTERS] Active filters:', {
      wantToSee: filterState.value.wantToSee,
      userLists: filterState.value.userLists,
      notSeenByMe: filterState.value.notSeenByMe,
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
            const listArtworks = await getCachedListDetails(wantToSeeListId);
            
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
          const listArtworks = await getCachedListDetails(listId);
          
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

      // Get items from "Been Here" / "Logged" system lists
      const beenHereListId = systemLists.value.get(SPECIAL_LIST_NAMES.HAVE_SEEN);
      if (beenHereListId) {
        try {
          const beenHereArtworks = await getCachedListDetails(beenHereListId);
          beenHereArtworks.forEach((artwork: any) => {
            excludeSet.add(artwork.id);
          });
        } catch (error) {
          console.error('[MAP FILTERS] Failed to load Been Here list:', error);
        }
      }

      // Apply exclusion
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
  }

  // State persistence
  function saveStateToStorage() {
    try {
      localStorage.setItem('mapFilters:state', JSON.stringify(filterState.value));
    } catch (error) {
      console.error('[MAP FILTERS] Failed to save state:', error);
    }
  }

  function loadPersistedState() {
    try {
      const saved = localStorage.getItem('mapFilters:state');
      if (saved) {
        const parsedState = JSON.parse(saved);
        filterState.value = { ...filterState.value, ...parsedState };
      }
    } catch (error) {
      console.error('[MAP FILTERS] Failed to load persisted state:', error);
    }
  }

  // Advanced Feature: Save presets to localStorage
  function savePresetsToStorage() {
    try {
      localStorage.setItem('mapFilters:presets', JSON.stringify(filterPresets.value));
    } catch (error) {
      console.error('[MAP FILTERS] Failed to save presets:', error);
    }
  }

  // Advanced Feature: Save analytics to localStorage
  function saveAnalyticsToStorage() {
    try {
      const analyticsData = {
        ...analytics.value,
        filterUsageCount: Array.from(analytics.value.filterUsageCount.entries()),
        filterCombinations: Array.from(analytics.value.filterCombinations.entries()),
      };
      localStorage.setItem('mapFilters:analytics', JSON.stringify(analyticsData));
    } catch (error) {
      console.error('[MAP FILTERS] Failed to save analytics:', error);
    }
  }

  // Load presets and analytics from localStorage on initialization
  function loadAdvancedFeatures() {
    try {
      // Load presets
      const presetsData = localStorage.getItem('mapFilters:presets');
      if (presetsData) {
        filterPresets.value = JSON.parse(presetsData);
      }

      // Load analytics
      const analyticsData = localStorage.getItem('mapFilters:analytics');
      if (analyticsData) {
        const parsed = JSON.parse(analyticsData);
        analytics.value = {
          ...parsed,
          filterUsageCount: new Map(parsed.filterUsageCount || []),
          filterCombinations: new Map(parsed.filterCombinations || []),
          sessionStartTime: Date.now(), // Reset session start time
        };
      }
    } catch (error) {
      console.error('[MAP FILTERS] Failed to load advanced features:', error);
    }
  }

  // Initialize the composable
  loadPersistedState();
  loadAdvancedFeatures();

  // Watch for filter state changes to persist automatically
  watch(filterState, saveStateToStorage, { deep: true });

  // Create the instance object
  const instance = {
    // State
    filterState: filterState as Ref<Readonly<MapFilterState>>,
    availableUserLists: availableUserLists as Ref<Readonly<ListApiResponse[]>>,
    isLoadingLists: isLoadingLists as Ref<boolean>,
    refreshTrigger,
    
    // Computed
    hasActiveFilters,
    activeFilterCount,
    activeFilterSummary,
    activeFilterDescription,
    getFilterRecommendations,
    recentlyUsedFilters,
    filterPresets,
    getFilterMetrics,
    
    // Methods
    loadUserLists,
    toggleWantToSee,
    toggleUserList,
    toggleNotSeenByMe,
    isFilterEnabled,
    resetFilters,
    applyFilters,
    forceRefresh,
    
    // Advanced Features Methods
    getCachedListDetails,
    trackFilterUsage,
    createPreset,
    applyPreset,
    deletePreset,
    exportFilters,
    importFilters,
    analytics: analytics as Ref<Readonly<FilterAnalytics>>,
  };
  
  // Store as singleton instance
  mapFiltersInstance = instance;
  return instance;
}