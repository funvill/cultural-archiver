<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { adminService } from '../services/admin';
import PermissionManager from '../components/PermissionManager.vue';
import AuditLogViewer from '../components/AuditLogViewer.vue';
import BadgeManager from '../components/BadgeManager.vue';
import SocialMediaScheduler from '../components/SocialMediaScheduler.vue';
import type { AuditStatistics } from '../../../shared/types';

/**
 * Admin View Component
 *
 * Provides a comprehensive admin dashboard for managing user permissions
 * and viewing audit logs with responsive design and accessibility features.
 */

// Auth store
const authStore = useAuthStore();

// Reactive state
const statistics = ref<AuditStatistics | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const activeTab = ref('permissions');

// Tab configuration
const tabs = [
  { id: 'permissions', name: 'Permission Management' },
  { id: 'audit', name: 'Audit Logs' },
  { id: 'badges', name: 'Badge Management' },
  { id: 'social-media', name: 'Social Media' },
  // Data Dumps feature removed
];

// Check admin access
const hasAdminAccess = computed(() => authStore.isAdmin);

// Load initial data
async function loadData(): Promise<void> {
  if (!hasAdminAccess.value) {
    error.value = 'Access denied. Admin permissions required.';
    return;
  }

  try {
    isLoading.value = true;
    error.value = null;

    // Load statistics
    const stats = await adminService.getStatistics(30);
    statistics.value = stats;
  } catch (err) {
    console.error('Failed to load admin data:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load admin dashboard';
  } finally {
    isLoading.value = false;
  }
}

// Refresh all data
async function refreshData(): Promise<void> {
  await loadData();
}

// Initialize component
onMounted(async () => {
  await loadData();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <div class="bg-white dark:bg-gray-800 shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="py-6">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage user permissions and view system audit logs
              </p>
            </div>
            <div class="flex items-center space-x-4">
              <button
                @click="refreshData"
                :disabled="isLoading"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                :aria-label="isLoading ? 'Refreshing data...' : 'Refresh data'"
              >
                <svg
                  class="w-4 h-4 mr-2"
                  :class="{ 'animate-spin': isLoading }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {{ isLoading ? 'Refreshing...' : 'Refresh' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="isLoading && !statistics" class="text-center py-12">
        <div
          class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
        ></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Loading admin dashboard...</p>
      </div>

      <!-- Error State -->
      <div
        v-else-if="error"
        class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6"
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
            <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading admin dashboard
            </h3>
            <p class="mt-1 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
          </div>
        </div>
      </div>

      <!-- Dashboard Content -->
      <div v-else class="space-y-8">
        <!-- Statistics Overview -->
        <div v-if="statistics" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg
                    class="h-6 w-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Total Decisions
                    </dt>
                    <dd class="text-lg font-medium text-gray-900 dark:text-white">
                      {{ (statistics.total_decisions ?? 0).toLocaleString() }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg
                    class="h-6 w-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                    />
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Active Moderators
                    </dt>
                    <dd class="text-lg font-medium text-gray-900 dark:text-white">
                      {{ statistics.active_moderators }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg
                    class="h-6 w-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Active Admins
                    </dt>
                    <dd class="text-lg font-medium text-gray-900 dark:text-white">
                      {{ statistics.active_admins }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg
                    class="h-6 w-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Admin Actions
                    </dt>
                    <dd class="text-lg font-medium text-gray-900 dark:text-white">
                      {{ (statistics.total_admin_actions ?? 0).toLocaleString() }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="-mb-px flex space-x-8" aria-label="Admin sections">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
                'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              ]"
              v-bind="activeTab === tab.id ? { 'aria-current': 'page' } : {}"
            >
              {{ tab.name }}
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="mt-8">
          <!-- Permission Management Tab -->
          <div v-if="activeTab === 'permissions'" class="space-y-6">
            <PermissionManager @permission-changed="refreshData" />
          </div>

          <!-- Audit Logs Tab -->
          <div v-if="activeTab === 'audit'" class="space-y-6">
            <AuditLogViewer />
          </div>

          <!-- Badge Management Tab -->
          <div v-if="activeTab === 'badges'" class="space-y-6">
            <BadgeManager />
          </div>

          <!-- Social Media Scheduler Tab -->
          <div v-if="activeTab === 'social-media'" class="space-y-6">
            <SocialMediaScheduler />
          </div>

          <!-- Data Dumps Tab removed -->
        </div>
      </div>
    </div>
  </div>
</template>
