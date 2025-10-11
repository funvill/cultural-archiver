import { defineComponent, ref, computed, onMounted, onUnmounted, mergeProps, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrInterpolate, ssrRenderClass, ssrRenderStyle, ssrRenderList, ssrIncludeBooleanAttr } from 'vue/server-renderer';
import { u as useNotificationsStore, i as isClient, g as getApiBaseUrl, a as apiService, b as getErrorMessage, c as canUseLocalStorage, _ as _export_sfc } from '../ssr-entry-server.js';
import '@vue/server-renderer';
import 'vue-router';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "StatusView",
  __ssrInlineRender: true,
  setup(__props) {
    const isLoading = ref(true);
    const status = ref("");
    const stats = ref(null);
    const healthData = ref(null);
    const error = ref("");
    const isConfettiActive = ref(false);
    const confettiCanvas = ref(null);
    const apiBaseUrl = getApiBaseUrl();
    const buildDate = (/* @__PURE__ */ new Date()).toISOString();
    const environment = "production";
    useNotificationsStore();
    computed(() => {
      if (!isClient) return true;
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (e) {
        return true;
      }
    });
    const confettiParticles = ref([]);
    const checkSystemHealth = async () => {
      try {
        const statusResponse = await apiService.getStatus();
        status.value = statusResponse.message || "API connected successfully";
        try {
          const statsResponse = await apiService.getReviewStats();
          stats.value = statsResponse.data;
        } catch (statsError) {
          console.warn("Failed to fetch stats:", statsError);
        }
        healthData.value = {
          apiConnected: true,
          buildDate,
          apiBaseUrl,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      } catch (err) {
        status.value = `API connection failed: ${getErrorMessage(err)}`;
        error.value = getErrorMessage(err);
        healthData.value = {
          apiConnected: false,
          buildDate,
          apiBaseUrl,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        console.warn("API status check failed:", err);
      } finally {
        isLoading.value = false;
      }
    };
    function stopConfetti() {
      isConfettiActive.value = false;
      confettiParticles.value = [];
      if (confettiCanvas.value) {
        if (isClient) document.body.removeChild(confettiCanvas.value);
        confettiCanvas.value = null;
      }
    }
    function handleResize() {
      if (!isClient) return;
      if (confettiCanvas.value) {
        confettiCanvas.value.width = window.innerWidth;
        confettiCanvas.value.height = window.innerHeight;
      }
    }
    const geoSupported = typeof navigator !== "undefined" && "geolocation" in navigator;
    const position = ref(null);
    const geoError = ref(null);
    const geoLoading = ref(false);
    const geoPermissionState = ref(null);
    function formatCoords(pos) {
      if (!pos) return null;
      return {
        lat: pos.coords.latitude.toFixed(6),
        lon: pos.coords.longitude.toFixed(6),
        accuracy: `${pos.coords.accuracy} m`,
        timestamp: new Date(pos.timestamp).toLocaleString()
      };
    }
    async function updateGeoPermissionState() {
      try {
        if (typeof navigator !== "undefined" && navigator.permissions && navigator.permissions.query) {
          const perm = await navigator.permissions.query({ name: "geolocation" });
          geoPermissionState.value = perm.state;
          perm.onchange = () => {
            geoPermissionState.value = perm.state;
          };
        } else {
          geoPermissionState.value = null;
        }
      } catch (err) {
        geoPermissionState.value = null;
      }
    }
    const localDataList = ref([]);
    const expandedKeys = ref({});
    const userToken = ref(null);
    const lastMapState = ref(null);
    const showFullToken = ref(false);
    const maskedToken = computed(() => {
      if (!userToken.value) return null;
      if (showFullToken.value) return userToken.value;
      const t = userToken.value;
      if (t.length <= 8) return t;
      return `${t.slice(0, 6)}...${t.slice(-4)}`;
    });
    function bytesForString(s) {
      if (!s) return 0;
      try {
        if (typeof TextEncoder !== "undefined") {
          return new TextEncoder().encode(s).length;
        }
      } catch (e) {
      }
      return s.length;
    }
    function inferDateFromValue(raw) {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        const candidates = ["timestamp", "created_at", "updated_at", "cachedAt", "cached_at", "savedAt", "saved_at"];
        for (const name of candidates) {
          if (parsed && typeof parsed === "object" && parsed[name]) {
            const v = parsed[name];
            if (typeof v === "number" && v > 0) return new Date(v).toLocaleString();
            if (typeof v === "string") {
              const d = new Date(v);
              if (!isNaN(d.getTime())) return d.toLocaleString();
            }
          }
        }
        if (parsed && typeof parsed === "object") {
          const flat = JSON.stringify(parsed);
          const epochMatch = flat.match(/\b(1[0-9]{12,}|[0-9]{12,})\b/);
          if (epochMatch) {
            const n = Number(epochMatch[0]);
            if (epochMatch[0].length === 10) return new Date(n * 1e3).toLocaleString();
            return new Date(n).toLocaleString();
          }
        }
      } catch (e) {
        const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        if (isoMatch) {
          const d = new Date(isoMatch[0]);
          if (!isNaN(d.getTime())) return d.toLocaleString();
        }
      }
      return null;
    }
    function loadLocalDataDiagnostics() {
      try {
        if (!canUseLocalStorage()) {
          localDataList.value = [];
          expandedKeys.value = {};
          return;
        }
        const keys = Object.keys(localStorage).sort();
        localDataList.value = keys.map((k) => {
          const raw = localStorage.getItem(k);
          const inferred = inferDateFromValue(raw);
          const size = bytesForString(raw);
          return { key: k, raw, inferredDate: inferred, size };
        });
        expandedKeys.value = {};
        loadSpecificKeys();
      } catch (err) {
        localDataList.value = [];
        expandedKeys.value = {};
      }
    }
    function loadSpecificKeys() {
      try {
        userToken.value = localStorage.getItem("user-token");
      } catch (e) {
        userToken.value = null;
      }
      try {
        const raw = localStorage.getItem("map:lastState");
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            lastMapState.value = parsed;
          } catch (e) {
            lastMapState.value = null;
          }
        } else {
          lastMapState.value = null;
        }
      } catch (e) {
        lastMapState.value = null;
      }
    }
    function totalLocalStorageBytes() {
      return localDataList.value.reduce((s, it) => s + (it.size || 0), 0);
    }
    onMounted(() => {
      checkSystemHealth();
      updateGeoPermissionState();
      loadLocalDataDiagnostics();
      if (isClient) window.addEventListener("resize", handleResize);
    });
    onUnmounted(() => {
      stopConfetti();
      if (isClient) window.removeEventListener("resize", handleResize);
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "status-view" }, _attrs))} data-v-689a0ca0><div class="bg-gray-50 border-b border-gray-200" data-v-689a0ca0><div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-v-689a0ca0><div class="text-center" data-v-689a0ca0><h1 class="text-3xl font-bold theme-on-background mb-2" data-v-689a0ca0>System Status</h1><p class="text-lg theme-on-surface-variant" data-v-689a0ca0> Current status and health information for Public Art Registry </p></div></div></div><div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-v-689a0ca0><div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6" data-v-689a0ca0><div class="p-6" data-v-689a0ca0><div class="flex items-center justify-between" data-v-689a0ca0><h2 class="text-lg font-semibold mb-0" data-v-689a0ca0>Local Keys</h2><div class="flex items-center space-x-2" data-v-689a0ca0><button class="text-sm px-3 py-1 border rounded bg-gray-100" data-v-689a0ca0>Refresh</button></div></div><div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" data-v-689a0ca0><div data-v-689a0ca0><div class="text-xs text-gray-600" data-v-689a0ca0>User Token (user-token)</div><div class="flex items-center space-x-2 mt-1" data-v-689a0ca0><div class="font-mono text-sm text-gray-900 truncate" data-v-689a0ca0>${ssrInterpolate(maskedToken.value ?? "not set")}</div><button class="text-xs text-blue-600 underline" data-v-689a0ca0>${ssrInterpolate(showFullToken.value ? "Hide" : "Show")}</button><button class="text-xs px-2 py-1 border rounded" data-v-689a0ca0>Copy</button></div></div><div data-v-689a0ca0><div class="text-xs text-gray-600" data-v-689a0ca0>Map Last State (map:lastState)</div><div class="mt-1 font-mono text-sm text-gray-900" data-v-689a0ca0>${ssrInterpolate(lastMapState.value ? lastMapState.value.center ? `${lastMapState.value.center.latitude?.toFixed(6)}, ${lastMapState.value.center.longitude?.toFixed(6)} (z:${lastMapState.value.zoom})` : JSON.stringify(lastMapState.value) : "not set")}</div><div class="mt-2" data-v-689a0ca0><button class="text-xs px-2 py-1 border rounded" data-v-689a0ca0>Copy JSON</button></div></div></div></div></div><div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6" data-v-689a0ca0><div class="p-6" data-v-689a0ca0><h2 class="text-lg font-semibold mb-4 flex items-center" data-v-689a0ca0><svg class="${ssrRenderClass(["w-5 h-5 mr-2", error.value ? "theme-error" : "theme-success"])}" fill="currentColor" viewBox="0 0 20 20" data-v-689a0ca0>`);
      if (!error.value) {
        _push(`<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" data-v-689a0ca0></path>`);
      } else {
        _push(`<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" data-v-689a0ca0></path>`);
      }
      _push(`</svg> API Status </h2>`);
      if (isLoading.value) {
        _push(`<div class="theme-on-surface-variant flex items-center" data-v-689a0ca0><svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-689a0ca0><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-689a0ca0></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-689a0ca0></path></svg> Checking system health... </div>`);
      } else {
        _push(`<div data-v-689a0ca0><p class="${ssrRenderClass(["text-lg mb-4", error.value ? "theme-error" : "theme-success"])}" data-v-689a0ca0>${ssrInterpolate(status.value)}</p><div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" data-v-689a0ca0><div class="space-y-2" data-v-689a0ca0><div class="flex justify-between" data-v-689a0ca0><span class="font-medium theme-on-surface-variant" data-v-689a0ca0>API Connected:</span><span class="${ssrRenderClass([healthData.value?.apiConnected ? "theme-success" : "theme-error"])}" data-v-689a0ca0>${ssrInterpolate(healthData.value?.apiConnected ? "Yes" : "No")}</span></div><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>API Base URL:</span><span class="text-gray-900 font-mono text-xs" data-v-689a0ca0>${ssrInterpolate(unref(apiBaseUrl))}</span></div><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Build Date:</span><span class="text-gray-900" data-v-689a0ca0>${ssrInterpolate(new Date(unref(buildDate)).toLocaleString())}</span></div></div><div class="space-y-2" data-v-689a0ca0><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Last Check:</span><span class="text-gray-900" data-v-689a0ca0>${ssrInterpolate(healthData.value?.timestamp ? new Date(healthData.value.timestamp).toLocaleString() : "N/A")}</span></div><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Environment:</span><span class="text-gray-900" data-v-689a0ca0>${ssrInterpolate(unref(environment))}</span></div></div></div></div>`);
      }
      _push(`</div></div>`);
      if (stats.value) {
        _push(`<div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6" data-v-689a0ca0><div class="p-6" data-v-689a0ca0><h2 class="text-lg font-semibold mb-4 flex items-center" data-v-689a0ca0><svg class="w-5 h-5 mr-2" style="${ssrRenderStyle({ "color": "rgb(var(--md-primary))" })}" fill="currentColor" viewBox="0 0 20 20" data-v-689a0ca0><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" data-v-689a0ca0></path></svg> System Statistics </h2><div class="grid grid-cols-1 md:grid-cols-3 gap-4" data-v-689a0ca0><div class="text-center p-4 bg-blue-50 rounded-lg" data-v-689a0ca0><div class="text-2xl font-bold" style="${ssrRenderStyle({ "color": "rgb(var(--md-primary))" })}" data-v-689a0ca0>${ssrInterpolate(stats.value.totalSubmissions || 0)}</div><div class="text-sm text-gray-600" data-v-689a0ca0>Total Submissions</div></div><div class="text-center p-4 bg-green-50 rounded-lg" data-v-689a0ca0><div class="text-2xl font-bold" style="${ssrRenderStyle({ "color": "rgb(var(--md-success))" })}" data-v-689a0ca0>${ssrInterpolate(stats.value.approvedSubmissions || 0)}</div><div class="text-sm text-gray-600" data-v-689a0ca0>Approved Submissions</div></div><div class="text-center p-4 bg-yellow-50 rounded-lg" data-v-689a0ca0><div class="text-2xl font-bold theme-warning" data-v-689a0ca0>${ssrInterpolate(stats.value.pendingSubmissions || 0)}</div><div class="text-sm text-gray-600" data-v-689a0ca0>Pending Review</div></div></div><div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6" data-v-689a0ca0><div class="p-6" data-v-689a0ca0><h2 class="text-lg font-semibold mb-4 flex items-center" data-v-689a0ca0><svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" data-v-689a0ca0><path d="M10 2a1 1 0 00-.894.553L7.382 6H4a1 1 0 00-.707 1.707l6 6a1 1 0 001.414 0l6-6A1 1 0 0016 6h-3.382l-1.724-3.447A1 1 0 0010 2z" data-v-689a0ca0></path></svg> Device &amp; Local Data </h2><div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" data-v-689a0ca0><div class="space-y-2" data-v-689a0ca0><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Geolocation Supported:</span><span class="text-gray-900" data-v-689a0ca0>${ssrInterpolate(unref(geoSupported) ? "Yes" : "No")}</span></div><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Geolocation Permission:</span><span class="text-gray-900" data-v-689a0ca0>${ssrInterpolate(geoPermissionState.value ?? "unknown")}</span></div><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Last Device Position:</span><span class="text-gray-900" data-v-689a0ca0>${ssrInterpolate(position.value ? formatCoords(position.value)?.lat + ", " + formatCoords(position.value)?.lon : "N/A")}</span></div><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Position Timestamp:</span><span class="text-gray-900" data-v-689a0ca0>${ssrInterpolate(position.value ? formatCoords(position.value)?.timestamp : "N/A")}</span></div></div><div class="space-y-2" data-v-689a0ca0><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Local Storage Keys:</span><span class="text-gray-900" data-v-689a0ca0>${ssrInterpolate(localDataList.value.length)}</span></div><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>User Token (user-token):</span><span class="text-gray-900 font-mono text-xs" data-v-689a0ca0>${ssrInterpolate(userToken.value ?? "not set")}</span></div><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Map Last State (map:lastState):</span><span class="text-gray-900 font-mono text-xs" data-v-689a0ca0>${ssrInterpolate(lastMapState.value ? lastMapState.value.center ? `${lastMapState.value.center.latitude?.toFixed(6)}, ${lastMapState.value.center.longitude?.toFixed(6)} (z:${lastMapState.value.zoom})` : JSON.stringify(lastMapState.value) : "not set")}</span></div><div class="text-sm text-gray-600" data-v-689a0ca0> Below are localStorage keys and any inferred timestamps found inside their values (best-effort heuristic). </div><div class="mt-2" data-v-689a0ca0><div class="flex justify-between items-center mb-2" data-v-689a0ca0><div class="text-sm text-gray-600" data-v-689a0ca0>Total localStorage size:</div><div class="text-sm text-gray-900 font-mono" data-v-689a0ca0>${ssrInterpolate(totalLocalStorageBytes())} bytes</div></div><div class="max-h-48 overflow-auto border rounded p-2 bg-gray-50" data-v-689a0ca0>`);
        if (localDataList.value.length) {
          _push(`<!--[-->`);
          ssrRenderList(localDataList.value, (item) => {
            _push(`<div class="py-1 border-b last:border-b-0" data-v-689a0ca0><div class="flex justify-between items-center" data-v-689a0ca0><div class="flex items-center space-x-3" data-v-689a0ca0><button class="text-xs text-gray-500" data-v-689a0ca0>${ssrInterpolate(expandedKeys.value[item.key] ? "▾" : "▸")}</button><div class="text-xs text-gray-700 font-mono truncate max-w-xs" data-v-689a0ca0>${ssrInterpolate(item.key)}</div></div><div class="flex items-center space-x-4" data-v-689a0ca0><div class="text-xs text-gray-900" data-v-689a0ca0>${ssrInterpolate(item.inferredDate ?? "-")}</div><div class="text-xs text-gray-600 font-mono" data-v-689a0ca0>${ssrInterpolate(item.size)} B</div></div></div>`);
            if (expandedKeys.value[item.key]) {
              _push(`<div class="mt-2 text-xs text-gray-800 font-mono bg-white p-2 rounded" data-v-689a0ca0><pre class="whitespace-pre-wrap break-words" data-v-689a0ca0>${ssrInterpolate(item.raw)}</pre></div>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div>`);
          });
          _push(`<!--]-->`);
        } else {
          _push(`<div class="text-sm text-gray-600" data-v-689a0ca0>No localStorage data found.</div>`);
        }
        _push(`</div></div></div></div></div></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (unref(environment) === "development" || unref(environment) === "staging") {
        _push(`<div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6" data-v-689a0ca0><div class="p-6" data-v-689a0ca0><h2 class="text-lg font-semibold mb-4 flex items-center" data-v-689a0ca0><svg class="w-5 h-5 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20" data-v-689a0ca0><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" data-v-689a0ca0></path></svg> Development Tools </h2><div class="space-y-4" data-v-689a0ca0><div class="flex items-center justify-between p-4 bg-purple-50 rounded-lg" data-v-689a0ca0><div data-v-689a0ca0><h3 class="font-medium text-gray-900" data-v-689a0ca0>Confetti Animation Test</h3><p class="text-sm text-gray-600" data-v-689a0ca0>Test the badge celebration confetti animation</p></div><button${ssrIncludeBooleanAttr(isConfettiActive.value) ? " disabled" : ""} class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed" data-v-689a0ca0> 🎉 Test Confetti </button></div><div class="flex items-center justify-between p-4 bg-yellow-50 rounded-lg" data-v-689a0ca0><div data-v-689a0ca0><h3 class="font-medium text-gray-900" data-v-689a0ca0>Notification Test</h3><p class="text-sm text-gray-600" data-v-689a0ca0>Test notification display (requires login)</p></div><button class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md theme-warning theme-on-warning" data-v-689a0ca0> 🔔 Test Notification </button></div><div class="p-4 bg-indigo-50 rounded-lg border border-indigo-100" data-v-689a0ca0><div class="flex items-start justify-between" data-v-689a0ca0><div data-v-689a0ca0><h3 class="font-medium text-gray-900" data-v-689a0ca0>Device GPS Location</h3><p class="text-sm text-gray-600" data-v-689a0ca0> Show current device GPS coordinates and accuracy (for debugging). </p></div></div><div class="mt-3 space-y-2" data-v-689a0ca0>`);
        if (!unref(geoSupported)) {
          _push(`<div class="text-sm text-gray-600" data-v-689a0ca0> Geolocation is not supported by this browser. </div>`);
        } else {
          _push(`<div data-v-689a0ca0>`);
          if (geoLoading.value) {
            _push(`<div class="text-sm text-gray-600" data-v-689a0ca0>Acquiring location…</div>`);
          } else {
            _push(`<!---->`);
          }
          if (geoError.value) {
            _push(`<div class="text-sm theme-error" data-v-689a0ca0>${ssrInterpolate(geoError.value)}</div>`);
          } else {
            _push(`<!---->`);
          }
          if (position.value) {
            _push(`<div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm" data-v-689a0ca0><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Latitude:</span><span class="text-gray-900 font-mono" data-v-689a0ca0>${ssrInterpolate(formatCoords(position.value)?.lat)}</span></div><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Longitude:</span><span class="text-gray-900 font-mono" data-v-689a0ca0>${ssrInterpolate(formatCoords(position.value)?.lon)}</span></div><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Accuracy:</span><span class="text-gray-900" data-v-689a0ca0>${ssrInterpolate(formatCoords(position.value)?.accuracy)}</span></div><div class="flex justify-between" data-v-689a0ca0><span class="font-medium text-gray-600" data-v-689a0ca0>Timestamp:</span><span class="text-gray-900" data-v-689a0ca0>${ssrInterpolate(formatCoords(position.value)?.timestamp)}</span></div></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<div class="flex items-center space-x-2 mt-3" data-v-689a0ca0><button class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" data-v-689a0ca0> 📍 Get Current Location </button><button class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md theme-success theme-on-success focus:outline-none focus:ring-2 focus:ring-offset-2" style="${ssrRenderStyle({ "--tw-ring-color": "var(--md-sys-color-success)" })}" data-v-689a0ca0> 👀 Start Watching </button><button class="inline-flex items-center px-3 py-2 border theme-secondary theme-on-secondary text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2" style="${ssrRenderStyle({ "border-color": "var(--md-sys-color-outline)", "--tw-ring-color": "var(--md-sys-color-secondary)" })}" data-v-689a0ca0> ✖️ Stop </button></div></div>`);
        }
        _push(`</div></div></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="text-center space-y-4" data-v-689a0ca0><button${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm theme-primary theme-on-primary focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed" style="${ssrRenderStyle({ "--tw-ring-color": "var(--md-sys-color-primary)" })}" data-v-689a0ca0><svg class="${ssrRenderClass(["w-4 h-4 mr-2", isLoading.value ? "animate-spin" : ""])}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-689a0ca0><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" data-v-689a0ca0></path></svg> ${ssrInterpolate(isLoading.value ? "Checking..." : "Refresh Status")}</button><button class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" data-v-689a0ca0><svg class="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-689a0ca0><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" data-v-689a0ca0></path></svg> Clear Local Settings </button></div></div></div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/StatusView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const StatusView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-689a0ca0"]]);

export { StatusView as default };
//# sourceMappingURL=StatusView-BI6IuQvC.js.map
