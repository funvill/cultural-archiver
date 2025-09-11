# Issue: Mass Import Duplicate Detection Failures

## Summary

Mass import duplicate detection is failing to prevent duplicate imports, causing:

- 2 duplicate artworks imported when 0 expected
- 8.2 minute processing time vs 1 minute expected  
- External ID duplicate detection not working correctly

## Evidence

### Attempt #1 (1757559146353.json)
- Import 0-50 records to clean database
- 43 successful imports including:
  - Record 613: "down. town." (created as artwork ID 613)
  - Record 703: "You Made It" 

### Attempt #2 (1757559354609.json) 
- Re-import same 0-50 records
- Expected: 0 successful imports, 50 duplicates detected
- Actual: 2 successful imports, 41 duplicates detected, 7 failed validation

### Attempt #3 (1757560469189.json) - SAME ISSUE AFTER FIX ATTEMPT
- Re-import same 0-50 records
- Expected: 0 successful imports, 50 duplicates detected  
- **Actual: 2 successful imports (same records 613 & 703), 41 duplicates detected**

**Problem Records:**
- Record 613 "down. town.": `duplicateDetection: { isDuplicate: false, candidates: [] }`
- Record 703 "You Made It": Similar issue

## Root Cause Analysis

### Issue Confirmed Through Debug Testing

**Debug Test Results (Record 613):**
- ✅ **Coordinates correct**: `49.279663, -123.114234`
- ✅ **Nearby search works**: Found 2 nearby artworks (617, 571)  
- ✅ **API functioning**: `/api/artworks/nearby` returns data
- ✅ **Tag parsing works**: Tags show proper `external_id` and `source`
- ❌ **Critical Issue**: Previously imported record 613 is NOT in nearby search results

### The Real Problem

**Records 613 and 703 are being marked as "successfully imported" but are NOT actually being saved to the database.** 

Evidence:
1. **Missing submissionId**: Records 613/703 lack `submissionId` field (indicates database save failure)
2. **Not in nearby search**: When searching at exact same coordinates, previously "imported" record 613 is not found
3. **Repeated success**: Same records get "successfully" imported multiple times

### Database Save Failure

The mass import system has a bug where:
1. Record passes validation ✅
2. Record passes duplicate detection ✅ 
3. API call appears successful ✅
4. **Database save silently fails** ❌
5. Record marked as successful anyway ❌
6. **Record is NOT actually in database** ❌

## Impact

- **Data Integrity**: Artworks appear imported but don't exist in database
- **Performance**: 8x slowdown due to records being "imported" multiple times
- **User Experience**: Confusion about what was actually imported
  }
};
// Expected: Warning about coordinates outside Vancouver bounds
```

## Implementation Steps

### Step 1: Fix Vancouver Mapper
```typescript
function mapVancouverToRawData(data: VancouverArtworkData): RawImportData | null {
  // Extract coordinates with proper null checking
  let lat: number | undefined;
  let lon: number | undefined;
  
  if (data.geo_point_2d?.lat && data.geo_point_2d?.lon) {
    lat = data.geo_point_2d.lat;
    lon = data.geo_point_2d.lon;
  } else if (data.geom?.geometry?.coordinates && Array.isArray(data.geom.geometry.coordinates)) {
    [lon, lat] = data.geom.geometry.coordinates; // GeoJSON is [lon, lat]
  }
  
  if (!lat || !lon) {
    console.warn(`Skipping artwork ${data.registryid}: No valid coordinates found`);
    return null; // Skip this artwork
  }
  
  // Continue with rest of mapping...
}
```

### Step 2: Update Data Processor
```typescript
// Handle null return from mapper
const mappedData = mapVancouverToRawData(rawData);
if (!mappedData) {
  stats.skipped++;
  continue; // Skip to next artwork
}
```

### Step 3: Enhanced Validation
```typescript
function validateCoordinates(lat: number, lon: number, config: MassImportConfig) {
  // Add checks for NaN, undefined, null
  if (!isFinite(lat) || !isFinite(lon)) {
    errors.push({
      field: 'coordinates',
      message: 'Invalid coordinates: lat or lon is not a finite number',
      severity: 'error'
    });
  }
}
```

## Verification Strategy

### Pre-Implementation Verification
1. **Count artworks with null coordinates**: `grep -c "geo_point_2d.*null" tasks/public-art.json`
2. **Identify coordinate sources**: Check how many artworks have `geom` vs `geo_point_2d`
3. **Database coordinate audit**: Query existing database for duplicate coordinates

### Post-Implementation Testing
1. **Import test run**: Process small batch (10-20 artworks) including null coordinate cases
2. **Duplicate detection test**: Import same artwork twice to verify detection works
3. **Coordinate validation**: Ensure no artworks imported with invalid coordinates
4. **External ID verification**: Confirm external_id tagging works correctly

### Success Criteria
- ✅ Zero artworks imported with undefined/null coordinates  
- ✅ Duplicate detection works correctly (no false duplicates due to coordinate issues)
- ✅ External ID tagging stores and retrieves properly
- ✅ Appropriate warnings logged for skipped artworks
- ✅ Import success rate maintained or improved

## Database Impact Analysis

### Current State Issues
- Multiple artworks may exist with identical coordinates due to coordinate extraction failures
- External ID tagging may be inconsistent preventing duplicate detection
- Location-based searches may return clustered results at invalid coordinates

### Post-Fix Expected State
- Each artwork has unique, valid coordinates or is properly skipped
- Duplicate detection functions correctly using external IDs
- Geographic searches return accurate location-based results
- Import process provides clear feedback on skipped artworks

This comprehensive analysis and fix plan should resolve the coordinate collision issue and restore proper duplicate detection functionality in the mass import system.
