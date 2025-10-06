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
import {
  generateVariantKey,
  resizeImage,
  validateImageData,
  getContentType,
  getCacheHeaders,
} from '../lib/image-processing';

const app = new Hono<{ Bindings: WorkerEnv }>();

/**
 * GET /api/images/:size/*
 *
 * Serve resized image variant, generating it if it doesn't exist
 */
app.get('/:size/*', async (c) => {
  try {
    const size = c.req.param('size') as PhotoVariant;
    const imagePath = c.req.param('*'); // Everything after /:size/

    // Validate size parameter
    const validSizes: PhotoVariant[] = ['thumbnail', 'medium', 'large', 'original'];
    if (!validSizes.includes(size)) {
      throw new ApiError(
        `Invalid size parameter: ${size}. Valid sizes are: ${validSizes.join(', ')}`,
        'INVALID_SIZE',
        400
      );
    }

    // Validate image path (security check)
    if (!imagePath || imagePath.trim().length === 0) {
      throw new ApiError('Image path is required', 'MISSING_IMAGE_PATH', 400);
    }

    // Ensure the path is within our R2 bucket (prevent directory traversal)
    if (imagePath.includes('..') || imagePath.startsWith('/')) {
      throw new ApiError('Invalid image path', 'INVALID_IMAGE_PATH', 400);
    }

    // Only allow images from specific prefixes (security)
    const allowedPrefixes = ['artworks/', 'submissions/'];
    const hasValidPrefix = allowedPrefixes.some((prefix) => imagePath.startsWith(prefix));
    if (!hasValidPrefix) {
      throw new ApiError(
        'Image path must start with artworks/ or submissions/',
        'INVALID_IMAGE_PREFIX',
        403
      );
    }

    const bucket = c.env.PHOTOS_BUCKET;
    if (!bucket) {
      throw new ApiError('Photo storage not configured', 'STORAGE_NOT_CONFIGURED', 503);
    }

    // Generate the variant key
    const variantKey = size === 'original' ? imagePath : generateVariantKey(imagePath, size);

    // Try to fetch the variant from R2
    let object = await bucket.get(variantKey);

    // If variant doesn't exist and it's not the original, generate it
    if (!object && size !== 'original') {
      // Fetch the original image
      const originalObject = await bucket.get(imagePath);

      if (!originalObject) {
        throw new ApiError('Original image not found', 'IMAGE_NOT_FOUND', 404);
      }

      // Read the original image data
      const originalData = await originalObject.arrayBuffer();
      const contentType = originalObject.httpMetadata?.contentType || getContentType(originalData);

      // Validate the image
      validateImageData(originalData, contentType);

      // Resize the image
      const resized = await resizeImage(originalData, {
        variant: size,
        format: contentType.split('/')[1] as 'jpeg' | 'png' | 'webp',
      });

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

      // Return the newly generated image
      const cacheHeaders = getCacheHeaders(size);
      return new Response(resized.data, {
        status: 200,
        headers: {
          'Content-Type': resized.contentType,
          'Content-Length': resized.size.toString(),
          ...cacheHeaders,
          'X-Image-Variant': size,
          'X-Generated': 'true',
        },
      });
    }

    // If the original doesn't exist at all
    if (!object) {
      throw new ApiError('Image not found', 'IMAGE_NOT_FOUND', 404);
    }

    // Serve the existing variant/original
    const data = await object.arrayBuffer();
    const contentType = object.httpMetadata?.contentType || getContentType(data);
    const cacheHeaders = getCacheHeaders(size);

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': data.byteLength.toString(),
        ...cacheHeaders,
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
