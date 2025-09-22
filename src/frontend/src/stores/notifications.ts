/**
 * Notifications store
 * Manages notification state, polling, and API interactions
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { NotificationResponse } from '../../../shared/types';
import { NotificationService } from '../services/notifications';

export const useNotificationsStore = defineStore('notifications', () => {
  // State
  const notifications = ref<NotificationResponse[]>([]);
  const unreadCount = ref(0);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const pollInterval = ref<number | null>(null);
  const lastFetchTime = ref<Date | null>(null);

  // Configuration
  const POLL_INTERVAL_MS = 60000; // 1 minute
  const MAX_NOTIFICATIONS_CACHE = 50; // Keep last 50 notifications in memory

  // Computed
  const unreadNotifications = computed(() => 
    notifications.value.filter(n => !n.is_dismissed)
  );

  const hasUnreadNotifications = computed(() => unreadCount.value > 0);

  const recentNotifications = computed(() => 
    notifications.value.slice(0, 10) // Show last 10 for quick access
  );

  // Actions
  async function fetchNotifications(options: { 
    limit?: number; 
    offset?: number; 
    unread_only?: boolean;
    append?: boolean;
  } = {}) {
    if (isLoading.value && !options.append) return;
    
    isLoading.value = true;
    error.value = null;

    try {
      const result = await NotificationService.getNotifications({
        limit: options.limit || 20,
        offset: options.offset || 0,
        unread_only: options.unread_only || false,
      });

      if (options.append) {
        // Append for pagination
        notifications.value.push(...result.notifications);
      } else {
        // Replace for refresh
        notifications.value = result.notifications;
      }

      // Trim cache if too large
      if (notifications.value.length > MAX_NOTIFICATIONS_CACHE) {
        notifications.value = notifications.value.slice(0, MAX_NOTIFICATIONS_CACHE);
      }

      lastFetchTime.value = new Date();
      
      return result;
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      error.value = err instanceof Error ? err.message : 'Failed to fetch notifications';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchUnreadCount() {
    try {
      const result = await NotificationService.getUnreadCount();
      unreadCount.value = result.unread_count;
      return result;
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
      // Don't set error for unread count failures (non-critical)
      throw err;
    }
  }

  async function dismissNotification(notificationId: string) {
    try {
      await NotificationService.dismissNotification(notificationId);
      
      // Update local state
      const notification = notifications.value.find(n => n.id === notificationId);
      if (notification && !notification.is_dismissed) {
        notification.is_dismissed = true;
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }

      return { success: true };
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
      error.value = err instanceof Error ? err.message : 'Failed to dismiss notification';
      throw err;
    }
  }

  async function markNotificationRead(notificationId: string) {
    try {
      await NotificationService.markNotificationRead(notificationId);
      
      // Update local state
      const notification = notifications.value.find(n => n.id === notificationId);
      if (notification && !notification.is_dismissed) {
        notification.is_dismissed = true;
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }

      return { success: true };
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      error.value = err instanceof Error ? err.message : 'Failed to mark notification as read';
      throw err;
    }
  }

  /**
   * Mark all notifications in memory as read (calls backend per-notification).
   * This is a best-effort implementation since backend doesn't expose a bulk endpoint.
   */
  async function markAllRead() {
    const unread = notifications.value.filter(n => !n.is_dismissed).map(n => n.id);
    if (unread.length === 0) return { success: true };

    const promises = unread.map(id => markNotificationRead(id).catch(err => {
      console.error('Failed to mark notification read in bulk operation for id', id, err);
    }));

    await Promise.all(promises);
    return { success: true };
  }

  function addNotification(notification: NotificationResponse) {
    // Add new notification to the beginning of the list
    notifications.value.unshift(notification);
    
    if (!notification.is_dismissed) {
      unreadCount.value++;
    }

    // Trim cache
    if (notifications.value.length > MAX_NOTIFICATIONS_CACHE) {
      notifications.value = notifications.value.slice(0, MAX_NOTIFICATIONS_CACHE);
    }
  }

  function startPolling() {
    if (pollInterval.value) return; // Already polling

    // Initial fetch
    fetchUnreadCount().catch(() => {
      // Silent failure for initial polling
    });

    // Set up polling interval
    pollInterval.value = window.setInterval(() => {
      fetchUnreadCount().catch(() => {
        // Silent failure for polling
      });
    }, POLL_INTERVAL_MS);

    console.log('Started notification polling (interval:', POLL_INTERVAL_MS, 'ms)');
  }

  function stopPolling() {
    if (pollInterval.value) {
      clearInterval(pollInterval.value);
      pollInterval.value = null;
      console.log('Stopped notification polling');
    }
  }

  function clearError() {
    error.value = null;
  }

  function resetState() {
    notifications.value = [];
    unreadCount.value = 0;
    isLoading.value = false;
    error.value = null;
    lastFetchTime.value = null;
    stopPolling();
  }

  // Auto-cleanup on window unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', stopPolling);
  }

  return {
    // State
    notifications,
    unreadCount,
    isLoading,
    error,
    lastFetchTime,

    // Computed
    unreadNotifications,
    hasUnreadNotifications,
    recentNotifications,

    // Actions
    fetchNotifications,
    fetchUnreadCount,
    dismissNotification,
    markNotificationRead,
  markAllRead,
    addNotification,
    startPolling,
    stopPolling,
    clearError,
    resetState,
  };
});