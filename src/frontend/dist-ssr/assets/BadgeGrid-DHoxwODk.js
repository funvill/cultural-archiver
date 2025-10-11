import { defineComponent, ref, computed, mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrInterpolate, ssrRenderList, ssrRenderComponent } from 'vue/server-renderer';
import { _ as _export_sfc } from '../ssr-entry-server.js';

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "BadgeCard",
  __ssrInlineRender: true,
  props: {
    badge: {},
    awardedAt: {},
    awardReason: {},
    metadata: {}
  },
  setup(__props) {
    const props = __props;
    const showDetails = ref(false);
    const tooltipText = computed(() => {
      return `${props.badge.title} - ${props.badge.description}. Earned: ${formatDate(props.awardedAt)}`;
    });
    const formatDate = (dateString) => {
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
      } catch (error) {
        return "Unknown date";
      }
    };
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: "badge-card group cursor-help",
        title: tooltipText.value
      }, _attrs))} data-v-83458b20><div class="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow duration-200" data-v-83458b20><div class="flex items-center justify-between mb-2" data-v-83458b20><div class="text-2xl" data-v-83458b20>${ssrInterpolate(_ctx.badge.icon_emoji)}</div>`);
      if (_ctx.badge.level > 1) {
        _push(`<div class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full" data-v-83458b20> Level ${ssrInterpolate(_ctx.badge.level)}</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div><h4 class="font-medium text-gray-900 text-sm mb-1 line-clamp-2" data-v-83458b20>${ssrInterpolate(_ctx.badge.title)}</h4><p class="text-xs text-gray-600 line-clamp-2 mb-2" data-v-83458b20>${ssrInterpolate(_ctx.badge.description)}</p><div class="text-xs text-gray-500" data-v-83458b20>${ssrInterpolate(formatDate(_ctx.awardedAt))}</div></div>`);
      if (showDetails.value) {
        _push(`<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-v-83458b20><div class="bg-white rounded-lg p-6 max-w-sm mx-4" data-v-83458b20><div class="flex items-center mb-4" data-v-83458b20><div class="text-4xl mr-3" data-v-83458b20>${ssrInterpolate(_ctx.badge.icon_emoji)}</div><div data-v-83458b20><h3 class="font-semibold text-lg text-gray-900" data-v-83458b20>${ssrInterpolate(_ctx.badge.title)}</h3><p class="text-sm text-gray-600" data-v-83458b20>${ssrInterpolate(_ctx.badge.category)} badge</p></div></div><p class="text-gray-700 mb-4" data-v-83458b20>${ssrInterpolate(_ctx.badge.description)}</p><div class="space-y-2 text-sm" data-v-83458b20><div class="flex justify-between" data-v-83458b20><span class="text-gray-600" data-v-83458b20>Earned:</span><span class="font-medium" data-v-83458b20>${ssrInterpolate(formatDate(_ctx.awardedAt))}</span></div><div class="flex justify-between" data-v-83458b20><span class="text-gray-600" data-v-83458b20>Reason:</span><span class="font-medium" data-v-83458b20>${ssrInterpolate(_ctx.awardReason)}</span></div>`);
        if (_ctx.badge.level > 1) {
          _push(`<div class="flex justify-between" data-v-83458b20><span class="text-gray-600" data-v-83458b20>Level:</span><span class="font-medium" data-v-83458b20>${ssrInterpolate(_ctx.badge.level)}</span></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><button class="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors" data-v-83458b20> Close </button></div></div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/BadgeCard.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const BadgeCard = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-83458b20"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "BadgeGrid",
  __ssrInlineRender: true,
  props: {
    badges: {},
    loading: { type: Boolean }
  },
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "badge-grid" }, _attrs))} data-v-c779fdb9><div class="flex items-center justify-between mb-4" data-v-c779fdb9><h3 class="text-lg font-semibold text-gray-900" data-v-c779fdb9> Badges `);
      if (_ctx.badges.length > 0) {
        _push(`<span class="text-sm font-normal text-gray-500 ml-2" data-v-c779fdb9> (${ssrInterpolate(_ctx.badges.length)}) </span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</h3></div>`);
      if (_ctx.badges.length > 0) {
        _push(`<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" data-v-c779fdb9><!--[-->`);
        ssrRenderList(_ctx.badges, (userBadge) => {
          _push(ssrRenderComponent(BadgeCard, mergeProps({
            key: userBadge.badge.id,
            badge: userBadge.badge,
            "awarded-at": userBadge.awarded_at,
            "award-reason": userBadge.award_reason
          }, { ref_for: true }, userBadge.metadata ? { metadata: userBadge.metadata } : {}), null, _parent));
        });
        _push(`<!--]--></div>`);
      } else {
        _push(`<div class="text-center py-8" data-v-c779fdb9><div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center" data-v-c779fdb9><svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-c779fdb9><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" data-v-c779fdb9></path></svg></div><h4 class="text-sm font-medium text-gray-900 mb-1" data-v-c779fdb9>No badges yet</h4><p class="text-sm text-gray-500" data-v-c779fdb9>Complete activities to earn your first badge!</p></div>`);
      }
      if (_ctx.loading) {
        _push(`<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" data-v-c779fdb9><!--[-->`);
        ssrRenderList(6, (i) => {
          _push(`<div class="animate-pulse" data-v-c779fdb9><div class="bg-gray-200 rounded-lg h-24 w-full" data-v-c779fdb9></div></div>`);
        });
        _push(`<!--]--></div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/BadgeGrid.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const BadgeGrid = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-c779fdb9"]]);

export { BadgeGrid as B };
//# sourceMappingURL=BadgeGrid-DHoxwODk.js.map
