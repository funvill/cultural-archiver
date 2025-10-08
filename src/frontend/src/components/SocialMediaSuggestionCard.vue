<script setup lang="ts">
import { ref, computed } from 'vue';
import { adminService } from '../services/admin';
import type { SocialMediaSuggestion, SocialMediaType } from '../../../shared/types';

/**
 * Social Media Suggestion Card Component
 *
 * Displays an artwork suggestion with editable post text for different platforms
 */

const props = defineProps<{
  suggestion: SocialMediaSuggestion;
}>();

const emit = defineEmits<{
  scheduled: [];
}>();

// State
const selectedPlatform = ref<SocialMediaType>('bluesky');
const isScheduling = ref(false);
const error = ref<string | null>(null);
const showDatePicker = ref(false);
const customDate = ref('');

// Editable post text
const editableText = ref<Record<SocialMediaType, string>>({
  bluesky: props.suggestion.suggested_posts.bluesky?.body || '',
  instagram: props.suggestion.suggested_posts.instagram?.body || '',
  twitter: props.suggestion.suggested_posts.twitter?.body || '',
  facebook: props.suggestion.suggested_posts.facebook?.body || '',
  other: '',
});

// Get photos for the artwork
const photos = computed(() => {
  const platformPhotos =
    props.suggestion.suggested_posts[selectedPlatform.value]?.photos || [];
  return platformPhotos.slice(0, 4);
});

// Character count for current platform
const characterCount = computed(() => {
  return editableText.value[selectedPlatform.value]?.length || 0;
});

// Character limits by platform
const characterLimits: Record<SocialMediaType, number> = {
  bluesky: 300,
  instagram: 2200,
  twitter: 280,
  facebook: 5000,
  other: 1000,
};

const maxCharacters = computed(() => characterLimits[selectedPlatform.value]);

const isOverLimit = computed(() => characterCount.value > maxCharacters.value);

// Computed minimum date for date inputs
const minDate = computed(() => new Date().toISOString().split('T')[0] ?? '');

// Schedule for next available date
async function scheduleForNextDate(): Promise<void> {
  try {
    isScheduling.value = true;
    error.value = null;

    // Get next available date
    const nextDate = await adminService.getNextAvailableDate();

    // Create schedule
    await adminService.createSocialMediaSchedule({
      artwork_id: props.suggestion.artwork.id,
      scheduled_date: nextDate,
      social_type: selectedPlatform.value,
      body: editableText.value[selectedPlatform.value],
      photos: photos.value,
    });

    emit('scheduled');
  } catch (err) {
    console.error('Failed to schedule post:', err);
    error.value = err instanceof Error ? err.message : 'Failed to schedule post';
  } finally {
    isScheduling.value = false;
  }
}

// Schedule for custom date
async function scheduleForCustomDate(): Promise<void> {
  if (!customDate.value) {
    error.value = 'Please select a date';
    return;
  }

  try {
    isScheduling.value = true;
    error.value = null;

    const result = await adminService.createSocialMediaSchedule({
      artwork_id: props.suggestion.artwork.id,
      scheduled_date: customDate.value,
      social_type: selectedPlatform.value,
      body: editableText.value[selectedPlatform.value],
      photos: photos.value,
    });

    if (result.warning) {
      console.warn('Schedule warning:', result.warning);
    }

    showDatePicker.value = false;
    customDate.value = '';
    emit('scheduled');
  } catch (err) {
    console.error('Failed to schedule post:', err);
    error.value = err instanceof Error ? err.message : 'Failed to schedule post';
  } finally {
    isScheduling.value = false;
  }
}

// Get first photo for preview
const previewPhoto = computed(() => {
  if (photos.value.length === 0) return null;
  const photo = photos.value[0];
  if (!photo) return null;
  return typeof photo === 'string' ? photo : (photo as unknown as { url: string }).url;
});
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
    <div class="p-6">
      <!-- Artwork Info -->
      <div class="flex items-start space-x-4 mb-4">
        <!-- Thumbnail -->
        <div v-if="previewPhoto" class="flex-shrink-0">
          <img
            :src="previewPhoto"
            :alt="suggestion.artwork.title || 'Artwork'"
            class="w-20 h-20 object-cover rounded"
          />
        </div>

        <!-- Title and Artists -->
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {{ suggestion.artwork.title || 'Untitled' }}
          </h3>
          <p v-if="suggestion.artists.length > 0" class="text-sm text-gray-600 dark:text-gray-400">
            {{ suggestion.artists.map((a) => a.name).join(', ') }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {{ photos.length }} photo{{ photos.length !== 1 ? 's' : '' }} •
            Created {{ new Date(suggestion.artwork.created_at).toLocaleDateString() }}
          </p>
        </div>
      </div>

      <!-- Platform Selector -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Platform
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="platform in (['bluesky', 'instagram', 'twitter', 'facebook'] as SocialMediaType[])"
            :key="platform"
            @click="selectedPlatform = platform"
            :class="[
              selectedPlatform === platform
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
              'px-3 py-1.5 rounded-md text-sm font-medium capitalize',
            ]"
          >
            {{ platform }}
          </button>
        </div>
      </div>

      <!-- Post Text Editor -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Post Text
          </label>
          <span
            :class="[
              'text-xs',
              isOverLimit ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400',
            ]"
          >
            {{ characterCount }} / {{ maxCharacters }}
          </span>
        </div>
        <textarea
          v-model="editableText[selectedPlatform]"
          rows="6"
          :class="[
            'block w-full rounded-md shadow-sm sm:text-sm',
            isOverLimit
              ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500',
            'dark:bg-gray-700 dark:text-white',
          ]"
          :placeholder="`Enter post text for ${selectedPlatform}...`"
        />
        <p v-if="isOverLimit" class="mt-1 text-sm text-red-600 dark:text-red-400">
          Text exceeds character limit
        </p>
      </div>

      <!-- Error Message -->
      <div
        v-if="error"
        class="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3"
      >
        <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <!-- Quick Schedule Button -->
          <button
            @click="scheduleForNextDate"
            :disabled="isScheduling || isOverLimit"
            class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Schedule for next available date"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Schedule Next
          </button>

          <!-- Custom Date Button -->
          <button
            @click="showDatePicker = !showDatePicker"
            :disabled="isScheduling || isOverLimit"
            class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Pick Date
          </button>
        </div>

        <!-- Loading Indicator -->
        <div v-if="isScheduling" class="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Scheduling...
        </div>
      </div>

      <!-- Date Picker -->
      <div v-if="showDatePicker" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Date
        </label>
        <div class="flex items-center space-x-2">
          <input
            v-model="customDate"
            type="date"
            :min="minDate"
            class="block flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
          />
          <button
            @click="scheduleForCustomDate"
            :disabled="!customDate || isScheduling"
            class="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Schedule
          </button>
          <button
            @click="showDatePicker = false"
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
