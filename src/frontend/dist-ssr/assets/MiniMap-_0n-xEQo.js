import { defineComponent, ref, computed, watch, onMounted, nextTick, onUnmounted, mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderStyle, ssrRenderAttr, ssrInterpolate } from 'vue/server-renderer';
import { e as createLogger, _ as _export_sfc } from '../ssr-entry-server.js';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "MiniMap",
  __ssrInlineRender: true,
  props: {
    latitude: {},
    longitude: {},
    zoom: { default: 16 },
    height: { default: "200px" },
    title: { default: "Artwork location" },
    showZoomControls: { type: Boolean, default: true },
    showDirectionsLink: { type: Boolean, default: true }
  },
  emits: ["mapReady", "markerClick"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const log = createLogger({ module: "frontend:MiniMap" });
    const mapContainer = ref();
    const map = ref();
    const marker = ref();
    const isLoading = ref(true);
    const hasError = ref(false);
    let resizeObserver = null;
    let initializing = false;
    const safeInvalidate = (m) => {
      try {
        if (m && typeof m.invalidateSize === "function") {
          m.invalidateSize();
        }
      } catch (err) {
      }
    };
    const directionsUrl = computed(() => {
      return `https://www.google.com/maps?q=${props.latitude},${props.longitude}`;
    });
    async function initializeMap() {
      if (!mapContainer.value) return;
      if (map.value) return;
      if (initializing) return;
      initializing = true;
      try {
        isLoading.value = true;
        hasError.value = false;
        const imported = await import('leaflet');
        const L = imported && imported.default ? imported.default : imported;
        if (!L || typeof L.map !== "function") {
          log.error("Leaflet API missing required map function", {
            hasMap: !!(L && L.map)
          });
          hasError.value = true;
          isLoading.value = false;
          return;
        }
        const hasDivIcon = typeof L.divIcon === "function";
        if (!hasDivIcon) {
          log.warn("Leaflet divIcon missing, using fallback");
          L.divIcon = (options) => ({ options });
        }
        try {
          const prev = mapContainer.value.__mini_map_inner_current;
          if (prev && mapContainer.value.contains(prev)) {
            try {
              prev.remove();
            } catch (err) {
            }
          }
        } catch (err) {
        }
        const inner = document.createElement("div");
        inner.className = "mini-map-inner";
        inner.style.width = "100%";
        inner.style.height = "100%";
        inner.style.position = "relative";
        mapContainer.value.appendChild(inner);
        mapContainer.value.__mini_map_inner_current = inner;
        const mapInstance = L.map(inner, {
          zoomControl: false,
          scrollWheelZoom: false,
          doubleClickZoom: true,
          touchZoom: true,
          keyboard: true,
          attributionControl: true
        }).setView([props.latitude, props.longitude], props.zoom);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19
        }).addTo(mapInstance);
        const pinSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#ef4444" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="white"/>
      </svg>
    `;
        const icon = L.divIcon({
          className: "mini-map-pin",
          html: pinSvg,
          iconSize: [28, 28],
          iconAnchor: [14, 28]
        });
        const markerInstance = L.marker([props.latitude, props.longitude], { icon }).addTo(mapInstance).bindPopup(props.title);
        map.value = mapInstance;
        marker.value = markerInstance;
        try {
          mapContainer.value.getBoundingClientRect();
        } catch (err) {
        }
        const safeInvalidate2 = (m) => {
          try {
            if (m && typeof m.invalidateSize === "function") {
              m.invalidateSize();
            }
          } catch (err) {
          }
        };
        try {
          safeInvalidate2(mapInstance);
          requestAnimationFrame(() => safeInvalidate2(mapInstance));
          setTimeout(() => safeInvalidate2(mapInstance), 250);
          setTimeout(() => safeInvalidate2(mapInstance), 1e3);
        } catch (err) {
        }
        if (props.showZoomControls) {
          try {
            if (L && L.control && typeof L.control.zoom === "function") {
              L.control.zoom({ position: "topright" }).addTo(mapInstance);
            }
          } catch (err) {
            log.warn("Could not add zoom control", { error: err });
          }
        }
        emit("mapReady", mapInstance);
        markerInstance.on("click", () => {
          emit("markerClick", { lat: props.latitude, lng: props.longitude });
        });
        isLoading.value = false;
      } catch (error) {
        log.error("Failed to initialize map", { error });
        hasError.value = true;
        isLoading.value = false;
      } finally {
        initializing = false;
      }
    }
    async function updateMapLocation() {
      if (!map.value || !marker.value) return;
      const L = await import('leaflet');
      const newLatLng = L.latLng(props.latitude, props.longitude);
      map.value.setView(newLatLng, props.zoom);
      marker.value.setLatLng(newLatLng);
      marker.value.bindPopup(props.title).openPopup();
    }
    watch(
      [() => props.latitude, () => props.longitude, () => props.zoom],
      () => {
        if (map.value) {
          updateMapLocation();
        }
      },
      { deep: true }
    );
    watch(
      () => props.title,
      (newTitle) => {
        if (marker.value) {
          marker.value.bindPopup(newTitle);
        }
      }
    );
    onMounted(async () => {
      await nextTick();
      await initializeMap();
    });
    function handleWindowResize() {
      try {
        safeInvalidate(map.value);
      } catch (err) {
      }
    }
    onMounted(() => {
      window.addEventListener("resize", handleWindowResize);
      try {
        if (typeof ResizeObserver !== "undefined" && mapContainer.value) {
          resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
              const rect = entry.contentRect;
              if (rect.width > 0 && rect.height > 0) {
                try {
                  if (!map.value && !initializing) {
                    initializeMap().catch(() => {
                    });
                  } else {
                    safeInvalidate(map.value);
                  }
                } catch (err) {
                }
              }
            }
          });
          resizeObserver.observe(mapContainer.value);
        }
      } catch (err) {
      }
    });
    onUnmounted(() => {
      if (map.value) {
        map.value.remove();
      }
      try {
        window.removeEventListener("resize", handleWindowResize);
      } catch (err) {
      }
      try {
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
      } catch (err) {
      }
    });
    Promise.resolve({            });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "mini-map" }, _attrs))} data-v-8b8cc665><div class="relative rounded-lg overflow-hidden border border-gray-200" data-v-8b8cc665>`);
      if (isLoading.value) {
        _push(`<div class="absolute inset-0 flex items-center justify-center bg-gray-100 z-10" style="${ssrRenderStyle({ height: props.height })}" data-v-8b8cc665><div class="text-center" data-v-8b8cc665><svg class="animate-spin h-8 w-8 mx-auto mb-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-8b8cc665><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-8b8cc665></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-8b8cc665></path></svg><p class="text-sm text-gray-600" data-v-8b8cc665>Loading map...</p></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (hasError.value) {
        _push(`<div class="absolute inset-0 flex items-center justify-center bg-gray-100 z-10" style="${ssrRenderStyle({ height: props.height })}" data-v-8b8cc665><div class="text-center text-gray-600" data-v-8b8cc665><svg class="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-8b8cc665><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" data-v-8b8cc665></path></svg><p class="text-sm" data-v-8b8cc665>Failed to load map</p></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="w-full focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation" style="${ssrRenderStyle({ height: props.height })}" tabindex="0" role="application"${ssrRenderAttr("aria-label", `Interactive map showing ${props.title} at coordinates ${props.latitude}, ${props.longitude}`)} data-v-8b8cc665></div></div><div class="mt-2 sm:mt-3" data-v-8b8cc665><div class="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-600" data-v-8b8cc665>`);
      if (_ctx.showDirectionsLink) {
        _push(`<a${ssrRenderAttr("href", directionsUrl.value)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-3 py-2 sm:px-2 sm:py-1 bg-white/0" style="${ssrRenderStyle({ "font-weight": "600" })}" data-v-8b8cc665><span class="text-sm sm:text-xs mr-2" data-v-8b8cc665>Get directions to</span><span class="truncate mr-2 text-sm sm:text-xs" data-v-8b8cc665>${ssrInterpolate((props.latitude || 0).toFixed(6))}, ${ssrInterpolate((props.longitude || 0).toFixed(6))}</span><svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" data-v-8b8cc665><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" data-v-8b8cc665></path></svg></a>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div></div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/MiniMap.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const MiniMap = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-8b8cc665"]]);

export { MiniMap as M };
//# sourceMappingURL=MiniMap-_0n-xEQo.js.map
