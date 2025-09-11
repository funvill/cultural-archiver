/**
 * Integration test for the exact "Solo" artwork duplication scenario
 * 
 * Tests the fixed similarity algorithm with identical artworks that should
 * now be properly detected as duplicates.
 */

import { describe, test, expect } from 'vitest';
import { MassImportSimilarityStrategy } from '../../shared/mass-import-similarity';

describe('Mass Import Duplicate Detection - Solo Artwork Fix', () => {
  test('should properly detect identical "Solo" artworks as duplicates', () => {
    const strategy = new MassImportSimilarityStrategy('https://art.abluestar.com');

    // Query (new artwork being imported)
    const query = {
      coordinates: { lat: 49.2827, lon: -123.1207 },
      title: 'Solo',
      tags: {
        source: 'vancouver-opendata',
        material: 'bronze',
        type: 'sculpture',
        data_source: 'vancouver_open_data',
        license: 'Open Government Licence – Vancouver',
        city: 'vancouver',
        province: 'british_columbia',
        country: 'canada'
      }
    };

    // Candidate (existing artwork in database) 
    const candidate = {
      id: 'existing-solo-artwork',
      coordinates: { lat: 49.2827, lon: -123.1207 }, // Same coordinates
      title: 'Solo', // Same title
      created_by: null, // No artist data
      tags: JSON.stringify({
        source: 'vancouver-opendata',
        material: 'bronze', 
        type: 'sculpture',
        data_source: 'vancouver_open_data',
        license: 'Open Government Licence – Vancouver',
        city: 'vancouver',
        province: 'british_columbia',
        country: 'canada'
      })
    };

    const result = strategy.calculateSimilarity(query, candidate, 0.7);

    // Detailed score breakdown validation
    expect(result.scoreBreakdown.title).toBeCloseTo(0.2, 3); // Perfect title match
    expect(result.scoreBreakdown.artist).toBe(0); // No artist data
    expect(result.scoreBreakdown.location).toBeCloseTo(0.3, 3); // Perfect location match
    expect(result.scoreBreakdown.tags).toBeGreaterThan(0.3); // Many tag matches (7+ tags * 0.05 = 0.35+)

    // Total score should be well above threshold
    const expectedMinScore = 0.2 + 0.0 + 0.3 + 0.35; // = 0.85
    expect(result.confidenceScore).toBeGreaterThanOrEqual(expectedMinScore);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7);
    expect(result.isDuplicate).toBe(true);

    console.log('✅ Solo artwork test results:');
    console.log(`  Title Score: ${result.scoreBreakdown.title.toFixed(3)}`);
    console.log(`  Artist Score: ${result.scoreBreakdown.artist.toFixed(3)}`);
    console.log(`  Location Score: ${result.scoreBreakdown.location.toFixed(3)}`);
    console.log(`  Tags Score: ${result.scoreBreakdown.tags.toFixed(3)}`);
    console.log(`  Total Score: ${result.confidenceScore.toFixed(3)}`);
    console.log(`  Is Duplicate: ${result.isDuplicate}`);
  });

  test('should handle title-only matches correctly', () => {
    const strategy = new MassImportSimilarityStrategy('https://art.abluestar.com');

    // Same test but without tags - should get title + location = 0.5 < 0.7
    const query = {
      coordinates: { lat: 49.2827, lon: -123.1207 },
      title: 'Solo'
      // No tags, no artist
    };

    const candidate = {
      id: 'existing-solo-artwork',
      coordinates: { lat: 49.2827, lon: -123.1207 },
      title: 'Solo',
      created_by: null,
      tags: null
    };

    const result = strategy.calculateSimilarity(query, candidate, 0.7);

    expect(result.scoreBreakdown.title).toBeCloseTo(0.2, 3);
    expect(result.scoreBreakdown.artist).toBe(0);
    expect(result.scoreBreakdown.location).toBeCloseTo(0.3, 3);
    expect(result.scoreBreakdown.tags).toBe(0);
    expect(result.confidenceScore).toBeCloseTo(0.5, 3);
    expect(result.isDuplicate).toBe(false); // 0.5 < 0.7 threshold
  });

  test('should handle edge cases in title matching', () => {
    const strategy = new MassImportSimilarityStrategy('https://art.abluestar.com');

    const testCases = [
      { title1: 'Solo', title2: 'Solo', expectedSimilarity: 1.0 },
      { title1: 'Solo', title2: 'solo', expectedSimilarity: 1.0 }, // Case insensitive
      { title1: 'Solo!', title2: 'Solo.', expectedSimilarity: 1.0 }, // Punctuation ignored
      { title1: ' Solo ', title2: 'Solo', expectedSimilarity: 1.0 }, // Whitespace trimmed
      { title1: 'Solo', title2: 'Sola', expectedSimilarity: 0.75 }, // 1 character difference out of 4
      { title1: '', title2: '', expectedSimilarity: 1.0 }, // Empty strings
      { title1: 'Solo', title2: '', expectedSimilarity: 0.0 }, // One empty
    ];

    for (const testCase of testCases) {
      const query = {
        coordinates: { lat: 49.2827, lon: -123.1207 },
        title: testCase.title1
      };

      const candidate = {
        id: 'test-artwork',
        coordinates: { lat: 49.2827, lon: -123.1207 },
        title: testCase.title2,
        created_by: null,
        tags: null
      };

      const result = strategy.calculateSimilarity(query, candidate, 0.7);
      const actualTitleScore = result.scoreBreakdown.title / 0.2; // Convert back to 0-1 range

      expect(actualTitleScore).toBeCloseTo(testCase.expectedSimilarity, 2);
    }
  });
});
