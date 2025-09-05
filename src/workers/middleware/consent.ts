/**
 * Consent validation middleware for Cultural Archiver
 *
 * This middleware ensures that users have provided the required consent
 * before allowing photo submissions or other actions that require consent.
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { ApiError } from '../lib/errors';
import {
  validateConsent,
  getConsentData,
  CURRENT_CONSENT_VERSION,
  type ConsentData,
} from '../lib/consent';

/**
 * Middleware options for consent validation
 */
export interface ConsentMiddlewareOptions {
  /** Whether to require consent for the endpoint */
  requireConsent?: boolean;
  /** Specific consent fields required */
  requiredFields?: string[];
  /** Whether to check for current consent version */
  checkVersion?: boolean;
}

/**
 * Default middleware options
 */
const DEFAULT_OPTIONS: ConsentMiddlewareOptions = {
  requireConsent: true,
  requiredFields: ['ageVerification', 'cc0Licensing', 'publicCommons', 'freedomOfPanorama'],
  checkVersion: true,
};

/**
 * Consent validation middleware
 *
 * This middleware validates that the user has provided the required consent
 * for the requested action. It checks both the presence and validity of
 * consent data, and ensures it matches the current consent version.
 */
export function consentMiddleware(
  options: ConsentMiddlewareOptions = {}
): (c: Context<{ Bindings: WorkerEnv }>, next: () => Promise<void>) => Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (c: Context<{ Bindings: WorkerEnv }>, next: () => Promise<void>) => {
    // Skip consent check if not required
    if (!opts.requireConsent) {
      await next();
      return;
    }

    // Get user token from context (should be set by auth middleware)
    const userToken = c.get('userToken') as string;
    if (!userToken) {
      throw new ApiError('AUTH_REQUIRED', 'User token is required for consent validation', 401);
    }

    try {
      // Retrieve existing consent data
      const consentData = await getConsentData(c.env, userToken);

      if (!consentData) {
        throw new ApiError('CONSENT_REQUIRED', 'Consent is required before proceeding', 428, {
          details: {
            message: 'You must provide consent before submitting photos',
            requiredFields: opts.requiredFields,
            consentVersion: CURRENT_CONSENT_VERSION,
          },
        });
      }

      // Validate consent data
      const validation = validateConsent(consentData);

      if (!validation.isValid) {
        throw new ApiError('CONSENT_INVALID', 'Invalid or incomplete consent', 428, {
          details: {
            message: 'Your consent is incomplete or invalid',
            missingConsents: validation.missingConsents,
            errors: validation.errors,
            consentVersion: CURRENT_CONSENT_VERSION,
          },
        });
      }

      // Check consent version if required
      if (opts.checkVersion && consentData.consentVersion !== CURRENT_CONSENT_VERSION) {
        throw new ApiError('CONSENT_OUTDATED', 'Consent version is outdated', 428, {
          details: {
            message: 'Our terms have been updated. Please review and provide consent again.',
            currentVersion: consentData.consentVersion,
            requiredVersion: CURRENT_CONSENT_VERSION,
            consentedAt: consentData.consentedAt,
          },
        });
      }

      // Store consent data in context for use by handlers
      // Note: Context type needs to be extended to support consentData
      // c.set('consentData', consentData);

      console.info('Consent validation successful', {
        userToken,
        consentVersion: consentData.consentVersion,
        consentedAt: consentData.consentedAt,
      });

      await next();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      console.error('Consent validation failed:', error);
      throw new ApiError('CONSENT_VALIDATION_ERROR', 'Consent validation failed', 500, {
        details: {
          message: 'Unable to validate consent at this time',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  };
}

/**
 * Middleware that requires age verification consent
 */
export function requireAgeVerification(): (
  c: Context<{ Bindings: WorkerEnv }>,
  next: () => Promise<void>
) => Promise<void> {
  return consentMiddleware({
    requireConsent: true,
    requiredFields: ['ageVerification'],
    checkVersion: true,
  });
}

/**
 * Middleware that requires CC0 licensing consent
 */
export function requireCC0Consent(): (
  c: Context<{ Bindings: WorkerEnv }>,
  next: () => Promise<void>
) => Promise<void> {
  return consentMiddleware({
    requireConsent: true,
    requiredFields: ['cc0Licensing'],
    checkVersion: true,
  });
}

/**
 * Middleware that requires public commons consent
 */
export function requirePublicCommonsConsent(): (
  c: Context<{ Bindings: WorkerEnv }>,
  next: () => Promise<void>
) => Promise<void> {
  return consentMiddleware({
    requireConsent: true,
    requiredFields: ['publicCommons'],
    checkVersion: true,
  });
}

/**
 * Middleware that requires Freedom of Panorama acknowledgment
 */
export function requireFreedomOfPanoramaConsent(): (
  c: Context<{ Bindings: WorkerEnv }>,
  next: () => Promise<void>
) => Promise<void> {
  return consentMiddleware({
    requireConsent: true,
    requiredFields: ['freedomOfPanorama'],
    checkVersion: true,
  });
}

/**
 * Middleware that requires all submission consents
 *
 * This is the standard middleware for photo submission endpoints
 * that require comprehensive consent.
 */
export function requireSubmissionConsent(): (
  c: Context<{ Bindings: WorkerEnv }>,
  next: () => Promise<void>
) => Promise<void> {
  return consentMiddleware({
    requireConsent: true,
    requiredFields: ['ageVerification', 'cc0Licensing', 'publicCommons', 'freedomOfPanorama'],
    checkVersion: true,
  });
}

/**
 * Middleware that checks consent but doesn't require it
 *
 * Useful for endpoints that want to know consent status
 * but don't strictly require it.
 */
export function checkConsentOptional(): (
  c: Context<{ Bindings: WorkerEnv }>,
  next: () => Promise<void>
) => Promise<void> {
  return consentMiddleware({
    requireConsent: false,
    checkVersion: false,
  });
}

/**
 * Utility function to extract consent information from request
 *
 * This can be used in handlers to get consent data that was
 * validated by the middleware.
 */
export function getConsentFromContext(c: Context): ConsentData | null {
  return c.get('consentData') as ConsentData | null;
}

/**
 * Utility function to check if user has specific consent
 */
export function hasConsent(c: Context, consentType: string): boolean {
  const consentData = getConsentFromContext(c);
  if (!consentData) return false;

  return (consentData as unknown as Record<string, boolean>)[consentType] === true;
}

/**
 * Utility function to get consent status summary
 */
export function getConsentStatus(c: Context): {
  hasConsent: boolean;
  version: string | null;
  consentedAt: string | null;
  missing: string[];
  isCurrentVersion?: boolean;
} {
  const consentData = getConsentFromContext(c);
  if (!consentData) {
    return {
      hasConsent: false,
      version: null,
      consentedAt: null,
      missing: ['ageVerification', 'cc0Licensing', 'publicCommons', 'freedomOfPanorama'],
    };
  }

  const missing = [];
  if (!consentData.ageVerification) missing.push('ageVerification');
  if (!consentData.cc0Licensing) missing.push('cc0Licensing');
  if (!consentData.publicCommons) missing.push('publicCommons');
  if (!consentData.freedomOfPanorama) missing.push('freedomOfPanorama');

  return {
    hasConsent: missing.length === 0,
    version: consentData.consentVersion,
    consentedAt: consentData.consentedAt,
    missing,
    isCurrentVersion: consentData.consentVersion === CURRENT_CONSENT_VERSION,
  };
}
