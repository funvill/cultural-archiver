import { defineComponent, ref, onMounted, mergeProps, useSSRContext, computed } from 'vue';
import { ssrRenderAttrs, ssrRenderAttr, ssrIncludeBooleanAttr, ssrLooseContain, ssrLooseEqual, ssrInterpolate, ssrRenderList, ssrRenderClass, ssrRenderComponent } from 'vue/server-renderer';
import { a as apiService, d as useAuthStore } from '../ssr-entry-server.js';
import { u as useToasts } from './useToasts-PudGFTbq.js';
import '@vue/server-renderer';
import 'vue-router';
import 'pinia';
import '@vueuse/head';
import 'exifr';
import '@heroicons/vue/24/outline';
import '@heroicons/vue/24/solid';

class AdminService {
  /**
   * Get all users with permissions
   */
  async getUserPermissions(filters) {
    const permissionFilter = filters?.permission;
    const result = await apiService.getAdminPermissions(permissionFilter, filters?.search);
    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to get permissions");
    }
    return result.data;
  }
  /**
   * Grant permission to a user
   */
  async grantPermission(request) {
    const result = await apiService.grantAdminPermission(request);
    if (!result.success) {
      throw new Error(result.error || "Failed to grant permission");
    }
    return result.data;
  }
  /**
   * Revoke permission from a user
   */
  async revokePermission(request) {
    const result = await apiService.revokeAdminPermission(request);
    if (!result.success) {
      throw new Error(result.error || "Failed to revoke permission");
    }
    return result.data;
  }
  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(query) {
    const filters = {};
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
      throw new Error(result.error || "Failed to get audit logs");
    }
    const raw = result.data;
    if (raw && typeof raw === "object" && Array.isArray(raw.logs) && typeof raw.total === "number") {
      return raw;
    }
    const rawObj = raw || {};
    const possibleRecords = rawObj.records ?? [];
    const records = Array.isArray(possibleRecords) ? possibleRecords : [];
    const pagination = rawObj.pagination || void 0;
    const logs = records.map((rec) => {
      const r = rec;
      let metadata;
      const metaVal = r.metadata;
      if (metaVal) {
        try {
          metadata = typeof metaVal === "string" ? JSON.parse(metaVal) : metaVal;
        } catch {
          metadata = void 0;
        }
      }
      if (r.type === "moderation") {
        return {
          id: String(r.id),
          type: "moderation",
          actor_uuid: String(r.moderator_uuid || r.actor_uuid || "unknown"),
          // actor_email intentionally omitted (backend not providing yet)
          action: String(r.decision || "decision"),
          target: r.submission_id || r.artwork_id ? String(r.submission_id || r.artwork_id) : void 0,
          details: {
            decision: r.decision,
            reason: r.reason || null,
            submission_id: r.submission_id || null,
            artwork_id: r.artwork_id || null
          },
          metadata,
          created_at: String(r.created_at || (/* @__PURE__ */ new Date()).toISOString())
        };
      }
      return {
        id: String(r.id),
        type: "admin",
        actor_uuid: String(r.admin_uuid || r.actor_uuid || "unknown"),
        // actor_email intentionally omitted (backend not providing yet)
        action: String(r.action_type || "admin_action"),
        target: r.target_uuid ? String(r.target_uuid) : void 0,
        details: {
          action_type: r.action_type,
          permission_type: r.permission_type || null,
          old_value: r.old_value || null,
          new_value: r.new_value || null,
          reason: r.reason || null
        },
        metadata,
        created_at: String(r.created_at || (/* @__PURE__ */ new Date()).toISOString())
      };
    });
    return {
      logs,
      total: Number(pagination?.total) || logs.length,
      page: Number(pagination?.page) || 1,
      limit: Number(pagination?.limit) || logs.length || 0,
      has_more: Boolean(pagination?.hasMore)
    };
  }
  /**
   * Get system and audit statistics
   */
  async getStatistics(days = 30) {
    const result = await apiService.getAdminStatistics(days);
    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to get statistics");
    }
    const raw = result.data;
    if (typeof raw === "object" && raw !== null) {
      const r = raw;
      if (typeof r.total_decisions === "number" && typeof r.total_admin_actions === "number") {
        return r;
      }
    }
    const auditWrapper = typeof raw === "object" && raw !== null ? raw : {};
    const auditSection = auditWrapper.audit || {};
    const moderation = auditSection.moderation || {};
    const admin = auditSection.admin || {};
    const permissions = auditWrapper.permissions || {};
    const totalDecisions = Number(moderation.totalDecisions) || (Number(moderation.approved) || 0) + (Number(moderation.rejected) || 0) + (Number(moderation.skipped) || 0);
    const totalAdminActions = Number(admin.totalActions) || (Number(admin.permissionGrants) || 0) + (Number(admin.permissionRevokes) || 0) + // Derive view_audit_logs as any remaining actions (cannot be negative)
    Math.max(
      0,
      (Number(admin.totalActions) || 0) - ((Number(admin.permissionGrants) || 0) + (Number(admin.permissionRevokes) || 0))
    );
    const viewAuditLogsCount = Math.max(
      0,
      totalAdminActions - ((Number(admin.permissionGrants) || 0) + (Number(admin.permissionRevokes) || 0))
    );
    const flattened = {
      total_decisions: totalDecisions,
      decisions_by_type: {
        approved: Number(moderation.approved) || 0,
        rejected: Number(moderation.rejected) || 0,
        skipped: Number(moderation.skipped) || 0
      },
      total_admin_actions: totalAdminActions,
      admin_actions_by_type: {
        grant_permission: Number(admin.permissionGrants) || 0,
        revoke_permission: Number(admin.permissionRevokes) || 0,
        view_audit_logs: viewAuditLogsCount
      },
      active_moderators: Number(permissions.moderators) || 0,
      active_admins: Number(permissions.admins) || 0,
      date_range: {
        // Backend doesn't currently return explicit start/end for this endpoint, so derive.
        start: new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString(),
        end: (/* @__PURE__ */ new Date()).toISOString(),
        days
      }
    };
    return flattened;
  }
  /**
   * Get all badges with award statistics
   */
  async getBadges() {
    const result = await apiService.getAdminBadges();
    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to get badges");
    }
    return result.data.badges;
  }
  /**
   * Create a new badge
   */
  async createBadge(badge) {
    const result = await apiService.createAdminBadge(badge);
    if (!result.success) {
      throw new Error(result.error || "Failed to create badge");
    }
    return result.data;
  }
  /**
   * Update an existing badge
   */
  async updateBadge(badgeId, updates) {
    const result = await apiService.updateAdminBadge(badgeId, updates);
    if (!result.success) {
      throw new Error(result.error || "Failed to update badge");
    }
    return result.data;
  }
  /**
   * Deactivate a badge
   */
  async deactivateBadge(badgeId) {
    const result = await apiService.deactivateAdminBadge(badgeId);
    if (!result.success) {
      throw new Error(result.error || "Failed to deactivate badge");
    }
  }
  // ================================
  // Social Media Scheduling Methods
  // ================================
  /**
   * Get artwork suggestions for social media posts
   */
  async getSocialMediaSuggestions(params) {
    const queryParams = {};
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.per_page) queryParams.per_page = params.per_page.toString();
    const result = await apiService.get(
      "/admin/social-media/suggestions",
      queryParams
    );
    if (!result.success || !result.data) {
      throw new Error("Failed to get social media suggestions");
    }
    return result.data;
  }
  /**
   * Schedule a new social media post
   */
  async createSocialMediaSchedule(request) {
    const result = await apiService.post("/admin/social-media/schedule", request);
    if (!result.success || !result.data) {
      throw new Error("Failed to create social media schedule");
    }
    return result.data;
  }
  /**
   * Get list of scheduled posts
   */
  async getSocialMediaSchedules(params) {
    const queryParams = {};
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.per_page) queryParams.per_page = params.per_page.toString();
    if (params?.status) queryParams.status = params.status;
    if (params?.social_type) queryParams.social_type = params.social_type;
    const result = await apiService.get(
      "/admin/social-media/schedule",
      queryParams
    );
    if (!result.success || !result.data) {
      throw new Error("Failed to get social media schedules");
    }
    return result.data;
  }
  /**
   * Update a scheduled post
   */
  async updateSocialMediaSchedule(id, updates) {
    const result = await apiService.put(
      `/admin/social-media/schedule/${id}`,
      updates
    );
    if (!result.success || !result.data) {
      throw new Error("Failed to update social media schedule");
    }
    return result.data.schedule;
  }
  /**
   * Delete a scheduled post
   */
  async deleteSocialMediaSchedule(id) {
    const result = await apiService.delete(
      `/admin/social-media/schedule/${id}`
    );
    if (!result.success) {
      throw new Error(result.message || "Failed to delete social media schedule");
    }
  }
  /**
   * Get the next available date with no scheduled posts
   */
  async getNextAvailableDate() {
    const result = await apiService.get(
      "/admin/social-media/next-available-date"
    );
    if (!result.success || !result.data) {
      throw new Error("Failed to get next available date");
    }
    return result.data.date;
  }
  /**
   * Manual test trigger for a scheduled post - attempts to post immediately but does not modify schedule state
   */
  async testSocialMediaSchedule(id, options) {
    const payload = options?.commit ? { commit: true } : {};
    const result = await apiService.post(
      `/admin/social-media/schedule/${id}/test`,
      payload
    );
    if (!result.success || !result.data) {
      throw new Error("Failed to run manual social media test");
    }
    return result.data;
  }
}
const adminService = new AdminService();

const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  __name: "PermissionManager",
  __ssrInlineRender: true,
  emits: ["permissionChanged"],
  setup(__props, { emit: __emit }) {
    const permissions = ref(null);
    const isLoading = ref(false);
    const error = ref(null);
    const searchQuery = ref("");
    const permissionFilter = ref("");
    const showGrantDialog = ref(false);
    const showRevokeDialog = ref(false);
    const isSubmitting = ref(false);
    const revokeTarget = ref(null);
    const grantForm = ref({
      userUuid: "",
      permission: "",
      reason: ""
    });
    const revokeForm = ref({
      permission: "",
      reason: ""
    });
    async function loadPermissions() {
      try {
        isLoading.value = true;
        error.value = null;
        const filters = {};
        if (searchQuery.value.trim()) {
          filters.search = searchQuery.value.trim();
        }
        if (permissionFilter.value) {
          filters.permission = permissionFilter.value;
        }
        const response = await adminService.getUserPermissions(filters);
        permissions.value = response;
      } catch (err) {
        console.error("Failed to load permissions:", err);
        error.value = err instanceof Error ? err.message : "Failed to load permissions";
      } finally {
        isLoading.value = false;
      }
    }
    function formatDate(dateString) {
      return new Date(dateString).toLocaleDateString();
    }
    onMounted(async () => {
      await loadPermissions();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "space-y-6" }, _attrs))}><div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h2 class="text-lg font-medium text-gray-900 dark:text-white">User Permissions</h2><p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> Manage moderator and admin permissions for users </p></div><button class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"><svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg> Grant Permission </button></div><div class="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label for="search" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Search Users </label><input id="search"${ssrRenderAttr("value", searchQuery.value)} type="text" placeholder="Search by email..." class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"></div><div><label for="permission-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Filter by Permission </label><select id="permission-filter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"><option value=""${ssrIncludeBooleanAttr(Array.isArray(permissionFilter.value) ? ssrLooseContain(permissionFilter.value, "") : ssrLooseEqual(permissionFilter.value, "")) ? " selected" : ""}>All Permissions</option><option value="moderator"${ssrIncludeBooleanAttr(Array.isArray(permissionFilter.value) ? ssrLooseContain(permissionFilter.value, "moderator") : ssrLooseEqual(permissionFilter.value, "moderator")) ? " selected" : ""}>Moderators</option><option value="admin"${ssrIncludeBooleanAttr(Array.isArray(permissionFilter.value) ? ssrLooseContain(permissionFilter.value, "admin") : ssrLooseEqual(permissionFilter.value, "admin")) ? " selected" : ""}>Admins</option></select></div><div class="flex items-end"><button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"> Reset Filters </button></div></div>`);
      if (isLoading.value) {
        _push(`<div class="text-center py-8"><div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div><p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading permissions...</p></div>`);
      } else if (error.value) {
        _push(`<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4"><div class="flex"><div class="flex-shrink-0"><svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg></div><div class="ml-3"><h3 class="text-sm font-medium text-red-800 dark:text-red-200"> Error loading permissions </h3><p class="mt-1 text-sm text-red-700 dark:text-red-300">${ssrInterpolate(error.value)}</p></div></div></div>`);
      } else if (permissions.value) {
        _push(`<div class="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">`);
        if (permissions.value.users.length === 0) {
          _push(`<div class="text-center py-8"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"></path></svg><h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No users found</h3><p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> No users match your current search and filter criteria. </p></div>`);
        } else {
          _push(`<ul class="divide-y divide-gray-200 dark:divide-gray-700"><!--[-->`);
          ssrRenderList(permissions.value.users, (user) => {
            _push(`<li class="px-6 py-4"><div class="flex items-center justify-between"><div class="flex-1"><div class="flex items-center"><div class="flex-shrink-0"><div class="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center"><svg class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div></div><div class="ml-4"><div class="text-sm font-medium text-gray-900 dark:text-white">${ssrInterpolate(user.email || "Unknown Email")}</div><div class="text-sm text-gray-500 dark:text-gray-400">${ssrInterpolate(user.user_uuid)}</div></div></div><div class="mt-2 flex flex-wrap gap-2"><!--[-->`);
            ssrRenderList(user.permissions, (permission) => {
              _push(`<span class="${ssrRenderClass([
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                permission.permission === "admin" ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400" : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
              ])}">${ssrInterpolate(permission.permission)}</span>`);
            });
            _push(`<!--]--></div><div class="mt-1 text-xs text-gray-500 dark:text-gray-400"><!--[-->`);
            ssrRenderList(user.permissions, (permission, index) => {
              _push(`<span>${ssrInterpolate(permission.permission)} granted ${ssrInterpolate(formatDate(permission.granted_at))}${ssrInterpolate(permission.notes ? ` - ${permission.notes}` : "")} `);
              if (index < user.permissions.length - 1) {
                _push(`<span> • </span>`);
              } else {
                _push(`<!---->`);
              }
              _push(`</span>`);
            });
            _push(`<!--]--></div></div><div class="flex items-center space-x-2"><button${ssrIncludeBooleanAttr(user.permissions.length === 0) ? " disabled" : ""} class="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"> Revoke </button></div></div></li>`);
          });
          _push(`<!--]--></ul>`);
        }
        if (permissions.value.total > permissions.value.users.length) {
          _push(`<div class="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sm:px-6"><div class="flex items-center justify-between"><div class="text-sm text-gray-700 dark:text-gray-300"> Showing ${ssrInterpolate(permissions.value.users.length)} of ${ssrInterpolate(permissions.value.total)} users </div><div class="text-sm text-gray-500 dark:text-gray-400"></div></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      if (showGrantDialog.value) {
        _push(`<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"><div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800"><div class="mt-3"><h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Grant Permission</h3><form class="space-y-4"><div><label for="grant-user-uuid" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> User UUID </label><input id="grant-user-uuid"${ssrRenderAttr("value", grantForm.value.userUuid)} type="text" required placeholder="550e8400-e29b-41d4-a716-446655440000" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"></div><div><label for="grant-permission" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Permission </label><select id="grant-permission" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"><option value=""${ssrIncludeBooleanAttr(Array.isArray(grantForm.value.permission) ? ssrLooseContain(grantForm.value.permission, "") : ssrLooseEqual(grantForm.value.permission, "")) ? " selected" : ""}>Select Permission</option><option value="moderator"${ssrIncludeBooleanAttr(Array.isArray(grantForm.value.permission) ? ssrLooseContain(grantForm.value.permission, "moderator") : ssrLooseEqual(grantForm.value.permission, "moderator")) ? " selected" : ""}>Moderator</option><option value="admin"${ssrIncludeBooleanAttr(Array.isArray(grantForm.value.permission) ? ssrLooseContain(grantForm.value.permission, "admin") : ssrLooseEqual(grantForm.value.permission, "admin")) ? " selected" : ""}>Admin</option></select></div><div><label for="grant-reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Reason (Optional) </label><textarea id="grant-reason" rows="3" placeholder="Reason for granting this permission..." class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">${ssrInterpolate(grantForm.value.reason)}</textarea></div><div class="flex justify-end space-x-3 pt-4"><button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"> Cancel </button><button type="submit"${ssrIncludeBooleanAttr(isSubmitting.value) ? " disabled" : ""} class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">${ssrInterpolate(isSubmitting.value ? "Granting..." : "Grant Permission")}</button></div></form></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showRevokeDialog.value) {
        _push(`<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"><div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800"><div class="mt-3"><h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Revoke Permission</h3>`);
        if (revokeTarget.value) {
          _push(`<div class="mb-4"><p class="text-sm text-gray-600 dark:text-gray-400"> You are about to revoke permissions for: </p><p class="text-sm font-medium text-gray-900 dark:text-white">${ssrInterpolate(revokeTarget.value.email || "Unknown Email")}</p><p class="text-xs text-gray-500 dark:text-gray-400">${ssrInterpolate(revokeTarget.value.user_uuid)}</p></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<form class="space-y-4"><div><label for="revoke-permission" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Permission to Revoke </label><select id="revoke-permission" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"><option value=""${ssrIncludeBooleanAttr(Array.isArray(revokeForm.value.permission) ? ssrLooseContain(revokeForm.value.permission, "") : ssrLooseEqual(revokeForm.value.permission, "")) ? " selected" : ""}>Select Permission</option><!--[-->`);
        ssrRenderList(revokeTarget.value?.permissions, (permission) => {
          _push(`<option${ssrRenderAttr("value", permission.permission)}${ssrIncludeBooleanAttr(Array.isArray(revokeForm.value.permission) ? ssrLooseContain(revokeForm.value.permission, permission.permission) : ssrLooseEqual(revokeForm.value.permission, permission.permission)) ? " selected" : ""}>${ssrInterpolate(permission.permission)}</option>`);
        });
        _push(`<!--]--></select></div><div><label for="revoke-reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Reason (Optional) </label><textarea id="revoke-reason" rows="3" placeholder="Reason for revoking this permission..." class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">${ssrInterpolate(revokeForm.value.reason)}</textarea></div><div class="flex justify-end space-x-3 pt-4"><button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"> Cancel </button><button type="submit"${ssrIncludeBooleanAttr(isSubmitting.value) ? " disabled" : ""} class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed">${ssrInterpolate(isSubmitting.value ? "Revoking..." : "Revoke Permission")}</button></div></form></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$6 = _sfc_main$6.setup;
_sfc_main$6.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/PermissionManager.vue");
  return _sfc_setup$6 ? _sfc_setup$6(props, ctx) : void 0;
};

const _sfc_main$5 = /* @__PURE__ */ defineComponent({
  __name: "AuditLogViewer",
  __ssrInlineRender: true,
  setup(__props) {
    const auditLogs = ref(null);
    const isLoading = ref(false);
    const error = ref(null);
    const selectedLog = ref(null);
    const currentPage = ref(1);
    const pageSize = ref(25);
    const filters = ref({
      type: void 0,
      actor: "",
      decision: void 0,
      action_type: void 0,
      startDate: "",
      endDate: "",
      page: 1,
      limit: 25
    });
    const totalPages = computed(() => {
      if (!auditLogs.value) return 1;
      return Math.ceil(auditLogs.value.total / pageSize.value);
    });
    async function loadAuditLogs() {
      isLoading.value = true;
      error.value = null;
      try {
        const query = {
          page: currentPage.value,
          limit: pageSize.value
        };
        if (filters.value.type) {
          query.type = filters.value.type;
        }
        if (filters.value.actor && filters.value.actor.trim()) {
          query.actor = filters.value.actor.trim();
        }
        if (filters.value.decision) {
          query.decision = filters.value.decision;
        }
        if (filters.value.action_type) {
          query.action_type = filters.value.action_type;
        }
        if (filters.value.startDate && filters.value.startDate.trim()) {
          query.startDate = new Date(filters.value.startDate).toISOString();
        }
        if (filters.value.endDate && filters.value.endDate.trim()) {
          query.endDate = new Date(filters.value.endDate).toISOString();
        }
        const response = await adminService.getAuditLogs(query);
        auditLogs.value = response;
      } catch (err) {
        console.error("Failed to load audit logs:", err);
        error.value = err instanceof Error ? err.message : "Failed to load audit logs";
      } finally {
        isLoading.value = false;
      }
    }
    onMounted(() => {
      loadAuditLogs();
    });
    function formatDateTime(dateString) {
      return new Date(dateString).toLocaleString();
    }
    function getActionColor(action) {
      switch (action) {
        case "approved":
          return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
        case "rejected":
          return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
        case "skipped":
          return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
        case "grant_permission":
          return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
        case "revoke_permission":
          return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
        case "manual_social_post":
          return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
        case "view_audit_logs":
          return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
        default:
          return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
      }
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "space-y-6" }, _attrs))}><div><h2 class="text-lg font-medium text-gray-900 dark:text-white">Audit Logs</h2><p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> View and filter moderation decisions and administrative actions </p></div><div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow"><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><div><label for="type-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Log Type </label><select id="type-filter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"><option value=""${ssrIncludeBooleanAttr(Array.isArray(filters.value.type) ? ssrLooseContain(filters.value.type, "") : ssrLooseEqual(filters.value.type, "")) ? " selected" : ""}>All Types</option><option value="moderation"${ssrIncludeBooleanAttr(Array.isArray(filters.value.type) ? ssrLooseContain(filters.value.type, "moderation") : ssrLooseEqual(filters.value.type, "moderation")) ? " selected" : ""}>Moderation</option><option value="admin"${ssrIncludeBooleanAttr(Array.isArray(filters.value.type) ? ssrLooseContain(filters.value.type, "admin") : ssrLooseEqual(filters.value.type, "admin")) ? " selected" : ""}>Admin Actions</option></select></div>`);
      if (filters.value.type === "moderation" || !filters.value.type) {
        _push(`<div><label for="decision-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Decision </label><select id="decision-filter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"><option value=""${ssrIncludeBooleanAttr(Array.isArray(filters.value.decision) ? ssrLooseContain(filters.value.decision, "") : ssrLooseEqual(filters.value.decision, "")) ? " selected" : ""}>All Decisions</option><option value="approved"${ssrIncludeBooleanAttr(Array.isArray(filters.value.decision) ? ssrLooseContain(filters.value.decision, "approved") : ssrLooseEqual(filters.value.decision, "approved")) ? " selected" : ""}>Approved</option><option value="rejected"${ssrIncludeBooleanAttr(Array.isArray(filters.value.decision) ? ssrLooseContain(filters.value.decision, "rejected") : ssrLooseEqual(filters.value.decision, "rejected")) ? " selected" : ""}>Rejected</option><option value="skipped"${ssrIncludeBooleanAttr(Array.isArray(filters.value.decision) ? ssrLooseContain(filters.value.decision, "skipped") : ssrLooseEqual(filters.value.decision, "skipped")) ? " selected" : ""}>Skipped</option></select></div>`);
      } else {
        _push(`<!---->`);
      }
      if (filters.value.type === "admin" || !filters.value.type) {
        _push(`<div><label for="action-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Action Type </label><select id="action-filter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"><option value=""${ssrIncludeBooleanAttr(Array.isArray(filters.value.action_type) ? ssrLooseContain(filters.value.action_type, "") : ssrLooseEqual(filters.value.action_type, "")) ? " selected" : ""}>All Actions</option><option value="grant_permission"${ssrIncludeBooleanAttr(Array.isArray(filters.value.action_type) ? ssrLooseContain(filters.value.action_type, "grant_permission") : ssrLooseEqual(filters.value.action_type, "grant_permission")) ? " selected" : ""}>Grant Permission</option><option value="revoke_permission"${ssrIncludeBooleanAttr(Array.isArray(filters.value.action_type) ? ssrLooseContain(filters.value.action_type, "revoke_permission") : ssrLooseEqual(filters.value.action_type, "revoke_permission")) ? " selected" : ""}>Revoke Permission</option><option value="manual_social_post"${ssrIncludeBooleanAttr(Array.isArray(filters.value.action_type) ? ssrLooseContain(filters.value.action_type, "manual_social_post") : ssrLooseEqual(filters.value.action_type, "manual_social_post")) ? " selected" : ""}>Manual Social Post</option><option value="view_audit_logs"${ssrIncludeBooleanAttr(Array.isArray(filters.value.action_type) ? ssrLooseContain(filters.value.action_type, "view_audit_logs") : ssrLooseEqual(filters.value.action_type, "view_audit_logs")) ? " selected" : ""}>View Audit Logs</option></select></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div><label for="actor-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Actor (User UUID) </label><input id="actor-filter"${ssrRenderAttr("value", filters.value.actor)} type="text" placeholder="User UUID..." class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"></div></div><div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"><div><label for="start-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> Start Date </label><input id="start-date"${ssrRenderAttr("value", filters.value.startDate)} type="datetime-local" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"></div><div><label for="end-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> End Date </label><input id="end-date"${ssrRenderAttr("value", filters.value.endDate)} type="datetime-local" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"></div></div><div class="mt-4 flex justify-between items-center"><button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"> Reset Filters </button><div class="text-sm text-gray-500 dark:text-gray-400">${ssrInterpolate(auditLogs.value?.total || 0)} total entries </div></div></div>`);
      if (isLoading.value) {
        _push(`<div class="text-center py-8"><div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div><p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading audit logs...</p></div>`);
      } else if (error.value) {
        _push(`<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4"><div class="flex"><div class="flex-shrink-0"><svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg></div><div class="ml-3"><h3 class="text-sm font-medium text-red-800 dark:text-red-200"> Error loading audit logs </h3><p class="mt-1 text-sm text-red-700 dark:text-red-300">${ssrInterpolate(error.value)}</p></div></div></div>`);
      } else if (auditLogs.value) {
        _push(`<div class="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">`);
        if (auditLogs.value.logs.length === 0) {
          _push(`<div class="text-center py-8"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No audit logs found</h3><p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> No audit logs match your current filter criteria. </p></div>`);
        } else {
          _push(`<div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead class="bg-gray-50 dark:bg-gray-700"><tr><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"> Date/Time </th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"> Type </th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"> Actor </th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"> Action </th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"> Target </th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"> Details </th></tr></thead><tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"><!--[-->`);
          ssrRenderList(auditLogs.value.logs, (log) => {
            _push(`<tr class="hover:bg-gray-50 dark:hover:bg-gray-700"><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${ssrInterpolate(formatDateTime(log.created_at))}</td><td class="px-6 py-4 whitespace-nowrap"><span class="${ssrRenderClass([
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
              log.type === "admin" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400" : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
            ])}">${ssrInterpolate(log.type)}</span></td><td class="px-6 py-4 text-sm text-gray-900 dark:text-white"><div class="truncate max-w-xs">${ssrInterpolate(log.actor_email || "Unknown")}</div><div class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">${ssrInterpolate(log.actor_uuid)}</div></td><td class="px-6 py-4 text-sm text-gray-900 dark:text-white"><span class="${ssrRenderClass([
              "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
              getActionColor(log.action)
            ])}">${ssrInterpolate(log.action)}</span></td><td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400"><div class="truncate max-w-xs">${ssrInterpolate(log.target || "-")}</div></td><td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400"><button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"> View Details </button></td></tr>`);
          });
          _push(`<!--]--></tbody></table></div>`);
        }
        _push(`<div class="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sm:px-6"><div class="flex items-center justify-between"><div class="flex items-center space-x-2"><button${ssrIncludeBooleanAttr(currentPage.value <= 1) ? " disabled" : ""} class="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"> Previous </button><span class="text-sm text-gray-700 dark:text-gray-300"> Page ${ssrInterpolate(currentPage.value)} of ${ssrInterpolate(totalPages.value)}</span><button${ssrIncludeBooleanAttr(currentPage.value >= totalPages.value) ? " disabled" : ""} class="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"> Next </button></div><div class="text-sm text-gray-700 dark:text-gray-300"> Showing ${ssrInterpolate(auditLogs.value.logs.length)} of ${ssrInterpolate(auditLogs.value.total)} entries </div></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (selectedLog.value) {
        _push(`<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"><div class="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800"><div class="mt-3"><div class="flex items-center justify-between mb-4"><h3 class="text-lg font-medium text-gray-900 dark:text-white">Audit Log Details</h3><button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div><div class="space-y-4"><div><h4 class="text-sm font-medium text-gray-700 dark:text-gray-300"> Basic Information </h4><dl class="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2"><div><dt class="text-sm text-gray-500 dark:text-gray-400">ID</dt><dd class="text-sm text-gray-900 dark:text-white font-mono">${ssrInterpolate(selectedLog.value.id)}</dd></div><div><dt class="text-sm text-gray-500 dark:text-gray-400">Type</dt><dd class="text-sm text-gray-900 dark:text-white">${ssrInterpolate(selectedLog.value.type)}</dd></div><div><dt class="text-sm text-gray-500 dark:text-gray-400">Actor</dt><dd class="text-sm text-gray-900 dark:text-white">${ssrInterpolate(selectedLog.value.actor_email || "Unknown")} <div class="text-xs text-gray-500 dark:text-gray-400 font-mono">${ssrInterpolate(selectedLog.value.actor_uuid)}</div></dd></div><div><dt class="text-sm text-gray-500 dark:text-gray-400">Action</dt><dd class="text-sm text-gray-900 dark:text-white">${ssrInterpolate(selectedLog.value.action)}</dd></div><div><dt class="text-sm text-gray-500 dark:text-gray-400">Target</dt><dd class="text-sm text-gray-900 dark:text-white">${ssrInterpolate(selectedLog.value.target || "-")}</dd></div><div><dt class="text-sm text-gray-500 dark:text-gray-400">Date/Time</dt><dd class="text-sm text-gray-900 dark:text-white">${ssrInterpolate(formatDateTime(selectedLog.value.created_at))}</dd></div></dl></div>`);
        if (selectedLog.value.details) {
          _push(`<div><h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Details</h4><pre class="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded overflow-auto max-h-40">${ssrInterpolate(JSON.stringify(selectedLog.value.details, null, 2))}</pre></div>`);
        } else {
          _push(`<!---->`);
        }
        if (selectedLog.value.metadata) {
          _push(`<div><h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Metadata</h4><pre class="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded overflow-auto max-h-40">${ssrInterpolate(JSON.stringify(selectedLog.value.metadata, null, 2))}</pre></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$5 = _sfc_main$5.setup;
_sfc_main$5.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/AuditLogViewer.vue");
  return _sfc_setup$5 ? _sfc_setup$5(props, ctx) : void 0;
};

const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "BadgeManager",
  __ssrInlineRender: true,
  setup(__props) {
    const badges = ref([]);
    const isLoading = ref(false);
    const error = ref(null);
    const showCreateModal = ref(false);
    const showEditModal = ref(false);
    ref(null);
    const createForm = ref({
      badge_key: "",
      title: "",
      description: "",
      icon_emoji: "🏆",
      category: "activity",
      level: 1,
      threshold_type: "submission_count",
      threshold_value: 1
    });
    const editForm = ref({
      title: "",
      description: "",
      icon_emoji: "",
      category: "",
      level: 1,
      threshold_type: "",
      threshold_value: null,
      is_active: true
    });
    const createErrors = ref({});
    const editErrors = ref({});
    const totalBadgesAwarded = computed(() => {
      return badges.value.reduce((sum, badge) => sum + badge.award_count, 0);
    });
    const activeBadges = computed(() => {
      return badges.value.filter((badge) => badge.is_active);
    });
    const badgesByCategory = computed(() => {
      const grouped = {};
      badges.value.forEach((badge) => {
        const key = String(badge.category || "uncategorized");
        const arr = grouped[key] ?? (grouped[key] = []);
        arr.push(badge);
      });
      return grouped;
    });
    const thresholdTypes = [
      { value: "email_verified", label: "Email Verification", requiresValue: false },
      { value: "submission_count", label: "Submission Count", requiresValue: true },
      { value: "photo_count", label: "Photo Count", requiresValue: true },
      { value: "account_age", label: "Account Age (Days)", requiresValue: true }
    ];
    async function loadBadges() {
      try {
        isLoading.value = true;
        error.value = null;
        badges.value = await adminService.getBadges();
      } catch (err) {
        console.error("Failed to load badges:", err);
        error.value = err instanceof Error ? err.message : "Failed to load badges";
      } finally {
        isLoading.value = false;
      }
    }
    onMounted(async () => {
      await loadBadges();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "space-y-6" }, _attrs))}><div class="flex items-center justify-between"><div><h2 class="text-xl font-semibold text-gray-900 dark:text-white">Badge Management</h2><p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> Manage badge definitions and view award statistics </p></div><button class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"><svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg> Create Badge </button></div>`);
      if (isLoading.value) {
        _push(`<div class="text-center py-12"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div><p class="mt-2 text-gray-600 dark:text-gray-400">Loading badges...</p></div>`);
      } else if (error.value) {
        _push(`<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4"><div class="flex"><div class="flex-shrink-0"><svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg></div><div class="ml-3"><h3 class="text-sm font-medium text-red-800 dark:text-red-200">Error loading badges</h3><p class="mt-1 text-sm text-red-700 dark:text-red-300">${ssrInterpolate(error.value)}</p></div></div></div>`);
      } else {
        _push(`<div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg"><div class="p-5"><div class="flex items-center"><div class="flex-shrink-0"><svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div class="ml-5 w-0 flex-1"><dl><dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"> Total Badges </dt><dd class="text-lg font-medium text-gray-900 dark:text-white">${ssrInterpolate(badges.value.length)}</dd></dl></div></div></div></div><div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg"><div class="p-5"><div class="flex items-center"><div class="flex-shrink-0"><svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg></div><div class="ml-5 w-0 flex-1"><dl><dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"> Active Badges </dt><dd class="text-lg font-medium text-gray-900 dark:text-white">${ssrInterpolate(activeBadges.value.length)}</dd></dl></div></div></div></div><div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg"><div class="p-5"><div class="flex items-center"><div class="flex-shrink-0"><svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path></svg></div><div class="ml-5 w-0 flex-1"><dl><dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"> Total Awarded </dt><dd class="text-lg font-medium text-gray-900 dark:text-white">${ssrInterpolate(totalBadgesAwarded.value.toLocaleString())}</dd></dl></div></div></div></div></div>`);
      }
      if (!isLoading.value && !error.value) {
        _push(`<div class="space-y-6"><!--[-->`);
        ssrRenderList(badgesByCategory.value, (categoryBadges, category) => {
          _push(`<div class="bg-white dark:bg-gray-800 shadow rounded-lg"><div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700"><h3 class="text-lg font-medium text-gray-900 dark:text-white capitalize">${ssrInterpolate(category)} Badges </h3></div><div class="p-6"><div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"><!--[-->`);
          ssrRenderList(categoryBadges, (badge) => {
            _push(`<div class="${ssrRenderClass([{ "opacity-50": !badge.is_active }, "border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"])}"><div class="flex items-start justify-between"><div class="flex items-center space-x-3"><span class="text-2xl">${ssrInterpolate(badge.icon_emoji)}</span><div><h4 class="font-medium text-gray-900 dark:text-white">${ssrInterpolate(badge.title)}</h4><p class="text-sm text-gray-500 dark:text-gray-400">Level ${ssrInterpolate(badge.level)}</p></div></div><div class="flex items-center space-x-2"><button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Edit badge"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>`);
            if (badge.is_active) {
              _push(`<button class="text-red-400 hover:text-red-600" title="Deactivate badge"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div></div><p class="mt-2 text-sm text-gray-600 dark:text-gray-300">${ssrInterpolate(badge.description)}</p><div class="mt-3 flex items-center justify-between text-sm"><span class="text-gray-500 dark:text-gray-400">${ssrInterpolate(badge.threshold_type === "email_verified" ? "Email verification" : `${badge.threshold_value} ${badge.threshold_type.replace("_", " ")}`)}</span><span class="font-medium text-blue-600 dark:text-blue-400">${ssrInterpolate(badge.award_count)} awarded </span></div></div>`);
          });
          _push(`<!--]--></div></div></div>`);
        });
        _push(`<!--]--></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showCreateModal.value) {
        _push(`<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"><div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800"><div class="mt-3"><h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New Badge</h3><form class="space-y-4"><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Badge Key</label><input${ssrRenderAttr("value", createForm.value.badge_key)} type="text" placeholder="unique-badge-key" class="${ssrRenderClass([{ "border-red-500": createErrors.value.badge_key }, "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"])}">`);
        if (createErrors.value.badge_key) {
          _push(`<p class="mt-1 text-sm text-red-600">${ssrInterpolate(createErrors.value.badge_key)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label><input${ssrRenderAttr("value", createForm.value.title)} type="text" class="${ssrRenderClass([{ "border-red-500": createErrors.value.title }, "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"])}">`);
        if (createErrors.value.title) {
          _push(`<p class="mt-1 text-sm text-red-600">${ssrInterpolate(createErrors.value.title)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label><textarea rows="3" class="${ssrRenderClass([{ "border-red-500": createErrors.value.description }, "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"])}">${ssrInterpolate(createForm.value.description)}</textarea>`);
        if (createErrors.value.description) {
          _push(`<p class="mt-1 text-sm text-red-600">${ssrInterpolate(createErrors.value.description)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Icon Emoji</label><input${ssrRenderAttr("value", createForm.value.icon_emoji)} type="text" class="${ssrRenderClass([{ "border-red-500": createErrors.value.icon_emoji }, "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"])}">`);
        if (createErrors.value.icon_emoji) {
          _push(`<p class="mt-1 text-sm text-red-600">${ssrInterpolate(createErrors.value.icon_emoji)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div class="grid grid-cols-2 gap-4"><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label><input${ssrRenderAttr("value", createForm.value.category)} type="text" class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></div><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Level</label><input${ssrRenderAttr("value", createForm.value.level)} type="number" min="1" class="${ssrRenderClass([{ "border-red-500": createErrors.value.level }, "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"])}">`);
        if (createErrors.value.level) {
          _push(`<p class="mt-1 text-sm text-red-600">${ssrInterpolate(createErrors.value.level)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Threshold Type</label><select class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"><!--[-->`);
        ssrRenderList(thresholdTypes, (type) => {
          _push(`<option${ssrRenderAttr("value", type.value)}${ssrIncludeBooleanAttr(Array.isArray(createForm.value.threshold_type) ? ssrLooseContain(createForm.value.threshold_type, type.value) : ssrLooseEqual(createForm.value.threshold_type, type.value)) ? " selected" : ""}>${ssrInterpolate(type.label)}</option>`);
        });
        _push(`<!--]--></select></div>`);
        if (createForm.value.threshold_type !== "email_verified") {
          _push(`<div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Threshold Value</label><input${ssrRenderAttr("value", createForm.value.threshold_value)} type="number" min="1" class="${ssrRenderClass([{ "border-red-500": createErrors.value.threshold_value }, "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"])}">`);
          if (createErrors.value.threshold_value) {
            _push(`<p class="mt-1 text-sm text-red-600">${ssrInterpolate(createErrors.value.threshold_value)}</p>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        if (createErrors.value.general) {
          _push(`<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3"><p class="text-sm text-red-700 dark:text-red-300">${ssrInterpolate(createErrors.value.general)}</p></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="flex justify-end space-x-3 pt-4"><button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"> Cancel </button><button type="submit" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"> Create Badge </button></div></form></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showEditModal.value) {
        _push(`<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"><div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800"><div class="mt-3"><h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Edit Badge</h3><form class="space-y-4"><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label><input${ssrRenderAttr("value", editForm.value.title)} type="text" class="${ssrRenderClass([{ "border-red-500": editErrors.value.title }, "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"])}">`);
        if (editErrors.value.title) {
          _push(`<p class="mt-1 text-sm text-red-600">${ssrInterpolate(editErrors.value.title)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label><textarea rows="3" class="${ssrRenderClass([{ "border-red-500": editErrors.value.description }, "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"])}">${ssrInterpolate(editForm.value.description)}</textarea>`);
        if (editErrors.value.description) {
          _push(`<p class="mt-1 text-sm text-red-600">${ssrInterpolate(editErrors.value.description)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Icon Emoji</label><input${ssrRenderAttr("value", editForm.value.icon_emoji)} type="text" class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></div><div class="grid grid-cols-2 gap-4"><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Level</label><input${ssrRenderAttr("value", editForm.value.level)} type="number" min="1" class="${ssrRenderClass([{ "border-red-500": editErrors.value.level }, "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"])}">`);
        if (editErrors.value.level) {
          _push(`<p class="mt-1 text-sm text-red-600">${ssrInterpolate(editErrors.value.level)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div><label class="flex items-center space-x-2"><input${ssrIncludeBooleanAttr(Array.isArray(editForm.value.is_active) ? ssrLooseContain(editForm.value.is_active, null) : editForm.value.is_active) ? " checked" : ""} type="checkbox" class="rounded border-gray-300 dark:border-gray-600"><span class="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span></label></div></div>`);
        if (editErrors.value.general) {
          _push(`<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3"><p class="text-sm text-red-700 dark:text-red-300">${ssrInterpolate(editErrors.value.general)}</p></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="flex justify-end space-x-3 pt-4"><button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"> Cancel </button><button type="submit" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"> Update Badge </button></div></form></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/BadgeManager.vue");
  return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};

const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "SocialMediaSuggestionCard",
  __ssrInlineRender: true,
  props: {
    suggestion: {}
  },
  emits: ["scheduled"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const ACTIVE_PLATFORMS = ["bluesky", "instagram"];
    const isScheduling = ref(false);
    const error = ref(null);
    const showDatePicker = ref(false);
    const customDate = ref("");
    const editableText = ref({
      bluesky: props.suggestion.suggested_posts.bluesky?.body || "",
      instagram: props.suggestion.suggested_posts.instagram?.body || ""
    });
    const getPhotos = (platform) => {
      const platformPhotos = props.suggestion.suggested_posts[platform]?.photos || [];
      return platformPhotos.slice(0, 4);
    };
    const characterLimits = {
      bluesky: 300,
      instagram: 2200
    };
    const isOverLimit = (platform) => {
      return (editableText.value[platform]?.length || 0) > characterLimits[platform];
    };
    const anyOverLimit = computed(() => {
      return ACTIVE_PLATFORMS.some((platform) => isOverLimit(platform));
    });
    const minDate = computed(() => (/* @__PURE__ */ new Date()).toISOString().split("T")[0] ?? "");
    const previewPhoto = computed(() => {
      const blueskyPhotos = getPhotos("bluesky");
      if (blueskyPhotos.length === 0) return null;
      const photo = blueskyPhotos[0];
      if (!photo) return null;
      return typeof photo === "string" ? photo : photo.url;
    });
    const platformConfig = {
      bluesky: {
        name: "Bluesky",
        icon: "🦋",
        color: "blue"
      },
      instagram: {
        name: "Instagram",
        icon: "📷",
        color: "pink"
      }
    };
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden" }, _attrs))}><div class="p-6"><div class="flex items-start space-x-4 mb-6">`);
      if (previewPhoto.value) {
        _push(`<div class="flex-shrink-0"><img${ssrRenderAttr("src", previewPhoto.value)}${ssrRenderAttr("alt", _ctx.suggestion.artwork.title || "Artwork")} class="w-20 h-20 object-cover rounded"></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="flex-1 min-w-0"><h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate"><a${ssrRenderAttr("href", `/artwork/${_ctx.suggestion.artwork.id}`)} target="_blank" class="hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted" title="Open artwork detail page in new tab">${ssrInterpolate(_ctx.suggestion.artwork.title || "Untitled")} <svg class="inline-block w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a></h3>`);
      if (_ctx.suggestion.artists.length > 0) {
        _push(`<p class="text-sm text-gray-600 dark:text-gray-400">${ssrInterpolate(_ctx.suggestion.artists.map((a) => a.name).join(", "))}</p>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<p class="text-xs text-gray-500 dark:text-gray-500 mt-1"> Created ${ssrInterpolate(new Date(_ctx.suggestion.artwork.created_at).toLocaleDateString())}</p></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"><!--[-->`);
      ssrRenderList(ACTIVE_PLATFORMS, (platform) => {
        _push(`<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"><div class="flex items-center justify-between mb-3"><div class="flex items-center space-x-2"><span class="text-xl">${ssrInterpolate(platformConfig[platform].icon)}</span><h4 class="font-semibold text-gray-900 dark:text-white capitalize">${ssrInterpolate(platformConfig[platform].name)}</h4></div><span class="${ssrRenderClass([
          "text-xs px-2 py-0.5 rounded",
          isOverLimit(platform) ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
        ])}">${ssrInterpolate(editableText.value[platform].length)} / ${ssrInterpolate(characterLimits[platform])}</span></div><textarea rows="18" class="${ssrRenderClass([
          "block w-full rounded-md shadow-sm sm:text-sm",
          isOverLimit(platform) ? "border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500",
          "dark:bg-gray-700 dark:text-white"
        ])}"${ssrRenderAttr("placeholder", `Enter post text for ${platformConfig[platform].name}...`)}>${ssrInterpolate(editableText.value[platform])}</textarea>`);
        if (isOverLimit(platform)) {
          _push(`<p class="mt-1 text-xs text-red-600 dark:text-red-400"> Text exceeds ${ssrInterpolate(characterLimits[platform])} character limit </p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      });
      _push(`<!--]--></div>`);
      if (error.value) {
        _push(`<div class="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3"><p class="text-sm text-red-700 dark:text-red-300">${ssrInterpolate(error.value)}</p></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="flex items-center justify-between"><div class="flex items-center space-x-2"><button${ssrIncludeBooleanAttr(isScheduling.value || anyOverLimit.value) ? " disabled" : ""} class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" title="Schedule both Bluesky and Instagram posts for next available date"><svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg> Schedule Next </button><button${ssrIncludeBooleanAttr(isScheduling.value || anyOverLimit.value) ? " disabled" : ""} class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"><svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> Pick Date </button></div>`);
      if (isScheduling.value) {
        _push(`<div class="flex items-center text-sm text-gray-600 dark:text-gray-400"><svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Scheduling both platforms... </div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
      if (showDatePicker.value) {
        _push(`<div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"> Select Date (will schedule both Bluesky and Instagram) </label><div class="flex items-center space-x-2"><input${ssrRenderAttr("value", customDate.value)} type="date"${ssrRenderAttr("min", minDate.value)} class="block flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"><button${ssrIncludeBooleanAttr(!customDate.value || isScheduling.value) ? " disabled" : ""} class="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"> Schedule Both </button><button class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"> Cancel </button></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div>`);
    };
  }
});

const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/SocialMediaSuggestionCard.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};

const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "SocialMediaScheduleList",
  __ssrInlineRender: true,
  props: {
    schedules: {}
  },
  emits: ["scheduleDeleted", "scheduleUpdated"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const selectedSchedule = ref(null);
    const showModal = ref(false);
    const isDeleting = ref(false);
    const isUpdating = ref(false);
    const isTesting = ref(false);
    const testResult = ref(null);
    const commitResult = ref(false);
    const error = ref(null);
    useToasts();
    const editedBody = ref("");
    const editedDate = ref("");
    const minDate = computed(() => (/* @__PURE__ */ new Date()).toISOString().split("T")[0] ?? "");
    const groupedSchedules = computed(() => {
      const groups = {};
      props.schedules.forEach((schedule) => {
        const date = new Date(schedule.scheduled_date);
        const monthKey = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
        const dayKey = schedule.scheduled_date;
        if (!groups[monthKey]) {
          groups[monthKey] = {};
        }
        if (!groups[monthKey][dayKey]) {
          groups[monthKey][dayKey] = [];
        }
        groups[monthKey][dayKey].push(schedule);
      });
      return groups;
    });
    function formatDayHeader(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric"
      });
    }
    function getPlatformColor(platform) {
      const colors = {
        bluesky: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        instagram: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
        twitter: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
        facebook: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
      };
      return colors[platform] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "space-y-8" }, _attrs))}>`);
      if (_ctx.schedules.length === 0) {
        _push(`<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No scheduled posts</h3><p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> Schedule posts from the Suggestions tab to get started. </p></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<!--[-->`);
      ssrRenderList(groupedSchedules.value, (dateGroups, monthKey) => {
        _push(`<div class="space-y-6"><h3 class="text-xl font-bold text-gray-900 dark:text-white border-b-2 border-gray-300 dark:border-gray-600 pb-2">${ssrInterpolate(monthKey)}</h3><!--[-->`);
        ssrRenderList(dateGroups, (daySchedules, dateKey) => {
          _push(`<div class="space-y-3 ml-4"><h4 class="text-lg font-semibold text-gray-800 dark:text-gray-200">${ssrInterpolate(formatDayHeader(dateKey))}</h4><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><!--[-->`);
          ssrRenderList(daySchedules, (schedule) => {
            _push(`<button class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors p-4 text-left"><div class="flex items-start space-x-3">`);
            if (schedule.artwork?.photos) {
              _push(`<div class="flex-shrink-0"><img${ssrRenderAttr("src", typeof schedule.artwork.photos === "string" ? JSON.parse(schedule.artwork.photos)[0] : schedule.artwork.photos[0])}${ssrRenderAttr("alt", schedule.artwork.title || "Artwork")} class="w-16 h-16 object-cover rounded"></div>`);
            } else {
              _push(`<!---->`);
            }
            _push(`<div class="flex-1 min-w-0"><span class="${ssrRenderClass([
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize mb-2",
              getPlatformColor(schedule.social_type)
            ])}">${ssrInterpolate(schedule.social_type === "bluesky" ? "🦋 Bluesky" : "📷 Instagram")}</span><p class="text-sm font-semibold text-gray-900 dark:text-white truncate mb-1">${ssrInterpolate(schedule.artwork?.title || "Untitled")}</p><p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">${ssrInterpolate(schedule.body)}</p>`);
            if (schedule.status !== "scheduled") {
              _push(`<div class="mt-2"><span class="${ssrRenderClass([
                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                schedule.status === "posted" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              ])}">${ssrInterpolate(schedule.status)}</span></div>`);
            } else {
              _push(`<!---->`);
            }
            _push(`</div></div></button>`);
          });
          _push(`<!--]--></div></div>`);
        });
        _push(`<!--]--></div>`);
      });
      _push(`<!--]-->`);
      if (showModal.value && selectedSchedule.value) {
        _push(`<div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true"><div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"><div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div><span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">​</span><div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"><div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4"><div class="sm:flex sm:items-start mb-4"><div class="mt-3 text-center sm:mt-0 sm:text-left w-full"><h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title"> Edit Scheduled Post </h3><p class="mt-1 text-sm text-gray-500 dark:text-gray-400">${ssrInterpolate(selectedSchedule.value.artwork?.title || "Untitled")}</p></div></div>`);
        if (error.value) {
          _push(`<div class="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3"><p class="text-sm text-red-700 dark:text-red-300">${ssrInterpolate(error.value)}</p></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="space-y-4"><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"> Scheduled Date </label><input${ssrRenderAttr("value", editedDate.value)} type="date"${ssrRenderAttr("min", minDate.value)} class="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"></div><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"> Post Text </label><textarea rows="6" class="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white">${ssrInterpolate(editedBody.value)}</textarea></div></div></div><div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse"><button${ssrIncludeBooleanAttr(isUpdating.value || isDeleting.value) ? " disabled" : ""} type="button" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">${ssrInterpolate(isUpdating.value ? "Saving..." : "Save Changes")}</button><div class="mt-3 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm space-y-2"><label class="inline-flex items-center space-x-2"><input type="checkbox"${ssrIncludeBooleanAttr(Array.isArray(commitResult.value) ? ssrLooseContain(commitResult.value, null) : commitResult.value) ? " checked" : ""} class="form-checkbox h-4 w-4 text-yellow-600"><span class="text-sm text-gray-700 dark:text-gray-200">Commit result</span></label><button${ssrIncludeBooleanAttr(isUpdating.value || isDeleting.value || isTesting.value) ? " disabled" : ""} type="button" class="w-full inline-flex justify-center rounded-md border border-yellow-300 dark:border-yellow-600 shadow-sm px-4 py-2 bg-white dark:bg-yellow-800 text-base font-medium text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:ml-0 sm:w-auto sm:text-sm disabled:opacity-50">${ssrInterpolate(isTesting.value ? "Testing..." : commitResult.value ? "Test & Commit" : "Test Now")}</button></div><button${ssrIncludeBooleanAttr(isUpdating.value || isDeleting.value) ? " disabled" : ""} type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-red-300 dark:border-red-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">${ssrInterpolate(isDeleting.value ? "Deleting..." : "Unschedule")}</button><button${ssrIncludeBooleanAttr(isUpdating.value || isDeleting.value) ? " disabled" : ""} type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"> Cancel </button></div>`);
        if (testResult.value) {
          _push(`<div class="px-6 pb-4"><h5 class="text-sm font-medium text-gray-900 dark:text-white">Test Result</h5><div class="mt-2 text-sm text-gray-700 dark:text-gray-200">`);
          if (testResult.value.data && testResult.value.data.result) {
            _push(`<div>`);
            if (testResult.value.data.result.post_url) {
              _push(`<div><p>Post published:</p><a${ssrRenderAttr("href", testResult.value.data.result.post_url)} target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-300 break-all">${ssrInterpolate(testResult.value.data.result.post_url)}</a></div>`);
            } else if (testResult.value.data.result.error) {
              _push(`<div><p class="font-semibold text-red-700 dark:text-red-300">Error:</p><pre class="mt-2 text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto">${ssrInterpolate(testResult.value.data.result.error)}</pre></div>`);
            } else {
              _push(`<div><pre class="mt-2 text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto">${ssrInterpolate(JSON.stringify(testResult.value.data.result, null, 2))}</pre></div>`);
            }
            _push(`</div>`);
          } else if (testResult.value.result) {
            _push(`<div>`);
            if (testResult.value.result.post_url) {
              _push(`<div><p>Post published:</p><a${ssrRenderAttr("href", testResult.value.result.post_url)} target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-300 break-all">${ssrInterpolate(testResult.value.result.post_url)}</a></div>`);
            } else if (testResult.value.result.error) {
              _push(`<div><p class="font-semibold text-red-700 dark:text-red-300">Error:</p><pre class="mt-2 text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto">${ssrInterpolate(testResult.value.result.error)}</pre></div>`);
            } else {
              _push(`<div><pre class="mt-2 text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto">${ssrInterpolate(JSON.stringify(testResult.value.result, null, 2))}</pre></div>`);
            }
            _push(`</div>`);
          } else {
            _push(`<div><pre class="mt-2 text-xs bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto">${ssrInterpolate(JSON.stringify(testResult.value, null, 2))}</pre></div>`);
          }
          _push(`</div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/SocialMediaScheduleList.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "SocialMediaScheduler",
  __ssrInlineRender: true,
  setup(__props) {
    const activeView = ref("suggestions");
    const suggestions = ref([]);
    const schedules = ref([]);
    const isLoadingSuggestions = ref(false);
    const isLoadingSchedules = ref(false);
    const error = ref(null);
    const currentPage = ref(1);
    const hasMore = ref(true);
    async function loadSuggestions(page = 1) {
      try {
        isLoadingSuggestions.value = true;
        error.value = null;
        const response = await adminService.getSocialMediaSuggestions({
          page,
          per_page: 10
        });
        if (page === 1) {
          suggestions.value = response.suggestions;
        } else {
          suggestions.value.push(...response.suggestions);
        }
        hasMore.value = response.has_more;
        currentPage.value = page;
      } catch (err) {
        console.error("Failed to load suggestions:", err);
        error.value = err instanceof Error ? err.message : "Failed to load suggestions";
      } finally {
        isLoadingSuggestions.value = false;
      }
    }
    async function loadSchedules() {
      try {
        isLoadingSchedules.value = true;
        error.value = null;
        const response = await adminService.getSocialMediaSchedules({
          status: "scheduled",
          per_page: 50
        });
        schedules.value = response.schedules;
      } catch (err) {
        console.error("Failed to load schedules:", err);
        error.value = err instanceof Error ? err.message : "Failed to load schedules";
      } finally {
        isLoadingSchedules.value = false;
      }
    }
    function handleScheduled() {
      loadSuggestions(1);
      loadSchedules();
    }
    function handleScheduleDeleted() {
      loadSchedules();
    }
    onMounted(async () => {
      await loadSuggestions();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "space-y-6" }, _attrs))}><div class="flex items-center justify-between"><div><h2 class="text-2xl font-bold text-gray-900 dark:text-white">Social Media Scheduler</h2><p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> Schedule artwork posts for Bluesky, Instagram, and other platforms </p></div></div><div class="border-b border-gray-200 dark:border-gray-700"><nav class="-mb-px flex space-x-8" aria-label="Scheduler sections"><button class="${ssrRenderClass([
        activeView.value === "suggestions" ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300",
        "whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
      ])}"> Suggestions (${ssrInterpolate(suggestions.value.length)}) </button><button class="${ssrRenderClass([
        activeView.value === "schedule" ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300",
        "whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
      ])}"> Scheduled Posts (${ssrInterpolate(schedules.value.length)}) </button></nav></div>`);
      if (error.value) {
        _push(`<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4"><div class="flex"><div class="flex-shrink-0"><svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg></div><div class="ml-3"><p class="text-sm text-red-700 dark:text-red-300">${ssrInterpolate(error.value)}</p></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (activeView.value === "suggestions") {
        _push(`<div class="space-y-6">`);
        if (isLoadingSuggestions.value && suggestions.value.length === 0) {
          _push(`<div class="text-center py-12"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div><p class="mt-2 text-gray-600 dark:text-gray-400">Loading suggestions...</p></div>`);
        } else if (!isLoadingSuggestions.value && suggestions.value.length === 0) {
          _push(`<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg><h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No suggestions found</h3><p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> All eligible artworks have been posted, or none meet the criteria. </p></div>`);
        } else {
          _push(`<div class="space-y-6"><!--[-->`);
          ssrRenderList(suggestions.value, (suggestion, index) => {
            _push(ssrRenderComponent(_sfc_main$3, {
              key: `${suggestion.artwork.id}-${index}`,
              suggestion,
              onScheduled: handleScheduled
            }, null, _parent));
          });
          _push(`<!--]-->`);
          if (hasMore.value) {
            _push(`<div class="text-center pt-4"><button${ssrIncludeBooleanAttr(isLoadingSuggestions.value) ? " disabled" : ""} class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">`);
            if (isLoadingSuggestions.value) {
              _push(`<svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`);
            } else {
              _push(`<!---->`);
            }
            _push(` ${ssrInterpolate(isLoadingSuggestions.value ? "Loading..." : "Load More")}</button></div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
        }
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      if (activeView.value === "schedule") {
        _push(`<div class="space-y-6">`);
        if (isLoadingSchedules.value) {
          _push(`<div class="text-center py-12"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div><p class="mt-2 text-gray-600 dark:text-gray-400">Loading schedules...</p></div>`);
        } else {
          _push(ssrRenderComponent(_sfc_main$2, {
            schedules: schedules.value,
            onScheduleDeleted: handleScheduleDeleted,
            onScheduleUpdated: loadSchedules
          }, null, _parent));
        }
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/SocialMediaScheduler.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "AdminView",
  __ssrInlineRender: true,
  setup(__props) {
    const authStore = useAuthStore();
    const statistics = ref(null);
    const isLoading = ref(false);
    const error = ref(null);
    const activeTab = ref("permissions");
    const tabs = [
      { id: "permissions", name: "Permission Management" },
      { id: "audit", name: "Audit Logs" },
      { id: "badges", name: "Badge Management" },
      { id: "social-media", name: "Social Media" }
      // Data Dumps feature removed
    ];
    const hasAdminAccess = computed(() => authStore.isAdmin);
    async function loadData() {
      if (!hasAdminAccess.value) {
        error.value = "Access denied. Admin permissions required.";
        return;
      }
      try {
        isLoading.value = true;
        error.value = null;
        const stats = await adminService.getStatistics(30);
        statistics.value = stats;
      } catch (err) {
        console.error("Failed to load admin data:", err);
        error.value = err instanceof Error ? err.message : "Failed to load admin dashboard";
      } finally {
        isLoading.value = false;
      }
    }
    async function refreshData() {
      await loadData();
    }
    onMounted(async () => {
      await loadData();
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-gray-50 dark:bg-gray-900" }, _attrs))}><div class="bg-white dark:bg-gray-800 shadow"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="py-6"><div class="flex items-center justify-between"><div><h1 class="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1><p class="mt-1 text-sm text-gray-500 dark:text-gray-400"> Manage user permissions and view system audit logs </p></div><div class="flex items-center space-x-4"><button${ssrIncludeBooleanAttr(isLoading.value) ? " disabled" : ""} class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"${ssrRenderAttr("aria-label", isLoading.value ? "Refreshing data..." : "Refresh data")}><svg class="${ssrRenderClass([{ "animate-spin": isLoading.value }, "w-4 h-4 mr-2"])}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> ${ssrInterpolate(isLoading.value ? "Refreshing..." : "Refresh")}</button></div></div></div></div></div><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">`);
      if (isLoading.value && !statistics.value) {
        _push(`<div class="text-center py-12"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div><p class="mt-2 text-gray-600 dark:text-gray-400">Loading admin dashboard...</p></div>`);
      } else if (error.value) {
        _push(`<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6"><div class="flex"><div class="flex-shrink-0"><svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg></div><div class="ml-3"><h3 class="text-sm font-medium text-red-800 dark:text-red-200"> Error loading admin dashboard </h3><p class="mt-1 text-sm text-red-700 dark:text-red-300">${ssrInterpolate(error.value)}</p></div></div></div>`);
      } else {
        _push(`<div class="space-y-8">`);
        if (statistics.value) {
          _push(`<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg"><div class="p-5"><div class="flex items-center"><div class="flex-shrink-0"><svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div class="ml-5 w-0 flex-1"><dl><dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"> Total Decisions </dt><dd class="text-lg font-medium text-gray-900 dark:text-white">${ssrInterpolate((statistics.value.total_decisions ?? 0).toLocaleString())}</dd></dl></div></div></div></div><div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg"><div class="p-5"><div class="flex items-center"><div class="flex-shrink-0"><svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"></path></svg></div><div class="ml-5 w-0 flex-1"><dl><dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"> Active Moderators </dt><dd class="text-lg font-medium text-gray-900 dark:text-white">${ssrInterpolate(statistics.value.active_moderators)}</dd></dl></div></div></div></div><div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg"><div class="p-5"><div class="flex items-center"><div class="flex-shrink-0"><svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg></div><div class="ml-5 w-0 flex-1"><dl><dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"> Active Admins </dt><dd class="text-lg font-medium text-gray-900 dark:text-white">${ssrInterpolate(statistics.value.active_admins)}</dd></dl></div></div></div></div><div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg"><div class="p-5"><div class="flex items-center"><div class="flex-shrink-0"><svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg></div><div class="ml-5 w-0 flex-1"><dl><dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate"> Admin Actions </dt><dd class="text-lg font-medium text-gray-900 dark:text-white">${ssrInterpolate((statistics.value.total_admin_actions ?? 0).toLocaleString())}</dd></dl></div></div></div></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="border-b border-gray-200 dark:border-gray-700"><nav class="-mb-px flex space-x-8" aria-label="Admin sections"><!--[-->`);
        ssrRenderList(tabs, (tab) => {
          _push(`<button${ssrRenderAttrs(mergeProps({
            key: tab.id,
            class: [
              activeTab.value === tab.id ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300",
              "whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            ]
          }, { ref_for: true }, activeTab.value === tab.id ? { "aria-current": "page" } : {}))}>${ssrInterpolate(tab.name)}</button>`);
        });
        _push(`<!--]--></nav></div><div class="mt-8">`);
        if (activeTab.value === "permissions") {
          _push(`<div class="space-y-6">`);
          _push(ssrRenderComponent(_sfc_main$6, { onPermissionChanged: refreshData }, null, _parent));
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        if (activeTab.value === "audit") {
          _push(`<div class="space-y-6">`);
          _push(ssrRenderComponent(_sfc_main$5, null, null, _parent));
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        if (activeTab.value === "badges") {
          _push(`<div class="space-y-6">`);
          _push(ssrRenderComponent(_sfc_main$4, null, null, _parent));
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        if (activeTab.value === "social-media") {
          _push(`<div class="space-y-6">`);
          _push(ssrRenderComponent(_sfc_main$1, null, null, _parent));
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      }
      _push(`</div></div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/AdminView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=AdminView-BUpqcoKK.js.map
