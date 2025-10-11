import { defineComponent, unref, useSSRContext } from 'vue';
import { ssrRenderList, ssrRenderStyle } from 'vue/server-renderer';
import { _ as _export_sfc } from '../ssr-entry-server.js';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "SkeletonCard",
  __ssrInlineRender: true,
  props: {
    compact: { type: Boolean, default: false },
    count: { default: 1 }
  },
  setup(__props) {
    const props = __props;
    const skeletons = Array.from({ length: props.count }, (_, i) => i);
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<!--[-->`);
      ssrRenderList(unref(skeletons), (index) => {
        _push(`<div data-v-9ed03da1>`);
        if (_ctx.compact) {
          _push(`<div class="rounded-lg shadow-sm h-32 animate-pulse theme-surface" style="${ssrRenderStyle({ borderColor: "var(--md-outline, #e5e7eb)" })}" role="status" aria-label="Loading artwork..." data-v-9ed03da1><div class="flex h-full" data-v-9ed03da1><div class="flex-shrink-0 w-32 h-full rounded-l-lg theme-surface-variant" data-v-9ed03da1></div><div class="flex-1 p-3 space-y-2" data-v-9ed03da1><div class="h-4 rounded w-3/4 theme-surface-variant" data-v-9ed03da1></div><div class="h-3 rounded w-1/2 theme-surface-variant" data-v-9ed03da1></div><div class="flex justify-between" data-v-9ed03da1><div class="h-3 rounded w-1/4 theme-surface-variant" data-v-9ed03da1></div><div class="h-3 rounded w-1/4 theme-surface-variant" data-v-9ed03da1></div></div></div></div></div>`);
        } else {
          _push(`<div class="rounded-lg shadow-sm overflow-hidden animate-pulse theme-surface" style="${ssrRenderStyle({ borderColor: "var(--md-outline, #e5e7eb)" })}" role="status" aria-label="Loading artwork..." data-v-9ed03da1><div class="w-full h-48 theme-surface-variant" data-v-9ed03da1></div><div class="p-4 space-y-3" data-v-9ed03da1><div class="space-y-2" data-v-9ed03da1><div class="h-5 rounded w-4/5 theme-surface-variant" data-v-9ed03da1></div><div class="h-5 rounded w-3/5 theme-surface-variant" data-v-9ed03da1></div></div><div class="flex items-center justify-between" data-v-9ed03da1><div class="h-6 rounded-full w-20 theme-surface-variant" data-v-9ed03da1></div><div class="h-4 rounded w-16 theme-surface-variant" data-v-9ed03da1></div></div><div class="space-y-2" data-v-9ed03da1><div class="flex items-center space-x-2" data-v-9ed03da1><div class="h-3 rounded w-12 theme-surface-variant" data-v-9ed03da1></div><div class="h-3 rounded w-24 theme-surface-variant" data-v-9ed03da1></div></div><div class="flex items-center space-x-2" data-v-9ed03da1><div class="h-3 rounded w-16 theme-surface-variant" data-v-9ed03da1></div><div class="h-3 rounded w-20 theme-surface-variant" data-v-9ed03da1></div></div></div></div></div>`);
        }
        _push(`<span class="sr-only" data-v-9ed03da1>Loading artwork information...</span></div>`);
      });
      _push(`<!--]-->`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/SkeletonCard.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const SkeletonCard = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-9ed03da1"]]);

export { SkeletonCard as S };
//# sourceMappingURL=SkeletonCard-CEBdOJ8w.js.map
