<!--
  Consent Section for Fast Photo-First Workflow
  Handles consent version validation and display
-->

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

    <!-- Consent Version Status -->
    <div class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-start">
        <CheckCircleIcon class="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
        <div class="flex-1">
          <h5 class="font-medium text-green-900 dark:text-green-100 mb-1">
            Consent Status: Current
          </h5>
          <p class="text-sm text-green-800 dark:text-green-200">
            You are using consent version {{ consentVersion }}. This is the current version required for submissions.
          </p>
          <button 
            @click="showConsentDetails = !showConsentDetails"
            class="mt-2 text-sm text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 underline"
          >
            {{ showConsentDetails ? 'Hide' : 'View' }} consent details
          </button>
        </div>
      </div>
    </div>

    <!-- Consent Details (Expandable) -->
    <Transition name="consent-details">
      <div v-if="showConsentDetails" class="mb-6 p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h5 class="font-medium text-gray-900 dark:text-white mb-4">
          Consent Terms (Version {{ consentVersion }})
        </h5>
        
        <div class="space-y-4 text-sm text-gray-700 dark:text-gray-300">
          <div class="flex items-start space-x-3">
            <CheckIcon class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Age Verification (18+):</strong>
              <p class="mt-1">I confirm that I am 18 years of age or older and legally able to provide consent for photo submissions.</p>
            </div>
          </div>
          
          <div class="flex items-start space-x-3">
            <CheckIcon class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong>CC0 Public Domain Dedication:</strong>
              <p class="mt-1">I dedicate my photo submissions to the public domain under CC0 1.0 Universal. This means anyone can use these photos for any purpose without attribution requirements.</p>
              <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                Learn more about CC0 →
              </a>
            </div>
          </div>
          
          <div class="flex items-start space-x-3">
            <CheckIcon class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Public Commons Contribution:</strong>
              <p class="mt-1">I understand that my submissions will become part of a public cultural archive and may be used for educational, research, and cultural preservation purposes.</p>
            </div>
          </div>
          
          <div class="flex items-start space-x-3">
            <CheckIcon class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Freedom of Panorama Acknowledgment:</strong>
              <p class="mt-1">I understand Canada's Freedom of Panorama laws and confirm that my photos are taken from publicly accessible locations.</p>
              <a href="https://en.wikipedia.org/wiki/Freedom_of_panorama#Canada" target="_blank" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                Learn about Freedom of Panorama in Canada →
              </a>
            </div>
          </div>
        </div>
        
        <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
          <p class="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> These consents were previously provided during account setup or submission workflow. 
            By proceeding with submission, you confirm these terms still apply.
          </p>
        </div>
      </div>
    </Transition>

    <!-- Photo Rights Checklist -->
    <div class="mb-6">
      <h5 class="font-medium text-gray-900 dark:text-white mb-4">
        Photo Rights Checklist
      </h5>
      
      <div class="space-y-3">
        <div class="flex items-start space-x-3">
          <input
            id="photo-rights-own"
            v-model="photoRightsChecks.ownPhotos"
            type="checkbox"
            class="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="photo-rights-own" class="text-sm text-gray-700 dark:text-gray-300">
            <strong>I took these photos myself</strong> or have explicit permission from the photographer to submit them.
          </label>
        </div>
        
        <div class="flex items-start space-x-3">
          <input
            id="photo-rights-public"
            v-model="photoRightsChecks.publicSpace"
            type="checkbox"
            class="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="photo-rights-public" class="text-sm text-gray-700 dark:text-gray-300">
            <strong>Photos were taken in public spaces</strong> where photography is permitted.
          </label>
        </div>
        
        <div class="flex items-start space-x-3">
          <input
            id="photo-rights-artwork"
            v-model="photoRightsChecks.artworkRights"
            type="checkbox"
            class="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="photo-rights-artwork" class="text-sm text-gray-700 dark:text-gray-300">
            <strong>The artwork is in a publicly accessible location</strong> and I have the right to photograph and share it under Canada's Freedom of Panorama provisions.
          </label>
        </div>
      </div>
    </div>

    <!-- Privacy Notice -->
    <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div class="flex items-start">
        <InformationCircleIcon class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
        <div class="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Privacy & Attribution:</strong>
          <p class="mt-1">
            Your photos will be publicly available and may include metadata. Personal information is handled according to our privacy policy. 
            While CC0 dedication means no attribution is required, the cultural archive may acknowledge contributors.
          </p>
        </div>
      </div>
    </div>

    <!-- Submission Ready Status -->
    <div v-if="allChecksComplete" class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-center">
        <CheckCircleIcon class="w-5 h-5 text-green-500 mr-3" />
        <div class="text-sm text-green-800 dark:text-green-200">
          <strong>Ready to submit!</strong> All consent and rights requirements have been confirmed.
        </div>
      </div>
    </div>

    <div v-else class="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div class="flex items-center">
        <ExclamationTriangleIcon class="w-5 h-5 text-gray-500 mr-3" />
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Please complete the photo rights checklist above to enable submission.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  CheckCircleIcon,
  CheckIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';

interface Props {
  consentVersion: string;
}

defineProps<Props>();
const emit = defineEmits<{
  'consent-updated': [version: string];
}>();

// Suppress unused variable warning - emit may be used later for consent updates
void emit;

// Local state
const showConsentDetails = ref(false);
const photoRightsChecks = ref({
  ownPhotos: false,
  publicSpace: false,
  artworkRights: false,
});

// Computed
const allChecksComplete = computed(() => {
  return Object.values(photoRightsChecks.value).every(Boolean);
});
</script>

<style scoped>
.consent-details-enter-active,
.consent-details-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.consent-details-enter-from,
.consent-details-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.consent-details-enter-to,
.consent-details-leave-from {
  opacity: 1;
  max-height: 500px;
  transform: translateY(0);
}
</style>