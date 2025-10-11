import { defineComponent, ref, computed, onMounted, nextTick, onUnmounted, mergeProps, unref, useSSRContext, reactive, onBeforeUnmount, resolveComponent, withCtx, createVNode, createTextVNode } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderStyle, ssrRenderAttr, ssrIncludeBooleanAttr, ssrInterpolate } from 'vue/server-renderer';
import { useRoute, useRouter } from 'vue-router';
import { XMarkIcon, ArrowLeftIcon } from '@heroicons/vue/24/outline';
import { A as ArtistLookup } from './ArtistLookup-BaAyzORx.js';
import { M as MiniMap } from './MiniMap-_0n-xEQo.js';
import L from 'leaflet';
/* empty css                 */
import { _ as _export_sfc, j as createApiUrl } from '../ssr-entry-server.js';
import { _ as _sfc_main$2 } from './ConsentSection-COX2C32T.js';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/solid';

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "LocationPickerModal",
  __ssrInlineRender: true,
  props: {
    initialLat: {},
    initialLon: {}
  },
  emits: ["locationSelected", "close"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const mapContainer = ref();
    const map = ref();
    const marker = ref();
    const coordinates = ref({
      lat: props.initialLat || 49.2827,
      lon: props.initialLon || -123.1207
    });
    const isValidLocation = computed(() => {
      return !isNaN(coordinates.value.lat) && !isNaN(coordinates.value.lon) && Math.abs(coordinates.value.lat) <= 90 && Math.abs(coordinates.value.lon) <= 180;
    });
    onMounted(async () => {
      await nextTick();
      if (!mapContainer.value) {
        console.error("Map container not found");
        return;
      }
      setTimeout(() => {
        if (!mapContainer.value) return;
        try {
          map.value = L.map(mapContainer.value, {
            zoomControl: true
          }).setView([coordinates.value.lat, coordinates.value.lon], 15);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
          }).addTo(map.value);
          setTimeout(() => {
            if (map.value) {
              map.value.invalidateSize();
            }
          }, 100);
          setTimeout(() => {
            if (map.value) {
              map.value.invalidateSize();
            }
          }, 300);
          setTimeout(() => {
            if (map.value) {
              map.value.invalidateSize();
            }
          }, 500);
          const customIcon = L.divIcon({
            className: "custom-marker-icon",
            html: `
      <div style="position: relative;">
        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 26 16 26s16-17.163 16-26C32 7.163 24.837 0 16 0z" fill="#2563EB"/>
          <circle cx="16" cy="16" r="6" fill="white"/>
        </svg>
      </div>
    `,
            iconSize: [32, 42],
            iconAnchor: [16, 42]
          });
          marker.value = L.marker([coordinates.value.lat, coordinates.value.lon], {
            icon: customIcon,
            draggable: true
          }).addTo(map.value);
          marker.value.on("dragend", () => {
            if (!marker.value) return;
            const pos = marker.value.getLatLng();
            coordinates.value = { lat: pos.lat, lon: pos.lng };
          });
          map.value.on("click", (e) => {
            coordinates.value = { lat: e.latlng.lat, lon: e.latlng.lng };
            if (marker.value) {
              marker.value.setLatLng(e.latlng);
            }
          });
        } catch (error) {
          console.error("Error initializing map:", error);
        }
      }, 100);
    });
    onUnmounted(() => {
      if (map.value) {
        map.value.remove();
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" }, _attrs))} data-v-bdb4314f><div class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden" data-v-bdb4314f><div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700" data-v-bdb4314f><h3 class="text-xl font-semibold text-gray-900 dark:text-white" data-v-bdb4314f>Select Location</h3><button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Close" data-v-bdb4314f>`);
      _push(ssrRenderComponent(unref(XMarkIcon), { class: "w-6 h-6" }, null, _parent));
      _push(`</button></div><div class="relative" data-v-bdb4314f><div class="w-full h-96 bg-gray-100 dark:bg-gray-700" style="${ssrRenderStyle({ "height": "384px", "min-height": "384px" })}" data-v-bdb4314f></div></div><div class="p-6 border-t border-gray-200 dark:border-gray-700" data-v-bdb4314f><div class="grid grid-cols-2 gap-4 mb-4" data-v-bdb4314f><div data-v-bdb4314f><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" data-v-bdb4314f> Latitude </label><input${ssrRenderAttr("value", coordinates.value.lat)} type="number" step="0.000001" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white" data-v-bdb4314f></div><div data-v-bdb4314f><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" data-v-bdb4314f> Longitude </label><input${ssrRenderAttr("value", coordinates.value.lon)} type="number" step="0.000001" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white" data-v-bdb4314f></div></div><p class="text-sm text-gray-600 dark:text-gray-400 mb-4" data-v-bdb4314f> Drag the pin on the map or click to set the location. You can also enter coordinates manually above. </p><div class="flex justify-end space-x-3" data-v-bdb4314f><button class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700" data-v-bdb4314f> Cancel </button><button${ssrIncludeBooleanAttr(!isValidLocation.value) ? " disabled" : ""} class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium" data-v-bdb4314f> Update Location </button></div></div></div></div>`);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/FastWorkflow/LocationPickerModal.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const LocationPickerModal = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-bdb4314f"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ArtworkEditView",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    const router = useRouter();
    const id = String(route.params.id || "");
    const loading = ref(true);
    const submitting = ref(false);
    const artwork = reactive({});
    const showLocationPicker = ref(false);
    const isDirty = ref(false);
    const originalFormState = ref("");
    const consentCheckboxes = ref({
      cc0Licensing: false,
      termsAndGuidelines: false,
      photoRights: false
    });
    const allConsentsAccepted = computed(() => {
      return Object.values(consentCheckboxes.value).every(Boolean);
    });
    const form = reactive({
      title: "",
      description: "",
      artists: [],
      lat: 0,
      lon: 0
    });
    function handleBeforeUnload(e) {
      if (isDirty.value) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    const removeGuard = router.beforeEach((_to, from, next) => {
      if (isDirty.value && from.path.includes("/artwork/") && from.path.includes("/edit")) {
        const answer = window.confirm(
          "You have unsaved changes. Are you sure you want to leave this page?"
        );
        if (!answer) {
          next(false);
          return;
        }
      }
      next();
    });
    onBeforeUnmount(() => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (removeGuard) removeGuard();
    });
    onMounted(async () => {
      window.addEventListener("beforeunload", handleBeforeUnload);
      try {
        const res = await fetch(createApiUrl(`/artworks/${id}`));
        if (res.ok) {
          const response = await res.json();
          const data = response.data;
          Object.assign(artwork, data || {});
          form.title = data?.title || data?.tags_parsed?.title || "";
          if (data?.description && String(data.description).trim()) {
            form.description = data.description;
          } else if (data?.tags_parsed?.description && String(data.tags_parsed.description).trim()) {
            form.description = data.tags_parsed.description;
          } else if (data?.logbook_entries && data.logbook_entries.length > 0 && data.logbook_entries[0].notes) {
            form.description = data.logbook_entries[0].notes;
          } else {
            form.description = "";
          }
          if (Array.isArray(data?.artists) && data.artists.length > 0) {
            form.artists = data.artists.map((a) => ({ id: String(a.id), name: String(a.name || "Unknown") }));
          } else if (data?.tags_parsed?.artist_ids) {
            const idsRaw = data.tags_parsed.artist_ids;
            const ids = Array.isArray(idsRaw) ? idsRaw : String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
            form.artists = ids.map((aid) => ({ id: String(aid), name: String(aid) }));
          } else if (data?.tags_parsed?.artist) {
            form.artists = [{ id: "unknown", name: String(data.tags_parsed.artist) }];
          } else {
            form.artists = [];
          }
          form.lat = data?.lat || 0;
          form.lon = data?.lon || 0;
          originalFormState.value = JSON.stringify(form);
          const checkDirty = () => {
            isDirty.value = originalFormState.value !== JSON.stringify(form);
          };
          const interval = setInterval(checkDirty, 500);
          onBeforeUnmount(() => {
            clearInterval(interval);
          });
        }
      } catch (e) {
        console.error("Failed to load artwork", e);
      } finally {
        loading.value = false;
      }
    });
    function handleLocationSelected(lat, lon) {
      form.lat = lat;
      form.lon = lon;
      showLocationPicker.value = false;
    }
    function handleConsentChanged(consents) {
      consentCheckboxes.value = consents;
    }
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "max-w-3xl mx-auto p-4" }, _attrs))} data-v-5d9f9ced><div class="mb-4" data-v-5d9f9ced>`);
      _push(ssrRenderComponent(_component_router_link, {
        to: { name: "ArtworkDetail", params: { id: unref(id) } },
        class: "inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(ssrRenderComponent(unref(ArrowLeftIcon), { class: "w-4 h-4 mr-1" }, null, _parent2, _scopeId));
            _push2(` Back to Artwork `);
          } else {
            return [
              createVNode(unref(ArrowLeftIcon), { class: "w-4 h-4 mr-1" }),
              createTextVNode(" Back to Artwork ")
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div><h1 class="text-2xl font-semibold mb-6" data-v-5d9f9ced>Edit Artwork</h1>`);
      if (loading.value) {
        _push(`<div class="text-center py-8" data-v-5d9f9ced>Loading...</div>`);
      } else {
        _push(`<div class="bg-white shadow-md rounded-lg p-6" data-v-5d9f9ced><div class="mb-6" data-v-5d9f9ced><label class="block text-sm font-medium text-gray-700 mb-1" data-v-5d9f9ced>Title</label><input${ssrRenderAttr("value", form.title)} class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" maxlength="200" placeholder="Enter artwork title..." data-v-5d9f9ced><p class="text-xs text-gray-500 mt-1" data-v-5d9f9ced>Max 200 characters</p></div><div class="mb-6" data-v-5d9f9ced>`);
        _push(ssrRenderComponent(ArtistLookup, {
          modelValue: form.artists,
          "onUpdate:modelValue": ($event) => form.artists = $event
        }, null, _parent));
        _push(`</div><div class="mb-6" data-v-5d9f9ced><label class="block text-sm font-medium text-gray-700 mb-1" data-v-5d9f9ced>Description</label><details class="mb-2 text-xs text-gray-600" data-v-5d9f9ced><summary class="cursor-pointer hover:text-gray-800 font-medium" data-v-5d9f9ced>Markdown formatting tips</summary><ul class="mt-2 ml-4 space-y-1 font-mono bg-gray-50 p-2 rounded" data-v-5d9f9ced><li data-v-5d9f9ced><strong data-v-5d9f9ced>**bold**</strong> → <strong data-v-5d9f9ced>bold</strong></li><li data-v-5d9f9ced><em data-v-5d9f9ced>_italic_</em> → <em data-v-5d9f9ced>italic</em></li><li data-v-5d9f9ced># Heading 1, ## Heading 2</li><li data-v-5d9f9ced>* item for bullet lists</li><li data-v-5d9f9ced>[text](https://link) for links</li></ul></details><textarea class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" rows="12" maxlength="10000" placeholder="Describe the artwork, its history, significance, or any interesting details..." data-v-5d9f9ced>${ssrInterpolate(form.description)}</textarea><p class="text-xs text-gray-500 mt-1" data-v-5d9f9ced>Max 10000 characters</p></div><div class="mb-6" data-v-5d9f9ced><label class="block text-sm font-medium text-gray-700 mb-2" data-v-5d9f9ced>Location</label>`);
        if (form.lat !== 0 && form.lon !== 0) {
          _push(`<div class="mb-3" data-v-5d9f9ced>`);
          _push(ssrRenderComponent(MiniMap, {
            latitude: form.lat,
            longitude: form.lon,
            height: "300px",
            class: "rounded-md overflow-hidden border border-gray-300"
          }, null, _parent));
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-md border border-gray-200 mb-2" data-v-5d9f9ced><div class="text-sm" data-v-5d9f9ced><span class="font-medium text-gray-700" data-v-5d9f9ced>Coordinates:</span><span class="ml-2 text-gray-600" data-v-5d9f9ced>${ssrInterpolate(form.lat.toFixed(6))}, ${ssrInterpolate(form.lon.toFixed(6))}</span></div><button type="button" class="text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:underline" data-v-5d9f9ced> Select Location </button></div><p class="text-xs text-gray-500" data-v-5d9f9ced>Click &quot;Select Location&quot; to update the artwork&#39;s coordinates</p></div><div class="mb-6" data-v-5d9f9ced>`);
        _push(ssrRenderComponent(_sfc_main$2, {
          "consent-version": "1.0",
          onConsentChanged: handleConsentChanged
        }, null, _parent));
        _push(`</div><div class="flex items-center justify-between pt-4 border-t border-gray-200" data-v-5d9f9ced>`);
        _push(ssrRenderComponent(_component_router_link, {
          to: { name: "ArtworkDetail", params: { id: unref(id) } },
          class: "px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        }, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(` Cancel `);
            } else {
              return [
                createTextVNode(" Cancel ")
              ];
            }
          }),
          _: 1
        }, _parent));
        _push(`<button${ssrIncludeBooleanAttr(submitting.value || !form.title.trim() || !allConsentsAccepted.value) ? " disabled" : ""} class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-v-5d9f9ced>${ssrInterpolate(submitting.value ? "Saving..." : "Save Changes")}</button></div></div>`);
      }
      if (showLocationPicker.value) {
        _push(ssrRenderComponent(LocationPickerModal, {
          initialLat: form.lat,
          initialLon: form.lon,
          onClose: ($event) => showLocationPicker.value = false,
          onLocationSelected: handleLocationSelected
        }, null, _parent));
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ArtworkEditView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ArtworkEditView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-5d9f9ced"]]);

export { ArtworkEditView as default };
//# sourceMappingURL=ArtworkEditView-BR7ElDS7.js.map
