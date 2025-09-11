/**
 * Integration Tests for Mass Import Artist Linking
 * 
 * Tests the complete artist linking workflow in the mass import endpoint,
 * including Vancouver-specific artist creation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processMassImport } from '../routes/mass-import';

// Mock environment for testing
const createMockEnv = () => {
  const mockArtists = new Map();
  const mockArtworkArtists = new Map();
  const mockArtwork = new Map();
  const mockLogbook = new Map();

  return {
    DB: {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          first: async () => {
            if (sql.includes('SELECT * FROM artists WHERE LOWER(TRIM(name)) = ?')) {
              const normalizedName = params[0];
              for (const [id, artist] of mockArtists.entries()) {
                if (artist.name.toLowerCase().trim() === normalizedName) {
                  return { id, name: artist.name };
                }
              }
              return null;
            }
            if (sql.includes('SELECT * FROM artwork_artists')) {
              return null; // Simplified for testing
            }
            return null;
          },
          all: async () => {
            if (sql.includes('SELECT a.id, a.name FROM artists a')) {
              const results = Array.from(mockArtists.entries()).map(([id, artist]) => ({
                id,
                name: artist.name
              }));
              return { results };
            }
            return { results: [] };
          },
          run: async () => {
            if (sql.includes('INSERT INTO artists')) {
              const artistId = `mock-artist-${Date.now()}`;
              mockArtists.set(artistId, {
                name: params[1],
                description: params[2],
                tags: params[3]
              });
              return { success: true, meta: { changes: 1 } };
            }
            if (sql.includes('INSERT INTO artwork_artists')) {
              const linkId = `mock-link-${Date.now()}`;
              mockArtworkArtists.set(linkId, {
                artwork_id: params[1],
                artist_id: params[2],
                role: params[3]
              });
              return { success: true, meta: { changes: 1 } };
            }
            if (sql.includes('INSERT INTO artwork')) {
              const artworkId = params[0];
              mockArtwork.set(artworkId, {
                id: artworkId,
                title: params[1],
                lat: params[3],
                lon: params[4]
              });
              return { success: true, meta: { changes: 1 } };
            }
            if (sql.includes('INSERT INTO logbook')) {
              const logbookId = params[0];
              mockLogbook.set(logbookId, {
                id: logbookId,
                artwork_id: params[1],
                note: params[2]
              });
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 1 } };
          }
        }),
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ success: true, meta: { changes: 1 } })
      }),
      exec: async () => ({ success: true })
    },
    // Add other required env properties
    PHOTOS_BUCKET: {},
    RATE_LIMITER: {},
    CONSENT_VERSION: '1.0'
  };
};

// Mock fetch to handle photo downloads
const mockFetch = vi.fn();
global.fetch = mockFetch;
global.crypto = {
  randomUUID: () => `mock-uuid-${Date.now()}-${Math.random()}`
} as any;

describe('Mass Import Artist Linking', () => {
  let mockEnv: any;

  beforeEach(async () => {
    mockEnv = createMockEnv();
    mockFetch.mockReset();
  });

  describe('General Import Behavior', () => {
    it('should provide search link when artist not found in general import', async () => {
      const payload = {
        user_uuid: 'test-user-123',
        artwork: {
          title: 'Test Artwork',
          lat: 49.2827,
          lon: -123.1207,
          created_by: 'Unknown Artist'
        }
      };

      const request = new Request('http://localhost/api/mass-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const mockContext = {
        req: request,
        env: mockEnv,
        executionCtx: {},
        json: (data: any, status?: number) => new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { 'Content-Type': 'application/json' }
        })
      };

      const response = await processMassImport(mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.artist_id).toBeUndefined();
      expect(data.data.artist_search_link).toBe('/search?artist=Unknown%20Artist');
      expect(data.data.artist_status).toBe('search_required');
    });
  });

  describe('Artist Name Sources', () => {
    it('should use artwork.created_by as primary artist source', async () => {
      const payload = {
        user_uuid: 'test-user-123',
        artwork: {
          title: 'Test Artwork',
          lat: 49.2827,
          lon: -123.1207,
          created_by: 'Primary Artist'
        },
        logbook: [{
          note: 'Test note',
          tags: [
            { label: 'artist', value: 'Secondary Artist' },
            { label: 'created_by', value: 'Tertiary Artist' }
          ]
        }]
      };

      const request = new Request('http://localhost/api/mass-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const mockContext = {
        req: request,
        env: mockEnv,
        executionCtx: {},
        json: (data: any, status?: number) => new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { 'Content-Type': 'application/json' }
        })
      };

      const response = await processMassImport(mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.artist_search_link).toBe('/search?artist=Primary%20Artist');
    });

    it('should skip artist linking when no artist name provided', async () => {
      const payload = {
        user_uuid: 'test-user-123',
        artwork: {
          title: 'Test Artwork',
          lat: 49.2827,
          lon: -123.1207
        }
      };

      const request = new Request('http://localhost/api/mass-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const mockContext = {
        req: request,
        env: mockEnv,
        executionCtx: {},
        json: (data: any, status?: number) => new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { 'Content-Type': 'application/json' }
        })
      };

      const response = await processMassImport(mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.artist_id).toBeUndefined();
      expect(data.data.artist_search_link).toBeUndefined();
      expect(data.data.artist_status).toBe('search_required');
    });
  });

  describe('Vancouver Import Behavior', () => {
    it('should create minimal artist when not in Vancouver data', async () => {
      const payload = {
        user_uuid: 'test-user-123',
        importer: 'vancouver-mass-import',
        artwork: {
          title: 'Test Vancouver Artwork',
          lat: 49.2827,
          lon: -123.1207,
          created_by: 'Unknown Vancouver Artist'
        }
      };

      const request = new Request('http://localhost/api/mass-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const mockContext = {
        req: request,
        env: mockEnv,
        executionCtx: {},
        json: (data: any, status?: number) => new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { 'Content-Type': 'application/json' }
        })
      };

      const response = await processMassImport(mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.artist_id).toBeDefined();
      expect(data.data.artist_status).toBe('created');
    });
  });
});