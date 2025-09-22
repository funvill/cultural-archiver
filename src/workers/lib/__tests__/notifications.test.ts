/**
 * Unit tests for NotificationService
 * Tests notification creation, retrieval, pagination, and management operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from '../notifications';
import type { CreateNotificationInput } from '../../../shared/types';

// Mock D1Database for testing
interface MockDBStatement {
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

interface MockDBResult {
  changes?: number;
  results?: unknown[];
}

const createMockDb = () => {
  const mockResults = new Map<string, any[]>();
  const mockFirst = new Map<string, any>();
  const mockRun = new Map<string, MockDBResult>();
  
  const mockDb = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...params: any[]) => ({
        all: vi.fn(async () => ({
          results: mockResults.get(sql) || [],
        })),
        first: vi.fn(async () => mockFirst.get(sql) || null),
        run: vi.fn(async () => mockRun.get(sql) || { success: true, changes: 1 }),
      })),
      all: vi.fn(async () => ({
        results: mockResults.get(sql) || [],
      })),
      first: vi.fn(async () => mockFirst.get(sql) || null),
      run: vi.fn(async () => mockRun.get(sql) || { success: true, changes: 1 }),
    })),
    exec: vi.fn(async () => ({ success: true })),
  };
  
  return { mockDb, mockResults, mockFirst, mockRun };
};

describe('NotificationService', () => {
  let mockDb: any;
  let notificationService: NotificationService;
  let mockResults: Map<string, any[]>;
  let mockFirst: Map<string, any>;
  let mockRun: Map<string, MockDBResult>;
  
  const testUserToken = '123e4567-e89b-12d3-a456-426614174000';
  const testUserToken2 = '123e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    const setup = createMockDb();
    mockDb = setup.mockDb;
    mockResults = setup.mockResults;
    mockFirst = setup.mockFirst;
    mockRun = setup.mockRun;
    notificationService = new NotificationService(mockDb);
  });

  describe('create', () => {
    it('should create a badge notification successfully', async () => {
      const input: CreateNotificationInput = {
        user_token: testUserToken,
        type: 'badge',
        type_key: 'first_submission',
        title: 'First Submission Badge',
        message: 'Congratulations on your first submission!',
        metadata: {
          badge_id: 'badge-123',
          badge_key: 'first_submission',
          award_reason: 'First artwork submission',
        },
        related_id: 'submission-456',
      };

      const result = await notificationService.create(input);

      expect(result).toMatchObject({
        user_token: testUserToken,
        type: 'badge',
        type_key: 'first_submission',
        title: 'First Submission Badge',
        message: 'Congratulations on your first submission!',
        is_dismissed: false,
        related_id: 'submission-456',
      });
      
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(result.metadata).toEqual({
        badge_id: 'badge-123',
        badge_key: 'first_submission',
        award_reason: 'First artwork submission',
      });
      expect(result.created_at).toBeTruthy();
    });

    it('should create a system notification with minimal data', async () => {
      const input: CreateNotificationInput = {
        user_token: testUserToken,
        type: 'system',
        title: 'System Maintenance',
      };

      const result = await notificationService.create(input);

      expect(result).toMatchObject({
        user_token: testUserToken,
        type: 'system',
        type_key: null,
        title: 'System Maintenance',
        message: null,
        metadata: null,
        is_dismissed: false,
        related_id: null,
      });
    });

    it('should validate input and reject invalid data', async () => {
      const invalidInput = {
        user_token: 'invalid-uuid',
        type: 'invalid_type',
        title: '',
      };

      await expect(
        notificationService.create(invalidInput as any)
      ).rejects.toThrow();
    });

    it('should reject title that is too long', async () => {
      const input: CreateNotificationInput = {
        user_token: testUserToken,
        type: 'badge',
        title: 'A'.repeat(201), // Too long
      };

      await expect(
        notificationService.create(input)
      ).rejects.toThrow();
    });
  });

  describe('listForUser', () => {
    beforeEach(() => {
      // Mock database responses for list query - exact string matching
      const listQuery = `
      SELECT * FROM notifications 
      WHERE user_token = ?
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
      
      const countQuery = `
      SELECT COUNT(*) as total FROM notifications WHERE user_token = ?
    `;

      // Setup mock results
      mockFirst.set(countQuery, { total: 2 });
      mockResults.set(listQuery, [
        {
          id: 'notification-1',
          user_token: testUserToken,
          type: 'system',
          type_key: null,
          title: 'System Update',
          message: 'System has been updated',
          metadata: null,
          created_at: '2023-12-02T10:00:00Z',
          is_dismissed: 0,
          related_id: null,
        },
        {
          id: 'notification-2',
          user_token: testUserToken,
          type: 'badge',
          type_key: 'first_badge',
          title: 'First Badge',
          message: 'Your first badge!',
          metadata: '{"badge_id": "badge-123"}',
          created_at: '2023-12-01T10:00:00Z',
          is_dismissed: 0,
          related_id: null,
        },
      ]);
    });

    it('should list notifications for specific user', async () => {
      const result = await notificationService.listForUser(testUserToken);

      expect(result.notifications).toHaveLength(2);
      expect(result.notifications.every(n => n.user_token === testUserToken)).toBe(true);
      expect(result.notifications[0].title).toBe('System Update'); 
      expect(result.notifications[1].title).toBe('First Badge');
      expect(result.notifications[1].metadata).toEqual({ badge_id: 'badge-123' });
    });

    it('should respect pagination parameters', async () => {
      // Update mock for pagination test - exact string
      const listQuery = `
      SELECT * FROM notifications 
      WHERE user_token = ?
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
      
      mockResults.set(listQuery, [
        {
          id: 'notification-1',
          user_token: testUserToken,
          type: 'system',
          title: 'System Update',
          message: 'System has been updated',
          metadata: null,
          created_at: '2023-12-02T10:00:00Z',
          is_dismissed: 0,
          related_id: null,
        },
      ]);

      const result = await notificationService.listForUser(testUserToken, {
        limit: 1,
        offset: 0,
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.current_page).toBe(1);
      expect(result.pagination.per_page).toBe(1);
      expect(result.pagination.total_pages).toBe(2);
      expect(result.pagination.has_next).toBe(true);
      expect(result.pagination.has_prev).toBe(false);
    });
  });

  describe('unreadCount', () => {
    it('should return correct unread count', async () => {
      const unreadQuery = `
      SELECT COUNT(*) as unread_count 
      FROM notifications 
      WHERE user_token = ? AND is_dismissed = 0
    `;
      
      mockFirst.set(unreadQuery, { unread_count: 3 });

      const result = await notificationService.unreadCount(testUserToken);
      expect(result.unread_count).toBe(3);
    });

    it('should return zero for user with no notifications', async () => {
      const unreadQuery = `
      SELECT COUNT(*) as unread_count 
      FROM notifications 
      WHERE user_token = ? AND is_dismissed = 0
    `;
      
      mockFirst.set(unreadQuery, { unread_count: 0 });

      const result = await notificationService.unreadCount(testUserToken);
      expect(result.unread_count).toBe(0);
    });
  });

  describe('dismiss', () => {
    it('should dismiss notification successfully', async () => {
      const notificationId = '123e4567-e89b-12d3-a456-426614174000';
      
      const updateQuery = `
      UPDATE notifications 
      SET is_dismissed = 1 
      WHERE id = ? AND user_token = ? AND is_dismissed = 0
    `;
      
      mockRun.set(updateQuery, { changes: 1 });

      const result = await notificationService.dismiss(notificationId, testUserToken);
      expect(result.success).toBe(true);
    });

    it('should be idempotent - dismissing already dismissed notification succeeds', async () => {
      const notificationId = '123e4567-e89b-12d3-a456-426614174000';
      
      const updateQuery = `
      UPDATE notifications 
      SET is_dismissed = 1 
      WHERE id = ? AND user_token = ? AND is_dismissed = 0
    `;
      
      const checkQuery = `
        SELECT id, is_dismissed FROM notifications 
        WHERE id = ? AND user_token = ?
      `;
      
      mockRun.set(updateQuery, { changes: 0 });
      mockFirst.set(checkQuery, { id: notificationId, is_dismissed: 1 });

      const result = await notificationService.dismiss(notificationId, testUserToken);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Notification already dismissed');
    });

    it('should reject dismissing notification that does not belong to user', async () => {
      const notificationId = '123e4567-e89b-12d3-a456-426614174000';
      
      const updateQuery = `
      UPDATE notifications 
      SET is_dismissed = 1 
      WHERE id = ? AND user_token = ? AND is_dismissed = 0
    `;
      
      const checkQuery = `
        SELECT id, is_dismissed FROM notifications 
        WHERE id = ? AND user_token = ?
      `;
      
      mockRun.set(updateQuery, { changes: 0 });
      mockFirst.set(checkQuery, null);

      await expect(
        notificationService.dismiss(notificationId, testUserToken)
      ).rejects.toThrow('Notification not found or access denied');
    });
  });

  describe('getById', () => {
    it('should retrieve notification by ID', async () => {
      const notificationId = '123e4567-e89b-12d3-a456-426614174000';
      
      const getQuery = `
      SELECT * FROM notifications 
      WHERE id = ? AND user_token = ?
    `;
      
      mockFirst.set(getQuery, {
        id: notificationId,
        user_token: testUserToken,
        type: 'badge',
        type_key: 'test_badge',
        title: 'Test Badge',
        message: 'Test message',
        metadata: '{"test": "data"}',
        created_at: '2023-12-01T10:00:00Z',
        is_dismissed: 0,
        related_id: null,
      });

      const result = await notificationService.getById(notificationId, testUserToken);
      
      expect(result).toMatchObject({
        id: notificationId,
        user_token: testUserToken,
        type: 'badge',
        title: 'Test Badge',
        is_dismissed: false,
      });
      expect(result?.metadata).toEqual({ test: 'data' });
    });

    it('should return null for non-existent notification', async () => {
      const fakeId = '999e4567-e89b-12d3-a456-426614174999';
      
      const getQuery = `
      SELECT * FROM notifications 
      WHERE id = ? AND user_token = ?
    `;
      
      mockFirst.set(getQuery, null);

      const result = await notificationService.getById(fakeId, testUserToken);
      expect(result).toBeNull();
    });
  });

  describe('createSystemNotification', () => {
    it('should create system notifications for multiple users', async () => {
      const results = await notificationService.createSystemNotification({
        title: 'System Maintenance',
        message: 'System will be down for maintenance',
        metadata: { maintenance_window: '2024-01-01T02:00:00Z' },
        user_tokens: [testUserToken, testUserToken2],
      });

      expect(results).toHaveLength(2);
      
      for (const result of results) {
        expect(result.type).toBe('system');
        expect(result.type_key).toBe('admin_broadcast');
        expect(result.title).toBe('System Maintenance');
        expect(result.metadata).toEqual({ maintenance_window: '2024-01-01T02:00:00Z' });
      }
    });
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      // Mock statistics queries - exact match
      mockFirst.set('SELECT COUNT(*) as total FROM notifications', { total: 5 });
      mockFirst.set('SELECT COUNT(*) as unread FROM notifications WHERE is_dismissed = 0', { unread: 3 });
      mockResults.set('SELECT type, COUNT(*) as count FROM notifications GROUP BY type', [
        { type: 'badge', count: 3 },
        { type: 'system', count: 2 },
      ]);
      mockFirst.set(
        `
      SELECT COUNT(*) as recent 
      FROM notifications 
      WHERE created_at >= datetime('now', '-7 days')
    `, 
        { recent: 4 }
      );
    });

    it('should return correct statistics', async () => {
      const stats = await notificationService.getStatistics();

      expect(stats.total_notifications).toBe(5);
      expect(stats.unread_notifications).toBe(3);
      expect(stats.notifications_by_type).toEqual({
        badge: 3,
        system: 2,
      });
      expect(stats.recent_notification_count).toBe(4);
    });
  });
});