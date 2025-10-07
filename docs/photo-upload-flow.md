# Photo Upload and Processing Flow

**Last Updated:** October 6, 2025  
**Related Files:**
- `src/workers/lib/photos.ts` - Upload and processing logic
- `src/workers/routes/images.ts` - On-demand resizing endpoint
- `src/workers/lib/image-processing.ts` - Image transformation utilities

## Overview

When a user uploads a photo, it goes through a multi-stage pipeline that handles validation, storage, EXIF processing, and automatic variant generation. The system is designed with **separation of concerns** between source images (`originals/`) and cached variants (`artworks/`).

---

## Upload Flow

### Stage 1: File Validation

**Location:** `src/workers/lib/photos.ts` → `validatePhotoFiles()`

**Process:**
1. Check file count (max 3 photos per submission)
2. Validate each file:
   - File name exists
   - Size under 15MB
   - MIME type is supported (JPEG, PNG, WebP, HEIC, HEIF)
   - File has content (not empty)

**Output:** List of valid files or validation errors

---

### Stage 2: Secure Filename Generation

**Location:** `src/workers/lib/photos.ts` → `generateSecureFilename()`

**Process:**
1. Extract extension from MIME type
2. Generate timestamp: `YYYYMMDD-HHMMSS`
3. Generate short UUID (8 characters)
4. Clean original filename (alphanumeric only, max 20 chars)
5. Combine: `{timestamp}-{uuid}-{cleanName}.{ext}`

**Example Output:**
```
20251006-161523-a3f8d2e1-sculpture.jpg
```

---

### Stage 3: R2 Key Generation

**Location:** `src/workers/lib/photos.ts` → `generateR2Key()`

**Process:**
1. Generate date folder: `YYYY/MM/DD`
2. Combine with base path: `originals/`
3. Final key: `originals/{YYYY}/{MM}/{DD}/{filename}`

**Example Output:**
```
originals/2025/10/06/20251006-161523-a3f8d2e1-sculpture.jpg
```

**⚠️ CRITICAL:** Photos are **always uploaded to `originals/` folder**, never `artworks/`

---

### Stage 4: EXIF Processing (Optional)

**Location:** `src/workers/lib/photos.ts` → `processAndUploadPhotos()`

**Conditions:**
- Enabled by default (`preserveExif !== false`)
- Only for JPEG images
- Only when `artworkId` is provided

**Process:**
1. Extract EXIF data from image
2. Inject permalink to artwork page (in EXIF comment field)
3. Preserve GPS coordinates if present
4. Return processed buffer

**Purpose:** 
- Add attribution/permalink to downloaded photos
- Preserve photographer metadata
- Maintain location data for mapping

---

### Stage 5: Upload to R2 Storage

**Location:** `src/workers/lib/photos.ts` → `uploadToR2()`

**Process:**
1. Convert File to ArrayBuffer
2. Prepare metadata:
   - `Submission-ID`: Links to submission
   - `Original-Filename`: User's filename
   - `Upload-Source`: Source type (e.g., "logbook-submission")
   - `EXIF-Processed`: Whether EXIF was modified
   - `Permalink-Injected`: Artwork ID if permalink added
3. Upload to R2 bucket with:
   - HTTP metadata (Content-Type, Content-Length)
   - Custom metadata (tracking info)

**Storage Location:**
```
PHOTOS_BUCKET/originals/2025/10/06/20251006-161523-a3f8d2e1-sculpture.jpg
```

**Metadata Example:**
```json
{
  "Content-Type": "image/jpeg",
  "Content-Length": "2458632",
  "Upload-Timestamp": "2025-10-06T16:15:23.456Z",
  "Submission-ID": "abc123",
  "Original-Filename": "my_sculpture.jpg",
  "File-Index": "0",
  "Upload-Source": "logbook-submission",
  "EXIF-Processed": "true",
  "Permalink-Injected": "artwork-uuid-here"
}
```

---

### Stage 6: Cache Warming (Background)

**Location:** `src/workers/lib/photos.ts` → `warmImageCache()`

**Trigger:** Automatically after successful upload (fire-and-forget)

**Process:**
1. For each uploaded photo:
   - Generate `thumbnail` variant (400x400px)
   - Generate `medium` variant (1024x1024px)
2. Store variants with **automatic path mapping**:
   - Source: `originals/2025/10/06/photo.jpg`
   - Variant: `artworks/2025/10/06/photo__400x400.jpg`
   - Variant: `artworks/2025/10/06/photo__1024x1024.jpg`

**Path Mapping Logic:**
```typescript
generateVariantKey('originals/2025/10/06/photo.jpg', 'thumbnail')
// Returns: 'artworks/2025/10/06/photo__400x400.jpg'
```

**Why Background?**
- Don't block upload response
- Improve first-view performance
- Pre-generate common sizes

**Variant Metadata:**
```json
{
  "Content-Type": "image/jpeg",
  "Original-Key": "originals/2025/10/06/photo.jpg",
  "Variant": "thumbnail",
  "Generated-At": "2025-10-06T16:15:24.789Z",
  "Width": "400",
  "Height": "400",
  "Cache-Warmed": "true"
}
```

---

## On-Demand Image Resizing

### When Cache Warming Isn't Done Yet

If a variant is requested before cache warming completes (or if warming failed), the system generates it on-demand.

**Location:** `src/workers/routes/images.ts` → `GET /api/images/:size/*`

### Request Flow

1. **Client requests image:**
   ```
   GET https://api.publicartregistry.com/api/images/medium/originals/2025/10/06/photo.jpg
   ```

2. **Extract parameters:**
   - `size` = `medium`
   - `imagePath` = `originals/2025/10/06/photo.jpg`

3. **Validate request:**
   - Size is valid (`thumbnail`, `medium`, `large`, `original`)
   - Path is safe (no `..` traversal)
   - Path starts with allowed prefix (`originals/`, `artworks/`, `submissions/`, `photos/`)

4. **Generate variant key with path mapping:**
   ```typescript
   variantKey = generateVariantKey('originals/2025/10/06/photo.jpg', 'medium')
   // Returns: 'artworks/2025/10/06/photo__1024x1024.jpg'
   ```

5. **Check if variant exists:**
   - Lookup: `artworks/2025/10/06/photo__1024x1024.jpg` in R2
   - If exists: Check dimensions match expected size
   - If missing or wrong size: Regenerate

6. **Regenerate variant if needed:**
   - Fetch original: `originals/2025/10/06/photo.jpg`
   - Resize to 1024x1024px
   - Store to: `artworks/2025/10/06/photo__1024x1024.jpg`
   - Add metadata (original-key, dimensions, timestamp)

7. **Redirect to CDN:**
   ```
   301 Redirect → https://photos.publicartregistry.com/artworks/2025/10/06/photo__1024x1024.jpg
   ```

---

## Path Mapping Rules

The system uses **intelligent path mapping** to separate source images from cached variants:

| Source Prefix | Variant Prefix | Purpose |
|--------------|---------------|---------|
| `originals/` | `artworks/` | User-uploaded photos → cached variants |
| `photos/` | `artworks/` | Legacy path migration |
| `submissions/` | `submissions/` | Pending submissions (preserved) |
| `artworks/` | `artworks/` | Already in correct location |

### Why This Matters

**Before Fix:**
```
originals/2025/10/06/photo.jpg              # Original (✓)
originals/2025/10/06/photo__400x400.jpg     # Variant (✗ WRONG)
originals/2025/10/06/photo__1024x1024.jpg   # Variant (✗ WRONG)
```

**After Fix:**
```
originals/2025/10/06/photo.jpg              # Original (✓)
artworks/2025/10/06/photo__400x400.jpg      # Variant (✓)
artworks/2025/10/06/photo__1024x1024.jpg    # Variant (✓)
```

**Benefits:**
- ✅ Clear separation of source vs. cache
- ✅ Safe cache purging (delete `artworks/` folder)
- ✅ Disaster recovery (originals preserved)
- ✅ Easy to regenerate all variants

---

## Storage Philosophy

### `originals/` Folder - Immutable Source of Truth

**Contains:** ONLY originally uploaded photos  
**Purpose:** Permanent storage, never modified  
**Deletion:** Permanent data loss

**Rules:**
- ❌ NEVER store generated/resized files here
- ❌ NEVER modify existing files
- ✅ Store with secure filenames
- ✅ Include comprehensive metadata

### `artworks/` Folder - Ephemeral Cache

**Contains:** ONLY generated/resized variants  
**Purpose:** Performance cache  
**Deletion:** Safe - will auto-regenerate

**Variants:**
- `thumbnail` → `*__400x400.jpg`
- `medium` → `*__1024x1024.jpg`
- `large` → `*__1200x1200.jpg`

**Rules:**
- ✅ Can be deleted at any time
- ✅ Auto-regenerates on-demand
- ✅ Cache warming happens in background
- ✅ Dimension validation triggers regeneration

### `submissions/` Folder - Pending Content

**Contains:** Photos from pending submissions  
**Purpose:** Separate pending from approved  
**Path Mapping:** Preserved (submissions → submissions)

---

## Complete Example: User Upload Journey

### 1. User Uploads Photo

**Frontend:** User selects `my_sculpture.jpg` (3.2MB JPEG)

### 2. Validation

```
✓ File count: 1 (max 3)
✓ Size: 3.2MB (max 15MB)
✓ Type: image/jpeg (supported)
✓ Content: Present
```

### 3. Filename Generation

```
Original: my_sculpture.jpg
Secure:   20251006-161523-a3f8d2e1-sculpture.jpg
```

### 4. R2 Key Generation

```
Base:  originals/
Date:  2025/10/06/
Final: originals/2025/10/06/20251006-161523-a3f8d2e1-sculpture.jpg
```

### 5. EXIF Processing

```
Input:  3,200,000 bytes
Process: Add permalink to artwork page
Output: 3,202,156 bytes (EXIF modified)
```

### 6. Upload to R2

```
Bucket: PHOTOS_BUCKET
Key:    originals/2025/10/06/20251006-161523-a3f8d2e1-sculpture.jpg
Size:   3,202,156 bytes
Metadata:
  - Submission-ID: "sub-abc123"
  - Original-Filename: "my_sculpture.jpg"
  - EXIF-Processed: "true"
  - Permalink-Injected: "artwork-def456"
```

### 7. Cache Warming (Background)

```
Source: originals/2025/10/06/20251006-161523-a3f8d2e1-sculpture.jpg

Generate thumbnail (400x400):
  Resize: 3.2MB → 45KB
  Store:  artworks/2025/10/06/20251006-161523-a3f8d2e1-sculpture__400x400.jpg

Generate medium (1024x1024):
  Resize: 3.2MB → 180KB
  Store:  artworks/2025/10/06/20251006-161523-a3f8d2e1-sculpture__1024x1024.jpg
```

### 8. User Views Artwork Page

**Frontend requests:**
```
GET /api/images/medium/originals/2025/10/06/20251006-161523-a3f8d2e1-sculpture.jpg
```

**Backend processing:**
```
1. Parse: size=medium, path=originals/2025/10/06/20251006-161523-a3f8d2e1-sculpture.jpg
2. Map:   variantKey = artworks/2025/10/06/20251006-161523-a3f8d2e1-sculpture__1024x1024.jpg
3. Check: Variant exists? YES (from cache warming)
4. Verify: Dimensions correct? YES (1024x1024)
5. Redirect: 301 → https://photos.publicartregistry.com/artworks/2025/10/06/...
```

**Browser loads:**
```
https://photos.publicartregistry.com/artworks/2025/10/06/20251006-161523-a3f8d2e1-sculpture__1024x1024.jpg
```

---

## Error Handling

### Upload Errors

**File Too Large:**
```json
{
  "error": "INVALID_PHOTOS",
  "message": "Photo validation failed",
  "details": {
    "errors": ["File size 18MB exceeds maximum of 15MB"]
  }
}
```

**Unsupported Format:**
```json
{
  "error": "INVALID_PHOTOS",
  "message": "Photo validation failed",
  "details": {
    "errors": ["File type image/gif is not supported"]
  }
}
```

**Upload Failure:**
```json
{
  "error": "STORAGE_UPLOAD_ERROR",
  "message": "Failed to upload photo to storage",
  "statusCode": 503
}
```

### Image Serving Errors

**Original Not Found:**
```json
{
  "error": "IMAGE_NOT_FOUND",
  "message": "Original image not found",
  "statusCode": 404
}
```

**Invalid Size:**
```json
{
  "error": "INVALID_SIZE",
  "message": "Invalid size parameter: huge. Valid sizes are: thumbnail, medium, large, original",
  "statusCode": 400
}
```

**Invalid Path:**
```json
{
  "error": "INVALID_IMAGE_PREFIX",
  "message": "Image path must start with artworks/, submissions/, originals/, or photos/",
  "statusCode": 403
}
```

---

## Performance Characteristics

### Upload Performance

**Average Upload Times:**
- Small file (500KB): ~200ms
- Medium file (2MB): ~500ms
- Large file (8MB): ~1500ms

**Components:**
- Validation: ~10ms
- EXIF processing: ~100-200ms
- R2 upload: ~100-1000ms (depends on size)
- Cache warming: Background (doesn't block)

### Image Serving Performance

**Cache Hit (variant exists):**
- R2 lookup: ~50ms
- Redirect: ~10ms
- **Total: ~60ms**

**Cache Miss (variant generation):**
- R2 lookup (original): ~50ms
- Image resizing: ~200-500ms
- R2 upload (variant): ~100ms
- Redirect: ~10ms
- **Total: ~360-660ms**

**Subsequent requests:** ~60ms (cache hit)

---

## Monitoring & Debugging

### Debug Logging

Enable with environment variable:
```
PHOTO_DEBUG=true
```

**Upload Logs:**
```
[PHOTO][UPLOAD] Starting processAndUploadPhotos
[PHOTO][UPLOAD] File begin: {index, originalName, mime, sizeBytes}
[PHOTO][UPLOAD] File processed buffer ready
[PHOTO][UPLOAD] Upload result: {originalKey, thumbnailKey}
[PHOTO][UPLOAD] All files processed successfully
```

**Cache Warming Logs:**
```
[PHOTO][CACHE_WARM] Starting cache warming
[PHOTO][CACHE_WARM] Variant generated and cached
```

**R2 Logs:**
```
[PHOTO][R2] R2 put begin: {key, sizeBytes, mime}
[PHOTO][R2] R2 put complete: {key, ms}
```

**Image Serving Logs:**
```
[IMAGE] Generating variant medium for originals/2025/10/06/photo.jpg
[IMAGE] Variant artworks/2025/10/06/photo__1024x1024.jpg missing size metadata, regenerating
[IMAGE] Variant has wrong size (800px vs 1024px), regenerating
```

---

## Common Issues & Solutions

### Issue: Variants not generating

**Symptoms:** Image requests return 404  
**Causes:**
- Original file deleted from `originals/`
- R2 bucket misconfigured
- Path mapping incorrect

**Solution:**
1. Verify original exists in R2
2. Check bucket permissions
3. Review path mapping logs

### Issue: Wrong size variants

**Symptoms:** Images appear too small/large  
**Causes:**
- Old variants with wrong dimensions
- Dimension metadata missing

**Solution:**
- System auto-detects and regenerates
- Delete variant from R2 to force regeneration

### Issue: Slow first load

**Symptoms:** First image request takes >1s  
**Causes:**
- Cache warming hasn't completed
- Large original file

**Solution:**
- Normal behavior - subsequent requests are fast
- Consider pre-warming critical images
- Optimize original upload sizes

---

## Related Documentation

- `/docs/api.md` - API endpoints and usage
- `/docs/photo-processing.md` - Image processing pipeline
- `/docs/database.md` - Photo metadata storage
- `/tasks/done/image-hosting-implementation.md` - Implementation details
- `/tasks/plan-image-hosting.md` - Design decisions

---

**Summary:** Photos are uploaded to `originals/`, variants are automatically generated and stored in `artworks/` with intelligent path mapping. The system handles both background cache warming and on-demand generation seamlessly.
