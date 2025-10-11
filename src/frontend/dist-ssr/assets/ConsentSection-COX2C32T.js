import { defineComponent, ref, computed, watch, mergeProps, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderClass, ssrIncludeBooleanAttr, ssrLooseContain, ssrRenderComponent } from 'vue/server-renderer';
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ConsentSection",
  __ssrInlineRender: true,
  props: {
    consentVersion: {}
  },
  emits: ["consent-updated", "consentChanged"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const emit = __emit;
    const allConsentsAccepted = ref(false);
    const allConsentCheckboxesChecked = computed(() => {
      return allConsentsAccepted.value;
    });
    watch(
      allConsentsAccepted,
      (newValue) => {
        const consents = {
          cc0Licensing: newValue,
          termsAndGuidelines: newValue,
          photoRights: newValue
        };
        emit("consentChanged", consents);
      }
    );
    function resetConsents() {
      allConsentsAccepted.value = false;
    }
    __expose({
      resetConsents
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "consent-section" }, _attrs))}><div class="mb-6"><h4 class="text-lg font-medium text-gray-900 dark:text-white mb-2"> Consent &amp; Legal Requirements </h4><p class="text-sm text-gray-600 dark:text-gray-300"> Before submitting, please confirm that you have the necessary rights and permissions. </p></div><div class="mb-6"><div class="${ssrRenderClass([allConsentsAccepted.value ? "border-gray-200 dark:border-gray-700" : "border-red-500 dark:border-red-600 border-4", "flex items-start space-x-3 p-4 border rounded-lg"])}"><input id="consent-all"${ssrIncludeBooleanAttr(Array.isArray(allConsentsAccepted.value) ? ssrLooseContain(allConsentsAccepted.value, null) : allConsentsAccepted.value) ? " checked" : ""} type="checkbox" class="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"><label for="consent-all" class="text-sm text-gray-700 dark:text-gray-300 flex-1"><div class="mb-4"><strong>CC0 Public Domain Dedication:</strong><div class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400"><div>• I dedicate all content to public domain under CC0 1.0 Universal</div><div>• I own copyright or have permission for all submitted content</div><div>• Anyone can use this content for any purpose without attribution</div></div><a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" class="inline-block mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs"> Learn more about CC0 → </a></div><div class="mb-4"><strong>Terms of Service and Community Guidelines:</strong><div class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400"><div>• I am 18+ and legally able to provide consent</div><div>• I agree to contribute to public cultural preservation</div><div>• I understand Canada&#39;s Freedom of Panorama laws</div><div>• I confirm accuracy of submissions and accept moderation</div></div><div class="mt-2 flex flex-wrap gap-2 text-xs"><a href="/terms" target="_blank" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"> Read full Terms of Service → </a><a href="/privacy" target="_blank" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"> Privacy Policy → </a></div></div><div><strong>Photo Rights Consent:</strong><div class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400"><div>• I took these photos or have photographer permission</div><div>• Photos taken in public spaces where permitted</div><div>• Artwork is publicly accessible with photography rights</div></div></div></label></div></div>`);
      if (allConsentCheckboxesChecked.value) {
        _push(`<div class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"><div class="flex items-center">`);
        _push(ssrRenderComponent(unref(CheckIcon), { class: "w-5 h-5 text-green-500 mr-3" }, null, _parent));
        _push(`<div class="text-sm text-green-800 dark:text-green-200"><strong>Ready to submit!</strong> All consent terms and requirements have been confirmed. </div></div></div>`);
      } else {
        _push(`<div class="${ssrRenderClass(["bg-gray-50 dark:bg-gray-800 border-red-500 dark:border-red-600 border-4", "p-4 border rounded-lg"])}"><div class="flex items-center">`);
        _push(ssrRenderComponent(unref(ExclamationTriangleIcon), { class: "w-5 h-5 text-red-500 mr-3" }, null, _parent));
        _push(`<div class="text-sm text-gray-600 dark:text-gray-400"><div> Please check the consent requirements to enable submission. </div></div></div></div>`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/FastWorkflow/ConsentSection.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as _ };
//# sourceMappingURL=ConsentSection-COX2C32T.js.map
