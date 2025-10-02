/**
 * Tests for Badge System
 * Testing badge calculation logic, eligibility checks, and database operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadgeService, type BadgeCalculationContext } from '../badges.js';
import type { BadgeRecord /*, UserRecord */ } from '../../../shared/types.js';

// Mock D1Database for testing
const createMockDb = () => {
  const mockResults = new Map<string, any[]>();
  const mockFirst = new Map<string, any>();

  const mockDb = {
    prepare: vi.fn((sql: string) => ({
  bind: vi.fn((..._params: any[]) => ({
        all: vi.fn(async () => ({
          results: mockResults.get(sql) || [],
        })),
        first: vi.fn(async () => mockFirst.get(sql) || null),
        run: vi.fn(async () => ({ success: true })),
      })),
      all: vi.fn(async () => ({
        results: mockResults.get(sql) || [],
      })),
      first: vi.fn(async () => mockFirst.get(sql) || null),
      run: vi.fn(async () => ({ success: true })),
    })),
  };

  return { mockDb, mockResults, mockFirst };
};

describe('Badge System', () => {
  let mockDb: any;
  let badgeService: BadgeService;
  let mockResults: Map<string, any[]>;
  let mockFirst: Map<string, any>;

  beforeEach(() => {
    const setup = createMockDb();
    mockDb = setup.mockDb;
    mockResults = setup.mockResults;
    mockFirst = setup.mockFirst;
    badgeService = new BadgeService(mockDb as D1Database);
  });

  describe('Badge Definition Management', () => {
    it('should retrieve all active badges', async () => {
      // Mock badge definitions
      const mockBadges: BadgeRecord[] = [
        {
          id: 'badge-1',
          badge_key: 'email_verified',
          title: 'Email Verified',
          description: 'Completed email verification',
          icon_emoji: '✅',
          category: 'activity',
          threshold_type: 'email_verified',
          threshold_value: null,
          level: 1,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'badge-2',
          badge_key: 'submission_1',
          title: 'First Discovery',
          description: 'Made your first artwork submission',
          icon_emoji: '🎯',
          category: 'activity',
          threshold_type: 'submission_count',
          threshold_value: 1,
          level: 1,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockResults.set(
        `
      SELECT * FROM badges 
      WHERE is_active = TRUE 
      ORDER BY category, level, threshold_value ASC
    `,
        mockBadges
      );

      const badges = await badgeService.getAllBadges();

      expect(badges).toBeDefined();
      expect(badges.length).toBe(2);
      expect(badges[0].badge_key).toBe('email_verified');
      expect(badges[1].badge_key).toBe('submission_1');
    });
  });

  describe('Badge Eligibility Calculation', () => {
    it('should identify eligible badges based on context', async () => {
      // Mock empty existing badges
      mockResults.set(
        `
      SELECT badge_id FROM user_badges WHERE user_uuid = ?
    `,
        []
      );

      // Mock available badges
      const mockBadges: BadgeRecord[] = [
        {
          id: 'badge-1',
          badge_key: 'email_verified',
          title: 'Email Verified',
          description: 'Completed email verification',
          icon_emoji: '✅',
          category: 'activity',
          threshold_type: 'email_verified',
          threshold_value: null,
          level: 1,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockResults.set(
        `
      SELECT * FROM badges 
      WHERE is_active = TRUE 
      ORDER BY category, level, threshold_value ASC
    `,
        mockBadges
      );

      const context: BadgeCalculationContext = {
        user_uuid: 'test-user-123',
        is_email_verified: true,
      };

      const awardedBadges = await badgeService.calculateAndAwardBadges(context);

      expect(awardedBadges.length).toBe(1);
      expect(awardedBadges[0].badge_key).toBe('email_verified');
    });

    it('should not award duplicate badges', async () => {
      // Mock existing badge
      mockResults.set(
        `
      SELECT badge_id FROM user_badges WHERE user_uuid = ?
    `,
        [{ badge_id: 'badge-1' }]
      );

      // Mock available badges (same as what user already has)
      mockResults.set(
        `
      SELECT * FROM badges 
      WHERE is_active = TRUE 
      ORDER BY category, level, threshold_value ASC
    `,
        [
          {
            id: 'badge-1',
            badge_key: 'email_verified',
            title: 'Email Verified',
            description: 'Completed email verification',
            icon_emoji: '✅',
            category: 'activity',
            threshold_type: 'email_verified',
            threshold_value: null,
            level: 1,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ]
      );

      const context: BadgeCalculationContext = {
        user_uuid: 'test-user-123',
        is_email_verified: true,
      };

      const awardedBadges = await badgeService.calculateAndAwardBadges(context);

      expect(awardedBadges.length).toBe(0); // No new badges
    });
  });

  describe('Profile Name Management', () => {
    it('should check profile name availability', async () => {
      // Mock no existing user with that name
      mockFirst.set('SELECT uuid FROM users WHERE LOWER(profile_name) = LOWER(?)', null);

      const isAvailable = await badgeService.isProfileNameAvailable('testuser123');
      expect(isAvailable).toBe(true);

      // Mock existing user with that name
      mockFirst.set('SELECT uuid FROM users WHERE LOWER(profile_name) = LOWER(?)', {
        uuid: 'existing-user',
      });

      const isAvailableAfter = await badgeService.isProfileNameAvailable('testuser123');
      expect(isAvailableAfter).toBe(false);
    });

    it('should reject updating to taken profile name', async () => {
      // Mock existing user with that name
      mockFirst.set('SELECT uuid FROM users WHERE LOWER(profile_name) = LOWER(?) AND uuid != ?', {
        uuid: 'other-user',
      });

      await expect(badgeService.updateProfileName('test-user-123', 'takenname')).rejects.toThrow(
        'Profile name is already taken'
      );
    });
  });

  describe('Integration Points', () => {
    it('should check email verification badge', async () => {
      // Mock empty existing badges
      mockResults.set(
        `
      SELECT badge_id FROM user_badges WHERE user_uuid = ?
    `,
        []
      );

      // Mock email verification badge
      mockResults.set(
        `
      SELECT * FROM badges 
      WHERE is_active = TRUE 
      ORDER BY category, level, threshold_value ASC
    `,
        [
          {
            id: 'badge-1',
            badge_key: 'email_verified',
            title: 'Email Verified',
            description: 'Completed email verification',
            icon_emoji: '✅',
            category: 'activity',
            threshold_type: 'email_verified',
            threshold_value: null,
            level: 1,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ]
      );

      const awardedBadges = await badgeService.checkEmailVerificationBadge('test-user-123');

      expect(awardedBadges.length).toBe(1);
      expect(awardedBadges[0].badge_key).toBe('email_verified');
      expect(awardedBadges[0].award_reason).toBe('Email verification completed');
    });
  });
});
