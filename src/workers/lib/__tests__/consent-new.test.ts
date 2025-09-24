/**
 * Unit tests for the centralized consent system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { D1Database } from '@cloudflare/workers-types';
import {
  recordConsent,
  hasConsentForContent,
  getConsentRecord,
  generateConsentTextHash,
  validateConsent,
  CURRENT_CONSENT_VERSION,
} from '../consent-new';
import { MASS_IMPORT_USER_UUID } from '../../../shared/constants';

// Mock D1Database
class MockD1Database {
  private data: Record<string, any> = {};
  private lastQuery = '';
  private lastBindings: any[] = [];

  prepare(query: string) {
    this.lastQuery = query;
    return {
      bind: (...bindings: any[]) => {
        this.lastBindings = bindings;
        return {
          run: async () => {
            // Simulate INSERT
            if (query.includes('INSERT INTO consent')) {
              const [id] = bindings;
              this.data[id] = {
                id: bindings[0],
                created_at: bindings[1],
                user_id: bindings[2],
                anonymous_token: bindings[3],
                consent_version: bindings[4],
                content_type: bindings[5],
                content_id: bindings[6],
                ip_address: bindings[7],
                consent_text_hash: bindings[8],
              };
              return { success: true };
            }
            return { success: true };
          },
          first: async () => {
            // Simulate SELECT
            if (query.includes('SELECT * FROM consent')) {
              const contentType = bindings[0];
              const contentId = bindings[1];

              // Find matching record
              const record = Object.values(this.data).find(
                (r: any) => r.content_type === contentType && r.content_id === contentId
              );
              return record || null;
            }
            return null;
          },
        };
      },
    };
  }

  reset() {
    this.data = {};
    this.lastQuery = '';
    this.lastBindings = [];
  }

  getLastQuery() {
    return this.lastQuery;
  }

  getLastBindings() {
    return this.lastBindings;
  }

  getData() {
    return this.data;
  }
}

describe('Centralized Consent System', () => {
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
  });

  describe('recordConsent', () => {
    it('should record consent for authenticated user', async () => {
      const result = await recordConsent({
        userId: 'user-123',
        contentType: 'artwork',
        contentId: 'artwork-456',
        consentVersion: CURRENT_CONSENT_VERSION,
        ipAddress: '192.168.1.1',
        consentTextHash: 'hash123',
        db: mockDb as unknown as D1Database,
      });

      expect(result.id).toBeDefined();

      const data = mockDb.getData();
      const consentRecord = data[result.id];

      expect(consentRecord).toBeDefined();
      expect(consentRecord.user_id).toBe('user-123');
      expect(consentRecord.anonymous_token).toBe(null);
      expect(consentRecord.content_type).toBe('artwork');
      expect(consentRecord.content_id).toBe('artwork-456');
      expect(consentRecord.ip_address).toBe('192.168.1.1');
    });

    it('should record consent for anonymous user', async () => {
      const result = await recordConsent({
        anonymousToken: 'anon-789',
        contentType: 'logbook',
        contentId: 'logbook-123',
        consentVersion: CURRENT_CONSENT_VERSION,
        ipAddress: '10.0.0.1',
        consentTextHash: 'hash456',
        db: mockDb as unknown as D1Database,
      });

      expect(result.id).toBeDefined();

      const data = mockDb.getData();
      const consentRecord = data[result.id];

      expect(consentRecord).toBeDefined();
      expect(consentRecord.user_id).toBe(null);
      expect(consentRecord.anonymous_token).toBe('anon-789');
      expect(consentRecord.content_type).toBe('logbook');
      expect(consentRecord.content_id).toBe('logbook-123');
    });

    it('should reject when neither userId nor anonymousToken provided', async () => {
      await expect(
        recordConsent({
          contentType: 'artwork',
          contentId: 'artwork-456',
          consentVersion: CURRENT_CONSENT_VERSION,
          ipAddress: '192.168.1.1',
          consentTextHash: 'hash123',
          db: mockDb as unknown as D1Database,
        })
      ).rejects.toThrow('Either userId or anonymousToken must be provided');
    });

    it('should reject when both userId and anonymousToken provided', async () => {
      await expect(
        recordConsent({
          userId: 'user-123',
          anonymousToken: 'anon-789',
          contentType: 'artwork',
          contentId: 'artwork-456',
          consentVersion: CURRENT_CONSENT_VERSION,
          ipAddress: '192.168.1.1',
          consentTextHash: 'hash123',
          db: mockDb as unknown as D1Database,
        })
      ).rejects.toThrow('Cannot provide both userId and anonymousToken');
    });

    it('should reject invalid content type', async () => {
      await expect(
        recordConsent({
          userId: 'user-123',
          contentType: 'invalid' as any,
          contentId: 'content-456',
          consentVersion: CURRENT_CONSENT_VERSION,
          ipAddress: '192.168.1.1',
          consentTextHash: 'hash123',
          db: mockDb as unknown as D1Database,
        })
      ).rejects.toThrow('Invalid content type: invalid');
    });

    it('should support mass import with reserved UUID', async () => {
      const result = await recordConsent({
        userId: MASS_IMPORT_USER_UUID,
        contentType: 'artwork',
        contentId: 'imported-artwork-1',
        consentVersion: CURRENT_CONSENT_VERSION,
        ipAddress: '127.0.0.1',
        consentTextHash: 'import-hash',
        db: mockDb as unknown as D1Database,
      });

      expect(result.id).toBeDefined();

      const data = mockDb.getData();
      const consentRecord = data[result.id];

      expect(consentRecord.user_id).toBe(MASS_IMPORT_USER_UUID);
      expect(consentRecord.content_id).toBe('imported-artwork-1');
    });
  });

  describe('hasConsentForContent', () => {
    it('should return true when consent exists', async () => {
      // First record consent
      await recordConsent({
        userId: 'user-123',
        contentType: 'artwork',
        contentId: 'artwork-456',
        consentVersion: CURRENT_CONSENT_VERSION,
        ipAddress: '192.168.1.1',
        consentTextHash: 'hash123',
        db: mockDb as unknown as D1Database,
      });

      // Then check if consent exists
      const hasConsent = await hasConsentForContent(mockDb as unknown as D1Database, {
        userId: 'user-123',
        contentType: 'artwork',
        contentId: 'artwork-456',
      });

      expect(hasConsent).toBe(true);
    });

    it('should return false when consent does not exist', async () => {
      const hasConsent = await hasConsentForContent(mockDb as unknown as D1Database, {
        userId: 'user-123',
        contentType: 'artwork',
        contentId: 'nonexistent-artwork',
      });

      expect(hasConsent).toBe(false);
    });
  });

  describe('getConsentRecord', () => {
    it('should retrieve consent record', async () => {
      // First record consent
      const recordResult = await recordConsent({
        anonymousToken: 'anon-token',
        contentType: 'logbook',
        contentId: 'logbook-789',
        consentVersion: CURRENT_CONSENT_VERSION,
        ipAddress: '10.0.0.1',
        consentTextHash: 'hash789',
        db: mockDb as unknown as D1Database,
      });

      // Then retrieve it
      const consent = await getConsentRecord(mockDb as unknown as D1Database, {
        anonymousToken: 'anon-token',
        contentType: 'logbook',
        contentId: 'logbook-789',
      });

      expect(consent).toBeDefined();
      expect(consent?.id).toBe(recordResult.id);
      expect(consent?.anonymous_token).toBe('anon-token');
      expect(consent?.content_type).toBe('logbook');
      expect(consent?.content_id).toBe('logbook-789');
    });

    it('should return null when record not found', async () => {
      const consent = await getConsentRecord(mockDb as unknown as D1Database, {
        userId: 'nonexistent-user',
        contentType: 'artwork',
        contentId: 'nonexistent-artwork',
      });

      expect(consent).toBe(null);
    });
  });

  describe('generateConsentTextHash', () => {
    it('should generate consistent hash for same input', async () => {
      const text = 'This is consent text';
      const hash1 = await generateConsentTextHash(text);
      const hash2 = await generateConsentTextHash(text);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    });

    it('should generate different hashes for different inputs', async () => {
      const hash1 = await generateConsentTextHash('text1');
      const hash2 = await generateConsentTextHash('text2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('validateConsent', () => {
    it('should validate complete consent data', () => {
      const consentData = {
        ageVerification: true,
        cc0Licensing: true,
        publicCommons: true,
        freedomOfPanorama: true,
      };

      const result = validateConsent(consentData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.missingConsents).toHaveLength(0);
    });

    it('should identify missing consents', () => {
      const consentData = {
        ageVerification: true,
        cc0Licensing: false,
        publicCommons: true,
        freedomOfPanorama: false,
      };

      const result = validateConsent(consentData);

      expect(result.isValid).toBe(false);
      expect(result.missingConsents).toContain('cc0Licensing');
      expect(result.missingConsents).toContain('freedomOfPanorama');
      expect(result.errors).toContain('CC0 public domain dedication consent is required');
      expect(result.errors).toContain(
        'Freedom of Panorama legal guidance acknowledgment is required'
      );
    });

    it('should identify all missing consents when none provided', () => {
      const consentData = {
        ageVerification: false,
        cc0Licensing: false,
        publicCommons: false,
        freedomOfPanorama: false,
      };

      const result = validateConsent(consentData);

      expect(result.isValid).toBe(false);
      expect(result.missingConsents).toHaveLength(4);
      expect(result.errors).toHaveLength(4);
    });
  });
});
