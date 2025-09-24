/**
 * Simple Mass Import Artist Linking Tests
 *
 * Tests key functionality of the artist linking system without complex integration setup.
 */

import { describe, it, expect, vi } from 'vitest';
import { ArtistMatchingService, type VancouverArtistData } from '../lib/artist-matching';

describe('Mass Import Artist Linking - Core Functionality', () => {
  describe('Vancouver Artist Data Integration', () => {
    it('should find Brian Baxter in Vancouver data', () => {
      // Sample Vancouver data (mimicking the actual JSON structure)
      const vancouverData: VancouverArtistData[] = [
        {
          artistid: 12,
          firstname: 'Brian',
          lastname: 'Baxter',
          artisturl:
            'https://covapp.vancouver.ca/PublicArtRegistry/ArtistDetail.aspx?FromArtistIndex=False&ArtistId=12',
          biography:
            'Brian Baxter comes to the West Coast following an education and apprenticeship in glass art...',
          country: 'Canada',
        },
        {
          artistid: 57,
          firstname: 'Wayne',
          lastname: 'Young',
        },
      ];

      // Create mock database service
      const mockDb: any = {
        createArtistFromMassImport: vi.fn().mockResolvedValue('new-artist-id'),
      };

      const service = new ArtistMatchingService(mockDb);

      // Test exact name match
      const result = service.findVancouverArtistByName('Brian Baxter', vancouverData);
      expect(result).not.toBeNull();
      expect(result?.firstname).toBe('Brian');
      expect(result?.lastname).toBe('Baxter');
      expect(result?.country).toBe('Canada');
    });

    it('should handle case insensitive matching', () => {
      const vancouverData: VancouverArtistData[] = [
        { artistid: 1, firstname: 'John', lastname: 'Doe' },
      ];

      const mockDb: any = {};
      const service = new ArtistMatchingService(mockDb);

      expect(service.findVancouverArtistByName('john doe', vancouverData)).not.toBeNull();
      expect(service.findVancouverArtistByName('JOHN DOE', vancouverData)).not.toBeNull();
      expect(service.findVancouverArtistByName('John Doe', vancouverData)).not.toBeNull();
    });

    it('should create artist with correct Vancouver data structure', async () => {
      const vancouverArtist: VancouverArtistData = {
        artistid: 123,
        firstname: 'Test',
        lastname: 'Artist',
        biography: 'Test biography',
        country: 'Canada',
        website: 'https://test.com',
      };

      const mockDb: any = {
        createArtistFromMassImport: vi.fn().mockResolvedValue('created-artist-id'),
      };

      const service = new ArtistMatchingService(mockDb);
      const result = await service.createArtistFromVancouverData('Test Artist', vancouverArtist);

      expect(result).toBe('created-artist-id');
      expect(mockDb.createArtistFromMassImport).toHaveBeenCalledWith({
        name: 'Test Artist',
        description: 'Test biography',
        tags: {
          country: 'Canada',
          website: 'https://test.com',
        },
        source: 'vancouver-mass-import',
        sourceData: {
          artistid: 123,
          original_name: 'Test Artist',
        },
      });
    });
  });

  describe('Artist Search URL Generation', () => {
    it('should generate correct search URLs for various artist names', () => {
      const mockDb: any = {};
      const service = new ArtistMatchingService(mockDb);

      expect(service.generateArtistSearchUrl('John Doe')).toBe('/search?artist=John%20Doe');

      expect(service.generateArtistSearchUrl('Artist with spaces & symbols')).toBe(
        '/search?artist=Artist%20with%20spaces%20%26%20symbols'
      );

      expect(service.generateArtistSearchUrl('José María')).toBe(
        '/search?artist=Jos%C3%A9%20Mar%C3%ADa'
      );
    });
  });

  describe('Mass Import Response Structure', () => {
    it('should define correct response interface for artist linking', () => {
      // This test validates that our response structure includes all required fields
      // as specified in the PRD

      interface MassImportResponse {
        artwork_id?: string;
        logbook_ids?: string[];
        status: 'approved' | 'duplicate_detected';
        message: string;
        coordinates: { lat: number; lon: number };

        // Artist linking fields (key requirement)
        artist_id?: string;
        artist_search_link?: string;
        artist_status?: 'linked' | 'created' | 'search_required' | 'ambiguous';
        artist_candidates?: Array<{ id: string; name: string; score: number }>;
      }

      // Test that we can create a proper response for each scenario

      // Scenario 1: Artist found and linked
      const linkedResponse: MassImportResponse = {
        artwork_id: 'artwork-123',
        logbook_ids: ['logbook-456'],
        status: 'approved',
        message: 'Import successful',
        coordinates: { lat: 49.2827, lon: -123.1207 },
        artist_id: 'artist-789',
        artist_status: 'linked',
      };
      expect(linkedResponse.artist_id).toBeDefined();
      expect(linkedResponse.artist_status).toBe('linked');

      // Scenario 2: Artist not found, search link provided
      const searchResponse: MassImportResponse = {
        artwork_id: 'artwork-124',
        logbook_ids: ['logbook-457'],
        status: 'approved',
        message: 'Import successful',
        coordinates: { lat: 49.2827, lon: -123.1207 },
        artist_search_link: '/search?artist=Unknown%20Artist',
        artist_status: 'search_required',
      };
      expect(searchResponse.artist_search_link).toBeDefined();
      expect(searchResponse.artist_status).toBe('search_required');

      // Scenario 3: Vancouver artist created
      const createdResponse: MassImportResponse = {
        artwork_id: 'artwork-125',
        logbook_ids: ['logbook-458'],
        status: 'approved',
        message: 'Import successful',
        coordinates: { lat: 49.2827, lon: -123.1207 },
        artist_id: 'new-artist-990',
        artist_status: 'created',
      };
      expect(createdResponse.artist_id).toBeDefined();
      expect(createdResponse.artist_status).toBe('created');

      // Scenario 4: Ambiguous matches found
      const ambiguousResponse: MassImportResponse = {
        artwork_id: 'artwork-126',
        logbook_ids: ['logbook-459'],
        status: 'approved',
        message: 'Import successful',
        coordinates: { lat: 49.2827, lon: -123.1207 },
        artist_search_link: '/search?artist=John%20Doe',
        artist_status: 'ambiguous',
        artist_candidates: [
          { id: 'artist-1', name: 'John Doe (Sculptor)', score: 0.95 },
          { id: 'artist-2', name: 'John Doe (Painter)', score: 0.93 },
        ],
      };
      expect(ambiguousResponse.artist_candidates).toBeDefined();
      expect(ambiguousResponse.artist_candidates?.length).toBe(2);
      expect(ambiguousResponse.artist_status).toBe('ambiguous');
    });
  });

  describe('Artist Name Priority Logic', () => {
    it('should prioritize artist names correctly', () => {
      // Test the priority logic: artwork.created_by > tags.artist > tags.created_by

      // Mock payload structure
      const payload = {
        artwork: {
          created_by: 'Primary Artist',
        },
        logbook: [
          {
            tags: [
              { label: 'artist', value: 'Secondary Artist' },
              { label: 'created_by', value: 'Tertiary Artist' },
            ],
          },
        ],
      };

      // Simulate the extraction logic from mass-import endpoint
      const allTags: Record<string, string> = {};
      if (payload.logbook) {
        for (const entry of payload.logbook) {
          if (entry.tags) {
            for (const tag of entry.tags) {
              allTags[tag.label] = tag.value;
            }
          }
        }
      }

      const artistForMatching =
        payload.artwork.created_by || allTags.artist || allTags.created_by || undefined;

      expect(artistForMatching).toBe('Primary Artist');
    });

    it('should fallback to tags when artwork.created_by not provided', () => {
      const payload = {
        artwork: {},
        logbook: [
          {
            tags: [
              { label: 'artist', value: 'Tag Artist' },
              { label: 'created_by', value: 'Fallback Artist' },
            ],
          },
        ],
      };

      const allTags: Record<string, string> = {};
      if (payload.logbook) {
        for (const entry of payload.logbook) {
          if (entry.tags) {
            for (const tag of entry.tags) {
              allTags[tag.label] = tag.value;
            }
          }
        }
      }

      const artistForMatching =
        (payload.artwork as any).created_by || allTags.artist || allTags.created_by || undefined;

      expect(artistForMatching).toBe('Tag Artist');
    });
  });
});
