/**
 * Test suite for the similarity service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SimilarityService,
  createSimilarityService,
  createDevSimilarityService,
  artworkToCandidate,
  parseTagsForSimilarity,
} from '../lib/similarity';
import type { SimilarityQuery, CandidateArtwork } from '../../shared/similarity';

describe('Similarity Service', () => {
  let service: SimilarityService;

  beforeEach(() => {
    service = createSimilarityService();
  });

  const createTestQuery = (overrides: Partial<SimilarityQuery> = {}): SimilarityQuery => ({
    coordinates: { lat: 49.2827, lon: -123.1207 },
    title: 'Bronze Sculpture',
    tags: ['sculpture', 'bronze'],
    ...overrides,
  });

  const createTestCandidate = (overrides: Partial<CandidateArtwork> = {}): CandidateArtwork => ({
    id: 'test-artwork-1',
    coordinates: { lat: 49.2827, lon: -123.1207 },
    title: 'Bronze Sculpture',
    tags: JSON.stringify(['sculpture', 'bronze']),
    type_name: 'public_art',
    ...overrides,
  });

  const createTestArtwork = (overrides: any = {}) => ({
    id: 'test-artwork-1',
    lat: 49.2827,
    lon: -123.1207,
    type_name: 'public_art',
    distance_km: 0.1,
    title: 'Bronze Sculpture',
    tags: JSON.stringify(['sculpture', 'bronze']),
    photos: ['photo1.jpg'],
    ...overrides,
  });

  describe('Basic Functionality', () => {
    it('should create service with default configuration', () => {
      const defaultService = createSimilarityService();
      expect(defaultService.getStrategyInfo().name).toBe('default');
    });

    it('should create dev service with metadata enabled', () => {
      const devService = createDevSimilarityService();
      expect(devService.getStrategyInfo().name).toBe('default');
    });
  });

  describe('Similarity Score Calculation', () => {
    it('should calculate similarity scores for candidates', () => {
      const query = createTestQuery();
      const candidates = [
        createTestCandidate({ id: 'exact-match' }),
        createTestCandidate({ 
          id: 'similar-match',
          coordinates: { lat: 49.2830, lon: -123.1210 },
          title: 'Bronze Statue',
        }),
        createTestCandidate({
          id: 'distant-match',
          coordinates: { lat: 49.2900, lon: -123.1300 },
          title: 'Abstract Art',
          tags: JSON.stringify(['art']),
        }),
      ];

      const results = service.calculateSimilarityScores(query, candidates);

      expect(results).toHaveLength(3);
      expect(results[0].artworkId).toBe('exact-match'); // Should be sorted by similarity
      expect(results[0].overallScore).toBeGreaterThan(results[1].overallScore);
      expect(results[1].overallScore).toBeGreaterThan(results[2].overallScore);
    });

    it('should handle empty candidates list', () => {
      const query = createTestQuery();
      const results = service.calculateSimilarityScores(query, []);

      expect(results).toHaveLength(0);
    });

    it('should continue processing if one candidate fails', () => {
      const query = createTestQuery();
      const candidates = [
        createTestCandidate({ id: 'good-candidate' }),
        createTestCandidate({ 
          id: 'bad-candidate',
          coordinates: { lat: NaN, lon: NaN }, // Invalid coordinates
        }),
        createTestCandidate({ id: 'another-good-candidate' }),
      ];

      const results = service.calculateSimilarityScores(query, candidates);

      // The similarity engine is resilient and continues with all candidates
      // but NaN coordinates should result in 0 distance score
      expect(results.length).toBe(3);
      
      // The bad candidate should have lower similarity due to NaN distance
      const badResult = results.find(r => r.artworkId === 'bad-candidate');
      const goodResult = results.find(r => r.artworkId === 'good-candidate');
      
      expect(badResult).toBeDefined();
      expect(goodResult).toBeDefined();
      expect(badResult!.overallScore).toBeLessThan(goodResult!.overallScore);
    });
  });

  describe('Enhanced Nearby Results', () => {
    it('should enhance nearby artworks with similarity scores', () => {
      const query = createTestQuery();
      const nearbyArtworks = [
        createTestArtwork({ id: 'nearby-1', distance_km: 0.05 }),
        createTestArtwork({ 
          id: 'nearby-2', 
          distance_km: 0.1,
          title: 'Steel Sculpture',
          tags: JSON.stringify(['sculpture', 'steel']),
        }),
      ];

      const enhanced = service.enhanceNearbyResults(query, nearbyArtworks);

      expect(enhanced).toHaveLength(2);
      
      // Should have similarity scores
      expect(enhanced[0].similarity_score).toBeDefined();
      expect(enhanced[0].similarity_threshold).toBeDefined();
      expect(enhanced[0].distance_meters).toBe(50); // 0.05km = 50m
      
      // Should be sorted by relevance
      expect(enhanced[0].similarity_score).toBeGreaterThanOrEqual(enhanced[1].similarity_score!);
    });

    it('should gracefully degrade when similarity service fails', () => {
      // Create a service that will fail by passing completely invalid query
      const failingService = createSimilarityService();
      
      // Force an error by passing null query that will cause JSON parsing to fail
      const nearbyArtworks = [createTestArtwork()];
      
      // Mock the similarity calculation to throw an error
      const originalCalculate = failingService.calculateSimilarityScores;
      failingService.calculateSimilarityScores = () => {
        throw new Error('Simulated similarity service failure');
      };
      
      const query = createTestQuery();
      const enhanced = failingService.enhanceNearbyResults(query, nearbyArtworks);

      // Should return results without similarity scores (graceful degradation)
      expect(enhanced).toHaveLength(1);
      expect(enhanced[0].similarity_score).toBeUndefined();
      expect(enhanced[0].distance_meters).toBeDefined();
    });

    it('should include metadata in dev mode', () => {
      const devService = createDevSimilarityService();
      const query = createTestQuery();
      const nearbyArtworks = [createTestArtwork()];

      const enhanced = devService.enhanceNearbyResults(query, nearbyArtworks);

      expect(enhanced[0].similarity_signals).toBeDefined();
      expect(enhanced[0].similarity_signals!.length).toBeGreaterThan(0);
    });

    it('should sort by similarity score then distance', () => {
      const query = createTestQuery({ coordinates: { lat: 49.2827, lon: -123.1207 } });
      const nearbyArtworks = [
        createTestArtwork({ 
          id: 'close-dissimilar',
          distance_km: 0.05, // Very close
          title: 'Random Art',
          tags: JSON.stringify(['random']),
        }),
        createTestArtwork({ 
          id: 'far-similar',
          distance_km: 0.5, // Farther away
          title: 'Bronze Sculpture', // Exact match
          tags: JSON.stringify(['sculpture', 'bronze']),
        }),
      ];

      const enhanced = service.enhanceNearbyResults(query, nearbyArtworks);

      // The similar but farther artwork should rank higher than close but dissimilar
      expect(enhanced[0].id).toBe('far-similar');
      expect(enhanced[1].id).toBe('close-dissimilar');
    });
  });

  describe('Duplicate Detection', () => {
    it('should identify high similarity matches', () => {
      const query = createTestQuery();
      const candidates = [
        createTestCandidate({ id: 'exact-duplicate' }), // Perfect match
        createTestCandidate({ 
          id: 'similar',
          title: 'Bronze Statue',
        }),
        createTestCandidate({
          id: 'different',
          title: 'Abstract Art',
          tags: JSON.stringify(['art']),
        }),
      ];

      const duplicates = service.checkForDuplicates(query, candidates);

      expect(duplicates.hasHighSimilarity).toBe(true);
      expect(duplicates.highSimilarityMatches.length).toBeGreaterThan(0);
      expect(duplicates.topMatch).toBeDefined();
      expect(duplicates.topMatch!.artworkId).toBe('exact-duplicate');
    });

    it('should handle graceful degradation on failure', () => {
      const badQuery = {
        coordinates: { lat: NaN, lon: NaN },
      } as any;
      const candidates = [createTestCandidate()];

      const result = service.checkForDuplicates(badQuery, candidates);

      expect(result.hasHighSimilarity).toBe(false);
      expect(result.hasWarningSimilarity).toBe(false);
      expect(result.highSimilarityMatches).toHaveLength(0);
      expect(result.warningSimilarityMatches).toHaveLength(0);
    });
  });

  describe('High Similarity Matches', () => {
    it('should return only high confidence matches', () => {
      const query = createTestQuery();
      const candidates = [
        createTestCandidate({ id: 'perfect-match' }), // Should be high similarity
        createTestCandidate({ 
          id: 'medium-match',
          coordinates: { lat: 49.2900, lon: -123.1300 },
          title: 'Different Art',
        }),
      ];

      const highMatches = service.getHighSimilarityMatches(query, candidates);

      expect(highMatches.length).toBeGreaterThan(0);
      expect(highMatches[0].threshold).toBe('high');
    });
  });

  describe('Warning Similarity Matches', () => {
    it('should return warning and high similarity matches', () => {
      const query = createTestQuery();
      const candidates = [
        createTestCandidate({ id: 'perfect-match' }),
        createTestCandidate({ 
          id: 'good-match',
          title: 'Bronze Statue', // Similar title
        }),
      ];

      const warningMatches = service.getWarningSimilarityMatches(query, candidates);

      // Should include both high and warning level matches
      expect(warningMatches.length).toBeGreaterThan(0);
    });
  });

  describe('Utility Functions', () => {
    it('should convert artwork to candidate format', () => {
      const artwork = {
        id: 'test-id',
        lat: 49.2827,
        lon: -123.1207,
        title: 'Test Artwork',
        tags: '["sculpture"]',
        type_name: 'public_art',
      };

      const candidate = artworkToCandidate(artwork);

      expect(candidate.id).toBe('test-id');
      expect(candidate.coordinates).toEqual({ lat: 49.2827, lon: -123.1207 });
      expect(candidate.title).toBe('Test Artwork');
      expect(candidate.tags).toBe('["sculpture"]');
      expect(candidate.type_name).toBe('public_art');
    });

    it('should parse tags in different formats', () => {
      // Array format
      expect(parseTagsForSimilarity('["sculpture", "bronze"]')).toEqual(['sculpture', 'bronze']);
      
      // Flat object format
      expect(parseTagsForSimilarity('{"material": "bronze", "type": "sculpture"}'))
        .toEqual(['bronze', 'sculpture']);
      
      // Structured format
      expect(parseTagsForSimilarity('{"tags": {"material": "bronze", "type": "sculpture"}}'))
        .toEqual(['bronze', 'sculpture']);
      
      // Invalid JSON
      expect(parseTagsForSimilarity('invalid json')).toEqual([]);
      
      // Null/empty
      expect(parseTagsForSimilarity(null)).toEqual([]);
      expect(parseTagsForSimilarity('')).toEqual([]);
    });

    it('should filter non-string values from tag parsing', () => {
      const tagsWithNumbers = '{"material": "bronze", "height": 5, "public": true}';
      const parsed = parseTagsForSimilarity(tagsWithNumbers);
      
      expect(parsed).toEqual(['bronze']);
      expect(parsed).not.toContain(5);
      expect(parsed).not.toContain(true);
    });
  });

  describe('Strategy Management', () => {
    it('should allow strategy updates', () => {
      const customStrategy = {
        name: 'custom',
        version: '1.0.0',
        calculateSimilarity: () => ({
          artworkId: 'test',
          overallScore: 0.5,
          signals: [],
          threshold: 'none' as const,
          metadata: {},
        }),
      };

      service.setStrategy(customStrategy);
      const info = service.getStrategyInfo();

      expect(info.name).toBe('custom');
      expect(info.version).toBe('1.0.0');
    });
  });

  describe('Edge Cases', () => {
    it('should handle artworks without titles', () => {
      const query = createTestQuery({ title: undefined });
      const candidates = [createTestCandidate({ title: null })];

      const results = service.calculateSimilarityScores(query, candidates);

      expect(results).toHaveLength(1);
      expect(results[0].overallScore).toBeGreaterThan(0); // Should still have distance score
    });

    it('should handle artworks without tags', () => {
      const query = createTestQuery({ tags: undefined });
      const candidates = [createTestCandidate({ tags: null })];

      const results = service.calculateSimilarityScores(query, candidates);

      expect(results).toHaveLength(1);
      expect(results[0].overallScore).toBeGreaterThan(0); // Should still have distance score
    });

    it('should handle identical coordinates', () => {
      const query = createTestQuery();
      const candidates = [
        createTestCandidate({ id: 'same-location-1' }),
        createTestCandidate({ id: 'same-location-2' }),
      ];

      const results = service.calculateSimilarityScores(query, candidates);

      expect(results).toHaveLength(2);
      // Both should have high distance scores
      expect(results[0].signals.find(s => s.type === 'distance')?.rawScore).toBe(1);
      expect(results[1].signals.find(s => s.type === 'distance')?.rawScore).toBe(1);
    });
  });
});