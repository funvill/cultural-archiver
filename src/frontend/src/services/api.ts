/**
 * API service layer for Cultural Archiver frontend
 * Handles all HTTP communication with the backend API
 */

import type {
  LogbookSubmission,
  ArtworkPin,
  ArtworkDetails,
  UserSubmission,
  UserProfile,
  ReviewQueueItem,
  ReviewStats,
  MagicLinkRequest,
  MagicLinkConsumeRequest,
  VerificationStatus,
  ApiResponse,
  PaginatedResponse,
  StatusResponse,
  SubmissionResponse,
} from '../types'

// Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000

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
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * HTTP client with proper error handling and token management
 */
class ApiClient {
  private baseURL: string
  private timeout: number

  constructor(baseURL: string, timeout: number) {
    this.baseURL = baseURL
    this.timeout = timeout
  }

  /**
   * Get user token from localStorage
   */
  private getUserToken(): string | null {
    return localStorage.getItem('user-token')
  }

  /**
   * Set user token in localStorage
   */
  private setUserToken(token: string): void {
    localStorage.setItem('user-token', token)
  }

  /**
   * Create request headers with authentication
   */
  private createHeaders(customHeaders: Record<string, string> = {}): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...customHeaders
    })

    const token = this.getUserToken()
    if (token) {
      headers.set('X-User-Token', token)
    }

    return headers
  }

  /**
   * Handle API response and extract data
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    // Update user token if provided in response
    const newToken = response.headers.get('X-User-Token')
    if (newToken) {
      this.setUserToken(newToken)
    }

    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    if (!response.ok) {
      let errorData: Record<string, unknown> = { message: response.statusText }
      
      if (isJson) {
        try {
          errorData = await response.json()
        } catch {
          // Fallback to status text if JSON parsing fails
        }
      }

      throw new ApiError(
        errorData.code || 'API_ERROR',
        response.status,
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        errorData
      )
    }

    if (!isJson) {
      throw new ApiError('INVALID_RESPONSE', 500, 'Expected JSON response from API')
    }

    return response.json()
  }

  /**
   * Make HTTP request with timeout and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    // Enhanced diagnostic logging
    console.log('[ApiClient.request] Constructing URL:', {
      baseURL: this.baseURL,
      endpoint: endpoint,
      fullURL: url,
      method: options.method || 'GET'
    })
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      console.log('[ApiClient.request] Making fetch request to:', url)
      const response = await fetch(url, {
        ...options,
        headers: this.createHeaders(options.headers as Record<string, string>),
        signal: controller.signal
      })

      console.log('[ApiClient.request] Response received:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      })

      clearTimeout(timeoutId)
      return this.handleResponse<T>(response)
    } catch (error) {
      clearTimeout(timeoutId)
      
      console.error('[ApiClient.request] Fetch error:', {
        error: error,
        url: url,
        isNetworkError: error instanceof TypeError,
        isAbortError: error instanceof DOMException && error.name === 'AbortError'
      })
      
      if (error instanceof ApiError) {
        throw error
      }
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 408, 'Request timeout')
      }
      
      throw new ApiError('NETWORK_ERROR', 0, 'Network error occurred')
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    // Log the .env value at runtime
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // eslint-disable-next-line no-console
      console.log('[ApiClient.get] VITE_API_BASE_URL from env:', import.meta.env.VITE_API_BASE_URL);
    }
    // Fallback log if debug logs are not visible
    // eslint-disable-next-line no-console
    console.log('[ApiClient.get] baseURL:', this.baseURL, 'endpoint:', endpoint, 'params:', params);
    
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
  async post<T>(endpoint: string, data?: unknown, customHeaders?: Record<string, string>): Promise<T> {
    const headers = data instanceof FormData 
      ? (customHeaders || {})
      : { ...customHeaders }
      
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
      headers
    })
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE'
    })
  }
}

// Create singleton client instance
const client = new ApiClient(API_BASE_URL, API_TIMEOUT)

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
    return client.get('/status')
  },

  /**
   * Generate anonymous user token
   */
  async generateToken(): Promise<ApiResponse<{ token: string }>> {
    return client.post('/auth/token', {})
  },

  // ================================
  // Submission Endpoints
  // ================================

  /**
   * Create new logbook submission
   */
  async createSubmission(submission: LogbookSubmission): Promise<ApiResponse<SubmissionResponse>> {
    const formData = new FormData()
    
    // Add form fields
    formData.append('lat', submission.lat.toString())
    formData.append('lon', submission.lon.toString())
    
    if (submission.note) {
      formData.append('note', submission.note)
    }
    
    if (submission.type) {
      formData.append('type', submission.type)
    }
    
    if (submission.artworkId) {
      formData.append('artworkId', submission.artworkId)
    }

    // Add photo files
    submission.photos.forEach((photo) => {
      formData.append(`photos`, photo)
    })

    return client.post('/logbook', formData, {})
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
    limit: number = 50
  ): Promise<ApiResponse<ArtworkPin[]>> {
    return client.get('/artworks/nearby', {
      lat: lat.toString(),
      lon: lon.toString(),
      radius: radius.toString(),
      limit: limit.toString()
    })
  },

  /**
   * Get artwork details by ID
   */
  async getArtworkDetails(id: string): Promise<ApiResponse<ArtworkDetails>> {
    return client.get(`/artworks/${id}`)
  },

  // ================================
  // User Management Endpoints
  // ================================

  /**
   * Get user submissions
   */
  async getUserSubmissions(
    status?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<UserSubmission[]>> {
    const params: Record<string, string> = {
      page: page.toString(),
      limit: limit.toString()
    }
    
    if (status) {
      params.status = status
    }

    return client.get('/me/submissions', params)
  },

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<ApiResponse<UserProfile>> {
    return client.get('/me/profile')
  },

  // ================================
  // Authentication Endpoints
  // ================================

  /**
   * Request magic link for email verification
   */
  async requestMagicLink(request: MagicLinkRequest): Promise<ApiResponse<{ message: string }>> {
    return client.post('/auth/magic-link', request)
  },

  /**
   * Consume magic link token
   */
  async consumeMagicLink(request: MagicLinkConsumeRequest): Promise<ApiResponse<VerificationStatus>> {
    return client.post('/auth/consume', request)
  },

  /**
   * Get email verification status
   */
  async getVerificationStatus(): Promise<ApiResponse<VerificationStatus>> {
    return client.get('/auth/verify-status')
  },

  /**
   * Remove email verification
   */
  async removeEmailVerification(): Promise<ApiResponse<{ message: string }>> {
    return client.delete('/auth/unverify')
  },

  /**
   * Resend verification email
   */
  async resendVerificationEmail(request: MagicLinkRequest): Promise<ApiResponse<{ message: string }>> {
    return client.post('/auth/resend', request)
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
      limit: limit.toString()
    }
    
    if (status) {
      params.status = status
    }
    
    if (type) {
      params.type = type
    }

    return client.get('/review/queue', params)
  },

  /**
   * Get submission for review
   */
  async getSubmissionForReview(id: string): Promise<ApiResponse<ReviewQueueItem>> {
    return client.get(`/review/submission/${id}`)
  },

  /**
   * Approve submission
   */
  async approveSubmission(id: string, reason?: string): Promise<ApiResponse<{ message: string }>> {
    return client.post(`/review/approve/${id}`, { reason })
  },

  /**
   * Reject submission
   */
  async rejectSubmission(id: string, reason?: string): Promise<ApiResponse<{ message: string }>> {
    return client.post(`/review/reject/${id}`, { reason })
  },

  /**
   * Get review statistics
   */
  async getReviewStats(): Promise<ApiResponse<ReviewStats>> {
    return client.get('/review/stats')
  },

  /**
   * Process batch review
   */
  async processBatchReview(batch: unknown[]): Promise<ApiResponse<{ processed: number; message: string }>> {
    return client.put('/review/batch', { batch })
  }
}

// Utility functions for error handling
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  return 'An unexpected error occurred'
}

export function isNetworkError(error: unknown): boolean {
  return isApiError(error) && (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT')
}

export function isUnauthorized(error: unknown): boolean {
  return isApiError(error) && error.status === 401
}

export function isRateLimited(error: unknown): boolean {
  return isApiError(error) && error.status === 429
}