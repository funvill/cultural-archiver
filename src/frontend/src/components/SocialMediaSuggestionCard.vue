<script setup lang="ts">
import { ref, computed } from 'vue';
import { adminService } from '../services/admin';
import type { SocialMediaSuggestion } from '../../../shared/types';

/**
 * Social Media Suggestion Card Component
 *
 * Displays an artwork suggestion with side-by-side platform previews for Bluesky and Instagram
 */

const props = defineProps<{
  suggestion: SocialMediaSuggestion;
}>();

const emit = defineEmits<{
  scheduled: [];
}>();

// Active platforms (Twitter and Facebook disabled)
const ACTIVE_PLATFORMS = ['bluesky', 'instagram'] as const;
type ActivePlatform = (typeof ACTIVE_PLATFORMS)[number];

// State
const isScheduling = ref(false);
const error = ref<string | null>(null);
const showDatePicker = ref(false);
const customDate = ref('');

// Editable post text for each active platform
const editableText = ref({
  bluesky: props.suggestion.suggested_posts.bluesky?.body || '',
  instagram: props.suggestion.suggested_posts.instagram?.body || '',
});

// Get photos for each platform
const getPhotos = (platform: ActivePlatform) => {
  const platformPhotos = props.suggestion.suggested_posts[platform]?.photos || [];
  return platformPhotos.slice(0, 4);
};

// Character limits by platform
const characterLimits = {
  bluesky: 300,
  instagram: 2200,
} as const;

// Check if text is over limit
const isOverLimit = (platform: ActivePlatform) => {
  return (editableText.value[platform]?.length || 0) > characterLimits[platform];
};

// Check if any platform is over limit
const anyOverLimit = computed(() => {
  return ACTIVE_PLATFORMS.some((platform) => isOverLimit(platform));
});

// Computed minimum date for date inputs
const minDate = computed(() => new Date().toISOString().split('T')[0] ?? '');

// Schedule for next available date - creates posts for BOTH platforms
async function scheduleForNextDate(): Promise<void> {
  try {
    isScheduling.value = true;
    error.value = null;

    // Get next available date
    const nextDate = await adminService.getNextAvailableDate();

    // Create schedules for both Bluesky and Instagram
    await Promise.all(
      ACTIVE_PLATFORMS.map((platform) =>
        adminService.createSocialMediaSchedule({
          artwork_id: props.suggestion.artwork.id,
          scheduled_date: nextDate,
          social_type: platform,
          body: editableText.value[platform],
          photos: getPhotos(platform),
        })
      )
    );

    emit('scheduled');
  } catch (err) {
    console.error('Failed to schedule posts:', err);
    error.value = err instanceof Error ? err.message : 'Failed to schedule posts';
  } finally {
    isScheduling.value = false;
  }
}

// Schedule for custom date - creates posts for BOTH platforms
async function scheduleForCustomDate(): Promise<void> {
  if (!customDate.value) {
    error.value = 'Please select a date';
    return;
  }

  try {
    isScheduling.value = true;
    error.value = null;

    // Create schedules for both Bluesky and Instagram
    const results = await Promise.all(
      ACTIVE_PLATFORMS.map((platform) =>
        adminService.createSocialMediaSchedule({
          artwork_id: props.suggestion.artwork.id,
          scheduled_date: customDate.value,
          social_type: platform,
          body: editableText.value[platform],
          photos: getPhotos(platform),
        })
      )
    );

    // Check for warnings
    const warnings = results.filter((r) => r.warning).map((r) => r.warning);
    if (warnings.length > 0) {
      console.warn('Schedule warnings:', warnings);
    }

    showDatePicker.value = false;
    customDate.value = '';
    emit('scheduled');
  } catch (err) {
    console.error('Failed to schedule posts:', err);
    error.value = err instanceof Error ? err.message : 'Failed to schedule posts';
  } finally {
    isScheduling.value = false;
  }
}

// Get first photo for main preview
const previewPhoto = computed(() => {
  const blueskyPhotos = getPhotos('bluesky');
  if (blueskyPhotos.length === 0) return null;
  const photo = blueskyPhotos[0];
  if (!photo) return null;
  return typeof photo === 'string' ? photo : (photo as unknown as { url: string }).url;
});

// Platform display config
const platformConfig = {
  bluesky: {
    name: 'Bluesky',
    icon: '🦋',
    color: 'blue',
  },
  instagram: {
    name: 'Instagram',
    icon: '📷',
    color: 'pink',
  },
} as const;
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
    <div class="p-6">
      <!-- Artwork Info -->
      <div class="flex items-start space-x-4 mb-6">
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
            <a
              :href="`/artwork/${suggestion.artwork.id}`"
              target="_blank"
              class="hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted"
              title="Open artwork detail page in new tab"
            >
              {{ suggestion.artwork.title || 'Untitled' }}
              <svg class="inline-block w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </h3>
          <p v-if="suggestion.artists.length > 0" class="text-sm text-gray-600 dark:text-gray-400">
            {{ suggestion.artists.map((a) => a.name).join(', ') }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Created {{ new Date(suggestion.artwork.created_at).toLocaleDateString() }}
          </p>
        </div>
      </div>

      <!-- Platform Preview Cards (Side by Side) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div
          v-for="platform in ACTIVE_PLATFORMS"
          :key="platform"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          <!-- Platform Header -->
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center space-x-2">
              <span class="text-xl">{{ platformConfig[platform].icon }}</span>
              <h4 class="font-semibold text-gray-900 dark:text-white capitalize">
                {{ platformConfig[platform].name }}
              </h4>
            </div>
            <span
              :class="[
                'text-xs px-2 py-0.5 rounded',
                isOverLimit(platform)
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
              ]"
            >
              {{ editableText[platform].length }} / {{ characterLimits[platform] }}
            </span>
          </div>

          <!-- Post Text Editor -->
          <textarea
            v-model="editableText[platform]"
            rows="18"
            :class="[
              'block w-full rounded-md shadow-sm sm:text-sm',
              isOverLimit(platform)
                ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500',
              'dark:bg-gray-700 dark:text-white',
            ]"
            :placeholder="`Enter post text for ${platformConfig[platform].name}...`"
          />
          <p v-if="isOverLimit(platform)" class="mt-1 text-xs text-red-600 dark:text-red-400">
            Text exceeds {{ characterLimits[platform] }} character limit
          </p>
        </div>
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
          <!-- Quick Schedule Button (schedules BOTH platforms) -->
          <button
            @click="scheduleForNextDate"
            :disabled="isScheduling || anyOverLimit"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Schedule both Bluesky and Instagram posts for next available date"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            :disabled="isScheduling || anyOverLimit"
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
          Scheduling both platforms...
        </div>
      </div>

      <!-- Date Picker -->
      <div v-if="showDatePicker" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Date (will schedule both Bluesky and Instagram)
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
            Schedule Both
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
