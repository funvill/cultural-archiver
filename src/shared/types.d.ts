import type { D1Database } from '@cloudflare/workers-types';
export interface ArtworkRecord {
    id: string;
    lat: number;
    lon: number;
    created_at: string;
    status: 'pending' | 'approved' | 'removed';
    tags: string | null;
    title?: string | null;
    description?: string | null;
    created_by?: string | null;
    artist_name?: string | null;
}
export interface ArtworkApiResponse {
    id: string;
    lat: number;
    lon: number;
    created_at: string;
    status: 'pending' | 'approved' | 'removed';
    tags: string | null;
    photos: ArtworkPhotoInput[] | null;
    type_name?: string;
    tags_parsed?: Record<string, unknown>;
    title?: string | null;
    description?: string | null;
    created_by?: string | null;
    recent_photo?: string | null;
    photo_count?: number;
    artist_name?: string | null;
    updated_at?: string | null;
}
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
export interface ArtistRecord {
    id: string;
    name: string;
    description: string | null;
    aliases: string | null;
    tags: string | null;
    created_at: string;
    updated_at: string;
    status: 'active' | 'inactive';
}
export interface ArtworkArtistRecord {
    artwork_id: string;
    artist_id: string;
    role: string;
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
export interface NewArtworkRecord {
    id: string;
    lat: number;
    lon: number;
    created_at: string;
    status: 'pending' | 'approved' | 'removed';
    tags: string | null;
    title?: string | null;
    description?: string | null;
    created_by?: string | null;
    artist_name?: string | null;
    year_created?: number | null;
    medium?: string | null;
    dimensions?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
    photos?: string | null;
    source_type?: string | null;
    source_id?: string | null;
}
export interface NewArtistRecord {
    id: string;
    name: string;
    description: string | null;
    aliases: string | null;
    tags: string | null;
    created_at: string;
    updated_at: string;
    status: 'active' | 'inactive';
    birth_year?: number | null;
    death_year?: number | null;
    nationality?: string | null;
    social_media?: string | null;
    notes?: string | null;
    source_type?: string | null;
    source_id?: string | null;
}
export interface AuthSessionRecord {
    id: string;
    user_uuid: string;
    token_hash: string;
    created_at: string;
    last_accessed_at: string;
    ip_address: string | null;
    user_agent: string | null;
    is_active: boolean;
    device_info: string | null;
    expires_at: string | null;
}
export interface RateLimitRecord {
    id: string;
    identifier: string;
    identifier_type: 'email' | 'ip' | 'user_token';
    window_start: string;
    request_count: number;
    created_at: string;
    expires_at: string;
    blocked_until?: string | null;
}
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
    short_bio?: string;
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
export interface NearbyArtworkInfo {
    id: string;
    lat: number;
    lon: number;
    type_name: string;
    distance_meters: number;
    photos: string[];
}
export interface NearbyArtworksRequest {
    lat: number;
    lon: number;
    radius?: number;
    limit?: number;
}
export interface MinimalArtworkPin {
    id: string;
    lat: number;
    lon: number;
    type_name: string;
    recent_photo?: string | null;
}
export interface NearbyArtworksResponse {
    artworks: Array<ArtworkWithPhotos | MinimalArtworkPin>;
    total: number;
    search_center: {
        lat: number;
        lon: number;
    };
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
    photos: ArtworkPhotoInput[];
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
    }>;
    tags_parsed: Record<string, string>;
    tags_categorized: Record<string, Array<{
        key: string;
        value: string;
        label: string;
    }>>;
    artists: {
        id: string;
        name: string;
        role: string;
    }[];
    title?: string | null;
    description?: string | null;
    created_by?: string | null;
    artist_name?: string | null;
    userLogbookStatus?: {
        onCooldown: boolean;
        cooldownUntil?: string;
    };
}
export interface UserSubmissionsResponse {
    submissions: SubmissionRecord[];
    total: number;
    page: number;
    per_page: number;
}
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
    submission_status: SubmissionRecord['status'];
}
export interface RateLimitInfo {
    submissions_remaining: number;
    submissions_reset_at: string;
    queries_remaining: number;
    queries_reset_at: string;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: string;
}
/**
 * Create a successful API response with consistent formatting
 */
export declare function createApiSuccessResponse<T>(data: T, message?: string): ApiResponse<T>;
/**
 * Create an error API response with consistent formatting
 */
export declare function createApiErrorResponse(error: string, message?: string): ApiResponse<never>;
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    per_page: number;
    has_more: boolean;
}
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
export interface ArtworkListResponse extends PaginatedResponse<ArtworkRecord> {
}
export interface ArtworkIndexResponse extends IndexPageResponse<ArtworkApiResponse> {
}
export interface ArtistIndexResponse extends IndexPageResponse<ArtistApiResponse> {
}
export interface ArtworkFilters {
    status?: ArtworkRecord['status'];
    lat?: number;
    lon?: number;
    radius?: number;
    created_after?: string;
    created_before?: string;
    search?: string;
}
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
export interface AuditLogRecord {
    id: string;
    action_type: 'submission_created' | 'submission_approved' | 'submission_rejected' | 'artwork_created' | 'artwork_updated' | 'artwork_removed' | 'consent_collected' | 'consent_updated' | 'email_verified' | 'photo_uploaded' | 'photo_processed' | 'batch_processed';
    entity_type: 'artwork' | 'artist' | 'submission' | 'user' | 'photo' | 'consent';
    entity_id: string;
    user_token: string;
    moderator_token?: string;
    action_data?: string;
    reason?: string;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
}
export interface ConsentRecord {
    id: string;
    created_at: string;
    user_id: string | null;
    anonymous_token: string | null;
    consent_version: string;
    content_type: string;
    content_id: string;
    ip_address: string;
    consent_text_hash: string;
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
export interface StructuredTagValue {
    key: string;
    value: string | number | boolean;
    category: string;
    dataType: 'enum' | 'text' | 'number' | 'date' | 'yes_no' | 'url' | 'wikidata_id';
}
export interface StructuredTagsData {
    tags: Record<string, string | number | boolean>;
    version: string;
    lastModified: string;
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
export interface OSMExportData {
    tags: Record<string, string>;
    export_timestamp: string;
    schema_version: string;
}
export interface OSMExportRequest {
    artwork_ids?: string[];
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
export interface ListRecord {
    id: string;
    owner_user_id: string;
    name: string;
    visibility: 'unlisted' | 'private';
    is_readonly: number;
    is_system_list: number;
    created_at: string;
    updated_at: string;
}
export interface ListItemRecord {
    id: string;
    list_id: string;
    artwork_id: string;
    added_by_user_id: string | null;
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
    items?: ArtworkApiResponse[];
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
export declare const SPECIAL_LIST_NAMES: {
    readonly LOVED: "Loved";
    readonly VISITED: "Visited";
    readonly STARRED: "Starred";
};
export type SpecialListName = typeof SPECIAL_LIST_NAMES[keyof typeof SPECIAL_LIST_NAMES];
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
export interface AppConfig {
    environment: 'development' | 'staging' | 'production';
    frontend_url: string;
    api_base_url: string;
    r2_public_url?: string;
    log_level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
}
export interface UserRecord {
    uuid: string;
    email: string;
    created_at: string;
    last_login: string | null;
    email_verified_at: string | null;
    status: 'active' | 'suspended';
    profile_name: string | null;
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
export interface AuthStatusRequest {
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
export interface LogoutRequest {
}
export interface LogoutResponse {
    success: boolean;
    message: string;
    new_anonymous_token: string;
}
export interface AuthContext {
    userToken: string;
    isVerifiedEmail: boolean;
    isReviewer: boolean;
    isAdmin?: boolean;
    permissions?: Permission[];
    user?: UserRecord;
}
export interface RateLimitInfo {
    identifier: string;
    identifier_type: 'email' | 'ip';
    requests_remaining: number;
    window_reset_at: string;
    is_blocked: boolean;
    blocked_until?: string;
}
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
export interface UUIDClaimInfo {
    anonymous_uuid: string;
    email: string;
    can_claim: boolean;
    existing_submissions_count: number;
    claim_window_expires_at?: string;
}
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
    metadata: string | null;
}
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
export interface WorkerEnv {
    DB: unknown;
    SESSIONS: unknown;
    CACHE: unknown;
    RATE_LIMITS: unknown;
    MAGIC_LINKS: unknown;
    PHOTOS_BUCKET: unknown;
    ENVIRONMENT: string;
    FRONTEND_URL: string;
    LOG_LEVEL: string;
    API_VERSION: string;
    EMAIL_API_KEY?: string;
    EMAIL_FROM: string;
    PHOTOS_BASE_URL?: string;
    R2_PUBLIC_URL?: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
}
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
export interface ApiSuccessResponse<T = unknown> {
    [key: string]: T;
}
export interface ApiErrorResponse extends ApiError {
}
export declare const isValidArtworkStatus: (status: string) => status is ArtworkRecord["status"];
export declare const isValidSortDirection: (direction: string) => direction is SortDirection;
export declare const isValidUserStatus: (status: string) => status is UserRecord["status"];
export declare const isValidUUID: (uuid: string) => boolean;
export declare const isValidEmail: (email: string) => boolean;
export declare const isValidMagicLinkToken: (token: string) => boolean;
export declare const DEFAULT_PAGE_SIZE = 20;
export declare const MAX_PAGE_SIZE = 100;
export declare const MAX_UPLOAD_SIZE: number;
export declare const SUPPORTED_IMAGE_TYPES: readonly ["image/jpeg", "image/png", "image/webp"];
export declare const ARTWORK_STATUSES: readonly ["pending", "approved", "removed"];
export declare const DEFAULT_SEARCH_RADIUS = 500;
export declare const MAX_SEARCH_RADIUS = 10000;
export declare const MIN_SEARCH_RADIUS = 50;
export declare const RATE_LIMIT_SUBMISSIONS_PER_HOUR = 60;
export declare const RATE_LIMIT_QUERIES_PER_HOUR = 60;
export declare const RATE_LIMIT_MAGIC_LINKS_PER_EMAIL_PER_HOUR = 10;
export declare const RATE_LIMIT_MAGIC_LINKS_PER_IP_PER_HOUR = 20;
export declare const MAGIC_LINK_EXPIRY_HOURS = 1;
export declare const MAGIC_LINK_TOKEN_LENGTH = 64;
export declare const MAX_NOTE_LENGTH = 500;
export declare const MAX_PHOTOS_PER_SUBMISSION = 3;
export declare const MAX_PHOTO_SIZE: number;
export declare const THUMBNAIL_MAX_SIZE = 800;
export declare const PHOTO_BUCKET_STRUCTURE: {
    readonly ORIGINALS: "originals";
    readonly THUMBS: "thumbs";
};
export type Permission = 'moderator' | 'admin';
export interface UserPermissionRecord {
    id: string;
    user_uuid: string;
    permission: Permission;
    granted_by: string;
    granted_at: string;
    revoked_at: string | null;
    revoked_by: string | null;
    is_active: boolean;
    notes: string | null;
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
export type ModerationDecision = 'approved' | 'rejected' | 'skipped';
export type AdminActionType = 'grant_permission' | 'revoke_permission' | 'view_audit_logs';
export interface ModerationDecisionRecord {
    id: string;
    submission_id: string;
    moderator_uuid: string;
    decision: ModerationDecision;
    reason: string | null;
    metadata: string | null;
    artwork_id: string | null;
    action_taken: string | null;
    photos_processed: number;
    created_at: string;
}
export interface AdminActionRecord {
    id: string;
    admin_uuid: string;
    action_type: AdminActionType;
    target_uuid: string | null;
    permission_type: Permission | null;
    old_value: string | null;
    new_value: string | null;
    reason: string | null;
    metadata: string | null;
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
export declare const isValidPermission: (permission: string) => permission is Permission;
export declare const isValidModerationDecision: (decision: string) => decision is ModerationDecision;
export declare const isValidAdminActionType: (action: string) => action is AdminActionType;
export declare const PERMISSIONS: readonly ["moderator", "admin"];
export declare const MODERATION_DECISIONS: readonly ["approved", "rejected", "skipped"];
export declare const ADMIN_ACTION_TYPES: readonly ["grant_permission", "revoke_permission", "view_audit_logs"];
export interface SubmissionRecord {
    id: string;
    artwork_id: string | null;
    artist_id: string | null;
    user_token: string;
    submission_type: 'new_artwork' | 'artwork_edit' | 'artwork_photos' | 'new_artist' | 'artist_edit';
    field_changes: string | null;
    photos: string | null;
    notes: string | null;
    lat: number | null;
    lon: number | null;
    new_data?: string | null;
    tags?: string | null;
    consent_version: string;
    consent_text_hash: string;
    ip_address: string;
    user_agent: string | null;
    created_at: string;
    submitted_at: string;
    status: 'pending' | 'approved' | 'rejected';
    review_notes: string | null;
    reviewed_at: string | null;
    reviewer_token: string | null;
}
export interface UserActivityRecord {
    id: string;
    identifier: string;
    identifier_type: 'email' | 'ip' | 'user_token';
    activity_type: 'rate_limit' | 'auth_session' | 'submission';
    window_start: string | null;
    request_count: number;
    session_data: string | null;
    last_activity_at: string;
    created_at: string;
    expires_at: string | null;
}
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
    permissions?: string;
}
export interface NotificationRecord {
    id: string;
    user_token: string;
    type: 'badge' | 'admin_message' | 'review' | 'system';
    type_key: string | null;
    title: string;
    message: string | null;
    metadata: string | null;
    created_at: string;
    is_dismissed: number;
    related_id: string | null;
}
export interface NotificationResponse {
    id: string;
    user_token: string;
    type: 'badge' | 'admin_message' | 'review' | 'system';
    type_key: string | null;
    title: string;
    message: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    is_dismissed: boolean;
    related_id: string | null;
}
export interface CreateNotificationInput {
    user_token: string;
    type: 'badge' | 'admin_message' | 'review' | 'system';
    type_key?: string;
    title: string;
    message?: string;
    metadata?: Record<string, unknown>;
    related_id?: string;
}
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
export interface NotificationUnreadCountResponse {
    unread_count: number;
}
export interface NotificationActionResponse {
    success: boolean;
    message?: string;
}
export interface BadgeNotificationMetadata {
    badge_id: string;
    badge_key: string;
    award_reason: string;
    badge_title?: string;
    badge_icon_emoji?: string;
}
export declare function isBadgeNotificationMetadata(obj: unknown): obj is BadgeNotificationMetadata;
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
    raw_response: string;
    created_at: string;
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
export declare const FEEDBACK_SUBJECT_TYPES: readonly ["artwork", "artist"];
export declare const FEEDBACK_ISSUE_TYPES: readonly ["missing", "incorrect_info", "other", "comment"];
export declare const FEEDBACK_STATUSES: readonly ["open", "archived", "resolved"];
export declare const MAX_FEEDBACK_NOTE_LENGTH = 1000;
export declare const isValidFeedbackSubjectType: (t: string) => t is FeedbackRecord["subject_type"];
export declare const isValidFeedbackIssueType: (t: string) => t is FeedbackRecord["issue_type"];
export declare const isValidFeedbackStatus: (s: string) => s is FeedbackRecord["status"];
//# sourceMappingURL=types.d.ts.map