# Image Hosting & Processing Plan

**Created:** 2025-10-06  
**Status:** Analysis & Planning  
**Priority:** High

## Problem Statement

The image endpoint `/api/images/:size/:path` is not correctly handling path transformations between:

1. **API Request URL**: `https://api.publicartregistry.com/api/images/medium/originals/2025/10/04/filename.jpg`
2. **R2 Original Path**: `originals/2025/10/04/filename.jpg`
3. **R2 Variant Path**: `artwork/2025/10/04/filename__1024x1024.jpg`
4. **Photos CDN URL**: `https://photos.publicartregistry.com/artwork/2025/10/04/filename__1024x1024.jpg`

## Current Behavior Analysis

### Current Code Flow (`images.ts`)

1. **Route**: `GET /api/images/:size/*`
2. **Extracts**:
   - `size` = `medium` (PhotoVariant)
   - `imagePath` = `originals/2025/10/04/20251004-100533-9623e4a5-mass-import-v2-17595.jpg`
3. **Validation**: Checks for allowed prefixes (`artworks/`, `submissions/`, `originals/`, `photos/`)
4. **Variant Key Generation**: Uses `generateVariantKey()` from `lib/image-processing.ts`
   - **Current**: `originals/2025/10/04/filename__1024x1024.jpg` ❌ **WRONG PATH**
   - **Expected**: `artworks/2025/10/04/filename__1024x1024.jpg` ✅ **CORRECT PATH**
5. **R2 Lookup**: Tries to fetch variant from R2
6. **Regeneration Logic**: If not found, fetches original and generates variant
7. **Storage**: Stores variant back to R2 with metadata
8. **Redirect**: 301 redirect to `photos.publicartregistry.com`

### Root Cause

**The `generateVariantKey()` function preserves the original path prefix**, meaning:

```typescript
// Current behavior
generateVariantKey('originals/2025/10/04/filename.jpg', 'medium')
// Returns: 'originals/2025/10/04/filename__1024x1024.jpg'

// Expected behavior
// Should return: 'artworks/2025/10/04/filename__1024x1024.jpg'
```

**Key Issue**: The function doesn't know that variants should be stored in a different directory structure than originals.

## Directory Structure Requirements

### R2 Bucket Organization

```
PHOTOS_BUCKET/
├── originals/           # Source images (never modified)
│   ├── 2025/10/04/
│   │   └── 20251004-100533-9623e4a5-mass-import-v2-17595.jpg
│   └── ...
│
├── artworks/            # Generated variants for approved artworks
│   ├── 2025/10/04/
│   │   ├── filename__400x400.jpg    (thumbnail)
│   │   ├── filename__1024x1024.jpg  (medium)
│   │   └── filename__1200x1200.jpg  (large)
│   └── ...
│
├── submissions/         # Generated variants for pending submissions
│   └── ...
│
└── photos/              # Legacy/alternative path (check if still used)
    └── ...
```

### Important Storage Rules

**⚠️ CRITICAL GUIDELINES:**

1. **`originals/` Folder - Immutable Source of Truth**
   - Contains ONLY originally uploaded photos
   - **NEVER store generated/resized files in this folder**
   - Files in this folder are permanent and should never be modified
   - Used as source material for generating all variants
   - Deletion of files from this folder means permanent data loss

2. **`artworks/` Folder - Ephemeral Generated Cache**
   - Contains ONLY generated/resized variant images
   - Stores different size variants: `*__400x400.jpg`, `*__1024x1024.jpg`, `*__1200x1200.jpg`
   - **This entire folder can be safely deleted at any time**
   - The system will automatically regenerate variants on-demand via the images API
   - Regeneration happens when:
     - Variant doesn't exist in R2
     - Variant has wrong dimensions (size metadata mismatch)
     - Variant is requested for the first time
   - Acts as a performance cache to avoid redundant image processing

3. **Storage Separation Philosophy**
   - Source (`originals/`) and cache (`artworks/`) are completely separate
   - This separation enables:
     - Safe cache purging for storage optimization
     - Variant regeneration with updated processing logic
     - Easy disaster recovery (originals are preserved)
     - Testing new image processing algorithms without data loss

### URL Patterns

| Type | Domain | Path Structure |
|------|--------|----------------|
| **API Request** | `api.publicartregistry.com` | `/api/images/{size}/{source_path}` |
| **R2 Original** | R2 Bucket | `originals/{date_path}/{filename}` |
| **R2 Variant** | R2 Bucket | `artworks/{date_path}/{filename}__{size}` |
| **CDN Delivery** | `photos.publicartregistry.com` | `artworks/{date_path}/{filename}__{size}` |

## Solution Design

### Option 1: Path Mapping in `generateVariantKey()` (Recommended)

**Pros:**
- Centralized logic
- Easier to maintain
- Consistent across all callers

**Cons:**
- Requires understanding of directory structure semantics

**Implementation:**

```typescript
export function generateVariantKey(originalKey: string, variant: PhotoVariant): string {
  if (variant === 'original') {
    return originalKey;
  }

  // Map source directories to variant directories
  let targetPrefix = '';
  let cleanPath = originalKey;

  if (originalKey.startsWith('originals/')) {
    targetPrefix = 'artworks/';
    cleanPath = originalKey.substring('originals/'.length);
  } else if (originalKey.startsWith('submissions/')) {
    targetPrefix = 'submissions/';
    cleanPath = originalKey.substring('submissions/'.length);
  } else if (originalKey.startsWith('artworks/')) {
    // Already in correct location
    targetPrefix = 'artworks/';
    cleanPath = originalKey.substring('artworks/'.length);
  } else if (originalKey.startsWith('photos/')) {
    // Legacy path - map to artworks
    targetPrefix = 'artworks/';
    cleanPath = originalKey.substring('photos/'.length);
  } else {
    // Unknown prefix - keep as-is
    targetPrefix = '';
    cleanPath = originalKey;
  }

  const size = LOCAL_PHOTO_SIZES[variant];
  if (!size) {
    throw new ApiError(`Invalid photo variant: ${variant}`, 'INVALID_VARIANT', 400);
  }

  // Extract filename from clean path
  const lastSlash = cleanPath.lastIndexOf('/');
  const path = lastSlash >= 0 ? cleanPath.substring(0, lastSlash + 1) : '';
  const filename = lastSlash >= 0 ? cleanPath.substring(lastSlash + 1) : cleanPath;

  // Split filename into name and extension
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot >= 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot >= 0 ? filename.substring(lastDot) : '';

  return `${targetPrefix}${path}${name}__${size.width}x${size.height}${ext}`;
}
```

### Option 2: Explicit Target Directory Parameter

**Pros:**
- More flexible
- Caller controls destination

**Cons:**
- Requires all callers to know the mapping
- More error-prone
- Inconsistent usage

**Skip this option** - too complex for maintainability.

### Option 3: Status-Based Directory Selection

**Context**: Artworks have status field (`pending`, `approved`, `removed`)

**Mapping:**
- `pending` → `submissions/`
- `approved` → `artworks/`
- `removed` → Keep in current location or move to `archived/`

**Pros:**
- Semantic organization
- Automatic cleanup when status changes

**Cons:**
- Requires database lookup
- Performance overhead
- Complex state management

**Decision**: Defer this for future optimization. Use simple prefix mapping for now.

## Implementation Plan

### Phase 1: Fix Core Path Mapping ✅

1. **Update `generateVariantKey()` in `image-processing.ts`**
   - Add prefix mapping logic (originals → artworks)
   - Handle legacy paths (photos → artworks)
   - Preserve submissions path
   - Add comprehensive JSDoc comments

2. **Update `parseVariantKey()` in `image-processing.ts`**
   - Add reverse mapping support
   - Update to handle new path structure
   - Return both variant path and original path

3. **Add Unit Tests**
   - Test all prefix mappings
   - Test edge cases (no prefix, unknown prefix)
   - Test round-trip (generate → parse → generate)
   - Test URL decoding edge cases

### Phase 2: Verify Images Route Logic ✅

1. **Review `images.ts` endpoint**
   - Verify variant lookup uses correct path
   - Ensure original lookup still works
   - Confirm redirect URLs are correct
   - Test regeneration logic

2. **Add Integration Tests**
   - Test full flow: API request → R2 → Redirect
   - Test missing variant regeneration
   - Test variant dimension validation
   - Test error cases (missing original, invalid size)

### Phase 3: Migration & Cleanup 🔄

1. **Audit Existing R2 Storage**
   - Count variants in `originals/` directory
   - Count variants in `artworks/` directory
   - Identify misplaced files

2. **Create Migration Script**
   - Move existing variants from `originals/` to `artworks/`
   - Update metadata references
   - Validate file integrity
   - Create backup before migration

3. **Documentation Updates**
   - Update `/docs/photo-processing.md`
   - Document directory structure
   - Add troubleshooting guide
   - Update API documentation

### Phase 4: Performance Optimization 🔄

1. **Caching Strategy**
   - Add Cache-Control headers
   - Implement CDN edge caching
   - Consider variant pre-warming

2. **Monitoring**
   - Track variant generation requests
   - Monitor R2 storage usage
   - Alert on high regeneration rates

## Testing Strategy

### Unit Tests

```typescript
// Test cases for generateVariantKey()
describe('generateVariantKey', () => {
  test('maps originals/ to artworks/', () => {
    const result = generateVariantKey(
      'originals/2025/10/04/filename.jpg',
      'medium'
    );
    expect(result).toBe('artworks/2025/10/04/filename__1024x1024.jpg');
  });

  test('preserves submissions/ path', () => {
    const result = generateVariantKey(
      'submissions/2025/10/04/filename.jpg',
      'thumbnail'
    );
    expect(result).toBe('submissions/2025/10/04/filename__400x400.jpg');
  });

  test('handles legacy photos/ path', () => {
    const result = generateVariantKey(
      'photos/2025/10/04/filename.jpg',
      'large'
    );
    expect(result).toBe('artworks/2025/10/04/filename__1200x1200.jpg');
  });

  test('handles artworks/ path (already correct)', () => {
    const result = generateVariantKey(
      'artworks/2025/10/04/filename.jpg',
      'medium'
    );
    expect(result).toBe('artworks/2025/10/04/filename__1024x1024.jpg');
  });

  test('returns original key for original variant', () => {
    const result = generateVariantKey(
      'originals/2025/10/04/filename.jpg',
      'original'
    );
    expect(result).toBe('originals/2025/10/04/filename.jpg');
  });
});
```

### Integration Tests

```typescript
describe('Image API Endpoint', () => {
  test('generates correct variant path from originals/', async () => {
    // Mock R2 bucket with original image
    // Request /api/images/medium/originals/2025/10/04/filename.jpg
    // Verify variant stored at artworks/2025/10/04/filename__1024x1024.jpg
    // Verify redirect to photos.publicartregistry.com/artworks/...
  });

  test('serves existing variant without regeneration', async () => {
    // Pre-populate R2 with variant
    // Request should return redirect immediately
    // Should NOT regenerate
  });

  test('regenerates variant with wrong dimensions', async () => {
    // Pre-populate R2 with old-sized variant
    // Request should detect size mismatch
    // Should regenerate with correct dimensions
  });
});
```

### Manual Testing Checklist

- [ ] Request image via API endpoint
- [ ] Verify variant created in correct R2 path
- [ ] Verify redirect URL is correct
- [ ] Verify image loads from photos domain
- [ ] Test with different size variants
- [ ] Test with different source prefixes
- [ ] Test URL-encoded paths
- [ ] Test error cases (missing original)

## Migration Considerations

### Backward Compatibility

**Issue**: Existing variants may be in wrong locations

**Solutions**:
1. **Lazy Migration**: Leave old variants, regenerate on-demand
2. **Batch Migration**: Script to move all variants
3. **Dual Lookup**: Check both locations during transition

**Recommendation**: Use **Lazy Migration** for simplicity. Old variants will be replaced as they're requested.

### Database References

**Check**: Do database records store full photo URLs or just filenames?

```sql
-- Check current photo storage format
SELECT id, photos FROM artworks LIMIT 10;
```

**If storing full URLs**: May need database migration  
**If storing relative paths**: Should work automatically

### Client-Side Caching

**Issue**: Browsers may have cached old redirect URLs

**Solution**: Variants now have proper dimensions in metadata, so dimension validation will trigger regeneration if needed.

## Security Considerations

### Path Traversal Prevention

Current code includes:
```typescript
if (imagePath.includes('..') || imagePath.startsWith('/')) {
  throw new ApiError('Invalid image path', 'INVALID_IMAGE_PATH', 400);
}
```

**Verify**: New prefix mapping doesn't introduce vulnerabilities

### Prefix Allowlist

Current allowlist:
- `artworks/`
- `submissions/`
- `originals/`
- `photos/`

**Action**: Keep allowlist, ensure mapping preserves security

## Rollout Plan

### Development
1. Implement changes in local environment
2. Run full test suite
3. Manual testing with sample images
4. Verify R2 storage structure

### Staging
1. Deploy to `test.publicartregistry.com`
2. Test with production-like data
3. Monitor for errors
4. Verify redirect URLs

### Production
1. Deploy during low-traffic period
2. Monitor error rates
3. Check R2 storage usage
4. Validate redirect URLs
5. Test sample artworks

### Rollback Plan

If issues occur:
1. Revert code deployment
2. Old variants still exist (lazy migration)
3. System falls back to regeneration
4. No data loss

## Success Metrics

- [ ] All image requests return correct variant paths
- [ ] Variants stored in correct R2 directories
- [ ] Redirects point to correct CDN URLs
- [ ] Images load successfully in browser
- [ ] No increase in error rates
- [ ] R2 storage organized correctly
- [ ] Performance maintained (< 500ms for variant generation)

## Open Questions

1. **Q**: Are there any existing variants in wrong locations?
   **A**: Run audit script to check

2. **Q**: Do we need to support multiple source prefixes long-term?
   **A**: Yes - submissions vs. artworks have different lifecycles

3. **Q**: Should removed artworks variants be deleted or archived?
   **A**: Future consideration - defer for now

4. **Q**: What about user-uploaded profile photos?
   **A**: Check if same system is used - may need separate handling

## Related Documentation

- `/docs/photo-processing.md` - Photo processing pipeline
- `/docs/api.md` - API documentation
- `/docs/database.md` - Database schema
- `/src/workers/routes/images.ts` - Image endpoint implementation
- `/src/workers/lib/image-processing.ts` - Image utilities

## Next Steps

1. ✅ Create this planning document
2. ⏳ Implement `generateVariantKey()` path mapping
3. ⏳ Add comprehensive tests
4. ⏳ Update `parseVariantKey()` for reverse mapping
5. ⏳ Manual testing in development
6. ⏳ Deploy to staging
7. ⏳ Production deployment
8. ⏳ Monitor and validate
9. ⏳ Update documentation

---

**Notes:**
- Prioritize correctness over performance
- Maintain backward compatibility where possible
- Test thoroughly before production deployment
- Document all changes in API docs
