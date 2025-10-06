# Image Thumbnail Generation System - Development Plan

## Overview

This document outlines the development plan for implementing an image thumbnail generation system for the Cultural Archiver project. The system will automatically generate optimized image variants when photos are uploaded, and provide a migration script to process existing images.

**Status:** Research Phase - Investigating WASM Image Resizing Solutions  
**Created:** October 5, 2025  
**Updated:** October 6, 2025  
**Target Release:** TBD

---

## Current Status (October 6, 2025)

### What We've Done
- ✅ Updated medium image size from 800px to 1024px
- ✅ Fixed CORS headers for cross-origin image loading (`Cross-Origin-Resource-Policy: cross-origin`)
- ✅ Implemented smart variant regeneration logic (checks metadata and regenerates if size mismatches)
- ✅ All tests passing with new 1024px size (692 tests total)
- ✅ Backend deployed (version `30a96933-25e2-4adf-9111-51068511fcd5`)
- ✅ **Implemented WASM image resizing using `wasm-image-optimization`**
  - Replaced non-functional Cloudflare Image Resizing API
  - Uses `optimizeImageExt()` to resize images and return actual dimensions
  - Supports JPEG, PNG, WebP, AVIF formats with quality control
  - Build successful with zero errors

### Previous Problem (RESOLVED)
**Cloudflare Image Resizing API was not working** because:
- `CLOUDFLARE_IMAGES_ENABLED = "false"` in production
- The `fetch` with `cf.image` API requires Cloudflare Image Resizing to be enabled on the account
- Without it, system returned original full-size images even for "medium" requests
- Example: Requesting 1024px medium variant returned 3072x4080 original (3.3MB instead of ~200KB)

**Solution Implemented:** Option 3 - WASM Image Resizing using `wasm-image-optimization`

### Next Step
🚀 Deploy backend worker to production and test with real images to verify resizing works

### Solution Options

#### Option 1: Enable Cloudflare Image Resizing (NOT CHOSEN)
- Requires paid Cloudflare Images subscription
- Would enable `fetch` with `cf.image` API
- Pros: Native Cloudflare solution, well-integrated, fast
- Cons: Additional cost, requires account upgrade

#### Option 2: Serve Originals (NOT CHOSEN)
- Keep current setup, browser handles client-side resizing
- Pros: No code changes needed
- Cons: Wastes bandwidth, slower page loads, poor mobile experience

#### Option 3: Integrate WASM Image Resizing Library ⭐ **SELECTED**
- Use WebAssembly-based image processing in Workers
- Pros: No additional Cloudflare costs, full control, works offline
- Cons: More complex implementation, WASM bundle size, CPU usage

---

## Research: WASM Image Resizing for Cloudflare Workers

### Requirement Constraints
- **Environment**: Cloudflare Workers (V8 isolate, not Node.js)
- **Memory Limit**: 128MB default (can be increased)
- **CPU Time Limit**: 50ms on free plan, 30s on paid plans
- **No Node.js APIs**: Cannot use `fs`, `child_process`, `os.cpus()`, etc.
- **WASM Support**: Full WebAssembly support available
- **Bundle Size**: Should be reasonable (<1MB ideally)

### Libraries Investigated

#### ❌ `@squoosh/lib`
- **Status**: Tested and rejected
- **Issue**: Requires Node.js APIs (`node:os`, `node:fs`)
- **Why it failed**: `import { cpus } from 'node:os'` - not available in Workers
- **Bundle size**: ~500KB
- **Conclusion**: Designed for Node.js, not Workers-compatible

#### ✅ `wasm-image-optimization` - **SELECTED FOR IMPLEMENTATION**
- **Status**: ✅ Installed and tested successfully
- **Package**: https://www.npmjs.com/package/wasm-image-optimization
- **Description**: WASM-based image optimization specifically designed for Cloudflare Workers
- **Size**: Small WASM bundle (~150KB)
- **Features**: Resize, compress, format conversion (JPEG, PNG, WebP, AVIF)
- **Compatibility**: ✅ Designed for browser/Workers environments (explicitly supports Cloudflare Workers)
- **API**:
  ```typescript
  optimizeImage({
    image: BufferSource | Buffer | string,
    width?: number,
    height?: number,
    quality?: number, // 0-100
    format?: "jpeg" | "png" | "webp" | "avif",
    speed?: number, // 0-10 (slow-fast)
    filter?: boolean // resize filter (default true)
  }): Promise<ArrayBuffer>
  
  optimizeImageExt({
    // same params as optimizeImage
  }): Promise<{
    data: Uint8Array,
    originalWidth: number,
    originalHeight: number,
    width: number,
    height: number
  }>
  ```
- **Test Results**:
  - ✅ Successfully imports in Workers environment
  - ✅ Exports `optimizeImage` and `optimizeImageExt` functions
  - ✅ Supports JPEG, PNG, WebP, AVIF, thumbhash formats
  - ✅ Returns both data and dimensions with `optimizeImageExt`
  - ✅ No Node.js dependencies
- **Decision**: This library meets all requirements and will be used for implementation

#### 🔍 Other Options to Research

1. **`wasm-imagemagick`**
   - Full ImageMagick compiled to WASM
   - Pro: Feature-complete image processing
   - Con: Large bundle size (2-5MB)
   - Use case: If we need advanced features beyond resize

2. **`@cf/image` (Cloudflare Workers AI)**
   - Cloudflare's AI/ML models including image processing
   - Pro: Native Cloudflare integration
   - Con: Requires Workers AI subscription
   - Need to research: Pricing and capabilities

3. **`photon-rs` WASM bindings**
   - Rust-based image processing library
   - Pro: Fast, efficient, designed for WASM
   - Con: Need to compile Rust to WASM, larger bundle
   - GitHub: https://github.com/silvia-odwyer/photon

4. **Custom canvas-based resizing**
   - Use HTML5 Canvas API (available in Workers via `HTMLRewriter`)
   - Pro: No dependencies, lightweight
   - Con: Limited to basic resizing, no advanced compression
   - Viability: Need to verify Canvas API availability in Workers

5. **`image-js/image-js`**
   - Pure JavaScript image processing library
   - Pro: No WASM needed, works everywhere
   - Con: Slower than WASM, larger bundle
   - Use case: Fallback option if WASM solutions fail

### Real-World Examples (Need Research)

**Projects to investigate:**
- [ ] Cloudflare Images Resizing Worker examples
- [ ] Cloudflare Workers showcase - image processing examples
- [ ] GitHub search: `cloudflare workers image resize wasm`
- [ ] Cloudflare Community forums for image processing patterns
- [ ] Check Cloudflare Workers examples repository

---

## Milestone 1: Thumbnail Generation System

**Goal:** Implement automatic thumbnail generation for new photo uploads with support for multiple image sizes using WASM-based resizing.

### 1.1 - Research and Design Phase ⏳ IN PROGRESS

**Objective:** Determine the best WASM-based image processing solution for Cloudflare Workers.

**Tasks:**

- [x] Research Cloudflare Workers image processing capabilities
  - [x] ~~Investigate `wrangler/cloudflare:image` library compatibility~~ - Requires paid subscription
  - [x] ~~Evaluate sharp.js alternatives~~ - Requires Node.js
  - [x] ~~Test `@squoosh/lib`~~ - Failed: Requires Node.js APIs
  - [ ] **Test `wasm-image-optimization`** - Currently installed
  - [ ] Research `@cf/image` Workers AI capabilities and pricing
  - [ ] Investigate `photon-rs` WASM bindings
  - [ ] Research `wasm-imagemagick` feasibility
  - [ ] Test `image-js` as pure JS fallback
- [x] Define image size specifications
  - **Thumbnail**: 400x400px (map markers, cards, search results)
  - **Medium**: 1024x1024px ✅ Updated from 800px (artwork detail pages)
  - **Large**: 1200x1200px (high-quality detail view)
  - **Original**: Unchanged (archive/reference)
- [x] Design R2 storage structure for variants
  - Using existing folder structure: `artworks/YYYY/MM/DD/`
  - Naming convention: `timestamp-uuid__SIZExSIZE.ext` (e.g., `20240115-143052-uuid__1024x1024.jpg`)
- [ ] Document performance considerations
  - Memory limits in Workers (128MB default)
  - Processing time limits (CPU time: 50ms free, 30s paid)
  - WASM bundle size impact on cold starts
  - Batch processing strategy for multiple photos
- [ ] Update database schema documentation
  - Define photo metadata structure in `photos` JSON field
  - Document size variants and URL patterns

**Deliverables:**

- [ ] Technical design document: `docs/image-processing-wasm.md`
- [ ] Performance benchmark comparison of WASM libraries
- [ ] Bundle size analysis
- [x] Updated database schema documentation (see `docs/database.md`)
- [x] Size specification reference table (updated to 1024px medium)

---

## Research Action Plan (Next Steps)

### Phase 1: Quick Wins (1-2 hours)
1. **Test `wasm-image-optimization`** (already installed)
   - Create test implementation
   - Benchmark performance with 3072x4080 test image
   - Measure bundle size impact
   - Test memory usage

2. **Research Cloudflare Workers AI `@cf/image`**
   - Check documentation: https://developers.cloudflare.com/workers-ai/
   - Determine pricing model
   - Evaluate if it includes image resizing
   - Compare cost vs implementation complexity

### Phase 2: Deeper Investigation (2-4 hours)
3. **Search real-world examples**
   - GitHub: Search for "cloudflare workers image resize"
   - Cloudflare Workers Showcase
   - Cloudflare Community forums
   - Stack Overflow solutions

4. **Benchmark alternatives**
   - If `wasm-image-optimization` fails, try `photon-rs`
   - Test `image-js` as pure JS fallback
   - Document performance: time, memory, bundle size

### Phase 3: Implementation (4-8 hours)
5. **Implement chosen solution**
   - Update `src/workers/lib/image-processing.ts`
   - Add WASM loading logic
   - Handle errors gracefully (fallback to original if resize fails)
   - Add telemetry/logging

6. **Testing**
   - Unit tests for resize function
   - Integration test with R2 storage
   - Load test with multiple concurrent requests
   - Test with various image formats (JPEG, PNG, WebP)

7. **Deployment**
   - Update wrangler.toml with WASM module if needed
   - Deploy to staging
   - Verify with real production images
   - Monitor performance metrics

---

## Success Criteria

- [ ] Medium variant (1024px) successfully generated from 3072x4080 originals
- [ ] Image file size reduced by 80-90% (3.3MB → ~200-400KB)
- [ ] Resize operation completes in <2 seconds per image
- [ ] WASM bundle size <500KB
- [ ] Memory usage stays under 128MB
- [ ] Graceful fallback to original if resize fails
- [ ] Works with JPEG, PNG, WebP formats

---

## Open Questions

1. **Workers AI Pricing**: What's the cost per image resize with `@cf/image`?
2. **Bundle Size**: Will WASM bundle cause cold start issues?
3. **Caching**: Should we cache WASM module between requests?
4. **Format Support**: Do we need HEIC/HEIF support for iPhone photos?
5. **Quality Settings**: What JPEG quality gives best size/quality tradeoff?
6. **Concurrent Processing**: Can we resize multiple images in parallel?
7. **Error Handling**: Should failed resizes block upload or fall back to originals?

---

## References

- Cloudflare Workers Limits: https://developers.cloudflare.com/workers/platform/limits/
- WebAssembly in Workers: https://developers.cloudflare.com/workers/runtime-apis/webassembly/
- R2 Storage: https://developers.cloudflare.com/r2/
- Current implementation: `src/workers/lib/image-processing.ts`
- Image endpoint: `src/workers/routes/images.ts`

---

### 1.2 - On-Demand Image Resizing API

**Objective:** Implement a dynamic, on-demand image resizing and caching system that avoids database schema changes.

**Tasks:**

- [ ] Design the on-demand image resizing endpoint
  - **Endpoint:** `GET /v1/images/:size/*`
  - **URL Structure:** `https://api.publicartregistry.com/v1/images/thumb/artworks/2024/01/15/original-image-name.jpg`
  - **Naming Convention:** The resized image will be stored in R2 with a suffix, e.g., `original-image-name__400x400.jpg`.
- [ ] Implement the API endpoint logic in a new route `src/workers/routes/images.ts`
  - The endpoint will parse the `size` and the original image path.
  - It will construct the R2 key for the resized image.
  - It will check if the resized image already exists in the R2 bucket.
  - **If it exists:** Serve the file directly from R2 with a long cache header.
  - **If it does not exist:**
    - Fetch the original image from R2.
    - Use the image processing library to resize it.
    - Upload the new resized image to R2.
    - Serve the newly created image.
  - Implement security to ensure it only processes images from within the R2 bucket.
- [ ] Create a URL helper function for the frontend
  - `getImageSizedURL(originalUrl: string, size: 'thumb' | 'medium' | 'large'): string`
  - This function will construct the appropriate API endpoint URL.
- [ ] Update TypeScript types in `src/shared/types.ts`
  - Add `PhotoVariant` enum type (`original`, `thumbnail`, `medium`, `large`).
- [ ] Test the new endpoint thoroughly
  - Test with various image sizes and formats.
  - Test cache headers and behavior.
  - Test error handling for missing original images.

**Deliverables:**

- New API route: `src/workers/routes/images.ts`
- Frontend URL helper function.
- Unit and integration tests for the new endpoint.

**Dependencies:** 1.1 completed

**Estimated Time:** 3-4 days

---

### 1.3 - Image Processing Implementation

**Objective:** Implement core image processing functionality for generating thumbnails.

**Tasks:**

- [ ] Create image processing module `src/workers/lib/image-processing.ts`
  - Implement `generateImageVariants(file: File, options: ImageProcessingOptions): Promise<ImageVariant[]>`
  - Add size validation and aspect ratio handling
  - Implement quality optimization (JPEG quality, WebP conversion)
  - Add error handling for corrupted images
- [ ] Implement image resizing function
  - Choose implementation based on research (1.1)
  - Support JPEG, PNG, WebP formats
  - Maintain aspect ratio with smart cropping options
  - Add EXIF data preservation for copyright/attribution
- [ ] Add configuration options
  - Define size presets in `src/shared/types.ts`
  - Add quality settings (default: 85 for JPEG, 90 for WebP)
  - Add format conversion options (auto-WebP for browser support)
- [ ] Implement progress tracking
  - Add processing metrics to `PhotoUploadResult`
  - Track processing time and size reduction
  - Log processing errors for debugging

**Deliverables:**

- Image processing module with full documentation
- Unit tests with sample images
- Performance benchmarks

**Dependencies:** 1.1, 1.2 completed

**Estimated Time:** 3-5 days

---

### 1.4 - R2 Storage Integration

**Objective:** Integrate image processing with R2 storage upload pipeline.

**Tasks:**

- [ ] Update `processAndUploadPhotos()` to pre-warm the cache by calling the new image resizing API for each size upon initial upload.
  - This avoids the first user paying the performance penalty of resizing.
- [ ] Update `deleteFromR2` to also delete the generated variants when an original photo is deleted.

**Deliverables:**

- Updated photo processing library
- Integration tests with R2 mocks
- Storage cleanup utilities

**Dependencies:** 1.2, 1.3 completed

**Estimated Time:** 2-3 days

---

### 1.5 - API Endpoint Updates

**Objective:** Update submission and artwork endpoints to support photo variants.

**Tasks:**

- [ ] Update submission endpoints (`POST /v1/submissions`) to trigger the cache warming for new photos.
- [ ] The `GET /v1/artworks/:id` endpoint does not need to be changed, as the frontend will construct the image URLs.
- [ ] Remove any logic that deals with photo variants from `serializeArtworkRecord()`.

**Deliverables:**

- Updated API endpoints
- API documentation updates in `docs/api.md`
- Integration tests

**Dependencies:** 1.4 completed

**Estimated Time:** 2-3 days

---

### 1.6 - Frontend Integration

**Objective:** Update frontend components to use optimized image variants.

**Tasks:**

- [ ] Update photo display components
  - Modify `PhotoCarousel.vue` to use medium/large variants
  - Update `ArtworkCard.vue` to use thumbnail variants
  - Update `MiniMap.vue` markers to preload thumbnails
- [ ] Add responsive image loading
  - Implement `srcset` for responsive images
  - Add lazy loading for off-screen images
  - Use thumbnail for initial load, swap to medium on interaction
- [ ] Update API service layer (`src/frontend/src/services/api.ts`) to use the new `getImageSizedURL` helper to request the correctly sized images.
- [ ] Add loading states and placeholders
  - Show blur-up placeholder during image load
  - Add skeleton loaders for image cards
  - Handle missing image errors gracefully

**Deliverables:**

- Updated Vue components
- Responsive image implementation
- Frontend tests

**Dependencies:** 1.5 completed

**Estimated Time:** 2-3 days

---

### 1.7 - Testing and Validation

**Objective:** Comprehensive testing of the thumbnail generation system.

**Tasks:**

- [ ] Unit tests
  - Test image processing with various formats (JPEG, PNG, WebP, HEIC)
  - Test size validation and aspect ratio handling
  - Test error handling for corrupted images
  - Test R2 upload/delete operations
- [ ] Integration tests
  - Test full upload pipeline with variant generation
  - Test submission workflow with photos
  - Test concurrent uploads (multiple users)
  - Test partial failure scenarios
- [ ] Performance tests
  - Benchmark processing time for different image sizes
  - Test memory usage with large images (>10MB)
  - Test Worker CPU time limits
  - Measure bandwidth savings (original vs thumbnail)
- [ ] User acceptance testing
  - Test photo upload in development environment
  - Verify image quality across all variants
  - Test mobile device compatibility
  - Validate accessibility (alt text, loading states)

**Deliverables:**

- Test suite with >90% coverage
- Performance benchmark report
- UAT checklist and results

**Dependencies:** 1.6 completed

**Estimated Time:** 3-4 days

---

### 1.8 - Documentation and Deployment

**Objective:** Complete documentation and deploy to production.

**Tasks:**

- [ ] Update documentation
  - Complete `docs/image-processing.md` with architecture details
  - Update `docs/photo-processing.md` with variant workflows
  - Update `docs/api.md` with new photo response format
  - Add troubleshooting guide for image processing errors
- [ ] Create deployment checklist
  - Verify R2 bucket configuration for all environments
  - Test database migration on staging environment
  - Verify environment variables (`PHOTO_DEBUG`, etc.)
  - Plan rollback strategy
- [ ] Deploy to staging
  - Apply database migration
  - Deploy updated Workers code
  - Test end-to-end workflow
  - Monitor error logs and performance
- [ ] Deploy to production
  - Schedule maintenance window (optional)
  - Apply database migration
  - Deploy Workers code
  - Monitor initial uploads
  - Verify CDN cache behavior

**Deliverables:**

- Complete documentation suite
- Deployment runbook
- Production deployment verification

**Dependencies:** 1.7 completed

**Estimated Time:** 2-3 days

---

## Milestone 2: Existing Image Migration

**Goal:** Create and execute a migration script to process all existing artwork images and generate thumbnails.

### 2.1 - Migration Script Design

**Objective:** Design a robust, resumable migration script for processing 1000+ existing images.

**Tasks:**

- [ ] Define migration strategy
  - Identify all artworks with photos in database
  - Plan for rate limiting to avoid R2 throttling
  - Design resumable processing (track progress)
  - Plan for error handling and retry logic
- [ ] Design progress tracking
  - Create migration state file (`_data/image-migration-state.json`)
  - Track processed/failed/pending artworks
  - Store timestamps and error messages
  - Support resuming from last checkpoint
- [ ] Plan for minimal downtime
  - Process images without locking database
  - Use optimistic updates (read, process, write)
  - Implement rollback strategy for failed migrations
  - Plan for staged rollout (batch processing)
- [ ] Design reporting system
  - Generate summary report (processed, failed, skipped)
  - Create detailed error log
  - Track bandwidth savings and storage usage
  - Generate CSV for manual review of failures

**Deliverables:**

- Migration design document
- Progress tracking schema
- Error handling flowchart

**Dependencies:** Milestone 1 completed

**Estimated Time:** 1-2 days

---

### 2.2 - Migration Script Implementation

**Objective:** Implement the migration script as a Node.js CLI tool.

**Tasks:**

- [ ] Create migration script `scripts/migrate-image-thumbnails.ts`
  - Use Commander.js for CLI interface (consistent with `ca-import.ts`)
  - Add options: `--dry-run`, `--batch-size`, `--resume`, `--verbose`
  - Implement progress bar with `ora` spinner
  - Add colored console output with `chalk`
- [ ] Implement database queries
  - Query artworks with photos: `SELECT id, photos FROM artwork WHERE photos IS NOT NULL`
  - Parse JSON photo fields (support both string URLs and objects)
  - Filter for artworks needing migration (no variants)
  - Implement pagination (batch processing)
- [ ] Implement image download and processing
  - Download original image from R2/URL
  - Generate all variants (thumbnail, medium, large)
  - Upload variants to R2 with proper naming
  - Update database with variant URLs
- [ ] Add progress persistence
  - Save progress after each batch
  - Support `--resume` flag to continue from checkpoint
  - Handle interruptions gracefully (Ctrl+C)
  - Clean up temporary files on exit
- [ ] Implement error handling
  - Retry failed downloads (3 attempts with exponential backoff)
  - Log errors to file `_data/migration-errors.log`
  - Skip corrupted images, continue processing
  - Collect failed artworks for manual review

**Deliverables:**

- Migration script: `scripts/migrate-image-thumbnails.ts`
- Progress tracking implementation
- Error logging system

**Dependencies:** 2.1 completed

**Estimated Time:** 3-4 days

---

### 2.3 - Migration Script Testing

**Objective:** Test migration script with sample data before production execution.

**Tasks:**

- [ ] Create test dataset
  - Export subset of production data (50 artworks)
  - Include various photo formats and edge cases
  - Test with missing images and broken URLs
  - Test with already-migrated artworks (idempotency)
- [ ] Test on local development database
  - Run migration with `--dry-run` flag
  - Verify no data changes in dry-run mode
  - Run actual migration on test data
  - Validate generated variants (size, quality)
- [ ] Test error scenarios
  - Simulate network failures (disconnect during processing)
  - Test with corrupted image files
  - Test with insufficient R2 storage
  - Verify rollback on critical errors
- [ ] Test resume functionality
  - Start migration, interrupt mid-batch
  - Resume with `--resume` flag
  - Verify no duplicate processing
  - Verify checkpoint accuracy
- [ ] Performance testing
  - Measure processing time per image
  - Calculate estimated total migration time
  - Monitor memory usage and CPU
  - Optimize batch size for efficiency

**Deliverables:**

- Test results report
- Performance benchmarks
- Updated script with optimizations

**Dependencies:** 2.2 completed

**Estimated Time:** 2-3 days

---

### 2.4 - Staging Migration Execution

**Objective:** Execute migration on staging environment to validate production readiness.

**Tasks:**

- [ ] Prepare staging environment
  - Clone production database to staging
  - Verify R2 bucket access and quotas
  - Set up monitoring and logging
  - Create backup before migration
- [ ] Execute staged migration
  - Start with small batch (100 artworks)
  - Monitor processing and error rates
  - Validate generated thumbnails visually
  - Check database integrity after batch
- [ ] Incremental rollout
  - Process in batches of 200-500 artworks
  - Monitor between batches for issues
  - Validate CDN cache updates
  - Test frontend display of migrated images
- [ ] Validation and reporting
  - Verify all artworks have variants
  - Check for orphaned files in R2
  - Generate final migration report
  - Document any issues encountered

**Deliverables:**

- Staging migration report
- Lessons learned document
- Updated migration procedures

**Dependencies:** 2.3 completed

**Estimated Time:** 2-3 days

---

### 2.5 - Production Migration Execution

**Objective:** Execute final migration on production database.

**Tasks:**

- [ ] Pre-migration checklist
  - Create full database backup
  - Verify R2 storage capacity (estimate: +2GB for variants)
  - Schedule maintenance window (optional, non-blocking)
  - Notify users of potential performance impact
- [ ] Execute production migration
  - Start migration with `--batch-size=100` (conservative)
  - Monitor Worker metrics and error rates
  - Watch R2 storage usage and bandwidth
  - Track progress and ETA
- [ ] Monitor and validate
  - Check frontend image loading during migration
  - Monitor user-reported issues
  - Verify CDN cache hit rates
  - Validate bandwidth reduction metrics
- [ ] Post-migration tasks
  - Generate final migration report
  - Clean up any orphaned files
  - Update documentation with actual metrics
  - Archive migration logs and state files

**Deliverables:**

- Production migration completion report
- Performance improvement metrics
- Post-migration validation checklist

**Dependencies:** 2.4 completed

**Estimated Time:** 1-2 days (execution + monitoring)

---

### 2.6 - Migration Cleanup and Optimization

**Objective:** Clean up migration artifacts and optimize the system.

**Tasks:**

- [ ] Analyze migration results
  - Calculate total storage savings
  - Measure bandwidth reduction (before/after)
  - Document average processing time per image
  - Identify any edge cases or failures
- [ ] Optimize R2 storage
  - Remove any duplicate files
  - Verify correct cache headers on all variants
  - Implement lifecycle policies for old originals (optional)
  - Document R2 bucket organization
- [ ] Update monitoring and alerts
  - Add metrics for variant generation success rate
  - Alert on high processing failure rates
  - Monitor R2 storage growth trends
  - Track image processing performance
- [ ] Archive migration script
  - Move script to `scripts/archive/` directory
  - Document for future reference
  - Remove from active npm scripts
  - Create "lessons learned" document

**Deliverables:**

- Migration analytics report
- Optimization recommendations
- Updated monitoring dashboard

**Dependencies:** 2.5 completed

**Estimated Time:** 1-2 days

---

## Risk Assessment

### Technical Risks

| Risk                                      | Impact | Likelihood | Mitigation                                               |
| ----------------------------------------- | ------ | ---------- | -------------------------------------------------------- |
| Workers CPU time limits exceeded          | High   | Medium     | Optimize processing, use batch processing, async workers |
| Memory limits with large images (>10MB)   | High   | Low        | Add size validation, stream processing, resize in chunks |
| R2 storage costs exceed budget            | Medium | Low        | Monitor storage, implement lifecycle policies            |
| Image quality degradation                 | Medium | Medium     | Test quality settings, allow original fallback           |
| Database migration corrupts photo data    | High   | Low        | Comprehensive testing, backups, rollback plan            |
| CDN cache invalidation delays             | Low    | Medium     | Use versioned URLs, plan cache warming                   |
| Concurrent upload conflicts during migration | Medium | Low | Use optimistic locking, retry logic                   |

### Business Risks

| Risk                                   | Impact | Likelihood | Mitigation                                 |
| -------------------------------------- | ------ | ---------- | ------------------------------------------ |
| User-facing downtime during migration  | Medium | Low        | Non-blocking migration, off-peak execution |
| Increased R2 egress costs              | Low    | Medium     | Monitor bandwidth, optimize CDN caching    |
| Migration takes longer than estimated  | Low    | Medium     | Batch processing, resume capability        |
| Photo quality complaints from users    | Medium | Low        | UAT testing, quality validation            |

---

## Success Metrics

### Milestone 1 (Thumbnail Generation)

- ✅ All new photo uploads generate variants automatically
- ✅ Thumbnail loading time < 500ms on 3G connection
- ✅ Bandwidth reduction of 80%+ for thumbnail views
- ✅ Zero processing failures for valid images
- ✅ Test coverage > 90% for image processing module

### Milestone 2 (Migration)

- ✅ 100% of existing artworks have thumbnail variants
- ✅ Migration completes in < 48 hours total time
- ✅ Zero data loss or corruption
- ✅ < 5% image processing failure rate
- ✅ Storage increase < 30% of original (variants smaller than originals)

---

## Future Enhancements

### Phase 3: Advanced Image Features (Post-Release)

- [ ] Implement WebP/AVIF format conversion for modern browsers
- [ ] Add blur-hash placeholders for instant loading
- [ ] Implement smart cropping based on subject detection
- [ ] Add watermarking for copyright protection
- [ ] Support for image galleries (multiple photos per artwork)
- [ ] Implement image CDN integration (Cloudflare Images)
- [ ] Add user-uploadable profile pictures with same pipeline
- [ ] Support for 360° panoramic photos
- [ ] Implement image moderation (detect inappropriate content)
- [ ] Add EXIF-based geolocation validation

---

## References

### Related Documentation

- `/docs/photo-processing.md` - Current photo processing system
- `/docs/database.md` - Database schema documentation
- `/docs/api.md` - API endpoint documentation
- `/src/workers/lib/photos.ts` - Photo processing implementation
- `/src/shared/types.ts` - TypeScript type definitions

### External Resources

- [Cloudflare Workers Image Processing](https://developers.cloudflare.com/workers/examples/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare Images](https://developers.cloudflare.com/images/)
- [WebP Image Format](https://developers.google.com/speed/webp)
- [Responsive Images Guide](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)

---

## Approval and Sign-off

- [ ] Technical design approved
- [ ] Timeline approved
- [ ] Budget approved (R2 storage costs)
- [ ] Stakeholder sign-off

**Last Updated:** October 5, 2025  
**Next Review:** TBD
