<template>
  <div class="profile-notifications-view p-4 sm:p-6 lg:p-8">
    <!-- Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Notifications
      </h1>
      <p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
        View and manage your notification history
      </p>
    </header>

    <!-- Controls -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center space-x-4">
        <button
          @click="filterType = 'all'"
          :class="[
            'px-3 py-2 rounded-md text-sm font-medium transition-colors',
            filterType === 'all'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          ]"
        >
          All ({{ totalCount }})
        </button>
        <button
          @click="filterType = 'unread'"
          :class="[
            'px-3 py-2 rounded-md text-sm font-medium transition-colors',
            filterType === 'unread'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          ]"
        >
          Unread ({{ unreadCount }})
        </button>
        <button
          @click="filterType = 'badge'"
          :class="[
            'px-3 py-2 rounded-md text-sm font-medium transition-colors',
            filterType === 'badge'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          ]"
        >
          Badges
        </button>
      </div>

      <div class="flex items-center space-x-2">
        <button
          v-if="unreadCount > 0"
          @click="markAllAsRead"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          :disabled="isMarkingAllRead"
        >
          <span v-if="isMarkingAllRead" class="inline-flex items-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Marking...
          </span>
          <span v-else>Mark all as read</span>
        </button>
        <button
          @click="refreshNotifications"
          class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          :disabled="isLoading"
          aria-label="Refresh notifications"
        >
          <svg 
            :class="['w-5 h-5', { 'animate-spin': isLoading }]" 
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
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && notifications.length === 0" class="space-y-4">
      <div v-for="i in 5" :key="i" class="animate-pulse">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow border border-gray-200 dark:border-gray-700">
          <div class="flex items-start space-x-4">
            <div class="rounded-full bg-gray-300 dark:bg-gray-600 h-12 w-12"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              <div class="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              <div class="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
      <div class="flex">
        <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
            Error loading notifications
          </h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">
            {{ error }}
          </p>
          <div class="mt-4">
            <button
              @click="refreshNotifications"
              class="text-sm bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-3 py-2 rounded-md hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredNotifications.length === 0 && !isLoading" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
        {{ filterType === 'unread' ? 'No unread notifications' : 'No notifications yet' }}
      </h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ filterType === 'unread' 
          ? 'All caught up! Check back later for new notifications.' 
          : 'When you earn badges or receive updates, they\'ll appear here.' 
        }}
      </p>
    </div>

    <!-- Notifications List -->
    <div v-else class="space-y-4">
      <div
        v-for="notification in paginatedNotifications"
        :key="notification.id"
        :class="[
          'bg-white dark:bg-gray-800 rounded-lg p-6 shadow border transition-colors cursor-pointer',
          notification.is_dismissed 
            ? 'border-gray-200 dark:border-gray-700' 
            : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
        ]"
        @click="handleNotificationClick(notification)"
      >
        <div class="flex items-start space-x-4">
          <!-- Icon -->
          <div class="flex-shrink-0">
            <div
              v-if="notification.type === 'badge'"
              class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center"
            >
              <span class="text-2xl">
                {{ getBadgeEmoji(notification) }}
              </span>
            </div>
            <div
              v-else-if="notification.type === 'system'"
              class="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center"
            >
              <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
            </div>
            <div
              v-else
              class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center"
            >
              <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ notification.title }}
                </h3>
                <p v-if="notification.message" class="text-gray-600 dark:text-gray-400 mt-1">
                  {{ notification.message }}
                </p>
                <div class="flex items-center space-x-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                  <span>{{ formatTimestamp(notification.created_at) }}</span>
                  <span v-if="notification.type === 'badge'" class="flex items-center">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    Badge earned
                  </span>
                </div>
              </div>
              <div class="flex items-center space-x-2 ml-4">
                <!-- Unread indicator -->
                <div
                  v-if="!notification.is_dismissed"
                  class="w-3 h-3 bg-blue-500 rounded-full"
                  aria-label="Unread"
                ></div>
                <!-- Dismiss button -->
                <button
                  @click.stop="dismissNotification(notification.id)"
                  class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  :aria-label="`Dismiss ${notification.title}`"
                >
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="mt-8 flex items-center justify-between">
      <div class="text-sm text-gray-700 dark:text-gray-300">
        Showing {{ startIndex + 1 }} to {{ Math.min(startIndex + itemsPerPage, totalCount) }} of {{ totalCount }} notifications
      </div>
      <div class="flex items-center space-x-2">
        <button
          @click="previousPage"
          :disabled="currentPage === 1"
          class="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span class="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useNotificationsStore } from '../stores/notifications';
import type { NotificationResponse } from '../../../shared/types';
import { isBadgeNotificationMetadata } from '../../../shared/types';

// Store
const notificationsStore = useNotificationsStore();

// Local state
const filterType = ref<'all' | 'unread' | 'badge'>('all');
const currentPage = ref(1);
const itemsPerPage = 20;
const isMarkingAllRead = ref(false);

// Computed
const notifications = computed(() => notificationsStore.notifications);
const unreadCount = computed(() => notificationsStore.unreadCount);
const isLoading = computed(() => notificationsStore.isLoading);
const error = computed(() => notificationsStore.error);

const filteredNotifications = computed(() => {
  let filtered = notifications.value as NotificationResponse[];
  
  switch (filterType.value) {
    case 'unread':
      filtered = filtered.filter((n: NotificationResponse) => !n.is_dismissed);
      break;
    case 'badge':
      filtered = filtered.filter((n: NotificationResponse) => n.type === 'badge');
      break;
    default:
      // 'all' - no filtering
      break;
  }
  
  return filtered;
});

const totalCount = computed(() => filteredNotifications.value.length);
const totalPages = computed(() => Math.ceil(totalCount.value / itemsPerPage));
const startIndex = computed(() => (currentPage.value - 1) * itemsPerPage);
const endIndex = computed(() => Math.min(startIndex.value + itemsPerPage, totalCount.value));

const paginatedNotifications = computed(() => 
  filteredNotifications.value.slice(startIndex.value, endIndex.value)
);

// Methods
async function refreshNotifications() {
  try {
    await notificationsStore.fetchNotifications({ limit: 100, offset: 0 });
    await notificationsStore.fetchUnreadCount();
  } catch (err) {
    console.error('Failed to refresh notifications:', err);
  }
}

async function markAllAsRead() {
  isMarkingAllRead.value = true;
  
  try {
    const unreadNotifications = filteredNotifications.value.filter((n: NotificationResponse) => !n.is_dismissed);
    const promises = unreadNotifications.map((n: NotificationResponse) => 
      notificationsStore.markNotificationRead(n.id)
    );
    
    await Promise.all(promises);
  } catch (err) {
    console.error('Failed to mark all as read:', err);
  } finally {
    isMarkingAllRead.value = false;
  }
}

async function dismissNotification(notificationId: string) {
  try {
    await notificationsStore.dismissNotification(notificationId);
  } catch (err) {
    console.error('Failed to dismiss notification:', err);
  }
}

function handleNotificationClick(notification: NotificationResponse) {
  // Mark as read if unread
  if (!notification.is_dismissed) {
    notificationsStore.markNotificationRead(notification.id).catch(console.error);
  }

  // Handle navigation based on notification type
  if (notification.type === 'badge') {
    // Could navigate to badge details or profile badges
    console.log('Badge notification clicked:', notification);
  }
}

function getBadgeEmoji(notification: NotificationResponse): string {
  if (notification.type === 'badge' && notification.metadata && isBadgeNotificationMetadata(notification.metadata)) {
    return notification.metadata.badge_icon_emoji || '🏆';
  }
  return '🏆';
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
}

// Lifecycle
onMounted(() => {
  notificationsStore.startPolling();
  refreshNotifications();
});

onUnmounted(() => {
  notificationsStore.stopPolling();
});

// Reset pagination when filter changes
function resetPagination() {
  currentPage.value = 1;
}

// Watch filter changes (reset pagination when filter changes)
// We don't need an unused watcher reference here; simply react to the value where it's used
watch(filterType, () => resetPagination());
</script>

<style scoped>
/* Additional styles if needed */
</style>