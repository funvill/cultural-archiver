import { renderToString } from '@vue/server-renderer';
import { ref, computed, onMounted, onUnmounted, watch, defineComponent, unref, useSSRContext, mergeProps, toRefs, resolveComponent, withCtx, createVNode, resolveDynamicComponent, createBlock, createCommentVNode, openBlock, toDisplayString, nextTick, onErrorCaptured, reactive, provide, createSSRApp } from 'vue';
import { useRouter, useRoute, RouterLink, RouterView, createRouter, createWebHistory, createMemoryHistory } from 'vue-router';
import { defineStore, createPinia } from 'pinia';
import { createHead } from '@vueuse/head';
import { ssrRenderTeleport, ssrInterpolate, ssrRenderAttr, ssrRenderClass, ssrIncludeBooleanAttr, ssrRenderAttrs, ssrRenderList, ssrRenderComponent, ssrRenderStyle, ssrRenderVNode, ssrRenderSlot, ssrGetDynamicModelProps } from 'vue/server-renderer';
import 'exifr';
import { Bars3Icon, ChatBubbleLeftRightIcon, BellIcon, MapIcon, UserIcon, ArrowRightOnRectangleIcon, PhotoIcon, UserGroupIcon, MagnifyingGlassIcon, QuestionMarkCircleIcon, BookOpenIcon, ShieldCheckIcon, ClipboardDocumentListIcon, ArrowLeftOnRectangleIcon, XMarkIcon, CameraIcon as CameraIcon$1, PencilSquareIcon, StarIcon } from '@heroicons/vue/24/outline';
import { CameraIcon } from '@heroicons/vue/24/solid';

function useGeolocation() {
  const position = ref(null);
  const error = ref(null);
  const isLoading = ref(false);
  const isWatching = ref(false);
  const watchId = ref(null);
  const hasLocation = computed(() => !!position.value);
  const hasPermission = computed(() => hasLocation.value && !error.value);
  const FALLBACK_COORDINATES = {
    latitude: 49.2827,
    longitude: -123.1207
  };
  const getCurrentPosition = async () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const errorMsg = "Geolocation is not supported by this browser";
        error.value = errorMsg;
        reject(new Error(errorMsg));
        return;
      }
      isLoading.value = true;
      error.value = null;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
          position.value = coords;
          isLoading.value = false;
          resolve(coords);
        },
        (err) => {
          isLoading.value = false;
          let errorMsg = "Failed to get location";
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMsg = "Location access denied by user";
              break;
            case err.POSITION_UNAVAILABLE:
              errorMsg = "Location information unavailable";
              break;
            case err.TIMEOUT:
              errorMsg = "Location request timed out";
              break;
          }
          error.value = errorMsg;
          reject(new Error(errorMsg));
        },
        {
          enableHighAccuracy: true,
          timeout: 1e4,
          maximumAge: 3e5
          // 5 minutes
        }
      );
    });
  };
  const watchPosition = () => {
    if (!navigator.geolocation || isWatching.value) {
      return;
    }
    isWatching.value = true;
    error.value = null;
    watchId.value = navigator.geolocation.watchPosition(
      (pos) => {
        position.value = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        };
      },
      (err) => {
        let errorMsg = "Failed to watch location";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMsg = "Location access denied";
            stopWatching();
            break;
          case err.POSITION_UNAVAILABLE:
            errorMsg = "Location unavailable";
            break;
          case err.TIMEOUT:
            errorMsg = "Location timeout";
            break;
        }
        error.value = errorMsg;
      },
      {
        enableHighAccuracy: true,
        timeout: 15e3,
        maximumAge: 6e4
        // 1 minute
      }
    );
  };
  const stopWatching = () => {
    if (watchId.value !== null) {
      navigator.geolocation.clearWatch(watchId.value);
      watchId.value = null;
    }
    isWatching.value = false;
  };
  const getLocationWithFallback = async () => {
    try {
      return await getCurrentPosition();
    } catch (err) {
      console.warn("Geolocation failed, using fallback coordinates:", err);
      position.value = FALLBACK_COORDINATES;
      return FALLBACK_COORDINATES;
    }
  };
  const calculateDistance = (coord1, coord2) => {
    const R = 6371e3;
    const φ1 = coord1.latitude * Math.PI / 180;
    const φ2 = coord2.latitude * Math.PI / 180;
    const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  const isWithinRadius = (center, point, radiusMeters) => {
    return calculateDistance(center, point) <= radiusMeters;
  };
  const formatCoordinates = (coords) => {
    return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
  };
  const isSupported = computed(() => "geolocation" in navigator);
  const clearError = () => {
    error.value = null;
  };
  return {
    // State
    position,
    error,
    isLoading,
    isWatching,
    hasLocation,
    hasPermission,
    isSupported,
    // Actions
    getCurrentPosition,
    watchPosition,
    stopWatching,
    getLocationWithFallback,
    clearError,
    // Utilities
    calculateDistance,
    isWithinRadius,
    formatCoordinates,
    FALLBACK_COORDINATES
  };
}

function getApiBaseUrl() {
  {
    return "https://api.publicartregistry.com/api";
  }
}
function createApiUrl(endpoint) {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
}

const isClient = typeof window !== "undefined" && typeof document !== "undefined";
function canUseLocalStorage() {
  try {
    return isClient && typeof window.localStorage !== "undefined";
  } catch (e) {
    return false;
  }
}

const useFastUploadSessionStore = defineStore("fastUploadSession", () => {
  const photos = ref([]);
  const location = ref(null);
  const detectedSources = ref(null);
  function setSession(data) {
    photos.value = data.photos;
    location.value = data.location;
    detectedSources.value = data.detectedSources;
  }
  function clear() {
    photos.value = [];
    location.value = null;
    detectedSources.value = null;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("fast-upload-session");
      }
    } catch (e) {
    }
  }
  const hasPhotos = computed(() => photos.value.length > 0);
  return { photos, location, detectedSources, hasPhotos, setSession, clear };
});

const API_BASE_URL = getApiBaseUrl();
const API_TIMEOUT = parseInt(undefined                                ) || 3e4;
const listDetailsCache = /* @__PURE__ */ new Map();
const LIST_DETAILS_CACHE_TTL = 5 * 60 * 1e3;
function getListDetailsCacheKey(listId, page, limit) {
  return `${listId}:${page}:${limit}`;
}
function clearListDetailsCache(listId) {
  if (listId) {
    const keysToDelete = [];
    listDetailsCache.forEach((_, key) => {
      if (key.startsWith(`${listId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => listDetailsCache.delete(key));
  } else {
    listDetailsCache.clear();
  }
}
class ApiError extends Error {
  constructor(code, status, message, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = "ApiError";
  }
}
class ApiClient {
  constructor(baseURL, timeout) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }
  /**
   * Get user token from localStorage
   */
  getUserToken() {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    try {
      return window.localStorage.getItem("user-token");
    } catch {
      return null;
    }
  }
  /**
   * Set user token in localStorage
   */
  setUserToken(token) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem("user-token", token);
    } catch {
    }
  }
  /**
   * Create request headers with authentication
   */
  createHeaders(customHeaders = {}) {
    const headers = new Headers({
      ...customHeaders
    });
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const token = this.getUserToken();
    if (token) {
      headers.set("X-User-Token", token);
    }
    return headers;
  }
  /**
   * Handle API response and extract data
   */
  async handleResponse(response) {
    const newToken = response.headers.get("X-User-Token");
    if (newToken) {
      this.setUserToken(newToken);
    }
    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    if (!response.ok) {
      let errorData = { message: response.statusText };
      if (isJson) {
        try {
          errorData = await response.json();
        } catch {
        }
      }
      throw new ApiError(
        String(errorData.code || "API_ERROR"),
        response.status,
        String(errorData.message || `HTTP ${response.status}: ${response.statusText}`),
        errorData
      );
    }
    if (!isJson) {
      throw new ApiError("INVALID_RESPONSE", 500, "Expected JSON response from API");
    }
    return response.json();
  }
  /**
   * Make HTTP request with timeout and error handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const headers = this.createHeaders(options.headers);
      if (options.body instanceof FormData) {
        headers.delete("Content-Type");
      }
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return this.handleResponse(response);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError("TIMEOUT", 408, "Request timeout");
      }
      throw new ApiError("NETWORK_ERROR", 0, "Network error occurred");
    }
  }
  /**
   * GET request
   */
  async get(endpoint, params) {
    let requestEndpoint = endpoint;
    if (params) {
      const url = new URL(endpoint, "http://dummy.com");
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      requestEndpoint = url.pathname + url.search;
    }
    return this.request(requestEndpoint);
  }
  /**
   * POST request
   */
  async post(endpoint, data, customHeaders) {
    const headers = data instanceof FormData ? customHeaders || {} : { ...customHeaders };
    return this.request(endpoint, {
      method: "POST",
      body: data instanceof FormData ? data : JSON.stringify(data),
      headers
    });
  }
  /**
   * PUT request
   */
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  }
  /**
   * PATCH request
   */
  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  }
  /**
   * DELETE request
   */
  async delete(endpoint, data) {
    const options = { method: "DELETE" };
    if (data) {
      options.body = JSON.stringify(data);
    }
    return this.request(endpoint, options);
  }
}
const client = new ApiClient(API_BASE_URL, API_TIMEOUT);
const apiService = {
  // ================================
  // Health & Status
  // ================================
  /**
   * Check API health status
   */
  async getStatus() {
    return client.get("/status");
  },
  // Low-level passthrough for raw FormData posts to uncovered endpoints
  async postRaw(endpoint, formData) {
    return client.post(endpoint, formData, {});
  },
  /**
   * Generate anonymous user token (using status endpoint)
   */
  async generateToken() {
    await client.get("/status");
    const token = localStorage.getItem("user-token") || "";
    return {
      data: { token },
      message: "Token generated successfully",
      success: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  },
  // ================================
  // Submission Endpoints
  // ================================
  /**
   * Create new logbook submission
   */
  async createSubmission(submission) {
    const formData = new FormData();
    formData.append("lat", submission.lat.toString());
    formData.append("lon", submission.lon.toString());
    if (submission.note) {
      formData.append("notes", submission.note);
    }
    if (submission.type) {
      formData.append("type", submission.type);
    }
    if (submission.artworkId) {
      formData.append("artworkId", submission.artworkId);
    }
    submission.photos.forEach((photo) => {
      formData.append(`photos`, photo);
    });
    return client.post("/logbook", formData, {});
  },
  // ================================
  // Discovery Endpoints
  // ================================
  /**
   * Get nearby artworks
   */
  async getNearbyArtworks(lat, lon, radius = 500, limit = 250, options) {
    const params = {
      lat: lat.toString(),
      lon: lon.toString(),
      radius: radius.toString(),
      limit: limit.toString()
    };
    if (options?.minimal) {
      params.minimal = "true";
    }
    return client.get("/artworks/nearby", params);
  },
  /**
   * Get artwork details by ID
   */
  async getArtworkDetails(id) {
    const response = await client.get(`/artworks/${id}`);
    if (!response.data) {
      throw new Error(`Artwork with ID ${id} not found`);
    }
    return response.data;
  },
  /**
   * Submit artwork edits
   */
  async submitArtworkEdit(artworkId, edits) {
    return client.post(`/artwork/${artworkId}/edit`, {
      edits
    });
  },
  /**
   * Submit artwork edit via submissions endpoint (uses unified submissions API)
   * This ensures the ApiClient adds the X-User-Token header from localStorage
   */
  async submitArtworkEditSubmission(payload) {
    return client.post("/submissions/artwork-edit", payload);
  },
  /**
   * Check pending edits for an artwork
   */
  async getPendingEdits(artworkId) {
    return client.get(`/artwork/${artworkId}/pending-edits`);
  },
  /**
   * Validate artwork edits without submitting
   */
  async validateArtworkEdit(artworkId, edits) {
    return client.post(`/artwork/${artworkId}/edit/validate`, {
      edits
    });
  },
  // ================================
  // Index Pages Endpoints
  // ================================
  /**
   * Get paginated list of all approved artworks
   */
  async getArtworksList(page = 1, limit = 30, sort = "updated_desc") {
    return client.get("/artworks", {
      page: page.toString(),
      limit: limit.toString(),
      sort
    });
  },
  /**
   * Get paginated list of all active artists
   */
  async getArtistsList(page = 1, limit = 30, sort = "updated_desc", search, cacheBuster) {
    const params = {
      page: page.toString(),
      limit: limit.toString(),
      sort
    };
    if (search && search.trim()) {
      params.search = search.trim();
    }
    if (cacheBuster) {
      params._cb = cacheBuster;
    }
    return client.get("/artists", params);
  },
  // ================================
  // Search Endpoints
  // ================================
  /**
   * Search artworks by text query
   */
  async searchArtworks(query, page = 1, perPage = 20, status = "approved") {
    return client.get("/search", {
      q: query,
      page: page.toString(),
      per_page: perPage.toString(),
      status
    });
  },
  /**
   * Get search suggestions for autocomplete
   */
  async getSearchSuggestions(query, limit = 5) {
    return client.get("/search/suggestions", {
      q: query,
      limit: limit.toString()
    });
  },
  // ================================
  // User Management Endpoints
  // ================================
  /**
   * Get user submissions
   */
  async getUserSubmissions() {
    return client.get("/me/submissions");
  },
  /**
   * Get user profile
   */
  async getUserProfile() {
    return client.get("/me/profile");
  },
  /**
   * Update user preferences (stored server-side in KV)
   */
  async updateUserPreferences(preferences) {
    return client.put("/me/preferences", preferences);
  },
  // ================================
  // Badge System Endpoints
  // ================================
  /**
   * Get all available badge definitions (public endpoint)
   */
  async getAllBadges() {
    return client.get("/badges");
  },
  /**
   * Get current user's earned badges
   */
  async getUserBadges() {
    return client.get("/me/badges");
  },
  /**
   * Update user's profile name
   */
  async updateProfileName(request) {
    return client.patch("/me/profile", request);
  },
  /**
   * Check if a profile name is available
   */
  async checkProfileNameAvailability(profileName) {
    return client.get("/me/profile-check", { profile_name: profileName });
  },
  /**
   * Get public user profile by UUID
   */
  async getPublicUserProfile(uuid) {
    return client.get(`/users/${uuid}`);
  },
  // ================================
  // Authentication Endpoints (Updated for new backend API)
  // ================================
  /**
   * Request magic link for email verification or login
   */
  async requestMagicLink(request) {
    return client.post("/auth/request-magic-link", request);
  },
  /**
   * Verify and consume magic link token
   */
  async verifyMagicLink(request) {
    return client.post("/auth/verify-magic-link", request);
  },
  /**
   * Get current authentication status
   */
  async getAuthStatus() {
    return client.get("/auth/status");
  },
  /**
   * Logout and get new anonymous token
   */
  async logout() {
    return client.post("/auth/logout");
  },
  // ================================
  // Review/Moderation Endpoints
  // ================================
  /**
   * Get review queue
   */
  async getReviewQueue(status, type, page = 1, limit = 20) {
    const params = {
      page: page.toString(),
      limit: limit.toString()
    };
    if (status) {
      params.status = status;
    }
    if (type) {
      params.type = type;
    }
    return client.get("/review/queue", params);
  },
  /**
   * Get submission for review
   */
  async getSubmissionForReview(id) {
    return client.get(`/review/submission/${id}`);
  },
  /**
   * Approve submission with action
   */
  async approveSubmissionWithAction(id, body) {
    return client.post(`/review/approve/${id}`, body);
  },
  /**
   * Reject submission
   */
  async rejectSubmission(id, reason) {
    return client.post(`/review/reject/${id}`, { reason });
  },
  /**
   * Get review statistics
   */
  async getReviewStats() {
    return client.get("/review/stats");
  },
  /**
   * Process batch review
   */
  async processBatchReview(batch) {
    return client.put("/review/batch", { batch });
  },
  /**
   * Get artwork edits for moderation
   */
  async getArtworkEdits(page, per_page) {
    const params = {};
    if (page) params.page = page.toString();
    if (per_page) params.per_page = per_page.toString();
    return client.get("/review/artwork-edits", params);
  },
  /**
   * Get specific artwork edit for detailed review
   */
  async getArtworkEditForReview(editId) {
    return client.get(`/review/artwork-edits/${editId}`);
  },
  /**
   * Approve artwork edit
   */
  async approveArtworkEdit(editId, applyToArtwork = true) {
    return client.post(`/review/artwork-edits/${editId}/approve`, {
      apply_to_artwork: applyToArtwork
    });
  },
  /**
   * Reject artwork edit
   */
  async rejectArtworkEdit(editId, reason) {
    return client.post(`/review/artwork-edits/${editId}/reject`, { reason });
  },
  /**
   * Artist edit moderation endpoints
   */
  async getArtistEdits(page, per_page) {
    const params = {};
    if (page) params.page = page.toString();
    if (per_page) params.per_page = per_page.toString();
    return client.get("/review/artist-edits", params);
  },
  async getArtistEditForReview(editId) {
    return client.get(`/review/artist-edits/${editId}`);
  },
  async approveArtistEdit(editId) {
    return client.post(`/review/artist-edits/${editId}/approve`, {});
  },
  async rejectArtistEdit(editId, reason) {
    return client.post(`/review/artist-edits/${editId}/reject`, { reason });
  },
  // ================================
  // Admin Endpoints
  // ================================
  /**
   * Get users with permissions
   */
  async getAdminPermissions(permission, search) {
    const params = {};
    if (permission) {
      params.permission = permission;
    }
    if (search && search.trim()) {
      params.search = search.trim();
    }
    return client.get("/admin/permissions", params);
  },
  /**
   * Grant permission to user
   */
  async grantAdminPermission(request) {
    return client.post("/admin/permissions/grant", request);
  },
  /**
   * Revoke permission from user
   */
  async revokeAdminPermission(request) {
    return client.post("/admin/permissions/revoke", request);
  },
  /**
   * Get audit logs
   */
  async getAdminAuditLogs(filters) {
    const params = {};
    if (filters.type) params.type = filters.type;
    if (filters.actor) params.actor = filters.actor;
    if (filters.decision) params.decision = filters.decision;
    if (filters.action_type) params.action_type = filters.action_type;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.page) params.page = filters.page.toString();
    if (filters.limit) params.limit = filters.limit.toString();
    return client.get("/admin/audit", params);
  },
  /**
   * Get admin statistics
   */
  async getAdminStatistics(days = 30) {
    return client.get("/admin/statistics", { days: days.toString() });
  },
  /**
   * Get all badges with statistics (admin only)
   */
  async getAdminBadges() {
    return client.get("/admin/badges");
  },
  /**
   * Create a new badge (admin only)
   */
  async createAdminBadge(badge) {
    return client.post("/admin/badges", badge);
  },
  /**
   * Update an existing badge (admin only)
   */
  async updateAdminBadge(badgeId, updates) {
    return client.put(`/admin/badges/${badgeId}`, updates);
  },
  /**
   * Deactivate a badge (admin only)
   */
  async deactivateAdminBadge(badgeId) {
    return client.delete(`/admin/badges/${badgeId}`);
  },
  // ================================
  // NOTIFICATION SYSTEM ENDPOINTS
  // ================================
  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(options = {}) {
    const params = new URLSearchParams();
    if (options.limit !== void 0) {
      params.append("limit", options.limit.toString());
    }
    if (options.offset !== void 0) {
      params.append("offset", options.offset.toString());
    }
    if (options.unread_only !== void 0) {
      params.append("unread_only", options.unread_only.toString());
    }
    const queryString = params.toString();
    const url = `/me/notifications${queryString ? `?${queryString}` : ""}`;
    return client.get(url);
  },
  /**
   * Get unread notification count
   */
  async getNotificationUnreadCount() {
    return client.get("/me/notifications/unread-count");
  },
  /**
   * Dismiss/mark notification as read
   */
  async dismissNotification(notificationId) {
    return client.post(`/me/notifications/${notificationId}/dismiss`);
  },
  /**
   * Mark notification as read (alias for dismiss)
   */
  async markNotificationRead(notificationId) {
    return client.post(`/me/notifications/${notificationId}/read`);
  },
  // ================================
  // Lists Management
  // ================================
  /**
   * Get user's lists
   */
  async getUserLists() {
    return client.get("/me/lists");
  },
  /**
   * Create a new list
   */
  async createList(name) {
    const result = await client.post("/lists", { name });
    clearListDetailsCache();
    return result;
  },
  /**
   * Get list details with items (with caching to prevent redundant requests)
   */
  async getListDetails(listId, page = 1, limit = 50) {
    const cacheKey = getListDetailsCacheKey(listId, page, limit);
    const cached = listDetailsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < LIST_DETAILS_CACHE_TTL) {
      return cached.data;
    }
    const response = await client.get(`/lists/${listId}`, {
      page: page.toString(),
      limit: limit.toString()
    });
    listDetailsCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });
    return response;
  },
  /**
   * Add artwork to list
   */
  async addArtworkToList(listId, artworkId) {
    const result = await client.post(`/lists/${listId}/items`, { artwork_id: artworkId });
    clearListDetailsCache(listId);
    return result;
  },
  /**
   * Remove artworks from list (bulk operation)
   */
  async removeArtworksFromList(listId, artworkIds) {
    const result = await client.delete(`/lists/${listId}/items`, { artwork_ids: artworkIds });
    clearListDetailsCache(listId);
    return result;
  },
  /**
   * Delete list
   */
  async deleteList(listId) {
    const result = await client.delete(`/lists/${listId}`);
    clearListDetailsCache(listId);
    return result;
  },
  // ================================
  // Generic HTTP Methods (for extensibility)
  // ================================
  /**
   * Generic GET request
   */
  async get(endpoint, params) {
    return client.get(endpoint, params);
  },
  /**
   * Generic POST request
   */
  async post(endpoint, data) {
    return client.post(endpoint, data);
  },
  /**
   * Generic PUT request
   */
  async put(endpoint, data) {
    return client.put(endpoint, data);
  },
  /**
   * Generic DELETE request
   */
  async delete(endpoint, data) {
    return client.delete(endpoint, data);
  }
};
function isApiError(error) {
  return error instanceof ApiError;
}
function getErrorMessage(error) {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}
function isNetworkError(error) {
  return isApiError(error) && (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT");
}
function isUnauthorized(error) {
  return isApiError(error) && error.status === 401;
}
function isRateLimited(error) {
  return isApiError(error) && error.status === 429;
}

const api = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  ApiError,
  apiService,
  getErrorMessage,
  isApiError,
  isNetworkError,
  isRateLimited,
  isUnauthorized
}, Symbol.toStringTag, { value: 'Module' }));

const useAuthStore = defineStore("auth", () => {
  const user = ref(null);
  const token = ref(null);
  const permissions = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const isAuthenticated = computed(() => !!user.value && user.value.emailVerified);
  const isAnonymous = computed(() => !!token.value && !isAuthenticated.value);
  const isAdmin = computed(() => permissions.value.includes("admin"));
  const isModerator = computed(
    () => permissions.value.includes("moderator") || permissions.value.includes("admin") || (user.value?.isModerator ?? false)
  );
  const canReview = computed(() => isModerator.value || isAdmin.value);
  const isEmailVerified = computed(() => user.value?.emailVerified ?? false);
  function setUser(userData) {
    user.value = userData;
    error.value = null;
  }
  function setToken(tokenValue) {
    token.value = tokenValue;
    if (canUseLocalStorage()) {
      try {
        localStorage.setItem("user-token", tokenValue);
      } catch (e) {
        console.warn("[AUTH DEBUG] Failed to persist token to localStorage:", e);
      }
    }
  }
  function setPermissions(userPermissions) {
    permissions.value = userPermissions;
  }
  function clearAuth() {
    user.value = null;
    token.value = null;
    permissions.value = [];
    if (canUseLocalStorage()) {
      try {
        localStorage.removeItem("user-token");
      } catch (e) {
        console.warn("[AUTH DEBUG] Failed to remove token from localStorage:", e);
      }
    }
    error.value = null;
  }
  function setError(message) {
    error.value = message;
  }
  function clearError() {
    error.value = null;
  }
  function setLoading(loading) {
    isLoading.value = loading;
  }
  async function initializeAuth() {
    console.log("[AUTH DEBUG] Starting authentication initialization:", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      currentToken: token.value,
      currentUser: user.value?.id,
      userEmailVerified: user.value?.emailVerified
    });
    try {
      setLoading(true);
      const storedToken = canUseLocalStorage() ? localStorage.getItem("user-token") : null;
      console.log("[AUTH DEBUG] Checking localStorage for existing token:", {
        storedToken,
        currentToken: token.value,
        tokensMatch: storedToken === token.value
      });
      if (storedToken) {
        token.value = storedToken;
        console.log("[AUTH DEBUG] Updated token from localStorage:", storedToken);
      }
      console.log("[AUTH DEBUG] Requesting auth status from backend");
      const statusResponse = await apiService.getAuthStatus();
      console.log("[AUTH DEBUG] Raw status response received:", {
        statusResponse,
        hasData: !!statusResponse?.data,
        dataKeys: statusResponse?.data ? Object.keys(statusResponse.data) : "no_data",
        fullJson: JSON.stringify(statusResponse, null, 2)
      });
      if (statusResponse.data) {
        const authStatus = statusResponse.data;
        console.log("[AUTH DEBUG] Auth status received:", {
          is_authenticated: authStatus.is_authenticated,
          is_anonymous: authStatus.is_anonymous,
          user_token: authStatus.user_token,
          stored_token: token.value,
          user_exists: !!authStatus.user,
          user_email: authStatus.user?.email
        });
        console.log("[AUTH DEBUG] Complete auth status response:", {
          fullResponse: authStatus,
          hasUserObject: !!authStatus.user,
          userObjectKeys: authStatus.user ? Object.keys(authStatus.user) : "no_user_object",
          responseKeys: Object.keys(authStatus),
          jsonString: JSON.stringify(authStatus, null, 2)
        });
        if (authStatus.user_token && authStatus.user_token !== token.value) {
          console.log("[AUTH DEBUG] Token mismatch detected:", {
            stored: token.value,
            backend: authStatus.user_token,
            authenticated: authStatus.is_authenticated,
            user_exists: !!authStatus.user
          });
          if (!authStatus.is_authenticated) {
            console.log(
              "[AUTH DEBUG] Updating anonymous token from",
              token.value,
              "to",
              authStatus.user_token
            );
            setToken(authStatus.user_token);
          } else {
            console.warn("[AUTH DEBUG] Authenticated user has token mismatch - investigating:", {
              stored: token.value,
              backend: authStatus.user_token,
              authenticated: authStatus.is_authenticated,
              action: "keeping_existing_token"
            });
            console.log("[AUTH DEBUG] Forcing token consistency for authenticated user");
            setToken(authStatus.user_token);
          }
        } else {
          console.log("[AUTH DEBUG] Token consistency confirmed:", {
            token: token.value,
            authenticated: authStatus.is_authenticated
          });
        }
        if (authStatus.user && authStatus.is_authenticated) {
          const userData = {
            id: authStatus.user.uuid,
            email: authStatus.user.email,
            emailVerified: true,
            isModerator: false,
            canReview: false,
            createdAt: authStatus.user.created_at
          };
          setUser(userData);
          try {
            const profileResponse = await apiService.getUserProfile();
            if (profileResponse.data?.is_reviewer) {
              userData.isModerator = true;
              userData.canReview = true;
            }
            if (profileResponse.data?.debug?.permissions) {
              const permissionObjects = profileResponse.data.debug.permissions;
              const userPermissions = permissionObjects.filter((p) => p.is_active).map((p) => p.permission);
              setPermissions(userPermissions);
              console.log("[AUTH DEBUG] Permissions extracted from profile:", {
                permissions: userPermissions,
                isAdmin: userPermissions.includes("admin")
              });
            }
            setUser(userData);
          } catch (profileError) {
            console.warn("[AUTH DEBUG] Failed to fetch user profile:", profileError);
          }
          console.log("[AUTH DEBUG] User authenticated successfully:", {
            id: userData.id,
            email: userData.email,
            emailVerified: userData.emailVerified,
            isModerator: !!userData.isModerator,
            canReview: !!userData.canReview
          });
        } else {
          const userData = {
            id: authStatus.user_token,
            email: "",
            emailVerified: false,
            isModerator: false,
            canReview: false,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          try {
            const profileResponse = await apiService.getUserProfile();
            if (profileResponse.data?.is_reviewer) {
              userData.isModerator = true;
              userData.canReview = true;
            }
            if (profileResponse.data?.debug?.permissions) {
              const permissionObjects = profileResponse.data.debug.permissions;
              const userPermissions = permissionObjects.filter((p) => p.is_active).map((p) => p.permission);
              setPermissions(userPermissions);
              console.log("[AUTH DEBUG] Anonymous user permissions extracted from profile:", {
                permissions: userPermissions,
                isAdmin: userPermissions.includes("admin")
              });
            }
          } catch (profileError) {
            console.warn(
              "[AUTH DEBUG] Failed to fetch user profile for anonymous user:",
              profileError
            );
          }
          setUser(userData);
          console.log("[AUTH DEBUG] User set as anonymous:", {
            id: userData.id,
            emailVerified: userData.emailVerified,
            backend_authenticated: authStatus.is_authenticated
          });
        }
        console.log("[AUTH DEBUG] Authentication initialization complete:", {
          final_token: token.value,
          final_user_id: user.value?.id,
          final_authenticated: isAuthenticated.value,
          final_anonymous: isAnonymous.value,
          tokens_match: token.value === user.value?.id
        });
      }
    } catch (err) {
      console.error("[AUTH DEBUG] Auth initialization error:", {
        error: err,
        message: err instanceof Error ? err.message : "Unknown error",
        current_token: token.value,
        current_user: user.value?.id
      });
      if (!token.value) {
        console.log("[AUTH DEBUG] No token available, generating anonymous token");
        await generateAnonymousToken();
      }
    } finally {
      setLoading(false);
      console.log("[AUTH DEBUG] Authentication initialization finished:", {
        loading: isLoading.value,
        token: token.value,
        user_id: user.value?.id,
        authenticated: isAuthenticated.value
      });
    }
  }
  async function generateAnonymousToken() {
    console.log("[AUTH DEBUG] Generating new anonymous token:", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      currentToken: token.value,
      currentUser: user.value?.id
    });
    try {
      const response = await apiService.generateToken();
      console.log("[AUTH DEBUG] Generate token response:", {
        success: response.success,
        token: response.data?.token
      });
      if (response.data?.token) {
        setToken(response.data.token);
        const userData = {
          id: response.data.token,
          email: "",
          emailVerified: false,
          isModerator: false,
          canReview: false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        setUser(userData);
        console.log("[AUTH DEBUG] Anonymous token generated successfully:", {
          token: response.data.token,
          user_id: userData.id
        });
      }
    } catch (err) {
      console.error("[AUTH DEBUG] Failed to generate anonymous token:", {
        error: err,
        message: err instanceof Error ? err.message : "Unknown error"
      });
      if (isClient && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        const fallbackToken = crypto.randomUUID();
        setToken(fallbackToken);
        const userData = {
          id: fallbackToken,
          email: "",
          emailVerified: false,
          isModerator: false,
          canReview: false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        setUser(userData);
        console.log("[AUTH DEBUG] Using fallback client-generated token:", {
          token: fallbackToken,
          user_id: userData.id
        });
      } else {
        const fallbackToken = "anon-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e5).toString(36);
        setToken(fallbackToken);
        const userData = {
          id: fallbackToken,
          email: "",
          emailVerified: false,
          isModerator: false,
          canReview: false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        setUser(userData);
        console.log("[AUTH DEBUG] Using server-safe fallback token:", {
          token: fallbackToken,
          user_id: userData.id
        });
      }
    }
  }
  async function requestMagicLink(email) {
    setLoading(true);
    clearError();
    try {
      const request = { email };
      const response = await apiService.requestMagicLink(request);
      if (response.data) {
        return {
          success: true,
          message: response.data.message,
          isSignup: response.data.is_signup
        };
      }
      return { success: false, message: "Failed to send magic link" };
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }
  async function verifyMagicLink(magicToken) {
    console.log("[AUTH DEBUG] Starting magic link verification:", {
      token: magicToken?.substring(0, 8) + "...",
      currentToken: token.value,
      currentUser: user.value?.id,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    setLoading(true);
    clearError();
    try {
      const request = { token: magicToken };
      console.log("[AUTH DEBUG] Sending magic link verification request");
      const response = await apiService.verifyMagicLink(request);
      console.log("[AUTH DEBUG] Magic link verification response:", {
        success: response.success,
        userUuid: response.data?.user?.uuid,
        email: response.data?.user?.email,
        isNewAccount: response.data?.is_new_account,
        uuidReplaced: response.data?.uuid_replaced
      });
      if (response.success && response.data) {
        const authenticatedUUID = response.data.user.uuid;
        console.log("[AUTH DEBUG] Magic link verification successful, processing authentication:", {
          previousToken: token.value,
          newToken: authenticatedUUID,
          email: response.data.user.email,
          isNewAccount: response.data.is_new_account
        });
        if (authenticatedUUID) {
          console.log("[AUTH DEBUG] Updating token to authenticated UUID:", authenticatedUUID);
          setToken(authenticatedUUID);
        }
        const userData = {
          id: response.data.user.uuid,
          email: response.data.user.email,
          emailVerified: true,
          isModerator: false,
          canReview: false,
          createdAt: response.data.user.created_at
        };
        setUser(userData);
        console.log("[AUTH DEBUG] User data updated:", {
          id: userData.id,
          email: userData.email,
          emailVerified: userData.emailVerified
        });
        console.log(
          "[AUTH DEBUG] Manually updating authentication state after successful verification"
        );
        console.log(
          "[AUTH DEBUG] Magic link verification complete, letting component handle redirect"
        );
        return {
          success: true,
          message: response.data.message || "Login successful",
          isNewAccount: response.data.is_new_account
        };
      }
      console.log(
        "[AUTH DEBUG] Magic link verification failed:",
        response.message || "Unknown error"
      );
      return { success: false, message: response.message || "Failed to verify magic link" };
    } catch (err) {
      const message = getErrorMessage(err);
      console.error("[AUTH DEBUG] Magic link verification error:", {
        error: message,
        token: magicToken?.substring(0, 8) + "...",
        currentState: {
          token: token.value,
          user: user.value?.id,
          isAuthenticated: isAuthenticated.value
        }
      });
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }
  async function logout() {
    console.log("[AUTH DEBUG] Starting logout process:", {
      currentToken: token.value,
      currentUser: user.value?.id,
      isAuthenticated: isAuthenticated.value,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    setLoading(true);
    clearError();
    try {
      console.log("[AUTH DEBUG] Calling backend logout endpoint");
      const response = await apiService.logout();
      console.log("[AUTH DEBUG] Logout response:", {
        success: response.data?.success,
        newToken: response.data?.new_user_token
      });
      if (response.data?.success) {
        console.log("[AUTH DEBUG] Clearing authentication state");
        clearAuth();
        if (response.data.new_user_token) {
          console.log(
            "[AUTH DEBUG] Setting new anonymous token from logout response:",
            response.data.new_user_token
          );
          setToken(response.data.new_user_token);
          const userData = {
            id: response.data.new_user_token,
            email: "",
            emailVerified: false,
            isModerator: false,
            canReview: false,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          setUser(userData);
          console.log("[AUTH DEBUG] New anonymous user data set:", {
            id: userData.id,
            emailVerified: userData.emailVerified
          });
        }
      }
    } catch (err) {
      console.error("[AUTH DEBUG] Logout error:", {
        error: err,
        message: err instanceof Error ? err.message : "Unknown error"
      });
      console.log("[AUTH DEBUG] Using fallback logout process");
      clearAuth();
      await generateAnonymousToken();
    } finally {
      setLoading(false);
      console.log("[AUTH DEBUG] Logout process completed:", {
        newToken: token.value,
        newUser: user.value?.id,
        isAuthenticated: isAuthenticated.value
      });
    }
  }
  function getUserToken() {
    return token.value || "";
  }
  async function ensureUserToken() {
    if (token.value) {
      return token.value;
    }
    await generateAnonymousToken();
    return token.value || "";
  }
  async function refreshAuthStatus() {
    try {
      const statusResponse = await apiService.getAuthStatus();
      if (statusResponse.data) {
        const authStatus = statusResponse.data;
        if (authStatus.user && authStatus.is_authenticated) {
          const userData = {
            id: authStatus.user.uuid,
            email: authStatus.user.email,
            emailVerified: true,
            isModerator: false,
            canReview: false,
            createdAt: authStatus.user.created_at
          };
          setUser(userData);
        }
      }
    } catch (err) {
      console.error("Failed to refresh auth status:", err);
    }
  }
  return {
    // State
    user,
    token,
    permissions,
    isLoading,
    error,
    // Computed
    isAuthenticated,
    isAnonymous,
    // Role flags
    isModerator,
    canReview,
    isAdmin,
    isEmailVerified,
    // Actions
    setUser,
    setToken,
    setPermissions,
    clearAuth,
    setError,
    clearError,
    setLoading,
    initializeAuth,
    generateAnonymousToken,
    requestMagicLink,
    verifyMagicLink,
    logout,
    getUserToken,
    ensureUserToken,
    refreshAuthStatus
  };
});

class NotificationService {
  /**
   * Get user notifications with pagination
   */
  static async getNotifications(options = {}) {
    const response = await apiService.getUserNotifications(options);
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get notifications");
    }
    return response.data;
  }
  /**
   * Get unread notification count
   */
  static async getUnreadCount() {
    const response = await apiService.getNotificationUnreadCount();
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get unread count");
    }
    return response.data;
  }
  /**
   * Dismiss/mark notification as read
   */
  static async dismissNotification(notificationId) {
    const response = await apiService.dismissNotification(notificationId);
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to dismiss notification");
    }
    return response.data;
  }
  /**
   * Mark notification as read (alias for dismiss)
   */
  static async markNotificationRead(notificationId) {
    const response = await apiService.markNotificationRead(notificationId);
    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to mark notification as read");
    }
    return response.data;
  }
}

const useNotificationsStore = defineStore("notifications", () => {
  const notifications = ref([]);
  const unreadCount = ref(0);
  const isLoading = ref(false);
  const error = ref(null);
  const pollInterval = ref(null);
  const lastFetchTime = ref(null);
  const POLL_INTERVAL_MS = 6e4;
  const MAX_NOTIFICATIONS_CACHE = 50;
  const unreadNotifications = computed(() => notifications.value.filter((n) => !n.is_dismissed));
  const hasUnreadNotifications = computed(() => unreadCount.value > 0);
  const recentNotifications = computed(
    () => notifications.value.slice(0, 10)
    // Show last 10 for quick access
  );
  async function fetchNotifications(options = {}) {
    if (isLoading.value && !options.append) {
      return Promise.resolve({ notifications: notifications.value });
    }
    isLoading.value = true;
    error.value = null;
    try {
      const result = await NotificationService.getNotifications({
        limit: options.limit || 20,
        offset: options.offset || 0,
        unread_only: options.unread_only || false
      });
      if (options.append) {
        notifications.value.push(...result.notifications);
      } else {
        notifications.value = result.notifications;
      }
      if (notifications.value.length > MAX_NOTIFICATIONS_CACHE) {
        notifications.value = notifications.value.slice(0, MAX_NOTIFICATIONS_CACHE);
      }
      lastFetchTime.value = /* @__PURE__ */ new Date();
      return result;
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      error.value = err instanceof Error ? err.message : "Failed to fetch notifications";
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  async function fetchUnreadCount() {
    try {
      const result = await NotificationService.getUnreadCount();
      unreadCount.value = result.unread_count;
      return result;
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
      throw err;
    }
  }
  async function dismissNotification(notificationId) {
    try {
      await NotificationService.dismissNotification(notificationId);
      const notification = notifications.value.find((n) => n.id === notificationId);
      if (notification && !notification.is_dismissed) {
        notification.is_dismissed = true;
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
      return { success: true };
    } catch (err) {
      console.error("Failed to dismiss notification:", err);
      error.value = err instanceof Error ? err.message : "Failed to dismiss notification";
      throw err;
    }
  }
  async function markNotificationRead(notificationId) {
    try {
      await NotificationService.markNotificationRead(notificationId);
      const notification = notifications.value.find((n) => n.id === notificationId);
      if (notification && !notification.is_dismissed) {
        notification.is_dismissed = true;
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
      return { success: true };
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
      error.value = err instanceof Error ? err.message : "Failed to mark notification as read";
      throw err;
    }
  }
  async function markAllRead() {
    const unread = notifications.value.filter((n) => !n.is_dismissed).map((n) => n.id);
    if (unread.length === 0) return { success: true };
    const promises = unread.map(
      (id) => markNotificationRead(id).catch((err) => {
        console.error("Failed to mark notification read in bulk operation for id", id, err);
      })
    );
    await Promise.all(promises);
    return { success: true };
  }
  function addNotification(notification) {
    notifications.value.unshift(notification);
    if (!notification.is_dismissed) {
      unreadCount.value++;
    }
    if (notifications.value.length > MAX_NOTIFICATIONS_CACHE) {
      notifications.value = notifications.value.slice(0, MAX_NOTIFICATIONS_CACHE);
    }
  }
  function startPolling() {
    if (!isClient) return;
    if (pollInterval.value) return;
    fetchUnreadCount().catch(() => {
    });
    pollInterval.value = window.setInterval(() => {
      fetchUnreadCount().catch(() => {
      });
    }, POLL_INTERVAL_MS);
    console.log("Started notification polling (interval:", POLL_INTERVAL_MS, "ms)");
  }
  function stopPolling() {
    if (pollInterval.value) {
      clearInterval(pollInterval.value);
      pollInterval.value = null;
      console.log("Stopped notification polling");
    }
  }
  function clearError() {
    error.value = null;
  }
  function resetState() {
    notifications.value = [];
    unreadCount.value = 0;
    isLoading.value = false;
    error.value = null;
    lastFetchTime.value = null;
    stopPolling();
  }
  if (isClient) {
    window.addEventListener("beforeunload", stopPolling);
  }
  return {
    // State
    notifications,
    unreadCount,
    isLoading,
    error,
    lastFetchTime,
    // Computed
    unreadNotifications,
    hasUnreadNotifications,
    recentNotifications,
    // Actions
    fetchNotifications,
    fetchUnreadCount,
    dismissNotification,
    markNotificationRead,
    markAllRead,
    addNotification,
    startPolling,
    stopPolling,
    clearError,
    resetState
  };
});

function useBreakpoint() {
  const width = ref(0);
  const isMobile = computed(() => width.value < 768);
  const isTablet = computed(() => width.value >= 768 && width.value < 1024);
  const isDesktop = computed(() => width.value >= 1024);
  const showNavigationRail = computed(() => width.value >= 1024);
  const showBottomNavigation = computed(() => true);
  const updateWidth = () => {
    width.value = window.innerWidth;
  };
  onMounted(() => {
    updateWidth();
    window.addEventListener("resize", updateWidth);
  });
  onUnmounted(() => {
    window.removeEventListener("resize", updateWidth);
  });
  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
    showNavigationRail,
    showBottomNavigation
  };
}

const LOG_LEVELS = ["debug", "info", "warn", "error"];
const DEFAULT_LEVEL = "info";
const levelIndex = (level) => LOG_LEVELS.indexOf(level);
const toLogLevel = (value) => {
  if (typeof value !== "string") return void 0;
  const lower = value.toLowerCase();
  return LOG_LEVELS.includes(lower) ? lower : void 0;
};
const discoverGlobalLevel = () => {
  try {
    if (typeof process !== "undefined" && process?.env?.LOG_LEVEL) {
      const level = toLogLevel(process.env.LOG_LEVEL);
      if (level) return level;
    }
  } catch {
  }
  try {
    if (typeof globalThis !== "undefined") {
      const globalRecord = globalThis;
      const maybeWindowValue = globalRecord["window"];
      const maybeWindow = typeof maybeWindowValue === "object" && maybeWindowValue !== null ? maybeWindowValue : void 0;
      const candidates = [
        globalRecord["__LOG_LEVEL__"],
        globalRecord["LOG_LEVEL"],
        maybeWindow?.["__LOG_LEVEL__"],
        maybeWindow?.["LOG_LEVEL"]
      ];
      for (const candidate of candidates) {
        const level = toLogLevel(candidate);
        if (level) return level;
      }
    }
  } catch {
  }
  return void 0;
};
const sanitizeArg = (value) => {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map(sanitizeArg);
  }
  const entry = value;
  const clone = {};
  Object.keys(entry).forEach((key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("token") || lowerKey.includes("authorization")) {
      clone[key] = "[REDACTED]";
    } else {
      clone[key] = sanitizeArg(entry[key]);
    }
  });
  return clone;
};
const sanitizeArgs = (args) => args.map(sanitizeArg);
const shouldLog = (configured, requested) => levelIndex(requested) >= levelIndex(configured);
const createLogger = (options = {}) => {
  const resolvedLevel = options.level ?? discoverGlobalLevel() ?? DEFAULT_LEVEL;
  const moduleLabel = options.module ? `[${options.module}]` : "";
  const emit = (level, ...args) => {
    if (!shouldLog(resolvedLevel, level)) return;
    const payload = sanitizeArgs(args);
    const parts = [];
    if (moduleLabel) parts.push(moduleLabel);
    switch (level) {
      case "debug":
        console.debug(...parts, ...payload);
        break;
      case "info":
        console.info(...parts, ...payload);
        break;
      case "warn":
        console.warn(...parts, ...payload);
        break;
      case "error":
      default:
        console.error(...parts, ...payload);
        break;
    }
  };
  return {
    debug: (...args) => emit("debug", ...args),
    info: (...args) => emit("info", ...args),
    warn: (...args) => emit("warn", ...args),
    error: (...args) => emit("error", ...args)
  };
};

function useAuth() {
  const authStore = useAuthStore();
  const isAuthenticated = computed(() => authStore.isAuthenticated);
  const isAnonymous = computed(() => authStore.isAnonymous);
  const isModerator = computed(() => authStore.isModerator);
  const canReview = computed(() => authStore.canReview);
  const isEmailVerified = computed(() => authStore.isEmailVerified);
  const user = computed(() => authStore.user);
  const token = computed(() => authStore.token);
  const isLoading = computed(() => authStore.isLoading);
  const error = computed(() => authStore.error);
  const initAuth = async () => {
    await authStore.initializeAuth();
  };
  const requestMagicLink = async (email) => {
    return authStore.requestMagicLink(email);
  };
  const verifyMagicLink = async (magicToken) => {
    return authStore.verifyMagicLink(magicToken);
  };
  const signOut = async () => {
    await authStore.logout();
  };
  const getUserToken = () => {
    return authStore.getUserToken();
  };
  const ensureUserToken = async () => {
    return authStore.ensureUserToken();
  };
  const refreshAuthStatus = async () => {
    await authStore.refreshAuthStatus();
  };
  const canPerformAuthenticatedActions = computed(() => {
    return isAuthenticated.value || isAnonymous.value;
  });
  const userDisplayName = computed(() => {
    if (!user.value) return "Anonymous";
    if (user.value.emailVerified && user.value.email) {
      return user.value.email;
    }
    return `Anonymous (${user.value.id.slice(0, 8)}...)`;
  });
  watch(token, (newToken) => {
    if (newToken) {
      localStorage.setItem("user-token", newToken);
    } else {
      localStorage.removeItem("user-token");
    }
  });
  return {
    // State
    isAuthenticated,
    isAnonymous,
    isModerator,
    canReview,
    isEmailVerified,
    user,
    token,
    isLoading,
    error,
    // Computed
    canPerformAuthenticatedActions,
    userDisplayName,
    // Actions
    initAuth,
    requestMagicLink,
    verifyMagicLink,
    signOut,
    getUserToken,
    ensureUserToken,
    refreshAuthStatus,
    // Utilities
    clearError: authStore.clearError
  };
}

const _sfc_main$f = /* @__PURE__ */ defineComponent({
  __name: "AuthModal",
  __ssrInlineRender: true,
  props: {
    isOpen: { type: Boolean },
    mode: { default: "login" }
  },
  emits: ["close", "success"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const { isLoading, error, clearError } = useAuth();
    const email = ref("");
    const currentStep = ref("email");
    const emailError = ref(null);
    const isSignup = ref(false);
    const modalTitle = computed(() => {
      switch (currentStep.value) {
        case "email":
          return "Sign In";
        case "sent":
          return "Check Your Email";
        case "verifying":
          return "Verifying...";
        default:
          return "Authentication";
      }
    });
    const buttonText = computed(() => {
      if (isLoading.value) return "Sending...";
      return "Send Magic Link";
    });
    watch(
      () => props.mode,
      (newMode) => {
        isSignup.value = newMode === "signup";
      }
    );
    watch(
      () => props.isOpen,
      (isOpen) => {
        if (isOpen) {
          currentStep.value = "email";
          email.value = "";
          emailError.value = null;
          clearError();
          isSignup.value = props.mode === "signup";
        }
      }
    );
    return (_ctx, _push, _parent, _attrs) => {
      ssrRenderTeleport(_push, (_push2) => {
        if (_ctx.isOpen) {
          _push2(`<div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="auth-modal-title" role="dialog" aria-modal="true" data-v-4efa7897><div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" data-v-4efa7897></div><div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0" data-v-4efa7897><div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6" data-v-4efa7897><div class="absolute right-0 top-0 pr-4 pt-4" data-v-4efa7897><button type="button" class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-v-4efa7897><span class="sr-only" data-v-4efa7897>Close</span><svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" data-v-4efa7897><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" data-v-4efa7897></path></svg></button></div><div class="sm:flex sm:items-start" data-v-4efa7897><div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full" data-v-4efa7897><h3 id="auth-modal-title" class="text-xl font-semibold leading-6 text-gray-900 mb-6" data-v-4efa7897>${ssrInterpolate(modalTitle.value)}</h3>`);
          if (currentStep.value === "email") {
            _push2(`<div class="space-y-6" data-v-4efa7897><p class="text-sm text-gray-600" data-v-4efa7897> Enter your email address to sign in or create an account. We&#39;ll send you a magic link to verify your identity. </p><form class="space-y-4" data-v-4efa7897><div data-v-4efa7897><label for="email" class="block text-sm font-medium text-gray-700 mb-2" data-v-4efa7897> Email address </label><input id="email"${ssrRenderAttr("value", email.value)} type="email" autocomplete="email" required class="${ssrRenderClass([{
              "border-red-300 focus:border-red-500 focus:ring-red-500": emailError.value
            }, "block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"])}" placeholder="Enter your email address"${ssrIncludeBooleanAttr(unref(isLoading)) ? " disabled" : ""} data-v-4efa7897>`);
            if (emailError.value) {
              _push2(`<p class="mt-1 text-sm text-red-600" data-v-4efa7897>${ssrInterpolate(emailError.value)}</p>`);
            } else {
              _push2(`<!---->`);
            }
            if (unref(error)) {
              _push2(`<p class="mt-1 text-sm text-red-600" data-v-4efa7897>${ssrInterpolate(unref(error))}</p>`);
            } else {
              _push2(`<!---->`);
            }
            _push2(`</div><button type="submit" class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"${ssrIncludeBooleanAttr(unref(isLoading)) ? " disabled" : ""} data-v-4efa7897>${ssrInterpolate(buttonText.value)}</button></form><div class="bg-blue-50 rounded-md p-3" data-v-4efa7897><p class="text-xs text-blue-800" data-v-4efa7897><strong data-v-4efa7897>Anonymous usage:</strong> You can submit artwork without an account. Creating an account lets you claim your anonymous submissions and sync across devices. </p></div></div>`);
          } else if (currentStep.value === "sent") {
            _push2(`<div class="text-center space-y-4" data-v-4efa7897><div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100" data-v-4efa7897><svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" data-v-4efa7897><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" data-v-4efa7897></path></svg></div><div data-v-4efa7897><h4 class="text-lg font-medium text-gray-900 mb-2" data-v-4efa7897>Magic link sent!</h4><p class="text-sm text-gray-600 mb-4" data-v-4efa7897>We&#39;ve sent a magic link to:</p><p class="text-sm font-medium text-gray-900 mb-4" data-v-4efa7897>${ssrInterpolate(email.value)}</p><p class="text-xs text-gray-500" data-v-4efa7897> Click the link in your email to complete authentication. The link will expire in 1 hour. </p></div><div class="pt-4" data-v-4efa7897><button type="button" class="text-sm text-blue-600 hover:text-blue-800 underline" data-v-4efa7897> Didn&#39;t receive the email? Try again </button></div></div>`);
          } else {
            _push2(`<!---->`);
          }
          _push2(`</div></div></div></div></div>`);
        } else {
          _push2(`<!---->`);
        }
      }, "body", false, _parent);
    };
  }
});

const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};

const _sfc_setup$f = _sfc_main$f.setup;
_sfc_main$f.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/AuthModal.vue");
  return _sfc_setup$f ? _sfc_setup$f(props, ctx) : void 0;
};
const AuthModal = /* @__PURE__ */ _export_sfc(_sfc_main$f, [["__scopeId", "data-v-4efa7897"]]);

const useFeedbackStore = defineStore("feedback", () => {
  const submitting = ref(false);
  const lastError = ref(null);
  async function submitFeedback(request) {
    submitting.value = true;
    lastError.value = null;
    try {
      const authStore = useAuthStore();
      const userToken = await authStore.ensureUserToken();
      const body = {
        ...request,
        user_token: userToken
      };
      const response = await fetch(createApiUrl("/feedback"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to send feedback" }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send feedback";
      lastError.value = errorMessage;
      throw error;
    } finally {
      submitting.value = false;
    }
  }
  return {
    // State
    submitting,
    lastError,
    // Actions
    submitFeedback
  };
});

// ================================
// Database Schema Types
// ================================
// ================================
// API Response Utilities
// ================================
/**
 * Create a successful API response with consistent formatting
 */
// Type guard to safely detect BadgeNotificationMetadata at runtime
function isBadgeNotificationMetadata(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const asRec = obj;
    return (typeof asRec['badge_id'] === 'string' &&
        typeof asRec['badge_key'] === 'string' &&
        typeof asRec['award_reason'] === 'string');
}
const MAX_FEEDBACK_NOTE_LENGTH = 1000;
// ================================
// LEGACY TYPES (Maintaining for compatibility)
// ================================
// Removed duplicate and obsolete type definitions - using the unified schema types above

const DEFAULT_MISSING_TEXT = "The artwork is missing";
const _sfc_main$e = /* @__PURE__ */ defineComponent({
  __name: "FeedbackDialog",
  __ssrInlineRender: true,
  props: {
    open: { type: Boolean },
    subjectType: {},
    subjectId: {},
    mode: { default: "comment" },
    defaultNote: { default: "" }
  },
  emits: ["close", "cancel", "success"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    useFeedbackStore();
    const note = ref("");
    const sending = ref(false);
    const error = ref(null);
    const initialNote = ref("");
    const title = computed(() => {
      if (props.mode === "general") {
        return "Send Feedback";
      }
      if (props.mode === "missing") {
        return props.subjectType === "artwork" ? "Report Missing Artwork" : "Report Missing Artist";
      }
      return "Report an Issue";
    });
    const placeholder = computed(() => {
      if (props.mode === "general") {
        return "Share your feedback, report a bug, or suggest an improvement...";
      }
      if (props.mode === "missing") {
        return "Add additional details (optional)";
      }
      return "Describe the issue you observed...";
    });
    const sendDisabled = computed(() => {
      const trimmed = note.value.trim();
      return trimmed.length === 0 || trimmed.length > MAX_FEEDBACK_NOTE_LENGTH || sending.value;
    });
    computed(() => {
      return note.value !== initialNote.value;
    });
    watch(() => props.open, (isOpen) => {
      if (isOpen) {
        if (props.mode === "missing") {
          note.value = DEFAULT_MISSING_TEXT;
          initialNote.value = DEFAULT_MISSING_TEXT;
        } else if (props.mode === "general" && props.defaultNote) {
          note.value = props.defaultNote;
          initialNote.value = props.defaultNote;
        } else {
          note.value = "";
          initialNote.value = "";
        }
        error.value = null;
        sending.value = false;
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      if (_ctx.open) {
        _push(`<div${ssrRenderAttrs(mergeProps({ class: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" }, _attrs))} data-v-f8f0d17e><div class="w-full max-w-lg bg-white rounded-lg shadow-xl" role="dialog" aria-modal="true"${ssrRenderAttr("aria-labelledby", `feedback-dialog-title-${_ctx.subjectId}`)} data-v-f8f0d17e><div class="p-6" data-v-f8f0d17e><h3${ssrRenderAttr("id", `feedback-dialog-title-${_ctx.subjectId}`)} class="text-xl font-semibold text-gray-900 mb-2" data-v-f8f0d17e>${ssrInterpolate(title.value)}</h3>`);
        if (_ctx.mode !== "general") {
          _push(`<p class="text-sm text-gray-600 mb-4" data-v-f8f0d17e> This feedback will be sent privately to moderators who will review and update the content. </p>`);
        } else {
          _push(`<p class="text-sm text-gray-600 mb-4" data-v-f8f0d17e> Your feedback helps us improve the site. Thank you for taking the time to share your thoughts! </p>`);
        }
        _push(`<div class="mb-4" data-v-f8f0d17e><label${ssrRenderAttr("for", `feedback-note-${_ctx.subjectId}`)} class="sr-only" data-v-f8f0d17e> Feedback note </label><textarea${ssrRenderAttr("id", `feedback-note-${_ctx.subjectId}`)}${ssrRenderAttr("placeholder", placeholder.value)}${ssrRenderAttr("maxlength", unref(MAX_FEEDBACK_NOTE_LENGTH))} class="w-full h-32 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"${ssrRenderAttr("aria-invalid", error.value ? "true" : "false")}${ssrRenderAttr("aria-describedby", error.value ? `feedback-error-${_ctx.subjectId}` : "")} data-v-f8f0d17e>${ssrInterpolate(note.value)}</textarea><div class="flex justify-between items-center mt-2" data-v-f8f0d17e><span class="text-sm text-gray-500" aria-live="polite" data-v-f8f0d17e>${ssrInterpolate(note.value.length)} / ${ssrInterpolate(unref(MAX_FEEDBACK_NOTE_LENGTH))}</span></div></div>`);
        if (error.value) {
          _push(`<div${ssrRenderAttr("id", `feedback-error-${_ctx.subjectId}`)} class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md" role="alert" data-v-f8f0d17e><p class="text-sm text-red-600" data-v-f8f0d17e>${ssrInterpolate(error.value)}</p></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="flex justify-end space-x-3" data-v-f8f0d17e><button type="button"${ssrIncludeBooleanAttr(sending.value) ? " disabled" : ""} class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" data-v-f8f0d17e> Cancel </button><button type="button"${ssrIncludeBooleanAttr(sendDisabled.value) ? " disabled" : ""} class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" data-v-f8f0d17e>`);
        if (sending.value) {
          _push(`<span data-v-f8f0d17e>Sending...</span>`);
        } else {
          _push(`<span data-v-f8f0d17e>Send</span>`);
        }
        _push(`</button></div></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
    };
  }
});

const _sfc_setup$e = _sfc_main$e.setup;
_sfc_main$e.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/FeedbackDialog.vue");
  return _sfc_setup$e ? _sfc_setup$e(props, ctx) : void 0;
};
const FeedbackDialog = /* @__PURE__ */ _export_sfc(_sfc_main$e, [["__scopeId", "data-v-f8f0d17e"]]);

const announcement = ref("");
const announcementLevel = ref("polite");
function useAnnouncer() {
  function announce(message, level = "polite") {
    announcement.value = "";
    announcementLevel.value = level;
    setTimeout(() => {
      announcement.value = message;
    }, 100);
  }
  function clearAnnouncement() {
    announcement.value = "";
  }
  function announceSuccess(message) {
    announce(`Success: ${message}`, "polite");
  }
  function announceError(message) {
    announce(`Error: ${message}`, "assertive");
  }
  function announceWarning(message) {
    announce(`Warning: ${message}`, "assertive");
  }
  function announceInfo(message) {
    announce(`Information: ${message}`, "polite");
  }
  function announceFormErrors(errors) {
    const errorList = Array.isArray(errors) ? errors : [errors];
    const errorCount = errorList.length;
    if (errorCount === 0) return;
    let message = "";
    if (errorCount === 1) {
      message = `Form error: ${errorList[0]}`;
    } else {
      message = `Form has ${errorCount} errors: ${errorList.join(", ")}`;
    }
    announce(message, "assertive");
  }
  function announceFieldError(fieldName, error) {
    announce(`${fieldName} error: ${error}`, "assertive");
  }
  function announceFormSubmission(status, message) {
    switch (status) {
      case "submitting":
        announce("Form is being submitted...", "polite");
        break;
      case "success":
        announceSuccess(message || "Form submitted successfully");
        break;
      case "error":
        announceError(message || "Form submission failed");
        break;
    }
  }
  function announceNavigation(pageName) {
    announce(`Navigated to ${pageName}`, "polite");
  }
  function announceLoading(isLoading, context = "") {
    if (isLoading) {
      announce(`Loading ${context}...`.trim(), "polite");
    } else {
      announce(`Finished loading ${context}`.trim(), "polite");
    }
  }
  function announceUpdate(message) {
    announce(`Updated: ${message}`, "polite");
  }
  return {
    announcement,
    announcementLevel,
    announce,
    clearAnnouncement,
    announceSuccess,
    announceError,
    announceWarning,
    announceInfo,
    announceFormErrors,
    announceFieldError,
    announceFormSubmission,
    announceNavigation,
    announceLoading,
    announceUpdate
  };
}

const _sfc_main$d = /* @__PURE__ */ defineComponent({
  __name: "LiveRegion",
  __ssrInlineRender: true,
  setup(__props) {
    const { announcement, announcementLevel } = useAnnouncer();
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: "sr-only",
        "aria-live": unref(announcementLevel),
        "aria-atomic": "true",
        role: "status"
      }, _attrs))} data-v-1fcbd8f3>${ssrInterpolate(unref(announcement))}</div>`);
    };
  }
});

const _sfc_setup$d = _sfc_main$d.setup;
_sfc_main$d.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/LiveRegion.vue");
  return _sfc_setup$d ? _sfc_setup$d(props, ctx) : void 0;
};
const LiveRegion = /* @__PURE__ */ _export_sfc(_sfc_main$d, [["__scopeId", "data-v-1fcbd8f3"]]);

const useToastsStore = defineStore("toasts", () => {
  const toasts = ref([]);
  function pushToast(toast) {
    const id = Math.random().toString(36).slice(2, 9);
    const item = { id, type: toast.type, message: toast.message, timeoutMs: toast.timeoutMs, payload: toast.payload ?? null };
    toasts.value.push(item);
    const ms = toast.timeoutMs ?? 4e3;
    if (ms > 0 && isClient) {
      setTimeout(() => removeToast(id), ms);
    }
    return id;
  }
  function removeToast(id) {
    const idx = toasts.value.findIndex((t) => t.id === id);
    if (idx !== -1) toasts.value.splice(idx, 1);
  }
  function clear() {
    toasts.value = [];
  }
  return { toasts, pushToast, removeToast, clear };
});

const _sfc_main$c = /* @__PURE__ */ defineComponent({
  __name: "BadgeToast",
  __ssrInlineRender: true,
  props: {
    badge: {},
    autoHide: { type: Boolean, default: true },
    autoHideDelay: { default: 8e3 },
    notificationId: {}
  },
  emits: ["dismiss", "celebrate"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    useRouter();
    const isVisible = ref(true);
    const isConfettiActive = ref(false);
    const confettiCanvas = ref(null);
    const hideTimer = ref(null);
    const prefersReducedMotion = computed(() => {
      if (typeof window === "undefined") return true;
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    });
    ref([]);
    function dismiss() {
      isVisible.value = false;
      emit("dismiss", props.notificationId);
      if (hideTimer.value) {
        clearTimeout(hideTimer.value);
        hideTimer.value = null;
      }
    }
    function handleResize() {
      if (confettiCanvas.value) {
        confettiCanvas.value.width = window.innerWidth;
        confettiCanvas.value.height = window.innerHeight;
      }
    }
    onMounted(() => {
      if (props.autoHide) {
        hideTimer.value = window.setTimeout(() => {
          dismiss();
        }, props.autoHideDelay);
      }
      window.addEventListener("resize", handleResize);
    });
    onUnmounted(() => {
      if (hideTimer.value) {
        clearTimeout(hideTimer.value);
      }
      window.removeEventListener("resize", handleResize);
      isConfettiActive.value = false;
    });
    return (_ctx, _push, _parent, _attrs) => {
      ssrRenderTeleport(_push, (_push2) => {
        if (isVisible.value) {
          _push2(`<div class="fixed top-4 right-4 z-50 max-w-sm" role="alert" aria-live="polite" aria-atomic="true" data-v-2e855687><div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-v-2e855687><div class="bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2" data-v-2e855687><div class="flex items-center justify-between" data-v-2e855687><div class="flex items-center space-x-2" data-v-2e855687><span class="text-2xl" aria-hidden="true" data-v-2e855687>${ssrInterpolate(_ctx.badge.icon_emoji || "🏆")}</span><span class="text-white font-semibold text-sm" data-v-2e855687> New Badge! </span></div><button class="text-white hover:text-yellow-100 transition-colors"${ssrRenderAttr("aria-label", `Dismiss ${_ctx.badge.title} badge notification`)} data-v-2e855687><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" data-v-2e855687><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" data-v-2e855687></path></svg></button></div></div><div class="p-4" data-v-2e855687><div class="flex items-start space-x-3" data-v-2e855687><div class="flex-shrink-0" data-v-2e855687><div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center" data-v-2e855687><span class="text-2xl" data-v-2e855687>${ssrInterpolate(_ctx.badge.icon_emoji || "🏆")}</span></div></div><div class="flex-1 min-w-0" data-v-2e855687><h3 class="text-lg font-semibold text-gray-900 dark:text-white" data-v-2e855687>${ssrInterpolate(_ctx.badge.title)}</h3><p class="text-sm text-gray-600 dark:text-gray-400 mt-1" data-v-2e855687>${ssrInterpolate(_ctx.badge.description)}</p><p class="text-xs text-gray-500 dark:text-gray-500 mt-2" data-v-2e855687>${ssrInterpolate(_ctx.badge.award_reason)}</p></div></div></div><div class="px-4 pb-4 flex justify-between items-center" data-v-2e855687><button class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium" data-v-2e855687> View all badges </button><button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"${ssrIncludeBooleanAttr(isConfettiActive.value) ? " disabled" : ""} data-v-2e855687> 🎉 Celebrate </button></div></div></div>`);
        } else {
          _push2(`<!---->`);
        }
        if (isConfettiActive.value && !prefersReducedMotion.value) {
          _push2(`<canvas class="fixed inset-0 pointer-events-none z-40" aria-hidden="true" data-v-2e855687></canvas>`);
        } else {
          _push2(`<!---->`);
        }
      }, "body", false, _parent);
    };
  }
});

const _sfc_setup$c = _sfc_main$c.setup;
_sfc_main$c.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/BadgeToast.vue");
  return _sfc_setup$c ? _sfc_setup$c(props, ctx) : void 0;
};
const BadgeToast = /* @__PURE__ */ _export_sfc(_sfc_main$c, [["__scopeId", "data-v-2e855687"]]);

const _sfc_main$b = /* @__PURE__ */ defineComponent({
  __name: "Toasts",
  __ssrInlineRender: true,
  setup(__props) {
    const toasts = useToastsStore();
    const items = computed(() => toasts.toasts);
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "fixed top-4 right-4 z-50 flex flex-col items-end space-y-2" }, _attrs))} data-v-f06d0887><div${ssrRenderAttrs({ name: "toast" })} data-v-f06d0887>`);
      ssrRenderList(items.value, (t) => {
        _push(`<div data-v-f06d0887>`);
        if (t.payload && t.payload.badge) {
          _push(ssrRenderComponent(BadgeToast, {
            badge: t.payload.badge,
            "notification-id": t.id
          }, null, _parent));
        } else {
          _push(`<div role="alert" aria-live="polite" class="${ssrRenderClass([
            "max-w-sm w-full shadow-lg rounded-md p-3 text-sm",
            t.type === "success" ? "bg-green-50 border border-green-200 text-green-800" : "",
            t.type === "error" ? "bg-red-50 border border-red-200 text-red-800" : "",
            t.type === "info" ? "bg-blue-50 border border-blue-200 text-blue-800" : "",
            t.type === "warning" ? "bg-yellow-50 border border-yellow-200 text-yellow-800" : ""
          ])}" data-v-f06d0887><div class="flex items-start justify-between" data-v-f06d0887><div class="pr-3 flex-1 break-words" data-v-f06d0887>${ssrInterpolate(t.message)}</div><button class="ml-3 text-xs opacity-70 hover:opacity-100" data-v-f06d0887>Dismiss</button></div></div>`);
        }
        _push(`</div>`);
      });
      _push(`</div></div>`);
    };
  }
});

const _sfc_setup$b = _sfc_main$b.setup;
_sfc_main$b.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/Toasts.vue");
  return _sfc_setup$b ? _sfc_setup$b(props, ctx) : void 0;
};
const Toasts = /* @__PURE__ */ _export_sfc(_sfc_main$b, [["__scopeId", "data-v-f06d0887"]]);

const _sfc_main$a = /* @__PURE__ */ defineComponent({
  __name: "NavControls",
  __ssrInlineRender: true,
  props: {
    orientation: { default: "horizontal" },
    notificationCount: { default: 0 },
    showNotifications: { type: Boolean, default: true },
    isAuthenticated: { type: Boolean, default: false },
    userDisplayName: { default: "" },
    auth: {}
  },
  emits: [
    "menuToggle",
    "notificationClick",
    "fabClick",
    "profileClick",
    "loginClick",
    "mapClick",
    "feedbackClick"
  ],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const hasNotifications = computed(() => (props.notificationCount ?? 0) > 0);
    const authIsAuthenticated = computed(() => {
      if (props.auth && typeof props.auth.isAuthenticated === "boolean") return props.auth.isAuthenticated;
      return props.isAuthenticated ?? false;
    });
    const authUserDisplayName = computed(() => {
      if (props.auth && typeof props.auth.userDisplayName === "string") return props.auth.userDisplayName;
      return props.userDisplayName ?? "";
    });
    return (_ctx, _push, _parent, _attrs) => {
      if (props.orientation === "horizontal") {
        _push(`<div${ssrRenderAttrs(mergeProps({ class: "relative flex items-center justify-between h-16 px-4" }, _attrs))} data-v-26524500><div class="flex items-center space-x-2" data-v-26524500><button class="lg:hidden flex items-center justify-center w-12 h-12 rounded-full theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" aria-label="Open navigation menu" data-v-26524500>`);
        _push(ssrRenderComponent(unref(Bars3Icon), {
          class: "w-10 h-10 theme-text-muted theme-nav-icon-hover",
          "aria-hidden": "true"
        }, null, _parent));
        _push(`</button><button class="flex items-center justify-center w-12 h-12 rounded-full theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors group" aria-label="Send feedback" title="Send Feedback" data-v-26524500>`);
        _push(ssrRenderComponent(unref(ChatBubbleLeftRightIcon), {
          class: "w-10 h-10 theme-text-muted theme-nav-icon-hover",
          "aria-hidden": "true"
        }, null, _parent));
        _push(`</button></div><div class="absolute left-1/2 -translate-x-1/2 -top-7" data-v-26524500><button class="fab flex items-center justify-center w-14 h-14 theme-primary theme-on-primary rounded-full shadow-lg hover:theme-primary-hover hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 hover:scale-105" aria-label="Submit new artwork" data-v-26524500>`);
        _push(ssrRenderComponent(unref(CameraIcon), {
          class: "w-14 h-14",
          "aria-hidden": "true"
        }, null, _parent));
        _push(`</button></div><div class="flex items-center space-x-2" data-v-26524500>`);
        if (props.showNotifications) {
          _push(`<button class="relative flex items-center justify-center w-12 h-12 rounded-full theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors group" aria-label="View notifications" data-v-26524500>`);
          _push(ssrRenderComponent(unref(BellIcon), {
            class: "w-10 h-10 theme-text-muted theme-nav-icon-hover",
            "aria-hidden": "true"
          }, null, _parent));
          if (hasNotifications.value) {
            _push(`<span class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none theme-on-error theme-error rounded-full min-w-[18px] h-[18px] shadow-sm"${ssrRenderAttr("aria-label", `${props.notificationCount ?? 0} unread notifications`)} data-v-26524500>${ssrInterpolate((props.notificationCount ?? 0) > 99 ? "99+" : props.notificationCount ?? 0)}</span>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<button class="flex items-center justify-center w-12 h-12 rounded-full theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors group" aria-label="Open map" title="Map" data-v-26524500>`);
        _push(ssrRenderComponent(unref(MapIcon), {
          class: "w-10 h-10 theme-text-muted theme-nav-icon-hover",
          "aria-hidden": "true"
        }, null, _parent));
        _push(`</button></div></div>`);
      } else {
        _push(`<div${ssrRenderAttrs(mergeProps({ class: "flex flex-col items-center px-3 py-4 space-y-3" }, _attrs))} data-v-26524500><button class="flex items-center justify-center w-12 h-12 rounded-full theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors group" aria-label="Open navigation menu" data-v-26524500>`);
        _push(ssrRenderComponent(unref(Bars3Icon), {
          class: "w-6 h-6 theme-text-muted theme-nav-icon-hover",
          "aria-hidden": "true"
        }, null, _parent));
        _push(`</button>`);
        if (props.showNotifications) {
          _push(`<button class="relative flex items-center justify-center w-12 h-12 rounded-full theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors group" aria-label="View notifications" data-v-26524500>`);
          _push(ssrRenderComponent(unref(BellIcon), {
            class: "w-6 h-6 theme-text-muted theme-nav-icon-hover",
            "aria-hidden": "true"
          }, null, _parent));
          if (hasNotifications.value) {
            _push(`<span class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none theme-on-error theme-error rounded-full min-w-[18px] h-[18px] shadow-sm"${ssrRenderAttr("aria-label", `${props.notificationCount ?? 0} unread notifications`)} data-v-26524500>${ssrInterpolate((props.notificationCount ?? 0) > 99 ? "99+" : props.notificationCount ?? 0)}</span>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</button>`);
        } else {
          _push(`<!---->`);
        }
        if (authIsAuthenticated.value) {
          _push(`<button class="flex items-center justify-center w-12 h-12 rounded-full theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors group"${ssrRenderAttr("title", authUserDisplayName.value || "Profile")} data-v-26524500>`);
          _push(ssrRenderComponent(unref(UserIcon), {
            class: "w-6 h-6 theme-text-muted theme-nav-icon-hover",
            "aria-hidden": "true"
          }, null, _parent));
          _push(`</button>`);
        } else {
          _push(`<button class="flex items-center justify-center w-12 h-12 rounded-full hover:theme-nav-link-hover hover:theme-nav-link focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors group" title="Login" data-v-26524500>`);
          _push(ssrRenderComponent(unref(ArrowRightOnRectangleIcon), {
            class: "w-6 h-6 theme-text-muted theme-nav-icon-hover",
            "aria-hidden": "true"
          }, null, _parent));
          _push(`</button>`);
        }
        _push(`</div>`);
      }
    };
  }
});

const _sfc_setup$a = _sfc_main$a.setup;
_sfc_main$a.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/navigation/NavControls.vue");
  return _sfc_setup$a ? _sfc_setup$a(props, ctx) : void 0;
};
const NavControls = /* @__PURE__ */ _export_sfc(_sfc_main$a, [["__scopeId", "data-v-26524500"]]);

const _sfc_main$9 = /* @__PURE__ */ defineComponent({
  __name: "BottomNavigation",
  __ssrInlineRender: true,
  props: {
    currentRoute: {},
    notificationCount: { default: 0 },
    showNotifications: { type: Boolean, default: true },
    isAuthenticated: { type: Boolean, default: false },
    userDisplayName: { default: "" }
  },
  emits: ["menuToggle", "notificationClick", "fabClick", "profileClick", "loginClick", "mapClick", "feedbackClick"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const { notificationCount, showNotifications } = toRefs(props);
    const emit = __emit;
    const handleMenuToggle = () => {
      emit("menuToggle");
    };
    const handleNotificationClick = () => {
      emit("notificationClick");
    };
    const handleFabClick = () => {
      emit("fabClick");
    };
    const handleProfileClick = () => {
      emit("profileClick");
    };
    const handleLoginClick = () => {
      emit("loginClick");
    };
    const handleFeedbackClick = () => {
      emit("feedbackClick");
    };
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<nav${ssrRenderAttrs(mergeProps({
        class: "bottom-navigation fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30",
        role: "navigation",
        "aria-label": "Bottom navigation"
      }, _attrs))} data-v-00fa8a0b>`);
      _push(ssrRenderComponent(NavControls, {
        orientation: "horizontal",
        "notification-count": unref(notificationCount),
        "show-notifications": unref(showNotifications),
        auth: { isAuthenticated: props.isAuthenticated, userDisplayName: props.userDisplayName },
        onMenuToggle: handleMenuToggle,
        onFabClick: handleFabClick,
        onNotificationClick: handleNotificationClick,
        onMapClick: ($event) => _ctx.$emit("mapClick"),
        onProfileClick: handleProfileClick,
        onLoginClick: handleLoginClick,
        onFeedbackClick: handleFeedbackClick
      }, null, _parent));
      _push(`</nav>`);
    };
  }
});

const _sfc_setup$9 = _sfc_main$9.setup;
_sfc_main$9.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/navigation/BottomNavigation.vue");
  return _sfc_setup$9 ? _sfc_setup$9(props, ctx) : void 0;
};
const BottomNavigation = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["__scopeId", "data-v-00fa8a0b"]]);

const _imports_0 = "/assets/logo-pin-brush.svg";

const _sfc_main$8 = /* @__PURE__ */ defineComponent({
  __name: "NavigationRail",
  __ssrInlineRender: true,
  props: {
    isExpanded: { type: Boolean, default: true },
    notificationCount: { default: 0 },
    showNotifications: { type: Boolean, default: true },
    isAuthenticated: { type: Boolean, default: false },
    userDisplayName: { default: "" },
    userRole: { default: "user" },
    auth: {}
  },
  emits: [
    "toggleExpanded",
    "notificationClick",
    "profileClick",
    "logoutClick",
    "loginClick"
  ],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const route = useRoute();
    const authIsAuthenticated = computed(() => {
      if (props.auth && typeof props.auth.isAuthenticated === "boolean") return props.auth.isAuthenticated;
      return props.isAuthenticated ?? false;
    });
    const authUserRole = computed(() => {
      if (props.auth && props.auth.userRole) return props.auth.userRole;
      return props.userRole ?? "user";
    });
    const navigationItems = computed(() => [
      {
        name: "Map",
        path: "/",
        icon: MapIcon,
        description: "Explore artwork on the map"
      },
      {
        name: "Artworks",
        path: "/artworks",
        icon: PhotoIcon,
        description: "Browse all artworks"
      },
      {
        name: "Artists",
        path: "/artists",
        icon: UserGroupIcon,
        description: "Discover artists"
      },
      {
        name: "Search",
        path: "/search",
        icon: MagnifyingGlassIcon,
        description: "Search artworks and artists"
      },
      {
        name: "Help",
        path: "/help",
        icon: QuestionMarkCircleIcon,
        description: "Help"
      },
      {
        name: "Pages",
        path: "/pages",
        icon: BookOpenIcon,
        description: "Browse pages and guides"
      }
    ]);
    const roleBasedItems = computed(() => {
      const items = [];
      if (authUserRole.value === "admin") {
        items.push({
          name: "Admin",
          path: "/admin",
          icon: ShieldCheckIcon,
          description: "Admin dashboard"
        });
      }
      if (authUserRole.value === "admin" || authUserRole.value === "moderator") {
        items.push({
          name: "Moderate",
          path: "/review",
          icon: ClipboardDocumentListIcon,
          description: "Review submissions"
        });
      }
      return items;
    });
    const isRouteActive = (path) => {
      if (path === "/" && route.path === "/") return true;
      if (path !== "/" && route.path.startsWith(path)) return true;
      return false;
    };
    return (_ctx, _push, _parent, _attrs) => {
      const _component_router_link = resolveComponent("router-link");
      _push(`<aside${ssrRenderAttrs(mergeProps({
        class: ["hidden lg:flex flex-col theme-surface theme-nav-border shadow-lg h-screen fixed left-0 top-0 z-40 transition-all mr-4", props.isExpanded ? "w-80" : "w-16"],
        role: "navigation",
        "aria-label": "Navigation rail"
      }, _attrs))} data-v-0b774d2b>`);
      if (props.isExpanded) {
        _push(`<div class="flex-shrink-0 h-16 px-4 theme-primary theme-on-primary flex items-center justify-between" data-v-0b774d2b><div class="flex items-center space-x-3" data-v-0b774d2b><div class="flex-shrink-0" role="img" aria-label="Public Art Registry logo" data-v-0b774d2b><img${ssrRenderAttr("src", _imports_0)} alt="Public Art Registry" width="36" height="36" class="block" style="${ssrRenderStyle({ "--pin-stroke": "#000000", "--inner": "#000000", "--handle": "#000000", "--ferrule": "#000000", "--bristle": "#000000" })}" data-v-0b774d2b></div><h2 class="text-lg font-semibold truncate" data-v-0b774d2b>Public Art Registry</h2></div><button class="flex items-center justify-center w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors theme-nav-icon-hover" aria-label="Collapse navigation" title="Collapse navigation" data-v-0b774d2b>`);
        _push(ssrRenderComponent(unref(BookOpenIcon), {
          class: "w-10 h-10 transform rotate-180",
          "aria-hidden": "true"
        }, null, _parent));
        _push(`</button></div>`);
      } else {
        _push(`<div class="flex items-center justify-center px-3 py-3 theme-nav-border" data-v-0b774d2b><button class="flex items-center justify-center w-12 h-12 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors theme-nav-icon-hover" aria-label="Open navigation menu" title="Open navigation menu" data-v-0b774d2b>`);
        _push(ssrRenderComponent(unref(BookOpenIcon), {
          class: "w-10 h-10 theme-text-muted",
          "aria-hidden": "true"
        }, null, _parent));
        _push(`</button></div>`);
      }
      _push(`<div class="flex-1 overflow-y-auto" data-v-0b774d2b><div class="py-2" data-v-0b774d2b><ul class="space-y-1 px-2" data-v-0b774d2b><!--[-->`);
      ssrRenderList(navigationItems.value, (item) => {
        _push(`<li data-v-0b774d2b>`);
        _push(ssrRenderComponent(_component_router_link, {
          to: item.path,
          class: ["nav-item group flex items-center text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", [
            props.isExpanded ? "px-4 py-3" : "px-2 py-2 justify-center",
            isRouteActive(item.path) ? "theme-nav-active-background theme-nav-active border-l-4 theme-nav-border" : "theme-text-muted theme-hover-background"
          ]],
          title: item.description,
          "aria-current": isRouteActive(item.path) ? "page" : void 0
        }, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              ssrRenderVNode(_push2, createVNode(resolveDynamicComponent(item.icon), {
                class: ["flex-shrink-0 w-10 h-10 theme-nav-icon-hover", [
                  props.isExpanded ? "mr-3" : "",
                  isRouteActive(item.path) ? "theme-nav-active" : "theme-text-subtle"
                ]],
                "aria-hidden": "true"
              }, null), _parent2, _scopeId);
              if (props.isExpanded) {
                _push2(`<span class="truncate" data-v-0b774d2b${_scopeId}>${ssrInterpolate(item.name)}</span>`);
              } else {
                _push2(`<!---->`);
              }
            } else {
              return [
                (openBlock(), createBlock(resolveDynamicComponent(item.icon), {
                  class: ["flex-shrink-0 w-10 h-10 theme-nav-icon-hover", [
                    props.isExpanded ? "mr-3" : "",
                    isRouteActive(item.path) ? "theme-nav-active" : "theme-text-subtle"
                  ]],
                  "aria-hidden": "true"
                }, null, 8, ["class"])),
                props.isExpanded ? (openBlock(), createBlock("span", {
                  key: 0,
                  class: "truncate"
                }, toDisplayString(item.name), 1)) : createCommentVNode("", true)
              ];
            }
          }),
          _: 2
        }, _parent));
        _push(`</li>`);
      });
      _push(`<!--]--></ul></div>`);
      if (roleBasedItems.value.length > 0) {
        _push(`<div class="py-2 theme-nav-border" data-v-0b774d2b>`);
        if (props.isExpanded) {
          _push(`<div class="px-4 py-2" data-v-0b774d2b><h3 class="text-xs font-semibold theme-text-subtle uppercase tracking-wider" data-v-0b774d2b>Administration</h3></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<ul class="space-y-1 px-2" data-v-0b774d2b><!--[-->`);
        ssrRenderList(roleBasedItems.value, (item) => {
          _push(`<li data-v-0b774d2b>`);
          _push(ssrRenderComponent(_component_router_link, {
            to: item.path,
            class: ["nav-item group flex items-center text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", [
              props.isExpanded ? "px-4 py-3" : "px-2 py-2 justify-center",
              isRouteActive(item.path) ? "theme-error theme-on-error border-l-4 theme-nav-border" : "theme-text-muted theme-hover-background"
            ]],
            title: item.description,
            "aria-current": isRouteActive(item.path) ? "page" : void 0
          }, {
            default: withCtx((_, _push2, _parent2, _scopeId) => {
              if (_push2) {
                ssrRenderVNode(_push2, createVNode(resolveDynamicComponent(item.icon), {
                  class: ["flex-shrink-0 w-10 h-10 theme-nav-icon-hover", [
                    props.isExpanded ? "mr-3" : "",
                    isRouteActive(item.path) ? "theme-on-error" : "theme-text-subtle"
                  ]],
                  "aria-hidden": "true"
                }, null), _parent2, _scopeId);
                if (props.isExpanded) {
                  _push2(`<span class="truncate" data-v-0b774d2b${_scopeId}>${ssrInterpolate(item.name)}</span>`);
                } else {
                  _push2(`<!---->`);
                }
              } else {
                return [
                  (openBlock(), createBlock(resolveDynamicComponent(item.icon), {
                    class: ["flex-shrink-0 w-10 h-10 theme-nav-icon-hover", [
                      props.isExpanded ? "mr-3" : "",
                      isRouteActive(item.path) ? "theme-on-error" : "theme-text-subtle"
                    ]],
                    "aria-hidden": "true"
                  }, null, 8, ["class"])),
                  props.isExpanded ? (openBlock(), createBlock("span", {
                    key: 0,
                    class: "truncate"
                  }, toDisplayString(item.name), 1)) : createCommentVNode("", true)
                ];
              }
            }),
            _: 2
          }, _parent));
          _push(`</li>`);
        });
        _push(`<!--]--></ul></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div><div class="flex-shrink-0 theme-nav-border p-2" data-v-0b774d2b><div class="space-y-1" data-v-0b774d2b>`);
      if (props.showNotifications) {
        _push(`<button class="${ssrRenderClass([props.isExpanded ? "px-4 py-3" : "px-2 py-2 justify-center", "w-full flex items-center text-sm font-medium theme-text-muted rounded-lg theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group"])}" aria-label="View notifications" data-v-0b774d2b><div class="relative flex-shrink-0" data-v-0b774d2b>`);
        _push(ssrRenderComponent(unref(BellIcon), {
          class: ["w-10 h-10 theme-text-subtle theme-nav-icon-hover", props.isExpanded ? "mr-3" : ""]
        }, null, _parent));
        if (props.notificationCount > 0) {
          _push(`<span class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none theme-on-error theme-error rounded-full min-w-[18px] h-[18px] shadow-sm"${ssrRenderAttr("aria-label", `${props.notificationCount} unread notifications`)} data-v-0b774d2b>${ssrInterpolate(props.notificationCount > 99 ? "99+" : props.notificationCount)}</span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
        if (props.isExpanded) {
          _push(`<span class="truncate" data-v-0b774d2b>Notifications</span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</button>`);
      } else {
        _push(`<!---->`);
      }
      if (authIsAuthenticated.value) {
        _push(`<button class="${ssrRenderClass([props.isExpanded ? "px-4 py-3" : "px-2 py-2 justify-center", "w-full flex items-center text-sm font-medium theme-text-muted rounded-lg theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group"])}" data-v-0b774d2b>`);
        _push(ssrRenderComponent(unref(UserIcon), {
          class: ["flex-shrink-0 w-10 h-10 theme-text-subtle theme-nav-icon-hover", props.isExpanded ? "mr-3" : ""],
          "aria-hidden": "true"
        }, null, _parent));
        if (props.isExpanded) {
          _push(`<span class="truncate" data-v-0b774d2b>Profile</span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</button>`);
      } else {
        _push(`<button class="${ssrRenderClass([props.isExpanded ? "px-4 py-3" : "px-2 py-2 justify-center", "w-full flex items-center text-sm font-medium theme-text-muted rounded-lg theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group"])}" title="Login" data-v-0b774d2b>`);
        _push(ssrRenderComponent(unref(ArrowRightOnRectangleIcon), {
          class: ["flex-shrink-0 w-10 h-10 theme-text-subtle theme-nav-icon-hover", props.isExpanded ? "mr-3" : ""],
          "aria-hidden": "true"
        }, null, _parent));
        if (props.isExpanded) {
          _push(`<span class="truncate" data-v-0b774d2b>Login</span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</button>`);
      }
      if (authIsAuthenticated.value) {
        _push(`<button class="${ssrRenderClass([props.isExpanded ? "px-4 py-3" : "px-2 py-2 justify-center", "w-full flex items-center text-sm font-medium theme-text-muted rounded-lg hover:theme-error hover:theme-on-error focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 group"])}" data-v-0b774d2b>`);
        _push(ssrRenderComponent(unref(ArrowLeftOnRectangleIcon), {
          class: ["flex-shrink-0 w-10 h-10 theme-text-subtle theme-nav-icon-hover", props.isExpanded ? "mr-3" : ""],
          "aria-hidden": "true"
        }, null, _parent));
        if (props.isExpanded) {
          _push(`<span class="truncate" data-v-0b774d2b>Logout</span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</button>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div></aside>`);
    };
  }
});

const _sfc_setup$8 = _sfc_main$8.setup;
_sfc_main$8.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/navigation/NavigationRail.vue");
  return _sfc_setup$8 ? _sfc_setup$8(props, ctx) : void 0;
};
const NavigationRail = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["__scopeId", "data-v-0b774d2b"]]);

const _sfc_main$7 = /* @__PURE__ */ defineComponent({
  __name: "NavigationDrawer",
  __ssrInlineRender: true,
  props: {
    isOpen: { type: Boolean },
    currentRoute: {},
    userRole: {},
    isAuthenticated: { type: Boolean },
    auth: {}
  },
  emits: [
    "update:isOpen",
    "searchSubmit",
    "profileClick",
    "logoutClick",
    "loginClick",
    "aboutModalOpen"
  ],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const authIsAuthenticated = computed(() => {
      if (props.auth && typeof props.auth.isAuthenticated === "boolean") return props.auth.isAuthenticated;
      return props.isAuthenticated ?? false;
    });
    const authUserRole = computed(() => {
      if (props.auth && props.auth.userRole) return props.auth.userRole;
      return props.userRole ?? "user";
    });
    const emit = __emit;
    const route = useRoute();
    ref();
    const closeButtonRef = ref();
    const navigationItems = computed(() => [
      {
        name: "Map",
        path: "/",
        icon: MapIcon,
        description: "Explore artwork on the map"
      },
      {
        name: "Artworks",
        path: "/artworks",
        icon: PhotoIcon,
        description: "Browse all artworks"
      },
      {
        name: "Artists",
        path: "/artists",
        icon: UserGroupIcon,
        description: "Discover artists"
      },
      {
        name: "Search",
        path: "/search",
        icon: MagnifyingGlassIcon,
        description: "Search artworks and artists"
      },
      {
        name: "Help",
        path: "/help",
        icon: QuestionMarkCircleIcon,
        description: "Help"
      }
    ]);
    const roleBasedItems = computed(() => {
      const items = [];
      if (authUserRole.value === "admin") {
        items.push({
          name: "Admin",
          path: "/admin",
          icon: ShieldCheckIcon,
          description: "Admin dashboard"
        });
      }
      if (authUserRole.value === "admin" || authUserRole.value === "moderator") {
        items.push({
          name: "Moderate",
          path: "/review",
          icon: ClipboardDocumentListIcon,
          description: "Review submissions"
        });
      }
      return items;
    });
    const isActiveRoute = (path) => {
      if (path === "/") {
        return route.path === "/";
      }
      return route.path.startsWith(path);
    };
    const handleClose = () => {
      emit("update:isOpen", false);
    };
    const handleNavItemClick = () => {
      handleClose();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    const handleFocusManagement = () => {
      if (props.isOpen) {
        nextTick(() => {
          closeButtonRef.value?.focus();
        });
      }
    };
    watch(() => props.isOpen, (isOpen) => {
      if (isOpen) {
        handleFocusManagement();
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleKeyDown);
      } else {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handleKeyDown);
      }
    });
    onUnmounted(() => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<!--[-->`);
      if (props.isOpen) {
        _push(`<div class="fixed inset-0 bg-black bg-opacity-50 z-40" aria-hidden="true" data-v-a8b80fa2></div>`);
      } else {
        _push(`<!---->`);
      }
      if (props.isOpen) {
        _push(`<nav class="navigation-drawer fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-xl z-50 flex flex-col" role="dialog" aria-modal="true" aria-labelledby="drawer-title" data-v-a8b80fa2><div class="flex-shrink-0 flex items-center justify-between h-16 px-4 bg-blue-600 text-white" data-v-a8b80fa2><div class="flex items-center space-x-3" data-v-a8b80fa2><div class="text-2xl flex-shrink-0" role="img" aria-label="Public Art Registry logo" data-v-a8b80fa2>🎨</div><h2 id="drawer-title" class="text-lg font-semibold truncate" data-v-a8b80fa2>Public Art Registry</h2></div><button class="flex items-center justify-center w-10 h-10 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors" aria-label="Close navigation menu" data-v-a8b80fa2>`);
        _push(ssrRenderComponent(unref(XMarkIcon), {
          class: "w-10 h-10",
          "aria-hidden": "true"
        }, null, _parent));
        _push(`</button></div><div class="flex-1 overflow-y-auto" data-v-a8b80fa2><div class="py-2" data-v-a8b80fa2><ul class="space-y-1 px-2" data-v-a8b80fa2><!--[-->`);
        ssrRenderList(navigationItems.value, (item) => {
          _push(`<li data-v-a8b80fa2>`);
          _push(ssrRenderComponent(unref(RouterLink), {
            to: item.path,
            class: ["nav-item group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", {
              "bg-blue-50 text-blue-700 border-l-4 border-blue-700": isActiveRoute(item.path),
              "text-gray-700 hover:bg-gray-50 hover:text-gray-900": !isActiveRoute(item.path)
            }],
            "aria-current": isActiveRoute(item.path) ? "page" : void 0,
            onClick: handleNavItemClick
          }, {
            default: withCtx((_, _push2, _parent2, _scopeId) => {
              if (_push2) {
                ssrRenderVNode(_push2, createVNode(resolveDynamicComponent(item.icon), {
                  class: ["flex-shrink-0 w-10 h-10 mr-3", {
                    "text-blue-600": isActiveRoute(item.path),
                    "text-gray-400 group-hover:text-gray-500": !isActiveRoute(item.path)
                  }],
                  "aria-hidden": "true"
                }, null), _parent2, _scopeId);
                _push2(`<span class="truncate" data-v-a8b80fa2${_scopeId}>${ssrInterpolate(item.name)}</span>`);
              } else {
                return [
                  (openBlock(), createBlock(resolveDynamicComponent(item.icon), {
                    class: ["flex-shrink-0 w-10 h-10 mr-3", {
                      "text-blue-600": isActiveRoute(item.path),
                      "text-gray-400 group-hover:text-gray-500": !isActiveRoute(item.path)
                    }],
                    "aria-hidden": "true"
                  }, null, 8, ["class"])),
                  createVNode("span", { class: "truncate" }, toDisplayString(item.name), 1)
                ];
              }
            }),
            _: 2
          }, _parent));
          _push(`</li>`);
        });
        _push(`<!--]--></ul></div>`);
        if (roleBasedItems.value.length > 0) {
          _push(`<div class="py-2 border-t border-gray-200" data-v-a8b80fa2><div class="px-4 py-2" data-v-a8b80fa2><h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider" data-v-a8b80fa2>Administration</h3></div><ul class="space-y-1 px-2" data-v-a8b80fa2><!--[-->`);
          ssrRenderList(roleBasedItems.value, (item) => {
            _push(`<li data-v-a8b80fa2>`);
            _push(ssrRenderComponent(unref(RouterLink), {
              to: item.path,
              class: ["nav-item group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", {
                "bg-red-50 text-red-700 border-l-4 border-red-700": isActiveRoute(item.path),
                "text-gray-700 hover:bg-gray-50 hover:text-gray-900": !isActiveRoute(item.path)
              }],
              "aria-current": isActiveRoute(item.path) ? "page" : void 0,
              onClick: handleNavItemClick
            }, {
              default: withCtx((_, _push2, _parent2, _scopeId) => {
                if (_push2) {
                  ssrRenderVNode(_push2, createVNode(resolveDynamicComponent(item.icon), {
                    class: ["flex-shrink-0 w-10 h-10 mr-3", {
                      "text-red-600": isActiveRoute(item.path),
                      "text-gray-400 group-hover:text-gray-500": !isActiveRoute(item.path)
                    }],
                    "aria-hidden": "true"
                  }, null), _parent2, _scopeId);
                  _push2(`<span class="truncate" data-v-a8b80fa2${_scopeId}>${ssrInterpolate(item.name)}</span>`);
                } else {
                  return [
                    (openBlock(), createBlock(resolveDynamicComponent(item.icon), {
                      class: ["flex-shrink-0 w-10 h-10 mr-3", {
                        "text-red-600": isActiveRoute(item.path),
                        "text-gray-400 group-hover:text-gray-500": !isActiveRoute(item.path)
                      }],
                      "aria-hidden": "true"
                    }, null, 8, ["class"])),
                    createVNode("span", { class: "truncate" }, toDisplayString(item.name), 1)
                  ];
                }
              }),
              _: 2
            }, _parent));
            _push(`</li>`);
          });
          _push(`<!--]--></ul></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div><div class="flex-shrink-0 border-t border-gray-200 p-2" data-v-a8b80fa2><div class="space-y-1" data-v-a8b80fa2>`);
        if (authIsAuthenticated.value) {
          _push(`<button class="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200" data-v-a8b80fa2>`);
          _push(ssrRenderComponent(unref(UserIcon), {
            class: "flex-shrink-0 w-10 h-10 mr-3 text-gray-400",
            "aria-hidden": "true"
          }, null, _parent));
          _push(`<span class="truncate" data-v-a8b80fa2>Profile</span></button>`);
        } else {
          _push(`<button class="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200" data-v-a8b80fa2>`);
          _push(ssrRenderComponent(unref(ArrowRightOnRectangleIcon), {
            class: "flex-shrink-0 w-10 h-10 mr-3 text-gray-400",
            "aria-hidden": "true"
          }, null, _parent));
          _push(`<span class="truncate" data-v-a8b80fa2>Login</span></button>`);
        }
        if (authIsAuthenticated.value) {
          _push(`<button class="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200" data-v-a8b80fa2>`);
          _push(ssrRenderComponent(unref(ArrowLeftOnRectangleIcon), {
            class: "flex-shrink-0 w-10 h-10 mr-3 text-gray-400",
            "aria-hidden": "true"
          }, null, _parent));
          _push(`<span class="truncate" data-v-a8b80fa2>Logout</span></button>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div></nav>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<!--]-->`);
    };
  }
});

const _sfc_setup$7 = _sfc_main$7.setup;
_sfc_main$7.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/navigation/NavigationDrawer.vue");
  return _sfc_setup$7 ? _sfc_setup$7(props, ctx) : void 0;
};
const NavigationDrawer = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["__scopeId", "data-v-a8b80fa2"]]);

const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  __name: "AboutModal",
  __ssrInlineRender: true,
  props: {
    isOpen: { type: Boolean }
  },
  emits: ["update:isOpen", "close"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const modalRef = ref();
    const closeButtonRef = ref();
    const handleClose = () => {
      emit("update:isOpen", false);
      emit("close");
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    const handleFocusManagement = () => {
      if (props.isOpen) {
        nextTick(() => {
          closeButtonRef.value?.focus();
        });
      }
    };
    watch(() => props.isOpen, (isOpen) => {
      if (isOpen) {
        handleFocusManagement();
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleKeyDown);
      } else {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handleKeyDown);
      }
    });
    onUnmounted(() => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    });
    return (_ctx, _push, _parent, _attrs) => {
      if (_ctx.isOpen) {
        _push(`<div${ssrRenderAttrs(mergeProps({
          ref_key: "modalRef",
          ref: modalRef,
          class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "modal-title"
        }, _attrs))} data-v-2f8fde3d><div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden" data-v-2f8fde3d><div class="flex items-center justify-between p-6 border-b border-gray-200" data-v-2f8fde3d><div class="flex items-center space-x-3" data-v-2f8fde3d><div class="text-2xl" role="img" aria-label="Public Art Registry logo" data-v-2f8fde3d>🎨</div><h2 id="modal-title" class="text-xl font-semibold text-gray-900" data-v-2f8fde3d>About Public Art Registry</h2></div><button class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" aria-label="Close modal" data-v-2f8fde3d>`);
        _push(ssrRenderComponent(unref(XMarkIcon), {
          class: "w-5 h-5 text-gray-500",
          "aria-hidden": "true"
        }, null, _parent));
        _push(`</button></div><div class="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]" data-v-2f8fde3d><div class="prose prose-blue max-w-none" data-v-2f8fde3d><h3 class="text-lg font-semibold text-gray-900 mb-4" data-v-2f8fde3d>Our Mission</h3><p class="text-gray-700 mb-4" data-v-2f8fde3d> The Public Art Registry is a community-driven platform dedicated to documenting and celebrating public art in all its forms. We believe that public art enriches our communities, tells important stories, and deserves to be preserved for future generations. </p><h3 class="text-lg font-semibold text-gray-900 mb-4" data-v-2f8fde3d>What We Do</h3><ul class="text-gray-700 mb-4 space-y-2" data-v-2f8fde3d><li class="flex items-start" data-v-2f8fde3d><span class="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" data-v-2f8fde3d></span><span data-v-2f8fde3d><strong data-v-2f8fde3d>Document:</strong> Catalog public artworks with detailed information, photos, and location data</span></li><li class="flex items-start" data-v-2f8fde3d><span class="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" data-v-2f8fde3d></span><span data-v-2f8fde3d><strong data-v-2f8fde3d>Discover:</strong> Help people find and explore public art in their communities</span></li><li class="flex items-start" data-v-2f8fde3d><span class="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" data-v-2f8fde3d></span><span data-v-2f8fde3d><strong data-v-2f8fde3d>Connect:</strong> Build a community of art enthusiasts, historians, and cultural advocates</span></li><li class="flex items-start" data-v-2f8fde3d><span class="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" data-v-2f8fde3d></span><span data-v-2f8fde3d><strong data-v-2f8fde3d>Preserve:</strong> Create a lasting digital archive of public art for research and education</span></li></ul><h3 class="text-lg font-semibold text-gray-900 mb-4" data-v-2f8fde3d>Get Involved</h3><p class="text-gray-700 mb-4" data-v-2f8fde3d> Whether you&#39;re an artist, art lover, historian, or simply curious about the art in your neighborhood, there are many ways to contribute: </p><ul class="text-gray-700 mb-6 space-y-2" data-v-2f8fde3d><li class="flex items-start" data-v-2f8fde3d><span class="inline-block w-1.5 h-1.5 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0" data-v-2f8fde3d></span><span data-v-2f8fde3d>Submit photos and information about public artworks you encounter</span></li><li class="flex items-start" data-v-2f8fde3d><span class="inline-block w-1.5 h-1.5 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0" data-v-2f8fde3d></span><span data-v-2f8fde3d>Help verify and improve existing artwork entries</span></li><li class="flex items-start" data-v-2f8fde3d><span class="inline-block w-1.5 h-1.5 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0" data-v-2f8fde3d></span><span data-v-2f8fde3d>Share stories and insights about the art and artists in your community</span></li><li class="flex items-start" data-v-2f8fde3d><span class="inline-block w-1.5 h-1.5 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0" data-v-2f8fde3d></span><span data-v-2f8fde3d>Spread the word about this valuable cultural resource</span></li></ul><div class="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400" data-v-2f8fde3d><p class="text-sm text-blue-800" data-v-2f8fde3d><strong data-v-2f8fde3d>Open Source &amp; Community Driven:</strong> This platform is built by and for the community. Our goal is to make public art more accessible and to ensure that these important cultural artifacts are documented and preserved for everyone to enjoy. </p></div></div></div><div class="flex justify-end p-6 border-t border-gray-200 bg-gray-50" data-v-2f8fde3d><button class="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" data-v-2f8fde3d> Close </button></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
    };
  }
});

const _sfc_setup$6 = _sfc_main$6.setup;
_sfc_main$6.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/navigation/AboutModal.vue");
  return _sfc_setup$6 ? _sfc_setup$6(props, ctx) : void 0;
};
const AboutModal = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["__scopeId", "data-v-2f8fde3d"]]);

const _sfc_main$5 = /* @__PURE__ */ defineComponent({
  __name: "AppShell",
  __ssrInlineRender: true,
  props: {
    title: {}
  },
  setup(__props) {
    const showDrawer = ref(false);
    const showAuthModal = ref(false);
    const authMode = ref("login");
    const showAboutModal = ref(false);
    const showFeedbackDialog = ref(false);
    const feedbackDefaultNote = ref("");
    const route = useRoute();
    const router = useRouter();
    const authStore = useAuthStore();
    const notificationsStore = useNotificationsStore();
    const { showNavigationRail } = useBreakpoint();
    const log = createLogger({ module: "frontend:AppShell" });
    const navExpanded = ref(true);
    const auth = computed(() => ({
      isAuthenticated: authStore.isAuthenticated,
      userDisplayName: authStore.user?.email ?? "",
      userRole: authStore.isAdmin ? "admin" : authStore.canReview ? "moderator" : "user"
    }));
    function handleToggleRail() {
      navExpanded.value = !navExpanded.value;
      try {
        window.dispatchEvent(new CustomEvent("nav-rail-toggle", { detail: { expanded: navExpanded.value } }));
      } catch (e) {
      }
    }
    const fastFileInput = ref(null);
    const fastSelected = ref([]);
    const fastIsProcessing = ref(false);
    const fastHasNavigated = ref(false);
    const fastFinalLocation = ref(null);
    const fastLocationSources = ref({
      exif: { detected: false, error: false, coordinates: null },
      browser: { detected: false, error: false, coordinates: null }
    });
    useGeolocation();
    function resetFastAddState() {
      fastSelected.value = [];
      fastFinalLocation.value = null;
      fastLocationSources.value = {
        exif: { detected: false, error: false, coordinates: null },
        browser: { detected: false, error: false, coordinates: null }
      };
      try {
        const store = useFastUploadSessionStore();
        store.clear?.();
      } catch {
      }
      try {
        sessionStorage.removeItem("fast-upload-session");
      } catch {
      }
      fastHasNavigated.value = false;
    }
    function triggerFastAdd() {
      if (fastIsProcessing.value) return;
      if (fastHasNavigated.value) {
        resetFastAddState();
      }
      try {
        router.push("/add");
      } catch (e) {
      }
      fastFileInput.value?.click();
    }
    function openAuthModal(mode = "login") {
      authMode.value = mode;
      showAuthModal.value = true;
    }
    function closeAuthModal() {
      showAuthModal.value = false;
    }
    function handleAuthSuccess(payload) {
      closeAuthModal();
      log.info("Authentication successful", { payload });
    }
    async function handleLogout() {
      const confirmed = confirm("Are you sure you want to sign out?");
      if (!confirmed) {
        return;
      }
      try {
        await authStore.logout();
      } catch (error) {
        log.error("Logout failed", { error });
      }
    }
    function handleDrawerToggle() {
      showDrawer.value = !showDrawer.value;
    }
    function setShowDrawer(value) {
      showDrawer.value = value;
    }
    function handleFeedbackClick() {
      const currentUrl = window.location.href;
      const userToken = authStore.token || "anonymous";
      feedbackDefaultNote.value = `Feedback url: ${currentUrl}
User token: ${userToken}

`;
      showFeedbackDialog.value = true;
    }
    function closeFeedbackDialog() {
      showFeedbackDialog.value = false;
      feedbackDefaultNote.value = "";
    }
    function handleFeedbackSuccess(feedbackId) {
      log.info("Feedback submitted successfully", { feedbackId });
    }
    function handleAboutClick() {
      showAboutModal.value = true;
    }
    function handleAboutModalClose() {
      showAboutModal.value = false;
    }
    function handleSearch(query) {
      if (query.trim()) {
        router.push(`/search/results?q=${encodeURIComponent(query.trim())}`);
      }
    }
    function handleNotificationClick() {
      router.push("/profile/notifications");
    }
    function handleMapClick() {
      router.push("/");
    }
    function handleKeydown(event) {
      if (event.key === "Escape") {
        if (showDrawer.value) {
          showDrawer.value = false;
          return;
        }
      }
      if (showDrawer.value && event.key === "Tab") {
        handleTabTrapping(event);
      }
    }
    function handleTabTrapping(event) {
      const drawer = document.querySelector('[role="dialog"]');
      if (!drawer) return;
      const focusableElements = drawer.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
    onMounted(() => {
      document.addEventListener("keydown", handleKeydown);
      if (authStore.isAuthenticated) {
        notificationsStore.startPolling();
      }
    });
    onUnmounted(() => {
      document.removeEventListener("keydown", handleKeydown);
      notificationsStore.stopPolling();
    });
    watch(() => route.path, () => {
      showDrawer.value = false;
    });
    watch(() => authStore.isAuthenticated, (isAuthenticated) => {
      if (isAuthenticated) {
        notificationsStore.startPolling();
      } else {
        notificationsStore.stopPolling();
        notificationsStore.resetState();
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "app-shell" }, _attrs))} data-v-d6e21a99><a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md" data-v-d6e21a99> Skip to main content </a>`);
      if (unref(showNavigationRail)) {
        _push(ssrRenderComponent(NavigationRail, {
          "is-expanded": navExpanded.value,
          "notification-count": unref(notificationsStore).unreadCount,
          "show-notifications": unref(authStore).isAuthenticated,
          auth: auth.value,
          onToggleExpanded: handleToggleRail,
          onNotificationClick: handleNotificationClick,
          onProfileClick: () => unref(router).push("/profile"),
          onLoginClick: () => openAuthModal("login"),
          onLogoutClick: handleLogout
        }, null, _parent));
      } else {
        _push(`<!---->`);
      }
      _push(ssrRenderComponent(BottomNavigation, {
        "current-route": unref(route).path,
        "notification-count": unref(notificationsStore).unreadCount,
        "show-notifications": unref(authStore).isAuthenticated,
        auth: auth.value,
        onMenuToggle: handleDrawerToggle,
        onFabClick: triggerFastAdd,
        onMapClick: handleMapClick,
        onNotificationClick: handleNotificationClick,
        onProfileClick: () => unref(router).push("/profile"),
        onLoginClick: () => openAuthModal("login"),
        onFeedbackClick: handleFeedbackClick
      }, null, _parent));
      _push(ssrRenderComponent(NavigationDrawer, {
        "is-open": showDrawer.value,
        "current-route": unref(route).path,
        auth: auth.value,
        "onUpdate:isOpen": setShowDrawer,
        onSearchSubmit: handleSearch,
        onProfileClick: () => unref(router).push("/profile"),
        onAboutModalOpen: handleAboutClick,
        onLoginClick: () => openAuthModal("login"),
        onLogoutClick: handleLogout
      }, null, _parent));
      _push(`<main id="main-content" role="main" class="${ssrRenderClass([{
        "pb-16": true,
        "lg:ml-80": unref(showNavigationRail) && navExpanded.value,
        "lg:ml-16": unref(showNavigationRail) && !navExpanded.value
      }, "app-main"])}" data-v-d6e21a99>`);
      _push(ssrRenderComponent(unref(RouterView), null, null, _parent));
      _push(`</main><input type="file" accept="image/*" multiple class="hidden" data-v-d6e21a99>`);
      _push(ssrRenderComponent(LiveRegion, null, null, _parent));
      _push(ssrRenderComponent(AuthModal, {
        "is-open": showAuthModal.value,
        mode: authMode.value,
        onClose: closeAuthModal,
        onSuccess: handleAuthSuccess
      }, null, _parent));
      _push(ssrRenderComponent(AboutModal, {
        "is-open": showAboutModal.value,
        onClose: handleAboutModalClose
      }, null, _parent));
      _push(ssrRenderComponent(FeedbackDialog, {
        open: showFeedbackDialog.value,
        "subject-type": "general",
        "subject-id": "general-feedback",
        mode: "general",
        "default-note": feedbackDefaultNote.value,
        onClose: closeFeedbackDialog,
        onSuccess: handleFeedbackSuccess
      }, null, _parent));
      _push(ssrRenderComponent(Toasts, null, null, _parent));
      _push(`</div>`);
    };
  }
});

const _sfc_setup$5 = _sfc_main$5.setup;
_sfc_main$5.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/AppShell.vue");
  return _sfc_setup$5 ? _sfc_setup$5(props, ctx) : void 0;
};
const AppShell = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["__scopeId", "data-v-d6e21a99"]]);

const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "ErrorBoundary",
  __ssrInlineRender: true,
  props: {
    fallback: { type: Function }
  },
  setup(__props, { expose: __expose }) {
    const props = __props;
    useRouter();
    const hasError = ref(false);
    const error = ref(null);
    const errorInfo = ref(null);
    const referenceId = ref(null);
    const isProduction = computed(() => true);
    onErrorCaptured((err, instance, info) => {
      console.error("ErrorBoundary caught error:", err);
      console.error("Component info:", info);
      hasError.value = true;
      referenceId.value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      error.value = err;
      errorInfo.value = {
        componentName: instance?.$options.name || "Unknown",
        propsData: instance?.$props,
        trace: info
      };
      if (props.fallback) {
        props.fallback();
      }
      return false;
    });
    onMounted(() => {
      if (typeof window !== "undefined") {
        window.addEventListener("unhandledrejection", (event) => {
          console.error("Unhandled promise rejection:", event.reason);
          hasError.value = true;
          referenceId.value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          let errObj;
          if (event.reason instanceof Error) {
            errObj = event.reason;
          } else if (typeof event.reason === "object" && event.reason !== null && "message" in event.reason) {
            errObj = new Error(String(event.reason.message));
            if ("stack" in event.reason) errObj.stack = event.reason.stack;
          } else {
            errObj = new Error(
              typeof event.reason === "string" ? event.reason : JSON.stringify(event.reason)
            );
          }
          error.value = errObj;
          errorInfo.value = {
            componentName: "Global",
            trace: errObj.stack || "No stack trace available"
          };
        });
        window.addEventListener("error", (event) => {
          console.error("Global JavaScript error:", event.error);
          hasError.value = true;
          referenceId.value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          error.value = event.error || new Error(event.message);
          errorInfo.value = {
            componentName: "Global",
            trace: event.error?.stack || "No stack trace available"
          };
        });
      }
    });
    const buildErrorReportObject = () => {
      let artworkId = null;
      if (typeof window !== "undefined" && window.location?.pathname) {
        const match = window.location.pathname.match(/\/artwork\/([^/]+)/);
        if (match) artworkId = decodeURIComponent(match[1]);
      }
      return {
        referenceId: referenceId.value,
        message: error.value?.message || "Unknown error",
        stack: error.value?.stack || "No stack trace",
        component: errorInfo.value?.componentName || "Unknown",
        trace: errorInfo.value?.trace || "No trace",
        url: typeof window !== "undefined" ? window.location.href : "unknown",
        artworkId,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        appVersion: "unknown"
      };
    };
    const reset = () => {
      hasError.value = false;
      error.value = null;
      errorInfo.value = null;
    };
    __expose({
      reset
    });
    return (_ctx, _push, _parent, _attrs) => {
      if (hasError.value) {
        _push(`<div${ssrRenderAttrs(mergeProps({ class: "error-boundary" }, _attrs))} data-v-4d627d81><div class="min-h-screen flex items-center justify-center bg-gray-50 p-4" data-v-4d627d81><div class="w-full max-w-4xl mx-auto p-2" data-v-4d627d81><div class="bg-white rounded-xl shadow-2xl p-10 text-center border border-gray-200" data-v-4d627d81><div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6" data-v-4d627d81><svg class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-v-4d627d81><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" data-v-4d627d81></path></svg></div><h1 class="text-3xl font-bold text-gray-900 mb-2 tracking-tight" data-v-4d627d81>Something went wrong</h1>`);
        if (referenceId.value) {
          _push(`<p class="text-xs text-gray-500 mb-1" data-v-4d627d81> Reference ID: ${ssrInterpolate(referenceId.value)}</p>`);
        } else {
          _push(`<!---->`);
        }
        if (buildErrorReportObject().artworkId) {
          _push(`<p class="text-xs text-gray-500 mb-4" data-v-4d627d81> Artwork: ${ssrInterpolate(buildErrorReportObject().artworkId)}</p>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<p class="text-gray-600 mb-6" data-v-4d627d81>`);
        if (isProduction.value) {
          _push(`<span data-v-4d627d81> An unexpected error occurred. You can reload the page or send the report below to support. </span>`);
        } else {
          _push(`<span data-v-4d627d81>${ssrInterpolate(error.value?.message || "An unknown error occurred")}</span>`);
        }
        _push(`</p>`);
        if (isProduction.value && error.value) {
          _push(`<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded text-left" data-v-4d627d81><p class="text-sm text-red-700" data-v-4d627d81><strong data-v-4d627d81>Error:</strong> ${ssrInterpolate(error.value.message)}</p>`);
          if (errorInfo.value?.componentName) {
            _push(`<p class="text-xs text-red-600 mt-2" data-v-4d627d81> Component: ${ssrInterpolate(errorInfo.value.componentName)}</p>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div>`);
        } else {
          _push(`<!---->`);
        }
        if (!isProduction.value && error.value) {
          _push(`<div class="mb-6 p-4 bg-gray-100 rounded-lg text-left" data-v-4d627d81><details data-v-4d627d81><summary class="font-medium text-gray-700 cursor-pointer mb-2" data-v-4d627d81>Error Details</summary><div class="text-sm text-gray-600 font-mono" data-v-4d627d81><p class="mb-2" data-v-4d627d81><strong data-v-4d627d81>Message:</strong> ${ssrInterpolate(error.value.message)}</p><p class="mb-2" data-v-4d627d81><strong data-v-4d627d81>Component:</strong> ${ssrInterpolate(errorInfo.value?.componentName || "Unknown")}</p>`);
          if (error.value.stack) {
            _push(`<div class="whitespace-pre-wrap" data-v-4d627d81><strong data-v-4d627d81>Stack Trace:</strong> ${ssrInterpolate(error.value.stack)}</div>`);
          } else {
            _push(`<!---->`);
          }
          _push(`</div></details></div>`);
        } else {
          _push(`<!---->`);
        }
        if (error.value) {
          _push(`<div class="mb-8 p-5 bg-gray-50 rounded-lg text-left border border-gray-200" data-v-4d627d81><details data-v-4d627d81><summary class="font-medium text-gray-700 cursor-pointer mb-2" data-v-4d627d81> Technical Report (JSON) </summary><pre class="text-xs leading-relaxed text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-96" data-v-4d627d81>${ssrInterpolate(JSON.stringify(buildErrorReportObject(), null, 2))}</pre><button type="button" class="mt-2 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-gray-800 text-white hover:bg-gray-700" data-v-4d627d81> Copy Details </button></details></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<div class="flex flex-col sm:flex-row gap-4 justify-center" data-v-4d627d81><button class="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-semibold" data-v-4d627d81> Reload Page </button><button class="px-8 py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm font-semibold" data-v-4d627d81> Go to Home </button></div><div class="mt-10 pt-6 border-t border-gray-200" data-v-4d627d81><p class="text-sm text-gray-500 mb-2" data-v-4d627d81> If this error persists, please report it to help us improve the app. </p><button class="text-blue-600 hover:text-blue-700 text-sm font-medium underline decoration-dotted" data-v-4d627d81> Report this issue </button></div></div></div></div></div>`);
      } else {
        _push(`<div${ssrRenderAttrs(_attrs)} data-v-4d627d81>`);
        ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
        _push(`</div>`);
      }
    };
  }
});

const _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ErrorBoundary.vue");
  return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
const ErrorBoundary = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-4d627d81"]]);

const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "FirstTimeModal",
  __ssrInlineRender: true,
  setup(__props, { expose: __expose }) {
    const isVisible = ref(false);
    useRouter();
    const checkFirstVisit = () => {
      const hasVisited = localStorage.getItem("cultural-archiver-visited");
      if (!hasVisited) {
        localStorage.setItem("cultural-archiver-visited", "true");
        setTimeout(() => {
          isVisible.value = true;
        }, 500);
      }
    };
    onMounted(() => {
      checkFirstVisit();
    });
    __expose({
      open: () => {
        isVisible.value = true;
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      ssrRenderTeleport(_push, (_push2) => {
        if (isVisible.value) {
          _push2(`<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-description" data-v-21e7e54e><div class="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" data-v-21e7e54e><button class="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md z-10" aria-label="Close welcome dialog" data-v-21e7e54e>`);
          _push2(ssrRenderComponent(unref(XMarkIcon), { class: "h-5 w-5" }, null, _parent));
          _push2(`</button><div class="px-6 pt-6 pb-4" data-v-21e7e54e><div class="flex items-center space-x-3 mb-4" data-v-21e7e54e><div class="text-3xl" role="img" aria-label="Public Art Registry logo" data-v-21e7e54e>🎨</div><h2 id="welcome-title" class="text-2xl font-bold text-gray-900" data-v-21e7e54e> Welcome to Public Art Registry </h2></div></div><div id="welcome-description" class="px-6 pb-6" data-v-21e7e54e><div class="space-y-4 text-gray-700" data-v-21e7e54e><p class="text-lg leading-relaxed" data-v-21e7e54e><strong data-v-21e7e54e>Public art</strong> is fragile. Murals fade, sculptures crumble, stories vanish. If no one <strong data-v-21e7e54e>honors</strong> them, they are <strong data-v-21e7e54e>lost - forever</strong>. </p><p class="text-lg leading-relaxed" data-v-21e7e54e> By preserving artworks and committing them to this archive, you safeguard our shared cultural story - a legacy of memory and meaning for <strong data-v-21e7e54e>generations yet to come.</strong></p><p class="text-lg leading-relaxed" data-v-21e7e54e> This is your chance to <strong data-v-21e7e54e>protect what matters</strong>. To give the future the legacy of memory. </p></div><div class="mt-8" data-v-21e7e54e><h3 class="text-xl font-bold text-gray-900 mb-4" data-v-21e7e54e>Be the Hero</h3><p class="text-gray-700 mb-6" data-v-21e7e54e> Every action you take makes you a <strong data-v-21e7e54e>guardian of culture</strong>. Each step is a way to honor artists, preserve their work, and inspire those who follow. </p><div class="grid grid-cols-1 sm:grid-cols-2 gap-4" data-v-21e7e54e><div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 flex flex-col" data-v-21e7e54e><div class="flex items-start mb-2" data-v-21e7e54e>`);
          _push2(ssrRenderComponent(unref(CameraIcon$1), { class: "h-6 w-6 text-blue-600 mr-2 flex-shrink-0" }, null, _parent));
          _push2(`<h4 class="font-bold text-gray-900" data-v-21e7e54e>Take photos of artworks</h4></div><p class="text-sm text-gray-700 mb-4 flex-grow" data-v-21e7e54e> Your photo could be the last record of a mural before it vanishes. By capturing it now, you become the guardian of its memory. </p><button class="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm" data-v-21e7e54e> Safeguard Creativity </button></div><div class="bg-green-100 border-2 border-green-300 rounded-lg p-4 flex flex-col" data-v-21e7e54e><div class="flex items-start mb-2" data-v-21e7e54e>`);
          _push2(ssrRenderComponent(unref(PencilSquareIcon), { class: "h-6 w-6 text-green-800 mr-2 flex-shrink-0" }, null, _parent));
          _push2(`<h4 class="font-bold text-gray-900" data-v-21e7e54e>Update artworks and artists</h4></div><p class="text-sm text-gray-700 mb-4 flex-grow" data-v-21e7e54e> Every detail you add protects the truth of our shared culture. You ensure future generations know the stories behind the art. </p><button class="bg-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors text-sm" data-v-21e7e54e> Protect History </button></div><div class="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 flex flex-col" data-v-21e7e54e><div class="flex items-start mb-2" data-v-21e7e54e>`);
          _push2(ssrRenderComponent(unref(MapIcon), { class: "h-6 w-6 text-purple-600 mr-2 flex-shrink-0" }, null, _parent));
          _push2(`<h4 class="font-bold text-gray-900" data-v-21e7e54e>Explore Art Nearby</h4></div><p class="text-sm text-gray-700 mb-4 flex-grow" data-v-21e7e54e> Artists create for others to witness. Your journey completes their work and preserves it for the future - every visit keeps the art alive. </p><button class="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors text-sm" data-v-21e7e54e> Discover Nearby Art </button></div><div class="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 flex flex-col" data-v-21e7e54e><div class="flex items-start mb-2" data-v-21e7e54e>`);
          _push2(ssrRenderComponent(unref(StarIcon), { class: "h-6 w-6 text-orange-600 mr-2 flex-shrink-0" }, null, _parent));
          _push2(`<h4 class="font-bold text-gray-900" data-v-21e7e54e>Highlight Great Works</h4></div><p class="text-sm text-gray-700 mb-4 flex-grow" data-v-21e7e54e> Art lives through connection. By choosing what inspires you, you pass that spark to those who follow - guiding them toward what matters most. </p><button class="bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors text-sm" data-v-21e7e54e> Share What Moves You </button></div></div></div></div></div></div>`);
        } else {
          _push2(`<!---->`);
        }
      }, "body", false, _parent);
    };
  }
});

const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/FirstTimeModal.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
const FirstTimeModal = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__scopeId", "data-v-21e7e54e"]]);

const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "Modal",
  __ssrInlineRender: true,
  props: {
    isOpen: { type: Boolean },
    title: {},
    message: {},
    confirmText: { default: "OK" },
    cancelText: { default: "Cancel" },
    showCancel: { type: Boolean, default: true },
    showCloseButton: { type: Boolean, default: true },
    variant: { default: "primary" },
    preventEscapeClose: { type: Boolean, default: false },
    preventBackdropClose: { type: Boolean, default: false },
    focusOnOpen: { default: "confirm" }
  },
  emits: ["update:isOpen", "confirm", "cancel", "close"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const modalPanel = ref();
    const confirmButton = ref();
    const cancelButton = ref();
    const closeButton = ref();
    const previouslyFocused = ref(null);
    const titleId = computed(() => `modal-title-${Math.random().toString(36).substr(2, 9)}`);
    const descriptionId = computed(
      () => `modal-description-${Math.random().toString(36).substr(2, 9)}`
    );
    const confirmButtonClass = computed(() => {
      const baseClass = "focus:ring-2 focus:ring-offset-2";
      switch (props.variant) {
        case "danger":
          return `${baseClass} bg-red-600 hover:bg-red-700 focus:ring-red-500`;
        case "warning":
          return `${baseClass} bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500`;
        default:
          return `${baseClass} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;
      }
    });
    function setInitialFocus() {
      nextTick(() => {
        let elementToFocus = null;
        switch (props.focusOnOpen) {
          case "cancel":
            elementToFocus = cancelButton.value || null;
            break;
          case "close":
            elementToFocus = closeButton.value || null;
            break;
          default:
            elementToFocus = confirmButton.value || null;
        }
        elementToFocus?.focus();
      });
    }
    function saveFocus() {
      previouslyFocused.value = document.activeElement;
    }
    function restoreFocus() {
      nextTick(() => {
        previouslyFocused.value?.focus();
        previouslyFocused.value = null;
      });
    }
    function handleKeydown(event) {
      if (!props.isOpen || event.key !== "Tab") return;
      const panel = modalPanel.value;
      if (!panel) return;
      const focusableElements = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
    function disableBodyScroll() {
      document.body.style.overflow = "hidden";
    }
    function enableBodyScroll() {
      document.body.style.overflow = "";
    }
    watch(
      () => props.isOpen,
      (newValue) => {
        if (newValue) {
          saveFocus();
          disableBodyScroll();
          setInitialFocus();
        } else {
          enableBodyScroll();
        }
      }
    );
    onMounted(() => {
      document.addEventListener("keydown", handleKeydown);
      if (props.isOpen) {
        saveFocus();
        disableBodyScroll();
        setInitialFocus();
      }
    });
    onUnmounted(() => {
      document.removeEventListener("keydown", handleKeydown);
      enableBodyScroll();
      if (props.isOpen) {
        restoreFocus();
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      ssrRenderTeleport(_push, (_push2) => {
        if (_ctx.isOpen) {
          _push2(`<div class="fixed inset-0 z-50 overflow-y-auto" role="dialog"${ssrRenderAttr("aria-modal", true)}${ssrRenderAttr("aria-labelledby", titleId.value)}${ssrRenderAttr("aria-describedby", descriptionId.value)} data-v-b5bf37a0><div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" data-v-b5bf37a0></div><div class="flex min-h-full items-center justify-center p-4" data-v-b5bf37a0><div class="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all" data-v-b5bf37a0>`);
          if (_ctx.title || _ctx.$slots.header) {
            _push2(`<div class="mb-4" data-v-b5bf37a0>`);
            if (_ctx.$slots.header) {
              _push2(`<div data-v-b5bf37a0>`);
              ssrRenderSlot(_ctx.$slots, "header", {}, null, _push2, _parent);
              _push2(`</div>`);
            } else {
              _push2(`<div class="flex items-center justify-between" data-v-b5bf37a0><h3${ssrRenderAttr("id", titleId.value)} class="text-lg font-semibold text-gray-900" data-v-b5bf37a0>${ssrInterpolate(_ctx.title)}</h3>`);
              if (_ctx.showCloseButton) {
                _push2(`<button class="text-gray-400 hover:text-gray-600 focus:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1" aria-label="Close modal" data-v-b5bf37a0>`);
                _push2(ssrRenderComponent(unref(XMarkIcon), {
                  class: "w-6 h-6",
                  "aria-hidden": "true"
                }, null, _parent));
                _push2(`</button>`);
              } else {
                _push2(`<!---->`);
              }
              _push2(`</div>`);
            }
            _push2(`</div>`);
          } else {
            _push2(`<!---->`);
          }
          _push2(`<div${ssrRenderAttr("id", descriptionId.value)} class="mb-6" data-v-b5bf37a0>`);
          ssrRenderSlot(_ctx.$slots, "content", {}, () => {
            if (_ctx.message) {
              _push2(`<p class="text-gray-600" data-v-b5bf37a0>${ssrInterpolate(_ctx.message)}</p>`);
            } else {
              _push2(`<!---->`);
            }
          }, _push2, _parent);
          _push2(`</div><div class="flex justify-end space-x-3" data-v-b5bf37a0>`);
          ssrRenderSlot(_ctx.$slots, "actions", {}, () => {
            if (_ctx.showCancel) {
              _push2(`<button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" data-v-b5bf37a0>${ssrInterpolate(_ctx.cancelText)}</button>`);
            } else {
              _push2(`<!---->`);
            }
            _push2(`<button type="button" class="${ssrRenderClass([confirmButtonClass.value, "px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"])}" data-v-b5bf37a0>${ssrInterpolate(_ctx.confirmText)}</button>`);
          }, _push2, _parent);
          _push2(`</div></div></div></div>`);
        } else {
          _push2(`<!---->`);
        }
      }, "body", false, _parent);
    };
  }
});

const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/Modal.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const Modal = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-b5bf37a0"]]);

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "PromptModal",
  __ssrInlineRender: true,
  props: {
    isOpen: { type: Boolean },
    title: { default: "Input Required" },
    message: {},
    inputLabel: {},
    placeholder: {},
    defaultValue: {},
    confirmText: { default: "OK" },
    cancelText: { default: "Cancel" },
    showCloseButton: { type: Boolean, default: true },
    variant: { default: "primary" },
    preventEscapeClose: { type: Boolean, default: false },
    preventBackdropClose: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    multiline: { type: Boolean, default: false },
    maxLength: {},
    validator: {}
  },
  emits: ["update:isOpen", "confirm", "cancel", "close"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const modalPanel = ref();
    const inputElement = ref();
    ref();
    ref();
    const inputValue = ref("");
    const previouslyFocused = ref(null);
    const inputId = computed(() => `prompt-input-${Math.random().toString(36).substr(2, 9)}`);
    const titleId = computed(() => `prompt-title-${Math.random().toString(36).substr(2, 9)}`);
    const descriptionId = computed(
      () => `prompt-description-${Math.random().toString(36).substr(2, 9)}`
    );
    const confirmButtonClass = computed(() => {
      const baseClass = "focus:ring-2 focus:ring-offset-2";
      switch (props.variant) {
        case "danger":
          return `${baseClass} bg-red-600 hover:bg-red-700 focus:ring-red-500`;
        case "warning":
          return `${baseClass} bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500`;
        default:
          return `${baseClass} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;
      }
    });
    const errorMessage = computed(() => {
      if (props.validator) {
        return props.validator(inputValue.value);
      }
      return null;
    });
    const hasError = computed(() => {
      return errorMessage.value !== null;
    });
    const canConfirm = computed(() => {
      if (props.required && !inputValue.value.trim()) {
        return false;
      }
      if (hasError.value) {
        return false;
      }
      return true;
    });
    function setInitialFocus() {
      nextTick(() => {
        inputElement.value?.focus();
        inputElement.value?.select();
      });
    }
    function saveFocus() {
      previouslyFocused.value = document.activeElement;
    }
    function restoreFocus() {
      nextTick(() => {
        previouslyFocused.value?.focus();
        previouslyFocused.value = null;
      });
    }
    function handleKeydown(event) {
      if (!props.isOpen || event.key !== "Tab") return;
      const panel = modalPanel.value;
      if (!panel) return;
      const focusableElements = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
    function disableBodyScroll() {
      document.body.style.overflow = "hidden";
    }
    function enableBodyScroll() {
      document.body.style.overflow = "";
    }
    watch(
      () => props.isOpen,
      (newValue) => {
        if (newValue) {
          saveFocus();
          disableBodyScroll();
          inputValue.value = props.defaultValue || "";
          setInitialFocus();
        } else {
          enableBodyScroll();
        }
      }
    );
    onMounted(() => {
      document.addEventListener("keydown", handleKeydown);
      if (props.isOpen) {
        saveFocus();
        disableBodyScroll();
        inputValue.value = props.defaultValue || "";
        setInitialFocus();
      }
    });
    onUnmounted(() => {
      document.removeEventListener("keydown", handleKeydown);
      enableBodyScroll();
      if (props.isOpen) {
        restoreFocus();
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      let _temp0;
      ssrRenderTeleport(_push, (_push2) => {
        if (_ctx.isOpen) {
          _push2(`<div class="fixed inset-0 z-50 overflow-y-auto" role="dialog"${ssrRenderAttr("aria-modal", true)}${ssrRenderAttr("aria-labelledby", titleId.value)}${ssrRenderAttr("aria-describedby", descriptionId.value)} data-v-cdc8f881><div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" data-v-cdc8f881></div><div class="flex min-h-full items-center justify-center p-4" data-v-cdc8f881><div class="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all" data-v-cdc8f881><div class="mb-4" data-v-cdc8f881><div class="flex items-center justify-between" data-v-cdc8f881><h3${ssrRenderAttr("id", titleId.value)} class="text-lg font-semibold text-gray-900" data-v-cdc8f881>${ssrInterpolate(_ctx.title)}</h3>`);
          if (_ctx.showCloseButton) {
            _push2(`<button class="text-gray-400 hover:text-gray-600 focus:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1 group" aria-label="Close modal" data-v-cdc8f881>`);
            _push2(ssrRenderComponent(unref(XMarkIcon), {
              class: "w-6 h-6 theme-icon-hover",
              "aria-hidden": "true"
            }, null, _parent));
            _push2(`</button>`);
          } else {
            _push2(`<!---->`);
          }
          _push2(`</div></div><div${ssrRenderAttr("id", descriptionId.value)} class="mb-6" data-v-cdc8f881>`);
          if (_ctx.message) {
            _push2(`<p class="text-gray-600 mb-4" data-v-cdc8f881>${ssrInterpolate(_ctx.message)}</p>`);
          } else {
            _push2(`<!---->`);
          }
          _push2(`<div data-v-cdc8f881>`);
          if (_ctx.inputLabel) {
            _push2(`<label${ssrRenderAttr("for", inputId.value)} class="block text-sm font-medium text-gray-700 mb-2" data-v-cdc8f881>${ssrInterpolate(_ctx.inputLabel)}</label>`);
          } else {
            _push2(`<!---->`);
          }
          if (_ctx.multiline) {
            _push2(`<textarea${ssrRenderAttrs(mergeProps({
              id: inputId.value,
              ref_key: "inputElement",
              ref: inputElement
            }, {
              ..._ctx.placeholder ? { placeholder: _ctx.placeholder } : {},
              ..._ctx.maxLength ? { maxlength: _ctx.maxLength } : {},
              ..._ctx.required ? { required: true } : {},
              ...hasError.value ? { "aria-describedby": `${inputId.value}-error` } : {}
            }, {
              class: ["w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none", { "border-red-500 focus:ring-red-500 focus:border-red-500": hasError.value }],
              rows: 3,
              "aria-invalid": hasError.value
            }), "textarea")} data-v-cdc8f881>${ssrInterpolate(inputValue.value)}</textarea>`);
          } else {
            _push2(`<input${ssrRenderAttrs((_temp0 = mergeProps({
              id: inputId.value,
              ref_key: "inputElement",
              ref: inputElement,
              value: inputValue.value,
              type: "text"
            }, {
              ..._ctx.placeholder ? { placeholder: _ctx.placeholder } : {},
              ..._ctx.maxLength ? { maxlength: _ctx.maxLength } : {},
              ..._ctx.required ? { required: true } : {},
              ...hasError.value ? { "aria-describedby": `${inputId.value}-error` } : {}
            }, {
              class: ["w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500", { "border-red-500 focus:ring-red-500 focus:border-red-500": hasError.value }],
              "aria-invalid": hasError.value
            }), mergeProps(_temp0, ssrGetDynamicModelProps(_temp0, inputValue.value))))} data-v-cdc8f881>`);
          }
          if (_ctx.maxLength) {
            _push2(`<div class="flex justify-between items-center mt-1" data-v-cdc8f881>`);
            if (hasError.value) {
              _push2(`<p${ssrRenderAttr("id", `${inputId.value}-error`)} class="text-sm text-red-600" role="alert" data-v-cdc8f881>${ssrInterpolate(errorMessage.value)}</p>`);
            } else {
              _push2(`<span class="text-sm text-gray-500" data-v-cdc8f881>${ssrInterpolate(inputValue.value.length)}/${ssrInterpolate(_ctx.maxLength)}</span>`);
            }
            _push2(`</div>`);
          } else {
            _push2(`<!---->`);
          }
          _push2(`</div></div><div class="flex justify-end space-x-3" data-v-cdc8f881><button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" data-v-cdc8f881>${ssrInterpolate(_ctx.cancelText)}</button><button type="button"${ssrIncludeBooleanAttr(!canConfirm.value) ? " disabled" : ""} class="${ssrRenderClass([confirmButtonClass.value, "px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"])}" data-v-cdc8f881>${ssrInterpolate(_ctx.confirmText)}</button></div></div></div></div>`);
        } else {
          _push2(`<!---->`);
        }
      }, "body", false, _parent);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/PromptModal.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const PromptModal = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-cdc8f881"]]);

function useModal() {
  const modalState = reactive({
    isOpen: false,
    config: {}
  });
  const promptState = reactive({
    isOpen: false,
    config: {}
  });
  function showConfirmModal(config = {}) {
    return new Promise((resolve) => {
      modalState.isOpen = true;
      modalState.config = {
        title: "Confirm Action",
        confirmText: "OK",
        cancelText: "Cancel",
        showCancel: true,
        variant: "primary",
        ...config
      };
      modalState.resolve = resolve;
    });
  }
  function showPrompt(config = {}) {
    return new Promise((resolve) => {
      promptState.isOpen = true;
      promptState.config = {
        title: "Input Required",
        confirmText: "OK",
        cancelText: "Cancel",
        variant: "primary",
        ...config
      };
      promptState.resolve = resolve;
    });
  }
  function showAlert(message, title = "Notice", variant = "primary") {
    return showConfirmModal({
      title,
      message,
      showCancel: false,
      variant,
      confirmText: "OK"
    });
  }
  function showError(message, title = "Error") {
    return showAlert(message, title, "danger");
  }
  function showWarning(message, title = "Warning") {
    return showAlert(message, title, "warning");
  }
  function showDeleteConfirm(itemName) {
    return showConfirmModal({
      title: "Delete Confirmation",
      message: itemName ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.` : "Are you sure you want to delete this item? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
      focusOnOpen: "cancel"
      // Focus cancel button for destructive actions
    });
  }
  function handleConfirm() {
    const { resolve } = modalState;
    modalState.isOpen = false;
    resolve?.(true);
  }
  function handleCancel() {
    const { resolve } = modalState;
    modalState.isOpen = false;
    resolve?.(false);
  }
  function handlePromptConfirm(value) {
    const { resolve } = promptState;
    promptState.isOpen = false;
    resolve?.(value);
  }
  function handlePromptCancel() {
    const { resolve } = promptState;
    promptState.isOpen = false;
    resolve?.(null);
  }
  function closeModal() {
    handleCancel();
  }
  function closePrompt() {
    handlePromptCancel();
  }
  function updateModalOpen(isOpen) {
    modalState.isOpen = isOpen;
    if (!isOpen) {
      handleCancel();
    }
  }
  function updatePromptOpen(isOpen) {
    promptState.isOpen = isOpen;
    if (!isOpen) {
      handlePromptCancel();
    }
  }
  return {
    modalState,
    promptState,
    showConfirmModal,
    showPrompt,
    showAlert,
    showError,
    showWarning,
    showDeleteConfirm,
    handleConfirm,
    handleCancel,
    handlePromptConfirm,
    handlePromptCancel,
    closeModal,
    closePrompt,
    updateModalOpen,
    updatePromptOpen
  };
}
const globalModal = useModal();

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "App",
  __ssrInlineRender: true,
  setup(__props) {
    const { initAuth } = useAuth();
    const route = useRoute();
    const firstTimeModalRef = ref(null);
    provide("openWelcomeModal", () => {
      if (firstTimeModalRef.value) {
        firstTimeModalRef.value.open();
      }
    });
    onMounted(async () => {
      try {
        await initAuth();
      } catch (error) {
        console.error("Failed to initialize authentication:", error);
      }
    });
    watch(
      () => route.query,
      (newQuery) => {
        if (newQuery.login === "required") {
          console.log("Authentication required for this route");
        }
        if (newQuery.error === "reviewer_required") {
          console.log("Moderator access required for this route");
        }
        if (newQuery.error === "admin_required") {
          console.log("Admin access required for this route");
        }
      },
      { immediate: true }
    );
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ id: "app" }, _attrs))}>`);
      _push(ssrRenderComponent(ErrorBoundary, null, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(ssrRenderComponent(AppShell, null, null, _parent2, _scopeId));
          } else {
            return [
              createVNode(AppShell)
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(ssrRenderComponent(Modal, {
        "is-open": unref(globalModal).modalState.isOpen,
        title: unref(globalModal).modalState.config.title || "",
        message: unref(globalModal).modalState.config.message || "",
        "confirm-text": unref(globalModal).modalState.config.confirmText || "OK",
        "cancel-text": unref(globalModal).modalState.config.cancelText || "Cancel",
        "show-cancel": unref(globalModal).modalState.config.showCancel ?? true,
        variant: unref(globalModal).modalState.config.variant || "primary",
        "prevent-escape-close": unref(globalModal).modalState.config.preventEscapeClose || false,
        "prevent-backdrop-close": unref(globalModal).modalState.config.preventBackdropClose || false,
        "focus-on-open": unref(globalModal).modalState.config.focusOnOpen || "confirm",
        "onUpdate:isOpen": unref(globalModal).updateModalOpen,
        onConfirm: unref(globalModal).handleConfirm,
        onCancel: unref(globalModal).handleCancel,
        onClose: unref(globalModal).handleCancel
      }, null, _parent));
      _push(ssrRenderComponent(PromptModal, mergeProps({
        "is-open": unref(globalModal).promptState.isOpen,
        title: unref(globalModal).promptState.config.title || "",
        message: unref(globalModal).promptState.config.message || "",
        "input-label": unref(globalModal).promptState.config.inputLabel || "",
        placeholder: unref(globalModal).promptState.config.placeholder || "",
        "default-value": unref(globalModal).promptState.config.defaultValue || "",
        "confirm-text": unref(globalModal).promptState.config.confirmText || "OK",
        "cancel-text": unref(globalModal).promptState.config.cancelText || "Cancel",
        variant: unref(globalModal).promptState.config.variant || "primary",
        required: unref(globalModal).promptState.config.required || false,
        multiline: unref(globalModal).promptState.config.multiline || false
      }, {
        ...unref(globalModal).promptState.config.maxLength !== void 0 ? { maxLength: unref(globalModal).promptState.config.maxLength } : {},
        ...unref(globalModal).promptState.config.validator !== void 0 ? { validator: unref(globalModal).promptState.config.validator } : {}
      }, {
        "onUpdate:isOpen": unref(globalModal).updatePromptOpen,
        onConfirm: unref(globalModal).handlePromptConfirm,
        onCancel: unref(globalModal).handlePromptCancel,
        onClose: unref(globalModal).handlePromptCancel
      }), null, _parent));
      _push(ssrRenderComponent(FirstTimeModal, {
        ref_key: "firstTimeModalRef",
        ref: firstTimeModalRef
      }, null, _parent));
      _push(`</div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/App.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

const HomeView = () => import('./assets/HomeView-BPQn03uT.js');
const HelpView = () => import('./assets/HelpView-sWF7UCNS.js');
const StatusView = () => import('./assets/StatusView-BI6IuQvC.js');
const MapView = () => import('./assets/MapView-DbBFFQHf.js');
const ArtworkDetailView = () => import('./assets/ArtworkDetailView-DqXjIzs4.js');
const ArtworkEditView = () => import('./assets/ArtworkEditView-BR7ElDS7.js');
const ArtworkIndexView = () => import('./assets/ArtworkIndexView-kGAvK3qB.js');
const ArtistIndexView = () => import('./assets/ArtistIndexView-BQ9kow-W.js');
const ProfileView = () => import('./assets/ProfileView-DSb8eB5X.js');
const ProfileNotificationsView = () => import('./assets/ProfileNotificationsView-DczcGPhE.js');
const ReviewView = () => import('./assets/ReviewView-B9NXKCqn.js');
const ModeratorFeedbackView = () => import('./assets/ModeratorFeedbackView-Dup-T3Tv.js');
const AdminView = () => import('./assets/AdminView-BUpqcoKK.js');
const VerifyView = () => import('./assets/VerifyView-Dqwgqf5H.js');
const SearchView = () => import('./assets/SearchView-ClibZB0Q.js');
const SearchResultsView = () => import('./assets/SearchResultsView-5ILjph-C.js');
const FastPhotoUploadView = () => import('./assets/FastPhotoUploadView-BP_g92Fk.js');
const LogbookSubmissionView = () => import('./assets/LogbookSubmissionView-B_XlaByd.js');
const PublicProfileView = () => import('./assets/PublicProfileView-_H5hRzxa.js');
const ListView = () => import('./assets/ListView-Bjwlb9rM.js');
const PageListView = () => import('./assets/PageListView-ClN7vCYs.js');
const PageDetailView = () => import('./assets/PageDetailView-G4A8Ecst.js');
const NotFoundView = () => import('./assets/NotFoundView-zNTHHQDC.js');
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "Map",
      component: MapView,
      meta: {
        title: "Public Art Registry - Discover Public Art"
      }
    },
    {
      path: "/home",
      name: "Home",
      component: HomeView,
      meta: {
        title: "Public Art Registry - About"
      }
    },
    {
      path: "/add",
      name: "FastPhotoUpload",
      component: FastPhotoUploadView,
      meta: {
        title: "Add Artwork - Public Art Registry"
      }
    },
    // /submit route removed: use /add for new artwork fast-photo submissions
    {
      path: "/artworks",
      name: "ArtworkIndex",
      component: ArtworkIndexView,
      meta: {
        title: "Artworks - Public Art Registry"
      }
    },
    {
      path: "/artists",
      name: "ArtistIndex",
      component: ArtistIndexView,
      meta: {
        title: "Artists - Public Art Registry"
      }
    },
    {
      path: "/search/:query?",
      name: "Search",
      component: SearchView,
      props: true,
      meta: {
        title: "Search Artworks - Public Art Registry"
      }
    },
    {
      path: "/search/results",
      name: "SearchResults",
      component: SearchResultsView,
      meta: {
        title: "Search Results - Public Art Registry"
      }
    },
    {
      path: "/artwork/new",
      name: "NewArtwork",
      component: () => import('./assets/NewArtworkView-B9pP7lGH.js'),
      meta: {
        title: "New Artwork - Public Art Registry"
      }
    },
    {
      path: "/artwork/:id",
      name: "ArtworkDetail",
      component: ArtworkDetailView,
      props: true,
      meta: {
        title: "Artwork Details - Public Art Registry"
      }
    },
    {
      path: "/artwork/:id/edit",
      name: "ArtworkEdit",
      component: ArtworkEditView,
      props: true,
      meta: {
        title: "Edit Artwork - Public Art Registry",
        requiresAuth: true
      }
    },
    {
      path: "/logbook/:artworkId",
      name: "LogbookSubmission",
      component: LogbookSubmissionView,
      props: true,
      meta: {
        title: "Log a Visit - Public Art Registry"
      }
    },
    {
      path: "/lists/:id",
      name: "ListView",
      component: ListView,
      props: true,
      meta: {
        title: "List - Public Art Registry"
      }
    },
    {
      path: "/artist/:id",
      name: "ArtistDetail",
      component: () => import('./assets/ArtistDetailView-DW1v-QXl.js'),
      props: true,
      meta: {
        title: "Artist Profile - Public Art Registry"
      }
    },
    {
      path: "/profile",
      name: "Profile",
      component: ProfileView,
      meta: {
        title: "My Submissions - Public Art Registry"
      }
    },
    {
      path: "/profile/notifications",
      name: "ProfileNotifications",
      component: ProfileNotificationsView,
      meta: {
        title: "Notifications - Public Art Registry"
      }
    },
    {
      path: "/users/:uuid",
      name: "PublicProfile",
      component: PublicProfileView,
      meta: {
        title: "User Profile - Public Art Registry"
      }
    },
    {
      path: "/verify",
      name: "Verify",
      component: VerifyView,
      meta: {
        title: "Email Verification - Public Art Registry"
      }
    },
    {
      path: "/terms",
      redirect: "/pages/terms-of-service"
    },
    {
      path: "/privacy",
      redirect: "/pages/privacy-policy"
    },
    {
      path: "/docs/terms-of-service",
      redirect: "/pages/terms-of-service"
    },
    {
      path: "/docs/privacy-policy",
      redirect: "/pages/privacy-policy"
    },
    {
      path: "/review",
      name: "Review",
      component: ReviewView,
      meta: {
        title: "Review Queue - Public Art Registry",
        requiresModerator: true
      }
    },
    {
      path: "/moderation/feedback",
      name: "ModeratorFeedback",
      component: ModeratorFeedbackView,
      meta: {
        title: "Feedback Moderation - Public Art Registry",
        requiresModerator: true
      }
    },
    {
      path: "/admin",
      name: "Admin",
      component: AdminView,
      meta: {
        title: "Admin Dashboard - Public Art Registry",
        requiresAdmin: true
      }
    },
    {
      path: "/help",
      name: "Help",
      component: HelpView,
      meta: {
        title: "Help - Public Art Registry"
      }
    },
    {
      path: "/status",
      name: "Status",
      component: StatusView,
      meta: {
        title: "System Status - Public Art Registry"
      }
    },
    {
      path: "/pages",
      name: "PageList",
      component: PageListView,
      meta: {
        title: "Pages - Public Art Registry"
      }
    },
    {
      path: "/pages/:slug",
      name: "PageDetail",
      component: PageDetailView,
      meta: {
        title: "Page - Public Art Registry"
      }
    },
    // Redirect old paths for compatibility
    {
      path: "/home",
      redirect: "/"
    },
    // Catch-all 404 route - MUST be last
    {
      path: "/:pathMatch(.*)*",
      name: "NotFound",
      component: NotFoundView,
      meta: {
        title: "404 - Page Not Found - Public Art Registry"
      }
    }
  ]
});
router.beforeEach(async (to, _from, next) => {
  if (to.meta.title && isClient) {
    document.title = to.meta.title;
  }
  if (!isClient) {
    next();
    return;
  }
  const authStore = useAuthStore();
  if (!authStore.user && !authStore.isLoading) {
    try {
      await authStore.initializeAuth();
    } catch (error) {
      console.error("Failed to initialize auth in router guard:", error);
    }
  }
  while (authStore.isLoading) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  console.log("[ROUTER DEBUG] Route guard check:", {
    route: to.path,
    requiresModerator: to.meta.requiresModerator,
    isAuthenticated: authStore.isAuthenticated,
    canReview: authStore.canReview,
    isModerator: authStore.isModerator,
    isAdmin: authStore.isAdmin,
    hasUser: !!authStore.user,
    permissions: authStore.permissions,
    loading: authStore.isLoading
  });
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({
      path: "/",
      query: {
        login: "required",
        redirect: to.fullPath
      }
    });
    return;
  }
  if (to.meta.requiresModerator && !authStore.canReview) {
    console.log("Moderator access required for this route");
    next({
      path: "/",
      query: {
        error: "moderator_required"
      }
    });
    return;
  }
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next({
      path: "/",
      query: {
        error: "admin_required"
      }
    });
    return;
  }
  next();
});

async function createAppFactory(url) {
  const app = createSSRApp(_sfc_main);
  const pinia = createPinia();
  app.use(pinia);
  const router$1 = createRouter({
    history: createMemoryHistory(),
    routes: router.options?.routes || router
  });
  app.use(router$1);
  const head = createHead();
  app.use(head);
  await router$1.push(url);
  await router$1.isReady();
  return { app, router: router$1, head };
}

async function render(url, _opts) {
  const { app, head } = await createAppFactory(url);
  const appHtml = await renderToString(app);
  const headResult = head.renderHeadToString?.() || {};
  return {
    html: appHtml,
    headTags: headResult.headTags || "",
    htmlAttrs: headResult.htmlAttrs || "",
    bodyAttrs: headResult.bodyAttrs || "",
    jsonld: null,
    status: 200
  };
}

export { AuthModal as A, FirstTimeModal as F, _export_sfc as _, apiService as a, getErrorMessage as b, canUseLocalStorage as c, useAuthStore as d, createLogger as e, useAnnouncer as f, getApiBaseUrl as g, FeedbackDialog as h, isClient as i, createApiUrl as j, isBadgeNotificationMetadata as k, globalModal as l, isNetworkError as m, useAuth as n, useFastUploadSessionStore as o, useGeolocation as p, isRateLimited as q, AppShell as r, render, useToastsStore as s, api as t, useNotificationsStore as u };
//# sourceMappingURL=ssr-entry-server.js.map
