import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createArtworkEditSubmission } from '../submissions-new';
import type { Context } from 'hono';
import type { WorkerEnv } from '../../types';

// Mock auth middleware
vi.mock('../../middleware/auth', () => ({
  getUserToken: vi.fn().mockReturnValue('test-user-token'),
}));

// Mock validation middleware (we'll set return values per test)
vi.mock('../../middleware/validation', () => ({
  getValidatedData: vi.fn(),
}));

// Mock submissions service
vi.mock('../../lib/submissions', () => ({
  createArtworkEdit: vi.fn().mockResolvedValue('submission-123'),
}));

// Mock consent and audit log to avoid DB side effects
vi.mock('../../lib/consent-new', () => ({
  recordConsent: vi.fn().mockResolvedValue({ id: 'consent-id' }),
  generateConsentTextHash: vi.fn().mockResolvedValue('hash'),
}));

vi.mock('../../lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(true),
}));

// Mock permission checks
vi.mock('../../lib/user-roles', () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));

// Minimal mock DB used for prepare/bind/all/run
const mockDbStmt = {
  bind: vi.fn().mockReturnThis(),
  all: vi.fn(),
  first: vi.fn(),
  run: vi.fn(),
};

const mockDb = {
  prepare: vi.fn().mockReturnValue(mockDbStmt),
};

const mockEnv = { DB: mockDb as unknown as WorkerEnv['DB'] } as unknown as WorkerEnv;

function createMockContext(body: unknown = {}): Context<{ Bindings: WorkerEnv }> {
  const ctx = {
    req: {
      json: vi.fn().mockResolvedValue(body as any),
      header: vi.fn().mockReturnValue(undefined),
    },
    json: vi.fn().mockReturnValue(new Response()),
    env: mockEnv,
  } as unknown as Context<{ Bindings: WorkerEnv }>;

  return ctx;
}

describe('Artwork edit submission validation (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects title longer than 200 chars', async () => {
    const { getValidatedData } = await import('../../middleware/validation');
    vi.mocked(getValidatedData).mockReturnValue({
      artwork_id: 'art-1',
      old_data: {},
      new_data: { title: 'a'.repeat(201) },
    });

    const c = createMockContext();

    await expect(createArtworkEditSubmission(c)).rejects.toThrow('Title must be 200 characters or less');

    // Ensure createArtworkEdit was not called
    const { createArtworkEdit } = await import('../../lib/submissions');
    expect(vi.mocked(createArtworkEdit).mock.calls.length).toBe(0);
  });

  it('rejects description longer than 10000 chars', async () => {
    const { getValidatedData } = await import('../../middleware/validation');
    vi.mocked(getValidatedData).mockReturnValue({
      artwork_id: 'art-1',
      old_data: {},
      new_data: { description: 'a'.repeat(10001) },
    });

    const c = createMockContext();

    await expect(createArtworkEditSubmission(c)).rejects.toThrow('Description must be 10000 characters or less');

    const { createArtworkEdit } = await import('../../lib/submissions');
    expect(vi.mocked(createArtworkEdit).mock.calls.length).toBe(0);
  });

  it('rejects when artist ids are missing from DB', async () => {
    const { getValidatedData } = await import('../../middleware/validation');
    vi.mocked(getValidatedData).mockReturnValue({
      artwork_id: 'art-1',
      old_data: {},
      new_data: { artists: ['missing-artist-id'] },
    });

    // mock DB prepare().all() to return no results
    mockDbStmt.all.mockResolvedValue({ results: [] });

    const c = createMockContext();

    await expect(createArtworkEditSubmission(c)).rejects.toThrow('Invalid artist IDs');

    const { createArtworkEdit } = await import('../../lib/submissions');
    expect(vi.mocked(createArtworkEdit).mock.calls.length).toBe(0);
  });
});
