/**
 * EXIF metadata handling utilities for photo processing
 *
 * This module provides utilities for extracting, preserving, and modifying
 * EXIF metadata in photos, including GPS coordinate preservation and
 * permalink injection for the Cultural Archiver system.
 */

import { ApiError } from './errors';

/**
 * EXIF data structure for GPS coordinates
 */
export interface ExifGPSData {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp?: string;
}

/**
 * EXIF data structure for camera metadata
 */
export interface ExifCameraData {
  make?: string;
  model?: string;
  software?: string;
  dateTime?: string;
  orientation?: number;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
}

/**
 * Complete EXIF data structure
 */
export interface ExifData {
  gps?: ExifGPSData;
  camera?: ExifCameraData;
  comment?: string;
  userComment?: string;
  permalink?: string;
}

/**
 * EXIF processing options
 */
export interface ExifProcessingOptions {
  preserveGPS?: boolean;
  preserveCamera?: boolean;
  injectPermalink?: boolean;
  permalink?: string;
  stripPrivateData?: boolean;
}

/**
 * Extract EXIF data from image buffer
 * 
 * For MVP, this is a basic implementation that focuses on GPS data extraction.
 * Future enhancement: integrate with a full EXIF library like exifr or piexifjs
 */
export async function extractExifData(buffer: ArrayBuffer): Promise<ExifData> {
  try {
    // Basic EXIF header detection for JPEG files
    const view = new DataView(buffer);
    
    // Check for JPEG magic number (0xFFD8)
    if (view.getUint16(0) !== 0xFFD8) {
      return {}; // Not a JPEG file, return empty EXIF data
    }

    // For MVP, return basic structure
    // TODO: Implement full EXIF parsing with external library
    const exifData: ExifData = {
      comment: 'Cultural Archiver photo submission'
    };

    return exifData;
  } catch (error) {
    console.warn('Failed to extract EXIF data:', error);
    return {};
  }
}

/**
 * Inject permalink information into EXIF comment field
 */
export async function injectPermalink(
  buffer: ArrayBuffer,
  artworkId: string,
  _options: ExifProcessingOptions = {}
): Promise<ArrayBuffer> {
  try {
    // Validate input buffer
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('Invalid buffer for EXIF processing');
    }

    const permalink = `/p/artwork/${artworkId}`;
    const comment = `Cultural Archiver: ${permalink} - Archived ${new Date().toISOString()}`;

    // For MVP, return original buffer with metadata preserved
    // Future enhancement: implement actual EXIF modification
    // This would involve using a library like piexifjs to modify the EXIF comment field

    console.info('Permalink prepared for injection:', { artworkId, permalink, comment });
    
    return buffer;
  } catch (error) {
    console.error('Failed to inject permalink into EXIF:', error);
    throw new ApiError('EXIF permalink injection failed', 'EXIF_PROCESSING_ERROR', 500);
  }
}

/**
 * Process EXIF data according to options
 */
export async function processExifData(
  buffer: ArrayBuffer,
  options: ExifProcessingOptions = {}
): Promise<{ buffer: ArrayBuffer; exifData: ExifData }> {
  try {
    // Validate input buffer
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('Invalid buffer for EXIF processing');
    }

    // Extract existing EXIF data
    const exifData = await extractExifData(buffer);
    
    // Create modified buffer (for MVP, return original)
    let processedBuffer = buffer;

    // Inject permalink if requested
    if (options.injectPermalink && options.permalink) {
      processedBuffer = await injectPermalink(buffer, options.permalink, options);
    }

    // Log processing for debugging
    console.info('EXIF processing completed:', {
      hasGPS: !!exifData.gps,
      hasCamera: !!exifData.camera,
      permalinkInjected: options.injectPermalink,
      originalSize: buffer.byteLength,
      processedSize: processedBuffer.byteLength
    });

    return {
      buffer: processedBuffer,
      exifData
    };
  } catch (error) {
    console.error('EXIF processing failed:', error);
    throw new ApiError('EXIF processing failed', 'EXIF_PROCESSING_ERROR', 500);
  }
}

/**
 * Validate EXIF data integrity
 */
export function validateExifData(exifData: ExifData): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate GPS data if present
  if (exifData.gps) {
    const { latitude, longitude } = exifData.gps;
    
    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      errors.push('Invalid GPS latitude value');
    }
    
    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      errors.push('Invalid GPS longitude value');
    }
  }

  // Validate camera data if present
  if (exifData.camera) {
    if (exifData.camera.iso && (exifData.camera.iso < 1 || exifData.camera.iso > 409600)) {
      errors.push('Invalid ISO value');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate default EXIF processing options for Cultural Archiver
 */
export function getDefaultExifOptions(): ExifProcessingOptions {
  return {
    preserveGPS: true,
    preserveCamera: true,
    injectPermalink: true,
    stripPrivateData: false
  };
}

/**
 * Check if buffer contains EXIF data
 */
export function hasExifData(buffer: ArrayBuffer): boolean {
  try {
    const view = new DataView(buffer);
    
    // Check for JPEG magic number
    if (view.getUint16(0) !== 0xFFD8) {
      return false;
    }

    // Basic check for EXIF marker (0xFFE1)
    // This is a simplified check - full implementation would scan all segments
    for (let i = 2; i < Math.min(buffer.byteLength - 4, 1024); i += 2) {
      if (view.getUint16(i) === 0xFFE1) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}