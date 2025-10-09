<!--
  Consent Section for Fast Photo-First Workflow
  Handles consent validation with single consolidated checkbox
-->

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';

interface Props {
  consentVersion: string;
}

// Consolidated consent checkboxes interface - kept for backward compatibility
interface ConsentCheckboxes {
  cc0Licensing: boolean;
  termsAndGuidelines: boolean;
  photoRights: boolean;
}

defineProps<Props>();
// Use array form for defineEmits to avoid strict type-map constraints in template
const emit = defineEmits(['consent-updated', 'consentChanged']) as unknown as (
  (event: string, ...args: any[]) => void
);

// Local state - single checkbox for all consent
const allConsentsAccepted = ref(false);

// Computed
const allConsentCheckboxesChecked = computed(() => {
  return allConsentsAccepted.value;
});

// Watch for consent changes and emit to parent (emit all three as true when checked)
watch(
  allConsentsAccepted,
  (newValue: boolean) => {
    const consents: ConsentCheckboxes = {
      cc0Licensing: newValue,
      termsAndGuidelines: newValue,
      photoRights: newValue,
    };
  emit('consentChanged', consents);
  }
);

// Method to reset all consent checkboxes
function resetConsents() {
  allConsentsAccepted.value = false;
}

// Expose reset method to parent
defineExpose({
  resetConsents,
});
</script>

<template>
  <div class="consent-section">
    <div class="mb-6">
      <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Consent & Legal Requirements
      </h4>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Before submitting, please confirm that you have the necessary rights and permissions.
      </p>
    </div>

    <!-- Single Combined Consent Checkbox -->
    <div class="mb-6">
      <div
        class="flex items-start space-x-3 p-4 border rounded-lg"
        :class="allConsentsAccepted ? 'border-gray-200 dark:border-gray-700' : 'border-red-500 dark:border-red-600 border-4'"
      >
        <input
          id="consent-all"
          v-model="allConsentsAccepted"
          type="checkbox"
          class="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label for="consent-all" class="text-sm text-gray-700 dark:text-gray-300 flex-1">
          <!-- CC0 Public Domain Dedication -->
          <div class="mb-4">
            <strong>CC0 Public Domain Dedication:</strong>
            <div class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>• I dedicate all content to public domain under CC0 1.0 Universal</div>
              <div>• I own copyright or have permission for all submitted content</div>
              <div>• Anyone can use this content for any purpose without attribution</div>
            </div>
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              class="inline-block mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs"
              @click.stop
            >
              Learn more about CC0 →
            </a>
          </div>

          <!-- Terms of Service and Community Guidelines -->
          <div class="mb-4">
            <strong>Terms of Service and Community Guidelines:</strong>
            <div class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>• I am 18+ and legally able to provide consent</div>
              <div>• I agree to contribute to public cultural preservation</div>
              <div>• I understand Canada's Freedom of Panorama laws</div>
              <div>• I confirm accuracy of submissions and accept moderation</div>
            </div>
            <div class="mt-2 flex flex-wrap gap-2 text-xs">
              <a
                href="/terms"
                target="_blank"
                class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                @click.stop
              >
                Read full Terms of Service →
              </a>
              <a
                href="/privacy"
                target="_blank"
                class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                @click.stop
              >
                Privacy Policy →
              </a>
            </div>
          </div>

          <!-- Photo Rights Consent -->
          <div>
            <strong>Photo Rights Consent:</strong>
            <div class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>• I took these photos or have photographer permission</div>
              <div>• Photos taken in public spaces where permitted</div>
              <div>• Artwork is publicly accessible with photography rights</div>
            </div>
          </div>
        </label>
      </div>
    </div>

    <!-- Submission Ready Status -->
    <div
      v-if="allConsentCheckboxesChecked"
      class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
    >
      <div class="flex items-center">
        <CheckIcon class="w-5 h-5 text-green-500 mr-3" />
        <div class="text-sm text-green-800 dark:text-green-200">
          <strong>Ready to submit!</strong> All consent terms and requirements have been confirmed.
        </div>
      </div>
    </div>

    <div
      v-else
      class="p-4 border rounded-lg"
      :class="'bg-gray-50 dark:bg-gray-800 border-red-500 dark:border-red-600 border-4'"
    >
      <div class="flex items-center">
        <ExclamationTriangleIcon class="w-5 h-5 text-red-500 mr-3" />
        <div class="text-sm text-gray-600 dark:text-gray-400">
          <div>
            Please check the consent requirements to enable submission.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
