# PRD: Worker API Endpoints (Cloudflare Workers)

## Introduction/Overview

This PRD defines the implementation of minimal, typed JSON APIs for the Cultural
Archiver MVP using Cloudflare Workers. The API provides endpoints for community
art submissions, artwork discovery, user management, and moderation workflows.
The system enables crowdsourced public art mapping with a focus on mobile-first
submission workflows and efficient moderation processes.

**Problem Statement:** The current Cultural Archiver application lacks backend
API endpoints to handle artwork submissions, user authentication, photo
processing, and moderation workflows.

**Goal:** Implement a complete REST API that enables the frontend to submit
artwork entries, discover nearby artworks, manage user sessions, and provide
moderation tools for reviewers.

## Goals

1. **Enable Community Submissions**: Provide robust endpoints for users to
   submit artwork with photos, location, and metadata
2. **Support Artwork Discovery**: Implement geospatial search for finding
   approved artworks near specific locations
3. **Facilitate User Management**: Handle anonymous user tokens and optional
   email verification via magic links
4. **Enable Moderation Workflows**: Provide reviewer tools for
   approving/rejecting submissions and managing artwork lifecycle
5. **Ensure Performance & Reliability**: Implement rate limiting, error
   handling, and efficient database queries
6. **Maintain Data Integrity**: Validate inputs, process photos consistently,
   and maintain referential integrity

## User Stories

### Community Users

- **As a community member**, I want to submit artwork photos and details so that
  I can contribute to the public art map
- **As a mobile user**, I want to upload photos directly from my camera so that
  I can quickly document artwork I encounter
- **As a contributor**, I want to see my submission status so that I know when
  my artwork appears on the public map
- **As a user**, I want to find artwork near my location so that I can discover
  public art in my area

### Reviewers

- **As a reviewer**, I want to see pending submissions in order so that I can
  efficiently moderate content
- **As a reviewer**, I want to approve submissions and create artwork entries so
  that quality content appears on the public map
- **As a reviewer**, I want to reject inappropriate submissions so that the
  platform maintains content quality
- **As a reviewer**, I want to see nearby existing artwork when reviewing
  submissions so that I can avoid duplicates

### System Users

- **As a user**, I want to optionally verify my email so that I can recover
  access to my submissions
- **As a user**, I want consistent error messages so that I understand what went
  wrong and how to fix it

## Functional Requirements

### 1. Submission Endpoints

#### 1.1 POST /api/logbook - Create Submission

- **Must** accept JSON body with required fields: `lat` (number), `lon` (number)
- **Must** accept optional fields: `note` (string, ≤500 chars), `type` (string),
  `photos` (array, max 3 files)
- **Must** validate coordinates are valid lat/lon globally (-90 to 90, -180
  to 180)
- **Must** enforce photo limits: max 3 photos, max 15MB each
- **Must** accept any image format and convert to JPEG/PNG as needed
- **Must** generate anonymous user token (UUID) on first visit if none exists
- **Must** store original photos in R2 at
  `originals/YYYY/MM/{timestamp}-{uuid}.{ext}`
- **Must** generate 800px thumbnails (longest edge) in R2 at
  `thumbs/YYYY/MM/{timestamp}-{uuid}.jpg`
- **Must** preserve all original EXIF data and add permalink in EXIF comment
  field
- **Must** create logbook entry with status 'pending'
- **Must** return submission ID and status

#### 1.2 Photo Processing Pipeline

- **Must** validate file types using MIME type detection
- **Must** sanitize filenames using timestamp + UUID format:
  `{timestamp}-{uuid}.{ext}`
- **Must** maintain aspect ratio when resizing to 800px longest edge
- **Must** store photos in date-based folder structure: `YYYY/MM/`
- **Must** write permalink URL to EXIF comment field on both original and
  thumbnail
- **Must** handle upload failures gracefully and cleanup partial uploads

### 2. Discovery Endpoints

#### 2.1 GET /api/artworks/nearby - Find Nearby Artworks

- **Must** accept query parameters: `lat` (required), `lon` (required), `radius`
  (optional, default 500m), `limit` (optional, default 20)
- **Must** validate latitude/longitude parameters
- **Must** use bounding box spatial queries for performance
- **Must** return only approved artwork (status = 'approved')
- **Must** include artwork basic info: id, lat, lon, type, creation date
- **Must** include most recent photo URL if available
- **Must** support configurable limit parameter (max 100)
- **Must** return results in JSON array format

#### 2.2 GET /api/artworks/:id - Artwork Details

- **Must** accept artwork ID as URL parameter
- **Must** return complete artwork details including metadata
- **Must** include logbook timeline sorted newest-first
- **Must** include all approved photos
- **Must** return 404 for non-existent or non-approved artwork
- **Must** include related tags and type information

### 3. User Management Endpoints

#### 3.1 GET /api/me/submissions - User's Submissions

- **Must** identify user by UUID cookie/token
- **Must** return user's pending and approved submissions
- **Must** exclude rejected submissions from response
- **Must** include submission status and creation timestamps
- **Must** support pagination with default limit of 20

#### 3.2 POST /api/auth/magic-link - Request Email Verification

- **Must** accept email address in request body
- **Must** validate email format
- **Must** generate secure magic link token with expiration
- **Must** send HTML email using Cloudflare Email Workers
- **Must** use simple HTML template with verification link
- **Must** return success response without revealing if email exists

#### 3.3 POST /api/auth/consume - Verify Magic Link

- **Must** accept magic link token from email
- **Must** validate token and check expiration
- **Must** bind verified email to current user token
- **Must** return success/failure status
- **Must** invalidate magic link token after use

### 4. Moderation Endpoints

#### 4.1 POST /api/review/approve - Approve Submission

- **Must** require reviewer permissions (database flag on user record)
- **Must** accept submission ID and optional artwork details
- **Must** check for nearby existing artwork (within ~100m) and show to reviewer
- **Must** either link submission to existing artwork or create new artwork
- **Must** use submission data as defaults, allow reviewer to edit details
- **Must** update submission status to 'approved'
- **Must** create or update artwork with status 'approved'
- **Must** handle photo migration from submission to artwork

#### 4.2 POST /api/review/reject - Reject Submission

- **Must** require reviewer permissions
- **Must** accept submission ID and optional rejection reason
- **Must** update submission status to 'rejected'
- **Must** delete associated photos from R2 (originals and thumbnails)
- **Must** log rejection reason for audit purposes
- **Must** prevent rejected submissions from appearing in user's submission list

### 5. Duplicate Detection (User-Facing)

#### 5.1 Nearby Artwork Warning During Submission

- **Must** show nearby artwork (within 500m) when user submits at similar
  location
- **Must** display cards with photos and basic info of nearby artwork
- **Must** allow user to confirm "this is different artwork"
- **Must** create separate logbook entry if user confirms it's different
- **Must** provide clear UI for user decision

## Non-Goals (Out of Scope)

1. **Advanced Content Moderation**: Virus scanning, inappropriate image
   detection (future versions)
2. **Automatic Duplicate Detection**: No automated merging or duplicate flagging
   for MVP
3. **Real-time Notifications**: Push notifications or real-time updates
4. **Advanced Analytics**: Detailed usage tracking beyond basic Cloudflare
   analytics
5. **API Versioning**: No version management during MVP phase
6. **Complex User Roles**: Only basic reviewer flag, no role-based permissions
7. **Caching Layer**: All queries real-time for MVP
8. **Geographic Restrictions**: Accept submissions globally, no region limiting
9. **Advanced Email Features**: No email preferences, unsubscribe, or rich
   templates

## Technical Considerations

### Database Schema Requirements

- **Must** use existing MVP schema: artwork, logbook, tags, artwork_types tables
- **Must** maintain foreign key relationships and cascade deletes
- **Must** use spatial indexes for lat/lon queries
- **Must** handle JSON fields for tags and photos arrays

### Rate Limiting Implementation

- **Must** implement per-user-token rate limiting using Cloudflare KV
- **Must** enforce 10 submissions per day per user token
- **Must** enforce 60 nearby queries per hour per user token
- **Must** return HTTP 429 with Retry-After header when limits exceeded
- **Must** provide clear error messages about rate limit timing

### Error Handling Standards

- **Must** return all validation errors at once for better UX
- **Must** use progressive disclosure: simple message with "show details" option
- **Must** return data directly on success, error object on failure
- **Must** include detailed error information in development/testing
- **Must** provide user-friendly messages in production

### Security Measures

- **Must** validate all input parameters and sanitize data
- **Must** use secure file upload practices and safe filename generation
- **Must** implement CORS properly for frontend integration
- **Must** prevent SQL injection through parameterized queries
- **Must** validate file types through MIME detection, not just extensions

### Cloudflare Integration

- **Must** use Cloudflare D1 for database operations
- **Must** use Cloudflare R2 for photo storage
- **Must** use Cloudflare KV for rate limiting counters
- **Must** use Cloudflare Email Workers for magic link emails
- **Must** configure Cloudflare Workers Analytics for monitoring

## Design Considerations

### API Response Format

```typescript
// Success responses return data directly
{
  "id": "artwork-123",
  "lat": 49.2827,
  "lon": -123.1207,
  "status": "approved"
}

// Error responses use consistent format
{
  "error": "Validation failed",
  "message": "Please check your input and try again",
  "details": {
    "validation_errors": [
      {"field": "lat", "message": "Latitude must be between -90 and 90"},
      {"field": "photos", "message": "Maximum 3 photos allowed"}
    ]
  },
  "show_details": true
}
```

### File Storage Structure

```text
R2 Bucket Layout:
originals/
  2025/
    08/
      1724875200-abc123.jpg
      1724875201-def456.png
thumbs/
  2025/
    08/
      1724875200-abc123.jpg
      1724875201-def456.jpg
```

### Reviewer Queue Management

- **Must** use simple FIFO ordering for review queue
- **Must** implement database flag `is_reviewer` on user records
- **Must** show pending submissions with creation timestamps
- **Must** provide clear approve/reject interface

## Success Metrics

1. **API Reliability**: 99.9% uptime for all endpoints
2. **Response Performance**: <500ms average response time for all endpoints
3. **Photo Processing**: 100% successful processing of valid image uploads
4. **Rate Limiting Effectiveness**: <1% false positive rate on legitimate usage
5. **Error Handling**: <5% user confusion rate based on error message clarity
6. **Moderation Efficiency**: Reviewers can process submissions in <2 minutes
   average
7. **Data Integrity**: 0% data corruption or orphaned records

## Open Questions

1. **Cloudflare Email Workers Availability**: Need to verify current status and
   setup requirements for magic link emails
2. **R2 Storage Costs**: Should we implement automatic cleanup of old rejected
   submissions?
3. **Geographic Accuracy**: Should we implement more precise distance
   calculations in future iterations?
4. **Review Queue Scalability**: How will we handle reviewer queue when
   submission volume grows?
5. **Token Persistence**: Should anonymous tokens be stored in database or
   remain stateless?
6. **Error Logging Correlation**: Do we need request correlation IDs for
   debugging complex workflows?

## Implementation Notes

### Setup Requirements

1. **Cloudflare Workers Analytics**: Enable in Cloudflare dashboard under
   Workers > Analytics
2. **Cloudflare Email Workers**: Verify availability and configure SMTP settings
3. **Database Migrations**: Ensure MVP schema is deployed with proper indexes
4. **R2 Bucket**: Configure with public access for thumbnail serving
5. **KV Namespace**: Create for rate limiting counters

### Development Phases

1. **Phase 1**: Core CRUD operations (POST /logbook, GET /nearby, GET
   /artwork/:id)
2. **Phase 2**: Photo processing pipeline and R2 integration
3. **Phase 3**: User management and magic link authentication
4. **Phase 4**: Moderation endpoints and reviewer workflows
5. **Phase 5**: Rate limiting and error handling refinement

This PRD provides the complete specification for implementing the Worker API
endpoints that will power the Cultural Archiver MVP, with clear acceptance
criteria and technical requirements for a junior developer to implement
successfully.
