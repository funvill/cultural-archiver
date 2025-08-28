# Cloudflare Images Integration Guide

This guide covers setting up and configuring Cloudflare Images integration for the Cultural Archiver photo processing pipeline.

## Overview

The Cultural Archiver supports both R2 storage (for MVP) and Cloudflare Images (for production optimization). Cloudflare Images provides automatic optimization, resizing, and CDN delivery of photos.

## Configuration

### Environment Variables

Add these variables to your `wrangler.toml` environment configuration:

```toml
# Enable/disable Cloudflare Images
CLOUDFLARE_IMAGES_ENABLED = "true"  # Set to "false" for R2-only mode

# Cloudflare Images hash (optional, for custom delivery URLs)
CLOUDFLARE_IMAGES_HASH = ""  # Leave empty for default URLs

# API token for Cloudflare Images (set via secrets)
# CLOUDFLARE_IMAGES_API_TOKEN set via `wrangler secret put CLOUDFLARE_IMAGES_API_TOKEN`
```

### Secrets Configuration

Set up the Cloudflare Images API token as a secret:

```bash
# Set the API token
wrangler secret put CLOUDFLARE_IMAGES_API_TOKEN

# Set your Cloudflare account ID if not already set
wrangler secret put CLOUDFLARE_ACCOUNT_ID
```

### API Token Permissions

Create a Cloudflare API token with the following permissions:

- **Account**: Cultural Archiver Account
- **Permissions**: 
  - `Cloudflare Images:Edit`
  - `Zone:Read` (if using custom domains)
- **Account Resources**: Include specific account
- **Zone Resources**: Include specific zones (if applicable)

## Features

### Automatic Fallback

The system automatically falls back to R2 storage if Cloudflare Images is:
- Disabled (`CLOUDFLARE_IMAGES_ENABLED = "false"`)
- Unavailable (API errors)
- Not properly configured

### Image Processing

When Cloudflare Images is enabled:

1. **Original Upload**: Photos are uploaded to Cloudflare Images
2. **Automatic Optimization**: Images are automatically optimized for web delivery
3. **Dynamic Resizing**: Thumbnails are generated on-demand via URL parameters
4. **CDN Delivery**: Images are served from Cloudflare's global CDN

### URL Structure

#### Cloudflare Images URLs
```
https://imagedelivery.net/{account-id}/{image-id}/{transformation}
```

Example transformations:
- `w=800` - Resize to 800px width
- `w=400,h=400,fit=crop` - 400x400 crop
- `quality=85` - Set JPEG quality

#### R2 Fallback URLs
```
https://photos.cultural-archiver.com/{date-path}/{filename}
```

## Implementation Details

### Photo Upload Flow

1. **File Validation**: Standard file validation (size, type, etc.)
2. **EXIF Processing**: Metadata preservation and permalink injection
3. **Upload Decision**: Check if Cloudflare Images is enabled and configured
4. **Upload Process**:
   - **Cloudflare Images**: Upload via API with metadata
   - **R2 Fallback**: Upload to R2 bucket with traditional folder structure

### Error Handling

The system handles various error scenarios:

- **API Rate Limits**: Automatic fallback to R2
- **Authentication Errors**: Log warning and use R2
- **Network Issues**: Retry with exponential backoff, then fallback
- **Invalid Configuration**: Default to R2 mode

### Metadata Preservation

When uploading to Cloudflare Images:

```typescript
const metadata = {
  source: 'cultural-archiver',
  uploadedAt: new Date().toISOString(),
  submissionId: '...',
  originalFilename: '...',
  exifProcessed: 'true',
  permalinkInjected: '...'
};
```

## Performance Benefits

### Cloudflare Images Advantages

1. **Automatic Optimization**: WebP conversion, quality optimization
2. **Dynamic Resizing**: On-demand thumbnail generation
3. **CDN Delivery**: Global edge caching for fast delivery
4. **Bandwidth Savings**: Optimized formats reduce transfer costs
5. **Reduced Storage**: Single original, multiple variants on-demand

### R2 Storage (Fallback)

1. **Cost Effective**: Lower storage costs for large volumes
2. **Full Control**: Complete ownership of image processing pipeline
3. **Custom Processing**: Ability to implement custom optimizations
4. **Reliability**: No external API dependencies

## Monitoring

### Success Metrics

- **Upload Success Rate**: Target >99% for both Cloudflare Images and R2
- **Processing Time**: <5 seconds for Cloudflare Images, <10 seconds for R2
- **Fallback Rate**: <5% fallback to R2 when Cloudflare Images is enabled
- **CDN Cache Hit Rate**: >95% for repeated image requests

### Logging

The system logs key events:

```typescript
// Successful Cloudflare Images upload
console.info('Photo uploaded to Cloudflare Images:', { 
  imageId: 'abc123', 
  originalKey: 'submissions/2024/12/27/filename.jpg' 
});

// Fallback to R2
console.warn('Cloudflare Images upload failed, falling back to R2:', error);

// Processing completion
console.info('Photo processing completed:', {
  cloudflareImages: true,
  thumbnailGenerated: true,
  exifProcessed: true
});
```

## Troubleshooting

### Common Issues

1. **API Token Invalid**
   - Check token permissions
   - Verify account ID matches
   - Ensure token hasn't expired

2. **Upload Failures**
   - Check file size limits (Cloudflare Images: 10MB max)
   - Verify file format support
   - Check account storage quotas

3. **Images Not Loading**
   - Verify delivery URLs are correct
   - Check CORS configuration
   - Ensure images are set to public access

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=debug` in your environment variables.

### Health Check

Test the system with a sample upload:

```bash
# Test upload via API
curl -X POST https://your-worker-domain/api/logbook \
  -H "Content-Type: multipart/form-data" \
  -F "photo=@test-image.jpg" \
  -F "lat=49.2827" \
  -F "lon=-123.1207" \
  -F "note=Test upload"
```

## Cost Optimization

### Cloudflare Images Pricing

- **Storage**: $5/month per 100,000 original images
- **Transformations**: $1/month per 1,000 unique transformations
- **Delivery**: $1/month per 100,000 requests

### R2 Storage Pricing

- **Storage**: $0.015/GB/month
- **Operations**: $4.50 per million Class A operations
- **Data Transfer**: Free egress to Cloudflare network

### Recommendations

1. **Use Cloudflare Images for high-traffic sites** with many thumbnail requests
2. **Use R2 storage for archives** with infrequent access
3. **Hybrid approach**: Hot images on Cloudflare Images, cold storage on R2
4. **Monitor usage**: Set up billing alerts for cost control

## Migration

### Existing R2 to Cloudflare Images

For existing installations with R2 storage:

1. **Gradual Migration**: Enable Cloudflare Images for new uploads only
2. **Batch Migration**: Use worker scripts to migrate existing images
3. **URL Compatibility**: Maintain R2 URLs for existing images
4. **Testing**: Validate image delivery before switching DNS

### Cloudflare Images to R2

If migrating away from Cloudflare Images:

1. **Download Originals**: Use the Images API to download all originals
2. **Upload to R2**: Batch upload to R2 with proper folder structure
3. **Update URLs**: Update database records with new R2 URLs
4. **DNS Switching**: Update photo base URL configuration

## Future Enhancements

### Planned Features

1. **Automatic Migration**: Background jobs to move cold images to R2
2. **Smart Compression**: AI-driven quality optimization
3. **Format Detection**: Automatic WebP/AVIF serving based on browser support
4. **Analytics Integration**: Image performance metrics
5. **Custom Transformations**: Watermarking, artistic filters