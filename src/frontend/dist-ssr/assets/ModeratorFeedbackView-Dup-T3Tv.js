import { defineComponent, ref, computed, onMounted, resolveComponent, mergeProps, withCtx, createBlock, createTextVNode, openBlock, createVNode, toDisplayString, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrInterpolate, ssrIncludeBooleanAttr, ssrLooseContain, ssrLooseEqual, ssrRenderList, ssrRenderClass } from 'vue/server-renderer';
import { useRouter } from 'vue-router';
import { d as useAuthStore, a as apiService, _ as _export_sfc } from '../ssr-entry-server.js';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ModeratorFeedbackView",
  __ssrInlineRender: true,
  setup(__props) {
    const router = useRouter();
    const authStore = useAuthStore();
    const loading = ref(true);
    const error = ref(null);
    const feedback = ref([]);
    const total = ref(0);
    const currentPage = ref(1);
    const perPage = ref(20);
    const statusFilter = ref("open");
    const subjectTypeFilter = ref("all");
    const issueTypeFilter = ref("all");
    const reviewingId = ref(null);
    const reviewAction = ref(null);
    const reviewNotes = ref("");
    const showReviewDialog = ref(false);
    ref(null);
    const filteredFeedback = computed(() => {
      return feedback.value;
    });
    const hasMore = computed(() => {
      return currentPage.value * perPage.value < total.value;
    });
    const statistics = computed(() => {
      const stats = {
        total: total.value,
        open: 0,
        archived: 0,
        resolved: 0
      };
      feedback.value.forEach((item) => {
        if (item.status === "open") stats.open++;
        else if (item.status === "archived") stats.archived++;
        else if (item.status === "resolved") stats.resolved++;
      });
      return stats;
    });
    async function loadFeedback() {
      try {
        loading.value = true;
        error.value = null;
        const params = new URLSearchParams({
          page: currentPage.value.toString(),
          per_page: perPage.value.toString()
        });
        if (statusFilter.value !== "all") {
          params.append("status", statusFilter.value);
        }
        if (subjectTypeFilter.value !== "all") {
          params.append("subject_type", subjectTypeFilter.value);
        }
        if (issueTypeFilter.value !== "all") {
          params.append("issue_type", issueTypeFilter.value);
        }
        const response = await apiService.get(`/moderation/feedback?${params.toString()}`);
        if (response.success && response.data) {
          feedback.value = response.data.feedback || [];
          total.value = response.data.total || 0;
        } else {
          throw new Error(response.error || "Failed to load feedback");
        }
      } catch (err) {
        console.error("Error loading feedback:", err);
        if (err instanceof Error && err.message.includes("403")) {
          router.push("/?error=reviewer_required");
          return;
        }
        error.value = err instanceof Error ? err.message : "Failed to load feedback";
      } finally {
        loading.value = false;
      }
    }
    function formatDate(dateString) {
      const date = new Date(dateString);
      const now = /* @__PURE__ */ new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1e3 * 60 * 60 * 24));
      if (days === 0) return "Today";
      if (days === 1) return "Yesterday";
      if (days < 7) return `${days} days ago`;
      return date.toLocaleDateString();
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
    function getStatusColor(status) {
      const colors = {
        open: "bg-yellow-100 text-yellow-800",
        archived: "bg-gray-100 text-gray-800",
        resolved: "bg-green-100 text-green-800"
      };
      return colors[status] || "bg-gray-100 text-gray-800";
    }
    onMounted(() => {
      if (!authStore.canReview) {
        router.push("/?error=reviewer_required");
        return;
      }
      loadFeedback();
    });
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "moderator-feedback-view min-h-screen bg-gray-50" }, _attrs))} data-v-6ae92920><div class="bg-white border-b border-gray-200 py-6" data-v-6ae92920><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-v-6ae92920><div class="flex items-center justify-between" data-v-6ae92920><div data-v-6ae92920><h1 class="text-3xl font-bold text-gray-900" data-v-6ae92920>Feedback Moderation</h1><p class="mt-2 text-lg text-gray-600" data-v-6ae92920>Review user-reported issues and feedback</p></div><div data-v-6ae92920>`);
      _push(ssrRenderComponent(_component_router_link, {
        to: "/review",
        class: "flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-6ae92920${_scopeId}><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" data-v-6ae92920${_scopeId}></path></svg> Review Queue `);
          } else {
            return [
              (openBlock(), createBlock("svg", {
                class: "w-4 h-4",
                fill: "none",
                stroke: "currentColor",
                viewBox: "0 0 24 24"
              }, [
                createVNode("path", {
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round",
                  "stroke-width": "2",
                  d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                })
              ])),
              createTextVNode(" Review Queue ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div></div><div class="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4" data-v-6ae92920><div class="bg-yellow-50 rounded-lg p-4 text-center" data-v-6ae92920><p class="text-2xl font-bold text-yellow-900" data-v-6ae92920>${ssrInterpolate(statistics.value.open)}</p><p class="text-sm text-yellow-700" data-v-6ae92920>Open</p></div><div class="bg-green-50 rounded-lg p-4 text-center" data-v-6ae92920><p class="text-2xl font-bold text-green-900" data-v-6ae92920>${ssrInterpolate(statistics.value.resolved)}</p><p class="text-sm text-green-700" data-v-6ae92920>Resolved</p></div><div class="bg-gray-50 rounded-lg p-4 text-center" data-v-6ae92920><p class="text-2xl font-bold text-gray-900" data-v-6ae92920>${ssrInterpolate(statistics.value.archived)}</p><p class="text-sm text-gray-700" data-v-6ae92920>Archived</p></div><div class="bg-blue-50 rounded-lg p-4 text-center" data-v-6ae92920><p class="text-2xl font-bold text-blue-900" data-v-6ae92920>${ssrInterpolate(statistics.value.total)}</p><p class="text-sm text-blue-700" data-v-6ae92920>Total</p></div></div></div></div><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-v-6ae92920><div class="bg-white rounded-lg shadow p-6" data-v-6ae92920><h2 class="text-lg font-semibold text-gray-900 mb-4" data-v-6ae92920>Filters</h2><div class="grid grid-cols-1 md:grid-cols-4 gap-4" data-v-6ae92920><div data-v-6ae92920><label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1" data-v-6ae92920> Status </label><select id="status-filter" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-6ae92920><option value="all" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(statusFilter.value) ? ssrLooseContain(statusFilter.value, "all") : ssrLooseEqual(statusFilter.value, "all")) ? " selected" : ""}>All</option><option value="open" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(statusFilter.value) ? ssrLooseContain(statusFilter.value, "open") : ssrLooseEqual(statusFilter.value, "open")) ? " selected" : ""}>Open</option><option value="archived" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(statusFilter.value) ? ssrLooseContain(statusFilter.value, "archived") : ssrLooseEqual(statusFilter.value, "archived")) ? " selected" : ""}>Archived</option><option value="resolved" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(statusFilter.value) ? ssrLooseContain(statusFilter.value, "resolved") : ssrLooseEqual(statusFilter.value, "resolved")) ? " selected" : ""}>Resolved</option></select></div><div data-v-6ae92920><label for="subject-type-filter" class="block text-sm font-medium text-gray-700 mb-1" data-v-6ae92920> Subject Type </label><select id="subject-type-filter" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-6ae92920><option value="all" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(subjectTypeFilter.value) ? ssrLooseContain(subjectTypeFilter.value, "all") : ssrLooseEqual(subjectTypeFilter.value, "all")) ? " selected" : ""}>All</option><option value="artwork" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(subjectTypeFilter.value) ? ssrLooseContain(subjectTypeFilter.value, "artwork") : ssrLooseEqual(subjectTypeFilter.value, "artwork")) ? " selected" : ""}>Artwork</option><option value="artist" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(subjectTypeFilter.value) ? ssrLooseContain(subjectTypeFilter.value, "artist") : ssrLooseEqual(subjectTypeFilter.value, "artist")) ? " selected" : ""}>Artist</option></select></div><div data-v-6ae92920><label for="issue-type-filter" class="block text-sm font-medium text-gray-700 mb-1" data-v-6ae92920> Issue Type </label><select id="issue-type-filter" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-6ae92920><option value="all" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(issueTypeFilter.value) ? ssrLooseContain(issueTypeFilter.value, "all") : ssrLooseEqual(issueTypeFilter.value, "all")) ? " selected" : ""}>All</option><option value="missing" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(issueTypeFilter.value) ? ssrLooseContain(issueTypeFilter.value, "missing") : ssrLooseEqual(issueTypeFilter.value, "missing")) ? " selected" : ""}>Missing</option><option value="incorrect_info" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(issueTypeFilter.value) ? ssrLooseContain(issueTypeFilter.value, "incorrect_info") : ssrLooseEqual(issueTypeFilter.value, "incorrect_info")) ? " selected" : ""}>Incorrect Info</option><option value="comment" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(issueTypeFilter.value) ? ssrLooseContain(issueTypeFilter.value, "comment") : ssrLooseEqual(issueTypeFilter.value, "comment")) ? " selected" : ""}>Comment</option><option value="other" data-v-6ae92920${ssrIncludeBooleanAttr(Array.isArray(issueTypeFilter.value) ? ssrLooseContain(issueTypeFilter.value, "other") : ssrLooseEqual(issueTypeFilter.value, "other")) ? " selected" : ""}>Other</option></select></div><div class="flex items-end" data-v-6ae92920><button class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-6ae92920> Refresh </button></div></div></div></div><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8" data-v-6ae92920>`);
      if (loading.value) {
        _push(`<div class="text-center py-12" data-v-6ae92920><svg class="animate-spin h-12 w-12 mx-auto mb-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-6ae92920><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-6ae92920></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-6ae92920></path></svg><p class="text-gray-600" data-v-6ae92920>Loading feedback...</p></div>`);
      } else if (error.value) {
        _push(`<div class="text-center py-12 bg-white rounded-lg shadow" data-v-6ae92920><svg class="w-16 h-16 mx-auto mb-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-6ae92920><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" data-v-6ae92920></path></svg><p class="text-gray-600 mb-4" data-v-6ae92920>${ssrInterpolate(error.value)}</p><button class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" data-v-6ae92920> Retry </button></div>`);
      } else if (filteredFeedback.value.length === 0) {
        _push(`<div class="text-center py-12 bg-white rounded-lg shadow" data-v-6ae92920><svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-6ae92920><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" data-v-6ae92920></path></svg><h3 class="text-lg font-semibold text-gray-900 mb-2" data-v-6ae92920>No Feedback Found</h3><p class="text-gray-600" data-v-6ae92920>${ssrInterpolate(statusFilter.value === "open" ? "All feedback has been reviewed!" : "No feedback matches the selected filters.")}</p></div>`);
      } else {
        _push(`<div class="space-y-4" data-v-6ae92920><!--[-->`);
        ssrRenderList(filteredFeedback.value, (item) => {
          _push(`<div class="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6" data-v-6ae92920><div class="flex items-start justify-between" data-v-6ae92920><div class="flex-1" data-v-6ae92920><div class="flex items-center gap-3 mb-3" data-v-6ae92920><span class="${ssrRenderClass([getStatusColor(item.status), "px-2 py-1 text-xs font-medium rounded"])}" data-v-6ae92920>${ssrInterpolate(item.status.toUpperCase())}</span><span class="text-sm text-gray-500" data-v-6ae92920>${ssrInterpolate(item.subject_type === "artwork" ? "🎨 Artwork" : "👤 Artist")}</span><span class="text-sm text-gray-500" data-v-6ae92920>•</span><span class="text-sm text-gray-500" data-v-6ae92920>${ssrInterpolate(getIssueTypeLabel(item.issue_type))}</span><span class="text-sm text-gray-500" data-v-6ae92920>•</span><span class="text-sm text-gray-500" data-v-6ae92920>${ssrInterpolate(formatDate(item.created_at))}</span></div><p class="text-gray-900 mb-3 whitespace-pre-wrap" data-v-6ae92920>${ssrInterpolate(item.note)}</p><div class="mb-3" data-v-6ae92920>`);
          _push(ssrRenderComponent(_component_router_link, {
            to: `/${item.subject_type}s/${item.subject_id}`,
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
          _push(`</div>`);
          if (item.reviewed_at) {
            _push(`<div class="mt-3 pt-3 border-t border-gray-200" data-v-6ae92920><p class="text-sm text-gray-600" data-v-6ae92920> Reviewed ${ssrInterpolate(formatDate(item.reviewed_at))} `);
            if (item.review_notes) {
              _push(`<span class="ml-2" data-v-6ae92920> - ${ssrInterpolate(item.review_notes)}</span>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</p></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
          if (item.status === "open") {
            _push(`<div class="flex flex-col gap-2 ml-4" data-v-6ae92920><button${ssrIncludeBooleanAttr(!!reviewingId.value) ? " disabled" : ""} class="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" data-v-6ae92920> Resolve </button><button${ssrIncludeBooleanAttr(!!reviewingId.value) ? " disabled" : ""} class="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" data-v-6ae92920> Archive </button></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div>`);
        });
        _push(`<!--]--></div>`);
      }
      if (!loading.value && filteredFeedback.value.length > 0) {
        _push(`<div class="mt-6 flex items-center justify-between bg-white rounded-lg shadow p-4" data-v-6ae92920><div class="text-sm text-gray-700" data-v-6ae92920> Showing ${ssrInterpolate((currentPage.value - 1) * perPage.value + 1)} to ${ssrInterpolate(Math.min(currentPage.value * perPage.value, total.value))} of ${ssrInterpolate(total.value)} feedback items </div><div class="flex gap-2" data-v-6ae92920><button${ssrIncludeBooleanAttr(currentPage.value === 1) ? " disabled" : ""} class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" data-v-6ae92920> Previous </button><button${ssrIncludeBooleanAttr(!hasMore.value) ? " disabled" : ""} class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" data-v-6ae92920> Next </button></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
      if (showReviewDialog.value) {
        _push(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-v-6ae92920><div class="w-full max-w-lg bg-white rounded-lg shadow-xl p-6" data-v-6ae92920><h3 class="text-xl font-semibold mb-3" data-v-6ae92920>${ssrInterpolate(reviewAction.value === "resolve" ? "Resolve Feedback" : "Archive Feedback")}</h3><p class="text-sm text-gray-600 mb-4" data-v-6ae92920>${ssrInterpolate(reviewAction.value === "resolve" ? "Mark this feedback as resolved. This indicates the issue has been addressed." : "Archive this feedback. This hides it from the queue without taking action.")}</p><div class="mb-4" data-v-6ae92920><label for="review-notes" class="block text-sm font-medium text-gray-700 mb-1" data-v-6ae92920> Review Notes (optional) </label><textarea id="review-notes" placeholder="Add any notes about your decision..." rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-6ae92920>${ssrInterpolate(reviewNotes.value)}</textarea></div><div class="flex justify-end gap-3" data-v-6ae92920><button${ssrIncludeBooleanAttr(!!reviewingId.value) ? " disabled" : ""} class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" data-v-6ae92920> Cancel </button><button${ssrIncludeBooleanAttr(!!reviewingId.value) ? " disabled" : ""} class="${ssrRenderClass([reviewAction.value === "resolve" ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700", "px-4 py-2 text-white rounded-md disabled:opacity-50 transition-colors"])}" data-v-6ae92920>${ssrInterpolate(reviewingId.value ? "Processing..." : reviewAction.value === "resolve" ? "Resolve" : "Archive")}</button></div></div></div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ModeratorFeedbackView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ModeratorFeedbackView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-6ae92920"]]);

export { ModeratorFeedbackView as default };
//# sourceMappingURL=ModeratorFeedbackView-Dup-T3Tv.js.map
