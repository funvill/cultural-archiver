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
    const params = new URLSearchParams();
    
    if (filters?.permission) {
      params.append('permission', filters.permission);
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }
    if (filters?.page) {
      params.append('page', filters.page.toString());
    }
    if (filters?.perPage) {
      params.append('per_page', filters.perPage.toString());
    }

    const url = params.toString() ? `/api/admin/permissions?${params}` : '/api/admin/permissions';
    return await apiService.get<GetPermissionsResponse>(url);
  }

  /**
   * Grant permission to a user
   */
  async grantPermission(request: GrantPermissionRequest): Promise<PermissionResponse> {
    return await apiService.post<PermissionResponse>('/api/admin/permissions/grant', request);
  }

  /**
   * Revoke permission from a user
   */
  async revokePermission(request: RevokePermissionRequest): Promise<PermissionResponse> {
    return await apiService.post<PermissionResponse>('/api/admin/permissions/revoke', request);
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(query?: AuditLogQuery): Promise<AuditLogsResponse> {
    const params = new URLSearchParams();
    
    if (query?.type) {
      params.append('type', query.type);
    }
    if (query?.actor) {
      params.append('actor', query.actor);
    }
    if (query?.decision) {
      params.append('decision', query.decision);
    }
    if (query?.action_type) {
      params.append('action_type', query.action_type);
    }
    if (query?.startDate) {
      params.append('start_date', query.startDate);
    }
    if (query?.endDate) {
      params.append('end_date', query.endDate);
    }
    if (query?.page) {
      params.append('page', query.page.toString());
    }
    if (query?.limit) {
      params.append('limit', query.limit.toString());
    }

    const url = params.toString() ? `/api/admin/audit?${params}` : '/api/admin/audit';
    return await apiService.get<AuditLogsResponse>(url);
  }

  /**
   * Get system and audit statistics
   */
  async getStatistics(days = 30): Promise<AuditStatistics> {
    return await apiService.get<AuditStatistics>(`/api/admin/statistics?days=${days}`);
  }
}

// Export singleton instance
export const adminService = new AdminService();