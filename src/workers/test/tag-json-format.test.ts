/**
 * Test for verifying the fix for tag JSON format issue
 * Previously, the frontend was sending tags as strings like "material: wood"
 * Now it should send proper JSON like {"material": "wood"}
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ArtworkEditsService } from '../lib/artwork-edits.js';

describe('Tag JSON Format Fix', () => {
  // Mock D1Database - using the same pattern as artwork-edits.test.ts
  const mockDb = {
    prepare: vi.fn(),
    exec: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  // Mock prepared statement
  const mockStmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
  };

  let artworkEditsService: ArtworkEditsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.prepare.mockReturnValue(mockStmt);
    artworkEditsService = new ArtworkEditsService(mockDb);
  });

  test('should handle valid JSON tags format', async () => {
    // Mock artwork exists
    const mockArtwork = {
      id: 'test-artwork-123',
      tags: '{"tourism": "artwork", "existing": "tag"}',
    };
    
    mockStmt.first.mockResolvedValueOnce(mockArtwork);
    mockStmt.run.mockResolvedValue({ changes: 1 });

    // This should work - proper JSON format with required tourism tag
    const validTagsEdit = {
      artwork_id: 'test-artwork-123',
      user_token: 'test-user',
      edits: [
        {
          field_name: 'tags',
          field_value_old: '{"tourism": "artwork", "existing": "tag"}',
          field_value_new: '{"tourism": "artwork", "material": "wood"}',
        },
      ],
    };

    // Should not throw an error
    const result = await artworkEditsService.submitArtworkEdit(validTagsEdit);
    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe('string'); // Should return edit ID
  });

  test('should reject invalid JSON tags format', async () => {
    // Mock artwork exists
    const mockArtwork = {
      id: 'test-artwork-123',
      tags: '{"existing": "tag"}',
    };
    
    mockStmt.first.mockResolvedValueOnce(mockArtwork);

    // This should fail - invalid string format that caused the original error
    const invalidTagsEdit = {
      artwork_id: 'test-artwork-123',
      user_token: 'test-user',
      edits: [
        {
          field_name: 'tags',
          field_value_old: '{"existing": "tag"}',
          field_value_new: 'material: wood', // Invalid - not JSON
        },
      ],
    };

    // Should throw an error with the specific message we saw
    await expect(artworkEditsService.submitArtworkEdit(invalidTagsEdit))
      .rejects
      .toThrow('Invalid tags format: Unexpected token \'m\', "material: wood" is not valid JSON');
  });

  test('should handle structured tags as JSON string', async () => {
    // Mock artwork exists
    const mockArtwork = {
      id: 'test-artwork-123',
      tags: null,
    };
    
    mockStmt.first.mockResolvedValueOnce(mockArtwork);
    mockStmt.run.mockResolvedValue({ changes: 1 });

    // Test with structured tags as JSON string (the correct format) with required tourism tag
    const structuredTagsEdit = {
      artwork_id: 'test-artwork-123',
      user_token: 'test-user',
      edits: [
        {
          field_name: 'tags',
          field_value_old: null,
          field_value_new: JSON.stringify({ tourism: 'artwork', material: 'wood', artwork_type: 'statue' }), // JSON string format
        },
      ],
    };

    // Should work correctly
    const result = await artworkEditsService.submitArtworkEdit(structuredTagsEdit);
    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe('string');
  });
});
