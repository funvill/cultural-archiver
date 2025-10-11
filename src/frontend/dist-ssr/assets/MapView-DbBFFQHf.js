import { ref, computed, reactive, watch, defineComponent, onMounted, onUnmounted, mergeProps, unref, useSSRContext, nextTick, toRaw, createApp } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderClass, ssrIncludeBooleanAttr, ssrRenderList, ssrRenderStyle, ssrInterpolate, ssrRenderAttr, ssrLooseContain } from 'vue/server-renderer';
import { useRouter, useRoute } from 'vue-router';
import { XMarkIcon, ExclamationTriangleIcon, Squares2X2Icon, PlusIcon, MinusIcon, ExclamationCircleIcon, AdjustmentsHorizontalIcon as AdjustmentsHorizontalIcon$1, QuestionMarkCircleIcon } from '@heroicons/vue/24/outline';
import { UserIcon, AdjustmentsHorizontalIcon } from '@heroicons/vue/24/solid';
/* empty css                 */
import { u as useArtworksStore } from './artworks-EQolhOHu.js';
import { u as useArtworkTypeFilters } from './useArtworkTypeFilters-BIVqZddm.js';
import { u as useUserLists } from './useUserLists-CYQ0cJyO.js';
import { i as isClient, c as canUseLocalStorage, d as useAuthStore, _ as _export_sfc, e as createLogger, F as FirstTimeModal, a as apiService } from '../ssr-entry-server.js';
import { defineStore } from 'pinia';
import { Deck } from '@deck.gl/core';
import { ScatterplotLayer, TextLayer, IconLayer } from '@deck.gl/layers';
import Supercluster from 'supercluster';
import { u as useToasts } from './useToasts-PudGFTbq.js';
import { A as ArtworkCard } from './ArtworkCard-0An4ZMhk.js';
import '@vue/server-renderer';
import '@vueuse/head';
import 'exifr';
import './image-CoH3F98X.js';

const DEFAULT_ARTWORK_TYPES = [
  { key: "sculpture", label: "Sculpture", color: "#3B82F6", enabled: true },
  { key: "mural", label: "Mural", color: "#EF4444", enabled: true },
  { key: "installation", label: "Installation", color: "#10B981", enabled: true },
  { key: "monument", label: "Monument", color: "#F59E0B", enabled: true },
  { key: "graffiti", label: "Graffiti", color: "#8B5CF6", enabled: true },
  { key: "mosaic", label: "Mosaic", color: "#06B6D4", enabled: true },
  { key: "fountain", label: "Fountain", color: "#84CC16", enabled: true },
  { key: "statue", label: "Statue", color: "#F97316", enabled: true },
  { key: "poster", label: "Poster", color: "#EC4899", enabled: true },
  { key: "sign", label: "Sign", color: "#6B7280", enabled: true },
  { key: "other", label: "Other", color: "#64748B", enabled: true }
];
const DEFAULT_STATUS_FILTERS = {
  approved: true,
  pending: false,
  rejected: false
};
let globalFiltersState = reactive({
  artworkTypes: DEFAULT_ARTWORK_TYPES.map((type) => ({ ...type })),
  statusFilters: { ...DEFAULT_STATUS_FILTERS },
  userListFilters: [],
  showOnlyMySubmissions: false,
  hideVisited: false,
  showRemoved: false,
  showArtworksWithoutPhotos: false
});
let isInitialized = false;
function useMapFilters() {
  const userLists = useUserLists();
  const filterPresetsRef = ref([]);
  const recentlyUsedFiltersRef = ref([]);
  const filterMetrics = ref({
    sessionDuration: 0,
    totalFilterApplications: 0,
    cacheHitRate: 0,
    mostUsedFilter: null
  });
  const refreshTriggerRef = { value: 0 };
  if (!isInitialized) {
    if (isClient && canUseLocalStorage()) {
      try {
        loadFiltersFromStorage();
      } catch (e) {
      }
    }
    isInitialized = true;
  }
  const hasActiveFilters = computed(() => {
    const someTypesDisabled = globalFiltersState.artworkTypes.some((type) => !type.enabled);
    const nonDefaultStatus = !globalFiltersState.statusFilters.approved || globalFiltersState.statusFilters.pending || globalFiltersState.statusFilters.rejected;
    const userListFiltersActive = globalFiltersState.userListFilters.some((filter) => filter.enabled);
    const showingOnlyMySubmissions = globalFiltersState.showOnlyMySubmissions;
    const hideVisitedActive = globalFiltersState.hideVisited;
    const showRemovedActive = globalFiltersState.showRemoved;
    const showArtworksWithoutPhotosActive = globalFiltersState.showArtworksWithoutPhotos;
    return someTypesDisabled || nonDefaultStatus || userListFiltersActive || showingOnlyMySubmissions || hideVisitedActive || showRemovedActive || showArtworksWithoutPhotosActive;
  });
  const activeFilterCount = computed(() => {
    let count = 0;
    count += globalFiltersState.artworkTypes.filter((type) => !type.enabled).length;
    if (!globalFiltersState.statusFilters.approved) count++;
    if (globalFiltersState.statusFilters.pending) count++;
    if (globalFiltersState.statusFilters.rejected) count++;
    count += globalFiltersState.userListFilters.filter((filter) => filter.enabled).length;
    if (globalFiltersState.showOnlyMySubmissions) count++;
    if (globalFiltersState.hideVisited) count++;
    if (globalFiltersState.showRemoved) count++;
    if (globalFiltersState.showArtworksWithoutPhotos) count++;
    return count;
  });
  const activeFilterDescription = computed(() => {
    if (!hasActiveFilters.value) return "No filters active";
    const parts = [];
    const disabledTypes = globalFiltersState.artworkTypes.filter((type) => !type.enabled);
    if (disabledTypes.length > 0) {
      parts.push(`${disabledTypes.length} type${disabledTypes.length !== 1 ? "s" : ""} hidden`);
    }
    const enabledUserLists = globalFiltersState.userListFilters.filter((filter) => filter.enabled);
    if (enabledUserLists.length > 0) {
      parts.push(`${enabledUserLists.length} list${enabledUserLists.length !== 1 ? "s" : ""} active`);
    }
    if (globalFiltersState.showOnlyMySubmissions) {
      parts.push("only my submissions");
    }
    if (globalFiltersState.hideVisited) {
      parts.push("hiding visited artworks");
    }
    if (globalFiltersState.showRemoved) {
      parts.push("including removed artworks");
    }
    if (globalFiltersState.showArtworksWithoutPhotos) {
      parts.push("including artworks without photos");
    }
    if (!globalFiltersState.statusFilters.approved || globalFiltersState.statusFilters.pending || globalFiltersState.statusFilters.rejected) {
      parts.push("custom status filters");
    }
    if (parts.length === 0) {
      const c = activeFilterCount?.value ?? 0;
      return `${c} filter${c === 1 ? "" : "s"} active`;
    }
    return parts.join(", ");
  });
  function loadFiltersFromStorage() {
    try {
      if (!canUseLocalStorage()) return;
      const saved = localStorage.getItem("mapFilters:state");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.artworkTypes) {
          DEFAULT_ARTWORK_TYPES.forEach((defaultType) => {
            const existingType = parsed.artworkTypes.find((t) => t.key === defaultType.key);
            if (existingType) {
              const stateType = globalFiltersState.artworkTypes.find((t) => t.key === defaultType.key);
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
        if (typeof parsed.showOnlyMySubmissions === "boolean") {
          globalFiltersState.showOnlyMySubmissions = parsed.showOnlyMySubmissions;
        }
        if (typeof parsed.hideVisited === "boolean") {
          globalFiltersState.hideVisited = parsed.hideVisited;
        }
        if (typeof parsed.showRemoved === "boolean") {
          globalFiltersState.showRemoved = parsed.showRemoved;
        }
        if (typeof parsed.showArtworksWithoutPhotos === "boolean") {
          globalFiltersState.showArtworksWithoutPhotos = parsed.showArtworksWithoutPhotos;
        }
      }
    } catch (error) {
      console.warn("Failed to load map filters from storage:", error);
    }
  }
  function saveFiltersToStorage() {
    try {
      if (!canUseLocalStorage()) return;
      localStorage.setItem("mapFilters:state", JSON.stringify(globalFiltersState));
      refreshTriggerRef.value += 1;
    } catch (error) {
      console.warn("Failed to save map filters to storage:", error);
    }
  }
  function resetFilters() {
    globalFiltersState.artworkTypes.forEach((type) => {
      type.enabled = true;
    });
    Object.assign(globalFiltersState.statusFilters, DEFAULT_STATUS_FILTERS);
    globalFiltersState.userListFilters.forEach((filter) => {
      filter.enabled = false;
    });
    globalFiltersState.showOnlyMySubmissions = false;
    globalFiltersState.hideVisited = false;
    globalFiltersState.showRemoved = false;
    globalFiltersState.showArtworksWithoutPhotos = false;
    saveFiltersToStorage();
  }
  function toggleArtworkType(typeKey) {
    const type = globalFiltersState.artworkTypes.find((t) => t.key === typeKey);
    if (type) {
      type.enabled = !type.enabled;
      saveFiltersToStorage();
    }
  }
  function setAllArtworkTypes(enabled) {
    globalFiltersState.artworkTypes.forEach((type) => {
      type.enabled = enabled;
    });
    saveFiltersToStorage();
  }
  function toggleStatusFilter(status) {
    globalFiltersState.statusFilters[status] = !globalFiltersState.statusFilters[status];
    saveFiltersToStorage();
  }
  function toggleUserListFilter(listId) {
    const filter = globalFiltersState.userListFilters.find((f) => f.listId === listId);
    if (filter) {
      filter.enabled = !filter.enabled;
      saveFiltersToStorage();
    }
  }
  function toggleShowOnlyMySubmissions() {
    globalFiltersState.showOnlyMySubmissions = !globalFiltersState.showOnlyMySubmissions;
    saveFiltersToStorage();
  }
  function toggleHideVisited() {
    globalFiltersState.hideVisited = !globalFiltersState.hideVisited;
    saveFiltersToStorage();
  }
  function toggleShowRemoved() {
    globalFiltersState.showRemoved = !globalFiltersState.showRemoved;
    saveFiltersToStorage();
  }
  function toggleShowArtworksWithoutPhotos() {
    globalFiltersState.showArtworksWithoutPhotos = !globalFiltersState.showArtworksWithoutPhotos;
    saveFiltersToStorage();
  }
  async function syncUserLists() {
    try {
      await userLists.fetchUserLists();
      userLists.lists.value.forEach((list) => {
        const existing = globalFiltersState.userListFilters.find((f) => f.listId === list.id);
        if (!existing) {
          globalFiltersState.userListFilters.push({
            listId: list.id,
            name: list.name,
            enabled: false
          });
        } else {
          existing.name = list.name;
        }
      });
      globalFiltersState.userListFilters = globalFiltersState.userListFilters.filter(
        (filter) => userLists.lists.value.some((list) => list.id === filter.listId)
      );
      saveFiltersToStorage();
    } catch (error) {
      console.warn("Failed to sync user lists with filters:", error);
    }
  }
  async function loadUserLists() {
    await syncUserLists();
  }
  function isFilterEnabled(filterKey) {
    if (filterKey === "wantToSee") return !!globalFiltersState.wantToSee;
    if (filterKey === "notSeenByMe") return !!globalFiltersState.notSeenByMe;
    if (filterKey.startsWith("list:")) {
      const id = filterKey.replace("list:", "");
      const f = globalFiltersState.userListFilters.find((u) => u.listId === id);
      return !!f?.enabled;
    }
    return false;
  }
  function toggleWantToSee() {
    globalFiltersState.wantToSee = !globalFiltersState.wantToSee;
    refreshTriggerRef.value += 1;
    saveFiltersToStorage();
  }
  function toggleNotSeenByMe() {
    globalFiltersState.notSeenByMe = !globalFiltersState.notSeenByMe;
    refreshTriggerRef.value += 1;
    saveFiltersToStorage();
  }
  function toggleUserList(listId) {
    toggleUserListFilter(listId);
  }
  function createPreset(name, note) {
    try {
      const key = "mapFilters:presets";
      if (canUseLocalStorage()) {
        const raw = localStorage.getItem(key);
        const existing = raw ? JSON.parse(raw) : [];
        existing.push({ id: Date.now().toString(), name, note, state: { ...globalFiltersState } });
        localStorage.setItem(key, JSON.stringify(existing));
      } else {
        filterPresetsRef.value.push({ id: Date.now().toString(), name, note, state: { ...globalFiltersState } });
      }
      refreshTriggerRef.value += 1;
    } catch (e) {
      console.warn("Failed to create preset", e);
    }
  }
  function applyPreset(id) {
    try {
      const key = "mapFilters:presets";
      let existing = [];
      if (canUseLocalStorage()) {
        const raw = localStorage.getItem(key);
        existing = raw ? JSON.parse(raw) : [];
      } else {
        existing = filterPresetsRef.value.slice();
      }
      const p = existing.find((x) => x.id === id);
      if (p && p.state) {
        Object.assign(globalFiltersState, p.state);
        saveFiltersToStorage();
      }
    } catch (e) {
      console.warn("Failed to apply preset", e);
    }
  }
  function deletePreset(id) {
    try {
      const key = "mapFilters:presets";
      if (canUseLocalStorage()) {
        const raw = localStorage.getItem(key);
        const existing = raw ? JSON.parse(raw) : [];
        const filtered = existing.filter((x) => x.id !== id);
        localStorage.setItem(key, JSON.stringify(filtered));
      } else {
        filterPresetsRef.value = filterPresetsRef.value.filter((x) => x.id !== id);
      }
    } catch (e) {
      console.warn("Failed to delete preset", e);
    }
  }
  function exportFilters() {
    try {
      return JSON.stringify(globalFiltersState);
    } catch (e) {
      return "";
    }
  }
  function importFilters(content) {
    try {
      const parsed = JSON.parse(content);
      if (parsed) {
        if (parsed.artworkTypes) {
          parsed.artworkTypes.forEach((t) => {
            const existing = globalFiltersState.artworkTypes.find((a) => a.key === t.key);
            if (existing && typeof t.enabled === "boolean") existing.enabled = t.enabled;
          });
        }
        if (parsed.statusFilters) Object.assign(globalFiltersState.statusFilters, parsed.statusFilters);
        if (Array.isArray(parsed.userListFilters)) globalFiltersState.userListFilters = parsed.userListFilters;
        if (typeof parsed.wantToSee === "boolean") globalFiltersState.wantToSee = parsed.wantToSee;
        if (typeof parsed.notSeenByMe === "boolean") globalFiltersState.notSeenByMe = parsed.notSeenByMe;
        saveFiltersToStorage();
        return true;
      }
    } catch (e) {
      console.warn("Failed to import filters", e);
    }
    return false;
  }
  async function applyFilters(artworks) {
    filterMetrics.value = { ...filterMetrics.value, totalFilterApplications: (filterMetrics.value.totalFilterApplications || 0) + 1 };
    const result = artworks.filter((a) => {
      const af = a;
      if (!shouldShowArtwork(af)) return false;
      if (globalFiltersState.wantToSee && af.want_to_see === false) return false;
      if (globalFiltersState.notSeenByMe) {
        const visited = userLists.isArtworkInList(a.id, "visited");
        if (visited) return false;
      }
      return true;
    });
    return result;
  }
  function shouldShowArtwork(artwork) {
    const artworkTypeKey = artwork.artwork_type || artwork.type;
    const typeEnabled = globalFiltersState.artworkTypes.find((type) => type.key === artworkTypeKey)?.enabled ?? true;
    if (!typeEnabled) return false;
    if (!globalFiltersState.showArtworksWithoutPhotos) {
      const hasPhotos = Array.isArray(artwork.photos) && artwork.photos.length > 0 || Boolean(artwork.recent_photo) || typeof artwork.photo_count === "number" && artwork.photo_count > 0 || typeof artwork.photoCount === "number" && artwork.photoCount > 0 || Array.isArray(artwork.photos) && artwork.photos.length > 0;
      if (!hasPhotos) return false;
    }
    if (globalFiltersState.hideVisited) {
      const isVisited = userLists.isArtworkInList(artwork.id, "visited");
      if (isVisited) return false;
    }
    const status = artwork.status || "approved";
    if (!globalFiltersState.showRemoved && status === "unknown") {
      return false;
    }
    if (status === "pending" && !globalFiltersState.statusFilters.pending) return false;
    if (status === "rejected" && !globalFiltersState.statusFilters.rejected) return false;
    const enabledUserLists = globalFiltersState.userListFilters.filter((f) => f.enabled);
    if (enabledUserLists.length > 0) {
      const isInEnabledList = enabledUserLists.some((filter) => {
        const list = userLists.lists.value.find((l) => l.id === filter.listId);
        if (!list) return false;
        if (list.name === "Visited") {
          return userLists.isArtworkInList(artwork.id, "visited");
        } else if (list.name === "Starred") {
          return userLists.isArtworkInList(artwork.id, "starred");
        } else if (list.name === "Loved") {
          return userLists.isArtworkInList(artwork.id, "loved");
        }
        return false;
      });
      if (!isInEnabledList) return false;
    }
    if (globalFiltersState.showOnlyMySubmissions) ;
    return true;
  }
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
      ...globalFiltersState
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
    applyFilters
    // keep original storage functions present (also returned above)
  };
}

const CLUSTERING_STORAGE_KEY = "map_clustering_enabled";
const useMapSettings = defineStore("mapSettings", () => {
  const clusteringEnabled = ref(true);
  function initializeSettings() {
    if (!canUseLocalStorage()) {
      console.log("[MAP DIAGNOSTIC] localStorage unavailable; skipping map settings initialization");
      return;
    }
    const saved = localStorage.getItem(CLUSTERING_STORAGE_KEY);
    if (saved !== null) {
      clusteringEnabled.value = saved === "true";
      console.log("[MAP DIAGNOSTIC] Clustering setting loaded from localStorage:", clusteringEnabled.value);
    } else {
      console.log("[MAP DIAGNOSTIC] No saved clustering setting, using default:", clusteringEnabled.value);
    }
  }
  function toggleClustering() {
    clusteringEnabled.value = !clusteringEnabled.value;
    if (canUseLocalStorage()) {
      try {
        localStorage.setItem(CLUSTERING_STORAGE_KEY, String(clusteringEnabled.value));
      } catch (e) {
        console.warn("[MAP DIAGNOSTIC] Failed to persist clustering setting:", e);
      }
    }
    console.log("[MAP DIAGNOSTIC] Clustering toggled to:", clusteringEnabled.value);
  }
  function setClusteringEnabled(enabled) {
    clusteringEnabled.value = enabled;
    if (canUseLocalStorage()) {
      try {
        localStorage.setItem(CLUSTERING_STORAGE_KEY, String(enabled));
      } catch (e) {
        console.warn("[MAP DIAGNOSTIC] Failed to persist clustering setting:", e);
      }
    }
    console.log("[MAP DIAGNOSTIC] Clustering set to:", enabled);
  }
  return {
    clusteringEnabled,
    toggleClustering,
    setClusteringEnabled,
    initializeSettings
  };
});

const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "MapOptionsModal",
  __ssrInlineRender: true,
  props: {
    isOpen: { type: Boolean }
  },
  emits: ["update:isOpen", "applySettings"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const mapFilters = useMapFilters();
    const authStore = useAuthStore();
    const mapSettings = useMapSettings();
    const isAuthenticated = computed(() => authStore.isAuthenticated);
    function closeModal() {
      emit("update:isOpen", false);
    }
    function handleKeydown(event) {
      if (event.key === "Escape" && props.isOpen) {
        closeModal();
      }
    }
    onMounted(() => {
      document.addEventListener("keydown", handleKeydown);
      console.log("[MAP DIAGNOSTIC] MapOptionsModal mounted, clustering enabled:", mapSettings.clusteringEnabled);
    });
    onUnmounted(() => {
      document.removeEventListener("keydown", handleKeydown);
    });
    watch(() => props.isOpen, (newVal) => {
      if (newVal) {
        console.log("[MAP DIAGNOSTIC] Map Options Modal opened, current clustering state:", mapSettings.clusteringEnabled);
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      if (_ctx.isOpen) {
        _push(`<div${ssrRenderAttrs(mergeProps({ class: "fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50 flex items-center justify-center" }, _attrs))} data-v-fc639317><div class="bg-white w-full h-full max-w-full max-h-full flex flex-col md:w-[90vw] md:h-[90vh] md:max-w-4xl md:rounded-lg md:shadow-xl" data-v-fc639317><div class="px-6 py-4 border-b border-gray-200 flex-shrink-0" data-v-fc639317><div class="flex items-center justify-between" data-v-fc639317><h2 class="text-lg font-semibold text-gray-900" data-v-fc639317>Map Options</h2><div class="flex items-center space-x-2" data-v-fc639317><button class="text-sm text-red-600 hover:text-red-700 focus:ring-2 focus:ring-red-500 px-3 py-1 rounded transition-colors" data-v-fc639317> Clear All Filters </button><button class="p-2 hover:bg-gray-200 rounded-full transition-colors" aria-label="Close settings" data-v-fc639317>`);
        _push(ssrRenderComponent(unref(XMarkIcon), { class: "h-6 w-6 text-gray-500" }, null, _parent));
        _push(`</button></div></div></div><div class="flex-1 overflow-y-auto p-6 space-y-8" data-v-fc639317>`);
        if (isAuthenticated.value) {
          _push(`<div data-v-fc639317><h3 class="text-base font-semibold text-gray-900 mb-4 flex items-center" data-v-fc639317><svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-fc639317><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" data-v-fc639317></path></svg> Filters </h3><div class="space-y-4" data-v-fc639317><div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg" data-v-fc639317><label class="relative inline-flex items-center cursor-pointer" data-v-fc639317><input type="checkbox"${ssrIncludeBooleanAttr(unref(mapFilters).filtersState.hideVisited) ? " checked" : ""} class="sr-only peer" data-v-fc639317><div class="${ssrRenderClass([unref(mapFilters).filtersState.hideVisited ? "bg-blue-600 border-blue-600 shadow-md" : "bg-gray-100 border-gray-300 shadow-inner", "w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2 cursor-pointer"])}" data-v-fc639317><div class="${ssrRenderClass([unref(mapFilters).filtersState.hideVisited ? "translate-x-5 bg-white" : "translate-x-0 bg-gray-50", "dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200 pointer-events-none"])}" data-v-fc639317></div></div></label><div class="flex-1" data-v-fc639317><div class="flex items-center" data-v-fc639317><span class="text-sm font-medium text-gray-900" data-v-fc639317>Hide visited artworks</span></div><p class="text-xs mt-1 text-gray-600" data-v-fc639317> Hide artworks that you have marked as visited from the map display. </p></div></div><div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg" data-v-fc639317><label class="relative inline-flex items-center cursor-pointer" data-v-fc639317><input type="checkbox"${ssrIncludeBooleanAttr(unref(mapFilters).filtersState.showArtworksWithoutPhotos) ? " checked" : ""} class="sr-only peer" data-v-fc639317><div class="${ssrRenderClass([unref(mapFilters).filtersState.showArtworksWithoutPhotos ? "bg-blue-600 border-blue-600 shadow-md" : "bg-gray-100 border-gray-300 shadow-inner", "w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2 cursor-pointer"])}" data-v-fc639317><div class="${ssrRenderClass([unref(mapFilters).filtersState.showArtworksWithoutPhotos ? "translate-x-5 bg-white" : "translate-x-0 bg-gray-50", "dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200 pointer-events-none"])}" data-v-fc639317></div></div></label><div class="flex-1" data-v-fc639317><div class="flex items-center" data-v-fc639317><span class="text-sm font-medium text-gray-900" data-v-fc639317>Show artworks without photos</span></div><p class="text-xs mt-1 text-gray-600" data-v-fc639317> When off, artworks that do not have photos yet are hidden from the map. </p></div></div><div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg" data-v-fc639317><label class="relative inline-flex items-center cursor-pointer" data-v-fc639317><input type="checkbox"${ssrIncludeBooleanAttr(unref(mapFilters).filtersState.showRemoved) ? " checked" : ""} class="sr-only peer" data-v-fc639317><div class="${ssrRenderClass([unref(mapFilters).filtersState.showRemoved ? "bg-blue-600 border-blue-600 shadow-md" : "bg-gray-100 border-gray-300 shadow-inner", "w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2 cursor-pointer"])}" data-v-fc639317><div class="${ssrRenderClass([unref(mapFilters).filtersState.showRemoved ? "translate-x-5 bg-white" : "translate-x-0 bg-gray-50", "dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200 pointer-events-none"])}" data-v-fc639317></div></div></label><div class="flex-1" data-v-fc639317><div class="flex items-center" data-v-fc639317><span class="text-sm font-medium text-gray-900" data-v-fc639317>Show removed artworks</span></div><p class="text-xs mt-1 text-gray-600" data-v-fc639317> Include artworks that have been removed or are of unknown status. </p></div></div></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div data-v-fc639317><h3 class="text-base font-semibold text-gray-900 mb-4 flex items-center" data-v-fc639317><svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-fc639317><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" data-v-fc639317></path></svg> Display Options </h3><div class="space-y-4" data-v-fc639317><div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg" data-v-fc639317><label class="relative inline-flex items-center cursor-pointer" data-v-fc639317><input type="checkbox"${ssrIncludeBooleanAttr(unref(mapSettings).clusteringEnabled) ? " checked" : ""} class="sr-only peer" data-v-fc639317><div class="${ssrRenderClass([unref(mapSettings).clusteringEnabled ? "bg-blue-600 border-blue-600 shadow-md" : "bg-gray-100 border-gray-300 shadow-inner", "w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2 cursor-pointer"])}" data-v-fc639317><div class="${ssrRenderClass([unref(mapSettings).clusteringEnabled ? "translate-x-5 bg-white" : "translate-x-0 bg-gray-50", "dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200 pointer-events-none"])}" data-v-fc639317></div></div></label><div class="flex-1" data-v-fc639317><div class="flex items-center" data-v-fc639317><span class="text-sm font-medium text-gray-900" data-v-fc639317>Enable Marker Clustering</span></div><p class="text-xs mt-1 text-gray-600" data-v-fc639317> Group nearby artworks into numbered clusters at higher zoom levels (zoom &gt; 14). </p></div></div></div></div><div data-v-fc639317><h3 class="text-base font-semibold text-gray-900 mb-4 flex items-center" data-v-fc639317><svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-fc639317><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" data-v-fc639317></path></svg> Artwork Types </h3><p class="text-sm text-gray-600 mb-4" data-v-fc639317> Select which types of artworks to display on the map. Each colored circle shows the marker color used. </p><div class="flex gap-2 mb-4" data-v-fc639317><button class="text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors" data-v-fc639317> Enable All </button><button class="text-sm bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 transition-colors" data-v-fc639317> Disable All </button></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-v-fc639317><!--[-->`);
        ssrRenderList(unref(mapFilters).filtersState.artworkTypes, (artworkType) => {
          _push(`<div class="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" data-v-fc639317><label class="relative inline-flex items-center cursor-pointer" data-v-fc639317><input type="checkbox"${ssrIncludeBooleanAttr(artworkType.enabled) ? " checked" : ""} class="sr-only peer" data-v-fc639317><div class="${ssrRenderClass([artworkType.enabled ? "bg-blue-600 border-blue-600 shadow-md" : "bg-gray-100 border-gray-300 shadow-inner", "w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2"])}" data-v-fc639317><div class="${ssrRenderClass([artworkType.enabled ? "translate-x-5 bg-white" : "translate-x-0 bg-gray-50", "dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200"])}" data-v-fc639317></div></div></label><div class="ml-3 flex items-center min-w-0 flex-1" data-v-fc639317><span class="inline-block w-4 h-4 rounded-full mr-2 border border-white shadow-sm flex-shrink-0" style="${ssrRenderStyle({ backgroundColor: artworkType.color })}" data-v-fc639317></span><span class="truncate text-sm text-gray-700" data-v-fc639317>${ssrInterpolate(artworkType.label)}</span></div></div>`);
        });
        _push(`<!--]--></div></div>`);
        if (!isAuthenticated.value) {
          _push(`<div class="text-center py-8" data-v-fc639317><div class="bg-amber-50 border border-amber-200 rounded-lg p-6" data-v-fc639317><svg class="w-12 h-12 text-amber-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-fc639317><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" data-v-fc639317></path></svg><p class="text-amber-800 font-medium mb-2" data-v-fc639317>Sign In Required</p><p class="text-sm text-amber-700" data-v-fc639317> Sign in to access filtering options for visited and removed artworks. </p></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex-shrink-0" data-v-fc639317><div class="flex justify-between items-center" data-v-fc639317><div class="text-sm text-gray-500" data-v-fc639317>${ssrInterpolate(unref(mapFilters).hasActiveFilters.value ? "Filters will be applied to map display" : "No filters currently active")}</div><div class="flex space-x-3" data-v-fc639317><button class="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 transition-colors" data-v-fc639317> Cancel </button><button class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors" data-v-fc639317> Apply Settings </button></div></div></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
    };
  }
});

const _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/MapOptionsModal.vue");
  return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
const MapOptionsModal = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-fc639317"]]);

const useMapPreviewStore = defineStore("mapPreview", () => {
  const currentPreview = ref(null);
  const isVisible = ref(false);
  const debounceTimer = ref(null);
  const hasPreview = computed(() => !!currentPreview.value);
  function showPreview(preview) {
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value);
      debounceTimer.value = null;
    }
    debounceTimer.value = setTimeout(() => {
      currentPreview.value = preview;
      isVisible.value = true;
      debounceTimer.value = null;
    }, 80);
  }
  function hidePreview() {
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value);
      debounceTimer.value = null;
    }
    isVisible.value = false;
    setTimeout(() => {
      if (!isVisible.value) {
        currentPreview.value = null;
      }
    }, 300);
  }
  function updatePreview(preview) {
    currentPreview.value = preview;
    isVisible.value = true;
  }
  function clearPreview() {
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value);
      debounceTimer.value = null;
    }
    currentPreview.value = null;
    isVisible.value = false;
  }
  return {
    // State
    currentPreview,
    isVisible,
    // Computed
    hasPreview,
    // Actions
    showPreview,
    hidePreview,
    updatePreview,
    clearPreview
  };
});

const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "MapWebGLLayer",
  __ssrInlineRender: true,
  props: {
    map: {},
    clusters: {},
    iconAtlas: {},
    visible: { type: Boolean, default: true }
  },
  emits: ["markerClick", "clusterClick"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const log = createLogger({ module: "frontend:MapWebGLLayer" });
    const containerRef = ref();
    const deck = ref(null);
    function initDeck() {
      if (!isClient || !containerRef.value || !props.map) return;
      const mapContainer = props.map.getContainer();
      const canvas = document.createElement("canvas");
      canvas.id = "deck-canvas";
      canvas.style.position = "absolute";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "400";
      try {
        mapContainer.appendChild(canvas);
      } catch (e) {
      }
      deck.value = new Deck({
        canvas,
        initialViewState: getLeafletViewState(),
        controller: false,
        // Leaflet handles all interactions
        layers: []
      });
      try {
        const container = props.map.getContainer();
        const handleMove = (ev) => {
          if (!deck.value) return;
          try {
            const rect = container.getBoundingClientRect();
            const x = ev.clientX - rect.left;
            const y = ev.clientY - rect.top;
            const pickInfo = deck.value.pickObject({ x, y });
            if (pickInfo && pickInfo.object) {
              container.style.cursor = "pointer";
            } else {
              container.style.cursor = "";
            }
          } catch (e) {
          }
        };
        const handleClick = (ev) => {
          if (!deck.value) return;
          try {
            const rect = container.getBoundingClientRect();
            const x = ev.clientX - rect.left;
            const y = ev.clientY - rect.top;
            const pickInfo = deck.value.pickObject({ x, y });
            if (pickInfo && pickInfo.object) {
              const obj = pickInfo.object;
              if (obj.properties && obj.properties.cluster) {
                emit("clusterClick", obj);
              } else {
                emit("markerClick", obj);
              }
            }
          } catch (e) {
          }
        };
        try {
          container.addEventListener("mousemove", handleMove);
          container.addEventListener("click", handleClick);
        } catch (e) {
        }
        const removeHandlers = () => {
          try {
            container.removeEventListener("mousemove", handleMove);
          } catch {
          }
          try {
            container.removeEventListener("click", handleClick);
          } catch {
          }
        };
        deck.value._ca_containerHandlers = removeHandlers;
      } catch (e) {
      }
      syncViewport();
    }
    function getLeafletViewState() {
      if (!props.map) return { longitude: 0, latitude: 0, zoom: 0 };
      const center = props.map.getCenter();
      const zoom = props.map.getZoom();
      return {
        longitude: center.lng,
        latitude: center.lat,
        zoom: zoom - 1,
        // deck.gl zoom is offset by 1 from Leaflet
        pitch: 0,
        bearing: 0
      };
    }
    function syncViewport() {
      if (!props.map || !deck.value) return;
      const handleViewportChange = () => {
        if (!deck.value) return;
        deck.value.setProps({
          viewState: getLeafletViewState()
        });
      };
      props.map.on("move", handleViewportChange);
      props.map.on("zoom", handleViewportChange);
      props.map.on("zoomend", handleViewportChange);
      handleViewportChange();
    }
    function updateLayers() {
      if (!deck.value) return;
      const colorMap = {
        sculpture: [244, 63, 94],
        // red-500
        mural: [59, 130, 246],
        // blue-500
        installation: [168, 85, 247],
        // purple-500
        default: [107, 114, 128]
        // gray-500
      };
      const rawClusters = toRaw(props.clusters || []);
      let rawClone = [];
      try {
        rawClone = JSON.parse(JSON.stringify(rawClusters));
      } catch (e) {
        rawClone = rawClusters.map((c) => ({ ...c }));
      }
      const clustersDataPlain = rawClone.map((c) => ({
        type: c.type,
        id: c.id,
        properties: { ...c.properties || {} },
        geometry: { type: c.geometry?.type || "Point", coordinates: [c.geometry?.coordinates?.[0], c.geometry?.coordinates?.[1]] }
      }));
      const scatterDataPlain = clustersDataPlain.slice();
      const scatterUpdateKey = scatterDataPlain.map((d) => d.id).join("|");
      const clusterData = clustersDataPlain.filter((d) => d.properties && d.properties.cluster).slice();
      const clusterUpdateKey = clusterData.map((d) => d.id).join("|");
      const currentZoomPlain = props.map ? props.map.getZoom() : 0;
      const finalScatter = new ScatterplotLayer({
        id: "artwork-clusters",
        data: scatterDataPlain.slice(),
        pickable: true,
        opacity: 0.8,
        stroked: true,
        filled: true,
        // Render radii in screen pixels so we can use pixel-based cluster radii
        radiusUnits: "pixels",
        radiusScale: 1,
        radiusMinPixels: 10,
        // Minimum marker size for mobile
        radiusMaxPixels: 500,
        // Increased maximum so very large clusters can fit labels
        lineWidthMinPixels: 2,
        getPosition: (d) => [d.geometry.coordinates[0], d.geometry.coordinates[1]],
        getRadius: (d) => {
          const currentZoom = props.map?.getZoom() || 13;
          if (d.properties.cluster) {
            const suppliedPx = d.properties.cluster_radius_pixels;
            if (typeof suppliedPx === "number" && suppliedPx > 0) {
              return suppliedPx;
            }
            const pointCount = d.properties.point_count || 10;
            const count = pointCount;
            let label = count >= 1e3 ? `${(count / 1e3).toFixed(1)}k` : count.toString();
            let fontSize;
            if (currentZoom <= 8) fontSize = 28;
            else if (currentZoom <= 10) fontSize = 24;
            else if (currentZoom <= 12) fontSize = 20;
            else if (currentZoom <= 14) fontSize = 16;
            else fontSize = 14;
            const approxTextWidth = label.length * fontSize * 0.7;
            const minRadiusForText = Math.ceil(approxTextWidth / 2) + 25;
            let baseSize;
            if (currentZoom <= 8) {
              baseSize = 150;
            } else if (currentZoom <= 10) {
              baseSize = 120;
            } else if (currentZoom <= 11) {
              baseSize = 100;
            } else if (currentZoom <= 12) {
              baseSize = 80;
            } else if (currentZoom <= 13) {
              baseSize = 70;
            } else if (currentZoom <= 14) {
              baseSize = 60;
            } else if (currentZoom <= 15) {
              baseSize = 50;
            } else {
              baseSize = 40;
            }
            const countScale = Math.log(pointCount + 1) * 10;
            const finalSize = Math.max(baseSize + countScale, minRadiusForText);
            return finalSize;
          }
          let markerSize;
          if (currentZoom <= 8) {
            markerSize = 20;
          } else if (currentZoom <= 10) {
            markerSize = 16;
          } else if (currentZoom <= 12) {
            markerSize = 14;
          } else if (currentZoom <= 14) {
            markerSize = 12;
          } else {
            markerSize = 10;
          }
          return markerSize;
        },
        getFillColor: (d) => {
          if (d.properties.cluster) {
            return [251, 146, 60];
          }
          if (d.properties.submissions) {
            return [16, 185, 129];
          }
          if (d.properties.visited) {
            return [156, 163, 175];
          }
          if (d.properties.starred) {
            return [250, 204, 21];
          }
          const type = d.properties.type || "default";
          const color = colorMap[type];
          if (color) return color;
          return [107, 114, 128];
        },
        getLineColor: [255, 255, 255],
        getLineWidth: 2,
        onClick: (info) => {
          if (info.object) {
            const feature = info.object;
            if (feature.properties.cluster) {
              emit("clusterClick", feature);
            } else {
              emit("markerClick", feature);
            }
          }
        },
        updateTriggers: {
          getPosition: scatterUpdateKey,
          getRadius: scatterUpdateKey,
          getFillColor: scatterUpdateKey
        }
      });
      const finalText = new TextLayer({
        id: "cluster-labels",
        data: clusterData.slice(),
        pickable: false,
        getPosition: (d) => [d.geometry.coordinates[0], d.geometry.coordinates[1]],
        getText: (d) => {
          const count = d.properties.point_count || 0;
          if (count >= 1e3) {
            return `${(count / 1e3).toFixed(1)}k`;
          }
          return count.toString();
        },
        getSize: () => {
          const currentZoom = props.map?.getZoom() || 13;
          if (currentZoom <= 8) {
            return 28;
          } else if (currentZoom <= 9) {
            return 26;
          } else if (currentZoom <= 10) {
            return 24;
          } else if (currentZoom <= 12) {
            return 20;
          } else if (currentZoom <= 14) {
            return 16;
          } else {
            return 14;
          }
        },
        getColor: [255, 255, 255],
        getAngle: 0,
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        fontFamily: "Arial, sans-serif",
        fontWeight: "bold",
        updateTriggers: {
          getPosition: clusterUpdateKey,
          getText: clusterUpdateKey,
          getSize: [clusterUpdateKey, currentZoomPlain]
        }
      });
      let iconMarkerLayer = null;
      if (props.iconAtlas && props.iconAtlas.isReady) {
        const markerData = scatterDataPlain.filter((d) => !d.properties.cluster && (d.properties.visited || d.properties.starred || d.properties.submissions));
        log.debug("[MAP DIAGNOSTIC] Icon Atlas Status:", {
          isReady: props.iconAtlas.isReady,
          totalMarkers: scatterDataPlain.length,
          visitedOrStarredOrSubmissions: markerData.length,
          visitedCount: markerData.filter((d) => d.properties.visited).length,
          starredCount: markerData.filter((d) => d.properties.starred).length,
          submissionsCount: markerData.filter((d) => d.properties.submissions).length,
          iconAtlasHasIcons: {
            visited: props.iconAtlas.icons.has("visited"),
            starred: props.iconAtlas.icons.has("starred"),
            submissions: props.iconAtlas.icons.has("submissions")
          },
          sampleMarkerData: markerData.slice(0, 3).map((d) => ({
            id: d.properties.id,
            visited: d.properties.visited,
            starred: d.properties.starred,
            submissions: d.properties.submissions,
            cluster: d.properties.cluster
          }))
        });
        if (markerData.length > 0) {
          const size = 64;
          const iconNames = ["visited", "starred", "submissions"];
          const canvas = document.createElement("canvas");
          canvas.width = size * 3;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          const iconMapping = {};
          if (ctx && props.iconAtlas) {
            let x = 0;
            for (const name of iconNames) {
              const img = props.iconAtlas.icons.get(name);
              if (img) {
                ctx.drawImage(img, x, 0, size, size);
                iconMapping[name] = { x, y: 0, width: size, height: size, mask: false };
                x += size;
                log.debug(`[MAP DIAGNOSTIC] Icon '${name}' added to atlas at x=${x - size}`);
              } else {
                log.warn(`[MAP DIAGNOSTIC] Icon '${name}' NOT FOUND in icon atlas`);
              }
            }
          }
          log.debug("[MAP DIAGNOSTIC] Icon Mapping Created:", iconMapping);
          log.debug("[MAP DIAGNOSTIC] IconLayer Configuration:", {
            markerDataCount: markerData.length,
            iconMappingKeys: Object.keys(iconMapping),
            canvasSize: `${canvas.width}x${canvas.height}`
          });
          iconMarkerLayer = new IconLayer({
            id: "marker-icons",
            data: markerData,
            pickable: true,
            iconAtlas: canvas,
            iconMapping,
            getIcon: (d) => {
              const icon = d.properties.submissions ? "submissions" : d.properties.visited ? "visited" : "starred";
              log.debug("[MAP DIAGNOSTIC] getIcon called for marker:", {
                id: d.properties.id,
                visited: d.properties.visited,
                starred: d.properties.starred,
                submissions: d.properties.submissions,
                selectedIcon: icon
              });
              return icon;
            },
            getPosition: (d) => [d.geometry.coordinates[0], d.geometry.coordinates[1]],
            getSize: () => {
              const currentZoom = props.map?.getZoom() || 13;
              if (currentZoom <= 8) return 40;
              if (currentZoom <= 10) return 32;
              if (currentZoom <= 12) return 28;
              if (currentZoom <= 14) return 24;
              return 20;
            },
            sizeScale: 1,
            sizeUnits: "pixels",
            onClick: (info) => {
              if (info.object) {
                emit("markerClick", info.object);
              }
            },
            updateTriggers: {
              getPosition: scatterUpdateKey,
              getSize: currentZoomPlain,
              getIcon: scatterUpdateKey
            }
          });
          log.debug("[MAP DIAGNOSTIC] IconLayer created with", markerData.length, "markers");
        } else {
          log.debug("[MAP DIAGNOSTIC] No visited or starred markers to display");
        }
      } else {
        log.debug("[MAP DIAGNOSTIC] Icon Atlas not ready:", {
          exists: !!props.iconAtlas,
          isReady: props.iconAtlas?.isReady
        });
      }
      const layers = [finalScatter, finalText];
      if (iconMarkerLayer) {
        layers.push(iconMarkerLayer);
      }
      deck.value.setProps({ layers });
    }
    function handleResize() {
      if (!deck.value || !props.map) return;
      const container = props.map.getContainer();
      const canvas = document.getElementById("deck-canvas");
      if (canvas) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        deck.value.setProps({
          width: container.clientWidth,
          height: container.clientHeight
        });
      }
    }
    watch(() => props.clusters, () => {
      updateLayers();
    }, { deep: true });
    watch(() => props.iconAtlas, () => {
      updateLayers();
    });
    watch(() => props.visible, () => {
      updateLayers();
    });
    watch(() => props.map, (newMap) => {
      if (newMap && !deck.value) {
        nextTick(() => {
          initDeck();
          updateLayers();
        });
      }
    });
    onMounted(() => {
      if (props.map) {
        nextTick(() => {
          initDeck();
          updateLayers();
        });
      }
      window.addEventListener("resize", handleResize);
    });
    onUnmounted(() => {
      window.removeEventListener("resize", handleResize);
      try {
        if (deck.value && deck.value._ca_containerHandlers) {
          try {
            deck.value._ca_containerHandlers();
          } catch {
          }
          deck.value._ca_containerHandlers = null;
        }
      } catch (e) {
      }
      try {
        if (deck.value) {
          deck.value.finalize();
          deck.value = null;
        }
      } catch (e) {
      }
      const canvas = document.getElementById("deck-canvas");
      if (canvas) {
        canvas.remove();
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        ref_key: "containerRef",
        ref: containerRef,
        class: "webgl-overlay"
      }, _attrs))} data-v-8661ab04></div>`);
    };
  }
});

const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/MapWebGLLayer.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
const MapWebGLLayer = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__scopeId", "data-v-8661ab04"]]);

const DEFAULT_CONFIG = {
  radius: 200,
  // Cluster radius in pixels (at maxZoom). Higher = more aggressive clustering
  maxZoom: 10,
  // Generate clusters up to zoom 10 (lower = bigger clusters at low zoom)
  minZoom: 0,
  // Minimum zoom level at which clusters are generated
  minPoints: 2,
  // Minimum points to form a cluster (2 = any nearby points cluster)
  nodeSize: 64,
  // Size of the KD-tree node. Affects performance and memory usage
  extent: 512,
  // (Tiles) Tile extent. Radius is calculated relative to this value
  log: true
  // Enable logging for debugging
};
function useSupercluster(config = {}) {
  const index = ref(null);
  const isReady = ref(false);
  const pointCount = ref(0);
  const indexingTime = ref(0);
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const log = createLogger({ module: "frontend:useSupercluster" });
  function loadPoints(artworkData) {
    const startTime = performance.now();
    const geoJsonPoints = artworkData.map((artwork) => {
      const { lat, lon, ...metadata } = artwork;
      const properties = {
        ...metadata,
        cluster: false,
        latitude: lat,
        longitude: lon
      };
      return {
        type: "Feature",
        properties,
        geometry: {
          type: "Point",
          coordinates: [lon, lat]
        }
      };
    });
    const cluster = new Supercluster(mergedConfig);
    cluster.load(geoJsonPoints);
    index.value = cluster;
    pointCount.value = geoJsonPoints.length;
    isReady.value = true;
    indexingTime.value = performance.now() - startTime;
    if (mergedConfig.log) {
      log.debug("Supercluster indexed points", {
        count: pointCount.value,
        duration_ms: Number(indexingTime.value.toFixed(2))
      });
    }
  }
  function getClusters(bbox, zoom) {
    if (!index.value || !isReady.value) {
      if (mergedConfig.log) {
        log.warn("Supercluster not ready");
      }
      return [];
    }
    const startTime = performance.now();
    const clusters = index.value.getClusters(bbox, Math.floor(zoom));
    if (mergedConfig.log) {
      log.debug("Supercluster getClusters", {
        items: clusters.length,
        duration_ms: Number((performance.now() - startTime).toFixed(2))
      });
    }
    return clusters;
  }
  function getClusterExpansionZoom(clusterId) {
    if (!index.value || !isReady.value) {
      return mergedConfig.maxZoom || 16;
    }
    return index.value.getClusterExpansionZoom(clusterId);
  }
  function getClusterLeaves(clusterId, limit = 10, offset = 0) {
    if (!index.value || !isReady.value) {
      return [];
    }
    return index.value.getLeaves(clusterId, limit, offset);
  }
  function getClusterChildren(clusterId) {
    if (!index.value || !isReady.value) {
      return [];
    }
    return index.value.getChildren(clusterId);
  }
  function clear() {
    index.value = null;
    isReady.value = false;
    pointCount.value = 0;
    indexingTime.value = 0;
    if (mergedConfig.log) {
      log.debug("Supercluster cleared");
    }
  }
  return {
    // State
    isReady: computed(() => isReady.value),
    pointCount: computed(() => pointCount.value),
    indexingTime: computed(() => indexingTime.value),
    // Methods
    loadPoints,
    getClusters,
    getClusterExpansionZoom,
    getClusterLeaves,
    getClusterChildren,
    clear
  };
}

async function rasterizeSVG(svgString, size = 64) {
  try {
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image(size, size);
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    URL.revokeObjectURL(url);
    if (typeof createImageBitmap !== "undefined") {
      const bitmap = await createImageBitmap(img, {
        resizeWidth: size,
        resizeHeight: size,
        resizeQuality: "high"
      });
      return bitmap;
    }
    return img;
  } catch (error) {
    console.error("Failed to rasterize SVG:", error);
    throw error;
  }
}
async function loadImage(url, size) {
  const img = new Image();
  if (size) {
    img.width = size;
    img.height = size;
  }
  img.src = url;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  if (typeof createImageBitmap !== "undefined" && size) {
    const bitmap = await createImageBitmap(img, {
      resizeWidth: size,
      resizeHeight: size,
      resizeQuality: "high"
    });
    return bitmap;
  }
  return img;
}
async function createIconAtlas(iconConfigs) {
  const icons = /* @__PURE__ */ new Map();
  const promises = [];
  for (const config of iconConfigs) {
    const promise = (async () => {
      try {
        let icon;
        if (config.svg) {
          icon = await rasterizeSVG(config.svg, config.size || 64);
        } else if (config.url) {
          icon = await loadImage(config.url, config.size);
        } else {
          throw new Error(`Icon ${config.name} has no SVG or URL`);
        }
        icons.set(config.name, icon);
      } catch (error) {
        console.error(`Failed to load icon ${config.name}:`, error);
      }
    })();
    promises.push(promise);
  }
  await Promise.all(promises);
  return {
    icons,
    isReady: true
  };
}
const DEFAULT_ICONS = {
  sculpture: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="28" fill="#3B82F6" stroke="#1E40AF" stroke-width="3"/>
    <path d="M32 16 L40 32 L32 48 L24 32 Z" fill="white" opacity="0.9"/>
  </svg>`,
  mural: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <rect x="8" y="12" width="48" height="40" rx="4" fill="#10B981" stroke="#047857" stroke-width="3"/>
    <rect x="16" y="20" width="32" height="24" fill="white" opacity="0.8"/>
  </svg>`,
  installation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="28" fill="#8B5CF6" stroke="#6D28D9" stroke-width="3"/>
    <rect x="24" y="24" width="16" height="16" fill="white" opacity="0.9" transform="rotate(45 32 32)"/>
  </svg>`,
  default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="28" fill="#6B7280" stroke="#374151" stroke-width="3"/>
    <circle cx="32" cy="32" r="8" fill="white" opacity="0.9"/>
  </svg>`,
  cluster: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="30" fill="#EF4444" stroke="#991B1B" stroke-width="3"/>
    <text x="32" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white">•••</text>
  </svg>`,
  visited: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <rect x="4" y="4" width="56" height="56" rx="4" ry="4" fill="#9CA3AF" stroke="#6B7280" stroke-width="3"/>
    <path d="M20 32 L28 40 L44 24" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
  submissions: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <rect x="4" y="4" width="56" height="56" rx="4" ry="4" fill="#10B981" stroke="#047857" stroke-width="3"/>
    <path d="M20 32 L28 40 L44 24" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
  starred: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="28" fill="#FBBF24" stroke="#F59E0B" stroke-width="3"/>
    <path d="M32 16 L36 28 L48 28 L38 36 L42 48 L32 40 L22 48 L26 36 L16 28 L28 28 Z" fill="white" stroke="none"/>
  </svg>`,
  userLocation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <!-- Person icon -->
    <circle cx="32" cy="20" r="10" fill="#2196F3"/>
    <path d="M 32 30 L 20 50 L 24 50 L 32 35 L 40 50 L 44 50 Z" fill="#2196F3"/>
    <!-- Outer circle/ring -->
    <circle cx="32" cy="32" r="30" fill="none" stroke="#2196F3" stroke-width="3" opacity="0.5"/>
  </svg>`,
  userLocationCone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <!-- View cone wedge (45° spread) -->
    <path d="M 50 50 L 100 25 A 50 50 0 0 1 100 75 Z" fill="#2196F3" opacity="0.3"/>
  </svg>`
};

const MAP_STATE_KEY = "map:lastState";
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "MapComponent",
  __ssrInlineRender: true,
  props: {
    center: {},
    zoom: { default: 15 },
    artworks: {},
    showUserLocation: { type: Boolean, default: true },
    suppressFilterBanner: { type: Boolean, default: false }
  },
  emits: [
    "artworkClick",
    "previewArtwork",
    "dismissPreview",
    "mapMove",
    "locationFound",
    // Telemetry events emitted by the map for external listeners (e.g., analytics)
    "telemetryUpdate"
  ],
  setup(__props, { emit: __emit }) {
    function renderHeroIconToString(iconComponent, props2 = {}) {
      if (typeof document === "undefined") return "";
      try {
        const container = document.createElement("div");
        const app = createApp(iconComponent, props2);
        app.mount(container);
        const html = container.innerHTML || "";
        try {
          app.unmount();
        } catch (e) {
        }
        return html;
      } catch (e) {
        return "";
      }
    }
    let L = void 0;
    const props = __props;
    const emit = __emit;
    const log = createLogger({ module: "frontend:MapComponent" });
    const mapContainer = ref();
    const map = ref(null);
    const isLoading = ref(true);
    const isLocating = ref(false);
    const error = ref(null);
    const showLocationNotice = ref(false);
    useToasts();
    const isLoadingViewport = ref(false);
    const lastLoadedBounds = ref(
      null
    );
    const loadingTimeout = ref(null);
    const markerUpdateTimeout = ref(null);
    const zoomStyleTimeout = ref(null);
    const loadArtworksTimeout = ref(null);
    const isZoomAnimating = ref(false);
    const DEFAULT_CENTER = { latitude: 49.265, longitude: -123.25 };
    const getLeafletGlobal = () => typeof window !== "undefined" && window.L ? window.L : L;
    const installLeafletPopupGuards = () => {
    };
    const installLeafletDomUtilGuards = () => {
    };
    const installLeafletMapZoomGuard = () => {
    };
    const installLeafletMarkerGuards = () => {
    };
    const hadSavedMapState = ref(false);
    const isProgressiveLoading = ref(false);
    const hasGeolocation = ref(typeof navigator !== "undefined" && !!navigator.geolocation);
    const userLocationMarker = ref(null);
    const userWatchId = ref(null);
    const userHeading = ref(0);
    const debugRingsEnabled = ref(false);
    const progressiveLoadingStats = ref(null);
    const useProgressiveLoading = ref(false);
    const isTracking = computed(() => userWatchId.value !== null);
    const effectiveClusterEnabled = computed(() => {
      const z = map.value?.getZoom() ?? props.zoom ?? 15;
      const enabled = mapSettings.clusteringEnabled && z > 14;
      log.debug("[MAP DIAGNOSTIC] Clustering state:", {
        zoom: z,
        userPreference: mapSettings.clusteringEnabled,
        zoomThreshold: 14,
        effectivelyEnabled: enabled
      });
      return enabled;
    });
    const router = useRouter();
    let debugImmediateRing = null;
    function saveMapState() {
      if (!map.value) return;
      const center = map.value.getCenter();
      const zoom = map.value.getZoom();
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(MAP_STATE_KEY, JSON.stringify({ center: { latitude: center.lat, longitude: center.lng }, zoom }));
        }
      } catch (e) {
      }
    }
    function readSavedMapState() {
      try {
        if (typeof localStorage === "undefined") return null;
        const raw = localStorage.getItem(MAP_STATE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed;
      } catch {
        return null;
      }
    }
    const artworksStore = useArtworksStore();
    const mapFilters = useMapFilters();
    const mapPreviewStore = useMapPreviewStore();
    const mapSettings = useMapSettings();
    useArtworkTypeFilters();
    const { visitedArtworks, starredArtworks, submissionsArtworks } = useUserLists();
    const webglClusters = ref([]);
    const webglClustering = useSupercluster({
      radius: 160,
      maxZoom: 15,
      minZoom: 0,
      minPoints: 2,
      nodeSize: 64,
      log: false
    });
    let webglMoveHandler = null;
    let webglZoomHandler = null;
    const iconAtlas = ref(null);
    const showOptionsModal = ref(false);
    const createUserLocationIcon = () => {
      const size = 64;
      const half = size / 2;
      const personSvg = `
    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" fill="#ffffff"/>
      <path d="M6 20a6 6 0 0112 0" fill="#ffffff"/>
    </svg>
  `;
      const leafletGlobal = getLeafletGlobal();
      const innerHtml = `
      <div class="user-location-marker flex items-center justify-center bg-red-600 rounded-full" style="width:${size}px;height:${size}px;border:4px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);">
        ${typeof document !== "undefined" ? renderHeroIconToString(UserIcon, { class: "w-7 h-7 text-white", "aria-hidden": "true" }) : personSvg}
      </div>
    `;
      if (leafletGlobal && typeof leafletGlobal.divIcon === "function") {
        return leafletGlobal.divIcon({ html: innerHtml, className: "custom-user-location-icon", iconSize: [size, size], iconAnchor: [half, half] });
      }
      return {
        html: innerHtml,
        className: "custom-user-location-icon",
        iconSize: [size, size],
        iconAnchor: [half, half]
      };
    };
    function clearListCaches() {
    }
    try {
      defineExpose({ clearListCaches, createUserLocationIcon });
    } catch (e) {
    }
    function buildWebGLClusters() {
      try {
        if (!map.value || !props.artworks) {
          log.debug("[MAP DIAGNOSTIC] buildWebGLClusters skipped:", {
            mapExists: !!map.value,
            artworksCount: props.artworks?.length ?? 0
          });
          webglClusters.value = [];
          return;
        }
        const b = map.value.getBounds();
        const latPad = (b.getNorth() - b.getSouth()) * 0.05;
        const lngPad = (b.getEast() - b.getWest()) * 0.05;
        const viewportBounds = L.latLngBounds(
          L.latLng(b.getSouth() - latPad, b.getWest() - lngPad),
          L.latLng(b.getNorth() + latPad, b.getEast() + lngPad)
        );
        const currentZoom = map.value?.getZoom() ?? props.zoom ?? 15;
        log.debug("[MAP DIAGNOSTIC] buildWebGLClusters:", {
          totalArtworks: props.artworks.length,
          currentZoom,
          effectiveClusterEnabled: effectiveClusterEnabled.value,
          visitedCount: visitedArtworks.value.size,
          starredCount: starredArtworks.value.size,
          submissionsCount: submissionsArtworks.value.size
        });
        if (effectiveClusterEnabled.value) {
          try {
            const artworkPoints = (props.artworks || []).map((a) => {
              const visited = visitedArtworks.value instanceof Set ? visitedArtworks.value.has(a.id) : false;
              const starred = starredArtworks.value instanceof Set ? starredArtworks.value.has(a.id) : false;
              const submissions = submissionsArtworks.value instanceof Set ? submissionsArtworks.value.has(a.id) : false;
              return {
                id: a.id,
                lat: a.latitude,
                lon: a.longitude,
                title: a.title || "Untitled",
                type: a.type || "default",
                // Pass visited/starred/submissions flags so they're preserved in clustered output
                visited,
                starred,
                submissions
              };
            });
            log.debug("[MAP DIAGNOSTIC] Loading points for clustering:", {
              totalPoints: artworkPoints.length,
              visitedInPoints: artworkPoints.filter((p) => p.visited).length,
              starredInPoints: artworkPoints.filter((p) => p.starred).length,
              submissionsInPoints: artworkPoints.filter((p) => p.submissions).length
            });
            webglClustering.loadPoints(artworkPoints);
            const bbox = [
              viewportBounds.getWest(),
              viewportBounds.getSouth(),
              viewportBounds.getEast(),
              viewportBounds.getNorth()
            ];
            const clustersRaw = webglClustering.getClusters(bbox, currentZoom);
            const clusters = clustersRaw.map((feature) => {
              const isCluster = Boolean(feature.properties?.cluster);
              const pointCount = isCluster ? feature.properties?.point_count ?? 0 : 1;
              const pointCountAbbreviated = isCluster ? feature.properties?.point_count_abbreviated ?? (pointCount >= 1e3 ? `${(pointCount / 1e3).toFixed(1)}k` : pointCount.toString()) : void 0;
              const properties = {
                ...feature.properties,
                cluster: isCluster
              };
              if (isCluster) {
                properties.point_count = pointCount;
                if (pointCountAbbreviated !== void 0) {
                  properties.point_count_abbreviated = pointCountAbbreviated;
                }
                properties.cluster_radius_pixels = Math.min(Math.max(Math.sqrt(pointCount) * 8, 28), 160);
              } else {
                properties.visited = properties.visited ?? false;
                properties.starred = properties.starred ?? false;
                properties.submissions = properties.submissions ?? false;
              }
              const coordinates = feature.geometry?.coordinates || [0, 0];
              return {
                type: "Feature",
                id: isCluster ? `cluster-${String(feature.properties?.cluster_id ?? feature.id ?? Math.random())}` : String(feature.properties?.id ?? feature.id ?? ""),
                properties,
                geometry: {
                  type: "Point",
                  coordinates: [coordinates[0], coordinates[1]]
                }
              };
            });
            log.debug("[MAP DIAGNOSTIC] Clustering enabled - clusters generated:", {
              totalClusters: clusters.length,
              actualClusters: clusters.filter((c) => c.properties?.cluster).length,
              individualMarkers: clusters.filter((c) => !c.properties?.cluster).length,
              visitedMarkers: clusters.filter((c) => !c.properties?.cluster && c.properties.visited).length,
              starredMarkers: clusters.filter((c) => !c.properties?.cluster && c.properties.starred).length,
              submissionsMarkers: clusters.filter((c) => !c.properties?.cluster && c.properties.submissions).length,
              sampleVisited: clusters.filter((c) => !c.properties?.cluster && c.properties.visited).slice(0, 2).map((c) => ({
                id: c.properties.id,
                visited: c.properties.visited,
                starred: c.properties.starred,
                submissions: c.properties.submissions
              }))
            });
            webglClusters.value = clusters;
            return;
          } catch (err) {
            log.warn("[MAP DIAGNOSTIC] webglClustering error:", err);
          }
        }
        const pts = (props.artworks || []).filter((a) => mapFilters.shouldShowArtwork(a) && viewportBounds.contains(L.latLng(a.latitude, a.longitude))).map((a) => {
          const visited = visitedArtworks.value instanceof Set ? visitedArtworks.value.has(a.id) : false;
          const starred = starredArtworks.value instanceof Set ? starredArtworks.value.has(a.id) : false;
          const submissions = submissionsArtworks.value instanceof Set ? submissionsArtworks.value.has(a.id) : false;
          return {
            type: "Feature",
            id: String(a.id),
            properties: {
              cluster: false,
              id: a.id,
              type: a.type || "default",
              title: a.title || "Untitled",
              // Include user list flags so WebGL rendering can show visited/starred icons
              visited,
              starred,
              submissions
            },
            geometry: { type: "Point", coordinates: [a.longitude, a.latitude] }
          };
        });
        log.debug("[MAP DIAGNOSTIC] Individual markers generated:", {
          total: pts.length,
          visited: pts.filter((p) => p.properties.visited).length,
          starred: pts.filter((p) => p.properties.starred).length,
          submissions: pts.filter((p) => p.properties.submissions).length
        });
        webglClusters.value = pts;
      } catch (err) {
        log.warn("[MAP DIAGNOSTIC] buildWebGLClusters error:", err);
        webglClusters.value = [];
      }
    }
    async function initializeMap() {
      if (typeof window === "undefined" || typeof document === "undefined") {
        log.warn("Map initialization skipped: non-browser environment");
        isLoading.value = false;
        return;
      }
      if (!mapContainer.value) {
        log.error("Map container not found");
        return;
      }
      log.debug("Initializing map with container:", mapContainer.value);
      log.debug("Container dimensions:", {
        offsetWidth: mapContainer.value.offsetWidth,
        offsetHeight: mapContainer.value.offsetHeight,
        clientWidth: mapContainer.value.clientWidth,
        clientHeight: mapContainer.value.clientHeight
      });
      try {
        isLoading.value = true;
        error.value = null;
        log.debug("Creating Leaflet map...");
        const saved = readSavedMapState();
        hadSavedMapState.value = !!saved;
        let initialCenter;
        let initialZoom;
        if (saved) {
          initialCenter = [saved.center.latitude, saved.center.longitude];
          initialZoom = saved.zoom;
        } else if (props.center) {
          initialCenter = [props.center.latitude, props.center.longitude];
          initialZoom = props.zoom;
        } else {
          initialCenter = [DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude];
          initialZoom = props.zoom;
        }
        map.value = L.map(mapContainer.value, {
          center: initialCenter,
          zoom: initialZoom,
          zoomControl: false,
          // We'll use custom controls
          attributionControl: true
        });
        log.debug("Map created successfully:", map.value);
        installLeafletPopupGuards();
        installLeafletDomUtilGuards();
        installLeafletMapZoomGuard();
        installLeafletMarkerGuards();
        installLeafletPopupGuards();
        installLeafletDomUtilGuards();
        installLeafletMapZoomGuard();
        installLeafletMarkerGuards();
        if (mapContainer.value) {
          mapContainer.value.classList.add("leaflet-container");
          mapContainer.value.style.position = "relative";
          log.debug("Added leaflet-container class to map container");
        }
        const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          errorTileUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
          // Transparent 1x1 pixel
        }).addTo(map.value);
        tileLayer.on("tileerror", (e) => {
          log.error("Tile loading error:", e);
          log.error("Tile error details:", {
            coords: e.coords,
            error: e.error,
            tile: e.tile
          });
        });
        tileLayer.on("tileload", () => {
          nextTick(() => {
            forceMapDimensions();
          });
        });
        log.debug("Tile layer added to map");
        const forceMapDimensions = () => {
          if (mapContainer.value) {
            mapContainer.value.classList.add("leaflet-container");
            const mapPanes = mapContainer.value.querySelectorAll(".leaflet-pane");
            mapPanes.forEach((pane) => {
              if (pane.classList.contains("leaflet-map-pane")) {
                pane.style.width = "100%";
                pane.style.height = "100%";
                pane.style.position = "absolute";
                pane.style.left = "0px";
                pane.style.top = "0px";
              }
              if (pane.classList.contains("leaflet-tile-pane")) {
                pane.style.width = "100%";
                pane.style.height = "100%";
                pane.style.position = "absolute";
                pane.style.left = "0px";
                pane.style.top = "0px";
                pane.style.zIndex = "200";
                const tileImages = pane.querySelectorAll("img");
                tileImages.forEach((img) => {
                  img.style.width = "256px";
                  img.style.height = "256px";
                  img.style.display = "block";
                  img.style.visibility = "visible";
                  img.style.opacity = "1";
                });
              }
            });
            log.debug("Applied dimension fixes to Leaflet containers");
          }
        };
        forceMapDimensions();
        setTimeout(forceMapDimensions, 100);
        setTimeout(forceMapDimensions, 500);
        setTimeout(forceMapDimensions, 1e3);
        setTimeout(() => {
          if (mapContainer.value) {
            const leafletContainer = mapContainer.value.querySelector(".leaflet-container");
            log.debug("Leaflet container found:", leafletContainer);
            if (leafletContainer) {
              const styles = leafletContainer.style;
              log.debug("Leaflet container styles:", {
                position: styles.position,
                width: styles.width,
                height: styles.height,
                zIndex: styles.zIndex
              });
            }
            const tileLayers = mapContainer.value.querySelectorAll(".leaflet-tile-pane img");
            log.debug("Tile images found:", tileLayers.length);
            if (tileLayers.length > 0) {
              const firstTile = tileLayers[0];
              log.debug("First tile image:", {
                src: firstTile.src,
                width: firstTile.width,
                height: firstTile.height,
                naturalWidth: firstTile.naturalWidth,
                naturalHeight: firstTile.naturalHeight
              });
            }
          }
        }, 500);
        setTimeout(() => {
          if (map.value) {
            log.debug("Forcing map resize...");
            map.value.invalidateSize();
            try {
              if (typeof map.value.getBounds === "function") {
                log.debug("Map bounds after resize:", map.value.getBounds());
              }
              if (typeof map.value.getCenter === "function") {
                log.debug("Map center after resize:", map.value.getCenter());
              }
              if (typeof map.value.getZoom === "function") {
                log.debug("Map zoom after resize:", map.value.getZoom());
              }
            } catch (error2) {
              log.warn("Debug logging failed:", error2);
            }
          }
        }, 100);
        await configureMarkerGroup();
        try {
          map.value.on("zoomend", async () => {
            try {
              await configureMarkerGroup();
              buildWebGLClusters();
            } catch (e) {
            }
          });
        } catch (e) {
        }
        const interceptZoomControls = () => {
          if (!map.value) return;
          nextTick(() => {
            const containerEl = map.value && typeof map.value.getContainer === "function" ? map.value.getContainer() : mapContainer.value || null;
            if (!containerEl) return;
            const zoomInButton = containerEl.querySelector(".leaflet-control-zoom-in");
            const zoomOutButton = containerEl.querySelector(".leaflet-control-zoom-out");
            if (zoomInButton) {
              const newZoomInButton = zoomInButton.cloneNode(true);
              zoomInButton.parentNode?.replaceChild(newZoomInButton, zoomInButton);
              newZoomInButton.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                executeNuclearZoom(() => map.value.zoomIn());
              });
            }
            if (zoomOutButton) {
              const newZoomOutButton = zoomOutButton.cloneNode(true);
              zoomOutButton.parentNode?.replaceChild(newZoomOutButton, zoomOutButton);
              newZoomOutButton.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                executeNuclearZoom(() => map.value.zoomOut());
              });
            }
          });
        };
        const executeNuclearZoom = (zoomAction) => {
          if (!map.value) return;
          emit("dismissPreview");
          const mapAny = map.value;
          if (mapAny._popup) {
            map.value.closePopup();
            mapAny._popup = null;
          }
          if (mapAny._layers) {
            Object.keys(mapAny._layers).forEach((layerKey) => {
              const layer = mapAny._layers[layerKey];
              if (layer && layer._popup) {
                if (map.value.hasLayer(layer._popup)) {
                  map.value.removeLayer(layer._popup);
                }
                layer._popup = null;
              }
            });
          }
          zoomAction();
        };
        interceptZoomControls();
        map.value.on("moveend", handleMapMove);
        map.value.on("zoomend", handleMapMove);
        try {
          map.value.on("movestart", () => {
            try {
              emit("dismissPreview");
            } catch (_) {
            }
          });
          map.value.on("dragstart", () => {
            try {
              emit("dismissPreview");
            } catch (_) {
            }
          });
        } catch (e) {
        }
        map.value.on("zoomstart", () => {
          try {
            isZoomAnimating.value = true;
            try {
              installLeafletPopupGuards();
              installLeafletDomUtilGuards();
              installLeafletMapZoomGuard();
              installLeafletMarkerGuards();
            } catch (overrideErr) {
            }
            const mapAny = map.value;
            try {
              if (mapAny && mapAny._popup) {
                try {
                  if (map.value && typeof map.value.closePopup === "function") map.value.closePopup();
                } catch {
                }
                ;
                try {
                  if (mapAny._popup && mapAny._popup._container && mapAny._popup._container.parentNode) {
                    mapAny._popup._container.parentNode.removeChild(mapAny._popup._container);
                  }
                } catch {
                }
                ;
                mapAny._popup = null;
              }
            } catch (mainPopupErr) {
            }
            try {
              if (mapAny && mapAny._layers) {
                Object.keys(mapAny._layers).forEach((layerKey) => {
                  try {
                    const layer = mapAny._layers[layerKey];
                    if (layer && layer._popup) {
                      try {
                        if (layer._popup._container && layer._popup._container.parentNode) {
                          layer._popup._container.parentNode.removeChild(layer._popup._container);
                        }
                      } catch {
                      }
                      try {
                        layer._popup = null;
                      } catch {
                      }
                    }
                  } catch (e) {
                  }
                });
              }
            } catch (layersErr) {
            }
            try {
              const selectors = [".leaflet-popup", ".leaflet-popup-pane", ".leaflet-popup-content-wrapper", ".leaflet-popup-content", ".leaflet-popup-tip-container", ".leaflet-popup-tip", ".artwork-popup-container"];
              selectors.forEach((sel) => {
                const nodes = Array.from(document.querySelectorAll(sel));
                nodes.forEach((n) => {
                  try {
                    n.remove();
                  } catch {
                  }
                });
              });
            } catch (domErr) {
            }
            try {
              emit("dismissPreview");
            } catch (_) {
            }
          } catch (overallError) {
            log.error("Critical error in zoomstart handler:", overallError);
            isZoomAnimating.value = true;
          }
        });
        map.value.on("zoomend", () => {
          try {
            isZoomAnimating.value = false;
            try {
              const Lglobal = getLeafletGlobal();
              if (Lglobal) {
                const popupProto = Lglobal.Popup?.prototype;
                if (popupProto && popupProto._superNuclearGuardInstalled) {
                } else if (popupProto) {
                  if (popupProto._originalAnimateZoom) {
                    popupProto._animateZoom = popupProto._originalAnimateZoom;
                  }
                  if (popupProto._originalUpdatePosition) {
                    popupProto._updatePosition = popupProto._originalUpdatePosition;
                  }
                  if (popupProto._originalUpdateLayout) {
                    popupProto._updateLayout = popupProto._originalUpdateLayout;
                  }
                }
                if (Lglobal.Marker && Lglobal.Marker.prototype && Lglobal.Marker.prototype._originalOpenPopup) {
                  Lglobal.Marker.prototype.openPopup = Lglobal.Marker.prototype._originalOpenPopup;
                }
                if (Lglobal.DomUtil) {
                  const domUtilAny = Lglobal.DomUtil;
                  if (domUtilAny._superNuclearGuardInstalled) {
                  } else if (domUtilAny._originalGetPosition) {
                    Lglobal.DomUtil.getPosition = domUtilAny._originalGetPosition;
                  }
                }
                if (map.value) {
                  const mapInstance = map.value;
                  if (mapInstance._originalGetMapPanePos) {
                    mapInstance._getMapPanePos = mapInstance._originalGetMapPanePos;
                  }
                }
              }
              const previewElements = document.querySelectorAll('.preview-card, .shake-animation, [class*="transition"]');
              previewElements.forEach((el) => {
                const element = el;
                if (element.style) {
                  element.style.transition = "";
                  element.style.animation = "";
                }
              });
              const mapPanes = document.querySelectorAll(".leaflet-map-pane, .leaflet-popup-pane");
              mapPanes.forEach((pane) => {
                const paneEl = pane;
                const originalTransform = paneEl.getAttribute("data-original-transform");
                if (originalTransform) {
                  paneEl.style.transform = originalTransform;
                  paneEl.removeAttribute("data-original-transform");
                }
              });
            } catch (restoreError) {
            }
            updateArtworkMarkersDebounced(50);
          } catch (zoomEndError) {
            log.error("Critical error in zoomend handler:", zoomEndError);
            isZoomAnimating.value = false;
          }
        });
        map.value.on("zoom", () => {
          if (zoomStyleTimeout.value) clearTimeout(zoomStyleTimeout.value);
          zoomStyleTimeout.value = setTimeout(() => {
            try {
              if (map.value && !isZoomAnimating.value) {
                updateMarkerStyles();
              } else {
              }
            } catch (e) {
            }
            zoomStyleTimeout.value = null;
          }, 50);
        });
        map.value.on("moveend", saveMapState);
        map.value.on("zoomend", saveMapState);
        try {
          const savedRings = localStorage.getItem("map:debugRingsEnabled");
          if (savedRings !== null) debugRingsEnabled.value = savedRings === "true";
        } catch {
        }
        updateDebugRings();
        if (!hadSavedMapState.value) {
          if (props.showUserLocation && hasGeolocation.value) {
            try {
              if (navigator.permissions && typeof navigator.permissions.query === "function") {
                const perm = await navigator.permissions.query({
                  name: "geolocation"
                });
                if (perm.state === "granted") {
                  showLocationNotice.value = false;
                  await requestUserLocation();
                } else if (perm.state === "prompt") {
                  await requestUserLocation();
                } else {
                  await requestUserLocation();
                }
                try {
                  perm.onchange = () => {
                    if (perm.state === "granted") {
                      showLocationNotice.value = false;
                      requestUserLocation().catch(() => {
                      });
                    }
                  };
                } catch (e) {
                }
              } else {
                await requestUserLocation();
              }
            } catch (err) {
              log.warn("Permissions API check failed:", err);
              await requestUserLocation();
            }
          } else {
            showLocationNotice.value = true;
            artworksStore.setCurrentLocation(DEFAULT_CENTER);
            if (map.value) {
              map.value.setView([DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], props.zoom);
            }
            setTimeout(() => {
              showLocationNotice.value = false;
            }, 1e4);
          }
        } else {
        }
        setTimeout(async () => {
          await loadArtworks();
          updateArtworkMarkersDebounced(100);
        }, 50);
      } catch (err) {
        log.error("Map initialization error:", err);
        error.value = "Failed to initialize map. Please check your internet connection and try again.";
        showLocationNotice.value = false;
      } finally {
        isLoading.value = false;
      }
    }
    async function requestUserLocation() {
      if (!hasGeolocation.value) {
        artworksStore.setCurrentLocation(DEFAULT_CENTER);
        if (map.value) {
          map.value.setView([DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], props.zoom);
        }
        addUserLocationMarker(DEFAULT_CENTER);
        emit("locationFound", DEFAULT_CENTER);
        showLocationNotice.value = true;
        return;
      }
      isLocating.value = true;
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 1e4,
            maximumAge: 3e5
            // 5 minutes
          });
        });
        const userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        artworksStore.setCurrentLocation(userLocation);
        if (map.value) {
          const currentZoom = map.value.getZoom();
          try {
            map.value.setView([userLocation.latitude, userLocation.longitude], currentZoom, {
              animate: true,
              duration: 0.5
            });
          } catch (e) {
            map.value.setView([userLocation.latitude, userLocation.longitude], currentZoom);
          }
        }
        addUserLocationMarker(userLocation);
        emit("locationFound", userLocation);
        showLocationNotice.value = false;
      } catch (err) {
        log.warn("Geolocation error:", err);
        artworksStore.setCurrentLocation(DEFAULT_CENTER);
        if (map.value) {
          map.value.setView([DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], props.zoom);
        }
        addUserLocationMarker(DEFAULT_CENTER);
        emit("locationFound", DEFAULT_CENTER);
        showLocationNotice.value = true;
      } finally {
        isLocating.value = false;
      }
    }
    function addUserLocationMarker(location) {
      if (!map.value) {
        log.warn("[MAP DIAGNOSTIC] Cannot add user location marker - map not initialized");
        return;
      }
      log.debug("[MAP DIAGNOSTIC] Adding user location marker:", {
        latitude: location.latitude,
        longitude: location.longitude,
        heading: userHeading.value,
        mapExists: !!map.value
      });
      if (userLocationMarker.value) {
        map.value.removeLayer(userLocationMarker.value);
        log.debug("[MAP DIAGNOSTIC] Removed previous user location marker");
      }
      userLocationMarker.value = L.marker([location.latitude, location.longitude], {
        icon: createUserLocationIconWithCone(userHeading.value),
        zIndexOffset: 1e4
      }).addTo(map.value).bindPopup("Your current location");
      log.debug("[MAP DIAGNOSTIC] User location marker added to map");
      try {
        userLocationMarker.value.getElement()?.style.setProperty("z-index", "10050");
        if (userLocationMarker.value.bringToFront) {
          userLocationMarker.value.bringToFront();
        }
        log.debug("[MAP DIAGNOSTIC] User location marker z-index set to 10050");
      } catch (e) {
        log.warn("[MAP DIAGNOSTIC] Error setting user marker z-index:", e);
      }
    }
    const createUserLocationIconWithCone = (headingDeg) => {
      log.debug("[MAP DIAGNOSTIC] Creating user location icon with cone:", {
        headingDeg,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const size = 112;
      const half = size / 2;
      const coneSvg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#ef4444" flood-opacity="0.25" />
        </filter>
      </defs>
      <g transform="translate(${half}, ${half}) rotate(${headingDeg})">
        <!-- Outer faint ring (now red) -->
        <circle cx="0" cy="0" r="20" fill="#ef4444" fill-opacity="0.3" stroke="#000" stroke-width="2" />

        <!-- Inner solid center replaced by red background; heroicon user will be inlined here -->
        <foreignObject x="-16" y="-16" width="32" height="32">
          <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
            ${typeof document !== "undefined" ? renderHeroIconToString(UserIcon, { class: "w-6 h-6 text-black", "aria-hidden": "true" }) : ""}
          </div>
        </foreignObject>
      </g>
    </svg>
  `;
      const icon = L.divIcon({
        html: `
      <div class="user-location-marker-wrapper" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
        ${coneSvg}
      </div>
    `,
        className: "custom-user-location-icon-wrapper",
        iconSize: [size, size],
        iconAnchor: [half, half]
      });
      log.debug("[MAP DIAGNOSTIC] User location icon created:", {
        iconSize: icon.options.iconSize,
        iconAnchor: icon.options.iconAnchor,
        className: icon.options.className
      });
      return icon;
    };
    async function loadArtworks() {
      if (!map.value) {
        return;
      }
      try {
        const bounds = map.value.getBounds();
        const padding = 0.15;
        const latPad = (bounds.getNorth() - bounds.getSouth()) * padding;
        const lngPad = (bounds.getEast() - bounds.getWest()) * padding;
        const expandedBounds = {
          north: bounds.getNorth() + latPad,
          south: bounds.getSouth() - latPad,
          east: bounds.getEast() + lngPad,
          west: bounds.getWest() - lngPad
        };
        if (lastLoadedBounds.value && boundsContain(lastLoadedBounds.value, expandedBounds)) {
          updateArtworkMarkers();
          return;
        }
        isLoadingViewport.value = true;
        if (useProgressiveLoading.value) {
          await loadArtworksProgressively(expandedBounds);
        } else {
          await artworksStore.fetchArtworksInBounds(expandedBounds);
        }
        lastLoadedBounds.value = expandedBounds;
        await nextTick();
        updateArtworkMarkers();
      } catch (err) {
        log.error("Error loading artworks:", err);
      } finally {
        isLoadingViewport.value = false;
      }
    }
    async function loadArtworksProgressively(bounds) {
      if (!map.value) return;
      isProgressiveLoading.value = true;
      progressiveLoadingStats.value = { loaded: 0, total: 0, percentage: 0 };
      try {
        await artworksStore.fetchArtworksInBoundsBatched(
          bounds,
          500,
          // initial batch size
          (progress) => {
            progressiveLoadingStats.value = {
              loaded: progress.loaded,
              total: Math.max(progress.total, progress.loaded),
              percentage: Math.round(
                progress.loaded / Math.max(progress.total, progress.loaded) * 100
              ),
              batchSize: progress.batchSize,
              avgTime: progress.avgTime
            };
            nextTick(() => {
              updateArtworkMarkers();
            });
          }
        );
      } finally {
        isProgressiveLoading.value = false;
        progressiveLoadingStats.value = null;
      }
    }
    function boundsContain(boundsA, boundsB) {
      return boundsA.north >= boundsB.north && boundsA.south <= boundsB.south && boundsA.east >= boundsB.east && boundsA.west <= boundsB.west;
    }
    function updateArtworkMarkersDebounced(delay = 0) {
      if (markerUpdateTimeout.value) {
        clearTimeout(markerUpdateTimeout.value);
      }
      markerUpdateTimeout.value = setTimeout(() => {
        if (map.value && !isZoomAnimating.value) {
          updateArtworkMarkers();
        } else if (isZoomAnimating.value) {
          updateArtworkMarkersDebounced(100);
        }
      }, delay);
    }
    function updateArtworkMarkers() {
      if (!map.value) {
        return;
      }
      if (isZoomAnimating.value) {
        updateArtworkMarkersDebounced(100);
        return;
      }
      if (mapContainer.value && map.value) {
        const containerRect = mapContainer.value.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) {
          setTimeout(() => {
            map.value?.invalidateSize();
            updateArtworkMarkers();
          }, 100);
          return;
        }
        if (map.value && !map.value.getContainer()) {
          setTimeout(() => updateArtworkMarkers(), 100);
          return;
        }
      }
      buildWebGLClusters();
    }
    function updateMarkerStyles() {
      return;
    }
    async function configureMarkerGroup() {
      if (!map.value) return;
      buildWebGLClusters();
    }
    function handleMapMove() {
      if (!map.value) return;
      const center = map.value.getCenter();
      const coordinates = {
        latitude: center.lat,
        longitude: center.lng
      };
      artworksStore.setMapCenter(coordinates);
      buildWebGLClusters();
      if (loadArtworksTimeout.value) {
        clearTimeout(loadArtworksTimeout.value);
      }
      loadArtworksTimeout.value = setTimeout(() => {
        loadArtworks();
      }, 500);
      loadingTimeout.value = setTimeout(() => {
        if (!isLoadingViewport.value && map.value) {
          isLoadingViewport.value = true;
        }
      }, 100);
    }
    function onWebGLMarkerClick(f) {
      try {
        const markerId = f && f.properties && f.properties.id ? f.properties.id : null;
        if (!markerId) return;
        (async () => {
          try {
            const details = await artworksStore.fetchArtwork(markerId);
            let thumb = void 0;
            if (details) {
              const dphotos = details.photos;
              if (Array.isArray(dphotos) && dphotos.length) {
                const p0 = dphotos[0];
                if (typeof p0 === "string") thumb = p0;
                else if (p0 && typeof p0 === "object") thumb = p0.url || p0.thumbnail_url || void 0;
              } else if (details.recent_photo && typeof details.recent_photo === "string") {
                thumb = details.recent_photo;
              }
            }
            const artworkPin = (props.artworks || []).find((a) => a.id === markerId);
            if (!artworkPin && !details) return;
            const thumbnailUrl = thumb || artworkPin && Array.isArray(artworkPin.photos) && artworkPin.photos[0] || void 0;
            const previewData = {
              id: markerId,
              title: details && details.title || artworkPin && artworkPin.title || "Untitled Artwork",
              description: details && details.description || artworkPin && artworkPin.type || "Public artwork",
              type_name: details && (details.type_name || details.type) || artworkPin && (artworkPin.type || artworkPin.type_name) || "artwork",
              thumbnailUrl,
              artistName: details && (details.artist_name || details.artist || details.created_by) || artworkPin && (artworkPin.artist_name || artworkPin.created_by) || void 0,
              lat: artworkPin && artworkPin.latitude || details && (details.latitude || details.lat),
              lon: artworkPin && artworkPin.longitude || details && (details.longitude || details.lon)
            };
            emit("previewArtwork", previewData);
          } catch (err) {
            const artwork = (props.artworks || []).find((a) => a.id === markerId);
            if (!artwork) return;
            const thumb = Array.isArray(artwork.photos) ? artwork.photos[0] : artwork.recent_photo;
            const thumbnailUrl = thumb || void 0;
            const previewData = {
              id: artwork.id,
              title: artwork.title || "Untitled Artwork",
              description: artwork.type || "Public artwork",
              type_name: artwork.type || artwork.type_name || "artwork",
              thumbnailUrl,
              artistName: artwork.artist_name || artwork.created_by || void 0,
              lat: artwork.latitude,
              lon: artwork.longitude
            };
            emit("previewArtwork", previewData);
          }
        })();
      } catch (err) {
      }
    }
    try {
      if (typeof window !== "undefined") {
        window.__ca_test_trigger_marker_click = (id) => {
          try {
            const artwork = (props.artworks || []).find((a) => a.id === id);
            if (!artwork) return;
            onWebGLMarkerClick({ properties: { id } });
          } catch (e) {
          }
        };
      }
    } catch (e) {
    }
    function onWebGLClusterClick(feature) {
      try {
        if (!map.value || !feature || !feature.geometry) return;
        const lon = feature.geometry.coordinates[0];
        const lat = feature.geometry.coordinates[1];
        const currentZoom = map.value.getZoom() || props.zoom || 15;
        const newZoom = Math.min(currentZoom + 2, 19);
        try {
          map.value.setView([lat, lon], newZoom, { animate: true });
        } catch (e) {
          try {
            map.value.setView([lat, lon], newZoom);
          } catch (_) {
          }
        }
        try {
          emit("mapMove", { center: { latitude: lat, longitude: lon }, zoom: newZoom });
        } catch (e) {
        }
      } catch (err) {
      }
    }
    function handleApplySettings() {
      updateArtworkMarkers();
    }
    function removeDebugRings() {
      if (!map.value) return;
      if (debugImmediateRing) {
        try {
          map.value.removeLayer(debugImmediateRing);
        } catch {
        }
        debugImmediateRing = null;
      }
    }
    function updateDebugRings() {
      if (!map.value) return;
      if (!debugRingsEnabled.value) {
        removeDebugRings();
        return;
      }
      const center = map.value.getCenter();
      if (!debugImmediateRing) {
        debugImmediateRing = L.circle([center.lat, center.lng], {
          radius: 100,
          color: "#dc2626",
          // red-600
          weight: 2,
          fill: false,
          dashArray: "6,6",
          interactive: false
        }).addTo(map.value);
      } else {
        debugImmediateRing.setLatLng([center.lat, center.lng]);
        debugImmediateRing.setRadius(100);
      }
    }
    if (typeof window !== "undefined") {
      window.viewArtworkDetails = (artworkId) => {
        router.push(`/artwork/${artworkId}`);
      };
    }
    watch(
      () => props.artworks,
      (_newArtworks) => {
        updateArtworkMarkersDebounced(25);
        buildWebGLClusters();
      },
      { deep: true }
    );
    watch(
      () => props.center,
      (newCenter) => {
        if (newCenter && map.value) {
          const current = map.value.getCenter();
          if (Math.abs(current.lat - newCenter.latitude) > 1e-6 || Math.abs(current.lng - newCenter.longitude) > 1e-6) {
            map.value.setView([newCenter.latitude, newCenter.longitude], map.value.getZoom());
          }
        }
      }
    );
    watch(
      () => props.zoom,
      (newZoom) => {
        if (map.value && typeof newZoom === "number" && newZoom !== map.value.getZoom()) {
          map.value.setZoom(newZoom);
        }
      }
    );
    const handleResize = () => {
      if (map.value) {
        map.value.invalidateSize();
      }
    };
    function handleNavRailToggle(_evt) {
      if (!map.value) return;
      const attempts = [0, 50, 150, 350];
      for (const t of attempts) {
        setTimeout(() => {
          try {
            map.value?.invalidateSize();
          } catch (e) {
          }
        }, t);
      }
    }
    watch(
      () => mapContainer.value,
      (newContainer) => {
        if (newContainer && map.value) {
          nextTick(() => {
            map.value?.invalidateSize();
          });
        }
      }
    );
    onMounted(async () => {
      await nextTick();
      try {
        log.debug("[ICON ATLAS] Starting icon atlas creation...");
        const iconConfigs = [
          { name: "default", svg: DEFAULT_ICONS.default || "", size: 64 },
          { name: "sculpture", svg: DEFAULT_ICONS.sculpture || "", size: 64 },
          { name: "mural", svg: DEFAULT_ICONS.mural || "", size: 64 },
          { name: "installation", svg: DEFAULT_ICONS.installation || "", size: 64 },
          { name: "cluster", svg: DEFAULT_ICONS.cluster || "", size: 64 },
          { name: "visited", svg: DEFAULT_ICONS.visited || "", size: 64 },
          { name: "starred", svg: DEFAULT_ICONS.starred || "", size: 64 },
          { name: "submissions", svg: DEFAULT_ICONS.submissions || "", size: 64 }
        ];
        iconAtlas.value = await createIconAtlas(iconConfigs);
        log.debug("[ICON ATLAS] Icon atlas created successfully:", {
          atlasExists: !!iconAtlas.value,
          icons: iconAtlas.value ? Object.keys(iconAtlas.value.icons) : []
        });
      } catch (err) {
        log.error("[ICON ATLAS] Failed to create icon atlas:", err);
      }
      await initializeMap();
      if (typeof window !== "undefined") {
        window.addEventListener("resize", handleResize);
        window.addEventListener("nav-rail-toggle", handleNavRailToggle);
      }
      try {
        if (map.value) {
          webglMoveHandler = () => buildWebGLClusters();
          webglZoomHandler = () => buildWebGLClusters();
          map.value.on("moveend", webglMoveHandler);
          map.value.on("zoomend", webglZoomHandler);
        }
      } catch (e) {
      }
    });
    onUnmounted(() => {
      if (loadingTimeout.value) {
        clearTimeout(loadingTimeout.value);
        loadingTimeout.value = null;
      }
      if (markerUpdateTimeout.value) {
        clearTimeout(markerUpdateTimeout.value);
        markerUpdateTimeout.value = null;
      }
      if (zoomStyleTimeout.value) {
        clearTimeout(zoomStyleTimeout.value);
        zoomStyleTimeout.value = null;
      }
      if (loadArtworksTimeout.value) {
        clearTimeout(loadArtworksTimeout.value);
        loadArtworksTimeout.value = null;
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("nav-rail-toggle", handleNavRailToggle);
      }
      if (map.value) {
        try {
          map.value.off("moveend");
          map.value.off("zoomend");
          map.value.off("zoomstart");
          map.value.off("zoom");
          map.value.off("locationfound");
          map.value.off("locationerror");
        } catch (e) {
          log.warn("Error removing map event listeners:", e);
        }
        try {
          if (webglMoveHandler) map.value.off("moveend", webglMoveHandler);
          if (webglZoomHandler) map.value.off("zoomend", webglZoomHandler);
        } catch {
        }
        try {
          map.value.remove();
        } catch (e) {
          log.warn("Error removing map:", e);
        }
        map.value = void 0;
      }
    });
    watch(
      () => Array.from(visitedArtworks.value).join(","),
      () => updateArtworkMarkersDebounced(25)
    );
    watch(
      () => Array.from(starredArtworks.value).join(","),
      () => updateArtworkMarkersDebounced(25)
    );
    watch(
      () => effectiveClusterEnabled.value,
      async () => {
        await configureMarkerGroup();
        buildWebGLClusters();
      }
    );
    watch(
      () => [
        mapFilters.filtersState.artworkTypes,
        mapFilters.filtersState.statusFilters,
        mapFilters.filtersState.userListFilters,
        mapFilters.filtersState.showOnlyMySubmissions,
        mapFilters.filtersState.hideVisited,
        mapFilters.filtersState.showRemoved,
        mapFilters.filtersState.showArtworksWithoutPhotos
      ],
      () => {
        buildWebGLClusters();
      },
      { deep: true }
    );
    watch(
      () => Array.from(visitedArtworks.value).join(","),
      () => {
        updateArtworkMarkersDebounced(25);
      }
    );
    watch(
      () => Array.from(starredArtworks.value).join(","),
      () => {
        updateArtworkMarkersDebounced(25);
      }
    );
    watch(
      () => [
        mapFilters.filtersState.artworkTypes,
        mapFilters.filtersState.statusFilters,
        mapFilters.filtersState.userListFilters,
        mapFilters.filtersState.showOnlyMySubmissions,
        // clusterEnabled removed from direct persistence/watch. Keep other filter dependencies below.
        mapFilters.filtersState.hideVisited,
        mapFilters.filtersState.showRemoved,
        mapFilters.filtersState.showArtworksWithoutPhotos
      ],
      () => {
        updateArtworkMarkersDebounced(25);
      },
      { deep: true }
    );
    watch(
      [() => visitedArtworks.value, () => starredArtworks.value],
      () => {
        buildWebGLClusters();
      },
      { deep: true }
    );
    watch(
      () => mapSettings.clusteringEnabled,
      () => {
        buildWebGLClusters();
      }
    );
    watch(
      () => debugRingsEnabled.value,
      () => {
        try {
          localStorage.setItem("map:debugRingsEnabled", String(debugRingsEnabled.value));
        } catch {
        }
        updateDebugRings();
      }
    );
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<!--[--><div class="${ssrRenderClass(["map-component h-full w-full relative", { "webgl-active": true }])}"><div class="${ssrRenderClass([{ "opacity-50": isLoading.value }, "h-full w-full relative z-0"])}" role="application" aria-label="Interactive map showing public artwork locations"${ssrRenderAttr("aria-busy", isLoading.value)}></div>`);
      if (map.value && props.artworks && props.artworks.length > 0 && iconAtlas.value) {
        _push(ssrRenderComponent(MapWebGLLayer, {
          map: map.value,
          clusters: webglClusters.value,
          "icon-atlas": iconAtlas.value,
          onClusterClick: onWebGLClusterClick,
          onMarkerClick: onWebGLMarkerClick
        }, null, _parent));
      } else {
        _push(`<!---->`);
      }
      if (isLoading.value) {
        _push(`<div class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10" role="status" aria-live="polite"><div class="flex flex-col items-center space-y-2"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-hidden="true"></div><p class="text-sm text-gray-600">Loading map...</p></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (isLoadingViewport.value && !isLoading.value) {
        _push(`<div class="absolute top-4 right-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-2 shadow-md z-15" role="status" aria-live="polite"><div class="flex items-center space-x-2"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" aria-hidden="true"></div><p class="text-xs text-gray-600">Loading artworks...</p></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (isProgressiveLoading.value && progressiveLoadingStats.value) {
        _push(`<div class="absolute top-4 right-4 bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-3 shadow-lg z-15" role="status" aria-live="polite"><div class="flex items-center space-x-2 mb-2"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" aria-hidden="true"></div><p class="text-xs text-gray-700 font-medium">Progressive Loading</p></div><div class="space-y-1"><div class="flex justify-between text-xs text-gray-600"><span>${ssrInterpolate(progressiveLoadingStats.value.loaded)} loaded</span><span>${ssrInterpolate(progressiveLoadingStats.value.percentage)}%</span></div><div class="w-full bg-gray-200 rounded-full h-1.5"><div class="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out" style="${ssrRenderStyle({ width: `${progressiveLoadingStats.value.percentage}%` })}"></div></div>`);
        if (progressiveLoadingStats.value.batchSize || progressiveLoadingStats.value.avgTime) {
          _push(`<div class="flex justify-between text-xs text-gray-500 pt-1">`);
          if (progressiveLoadingStats.value.batchSize) {
            _push(`<span>Batch: ${ssrInterpolate(progressiveLoadingStats.value.batchSize)}</span>`);
          } else {
            _push(`<!---->`);
          }
          if (progressiveLoadingStats.value.avgTime) {
            _push(`<span>${ssrInterpolate(Math.round(progressiveLoadingStats.value.avgTime))}ms avg</span>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showLocationNotice.value) {
        _push(`<div class="absolute top-4 left-4 bg-yellow-50/95 border border-yellow-300 rounded-lg z-30 shadow-md backdrop-blur-sm max-w-xs" role="alert" aria-live="assertive" aria-atomic="true"><div class="flex items-center gap-3 px-3 py-2">`);
        _push(ssrRenderComponent(unref(ExclamationTriangleIcon), { class: "w-5 h-5 text-yellow-600 flex-shrink-0" }, null, _parent));
        _push(`<div class="flex-1 min-w-0"><p class="text-sm text-yellow-900 font-semibold truncate">Location Access Needed</p><p class="text-xs text-yellow-800 truncate"> Enable location access to see nearby artworks and improve your experience. </p></div><div class="flex-shrink-0 ml-2 flex items-center space-x-2"><button class="text-xs bg-yellow-700 text-white px-2 py-1 rounded hover:bg-yellow-800 focus:bg-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 transition-colors"> Enable </button></div></div><div class="px-3 pb-2"><a href="/help#location-access-faq" class="text-xs text-yellow-700 underline hover:text-yellow-800 focus:text-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 rounded px-1"> Why is this needed? </a></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (unref(mapFilters).hasActiveFilters.value && !props.suppressFilterBanner) {
        _push(`<div class="absolute top-4 left-4 right-24 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-md z-10 pointer-events-auto" role="status" aria-live="polite"><div class="flex items-center justify-between"><div class="flex items-center space-x-2"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg><span class="text-sm text-blue-800 font-medium">${ssrInterpolate(unref(mapFilters).activeFilterCount.value)} filter${ssrInterpolate(unref(mapFilters).activeFilterCount.value === 1 ? "" : "s")} active </span></div><button class="text-xs text-blue-600 hover:text-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 px-2 py-1 rounded transition-colors" title="Clear all filters"> Clear </button></div><p class="text-xs text-blue-700 mt-1">${ssrInterpolate(unref(mapFilters).activeFilterDescription.value)}</p></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="absolute top-4 right-4 flex flex-col space-y-2 z-20"><div class="relative"><button class="theme-surface shadow-md rounded-full p-3 hover:theme-surface-hover focus:theme-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" title="Map settings" aria-label="Open map settings">`);
      _push(ssrRenderComponent(unref(Squares2X2Icon), { class: "w-5 h-5 text-gray-700" }, null, _parent));
      _push(`</button></div>`);
      if (hasGeolocation.value) {
        _push(`<button${ssrIncludeBooleanAttr(isLocating.value) ? " disabled" : ""} class="${ssrRenderClass(["theme-surface shadow-md rounded-full p-3 hover:theme-surface-hover focus:theme-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 relative", isTracking.value ? "ring-4 ring-blue-300" : ""])}"${ssrRenderAttr("title", isLocating.value ? "Getting location..." : isTracking.value ? "Stop tracking location" : "Center on current location")}${ssrRenderAttr("aria-label", isLocating.value ? "Getting current location..." : isTracking.value ? "Stop tracking location" : "Center map on current location")}>`);
        if (!isLocating.value) {
          _push(`<!--[-->`);
          if (!isLocating.value) {
            _push(`<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 20v-1a4 4 0 014-4h4a4 4 0 014 4v1"></path></svg>`);
          } else {
            _push(`<!---->`);
          }
          if (isTracking.value && !isLocating.value) {
            _push(`<div class="w-3 h-3 rounded-full bg-blue-600 absolute" style="${ssrRenderStyle({ "transform": "translate(10px, -10px)" })}"></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<!--]-->`);
        } else {
          _push(`<div class="w-5 h-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>`);
        }
        _push(`</button>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="theme-surface shadow-md rounded-lg overflow-hidden"><button class="block w-full px-3 py-2 text-gray-700 hover:theme-surface-hover focus:theme-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors border-b border-gray-200" title="Zoom in" aria-label="Zoom in on map">`);
      _push(ssrRenderComponent(unref(PlusIcon), {
        class: "w-4 h-4 mx-auto",
        "aria-hidden": "true"
      }, null, _parent));
      _push(`</button><button class="block w-full px-3 py-2 text-gray-700 hover:theme-surface-hover focus:theme-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors" title="Zoom out" aria-label="Zoom out on map">`);
      _push(ssrRenderComponent(unref(MinusIcon), {
        class: "w-4 h-4 mx-auto",
        "aria-hidden": "true"
      }, null, _parent));
      _push(`</button></div></div>`);
      if (error.value) {
        _push(`<div class="absolute top-4 left-4 right-4 bg-red-100 border border-red-300 rounded-lg p-3 z-20" role="alert" aria-live="assertive"><div class="flex items-start space-x-2">`);
        _push(ssrRenderComponent(unref(ExclamationCircleIcon), { class: "w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" }, null, _parent));
        _push(`<div class="flex-1"><p class="text-sm text-red-800 font-medium">Map Error</p><p class="text-xs text-red-700">${ssrInterpolate(error.value)}</p><button class="mt-2 text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"> Retry </button></div><button class="text-red-600 hover:text-red-800" aria-label="Dismiss error">`);
        _push(ssrRenderComponent(unref(XMarkIcon), { class: "w-4 h-4" }, null, _parent));
        _push(`</button></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
      _push(ssrRenderComponent(MapOptionsModal, {
        isOpen: showOptionsModal.value,
        "onUpdate:isOpen": (val) => {
          showOptionsModal.value = val;
          if (val) unref(mapPreviewStore).hidePreview();
        },
        onApplySettings: handleApplySettings
      }, null, _parent));
      _push(`<!--]-->`);
    };
  }
});

const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/MapComponent.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "MapFiltersModal",
  __ssrInlineRender: true,
  props: {
    isOpen: { type: Boolean },
    cacheTelemetry: {}
  },
  emits: ["update:isOpen", "filtersChanged", "clearListCaches", "resetCacheTelemetry"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const mapFilters = useMapFilters();
    const mapSettings = useMapSettings();
    const authStore = useAuthStore();
    useRouter();
    const isLoadingData = ref(false);
    const showAdvancedFeatures = ref(false);
    const showMetrics = ref(false);
    const newPresetName = ref("");
    ref(null);
    const isAuthenticated = computed(() => authStore.isAuthenticated);
    const hasUserLists = computed(() => mapFilters.availableUserLists.value.length > 0);
    function closeModal() {
      emit("update:isOpen", false);
    }
    function formatDuration(seconds) {
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
    watch(() => props.isOpen, async (isOpen) => {
      if (isOpen && isAuthenticated.value) {
        isLoadingData.value = true;
        try {
          await mapFilters.loadUserLists();
        } catch (error) {
          console.error("Error loading user lists:", error);
        } finally {
          isLoadingData.value = false;
        }
      }
    });
    const handleKeydown = (event) => {
      if (event.key === "Escape" && props.isOpen) {
        closeModal();
      }
    };
    onMounted(() => {
      if (isClient) document.addEventListener("keydown", handleKeydown);
    });
    onUnmounted(() => {
      if (isClient) document.removeEventListener("keydown", handleKeydown);
    });
    return (_ctx, _push, _parent, _attrs) => {
      if (_ctx.isOpen) {
        _push(`<div${ssrRenderAttrs(mergeProps({ class: "fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50 flex items-center justify-center" }, _attrs))} data-v-495d769f><div class="bg-white w-full h-full max-w-full max-h-full flex flex-col md:w-[90vw] md:h-[90vh] md:max-w-4xl md:rounded-lg md:shadow-xl" data-v-495d769f><div class="px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0" data-v-495d769f><div class="flex items-center justify-between" data-v-495d769f><div class="flex items-center" data-v-495d769f>`);
        _push(ssrRenderComponent(unref(AdjustmentsHorizontalIcon), { class: "h-6 w-6 text-blue-600 mr-3" }, null, _parent));
        _push(`<div data-v-495d769f><h2 class="text-lg font-semibold text-gray-900" data-v-495d769f>Map Filters</h2><p class="text-xs text-gray-600 mt-1" data-v-495d769f>Control which artworks are displayed on the map</p></div></div><button class="p-2 hover:bg-gray-200 rounded-full transition-colors" aria-label="Close filters" data-v-495d769f>`);
        _push(ssrRenderComponent(unref(XMarkIcon), { class: "h-6 w-6 text-gray-500" }, null, _parent));
        _push(`</button></div>`);
        if (unref(mapFilters).hasActiveFilters.value) {
          _push(`<div class="flex items-center justify-between mt-4" data-v-495d769f><div class="text-sm text-gray-600" data-v-495d769f>${ssrInterpolate(unref(mapFilters).activeFilterDescription.value)}</div><button class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 transition-colors" data-v-495d769f> Reset All Filters </button></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div class="flex-1 overflow-y-auto min-h-0" data-v-495d769f><div class="px-6 py-6 space-y-8" data-v-495d769f><div class="bg-blue-50 border border-blue-200 rounded-lg p-4" data-v-495d769f><h3 class="text-sm font-semibold text-blue-900 mb-2 flex items-center" data-v-495d769f><svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" data-v-495d769f><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" data-v-495d769f></path></svg> How Map Filters Work </h3><div class="text-xs text-blue-800 space-y-2" data-v-495d769f><p data-v-495d769f><strong data-v-495d769f>List Filters (OR logic):</strong> When multiple list filters are active, artworks from ANY selected list will be shown.</p><p data-v-495d769f><strong data-v-495d769f>&quot;Not Seen by Me&quot; (Subtractive):</strong> This filter removes visited artworks from the result set and is always applied last.</p><p data-v-495d769f><strong data-v-495d769f>Visual Priority:</strong> Markers show status - gray for visited, gold for &quot;Want to See&quot;, colored for type-based defaults.</p></div></div><div class="border-b border-gray-200" data-v-495d769f><h3 class="text-base font-semibold text-gray-900 mb-4" data-v-495d769f>Display Options</h3><div class="space-y-4" data-v-495d769f><div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg" data-v-495d769f><label class="relative inline-flex items-center cursor-pointer" data-v-495d769f><input type="checkbox"${ssrIncludeBooleanAttr(unref(mapFilters).filtersState.showArtworksWithoutPhotos) ? " checked" : ""} class="sr-only peer" data-v-495d769f><div class="${ssrRenderClass([unref(mapFilters).filtersState.showArtworksWithoutPhotos ? "bg-blue-600 border-blue-600 shadow-md" : "bg-gray-100 border-gray-300 shadow-inner", "w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2 cursor-pointer"])}" data-v-495d769f><div class="${ssrRenderClass([unref(mapFilters).filtersState.showArtworksWithoutPhotos ? "translate-x-5 bg-white" : "translate-x-0 bg-gray-50", "dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200 pointer-events-none"])}" data-v-495d769f></div></div></label><div class="flex-1" data-v-495d769f><div class="flex items-center" data-v-495d769f><span class="text-sm font-medium text-gray-900" data-v-495d769f>Show artworks without photos</span></div><p class="text-xs mt-1 text-gray-600" data-v-495d769f>When off, artworks that do not have photos yet are hidden from the map.</p></div></div><div class="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg" data-v-495d769f><label class="relative inline-flex items-center cursor-pointer" data-v-495d769f><input type="checkbox"${ssrIncludeBooleanAttr(unref(mapSettings).clusteringEnabled) ? " checked" : ""} class="sr-only peer" data-v-495d769f><div class="${ssrRenderClass([unref(mapSettings).clusteringEnabled ? "bg-blue-600 border-blue-600 shadow-md" : "bg-gray-100 border-gray-300 shadow-inner", "w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2 cursor-pointer"])}" data-v-495d769f><div class="${ssrRenderClass([unref(mapSettings).clusteringEnabled ? "translate-x-5 bg-white" : "translate-x-0 bg-gray-50", "dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200 pointer-events-none"])}" data-v-495d769f></div></div></label><div class="flex-1" data-v-495d769f><div class="flex items-center" data-v-495d769f><span class="text-sm font-medium text-gray-900" data-v-495d769f>Enable marker clustering</span></div><p class="text-xs mt-1 text-gray-600" data-v-495d769f>Group nearby markers into clusters when zoomed out to improve map performance and readability.</p></div></div></div></div>`);
        if (!isAuthenticated.value) {
          _push(`<div class="text-center py-8" data-v-495d769f><div class="bg-amber-50 border border-amber-200 rounded-lg p-6" data-v-495d769f><svg class="w-12 h-12 text-amber-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-495d769f><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" data-v-495d769f></path></svg><h3 class="text-lg font-medium text-amber-900 mb-2" data-v-495d769f>Sign In for Advanced Filtering</h3><p class="text-sm text-amber-800 mb-4" data-v-495d769f>Unlock powerful filtering features like &quot;Want to See&quot; lists and custom list filtering by signing in to your account.</p><p class="text-xs text-amber-700" data-v-495d769f>Display options like marker clustering are available without signing in. </p></div></div>`);
        } else {
          _push(`<div class="space-y-8" data-v-495d769f><p class="text-sm text-green-600" data-v-495d769f>✓ Signed in - All filtering features available</p><div data-v-495d769f><h3 class="text-lg font-bold text-gray-900 mb-6 flex items-center" data-v-495d769f><svg class="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-495d769f><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" data-v-495d769f></path></svg> Filters </h3><div data-v-495d769f><h4 class="text-base font-semibold text-gray-900 mb-4" data-v-495d769f>System Lists</h4><div class="space-y-4" data-v-495d769f><div class="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" data-v-495d769f><label class="relative inline-flex items-center cursor-pointer" data-v-495d769f><input type="checkbox"${ssrIncludeBooleanAttr(unref(mapFilters).isFilterEnabled("wantToSee")) ? " checked" : ""} class="sr-only" data-v-495d769f><div class="${ssrRenderClass([unref(mapFilters).isFilterEnabled("wantToSee") ? "bg-blue-600 border-blue-600 shadow-md" : "bg-gray-100 border-gray-300 shadow-inner", "w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 transition-colors border-2"])}" data-v-495d769f><div class="${ssrRenderClass([unref(mapFilters).isFilterEnabled("wantToSee") ? "translate-x-5 bg-white" : "translate-x-0 bg-gray-50", "dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200"])}" data-v-495d769f></div></div></label><div class="flex-1" data-v-495d769f><div class="flex items-center" data-v-495d769f><h4 class="text-sm font-medium text-gray-900" data-v-495d769f>Want to See</h4>`);
          if (unref(mapFilters).isFilterEnabled("wantToSee")) {
            _push(`<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800" data-v-495d769f> Active </span>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div><p class="text-xs mt-1 text-gray-600" data-v-495d769f> Display only artworks you&#39;ve saved to your &quot;Want to See&quot; wishlist. Perfect for planning art exploration routes. </p></div></div><div class="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" data-v-495d769f><label class="relative inline-flex items-center cursor-pointer" data-v-495d769f><input type="checkbox"${ssrIncludeBooleanAttr(unref(mapFilters).isFilterEnabled("notSeenByMe")) ? " checked" : ""} class="sr-only" data-v-495d769f><div class="${ssrRenderClass([unref(mapFilters).isFilterEnabled("notSeenByMe") ? "bg-orange-600 border-orange-600 shadow-md" : "bg-gray-100 border-gray-300 shadow-inner", "w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-orange-500 transition-colors border-2"])}" data-v-495d769f><div class="${ssrRenderClass([unref(mapFilters).isFilterEnabled("notSeenByMe") ? "translate-x-5 bg-white" : "translate-x-0 bg-gray-50", "dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200"])}" data-v-495d769f></div></div></label><div class="flex-1" data-v-495d769f><div class="flex items-center" data-v-495d769f><h4 class="text-sm font-medium text-gray-900" data-v-495d769f>Not Seen by Me</h4>`);
          if (unref(mapFilters).isFilterEnabled("notSeenByMe")) {
            _push(`<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800" data-v-495d769f> Active </span>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div><p class="text-xs mt-1 text-gray-600" data-v-495d769f> Hide artworks you&#39;ve already visited or logged. Great for discovering new locations in familiar areas. </p></div></div></div></div>`);
          if (hasUserLists.value) {
            _push(`<div data-v-495d769f><h4 class="text-base font-semibold text-gray-900 mb-4" data-v-495d769f>Your Custom Lists</h4><div class="space-y-3" data-v-495d769f><!--[-->`);
            ssrRenderList(unref(mapFilters).availableUserLists.value, (list) => {
              _push(`<div class="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" data-v-495d769f><div class="relative inline-flex items-center" data-v-495d769f><input type="checkbox"${ssrIncludeBooleanAttr(unref(mapFilters).isFilterEnabled(`list:${list.id}`)) ? " checked" : ""} class="sr-only"${ssrRenderAttr("id", `toggle-${list.id}`)}${ssrRenderAttr("aria-labelledby", `label-${list.id}`)} data-v-495d769f><div class="${ssrRenderClass([unref(mapFilters).isFilterEnabled(`list:${list.id}`) ? "bg-green-600 border-green-600 shadow-md" : "bg-gray-100 border-gray-300 shadow-inner", "w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-green-500 transition-colors border-2 cursor-pointer"])}"${ssrRenderAttr("aria-label", `Toggle ${list.name} filter`)} role="button"${ssrRenderAttr("aria-pressed", unref(mapFilters).isFilterEnabled(`list:${list.id}`))} tabindex="0" data-v-495d769f><div class="${ssrRenderClass([unref(mapFilters).isFilterEnabled(`list:${list.id}`) ? "translate-x-5 bg-white" : "translate-x-0 bg-gray-50", "dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow-lg border border-gray-200"])}" data-v-495d769f></div></div></div><div class="flex-1" data-v-495d769f><div class="flex items-center justify-between" data-v-495d769f><div class="flex items-center" data-v-495d769f><h4 class="text-sm font-medium text-gray-900" data-v-495d769f>${ssrInterpolate(list.name)}</h4>`);
              if (unref(mapFilters).isFilterEnabled(`list:${list.id}`)) {
                _push(`<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800" data-v-495d769f> Active </span>`);
              } else {
                _push(`<!---->`);
              }
              _push(`</div><button class="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors" title="View this list" data-v-495d769f><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-495d769f><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" data-v-495d769f></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" data-v-495d769f></path></svg> View List </button></div><p class="text-xs mt-1 text-gray-600" data-v-495d769f>${ssrInterpolate(list.item_count || 0)} item${ssrInterpolate((list.item_count || 0) !== 1 ? "s" : "")}</p></div></div>`);
            });
            _push(`<!--]--></div></div>`);
          } else {
            _push(`<div class="text-center py-8" data-v-495d769f><div class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6" data-v-495d769f><svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-495d769f><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" data-v-495d769f></path></svg><h3 class="text-sm font-medium text-gray-900 mb-2" data-v-495d769f>No Custom Lists Yet</h3><p class="text-xs text-gray-500 mb-4" data-v-495d769f>Create custom lists to organize artworks by theme, location, or any criteria that matters to you.</p><p class="text-xs text-gray-400" data-v-495d769f>Visit artwork detail pages to add items to lists, or create new lists from your profile.</p></div></div>`);
          }
          if (showAdvancedFeatures.value) {
            _push(`<div data-v-495d769f><h3 class="text-base font-semibold text-gray-900 mb-4" data-v-495d769f>Filter Presets</h3>`);
            if (unref(mapFilters).recentlyUsedFilters.value?.length > 0) {
              _push(`<div class="mb-4" data-v-495d769f><h4 class="text-sm font-medium text-gray-700 mb-2" data-v-495d769f>Recently Used</h4><div class="flex flex-wrap gap-2" data-v-495d769f><!--[-->`);
              ssrRenderList(unref(mapFilters).recentlyUsedFilters.value.slice(0, 3), (recent) => {
                _push(`<button class="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors" data-v-495d769f>${ssrInterpolate(recent.label)} (${ssrInterpolate(recent.count)}) </button>`);
              });
              _push(`<!--]--></div></div>`);
            } else {
              _push(`<!---->`);
            }
            if (unref(mapFilters).filterPresets.value?.length > 0) {
              _push(`<div class="mb-4" data-v-495d769f><h4 class="text-sm font-medium text-gray-700 mb-2" data-v-495d769f>Saved Presets</h4><div class="space-y-2" data-v-495d769f><!--[-->`);
              ssrRenderList(unref(mapFilters).filterPresets.value, (preset) => {
                _push(`<div class="flex items-center justify-between p-2 bg-gray-50 rounded-md" data-v-495d769f><div class="flex-1" data-v-495d769f><div class="text-sm font-medium text-gray-900" data-v-495d769f>${ssrInterpolate(preset.name)}</div><div class="text-xs text-gray-500" data-v-495d769f>${ssrInterpolate(preset.description)}</div></div><div class="flex items-center space-x-2" data-v-495d769f><button class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" data-v-495d769f> Apply </button><button class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700" data-v-495d769f> Delete </button></div></div>`);
              });
              _push(`<!--]--></div></div>`);
            } else {
              _push(`<!---->`);
            }
            _push(`<div class="space-y-3" data-v-495d769f><div class="flex items-center space-x-2" data-v-495d769f><input${ssrRenderAttr("value", newPresetName.value)} type="text" placeholder="Preset name..." class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" data-v-495d769f><button${ssrIncludeBooleanAttr(!newPresetName.value.trim()) ? " disabled" : ""} class="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed" data-v-495d769f> Save Current </button></div></div></div>`);
          } else {
            _push(`<!---->`);
          }
          if (showAdvancedFeatures.value) {
            _push(`<div data-v-495d769f><h3 class="text-base font-semibold text-gray-900 mb-4" data-v-495d769f>Export/Import</h3><div class="space-y-3" data-v-495d769f><div class="flex items-center space-x-2" data-v-495d769f><button class="px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700" data-v-495d769f> Export Config </button><input type="file" accept=".json" class="hidden" data-v-495d769f><button class="px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700" data-v-495d769f> Import Config </button></div></div></div>`);
          } else {
            _push(`<!---->`);
          }
          if (showAdvancedFeatures.value && showMetrics.value) {
            _push(`<div data-v-495d769f><h3 class="text-base font-semibold text-gray-900 mb-4" data-v-495d769f>Performance Metrics</h3><div class="bg-gray-50 p-3 rounded-md space-y-2" data-v-495d769f><div class="flex justify-between text-xs" data-v-495d769f><span class="text-gray-600" data-v-495d769f>Session Duration:</span><span class="font-medium" data-v-495d769f>${ssrInterpolate(formatDuration(unref(mapFilters).getFilterMetrics.value.sessionDuration))}</span></div><div class="flex justify-between text-xs" data-v-495d769f><span class="text-gray-600" data-v-495d769f>Filter Applications:</span><span class="font-medium" data-v-495d769f>${ssrInterpolate(unref(mapFilters).getFilterMetrics.value.totalFilterApplications)}</span></div><div class="flex justify-between text-xs" data-v-495d769f><span class="text-gray-600" data-v-495d769f>Cache Hit Rate:</span><span class="font-medium" data-v-495d769f>${ssrInterpolate(Math.round(unref(mapFilters).getFilterMetrics.value.cacheHitRate * 100))}%</span></div><div class="flex justify-between text-xs" data-v-495d769f><span class="text-gray-600" data-v-495d769f>Most Used Filter:</span><span class="font-medium" data-v-495d769f>${ssrInterpolate(unref(mapFilters).getFilterMetrics.value.mostUsedFilter)}</span></div><div class="flex justify-between text-xs" data-v-495d769f><span class="text-gray-600" data-v-495d769f>List Cache Hits:</span><span class="font-medium" data-v-495d769f>${ssrInterpolate(props.cacheTelemetry?.userListsHit ?? 0)}</span></div><div class="flex justify-between text-xs" data-v-495d769f><span class="text-gray-600" data-v-495d769f>List Cache Misses:</span><span class="font-medium" data-v-495d769f>${ssrInterpolate(props.cacheTelemetry?.userListsMiss ?? 0)}</span></div><div class="flex justify-between text-xs" data-v-495d769f><span class="text-gray-600" data-v-495d769f>Details Cache Hits:</span><span class="font-medium" data-v-495d769f>${ssrInterpolate(props.cacheTelemetry?.listDetailsHit ?? 0)}</span></div><div class="flex justify-between text-xs" data-v-495d769f><span class="text-gray-600" data-v-495d769f>Details Cache Misses:</span><span class="font-medium" data-v-495d769f>${ssrInterpolate(props.cacheTelemetry?.listDetailsMiss ?? 0)}</span></div></div></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div>`);
        }
        if (isAuthenticated.value) {
          _push(`<div class="border-t border-gray-200 pt-4" data-v-495d769f><button class="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors" data-v-495d769f><span data-v-495d769f>Advanced Features</span><svg class="${ssrRenderClass([{ "rotate-180": showAdvancedFeatures.value }, "w-4 h-4 transition-transform"])}" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-495d769f><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" data-v-495d769f></path></svg></button>`);
          if (showAdvancedFeatures.value) {
            _push(`<div class="mt-2 pl-4" data-v-495d769f><label class="flex items-center text-xs text-gray-600" data-v-495d769f><input${ssrIncludeBooleanAttr(Array.isArray(showMetrics.value) ? ssrLooseContain(showMetrics.value, null) : showMetrics.value) ? " checked" : ""} type="checkbox" class="mr-2" data-v-495d769f> Show performance metrics </label><div class="mt-3" data-v-495d769f><button class="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700" data-v-495d769f> Clear list caches </button><button class="ml-3 px-3 py-2 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300" data-v-495d769f> Reset telemetry </button></div></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div><div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex-shrink-0" data-v-495d769f><div class="flex justify-between items-center" data-v-495d769f><div class="text-xs text-gray-500" data-v-495d769f>${ssrInterpolate(unref(mapFilters).hasActiveFilters.value ? "Filters applied to map display" : "No filters currently active")}</div><div class="flex space-x-3" data-v-495d769f><button class="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 transition-colors" data-v-495d769f> Close </button><button class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors" data-v-495d769f> Apply Filters </button></div></div></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/MapFiltersModal.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const MapFiltersModal = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-495d769f"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "MapView",
  __ssrInlineRender: true,
  setup(__props) {
    const router = useRouter();
    const route = useRoute();
    const artworksStore = useArtworksStore();
    const mapPreviewStore = useMapPreviewStore();
    const mapFilters = useMapFilters();
    const currentListId = ref(null);
    const listArtworks = ref([]);
    const listInfo = ref(null);
    const listFilterActive = ref(false);
    const showFiltersModal = ref(false);
    const cacheTelemetryRef = ref(null);
    let bc = null;
    onMounted(() => {
      try {
        if (typeof BroadcastChannel !== "undefined") {
          bc = new BroadcastChannel("map-cache");
          bc.onmessage = (ev) => {
            try {
              const msg = ev.data || {};
              if (msg && msg.type === "telemetry" && msg.payload) {
                cacheTelemetryRef.value = {
                  userListsHit: msg.payload.userListsHit || 0,
                  userListsMiss: msg.payload.userListsMiss || 0,
                  listDetailsHit: msg.payload.listDetailsHit || 0,
                  listDetailsMiss: msg.payload.listDetailsMiss || 0
                };
              } else if (msg && msg.type === "clearCaches") {
                cacheTelemetryRef.value = { userListsHit: 0, userListsMiss: 0, listDetailsHit: 0, listDetailsMiss: 0 };
              }
            } catch (e) {
            }
          };
        }
      } catch (e) {
      }
    });
    onUnmounted(() => {
      try {
        if (bc) {
          bc.close();
          bc = null;
        }
      } catch (e) {
      }
    });
    const mapComponentRef = ref(null);
    const firstTimeModalRef = ref(null);
    const displayedArtworks = ref([]);
    const mapCenter = computed(() => artworksStore.mapCenter);
    const mapZoom = computed(() => artworksStore.mapZoom);
    const hasActiveMapFilters = computed(() => mapFilters.hasActiveFilters.value);
    const artworks = computed(() => {
      console.log("[ARTWORKS COMPUTED] Recomputing artworks:", {
        listFilterActive: listFilterActive.value,
        listArtworksLength: listArtworks.value.length,
        displayedArtworksLength: displayedArtworks.value.length,
        storeArtworksLength: artworksStore.artworks.length,
        hasMapFilters: mapFilters.hasActiveFilters.value,
        refreshTrigger: mapFilters.refreshTrigger.value
        // Force reactivity
      });
      if (listFilterActive.value && listArtworks.value.length > 0) {
        console.log("[MARKER DEBUG] MapView using list-filtered artworks:", {
          listArtworksLength: listArtworks.value.length,
          listId: currentListId.value,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        return listArtworks.value;
      }
      console.log("[ARTWORKS COMPUTED] Using displayedArtworks:", {
        displayedCount: displayedArtworks.value.length,
        hasActiveFilters: mapFilters.hasActiveFilters.value,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return displayedArtworks.value;
    });
    const updateDisplayedArtworks = async () => {
      const storeArtworks = artworksStore.artworks;
      console.log("[MAP FILTERS] updateDisplayedArtworks called:", {
        storeArtworksLength: storeArtworks.length,
        hasActiveFilters: mapFilters.hasActiveFilters.value,
        currentDisplayedLength: displayedArtworks.value.length
      });
      if (mapFilters.hasActiveFilters.value) {
        console.log("[MAP FILTERS] Applying filters to store artworks");
        const filtered = await mapFilters.applyFilters(storeArtworks);
        console.log("[MAP FILTERS] Filtered artworks:", {
          originalCount: storeArtworks.length,
          filteredCount: filtered.length
        });
        displayedArtworks.value = filtered;
      } else {
        console.log("[MAP FILTERS] No active filters, using all store artworks");
        displayedArtworks.value = storeArtworks;
      }
      await nextTick();
      console.log("[MAP FILTERS] Display artworks updated:", {
        finalCount: displayedArtworks.value.length,
        firstFew: displayedArtworks.value.slice(0, 3).map((a) => ({ id: a.id, title: a.title }))
      });
    };
    const currentPreview = computed(() => mapPreviewStore.currentPreview ? mapPreviewStore.currentPreview : null);
    const isPreviewVisible = computed(() => {
      const visible = mapPreviewStore.isVisible;
      console.log("[MAPVIEW DEBUG] Preview visibility computed:", {
        visible,
        hasCurrentPreview: !!mapPreviewStore.currentPreview,
        currentPreviewId: mapPreviewStore.currentPreview?.id,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return visible;
    });
    const shouldShake = ref(false);
    const lastPreviewId = ref(null);
    const previewAsSearchResult = computed(() => {
      if (!currentPreview.value) return null;
      const p = currentPreview.value;
      return {
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        type_name: p.type_name || "artwork",
        // Default type name
        title: p.title,
        artist_name: p.artistName || null,
        tags: {
          description: p.description
        },
        recent_photo: p.thumbnailUrl || null,
        photo_count: p.thumbnailUrl ? 1 : 0,
        distance_km: null
      };
    });
    if (isClient) {
      try {
        window.__ca_test_show_preview = (preview) => {
          try {
            mapPreviewStore.showPreview(preview);
          } catch (e) {
          }
        };
      } catch (e) {
      }
    }
    function handleArtworkClick(artwork) {
      router.push(`/artwork/${artwork.id}`);
    }
    async function loadListArtworks(listId) {
      try {
        listFilterActive.value = true;
        const pageSize = 100;
        let page = 1;
        let accumulated = [];
        let listMeta = null;
        while (true) {
          const resp = await apiService.getListDetails(listId, page, pageSize);
          if (!resp || !resp.success || !resp.data) {
            console.error("Failed to load list page:", page, resp?.error);
            listFilterActive.value = false;
            listArtworks.value = [];
            listInfo.value = null;
            return;
          }
          const data = resp.data;
          if (!listMeta) listMeta = data.list;
          const items = data.items || [];
          accumulated.push(...items);
          if (!data.has_more) break;
          page += 1;
        }
        listInfo.value = listMeta;
        listArtworks.value = accumulated.map((artwork) => ({
          id: artwork.id,
          latitude: artwork.lat,
          longitude: artwork.lon,
          type: artwork.type_name || "other",
          title: artwork.title,
          artist_name: null,
          photos: artwork.photos,
          recent_photo: artwork.photos?.[0]?.url || null,
          photo_count: artwork.photos?.length || 0
        }));
        console.log("[MAP DEBUG] Loaded list artworks:", {
          listId,
          listName: listInfo.value?.name,
          artworkCount: listArtworks.value.length
        });
      } catch (error) {
        console.error("Error loading list artworks:", error);
        listFilterActive.value = false;
        listArtworks.value = [];
        listInfo.value = null;
      }
    }
    function clearListFilter() {
      currentListId.value = null;
      listFilterActive.value = false;
      listArtworks.value = [];
      listInfo.value = null;
    }
    const handleCloseFilters = () => {
      showFiltersModal.value = false;
    };
    const handleFiltersChanged = async () => {
      console.log("[MAP FILTERS] Filters changed event received, updating displayed artworks");
      console.log("[MAP FILTERS] Current filter state:", {
        hasActiveFilters: mapFilters.hasActiveFilters.value,
        wantToSee: mapFilters.filterState.value?.wantToSee,
        notSeenByMe: mapFilters.filterState.value?.notSeenByMe,
        userListsCount: Array.isArray(mapFilters.filterState.value?.userLists) ? mapFilters.filterState.value.userLists.length : 0
      });
      await updateDisplayedArtworks();
    };
    function handleResetCacheTelemetry() {
      try {
        if (mapComponentRef.value && typeof mapComponentRef.value.resetCacheTelemetry === "function") {
          mapComponentRef.value.resetCacheTelemetry();
          if (typeof mapComponentRef.value.getCacheTelemetry === "function") {
            mapFilters.cacheTelemetry = mapComponentRef.value.getCacheTelemetry();
          }
        }
      } catch (e) {
      }
    }
    function handleTelemetryUpdate(t) {
      try {
        cacheTelemetryRef.value = {
          userListsHit: t?.userListsHit || 0,
          userListsMiss: t?.userListsMiss || 0,
          listDetailsHit: t?.listDetailsHit || 0,
          listDetailsMiss: t?.listDetailsMiss || 0
        };
      } catch (e) {
      }
    }
    function handlePreviewArtwork(preview) {
      console.log("[MAPVIEW DEBUG] handlePreviewArtwork called with:", preview);
      if (lastPreviewId.value !== preview.id) {
        shouldShake.value = true;
        lastPreviewId.value = preview.id;
        setTimeout(() => {
          shouldShake.value = false;
        }, 600);
      }
      mapPreviewStore.showPreview(preview);
      console.log("[MAPVIEW DEBUG] Preview store updated (partial), isVisible:", mapPreviewStore.isVisible);
      (async () => {
        try {
          const details = await artworksStore.fetchArtwork(preview.id);
          if (details) {
            let thumbnail = void 0;
            if (preview.thumbnailUrl) {
              thumbnail = preview.thumbnailUrl;
            } else if (details && details.photos && Array.isArray(details.photos) && details.photos.length) {
              const p0 = details.photos[0];
              if (typeof p0 === "string") thumbnail = p0;
              else if (p0 && typeof p0 === "object" && (p0.url || p0.thumbnail_url)) thumbnail = p0.url || p0.thumbnail_url;
            } else if (details.recent_photo && typeof details.recent_photo === "string") {
              thumbnail = details.recent_photo;
            }
            const enriched = {
              id: preview.id,
              title: details.title || preview.title || "Untitled Artwork",
              description: preview.description || details.description || details.type_name || details.type || "Public artwork",
              thumbnailUrl: thumbnail || void 0,
              artistName: details.artist_name || details.artist || details.created_by || preview.artistName,
              type_name: preview.type_name || details.type_name || details.type || void 0,
              lat: preview.lat ?? details.latitude ?? details.lat,
              lon: preview.lon ?? details.longitude ?? details.lon
            };
            mapPreviewStore.updatePreview(enriched);
            console.log("[MAPVIEW DEBUG] Preview store enriched with artwork details for id:", preview.id);
          }
        } catch (err) {
          console.warn("[MAPVIEW DEBUG] Failed to fetch artwork details for preview:", err);
        }
      })();
    }
    function handleDismissPreview() {
      console.log("[MAPVIEW DEBUG] handleDismissPreview called");
      mapPreviewStore.hidePreview();
    }
    function handleMapMove(data) {
      console.log("Map moved to:", data.center, "zoom:", data.zoom);
    }
    function handleLocationFound(location) {
      console.log("User location found:", location);
      artworksStore.fetchNearbyArtworks(location);
    }
    function handlePreviewClick(artwork) {
      console.log("[MAPVIEW DEBUG] handlePreviewClick called for artwork:", artwork.id);
      mapPreviewStore.hidePreview();
      router.push(`/artwork/${artwork.id}`);
    }
    onMounted(() => {
      try {
        if (canUseLocalStorage()) {
          const saved = localStorage.getItem("map:lastState");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.center?.latitude && parsed?.center?.longitude && typeof parsed.zoom === "number") {
              artworksStore.setMapCenter(parsed.center);
              artworksStore.setMapZoom(parsed.zoom);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to restore map state", e);
      }
      if (artworksStore.currentLocation) {
        artworksStore.fetchNearbyArtworks();
      }
      displayedArtworks.value = artworksStore.artworks;
      if (isClient) {
        const persist = () => {
          try {
            if (canUseLocalStorage()) {
              localStorage.setItem(
                "map:lastState",
                JSON.stringify({ center: artworksStore.mapCenter, zoom: artworksStore.mapZoom })
              );
            }
          } catch (e) {
          }
        };
        persist();
        const interval = setInterval(persist, 4e3);
        window.addEventListener("beforeunload", persist);
        onUnmounted(() => {
          clearInterval(interval);
          try {
            window.removeEventListener("beforeunload", persist);
          } catch (e) {
          }
        });
      }
      updateDisplayedArtworks();
    });
    watch(
      () => artworksStore.artworks,
      async () => {
        await updateDisplayedArtworks();
      },
      { deep: true }
    );
    watch(
      [
        () => mapFilters.hasActiveFilters.value,
        () => mapFilters.filterState.value.wantToSee,
        () => mapFilters.filterState.value.notSeenByMe,
        () => mapFilters.filterState.value.userLists,
        () => mapFilters.refreshTrigger.value
        // Force reactivity trigger
      ],
      async () => {
        console.log("[MAP FILTERS] Filter state changed, updating displayed artworks");
        await updateDisplayedArtworks();
      },
      { deep: true }
    );
    watch(
      () => route.query.list,
      async (newListId) => {
        if (newListId && typeof newListId === "string") {
          currentListId.value = newListId;
          await loadListArtworks(newListId);
        } else {
          clearListFilter();
        }
      },
      { immediate: true }
    );
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "map-view h-full w-full relative" }, _attrs))} data-v-2ef20a4b>`);
      if (unref(mapFilters).hasActiveFilters.value && !listFilterActive.value) {
        _push(`<div class="absolute top-4 left-4 right-20 z-40 bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-sm" data-v-2ef20a4b><div class="flex items-center justify-between" data-v-2ef20a4b><div class="flex items-center" data-v-2ef20a4b>`);
        _push(ssrRenderComponent(unref(AdjustmentsHorizontalIcon$1), { class: "w-5 h-5 text-amber-600 mr-2 flex-shrink-0" }, null, _parent));
        _push(`<span class="text-sm font-medium text-amber-900" data-v-2ef20a4b>${ssrInterpolate(unref(mapFilters).activeFilterDescription.value)}</span></div><button class="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200 transition-colors" title="Reset all filters" data-v-2ef20a4b> Reset </button></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (listFilterActive.value && listInfo.value) {
        _push(`<div class="${ssrRenderClass([{ "top-4": !hasActiveMapFilters.value, "top-20": hasActiveMapFilters.value }, "absolute left-4 right-4 z-40 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm"])}" data-v-2ef20a4b><div class="flex items-center justify-between" data-v-2ef20a4b><div class="flex items-center" data-v-2ef20a4b><svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-2ef20a4b><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" data-v-2ef20a4b></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v0a2 2 0 01-2 2H10a2 2 0 01-2-2v0z" data-v-2ef20a4b></path></svg><span class="text-sm font-medium text-blue-900" data-v-2ef20a4b> Showing list: ${ssrInterpolate(listInfo.value.name)} (${ssrInterpolate(listArtworks.value.length)} artworks) </span></div><button class="text-blue-600 hover:text-blue-800 text-sm font-medium" data-v-2ef20a4b> Show All </button></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="absolute top-4 left-4 z-30 flex flex-col space-y-2" data-v-2ef20a4b><button class="bg-white shadow-md rounded-full p-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" title="Help and welcome information" aria-label="Open help and welcome" data-v-2ef20a4b>`);
      _push(ssrRenderComponent(unref(QuestionMarkCircleIcon), { class: "w-5 h-5 text-gray-700" }, null, _parent));
      _push(`</button></div><div class="absolute top-4 right-4 z-30 flex flex-col space-y-2" data-v-2ef20a4b><button class="bg-white shadow-md rounded-full p-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" title="Map filters" aria-label="Open map filters" data-v-2ef20a4b>`);
      _push(ssrRenderComponent(unref(AdjustmentsHorizontalIcon$1), {
        class: ["w-5 h-5", unref(mapFilters).hasActiveFilters.value ? "text-amber-600" : "text-gray-700"]
      }, null, _parent));
      if (unref(mapFilters).hasActiveFilters.value) {
        _push(`<div class="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white" data-v-2ef20a4b></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</button></div>`);
      _push(ssrRenderComponent(_sfc_main$2, {
        center: mapCenter.value,
        zoom: mapZoom.value,
        "suppress-filter-banner": unref(mapFilters).hasActiveFilters.value && !listFilterActive.value,
        artworks: artworks.value,
        ref_key: "mapComponentRef",
        ref: mapComponentRef,
        onArtworkClick: handleArtworkClick,
        onPreviewArtwork: handlePreviewArtwork,
        onDismissPreview: handleDismissPreview,
        onMapMove: handleMapMove,
        onLocationFound: handleLocationFound,
        onTelemetryUpdate: handleTelemetryUpdate
      }, null, _parent));
      if (previewAsSearchResult.value && isPreviewVisible.value) {
        _push(`<div class="${ssrRenderClass([{ "animate-shake": shouldShake.value }, "map-preview-wrapper fixed bottom-32 left-1/2 transform -translate-x-1/2 w-80 max-w-[calc(100vw-2rem)] z-50 transition-transform duration-200"])}" style="${ssrRenderStyle({ "z-index": "1000" })}" data-v-2ef20a4b>`);
        _push(ssrRenderComponent(ArtworkCard, {
          artwork: previewAsSearchResult.value,
          clickable: true,
          compact: true,
          class: "shadow-xl",
          onClick: handlePreviewClick
        }, null, _parent));
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(ssrRenderComponent(MapFiltersModal, {
        "is-open": showFiltersModal.value,
        "onUpdate:isOpen": handleCloseFilters,
        onFiltersChanged: handleFiltersChanged,
        onClearListCaches: () => mapComponentRef.value && mapComponentRef.value.clearListCaches && mapComponentRef.value.clearListCaches(),
        onResetCacheTelemetry: handleResetCacheTelemetry,
        "cache-telemetry": cacheTelemetryRef.value ?? { userListsHit: 0, userListsMiss: 0, listDetailsHit: 0, listDetailsMiss: 0 }
      }, null, _parent));
      _push(ssrRenderComponent(FirstTimeModal, {
        ref_key: "firstTimeModalRef",
        ref: firstTimeModalRef
      }, null, _parent));
      _push(`</div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/MapView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const MapView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-2ef20a4b"]]);

export { MapView as default };
//# sourceMappingURL=MapView-DbBFFQHf.js.map
