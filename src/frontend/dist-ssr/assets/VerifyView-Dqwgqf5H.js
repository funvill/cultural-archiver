import { defineComponent, ref, computed, onMounted, mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderClass, ssrInterpolate, ssrRenderComponent } from 'vue/server-renderer';
import { useRoute, useRouter } from 'vue-router';
import { n as useAuth, _ as _export_sfc } from '../ssr-entry-server.js';
import '@vue/server-renderer';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "MagicLinkVerify",
  __ssrInlineRender: true,
  setup(__props) {
    const isVerifying = ref(true);
    const verificationStatus = ref("pending");
    const message = ref("");
    const isNewAccount = ref(false);
    const redirectCountdown = ref(5);
    const route = useRoute();
    const router = useRouter();
    const { verifyMagicLink, initAuth, error } = useAuth();
    const statusIcon = computed(() => {
      switch (verificationStatus.value) {
        case "success":
          return {
            class: "text-green-600 bg-green-100"
          };
        case "error":
          return {
            class: "text-red-600 bg-red-100"
          };
        default:
          return {
            class: "text-blue-600 bg-blue-100"
          };
      }
    });
    const statusTitle = computed(() => {
      switch (verificationStatus.value) {
        case "success":
          return isNewAccount.value ? "Account Created!" : "Welcome Back!";
        case "error":
          return "Verification Failed";
        default:
          return "Verifying...";
      }
    });
    const statusMessage = computed(() => {
      if (message.value) return message.value;
      switch (verificationStatus.value) {
        case "success":
          return isNewAccount.value ? "Your account has been created successfully. You can now submit artwork and sync across devices." : "You have been signed in successfully. Your submissions are now synced across devices.";
        case "error":
          return error.value || "The magic link is invalid or has expired. Please request a new one.";
        default:
          return "Please wait while we verify your magic link...";
      }
    });
    onMounted(() => {
      const token = route.query.token;
      if (!token) {
        verificationStatus.value = "error";
        message.value = "No verification token provided";
        isVerifying.value = false;
        return;
      }
      performVerification(token);
    });
    async function performVerification(token) {
      try {
        const result = await verifyMagicLink(token);
        if (result.success) {
          verificationStatus.value = "success";
          message.value = result.message;
          isNewAccount.value = result.isNewAccount || false;
          console.log("[MAGIC LINK VERIFY] Initializing auth state after successful verification");
          await initAuth();
          console.log("[MAGIC LINK VERIFY] Auth state re-initialized successfully");
          startRedirectCountdown();
        } else {
          verificationStatus.value = "error";
          message.value = result.message;
        }
      } catch (err) {
        verificationStatus.value = "error";
        message.value = "An unexpected error occurred during verification";
      } finally {
        isVerifying.value = false;
      }
    }
    function startRedirectCountdown() {
      const interval = setInterval(() => {
        redirectCountdown.value--;
        if (redirectCountdown.value <= 0) {
          clearInterval(interval);
          redirectToProfile();
        }
      }, 1e3);
    }
    function redirectToProfile() {
      router.push("/profile");
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8" }, _attrs))} data-v-89048577><div class="sm:mx-auto sm:w-full sm:max-w-md" data-v-89048577><div class="text-center mb-8" data-v-89048577><h1 class="text-2xl font-bold text-gray-900" data-v-89048577>Cultural Archiver</h1><p class="text-sm text-gray-600 mt-2" data-v-89048577>Magic Link Verification</p></div><div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10" data-v-89048577><div class="text-center" data-v-89048577><div class="${ssrRenderClass([statusIcon.value.class, "mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-6"])}" data-v-89048577>`);
      if (verificationStatus.value === "success") {
        _push(`<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" data-v-89048577><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" data-v-89048577></path></svg>`);
      } else if (verificationStatus.value === "error") {
        _push(`<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" data-v-89048577><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" data-v-89048577></path></svg>`);
      } else {
        _push(`<svg class="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" data-v-89048577><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" data-v-89048577></path></svg>`);
      }
      _push(`</div><h2 class="text-xl font-semibold text-gray-900 mb-4" data-v-89048577>${ssrInterpolate(statusTitle.value)}</h2><p class="text-sm text-gray-600 mb-6 leading-relaxed" data-v-89048577>${ssrInterpolate(statusMessage.value)}</p>`);
      if (verificationStatus.value === "success") {
        _push(`<div class="space-y-4" data-v-89048577><div class="bg-green-50 rounded-md p-3" data-v-89048577><p class="text-sm text-green-800" data-v-89048577> Redirecting to your profile in ${ssrInterpolate(redirectCountdown.value)} seconds... </p></div><div class="flex flex-col sm:flex-row gap-3" data-v-89048577><button type="button" class="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-v-89048577> Go to Profile </button><button type="button" class="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2" data-v-89048577> Submit Artwork </button></div>`);
        if (isNewAccount.value) {
          _push(`<div class="bg-blue-50 rounded-md p-4 text-left" data-v-89048577><h4 class="text-sm font-medium text-blue-900 mb-2" data-v-89048577>What&#39;s next?</h4><ul class="text-xs text-blue-800 space-y-1" data-v-89048577><li data-v-89048577>• Your anonymous submissions are now linked to your account</li><li data-v-89048577>• You can access your profile across all devices</li><li data-v-89048577>• Track the status of your artwork submissions</li><li data-v-89048577>• Receive notifications about your submissions</li></ul></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      } else if (verificationStatus.value === "error") {
        _push(`<div class="space-y-4" data-v-89048577><div class="flex flex-col sm:flex-row gap-3" data-v-89048577><button type="button" class="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-v-89048577> Go to Home </button><button type="button" class="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-v-89048577> Go Back </button></div><div class="bg-yellow-50 rounded-md p-3" data-v-89048577><p class="text-xs text-yellow-800" data-v-89048577> If you continue to have issues, please try requesting a new magic link or contact support if the problem persists. </p></div></div>`);
      } else {
        _push(`<div class="space-y-4" data-v-89048577><div class="bg-blue-50 rounded-md p-3" data-v-89048577><p class="text-sm text-blue-800" data-v-89048577>This may take a few moments...</p></div></div>`);
      }
      _push(`</div></div><div class="mt-8 text-center" data-v-89048577><p class="text-xs text-gray-500" data-v-89048577> If you didn&#39;t request this verification, you can safely ignore this page. </p></div></div></div>`);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/MagicLinkVerify.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const MagicLinkVerify = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-89048577"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "VerifyView",
  __ssrInlineRender: true,
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      _push(ssrRenderComponent(MagicLinkVerify, _attrs, null, _parent));
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/VerifyView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=VerifyView-Dqwgqf5H.js.map
