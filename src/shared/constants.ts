/**
 * Shared Constants for the Cultural Archiver System
 * 
 * This file contains all known UUIDs and constants used throughout the system
 * for sample data, system users, and other predefined entities.
 */

// ================================
// System User UUIDs
// ================================

/** Mass Import System User - Used for automated mass import operations */
export const MASS_IMPORT_USER_UUID = 'a0000000-1000-4000-8000-000000000002';

/** System Admin User - Used for system-level operations */
export const SYSTEM_ADMIN_USER_UUID = 'a0000000-1000-4000-8000-000000000001';

/** Anonymous System User - Used for anonymous operations when no user is available */
export const ANONYMOUS_SYSTEM_USER_UUID = 'a0000000-1000-4000-8000-000000000003';

/** Unknown Artist - Used for artworks where the artist is unknown or anonymous */
export const UNKNOWN_ARTIST_UUID = 'd0000000-1000-4000-8000-000000000001';

// ================================
// Sample Data UUIDs
// ================================

/** Sample User for Testing */
export const SAMPLE_USER_UUID = 'b0000000-1000-4000-8000-000000000010';

/** Sample Artwork 1 - Used in tests and examples */
export const SAMPLE_ARTWORK_1_UUID = 'c0000000-1000-4000-8000-000000000101';

/** Sample Artwork 2 - Used in tests and examples */
export const SAMPLE_ARTWORK_2_UUID = 'c0000000-1000-4000-8000-000000000102';

/** Sample Artwork 3 - Used in tests and examples */
export const SAMPLE_ARTWORK_3_UUID = 'c0000000-1000-4000-8000-000000000103';

/** Sample Artist 1 - Used in tests and examples */
export const SAMPLE_ARTIST_1_UUID = 'd0000000-1000-4000-8000-000000000201';

/** Sample Artist 2 - Used in tests and examples */
export const SAMPLE_ARTIST_2_UUID = 'd0000000-1000-4000-8000-000000000202';

/** Sample Artist 3 - Used in tests and examples */
export const SAMPLE_ARTIST_3_UUID = 'd0000000-1000-4000-8000-000000000203';

/** Sample Submission 1 - Used in tests and examples */
export const SAMPLE_SUBMISSION_1_UUID = 'e0000000-1000-4000-8000-000000000301';

/** Sample Submission 2 - Used in tests and examples */
export const SAMPLE_SUBMISSION_2_UUID = 'e0000000-1000-4000-8000-000000000302';

/** Sample Submission 3 - Used in tests and examples */
export const SAMPLE_SUBMISSION_3_UUID = 'e0000000-1000-4000-8000-000000000303';

/** Sample Magic Link Token - Used in tests */
export const SAMPLE_MAGIC_LINK_TOKEN = '00000000000000000000000000000000000000000000000000000000000000001234567890abcdef';

/** Sample Auth Session 1 - Used in tests */
export const SAMPLE_AUTH_SESSION_1_UUID = 'f0000000-1000-4000-8000-000000000401';

/** Sample Auth Session 2 - Used in tests */
export const SAMPLE_AUTH_SESSION_2_UUID = 'f0000000-1000-4000-8000-000000000402';

/** Sample User Role 1 - Used in tests */
export const SAMPLE_USER_ROLE_1_UUID = 'f0000000-1000-4000-8000-000000000501';

/** Sample User Role 2 - Used in tests */
export const SAMPLE_USER_ROLE_2_UUID = 'f0000000-1000-4000-8000-000000000502';

/** Sample Consent Record 1 - Used in tests */
export const SAMPLE_CONSENT_1_UUID = 'f0000000-1000-4000-8000-000000000601';

/** Sample Consent Record 2 - Used in tests */
export const SAMPLE_CONSENT_2_UUID = 'f0000000-1000-4000-8000-000000000602';

/** Sample Audit Log 1 - Used in tests */
export const SAMPLE_AUDIT_LOG_1_UUID = 'f0000000-1000-4000-8000-000000000701';

/** Sample Audit Log 2 - Used in tests */
export const SAMPLE_AUDIT_LOG_2_UUID = 'f0000000-1000-4000-8000-000000000702';

/** Sample User Activity 1 - Used in tests */
export const SAMPLE_USER_ACTIVITY_1_UUID = 'f0000000-1000-4000-8000-000000000801';

/** Sample User Activity 2 - Used in tests */
export const SAMPLE_USER_ACTIVITY_2_UUID = 'f0000000-1000-4000-8000-000000000802';

// ================================
// UUID Validation and Generation
// ================================

/** UUID v4 pattern for validation */
export const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Known UUID pattern for sample data */
export const KNOWN_SAMPLE_UUID_PATTERN = /^[a-f]0000000-1000-4000-8000-[0-9a-f]{12}$/;

/**
 * Validates if a string is a valid UUID v4
 */
export function isValidUUID(uuid: string): boolean {
  return UUID_V4_PATTERN.test(uuid);
}

/**
 * Validates if a UUID is a known sample/system UUID
 */
export function isSampleUUID(uuid: string): boolean {
  return KNOWN_SAMPLE_UUID_PATTERN.test(uuid);
}

/**
 * Generates a new UUID v4 (using crypto.randomUUID in environments that support it)
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * All sample UUIDs in a single array for easy reference
 */
export const ALL_SAMPLE_UUIDS = [
  SYSTEM_ADMIN_USER_UUID,
  MASS_IMPORT_USER_UUID,
  ANONYMOUS_SYSTEM_USER_UUID,
  UNKNOWN_ARTIST_UUID,
  SAMPLE_USER_UUID,
  SAMPLE_ARTWORK_1_UUID,
  SAMPLE_ARTWORK_2_UUID,
  SAMPLE_ARTWORK_3_UUID,
  SAMPLE_ARTIST_1_UUID,
  SAMPLE_ARTIST_2_UUID,
  SAMPLE_ARTIST_3_UUID,
  SAMPLE_SUBMISSION_1_UUID,
  SAMPLE_SUBMISSION_2_UUID,
  SAMPLE_SUBMISSION_3_UUID,
  SAMPLE_AUTH_SESSION_1_UUID,
  SAMPLE_AUTH_SESSION_2_UUID,
  SAMPLE_USER_ROLE_1_UUID,
  SAMPLE_USER_ROLE_2_UUID,
  SAMPLE_CONSENT_1_UUID,
  SAMPLE_CONSENT_2_UUID,
  SAMPLE_AUDIT_LOG_1_UUID,
  SAMPLE_AUDIT_LOG_2_UUID,
  SAMPLE_USER_ACTIVITY_1_UUID,
  SAMPLE_USER_ACTIVITY_2_UUID,
] as const;

// ================================
// Database Table ID Constraints
// ================================

/** SQL constraint to ensure all IDs are valid UUIDs */
export const UUID_CHECK_CONSTRAINT = `CHECK (id GLOB '[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]-[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]-[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]-[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]-[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]')`;

/** SQL constraint for UUID fields that allow NULL */
export const UUID_CHECK_CONSTRAINT_NULLABLE = `CHECK (id IS NULL OR id GLOB '[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]-[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]-[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]-[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]-[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]')`;

// ================================
// Badge System Constants
// ================================

/** Banned profile names to prevent impersonation */
export const BANNED_PROFILE_NAMES = [
  // System roles
  'admin',
  'administrator', 
  'moderator',
  'mod',
  'owner',
  'root',
  'system',
  'support',
  'help',
  'staff',
  'team',
  'manager',
  'boss',
  'supervisor',
  'director',
  'officer',
  'agent',
  
  // Organization terms
  'cultural-archiver',
  'culturalarchiver',
  'archiver',
  'official',
  'verified',
  'api',
  'bot',
  'service',
  'account',
  'user',
  'guest',
  'anonymous',
  'null',
  'undefined',
  'none',
  'empty',
  
  // Technical terms
  'www',
  'ftp',
  'mail',
  'email',
  'smtp',
  'http',
  'https',
  'ssl',
  'tls',
  'cdn',
  'dns',
  'backup',
  'test',
  'staging',
  'production',
  'dev',
  'development',
  'debug',
  'console',
  'log',
  'error',
  'warning',
  'info',
  'config',
  'settings',
  'options',
  'preferences',
] as const;

/** Profile name validation regex: 3-20 chars, alphanumeric + dash, no start/end dash */
export const PROFILE_NAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

/** Profile name minimum length */
export const PROFILE_NAME_MIN_LENGTH = 3;

/** Profile name maximum length */
export const PROFILE_NAME_MAX_LENGTH = 20;

/**
 * Validates if a profile name meets all requirements
 */
export function isValidProfileName(name: string): boolean {
  if (!name || 
      name.length < PROFILE_NAME_MIN_LENGTH || 
      name.length > PROFILE_NAME_MAX_LENGTH) {
    return false;
  }
  
  if (!PROFILE_NAME_REGEX.test(name)) {
    return false;
  }
  
  // Check against banned names (case-insensitive)
  const lowerName = name.toLowerCase();
  return !BANNED_PROFILE_NAMES.some(banned => banned === lowerName);
}

/**
 * Gets a descriptive error message for an invalid profile name
 */
export function getProfileNameValidationError(name: string): string {
  if (!name) {
    return 'Profile name is required';
  }
  
  if (name.length < PROFILE_NAME_MIN_LENGTH) {
    return `Profile name must be at least ${PROFILE_NAME_MIN_LENGTH} characters long`;
  }
  
  if (name.length > PROFILE_NAME_MAX_LENGTH) {
    return `Profile name cannot exceed ${PROFILE_NAME_MAX_LENGTH} characters`;
  }
  
  if (!PROFILE_NAME_REGEX.test(name)) {
    if (name.startsWith('-') || name.endsWith('-')) {
      return 'Profile name cannot start or end with a dash';
    }
    return 'Profile name can only contain letters, numbers, and dashes';
  }
  
  const lowerName = name.toLowerCase();
  if (BANNED_PROFILE_NAMES.some(banned => banned === lowerName)) {
    return 'This profile name is not available';
  }
  
  return 'Profile name is valid';
}