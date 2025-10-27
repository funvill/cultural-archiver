/**
 * Shared UUID utility
 * Exposes a single generateUUID() implementation that prefers the
 * secure crypto.randomUUID() when available and falls back to a
 * standard v4-style generator for environments without it.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** UUID v4 pattern for validation */
export const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Known UUID pattern for sample data */
export const KNOWN_SAMPLE_UUID_PATTERN = /^[a-f]0000000-1000-4000-8000-[0-9a-f]{12}$/;

/** Clerk user ID pattern (e.g., user_2abcdefg1234567890) */
export const CLERK_USER_ID_PATTERN = /^user_[A-Za-z0-9]{24,}$/;

/**
 * Validates if a string is a valid UUID v4 or Clerk user ID
 */
export function isValidUUID(uuid: string): boolean {
  return UUID_V4_PATTERN.test(uuid) || CLERK_USER_ID_PATTERN.test(uuid);
}

/**
 * Validates if a UUID is a known sample/system UUID
 */
export function isSampleUUID(uuid: string): boolean {
  return KNOWN_SAMPLE_UUID_PATTERN.test(uuid);
}
