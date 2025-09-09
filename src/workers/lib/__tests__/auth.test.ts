/**
 * Unit tests for Core Authentication Logic
 * Tests UUID generation, user creation, session management, and cross-device functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerEnv } from '../../types';
import {
  generateUUID,
  validateUUID,
  generateUniqueUUID,
  createUserWithUUIDClaim,
  getUUIDClaimInfo,
  getUserByUUID,
  getUserByEmail,
  updateUserLastLogin,
  updateUserEmailVerified,
  hashToken,
  generateSessionToken,
  createSession,
  validateSession,
  deactivateSession,
  deactivateAllUserSessions,
  getUserSessions,
  replaceUUIDForCrossDeviceLogin,
  cleanupExpiredSessions,
  getAuthStats,
} from '../auth';

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

// Mock environment
const mockEnv = {
  DB: {
    prepare: vi.fn(),
  },
  SESSIONS: {},
  CACHE: {},
  RATE_LIMITS: {},
  MAGIC_LINKS: {},
  PHOTOS_BUCKET: {},
  ENVIRONMENT: 'test',
  FRONTEND_URL: 'http://localhost:3000',
  LOG_LEVEL: 'debug',
  API_VERSION: '1.0.0',
  EMAIL_FROM: 'test@example.com',
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

describe('Authentication Core Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UUID Generation and Validation', () => {
    it('should generate valid UUIDs', () => {
      const uuid = generateUUID();
      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });

    it('should validate UUID format correctly', () => {
      // Valid UUIDs
      expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toEqual({ isValid: true });
      expect(validateUUID('550e8400-e29b-41d4-a716-446655440000')).toEqual({ isValid: true });

      // Invalid UUIDs
      expect(validateUUID('')).toEqual({ isValid: false, error: 'UUID is required' });
      expect(validateUUID('not-a-uuid')).toEqual({ isValid: false, error: 'Invalid UUID format' });
      expect(validateUUID('123e4567-e89b-12d3-a456')).toEqual({
        isValid: false,
        error: 'Invalid UUID format',
      });
    });

    it('should generate unique UUID with collision detection', async () => {
      const mockStatement = createMockStatement(null); // No collision
      mockEnv.DB.prepare = vi.fn().mockReturnValue(mockStatement);

      const uuid = await generateUniqueUUID(mockEnv);

      expect(uuid).toBeDefined();
      expect(validateUUID(uuid).isValid).toBe(true);
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith('SELECT uuid FROM users WHERE uuid = ?');
    });

    it('should retry on UUID collision', async () => {
      const mockStatement = createMockStatement(null);
      mockStatement.first
        .mockResolvedValueOnce({ uuid: 'existing-uuid' }) // First collision
        .mockResolvedValueOnce(null); // Second attempt succeeds

      mockEnv.DB.prepare = vi.fn().mockReturnValue(mockStatement);

      const uuid = await generateUniqueUUID(mockEnv);

      expect(uuid).toBeDefined();
      expect(mockStatement.bind).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries on collision', async () => {
      const mockStatement = createMockStatement({ uuid: 'existing-uuid' }); // Always collision
      mockEnv.DB.prepare = vi.fn().mockReturnValue(mockStatement);

      await expect(generateUniqueUUID(mockEnv)).rejects.toThrow(
        'Failed to generate unique UUID after maximum retries'
      );
    });
  });

  describe('User Creation and UUID Claiming', () => {
    it('should create user with UUID claim successfully', async () => {
      const email = 'alice@example.com';
      const uuid = '123e4567-e89b-12d3-a456-426614174000';

      // Mock no existing user
      const selectStatement = createMockStatement(null);
      const insertStatement = createMockStatement(null);

      mockEnv.DB.prepare = vi
        .fn()
        .mockReturnValueOnce(selectStatement) // Check existing email
        .mockReturnValueOnce(selectStatement) // Check existing UUID
        .mockReturnValueOnce(insertStatement); // Insert new user

      const user = await createUserWithUUIDClaim(mockEnv, email, uuid);

      expect(user).toEqual({
        uuid,
        email: email.toLowerCase(),
        created_at: expect.any(String),
        last_login: null,
        email_verified_at: null,
        status: 'active',
      });

      expect(insertStatement.bind).toHaveBeenCalledWith(
        uuid,
        email.toLowerCase(),
        expect.any(String)
      );
    });

    it('should reject invalid email format', async () => {
      const invalidEmail = 'not-an-email';
      const uuid = '123e4567-e89b-12d3-a456-426614174000';

      await expect(createUserWithUUIDClaim(mockEnv, invalidEmail, uuid)).rejects.toThrow(
        'Invalid email address format'
      );
    });

    it('should reject invalid UUID format', async () => {
      const email = 'alice@example.com';
      const invalidUUID = 'not-a-uuid';

      await expect(createUserWithUUIDClaim(mockEnv, email, invalidUUID)).rejects.toThrow(
        'Invalid UUID'
      );
    });

    it('should reject duplicate email', async () => {
      const email = 'alice@example.com';
      const uuid = '123e4567-e89b-12d3-a456-426614174000';

      // Mock existing user with same email
      const existingUser = { uuid: 'other-uuid', email };
      const selectStatement = createMockStatement(existingUser);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(selectStatement);

      await expect(createUserWithUUIDClaim(mockEnv, email, uuid)).rejects.toThrow(
        'Email address is already registered'
      );
    });

    it('should reject already claimed UUID', async () => {
      const email = 'alice@example.com';
      const uuid = '123e4567-e89b-12d3-a456-426614174000';

      const selectStatement = createMockStatement(null);
      const uuidStatement = createMockStatement({ uuid, email: 'other@example.com' });

      mockEnv.DB.prepare = vi
        .fn()
        .mockReturnValueOnce(selectStatement) // No existing email
        .mockReturnValueOnce(uuidStatement); // UUID already claimed

      await expect(createUserWithUUIDClaim(mockEnv, email, uuid)).rejects.toThrow(
        'UUID is already claimed by another account'
      );
    });

    it('should get UUID claim info correctly', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const email = 'alice@example.com';

      const userStatement = createMockStatement(null); // UUID not claimed
      const submissionStatement = createMockStatement({ count: 3 }); // 3 submissions

      mockEnv.DB.prepare = vi
        .fn()
        .mockReturnValueOnce(userStatement)
        .mockReturnValueOnce(submissionStatement);

      const claimInfo = await getUUIDClaimInfo(mockEnv, uuid, email);

      expect(claimInfo).toEqual({
        anonymous_uuid: uuid,
        email,
        can_claim: true,
        existing_submissions_count: 3,
      });
    });

    it('should indicate when UUID cannot be claimed', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const email = 'alice@example.com';

      // Mock UUID already claimed
      const userStatement = createMockStatement({ uuid, email: 'other@example.com' });
      mockEnv.DB.prepare = vi.fn().mockReturnValue(userStatement);

      const claimInfo = await getUUIDClaimInfo(mockEnv, uuid, email);

      expect(claimInfo.can_claim).toBe(false);
    });
  });

  describe('User Lookup Functions', () => {
    it('should get user by UUID', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockUser = { uuid, email: 'alice@example.com', status: 'active' };

      const statement = createMockStatement(mockUser);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const user = await getUserByUUID(mockEnv, uuid);

      expect(user).toEqual(mockUser);
      expect(statement.bind).toHaveBeenCalledWith(uuid);
    });

    it('should get user by email', async () => {
      const email = 'alice@example.com';
      const mockUser = { uuid: '123e4567-e89b-12d3-a456-426614174000', email };

      const statement = createMockStatement(mockUser);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const user = await getUserByEmail(mockEnv, email);

      expect(user).toEqual(mockUser);
      expect(statement.bind).toHaveBeenCalledWith(email.toLowerCase());
    });

    it('should handle user not found', async () => {
      const statement = createMockStatement(null);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const user = await getUserByUUID(mockEnv, 'nonexistent-uuid');
      expect(user).toBeNull();
    });

    it('should update user last login', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const statement = createMockStatement();
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      await updateUserLastLogin(mockEnv, uuid);

      expect(statement.bind).toHaveBeenCalledWith(expect.any(String), uuid);
    });

    it('should update user email verified', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const statement = createMockStatement();
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      await updateUserEmailVerified(mockEnv, uuid);

      expect(statement.bind).toHaveBeenCalledWith(expect.any(String), uuid);
    });
  });

  describe('Session Management', () => {
    it('should generate session token', () => {
      const token = generateSessionToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes as hex
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('should hash token consistently', async () => {
      const token = 'test-token-123';
      const hash1 = await hashToken(token);
      const hash2 = await hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 as hex
    });

    it('should create session successfully', async () => {
      const userUUID = '123e4567-e89b-12d3-a456-426614174000';
      const statement = createMockStatement();
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const result = await createSession(mockEnv, {
        user_uuid: userUUID,
        ip_address: '192.168.1.1',
        user_agent: 'Test Agent',
      });

      expect(result.session).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.session.user_uuid).toBe(userUUID);
      expect(result.session.is_active).toBe(true);
      expect(statement.bind).toHaveBeenCalledWith(
        expect.any(String), // session ID
        userUUID,
        expect.any(String), // token hash
        expect.any(String), // created_at
        expect.any(String), // last_accessed_at
        '192.168.1.1',
        'Test Agent',
        null
      );
    });

    it('should validate session token', async () => {
      const token = 'valid-session-token';
      const mockSession = {
        id: 'session-id',
        user_uuid: '123e4567-e89b-12d3-a456-426614174000',
        token_hash: 'hash',
        is_active: true,
      };

      const selectStatement = createMockStatement(mockSession);
      const updateStatement = createMockStatement();

      mockEnv.DB.prepare = vi
        .fn()
        .mockReturnValueOnce(selectStatement)
        .mockReturnValueOnce(updateStatement);

      const session = await validateSession(mockEnv, token);

      expect(session).toEqual(expect.objectContaining(mockSession));
      expect(updateStatement.bind).toHaveBeenCalledWith(
        expect.any(String), // timestamp
        'session-id'
      );
    });

    it('should return null for invalid session token', async () => {
      const statement = createMockStatement(null);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const session = await validateSession(mockEnv, 'invalid-token');

      expect(session).toBeNull();
    });

    it('should deactivate session', async () => {
      const sessionId = 'session-id';
      const statement = createMockStatement();
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      await deactivateSession(mockEnv, sessionId);

      expect(statement.bind).toHaveBeenCalledWith(sessionId);
    });

    it('should deactivate all user sessions', async () => {
      const userUUID = '123e4567-e89b-12d3-a456-426614174000';
      const statement = createMockStatement();
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      await deactivateAllUserSessions(mockEnv, userUUID);

      expect(statement.bind).toHaveBeenCalledWith(userUUID);
    });

    it('should get user sessions', async () => {
      const userUUID = '123e4567-e89b-12d3-a456-426614174000';
      const mockSessions = [
        { id: 'session-1', user_uuid: userUUID, created_at: '2024-01-01' },
        { id: 'session-2', user_uuid: userUUID, created_at: '2024-01-02' },
      ];

      const statement = createMockStatement(mockSessions);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const sessions = await getUserSessions(mockEnv, userUUID);

      expect(sessions).toHaveLength(2);
      if (sessions.length > 0 && sessions[0]) {
        expect(sessions[0].is_current).toBe(false);
      }
    });
  });

  describe('UUID Replacement for Cross-Device Login', () => {
    it('should not replace when UUIDs match', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = replaceUUIDForCrossDeviceLogin(uuid, uuid);

      expect(result.needsReplacement).toBe(false);
      expect(result.newUUID).toBe(uuid);
    });

    it('should replace when UUIDs differ', () => {
      const browserUUID = '123e4567-e89b-12d3-a456-426614174000';
      const accountUUID = '987f6543-e21c-34d5-b678-123456789012';

      const result = replaceUUIDForCrossDeviceLogin(browserUUID, accountUUID);

      expect(result.needsReplacement).toBe(true);
      expect(result.newUUID).toBe(accountUUID);
    });
  });

  describe('Session Cleanup and Stats', () => {
    it('should cleanup expired sessions', async () => {
      const statement = createMockStatement(null, { changes: 5 });
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const cleanedCount = await cleanupExpiredSessions(mockEnv);

      expect(cleanedCount).toBe(5);
      expect(statement.bind).toHaveBeenCalledWith(expect.any(String));
    });

    it('should get authentication statistics', async () => {
      const mockResults = [
        { count: 100 }, // total users
        { count: 75 }, // verified users
        { count: 25 }, // active sessions
        { count: 5 }, // users created today
      ];

      mockEnv.DB.prepare = vi
        .fn()
        .mockReturnValueOnce(createMockStatement(mockResults[0]))
        .mockReturnValueOnce(createMockStatement(mockResults[1]))
        .mockReturnValueOnce(createMockStatement(mockResults[2]))
        .mockReturnValueOnce(createMockStatement(mockResults[3]));

      const stats = await getAuthStats(mockEnv);

      expect(stats).toEqual({
        total_users: 100,
        verified_users: 75,
        active_sessions: 25,
        users_created_today: 5,
      });
    });

    it('should handle missing stats gracefully', async () => {
      const statement = createMockStatement(null);
      mockEnv.DB.prepare = vi.fn().mockReturnValue(statement);

      const stats = await getAuthStats(mockEnv);

      expect(stats).toEqual({
        total_users: 0,
        verified_users: 0,
        active_sessions: 0,
        users_created_today: 0,
      });
    });
  });
});
