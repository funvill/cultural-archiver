/**
 * Basic Mass Import Similarity Tests
 * 
 * Tests the core similarity algorithm implementation
 * without requiring complex database setup.
 */

import { describe, test, expect, beforeEach } from 'vitest';

describe('Mass Import Similarity Strategy - Basic Tests', () => {
  test('should be importable', async () => {
    const { MassImportSimilarityStrategy } = await import('../../shared/mass-import-similarity');
    expect(MassImportSimilarityStrategy).toBeDefined();
  });

  test('should calculate location similarity correctly', async () => {
    const { MassImportSimilarityStrategy } = await import('../../shared/mass-import-similarity');
    const strategy = new MassImportSimilarityStrategy();

    const query = {
      coordinates: { lat: 49.2827, lon: -123.1207 }
    };

    const candidate = {
      id: 'test-1',
      coordinates: { lat: 49.2827, lon: -123.1207 }
    };

    const result = strategy.calculateSimilarity(query, candidate, 0.7);

    expect(result.scoreBreakdown.location).toBeCloseTo(0.3, 3);
    expect(result.confidenceScore).toBeCloseTo(0.3, 3);
  });

  test('should handle title matching', async () => {
    const { MassImportSimilarityStrategy } = await import('../../shared/mass-import-similarity');
    const strategy = new MassImportSimilarityStrategy();

    const query = {
      coordinates: { lat: 49.2827, lon: -123.1207 },
      title: 'Victory Square Angel'
    };

    const candidate = {
      id: 'test-1',
      coordinates: { lat: 49.2827, lon: -123.1207 },
      title: 'Victory Square Angel'
    };

    const result = strategy.calculateSimilarity(query, candidate, 0.7);

    expect(result.scoreBreakdown.title).toBeCloseTo(0.2, 3);
    expect(result.scoreBreakdown.location).toBeCloseTo(0.3, 3);
    expect(result.confidenceScore).toBeCloseTo(0.5, 3);
  });

  test('should detect duplicates above threshold', async () => {
    const { MassImportSimilarityStrategy } = await import('../../shared/mass-import-similarity');
    const strategy = new MassImportSimilarityStrategy();

    const query = {
      coordinates: { lat: 49.2827, lon: -123.1207 },
      title: 'Victory Square Angel',
      artist: 'Jane Doe'
    };

    const candidate = {
      id: 'test-1',
      coordinates: { lat: 49.2827, lon: -123.1207 },
      title: 'Victory Square Angel',
      created_by: 'Jane Doe'
    };

    const result = strategy.calculateSimilarity(query, candidate, 0.7);

    // Should get 0.3 (location) + 0.2 (title) + 0.2 (artist) = 0.7
    expect(result.confidenceScore).toBeCloseTo(0.7, 3);
    expect(result.isDuplicate).toBe(true);
  });

  test('should not detect duplicates below threshold', async () => {
    const { MassImportSimilarityStrategy } = await import('../../shared/mass-import-similarity');
    const strategy = new MassImportSimilarityStrategy();

    const query = {
      coordinates: { lat: 49.2827, lon: -123.1207 },
      title: 'Different Title'
    };

    const candidate = {
      id: 'test-1',
      coordinates: { lat: 49.2827, lon: -123.1207 },
      title: 'Another Title'
    };

    const result = strategy.calculateSimilarity(query, candidate, 0.7);

    // Should only get location points (0.3) and minimal title similarity
    expect(result.confidenceScore).toBeLessThan(0.7);
    expect(result.isDuplicate).toBe(false);
  });
});