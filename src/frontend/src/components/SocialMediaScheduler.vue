<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminService } from '../services/admin';
import SocialMediaSuggestionCard from './SocialMediaSuggestionCard.vue';
import SocialMediaScheduleList from './SocialMediaScheduleList.vue';
import type {
  SocialMediaSuggestion,
  SocialMediaScheduleApiResponse,
} from '../../../shared/types';

/**
 * Social Media Scheduler Component
 *
 * Main component for managing social media post scheduling with
 * artwork suggestions and scheduled posts list
 */

// State
const activeView = ref<'suggestions' | 'schedule'>('suggestions');
const suggestions = ref<SocialMediaSuggestion[]>([]);
const schedules = ref<SocialMediaScheduleApiResponse[]>([]);
const isLoadingSuggestions = ref(false);
const isLoadingSchedules = ref(false);
const error = ref<string | null>(null);
const currentPage = ref(1);
const hasMore = ref(true);

// Load suggestions
async function loadSuggestions(page = 1): Promise<void> {
  try {
    isLoadingSuggestions.value = true;
    error.value = null;

    const response = await adminService.getSocialMediaSuggestions({
      page,
      per_page: 10,
    });

    if (page === 1) {
      suggestions.value = response.suggestions;
    } else {
      suggestions.value.push(...response.suggestions);
    }

    hasMore.value = response.has_more;
    currentPage.value = page;
  } catch (err) {
    console.error('Failed to load suggestions:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load suggestions';
  } finally {
    isLoadingSuggestions.value = false;
  }
}

// Load more suggestions
function loadMore(): void {
  if (!isLoadingSuggestions.value && hasMore.value) {
    loadSuggestions(currentPage.value + 1);
  }
}

// Load scheduled posts
async function loadSchedules(): Promise<void> {
  try {
    isLoadingSchedules.value = true;
    error.value = null;

    const response = await adminService.getSocialMediaSchedules({
      status: 'scheduled',
      per_page: 50,
    });

    schedules.value = response.schedules;
  } catch (err) {
    console.error('Failed to load schedules:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load schedules';
  } finally {
    isLoadingSchedules.value = false;
  }
}

// Handle successful scheduling
function handleScheduled(): void {
  // Refresh both suggestions and schedules
  loadSuggestions(1);
  loadSchedules();
}

// Handle schedule deletion
function handleScheduleDeleted(): void {
  loadSchedules();
}

// Switch view
function switchView(view: 'suggestions' | 'schedule'): void {
  activeView.value = view;
  if (view === 'schedule' && schedules.value.length === 0) {
    loadSchedules();
  }
}

// Initialize
onMounted(async () => {
  await loadSuggestions();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Social Media Scheduler</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Schedule artwork posts for Bluesky, Instagram, and other platforms
        </p>
      </div>
    </div>

    <!-- View Toggle -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="-mb-px flex space-x-8" aria-label="Scheduler sections">
        <button
          @click="switchView('suggestions')"
          :class="[
            activeView === 'suggestions'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
            'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm',
          ]"
        >
          Suggestions ({{ suggestions.length }})
        </button>
        <button
          @click="switchView('schedule')"
          :class="[
            activeView === 'schedule'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
            'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm',
          ]"
        >
          Scheduled Posts ({{ schedules.length }})
        </button>
      </nav>
    </div>

    <!-- Error State -->
    <div
      v-if="error"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4"
    >
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Suggestions View -->
    <div v-if="activeView === 'suggestions'" class="space-y-6">
      <!-- Loading State -->
      <div v-if="isLoadingSuggestions && suggestions.length === 0" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Loading suggestions...</p>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!isLoadingSuggestions && suggestions.length === 0"
        class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow"
      >
        <svg
          class="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No suggestions found</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          All eligible artworks have been posted, or none meet the criteria.
        </p>
      </div>

      <!-- Suggestions List -->
      <div v-else class="space-y-6">
        <SocialMediaSuggestionCard
          v-for="(suggestion, index) in suggestions"
          :key="`${suggestion.artwork.id}-${index}`"
          :suggestion="suggestion"
          @scheduled="handleScheduled"
        />

        <!-- Load More Button -->
        <div v-if="hasMore" class="text-center pt-4">
          <button
            @click="loadMore"
            :disabled="isLoadingSuggestions"
            class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <svg
              v-if="isLoadingSuggestions"
              class="animate-spin -ml-1 mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
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
            {{ isLoadingSuggestions ? 'Loading...' : 'Load More' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Schedule View -->
    <div v-if="activeView === 'schedule'" class="space-y-6">
      <!-- Loading State -->
      <div v-if="isLoadingSchedules" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Loading schedules...</p>
      </div>

      <!-- Schedule List -->
      <SocialMediaScheduleList
        v-else
        :schedules="schedules"
        @schedule-deleted="handleScheduleDeleted"
        @schedule-updated="loadSchedules"
      />
    </div>
  </div>
</template>
