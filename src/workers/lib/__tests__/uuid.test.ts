import { expect, it, describe } from 'vitest';
import { generateUUID, isValidUUID } from '../../../shared/utils/uuid';

describe('shared/utils/uuid', () => {
  it('generates UUIDs that match v4 pattern', () => {
    const uuid = generateUUID();
    expect(uuid).toBeDefined();
    expect(typeof uuid).toBe('string');
  expect(isValidUUID(uuid)).toBe(true);
  });

  it('generates unique values across multiple calls', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(20);
  });
});
