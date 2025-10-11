import { defineComponent, ref, computed, onMounted, nextTick, onUnmounted, mergeProps, unref, useSSRContext, watch } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrIncludeBooleanAttr, ssrRenderList, ssrRenderAttr, ssrRenderClass, ssrInterpolate, ssrRenderStyle } from 'vue/server-renderer';
import { useRoute, useRouter } from 'vue-router';
import { MagnifyingGlassIcon, XMarkIcon, PlusIcon } from '@heroicons/vue/24/outline';
import { _ as _export_sfc, a as apiService, b as getErrorMessage, m as isNetworkError, c as canUseLocalStorage, o as useFastUploadSessionStore } from '../ssr-entry-server.js';
import { M as MiniMap } from './MiniMap-_0n-xEQo.js';
import { A as ArtworkCard } from './ArtworkCard-0An4ZMhk.js';
import { _ as _sfc_main$2 } from './ArtworkTypeFilter-BnCnhf0a.js';
import { S as SkeletonCard } from './SkeletonCard-CEBdOJ8w.js';
import { defineStore } from 'pinia';
import { u as useArtworkTypeFilters } from './useArtworkTypeFilters-BIVqZddm.js';
import '@vue/server-renderer';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/solid';
import './image-CoH3F98X.js';

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "SearchInput",
  __ssrInlineRender: true,
  props: {
    modelValue: {},
    placeholder: { default: "Search artworks... try: mural, tag:material:bronze, tag:artist_name:banksy" },
    suggestions: { default: () => [] },
    loading: { type: Boolean, default: false },
    showClearButton: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    autofocus: { type: Boolean, default: false },
    debounceMs: { default: 300 }
  },
  emits: ["update:modelValue", "search", "clear", "focus", "blur", "suggestionSelect"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const inputRef = ref();
    const containerRef = ref();
    const showSuggestions = ref(false);
    const highlightedIndex = ref(-1);
    const debounceTimer = ref(null);
    const localValue = computed({
      get: () => props.modelValue,
      set: (value) => {
        emit("update:modelValue", value);
        debouncedSearch(value);
      }
    });
    const hasSuggestions = computed(
      () => props.suggestions.length > 0 && showSuggestions.value && localValue.value.length > 0
    );
    const showClear = computed(
      () => props.showClearButton && localValue.value.length > 0 && !props.disabled
    );
    const activeDescendant = computed(
      () => highlightedIndex.value >= 0 ? `suggestion-${highlightedIndex.value}` : ""
    );
    function debouncedSearch(query) {
      if (debounceTimer.value) {
        clearTimeout(debounceTimer.value);
      }
      debounceTimer.value = window.setTimeout(() => {
        if (query.trim().length > 0) {
          emit("search", query.trim());
        }
      }, props.debounceMs);
    }
    function hideSuggestions() {
      showSuggestions.value = false;
      highlightedIndex.value = -1;
    }
    function clearInput() {
      localValue.value = "";
      emit("clear");
      showSuggestions.value = false;
      inputRef.value?.focus();
    }
    function handleClickOutside(event) {
      if (containerRef.value && !containerRef.value.contains(event.target)) {
        hideSuggestions();
      }
    }
    onMounted(() => {
      if (props.autofocus) {
        nextTick(() => {
          inputRef.value?.focus();
        });
      }
      document.addEventListener("click", handleClickOutside);
    });
    onUnmounted(() => {
      if (debounceTimer.value) {
        clearTimeout(debounceTimer.value);
      }
      document.removeEventListener("click", handleClickOutside);
    });
    __expose({
      focus: () => inputRef.value?.focus(),
      blur: () => inputRef.value?.blur(),
      clear: clearInput
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        ref_key: "containerRef",
        ref: containerRef,
        class: "relative w-full"
      }, _attrs))} data-v-a013f4cc><div class="relative" data-v-a013f4cc><div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none" data-v-a013f4cc>`);
      _push(ssrRenderComponent(unref(MagnifyingGlassIcon), {
        class: ["h-5 w-5 text-gray-400", { "animate-pulse": _ctx.loading }],
        "aria-hidden": "true"
      }, null, _parent));
      _push(`</div><input${ssrRenderAttrs(mergeProps({
        ref_key: "inputRef",
        ref: inputRef,
        value: localValue.value,
        type: "search",
        placeholder: _ctx.placeholder || "Search artworks...",
        disabled: _ctx.disabled || false,
        class: ["block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed sm:text-sm", {
          "pr-20": showClear.value,
          "border-gray-300": !hasSuggestions.value,
          "border-blue-500 ring-1 ring-blue-500": hasSuggestions.value
        }],
        autocomplete: "off",
        spellcheck: "false",
        role: "combobox",
        "aria-expanded": hasSuggestions.value
      }, activeDescendant.value ? { "aria-activedescendant": activeDescendant.value } : {}, {
        "aria-autocomplete": "list",
        "aria-describedby": "search-description"
      }))} data-v-a013f4cc>`);
      if (showClear.value) {
        _push(`<div class="absolute inset-y-0 right-0 flex items-center pr-3" data-v-a013f4cc><button type="button" class="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full"${ssrIncludeBooleanAttr(_ctx.disabled || false) ? " disabled" : ""} aria-label="Clear search" data-v-a013f4cc>`);
        _push(ssrRenderComponent(unref(XMarkIcon), {
          class: "h-4 w-4",
          "aria-hidden": "true"
        }, null, _parent));
        _push(`</button></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div><div id="search-description" class="sr-only" data-v-a013f4cc> Use arrow keys to navigate suggestions, Enter to select, Escape to close </div>`);
      if (hasSuggestions.value) {
        _push(`<div class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto" role="listbox" aria-label="Search suggestions" data-v-a013f4cc><ul class="py-1" data-v-a013f4cc><!--[-->`);
        ssrRenderList(_ctx.suggestions, (suggestion, index) => {
          _push(`<li${ssrRenderAttr("id", `suggestion-${index}`)} class="${ssrRenderClass([{
            "bg-blue-50 text-blue-700": index === highlightedIndex.value,
            "text-gray-900": index !== highlightedIndex.value
          }, "px-4 py-2 cursor-pointer text-sm hover:bg-gray-50 focus:bg-gray-50 flex items-center space-x-2"])}" role="option"${ssrRenderAttr("aria-selected", index === highlightedIndex.value)} data-v-a013f4cc>`);
          _push(ssrRenderComponent(unref(MagnifyingGlassIcon), {
            class: "h-4 w-4 flex-shrink-0 text-gray-400",
            "aria-hidden": "true"
          }, null, _parent));
          _push(`<span class="truncate" data-v-a013f4cc>${ssrInterpolate(suggestion)}</span></li>`);
        });
        _push(`<!--]--></ul></div>`);
      } else {
        _push(`<!---->`);
      }
      if (_ctx.loading && localValue.value.length > 0) {
        _push(`<div class="absolute right-3 top-1/2 transform -translate-y-1/2" aria-hidden="true" data-v-a013f4cc><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" data-v-a013f4cc></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/SearchInput.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const SearchInput = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-a013f4cc"]]);

function parseListFilters(query) {
  const listFilters = [];
  let remainingQuery = query;
  const listTokenRegex = /\blist:([a-f0-9\-]{36})\b/gi;
  let match;
  while ((match = listTokenRegex.exec(query)) !== null) {
    listFilters.push({
      listId: match[1] || ""
    });
  }
  remainingQuery = query.replace(listTokenRegex, "").trim();
  remainingQuery = remainingQuery.replace(/\s+/g, " ").trim();
  return {
    listFilters,
    remainingQuery
  };
}
function formatListFilter(filter) {
  return filter.listName ? `List: ${filter.listName}` : `List: ${filter.listId.substring(0, 8)}...`;
}

const useSearchStore = defineStore("search", () => {
  const query = ref("");
  const results = ref([]);
  const total = ref(0);
  const page = ref(1);
  const perPage = ref(20);
  const totalPages = ref(0);
  const hasMore = ref(false);
  const isLoading = ref(false);
  const error = ref(null);
  const suggestions = ref([]);
  const recentQueries = ref([]);
  const currentListFilters = ref([]);
  const baseQuery = ref("");
  const searchCache = ref(/* @__PURE__ */ new Map());
  let searchTimeoutId = null;
  const SEARCH_DEBOUNCE_MS = 300;
  const CACHE_TTL_MS = 5 * 60 * 1e3;
  const hasResults = computed(() => results.value.length > 0);
  const isEmpty = computed(
    () => !isLoading.value && results.value.length === 0 && query.value.length > 0
  );
  const canLoadMore = computed(() => hasMore.value && !isLoading.value);
  const currentQuery = computed(() => query.value.trim());
  const totalResults = computed(() => total.value);
  const hasSearched = computed(() => query.value.trim().length > 0 || results.value.length > 0);
  function setQuery(searchQuery) {
    query.value = searchQuery.trim();
  }
  function setResults(searchResults) {
    results.value = searchResults;
    error.value = null;
  }
  function appendResults(searchResults) {
    results.value.push(...searchResults);
    error.value = null;
  }
  function setPagination(paginationInfo) {
    total.value = paginationInfo.total;
    page.value = paginationInfo.page;
    perPage.value = paginationInfo.per_page;
    totalPages.value = paginationInfo.total_pages;
    hasMore.value = paginationInfo.has_more;
  }
  function setLoading(loading) {
    isLoading.value = loading;
  }
  function setError(errorMessage) {
    error.value = errorMessage;
  }
  function clearError() {
    error.value = null;
  }
  function setSuggestions(searchSuggestions) {
    suggestions.value = searchSuggestions;
  }
  function addToRecentQueries(searchQuery) {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length === 0) return;
    const existingIndex = recentQueries.value.indexOf(trimmedQuery);
    if (existingIndex >= 0) {
      recentQueries.value.splice(existingIndex, 1);
    }
    recentQueries.value.unshift(trimmedQuery);
    if (recentQueries.value.length > 10) {
      recentQueries.value = recentQueries.value.slice(0, 10);
    }
    if (canUseLocalStorage()) {
      try {
        localStorage.setItem("search-recent-queries", JSON.stringify(recentQueries.value));
      } catch (err) {
        console.warn("Failed to save recent queries to localStorage:", err);
      }
    }
  }
  function loadRecentQueries() {
    if (!canUseLocalStorage()) {
      recentQueries.value = [];
      return;
    }
    try {
      const stored = localStorage.getItem("search-recent-queries");
      if (stored) {
        recentQueries.value = JSON.parse(stored);
      }
    } catch (err) {
      console.warn("Failed to load recent queries from localStorage:", err);
      recentQueries.value = [];
    }
  }
  function clearRecentQueries() {
    recentQueries.value = [];
    if (canUseLocalStorage()) {
      try {
        localStorage.removeItem("search-recent-queries");
      } catch (err) {
        console.warn("Failed to clear recent queries from localStorage:", err);
      }
    }
  }
  function getCacheKey(searchQuery, pageNum) {
    return `${searchQuery}:${pageNum}`;
  }
  function isCacheValid(timestamp) {
    return Date.now() - timestamp < CACHE_TTL_MS;
  }
  function getCachedResults(searchQuery, pageNum) {
    const cacheKey = getCacheKey(searchQuery, pageNum);
    const cached = searchCache.value.get(cacheKey);
    if (cached && isCacheValid(cached.timestamp)) {
      return cached;
    }
    if (cached) {
      searchCache.value.delete(cacheKey);
    }
    return null;
  }
  function cacheResults(searchQuery, pageNum, data) {
    const cacheKey = getCacheKey(searchQuery, pageNum);
    searchCache.value.set(cacheKey, {
      ...data,
      timestamp: Date.now()
    });
    if (searchCache.value.size > 50) {
      const entries = Array.from(searchCache.value.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      searchCache.value.clear();
      entries.slice(0, 50).forEach(([key, value]) => {
        searchCache.value.set(key, value);
      });
    }
  }
  async function searchInList(listId, searchQuery, pageNum, limit) {
    try {
      const pageSize = 100;
      let page2 = 1;
      let accumulated = [];
      let listMeta = null;
      while (true) {
        const resp = await apiService.getListDetails(listId, page2, pageSize);
        if (!resp || !resp.success || !resp.data) {
          throw new Error("List not found or inaccessible");
        }
        const data = resp.data;
        if (!listMeta) listMeta = data.list;
        const items = data.items || [];
        accumulated.push(...items);
        if (!data.has_more) break;
        page2 += 1;
      }
      let artworks = accumulated;
      if (searchQuery.trim().length > 0) {
        const queryLower = searchQuery.toLowerCase();
        artworks = artworks.filter((artwork) => {
          const title = (artwork.title || "").toString().toLowerCase();
          const description = (artwork.description || "").toString().toLowerCase();
          let tagsObj = {};
          if (typeof artwork.tags === "string") {
            try {
              tagsObj = JSON.parse(artwork.tags || "{}");
            } catch {
              tagsObj = {};
            }
          } else if (typeof artwork.tags === "object" && artwork.tags !== null) {
            tagsObj = artwork.tags;
          }
          const tagString = Object.entries(tagsObj).map(([key, value]) => `${key}:${String(value)}`).join(" ").toLowerCase();
          return title.includes(queryLower) || description.includes(queryLower) || tagString.includes(queryLower);
        });
      }
      const total2 = artworks.length;
      const totalPages2 = Math.max(1, Math.ceil(total2 / limit));
      const offset = (pageNum - 1) * limit;
      const paginatedArtworks = artworks.slice(offset, offset + limit);
      return {
        success: true,
        data: {
          artworks: paginatedArtworks,
          pagination: {
            page: pageNum,
            per_page: limit,
            total: total2,
            total_pages: totalPages2,
            has_more: pageNum < totalPages2
          },
          query: {
            original: searchQuery,
            processed: searchQuery
          }
        }
      };
    } catch (error2) {
      console.error("Error searching in list:", error2);
      return {
        success: false,
        error: error2 instanceof Error ? error2.message : "Failed to search in list"
      };
    }
  }
  async function performSearch(searchQuery, pageNum = 1, append = false) {
    const trimmedQuery = searchQuery.trim();
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
        has_more: false
      });
      return;
    }
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
        has_more: cached.page * perPage.value < cached.total
      });
      return;
    }
    setLoading(true);
    clearError();
    try {
      let response;
      if (listFilters.length > 0) {
        const listFilter = listFilters[0];
        response = await searchInList(listFilter?.listId || "", remainingQuery, pageNum, perPage.value);
      } else {
        response = await apiService.searchArtworks(trimmedQuery, pageNum, perPage.value);
      }
      if (response && "data" in response && response.data) {
        const responseWithData = response;
        const artworksArray = responseWithData.data.artworks;
        const searchResults = artworksArray.map((artwork) => {
          let parsedTags = null;
          if (artwork.tags) {
            if (typeof artwork.tags === "string") {
              try {
                parsedTags = JSON.parse(artwork.tags);
              } catch {
                parsedTags = null;
              }
            } else if (typeof artwork.tags === "object") {
              parsedTags = artwork.tags;
            }
          }
          const rawTitle = artwork.title;
          let derivedTitle = null;
          if (typeof rawTitle === "string" && rawTitle.trim().length > 0) {
            derivedTitle = rawTitle.trim();
          } else if (parsedTags) {
            const t = parsedTags;
            if (typeof t.title === "string" && t.title.trim().length > 0) {
              derivedTitle = t.title.trim();
            } else if (typeof t.name === "string" && t.name.trim().length > 0) {
              derivedTitle = t.name.trim();
            }
          }
          const rawArtist = artwork.artist_name;
          let artistName = null;
          if (typeof rawArtist === "string" && rawArtist.trim().length > 0) {
            artistName = rawArtist.trim();
          } else if (parsedTags) {
            const t = parsedTags;
            const candidate = [t.artist_name, t.artist, t.created_by].find(
              (v) => typeof v === "string" && v.trim().length > 0
            );
            if (candidate) artistName = candidate.trim();
          }
          return {
            id: artwork.id,
            lat: artwork.lat,
            lon: artwork.lon,
            type_name: artwork.type_name || "unknown",
            title: derivedTitle,
            artist_name: artistName,
            tags: parsedTags,
            recent_photo: artwork.recent_photo ?? null,
            photo_count: artwork.photo_count ?? (Array.isArray(artwork.photos) ? artwork.photos.length : 0),
            distance_km: artwork.distance_km ?? null,
            similarity_score: artwork.similarity_score ?? null
          };
        });
        cacheResults(trimmedQuery, pageNum, {
          results: searchResults,
          total: responseWithData.data.pagination.total,
          page: responseWithData.data.pagination.page
        });
        if (append) {
          appendResults(searchResults);
        } else {
          setResults(searchResults);
        }
        setPagination(responseWithData.data.pagination);
        if (pageNum === 1) {
          addToRecentQueries(trimmedQuery);
        }
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      console.error("Search failed:", err);
      if (!isNetworkError(err)) {
        if (!append) {
          setResults([]);
          setPagination({
            total: 0,
            page: 1,
            per_page: perPage.value,
            total_pages: 0,
            has_more: false
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }
  function debouncedSearch(searchQuery) {
    setQuery(searchQuery);
    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId);
    }
    searchTimeoutId = window.setTimeout(() => {
      performSearch(searchQuery, 1, false);
    }, SEARCH_DEBOUNCE_MS);
  }
  async function loadMore() {
    if (!canLoadMore.value) return;
    const nextPage = page.value + 1;
    await performSearch(query.value, nextPage, true);
  }
  async function fetchSuggestions(searchQuery) {
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
      console.warn("Failed to fetch search suggestions:", err);
      setSuggestions([]);
    }
  }
  function clearSearch() {
    setQuery("");
    setResults([]);
    setPagination({ total: 0, page: 1, per_page: perPage.value, total_pages: 0, has_more: false });
    setSuggestions([]);
    clearError();
    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId);
      searchTimeoutId = null;
    }
  }
  function initialize() {
    loadRecentQueries();
  }
  async function performLocationSearch(coordinates, radiusMeters = 500, pageNum = 1) {
    setLoading(true);
    clearError();
    try {
      const response = await apiService.getNearbyArtworks(
        coordinates.latitude,
        coordinates.longitude,
        radiusMeters,
        perPage.value
      );
      if (response.data) {
        const nearbyArray = response.data.artworks;
        const searchResults = nearbyArray.map((artwork) => {
          let parsedTags = null;
          if (artwork.tags) {
            if (typeof artwork.tags === "string") {
              try {
                parsedTags = JSON.parse(artwork.tags);
              } catch {
                parsedTags = null;
              }
            } else if (typeof artwork.tags === "object") {
              parsedTags = artwork.tags;
            }
          }
          const rawTitle = artwork.title;
          let derivedTitle = null;
          if (typeof rawTitle === "string" && rawTitle.trim().length > 0) {
            derivedTitle = rawTitle.trim();
          } else if (parsedTags) {
            const t = parsedTags;
            if (typeof t.title === "string" && t.title.trim().length > 0) {
              derivedTitle = t.title.trim();
            } else if (typeof t.name === "string" && t.name.trim().length > 0) {
              derivedTitle = t.name.trim();
            }
          }
          const rawArtist = artwork.artist_name;
          let artistName = null;
          if (typeof rawArtist === "string" && rawArtist.trim().length > 0) {
            artistName = rawArtist.trim();
          } else if (parsedTags) {
            const t = parsedTags;
            const candidate = [t.artist_name, t.artist, t.created_by].find(
              (v) => typeof v === "string" && v.trim().length > 0
            );
            if (candidate) artistName = candidate.trim();
          }
          return {
            id: artwork.id,
            lat: artwork.lat,
            lon: artwork.lon,
            type_name: artwork.type_name || "unknown",
            title: derivedTitle,
            artist_name: artistName,
            tags: parsedTags,
            recent_photo: artwork.recent_photo ?? null,
            photo_count: artwork.photo_count ?? (Array.isArray(artwork.photos) ? artwork.photos.length : 0),
            distance_km: artwork.distance_km ?? null,
            similarity_score: artwork.similarity_score ?? null
          };
        });
        setResults(searchResults);
        setPagination({
          total: response.data.total,
          page: pageNum,
          per_page: perPage.value,
          total_pages: Math.ceil(response.data.total / perPage.value),
          has_more: pageNum * perPage.value < response.data.total
        });
        setQuery(`Near (${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)})`);
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      console.error("Location search failed:", err);
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
    performLocationSearch
  };
});

function useInfiniteScroll(loadMore, options = {}) {
  const { threshold = 0.1, rootMargin = "100px", enabled = true, immediate = false } = options;
  const targetRef = ref(null);
  const isIntersecting = ref(false);
  const isEnabled = ref(enabled);
  const observer = ref(null);
  const isLoading = ref(false);
  const shouldLoad = computed(() => isEnabled.value && isIntersecting.value && !isLoading.value);
  async function trigger() {
    if (!isEnabled.value || isLoading.value) return;
    isLoading.value = true;
    try {
      await loadMore();
    } catch (error) {
      console.error("Error loading more content:", error);
    } finally {
      isLoading.value = false;
    }
  }
  function enable() {
    isEnabled.value = true;
  }
  function disable() {
    isEnabled.value = false;
  }
  function reset() {
    isIntersecting.value = false;
    isLoading.value = false;
  }
  function createObserver() {
    if (!window.IntersectionObserver) {
      console.warn("IntersectionObserver not supported");
      return;
    }
    observer.value = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          isIntersecting.value = entry.isIntersecting;
          if (shouldLoad.value) {
            trigger();
          }
        }
      },
      {
        threshold,
        rootMargin
      }
    );
  }
  function startObserving() {
    if (observer.value && targetRef.value) {
      observer.value.observe(targetRef.value);
    }
  }
  function stopObserving() {
    if (observer.value) {
      observer.value.disconnect();
    }
  }
  function watchTarget() {
    const checkTarget = () => {
      if (targetRef.value && observer.value) {
        startObserving();
        return true;
      }
      return false;
    };
    if (checkTarget()) return;
    const interval = setInterval(() => {
      if (checkTarget()) {
        clearInterval(interval);
      }
    }, 100);
    setTimeout(() => clearInterval(interval), 5e3);
  }
  onMounted(() => {
    createObserver();
    if (immediate) {
      nextTick(() => {
        watchTarget();
      });
    } else {
      watchTarget();
    }
  });
  onUnmounted(() => {
    stopObserving();
  });
  return {
    targetRef,
    isIntersecting: computed(() => isIntersecting.value),
    isEnabled: computed(() => isEnabled.value),
    trigger,
    enable,
    disable,
    reset
  };
}

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "SearchView",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    const router = useRouter();
    const searchStore = useSearchStore();
    const searchInputRef = ref();
    ref();
    const showEmptyState = ref(false);
    const showSearchTips = ref(true);
    const fastUploadSession = ref(null);
    const fastUploadStore = useFastUploadSessionStore();
    const isFromFastUpload = computed(() => {
      return !!fastUploadSession.value && route.query.source === "fast-upload";
    });
    const autoRedirectedToNew = ref(false);
    const currentQuery = computed(() => route.params.query || "");
    const isSearchActive = computed(() => currentQuery.value.length > 0);
    const hasResults = computed(() => searchStore.hasResults);
    const isLoading = computed(() => searchStore.isLoading);
    const error = computed(() => searchStore.error);
    const suggestions = computed(() => searchStore.suggestions);
    const recentQueries = computed(() => searchStore.recentQueries);
    const currentListFilters = computed(() => searchStore.currentListFilters);
    const baseQuery = computed(() => searchStore.baseQuery);
    const { filterArtworks } = useArtworkTypeFilters();
    const filteredResults = computed(() => {
      if (!hasResults.value) {
        return [];
      }
      return filterArtworks(searchStore.results);
    });
    const filteredTotal = computed(() => filteredResults.value.length);
    const searchTips = [
      'Try "tag:artwork_type:statue" to find specific artwork types',
      'Search "tag:material:bronze" to find artworks by material',
      'Use "tag:artist_name:banksy" to find works by specific artists',
      'Search "tag:access:yes" to find publicly accessible artworks',
      'Try "mural tag:year:2020" to combine text and tag searches',
      'Use "tag:condition:excellent" to find well-preserved pieces',
      'Search "sculpture downtown" for location-based queries',
      'Try "tag:height" to find artworks with height information'
    ];
    useInfiniteScroll(() => searchStore.loadMore(), {
      enabled: true,
      threshold: 0.1
    });
    function handleSearch(query) {
      if (query.trim().length === 0) {
        router.push("/search");
        return;
      }
      const normalizedQuery = query.trim();
      if (normalizedQuery !== currentQuery.value) {
        router.push(`/search/${encodeURIComponent(normalizedQuery)}`);
      }
    }
    function handleSearchInput(query) {
      searchStore.setQuery(query);
      performSearch(query);
      if (query.trim().length > 0) {
        searchStore.fetchSuggestions(query.trim());
        showSearchTips.value = false;
      } else {
        showSearchTips.value = true;
      }
    }
    function handleSuggestionSelect(suggestion) {
      handleSearch(suggestion);
    }
    function handleArtworkClick(artwork) {
      if (isFromFastUpload.value) {
        router.push(`/artwork/${artwork.id}?action=add-logbook&from=fast-upload`);
      } else {
        router.push(`/artwork/${artwork.id}`);
      }
    }
    function handleAddReport(artwork) {
      const query = isFromFastUpload.value ? { source: "fast-upload" } : {};
      router.push({
        path: `/logbook/${artwork.id}`,
        query
      });
    }
    function clearSearch() {
      searchStore.clearSearch();
      router.push("/search");
      showSearchTips.value = true;
      nextTick(() => {
        searchInputRef.value?.focus();
      });
    }
    function performSearch(query) {
      if (query.trim().length === 0) {
        searchStore.clearSearch();
        showEmptyState.value = false;
        return;
      }
      showSearchTips.value = false;
      showEmptyState.value = false;
      searchStore.performSearch(query.trim());
    }
    watch(
      () => route.params.query,
      (newQuery) => {
        const query = newQuery || "";
        if (query !== searchStore.query) {
          searchStore.setQuery(query);
          performSearch(query);
        }
      },
      { immediate: true }
    );
    watch(
      () => ({
        lat: route.query.lat,
        lng: route.query.lng,
        source: route.query.source,
        storePhotos: fastUploadStore.photos,
        storeLocation: fastUploadStore.location,
        storeDetectedSources: fastUploadStore.detectedSources
      }),
      (newQuery, oldQuery) => {
        if (newQuery.source !== "fast-upload") return;
        if (!newQuery.lat || !newQuery.lng) return;
        const coordsChanged = newQuery.lat !== oldQuery?.lat || newQuery.lng !== oldQuery?.lng;
        const storePhotosChanged = newQuery.storePhotos !== oldQuery?.storePhotos;
        const storeLocationChanged = newQuery.storeLocation !== oldQuery?.storeLocation;
        if (!coordsChanged && !storePhotosChanged && !storeLocationChanged) return;
        const lat = parseFloat(newQuery.lat);
        const lng = parseFloat(newQuery.lng);
        if (isNaN(lat) || isNaN(lng)) return;
        const newLocation = { latitude: lat, longitude: lng };
        fastUploadSession.value = {
          photos: fastUploadStore.photos.map((p) => {
            const base = { id: p.id, name: p.name };
            if (p.preview) base.preview = p.preview;
            return base;
          }),
          location: newLocation,
          detectedSources: fastUploadStore.detectedSources || newQuery.storeDetectedSources
        };
        if (coordsChanged) {
          performLocationSearch(lat, lng);
        }
      },
      { immediate: true, deep: true }
    );
    watch(
      [isLoading, hasResults, isSearchActive],
      ([loading, results, active]) => {
        if (!loading && active && !results) {
          showEmptyState.value = true;
        } else {
          showEmptyState.value = false;
        }
      }
    );
    onMounted(() => {
      searchStore.initialize();
      const sessionData = sessionStorage.getItem("fast-upload-session");
      if (sessionData && route.query.source === "fast-upload") {
        console.log("[DEBUG] Using sessionStorage data for fast upload session");
        try {
          const parsed = JSON.parse(sessionData);
          const previewLookup = {};
          fastUploadStore.photos.forEach((p) => {
            if (p.id) previewLookup[p.id] = p.preview;
          });
          fastUploadSession.value = {
            photos: (parsed.photos || []).map((p) => ({
              id: p.id,
              name: p.name,
              preview: previewLookup[p.id]
            })),
            location: parsed.location || fastUploadStore.location || null,
            detectedSources: parsed.detectedSources || fastUploadStore.detectedSources || null
          };
          if (fastUploadSession.value?.location) {
            const { latitude, longitude } = fastUploadSession.value.location;
            performLocationSearch(latitude, longitude);
          }
        } catch (error2) {
          console.error("Failed to parse fast upload session data:", error2);
          sessionStorage.removeItem("fast-upload-session");
        }
      } else if (route.query.source === "fast-upload" && fastUploadStore.hasPhotos) {
        console.log("[DEBUG] Using fallback store data for fast upload session");
        fastUploadSession.value = {
          photos: fastUploadStore.photos.map((p) => {
            const base = { id: p.id, name: p.name };
            if (p.preview) base.preview = p.preview;
            return base;
          }),
          location: fastUploadStore.location,
          detectedSources: fastUploadStore.detectedSources
        };
      }
      if (!isFromFastUpload.value) {
        nextTick(() => {
          searchInputRef.value?.focus();
        });
      }
    });
    watch(
      [isFromFastUpload, () => fastUploadSession.value?.location, hasResults, isLoading],
      ([fromFast, loc, results, loading]) => {
        if (!fromFast) return;
        if (!loc) return;
        if (loading) return;
        if (results) return;
        if (autoRedirectedToNew.value) return;
        if (searchStore.query.startsWith("Near (") && searchStore.hasSearched) {
          autoRedirectedToNew.value = true;
          router.push("/artwork/new?from=fast-upload&reason=auto-no-nearby");
        }
      }
    );
    function performLocationSearch(latitude, longitude) {
      searchStore.performLocationSearch({ latitude, longitude });
    }
    function getLocationMethodText(detectedSources) {
      if (!detectedSources) return "Unknown";
      if (detectedSources.exif?.detected && detectedSources.exif?.coordinates) {
        return "Photo EXIF data";
      }
      if (detectedSources.browser?.detected && detectedSources.browser?.coordinates) {
        return "Device GPS";
      }
      if (detectedSources.ip?.detected && detectedSources.ip?.coordinates) {
        return "IP location";
      }
      return "Manual entry";
    }
    function getLocationMethodStyle(detectedSources) {
      const method = getLocationMethodText(detectedSources);
      switch (method) {
        case "Photo EXIF data":
          return "theme-success-container theme-on-success-container border border-green-200";
        case "Device GPS":
          return "theme-primary-container theme-on-primary-container border border-blue-200";
        case "IP location":
          return "theme-warning-container theme-on-warning-container border border-yellow-200";
        case "Manual entry":
          return "bg-purple-100 text-purple-800 border border-purple-200";
        default:
          return "bg-gray-100 text-gray-800 border border-gray-200";
      }
    }
    function getLocationMethodDescription(detectedSources) {
      const method = getLocationMethodText(detectedSources);
      switch (method) {
        case "Photo EXIF data":
          return "Location extracted from photo metadata - most accurate";
        case "Device GPS":
          return "Location from device GPS sensor - high accuracy";
        case "IP location":
          return "Location approximated from IP address - lower accuracy";
        case "Manual entry":
          return "Location entered manually by user";
        default:
          return "Location detection method unknown";
      }
    }
    function shouldShowExifMissingWarning(detectedSources) {
      if (!detectedSources) return false;
      try {
        return !detectedSources.exif?.detected && !!detectedSources.browser?.detected;
      } catch {
        return false;
      }
    }
    function photoHasExif(photo) {
      if (!photo) return false;
      try {
        return !!(photo.exifLat || photo.exifLon || photo.exif && (photo.exif.latitude || photo.exif.longitude));
      } catch {
        return false;
      }
    }
    function primaryPhoto() {
      try {
        if (!fastUploadSession.value || !fastUploadSession.value.photos) return null;
        return fastUploadSession.value.photos[0] || null;
      } catch {
        return null;
      }
    }
    onUnmounted(() => {
      searchStore.clearSearch();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "search-view min-h-screen bg-gray-50" }, _attrs))} data-v-21d91664><div class="bg-white border-b border-gray-200 sticky top-0 z-10" data-v-21d91664><div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4" data-v-21d91664><div class="flex justify-center mb-4" data-v-21d91664></div><div class="flex items-center space-x-4" data-v-21d91664><button class="lg:hidden p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg" aria-label="Go back" data-v-21d91664><svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-21d91664><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" data-v-21d91664></path></svg></button><div class="flex-1" data-v-21d91664>`);
      _push(ssrRenderComponent(SearchInput, {
        ref_key: "searchInputRef",
        ref: searchInputRef,
        "model-value": unref(searchStore).query,
        suggestions: suggestions.value,
        loading: isLoading.value,
        placeholder: "Search artworks... try: mural, tag:street-art",
        "onUpdate:modelValue": handleSearchInput,
        onSearch: handleSearch,
        onSuggestionSelect: handleSuggestionSelect,
        onClear: clearSearch
      }, null, _parent));
      _push(`</div></div></div></div><div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-v-21d91664>`);
      if (isFromFastUpload.value && fastUploadSession.value) {
        _push(`<div data-v-21d91664><div class="mb-6" data-v-21d91664><div class="bg-white rounded-lg shadow-md p-6 mb-6" data-v-21d91664><h2 class="text-lg font-semibold text-gray-900 mb-4" data-v-21d91664> Your Photos (${ssrInterpolate(fastUploadSession.value.photos.length)}) </h2><div class="grid grid-cols-1 sm:grid-cols-3 gap-4" data-v-21d91664><div class="bg-white rounded-lg shadow-sm border border-gray-200 p-2" data-v-21d91664><div class="w-full h-full flex items-center justify-center" data-v-21d91664><div class="w-full h-40 relative rounded-lg overflow-hidden bg-gray-50" data-v-21d91664>`);
        if (primaryPhoto()) {
          _push(`<!--[-->`);
          if (primaryPhoto().preview) {
            _push(`<img${ssrRenderAttr("src", primaryPhoto().preview)}${ssrRenderAttr("alt", primaryPhoto().name)} class="w-full h-full object-cover" data-v-21d91664>`);
          } else {
            _push(`<div class="w-full h-40 flex items-center justify-center text-sm text-gray-500" data-v-21d91664>No preview</div>`);
          }
          if (photoHasExif(primaryPhoto())) {
            _push(`<div class="absolute top-3 left-3 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 z-10" data-v-21d91664><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-v-21d91664><circle cx="12" cy="12" r="3" fill="white" stroke="none" data-v-21d91664></circle></svg> GPS </div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<!--]-->`);
        } else {
          _push(`<div class="w-full h-40 flex items-center justify-center text-sm text-gray-500" data-v-21d91664>No photos uploaded</div>`);
        }
        _push(`</div></div></div><div class="bg-white rounded-lg shadow-sm border border-gray-200 p-2 flex items-center justify-center" data-v-21d91664>`);
        if (fastUploadSession.value.location) {
          _push(`<div class="w-full h-40 rounded-lg overflow-hidden bg-gray-50" data-v-21d91664>`);
          _push(ssrRenderComponent(MiniMap, {
            latitude: fastUploadSession.value.location.latitude,
            longitude: fastUploadSession.value.location.longitude,
            height: "160px",
            zoom: 17,
            class: "w-full h-full"
          }, null, _parent));
          _push(`</div>`);
        } else {
          _push(`<div class="w-full h-40 flex items-center justify-center text-sm text-gray-500" data-v-21d91664>No map available</div>`);
        }
        _push(`</div><div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4" data-v-21d91664>`);
        if (fastUploadSession.value.location) {
          _push(`<div class="text-sm text-gray-700" data-v-21d91664><div class="flex items-center mb-2" data-v-21d91664><strong class="mr-2" data-v-21d91664>Location detected:</strong><span data-v-21d91664>${ssrInterpolate(fastUploadSession.value.location.latitude.toFixed(6))}, ${ssrInterpolate(fastUploadSession.value.location.longitude.toFixed(6))}</span></div>`);
          if (fastUploadSession.value.detectedSources) {
            _push(`<div class="mb-3" data-v-21d91664><div class="flex items-center space-x-2 mb-1" data-v-21d91664><span class="text-xs font-medium" data-v-21d91664>Method:</span><span class="${ssrRenderClass([getLocationMethodStyle(fastUploadSession.value.detectedSources), "text-xs px-2 py-1 rounded-full"])}" data-v-21d91664>${ssrInterpolate(getLocationMethodText(fastUploadSession.value.detectedSources))}</span></div><div class="text-xs text-gray-500" data-v-21d91664>${ssrInterpolate(getLocationMethodDescription(fastUploadSession.value.detectedSources))}</div></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<div class="mt-3" data-v-21d91664><p class="text-sm text-gray-600" data-v-21d91664>If the photo contains GPS in EXIF this is preferred. If not available we may use device GPS.</p></div></div>`);
        } else {
          _push(`<div class="text-sm text-gray-500" data-v-21d91664>Location not detected yet.</div>`);
        }
        _push(`</div></div></div><div class="bg-white border border-gray-200 rounded-lg p-4 mb-6" data-v-21d91664><div class="flex items-start" data-v-21d91664><div class="flex-shrink-0" data-v-21d91664><svg class="w-5 h-5 theme-primary mt-0.5" fill="currentColor" viewBox="0 0 20 20" data-v-21d91664><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" data-v-21d91664></path></svg></div><div class="ml-3" data-v-21d91664><h3 class="text-sm font-medium text-gray-900" data-v-21d91664>What would you like to do?</h3><div class="mt-2 text-sm text-gray-700" data-v-21d91664><p data-v-21d91664><strong data-v-21d91664>Add to existing artwork:</strong> Click on any artwork card below to add your photos as a new logbook entry </p><p data-v-21d91664><strong data-v-21d91664>Create new artwork:</strong> Click &quot;Add New Artwork&quot; if you don&#39;t see a match </p></div></div></div></div>`);
        if (shouldShowExifMissingWarning(fastUploadSession.value.detectedSources)) {
          _push(`<div class="mb-6" data-v-21d91664><div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800" data-v-21d91664> Photo EXIF GPS data not found. Using device GPS instead — encourage users to use photo GPS where available for better accuracy. </div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div class="space-y-6" data-v-21d91664><div class="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-dashed border-green-300 rounded-lg p-6 hover:border-green-400 hover:bg-gradient-to-r hover:from-green-100 hover:to-blue-100 transition-all cursor-pointer" data-v-21d91664><div class="flex items-center justify-center space-x-4" data-v-21d91664><div class="flex-shrink-0" data-v-21d91664><div class="w-12 h-12 theme-success rounded-lg flex items-center justify-center" data-v-21d91664>`);
        _push(ssrRenderComponent(unref(PlusIcon), { class: "w-6 h-6 text-white" }, null, _parent));
        _push(`</div></div><div class="flex-1" data-v-21d91664><h3 class="text-lg font-semibold text-gray-900" data-v-21d91664>Add New Artwork</h3><p class="text-gray-600" data-v-21d91664> Don&#39;t see a match? Create a new artwork entry with your photos </p></div><div class="flex-shrink-0" data-v-21d91664><svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-21d91664><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" data-v-21d91664></path></svg></div></div></div>`);
        if (hasResults.value) {
          _push(`<div data-v-21d91664><h3 class="text-lg font-semibold text-gray-900 mb-4" data-v-21d91664> Nearby Artworks (${ssrInterpolate(unref(searchStore).totalResults)} found) </h3><div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-v-21d91664><!--[-->`);
          ssrRenderList(unref(searchStore).results, (artwork) => {
            _push(ssrRenderComponent(ArtworkCard, {
              key: artwork.id,
              artwork,
              "show-distance": true,
              "show-add-report": isFromFastUpload.value,
              onClick: handleArtworkClick,
              onAddReport: handleAddReport
            }, null, _parent));
          });
          _push(`<!--]--></div></div>`);
        } else if (isLoading.value) {
          _push(`<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-v-21d91664><!--[-->`);
          ssrRenderList(6, (n) => {
            _push(ssrRenderComponent(SkeletonCard, { key: n }, null, _parent));
          });
          _push(`<!--]--></div>`);
        } else if (unref(searchStore).hasSearched) {
          _push(`<div class="text-center py-12" data-v-21d91664><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-21d91664><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" data-v-21d91664></path></svg><h3 class="mt-4 text-lg font-medium text-gray-900" data-v-21d91664>No artworks found nearby</h3><p class="mt-2 text-gray-600" data-v-21d91664> No artworks were found near the detected location. You can create a new artwork entry above. </p></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      } else {
        _push(`<div data-v-21d91664>`);
        if (showSearchTips.value && !isSearchActive.value) {
          _push(`<div class="text-center py-12" data-v-21d91664><div class="mx-auto max-w-md" data-v-21d91664><svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-21d91664><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" data-v-21d91664></path></svg><h2 class="text-lg font-medium text-gray-900 mb-2" data-v-21d91664>Search for Artworks</h2><p class="text-gray-600 mb-6" data-v-21d91664> Discover public art, murals, sculptures, and monuments in your area </p><div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200" data-v-21d91664><h3 class="text-sm font-medium theme-primary mb-2" data-v-21d91664>🏷️ Advanced Tag Search</h3><div class="text-xs theme-primary space-y-1" data-v-21d91664><div data-v-21d91664><strong data-v-21d91664>tag:key</strong> - Find artworks with a specific tag (e.g., <em data-v-21d91664>tag:material</em>) </div><div data-v-21d91664><strong data-v-21d91664>tag:key:value</strong> - Find specific tag values (e.g., <em data-v-21d91664>tag:artist_name:banksy</em>) </div><div data-v-21d91664><strong data-v-21d91664>Mix searches</strong> - Combine text and tags (e.g., <em data-v-21d91664>mural tag:year:2020</em>) </div></div></div><div class="space-y-2 text-sm text-gray-500" data-v-21d91664><p class="font-medium text-gray-700 mb-3" data-v-21d91664>Try searching for:</p><!--[-->`);
          ssrRenderList(searchTips, (tip) => {
            _push(`<div class="text-left" data-v-21d91664><button class="theme-primary hover:underline focus:outline-none focus:underline" data-v-21d91664>${ssrInterpolate(tip)}</button></div>`);
          });
          _push(`<!--]--></div>`);
          if (recentQueries.value.length > 0) {
            _push(`<div class="mt-8" data-v-21d91664><h3 class="text-sm font-medium text-gray-700 mb-3" data-v-21d91664>Recent Searches</h3><div class="flex flex-wrap gap-2 justify-center" data-v-21d91664><!--[-->`);
            ssrRenderList(recentQueries.value.slice(0, 5), (query) => {
              _push(`<button class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200" data-v-21d91664>${ssrInterpolate(query)}</button>`);
            });
            _push(`<!--]--></div></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div>`);
        } else {
          _push(`<!---->`);
        }
        if (isLoading.value && !hasResults.value) {
          _push(`<div class="space-y-6" data-v-21d91664><div class="text-center py-4" data-v-21d91664><p class="text-gray-600" data-v-21d91664>Searching for &quot;${ssrInterpolate(unref(searchStore).query)}&quot;...</p></div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-v-21d91664>`);
          _push(ssrRenderComponent(SkeletonCard, { count: 6 }, null, _parent));
          _push(`</div></div>`);
        } else {
          _push(`<!---->`);
        }
        if (error.value) {
          _push(`<div class="text-center py-12" data-v-21d91664><div class="mx-auto max-w-md" data-v-21d91664><svg class="mx-auto h-12 w-12 theme-error mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-21d91664><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z" data-v-21d91664></path></svg><h2 class="text-lg font-medium text-gray-900 mb-2" data-v-21d91664>Search Error</h2><p class="text-gray-600 mb-4" data-v-21d91664>${ssrInterpolate(error.value)}</p><button class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md theme-primary theme-on-primary focus:outline-none focus:ring-2 focus:ring-offset-2" style="${ssrRenderStyle({ "--tw-ring-color": "var(--md-sys-color-primary)" })}" data-v-21d91664> Try Again </button></div></div>`);
        } else {
          _push(`<!---->`);
        }
        if (showEmptyState.value) {
          _push(`<div class="text-center py-12" data-v-21d91664><div class="mx-auto max-w-md" data-v-21d91664><svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-21d91664><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.438-.896-6.015-2.36L5 13l.707.707A7.962 7.962 0 0012 15z" data-v-21d91664></path></svg><h2 class="text-lg font-medium text-gray-900 mb-2" data-v-21d91664>No artworks found</h2><p class="text-gray-600 mb-4" data-v-21d91664> Try searching with different keywords or check your spelling. </p><div class="space-y-2 text-sm text-gray-500" data-v-21d91664><p data-v-21d91664>Suggestions:</p><ul class="space-y-1" data-v-21d91664><li data-v-21d91664>• Try broader terms like &quot;art&quot; or &quot;mural&quot;</li><li data-v-21d91664>• Check for typos in your search</li><li data-v-21d91664>• Try different artwork types like &quot;sculpture&quot; or &quot;monument&quot;</li></ul></div></div></div>`);
        } else {
          _push(`<!---->`);
        }
        if (hasResults.value) {
          _push(`<div class="space-y-6" data-v-21d91664>`);
          if (currentListFilters.value.length > 0) {
            _push(`<div class="bg-blue-50 border border-blue-200 rounded-lg p-3" data-v-21d91664><div class="flex items-center" data-v-21d91664><svg class="w-5 h-5 theme-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-21d91664><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" data-v-21d91664></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v0a2 2 0 01-2 2H10a2 2 0 01-2-2v0z" data-v-21d91664></path></svg><span class="text-sm font-medium theme-primary" data-v-21d91664> Filtering by ${ssrInterpolate(currentListFilters.value[0] ? unref(formatListFilter)(currentListFilters.value[0]) : "Unknown List")} `);
            if (baseQuery.value) {
              _push(`<span class="theme-primary" data-v-21d91664> · Search: &quot;${ssrInterpolate(baseQuery.value)}&quot;</span>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</span></div></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<div class="flex items-center justify-between" data-v-21d91664><h2 class="text-lg font-medium text-gray-900" data-v-21d91664>${ssrInterpolate(filteredTotal.value)} of ${ssrInterpolate(unref(searchStore).total)} ${ssrInterpolate(unref(searchStore).total === 1 ? "artwork" : "artworks")} shown `);
          if (unref(searchStore).query) {
            _push(`<span class="text-gray-600" data-v-21d91664>for &quot;${ssrInterpolate(unref(searchStore).query)}&quot;</span>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</h2>`);
          if (unref(searchStore).query) {
            _push(`<button class="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline" data-v-21d91664> Clear search </button>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div><div class="bg-white border border-gray-200 rounded-lg p-4" data-v-21d91664>`);
          _push(ssrRenderComponent(_sfc_main$2, {
            title: "Filter by Artwork Type",
            description: "Select which types of artworks to show in search results",
            columns: 3,
            compact: false,
            collapsible: true,
            "default-collapsed": true,
            "show-control-buttons": true
          }, null, _parent));
          _push(`</div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-v-21d91664><!--[-->`);
          ssrRenderList(filteredResults.value, (artwork) => {
            _push(ssrRenderComponent(ArtworkCard, {
              key: artwork.id,
              artwork,
              "show-distance": false,
              "show-add-report": isFromFastUpload.value,
              onClick: handleArtworkClick,
              onAddReport: handleAddReport
            }, null, _parent));
          });
          _push(`<!--]-->`);
          if (isLoading.value && hasResults.value) {
            _push(ssrRenderComponent(SkeletonCard, { count: 3 }, null, _parent));
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
          if (unref(searchStore).canLoadMore) {
            _push(`<div class="text-center py-4" data-v-21d91664>`);
            if (isLoading.value) {
              _push(`<div class="text-gray-600" data-v-21d91664>Loading more artworks...</div>`);
            } else {
              _push(`<button class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" data-v-21d91664> Load More Artworks </button>`);
            }
            _push(`</div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      }
      _push(`</div></div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/SearchView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const SearchView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-21d91664"]]);

export { SearchView as default };
//# sourceMappingURL=SearchView-ClibZB0Q.js.map
