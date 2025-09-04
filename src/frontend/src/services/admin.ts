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
  GenerateDataDumpResponse,
  ListDataDumpsResponse,
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
    return result.data as AuditLogsResponse;
  }

  /**
   * Get system and audit statistics
   */
  async getStatistics(days = 30): Promise<AuditStatistics> {
    const result = await apiService.getAdminStatistics(days);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get statistics');
    }
    return result.data as AuditStatistics;
  }

  /**
   * Generate a new data dump
   */
  async generateDataDump(): Promise<GenerateDataDumpResponse> {
    const result = await apiService.generateDataDump();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to generate data dump');
    }
    return result.data as GenerateDataDumpResponse;
  }

  /**
   * Get list of all generated data dumps
   */
  async getDataDumps(): Promise<ListDataDumpsResponse> {
    const result = await apiService.getDataDumps();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get data dumps');
    }
    return result.data as ListDataDumpsResponse;
  }
}

// Export singleton instance
export const adminService = new AdminService();