import { defineComponent, ref, computed, onMounted, onUnmounted, watch, mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderStyle, ssrRenderClass, ssrInterpolate, ssrIncludeBooleanAttr, ssrRenderList, ssrRenderAttr } from 'vue/server-renderer';
import { u as useNotificationsStore, k as isBadgeNotificationMetadata, _ as _export_sfc } from '../ssr-entry-server.js';
import '@vue/server-renderer';
import 'vue-router';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';

const itemsPerPage = 20;
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ProfileNotificationsView",
  __ssrInlineRender: true,
  setup(__props) {
    const notificationsStore = useNotificationsStore();
    const filterType = ref("all");
    const currentPage = ref(1);
    const isMarkingAllRead = ref(false);
    const notifications = computed(() => notificationsStore.notifications);
    const unreadCount = computed(() => notificationsStore.unreadCount);
    const isLoading = computed(() => notificationsStore.isLoading);
    const error = computed(() => notificationsStore.error);
    const filteredNotifications = computed(() => {
      let filtered = notifications.value;
      switch (filterType.value) {
        case "unread":
          filtered = filtered.filter((n) => !n.is_dismissed);
          break;
        case "badge":
          filtered = filtered.filter((n) => n.type === "badge");
          break;
      }
      return filtered;
    });
    const totalCount = computed(() => filteredNotifications.value.length);
    const totalPages = computed(() => Math.ceil(totalCount.value / itemsPerPage));
    const startIndex = computed(() => (currentPage.value - 1) * itemsPerPage);
    const endIndex = computed(() => Math.min(startIndex.value + itemsPerPage, totalCount.value));
    const paginatedNotifications = computed(
      () => filteredNotifications.value.slice(startIndex.value, endIndex.value)
    );
    async function refreshNotifications() {
      try {
        await notificationsStore.fetchNotifications({ limit: 100, offset: 0 });
        await notificationsStore.fetchUnreadCount();
      } catch (err) {
        console.error("Failed to refresh notifications:", err);
      }
    }
    function getBadgeEmoji(notification) {
      if (notification.type === "badge" && notification.metadata && isBadgeNotificationMetadata(notification.metadata)) {
        return notification.metadata.badge_icon_emoji || "🏆";
      }
      return "🏆";
    }
    function formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      const now = /* @__PURE__ */ new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
      if (diffDays === 0) {
        return "Today";
      } else if (diffDays === 1) {
        return "Yesterday";
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    }
    onMounted(() => {
      notificationsStore.startPolling();
      refreshNotifications();
    });
    onUnmounted(() => {
      notificationsStore.stopPolling();
    });
    function resetPagination() {
      currentPage.value = 1;
    }
    watch(filterType, () => resetPagination());
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "profile-notifications-view p-4 sm:p-6 lg:p-8" }, _attrs))} data-v-e8cb9118><header class="mb-8" data-v-e8cb9118><h1 class="text-3xl font-bold tracking-tight" style="${ssrRenderStyle({ color: "rgb(var(--md-on-background))" })}" data-v-e8cb9118>Notifications</h1><p class="mt-2 text-lg" style="${ssrRenderStyle({ color: "rgba(var(--md-on-background), 0.8)" })}" data-v-e8cb9118> View and manage your notification history </p></header><div class="mb-6 flex flex-wrap items-center justify-between gap-4" data-v-e8cb9118><div class="flex items-center space-x-4" data-v-e8cb9118><button class="${ssrRenderClass([
        "px-3 py-2 rounded-md text-sm font-medium transition-colors",
        filterType.value === "all" ? "theme-primary-container theme-on-primary-container" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      ])}" data-v-e8cb9118> All (${ssrInterpolate(totalCount.value)}) </button><button class="${ssrRenderClass([
        "px-3 py-2 rounded-md text-sm font-medium transition-colors",
        filterType.value === "unread" ? "theme-primary-container theme-on-primary-container" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      ])}" data-v-e8cb9118> Unread (${ssrInterpolate(unreadCount.value)}) </button><button class="${ssrRenderClass([
        "px-3 py-2 rounded-md text-sm font-medium transition-colors",
        filterType.value === "badge" ? "theme-primary-container theme-on-primary-container" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      ])}" data-v-e8cb9118> Badges </button></div><div class="flex items-center space-x-2" data-v-e8cb9118>`);
      if (unreadCount.value > 0) {
        _push(`<button class="px-4 py-2 rounded-md text-sm font-medium transition-colors"${ssrIncludeBooleanAttr(isMarkingAllRead.value) ? " disabled" : ""} style="${ssrRenderStyle({ background: "rgb(var(--md-primary))", color: "rgb(var(--md-on-primary))" })}" data-v-e8cb9118>`);
        if (isMarkingAllRead.value) {
          _push(`<span class="inline-flex items-center" data-v-e8cb9118><svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" data-v-e8cb9118><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-e8cb9118></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-e8cb9118></path></svg> Marking... </span>`);
        } else {
          _push(`<span data-v-e8cb9118>Mark all as read</span>`);
        }
        _push(`</button>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<button class="p-2 transition-colors"${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} aria-label="Refresh notifications" style="${ssrRenderStyle({ color: "rgb(var(--md-on-background))" })}" data-v-e8cb9118><svg class="${ssrRenderClass(["w-5 h-5", { "animate-spin": isLoading.value }])}" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-e8cb9118><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" data-v-e8cb9118></path></svg></button></div></div>`);
      if (isLoading.value && notifications.value.length === 0) {
        _push(`<div class="space-y-4" data-v-e8cb9118><!--[-->`);
        ssrRenderList(5, (i) => {
          _push(`<div class="animate-pulse" data-v-e8cb9118><div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow border border-gray-200 dark:border-gray-700" data-v-e8cb9118><div class="flex items-start space-x-4" data-v-e8cb9118><div class="rounded-full bg-gray-300 dark:bg-gray-600 h-12 w-12" data-v-e8cb9118></div><div class="flex-1 space-y-2" data-v-e8cb9118><div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4" data-v-e8cb9118></div><div class="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2" data-v-e8cb9118></div><div class="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/4" data-v-e8cb9118></div></div></div></div></div>`);
        });
        _push(`<!--]--></div>`);
      } else if (error.value) {
        _push(`<div class="theme-error-container border border-red-200 dark:border-red-800 rounded-lg p-6" data-v-e8cb9118><div class="flex" data-v-e8cb9118><svg class="h-5 w-5 theme-error" fill="currentColor" viewBox="0 0 20 20" data-v-e8cb9118><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" data-v-e8cb9118></path></svg><div class="ml-3" data-v-e8cb9118><h3 class="text-sm font-medium theme-on-error-container" data-v-e8cb9118> Error loading notifications </h3><p class="mt-1 text-sm theme-on-error-container" data-v-e8cb9118>${ssrInterpolate(error.value)}</p><div class="mt-4" data-v-e8cb9118><button class="text-sm theme-error theme-on-error px-3 py-2 rounded-md transition-colors" data-v-e8cb9118> Try again </button></div></div></div></div>`);
      } else if (filteredNotifications.value.length === 0 && !isLoading.value) {
        _push(`<div class="text-center py-12" data-v-e8cb9118><svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-e8cb9118><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" data-v-e8cb9118></path></svg><h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white" data-v-e8cb9118>${ssrInterpolate(filterType.value === "unread" ? "No unread notifications" : "No notifications yet")}</h3><p class="mt-1 text-sm text-gray-500 dark:text-gray-400" data-v-e8cb9118>${ssrInterpolate(filterType.value === "unread" ? "All caught up! Check back later for new notifications." : "When you earn badges or receive updates, they'll appear here.")}</p></div>`);
      } else {
        _push(`<div class="space-y-4" data-v-e8cb9118><!--[-->`);
        ssrRenderList(paginatedNotifications.value, (notification) => {
          _push(`<div class="${ssrRenderClass([
            "bg-white dark:bg-gray-800 rounded-lg p-6 shadow border transition-colors cursor-pointer",
            notification.is_dismissed ? "border-gray-200 dark:border-gray-700" : "theme-primary-container border-blue-200 dark:border-blue-800"
          ])}" data-v-e8cb9118><div class="flex items-start space-x-4" data-v-e8cb9118><div class="flex-shrink-0" data-v-e8cb9118>`);
          if (notification.type === "badge") {
            _push(`<div class="w-12 h-12 theme-warning-container rounded-full flex items-center justify-center" data-v-e8cb9118><span class="text-2xl" data-v-e8cb9118>${ssrInterpolate(getBadgeEmoji(notification))}</span></div>`);
          } else if (notification.type === "system") {
            _push(`<div class="w-12 h-12 theme-primary-container rounded-full flex items-center justify-center" data-v-e8cb9118><svg class="w-6 h-6 theme-on-primary-container" fill="currentColor" viewBox="0 0 20 20" data-v-e8cb9118><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" data-v-e8cb9118></path></svg></div>`);
          } else {
            _push(`<div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center" data-v-e8cb9118><svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20" data-v-e8cb9118><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" data-v-e8cb9118></path></svg></div>`);
          }
          _push(`</div><div class="flex-1 min-w-0" data-v-e8cb9118><div class="flex items-start justify-between" data-v-e8cb9118><div class="flex-1" data-v-e8cb9118><h3 class="text-lg font-semibold text-gray-900 dark:text-white" data-v-e8cb9118>${ssrInterpolate(notification.title)}</h3>`);
          if (notification.message) {
            _push(`<p class="text-gray-600 dark:text-gray-400 mt-1" data-v-e8cb9118>${ssrInterpolate(notification.message)}</p>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<div class="flex items-center space-x-4 mt-3 text-sm text-gray-500 dark:text-gray-400" data-v-e8cb9118><span data-v-e8cb9118>${ssrInterpolate(formatTimestamp(notification.created_at))}</span>`);
          if (notification.type === "badge") {
            _push(`<span class="flex items-center" data-v-e8cb9118><svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" data-v-e8cb9118><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" data-v-e8cb9118></path></svg> Badge earned </span>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></div><div class="flex items-center space-x-2 ml-4" data-v-e8cb9118>`);
          if (!notification.is_dismissed) {
            _push(`<div class="w-3 h-3 theme-primary rounded-full" aria-label="Unread" data-v-e8cb9118></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<button class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"${ssrRenderAttr("aria-label", `Dismiss ${notification.title}`)} data-v-e8cb9118><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" data-v-e8cb9118><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" data-v-e8cb9118></path></svg></button></div></div></div></div></div>`);
        });
        _push(`<!--]--></div>`);
      }
      if (totalPages.value > 1) {
        _push(`<div class="mt-8 flex items-center justify-between" data-v-e8cb9118><div class="text-sm text-gray-700 dark:text-gray-300" data-v-e8cb9118> Showing ${ssrInterpolate(startIndex.value + 1)} to ${ssrInterpolate(Math.min(startIndex.value + itemsPerPage, totalCount.value))} of ${ssrInterpolate(totalCount.value)} notifications </div><div class="flex items-center space-x-2" data-v-e8cb9118><button${ssrIncludeBooleanAttr(currentPage.value === 1) ? " disabled" : ""} class="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" data-v-e8cb9118> Previous </button><span class="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white" data-v-e8cb9118> Page ${ssrInterpolate(currentPage.value)} of ${ssrInterpolate(totalPages.value)}</span><button${ssrIncludeBooleanAttr(currentPage.value === totalPages.value) ? " disabled" : ""} class="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" data-v-e8cb9118> Next </button></div></div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ProfileNotificationsView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ProfileNotificationsView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-e8cb9118"]]);

export { ProfileNotificationsView as default };
//# sourceMappingURL=ProfileNotificationsView-DczcGPhE.js.map
