# Photo Processing Documentation

The Cultural Archiver API implements a comprehensive photo processing pipeline
using Cloudflare R2 storage. This document covers the complete workflow from
upload validation to final storage and retrieval.

## Overview

The photo processing system handles:

- File validation and security checks
- Image processing and optimization
- Secure storage with organized folder structure
- EXIF data preservation and enhancement
- Photo migration between submission and approval states

## Storage Architecture

### R2 Bucket Structure

```
cultural-archiver-photos/
├── submissions/           # Pending logbook submissions
│   └── YYYY/MM/DD/       # Date-based organization
│       └── timestamp-uuid.ext
├── artworks/             # Approved artwork photos
│   └── YYYY/MM/DD/       # Date-based organization
│       └── timestamp-uuid.ext
└── thumbnails/           # Generated thumbnails (future)
    └── YYYY/MM/DD/
        └── timestamp-uuid-thumb.ext
```

### File Naming Convention

```typescript
// Generated filename format
const filename = `${timestamp}-${uuid}.${extension}`;

// Example: 20240115-143052-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
// Components:
// - timestamp: 20240115-143052 (YYYYMMDD-HHMMSS)
// - uuid: a1b2c3d4-e5f6-7890-abcd-ef1234567890
// - extension: jpg (original file extension)
```

### Folder Organization

Photos are organized by upload date for efficient management:

```typescript
const getDatePath = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

// Example paths:
// submissions/2024/01/15/20240115-143052-uuid.jpg
// artworks/2024/01/15/20240115-143052-uuid.jpg
```

## File Validation

### Supported Formats

```typescript
const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
```

### Size and Quality Limits

```typescript
const PHOTO_CONSTRAINTS = {
  maxFileSize: 15 * 1024 * 1024, // 15MB per file
  maxPhotosPerSubmission: 3, // Maximum photos per submission
  minDimensions: { width: 200, height: 200 }, // Minimum resolution
  maxDimensions: { width: 4096, height: 4096 }, // Maximum resolution
};
```

### Security Validation

```typescript
interface PhotoValidationResult {
  isValid: boolean;
  mimeType: string;
  extension: string;
  size: number;
  dimensions: { width: number; height: number };
  errors: string[];
}

const validatePhoto = async (file: File): Promise<PhotoValidationResult> => {
  const errors: string[] = [];

  // File size check
  if (file.size > PHOTO_CONSTRAINTS.maxFileSize) {
    errors.push(
      `File size ${formatBytes(file.size)} exceeds maximum ${formatBytes(PHOTO_CONSTRAINTS.maxFileSize)}`
    );
  }

  // MIME type validation
  const mimeType = file.type;
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    errors.push(`Unsupported file type: ${mimeType}`);
  }

  // Magic number validation (security check)
  const buffer = await file.arrayBuffer();
  const actualMimeType = detectMimeType(buffer);
  if (actualMimeType !== mimeType) {
    errors.push(`File content doesn't match declared type`);
  }

  return {
    isValid: errors.length === 0,
    mimeType: actualMimeType,
    extension: getExtensionFromMimeType(actualMimeType),
    size: file.size,
    dimensions: await getImageDimensions(buffer),
    errors,
  };
};
```

## Image Processing Pipeline

### Upload Workflow

```typescript
interface PhotoUploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

const processPhotoUpload = async (
  file: File,
  env: Env,
  folder: 'submissions' | 'artworks'
): Promise<PhotoUploadResult> => {
  // 1. Validate file
  const validation = await validatePhoto(file);
  if (!validation.isValid) {
    throw new Error(`Photo validation failed: ${validation.errors.join(', ')}`);
  }

  // 2. Generate secure filename
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const uuid = crypto.randomUUID();
  const filename = `${timestamp}-${uuid}.${validation.extension}`;

  // 3. Create storage path
  const datePath = getDatePath();
  const key = `${folder}/${datePath}/${filename}`;

  // 4. Process image (resize, optimize)
  const processedBuffer = await processImage(await file.arrayBuffer(), {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 85,
  });

  // 5. Upload to R2
  await env.PHOTOS.put(key, processedBuffer, {
    httpMetadata: {
      contentType: validation.mimeType,
      cacheControl: 'public, max-age=31536000', // 1 year
    },
    customMetadata: {
      originalFilename: file.name,
      uploadedAt: new Date().toISOString(),
      userAgent: 'cultural-archiver-api',
    },
  });

  // 6. Return result
  return {
    url: `https://photos.cultural-archiver.com/${key}`,
    filename,
    size: processedBuffer.byteLength,
    mimeType: validation.mimeType,
    uploadedAt: new Date().toISOString(),
  };
};
```

### Image Optimization

```typescript
interface ImageProcessingOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format?: 'jpeg' | 'png' | 'webp';
  preserveExif?: boolean;
}

const processImage = async (
  buffer: ArrayBuffer,
  options: ImageProcessingOptions
): Promise<ArrayBuffer> => {
  // Note: In a full implementation, this would use a service like:
  // - Cloudflare Images for automatic optimization
  // - Sharp.js for server-side processing
  // - ImageMagick integration

  // For MVP, we return the original buffer with basic validation
  // Future enhancement: implement actual image processing

  return buffer;
};
```

## EXIF Data Handling

### EXIF Preservation

```typescript
interface ExifData {
  camera?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  capturedAt?: string;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
}

const extractExifData = async (buffer: ArrayBuffer): Promise<ExifData> => {
  // Implementation would use a library like exif-js or piexifjs
  // Extract relevant metadata while respecting privacy

  return {
    // Safe metadata only (no GPS unless explicitly consented)
    camera: 'Camera metadata if available',
    capturedAt: 'Timestamp if available',
  };
};
```

### Permalink Injection

```typescript
const injectPermalink = async (
  buffer: ArrayBuffer,
  permalink: string,
  metadata: ExifData
): Promise<ArrayBuffer> => {
  // Inject permalink into EXIF comment field
  // This ensures attribution survives photo sharing

  const comment = `Cultural Archiver: ${permalink} - Submitted ${metadata.capturedAt || 'date unknown'}`;

  // Implementation would modify EXIF comment field
  // For now, return original buffer
  return buffer;
};
```

## Photo Migration

### Submission to Artwork Migration

When a logbook submission is approved, photos must be migrated:

```typescript
const migratePhotosOnApproval = async (
  env: Env,
  logbookPhotos: string[],
  artworkId: string
): Promise<string[]> => {
  const migratedUrls: string[] = [];

  for (const submissionUrl of logbookPhotos) {
    // 1. Extract key from submission URL
    const submissionKey = extractKeyFromUrl(submissionUrl);

    // 2. Generate new artwork key
    const filename = submissionKey.split('/').pop()!;
    const datePath = getDatePath();
    const artworkKey = `artworks/${datePath}/${filename}`;

    // 3. Copy object in R2
    const object = await env.PHOTOS.get(submissionKey);
    if (!object) continue;

    await env.PHOTOS.put(artworkKey, object.body, {
      httpMetadata: object.httpMetadata,
      customMetadata: {
        ...object.customMetadata,
        migratedFrom: submissionKey,
        artworkId,
        approvedAt: new Date().toISOString(),
      },
    });

    // 4. Generate new URL
    const artworkUrl = `https://photos.cultural-archiver.com/${artworkKey}`;
    migratedUrls.push(artworkUrl);
  }

  return migratedUrls;
};
```

### Cleanup on Rejection

When submissions are rejected, clean up photos:

```typescript
const cleanupRejectedPhotos = async (
  env: Env,
  photoUrls: string[]
): Promise<void> => {
  for (const url of photoUrls) {
    try {
      const key = extractKeyFromUrl(url);
      await env.PHOTOS.delete(key);
    } catch (error) {
      console.error(`Failed to cleanup photo ${url}:`, error);
      // Log for manual cleanup but don't fail the rejection
    }
  }
};
```

## Photo Retrieval and URLs

### URL Generation

```typescript
interface PhotoUrlOptions {
  transform?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'auto' | 'jpeg' | 'png' | 'webp';
  };
  expiry?: number; // Seconds until expiry (for private photos)
}

const generatePhotoUrl = (
  key: string,
  options: PhotoUrlOptions = {}
): string => {
  const baseUrl = 'https://photos.cultural-archiver.com';

  if (options.transform) {
    // Future: Cloudflare Images integration for on-demand transforms
    const params = new URLSearchParams();
    if (options.transform.width)
      params.set('w', options.transform.width.toString());
    if (options.transform.height)
      params.set('h', options.transform.height.toString());
    if (options.transform.quality)
      params.set('q', options.transform.quality.toString());

    return `${baseUrl}/${key}?${params.toString()}`;
  }

  return `${baseUrl}/${key}`;
};
```

### Responsive Image Support

```typescript
interface ResponsiveImageSet {
  original: string;
  large: string; // 1200px
  medium: string; // 800px
  small: string; // 400px
  thumbnail: string; // 200px
}

const generateResponsiveImageSet = (key: string): ResponsiveImageSet => {
  return {
    original: generatePhotoUrl(key),
    large: generatePhotoUrl(key, { transform: { width: 1200, quality: 85 } }),
    medium: generatePhotoUrl(key, { transform: { width: 800, quality: 85 } }),
    small: generatePhotoUrl(key, { transform: { width: 400, quality: 80 } }),
    thumbnail: generatePhotoUrl(key, {
      transform: { width: 200, height: 200, quality: 75 },
    }),
  };
};
```

## Security and Privacy

### Access Control

```typescript
const validatePhotoAccess = async (
  key: string,
  userToken: string,
  env: Env
): Promise<boolean> => {
  // 1. Check if photo is in public artworks folder
  if (key.startsWith('artworks/')) {
    return true; // Public access to approved artwork photos
  }

  // 2. Check if user owns the submission
  if (key.startsWith('submissions/')) {
    const logbookEntry = await getLogbookEntryByPhotoKey(key, env);
    return logbookEntry?.user_token === userToken;
  }

  return false; // Deny access by default
};
```

### Content Moderation

```typescript
interface ModerationFlags {
  inappropriate: boolean;
  copyrighted: boolean;
  lowQuality: boolean;
  offTopic: boolean;
}

const flagPhotoForModeration = async (
  photoKey: string,
  flags: ModerationFlags,
  reviewerToken: string,
  env: Env
): Promise<void> => {
  // Store moderation flags in KV for reviewer interface
  const moderationData = {
    photoKey,
    flags,
    flaggedBy: reviewerToken,
    flaggedAt: new Date().toISOString(),
  };

  await env.MODERATION.put(`photo:${photoKey}`, JSON.stringify(moderationData));
};
```

## Performance Optimization

### CDN Configuration

```typescript
// R2 custom domain with Cloudflare CDN
const CDN_CONFIG = {
  domain: 'photos.cultural-archiver.com',
  cacheSettings: {
    browserCacheTtl: 31536000, // 1 year
    edgeCacheTtl: 2592000, // 30 days
    cacheEverything: true,
  },
  optimizations: {
    minify: false, // Don't minify images
    automaticHttpsRewrites: true,
    brotliCompression: true,
  },
};
```

### Lazy Loading Support

```typescript
interface PhotoMetadata {
  width: number;
  height: number;
  aspectRatio: number;
  blurhash?: string; // For placeholder generation
  dominantColor?: string; // For background while loading
}

const generatePhotoMetadata = async (
  buffer: ArrayBuffer
): Promise<PhotoMetadata> => {
  // Extract dimensions and generate placeholder data
  const dimensions = await getImageDimensions(buffer);

  return {
    width: dimensions.width,
    height: dimensions.height,
    aspectRatio: dimensions.width / dimensions.height,
    dominantColor: '#f0f0f0', // Future: extract actual dominant color
  };
};
```

## Monitoring and Analytics

### Storage Metrics

```typescript
interface PhotoStorageMetrics {
  totalPhotos: number;
  totalSize: number; // Bytes
  submissionPhotos: number;
  artworkPhotos: number;
  averageFileSize: number;
  storageByMonth: Record<string, number>;
}

const getStorageMetrics = async (env: Env): Promise<PhotoStorageMetrics> => {
  // Implementation would analyze R2 bucket contents
  // For production, use Cloudflare Analytics API

  return {
    totalPhotos: 0,
    totalSize: 0,
    submissionPhotos: 0,
    artworkPhotos: 0,
    averageFileSize: 0,
    storageByMonth: {},
  };
};
```

### Performance Monitoring

```typescript
interface PhotoPerformanceMetrics {
  uploadDuration: number; // Average upload time (ms)
  processingDuration: number; // Average processing time (ms)
  failureRate: number; // Percentage of failed uploads
  popularSizes: Record<string, number>; // Most requested image sizes
}
```

## Troubleshooting

### Common Issues

**Upload Failures:**

1. Check file size limits and MIME type validation
2. Verify R2 bucket permissions and KV namespace access
3. Monitor R2 request quotas and storage limits

**Missing Photos:**

1. Verify photo migration completed successfully
2. Check R2 object existence and metadata
3. Validate URL generation and CDN configuration

**Performance Issues:**

1. Monitor R2 request latency and error rates
2. Check CDN cache hit rates and edge performance
3. Optimize image processing pipeline

### Debug Commands

```bash
# List photos in R2 bucket
wrangler r2 object list cultural-archiver-photos --prefix="submissions/2024/01/"

# Check specific photo metadata
wrangler r2 object get cultural-archiver-photos "submissions/2024/01/15/filename.jpg" --file=downloaded.jpg

# Monitor upload performance
curl -w "%{time_total}" -X POST http://localhost:8787/api/logbook \
  -H "Authorization: Bearer test-token" \
  -F "photos=@test-image.jpg" \
  -F "lat=49.2827" -F "lon=-123.1207"
```

## Future Enhancements

1. **Image Optimization**: Cloudflare Images integration for automatic format
   conversion and resizing
2. **AI Content Moderation**: Automatic detection of inappropriate content
3. **Duplicate Detection**: Identify and handle duplicate photo submissions
4. **Backup and Recovery**: Cross-region replication for photo backup
5. **Advanced EXIF**: Enhanced metadata extraction and privacy controls
6. **Progressive Enhancement**: WebP format support with fallbacks
7. **Thumbnail Generation**: Automatic thumbnail creation for improved
   performance
8. **Content Delivery**: Edge optimization for global photo delivery
