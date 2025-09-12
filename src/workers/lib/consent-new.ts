/**
 * Centralized consent management library for Cultural Archiver
 * 
 * Provides database-based consent tracking for all user-submitted content
 * with proper legal compliance audit trail and support for both 
 * authenticated users and anonymous submissions.
 */

import type { 
  WorkerEnv
} from '../types';
import type {
  ConsentRecord,
  RecordConsentParams,
  RecordConsentResponse,
  ContentType
} from '../../shared/types';
import type { D1Database } from '@cloudflare/workers-types';
import { ApiError } from './errors';

/**
 * Mass import reserved UUID for system-generated content
 */
export const MASS_IMPORT_USER_UUID = '00000000-0000-0000-0000-000000000002';

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
 * Record consent for specific content before content creation
 * 
 * This is the core function for the consent-first pattern.
 * Creates a consent record in the database that must exist
 * before any content (artwork/logbook) can be created.
 */
export async function recordConsent(params: RecordConsentParams): Promise<RecordConsentResponse> {
  const {
    userId,
    anonymousToken,
    contentType,
    contentId,
    consentVersion,
    ipAddress,
    consentTextHash,
    db
  } = params;

  // Validate that exactly one of userId or anonymousToken is provided
  if (!userId && !anonymousToken) {
    throw new ApiError('Either userId or anonymousToken must be provided', 'CONSENT_INVALID_IDENTITY', 400);
  }

  if (userId && anonymousToken) {
    throw new ApiError('Cannot provide both userId and anonymousToken', 'CONSENT_INVALID_IDENTITY', 400);
  }

  // Validate content type
  if (!['artwork', 'logbook'].includes(contentType)) {
    throw new ApiError(`Invalid content type: ${contentType}`, 'CONSENT_INVALID_CONTENT_TYPE', 400);
  }

  // Validate required fields
  if (!contentId || !consentVersion || !ipAddress || !consentTextHash) {
    throw new ApiError('Missing required consent fields', 'CONSENT_MISSING_FIELDS', 400);
  }

  const consentId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    // Insert consent record into database
    // Note: consentTextHash is already a SHA-256 hash from generateConsentTextHash()
    const insertQuery = `
      INSERT INTO consent (
        id, created_at, user_id, anonymous_token, 
        consent_version, content_type, content_id,
        ip_address, consent_text_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(insertQuery)
      .bind(
        consentId,
        now,
        userId || null,
        anonymousToken || null,
        consentVersion,
        contentType,
        contentId,
        ipAddress,
        consentTextHash // Use the already-hashed value directly
      )
      .run();

    console.info('Consent recorded successfully:', {
      consentId,
      userId: userId || 'anonymous',
      anonymousToken: anonymousToken || 'authenticated',
      contentType,
      contentId,
      consentVersion,
      timestamp: now,
    });

    return { id: consentId };

  } catch (error: any) {
    // Handle unique constraint violations gracefully
    if (error.message?.includes('UNIQUE constraint failed')) {
      console.warn('Consent already exists for this content:', {
        userId: userId || 'anonymous',
        anonymousToken: anonymousToken || 'authenticated',
        contentType,
        contentId,
        consentVersion,
      });
      
      // Return existing consent ID instead of failing
      const existingConsent = await getConsentRecord(db, {
        ...(userId && { userId }),
        ...(anonymousToken && { anonymousToken }),
        contentType,
        contentId,
        consentVersion,
      });
      
      if (existingConsent) {
        return { id: existingConsent.id };
      }
    }

    console.error('Failed to record consent:', error);
    throw new ApiError('Failed to record consent', 'CONSENT_RECORD_FAILED', 500);
  }
}

/**
 * Check if consent exists for specific content
 */
export async function hasConsentForContent(
  db: D1Database,
  params: {
    userId?: string;
    anonymousToken?: string;
    contentType: ContentType;
    contentId: string;
  }
): Promise<boolean> {
  try {
    const consent = await getConsentRecord(db, params);
    return consent !== null;
  } catch (error) {
    console.warn('Failed to check consent for content:', error);
    return false;
  }
}

/**
 * Get consent record for specific content
 */
export async function getConsentRecord(
  db: D1Database,
  params: {
    userId?: string;
    anonymousToken?: string;
    contentType: ContentType;
    contentId: string;
    consentVersion?: string;
  }
): Promise<ConsentRecord | null> {
  const { userId, anonymousToken, contentType, contentId, consentVersion } = params;

  try {
    let query = `
      SELECT * FROM consent 
      WHERE content_type = ? AND content_id = ?
    `;
    const bindings: any[] = [contentType, contentId];

    // Add user/token filter
    if (userId) {
      query += ' AND user_id = ?';
      bindings.push(userId);
    } else if (anonymousToken) {
      query += ' AND anonymous_token = ?';
      bindings.push(anonymousToken);
    }

    // Add version filter if specified
    if (consentVersion) {
      query += ' AND consent_version = ?';
      bindings.push(consentVersion);
    }

    query += ' ORDER BY created_at DESC LIMIT 1';

    const result = await db.prepare(query).bind(...bindings).first();
    return result ? (result as unknown as ConsentRecord) : null;

  } catch (error) {
    console.warn('Failed to get consent record:', error);
    return null;
  }
}

/**
 * Generate consent text hash for audit trail using Web Crypto API
 */
export async function generateConsentTextHash(consentText: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(consentText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate consent data structure
 */
export interface ConsentValidationResult {
  isValid: boolean;
  missingConsents: string[];
  errors: string[];
}

export function validateConsent(consentData: any): ConsentValidationResult {
  const errors: string[] = [];
  const missingConsents: string[] = [];

  // Check required consent fields
  for (const consentField of REQUIRED_CONSENTS) {
    if (!consentData[consentField]) {
      missingConsents.push(consentField);
    }
  }

  // Specific validations
  if (!consentData.ageVerification) {
    errors.push('Age verification (18+) is required for submissions');
  }

  if (!consentData.cc0Licensing) {
    errors.push('CC0 public domain dedication consent is required');
  }

  if (!consentData.publicCommons) {
    errors.push('Public commons acknowledgment is required');
  }

  if (!consentData.freedomOfPanorama) {
    errors.push('Freedom of Panorama legal guidance acknowledgment is required');
  }

  return {
    isValid: missingConsents.length === 0 && errors.length === 0,
    missingConsents,
    errors,
  };
}

/**
 * Create complete consent data structure (legacy compatibility)
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
 * Generate consent form data for frontend
 */
export function generateConsentFormData(): {
  consentVersion: string;
  requiredConsents: typeof REQUIRED_CONSENTS;
  consentDescriptions: Record<string, string>;
} {
  return {
    consentVersion: CURRENT_CONSENT_VERSION,
    requiredConsents: REQUIRED_CONSENTS,
    consentDescriptions: {
      ageVerification: 'I confirm that I am 18 years of age or older',
      cc0Licensing: 'I dedicate my submissions to the public domain under CC0 (no rights reserved)',
      publicCommons: 'I understand that my submissions will be publicly accessible and may be used by others',
      freedomOfPanorama: 'I acknowledge that I have reviewed Canadian copyright law regarding public art photography',
    },
  };
}

/**
 * Legacy functions for backward compatibility during migration
 */

export function validateConsentFromRequest(requestData: Record<string, unknown>): ConsentValidationResult {
  const consentData = {
    ageVerification: Boolean(requestData.ageVerification),
    cc0Licensing: Boolean(requestData.cc0Licensing),
    publicCommons: Boolean(requestData.publicCommons),
    freedomOfPanorama: Boolean(requestData.freedomOfPanorama),
  };

  return validateConsent(consentData);
}

export async function storeConsentData(env: WorkerEnv, consentData: ConsentData): Promise<void> {
  // Legacy KV storage - this will be phased out
  try {
    const key = `consent:${consentData.userToken}:${consentData.consentVersion}`;
    const value = JSON.stringify({
      ...consentData,
      storedAt: new Date().toISOString(),
    });

    await env.SESSIONS.put(key, value, {
      expirationTtl: 365 * 24 * 60 * 60, // 1 year expiration
    });

    console.info('Legacy consent data stored:', {
      userToken: consentData.userToken,
      version: consentData.consentVersion,
    });
  } catch (error) {
    console.error('Failed to store legacy consent data:', error);
    throw new ApiError('Failed to store consent data', 'CONSENT_STORAGE_ERROR', 500);
  }
}

export async function getConsentData(env: WorkerEnv, userToken: string): Promise<ConsentData | null> {
  // Legacy KV retrieval - this will be phased out
  try {
    const key = `consent:${userToken}:${CURRENT_CONSENT_VERSION}`;
    const stored = await env.SESSIONS.get(key);
    if (!stored) {
      return null;
    }

    const consentData = JSON.parse(stored) as ConsentData & { storedAt: string };
    const { storedAt, ...cleanConsentData } = consentData;
    return cleanConsentData;
  } catch (error) {
    console.warn('Failed to retrieve legacy consent data:', error);
    return null;
  }
}

export async function hasValidConsent(env: WorkerEnv, userToken: string): Promise<boolean> {
  // Legacy validation - this will be phased out
  try {
    const consentData = await getConsentData(env, userToken);
    if (!consentData) {
      return false;
    }
    const validation = validateConsent(consentData);
    return validation.isValid;
  } catch (error) {
    console.warn('Failed to check legacy consent validity:', error);
    return false;
  }
}

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