/**
 * Mass Import v3 Photo Handler
 * 
 * Handles photo processing for mass import v3:
 * - Validates photo URLs
 * - Downloads photos from external URLs
 * - Uploads to R2 storage
 * - Generates thumbnails (queued)
 * - Returns photo records for database storage
 */

import type { WorkerEnv } from '../../types';
import { uploadToR2, generateR2Key, generatePhotoUrl } from '../../lib/photos';

/**
 * Photo input - can be a string URL or object with metadata
 */
export type PhotoInput = string | {
  url: string;
  caption?: string;
  credit?: string;
};

/**
 * Processed photo record ready for database storage
 */
export interface ProcessedPhoto {
  url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  credit?: string | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  size_bytes?: number | null;
}

/**
 * Photo processing result
 */
export interface PhotoProcessingResult {
  success: boolean;
  photos: ProcessedPhoto[];
  errors: Array<{
    index: number;
    url: string;
    error: string;
  }>;
}

/**
 * Normalize photo input to consistent format
 */
function normalizePhotoInput(input: PhotoInput): { url: string; caption?: string; credit?: string } {
  if (typeof input === 'string') {
    return { url: input };
  }
  return input;
}

/**
 * Validate photo URL accessibility
 * Makes HEAD request to check if URL is accessible
 */
async function validatePhotoUrl(url: string): Promise<{ valid: boolean; error?: string; contentType?: string }> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000), // 5 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': new URL(url).origin + '/',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      return {
        valid: false,
        error: `Photo URL returned ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      return {
        valid: false,
        error: `Photo URL does not return an image (content-type: ${contentType})`,
      };
    }

    return { valid: true, contentType };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to access photo URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Process a single photo
 * - Validates URL accessibility
 * - Downloads photo from external URL
 * - Uploads to R2 storage
 * - Returns R2 URL for database storage
 */
async function processPhoto(
  input: PhotoInput,
  env: WorkerEnv
): Promise<{ success: boolean; photo?: ProcessedPhoto; error?: string }> {
  const { url, caption, credit } = normalizePhotoInput(input);

  try {
    // Validate URL accessibility
    const validation = await validatePhotoUrl(url);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Failed to validate photo URL',
      };
    }

    // Download the photo from external URL
    const photoResponse = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(30000), // 30 second timeout for download
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': new URL(url).origin + '/',
      },
    });

    if (!photoResponse.ok) {
      return {
        success: false,
        error: `Failed to download photo: ${photoResponse.status} ${photoResponse.statusText}`,
      };
    }

    // Get content type
    const contentType = photoResponse.headers.get('content-type') || validation.contentType || 'image/jpeg';
    
    // Validate it's actually an image
    if (!contentType.startsWith('image/')) {
      return {
        success: false,
        error: `Downloaded content is not an image: ${contentType}`,
      };
    }

    // Convert response to ArrayBuffer
    const arrayBuffer = await photoResponse.arrayBuffer();
    
    // Check file size (15MB limit)
    const maxSize = 15 * 1024 * 1024;
    if (arrayBuffer.byteLength > maxSize) {
      return {
        success: false,
        error: `Photo too large: ${arrayBuffer.byteLength} bytes (max ${maxSize})`,
      };
    }

    // Generate filename from URL or use timestamp
    const urlPath = new URL(url).pathname;
    const originalFilename = urlPath.split('/').pop() || `mass-import-${Date.now()}.jpg`;
    const filename = sanitizeFilename(originalFilename);

    // Create File object for R2 upload
    const file = new File([arrayBuffer], filename, { type: contentType });

    // Generate R2 key in mass-import folder
    const r2Key = generateR2Key(filename, 'mass-import');

    // Upload to R2
    await uploadToR2(env, file, r2Key, {
      'Original-URL': url,
      'Upload-Source': 'mass-import-v3',
      'Upload-Timestamp': new Date().toISOString(),
    });

    // Generate public URL for the uploaded photo
    const r2Url = generatePhotoUrl(env, r2Key);

    // Create photo record with R2 URL
    const photo: ProcessedPhoto = {
      url: r2Url,
      caption: caption || null,
      credit: credit || null,
      format: contentType.split('/')[1] || 'jpeg',
      size_bytes: arrayBuffer.byteLength,
      // TODO: Add image dimension detection
      // TODO: Generate thumbnail_url via image processing queue
    };

    return { success: true, photo };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error processing photo',
    };
  }
}

/**
 * Sanitize filename for safe R2 storage
 * Removes special characters and ensures valid filename
 */
function sanitizeFilename(filename: string): string {
  // Extract extension
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : '.jpg';

  // Clean the name: keep only alphanumeric, hyphens, underscores
  const cleanName = name
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100); // Limit length

  // Add timestamp to ensure uniqueness
  const timestamp = Date.now();
  
  return `${timestamp}-${cleanName}${ext}`.toLowerCase();
}

/**
 * Process multiple photos
 * - Validates each photo URL
 * - Downloads and uploads to R2
 * - Returns successfully processed photos
 * - Collects errors for failed photos
 * - Continues processing even if some photos fail
 */
export async function processPhotos(photos: PhotoInput[], env: WorkerEnv): Promise<PhotoProcessingResult> {
  const results: ProcessedPhoto[] = [];
  const errors: Array<{ index: number; url: string; error: string }> = [];

  for (let i = 0; i < photos.length; i++) {
    const input = photos[i];
    if (!input) continue; // Skip undefined entries

    const { url } = normalizePhotoInput(input);

    try {
      const result = await processPhoto(input, env);

      if (result.success && result.photo) {
        results.push(result.photo);
      } else {
        errors.push({
          index: i,
          url,
          error: result.error || 'Unknown error processing photo',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({
        index: i,
        url,
        error: errorMessage,
      });
    }
  }

  return {
    success: errors.length === 0,
    photos: results,
    errors,
  };
}

/**
 * Build photos JSON for database storage
 * Converts ProcessedPhoto[] to JSON string
 */
export function buildPhotosJson(photos: ProcessedPhoto[]): string {
  return JSON.stringify(photos);
}
