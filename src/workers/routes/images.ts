/**
 * On-demand image resizing API endpoint
 *
 * This route handles dynamic image resizing requests. It checks if the requested
 * variant exists in R2 storage, and if not, generates it from the original image.
 *
 * Usage:
 *   GET /api/images/thumbnail/artworks/2024/01/15/image-name.jpg
 *   GET /api/images/medium/artworks/2024/01/15/image-name.jpg
 *   GET /api/images/large/artworks/2024/01/15/image-name.jpg
 *   GET /api/images/original/artworks/2024/01/15/image-name.jpg
 */

import { Hono } from 'hono';
import type { WorkerEnv } from '../types';
import { ApiError, formatErrorResponse } from '../lib/errors';
import type { PhotoVariant } from '../../shared/types';
import { PHOTO_SIZES } from '../../shared/types';
import {
  generateVariantKey,
  resizeImage,
  validateImageData,
  getContentType,
} from '../lib/image-processing';
import { extractR2KeyFromRef } from '../lib/photos';

const app = new Hono<{ Bindings: WorkerEnv }>();

/**
 * GET /api/images/:size/*
 *
 * Serve resized image variant, generating it if it doesn't exist
 */
app.get('/:size/*', async (c) => {
  try {
    const size = c.req.param('size') as PhotoVariant;
    let imagePath = c.req.param('*'); // Everything after /:size/

    // Debug logging
    // console.log('[IMAGE ENDPOINT] size:', size);
    // console.log('[IMAGE ENDPOINT] imagePath from param(*):', imagePath);
    // console.log('[IMAGE ENDPOINT] full path:', c.req.path);
    // console.log('[IMAGE ENDPOINT] all params:', c.req.param());

    // Fallback: Try to extract from full path if wildcard param is empty
    if (!imagePath || imagePath.trim().length === 0) {
      const fullPath = c.req.path;
      const sizePrefix = `/api/images/${size}/`;
      if (fullPath.startsWith(sizePrefix)) {
        imagePath = fullPath.substring(sizePrefix.length);
        // console.log('[IMAGE ENDPOINT] Extracted from full path:', imagePath);
      }
    }

    // Validate size parameter
    const validSizes: PhotoVariant[] = ['thumbnail', 'medium', 'large', 'original'];
    if (!validSizes.includes(size)) {
      throw new ApiError(
        `Invalid size parameter: ${size}. Valid sizes are: ${validSizes.join(', ')}`,
        'INVALID_SIZE',
        400
      );
    }

    // Known allowed prefixes (used for security checks and for extracting
    // an R2 key from full/external URLs). We check these before final
    // validation so callers may pass absolute URLs and we can map them
    // to the internal R2 key when possible.
    const allowedPrefixes = ['artworks/', 'submissions/', 'originals/', 'photos/'];

    // Work on a local string variable to satisfy TypeScript control flow
    let pathStr: string = imagePath || '';

    // If the wildcard param was percent-encoded by the browser (common when
    // a full URL is placed inside a path segment) try to decode it and use
    // the decoded value for downstream checks.
    try {
      const decoded = decodeURIComponent(pathStr);
      if (decoded && decoded !== pathStr) {
        console.log('[IMAGE ENDPOINT] decoded imagePath:', decoded);
        pathStr = decoded;
      }
    } catch (e) {
      // ignore malformed encoding
    }

    // If the client passed a full URL (or a hostname-prefixed path), try to
    // extract the first allowed prefix substring (e.g. 'photos/' or 'originals/')
    // so we can map external URLs back to our R2 keys. This handles cases like
    // `/api/images/thumbnail/https%3A/photos.publicartregistry.com/originals/...`
    // which decode to `https:/photos.publicartregistry.com/originals/...` or
    // similar variants.
    if (!allowedPrefixes.some((p) => pathStr.startsWith(p))) {
      for (const prefix of allowedPrefixes) {
        const idx = pathStr.indexOf(prefix);
        if (idx >= 0) {
          pathStr = pathStr.substring(idx);
          console.log('[IMAGE ENDPOINT] extracted imagePath from full URL:', pathStr);
          break;
        }
      }
    }

    // Reassign sanitized path back to imagePath
    imagePath = pathStr;

    // Validate image path (security check)
    if (!imagePath || imagePath.trim().length === 0) {
      throw new ApiError('Image path is required', 'MISSING_IMAGE_PATH', 400);
    }

    // Ensure the path is within our R2 bucket (prevent directory traversal)
    if (imagePath.includes('..') || imagePath.startsWith('/')) {
      throw new ApiError('Invalid image path', 'INVALID_IMAGE_PATH', 400);
    }

    // Only allow images from specific prefixes (security)
    const hasValidPrefix = allowedPrefixes.some((prefix) => imagePath?.startsWith(prefix));
    if (!hasValidPrefix) {
      throw new ApiError(
        'Image path must start with artworks/, submissions/, originals/, or photos/',
        'INVALID_IMAGE_PREFIX',
        403
      );
    }

    // Extract the actual R2 key from the image path
    // This handles cases where the path includes '/photos/' prefix that needs to be stripped
    const r2Key = extractR2KeyFromRef(imagePath);
    if (!r2Key) {
      throw new ApiError('Unable to determine R2 key from image path', 'INVALID_R2_KEY', 400);
    }
    
    // Use the extracted R2 key for all operations
    imagePath = r2Key;

    const bucket = c.env.PHOTOS_BUCKET;
    if (!bucket) {
      throw new ApiError('Photo storage not configured', 'STORAGE_NOT_CONFIGURED', 503);
    }

    // Generate the variant key with automatic path mapping
    // This maps: originals/ → artworks/, photos/ → artworks/, submissions/ → submissions/
    // See generateVariantKey() in lib/image-processing.ts for full mapping logic
    const variantKey = size === 'original' ? imagePath : generateVariantKey(imagePath, size);

    // Try to fetch the variant from R2
    let object = await bucket.get(variantKey);

    // Check if the variant needs to be regenerated (wrong size or doesn't exist)
    let needsRegeneration = !object && size !== 'original';
    
    // If variant exists, check if it has the correct dimensions
    if (object && size !== 'original') {
      const expectedSize = PHOTO_SIZES[size];
      if (expectedSize) {
        const storedWidth = object.customMetadata?.Width;
        const storedHeight = object.customMetadata?.Height;
        
        // Regenerate if metadata is missing or dimensions don't match expected size
        if (!storedWidth || !storedHeight) {
          console.log(`[IMAGE] Variant ${variantKey} missing size metadata, regenerating`);
          needsRegeneration = true;
        } else {
          const actualMaxDimension = Math.max(parseInt(storedWidth), parseInt(storedHeight));
          const expectedMaxDimension = Math.max(expectedSize.width, expectedSize.height);
          
          if (actualMaxDimension !== expectedMaxDimension) {
            console.log(`[IMAGE] Variant ${variantKey} has wrong size (${actualMaxDimension}px vs ${expectedMaxDimension}px), regenerating`);
            needsRegeneration = true;
          }
        }
      }
    }

    // If variant doesn't exist or needs regeneration, generate it
    if (needsRegeneration) {
      // Fetch the original image
      const originalObject = await bucket.get(imagePath);

      console.log(`[IMAGE] Generating variant ${size} for ${imagePath}`);

      if (!originalObject) {
        throw new ApiError('Original image not found', 'IMAGE_NOT_FOUND', 404);
      }

      // Read the original image data
      const originalData = await originalObject.arrayBuffer();
      const contentType = originalObject.httpMetadata?.contentType || getContentType(originalData);

      // Validate the image
      validateImageData(originalData, contentType);

      // Detect local development environment
      // Cloudflare Image Resizing doesn't work in wrangler dev
      const isLocalDev = c.env.ENVIRONMENT === 'development' || !c.env.ENVIRONMENT;

      // Resize the image
      const resized = await resizeImage(originalData, {
        variant: size,
        format: contentType.split('/')[1] as 'jpeg' | 'png' | 'webp',
      }, isLocalDev);

      // Store the resized variant in R2
      await bucket.put(variantKey, resized.data, {
        httpMetadata: {
          contentType: resized.contentType,
        },
        customMetadata: {
          'Original-Key': imagePath,
          'Variant': size,
          'Generated-At': new Date().toISOString(),
          'Width': resized.width.toString(),
          'Height': resized.height.toString(),
        },
      });

      // In local development, serve the image directly instead of redirecting
      // This avoids issues with R2 public URL not being available locally
      if (isLocalDev) {
        return new Response(resized.data, {
          status: 200,
          headers: {
            'Content-Type': resized.contentType,
            'X-Image-Variant': size,
            'X-Generated': 'true',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }

      // In production, redirect to the photos domain so the file is served from R2 with proper caching
      const photosBaseUrl = c.env.PHOTOS_BASE_URL || 'https://photos.publicartregistry.com';
      const redirectUrl = `${photosBaseUrl}/${variantKey}`;
      return new Response(null, {
        status: 301,
        headers: {
          'Location': redirectUrl,
          'X-Image-Variant': size,
          'X-Generated': 'true',
        },
      });
    }

    // If the original doesn't exist at all
    if (!object) {
      throw new ApiError('Image not found', 'IMAGE_NOT_FOUND', 404);
    }

    // Detect local development environment
    const isLocalDev = c.env.ENVIRONMENT === 'development' || !c.env.ENVIRONMENT;

    // In local development, serve the image directly from R2
    if (isLocalDev) {
      const imageData = await object.arrayBuffer();
      const contentType = object.httpMetadata?.contentType || 'image/jpeg';
      
      return new Response(imageData, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'X-Image-Variant': size,
          'X-Generated': 'false',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // In production, variant/original exists - redirect to the photos domain
    const photosBaseUrl = c.env.PHOTOS_BASE_URL || 'https://photos.publicartregistry.com';
    const redirectUrl = `${photosBaseUrl}/${variantKey}`;
    return new Response(null, {
      status: 301,
      headers: {
        'Location': redirectUrl,
        'X-Image-Variant': size,
        'X-Generated': 'false',
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const errorResponse = formatErrorResponse(error);
      return new Response(JSON.stringify(errorResponse), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.error('Unexpected error in image route:', error);
    const apiError = new ApiError('Failed to process image request', 'INTERNAL_ERROR', 500);
    const errorResponse = formatErrorResponse(apiError);
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

export default app;
