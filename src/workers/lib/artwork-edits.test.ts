/**
 * Unit tests for artwork edits database operations
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ArtworkEditsService } from './artwork-edits';
import type { CreateArtworkEditRequest } from '../../shared/types';

// Mock D1Database
const mockDb = {
  prepare: vi.fn(),
  exec: vi.fn(),
} as any;

// Mock prepared statement
const mockStmt = {
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
};

describe('ArtworkEditsService', () => {
  let artworkEditsService: ArtworkEditsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.prepare.mockReturnValue(mockStmt);
    artworkEditsService = new ArtworkEditsService(mockDb);
  });

  describe('submitArtworkEdit', () => {
    test('should submit artwork edits successfully', async () => {
      // Mock artwork exists check
      mockStmt.first.mockResolvedValueOnce({ id: 'artwork-123' });

      // Mock successful inserts
      mockStmt.run.mockResolvedValue({ changes: 1 });

      const request: CreateArtworkEditRequest = {
        artwork_id: 'artwork-123',
        user_token: 'user-456',
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

      const editIds = await artworkEditsService.submitArtworkEdit(request);

      expect(editIds).toHaveLength(2);
      expect(editIds[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT id FROM artwork WHERE id = ?');
      expect(mockStmt.bind).toHaveBeenCalledWith('artwork-123');
      expect(mockStmt.run).toHaveBeenCalledTimes(2);
    });

    test('should throw error if artwork does not exist', async () => {
      // Mock artwork not found
      mockStmt.first.mockResolvedValueOnce(null);

      const request: CreateArtworkEditRequest = {
        artwork_id: 'nonexistent-artwork',
        user_token: 'user-456',
        edits: [
          {
            field_name: 'title',
            field_value_old: 'Old Title',
            field_value_new: 'New Title',
          },
        ],
      };

      await expect(artworkEditsService.submitArtworkEdit(request)).rejects.toThrow(
        'Artwork not found: nonexistent-artwork'
      );
    });

    test('should handle empty edits array', async () => {
      // Mock artwork exists
      mockStmt.first.mockResolvedValueOnce({ id: 'artwork-123' });

      const request: CreateArtworkEditRequest = {
        artwork_id: 'artwork-123',
        user_token: 'user-456',
        edits: [],
      };

      const editIds = await artworkEditsService.submitArtworkEdit(request);

      expect(editIds).toHaveLength(0);
      expect(mockStmt.run).not.toHaveBeenCalled();
    });
  });

  describe('getUserPendingEdits', () => {
    test('should retrieve user pending edits', async () => {
      const mockPendingEdits = [
        {
          edit_id: 'edit-1',
          artwork_id: 'artwork-123',
          user_token: 'user-456',
          field_name: 'title',
          field_value_old: 'Old Title',
          field_value_new: 'New Title',
          status: 'pending',
          submitted_at: '2025-01-01T00:00:00.000Z',
        },
      ];

      mockStmt.all.mockResolvedValue({ results: mockPendingEdits });

      const result = await artworkEditsService.getUserPendingEdits('user-456', 'artwork-123');

      expect(result).toEqual(mockPendingEdits);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE user_token = ? AND artwork_id = ? AND status = 'pending'")
      );
      expect(mockStmt.bind).toHaveBeenCalledWith('user-456', 'artwork-123');
    });

    test('should return empty array when no pending edits', async () => {
      mockStmt.all.mockResolvedValue({ results: [] });

      const result = await artworkEditsService.getUserPendingEdits('user-456', 'artwork-123');

      expect(result).toEqual([]);
    });
  });

  describe('getArtworkEditById', () => {
    test('should retrieve artwork edit by ID', async () => {
      const mockEdit = {
        edit_id: 'edit-1',
        artwork_id: 'artwork-123',
        field_name: 'title',
        status: 'pending',
      };

      mockStmt.first.mockResolvedValue(mockEdit);

      const result = await artworkEditsService.getArtworkEditById('edit-1');

      expect(result).toEqual(mockEdit);
      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM artwork_edits WHERE edit_id = ?');
      expect(mockStmt.bind).toHaveBeenCalledWith('edit-1');
    });

    test('should return null when edit not found', async () => {
      mockStmt.first.mockResolvedValue(null);

      const result = await artworkEditsService.getArtworkEditById('nonexistent-edit');

      expect(result).toBeNull();
    });
  });

  describe('approveEditSubmission', () => {
    test('should approve all edits in submission', async () => {
      mockStmt.run.mockResolvedValue({ changes: 1 });

      const editIds = ['edit-1', 'edit-2'];
      const moderatorToken = 'moderator-123';

      await artworkEditsService.approveEditSubmission(editIds, moderatorToken, false);

      expect(mockStmt.run).toHaveBeenCalledTimes(2);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE artwork_edits'));
      expect(mockStmt.bind).toHaveBeenCalledWith(expect.any(String), moderatorToken, 'edit-1');
      expect(mockStmt.bind).toHaveBeenCalledWith(expect.any(String), moderatorToken, 'edit-2');
    });
  });

  describe('rejectEditSubmission', () => {
    test('should reject all edits in submission with reason', async () => {
      mockStmt.run.mockResolvedValue({ changes: 1 });

      const editIds = ['edit-1', 'edit-2'];
      const moderatorToken = 'moderator-123';
      const reason = 'Inappropriate content';

      await artworkEditsService.rejectEditSubmission(editIds, moderatorToken, reason);

      expect(mockStmt.run).toHaveBeenCalledTimes(2);
      expect(mockStmt.bind).toHaveBeenCalledWith(
        expect.any(String),
        moderatorToken,
        reason,
        'edit-1'
      );
      expect(mockStmt.bind).toHaveBeenCalledWith(
        expect.any(String),
        moderatorToken,
        reason,
        'edit-2'
      );
    });

    test('should reject edits without reason', async () => {
      mockStmt.run.mockResolvedValue({ changes: 1 });

      await artworkEditsService.rejectEditSubmission(['edit-1'], 'moderator-123');

      expect(mockStmt.bind).toHaveBeenCalledWith(
        expect.any(String),
        'moderator-123',
        null,
        'edit-1'
      );
    });
  });

  describe('getUserPendingEditCount', () => {
    test('should count user pending edits within time window', async () => {
      mockStmt.first.mockResolvedValue({ count: 5 });

      const result = await artworkEditsService.getUserPendingEditCount('user-456', 24);

      expect(result).toBe(5);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_token = ? AND submitted_at >= ?')
      );
      expect(mockStmt.bind).toHaveBeenCalledWith('user-456', expect.any(String));
    });

    test('should return 0 when no result', async () => {
      mockStmt.first.mockResolvedValue(null);

      const result = await artworkEditsService.getUserPendingEditCount('user-456');

      expect(result).toBe(0);
    });
  });

  describe('getEditStatistics', () => {
    test('should return edit statistics', async () => {
      const mockStats = {
        total_edits: 100,
        pending_edits: 10,
        approved_edits: 80,
        rejected_edits: 10,
      };

      mockStmt.first.mockResolvedValue(mockStats);

      const result = await artworkEditsService.getEditStatistics();

      expect(result).toEqual(mockStats);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('COUNT'));
    });
  });

  describe('formatDiffsForDisplay', () => {
    test('should format tag diffs as readable text', () => {
      const diffs = [
        {
          field_name: 'tags',
          old_value: '["tag1", "tag2"]',
          new_value: '["tag2", "tag3", "tag4"]',
        },
        {
          field_name: 'title',
          old_value: 'Old Title',
          new_value: 'New Title',
        },
      ];

      const formatted = artworkEditsService.formatDiffsForDisplay(diffs);

      expect(formatted[0].formatted_old).toBe('tag1, tag2');
      expect(formatted[0].formatted_new).toBe('tag2, tag3, tag4');
      expect(formatted[1].formatted_old).toBe('Old Title');
      expect(formatted[1].formatted_new).toBe('New Title');
    });

    test('should handle object-style tags', () => {
      const diffs = [
        {
          field_name: 'tags',
          old_value: '{"material": "bronze", "style": "modern"}',
          new_value: '{"material": "steel", "style": "contemporary", "color": "blue"}',
        },
      ];

      const formatted = artworkEditsService.formatDiffsForDisplay(diffs);

      expect(formatted[0].formatted_old).toBe('material: bronze, style: modern');
      expect(formatted[0].formatted_new).toBe('material: steel, style: contemporary, color: blue');
    });

    test('should handle invalid JSON in tags gracefully', () => {
      const diffs = [
        {
          field_name: 'tags',
          old_value: 'invalid json',
          new_value: 'also invalid',
        },
      ];

      const formatted = artworkEditsService.formatDiffsForDisplay(diffs);

      expect(formatted[0].formatted_old).toBe('invalid json');
      expect(formatted[0].formatted_new).toBe('also invalid');
    });
  });

  describe('getPendingEditsForReview', () => {
    test('should group pending edits by submission', async () => {
      const mockGroups = [
        {
          artwork_id: 'artwork-123',
          user_token: 'user-456',
          submitted_at: '2025-01-01T00:00:00.000Z',
          edit_count: 2,
        },
      ];

      const mockEdits = [
        {
          edit_id: 'edit-1',
          artwork_id: 'artwork-123',
          user_token: 'user-456',
          field_name: 'title',
          field_value_old: 'Old Title',
          field_value_new: 'New Title',
          status: 'pending',
          submitted_at: '2025-01-01T00:00:00.000Z',
        },
        {
          edit_id: 'edit-2',
          artwork_id: 'artwork-123',
          user_token: 'user-456',
          field_name: 'description',
          field_value_old: 'Old Description',
          field_value_new: 'New Description',
          status: 'pending',
          submitted_at: '2025-01-01T00:00:00.000Z',
        },
      ];

      // First call returns groups, second call returns edits for group
      mockStmt.all
        .mockResolvedValueOnce({ results: mockGroups })
        .mockResolvedValueOnce({ results: mockEdits });

      const result = await artworkEditsService.getPendingEditsForReview(10, 0);

      expect(result).toHaveLength(1);
      expect(result[0].edit_ids).toEqual(['edit-1', 'edit-2']);
      expect(result[0].artwork_id).toBe('artwork-123');
      expect(result[0].diffs).toHaveLength(2);
      expect(result[0].diffs[0].field_name).toBe('title');
    });
  });

  describe('logbook integration', () => {
    test('should create logbook entry when edits are successfully applied', async () => {
      // Mock approval flow with successful field application
      const editIds = ['edit-1', 'edit-2'];

      // Mock approved edits
      const mockApprovedEdits = [
        {
          edit_id: 'edit-1',
          artwork_id: 'artwork-123',
          user_token: 'user-456',
          field_name: 'title',
          field_value_old: 'Old Title',
          field_value_new: 'New Title',
          status: 'approved',
          submitted_at: '2025-01-01T00:00:00.000Z',
        },
      ];

      // Mock table schema with editable fields
      const mockTableInfo = {
        results: [
          { name: 'id' },
          { name: 'lat' },
          { name: 'lon' },
          { name: 'title' }, // This field exists, so edit will be applied
          { name: 'description' },
          { name: 'created_by' },
        ],
      };

      // Mock artwork coordinates
      const mockArtwork = { lat: 49.2827, lon: -123.1207 };

      // Setup mock call sequence
      mockStmt.run.mockResolvedValue({ changes: 1 }); // Update edit status

      // For applyApprovedEditsToArtwork:
      mockStmt.all
        .mockResolvedValueOnce({ results: mockApprovedEdits }) // Get approved edits
        .mockResolvedValueOnce(mockTableInfo) // Get table info (title field exists)
        .mockResolvedValueOnce(mockTableInfo) // ensureEditableFieldsExist check
        .mockResolvedValueOnce({ results: mockApprovedEdits }); // Get edits for logbook

      mockStmt.run.mockResolvedValue({ changes: 1 }); // Apply edits to artwork
      mockStmt.first.mockResolvedValueOnce(mockArtwork); // Get artwork coordinates
      mockStmt.run.mockResolvedValue({ changes: 1 }); // Insert logbook entry

      await artworkEditsService.approveEditSubmission(editIds, 'moderator-123', true);

      // Verify logbook entry was created
      const prepareCalls = mockDb.prepare.mock.calls;
      const logbookInsertCall = prepareCalls.find(call => call[0].includes('INSERT INTO logbook'));

      expect(logbookInsertCall).toBeDefined();
      expect(logbookInsertCall[0]).toContain('INSERT INTO logbook');
    });

    test('should create logbook entry even when no fields are applied', async () => {
      // Mock approval flow with no successful field application
      const editIds = ['edit-1'];

      // Mock approved edits
      const mockApprovedEdits = [
        {
          edit_id: 'edit-1',
          artwork_id: 'artwork-123',
          user_token: 'user-456',
          field_name: 'nonexistent_field',
          field_value_old: 'Old Value',
          field_value_new: 'New Value',
          status: 'approved',
          submitted_at: '2025-01-01T00:00:00.000Z',
        },
      ];

      // Mock table schema without editable fields (field doesn't exist)
      const mockTableInfo = {
        results: [
          { name: 'id' },
          { name: 'lat' },
          { name: 'lon' },
          // Missing: title, description, created_by, nonexistent_field
        ],
      };

      // Mock artwork coordinates
      const mockArtwork = { lat: 49.2827, lon: -123.1207 };

      // Setup mock call sequence
      mockStmt.run.mockResolvedValue({ changes: 1 }); // Update edit status

      // For applyApprovedEditsToArtwork:
      mockStmt.all
        .mockResolvedValueOnce({ results: mockApprovedEdits }) // Get approved edits
        .mockResolvedValueOnce(mockTableInfo); // Get table info

      // ensureEditableFieldsExist will be called
      mockStmt.all.mockResolvedValueOnce(mockTableInfo); // Get table info again
      mockStmt.run.mockResolvedValue({ changes: 1 }); // Try to add columns (may fail)

      // For logbook entry creation:
      mockStmt.all.mockResolvedValueOnce({ results: mockApprovedEdits }); // Get edits for logbook
      mockStmt.first.mockResolvedValueOnce(mockArtwork); // Get artwork coordinates
      mockStmt.run.mockResolvedValue({ changes: 1 }); // Insert logbook entry

      await artworkEditsService.approveEditSubmission(editIds, 'moderator-123', true);

      // Verify logbook entry WAS created to maintain transparency
      const prepareCalls = mockDb.prepare.mock.calls;
      const logbookInsertCall = prepareCalls.find(call => call[0].includes('INSERT INTO logbook'));

      expect(logbookInsertCall).toBeDefined();
      expect(logbookInsertCall[0]).toContain('INSERT INTO logbook');
    });
  });
});
