import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { SearchResult } from '../types';
import { apiService, getErrorMessage, isNetworkError } from '../services/api';
import { parseListFilters, type ListFilter } from '../utils/listFilters';
import { MIN_SEARCH_LENGTH } from '../../../shared/constants';

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

  // List filtering state
  const currentListFilters = ref<ListFilter[]>([]);
  const baseQuery = ref('');

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
     // Preserve the original query including trailing spaces for typing
     query.value = searchQuery;
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
    } catch (err: unknown) {
      console.warn('Failed to save recent queries to localStorage:', err);
    }
  }

  function loadRecentQueries(): void {
    try {
      const stored = localStorage.getItem('search-recent-queries');
      if (stored) {
        recentQueries.value = JSON.parse(stored);
      }
    } catch (err: unknown) {
      console.warn('Failed to load recent queries from localStorage:', err);
      recentQueries.value = [];
    }
  }

  function clearRecentQueries(): void {
    recentQueries.value = [];
    try {
      localStorage.removeItem('search-recent-queries');
    } catch (err: unknown) {
      console.warn('Failed to clear recent queries from localStorage:', err);
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

  // List-based search functionality for MVP
  // Local types for list items and response shape
  type ListItemLike = {
    id: string;
    title?: string | null;
    description?: string | null;
    tags?: string | Record<string, unknown> | null;
    lat?: number | null;
    lon?: number | null;
    [key: string]: unknown;
  };

  type ListSearchResponse =
    | { success: true; data: { artworks: ListItemLike[]; pagination: { page: number; per_page: number; total: number; total_pages: number; has_more: boolean }; query: { original: string; processed: string } } }
    | { success: false; error: string };

  async function searchInList(
    listId: string,
    searchQuery: string,
    pageNum: number,
    limit: number
  ): Promise<ListSearchResponse> {
    try {
      // Page through list items (server enforces max limit per page, use 100)
      const pageSize = 100;
      let page = 1;
      let accumulated: ListItemLike[] = [];
      let listMeta: unknown = null;

      while (true) {
        const resp = await apiService.getListDetails(listId, page, pageSize);
        if (!resp || !resp.success || !resp.data) {
          throw new Error('List not found or inaccessible');
        }

        // Narrow the shape of resp.data to expected list details
        const data = resp.data as { list?: Record<string, unknown>; items?: unknown[]; has_more?: boolean; page?: number; per_page?: number; total?: number };

        if (!listMeta) listMeta = data.list;
        const items = (data.items || []) as ListItemLike[];
        accumulated.push(...items);

        if (!data.has_more) break;
        page += 1;
      }

      let artworks: ListItemLike[] = accumulated;

      // If there's a search query, filter artworks by title, description, or tags
      if (searchQuery.trim().length > 0) {
        const queryLower = searchQuery.toLowerCase();
        artworks = artworks.filter((artwork: ListItemLike) => {
          const title = (artwork.title || '').toString().toLowerCase();
          const description = (artwork.description || '').toString().toLowerCase();

          let tagsObj: Record<string, unknown> = {};
          if (typeof artwork.tags === 'string') {
            try {
              tagsObj = JSON.parse(artwork.tags || '{}');
            } catch {
              tagsObj = {};
            }
          } else if (typeof artwork.tags === 'object' && artwork.tags !== null) {
            tagsObj = artwork.tags as Record<string, unknown>;
          }

          const tagString = Object.entries(tagsObj)
            .map(([key, value]) => `${key}:${String(value)}`)
            .join(' ')
            .toLowerCase();

          return (
            title.includes(queryLower) || description.includes(queryLower) || tagString.includes(queryLower)
          );
        });
      }

      // Simple pagination of the accumulated list items
      const total = artworks.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (pageNum - 1) * limit;
      const paginatedArtworks = artworks.slice(offset, offset + limit);

      return {
        success: true,
        data: {
          artworks: paginatedArtworks,
          pagination: {
            page: pageNum,
            per_page: limit,
            total: total,
            total_pages: totalPages,
            has_more: pageNum < totalPages,
          },
          query: {
            original: searchQuery,
            processed: searchQuery,
          },
        },
      };
    } catch (error) {
      console.error('Error searching in list:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search in list',
      };
    }
  }

  // Search functionality
  async function performSearch(
    searchQuery: string,
    pageNum: number = 1,
    append: boolean = false
  ): Promise<void> {
    const trimmedQuery = searchQuery.trim();

    // Enforce minimum query length for server search
    if (trimmedQuery.length > 0 && trimmedQuery.length < MIN_SEARCH_LENGTH) {
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

    // Parse list filters from the query
    const { listFilters, remainingQuery } = parseListFilters(trimmedQuery);
    currentListFilters.value = listFilters;
    baseQuery.value = remainingQuery;

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
      let response;

      // If there are list filters, use list-based search
      if (listFilters.length > 0) {
        // For MVP, use the first list filter (multiple list filtering can be added later)
        const listFilter = listFilters[0];
        response = await searchInList(listFilter?.listId || '', remainingQuery, pageNum, perPage.value);
      } else {
        // Regular search
        response = await apiService.searchArtworks(trimmedQuery, pageNum, perPage.value);
      }

          if (response && 'data' in response && response.data) {
            // Response may come from apiService.searchArtworks or the local searchInList helper.
            // Define a shared shape to safely access data.pagination and data.artworks without using `any`.
            type ApiSearchResponseShape = {
              data: {
                artworks: unknown[];
                pagination: {
                  page: number;
                  per_page: number;
                  total: number;
                  total_pages: number;
                  has_more: boolean;
                };
                query?: Record<string, unknown>;
              };
            };

            const responseWithData = response as ApiSearchResponseShape;

        type ArtworkLike = {
          id: string;
          lat: number;
          lon: number;
          type_name?: string;
          tags?: unknown;
          recent_photo?: string;
          photo_count?: number;
          photos?: unknown;
          distance_km?: number;
          similarity_score?: number | null;
          title?: string | null;
          artist_name?: string | null;
        };
            const artworksArray = responseWithData.data.artworks as ArtworkLike[];
        const searchResults: SearchResult[] = artworksArray.map(artwork => {
          let parsedTags: Record<string, unknown> | null = null;
          if (artwork.tags) {
            if (typeof artwork.tags === 'string') {
              try {
                parsedTags = JSON.parse(artwork.tags);
              } catch {
                parsedTags = null;
              }
            } else if (typeof artwork.tags === 'object') {
              parsedTags = artwork.tags as Record<string, unknown>;
            }
          }
          // Prefer explicit artwork.title from API (if present on ArtworkApiResponse)
          const rawTitle = artwork.title;
          let derivedTitle: string | null = null;
          if (typeof rawTitle === 'string' && rawTitle.trim().length > 0) {
            derivedTitle = rawTitle.trim();
          } else if (parsedTags) {
            const t = parsedTags as { title?: unknown; name?: unknown };
            if (typeof t.title === 'string' && t.title.trim().length > 0) {
              derivedTitle = t.title.trim();
            } else if (typeof t.name === 'string' && t.name.trim().length > 0) {
              derivedTitle = t.name.trim();
            }
          }
          // Artist name from API or tags
          const rawArtist = artwork.artist_name;
          let artistName: string | null = null;
          if (typeof rawArtist === 'string' && rawArtist.trim().length > 0) {
            artistName = rawArtist.trim();
          } else if (parsedTags) {
            const t = parsedTags as {
              artist?: unknown;
              artist_name?: unknown;
              created_by?: unknown;
            };
            const candidate = [t.artist_name, t.artist, t.created_by].find(
              (v): v is string => typeof v === 'string' && v.trim().length > 0
            );
            if (candidate) artistName = candidate.trim();
          }
          return {
            id: artwork.id,
            lat: artwork.lat,
            lon: artwork.lon,
            type_name: artwork.type_name || 'unknown',
            title: derivedTitle,
            artist_name: artistName,
            tags: parsedTags,
            recent_photo: artwork.recent_photo ?? null,
            photo_count:
              artwork.photo_count ??
              (Array.isArray(artwork.photos) ? (artwork.photos as unknown[]).length : 0),
            distance_km: artwork.distance_km ?? null,
            similarity_score: artwork.similarity_score ?? null,
          };
        });

        // Cache the results
            cacheResults(trimmedQuery, pageNum, {
              results: searchResults,
              total: responseWithData.data.pagination.total,
              page: responseWithData.data.pagination.page,
            });

        if (append) {
          appendResults(searchResults);
        } else {
          setResults(searchResults);
        }

            setPagination(responseWithData.data.pagination);

        // Add to recent queries if this is a new search (not pagination)
        if (pageNum === 1) {
          addToRecentQueries(trimmedQuery);
        }
      }
    } catch (err: unknown) {
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

    if (trimmedQuery.length < Math.min(2, MIN_SEARCH_LENGTH)) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await apiService.getSearchSuggestions(trimmedQuery);
      if (response.data?.suggestions) {
        setSuggestions(response.data.suggestions);
      }
    } catch (err: unknown) {
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
          id: string;
          lat: number;
          lon: number;
          type_name?: string;
          tags?: unknown;
          recent_photo?: string;
          photo_count?: number;
          photos?: unknown;
          distance_km?: number;
          similarity_score?: number | null;
          title?: string | null;
          artist_name?: string | null;
        };
        const nearbyArray = response.data.artworks as NearbyArtworkLike[];
        const searchResults: SearchResult[] = nearbyArray.map(artwork => {
          let parsedTags: Record<string, unknown> | null = null;
          if (artwork.tags) {
            if (typeof artwork.tags === 'string') {
              try {
                parsedTags = JSON.parse(artwork.tags);
              } catch {
                parsedTags = null;
              }
            } else if (typeof artwork.tags === 'object') {
              parsedTags = artwork.tags as Record<string, unknown>;
            }
          }
          // Prefer explicit artwork.title from API (if present on ArtworkWithPhotos)
          const rawTitle = artwork.title;
          let derivedTitle: string | null = null;
          if (typeof rawTitle === 'string' && rawTitle.trim().length > 0) {
            derivedTitle = rawTitle.trim();
          } else if (parsedTags) {
            const t = parsedTags as { title?: unknown; name?: unknown };
            if (typeof t.title === 'string' && t.title.trim().length > 0) {
              derivedTitle = t.title.trim();
            } else if (typeof t.name === 'string' && t.name.trim().length > 0) {
              derivedTitle = t.name.trim();
            }
          }
          // Artist name from API or tags
          const rawArtist = artwork.artist_name;
          let artistName: string | null = null;
          if (typeof rawArtist === 'string' && rawArtist.trim().length > 0) {
            artistName = rawArtist.trim();
          } else if (parsedTags) {
            const t = parsedTags as {
              artist?: unknown;
              artist_name?: unknown;
              created_by?: unknown;
            };
            const candidate = [t.artist_name, t.artist, t.created_by].find(
              (v): v is string => typeof v === 'string' && v.trim().length > 0
            );
            if (candidate) artistName = candidate.trim();
          }
          return {
            id: artwork.id,
            lat: artwork.lat,
            lon: artwork.lon,
            type_name: artwork.type_name || 'unknown',
            title: derivedTitle,
            artist_name: artistName,
            tags: parsedTags,
            recent_photo: artwork.recent_photo ?? null,
            photo_count:
              artwork.photo_count ??
              (Array.isArray(artwork.photos) ? (artwork.photos as unknown[]).length : 0),
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
    } catch (err: unknown) {
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

    // List filtering state
    currentListFilters: computed(() => currentListFilters.value),
    baseQuery: computed(() => baseQuery.value),

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
