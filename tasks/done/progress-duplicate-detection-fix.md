# Mass Import Duplicate Detection Analysis - Progress Report

**Date**: September 16, 2025  
**Issue**: Second import of same OSM dataset is not detecting duplicates  
**Expected**: All 10 artworks should be flagged as duplicates on second import  
**Actual**: 0 duplicates detected, all 10 imported as new artworks

## Background

The user ran the same mass import command twice:

```powershell
node dist/cli/cli-entry.js import --importer osm-artwork --generate-report --input C:\Users\funvill\Documents\git\cultural-archiver\src\lib\data-collection\osm\output\merged\merged-artworks.geojson --output processed-art.json --exporter api --config .\dev-api-config.json --limit 10 --offset 0
```

The second run should have detected all 10 artworks as duplicates but instead imported them as new records.

## Current Analysis Progress

### [X] Task 1: Analyze duplicate checking issue

**Report Analysis**: The second import report shows:

- totalRecords: 10
- successful: 10
- duplicateRecords: 0
- All records have status: "successful" with reason: "exported"

**Sample External IDs from Report**:

- osm-4343692187 (Musqueam Post)
- osm-7504719377 (The Shadow)
- osm-7711922474 (Tuning Fork)
- osm-9441146840 (Man about to Plant Alfalfa)

**Key Finding**: The system is not detecting any duplicates when it should detect 10/10 as exact matches.

### [X] Task 2: Identify external ID handling

**CRITICAL DISCOVERY**: External IDs are **NOT being stored in tags**!

**Database Investigation Results**:

- ✅ API server is running on localhost:8787
- ✅ 342 artworks exist in database from previous imports
- ❌ **External IDs are missing from tags field**

**Actual tag storage**:

```json
{
  "osm_type": "node",
  "artwork_type": "mural",
  "tourism": "artwork",
  "source": "openstreetmap",
  "import_batch": "mass-import-1758050799236-83nn21oy1"
}
```

**External ID location**: Only in description as text: "Imported from Open Street Maps (node: osm-8441749019)"

### [X] Task 3: Trace duplicate detection flow

**Root Cause Identified**:

1. **Mass Import V2 API**: `http://localhost:8787/api/mass-import/v2`
2. **Duplicate Detection**: Looks for `tags.external_id === incoming.externalId`
3. **Storage Issue**: External IDs are never saved to `tags.external_id` field
4. **Result**: Duplicate detection always fails because external_id field doesn't exist

### [X] Task 4: Create comprehensive improvement plan

**EXACT ROOT CAUSE IDENTIFIED**: Line 484-489 in `/src/workers/routes/mass-import-v2.ts`

The API endpoint creates tags object WITHOUT the external_id:

```typescript
JSON.stringify({
  ...artworkData.tags, // OSM tags only
  source: artworkData.source, // ✅ Added
  import_batch: request.metadata.importId, // ✅ Added
  // ❌ artworkData.externalId is MISSING!
});
```

**Should be**:

```typescript
JSON.stringify({
  ...artworkData.tags,
  source: artworkData.source,
  import_batch: request.metadata.importId,
  external_id: artworkData.externalId, // ⬅ ADD THIS LINE
});
```

### COMPREHENSIVE IMPROVEMENT PLAN

#### Fix 1: Primary Issue - Add External ID to Tags Storage

**File**: `/src/workers/routes/mass-import-v2.ts`  
**Line**: 484-489  
**Change**: Add `external_id: artworkData.externalId` to tags object

**Before**:

```typescript
JSON.stringify({
  ...artworkData.tags,
  source: artworkData.source,
  import_batch: request.metadata.importId,
});
```

**After**:

```typescript
JSON.stringify({
  ...artworkData.tags,
  source: artworkData.source,
  import_batch: request.metadata.importId,
  external_id: artworkData.externalId || null,
});
```

#### Fix 2: Improve Duplicate Detection Robustness

**File**: `/src/workers/lib/mass-import-v2-duplicate-detection.ts`  
**Enhancement**: Add fallback checks and better logging

**Current Issues**:

- Only checks `tags.external_id === incoming.externalId`
- No fallback mechanisms
- Limited logging for debugging

**Improvements**:

1. Add description parsing as fallback
2. Improve external ID extraction from various formats
3. Enhanced logging for duplicate detection debugging

#### Fix 3: Data Migration for Existing Records

**Challenge**: 342 existing artworks lack external_id in tags

**Solution Options**:

1. **Database Migration Script**: Extract external IDs from descriptions
2. **Gradual Update**: Fix during next data refresh
3. **Retroactive Parsing**: Parse external IDs from description field

**Recommended**: Database migration to extract external IDs from description patterns like "osm-4343692187"

#### Fix 4: Testing Strategy

**Test Cases**:

1. Import same dataset twice (current failing case)
2. Import with mixed new/duplicate records
3. Import with missing external IDs (edge case)
4. Import with malformed external IDs

**Verification Steps**:

1. Check tags contain `external_id` field after import
2. Verify duplicate detection works on second import
3. Confirm 100% duplicate detection on identical datasets

#### Fix 5: Enhanced Error Handling

**Improvements**:

1. Validate external_id presence before duplicate detection
2. Log when external_id is missing or malformed
3. Provide clear error messages for debugging

### IMPLEMENTATION PRIORITY

**High Priority (Immediate)**:

1. ✅ Fix external_id storage in mass-import-v2.ts (1 line change)
2. ✅ Test with user's exact failing case
3. ✅ Verify 10/10 duplicates detected on second import

**Medium Priority (Next Sprint)**:

1. Database migration for existing records
2. Enhanced duplicate detection robustness
3. Comprehensive test suite

**Low Priority (Future)**:

1. Advanced similarity scoring
2. UI improvements for duplicate handling
3. Bulk duplicate resolution tools

### [X] Task 5: Document findings and recommendations

## FINAL SUMMARY

### Root Cause

**Single-line fix required**: External IDs are not being stored in artwork tags during mass import.

**Location**: `/src/workers/routes/mass-import-v2.ts`, lines 484-489

**Problem**: Tags object creation omits `artworkData.externalId`

**Solution**: Add `external_id: artworkData.externalId || null` to tags object

### Immediate Fix

```typescript
// Change line ~484-489 in /src/workers/routes/mass-import-v2.ts
JSON.stringify({
  ...artworkData.tags,
  source: artworkData.source,
  import_batch: request.metadata.importId,
  external_id: artworkData.externalId || null, // ADD THIS LINE
});
```

### Verification Steps

1. Apply the fix
2. Run the same import command twice
3. Expect: Second run shows 10/10 duplicates detected
4. Check database: Verify `tags.external_id` field exists

### Long-term Improvements

1. Database migration for 342 existing records missing external_id
2. Enhanced duplicate detection with fallback mechanisms
3. Comprehensive test suite for duplicate scenarios

### Status: READY FOR IMPLEMENTATION

- Root cause identified ✅
- Solution designed ✅
- Implementation path clear ✅
- Test case available ✅

---

_This document serves as persistent memory for the AI agent working on this issue and can be handed off to another developer if needed._

## Technical Investigation

### Duplicate Detection Systems Found

The codebase has multiple duplicate detection implementations:

1. **Mass Import V2 System** (`/src/workers/lib/mass-import-v2-duplicate-detection.ts`)
   - Used by the `/api/mass-import/v2` endpoint
   - Handles both artwork and artist duplicates
   - Has configurable scoring weights

2. **Legacy Mass Import System** (`/src/workers/lib/mass-import-duplicate-detection.ts`)
   - Older implementation
   - Uses similarity strategy from shared library

3. **CLI System** (`/src/lib/mass-import-system/lib/duplicate-detection.ts`)
   - Standalone duplicate detection for CLI tools
   - Multiple detection methods: external ID, content hash, geographic proximity

### External ID Handling Analysis

**External ID Format**: OSM artworks use format `osm-{node_id}` (e.g., `osm-4343692187`)

**Storage Location**: External IDs are stored in the `tags` JSON field of artwork records as:

```json
{
  "external_id": "osm-4343692187",
  "source": "openstreetmap",
  "...": "other tags"
}
```

**Duplicate Detection Logic**: The system should check for exact matches on:

- `tags.external_id === incoming.externalId`
- `tags.source === incoming.source`

## Root Cause Hypothesis

Based on initial analysis, potential issues:

1. **API Endpoint Mismatch**: The CLI may be hitting a different API endpoint than expected
2. **External ID Format**: Mismatch between how external IDs are stored vs. queried
3. **Source Field**: Inconsistency in source field values ("openstreetmap" vs "osm-artwork" vs other)
4. **Database Query Issues**: External ID queries may not be working correctly
5. **Transaction Isolation**: First import may not be committed before second import runs

## Next Investigation Steps

1. ✅ **Examine the report structure and confirm zero duplicates detected**
2. 🔄 **Check which API endpoint the CLI is actually using**
3. 🔄 **Verify external ID storage format in database after first import**
4. 🔄 **Trace the duplicate detection logic step by step**
5. 🔄 **Test external ID matching logic with sample data**

## Files Examined

- `src/lib/mass-import-system/reports/mass-import-2025-09-16-122834.json` - Second import report
- `src/workers/routes/mass-import-v2.ts` - Mass Import V2 API endpoint
- `src/workers/lib/mass-import-v2-duplicate-detection.ts` - V2 duplicate detection service
- `src/lib/mass-import-system/lib/duplicate-detection.ts` - CLI duplicate detection
- Various configuration and importer files for OSM processing

## Current Status

**Active Task**: Analyzing duplicate checking issue (Task 1)  
**Next Task**: Identify external ID handling (Task 2)  
**Estimated Completion**: Analysis should be complete within next few investigation cycles

---

_This document serves as persistent memory for the AI agent working on this issue and can be handed off to another developer if needed._
