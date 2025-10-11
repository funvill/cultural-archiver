import { defineComponent, computed, mergeProps, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrInterpolate, ssrRenderAttr, ssrIncludeBooleanAttr, ssrRenderList, ssrRenderComponent, ssrRenderClass } from 'vue/server-renderer';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';

const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "PaginationControls",
  __ssrInlineRender: true,
  props: {
    currentPage: {},
    totalPages: {},
    totalItems: {},
    pageSize: {},
    loading: { type: Boolean, default: false }
  },
  emits: ["pageChange", "pageSizeChange"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const pageSizes = [10, 30, 50];
    const hasPrevious = computed(() => props.currentPage > 1);
    const hasNext = computed(() => props.currentPage < props.totalPages);
    const startItem = computed(() => {
      if (props.totalItems === 0) return 0;
      return (props.currentPage - 1) * props.pageSize + 1;
    });
    const endItem = computed(() => {
      return Math.min(props.currentPage * props.pageSize, props.totalItems);
    });
    const pageNumbers = computed(() => {
      const pages = [];
      const maxVisible = 7;
      if (props.totalPages <= maxVisible) {
        for (let i = 1; i <= props.totalPages; i++) {
          pages.push(i);
        }
      } else {
        const start = Math.max(1, props.currentPage - 3);
        const end = Math.min(props.totalPages, props.currentPage + 3);
        if (start > 1) {
          pages.push(1);
          if (start > 2) {
            pages.push(-1);
          }
        }
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
        if (end < props.totalPages) {
          if (end < props.totalPages - 1) {
            pages.push(-1);
          }
          pages.push(props.totalPages);
        }
      }
      return pages;
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "flex flex-col sm:flex-row items-center justify-between gap-4 py-4" }, _attrs))}><div class="text-sm text-gray-700">`);
      if (_ctx.totalItems > 0) {
        _push(`<span> Showing ${ssrInterpolate(startItem.value)} to ${ssrInterpolate(endItem.value)} of ${ssrInterpolate(_ctx.totalItems)} results </span>`);
      } else {
        _push(`<span> No results found </span>`);
      }
      _push(`</div><div class="flex items-center gap-2"><label for="page-size" class="text-sm text-gray-700">Show:</label><select id="page-size"${ssrRenderAttr("value", _ctx.pageSize)}${ssrIncludeBooleanAttr(_ctx.loading || false) ? " disabled" : ""} class="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"><!--[-->`);
      ssrRenderList(pageSizes, (size) => {
        _push(`<option${ssrRenderAttr("value", size)}>${ssrInterpolate(size)}</option>`);
      });
      _push(`<!--]--></select><span class="text-sm text-gray-700">per page</span></div>`);
      if (_ctx.totalPages > 1) {
        _push(`<nav class="flex items-center gap-1"><button${ssrIncludeBooleanAttr(!hasPrevious.value || _ctx.loading || false) ? " disabled" : ""} class="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500">`);
        _push(ssrRenderComponent(unref(ChevronLeftIcon), { class: "w-4 h-4 mr-1" }, null, _parent));
        _push(` Previous </button><!--[-->`);
        ssrRenderList(pageNumbers.value, (page, index) => {
          _push(`<!--[-->`);
          if (page === -1) {
            _push(`<span class="px-3 py-2 text-sm font-medium text-gray-500"> ... </span>`);
          } else {
            _push(`<button${ssrIncludeBooleanAttr(_ctx.loading || false) ? " disabled" : ""} class="${ssrRenderClass([{
              "bg-blue-500 border-blue-500 text-white": page === _ctx.currentPage,
              "bg-white border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700": page !== _ctx.currentPage
            }, "px-3 py-2 text-sm font-medium border disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500"])}">${ssrInterpolate(page)}</button>`);
          }
          _push(`<!--]-->`);
        });
        _push(`<!--]--><button${ssrIncludeBooleanAttr(!hasNext.value || _ctx.loading || false) ? " disabled" : ""} class="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500"> Next `);
        _push(ssrRenderComponent(unref(ChevronRightIcon), { class: "w-4 h-4 ml-1" }, null, _parent));
        _push(`</button></nav>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/PaginationControls.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "SortControls",
  __ssrInlineRender: true,
  props: {
    currentSort: {},
    options: {},
    loading: { type: Boolean, default: false }
  },
  emits: ["sortChange"],
  setup(__props, { emit: __emit }) {
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "flex items-center gap-3" }, _attrs))}><label for="sort-select" class="text-sm font-medium text-gray-700"> Sort by: </label><div class="hidden sm:flex items-center gap-1"><!--[-->`);
      ssrRenderList(_ctx.options, (option) => {
        _push(`<button${ssrIncludeBooleanAttr(_ctx.loading || false) ? " disabled" : ""} class="${ssrRenderClass([{
          "bg-blue-500 text-white border-blue-500": option.value === _ctx.currentSort,
          "bg-white text-gray-700 border-gray-300 hover:bg-gray-50": option.value !== _ctx.currentSort
        }, "px-3 py-2 text-sm font-medium border rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"])}">${ssrInterpolate(option.label)}</button>`);
      });
      _push(`<!--]--></div><select id="sort-select"${ssrRenderAttr("value", _ctx.currentSort)}${ssrIncludeBooleanAttr(_ctx.loading || false) ? " disabled" : ""} class="sm:hidden border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"><!--[-->`);
      ssrRenderList(_ctx.options, (option) => {
        _push(`<option${ssrRenderAttr("value", option.value)}>${ssrInterpolate(option.label)}</option>`);
      });
      _push(`<!--]--></select></div>`);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/SortControls.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LoadingSpinner",
  __ssrInlineRender: true,
  props: {
    size: { default: "md" }
  },
  setup(__props) {
    const props = __props;
    const sizeClasses = computed(() => {
      switch (props.size) {
        case "sm":
          return "w-4 h-4";
        case "lg":
          return "w-8 h-8";
        default:
          return "w-6 h-6";
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "loading-spinner" }, _attrs))}><svg class="${ssrRenderClass([sizeClasses.value, "animate-spin"])}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/LoadingSpinner.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main$1 as _, _sfc_main as a, _sfc_main$2 as b };
//# sourceMappingURL=LoadingSpinner-Cv2Kl6Jf.js.map
