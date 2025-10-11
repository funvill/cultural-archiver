import { defineComponent, ref, watch, mergeProps, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderStyle, ssrRenderComponent, ssrInterpolate, ssrRenderList, ssrRenderAttr } from 'vue/server-renderer';
import { useRouter } from 'vue-router';
import { PhotoIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, MapPinIcon } from '@heroicons/vue/24/outline';
import { p as useGeolocation, o as useFastUploadSessionStore, _ as _export_sfc } from '../ssr-entry-server.js';
import 'exifr';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import '@heroicons/vue/24/solid';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "FastPhotoUploadView",
  __ssrInlineRender: true,
  setup(__props) {
    const router = useRouter();
    useGeolocation();
    const selectedFiles = ref([]);
    const isDragOver = ref(false);
    const isProcessing = ref(false);
    const locationSources = ref({
      exif: { detected: false, error: false, coordinates: null },
      browser: { detected: false, error: false, coordinates: null },
      ip: { detected: false, error: false, coordinates: null }
    });
    const finalLocation = ref(null);
    const hasNavigated = ref(false);
    ref(false);
    ref();
    function proceedToSearch() {
      if (selectedFiles.value.length === 0) return;
      if (!finalLocation.value) return;
      if (hasNavigated.value) return;
      hasNavigated.value = true;
      const store = useFastUploadSessionStore();
      const metaWithPreview = selectedFiles.value.map((photo) => ({
        id: photo.id,
        name: photo.name,
        preview: photo.preview,
        exifLat: photo.exifData?.latitude ?? void 0,
        exifLon: photo.exifData?.longitude ?? void 0,
        file: photo.file
      }));
      const meta = metaWithPreview.map((p) => ({
        id: p.id,
        name: p.name,
        exifLat: p.exifLat,
        exifLon: p.exifLon
      }));
      const payload = {
        photos: metaWithPreview,
        location: finalLocation.value,
        detectedSources: locationSources.value
      };
      store.setSession(payload);
      try {
        const json = JSON.stringify({ ...payload, photos: meta });
        if (json.length < 2e5) {
          sessionStorage.setItem("fast-upload-session", json);
        } else {
          sessionStorage.setItem(
            "fast-upload-session",
            JSON.stringify({ photos: meta.slice(0, 5), location: payload.location })
          );
        }
      } catch (e) {
        console.warn("Failed to persist fast upload session (quota or serialization issue):", e);
        try {
          sessionStorage.setItem(
            "fast-upload-session",
            JSON.stringify({ photos: meta.slice(0, 3), location: payload.location })
          );
        } catch {
        }
      }
      const query = new URLSearchParams({ mode: "photo", source: "fast-upload" });
      if (finalLocation.value) {
        query.set("lat", finalLocation.value.latitude.toString());
        query.set("lng", finalLocation.value.longitude.toString());
      }
      router.push(`/search?${query.toString()}`);
    }
    function maybeAutoNavigate() {
      if (!isProcessing.value && selectedFiles.value.length > 0 && finalLocation.value && !hasNavigated.value) {
        proceedToSearch();
      }
    }
    watch([finalLocation, () => selectedFiles.value.length, isProcessing], () => {
      maybeAutoNavigate();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "fast-photo-upload min-h-screen theme-background py-8 px-4" }, _attrs))} data-v-8c21edb8><div class="max-w-4xl mx-auto" data-v-8c21edb8><div class="text-center mb-8" data-v-8c21edb8><h1 class="text-3xl font-bold mb-2" style="${ssrRenderStyle({ color: "rgb(var(--md-on-background))" })}" data-v-8c21edb8>Add Artwork</h1><p class="text-lg" style="${ssrRenderStyle({ color: "rgba(var(--md-on-background),0.85)" })}" data-v-8c21edb8> Upload photos and we&#39;ll automatically search for nearby artworks </p></div><div class="bg-white rounded-lg shadow-md p-6 mb-6" data-v-8c21edb8><div class="flex items-center mb-4" data-v-8c21edb8><div class="flex items-center justify-center w-8 h-8 rounded-full mr-3" style="${ssrRenderStyle({ background: "rgb(var(--md-primary))", color: "rgb(var(--md-on-primary))" })}" data-v-8c21edb8><span class="text-sm font-bold" data-v-8c21edb8>1</span></div><h2 class="text-xl font-semibold text-gray-900" data-v-8c21edb8>Upload Photos</h2></div><div class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors" style="${ssrRenderStyle(isDragOver.value ? { borderColor: "rgb(var(--md-primary))", background: "rgba(var(--md-primary),0.06)" } : selectedFiles.value.length > 0 ? { borderColor: "rgb(var(--md-success))", background: "rgba(var(--md-success),0.06)" } : { borderColor: "rgba(0,0,0,0.08)" })}" data-v-8c21edb8>`);
      _push(ssrRenderComponent(unref(PhotoIcon), { class: "mx-auto h-12 w-12 text-gray-400 mb-4" }, null, _parent));
      _push(`<p class="text-lg font-medium mb-2" style="${ssrRenderStyle({ color: "rgba(var(--md-on-surface),0.9)" })}" data-v-8c21edb8>${ssrInterpolate(selectedFiles.value.length > 0 ? `${selectedFiles.value.length} photo(s) selected` : "Drop photos here or click to select")}</p><p class="text-sm text-gray-500" data-v-8c21edb8>Supports JPG, PNG, WebP up to 10MB each</p><input type="file" multiple accept="image/*" class="hidden" data-v-8c21edb8></div>`);
      if (selectedFiles.value.length > 0) {
        _push(`<div class="mt-6" data-v-8c21edb8><h3 class="text-sm font-medium text-gray-700 mb-3" data-v-8c21edb8>Selected Photos</h3><div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-v-8c21edb8><!--[-->`);
        ssrRenderList(selectedFiles.value, (photo) => {
          _push(`<div class="relative group" data-v-8c21edb8><img${ssrRenderAttr("src", photo.preview)}${ssrRenderAttr("alt", photo.name)} class="w-full h-24 object-cover rounded-lg" data-v-8c21edb8>`);
          if (photo.exifData?.latitude && photo.exifData?.longitude) {
            _push(`<div class="absolute top-1 left-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1" data-v-8c21edb8><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-v-8c21edb8><circle cx="12" cy="12" r="3" fill="white" stroke="none" data-v-8c21edb8></circle></svg> GPS </div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<button class="absolute top-1 right-1 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity group" style="${ssrRenderStyle({ background: "rgb(var(--md-error))", color: "rgb(var(--md-on-error))" })}" data-v-8c21edb8>`);
          _push(ssrRenderComponent(unref(XMarkIcon), { class: "w-4 h-4 theme-icon-hover" }, null, _parent));
          _push(`</button><div class="absolute bottom-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 rounded" data-v-8c21edb8>${ssrInterpolate(photo.name.length > 15 ? photo.name.substring(0, 12) + "..." : photo.name)}</div></div>`);
        });
        _push(`<!--]--></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
      if (selectedFiles.value.length > 0) {
        _push(`<div class="bg-white rounded-lg shadow-md p-6 mb-6" data-v-8c21edb8><div class="flex items-center mb-4" data-v-8c21edb8><div class="flex items-center justify-center w-8 h-8 rounded-full mr-3" style="${ssrRenderStyle({ background: "rgb(var(--md-primary))", color: "rgb(var(--md-on-primary))" })}" data-v-8c21edb8><span class="text-sm font-bold" data-v-8c21edb8>2</span></div><h2 class="text-xl font-semibold" style="${ssrRenderStyle({ color: "rgb(var(--md-on-surface))" })}" data-v-8c21edb8>Detecting Location</h2></div><div class="space-y-3" data-v-8c21edb8><div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg" data-v-8c21edb8><div class="flex items-center" data-v-8c21edb8>`);
        _push(ssrRenderComponent(unref(PhotoIcon), { class: "w-5 h-5 text-gray-500 mr-3" }, null, _parent));
        _push(`<span class="text-sm font-medium text-gray-700" data-v-8c21edb8>Photo GPS Data</span></div><div class="flex items-center" data-v-8c21edb8>`);
        if (locationSources.value.exif.detected) {
          _push(ssrRenderComponent(unref(CheckCircleIcon), {
            class: "w-5 h-5 mr-2",
            style: { color: "rgb(var(--md-success))" }
          }, null, _parent));
        } else {
          _push(ssrRenderComponent(unref(ExclamationTriangleIcon), {
            class: "w-5 h-5 mr-2",
            style: { color: "rgb(var(--md-error))" }
          }, null, _parent));
        }
        _push(`<span class="text-sm text-gray-600" data-v-8c21edb8>${ssrInterpolate(locationSources.value.exif.detected ? "Found" : "Not available")}</span></div></div><div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg" data-v-8c21edb8><div class="flex items-center" data-v-8c21edb8>`);
        _push(ssrRenderComponent(unref(MapPinIcon), { class: "w-5 h-5 text-gray-500 mr-3" }, null, _parent));
        _push(`<span class="text-sm font-medium text-gray-700" data-v-8c21edb8>Browser Location</span></div><div class="flex items-center" data-v-8c21edb8>`);
        if (locationSources.value.browser.detected) {
          _push(ssrRenderComponent(unref(CheckCircleIcon), {
            class: "w-5 h-5 mr-2",
            style: { color: "rgb(var(--md-success))" }
          }, null, _parent));
        } else {
          _push(ssrRenderComponent(unref(ExclamationTriangleIcon), {
            class: "w-5 h-5 mr-2",
            style: { color: "rgb(var(--md-error))" }
          }, null, _parent));
        }
        _push(`<span class="text-sm text-gray-600" data-v-8c21edb8>${ssrInterpolate(locationSources.value.browser.detected ? "Detected" : locationSources.value.browser.error ? "Denied" : "Detecting...")}</span></div></div><div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg" data-v-8c21edb8><div class="flex items-center" data-v-8c21edb8><svg class="w-5 h-5 text-gray-500 mr-3" fill="currentColor" viewBox="0 0 20 20" data-v-8c21edb8><path fill-rule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.559-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.559.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clip-rule="evenodd" data-v-8c21edb8></path></svg><span class="text-sm font-medium text-gray-700" data-v-8c21edb8>IP Address Location</span></div><div class="flex items-center" data-v-8c21edb8>`);
        _push(ssrRenderComponent(unref(ExclamationTriangleIcon), {
          class: "w-5 h-5 mr-2",
          style: { color: "rgb(var(--md-error))" }
        }, null, _parent));
        _push(`<span class="text-sm text-gray-600" data-v-8c21edb8>Not available</span></div></div></div><div class="mt-4 text-center" data-v-8c21edb8><button class="inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none" style="${ssrRenderStyle({ color: "rgb(var(--md-on-surface))", borderColor: "rgba(var(--md-surface),0.08)" })}" data-v-8c21edb8>`);
        _push(ssrRenderComponent(unref(MapPinIcon), { class: "w-4 h-4 mr-2" }, null, _parent));
        _push(` Set Location Manually </button></div>`);
        if (finalLocation.value) {
          _push(`<div class="mt-4 p-3 rounded-lg" style="${ssrRenderStyle({ background: "rgba(var(--md-success),0.06)", border: "1px solid rgba(var(--md-success),0.12)" })}" data-v-8c21edb8><div class="flex items-center" data-v-8c21edb8>`);
          _push(ssrRenderComponent(unref(CheckCircleIcon), {
            class: "w-5 h-5 mr-2",
            style: { color: "rgb(var(--md-success))" }
          }, null, _parent));
          _push(`<span class="text-sm font-medium" style="${ssrRenderStyle({ color: "rgb(var(--md-on-success))" })}" data-v-8c21edb8>Location detected:</span><span class="text-sm ml-2" style="${ssrRenderStyle({ color: "rgb(var(--md-success))" })}" data-v-8c21edb8>${ssrInterpolate(finalLocation.value.latitude.toFixed(6))}, ${ssrInterpolate(finalLocation.value.longitude.toFixed(6))}</span></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      if (selectedFiles.value.length > 0 && !hasNavigated.value) {
        _push(`<div class="text-center" data-v-8c21edb8>`);
        if (!finalLocation.value) {
          _push(`<p class="text-sm text-gray-500" data-v-8c21edb8>Detecting location...</p>`);
        } else {
          _push(`<p class="text-sm text-gray-500" data-v-8c21edb8>Loading nearby artworks...</p>`);
        }
        _push(`</div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/FastPhotoUploadView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const FastPhotoUploadView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-8c21edb8"]]);

export { FastPhotoUploadView as default };
//# sourceMappingURL=FastPhotoUploadView-BP_g92Fk.js.map
