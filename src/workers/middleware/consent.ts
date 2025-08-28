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
  validateConsentData, 
  isConsentRequired, 
  getConsentData,
  CURRENT_CONSENT_VERSION,
  type ConsentData 
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
  checkVersion: true
};

/**
 * Consent validation middleware
 * 
 * This middleware validates that the user has provided the required consent
 * for the requested action. It checks both the presence and validity of
 * consent data, and ensures it matches the current consent version.
 */
export function consentMiddleware(options: ConsentMiddlewareOptions = {}) {
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
      throw new ApiError('User token is required for consent validation', 401);
    }

    try {
      // Check if consent is required for this user
      if (!await isConsentRequired(c.env, userToken)) {
        await next();
        return;
      }

      // Retrieve existing consent data
      const consentData = await getConsentData(c.env, userToken);
      
      if (!consentData) {
        throw new ApiError('Consent is required before proceeding', 428, {
          code: 'CONSENT_REQUIRED',
          details: {
            message: 'You must provide consent before submitting photos',
            requiredFields: opts.requiredFields,
            consentVersion: CURRENT_CONSENT_VERSION
          }
        });
      }

      // Validate consent data
      const validation = await validateConsentData(consentData, {
        requiredFields: opts.requiredFields
      });

      if (!validation.isValid) {
        throw new ApiError('Invalid or incomplete consent', 428, {
          code: 'CONSENT_INVALID',
          details: {
            message: 'Your consent is incomplete or invalid',
            missingConsents: validation.missingConsents,
            errors: validation.errors,
            consentVersion: CURRENT_CONSENT_VERSION
          }
        });
      }

      // Check consent version if required
      if (opts.checkVersion && consentData.consentVersion !== CURRENT_CONSENT_VERSION) {
        throw new ApiError('Consent version is outdated', 428, {
          code: 'CONSENT_OUTDATED',
          details: {
            message: 'Our terms have been updated. Please review and provide consent again.',
            currentVersion: consentData.consentVersion,
            requiredVersion: CURRENT_CONSENT_VERSION,
            consentedAt: consentData.consentedAt
          }
        });
      }

      // Store consent data in context for use by handlers
      c.set('consentData', consentData);
      
      console.info('Consent validation successful', {
        userToken,
        consentVersion: consentData.consentVersion,
        consentedAt: consentData.consentedAt
      });

      await next();

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      console.error('Consent validation failed:', error);
      throw new ApiError('Consent validation failed', 500, {
        code: 'CONSENT_VALIDATION_ERROR',
        details: {
          message: 'Unable to validate consent at this time',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  };
}

/**
 * Middleware that requires age verification consent
 */
export function requireAgeVerification() {
  return consentMiddleware({
    requireConsent: true,
    requiredFields: ['ageVerification'],
    checkVersion: true
  });
}

/**
 * Middleware that requires CC0 licensing consent
 */
export function requireCC0Consent() {
  return consentMiddleware({
    requireConsent: true,
    requiredFields: ['cc0Licensing'],
    checkVersion: true
  });
}

/**
 * Middleware that requires public commons consent
 */
export function requirePublicCommonsConsent() {
  return consentMiddleware({
    requireConsent: true,
    requiredFields: ['publicCommons'],
    checkVersion: true
  });
}

/**
 * Middleware that requires Freedom of Panorama acknowledgment
 */
export function requireFreedomOfPanoramaConsent() {
  return consentMiddleware({
    requireConsent: true,
    requiredFields: ['freedomOfPanorama'],
    checkVersion: true
  });
}

/**
 * Middleware that requires all submission consents
 * 
 * This is the standard middleware for photo submission endpoints
 * that require comprehensive consent.
 */
export function requireSubmissionConsent() {
  return consentMiddleware({
    requireConsent: true,
    requiredFields: ['ageVerification', 'cc0Licensing', 'publicCommons', 'freedomOfPanorama'],
    checkVersion: true
  });
}

/**
 * Middleware that checks consent but doesn't require it
 * 
 * Useful for endpoints that want to know consent status
 * but don't strictly require it.
 */
export function checkConsentOptional() {
  return consentMiddleware({
    requireConsent: false,
    checkVersion: false
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
  
  return (consentData as any)[consentType] === true;
}

/**
 * Utility function to get consent status summary
 */
export function getConsentStatus(c: Context) {
  const consentData = getConsentFromContext(c);
  if (!consentData) {
    return {
      hasConsent: false,
      version: null,
      consentedAt: null,
      missing: ['ageVerification', 'cc0Licensing', 'publicCommons', 'freedomOfPanorama']
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
    isCurrentVersion: consentData.consentVersion === CURRENT_CONSENT_VERSION
  };
}