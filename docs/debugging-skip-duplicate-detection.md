# Debugging Skip Duplicate Detection Issue

**Date:** October 13, 2025  
**Issue:** `skipDuplicateDetection: true` not working despite multiple fixes  
**Status:** Debugging in progress 🔍

## Problem Timeline

### Initial Issue
User set `skipDuplicateDetection: true` in config but still saw 23 duplicates out of 94 records.

### Investigation Steps

#### 1. First Discovery - Validation Bug (FIXED ✅)
**File:** `src/workers/routes/mass-import-v2.ts` (lines 123-132)

**Problem:** The validation code required `duplicateThreshold` to be a valid number even when `skipDuplicateDetection` was true.

**Fix Applied:**
```typescript
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
```

**Result:** Validation now passes, but duplicates still detected.

#### 2. Second Discovery - Stale Build Cache (IN PROGRESS 🔄)

**Problem:** Multiple rebuilds didn't update the running dev server code.

**Evidence:**
- Compiled file `dist/workers/routes/mass-import-v2.js` dated October 7, 2025 (6 days old)
- Manual rebuild updated `src/workers/dist/workers/routes/mass-import-v2.js` to October 13
- Dev server still running old code - debug logs not appearing

**Root Cause:** Wrangler dev caches transpiled TypeScript in `.wrangler/` folder

**Fix Applied:**
1. Delete `.wrangler` folder (root)
2. Delete `src/workers/.wrangler` folder
3. Restart dev server with `npm run devout`

**Status:** Dev server restarting with cleared cache

#### 3. Debug Logging Added

**File:** `src/workers/routes/mass-import-v2.ts` (line ~305)

```typescript
console.log(
  `[MASS_IMPORT_V2] Config: skipDuplicateDetection=${request.config.skipDuplicateDetection}, threshold=${request.config.duplicateThreshold}`
);
```

This will show us what config values the backend actually receives.

## Configuration Chain

### 1. CLI Config File
**Location:** `src/lib/mass-import-system/config/api-config-dev.json`

```json
{
  "exporter": {
    "skipDuplicateDetection": true,
    "autoApproveArtists": true
  }
}
```

### 2. API Exporter
**File:** `src/lib/mass-import-system/exporters/api-exporter.ts` (lines 703, 743)

```typescript
config: {
  duplicateThreshold: this.config?.duplicateThreshold ?? 0.75,
  skipDuplicateDetection: this.config?.skipDuplicateDetection ?? false,
  enableTagMerging: true,
  createMissingArtists: true,
  batchSize: 1,
}
```

**Potential Issue:** The default `?? false` means if `this.config` is null/undefined, it defaults to false!

### 3. Backend Request
**File:** `src/workers/routes/mass-import-v2.ts` (line ~507)

```typescript
if (!request.config.skipDuplicateDetection) {
  // Run duplicate detection
} else {
  console.log(`[MASS_IMPORT_V2] Duplicate detection skipped for: ${artworkData.title}`);
}
```

## Expected Behavior vs Actual

### Expected with `skipDuplicateDetection: true`
```
✔ Import completed: 94/94 records successful

📊 Import Results:
  ✅ Successful: 94
  🔄 Duplicates: 0
```

### Actual Results (All 4 Attempts)
```
✔ Import completed: 71/94 records successful

📊 Import Results:
  ✅ Successful: 71
  🔄 Duplicates: 23
```

The numbers are consistent - same 23 duplicates every time.

## Verification Steps After Cache Clear

1. **Check Debug Logs:**
```powershell
Select-String -Path "dev-server-logs.txt" -Pattern "Config: skipDuplicateDetection"
```

Expected output:
```
[MASS_IMPORT_V2] Config: skipDuplicateDetection=true, threshold=0.75
```

2. **Check Skip Messages:**
```powershell
Select-String -Path "dev-server-logs.txt" -Pattern "Duplicate detection skipped"
```

Expected: 94 lines (one per artwork)

3. **Check Duplicate Messages:**
```powershell
Select-String -Path "dev-server-logs.txt" -Pattern "Duplicate artwork detected"
```

Expected: 0 lines (none should be detected)

## Possible Root Causes (Hypotheses)

### Hypothesis 1: Config Not Passed Through ✅ DISPROVEN
- Import report shows `"skipDuplicateDetection": true` in exporterConfig
- Config file correctly formatted
- Type definitions correct

### Hypothesis 2: Validation Rejecting Request ✅ FIXED
- Fixed validation to skip threshold check when skipDuplicateDetection is true
- Request now passes validation

### Hypothesis 3: Stale Build Cache 🔄 TESTING
- `.wrangler` folder caching old transpiled code
- Dev server not picking up TypeScript changes
- **Current Test:** Cache cleared, server restarting

### Hypothesis 4: Nullish Coalescing Issue ⚠️ POSSIBLE
**File:** `api-exporter.ts`
```typescript
skipDuplicateDetection: this.config?.skipDuplicateDetection ?? false,
```

If `this.config` is an object but `skipDuplicateDetection` property doesn't exist, it would be `undefined`, which would fall back to `false`.

**Need to check:** Is the property being read correctly from the JSON config?

## Files Modified

1. `src/workers/routes/mass-import-v2.ts`
   - Line 125: Added conditional check for skipDuplicateDetection before validating threshold
   - Line 305: Added debug logging for config values

## Next Steps

1. ✅ Wait for dev server to fully restart with cleared cache
2. ⏳ Run import again
3. ⏳ Check debug logs for actual config values
4. ⏳ If still failing, add more granular logging to trace config through the entire pipeline

## Related Files

- `src/shared/mass-import.ts` - Type definitions
- `src/lib/mass-import-system/exporters/api-exporter.ts` - Config pass-through
- `src/workers/routes/mass-import-v2.ts` - Backend duplicate detection logic
- `src/workers/lib/mass-import-v2-duplicate-detection.ts` - Duplicate detection service

## Build Commands

```powershell
# Build workers
cd src/workers
npm run build
cd ../..

# Clear cache and restart
Remove-Item -Recurse -Force .wrangler -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force src/workers/.wrangler -ErrorAction SilentlyContinue
npm run devout

# Run import
node dist/lib/mass-import-system/cli/cli-entry.js import `
  --importer osm-artwork `
  --exporter api `
  --input src\lib\data-collection\burnabyartgallery\output\artworks.geojson `
  --config src\lib\mass-import-system\config\api-config-dev.json `
  --generate-report
```

## Success Criteria

- ✅ Debug log shows `skipDuplicateDetection=true`
- ✅ All 94 artworks imported successfully
- ✅ 0 duplicates detected
- ✅ Console shows 94 "Duplicate detection skipped" messages
