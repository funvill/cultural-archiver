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
  title?: string | null; // Artwork title (editable field)
  description?: string | null; // Artwork description (editable field)
  created_by?: string | null; // Creator/artist name(s) (editable field)
  artist_name?: string | null; // Artist name extracted from tags (read-only)
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
  title?: string | null; // Artwork title (editable field)
  description?: string | null; // Artwork description (editable field)
  created_by?: string | null; // Creator/artist name(s) (editable field)
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
// Artist System Types
// ================================

export interface ArtistRecord {
  id: string;
  name: string;
  description: string | null; // Markdown biography/artist statement
  tags: string | null; // JSON object for metadata (website, birth_year, etc.)
  created_at: string;
  updated_at: string;
  status: 'active' | 'inactive';
}

export interface ArtworkArtistRecord {
  id: string;
  artwork_id: string;
  artist_id: string;
  role: string; // 'artist', 'creator', 'collaborator', 'commissioner', etc.
  created_at: string;
}

export interface ArtistEditRecord {
  edit_id: string;
  artist_id: string;
  user_token: string;
  field_name: string;
  field_value_old: string | null;
  field_value_new: string | null;
  status: 'pending' | 'approved' | 'rejected';
  moderator_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  submitted_at: string;
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
  title?: string;
  description?: string;
  created_by?: string;
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
// Artist API Types
// ================================

export interface CreateArtistRequest {
  name: string;
  description?: string;
  tags?: Record<string, unknown>;
  status?: ArtistRecord['status'];
}

export interface UpdateArtistRequest extends Partial<CreateArtistRequest> {
  id: string;
}

export interface ArtistApiResponse extends ArtistRecord {
  tags_parsed?: Record<string, unknown>;
  artwork_count?: number;
  artworks?: ArtworkWithPhotos[];
}

export interface ArtistListResponse {
  artists: ArtistApiResponse[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateArtistEditRequest {
  artist_id: string;
  edits: Array<{
    field_name: string;
    field_value_old: string | null;
    field_value_new: string | null;
  }>;
}

export interface ArtistEditSubmissionResponse {
  edit_id: string;
  status: 'pending';
  message: string;
  rate_limit_info?: {
    edits_used: number;
    edits_remaining: number;
    rate_limit: number;
    window_hours: number;
  };
}

export interface ArtistPendingEditsResponse {
  has_pending_edits: boolean;
  submitted_at?: string;
}

// ================================
// Artwork Edit Types
// ================================

export interface ArtworkEditRecord {
  edit_id: string;
  artwork_id: string;
  user_token: string;
  field_name: string;
  field_value_old: string | null;
  field_value_new: string | null;
  status: 'pending' | 'approved' | 'rejected';
  moderator_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  submitted_at: string;
}

export interface CreateArtworkEditRequest {
  artwork_id: string;
  user_token: string;
  edits: Array<{
    field_name: string;
    field_value_old: string | null;
    field_value_new: string | null;
  }>;
}

export interface ArtworkEditSubmissionResponse {
  edit_ids: string[];
  message: string;
  status: 'pending';
}

export interface PendingEditsResponse {
  has_pending_edits: boolean;
  pending_fields: string[];
  submitted_at?: string;
}

export interface ArtworkEditDiff {
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  formatted_old?: string;
  formatted_new?: string;
}

export interface ArtworkEditReviewData {
  edit_ids: string[];
  artwork_id: string;
  user_token: string;
  submitted_at: string;
  diffs: ArtworkEditDiff[];
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
  title?: string | null; // Artwork title (editable field)
  description?: string | null; // Artwork description (editable field)
  created_by?: string | null; // Creator/artist name(s) (editable field)
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

// ================================
// API Response Utilities
// ================================

/**
 * Create a successful API response with consistent formatting
 */
export function createApiSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (message) {
    response.message = message;
  }

  return response;
}

/**
 * Create an error API response with consistent formatting
 */
export function createApiErrorResponse(error: string, message?: string): ApiResponse<never> {
  const response: ApiResponse<never> = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  if (message) {
    response.message = message;
  }

  return response;
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
  action_type:
    | 'submission_created'
    | 'submission_approved'
    | 'submission_rejected'
    | 'artwork_created'
    | 'artwork_updated'
    | 'artwork_removed'
    | 'consent_collected'
    | 'consent_updated'
    | 'email_verified'
    | 'photo_uploaded'
    | 'photo_processed'
    | 'batch_processed';
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

// ================================
// Structured Tagging System Types
// ================================

export interface StructuredTagValue {
  key: string;
  value: string | number | boolean;
  category: string;
  dataType: 'enum' | 'text' | 'number' | 'date' | 'yes_no' | 'url' | 'wikidata_id';
}

export interface StructuredTagsData {
  tags: Record<string, string | number | boolean>;
  version: string; // Tag schema version used
  lastModified: string; // ISO timestamp
}

export interface TagEditRequest {
  artwork_id: string;
  user_token: string;
  tag_changes: Array<{
    action: 'add' | 'update' | 'remove';
    key: string;
    old_value?: string | number | boolean | null;
    new_value?: string | number | boolean | null;
  }>;
}

export interface TagValidationError {
  key: string;
  field: string;
  message: string;
  code: 'required' | 'invalid_format' | 'out_of_range' | 'invalid_enum' | 'unknown_key' | 'warning' | 'validation_error';
  suggestions?: string[];
}

export interface TagValidationResponse {
  valid: boolean;
  errors: TagValidationError[];
  warnings: TagValidationError[];
  sanitized_tags?: Record<string, string | number | boolean> | undefined;
}

// OpenStreetMap Export Types
export interface OSMExportData {
  tags: Record<string, string>; // All values converted to strings with ca: prefixes
  export_timestamp: string;
  schema_version: string;
}

export interface OSMExportRequest {
  artwork_ids?: string[]; // If not provided, export all approved artwork
  include_metadata?: boolean;
}

export interface OSMExportResponse {
  success: boolean;
  data?: {
    artworks: Array<{
      id: string;
      lat: number;
      lon: number;
      osm_tags: Record<string, string>;
    }>;
    metadata: {
      total_artworks: number;
      export_timestamp: string;
      schema_version: string;
    };
  };
  error?: string;
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
  isAdmin?: boolean;
  permissions?: Permission[];
  user?: UserRecord; // Full user record for authenticated users
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

export const isValidRateLimitIdentifierType = (
  type: string
): type is RateLimitRecord['identifier_type'] => {
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
export const RATE_LIMIT_SUBMISSIONS_PER_HOUR = 60;
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

// ================================
// Permission Management Types
// ================================

export type Permission = 'moderator' | 'admin';

export interface UserPermissionRecord {
  id: string;
  user_uuid: string;
  permission: Permission;
  granted_by: string; // admin user_uuid who granted this permission
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  is_active: boolean;
  notes: string | null; // reason for granting/revoking
}

export interface PermissionCheckResult {
  hasPermission: boolean;
  permission?: Permission;
  grantedAt?: string;
  grantedBy?: string;
}

export interface UserWithPermissions {
  user_uuid: string;
  email?: string;
  permissions: {
    permission: Permission;
    granted_at: string;
    granted_by: string;
    notes?: string;
  }[];
}

// API Request/Response Types for Permissions
export interface GrantPermissionRequest {
  userUuid: string;
  permission: Permission;
  reason?: string;
}

export interface RevokePermissionRequest {
  userUuid: string;
  permission: Permission;
  reason?: string;
}

export interface PermissionResponse {
  success: boolean;
  message: string;
  user_uuid?: string;
  permission?: Permission;
  granted_by?: string;
}

export interface GetPermissionsResponse {
  users: UserWithPermissions[];
  total: number;
  page?: number;
  per_page?: number;
}

// ================================
// Audit Trail Types
// ================================

export type ModerationDecision = 'approved' | 'rejected' | 'skipped';
export type AdminActionType = 'grant_permission' | 'revoke_permission' | 'view_audit_logs';

export interface ModerationDecisionRecord {
  id: string;
  submission_id: string; // logbook entry ID
  moderator_uuid: string; // who made the decision
  decision: ModerationDecision;
  reason: string | null; // reason for rejection or notes
  metadata: string | null; // JSON: IP, user agent, session info
  artwork_id: string | null; // created or linked artwork ID (for approvals)
  action_taken: string | null; // 'create_new', 'link_existing', or NULL for rejections
  photos_processed: number; // number of photos migrated
  created_at: string;
}

export interface AdminActionRecord {
  id: string;
  admin_uuid: string; // admin performing the action
  action_type: AdminActionType;
  target_uuid: string | null; // user being affected (for permission changes)
  permission_type: Permission | null; // 'moderator' or 'admin' (for permission actions)
  old_value: string | null; // previous state (JSON for complex changes)
  new_value: string | null; // new state (JSON for complex changes)
  reason: string | null; // reason for the action
  metadata: string | null; // JSON: IP, user agent, session info
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  type: 'moderation' | 'admin';
  actor_uuid: string;
  actor_email?: string;
  action: string;
  target?: string;
  details: Record<string, unknown>;
  metadata?: {
    ip?: string;
    userAgent?: string;
    sessionId?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface AuditLogQuery {
  type?: 'moderation' | 'admin';
  actor?: string;
  decision?: ModerationDecision;
  action_type?: AdminActionType;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface AuditStatistics {
  total_decisions: number;
  decisions_by_type: Record<ModerationDecision, number>;
  total_admin_actions: number;
  admin_actions_by_type: Record<AdminActionType, number>;
  active_moderators: number;
  active_admins: number;
  date_range: {
    start: string;
    end: string;
    days: number;
  };
}

export interface SessionMetadata {
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  referrer?: string;
  [key: string]: unknown;
}

// Type guards for permissions and audit
export const isValidPermission = (permission: string): permission is Permission => {
  return ['moderator', 'admin'].includes(permission);
};

export const isValidModerationDecision = (decision: string): decision is ModerationDecision => {
  return ['approved', 'rejected', 'skipped'].includes(decision);
};

export const isValidAdminActionType = (action: string): action is AdminActionType => {
  return ['grant_permission', 'revoke_permission', 'view_audit_logs'].includes(action);
};

// Permission constants
export const PERMISSIONS = ['moderator', 'admin'] as const;
export const MODERATION_DECISIONS = ['approved', 'rejected', 'skipped'] as const;
export const ADMIN_ACTION_TYPES = [
  'grant_permission',
  'revoke_permission',
  'view_audit_logs',
] as const;

// ================================
// Backup and Data Dump System Types
// ================================

// Data dump generation request
export interface GenerateDataDumpRequest {
  // No body parameters needed - admin only endpoint
}

// Data dump generation response
export interface GenerateDataDumpResponse {
  success: boolean;
  data?: {
    dump_id: string;
    filename: string;
    size: number;
    download_url: string;
    generated_at: string;
    metadata: {
      total_artworks: number;
      total_creators: number;
      total_tags: number;
      total_photos: number;
    };
  };
  error?: string;
  warnings?: string[];
}

// Data dump record for storage
export interface DataDumpRecord {
  id: string;
  filename: string;
  size: number;
  r2_key: string;
  download_url: string;
  generated_at: string;
  generated_by: string; // admin user token
  total_artworks: number;
  total_creators: number;
  total_tags: number;
  total_photos: number;
  warnings: string | null; // JSON array of warnings
}

// List data dumps response
export interface ListDataDumpsResponse {
  success: boolean;
  data?: {
    dumps: {
      id: string;
      filename: string;
      size: number;
      download_url: string;
      generated_at: string;
      generated_by: string;
      metadata: {
        total_artworks: number;
        total_creators: number;
        total_tags: number;
        total_photos: number;
      };
      warnings?: string[];
    }[];
    total: number;
    retrieved_at: string;
  };
  error?: string;
}
