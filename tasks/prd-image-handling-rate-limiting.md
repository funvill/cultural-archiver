# PRD: Image Handling & Rate Limiting System

## Introduction/Overview

This PRD defines the implementation of a robust image handling pipeline and rate
limiting system for the Cultural Archiver MVP. The image handling system will
process user-uploaded photos through client-side preparation and server-side
optimization, storing originals and thumbnails in Cloudflare R2 with proper EXIF
metadata management. The rate limiting system will protect against abuse while
ensuring legitimate users can contribute effectively to the cultural mapping
platform.

**Problem Statement:** The current system lacks proper image processing, storage
management, and abuse protection mechanisms needed for a production-ready
cultural archiving platform.

**Goal:** Implement secure, efficient image handling with comprehensive rate
limiting to enable reliable user contributions while preventing abuse and
ensuring legal compliance.

## Goals

1. **Reliable Image Processing**: Enable users to upload up to 3 photos per
   submission with automatic optimization and thumbnail generation
2. **Metadata Preservation**: Maintain EXIF data including GPS coordinates while
   adding permalink information for provenance
3. **Abuse Prevention**: Implement rate limiting to prevent spam and abuse while
   allowing legitimate usage
4. **Legal Compliance**: Ensure proper consent collection and Canadian Freedom
   of Panorama guidance
5. **Performance**: Optimize storage costs and delivery speed through efficient
   image formats and CDN integration
6. **User Experience**: Provide clear feedback on upload progress, rate limits,
   and consent requirements

## User Stories

### Image Handling

- **As a contributor**, I want to upload photos from my mobile device so that I
  can document public art while on location
- **As a contributor**, I want my photos to be automatically optimized for web
  viewing so that they load quickly for others
- **As a site visitor**, I want to see high-quality thumbnails in the map view
  so that I can quickly identify artwork
- **As a content moderator**, I want access to original photos so that I can
  verify submissions for accuracy

### Rate Limiting & Protection

- **As a platform operator**, I want to prevent spam submissions so that the
  quality of the archive remains high
- **As a legitimate user**, I want clear feedback when I hit rate limits so that
  I understand when I can submit again
- **As a legal team member**, I want proper consent collection so that we can
  use submitted content legally
- **As a content moderator**, I want audit trails for takedowns so that we can
  respond to legal requests

## Functional Requirements

### Client-Side Image Handling

1. **Photo Selection and Validation** 1.1. The system must allow users to select
   up to 3 photos per submission 1.2. The system must validate file headers for
   supported formats (JPEG, PNG, WebP, HEIC) 1.3. The system must reject files
   exceeding 15MB with clear error messaging 1.4. The system must display upload
   progress to users 1.5. The system must upload original files directly to the
   server without client-side processing

### Server-Side Processing

2. **Image Processing with Cloudflare Images** 2.1. The system must use
   Cloudflare Images for all image processing and optimization 2.2. The system
   must generate thumbnails at 800px long edge with optimal compression 2.3. The
   system must preserve original files in R2 storage 2.4. The system must use
   progressive JPEG encoding when it provides better compression 2.5. The system
   must convert images with transparency to PNG, others to JPEG with white
   background when PNG would be significantly larger 2.6. The system must handle
   file size reduction automatically through Cloudflare Images optimization

3. **EXIF Metadata Management** 2.1. The system must preserve original EXIF data
   including GPS coordinates 2.2. The system must add permalink information in
   EXIF comments using format `/p/artwork/{UUID}` 2.3. The system must apply
   EXIF modifications to both original and thumbnail versions 2.4. The system
   must redirect permalink URLs to the appropriate artwork detail page

4. **Storage Organization** 3.1. The system must store files in R2 with
   structure `/originals/{year}/{month}/{uuid}.jpg` and
   `/thumbs/{year}/{month}/{uuid}.jpg` 3.2. The system must implement
   appropriate CDN caching headers for thumbnail delivery 3.3. The system must
   retry R2 uploads automatically on failure 3.4. The system must set R2 public
   access policies for thumbnail delivery

### Rate Limiting & Abuse Protection

1. **Rate Limiting Implementation** 1.1. The system must limit `/nearby`
   requests to 100 per hour per IP address using sliding windows 1.2. The system
   must limit `/submit` requests to 10 per day per IP address using sliding
   windows 1.3. The system must use Cloudflare KV for counter storage 1.4. The
   system must fail open if KV counter reads fail due to eventual consistency
   1.5. The system must return HTTP 429 status codes with descriptive error
   messages for rate limit violations

2. **Content Moderation** 2.1. The system must rely on user reports for
   NSFW/illegal content detection 2.2. The system must allow only moderators to
   execute takedown requests 2.3. The system must perform hard deletion of
   content and associated R2 files 2.4. The system must create audit logs for
   all takedown actions with reason codes 2.5. The system must retain metadata
   (timestamp, reason) for legal compliance after content deletion

3. **Consent & Age Verification** 3.1. The system must require users to confirm
   they are 18+ before submission 3.2. The system must require CC0 metadata
   licensing consent 3.3. The system must require public-commons consent
   acknowledgment 3.4. The system must provide Canadian Freedom of Panorama
   guidance via external links 3.5. The system must store consent preferences
   tied to user accounts until explicitly revoked 3.6. The system must version
   consent requirements and require re-consent when terms change

4. **Error Handling & Logging** 4.1. The system must log rate limit violations
   for monitoring purposes when easily implementable 4.2. The system must
   provide "retry later" suggestions for rate-limited users 4.3. The system must
   always require consent checkboxes (no dismissible option) 4.4. The system
   must preserve pending submissions even if users are blocked for abuse

## Non-Goals (Out of Scope)

- Progressive loading/upload during photo selection (deferred to post-MVP)
- Client-side image resizing or compression (handled entirely by Cloudflare
  Images)
- AI/ML-based content moderation (relying on user reports)
- Different rate limits for authenticated vs anonymous users
- Burst allowance rate limiting mechanisms
- Retry-after headers for rate limit responses
- Complex takedown categorization (copyright, privacy, etc.)
- Client-side EXIF data stripping based on user preferences
- Soft delete functionality for content removal

## Technical Considerations

### Dependencies

- **Cloudflare Images**: Primary image processing service ⚠️ *TO BE INTEGRATED*
- **Cloudflare R2**: Object storage for originals and thumbnails ✅ *IMPLEMENTED - PHOTOS bucket configured*
- **Cloudflare KV**: Rate limiting counter storage ✅ *IMPLEMENTED - RATE_LIMITS namespace configured*
- **Cloudflare D1**: User consent and audit log storage ✅ *IMPLEMENTED - database schema ready*

### Integration Points

- Must integrate with existing `LogbookRecord.photos` JSON array field ✅ *IMPLEMENTED*
- Must integrate with existing user token system for consent management ✅ *IMPLEMENTED*
- Must extend existing API error handling patterns ✅ *IMPLEMENTED*
- Must work with existing TypeScript types in `src/shared/types.ts` ✅ *IMPLEMENTED*

### Performance Considerations

- Implement sliding window rate limiting to distribute load ✅ *IMPLEMENTED*
- Use CDN caching for thumbnail delivery ⚠️ *TO BE IMPLEMENTED with Cloudflare Images*
- Optimize R2 storage costs through intelligent format selection ⚠️ *TO BE IMPLEMENTED*
- Batch audit log writes to reduce D1 overhead ⚠️ *TO BE IMPLEMENTED*

### Current Implementation Status

**✅ Completed Components:**

- Rate limiting middleware with sliding windows using KV storage
- Photo upload to R2 with timestamp-UUID filename generation
- User token authentication and authorization
- API request/response validation using Zod schemas
- Error handling with consistent response formatting
- Basic photo processing pipeline (original storage only)

**⚠️ Partially Implemented:**

- Photo processing (missing thumbnail generation and Cloudflare Images integration)
- Content moderation (reviewer middleware exists, but no takedown workflows)
- Audit logging (basic logging exists, but no structured audit trails)

**❌ Not Yet Implemented:**

- EXIF metadata preservation and permalink injection
- Cloudflare Images integration for automatic optimization
- Consent collection and versioning system
- Magic link authentication endpoints
- Comprehensive content moderation workflows

## Success Metrics

1. **Upload Success Rate**: >95% of valid image uploads complete successfully
2. **Processing Time**: <10 seconds average time from upload to thumbnail
   availability
3. **Storage Efficiency**: Average 60% size reduction from original to optimized
   thumbnail
4. **Rate Limiting Effectiveness**: <5% false positive rate blocking legitimate
   users
5. **Abuse Prevention**: >90% reduction in spam submissions after implementation
6. **User Compliance**: 100% consent collection rate for submissions
7. **Legal Response Time**: <24 hours to execute valid takedown requests

## Open Questions

1. Should we implement image duplicate detection using perceptual hashing in the
   initial release?
2. What specific external resources should we link to for Canadian Freedom of
   Panorama guidance?
3. Should we provide more granular rate limiting controls for different user
   types in the future?
4. How should we handle edge cases where Cloudflare Images service is
   temporarily unavailable?
5. Should consent versioning trigger re-approval of pending submissions, or
   grandfather existing ones?

## Implementation Notes

### Database Schema Updates

- Add `consent_version` field to user tokens ❌ *NOT IMPLEMENTED*
- Create `audit_logs` table for takedown tracking ❌ *NOT IMPLEMENTED*
- Add `processing_status` field to logbook entries for upload state tracking ❌ *NOT IMPLEMENTED*

### API Endpoints Affected

- `POST /api/logbook` - Add image processing and rate limiting ✅ *IMPLEMENTED - basic functionality*
- `GET /api/artworks/nearby` - Add rate limiting ✅ *IMPLEMENTED*
- `POST /api/review/approve` - Add consent version checks ❌ *NOT IMPLEMENTED*
- `POST /api/review/reject` - Add hard delete with audit logging ❌ *NOT IMPLEMENTED*

### Configuration Requirements

- Cloudflare Images API configuration ❌ *NOT CONFIGURED*
- R2 bucket policies and CDN settings ✅ *IMPLEMENTED - PHOTOS bucket configured*
- KV namespace setup for rate limiting ✅ *IMPLEMENTED - RATE_LIMITS namespace*
- External link configuration for FoP resources ❌ *NOT IMPLEMENTED*

### Next Steps for Completion

**High Priority:**

1. **Integrate Cloudflare Images** - Replace basic R2 storage with Cloudflare Images for automatic optimization
2. **Implement thumbnail generation** - Create 800px thumbnails using Cloudflare Images API
3. **Add EXIF handling** - Preserve GPS data and inject permalink URLs in EXIF comments

**Medium Priority:**

1. **Implement consent system** - Add age gate, CC0 licensing, and FoP acknowledgment
2. **Create audit logging** - Structured logs for content moderation actions
3. **Add magic link auth** - Email verification for optional user accounts

**Low Priority:**

1. **Enhanced moderation** - Takedown workflows and reviewer queue management
2. **Performance optimization** - CDN configuration and intelligent format selection
