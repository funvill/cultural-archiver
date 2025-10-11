import { defineComponent, ref, mergeProps, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrInterpolate, ssrRenderAttr, ssrRenderClass, ssrRenderList, ssrRenderStyle, ssrIncludeBooleanAttr, ssrLooseContain } from 'vue/server-renderer';
import { u as useArtworkTypeFilters } from './useArtworkTypeFilters-BIVqZddm.js';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ArtworkTypeFilter",
  __ssrInlineRender: true,
  props: {
    title: {},
    description: {},
    showControlButtons: { type: Boolean },
    columns: {},
    compact: { type: Boolean },
    collapsible: { type: Boolean },
    defaultCollapsed: { type: Boolean }
  },
  emits: ["typeToggled", "allEnabled", "allDisabled"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const { artworkTypes} = useArtworkTypeFilters();
    const isCollapsed = ref(props.defaultCollapsed ?? false);
    const getGridClasses = (columns = 3) => {
      const columnClasses = {
        1: "grid-cols-1",
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      };
      return columnClasses[columns] || columnClasses[3];
    };
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "artwork-type-filter" }, _attrs))}>`);
      if (!props.compact) {
        _push(`<div class="flex items-center justify-between mb-3"><div><h3 class="text-sm font-medium text-gray-900 mb-1">${ssrInterpolate(props.title || "Artwork Types Filtering")}</h3><p class="text-xs text-gray-600">${ssrInterpolate(props.description || "Select which types of artworks to display. Each colored circle shows the marker color used.")}</p></div>`);
        if (props.collapsible) {
          _push(`<button class="flex items-center text-xs text-gray-600 hover:text-gray-900 focus:outline-none focus:text-gray-900 transition-colors ml-4"${ssrRenderAttr("aria-expanded", !isCollapsed.value)}${ssrRenderAttr("aria-label", isCollapsed.value ? "Show filters" : "Hide filters")}><span class="mr-1">${ssrInterpolate(isCollapsed.value ? "Show" : "Hide")}</span><svg class="${ssrRenderClass([{ "rotate-180": !isCollapsed.value }, "w-4 h-4 transition-transform duration-200"])}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      if (!isCollapsed.value || !props.collapsible) {
        _push(`<div class="space-y-3">`);
        if (props.showControlButtons !== false) {
          _push(`<div class="flex gap-2"><button class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"> Enable All </button><button class="text-xs bg-gray-600 text-white px-3 py-1.5 rounded hover:bg-gray-700 focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 transition-colors"> Disable All </button></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="${ssrRenderClass([getGridClasses(props.columns), "grid gap-1.5"])}"><!--[-->`);
        ssrRenderList(unref(artworkTypes), (artworkType) => {
          _push(`<div class="flex items-center"><input${ssrRenderAttr("id", `artwork-type-${artworkType.key}`)} type="checkbox" class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"${ssrIncludeBooleanAttr(Array.isArray(artworkType.enabled) ? ssrLooseContain(artworkType.enabled, null) : artworkType.enabled) ? " checked" : ""}><label${ssrRenderAttr("for", `artwork-type-${artworkType.key}`)} class="ml-2 flex items-center text-xs text-gray-700 select-none min-w-0 cursor-pointer"><span class="inline-block w-3 h-3 rounded-full mr-1.5 border border-white shadow-sm flex-shrink-0" style="${ssrRenderStyle({ backgroundColor: artworkType.color })}"></span><span class="truncate">${ssrInterpolate(artworkType.label)}</span></label></div>`);
        });
        _push(`<!--]--></div></div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ArtworkTypeFilter.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as _ };
//# sourceMappingURL=ArtworkTypeFilter-BnCnhf0a.js.map
