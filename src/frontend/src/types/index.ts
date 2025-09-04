/**
 * Frontend-specific TypeScript type definitions
 * These types are used by Vue components and services
 */

// Import shared types from the backend
export * from '../../../shared/types'

// Frontend-specific interfaces
  export interface User {
  id: string
  email: string
  emailVerified: boolean
  isReviewer: boolean
  createdAt: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  message: string
  code?: string
  status?: number
}

// Map and location types
export interface Coordinates {
  latitude: number
  longitude: number
}

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface ArtworkPin {
  id: string
  latitude: number
  longitude: number
  type: string
  title?: string
  photos: string[]
}

// Photo and upload types
export interface PhotoFile {
  id: string
  name: string
  size: number
  type: string
  file: File
  preview: string
  exifData?: ExifData
  uploading?: boolean
  uploadProgress?: number
}

export interface ExifData {
  gps?: {
    latitude?: number
    longitude?: number
  }
  camera?: {
    make?: string
    model?: string
  }
  dateTime?: string
  [key: string]: unknown
}

// Form and validation types
export interface ValidationError {
  field: string
  message: string
}

export interface FormState {
  isValid: boolean
  isSubmitting: boolean
  errors: ValidationError[]
}

// Consent and submission types
export interface ConsentFormData {
  ageVerification: boolean
  cc0Licensing: boolean
  publicCommons: boolean
  freedomOfPanorama: boolean
  consentVersion: string
  consentedAt: string
}

export interface SubmissionFormData {
  photos: PhotoFile[]
  location: Coordinates
  artworkId?: string
  artworkType?: string
  note?: string
  consent: ConsentFormData
}

// Navigation and UI types
export interface NavigationItem {
  name: string
  path: string
  icon?: unknown // Vue component or string
  requiresAuth?: boolean
  requiresReviewer?: boolean
  requiresAdmin?: boolean
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

// Loading and error states
export interface LoadingState {
  [key: string]: boolean
}

export interface ErrorState {
  [key: string]: string | null
}

// Review interface types
export interface ReviewSubmission {
  id: string
  photos: string[]
  location: Coordinates
  note?: string
  artworkType: string
  submittedAt: string
  nearbyArtworks: ArtworkPin[]
  mergeSuggestions: ArtworkPin[]
}

export interface ReviewAction {
  action: 'approve' | 'reject' | 'merge'
  submissionId: string
  artworkId?: string // For merge actions
  reason?: string
}

// Pagination types
export interface PaginationMeta {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta
}

// Environment and configuration types
export interface AppConfig {
  apiBaseUrl: string
  mapTileUrl: string
  defaultLocation: Coordinates
  maxPhotoSize: number
  supportedPhotoTypes: string[]
  rateLimit: {
    submissions: number
    discoveries: number
  }
}

// Composable return types
export interface UseApiReturn {
  loading: ComputedRef<boolean>
  error: ComputedRef<string | null>
  request: <T>(url: string, options?: RequestInit) => Promise<T>
}

export interface UseGeolocationReturn {
  coordinates: Ref<Coordinates | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  getCurrentPosition: () => Promise<void>
  watchPosition: () => void
  clearWatch: () => void
}

export interface UseAuthReturn {
  user: Ref<User | null>
  token: Ref<string | null>
  isAuthenticated: ComputedRef<boolean>
  isReviewer: ComputedRef<boolean>
  login: (email: string) => Promise<void>
  logout: () => void
  verifyEmail: (token: string) => Promise<void>
}

// Additional API-specific types
export interface LogbookSubmission {
  lat: number
  lon: number
  note?: string
  type?: string
  artworkId?: string
  photos: File[]
}

export interface ArtworkDetails {
  id: string
  lat: number
  lon: number
  type_id: string
  created_at: string
  status: 'pending' | 'approved' | 'removed'
  tags: string | null
  photos: string[]
  type_name: string
  logbook_entries: LogbookEntryWithPhotos[]
  tags_parsed: Record<string, string>
}

export interface LogbookEntryWithPhotos {
  id: string
  artwork_id: string | null
  user_token: string
  note: string | null
  photos: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  photos_parsed: string[]
}

export interface UserSubmission {
  id: string
  artwork_id: string | null
  user_token: string
  note: string | null
  photos: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  artwork_lat?: number
  artwork_lon?: number
  artwork_type_name?: string
  photos_parsed: string[]
}

export interface NearbyArtworksResponse {
  artworks: ArtworkWithPhotos[];
  total: number;
  search_center: { lat: number; lon: number };
  search_radius: number;
}

export interface ArtworkWithPhotos {
  id: string;
  lat: number;
  lon: number;
  type_id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'removed';
  tags: string | null;
  type_name: string;
  recent_photo?: string;
  photo_count: number;
  distance_km?: number;
}

export interface UserProfile {
  user_token: string
  is_reviewer: boolean
  is_verified_email: boolean
  is_admin: boolean
  statistics: {
    total_submissions: number
    approved_submissions: number
    pending_submissions: number
    first_submission_at: string | null
    last_submission_at: string | null
  }
  rate_limits: {
    emailRemaining: number
    ipRemaining: number
    emailBlocked: boolean
    ipBlocked: boolean
    resetAt: string | null
  }
  preferences: Record<string, unknown>
  created_at: string
  debug?: {
    user_info: {
      uuid: string
      email: string | null
      email_verified: boolean
      status: string
      created_at: string
      updated_at: string
    } | null
    permissions: {
      permission: string
      granted_at: string
      granted_by: string
      granted_by_email: string | null
      revoked_at: string | null
      notes: string | null
      is_active: boolean
    }[]
    auth_context: {
      user_token: string
      is_reviewer: boolean
      is_admin: boolean
      is_verified_email: boolean
      is_authenticated: boolean
    }
    request_headers: {
      authorization: string
      user_token: string
      user_agent: string
    }
    rate_limits: {
      email_blocked: string
      ip_blocked: string
      submissions_remaining: number
      queries_remaining: number
    }
    timestamp: string
  }
}

export interface ReviewQueueItem {
  id: string
  lat: number
  lon: number
  note: string | null
  photos: string[]
  type?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  user_token: string
  nearby_artworks?: ArtworkPin[]
}

export interface ReviewStats {
  total_pending: number
  total_approved: number
  total_rejected: number
  pending_by_type: Record<string, number>
  recent_activity: Array<{
    date: string
    approved: number
    rejected: number
  }>
}

export interface MagicLinkRequest {
  email: string
}

export interface MagicLinkConsumeRequest {
  token: string
}

export interface MagicLinkResponse {
  success: boolean;
  message: string;
  email: string;
  is_signup: boolean;
  rate_limit_remaining?: number;
  rate_limit_reset_at?: string;
}

export interface VerifyMagicLinkResponse {
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
}

export interface AuthStatusResponse {
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
}

export interface LogoutResponse {
  success: boolean;
  message: string;
  new_user_token: string;
}

export interface ConsumeMagicLinkResponse {
  success: boolean;
  message: string;
  user_token?: string;
  is_new_account?: boolean;
}

export interface VerificationStatus {
  email_verified: boolean
  email?: string
  verification_sent_at?: string
}

// Component prop types
export interface AppShellProps {
  title?: string
  showDrawer?: boolean
}

export interface MapComponentProps {
  center?: Coordinates
  zoom?: number
  artworks?: ArtworkPin[]
  showUserLocation?: boolean
}

export interface ArtworkCardProps {
  artwork: unknown // TODO: Use proper artwork type from shared types
  compact?: boolean
  clickable?: boolean
}

export interface PhotoGalleryProps {
  photos: string[]
  currentIndex?: number
  showThumbnails?: boolean
}

// Event types for components
export interface MapEvents {
  'artwork-click': ArtworkPin
  'map-move': { center: Coordinates; zoom: number; bounds: MapBounds }
  'location-found': Coordinates
}

export interface SubmissionEvents {
  'submit': SubmissionFormData
  'cancel': void
  'photo-added': PhotoFile
  'photo-removed': string
}

// Vue 3 specific types
import type { Ref, ComputedRef } from 'vue'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    requiresReviewer?: boolean
  }
}