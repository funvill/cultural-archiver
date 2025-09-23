/**
 * Obsolete legacy test (multi-add append behavior) intentionally replaced.
 * Original behavior: adding a 2nd photo appended to existing fast-upload session
 * and re-triggered search via global 'fast-upload-session-updated' event.
 *
 * Current product decision: Each new Add action starts a fresh fast-add session
 * (overwrite model). The old expectations are invalid and this spec is now a noop.
 *
 * We keep a skipped placeholder instead of deleting immediately because Vitest
 * treats an entirely empty spec file as a failure ("No test suite found").
 * Once test globs are updated (or after next cleanup pass) this file can be deleted.
 */
import { describe, it } from 'vitest';

describe.skip('SearchView Fast Add multiple updates (legacy)', () => {
  it('legacy multi-add behavior superseded by overwrite model', () => {
    // Intentionally empty. See comment above.
  });
});
