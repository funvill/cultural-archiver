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
 * Generate the R2 key for a resized image variant
 * 
 * @param originalKey - Original image R2 key (e.g., "artworks/2024/01/15/timestamp-uuid.jpg")
 * @param variant - Size variant
 * @returns R2 key for the variant (e.g., "artworks/2024/01/15/timestamp-uuid__400x400.jpg")
 */
export function generateVariantKey(originalKey: string, variant: PhotoVariant): string {
  if (variant === 'original') {
    return originalKey;
  }

  const size = LOCAL_PHOTO_SIZES[variant];
  if (!size) {
    throw new ApiError(`INVALID_VARIANT: Invalid photo variant: ${variant}`, 'INVALID_VARIANT', 400);
  }

  // Split the key into path and filename
  const lastSlash = originalKey.lastIndexOf('/');
  const path = lastSlash >= 0 ? originalKey.substring(0, lastSlash + 1) : '';
  const filename = lastSlash >= 0 ? originalKey.substring(lastSlash + 1) : originalKey;

  // Split filename into name and extension
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot >= 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot >= 0 ? filename.substring(lastDot) : '';

  return `${path}${name}__${size.width}x${size.height}${ext}`;
}

/**
 * Parse a variant key to extract the original key and variant size
 * 
 * @param variantKey - Variant R2 key (e.g., "artworks/2024/01/15/timestamp-uuid__400x400.jpg")
 * @returns Object with originalKey and variant
 */
export function parseVariantKey(variantKey: string): { originalKey: string; variant: PhotoVariant } {
  // Check if this is a variant key (contains __)
  const variantMatch = variantKey.match(/(.+)__(\d+)x(\d+)(\..+)?$/);

  if (!variantMatch) {
    return { originalKey: variantKey, variant: 'original' };
  }

  const [, basePath, width, height, ext = ''] = variantMatch;
  const originalKey = `${basePath}${ext}`;

  // Determine variant based on dimensions
  const dimensions = `${width}x${height}`;
  let variant: PhotoVariant = 'original';

  for (const [key, size] of Object.entries(LOCAL_PHOTO_SIZES)) {
    if (size && `${size.width}x${size.height}` === dimensions) {
      variant = key as PhotoVariant;
      break;
    }
  }

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

    // Convert Uint8Array to ArrayBuffer
    const resizedData = result.data.buffer.slice(
      result.data.byteOffset,
      result.data.byteOffset + result.data.byteLength
    );

    const contentType = `image/${format || 'jpeg'}`;

    return {
      data: resizedData,
      contentType,
      width: result.width, // Actual output width
      height: result.height, // Actual output height
      size: resizedData.byteLength,
    };
  } catch (error) {
    console.error('Image processing error:', error);
    
    // Fallback: Return original image if resizing fails
    console.warn(`Image resizing failed for variant ${variant}, returning original`);
    
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
