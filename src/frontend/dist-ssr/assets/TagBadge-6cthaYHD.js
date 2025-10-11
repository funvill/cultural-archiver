import { defineComponent, ref, computed, watch, onMounted, mergeProps, nextTick, useSSRContext, unref } from 'vue';
import { ssrRenderAttrs, ssrRenderAttr, ssrRenderStyle, ssrInterpolate, ssrRenderList, ssrRenderClass } from 'vue/server-renderer';
import { f as useAnnouncer, _ as _export_sfc } from '../ssr-entry-server.js';
import { g as getImageSizedURL } from './image-CoH3F98X.js';
import { a as getTagDefinition, g as getCategoriesOrderedForDisplay, f as formatTagValueForDisplay } from './tagSchema-DxDwFgYK.js';

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "PhotoCarousel",
  __ssrInlineRender: true,
  props: {
    photos: {},
    currentIndex: { default: 0 },
    showLicenseInfo: { type: Boolean, default: true },
    showSubmissionDate: { type: Boolean, default: false },
    altTextPrefix: { default: "Artwork photo" }
  },
  emits: ["update:currentIndex", "fullscreen", "photoSelect"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const { announceInfo } = useAnnouncer();
    const carouselRef = ref();
    ref(0);
    ref(0);
    ref(false);
    const preloaded = ref(/* @__PURE__ */ new Set());
    const currentPhotoIndex = computed({
      get: () => props.currentIndex || 0,
      set: (value) => emit("update:currentIndex", value)
    });
    const hasMultiplePhotos = computed(() => props.photos.length > 1);
    const currentPhoto = computed(() => {
      if (props.photos.length === 0) return null;
      const original = props.photos[currentPhotoIndex.value] || props.photos[0];
      if (!original) return null;
      return getImageSizedURL(original, "medium");
    });
    const nextPhotoUrl = computed(() => {
      if (props.photos.length <= 1) return null;
      const nextIndex = (currentPhotoIndex.value + 1) % props.photos.length;
      const photo = props.photos[nextIndex];
      if (!photo) return null;
      return getImageSizedURL(photo, "medium");
    });
    const nextNextPhotoUrl = computed(() => {
      if (props.photos.length <= 2) return null;
      const nextNextIndex = (currentPhotoIndex.value + 2) % props.photos.length;
      const photo = props.photos[nextNextIndex];
      if (!photo) return null;
      return getImageSizedURL(photo, "medium");
    });
    const photoAltText = computed(() => {
      if (props.photos.length === 0) return "No photos available";
      const current = currentPhotoIndex.value + 1;
      const total = props.photos.length;
      return `${props.altTextPrefix} ${current} of ${total}`;
    });
    function prefetchImage(url) {
      if (!url) return;
      if (preloaded.value.has(url)) return;
      try {
        const img = new Image();
        img.src = url;
        preloaded.value.add(url);
      } catch (e) {
      }
    }
    watch(
      () => currentPhotoIndex.value,
      (idx) => {
        const len = props.photos.length;
        if (!len) return;
        const next = (idx + 1) % len;
        const prev = (idx - 1 + len) % len;
        prefetchImage(props.photos[next]);
        prefetchImage(props.photos[prev]);
        prefetchImage(props.photos[(next + 1) % len]);
      },
      { immediate: true }
    );
    function focusCarousel() {
      nextTick(() => {
        carouselRef.value?.focus();
      });
    }
    watch(
      () => props.photos.length,
      (newLength, oldLength) => {
        if (newLength !== oldLength) {
          announceInfo(
            `Photo gallery updated. ${newLength} ${newLength === 1 ? "photo" : "photos"} available`
          );
        }
      }
    );
    onMounted(() => {
      focusCarousel();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "photo-carousel" }, _attrs))} data-v-e5d0b730>`);
      if (currentPhoto.value) {
        _push(`<div class="relative bg-gray-900 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500" tabindex="0" role="img"${ssrRenderAttr("aria-label", photoAltText.value)}${ssrRenderAttr("aria-describedby", hasMultiplePhotos.value ? "photo-navigation-help" : "")} data-v-e5d0b730><img${ssrRenderAttr("src", currentPhoto.value)}${ssrRenderAttr("alt", photoAltText.value)} class="w-full h-80 sm:h-96 md:h-[520px] lg:h-[600px] object-cover cursor-pointer" loading="lazy" data-v-e5d0b730>`);
        if (nextPhotoUrl.value) {
          _push(`<img${ssrRenderAttr("src", nextPhotoUrl.value)} alt="" style="${ssrRenderStyle({ "display": "none" })}" loading="lazy" data-v-e5d0b730>`);
        } else {
          _push(`<!---->`);
        }
        if (nextNextPhotoUrl.value) {
          _push(`<img${ssrRenderAttr("src", nextNextPhotoUrl.value)} alt="" style="${ssrRenderStyle({ "display": "none" })}" loading="lazy" data-v-e5d0b730>`);
        } else {
          _push(`<!---->`);
        }
        if (hasMultiplePhotos.value) {
          _push(`<div class="absolute inset-0 flex items-center justify-between p-4 pointer-events-none" data-v-e5d0b730><button class="bg-black bg-opacity-50 text-white p-2 sm:p-3 rounded-full hover:bg-opacity-70 transition-all pointer-events-auto focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[44px] min-h-[44px] flex items-center justify-center"${ssrRenderAttr("aria-label", `Previous photo (${currentPhotoIndex.value} of ${props.photos.length})`)} data-v-e5d0b730><svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" data-v-e5d0b730><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" data-v-e5d0b730></path></svg></button><button class="bg-black bg-opacity-50 text-white p-2 sm:p-3 rounded-full hover:bg-opacity-70 transition-all pointer-events-auto focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[44px] min-h-[44px] flex items-center justify-center"${ssrRenderAttr("aria-label", `Next photo (${currentPhotoIndex.value + 2} of ${props.photos.length})`)} data-v-e5d0b730><svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" data-v-e5d0b730><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" data-v-e5d0b730></path></svg></button></div>`);
        } else {
          _push(`<!---->`);
        }
        if (hasMultiplePhotos.value) {
          _push(`<div class="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm" data-v-e5d0b730>${ssrInterpolate(currentPhotoIndex.value + 1)} / ${ssrInterpolate(props.photos.length)}</div>`);
        } else {
          _push(`<!---->`);
        }
        if (_ctx.showLicenseInfo) {
          _push(`<div class="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs" data-v-e5d0b730> CC0 </div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs opacity-75" data-v-e5d0b730> Click for fullscreen </div></div>`);
      } else {
        _push(`<div class="h-64 md:h-96 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center rounded-lg" data-v-e5d0b730><div class="text-center text-white" data-v-e5d0b730><svg class="w-16 h-16 mx-auto mb-4 opacity-70" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true" data-v-e5d0b730><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" data-v-e5d0b730></path></svg><p class="text-lg opacity-90" data-v-e5d0b730>No photos available</p></div></div>`);
      }
      if (hasMultiplePhotos.value) {
        _push(`<div class="flex justify-center mt-4 space-x-2" data-v-e5d0b730><!--[-->`);
        ssrRenderList(props.photos, (_photo, index) => {
          _push(`<button class="${ssrRenderClass([index === currentPhotoIndex.value ? "bg-blue-600" : "bg-gray-300 hover:bg-gray-400", "w-3 h-3 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"])}"${ssrRenderAttr("aria-label", `Go to photo ${index + 1}`)}${ssrRenderAttr("aria-current", index === currentPhotoIndex.value ? "true" : "false")} data-v-e5d0b730></button>`);
        });
        _push(`<!--]--></div>`);
      } else {
        _push(`<!---->`);
      }
      if (hasMultiplePhotos.value) {
        _push(`<div id="photo-navigation-help" class="sr-only" data-v-e5d0b730> Use arrow keys to navigate between photos, Enter or Space to open fullscreen, Home for first photo, End for last photo </div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/PhotoCarousel.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const PhotoCarousel = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-e5d0b730"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "TagBadge",
  __ssrInlineRender: true,
  props: {
    tags: {},
    maxVisible: { default: 5 },
    variant: { default: "default" },
    size: { default: "md" },
    colorScheme: { default: "blue" },
    expandable: { type: Boolean, default: true },
    showCategories: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false }
  },
  emits: ["tagClick", "tagSearch", "expandToggle", "categoryToggle"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const isExpanded = ref(false);
    const expandedCategories = ref(/* @__PURE__ */ new Set());
    const normalizedTags = computed(() => {
      if (Array.isArray(props.tags)) {
        if (props.tags.length > 0 && props.tags[0] && "key" in props.tags[0]) {
          return props.tags;
        } else {
          return props.tags.map((tag) => ({
            key: tag.label,
            value: tag.value,
            definition: getTagDefinition(tag.label)
          }));
        }
      }
      return Object.entries(props.tags).map(([key, value]) => ({
        key,
        value: String(value),
        definition: getTagDefinition(key)
      }));
    });
    const tagsByCategory = computed(() => {
      console.log("=== TagBadge Debug Start ===");
      console.log("Props tags:", props.tags);
      console.log("Show categories:", props.showCategories);
      console.log("Normalized tags:", normalizedTags.value);
      if (!props.showCategories) {
        console.log("Categories disabled, returning all tags");
        return { all: normalizedTags.value };
      }
      const categories = getCategoriesOrderedForDisplay();
      console.log("Available categories:", categories);
      const result = {};
      categories.forEach((category) => {
        result[category.key] = [];
      });
      result.other = [];
      console.log("Processing", normalizedTags.value.length, "tags");
      normalizedTags.value.forEach((tag) => {
        const categoryKey = tag.definition?.category || "other";
        console.log(`Tag ${tag.key} = ${tag.value}, category: ${categoryKey}, definition:`, tag.definition);
        if (!result[categoryKey]) {
          result[categoryKey] = [];
        }
        const category = result[categoryKey];
        if (category) {
          category.push(tag);
        }
      });
      Object.keys(result).forEach((key) => {
        const category = result[key];
        if (category && category.length === 0) {
          delete result[key];
        }
      });
      console.log("Final categorized result:", result);
      console.log("=== TagBadge Debug End ===");
      return result;
    });
    const visibleTags = computed(() => {
      if (!props.expandable || isExpanded.value || normalizedTags.value.length <= props.maxVisible) {
        return normalizedTags.value;
      }
      return normalizedTags.value.slice(0, props.maxVisible);
    });
    const hiddenCount = computed(() => {
      if (!props.expandable || isExpanded.value) return 0;
      return Math.max(0, normalizedTags.value.length - props.maxVisible);
    });
    const hasHiddenTags = computed(() => {
      return props.expandable && normalizedTags.value.length > props.maxVisible;
    });
    function isCategoryExpanded(categoryKey) {
      return !props.collapsible || expandedCategories.value.has(categoryKey);
    }
    function formatTagDisplay(tag) {
      if (tag.definition) {
        const formattedValue = formatTagValueForDisplay(tag.key, tag.value);
        return `${tag.definition.label}: ${formattedValue}`;
      }
      const formattedLabel = tag.key.charAt(0).toUpperCase() + tag.key.slice(1);
      return `${formattedLabel}: ${tag.value}`;
    }
    function getCategoryLabel(categoryKey) {
      const categories = getCategoriesOrderedForDisplay();
      const category = categories.find((cat) => cat.key === categoryKey);
      return category?.label || (categoryKey === "other" ? "Other" : categoryKey);
    }
    if (props.collapsible) {
      const categories = Object.keys(tagsByCategory.value);
      if (categories.length > 0 && categories[0]) {
        expandedCategories.value.add(categories[0]);
      }
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "tag-badge-container" }, _attrs))} data-v-372109c8>`);
      if (normalizedTags.value.length === 0) {
        _push(`<div class="text-sm text-gray-500 italic" data-v-372109c8> No tags available </div>`);
      } else if (_ctx.showCategories) {
        _push(`<div class="space-y-4" data-v-372109c8><!--[-->`);
        ssrRenderList(tagsByCategory.value, (categoryTags, categoryKey) => {
          _push(`<div class="border border-gray-200 rounded-lg overflow-hidden" data-v-372109c8>`);
          if (_ctx.collapsible) {
            _push(`<div class="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"${ssrRenderAttr("aria-expanded", isCategoryExpanded(categoryKey))} role="button" data-v-372109c8><h4 class="text-sm font-medium text-gray-900" data-v-372109c8>${ssrInterpolate(getCategoryLabel(categoryKey))} <span class="text-xs text-gray-500 ml-1" data-v-372109c8>(${ssrInterpolate(categoryTags.length)})</span></h4><svg class="${ssrRenderClass([{ "rotate-180": isCategoryExpanded(categoryKey) }, "h-4 w-4 text-gray-500 transition-transform duration-200"])}" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-372109c8><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" data-v-372109c8></path></svg></div>`);
          } else {
            _push(`<div class="px-4 py-2 bg-gray-50 border-b border-gray-200" data-v-372109c8><h4 class="text-sm font-medium text-gray-900" data-v-372109c8>${ssrInterpolate(getCategoryLabel(categoryKey))} <span class="text-xs text-gray-500 ml-1" data-v-372109c8>(${ssrInterpolate(categoryTags.length)})</span></h4></div>`);
          }
          _push(`<div style="${ssrRenderStyle(isCategoryExpanded(categoryKey) ? null : { display: "none" })}" class="p-3" data-v-372109c8><div class="space-y-1" data-v-372109c8><!--[-->`);
          ssrRenderList(categoryTags, (tag, index) => {
            _push(`<div class="text-sm cursor-pointer"${ssrRenderAttr("aria-label", `Tag: ${formatTagDisplay(tag)}`)} role="button" tabindex="0" data-v-372109c8><span class="font-bold" data-v-372109c8>${ssrInterpolate(tag.definition?.label || tag.key)}:</span><span class="ml-1" data-v-372109c8>${ssrInterpolate(unref(formatTagValueForDisplay)(tag.key, tag.value))}</span></div>`);
          });
          _push(`<!--]--></div></div></div>`);
        });
        _push(`<!--]--></div>`);
      } else {
        _push(`<div class="space-y-1" data-v-372109c8><!--[-->`);
        ssrRenderList(visibleTags.value, (tag, index) => {
          _push(`<div class="text-sm p-1 rounded flex items-center justify-between hover:bg-gray-50 cursor-pointer"${ssrRenderAttr("aria-label", `Tag: ${formatTagDisplay(tag)}`)} role="button" tabindex="0" data-v-372109c8><div class="text-left w-full flex items-center gap-2" data-v-372109c8><span class="font-bold" data-v-372109c8>${ssrInterpolate(tag.definition?.label || tag.key)}:</span><span class="ml-1" data-v-372109c8>${ssrInterpolate(unref(formatTagValueForDisplay)(tag.key, tag.value))}</span></div><span class="ml-2 p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"${ssrRenderAttr("title", `Search for ${tag.value}`)} role="button" tabindex="0"${ssrRenderAttr("aria-label", `Search for ${tag.value}`)} data-v-372109c8><svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-372109c8><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" data-v-372109c8></path></svg></span></div>`);
        });
        _push(`<!--]-->`);
        if (hasHiddenTags.value) {
          _push(`<button class="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"${ssrRenderAttr("aria-label", isExpanded.value ? "Show fewer tags" : `Show ${hiddenCount.value} more tags`)}${ssrRenderAttr("aria-expanded", isExpanded.value)} type="button" data-v-372109c8>`);
          if (!isExpanded.value) {
            _push(`<span data-v-372109c8> +${ssrInterpolate(hiddenCount.value)} more </span>`);
          } else {
            _push(`<span data-v-372109c8> Show less </span>`);
          }
          _push(`<svg class="${ssrRenderClass([{ "rotate-180": isExpanded.value }, "ml-1 w-4 h-4 transition-transform duration-200"])}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" data-v-372109c8><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" data-v-372109c8></path></svg></button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      }
      _push(`<div class="sr-only" aria-live="polite" data-v-372109c8>`);
      if (normalizedTags.value.length > 0) {
        _push(`<span data-v-372109c8>${ssrInterpolate(normalizedTags.value.length)} tags available. `);
        if (!_ctx.showCategories) {
          _push(`<span data-v-372109c8>${ssrInterpolate(isExpanded.value ? "All tags shown." : `Showing ${visibleTags.value.length} of ${normalizedTags.value.length} tags.`)}</span>`);
        } else {
          _push(`<span data-v-372109c8> Organized by ${ssrInterpolate(Object.keys(tagsByCategory.value).length)} categories. </span>`);
        }
        _push(`</span>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/TagBadge.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const TagBadge = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-372109c8"]]);

export { PhotoCarousel as P, TagBadge as T };
//# sourceMappingURL=TagBadge-6cthaYHD.js.map
