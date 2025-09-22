/**
 * Notification API service
 * Handles notification-related API calls
 */

import type {
  NotificationListResponse,
  NotificationUnreadCountResponse,
  NotificationActionResponse,
  ApiResponse,
} from '../../../shared/types';
import { apiService } from './api';

export interface NotificationListOptions {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
}

export class NotificationService {
  /**
   * Get user notifications with pagination
   */
  static async getNotifications(options: NotificationListOptions = {}): Promise<NotificationListResponse> {
    const response = await apiService.getUserNotifications(options);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get notifications');
    }
    return response.data;
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(): Promise<NotificationUnreadCountResponse> {
    const response = await apiService.getNotificationUnreadCount();
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get unread count');
    }
    return response.data;
  }

  /**
   * Dismiss/mark notification as read
   */
  static async dismissNotification(notificationId: string): Promise<NotificationActionResponse> {
    const response = await apiService.dismissNotification(notificationId);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to dismiss notification');
    }
    return response.data;
  }

  /**
   * Mark notification as read (alias for dismiss)
   */
  static async markNotificationRead(notificationId: string): Promise<NotificationActionResponse> {
    const response = await apiService.markNotificationRead(notificationId);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to mark notification as read');
    }
    return response.data;
  }
}