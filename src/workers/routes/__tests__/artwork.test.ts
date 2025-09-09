/**
 * Unit tests for artwork editing API routes
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { submitArtworkEdit, getUserPendingEdits, validateArtworkEdit } from '../artwork';
import type { WorkerEnv } from '../../types';

// Mock the artwork edits service
vi.mock('../../lib/artwork-edits', () => ({
  ArtworkEditsService: vi.fn().mockImplementation(() => ({
    submitArtworkEdit: vi.fn(),
    getUserPendingEdits: vi.fn(),
    getUserPendingEditCount: vi.fn(),
  })),
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
      const mockArtworkEditsService = {
        getUserPendingEditCount: vi.fn().mockResolvedValue(5),
        getUserPendingEdits: vi.fn().mockResolvedValue([]),
        submitArtworkEdit: vi.fn().mockResolvedValue(['edit-1', 'edit-2']),
      };

      const { ArtworkEditsService } = await import('../lib/artwork-edits');
      (ArtworkEditsService as any).mockImplementation(() => mockArtworkEditsService);

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

      expect(mockArtworkEditsService.getUserPendingEditCount).toHaveBeenCalledWith(
        'test-user-token',
        24
      );
      expect(mockArtworkEditsService.getUserPendingEdits).toHaveBeenCalledWith(
        'test-user-token',
        'artwork-123'
      );
      expect(mockArtworkEditsService.submitArtworkEdit).toHaveBeenCalledWith({
        artwork_id: 'artwork-123',
        user_token: 'test-user-token',
        edits: requestBody.edits,
      });
      expect(c.json).toHaveBeenCalledWith({
        success: true,
        data: {
          edit_ids: ['edit-1', 'edit-2'],
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
      const mockArtworkEditsService = {
        getUserPendingEditCount: vi.fn().mockResolvedValue(500),
        getUserPendingEdits: vi.fn().mockResolvedValue([]),
      };

      const { ArtworkEditsService } = await import('../lib/artwork-edits');
      (ArtworkEditsService as any).mockImplementation(() => mockArtworkEditsService);

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
      const mockArtworkEditsService = {
        getUserPendingEditCount: vi.fn().mockResolvedValue(5),
        getUserPendingEdits: vi.fn().mockResolvedValue([{ edit_id: 'existing-edit' }]),
      };

      const { ArtworkEditsService } = await import('../lib/artwork-edits');
      (ArtworkEditsService as any).mockImplementation(() => mockArtworkEditsService);

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
        const mockArtworkEditsService = {
          getUserPendingEditCount: vi.fn().mockResolvedValue(5),
          getUserPendingEdits: vi.fn().mockResolvedValue([]),
          submitArtworkEdit: vi.fn().mockResolvedValue(['edit-1']),
        };

        const { ArtworkEditsService } = await import('../lib/artwork-edits');
        (ArtworkEditsService as any).mockImplementation(() => mockArtworkEditsService);

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
          edit_id: 'edit-1',
          field_name: 'title',
          submitted_at: '2025-01-01T00:00:00.000Z',
        },
      ];

      const mockArtworkEditsService = {
        getUserPendingEdits: vi.fn().mockResolvedValue(mockPendingEdits),
      };

      const { ArtworkEditsService } = await import('../lib/artwork-edits');
      (ArtworkEditsService as any).mockImplementation(() => mockArtworkEditsService);

      const c = createMockContext({ id: 'artwork-123' });

      await getUserPendingEdits(c);

      expect(mockArtworkEditsService.getUserPendingEdits).toHaveBeenCalledWith(
        'test-user-token',
        'artwork-123'
      );
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
      const mockArtworkEditsService = {
        getUserPendingEdits: vi.fn().mockResolvedValue([]),
      };

      const { ArtworkEditsService } = await import('../lib/artwork-edits');
      (ArtworkEditsService as any).mockImplementation(() => mockArtworkEditsService);

      const c = createMockContext({ id: 'artwork-123' });

      await getUserPendingEdits(c);

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

      const mockArtworkEditsService = {
        getUserPendingEditCount: vi.fn().mockResolvedValue(10),
      };

      const { ArtworkEditsService } = await import('../lib/artwork-edits');
      (ArtworkEditsService as any).mockImplementation(() => mockArtworkEditsService);

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

      const mockArtworkEditsService = {
        getUserPendingEditCount: vi.fn().mockResolvedValue(500),
      };

      const { ArtworkEditsService } = await import('../lib/artwork-edits');
      (ArtworkEditsService as any).mockImplementation(() => mockArtworkEditsService);

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
