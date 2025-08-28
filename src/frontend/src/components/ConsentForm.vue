<script setup lang="ts">
import { ref, computed, watch, withDefaults, defineProps, defineEmits } from 'vue'

// Form data interface
interface ConsentFormData {
  ageVerification: boolean
  cc0Licensing: boolean
  publicCommons: boolean
  freedomOfPanorama: boolean
  consentVersion?: string
  consentedAt?: string
}

// Component props
interface Props {
  initialData?: Partial<ConsentFormData>
  consentVersion?: string
}

const props = withDefaults(defineProps<Props>(), {
  consentVersion: '1.0.0'
})

// Component emits
interface Emits {
  (e: 'submit', data: ConsentFormData): void
  (e: 'cancel'): void
}

const emit = defineEmits<Emits>()

// Constants
const CONSENT_VERSION = props.consentVersion

// Form state
const formData = ref<ConsentFormData>({
  ageVerification: false,
  cc0Licensing: false,
  publicCommons: false,
  freedomOfPanorama: false,
  ...props.initialData
})

const isSubmitting = ref(false)

// Validation errors
const errors = ref<Partial<Record<keyof ConsentFormData, string>>>({})

// Computed properties
const isFormValid = computed(() => {
  return formData.value.ageVerification &&
         formData.value.cc0Licensing &&
         formData.value.publicCommons &&
         formData.value.freedomOfPanorama
})

const hasErrors = computed(() => {
  return Object.keys(errors.value).length > 0
})

const allErrors = computed(() => {
  return Object.values(errors.value).filter(Boolean)
})

// Validation functions
function validateForm(): boolean {
  errors.value = {}

  if (!formData.value.ageVerification) {
    errors.value.ageVerification = 'Age verification is required'
  }

  if (!formData.value.cc0Licensing) {
    errors.value.cc0Licensing = 'CC0 licensing consent is required'
  }

  if (!formData.value.publicCommons) {
    errors.value.publicCommons = 'Public commons consent is required'
  }

  if (!formData.value.freedomOfPanorama) {
    errors.value.freedomOfPanorama = 'Freedom of Panorama acknowledgment is required'
  }

  return Object.keys(errors.value).length === 0
}

// Event handlers
async function handleSubmit() {
  if (!validateForm()) {
    return
  }

  isSubmitting.value = true

  try {
    // Emit the consent data to parent component
    emit('submit', {
      ...formData.value,
      consentVersion: CONSENT_VERSION,
      consentedAt: new Date().toISOString()
    } as ConsentFormData)
  } catch (error) {
    console.error('Consent submission error:', error)
    // Handle error appropriately
  } finally {
    isSubmitting.value = false
  }
}

// Watcher to clear individual errors when user fixes them
watch(() => formData.value.ageVerification, (newValue) => {
  if (newValue && errors.value.ageVerification) {
    delete errors.value.ageVerification
  }
})

watch(() => formData.value.cc0Licensing, (newValue) => {
  if (newValue && errors.value.cc0Licensing) {
    delete errors.value.cc0Licensing
  }
})

watch(() => formData.value.publicCommons, (newValue) => {
  if (newValue && errors.value.publicCommons) {
    delete errors.value.publicCommons
  }
})

watch(() => formData.value.freedomOfPanorama, (newValue) => {
  if (newValue && errors.value.freedomOfPanorama) {
    delete errors.value.freedomOfPanorama
  }
})
</script>

<template>
  <div class="consent-form bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">
        Consent for Photo Submission
      </h2>
      <p class="text-gray-600">
        Before submitting photos to the Cultural Archiver, we need your consent
        for the legal use and distribution of your contributions.
      </p>
    </div>

    <!-- Consent Form -->
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Age Verification -->
      <div class="consent-section">
        <div class="flex items-start space-x-3">
          <input
            id="age-verification"
            v-model="formData.ageVerification"
            type="checkbox"
            class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            :class="{ 'border-red-500': errors.ageVerification }"
          />
          <div class="flex-1">
            <label for="age-verification" class="block text-sm font-medium text-gray-900">
              Age Verification (Required)
            </label>
            <p class="text-sm text-gray-600 mt-1">
              I confirm that I am 18 years of age or older and legally able to
              provide consent for photo submissions.
            </p>
            <p v-if="errors.ageVerification" class="text-red-600 text-sm mt-1">
              {{ errors.ageVerification }}
            </p>
          </div>
        </div>
      </div>

      <!-- CC0 Licensing -->
      <div class="consent-section">
        <div class="flex items-start space-x-3">
          <input
            id="cc0-licensing"
            v-model="formData.cc0Licensing"
            type="checkbox"
            class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            :class="{ 'border-red-500': errors.cc0Licensing }"
          />
          <div class="flex-1">
            <label for="cc0-licensing" class="block text-sm font-medium text-gray-900">
              CC0 Public Domain Dedication (Required)
            </label>
            <p class="text-sm text-gray-600 mt-1">
              I dedicate my photo submissions to the public domain under
              <a 
                href="https://creativecommons.org/publicdomain/zero/1.0/"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 underline"
              >
                CC0 1.0 Universal
              </a>.
              This means anyone can use these photos for any purpose without
              attribution requirements.
            </p>
            <p v-if="errors.cc0Licensing" class="text-red-600 text-sm mt-1">
              {{ errors.cc0Licensing }}
            </p>
          </div>
        </div>
      </div>

      <!-- Public Commons -->
      <div class="consent-section">
        <div class="flex items-start space-x-3">
          <input
            id="public-commons"
            v-model="formData.publicCommons"
            type="checkbox"
            class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            :class="{ 'border-red-500': errors.publicCommons }"
          />
          <div class="flex-1">
            <label for="public-commons" class="block text-sm font-medium text-gray-900">
              Public Commons Contribution (Required)
            </label>
            <p class="text-sm text-gray-600 mt-1">
              I understand that my submissions will become part of a public
              cultural archive and may be used for educational, research, and
              cultural preservation purposes.
            </p>
            <p v-if="errors.publicCommons" class="text-red-600 text-sm mt-1">
              {{ errors.publicCommons }}
            </p>
          </div>
        </div>
      </div>

      <!-- Freedom of Panorama -->
      <div class="consent-section">
        <div class="flex items-start space-x-3">
          <input
            id="freedom-panorama"
            v-model="formData.freedomOfPanorama"
            type="checkbox"
            class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            :class="{ 'border-red-500': errors.freedomOfPanorama }"
          />
          <div class="flex-1">
            <label for="freedom-panorama" class="block text-sm font-medium text-gray-900">
              Freedom of Panorama Acknowledgment (Required)
            </label>
            <p class="text-sm text-gray-600 mt-1">
              I understand Canada's Freedom of Panorama laws and confirm that my
              photos are taken from publicly accessible locations. Learn more about
              <a 
                href="https://en.wikipedia.org/wiki/Freedom_of_panorama#Canada"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 underline"
              >
                Canadian Freedom of Panorama
              </a>.
            </p>
            <p v-if="errors.freedomOfPanorama" class="text-red-600 text-sm mt-1">
              {{ errors.freedomOfPanorama }}
            </p>
          </div>
        </div>
      </div>

      <!-- Consent Version Info -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h3 class="text-sm font-medium text-gray-900 mb-2">
          Consent Information
        </h3>
        <div class="text-sm text-gray-600 space-y-1">
          <p>Consent Version: {{ CONSENT_VERSION }}</p>
          <p>Your consent will be recorded with a timestamp for legal compliance.</p>
          <p>You can withdraw consent at any time by contacting us, though previously
             submitted photos under CC0 cannot be recalled from the public domain.</p>
        </div>
      </div>

      <!-- Error Summary -->
      <div v-if="hasErrors" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 class="text-sm font-medium text-red-800 mb-2">
          Please correct the following errors:
        </h3>
        <ul class="text-sm text-red-700 space-y-1">
          <li v-for="error in allErrors" :key="error">• {{ error }}</li>
        </ul>
      </div>

      <!-- Submit Button -->
      <div class="flex justify-end space-x-4">
        <button
          type="button"
          @click="$emit('cancel')"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="isSubmitting || !isFormValid"
          class="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="isSubmitting" class="flex items-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Submitting...
          </span>
          <span v-else">
            Provide Consent
          </span>
        </button>
      </div>
    </form>

    <!-- Legal Notice -->
    <div class="mt-6 pt-6 border-t border-gray-200">
      <p class="text-xs text-gray-500">
        By providing consent, you agree to our terms of service and confirm
        that you have the legal right to submit these photos. For questions
        about consent or data handling, please contact us at
        <a href="mailto:privacy@cultural-archiver.com" class="text-blue-600 hover:text-blue-800">
          privacy@cultural-archiver.com
        </a>.
      </p>
    </div>
  </div>
</template>

<style scoped>
.consent-form {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.consent-section {
  @apply p-4 border border-gray-200 rounded-lg;
}

.consent-section:hover {
  @apply border-gray-300;
}

/* Focus styles for accessibility */
input[type="checkbox"]:focus {
  @apply ring-2 ring-blue-500 ring-offset-2;
}

/* Custom checkbox styling */
input[type="checkbox"] {
  @apply transition-colors duration-200;
}

/* Link hover effects */
a {
  @apply transition-colors duration-200;
}

/* Loading animation refinement */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Error state styling */
.border-red-500 {
  @apply border-red-500 ring-1 ring-red-500;
}

/* Disabled button styling */
button:disabled {
  @apply opacity-50 cursor-not-allowed;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .consent-form {
    @apply p-4;
  }
  
  .consent-section {
    @apply p-3;
  }
}
</style>