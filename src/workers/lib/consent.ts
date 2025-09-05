/**
 * Consent collection and validation utilities for the Cultural Archiver system
 *
 * This module provides utilities for collecting and managing user consent
 * for photo submissions, including age verification, CC0 licensing,
 * and public commons acknowledgment as required by the PRD.
 */

import type { WorkerEnv } from '../types';
import { ApiError } from './errors';

/**
 * Consent data structure
 */
export interface ConsentData {
  ageVerification: boolean;
  cc0Licensing: boolean;
  publicCommons: boolean;
  freedomOfPanorama: boolean;
  consentVersion: string;
  consentedAt: string;
  userToken: string;
}

/**
 * Consent validation result
 */
export interface ConsentValidationResult {
  isValid: boolean;
  missingConsents: string[];
  errors: string[];
}

/**
 * Current consent version - update when legal terms change
 */
export const CURRENT_CONSENT_VERSION = '1.0.0';

/**
 * Required consent fields for valid submission
 */
export const REQUIRED_CONSENTS = [
  'ageVerification',
  'cc0Licensing',
  'publicCommons',
  'freedomOfPanorama',
] as const;

/**
 * Canadian Freedom of Panorama guidance URLs
 */
export const FREEDOM_OF_PANORAMA_RESOURCES = {
  canadianCopyright: 'https://laws-lois.justice.gc.ca/eng/acts/C-42/index.html',
  publicArtGuidance: 'https://www.ic.gc.ca/eic/site/cipointernet-internetopic.nsf/eng/wr03719.html',
  creativeCommons: 'https://creativecommons.org/publicdomain/zero/1.0/',
};

/**
 * Validate user consent data
 */
export function validateConsent(consentData: Partial<ConsentData>): ConsentValidationResult {
  const errors: string[] = [];
  const missingConsents: string[] = [];

  // Check required consent fields
  for (const consentField of REQUIRED_CONSENTS) {
    if (!consentData[consentField]) {
      missingConsents.push(consentField);
    }
  }

  // Validate age verification specifically
  if (!consentData.ageVerification) {
    errors.push('Age verification (18+) is required for photo submissions');
  }

  // Validate CC0 licensing consent
  if (!consentData.cc0Licensing) {
    errors.push('CC0 public domain dedication consent is required');
  }

  // Validate public commons consent
  if (!consentData.publicCommons) {
    errors.push('Public commons acknowledgment is required');
  }

  // Validate Freedom of Panorama acknowledgment
  if (!consentData.freedomOfPanorama) {
    errors.push('Freedom of Panorama legal guidance acknowledgment is required');
  }

  // Validate consent version
  if (consentData.consentVersion && consentData.consentVersion !== CURRENT_CONSENT_VERSION) {
    errors.push(
      `Consent version ${consentData.consentVersion} is outdated. Current version: ${CURRENT_CONSENT_VERSION}`
    );
  }

  // Validate timestamp format
  if (consentData.consentedAt) {
    try {
      const timestamp = new Date(consentData.consentedAt);
      if (isNaN(timestamp.getTime())) {
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
  };
}

/**
 * Create complete consent data structure
 */
export function createConsentData(
  userToken: string,
  consents: {
    ageVerification: boolean;
    cc0Licensing: boolean;
    publicCommons: boolean;
    freedomOfPanorama: boolean;
  }
): ConsentData {
  return {
    ...consents,
    consentVersion: CURRENT_CONSENT_VERSION,
    consentedAt: new Date().toISOString(),
    userToken,
  };
}

/**
 * Store consent data in KV storage
 */
export async function storeConsentData(env: WorkerEnv, consentData: ConsentData): Promise<void> {
  try {
    const key = `consent:${consentData.userToken}:${consentData.consentVersion}`;
    const value = JSON.stringify({
      ...consentData,
      storedAt: new Date().toISOString(),
    });

    // Store in SESSIONS KV (reusing existing namespace for simplicity)
    await env.SESSIONS.put(key, value, {
      expirationTtl: 365 * 24 * 60 * 60, // 1 year expiration
    });

    console.info('Consent data stored successfully:', {
      userToken: consentData.userToken,
      version: consentData.consentVersion,
      consentedAt: consentData.consentedAt,
    });
  } catch (error) {
    console.error('Failed to store consent data:', error);
    throw new ApiError('Failed to store consent data', 'CONSENT_STORAGE_ERROR', 500);
  }
}

/**
 * Retrieve consent data from KV storage
 */
export async function getConsentData(
  env: WorkerEnv,
  userToken: string,
  version?: string
): Promise<ConsentData | null> {
  try {
    const consentVersion = version || CURRENT_CONSENT_VERSION;
    const key = `consent:${userToken}:${consentVersion}`;

    const stored = await env.SESSIONS.get(key);
    if (!stored) {
      return null;
    }

    const consentData = JSON.parse(stored) as ConsentData & { storedAt: string };

    // Remove storage metadata before returning
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { storedAt, ...cleanConsentData } = consentData;

    return cleanConsentData;
  } catch (error) {
    console.warn('Failed to retrieve consent data:', error);
    return null;
  }
}

/**
 * Check if user has valid consent for current version
 */
export async function hasValidConsent(env: WorkerEnv, userToken: string): Promise<boolean> {
  try {
    const consentData = await getConsentData(env, userToken);
    if (!consentData) {
      return false;
    }

    const validation = validateConsent(consentData);
    return validation.isValid;
  } catch (error) {
    console.warn('Failed to check consent validity:', error);
    return false;
  }
}

/**
 * Check if user needs to re-consent due to version update
 */
export async function needsReConsent(env: WorkerEnv, userToken: string): Promise<boolean> {
  try {
    const consentData = await getConsentData(env, userToken);
    if (!consentData) {
      return true; // No consent at all
    }

    return consentData.consentVersion !== CURRENT_CONSENT_VERSION;
  } catch (error) {
    console.warn('Failed to check re-consent requirement:', error);
    return true; // Err on the side of requiring consent
  }
}

/**
 * Generate consent form data for frontend
 */
export function generateConsentFormData(): {
  consentVersion: string;
  resources: typeof FREEDOM_OF_PANORAMA_RESOURCES;
  requiredConsents: typeof REQUIRED_CONSENTS;
  consentDescriptions: Record<string, string>;
} {
  return {
    consentVersion: CURRENT_CONSENT_VERSION,
    resources: FREEDOM_OF_PANORAMA_RESOURCES,
    requiredConsents: REQUIRED_CONSENTS,
    consentDescriptions: {
      ageVerification: 'I confirm that I am 18 years of age or older',
      cc0Licensing:
        'I dedicate my photo submissions to the public domain under CC0 (no rights reserved)',
      publicCommons:
        'I understand that my submissions will be publicly accessible and may be used by others',
      freedomOfPanorama:
        'I acknowledge that I have reviewed Canadian copyright law regarding public art photography',
    },
  };
}

/**
 * Validate consent middleware data from request
 */
export function validateConsentFromRequest(
  requestData: Record<string, unknown>
): ConsentValidationResult {
  // Extract consent fields from request
  const consentData: Partial<ConsentData> = {
    ageVerification: Boolean(requestData.ageVerification),
    cc0Licensing: Boolean(requestData.cc0Licensing),
    publicCommons: Boolean(requestData.publicCommons),
    freedomOfPanorama: Boolean(requestData.freedomOfPanorama),
    ...(typeof requestData.consentVersion === 'string' && {
      consentVersion: requestData.consentVersion,
    }),
  };

  return validateConsent(consentData);
}

/**
 * Create audit log entry for consent collection
 */
export function createConsentAuditLog(
  userToken: string,
  consentData: ConsentData,
  action: 'granted' | 'revoked' | 'updated'
): Record<string, unknown> {
  return {
    action: `consent_${action}`,
    userToken,
    consentVersion: consentData.consentVersion,
    timestamp: new Date().toISOString(),
    details: {
      ageVerification: consentData.ageVerification,
      cc0Licensing: consentData.cc0Licensing,
      publicCommons: consentData.publicCommons,
      freedomOfPanorama: consentData.freedomOfPanorama,
      originalConsentDate: consentData.consentedAt,
    },
  };
}
