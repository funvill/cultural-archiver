/**
 * Unit tests for artwork editing API routes
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { submitArtworkEdit, getUserPendingEdits, validateArtworkEdit } from '../artwork';
import type { WorkerEnv } from '../../types';

// Mock the submissions service functions
vi.mock('../../lib/submissions', () => ({
  getUserPendingArtworkEdits: vi.fn(),
  getUserSubmissionCount: vi.fn(),
  createArtworkEditFromFields: vi.fn(),
}));

// Mock auth middleware
vi.mock('../../middleware/auth', () => ({
  getUserToken: vi.fn().mockReturnValue('test-user-token'),
}));

// Mock validation middleware
vi.mock('../../middleware/validation', () => ({
  getValidatedData: vi.fn(),
}));

// Mock error handling
vi.mock('../../lib/errors', () => ({
  createSuccessResponse: vi.fn().mockImplementation(data => ({ success: true, data })),
  ValidationApiError: class ValidationApiError extends Error {
    constructor(
      validationErrors: Array<{ field: string; message: string; code: string }>,
      message?: string
    ) {
      // Use the first validation error's message if only one error and no custom message
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
    env: mockEnv,
  } as any;
}

describe('Artwork Editing Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitArtworkEdit', () => {
    test('should submit artwork edits successfully', async () => {
      const { getUserSubmissionCount, getUserPendingArtworkEdits, createArtworkEditFromFields } = await import('../../lib/submissions');
      
      (getUserSubmissionCount as any).mockResolvedValue(5);
      (getUserPendingArtworkEdits as any).mockResolvedValue([]);
      (createArtworkEditFromFields as any).mockResolvedValue('submission-123');

      const requestBody = {
        edits: [
          {
            field_name: 'title',
            field_value_old: 'Old Title',
            field_value_new: 'New Title',
          },
          {
            field_name: 'description',
            field_value_old: 'Old Description',
            field_value_new: 'New Description',
          },
        ],
      };

      const c = createMockContext({ id: 'artwork-123' }, requestBody);

      await submitArtworkEdit(c);

      expect(getUserSubmissionCount).toHaveBeenCalledWith(
        mockEnv.DB,
        'test-user-token',
        'artwork_edit',
        24
      );
      expect(getUserPendingArtworkEdits).toHaveBeenCalledWith(
        mockEnv.DB,
        'test-user-token',
        'artwork-123'
      );
      expect(createArtworkEditFromFields).toHaveBeenCalledWith(mockEnv.DB, {
        userToken: 'test-user-token',
        artworkId: 'artwork-123',
        edits: requestBody.edits,
      });
      expect(c.json).toHaveBeenCalledWith({
        success: true,
        data: {
          edit_ids: ['submission-123'],
          message: 'Your changes have been submitted for review',
          status: 'pending',
        },
      });
    });

    test('should reject request without artwork ID', async () => {
      const c = createMockContext({}, {});

      await expect(submitArtworkEdit(c)).rejects.toThrow('Artwork ID is required');
    });

    test('should reject request without edits array', async () => {
      const c = createMockContext({ id: 'artwork-123' }, {});

      await expect(submitArtworkEdit(c)).rejects.toThrow('edits array is required');
    });

    test('should reject request with empty edits array', async () => {
      const c = createMockContext({ id: 'artwork-123' }, { edits: [] });

      await expect(submitArtworkEdit(c)).rejects.toThrow('At least one edit is required');
    });

    test('should reject request with invalid field names', async () => {
      const requestBody = {
        edits: [
          {
            field_name: 'invalid_field',
            field_value_old: 'old',
            field_value_new: 'new',
          },
        ],
      };

      const c = createMockContext({ id: 'artwork-123' }, requestBody);

      await expect(submitArtworkEdit(c)).rejects.toThrow('Invalid field name: invalid_field');
    });

    test('should reject request when rate limit exceeded', async () => {
      // Mock rate limit exceeded (getUserSubmissionCount returns 500 which exceeds the 500 limit)
      const { getUserSubmissionCount } = await import('../../lib/submissions');
      vi.mocked(getUserSubmissionCount).mockResolvedValue(500);

      const requestBody = {
        edits: [
          {
            field_name: 'title',
            field_value_old: 'Old Title',
            field_value_new: 'New Title',
          },
        ],
      };

      const c = createMockContext({ id: 'artwork-123' }, requestBody);

      await expect(submitArtworkEdit(c)).rejects.toThrow('Rate limit exceeded');
    });

    test('should reject request when user has pending edits', async () => {
      // Mock rate limit check to pass (under limit)
      const { getUserSubmissionCount, getUserPendingArtworkEdits } = await import('../../lib/submissions');
      vi.mocked(getUserSubmissionCount).mockResolvedValue(10); // Under rate limit
      
      // Mock user having pending edits for this artwork
      vi.mocked(getUserPendingArtworkEdits).mockResolvedValue([{
        id: 'existing-edit',
        artwork_id: 'artwork-123',
        artist_id: null,
        user_token: 'test-user-token',
        submission_type: 'artwork_edit' as const,
        field_changes: '{"title": {"old": "Old", "new": "New"}}',
        photos: null,
        notes: null,
        lat: null,
        lon: null,
        consent_version: '1.0.0',
        consent_text_hash: 'hash',
        ip_address: '127.0.0.1',
        user_agent: null,
        created_at: '2023-01-01T00:00:00Z',
        submitted_at: '2023-01-01T00:00:00Z',
        status: 'pending' as const,
        review_notes: null,
        reviewed_at: null,
        reviewer_token: null
      }]);

      const requestBody = {
        edits: [
          {
            field_name: 'title',
            field_value_old: 'Old Title',
            field_value_new: 'New Title',
          },
        ],
      };

      const c = createMockContext({ id: 'artwork-123' }, requestBody);

      await expect(submitArtworkEdit(c)).rejects.toThrow(
        'You already have pending edits for this artwork'
      );
    });

    test('should validate allowed field names', async () => {
      const allowedFields = ['title', 'description', 'created_by', 'tags'];

      for (const field of allowedFields) {
        // Mock successful submissions system calls
        const { getUserSubmissionCount, getUserPendingArtworkEdits, createArtworkEditFromFields } = await import('../../lib/submissions');
        
        vi.mocked(getUserSubmissionCount).mockResolvedValue(5); // Below rate limit
        vi.mocked(getUserPendingArtworkEdits).mockResolvedValue([]); // No pending edits
        vi.mocked(createArtworkEditFromFields).mockResolvedValue('edit-1'); // Successful submission

        const requestBody = {
          edits: [
            {
              field_name: field,
              field_value_old: 'old',
              field_value_new: 'new',
            },
          ],
        };

        const c = createMockContext({ id: 'artwork-123' }, requestBody);

        // Should not throw error for allowed fields
        await expect(submitArtworkEdit(c)).resolves.not.toThrow();
      }
    });
  });

  describe('getUserPendingEdits', () => {
    test('should retrieve user pending edits successfully', async () => {
      const mockPendingEdits = [
        {
          id: 'edit-1',
          artwork_id: 'artwork-123',
          artist_id: null,
          user_token: 'test-user-token',
          submission_type: 'artwork_edit' as const,
          field_changes: null,
          photos: null,
          notes: null,
          lat: null,
          lon: null,
          new_data: '{"title": "Updated Title"}',
          tags: null,
          consent_version: '1.0.0',
          consent_text_hash: 'hash',
          ip_address: '127.0.0.1',
          user_agent: null,
          created_at: '2025-01-01T00:00:00.000Z',
          submitted_at: '2025-01-01T00:00:00.000Z',
          status: 'pending' as const,
          review_notes: null,
          reviewed_at: null,
          reviewer_token: null
        },
      ];

      // Mock the submissions system function
      const { getUserPendingArtworkEdits } = await import('../../lib/submissions');
      vi.mocked(getUserPendingArtworkEdits).mockResolvedValue(mockPendingEdits);

      const c = createMockContext({ id: 'artwork-123' });

      await getUserPendingEdits(c);

      expect(getUserPendingArtworkEdits).toHaveBeenCalledWith(mockDb, 'test-user-token', 'artwork-123');
      expect(c.json).toHaveBeenCalledWith({
        success: true,
        data: {
          has_pending_edits: true,
          pending_fields: ['title'],
          submitted_at: '2025-01-01T00:00:00.000Z',
        },
      });
    });

    test('should return no pending edits when none exist', async () => {
      // Mock the submissions system function to return empty array
      const { getUserPendingArtworkEdits } = await import('../../lib/submissions');
      vi.mocked(getUserPendingArtworkEdits).mockResolvedValue([]);

      const c = createMockContext({ id: 'artwork-123' });

      await getUserPendingEdits(c);

      expect(getUserPendingArtworkEdits).toHaveBeenCalledWith(mockDb, 'test-user-token', 'artwork-123');
      expect(c.json).toHaveBeenCalledWith({
        success: true,
        data: {
          has_pending_edits: false,
          pending_fields: [],
          submitted_at: undefined,
        },
      });
    });

    test('should reject request without artwork ID', async () => {
      const c = createMockContext({});

      await expect(getUserPendingEdits(c)).rejects.toThrow('Artwork ID is required');
    });
  });

  describe('validateArtworkEdit', () => {
    test('should validate valid edit request', async () => {
      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'artwork-123' }),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      // Mock submissions system function for rate limiting
      const { getUserSubmissionCount } = await import('../../lib/submissions');
      vi.mocked(getUserSubmissionCount).mockResolvedValue(10); // Below rate limit

      const requestBody = {
        edits: [
          {
            field_name: 'title',
            field_value_old: 'Old Title',
            field_value_new: 'New Title',
          },
        ],
      };

      const c = createMockContext({ id: 'artwork-123' }, requestBody);

      await validateArtworkEdit(c);

      expect(c.json).toHaveBeenCalledWith({
        success: true,
        data: {
          valid: true,
          message: 'Edit request is valid',
          rate_limit_info: {
            edits_used: 10,
            edits_remaining: 490,
            rate_limit: 500,
            window_hours: 24,
          },
        },
      });
    });

    test('should return invalid when rate limit exceeded', async () => {
      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 'artwork-123' }),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      // Mock submissions system function for rate limiting (return 500 to exceed limit)
      const { getUserSubmissionCount } = await import('../../lib/submissions');
      vi.mocked(getUserSubmissionCount).mockResolvedValue(500); // At rate limit

      const requestBody = {
        edits: [
          {
            field_name: 'title',
            field_value_old: 'Old Title',
            field_value_new: 'New Title',
          },
        ],
      };

      const c = createMockContext({ id: 'artwork-123' }, requestBody);

      await validateArtworkEdit(c);

      expect(c.json).toHaveBeenCalledWith({
        success: true,
        data: {
          valid: false,
          message: 'Rate limit exceeded. You can submit up to 500 edits per 24-hour period.',
          rate_limit_info: {
            edits_used: 500,
            edits_remaining: 0,
            rate_limit: 500,
            window_hours: 24,
          },
        },
      });
    });

    test('should reject when artwork not found', async () => {
      const mockDbStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };
      mockDb.prepare.mockReturnValue(mockDbStmt);

      const requestBody = {
        edits: [
          {
            field_name: 'title',
            field_value_old: 'Old Title',
            field_value_new: 'New Title',
          },
        ],
      };

      const c = createMockContext({ id: 'nonexistent' }, requestBody);

      await expect(validateArtworkEdit(c)).rejects.toThrow('Artwork not found: nonexistent');
    });
  });
});
