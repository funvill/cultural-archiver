/**
 * Unit tests for artist API routes
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getArtistsList, getArtistProfile, createArtist, submitArtistEdit, getUserPendingArtistEdits } from '../artists';
import type { WorkerEnv } from '../../types';

// Mock auth middleware
vi.mock('../../middleware/auth', () => ({
  getUserToken: vi.fn().mockReturnValue('test-user-token'),
}));

// Mock validation middleware
vi.mock('../../middleware/validation', () => ({
  getValidatedData: vi.fn(),
}));

// Mock database service
vi.mock('../../lib/database', () => ({
  createDatabaseService: vi.fn().mockImplementation(() => ({
    db: mockDb,
  })),
}));

// Mock error handling
vi.mock('../../lib/errors', () => ({
  createSuccessResponse: vi.fn().mockImplementation(data => ({ success: true, data })),
  safeJsonParse: vi.fn().mockImplementation((str, defaultValue) => {
    if (!str) return defaultValue;
    try {
      return JSON.parse(str);
    } catch {
      return defaultValue;
    }
  }),
  ValidationApiError: class ValidationApiError extends Error {
    constructor(
      validationErrors: Array<{ field: string; message: string; code: string }>,
      message?: string
    ) {
      const firstError = validationErrors[0];
      const finalMessage =
        message ||
        (validationErrors.length === 1 && firstError?.message
          ? firstError.message
          : 'Validation failed');
      super(finalMessage);
      this.name = 'ValidationApiError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
}));

// Mock database
const mockDb = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
  }),
} as any;

const mockEnv: WorkerEnv = {
  DB: mockDb,
} as any;

// Create mock Hono context
function createMockContext(params: Record<string, string> = {}, body: any = {}) {
  return {
    req: {
      param: vi.fn().mockImplementation((key: string) => params[key]),
      json: vi.fn().mockResolvedValue(body),
    },
    json: vi.fn().mockReturnValue(new Response()),
    header: vi.fn(), // Add header method for cache control
    env: mockEnv,
  } as any;
}

describe('Artist Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getArtistsList', () => {
    test('should return paginated artists list', async () => {
      const mockArtists = [
        {
          id: 'artist-1',
          name: 'Test Artist',
          description: 'Test bio',
          tags: '{"website": "example.com"}',
          status: 'active',
          artwork_count: 2,
        },
      ];

      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockArtists }),
        first: vi.fn().mockResolvedValue({ total: 1 }),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      // Mock getValidatedData to return search params
      const { getValidatedData } = await import('../../middleware/validation');
      vi.mocked(getValidatedData).mockReturnValue({
        page: 1,
        limit: 20,
      });

      const c = createMockContext();
      const response = await getArtistsList(c);

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(c.json).toHaveBeenCalled();
    });

    test('should handle search filter', async () => {
      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue({ total: 0 }),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      const { getValidatedData } = await import('../../middleware/validation');
      vi.mocked(getValidatedData).mockReturnValue({
        search: 'Test',
      });

      const c = createMockContext();
      await getArtistsList(c);

      // Should use search in query (with new default limit of 30)
      expect(mockDbStmt.bind).toHaveBeenCalledWith(
        'active',
        '%Test%',
        30,
        0
      );
    });
  });

  describe('getArtistProfile', () => {
    test('should return artist profile with artworks', async () => {
      const mockArtist = {
        id: 'artist-1',
        name: 'Test Artist',
        description: 'Test bio',
        tags: '{"website": "example.com"}',
        status: 'active',
      };

      const mockArtworks = [
        {
          id: 'artwork-1',
          title: 'Test Artwork',
          lat: 49.2827,
          lon: -123.1207,
          type_name: 'Sculpture',
          recent_photos: '["photo1.jpg"]',
          photo_count: 1,
        },
      ];

      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockArtist),
        all: vi.fn().mockResolvedValue({ results: mockArtworks }),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      const c = createMockContext({ id: 'artist-1' });
      const response = await getArtistProfile(c);

      expect(mockDb.prepare).toHaveBeenCalledTimes(2); // Artist + artworks queries
      expect(c.json).toHaveBeenCalled();
    });

    test('should throw NotFoundError for invalid artist', async () => {
      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      const c = createMockContext({ id: 'nonexistent' });

      await expect(getArtistProfile(c)).rejects.toThrow('Artist not found: nonexistent');
    });
  });

  describe('createArtist', () => {
    test('should create new artist successfully', async () => {
      const requestBody = {
        name: 'New Artist',
        description: 'Artist bio',
        tags: { website: 'example.com' },
      };

      const mockCreatedArtist = {
        id: 'new-artist-id',
        name: 'New Artist',
        description: 'Artist bio',
        tags: '{"website":"example.com"}',
        status: 'active',
      };

      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(mockCreatedArtist),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      const c = createMockContext({}, requestBody);
      const response = await createArtist(c);

      expect(mockDb.prepare).toHaveBeenCalledTimes(2); // Insert + select
      expect(c.json).toHaveBeenCalled();
    });

    test('should reject creation with empty name', async () => {
      const requestBody = { name: '' };
      const c = createMockContext({}, requestBody);

      await expect(createArtist(c)).rejects.toThrow('Artist name is required');
    });
  });

  describe('submitArtistEdit', () => {
    test('should submit artist edits successfully', async () => {
      const requestBody = {
        edits: [
          {
            field_name: 'name',
            field_value_old: 'Old Name',
            field_value_new: 'New Name',
          },
        ],
      };

      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn()
          .mockResolvedValueOnce({ id: 'artist-1' }) // Artist exists
          .mockResolvedValueOnce(null), // No pending edits
        run: vi.fn().mockResolvedValue({ success: true }),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      const c = createMockContext({ id: 'artist-1' }, requestBody);
      const response = await submitArtistEdit(c);

      expect(c.json).toHaveBeenCalled();
    });

    test('should reject when artist not found', async () => {
      const requestBody = {
        edits: [
          {
            field_name: 'name',
            field_value_old: 'Old Name',
            field_value_new: 'New Name',
          },
        ],
      };

      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      const c = createMockContext({ id: 'nonexistent' }, requestBody);

      await expect(submitArtistEdit(c)).rejects.toThrow('Artist not found: nonexistent');
    });

    test('should reject with pending edits', async () => {
      const requestBody = {
        edits: [
          {
            field_name: 'name',
            field_value_old: 'Old Name',
            field_value_new: 'New Name',
          },
        ],
      };

      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn()
          .mockResolvedValueOnce({ id: 'artist-1' }) // Artist exists
          .mockResolvedValueOnce({ edit_id: 'existing-edit' }), // Pending edit exists
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      const c = createMockContext({ id: 'artist-1' }, requestBody);

      await expect(submitArtistEdit(c)).rejects.toThrow('You already have pending edits for this artist');
    });
  });

  describe('getUserPendingArtistEdits', () => {
    test('should return pending edits status', async () => {
      const mockPendingEdits = [
        {
          edit_id: 'edit-1',
          submitted_at: '2025-01-08T10:00:00.000Z',
        },
      ];

      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockPendingEdits }),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      const c = createMockContext({ id: 'artist-1' });
      const response = await getUserPendingArtistEdits(c);

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(c.json).toHaveBeenCalled();
    });

    test('should return no pending edits', async () => {
      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      const c = createMockContext({ id: 'artist-1' });
      const response = await getUserPendingArtistEdits(c);

      expect(c.json).toHaveBeenCalled();
    });
  });
});