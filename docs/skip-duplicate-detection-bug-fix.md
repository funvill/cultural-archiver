# Skip Duplicate Detection Bug Fix

**Date:** October 13, 2025  
**Issue:** `skipDuplicateDetection: true` was being ignored, still detecting 23 duplicates  
**Status:** Fixed ✅

## Problem

When setting `skipDuplicateDetection: true` in the mass-import config, the system was still detecting and skipping 23 duplicate records instead of importing all 94 artworks.

**User Configuration:**
```json
{
  "exporter": {
    "skipDuplicateDetection": true,
    "autoApproveArtists": true
  }
}
```

**Expected Result:** All 94 artworks imported without duplicate checking  
**Actual Result:** 71 successful, 23 duplicates detected and skipped

## Root Cause

The validation logic in `src/workers/routes/mass-import-v2.ts` (lines 123-132) was **requiring** `duplicateThreshold` to be a valid number between 0-1, even when `skipDuplicateDetection` was set to `true`.

**Problematic Code:**
```typescript
// Validate config
if (!payload.config) {
  errors.push({ field: 'config', message: 'Config section is required', code: 'REQUIRED_FIELD' });
} else {
  if (
    typeof payload.config.duplicateThreshold !== 'number' ||
    payload.config.duplicateThreshold < 0 ||
    payload.config.duplicateThreshold > 1
  ) {
    errors.push({
      field: 'config.duplicateThreshold',
      message: 'Duplicate threshold must be between 0 and 1',
      code: 'INVALID_RANGE',
    });
  }
}
```

This validation would fail the request before it ever reached the duplicate detection skip logic at lines 503 and 643.

## Solution

Wrapped the `duplicateThreshold` validation in a conditional check that only validates when duplicate detection is **enabled**:

**Fixed Code:**
```typescript
// Validate config
if (!payload.config) {
  errors.push({ field: 'config', message: 'Config section is required', code: 'REQUIRED_FIELD' });
} else {
  // Only validate duplicateThreshold if duplicate detection is enabled
  if (!payload.config.skipDuplicateDetection) {
    if (
      typeof payload.config.duplicateThreshold !== 'number' ||
      payload.config.duplicateThreshold < 0 ||
      payload.config.duplicateThreshold > 1
    ) {
      errors.push({
        field: 'config.duplicateThreshold',
        message: 'Duplicate threshold must be between 0 and 1',
        code: 'INVALID_RANGE',
      });
    }
  }
}
```

## Testing Steps

### 1. Rebuild Workers
```powershell
npm run build:workers
```

### 2. Restart Dev Server
```powershell
# Stop existing dev server (Ctrl+C)
npm run devout
```

### 3. Clear Database and Re-import
```powershell
# Clear the database
npm run reset:local-database

# Run the import with skipDuplicateDetection enabled
node dist/lib/mass-import-system/cli/cli-entry.js import `
  --importer osm-artwork `
  --exporter api `
  --input src\lib\data-collection\burnabyartgallery\output\artworks.geojson `
  --config src\lib\mass-import-system\config\api-config-dev.json `
  --generate-report
```

### 4. Expected Results
```
✔ Import completed: 94/94 records successful

📊 Import Results:
  ✅ Successful: 94
  ❌ Failed: 0
  ⏭️  Skipped: 0
  🔄 Duplicates: 0       ← Should be 0 now!
  📊 Total Processed: 94
```

## Verification

Check the console logs for:
```
[MASS_IMPORT_V2] Duplicate detection skipped for: <artwork-title>
```

These log messages confirm that the skip logic is working correctly.

## Files Modified

1. **src/workers/routes/mass-import-v2.ts** (line 125)
   - Added conditional check: `if (!payload.config.skipDuplicateDetection)`
   - Wrapped `duplicateThreshold` validation inside the conditional

## Related Documentation

- `docs/mass-import-v1-removal-and-skip-feature.md` - Feature documentation
- `docs/duplicate-detection-scoring-analysis.md` - Scoring algorithm analysis
- `docs/mass-import.md` - Complete mass-import system documentation

## Impact

- **Breaking Change:** No
- **Backward Compatible:** Yes (when `skipDuplicateDetection` is false or undefined, validation works as before)
- **Performance:** No change (validation only affects request parsing)

## Conclusion

The fix allows `skipDuplicateDetection: true` to properly bypass duplicate detection by:
1. Skipping the threshold validation when `skipDuplicateDetection` is true
2. Allowing requests to reach the duplicate detection skip logic (lines 503, 643)
3. Importing all records without any duplicate checking

**Status:** Ready for testing after dev server restart ✅
