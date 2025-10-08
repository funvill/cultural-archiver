<script setup lang="ts">
import { ref, computed } from 'vue';
import { adminService } from '../services/admin';
import type { SocialMediaScheduleApiResponse } from '../../../shared/types';

/**
 * Social Media Schedule List Component
 *
 * Displays scheduled posts grouped by week/month with edit and delete options
 */

const props = defineProps<{
  schedules: SocialMediaScheduleApiResponse[];
}>();

const emit = defineEmits<{
  scheduleDeleted: [];
  scheduleUpdated: [];
}>();

// State
const selectedSchedule = ref<SocialMediaScheduleApiResponse | null>(null);
const showModal = ref(false);
const isDeleting = ref(false);
const isUpdating = ref(false);
const error = ref<string | null>(null);

// Editable fields
const editedBody = ref('');
const editedDate = ref('');

// Computed minimum date for date inputs
const minDate = computed(() => new Date().toISOString().split('T')[0] ?? '');

// Group schedules by month
const groupedSchedules = computed(() => {
  const groups: Record<string, SocialMediaScheduleApiResponse[]> = {};

  props.schedules.forEach((schedule) => {
    const date = new Date(schedule.scheduled_date);
    const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    if (!groups[monthKey]) {
      groups[monthKey] = [];
    }
    groups[monthKey].push(schedule);
  });

  // Sort within each group
  Object.keys(groups).forEach((key) => {
    const groupSchedules = groups[key];
    if (groupSchedules) {
      groupSchedules.sort(
        (a, b) =>
          new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );
    }
  });

  return groups;
});

// Open modal
function openModal(schedule: SocialMediaScheduleApiResponse): void {
  selectedSchedule.value = schedule;
  editedBody.value = schedule.body;
  editedDate.value = schedule.scheduled_date;
  error.value = null;
  showModal.value = true;
}

// Close modal
function closeModal(): void {
  showModal.value = false;
  selectedSchedule.value = null;
  editedBody.value = '';
  editedDate.value = '';
  error.value = null;
}

// Delete schedule
async function deleteSchedule(): Promise<void> {
  if (!selectedSchedule.value) return;

  if (!confirm('Are you sure you want to unschedule this post?')) {
    return;
  }

  try {
    isDeleting.value = true;
    error.value = null;

    await adminService.deleteSocialMediaSchedule(selectedSchedule.value.id);

    closeModal();
    emit('scheduleDeleted');
  } catch (err) {
    console.error('Failed to delete schedule:', err);
    error.value = err instanceof Error ? err.message : 'Failed to delete schedule';
  } finally {
    isDeleting.value = false;
  }
}

// Update schedule
async function updateSchedule(): Promise<void> {
  if (!selectedSchedule.value) return;

  try {
    isUpdating.value = true;
    error.value = null;

    const updates: Record<string, unknown> = {};

    if (editedBody.value !== selectedSchedule.value.body) {
      updates.body = editedBody.value;
    }

    if (editedDate.value !== selectedSchedule.value.scheduled_date) {
      updates.scheduled_date = editedDate.value;
    }

    if (Object.keys(updates).length === 0) {
      closeModal();
      return;
    }

    await adminService.updateSocialMediaSchedule(selectedSchedule.value.id, updates);

    closeModal();
    emit('scheduleUpdated');
  } catch (err) {
    console.error('Failed to update schedule:', err);
    error.value = err instanceof Error ? err.message : 'Failed to update schedule';
  } finally {
    isUpdating.value = false;
  }
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Get platform badge color
function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    bluesky: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    instagram: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    twitter: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
    facebook: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  };
  return colors[platform] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
}
</script>

<template>
  <div class="space-y-8">
    <!-- Empty State -->
    <div
      v-if="schedules.length === 0"
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
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No scheduled posts</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Schedule posts from the Suggestions tab to get started.
      </p>
    </div>

    <!-- Grouped Schedule List -->
    <div v-for="(monthSchedules, month) in groupedSchedules" :key="month" class="space-y-4">
      <!-- Month Header -->
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ month }}</h3>

      <!-- Schedule Items -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
        <button
          v-for="schedule in monthSchedules"
          :key="schedule.id"
          @click="openModal(schedule)"
          class="w-full px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-start space-x-4 flex-1 min-w-0">
              <!-- Artwork Thumbnail -->
              <div v-if="schedule.artwork?.photos" class="flex-shrink-0">
                <img
                  :src="typeof schedule.artwork.photos === 'string' ? JSON.parse(schedule.artwork.photos)[0] : schedule.artwork.photos[0]"
                  :alt="schedule.artwork.title || 'Artwork'"
                  class="w-16 h-16 object-cover rounded"
                />
              </div>

              <!-- Schedule Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2 mb-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ formatDate(schedule.scheduled_date) }}
                  </span>
                  <span
                    :class="[
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize',
                      getPlatformColor(schedule.social_type),
                    ]"
                  >
                    {{ schedule.social_type }}
                  </span>
                </div>
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ schedule.artwork?.title || 'Untitled' }}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                  {{ schedule.body }}
                </p>
              </div>
            </div>

            <!-- Arrow Icon -->
            <svg
              class="flex-shrink-0 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </button>
      </div>
    </div>

    <!-- Detail Modal -->
    <div
      v-if="showModal && selectedSchedule"
      class="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          @click="closeModal"
        ></div>

        <!-- Center modal -->
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <!-- Modal panel -->
        <div
          class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
        >
          <div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <!-- Header -->
            <div class="sm:flex sm:items-start mb-4">
              <div class="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                  Edit Scheduled Post
                </h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {{ selectedSchedule.artwork?.title || 'Untitled' }}
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

            <!-- Edit Fields -->
            <div class="space-y-4">
              <!-- Date -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Scheduled Date
                </label>
                <input
                  v-model="editedDate"
                  type="date"
                  :min="minDate"
                  class="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>

              <!-- Post Body -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Post Text
                </label>
                <textarea
                  v-model="editedBody"
                  rows="6"
                  class="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          <!-- Modal Actions -->
          <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              @click="updateSchedule"
              :disabled="isUpdating || isDeleting"
              type="button"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {{ isUpdating ? 'Saving...' : 'Save Changes' }}
            </button>
            <button
              @click="deleteSchedule"
              :disabled="isUpdating || isDeleting"
              type="button"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-red-300 dark:border-red-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {{ isDeleting ? 'Deleting...' : 'Unschedule' }}
            </button>
            <button
              @click="closeModal"
              :disabled="isUpdating || isDeleting"
              type="button"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
