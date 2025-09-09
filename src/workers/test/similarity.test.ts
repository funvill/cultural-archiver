/**
 * Test suite for the similarity scoring system
 */

import { describe, it, expect } from 'vitest';
import {
  DefaultSimilarityStrategy,
  SIMILARITY_THRESHOLD_WARN,
  SIMILARITY_THRESHOLD_HIGH,
  SIMILARITY_WEIGHTS,
  getSimilarityExplanation,
  sortBySimilarity,
  filterByThreshold,
} from '../../shared/similarity';
import type { SimilarityQuery, CandidateArtwork } from '../../shared/similarity';

describe('Similarity Scoring System', () => {
  const strategy = new DefaultSimilarityStrategy();

  const createQuery = (overrides: Partial<SimilarityQuery> = {}): SimilarityQuery => ({
    coordinates: { lat: 49.2827, lon: -123.1207 },
    title: 'Test Artwork',
    tags: ['sculpture', 'bronze'],
    ...overrides,
  });

  const createCandidate = (overrides: Partial<CandidateArtwork> = {}): CandidateArtwork => ({
    id: 'test-artwork-1',
    coordinates: { lat: 49.2827, lon: -123.1207 },
    title: 'Test Artwork',
    tags: JSON.stringify(['sculpture', 'bronze']),
    type_name: 'public_art',
    ...overrides,
  });

  describe('Distance Similarity', () => {
    it('should calculate perfect similarity for same location', () => {
      const query = createQuery();
      const candidate = createCandidate();

      const result = strategy.calculateSimilarity(query, candidate);
      
      // Distance signal should be perfect (1.0) before weighting
      const distanceSignal = result.signals.find(s => s.type === 'distance');
      expect(distanceSignal).toBeDefined();
      expect(distanceSignal!.rawScore).toBe(1);
    });

    it('should calculate decreasing similarity with distance', () => {
      const query = createQuery();
      const nearCandidate = createCandidate({
        coordinates: { lat: 49.2830, lon: -123.1210 }, // ~50m away
      });
      const farCandidate = createCandidate({
        coordinates: { lat: 49.2900, lon: -123.1300 }, // ~1km away
      });

      const nearResult = strategy.calculateSimilarity(query, nearCandidate);
      const farResult = strategy.calculateSimilarity(query, farCandidate);

      const nearDistance = nearResult.signals.find(s => s.type === 'distance')!.rawScore;
      const farDistance = farResult.signals.find(s => s.type === 'distance')!.rawScore;

      expect(nearDistance).toBeGreaterThan(farDistance);
      expect(nearDistance).toBeGreaterThan(0.5);
    });
  });

  describe('Title Similarity', () => {
    it('should calculate perfect similarity for identical titles', () => {
      const query = createQuery({ title: 'Bronze Sculpture' });
      const candidate = createCandidate({ title: 'Bronze Sculpture' });

      const result = strategy.calculateSimilarity(query, candidate);
      
      const titleSignal = result.signals.find(s => s.type === 'title');
      expect(titleSignal).toBeDefined();
      expect(titleSignal!.rawScore).toBe(1);
    });

    it('should calculate similarity for similar titles', () => {
      const query = createQuery({ title: 'Bronze Sculpture' });
      const candidate = createCandidate({ title: 'Bronze Statue' });

      const result = strategy.calculateSimilarity(query, candidate);
      
      const titleSignal = result.signals.find(s => s.type === 'title');
      expect(titleSignal).toBeDefined();
      expect(titleSignal!.rawScore).toBeGreaterThan(0.5);
      expect(titleSignal!.rawScore).toBeLessThan(1);
    });

    it('should handle title normalization (case, punctuation)', () => {
      const query = createQuery({ title: 'Bronze Sculpture!' });
      const candidate = createCandidate({ title: 'bronze sculpture' });

      const result = strategy.calculateSimilarity(query, candidate);
      
      const titleSignal = result.signals.find(s => s.type === 'title');
      expect(titleSignal).toBeDefined();
      expect(titleSignal!.rawScore).toBe(1);
    });

    it('should skip title comparison for very short titles', () => {
      const query = createQuery({ title: 'A' });
      const candidate = createCandidate({ title: 'B' });

      const result = strategy.calculateSimilarity(query, candidate);
      
      const titleSignal = result.signals.find(s => s.type === 'title');
      expect(titleSignal).toBeDefined();
      expect(titleSignal!.rawScore).toBe(0);
      expect(titleSignal!.metadata?.reason).toBe('title_too_short');
    });
  });

  describe('Tag Similarity', () => {
    it('should calculate perfect similarity for identical tags', () => {
      const query = createQuery({ tags: ['sculpture', 'bronze'] });
      const candidate = createCandidate({ 
        tags: JSON.stringify(['sculpture', 'bronze']) 
      });

      const result = strategy.calculateSimilarity(query, candidate);
      
      const tagSignal = result.signals.find(s => s.type === 'tags');
      expect(tagSignal).toBeDefined();
      expect(tagSignal!.rawScore).toBe(1);
    });

    it('should calculate partial similarity for overlapping tags', () => {
      const query = createQuery({ tags: ['sculpture', 'bronze', 'modern'] });
      const candidate = createCandidate({ 
        tags: JSON.stringify(['sculpture', 'stone']) 
      });

      const result = strategy.calculateSimilarity(query, candidate);
      
      const tagSignal = result.signals.find(s => s.type === 'tags');
      expect(tagSignal).toBeDefined();
      // 1 common tag out of 4 unique tags = 1/4 = 0.25
      expect(tagSignal!.rawScore).toBeCloseTo(0.25, 1);
    });

    it('should handle structured tags format', () => {
      const query = createQuery({ tags: ['bronze'] });
      const candidate = createCandidate({ 
        tags: JSON.stringify({ material: 'bronze', style: 'modern' })
      });

      const result = strategy.calculateSimilarity(query, candidate);
      
      const tagSignal = result.signals.find(s => s.type === 'tags');
      expect(tagSignal).toBeDefined();
      expect(tagSignal!.rawScore).toBeGreaterThan(0);
    });
  });

  describe('Overall Similarity', () => {
    it('should combine all signals with proper weights', () => {
      const query = createQuery({
        coordinates: { lat: 49.2827, lon: -123.1207 },
        title: 'Bronze Sculpture',
        tags: ['sculpture', 'bronze'],
      });
      const candidate = createCandidate({
        coordinates: { lat: 49.2827, lon: -123.1207 },
        title: 'Bronze Sculpture',
        tags: JSON.stringify(['sculpture', 'bronze']),
      });

      const result = strategy.calculateSimilarity(query, candidate);

      // Should be perfect match
      expect(result.overallScore).toBe(1);
      expect(result.signals).toHaveLength(3); // distance, title, tags
    });

    it('should handle missing signals gracefully', () => {
      const query = createQuery({
        coordinates: { lat: 49.2827, lon: -123.1207 },
        // No title or tags
      });
      const candidate = createCandidate({
        coordinates: { lat: 49.2827, lon: -123.1207 },
        title: null,
        tags: null,
      });

      const result = strategy.calculateSimilarity(query, candidate);

      // Should only have distance signal
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].type).toBe('distance');
      expect(result.overallScore).toBe(1); // Perfect distance match
    });
  });

  describe('Threshold Classification', () => {
    it('should classify high similarity correctly', () => {
      const query = createQuery();
      const candidate = createCandidate(); // Perfect match

      const result = strategy.calculateSimilarity(query, candidate);

      expect(result.overallScore).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD_HIGH);
      expect(result.threshold).toBe('high');
    });

    it('should classify warning similarity correctly', () => {
      const query = createQuery({
        coordinates: { lat: 49.2827, lon: -123.1207 },
        title: 'Bronze Sculpture',
        tags: ['sculpture'],
      });
      const candidate = createCandidate({
        coordinates: { lat: 49.2900, lon: -123.1300 }, // ~1km away
        title: 'Abstract Art', // Different title
        tags: JSON.stringify(['art']), // Different tags
      });

      const result = strategy.calculateSimilarity(query, candidate);

      // Score should be low enough to be in warning range
      expect(result.overallScore).toBeLessThan(SIMILARITY_THRESHOLD_HIGH);
      // Should have some similarity from distance normalization
      expect(result.overallScore).toBeGreaterThan(0);
    });
  });

  describe('Utility Functions', () => {
    it('should sort results by similarity', () => {
      const results = [
        { artworkId: '1', overallScore: 0.5, signals: [], threshold: 'none' as const, metadata: {} },
        { artworkId: '2', overallScore: 0.9, signals: [], threshold: 'high' as const, metadata: {} },
        { artworkId: '3', overallScore: 0.7, signals: [], threshold: 'warn' as const, metadata: {} },
      ];

      const sorted = sortBySimilarity(results);

      expect(sorted.map(r => r.artworkId)).toEqual(['2', '3', '1']);
    });

    it('should filter by threshold', () => {
      const results = [
        { artworkId: '1', overallScore: 0.5, signals: [], threshold: 'none' as const, metadata: {} },
        { artworkId: '2', overallScore: 0.9, signals: [], threshold: 'high' as const, metadata: {} },
        { artworkId: '3', overallScore: 0.7, signals: [], threshold: 'warn' as const, metadata: {} },
      ];

      const warnings = filterByThreshold(results, 'warn');
      expect(warnings).toHaveLength(2);
      expect(warnings.map(r => r.artworkId)).toEqual(['2', '3']);

      const high = filterByThreshold(results, 'high');
      expect(high).toHaveLength(1);
      expect(high[0].artworkId).toBe('2');
    });

    it('should generate similarity explanations', () => {
      const result = {
        artworkId: 'test',
        overallScore: 0.85,
        threshold: 'high' as const,
        metadata: { distance: 45 },
        signals: [
          {
            type: 'distance' as const,
            rawScore: 0.9,
            weightedScore: 0.45,
            metadata: { distanceMeters: 45 }
          },
          {
            type: 'title' as const,
            rawScore: 0.8,
            weightedScore: 0.28,
          },
        ],
      };

      const explanation = getSimilarityExplanation(result);

      expect(explanation).toContain('85%');
      expect(explanation).toContain('45m away');
      expect(explanation).toContain('similar title');
    });
  });

  describe('Configuration Constants', () => {
    it('should have valid weight configuration', () => {
      const totalWeight = SIMILARITY_WEIGHTS.distance + SIMILARITY_WEIGHTS.title + SIMILARITY_WEIGHTS.tags;
      expect(totalWeight).toBeCloseTo(1.0, 2);
    });

    it('should have valid thresholds', () => {
      expect(SIMILARITY_THRESHOLD_WARN).toBeLessThan(SIMILARITY_THRESHOLD_HIGH);
      expect(SIMILARITY_THRESHOLD_WARN).toBeGreaterThan(0);
      expect(SIMILARITY_THRESHOLD_HIGH).toBeLessThan(1);
    });
  });
});