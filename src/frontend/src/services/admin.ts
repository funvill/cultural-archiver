/**
 * Admin API Service
 *
 * Provides API service layer for admin operations including permission management
 * and audit log viewing with proper error handling and TypeScript integration.
 */

import type {
  Permission,
  GrantPermissionRequest,
  RevokePermissionRequest,
  PermissionResponse,
  GetPermissionsResponse,
  AuditLogQuery,
  AuditLogsResponse,
  AuditLogEntry,
  AuditStatistics,
  SocialMediaSuggestionsResponse,
  SocialMediaScheduleListResponse,
  SocialMediaScheduleApiResponse,
  CreateSocialMediaScheduleRequest,
  UpdateSocialMediaScheduleRequest,
  SocialMediaType,
} from '../../../shared/types';
import type { BadgeRecord } from '../../../shared/types';
import { apiService } from './api';

/**
 * Admin API service class for managing permissions and viewing audit logs
 */
export class AdminService {
  /**
   * Get all users with permissions
   */
  async getUserPermissions(filters?: {
    permission?: Permission;
    search?: string;
    page?: number; // reserved for future pagination
    perPage?: number; // reserved for future pagination
  }): Promise<GetPermissionsResponse> {
    const permissionFilter = filters?.permission;
    const result = await apiService.getAdminPermissions(permissionFilter, filters?.search);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get permissions');
    }
    return result.data as GetPermissionsResponse;
  }

  /**
   * Grant permission to a user
   */
  async grantPermission(request: GrantPermissionRequest): Promise<PermissionResponse> {
    const result = await apiService.grantAdminPermission(request);
    if (!result.success) {
      throw new Error(result.error || 'Failed to grant permission');
    }
    return result.data as PermissionResponse;
  }

  /**
   * Revoke permission from a user
   */
  async revokePermission(request: RevokePermissionRequest): Promise<PermissionResponse> {
    const result = await apiService.revokeAdminPermission(request);
    if (!result.success) {
      throw new Error(result.error || 'Failed to revoke permission');
    }
    return result.data as PermissionResponse;
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(query?: AuditLogQuery): Promise<AuditLogsResponse> {
    const filters: Record<string, string> = {};

    if (query?.type) {
      filters.type = query.type;
    }
    if (query?.actor) {
      filters.actor = query.actor;
    }
    if (query?.decision) {
      filters.decision = query.decision;
    }
    if (query?.action_type) {
      filters.action_type = query.action_type;
    }
    if (query?.startDate) {
      filters.start_date = query.startDate;
    }
    if (query?.endDate) {
      filters.end_date = query.endDate;
    }
    if (query?.page) {
      filters.page = query.page.toString();
    }
    if (query?.limit) {
      filters.limit = query.limit.toString();
    }

    const result = await apiService.getAdminAuditLogs(filters);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get audit logs');
    }
    const raw: unknown = result.data;

    // If the backend already returns the expected shape (future-proof), pass through
    if (
      raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as Record<string, unknown>).logs) &&
      typeof (raw as Record<string, unknown>).total === 'number'
    ) {
      return raw as AuditLogsResponse;
    }

    // Current backend shape:
    // {
    //   records: [ { id, type, created_at, submission_id, moderator_uuid, admin_uuid, decision, action_type, ... } ],
    //   pagination: { page, limit, total, totalPages, hasMore },
    //   filters: { ... },
    //   retrieved_at: string
    // }
    const rawObj: Record<string, unknown> = (raw as Record<string, unknown>) || {};
    const possibleRecords = (rawObj.records as unknown) ?? [];
    const records: Record<string, unknown>[] = Array.isArray(possibleRecords)
      ? (possibleRecords as Record<string, unknown>[])
      : [];
    const pagination = (rawObj.pagination as Record<string, unknown> | undefined) || undefined;

    const logs: AuditLogEntry[] = records.map(rec => {
      const r = rec as Record<string, unknown>;
      // Parse metadata if it's a JSON string
      let metadata: AuditLogEntry['metadata'];
      const metaVal = r.metadata as unknown;
      if (metaVal) {
        try {
          metadata =
            typeof metaVal === 'string'
              ? (JSON.parse(metaVal) as AuditLogEntry['metadata'])
              : (metaVal as AuditLogEntry['metadata']);
        } catch {
          metadata = undefined;
        }
      }

      if (r.type === 'moderation') {
        return {
          id: String(r.id),
          type: 'moderation',
          actor_uuid: String(r.moderator_uuid || r.actor_uuid || 'unknown'),
          // actor_email intentionally omitted (backend not providing yet)
          action: String(r.decision || 'decision'),
          target:
            r.submission_id || r.artwork_id ? String(r.submission_id || r.artwork_id) : undefined,
          details: {
            decision: r.decision as unknown,
            reason: r.reason || null,
            submission_id: r.submission_id || null,
            artwork_id: r.artwork_id || null,
          },
          metadata,
          created_at: String(r.created_at || new Date().toISOString()),
        } as unknown as AuditLogEntry;
      }

      // Admin action record
      return {
        id: String(r.id),
        type: 'admin',
        actor_uuid: String(r.admin_uuid || r.actor_uuid || 'unknown'),
        // actor_email intentionally omitted (backend not providing yet)
        action: String(r.action_type || 'admin_action'),
        target: r.target_uuid ? String(r.target_uuid) : undefined,
        details: {
          action_type: r.action_type as unknown,
          permission_type: r.permission_type || null,
          old_value: r.old_value || null,
          new_value: r.new_value || null,
          reason: r.reason || null,
        },
        metadata,
        created_at: String(r.created_at || new Date().toISOString()),
      } as unknown as AuditLogEntry;
    });

    return {
      logs,
      total: Number(pagination?.total) || logs.length,
      page: Number(pagination?.page) || 1,
      limit: Number(pagination?.limit) || logs.length || 0,
      has_more: Boolean(pagination?.hasMore),
    } as AuditLogsResponse;
  }

  /**
   * Get system and audit statistics
   */
  async getStatistics(days = 30): Promise<AuditStatistics> {
    const result = await apiService.getAdminStatistics(days);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get statistics');
    }

    // The backend currently returns a wrapped structure:
    // {
    //   period_days: number,
    //   permissions: { totalUsers, moderators, admins, activePermissions },
    //   audit: {
    //     moderation: { totalDecisions, approved, rejected, skipped, recentActivity: [] },
    //     admin: { totalActions, permissionGrants, permissionRevokes, recentActivity: [] }
    //   },
    //   generated_at: string
    // }
    // But the frontend (and tests) expect the flattened AuditStatistics shape defined in shared/types.ts.
    // In production this mismatch caused undefined numeric fields and a runtime error when calling toLocaleString().
    const raw: unknown = result.data;

    // If the response is already flattened (future-proof), return directly.
    if (typeof raw === 'object' && raw !== null) {
      const r = raw as Partial<AuditStatistics> & Record<string, unknown>;
      if (typeof r.total_decisions === 'number' && typeof r.total_admin_actions === 'number') {
        return r as AuditStatistics; // Already flattened
      }
    }

    // Safely derive flattened statistics from wrapped response.
    const auditWrapper: Record<string, unknown> =
      typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const auditSection = (auditWrapper.audit as Record<string, unknown>) || {};
    const moderation = (auditSection.moderation as Record<string, unknown>) || {};
    const admin = (auditSection.admin as Record<string, unknown>) || {};
    const permissions = (auditWrapper.permissions as Record<string, unknown>) || {};

    const totalDecisions =
      Number(moderation.totalDecisions) ||
      (Number(moderation.approved) || 0) +
        (Number(moderation.rejected) || 0) +
        (Number(moderation.skipped) || 0);
    const totalAdminActions =
      Number(admin.totalActions) ||
      (Number(admin.permissionGrants) || 0) +
        (Number(admin.permissionRevokes) || 0) +
        // Derive view_audit_logs as any remaining actions (cannot be negative)
        Math.max(
          0,
          (Number(admin.totalActions) || 0) -
            ((Number(admin.permissionGrants) || 0) + (Number(admin.permissionRevokes) || 0))
        );

    const viewAuditLogsCount = Math.max(
      0,
      totalAdminActions -
        ((Number(admin.permissionGrants) || 0) + (Number(admin.permissionRevokes) || 0))
    );

    const flattened: AuditStatistics = {
      total_decisions: totalDecisions,
      decisions_by_type: {
        approved: Number(moderation.approved) || 0,
        rejected: Number(moderation.rejected) || 0,
        skipped: Number(moderation.skipped) || 0,
      },
      total_admin_actions: totalAdminActions,
      admin_actions_by_type: {
        grant_permission: Number(admin.permissionGrants) || 0,
        revoke_permission: Number(admin.permissionRevokes) || 0,
        view_audit_logs: viewAuditLogsCount,
      },
      active_moderators: Number(permissions.moderators) || 0,
      active_admins: Number(permissions.admins) || 0,
      date_range: {
        // Backend doesn't currently return explicit start/end for this endpoint, so derive.
        start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
        days,
      },
    };

    return flattened;
  }

  /**
   * Get all badges with award statistics
   */
  async getBadges(): Promise<Array<BadgeRecord & { award_count: number }>> {
    const result = await apiService.getAdminBadges();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get badges');
    }
    return result.data.badges;
  }

  /**
   * Create a new badge
   */
  async createBadge(badge: {
    badge_key: string;
    title: string;
    description: string;
    icon_emoji: string;
    category: string;
    level: number;
    threshold_type: string;
    threshold_value: number | null;
  }): Promise<BadgeRecord> {
    const result = await apiService.createAdminBadge(badge);
    if (!result.success) {
      throw new Error(result.error || 'Failed to create badge');
    }
    return result.data as BadgeRecord;
  }

  /**
   * Update an existing badge
   */
  async updateBadge(
    badgeId: string,
    updates: {
      title?: string;
      description?: string;
      icon_emoji?: string;
      category?: string;
      level?: number;
      threshold_type?: string;
      threshold_value?: number | null;
      is_active?: boolean;
    }
  ): Promise<BadgeRecord> {
    const result = await apiService.updateAdminBadge(badgeId, updates);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update badge');
    }
    return result.data as BadgeRecord;
  }

  /**
   * Deactivate a badge
   */
  async deactivateBadge(badgeId: string): Promise<void> {
    const result = await apiService.deactivateAdminBadge(badgeId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to deactivate badge');
    }
  }

  // ================================
  // Social Media Scheduling Methods
  // ================================

  /**
   * Get artwork suggestions for social media posts
   */
  async getSocialMediaSuggestions(params?: {
    page?: number;
    per_page?: number;
  }): Promise<SocialMediaSuggestionsResponse> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.per_page) queryParams.per_page = params.per_page.toString();

    const result = await apiService.get<{ success: boolean; data: SocialMediaSuggestionsResponse }>(
      '/admin/social-media/suggestions',
      queryParams
    );
    
    if (!result.success || !result.data) {
      throw new Error('Failed to get social media suggestions');
    }
    
    return result.data;
  }

  /**
   * Schedule a new social media post
   */
  async createSocialMediaSchedule(
    request: CreateSocialMediaScheduleRequest
  ): Promise<{ schedule: SocialMediaScheduleApiResponse; warning?: string }> {
    const result = await apiService.post<{
      success: boolean;
      data: { schedule: SocialMediaScheduleApiResponse; warning?: string };
    }>('/admin/social-media/schedule', request);
    
    if (!result.success || !result.data) {
      throw new Error('Failed to create social media schedule');
    }
    
    return result.data;
  }

  /**
   * Get list of scheduled posts
   */
  async getSocialMediaSchedules(params?: {
    page?: number;
    per_page?: number;
    status?: 'scheduled' | 'posted' | 'failed';
    social_type?: SocialMediaType;
  }): Promise<SocialMediaScheduleListResponse> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.per_page) queryParams.per_page = params.per_page.toString();
    if (params?.status) queryParams.status = params.status;
    if (params?.social_type) queryParams.social_type = params.social_type;

    const result = await apiService.get<{ success: boolean; data: SocialMediaScheduleListResponse }>(
      '/admin/social-media/schedule',
      queryParams
    );
    
    if (!result.success || !result.data) {
      throw new Error('Failed to get social media schedules');
    }
    
    return result.data;
  }

  /**
   * Update a scheduled post
   */
  async updateSocialMediaSchedule(
    id: string,
    updates: Partial<UpdateSocialMediaScheduleRequest>
  ): Promise<SocialMediaScheduleApiResponse> {
    const result = await apiService.put<{ success: boolean; data: { schedule: SocialMediaScheduleApiResponse } }>(
      `/admin/social-media/schedule/${id}`,
      updates
    );
    
    if (!result.success || !result.data) {
      throw new Error('Failed to update social media schedule');
    }
    
    return result.data.schedule;
  }

  /**
   * Delete a scheduled post
   */
  async deleteSocialMediaSchedule(id: string): Promise<void> {
    const result = await apiService.delete<{ success: boolean; message: string }>(
      `/admin/social-media/schedule/${id}`
    );
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to delete social media schedule');
    }
  }

  /**
   * Get the next available date with no scheduled posts
   */
  async getNextAvailableDate(): Promise<string> {
    const result = await apiService.get<{ success: boolean; data: { date: string } }>(
      '/admin/social-media/next-available-date'
    );
    
    if (!result.success || !result.data) {
      throw new Error('Failed to get next available date');
    }
    
    return result.data.date;
  }
}

// Export singleton instance
export const adminService = new AdminService();
