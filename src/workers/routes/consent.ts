/**
 * Consent management route handlers for Cultural Archiver
 *
 * Handles consent collection, storage, and retrieval operations
 * required for the user consent workflow.
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { ApiError } from '../lib/errors';
import {
  validateConsentFromRequest,
  createConsentData,
  storeConsentData,
  getConsentData,
  hasValidConsent,
  generateConsentFormData,
  createConsentAuditLog,
  CURRENT_CONSENT_VERSION,
} from '../lib/consent';

/**
 * POST /api/consent
 * Submit user consent data
 */
export async function submitConsent(
  c: Context<{ Bindings: WorkerEnv; Variables: { userToken: string } }>
): Promise<Response> {
  try {
    const userToken = c.get('userToken');
    if (!userToken) {
      throw new ApiError('User token is required', 'AUTH_REQUIRED', 401);
    }

    // Parse request body
    const requestData = await c.req.json();

    // Validate consent data from request
    const validation = validateConsentFromRequest(requestData);
    if (!validation.isValid) {
      throw new ApiError('Invalid consent data', 'CONSENT_INVALID', 400, {
        details: {
          message: 'Your consent is incomplete or invalid',
          missingConsents: validation.missingConsents,
          errors: validation.errors,
          consentVersion: CURRENT_CONSENT_VERSION,
        },
      });
    }

    // Create consent data structure
    const consentData = createConsentData(userToken, {
      ageVerification: Boolean(requestData.ageVerification),
      cc0Licensing: Boolean(requestData.cc0Licensing),
      publicCommons: Boolean(requestData.publicCommons),
      freedomOfPanorama: Boolean(requestData.freedomOfPanorama),
    });

    // Store consent data
    await storeConsentData(c.env, consentData);

    // Create audit log entry
    const auditLog = createConsentAuditLog(userToken, consentData, 'granted');
    console.info('Consent granted:', auditLog);

    return c.json(
      {
        message: 'Consent submitted successfully',
        consentVersion: consentData.consentVersion,
        consentedAt: consentData.consentedAt,
        userToken: userToken,
      },
      201
    );
  } catch (error) {
    console.error('Consent submission error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to submit consent', 'CONSENT_SUBMISSION_ERROR', 500);
  }
}

/**
 * GET /api/consent
 * Get current user consent status
 */
export async function getConsentStatus(
  c: Context<{ Bindings: WorkerEnv; Variables: { userToken: string } }>
): Promise<Response> {
  try {
    const userToken = c.get('userToken');
    if (!userToken) {
      throw new ApiError('User token is required', 'AUTH_REQUIRED', 401);
    }

    // Get consent data from storage
    const consentData = await getConsentData(c.env, userToken);

    if (!consentData) {
      return c.json({
        hasConsent: false,
        consentVersion: null,
        consentedAt: null,
        requiresConsent: true,
        currentVersion: CURRENT_CONSENT_VERSION,
        formData: generateConsentFormData(),
      });
    }

    // Check if consent is valid
    const isValid = await hasValidConsent(c.env, userToken);
    const needsUpdate = consentData.consentVersion !== CURRENT_CONSENT_VERSION;

    return c.json({
      hasConsent: isValid && !needsUpdate,
      consentVersion: consentData.consentVersion,
      consentedAt: consentData.consentedAt,
      requiresConsent: !isValid || needsUpdate,
      currentVersion: CURRENT_CONSENT_VERSION,
      isCurrentVersion: !needsUpdate,
      ...((!isValid || needsUpdate) && { formData: generateConsentFormData() }),
    });
  } catch (error) {
    console.error('Consent status check error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to check consent status', 'CONSENT_STATUS_ERROR', 500);
  }
}

/**
 * GET /api/consent/form-data
 * Get consent form configuration data
 */
export async function getConsentFormData(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  try {
    const formData = generateConsentFormData();

    return c.json({
      ...formData,
      endpoint: '/api/consent',
      method: 'POST',
    });
  } catch (error) {
    console.error('Consent form data error:', error);

    throw new ApiError('Failed to get consent form data', 'CONSENT_FORM_DATA_ERROR', 500);
  }
}

/**
 * DELETE /api/consent
 * Revoke user consent (for compliance purposes)
 */
export async function revokeConsent(
  c: Context<{ Bindings: WorkerEnv; Variables: { userToken: string } }>
): Promise<Response> {
  try {
    const userToken = c.get('userToken');
    if (!userToken) {
      throw new ApiError('User token is required', 'AUTH_REQUIRED', 401);
    }

    // Get existing consent data for audit log
    const existingConsentData = await getConsentData(c.env, userToken);

    if (existingConsentData) {
      // Create audit log entry
      const auditLog = createConsentAuditLog(userToken, existingConsentData, 'revoked');
      console.info('Consent revoked:', auditLog);
    }

    // Remove consent from storage
    const key = `consent:${userToken}:${CURRENT_CONSENT_VERSION}`;
    await c.env.SESSIONS.delete(key);

    return c.json({
      message: 'Consent revoked successfully',
      revokedAt: new Date().toISOString(),
      userToken: userToken,
    });
  } catch (error) {
    console.error('Consent revocation error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to revoke consent', 'CONSENT_REVOCATION_ERROR', 500);
  }
}
