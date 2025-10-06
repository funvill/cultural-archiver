// ================================
// Database Schema Types
// ================================

// Import Cloudflare Worker types for D1Database
import type { D1Database } from '@cloudflare/workers-types';

export interface ArtworkRecord {
  id: string;
  lat: number;
  lon: number;
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
  created_at: string;
  status: 'pending' | 'approved' | 'removed';
  tags: string | null;
  photos: ArtworkPhotoInput[] | null; // Already parsed as array with optional metadata
  type_name?: string;
  tags_parsed?: Record<string, unknown>;
  title?: string | null; // Artwork title (editable field)
  description?: string | null; // Artwork description (editable field)
  created_by?: string | null; // Creator/artist name(s) (editable field)
  // Additional fields for index page display
  recent_photo?: string | null; // First photo for card display
  photo_count?: number; // Total number of photos
  artist_name?: string | null; // Primary artist name for display
  updated_at?: string | null; // For sorting by last updated
}

// ================================
// Photo Variant Types
// ================================

/**
 * Photo size variants for responsive image loading
 * - thumbnail: 400x400px for map markers, cards, search results
 * - medium: 1024x1024px for artwork detail pages
 * - large: 1200x1200px for high-quality detail view
 * - original: Unchanged archive/reference
 */
export type PhotoVariant = 'thumbnail' | 'medium' | 'large' | 'original';

/**
 * Photo size specifications
 */
export const PHOTO_SIZES: Record<PhotoVariant, { width: number; height: number } | null> = {
  thumbnail: { width: 400, height: 400 },
  medium: { width: 1024, height: 1024 },
  large: { width: 1200, height: 1200 },
  original: null, // Original size, no resizing
};

/**
 * Image quality settings for each variant
 */
export const PHOTO_QUALITY: Record<PhotoVariant, number> = {
  thumbnail: 80, // Lower quality for small thumbnails
  medium: 85, // Good balance for detail pages
  large: 90, // High quality for detailed viewing
  original: 100, // No compression
};

export interface ArtworkPhoto {
  url: string;
  thumbnail_url?: string | null;
  alt_text?: string | null;
  caption?: string | null;
  credit?: string | null;
  width?: number | null;
  height?: number | null;
}

export type ArtworkPhotoInput = string | ArtworkPhoto;

// Removed obsolete LogbookRecord - replaced by SubmissionRecord in unified schema
// Removed obsolete TagRecord - tags are now JSON in artwork/artist records
// Removed obsolete CreatorRecord/ArtworkCreatorRecord - replaced by unified Artist system

// ================================
// Artist System Types
// ================================

export interface ArtistRecord {
  id: string;
  name: string;
  description: string | null; // Markdown biography/artist statement
  aliases: string | null; // JSON array of alternative names for "also known as"
  tags: string | null; // JSON object for metadata (website, birth_year, etc.)
  created_at: string;
  updated_at: string;
  status: 'active' | 'inactive';
}

export interface ArtworkArtistRecord {
  artwork_id: string;
  artist_id: string;
  role: string; // 'artist', 'primary', 'contributor', 'collaborator', etc.
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
  review_notes: string | null;
  reviewed_at: string | null;
  reviewer_token: string | null;
  submitted_at: string;
}

// ================================
// Record Creation Types
// ================================

export interface NewArtworkRecord {
  id: string;
  lat: number;
  lon: number;
  created_at: string;
  status: 'pending' | 'approved' | 'removed';
  tags: string | null; // JSON object for key-value metadata
  title?: string | null;
  description?: string | null;
  created_by?: string | null;
  artist_name?: string | null;
  // Additional fields for mass import compatibility
  year_created?: number | null;
  medium?: string | null;
  dimensions?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  photos?: string | null; // JSON array of photo URLs
  source_type?: string | null; // Source system type
  source_id?: string | null; // Original ID from source system
}

export interface NewArtistRecord {
  id: string;
  name: string;
  description: string | null;
  aliases: string | null; // JSON array of alternative names
  tags: string | null; // JSON object for metadata
  created_at: string;
  updated_at: string;
  status: 'active' | 'inactive';
  // Additional fields for mass import compatibility
  birth_year?: number | null;
  death_year?: number | null;
  nationality?: string | null;
  social_media?: string | null;
  notes?: string | null;
  source_type?: string | null; // Source system type
  source_id?: string | null; // Original ID from source system
}

// ================================
// Legacy Types (for backward compatibility during transition)
// ================================

export interface AuthSessionRecord {
  id: string;
  user_uuid: string;
  token_hash: string;
  created_at: string;
  last_accessed_at: string;
  ip_address: string | null; // Allow null for anonymous sessions
  user_agent: string | null;
  is_active: boolean;
  device_info: string | null;
  expires_at: string | null; // Session expiration time
}

export interface RateLimitRecord {
  id: string;
  identifier: string;
  identifier_type: 'email' | 'ip' | 'user_token';
  window_start: string;
  request_count: number;
  created_at: string;
  expires_at: string;
  blocked_until?: string | null; // For temporary blocking
}

// ================================
// API Request/Response Types
// ================================

export interface CreateArtworkRequest {
  lat: number;
  lon: number;
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

// Removed obsolete CreateTagRequest - tags are now JSON in artwork/artist records
// Removed obsolete CreateLogbookEntryRequest - replaced by unified submissions system
// Removed obsolete CreateCreatorRequest/CreateArtworkCreatorRequest - replaced by unified Artist system

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
  short_bio?: string; // Truncated bio for card display (~20 words)
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
  review_notes: string | null;
  reviewed_at: string | null;
  reviewer_token: string | null;
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

// Removed obsolete LogbookSubmissionRequest - replaced by unified submissions system

// Removed obsolete LogbookSubmissionResponse - replaced by unified submissions system

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

// Minimal shape for map pins
export interface MinimalArtworkPin {
  id: string;
  lat: number;
  lon: number;
  type_name: string;
  recent_photo?: string | null;
}

export interface NearbyArtworksResponse {
  // For backward compatibility we keep the wider type, but API may return
  // a minimal array when 'minimal=true' is passed. Frontend callers that need
  // full data should not set the minimal flag.
  artworks: Array<ArtworkWithPhotos | MinimalArtworkPin>;
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
  view_count?: number | null;
  id: string;
  lat: number;
  lon: number;
  created_at: string;
  status: 'pending' | 'approved' | 'removed';
  tags: string | null;
  photos: ArtworkPhotoInput[]; // Parsed photo URLs (string or metadata objects)
  type_name: string;
  logbook_entries: Array<{
    id: string;
    artwork_id: string | null;
    user_token: string;
    lat: number | null;
    lon: number | null;
    notes: string | null;
    photos: string | null;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    rejection_reason?: string;
    photos_parsed: string[];
  }>; // Keep logbook_entries for backward compatibility
  tags_parsed: Record<string, string>;
  tags_categorized: Record<string, Array<{ key: string; value: string; label: string }>>; // Add tags_categorized field
  artists: { id: string; name: string; role: string }[]; // Artists from the new artist system
  title?: string | null; // Artwork title (editable field)
  description?: string | null; // Artwork description (editable field)
  created_by?: string | null; // Creator/artist name(s) (editable field)
  artist_name?: string | null; // Computed artist name for display
  userLogbookStatus?: {
    onCooldown: boolean;
    cooldownUntil?: string;
  };
}

// Removed obsolete LogbookEntryWithPhotos - replaced by SubmissionRecord

// User Management Endpoints - updated for unified submissions system
export interface UserSubmissionsResponse {
  submissions: SubmissionRecord[]; // Updated to use unified submissions
  total: number;
  page: number;
  per_page: number;
}

// Removed obsolete UserSubmissionInfo - replaced by SubmissionRecord

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
  submission_status: SubmissionRecord['status']; // Updated to use unified submission status
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

// New standardized index page response format per PRD
export interface IndexPageResponse<T> {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  items: T[];
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
// Removed obsolete TagListResponse and LogbookListResponse - replaced by unified submissions system

// Index page response types per PRD
export interface ArtworkIndexResponse extends IndexPageResponse<ArtworkApiResponse> {}
export interface ArtistIndexResponse extends IndexPageResponse<ArtistApiResponse> {}

// ================================
// Search and Filter Types
// ================================

export interface ArtworkFilters {
  status?: ArtworkRecord['status'];
  lat?: number;
  lon?: number;
  radius?: number; // In meters
  created_after?: string;
  created_before?: string;
  search?: string;
}

// Removed obsolete LogbookFilters - replaced by unified submission filtering

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
  entity_type: 'artwork' | 'artist' | 'submission' | 'user' | 'photo' | 'consent'; // Updated to use submission instead of logbook
  entity_id: string;
  user_token: string;
  moderator_token?: string;
  action_data?: string; // JSON string
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// ================================
// Centralized Consent System Types
// ================================

export interface ConsentRecord {
  id: string; // UUID
  created_at: string; // ISO timestamp
  user_id: string | null; // References users.uuid, nullable for anonymous
  anonymous_token: string | null; // UUID for anonymous users, nullable for authenticated
  consent_version: string; // Frontend-provided policy version
  content_type: string; // 'artwork', 'logbook', etc.
  content_id: string; // Resource ID of the content
  ip_address: string; // For legal compliance
  consent_text_hash: string; // Hash of exact consent text shown
}

export type ContentType = 'artwork' | 'logbook';

export interface RecordConsentParams {
  userId?: string;
  anonymousToken?: string;
  contentType: ContentType;
  contentId: string;
  consentVersion: string;
  ipAddress: string;
  consentTextHash: string;
  source?: string;
  requestId?: string;
  db: D1Database;
}

export interface RecordConsentResponse {
  id: string;
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
  code:
    | 'required'
    | 'invalid_format'
    | 'out_of_range'
    | 'invalid_enum'
    | 'unknown_key'
    | 'warning'
    | 'validation_error';
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
// User Lists Types
// ================================

export interface ListRecord {
  id: string;
  owner_user_id: string;
  name: string;
  visibility: 'unlisted' | 'private';
  is_readonly: number; // 0 or 1 (SQLite boolean)
  is_system_list: number; // 0 or 1 (SQLite boolean)
  created_at: string;
  updated_at: string;
}

export interface ListItemRecord {
  id: string;
  list_id: string;
  artwork_id: string;
  added_by_user_id: string | null; // NULL for system additions
  created_at: string;
}

export interface ListApiResponse {
  id: string;
  owner_user_id: string;
  name: string;
  visibility: 'unlisted' | 'private';
  is_readonly: boolean;
  is_system_list: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
  items?: ArtworkApiResponse[]; // Populated when requesting list details
}

export interface CreateListRequest {
  name: string;
}

export interface CreateListResponse {
  id: string;
  name: string;
  created_at: string;
}

export interface AddToListRequest {
  artwork_id: string;
}

export interface RemoveFromListRequest {
  artwork_ids: string[];
}

export interface ListItemsResponse extends PaginatedResponse<ArtworkApiResponse> {
  list: ListApiResponse;
}

// Special list names as constants
export const SPECIAL_LIST_NAMES = {
  LOVED: 'Loved',
  VISITED: 'Visited', 
  STARRED: 'Starred',
  SUBMISSIONS: 'Submissions'
} as const;

export type SpecialListName = typeof SPECIAL_LIST_NAMES[keyof typeof SPECIAL_LIST_NAMES];

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
  profile_name: string | null; // Added for badge system
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

// Removed obsolete RateLimitRecord and AuthSessionRecord - replaced by UserActivityRecord in unified schema

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

// ================================
// Badge System Types
// ================================

export interface BadgeRecord {
  id: string;
  badge_key: string;
  title: string;
  description: string;
  icon_emoji: string;
  category: 'activity' | 'community' | 'seasonal' | 'geographic';
  threshold_type: 'submission_count' | 'photo_count' | 'account_age' | 'email_verified';
  threshold_value: number | null;
  level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserBadgeRecord {
  id: string;
  user_uuid: string;
  badge_id: string;
  awarded_at: string;
  award_reason: string;
  metadata: string | null; // JSON for additional badge-specific data
}

// Badge API Types
export interface BadgeListResponse {
  badges: BadgeRecord[];
}

export interface UserBadgeResponse {
  user_badges: Array<{
    badge: BadgeRecord;
    awarded_at: string;
    award_reason: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface ProfileUpdateRequest {
  profile_name: string;
}

export interface ProfileUpdateResponse {
  success: boolean;
  message: string;
  profile_name?: string;
}

export interface ProfileNameCheckResponse {
  available: boolean;
  message: string;
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

// ================================
// Type Guards and Validators
// ================================

export const isValidArtworkStatus = (status: string): status is ArtworkRecord['status'] => {
  return ['pending', 'approved', 'removed'].includes(status);
};

// Removed obsolete isValidLogbookStatus - replaced by submission status validation

export const isValidSortDirection = (direction: string): direction is SortDirection => {
  return ['asc', 'desc'].includes(direction);
};

// Authentication validators
export const isValidUserStatus = (status: string): status is UserRecord['status'] => {
  return ['active', 'suspended'].includes(status);
};

// Removed obsolete isValidRateLimitIdentifierType - replaced by UserActivityRecord validation

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
// Removed obsolete LOGBOOK_STATUSES - replaced by submission status constants

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
// NEW UNIFIED SCHEMA TYPES
// ================================

// Submission Record (replaces logbook and artwork_edits)
export interface SubmissionRecord {
  id: string;
  artwork_id: string | null;
  artist_id: string | null;
  user_token: string;
  submission_type: 'new_artwork' | 'artwork_edit' | 'artwork_photos' | 'new_artist' | 'artist_edit';
  field_changes: string | null; // JSON: {"title": {"old": "...", "new": "..."}}
  photos: string | null; // JSON array: ["url1", "url2"]
  notes: string | null;
  lat: number | null;
  lon: number | null;

  // Legacy fields for backward compatibility
  new_data?: string | null; // JSON object - deprecated, use field_changes
  tags?: string | null; // JSON tags - deprecated, use field_changes

  // Integrated consent tracking
  consent_version: string;
  consent_text_hash: string;
  ip_address: string;
  user_agent: string | null;

  // Timestamps
  created_at: string;
  submitted_at: string;

  // Moderation workflow
  status: 'pending' | 'approved' | 'rejected';
  review_notes: string | null;
  reviewed_at: string | null;
  reviewer_token: string | null; // reviewer token/id
}

// User Activity Record (replaces rate_limits and auth_sessions)
export interface UserActivityRecord {
  id: string;
  identifier: string; // email, IP, or user_token
  identifier_type: 'email' | 'ip' | 'user_token';
  activity_type: 'rate_limit' | 'auth_session' | 'submission';
  window_start: string | null; // ISO timestamp for rate limiting windows
  request_count: number;
  session_data: string | null; // JSON string for session metadata
  last_activity_at: string;
  created_at: string;
  expires_at: string | null;
}

// User Role Record (new role-based permissions)
export interface UserRoleRecord {
  id: string;
  user_token: string;
  role: 'admin' | 'moderator' | 'curator' | 'reviewer' | 'user' | 'banned';
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  is_active: boolean;
  notes: string | null;
  permissions?: string; // JSON array of permission strings
}

// ================================
// NOTIFICATION SYSTEM TYPES
// ================================

// Notification Record (database table representation)
export interface NotificationRecord {
  id: string;
  user_token: string;
  type: 'badge' | 'admin_message' | 'review' | 'system';
  type_key: string | null; // Optional subtype or canonical key
  title: string;
  message: string | null;
  metadata: string | null; // JSON string for structured payload
  created_at: string;
  is_dismissed: number; // SQLite boolean (0/1)
  related_id: string | null; // Optional foreign key reference
}

// Notification API Response (parsed for frontend consumption)
export interface NotificationResponse {
  id: string;
  user_token: string;
  type: 'badge' | 'admin_message' | 'review' | 'system';
  type_key: string | null;
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null; // Parsed JSON metadata
  created_at: string;
  is_dismissed: boolean; // Converted to boolean
  related_id: string | null;
}

// Notification Creation Input
export interface CreateNotificationInput {
  user_token: string;
  type: 'badge' | 'admin_message' | 'review' | 'system';
  type_key?: string;
  title: string;
  message?: string;
  metadata?: Record<string, unknown>;
  related_id?: string;
}

// Notification List API Response
export interface NotificationListResponse {
  notifications: NotificationResponse[];
  pagination: {
    total: number;
    current_page: number;
    per_page: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Notification Unread Count API Response
export interface NotificationUnreadCountResponse {
  unread_count: number;
}

// Notification Action Response
export interface NotificationActionResponse {
  success: boolean;
  message?: string;
}

// Badge Notification Metadata (specific to badge type notifications)
export interface BadgeNotificationMetadata {
  badge_id: string;
  badge_key: string;
  award_reason: string;
  badge_title?: string;
  badge_icon_emoji?: string;
}

// Type guard to safely detect BadgeNotificationMetadata at runtime
export function isBadgeNotificationMetadata(obj: unknown): obj is BadgeNotificationMetadata {
  if (!obj || typeof obj !== 'object') return false;
  const asRec = obj as Record<string, unknown>;
  return (
    typeof asRec['badge_id'] === 'string' &&
    typeof asRec['badge_key'] === 'string' &&
    typeof asRec['award_reason'] === 'string'
  );
}

// ================================
// Location Cache Types
// ================================

export interface LocationCacheRecord {
  lat: number;
  lon: number;
  version: string;
  display_name: string;
  country_code: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  suburb: string | null;
  neighbourhood: string | null;
  road: string | null;
  postcode: string | null;
  raw_response: string; // JSON string of full Nominatim response
  created_at: string; // ISO 8601 timestamp
}

export interface NominatimResponse {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  category: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name: string;
  display_name: string;
  address: {
    tourism?: string;
    amenity?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    city?: string;
    county?: string;
    state_district?: string;
    state?: string;
    'ISO3166-2-lvl4'?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  boundingbox: [string, string, string, string];
}

export interface LocationLookupOptions {
  useCache?: boolean;
  zoom?: number;
  timeout?: number;
}

export interface LocationResult {
  lat: number;
  lon: number;
  display_name: string;
  country_code: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  suburb: string | null;
  neighbourhood: string | null;
  road: string | null;
  postcode: string | null;
  source: 'cache' | 'nominatim';
  last_updated: string;
}

// ================================
// Feedback System Types (Moderator-only)
// ================================

export interface FeedbackRecord {
  id: string;
  subject_type: 'artwork' | 'artist';
  subject_id: string;
  user_token: string | null;
  issue_type: 'missing' | 'incorrect_info' | 'other' | 'comment';
  note: string;
  status: 'open' | 'archived' | 'resolved';
  created_at: string;
  reviewed_at: string | null;
  moderator_token: string | null;
  review_notes: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface CreateFeedbackRequest {
  subject_type: 'artwork' | 'artist';
  subject_id: string;
  issue_type: 'missing' | 'incorrect_info' | 'other' | 'comment';
  note: string;
  user_token?: string | null;
  consent_version?: string;
  consent_text_hash?: string;
}

export interface CreateFeedbackResponse {
  id: string;
  status: 'open';
  created_at: string;
  message?: string;
}

export interface FeedbackListResponse {
  feedback: FeedbackRecord[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface ReviewFeedbackRequest {
  action: 'archive' | 'resolve' | 'apply_changes';
  moderator_token: string;
  review_notes?: string;
  changes?: Partial<CreateArtworkRequest> | Partial<CreateArtistRequest>;
}

export interface ReviewFeedbackResponse {
  feedback: FeedbackRecord;
  message?: string;
}

// Constants
export const FEEDBACK_SUBJECT_TYPES = ['artwork', 'artist'] as const;
export const FEEDBACK_ISSUE_TYPES = ['missing', 'incorrect_info', 'other', 'comment'] as const;
export const FEEDBACK_STATUSES = ['open', 'archived', 'resolved'] as const;
export const MAX_FEEDBACK_NOTE_LENGTH = 1000;

// Validators
export const isValidFeedbackSubjectType = (t: string): t is FeedbackRecord['subject_type'] =>
  FEEDBACK_SUBJECT_TYPES.includes(t as FeedbackRecord['subject_type']);

export const isValidFeedbackIssueType = (t: string): t is FeedbackRecord['issue_type'] =>
  FEEDBACK_ISSUE_TYPES.includes(t as FeedbackRecord['issue_type']);

export const isValidFeedbackStatus = (s: string): s is FeedbackRecord['status'] =>
  FEEDBACK_STATUSES.includes(s as FeedbackRecord['status']);

// ================================
// LEGACY TYPES (Maintaining for compatibility)
// ================================

// Removed duplicate and obsolete type definitions - using the unified schema types above
