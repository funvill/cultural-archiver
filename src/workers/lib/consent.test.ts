/**
 * Unit tests for consent collection and validation utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerEnv } from '../types';
import {
  validateConsent,
  createConsentData,
  storeConsentData,
  getConsentData,
  hasValidConsent,
  needsReConsent,
  generateConsentFormData,
  validateConsentFromRequest,
  createConsentAuditLog,
  CURRENT_CONSENT_VERSION,
  REQUIRED_CONSENTS,
  FREEDOM_OF_PANORAMA_RESOURCES,
  type ConsentData
} from '../lib/consent';

// Mock WorkerEnv for testing
const mockEnv: Partial<WorkerEnv> = {
  SESSIONS: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn()
  } as unknown as WorkerEnv['SESSIONS']
};

describe('Consent Validation', () => {
  it('should validate complete consent data', () => {
    const validConsent: Partial<ConsentData> = {
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true,
      consentVersion: CURRENT_CONSENT_VERSION,
      consentedAt: new Date().toISOString()
    };

    const result = validateConsent(validConsent);

    expect(result.isValid).toBe(true);
    expect(result.missingConsents).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should identify missing consent fields', () => {
    const incompleteConsent: Partial<ConsentData> = {
      ageVerification: true,
      cc0Licensing: false,
      // Missing publicCommons and freedomOfPanorama
    };

    const result = validateConsent(incompleteConsent);

    expect(result.isValid).toBe(false);
    expect(result.missingConsents).toContain('cc0Licensing');
    expect(result.missingConsents).toContain('publicCommons');
    expect(result.missingConsents).toContain('freedomOfPanorama');
    expect(result.errors).toContain('CC0 public domain dedication consent is required');
  });

  it('should validate age verification requirement', () => {
    const consentWithoutAge: Partial<ConsentData> = {
      ageVerification: false,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true
    };

    const result = validateConsent(consentWithoutAge);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Age verification (18+) is required for photo submissions');
  });

  it('should detect outdated consent version', () => {
    const outdatedConsent: Partial<ConsentData> = {
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true,
      consentVersion: '0.9.0' // Outdated version
    };

    const result = validateConsent(outdatedConsent);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(error => error.includes('outdated'))).toBe(true);
  });

  it('should validate consent timestamp format', () => {
    const invalidTimestamp: Partial<ConsentData> = {
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true,
      consentedAt: 'invalid-date'
    };

    const result = validateConsent(invalidTimestamp);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid consent timestamp format');
  });
});

describe('Consent Data Creation', () => {
  it('should create complete consent data structure', () => {
    const userToken = 'test-user-123';
    const consents = {
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true
    };

    const consentData = createConsentData(userToken, consents);

    expect(consentData.userToken).toBe(userToken);
    expect(consentData.ageVerification).toBe(true);
    expect(consentData.cc0Licensing).toBe(true);
    expect(consentData.publicCommons).toBe(true);
    expect(consentData.freedomOfPanorama).toBe(true);
    expect(consentData.consentVersion).toBe(CURRENT_CONSENT_VERSION);
    expect(consentData.consentedAt).toBeDefined();
    
    // Validate timestamp format
    const timestamp = new Date(consentData.consentedAt);
    expect(timestamp.getTime()).not.toBeNaN();
  });
});

describe('Consent Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should store consent data in KV', async () => {
    const putSpy = vi.spyOn(mockEnv.SESSIONS!, 'put').mockResolvedValue();
    
    const consentData: ConsentData = {
      userToken: 'test-user-456',
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true,
      consentVersion: CURRENT_CONSENT_VERSION,
      consentedAt: new Date().toISOString()
    };

    await storeConsentData(mockEnv as WorkerEnv, consentData);

    expect(putSpy).toHaveBeenCalledWith(
      `consent:${consentData.userToken}:${consentData.consentVersion}`,
      expect.stringContaining(consentData.userToken),
      { expirationTtl: 365 * 24 * 60 * 60 }
    );
  });

  it('should handle storage errors', async () => {
    vi.spyOn(mockEnv.SESSIONS!, 'put').mockRejectedValue(new Error('KV error'));
    
    const consentData: ConsentData = {
      userToken: 'test-user-789',
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true,
      consentVersion: CURRENT_CONSENT_VERSION,
      consentedAt: new Date().toISOString()
    };

    await expect(storeConsentData(mockEnv as WorkerEnv, consentData))
      .rejects.toThrow('Failed to store consent data');
  });
});

describe('Consent Retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve consent data from KV', async () => {
    const consentData: ConsentData = {
      userToken: 'test-user-retrieval',
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true,
      consentVersion: CURRENT_CONSENT_VERSION,
      consentedAt: new Date().toISOString()
    };

    const storedData = JSON.stringify({
      ...consentData,
      storedAt: new Date().toISOString()
    });

    vi.spyOn(mockEnv.SESSIONS!, 'get').mockResolvedValue(storedData as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const result = await getConsentData(mockEnv as WorkerEnv, consentData.userToken);

    expect(result).not.toBeNull();
    expect(result!.userToken).toBe(consentData.userToken);
    expect(result!.ageVerification).toBe(true);
    expect(result).not.toHaveProperty('storedAt'); // Should be stripped
  });

  it('should return null for non-existent consent', async () => {
    vi.spyOn(mockEnv.SESSIONS!, 'get').mockResolvedValue(null as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const result = await getConsentData(mockEnv as WorkerEnv, 'non-existent-user');

    expect(result).toBeNull();
  });

  it('should handle retrieval errors gracefully', async () => {
    vi.spyOn(mockEnv.SESSIONS!, 'get').mockRejectedValue(new Error('KV error'));

    const result = await getConsentData(mockEnv as WorkerEnv, 'error-user');

    expect(result).toBeNull();
  });
});

describe('Consent Validation Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should confirm valid consent exists', async () => {
    const validConsentData: ConsentData = {
      userToken: 'valid-user',
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true,
      consentVersion: CURRENT_CONSENT_VERSION,
      consentedAt: new Date().toISOString()
    };

    vi.spyOn(mockEnv.SESSIONS!, 'get').mockResolvedValue(JSON.stringify(validConsentData) as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const result = await hasValidConsent(mockEnv as WorkerEnv, 'valid-user');

    expect(result).toBe(true);
  });

  it('should detect missing consent', async () => {
    vi.spyOn(mockEnv.SESSIONS!, 'get').mockResolvedValue(null as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const result = await hasValidConsent(mockEnv as WorkerEnv, 'no-consent-user');

    expect(result).toBe(false);
  });

  it('should detect need for re-consent', async () => {
    const outdatedConsentData = {
      userToken: 'outdated-user',
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true,
      consentVersion: '0.9.0', // Outdated
      consentedAt: new Date().toISOString()
    };

    vi.spyOn(mockEnv.SESSIONS!, 'get').mockResolvedValue(JSON.stringify(outdatedConsentData) as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const result = await needsReConsent(mockEnv as WorkerEnv, 'outdated-user');

    expect(result).toBe(true);
  });
});

describe('Consent Form Data Generation', () => {
  it('should generate complete form data', () => {
    const formData = generateConsentFormData();

    expect(formData.consentVersion).toBe(CURRENT_CONSENT_VERSION);
    expect(formData.resources).toEqual(FREEDOM_OF_PANORAMA_RESOURCES);
    expect(formData.requiredConsents).toEqual(REQUIRED_CONSENTS);
    expect(formData.consentDescriptions).toHaveProperty('ageVerification');
    expect(formData.consentDescriptions).toHaveProperty('cc0Licensing');
    expect(formData.consentDescriptions).toHaveProperty('publicCommons');
    expect(formData.consentDescriptions).toHaveProperty('freedomOfPanorama');
  });
});

describe('Request Validation', () => {
  it('should validate consent from request data', () => {
    const requestData = {
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true,
      consentVersion: CURRENT_CONSENT_VERSION
    };

    const result = validateConsentFromRequest(requestData);

    expect(result.isValid).toBe(true);
    expect(result.missingConsents).toHaveLength(0);
  });

  it('should handle invalid request data', () => {
    const requestData = {
      ageVerification: false,
      cc0Licensing: 'invalid', // Should be boolean
      // Missing other required fields
    };

    const result = validateConsentFromRequest(requestData);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Audit Logging', () => {
  it('should create consent audit log entry', () => {
    const userToken = 'audit-user';
    const consentData: ConsentData = {
      userToken,
      ageVerification: true,
      cc0Licensing: true,
      publicCommons: true,
      freedomOfPanorama: true,
      consentVersion: CURRENT_CONSENT_VERSION,
      consentedAt: new Date().toISOString()
    };

    const auditLog = createConsentAuditLog(userToken, consentData, 'granted');

    expect(auditLog.action).toBe('consent_granted');
    expect(auditLog.userToken).toBe(userToken);
    expect(auditLog.consentVersion).toBe(CURRENT_CONSENT_VERSION);
    expect(auditLog.timestamp).toBeDefined();
    expect(auditLog.details).toHaveProperty('ageVerification');
    expect(auditLog.details).toHaveProperty('cc0Licensing');
    expect(auditLog.details).toHaveProperty('publicCommons');
    expect(auditLog.details).toHaveProperty('freedomOfPanorama');
  });
});