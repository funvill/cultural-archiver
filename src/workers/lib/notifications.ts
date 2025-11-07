/**
 * Notification Service
 *
 * Handles notification creation, retrieval, and management for the generic notification system.
 * Supports badge notifications, admin messages, review updates, and system notifications.
 *
 * Features:
 * - Create notifications with structured metadata
 * - List user notifications with pagination
 * - Get unread notification count
 * - Mark notifications as dismissed/read
 * - Type-safe validation with Zod schemas
 */

import { z } from 'zod';
import { generateUUID, isValidUUID } from '../../shared/utils/uuid.js';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  NotificationRecord,
  NotificationResponse,
  CreateNotificationInput,
  NotificationListResponse,
  NotificationUnreadCountResponse,
  NotificationActionResponse,
} from '../../shared/types.js';

// Zod validation schemas
const NotificationTypeSchema = z.enum(['badge', 'admin_message', 'review', 'system']);

// Custom user token validator that accepts both UUIDs and Clerk user IDs
const UserTokenSchema = z.string().refine((val) => isValidUUID(val), {
  message: 'Invalid user token format (must be UUID or Clerk user ID)',
});

const CreateNotificationSchema = z.object({
  user_token: UserTokenSchema,
  type: NotificationTypeSchema,
  type_key: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  message: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
  related_id: z.string().optional(), // Remove UUID validation to be more flexible
});

const ListNotificationsOptionsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  unread_only: z.boolean().default(false),
});

const NotificationIdSchema = z.string().uuid('Invalid notification ID format');

export interface ListNotificationsOptions {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
}

export class NotificationService {
  constructor(public db: D1Database) {}

  /**
   * Create a new notification
   */
  async create(input: CreateNotificationInput): Promise<NotificationResponse> {
    // Validate input
    const validated = CreateNotificationSchema.parse(input);

    const id = generateUUID();
    const created_at = new Date().toISOString();
    const metadata_json = validated.metadata ? JSON.stringify(validated.metadata) : null;

    const stmt = this.db.prepare(`
      INSERT INTO notifications (
        id, user_token, type, type_key, title, message, 
        metadata, created_at, is_dismissed, related_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);

    await stmt
      .bind(
        id,
        validated.user_token,
        validated.type,
        validated.type_key ?? null,
        validated.title,
        validated.message ?? null,
        metadata_json,
        created_at,
        validated.related_id ?? null
      )
      .run();

    // Return the created notification
    return {
      id,
      user_token: validated.user_token,
      type: validated.type,
      type_key: validated.type_key || null,
      title: validated.title,
      message: validated.message || null,
      metadata: validated.metadata || null,
      created_at,
      is_dismissed: false,
      related_id: validated.related_id || null,
    };
  }

  /**
   * List notifications for a user with pagination
   */
  async listForUser(
    user_token: string,
    options: ListNotificationsOptions = {}
  ): Promise<NotificationListResponse> {
    // Validate user token
    UserTokenSchema.parse(user_token);

    // Validate and set defaults for options
    const validated = ListNotificationsOptionsSchema.parse(options);

    // Build query with optional unread filter
    let whereClause = 'WHERE user_token = ?';
    const queryParams: Array<string | number | null> = [user_token];

    if (validated.unread_only) {
      whereClause += ' AND is_dismissed = 0';
    }

    // Get total count for pagination
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM notifications ${whereClause}
    `);
    const countResult = await countStmt.bind(...queryParams).first<{ total: number }>();
    const total = countResult?.total || 0;

    // Get notifications with pagination
    const stmt = this.db.prepare(`
      SELECT * FROM notifications 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);

    const result = await stmt
      .bind(...queryParams, validated.limit, validated.offset)
      .all<NotificationRecord>();

    // Convert records to API response format
    const notifications: NotificationResponse[] = result.results.map(record => ({
      id: record.id,
      user_token: record.user_token,
      type: record.type,
      type_key: record.type_key,
      title: record.title,
      message: record.message,
      metadata: record.metadata ? this.safeJsonParse(record.metadata) : null,
      created_at: record.created_at,
      is_dismissed: record.is_dismissed === 1,
      related_id: record.related_id,
    }));

    // Calculate pagination info
    const total_pages = Math.ceil(total / validated.limit);
    const current_page = Math.floor(validated.offset / validated.limit) + 1;

    return {
      notifications,
      pagination: {
        total,
        current_page,
        per_page: validated.limit,
        total_pages,
        has_next: validated.offset + validated.limit < total,
        has_prev: validated.offset > 0,
      },
    };
  }

  /**
   * Get unread notification count for a user
   */
  async unreadCount(user_token: string): Promise<NotificationUnreadCountResponse> {
    // Validate user token
    UserTokenSchema.parse(user_token);

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as unread_count 
      FROM notifications 
      WHERE user_token = ? AND is_dismissed = 0
    `);

    const result = await stmt.bind(user_token).first<{ unread_count: number }>();

    return {
      unread_count: result?.unread_count || 0,
    };
  }

  /**
   * Mark a notification as dismissed/read
   */
  async dismiss(notification_id: string, user_token: string): Promise<NotificationActionResponse> {
    // Validate inputs
    NotificationIdSchema.parse(notification_id);
    UserTokenSchema.parse(user_token);

    // Verify the notification belongs to the user and update it
    const stmt = this.db.prepare(`
      UPDATE notifications 
      SET is_dismissed = 1 
      WHERE id = ? AND user_token = ? AND is_dismissed = 0
    `);

    const result = await stmt.bind(notification_id, user_token).run();

    // Access run() result changes safely — different D1 typings expose this differently
    const runResult = result as unknown as { changes?: number; meta?: { changes?: number } };
    const changes = runResult.changes ?? runResult.meta?.changes;

    if ((changes ?? 0) === 0) {
      // Either notification doesn't exist, doesn't belong to user, or already dismissed
      const checkStmt = this.db.prepare(`
        SELECT id, is_dismissed FROM notifications 
        WHERE id = ? AND user_token = ?
      `);
      const notification = await checkStmt.bind(notification_id, user_token).first();

      if (!notification) {
        throw new Error('Notification not found or access denied');
      }

      // Already dismissed - return success for idempotency
      return { success: true, message: 'Notification already dismissed' };
    }

    return { success: true };
  }

  /**
   * Mark a notification as read (alias for dismiss for API compatibility)
   */
  async markRead(notification_id: string, user_token: string): Promise<NotificationActionResponse> {
    return this.dismiss(notification_id, user_token);
  }

  /**
   * Get a specific notification (for verification/testing)
   */
  async getById(notification_id: string, user_token: string): Promise<NotificationResponse | null> {
    // Validate inputs
    NotificationIdSchema.parse(notification_id);
    UserTokenSchema.parse(user_token);

    const stmt = this.db.prepare(`
      SELECT * FROM notifications 
      WHERE id = ? AND user_token = ?
    `);

    const record = await stmt.bind(notification_id, user_token).first<NotificationRecord>();

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      user_token: record.user_token,
      type: record.type,
      type_key: record.type_key,
      title: record.title,
      message: record.message,
      metadata: record.metadata ? this.safeJsonParse(record.metadata) : null,
      created_at: record.created_at,
      is_dismissed: record.is_dismissed === 1,
      related_id: record.related_id,
    };
  }

  /**
   * ADMIN: Create system notification for all users or specific user list
   * Note: For MVP, this is simplified to single user creation
   */
  async createSystemNotification(input: {
    title: string;
    message?: string;
    metadata?: Record<string, unknown>;
    user_tokens: string[]; // For MVP, admin must specify target users
  }): Promise<NotificationResponse[]> {
    const results: NotificationResponse[] = [];

    for (const user_token of input.user_tokens) {
      // Build the CreateNotificationInput object and only add optional props when defined
      const createInputPartial: Partial<CreateNotificationInput> = {
        user_token,
        type: 'system',
        type_key: 'admin_broadcast',
        title: input.title,
      };

      if (input.message !== undefined) {
        createInputPartial.message = input.message;
      }
      if (input.metadata !== undefined) {
        createInputPartial.metadata = input.metadata;
      }

      const notification = await this.create(createInputPartial as CreateNotificationInput);
      results.push(notification);
    }

    return results;
  }

  /**
   * ADMIN: Get notification statistics
   */
  async getStatistics(): Promise<{
    total_notifications: number;
    unread_notifications: number;
    notifications_by_type: Record<string, number>;
    recent_notification_count: number; // Last 7 days
  }> {
    // Total notifications
    const totalStmt = this.db.prepare('SELECT COUNT(*) as total FROM notifications');
    const totalResult = await totalStmt.first<{ total: number }>();

    // Unread notifications
    const unreadStmt = this.db.prepare(
      'SELECT COUNT(*) as unread FROM notifications WHERE is_dismissed = 0'
    );
    const unreadResult = await unreadStmt.first<{ unread: number }>();

    // Notifications by type
    const typeStmt = this.db.prepare(
      'SELECT type, COUNT(*) as count FROM notifications GROUP BY type'
    );
    const typeResults = await typeStmt.all<{ type: string; count: number }>();
    const notifications_by_type: Record<string, number> = {};
    typeResults.results.forEach(row => {
      notifications_by_type[row.type] = row.count;
    });

    // Recent notifications (last 7 days)
    const recentStmt = this.db.prepare(`
      SELECT COUNT(*) as recent 
      FROM notifications 
      WHERE created_at >= datetime('now', '-7 days')
    `);
    const recentResult = await recentStmt.first<{ recent: number }>();

    return {
      total_notifications: totalResult?.total || 0,
      unread_notifications: unreadResult?.unread || 0,
      notifications_by_type,
      recent_notification_count: recentResult?.recent || 0,
    };
  }

  /**
   * Helper: Safe JSON parsing with fallback
   */
  private safeJsonParse(jsonString: string): Record<string, unknown> | null {
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }
}
