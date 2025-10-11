import { defineComponent, computed, mergeProps, useSSRContext, ref, watch, onMounted, resolveComponent, withCtx, createTextVNode } from 'vue';
import { ssrRenderAttrs, ssrRenderClass, ssrInterpolate, ssrRenderAttr, ssrRenderComponent, ssrRenderList } from 'vue/server-renderer';
import { useRoute, useRouter } from 'vue-router';
import { _ as _export_sfc, a as apiService } from '../ssr-entry-server.js';
import { _ as _sfc_main$2, a as _sfc_main$3, b as _sfc_main$4 } from './LoadingSpinner-Cv2Kl6Jf.js';
import { S as SkeletonCard } from './SkeletonCard-CEBdOJ8w.js';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "ArtistCard",
  __ssrInlineRender: true,
  props: {
    artist: {},
    loading: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    clickable: { type: Boolean, default: true }
  },
  emits: ["click", "imageLoad", "imageError"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const artistName = computed(() => {
      return props.artist.name || "Unknown Artist";
    });
    const shortBio = computed(() => {
      return props.artist.short_bio || props.artist.description || "";
    });
    const artworkCount = computed(() => {
      const count = props.artist.artwork_count || 0;
      if (count === 0) return "No artworks";
      if (count === 1) return "1 artwork";
      return `${count} artworks`;
    });
    const avatarUrl = computed(() => {
      return null;
    });
    const avatarInitial = computed(() => {
      return artistName.value.charAt(0).toUpperCase();
    });
    const avatarColor = computed(() => {
      const colors = [
        "bg-blue-500",
        "bg-green-500",
        "bg-purple-500",
        "bg-red-500",
        "bg-yellow-500",
        "bg-indigo-500",
        "bg-pink-500",
        "bg-teal-500"
      ];
      const hash = artistName.value.split("").reduce((acc, char) => {
        return acc + char.charCodeAt(0);
      }, 0);
      return colors[hash % colors.length];
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: [{
          "cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200": _ctx.clickable && !_ctx.loading,
          "opacity-60": _ctx.loading,
          "p-3": _ctx.compact,
          "p-4": !_ctx.compact
        }, "bg-white rounded-lg shadow-md border border-gray-200"],
        tabindex: _ctx.clickable ? 0 : -1
      }, _attrs))} data-v-fccd1e9a>`);
      if (_ctx.loading) {
        _push(`<div class="animate-pulse" data-v-fccd1e9a><div class="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-3" data-v-fccd1e9a></div><div class="h-4 bg-gray-200 rounded mb-2" data-v-fccd1e9a></div><div class="h-3 bg-gray-200 rounded mb-2" data-v-fccd1e9a></div><div class="h-3 bg-gray-200 rounded w-2/3" data-v-fccd1e9a></div></div>`);
      } else {
        _push(`<div class="text-center" data-v-fccd1e9a><div class="mb-3 flex justify-center" data-v-fccd1e9a>`);
        if (!avatarUrl.value) {
          _push(`<div class="${ssrRenderClass([
            avatarColor.value,
            "w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl"
          ])}" data-v-fccd1e9a>${ssrInterpolate(avatarInitial.value)}</div>`);
        } else {
          _push(`<img${ssrRenderAttr("src", avatarUrl.value)}${ssrRenderAttr("alt", `${artistName.value} avatar`)} class="w-16 h-16 rounded-full object-cover" loading="lazy" data-v-fccd1e9a>`);
        }
        _push(`</div><h3 class="font-semibold text-gray-900 text-lg mb-2 line-clamp-2" data-v-fccd1e9a>${ssrInterpolate(artistName.value)}</h3><p class="text-sm text-gray-600 mb-2" data-v-fccd1e9a>${ssrInterpolate(artworkCount.value)}</p>`);
        if (shortBio.value) {
          _push(`<p class="${ssrRenderClass([{ "line-clamp-2": _ctx.compact }, "text-sm text-gray-500 line-clamp-3"])}" data-v-fccd1e9a>${ssrInterpolate(shortBio.value)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ArtistCard.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const ArtistCard = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-fccd1e9a"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ArtistIndexView",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    const router = useRouter();
    const artists = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const totalItems = ref(0);
    const currentPage = ref(1);
    const totalPages = ref(1);
    const pageSize = ref(30);
    const currentSort = ref("updated_desc");
    const sortOptions = [
      { value: "updated_desc", label: "Last Updated" },
      { value: "name_asc", label: "Name A-Z" },
      { value: "created_desc", label: "Creation Date" }
    ];
    const hasResults = computed(() => artists.value.length > 0);
    const isEmptyState = computed(() => !loading.value && !hasResults.value && !error.value);
    const pageTitle = computed(() => {
      const baseTitle = "Artists | Cultural Archiver";
      if (currentPage.value > 1) {
        return `Artists (Page ${currentPage.value}) | Cultural Archiver`;
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
      currentSort.value = ["updated_desc", "name_asc", "created_desc"].includes(urlSort) ? urlSort : "updated_desc";
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
    async function loadArtists() {
      loading.value = true;
      error.value = null;
      try {
        const cacheBuster = route.query.limit ? void 0 : String(Date.now());
        const response = await apiService.getArtistsList(
          currentPage.value,
          pageSize.value,
          currentSort.value,
          void 0,
          cacheBuster
        );
        if (response.data) {
          console.log("[ArtistIndexView] API Response:", {
            totalItems: response.data.totalItems,
            itemsCount: response.data.items.length,
            currentPage: response.data.currentPage,
            totalPages: response.data.totalPages
          });
          artists.value = response.data.items;
          totalItems.value = response.data.totalItems;
          totalPages.value = response.data.totalPages;
          currentPage.value = response.data.currentPage;
          console.log("[ArtistIndexView] State after update:", {
            artistsCount: artists.value.length,
            totalItems: totalItems.value
          });
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        console.error("Failed to load artists:", err);
        error.value = err instanceof Error ? err.message : "Failed to load artists";
        if (error.value.includes("Page not found") || error.value.includes("does not exist")) {
          if (currentPage.value > 1) {
            currentPage.value = 1;
            updateUrl();
            return loadArtists();
          }
        }
      } finally {
        loading.value = false;
      }
    }
    function handlePageChange(page) {
      currentPage.value = page;
      updateUrl();
      loadArtists();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function handlePageSizeChange(newSize) {
      const currentTopItem = (currentPage.value - 1) * pageSize.value + 1;
      const newPage = Math.ceil(currentTopItem / newSize);
      pageSize.value = newSize;
      currentPage.value = Math.max(newPage, 1);
      updateUrl();
      loadArtists();
    }
    function handleSortChange(newSort) {
      currentSort.value = newSort;
      currentPage.value = 1;
      pageSize.value = 30;
      updateUrl();
      loadArtists();
    }
    function handleArtistClick(artist) {
      router.push(`/artist/${artist.id}`);
    }
    watch(
      () => route.query,
      () => {
        initializeFromUrl();
        loadArtists();
      },
      { deep: true }
    );
    onMounted(() => {
      initializeFromUrl();
      loadArtists();
    });
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50" }, _attrs))}><div class="bg-white border-b border-gray-200"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"><div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 class="text-3xl font-bold text-gray-900">Artists</h1><p class="mt-1 text-sm text-gray-600">Browse all artists in our collection</p></div>`);
      _push(ssrRenderComponent(_sfc_main$2, {
        "current-sort": currentSort.value,
        options: sortOptions,
        loading: loading.value,
        onSortChange: handleSortChange
      }, null, _parent));
      _push(`</div></div></div><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">`);
      if (error.value) {
        _push(`<div class="text-center py-12"><div class="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto"><h3 class="text-lg font-medium text-red-800 mb-2">Failed to Load Artists</h3><p class="text-red-600 mb-4">${ssrInterpolate(error.value)}</p><button class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500"> Try Again </button></div></div>`);
      } else if (isEmptyState.value) {
        _push(`<div class="text-center py-12"><div class="max-w-md mx-auto"><div class="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path></svg></div><h3 class="text-lg font-medium text-gray-900 mb-2">No artists found</h3><p class="text-gray-500 mb-4"> Artists will appear here as artworks are added to the collection. </p>`);
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
          _push(`<span>${ssrInterpolate(totalItems.value.toLocaleString())} artist${ssrInterpolate(totalItems.value === 1 ? "" : "s")} found </span>`);
        } else {
          _push(ssrRenderComponent(_sfc_main$3, { class: "inline-block w-4 h-4" }, null, _parent));
        }
        _push(`</p></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8"><!--[-->`);
        ssrRenderList(artists.value, (artist) => {
          _push(ssrRenderComponent(ArtistCard, {
            key: artist.id,
            artist,
            loading: loading.value,
            onClick: handleArtistClick
          }, null, _parent));
        });
        _push(`<!--]--></div>`);
        _push(ssrRenderComponent(_sfc_main$4, {
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ArtistIndexView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=ArtistIndexView-BQ9kow-W.js.map
