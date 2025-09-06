import { describe, it, expect } from 'vitest';
import { 
  mapVancouverRecord, 
  isValidVancouverRecord, 
  getVancouverDataQuality,
  type VancouverRecord 
} from '../src/vancouver-mapper.js';

describe('Vancouver Data Mapper', () => {
  const sampleVancouverRecord: VancouverRecord = {
    registryid: 27,
    title_of_work: "Solo",
    artistprojectstatement: "Artist statement about movement",
    type: "Sculpture",
    status: "In place",
    sitename: "Devonian Harbour Park",
    siteaddress: "Denman & Georgia Street",
    primarymaterial: "Stainless steel, cedar",
    url: "https://covapp.vancouver.ca/PublicArtRegistry/ArtworkDetail.aspx?ArtworkId=27",
    photourl: {
      url: "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/public-art/files/test123",
      filename: "LAW27-1.jpg",
      width: 350,
      height: 256,
      mimetype: "image/jpeg"
    },
    ownership: "City of Vancouver",
    neighbourhood: "Downtown",
    locationonsite: "Lawn along Georgia Street",
    geom: {
      type: "Feature",
      geometry: {
        coordinates: [-123.133965, 49.293313],
        type: "Point"
      },
      properties: {}
    },
    geo_local_area: "Downtown",
    descriptionofwork: "An abstract sculpture of stainless steel with carved cedar planks",
    artists: ["103"],
    photocredits: "SITE Photography, 2016",
    yearofinstallation: "1986",
    geo_point_2d: {
      lon: -123.133965,
      lat: 49.293313
    }
  };

  describe('mapVancouverRecord', () => {
    it('should map Vancouver record to ImportRecord format', () => {
      const result = mapVancouverRecord(sampleVancouverRecord);

      expect(result.externalId).toBe('vancouver-27');
      expect(result.lat).toBe(49.293313);
      expect(result.lon).toBe(-123.133965);
      expect(result.title).toBe('Solo');
      expect(result.description).toContain('An abstract sculpture');
      expect(result.photoUrls).toEqual([sampleVancouverRecord.photourl!.url]);
      expect(result.tags.tourism).toBe('artwork');
      expect(result.tags.artwork_type).toBe('sculpture');
      expect(result.tags.material).toBe('stainless_steel_cedar');
      expect(result.tags.source).toBe('vancouver-opendata');
    });

    it('should handle missing optional fields', () => {
      const minimalRecord: VancouverRecord = {
        registryid: 1,
        title_of_work: "Test Artwork",
        type: "Unknown",
        status: "Active",
        geom: {
          type: "Feature",
          geometry: {
            coordinates: [-123.1, 49.3],
            type: "Point"
          },
          properties: {}
        },
        geo_point_2d: {
          lon: -123.1,
          lat: 49.3
        }
      };

      const result = mapVancouverRecord(minimalRecord);

      expect(result.externalId).toBe('vancouver-1');
      expect(result.title).toBe('Test Artwork');
      expect(result.photoUrls).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.tags.tourism).toBe('artwork');
    });

    it('should include metadata from original record', () => {
      const result = mapVancouverRecord(sampleVancouverRecord);

      expect(result.metadata).toEqual({
        vancouverRegistryId: 27,
        vancouverUrl: sampleVancouverRecord.url,
        originalRecord: sampleVancouverRecord,
      });
    });
  });

  describe('isValidVancouverRecord', () => {
    it('should validate correct Vancouver records', () => {
      expect(isValidVancouverRecord(sampleVancouverRecord)).toBe(true);
    });

    it('should reject records with missing required fields', () => {
      const invalidRecord = { ...sampleVancouverRecord };
      delete invalidRecord.registryid;
      expect(isValidVancouverRecord(invalidRecord)).toBe(false);
    });

    it('should reject records with invalid coordinates', () => {
      const invalidRecord = {
        ...sampleVancouverRecord,
        geo_point_2d: {
          lat: 200, // Invalid latitude
          lon: -123.1
        }
      };
      expect(isValidVancouverRecord(invalidRecord)).toBe(false);
    });

    it('should reject non-object inputs', () => {
      expect(isValidVancouverRecord(null)).toBe(false);
      expect(isValidVancouverRecord("string")).toBe(false);
      expect(isValidVancouverRecord(123)).toBe(false);
    });
  });

  describe('getVancouverDataQuality', () => {
    it('should calculate data quality statistics', () => {
      const records = [
        sampleVancouverRecord,
        {
          ...sampleVancouverRecord,
          registryid: 2,
          photourl: undefined,
          descriptionofwork: undefined,
          artists: undefined,
          primarymaterial: undefined,
          yearofinstallation: undefined,
        }
      ];

      const quality = getVancouverDataQuality(records);

      expect(quality.total).toBe(2);
      expect(quality.withPhotos).toBe(1);
      expect(quality.withDescriptions).toBe(1);
      expect(quality.withArtists).toBe(1);
      expect(quality.withMaterial).toBe(1);
      expect(quality.withYear).toBe(1);
      expect(quality.missingCoordinates).toBe(0);
    });

    it('should handle empty arrays', () => {
      const quality = getVancouverDataQuality([]);
      
      expect(quality.total).toBe(0);
      expect(quality.withPhotos).toBe(0);
    });
  });
});