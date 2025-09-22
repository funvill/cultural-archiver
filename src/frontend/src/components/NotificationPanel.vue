<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-96 max-h-96 overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        Notifications
      </h3>
      <div class="flex items-center space-x-2">
        <span
          v-if="unreadCount > 0"
          class="text-sm text-gray-500 dark:text-gray-400"
        >
          {{ unreadCount }} unread
        </span>
        <!-- New: Mark all as read in header for quick access -->
        <button
          v-if="unreadCount > 0"
          @click="markAllAsRead"
          class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium mr-2"
          aria-label="Mark all notifications as read"
        >
          Mark all as read
        </button>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Close notifications"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="max-h-80 overflow-y-auto">
      <!-- Loading state -->
      <div v-if="isLoading && notifications.length === 0" class="p-4">
        <div class="animate-pulse space-y-3">
          <div v-for="i in 3" :key="i" class="flex space-x-3">
            <div class="rounded-full bg-gray-300 dark:bg-gray-600 h-8 w-8"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              <div class="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="p-4 text-center">
        <div class="text-red-500 dark:text-red-400 mb-2">
          <svg class="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {{ error }}
        </p>
        <button
          @click="retryFetch"
          class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
        >
          Try again
        </button>
      </div>

      <!-- Empty state -->
      <div v-else-if="notifications.length === 0" class="p-6 text-center">
        <div class="text-gray-400 dark:text-gray-500 mb-2">
          <svg class="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path
              d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"
            />
          </svg>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          No notifications yet
        </p>
      </div>

      <!-- Notifications list -->
      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="notification in displayedNotifications"
          :key="notification.id"
          :class="[
            'p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer',
            { 'bg-blue-50 dark:bg-blue-900/20': !notification.is_dismissed }
          ]"
          @click="handleNotificationClick(notification)"
        >
          <div class="flex items-start space-x-3">
            <!-- Icon based on notification type -->
            <div class="flex-shrink-0 mt-1">
              <div
                v-if="notification.type === 'badge'"
                class="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center"
              >
                <span class="text-lg">
                  {{ getBadgeEmoji(notification) }}
                </span>
              </div>
              <div
                v-else-if="notification.type === 'system'"
                class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center"
              >
                <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div
                v-else
                class="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center"
              >
                <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"
                  />
                </svg>
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ notification.title }}
                  </p>
                  <p
                    v-if="notification.message"
                    class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2"
                  >
                    {{ notification.message }}
                  </p>
                </div>
                <div class="flex items-center space-x-2 ml-3">
                  <!-- Unread indicator -->
                  <div
                    v-if="!notification.is_dismissed"
                    class="w-2 h-2 bg-blue-500 rounded-full"
                    aria-label="Unread"
                  ></div>
                  <!-- Dismiss button -->
                  <button
                    @click.stop="dismissNotification(notification.id)"
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    :aria-label="`Dismiss ${notification.title}`"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {{ formatTimestamp(notification.created_at) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div
      v-if="notifications.length > 0"
      class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
    >
      <div class="flex items-center justify-between">
        <button
          v-if="unreadCount > 0"
          @click="markAllAsRead"
          class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
        >
          Mark all as read
        </button>
        <router-link
          to="/profile/notifications"
          class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium ml-auto"
          @click="$emit('close')"
        >
          View all
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useNotificationsStore } from '../stores/notifications';
import type { NotificationResponse } from '../../../shared/types';
import { isBadgeNotificationMetadata } from '../../../shared/types';

// Emits
const emit = defineEmits<{
  close: [];
  notificationAction: [{ type: string; notificationId: string }];
}>();

// Store
const notificationsStore = useNotificationsStore();

// Computed
const notifications = computed(() => notificationsStore.recentNotifications);
const unreadCount = computed(() => notificationsStore.unreadCount);
const isLoading = computed(() => notificationsStore.isLoading);
const error = computed(() => notificationsStore.error);

// Show up to 10 notifications in the panel, sort unread first then newest
const displayedNotifications = computed(() => {
  const sorted = [...notifications.value].sort((a, b) => {
    // Unread (not dismissed) first
    if ((a.is_dismissed ? 1 : 0) !== (b.is_dismissed ? 1 : 0)) {
      return (a.is_dismissed ? 1 : 0) - (b.is_dismissed ? 1 : 0);
    }
    // Then by created_at desc (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return sorted.slice(0, 10);
});

// Methods
function handleNotificationClick(notification: NotificationResponse) {
  emit('notificationAction', { type: 'click', notificationId: notification.id });
  
  // Mark as read if unread
  if (!notification.is_dismissed) {
    notificationsStore.markNotificationRead(notification.id).catch(console.error);
  }
}

async function dismissNotification(notificationId: string) {
  try {
    await notificationsStore.dismissNotification(notificationId);
  } catch (error) {
    console.error('Failed to dismiss notification:', error);
  }
}

async function markAllAsRead() {
  try {
    await notificationsStore.markAllRead();
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
  }
}

function retryFetch() {
  notificationsStore.clearError();
  notificationsStore.fetchNotifications({ limit: 10 }).catch(console.error);
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
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}
</style>