/**
 * Consent version constants and types for the cultural archiver system.
 * Manages consent text versioning and tracking for legal compliance.
 */

// ================================
// Consent Version Constants
// ================================

/**
 * Current consent version - increment when consent text or terms change
 * Format: YYYY-MM-DD.vN (e.g., "2025-09-09.v2")
 */
export const CONSENT_VERSION = '2025-09-09.v2';

/**
 * Minimum consent version required for submissions
 * Used to validate that users have accepted current or compatible terms
 */
export const MINIMUM_CONSENT_VERSION = '2025-09-09.v2';

// ================================
// Consent Types
// ================================

export interface ConsentData {
  ageVerification: boolean;
  cc0Licensing: boolean;
  publicCommons: boolean;
  freedomOfPanorama: boolean;
  consentVersion: string;
  consentedAt: string;
  userToken: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConsentValidationResult {
  isValid: boolean;
  missingConsents: string[];
  errors: string[];
  isVersionCompatible: boolean;
  versionMessage?: string | undefined;
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
// Consent Validation Functions
// ================================

/**
 * Validate that all required consents are provided
 */
export function validateConsent(consentData: Partial<ConsentData>): ConsentValidationResult {
  const missingConsents: string[] = [];
  const errors: string[] = [];

  // Check required consent fields
  if (!consentData.ageVerification) {
    missingConsents.push('Age verification');
  }

  if (!consentData.cc0Licensing) {
    missingConsents.push('CC0 licensing consent');
  }

  if (!consentData.publicCommons) {
    missingConsents.push('Public commons consent');
  }

  if (!consentData.freedomOfPanorama) {
    missingConsents.push('Freedom of panorama acknowledgment');
  }

  // Validate consent version
  const isVersionCompatible = consentData.consentVersion
    ? isConsentVersionCompatible(consentData.consentVersion)
    : false;

  if (!isVersionCompatible && consentData.consentVersion) {
    errors.push(`Consent version ${consentData.consentVersion} is no longer compatible`);
  } else if (!consentData.consentVersion) {
    errors.push('Consent version is required');
  }

  // Validate consent timestamp
  if (!consentData.consentedAt) {
    errors.push('Consent timestamp is required');
  } else {
    try {
      const consentDate = new Date(consentData.consentedAt);
      if (isNaN(consentDate.getTime())) {
        errors.push('Invalid consent timestamp format');
      }
    } catch {
      errors.push('Invalid consent timestamp format');
    }
  }

  return {
    isValid: missingConsents.length === 0 && errors.length === 0,
    missingConsents,
    errors,
    isVersionCompatible,
    versionMessage: !isVersionCompatible
      ? `Current version ${CONSENT_VERSION} required`
      : undefined,
  };
}

/**
 * Check if a consent version is compatible with current requirements
 */
export function isConsentVersionCompatible(version: string): boolean {
  // For now, only exact version match is required
  // In the future, we could implement backward compatibility logic
  return version === CONSENT_VERSION;
}

/**
 * Compare two consent versions
 * Returns: -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
export function compareConsentVersions(version1: string, version2: string): number {
  if (version1 === version2) return 0;

  // Simple string comparison for now (works for YYYY-MM-DD.vN format)
  // In production, might want more sophisticated version parsing
  return version1 < version2 ? -1 : 1;
}

/**
 * Create consent data with current version and timestamp
 */
export function createConsentData(
  userToken: string,
  consents: {
    ageVerification: boolean;
    cc0Licensing: boolean;
    publicCommons: boolean;
    freedomOfPanorama: boolean;
  },
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  }
): ConsentData {
  return {
    ...consents,
    consentVersion: CONSENT_VERSION,
    consentedAt: new Date().toISOString(),
    userToken,
    ...metadata,
  };
}

/**
 * Extract consent summary from consent data for storage/display
 */
export function getConsentSummary(consentData: ConsentData): {
  version: string;
  consentedAt: string;
  allConsentsSigned: boolean;
} {
  return {
    version: consentData.consentVersion,
    consentedAt: consentData.consentedAt,
    allConsentsSigned:
      consentData.ageVerification &&
      consentData.cc0Licensing &&
      consentData.publicCommons &&
      consentData.freedomOfPanorama,
  };
}

/**
 * Check if consent needs renewal based on version compatibility
 */
export function needsConsentRenewal(existingVersion?: string): boolean {
  if (!existingVersion) return true;
  return !isConsentVersionCompatible(existingVersion);
}

// ================================
// Constants for UI Display
// ================================

export const CONSENT_FIELD_LABELS = {
  ageVerification: 'Age Verification (18+)',
  cc0Licensing: 'CC0 Public Domain Dedication',
  publicCommons: 'Public Commons Contribution',
  freedomOfPanorama: 'Freedom of Panorama Acknowledgment',
} as const;

export const CONSENT_FIELD_DESCRIPTIONS = {
  ageVerification:
    'I confirm that I am 18 years of age or older and legally able to provide consent for photo submissions.',
  cc0Licensing:
    'I dedicate my photo submissions to the public domain under CC0 1.0 Universal. This means anyone can use these photos for any purpose without attribution requirements. I understand my content may be shared with third-party platforms like OpenStreetMap and Wikimedia Commons.',
  publicCommons:
    'I understand that my submissions will become part of a public cultural archive and may be used for educational, research, and cultural preservation purposes. I agree that submitted content may be redistributed through third parties and public APIs.',
  freedomOfPanorama:
    "I understand Canada's Freedom of Panorama laws and confirm that my photos are taken from publicly accessible locations where photography is permitted. I have the right to photograph and share these artworks.",
} as const;

export const CONSENT_LINKS = {
  cc0License: 'https://creativecommons.org/publicdomain/zero/1.0/',
  freedomOfPanoramaCanada: 'https://en.wikipedia.org/wiki/Freedom_of_panorama#Canada',
  termsOfService: '/terms',
  privacyPolicy: '/privacy',
} as const;
