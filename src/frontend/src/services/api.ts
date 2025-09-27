/**
 * API service layer for Cultural Archiver frontend
 * Handles all HTTP communication with the backend API
 */

import type {
  MagicLinkRequest,
  ApiResponse,
  PaginatedResponse,
  StatusResponse,
  SubmissionResponse,
  GetPermissionsResponse,
  GrantPermissionRequest,
  RevokePermissionRequest,
  PermissionResponse,
  AuditLogQuery,
  AuditLogsResponse,
  AuditStatistics,
  NearbyArtworksResponse,
  ArtworkEditReviewData,
  UserSubmissionsResponse,
  BadgeListResponse,
  UserBadgeResponse,
  ProfileUpdateRequest,
  ProfileUpdateResponse,
  ProfileNameCheckResponse,
  NotificationListResponse,
  NotificationUnreadCountResponse,
  NotificationActionResponse,
} from '../../../shared/types';
import type { BadgeRecord } from '../types';
import type { UserProfile, ReviewQueueItem, ReviewStats, ArtworkDetails } from '../types';
import { getApiBaseUrl } from '../utils/api-config';

// Local type definitions for missing shared types
interface LogbookSubmission {
  lat: number;
  lon: number;
  note?: string;
  type?: string;
  artworkId?: string;
  photos: File[];
}

interface MagicLinkConsumeRequest {
  token: string;
}

// Configuration
const API_BASE_URL = getApiBaseUrl();
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000;

/**
 * API Error class for handling structured error responses
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * HTTP client with proper error handling and token management
 */
class ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor(baseURL: string, timeout: number) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }

  /**
   * Get user token from localStorage
   */
  private getUserToken(): string | null {
    const token = localStorage.getItem('user-token');
    console.log('[API DEBUG] Getting user token from localStorage:', {
      token: token,
      timestamp: new Date().toISOString(),
    });
    return token;
  }

  /**
   * Set user token in localStorage
   */
  private setUserToken(token: string): void {
    console.log('[API DEBUG] Setting user token in localStorage:', {
      token: token,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('user-token', token);
  }

  /**
   * Create request headers with authentication
   */
  private createHeaders(customHeaders: Record<string, string> = {}): Headers {
    // Do not set a default Content-Type here; let request() decide so FormData can set its own.
    const headers = new Headers({
      ...customHeaders,
    });
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getUserToken();
    console.log('[API DEBUG] Creating request headers:', {
      hasToken: !!token,
      token: token,
      customHeaders: Object.keys(customHeaders),
    });

    if (token) {
      headers.set('X-User-Token', token);
    }

    return headers;
  }

  /**
   * Handle API response and extract data
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    // Update user token if provided in response
    const newToken = response.headers.get('X-User-Token');
    console.log('[API DEBUG] Handling response:', {
      status: response.status,
      statusText: response.statusText,
      hasNewToken: !!newToken,
      newToken: newToken,
      url: response.url,
    });

    if (newToken) {
      console.log('[API DEBUG] Response contains new token, updating localStorage');
      this.setUserToken(newToken);
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      let errorData: Record<string, unknown> = { message: response.statusText };

      if (isJson) {
        try {
          errorData = await response.json();
        } catch {
          // Fallback to status text if JSON parsing fails
        }
      }

      throw new ApiError(
        String(errorData.code || 'API_ERROR'),
        response.status,
        String(errorData.message || `HTTP ${response.status}: ${response.statusText}`),
        errorData
      );
    }

    if (!isJson) {
      throw new ApiError('INVALID_RESPONSE', 500, 'Expected JSON response from API');
    }

    return response.json();
  }

  /**
   * Make HTTP request with timeout and error handling
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    // Enhanced diagnostic logging
    console.log('[ApiClient.request] Constructing URL:', {
      baseURL: this.baseURL,
      endpoint: endpoint,
      fullURL: url,
      method: options.method || 'GET',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log('[ApiClient.request] Making fetch request to:', url);
      const headers = this.createHeaders(options.headers as Record<string, string>);
      // If body is FormData remove any JSON content type so browser sets proper multipart boundary
      if (options.body instanceof FormData) {
        headers.delete('Content-Type');
      }
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      console.log('[ApiClient.request] Response received:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries()),
      });

      clearTimeout(timeoutId);
      return this.handleResponse<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);

      console.error('[ApiClient.request] Fetch error:', {
        error: error,
        url: url,
        isNetworkError: error instanceof TypeError,
        isAbortError: error instanceof DOMException && error.name === 'AbortError',
      });

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 408, 'Request timeout');
      }

      throw new ApiError('NETWORK_ERROR', 0, 'Network error occurred');
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    // Log the current API configuration
    console.log(
      '[ApiClient.get] API Base URL:',
      this.baseURL,
      'endpoint:',
      endpoint,
      'params:',
      params
    );

    let requestEndpoint = endpoint;
    if (params) {
      const url = new URL(endpoint, 'http://dummy.com');
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      requestEndpoint = url.pathname + url.search;
    }

    return this.request<T>(requestEndpoint);
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    data?: unknown,
    customHeaders?: Record<string, string>
  ): Promise<T> {
    const headers = data instanceof FormData ? customHeaders || {} : { ...customHeaders };

    return this.request<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
      headers,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, data?: unknown): Promise<T> {
    const options: RequestInit = { method: 'DELETE' };
    if (data) {
      options.body = JSON.stringify(data);
    }
    return this.request<T>(endpoint, options);
  }
}

// Create singleton client instance
const client = new ApiClient(API_BASE_URL, API_TIMEOUT);

/**
 * API service methods
 */
export const apiService = {
  // ================================
  // Health & Status
  // ================================

  /**
   * Check API health status
   */
  async getStatus(): Promise<ApiResponse<StatusResponse>> {
    return client.get('/status');
  },
  // Low-level passthrough for raw FormData posts to uncovered endpoints
  async postRaw<T>(endpoint: string, formData: FormData): Promise<T> {
    // @ts-ignore access underlying client
    return client.post<T>(endpoint, formData, {});
  },

  /**
   * Generate anonymous user token (using status endpoint)
   */
  async generateToken(): Promise<ApiResponse<{ token: string }>> {
    // Call the status endpoint to trigger token generation
    // The token will be automatically extracted and stored by handleResponse
    await client.get('/status');
    const token = localStorage.getItem('user-token') || '';
    return {
      data: { token },
      message: 'Token generated successfully',
      success: true,
      timestamp: new Date().toISOString(),
    };
  },

  // ================================
  // Submission Endpoints
  // ================================

  /**
   * Create new logbook submission
   */
  async createSubmission(submission: LogbookSubmission): Promise<ApiResponse<SubmissionResponse>> {
    const formData = new FormData();

    // Add form fields
    formData.append('lat', submission.lat.toString());
    formData.append('lon', submission.lon.toString());

    // Use 'notes' field name (accept legacy 'note' elsewhere)
    if (submission.note) {
      formData.append('notes', submission.note);
    }

    if (submission.type) {
      formData.append('type', submission.type);
    }

    if (submission.artworkId) {
      formData.append('artworkId', submission.artworkId);
    }

    // Add photo files
    submission.photos.forEach((photo: File) => {
      formData.append(`photos`, photo);
    });

    return client.post('/logbook', formData, {});
  },

  // ================================
  // Discovery Endpoints
  // ================================

  /**
   * Get nearby artworks
   */
  async getNearbyArtworks(
    lat: number,
    lon: number,
    radius: number = 500,
    limit: number = 250,
    options?: { minimal?: boolean }
  ): Promise<ApiResponse<NearbyArtworksResponse>> {
    const params: Record<string, string> = {
      lat: lat.toString(),
      lon: lon.toString(),
      radius: radius.toString(),
      limit: limit.toString(),
    };
    if (options?.minimal) {
      params.minimal = 'true';
    }
    return client.get('/artworks/nearby', params);
  },

  /**
   * Get artwork details by ID
   */
  async getArtworkDetails(id: string): Promise<ArtworkDetails> {
    const response = await client.get<ApiResponse<ArtworkDetails>>(`/artworks/${id}`);
    if (!response.data) {
      throw new Error(`Artwork with ID ${id} not found`);
    }
    return response.data;
  },

  /**
   * Submit artwork edits
   */
  async submitArtworkEdit(
    artworkId: string,
    edits: Array<{
      field_name: string;
      field_value_old: string;
      field_value_new: string;
    }>
  ): Promise<
    ApiResponse<{
      message: string;
      edit_id: string;
    }>
  > {
    return client.post(`/artwork/${artworkId}/edit`, {
      edits,
    });
  },

  /**
   * Check pending edits for an artwork
   */
  async getPendingEdits(artworkId: string): Promise<
    ApiResponse<{
      has_pending_edits: boolean;
      pending_fields: string[];
    }>
  > {
    return client.get(`/artwork/${artworkId}/pending-edits`);
  },

  /**
   * Validate artwork edits without submitting
   */
  async validateArtworkEdit(
    artworkId: string,
    edits: Array<{
      field_name: string;
      field_value_old: string;
      field_value_new: string;
    }>
  ): Promise<
    ApiResponse<{
      valid: boolean;
      errors?: string[];
    }>
  > {
    return client.post(`/artwork/${artworkId}/edit/validate`, {
      edits,
    });
  },

  // ================================
  // Index Pages Endpoints
  // ================================

  /**
   * Get paginated list of all approved artworks
   */
  async getArtworksList(
    page: number = 1,
    limit: number = 30,
    sort: 'updated_desc' | 'title_asc' | 'created_desc' = 'updated_desc'
  ): Promise<
    ApiResponse<{
      totalItems: number;
      currentPage: number;
      totalPages: number;
      items: Array<import('../../../shared/types').ArtworkApiResponse>;
    }>
  > {
    return client.get('/artworks', {
      page: page.toString(),
      limit: limit.toString(),
      sort,
    });
  },

  /**
   * Get paginated list of all active artists
   */
  async getArtistsList(
    page: number = 1,
    limit: number = 30,
    sort: 'updated_desc' | 'name_asc' | 'created_desc' = 'updated_desc',
    search?: string
  ): Promise<
    ApiResponse<{
      totalItems: number;
      currentPage: number;
      totalPages: number;
      items: Array<import('../../../shared/types').ArtistApiResponse>;
    }>
  > {
    const params: Record<string, string> = {
      page: page.toString(),
      limit: limit.toString(),
      sort,
    };

    if (search && search.trim()) {
      params.search = search.trim();
    }

    return client.get('/artists', params);
  },

  // ================================
  // Search Endpoints
  // ================================

  /**
   * Search artworks by text query
   */
  async searchArtworks(
    query: string,
    page: number = 1,
    perPage: number = 20,
    status: 'approved' | 'pending' | 'removed' = 'approved'
  ): Promise<
    ApiResponse<{
      artworks: unknown[];
      pagination: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
        has_more: boolean;
      };
      query: {
        original: string;
        sanitized: string;
      };
      suggestions?: string[];
    }>
  > {
    return client.get('/search', {
      q: query,
      page: page.toString(),
      per_page: perPage.toString(),
      status,
    });
  },

  /**
   * Get search suggestions for autocomplete
   */
  async getSearchSuggestions(
    query: string,
    limit: number = 5
  ): Promise<
    ApiResponse<{
      suggestions: string[];
    }>
  > {
    return client.get('/search/suggestions', {
      q: query,
      limit: limit.toString(),
    });
  },

  // ================================
  // User Management Endpoints
  // ================================

  /**
   * Get user submissions
   */
  async getUserSubmissions(): Promise<ApiResponse<UserSubmissionsResponse>> {
    // Align with backend route defined at GET /api/me/submissions
    return client.get('/me/submissions');
  },

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<ApiResponse<UserProfile>> {
    return client.get('/me/profile');
  },

  // ================================
  // Badge System Endpoints
  // ================================

  /**
   * Get all available badge definitions (public endpoint)
   */
  async getAllBadges(): Promise<ApiResponse<BadgeListResponse>> {
    return client.get('/badges');
  },

  /**
   * Get current user's earned badges
   */
  async getUserBadges(): Promise<ApiResponse<UserBadgeResponse>> {
    return client.get('/me/badges');
  },

  /**
   * Update user's profile name
   */
  async updateProfileName(
    request: ProfileUpdateRequest
  ): Promise<ApiResponse<ProfileUpdateResponse>> {
    return client.patch('/me/profile', request);
  },

  /**
   * Check if a profile name is available
   */
  async checkProfileNameAvailability(
    profileName: string
  ): Promise<ApiResponse<ProfileNameCheckResponse>> {
    return client.get('/me/profile-check', { profile_name: profileName });
  },

  /**
   * Get public user profile by UUID
   */
  async getPublicUserProfile(uuid: string): Promise<
    ApiResponse<{
      uuid: string;
      profile_name: string;
      badges: Array<{
        badge: any;
        awarded_at: string;
        award_reason: string;
        metadata?: Record<string, unknown>;
      }>;
      member_since: string;
    }>
  > {
    return client.get(`/users/${uuid}`);
  },

  // ================================
  // Authentication Endpoints (Updated for new backend API)
  // ================================

  /**
   * Request magic link for email verification or login
   */
  async requestMagicLink(request: MagicLinkRequest): Promise<
    ApiResponse<{
      message: string;
      email: string;
      is_signup: boolean;
      rate_limit_remaining?: number;
      rate_limit_reset_at?: string;
    }>
  > {
    return client.post('/auth/request-magic-link', request);
  },

  /**
   * Verify and consume magic link token
   */
  async verifyMagicLink(request: MagicLinkConsumeRequest): Promise<
    ApiResponse<{
      success: boolean;
      message: string;
      user: {
        uuid: string;
        email: string;
        created_at: string;
        email_verified_at: string;
      };
      session: {
        token: string;
        expires_at: string;
      };
      uuid_replaced: boolean;
      is_new_account: boolean;
    }>
  > {
    return client.post('/auth/verify-magic-link', request);
  },

  /**
   * Get current authentication status
   */
  async getAuthStatus(): Promise<
    ApiResponse<{
      user_token: string;
      is_authenticated: boolean;
      is_anonymous: boolean;
      user?: {
        uuid: string;
        email: string;
        created_at: string;
        last_login?: string | null;
        email_verified_at?: string | null;
        status: string;
      } | null;
      session?: {
        token: string;
        expires_at: string;
        created_at: string;
      } | null;
    }>
  > {
    return client.get('/auth/status');
  },

  /**
   * Logout and get new anonymous token
   */
  async logout(): Promise<
    ApiResponse<{
      success: boolean;
      message: string;
      new_user_token: string;
    }>
  > {
    return client.post('/auth/logout');
  },

  // ================================
  // Review/Moderation Endpoints
  // ================================

  /**
   * Get review queue
   */
  async getReviewQueue(
    status?: string,
    type?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<ReviewQueueItem[]>> {
    const params: Record<string, string> = {
      page: page.toString(),
      limit: limit.toString(),
    };

    if (status) {
      params.status = status;
    }

    if (type) {
      params.type = type;
    }

    return client.get('/review/queue', params);
  },

  /**
   * Get submission for review
   */
  async getSubmissionForReview(id: string): Promise<ApiResponse<ReviewQueueItem>> {
    return client.get(`/review/submission/${id}`);
  },

  /**
   * Approve submission with action
   */
  async approveSubmissionWithAction(
    id: string,
    body: { action: string; artwork_id?: string; overrides?: Record<string, unknown> }
  ): Promise<ApiResponse<{ message: string }>> {
    return client.post(`/review/approve/${id}`, body);
  },

  /**
   * Reject submission
   */
  async rejectSubmission(id: string, reason?: string): Promise<ApiResponse<{ message: string }>> {
    return client.post(`/review/reject/${id}`, { reason });
  },

  /**
   * Get review statistics
   */
  async getReviewStats(): Promise<ApiResponse<ReviewStats>> {
    return client.get('/review/stats');
  },

  /**
   * Process batch review
   */
  async processBatchReview(
    batch: unknown[]
  ): Promise<ApiResponse<{ processed: number; message: string }>> {
    return client.put('/review/batch', { batch });
  },

  /**
   * Get artwork edits for moderation
   */
  async getArtworkEdits(
    page?: number,
    per_page?: number
  ): Promise<PaginatedResponse<ArtworkEditReviewData[]>> {
    const params: Record<string, string> = {};
    if (page) params.page = page.toString();
    if (per_page) params.per_page = per_page.toString();

    return client.get('/review/artwork-edits', params);
  },

  /**
   * Get specific artwork edit for detailed review
   */
  async getArtworkEditForReview(editId: string): Promise<ApiResponse<ArtworkEditReviewData>> {
    return client.get(`/review/artwork-edits/${editId}`);
  },

  /**
   * Approve artwork edit
   */
  async approveArtworkEdit(
    editId: string,
    applyToArtwork = true
  ): Promise<ApiResponse<{ message: string }>> {
    return client.post(`/review/artwork-edits/${editId}/approve`, {
      apply_to_artwork: applyToArtwork,
    });
  },

  /**
   * Reject artwork edit
   */
  async rejectArtworkEdit(
    editId: string,
    reason: string
  ): Promise<ApiResponse<{ message: string }>> {
    return client.post(`/review/artwork-edits/${editId}/reject`, { reason });
  },

  // ================================
  // Admin Endpoints
  // ================================

  /**
   * Get users with permissions
   */
  async getAdminPermissions(
    permission?: string,
    search?: string
  ): Promise<ApiResponse<GetPermissionsResponse>> {
    const params: Record<string, string> = {};
    if (permission) {
      params.permission = permission;
    }
    if (search && search.trim()) {
      params.search = search.trim();
    }
    return client.get('/admin/permissions', params);
  },

  /**
   * Grant permission to user
   */
  async grantAdminPermission(
    request: GrantPermissionRequest
  ): Promise<ApiResponse<PermissionResponse>> {
    return client.post('/admin/permissions/grant', request);
  },

  /**
   * Revoke permission from user
   */
  async revokeAdminPermission(
    request: RevokePermissionRequest
  ): Promise<ApiResponse<PermissionResponse>> {
    return client.post('/admin/permissions/revoke', request);
  },

  /**
   * Get audit logs
   */
  async getAdminAuditLogs(filters: AuditLogQuery): Promise<ApiResponse<AuditLogsResponse>> {
    const params: Record<string, string> = {};

    if (filters.type) params.type = filters.type;
    if (filters.actor) params.actor = filters.actor;
    if (filters.decision) params.decision = filters.decision;
    if (filters.action_type) params.action_type = filters.action_type;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.page) params.page = filters.page.toString();
    if (filters.limit) params.limit = filters.limit.toString();

    return client.get('/admin/audit', params);
  },

  /**
   * Get admin statistics
   */
  async getAdminStatistics(days: number = 30): Promise<ApiResponse<AuditStatistics>> {
    return client.get('/admin/statistics', { days: days.toString() });
  },

  /**
   * Get all badges with statistics (admin only)
   */
  async getAdminBadges(): Promise<
    ApiResponse<{
      badges: Array<BadgeRecord & { award_count: number }>;
      total: number;
      retrieved_at: string;
    }>
  > {
    return client.get('/admin/badges');
  },

  /**
   * Create a new badge (admin only)
   */
  async createAdminBadge(badge: {
    badge_key: string;
    title: string;
    description: string;
    icon_emoji: string;
    category: string;
    level: number;
    threshold_type: string;
    threshold_value: number | null;
  }): Promise<ApiResponse<BadgeRecord>> {
    return client.post('/admin/badges', badge);
  },

  /**
   * Update an existing badge (admin only)
   */
  async updateAdminBadge(
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
  ): Promise<ApiResponse<BadgeRecord>> {
    return client.put(`/admin/badges/${badgeId}`, updates);
  },

  /**
   * Deactivate a badge (admin only)
   */
  async deactivateAdminBadge(
    badgeId: string
  ): Promise<ApiResponse<{ badge_id: string; deactivated_at: string }>> {
    return client.delete(`/admin/badges/${badgeId}`);
  },

  // ================================
  // NOTIFICATION SYSTEM ENDPOINTS
  // ================================

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    options: {
      limit?: number;
      offset?: number;
      unread_only?: boolean;
    } = {}
  ): Promise<ApiResponse<NotificationListResponse>> {
    const params = new URLSearchParams();

    if (options.limit !== undefined) {
      params.append('limit', options.limit.toString());
    }
    if (options.offset !== undefined) {
      params.append('offset', options.offset.toString());
    }
    if (options.unread_only !== undefined) {
      params.append('unread_only', options.unread_only.toString());
    }

    const queryString = params.toString();
    const url = `/me/notifications${queryString ? `?${queryString}` : ''}`;

    return client.get(url);
  },

  /**
   * Get unread notification count
   */
  async getNotificationUnreadCount(): Promise<ApiResponse<NotificationUnreadCountResponse>> {
    return client.get('/me/notifications/unread-count');
  },

  /**
   * Dismiss/mark notification as read
   */
  async dismissNotification(
    notificationId: string
  ): Promise<ApiResponse<NotificationActionResponse>> {
    return client.post(`/me/notifications/${notificationId}/dismiss`);
  },

  /**
   * Mark notification as read (alias for dismiss)
   */
  async markNotificationRead(
    notificationId: string
  ): Promise<ApiResponse<NotificationActionResponse>> {
    return client.post(`/me/notifications/${notificationId}/read`);
  },

  // ================================
  // Lists Management
  // ================================

  /**
   * Get user's lists
   */
  async getUserLists(): Promise<ApiResponse<any[]>> {
    return client.get('/me/lists');
  },

  /**
   * Create a new list
   */
  async createList(name: string): Promise<ApiResponse<{ id: string; name: string; created_at: string }>> {
    return client.post('/lists', { name });
  },

  /**
   * Get list details with items
   */
  async getListDetails(listId: string, page = 1, limit = 50): Promise<ApiResponse<any>> {
    return client.get(`/lists/${listId}`, { 
      page: page.toString(), 
      limit: limit.toString() 
    });
  },

  /**
   * Add artwork to list
   */
  async addArtworkToList(listId: string, artworkId: string): Promise<ApiResponse<{ message: string; item_id: string }>> {
    return client.post(`/lists/${listId}/items`, { artwork_id: artworkId });
  },

  /**
   * Remove artworks from list (bulk operation)
   */
  async removeArtworksFromList(listId: string, artworkIds: string[]): Promise<ApiResponse<{ message: string; removed_count: number }>> {
    return client.delete(`/lists/${listId}/items`, { artwork_ids: artworkIds });
  },

  /**
   * Delete list
   */
  async deleteList(listId: string): Promise<ApiResponse<{ message: string }>> {
    return client.delete(`/lists/${listId}`);
  },
};

// Utility functions for error handling
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

export function isNetworkError(error: unknown): boolean {
  return isApiError(error) && (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT');
}

export function isUnauthorized(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}

export function isRateLimited(error: unknown): boolean {
  return isApiError(error) && error.status === 429;
}
