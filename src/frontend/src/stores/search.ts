import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { SearchResult } from '../types';
import { apiService, getErrorMessage, isNetworkError } from '../services/api';

/**
 * Search state management store
 * Handles search queries, results, pagination, and caching
 */
export const useSearchStore = defineStore('search', () => {
  // State
  const query = ref('');
  const results = ref<SearchResult[]>([]);
  const total = ref(0);
  const page = ref(1);
  const perPage = ref(20);
  const totalPages = ref(0);
  const hasMore = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const suggestions = ref<string[]>([]);
  const recentQueries = ref<string[]>([]);

  // Search results cache: query -> { results, total, page }
  const searchCache = ref<
    Map<
      string,
      {
        results: SearchResult[];
        total: number;
        page: number;
        timestamp: number;
      }
    >
  >(new Map());

  // Debounce search queries
  let searchTimeoutId: number | null = null;
  const SEARCH_DEBOUNCE_MS = 300;
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Computed getters
  const hasResults = computed(() => results.value.length > 0);
  const isEmpty = computed(
    () => !isLoading.value && results.value.length === 0 && query.value.length > 0
  );
  const canLoadMore = computed(() => hasMore.value && !isLoading.value);
  const currentQuery = computed(() => query.value.trim());
  const totalResults = computed(() => total.value);
  const hasSearched = computed(() => query.value.trim().length > 0 || results.value.length > 0);

  // Actions
  function setQuery(searchQuery: string): void {
    query.value = searchQuery.trim();
  }

  function setResults(searchResults: SearchResult[]): void {
    results.value = searchResults;
    error.value = null;
  }

  function appendResults(searchResults: SearchResult[]): void {
    results.value.push(...searchResults);
    error.value = null;
  }

  function setPagination(paginationInfo: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
    has_more: boolean;
  }): void {
    total.value = paginationInfo.total;
    page.value = paginationInfo.page;
    perPage.value = paginationInfo.per_page;
    totalPages.value = paginationInfo.total_pages;
    hasMore.value = paginationInfo.has_more;
  }

  function setLoading(loading: boolean): void {
    isLoading.value = loading;
  }

  function setError(errorMessage: string | null): void {
    error.value = errorMessage;
  }

  function clearError(): void {
    error.value = null;
  }

  function setSuggestions(searchSuggestions: string[]): void {
    suggestions.value = searchSuggestions;
  }

  function addToRecentQueries(searchQuery: string): void {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length === 0) return;

    // Remove if already exists
    const existingIndex = recentQueries.value.indexOf(trimmedQuery);
    if (existingIndex >= 0) {
      recentQueries.value.splice(existingIndex, 1);
    }

    // Add to beginning
    recentQueries.value.unshift(trimmedQuery);

    // Keep only last 10 searches
    if (recentQueries.value.length > 10) {
      recentQueries.value = recentQueries.value.slice(0, 10);
    }

    // Persist to localStorage
    try {
      localStorage.setItem('search-recent-queries', JSON.stringify(recentQueries.value));
    } catch (error) {
      console.warn('Failed to save recent queries to localStorage:', error);
    }
  }

  function loadRecentQueries(): void {
    try {
      const stored = localStorage.getItem('search-recent-queries');
      if (stored) {
        recentQueries.value = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load recent queries from localStorage:', error);
      recentQueries.value = [];
    }
  }

  function clearRecentQueries(): void {
    recentQueries.value = [];
    try {
      localStorage.removeItem('search-recent-queries');
    } catch (error) {
      console.warn('Failed to clear recent queries from localStorage:', error);
    }
  }

  // Cache management
  function getCacheKey(searchQuery: string, pageNum: number): string {
    return `${searchQuery}:${pageNum}`;
  }

  function isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_TTL_MS;
  }

  function getCachedResults(
    searchQuery: string,
    pageNum: number
  ): {
    results: SearchResult[];
    total: number;
    page: number;
  } | null {
    const cacheKey = getCacheKey(searchQuery, pageNum);
    const cached = searchCache.value.get(cacheKey);

    if (cached && isCacheValid(cached.timestamp)) {
      return cached;
    }

    // Remove expired entry
    if (cached) {
      searchCache.value.delete(cacheKey);
    }

    return null;
  }

  function cacheResults(
    searchQuery: string,
    pageNum: number,
    data: {
      results: SearchResult[];
      total: number;
      page: number;
    }
  ): void {
    const cacheKey = getCacheKey(searchQuery, pageNum);
    searchCache.value.set(cacheKey, {
      ...data,
      timestamp: Date.now(),
    });

    // Cleanup old cache entries (keep last 50)
    if (searchCache.value.size > 50) {
      const entries = Array.from(searchCache.value.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);

      searchCache.value.clear();
      entries.slice(0, 50).forEach(([key, value]) => {
        searchCache.value.set(key, value);
      });
    }
  }

  // Search functionality
  async function performSearch(
    searchQuery: string,
    pageNum: number = 1,
    append: boolean = false
  ): Promise<void> {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length === 0) {
      setResults([]);
      setPagination({
        total: 0,
        page: 1,
        per_page: perPage.value,
        total_pages: 0,
        has_more: false,
      });
      return;
    }

    // Check cache first
    const cached = getCachedResults(trimmedQuery, pageNum);
    if (cached) {
      if (append) {
        appendResults(cached.results);
      } else {
        setResults(cached.results);
      }
      setPagination({
        total: cached.total,
        page: cached.page,
        per_page: perPage.value,
        total_pages: Math.ceil(cached.total / perPage.value),
        has_more: cached.page * perPage.value < cached.total,
      });
      return;
    }

    setLoading(true);
    clearError();

    try {
      const response = await apiService.searchArtworks(trimmedQuery, pageNum, perPage.value);

      if (response.data) {
        type ArtworkLike = {
          id: string; lat: number; lon: number; type_name?: string; tags?: unknown; recent_photo?: string; photo_count?: number; photos?: unknown; distance_km?: number; similarity_score?: number | null;
        };
        const artworksArray = response.data.artworks as ArtworkLike[];
        const searchResults: SearchResult[] = artworksArray.map(artwork => {
          let parsedTags: Record<string, unknown> | null = null;
          if (artwork.tags) {
            if (typeof artwork.tags === 'string') {
              try { parsedTags = JSON.parse(artwork.tags); } catch { parsedTags = null; }
            } else if (typeof artwork.tags === 'object') {
              parsedTags = artwork.tags as Record<string, unknown>;
            }
          }
          return {
            id: artwork.id,
            lat: artwork.lat,
            lon: artwork.lon,
            type_name: artwork.type_name || 'unknown',
            tags: parsedTags,
            recent_photo: artwork.recent_photo ?? null,
            photo_count: artwork.photo_count ?? (Array.isArray(artwork.photos) ? (artwork.photos as unknown[]).length : 0),
            distance_km: artwork.distance_km ?? null,
            similarity_score: artwork.similarity_score ?? null,
          };
        });

        // Cache the results
        cacheResults(trimmedQuery, pageNum, {
          results: searchResults,
          total: response.data.pagination.total,
          page: response.data.pagination.page,
        });

        if (append) {
          appendResults(searchResults);
        } else {
          setResults(searchResults);
        }

        setPagination(response.data.pagination);

        // Add to recent queries if this is a new search (not pagination)
        if (pageNum === 1) {
          addToRecentQueries(trimmedQuery);
        }
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Search failed:', err);

      // If it's a network error, don't cache the failure
      if (!isNetworkError(err)) {
        // Clear results on error
        if (!append) {
          setResults([]);
          setPagination({
            total: 0,
            page: 1,
            per_page: perPage.value,
            total_pages: 0,
            has_more: false,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  // Debounced search
  function debouncedSearch(searchQuery: string): void {
    setQuery(searchQuery);

    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId);
    }

    searchTimeoutId = window.setTimeout(() => {
      performSearch(searchQuery, 1, false);
    }, SEARCH_DEBOUNCE_MS);
  }

  // Load more results (infinite scroll)
  async function loadMore(): Promise<void> {
    if (!canLoadMore.value) return;

    const nextPage = page.value + 1;
    await performSearch(query.value, nextPage, true);
  }

  // Get search suggestions
  async function fetchSuggestions(searchQuery: string): Promise<void> {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await apiService.getSearchSuggestions(trimmedQuery);
      if (response.data?.suggestions) {
        setSuggestions(response.data.suggestions);
      }
    } catch (err) {
      console.warn('Failed to fetch search suggestions:', err);
      setSuggestions([]);
    }
  }

  // Clear search state
  function clearSearch(): void {
    setQuery('');
    setResults([]);
    setPagination({ total: 0, page: 1, per_page: perPage.value, total_pages: 0, has_more: false });
    setSuggestions([]);
    clearError();

    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId);
      searchTimeoutId = null;
    }
  }

  // Initialize store
  function initialize(): void {
    loadRecentQueries();
  }

  // Location-based search functionality
  async function performLocationSearch(
    coordinates: { latitude: number; longitude: number },
    radiusMeters: number = 500,
    pageNum: number = 1
  ): Promise<void> {
    setLoading(true);
    clearError();

    try {
      // Use discovery API endpoint for location-based search
      const response = await apiService.getNearbyArtworks(
        coordinates.latitude,
        coordinates.longitude,
        radiusMeters,
        perPage.value
      );

      if (response.data) {
        // Map nearby artwork response into generic SearchResult shape
        type NearbyArtworkLike = {
          id: string; lat: number; lon: number; type_name?: string; tags?: unknown; recent_photo?: string; photo_count?: number; photos?: unknown; distance_km?: number; similarity_score?: number | null;
        };
        const nearbyArray = response.data.artworks as NearbyArtworkLike[];
        const searchResults: SearchResult[] = nearbyArray.map(artwork => {
          let parsedTags: Record<string, unknown> | null = null;
          if (artwork.tags) {
            if (typeof artwork.tags === 'string') {
              try { parsedTags = JSON.parse(artwork.tags); } catch { parsedTags = null; }
            } else if (typeof artwork.tags === 'object') {
              parsedTags = artwork.tags as Record<string, unknown>;
            }
          }
          return {
            id: artwork.id,
            lat: artwork.lat,
            lon: artwork.lon,
            type_name: artwork.type_name || 'unknown',
            tags: parsedTags,
            recent_photo: artwork.recent_photo ?? null,
            photo_count: artwork.photo_count ?? (Array.isArray(artwork.photos) ? (artwork.photos as unknown[]).length : 0),
            distance_km: artwork.distance_km ?? null,
            similarity_score: artwork.similarity_score ?? null,
          };
        });

        setResults(searchResults);
        setPagination({
          total: response.data.total,
          page: pageNum,
          per_page: perPage.value,
          total_pages: Math.ceil(response.data.total / perPage.value),
          has_more: pageNum * perPage.value < response.data.total,
        });

        // Set a descriptive query for display
        setQuery(`Near (${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)})`);
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      console.error('Location search failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return {
    // State
    query: computed(() => query.value),
    results: computed(() => results.value),
    total: computed(() => total.value),
    page: computed(() => page.value),
    perPage: computed(() => perPage.value),
    totalPages: computed(() => totalPages.value),
    hasMore: computed(() => hasMore.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    suggestions: computed(() => suggestions.value),
    recentQueries: computed(() => recentQueries.value),

    // Computed
    hasResults,
    isEmpty,
    canLoadMore,
    currentQuery,
    totalResults,
    hasSearched,

    // Actions
    setQuery,
    setResults,
    appendResults,
    setPagination,
    setLoading,
    setError,
    clearError,
    setSuggestions,
    addToRecentQueries,
    loadRecentQueries,
    clearRecentQueries,
    performSearch,
    debouncedSearch,
    loadMore,
    fetchSuggestions,
    clearSearch,
    initialize,
    performLocationSearch,
  };
});
