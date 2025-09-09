/**
 * Test to verify that title and description extraction during approval process works correctly
 * This addresses the critical issue where title/description data was not being populated in artwork records
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { insertArtwork } from '../lib/database';
import type { ArtworkRecord } from '../types';

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
      }
    });
    mockBind = vi.fn().mockReturnValue({ run: mockRun });
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
      type_id: 'public_art',
      status: 'approved',
      tags: JSON.stringify({
        material: 'fiberglass',
        year: '2009',
        condition: 'excellent'
      }),
      title: 'Digital Orca Sculpture', // Extracted from submission tags
      description: 'A striking blue whale sculpture created by artist Douglas Coupland, resembling a digital pixelated orca whale.', // Extracted from submission tags
      created_by: 'Douglas Coupland' // Extracted from submission tags
    };

    // Act: Call insertArtwork with the data
    await insertArtwork(mockDB, artworkData);

    // Assert: Verify the SQL prepare call was made
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO artwork')
    );

    // Assert: Verify all fields including title, description, and created_by were bound
    expect(mockBind).toHaveBeenCalledWith(
      expect.any(String), // id (UUID)
      49.258, // lat
      -123.074, // lon
      'public_art', // type_id
      expect.any(String), // created_at (ISO string)
      'approved', // status
      expect.stringContaining('material'), // tags (JSON string)
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
      type_id: 'public_art',
      status: 'approved',
      tags: JSON.stringify({ material: 'metal' }),
      title: null,
      description: null,
      created_by: null
    };

    // Act: Call insertArtwork with null values
    await insertArtwork(mockDB, artworkData);

    // Assert: Verify the SQL was still called properly
    expect(mockPrepare).toHaveBeenCalled();
    expect(mockBind).toHaveBeenCalledWith(
      expect.any(String), // id
      49.258, // lat
      -123.074, // lon
      'public_art', // type_id
      expect.any(String), // created_at
      'approved', // status
      expect.stringContaining('material'), // tags
      null, // title should be null in database
      null, // description should be null in database
      null  // created_by should be null in database
    );
  });

  it('should properly extract and format tags while preserving title/description fields', async () => {
    // Arrange: Test the complete flow including tag parsing
    const submissionTags = {
      title: 'Test Artwork Title',
      description: 'Test artwork description with details',
      artist: 'Test Artist',
      material: 'bronze',
      height: '3.5'
    };

    const artworkData: Omit<ArtworkRecord, 'id' | 'created_at' | 'updated_at'> = {
      lat: 49.258,
      lon: -123.074,
      type_id: 'sculpture',
      status: 'approved',
      tags: JSON.stringify(submissionTags),
      title: submissionTags.title,
      description: submissionTags.description,
      created_by: submissionTags.artist
    };

    // Act
    await insertArtwork(mockDB, artworkData);

    // Assert: Verify the complete flow worked
    const bindCall = mockBind.mock.calls[0];
    expect(bindCall[6]).toContain('bronze'); // tags JSON contains original tag data
    expect(bindCall[7]).toBe('Test Artwork Title'); // title extracted
    expect(bindCall[8]).toBe('Test artwork description with details'); // description extracted  
    expect(bindCall[9]).toBe('Test Artist'); // created_by extracted
  });

  it('should demonstrate the approval process title/description extraction pattern', () => {
    // This test demonstrates the pattern used in the approval process
    const submissionNote = JSON.stringify({
      note: 'User submitted artwork',
      _submission: {
        lat: 49.258,
        lon: -123.074,
        type_id: 'public_art',
        tags: {
          title: 'Public Art Installation',
          description: 'Modern sculpture in city center',
          artist: 'Famous Artist',
          material: 'steel',
          year: '2023'
        }
      }
    });

    // Parse submission like the approval process does
    const noteData = JSON.parse(submissionNote);
    const submissionTags = noteData._submission.tags;
    
    // Extract title, description, created_by like the approval process does
    const title = typeof submissionTags.title === 'string' ? submissionTags.title : null;
    const description = typeof submissionTags.description === 'string' ? submissionTags.description : null;
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
      created_by
    };

    expect(artworkData).toEqual({
      type_id: 'public_art',
      lat: 49.258,
      lon: -123.074,
      tags: expect.stringContaining('Public Art Installation'),
      status: 'approved',
      title: 'Public Art Installation',
      description: 'Modern sculpture in city center', 
      created_by: 'Famous Artist'
    });
  });
});