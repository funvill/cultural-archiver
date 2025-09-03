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
  AuditStatistics,
} from '../../../shared/types';
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
    page?: number;
    perPage?: number;
  }): Promise<GetPermissionsResponse> {
    const permissionFilter = filters?.permission;
    const result = await apiService.getAdminPermissions(permissionFilter);
    return result;
  }

  /**
   * Grant permission to a user
   */
  async grantPermission(request: GrantPermissionRequest): Promise<PermissionResponse> {
    return await apiService.grantAdminPermission(request);
  }

  /**
   * Revoke permission from a user
   */
  async revokePermission(request: RevokePermissionRequest): Promise<PermissionResponse> {
    return await apiService.revokeAdminPermission(request);
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

    return await apiService.getAdminAuditLogs(filters);
  }

  /**
   * Get system and audit statistics
   */
  async getStatistics(days = 30): Promise<AuditStatistics> {
    return await apiService.getAdminStatistics(days);
  }
}

// Export singleton instance
export const adminService = new AdminService();