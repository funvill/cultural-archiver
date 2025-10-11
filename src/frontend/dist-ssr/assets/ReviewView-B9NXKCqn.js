import { defineComponent, computed, mergeProps, useSSRContext, ref, onMounted, watch, resolveComponent, withCtx, createBlock, createTextVNode, openBlock, createVNode, toDisplayString } from 'vue';
import { ssrRenderAttrs, ssrRenderList, ssrInterpolate, ssrRenderClass, ssrRenderComponent, ssrRenderAttr, ssrIncludeBooleanAttr, ssrLooseContain, ssrLooseEqual, ssrRenderStyle } from 'vue/server-renderer';
import { useRouter, useRoute } from 'vue-router';
import { _ as _export_sfc, d as useAuthStore, l as globalModal, b as getErrorMessage, a as apiService } from '../ssr-entry-server.js';
import { u as useArtworksStore } from './artworks-EQolhOHu.js';
import { u as useToasts } from './useToasts-PudGFTbq.js';
import { a as getTagDefinition, T as TAG_CATEGORIES } from './tagSchema-DxDwFgYK.js';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';

const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "TagDiffDisplay",
  __ssrInlineRender: true,
  props: {
    oldValue: {},
    newValue: {},
    formattedOld: {},
    formattedNew: {}
  },
  setup(__props) {
    const props = __props;
    function parseStructuredTags(value) {
      if (!value) return {};
      try {
        const parsed = JSON.parse(value);
        return parsed.tags || parsed || {};
      } catch {
        return {};
      }
    }
    const tagChanges = computed(() => {
      const oldTags = parseStructuredTags(props.oldValue);
      const newTags = parseStructuredTags(props.newValue);
      const allKeys = /* @__PURE__ */ new Set([...Object.keys(oldTags), ...Object.keys(newTags)]);
      const changes = [];
      allKeys.forEach((key) => {
        const oldVal = oldTags[key];
        const newVal = newTags[key];
        if (oldVal === void 0 && newVal !== void 0) {
          changes.push({ key, type: "added", newValue: newVal });
        } else if (oldVal !== void 0 && newVal === void 0) {
          changes.push({ key, type: "removed", oldValue: oldVal });
        } else if (oldVal !== newVal) {
          changes.push({ key, type: "modified", oldValue: oldVal, newValue: newVal });
        }
      });
      return changes;
    });
    const changesByCategory = computed(() => {
      const grouped = {};
      const uncategorized = [];
      tagChanges.value.forEach((change) => {
        const tagDefinition = getTagDefinition(change.key);
        const category = tagDefinition ? TAG_CATEGORIES.find((cat) => cat.key === tagDefinition.category) : null;
        if (category) {
          if (!grouped[category.key]) {
            grouped[category.key] = [];
          }
          grouped[category.key].push({
            ...change,
            category: category.label
          });
        } else {
          uncategorized.push(change);
        }
      });
      if (uncategorized.length > 0) {
        grouped.other = uncategorized;
      }
      return grouped;
    });
    const hasChanges = computed(() => tagChanges.value.length > 0);
    function getChangeIcon(type) {
      switch (type) {
        case "added":
          return "➕";
        case "removed":
          return "➖";
        case "modified":
          return "✏️";
        default:
          return "•";
      }
    }
    function getChangeColor(type) {
      switch (type) {
        case "added":
          return "text-green-600 bg-green-50";
        case "removed":
          return "text-red-600 bg-red-50";
        case "modified":
          return "text-blue-600 bg-blue-50";
        default:
          return "text-gray-600 bg-gray-50";
      }
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "tag-diff-display" }, _attrs))} data-v-f881997e>`);
      if (hasChanges.value) {
        _push(`<div class="space-y-4" data-v-f881997e><h4 class="text-sm font-medium text-gray-900 mb-3" data-v-f881997e>Tag Changes</h4><!--[-->`);
        ssrRenderList(changesByCategory.value, (changes, categoryKey) => {
          _push(`<div class="space-y-2" data-v-f881997e><h5 class="text-xs font-medium text-gray-700 uppercase tracking-wider" data-v-f881997e>${ssrInterpolate(changes[0]?.category || "Other")}</h5><div class="space-y-2" data-v-f881997e><!--[-->`);
          ssrRenderList(changes, (change) => {
            _push(`<div class="${ssrRenderClass(["p-3 rounded-md border-l-4", getChangeColor(change.type)])}" data-v-f881997e><div class="flex items-start space-x-2" data-v-f881997e><span class="text-sm" data-v-f881997e>${ssrInterpolate(getChangeIcon(change.type))}</span><div class="flex-1 min-w-0" data-v-f881997e><div class="flex items-center space-x-2" data-v-f881997e><span class="font-medium text-sm" data-v-f881997e>${ssrInterpolate(change.key)}</span></div>`);
            if (change.type === "removed" || change.type === "modified") {
              _push(`<div class="mt-1" data-v-f881997e><span class="text-xs text-gray-500" data-v-f881997e>Old:</span><span class="ml-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800" data-v-f881997e>${ssrInterpolate(change.oldValue)}</span></div>`);
            } else {
              _push(`<!---->`);
            }
            if (change.type === "added" || change.type === "modified") {
              _push(`<div class="mt-1" data-v-f881997e><span class="text-xs text-gray-500" data-v-f881997e>New:</span><span class="ml-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800" data-v-f881997e>${ssrInterpolate(change.newValue)}</span></div>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div></div></div>`);
          });
          _push(`<!--]--></div></div>`);
        });
        _push(`<!--]--></div>`);
      } else if (_ctx.formattedOld || _ctx.formattedNew) {
        _push(`<div class="space-y-3" data-v-f881997e>`);
        if (_ctx.formattedOld && _ctx.formattedNew) {
          _push(`<div class="grid grid-cols-2 gap-4" data-v-f881997e><div data-v-f881997e><h5 class="text-xs font-medium text-gray-700 mb-2" data-v-f881997e>Before</h5><div class="p-3 bg-red-50 border-l-4 border-red-200 rounded-md" data-v-f881997e><p class="text-sm text-gray-700 whitespace-pre-wrap" data-v-f881997e>${ssrInterpolate(_ctx.formattedOld)}</p></div></div><div data-v-f881997e><h5 class="text-xs font-medium text-gray-700 mb-2" data-v-f881997e>After</h5><div class="p-3 bg-green-50 border-l-4 border-green-200 rounded-md" data-v-f881997e><p class="text-sm text-gray-700 whitespace-pre-wrap" data-v-f881997e>${ssrInterpolate(_ctx.formattedNew)}</p></div></div></div>`);
        } else if (_ctx.formattedNew) {
          _push(`<div data-v-f881997e><h5 class="text-xs font-medium text-gray-700 mb-2" data-v-f881997e>Added</h5><div class="p-3 bg-green-50 border-l-4 border-green-200 rounded-md" data-v-f881997e><p class="text-sm text-gray-700 whitespace-pre-wrap" data-v-f881997e>${ssrInterpolate(_ctx.formattedNew)}</p></div></div>`);
        } else if (_ctx.formattedOld) {
          _push(`<div data-v-f881997e><h5 class="text-xs font-medium text-gray-700 mb-2" data-v-f881997e>Removed</h5><div class="p-3 bg-red-50 border-l-4 border-red-200 rounded-md" data-v-f881997e><p class="text-sm text-gray-700 whitespace-pre-wrap" data-v-f881997e>${ssrInterpolate(_ctx.formattedOld)}</p></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      } else {
        _push(`<div class="text-sm text-gray-500 italic" data-v-f881997e>No tag changes</div>`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/TagDiffDisplay.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
const TagDiffDisplay = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__scopeId", "data-v-f881997e"]]);

const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "ArtworkEditDiffs",
  __ssrInlineRender: true,
  props: {
    diffs: {},
    compact: { type: Boolean, default: false }
  },
  setup(__props) {
    const props = __props;
    const groupedDiffs = computed(() => {
      const groups = {};
      props.diffs.forEach((diff) => {
        if (!groups[diff.field_name]) {
          groups[diff.field_name] = [];
        }
        groups[diff.field_name].push(diff);
      });
      return groups;
    });
    const fieldDisplayInfo = {
      title: { label: "Title", priority: 1, description: "Artwork title or name" },
      description: { label: "Description", priority: 2, description: "Detailed artwork description" },
      tags: { label: "Tags", priority: 3, description: "Structured artwork metadata" },
      created_by: {
        label: "Artist/Creator",
        priority: 4,
        description: "Artist or creator information"
      }
    };
    const sortedFieldNames = computed(() => {
      return Object.keys(groupedDiffs.value).sort((a, b) => {
        const aPriority = fieldDisplayInfo[a]?.priority || 999;
        const bPriority = fieldDisplayInfo[b]?.priority || 999;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        return a.localeCompare(b);
      });
    });
    function getFieldLabel(fieldName) {
      return fieldDisplayInfo[fieldName]?.label || fieldName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    }
    function getFieldDescription(fieldName) {
      return fieldDisplayInfo[fieldName]?.description;
    }
    function isTagField(fieldName) {
      return fieldName === "tags";
    }
    function formatValue(value, fieldName) {
      if (value === null || value === void 0) {
        return "(empty)";
      }
      if (value === "") {
        return "(blank)";
      }
      if (!isTagField(fieldName)) {
        return value;
      }
      return value;
    }
    function getChangeTypeColor(oldValue, newValue) {
      if (oldValue === null && newValue !== null) {
        return "border-green-200 bg-green-50";
      } else if (oldValue !== null && newValue === null) {
        return "border-red-200 bg-red-50";
      } else {
        return "border-blue-200 bg-blue-50";
      }
    }
    function getChangeTypeLabel(oldValue, newValue) {
      if (oldValue === null && newValue !== null) {
        return "Added";
      } else if (oldValue !== null && newValue === null) {
        return "Removed";
      } else {
        return "Modified";
      }
    }
    function getFirstDiff(diffs) {
      return diffs?.[0] || null;
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "artwork-edit-diffs" }, _attrs))} data-v-f92d2c43>`);
      if (!_ctx.compact) {
        _push(`<div class="mb-4" data-v-f92d2c43><h3 class="text-lg font-medium text-gray-900 mb-2" data-v-f92d2c43>Proposed Changes</h3><p class="text-sm text-gray-600" data-v-f92d2c43>Review the following changes proposed by the user:</p></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="space-y-4" data-v-f92d2c43><!--[-->`);
      ssrRenderList(sortedFieldNames.value, (fieldName) => {
        _push(`<div class="${ssrRenderClass([
          "border rounded-lg p-4",
          (() => {
            const firstDiff = getFirstDiff(groupedDiffs.value[fieldName]);
            if (!firstDiff) return "border-gray-200 bg-gray-50";
            return getChangeTypeColor(firstDiff.old_value, firstDiff.new_value);
          })()
        ])}" data-v-f92d2c43><div class="flex items-center justify-between mb-3" data-v-f92d2c43><div class="flex-1" data-v-f92d2c43><div class="flex items-center space-x-2" data-v-f92d2c43><h4 class="font-medium text-gray-900" data-v-f92d2c43>${ssrInterpolate(getFieldLabel(fieldName))}</h4><span class="${ssrRenderClass([
          "px-2 py-1 text-xs font-medium rounded-full",
          (() => {
            const firstDiff = getFirstDiff(groupedDiffs.value[fieldName]);
            if (!firstDiff) return "bg-gray-100 text-gray-700";
            const colorClass = getChangeTypeColor(firstDiff.old_value, firstDiff.new_value);
            if (colorClass.includes("green")) return "bg-green-100 text-green-700";
            if (colorClass.includes("red")) return "bg-red-100 text-red-700";
            return "bg-blue-100 text-blue-700";
          })()
        ])}" data-v-f92d2c43>${ssrInterpolate((() => {
          const firstDiff = getFirstDiff(groupedDiffs.value[fieldName]);
          if (!firstDiff) return "Unknown";
          return getChangeTypeLabel(firstDiff.old_value, firstDiff.new_value);
        })())}</span></div>`);
        if (getFieldDescription(fieldName)) {
          _push(`<p class="text-xs text-gray-500 mt-1" data-v-f92d2c43>${ssrInterpolate(getFieldDescription(fieldName))}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div><!--[-->`);
        ssrRenderList(groupedDiffs.value[fieldName], (diff) => {
          _push(`<div data-v-f92d2c43>`);
          if (isTagField(fieldName)) {
            _push(ssrRenderComponent(TagDiffDisplay, {
              "old-value": diff.old_value || void 0,
              "new-value": diff.new_value || void 0,
              "formatted-old": diff.formatted_old,
              "formatted-new": diff.formatted_new
            }, null, _parent));
          } else {
            _push(`<div class="space-y-3" data-v-f92d2c43>`);
            if (diff.old_value !== void 0 && diff.new_value !== void 0) {
              _push(`<div class="grid grid-cols-2 gap-4" data-v-f92d2c43><div data-v-f92d2c43><h5 class="text-xs font-medium text-gray-700 mb-2" data-v-f92d2c43>Current</h5><div class="p-3 bg-white border border-gray-200 rounded-md" data-v-f92d2c43><p class="text-sm text-gray-700 whitespace-pre-wrap" data-v-f92d2c43>${ssrInterpolate(formatValue(diff.old_value, fieldName))}</p></div></div><div data-v-f92d2c43><h5 class="text-xs font-medium text-gray-700 mb-2" data-v-f92d2c43>Proposed</h5><div class="p-3 bg-white border border-gray-200 rounded-md" data-v-f92d2c43><p class="text-sm text-gray-700 whitespace-pre-wrap" data-v-f92d2c43>${ssrInterpolate(formatValue(diff.new_value, fieldName))}</p></div></div></div>`);
            } else if (diff.new_value) {
              _push(`<div data-v-f92d2c43><h5 class="text-xs font-medium text-gray-700 mb-2" data-v-f92d2c43>Proposed Value</h5><div class="p-3 bg-white border border-gray-200 rounded-md" data-v-f92d2c43><p class="text-sm text-gray-700 whitespace-pre-wrap" data-v-f92d2c43>${ssrInterpolate(formatValue(diff.new_value, fieldName))}</p></div></div>`);
            } else if (diff.old_value) {
              _push(`<div data-v-f92d2c43><h5 class="text-xs font-medium text-gray-700 mb-2" data-v-f92d2c43>Removing Value</h5><div class="p-3 bg-white border border-gray-200 rounded-md" data-v-f92d2c43><p class="text-sm text-gray-700 whitespace-pre-wrap" data-v-f92d2c43>${ssrInterpolate(formatValue(diff.old_value, fieldName))}</p></div></div>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div>`);
          }
          _push(`</div>`);
        });
        _push(`<!--]--></div>`);
      });
      _push(`<!--]--></div></div>`);
    };
  }
});

const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ArtworkEditDiffs.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const ArtworkEditDiffs = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-f92d2c43"]]);

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "ArtistEditDiffs",
  __ssrInlineRender: true,
  props: {
    diffs: {},
    compact: { type: Boolean, default: false }
  },
  setup(__props) {
    const props = __props;
    const grouped = computed(() => {
      const g = {};
      props.diffs.forEach((d) => {
        if (!g[d.field_name]) {
          g[d.field_name] = [];
        }
        g[d.field_name].push(d);
      });
      return g;
    });
    function highlightChanges(oldVal, newVal) {
      if (oldVal === null || newVal === null) return escapeHtml(newVal || "(empty)");
      const oldStr = String(oldVal);
      const newStr = String(newVal);
      let prefix = 0;
      while (prefix < oldStr.length && prefix < newStr.length && oldStr[prefix] === newStr[prefix]) prefix++;
      let suffix = 0;
      while (suffix < oldStr.length - prefix && suffix < newStr.length - prefix && oldStr[oldStr.length - 1 - suffix] === newStr[newStr.length - 1 - suffix])
        suffix++;
      const commonStart = escapeHtml(newStr.slice(0, prefix));
      const changed = escapeHtml(newStr.slice(prefix, newStr.length - suffix || void 0));
      const commonEnd = escapeHtml(newStr.slice(newStr.length - suffix));
      return `${commonStart}<span class="bg-yellow-100 px-1 rounded">${changed}</span>${commonEnd}`;
    }
    function escapeHtml(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "artist-edit-diffs" }, _attrs))} data-v-c5e8d368>`);
      if (!_ctx.compact) {
        _push(`<div class="mb-4" data-v-c5e8d368><h3 class="text-lg font-medium text-gray-900 mb-2" data-v-c5e8d368>Proposed Artist Changes</h3><p class="text-sm text-gray-600" data-v-c5e8d368>Review the following changes proposed by the user.</p></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="space-y-4" data-v-c5e8d368><!--[-->`);
      ssrRenderList(grouped.value, (group, field) => {
        _push(`<div class="border rounded-lg p-4 bg-white" data-v-c5e8d368><div class="flex items-center justify-between mb-3" data-v-c5e8d368><div data-v-c5e8d368><h4 class="font-medium text-gray-900" data-v-c5e8d368>${ssrInterpolate(field.replace(/_/g, " "))}</h4></div></div><!--[-->`);
        ssrRenderList(group, (diff) => {
          _push(`<div data-v-c5e8d368><div class="grid grid-cols-2 gap-4" data-v-c5e8d368><div data-v-c5e8d368><h5 class="text-xs font-medium text-gray-700 mb-2" data-v-c5e8d368>Current</h5><div class="p-3 bg-gray-50 border border-gray-200 rounded-md" data-v-c5e8d368><p class="text-sm text-gray-700 whitespace-pre-wrap" data-v-c5e8d368>${ssrInterpolate(diff.old_value || "(empty)")}</p></div></div><div data-v-c5e8d368><h5 class="text-xs font-medium text-gray-700 mb-2" data-v-c5e8d368>Proposed</h5><div class="p-3 bg-white border border-gray-200 rounded-md" data-v-c5e8d368><p class="text-sm text-gray-700 whitespace-pre-wrap" data-v-c5e8d368>${highlightChanges(diff.old_value, diff.new_value) ?? ""}</p></div></div></div></div>`);
        });
        _push(`<!--]--></div>`);
      });
      _push(`<!--]--></div></div>`);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ArtistEditDiffs.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const ArtistEditDiffs = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-c5e8d368"]]);

const pageSize = 6;
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ReviewView",
  __ssrInlineRender: true,
  setup(__props) {
    const authStore = useAuthStore();
    useArtworksStore();
    const router = useRouter();
    const route = useRoute();
    const loading = ref(true);
    const error = ref(null);
    const submissions = ref([]);
    const artworkEdits = ref([]);
    const feedback = ref([]);
    const feedbackTotal = ref(0);
    const currentTab = ref("submissions");
    const statistics = ref({
      pending: 0,
      approvedToday: 0,
      rejectedToday: 0,
      total: 0
    });
    const filterType = ref("all");
    const searchId = ref("");
    const sortBy = ref("created_at");
    const currentPage = ref(1);
    const processingId = ref(null);
    const action = ref(null);
    const filteredSubmissions = computed(() => {
      if (currentTab.value !== "submissions") return [];
      const searching = !!searchId.value.trim();
      let base = searching ? submissions.value.slice() : submissions.value.filter((s) => s.status === "pending");
      if (filterType.value !== "all") {
        base = base.filter((s) => s.type === filterType.value);
      }
      if (searching) {
        const term = searchId.value.trim().toLowerCase();
        base = base.filter((s) => {
          if (s.id.toLowerCase().includes(term)) return true;
          if (s.artwork_id && s.artwork_id.toLowerCase().includes(term)) return true;
          return false;
        });
      }
      base.sort((a, b) => {
        if (sortBy.value === "priority") {
          if (a.priority === "high" && b.priority !== "high") return -1;
          if (b.priority === "high" && a.priority !== "high") return 1;
        }
        if (searching && a.status !== b.status) {
          if (a.status === "pending") return -1;
          if (b.status === "pending") return 1;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      return base;
    });
    const filteredArtworkEdits = computed(() => {
      if (currentTab.value !== "edits") return [];
      let filtered = artworkEdits.value.slice();
      if (searchId.value.trim()) {
        const term = searchId.value.trim().toLowerCase();
        filtered = filtered.filter(
          (e) => e.id && e.id.toLowerCase().includes(term) || e.artwork_id && e.artwork_id.toLowerCase().includes(term)
        );
      }
      filtered.sort((a, b) => {
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
      return filtered;
    });
    const totalPages = computed(() => {
      const items = currentTab.value === "submissions" ? filteredSubmissions.value : filteredArtworkEdits.value;
      return Math.ceil(items.length / pageSize);
    });
    const startIndex = computed(() => (currentPage.value - 1) * pageSize);
    const endIndex = computed(() => startIndex.value + pageSize);
    const paginatedSubmissions = computed(
      () => filteredSubmissions.value.slice(startIndex.value, endIndex.value)
    );
    const paginatedArtworkEdits = computed(
      () => filteredArtworkEdits.value.slice(startIndex.value, endIndex.value)
    );
    const filteredArtistEdits = computed(() => {
      if (currentTab.value !== "artist-edits") return [];
      let filtered = artistEdits.value.slice();
      if (searchId.value.trim()) {
        const term = searchId.value.trim().toLowerCase();
        filtered = filtered.filter(
          (e) => e.id && e.id.toLowerCase().includes(term) || e.artist_id && e.artist_id.toLowerCase().includes(term)
        );
      }
      filtered.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      return filtered;
    });
    const paginatedArtistEdits = computed(() => filteredArtistEdits.value.slice(startIndex.value, endIndex.value));
    onMounted(() => {
      const initial = route.query.searchId || "";
      if (initial) {
        searchId.value = initial;
      }
      loadData();
    });
    watch(searchId, (val) => {
      const q = { ...route.query };
      if (val) q.searchId = val;
      else delete q.searchId;
      router.replace({ query: q });
      currentPage.value = 1;
      if (val.trim()) {
        ensureSubmissionLoaded(val.trim());
      }
    });
    async function loadData() {
      if (!authStore.token) {
        await globalModal.showError(
          "You must be signed in to access the review queue.",
          "Authentication Required"
        );
        loading.value = false;
        return;
      }
      loading.value = true;
      error.value = null;
      try {
        await Promise.all([loadSubmissions(), loadArtworkEdits(), loadArtistEdits(), loadFeedback()]);
        if (searchId.value.trim()) {
          await ensureSubmissionLoaded(searchId.value.trim());
        }
      } catch (err) {
        console.error("[ReviewView] Error loading data:", err);
        error.value = getErrorMessage(err);
        await globalModal.showError(
          `Failed to load review queue: ${getErrorMessage(err)}`,
          "Review Queue Error"
        );
      } finally {
        loading.value = false;
      }
    }
    async function loadArtistEdits() {
      try {
        console.log("[ReviewView] Loading artist edits for moderation...");
        const response = await apiService.getArtistEdits(1, 100);
        const data = response;
        if (data && data.edits) {
          const normalized = (data.edits || []).map((e) => ({
            ...e,
            id: e.id || (Array.isArray(e.edit_ids) && e.edit_ids.length > 0 ? e.edit_ids[0] : void 0)
          }));
          artistEdits.value = normalized;
          console.log("[ReviewView] Loaded artist edits:", artistEdits.value.length);
        } else {
          artistEdits.value = [];
        }
      } catch (err) {
        console.error("[ReviewView] Error loading artist edits:", err);
        artistEdits.value = [];
      }
    }
    const artistEdits = ref([]);
    async function ensureSubmissionLoaded(id) {
      const lower = id.toLowerCase();
      const exists = submissions.value.some(
        (s) => s.id.toLowerCase() === lower || s.artwork_id && s.artwork_id.toLowerCase() === lower
      );
      if (exists) return;
      if (!/^[0-9a-fA-F-]{32,36}$/.test(id)) return;
      try {
        const resp = await apiService.getSubmissionForReview(id);
        const data = resp.data || resp;
        if (data && data.id) {
          const mapped = {
            id: data.id,
            artwork_id: data.artwork_id || data.artworkId || void 0,
            title: data.title || "",
            note: data.note || "",
            photos: data.photos || [],
            latitude: data.lat || data.latitude || 0,
            longitude: data.lon || data.longitude || 0,
            type: data.type || "other",
            status: data.status || "pending",
            created_at: data.created_at || (/* @__PURE__ */ new Date()).toISOString(),
            user_token: data.user_token || "",
            priority: data.priority || "normal",
            nearby_artworks: data.nearby_artworks || [],
            currentPhotoIndex: 0
          };
          submissions.value = [mapped, ...submissions.value];
        }
      } catch (e) {
        console.warn("[ReviewView] ensureSubmissionLoaded failed for", id, e);
      }
    }
    async function loadArtworkEdits() {
      try {
        console.log("[ReviewView] Loading artwork edits for moderation...");
        const response = await apiService.getArtworkEdits(1, 100);
        console.log("[ReviewView] Artwork edits response:", response);
        const responseData = response;
        if (responseData.edits && Array.isArray(responseData.edits)) {
          artworkEdits.value = responseData.edits;
          console.log("[ReviewView] Processed artwork edits:", artworkEdits.value.length);
        } else {
          console.warn("[ReviewView] No artwork edits in response:", responseData);
          artworkEdits.value = [];
        }
      } catch (err) {
        console.error("[ReviewView] Error loading artwork edits:", err);
        await globalModal.showError(
          `Failed to load artwork edits for review: ${getErrorMessage(err)}`,
          "Review Queue Error"
        );
        const { error: toastError } = useToasts();
        toastError(`Could not load artwork edits: ${getErrorMessage(err)}`);
      }
    }
    async function loadFeedback() {
      try {
        console.log("[ReviewView] Loading feedback for moderation...");
        const params = new URLSearchParams({
          page: "1",
          per_page: "100",
          status: "open"
          // Only show open feedback by default
        });
        const response = await apiService.get(`/moderation/feedback?${params.toString()}`);
        feedback.value = response.feedback || [];
        feedbackTotal.value = response.total || 0;
        console.log("[ReviewView] Loaded feedback:", feedback.value.length);
      } catch (err) {
        console.error("[ReviewView] Error loading feedback:", err);
        await globalModal.showError(
          `Failed to load feedback for review: ${getErrorMessage(err)}`,
          "Review Queue Error"
        );
        feedback.value = [];
      }
    }
    function extractArtworkTitle(artworkId) {
      return `Artwork ${artworkId.substring(0, 8)}...`;
    }
    async function loadSubmissions() {
      try {
        console.log("[ReviewView] Loading review queue using apiService...");
        const response = await apiService.getReviewQueue("pending", void 0, 1, 100);
        console.log("[ReviewView] Review queue response:", response);
        const responseData = response;
        if (responseData.submissions && Array.isArray(responseData.submissions)) {
          submissions.value = responseData.submissions.map((item) => ({
            id: item.id,
            artwork_id: item.artwork_id || item.artworkId || void 0,
            title: item.title || "",
            note: item.note || "",
            photos: item.photos || [],
            latitude: item.lat || item.latitude || 0,
            longitude: item.lon || item.longitude || 0,
            type: item.type || "other",
            status: item.status || "pending",
            created_at: item.created_at || (/* @__PURE__ */ new Date()).toISOString(),
            user_token: item.user_token || "",
            priority: item.priority || "normal",
            nearby_artworks: item.nearby_artworks || [],
            currentPhotoIndex: 0
          }));
          console.log("[ReviewView] Processed submissions:", submissions.value.length);
        } else {
          console.warn("[ReviewView] No submissions in response:", responseData);
          submissions.value = [];
        }
        try {
          const statsResponse = await apiService.getReviewStats();
          if (statsResponse.data) {
            const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
            const todayActivity = statsResponse.data.recent_activity?.filter((activity) => activity.date === today) || [];
            const approvedToday = todayActivity.find((activity) => activity.status === "approved")?.count || 0;
            const rejectedToday = todayActivity.find((activity) => activity.status === "rejected")?.count || 0;
            statistics.value = {
              pending: statsResponse.data.status_counts.pending || 0,
              approvedToday,
              rejectedToday,
              total: (statsResponse.data.status_counts.pending || 0) + (statsResponse.data.status_counts.approved || 0) + (statsResponse.data.status_counts.rejected || 0)
            };
            console.log("[ReviewView] Statistics calculated:", statistics.value);
          }
        } catch (statsError) {
          console.warn("[ReviewView] Failed to load statistics:", statsError);
        }
      } catch (err) {
        console.error("[ReviewView] Error loading submissions:", err);
        await globalModal.showError(
          `Failed to load submissions for review: ${getErrorMessage(err)}`,
          "Review Queue Error"
        );
        throw err;
      }
    }
    function getArtworkTypeEmoji(type) {
      const typeMap = {
        public_art: "🎨",
        street_art: "🎭",
        monument: "🗿",
        sculpture: "⚱️",
        logbook_entry: "📖",
        // Add emoji for logbook entries
        other: "🏛️"
      };
      return typeMap[type] || "🏛️";
    }
    function getSubmissionTypeLabel(type) {
      const labelMap = {
        logbook_entry: "Logbook Entry",
        public_art: "Public Art",
        street_art: "Street Art",
        monument: "Monument",
        sculpture: "Sculpture",
        other: "Other"
      };
      return labelMap[type] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    }
    function parseLogbookNotes(notes) {
      if (!notes) return { rawNotes: "" };
      const conditionMatch = notes.match(/Condition:\s*([^;]+)/i);
      const condition = conditionMatch?.[1]?.trim();
      let userNotes = notes;
      if (conditionMatch) {
        userNotes = userNotes.replace(/Condition:\s*[^;]+;?\s*/i, "").trim();
      }
      const result = {
        rawNotes: notes
      };
      if (condition) {
        result.condition = condition;
      }
      if (userNotes) {
        result.userNotes = userNotes;
      }
      return result;
    }
    function formatDate(dateString) {
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        });
      } catch {
        return "Unknown";
      }
    }
    function getIssueTypeLabel(issueType) {
      const labels = {
        missing: "Missing",
        incorrect_info: "Incorrect Info",
        other: "Other",
        comment: "Comment"
      };
      return labels[issueType] || issueType;
    }
    function formatArtworkEditSummary(edit) {
      const fieldCount = edit.diffs.length;
      const fields = edit.diffs.map((diff) => {
        switch (diff.field_name) {
          case "tags":
            return "structured tags";
          case "created_by":
            return "artist/creator";
          default:
            return diff.field_name;
        }
      });
      const hasTagEdit = edit.diffs.some((diff) => diff.field_name === "tags");
      const tagOnlyEdit = fieldCount === 1 && hasTagEdit;
      if (tagOnlyEdit) {
        return "Structured tag updates";
      }
      return `${fieldCount} field${fieldCount > 1 ? "s" : ""}: ${fields.join(", ")}`;
    }
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "review-view" }, _attrs))} data-v-9e9bc9fe><div class="bg-white border-b border-gray-200 py-6" data-v-9e9bc9fe><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-v-9e9bc9fe><div class="flex items-center justify-between" data-v-9e9bc9fe><div data-v-9e9bc9fe><h1 class="text-3xl font-bold text-gray-900" data-v-9e9bc9fe>Review Queue</h1><p class="mt-2 text-lg text-gray-600" data-v-9e9bc9fe>Review and moderate community submissions</p></div><div class="flex items-center space-x-4" data-v-9e9bc9fe>`);
      if (currentTab.value === "submissions") {
        _push(`<!--[--><div class="relative" data-v-9e9bc9fe><input${ssrRenderAttr("value", searchId.value)} type="text" placeholder="Search UUID..." class="border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44" data-v-9e9bc9fe><svg class="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-9e9bc9fe><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" data-v-9e9bc9fe></path></svg></div><select class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-9e9bc9fe><option value="all" data-v-9e9bc9fe${ssrIncludeBooleanAttr(Array.isArray(filterType.value) ? ssrLooseContain(filterType.value, "all") : ssrLooseEqual(filterType.value, "all")) ? " selected" : ""}>All Types</option><option value="public_art" data-v-9e9bc9fe${ssrIncludeBooleanAttr(Array.isArray(filterType.value) ? ssrLooseContain(filterType.value, "public_art") : ssrLooseEqual(filterType.value, "public_art")) ? " selected" : ""}>Public Art</option><option value="street_art" data-v-9e9bc9fe${ssrIncludeBooleanAttr(Array.isArray(filterType.value) ? ssrLooseContain(filterType.value, "street_art") : ssrLooseEqual(filterType.value, "street_art")) ? " selected" : ""}>Street Art</option><option value="monument" data-v-9e9bc9fe${ssrIncludeBooleanAttr(Array.isArray(filterType.value) ? ssrLooseContain(filterType.value, "monument") : ssrLooseEqual(filterType.value, "monument")) ? " selected" : ""}>Monument</option><option value="sculpture" data-v-9e9bc9fe${ssrIncludeBooleanAttr(Array.isArray(filterType.value) ? ssrLooseContain(filterType.value, "sculpture") : ssrLooseEqual(filterType.value, "sculpture")) ? " selected" : ""}>Sculpture</option><option value="other" data-v-9e9bc9fe${ssrIncludeBooleanAttr(Array.isArray(filterType.value) ? ssrLooseContain(filterType.value, "other") : ssrLooseEqual(filterType.value, "other")) ? " selected" : ""}>Other</option></select><select class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-9e9bc9fe><option value="created_at" data-v-9e9bc9fe${ssrIncludeBooleanAttr(Array.isArray(sortBy.value) ? ssrLooseContain(sortBy.value, "created_at") : ssrLooseEqual(sortBy.value, "created_at")) ? " selected" : ""}>Date Submitted</option><option value="priority" data-v-9e9bc9fe${ssrIncludeBooleanAttr(Array.isArray(sortBy.value) ? ssrLooseContain(sortBy.value, "priority") : ssrLooseEqual(sortBy.value, "priority")) ? " selected" : ""}>Priority</option></select><!--]-->`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div></div></div><div class="bg-white border-b border-gray-200" data-v-9e9bc9fe><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-v-9e9bc9fe><nav class="flex space-x-8" aria-label="Tabs" data-v-9e9bc9fe><button class="${ssrRenderClass([
        "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
        currentTab.value === "submissions" ? "theme-primary theme-on-primary-container" : "border-transparent theme-outline hover:theme-on-surface hover:border-gray-300"
      ])}" data-v-9e9bc9fe> New Submissions `);
      if (filteredSubmissions.value.length > 0) {
        _push(`<span class="${ssrRenderClass([
          "ml-2 py-0.5 px-2 rounded-full text-xs font-medium",
          currentTab.value === "submissions" ? "theme-primary-container theme-on-primary-container" : "bg-gray-100 text-gray-600"
        ])}" data-v-9e9bc9fe>${ssrInterpolate(filteredSubmissions.value.length)}</span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</button><button class="${ssrRenderClass([
        "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
        currentTab.value === "edits" ? "theme-primary theme-on-primary-container" : "border-transparent theme-outline hover:theme-on-surface hover:border-gray-300"
      ])}" data-v-9e9bc9fe> Artwork Edits `);
      if (filteredArtworkEdits.value.length > 0) {
        _push(`<span class="${ssrRenderClass([
          "ml-2 py-0.5 px-2 rounded-full text-xs font-medium",
          currentTab.value === "edits" ? "theme-primary-container theme-on-primary-container" : "bg-gray-100 text-gray-600"
        ])}" data-v-9e9bc9fe>${ssrInterpolate(filteredArtworkEdits.value.length)}</span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</button><button class="${ssrRenderClass([
        "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
        currentTab.value === "artist-edits" ? "theme-primary theme-on-primary-container" : "border-transparent theme-outline hover:theme-on-surface hover:border-gray-300"
      ])}" data-v-9e9bc9fe> Artist Edits `);
      if (artistEdits.value.length > 0) {
        _push(`<span class="${ssrRenderClass([
          "ml-2 py-0.5 px-2 rounded-full text-xs font-medium",
          currentTab.value === "artist-edits" ? "theme-primary-container theme-on-primary-container" : "bg-gray-100 text-gray-600"
        ])}" data-v-9e9bc9fe>${ssrInterpolate(artistEdits.value.length)}</span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</button><button class="${ssrRenderClass([
        "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
        currentTab.value === "feedback" ? "theme-primary theme-on-primary-container" : "border-transparent theme-outline hover:theme-on-surface hover:border-gray-300"
      ])}" data-v-9e9bc9fe> User Feedback `);
      if (feedback.value.length > 0) {
        _push(`<span class="${ssrRenderClass([
          "ml-2 py-0.5 px-2 rounded-full text-xs font-medium",
          currentTab.value === "feedback" ? "theme-primary-container theme-on-primary-container" : "bg-gray-100 text-gray-600"
        ])}" data-v-9e9bc9fe>${ssrInterpolate(feedback.value.length)}</span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</button></nav></div></div><div class="bg-blue-50 border-b border-blue-200 py-4" data-v-9e9bc9fe><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-v-9e9bc9fe><div class="grid grid-cols-1 md:grid-cols-4 gap-4" data-v-9e9bc9fe><div class="text-center" data-v-9e9bc9fe><p class="text-2xl font-bold theme-warning" data-v-9e9bc9fe>${ssrInterpolate(statistics.value.pending)}</p><p class="text-sm theme-warning" data-v-9e9bc9fe>Pending Review</p></div><div class="text-center" data-v-9e9bc9fe><p class="text-2xl font-bold theme-success" data-v-9e9bc9fe>${ssrInterpolate(statistics.value.approvedToday)}</p><p class="text-sm theme-success" data-v-9e9bc9fe>Approved Today</p></div><div class="text-center" data-v-9e9bc9fe><p class="text-2xl font-bold theme-error" data-v-9e9bc9fe>${ssrInterpolate(statistics.value.rejectedToday)}</p><p class="text-sm theme-error" data-v-9e9bc9fe>Rejected Today</p></div><div class="text-center" data-v-9e9bc9fe><p class="text-2xl font-bold text-gray-900" data-v-9e9bc9fe>${ssrInterpolate(statistics.value.total)}</p><p class="text-sm text-gray-700" data-v-9e9bc9fe>Total Submissions</p></div></div></div></div><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-v-9e9bc9fe>`);
      if (loading.value) {
        _push(`<div class="text-center py-12" data-v-9e9bc9fe><svg class="animate-spin h-12 w-12 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-9e9bc9fe><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-9e9bc9fe></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-9e9bc9fe></path></svg><p class="text-gray-600" data-v-9e9bc9fe>Loading submissions...</p></div>`);
      } else if (error.value) {
        _push(`<div class="text-center py-12" data-v-9e9bc9fe><svg class="h-12 w-12 mx-auto mb-4 theme-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-9e9bc9fe><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" data-v-9e9bc9fe></path></svg><p class="text-gray-600 mb-4" data-v-9e9bc9fe>${ssrInterpolate(error.value)}</p><button class="px-4 py-2 theme-primary theme-on-primary rounded-md" data-v-9e9bc9fe> Retry </button></div>`);
      } else if (currentTab.value === "submissions") {
        _push(`<!--[-->`);
        if (filteredSubmissions.value.length === 0) {
          _push(`<div class="text-center py-12" data-v-9e9bc9fe><svg class="h-12 w-12 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-9e9bc9fe><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0114 0z" data-v-9e9bc9fe></path></svg><p class="text-gray-600 mb-4" data-v-9e9bc9fe>No submissions pending review</p><p class="text-sm text-gray-600" data-v-9e9bc9fe>Great job! All submissions have been reviewed.</p></div>`);
        } else {
          _push(`<div class="grid grid-cols-1 lg:grid-cols-2 gap-6" data-v-9e9bc9fe><!--[-->`);
          ssrRenderList(paginatedSubmissions.value, (submission) => {
            _push(`<div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden" data-v-9e9bc9fe><div class="relative" data-v-9e9bc9fe>`);
            if (submission.photos && submission.photos.length > 0) {
              _push(`<div class="aspect-w-16 aspect-h-9 bg-gray-100" data-v-9e9bc9fe><img${ssrRenderAttr("src", submission.photos[submission.currentPhotoIndex || 0] || "")}${ssrRenderAttr("alt", `Submission photo ${(submission.currentPhotoIndex || 0) + 1}`)} class="w-full h-48 object-cover" data-v-9e9bc9fe>`);
              if (submission.photos.length > 1) {
                _push(`<div class="absolute inset-0 flex items-center justify-between p-2" data-v-9e9bc9fe><button class="bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-70" data-v-9e9bc9fe><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-9e9bc9fe><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" data-v-9e9bc9fe></path></svg></button><button class="bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-70" data-v-9e9bc9fe><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-9e9bc9fe><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" data-v-9e9bc9fe></path></svg></button></div>`);
              } else {
                _push(`<!---->`);
              }
              if (submission.photos.length > 1) {
                _push(`<div class="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs" data-v-9e9bc9fe>${ssrInterpolate((submission.currentPhotoIndex || 0) + 1)} / ${ssrInterpolate(submission.photos.length)}</div>`);
              } else {
                _push(`<!---->`);
              }
              _push(`</div>`);
            } else {
              _push(`<div class="h-48 bg-gray-100 flex items-center justify-center" data-v-9e9bc9fe><svg class="w-12 h-12 text-gray-600" fill="currentColor" viewBox="0 0 20 20" data-v-9e9bc9fe><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" data-v-9e9bc9fe></path></svg></div>`);
            }
            if (submission.priority === "high") {
              _push(`<div class="absolute top-2 left-2 theme-error theme-on-error px-2 py-1 text-xs font-medium rounded" data-v-9e9bc9fe> High Priority </div>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div><div class="p-6" data-v-9e9bc9fe><div class="flex items-start justify-between mb-4" data-v-9e9bc9fe><div data-v-9e9bc9fe><h3 class="text-lg font-semibold text-gray-900" data-v-9e9bc9fe>`);
            if (submission.type === "logbook_entry") {
              _push(`<span class="inline-flex items-center" data-v-9e9bc9fe><span class="mr-2" data-v-9e9bc9fe>📖</span> ${ssrInterpolate(getSubmissionTypeLabel(submission.type))} `);
              if (submission.title && submission.title !== "Untitled Submission") {
                _push(`<span class="ml-2 text-gray-600" data-v-9e9bc9fe> - ${ssrInterpolate(submission.title)}</span>`);
              } else {
                _push(`<!---->`);
              }
              _push(`</span>`);
            } else {
              _push(`<span data-v-9e9bc9fe>${ssrInterpolate(submission.title || "Untitled Submission")}</span>`);
            }
            _push(`</h3><p class="text-sm text-gray-600" data-v-9e9bc9fe> Submitted ${ssrInterpolate(formatDate(submission.created_at))}</p></div><span class="text-2xl" data-v-9e9bc9fe>${ssrInterpolate(getArtworkTypeEmoji(submission.type))}</span></div>`);
            if (submission.note) {
              _push(`<div class="mb-4" data-v-9e9bc9fe>`);
              if (submission.type === "logbook_entry") {
                _push(`<div class="space-y-3" data-v-9e9bc9fe>`);
                if (parseLogbookNotes(submission.note).condition || parseLogbookNotes(submission.note).userNotes) {
                  _push(`<!--[-->`);
                  if (parseLogbookNotes(submission.note).condition) {
                    _push(`<div class="bg-blue-50 border border-blue-200 rounded-lg p-3" data-v-9e9bc9fe><h4 class="text-sm font-semibold theme-primary mb-1" data-v-9e9bc9fe>Condition Assessment</h4><p class="text-sm theme-primary" data-v-9e9bc9fe>${ssrInterpolate(parseLogbookNotes(submission.note).condition)}</p></div>`);
                  } else {
                    _push(`<!---->`);
                  }
                  if (parseLogbookNotes(submission.note).userNotes) {
                    _push(`<div class="bg-gray-50 border border-gray-200 rounded-lg p-3" data-v-9e9bc9fe><h4 class="text-sm font-semibold text-gray-900 mb-1" data-v-9e9bc9fe>Additional Notes</h4><p class="text-sm text-gray-700" data-v-9e9bc9fe>${ssrInterpolate(parseLogbookNotes(submission.note).userNotes)}</p></div>`);
                  } else {
                    _push(`<!---->`);
                  }
                  _push(`<!--]-->`);
                } else {
                  _push(`<div class="bg-gray-50 border border-gray-200 rounded-lg p-3" data-v-9e9bc9fe><h4 class="text-sm font-semibold text-gray-900 mb-1" data-v-9e9bc9fe>Notes</h4><p class="text-sm text-gray-700" data-v-9e9bc9fe>${ssrInterpolate(submission.note)}</p></div>`);
                }
                _push(`</div>`);
              } else {
                _push(`<p class="text-sm text-gray-700 line-clamp-3" data-v-9e9bc9fe>${ssrInterpolate(submission.note)}</p>`);
              }
              _push(`</div>`);
            } else {
              _push(`<!---->`);
            }
            _push(`<div class="space-y-2 mb-4" data-v-9e9bc9fe><div class="flex items-center text-sm text-gray-600" data-v-9e9bc9fe><svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" data-v-9e9bc9fe><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" data-v-9e9bc9fe></path></svg> ${ssrInterpolate(submission.latitude?.toFixed(4))}, ${ssrInterpolate(submission.longitude?.toFixed(4))}</div><div class="flex items-center text-sm text-gray-600" data-v-9e9bc9fe><svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" data-v-9e9bc9fe><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" data-v-9e9bc9fe></path></svg> User: ${ssrInterpolate(submission.user_token?.slice(0, 8) || "Anonymous")}... </div>`);
            if (submission.nearby_artworks && submission.nearby_artworks.length > 0) {
              _push(`<div class="flex items-center text-sm theme-warning" data-v-9e9bc9fe><svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" data-v-9e9bc9fe><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" data-v-9e9bc9fe></path></svg> ${ssrInterpolate(submission.nearby_artworks.length)} nearby artwork(s) </div>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div><div class="flex space-x-3" data-v-9e9bc9fe><button${ssrIncludeBooleanAttr(processingId.value === submission.id) ? " disabled" : ""} class="flex-1 px-4 py-2 theme-success theme-on-success text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50" style="${ssrRenderStyle({ "--tw-ring-color": "var(--md-sys-color-success)" })}" data-v-9e9bc9fe>`);
            if (processingId.value === submission.id && action.value === "approve") {
              _push(`<span class="flex items-center justify-center" data-v-9e9bc9fe><svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-9e9bc9fe><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-9e9bc9fe></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-9e9bc9fe></path></svg> Approving... </span>`);
            } else {
              _push(`<span data-v-9e9bc9fe>✓ Approve</span>`);
            }
            _push(`</button><button${ssrIncludeBooleanAttr(processingId.value === submission.id) ? " disabled" : ""} class="flex-1 px-4 py-2 theme-error theme-on-error text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50" style="${ssrRenderStyle({ "--tw-ring-color": "var(--md-sys-color-error)" })}" data-v-9e9bc9fe>`);
            if (processingId.value === submission.id && action.value === "reject") {
              _push(`<span class="flex items-center justify-center" data-v-9e9bc9fe><svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-9e9bc9fe><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-9e9bc9fe></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-9e9bc9fe></path></svg> Rejecting... </span>`);
            } else {
              _push(`<span data-v-9e9bc9fe>✗ Reject</span>`);
            }
            _push(`</button></div><div class="mt-3 flex space-x-3 text-sm" data-v-9e9bc9fe><button class="theme-primary underline" data-v-9e9bc9fe> View on Map </button><button class="theme-warning underline" data-v-9e9bc9fe> Flag for Senior Review </button></div></div></div>`);
          });
          _push(`<!--]--></div>`);
        }
        _push(`<!--]-->`);
      } else if (currentTab.value === "edits") {
        _push(`<!--[-->`);
        if (filteredArtworkEdits.value.length === 0) {
          _push(`<div class="text-center py-12" data-v-9e9bc9fe><svg class="h-12 w-12 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-9e9bc9fe><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" data-v-9e9bc9fe></path></svg><p class="text-gray-600 mb-4" data-v-9e9bc9fe>No artwork edits pending review</p><p class="text-sm text-gray-600" data-v-9e9bc9fe>All artwork edits have been reviewed.</p></div>`);
        } else {
          _push(`<div class="space-y-6" data-v-9e9bc9fe><!--[-->`);
          ssrRenderList(paginatedArtworkEdits.value, (edit) => {
            _push(`<div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6" data-v-9e9bc9fe><div class="flex items-start justify-between mb-4" data-v-9e9bc9fe><div class="flex-1" data-v-9e9bc9fe><div class="flex items-center space-x-2 mb-1" data-v-9e9bc9fe><h3 class="text-lg font-medium text-gray-900" data-v-9e9bc9fe>${ssrInterpolate(extractArtworkTitle(edit.artwork_id))}</h3><div class="flex items-center space-x-1" data-v-9e9bc9fe>`);
            if (edit.diffs.some((d) => d.field_name === "tags")) {
              _push(`<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700" title="Includes structured tag changes" data-v-9e9bc9fe> 🏷️ Tags </span>`);
            } else {
              _push(`<!---->`);
            }
            if (edit.diffs.some((d) => d.field_name === "title")) {
              _push(`<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium theme-primary-container theme-on-primary-container" data-v-9e9bc9fe> 📝 Title </span>`);
            } else {
              _push(`<!---->`);
            }
            if (edit.diffs.some((d) => d.field_name === "description")) {
              _push(`<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium theme-success-container theme-on-success-container" data-v-9e9bc9fe> 📖 Description </span>`);
            } else {
              _push(`<!---->`);
            }
            if (edit.diffs.some((d) => d.field_name === "created_by")) {
              _push(`<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700" data-v-9e9bc9fe> 👤 Artist </span>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div>`);
            _push(ssrRenderComponent(_component_router_link, {
              to: `/artwork/${edit.artwork_id}`,
              class: "theme-primary text-sm underline flex items-center",
              target: "_blank"
            }, {
              default: withCtx((_, _push2, _parent2, _scopeId) => {
                if (_push2) {
                  _push2(`<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-9e9bc9fe${_scopeId}><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" data-v-9e9bc9fe${_scopeId}></path></svg> View Details `);
                } else {
                  return [
                    (openBlock(), createBlock("svg", {
                      class: "w-4 h-4 mr-1",
                      fill: "none",
                      stroke: "currentColor",
                      viewBox: "0 0 24 24"
                    }, [
                      createVNode("path", {
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "stroke-width": "2",
                        d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      })
                    ])),
                    createTextVNode(" View Details ")
                  ];
                }
              }),
              _: 2
            }, _parent));
            _push(`</div><p class="text-sm text-gray-600" data-v-9e9bc9fe>${ssrInterpolate(formatArtworkEditSummary(edit))} • Submitted ${ssrInterpolate(new Date(edit.submitted_at).toLocaleDateString())}</p></div><div class="flex items-center space-x-2 ml-4" data-v-9e9bc9fe><button${ssrIncludeBooleanAttr(processingId.value === edit.edit_ids?.[0]) ? " disabled" : ""} class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md theme-success theme-on-success focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed" style="${ssrRenderStyle({ "--tw-ring-color": "var(--md-sys-color-success)" })}" data-v-9e9bc9fe>`);
            if (processingId.value === edit.edit_ids?.[0] && action.value === "approve") {
              _push(`<span class="flex items-center" data-v-9e9bc9fe><svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-9e9bc9fe><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-9e9bc9fe></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-9e9bc9fe></path></svg> Approving... </span>`);
            } else {
              _push(`<span data-v-9e9bc9fe>Approve</span>`);
            }
            _push(`</button><button${ssrIncludeBooleanAttr(processingId.value === edit.edit_ids?.[0]) ? " disabled" : ""} class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md theme-error theme-on-error focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed" style="${ssrRenderStyle({ "--tw-ring-color": "var(--md-sys-color-error)" })}" data-v-9e9bc9fe>`);
            if (processingId.value === edit.edit_ids?.[0] && action.value === "reject") {
              _push(`<span class="flex items-center" data-v-9e9bc9fe><svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-9e9bc9fe><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-9e9bc9fe></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-9e9bc9fe></path></svg> Rejecting... </span>`);
            } else {
              _push(`<span data-v-9e9bc9fe>Reject</span>`);
            }
            _push(`</button></div></div>`);
            _push(ssrRenderComponent(ArtworkEditDiffs, {
              diffs: edit.diffs
            }, null, _parent));
            _push(`</div>`);
          });
          _push(`<!--]--></div>`);
        }
        _push(`<!--]-->`);
      } else if (currentTab.value === "artist-edits") {
        _push(`<!--[-->`);
        if (filteredArtistEdits.value.length === 0) {
          _push(`<div class="text-center py-12" data-v-9e9bc9fe><p class="text-gray-600 mb-4" data-v-9e9bc9fe>No artist edits pending review</p><p class="text-sm text-gray-600" data-v-9e9bc9fe>All artist edits have been reviewed.</p></div>`);
        } else {
          _push(`<div class="space-y-6" data-v-9e9bc9fe><!--[-->`);
          ssrRenderList(paginatedArtistEdits.value, (edit) => {
            _push(`<div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6" data-v-9e9bc9fe><div class="flex items-start justify-between mb-4" data-v-9e9bc9fe><div class="flex-1" data-v-9e9bc9fe><div class="flex items-center space-x-2 mb-1" data-v-9e9bc9fe><h3 class="text-lg font-medium text-gray-900" data-v-9e9bc9fe>${ssrInterpolate(edit.artist_name || edit.artist_id)}</h3>`);
            if (edit.artist_id) {
              _push(ssrRenderComponent(_component_router_link, {
                to: `/artists/${edit.artist_id}`,
                class: "theme-primary text-sm underline flex items-center",
                target: "_blank"
              }, {
                default: withCtx((_, _push2, _parent2, _scopeId) => {
                  if (_push2) {
                    _push2(` View Artist `);
                  } else {
                    return [
                      createTextVNode(" View Artist ")
                    ];
                  }
                }),
                _: 2
              }, _parent));
            } else {
              _push(`<!---->`);
            }
            _push(`</div><p class="text-sm text-gray-600" data-v-9e9bc9fe> Submitted ${ssrInterpolate(formatDate(edit.submitted_at))}</p></div><div class="flex items-center space-x-2 ml-4" data-v-9e9bc9fe><button${ssrIncludeBooleanAttr(processingId.value === edit.id) ? " disabled" : ""} class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md theme-success theme-on-success focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed" style="${ssrRenderStyle({ "--tw-ring-color": "var(--md-sys-color-success)" })}" data-v-9e9bc9fe>`);
            if (processingId.value === edit.id && action.value === "approve") {
              _push(`<span class="flex items-center" data-v-9e9bc9fe><svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-9e9bc9fe><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-9e9bc9fe></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-9e9bc9fe></path></svg> Approving... </span>`);
            } else {
              _push(`<span data-v-9e9bc9fe>Approve</span>`);
            }
            _push(`</button><button${ssrIncludeBooleanAttr(processingId.value === edit.id) ? " disabled" : ""} class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md theme-error theme-on-error focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed" style="${ssrRenderStyle({ "--tw-ring-color": "var(--md-sys-color-error)" })}" data-v-9e9bc9fe>`);
            if (processingId.value === edit.id && action.value === "reject") {
              _push(`<span class="flex items-center" data-v-9e9bc9fe><svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-9e9bc9fe><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-9e9bc9fe></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2-647z" data-v-9e9bc9fe></path></svg> Rejecting... </span>`);
            } else {
              _push(`<span data-v-9e9bc9fe>Reject</span>`);
            }
            _push(`</button></div></div>`);
            _push(ssrRenderComponent(ArtistEditDiffs, {
              diffs: edit.diffs || []
            }, null, _parent));
            _push(`</div>`);
          });
          _push(`<!--]--></div>`);
        }
        _push(`<!--]-->`);
      } else {
        _push(`<!---->`);
      }
      if (currentTab.value === "feedback") {
        _push(`<!--[-->`);
        if (feedback.value.length === 0) {
          _push(`<div class="text-center py-12 bg-white rounded-lg shadow" data-v-9e9bc9fe><svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-9e9bc9fe><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" data-v-9e9bc9fe></path></svg><h3 class="text-lg font-semibold text-gray-900 mb-2" data-v-9e9bc9fe>No Feedback Found</h3><p class="text-gray-600" data-v-9e9bc9fe>All feedback has been reviewed!</p></div>`);
        } else {
          _push(`<div class="space-y-4" data-v-9e9bc9fe><!--[-->`);
          ssrRenderList(feedback.value, (item) => {
            _push(`<div class="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6" data-v-9e9bc9fe><div class="flex items-start justify-between" data-v-9e9bc9fe><div class="flex-1" data-v-9e9bc9fe><div class="flex items-center gap-3 mb-3" data-v-9e9bc9fe><span class="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800" data-v-9e9bc9fe> OPEN </span><span class="text-sm text-gray-500" data-v-9e9bc9fe>${ssrInterpolate(item.subject_type === "artwork" ? "🎨 Artwork" : "👤 Artist")}</span><span class="text-sm text-gray-500" data-v-9e9bc9fe>•</span><span class="text-sm text-gray-500" data-v-9e9bc9fe>${ssrInterpolate(getIssueTypeLabel(item.issue_type))}</span><span class="text-sm text-gray-500" data-v-9e9bc9fe>•</span><span class="text-sm text-gray-500" data-v-9e9bc9fe>${ssrInterpolate(formatDate(item.created_at))}</span></div><p class="text-gray-900 mb-3 whitespace-pre-wrap" data-v-9e9bc9fe>${ssrInterpolate(item.note)}</p><div class="mb-3" data-v-9e9bc9fe>`);
            _push(ssrRenderComponent(_component_router_link, {
              to: `/${item.subject_type}/${item.subject_id}`,
              class: "text-blue-600 hover:text-blue-800 text-sm font-medium",
              target: "_blank"
            }, {
              default: withCtx((_, _push2, _parent2, _scopeId) => {
                if (_push2) {
                  _push2(` View ${ssrInterpolate(item.subject_type)} → `);
                } else {
                  return [
                    createTextVNode(" View " + toDisplayString(item.subject_type) + " → ", 1)
                  ];
                }
              }),
              _: 2
            }, _parent));
            _push(`</div></div><div class="flex flex-col gap-2 ml-4" data-v-9e9bc9fe><button${ssrIncludeBooleanAttr(!!processingId.value) ? " disabled" : ""} class="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" data-v-9e9bc9fe> Resolve </button><button${ssrIncludeBooleanAttr(!!processingId.value) ? " disabled" : ""} class="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" data-v-9e9bc9fe> Archive </button></div></div></div>`);
          });
          _push(`<!--]--></div>`);
        }
        _push(`<!--]-->`);
      } else {
        _push(`<!---->`);
      }
      if (totalPages.value > 1) {
        _push(`<div class="mt-8 flex items-center justify-between" data-v-9e9bc9fe><div class="text-sm text-gray-700" data-v-9e9bc9fe>`);
        if (currentTab.value === "submissions") {
          _push(`<span data-v-9e9bc9fe> Showing ${ssrInterpolate(startIndex.value + 1)} to ${ssrInterpolate(Math.min(endIndex.value, filteredSubmissions.value.length))} of ${ssrInterpolate(filteredSubmissions.value.length)} submissions </span>`);
        } else if (currentTab.value === "edits") {
          _push(`<span data-v-9e9bc9fe> Showing ${ssrInterpolate(startIndex.value + 1)} to ${ssrInterpolate(Math.min(endIndex.value, filteredArtworkEdits.value.length))} of ${ssrInterpolate(filteredArtworkEdits.value.length)} artwork edits </span>`);
        } else {
          _push(`<span data-v-9e9bc9fe> Showing ${ssrInterpolate(feedback.value.length)} feedback item${ssrInterpolate(feedback.value.length !== 1 ? "s" : "")}</span>`);
        }
        _push(`</div><div class="flex space-x-2" data-v-9e9bc9fe><button${ssrIncludeBooleanAttr(currentPage.value === 1) ? " disabled" : ""} class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" data-v-9e9bc9fe> Previous </button><span class="px-3 py-1 text-sm" data-v-9e9bc9fe> Page ${ssrInterpolate(currentPage.value)} of ${ssrInterpolate(totalPages.value)}</span><button${ssrIncludeBooleanAttr(currentPage.value === totalPages.value) ? " disabled" : ""} class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" data-v-9e9bc9fe> Next </button></div></div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ReviewView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ReviewView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-9e9bc9fe"]]);

export { ReviewView as default };
//# sourceMappingURL=ReviewView-B9NXKCqn.js.map
