import { defineComponent, ref, watch, computed, onMounted, useSSRContext } from 'vue';
import { ssrInterpolate, ssrRenderAttr, ssrIncludeBooleanAttr, ssrRenderStyle, ssrRenderList, ssrRenderComponent } from 'vue/server-renderer';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useRouter } from 'vue-router';
import { d as useAuthStore, h as FeedbackDialog, a as apiService, f as useAnnouncer, _ as _export_sfc } from '../ssr-entry-server.js';
import { T as TagBadge, P as PhotoCarousel } from './TagBadge-6cthaYHD.js';
import { u as useToasts } from './useToasts-PudGFTbq.js';
import { g as getMetaForRoute, d as createArtistSchema, u as useRouteMeta } from './meta-DUKRt9TT.js';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';
import './image-CoH3F98X.js';
import './tagSchema-DxDwFgYK.js';

function sanitizeHtml(input) {
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      "a",
      "b",
      "i",
      "em",
      "strong",
      "p",
      "ul",
      "ol",
      "li",
      "br",
      "span",
      "blockquote",
      "code",
      "pre",
      "hr",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6"
    ],
    ALLOWED_ATTR: ["href", "title", "rel"],
    FORCE_BODY: true
  });
}

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ArtistDetailView",
  __ssrInlineRender: true,
  props: {
    id: {}
  },
  setup(__props) {
    const props = __props;
    const authStore = useAuthStore();
    const router = useRouter();
    const { announceError, announceSuccess } = useAnnouncer();
    const loading = ref(true);
    const error = ref(null);
    const artist = ref(null);
    const showFeedbackDialog = ref(false);
    const feedbackMode = ref("comment");
    const { success: toastSuccess } = useToasts();
    ref();
    ref();
    const isEditMode = ref(false);
    const editLoading = ref(false);
    const editError = ref(null);
    const showCancelDialog = ref(false);
    const showSuccessModal = ref(false);
    const hasPendingEdits = ref(false);
    const pendingEditSubmittedAt = ref(null);
    const editData = ref({
      name: "",
      description: "",
      tags: {}
    });
    const originalData = ref({
      name: "",
      description: "",
      tags: {}
    });
    const renderedBio = ref("");
    watch(
      () => artist.value?.description,
      async (desc) => {
        if (!desc) {
          renderedBio.value = "";
          return;
        }
        try {
          const parsed = await marked(desc);
          renderedBio.value = sanitizeHtml(parsed);
        } catch (err) {
          console.error("Failed to render artist bio markdown:", err);
          renderedBio.value = "";
        }
      },
      { immediate: true }
    );
    const hasUnsavedChanges = computed(() => {
      return editData.value.name !== originalData.value.name || editData.value.description !== originalData.value.description || JSON.stringify(editData.value.tags) !== JSON.stringify(originalData.value.tags);
    });
    const artworkPhotos = computed(() => {
      if (!artist.value?.artworks) return [];
      return artist.value.artworks.filter((artwork) => artwork.recent_photo).map((artwork) => artwork.recent_photo);
    });
    async function loadArtist() {
      try {
        loading.value = true;
        error.value = null;
        const response = await apiService.get(`/artists/${props.id}`);
        if (!response.success || !response.data) {
          error.value = response.message || "Failed to load artist";
          return;
        }
        artist.value = response.data;
        if (artist.value) {
          editData.value = {
            name: artist.value.name,
            description: artist.value.description || "",
            tags: artist.value.tags_parsed || {}
          };
          originalData.value = { ...editData.value };
          try {
            const base = getMetaForRoute("artist");
            const title = `${artist.value.name} - Public Art Registry`;
            const description = artist.value.description && artist.value.description.slice(0, 160) || base.description;
            const canonical = typeof window !== "undefined" && window.location ? `${window.location.origin}${router.currentRoute.value.fullPath}` : router.currentRoute.value.fullPath;
            const metadata = {
              title,
              description,
              canonical,
              ogImage: artist.value.artworks && artist.value.artworks[0]?.recent_photo || void 0,
              ogType: "profile"
            };
            let sameAs = [];
            try {
              const tagsParsed = artist.value.tags_parsed || {};
              if (Array.isArray(tagsParsed.sameAs)) {
                sameAs = tagsParsed.sameAs;
              } else if (typeof tagsParsed.website === "string") {
                sameAs = [tagsParsed.website];
              }
            } catch (err) {
            }
            const jsonld = createArtistSchema({
              id: artist.value.id,
              name: artist.value.name,
              bio: artist.value.description || "",
              sameAs
            });
            useRouteMeta(metadata, jsonld);
          } catch (err) {
            console.warn("Failed to set artist SEO metadata", err);
          }
        }
      } catch (err) {
        console.error("Failed to load artist:", err);
        error.value = "Failed to load artist details. Please try again.";
        announceError("Failed to load artist details");
      } finally {
        loading.value = false;
      }
    }
    async function checkPendingEdits() {
      if (!authStore.isAuthenticated) return;
      try {
        const response = await apiService.get(`/artists/${props.id}/pending-edits`);
        if (response.success && response.data) {
          hasPendingEdits.value = response.data.has_pending_edits;
          pendingEditSubmittedAt.value = response.data.submitted_at || null;
        }
      } catch (err) {
        console.error("Failed to check pending edits:", err);
      }
    }
    function handleFeedbackSuccess() {
      showFeedbackDialog.value = false;
      announceSuccess("Thank you for your feedback! Moderators will review it shortly.");
      toastSuccess("Feedback submitted successfully");
    }
    function handleFeedbackCancel() {
      showFeedbackDialog.value = false;
    }
    function navigateToArtwork(artworkId) {
      router.push(`/artwork/${artworkId}`);
    }
    onMounted(() => {
      loadArtist();
      checkPendingEdits();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<!--[--><div class="container mx-auto px-4 py-6 max-w-6xl" data-v-5011153c>`);
      if (loading.value) {
        _push(`<div class="text-center py-12" data-v-5011153c><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" data-v-5011153c></div><p class="mt-4 text-gray-600" data-v-5011153c>Loading artist details...</p></div>`);
      } else if (error.value) {
        _push(`<div class="text-center py-12" data-v-5011153c><div class="text-red-600 mb-4" data-v-5011153c><svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-5011153c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" data-v-5011153c></path></svg></div><h2 class="text-xl font-semibold text-gray-900 mb-2" data-v-5011153c>${ssrInterpolate(error.value)}</h2><button class="text-blue-600 hover:text-blue-700 underline" data-v-5011153c> Try Again </button></div>`);
      } else if (artist.value) {
        _push(`<div class="space-y-8" data-v-5011153c><div class="border-b border-gray-200 pb-6" data-v-5011153c><div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4" data-v-5011153c><div class="flex-1" data-v-5011153c>`);
        if (!isEditMode.value) {
          _push(`<h1 class="text-3xl font-bold text-gray-900" data-v-5011153c>${ssrInterpolate(artist.value.name)}</h1>`);
        } else {
          _push(`<div data-v-5011153c><label for="edit-name" class="block text-sm font-medium text-gray-700 mb-1" data-v-5011153c> Artist Name </label><input id="edit-name"${ssrRenderAttr("value", editData.value.name)} type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter artist name" data-v-5011153c></div>`);
        }
        _push(`<div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600" data-v-5011153c>`);
        if (artist.value.artwork_count) {
          _push(`<span data-v-5011153c>${ssrInterpolate(artist.value.artwork_count)} artwork${ssrInterpolate(artist.value.artwork_count !== 1 ? "s" : "")}</span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<span data-v-5011153c>Active</span></div></div><div class="flex items-center gap-3" data-v-5011153c>`);
        if (hasPendingEdits.value) {
          _push(`<div class="text-sm" data-v-5011153c><div class="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg" data-v-5011153c><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-5011153c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" data-v-5011153c></path></svg><span data-v-5011153c>Edits pending moderation</span></div></div>`);
        } else {
          _push(`<!---->`);
        }
        if (!isEditMode.value) {
          _push(`<div data-v-5011153c><button${ssrIncludeBooleanAttr(hasPendingEdits.value) ? " disabled" : ""} class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" data-v-5011153c> Edit Artist Info </button></div>`);
        } else {
          _push(`<div class="flex items-center gap-2" data-v-5011153c><button class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500" data-v-5011153c> Cancel </button><button${ssrIncludeBooleanAttr(editLoading.value || !hasUnsavedChanges.value) ? " disabled" : ""} class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" data-v-5011153c>`);
          if (editLoading.value) {
            _push(`<span data-v-5011153c>Saving...</span>`);
          } else {
            _push(`<span data-v-5011153c>Save Changes</span>`);
          }
          _push(`</button></div>`);
        }
        _push(`</div></div>`);
        if (!isEditMode.value) {
          _push(`<div class="mt-4 flex gap-2" data-v-5011153c><button class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors" style="${ssrRenderStyle({
            background: "rgba(var(--md-error-container), 0.1)",
            color: "rgb(var(--md-error))",
            border: "1px solid rgba(var(--md-error), 0.2)"
          })}" type="button" data-v-5011153c><svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-5011153c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-1.964-1.333-2.732 0L3.082 16c-.77 1.333.192 3 1.732 3z" data-v-5011153c></path></svg> Report Missing </button><button class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors" style="${ssrRenderStyle({
            background: "rgba(var(--md-surface-variant), 0.5)",
            color: "rgb(var(--md-on-surface-variant))",
            border: "1px solid rgba(var(--md-outline), 0.3)"
          })}" type="button" data-v-5011153c><svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-5011153c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" data-v-5011153c></path></svg> Report Issue </button></div>`);
        } else {
          _push(`<!---->`);
        }
        if (editError.value) {
          _push(`<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg" data-v-5011153c><p class="text-red-800" data-v-5011153c>${ssrInterpolate(editError.value)}</p></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div class="grid grid-cols-1 lg:grid-cols-3 gap-8" data-v-5011153c><div class="lg:col-span-2 space-y-6" data-v-5011153c><div class="bg-white rounded-lg border border-gray-200 p-6" data-v-5011153c><h2 class="text-xl font-semibold text-gray-900 mb-4" data-v-5011153c>Biography</h2>`);
        if (!isEditMode.value) {
          _push(`<div data-v-5011153c>`);
          if (artist.value.description) {
            _push(`<div class="prose prose-gray max-w-none" data-v-5011153c>${renderedBio.value ?? ""}</div>`);
          } else {
            _push(`<p class="text-gray-500 italic" data-v-5011153c>No biography available.</p>`);
          }
          _push(`</div>`);
        } else {
          _push(`<div data-v-5011153c><label for="edit-description" class="block text-sm font-medium text-gray-700 mb-2" data-v-5011153c> Biography (Markdown supported) </label><textarea id="edit-description" rows="8" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter artist biography, artist statement, or CV..." data-v-5011153c>${ssrInterpolate(editData.value.description)}</textarea></div>`);
        }
        _push(`</div><div class="bg-white rounded-lg border border-gray-200 p-6" data-v-5011153c><h2 class="text-xl font-semibold text-gray-900 mb-4" data-v-5011153c>Information</h2>`);
        if (!isEditMode.value) {
          _push(`<div data-v-5011153c>`);
          if (Object.keys(artist.value.tags_parsed || {}).length > 0) {
            _push(`<div class="space-y-3" data-v-5011153c><!--[-->`);
            ssrRenderList(Object.entries(artist.value.tags_parsed || {}), ([key, value]) => {
              _push(`<div data-v-5011153c>`);
              _push(ssrRenderComponent(TagBadge, {
                tags: { [key]: String(value) }
              }, null, _parent));
              _push(`</div>`);
            });
            _push(`<!--]--></div>`);
          } else {
            _push(`<p class="text-gray-500 italic" data-v-5011153c>No additional information available.</p>`);
          }
          _push(`</div>`);
        } else {
          _push(`<div data-v-5011153c><div class="space-y-3 mb-4" data-v-5011153c><!--[-->`);
          ssrRenderList(Object.entries(editData.value.tags), ([key, value]) => {
            _push(`<div class="flex items-center gap-2 p-2 bg-gray-50 rounded" data-v-5011153c><span class="text-sm font-medium text-gray-700" data-v-5011153c>${ssrInterpolate(key)}:</span><span class="text-sm text-gray-600" data-v-5011153c>${ssrInterpolate(value)}</span><button class="text-red-600 hover:text-red-700" aria-label="Remove tag" data-v-5011153c><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-5011153c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" data-v-5011153c></path></svg></button></div>`);
          });
          _push(`<!--]--></div><div class="flex gap-2" data-v-5011153c><input type="text" placeholder="Key (e.g., website)" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-5011153c><input type="text" placeholder="Value" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-v-5011153c><button class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500" data-v-5011153c> Add </button></div></div>`);
        }
        _push(`</div></div><div class="space-y-6" data-v-5011153c><div class="bg-white rounded-lg border border-gray-200 p-6" data-v-5011153c><h2 class="text-xl font-semibold text-gray-900 mb-4" data-v-5011153c>Artworks</h2>`);
        if (artist.value.artworks && artist.value.artworks.length > 0) {
          _push(`<div class="space-y-4" data-v-5011153c><!--[-->`);
          ssrRenderList(artist.value.artworks, (artwork) => {
            _push(`<div class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer" data-v-5011153c>`);
            if (artwork.recent_photo) {
              _push(`<div class="aspect-w-16 aspect-h-9" data-v-5011153c><img${ssrRenderAttr("src", artwork.recent_photo)}${ssrRenderAttr("alt", artwork.title || "Artwork")} class="w-full h-32 object-cover" data-v-5011153c></div>`);
            } else {
              _push(`<!---->`);
            }
            _push(`<div class="p-3" data-v-5011153c><h3 class="font-medium text-gray-900" data-v-5011153c>${ssrInterpolate(artwork.title || "Untitled")}</h3><p class="text-sm text-gray-600 mt-1" data-v-5011153c>${ssrInterpolate(artwork.type_name)}</p>`);
            if (artwork.photo_count) {
              _push(`<p class="text-xs text-gray-500 mt-1" data-v-5011153c>${ssrInterpolate(artwork.photo_count)} photo${ssrInterpolate(artwork.photo_count !== 1 ? "s" : "")}</p>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div></div>`);
          });
          _push(`<!--]--></div>`);
        } else {
          _push(`<p class="text-gray-500 italic" data-v-5011153c>No artworks found for this artist.</p>`);
        }
        _push(`</div>`);
        if (artworkPhotos.value.length > 0) {
          _push(`<div class="bg-white rounded-lg border border-gray-200 p-6" data-v-5011153c><h2 class="text-xl font-semibold text-gray-900 mb-4" data-v-5011153c>Recent Photos</h2>`);
          _push(ssrRenderComponent(PhotoCarousel, {
            photos: artworkPhotos.value,
            onPhotoSelect: (index) => {
              if (artist.value?.artworks?.[index]) {
                navigateToArtwork(artist.value.artworks[index].id);
              }
            }
          }, null, _parent));
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showCancelDialog.value) {
        _push(`<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-v-5011153c><div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" data-v-5011153c><h3 class="text-lg font-medium text-gray-900 mb-4" data-v-5011153c>Discard Changes?</h3><p class="text-gray-600 mb-6" data-v-5011153c> You have unsaved changes. Are you sure you want to discard them? </p><div class="flex gap-3 justify-end" data-v-5011153c><button class="px-4 py-2 text-gray-600 hover:text-gray-700" data-v-5011153c> Keep Editing </button><button class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700" data-v-5011153c> Discard Changes </button></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showSuccessModal.value) {
        _push(`<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-v-5011153c><div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" data-v-5011153c><div class="flex items-center gap-3 mb-4" data-v-5011153c><div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center" data-v-5011153c><svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-5011153c><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" data-v-5011153c></path></svg></div><h3 class="text-lg font-medium text-gray-900" data-v-5011153c>Changes Submitted</h3></div><p class="text-gray-600 mb-6" data-v-5011153c> Your edits have been submitted for moderation and will be reviewed by our team. </p><div class="flex justify-end" data-v-5011153c><button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" data-v-5011153c> Close </button></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
      if (artist.value) {
        _push(ssrRenderComponent(FeedbackDialog, {
          open: showFeedbackDialog.value,
          "subject-type": "artist",
          "subject-id": props.id,
          mode: feedbackMode.value,
          onSuccess: handleFeedbackSuccess,
          onCancel: handleFeedbackCancel
        }, null, _parent));
      } else {
        _push(`<!---->`);
      }
      _push(`<!--]-->`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ArtistDetailView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ArtistDetailView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-5011153c"]]);

export { ArtistDetailView as default };
//# sourceMappingURL=ArtistDetailView-DW1v-QXl.js.map
