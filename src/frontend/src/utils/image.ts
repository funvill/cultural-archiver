/**
 * Clean, SSR-safe implementation
 */
import exifr from 'exifr';
import type { Coordinates } from '../types';
import type { PhotoVariant } from '../../../shared/types';
import { getApiBaseUrl } from './api-config';
import { isClient } from '../lib/isClient';

export interface ExifData { latitude?: number; longitude?: number; dateTime?: Date; make?: string; model?: string; orientation?: number; width?: number; height?: number; }

export interface ImageProcessingOptions { maxWidth?: number; maxHeight?: number; quality?: number; format?: 'jpeg' | 'png' | 'webp'; }

export async function extractExifData(file: File): Promise<ExifData> {
  try {
    const exifData = await exifr.parse(file as unknown as Blob);
    const result: ExifData = {};
    if (exifData && typeof exifData === 'object') {
      if ((exifData as any).latitude && (exifData as any).longitude) { result.latitude = (exifData as any).latitude; result.longitude = (exifData as any).longitude; }
      if ((exifData as any).DateTimeOriginal) result.dateTime = new Date((exifData as any).DateTimeOriginal);
      else if ((exifData as any).DateTime) result.dateTime = new Date((exifData as any).DateTime);
      if ((exifData as any).Make) result.make = (exifData as any).Make;
      if ((exifData as any).Model) result.model = (exifData as any).Model;
      if ((exifData as any).Orientation) result.orientation = (exifData as any).Orientation;
      if ((exifData as any).ExifImageWidth) result.width = (exifData as any).ExifImageWidth;
      if ((exifData as any).ExifImageHeight) result.height = (exifData as any).ExifImageHeight;
    }
    return result;
  } catch (err: unknown) { console.warn('Failed to extract EXIF data:', err); return {}; }
}

export async function extractImageCoordinates(file: File): Promise<Coordinates | null> { try { const exifData = await extractExifData(file); if (exifData.latitude && exifData.longitude) return { latitude: exifData.latitude, longitude: exifData.longitude }; return null; } catch (err: unknown) { console.warn('Failed to extract image coordinates:', err); return null; } }

export async function resizeImage(file: File, options: ImageProcessingOptions = {}): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.85, format = 'jpeg' } = options;
  return new Promise((resolve, reject) => {
    if (!isClient) { reject(new Error('resizeImage can only be used in a browser environment')); return; }
    const img = new Image();
    const canvas = (typeof document !== 'undefined' ? document.createElement('canvas') : null) as HTMLCanvasElement | null;
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (!canvas || !ctx) { reject(new Error('Canvas is not available in this environment')); return; }
    img.onload = (): void => {
      let width = (img as any).naturalWidth || (img as any).width;
      let height = (img as any).naturalHeight || (img as any).height;
      if (width > maxWidth || height > maxHeight) { const ratio = Math.min(maxWidth / width, maxHeight / height); width = Math.round(width * ratio); height = Math.round(height * ratio); }
      canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => { if (blob) { const resizedFile = new File([blob], file.name, { type: `image/${format}`, lastModified: file.lastModified }); resolve(resizedFile); } else { reject(new Error('Failed to create blob from canvas')); } }, `image/${format}`, quality);
    };
    img.onerror = (): void => reject(new Error('Failed to load image'));
    const reader = typeof FileReader !== 'undefined' ? new FileReader() : null;
    if (!reader) { reject(new Error('FileReader is not available in this environment')); return; }
    reader.onload = (e): void => { if (e.target?.result) img.src = e.target.result as string; else reject(new Error('Failed to read file')); };
    reader.onerror = (): void => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function createThumbnail(file: File, size: number = 200): Promise<File> { return resizeImage(file, { maxWidth: size, maxHeight: size, quality: 0.8, format: 'jpeg' }); }

export function isImageFile(file: File): boolean { return file.type.startsWith('image/'); }

export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> { return new Promise((resolve, reject) => { if (!isClient) { reject(new Error('getImageDimensions can only be used in a browser environment')); return; } const img = new Image(); img.onload = (): void => resolve({ width: (img as any).naturalWidth, height: (img as any).naturalHeight }); img.onerror = (): void => reject(new Error('Failed to load image')); const reader = typeof FileReader !== 'undefined' ? new FileReader() : null; if (!reader) { reject(new Error('FileReader is not available in this environment')); return; } reader.onload = (e): void => { if (e.target?.result) img.src = e.target.result as string; else reject(new Error('Failed to read file')); }; reader.onerror = (): void => reject(new Error('Failed to read file')); reader.readAsDataURL(file); }); }

export async function convertImageFormat(file: File, format: 'jpeg' | 'png' | 'webp', quality: number = 0.9): Promise<File> { return new Promise((resolve, reject) => { if (!isClient) { reject(new Error('convertImageFormat can only be used in a browser environment')); return; } const img = new Image(); const canvas = (typeof document !== 'undefined' ? document.createElement('canvas') : null) as HTMLCanvasElement | null; const ctx = canvas ? canvas.getContext('2d') : null; if (!canvas || !ctx) { reject(new Error('Canvas context not available')); return; } img.onload = (): void => { canvas.width = (img as any).naturalWidth; canvas.height = (img as any).naturalHeight; if (format === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); } ctx.drawImage(img, 0, 0); canvas.toBlob(blob => { if (blob) { const convertedFile = new File([blob], changeFileExtension(file.name, format), { type: `image/${format}`, lastModified: file.lastModified, }); resolve(convertedFile); } else { reject(new Error('Failed to convert image')); } }, `image/${format}`, quality); }; img.onerror = (): void => reject(new Error('Failed to load image')); const reader = typeof FileReader !== 'undefined' ? new FileReader() : null; if (!reader) { reject(new Error('FileReader is not available in this environment')); return; } reader.onload = (e): void => { if (e.target?.result) img.src = e.target.result as string; else reject(new Error('Failed to read file')); }; reader.onerror = (): void => reject(new Error('Failed to read file')); reader.readAsDataURL(file); }); }

function changeFileExtension(filename: string, newExtension: string): string { const lastDotIndex = filename.lastIndexOf('.'); if (lastDotIndex === -1) return `${filename}.${newExtension}`; return `${filename.substring(0, lastDotIndex)}.${newExtension}`; }

export async function optimizeImageForUpload(file: File, options: { maxSize?: number; maxWidth?: number; maxHeight?: number; } = {}): Promise<File> { const { maxSize = 2 * 1024 * 1024, maxWidth = 1920, maxHeight = 1080 } = options; let optimizedFile = file; if (file.size <= maxSize) return file; optimizedFile = await resizeImage(file, { maxWidth, maxHeight, quality: 0.8, format: 'jpeg' }); if (optimizedFile.size > maxSize) { let quality = 0.6; while (quality > 0.1 && optimizedFile.size > maxSize) { optimizedFile = await resizeImage(file, { maxWidth, maxHeight, quality, format: 'jpeg' }); quality -= 0.1; } } return optimizedFile; }

export function createImagePreview(file: File): Promise<string> { return new Promise((resolve, reject) => { if (!isClient) { reject(new Error('createImagePreview can only be used in a browser environment')); return; } const reader = typeof FileReader !== 'undefined' ? new FileReader() : null; if (!reader) { reject(new Error('FileReader is not available in this environment')); return; } reader.onload = (e): void => { if (e.target?.result) resolve(e.target.result as string); else reject(new Error('Failed to create preview')); }; reader.onerror = (): void => reject(new Error('Failed to read file')); reader.readAsDataURL(file); }); }

export async function processImageBatch(files: File[], processor: (file: File) => Promise<File>, onProgress?: (progress: number) => void): Promise<File[]> { const results: File[] = []; for (let i = 0; i < files.length; i++) { const file = files[i]; if (!file) continue; try { const processed = await processor(file); results.push(processed); if (onProgress) { try { onProgress(((i + 1) / files.length) * 100); } catch { } } } catch (error) { console.error(`Failed to process image ${i + 1}:`, error); results.push(file); } } return results; }

export function getImageSizedURL(originalUrl: string, size: PhotoVariant = 'original'): string { if (size === 'original') return originalUrl; let cleanUrl = originalUrl; if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://') || originalUrl.startsWith('//')) { const allowedPrefixes = ['originals/', 'photos/', 'artworks/', 'submissions/']; for (const prefix of allowedPrefixes) { const idx = originalUrl.indexOf(prefix); if (idx >= 0) { cleanUrl = originalUrl.substring(idx); break; } } } else { cleanUrl = originalUrl.replace(/^\//, ''); } const apiBaseUrl = getApiBaseUrl(); return `${apiBaseUrl}/images/${size}/${cleanUrl}`; }

export function getImageVariantURLs(originalUrl: string): Record<PhotoVariant, string> { return { thumbnail: getImageSizedURL(originalUrl, 'thumbnail'), medium: getImageSizedURL(originalUrl, 'medium'), large: getImageSizedURL(originalUrl, 'large'), original: getImageSizedURL(originalUrl, 'original'), }; }

export function preloadImageVariants(originalUrl: string, sizes: PhotoVariant[] = ['thumbnail', 'medium', 'large']): Promise<void> { if (!isClient || typeof document === 'undefined') return Promise.resolve(); sizes.forEach(size => { try { const link = document.createElement('link'); link.rel = 'prefetch'; (link as any).as = 'image'; link.href = getImageSizedURL(originalUrl, size); document.head.appendChild(link); } catch { } }); return Promise.resolve(); }
