/**
 * Migration integrity test ensuring legacy 'reviewer' permission values
 * have been fully normalized to 'moderator'.
 *
 * This is a lightweight structural test using an in-memory simulation.
 * If a real D1 test harness becomes available, replace mocks accordingly.
 */
import { describe, it, expect } from 'vitest';
import { enhanceAuthContext } from '../permissions';
import type { AuthContext } from '../../types';

// Minimal mock D1Database that records queries
interface D1PreparedStatementTest {
  bind: (...values: unknown[]) => D1PreparedStatementTest;
  all: <T=unknown>() => Promise<{ success: boolean; results: T[] }>;
}
interface D1Database { prepare: (query: string) => D1PreparedStatementTest }

describe('Migration Integrity: reviewer role removal', () => {
  it("should not surface any 'reviewer' permission rows and set new flags", async () => {
    // Simulate a user who previously had 'reviewer' which migration converted to 'moderator'
    const mockDB: D1Database = {
      prepare: (_query: string) => {
        return {
          bind: () => ({
            all: async () => ({
              success: true,
              results: [ { role: 'moderator' } ],
            }),
          }),
          all: async () => ({ success: true, results: [ { role: 'moderator' } ]}),
        } as unknown as D1PreparedStatementTest;
      },
    };

    const base: AuthContext = {
      userToken: 'user-123',
      isVerifiedEmail: false,
      isReviewer: false,
      isModerator: false,
      canReview: false,
      isAdmin: false,
    };

    const enhanced = await enhanceAuthContext(mockDB as unknown as D1Database, base);

    // Legacy flag maintained for backward compatibility
    expect(enhanced.isReviewer).toBe(true);
    // New flags
    expect(enhanced.isModerator).toBe(true);
    expect(enhanced.canReview).toBe(true);
    // Admin remains false
    expect(enhanced.isAdmin).toBe(false);
    // Permissions array should not include any 'reviewer'
  // Assert the string 'reviewer' is absent (it is not part of Permission union)
  expect((enhanced.permissions as unknown as string[])).not.toContain('reviewer');
  });
});
