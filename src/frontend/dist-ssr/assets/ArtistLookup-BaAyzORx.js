import { defineComponent, ref, watch, mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderList, ssrInterpolate, ssrRenderAttr, ssrRenderClass } from 'vue/server-renderer';
import { _ as _export_sfc } from '../ssr-entry-server.js';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ArtistLookup",
  __ssrInlineRender: true,
  props: {
    modelValue: {},
    limit: {}
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const query = ref("");
    const results = ref([]);
    const selected = ref(props.modelValue ? [...props.modelValue] : []);
    const showDropdown = ref(false);
    const highlighted = ref(-1);
    props.limit ?? 10;
    watch(() => props.modelValue, (v) => {
      selected.value = v ? [...v] : [];
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "artist-lookup" }, _attrs))} data-v-11796627><label class="block text-sm font-medium text-gray-700" data-v-11796627>Artists</label><div class="mt-1 flex items-center flex-wrap gap-2" data-v-11796627><!--[-->`);
      ssrRenderList(selected.value, (artist) => {
        _push(`<span class="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-sm" data-v-11796627><span class="mr-2" data-v-11796627>${ssrInterpolate(artist.name)}</span><button type="button" aria-label="Remove artist" class="text-gray-500 hover:text-gray-700" data-v-11796627>×</button></span>`);
      });
      _push(`<!--]--></div><div class="relative mt-2" data-v-11796627><input${ssrRenderAttr("value", query.value)} type="text" class="w-full border rounded px-3 py-2" placeholder="Search artists..." aria-autocomplete="list"${ssrRenderAttr("aria-expanded", showDropdown.value)} data-v-11796627>`);
      if (showDropdown.value && results.value.length) {
        _push(`<ul class="absolute z-10 w-full bg-white border mt-1 max-h-56 overflow-auto shadow-lg" data-v-11796627><!--[-->`);
        ssrRenderList(results.value, (r, idx) => {
          _push(`<li class="${ssrRenderClass(["px-3 py-2 cursor-pointer", { "bg-blue-50": idx === highlighted.value }])}" data-v-11796627><div class="flex items-center justify-between" data-v-11796627><div data-v-11796627><div class="font-medium" data-v-11796627>${ssrInterpolate(r.name)}</div><div class="text-xs text-gray-500" data-v-11796627>${ssrInterpolate(r.description_short || "")}</div></div></div></li>`);
        });
        _push(`<!--]--></ul>`);
      } else if (showDropdown.value && query.value.trim().length > 0 && !results.value.length) {
        _push(`<div class="absolute z-10 w-full bg-white border mt-1 px-3 py-2 text-sm text-gray-600 shadow-lg" data-v-11796627> No results found for &quot;${ssrInterpolate(query.value)}&quot; </div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ArtistLookup.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ArtistLookup = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-11796627"]]);

export { ArtistLookup as A };
//# sourceMappingURL=ArtistLookup-BaAyzORx.js.map
