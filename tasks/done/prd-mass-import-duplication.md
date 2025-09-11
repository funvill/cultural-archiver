# PRD: Mass Import Duplication Detection

## Executive Summary

Implement a duplication detection system for the mass import functionality to prevent importing duplicate artworks. The system will use a similarity scoring algorithm to identify potential duplicates and generate reports for review.

## Problem Statement

When mass importing artworks from external data sources (like Vancouver Open Data), duplicate artworks may already exist in the database. Currently, there's no mechanism to detect and prevent these duplicates, which could lead to data redundancy, confusing user experience, and integrity issues.

## Goals

### Primary Goals

- Prevent duplicate artwork imports during mass import operations
- Provide clear feedback when duplicates are detected
- Generate comprehensive duplicate detection reports

### Success Criteria

- Zero duplicate artworks created during mass import operations
- Clear visibility into potential duplicates with confidence scores
- Maintainable and configurable similarity detection algorithm

## Technical Requirements

### Similarity Scoring Algorithm

**Scoring Components:**

- **Title match**: +0.2 points (Levenshtein distance with standard normalization)
- **Artist match**: +0.2 points (Split comma-separated artists, match any)
- **Location proximity**: +0.3 points (Distance-weighted within 50m radius)
- **Tag matches**: +0.05 per matching tag (Fuzzy match on labels and values)
- **Threshold**: 0.7 default, configurable per import batch

**Distance-weighted Location Scoring:**

- Formula: `max(0, 0.3 * (1 - distance_meters / 50))`
- Full points at 0m, zero points at 50m+
- Requires valid GPS coordinates for all imports

**String Processing:**

- Normalize: lowercase + remove punctuation + trim whitespace
- Artist handling: Split on separators (&, and, ,) and match any artist
- Tag matching: Fuzzy match on both tag labels and values

### Implementation Specifications

**Integration Point:** Mass import endpoint (`/api/mass-import`)

**Processing Flow:**

1. For each artwork in import batch, query existing artworks within 100m radius
2. Calculate similarity score against each nearby artwork
3. If score >= threshold, mark as duplicate and skip import
4. Generate comprehensive report with both successful imports and detected duplicates

**Duplicate Handling:**

- Skip import when duplicate detected
- Return existing artwork ID in response
- Log detailed individual duplicate records with scores

**Error Recovery:**

- Skip problematic artworks and continue with batch
- Log warnings for calculation failures

**Report Format:**

- Artwork title, confidence score, existing artwork URL
- Score breakdown (title: 0.1, artist: 0.2, location: 0.3, tags: 0.05)
- Existing artwork ID for reference

### API Changes

**Mass Import Endpoint Enhancement:**

- Add optional `duplicateThreshold` parameter (default: 0.7)
- Maintain backward compatibility
- Return duplicate detection results in response

**Response Format:**

```typescript
{
  imported: ArtworkRecord[],
  duplicates: {
    artworkId: string,
    title: string,
    confidenceScore: number,
    scoreBreakdown: {
      title: number,
      artist: number,
      location: number,
      tags: number
    },
    existingArtworkId: string,
    existingArtworkUrl: string
  }[]
}
```

## Implementation Details

### Configuration

- Hard-coded scoring weights and thresholds in application code
- Configurable threshold per import batch via API parameter

### Testing Strategy

- Unit tests with synthetic duplicate pairs
- Integration tests with real production data samples

### Logging

- Detailed logging of individual duplicate records with scores
- Track duplicate detection for analysis and algorithm tuning

### Database Considerations

- Expected batch size: 1000 artworks per import
- Processing: Individual artwork checking during import
- Spatial queries within 50m radius for location matching

## Technical Architecture

```typescript
interface SimilarityResult {
  score: number;
  breakdown: {
    title: number;
    artist: number; 
    location: number;
    tags: number;
  };
  isDuplicate: boolean;
  existingArtworkId?: string;
}

function calculateSimilarity(
  existingArtwork: ArtworkRecord, 
  newArtwork: MassImportItem,
  threshold: number = 0.7
): SimilarityResult
```

## Implementation Priority

**Phase 1 (MVP):**

- Core similarity calculation algorithm
- Integration with mass-import endpoint
- Basic reporting and logging

**Future Considerations:**

- Build exactly what's specified now
- Extend later based on actual usage patterns
- No UI changes required (purely backend feature)
