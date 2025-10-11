import { defineComponent, computed, mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderStyle, ssrRenderAttr, ssrInterpolate, ssrRenderSlot, ssrIncludeBooleanAttr } from 'vue/server-renderer';
import { g as getImageSizedURL } from './image-CoH3F98X.js';
import { _ as _export_sfc } from '../ssr-entry-server.js';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ArtworkCard",
  __ssrInlineRender: true,
  props: {
    artwork: {},
    loading: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    showDistance: { type: Boolean, default: false },
    clickable: { type: Boolean, default: true },
    showAddReport: { type: Boolean, default: false }
  },
  emits: ["click", "imageLoad", "imageError", "addReport"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const artworkTitle = computed(() => {
      if (typeof props.artwork.title === "string" && props.artwork.title.trim().length > 0) {
        return props.artwork.title.trim();
      }
      if (props.artwork.tags && typeof props.artwork.tags === "object") {
        const title = props.artwork.tags.title || props.artwork.tags.name;
        if (title && typeof title === "string") {
          return title;
        }
      }
      return props.artwork.type_name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    });
    const artworkType = computed(() => {
      return props.artwork.type_name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    });
    const hasPhoto = computed(() => !!props.artwork.recent_photo);
    const photoUrl = computed(() => {
      if (!props.artwork.recent_photo) return null;
      if (props.artwork.recent_photo.startsWith("http")) {
        return getImageSizedURL(props.artwork.recent_photo, "thumbnail");
      }
      return getImageSizedURL(props.artwork.recent_photo, "thumbnail");
    });
    const distanceText = computed(() => {
      if (!props.showDistance || !props.artwork.distance_km) return null;
      const distance = props.artwork.distance_km;
      if (distance < 1) {
        return `${Math.round(distance * 1e3)}m away`;
      }
      return `${distance.toFixed(1)}km away`;
    });
    const photoCount = computed(() => {
      const count = props.artwork.photo_count || 0;
      if (count === 0) return "No photos";
      if (count === 1) return "1 photo";
      return `${count} photos`;
    });
    const artistName = computed(() => {
      if (props.artwork.artists && Array.isArray(props.artwork.artists) && props.artwork.artists.length > 0) {
        return props.artwork.artists.map((a) => a.name).join(", ");
      }
      if (props.artwork.artist_name) return props.artwork.artist_name;
      if (props.artwork.tags && typeof props.artwork.tags === "object") {
        return props.artwork.tags.artist || props.artwork.tags.artist_name || props.artwork.tags.creator || props.artwork.tags.author || "";
      }
      return "";
    });
    const materialYear = computed(() => {
      const tags = props.artwork.tags;
      if (!tags) return "";
      const m = tags.material;
      const y = tags.year;
      if (m && y) return `${m} · ${y}`;
      if (m) return String(m);
      if (y) return String(y);
      return "";
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<article${ssrRenderAttrs(mergeProps({
        class: ["artwork-card rounded-xl shadow-sm border-1 transition-all duration-300 ease-in-out hover:shadow-2xl transform-gpu overflow-hidden", {
          "cursor-pointer": _ctx.clickable && !_ctx.loading,
          "cursor-default": !_ctx.clickable || _ctx.loading,
          "opacity-50": _ctx.loading,
          "h-32": _ctx.compact,
          "h-auto": !_ctx.compact
        }],
        style: { background: "var(--md-surface, white)", borderColor: "var(--md-outline, rgba(0,0,0,0.08))" },
        tabindex: _ctx.clickable ? 0 : -1,
        role: "button",
        "aria-label": `View artwork: ${artworkTitle.value}`
      }, _attrs))} data-v-fb7a6abd>`);
      if (_ctx.compact) {
        _push(`<div class="flex h-full" data-v-fb7a6abd><div class="flex-shrink-0 w-32 h-full relative overflow-hidden rounded-l-lg" style="${ssrRenderStyle({ background: "var(--md-surface-variant, #f3f4f6)" })}" data-v-fb7a6abd>`);
        if (hasPhoto.value && photoUrl.value) {
          _push(`<img${ssrRenderAttr("src", photoUrl.value)}${ssrRenderAttr("alt", `Photo of ${artworkTitle.value}`)} class="w-full h-full object-cover block" data-v-fb7a6abd>`);
        } else {
          _push(`<div class="w-full h-full flex items-center justify-center" style="${ssrRenderStyle({ background: "var(--md-surface-variant, #fafafa)" })}" aria-hidden="true" data-v-fb7a6abd><svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="${ssrRenderStyle({ color: "var(--md-outline, #9ca3af)" })}" data-v-fb7a6abd><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" data-v-fb7a6abd></path></svg></div>`);
        }
        if (!hasPhoto.value) {
          _push(`<div class="absolute inset-0 flex items-center justify-center pointer-events-none" data-v-fb7a6abd><span class="text-xs font-medium px-2 py-1 rounded" style="${ssrRenderStyle({ background: "rgba(0,0,0,0.6)", color: "#ffffff" })}" data-v-fb7a6abd>${ssrInterpolate(photoCount.value)}</span></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="absolute top-2 left-2 z-10 badge-slot" data-v-fb7a6abd>`);
        ssrRenderSlot(_ctx.$slots, "badge", {}, null, _push, _parent);
        _push(`</div>`);
        if (_ctx.loading) {
          _push(`<div class="absolute inset-0 flex items-center justify-center" style="${ssrRenderStyle({ background: "color-mix(in srgb, var(--md-surface, white) 75%, transparent)" })}" data-v-fb7a6abd><div class="animate-spin rounded-full h-4 w-4" style="${ssrRenderStyle({ borderBottomColor: "var(--md-primary, #2563eb)", borderWidth: "2px", borderStyle: "solid" })}" data-v-fb7a6abd></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div class="flex-1 p-3 min-w-0" data-v-fb7a6abd><h3 class="text-sm font-medium text-gray-900 truncate mb-1" data-v-fb7a6abd>${ssrInterpolate(artworkTitle.value)}</h3>`);
        if (artistName.value) {
          _push(`<p class="text-xs text-gray-500 truncate mb-1" data-v-fb7a6abd>${ssrInterpolate(artistName.value)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="mb-1" data-v-fb7a6abd><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity" style="${ssrRenderStyle({ background: "var(--md-primary-container, #e0e7ff)", color: "var(--md-on-primary-container, #1e40af)" })}" data-v-fb7a6abd>${ssrInterpolate(artworkType.value)}</span></div><div class="flex items-center justify-between text-xs text-gray-500" data-v-fb7a6abd>`);
        if (distanceText.value) {
          _push(`<span data-v-fb7a6abd>${ssrInterpolate(distanceText.value)}</span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div></div>`);
      } else {
        _push(`<div class="overflow-hidden rounded-xl" data-v-fb7a6abd><div class="aspect-w-1 aspect-h-1 bg-gray-100 relative" data-v-fb7a6abd>`);
        if (hasPhoto.value && photoUrl.value) {
          _push(`<img${ssrRenderAttr("src", photoUrl.value)}${ssrRenderAttr("alt", `Photo of ${artworkTitle.value}`)} class="w-full h-full object-cover block" data-v-fb7a6abd>`);
        } else {
          _push(`<div class="w-full h-full flex items-center justify-center bg-gray-50" aria-hidden="true" data-v-fb7a6abd><svg class="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-fb7a6abd><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" data-v-fb7a6abd></path></svg></div>`);
        }
        if (!hasPhoto.value) {
          _push(`<div class="absolute inset-0 flex items-center justify-center pointer-events-none" data-v-fb7a6abd><span class="text-sm font-medium px-3 py-1.5 rounded" style="${ssrRenderStyle({ background: "rgba(0,0,0,0.6)", color: "#ffffff" })}" data-v-fb7a6abd>${ssrInterpolate(photoCount.value)}</span></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="absolute top-2 left-2 z-10 badge-slot" data-v-fb7a6abd>`);
        ssrRenderSlot(_ctx.$slots, "badge", {}, null, _push, _parent);
        _push(`</div>`);
        if (_ctx.loading) {
          _push(`<div class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center" data-v-fb7a6abd><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" data-v-fb7a6abd></div></div>`);
        } else {
          _push(`<!---->`);
        }
        if (_ctx.artwork.photo_count && _ctx.artwork.photo_count > 1) {
          _push(`<div class="photo-count-overlay absolute top-2 right-2 text-xs px-2 py-1 rounded-full z-10 flex items-center gap-1" style="${ssrRenderStyle({ background: "rgba(0,0,0,0.7)", color: "#ffffff" })}" data-v-fb7a6abd><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-fb7a6abd><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" data-v-fb7a6abd></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" data-v-fb7a6abd></path></svg> ${ssrInterpolate(photoCount.value)}</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="type-badge-overlay absolute top-2 left-2 z-10" data-v-fb7a6abd><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style="${ssrRenderStyle({ background: "rgba(0,0,0,0.7)", color: "#ffffff" })}" data-v-fb7a6abd>${ssrInterpolate(artworkType.value)}</span></div><div class="text-overlay absolute left-0 right-0 bottom-0 p-3 text-white z-10" style="${ssrRenderStyle({ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%)" })}" data-v-fb7a6abd><h3 class="text-base md:text-xl font-semibold leading-tight line-clamp-2" style="${ssrRenderStyle({ color: "#ffffff" })}" data-v-fb7a6abd>${ssrInterpolate(artworkTitle.value)}</h3>`);
        if (artistName.value) {
          _push(`<p class="text-xs mt-1.5 truncate" style="${ssrRenderStyle({ color: "var(--md-on-surface-variant, #e5e7eb)" })}" data-v-fb7a6abd>${ssrInterpolate(artistName.value)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="mt-1.5" data-v-fb7a6abd><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity" style="${ssrRenderStyle({ background: "rgba(255,255,255,0.25)", color: "#ffffff", backdropFilter: "blur(8px)" })}" data-v-fb7a6abd>${ssrInterpolate(artworkType.value)}</span></div>`);
        if (_ctx.showDistance && distanceText.value) {
          _push(`<p class="text-xs mt-1" style="${ssrRenderStyle({ color: "var(--md-on-surface-variant, #e5e7eb)" })}" data-v-fb7a6abd>${ssrInterpolate(distanceText.value)}</p>`);
        } else {
          _push(`<!---->`);
        }
        if (materialYear.value) {
          _push(`<p class="text-xs mt-1" style="${ssrRenderStyle({ color: "var(--md-on-surface-variant, #cbd5e1)" })}" data-v-fb7a6abd>${ssrInterpolate(materialYear.value)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
        if (_ctx.showAddReport) {
          _push(`<div class="mt-2 px-3 pb-3" data-v-fb7a6abd><button${ssrIncludeBooleanAttr(!!_ctx.loading) ? " disabled" : ""} class="w-full px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200" style="${ssrRenderStyle({ background: "var(--md-primary, #2563eb)", color: "var(--md-on-primary, #fff)", border: "1px solid transparent" })}" data-v-fb7a6abd><svg class="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-fb7a6abd><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" data-v-fb7a6abd></path></svg> Add photo to Artwork </button></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      }
      _push(`</article>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ArtworkCard.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ArtworkCard = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-fb7a6abd"]]);

export { ArtworkCard as A };
//# sourceMappingURL=ArtworkCard-0An4ZMhk.js.map
