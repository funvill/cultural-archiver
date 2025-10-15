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
 * - For now, stores the original URL as-is
 * - TODO: Download and upload to R2 in future enhancement
 */
async function processPhoto(
  input: PhotoInput
): Promise<{ success: boolean; photo?: ProcessedPhoto; error?: string }> {
  const { url, caption, credit } = normalizePhotoInput(input);

  // Validate URL accessibility
  const validation = await validatePhotoUrl(url);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || 'Failed to validate photo URL',
    };
  }

  // For Phase 5 initial implementation, we just store the original URL
  // Future enhancement: Download, upload to R2, generate thumbnails
  const photo: ProcessedPhoto = {
    url,
    caption: caption || null,
    credit: credit || null,
    // TODO: Add format detection from content-type
    // TODO: Add image dimension detection
    // TODO: Add R2 upload and generate thumbnail_url
  };

  return { success: true, photo };
}

/**
 * Process multiple photos
 * - Validates each photo URL
 * - Returns successfully processed photos
 * - Collects errors for failed photos
 * - Continues processing even if some photos fail
 */
export async function processPhotos(photos: PhotoInput[]): Promise<PhotoProcessingResult> {
  const results: ProcessedPhoto[] = [];
  const errors: Array<{ index: number; url: string; error: string }> = [];

  for (let i = 0; i < photos.length; i++) {
    const input = photos[i];
    if (!input) continue; // Skip undefined entries

    const { url } = normalizePhotoInput(input);

    try {
      const result = await processPhoto(input);

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
