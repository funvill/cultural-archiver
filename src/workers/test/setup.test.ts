/**
 * Basic setup test to verify testing infrastructure
 */

import { describe, it, expect } from 'vitest';

describe('Testing Infrastructure', (): void => {
  it('should have basic testing setup working', (): void => {
    expect(true).toBe(true);
  });

  it('should be able to run async tests', async (): Promise<void> => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});
