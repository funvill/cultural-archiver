# Image Thumbnails - Local Development Fix

## Issue

Stack overflow error when accessing image thumbnails in local development:

```
[ERROR] Image processing error: RangeError: Maximum call stack size exceeded
  at resizeImage (file:///C:/Users/funvill/Documents/git/cultural-archiver/src/workers/lib/image-processing.ts:137:14)
```

## Root Cause

**Cloudflare Image Resizing API (`cf.image` property) does not work in local development (wrangler dev).**

When the `resizeImage()` function tries to use `fetch()` with the `cf.image` property in local dev:

1. The fetch request with `cf.image` property is not handled by Cloudflare's image processing
2. Instead, it recursively calls the same Worker endpoint
3. This causes infinite recursion and stack overflow

## Solution

**Skip actual image resizing in local development and return the original image.**

This is acceptable because:

- ✅ The API endpoint structure is still tested
- ✅ URL construction and routing is still validated
- ✅ Frontend integration works correctly
- ✅ Actual Cloudflare Image Resizing will work in production/staging
- ✅ Images are served correctly (just at full size)

## Changes Made

### 1. Updated `resizeImage()` Function

**File**: `src/workers/lib/image-processing.ts`

- Added `isLocalDev` parameter (optional, defaults to false)
- Added early return when `isLocalDev === true`
- Returns original image with warning message
- Updated JSDoc to document local dev behavior

```typescript
export async function resizeImage(
  imageData: ArrayBuffer,
  options: ImageProcessingOptions,
  isLocalDev = false // <-- NEW PARAMETER
): Promise<ImageProcessingResult>
```

**Behavior in local dev:**
```typescript
if (isLocalDev) {
  console.warn(`[LOCAL DEV] Skipping image resizing for ${variant} - cf.image only works in production`);
  return {
    data: imageData,
    contentType: format ? `image/${format}` : 'image/jpeg',
    width: targetSize?.width || 0,
    height: targetSize?.height || 0,
    size: imageData.byteLength,
  };
}
```

### 2. Updated Image Endpoint

**File**: `src/workers/routes/images.ts`

- Detects local development using `ENVIRONMENT` variable
- Passes `isLocalDev` flag to `resizeImage()`

```typescript
// Detect local development environment
const isLocalDev = c.env.ENVIRONMENT === 'development' || !c.env.ENVIRONMENT;

// Resize the image
const resized = await resizeImage(originalData, {
  variant: size,
  format: contentType.split('/')[1] as 'jpeg' | 'png' | 'webp',
}, isLocalDev); // <-- PASS FLAG
```

### 3. Updated Cache Warming

**File**: `src/workers/lib/photos.ts`

- Updated `warmImageCache()` to detect local dev
- Passes `isLocalDev` flag to `resizeImage()`

```typescript
// Detect local development
const isLocalDev = env.ENVIRONMENT === 'development' || !env.ENVIRONMENT;

// Resize the image
const resized = await resizeImage(originalData, {
  variant,
  format: contentType.split('/')[1] as 'jpeg' | 'png' | 'webp',
}, isLocalDev); // <-- PASS FLAG
```

## Environment Detection

The `ENVIRONMENT` variable is already configured in `wrangler.toml`:

```toml
[env.development.vars]
ENVIRONMENT = "development"

[env.production.vars]
ENVIRONMENT = "production"

[env.staging.vars]
ENVIRONMENT = "staging"
```

## Testing

### Local Development
- ✅ No stack overflow errors
- ✅ Images load (at full size, but correctly)
- ✅ Console warning shows resizing is skipped
- ✅ All frontend components work correctly

### Production/Staging
- ⏳ Actual Cloudflare Image Resizing will work
- ⏳ Images will be properly resized to variant dimensions
- ⏳ No performance impact from full-size images

## Expected Console Output

In local development, you'll see:

```
[LOCAL DEV] Skipping image resizing for thumbnail - cf.image only works in production
```

This is **normal and expected**. The image will be served at full size in local dev, but will be properly resized in production.

## Production Deployment

When deployed to staging/production:

1. `ENVIRONMENT` will be set to `staging` or `production`
2. `isLocalDev` will be `false`
3. Cloudflare Image Resizing API will work correctly
4. Images will be resized to proper dimensions
5. Variants will be cached in R2

## Next Steps

1. ✅ Fixed local development
2. ⏳ Test in production/staging to verify actual resizing works
3. ⏳ Monitor image processing performance
4. ⏳ Run migration script to generate variants for existing images

## Summary

This fix allows the image thumbnail feature to work correctly in local development by skipping the Cloudflare-specific image resizing API, while maintaining full functionality in production environments where the API is available.
