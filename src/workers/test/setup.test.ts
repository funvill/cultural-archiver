/**
 * Basic setup test to verify testing infrastructure
 */

import { describe, it, expect } from 'vitest';

describe('Testing Infrastructure', () => {
  it('should have basic testing setup working', () => {
    expect(true).toBe(true);
  });

  it('should be able to run async tests', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});