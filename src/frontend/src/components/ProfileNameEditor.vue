<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { apiService } from '../services/api';
import type { ProfileUpdateRequest } from '../types';

interface Props {
  currentProfileName?: string | null;
}

interface Emits {
  (e: 'profileUpdated', profileName: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// State
const isEditing = ref(false);
const profileNameInput = ref('');
const isLoading = ref(false);
const isCheckingAvailability = ref(false);
const validationError = ref('');
const availabilityMessage = ref('');
const isAvailable = ref(false);
const successMessage = ref('');
let debounceTimeout: NodeJS.Timeout;

// Computed
const canSave = computed(() => {
  return (
    profileNameInput.value.length >= 3 &&
    profileNameInput.value.length <= 20 &&
    isAvailable.value &&
    !validationError.value &&
    profileNameInput.value !== props.currentProfileName
  );
});

// Methods
const startEditing = () => {
  isEditing.value = true;
  profileNameInput.value = props.currentProfileName || '';
  successMessage.value = '';
};

const cancelEditing = () => {
  isEditing.value = false;
  profileNameInput.value = '';
  validationError.value = '';
  availabilityMessage.value = '';
  isAvailable.value = false;
};

const validateProfileName = (name: string): string | null => {
  if (name.length < 3) {
    return 'Profile name must be at least 3 characters long';
  }
  if (name.length > 20) {
    return 'Profile name cannot exceed 20 characters';
  }
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(name)) {
    if (name.startsWith('-') || name.endsWith('-')) {
      return 'Profile name cannot start or end with a dash';
    }
    return 'Profile name can only contain letters, numbers, and dashes';
  }
  return null;
};

const onInput = () => {
  validationError.value = '';
  availabilityMessage.value = '';
  isAvailable.value = false;

  // Clear existing debounce
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }

  // Validate format first
  const error = validateProfileName(profileNameInput.value);
  if (error) {
    validationError.value = error;
    return;
  }

  // Debounce availability check
  debounceTimeout = setTimeout(() => {
    if (profileNameInput.value.length >= 3) {
      checkAvailability();
    }
  }, 500);
};

const checkAvailability = async () => {
  if (profileNameInput.value.length < 3 || validationError.value) {
    return;
  }

  // Don't check if it's the current profile name
  if (profileNameInput.value === props.currentProfileName) {
    isAvailable.value = true;
    availabilityMessage.value = 'Current profile name';
    return;
  }

  isCheckingAvailability.value = true;
  availabilityMessage.value = '';

  try {
    const response = await apiService.checkProfileNameAvailability(profileNameInput.value);

    if (response.success && response.data) {
      isAvailable.value = response.data.available;
      availabilityMessage.value = response.data.message;
    }
  } catch (error) {
    console.error('Failed to check profile name availability:', error);
    availabilityMessage.value = 'Unable to check availability';
    isAvailable.value = false;
  } finally {
    isCheckingAvailability.value = false;
  }
};

const saveProfileName = async () => {
  if (!canSave.value) return;

  isLoading.value = true;

  try {
    const request: ProfileUpdateRequest = {
      profile_name: profileNameInput.value,
    };

    const response = await apiService.updateProfileName(request);

    if (response.success && response.data) {
      successMessage.value = response.data.message || 'Profile name updated successfully';
      emit('profileUpdated', profileNameInput.value);

      // Close editor after a brief delay
      setTimeout(() => {
        isEditing.value = false;
        successMessage.value = '';
      }, 2000);
    }
  } catch (error: any) {
    console.error('Failed to update profile name:', error);

    // Handle API error responses
    if (error.response?.data?.validationErrors) {
      const profileNameError = error.response.data.validationErrors.find(
        (err: any) => err.field === 'profile_name'
      );
      if (profileNameError) {
        validationError.value = profileNameError.message;
      }
    } else {
      validationError.value = error.message || 'Failed to update profile name';
    }
  } finally {
    isLoading.value = false;
  }
};

// Watch for external profile name changes
watch(
  () => props.currentProfileName,
  newValue => {
    if (!isEditing.value && newValue) {
      profileNameInput.value = newValue;
    }
  }
);
</script>

<template>
  <div class="profile-name-editor">
    <!-- Current Profile Name Display -->
    <div
      v-if="!isEditing && currentProfileName"
      class="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
    >
      <div>
        <h4 class="font-medium text-gray-900">Profile Name</h4>
        <p class="text-sm text-gray-600">{{ currentProfileName }}</p>
      </div>
      <button @click="startEditing" class="text-blue-600 hover:text-blue-700 text-sm font-medium">
        Edit
      </button>
    </div>

    <!-- No Profile Name Set -->
    <div
      v-else-if="!isEditing && !currentProfileName"
      class="p-4 bg-blue-50 rounded-lg border border-blue-200"
    >
      <div class="flex items-start">
        <svg class="w-5 h-5 text-blue-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clip-rule="evenodd"
          />
        </svg>
        <div class="flex-1">
          <h4 class="font-medium text-blue-900 mb-1">Set up your profile name</h4>
          <p class="text-sm text-blue-700 mb-3">
            Choose a unique profile name to make your contributions public and earn badges.
          </p>
          <button
            @click="startEditing"
            class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Choose Profile Name
          </button>
        </div>
      </div>
    </div>

    <!-- Profile Name Editor -->
    <div v-if="isEditing" class="space-y-4">
      <div>
        <label for="profile-name" class="block text-sm font-medium text-gray-700 mb-2">
          Profile Name
        </label>
        <div class="relative">
          <input
            id="profile-name"
            v-model="profileNameInput"
            type="text"
            placeholder="Enter a unique profile name"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            :class="{
              'border-red-300 focus:ring-red-500 focus:border-red-500': validationError,
              'border-green-300 focus:ring-green-500 focus:border-green-500':
                isAvailable && profileNameInput.length >= 3,
            }"
            @input="onInput"
            @blur="checkAvailability"
            :disabled="isLoading"
            maxlength="20"
          />

          <!-- Loading Spinner -->
          <div v-if="isCheckingAvailability" class="absolute right-3 top-2.5">
            <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>

          <!-- Availability Check Icon -->
          <div v-else-if="profileNameInput.length >= 3" class="absolute right-3 top-2.5">
            <svg
              v-if="isAvailable"
              class="h-5 w-5 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <svg v-else class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
        </div>

        <!-- Character Count -->
        <div class="flex justify-between items-center mt-1">
          <p class="text-xs text-gray-500">3-20 characters. Letters, numbers, and dashes only.</p>
          <span class="text-xs text-gray-500"> {{ profileNameInput.length }}/20 </span>
        </div>

        <!-- Validation Messages -->
        <div v-if="validationError" class="mt-2 text-sm text-red-600">
          {{ validationError }}
        </div>
        <div
          v-else-if="availabilityMessage"
          class="mt-2 text-sm"
          :class="{
            'text-green-600': isAvailable,
            'text-red-600': !isAvailable,
          }"
        >
          {{ availabilityMessage }}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex space-x-3">
        <button
          @click="saveProfileName"
          :disabled="!canSave || isLoading"
          class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          <span v-if="isLoading" class="flex items-center justify-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Saving...
          </span>
          <span v-else>Save Profile Name</span>
        </button>
        <button
          @click="cancelEditing"
          :disabled="isLoading"
          class="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Success Message -->
    <div v-if="successMessage" class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
      <div class="flex items-center">
        <svg class="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="text-sm text-green-800">{{ successMessage }}</p>
      </div>
    </div>
  </div>
</template>

<!-- script moved above template to satisfy component-tags-order rule and emit renamed to profileUpdated -->

<style scoped>
.profile-name-editor {
  @apply w-full;
}
</style>
