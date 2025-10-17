/**
 * Image processing and EXIF utilities for photo handling
 */

import exifr from 'exifr';
import type { Coordinates } from '../types';
import type { PhotoVariant } from '../../../shared/types';
import { getApiBaseUrl } from './api-config';

export interface ExifData {
  latitude?: number;
  longitude?: number;
  dateTime?: Date;
  make?: string;
  model?: string;
  orientation?: number;
  width?: number;
  height?: number;
}

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

/**
 * Extract EXIF data from image file
 */
export async function extractExifData(file: File): Promise<ExifData> {
  try {
    const exifData = await exifr.parse(file);

    const result: ExifData = {};

    // Extract GPS coordinates
    if (exifData.latitude && exifData.longitude) {
      result.latitude = exifData.latitude;
      result.longitude = exifData.longitude;
    }

    // Extract date/time
    if (exifData.DateTimeOriginal) {
      result.dateTime = new Date(exifData.DateTimeOriginal);
    } else if (exifData.DateTime) {
      result.dateTime = new Date(exifData.DateTime);
    }

    // Extract camera info
    if (exifData.Make) {
      result.make = exifData.Make;
    }
    if (exifData.Model) {
      result.model = exifData.Model;
    }

    // Extract orientation
    if (exifData.Orientation) {
      result.orientation = exifData.Orientation;
    }

    // Extract dimensions
    if (exifData.ExifImageWidth) {
      result.width = exifData.ExifImageWidth;
    }
    if (exifData.ExifImageHeight) {
      result.height = exifData.ExifImageHeight;
    }

    return result;
  } catch (err: unknown) {
    console.warn('Failed to extract EXIF data:', err);
    return {};
  }
}

/**
 * Extract coordinates from EXIF data
 */
export async function extractImageCoordinates(file: File): Promise<Coordinates | null> {
  try {
    const exifData = await extractExifData(file);

    if (exifData.latitude && exifData.longitude) {
      return {
        latitude: exifData.latitude,
        longitude: exifData.longitude,
      };
    }

    return null;
  } catch (err: unknown) {
    console.warn('Failed to extract image coordinates:', err);
    return null;
  }
}

/**
 * Resize image to fit within maximum dimensions
 */
export async function resizeImage(file: File, options: ImageProcessingOptions = {}): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.85, format = 'jpeg' } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = (): void => {
      // Calculate new dimensions
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw resized image
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        blob => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: `image/${format}`,
              lastModified: file.lastModified,
            });
            resolve(resizedFile);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        `image/${format}`,
        quality
      );
    };

    img.onerror = (): void => {
      reject(new Error('Failed to load image'));
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e): void => {
      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = (): void => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Create thumbnail from image
 */
export async function createThumbnail(file: File, size: number = 200): Promise<File> {
  return resizeImage(file, {
    maxWidth: size,
    maxHeight: size,
    quality: 0.8,
    format: 'jpeg',
  });
}

/**
 * Check if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Get image dimensions without loading the full image
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = (): void => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = (): void => {
      reject(new Error('Failed to load image'));
    };

    const reader = new FileReader();
    reader.onload = (e): void => {
      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = (): void => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Convert image to specific format
 */
export async function convertImageFormat(
  file: File,
  format: 'jpeg' | 'png' | 'webp',
  quality: number = 0.9
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = (): void => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Set white background for JPEG
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        blob => {
          if (blob) {
            const convertedFile = new File([blob], changeFileExtension(file.name, format), {
              type: `image/${format}`,
              lastModified: file.lastModified,
            });
            resolve(convertedFile);
          } else {
            reject(new Error('Failed to convert image'));
          }
        },
        `image/${format}`,
        quality
      );
    };

    img.onerror = (): void => {
      reject(new Error('Failed to load image'));
    };

    const reader = new FileReader();
    reader.onload = (e): void => {
      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = (): void => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Change file extension
 */
function changeFileExtension(filename: string, newExtension: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return `${filename}.${newExtension}`;
  }
  return `${filename.substring(0, lastDotIndex)}.${newExtension}`;
}

/**
 * Optimize image for upload
 */
export async function optimizeImageForUpload(
  file: File,
  options: {
    maxSize?: number; // in bytes
    maxWidth?: number;
    maxHeight?: number;
  } = {}
): Promise<File> {
  const {
    maxSize = 2 * 1024 * 1024, // 2MB
    maxWidth = 1920,
    maxHeight = 1080,
  } = options;

  let optimizedFile = file;

  // If file is already small enough, return as-is
  if (file.size <= maxSize) {
    return file;
  }

  // Try resizing first
  optimizedFile = await resizeImage(file, {
    maxWidth,
    maxHeight,
    quality: 0.8,
    format: 'jpeg',
  });

  // If still too large, reduce quality
  if (optimizedFile.size > maxSize) {
    let quality = 0.6;

    while (quality > 0.1 && optimizedFile.size > maxSize) {
      optimizedFile = await resizeImage(file, {
        maxWidth,
        maxHeight,
        quality,
        format: 'jpeg',
      });
      quality -= 0.1;
    }
  }

  return optimizedFile;
}

/**
 * Generate image preview URL
 */
export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e): void => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to create preview'));
      }
    };

    reader.onerror = (): void => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Batch process multiple images
 */
export async function processImageBatch(
  files: File[],
  processor: (file: File) => Promise<File>,
  onProgress?: (progress: number) => void
): Promise<File[]> {
  const results: File[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;

    try {
      const processed = await processor(file);
      results.push(processed);

      if (onProgress) {
        onProgress(((i + 1) / files.length) * 100);
      }
    } catch (error) {
      console.error(`Failed to process image ${i + 1}:`, error);
      // Keep original file if processing fails
      results.push(file);
    }
  }

  return results;
}

/**
 * Get the sized image URL for on-demand resizing
 * 
 * Constructs a URL to the image resizing API endpoint that will serve
 * the requested size variant. If the variant doesn't exist, it will be
 * generated on the fly.
 * 
 * @param originalUrl - Original image URL (e.g., "artworks/2024/01/15/image.jpg")
 * @param size - Desired image size variant
 * @returns API endpoint URL for the sized image
 * 
 * @example
 * ```ts
 * const thumbnailUrl = getImageSizedURL('artworks/2024/01/15/image.jpg', 'thumbnail');
 * // Development: "/api/images/thumbnail/artworks/2024/01/15/image.jpg"
 * // Production: "https://api.publicartregistry.com/api/images/thumbnail/artworks/2024/01/15/image.jpg"
 * ```
 */
export function getImageSizedURL(originalUrl: string, size: PhotoVariant = 'original'): string {
  // For original variant, return the URL unchanged
  if (size === 'original') {
    return originalUrl;
  }
  
  let cleanUrl = originalUrl;
  let isExternalUrl = false;
  
  // Check if it's a full URL (http://, https://) or protocol-relative URL (//)
  if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://') || originalUrl.startsWith('//')) {
    // Extract the R2 key from full photo URLs
    // Example: https://photos.publicartregistry.com/originals/2025/10/04/file.jpg
    //       -> originals/2025/10/04/file.jpg
    const allowedPrefixes = ['originals/', 'photos/', 'artworks/', 'submissions/'];
    
    let foundPrefix = false;
    for (const prefix of allowedPrefixes) {
      const idx = originalUrl.indexOf(prefix);
      if (idx >= 0) {
        cleanUrl = originalUrl.substring(idx);
        foundPrefix = true;
        break;
      }
    }
    
    // If no allowed prefix found, this is an external URL (not from our R2 storage)
    // Return it as-is since we can't resize external images
    if (!foundPrefix) {
      isExternalUrl = true;
    }
  } else {
    // Relative path - remove leading slash if present
    cleanUrl = originalUrl.replace(/^\//, '');
  }
  
  // For external URLs, return them unchanged (can't resize what we don't host)
  if (isExternalUrl) {
    return originalUrl;
  }
  
  // Construct the API endpoint URL
  // In production: https://api.publicartregistry.com/api/images/thumbnail/...
  // In development: /api/images/thumbnail/...
  const apiBaseUrl = getApiBaseUrl();
  const apiUrl = `${apiBaseUrl}/images/${size}/${cleanUrl}`;
  
  return apiUrl;
}

/**
 * Get multiple size variants for an image
 * 
 * @param originalUrl - Original image URL
 * @returns Object with URLs for all size variants
 * 
 * @example
 * ```ts
 * const urls = getImageVariantURLs('artworks/2024/01/15/image.jpg');
 * // Returns: {
 * //   thumbnail: "https://api.publicartregistry.com/api/images/thumbnail/artworks/...",
 * //   medium: "https://api.publicartregistry.com/api/images/medium/artworks/...",
 * //   large: "https://api.publicartregistry.com/api/images/large/artworks/...",
 * //   original: "https://api.publicartregistry.com/api/images/original/artworks/..."
 * // }
 * ```
 */
export function getImageVariantURLs(originalUrl: string): Record<PhotoVariant, string> {
  return {
    thumbnail: getImageSizedURL(originalUrl, 'thumbnail'),
    medium: getImageSizedURL(originalUrl, 'medium'),
    large: getImageSizedURL(originalUrl, 'large'),
    original: getImageSizedURL(originalUrl, 'original'),
  };
}

/**
 * Preload image variants to warm the cache
 * 
 * This function creates Image elements to trigger browser and CDN caching
 * for multiple image sizes. Useful after uploading a new image.
 * 
 * @param originalUrl - Original image URL
 * @param sizes - Array of sizes to preload (defaults to all)
 * @returns Promise that resolves when all images are loaded or fail
 */
export function preloadImageVariants(
  originalUrl: string,
  sizes: PhotoVariant[] = ['thumbnail', 'medium', 'large']
): Promise<void> {
  // Create link elements for preloading images using browser's prefetch mechanism
  sizes.forEach(size => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'image';
    link.href = getImageSizedURL(originalUrl, size);
    document.head.appendChild(link);
  });
  
  // Return resolved promise for compatibility
  return Promise.resolve();
}
