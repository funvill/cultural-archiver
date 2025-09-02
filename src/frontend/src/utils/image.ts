/**
 * Image processing and EXIF utilities for photo handling
 */

import exifr from 'exifr'
import type { Coordinates } from '../types'

export interface ExifData {
  latitude?: number
  longitude?: number
  dateTime?: Date
  make?: string
  model?: string
  orientation?: number
  width?: number
  height?: number
}

export interface ImageProcessingOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

/**
 * Extract EXIF data from image file
 */
export async function extractExifData(file: File): Promise<ExifData> {
  try {
    const exifData = await exifr.parse(file)

    const result: ExifData = {}

    // Extract GPS coordinates
    if (exifData.latitude && exifData.longitude) {
      result.latitude = exifData.latitude
      result.longitude = exifData.longitude
    }

    // Extract date/time
    if (exifData.DateTimeOriginal) {
      result.dateTime = new Date(exifData.DateTimeOriginal)
    } else if (exifData.DateTime) {
      result.dateTime = new Date(exifData.DateTime)
    }

    // Extract camera info
    if (exifData.Make) {
      result.make = exifData.Make
    }
    if (exifData.Model) {
      result.model = exifData.Model
    }

    // Extract orientation
    if (exifData.Orientation) {
      result.orientation = exifData.Orientation
    }

    // Extract dimensions
    if (exifData.ExifImageWidth) {
      result.width = exifData.ExifImageWidth
    }
    if (exifData.ExifImageHeight) {
      result.height = exifData.ExifImageHeight
    }

    return result
  } catch (error) {
    console.warn('Failed to extract EXIF data:', error)
    return {}
  }
}

/**
 * Extract coordinates from EXIF data
 */
export async function extractImageCoordinates(file: File): Promise<Coordinates | null> {
  try {
    const exifData = await extractExifData(file)
    
    if (exifData.latitude && exifData.longitude) {
      return {
        latitude: exifData.latitude,
        longitude: exifData.longitude
      }
    }
    
    return null
  } catch (error) {
    console.warn('Failed to extract image coordinates:', error)
    return null
  }
}

/**
 * Resize image to fit within maximum dimensions
 */
export async function resizeImage(
  file: File,
  options: ImageProcessingOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.85,
    format = 'jpeg'
  } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }

    img.onload = (): void => {
      // Calculate new dimensions
      let { width, height } = img
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      // Set canvas dimensions
      canvas.width = width
      canvas.height = height

      // Draw resized image
      ctx.drawImage(img, 0, 0, width, height)

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: `image/${format}`,
              lastModified: file.lastModified
            })
            resolve(resizedFile)
          } else {
            reject(new Error('Failed to create blob from canvas'))
          }
        },
        `image/${format}`,
        quality
      )
    }

    img.onerror = (): void => {
      reject(new Error('Failed to load image'))
    }

    // Load image from file
    const reader = new FileReader()
    reader.onload = (e): void => {
      if (e.target?.result) {
        img.src = e.target.result as string
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = (): void => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Create thumbnail from image
 */
export async function createThumbnail(
  file: File,
  size: number = 200
): Promise<File> {
  return resizeImage(file, {
    maxWidth: size,
    maxHeight: size,
    quality: 0.8,
    format: 'jpeg'
  })
}

/**
 * Check if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Get image dimensions without loading the full image
 */
export async function getImageDimensions(file: File): Promise<{ width: number, height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = (): void => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    
    img.onerror = (): void => {
      reject(new Error('Failed to load image'))
    }
    
    const reader = new FileReader()
    reader.onload = (e): void => {
      if (e.target?.result) {
        img.src = e.target.result as string
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = (): void => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsDataURL(file)
  })
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
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }

    img.onload = (): void => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      
      // Set white background for JPEG
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      
      ctx.drawImage(img, 0, 0)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const convertedFile = new File([blob], changeFileExtension(file.name, format), {
              type: `image/${format}`,
              lastModified: file.lastModified
            })
            resolve(convertedFile)
          } else {
            reject(new Error('Failed to convert image'))
          }
        },
        `image/${format}`,
        quality
      )
    }

    img.onerror = (): void => {
      reject(new Error('Failed to load image'))
    }

    const reader = new FileReader()
    reader.onload = (e): void => {
      if (e.target?.result) {
        img.src = e.target.result as string
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = (): void => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Change file extension
 */
function changeFileExtension(filename: string, newExtension: string): string {
  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex === -1) {
    return `${filename}.${newExtension}`
  }
  return `${filename.substring(0, lastDotIndex)}.${newExtension}`
}

/**
 * Optimize image for upload
 */
export async function optimizeImageForUpload(
  file: File,
  options: {
    maxSize?: number // in bytes
    maxWidth?: number
    maxHeight?: number
  } = {}
): Promise<File> {
  const {
    maxSize = 2 * 1024 * 1024, // 2MB
    maxWidth = 1920,
    maxHeight = 1080
  } = options

  let optimizedFile = file

  // If file is already small enough, return as-is
  if (file.size <= maxSize) {
    return file
  }

  // Try resizing first
  optimizedFile = await resizeImage(file, {
    maxWidth,
    maxHeight,
    quality: 0.8,
    format: 'jpeg'
  })

  // If still too large, reduce quality
  if (optimizedFile.size > maxSize) {
    let quality = 0.6
    
    while (quality > 0.1 && optimizedFile.size > maxSize) {
      optimizedFile = await resizeImage(file, {
        maxWidth,
        maxHeight,
        quality,
        format: 'jpeg'
      })
      quality -= 0.1
    }
  }

  return optimizedFile
}

/**
 * Generate image preview URL
 */
export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e): void => {
      if (e.target?.result) {
        resolve(e.target.result as string)
      } else {
        reject(new Error('Failed to create preview'))
      }
    }
    
    reader.onerror = (): void => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsDataURL(file)
  })
}

/**
 * Batch process multiple images
 */
export async function processImageBatch(
  files: File[],
  processor: (file: File) => Promise<File>,
  onProgress?: (progress: number) => void
): Promise<File[]> {
  const results: File[] = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file) continue
    
    try {
      const processed = await processor(file)
      results.push(processed)
      
      if (onProgress) {
        onProgress((i + 1) / files.length * 100)
      }
    } catch (error) {
      console.error(`Failed to process image ${i + 1}:`, error)
      // Keep original file if processing fails
      results.push(file)
    }
  }
  
  return results
}
