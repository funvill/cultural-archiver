import { defineComponent, ref, onMounted, withCtx, createVNode, createBlock, createCommentVNode, openBlock, Fragment, renderList, toDisplayString, useSSRContext } from 'vue';
import { ssrRenderComponent, ssrRenderList, ssrInterpolate, ssrRenderStyle } from 'vue/server-renderer';
import { useRoute } from 'vue-router';
import { r as AppShell, a as apiService, _ as _export_sfc } from '../ssr-entry-server.js';
import { B as BadgeGrid } from './BadgeGrid-DHoxwODk.js';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "PublicProfileView",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    const profile = ref(null);
    const isLoading = ref(true);
    const error = ref("");
    const formatDate = (dateString) => {
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        });
      } catch (error2) {
        return "Unknown date";
      }
    };
    const loadProfile = async () => {
      const uuid = route.params.uuid;
      if (!uuid) {
        error.value = "Invalid profile URL";
        isLoading.value = false;
        return;
      }
      try {
        isLoading.value = true;
        const response = await apiService.getPublicUserProfile(uuid);
        if (response.success && response.data) {
          profile.value = response.data;
        } else {
          error.value = response.error || "Failed to load profile";
        }
      } catch (err) {
        console.error("Failed to load public profile:", err);
        if (err.status === 404) {
          error.value = "This user profile is not available or does not exist.";
        } else {
          error.value = err.message || "Failed to load profile";
        }
      } finally {
        isLoading.value = false;
      }
    };
    onMounted(() => {
      loadProfile();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(ssrRenderComponent(AppShell, _attrs, {
        header: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<div class="flex items-center space-x-4" data-v-80f19297${_scopeId}><button class="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Go back" data-v-80f19297${_scopeId}><svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-80f19297${_scopeId}><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" data-v-80f19297${_scopeId}></path></svg></button><h1 class="text-xl font-semibold text-gray-900" data-v-80f19297${_scopeId}>${ssrInterpolate(profile.value?.profile_name || "User Profile")}</h1></div>`);
          } else {
            return [
              createVNode("div", { class: "flex items-center space-x-4" }, [
                createVNode("button", {
                  onClick: ($event) => _ctx.$router.go(-1),
                  class: "p-2 hover:bg-gray-100 rounded-lg transition-colors",
                  title: "Go back"
                }, [
                  (openBlock(), createBlock("svg", {
                    class: "w-5 h-5 text-gray-600",
                    fill: "none",
                    stroke: "currentColor",
                    viewBox: "0 0 24 24"
                  }, [
                    createVNode("path", {
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round",
                      "stroke-width": "2",
                      d: "M15 19l-7-7 7-7"
                    })
                  ]))
                ], 8, ["onClick"]),
                createVNode("h1", { class: "text-xl font-semibold text-gray-900" }, toDisplayString(profile.value?.profile_name || "User Profile"), 1)
              ])
            ];
          }
        }),
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<div class="max-w-4xl mx-auto px-4 py-6" data-v-80f19297${_scopeId}>`);
            if (isLoading.value) {
              _push2(`<div class="space-y-6" data-v-80f19297${_scopeId}><div class="animate-pulse" data-v-80f19297${_scopeId}><div class="bg-white rounded-lg shadow p-6 mb-6" data-v-80f19297${_scopeId}><div class="flex items-center space-x-4" data-v-80f19297${_scopeId}><div class="w-16 h-16 bg-gray-200 rounded-full" data-v-80f19297${_scopeId}></div><div class="space-y-2" data-v-80f19297${_scopeId}><div class="h-6 bg-gray-200 rounded w-48" data-v-80f19297${_scopeId}></div><div class="h-4 bg-gray-200 rounded w-32" data-v-80f19297${_scopeId}></div></div></div></div><div class="bg-white rounded-lg shadow p-6" data-v-80f19297${_scopeId}><div class="h-6 bg-gray-200 rounded w-32 mb-4" data-v-80f19297${_scopeId}></div><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" data-v-80f19297${_scopeId}><!--[-->`);
              ssrRenderList(6, (i) => {
                _push2(`<div class="h-24 bg-gray-200 rounded-lg" data-v-80f19297${_scopeId}></div>`);
              });
              _push2(`<!--]--></div></div></div></div>`);
            } else if (error.value) {
              _push2(`<div class="text-center py-12" data-v-80f19297${_scopeId}><div class="w-16 h-16 mx-auto mb-4 rounded-full theme-error-container flex items-center justify-center" data-v-80f19297${_scopeId}><svg class="w-8 h-8 theme-error" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-80f19297${_scopeId}><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" data-v-80f19297${_scopeId}></path></svg></div><h2 class="text-lg font-medium text-gray-900 mb-2" data-v-80f19297${_scopeId}>Profile not found</h2><p class="text-gray-600 mb-4" data-v-80f19297${_scopeId}>${ssrInterpolate(error.value)}</p><button class="theme-primary theme-on-primary font-medium py-2 px-4 rounded-lg transition-colors" data-v-80f19297${_scopeId}> Return Home </button></div>`);
            } else if (profile.value) {
              _push2(`<div class="space-y-6" data-v-80f19297${_scopeId}><div class="bg-white rounded-lg shadow p-6" data-v-80f19297${_scopeId}><div class="flex items-center space-x-4" data-v-80f19297${_scopeId}><div class="w-16 h-16 theme-primary-container rounded-full flex items-center justify-center" data-v-80f19297${_scopeId}><span class="text-2xl font-semibold" style="${ssrRenderStyle({ "color": "rgb(var(--md-primary))" })}" data-v-80f19297${_scopeId}>${ssrInterpolate(profile.value.profile_name.charAt(0).toUpperCase())}</span></div><div data-v-80f19297${_scopeId}><h2 class="text-2xl font-bold text-gray-900" data-v-80f19297${_scopeId}>${ssrInterpolate(profile.value.profile_name)}</h2><p class="text-gray-600" data-v-80f19297${_scopeId}>Member since ${ssrInterpolate(formatDate(profile.value.member_since))}</p><div class="flex items-center space-x-4 mt-2 text-sm text-gray-500" data-v-80f19297${_scopeId}><span data-v-80f19297${_scopeId}>${ssrInterpolate(profile.value.badges.length)} badges earned</span></div></div></div></div><div class="bg-white rounded-lg shadow p-6" data-v-80f19297${_scopeId}>`);
              _push2(ssrRenderComponent(BadgeGrid, {
                badges: profile.value.badges,
                loading: false
              }, null, _parent2, _scopeId));
              _push2(`</div></div>`);
            } else {
              _push2(`<!---->`);
            }
            _push2(`</div>`);
          } else {
            return [
              createVNode("div", { class: "max-w-4xl mx-auto px-4 py-6" }, [
                isLoading.value ? (openBlock(), createBlock("div", {
                  key: 0,
                  class: "space-y-6"
                }, [
                  createVNode("div", { class: "animate-pulse" }, [
                    createVNode("div", { class: "bg-white rounded-lg shadow p-6 mb-6" }, [
                      createVNode("div", { class: "flex items-center space-x-4" }, [
                        createVNode("div", { class: "w-16 h-16 bg-gray-200 rounded-full" }),
                        createVNode("div", { class: "space-y-2" }, [
                          createVNode("div", { class: "h-6 bg-gray-200 rounded w-48" }),
                          createVNode("div", { class: "h-4 bg-gray-200 rounded w-32" })
                        ])
                      ])
                    ]),
                    createVNode("div", { class: "bg-white rounded-lg shadow p-6" }, [
                      createVNode("div", { class: "h-6 bg-gray-200 rounded w-32 mb-4" }),
                      createVNode("div", { class: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" }, [
                        (openBlock(), createBlock(Fragment, null, renderList(6, (i) => {
                          return createVNode("div", {
                            key: i,
                            class: "h-24 bg-gray-200 rounded-lg"
                          });
                        }), 64))
                      ])
                    ])
                  ])
                ])) : error.value ? (openBlock(), createBlock("div", {
                  key: 1,
                  class: "text-center py-12"
                }, [
                  createVNode("div", { class: "w-16 h-16 mx-auto mb-4 rounded-full theme-error-container flex items-center justify-center" }, [
                    (openBlock(), createBlock("svg", {
                      class: "w-8 h-8 theme-error",
                      fill: "none",
                      stroke: "currentColor",
                      viewBox: "0 0 24 24"
                    }, [
                      createVNode("path", {
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "stroke-width": "2",
                        d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                      })
                    ]))
                  ]),
                  createVNode("h2", { class: "text-lg font-medium text-gray-900 mb-2" }, "Profile not found"),
                  createVNode("p", { class: "text-gray-600 mb-4" }, toDisplayString(error.value), 1),
                  createVNode("button", {
                    onClick: ($event) => _ctx.$router.push("/"),
                    class: "theme-primary theme-on-primary font-medium py-2 px-4 rounded-lg transition-colors"
                  }, " Return Home ", 8, ["onClick"])
                ])) : profile.value ? (openBlock(), createBlock("div", {
                  key: 2,
                  class: "space-y-6"
                }, [
                  createVNode("div", { class: "bg-white rounded-lg shadow p-6" }, [
                    createVNode("div", { class: "flex items-center space-x-4" }, [
                      createVNode("div", { class: "w-16 h-16 theme-primary-container rounded-full flex items-center justify-center" }, [
                        createVNode("span", {
                          class: "text-2xl font-semibold",
                          style: { "color": "rgb(var(--md-primary))" }
                        }, toDisplayString(profile.value.profile_name.charAt(0).toUpperCase()), 1)
                      ]),
                      createVNode("div", null, [
                        createVNode("h2", { class: "text-2xl font-bold text-gray-900" }, toDisplayString(profile.value.profile_name), 1),
                        createVNode("p", { class: "text-gray-600" }, "Member since " + toDisplayString(formatDate(profile.value.member_since)), 1),
                        createVNode("div", { class: "flex items-center space-x-4 mt-2 text-sm text-gray-500" }, [
                          createVNode("span", null, toDisplayString(profile.value.badges.length) + " badges earned", 1)
                        ])
                      ])
                    ])
                  ]),
                  createVNode("div", { class: "bg-white rounded-lg shadow p-6" }, [
                    createVNode(BadgeGrid, {
                      badges: profile.value.badges,
                      loading: false
                    }, null, 8, ["badges"])
                  ])
                ])) : createCommentVNode("", true)
              ])
            ];
          }
        }),
        _: 1
      }, _parent));
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/PublicProfileView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const PublicProfileView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-80f19297"]]);

export { PublicProfileView as default };
//# sourceMappingURL=PublicProfileView-_H5hRzxa.js.map
