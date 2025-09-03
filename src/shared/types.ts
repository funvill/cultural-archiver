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
  photos: string | null; // JSON array of R2 URLs like ["url1", "url2", "url3"]
}

export interface ArtworkApiResponse {
  id: string;
  lat: number;
  lon: number;
  type_id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'removed';
  tags: string | null;
  photos: string[] | null; // Already parsed as array
  type_name?: string;
  tags_parsed?: Record<string, unknown>;
}

export interface LogbookRecord {
  id: string;
  artwork_id: string | null;
  user_token: string;
  note: string | null;
  photos: string | null; // JSON array of R2 URLs like ["url1", "url2", "url3"]
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface TagRecord {
  id: string;
  artwork_id: string | null;
  logbook_id: string | null;
  label: string;
  value: string;
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
  note?: string;
  photos?: string[];
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

// Legacy Authentication Endpoints (deprecated - use types from Authentication System Types section)
export interface LegacyMagicLinkRequest {
  email: string;
}

export interface LegacyMagicLinkResponse {
  message: string;
  success: boolean;
}

export interface LegacyConsumeMagicLinkRequest {
  token: string;
}

export interface LegacyConsumeMagicLinkResponse {
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

export interface StatusResponse {
  status: 'ok' | 'error';
  version?: string;
  timestamp: string;
}

export interface SubmissionResponse {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  message?: string;
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
// EXIF and Metadata Types
// ================================

export interface ExifGPSData {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp?: string;
}

export interface ExifCameraData {
  make?: string;
  model?: string;
  software?: string;
  dateTime?: string;
  orientation?: number;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
}

export interface ExifData {
  gps?: ExifGPSData;
  camera?: ExifCameraData;
  comment?: string;
  userComment?: string;
  permalink?: string;
}

// ================================
// Consent Management Types
// ================================

export interface ConsentData {
  ageVerification: boolean;
  cc0Licensing: boolean;
  publicCommons: boolean;
  freedomOfPanorama: boolean;
  consentVersion: string;
  consentedAt: string;
  userToken: string;
}

export interface ConsentValidationResult {
  isValid: boolean;
  missingConsents: string[];
  errors: string[];
}

// ================================
// Audit Logging Types
// ================================

export interface AuditLogRecord {
  id: string;
  action_type: 'submission_created' | 'submission_approved' | 'submission_rejected' | 
               'artwork_created' | 'artwork_updated' | 'artwork_removed' |
               'consent_collected' | 'consent_updated' | 'email_verified' |
               'photo_uploaded' | 'photo_processed' | 'batch_processed';
  entity_type: 'artwork' | 'logbook' | 'user' | 'photo' | 'consent';
  entity_id: string;
  user_token: string;
  moderator_token?: string;
  action_data?: string; // JSON string
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface ConsentRecord {
  id: string;
  user_token: string;
  consent_version: string;
  age_verification: boolean;
  cc0_licensing: boolean;
  public_commons: boolean;
  freedom_of_panorama: boolean;
  ip_address?: string;
  user_agent?: string;
  consented_at: string;
  expires_at?: string;
  revoked_at?: string;
}

export interface PhotoMetadata {
  id: string;
  photo_url: string;
  logbook_entry_id: string;
  variant_type: 'original' | 'thumbnail' | '200px' | '400px' | '800px' | '1200px';
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  aspect_ratio?: number;
  dominant_color?: string;
  exif_processed: boolean;
  permalink_injected: boolean;
  gps_latitude?: number;
  gps_longitude?: number;
  camera_make?: string;
  camera_model?: string;
  taken_at?: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  cloudflare_image_id?: string;
  created_at: string;
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
  exif_processed?: boolean;
  permalink_injected?: boolean;
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
// Authentication System Types
// ================================

// Database Record Types
export interface UserRecord {
  uuid: string;
  email: string;
  created_at: string;
  last_login: string | null;
  email_verified_at: string | null;
  status: 'active' | 'suspended';
}

export interface MagicLinkRecord {
  token: string;
  email: string;
  user_uuid: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  is_signup: boolean;
}

export interface RateLimitRecord {
  identifier: string;
  identifier_type: 'email' | 'ip';
  request_count: number;
  window_start: string;
  last_request_at: string;
  blocked_until: string | null;
}

export interface AuthSessionRecord {
  id: string;
  user_uuid: string;
  token_hash: string;
  created_at: string;
  last_accessed_at: string;
  expires_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  is_active: boolean;
  device_info: string | null;
}

// API Request/Response Types
export interface MagicLinkRequest {
  email: string;
}

export interface MagicLinkResponse {
  success: boolean;
  message: string;
  rate_limit_remaining?: number;
  rate_limit_reset_at?: string;
}

export interface ConsumeMagicLinkRequest {
  token: string;
}

export interface ConsumeMagicLinkResponse {
  success: boolean;
  message: string;
  user_token?: string;
  is_new_account?: boolean;
}

export interface AuthStatusRequest {}

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

export interface LogoutRequest {}

export interface LogoutResponse {
  success: boolean;
  message: string;
  new_anonymous_token: string;
}

// Authentication Context for Middleware
export interface AuthContext {
  userToken: string;
  isVerifiedEmail: boolean;
  isReviewer: boolean;
  user?: UserRecord;  // Full user record for authenticated users
}

// Rate Limiting Types
export interface RateLimitInfo {
  identifier: string;
  identifier_type: 'email' | 'ip';
  requests_remaining: number;
  window_reset_at: string;
  is_blocked: boolean;
  blocked_until?: string;
}

// Session Management Types  
export interface SessionInfo {
  id: string;
  user_uuid: string;
  created_at: string;
  last_accessed_at: string;
  ip_address?: string;
  user_agent?: string;
  is_current: boolean;
}

export interface CreateSessionRequest {
  user_uuid: string;
  ip_address?: string;
  user_agent?: string;
  device_info?: Record<string, unknown>;
}

// UUID Management Types
export interface UUIDClaimInfo {
  anonymous_uuid: string;
  email: string;
  can_claim: boolean;
  existing_submissions_count: number;
  claim_window_expires_at?: string;
}

// Cloudflare Workers Environment (generic interface)
export interface WorkerEnv {
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
  EMAIL_API_KEY?: string; // Optional for development
  EMAIL_FROM: string;
  PHOTOS_BASE_URL?: string;
  R2_PUBLIC_URL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
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
// Legacy Types (for future use or compatibility)
// ================================

export interface LegacyUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'curator' | 'viewer';
  created_at: string;
  last_login: string | null;
}

export interface LegacySession {
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

// Authentication validators
export const isValidUserStatus = (status: string): status is UserRecord['status'] => {
  return ['active', 'suspended'].includes(status);
};

export const isValidRateLimitIdentifierType = (type: string): type is RateLimitRecord['identifier_type'] => {
  return ['email', 'ip'].includes(type);
};

export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
};

export const isValidMagicLinkToken = (token: string): boolean => {
  return token.length >= MAGIC_LINK_TOKEN_LENGTH && /^[a-f0-9]+$/i.test(token);
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
export const MAX_SEARCH_RADIUS = 10000; // 10km
export const MIN_SEARCH_RADIUS = 50; // 50m

// Rate limiting constants
export const RATE_LIMIT_SUBMISSIONS_PER_DAY = 10;
export const RATE_LIMIT_QUERIES_PER_HOUR = 60;

// Authentication rate limiting constants  
export const RATE_LIMIT_MAGIC_LINKS_PER_EMAIL_PER_HOUR = 10;
export const RATE_LIMIT_MAGIC_LINKS_PER_IP_PER_HOUR = 20;
export const MAGIC_LINK_EXPIRY_HOURS = 1;
export const MAGIC_LINK_TOKEN_LENGTH = 64; // 32 bytes as hex string

export const MAX_NOTE_LENGTH = 500;
export const MAX_PHOTOS_PER_SUBMISSION = 3;
export const MAX_PHOTO_SIZE = 15 * 1024 * 1024; // 15MB

// Photo processing constants
export const THUMBNAIL_MAX_SIZE = 800; // pixels
export const PHOTO_BUCKET_STRUCTURE = {
  ORIGINALS: 'originals',
  THUMBS: 'thumbs',
} as const;
