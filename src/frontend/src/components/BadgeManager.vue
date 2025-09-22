<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { adminService } from '../services/admin';
import type { BadgeRecord } from '../../../shared/types';

/**
 * Badge Manager Component
 *
 * Provides admin interface for managing badges including viewing statistics,
 * creating new badges, and updating existing badges.
 */

// Reactive state
const badges = ref<Array<BadgeRecord & { award_count: number }>>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const showCreateModal = ref(false);
const showEditModal = ref(false);
const editingBadge = ref<BadgeRecord | null>(null);

// Form state
const createForm = ref({
  badge_key: '',
  title: '',
  description: '',
  icon_emoji: '🏆',
  category: 'activity',
  level: 1,
  threshold_type: 'submission_count',
  threshold_value: 1,
});

const editForm = ref({
  title: '',
  description: '',
  icon_emoji: '',
  category: '',
  level: 1,
  threshold_type: '',
  threshold_value: null as number | null,
  is_active: true,
});

// Validation state
const createErrors = ref<Record<string, string>>({});
const editErrors = ref<Record<string, string>>({});

// Computed properties
const totalBadgesAwarded = computed(() => {
  return badges.value.reduce((sum, badge) => sum + badge.award_count, 0);
});

const activeBadges = computed(() => {
  return badges.value.filter(badge => badge.is_active);
});

const badgesByCategory = computed(() => {
  const grouped: Record<string, Array<BadgeRecord & { award_count: number }>> = {};
  badges.value.forEach(badge => {
    const key = String(badge.category || 'uncategorized');
    // Ensure an array exists for this category then push in a local const
    const arr = grouped[key] ?? (grouped[key] = []);
    arr.push(badge);
  });
  return grouped;
});

// Threshold type options
const thresholdTypes = [
  { value: 'email_verified', label: 'Email Verification', requiresValue: false },
  { value: 'submission_count', label: 'Submission Count', requiresValue: true },
  { value: 'photo_count', label: 'Photo Count', requiresValue: true },
  { value: 'account_age', label: 'Account Age (Days)', requiresValue: true },
];

// Load badges
async function loadBadges(): Promise<void> {
  try {
    isLoading.value = true;
    error.value = null;
    badges.value = await adminService.getBadges();
  } catch (err) {
    console.error('Failed to load badges:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load badges';
  } finally {
    isLoading.value = false;
  }
}

// Create new badge
async function createBadge(): Promise<void> {
  try {
    createErrors.value = {};
    
    // Validate form
    if (!validateCreateForm()) {
      return;
    }

    const badgeData = {
      ...createForm.value,
      threshold_value: createForm.value.threshold_type === 'email_verified' 
        ? null 
        : createForm.value.threshold_value,
    };

    await adminService.createBadge(badgeData);
    
    // Reset form and close modal
    resetCreateForm();
    showCreateModal.value = false;
    
    // Reload badges
    await loadBadges();
  } catch (err) {
    console.error('Failed to create badge:', err);
    createErrors.value.general = err instanceof Error ? err.message : 'Failed to create badge';
  }
}

// Edit badge
function openEditModal(badge: BadgeRecord & { award_count: number }): void {
  editingBadge.value = badge;
  editForm.value = {
    title: badge.title,
    description: badge.description,
    icon_emoji: badge.icon_emoji,
    category: badge.category,
    level: badge.level,
    threshold_type: badge.threshold_type,
    threshold_value: badge.threshold_value,
    is_active: badge.is_active,
  };
  editErrors.value = {};
  showEditModal.value = true;
}

// Update badge
async function updateBadge(): Promise<void> {
  if (!editingBadge.value) return;
  
  try {
    editErrors.value = {};
    
    // Validate form
    if (!validateEditForm()) {
      return;
    }

    await adminService.updateBadge(editingBadge.value.id, editForm.value);
    
    // Close modal
    showEditModal.value = false;
    editingBadge.value = null;
    
    // Reload badges
    await loadBadges();
  } catch (err) {
    console.error('Failed to update badge:', err);
    editErrors.value.general = err instanceof Error ? err.message : 'Failed to update badge';
  }
}

// Deactivate badge
async function deactivateBadge(badge: BadgeRecord & { award_count: number }): Promise<void> {
  if (!confirm(`Are you sure you want to deactivate the badge "${badge.title}"?`)) {
    return;
  }
  
  try {
    await adminService.deactivateBadge(badge.id);
    await loadBadges();
  } catch (err) {
    console.error('Failed to deactivate badge:', err);
    error.value = err instanceof Error ? err.message : 'Failed to deactivate badge';
  }
}

// Form validation
function validateCreateForm(): boolean {
  const errors: Record<string, string> = {};
  
  if (!createForm.value.badge_key.trim() || createForm.value.badge_key.length < 2) {
    errors.badge_key = 'Badge key must be at least 2 characters';
  }
  
  if (!createForm.value.title.trim() || createForm.value.title.length < 2) {
    errors.title = 'Title must be at least 2 characters';
  }
  
  if (!createForm.value.description.trim() || createForm.value.description.length < 10) {
    errors.description = 'Description must be at least 10 characters';
  }
  
  if (!createForm.value.icon_emoji.trim()) {
    errors.icon_emoji = 'Icon emoji is required';
  }
  
  if (createForm.value.level < 1) {
    errors.level = 'Level must be at least 1';
  }
  
  if (createForm.value.threshold_type !== 'email_verified' && createForm.value.threshold_value < 1) {
    errors.threshold_value = 'Threshold value must be at least 1';
  }
  
  createErrors.value = errors;
  return Object.keys(errors).length === 0;
}

function validateEditForm(): boolean {
  const errors: Record<string, string> = {};
  
  if (!editForm.value.title.trim() || editForm.value.title.length < 2) {
    errors.title = 'Title must be at least 2 characters';
  }
  
  if (!editForm.value.description.trim() || editForm.value.description.length < 10) {
    errors.description = 'Description must be at least 10 characters';
  }
  
  if (editForm.value.level < 1) {
    errors.level = 'Level must be at least 1';
  }
  
  editErrors.value = errors;
  return Object.keys(errors).length === 0;
}

// Reset forms
function resetCreateForm(): void {
  createForm.value = {
    badge_key: '',
    title: '',
    description: '',
    icon_emoji: '🏆',
    category: 'activity',
    level: 1,
    threshold_type: 'submission_count',
    threshold_value: 1,
  };
  createErrors.value = {};
}

function resetEditForm(): void {
  editForm.value = {
    title: '',
    description: '',
    icon_emoji: '',
    category: '',
    level: 1,
    threshold_type: '',
    threshold_value: null,
    is_active: true,
  };
  editErrors.value = {};
  editingBadge.value = null;
}

// Initialize component
onMounted(async () => {
  await loadBadges();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Badge Management</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage badge definitions and view award statistics
        </p>
      </div>
      <button
        @click="showCreateModal = true"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Create Badge
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Loading badges...</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4"
    >
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200">Error loading badges</h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Statistics -->
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Badges</dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-white">{{ badges.length }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Active Badges</dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-white">{{ activeBadges.length }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Awarded</dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-white">{{ totalBadgesAwarded.toLocaleString() }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Badge Groups by Category -->
    <div v-if="!isLoading && !error" class="space-y-6">
      <div v-for="(categoryBadges, category) in badgesByCategory" :key="category" class="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white capitalize">{{ category }} Badges</h3>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            <div
              v-for="badge in categoryBadges"
              :key="badge.id"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              :class="{ 'opacity-50': !badge.is_active }"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center space-x-3">
                  <span class="text-2xl">{{ badge.icon_emoji }}</span>
                  <div>
                    <h4 class="font-medium text-gray-900 dark:text-white">{{ badge.title }}</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Level {{ badge.level }}</p>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <button
                    @click="openEditModal(badge)"
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Edit badge"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    v-if="badge.is_active"
                    @click="deactivateBadge(badge)"
                    class="text-red-400 hover:text-red-600"
                    title="Deactivate badge"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ badge.description }}</p>
              
              <div class="mt-3 flex items-center justify-between text-sm">
                <span class="text-gray-500 dark:text-gray-400">
                  {{ badge.threshold_type === 'email_verified' ? 'Email verification' : `${badge.threshold_value} ${badge.threshold_type.replace('_', ' ')}` }}
                </span>
                <span class="font-medium text-blue-600 dark:text-blue-400">
                  {{ badge.award_count }} awarded
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Badge Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New Badge</h3>
          
          <form @submit.prevent="createBadge" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Badge Key</label>
              <input
                v-model="createForm.badge_key"
                type="text"
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="unique-badge-key"
                :class="{ 'border-red-500': createErrors.badge_key }"
              />
              <p v-if="createErrors.badge_key" class="mt-1 text-sm text-red-600">{{ createErrors.badge_key }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <input
                v-model="createForm.title"
                type="text"
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                :class="{ 'border-red-500': createErrors.title }"
              />
              <p v-if="createErrors.title" class="mt-1 text-sm text-red-600">{{ createErrors.title }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                v-model="createForm.description"
                rows="3"
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                :class="{ 'border-red-500': createErrors.description }"
              ></textarea>
              <p v-if="createErrors.description" class="mt-1 text-sm text-red-600">{{ createErrors.description }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Icon Emoji</label>
              <input
                v-model="createForm.icon_emoji"
                type="text"
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                :class="{ 'border-red-500': createErrors.icon_emoji }"
              />
              <p v-if="createErrors.icon_emoji" class="mt-1 text-sm text-red-600">{{ createErrors.icon_emoji }}</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                <input
                  v-model="createForm.category"
                  type="text"
                  class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
                <input
                  v-model.number="createForm.level"
                  type="number"
                  min="1"
                  class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  :class="{ 'border-red-500': createErrors.level }"
                />
                <p v-if="createErrors.level" class="mt-1 text-sm text-red-600">{{ createErrors.level }}</p>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Threshold Type</label>
              <select
                v-model="createForm.threshold_type"
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option v-for="type in thresholdTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>

            <div v-if="createForm.threshold_type !== 'email_verified'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Threshold Value</label>
              <input
                v-model.number="createForm.threshold_value"
                type="number"
                min="1"
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                :class="{ 'border-red-500': createErrors.threshold_value }"
              />
              <p v-if="createErrors.threshold_value" class="mt-1 text-sm text-red-600">{{ createErrors.threshold_value }}</p>
            </div>

            <div v-if="createErrors.general" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p class="text-sm text-red-700 dark:text-red-300">{{ createErrors.general }}</p>
            </div>

            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                @click="showCreateModal = false; resetCreateForm()"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Create Badge
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Edit Badge Modal -->
    <div v-if="showEditModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Edit Badge</h3>
          
          <form @submit.prevent="updateBadge" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <input
                v-model="editForm.title"
                type="text"
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                :class="{ 'border-red-500': editErrors.title }"
              />
              <p v-if="editErrors.title" class="mt-1 text-sm text-red-600">{{ editErrors.title }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                v-model="editForm.description"
                rows="3"
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                :class="{ 'border-red-500': editErrors.description }"
              ></textarea>
              <p v-if="editErrors.description" class="mt-1 text-sm text-red-600">{{ editErrors.description }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Icon Emoji</label>
              <input
                v-model="editForm.icon_emoji"
                type="text"
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
                <input
                  v-model.number="editForm.level"
                  type="number"
                  min="1"
                  class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  :class="{ 'border-red-500': editErrors.level }"
                />
                <p v-if="editErrors.level" class="mt-1 text-sm text-red-600">{{ editErrors.level }}</p>
              </div>

              <div>
                <label class="flex items-center space-x-2">
                  <input
                    v-model="editForm.is_active"
                    type="checkbox"
                    class="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
                </label>
              </div>
            </div>

            <div v-if="editErrors.general" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p class="text-sm text-red-700 dark:text-red-300">{{ editErrors.general }}</p>
            </div>

            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                @click="showEditModal = false; resetEditForm()"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Update Badge
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>