/**
 * Unit tests for EXIF metadata handling utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractExifData,
  injectPermalink,
  processExifData,
  validateExifData,
  getDefaultExifOptions,
  hasExifData,
  type ExifData,
  type ExifProcessingOptions
} from '../lib/exif';

// Helper function to create a basic JPEG buffer for testing
function createJpegBuffer(includeExif = false): ArrayBuffer {
  const size = includeExif ? 1024 : 256;
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  
  // JPEG magic number
  view.setUint16(0, 0xFFD8);
  
  if (includeExif) {
    // Add EXIF marker for testing
    view.setUint16(64, 0xFFE1);
  }
  
  return buffer;
}

// Helper function to create a PNG buffer (no EXIF support)
function createPngBuffer(): ArrayBuffer {
  const buffer = new ArrayBuffer(256);
  const view = new DataView(buffer);
  
  // PNG magic number
  view.setUint32(0, 0x89504E47);
  view.setUint32(4, 0x0D0A1A0A);
  
  return buffer;
}

describe('EXIF Data Extraction', () => {
  it('should extract empty EXIF data from JPEG without EXIF', async () => {
    const buffer = createJpegBuffer(false);
    const exifData = await extractExifData(buffer);
    
    expect(exifData).toBeDefined();
    expect(exifData.comment).toBe('Cultural Archiver photo submission');
    expect(exifData.gps).toBeUndefined();
    expect(exifData.camera).toBeUndefined();
  });

  it('should return empty EXIF data for non-JPEG files', async () => {
    const buffer = createPngBuffer();
    const exifData = await extractExifData(buffer);
    
    expect(exifData).toEqual({});
  });

  it('should handle extraction errors gracefully', async () => {
    const invalidBuffer = new ArrayBuffer(0);
    const exifData = await extractExifData(invalidBuffer);
    
    expect(exifData).toEqual({});
  });
});

describe('Permalink Injection', () => {
  it('should inject permalink into JPEG buffer', async () => {
    const buffer = createJpegBuffer();
    const artworkId = 'test-artwork-123';
    
    const result = await injectPermalink(buffer, artworkId);
    
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(buffer.byteLength);
  });

  it('should handle permalink injection errors', async () => {
    const invalidBuffer = new ArrayBuffer(0);
    const artworkId = 'test-artwork-123';
    
    await expect(injectPermalink(invalidBuffer, artworkId)).rejects.toThrow('EXIF permalink injection failed');
  });
});

describe('EXIF Processing', () => {
  let defaultOptions: ExifProcessingOptions;

  beforeEach(() => {
    defaultOptions = getDefaultExifOptions();
  });

  it('should process EXIF data with default options', async () => {
    const buffer = createJpegBuffer();
    
    const result = await processExifData(buffer, defaultOptions);
    
    expect(result.buffer).toBeDefined();
    expect(result.exifData).toBeDefined();
    expect(result.buffer.byteLength).toBe(buffer.byteLength);
  });

  it('should process EXIF data with permalink injection', async () => {
    const buffer = createJpegBuffer();
    const options: ExifProcessingOptions = {
      ...defaultOptions,
      injectPermalink: true,
      permalink: 'test-artwork-456'
    };
    
    const result = await processExifData(buffer, options);
    
    expect(result.buffer).toBeDefined();
    expect(result.exifData).toBeDefined();
  });

  it('should handle processing errors gracefully', async () => {
    const invalidBuffer = new ArrayBuffer(0);
    const options: ExifProcessingOptions = {
      injectPermalink: true,
      permalink: 'test-artwork-789'
    };
    
    await expect(processExifData(invalidBuffer, options)).rejects.toThrow('EXIF processing failed');
  });
});

describe('EXIF Data Validation', () => {
  it('should validate valid GPS data', () => {
    const exifData: ExifData = {
      gps: {
        latitude: 49.2827,
        longitude: -123.1207,
        altitude: 50
      }
    };
    
    const validation = validateExifData(exifData);
    
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should reject invalid GPS coordinates', () => {
    const exifData: ExifData = {
      gps: {
        latitude: 100, // Invalid: > 90
        longitude: -200 // Invalid: < -180
      }
    };
    
    const validation = validateExifData(exifData);
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Invalid GPS latitude value');
    expect(validation.errors).toContain('Invalid GPS longitude value');
  });

  it('should validate camera data', () => {
    const exifData: ExifData = {
      camera: {
        make: 'Canon',
        model: 'EOS R5',
        iso: 100
      }
    };
    
    const validation = validateExifData(exifData);
    
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should reject invalid ISO values', () => {
    const exifData: ExifData = {
      camera: {
        iso: 500000 // Invalid: too high
      }
    };
    
    const validation = validateExifData(exifData);
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Invalid ISO value');
  });

  it('should validate empty EXIF data', () => {
    const exifData: ExifData = {};
    
    const validation = validateExifData(exifData);
    
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

describe('EXIF Detection', () => {
  it('should detect EXIF data in JPEG with EXIF marker', () => {
    const buffer = createJpegBuffer(true);
    
    const hasExif = hasExifData(buffer);
    
    expect(hasExif).toBe(true);
  });

  it('should not detect EXIF data in JPEG without EXIF marker', () => {
    const buffer = createJpegBuffer(false);
    
    const hasExif = hasExifData(buffer);
    
    expect(hasExif).toBe(false);
  });

  it('should not detect EXIF data in non-JPEG files', () => {
    const buffer = createPngBuffer();
    
    const hasExif = hasExifData(buffer);
    
    expect(hasExif).toBe(false);
  });

  it('should handle empty buffers gracefully', () => {
    const buffer = new ArrayBuffer(0);
    
    const hasExif = hasExifData(buffer);
    
    expect(hasExif).toBe(false);
  });
});

describe('Default Options', () => {
  it('should provide appropriate default EXIF options', () => {
    const options = getDefaultExifOptions();
    
    expect(options.preserveGPS).toBe(true);
    expect(options.preserveCamera).toBe(true);
    expect(options.injectPermalink).toBe(true);
    expect(options.stripPrivateData).toBe(false);
  });
});