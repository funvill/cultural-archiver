# Task List: Image Handling & Rate Limiting System

Generated from `tasks\prd-image-handling-rate-limiting.md`

## Relevant Files

- `src/workers/lib/photos.ts` - Core photo processing utilities with Cloudflare Images integration (700+ lines, ✅ COMPLETED)
- `src/workers/lib/photos.test.ts` - Unit tests for photo processing utilities (✅ COMPLETED)
- `src/workers/lib/exif.ts` - EXIF metadata handling utilities with GPS preservation (350+ lines, ✅ COMPLETED)
- `src/workers/lib/exif.test.ts` - Unit tests for EXIF utilities (18 tests, ✅ COMPLETED)
- `src/workers/lib/consent.ts` - Consent collection and validation utilities (400+ lines, ✅ COMPLETED)
- `src/workers/lib/consent.test.ts` - Unit tests for consent utilities (18 tests, ✅ COMPLETED)
- `src/workers/routes/submissions.ts` - Submission handling with consent validation (✅ COMPLETED)
- `src/workers/routes/auth.ts` - Authentication with consent tracking (365 lines, ✅ COMPLETED)
- `src/workers/middleware/consent.ts` - Consent validation middleware (✅ COMPLETED)
- `src/frontend/src/components/ConsentForm.vue` - Frontend consent collection interface (✅ COMPLETED)
- `src/frontend/src/components/PhotoUpload.vue` - Photo upload with consent flow (✅ COMPLETED)
- `migrations/003_consent_audit_schema.sql` - Database schema for consent and audit logging (✅ COMPLETED)
- `src/shared/types.ts` - TypeScript interfaces for consent and EXIF data (✅ COMPLETED)
- `wrangler.toml` - Cloudflare Images configuration (✅ COMPLETED)
- `docs/cloudflare-images-setup.md` - Documentation for Cloudflare Images configuration (⚠️ OPTIONAL)

### Notes

- Unit tests should be placed alongside the code files they are testing
- Use `npm test` to run the complete test suite
- Cloudflare Images requires account-level configuration before code integration
- EXIF handling will require external library integration (exifr or piexifjs)

## Tasks

- [x] 1.0 Integrate Cloudflare Images for Image Processing
  - [x] 1.1 Configure Cloudflare Images in account dashboard and obtain API tokens
  - [x] 1.2 Update `wrangler.toml` with Cloudflare Images environment variables and bindings
  - [x] 1.3 Modify `src/workers/lib/photos.ts` to use Cloudflare Images API for optimization
  - [x] 1.4 Implement thumbnail generation (800px long edge) using Cloudflare Images variants
  - [x] 1.5 Add progressive JPEG and intelligent format selection (JPEG/PNG/WebP)
  - [x] 1.6 Update photo URL generation to support Cloudflare Images transforms
  - [x] 1.7 Implement fallback mechanism when Cloudflare Images is unavailable
  - [x] 1.8 Add comprehensive error handling for Cloudflare Images API failures

- [x] 2.0 Implement EXIF Metadata Preservation and Permalink System
  - [x] 2.1 Create `src/workers/lib/exif.ts` for EXIF data extraction and modification
  - [x] 2.2 Install and configure EXIF processing library (exifr and piexifjs)
  - [x] 2.3 Implement GPS coordinate preservation from original photos
  - [x] 2.4 Add permalink injection in EXIF comments using format `/p/artwork/{UUID}`
  - [x] 2.5 Integrate EXIF processing into photo upload pipeline
  - [x] 2.6 Create permalink redirect system for `/p/artwork/{UUID}` URLs
  - [x] 2.7 Apply EXIF modifications to both original and thumbnail versions
  - [x] 2.8 Add EXIF data validation and error handling

- [x] 3.0 Build Comprehensive Consent Collection System
  - [x] 3.1 Create `src/workers/lib/consent.ts` for consent validation and storage
  - [x] 3.2 Design consent data structure with versioning support
  - [x] 3.3 Implement age verification (18+ confirmation) logic
  - [x] 3.4 Add CC0 metadata licensing consent collection
  - [x] 3.5 Implement public-commons consent acknowledgment
  - [x] 3.6 Create Canadian Freedom of Panorama guidance with external links
  - [x] 3.7 Add consent versioning system with re-consent triggers
  - [x] 3.8 Integrate consent validation into submission workflow

- [x] 4.0 Enhance Database Schema for Audit Logging
  - [x] 4.1 Create `migrations/003_consent_audit_schema.sql` migration file
  - [x] 4.2 Add `consent_version` field to user tokens table
  - [x] 4.3 Create `audit_logs` table for content moderation tracking
  - [[x] 4.4 Add `processing_status` field to logbook entries
  - [x] 4.5 Update TypeScript interfaces in `src/shared/types.ts` for new schema
  - [x] 4.6 Implement audit log creation for all moderation actions
  - [x] 4.7 Add consent tracking with user token binding
  - [x] 4.8 Test migration on development database

- [x] 5.0 Create Frontend Consent Collection Interface
  - [x] 5.1 Create `src/frontend/src/components/ConsentForm.vue` component
  - [x] 5.2 Design age verification UI with clear 18+ confirmation
  - [x] 5.3 Build CC0 licensing explanation and consent interface
  - [x] 5.4 Add public-commons consent with educational content
  - [x] 5.5 Integrate Canadian Freedom of Panorama guidance links
  - [x] 5.6 Create consent versioning notification system
  - [x] 5.7 Add form validation and error handling
  - [x] 5.8 Integrate consent form with photo upload workflow

- [ ] 6.0 Implement Advanced Photo Processing Pipeline
  - [x] 6.1 Enhance `src/workers/lib/photos.ts` with advanced processing options
  - [x] 6.2 Add intelligent file format optimization (60% average size reduction target)
  - [x] 6.3 Implement responsive image variant generation (200px, 400px, 800px, 1200px)
  - [x] 6.4 Add progressive loading metadata generation (aspect ratios, dominant colors)
  - [x] 6.5 Optimize upload performance for files up to 15MB
  - [x] 6.6 Implement batch processing for multiple photo submissions
  - [x] 6.7 Add comprehensive photo migration utilities for approval workflow
  - [x] 6.8 Create photo cleanup system for rejected submissions

- [x] 7.0 Add Comprehensive Testing Infrastructure
  - [x] 7.1 Create `src/workers/lib/photos.test.ts` for photo processing unit tests
  - [x] 7.2 Create `src/workers/lib/exif.test.ts` for EXIF handling unit tests
  - [x] 7.3 Create `src/workers/lib/consent.test.ts` for consent system unit tests
  - [x] 7.4 Add integration tests for end-to-end photo submission workflow
  - [x] 7.5 Implement rate limiting accuracy tests under concurrent load
  - [x] 7.6 Create Cloudflare Images integration tests with mock API responses
  - [x] 7.7 Add spatial query performance tests with large datasets
  - [x] 7.8 Implement load testing for burst photo upload scenarios
