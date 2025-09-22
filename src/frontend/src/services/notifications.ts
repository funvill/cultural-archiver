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
import { api } from './api';

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
    const params = new URLSearchParams();
    
    if (options.limit !== undefined) {
      params.append('limit', options.limit.toString());
    }
    if (options.offset !== undefined) {
      params.append('offset', options.offset.toString());
    }
    if (options.unread_only !== undefined) {
      params.append('unread_only', options.unread_only.toString());
    }

    const queryString = params.toString();
    const url = `/api/me/notifications${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get<ApiResponse<NotificationListResponse>>(url);
    return response.data;
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(): Promise<NotificationUnreadCountResponse> {
    const response = await api.get<ApiResponse<NotificationUnreadCountResponse>>('/api/me/notifications/unread-count');
    return response.data;
  }

  /**
   * Dismiss/mark notification as read
   */
  static async dismissNotification(notificationId: string): Promise<NotificationActionResponse> {
    const response = await api.post<ApiResponse<NotificationActionResponse>>(`/api/me/notifications/${notificationId}/dismiss`);
    return response.data;
  }

  /**
   * Mark notification as read (alias for dismiss)
   */
  static async markNotificationRead(notificationId: string): Promise<NotificationActionResponse> {
    const response = await api.post<ApiResponse<NotificationActionResponse>>(`/api/me/notifications/${notificationId}/read`);
    return response.data;
  }
}