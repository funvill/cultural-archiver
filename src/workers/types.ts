/**
 * Worker-specific types that include both shared types and Cloudflare Worker types
 */

// ================================
// Database Schema Types
// ================================

export interface ArtworkTypeRecord {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ArtworkRecord {
  id: string;
  lat: number;
  lon: number;
  type_id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'removed';
  tags: string | null; // JSON object for key-value metadata like {"material": "bronze", "style": "modern"}
}

export interface LogbookRecord {
  id: string;
  artwork_id: string | null;
  user_token: string;
  lat: number | null;
  lon: number | null;
  note: string | null;
  photos: string | null; // JSON array of R2 URLs like ["url1", "url2", "url3"]
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  rejection_reason?: string;
}

export interface TagRecord {
  id: string;
  artwork_id: string | null;
  logbook_id: string | null;
  label: string;
  value: string;
  created_at: string;
}

export interface CreatorRecord {
  id: string;
  name: string;
  bio: string | null;
  created_at: string;
}

export interface ArtworkCreatorRecord {
  id: string;
  artwork_id: string;
  creator_id: string;
  role: string;
  created_at: string;
}

// ================================
// API Request/Response Types
// ================================

export interface CreateArtworkRequest {
  lat: number;
  lon: number;
  type_id: string;
  tags?: Record<string, unknown>;
  status?: ArtworkRecord['status'];
}

export interface UpdateArtworkRequest extends Partial<CreateArtworkRequest> {
  id: string;
  status?: ArtworkRecord['status'];
}

export interface CreateArtworkTypeRequest {
  name: string;
  description?: string;
}

export interface CreateTagRequest {
  artwork_id?: string;
  logbook_id?: string;
  label: string;
  value: string;
}

export interface CreateLogbookEntryRequest {
  artwork_id?: string;
  user_token: string;
  lat?: number;
  lon?: number;
  note?: string;
  photos?: string[];
}

export interface CreateCreatorRequest {
  name: string;
  bio?: string;
}

export interface CreateArtworkCreatorRequest {
  artwork_id: string;
  creator_id: string;
  role?: string;
}

// ================================
// MVP Worker API Types
// ================================

// Submission Endpoints
export interface LogbookSubmissionRequest {
  lat: number;
  lon: number;
  note?: string;
  type?: string;
  photos?: File[];
}

export interface LogbookSubmissionResponse {
  id: string;
  status: 'pending';
  message: string;
  nearby_artworks?: NearbyArtworkInfo[];
}

export interface NearbyArtworkInfo {
  id: string;
  lat: number;
  lon: number;
  type_name: string;
  distance_meters: number;
  photos: string[];
}

// Discovery Endpoints
export interface NearbyArtworksRequest {
  lat: number;
  lon: number;
  radius?: number;
  limit?: number;
}

export interface NearbyArtworksResponse {
  artworks: ArtworkWithPhotos[];
  total: number;
  search_center: { lat: number; lon: number };
  search_radius: number;
}

export interface ArtworkWithPhotos extends ArtworkRecord {
  type_name: string;
  recent_photo?: string;
  photo_count: number;
}

export interface ArtworkDetailResponse {
  id: string;
  lat: number;
  lon: number;
  type_id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'removed';
  tags: string | null;
  photos: string[]; // Parsed photo URLs
  type_name: string;
  logbook_entries: LogbookEntryWithPhotos[];
  tags_parsed: Record<string, string>;
  creators: ArtworkCreatorInfo[];
}

export interface ArtworkCreatorInfo {
  id: string;
  name: string;
  bio: string | null;
  role: string;
}

export interface LogbookEntryWithPhotos extends LogbookRecord {
  photos_parsed: string[];
}

// User Management Endpoints
export interface UserSubmissionsResponse {
  submissions: UserSubmissionInfo[];
  total: number;
  page: number;
  per_page: number;
}

export interface UserSubmissionInfo extends LogbookRecord {
  artwork_lat?: number;
  artwork_lon?: number;
  artwork_type_name?: string;
  photos_parsed: string[];
}

// Authentication Endpoints
export interface MagicLinkRequest {
  email: string;
}

export interface MagicLinkResponse {
  message: string;
  success: boolean;
}

export interface ConsumeMagicLinkRequest {
  token: string;
}

export interface ConsumeMagicLinkResponse {
  success: boolean;
  message: string;
  user_token?: string;
}

// Moderation Endpoints
export interface ReviewSubmissionRequest {
  submission_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
  artwork_overrides?: Partial<CreateArtworkRequest>;
  link_to_existing_artwork?: string;
}

export interface ReviewSubmissionResponse {
  success: boolean;
  message: string;
  artwork_id?: string;
  submission_status: LogbookRecord['status'];
}

// Rate Limiting Types
export interface RateLimitInfo {
  submissions_remaining: number;
  submissions_reset_at: string;
  queries_remaining: number;
  queries_reset_at: string;
}

// ================================
// API Response Types
// ================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface ArtworkListResponse extends PaginatedResponse<ArtworkRecord> {}
export interface ArtworkTypeListResponse extends PaginatedResponse<ArtworkTypeRecord> {}
export interface TagListResponse extends PaginatedResponse<TagRecord> {}
export interface LogbookListResponse extends PaginatedResponse<LogbookRecord> {}

// ================================
// Search and Filter Types
// ================================

export interface ArtworkFilters {
  type_id?: string;
  status?: ArtworkRecord['status'];
  lat?: number;
  lon?: number;
  radius?: number; // In meters
  created_after?: string;
  created_before?: string;
  search?: string;
}

export interface LogbookFilters {
  artwork_id?: string;
  user_token?: string;
  status?: LogbookRecord['status'];
  created_after?: string;
  created_before?: string;
  search?: string;
}

// ================================
// File Upload Types
// ================================

export interface PhotoUploadRequest {
  file: File | Uint8Array;
  filename: string;
  artwork_id?: string;
  logbook_entry_id?: string;
  metadata?: Record<string, unknown>;
}

export interface PhotoRecord {
  id: string;
  filename: string;
  original_url: string;
  thumbnail_url: string;
  size: number;
  mime_type: string;
  artwork_id?: string;
  logbook_entry_id?: string;
  metadata?: Record<string, unknown>;
  uploaded_at: string;
}

// ================================
// Configuration Types
// ================================

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  frontend_url: string;
  api_base_url: string;
  r2_public_url?: string;
  log_level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

// ================================
// Authentication Context
// ================================

export interface AuthContext {
  userToken: string;
  isVerifiedEmail: boolean;
  isReviewer: boolean;
  isAdmin: boolean;
}

// Base Worker Environment interface
interface BaseWorkerEnv {
  DB: unknown; // D1Database
  SESSIONS: unknown; // KVNamespace;
  CACHE: unknown; // KVNamespace;
  RATE_LIMITS: unknown; // KVNamespace;
  MAGIC_LINKS: unknown; // KVNamespace;
  PHOTOS_BUCKET: unknown; // R2Bucket;
  ENVIRONMENT: string;
  FRONTEND_URL: string;
  LOG_LEVEL: string;
  API_VERSION: string;
  RESEND_API_KEY?: string; // Resend API key for email
  EMAIL_FROM_ADDRESS: string; // Email address for from field
  EMAIL_FROM_NAME: string; // Display name for from field  
  EMAIL_REPLY_TO?: string; // Reply-to address
  EMAIL_ENABLED?: string; // Feature flag for email
  PHOTOS_BASE_URL?: string;
  R2_PUBLIC_URL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_IMAGES_ENABLED?: string;
  CLOUDFLARE_IMAGES_HASH?: string;
  CLOUDFLARE_IMAGES_API_TOKEN?: string;
}

// Cloudflare Workers Environment with proper types
export interface WorkerEnv
  extends Omit<
    BaseWorkerEnv,
    'DB' | 'SESSIONS' | 'CACHE' | 'RATE_LIMITS' | 'MAGIC_LINKS' | 'PHOTOS_BUCKET'
  > {
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  RATE_LIMITS: KVNamespace;
  MAGIC_LINKS: KVNamespace;
  PHOTOS_BUCKET: R2Bucket;
  CORS_ORIGINS?: string; // comma-separated origins from env
}

// ================================
// Utility Types
// ================================

export type SortDirection = 'asc' | 'desc';

export interface SortOptions {
  field: string;
  direction: SortDirection;
}

export interface PaginationOptions {
  page: number;
  per_page: number;
}

export interface SearchOptions extends PaginationOptions {
  sort?: SortOptions;
  filters?: Record<string, unknown>;
}

// ================================
// Error Types
// ================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: {
    validation_errors?: ValidationError[];
    [key: string]: unknown;
  };
  show_details?: boolean;
}

// Success response format - returns data directly
export interface ApiSuccessResponse<T = unknown> {
  [key: string]: T;
}

// Error response uses progressive disclosure
export interface ApiErrorResponse extends ApiError {}

// ================================
// Authentication Types (for future use)
// ================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'curator' | 'viewer';
  created_at: string;
  last_login: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// ================================
// Type Guards and Validators
// ================================

export const isValidArtworkStatus = (status: string): status is ArtworkRecord['status'] => {
  return ['pending', 'approved', 'removed'].includes(status);
};

export const isValidLogbookStatus = (status: string): status is LogbookRecord['status'] => {
  return ['pending', 'approved', 'rejected'].includes(status);
};

export const isValidArtworkType = (type: string): type is ArtworkTypeRecord['name'] => {
  return ['public_art', 'street_art', 'monument', 'sculpture', 'other'].includes(type);
};

export const isValidSortDirection = (direction: string): direction is SortDirection => {
  return ['asc', 'desc'].includes(direction);
};

// ================================
// Constants
// ================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const ARTWORK_STATUSES = ['pending', 'approved', 'removed'] as const;
export const LOGBOOK_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const ARTWORK_TYPES = [
  'public_art',
  'street_art',
  'monument',
  'sculpture',
  'other',
] as const;

// Default search radius in meters
export const DEFAULT_SEARCH_RADIUS = 500;
export const MAX_SEARCH_RADIUS = 50000; // 50km - allows metropolitan area searches
export const MIN_SEARCH_RADIUS = 50; // 50m

// Rate limiting constants
export const RATE_LIMIT_SUBMISSIONS_PER_HOUR = 60;
export const RATE_LIMIT_QUERIES_PER_HOUR = 60;
export const MAX_NOTE_LENGTH = 500;
export const MAX_PHOTOS_PER_SUBMISSION = 3;
export const MAX_PHOTO_SIZE = 15 * 1024 * 1024; // 15MB

// Photo processing constants
export const THUMBNAIL_MAX_SIZE = 800; // pixels
export const PHOTO_BUCKET_STRUCTURE = {
  ORIGINALS: 'originals',
  THUMBS: 'thumbs',
} as const;
