import { defineComponent, ref, computed, onMounted, resolveComponent, mergeProps, withCtx, createVNode, createBlock, createCommentVNode, toDisplayString, openBlock, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrInterpolate, ssrRenderList, ssrRenderAttr, ssrRenderComponent } from 'vue/server-renderer';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "PageListView",
  __ssrInlineRender: true,
  setup(__props) {
    const pages = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const formatDate = (dateStr) => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        });
      } catch {
        return dateStr;
      }
    };
    const categorizedPages = computed(() => {
      const groups = /* @__PURE__ */ new Map();
      pages.value.forEach((page) => {
        const categoryName = page.category || "Uncategorized";
        if (!groups.has(categoryName)) {
          groups.set(categoryName, []);
        }
        groups.get(categoryName).push(page);
      });
      const categoryGroups = Array.from(groups.entries()).map(([name, pageList]) => ({
        name,
        count: pageList.length,
        pages: pageList
      }));
      categoryGroups.sort((a, b) => {
        if (a.name === "Uncategorized") return -1;
        if (b.name === "Uncategorized") return 1;
        return a.name.localeCompare(b.name);
      });
      return categoryGroups;
    });
    const loadPages = async () => {
      try {
        loading.value = true;
        error.value = null;
        const resp = await fetch("/pages-manifest.json");
        if (!resp.ok) throw new Error("Failed to load pages manifest");
        const rawPages = await resp.json();
        const loadedPages = rawPages.map((p) => ({
          slug: p.slug,
          title: p.title,
          date: p.date ?? void 0,
          category: p.category ?? void 0
        }));
        pages.value = loadedPages;
      } catch (err) {
        error.value = err instanceof Error ? err.message : "Unknown error";
        console.error("Failed to load pages:", err);
      } finally {
        loading.value = false;
      }
    };
    onMounted(() => {
      loadPages();
    });
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 dark:bg-gray-900" }, _attrs))}><div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"><div class="max-w-4xl mx-auto px-4 py-8"><h1 class="text-3xl font-bold text-gray-900 dark:text-white">Pages</h1><p class="mt-2 text-gray-600 dark:text-gray-400"> Documentation, policies, and information </p></div></div>`);
      if (loading.value) {
        _push(`<div class="max-w-4xl mx-auto px-4 py-8"><div class="animate-pulse space-y-4"><div class="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div><div class="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div><div class="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div></div></div>`);
      } else if (error.value) {
        _push(`<div class="max-w-4xl mx-auto px-4 py-8"><div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"><p class="text-red-800 dark:text-red-200"> Failed to load pages: ${ssrInterpolate(error.value)}</p></div></div>`);
      } else {
        _push(`<div class="max-w-4xl mx-auto px-4 py-8">`);
        if (pages.value.length === 0) {
          _push(`<div class="text-center py-12"><p class="text-gray-500 dark:text-gray-400">No pages available.</p></div>`);
        } else {
          _push(`<div class="space-y-8"><div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"><h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Categories</h2><nav class="space-y-2"><!--[-->`);
          ssrRenderList(categorizedPages.value, (category) => {
            _push(`<a${ssrRenderAttr("href", `#category-${category.name.toLowerCase().replace(/\s+/g, "-")}`)} class="flex justify-between items-center py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"><span class="text-gray-900 dark:text-white">${ssrInterpolate(category.name)}</span><span class="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">${ssrInterpolate(category.count)}</span></a>`);
          });
          _push(`<!--]--></nav></div><!--[-->`);
          ssrRenderList(categorizedPages.value, (category) => {
            _push(`<div class="space-y-4"><h2${ssrRenderAttr("id", `category-${category.name.toLowerCase().replace(/\s+/g, "-")}`)} class="text-2xl font-bold text-gray-900 dark:text-white pt-4">${ssrInterpolate(category.name)} <span class="text-lg font-normal text-gray-500 dark:text-gray-400 ml-2"> (${ssrInterpolate(category.count)}) </span></h2><div class="space-y-3"><!--[-->`);
            ssrRenderList(category.pages, (page) => {
              _push(ssrRenderComponent(_component_router_link, {
                key: page.slug,
                to: `/pages/${page.slug}`,
                class: "block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all"
              }, {
                default: withCtx((_, _push2, _parent2, _scopeId) => {
                  if (_push2) {
                    _push2(`<h3 class="text-lg font-semibold text-gray-900 dark:text-white"${_scopeId}>${ssrInterpolate(page.title)}</h3>`);
                    if (page.date) {
                      _push2(`<p class="mt-1 text-sm text-gray-500 dark:text-gray-400"${_scopeId}>${ssrInterpolate(formatDate(page.date))}</p>`);
                    } else {
                      _push2(`<!---->`);
                    }
                  } else {
                    return [
                      createVNode("h3", { class: "text-lg font-semibold text-gray-900 dark:text-white" }, toDisplayString(page.title), 1),
                      page.date ? (openBlock(), createBlock("p", {
                        key: 0,
                        class: "mt-1 text-sm text-gray-500 dark:text-gray-400"
                      }, toDisplayString(formatDate(page.date)), 1)) : createCommentVNode("", true)
                    ];
                  }
                }),
                _: 2
              }, _parent));
            });
            _push(`<!--]--></div></div>`);
          });
          _push(`<!--]--></div>`);
        }
        _push(`</div>`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/PageListView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=PageListView-ClN7vCYs.js.map
