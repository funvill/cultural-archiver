import { defineComponent, ref, computed, watch, mergeProps, useSSRContext, onMounted, unref, withCtx, createVNode, toDisplayString } from 'vue';
import { ssrRenderAttrs, ssrInterpolate, ssrRenderAttr, ssrRenderClass, ssrIncludeBooleanAttr, ssrRenderStyle, ssrLooseContain, ssrLooseEqual, ssrRenderList, ssrRenderComponent } from 'vue/server-renderer';
import { _ as _export_sfc, i as isClient, c as canUseLocalStorage, a as apiService, d as useAuthStore } from '../ssr-entry-server.js';
import { useRouter } from 'vue-router';
import { A as ArtworkCard } from './ArtworkCard-0An4ZMhk.js';
import { B as BadgeGrid } from './BadgeGrid-DHoxwODk.js';
import { u as useUserLists } from './useUserLists-CYQ0cJyO.js';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';
import './image-CoH3F98X.js';

const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "ProfileNameEditor",
  __ssrInlineRender: true,
  props: {
    currentProfileName: {}
  },
  emits: ["profileUpdated"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const isEditing = ref(false);
    const profileNameInput = ref("");
    const isLoading = ref(false);
    const isCheckingAvailability = ref(false);
    const validationError = ref("");
    const availabilityMessage = ref("");
    const isAvailable = ref(false);
    const successMessage = ref("");
    const canSave = computed(() => {
      return profileNameInput.value.length >= 3 && profileNameInput.value.length <= 20 && isAvailable.value && !validationError.value && profileNameInput.value !== props.currentProfileName;
    });
    watch(
      () => props.currentProfileName,
      (newValue) => {
        if (!isEditing.value && newValue) {
          profileNameInput.value = newValue;
        }
      }
    );
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "profile-name-editor" }, _attrs))} data-v-baa9b943>`);
      if (!isEditing.value && _ctx.currentProfileName) {
        _push(`<div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg" data-v-baa9b943><div data-v-baa9b943><h4 class="font-medium text-gray-900" data-v-baa9b943>Profile Name</h4><p class="text-sm text-gray-600" data-v-baa9b943>${ssrInterpolate(_ctx.currentProfileName)}</p></div><button class="text-blue-600 hover:text-blue-700 text-sm font-medium" data-v-baa9b943> Edit </button></div>`);
      } else if (!isEditing.value && !_ctx.currentProfileName) {
        _push(`<div class="p-4 bg-blue-50 rounded-lg border border-blue-200" data-v-baa9b943><div class="flex items-start" data-v-baa9b943><svg class="w-5 h-5 text-blue-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20" data-v-baa9b943><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" data-v-baa9b943></path></svg><div class="flex-1" data-v-baa9b943><h4 class="font-medium text-blue-900 mb-1" data-v-baa9b943>Set up your profile name</h4><p class="text-sm text-blue-700 mb-3" data-v-baa9b943> Choose a unique profile name to make your contributions public and earn badges. </p><button class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors" data-v-baa9b943> Choose Profile Name </button></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (isEditing.value) {
        _push(`<div class="space-y-4" data-v-baa9b943><div data-v-baa9b943><label for="profile-name" class="block text-sm font-medium text-gray-700 mb-2" data-v-baa9b943> Profile Name </label><div class="relative" data-v-baa9b943><input id="profile-name"${ssrRenderAttr("value", profileNameInput.value)} type="text" placeholder="Enter a unique profile name" class="${ssrRenderClass([{
          "border-red-300 focus:ring-red-500 focus:border-red-500": validationError.value,
          "border-green-300 focus:ring-green-500 focus:border-green-500": isAvailable.value && profileNameInput.value.length >= 3
        }, "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"])}"${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} maxlength="20" data-v-baa9b943>`);
        if (isCheckingAvailability.value) {
          _push(`<div class="absolute right-3 top-2.5" data-v-baa9b943><svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" data-v-baa9b943><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-baa9b943></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-baa9b943></path></svg></div>`);
        } else if (profileNameInput.value.length >= 3) {
          _push(`<div class="absolute right-3 top-2.5" data-v-baa9b943>`);
          if (isAvailable.value) {
            _push(`<svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20" data-v-baa9b943><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" data-v-baa9b943></path></svg>`);
          } else {
            _push(`<svg class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20" data-v-baa9b943><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" data-v-baa9b943></path></svg>`);
          }
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div class="flex justify-between items-center mt-1" data-v-baa9b943><p class="text-xs text-gray-500" data-v-baa9b943>3-20 characters. Letters, numbers, and dashes only.</p><span class="text-xs text-gray-500" data-v-baa9b943>${ssrInterpolate(profileNameInput.value.length)}/20 </span></div>`);
        if (validationError.value) {
          _push(`<div class="mt-2 text-sm text-red-600" data-v-baa9b943>${ssrInterpolate(validationError.value)}</div>`);
        } else if (availabilityMessage.value) {
          _push(`<div class="${ssrRenderClass([{
            "text-green-600": isAvailable.value,
            "text-red-600": !isAvailable.value
          }, "mt-2 text-sm"])}" data-v-baa9b943>${ssrInterpolate(availabilityMessage.value)}</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div class="flex space-x-3" data-v-baa9b943><button${ssrIncludeBooleanAttr(!canSave.value || isLoading.value) ? " disabled" : ""} class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors" data-v-baa9b943>`);
        if (isLoading.value) {
          _push(`<span class="flex items-center justify-center" data-v-baa9b943><svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" data-v-baa9b943><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-baa9b943></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-baa9b943></path></svg> Saving... </span>`);
        } else {
          _push(`<span data-v-baa9b943>Save Profile Name</span>`);
        }
        _push(`</button><button${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} class="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors" data-v-baa9b943> Cancel </button></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (successMessage.value) {
        _push(`<div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg" data-v-baa9b943><div class="flex items-center" data-v-baa9b943><svg class="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20" data-v-baa9b943><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" data-v-baa9b943></path></svg><p class="text-sm text-green-800" data-v-baa9b943>${ssrInterpolate(successMessage.value)}</p></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ProfileNameEditor.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const ProfileNameEditor = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-baa9b943"]]);

const setCssVar = (name, value) => {
  if (!value) return;
  if (!isClient) return;
  try {
    document.documentElement.style.setProperty(name, value);
  } catch (e) {
  }
};
function applyTheme(theme) {
  setCssVar("--md-primary", theme.primary);
  setCssVar("--md-primary-variant", theme.primaryVariant);
  setCssVar("--md-secondary", theme.secondary);
  setCssVar("--md-secondary-variant", theme.secondaryVariant);
  setCssVar("--md-background", theme.background);
  setCssVar("--md-surface", theme.surface);
  setCssVar("--md-error", theme.error);
  setCssVar("--md-on-primary", theme.onPrimary);
  setCssVar("--md-on-secondary", theme.onSecondary);
  setCssVar("--md-success", theme.success);
  setCssVar("--md-on-success", theme.onSuccess);
  setCssVar("--md-warning", theme.warning);
  setCssVar("--md-on-warning", theme.onWarning);
  setCssVar("--md-on-background", theme.onBackground);
  setCssVar("--md-on-surface", theme.onSurface);
  setCssVar("--md-on-error", theme.onError);
  setCssVar("--md-nav-link", theme.navLink);
  setCssVar("--md-nav-link-hover", theme.navLinkHover);
  setCssVar("--md-nav-border", theme.navBorder);
  setCssVar("--md-nav-active", theme.navActive);
  setCssVar("--md-nav-active-background", theme.navActiveBackground);
  setCssVar("--md-text-muted", theme.textMuted);
  setCssVar("--md-text-subtle", theme.textSubtle);
  setCssVar("--md-hover-background", theme.hoverBackground);
  setCssVar("--md-icon-hover", theme.iconHover);
  setCssVar("--md-icon-hover-background", theme.iconHoverBackground);
  setCssVar("--md-nav-icon-hover", theme.navIconHover);
  setCssVar("--md-nav-icon-hover-background", theme.navIconHoverBackground);
  setCssVar("--md-content-background", theme.contentBackground);
  setCssVar("--md-card-background", theme.cardBackground);
  setCssVar("--md-card-border", theme.cardBorder);
  setCssVar("--md-section-border", theme.sectionBorder);
  setCssVar("--md-input-background", theme.inputBackground);
  setCssVar("--md-input-border", theme.inputBorder);
  setCssVar("--md-input-text", theme.inputText);
  setCssVar("--md-placeholder-text", theme.placeholderText);
  setCssVar("--md-button-secondary", theme.buttonSecondary);
  setCssVar("--md-button-secondary-hover", theme.buttonSecondaryHover);
  setCssVar("--md-button-outline", theme.buttonOutline);
  setCssVar("--md-button-outline-hover", theme.buttonOutlineHover);
  setCssVar("--md-tag-background", theme.tagBackground);
  setCssVar("--md-tag-text", theme.tagText);
  setCssVar("--md-badge-background", theme.badgeBackground);
  setCssVar("--md-badge-text", theme.badgeText);
  try {
    if (isClient) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && theme.primary) meta.content = theme.primary;
    }
  } catch (e) {
  }
}
const defaultMaterialTheme = {
  primary: "#1e88e5",
  // blue 600
  primaryVariant: "#1565c0",
  secondary: "#8e24aa",
  // purple 600
  secondaryVariant: "#6a1b9a",
  background: "#f8fafc",
  // gray-50 / near white
  surface: "#ffffff",
  error: "#b00020",
  success: "#16a34a",
  // green-600
  warning: "#f59e0b",
  // amber-500
  onPrimary: "#ffffff",
  onSecondary: "#ffffff",
  onSuccess: "#ffffff",
  onWarning: "#111827",
  onBackground: "#111827",
  // gray-900
  onSurface: "#111827",
  onError: "#ffffff",
  // Navigation-specific
  navLink: "#1e88e5",
  navLinkHover: "#1565c0",
  navBorder: "#e5e7eb",
  navActive: "#1e88e5",
  navActiveBackground: "#dbeafe",
  // Utility colors
  textMuted: "#6b7280",
  textSubtle: "#9ca3af",
  hoverBackground: "rgba(255, 255, 255, 0.1)",
  // Semi-transparent white for better contrast on primary
  // Icon hover effects
  iconHover: "#1e88e5",
  // Blue fill on hover
  iconHoverBackground: "rgba(30, 136, 229, 0.1)",
  // Light blue background
  navIconHover: "#FF0000",
  navIconHoverBackground: "rgba(255, 255, 255, 0.15)",
  // Semi-transparent white background
  // Content area colors
  contentBackground: "#f9fafb",
  cardBackground: "#ffffff",
  cardBorder: "#e5e7eb",
  sectionBorder: "#f3f4f6",
  // Form and input colors
  inputBackground: "#ffffff",
  inputBorder: "#d1d5db",
  inputText: "#111827",
  placeholderText: "#6b7280",
  // Button variants
  buttonSecondary: "#f3f4f6",
  buttonSecondaryHover: "#e5e7eb",
  buttonOutline: "transparent",
  buttonOutlineHover: "#f3f4f6",
  // Badge and tag colors
  tagBackground: "#f3f4f6",
  tagText: "#374151",
  badgeBackground: "#dbeafe",
  badgeText: "#1e40af"
};
const bauhausTheme = {
  // Bauhaus-inspired bold primary colors
  primary: "#e63946",
  // deep red
  primaryVariant: "#b22234",
  secondary: "#f4d35e",
  // warm yellow
  secondaryVariant: "#f5c400",
  background: "#ffffff",
  surface: "#ffffff",
  error: "#d7263d",
  success: "#2a9d8f",
  warning: "#f4d35e",
  onPrimary: "#ffffff",
  onSecondary: "#111827",
  onSuccess: "#ffffff",
  onWarning: "#111827",
  onBackground: "#111827",
  onSurface: "#111827",
  onError: "#ffffff",
  // Navigation-specific
  navLink: "#e63946",
  navLinkHover: "#b22234",
  navBorder: "#e5e7eb",
  navActive: "#e63946",
  navActiveBackground: "#fef2f2",
  // Utility colors
  textMuted: "#6b7280",
  textSubtle: "#9ca3af",
  hoverBackground: "#fef2f2",
  // Icon hover effects
  iconHover: "#e63946",
  // Deep red fill on hover
  iconHoverBackground: "rgba(230, 57, 70, 0.1)",
  // Light red background
  navIconHover: "#ffffff",
  // White fill for nav icons
  navIconHoverBackground: "rgba(255, 255, 255, 0.15)",
  // Semi-transparent white background
  // Content area colors
  contentBackground: "#fffbeb",
  cardBackground: "#ffffff",
  cardBorder: "#f5c400",
  sectionBorder: "#fef3c7",
  // Form and input colors
  inputBackground: "#ffffff",
  inputBorder: "#f5c400",
  inputText: "#111827",
  placeholderText: "#6b7280",
  // Button variants
  buttonSecondary: "#fef3c7",
  buttonSecondaryHover: "#f5c400",
  buttonOutline: "transparent",
  buttonOutlineHover: "#fef3c7",
  // Badge and tag colors
  tagBackground: "#fef3c7",
  tagText: "#92400e",
  badgeBackground: "#fef2f2",
  badgeText: "#b91c1c"
};
const VancouverTheme = {
  "primary": "#0284c7",
  // sky-600
  "primaryVariant": "#0369a1",
  "secondary": "#10b981",
  // emerald-500
  "secondaryVariant": "#047857",
  "background": "#f0fdfa",
  // teal-50
  "surface": "#ffffff",
  "error": "#dc2626",
  // red-600
  "success": "#16a34a",
  // green-600
  "warning": "#f97316",
  // orange-500
  "onPrimary": "#ffffff",
  "onSecondary": "#ffffff",
  "onSuccess": "#ffffff",
  "onWarning": "#111827",
  "onBackground": "#0f172a",
  // slate-900
  "onSurface": "#0f172a",
  "onError": "#ffffff",
  // Navigation-specific
  navLink: "#0284c7",
  navLinkHover: "#0369a1",
  navBorder: "#a7f3d0",
  navActive: "#0284c7",
  navActiveBackground: "#e0f2fe",
  // Utility colors
  textMuted: "#64748b",
  textSubtle: "#94a3b8",
  hoverBackground: "#f0f9ff",
  // Icon hover effects
  iconHover: "#0284c7",
  // Sky blue fill on hover
  iconHoverBackground: "rgba(2, 132, 199, 0.1)",
  // Light sky blue background
  navIconHover: "#ffffff",
  // White fill for nav icons
  navIconHoverBackground: "rgba(255, 255, 255, 0.15)",
  // Semi-transparent white background
  // Content area colors
  contentBackground: "#f0f9ff",
  cardBackground: "#ffffff",
  cardBorder: "#a7f3d0",
  sectionBorder: "#ecfdf5",
  // Form and input colors
  inputBackground: "#ffffff",
  inputBorder: "#a7f3d0",
  inputText: "#0f172a",
  placeholderText: "#64748b",
  // Button variants
  buttonSecondary: "#ecfdf5",
  buttonSecondaryHover: "#d1fae5",
  buttonOutline: "transparent",
  buttonOutlineHover: "#f0f9ff",
  // Badge and tag colors
  tagBackground: "#ecfdf5",
  tagText: "#064e3b",
  badgeBackground: "#e0f2fe",
  badgeText: "#0c4a6e"
};
const DarkGalleryTheme = {
  "primary": "#6366f1",
  // indigo-500
  "primaryVariant": "#4338ca",
  "secondary": "#f43f5e",
  // rose-500
  "secondaryVariant": "#9f1239",
  "background": "#111827",
  // gray-900
  "surface": "#1f2937",
  // gray-800
  "error": "#ef4444",
  // red-500
  "success": "#22c55e",
  // green-500
  "warning": "#eab308",
  // yellow-500
  "onPrimary": "#ffffff",
  "onSecondary": "#ffffff",
  "onSuccess": "#111827",
  "onWarning": "#111827",
  "onBackground": "#f9fafb",
  // gray-50
  "onSurface": "#f9fafb",
  "onError": "#ffffff",
  // Navigation-specific
  navLink: "#6366f1",
  navLinkHover: "#818cf8",
  navBorder: "#374151",
  navActive: "#6366f1",
  navActiveBackground: "#312e81",
  // Utility colors
  textMuted: "#9ca3af",
  textSubtle: "#6b7280",
  hoverBackground: "#374151",
  // Icon hover effects
  iconHover: "#6366f1",
  // Indigo fill on hover
  iconHoverBackground: "rgba(99, 102, 241, 0.1)",
  // Light indigo background
  navIconHover: "#ffffff",
  // White fill for nav icons
  navIconHoverBackground: "rgba(255, 255, 255, 0.1)",
  // Semi-transparent white background
  // Content area colors
  contentBackground: "#0f172a",
  cardBackground: "#1f2937",
  cardBorder: "#374151",
  sectionBorder: "#4b5563",
  // Form and input colors
  inputBackground: "#1f2937",
  inputBorder: "#4b5563",
  inputText: "#f9fafb",
  placeholderText: "#9ca3af",
  // Button variants
  buttonSecondary: "#374151",
  buttonSecondaryHover: "#4b5563",
  buttonOutline: "transparent",
  buttonOutlineHover: "#374151",
  // Badge and tag colors
  tagBackground: "#374151",
  tagText: "#d1d5db",
  badgeBackground: "#312e81",
  badgeText: "#c7d2fe"
};
const EarthyCulturalTheme = {
  "primary": "#d97706",
  // amber-700
  "primaryVariant": "#92400e",
  "secondary": "#065f46",
  // emerald-800
  "secondaryVariant": "#064e3b",
  "background": "#fdfcf9",
  // warm off-white
  "surface": "#ffffff",
  "error": "#b91c1c",
  // red-700
  "success": "#15803d",
  // green-700
  "warning": "#facc15",
  // yellow-400
  "onPrimary": "#ffffff",
  "onSecondary": "#ffffff",
  "onSuccess": "#ffffff",
  "onWarning": "#111827",
  "onBackground": "#1f2937",
  // gray-800
  "onSurface": "#1f2937",
  "onError": "#ffffff",
  // Navigation-specific
  navLink: "#d97706",
  navLinkHover: "#92400e",
  navBorder: "#f3e8d3",
  navActive: "#d97706",
  navActiveBackground: "#fef3c7",
  // Utility colors
  textMuted: "#78716c",
  textSubtle: "#a8a29e",
  hoverBackground: "#fef7ed",
  // Icon hover effects
  iconHover: "#d97706",
  // Amber fill on hover
  iconHoverBackground: "rgba(217, 119, 6, 0.1)",
  // Light amber background
  navIconHover: "#ffffff",
  // White fill for nav icons
  navIconHoverBackground: "rgba(255, 255, 255, 0.15)",
  // Semi-transparent white background
  // Content area colors
  contentBackground: "#fefcf9",
  cardBackground: "#ffffff",
  cardBorder: "#e7e5e4",
  sectionBorder: "#f5f5f4",
  // Form and input colors
  inputBackground: "#ffffff",
  inputBorder: "#e7e5e4",
  inputText: "#1f2937",
  placeholderText: "#78716c",
  // Button variants
  buttonSecondary: "#f5f5f4",
  buttonSecondaryHover: "#e7e5e4",
  buttonOutline: "transparent",
  buttonOutlineHover: "#fef7ed",
  // Badge and tag colors
  tagBackground: "#f5f5f4",
  tagText: "#57534e",
  badgeBackground: "#fef3c7",
  badgeText: "#92400e"
};
const HighContrastDebugTheme = {
  "primary": "#ff1493",
  // hot pink - very obvious
  "primaryVariant": "#dc143c",
  // crimson
  "secondary": "#00ff00",
  // lime green - highly visible
  "secondaryVariant": "#32cd32",
  // lime green variant
  "background": "#ffa500",
  // orange - can't miss it
  "surface": "#ffff00",
  // bright yellow - stands out
  "error": "#ff0000",
  // pure red
  "success": "#00ffff",
  // cyan - unusual choice
  "warning": "#ff4500",
  // orange-red - different from background
  "onPrimary": "#2e003e",
  // dark purple instead of black
  "onSecondary": "#4a1a00",
  // dark brown instead of black
  "onSuccess": "#003366",
  // dark blue instead of black
  "onWarning": "#ffffcc",
  // light yellow instead of white 
  "onBackground": "#330066",
  // dark purple instead of black
  "onSurface": "#663300",
  // dark brown instead of black
  "onError": "#ffccff",
  // light pink instead of white
  // Navigation-specific
  "navLink": "#9400d3",
  // violet - easy to spot links
  "navLinkHover": "#4b0082",
  // indigo - darker violet on hover
  "navBorder": "#ff69b4",
  // hot pink - different from primary
  "navActive": "#8a2be2",
  // blue-violet for active states
  "navActiveBackground": "#dda0dd",
  // plum background for active
  // Utility colors
  "textMuted": "#8b008b",
  // dark magenta for muted text
  "textSubtle": "#9370db",
  // medium slate blue for subtle text
  "hoverBackground": "#e6e6fa",
  // lavender for hover backgrounds
  // Icon hover effects
  "iconHover": "#ff1493",
  // Hot pink fill on hover
  "iconHoverBackground": "rgba(255, 20, 147, 0.2)",
  // Light hot pink background
  "navIconHover": "#ffff00",
  // Bright yellow fill for nav icons
  "navIconHoverBackground": "rgba(255, 255, 0, 0.2)",
  // Light yellow background
  // Content area colors
  "contentBackground": "#f0e68c",
  // khaki - distinct content area
  "cardBackground": "#87ceeb",
  // sky blue - cards stand out
  "cardBorder": "#4682b4",
  // steel blue - card borders
  "sectionBorder": "#20b2aa",
  // light sea green - section dividers
  // Form and input colors
  "inputBackground": "#ffd700",
  // gold - input fields obvious
  "inputBorder": "#b8860b",
  // dark goldenrod - input borders
  "inputText": "#4a1a00",
  // dark brown - input text (no black)
  "placeholderText": "#8b4513",
  // saddle brown - placeholder text (no white/gray)
  // Button variants
  "buttonSecondary": "#40e0d0",
  // turquoise - secondary buttons
  "buttonSecondaryHover": "#00ced1",
  // dark turquoise on hover
  "buttonOutline": "#da70d6",
  // orchid - outline buttons
  "buttonOutlineHover": "#ba55d3",
  // medium orchid on hover
  // Badge and tag colors
  "tagBackground": "#98fb98",
  // pale green - tag backgrounds
  "tagText": "#006400",
  // dark green - tag text
  "badgeBackground": "#ffd1dc",
  // pink - badge backgrounds
  "badgeText": "#8b0000"
  // dark red - badge text
};
const themes = {
  material: defaultMaterialTheme,
  bauhaus: bauhausTheme,
  Vancouver: VancouverTheme,
  DarkGallery: DarkGalleryTheme,
  EarthyCultural: EarthyCulturalTheme,
  HighContrastDebug: HighContrastDebugTheme
};
function applyThemeByName(name) {
  const t = themes[name];
  if (t) applyTheme(t);
}

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "ThemeToggle",
  __ssrInlineRender: true,
  setup(__props) {
    const available = computed(() => Object.keys(themes));
    const selected = ref("");
    onMounted(() => {
      if (!canUseLocalStorage()) return;
      try {
        const saved = localStorage.getItem("user-theme");
        if (saved) selected.value = saved;
      } catch (e) {
      }
    });
    watch(selected, async (val) => {
      if (!val) return;
      if (isClient) applyThemeByName(val);
      try {
        await apiService.updateUserPreferences({ theme: val });
        if (canUseLocalStorage()) {
          try {
            localStorage.setItem("user-theme", val);
          } catch (e) {
          }
        }
      } catch (err) {
        if (canUseLocalStorage()) {
          try {
            localStorage.setItem("user-theme", val);
          } catch (e) {
          }
        }
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "theme-toggle inline-flex items-center space-x-2" }, _attrs))} data-v-98735cd1><label class="text-sm theme-on-surface" data-v-98735cd1>Theme</label><select class="px-3 py-2 rounded theme-surface theme-on-surface" style="${ssrRenderStyle({ borderColor: "var(--md-outline, #9ca3af)" })}" data-v-98735cd1><option disabled value="" data-v-98735cd1${ssrIncludeBooleanAttr(Array.isArray(selected.value) ? ssrLooseContain(selected.value, "") : ssrLooseEqual(selected.value, "")) ? " selected" : ""}>Select a theme</option><!--[-->`);
      ssrRenderList(available.value, (name) => {
        _push(`<option${ssrRenderAttr("value", name)} data-v-98735cd1${ssrIncludeBooleanAttr(Array.isArray(selected.value) ? ssrLooseContain(selected.value, name) : ssrLooseEqual(selected.value, name)) ? " selected" : ""}>${ssrInterpolate(name)}</option>`);
      });
      _push(`<!--]--></select></div>`);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ThemeToggle.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const ThemeToggle = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-98735cd1"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ProfileView",
  __ssrInlineRender: true,
  setup(__props) {
    const submissions = ref([]);
    const profile = ref(null);
    const isLoading = ref(true);
    const error = ref(null);
    const filterStatus = ref("all");
    const sortOrder = ref("newest");
    const router = useRouter();
    const artworksById = ref({});
    const userBadges = ref([]);
    const badgesLoading = ref(false);
    const currentProfileName = ref(null);
    const { lists: userLists, isLoading: listsLoading, error: listsError, fetchUserLists } = useUserLists();
    function toSearchResult(submission) {
      const linked = submission.artwork_id ? artworksById.value[submission.artwork_id] : void 0;
      const titleFromSubmission = submission.data_parsed?.title || submission.data_parsed?.tags?.title || submission.data_parsed?.tags?.name || null;
      const artistFromSubmission = submission.data_parsed?.tags?.artist || null;
      const photos = submission.data_parsed?.photos || [];
      const recentPhotoFromSubmission = photos.length > 0 && photos[0]?.url ? String(photos[0].url) : null;
      const id = linked?.id || submission.artwork_id || submission.id;
      const lat = linked?.lat ?? submission.lat ?? 0;
      const lon = linked?.lon ?? submission.lon ?? 0;
      const typeName = linked?.type_name || submission.data_parsed?.tags?.artwork_type || submission.artwork_type_name || "artwork";
      const resolvedTitle = linked?.title && linked.title.trim().length > 0 ? linked.title : titleFromSubmission && titleFromSubmission.trim().length > 0 ? titleFromSubmission : "Unknown Artwork Title";
      const resolvedArtist = linked?.artist_name && linked.artist_name.trim().length > 0 ? linked.artist_name : linked?.created_by && linked.created_by.trim().length > 0 ? linked.created_by : artistFromSubmission && artistFromSubmission.trim().length > 0 ? artistFromSubmission : "Unknown Artist";
      const recentPhoto = recentPhotoFromSubmission ? recentPhotoFromSubmission : Array.isArray(linked?.photos) && linked.photos[0] ? String(linked.photos[0]) : null;
      const photoCount = (photos.length || 0) > 0 ? photos.length : Array.isArray(linked?.photos) ? linked.photos.length : 0;
      const tags = linked?.tags_parsed || submission.data_parsed?.tags || null;
      return {
        id,
        lat,
        lon,
        type_name: String(typeName),
        title: resolvedTitle,
        artist_name: resolvedArtist,
        tags,
        recent_photo: recentPhoto,
        photo_count: photoCount,
        distance_km: null
      };
    }
    function onCardClick(artwork) {
      if (artwork && artwork.id && submissions.value.some((s) => s.artwork_id === artwork.id)) {
        router.push(`/artwork/${artwork.id}`);
      }
    }
    const filteredAndSortedSubmissions = computed(() => {
      let processed = submissions.value.map((s) => {
        const data_parsed = {};
        if (s.field_changes) {
          try {
            const changes = JSON.parse(s.field_changes);
            data_parsed.title = changes.title?.new || changes.title;
            data_parsed.tags = changes.tags?.new || changes.tags;
          } catch (e) {
            console.error("Error parsing field_changes", e);
          }
        }
        if (s.photos) {
          try {
            data_parsed.photos = JSON.parse(s.photos);
          } catch (e) {
            console.error("Error parsing photos", e);
          }
        }
        if (s.lat !== null && s.lat !== void 0) {
          data_parsed.lat = s.lat;
        }
        if (s.lon !== null && s.lon !== void 0) {
          data_parsed.lon = s.lon;
        }
        let artwork_type_name = "Submission";
        if (data_parsed.tags?.artwork_type) {
          artwork_type_name = data_parsed.tags.artwork_type.replace(/_/g, " ");
        }
        return { ...s, data_parsed, artwork_type_name };
      });
      if (filterStatus.value !== "all") {
        processed = processed.filter((s) => s.status === filterStatus.value);
      }
      processed.sort((a, b) => {
        const dateA = new Date(a.submitted_at).getTime();
        const dateB = new Date(b.submitted_at).getTime();
        return sortOrder.value === "newest" ? dateB - dateA : dateA - dateB;
      });
      return processed;
    });
    const submissionStats = computed(() => {
      return submissions.value.reduce(
        (acc, s) => {
          acc.total++;
          if (s.status === "pending") acc.pending++;
          else if (s.status === "approved") acc.approved++;
          else if (s.status === "rejected") acc.rejected++;
          return acc;
        },
        { total: 0, pending: 0, approved: 0, rejected: 0 }
      );
    });
    async function fetchUserProfile() {
      try {
        isLoading.value = true;
        const response = await apiService.getUserProfile();
        if (response.data) {
          profile.value = response.data;
          currentProfileName.value = null;
        }
        await Promise.all([fetchUserSubmissions(), fetchUserBadges()]);
      } catch (err) {
        error.value = "Failed to fetch user profile.";
        console.error(err);
      } finally {
        isLoading.value = false;
      }
    }
    async function fetchUserSubmissions() {
      try {
        const response = await apiService.getUserSubmissions();
        if (response && response.data && response.data.submissions) {
          submissions.value = response.data.submissions;
          await fetchLinkedArtworks();
        }
      } catch (err) {
        error.value = "Failed to fetch user submissions.";
        console.error(err);
      }
    }
    async function fetchLinkedArtworks() {
      const ids = Array.from(
        new Set(
          submissions.value.map((s) => s.artwork_id).filter((id) => !!id)
        )
      );
      const missing = ids.filter((id) => !artworksById.value[id]);
      if (missing.length === 0) return;
      const results = await Promise.all(
        missing.map(async (id) => {
          try {
            const details = await apiService.getArtworkDetails(id);
            return { id, details };
          } catch (e) {
            console.warn("Failed to load artwork details for submission", id, e);
            return null;
          }
        })
      );
      results.forEach((r) => {
        if (r) {
          artworksById.value[r.id] = r.details;
        }
      });
    }
    function getStatusClass(status) {
      switch (status) {
        case "approved":
          return "theme-success theme-on-success";
        case "pending":
          return "theme-warning theme-on-warning";
        case "rejected":
          return "theme-error theme-on-error";
        default:
          return "theme-surface-variant theme-on-surface-variant";
      }
    }
    function formatDateSafe(primary, fallback) {
      const dStr = primary || fallback || "";
      const d = new Date(dStr);
      if (Number.isNaN(d.getTime())) return "Unknown date";
      return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    }
    async function fetchUserBadges() {
      try {
        badgesLoading.value = true;
        const response = await apiService.getUserBadges();
        if (response.success && response.data) {
          userBadges.value = response.data.user_badges;
        }
      } catch (err) {
        console.error("Failed to fetch user badges:", err);
      } finally {
        badgesLoading.value = false;
      }
    }
    function onProfileUpdated(newProfileName) {
      currentProfileName.value = newProfileName;
    }
    const systemLists = computed(() => {
      return userLists.value.filter((list) => list.is_system_list);
    });
    const customUserLists = computed(() => {
      return userLists.value.filter((list) => !list.is_system_list);
    });
    onMounted(() => {
      fetchUserProfile();
      fetchUserLists();
    });
    const authStore = useAuthStore();
    const displayToken = computed(() => {
      try {
        return authStore.token || (typeof window !== "undefined" ? localStorage.getItem("user-token") : null) || null;
      } catch (e) {
        return authStore.token || null;
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "profile-view p-4 sm:p-6 lg:p-8" }, _attrs))} data-v-8a5231ae>`);
      if (isLoading.value) {
        _push(`<div class="text-center" data-v-8a5231ae><p data-v-8a5231ae>Loading profile...</p></div>`);
      } else {
        _push(`<!---->`);
      }
      if (error.value) {
        _push(`<div class="text-center theme-error" data-v-8a5231ae><p data-v-8a5231ae>${ssrInterpolate(error.value)}</p></div>`);
      } else {
        _push(`<!---->`);
      }
      if (!isLoading.value && !error.value && profile.value) {
        _push(`<div data-v-8a5231ae><header class="mb-8" data-v-8a5231ae><h1 class="text-3xl font-bold tracking-tight theme-on-background" data-v-8a5231ae>My Profile</h1><p class="mt-2 text-lg theme-muted" data-v-8a5231ae> Welcome back, <span class="font-semibold" data-v-8a5231ae>${ssrInterpolate(profile.value.debug?.user_info?.email || "Contributor")}</span>. </p></header><section class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8" data-v-8a5231ae><div class="p-6 rounded-lg shadow theme-surface" data-v-8a5231ae><h3 class="text-sm font-medium theme-muted" data-v-8a5231ae>Total Submissions</h3><p class="mt-2 text-3xl font-bold theme-on-surface" data-v-8a5231ae>${ssrInterpolate(submissionStats.value.total)}</p></div><div class="p-6 rounded-lg shadow theme-surface" data-v-8a5231ae><h3 class="text-sm font-medium theme-muted" data-v-8a5231ae>Approved</h3><p class="mt-2 text-3xl font-bold theme-on-success" data-v-8a5231ae>${ssrInterpolate(submissionStats.value.approved)}</p></div><div class="p-6 rounded-lg shadow theme-surface" data-v-8a5231ae><h3 class="text-sm font-medium theme-muted" data-v-8a5231ae>Pending</h3><p class="mt-2 text-3xl font-bold theme-on-warning" data-v-8a5231ae>${ssrInterpolate(submissionStats.value.pending)}</p></div><div class="p-6 rounded-lg shadow theme-surface" data-v-8a5231ae><h3 class="text-sm font-medium theme-muted" data-v-8a5231ae>Rejected</h3><p class="mt-2 text-3xl font-bold theme-on-error" data-v-8a5231ae>${ssrInterpolate(submissionStats.value.rejected)}</p></div></section><section class="mb-8" data-v-8a5231ae><div class="p-6 rounded-lg shadow theme-surface" data-v-8a5231ae><h2 class="text-xl font-semibold theme-on-surface mb-4" data-v-8a5231ae>Profile Settings</h2>`);
        _push(ssrRenderComponent(ProfileNameEditor, {
          currentProfileName: currentProfileName.value,
          onProfileUpdated
        }, null, _parent));
        _push(`<div class="mt-6" data-v-8a5231ae>`);
        _push(ssrRenderComponent(ThemeToggle, null, null, _parent));
        _push(`</div></div></section><section class="mb-8" data-v-8a5231ae><div class="p-6 rounded-lg shadow theme-surface" data-v-8a5231ae><h2 class="text-xl font-semibold theme-on-surface mb-4" data-v-8a5231ae>Developer Info</h2><p class="text-sm theme-muted mb-2" data-v-8a5231ae>This section shows your local user token and active permissions (useful for debugging).</p><div class="text-sm" data-v-8a5231ae><div class="mb-2" data-v-8a5231ae><span class="font-medium" data-v-8a5231ae>User token:</span><code class="ml-2 truncate block max-w-full" data-v-8a5231ae>${ssrInterpolate(displayToken.value || "none")}</code></div><div data-v-8a5231ae><span class="font-medium" data-v-8a5231ae>Permissions:</span><span class="ml-2" data-v-8a5231ae>${ssrInterpolate(unref(authStore).permissions && unref(authStore).permissions.length ? unref(authStore).permissions.join(", ") : "none")}</span></div></div></div></section><section class="mb-8" data-v-8a5231ae><div class="p-6 rounded-lg shadow theme-surface" data-v-8a5231ae>`);
        _push(ssrRenderComponent(BadgeGrid, {
          badges: userBadges.value,
          loading: badgesLoading.value
        }, null, _parent));
        _push(`</div></section><section class="mb-8" data-v-8a5231ae><div class="p-6 rounded-lg shadow theme-surface" data-v-8a5231ae><div class="flex items-center justify-between mb-6" data-v-8a5231ae><h2 class="text-2xl font-bold theme-on-surface" data-v-8a5231ae>My Lists</h2><p class="text-sm theme-muted" data-v-8a5231ae>${ssrInterpolate(unref(userLists).length)} lists</p></div>`);
        if (unref(listsLoading)) {
          _push(`<div class="text-center py-8" data-v-8a5231ae><div class="inline-flex items-center" data-v-8a5231ae><svg class="animate-spin -ml-1 mr-3 h-5 w-5 theme-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" data-v-8a5231ae><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" data-v-8a5231ae></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" data-v-8a5231ae></path></svg> Loading lists... </div></div>`);
        } else if (unref(listsError)) {
          _push(`<div class="text-center py-8" data-v-8a5231ae><p class="theme-error" data-v-8a5231ae>${ssrInterpolate(unref(listsError))}</p><button class="mt-2 text-sm font-medium theme-primary" style="${ssrRenderStyle({ color: "var(--md-primary, #2563eb)" })}" data-v-8a5231ae> Try Again </button></div>`);
        } else if (unref(userLists).length === 0) {
          _push(`<div class="text-center py-8" data-v-8a5231ae><svg class="mx-auto h-12 w-12 mb-4 theme-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-8a5231ae><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" data-v-8a5231ae></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 812-2h4a2 2 0 012 2v0a2 2 0 01-2 2H10a2 2 0 01-2-2v0z" data-v-8a5231ae></path></svg><h3 class="text-lg font-medium theme-on-surface mb-2" data-v-8a5231ae>No Lists Yet</h3><p class="theme-on-surface-variant mb-4" data-v-8a5231ae>Create your first list by visiting an artwork page and clicking &quot;Add to List&quot;.</p><button class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md theme-primary theme-on-primary" data-v-8a5231ae> Explore Artworks </button></div>`);
        } else {
          _push(`<div class="space-y-8" data-v-8a5231ae>`);
          if (systemLists.value.length > 0) {
            _push(`<div data-v-8a5231ae><h3 class="text-lg font-semibold theme-on-surface mb-4 flex items-center" data-v-8a5231ae><svg class="w-5 h-5 mr-2 theme-primary" fill="currentColor" viewBox="0 0 20 20" data-v-8a5231ae><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" data-v-8a5231ae></path></svg> System Lists </h3><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-v-8a5231ae><!--[-->`);
            ssrRenderList(systemLists.value, (list) => {
              _push(`<div class="rounded-lg p-4 border theme-border hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors" data-v-8a5231ae><div class="flex items-start justify-between mb-3" data-v-8a5231ae><h4 class="font-semibold theme-on-surface truncate pr-2" data-v-8a5231ae>${ssrInterpolate(list.name)}</h4><span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 theme-primary-container theme-on-primary-container" data-v-8a5231ae> System </span></div><div class="flex items-center justify-between text-sm theme-on-surface-variant" data-v-8a5231ae><span data-v-8a5231ae>${ssrInterpolate(list.item_count || 0)} artworks</span><span data-v-8a5231ae>${ssrInterpolate(formatDateSafe(list.updated_at, list.created_at))}</span></div><div class="mt-2 flex items-center text-xs theme-muted" data-v-8a5231ae><svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-8a5231ae><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" data-v-8a5231ae></path></svg> ${ssrInterpolate(list.visibility === "private" ? "Private" : "Unlisted")}</div></div>`);
            });
            _push(`<!--]--></div></div>`);
          } else {
            _push(`<!---->`);
          }
          if (customUserLists.value.length > 0) {
            _push(`<div data-v-8a5231ae><h3 class="text-lg font-semibold theme-on-surface mb-4 flex items-center" data-v-8a5231ae><svg class="w-5 h-5 mr-2 theme-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-8a5231ae><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" data-v-8a5231ae></path></svg> My Custom Lists <span class="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium theme-surface-variant theme-on-surface-variant" data-v-8a5231ae>${ssrInterpolate(customUserLists.value.length)}</span></h3><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-v-8a5231ae><!--[-->`);
            ssrRenderList(customUserLists.value, (list) => {
              _push(`<div class="rounded-lg p-4 border theme-border hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors" data-v-8a5231ae><div class="flex items-start justify-between mb-3" data-v-8a5231ae><h4 class="font-semibold theme-on-surface truncate pr-2" data-v-8a5231ae>${ssrInterpolate(list.name)}</h4></div><div class="flex items-center justify-between text-sm theme-on-surface-variant" data-v-8a5231ae><span data-v-8a5231ae>${ssrInterpolate(list.item_count || 0)} artworks</span><span data-v-8a5231ae>${ssrInterpolate(formatDateSafe(list.updated_at, list.created_at))}</span></div><div class="mt-2 flex items-center text-xs theme-muted" data-v-8a5231ae><svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" data-v-8a5231ae><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" data-v-8a5231ae></path></svg> ${ssrInterpolate(list.visibility === "private" ? "Private" : "Unlisted")}</div></div>`);
            });
            _push(`<!--]--></div></div>`);
          } else {
            _push(`<!---->`);
          }
          if (systemLists.value.length > 0 && customUserLists.value.length === 0) {
            _push(`<div class="text-center py-6" data-v-8a5231ae><svg class="mx-auto h-10 w-10 mb-3 theme-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-8a5231ae><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" data-v-8a5231ae></path></svg><h4 class="text-md font-medium theme-on-surface mb-2" data-v-8a5231ae>Create Your First Custom List</h4><p class="text-sm theme-on-surface-variant mb-3" data-v-8a5231ae>Organize your favorite artworks into custom collections.</p><button class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md theme-primary theme-on-primary" data-v-8a5231ae> Browse Artworks </button></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
        }
        _push(`</div></section><section data-v-8a5231ae><div class="flex flex-wrap items-center justify-between mb-4 gap-4" data-v-8a5231ae><h2 class="text-2xl font-bold" data-v-8a5231ae>My Submissions</h2><div class="flex flex-wrap items-center gap-4" data-v-8a5231ae><div data-v-8a5231ae><label for="filter-status" class="sr-only" data-v-8a5231ae>Filter by status</label><select id="filter-status" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" data-v-8a5231ae><option value="all" data-v-8a5231ae${ssrIncludeBooleanAttr(Array.isArray(filterStatus.value) ? ssrLooseContain(filterStatus.value, "all") : ssrLooseEqual(filterStatus.value, "all")) ? " selected" : ""}>All Statuses</option><option value="pending" data-v-8a5231ae${ssrIncludeBooleanAttr(Array.isArray(filterStatus.value) ? ssrLooseContain(filterStatus.value, "pending") : ssrLooseEqual(filterStatus.value, "pending")) ? " selected" : ""}>Pending</option><option value="approved" data-v-8a5231ae${ssrIncludeBooleanAttr(Array.isArray(filterStatus.value) ? ssrLooseContain(filterStatus.value, "approved") : ssrLooseEqual(filterStatus.value, "approved")) ? " selected" : ""}>Approved</option><option value="rejected" data-v-8a5231ae${ssrIncludeBooleanAttr(Array.isArray(filterStatus.value) ? ssrLooseContain(filterStatus.value, "rejected") : ssrLooseEqual(filterStatus.value, "rejected")) ? " selected" : ""}>Rejected</option></select></div><div data-v-8a5231ae><label for="sort-order" class="sr-only" data-v-8a5231ae>Sort order</label><select id="sort-order" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" data-v-8a5231ae><option value="newest" data-v-8a5231ae${ssrIncludeBooleanAttr(Array.isArray(sortOrder.value) ? ssrLooseContain(sortOrder.value, "newest") : ssrLooseEqual(sortOrder.value, "newest")) ? " selected" : ""}>Newest First</option><option value="oldest" data-v-8a5231ae${ssrIncludeBooleanAttr(Array.isArray(sortOrder.value) ? ssrLooseContain(sortOrder.value, "oldest") : ssrLooseEqual(sortOrder.value, "oldest")) ? " selected" : ""}>Oldest First</option></select></div></div></div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-v-8a5231ae><!--[-->`);
        ssrRenderList(filteredAndSortedSubmissions.value, (submission) => {
          _push(`<div data-v-8a5231ae>`);
          _push(ssrRenderComponent(ArtworkCard, {
            artwork: toSearchResult(submission),
            clickable: !!submission.artwork_id,
            "show-distance": false,
            onClick: onCardClick
          }, {
            badge: withCtx((_, _push2, _parent2, _scopeId) => {
              if (_push2) {
                _push2(`<span class="${ssrRenderClass([getStatusClass(submission.status), "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-opacity-90"])}" data-v-8a5231ae${_scopeId}>${ssrInterpolate(submission.status.charAt(0).toUpperCase() + submission.status.slice(1))}</span>`);
              } else {
                return [
                  createVNode("span", {
                    class: [getStatusClass(submission.status), "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-opacity-90"]
                  }, toDisplayString(submission.status.charAt(0).toUpperCase() + submission.status.slice(1)), 3)
                ];
              }
            }),
            _: 2
          }, _parent));
          _push(`<div class="mt-2 flex items-center justify-between" data-v-8a5231ae><span class="text-xs theme-outline" data-v-8a5231ae>${ssrInterpolate(submission.submission_type.replace(/_/g, " "))}</span><span class="text-xs theme-outline" data-v-8a5231ae>${ssrInterpolate(formatDateSafe(submission.submitted_at, submission.created_at))} `);
          if (submission.lat && submission.lon) {
            _push(`<span data-v-8a5231ae> • ${ssrInterpolate(submission.lat.toFixed(4))}, ${ssrInterpolate(submission.lon.toFixed(4))}</span>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</span></div></div>`);
        });
        _push(`<!--]--></div></section></div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ProfileView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ProfileView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-8a5231ae"]]);

export { ProfileView as default };
//# sourceMappingURL=ProfileView-DSb8eB5X.js.map
