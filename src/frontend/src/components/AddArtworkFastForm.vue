<!--
  Fast Photo-First Add Artwork Component
  Progressive single-page submission workflow with collapsible sections:
  1. Upload Photos
  2. Location & Nearby Artworks
  3. Select/Create Artwork
  4. Artwork Details
  5. Consent & Submit
-->

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useArtworkSubmissionStore } from '../stores/artworkSubmission';
import {
  CheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';

// Components (these would be imported from separate files)
import StepHeader from './FastWorkflow/StepHeader.vue';
import PhotoUploadSection from './FastWorkflow/PhotoUploadSection.vue';
import LocationSection from './FastWorkflow/LocationSection.vue';
import ArtworkSelectionSection from './FastWorkflow/ArtworkSelectionSection.vue';
import ArtworkDetailsSection from './FastWorkflow/ArtworkDetailsSection.vue';
import ConsentSection from './FastWorkflow/ConsentSection.vue';
import Modal from './Modal.vue';
import LoadingSpinner from './LoadingSpinner.vue';

// Store
const submission = useArtworkSubmissionStore();
const router = useRouter();

// Local State
const currentStep = ref<string>('photos');
const submissionComplete = ref(false);
const showWorkflow = ref(false); // New state for workflow visibility

// Consent state
const consentCheckboxes = ref({
  ageVerification: false,
  cc0Licensing: false,
  publicCommons: false,
  freedomOfPanorama: false,
});

// Computed properties
const allConsentsAccepted = computed(() => {
  return Object.values(consentCheckboxes.value).every(Boolean);
});

// Steps Configuration
const steps = computed(() => [
  { 
    id: 'photos', 
    title: 'Photos',
    completed: submission.hasPhotos,
  },
  { 
    id: 'location', 
    title: 'Location',
    completed: submission.hasLocation,
  },
  { 
    id: 'selection', 
    title: 'Select/Create',
    completed: submission.state.selectedArtwork !== null || submission.state.title.length > 0,
  },
  { 
    id: 'details', 
    title: 'Details',
    completed: !submission.isNewArtwork || submission.state.title.length > 0,
    hidden: !submission.isNewArtwork,
  },
  { 
    id: 'consent', 
    title: 'Submit',
    completed: false,
  },
]);

// Methods
function getStepClass(stepId: string) {
  const step = steps.value.find(s => s.id === stepId);
  if (!step) return '';
  
  if (step.completed) {
    return 'bg-green-500 text-white';
  } else if (currentStep.value === stepId) {
    return 'bg-blue-500 text-white';
  } else {
    return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function toggleStep(stepId: string) {
  currentStep.value = currentStep.value === stepId ? '' : stepId;
}

function handlePhotosAdded(files: File[]) {
  submission.addPhotos(files);
  // Auto-advance to location step
  if (currentStep.value === 'photos' && submission.hasPhotos) {
    currentStep.value = 'location';
  }
}

function handlePhotoRemoved(index: number) {
  submission.removePhoto(index);
}

async function handleLocationDetected() {
  try {
    await submission.getCurrentLocation();
    // Auto-advance to selection step
    if (currentStep.value === 'location' && submission.hasLocation) {
      currentStep.value = 'selection';
    }
  } catch (error) {
    console.error('Failed to get location:', error);
  }
}

function handleLocationManual(lat: number, lon: number, address?: string) {
  submission.setManualLocation(lat, lon, address);
  // Auto-advance to selection step
  if (currentStep.value === 'location') {
    currentStep.value = 'selection';
  }
}

async function handleCheckSimilarity() {
  try {
    await submission.checkSimilarity();
  } catch (error) {
    console.error('Similarity check failed:', error);
  }
}

function handleConsentUpdated(version: string) {
  // Consent version is already handled in the store
  console.log('Consent updated to version:', version);
}

function handleConsentChanged(consents: any) {
  consentCheckboxes.value = consents;
}

async function handleSubmit() {
  try {
    // Include consent information in the submission
    const consentData = {
      ...consentCheckboxes.value,
      consentVersion: submission.state.consentVersion,
      consentedAt: new Date().toISOString(),
    };
    
    // Log consent data for audit trail (would be included in actual submission)
    console.log('Submitting with consent data:', consentData);
    
    await submission.submitArtwork();
    submissionComplete.value = true;
    // Redirect to map page immediately after successful submission
    // Don't show the modal for long to prevent double submission
    setTimeout(() => {
      router.push('/');
    }, 1500); // Give user 1.5 seconds to see the success message
  } catch (error) {
    console.error('Submission failed:', error);
  }
}

function handleCloseModal() {
  submissionComplete.value = false;
}

function handleSubmitAnother() {
  submission.reset();
  submissionComplete.value = false;
  currentStep.value = 'photos';
}

// Lifecycle
onMounted(() => {
  // Start with photos step
  currentStep.value = 'photos';
});

onBeforeUnmount(() => {
  // Cleanup if needed
  submission.reset();
});
</script>

<template>
  <div class="fast-artwork-form max-w-4xl mx-auto p-6 space-y-8">
    <!-- Enhanced Header with Workflow Options -->
    <header class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Add Cultural Artwork
      </h1>
      
      <!-- Quick Workflow Choice -->
      <div class="max-w-2xl mx-auto mb-8">
        <p class="text-gray-600 dark:text-gray-300 mb-6">
          Choose your approach: search first to avoid duplicates, or skip ahead if you know this is new
        </p>
        
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            @click="$router.push('/search?mode=photo')"
            class="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
          >
            🔍 Search First (Recommended)
          </button>
          <button
            type="button"
            @click="showWorkflow = true"
            v-if="!showWorkflow"
            class="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            📸 Skip to Submit
          </button>
        </div>
        
        <div v-if="!showWorkflow" class="mt-4 text-sm text-gray-500">
          💡 Searching first helps avoid duplicate submissions and finds existing artworks you can add photos to
        </div>
      </div>
    </header>

    <!-- Workflow Steps (shown when user chooses to submit) -->
    <div v-if="showWorkflow" class="workflow-container">
      <div class="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          <div>
            <p class="text-blue-900 dark:text-blue-100 font-medium">Smart Duplicate Detection Active</p>
            <p class="text-sm text-blue-700 dark:text-blue-300">We'll automatically check for similar artworks as you upload</p>
          </div>
        </div>
      </div>

    <!-- Progress Indicator -->
    <div class="progress-steps flex justify-between items-center mb-8">
      <div 
        v-for="(step, index) in steps" 
        :key="step.id"
        class="flex items-center"
        :class="index < steps.length - 1 ? 'flex-1' : ''"
      >
        <div 
          class="step-indicator flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-colors"
          :class="getStepClass(step.id)"
        >
          <CheckIcon v-if="step.completed" class="w-5 h-5" />
          <span v-else>{{ index + 1 }}</span>
        </div>
        <span class="ml-2 text-sm font-medium hidden sm:inline">{{ step.title }}</span>
        <div 
          v-if="index < steps.length - 1"
          class="flex-1 h-0.5 mx-4 bg-gray-200 dark:bg-gray-700"
          :class="step.completed ? 'bg-blue-500' : ''"
        />
      </div>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-8">
      <!-- Step 1: Upload Photos -->
      <section class="step-section">
        <StepHeader
          title="Upload Photos"
          :completed="submission.hasPhotos"
          :active="currentStep === 'photos'"
          @toggle="toggleStep('photos')"
        />
        
        <Transition name="step-content">
          <div v-if="currentStep === 'photos' || submission.hasPhotos" class="step-content">
            <PhotoUploadSection
              :photos="submission.state.photos"
              @photosAdded="handlePhotosAdded"
              @photoRemoved="handlePhotoRemoved"
            />
          </div>
        </Transition>
      </section>

      <!-- Step 2: Location & Nearby -->
      <section class="step-section" v-if="submission.hasPhotos">
        <StepHeader
          title="Location & Nearby Artworks"
          :completed="submission.hasLocation"
          :active="currentStep === 'location'"
          @toggle="toggleStep('location')"
        />
        
        <Transition name="step-content">
          <div v-if="currentStep === 'location' || submission.hasLocation" class="step-content">
            <LocationSection
              :location="submission.state.location"
              :loading="submission.state.locationLoading"
              :error="submission.state.locationError"
              :nearby-artworks="submission.state.nearbyArtworks"
              :similarity-loading="submission.state.similarityLoading"
              @locationDetected="handleLocationDetected"
              @locationManual="handleLocationManual"
              @checkSimilarity="handleCheckSimilarity"
            />
          </div>
        </Transition>
      </section>

      <!-- Step 3: Select/Create Artwork -->
      <section class="step-section" v-if="submission.hasLocation">
        <StepHeader
          title="Select or Create Artwork"
          :completed="submission.state.selectedArtwork !== null || submission.state.title.length > 0"
          :active="currentStep === 'selection'"
          @toggle="toggleStep('selection')"
        />
        
        <Transition name="step-content">
          <div v-if="currentStep === 'selection' || submission.state.selectedArtwork !== null" class="step-content">
            <ArtworkSelectionSection
              :nearby-artworks="submission.state.nearbyArtworks"
              :selected-artwork="submission.state.selectedArtwork"
              :similarity-warnings="submission.state.similarityWarnings"
              @selectArtwork="submission.selectArtwork"
              @selectNew="submission.selectNewArtwork"
            />
          </div>
        </Transition>
      </section>

      <!-- Step 4: Artwork Details (for new artwork) -->
      <section class="step-section" v-if="submission.isNewArtwork && (currentStep === 'details' || submission.state.title)">
        <StepHeader
          title="Artwork Details"
          :completed="submission.state.title.length > 0"
          :active="currentStep === 'details'"
          @toggle="toggleStep('details')"
        />
        
        <Transition name="step-content">
          <div v-if="currentStep === 'details' || submission.state.title" class="step-content">
            <ArtworkDetailsSection
              :title="submission.state.title"
              :type-id="submission.state.type_id"
              :tags="submission.state.tags"
              :note="submission.state.note"
              @update="submission.updateArtworkDetails"
            />
          </div>
        </Transition>
      </section>

      <!-- Step 5: Consent & Submit -->
      <section class="step-section" v-if="submission.canSubmit || currentStep === 'consent'">
        <StepHeader
          title="Consent & Submit"
          :completed="false"
          :active="currentStep === 'consent'"
          @toggle="toggleStep('consent')"
        />
        
        <Transition name="step-content">
          <div v-if="currentStep === 'consent'" class="step-content">
            <ConsentSection
              :consent-version="submission.state.consentVersion"
              @consent-updated="handleConsentUpdated"
              @consentChanged="handleConsentChanged"
            />
            
            <!-- Submission Summary -->
            <div class="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 class="text-lg font-medium mb-4">Submission Summary</h3>
              <div class="space-y-2 text-sm">
                <div><strong>Photos:</strong> {{ submission.state.photos.length }} uploaded</div>
                <div v-if="submission.state.location">
                  <strong>Location:</strong> 
                  {{ submission.state.location.lat.toFixed(6) }}, {{ submission.state.location.lon.toFixed(6) }}
                  ({{ submission.state.location.source }})
                </div>
                <div v-if="submission.isNewArtwork">
                  <strong>New Artwork:</strong> {{ submission.state.title }}
                </div>
                <div v-else-if="submission.state.selectedArtwork">
                  <strong>Existing Artwork:</strong> Adding logbook entry
                </div>
                <div v-if="submission.hasHighSimilarity" class="text-orange-600 dark:text-orange-400">
                  ⚠️ High similarity detected - please review before submitting
                </div>
              </div>
            </div>

            <!-- Submit Button -->
            <div class="mt-8 flex justify-center">
              <button
                type="submit"
                :disabled="!submission.canSubmit || !allConsentsAccepted || submission.state.isSubmitting || submissionComplete"
                class="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span v-if="submission.state.isSubmitting" class="flex items-center">
                  <LoadingSpinner class="w-5 h-5 mr-2" />
                  Submitting...
                </span>
                <span v-else-if="submissionComplete" class="flex items-center">
                  <CheckIcon class="w-5 h-5 mr-2" />
                  Submitted Successfully
                </span>
                <span v-else>
                  {{ submission.isNewArtwork ? 'Submit New Artwork' : 'Add Logbook Entry' }}
                </span>
              </button>
            </div>

            <!-- Error Display -->
            <div v-if="submission.state.submitError" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div class="flex items-center">
                <ExclamationTriangleIcon class="w-5 h-5 text-red-500 mr-2" />
                <p class="text-red-700">{{ submission.state.submitError }}</p>
              </div>
            </div>
          </div>
        </Transition>
      </section>
    </form>
    
    </div> <!-- Close workflow container -->

    <!-- Success Modal -->
    <Modal 
      v-if="submissionComplete" 
      :isOpen="submissionComplete" 
      @close="handleCloseModal"
    >
      <div class="text-center py-8">
        <CheckCircleIcon class="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Submission Complete!</h2>
        <p class="text-gray-600 mb-4">
          {{ submission.state.submissionResult?.message || 'Your submission has been received and is pending review.' }}
        </p>
        <p class="text-sm text-gray-500 mb-6">
          Redirecting you to the map page...
        </p>
        <div class="flex justify-center space-x-4">
          <button
            @click="router.push('/')"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Map Now
          </button>
          <button
            @click="handleSubmitAnother"
            class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Submit Another
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.step-content {
  padding-top: 1.5rem;
}

.step-content-enter-active,
.step-content-leave-active {
  transition: all 0.3s ease;
}

.step-content-enter-from,
.step-content-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.progress-steps .step-indicator {
  border: 2px solid currentColor;
}

@media (max-width: 640px) {
  .progress-steps {
    flex-direction: column;
    gap: 1rem;
  }
  
  .progress-steps .flex-1 {
    display: none;
  }
}</style>