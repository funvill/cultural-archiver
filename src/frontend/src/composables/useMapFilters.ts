import { computed, reactive, watch, ref, type ComputedRef, type Ref } from 'vue';
import { useUserLists } from './useUserLists';
import type { ListApiResponse } from '../../../shared/types';
import type { ArtworkPin } from '../types';

// ArtworkPin is the frontend map marker shape; some filtering code expects extra fields
// present on API artwork objects. Define a wider type for filtering that includes
// optional fields used by older codepaths.
export type ArtworkForFiltering = ArtworkPin & Partial<{
  artwork_type: string;
  photos: unknown[];
  recent_photo: unknown;
  photo_count: number;
  photoCount: number;
  status: string;
  want_to_see: boolean;
}>;

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
  showOnlyMySubmissions: boolean;
  hideVisited: boolean;
  showRemoved: boolean;
  showArtworksWithoutPhotos: boolean;
  // Additional simple flags used by UI
  wantToSee?: boolean;
  notSeenByMe?: boolean;
}

// Small helper types to avoid `any`
export interface FilterPreset {
  id: string;
  name: string;
  note?: string | undefined;
  state?: MapFiltersState;
  // UI-driven quick-filter shape
  filterId?: string;
  label?: string;
  count?: number;
  description?: string;
}

export interface FilterMetrics {
  sessionDuration: number;
  totalFilterApplications: number;
  cacheHitRate: number;
  mostUsedFilter: string | null;
}

// We'll use ArtworkPin (frontend type) for filtering operations

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
  showOnlyMySubmissions: false,
  hideVisited: false,
  showRemoved: false,
  showArtworksWithoutPhotos: false,
});

let isInitialized = false;

export interface UseMapFiltersReturn {
  // State
  filtersState: MapFiltersState;
  // Backwards-compatible alias used by some views
  filterState: ComputedRef<Record<string, unknown>>;
  // Available user lists (from useUserLists)
  availableUserLists: ComputedRef<ListApiResponse[]>;
  
  // Computed
  hasActiveFilters: ComputedRef<boolean>;
  activeFilterCount: ComputedRef<number>;
  activeFilterDescription: ComputedRef<string>;
  
  // Methods
  resetFilters: () => void;
  toggleArtworkType: (typeKey: string) => void;
  setAllArtworkTypes: (enabled: boolean) => void;
  toggleStatusFilter: (status: keyof StatusFilter) => void;
  toggleUserListFilter: (listId: string) => void;
  // Backwards-compatible name
  toggleUserList: (listId: string) => void;
  toggleShowOnlyMySubmissions: () => void;
  toggleHideVisited: () => void;
  toggleShowRemoved: () => void;
  toggleShowArtworksWithoutPhotos: () => void;
  syncUserLists: () => Promise<void>;
  shouldShowArtwork: (artwork: any) => boolean; // eslint-disable-line @typescript-eslint/no-explicit-any
  saveFiltersToStorage: () => void;
  loadFiltersFromStorage: () => void;
  // New UI helpers and actions
  isFilterEnabled: (filterKey: string) => boolean;
  toggleWantToSee: () => void;
  toggleNotSeenByMe: () => void;
  createPreset: (name: string, note?: string) => void;
  applyPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  exportFilters: () => string;
  importFilters: (content: string) => boolean;
  loadUserLists: () => Promise<void>;
  recentlyUsedFilters: Ref<FilterPreset[]>;
  filterPresets: Ref<FilterPreset[]>;
  getFilterMetrics: Ref<FilterMetrics>;
  refreshTrigger: { value: number };
  applyFilters: (artworks: ArtworkPin[]) => Promise<ArtworkPin[]>;
}

export function useMapFilters(): UseMapFiltersReturn {
  const userLists = useUserLists();
  // Local reactive support for presets/metrics
  const filterPresetsRef: Ref<FilterPreset[]> = ref([]);
  const recentlyUsedFiltersRef: Ref<FilterPreset[]> = ref([]);
  const filterMetrics: Ref<FilterMetrics> = ref({
    sessionDuration: 0,
    totalFilterApplications: 0,
    cacheHitRate: 0,
    mostUsedFilter: null,
  });

  // A simple numeric trigger we can increment to force reactivity where needed
  const refreshTriggerRef = { value: 0 };

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
    const showArtworksWithoutPhotosActive = globalFiltersState.showArtworksWithoutPhotos;

    return someTypesDisabled || nonDefaultStatus || userListFiltersActive || showingOnlyMySubmissions || hideVisitedActive || showRemovedActive || showArtworksWithoutPhotosActive;
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
    if (globalFiltersState.showArtworksWithoutPhotos) count++;
    
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
    
    // Simple flags: include descriptions so the UI banner isn't empty
    if (globalFiltersState.hideVisited) {
      parts.push('hiding visited artworks');
    }
    if (globalFiltersState.showRemoved) {
      parts.push('including removed artworks');
    }
    if (globalFiltersState.showArtworksWithoutPhotos) {
      parts.push('including artworks without photos');
    }

    if (!globalFiltersState.statusFilters.approved || 
        globalFiltersState.statusFilters.pending || 
        globalFiltersState.statusFilters.rejected) {
      parts.push('custom status filters');
    }
    
    // If we somehow detected active filters but couldn't make a readable
    // description from parts, fall back to a generic count-based message.
    if (parts.length === 0) {
      const c = activeFilterCount?.value ?? 0;
      return `${c} filter${c === 1 ? '' : 's'} active`;
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
        
  // legacy clusterEnabled removed
        
        if (typeof parsed.showOnlyMySubmissions === 'boolean') {
          globalFiltersState.showOnlyMySubmissions = parsed.showOnlyMySubmissions;
        }
        
        if (typeof parsed.hideVisited === 'boolean') {
          globalFiltersState.hideVisited = parsed.hideVisited;
        }
        
        if (typeof parsed.showRemoved === 'boolean') {
          globalFiltersState.showRemoved = parsed.showRemoved;
        }

        if (typeof parsed.showArtworksWithoutPhotos === 'boolean') {
          globalFiltersState.showArtworksWithoutPhotos = parsed.showArtworksWithoutPhotos;
        }
      }
    } catch (error) {
      console.warn('Failed to load map filters from storage:', error);
    }
  }

  function saveFiltersToStorage(): void {
    try {
      localStorage.setItem('mapFilters:state', JSON.stringify(globalFiltersState));
  // Bump refresh trigger so callers depending on mapFilters.refreshTrigger get notified
  refreshTriggerRef.value += 1;
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
    globalFiltersState.showArtworksWithoutPhotos = false;
    
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

  function toggleShowArtworksWithoutPhotos(): void {
    globalFiltersState.showArtworksWithoutPhotos = !globalFiltersState.showArtworksWithoutPhotos;
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

  // Backwards-compatible alias - components call loadUserLists
  async function loadUserLists(): Promise<void> {
    await syncUserLists();
  }

  // Check whether a named/simple filter is enabled (used by template bindings)
  function isFilterEnabled(filterKey: string): boolean {
    if (filterKey === 'wantToSee') return !!globalFiltersState.wantToSee;
    if (filterKey === 'notSeenByMe') return !!globalFiltersState.notSeenByMe;
    if (filterKey.startsWith('list:')) {
      const id = filterKey.replace('list:', '');
      const f = globalFiltersState.userListFilters.find(u => u.listId === id);
      return !!f?.enabled;
    }
    return false;
  }

  function toggleWantToSee(): void {
    globalFiltersState.wantToSee = !globalFiltersState.wantToSee;
    // Track recent usage
    refreshTriggerRef.value += 1;
    saveFiltersToStorage();
  }

  function toggleNotSeenByMe(): void {
    globalFiltersState.notSeenByMe = !globalFiltersState.notSeenByMe;
    refreshTriggerRef.value += 1;
    saveFiltersToStorage();
  }

  // Backwards-compatible name used in some places
  function toggleUserList(listId: string): void {
    toggleUserListFilter(listId);
  }

  // Preset handling (light-weight in-memory implementation)
  function createPreset(name: string, note?: string): void {
    // For now, store minimal preset data in localStorage
    try {
  const raw = localStorage.getItem('mapFilters:presets');
  const existing: FilterPreset[] = raw ? JSON.parse(raw) as FilterPreset[] : [];
  existing.push({ id: Date.now().toString(), name, note, state: { ...globalFiltersState } });
  localStorage.setItem('mapFilters:presets', JSON.stringify(existing));
      // bump trigger
      refreshTriggerRef.value += 1;
    } catch (e) {
      console.warn('Failed to create preset', e);
    }
  }

  function applyPreset(id: string): void {
    try {
      const raw = localStorage.getItem('mapFilters:presets');
      const existing: FilterPreset[] = raw ? JSON.parse(raw) as FilterPreset[] : [];
      const p = existing.find(x => x.id === id);
      if (p && p.state) {
        Object.assign(globalFiltersState, p.state);
        saveFiltersToStorage();
      }
    } catch (e) {
      console.warn('Failed to apply preset', e);
    }
  }

  function deletePreset(id: string): void {
    try {
      const raw = localStorage.getItem('mapFilters:presets');
      const existing: FilterPreset[] = raw ? JSON.parse(raw) as FilterPreset[] : [];
      const filtered = existing.filter(x => x.id !== id);
      localStorage.setItem('mapFilters:presets', JSON.stringify(filtered));
    } catch (e) {
      console.warn('Failed to delete preset', e);
    }
  }

  function exportFilters(): string {
    try {
      return JSON.stringify(globalFiltersState);
    } catch (e) {
      return '';
    }
  }

  function importFilters(content: string): boolean {
    try {
      const parsed = JSON.parse(content) as Partial<MapFiltersState> | null;
      // Merge carefully
      if (parsed) {
        if (parsed.artworkTypes) {
          // Only copy enabled states
          (parsed.artworkTypes as ArtworkTypeFilter[]).forEach(t => {
            const existing = globalFiltersState.artworkTypes.find(a => a.key === t.key);
            if (existing && typeof t.enabled === 'boolean') existing.enabled = t.enabled;
          });
        }
        if (parsed.statusFilters) Object.assign(globalFiltersState.statusFilters, parsed.statusFilters);
        if (Array.isArray(parsed.userListFilters)) globalFiltersState.userListFilters = parsed.userListFilters;
        if (typeof parsed.wantToSee === 'boolean') globalFiltersState.wantToSee = parsed.wantToSee;
        if (typeof parsed.notSeenByMe === 'boolean') globalFiltersState.notSeenByMe = parsed.notSeenByMe;
        saveFiltersToStorage();
        return true;
      }
    } catch (e) {
      console.warn('Failed to import filters', e);
    }
    return false;
  }

  // Lightweight metrics and applyFilters implementation
  async function applyFilters(artworks: ArtworkPin[]): Promise<ArtworkPin[]> {
    // Update metrics
    filterMetrics.value = { ...filterMetrics.value, totalFilterApplications: (filterMetrics.value.totalFilterApplications || 0) + 1 };

    // Basic filtering using shouldShowArtwork and simple flags
      const result = artworks.filter(a => {
        const af = a as ArtworkForFiltering;
        if (!shouldShowArtwork(af)) return false;
        // Only apply wantToSee filter if the artwork object has that flag
        if (globalFiltersState.wantToSee && af.want_to_see === false) return false;
        if (globalFiltersState.notSeenByMe) {
          // Exclude visited
          const visited = userLists.isArtworkInList(a.id, 'visited');
          if (visited) return false;
        }
        return true;
      });

    return result;
  }

  // Filter checking methods for MapComponent
  function shouldShowArtwork(artwork: ArtworkForFiltering): boolean {
    // Check artwork type filter
    const artworkTypeKey = artwork.artwork_type || artwork.type;
    const typeEnabled = globalFiltersState.artworkTypes.find(type => type.key === artworkTypeKey)?.enabled ?? true; // Show by default if type not found
    
    if (!typeEnabled) return false;
    
    // Check for artworks without photos when the toggle is off
    if (!globalFiltersState.showArtworksWithoutPhotos) {
      const hasPhotos = (Array.isArray(artwork.photos) && artwork.photos.length > 0)
        || Boolean(artwork.recent_photo)
        || (typeof artwork.photo_count === 'number' && artwork.photo_count > 0)
        || (typeof artwork.photoCount === 'number' && artwork.photoCount > 0)
        || (Array.isArray((artwork as ArtworkPin).photos) && (artwork as ArtworkPin).photos.length > 0);
      if (!hasPhotos) return false;
    }
    
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
    filterState: computed(() => ({
      // Provide a lightweight alias used by existing code
      wantToSee: globalFiltersState.wantToSee,
      notSeenByMe: globalFiltersState.notSeenByMe,
      userLists: globalFiltersState.userListFilters,
      // keep other flags for convenience
      ...globalFiltersState,
    })),
    availableUserLists: computed(() => userLists.lists.value),
    
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
  toggleUserList,
    toggleShowOnlyMySubmissions,
    toggleHideVisited,
    toggleShowRemoved,
    toggleShowArtworksWithoutPhotos,
    syncUserLists,
    shouldShowArtwork,
    // Storage
    saveFiltersToStorage,
    loadFiltersFromStorage,
    // New helpers
    isFilterEnabled,
    toggleWantToSee,
    toggleNotSeenByMe,
    createPreset,
    applyPreset,
    deletePreset,
    exportFilters,
    importFilters,
    loadUserLists,
    recentlyUsedFilters: recentlyUsedFiltersRef,
    filterPresets: filterPresetsRef,
    getFilterMetrics: filterMetrics,
    refreshTrigger: refreshTriggerRef,
    applyFilters,
    
    // keep original storage functions present (also returned above)
  };
}