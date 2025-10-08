<script setup lang="ts">
import { ref, computed } from 'vue';
import { adminService } from '../services/admin';
import { useToasts } from '../composables/useToasts';
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
const isTesting = ref(false);
const testResult = ref<any | null>(null);
const commitResult = ref(false);
const error = ref<string | null>(null);
// Use global toast helpers for transient feedback
const { success: toastSuccess, error: toastError } = useToasts();

// Editable fields
const editedBody = ref('');
const editedDate = ref('');

// Computed minimum date for date inputs
const minDate = computed(() => new Date().toISOString().split('T')[0] ?? '');

// Group schedules by date (not just month)
const groupedSchedules = computed(() => {
  const groups: Record<string, Record<string, SocialMediaScheduleApiResponse[]>> = {};

  props.schedules.forEach((schedule) => {
    const date = new Date(schedule.scheduled_date);
    const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const dayKey = schedule.scheduled_date; // Use ISO date as key (YYYY-MM-DD)

    if (!groups[monthKey]) {
      groups[monthKey] = {};
    }
    if (!groups[monthKey]![dayKey]) {
      groups[monthKey]![dayKey] = [];
    }
    groups[monthKey]![dayKey]!.push(schedule);
  });

  return groups;
});

// Format date headers
function formatDayHeader(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

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
  isTesting.value = false;
  testResult.value = null;
  commitResult.value = false;
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

// Run manual test (commit optional)
async function runTest(): Promise<void> {
  if (!selectedSchedule.value) return;

  if (commitResult.value && !window.confirm('This will mark the schedule as posted/failed in the database. Continue?')) {
    return;
  }

  isTesting.value = true;
  testResult.value = null;

  try {
    const res = await adminService.testSocialMediaSchedule(selectedSchedule.value.id, { commit: commitResult.value });
    testResult.value = res;
    // If commit was requested, refresh schedules in parent and show a toast
    if (commitResult.value) {
      // Emit an event to let parent reload schedules (matches defined emit)
      emit('scheduleUpdated');
      // Show toast based on result - check known fields safely
      const resultObj = (res && (res as any).result) || (res && (res as any).data && (res as any).data.result) || null;
      const hadUrl = !!(resultObj && (resultObj as any).post_url);
      const hadError = !!(resultObj && (resultObj as any).error);
      if (hadUrl || (resultObj && !hadError)) {
        toastSuccess('Post committed and schedule updated.');
      } else {
        toastError('Commit attempted but failed. See details below.');
      }
    }
  } catch (e) {
    testResult.value = { success: false, error: e instanceof Error ? e.message : String(e) };
    if (commitResult.value) {
  toastError('Commit attempted but an error occurred.');
    }
  } finally {
    isTesting.value = false;
  }
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

    <!-- Grouped Schedule List by Month → Date → Platforms -->
    <div v-for="(dateGroups, monthKey) in groupedSchedules" :key="monthKey" class="space-y-6">
      <!-- Month/Year Header (h3) -->
      <h3 class="text-xl font-bold text-gray-900 dark:text-white border-b-2 border-gray-300 dark:border-gray-600 pb-2">
        {{ monthKey }}
      </h3>

      <!-- Date Groups within Month -->
      <div v-for="(daySchedules, dateKey) in dateGroups" :key="dateKey" class="space-y-3 ml-4">
        <!-- Day Header (h4) -->
        <h4 class="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {{ formatDayHeader(dateKey) }}
        </h4>

        <!-- Platform Cards (Side by Side) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            v-for="schedule in daySchedules"
            :key="schedule.id"
            @click="openModal(schedule)"
            class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors p-4 text-left"
          >
            <div class="flex items-start space-x-3">
              <!-- Artwork Thumbnail -->
              <div v-if="schedule.artwork?.photos" class="flex-shrink-0">
                <img
                  :src="typeof schedule.artwork.photos === 'string' ? JSON.parse(schedule.artwork.photos)[0] : schedule.artwork.photos[0]"
                  :alt="schedule.artwork.title || 'Artwork'"
                  class="w-16 h-16 object-cover rounded"
                />
              </div>

              <!-- Post Content -->
              <div class="flex-1 min-w-0">
                <!-- Platform Badge -->
                <span
                  :class="[
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize mb-2',
                    getPlatformColor(schedule.social_type),
                  ]"
                >
                  {{ schedule.social_type === 'bluesky' ? '🦋 Bluesky' : '📷 Instagram' }}
                </span>

                <!-- Artwork Title -->
                <p class="text-sm font-semibold text-gray-900 dark:text-white truncate mb-1">
                  {{ schedule.artwork?.title || 'Untitled' }}
                </p>

                <!-- Post Body Preview -->
                <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {{ schedule.body }}
                </p>

                <!-- Status Badge (if not scheduled) -->
                <div v-if="schedule.status !== 'scheduled'" class="mt-2">
                  <span
                    :class="[
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                      schedule.status === 'posted'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                    ]"
                  >
                    {{ schedule.status }}
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>
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
                    <div class="mt-3 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm space-y-2">
                      <label class="inline-flex items-center space-x-2">
                        <input type="checkbox" v-model="commitResult" class="form-checkbox h-4 w-4 text-yellow-600" />
                        <span class="text-sm text-gray-700 dark:text-gray-200">Commit result</span>
                      </label>

                      <button
                        @click="runTest"
                        :disabled="isUpdating || isDeleting || isTesting"
                        type="button"
                        class="w-full inline-flex justify-center rounded-md border border-yellow-300 dark:border-yellow-600 shadow-sm px-4 py-2 bg-white dark:bg-yellow-800 text-base font-medium text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:ml-0 sm:w-auto sm:text-sm disabled:opacity-50"
                      >
                        {{ isTesting ? 'Testing...' : commitResult ? 'Test & Commit' : 'Test Now' }}
                      </button>
                    </div>
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
          <!-- Toasts now handled globally by <Toasts /> -->
          <!-- Test result -->
          <div v-if="testResult" class="px-6 pb-4">
            <h5 class="text-sm font-medium text-gray-900 dark:text-white">Test Result</h5>
            <div class="mt-2 text-sm text-gray-700 dark:text-gray-200">
              <div v-if="testResult.data && testResult.data.result">
                <div v-if="testResult.data.result.post_url">
                  <p>Post published:</p>
                  <a :href="testResult.data.result.post_url" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-300 break-all">{{ testResult.data.result.post_url }}</a>
                </div>
                <div v-else-if="testResult.data.result.error">
                  <p class="font-semibold text-red-700 dark:text-red-300">Error:</p>
                  <pre class="mt-2 text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto">{{ testResult.data.result.error }}</pre>
                </div>
                <div v-else>
                  <pre class="mt-2 text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto">{{ JSON.stringify(testResult.data.result, null, 2) }}</pre>
                </div>
              </div>
              <div v-else-if="testResult.result">
                <!-- Response shape from earlier implementations -->
                <div v-if="testResult.result.post_url">
                  <p>Post published:</p>
                  <a :href="testResult.result.post_url" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-300 break-all">{{ testResult.result.post_url }}</a>
                </div>
                <div v-else-if="testResult.result.error">
                  <p class="font-semibold text-red-700 dark:text-red-300">Error:</p>
                  <pre class="mt-2 text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto">{{ testResult.result.error }}</pre>
                </div>
                <div v-else>
                  <pre class="mt-2 text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto">{{ JSON.stringify(testResult.result, null, 2) }}</pre>
                </div>
              </div>
              <div v-else>
                <pre class="mt-2 text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto">{{ JSON.stringify(testResult, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
