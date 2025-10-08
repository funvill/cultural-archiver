/**
 * Image processing utilities for resizing and optimizing photos
 *
 * This module provides on-demand image resizing capabilities for Cloudflare Workers.
 * It supports multiple size variants and maintains aspect ratio while optimizing quality.
 * Uses wasm-image-optimization library for WASM-based image processing.
 */

import { optimizeImageExt } from 'wasm-image-optimization';
import { ApiError } from './errors';
import type { PhotoVariant } from '../../shared/types';
import { PHOTO_SIZES, PHOTO_QUALITY } from '../../shared/types';

// Fallbacks for tests/runtime where shared constants may not be defined
const LOCAL_PHOTO_SIZES: Record<PhotoVariant, { width: number; height: number } | null> =
  (PHOTO_SIZES as any) || {
    thumbnail: { width: 400, height: 400 },
    medium: { width: 1024, height: 1024 },
    large: { width: 1200, height: 1200 },
    original: null,
  };

const LOCAL_PHOTO_QUALITY: Record<PhotoVariant, number> =
  (PHOTO_QUALITY as any) || { thumbnail: 80, medium: 85, large: 90, original: 100 };

/**
 * Image processing options
 */
export interface ImageProcessingOptions {
  variant: PhotoVariant;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  maintainAspectRatio?: boolean;
}

/**
 * Image processing result
 */
export interface ImageProcessingResult {
  data: ArrayBuffer;
  contentType: string;
  width: number;
  height: number;
  size: number;
}
/**
 * Generate R2 storage key for image variant with automatic path mapping
 * 
 * This function maps source directories to appropriate variant directories:
 * - originals/ → artworks/ (generated variants from source images)
 * - photos/ → artworks/ (legacy path migration)
 * - artworks/ → artworks/ (already in correct location)
 * - submissions/ → submissions/ (preserve for pending content)
 * 
 * Storage Philosophy:
 * - originals/ contains ONLY source images (immutable, never store variants)
 * - artworks/ contains ONLY generated variants (ephemeral cache, can be deleted)
 * - Generated variants follow pattern: {prefix}{path}{name}__{width}x{height}{ext}
 * 
 * @param originalKey - Source image R2 key (e.g., "originals/2025/10/04/filename.jpg")
 * @param variant - Target size variant (thumbnail, medium, large, original)
 * @returns Variant R2 key (e.g., "artworks/2025/10/04/filename__1024x1024.jpg")
 * 
 * @example
 * generateVariantKey('originals/2025/10/04/image.jpg', 'medium')
 * // Returns: 'artworks/2025/10/04/image__1024x1024.jpg'
 * 
 * @example
 * generateVariantKey('submissions/2025/10/04/image.jpg', 'thumbnail')
 * // Returns: 'submissions/2025/10/04/image__400x400.jpg'
 */
export function generateVariantKey(originalKey: string, variant: PhotoVariant): string {
  if (variant === 'original') {
    return originalKey;
  }

  const size = LOCAL_PHOTO_SIZES[variant];
  if (!size) {
    throw new ApiError(`INVALID_VARIANT: Invalid photo variant: ${variant}`, 'INVALID_VARIANT', 400);
  }

  // Map source directories to variant directories
  // This ensures variants are stored separately from originals
  let targetPrefix = '';
  let cleanPath = originalKey;

  if (originalKey.startsWith('originals/')) {
    // Source images → generated variants go to artworks/
    targetPrefix = 'artworks/';
    cleanPath = originalKey.substring('originals/'.length);
  } else if (originalKey.startsWith('submissions/')) {
    // Submissions → keep in submissions/ (different lifecycle)
    targetPrefix = 'submissions/';
    cleanPath = originalKey.substring('submissions/'.length);
  } else if (originalKey.startsWith('artworks/')) {
    // Already in correct location (rare, but handle gracefully)
    targetPrefix = 'artworks/';
    cleanPath = originalKey.substring('artworks/'.length);
  } else if (originalKey.startsWith('photos/')) {
    // Legacy path → migrate to artworks/
    targetPrefix = 'artworks/';
    cleanPath = originalKey.substring('photos/'.length);
  } else {
    // Unknown prefix - keep as-is for backward compatibility
    // This path should rarely be hit due to validation in images.ts
    targetPrefix = '';
    cleanPath = originalKey;
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

/**
 * Parse a variant key to extract the original source key and variant size
 * 
 * This function reverses the path mapping done by generateVariantKey():
 * - artworks/.../__WxH.ext → originals/....ext (most common case)
 * - submissions/.../__WxH.ext → submissions/....ext (preserve submissions path)
 * - Other paths are preserved as-is
 * 
 * @param variantKey - Variant R2 key (e.g., "artworks/2024/01/15/timestamp-uuid__400x400.jpg")
 * @returns Object with originalKey (source path) and variant (size type)
 * 
 * @example
 * parseVariantKey('artworks/2025/10/04/image__1024x1024.jpg')
 * // Returns: { originalKey: 'originals/2025/10/04/image.jpg', variant: 'medium' }
 * 
 * @example
 * parseVariantKey('submissions/2025/10/04/image__400x400.jpg')
 * // Returns: { originalKey: 'submissions/2025/10/04/image.jpg', variant: 'thumbnail' }
 */
export function parseVariantKey(variantKey: string): { originalKey: string; variant: PhotoVariant } {
  // Check if this is a variant key (contains __)
  const variantMatch = variantKey.match(/(.+)__(\d+)x(\d+)(\..+)?$/);

  if (!variantMatch) {
    return { originalKey: variantKey, variant: 'original' };
  }

  const [, basePath = '', width, height, ext = ''] = variantMatch;
  
  // Determine variant based on dimensions
  const dimensions = `${width}x${height}`;
  let variant: PhotoVariant = 'original';

  for (const [key, size] of Object.entries(LOCAL_PHOTO_SIZES)) {
    if (size && `${size.width}x${size.height}` === dimensions) {
      variant = key as PhotoVariant;
      break;
    }
  }

  // Map variant directories back to source directories
  let originalKey = `${basePath}${ext}`;

  if (basePath.startsWith('artworks/')) {
    // Generated variants in artworks/ → source in originals/
    const cleanPath = basePath.substring('artworks/'.length);
    originalKey = `originals/${cleanPath}${ext}`;
  } else if (basePath.startsWith('submissions/')) {
    // Submissions preserve their path
    originalKey = `${basePath}${ext}`;
  } else if (basePath.startsWith('photos/')) {
    // Legacy photos/ path → map to originals/
    const cleanPath = basePath.substring('photos/'.length);
    originalKey = `originals/${cleanPath}${ext}`;
  }
  // Other paths: keep as-is

  return { originalKey, variant };
}

/**
 * Resize image using WASM-based image optimization
 * 
 * This function uses the wasm-image-optimization library which is specifically
 * designed for Cloudflare Workers and other edge environments.
 * 
 * Supports JPEG, PNG, WebP, and AVIF formats with quality control.
 * 
 * @param imageData - Original image data
 * @param options - Resize options
 * @param _isLocalDev - Unused parameter kept for compatibility
 * @returns Processed image data with actual dimensions
 */
export async function resizeImage(
  imageData: ArrayBuffer,
  options: ImageProcessingOptions,
  _isLocalDev = false
): Promise<ImageProcessingResult> {
  const { variant, format, quality } = options;

  // Get target dimensions
  const targetSize = LOCAL_PHOTO_SIZES[variant];
  if (!targetSize && variant !== 'original') {
    throw new ApiError(`INVALID_VARIANT: Invalid photo variant: ${variant}`, 'INVALID_VARIANT', 400);
  }

  // If original, return as-is
  if (variant === 'original') {
    return {
      data: imageData,
      contentType: format ? `image/${format}` : 'image/jpeg',
      width: 0, // Unknown without processing
      height: 0, // Unknown without processing
      size: imageData.byteLength,
    };
  }

  try {
    // Ensure we have valid target dimensions
    if (!targetSize) {
      throw new Error('Invalid target size configuration');
    }

    // Use wasm-image-optimization to resize the image
    // This library returns both the resized data and actual dimensions
    const result = await optimizeImageExt({
      image: imageData,
      width: targetSize.width,
      height: targetSize.height,
      quality: quality || LOCAL_PHOTO_QUALITY[variant],
      format: format || 'jpeg', // Default to JPEG if not specified
    });

    // Verify we got a valid result
    if (!result || !result.data) {
      throw new Error('Image optimization returned invalid result');
    }

    // Convert Uint8Array to a standalone ArrayBuffer copy.
    // Some WASM/image libs return views into transferable buffers which may be detached
    // after the call. Make an explicit copy using Uint8Array.slice() to avoid
    // "detached ArrayBuffer" errors when later manipulating the buffer.
    let resizedData: ArrayBuffer;
    try {
      const copied = result.data instanceof Uint8Array ? result.data.slice() : new Uint8Array(result.data).slice();
      // If the copied view already covers the whole underlying buffer, reuse it directly to avoid an extra copy.
      if (copied.byteOffset === 0 && copied.byteLength === copied.buffer.byteLength) {
        resizedData = copied.buffer;
      } else {
        // copied.buffer may be larger than the view; create a tight ArrayBuffer.
        resizedData = copied.buffer.slice(copied.byteOffset, copied.byteOffset + copied.byteLength);
      }
    } catch (copyErr) {
      // If copying fails (detached buffer etc.), throw and let the outer catch handle fallback.
      throw copyErr;
    }

    const contentType = `image/${format || 'jpeg'}`;

    return {
      data: resizedData,
      contentType,
      width: result.width, // Actual output width
      height: result.height, // Actual output height
      size: resizedData.byteLength,
    };
  } catch (error) {
    // Only log detailed errors during local development to avoid log noise/IO overhead in production.
    if (_isLocalDev) console.error('Image processing error:', error);
    
    // Fallback: Return original image if resizing fails
    if (_isLocalDev) console.warn(`Image resizing failed for variant ${variant}, returning original`);
    
    return {
      data: imageData,
      contentType: format ? `image/${format}` : 'image/jpeg',
      width: targetSize?.width || 0,
      height: targetSize?.height || 0,
      size: imageData.byteLength,
    };
  }
}

/**
 * Validate image format and size
 * 
 * @param imageData - Image data to validate
 * @param contentType - Content type header
 * @returns True if valid
 */
export function validateImageData(imageData: ArrayBuffer, contentType: string): boolean {
  // Check content type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!validTypes.includes(contentType.toLowerCase())) {
    throw new ApiError(
      `UNSUPPORTED_IMAGE_TYPE: Unsupported image type: ${contentType}`,
      'UNSUPPORTED_IMAGE_TYPE',
      400
    );
  }

  // Check size (max 15MB)
  const MAX_SIZE = 15 * 1024 * 1024;
  if (imageData.byteLength > MAX_SIZE) {
    throw new ApiError(
      `IMAGE_TOO_LARGE: Image too large: ${Math.round(imageData.byteLength / 1024 / 1024)}MB exceeds 15MB limit`,
      'IMAGE_TOO_LARGE',
      400
    );
  }

  // Check if data is actually an image by examining magic bytes
  const view = new Uint8Array(imageData);
  
  // JPEG magic bytes: FF D8 FF
  const isJPEG = view[0] === 0xFF && view[1] === 0xD8 && view[2] === 0xFF;
  
  // PNG magic bytes: 89 50 4E 47
  const isPNG = view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4E && view[3] === 0x47;
  
  // WebP magic bytes: RIFF ... WEBP
  const isWebP = view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46 &&
                 view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50;
  
  if (!isJPEG && !isPNG && !isWebP) {
    throw new ApiError(
      'INVALID_IMAGE_DATA: Invalid image data: file does not match expected format',
      'INVALID_IMAGE_DATA',
      400
    );
  }

  return true;
}

/**
 * Determine appropriate content type from image data
 * 
 * @param imageData - Image data
 * @returns Content type
 */
export function getContentType(imageData: ArrayBuffer): string {
  const view = new Uint8Array(imageData);
  
  // Check magic bytes
  if (view[0] === 0xFF && view[1] === 0xD8 && view[2] === 0xFF) {
    return 'image/jpeg';
  }
  if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4E && view[3] === 0x47) {
    return 'image/png';
  }
  if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46 &&
      view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50) {
    return 'image/webp';
  }
  
  // Default to JPEG if unknown
  return 'image/jpeg';
}

/**
 * Get cache headers for image responses
 * 
 * @param variant - Photo variant
 * @returns Headers object
 */
export function getCacheHeaders(variant: PhotoVariant): Record<string, string> {
  // Tests expect variants to be cached for 1 year and originals for 1 day.
  const VARIANT_CACHE = 31536000; // 1 year
  const ORIGINAL_CACHE = 86400; // 1 day

  if (variant === 'original') {
    return {
      'Cache-Control': `public, max-age=${ORIGINAL_CACHE}`,
      'CDN-Cache-Control': `public, max-age=${ORIGINAL_CACHE}`,
    };
  }

  return {
    'Cache-Control': `public, max-age=${VARIANT_CACHE}, immutable`,
    'CDN-Cache-Control': `public, max-age=${VARIANT_CACHE}`,
    'Vary': 'Accept',
  };
}
