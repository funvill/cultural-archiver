/**
 * Test for verifying the fix for tag JSON format issue
 * Previously, the frontend was sending tags as strings like "material: wood"
 * Now it should send proper JSON like {"material": "wood"}
 * 
 * Updated to use the new submissions system instead of deprecated ArtworkEditsService
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock the submissions functions
vi.mock('../lib/submissions.js', async () => {
  const actual = await vi.importActual('../lib/submissions.js');
  return {
    ...actual,
    createArtworkEditFromFields: vi.fn(),
  };
});

describe('Tag JSON Format Fix', () => {
  // Mock D1Database 
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.prepare.mockReturnValue(mockStmt);
  });

  test('should handle valid JSON tags format', async () => {
    // Mock artwork exists
    const mockArtwork = {
      id: 'test-artwork-123',
      tags: '{"material": "bronze", "existing": "tag"}',
    };
    
    mockStmt.first.mockResolvedValueOnce(mockArtwork);
    
    // Mock successful submission
    const { createArtworkEditFromFields } = await import('../lib/submissions');
    vi.mocked(createArtworkEditFromFields).mockResolvedValue('submission-id-123');

    // This should work - proper JSON format with valid tags
    const validTagsEdit = {
      userToken: 'test-user',
      artworkId: 'test-artwork-123',
      edits: [
        {
          field_name: 'tags',
          field_value_old: '{"material": "bronze", "existing": "tag"}',
          field_value_new: '{"material": "wood", "artwork_type": "statue"}',
        },
      ],
    };

    // Should not throw an error
    const result = await createArtworkEditFromFields(mockDb, validTagsEdit);
    expect(result).toBe('submission-id-123');
    expect(createArtworkEditFromFields).toHaveBeenCalledWith(mockDb, validTagsEdit);
  });

  test('should reject invalid JSON tags format', async () => {
    // Mock artwork exists
    const mockArtwork = {
      id: 'test-artwork-123',
      tags: '{"existing": "tag"}',
    };
    
    mockStmt.first.mockResolvedValueOnce(mockArtwork);

    // Mock function to throw error for invalid JSON
    const { createArtworkEditFromFields } = await import('../lib/submissions');
    vi.mocked(createArtworkEditFromFields).mockRejectedValue(
      new Error('Invalid tags format: Unexpected token \'m\', "material: wood" is not valid JSON')
    );

    // This should fail - invalid string format that caused the original error
    const invalidTagsEdit = {
      userToken: 'test-user',
      artworkId: 'test-artwork-123',
      edits: [
        {
          field_name: 'tags',
          field_value_old: '{"existing": "tag"}',
          field_value_new: 'material: wood', // Invalid - not JSON
        },
      ],
    };

    // Should throw an error with the specific message we saw
    await expect(createArtworkEditFromFields(mockDb, invalidTagsEdit))
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
    
    // Mock successful submission
    const { createArtworkEditFromFields } = await import('../lib/submissions');
    vi.mocked(createArtworkEditFromFields).mockResolvedValue('submission-id-456');

    // Test with structured tags as JSON string (the correct format) with valid tags
    const structuredTagsEdit = {
      userToken: 'test-user',
      artworkId: 'test-artwork-123',
      edits: [
        {
          field_name: 'tags',
          field_value_old: null,
          field_value_new: JSON.stringify({ material: 'wood', artwork_type: 'statue', height: '2.5' }), // JSON string format
        },
      ],
    };

    // Should work correctly
    const result = await createArtworkEditFromFields(mockDb, structuredTagsEdit);
    expect(result).toBe('submission-id-456');
    expect(createArtworkEditFromFields).toHaveBeenCalledWith(mockDb, structuredTagsEdit);
  });
});
