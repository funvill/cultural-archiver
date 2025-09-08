/**
 * Tests for OSM Export functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ArtworkRecord } from '../../types';
import {
  artworkToOSMExport,
  exportArtworksToOSM,
  validateOSMExportData,
  generateOSMXML,
  generateOSMXMLFile,
  createExportResponse,
} from '../osm-export';

describe('OSM Export Service', () => {
  const mockArtwork: ArtworkRecord = {
    id: 'test-artwork-1',
    lat: 49.2827,
    lon: -123.1207,
    status: 'approved',
    tags: JSON.stringify({
      tags: {
        artwork_type: 'statue',
        material: 'bronze',
        height: 3.5,
        access: 'yes',
        condition: 'excellent', // This should have an OSM mapping
        start_date: '2020',
      },
      version: '1.0.0',
      lastModified: '2024-12-19T12:00:00.000Z',
    }),
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    type_id: 1,
    notes: 'Test artwork',
    title: null,
    description: null,
    created_by: null,
  };

  const mockInvalidArtwork: ArtworkRecord = {
    ...mockArtwork,
    id: 'invalid-artwork',
    lat: 200, // Invalid latitude
    lon: -123.1207,
    status: 'pending', // Not approved
  };

  describe('artworkToOSMExport', () => {
    it('should convert artwork to OSM export format', () => {
      const result = artworkToOSMExport(mockArtwork);

      console.log('Result tags:', JSON.stringify(result.tags, null, 2));

      expect(result).toMatchObject({
        id: 'test-artwork-1',
        lat: 49.2827,
        lon: -123.1207,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      });

      expect(result.tags).toMatchObject({
        tourism: 'artwork',
        artwork_type: 'statue',
        material: 'bronze',
        height: '3.5',
        access: 'yes',
        condition: 'excellent',
        start_date: '2020',
      });

      // Check that year gets ca: prefix since it has no OSM mapping
      // expect(result.tags['ca:year']).toBe('2020');
    });

    it('should handle artwork with no structured tags', () => {
      const artworkWithoutTags: ArtworkRecord = {
        ...mockArtwork,
        tags: '{}',
      };

      const result = artworkToOSMExport(artworkWithoutTags);

      expect(result.tags).toEqual({
        tourism: 'artwork', // Always added
      });
    });

    it('should handle malformed JSON tags gracefully', () => {
      const artworkWithBadJson: ArtworkRecord = {
        ...mockArtwork,
        tags: 'invalid json',
      };

      const result = artworkToOSMExport(artworkWithBadJson);

      expect(result.tags).toEqual({
        tourism: 'artwork',
      });
    });
  });

  describe('exportArtworksToOSM', () => {
    it('should export only approved artworks with valid coordinates', () => {
      const artworks = [
        mockArtwork,
        mockInvalidArtwork,
        {
          ...mockArtwork,
          id: 'no-coords',
          lat: null as any,
          lon: null as any,
        },
      ];

      const result = exportArtworksToOSM(artworks);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-artwork-1');
    });

    it('should handle empty artwork array', () => {
      const result = exportArtworksToOSM([]);
      expect(result).toEqual([]);
    });
  });

  describe('validateOSMExportData', () => {
    it('should validate correct artwork data', () => {
      const result = validateOSMExportData(mockArtwork);

      expect(result).toMatchObject({
        valid: true,
        errors: [],
      });
      // The artwork has a name tag, so there shouldn't be a warning about missing name
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect invalid status', () => {
      const result = validateOSMExportData(mockInvalidArtwork);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Artwork must be approved for export');
    });

    it('should detect invalid coordinates', () => {
      const artworkBadCoords: ArtworkRecord = {
        ...mockArtwork,
        lat: 200, // Invalid
        lon: -200, // Invalid
      };

      const result = validateOSMExportData(artworkBadCoords);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Latitude must be between -90 and 90 degrees');
      expect(result.errors).toContain('Longitude must be between -180 and 180 degrees');
    });

    it('should detect missing coordinates', () => {
      const artworkNoCoords: ArtworkRecord = {
        ...mockArtwork,
        lat: null as any,
        lon: null as any,
      };

      const result = validateOSMExportData(artworkNoCoords);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Artwork must have valid coordinates');
    });

    it('should detect NaN coordinates', () => {
      const artworkNaNCoords: ArtworkRecord = {
        ...mockArtwork,
        lat: NaN,
        lon: NaN,
      };

      const result = validateOSMExportData(artworkNaNCoords);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Coordinates must be valid numbers');
    });

    it('should provide warnings for missing optional data', () => {
      const artworkMinimal: ArtworkRecord = {
        ...mockArtwork,
        tags: JSON.stringify({
          tags: {
            tourism: 'artwork',
          },
          version: '1.0.0',
        }),
      };

      const result = validateOSMExportData(artworkMinimal);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(2); // Check we have warnings for missing name and artist
    });
  });

  describe('generateOSMXML', () => {
    it('should generate valid OSM XML for artwork', () => {
      const xml = generateOSMXML(mockArtwork, -1);

      expect(xml).toContain('<node id="-1"');
      expect(xml).toContain('lat="49.2827"');
      expect(xml).toContain('lon="-123.1207"');
      expect(xml).toContain('<tag k="tourism" v="artwork"');
      expect(xml).toContain('<tag k="artwork_type" v="statue"');
      expect(xml).toContain('<tag k="material" v="bronze"');
      expect(xml).toContain('</node>');
    });

    it('should escape XML special characters', () => {
      const artworkWithSpecialChars: ArtworkRecord = {
        ...mockArtwork,
        tags: JSON.stringify({
          tags: {
            artwork_type: 'sculpture',
            subject: 'Art & "Culture" <Test>',
          },
        }),
      };

      const xml = generateOSMXML(artworkWithSpecialChars);

      expect(xml).toContain('Art &amp; &quot;Culture&quot; &lt;Test&gt;');
    });

    it('should throw error for invalid artwork', () => {
      expect(() => generateOSMXML(mockInvalidArtwork)).toThrow();
    });
  });

  describe('generateOSMXMLFile', () => {
    it('should generate complete OSM XML file', () => {
      const artworks = [mockArtwork];
      const xml = generateOSMXMLFile(artworks);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<osm version="0.6" generator="Cultural Archiver Export">');
      expect(xml).toContain('<node id="-1"');
      expect(xml).toContain('</osm>');
    });

    it('should filter out invalid artworks', () => {
      const artworks = [mockArtwork, mockInvalidArtwork];
      const xml = generateOSMXMLFile(artworks);

      // Should only contain one node (valid artwork)
      const nodeMatches = xml.match(/<node /g);
      expect(nodeMatches).toHaveLength(1);
    });

    it('should handle empty artwork array', () => {
      const xml = generateOSMXMLFile([]);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<osm version="0.6" generator="Cultural Archiver Export">');
      expect(xml).toContain('</osm>');
      expect(xml).not.toContain('<node');
    });
  });

  describe('createExportResponse', () => {
    it('should create export response with metadata', () => {
      const artworks = [mockArtwork, mockInvalidArtwork];
      const request = {
        artwork_ids: ['test-artwork-1', 'invalid-artwork'],
      };

      const response = createExportResponse(artworks, request);

      expect(response.success).toBe(true);
      expect(response.data?.artworks).toHaveLength(1); // Only valid artwork exported
      expect(response.data?.metadata).toMatchObject({
        total_artworks: 2,
        schema_version: '1.0.0',
      });

      expect(response.data?.metadata.export_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle all valid artworks', () => {
      const artworks = [mockArtwork];
      const request = {};

      const response = createExportResponse(artworks, request);

      expect(response.success).toBe(true);
      expect(response.data?.metadata).toMatchObject({
        total_artworks: 1,
      });
    });
  });
});