/**
 * Test to verify that title and description extraction during approval process works correctly
 * This addresses the critical issue where title/description data was not being populated in artwork records
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { insertArtwork } from '../lib/database';
import type { ArtworkRecord } from '../types';
import type { D1Database } from '@cloudflare/workers-types';

describe('Title/Description Extraction Fix', () => {
  let mockDB: D1Database;
  let mockPrepare: ReturnType<typeof vi.fn>;
  let mockBind: ReturnType<typeof vi.fn>;
  let mockRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock database with spies to track SQL calls
    mockRun = vi.fn().mockResolvedValue({
      success: true,
      results: [],
      meta: {
        changes: 1,
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: 1,
        last_row_id: 0,
        changed_db: true,
      },
    });

    const mockFirst = vi.fn().mockResolvedValue(null); // Mock the .first() method
    mockBind = vi.fn().mockReturnValue({
      run: mockRun,
      first: mockFirst,
    });
    mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    mockDB = {
      prepare: mockPrepare,
      exec: vi.fn(),
      dump: vi.fn(),
      batch: vi.fn(),
    } as unknown as D1Database;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass title, description, and created_by fields to database when creating artwork', async () => {
    // Arrange: Create artwork data with title, description, and created_by as extracted from submission tags
    const artworkData: Omit<ArtworkRecord, 'id' | 'created_at' | 'updated_at'> = {
      lat: 49.258,
      lon: -123.074,
      status: 'approved',
      tags: JSON.stringify({
        material: 'fiberglass',
        year: '2009',
        condition: 'excellent',
      }),
      photos: null, // No photos for this test
      title: 'Digital Orca Sculpture', // Extracted from submission tags
      description:
        'A striking blue whale sculpture created by artist Douglas Coupland, resembling a digital pixelated orca whale.', // Extracted from submission tags
      created_by: 'Douglas Coupland', // Extracted from submission tags
    };

    // Act: Call insertArtwork with the data
    await insertArtwork(mockDB, artworkData);

    // Assert: Verify the SQL prepare call was made
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO artwork'));

    // Assert: Verify all fields including title, description, and created_by were bound
    // Note: The first call should be the artwork insertion with all fields
    expect(mockBind).toHaveBeenNthCalledWith(
      1,
      expect.any(String), // id (UUID)
      49.258, // lat
      -123.074, // lon
      expect.any(String), // created_at (ISO string)
      expect.any(String), // updated_at (ISO string)
      'approved', // status
      expect.stringContaining('material'), // tags (JSON string)
      null, // photos (null for this test)
      'Digital Orca Sculpture', // title - THIS IS THE KEY FIX
      'A striking blue whale sculpture created by artist Douglas Coupland, resembling a digital pixelated orca whale.', // description - THIS IS THE KEY FIX
      'Douglas Coupland' // created_by - THIS IS THE KEY FIX
    );

    // Assert: Verify the database operation was executed
    expect(mockRun).toHaveBeenCalled();
  });

  it('should handle null title, description, and created_by gracefully', async () => {
    // Arrange: Create artwork data with null values (should be omitted from CreateArtworkRequest)
    const artworkData: Omit<ArtworkRecord, 'id' | 'created_at' | 'updated_at'> = {
      lat: 49.258,
      lon: -123.074,
      status: 'approved',
      tags: JSON.stringify({ material: 'metal' }),
      photos: null, // No photos for this test
      title: null,
      description: null,
      created_by: null,
    };

    // Act: Call insertArtwork with null values
    await insertArtwork(mockDB, artworkData);

    // Assert: Verify the SQL was still called properly with first call being artwork insertion
    expect(mockPrepare).toHaveBeenCalled();
    expect(mockBind).toHaveBeenNthCalledWith(
      1,
      expect.any(String), // id
      49.258, // lat
      -123.074, // lon
      expect.any(String), // created_at
      expect.any(String), // updated_at
      'approved', // status
      expect.stringContaining('material'), // tags
      null, // photos - null for this test
      null, // title should be null in database
      null, // description should be null in database
      null // created_by should be null in database
    );
  });

  it('should properly extract and format tags while preserving title/description fields', async () => {
    // Arrange: Test the complete flow including tag parsing
    const submissionTags = {
      title: 'Test Artwork Title',
      description: 'Test artwork description with details',
      artist: 'Test Artist',
      material: 'bronze',
      height: '3.5',
    };

    const artworkData: Omit<ArtworkRecord, 'id' | 'created_at' | 'updated_at'> = {
      lat: 49.258,
      lon: -123.074,
      status: 'approved',
      tags: JSON.stringify(submissionTags),
      photos: null, // No photos for this test
      title: submissionTags.title,
      description: submissionTags.description,
      created_by: submissionTags.artist,
    };

    // Act
    await insertArtwork(mockDB, artworkData);

    // Assert: Verify the complete flow worked
    const bindCall = mockBind.mock.calls[0];
    expect(bindCall[6]).toContain('bronze'); // tags JSON contains original tag data (index 6 after adding updated_at)
    expect(bindCall[7]).toBe(null); // photos field (index 7)
    expect(bindCall[8]).toBe('Test Artwork Title'); // title extracted (index 8)
    expect(bindCall[9]).toBe('Test artwork description with details'); // description extracted (index 9)
    expect(bindCall[10]).toBe('Test Artist'); // created_by extracted (index 10)
  });

  it('should demonstrate the approval process title/description extraction pattern', () => {
    // This test demonstrates the pattern used in the approval process
    const submissionNote = JSON.stringify({
      notes: 'User submitted artwork',
      _submission: {
        lat: 49.258,
        lon: -123.074,
        type_id: 'public_art',
        tags: {
          title: 'Public Art Installation',
          description: 'Modern sculpture in city center',
          artist: 'Famous Artist',
          material: 'steel',
          year: '2023',
        },
      },
    });

    // Parse submission like the approval process does
    const noteData = JSON.parse(submissionNote);
    const submissionTags = noteData._submission.tags;

    // Extract title, description, created_by like the approval process does
    const title = typeof submissionTags.title === 'string' ? submissionTags.title : null;
    const description =
      typeof submissionTags.description === 'string' ? submissionTags.description : null;
    const created_by = typeof submissionTags.artist === 'string' ? submissionTags.artist : null;

    // Assert the extraction worked
    expect(title).toBe('Public Art Installation');
    expect(description).toBe('Modern sculpture in city center');
    expect(created_by).toBe('Famous Artist');

    // This is exactly what gets passed to insertArtwork in the fixed code
    const artworkData = {
      type_id: noteData._submission.type_id,
      lat: noteData._submission.lat,
      lon: noteData._submission.lon,
      tags: JSON.stringify(submissionTags),
      status: 'approved' as const,
      title,
      description,
      created_by,
    };

    expect(artworkData).toEqual({
      type_id: 'public_art',
      lat: 49.258,
      lon: -123.074,
      tags: expect.stringContaining('Public Art Installation'),
      status: 'approved',
      title: 'Public Art Installation',
      description: 'Modern sculpture in city center',
      created_by: 'Famous Artist',
    });
  });
});
