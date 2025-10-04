// ================================
// Database Schema Types
// ================================
// ================================
// API Response Utilities
// ================================
/**
 * Create a successful API response with consistent formatting
 */
export function createApiSuccessResponse(data, message) {
    const response = {
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
export function createApiErrorResponse(error, message) {
    const response = {
        success: false,
        error,
        timestamp: new Date().toISOString(),
    };
    if (message) {
        response.message = message;
    }
    return response;
}
// Special list names as constants
export const SPECIAL_LIST_NAMES = {
    LOVED: 'Loved',
    VISITED: 'Visited',
    STARRED: 'Starred'
};
// ================================
// ================================
// Type Guards and Validators
// ================================
export const isValidArtworkStatus = (status) => {
    return ['pending', 'approved', 'removed'].includes(status);
};
// Removed obsolete isValidLogbookStatus - replaced by submission status validation
export const isValidSortDirection = (direction) => {
    return ['asc', 'desc'].includes(direction);
};
// Authentication validators
export const isValidUserStatus = (status) => {
    return ['active', 'suspended'].includes(status);
};
// Removed obsolete isValidRateLimitIdentifierType - replaced by UserActivityRecord validation
export const isValidUUID = (uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
};
export const isValidMagicLinkToken = (token) => {
    return token.length >= MAGIC_LINK_TOKEN_LENGTH && /^[a-f0-9]+$/i.test(token);
};
// ================================
// Constants
// ================================
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ARTWORK_STATUSES = ['pending', 'approved', 'removed'];
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
};
// Type guards for permissions and audit
export const isValidPermission = (permission) => {
    return ['moderator', 'admin'].includes(permission);
};
export const isValidModerationDecision = (decision) => {
    return ['approved', 'rejected', 'skipped'].includes(decision);
};
export const isValidAdminActionType = (action) => {
    return ['grant_permission', 'revoke_permission', 'view_audit_logs'].includes(action);
};
// Permission constants
export const PERMISSIONS = ['moderator', 'admin'];
export const MODERATION_DECISIONS = ['approved', 'rejected', 'skipped'];
export const ADMIN_ACTION_TYPES = [
    'grant_permission',
    'revoke_permission',
    'view_audit_logs',
];
// Type guard to safely detect BadgeNotificationMetadata at runtime
export function isBadgeNotificationMetadata(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const asRec = obj;
    return (typeof asRec['badge_id'] === 'string' &&
        typeof asRec['badge_key'] === 'string' &&
        typeof asRec['award_reason'] === 'string');
}
// Constants
export const FEEDBACK_SUBJECT_TYPES = ['artwork', 'artist'];
export const FEEDBACK_ISSUE_TYPES = ['missing', 'incorrect_info', 'other', 'comment'];
export const FEEDBACK_STATUSES = ['open', 'archived', 'resolved'];
export const MAX_FEEDBACK_NOTE_LENGTH = 1000;
// Validators
export const isValidFeedbackSubjectType = (t) => FEEDBACK_SUBJECT_TYPES.includes(t);
export const isValidFeedbackIssueType = (t) => FEEDBACK_ISSUE_TYPES.includes(t);
export const isValidFeedbackStatus = (s) => FEEDBACK_STATUSES.includes(s);
// ================================
// LEGACY TYPES (Maintaining for compatibility)
// ================================
// Removed duplicate and obsolete type definitions - using the unified schema types above
//# sourceMappingURL=types.js.map