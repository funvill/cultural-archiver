import { defineComponent, ref, computed, onMounted, mergeProps, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderStyle, ssrRenderComponent, ssrInterpolate, ssrRenderAttr, ssrIncludeBooleanAttr, ssrLooseContain, ssrLooseEqual, ssrRenderList, ssrRenderClass } from 'vue/server-renderer';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeftIcon, CheckCircleIcon, MapPinIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { d as useAuthStore, o as useFastUploadSessionStore, _ as _export_sfc } from '../ssr-entry-server.js';
import { _ as _sfc_main$1 } from './ConsentSection-COX2C32T.js';
/* empty css                 */
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/solid';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "NewArtworkView",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    const router = useRouter();
    const authStore = useAuthStore();
    const fastStore = useFastUploadSessionStore();
    const fastUploadSession = ref(null);
    const formData = ref({
      title: "",
      // Optional per new requirement
      description: "",
      artist: "",
      materials: "",
      artworkType: "",
      access: "",
      condition: "good",
      location: null,
      notes: ""
      // Removed from UI but keep for potential future use
    });
    const isSubmitting = ref(false);
    const submitError = ref(null);
    const submitSuccess = ref(false);
    const redirectCountdown = ref(5);
    const consentCheckboxes = ref({
      ageVerification: false,
      cc0Licensing: false,
      publicCommons: false,
      freedomOfPanorama: false
    });
    const isFromFastUpload = computed(() => route.query.from === "fast-upload");
    const allConsentsAccepted = computed(() => {
      return Object.values(consentCheckboxes.value).every(Boolean);
    });
    const canSubmit = computed(() => {
      const photosLen = fastUploadSession.value?.photos ? fastUploadSession.value.photos.length : 0;
      return formData.value.location !== null && photosLen > 0 && allConsentsAccepted.value;
    });
    const artworkTypes = [
      "Sculpture",
      "Mural",
      "Street Art",
      "Monument",
      "Installation",
      "Mosaic",
      "Statue",
      "Relief",
      "Fountain",
      "Architecture",
      "tiny_library",
      "Other"
    ];
    const accessOptions = [
      { value: "public", label: "Public - Open to everyone" },
      { value: "restricted", label: "Restricted - Limited access" },
      { value: "private", label: "Private - Not publicly accessible" }
    ];
    const conditionOptions = [
      { value: "excellent", label: "Excellent" },
      { value: "good", label: "Good" },
      { value: "fair", label: "Fair" },
      { value: "poor", label: "Poor" },
      { value: "damaged", label: "Damaged" }
    ];
    const showLocationModal = ref(false);
    const tempLocation = ref(null);
    const consentSection = ref(null);
    function handleConsentChanged(consents) {
      consentCheckboxes.value = consents;
    }
    onMounted(async () => {
      if (fastStore.photos.length > 0) {
        fastUploadSession.value = { photos: fastStore.photos, location: fastStore.location };
        if (fastStore.location) {
          formData.value.location = fastStore.location;
        }
      } else if (typeof window !== "undefined") {
        try {
          const sessionData = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("fast-upload-session") : null;
          if (sessionData && isFromFastUpload.value) {
            try {
              const parsed = JSON.parse(sessionData);
              fastUploadSession.value = parsed;
              if (parsed?.location) formData.value.location = parsed.location;
            } catch (error) {
              console.error("Failed to load session data:", error);
              router.push("/add");
            }
          } else if (isFromFastUpload.value) {
            router.push("/add");
          }
        } catch (e) {
          console.warn("Session storage unavailable or blocked:", e);
          if (isFromFastUpload.value) router.push("/add");
        }
      } else {
        if (isFromFastUpload.value) {
          console.warn("[NEW ARTWORK] SSR environment - skipping session restore");
        }
      }
      await authStore.ensureUserToken();
    });
    function getLocationMethodText(detectedSources) {
      if (!detectedSources) return "Unknown";
      if (detectedSources.exif?.detected && detectedSources.exif?.coordinates) {
        return "Photo EXIF data";
      }
      if (detectedSources.browser?.detected && detectedSources.browser?.coordinates) {
        return "Device GPS";
      }
      if (detectedSources.ip?.detected && detectedSources.ip?.coordinates) {
        return "IP location";
      }
      return "Manual entry";
    }
    function getLocationMethodStyle(detectedSources) {
      const method = getLocationMethodText(detectedSources);
      switch (method) {
        case "Photo EXIF data":
          return "px-2 py-1 rounded-full";
        case "Device GPS":
          return "px-2 py-1 rounded-full";
        case "IP location":
          return "px-2 py-1 rounded-full";
        case "Manual entry":
          return "px-2 py-1 rounded-full";
        default:
          return "bg-gray-100 text-gray-800 border border-gray-200";
      }
    }
    function getLocationMethodDescription(detectedSources) {
      const method = getLocationMethodText(detectedSources);
      switch (method) {
        case "Photo EXIF data":
          return "Location extracted from photo metadata - most accurate";
        case "Device GPS":
          return "Location from device GPS sensor - high accuracy";
        case "IP location":
          return "Location approximated from IP address - lower accuracy";
        case "Manual entry":
          return "Location entered manually by user";
        default:
          return "Location detection method unknown";
      }
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "new-artwork-view min-h-screen theme-background py-8 px-4" }, _attrs))} data-v-3d7f646a><div class="max-w-4xl mx-auto" data-v-3d7f646a><div class="flex items-center mb-8" data-v-3d7f646a><button class="mr-4 p-2 rounded-lg transition-colors group" aria-label="Go back" style="${ssrRenderStyle({ color: "rgb(var(--md-on-background))" })}" data-v-3d7f646a>`);
      _push(ssrRenderComponent(unref(ArrowLeftIcon), { class: "w-5 h-5 theme-icon-hover" }, null, _parent));
      _push(`</button><div data-v-3d7f646a><h1 class="text-3xl font-bold" style="${ssrRenderStyle({ "color": "rgb(var(--md-on-background))" })}" data-v-3d7f646a>Add New Artwork</h1><p style="${ssrRenderStyle({ "color": "rgba(var(--md-on-background), 0.8)" })}" class="mt-1" data-v-3d7f646a>Fill in the details for your new artwork submission</p></div></div><div class="grid grid-cols-1 lg:grid-cols-3 gap-8" data-v-3d7f646a><div class="lg:col-span-2" data-v-3d7f646a><div class="rounded-lg shadow-md p-6 theme-surface" data-v-3d7f646a>`);
      if (submitSuccess.value) {
        _push(`<div class="mb-6 p-4 rounded-lg" style="${ssrRenderStyle({ background: "rgba(var(--md-success), 0.08)", border: "1px solid rgba(var(--md-success), 0.16)" })}" data-v-3d7f646a><div class="flex items-center" data-v-3d7f646a>`);
        _push(ssrRenderComponent(unref(CheckCircleIcon), {
          class: "w-5 h-5 mr-2",
          style: { color: "rgb(var(--md-success))" }
        }, null, _parent));
        _push(`<span class="font-medium" style="${ssrRenderStyle({ color: "rgb(var(--md-on-success))" })}" data-v-3d7f646a>Artwork submitted successfully!</span></div><p class="text-sm mt-1" style="${ssrRenderStyle({ color: "rgb(var(--md-success))" })}" data-v-3d7f646a> Submission received and pending review. <span class="font-medium" data-v-3d7f646a>Redirecting to map in ${ssrInterpolate(redirectCountdown.value)} seconds...</span></p></div>`);
      } else {
        _push(`<!---->`);
      }
      if (submitError.value) {
        _push(`<div class="mb-6 p-4 rounded-lg" style="${ssrRenderStyle({ background: "rgba(var(--md-error), 0.08)", border: "1px solid rgba(var(--md-error), 0.16)" })}" data-v-3d7f646a><div style="${ssrRenderStyle({ color: "rgb(var(--md-on-error))" })}" data-v-3d7f646a><strong data-v-3d7f646a>Submission failed:</strong> ${ssrInterpolate(submitError.value)}</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<form class="space-y-6" data-v-3d7f646a><div data-v-3d7f646a><h3 class="text-lg font-medium mb-4" style="${ssrRenderStyle({ color: "rgb(var(--md-on-surface))" })}" data-v-3d7f646a>Basic Information</h3><div class="mb-4" data-v-3d7f646a><label for="title" class="block text-sm font-medium text-gray-700 mb-2" data-v-3d7f646a> Artwork Title <span class="text-xs text-gray-400" data-v-3d7f646a>(optional)</span></label><input id="title"${ssrRenderAttr("value", formData.value.title)} type="text" placeholder="Enter artwork title" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none" style="${ssrRenderStyle({ "outline-color": "rgb(var(--md-primary))" })}" data-v-3d7f646a></div><div class="mb-4" data-v-3d7f646a><label for="description" class="block text-sm font-medium text-gray-700 mb-2" data-v-3d7f646a> Description </label><textarea id="description" rows="3" placeholder="Describe the artwork (optional)" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3d7f646a>${ssrInterpolate(formData.value.description)}</textarea></div></div><div data-v-3d7f646a><h3 class="text-lg font-medium mb-4" style="${ssrRenderStyle({ color: "rgb(var(--md-on-surface))" })}" data-v-3d7f646a> Additional Details (Optional) </h3><div class="grid grid-cols-1 md:grid-cols-2 gap-4" data-v-3d7f646a><div data-v-3d7f646a><label for="artist" class="block text-sm font-medium text-gray-700 mb-2" data-v-3d7f646a> Artist </label><input id="artist"${ssrRenderAttr("value", formData.value.artist)} type="text" placeholder="Artist name" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3d7f646a></div><div data-v-3d7f646a><label for="artworkType" class="block text-sm font-medium text-gray-700 mb-2" data-v-3d7f646a> Type </label><select id="artworkType" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3d7f646a><option value="" data-v-3d7f646a${ssrIncludeBooleanAttr(Array.isArray(formData.value.artworkType) ? ssrLooseContain(formData.value.artworkType, "") : ssrLooseEqual(formData.value.artworkType, "")) ? " selected" : ""}>Select type</option><!--[-->`);
      ssrRenderList(artworkTypes, (type) => {
        _push(`<option${ssrRenderAttr("value", type)} data-v-3d7f646a${ssrIncludeBooleanAttr(Array.isArray(formData.value.artworkType) ? ssrLooseContain(formData.value.artworkType, type) : ssrLooseEqual(formData.value.artworkType, type)) ? " selected" : ""}>${ssrInterpolate(type)}</option>`);
      });
      _push(`<!--]--></select></div><div data-v-3d7f646a><label for="materials" class="block text-sm font-medium text-gray-700 mb-2" data-v-3d7f646a> Materials </label><input id="materials"${ssrRenderAttr("value", formData.value.materials)} type="text" placeholder="e.g., Bronze, Steel, Paint" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3d7f646a></div><div data-v-3d7f646a><label for="access" class="block text-sm font-medium text-gray-700 mb-2" data-v-3d7f646a> Access </label><select id="access" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3d7f646a><option value="" data-v-3d7f646a${ssrIncludeBooleanAttr(Array.isArray(formData.value.access) ? ssrLooseContain(formData.value.access, "") : ssrLooseEqual(formData.value.access, "")) ? " selected" : ""}>Select access level</option><!--[-->`);
      ssrRenderList(accessOptions, (option) => {
        _push(`<option${ssrRenderAttr("value", option.value)} data-v-3d7f646a${ssrIncludeBooleanAttr(Array.isArray(formData.value.access) ? ssrLooseContain(formData.value.access, option.value) : ssrLooseEqual(formData.value.access, option.value)) ? " selected" : ""}>${ssrInterpolate(option.label)}</option>`);
      });
      _push(`<!--]--></select></div><div data-v-3d7f646a><label for="condition" class="block text-sm font-medium text-gray-700 mb-2" data-v-3d7f646a> Condition </label><select id="condition" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-3d7f646a><!--[-->`);
      ssrRenderList(conditionOptions, (option) => {
        _push(`<option${ssrRenderAttr("value", option.value)} data-v-3d7f646a${ssrIncludeBooleanAttr(Array.isArray(formData.value.condition) ? ssrLooseContain(formData.value.condition, option.value) : ssrLooseEqual(formData.value.condition, option.value)) ? " selected" : ""}>${ssrInterpolate(option.label)}</option>`);
      });
      _push(`<!--]--></select></div></div></div><div class="mt-8" data-v-3d7f646a>`);
      _push(ssrRenderComponent(_sfc_main$1, {
        ref_key: "consentSection",
        ref: consentSection,
        "consent-version": "2025-01-01",
        onConsentChanged: handleConsentChanged
      }, null, _parent));
      _push(`</div><div class="flex justify-end" data-v-3d7f646a><button type="submit"${ssrIncludeBooleanAttr(!canSubmit.value || isSubmitting.value) ? " disabled" : ""} class="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" data-v-3d7f646a>`);
      if (isSubmitting.value) {
        _push(`<span data-v-3d7f646a>Submitting...</span>`);
      } else {
        _push(`<span data-v-3d7f646a>Submit Artwork</span>`);
      }
      _push(`</button></div></form></div></div><div class="space-y-6" data-v-3d7f646a>`);
      if (fastUploadSession.value?.photos.length) {
        _push(`<div class="bg-white rounded-lg shadow-md p-6" data-v-3d7f646a><h3 class="text-lg font-medium text-gray-900 mb-4" data-v-3d7f646a> Photos (${ssrInterpolate(fastUploadSession.value.photos.length)}) </h3><div class="grid grid-cols-2 gap-3" data-v-3d7f646a><!--[-->`);
        ssrRenderList(fastUploadSession.value.photos, (photo) => {
          _push(`<div data-v-3d7f646a><img${ssrRenderAttr("src", photo.preview || "")}${ssrRenderAttr("alt", photo.name)} class="w-full h-20 object-cover rounded-lg" data-v-3d7f646a></div>`);
        });
        _push(`<!--]--></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="bg-white rounded-lg shadow-md p-6" data-v-3d7f646a><h3 class="text-lg font-medium text-gray-900 mb-4" data-v-3d7f646a>Location</h3>`);
      if (formData.value.location) {
        _push(`<div class="space-y-3" data-v-3d7f646a><div class="flex items-center" data-v-3d7f646a>`);
        _push(ssrRenderComponent(unref(CheckCircleIcon), {
          class: "w-5 h-5 mr-2",
          style: { color: "rgb(var(--md-success))" }
        }, null, _parent));
        _push(`<span class="text-sm font-medium" style="${ssrRenderStyle({ color: "rgb(var(--md-on-success))" })}" data-v-3d7f646a>Location set</span></div><div class="text-sm text-gray-600 space-y-2" data-v-3d7f646a><div data-v-3d7f646a><div data-v-3d7f646a>Lat: ${ssrInterpolate(formData.value.location.latitude.toFixed(6))}</div><div data-v-3d7f646a>Lng: ${ssrInterpolate(formData.value.location.longitude.toFixed(6))}</div></div>`);
        if (fastUploadSession.value?.detectedSources) {
          _push(`<div class="space-y-1" data-v-3d7f646a><div class="flex items-center space-x-2" data-v-3d7f646a><span class="text-xs font-medium" data-v-3d7f646a>Method:</span><span class="${ssrRenderClass([getLocationMethodStyle(fastUploadSession.value.detectedSources), "text-xs px-2 py-1 rounded-full"])}" data-v-3d7f646a>${ssrInterpolate(getLocationMethodText(fastUploadSession.value.detectedSources))}</span></div><div class="text-xs text-gray-500" data-v-3d7f646a>${ssrInterpolate(getLocationMethodDescription(fastUploadSession.value.detectedSources))}</div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><button type="button" class="text-sm" style="${ssrRenderStyle({ color: "rgb(var(--md-primary))" })}" data-v-3d7f646a> Change location </button></div>`);
      } else {
        _push(`<div class="space-y-3" data-v-3d7f646a><div class="flex items-center" data-v-3d7f646a>`);
        _push(ssrRenderComponent(unref(MapPinIcon), {
          class: "w-5 h-5 mr-2",
          style: { color: "rgb(var(--md-error))" }
        }, null, _parent));
        _push(`<span class="text-sm font-medium" style="${ssrRenderStyle({ color: "rgb(var(--md-on-error))" })}" data-v-3d7f646a>Location required</span></div><button type="button" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" data-v-3d7f646a> Set Location </button></div>`);
      }
      _push(`</div><div class="rounded-lg p-4" style="${ssrRenderStyle({ background: "rgba(var(--md-primary), 0.06)", border: "1px solid rgba(var(--md-primary), 0.12)" })}" data-v-3d7f646a><h3 class="text-sm font-medium mb-2" style="${ssrRenderStyle({ color: "rgb(var(--md-on-primary))" })}" data-v-3d7f646a>Tips for Better Submissions</h3><ul class="text-xs space-y-1" style="${ssrRenderStyle({ color: "rgba(var(--md-on-primary), 0.9)" })}" data-v-3d7f646a><li data-v-3d7f646a>• A title helps but is optional</li><li data-v-3d7f646a>• Include artist information if known</li><li data-v-3d7f646a>• Describe unique features or context</li><li data-v-3d7f646a>• Note the condition accurately</li></ul></div></div></div></div>`);
      if (showLocationModal.value) {
        _push(`<div class="fixed inset-0 z-50 flex items-center justify-center p-4" data-v-3d7f646a><div class="absolute inset-0 bg-black/50" data-v-3d7f646a></div><div class="relative bg-white w-full max-w-xl rounded-lg shadow-xl overflow-hidden" data-v-3d7f646a><div class="flex items-center justify-between px-4 py-3 border-b" data-v-3d7f646a><h3 class="text-lg font-semibold text-gray-900" data-v-3d7f646a>Select Location</h3><button class="p-2 rounded hover:bg-gray-100 group" data-v-3d7f646a>`);
        _push(ssrRenderComponent(unref(XMarkIcon), { class: "w-5 h-5 theme-icon-hover" }, null, _parent));
        _push(`</button></div><div class="relative" data-v-3d7f646a><div id="picker-map" class="h-80 w-full" data-v-3d7f646a></div><div class="pointer-events-none absolute inset-0 flex items-center justify-center z-10" aria-hidden="true" data-v-3d7f646a><div class="relative -mt-5 flex flex-col items-center" data-v-3d7f646a><svg class="w-9 h-9 text-red-600 drop-shadow animate-pin-bounce" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" data-v-3d7f646a><path fill-rule="evenodd" d="M12 2.25c-3.728 0-6.75 2.97-6.75 6.64 0 1.586.68 3.225 1.57 4.751.884 1.515 2.012 2.945 2.992 4.094a32.724 32.724 0 002.01 2.194l.012.012.002.002a.75.75 0 001.07 0s.005-.005.012-.012a32.685 32.685 0 002.01-2.194c.98-1.149 2.108-2.579 2.992-4.094.89-1.526 1.57-3.165 1.57-4.751 0-3.67-3.022-6.64-6.75-6.64zm0 9.19a2.55 2.55 0 100-5.1 2.55 2.55 0 000 5.1z" clip-rule="evenodd" data-v-3d7f646a></path></svg><div class="absolute top-full mt-1 w-6 h-6 border-2 border-red-400/60 rounded-full" data-v-3d7f646a></div></div></div></div><div class="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-600" data-v-3d7f646a><div data-v-3d7f646a><div data-v-3d7f646a>Lat: ${ssrInterpolate(tempLocation.value?.latitude?.toFixed(6) || "...")}</div><div data-v-3d7f646a>Lng: ${ssrInterpolate(tempLocation.value?.longitude?.toFixed(6) || "...")}</div></div><div class="space-x-2" data-v-3d7f646a><button class="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" data-v-3d7f646a> Cancel </button><button class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" data-v-3d7f646a> Update Location </button></div></div></div></div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/NewArtworkView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const NewArtworkView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-3d7f646a"]]);

export { NewArtworkView as default };
//# sourceMappingURL=NewArtworkView-B9pP7lGH.js.map
