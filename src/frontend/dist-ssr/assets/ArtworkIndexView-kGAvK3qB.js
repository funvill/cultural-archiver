import { ref, computed, defineComponent, mergeProps, unref, useSSRContext, watch, onMounted, resolveComponent, withCtx, createTextVNode } from 'vue';
import { ssrRenderAttrs, ssrRenderClass, ssrInterpolate, ssrRenderAttr, ssrIncludeBooleanAttr, ssrRenderList, ssrRenderComponent } from 'vue/server-renderer';
import { useRoute, useRouter } from 'vue-router';
import { A as ArtworkCard } from './ArtworkCard-0An4ZMhk.js';
import { _ as _sfc_main$4 } from './ArtworkTypeFilter-BnCnhf0a.js';
import { _ as _export_sfc, a as apiService } from '../ssr-entry-server.js';
import { _ as _sfc_main$2, a as _sfc_main$3, b as _sfc_main$5 } from './LoadingSpinner-Cv2Kl6Jf.js';
import { S as SkeletonCard } from './SkeletonCard-CEBdOJ8w.js';
import { u as useArtworkTypeFilters } from './useArtworkTypeFilters-BIVqZddm.js';
import './image-CoH3F98X.js';
import 'exifr';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';

const DEFAULT_ARTWORK_FILTERS = [
  {
    key: "hasPhotos",
    label: "Has Photos",
    description: "Show only artworks with photos",
    enabled: false
  },
  {
    key: "isActive",
    label: "Active Artworks",
    description: "Hide removed artworks (tag:condition:removed)",
    enabled: true
  }
];
function useArtworkFilters() {
  const artworkFilters = ref([...DEFAULT_ARTWORK_FILTERS]);
  const enabledFilters = computed(
    () => artworkFilters.value.filter((filter) => filter.enabled).map((filter) => filter.key)
  );
  const allFiltersEnabled = computed(() => artworkFilters.value.every((filter) => filter.enabled));
  const anyFilterEnabled = computed(() => artworkFilters.value.some((filter) => filter.enabled));
  function isFilterEnabled(filterKey) {
    const filter = artworkFilters.value.find((f) => f.key === filterKey);
    return filter ? filter.enabled : false;
  }
  function hasRemovedCondition(tags_parsed) {
    if (!tags_parsed) return false;
    if (tags_parsed.condition === "removed") {
      return true;
    }
    if (tags_parsed.condition && typeof tags_parsed.condition === "object" && tags_parsed.condition !== null && "removed" in tags_parsed.condition) {
      return true;
    }
    return false;
  }
  function filterArtworks(artworks) {
    return artworks.filter((artwork) => {
      if (isFilterEnabled("hasPhotos")) {
        const photoCount = artwork.photo_count || 0;
        if (photoCount === 0) {
          return false;
        }
      }
      if (isFilterEnabled("isActive")) {
        const tagsToCheck = artwork.tags_parsed || artwork.tags;
        if (hasRemovedCondition(tagsToCheck)) {
          return false;
        }
      }
      return true;
    });
  }
  function toggleFilter(key) {
    const filter = artworkFilters.value.find((f) => f.key === key);
    if (filter) {
      filter.enabled = !filter.enabled;
    }
  }
  function enableAllFilters() {
    artworkFilters.value.forEach((filter) => {
      filter.enabled = true;
    });
  }
  function disableAllFilters() {
    artworkFilters.value.forEach((filter) => {
      filter.enabled = false;
    });
  }
  function resetToDefaults() {
    artworkFilters.value = [...DEFAULT_ARTWORK_FILTERS];
  }
  return {
    // State
    artworkFilters,
    // Computed
    enabledFilters,
    allFiltersEnabled,
    anyFilterEnabled,
    // Methods
    isFilterEnabled,
    filterArtworks,
    toggleFilter,
    enableAllFilters,
    disableAllFilters,
    resetToDefaults
  };
}

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "ArtworkFilters",
  __ssrInlineRender: true,
  props: {
    title: { default: "Additional Filters" },
    description: { default: "Filter artworks by photos and condition" },
    collapsible: { type: Boolean, default: true },
    defaultCollapsed: { type: Boolean, default: true },
    showControlButtons: { type: Boolean, default: true }
  },
  setup(__props) {
    const props = __props;
    const {
      artworkFilters,
      allFiltersEnabled} = useArtworkFilters();
    const isCollapsed = ref(props.defaultCollapsed);
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "bg-white border border-gray-200 rounded-lg p-4" }, _attrs))} data-v-ab08a84f><div class="${ssrRenderClass([{ "mb-4": !_ctx.collapsible || !isCollapsed.value }, "flex items-center justify-between cursor-pointer"])}" data-v-ab08a84f><div data-v-ab08a84f><h3 class="text-lg font-medium text-gray-900" data-v-ab08a84f>${ssrInterpolate(_ctx.title)}</h3>`);
      if (_ctx.description) {
        _push(`<p class="text-sm text-gray-600 mt-1" data-v-ab08a84f>${ssrInterpolate(_ctx.description)}</p>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
      if (_ctx.collapsible) {
        _push(`<button type="button" class="p-1 rounded-md hover:bg-gray-100 focus:ring-2 focus:ring-blue-500"${ssrRenderAttr("aria-label", isCollapsed.value ? "Expand filters" : "Collapse filters")} data-v-ab08a84f><svg class="${ssrRenderClass([{ "rotate-180": !isCollapsed.value }, "w-5 h-5 text-gray-500 transition-transform duration-200"])}" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-ab08a84f><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" data-v-ab08a84f></path></svg></button>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
      if (!_ctx.collapsible || !isCollapsed.value) {
        _push(`<div class="space-y-4" data-v-ab08a84f>`);
        if (_ctx.showControlButtons) {
          _push(`<div class="flex flex-wrap gap-2 pb-4 border-b border-gray-200" data-v-ab08a84f><button${ssrIncludeBooleanAttr(unref(allFiltersEnabled)) ? " disabled" : ""} class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" data-v-ab08a84f> Enable All </button><button${ssrIncludeBooleanAttr(!unref(allFiltersEnabled)) ? " disabled" : ""} class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed" data-v-ab08a84f> Disable All </button><button class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500" data-v-ab08a84f> Reset </button></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="space-y-3" data-v-ab08a84f><!--[-->`);
        ssrRenderList(unref(artworkFilters), (filter) => {
          _push(`<div class="flex items-start space-x-3" data-v-ab08a84f><label class="relative inline-flex items-center cursor-pointer" data-v-ab08a84f><input type="checkbox"${ssrIncludeBooleanAttr(filter.enabled) ? " checked" : ""} class="sr-only" data-v-ab08a84f><div class="${ssrRenderClass([filter.enabled ? "bg-blue-600" : "bg-gray-200", "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer transition-colors duration-200"])}" data-v-ab08a84f><div class="${ssrRenderClass([filter.enabled ? "translate-x-full" : "translate-x-0", "dot absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform duration-200"])}" data-v-ab08a84f></div></div></label><div class="flex-1 min-w-0" data-v-ab08a84f><div class="flex items-center space-x-2" data-v-ab08a84f><span class="${ssrRenderClass([filter.enabled ? "text-gray-900" : "text-gray-500", "text-sm font-medium transition-colors duration-200"])}" data-v-ab08a84f>${ssrInterpolate(filter.label)}</span>`);
          if (filter.enabled) {
            _push(`<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800" data-v-ab08a84f> Active </span>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div><p class="${ssrRenderClass([filter.enabled ? "text-gray-600" : "text-gray-400", "text-xs mt-1 transition-colors duration-200"])}" data-v-ab08a84f>${ssrInterpolate(filter.description)}</p></div></div>`);
        });
        _push(`<!--]--></div></div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ArtworkFilters.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const ArtworkFilters = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-ab08a84f"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ArtworkIndexView",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    const router = useRouter();
    const artworks = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const totalItems = ref(0);
    const currentPage = ref(1);
    const totalPages = ref(1);
    const pageSize = ref(30);
    const currentSort = ref("updated_desc");
    const artworksAsSearchResults = computed(() => {
      return artworks.value.map(
        (artwork) => ({
          id: artwork.id,
          lat: artwork.lat,
          lon: artwork.lon,
          type_name: artwork.type_name || "Unknown",
          title: typeof artwork.title === "string" && artwork.title.trim().length > 0 ? artwork.title.trim() : artwork.tags_parsed && typeof artwork.tags_parsed.title === "string" && artwork.tags_parsed.title.trim().length > 0 ? artwork.tags_parsed.title.trim() : artwork.tags_parsed && typeof artwork.tags_parsed.name === "string" && artwork.tags_parsed.name.trim().length > 0 ? artwork.tags_parsed.name.trim() : null,
          artist_name: typeof artwork.artist_name === "string" && artwork.artist_name.trim().length > 0 ? artwork.artist_name.trim() : artwork.tags_parsed && typeof artwork.tags_parsed.artist_name === "string" && artwork.tags_parsed.artist_name.trim().length > 0 ? artwork.tags_parsed.artist_name.trim() : artwork.tags_parsed && typeof artwork.tags_parsed.artist === "string" && artwork.tags_parsed.artist.trim().length > 0 ? artwork.tags_parsed.artist.trim() : artwork.tags_parsed && typeof artwork.tags_parsed.created_by === "string" && artwork.tags_parsed.created_by.trim().length > 0 ? artwork.tags_parsed.created_by.trim() : null,
          tags: artwork.tags_parsed || null,
          recent_photo: artwork.recent_photo || null,
          photo_count: artwork.photo_count || 0
        })
      );
    });
    const sortOptions = [
      { value: "updated_desc", label: "Last Updated" },
      { value: "title_asc", label: "Title A-Z" },
      { value: "created_desc", label: "Creation Date" }
    ];
    const hasResults = computed(() => artworks.value.length > 0);
    const isEmptyState = computed(() => !loading.value && !hasResults.value && !error.value);
    const { filterArtworks } = useArtworkTypeFilters();
    const { filterArtworks: filterByConditions } = useArtworkFilters();
    const filteredArtworksAsSearchResults = computed(() => {
      const typeFilteredArtworks = filterArtworks(artworksAsSearchResults.value);
      return filterByConditions(typeFilteredArtworks);
    });
    const filteredTotal = computed(() => filteredArtworksAsSearchResults.value.length);
    const pageTitle = computed(() => {
      const baseTitle = "Artworks | Cultural Archiver";
      if (currentPage.value > 1) {
        return `Artworks (Page ${currentPage.value}) | Cultural Archiver`;
      }
      return baseTitle;
    });
    watch(
      pageTitle,
      (newTitle) => {
        document.title = newTitle;
      },
      { immediate: true }
    );
    function initializeFromUrl() {
      const urlPage = parseInt(route.query.page) || 1;
      const urlLimit = parseInt(route.query.limit) || 30;
      const urlSort = route.query.sort || "updated_desc";
      currentPage.value = Math.max(urlPage, 1);
      pageSize.value = [10, 30, 50].includes(urlLimit) ? urlLimit : 30;
      currentSort.value = ["updated_desc", "title_asc", "created_desc"].includes(urlSort) ? urlSort : "updated_desc";
    }
    function updateUrl() {
      const query = {};
      if (currentPage.value > 1) {
        query.page = currentPage.value.toString();
      }
      if (pageSize.value !== 30) {
        query.limit = pageSize.value.toString();
      }
      if (currentSort.value !== "updated_desc") {
        query.sort = currentSort.value;
      }
      router.replace({ query });
    }
    async function loadArtworks() {
      loading.value = true;
      error.value = null;
      try {
        const response = await apiService.getArtworksList(
          currentPage.value,
          pageSize.value,
          currentSort.value
        );
        if (response.data) {
          artworks.value = response.data.items;
          totalItems.value = response.data.totalItems;
          totalPages.value = response.data.totalPages;
          currentPage.value = response.data.currentPage;
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        console.error("Failed to load artworks:", err);
        error.value = err instanceof Error ? err.message : "Failed to load artworks";
        if (error.value.includes("Page not found") || error.value.includes("does not exist")) {
          if (currentPage.value > 1) {
            currentPage.value = 1;
            updateUrl();
            return loadArtworks();
          }
        }
      } finally {
        loading.value = false;
      }
    }
    function handlePageChange(page) {
      currentPage.value = page;
      updateUrl();
      loadArtworks();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function handlePageSizeChange(newSize) {
      const currentTopItem = (currentPage.value - 1) * pageSize.value + 1;
      const newPage = Math.ceil(currentTopItem / newSize);
      pageSize.value = newSize;
      currentPage.value = Math.max(newPage, 1);
      updateUrl();
      loadArtworks();
    }
    function handleSortChange(newSort) {
      currentSort.value = newSort;
      currentPage.value = 1;
      updateUrl();
      loadArtworks();
    }
    function handleArtworkClick(artwork) {
      router.push(`/artwork/${artwork.id}`);
    }
    watch(
      () => route.query,
      () => {
        initializeFromUrl();
        loadArtworks();
      },
      { deep: true }
    );
    onMounted(() => {
      initializeFromUrl();
      loadArtworks();
    });
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50" }, _attrs))}><div class="bg-white border-b border-gray-200"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"><div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 class="text-3xl font-bold text-gray-900">Artworks</h1><p class="mt-1 text-sm text-gray-600">Browse all approved artworks in our collection</p></div>`);
      _push(ssrRenderComponent(_sfc_main$2, {
        "current-sort": currentSort.value,
        options: sortOptions,
        loading: loading.value,
        onSortChange: handleSortChange
      }, null, _parent));
      _push(`</div></div></div><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">`);
      if (error.value) {
        _push(`<div class="text-center py-12"><div class="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto"><h3 class="text-lg font-medium text-red-800 mb-2">Failed to Load Artworks</h3><p class="text-red-600 mb-4">${ssrInterpolate(error.value)}</p><button class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500"> Try Again </button></div></div>`);
      } else if (isEmptyState.value) {
        _push(`<div class="text-center py-12"><div class="max-w-md mx-auto"><div class="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div><h3 class="text-lg font-medium text-gray-900 mb-2">No artwork found</h3><p class="text-gray-500 mb-4">Be the first to submit something!</p>`);
        _push(ssrRenderComponent(_component_router_link, {
          to: "/add",
          class: "inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
        }, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(` Submit Artwork `);
            } else {
              return [
                createTextVNode(" Submit Artwork ")
              ];
            }
          }),
          _: 1
        }, _parent));
        _push(`</div></div>`);
      } else if (loading.value && !hasResults.value) {
        _push(`<div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"><!--[-->`);
        ssrRenderList(pageSize.value, (i) => {
          _push(ssrRenderComponent(SkeletonCard, { key: i }, null, _parent));
        });
        _push(`<!--]--></div></div>`);
      } else {
        _push(`<div><div class="mb-6"><p class="text-sm text-gray-600">`);
        if (!loading.value) {
          _push(`<span>${ssrInterpolate(filteredTotal.value)} of ${ssrInterpolate(totalItems.value.toLocaleString())} artwork${ssrInterpolate(totalItems.value === 1 ? "" : "s")} shown </span>`);
        } else {
          _push(ssrRenderComponent(_sfc_main$3, { class: "inline-block w-4 h-4" }, null, _parent));
        }
        _push(`</p></div><div class="bg-white border border-gray-200 rounded-lg p-4 mb-4">`);
        _push(ssrRenderComponent(_sfc_main$4, {
          title: "Filter by Artwork Type",
          description: "Select which types of artworks to show",
          columns: 3,
          compact: false,
          collapsible: true,
          "default-collapsed": true,
          "show-control-buttons": true
        }, null, _parent));
        _push(`</div><div class="mb-8">`);
        _push(ssrRenderComponent(ArtworkFilters, {
          title: "Additional Filters",
          description: "Filter by photos and artwork condition",
          collapsible: true,
          "default-collapsed": false,
          "show-control-buttons": true
        }, null, _parent));
        _push(`</div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8"><!--[-->`);
        ssrRenderList(filteredArtworksAsSearchResults.value, (artwork) => {
          _push(ssrRenderComponent(ArtworkCard, {
            key: artwork.id,
            artwork,
            loading: loading.value,
            onClick: handleArtworkClick
          }, null, _parent));
        });
        _push(`<!--]--></div>`);
        _push(ssrRenderComponent(_sfc_main$5, {
          "current-page": currentPage.value,
          "total-pages": totalPages.value,
          "total-items": totalItems.value,
          "page-size": pageSize.value,
          loading: loading.value,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange
        }, null, _parent));
        _push(`</div>`);
      }
      _push(`</div></div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ArtworkIndexView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=ArtworkIndexView-kGAvK3qB.js.map
