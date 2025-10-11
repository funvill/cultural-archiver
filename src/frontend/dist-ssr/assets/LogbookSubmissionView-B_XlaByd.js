import { ref, computed, defineComponent, watch, onMounted, mergeProps, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrInterpolate, ssrRenderAttr, ssrRenderClass, ssrIncludeBooleanAttr, ssrLooseEqual, ssrLooseContain } from 'vue/server-renderer';
import { useRoute, useRouter } from 'vue-router';
import { ExclamationTriangleIcon, CheckCircleIcon, PhotoIcon } from '@heroicons/vue/24/outline';
import { defineStore } from 'pinia';
import { a as apiService, b as getErrorMessage, m as isNetworkError, q as isRateLimited, o as useFastUploadSessionStore } from '../ssr-entry-server.js';
import { _ as _sfc_main$1 } from './ConsentSection-COX2C32T.js';
import '@vue/server-renderer';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/solid';

const useLogbookSubmissionStore = defineStore("logbookSubmission", () => {
  const artwork = ref(null);
  const isLoadingArtwork = ref(false);
  const artworkError = ref(null);
  const selectedPhoto = ref(null);
  const photoPreview = ref(null);
  const condition = ref("");
  const notes = ref("");
  const artworkType = ref("");
  const access = ref("");
  const artist = ref("");
  const material = ref("");
  const isSubmitting = ref(false);
  const submitError = ref(null);
  const lastSubmissionId = ref(null);
  const hasPhoto = computed(() => !!selectedPhoto.value);
  const isOnCooldown = computed(() => artwork.value?.userLogbookStatus?.onCooldown || false);
  const cooldownUntil = computed(() => {
    if (!artwork.value?.userLogbookStatus?.cooldownUntil) return null;
    return new Date(artwork.value.userLogbookStatus.cooldownUntil);
  });
  const cooldownMessage = computed(() => {
    if (!isOnCooldown.value || !cooldownUntil.value) return "";
    const formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    return `Looks like you've been here recently! Come back after ${formatter.format(cooldownUntil.value)} to log another visit.`;
  });
  const canSubmit = computed(() => {
    return !isOnCooldown.value && hasPhoto.value && !isSubmitting.value && !isLoadingArtwork.value && !!artwork.value;
  });
  const hasFormData = computed(() => {
    return hasPhoto.value || condition.value.length > 0 || notes.value.length > 0 || artworkType.value.length > 0 || access.value.length > 0 || artist.value.length > 0 || material.value.length > 0;
  });
  async function fetchArtworkDetails(artworkId) {
    if (!artworkId) {
      artworkError.value = "Artwork ID is required";
      return;
    }
    try {
      isLoadingArtwork.value = true;
      artworkError.value = null;
      const response = await apiService.getArtworkDetails(artworkId);
      artwork.value = response;
    } catch (err) {
      artworkError.value = getErrorMessage(err);
      console.error("Failed to fetch artwork details:", err);
    } finally {
      isLoadingArtwork.value = false;
    }
  }
  function setPhoto(file) {
    selectedPhoto.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      photoPreview.value = e.target?.result;
    };
    reader.readAsDataURL(file);
  }
  function removePhoto() {
    selectedPhoto.value = null;
    photoPreview.value = null;
  }
  function setCondition(value) {
    condition.value = value;
  }
  function setNotes(value) {
    notes.value = value;
  }
  function setArtworkType(value) {
    artworkType.value = value;
  }
  function setAccess(value) {
    access.value = value;
  }
  function setArtist(value) {
    artist.value = value;
  }
  function setMaterial(value) {
    material.value = value;
  }
  async function submitLogbookEntry(artworkId) {
    if (!canSubmit.value) {
      throw new Error("Cannot submit: form is not ready or user is on cooldown");
    }
    if (!selectedPhoto.value) {
      throw new Error("Photo is required for logbook submissions");
    }
    try {
      isSubmitting.value = true;
      submitError.value = null;
      const formData = new FormData();
      formData.append("submissionType", "logbook");
      formData.append("artworkId", artworkId);
      if (artwork.value) {
        formData.append("lat", artwork.value.lat.toString());
        formData.append("lon", artwork.value.lon.toString());
      }
      formData.append("photos", selectedPhoto.value);
      if (condition.value) {
        formData.append("condition", condition.value);
      }
      const allNotes = [];
      if (notes.value.trim()) {
        allNotes.push(notes.value.trim());
      }
      if (allNotes.length > 0) {
        formData.append("notes", allNotes.join("; "));
      }
      if (artworkType.value.trim()) {
        formData.append("artwork_type", artworkType.value.trim());
      }
      if (access.value.trim()) {
        formData.append("access", access.value.trim());
      }
      if (artist.value.trim()) {
        formData.append("artist", artist.value.trim());
      }
      if (material.value.trim()) {
        formData.append("material", material.value.trim());
      }
      const response = await apiService.postRaw("/submissions", formData);
      lastSubmissionId.value = response.id;
      condition.value = "";
      notes.value = "";
      artworkType.value = "";
      access.value = "";
      artist.value = "";
      material.value = "";
      return { success: true, submissionId: response.id };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      if (isNetworkError(err)) {
        submitError.value = "Submission Failed. Please check your connection and try again.";
      } else if (isRateLimited(err)) {
        submitError.value = "Too many submissions. Please wait a moment before trying again.";
        await fetchArtworkDetails(artworkId);
      } else if (errorMessage.includes("cooldown")) {
        submitError.value = errorMessage;
        await fetchArtworkDetails(artworkId);
      } else {
        submitError.value = errorMessage;
        clearForm();
      }
      console.error("Logbook submission failed:", err);
      return { success: false };
    } finally {
      isSubmitting.value = false;
    }
  }
  function clearForm() {
    selectedPhoto.value = null;
    photoPreview.value = null;
    condition.value = "";
    notes.value = "";
    artworkType.value = "";
    access.value = "";
    artist.value = "";
    material.value = "";
    submitError.value = null;
  }
  function clearErrors() {
    artworkError.value = null;
    submitError.value = null;
  }
  function reset() {
    artwork.value = null;
    isLoadingArtwork.value = false;
    artworkError.value = null;
    isSubmitting.value = false;
    lastSubmissionId.value = null;
    clearForm();
  }
  return {
    // State
    artwork,
    isLoadingArtwork,
    artworkError,
    selectedPhoto,
    photoPreview,
    condition,
    notes,
    artworkType,
    access,
    artist,
    material,
    isSubmitting,
    submitError,
    lastSubmissionId,
    // Computed
    hasPhoto,
    isOnCooldown,
    cooldownUntil,
    cooldownMessage,
    canSubmit,
    hasFormData,
    // Actions
    fetchArtworkDetails,
    setPhoto,
    removePhoto,
    setCondition,
    setNotes,
    setArtworkType,
    setAccess,
    setArtist,
    setMaterial,
    submitLogbookEntry,
    clearForm,
    clearErrors,
    reset
  };
});

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "LogbookSubmissionView",
  __ssrInlineRender: true,
  props: {
    artworkId: {}
  },
  setup(__props) {
    const route = useRoute();
    useRouter();
    const store = useLogbookSubmissionStore();
    const fastUploadStore = useFastUploadSessionStore();
    const props = __props;
    const consentSection = ref(null);
    const consentCheckboxes = ref({
      cc0Licensing: false,
      termsAndGuidelines: false,
      photoRights: false
    });
    const artworkId = computed(() => props.artworkId || route.params.artworkId);
    const allConsentsAccepted = computed(() => {
      return Object.values(consentCheckboxes.value).every(Boolean);
    });
    const canSubmit = computed(() => {
      const hasValidPhoto = store.hasPhoto || hasExistingPhoto.value;
      return !store.isOnCooldown && hasValidPhoto && !store.isSubmitting && !store.isLoadingArtwork && !!store.artwork && allConsentsAccepted.value;
    });
    const isFromFastUpload = computed(() => {
      return route.query.source === "fast-upload";
    });
    const fastUploadSessionData = ref(null);
    const hasExistingPhoto = computed(() => {
      return isFromFastUpload.value && // Check Pinia store first (has File objects)
      (fastUploadStore.hasPhotos && fastUploadStore.photos.length > 0 || // Fallback to sessionStorage data
      fastUploadSessionData.value?.photos && fastUploadSessionData.value.photos.length > 0);
    });
    const fastUploadPhotoName = computed(() => {
      if (!hasExistingPhoto.value) return null;
      if (fastUploadStore.hasPhotos && fastUploadStore.photos.length > 0) {
        return fastUploadStore.photos[0]?.name || "Unknown filename";
      }
      if (fastUploadSessionData.value?.photos && fastUploadSessionData.value.photos.length > 0) {
        return fastUploadSessionData.value.photos[0]?.name || "Unknown filename";
      }
      return null;
    });
    const fastUploadPhotoPreview = computed(() => {
      if (!hasExistingPhoto.value) return null;
      if (fastUploadStore.hasPhotos && fastUploadStore.photos.length > 0) {
        return fastUploadStore.photos[0]?.preview || null;
      }
      return null;
    });
    const fastUploadPhotoFile = computed(() => {
      if (!hasExistingPhoto.value) return null;
      if (fastUploadStore.hasPhotos && fastUploadStore.photos.length > 0) {
        return fastUploadStore.photos[0]?.file || null;
      }
      return null;
    });
    function handleConsentChanged(consents) {
      consentCheckboxes.value = consents;
    }
    watch(
      artworkId,
      (newId) => {
        if (newId) {
          store.fetchArtworkDetails(newId);
        }
      },
      { immediate: true }
    );
    onMounted(() => {
      if (isFromFastUpload.value) {
        const sessionData = sessionStorage.getItem("fast-upload-session");
        if (sessionData) {
          try {
            fastUploadSessionData.value = JSON.parse(sessionData);
            console.log("[LOGBOOK DEBUG] Loaded session data from sessionStorage:", {
              photosCount: fastUploadSessionData.value?.photos?.length || 0,
              firstPhotoName: fastUploadSessionData.value?.photos?.[0]?.name
            });
          } catch (error) {
            console.error("[LOGBOOK] Failed to parse fast upload session data:", error);
            fastUploadSessionData.value = null;
          }
        }
        if (fastUploadPhotoFile.value && !store.hasPhoto) {
          console.log("[LOGBOOK DEBUG] Auto-setting fast upload photo in store from Pinia");
          store.setPhoto(fastUploadPhotoFile.value);
        }
      }
      console.log("[LOGBOOK DEBUG] Component mounted:", {
        isFromFastUpload: isFromFastUpload.value,
        hasExistingPhoto: hasExistingPhoto.value,
        fastUploadPhotoName: fastUploadPhotoName.value,
        source: route.query.source,
        sessionDataLoaded: !!fastUploadSessionData.value
      });
      store.clearForm();
      store.clearErrors();
      if (hasExistingPhoto.value) {
        console.log("[LOGBOOK] Fast upload photo detected:", fastUploadPhotoName.value);
        console.log("[LOGBOOK] Photo was already uploaded during fast upload process");
      }
      if (artworkId.value) {
        store.fetchArtworkDetails(artworkId.value);
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        "data-testid": "logbook-submission-view",
        class: "min-h-screen bg-gray-50 py-8"
      }, _attrs))}><div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8"><div data-testid="submission-header" class="bg-green-600 text-white px-6 py-4 rounded-t-lg"><div class="flex items-center justify-between"><div><h1 class="text-2xl font-bold">Log a Visit</h1><p data-testid="log-visit-banner" class="text-green-100 mt-1"> Document your visit to this artwork </p></div><button class="text-green-100 hover:text-white transition-colors"><svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div></div><div class="bg-white shadow-lg rounded-b-lg overflow-hidden">`);
      if (unref(store).isLoadingArtwork) {
        _push(`<div data-testid="loading-spinner" class="p-8 text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div><p class="mt-4 text-gray-600">Loading artwork details...</p></div>`);
      } else if (unref(store).artworkError) {
        _push(`<div data-testid="error-state" class="p-8 text-center">`);
        _push(ssrRenderComponent(unref(ExclamationTriangleIcon), { class: "h-12 w-12 text-red-500 mx-auto" }, null, _parent));
        _push(`<h3 class="mt-4 text-lg font-medium text-gray-900">Failed to Load Artwork</h3><p class="mt-2 text-gray-600">${ssrInterpolate(unref(store).artworkError)}</p><button data-testid="try-again-button" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"> Try Again </button></div>`);
      } else if (unref(store).isOnCooldown) {
        _push(`<div data-testid="cooldown-state" class="p-8 text-center">`);
        _push(ssrRenderComponent(unref(CheckCircleIcon), { class: "h-12 w-12 text-green-500 mx-auto" }, null, _parent));
        _push(`<h3 class="mt-4 text-lg font-medium text-gray-900">Recent Visit Recorded</h3><p class="mt-2 text-gray-600">${ssrInterpolate(unref(store).cooldownMessage)}</p><button data-testid="cooldown-go-back" class="mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"> Go Back </button></div>`);
      } else if (unref(store).artwork) {
        _push(`<div data-testid="main-form" class="p-6"><div data-testid="artwork-info" class="mb-6 p-4 bg-gray-50 rounded-lg"><h2 class="text-lg font-semibold text-gray-900 mb-2">${ssrInterpolate(unref(store).artwork.title || "Untitled Artwork")}</h2><div class="text-sm text-gray-600 space-y-1">`);
        if (unref(store).artwork.artist_name) {
          _push(`<p>Artist: ${ssrInterpolate(unref(store).artwork.artist_name)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<p>Type: ${ssrInterpolate(unref(store).artwork.type_name?.replace(/_/g, " "))}</p></div></div><form class="space-y-6"><div data-testid="photo-upload-section"><label class="block text-sm font-medium text-gray-700 mb-2"> Photo of your visit <span class="text-red-500">*</span></label><p class="text-sm text-gray-600 mb-3">`);
        if (!isFromFastUpload.value) {
          _push(`<span>Upload a photo showing the artwork as proof of your visit</span>`);
        } else {
          _push(`<span>Photo from your fast upload session has been automatically selected</span>`);
        }
        _push(`</p>`);
        if (hasExistingPhoto.value) {
          _push(`<div class="space-y-4">`);
          if (fastUploadPhotoPreview.value) {
            _push(`<div class="relative"><img${ssrRenderAttr("src", fastUploadPhotoPreview.value)} alt="Fast upload photo preview" class="w-full h-64 object-cover rounded-lg"><div class="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium"> Fast Upload Photo </div></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`<div class="bg-green-50 border border-green-200 rounded-lg p-4"><div class="flex items-start">`);
          _push(ssrRenderComponent(unref(CheckCircleIcon), { class: "h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" }, null, _parent));
          _push(`<div><h4 class="text-sm font-medium text-green-900">Photo Selected</h4><p class="text-sm text-green-700 mt-1"> Photo &quot;${ssrInterpolate(fastUploadPhotoName.value)}&quot; from your fast upload session is ready for submission. </p></div></div></div><div class="text-center"><input type="file" accept="image/*" class="hidden" id="photo-upload-change"><label for="photo-upload-change" class="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"> Use Different Photo </label></div></div>`);
        } else if (!unref(store).selectedPhoto) {
          _push(`<div data-testid="photo-input" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">`);
          _push(ssrRenderComponent(unref(PhotoIcon), { class: "h-12 w-12 text-gray-400 mx-auto mb-4" }, null, _parent));
          _push(`<p class="text-sm text-gray-600 mb-2">Click to select a photo</p><input type="file" accept="image/*" class="hidden" id="photo-upload"><label for="photo-upload" class="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"> Choose Photo </label></div>`);
        } else {
          _push(`<div data-testid="photo-preview" class="space-y-3"><div class="relative">`);
          if (unref(store).photoPreview) {
            _push(`<img${ssrRenderAttr("src", unref(store).photoPreview)} alt="Preview" class="w-full h-64 object-cover rounded-lg">`);
          } else {
            _push(`<!---->`);
          }
          _push(`<button type="button" data-testid="remove-photo-button" class="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div><p class="text-sm text-gray-600">${ssrInterpolate(unref(store).selectedPhoto?.name)}</p></div>`);
        }
        _push(`</div><div data-testid="condition-section"><label class="block text-sm font-medium text-gray-700 mb-2"> What is the current condition? (Optional) </label><div class="grid grid-cols-2 gap-3"><label class="${ssrRenderClass([{ "border-blue-500 bg-blue-50": unref(store).condition === "Good" }, "flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"])}"><input type="radio"${ssrIncludeBooleanAttr(ssrLooseEqual(unref(store).condition, "Good")) ? " checked" : ""} value="Good" class="sr-only"><div class="${ssrRenderClass([{ "border-blue-500": unref(store).condition === "Good" }, "w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center"])}">`);
        if (unref(store).condition === "Good") {
          _push(`<div class="w-2 h-2 bg-blue-500 rounded-full"></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><span class="text-sm">Good</span></label><label class="${ssrRenderClass([{ "border-blue-500 bg-blue-50": unref(store).condition === "Damaged" }, "flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"])}"><input type="radio"${ssrIncludeBooleanAttr(ssrLooseEqual(unref(store).condition, "Damaged")) ? " checked" : ""} value="Damaged" class="sr-only"><div class="${ssrRenderClass([{ "border-blue-500": unref(store).condition === "Damaged" }, "w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center"])}">`);
        if (unref(store).condition === "Damaged") {
          _push(`<div class="w-2 h-2 bg-blue-500 rounded-full"></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><span class="text-sm">Damaged</span></label><label class="${ssrRenderClass([{ "border-blue-500 bg-blue-50": unref(store).condition === "Missing" }, "flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"])}"><input type="radio"${ssrIncludeBooleanAttr(ssrLooseEqual(unref(store).condition, "Missing")) ? " checked" : ""} value="Missing" class="sr-only"><div class="${ssrRenderClass([{ "border-blue-500": unref(store).condition === "Missing" }, "w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center"])}">`);
        if (unref(store).condition === "Missing") {
          _push(`<div class="w-2 h-2 bg-blue-500 rounded-full"></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><span class="text-sm">Missing</span></label><label class="${ssrRenderClass([{ "border-blue-500 bg-blue-50": unref(store).condition === "Removed" }, "flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"])}"><input type="radio"${ssrIncludeBooleanAttr(ssrLooseEqual(unref(store).condition, "Removed")) ? " checked" : ""} value="Removed" class="sr-only"><div class="${ssrRenderClass([{ "border-blue-500": unref(store).condition === "Removed" }, "w-4 h-4 border border-gray-300 rounded-full mr-3 flex items-center justify-center"])}">`);
        if (unref(store).condition === "Removed") {
          _push(`<div class="w-2 h-2 bg-blue-500 rounded-full"></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><span class="text-sm">Removed</span></label></div></div><div data-testid="improvement-section"><h3 class="text-lg font-medium text-gray-900 mb-4">Help Us Improve This Listing</h3><p class="text-sm text-gray-600 mb-4"> Fill in any missing information you know about this artwork </p><div class="grid grid-cols-1 md:grid-cols-2 gap-4">`);
        if (!unref(store).artwork.type_name || unref(store).artwork.type_name === "unknown") {
          _push(`<div><label class="block text-sm font-medium text-gray-700 mb-1">Artwork Type</label><input type="text"${ssrRenderAttr("value", unref(store).artworkType)} placeholder="e.g., sculpture, mural, statue" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"></div>`);
        } else {
          _push(`<!---->`);
        }
        if (!unref(store).artwork.tags_parsed?.access) {
          _push(`<div><label class="block text-sm font-medium text-gray-700 mb-1">Access</label><select class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"><option value=""${ssrIncludeBooleanAttr(Array.isArray(unref(store).access) ? ssrLooseContain(unref(store).access, "") : ssrLooseEqual(unref(store).access, "")) ? " selected" : ""}>Select access level</option><option value="public"${ssrIncludeBooleanAttr(Array.isArray(unref(store).access) ? ssrLooseContain(unref(store).access, "public") : ssrLooseEqual(unref(store).access, "public")) ? " selected" : ""}>Public</option><option value="restricted"${ssrIncludeBooleanAttr(Array.isArray(unref(store).access) ? ssrLooseContain(unref(store).access, "restricted") : ssrLooseEqual(unref(store).access, "restricted")) ? " selected" : ""}>Restricted</option><option value="private"${ssrIncludeBooleanAttr(Array.isArray(unref(store).access) ? ssrLooseContain(unref(store).access, "private") : ssrLooseEqual(unref(store).access, "private")) ? " selected" : ""}>Private</option></select></div>`);
        } else {
          _push(`<!---->`);
        }
        if (!unref(store).artwork.artist_name) {
          _push(`<div><label class="block text-sm font-medium text-gray-700 mb-1">Artist</label><input type="text"${ssrRenderAttr("value", unref(store).artist)} placeholder="Artist name" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"></div>`);
        } else {
          _push(`<!---->`);
        }
        if (!unref(store).artwork.tags_parsed?.material) {
          _push(`<div><label class="block text-sm font-medium text-gray-700 mb-1">Material</label><input type="text"${ssrRenderAttr("value", unref(store).material)} placeholder="e.g., bronze, stone, paint" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
        if (unref(store).submitError) {
          _push(`<div class="p-4 bg-red-50 border border-red-200 rounded-md"><div class="flex">`);
          _push(ssrRenderComponent(unref(ExclamationTriangleIcon), { class: "h-5 w-5 text-red-400" }, null, _parent));
          _push(`<div class="ml-3"><p class="text-sm text-red-800">${ssrInterpolate(unref(store).submitError)}</p></div></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="mt-8">`);
        _push(ssrRenderComponent(_sfc_main$1, {
          ref_key: "consentSection",
          ref: consentSection,
          "consent-version": "2025-01-01",
          onConsentChanged: handleConsentChanged
        }, null, _parent));
        _push(`</div><div class="flex space-x-4"><button type="button" data-testid="cancel-button" class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"> Cancel </button><button type="submit"${ssrIncludeBooleanAttr(!canSubmit.value) ? " disabled" : ""} data-testid="submit-button" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">`);
        if (unref(store).isSubmitting) {
          _push(`<span class="flex items-center justify-center"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> Submitting... </span>`);
        } else {
          _push(`<span>Submit Logbook Entry</span>`);
        }
        _push(`</button></div></form></div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/LogbookSubmissionView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=LogbookSubmissionView-B_XlaByd.js.map
