import { defineComponent, ref, computed, onMounted, mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrInterpolate, ssrIncludeBooleanAttr, ssrRenderList, ssrRenderClass, ssrRenderComponent } from 'vue/server-renderer';
import { useRouter } from 'vue-router';
import { d as useAuthStore, a as apiService, _ as _export_sfc } from '../ssr-entry-server.js';
import { A as ArtworkCard } from './ArtworkCard-0An4ZMhk.js';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';
import './image-CoH3F98X.js';

const PAGE_SIZE = 50;
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ListView",
  __ssrInlineRender: true,
  props: {
    id: {}
  },
  setup(__props) {
    const props = __props;
    useRouter();
    const authStore = useAuthStore();
    const loading = ref(true);
    const error = ref(null);
    const list = ref(null);
    const artworks = ref([]);
    function toSearchResult(item) {
      return {
        id: String(item.id),
        lat: Number(item.lat || item.latitude || 0),
        lon: Number(item.lon || item.longitude || 0),
        type_name: String(item.type_name || "artwork"),
        title: item.title || item.name || null,
        artist_name: null,
        tags: item.tags && typeof item.tags === "object" ? item.tags : null,
        recent_photo: item.recent_photo || item.photos && item.photos[0] && item.photos[0].url || null,
        photo_count: item.photo_count || (item.photos ? item.photos.length : 0),
        distance_km: null
      };
    }
    const currentPage = ref(1);
    const totalPages = ref(1);
    const hasMore = ref(false);
    const selectedArtworks = ref(/* @__PURE__ */ new Set());
    const isSelectionMode = ref(false);
    const bulkRemoveLoading = ref(false);
    const isOwner = computed(() => {
      return authStore.token && list.value && list.value.owner_user_id === authStore.token;
    });
    const canBulkRemove = computed(() => {
      return isOwner.value && !list.value?.is_readonly && selectedArtworks.value.size > 0;
    });
    const allSelected = computed(() => {
      return artworks.value.length > 0 && artworks.value.every((artwork) => selectedArtworks.value.has(artwork.id));
    });
    const loadList = async (page = 1) => {
      loading.value = page === 1;
      error.value = null;
      try {
        const response = await apiService.getListDetails(props.id, page, 50);
        if (response && response.success && response.data) {
          const data = response.data;
          list.value = data.list;
          if (page === 1) {
            artworks.value = data.items || [];
          } else {
            artworks.value.push(...data.items || []);
          }
          currentPage.value = data.page || 1;
          totalPages.value = Math.ceil((data.total || 0) / (data.per_page || PAGE_SIZE));
          hasMore.value = !!data.has_more;
        } else {
          error.value = response?.error || "Failed to load list";
        }
      } catch (err) {
        console.error("Error loading list:", err);
        if (err && typeof err === "object" && "status" in err && err.status === 404) {
          error.value = "List not found. It may have been deleted by its owner.";
        } else {
          error.value = err instanceof Error ? err.message : "Failed to load list";
        }
      } finally {
        loading.value = false;
      }
    };
    onMounted(() => {
      loadList(1);
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8" }, _attrs))} data-v-3f993d6c>`);
      if (loading.value && !list.value) {
        _push(`<div class="flex items-center justify-center py-12" data-v-3f993d6c><div class="flex items-center" data-v-3f993d6c><svg class="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-3f993d6c><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-3f993d6c></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-3f993d6c></path></svg><span class="ml-3 text-gray-600" data-v-3f993d6c>Loading list...</span></div></div>`);
      } else if (error.value) {
        _push(`<div class="text-center py-12" data-v-3f993d6c><svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-3f993d6c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" data-v-3f993d6c></path></svg><h1 class="text-2xl font-bold text-gray-900 mb-2 mt-4" data-v-3f993d6c>List Not Found</h1><p class="text-gray-600 mb-6" data-v-3f993d6c>${ssrInterpolate(error.value)}</p><button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3f993d6c> ← Go Back </button></div>`);
      } else if (list.value) {
        _push(`<div data-v-3f993d6c><div class="mb-8" data-v-3f993d6c><div class="flex items-center justify-between mb-4" data-v-3f993d6c><button class="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors" data-v-3f993d6c><svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-3f993d6c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" data-v-3f993d6c></path></svg> Back </button></div><div class="flex items-start justify-between" data-v-3f993d6c><div data-v-3f993d6c><h1 class="text-3xl font-bold text-gray-900 mb-2" data-v-3f993d6c>${ssrInterpolate(list.value.name)}</h1><p class="text-gray-600" data-v-3f993d6c>${ssrInterpolate(list.value.item_count)} artwork${ssrInterpolate(list.value.item_count === 1 ? "" : "s")} `);
        if (isSelectionMode.value && selectedArtworks.value.size > 0) {
          _push(`<span class="ml-2" data-v-3f993d6c> (${ssrInterpolate(selectedArtworks.value.size)} selected) </span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</p>`);
        if (list.value.is_system_list) {
          _push(`<div class="mt-2" data-v-3f993d6c><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800" data-v-3f993d6c> System List </span></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
        if (isOwner.value) {
          _push(`<div class="flex items-center space-x-2" data-v-3f993d6c>`);
          if (artworks.value.length > 0) {
            _push(`<div class="flex items-center space-x-2 mr-4" data-v-3f993d6c><button class="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3f993d6c><svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-3f993d6c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3a9 9 0 1118 0 9 9 0 01-18 0z" data-v-3f993d6c></path></svg> View on Map </button></div>`);
          } else {
            _push(`<!---->`);
          }
          if (artworks.value.length > 0 && !list.value.is_readonly) {
            _push(`<div data-v-3f993d6c>`);
            if (!isSelectionMode.value) {
              _push(`<button class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3f993d6c><svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-3f993d6c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.7 9.3l4.8 4.8 10.4-10.4" data-v-3f993d6c></path></svg> Select Items </button>`);
            } else {
              _push(`<div class="flex items-center space-x-2" data-v-3f993d6c><button class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3f993d6c>${ssrInterpolate(allSelected.value ? "Deselect All" : "Select All")}</button><button${ssrIncludeBooleanAttr(!canBulkRemove.value || bulkRemoveLoading.value) ? " disabled" : ""} class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" data-v-3f993d6c>`);
              if (bulkRemoveLoading.value) {
                _push(`<svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-3f993d6c><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-3f993d6c></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-3f993d6c></path></svg>`);
              } else {
                _push(`<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-3f993d6c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" data-v-3f993d6c></path></svg>`);
              }
              _push(` Remove Selected (${ssrInterpolate(selectedArtworks.value.size)}) </button><button class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3f993d6c> Cancel </button></div>`);
            }
            _push(`</div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
        if (artworks.value.length === 0) {
          _push(`<div class="text-center py-16 bg-gray-50 rounded-lg" data-v-3f993d6c><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-3f993d6c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" data-v-3f993d6c></path></svg><h3 class="mt-4 text-lg font-medium text-gray-900" data-v-3f993d6c>No artworks yet</h3><p class="mt-2 text-gray-600" data-v-3f993d6c>`);
          if (isOwner.value) {
            _push(`<span data-v-3f993d6c>Start building your collection by adding artworks from their detail pages.</span>`);
          } else {
            _push(`<span data-v-3f993d6c>This list is empty.</span>`);
          }
          _push(`</p></div>`);
        } else {
          _push(`<div data-v-3f993d6c><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-v-3f993d6c><!--[-->`);
          ssrRenderList(artworks.value, (artwork) => {
            _push(`<div class="${ssrRenderClass([
              "relative group cursor-pointer",
              isSelectionMode.value && selectedArtworks.value.has(artwork.id) ? "ring-2 ring-blue-500" : ""
            ])}" data-v-3f993d6c>`);
            if (isSelectionMode.value) {
              _push(`<div class="absolute top-2 left-2 z-10" data-v-3f993d6c><input type="checkbox"${ssrIncludeBooleanAttr(selectedArtworks.value.has(artwork.id)) ? " checked" : ""} class="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500" data-v-3f993d6c></div>`);
            } else {
              _push(`<!---->`);
            }
            if (!artwork.id || !artwork.title) {
              _push(`<div class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center min-h-[200px] flex flex-col justify-center" data-v-3f993d6c><svg class="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-3f993d6c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" data-v-3f993d6c></path></svg><h3 class="text-lg font-medium text-gray-700 mb-1" data-v-3f993d6c>Artwork No Longer Available</h3><p class="text-sm text-gray-500" data-v-3f993d6c>This artwork has been removed or is no longer accessible.</p></div>`);
            } else {
              _push(ssrRenderComponent(ArtworkCard, {
                artwork: toSearchResult(artwork),
                "show-distance": false,
                class: isSelectionMode.value ? "pointer-events-none" : ""
              }, null, _parent));
            }
            _push(`</div>`);
          });
          _push(`<!--]--></div>`);
          if (hasMore.value) {
            _push(`<div class="mt-8 text-center" data-v-3f993d6c><button${ssrIncludeBooleanAttr(loading.value) ? " disabled" : ""} class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3f993d6c>`);
            if (loading.value) {
              _push(`<span class="flex items-center" data-v-3f993d6c><svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-3f993d6c><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-3f993d6c></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-3f993d6c></path></svg> Loading... </span>`);
            } else {
              _push(`<span data-v-3f993d6c>Load More</span>`);
            }
            _push(`</button></div>`);
          } else {
            _push(`<!---->`);
          }
          if (totalPages.value > 1) {
            _push(`<div class="mt-4 text-center text-sm text-gray-500" data-v-3f993d6c> Page ${ssrInterpolate(currentPage.value)} of ${ssrInterpolate(totalPages.value)}</div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
        }
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ListView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ListView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-3f993d6c"]]);

export { ListView as default };
//# sourceMappingURL=ListView-Bjwlb9rM.js.map
