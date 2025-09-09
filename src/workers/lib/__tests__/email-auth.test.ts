/**
 * Unit tests for Magic Link Email System
 * Tests token generation, rate limiting, email templates, and magic link lifecycle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerEnv } from '../../types';
import type { MagicLinkRecord, RateLimitRecord, UserRecord } from '../../shared/types';
import {
  generateMagicLinkToken,
  validateMagicLinkToken,
  checkRateLimit,
  createMagicLinkRecord,
  getMagicLinkRecord,
  markMagicLinkUsed,
  sendMagicLinkEmail,
  requestMagicLink,
  consumeMagicLink,
  cleanupExpiredMagicLinks,
} from '../email-auth';
import { generateMagicLinkEmailTemplate } from '../resend-email';
import * as authModule from '../auth';

// Mock environment
// Mock objects interfaces for testing
interface MockDBStatement {
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

interface MockDBResult {
  changes?: number;
  results?: unknown[];
}

const mockEnv = {
  DB: {
    prepare: vi.fn(),
  },
  SESSIONS: {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  CACHE: {},
  RATE_LIMITS: {},
  MAGIC_LINKS: {},
  PHOTOS_BUCKET: {},
  ENVIRONMENT: 'test',
  FRONTEND_URL: 'http://localhost:3000',
  LOG_LEVEL: 'debug',
  API_VERSION: '1.0.0',
  EMAIL_FROM: 'test@cultural-archiver.com',
} as unknown as WorkerEnv;

// Mock database statement
const createMockStatement = (
  result: unknown = null,
  runResult: MockDBResult = { changes: 1 }
): MockDBStatement => ({
  bind: vi.fn().mockReturnThis(),
  first: vi.fn().mockResolvedValue(result),
  all: vi.fn().mockResolvedValue({ results: Array.isArray(result) ? result : [result] }),
  run: vi.fn().mockResolvedValue(runResult),
});

// Mock auth module functions
vi.mock('./auth', () => ({
  getUserByEmail: vi.fn(),
  createUserWithUUIDClaim: vi.fn(),
  updateUserEmailVerified: vi.fn(),
}));

describe('Magic Link Email System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Token Generation and Validation', () => {
    it('should generate valid magic link tokens', () => {
      const token = generateMagicLinkToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes as hex
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateMagicLinkToken();
      const token2 = generateMagicLinkToken();

      expect(token1).not.toBe(token2);
    });

    it('should validate token format correctly', () => {
      // Valid token
      const validToken = 'a'.repeat(64);
      expect(validateMagicLinkToken(validToken)).toEqual({ isValid: true });

      // Invalid tokens
      expect(validateMagicLinkToken('')).toEqual({
        isValid: false,
        error: 'Token is required',
      });

      expect(validateMagicLinkToken('short')).toEqual({
        isValid: false,
        error: 'Token must be 64 characters long',
      });

      expect(validateMagicLinkToken('x'.repeat(64))).toEqual({
        isValid: false,
        error: 'Token must be hexadecimal',
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should allow first request for new identifier', async () => {
      const mockStatement = createMockStatement(null); // No existing record
      mockEnv.DB.prepare = vi.fn().mockReturnValue(mockStatement);

      const result = await checkRateLimit(mockEnv, 'test@example.com', 'email');

      expect(result.is_blocked).toBe(false);
      expect(result.requests_remaining).toBe(9); // 10 limit - 1 used
      expect(result.identifier).toBe('test@example.com');
      expect(result.identifier_type).toBe('email');
    });

    it('should increment counter for existing record', async () => {
      const existingRecord: RateLimitRecord = {
        identifier: 'test@example.com',
        identifier_type: 'email',
        request_count: 2,
        window_start: new Date().toISOString(),
        last_request_at: new Date().toISOString(),
        blocked_until: null,
      };

      const selectStatement = createMockStatement(existingRecord);
      const updateStatement = createMockStatement();

      mockEnv.DB.prepare = vi
        .fn()
        .mockReturnValueOnce(selectStatement)
        .mockReturnValueOnce(updateStatement);

      const result = await checkRateLimit(mockEnv, 'test@example.com', 'email');

      expect(result.is_blocked).toBe(false);
      expect(result.requests_remaining).toBe(7); // 10 limit - 3 used
    });

    it('should block when rate limit exceeded', async () => {
      const existingRecord: RateLimitRecord = {
        identifier: 'test@example.com',
        identifier_type: 'email',
        request_count: 10, // At limit
        window_start: new Date().toISOString(),
        last_request_at: new Date().toISOString(),
        blocked_until: null,
      };

      const selectStatement = createMockStatement(existingRecord);
      const updateStatement = createMockStatement();

      mockEnv.DB.prepare = vi
        .fn()
        .mockReturnValueOnce(selectStatement)
        .mockReturnValueOnce(updateStatement);

      const result = await checkRateLimit(mockEnv, 'test@example.com', 'email');

      expect(result.is_blocked).toBe(true);
      expect(result.requests_remaining).toBe(0);
      expect(result.blocked_until).toBeDefined();
    });

    it('should reset window when expired', async () => {
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const existingRecord: RateLimitRecord = {
        identifier: 'test@example.com',
        identifier_type: 'email',
        request_count: 5,
        window_start: oldDate.toISOString(),
        last_request_at: oldDate.toISOString(),
        blocked_until: null,
      };

      const selectStatement = createMockStatement(existingRecord);
      const updateStatement = createMockStatement();

      mockEnv.DB.prepare = vi
        .fn()
        .mockReturnValueOnce(selectStatement)
        .mockReturnValueOnce(updateStatement);

      const result = await checkRateLimit(mockEnv, 'test@example.com', 'email');

      expect(result.is_blocked).toBe(false);
      expect(result.requests_remaining).toBe(9); // Reset to 1 used
    });

    it('should respect existing block', async () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const existingRecord: RateLimitRecord = {
        identifier: 'test@example.com',
        identifier_type: 'email',
        request_count: 5,
        window_start: new Date().toISOString(),
        last_request_at: new Date().toISOString(),
        blocked_until: futureDate.toISOString(),
      };

      const selectStatement = createMockStatement(existingRecord);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(selectStatement);

      const result = await checkRateLimit(mockEnv, 'test@example.com', 'email');

      expect(result.is_blocked).toBe(true);
      expect(result.blocked_until).toBe(futureDate.toISOString());
    });
  });

  describe('Magic Link Database Operations', () => {
    it('should create magic link record for new user signup', async () => {
      const email = 'new@example.com';
      const uuid = '123e4567-e89b-12d3-a456-426614174000';

      // Mock no existing user (signup)
      vi.mocked(authModule.getUserByEmail).mockResolvedValue(null);

      const insertStatement = createMockStatement();
      mockEnv.DB.prepare = vi.fn().mockReturnValue(insertStatement);

      const record = await createMagicLinkRecord(mockEnv, email, uuid);

      expect(record.email).toBe(email.toLowerCase());
      expect(record.user_uuid).toBeNull();
      expect(record.is_signup).toBe(true);
      expect(record.token).toHaveLength(64);
      expect(new Date(record.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('should create magic link record for existing user login', async () => {
      const email = 'existing@example.com';
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const existingUser = { uuid, email, status: 'active' };

      // Mock existing user (login)
      vi.mocked(authModule.getUserByEmail).mockResolvedValue(existingUser as UserRecord);

      const insertStatement = createMockStatement();
      mockEnv.DB.prepare = vi.fn().mockReturnValue(insertStatement);

      const record = await createMagicLinkRecord(mockEnv, email, 'different-uuid');

      expect(record.email).toBe(email.toLowerCase());
      expect(record.user_uuid).toBe(uuid);
      expect(record.is_signup).toBe(false);
    });

    it('should get magic link record by token', async () => {
      const token = 'a'.repeat(64);
      const mockRecord: MagicLinkRecord = {
        token,
        email: 'test@example.com',
        user_uuid: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        used_at: null,
        ip_address: null,
        user_agent: null,
        is_signup: true,
      };

      const statement = createMockStatement(mockRecord);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const result = await getMagicLinkRecord(mockEnv, token);

      expect(result).toEqual(mockRecord);
      expect(statement.bind).toHaveBeenCalledWith(token);
    });

    it('should mark magic link as used', async () => {
      const token = 'a'.repeat(64);
      const statement = createMockStatement();
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      await markMagicLinkUsed(mockEnv, token);

      expect(statement.bind).toHaveBeenCalledWith(expect.any(String), token);
    });
  });

  describe('Email Templates', () => {
    it('should generate signup email template', () => {
      const email = 'test@example.com';
      const magicLink = 'http://localhost:3000/auth/verify?token=abc123';
      const expiresAt = '2024-01-01 12:00:00';
      const anonymousSubmissions = 3;

      const html = generateMagicLinkEmailTemplate(
        email,
        magicLink,
        true, // is signup
        expiresAt,
        anonymousSubmissions
      );

      expect(html).toContain('Welcome to Cultural Archiver');
      expect(html).toContain('Verify Email & Complete Setup');
      expect(html).toContain(magicLink);
      expect(html).toContain('3 anonymous submission');
      expect(html).toContain(expiresAt);
    });

    it('should generate login email template', () => {
      const email = 'test@example.com';
      const magicLink = 'http://localhost:3000/auth/verify?token=abc123';
      const expiresAt = '2024-01-01 12:00:00';

      const html = generateMagicLinkEmailTemplate(
        email,
        magicLink,
        false, // is login
        expiresAt
      );

      expect(html).toContain('Sign In');
      expect(html).toContain('Sign In to Cultural Archiver');
      expect(html).toContain(magicLink);
      expect(html).not.toContain('anonymous submission');
    });

    it('should handle singular submission count', () => {
      const html = generateMagicLinkEmailTemplate(
        'test@example.com',
        'http://localhost/link',
        true,
        '2024-01-01',
        1
      );

      expect(html).toContain('1 anonymous submission');
      expect(html).not.toContain('1 anonymous submissions'); // Should not pluralize when count is 1
    });
  });

  describe('Email Sending', () => {
    it('should send email in production mode', async () => {
      const mockRecord: MagicLinkRecord = {
        token: 'a'.repeat(64),
        email: 'test@example.com',
        user_uuid: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        used_at: null,
        ip_address: null,
        user_agent: null,
        is_signup: true,
      };

      const prodEnv = {
        ...mockEnv,
        RESEND_API_KEY: 'test-resend-key',
        EMAIL_ENABLED: 'true',
        EMAIL_FROM_ADDRESS: 'noreply@example.com',
        EMAIL_FROM_NAME: 'Cultural Archiver Test',
        EMAIL_REPLY_TO: 'noreply@example.com',
        ENVIRONMENT: 'production' as const,
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ id: 'test-email-id-123' }),
      });

      await sendMagicLinkEmail(prodEnv, mockRecord, 'http://localhost:3000');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-resend-key',
          }),
        })
      );
    });

    it('should handle email sending failure', async () => {
      const mockRecord: MagicLinkRecord = {
        token: 'a'.repeat(64),
        email: 'test@example.com',
        user_uuid: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        used_at: null,
        ip_address: null,
        user_agent: null,
        is_signup: true,
      };

      const prodEnv = {
        ...mockEnv,
        RESEND_API_KEY: 'test-resend-key',
        EMAIL_ENABLED: 'true',
        EMAIL_FROM_ADDRESS: 'noreply@example.com',
        EMAIL_FROM_NAME: 'Cultural Archiver Test',
        EMAIL_REPLY_TO: 'noreply@example.com',
        ENVIRONMENT: 'production' as const,
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      // Should throw an error when email delivery fails, but gracefully handle it with fallback logging
      await expect(
        sendMagicLinkEmail(prodEnv, mockRecord, 'http://localhost:3000')
      ).rejects.toThrow('Email delivery failed');

      // Verify that SESSIONS.put was called for fallback storage
      expect(prodEnv.SESSIONS.put).toHaveBeenCalledWith(
        `dev-magic-link:${mockRecord.email}`,
        expect.stringContaining(mockRecord.token),
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      );
    });

    it('should log email in development mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockRecord: MagicLinkRecord = {
        token: 'a'.repeat(64),
        email: 'test@example.com',
        user_uuid: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        used_at: null,
        ip_address: null,
        user_agent: null,
        is_signup: true,
      };

      await sendMagicLinkEmail(mockEnv, mockRecord, 'http://localhost:3000');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Email sending disabled, logging magic link:',
        expect.objectContaining({
          email: 'test@example.com',
          isSignup: true,
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Magic Link Request Flow', () => {
    it('should handle valid magic link request', async () => {
      const email = 'test@example.com';
      const uuid = '123e4567-e89b-12d3-a456-426614174000';

      // Mock successful rate limit check - no existing record
      const rateLimitSelectStmt = createMockStatement(null);
      const rateLimitInsertStmt = createMockStatement();
      const submissionsStmt = createMockStatement({ count: 2 });
      const magicLinkInsertStmt = createMockStatement();

      let callCount = 0;
      mockEnv.DB.prepare = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return rateLimitSelectStmt; // Rate limit check
        if (callCount === 2) return rateLimitInsertStmt; // Rate limit insert
        if (callCount === 3) return submissionsStmt; // Count submissions
        if (callCount === 4) return magicLinkInsertStmt; // Insert magic link
        return createMockStatement();
      });

      vi.mocked(authModule.getUserByEmail).mockResolvedValue(null);

      const result = await requestMagicLink(mockEnv, { email }, uuid, '192.168.1.1', 'Test Agent');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Account creation email sent');
    });

    it('should reject invalid email', async () => {
      const result = await requestMagicLink(mockEnv, { email: 'invalid-email' }, 'uuid');

      expect(result.success).toBe(false);
      expect(result.message).toContain('valid email address');
    });

    it('should respect rate limits', async () => {
      const blockedRecord: RateLimitRecord = {
        identifier: 'test@example.com',
        identifier_type: 'email',
        request_count: 5,
        window_start: new Date().toISOString(),
        last_request_at: new Date().toISOString(),
        blocked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };

      const statement = createMockStatement(blockedRecord);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const result = await requestMagicLink(mockEnv, { email: 'test@example.com' }, 'uuid');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Too many requests');
    });
  });

  describe('Magic Link Consumption', () => {
    it('should consume valid magic link for signup', async () => {
      const token = 'a'.repeat(64);
      const email = 'test@example.com';
      const currentUUID = '123e4567-e89b-12d3-a456-426614174000';

      const mockRecord: MagicLinkRecord = {
        token,
        email,
        user_uuid: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        used_at: null,
        ip_address: null,
        user_agent: null,
        is_signup: true,
      };

      const selectStmt = createMockStatement(mockRecord);
      const updateStmt = createMockStatement();

      mockEnv.DB.prepare = vi.fn().mockReturnValueOnce(selectStmt).mockReturnValueOnce(updateStmt);

      const mockUser = { uuid: currentUUID, email, status: 'active' } as UserRecord;
      vi.mocked(authModule.createUserWithUUIDClaim).mockResolvedValue(mockUser);
      vi.mocked(authModule.updateUserEmailVerified).mockResolvedValue();

      const result = await consumeMagicLink(mockEnv, { token }, currentUUID);

      expect(result.success).toBe(true);
      expect(result.is_new_account).toBe(true);
      expect(result.user_token).toBe(currentUUID);
      expect(result.message).toContain('Account created successfully');
    });

    it('should consume valid magic link for login', async () => {
      const token = 'a'.repeat(64);
      const email = 'test@example.com';
      const userUUID = '123e4567-e89b-12d3-a456-426614174000';
      const currentUUID = 'different-uuid';

      const mockRecord: MagicLinkRecord = {
        token,
        email,
        user_uuid: userUUID,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        used_at: null,
        ip_address: null,
        user_agent: null,
        is_signup: false,
      };

      const selectStmt = createMockStatement(mockRecord);
      const updateStmt = createMockStatement();

      mockEnv.DB.prepare = vi.fn().mockReturnValueOnce(selectStmt).mockReturnValueOnce(updateStmt);

      vi.mocked(authModule.updateUserEmailVerified).mockResolvedValue();

      const result = await consumeMagicLink(mockEnv, { token }, currentUUID);

      expect(result.success).toBe(true);
      expect(result.is_new_account).toBe(false);
      expect(result.user_token).toBe(userUUID);
      expect(result.message).toContain('Successfully signed in');
    });

    it('should reject invalid token format', async () => {
      const result = await consumeMagicLink(mockEnv, { token: 'invalid' }, 'uuid');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid verification link format');
    });

    it('should reject nonexistent token', async () => {
      const token = 'a'.repeat(64);
      const statement = createMockStatement(null);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const result = await consumeMagicLink(mockEnv, { token }, 'uuid');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid or expired verification link');
    });

    it('should reject already used token', async () => {
      const token = 'a'.repeat(64);
      const mockRecord: MagicLinkRecord = {
        token,
        email: 'test@example.com',
        user_uuid: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        used_at: new Date().toISOString(), // Already used
        ip_address: null,
        user_agent: null,
        is_signup: true,
      };

      const statement = createMockStatement(mockRecord);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const result = await consumeMagicLink(mockEnv, { token }, 'uuid');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already been used');
    });

    it('should reject expired token', async () => {
      const token = 'a'.repeat(64);
      const mockRecord: MagicLinkRecord = {
        token,
        email: 'test@example.com',
        user_uuid: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Expired
        used_at: null,
        ip_address: null,
        user_agent: null,
        is_signup: true,
      };

      const statement = createMockStatement(mockRecord);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const result = await consumeMagicLink(mockEnv, { token }, 'uuid');

      expect(result.success).toBe(false);
      expect(result.message).toContain('expired');
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup expired records', async () => {
      const magicLinkStmt = createMockStatement(null, { changes: 5 });
      const rateLimitStmt = createMockStatement(null, { changes: 3 });

      mockEnv.DB.prepare = vi
        .fn()
        .mockReturnValueOnce(magicLinkStmt)
        .mockReturnValueOnce(rateLimitStmt);

      const result = await cleanupExpiredMagicLinks(mockEnv);

      expect(result.magic_links_cleaned).toBe(5);
      expect(result.rate_limits_cleaned).toBe(3);
    });

    it('should handle cleanup errors gracefully', async () => {
      const errorStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      mockEnv.DB.prepare = vi.fn().mockReturnValue(errorStmt);

      const result = await cleanupExpiredMagicLinks(mockEnv);

      expect(result.magic_links_cleaned).toBe(0);
      expect(result.rate_limits_cleaned).toBe(0);
    });
  });
});
