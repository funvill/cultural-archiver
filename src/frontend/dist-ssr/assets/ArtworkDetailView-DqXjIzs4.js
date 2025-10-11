import { defineComponent, ref, computed, watch, mergeProps, unref, nextTick, useSSRContext, onMounted, resolveComponent, withCtx, createBlock, openBlock, Fragment, createTextVNode, toDisplayString } from 'vue';
import { ssrRenderAttrs, ssrInterpolate, ssrRenderList, ssrRenderClass, ssrRenderAttr, ssrIncludeBooleanAttr, ssrLooseContain, ssrLooseEqual, ssrRenderComponent, ssrRenderStyle } from 'vue/server-renderer';
import { marked } from 'marked';
import { useRouter, useRoute } from 'vue-router';
import { u as useArtworksStore } from './artworks-EQolhOHu.js';
import { _ as _export_sfc, d as useAuthStore, e as createLogger, a as apiService, f as useAnnouncer, h as FeedbackDialog, A as AuthModal } from '../ssr-entry-server.js';
import { P as PhotoCarousel, T as TagBadge } from './TagBadge-6cthaYHD.js';
import { M as MiniMap } from './MiniMap-_0n-xEQo.js';
import { g as getCategoriesOrderedForDisplay, a as getTagDefinition, v as validateTagValue, b as getTagsByCategory, f as formatTagValueForDisplay } from './tagSchema-DxDwFgYK.js';
import { A as ArtistLookup } from './ArtistLookup-BaAyzORx.js';
import { u as useUserLists } from './useUserLists-CYQ0cJyO.js';
import { PencilIcon } from '@heroicons/vue/24/outline';
import { g as getMetaForRoute, u as useRouteMeta, b as createArtworkSchema } from './meta-DUKRt9TT.js';
import { u as useToasts } from './useToasts-PudGFTbq.js';
import 'pinia';
import '@vue/server-renderer';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/solid';
import './image-CoH3F98X.js';

const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "TagEditor",
  __ssrInlineRender: true,
  props: {
    modelValue: {},
    disabled: { type: Boolean, default: false },
    maxTags: { default: 30 }
  },
  emits: ["update:modelValue", "tagAdded", "tagRemoved", "validationError"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const selectedTagKey = ref("");
    const tagValue = ref("");
    const normalizedTagValue = computed(() => {
      if (tagValue.value == null) return "";
      return typeof tagValue.value === "string" ? tagValue.value : String(tagValue.value);
    });
    const hasNormalizedTagValue = computed(() => normalizedTagValue.value.trim().length > 0);
    const isAddingTag = ref(true);
    const isEditingTag = ref(false);
    const editingTagKey = ref("");
    const showDropdown = ref(false);
    const validationErrors = ref({});
    const focusedTagKey = ref(null);
    ref(null);
    const valueInputRef = ref(null);
    ref(null);
    const tags = computed({
      get: () => props.modelValue,
      set: (value) => emit("update:modelValue", value)
    });
    const categories = computed(() => getCategoriesOrderedForDisplay());
    const canAddMoreTags = computed(() => {
      return Object.keys(tags.value).length < props.maxTags;
    });
    const selectedTagDefinition = computed(() => {
      return selectedTagKey.value ? getTagDefinition(selectedTagKey.value) : null;
    });
    const currentTagError = computed(() => {
      return selectedTagKey.value ? validationErrors.value[selectedTagKey.value] : null;
    });
    const tagsByCategory = computed(() => {
      const result = {};
      categories.value.forEach((category) => {
        result[category.key] = [];
      });
      result.other = [];
      for (const [key, value] of Object.entries(tags.value)) {
        const definition = getTagDefinition(key);
        if (definition) {
          const categoryArray = result[definition.category];
          if (categoryArray) {
            categoryArray.push({ key, value: String(value), definition });
          }
        } else {
          result.other.push({
            key,
            value: String(value),
            definition: {
              key,
              label: key,
              description: "Unknown tag",
              category: "other",
              dataType: "text"
            }
          });
        }
      }
      for (const categoryKey of Object.keys(result)) {
        const categoryArray = result[categoryKey];
        if (categoryArray && categoryArray.length === 0) {
          delete result[categoryKey];
        }
      }
      return result;
    });
    const hasAnyTags = computed(() => {
      return Object.keys(tags.value).length > 0;
    });
    const exampleTags = [
      { key: "tourism", value: "artwork" },
      { key: "artwork_type", value: "statue" },
      { key: "material", value: "bronze" },
      { key: "artist_name", value: "Jane Doe" },
      { key: "start_date", value: "1998" }
    ];
    function setValidationError(key, error) {
      validationErrors.value = {
        ...validationErrors.value,
        [key]: error
      };
      emit("validationError", validationErrors.value);
    }
    function clearValidationError(key) {
      if (!key) return;
      const errors = { ...validationErrors.value };
      delete errors[key];
      validationErrors.value = errors;
      emit("validationError", validationErrors.value);
    }
    function getCategoryLabel(categoryKey) {
      const category = categories.value.find((cat) => cat.key === categoryKey);
      return category?.label || (categoryKey === "other" ? "Other" : categoryKey);
    }
    function formatValueForDisplay(key, value) {
      return formatTagValueForDisplay(key, value);
    }
    function startEditingTag(key, currentValue) {
      if (props.disabled) return;
      isAddingTag.value = true;
      isEditingTag.value = true;
      editingTagKey.value = key;
      selectedTagKey.value = key;
      tagValue.value = currentValue == null ? "" : typeof currentValue === "string" ? currentValue : String(currentValue);
      showDropdown.value = true;
      nextTick(() => valueInputRef.value?.focus());
    }
    watch([selectedTagKey, tagValue], () => {
      if (selectedTagKey.value && normalizedTagValue.value) {
        const validation = validateTagValue(selectedTagKey.value, normalizedTagValue.value);
        if (!validation.valid) {
          setValidationError(selectedTagKey.value, validation.error || "Invalid value");
        } else {
          clearValidationError(selectedTagKey.value);
        }
      }
    });
    __expose({
      startEditingTag
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: ["tag-editor", { "opacity-50 cursor-not-allowed": _ctx.disabled }]
      }, _attrs))} data-v-c262ad73><div class="flex items-center justify-between mb-4" data-v-c262ad73><h3 class="text-lg font-semibold text-gray-900" data-v-c262ad73>Tags</h3><div class="text-sm text-gray-500" data-v-c262ad73>${ssrInterpolate(Object.keys(tags.value).length)}/${ssrInterpolate(_ctx.maxTags)} tags</div></div>`);
      if (!hasAnyTags.value && !isAddingTag.value) {
        _push(`<div class="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300" data-v-c262ad73><svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" data-v-c262ad73><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" data-v-c262ad73></path></svg><h3 class="text-sm font-medium text-gray-900 mb-2" data-v-c262ad73>No tags yet</h3><p class="text-sm text-gray-500 mb-4" data-v-c262ad73> Add structured metadata to help others discover and learn about this artwork. </p><div class="text-left max-w-md mx-auto mb-6" data-v-c262ad73><p class="text-xs font-medium text-gray-700 mb-2" data-v-c262ad73>Try adding tags like these:</p><div class="flex flex-wrap gap-1" data-v-c262ad73><!--[-->`);
        ssrRenderList(exampleTags, (example) => {
          _push(`<span class="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700" data-v-c262ad73>${ssrInterpolate(example.key)}: ${ssrInterpolate(example.value)}</span>`);
        });
        _push(`<!--]--></div></div>`);
        if (!_ctx.disabled && canAddMoreTags.value) {
          _push(`<button class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors" data-v-c262ad73><svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-c262ad73><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" data-v-c262ad73></path></svg> Add Your First Tag </button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      } else {
        _push(`<div class="space-y-6" data-v-c262ad73><!--[-->`);
        ssrRenderList(tagsByCategory.value, (categoryTags, categoryKey) => {
          _push(`<div class="bg-white border border-gray-200 rounded-lg p-4" data-v-c262ad73><h4 class="font-medium text-gray-900 mb-3" data-v-c262ad73>${ssrInterpolate(getCategoryLabel(categoryKey))}</h4><div class="space-y-2" data-v-c262ad73><!--[-->`);
          ssrRenderList(categoryTags, (tag) => {
            _push(`<div class="${ssrRenderClass([{ "ring-2 ring-blue-500": focusedTagKey.value === tag.key }, "flex items-center justify-between p-3 bg-gray-50 rounded-md group hover:bg-gray-100 transition-colors cursor-pointer"])}" data-v-c262ad73><div class="flex-1 min-w-0" data-v-c262ad73><div class="flex items-baseline gap-2" data-v-c262ad73><span class="text-sm font-bold text-gray-900" data-v-c262ad73>${ssrInterpolate(tag.definition.label)}:</span><span class="text-sm text-gray-600" data-v-c262ad73>${ssrInterpolate(formatValueForDisplay(tag.key, tag.value))}</span></div></div>`);
            if (!_ctx.disabled) {
              _push(`<button class="ml-2 p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-all"${ssrRenderAttr("aria-label", `Remove ${tag.definition.label} tag`)} data-v-c262ad73><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-c262ad73><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" data-v-c262ad73></path></svg></button>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div>`);
          });
          _push(`<!--]--></div></div>`);
        });
        _push(`<!--]-->`);
        if (canAddMoreTags.value && !_ctx.disabled) {
          _push(`<div class="border-t pt-4" data-v-c262ad73><div class="bg-white border border-gray-300 rounded-md p-4 shadow-sm" data-v-c262ad73><div class="space-y-4" data-v-c262ad73>`);
          if (!isEditingTag.value) {
            _push(`<div data-v-c262ad73><label for="tag-key-select" class="block text-sm font-medium text-gray-700 mb-1" data-v-c262ad73> Tag Type </label><select id="tag-key-select" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" data-v-c262ad73><option value="" data-v-c262ad73${ssrIncludeBooleanAttr(Array.isArray(selectedTagKey.value) ? ssrLooseContain(selectedTagKey.value, "") : ssrLooseEqual(selectedTagKey.value, "")) ? " selected" : ""}>Select a tag type...</option><!--[-->`);
            ssrRenderList(categories.value, (category) => {
              _push(`<optgroup${ssrRenderAttr("label", category.label)} data-v-c262ad73><!--[-->`);
              ssrRenderList(unref(getTagsByCategory)(category.key).filter(
                (def) => !tags.value.hasOwnProperty(def.key)
              ), (tagDef) => {
                _push(`<option${ssrRenderAttr("value", tagDef.key)} data-v-c262ad73${ssrIncludeBooleanAttr(Array.isArray(selectedTagKey.value) ? ssrLooseContain(selectedTagKey.value, tagDef.key) : ssrLooseEqual(selectedTagKey.value, tagDef.key)) ? " selected" : ""}>${ssrInterpolate(tagDef.label)}</option>`);
              });
              _push(`<!--]--></optgroup>`);
            });
            _push(`<!--]--></select></div>`);
          } else {
            _push(`<div class="mb-2" data-v-c262ad73><span class="text-sm font-medium text-gray-700" data-v-c262ad73> Editing: ${ssrInterpolate(selectedTagDefinition.value?.label)}</span></div>`);
          }
          if (selectedTagDefinition.value) {
            _push(`<div data-v-c262ad73><label for="tag-value-input" class="block text-sm font-medium text-gray-700 mb-1" data-v-c262ad73>${ssrInterpolate(selectedTagDefinition.value.label)} `);
            if (selectedTagDefinition.value.required) {
              _push(`<span class="text-red-500" data-v-c262ad73>*</span>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</label>`);
            if (selectedTagDefinition.value.dataType === "enum") {
              _push(`<select id="tag-value-input" class="${ssrRenderClass([{ "border-red-300 bg-red-50": currentTagError.value }, "block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"])}" data-v-c262ad73><option value="" data-v-c262ad73${ssrIncludeBooleanAttr(Array.isArray(tagValue.value) ? ssrLooseContain(tagValue.value, "") : ssrLooseEqual(tagValue.value, "")) ? " selected" : ""}>Select...</option><!--[-->`);
              ssrRenderList(selectedTagDefinition.value.enumValues, (option) => {
                _push(`<option${ssrRenderAttr("value", option)} data-v-c262ad73${ssrIncludeBooleanAttr(Array.isArray(tagValue.value) ? ssrLooseContain(tagValue.value, option) : ssrLooseEqual(tagValue.value, option)) ? " selected" : ""}>${ssrInterpolate(option)}</option>`);
              });
              _push(`<!--]--></select>`);
            } else if (selectedTagDefinition.value.dataType === "yes_no") {
              _push(`<select id="tag-value-input" class="${ssrRenderClass([{ "border-red-300 bg-red-50": currentTagError.value }, "block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"])}" data-v-c262ad73><option value="" data-v-c262ad73${ssrIncludeBooleanAttr(Array.isArray(tagValue.value) ? ssrLooseContain(tagValue.value, "") : ssrLooseEqual(tagValue.value, "")) ? " selected" : ""}>Select...</option><option value="yes" data-v-c262ad73${ssrIncludeBooleanAttr(Array.isArray(tagValue.value) ? ssrLooseContain(tagValue.value, "yes") : ssrLooseEqual(tagValue.value, "yes")) ? " selected" : ""}>Yes</option><option value="no" data-v-c262ad73${ssrIncludeBooleanAttr(Array.isArray(tagValue.value) ? ssrLooseContain(tagValue.value, "no") : ssrLooseEqual(tagValue.value, "no")) ? " selected" : ""}>No</option></select>`);
            } else {
              _push(`<!---->`);
            }
            if (selectedTagDefinition.value.dataType === "number") {
              _push(`<input id="tag-value-input"${ssrRenderAttr("value", tagValue.value)} type="number" class="${ssrRenderClass([{ "border-red-300 bg-red-50": currentTagError.value }, "block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"])}" data-v-c262ad73>`);
            } else if (selectedTagDefinition.value.dataType === "url") {
              _push(`<input id="tag-value-input"${ssrRenderAttr("value", tagValue.value)} type="url" class="${ssrRenderClass([{ "border-red-300 bg-red-50": currentTagError.value }, "block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"])}" data-v-c262ad73>`);
            } else {
              _push(`<input id="tag-value-input"${ssrRenderAttr("value", tagValue.value)} type="text" class="${ssrRenderClass([{ "border-red-300 bg-red-50": currentTagError.value }, "block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"])}" data-v-c262ad73>`);
            }
            if (selectedTagDefinition.value.description) {
              _push(`<p class="mt-1 text-xs text-gray-500" data-v-c262ad73>${ssrInterpolate(selectedTagDefinition.value.description)} `);
              if (selectedTagDefinition.value.helpUrl) {
                _push(`<a${ssrRenderAttr("href", selectedTagDefinition.value.helpUrl)} target="_blank" class="text-blue-600 hover:text-blue-500" aria-label="Learn more (opens in new window)" data-v-c262ad73> Learn more <svg class="inline h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-c262ad73><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" data-v-c262ad73></path></svg></a>`);
              } else {
                _push(`<!---->`);
              }
              _push(`</p>`);
            } else {
              _push(`<!---->`);
            }
            if (currentTagError.value) {
              _push(`<p class="mt-1 text-xs text-red-600" role="alert" data-v-c262ad73>${ssrInterpolate(currentTagError.value)}</p>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<div class="flex justify-end flex-wrap gap-2 pt-2 border-t" data-v-c262ad73>`);
          if (isEditingTag.value) {
            _push(`<button class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors" data-v-c262ad73> Cancel Edit </button>`);
          } else {
            _push(`<!---->`);
          }
          if (selectedTagKey.value && !isEditingTag.value) {
            _push(`<button class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors" data-v-c262ad73> Reset </button>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<button${ssrIncludeBooleanAttr(!selectedTagKey.value || !hasNormalizedTagValue.value || !!currentTagError.value) ? " disabled" : ""} class="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" data-v-c262ad73>${ssrInterpolate(isEditingTag.value ? "Update Tag" : "Add Tag")}</button></div></div></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      }
      _push(`<div aria-live="polite" aria-atomic="true" class="sr-only" data-v-c262ad73>`);
      if (Object.keys(tags.value).length === 1) {
        _push(`<span data-v-c262ad73>1 tag added</span>`);
      } else if (Object.keys(tags.value).length > 1) {
        _push(`<span data-v-c262ad73>${ssrInterpolate(Object.keys(tags.value).length)} tags added</span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div>`);
    };
  }
});

const _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/TagEditor.vue");
  return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
const TagEditor = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-c262ad73"]]);

const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "AddToListDialog",
  __ssrInlineRender: true,
  props: {
    artworkId: {},
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue", "addedToList"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const { lists, fetchUserLists} = useUserLists();
    const loading = ref(false);
    const error = ref(null);
    const newListName = ref("");
    const selectedLists = ref(/* @__PURE__ */ new Set());
    const userLists = computed(() => {
      return lists.value.filter((list) => !list.is_system_list);
    });
    const isOpen = computed({
      get: () => props.modelValue,
      set: (value) => emit("update:modelValue", value)
    });
    watch(isOpen, (val) => {
      if (val) {
        fetchUserLists();
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      if (isOpen.value) {
        _push(`<div${ssrRenderAttrs(mergeProps({ class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" }, _attrs))}><div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-hidden" role="dialog" aria-labelledby="dialog-title" aria-modal="true"><div class="px-6 py-4 border-b border-gray-200"><h3 id="dialog-title" class="text-lg font-medium text-gray-900"> Add to List </h3><button class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full p-1" aria-label="Close dialog"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div><div class="px-6 py-4 max-h-64 overflow-y-auto">`);
        if (loading.value) {
          _push(`<div class="flex items-center justify-center py-8"><svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="ml-2 text-gray-600">Loading lists...</span></div>`);
        } else if (error.value) {
          _push(`<div class="p-4 bg-red-50 border border-red-200 rounded-lg"><p class="text-sm text-red-700">${ssrInterpolate(error.value)}</p></div>`);
        } else {
          _push(`<div class="space-y-3">`);
          if (userLists.value.length > 0) {
            _push(`<div><h4 class="text-sm font-medium text-gray-900 mb-2">Your Lists</h4><div class="space-y-2"><!--[-->`);
            ssrRenderList(userLists.value, (list) => {
              _push(`<label class="${ssrRenderClass([{ "opacity-50": (list.item_count ?? 0) >= 1e3 }, "flex items-center p-2 rounded-lg hover:bg-gray-50 cursor-pointer"])}"><input type="checkbox"${ssrIncludeBooleanAttr(selectedLists.value.has(list.id)) ? " checked" : ""}${ssrIncludeBooleanAttr((list.item_count ?? 0) >= 1e3) ? " disabled" : ""} class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"><div class="ml-3 flex-1"><div class="flex items-center justify-between"><span class="text-sm font-medium text-gray-900">${ssrInterpolate(list.name)} `);
              if ((list.item_count ?? 0) >= 1e3) {
                _push(`<span class="text-xs text-gray-500">(full)</span>`);
              } else {
                _push(`<!---->`);
              }
              _push(`</span><span class="text-xs text-gray-500">${ssrInterpolate(list.item_count ?? 0)} items</span></div></div></label>`);
            });
            _push(`<!--]--></div></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<div class="border-t border-gray-200 pt-3"><h4 class="text-sm font-medium text-gray-900 mb-2">Create New List</h4><input${ssrRenderAttr("value", newListName.value)} type="text" placeholder="Enter list name..." maxlength="255" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"><p class="text-xs text-gray-500 mt-1">${ssrInterpolate(newListName.value.length)}/255 characters</p></div>`);
          if (userLists.value.length === 0 && !newListName.value.trim()) {
            _push(`<div class="text-center py-6"><p class="text-sm text-gray-500">You don&#39;t have any lists yet.</p><p class="text-xs text-gray-400 mt-1">Create your first list by entering a name above.</p></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
        }
        _push(`</div><div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3"><button class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"> Cancel </button><button${ssrIncludeBooleanAttr(loading.value || selectedLists.value.size === 0 && !newListName.value.trim()) ? " disabled" : ""} class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">${ssrInterpolate(loading.value ? "Adding..." : "Done")}</button></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
    };
  }
});

const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/AddToListDialog.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};

const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "MChip",
  __ssrInlineRender: true,
  props: {
    icon: {},
    label: {},
    active: { type: Boolean },
    loading: { type: Boolean },
    disabled: { type: Boolean },
    count: {},
    variant: { default: "outlined" },
    size: { default: "md" },
    ariaLabel: {},
    showLabel: { type: Boolean, default: false },
    showSuccessAnimation: { type: Boolean, default: false }
  },
  emits: ["click"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const chipClasses = computed(() => {
      const base = "inline-flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";
      const sizeClasses = {
        sm: "h-8 px-2 text-xs",
        md: "h-10 px-3 text-sm",
        lg: "h-12 px-4 text-base"
      };
      let variantClasses = "";
      if (props.variant === "filled" && props.active) {
        variantClasses = "bg-red-500 text-white hover:bg-red-600";
      } else if (props.variant === "filled") {
        variantClasses = "bg-gray-100 text-gray-700 hover:bg-gray-200";
      } else {
        variantClasses = props.active ? "border-2 border-red-500 bg-red-50 text-red-700 hover:bg-red-100" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400";
      }
      if (props.disabled || props.loading) {
        variantClasses = "border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed";
      }
      return [base, sizeClasses[props.size], variantClasses].join(" ");
    });
    const iconClasses = computed(() => {
      const base = "transition-transform duration-200";
      const sizeClasses = {
        sm: "w-4 h-4",
        md: "w-5 h-5",
        lg: "w-6 h-6"
      };
      const animationClass = !props.disabled && !props.loading ? "group-hover:animate-pulse group-focus:animate-pulse" : "";
      const successClass = props.showSuccessAnimation ? "animate-bounce" : "";
      return [base, sizeClasses[props.size], animationClass, successClass].join(" ");
    });
    const shouldShowLabel = computed(() => {
      return props.showLabel && props.label && !props.loading;
    });
    const effectiveAriaLabel = computed(() => {
      if (props.ariaLabel) return props.ariaLabel;
      let label2 = props.label || "Action";
      if (props.count !== void 0) {
        label2 += ` (${props.count})`;
      }
      if (props.active) {
        label2 += " - Active";
      }
      if (props.loading) {
        label2 += " - Loading";
      }
      return label2;
    });
    const isDisabled = computed(() => {
      return props.disabled || props.loading;
    });
    const ariaPressed = computed(() => {
      return props.active ? "true" : "false";
    });
    const icon = computed(() => props.icon);
    const active = computed(() => !!props.active);
    const loading = computed(() => !!props.loading);
    const label = computed(() => props.label);
    const count = computed(() => props.count);
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<button${ssrRenderAttrs(mergeProps({
        type: "button",
        class: [chipClasses.value, "group"],
        disabled: isDisabled.value,
        "aria-label": effectiveAriaLabel.value,
        "aria-pressed": ariaPressed.value
      }, _ctx.$attrs, _attrs))} data-v-283efe12>`);
      if (loading.value) {
        _push(`<svg class="${ssrRenderClass([iconClasses.value, "animate-spin"])}" fill="none" viewBox="0 0 24 24" data-v-283efe12><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" data-v-283efe12></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" class="opacity-75" data-v-283efe12></path></svg>`);
      } else if (icon.value === "heart") {
        _push(`<svg class="${ssrRenderClass(iconClasses.value)}" fill="currentColor" viewBox="0 0 24 24" data-v-283efe12>`);
        if (active.value) {
          _push(`<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" data-v-283efe12></path>`);
        } else {
          _push(`<path d="M12.1 18.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05zM16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.31C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z" data-v-283efe12></path>`);
        }
        _push(`</svg>`);
      } else if (icon.value === "flag") {
        _push(`<svg class="${ssrRenderClass(iconClasses.value)}" fill="currentColor" viewBox="0 0 24 24" data-v-283efe12>`);
        if (active.value) {
          _push(`<path d="M5 21V4h9l.4 2h5.6v7h-5.6l-.4-2H7v10H5z" data-v-283efe12></path>`);
        } else {
          _push(`<path d="M5 21V4h9l.4 2h5.6v7h-5.6l-.4-2H7v10H5zm2-12h7.6l.4 2h3V8h-3l-.4-2H7v3z" data-v-283efe12></path>`);
        }
        _push(`</svg>`);
      } else if (icon.value === "star") {
        _push(`<svg class="${ssrRenderClass(iconClasses.value)}" fill="currentColor" viewBox="0 0 24 24" data-v-283efe12>`);
        if (active.value) {
          _push(`<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" data-v-283efe12></path>`);
        } else {
          _push(`<path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28z" data-v-283efe12></path>`);
        }
        _push(`</svg>`);
      } else if (icon.value === "bookmark") {
        _push(`<svg class="${ssrRenderClass(iconClasses.value)}" fill="currentColor" viewBox="0 0 24 24" data-v-283efe12>`);
        if (active.value) {
          _push(`<path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" data-v-283efe12></path>`);
        } else {
          _push(`<path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" data-v-283efe12></path>`);
        }
        _push(`</svg>`);
      } else if (icon.value === "document-add") {
        _push(`<svg class="${ssrRenderClass(iconClasses.value)}" fill="currentColor" viewBox="0 0 24 24" data-v-283efe12><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z" data-v-283efe12></path><path d="M11 14h2v2h2v2h-2v2h-2v-2H9v-2h2v-2z" data-v-283efe12></path></svg>`);
      } else if (icon.value === "share") {
        _push(`<svg class="${ssrRenderClass(iconClasses.value)}" fill="currentColor" viewBox="0 0 24 24" data-v-283efe12><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" data-v-283efe12></path></svg>`);
      } else if (icon.value === "pencil") {
        _push(`<svg class="${ssrRenderClass(iconClasses.value)}" fill="currentColor" viewBox="0 0 24 24" data-v-283efe12><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" data-v-283efe12></path></svg>`);
      } else if (icon.value === "bug") {
        _push(`<svg class="${ssrRenderClass(iconClasses.value)}" fill="currentColor" viewBox="0 0 24 24" data-v-283efe12><path d="M19 8h-1.26A7.97 7.97 0 0013 6.11V4h1a1 1 0 100-2h-4a1 1 0 100 2h1v2.11A7.97 7.97 0 006.26 8H5a1 1 0 100 2h.22A6.002 6.002 0 0011 16v3H9a1 1 0 100 2h6a1 1 0 100-2h-2v-3a6.002 6.002 0 005.78-6H19a1 1 0 100-2zM12 14a4 4 0 110-8 4 4 0 010 8z" data-v-283efe12></path></svg>`);
      } else {
        _push(`<svg class="${ssrRenderClass(iconClasses.value)}" fill="currentColor" viewBox="0 0 24 24" data-v-283efe12><circle cx="12" cy="12" r="2" data-v-283efe12></circle></svg>`);
      }
      if (shouldShowLabel.value) {
        _push(`<span class="ml-2 font-medium" data-v-283efe12>${ssrInterpolate(label.value)}</span>`);
      } else {
        _push(`<!---->`);
      }
      if (count.value !== void 0 && count.value > 0) {
        _push(`<span class="ml-1 px-1.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-800 rounded-full" data-v-283efe12>${ssrInterpolate(count.value > 999 ? "999+" : count.value)}</span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</button>`);
    };
  }
});

const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/MChip.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const MChip = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-283efe12"]]);

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "ArtworkActionBar",
  __ssrInlineRender: true,
  props: {
    artworkId: {},
    userId: {},
    permissions: {},
    initialListStates: {}
  },
  emits: ["authRequired", "editArtwork", "addLog", "shareArtwork", "reportMissing", "reportIssue"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    if (!props.permissions) props.permissions = { canEdit: false };
    const emit = __emit;
    const authStore = useAuthStore();
    const { announceError, announceSuccess } = useAnnouncer();
    const log = createLogger({ module: "frontend:ArtworkActionBar" });
    const listStates = ref({
      loved: false,
      visited: false,
      starred: false,
      inAnyList: false
    });
    const loadingStates = ref({
      loved: false,
      visited: false,
      starred: false,
      bookmark: false,
      share: false
    });
    const publicCounts = ref({
      loved: 0,
      visited: 0,
      starred: 0
    });
    const successAnimations = ref({
      loved: false,
      visited: false,
      starred: false
    });
    const initialLoading = ref(true);
    const showAddToListDialog = ref(false);
    const pendingRequests = ref(/* @__PURE__ */ new Set());
    const isAuthenticated = computed(() => authStore.isAuthenticated);
    const chipData = computed(() => [
      {
        id: "loved",
        icon: "heart",
        label: "Loved",
        active: listStates.value.loved,
        loading: loadingStates.value.loved,
        ...publicCounts.value.loved > 0 && { count: publicCounts.value.loved },
        showSuccessAnimation: successAnimations.value.loved,
        ariaLabel: listStates.value.loved ? "Remove from Loved list - currently in list" : "Add to Loved list - not in list",
        action: () => toggleListMembership("loved")
      },
      {
        id: "visited",
        icon: "flag",
        label: "Visited",
        active: listStates.value.visited,
        loading: loadingStates.value.visited,
        ...publicCounts.value.visited > 0 && { count: publicCounts.value.visited },
        showSuccessAnimation: successAnimations.value.visited,
        ariaLabel: listStates.value.visited ? "Remove from Visited list - currently in list" : "Add to Visited list - not in list",
        action: () => toggleListMembership("visited")
      },
      {
        id: "starred",
        icon: "star",
        label: "Starred",
        active: listStates.value.starred,
        loading: loadingStates.value.starred,
        ...publicCounts.value.starred > 0 && { count: publicCounts.value.starred },
        showSuccessAnimation: successAnimations.value.starred,
        ariaLabel: listStates.value.starred ? "Remove from Starred list - currently in list" : "Add to Starred list - not in list",
        action: () => toggleListMembership("starred")
      },
      {
        id: "bookmark",
        icon: "bookmark",
        label: "Add to List",
        active: listStates.value.inAnyList,
        loading: loadingStates.value.bookmark,
        ariaLabel: "Manage lists - open list selection modal",
        action: () => openAddToListDialog()
      },
      {
        id: "addLog",
        icon: "document-add",
        label: "Add Log",
        active: false,
        loading: false,
        ariaLabel: "Add a log entry for this artwork",
        action: () => handleAddLog()
      },
      {
        id: "share",
        icon: "share",
        label: "Share",
        active: false,
        loading: loadingStates.value.share,
        ariaLabel: "Share this artwork",
        action: () => handleShare()
      },
      {
        id: "reportMissing",
        icon: "flag",
        label: "Report Missing",
        active: false,
        loading: false,
        ariaLabel: "Report missing artwork",
        action: () => emit("reportMissing")
      },
      {
        id: "reportIssue",
        icon: "bug",
        label: "Report Issue",
        active: false,
        loading: false,
        ariaLabel: "Report an issue with this artwork",
        action: () => emit("reportIssue")
      }
    ]);
    onMounted(async () => {
      if (props.initialListStates) {
        if ("loved" in props.initialListStates)
          listStates.value.loved = !!props.initialListStates.loved;
        if ("visited" in props.initialListStates)
          listStates.value.visited = !!props.initialListStates.visited;
        if ("starred" in props.initialListStates)
          listStates.value.starred = !!props.initialListStates.starred;
        if ("inAnyList" in props.initialListStates)
          listStates.value.inAnyList = !!props.initialListStates.inAnyList;
        initialLoading.value = false;
      }
      try {
        await fetchPublicCounts();
      } catch (error) {
        log.error("Failed to fetch public counts", { error });
      }
      if (!props.initialListStates && isAuthenticated.value) {
        try {
          await fetchMembershipStates();
        } catch (error) {
          log.error("Failed to fetch membership states", { error });
          initialLoading.value = false;
        }
      } else if (!props.initialListStates) {
        initialLoading.value = false;
      }
    });
    watch(() => authStore.isAuthenticated, async (newAuth) => {
      if (newAuth && !props.initialListStates) {
        await fetchMembershipStates();
      }
    });
    async function fetchMembershipStates() {
      if (!props.userId && !isAuthenticated.value) {
        initialLoading.value = false;
        return;
      }
      try {
        initialLoading.value = true;
        const response = await apiService.get(`/artwork/${props.artworkId}/membership`);
        if (response.success && response.data) {
          log.debug("[ArtworkActionBar] fetchMembershipStates response", { data: response.data });
          listStates.value.loved = response.data.loved || false;
          listStates.value.visited = response.data.visited || false;
          listStates.value.starred = response.data.starred || false;
          listStates.value.inAnyList = response.data.inAnyList || false;
          log.debug("[ArtworkActionBar] After fetchMembershipStates: listStates", {
            listStates: JSON.parse(JSON.stringify(listStates.value))
          });
        }
      } catch (error) {
        log.error("Failed to fetch membership states", { error });
      } finally {
        initialLoading.value = false;
      }
    }
    async function fetchPublicCounts() {
      try {
        const response = await apiService.get(`/artwork/${props.artworkId}/counts`);
        if (response.success && response.data) {
          publicCounts.value = {
            loved: response.data.loved || 0,
            visited: response.data.visited || 0,
            starred: response.data.starred || 0
          };
        }
      } catch (error) {
        log.error("Failed to fetch public counts", { error });
      }
    }
    async function toggleListMembership(listType) {
      if (!isAuthenticated.value) {
        emit("authRequired");
        return;
      }
      const requestKey = `toggle-${listType}`;
      if (pendingRequests.value.has(requestKey)) {
        return;
      }
      pendingRequests.value.add(requestKey);
      loadingStates.value[listType] = true;
      const originalState = listStates.value[listType];
      log.debug(`[ArtworkActionBar] Before optimistic update: listStates.${listType}`, { originalState });
      listStates.value[listType] = !originalState;
      log.debug(`[ArtworkActionBar] After optimistic update: listStates.${listType}`, {
        newState: listStates.value[listType]
      });
      try {
        const action = originalState ? "remove" : "add";
        const response = await apiService.post(`/artwork/${props.artworkId}/lists/${listType}`, {
          action
        });
        if (!response.success) {
          throw new Error(response.message || `Failed to ${action} artwork ${listType} list`);
        }
        await fetchMembershipStates();
        announceSuccess(
          originalState ? `Removed from ${getListDisplayName(listType)} list` : `Added to ${getListDisplayName(listType)} list`
        );
        triggerSuccessAnimation(listType);
        await fetchPublicCounts();
        if (isAuthenticated.value) {
          await fetchMembershipStates();
        }
      } catch (error) {
        log.error(`Failed to toggle ${listType}`, { error });
        listStates.value[listType] = originalState;
        announceError("Couldn't update list. Please try again.");
      } finally {
        loadingStates.value[listType] = false;
        pendingRequests.value.delete(requestKey);
      }
    }
    function getListDisplayName(listType) {
      const names = {
        loved: "Loved",
        visited: "Visited",
        starred: "Starred"
      };
      return names[listType] || listType;
    }
    function triggerSuccessAnimation(listType) {
      successAnimations.value[listType] = true;
      setTimeout(() => {
        successAnimations.value[listType] = false;
      }, 500);
    }
    function openAddToListDialog() {
      if (!isAuthenticated.value) {
        emit("authRequired");
        return;
      }
      showAddToListDialog.value = true;
    }
    async function handleAddedToList() {
      await fetchMembershipStates();
      showAddToListDialog.value = false;
      announceSuccess("Updated artwork lists");
    }
    function handleAddLog() {
      if (!isAuthenticated.value) {
        emit("authRequired");
        return;
      }
      emit("addLog");
    }
    async function handleShare() {
      loadingStates.value.share = true;
      try {
        const shareData = {
          title: `Artwork - Cultural Archiver`,
          text: "Check out this artwork on Cultural Archiver",
          url: window.location.href
        };
        if (navigator.share) {
          await navigator.share(shareData);
          announceSuccess("Shared successfully");
        } else {
          await navigator.clipboard.writeText(window.location.href);
          announceSuccess("Link copied to clipboard");
        }
        emit("shareArtwork");
      } catch (error) {
        log.error("Failed to share", { error });
        try {
          await navigator.clipboard.writeText(window.location.href);
          announceSuccess("Link copied to clipboard");
        } catch (clipboardError) {
          log.error("Failed to copy to clipboard", { error: clipboardError });
          announceError("Failed to share. Please copy the URL manually.");
        }
      } finally {
        loadingStates.value.share = false;
      }
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: "artwork-action-bar",
        "data-testid": "artwork-action-bar"
      }, _attrs))} data-v-0ae48189><hr class="border-t border-gray-200 my-4" data-v-0ae48189><div class="flex flex-wrap justify-center gap-2 sm:gap-3 px-4 py-2" role="toolbar" aria-label="Artwork actions" data-v-0ae48189><!--[-->`);
      ssrRenderList(chipData.value, (chip) => {
        _push(ssrRenderComponent(MChip, mergeProps({
          key: chip.id,
          icon: chip.icon,
          label: chip.label,
          active: chip.active,
          loading: initialLoading.value || chip.loading,
          "show-success-animation": "showSuccessAnimation" in chip ? chip.showSuccessAnimation : false,
          "aria-label": chip.ariaLabel,
          "show-label": true,
          variant: "outlined",
          size: "md",
          "data-testid": `chip-${chip.id}`
        }, { ref_for: true }, "count" in chip && chip.count > 0 ? { count: chip.count } : {}, {
          onClick: chip.action,
          class: "min-w-0"
        }), null, _parent));
      });
      _push(`<!--]--></div><hr class="border-t border-gray-200 my-4" data-v-0ae48189>`);
      if (showAddToListDialog.value && isAuthenticated.value) {
        _push(ssrRenderComponent(_sfc_main$3, {
          "model-value": showAddToListDialog.value,
          "artwork-id": _ctx.artworkId,
          "data-testid": "add-to-list-dialog",
          "onUpdate:modelValue": ($event) => showAddToListDialog.value = $event,
          onAddedToList: handleAddedToList
        }, null, _parent));
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="sr-only" aria-live="polite" aria-atomic="true" data-v-0ae48189>`);
      if (initialLoading.value) {
        _push(`<span data-v-0ae48189>Loading artwork actions...</span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div>`);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ArtworkActionBar.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const ArtworkActionBar = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-0ae48189"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ArtworkDetailView",
  __ssrInlineRender: true,
  props: {
    id: {}
  },
  setup(__props) {
    const props = __props;
    const artworksStore = useArtworksStore();
    const authStore = useAuthStore();
    const router = useRouter();
    const route = useRoute();
    const { announceError, announceSuccess } = useAnnouncer();
    const { success: toastSuccess } = useToasts();
    const showAddToListDialog = ref(false);
    const showFeedbackDialog = ref(false);
    const feedbackMode = ref("comment");
    const showAuthModal = ref(false);
    const loading = ref(true);
    const error = ref(null);
    const originatingSubmissionId = ref(null);
    const currentPhotoIndex = ref(0);
    const showFullscreenPhoto = ref(false);
    const fullscreenPhotoUrl = ref("");
    const isEditMode = ref(false);
    const editLoading = ref(false);
    const editError = ref(null);
    const showCancelDialog = ref(false);
    const showSuccessModal = ref(false);
    const hasPendingEdits = ref(false);
    const pendingFields = ref([]);
    const editData = ref({
      title: "",
      description: "",
      creators: "",
      // artists: array of { id, name }
      artists: [],
      tags: { keywords: "" }
      // Structured tags instead of string array
    });
    const artwork = computed(() => {
      return artworksStore.artworkById(props.id);
    });
    const artworkTitle = computed(() => {
      if (!artwork.value) return "Unknown Artwork";
      if (artwork.value.title && artwork.value.title.trim()) {
        return artwork.value.title.trim();
      }
      const title = artwork.value.tags_parsed?.title;
      return title || "Unknown Artwork Title";
    });
    const artworkDescription = computed(() => {
      if (!artwork.value) return null;
      if (artwork.value.description && artwork.value.description.trim()) {
        return artwork.value.description.trim();
      }
      const tagDescription = artwork.value.tags_parsed?.description;
      if (tagDescription && tagDescription.trim()) return tagDescription.trim();
      const firstEntry = artwork.value.logbook_entries?.[0];
      const noteDescription = firstEntry?.notes;
      if (noteDescription && noteDescription.trim()) return noteDescription.trim();
      return null;
    });
    const artworkCreators = computed(() => {
      if (!artwork.value) return "Unknown";
      if (artwork.value.artist_name && artwork.value.artist_name.trim()) {
        return artwork.value.artist_name.trim();
      }
      if (artwork.value?.tags_parsed?.artist) {
        return artwork.value.tags_parsed.artist;
      }
      if (artwork.value?.tags_parsed?.creator) {
        return artwork.value.tags_parsed.creator;
      }
      if (artwork.value?.tags_parsed?.artist_ids) {
        return `Artist ID: ${artwork.value.tags_parsed.artist_ids}`;
      }
      if (artwork.value.created_by && artwork.value.created_by.trim()) {
        const createdBy = artwork.value.created_by.trim();
        if (!createdBy.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          return createdBy;
        }
      }
      return "Unknown";
    });
    const artworkArtists = computed(() => {
      return artwork.value?.artists || [];
    });
    const hasArtistLinks = computed(() => {
      return artworkArtists.value.length > 0;
    });
    function handleChildMapReady(mapInstance) {
      try {
        console.debug("[ArtworkDetailView] child mapReady received", { mapInstance });
        if (!mapInstance) return;
        if (typeof mapInstance.invalidateSize === "function") {
          mapInstance.invalidateSize();
          requestAnimationFrame(() => mapInstance.invalidateSize());
          setTimeout(() => mapInstance.invalidateSize(), 150);
          setTimeout(() => mapInstance.invalidateSize(), 500);
        }
      } catch (err) {
      }
    }
    const artworkTags = computed(() => {
      if (!artwork.value?.tags_parsed) return {};
      const filteredTags = { ...artwork.value.tags_parsed };
      delete filteredTags.title;
      delete filteredTags.description;
      delete filteredTags.artist;
      delete filteredTags.creator;
      Object.keys(filteredTags).forEach((k) => {
        if (k.startsWith("_")) {
          delete filteredTags[k];
        }
      });
      const structuredTags = {};
      Object.entries(filteredTags).forEach(([key, value]) => {
        if (value != null) {
          structuredTags[key] = String(value);
        }
      });
      return structuredTags;
    });
    const keywordList = computed(() => {
      const kwRaw = artworkTags.value.keywords || artwork.value?.tags_parsed?.keywords;
      if (!kwRaw) return [];
      return kwRaw.split(",").map((k) => k.trim()).filter((k) => k.length > 0).slice(0, 100);
    });
    const displayTags = computed(() => {
      const clone = { ...artworkTags.value };
      delete clone.keywords;
      Object.keys(clone).forEach((k) => {
        if (k.startsWith("_")) delete clone[k];
      });
      const referenceTagsToHide = [
        "primarymaterial",
        // Show 'material' instead
        "yearofinstallation",
        // Show 'start_date' instead  
        "vancouver_status",
        // Show 'status' instead
        "type"
        // Show 'artwork_type' instead
      ];
      referenceTagsToHide.forEach((tag) => {
        delete clone[tag];
      });
      return clone;
    });
    const keywordsField = computed({
      get() {
        const kw = editData.value.tags.keywords;
        return typeof kw === "string" ? kw : "";
      },
      set(val) {
        editData.value.tags.keywords = val;
      }
    });
    const tagEditorRef = ref(null);
    const artworkPhotos = computed(() => {
      if (!artwork.value?.photos) return [];
      const urls = (artwork.value.photos || []).map((p) => {
        if (!p) return "";
        if (typeof p === "string") return p;
        return p.url || p.thumbnail_url || "";
      });
      return Array.from(new Set(urls)).filter((u) => !!u && u.length > 0);
    });
    const displayTitle = computed(() => {
      return isEditMode.value ? editData.value.title : artworkTitle.value;
    });
    const displayDescription = computed(() => {
      return isEditMode.value ? editData.value.description : artworkDescription.value;
    });
    const renderedDescription = computed(() => {
      const raw = displayDescription.value || "";
      if (!raw) return "";
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      const html = marked.parse(raw);
      return sanitizeMarkdownHtml(html);
    });
    function sanitizeMarkdownHtml(input) {
      return input.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/ on[a-zA-Z]+="[^"]*"/g, "").replace(/ on[a-zA-Z]+='[^']*'/g, "").replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"').replace(/href\s*=\s*'javascript:[^']*'/gi, "href='#'");
    }
    const routeMetaBase = getMetaForRoute("artwork");
    function buildArtworkMeta() {
      const title = artworkTitle.value || routeMetaBase.title;
      const description = artworkDescription.value && artworkDescription.value.slice(0, 160) || routeMetaBase.description;
      const canonical = typeof window !== "undefined" && window.location ? `${window.location.origin}${route.fullPath}` : route.fullPath;
      const image = artworkPhotos.value[0] || "";
      const metadata = {
        title,
        description,
        canonical,
        ogImage: image,
        ogType: "article"
      };
      const jsonld = createArtworkSchema({
        id: artwork.value?.id || "",
        title,
        images: image ? [image] : [],
        lat: artwork.value?.lat || 0,
        lon: artwork.value?.lon || 0,
        tags: Object.keys(artworkTags.value || {}),
        description: description || ""
      });
      return { metadata, jsonld };
    }
    watch(
      () => artwork.value && artwork.value.id,
      (newId) => {
        if (newId) {
          const { metadata, jsonld } = buildArtworkMeta();
          useRouteMeta(metadata, jsonld);
        }
      },
      { immediate: true }
    );
    const displayCreators = computed(() => {
      return isEditMode.value ? editData.value.creators : artworkCreators.value;
    });
    const displayCreatorsList = computed(() => {
      const creators = displayCreators.value;
      if (creators === "Unknown" || !creators) return [];
      return creators.split(",").map((name) => name.trim()).filter((name) => {
        if (!name || name === "Unknown") return false;
        if (name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
          return false;
        if (name.startsWith("Artist ID:")) return false;
        return true;
      });
    });
    const hasDisplayableCreators = computed(() => {
      return displayCreatorsList.value.length > 0;
    });
    computed(() => {
      if (!artwork.value) return false;
      return editData.value.title !== artworkTitle.value || editData.value.description !== (artworkDescription.value || "") || editData.value.creators !== artworkCreators.value || JSON.stringify(editData.value.tags) !== JSON.stringify(artworkTags.value);
    });
    onMounted(async () => {
      try {
        loading.value = true;
        error.value = null;
        if (!props.id || props.id.trim() === "") {
          error.value = "Invalid artwork ID provided.";
          announceError("Invalid artwork ID");
          return;
        }
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const sampleDataPattern = /^SAMPLE-artwork-.+$/i;
        if (!uuidPattern.test(props.id) && !sampleDataPattern.test(props.id)) {
          error.value = "Invalid artwork ID format. Please check the URL and try again.";
          announceError("Invalid artwork ID format");
          return;
        }
        const artworkData = await artworksStore.refreshArtwork(props.id);
        if (!artworkData) {
          error.value = `Artwork with ID "${props.id}" was not found. It may have been removed or is pending approval.`;
          announceError("Artwork not found");
          if (authStore?.canReview) {
            try {
              const reviewModule = await import('../ssr-entry-server.js').then(n => n.t);
              const queueResp = await reviewModule.apiService.getReviewQueue(
                "pending",
                void 0,
                1,
                25
              );
              const submissionsList = queueResp.submissions || queueResp?.data?.submissions || [];
              const match = submissionsList.find((s) => s.artwork_id && s.artwork_id === props.id);
              if (match) {
                originatingSubmissionId.value = match.id;
              }
            } catch (e) {
              console.warn("[ArtworkDetailView] Failed to resolve originating submission ID:", e);
            }
          }
          return;
        }
        announceSuccess(`Loaded artwork details: ${artworkTitle.value}`);
        if (authStore.isAuthenticated) {
          await checkPendingEdits();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load artwork";
        if (message.includes("404") || message.includes("not found")) {
          error.value = `Artwork with ID "${props.id}" was not found. It may have been removed or is pending approval.`;
          if (authStore?.canReview) {
            try {
              const reviewModule = await import('../ssr-entry-server.js').then(n => n.t);
              const queueResp = await reviewModule.apiService.getReviewQueue(
                "pending",
                void 0,
                1,
                25
              );
              const submissionsList = queueResp.submissions || queueResp?.data?.submissions || [];
              const match = submissionsList.find((s) => s.artwork_id && s.artwork_id === props.id);
              if (match) {
                originatingSubmissionId.value = match.id;
              }
            } catch (e) {
              console.warn("[ArtworkDetailView] Fallback submission lookup failed:", e);
            }
          }
        } else if (message.includes("network") || message.includes("fetch")) {
          error.value = "Unable to load artwork details. Please check your internet connection and try again.";
        } else {
          error.value = message;
        }
        announceError("Failed to load artwork details");
      } finally {
        loading.value = false;
        if (route.query.submitted === "true") {
          toastSuccess("Logbook entry submitted for review!");
          router.replace({ path: route.path });
        }
      }
    });
    function handlePhotoFullscreen(photoUrl) {
      fullscreenPhotoUrl.value = photoUrl;
      showFullscreenPhoto.value = true;
    }
    function handleTagClick(tag) {
      if (isEditMode.value) {
        announceSuccess(`Ready to edit tag ${tag.key || tag.label}`);
        return;
      }
      if (tag.key && tag.value) {
        router.push(`/search/tag:${encodeURIComponent(tag.key)}:${encodeURIComponent(tag.value)}`);
      }
    }
    function handleAddedToList(listNames) {
      toastSuccess(`Added to list: ${listNames}`);
    }
    function enterEditMode() {
      if (!artwork.value || hasPendingEdits.value) return;
      editData.value = {
        title: artworkTitle.value,
        description: artworkDescription.value || "",
        creators: artworkCreators.value,
        artists: (artworkArtists.value || []).map((a) => ({ id: String(a.id), name: String(a.name) })),
        tags: { keywords: "", ...artworkTags.value }
        // Copy structured tags, ensure keywords key exists
      };
      isEditMode.value = true;
      editError.value = null;
      announceSuccess("Entering edit mode");
    }
    async function checkPendingEdits() {
      if (!artwork.value || !authStore.isAuthenticated) return;
      try {
        const response = await apiService.getPendingEdits(artwork.value.id);
        if (response.success && response.data) {
          hasPendingEdits.value = response.data.has_pending_edits;
          pendingFields.value = response.data.pending_fields || [];
        }
      } catch (err) {
        console.log("Failed to check pending edits:", err);
      }
    }
    function handleActionBarAuthRequired() {
      showAuthModal.value = true;
    }
    function handleActionBarEditArtwork() {
      enterEditMode();
    }
    function handleActionBarAddLog() {
      if (!authStore.isAuthenticated) {
        handleActionBarAuthRequired();
        return;
      }
      router.push(`/logbook/${props.id}`);
    }
    function handleActionBarShare() {
      announceSuccess("Artwork shared");
    }
    function handleReportMissing() {
      feedbackMode.value = "missing";
      showFeedbackDialog.value = true;
    }
    function handleReportIssue() {
      feedbackMode.value = "comment";
      showFeedbackDialog.value = true;
    }
    function handleFeedbackSuccess() {
      showFeedbackDialog.value = false;
      announceSuccess("Thank you for your feedback! Moderators will review it shortly.");
      toastSuccess("Feedback submitted successfully");
    }
    function handleFeedbackCancel() {
      showFeedbackDialog.value = false;
    }
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      _push(`<!--[--><div class="artwork-detail-view theme-background" data-v-ae3fed3e>`);
      if (loading.value) {
        _push(`<div class="flex items-center justify-center py-20" data-v-ae3fed3e><div class="text-center" data-v-ae3fed3e><svg class="animate-spin h-12 w-12 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style="${ssrRenderStyle({ color: "rgb(var(--md-primary))" })}" data-v-ae3fed3e><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-ae3fed3e></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-ae3fed3e></path></svg><p style="${ssrRenderStyle({ color: "rgba(var(--md-on-background),0.9)" })}" data-v-ae3fed3e>Loading artwork details...</p></div></div>`);
      } else if (error.value) {
        _push(`<div class="flex items-center justify-center py-20" data-v-ae3fed3e><div class="text-center max-w-md mx-auto px-4" data-v-ae3fed3e><svg class="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="${ssrRenderStyle({ color: "rgb(var(--md-error))" })}" data-v-ae3fed3e><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" data-v-ae3fed3e></path></svg><h1 class="text-2xl font-bold mb-2" style="${ssrRenderStyle({ color: "rgb(var(--md-on-background))" })}" data-v-ae3fed3e>`);
        if (unref(authStore)?.canReview && error.value?.includes("pending approval")) {
          _push(`<!--[--> Artwork Pending Approval <!--]-->`);
        } else {
          _push(`<!--[--> Artwork Not Found <!--]-->`);
        }
        _push(`</h1><p class="mb-6" style="${ssrRenderStyle({ color: "rgba(var(--md-on-background),0.85)" })}" data-v-ae3fed3e>${ssrInterpolate(error.value)}</p>`);
        if (unref(authStore)?.canReview && originatingSubmissionId.value) {
          _push(`<div class="mb-4 text-sm text-gray-700" data-v-ae3fed3e><p class="mb-1" data-v-ae3fed3e>Originating submission ID:</p><code class="px-2 py-1 rounded text-xs" style="${ssrRenderStyle({ background: "rgba(var(--md-surface),0.06)", color: "rgb(var(--md-on-surface))" })}" data-v-ae3fed3e>${ssrInterpolate(originatingSubmissionId.value)}</code></div>`);
        } else {
          _push(`<!---->`);
        }
        if (unref(authStore)?.canReview && props.id && error.value?.includes("pending approval")) {
          _push(`<div class="mb-6" data-v-ae3fed3e><p class="text-sm text-gray-700 mb-2" data-v-ae3fed3e> If this artwork was just submitted it may still be pending. You can review it now: </p>`);
          _push(ssrRenderComponent(_component_router_link, {
            to: { path: "/review", query: { searchId: originatingSubmissionId.value || props.id } },
            class: "inline-block px-3 py-2 text-sm rounded",
            style: { background: "rgba(var(--md-warning),0.08)", color: "rgb(var(--md-on-warning))" }
          }, {
            default: withCtx((_, _push2, _parent2, _scopeId) => {
              if (_push2) {
                if (originatingSubmissionId.value) {
                  _push2(`<!--[-->Open Review Queue (submission ${ssrInterpolate(originatingSubmissionId.value.substring(0, 8))}…)<!--]-->`);
                } else {
                  _push2(`<!--[-->Open Review Queue for ${ssrInterpolate(props.id.substring(0, 8))}…<!--]-->`);
                }
              } else {
                return [
                  originatingSubmissionId.value ? (openBlock(), createBlock(Fragment, { key: 0 }, [
                    createTextVNode("Open Review Queue (submission " + toDisplayString(originatingSubmissionId.value.substring(0, 8)) + "…)", 1)
                  ], 64)) : (openBlock(), createBlock(Fragment, { key: 1 }, [
                    createTextVNode("Open Review Queue for " + toDisplayString(props.id.substring(0, 8)) + "…", 1)
                  ], 64))
                ];
              }
            }),
            _: 1
          }, _parent));
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<button class="px-4 py-2 theme-primary rounded-lg hover:opacity-95 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-ae3fed3e> ← Back to Map </button></div></div>`);
      } else if (artwork.value) {
        _push(`<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8" data-v-ae3fed3e><section aria-labelledby="photos-heading" class="${ssrRenderClass([{ "opacity-60": isEditMode.value }, "mb-6 lg:mb-8"])}" data-v-ae3fed3e><h2 id="photos-heading" class="sr-only" data-v-ae3fed3e>Photo Gallery</h2><div class="relative" data-v-ae3fed3e>`);
        _push(ssrRenderComponent(PhotoCarousel, {
          photos: artworkPhotos.value,
          currentIndex: currentPhotoIndex.value,
          "onUpdate:currentIndex": ($event) => currentPhotoIndex.value = $event,
          "alt-text-prefix": artworkTitle.value,
          onFullscreen: handlePhotoFullscreen
        }, null, _parent));
        if (isEditMode.value) {
          _push(`<div class="absolute inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center rounded-lg" data-v-ae3fed3e><div class="text-center p-4" data-v-ae3fed3e><svg class="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-ae3fed3e><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" data-v-ae3fed3e></path></svg><p class="text-sm font-medium theme-muted" data-v-ae3fed3e>Photos cannot be edited</p><p class="text-xs text-gray-500 mt-1" data-v-ae3fed3e> Photo editing is not available in this version </p></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></section>`);
        _push(ssrRenderComponent(ArtworkActionBar, {
          "artwork-id": props.id,
          "user-id": unref(authStore).user?.id || null,
          permissions: { canEdit: unref(authStore).isAuthenticated },
          onAuthRequired: handleActionBarAuthRequired,
          onEditArtwork: handleActionBarEditArtwork,
          onAddLog: handleActionBarAddLog,
          onShareArtwork: handleActionBarShare,
          onReportMissing: handleReportMissing,
          onReportIssue: handleReportIssue
        }, null, _parent));
        _push(`<section aria-labelledby="artwork-details-heading" class="mb-6 theme-surface rounded-lg border theme-border p-6 relative" data-v-ae3fed3e><h2 id="artwork-details-heading" class="sr-only" data-v-ae3fed3e>Artwork Details</h2>`);
        if (unref(authStore).isAuthenticated && !isEditMode.value) {
          _push(`<button aria-label="Edit artwork details"${ssrIncludeBooleanAttr(hasPendingEdits.value) ? " disabled" : ""} class="absolute top-4 right-4 inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" type="button" data-v-ae3fed3e>`);
          _push(ssrRenderComponent(unref(PencilIcon), { class: "w-4 h-4 mr-1.5" }, null, _parent));
          _push(` Edit </button>`);
        } else {
          _push(`<!---->`);
        }
        if (!isEditMode.value) {
          _push(`<div data-v-ae3fed3e><div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2" data-v-ae3fed3e><div class="flex items-center gap-3 pr-20" data-v-ae3fed3e><h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold theme-on-background leading-tight" data-v-ae3fed3e>${ssrInterpolate(displayTitle.value)}</h1>`);
          if (artwork.value && artwork.value.view_count != null) {
            _push(`<div class="ml-2" data-v-ae3fed3e><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 theme-on-surface" title="Anonymized view count" data-v-ae3fed3e><svg class="w-3 h-3 mr-1 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-ae3fed3e><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" data-v-ae3fed3e></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" data-v-ae3fed3e></path></svg> ${ssrInterpolate(artwork.value?.view_count ?? 0)}</span></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div></div>`);
        } else {
          _push(`<div class="mb-4" data-v-ae3fed3e><label for="edit-title" class="block text-sm font-medium text-gray-700 mb-1" data-v-ae3fed3e>Title</label><input id="edit-title"${ssrRenderAttr("value", editData.value.title)} type="text" maxlength="512" class="block w-full text-2xl sm:text-3xl font-bold text-gray-900 bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Enter artwork title..." data-v-ae3fed3e><p class="mt-1 text-sm text-gray-500" data-v-ae3fed3e>${ssrInterpolate(editData.value.title.length)}/512 characters</p></div>`);
        }
        if (!isEditMode.value) {
          _push(`<div class="text-base sm:text-lg text-gray-600 mb-4" data-v-ae3fed3e>`);
          if (hasArtistLinks.value) {
            _push(`<div class="flex items-center gap-1 flex-wrap" data-v-ae3fed3e><span data-v-ae3fed3e>by</span><!--[-->`);
            ssrRenderList(artworkArtists.value, (artist, index) => {
              _push(`<span data-v-ae3fed3e><button class="font-medium hover:underline focus:outline-none rounded" style="${ssrRenderStyle({ color: "rgb(var(--md-primary))" })}" data-v-ae3fed3e>${ssrInterpolate(artist.name)}</button>`);
              if (index < artworkArtists.value.length - 1) {
                _push(`<span data-v-ae3fed3e>, </span>`);
              } else {
                _push(`<!---->`);
              }
              _push(`</span>`);
            });
            _push(`<!--]--></div>`);
          } else if (hasDisplayableCreators.value) {
            _push(`<div class="flex items-center gap-1 flex-wrap" data-v-ae3fed3e><span data-v-ae3fed3e>by</span><!--[-->`);
            ssrRenderList(displayCreatorsList.value, (creatorName, index) => {
              _push(`<span data-v-ae3fed3e><span class="text-gray-700 font-medium" data-v-ae3fed3e>${ssrInterpolate(creatorName)}</span>`);
              if (index < displayCreatorsList.value.length - 1) {
                _push(`<span data-v-ae3fed3e>, </span>`);
              } else {
                _push(`<!---->`);
              }
              _push(`</span>`);
            });
            _push(`<!--]--></div>`);
          } else {
            _push(`<div class="text-gray-500 italic" data-v-ae3fed3e>Artist unknown</div>`);
          }
          _push(`</div>`);
        } else if (isEditMode.value) {
          _push(`<div class="mb-4" data-v-ae3fed3e><label for="edit-creators" class="block text-sm font-medium text-gray-700 mb-1" data-v-ae3fed3e>Created by</label><input id="edit-creators"${ssrRenderAttr("value", editData.value.creators)} type="text" class="block w-full text-base sm:text-lg text-gray-600 bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Enter creators (comma separated)..." data-v-ae3fed3e></div>`);
        } else {
          _push(`<!---->`);
        }
        if (isEditMode.value) {
          _push(`<div class="mb-4" data-v-ae3fed3e><label class="block text-sm font-medium text-gray-700 mb-1" data-v-ae3fed3e>Linked Artists</label>`);
          _push(ssrRenderComponent(ArtistLookup, {
            modelValue: editData.value.artists,
            "onUpdate:modelValue": ($event) => editData.value.artists = $event
          }, null, _parent));
          _push(`<p class="mt-1 text-xs text-gray-500" data-v-ae3fed3e>Select one or more linked artists. Creating new artists is done elsewhere.</p></div>`);
        } else {
          _push(`<!---->`);
        }
        if (!isEditMode.value) {
          _push(`<div class="mt-6 pt-6 border-t border-gray-200" data-v-ae3fed3e><h3 class="text-lg font-medium theme-on-surface mb-3" data-v-ae3fed3e>Description</h3>`);
          if (displayDescription.value) {
            _push(`<div class="prose prose-gray max-w-none theme-on-surface leading-relaxed" data-v-ae3fed3e>${renderedDescription.value ?? ""}</div>`);
          } else {
            _push(`<div class="theme-muted italic theme-surface p-4 rounded-lg" data-v-ae3fed3e> Add description - No description available for this artwork yet. </div>`);
          }
          _push(`</div>`);
        } else {
          _push(`<div class="mt-6 pt-6 border-t border-gray-200" data-v-ae3fed3e><label for="edit-description" class="block text-sm font-medium text-gray-700 mb-1" data-v-ae3fed3e>Description</label><textarea id="edit-description" rows="4" class="block w-full bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical" placeholder="Enter artwork description..." data-v-ae3fed3e>${ssrInterpolate(editData.value.description)}</textarea><div class="text-xs text-gray-500 space-y-1 mt-2" data-v-ae3fed3e><p class="font-medium" data-v-ae3fed3e>Markdown tips:</p><ul class="list-disc ml-4 space-y-0.5" data-v-ae3fed3e><li data-v-ae3fed3e><code data-v-ae3fed3e>**bold**</code> → <strong data-v-ae3fed3e>bold</strong></li><li data-v-ae3fed3e><code data-v-ae3fed3e># Heading 1</code>, <code data-v-ae3fed3e>## Heading 2</code></li><li data-v-ae3fed3e><code data-v-ae3fed3e>* item</code> for bullet lists</li><li data-v-ae3fed3e><code data-v-ae3fed3e>[text](https://link)</code> for links</li><li data-v-ae3fed3e><code data-v-ae3fed3e>_italic_</code> → <em data-v-ae3fed3e>italic</em></li></ul></div></div>`);
        }
        if (isEditMode.value) {
          _push(`<div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg" data-v-ae3fed3e><div class="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3" data-v-ae3fed3e><div class="flex items-center gap-2 text-blue-700" data-v-ae3fed3e><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-ae3fed3e><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" data-v-ae3fed3e></path></svg><span class="font-medium" data-v-ae3fed3e>Edit Mode</span></div><div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2" data-v-ae3fed3e><button${ssrIncludeBooleanAttr(editLoading.value) ? " disabled" : ""} aria-label="Cancel editing" class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed" data-v-ae3fed3e> Cancel </button><button${ssrIncludeBooleanAttr(editLoading.value || !editData.value.title.trim()) ? " disabled" : ""} aria-label="Save changes" class="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" data-v-ae3fed3e>`);
          if (editLoading.value) {
            _push(`<svg class="w-4 h-4 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24" data-v-ae3fed3e><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-ae3fed3e></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-ae3fed3e></path></svg>`);
          } else {
            _push(`<span data-v-ae3fed3e><svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-ae3fed3e><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" data-v-ae3fed3e></path></svg></span>`);
          }
          _push(` ${ssrInterpolate(editLoading.value ? "Saving..." : "Save Changes")}</button></div></div>`);
          if (editError.value) {
            _push(`<div class="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700" data-v-ae3fed3e>${ssrInterpolate(editError.value)}</div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</section><div class="space-y-6 lg:space-y-8" data-v-ae3fed3e><section aria-labelledby="location-heading" class="${ssrRenderClass([{ "opacity-60": isEditMode.value }, "bg-white rounded-lg border border-gray-200 p-6"])}" data-v-ae3fed3e><h2 id="location-heading" class="text-lg font-semibold text-gray-900 mb-4" data-v-ae3fed3e> Location </h2><div class="relative" data-v-ae3fed3e>`);
        if (artwork.value && artwork.value.lat != null && artwork.value.lon != null) {
          _push(ssrRenderComponent(MiniMap, {
            latitude: artwork.value?.lat,
            longitude: artwork.value?.lon,
            title: artworkTitle.value,
            height: "200px",
            zoom: 16,
            onMapReady: handleChildMapReady
          }, null, _parent));
        } else {
          _push(`<div class="text-gray-500 text-sm" data-v-ae3fed3e>Location information not available</div>`);
        }
        if (isEditMode.value) {
          _push(`<div class="absolute inset-0 bg-gray-100 bg-opacity-90 flex items-center justify-center rounded" data-v-ae3fed3e><div class="text-center p-2" data-v-ae3fed3e><svg class="w-8 h-8 mx-auto mb-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-ae3fed3e><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" data-v-ae3fed3e></path></svg><p class="text-xs font-medium text-gray-600" data-v-ae3fed3e>Location cannot be edited</p></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></section><section aria-labelledby="info-details-heading" class="bg-white rounded-lg border border-gray-200 p-6" data-v-ae3fed3e><h2 id="info-details-heading" class="text-lg font-semibold text-gray-900 mb-4" data-v-ae3fed3e> Information &amp; Details </h2><div class="mb-4" data-v-ae3fed3e><dt class="text-sm font-medium text-gray-600" data-v-ae3fed3e>Added</dt><dd class="text-sm text-gray-900" data-v-ae3fed3e>${ssrInterpolate(new Date(artwork.value?.created_at || "").toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        }))}</dd></div>`);
        if (!isEditMode.value && keywordList.value.length) {
          _push(`<div class="mb-4" data-v-ae3fed3e><div class="text-sm font-medium text-gray-600 mb-1" data-v-ae3fed3e>Keywords</div><div class="flex flex-wrap gap-1" data-v-ae3fed3e><!--[-->`);
          ssrRenderList(keywordList.value, (kw) => {
            _push(`<button class="px-2 py-0.5 text-xs rounded-full focus:outline-none" style="${ssrRenderStyle({ background: "rgba(var(--md-primary),0.08)", color: "rgb(var(--md-primary))" })}" data-v-ae3fed3e>${ssrInterpolate(kw)}</button>`);
          });
          _push(`<!--]--></div></div>`);
        } else {
          _push(`<!---->`);
        }
        if (!isEditMode.value && Object.keys(displayTags.value).length > 0) {
          _push(`<div data-v-ae3fed3e>`);
          _push(ssrRenderComponent(TagBadge, {
            tags: displayTags.value,
            "max-visible": 8,
            "color-scheme": "blue",
            variant: "compact",
            "show-categories": true,
            collapsible: false,
            onTagClick: handleTagClick,
            onTagSearch: (tag) => {
              unref(router).push(`/search/${encodeURIComponent(tag.value)}`);
            }
          }, null, _parent));
          _push(`</div>`);
        } else if (!isEditMode.value) {
          _push(`<div class="text-gray-500 italic text-sm" data-v-ae3fed3e> No additional details available. </div>`);
        } else {
          _push(`<div class="space-y-4" data-v-ae3fed3e><div data-v-ae3fed3e><label for="edit-keywords" class="block text-sm font-medium text-gray-700 mb-1" data-v-ae3fed3e>Keywords (comma separated)</label><textarea id="edit-keywords" maxlength="500" rows="2" class="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="outdoor, landmark, bronze, abstract" data-v-ae3fed3e>${ssrInterpolate(keywordsField.value)}</textarea><p class="text-xs text-gray-500 mt-1" data-v-ae3fed3e>${ssrInterpolate((editData.value.tags.keywords || "").length)}/500 characters. Separate with commas. </p></div>`);
          _push(ssrRenderComponent(TagEditor, {
            ref_key: "tagEditorRef",
            ref: tagEditorRef,
            modelValue: editData.value.tags,
            "onUpdate:modelValue": ($event) => editData.value.tags = $event,
            disabled: editLoading.value,
            "max-tags": 30,
            onTagAdded: (key) => unref(announceSuccess)(`Tag '${key}' added`),
            onTagRemoved: (key) => unref(announceSuccess)(`Tag '${key}' removed`)
          }, null, _parent));
          _push(`</div>`);
        }
        _push(`</section><section aria-labelledby="license-heading" class="bg-blue-50 rounded-lg border border-blue-200 p-6" data-v-ae3fed3e><h2 id="license-heading" class="text-lg font-semibold text-gray-900 mb-3" data-v-ae3fed3e>License</h2><div class="text-sm text-gray-600 space-y-2" data-v-ae3fed3e><p data-v-ae3fed3e><strong data-v-ae3fed3e>CC0 Public Domain:</strong> All user-contributed content is released under CC0 license. </p><p class="text-xs text-gray-500" data-v-ae3fed3e> Note: Underlying artworks may still be copyrighted. This license only applies to user submissions. </p></div></section></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showFullscreenPhoto.value) {
        _push(`<div class="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Fullscreen photo view" data-v-ae3fed3e><button class="absolute top-4 right-4 text-white hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white rounded z-10" aria-label="Close fullscreen photo" data-v-ae3fed3e><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-ae3fed3e><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" data-v-ae3fed3e></path></svg></button><img${ssrRenderAttr("src", fullscreenPhotoUrl.value)}${ssrRenderAttr("alt", `Fullscreen view of ${artworkTitle.value}`)} class="max-w-full max-h-full object-contain" data-v-ae3fed3e></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showSuccessModal.value) {
        _push(`<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="success-modal-title" data-v-ae3fed3e><div class="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" data-v-ae3fed3e><div class="flex items-center justify-center mb-4" data-v-ae3fed3e><div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center" data-v-ae3fed3e><svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-ae3fed3e><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" data-v-ae3fed3e></path></svg></div></div><h3 id="success-modal-title" class="text-xl font-bold text-gray-900 text-center mb-2" data-v-ae3fed3e> Changes Submitted Successfully! </h3><p class="text-gray-600 text-center mb-6" data-v-ae3fed3e> Your edits have been sent to our moderation team for review. You&#39;ll be able to see the updated artwork once your changes are approved. </p><div class="flex justify-center" data-v-ae3fed3e><button class="px-6 py-2 theme-success rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500" data-v-ae3fed3e> Got it! </button></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showCancelDialog.value) {
        _push(`<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title" data-v-ae3fed3e><div class="bg-white rounded-lg shadow-xl max-w-md w-full" data-v-ae3fed3e><div class="p-4 sm:p-6" data-v-ae3fed3e><div class="flex items-center mb-4" data-v-ae3fed3e><svg class="w-6 h-6 text-amber-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-ae3fed3e><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" data-v-ae3fed3e></path></svg><h3 id="cancel-dialog-title" class="text-lg font-medium text-gray-900" data-v-ae3fed3e> Discard Changes? </h3></div><p class="text-gray-600 mb-6 text-sm sm:text-base" data-v-ae3fed3e> You have unsaved changes. Are you sure you want to discard them? </p><div class="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3" data-v-ae3fed3e><button class="px-4 py-2 text-sm font-medium theme-on-surface bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 order-2 sm:order-1" data-v-ae3fed3e> Keep Editing </button><button class="px-4 py-2 text-sm font-medium theme-error rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 order-1 sm:order-2" data-v-ae3fed3e> Discard Changes </button></div></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
      if (artwork.value) {
        _push(ssrRenderComponent(_sfc_main$3, {
          modelValue: showAddToListDialog.value,
          "onUpdate:modelValue": ($event) => showAddToListDialog.value = $event,
          "artwork-id": props.id,
          onAddedToList: handleAddedToList
        }, null, _parent));
      } else {
        _push(`<!---->`);
      }
      if (artwork.value) {
        _push(ssrRenderComponent(FeedbackDialog, {
          open: showFeedbackDialog.value,
          "subject-type": "artwork",
          "subject-id": props.id,
          mode: feedbackMode.value,
          onSuccess: handleFeedbackSuccess,
          onCancel: handleFeedbackCancel
        }, null, _parent));
      } else {
        _push(`<!---->`);
      }
      _push(ssrRenderComponent(AuthModal, {
        "is-open": showAuthModal.value,
        onClose: ($event) => showAuthModal.value = false,
        onSuccess: ($event) => showAuthModal.value = false
      }, null, _parent));
      _push(`<!--]-->`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ArtworkDetailView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ArtworkDetailView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-ae3fed3e"]]);

export { ArtworkDetailView as default };
//# sourceMappingURL=ArtworkDetailView-DqXjIzs4.js.map
