/**
 * EXIF metadata handling utilities for photo processing
 *
 * This module provides utilities for extracting, preserving, and modifying
 * EXIF metadata in photos, including GPS coordinate preservation and
 * permalink injection for the Cultural Archiver system.
 */

import exifr from 'exifr';
import * as piexif from 'piexifjs';
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
 * Extract EXIF data from image buffer using exifr library
 */
export async function extractExifData(buffer: ArrayBuffer): Promise<ExifData> {
  try {
    // Validate buffer
    if (!buffer || buffer.byteLength === 0) {
      console.warn('Empty buffer provided for EXIF extraction');
      return {};
    }

    // Check for JPEG magic number (0xFFD8)
    const view = new DataView(buffer);
    if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) {
      console.info('Non-JPEG file provided for EXIF extraction');
      return {}; // Not a JPEG file, return empty EXIF data
    }

    // Try using exifr library for full EXIF extraction
    try {
      // Simple options for exifr compatibility
      const rawExif = await exifr.parse(buffer, [
        'GPSLatitude',
        'GPSLongitude',
        'Make',
        'Model',
        'DateTime',
      ]);

      if (!rawExif) {
        console.info('No EXIF data found in image');
        return {
          comment: 'Cultural Archiver photo submission',
        };
      }

      // Transform raw EXIF to our structured format
      const exifData: ExifData = {};

      // Process GPS data
      if (rawExif.GPSLatitude && rawExif.GPSLongitude) {
        exifData.gps = {
          latitude: rawExif.GPSLatitude,
          longitude: rawExif.GPSLongitude,
          altitude: rawExif.GPSAltitude,
          timestamp: rawExif.GPSTimeStamp || rawExif.GPSDateStamp,
        };
      }

      // Process camera data
      if (rawExif.Make || rawExif.Model) {
        const cameraData: ExifCameraData = {
          make: rawExif.Make,
          model: rawExif.Model,
          software: rawExif.Software,
          dateTime: rawExif.DateTime || rawExif.DateTimeOriginal,
          orientation: rawExif.Orientation,
          iso: rawExif.ISO,
        };

        // Only add optional fields if they have valid values
        if (rawExif.FocalLength) {
          cameraData.focalLength = `${rawExif.FocalLength}mm`;
        }
        if (rawExif.FNumber) {
          cameraData.aperture = `f/${rawExif.FNumber}`;
        }
        if (rawExif.ExposureTime) {
          cameraData.shutterSpeed = `1/${Math.round(1 / rawExif.ExposureTime)}s`;
        }

        exifData.camera = cameraData;
      }

      // Process comments
      exifData.comment = rawExif.ImageDescription || 'Cultural Archiver photo submission';
      exifData.userComment = rawExif.UserComment;

      console.info('EXIF data extracted successfully', {
        hasGPS: !!exifData.gps,
        hasCamera: !!exifData.camera,
        gpsCoords: exifData.gps ? `${exifData.gps.latitude}, ${exifData.gps.longitude}` : null,
        cameraMake: exifData.camera?.make,
        cameraModel: exifData.camera?.model,
      });

      return exifData;
    } catch (exifrError) {
      console.warn('exifr library error, falling back to basic extraction:', exifrError);

      // Fallback to basic implementation for backwards compatibility
      return {
        comment: 'Cultural Archiver photo submission',
      };
    }
  } catch (error) {
    console.warn('Failed to extract EXIF data:', error);
    // Return basic data instead of throwing to maintain backwards compatibility
    return {
      comment: 'Cultural Archiver photo submission',
    };
  }
}

/**
 * Inject permalink information into EXIF comment field
 */
export async function injectPermalink(
  buffer: ArrayBuffer,
  artworkId: string,
  options: ExifProcessingOptions = {}
): Promise<ArrayBuffer> {
  try {
    // Validate input buffer
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('Invalid buffer for EXIF processing');
    }

    // Check if it's a JPEG file
    const view = new DataView(buffer);
    if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) {
      console.info('Non-JPEG file, skipping EXIF permalink injection');
      return buffer;
    }

    const permalink = `/p/artwork/${artworkId}`;
    const timestamp = new Date().toISOString();
    const comment = `Cultural Archiver: ${permalink} - Archived ${timestamp}`;

    try {
      // Convert ArrayBuffer to base64 for piexifjs
      const uint8Array = new Uint8Array(buffer);
      const binary = Array.from(uint8Array)
        .map(byte => String.fromCharCode(byte))
        .join('');
      const base64 = btoa(binary);
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      // Load existing EXIF data or create new structure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let exifData: Record<string, any>;
      try {
        exifData = piexif.load(dataUrl);
      } catch {
        // No existing EXIF data, create new structure
        exifData = { '0th': {}, Exif: {}, GPS: {}, '1st': {}, thumbnail: undefined };
      }

      // Set Image Description (comment) in IFD0
      if (!exifData['0th']) exifData['0th'] = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (exifData['0th'] as Record<string, any>)[piexif.ImageIFD.ImageDescription] = comment;

      // Also set UserComment in EXIF IFD for broader compatibility
      if (!exifData['Exif']) exifData['Exif'] = {};
      const userCommentBytes = new TextEncoder().encode(`UNICODE\0${comment}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (exifData['Exif'] as Record<string, any>)[piexif.ExifIFD.UserComment] =
        Array.from(userCommentBytes);

      // Preserve existing GPS data if requested
      if (options.preserveGPS && exifData.GPS) {
        console.info('Preserving existing GPS data in permalink injection');
      }

      // Generate new EXIF binary
      const newExifBinary = piexif.dump(exifData);

      // Insert EXIF into image
      const newDataUrl = piexif.insert(newExifBinary, dataUrl);

      // Convert back to ArrayBuffer
      const base64Data = newDataUrl.replace(/^data:image\/jpeg;base64,/, '');
      const binaryString = atob(base64Data);
      const newBuffer = new ArrayBuffer(binaryString.length);
      const newView = new Uint8Array(newBuffer);

      for (let i = 0; i < binaryString.length; i++) {
        newView[i] = binaryString.charCodeAt(i);
      }

      console.info('Permalink injected into EXIF successfully:', {
        artworkId,
        permalink,
        originalSize: buffer.byteLength,
        newSize: newBuffer.byteLength,
      });

      return newBuffer;
    } catch (exifError) {
      console.warn(
        'Failed to modify EXIF data with piexifjs, returning original buffer:',
        exifError
      );

      // Fallback: return original buffer with logged intention
      console.info('Permalink prepared for injection (fallback mode):', {
        artworkId,
        permalink,
        comment,
      });
      return buffer;
    }
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

    return {
      buffer: processedBuffer,
      exifData,
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
    errors,
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
    stripPrivateData: false,
  };
}

/**
 * Check if buffer contains EXIF data
 */
export function hasExifData(buffer: ArrayBuffer): boolean {
  try {
    const view = new DataView(buffer);

    // Check for JPEG magic number
    if (view.getUint16(0) !== 0xffd8) {
      return false;
    }

    // Basic check for EXIF marker (0xFFE1)
    // This is a simplified check - full implementation would scan all segments
    for (let i = 2; i < Math.min(buffer.byteLength - 4, 1024); i += 2) {
      if (view.getUint16(i) === 0xffe1) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
