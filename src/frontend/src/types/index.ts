/**
 * Frontend-specific TypeScript type definitions
 * These types are used by Vue components and services
 */

// Import shared types from the backend
export * from '../../../shared/types'

// Frontend-specific interfaces
export interface User {
  id: string
  email?: string
  emailVerified: boolean
  isReviewer: boolean
  createdAt: string
}

export interface ApiResponse<T = any> {
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
  [key: string]: any
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
  icon?: any // Vue component or string
  requiresAuth?: boolean
  requiresReviewer?: boolean
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
  artwork: any // TODO: Use proper artwork type from shared types
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