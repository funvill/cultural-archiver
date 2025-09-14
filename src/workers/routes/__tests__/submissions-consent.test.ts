/**
 * Integration tests for consent-first submission flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CONSENT_VERSION } from '../../../shared/consent';
import { recordConsent, generateConsentTextHash } from '../../lib/consent-new';

// Mock D1Database for testing
class MockD1Database {
  private data: Record<string, any> = {};
  private tables: Record<string, any[]> = {
    consent: [],
    logbook: [],
  };

  prepare(query: string) {
    return {
      bind: (...bindings: any[]) => ({
        run: async () => {
          if (query.includes('INSERT INTO consent')) {
            const [id, created_at, user_id, anonymous_token, consent_version, content_type, content_id, ip_address, consent_text_hash] = bindings;
            const record = {
              id, created_at, user_id, anonymous_token, consent_version, 
              content_type, content_id, ip_address, consent_text_hash
            };
            this.tables.consent.push(record);
            this.data[id] = record;
            return { success: true };
          }
          if (query.includes('INSERT INTO logbook')) {
            const record = { id: bindings[0], user_token: bindings[2], status: 'pending' };
            this.tables.logbook.push(record);
            return { success: true };
          }
          if (query.includes('UPDATE consent')) {
            const [newContentId, consentId] = bindings;
            const consent = this.data[consentId];
            if (consent) {
              consent.content_id = newContentId;
            }
            return { success: true };
          }
          return { success: true };
        },
        first: async () => {
          if (query.includes('SELECT * FROM consent')) {
            const [contentType, contentId] = bindings;
            return this.tables.consent.find(r => r.content_type === contentType && r.content_id === contentId) || null;
          }
          return null;
        },
      }),
    };
  }

  reset() {
    this.data = {};
    this.tables = { consent: [], logbook: [] };
  }

  getConsents() {
    return this.tables.consent;
  }

  getLogbook() {
    return this.tables.logbook;
  }
}

describe('Consent-First Submission Flow Integration', () => {
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
  });

  describe('Complete Submission Flow', () => {
    it('should record consent before creating logbook entry', async () => {
      // Step 1: Record consent first
      const contentId = 'test-logbook-123';
      const consentTextHash = await generateConsentTextHash(
        `Cultural Archiver Consent v${CONSENT_VERSION} - Logbook Submission`
      );

      const consentResult = await recordConsent({
        anonymousToken: 'anon-user-456',
        contentType: 'logbook',
        contentId,
        consentVersion: CONSENT_VERSION,
        ipAddress: '192.168.1.100',
        consentTextHash,
        db: mockDb as any,
      });

      expect(consentResult.id).toBeDefined();

      // Step 2: Verify consent was recorded
      const consents = mockDb.getConsents();
      expect(consents).toHaveLength(1);
      expect(consents[0].content_type).toBe('logbook');
      expect(consents[0].content_id).toBe(contentId);
      expect(consents[0].anonymous_token).toBe('anon-user-456');
      expect(consents[0].ip_address).toBe('192.168.1.100');

      // Step 3: Simulate logbook creation (would normally happen in submission endpoint)
      const actualLogbookId = 'actual-logbook-456';
      await mockDb.prepare(`
        UPDATE consent SET content_id = ? WHERE id = ?
      `).bind(actualLogbookId, consentResult.id).run();

      // Verify the consent record was updated with the actual logbook ID
      const updatedConsents = mockDb.getConsents();
      expect(updatedConsents[0].content_id).toBe(actualLogbookId);
    });

    it('should handle consent failure before submission', async () => {
      // Simulate consent failure by providing invalid data
      await expect(recordConsent({
        // Missing user identity
        contentType: 'logbook',
        contentId: 'test-content-123',
        consentVersion: CONSENT_VERSION,
        ipAddress: '192.168.1.100',
        consentTextHash: 'hash123',
        db: mockDb as any,
      })).rejects.toThrow('Either userId or anonymousToken must be provided');

      // Verify no consent was recorded
      const consents = mockDb.getConsents();
      expect(consents).toHaveLength(0);
    });

    it('should support both authenticated and anonymous users', async () => {
      const contentId1 = 'auth-logbook-123';
      const contentId2 = 'anon-logbook-456';
      const consentTextHash = await generateConsentTextHash('test consent text');

      // Test authenticated user
      const authResult = await recordConsent({
        userId: 'auth-user-789',
        contentType: 'logbook',
        contentId: contentId1,
        consentVersion: CONSENT_VERSION,
        ipAddress: '10.0.0.1',
        consentTextHash,
        db: mockDb as any,
      });

      // Test anonymous user
      const anonResult = await recordConsent({
        anonymousToken: 'anon-token-abc',
        contentType: 'logbook',
        contentId: contentId2,
        consentVersion: CONSENT_VERSION,
        ipAddress: '10.0.0.2',
        consentTextHash,
        db: mockDb as any,
      });

      expect(authResult.id).toBeDefined();
      expect(anonResult.id).toBeDefined();

      const consents = mockDb.getConsents();
      expect(consents).toHaveLength(2);

      // Check authenticated consent
      const authConsent = consents.find(c => c.user_id === 'auth-user-789');
      expect(authConsent).toBeDefined();
      expect(authConsent?.anonymous_token).toBe(null);
      expect(authConsent?.ip_address).toBe('10.0.0.1');

      // Check anonymous consent
      const anonConsent = consents.find(c => c.anonymous_token === 'anon-token-abc');
      expect(anonConsent).toBeDefined();
      expect(anonConsent?.user_id).toBe(null);
      expect(anonConsent?.ip_address).toBe('10.0.0.2');
    });

    it('should record consent for artwork submissions', async () => {
      const contentId = 'artwork-789';
      const consentTextHash = await generateConsentTextHash(
        `Cultural Archiver Consent v${CONSENT_VERSION} - Artwork Submission`
      );

      const result = await recordConsent({
        userId: 'artist-user-123',
        contentType: 'artwork',
        contentId,
        consentVersion: CONSENT_VERSION,
        ipAddress: '172.16.0.1',
        consentTextHash,
        db: mockDb as any,
      });

      expect(result.id).toBeDefined();

      const consents = mockDb.getConsents();
      expect(consents).toHaveLength(1);
      expect(consents[0].content_type).toBe('artwork');
      expect(consents[0].content_id).toBe(contentId);
      expect(consents[0].user_id).toBe('artist-user-123');
    });

    it('should generate consistent consent text hashes', async () => {
      const text = 'Test consent text for hashing';
      const hash1 = await generateConsentTextHash(text);
      const hash2 = await generateConsentTextHash(text);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
      expect(hash1.length).toBe(64);
    });

    it('should handle mass import consent with reserved UUID', async () => {
      const MASS_IMPORT_USER_UUID = 'b0000000-1000-4000-8000-000000000002';
      const contentId = 'mass-import-artwork-1';
      const consentTextHash = await generateConsentTextHash('Mass import consent');

      const result = await recordConsent({
        userId: MASS_IMPORT_USER_UUID,
        contentType: 'artwork',
        contentId,
        consentVersion: CONSENT_VERSION,
        ipAddress: '127.0.0.1',
        consentTextHash,
        db: mockDb as any,
      });

      expect(result.id).toBeDefined();

      const consents = mockDb.getConsents();
      expect(consents).toHaveLength(1);
      expect(consents[0].user_id).toBe(MASS_IMPORT_USER_UUID);
      expect(consents[0].content_type).toBe('artwork');
      expect(consents[0].content_id).toBe(contentId);
    });

    it('should validate consent version tracking', async () => {
      const contentId = 'version-test-123';
      const consentTextHash = await generateConsentTextHash('Version test');

      // Test with current version
      const currentResult = await recordConsent({
        anonymousToken: 'version-user-1',
        contentType: 'logbook',
        contentId,
        consentVersion: '1.0.0',
        ipAddress: '192.168.1.1',
        consentTextHash,
        db: mockDb as any,
      });

      // Test with different version
      const newResult = await recordConsent({
        anonymousToken: 'version-user-2', 
        contentType: 'logbook',
        contentId: 'version-test-456',
        consentVersion: '1.1.0',
        ipAddress: '192.168.1.2',
        consentTextHash,
        db: mockDb as any,
      });

      expect(currentResult.id).toBeDefined();
      expect(newResult.id).toBeDefined();

      const consents = mockDb.getConsents();
      expect(consents).toHaveLength(2);
      expect(consents[0].consent_version).toBe('1.0.0');
      expect(consents[1].consent_version).toBe('1.1.0');
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid content types', async () => {
      const consentTextHash = await generateConsentTextHash('test');

      await expect(recordConsent({
        userId: 'test-user',
        contentType: 'invalid' as any,
        contentId: 'test-id',
        consentVersion: CONSENT_VERSION,
        ipAddress: '127.0.0.1',
        consentTextHash,
        db: mockDb as any,
      })).rejects.toThrow('Invalid content type: invalid');
    });

    it('should reject missing required fields', async () => {
      await expect(recordConsent({
        userId: 'test-user',
        contentType: 'logbook',
        contentId: '', // Empty content ID
        consentVersion: CONSENT_VERSION,
        ipAddress: '127.0.0.1',
        consentTextHash: 'hash',
        db: mockDb as any,
      })).rejects.toThrow('Missing required consent fields');
    });

    it('should reject providing both userId and anonymousToken', async () => {
      const consentTextHash = await generateConsentTextHash('test');

      await expect(recordConsent({
        userId: 'test-user',
        anonymousToken: 'test-token',
        contentType: 'logbook',
        contentId: 'test-id',
        consentVersion: CONSENT_VERSION,
        ipAddress: '127.0.0.1',
        consentTextHash,
        db: mockDb as any,
      })).rejects.toThrow('Cannot provide both userId and anonymousToken');
    });
  });
});