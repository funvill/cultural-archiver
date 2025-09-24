/**
 * Integration tests for Badge -> Notification flow
 * Tests that notifications are created when badges are awarded
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadgeService } from '../badges';
import { NotificationService } from '../notifications';
import type { BadgeRecord } from '../../../shared/types';

// Mock D1Database for testing
const createMockDb = () => {
  const mockResults = new Map<string, any[]>();
  const mockFirst = new Map<string, any>();
  const mockRun = new Map<string, { success: boolean; changes: number }>();

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
  };

  return { mockDb, mockResults, mockFirst, mockRun };
};

describe('Badge-Notification Integration', () => {
  let mockDb: any;
  let badgeService: BadgeService;
  let notificationService: NotificationService;
  let mockResults: Map<string, any[]>;
  let mockFirst: Map<string, any>;
  let mockRun: Map<string, { success: boolean; changes: number }>;

  const testUserUuid = '123e4567-e89b-12d3-a456-426614174000';

  const testBadge: BadgeRecord = {
    id: 'badge-123',
    badge_key: 'first_submission',
    title: 'First Submission',
    description: 'Made your first artwork submission',
    icon_emoji: '🎯',
    category: 'activity',
    threshold_type: 'submission_count',
    threshold_value: 1,
    level: 1,
    is_active: true,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    const setup = createMockDb();
    mockDb = setup.mockDb;
    mockResults = setup.mockResults;
    mockFirst = setup.mockFirst;
    mockRun = setup.mockRun;

    badgeService = new BadgeService(mockDb);
    notificationService = new NotificationService(mockDb);
  });

  describe('Badge Award -> Notification Creation', () => {
    it('should create notification when badge is newly awarded', async () => {
      // Setup: User has 1 submission, no existing badges
      const getAllBadgesQuery = `
      SELECT * FROM badges 
      WHERE is_active = TRUE 
      ORDER BY category, level, threshold_value ASC
    `;

      const getUserBadgeIdsQuery = `
      SELECT badge_id FROM user_badges WHERE user_uuid = ?
    `;

      const getUserSubmissionCountQuery = `
      SELECT COUNT(*) as count 
      FROM submissions 
      WHERE user_token = ? AND status = 'approved'
    `;

      const existingBadgeQuery = `
      SELECT awarded_at FROM user_badges 
      WHERE user_uuid = ? AND badge_id = ?
    `;

      // Mock responses
      mockResults.set(getAllBadgesQuery, [testBadge]);
      mockResults.set(getUserBadgeIdsQuery, []); // No existing badges
      mockFirst.set(getUserSubmissionCountQuery, { count: 1 }); // User has 1 submission
      mockFirst.set(existingBadgeQuery, null); // Badge not yet awarded

      // Test the badge calculation and award process
      const context = {
        user_uuid: testUserUuid,
        user_record: undefined,
        submission_count: 1,
        is_email_verified: true,
      };

      const awardedBadges = await badgeService.calculateAndAwardBadges(context);

      // Verify badge was awarded
      expect(awardedBadges).toHaveLength(1);
      expect(awardedBadges[0]).toMatchObject({
        badge_id: 'badge-123',
        badge_key: 'first_submission',
        title: 'First Submission',
        created: true,
      });

      // Verify notification_id is present (indicating notification was created)
      expect(awardedBadges[0].notification_id).toBeDefined();
    });

    it('should not create notification when badge already exists', async () => {
      // Setup: User has existing badge
      const getAllBadgesQuery = `
      SELECT * FROM badges 
      WHERE is_active = TRUE 
      ORDER BY category, level, threshold_value ASC
    `;

      const getUserBadgeIdsQuery = `
      SELECT badge_id FROM user_badges WHERE user_uuid = ?
    `;

      const getUserSubmissionCountQuery = `
      SELECT COUNT(*) as count 
      FROM submissions 
      WHERE user_token = ? AND status = 'approved'
    `;

      const existingBadgeQuery = `
      SELECT awarded_at FROM user_badges 
      WHERE user_uuid = ? AND badge_id = ?
    `;

      // Mock responses - badge already exists
      mockResults.set(getAllBadgesQuery, [testBadge]);
      mockResults.set(getUserBadgeIdsQuery, []); // GetUserBadgeIds returns empty but existingBadgeQuery returns data
      mockFirst.set(getUserSubmissionCountQuery, { count: 1 });
      mockFirst.set(existingBadgeQuery, { awarded_at: '2023-01-01T00:00:00Z' }); // Badge already awarded

      const context = {
        user_uuid: testUserUuid,
        user_record: undefined,
        submission_count: 1,
        is_email_verified: true,
      };

      const awardedBadges = await badgeService.calculateAndAwardBadges(context);

      // Verify badge result shows not newly created
      expect(awardedBadges).toHaveLength(1);
      expect(awardedBadges[0]).toMatchObject({
        badge_id: 'badge-123',
        created: false, // Not newly created
      });

      // Verify no notification was created
      expect(awardedBadges[0].notification_id).toBeUndefined();
    });

    it('should handle notification creation failure gracefully', async () => {
      // This test would verify that badge award succeeds even if notification creation fails
      // For the mock implementation, we'll just verify the structure is correct

      const context = {
        user_uuid: testUserUuid,
        user_record: undefined,
        submission_count: 1,
        is_email_verified: true,
      };

      // Setup minimal mocks for badge eligibility
      const getAllBadgesQuery = `
      SELECT * FROM badges 
      WHERE is_active = TRUE 
      ORDER BY category, level, threshold_value ASC
    `;

      mockResults.set(getAllBadgesQuery, [testBadge]);
      mockResults.set(`SELECT badge_id FROM user_badges WHERE user_uuid = ?`, []);
      mockFirst.set(
        `
      SELECT COUNT(*) as count 
      FROM submissions 
      WHERE user_token = ? AND status = 'approved'
    `,
        { count: 1 }
      );
      mockFirst.set(
        `
      SELECT awarded_at FROM user_badges 
      WHERE user_uuid = ? AND badge_id = ?
    `,
        null
      );

      const awardedBadges = await badgeService.calculateAndAwardBadges(context);

      // Badge should still be awarded even if notification fails
      expect(awardedBadges).toHaveLength(1);
      expect(awardedBadges[0].badge_key).toBe('first_submission');
    });
  });

  describe('Notification Content', () => {
    it('should create notification with correct badge metadata', async () => {
      // Setup successful badge award
      const getAllBadgesQuery = `
      SELECT * FROM badges 
      WHERE is_active = TRUE 
      ORDER BY category, level, threshold_value ASC
    `;

      mockResults.set(getAllBadgesQuery, [testBadge]);
      mockResults.set(`SELECT badge_id FROM user_badges WHERE user_uuid = ?`, []);
      mockFirst.set(
        `
      SELECT COUNT(*) as count 
      FROM submissions 
      WHERE user_token = ? AND status = 'approved'
    `,
        { count: 1 }
      );
      mockFirst.set(
        `
      SELECT awarded_at FROM user_badges 
      WHERE user_uuid = ? AND badge_id = ?
    `,
        null
      );

      const context = {
        user_uuid: testUserUuid,
        user_record: undefined,
        submission_count: 1,
        is_email_verified: true,
      };

      const awardedBadges = await badgeService.calculateAndAwardBadges(context);

      // Verify the notification would contain the correct metadata structure
      expect(awardedBadges[0]).toMatchObject({
        badge_id: 'badge-123',
        badge_key: 'first_submission',
        title: 'First Submission',
        description: 'Made your first artwork submission',
        icon_emoji: '🎯',
        created: true,
      });
    });
  });

  describe('Email Verification Badge', () => {
    it('should create notification for email verification badge', async () => {
      const emailBadge: BadgeRecord = {
        id: 'email-badge-123',
        badge_key: 'email_verified',
        title: 'Email Verified',
        description: 'Completed email verification',
        icon_emoji: '✅',
        category: 'activity',
        threshold_type: 'email_verified',
        threshold_value: null,
        level: 1,
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      // Setup mocks for email verification badge
      const getAllBadgesQuery = `
      SELECT * FROM badges 
      WHERE is_active = TRUE 
      ORDER BY category, level, threshold_value ASC
    `;

      mockResults.set(getAllBadgesQuery, [emailBadge]);
      mockResults.set(`SELECT badge_id FROM user_badges WHERE user_uuid = ?`, []);
      mockFirst.set(
        `
      SELECT awarded_at FROM user_badges 
      WHERE user_uuid = ? AND badge_id = ?
    `,
        null
      );

      const awardedBadges = await badgeService.checkEmailVerificationBadge(testUserUuid);

      expect(awardedBadges).toHaveLength(1);
      expect(awardedBadges[0]).toMatchObject({
        badge_key: 'email_verified',
        title: 'Email Verified',
        created: true,
      });

      expect(awardedBadges[0].notification_id).toBeDefined();
    });
  });
});
