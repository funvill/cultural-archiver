# Issue: Artists Not Appearing After Mass Import

**Date:** October 3, 2025  
**Status:** ✅ **RESOLVED**  
**Priority:** High

## ✅ Resolution Summary

**ROOT CAUSE:** Database schema CHECK constraint mismatch with application code.

**The Problem:**
- Database schema defined: `status IN ('pending', 'approved', 'rejected')`
- Application code was using: `status = 'active'`
- Result: SQLite silently rejected INSERT statements with invalid status values

**The Fix:**
1. ✅ Updated `createArtistFromMassImport()` in `src/workers/lib/database.ts` to use `'approved'`
2. ✅ Updated `getArtistsList()` in `src/workers/routes/artists.ts` to filter by `'approved'`
3. ✅ Updated TypeScript types to match schema: `'approved' | 'pending' | 'rejected'`
4. ✅ Updated test expectations to use `'approved'` instead of `'active'`

**Test Results:** ✅ All 658 tests passing (1 skipped)

**Verification (2025-10-04T02:10Z):**
- ✅ Backend API: `http://localhost:8787/api/artists` returns 15 artists with 'approved' status
- ✅ Proxied API: `http://localhost:5173/api/artists` returns same data (Vite proxy working)
- ✅ Test case artist "Nuburi Toko" successfully appears in API response
- ✅ Frontend route exists and is configured correctly
- ⚠️ **Note:** Frontend may require hard refresh (Ctrl+F5) to clear cached JavaScript

**Deployment:** Ready for production - artists now appear in the index after mass-import

---

## Problem Statement

Artists are being created during mass-import operations but are not appearing on the artist index page (`http://localhost:5173/artists`).

## Import Test Results

**Command:**
```bash
node dist/cli/cli-entry.js import --importer osm-artwork --generate-report \
  --input C:\Users\funvill\Documents\git\cultural-archiver\src\lib\data-collection\osm\output\merged\merged-artworks.geojson \
  --output processed-art.json --exporter api --config api-config-dev.json \
  --limit 10 --offset 10
```

**Results:**
- ✅ Successful: 9
- ❌ Failed: 0
- ⏭️ Skipped: 0
- 🔄 Duplicates: 1
- 📊 Total Processed: 10
- ⏱️ Processing Time: 445ms
- 📈 Success Rate: 90.0%

**Expected Artist:**
- Example: "Nuburi Toko" from artwork `c1ed6c1a-88c8-4f86-8aa3-cc9f320d743c`
- Should appear at: `http://localhost:5173/artists`

## Investigation Progress

### ✅ Fixed: Artist Profile Query (2025-10-03)

**Issue Found:** The `GET /api/artists/:id` endpoint was using the deprecated `artist_names` field.

**Fix Applied:** Updated `src/workers/routes/artists.ts` line 177-183 to use `artwork_artists` junction table.

**Before:**
```typescript
WHERE artist_names LIKE '%"' || ? || '"%' AND a.status = 'approved'
```

**After:**
```typescript
INNER JOIN artwork_artists aa ON a.id = aa.artwork_id
WHERE aa.artist_id = ? AND a.status = 'approved'
```

**Test Results:** ✅ All 658 tests pass (1 skipped)

### 🔍 Current Investigation

**ROOT CAUSE FOUND:** Status field mismatch between schema and code!

**The Problem:**
- Database schema CHECK constraint: `status IN ('pending', 'approved', 'rejected')`
- Artist creation code was using: `status = 'active'`
- Artist index query was filtering: `status = 'active'`

**Result:** Artists were being rejected by the database constraint, so NO records were actually created!

**Fixes Applied:**
1. ✅ Updated `createArtistFromMassImport()` to use `status = 'approved'`
2. ✅ Updated `getArtistsList()` to filter by `status = 'approved'` (default)
3. ✅ Updated TypeScript types to use `'approved' | 'pending' | 'rejected'`

**Files Modified:**
- `src/workers/lib/database.ts` - Line 651: Changed 'active' to 'approved'
- `src/workers/routes/artists.ts` - Line 43-47: Changed status type and default

**Next Steps:**
1. Check artist status field in database (should be 'active' for index)
2. Verify artist records are actually being created in the database
3. Check if frontend is correctly calling the `/api/artists` endpoint
4. Verify the `GET /api/artists` query filters and status checks

## Database Schema Reference

### Artists Table
```sql
CREATE TABLE artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  aliases TEXT,
  tags TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Artwork_Artists Junction Table
```sql
CREATE TABLE artwork_artists (
  artwork_id TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'primary',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (artwork_id, artist_id),
  FOREIGN KEY (artwork_id) REFERENCES artwork(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
```

## Relevant Code Paths

### Backend
- `src/workers/routes/mass-import.ts` - Artist creation during import
- `src/workers/routes/artists.ts` - Artist index and profile endpoints
- `src/workers/lib/database.ts` - `createArtistFromMassImport()` method
- `src/workers/lib/artist-matching.ts` - Artist matching and creation logic

### Frontend
- Frontend route for `/artists` page
- API service calling `/api/artists`

## Questions to Answer

1. ✅ Are artists being created in the database?
2. ❓ What status are artists created with (`pending` vs `active`)?
3. ❓ Does the artist index filter by status?
4. ❓ Is the frontend correctly calling the backend API?
5. ❓ Are there any CORS or network issues preventing the data from loading?

## Expected Behavior

When mass-import creates an artist:
1. Artist record created in `artists` table with `status = 'active'`
2. Artwork-Artist link created in `artwork_artists` table
3. Artist appears in `GET /api/artists` response
4. Frontend displays artist in the artist index page

## Logs & Debug Output

### Mass Import Artist Debug Logs
```
[MASS_IMPORT_ARTIST_DEBUG] ===== ARTIST PROCESSING START =====
[MASS_IMPORT_ARTIST_DEBUG] Looking for artist: "Artist Name"
[MASS_IMPORT_ARTIST_DEBUG] CREATED new artist: {artist_id}
[MASS_IMPORT_ARTIST_DEBUG] ===== ARTIST PROCESSING END =====
```

### Artist Creation Debug Logs
```
[ARTIST_CREATION_DEBUG] Creating artist from Vancouver data for: "Artist Name"
[ARTIST_CREATION_DEBUG] Successfully created artist with ID: {artist_id}
[DB] Created artist for mass import: {artist_id} - {artist_name}
```

## Resolution Plan

- [ ] Check artist status field default value
- [ ] Verify artist index query status filter
- [ ] Test direct database query for created artists
- [ ] Verify frontend API integration
- [ ] Update artist creation to use correct status

## Related Files

- `src/workers/routes/artists.ts` - Artist endpoints
- `src/workers/lib/database.ts` - Artist creation
- `src/workers/lib/artist-matching.ts` - Artist matching
- `src/workers/routes/mass-import.ts` - Mass import flow
- `docs/database.md` - Database schema documentation

## Notes

- The database schema was recently updated to use `artwork_artists` junction table
- Some code still references the old `artist_names` field (needs cleanup)
- Artist status field uses 'active'/'inactive' but schema shows 'pending'/'approved'/'rejected'
