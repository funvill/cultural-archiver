/**
 * Badge Calculation and Award Engine
 * 
 * Handles real-time badge eligibility checking and awarding for the badge system.
 * MVP focus: Activity badges only (submission count, photo count, email verification, account age)
 */

import { generateUUID } from '../../shared/constants.js';
import type {
  BadgeRecord,
  UserBadgeRecord,
  UserRecord,
} from '../../shared/types.js';
import { ValidationApiError } from './errors.js';

export interface BadgeCalculationContext {
  user_uuid: string;
  user_record?: UserRecord;
  submission_count?: number;
  photo_count?: number;
  account_age_days?: number;
  is_email_verified?: boolean;
}

export interface BadgeAwardResult {
  badge_id: string;
  badge_key: string;
  title: string;
  description: string;
  icon_emoji: string;
  award_reason: string;
  awarded_at: string;
}

export class BadgeService {
  constructor(public db: D1Database) {}

  /**
   * Get all active badge definitions
   */
  async getAllBadges(): Promise<BadgeRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM badges 
      WHERE is_active = TRUE 
      ORDER BY category, level, threshold_value ASC
    `);
    
    const result = await stmt.all<BadgeRecord>();
    return result.results;
  }

  /**
   * Get badges earned by a specific user
   */
  async getUserBadges(user_uuid: string): Promise<Array<{
    badge: BadgeRecord;
    awarded_at: string;
    award_reason: string;
    metadata?: Record<string, unknown>;
  }>> {
    const stmt = this.db.prepare(`
      SELECT 
        ub.awarded_at,
        ub.award_reason,
        ub.metadata,
        b.*
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_uuid = ? AND b.is_active = TRUE
      ORDER BY ub.awarded_at DESC
    `);
    
    const result = await stmt.bind(user_uuid).all();
    
    return result.results.map((row: any) => ({
      badge: {
        id: row.id,
        badge_key: row.badge_key,
        title: row.title,
        description: row.description,
        icon_emoji: row.icon_emoji,
        category: row.category,
        threshold_type: row.threshold_type,
        threshold_value: row.threshold_value,
        level: row.level,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      awarded_at: row.awarded_at,
      award_reason: row.award_reason,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Calculate and award eligible badges for a user
   * Returns newly awarded badges
   */
  async calculateAndAwardBadges(context: BadgeCalculationContext): Promise<BadgeAwardResult[]> {
    // Get user's current badges to avoid duplicates
    const existingBadgeIds = await this.getUserBadgeIds(context.user_uuid);
    
    // Get all active badges
    const allBadges = await this.getAllBadges();
    
    // Calculate eligibility for each badge
    const eligibleBadges: Array<{ badge: BadgeRecord; reason: string }> = [];
    
    for (const badge of allBadges) {
      // Skip if user already has this badge
      if (existingBadgeIds.has(badge.id)) {
        continue;
      }
      
      const isEligible = await this.checkBadgeEligibility(badge, context);
      if (isEligible) {
        const reason = this.getBadgeAwardReason(badge, context);
        eligibleBadges.push({ badge, reason });
      }
    }
    
    // Award eligible badges
    const awardedBadges: BadgeAwardResult[] = [];
    for (const { badge, reason } of eligibleBadges) {
      try {
        const awardResult = await this.awardBadge(context.user_uuid, badge.id, reason);
        awardedBadges.push({
          badge_id: badge.id,
          badge_key: badge.badge_key,
          title: badge.title,
          description: badge.description,
          icon_emoji: badge.icon_emoji,
          award_reason: reason,
          awarded_at: awardResult.awarded_at,
        });
      } catch (error) {
        // Log error but continue with other badges
        console.error(`Failed to award badge ${badge.badge_key} to user ${context.user_uuid}:`, error);
      }
    }
    
    return awardedBadges;
  }

  /**
   * Check if user is eligible for a specific badge
   */
  private async checkBadgeEligibility(badge: BadgeRecord, context: BadgeCalculationContext): Promise<boolean> {
    switch (badge.threshold_type) {
      case 'email_verified':
        return context.is_email_verified === true;
        
      case 'submission_count':
        if (context.submission_count === undefined) {
          context.submission_count = await this.getUserSubmissionCount(context.user_uuid);
        }
        return badge.threshold_value !== null && context.submission_count >= badge.threshold_value;
        
      case 'photo_count':
        if (context.photo_count === undefined) {
          context.photo_count = await this.getUserPhotoCount(context.user_uuid);
        }
        return badge.threshold_value !== null && context.photo_count >= badge.threshold_value;
        
      case 'account_age':
        if (context.account_age_days === undefined) {
          context.account_age_days = await this.getUserAccountAgeDays(context.user_uuid);
        }
        return badge.threshold_value !== null && context.account_age_days >= badge.threshold_value;
        
      default:
        return false;
    }
  }

  /**
   * Award a badge to a user
   */
  private async awardBadge(user_uuid: string, badge_id: string, reason: string): Promise<{ awarded_at: string }> {
    const id = generateUUID();
    const awarded_at = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO user_badges (id, user_uuid, badge_id, awarded_at, award_reason)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(id, user_uuid, badge_id, awarded_at, reason).run();
    
    return { awarded_at };
  }

  /**
   * Get set of badge IDs already earned by user
   */
  private async getUserBadgeIds(user_uuid: string): Promise<Set<string>> {
    const stmt = this.db.prepare(`
      SELECT badge_id FROM user_badges WHERE user_uuid = ?
    `);
    
    const result = await stmt.bind(user_uuid).all<{ badge_id: string }>();
    return new Set(result.results.map(row => row.badge_id));
  }

  /**
   * Get user's total submission count
   */
  private async getUserSubmissionCount(user_uuid: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM submissions 
      WHERE user_token = ? AND status = 'approved'
    `);
    
    const result = await stmt.bind(user_uuid).first<{ count: number }>();
    return result?.count || 0;
  }

  /**
   * Get user's total photo count across all submissions
   */
  private async getUserPhotoCount(user_uuid: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT 
        SUM(
          CASE 
            WHEN photos IS NULL OR photos = 'null' OR photos = '[]' THEN 0
            ELSE json_array_length(photos)
          END
        ) as photo_count
      FROM submissions 
      WHERE user_token = ? AND status = 'approved' AND photos IS NOT NULL
    `);
    
    const result = await stmt.bind(user_uuid).first<{ photo_count: number }>();
    return result?.photo_count || 0;
  }

  /**
   * Get user's account age in days
   */
  private async getUserAccountAgeDays(user_uuid: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT created_at FROM users WHERE uuid = ?
    `);
    
    const result = await stmt.bind(user_uuid).first<{ created_at: string }>();
    if (!result) {
      return 0;
    }
    
    const created = new Date(result.created_at);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Generate appropriate award reason based on badge type
   */
  private getBadgeAwardReason(badge: BadgeRecord, context: BadgeCalculationContext): string {
    switch (badge.threshold_type) {
      case 'email_verified':
        return 'Email verification completed';
        
      case 'submission_count':
        const count = context.submission_count || 0;
        return `Reached ${count} approved submissions`;
        
      case 'photo_count':
        const photos = context.photo_count || 0;
        return `Uploaded ${photos} photos`;
        
      case 'account_age':
        const days = context.account_age_days || 0;
        return `Account active for ${days} days`;
        
      default:
        return 'Badge criteria met';
    }
  }

  /**
   * Check and award badges after a submission event
   * This is the main integration point for real-time badge awards
   */
  async checkSubmissionBadges(user_uuid: string, user_record?: UserRecord): Promise<BadgeAwardResult[]> {
    const context: BadgeCalculationContext = {
      user_uuid,
      user_record,
      is_email_verified: user_record?.email_verified_at !== null,
    };
    
    return this.calculateAndAwardBadges(context);
  }

  /**
   * Check and award email verification badge
   */
  async checkEmailVerificationBadge(user_uuid: string): Promise<BadgeAwardResult[]> {
    const context: BadgeCalculationContext = {
      user_uuid,
      is_email_verified: true,
    };
    
    return this.calculateAndAwardBadges(context);
  }

  /**
   * Check profile name availability
   */
  async isProfileNameAvailable(profile_name: string, excluding_user_uuid?: string): Promise<boolean> {
    let query = 'SELECT uuid FROM users WHERE LOWER(profile_name) = LOWER(?)';
    const params = [profile_name];
    
    if (excluding_user_uuid) {
      query += ' AND uuid != ?';
      params.push(excluding_user_uuid);
    }
    
    const stmt = this.db.prepare(query);
    const result = await stmt.bind(...params).first();
    
    return result === null;
  }

  /**
   * Update user's profile name
   */
  async updateProfileName(user_uuid: string, profile_name: string): Promise<void> {
    // Check availability first
    const isAvailable = await this.isProfileNameAvailable(profile_name, user_uuid);
    if (!isAvailable) {
      throw new Error('Profile name is already taken');
    }
    
    const stmt = this.db.prepare(`
      UPDATE users SET profile_name = ? WHERE uuid = ?
    `);
    
    await stmt.bind(profile_name, user_uuid).run();
  }

  /**
   * Get user record by UUID for public profile viewing
   */
  async getUserByUuid(user_uuid: string): Promise<UserRecord | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM users WHERE uuid = ?
    `);
    
    const result = await stmt.bind(user_uuid).first<UserRecord>();
    return result || null;
  }

  /**
   * Get user record by profile name for public profile viewing
   */
  async getUserByProfileName(profile_name: string): Promise<UserRecord | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM users WHERE LOWER(profile_name) = LOWER(?)
    `);
    
    const result = await stmt.bind(profile_name).first<UserRecord>();
    return result || null;
  }
}