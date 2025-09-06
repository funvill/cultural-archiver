/**
 * Integration tests for Export routes and OSM functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { WorkerEnv } from '../../types';
import { exportArtworkToOSM } from '../artwork';
import { bulkExportToOSM, getExportStats } from '../export';

describe('Export Integration Tests', () => {
  let app: Hono<{ Bindings: WorkerEnv }>;
  let mockEnv: WorkerEnv;
  let mockDB: any;

  beforeEach(() => {
    app = new Hono();
    
    // Create persistent mock methods to avoid recreation issues
    const mockFirst = vi.fn();
    const mockAll = vi.fn();
    const mockBind = vi.fn().mockReturnValue({
      first: mockFirst,
      all: mockAll,
    });
    
    const mockStatement = {
      bind: mockBind,
      first: mockFirst,
      all: mockAll,
    };
    
    // Mock database
    mockDB = {
      prepare: vi.fn().mockReturnValue(mockStatement),
    };

    mockEnv = {
      DB: mockDB,
      FRONTEND_URL: 'http://localhost:5173',
      ENVIRONMENT: 'test',
      PHOTOS_BUCKET: {},
    } as WorkerEnv;
  });

  describe('Individual Artwork Export', () => {
    it('should export single artwork in JSON format', async () => {
      const mockArtwork = {
        id: 'artwork-123',
        lat: 49.2827,
        lon: -123.1207,
        status: 'approved',
        tags: JSON.stringify({
          tags: {
            tourism: 'artwork',
            artwork_type: 'statue',
            name: 'Victory Angel',
            artist_name: 'Jane Doe',
          },
          version: '1.0.0',
        }),
        created_at: '2024-01-01T00:00:00.000Z',
        type_id: 1,
        notes: 'Test artwork',
        title: null,
        description: null,
        created_by: null,
      };

      mockDB.prepare().first.mockResolvedValue(mockArtwork);

      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue('artwork-123'),
          query: vi.fn().mockReturnValue({}),
        },
        env: mockEnv,
        json: vi.fn((data) => Response.json(data)),
      };

      const response = await exportArtworkToOSM(mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.data.artworks).toHaveLength(1);
      expect(data.data.data.artworks[0]).toMatchObject({
        id: 'artwork-123',
        lat: 49.2827,
        lon: -123.1207,
        osm_tags: expect.objectContaining({
          tourism: 'artwork',
          artwork_type: 'statue',
          name: 'Victory Angel',
          artist_name: 'Jane Doe',
        }),
      });
    });

    it('should export single artwork in XML format', async () => {
      const mockArtwork = {
        id: 'artwork-123',
        lat: 49.2827,
        lon: -123.1207,
        status: 'approved',
        tags: JSON.stringify({
          tags: {
            tourism: 'artwork',
            name: 'Test Art',
          },
          version: '1.0.0',
        }),
        created_at: '2024-01-01T00:00:00.000Z',
        type_id: 1,
        notes: 'Test artwork',
        title: null,
        description: null,
        created_by: null,
      };

      mockDB.prepare().first.mockResolvedValue(mockArtwork);

      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue('artwork-123'),
          query: vi.fn().mockReturnValue({ format: 'xml' }),
        },
        env: mockEnv,
        json: vi.fn((data) => Response.json(data)),
      };

      const response = await exportArtworkToOSM(mockContext as any);
      const xmlContent = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/xml');
      expect(response.headers.get('Content-Disposition')).toContain('artwork-123.osm');
      expect(xmlContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xmlContent).toContain('<node');
      expect(xmlContent).toContain('lat="49.2827"');
      expect(xmlContent).toContain('lon="-123.1207"');
      expect(xmlContent).toContain('<tag k="tourism" v="artwork"');
      expect(xmlContent).toContain('<tag k="name" v="Test Art"');
    });

    it('should return validation results for validation format', async () => {
      const mockArtwork = {
        id: 'artwork-123',
        lat: 49.2827,
        lon: -123.1207,
        status: 'approved',
        tags: JSON.stringify({
          tags: {
            tourism: 'artwork',
          },
          version: '1.0.0',
        }),
        created_at: '2024-01-01T00:00:00.000Z',
        type_id: 1,
        notes: 'Test artwork',
        title: null,
        description: null,
        created_by: null,
      };

      mockDB.prepare().first.mockResolvedValue(mockArtwork);

      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue('artwork-123'),
          query: vi.fn().mockReturnValue({ format: 'validation' }),
        },
        env: mockEnv,
        json: vi.fn((data) => Response.json(data)),
      };

      const response = await exportArtworkToOSM(mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.artwork_id).toBe('artwork-123');
      expect(data.data.valid).toBe(true);
      expect(Array.isArray(data.data.errors)).toBe(true);
      expect(Array.isArray(data.data.warnings)).toBe(true);
    });

    it('should return 404 for non-existent artwork', async () => {
      mockDB.prepare().first.mockResolvedValue(null);

      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue('non-existent'),
          query: vi.fn().mockReturnValue({}),
        },
        env: mockEnv,
      };

      await expect(exportArtworkToOSM(mockContext as any)).rejects.toThrow();
    });
  });

  describe('Bulk Export', () => {
    const mockArtworks = [
      {
        id: 'artwork-1',
        lat: 49.2827,
        lon: -123.1207,
        status: 'approved',
        tags: JSON.stringify({
          tags: { tourism: 'artwork', name: 'Art 1' },
          version: '1.0.0',
        }),
        created_at: '2024-01-01T00:00:00.000Z',
        type_id: 1,
        notes: 'Test',
        title: null,
        description: null,
        created_by: null,
      },
      {
        id: 'artwork-2',
        lat: 49.2828,
        lon: -123.1208,
        status: 'approved',
        tags: JSON.stringify({
          tags: { tourism: 'artwork', name: 'Art 2' },
          version: '1.0.0',
        }),
        created_at: '2024-01-02T00:00:00.000Z',
        type_id: 1,
        notes: 'Test 2',
        title: null,
        description: null,
        created_by: null,
      },
    ];

    it('should export all artworks when no filters provided', async () => {
      // Mock the database query to return artworks
      const mockStatement = mockDB.prepare();
      const mockChainedStatement = mockStatement.bind();
      mockChainedStatement.all.mockResolvedValue({ results: mockArtworks });

      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({}),
        },
        env: mockEnv,
        json: vi.fn((data) => Response.json(data)),
        json: vi.fn((data) => Response.json(data)),
        json: vi.fn((data) => Response.json(data)),
        json: vi.fn((data) => Response.json(data)),
        json: vi.fn((data) => Response.json(data)),
        json: vi.fn((data) => Response.json(data)),
        json: vi.fn((data) => Response.json(data)),
        json: vi.fn((data) => Response.json(data)),
      };

      const response = await bulkExportToOSM(mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.data.artworks).toHaveLength(2);
      expect(data.data.data.metadata.total_artworks).toBe(2);
    });

    it('should export artworks by specific IDs', async () => {
      // Mock the database query to return specific artwork
      const mockStatement = mockDB.prepare();
      const mockChainedStatement = mockStatement.bind();
      mockChainedStatement.all.mockResolvedValue({ results: [mockArtworks[0]] });

      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({ 
            artwork_ids: 'artwork-1',
            format: 'json',
          }),
        },
        env: mockEnv,
        json: vi.fn((data) => {
          const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          });
          response.json = async () => data;
          return response;
        }),
      };

      const response = await bulkExportToOSM(mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.data.artworks).toHaveLength(1);
      expect(data.data.data.artworks[0].id).toBe('artwork-1');
    });

    it('should export artworks within geographic bounds', async () => {
      // Mock the database query to return artworks within bounds
      const mockStatement = mockDB.prepare();
      const mockChainedStatement = mockStatement.bind();
      mockChainedStatement.all.mockResolvedValue({ results: mockArtworks });

      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({ 
            bounds: '49.29,-123.11,49.28,-123.12',
            format: 'json',
          }),
        },
        env: mockEnv,
        json: vi.fn((data) => {
          const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          });
          response.json = async () => data;
          return response;
        }),
      };

      const response = await bulkExportToOSM(mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should export as XML format', async () => {
      // Mock the database query to return artworks
      const mockStatement = mockDB.prepare();
      const mockChainedStatement = mockStatement.bind();
      mockChainedStatement.all.mockResolvedValue({ results: mockArtworks });

      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({ format: 'xml' }),
        },
        env: mockEnv,
        json: vi.fn((data) => {
          const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          });
          response.json = async () => data;
          return response;
        }),
      };

      const response = await bulkExportToOSM(mockContext as any);
      const xmlContent = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/xml');
      expect(response.headers.get('Content-Disposition')).toContain('.osm');
      expect(xmlContent).toContain('<osm version="0.6"');
      expect(xmlContent).toContain('<node');
      expect(xmlContent).toContain('</osm>');
    });

    it('should validate bounds parameters', async () => {
      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({ 
            bounds: 'invalid-bounds',
          }),
        },
        env: mockEnv,
      };

      await expect(bulkExportToOSM(mockContext as any)).rejects.toThrow();
    });

    it('should enforce limits', async () => {
      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({ 
            limit: '15000', // Over the 10,000 limit
          }),
        },
        env: mockEnv,
      };

      await expect(bulkExportToOSM(mockContext as any)).rejects.toThrow();
    });
  });

  describe('Export Statistics', () => {
    it('should return export statistics', async () => {
      const mockCountResult = { total: 100 };
      const mockSampleResult = { 
        results: Array(10).fill(null).map((_, i) => ({
          id: `artwork-${i}`,
          lat: 49.28,
          lon: -123.12,
          status: 'approved',
          tags: JSON.stringify({
            tags: { tourism: 'artwork', name: `Art ${i}` },
            version: '1.0.0',
          }),
          created_at: '2024-01-01T00:00:00.000Z',
          type_id: 1,
          notes: 'Test',
          title: null,
          description: null,
          created_by: null,
        })),
      };

      // Mock the database queries for statistics - first call gets count, second gets sample
      const mockStatement1 = mockDB.prepare();
      const mockChainedStatement1 = mockStatement1.bind();
      mockChainedStatement1.first.mockResolvedValueOnce(mockCountResult);

      const mockStatement2 = mockDB.prepare();
      const mockChainedStatement2 = mockStatement2.bind();
      mockChainedStatement2.all.mockResolvedValueOnce(mockSampleResult);

      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({}),
        },
        env: mockEnv,
        json: vi.fn((data) => {
          const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          });
          response.json = async () => data;
          return response;
        }),
      };

      const response = await getExportStats(mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total_artworks).toBe(100);
      expect(data.data.sample_size).toBe(10);
      expect(data.data.validation_summary).toBeDefined();
      expect(data.data.validation_summary.valid_artworks).toBeDefined();
      expect(data.data.export_estimates).toBeDefined();
    });

    it('should handle bounds in statistics', async () => {
      const mockCountResult = { total: 50 };
      const mockSampleResult = { results: [] };

      // Mock the database queries for statistics with bounds - first call gets count, second gets sample  
      const mockStatement1 = mockDB.prepare();
      const mockChainedStatement1 = mockStatement1.bind();
      mockChainedStatement1.first.mockResolvedValueOnce(mockCountResult);

      const mockStatement2 = mockDB.prepare();
      const mockChainedStatement2 = mockStatement2.bind();
      mockChainedStatement2.all.mockResolvedValueOnce(mockSampleResult);

      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({
            bounds: '49.29,-123.11,49.28,-123.12',
          }),
        },
        env: mockEnv,
        json: vi.fn((data) => {
          const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          });
          response.json = async () => data;
          return response;
        }),
      };

      const response = await getExportStats(mockContext as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total_artworks).toBe(50);
    });

    it('should validate bounds in statistics endpoint', async () => {
      const mockContext = {
        req: {
          query: vi.fn().mockReturnValue({
            bounds: 'invalid',
          }),
        },
        env: mockEnv,
      };

      await expect(getExportStats(mockContext as any)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDB.prepare().first.mockRejectedValue(new Error('Database error'));

      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue('artwork-123'),
          query: vi.fn().mockReturnValue({}),
        },
        env: mockEnv,
      };

      await expect(exportArtworkToOSM(mockContext as any)).rejects.toThrow();
    });

    it('should validate format parameters', async () => {
      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue('artwork-123'),
          query: vi.fn().mockReturnValue({ format: 'invalid' }),
        },
        env: mockEnv,
      };

      await expect(exportArtworkToOSM(mockContext as any)).rejects.toThrow();
    });
  });
});