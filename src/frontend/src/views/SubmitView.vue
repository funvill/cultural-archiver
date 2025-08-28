<template>
  <div class="submit-view">
    <!-- Page Header -->
    <div class="bg-white border-b border-gray-200 py-4 sm:py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Submit Artwork</h1>
          <p class="mt-2 text-base sm:text-lg text-gray-600">
            Share photos of public art to contribute to the cultural archive
          </p>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <!-- Progress Indicator -->
      <div class="mb-8" role="progressbar" :aria-valuenow="currentStep" aria-valuemin="1" aria-valuemax="2" :aria-valuetext="`Step ${currentStep} of 2`">
        <div class="flex items-center justify-center space-x-2 sm:space-x-4">
          <div class="flex items-center space-x-1 sm:space-x-2">
            <div 
              class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium"
              :class="currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'"
              v-bind="currentStep === 1 ? { 'aria-current': 'step' } : {}"
            >
              1
            </div>
            <span class="text-xs sm:text-sm font-medium text-gray-600">Upload Photos</span>
          </div>
          <div class="w-8 sm:w-16 h-0.5" :class="currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'" aria-hidden="true"></div>
          <div class="flex items-center space-x-1 sm:space-x-2">
            <div 
              class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium"
              :class="currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'"
              v-bind="currentStep === 2 ? { 'aria-current': 'step' } : {}"
            >
              2
            </div>
            <span class="text-xs sm:text-sm font-medium text-gray-600">Verify & Submit</span>
          </div>
        </div>
      </div>

      <!-- Error Messages -->
      <div v-if="error" class="mb-6 bg-red-50 border border-red-200 rounded-lg p-4" role="alert" aria-live="assertive">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Submission Error</h3>
            <p class="mt-1 text-sm text-red-700">{{ error }}</p>
          </div>
        </div>
      </div>

      <!-- Success Message -->
      <div v-if="success" class="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-green-800">Submission Successful!</h3>
            <p class="mt-1 text-sm text-green-700">
              Your artwork submission has been received and will be reviewed shortly.
            </p>
            <div class="mt-3">
              <button
                @click="startNewSubmission"
                class="text-sm font-medium text-green-800 hover:text-green-900 underline"
              >
                Submit another artwork →
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Upload Step -->
      <div v-if="currentStep === 1 && !success">
        <PhotoUpload
          :api-base-url="apiBaseUrl"
          :user-token="authStore.ensureUserToken()"
          @success="handleUploadSuccess"
          @error="handleUploadError"
          @cancel="handleCancel"
        />
      </div>

      <!-- Review Step -->
      <div v-if="currentStep === 2 && !success" class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Review Your Submission</h2>
        
        <div v-if="submissionData" class="space-y-6">
          <!-- Photos Preview -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-3">Photos</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="(photo, index) in submissionData.photos"
                :key="index"
                class="relative aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden"
              >
                <img
                  :src="photo"
                  :alt="`Photo ${index + 1}`"
                  class="w-full h-32 object-cover"
                />
              </div>
            </div>
          </div>

          <!-- Location -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-3">Location</h3>
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-sm text-gray-600">
                📍 {{ submissionData.latitude?.toFixed(6) }}, {{ submissionData.longitude?.toFixed(6) }}
              </p>
              <p class="text-xs text-gray-500 mt-1">
                This location will be verified by our reviewers
              </p>
            </div>
          </div>

          <!-- Description -->
          <div v-if="submissionData.note">
            <h3 class="text-lg font-medium text-gray-900 mb-3">Description</h3>
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-sm text-gray-700">{{ submissionData.note }}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-between pt-6">
            <button
              @click="currentStep = 1"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ← Back to Edit
            </button>
            <button
              @click="submitForReview"
              :disabled="isSubmitting"
              class="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="isSubmitting" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </span>
              <span v-else>
                Submit for Review
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Help Text -->
      <div v-if="!success" class="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 class="text-lg font-medium text-blue-900 mb-2">Submission Guidelines</h3>
        <ul class="text-sm text-blue-800 space-y-1">
          <li>• Upload clear photos that show the artwork and its context</li>
          <li>• Ensure location accuracy for proper mapping</li>
          <li>• Include descriptive details to help others discover the artwork</li>
          <li>• All submissions are reviewed before being published</li>
          <li>• Respect artist rights and avoid submitting private property</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import PhotoUpload from '../components/PhotoUpload.vue'
import { useAuthStore } from '../stores/auth'

// Store
const authStore = useAuthStore()
const router = useRouter()

// State
const currentStep = ref(1)
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)
const submissionData = ref<any>(null)

// Configuration
const apiBaseUrl = computed(() => '/api')

// Methods
function handleUploadSuccess(data: any) {
  submissionData.value = data
  currentStep.value = 2
  error.value = null
}

function handleUploadError(errorMessage: string) {
  error.value = errorMessage
  success.value = false
}

function handleCancel() {
  router.push('/')
}

async function submitForReview() {
  if (!submissionData.value) return
  
  isSubmitting.value = true
  error.value = null
  
  try {
    // This would normally make an API call to finalize the submission
    // For now, we'll simulate success
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    success.value = true
    currentStep.value = 1
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to submit for review'
  } finally {
    isSubmitting.value = false
  }
}

function startNewSubmission() {
  success.value = false
  currentStep.value = 1
  submissionData.value = null
  error.value = null
}
</script>

<style scoped>
.submit-view {
  min-height: 100vh;
  background-color: #f9fafb;
}

/* Aspect ratio utilities for image previews */
.aspect-w-16 {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
}

.aspect-w-16 > img {
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

/* Loading animations */
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

/* Mobile responsive adjustments */
@media (max-width: 640px) {
  .submit-view {
    @apply px-2;
  }
}
</style>