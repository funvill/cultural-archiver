import { defineComponent, ref, computed, watch, onMounted, mergeProps, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrInterpolate, ssrRenderStyle, ssrRenderComponent, ssrRenderList, ssrRenderAttr } from 'vue/server-renderer';
import { useRoute, useRouter } from 'vue-router';
import { MagnifyingGlassIcon, PhotoIcon } from '@heroicons/vue/24/outline';
import { a as apiService, _ as _export_sfc } from '../ssr-entry-server.js';
import { u as useToasts } from './useToasts-PudGFTbq.js';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/solid';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "SearchResultsView",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    useRouter();
    const results = ref([]);
    const isLoading = ref(false);
    const hasMore = ref(false);
    const currentPage = ref(1);
    const totalResults = ref(0);
    const query = computed(() => route.query.q || "");
    async function performSearch(page = 1, append = false) {
      if (!query.value.trim()) {
        results.value = [];
        return;
      }
      isLoading.value = true;
      try {
        const response = await apiService.searchArtworks(
          query.value,
          page,
          20,
          // per page
          "approved"
        );
        if (response.success && response.data) {
          if (append) {
            results.value.push(...response.data.artworks);
          } else {
            results.value = response.data.artworks;
          }
          hasMore.value = response.data.pagination.has_more;
          currentPage.value = response.data.pagination.page;
          totalResults.value = response.data.pagination.total;
        }
      } catch (error) {
        console.error("Search failed:", error);
        const { error: toastError } = useToasts();
        const errMsg = error?.message || String(error || "Unknown error");
        toastError(`Search failed: ${errMsg}`);
      } finally {
        isLoading.value = false;
      }
    }
    watch(() => query.value, () => {
      performSearch();
    }, { immediate: true });
    onMounted(() => {
      if (query.value) {
        performSearch();
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "search-results-view" }, _attrs))} data-v-d5905f4e><div class="bg-white shadow-sm border-b border-gray-200 theme-surface" data-v-d5905f4e><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4" data-v-d5905f4e><div class="flex items-center justify-between" data-v-d5905f4e><h1 class="text-2xl font-bold theme-on-background" data-v-d5905f4e>Search Results</h1><div class="text-sm theme-muted" data-v-d5905f4e>${ssrInterpolate(totalResults.value)} results${ssrInterpolate(query.value ? ` for "${query.value}"` : "")}</div></div></div></div><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-v-d5905f4e>`);
      if (isLoading.value) {
        _push(`<div class="flex justify-center items-center py-8" data-v-d5905f4e><div class="animate-spin rounded-full h-8 w-8 border-b-2" style="${ssrRenderStyle({ "border-color": "rgb(var(--md-primary))" })}" data-v-d5905f4e></div><span class="ml-3 theme-muted" data-v-d5905f4e>Searching...</span></div>`);
      } else if (!results.value.length && !isLoading.value) {
        _push(`<div class="text-center py-12" data-v-d5905f4e>`);
        _push(ssrRenderComponent(unref(MagnifyingGlassIcon), { class: "mx-auto h-12 w-12 text-gray-400" }, null, _parent));
        _push(`<h3 class="mt-2 text-sm font-medium text-gray-900" data-v-d5905f4e>No results found</h3><p class="mt-1 text-sm text-gray-500" data-v-d5905f4e>${ssrInterpolate(query.value ? `Try searching for something else.` : "Enter a search query to get started.")}</p></div>`);
      } else {
        _push(`<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-v-d5905f4e><!--[-->`);
        ssrRenderList(results.value, (item) => {
          _push(`<div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer" data-v-d5905f4e><div class="aspect-square bg-gray-100" data-v-d5905f4e>`);
          if (item.photos && item.photos.length > 0) {
            _push(`<img${ssrRenderAttr("src", item.photos[0]?.thumbnail_url || item.photos[0]?.url)}${ssrRenderAttr("alt", item.title || "Artwork")} class="w-full h-full object-cover" data-v-d5905f4e>`);
          } else {
            _push(`<div class="w-full h-full flex items-center justify-center" data-v-d5905f4e>`);
            _push(ssrRenderComponent(unref(PhotoIcon), { class: "h-12 w-12 text-gray-400" }, null, _parent));
            _push(`</div>`);
          }
          _push(`</div><div class="p-4" data-v-d5905f4e><h3 class="text-lg font-semibold text-gray-900 truncate" data-v-d5905f4e>${ssrInterpolate(item.title || "Untitled")}</h3>`);
          if (item.artist_name) {
            _push(`<p class="text-sm text-gray-600 truncate mt-1" data-v-d5905f4e> by ${ssrInterpolate(item.artist_name)}</p>`);
          } else {
            _push(`<!---->`);
          }
          if (item.location_description) {
            _push(`<p class="text-sm text-gray-500 truncate mt-2" data-v-d5905f4e> 📍 ${ssrInterpolate(item.location_description)}</p>`);
          } else {
            _push(`<!---->`);
          }
          if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
            _push(`<div class="mt-3" data-v-d5905f4e><div class="flex flex-wrap gap-1" data-v-d5905f4e><!--[-->`);
            ssrRenderList(item.tags.slice(0, 3), (tag) => {
              _push(`<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium theme-primary-container theme-on-primary-container" data-v-d5905f4e>${ssrInterpolate(tag)}</span>`);
            });
            _push(`<!--]-->`);
            if (item.tags.length > 3) {
              _push(`<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600" data-v-d5905f4e> +${ssrInterpolate(item.tags.length - 3)}</span>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div>`);
        });
        _push(`<!--]--></div>`);
      }
      if (hasMore.value && !isLoading.value) {
        _push(`<div class="text-center mt-8" data-v-d5905f4e><button class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm theme-primary theme-on-primary focus:outline-none focus:ring-2 focus:ring-offset-2" style="${ssrRenderStyle({ "--tw-ring-color": "var(--md-sys-color-primary)" })}" data-v-d5905f4e> Load More </button></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/SearchResultsView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const SearchResultsView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-d5905f4e"]]);

export { SearchResultsView as default };
//# sourceMappingURL=SearchResultsView-5ILjph-C.js.map
