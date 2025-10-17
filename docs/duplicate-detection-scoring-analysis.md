# Duplicate Detection Scoring Analysis

**Date:** October 13, 2025  
**Report:** `reports/mass-import-2025-10-13-181739.json`  
**Issue:** 23 records marked as duplicates with threshold set to 1.0

## Problem Summary

The mass-import system reported 23 duplicates even though the `duplicateThreshold` was set to **1.0** (the maximum possible value). Investigation revealed that the duplicate detection scoring system can **exceed 1.0** due to unbounded tag matching.

## Scoring Algorithm (V2 System)

The V2 duplicate detection system uses a different scoring algorithm than documented in the main PRD:

### Scoring Components

| Component | Weight | Maximum Score | Notes |
|-----------|--------|---------------|-------|
| **GPS Location** | 0.6 | 0.6 points | Linear falloff from 0m to 100m |
| **Title Match** | 0.25 | 0.25 points | Levenshtein distance similarity |
| **Artist Match** | 0.2 | 0.2 points | Multi-artist name matching |
| **Reference IDs** | 0.5 | 0.5 points | External ID exact/fuzzy matching |
| **Tag Matches** | 0.05 per tag | **UNLIMITED** | 0.05 points per exact tag match |

### Maximum Possible Scores

- **Without any tags**: 1.55 points (0.6 + 0.25 + 0.2 + 0.5)
- **With 8 matching tags**: 1.95 points (1.55 + 0.4)
- **With 20 matching tags**: 2.55 points (1.55 + 1.0)

## Example: "Energy Alignment Sculpture: Pyramid in the Golden Section"

From the report, this artwork was flagged as duplicate with:

```json
"confidenceScore": 1.0893141945773523,
"scoreBreakdown": {
  "gps": 0.6,           // Perfect location match (within 100m)
  "title": 0.0438...,   // ~17% title similarity
  "artist": 0.0454...,  // ~22% artist similarity
  "referenceIds": 0,    // No external ID match
  "tagSimilarity": 0.4, // 8 exact tag matches!
  "total": 1.089
}
```

### Tag Matches (8 exact matches)

The artwork had 8 tags that exactly matched the existing record:
1. `source: "https://burnabyartgallery.ca"`
2. `artwork_type: "sculpture"`
3. `location: "Simon Fraser University, Academic Quadrangle"`
4. `start_date: "1976"`
5. `material: "steel"`
6. `category: "SFU Art Collection"`
7. `city: "burnaby"`
8. `province: "British Columbia"`

**Tag Score:** 8 × 0.05 = **0.4 points**

This pushed the total confidence score to 1.089, exceeding the threshold of 1.0.

## Why This Happened

1. **Previous Import**: The 94 artworks in this dataset were previously imported successfully (71 created new records)
2. **Threshold Too High**: Setting `duplicateThreshold: 1.0` was intended to disable duplicate detection
3. **Unbounded Scoring**: Tag matching can push scores above 1.0, making it impossible to truly "disable" duplicate detection
4. **Legitimate Duplicates**: All 23 "duplicates" are actual duplicates from the previous import

## Recommendations

### 1. Understanding Threshold Values

The threshold should be understood as follows:

| Threshold | Expected Behavior | Reality |
|-----------|-------------------|---------|
| **0.6** | Very aggressive duplicate detection | Will catch most duplicates based on location alone |
| **0.75** | Balanced detection (recommended) | Requires strong location + some other signals |
| **0.9** | Conservative detection | Requires near-perfect match on multiple signals |
| **1.0** | "Disable" duplicate detection | **Still detects perfect matches with 8+ tag matches** |
| **2.0+** | Truly disable detection | Requires impossibly high scores |

### 2. Proper Threshold Configuration

For different use cases:

**Trust Source, Disable Duplicates:**
```json
{
  "duplicateThreshold": 10.0  // Effectively disables duplicate detection
}
```

**Balanced Detection (Recommended):**
```json
{
  "duplicateThreshold": 0.75  // Catches clear duplicates, allows similar artworks
}
```

**Aggressive Deduplication:**
```json
{
  "duplicateThreshold": 0.65  // Catches more potential duplicates (more false positives)
}
```

### 3. Verifying First Import

To check if artworks were already imported:

```sql
SELECT COUNT(*) FROM artwork 
WHERE tags LIKE '%source_url":"https://collections.burnabyartgallery.ca%'
  AND status = 'approved';
```

If this returns 71+, the artworks from this import were already in the database.

### 4. Handling Re-imports

When re-importing the same dataset:

**Option A:** Skip duplicates (current behavior)
- Set threshold to 0.75
- Review duplicate report
- Duplicates are automatically skipped

**Option B:** Update existing records
- Use `--force-update` flag (if implemented)
- Merge new tags into existing records
- Update photos if changed

**Option C:** Truly ignore duplicates
- Set threshold to 10.0 or higher
- Creates duplicate records (not recommended)

## Bug or Feature?

This is a **design flaw**, not a bug:

### The Flaw

The scoring system allows **unbounded** tag matching, making it impossible to set a threshold that truly "disables" duplicate detection when artworks have many matching tags.

### Proposed Fix

**Option 1: Cap Tag Score** (Simplest)
```typescript
const tagScore = Math.min(this.calculateTagSimilarity(incoming.tags || {}, candidate.tags), 0.25);
```

This caps tag contribution at 0.25 points, keeping maximum total at 1.8.

**Option 2: Normalize Total Score** (Best)
```typescript
const rawTotal = gpsScore + titleScore + artistScore + refScore + tagScore;
const maxPossibleScore = weights.gps + weights.title + weights.artist + weights.referenceIds + 0.25;
const normalizedTotal = Math.min(rawTotal / maxPossibleScore, 1.0);
```

This ensures scores are always 0-1.0, making thresholds more intuitive.

**Option 3: Separate Tag Weight** (Most Flexible)
```typescript
const tagScore = (matchingTags / totalTags) * weights.tagSimilarity;
```

This makes tag matching proportional with a configurable weight, like other components.

## Conclusion

The 23 "duplicates" in your import are **legitimate duplicates** from a previous import. The scoring system correctly identified them as duplicates, but the threshold system is non-intuitive because:

1. Scores can exceed 1.0 due to unbounded tag matching
2. A threshold of 1.0 doesn't "disable" duplicate detection
3. The V2 scoring system differs from the documented PRD algorithm

**Immediate Action:** To truly skip duplicate detection for this import, set:
```json
{
  "duplicateThreshold": 10.0
}
```

**Long-term Fix:** Implement score normalization to keep all scores in 0-1.0 range.
