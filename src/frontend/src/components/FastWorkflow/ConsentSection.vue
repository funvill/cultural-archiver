<!--
  Consent Section for Fast Photo-First Workflow
  Handles consent validation with 3 consolidated checkboxes
-->

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';

interface Props {
  consentVersion: string;
}

// Consolidated consent checkboxes interface
interface ConsentCheckboxes {
  cc0Licensing: boolean;
  termsAndGuidelines: boolean;
  photoRights: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  'consent-updated': [version: string];
  'consentChanged': [consents: ConsentCheckboxes];
}>();

// Local state
const consentCheckboxes = ref<ConsentCheckboxes>({
  cc0Licensing: false,
  termsAndGuidelines: false,
  photoRights: false,
});

// Computed
const allConsentCheckboxesChecked = computed(() => {
  return Object.values(consentCheckboxes.value).every(Boolean);
});

const incompleteCount = computed(() => {
  return Object.values(consentCheckboxes.value).filter(val => !val).length;
});

// Watch for consent changes and emit to parent
watch(consentCheckboxes, (newConsents) => {
  emit('consentChanged', newConsents);
}, { deep: true });

// Method to check all consent checkboxes
function checkAllConsents() {
  consentCheckboxes.value = {
    cc0Licensing: true,
    termsAndGuidelines: true,
    photoRights: true,
  };
}

// Method to reset all consent checkboxes
function resetConsents() {
  consentCheckboxes.value = {
    cc0Licensing: false,
    termsAndGuidelines: false,
    photoRights: false,
  };
}

// Expose reset method to parent
defineExpose({
  resetConsents
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

    <!-- Individual Consent Checkboxes -->
    <div class="mb-6">
      <div class="space-y-4">
        <!-- CC0 Public Domain Dedication -->
        <div class="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <input
            id="consent-cc0"
            v-model="consentCheckboxes.cc0Licensing"
            type="checkbox"
            class="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="consent-cc0" class="text-sm text-gray-700 dark:text-gray-300 flex-1">
            <strong>CC0 Public Domain Dedication:</strong>
            <div class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>• I dedicate all content to public domain under CC0 1.0 Universal</div>
              <div>• I own copyright or have permission for all submitted content</div>
              <div>• Anyone can use this content for any purpose without attribution</div>
            </div>
            <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" class="inline-block mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs">
              Learn more about CC0 →
            </a>
          </label>
        </div>

        <!-- Terms of Service and Community Guidelines -->
        <div class="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <input
            id="consent-terms"
            v-model="consentCheckboxes.termsAndGuidelines"
            type="checkbox"
            class="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="consent-terms" class="text-sm text-gray-700 dark:text-gray-300 flex-1">
            <strong>Terms of Service and Community Guidelines:</strong>
            <div class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>• I am 18+ and legally able to provide consent</div>
              <div>• I agree to contribute to public cultural preservation</div>
              <div>• I understand Canada's Freedom of Panorama laws</div>
              <div>• I confirm accuracy of submissions and accept moderation</div>
            </div>
            <div class="mt-2 flex flex-wrap gap-2 text-xs">
              <a href="/terms" target="_blank" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                Read full Terms of Service →
              </a>
              <a href="/privacy" target="_blank" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                Privacy Policy →
              </a>
            </div>
          </label>
        </div>

        <!-- Photo Rights Checklist -->
        <div class="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <input
            id="consent-photo-rights"
            v-model="consentCheckboxes.photoRights"
            type="checkbox"
            class="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="consent-photo-rights" class="text-sm text-gray-700 dark:text-gray-300 flex-1">
            <strong>Photo Rights Consent:</strong>
            <div class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>• I took these photos or have photographer permission</div>
              <div>• Photos taken in public spaces where permitted</div>
              <div>• Artwork is publicly accessible with photography rights</div>
            </div>
          </label>
        </div>
      </div>

      <!-- Check All Button -->
      <div class="mt-4">
        <button
          @click="checkAllConsents"
          type="button"
          class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          <CheckIcon class="w-4 h-4 mr-2" />
          Accept all terms and requirements
        </button>
      </div>
    </div>

    <!-- Submission Ready Status -->
    <div v-if="allConsentCheckboxesChecked" class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-center">
        <CheckIcon class="w-5 h-5 text-green-500 mr-3" />
        <div class="text-sm text-green-800 dark:text-green-200">
          <strong>Ready to submit!</strong> All consent terms and requirements have been confirmed.
        </div>
      </div>
    </div>

    <div v-else class="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div class="flex items-center">
        <ExclamationTriangleIcon class="w-5 h-5 text-gray-500 mr-3" />
        <div class="text-sm text-gray-600 dark:text-gray-400">
          <div>Please complete {{ incompleteCount }} remaining consent requirement{{ incompleteCount !== 1 ? 's' : '' }} to enable submission.</div>
        </div>
      </div>
    </div>
  </div>
</template>

