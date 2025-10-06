/**
 * Photo processing utilities for R2 storage and image handling
 *
 * This module provides utilities for uploading, processing, and managing
 * photos in Cloudflare R2 storage with proper validation and optimization.
 */

import type { WorkerEnv } from '../types';
import { ApiError } from './errors';
import { processExifData, getDefaultExifOptions, type ExifProcessingOptions } from './exif';
import { generateVariantKey } from './image-processing';
import type { PhotoVariant } from '../../shared/types';

// Configuration constants
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_PHOTOS_PER_SUBMISSION = 3;
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  mimeType: string;
  size: number;
  errors: string[];
}

/**
 * Photo upload result
 */
export interface PhotoUploadResult {
  originalKey: string;
  thumbnailKey?: string;
  originalUrl: string;
  thumbnailUrl?: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  exifProcessed?: boolean;
  permalinkInjected?: boolean;
}

/**
 * Photo processing options
 */
export interface PhotoProcessingOptions {
  generateThumbnail?: boolean;
  thumbnailSize?: number; // Default 800px
  preserveExif?: boolean;
  addWatermark?: boolean;
  quality?: number; // JPEG quality 1-100
  artworkId?: string; // For permalink injection
  exifOptions?: ExifProcessingOptions;
  useCloudflareImages?: boolean;
}

/**
 * Validate uploaded file
 */
export function validatePhotoFile(file: File): FileValidationResult {
  const errors: string[] = [];

  // Check file name
  if (!file.name || file.name.trim().length === 0) {
    errors.push('File name is required');
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(
      `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  // Check MIME type
  if (!SUPPORTED_MIME_TYPES.includes(file.type.toLowerCase())) {
    errors.push(
      `File type ${file.type} is not supported. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`
    );
  }

  // Check if file has content
  if (file.size === 0) {
    errors.push('File is empty');
  }

  return {
    isValid: errors.length === 0,
    mimeType: file.type.toLowerCase(),
    size: file.size,
    errors,
  };
}

/**
 * Validate multiple photo files
 */
export function validatePhotoFiles(files: File[]): {
  isValid: boolean;
  validFiles: File[];
  errors: string[];
} {
  const errors: string[] = [];
  const validFiles: File[] = [];

  // Check number of files
  if (files.length > MAX_PHOTOS_PER_SUBMISSION) {
    errors.push(
      `Too many files. Maximum ${MAX_PHOTOS_PER_SUBMISSION} photos allowed per submission`
    );
    return { isValid: false, validFiles: [], errors };
  }

  if (files.length === 0) {
    errors.push('At least one photo is required');
    return { isValid: false, validFiles: [], errors };
  }

  // Validate each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue; // Skip undefined files

    const validation = validatePhotoFile(file);

    if (validation.isValid) {
      validFiles.push(file);
    } else {
      errors.push(`File ${i + 1}: ${validation.errors.join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0 && validFiles.length > 0,
    validFiles,
    errors,
  };
}

/**
 * Generate secure filename with timestamp and UUID
 */
export function generateSecureFilename(originalName: string, mimeType: string): string {
  // Extract file extension from MIME type
  const extensionMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };

  const extension = extensionMap[mimeType.toLowerCase()] || 'jpg';

  // Generate timestamp in YYYYMMDD-HHMMSS format
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');

  // Generate short UUID (8 characters)
  const uuid = crypto.randomUUID().split('-')[0];

  // Clean original name (keep only alphanumeric and basic punctuation)
  const cleanName = originalName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9\-_]/g, '') // Remove special chars
    .substring(0, 20); // Limit length

  return `${timestamp}-${uuid}-${cleanName || 'photo'}.${extension}`;
}

/**
 * Generate date-based folder structure (YYYY/MM/DD)
 */
export function generateDateFolder(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  return `${year}/${month}/${day}`;
}

/**
 * Generate full R2 key for photo
 */
export function generateR2Key(filename: string, folder?: string): string {
  const dateFolder = generateDateFolder();
  const basePath = folder || 'photos';

  return `${basePath}/${dateFolder}/${filename}`;
}

/**
 * Upload file to R2 storage
 */
export async function uploadToR2(
  env: WorkerEnv,
  file: File,
  key: string,
  metadata?: Record<string, string>
): Promise<void> {
  try {
    const bucket = env.PHOTOS_BUCKET;

    if (!bucket) {
      throw new ApiError('Photo storage not configured', 'STORAGE_NOT_CONFIGURED', 503);
    }

    const debugEnabled = env.PHOTO_DEBUG === '1' || env.PHOTO_DEBUG === 'true';
    const debug = (...args: unknown[]): void => {
      if (debugEnabled) console.info('[PHOTO][R2]', ...args);
    };
    const start = Date.now();
    debug('R2 put begin', { key, sizeBytes: file.size, mime: file.type });

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Prepare metadata
    const objectMetadata = {
      'Content-Type': file.type,
      'Content-Length': file.size.toString(),
      'Upload-Timestamp': new Date().toISOString(),
      ...metadata,
    };

    // Upload to R2
    await bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: objectMetadata,
    });
    debug('R2 put complete', { key, ms: Date.now() - start });
  } catch (error) {
    console.error('R2 upload error:', error);
    // Best-effort debug log (env already not accessible here if put failed early)
    // Safe because we already gated earlier logs; here we just output once.
    console.info('[PHOTO][R2]', 'R2 put error detail', {
      key,
      message: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to upload photo to storage', 'STORAGE_UPLOAD_ERROR', 503, {
      details: { key },
    });
  }
}

/**
 * Delete file from R2 storage
 */
export async function deleteFromR2(env: WorkerEnv, key: string): Promise<void> {
  try {
    const bucket = env.PHOTOS_BUCKET;

    if (!bucket) {
      console.warn('Photo storage not configured, skipping deletion');
      return;
    }

    await bucket.delete(key);
  } catch (error) {
    console.error('R2 deletion error:', error);
    // Don't throw error for deletion failures - log and continue
  }
}

/**
 * Generate public URL for R2 object
 */
export function generatePhotoUrl(env: WorkerEnv, key: string): string {
  const baseUrl = env.PHOTOS_BASE_URL || env.R2_PUBLIC_URL;

  if (!baseUrl) {
    // Fallback to R2 default URL pattern
    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const bucketName = 'cultural-archiver-photos'; // Default bucket name
    return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
  }

  return `${baseUrl.replace(/\/$/, '')}/${key}`;
}

/**
 * Process and upload multiple photos
 */
export async function processAndUploadPhotos(
  env: WorkerEnv,
  files: File[],
  submissionId: string,
  options: PhotoProcessingOptions = {}
): Promise<PhotoUploadResult[]> {
  const debugEnabled = env.PHOTO_DEBUG === '1' || env.PHOTO_DEBUG === 'true';
  const debug = (...args: unknown[]): void => {
    if (debugEnabled) console.info('[PHOTO][UPLOAD]', ...args);
  };

  debug('Starting processAndUploadPhotos', {
    submissionId,
    fileCount: files.length,
    options: {
      generateThumbnail: options.generateThumbnail,
      thumbnailSize: options.thumbnailSize,
      preserveExif: options.preserveExif,
      addWatermark: options.addWatermark,
      quality: options.quality,
      artworkId: options.artworkId,
      useCloudflareImages: options.useCloudflareImages,
    },
  });

  const results: PhotoUploadResult[] = [];

  try {
    // Validate all files first
    const validation = validatePhotoFiles(files);
    if (!validation.isValid) {
      debug('Validation failed', { errors: validation.errors });
      throw new ApiError('Photo validation failed', 'INVALID_PHOTOS', 400, {
        details: { errors: validation.errors },
      });
    }

    // Process each file
    for (let i = 0; i < validation.validFiles.length; i++) {
      const file = validation.validFiles[i];
      if (!file) continue; // Skip undefined files
      debug('File begin', {
        index: i,
        originalName: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });

      const filename = generateSecureFilename(file.name, file.type);
      const originalKey = generateR2Key(filename, 'originals');

      // Process EXIF data if enabled
      let processedBuffer: ArrayBuffer = await file.arrayBuffer();
      let exifProcessed = false;
      let permalinkInjected = false;

      if (options.preserveExif !== false && file.type.includes('jpeg') && options.artworkId) {
        try {
          const exifOptions = {
            ...getDefaultExifOptions(),
            ...options.exifOptions,
            injectPermalink: true,
            permalink: options.artworkId,
          };

          const exifResult = await processExifData(processedBuffer, exifOptions);
          processedBuffer = exifResult.buffer;
          exifProcessed = true;
          permalinkInjected = exifOptions.injectPermalink;

          console.info('EXIF processing completed for photo:', {
            filename,
            hasGPS: !!exifResult.exifData.gps,
            permalinkInjected,
          });
        } catch (error) {
          console.warn('EXIF processing failed, continuing with original:', {
            error,
            filename,
            submissionId,
          });
          // Continue with original buffer - don't fail the upload
        }
      }

      // Create processed file for upload
      const processedFile = new File([processedBuffer], file.name, { type: file.type });
      debug('File processed buffer ready', {
        index: i,
        processedSizeBytes: processedBuffer.byteLength,
        exifProcessed,
        permalinkInjected,
      });

      // Prepare metadata
      const metadata: Record<string, string> = {
        'Submission-ID': submissionId,
        'Original-Filename': file.name,
        'File-Index': i.toString(),
        'Upload-Source': 'logbook-submission',
      };

      if (options.preserveExif !== false) {
        metadata['Preserve-EXIF'] = 'true';
      }

      if (exifProcessed) {
        metadata['EXIF-Processed'] = 'true';
      }

      if (permalinkInjected && options.artworkId) {
        metadata['Permalink-Injected'] = options.artworkId;
      }

      // Upload processed file with thumbnail support
      debug('Uploading to storage', { index: i, key: originalKey });
      const uploadResult = await uploadWithThumbnail(
        env,
        processedFile,
        originalKey,
        metadata,
        options
      );
      debug('Upload result', {
        index: i,
        originalKey: uploadResult.originalKey,
        thumbnailKey: uploadResult.thumbnailKey,
        cloudflareImageId: uploadResult.cloudflareImageId || null,
      });
      debug('Uploaded file', {
        submissionId,
        index: i,
        originalKey: uploadResult.originalKey,
        thumbnailKey: uploadResult.thumbnailKey,
        mimeType: file.type,
        size: file.size,
      });

      // Prepare result
      const result: PhotoUploadResult = {
        originalKey: uploadResult.originalKey,
        originalUrl: generatePhotoUrl(env, uploadResult.originalKey),
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        exifProcessed,
        permalinkInjected,
      };

      // Add thumbnail information if available
      if (uploadResult.thumbnailKey) {
        result.thumbnailKey = uploadResult.thumbnailKey;
        result.thumbnailUrl = generateThumbnailUrl(
          env,
          uploadResult.originalKey,
          options.thumbnailSize
        );
      }

      // Add Cloudflare Images ID if used
      if (uploadResult.cloudflareImageId) {
        metadata['Cloudflare-Images-ID'] = uploadResult.cloudflareImageId;
      }

      results.push(result);
      debug('Processed result appended', { count: results.length });
    }

    debug('All files processed successfully', { total: results.length });

    // Warm the cache for image variants (fire and forget - don't block response)
    if (results.length > 0) {
      const photoKeys = results.map((r) => r.originalKey);
      // Don't await - run in background
      warmImageCache(env, photoKeys, ['thumbnail', 'medium']).catch((error) => {
        console.error('Background cache warming failed:', error);
      });
    }

    return results;
  } catch (error) {
    console.error('Photo processing error:', error);
    debug('Processing error encountered', { error });

    // Clean up any successfully uploaded files
    for (const result of results) {
      if (result.originalKey) {
        await deleteFromR2(env, result.originalKey);
      }
      if (result.thumbnailKey) {
        await deleteFromR2(env, result.thumbnailKey);
      }
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to process and upload photos', 'PHOTO_PROCESSING_ERROR', 500);
  }
}

/**
 * Warm the cache for image variants by pre-generating them
 * 
 * This function triggers the image resizing API to generate all size variants
 * for the uploaded photos. This ensures the first user doesn't experience
 * the performance penalty of on-demand generation.
 * 
 * @param env - Worker environment
 * @param photoKeys - Array of R2 keys for uploaded photos
 * @param variants - Array of variants to generate (default: thumbnail, medium)
 */
export async function warmImageCache(
  env: WorkerEnv,
  photoKeys: string[],
  variants: PhotoVariant[] = ['thumbnail', 'medium']
): Promise<void> {
  const debugEnabled = env.PHOTO_DEBUG === '1' || env.PHOTO_DEBUG === 'true';
  const debug = (...args: unknown[]): void => {
    if (debugEnabled) console.info('[PHOTO][CACHE_WARM]', ...args);
  };

  debug('Starting cache warming', { photoCount: photoKeys.length, variants });

  try {
    const bucket = env.PHOTOS_BUCKET;
    if (!bucket) {
      console.warn('Photo storage not configured, skipping cache warming');
      return;
    }

    // Process all photos and variants in parallel
    const warmingPromises = photoKeys.flatMap((originalKey) =>
      variants.map(async (variant) => {
        try {
          // Generate the variant key
          const variantKey = generateVariantKey(originalKey, variant);

          // Check if variant already exists
          const existing = await bucket.head(variantKey);
          if (existing) {
            debug('Variant already exists', { originalKey, variant, variantKey });
            return;
          }

          // Fetch the original image
          const originalObject = await bucket.get(originalKey);
          if (!originalObject) {
            console.warn('Original image not found for cache warming', { originalKey });
            return;
          }

          // Read the original image data
          const originalData = await originalObject.arrayBuffer();

          // Import resizeImage here to avoid circular dependencies
          const { resizeImage, getContentType } = await import('./image-processing');

          const contentType =
            originalObject.httpMetadata?.contentType || getContentType(originalData);

          // Detect local development - Cloudflare Image Resizing doesn't work in wrangler dev
          const isLocalDev = env.ENVIRONMENT === 'development' || !env.ENVIRONMENT;

          // Resize the image
          const resized = await resizeImage(originalData, {
            variant,
            format: contentType.split('/')[1] as 'jpeg' | 'png' | 'webp',
          }, isLocalDev);

          // Store the resized variant in R2
          await bucket.put(variantKey, resized.data, {
            httpMetadata: {
              contentType: resized.contentType,
            },
            customMetadata: {
              'Original-Key': originalKey,
              'Variant': variant,
              'Generated-At': new Date().toISOString(),
              'Width': resized.width.toString(),
              'Height': resized.height.toString(),
              'Cache-Warmed': 'true',
            },
          });

          debug('Variant generated and cached', {
            originalKey,
            variant,
            variantKey,
            size: resized.size,
          });
        } catch (error) {
          console.error('Failed to warm cache for variant', {
            originalKey,
            variant,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other variants even if one fails
        }
      })
    );

    // Wait for all warming operations to complete
    await Promise.all(warmingPromises);

    debug('Cache warming completed', {
      photoCount: photoKeys.length,
      variantCount: variants.length,
      totalOperations: warmingPromises.length,
    });
  } catch (error) {
    console.error('Cache warming error:', error);
    // Don't throw - cache warming is optional optimization
  }
}

/**
 * Move photos from logbook to artwork (for approval process)
 */
export async function movePhotosToArtwork(
  env: WorkerEnv,
  logbookPhotos: string[],
  artworkId: string
): Promise<string[]> {
  const newPhotoUrls: string[] = [];
  const debugEnabled = env.PHOTO_DEBUG === '1' || env.PHOTO_DEBUG === 'true';
  const debug = (...args: unknown[]): void => {
    if (debugEnabled) console.info('[PHOTO][MOVE]', ...args);
  };

  debug('Starting movePhotosToArtwork', { artworkId, photoCount: logbookPhotos.length });

  try {
    for (const photoUrl of logbookPhotos) {
      // Extract key from URL or raw key string
      const originalKey = extractR2KeyFromRef(photoUrl);
      debug('Processing photo', { photoUrl, originalKey });

      if (!originalKey) {
        console.warn('[PHOTO][MOVE] Unable to determine R2 key for photo ref', { photoUrl });
        continue;
      }

      // Generate new key for artwork
      const filename = originalKey.split('/').pop() || 'unknown.jpg';
      const newKey = generateR2Key(filename, 'artworks');

      // Copy file to new location
      const bucket = env.PHOTOS_BUCKET;
      if (bucket) {
        // Get original object
        const originalObject = await bucket.get(originalKey);
        if (originalObject) {
          debug('Fetched original from R2', {
            originalKey,
            size: originalObject.size,
            httpMetadata: originalObject.httpMetadata || null,
          });
          // Copy to new location with updated metadata
          await bucket.put(newKey, originalObject.body, {
            ...(originalObject.httpMetadata && { httpMetadata: originalObject.httpMetadata }),
            customMetadata: {
              ...originalObject.customMetadata,
              'Artwork-ID': artworkId,
              'Moved-From': originalKey,
              'Moved-At': new Date().toISOString(),
            },
          });
          debug('Copied object to new key', { newKey });

          // Delete original (optional, for cleanup)
          // await deleteFromR2(env, originalKey);

          newPhotoUrls.push(generatePhotoUrl(env, newKey));
          debug('Photo moved', { originalKey, newKey, totalMoved: newPhotoUrls.length });
        } else {
          console.warn('[PHOTO][MOVE] Original object missing in bucket', { originalKey });
        }
      }
    }

    debug('Completed movePhotosToArtwork', { moved: newPhotoUrls.length });
    return newPhotoUrls;
  } catch (error) {
    console.error('Error moving photos to artwork:', error);
    debug('Move error encountered', { error });

    // Clean up any new files that were created
    for (const photoUrl of newPhotoUrls) {
      try {
        const urlObj = new URL(photoUrl);
        const key = urlObj.pathname.substring(1);
        await deleteFromR2(env, key);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    throw new ApiError('Failed to move photos to artwork', 'PHOTO_MOVE_ERROR', 500);
  }
}

/**
 * Clean up photos for rejected submissions
 */
export async function cleanupRejectedPhotos(env: WorkerEnv, photoUrls: string[]): Promise<void> {
  try {
    const deletePromises = photoUrls.map(async photoUrl => {
      try {
        const key = extractR2KeyFromRef(photoUrl);
        if (key) await deleteFromR2(env, key);
      } catch (error) {
        console.error('Error deleting photo:', photoUrl, error);
      }
    });

    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error cleaning up rejected photos:', error);
    // Don't throw error - cleanup failures shouldn't block the rejection process
  }
}

/**
 * Get photo metadata from R2
 */
export async function getPhotoMetadata(
  env: WorkerEnv,
  key: string
): Promise<Record<string, string> | null> {
  try {
    const bucket = env.PHOTOS_BUCKET;
    if (!bucket) {
      return null;
    }

    const object = await bucket.head(key);
    if (!object) {
      return null;
    }

    return {
      ...object.customMetadata,
      contentType: object.httpMetadata?.contentType || 'unknown',
      size: object.size?.toString() || '0',
      uploaded: object.uploaded?.toISOString() || 'unknown',
    };
  } catch (error) {
    console.error('Error getting photo metadata:', error);
    return null;
  }
}

/**
 * Generate photo URLs from R2 keys
 */
export function generatePhotoUrls(env: WorkerEnv, keys: string[]): string[] {
  return keys.map(key => generatePhotoUrl(env, key));
}

/**
 * Extract R2 key from a photo reference which may be a full URL or a raw R2 key.
 * Returns null if the key cannot be determined.
 */
export function extractR2KeyFromRef(ref: string): string | null {
  if (!ref) return null;

  // Helper to normalize a pathname-like string into an R2 key
  const normalizePath = (path: string): string | null => {
    if (!path) return null;
    let candidate = path.replace(/^\/+/, ''); // remove leading slashes

    // If the path begins with the public photos prefix, strip it.
    // This ensures values like '/photos/originals/...' or 'photos/originals/...' map to 'originals/...'
    if (candidate.toLowerCase().startsWith('photos/')) {
      candidate = candidate.substring('photos/'.length);
    }

    // If after normalization we have something that looks like a key, return it
    return candidate.length > 0 ? candidate : null;
  };

  try {
    // If ref is an absolute URL, new URL(ref) will succeed and we can extract pathname
    const u = new URL(ref);
    return normalizePath(u.pathname);
  } catch (err) {
    // Not a full URL — treat as path or raw key
    return normalizePath(ref);
  }
}

/**
 * Validate photo URL belongs to the system
 */
export function validatePhotoUrl(env: WorkerEnv, url: string): boolean {
  try {
    new URL(url); // Validate URL format
    const baseUrl = env.PHOTOS_BASE_URL || env.R2_PUBLIC_URL;

    if (baseUrl) {
      return url.startsWith(baseUrl);
    }

    // Check against R2 default pattern
    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    if (accountId) {
      return url.includes(`${accountId}.r2.cloudflarestorage.com`);
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Generate thumbnail URL using Cloudflare Images if enabled
 */
export function generateThumbnailUrl(
  env: WorkerEnv,
  originalKey: string,
  size: number = 800
): string {
  const cloudflareImagesEnabled = env.CLOUDFLARE_IMAGES_ENABLED === 'true';

  if (cloudflareImagesEnabled && env.CLOUDFLARE_IMAGES_HASH) {
    // Use Cloudflare Images for dynamic resizing
    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const imagesHash = env.CLOUDFLARE_IMAGES_HASH;
    return `https://imagedelivery.net/${accountId}/${imagesHash}/w=${size}`;
  }

  // Fallback to original URL for MVP
  return generatePhotoUrl(env, originalKey);
}

/**
 * Upload to Cloudflare Images if enabled, otherwise use R2
 */
export async function uploadWithThumbnail(
  env: WorkerEnv,
  file: File,
  originalKey: string,
  metadata?: Record<string, string>,
  _options: PhotoProcessingOptions = {}
): Promise<{ originalKey: string; thumbnailKey?: string; cloudflareImageId?: string }> {
  const cloudflareImagesEnabled = env.CLOUDFLARE_IMAGES_ENABLED === 'true';
  const debugEnabled = env.PHOTO_DEBUG === '1' || env.PHOTO_DEBUG === 'true';
  const debug = (...args: unknown[]): void => {
    if (debugEnabled) console.info('[PHOTO][STORE]', ...args);
  };
  debug('uploadWithThumbnail start', { originalKey, sizeBytes: file.size, mime: file.type });

  if (cloudflareImagesEnabled && env.CLOUDFLARE_ACCOUNT_ID) {
    try {
      // Upload to Cloudflare Images
      const imageId = await uploadToCloudflareImages(env, file);
      debug('Cloudflare Images upload success', { imageId, originalKey });

      return {
        originalKey,
        cloudflareImageId: imageId,
      };
    } catch (error) {
      console.warn('[PHOTO][STORE] Cloudflare Images upload failed, falling back to R2', error);
      // Fall through to R2 upload
    }
  }

  // Upload to R2 (existing behavior)
  debug('Uploading to R2 bucket', { originalKey });
  await uploadToR2(env, file, originalKey, metadata);
  debug('R2 upload complete', { originalKey });

  // Generate thumbnail key for potential future thumbnail generation
  const thumbnailKey = generateThumbnailKey(originalKey);

  const result = {
    originalKey,
    thumbnailKey,
  };
  debug('uploadWithThumbnail done', result);
  return result;
}

/**
 * Upload to Cloudflare Images API
 */
async function uploadToCloudflareImages(env: WorkerEnv, file: File): Promise<string> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;

  if (!accountId) {
    throw new Error('Cloudflare Account ID not configured');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('requireSignedURLs', 'false'); // Allow public access
  formData.append(
    'metadata',
    JSON.stringify({
      source: 'cultural-archiver',
      uploadedAt: new Date().toISOString(),
    })
  );

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_IMAGES_API_TOKEN || ''}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudflare Images upload failed: ${error}`);
  }

  const result = (await response.json()) as { result: { id: string } };
  return result.result.id;
}

/**
 * Generate thumbnail key based on original key
 */
function generateThumbnailKey(originalKey: string): string {
  const parts = originalKey.split('/');
  const filename = parts.pop() || '';
  const folder = parts.join('/');

  // Replace 'originals' with 'thumbnails' or add thumbnails folder
  const thumbnailFolder = folder.replace('originals', 'thumbnails') || 'thumbnails';

  return `${thumbnailFolder}/${filename}`;
}
