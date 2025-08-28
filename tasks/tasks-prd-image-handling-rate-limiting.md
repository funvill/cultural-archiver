# Task List: Image Handling & Rate Limiting System

Generated from `tasks\prd-image-handling-rate-limiting.md`

## Relevant Files

- `src/workers/lib/photos.ts` - Core photo processing utilities (502 lines, needs Cloudflare Images integration)
- `src/workers/lib/photos.test.ts` - Unit tests for photo processing utilities
- `src/workers/lib/exif.ts` - EXIF metadata handling utilities (to be created)
- `src/workers/lib/exif.test.ts` - Unit tests for EXIF utilities
- `src/workers/lib/consent.ts` - Consent collection and validation utilities (to be created)
- `src/workers/lib/consent.test.ts` - Unit tests for consent utilities
- `src/workers/routes/submissions.ts` - Submission handling with consent validation (to be modified)
- `src/workers/routes/auth.ts` - Authentication with consent tracking (365 lines, needs consent integration)
- `src/workers/middleware/consent.ts` - Consent validation middleware (to be created)
- `src/frontend/src/components/ConsentForm.vue` - Frontend consent collection interface (to be created)
- `src/frontend/src/components/PhotoUpload.vue` - Photo upload with consent flow (to be created)
- `migrations/003_consent_audit_schema.sql` - Database schema for consent and audit logging (to be created)
- `src/shared/types.ts` - TypeScript interfaces for consent and EXIF data (needs extension)
- `wrangler.toml` - Cloudflare Images configuration (needs Cloudflare Images setup)
- `docs/cloudflare-images-setup.md` - Documentation for Cloudflare Images configuration (to be created)

### Notes

- Unit tests should be placed alongside the code files they are testing
- Use `npm test` to run the complete test suite
- Cloudflare Images requires account-level configuration before code integration
- EXIF handling will require external library integration (exifr or piexifjs)

## Tasks

- [ ] 1.0 Integrate Cloudflare Images for Image Processing
  - [ ] 1.1 Configure Cloudflare Images in account dashboard and obtain API tokens
  - [ ] 1.2 Update `wrangler.toml` with Cloudflare Images environment variables and bindings
  - [ ] 1.3 Modify `src/workers/lib/photos.ts` to use Cloudflare Images API for optimization
  - [ ] 1.4 Implement thumbnail generation (800px long edge) using Cloudflare Images variants
  - [ ] 1.5 Add progressive JPEG and intelligent format selection (JPEG/PNG/WebP)
  - [ ] 1.6 Update photo URL generation to support Cloudflare Images transforms
  - [ ] 1.7 Implement fallback mechanism when Cloudflare Images is unavailable
  - [ ] 1.8 Add comprehensive error handling for Cloudflare Images API failures

- [ ] 2.0 Implement EXIF Metadata Preservation and Permalink System
  - [ ] 2.1 Create `src/workers/lib/exif.ts` for EXIF data extraction and modification
  - [ ] 2.2 Install and configure EXIF processing library (exifr or piexifjs)
  - [ ] 2.3 Implement GPS coordinate preservation from original photos
  - [ ] 2.4 Add permalink injection in EXIF comments using format `/p/artwork/{UUID}`
  - [ ] 2.5 Integrate EXIF processing into photo upload pipeline
  - [ ] 2.6 Create permalink redirect system for `/p/artwork/{UUID}` URLs
  - [ ] 2.7 Apply EXIF modifications to both original and thumbnail versions
  - [ ] 2.8 Add EXIF data validation and error handling

- [ ] 3.0 Build Comprehensive Consent Collection System
  - [ ] 3.1 Create `src/workers/lib/consent.ts` for consent validation and storage
  - [ ] 3.2 Design consent data structure with versioning support
  - [ ] 3.3 Implement age verification (18+ confirmation) logic
  - [ ] 3.4 Add CC0 metadata licensing consent collection
  - [ ] 3.5 Implement public-commons consent acknowledgment
  - [ ] 3.6 Create Canadian Freedom of Panorama guidance with external links
  - [ ] 3.7 Add consent versioning system with re-consent triggers
  - [ ] 3.8 Integrate consent validation into submission workflow

- [ ] 4.0 Enhance Database Schema for Audit Logging
  - [ ] 4.1 Create `migrations/003_consent_audit_schema.sql` migration file
  - [ ] 4.2 Add `consent_version` field to user tokens table
  - [ ] 4.3 Create `audit_logs` table for content moderation tracking
  - [ ] 4.4 Add `processing_status` field to logbook entries
  - [ ] 4.5 Update TypeScript interfaces in `src/shared/types.ts` for new schema
  - [ ] 4.6 Implement audit log creation for all moderation actions
  - [ ] 4.7 Add consent tracking with user token binding
  - [ ] 4.8 Test migration on development database

- [ ] 5.0 Create Frontend Consent Collection Interface
  - [ ] 5.1 Create `src/frontend/src/components/ConsentForm.vue` component
  - [ ] 5.2 Design age verification UI with clear 18+ confirmation
  - [ ] 5.3 Build CC0 licensing explanation and consent interface
  - [ ] 5.4 Add public-commons consent with educational content
  - [ ] 5.5 Integrate Canadian Freedom of Panorama guidance links
  - [ ] 5.6 Create consent versioning notification system
  - [ ] 5.7 Add form validation and error handling
  - [ ] 5.8 Integrate consent form with photo upload workflow

- [ ] 6.0 Implement Advanced Photo Processing Pipeline
  - [ ] 6.1 Enhance `src/workers/lib/photos.ts` with advanced processing options
  - [ ] 6.2 Add intelligent file format optimization (60% average size reduction target)
  - [ ] 6.3 Implement responsive image variant generation (200px, 400px, 800px, 1200px)
  - [ ] 6.4 Add progressive loading metadata generation (aspect ratios, dominant colors)
  - [ ] 6.5 Optimize upload performance for files up to 15MB
  - [ ] 6.6 Implement batch processing for multiple photo submissions
  - [ ] 6.7 Add comprehensive photo migration utilities for approval workflow
  - [ ] 6.8 Create photo cleanup system for rejected submissions

- [ ] 7.0 Add Comprehensive Testing Infrastructure
  - [ ] 7.1 Create `src/workers/lib/photos.test.ts` for photo processing unit tests
  - [ ] 7.2 Create `src/workers/lib/exif.test.ts` for EXIF handling unit tests
  - [ ] 7.3 Create `src/workers/lib/consent.test.ts` for consent system unit tests
  - [ ] 7.4 Add integration tests for end-to-end photo submission workflow
  - [ ] 7.5 Implement rate limiting accuracy tests under concurrent load
  - [ ] 7.6 Create Cloudflare Images integration tests with mock API responses
  - [ ] 7.7 Add spatial query performance tests with large datasets
  - [ ] 7.8 Implement load testing for burst photo upload scenarios
