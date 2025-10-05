import { describe, it, expect } from 'vitest';
import {
  parseOSMGeoJSON,
  DEFAULT_OSM_CONFIG,
  type OSMGeoJSON,
  type OSMImportConfig,
  generateImportSummary,
  type OSMFeature,
} from '../lib/osm-mass-import';

/**
 * Test fixtures and utilities
 */
const createTestFeature = (overrides: Partial<OSMFeature> = {}): OSMFeature => ({
  type: 'Feature' as const,
  id: 'node/123456789',
  properties: {
    osm_type: 'node' as const,
    osm_id: 123456789,
    tourism: 'artwork' as const,
    name: 'Test Artwork',
    artist_name: 'Test Artist',
    artwork_type: 'sculpture',
    material: 'bronze',
    ...overrides.properties,
  },
  geometry: {
    type: 'Point' as const,
    coordinates: [-123.123, 49.123],
  },
  ...overrides,
});

const createTestGeoJSON = (features: OSMFeature[] = [createTestFeature()]): OSMGeoJSON => ({
  type: 'FeatureCollection',
  features,
});

describe('OSM Mass Import Parser', () => {
  describe('parseOSMGeoJSON', () => {
    it('should parse valid OSM GeoJSON with default config', () => {
      const geoJSON = createTestGeoJSON();
      const result = parseOSMGeoJSON(geoJSON);

      expect(result.total).toBe(1);
      expect(result.valid).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.payloads).toHaveLength(1);

      const payload = result.payloads[0];
      expect(payload.user_uuid).toBe(DEFAULT_OSM_CONFIG.user_uuid);
      expect(payload.importer).toBe('osm-geojson-importer');
      expect(payload.artwork.title).toBe('Test Artwork');
      expect(payload.artwork.lat).toBe(49.123);
      expect(payload.artwork.lon).toBe(-123.123);
      expect(payload.artwork.created_by).toBe('Test Artist');
    });

    it('should apply custom configuration', () => {
      const geoJSON = createTestGeoJSON();
      const customConfig: Partial<OSMImportConfig> = {
        duplicateThreshold: 0.9,
        attribution: {
          source: 'Custom Source',
          license: 'Custom License',
          attribution_text: 'Custom Attribution',
        },
      };

      const result = parseOSMGeoJSON(geoJSON, customConfig);
      const payload = result.payloads[0];

      expect(payload.duplicateThreshold).toBe(0.9);

      const sourceTags = payload.logbook![0].tags!;
      expect(sourceTags.find(t => t.label === 'Source')?.value).toBe('Custom Source');
      expect(sourceTags.find(t => t.label === 'License')?.value).toBe('Custom License');
      expect(sourceTags.find(t => t.label === 'Attribution')?.value).toBe('Custom Attribution');
    });

    it('should handle features with missing names when skipIncomplete is true', () => {
      const featureWithoutName = createTestFeature({
        properties: { osm_type: 'node', osm_id: 123, tourism: 'artwork' },
      });
      const geoJSON = createTestGeoJSON([featureWithoutName]);

      const result = parseOSMGeoJSON(geoJSON, {
        validation: { requireName: true, requireCoordinates: true, skipIncomplete: true },
      });

      expect(result.total).toBe(1);
      expect(result.valid).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should throw error for missing name when skipIncomplete is false', () => {
      const featureWithoutName = createTestFeature({
        properties: { osm_type: 'node', osm_id: 123, tourism: 'artwork' },
      });
      const geoJSON = createTestGeoJSON([featureWithoutName]);

      const result = parseOSMGeoJSON(geoJSON, {
        validation: { requireName: true, requireCoordinates: true, skipIncomplete: false },
      });

      expect(result.total).toBe(1);
      expect(result.valid).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Missing required field: name');
    });

    it('should handle invalid coordinates', () => {
      const featureWithBadCoords = createTestFeature({
        geometry: { type: 'Point', coordinates: [999, 999] },
      });
      const geoJSON = createTestGeoJSON([featureWithBadCoords]);

      const result = parseOSMGeoJSON(geoJSON, {
        validation: { requireName: true, requireCoordinates: true, skipIncomplete: false },
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Invalid coordinates');
    });

    it('should map OSM properties to structured tags', () => {
      const featureWithRichData = createTestFeature({
        properties: {
          osm_type: 'node',
          osm_id: 123456789,
          tourism: 'artwork',
          name: 'Rich Artwork',
          artist_name: 'Famous Artist',
          artwork_type: 'mural',
          material: 'paint',
          website: 'https://example.com',
          inscription: 'In memory of...',
          start_date: '1995',
          custom_field: 'custom_value',
        },
      });
      const geoJSON = createTestGeoJSON([featureWithRichData]);

      const result = parseOSMGeoJSON(geoJSON);
      const tags = result.payloads[0].logbook![0].tags!;

      // Check required attribution tags
      expect(tags.find(t => t.label === 'Source')?.value).toBe('OpenStreetMap');
      expect(tags.find(t => t.label === 'External ID')?.value).toBe('node/123456789');

      // Check mapped property tags
      expect(tags.find(t => t.label === 'Artwork Type')?.value).toBe('mural');
      expect(tags.find(t => t.label === 'Material')?.value).toBe('paint');
      expect(tags.find(t => t.label === 'Website')?.value).toBe('https://example.com');
      expect(tags.find(t => t.label === 'Inscription')?.value).toBe('In memory of...');
      expect(tags.find(t => t.label === 'Created Date')?.value).toBe('1995');

      // Check custom field mapping
      expect(tags.find(t => t.label === 'Custom Field')?.value).toBe('custom_value');
    });

    it('should handle multiple features with mixed validity', () => {
      const validFeature = createTestFeature();
      const invalidFeature = createTestFeature({
        properties: { osm_type: 'node', osm_id: 456 }, // missing name
      });
      const anotherValidFeature = createTestFeature({
        id: 'way/789',
        properties: {
          osm_type: 'way',
          osm_id: 789,
          tourism: 'artwork',
          name: 'Another Artwork',
        },
      });

      const geoJSON = createTestGeoJSON([validFeature, invalidFeature, anotherValidFeature]);

      const result = parseOSMGeoJSON(geoJSON);

      expect(result.total).toBe(3);
      expect(result.valid).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.payloads).toHaveLength(2);

      expect(result.payloads[0].artwork.title).toBe('Test Artwork');
      expect(result.payloads[1].artwork.title).toBe('Another Artwork');
    });

    it('should use fallback title when name is missing but skipIncomplete is false', () => {
      const featureWithoutName = createTestFeature({
        properties: {
          osm_type: 'node',
          osm_id: 123,
          tourism: 'artwork',
          artist_name: 'Some Artist',
        },
      });
      const geoJSON = createTestGeoJSON([featureWithoutName]);

      const result = parseOSMGeoJSON(geoJSON, {
        validation: { requireName: false, requireCoordinates: true, skipIncomplete: false },
      });

      expect(result.valid).toBe(1);
      expect(result.payloads[0].artwork.title).toBe('Untitled Artwork');
      expect(result.payloads[0].artwork.created_by).toBe('Some Artist');
    });
  });

  describe('generateImportSummary', () => {
    it('should generate comprehensive summary', () => {
      const result = {
        total: 100,
        valid: 85,
        skipped: 10,
        errors: [
          { feature_id: 'node/1', error: 'Missing name' },
          { feature_id: 'node/2', error: 'Invalid coordinates' },
          { feature_id: 'way/3', error: 'Processing failed' },
        ],
        payloads: [],
      };

      const summary = generateImportSummary(result);

      expect(summary).toContain('Total features: 100');
      expect(summary).toContain('Valid imports: 85 (85.0%)');
      expect(summary).toContain('Skipped: 10');
      expect(summary).toContain('Errors: 3');
      expect(summary).toContain('Error details:');
      expect(summary).toContain('node/1: Missing name');
      expect(summary).toContain('way/3: Processing failed');
    });

    it('should handle perfect success case', () => {
      const result = {
        total: 50,
        valid: 50,
        skipped: 0,
        errors: [],
        payloads: [],
      };

      const summary = generateImportSummary(result);

      expect(summary).toContain('Valid imports: 50 (100.0%)');
      expect(summary).toContain('Skipped: 0');
      expect(summary).toContain('Errors: 0');
      expect(summary).not.toContain('Error details:');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty feature collection', () => {
      const geoJSON = createTestGeoJSON([]);
      const result = parseOSMGeoJSON(geoJSON);

      expect(result.total).toBe(0);
      expect(result.valid).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.payloads).toHaveLength(0);
    });

    it('should handle feature with null properties', () => {
      const featureWithNullProps = createTestFeature({
        properties: null,
      });
      const geoJSON = createTestGeoJSON([featureWithNullProps]);

      const result = parseOSMGeoJSON(geoJSON);

      expect(result.total).toBe(1);
      expect(result.valid).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('should handle way and relation features with center coordinates', () => {
      const wayFeature = {
        type: 'Feature' as const,
        id: 'way/456',
        properties: {
          osm_type: 'way' as const,
          osm_id: 456,
          tourism: 'artwork' as const,
          name: 'Way Artwork',
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [-123.456, 49.456],
        },
      };

      const geoJSON = createTestGeoJSON([wayFeature]);
      const result = parseOSMGeoJSON(geoJSON);

      expect(result.valid).toBe(1);
      expect(result.payloads[0].artwork.title).toBe('Way Artwork');
      expect(result.payloads[0].artwork.lat).toBe(49.456);
      expect(result.payloads[0].artwork.lon).toBe(-123.456);
    });

    it('should handle features with extensive tag collections', () => {
      const featureWithManyTags = createTestFeature({
        properties: {
          osm_type: 'node',
          osm_id: 123,
          tourism: 'artwork',
          name: 'Complex Artwork',
          artist_name: 'Multi Artist',
          artwork_type: 'installation',
          material: 'mixed_media',
          website: 'https://art.example.com',
          inscription: 'Long inscription text here...',
          start_date: '2020-05-15',
          dimensions: '3.5',
          width: '2.1',
          condition: 'good',
          heritage: 'yes',
          wikipedia: 'en:Some Article',
          wikidata: 'Q123456',
          image: 'https://commons.wikimedia.org/image.jpg',
        },
      });
      const geoJSON = createTestGeoJSON([featureWithManyTags]);

      const result = parseOSMGeoJSON(geoJSON);
      const tags = result.payloads[0].logbook![0].tags!;

      // Verify all custom tags are preserved
  expect(tags.find(t => t.label === 'Dimensions')?.value).toBe('3.5');
      expect(tags.find(t => t.label === 'Width')?.value).toBe('2.1');
      expect(tags.find(t => t.label === 'Condition')?.value).toBe('good');
      expect(tags.find(t => t.label === 'Heritage')?.value).toBe('yes');
      expect(tags.find(t => t.label === 'Wikipedia')?.value).toBe('en:Some Article');
      expect(tags.find(t => t.label === 'Image')?.value).toBe(
        'https://commons.wikimedia.org/image.jpg'
      );

      // Verify system tags are excluded
      expect(tags.find(t => t.label === 'Tourism')).toBeUndefined();
      expect(tags.find(t => t.label === 'Osm Type')).toBeUndefined();
    });
  });
});
