# Cultural Archiver API Documentation

The Cultural Archiver Worker API provides a **production-ready** comprehensive backend for crowdsourced public art mapping with an ultra-fast photo-first submission workflow. This API is built using Hono with TypeScript and runs on Cloudflare Workers, integrating with D1 (database), KV (rate limiting & sessions), and R2 (photo storage).

## 🚀 Current Status: Production Ready

- **✅ Complete Fast Photo Workflow**: 3-screen submission process with intelligent duplicate detection
- **✅ Database Infrastructure**: Full migration system with spatial indexing operational
- **✅ Real Photo Processing**: EXIF extraction, R2 storage, and thumbnail generation
- **✅ Similarity Engine**: Multi-signal matching (location + title + tags) reduces duplicates by ≥30%
- **✅ 539 Passing Tests**: Comprehensive test coverage across all endpoints and functionality
- **✅ Production Deployment**: Hosted on Cloudflare infrastructure with enterprise-grade reliability

## Base URL

```http
https://art-api.abluestar.com
```

## Rate Limiting

- **Submissions**: 10 per day per user token
- **Queries**: 60 per hour per user token

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1640995200
```

## Response Format

All responses follow a consistent JSON format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": null
  }
}
```

## Mass-Import API

For trusted, high-volume imports of artworks, the Cultural Archiver provides two mass-import endpoints:

### Mass-Import V2 (Recommended)

New unified endpoint with CLI plugin integration and enhanced validation.

```http
POST /api/mass-import/v2
```

**Authentication**: Admin token required  
**Content-Type**: `application/json`

**Request Body**:

```json
{
  "items": [
    {
      "artwork": {
        "title": "Artwork Title",
        "description": "Description...",
        "lat": 49.2827,
        "lon": -123.1207,
        "tags": {
          "material": "bronze",
          "artwork_type": "statue"
        }
      },
      "artist": {
        "name": "Artist Name",
        "bio": "Artist biography..."
      },
      "photos": [
        {
          "url": "https://example.com/photo.jpg",
          "caption": "Photo description"
        }
      ]
    }
  ],
  "source": {
    "name": "Vancouver Open Data",
    "url": "https://data.vancouver.ca/",
    "license": "CC BY 4.0"
  }
}
```

**Features**:

- ✅ Unified schema validation
- ✅ CLI plugin integration support
- ✅ Enhanced duplicate detection
- ✅ Batch processing with atomic transactions
- ✅ Comprehensive audit logging

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "import_id": "import-uuid",
    "items_processed": 120,
    "items_created": 118,
    "items_updated": 2,
    "errors": [],
    "created_at": "2025-09-22T12:00:00Z"
  }
}
```

### Mass-Import V1 (Legacy)

Original endpoint for backward compatibility.

```http
POST /api/mass-import
```

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "import_id": "legacy-import-uuid",
    "items_processed": 50,
    "items_created": 50,
    "errors": []
  }
}
```

## Consent System

All content submission endpoints implement a **consent-first pattern** where user consent must be recorded before any content creation occurs. This ensures legal compliance and provides a complete audit trail.

### Consent Requirements

- **Legal Agreement**: Users must agree to terms and conditions before submitting content
- **Version Tracking**: Consent is linked to specific versions of legal documents
- **Content Specificity**: Each piece of content (artwork/logbook) requires separate consent
- **Audit Trail**: Complete record of what users agreed to and when

### Consent Flow

1. **User submits content**: Through any submission endpoint
2. **Consent recorded**: System automatically records consent with cryptographic hash
3. **Content created**: Only proceeds if consent recording succeeds
4. **Response includes**: Consent ID for audit purposes

### Consent Blocking

Submissions will be **blocked** with a `409 Conflict` response if consent cannot be recorded:

```json
{
  "success": false,
  "error": {
    "message": "Submission blocked: Consent could not be recorded",
    "code": "SUBMISSION_BLOCKED",
    "details": {
      "message": "Your consent is required before submitting content",
      "consentVersion": "2025-09-09.v2"
    }
  }
}
```

### Consent Data

Each consent record includes:

- **User Identity**: Authenticated UUID or anonymous token
- **Content Type**: `"artwork"` or `"logbook"`
- **Content ID**: UUID of the specific content
- **Consent Version**: Version of legal terms agreed to
- **Timestamp**: Exact time of consent (ISO 8601)
- **IP Address**: For audit trail and abuse prevention
- **Content Hash**: SHA-256 hash of consent text for integrity

**See Also:** [Consent System Documentation](./consent-system.md) for detailed technical implementation.

## Endpoints

### Unified Submission System

The Cultural Archiver uses a unified submission system where all content submissions (photo submissions, artwork edits, artist edits, new artwork/artist submissions) flow through both legacy and new endpoints. The system provides consistent handling, validation, and moderation workflows.

#### Submit Content (Legacy Logbook Endpoint)

The primary endpoint for photo submissions and artwork creation.

```http
POST /api/logbook
```

**Content-Type**: `multipart/form-data`

**Authentication**: Required

**Parameters**:

- `lat` (required): Latitude (-90 to 90)
- `lon` (required): Longitude (-180 to 180)
- `note` (optional): Description (max 500 characters)
- `photos` (optional): Up to 3 image files (15MB each, JPEG/PNG/WebP/GIF)
- `tags` (optional): JSON object with structured metadata
- `email` (optional): Email for verification workflow
- `submitter_name` (optional): Submitter name

**Response** (201 Created - Sample):

```json
{
  "success": true,
  "data": {
    "submission_id": "submission-uuid",
    "type": "logbook",
    "status": "pending",
    "verification_status": "pending",
    "nearby_artworks": [
      {
        "id": "artwork-uuid",
        "distance_km": 0.12,
        "title": "Downtown Mural",
        "photos": ["https://art-photos.abluestar.com/photo.jpg"]
      }
    ],
    "created_at": "2025-09-22T12:05:00Z"
  }
}
```

#### Submit New Content (Unified Submissions)

Submit various types of content for community review through the unified submission system.

```http
POST /api/submissions
```

**Content-Type**: `multipart/form-data`

**Authentication**: Required

**Parameters**:

- `submission_type` (required): Type of submission
  - `artwork_photos` - Photo submission for existing or new artwork
  - `artwork_edit` - Edit to artwork metadata
  - `artist_edit` - Edit to artist information
  - `new_artwork` - New artwork submission
  - `new_artist` - New artist profile submission
  - `logbook` - Log a visit to an existing artwork with photo proof
- `lat` (required for location-based submissions): Latitude (-90 to 90)
- `lon` (required for location-based submissions): Longitude (-180 to 180)
- `artwork_id` (required for artwork_edit/artwork_photos): Target artwork UUID
- `artist_id` (required for artist_edit): Target artist UUID
- `notes` (optional): Description (max 500 characters)
- `photos` (optional): Up to 3 image files (15MB each, JPEG/PNG/WebP/GIF)
- `tags` (optional): JSON object with structured metadata
- `old_data` (required for edits): JSON object of current data
- `new_data` (required for edits): JSON object of proposed changes
- `email` (optional): Email for verification workflow
- `submitter_name` (optional): Submitter name

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "submission_id": "uuid-string",
    "submission_type": "artwork_photos",
    "status": "pending",
    "verification_status": "pending",
    "nearby_artworks": [
      {
        "id": "artwork-uuid",
        "distance_km": 0.15,
        "title": "Downtown Mural",
        "photos": ["https://art-photos.abluestar.com/photo.jpg"]
      }
    ],
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Example - Photo Submission**:

```javascript
const formData = new FormData();
formData.append('submission_type', 'artwork_photos');
formData.append('lat', '49.2827');
formData.append('lon', '-123.1207');
formData.append('notes', 'Beautiful mural on building wall');
formData.append('photos', fileInput.files[0]);
formData.append(
  'tags',
  JSON.stringify({
    artwork_type: 'mural',
    material: 'paint',
  })
);

const response = await fetch('/api/submissions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-user-token',
  },
  body: formData,
});
```

**Example - Artwork Edit**:

```javascript
const formData = new FormData();
formData.append('submission_type', 'artwork_edit');
formData.append('artwork_id', 'artwork-uuid');
formData.append(
  'old_data',
  JSON.stringify({
    title: 'Old Title',
    description: 'Old description',
  })
);
formData.append(
  'new_data',
  JSON.stringify({
    title: 'Corrected Title',
    description: 'Updated description with more details',
  })
);

const response = await fetch('/api/submissions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-user-token',
  },
  body: formData,
});
```

**Example - Logbook Entry**:

```javascript
const formData = new FormData();
formData.append('submissionType', 'logbook');
formData.append('artworkId', 'artwork-uuid');
formData.append('lat', '49.2827');
formData.append('lon', '-123.1207');
formData.append('photos', fileInput.files[0]); // Required: proof of visit
formData.append('condition', 'Good'); // Optional condition assessment
formData.append('notes', 'Visited on sunny day, artwork in great condition');
// Optional improvement fields (only if missing from artwork)
formData.append('artist', 'Artist Name');
formData.append('material', 'Bronze');

const response = await fetch('/api/submissions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-user-token',
  },
  body: formData,
});
```

**Logbook Submission Details**:

- **Purpose**: Document visits to existing artworks with photo proof

- **Cooldown**: 30-day cooldown period per artwork per user

- **Photo Required**: At least one photo is mandatory as proof of visit

- **Condition Assessment**: Optional multiple-choice question (Good/Damaged/Missing/Removed)

- **Improvement Fields**: Only shown if artwork data is missing (type, access, artist, material)

- **Response**: Returns 429 Too Many Requests if user is on cooldown

**Error Response - Cooldown**:

```json
{
  "success": false,
  "error": "COOLDOWN_ACTIVE",
  "message": "You can only submit one logbook entry per artwork every 30 days. Please try again after 2025-10-19.",
  "details": {
    "cooldownUntil": "2025-10-19T07:00:00.000Z",
    "retryAfter": 2592000
  }
}
```

### Discovery Endpoints

#### Search Nearby Artworks

Find artworks within a specified radius.

```http
GET /api/artworks/nearby
```

**Parameters**:

- `lat` (required): Center latitude
- `lon` (required): Center longitude
- `radius` (optional): Search radius in meters (50-10000, default: 500)
- `limit` (optional): Maximum results (1-100, default: 20)
- `minimal` (optional): When `true` or `1`, return a compact payload optimized for map pins. Only includes `id`, `lat`, `lon`, `type_name`, and optional `recent_photo`.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "artworks": [
      {
        "id": "artwork-uuid",
        "lat": 49.2827,
        "lon": -123.1207,
        "type_name": "Public Art",
        "status": "approved",
        "distance_km": 0.15,
        "photos": ["https://art-photos.abluestar.com/2024/01/15/photo.jpg"],
        "recent_submissions": 3,
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "query": {
      "center": { "lat": 49.2827, "lon": -123.1207 },
      "radius_km": 0.5,
      "total_found": 1
    }
  }
}
```

**Example**:

```javascript
const response = await fetch(`/api/artworks/nearby?lat=49.2827&lon=-123.1207&radius=1000&limit=20`);
```

##### Minimal mode (map pins)

Use minimal mode to reduce payload when you only need pin coordinates and basic type for rendering a dense map.

```http
GET /api/artworks/nearby?lat=49.2827&lon=-123.1207&radius=1000&limit=250&minimal=true
```

###### Response (minimal=true)

```json
{
  "success": true,
  "data": {
    "artworks": [
      {
        "id": "artwork-uuid",
        "lat": 49.2827,
        "lon": -123.1207,
        "type_name": "Public Art",
        "recent_photo": "https://art-photos.abluestar.com/2024/01/15/photo.jpg"
      }
    ],
    "search_center": { "lat": 49.2827, "lon": -123.1207 },
    "search_radius": 1000,
    "total": 1
  }
}
```

Notes:

- `recent_photo` may be null or omitted if not available.
- Minimal mode skips heavy aggregation to improve latency and throughput, ideal for map pin rendering and client-side caching.

#### Advanced Search

Search artworks using text queries and structured tag filters with enhanced relevance scoring.

```http
GET /api/search
```

**Parameters**:

- `q` (required): Search query with support for:
  - Text search: `"mural downtown"`
  - Tag filters: `"tag:artwork_type:statue"`
  - Tag keys: `"tag:artist_name"`
  - Combined: `"banksy tag:year:2020"`
- `lat` (optional): Center latitude for geographic relevance
- `lon` (optional): Center longitude for geographic relevance
- `radius` (optional): Geographic search radius in meters (default: 10000)
- `limit` (optional): Maximum results (1-100, default: 20)
- `offset` (optional): Result offset for pagination (default: 0)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "artworks": [
      {
        "id": "artwork-uuid",
        "lat": 49.2827,
        "lon": -123.1207,
        "type_name": "Street Art",
        "status": "approved",
        "distance_km": 0.15,
        "photos": ["https://art-photos.abluestar.com/photo.jpg"],
        "tags": {
          "artwork_type": "mural",
          "artist_name": "banksy",
          "year": "2020",
          "material": "paint"
        },
        "relevance_score": 0.95,
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "query": {
      "text": "banksy tag:year:2020",
      "parsed_tags": [{ "key": "year", "value": "2020" }],
      "center": { "lat": 49.2827, "lon": -123.1207 },
      "radius_km": 10,
      "total_found": 1
    },
    "suggestions": ["tag:artwork_type:mural", "tag:material:paint", "tag:artist_name:banksy"]
  }
}
```

**Search Examples**:

```javascript
// Find all statues
const response = await fetch('/api/search?q=tag:artwork_type:statue');

// Find bronze artworks by specific artist
const response = await fetch('/api/search?q=tag:material:bronze tag:artist_name:doe');

// Find murals from 2020 with text search
const response = await fetch('/api/search?q=mural tag:year:2020');

// Geographic search for accessible art
const response = await fetch('/api/search?q=tag:access:yes&lat=49.2827&lon=-123.1207&radius=1000');
```

#### Get Artwork Details

Retrieve detailed information about a specific artwork.

```http
GET /api/artworks/{id}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "artwork": {
      "id": "artwork-uuid",
      "lat": 49.2827,
      "lon": -123.1207,
      "type_name": "Public Art",
      "status": "approved",
      "photos": ["photo-url-1", "photo-url-2"],
      "tags": {
        "material": "bronze",
        "city": "vancouver",
        "province": "british_columbia",
        "country": "canada"
      },
      "tags_categorized": {
        "physical_properties": [{ "key": "material", "value": "bronze", "label": "Material" }],
        "location_details": [
          { "key": "city", "value": "vancouver", "label": "City" },
          { "key": "province", "value": "british_columbia", "label": "Province/State" },
          { "key": "country", "value": "canada", "label": "Country" }
        ]
      },
      "created_at": "2024-01-15T10:30:00Z"
    },
    "timeline": [
      {
        "id": "entry-uuid",
        "note": "Initial discovery",
        "photos": ["photo-url"],
        "user_token": "user-uuid",
        "created_at": "2024-01-15T10:30:00Z",
        "status": "approved"
      }
    ]
  }
}
```

#### Browse All Artworks

Get a paginated list of all approved artworks for browsing.

```http
GET /api/artworks
```

**Parameters**:

- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (10, 30, 50, default: 30)
- `sort` (optional): Sort order (`updated`, `title_asc`, `created`, default: `updated`)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "totalItems": 245,
    "currentPage": 1,
    "totalPages": 9,
    "items": [
      {
        "id": "artwork-uuid",
        "lat": 49.2827,
        "lon": -123.1207,
        "type_name": "Public Art",
        "status": "approved",
        "recent_photo": "https://art-photos.abluestar.com/2024/01/15/photo.jpg",
        "photo_count": 3,
        "title": "Victory Angel",
        "artist_name": "Jane Doe",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-02-10T14:20:00Z"
      }
    ]
  }
}
```

#### Browse All Artists

Get a paginated list of all artists with artwork counts.

```http
GET /api/artists
```

**Parameters**:

- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (10, 30, 50, default: 30)
- `sort` (optional): Sort order (`name`, `artwork_count`, `updated`, default: `name`)
- `search` (optional): Search by artist name

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "totalItems": 87,
    "currentPage": 1,
    "totalPages": 3,
    "items": [
      {
        "id": "artist-uuid",
        "name": "Jane Doe",
        "description": "Canadian sculptor known for...",
        "short_bio": "Canadian sculptor known for public art installations in Vancouver and...",
        "artwork_count": 12,
        "tags_parsed": {
          "country": "Canada",
          "website": "https://janedoe.art"
        },
        "created_at": "2024-01-10T08:00:00Z",
        "updated_at": "2024-02-15T12:30:00Z",
        "status": "active"
      }
    ]
  }
}
```

**Error Responses**:

- `404 Not Found`: Page number exceeds available pages
- `400 Bad Request`: Invalid parameters

### Tag and Metadata Endpoints

Structured tag metadata for an artwork is returned as part of the artwork detail payload. Use the artwork detail endpoint to view and edit tags (if you have permissions):

```http
GET /api/artworks/{id}
```

Editing tags is performed via the artwork edit/submission workflow (see `POST /api/submissions` with `submission_type=artwork_edit`) rather than a dedicated `/api/artworks/{id}/tags` endpoint.

Example: the `tags` object appears in the `GET /api/artworks/{id}` response under `data.tags`.

```json
{
  "success": true,
  "data": {
    "artwork_id": "artwork-uuid",
    "tags_updated": {
      "version": "1.0.0",
      "lastModified": "2024-12-19T12:00:00.000Z",
      "tags": {
        "artwork_type": "statue",
        "name": "Victory Angel",
        "artist_name": "Jane Doe",
        "material": "bronze",
        "height": 5.5,
        "condition": "excellent",
        "access": "yes",
        "year": "1995",
        "wikidata_id": "Q12345678"
      }
    },
    "validation_status": {
      "valid": true,
      "warnings": []
    }
  }
}
```

**Tag Schema Validation**:

The API validates tags against a predefined schema with 15 essential tags across 5 categories:

- **Artwork Classification**: `tourism`, `artwork_type`, `name`, `inscription`
- **Physical Properties**: `material`, `height`, `width`, `condition`
- **Historical Information**: `artist_name`, `year`, `heritage`
- **Location Details**: `access`, `operator`
- **Reference Data**: `website`, `wikidata_id`

**Validation Error Response** (400 Bad Request):

```json
{
  "success": false,
  "error": {
    "message": "Tag validation failed",
    "code": "VALIDATION_ERROR",
    "validationErrors": [
      {
        "field": "height",
        "message": "Must be a positive number",
        "code": "INVALID_NUMBER"
      },
      {
        "field": "year",
        "message": "Must be a valid year (1000-2025)",
        "code": "INVALID_YEAR"
      }
    ]
  }
}
```

### OpenStreetMap Export Endpoints

#### Export Single Artwork

Export a specific artwork in OpenStreetMap-compatible format.

```http
GET /api/artwork/{id}/export/osm
```

**Parameters**:

- `format` (optional): Export format - `json` (default), `xml`, or `validation`

**Response** (200 OK) - JSON format:

```json
{
  "success": true,
  "data": {
    "artwork": {
      "id": "artwork-123",
      "lat": 49.2827,
      "lon": -123.1207,
      "osm_tags": {
        "tourism": "artwork",
        "artwork_type": "statue",
        "name": "Victory Angel",
        "artist_name": "Jane Doe",
        "material": "bronze",
        "height": "5.5",
        "access": "yes",
        "ca:artwork_id": "artwork-123",
        "ca:source": "Cultural Archiver"
      }
    },
    "metadata": {
      "export_timestamp": "2024-12-19T20:15:00.000Z",
      "schema_version": "1.0.0"
    }
  }
}
```

**Response** - XML format (`?format=xml`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="Cultural Archiver">
  <node id="-1" lat="49.2827" lon="-123.1207">
    <tag k="tourism" v="artwork"/>
    <tag k="artwork_type" v="statue"/>
    <tag k="name" v="Victory Angel"/>
    <tag k="artist_name" v="Jane Doe"/>
    <tag k="material" v="bronze"/>
    <tag k="height" v="5.5"/>
    <tag k="access" v="yes"/>
    <tag k="ca:artwork_id" v="artwork-123"/>
    <tag k="ca:source" v="Cultural Archiver"/>
  </node>
</osm>
```

**Response** - Validation format (`?format=validation`):

```json
{
  "success": true,
  "data": {
    "artwork_id": "artwork-123",
    "validation": {
      "valid": true,
      "osm_compatible": true,
      "warnings": [],
      "errors": []
    },
    "osm_preview": {
      "tourism": "artwork",
      "artwork_type": "statue",
      "name": "Victory Angel"
    }
  }
}
```

#### Bulk Export Artworks

Export multiple artworks in OpenStreetMap-compatible format with filtering options.

```http
GET /api/export/osm
```

**Parameters**:

- `format` (optional): Export format - `json` (default) or `xml`
- `bounds` (optional): Geographic bounds as `north,west,south,east` (e.g., `49.3,-123.1,49.2,-123.0`)
- `artwork_ids` (optional): Comma-separated list of specific artwork IDs
- `limit` (optional): Maximum number of artworks (default: 1000, max: 5000)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "artworks": [
      {
        "id": "artwork-123",
        "lat": 49.2827,
        "lon": -123.1207,
        "osm_tags": {
          "tourism": "artwork",
          "artwork_type": "statue",
          "name": "Victory Angel",
          "ca:artwork_id": "artwork-123"
        }
      }
    ],
    "metadata": {
      "total_artworks": 1,
      "export_timestamp": "2024-12-19T20:15:00.000Z",
      "schema_version": "1.0.0",
      "bounds_used": "49.3,-123.1,49.2,-123.0"
    }
  }
}
```

#### Export Statistics

Get statistics about artwork data suitable for OpenStreetMap export.

```http
GET /api/export/osm/stats
```

**Parameters**:

- `bounds` (optional): Geographic bounds for filtering

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "total_artworks": 1250,
    "exportable_artworks": 987,
    "validation_summary": {
      "valid": 900,
      "warnings": 87,
      "errors": 0
    },
    "tag_coverage": {
      "name": 856,
      "artwork_type": 987,
      "material": 654,
      "artist_name": 432,
      "year": 378
    },
    "geographic_distribution": {
      "bounds": "49.2,-123.2,49.3,-123.1",
      "center": { "lat": 49.25, "lon": -123.15 }
    },
    "last_updated": "2024-12-19T20:15:00.000Z"
  }
}
```

### Consent System Endpoints

#### Record User Consent

Record user consent for content submission.

```http
POST /api/consent
```

**Authentication**: Required  
**Content-Type**: `application/json`

**Body**:

```json
{
  "content_type": "artwork",
  "content_id": "artwork-uuid",
  "consent_version": "2025-09-09.v2"
}
```

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "consent_id": "consent-uuid",
    "recorded_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Get User Consent Records

Retrieve user's consent history.

```http
GET /api/consent
```

**Authentication**: Required

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "consent_records": [
      {
        "id": "consent-uuid",
        "content_type": "artwork",
        "content_id": "artwork-uuid",
        "consent_version": "2025-09-09.v2",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

#### Get Consent Form Data

Get current consent form requirements.

```http
GET /api/consent/form-data
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "version": "2025-09-09.v2",
    "terms": {
      "cc0_license": "I agree to release my submissions under CC0 public domain",
      "terms_of_service": "I have read and agree to the Terms of Service",
      "photo_rights": "I confirm I have the right to submit these photos"
    }
  }
}
```

#### Delete User Consent

Remove user consent records (GDPR compliance).

```http
DELETE /api/consent
```

**Authentication**: Required

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "message": "Consent records deleted",
    "deleted_count": 5
  }
}
```

### Artists Endpoints

#### Get Artists List

Get a paginated list of all artists with artwork counts.

```http
GET /api/artists
```

**Parameters**:

- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (10, 30, 50, default: 30)
- `sort` (optional): Sort order (`name`, `artwork_count`, `updated`, default: `name`)
- `search` (optional): Search by artist name

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "totalItems": 87,
    "currentPage": 1,
    "totalPages": 3,
    "items": [
      {
        "id": "artist-uuid",
        "name": "Jane Doe",
        "description": "Canadian sculptor known for...",
        "short_bio": "Canadian sculptor known for public art installations in Vancouver and...",
        "artwork_count": 12,
        "tags_parsed": {
          "country": "Canada",
          "website": "https://janedoe.art"
        },
        "created_at": "2024-01-10T08:00:00Z",
        "updated_at": "2024-02-15T12:30:00Z",
        "status": "active"
      }
    ]
  }
}
```

#### Get Artist Profile

Get detailed information about a specific artist.

```http
GET /api/artists/{id}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "artist": {
      "id": "artist-uuid",
      "name": "Jane Doe",
      "bio": "Comprehensive artist biography...",
      "website": "https://janedoe.art",
      "tags": {
        "country": "Canada",
        "birth_year": "1975",
        "medium": "sculpture"
      },
      "created_at": "2024-01-10T08:00:00Z",
      "updated_at": "2024-02-15T12:30:00Z",
      "status": "active"
    },
    "artworks": [
      {
        "id": "artwork-uuid",
        "title": "Victory Angel",
        "lat": 49.2827,
        "lon": -123.1207,
        "status": "approved",
        "photos": ["photo-url"],
        "created_at": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

#### Create New Artist

Create a new artist profile.

```http
POST /api/artists
```

**Authentication**: Required  
**Content-Type**: `application/json`

**Body**:

```json
{
  "name": "Artist Name",
  "bio": "Artist biography and background...",
  "website": "https://artist-website.com",
  "tags": {
    "country": "Canada",
    "medium": "painting"
  }
}
```

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "artist_id": "artist-uuid",
    "status": "created"
  }
}
```

### Artwork Management Endpoints

#### Edit Artwork Metadata

Submit edits to existing artwork information.

```http
POST /api/artwork/{id}/edit
```

**Authentication**: Required  
**Content-Type**: `application/json`

**Body**:

```json
{
  "field_name": "title",
  "field_value_old": "Old Title",
  "field_value_new": "Corrected Title"
}
```

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "edit_id": "edit-uuid",
    "status": "pending"
  }
}
```

#### Get Artwork Pending Edits

Retrieve pending edits for specific artwork.

```http
GET /api/artwork/{id}/pending-edits
```

**Authentication**: Required

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "pending_edits": [
      {
        "edit_id": "edit-uuid",
        "field_name": "title",
        "field_value_old": "Old Title",
        "field_value_new": "Corrected Title",
        "submitted_at": "2024-01-15T10:30:00Z",
        "status": "pending"
      }
    ]
  }
}
```

#### Validate Artwork Edit

Validate an artwork edit before submission.

```http
POST /api/artwork/{id}/edit/validate
```

**Authentication**: Required  
**Content-Type**: `application/json`

**Body**:

```json
{
  "field_name": "title",
  "field_value_new": "New Title"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "valid": true,
    "warnings": []
  }
}
```

### User Management Endpoints

#### Get User Submissions

Retrieve the authenticated user's submission history across all submission types.

```http
GET /api/me/submissions
```

**Authentication**: Required

**Parameters**:

- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (1-100, default: 20)
- `submission_type` (optional): Filter by type (`artwork_photos`, `artwork_edit`, `artist_edit`, `new_artwork`, `new_artist`)
- `status` (optional): Filter by status (`pending`, `approved`, `rejected`)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "id": "submission-uuid",
        "submission_type": "artwork_photos",
        "lat": 49.2827,
        "lon": -123.1207,
        "notes": "Street art submission",
        "status": "approved",
        "verification_status": "verified",
        "artwork_id": "artwork-uuid",
        "artist_id": null,
        "photos": ["https://art-photos.abluestar.com/photo.jpg"],
        "tags": {
          "artwork_type": "mural",
          "material": "paint"
        },
        "created_at": "2024-01-15T10:30:00Z",
        "reviewed_at": "2024-01-16T09:15:00Z"
      },
      {
        "id": "edit-submission-uuid",
        "submission_type": "artwork_edit",
        "artwork_id": "artwork-uuid",
        "old_data": {
          "title": "Old Title"
        },
        "new_data": {
          "title": "Corrected Title"
        },
        "status": "pending",
        "created_at": "2024-01-17T14:22:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 5,
      "total_pages": 1
    },
    "summary": {
      "by_type": {
        "artwork_photos": 3,
        "artwork_edit": 2,
        "artist_edit": 0,
        "new_artwork": 0,
        "new_artist": 0
      },
      "by_status": {
        "pending": 1,
        "approved": 3,
        "rejected": 1
      }
    }
  }
}
```

#### Get User Profile

Retrieve user statistics, role information, and preferences.

```http
GET /api/me/profile
```

**Authentication**: Required

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "user_token": "user-uuid",
    "roles": ["user"],
    "permissions": {
      "can_review": false,
      "can_moderate": false,
      "can_admin": false
    },
    "legacy_flags": {
      "is_moderator": false,
      "is_reviewer": false,
      "is_admin": false
    },
    "statistics": {
      "total_submissions": 12,
      "approved_submissions": 8,
      "pending_submissions": 2,
      "by_type": {
        "artwork_photos": 8,
        "artwork_edit": 3,
        "artist_edit": 1,
        "new_artwork": 0,
        "new_artist": 0
      }
    },
    "rate_limits": {
      "submissions": {
        "limit": 10,
        "remaining": 7,
        "reset_time": "2024-01-16T00:00:00Z"
      },
      "queries": {
        "limit": 60,
        "remaining": 45,
        "reset_time": "2024-01-15T11:00:00Z"
      }
    }
  }
}
```

**Role System**:

- `roles`: Array of active user roles (`admin`, `moderator`, `user`, `banned`)
- `permissions`: Computed permissions based on roles
  - `can_admin`: Full system access (role: admin)
  - `can_moderate`: Can review and approve submissions (role: moderator or admin)
  - `can_review`: Can access review interface (role: moderator or admin)
- `legacy_flags`: Backward compatibility flags (deprecated)

## Badge System

The badge system provides gamification and recognition for user achievements. Users can earn badges for various activities like submissions, photo uploads, email verification, and account milestones.

### Get All Badges

Retrieve all available badge definitions. This endpoint is public and does not require authentication.

```http
GET /api/badges
```

**Authentication**: None required

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "badges": [
      {
        "id": "badge-uuid",
        "badge_key": "submission_1",
        "title": "First Discovery",
        "description": "Made your first artwork submission",
        "icon_emoji": "🎯",
        "category": "activity",
        "threshold_type": "submission_count",
        "threshold_value": 1,
        "level": 1,
        "is_active": 1,
        "created_at": "2025-01-15T10:30:00Z",
        "updated_at": "2025-01-15T10:30:00Z"
      }
    ]
  }
}
```

**Badge Categories**:

- `activity`: Submission count, photo uploads, email verification
- `community`: Login streaks, account milestones
- `seasonal`: Special time-based achievements
- `geographic`: Location-based achievements

### Get User Badges

Retrieve badges earned by the authenticated user. Requires email verification.

```http
GET /api/me/badges
```

**Authentication**: Required (verified email)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "badges": [
      {
        "badge": {
          "id": "badge-uuid",
          "badge_key": "email_verified",
          "title": "Email Verified",
          "description": "Completed email verification",
          "icon_emoji": "✅",
          "category": "activity",
          "threshold_type": "email_verified",
          "threshold_value": null,
          "level": 1
        },
        "awarded_at": "2025-01-15T14:22:00Z",
        "award_reason": "Email verification completed",
        "metadata": {
          "verification_date": "2025-01-15T14:22:00Z"
        }
      }
    ]
  }
}
```

**Error Response** (401 Unauthorized):

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Email verification required for badge system"
}
```

## Profile System

The profile system allows verified users to set unique profile names and create public profiles showcasing their achievements.

### Update Profile Name

Set or change user profile name. Requires email verification.

```http
PATCH /api/me/profile
```

**Authentication**: Required (verified email)

**Content-Type**: `application/json`

**Body**:

```json
{
  "profile_name": "artlover123"
}
```

**Profile Name Requirements**:

- 3-20 characters long
- Alphanumeric characters and dashes only
- Cannot start or end with dash
- Must be unique across all users
- Cannot be banned name (admin, moderator, etc.)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Profile name updated successfully",
    "profile_name": "artlover123"
  }
}
```

**Error Response** (400 Bad Request):

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [
    {
      "field": "profile_name",
      "message": "Profile name is already taken"
    }
  ]
}
```

### Check Profile Name Availability

Check if a profile name is available before submitting. Requires email verification.

```http
GET /api/me/profile-check?profile_name=artlover123
```

**Authentication**: Required (verified email)

**Query Parameters**:

- `profile_name` (required): Profile name to check

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "available": true,
    "message": "Profile name is available"
  }
}
```

**Response** (200 OK - Name Taken):

```json
{
  "success": true,
  "data": {
    "available": false,
    "message": "Profile name is already taken"
  }
}
```

### Get Public User Profile

View public profile information for any user. Does not require authentication.

```http
GET /api/users/{uuid}
```

**Authentication**: None required

**Path Parameters**:

- `uuid` (required): User UUID

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "user": {
      "uuid": "user-uuid",
      "profile_name": "artlover123",
      "created_at": "2025-01-01T00:00:00Z",
      "member_since": "January 2025"
    },
    "badges": [
      {
        "badge": {
          "id": "badge-uuid",
          "title": "Email Verified",
          "description": "Completed email verification",
          "icon_emoji": "✅",
          "category": "activity",
          "level": 1
        },
        "awarded_at": "2025-01-15T14:22:00Z"
      }
    ],
    "statistics": {
      "total_badges": 3,
      "member_since": "January 2025"
    }
  }
}
```

**Error Response** (404 Not Found):

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "User not found or profile not public"
}
```

### Authentication Endpoints

#### Request Magic Link

Request an email verification link for enhanced user privileges.

```http
POST /api/auth/request-magic-link
```

**Content-Type**: `application/json`

**Body**:

```json
{
  "email": "user@example.com"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "message": "Verification email sent",
    "expires_in": 3600
  }
}
```

#### Verify Magic Link

Exchange a magic link token for user verification.

```http
POST /api/auth/verify-magic-link
```

**Content-Type**: `application/json`

**Body**:

```json
{
  "token": "magic-link-token",
  "user_token": "user-uuid"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "verified": true,
    "email": "user@example.com"
  }
}
```

#### Get Authentication Status

Check current authentication status and user information.

```http
GET /api/auth/status
```

**Authentication**: Required

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "user_token": "user-uuid",
    "email": "user@example.com",
    "verified": true,
    "roles": ["user"],
    "permissions": {
      "can_review": false,
      "can_moderate": false,
      "can_admin": false
    }
  }
}
```

#### Logout

Terminate current authentication session.

```http
POST /api/auth/logout
```

**Authentication**: Required

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### Legacy Magic Link (Deprecated)

```http
POST /api/auth/magic-link
```

**Content-Type**: `application/json`

**Body**:

```json
{
  "email": "user@example.com"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "message": "Verification email sent",
    "expires_in": 3600
  }
}
```

Note: Legacy endpoints `POST /api/auth/consume` and `GET /api/auth/verify-status` were removed. Use `POST /api/auth/verify-magic-link` for magic-link verification.

---

## Additional implemented endpoints (not previously documented)

### Health Check

GET /health

Returns a detailed health report used by monitoring systems. Response (200 OK when healthy):

```json
{
  "status": "healthy",
  "environment": { "environment": "production", "version": "1.0.0", "timestamp": "2025-09-23T12:00:00Z" },
  "summary": { "healthy_checks": 10, "total_checks": 10 },
  "checks": { "database": { "status": "healthy" }, "r2_storage": { "status": "healthy" } }
}
```

### API Status

GET /api/status

Lightweight API status endpoint that returns API version and environment. Response (200 OK):

```json
{
  "message": "Cultural Archiver API is running",
  "environment": "production",
  "timestamp": "2025-09-23T12:00:00Z",
  "version": "1.0.0"
}
```

### Photo Serving (R2)

GET /photos/\*

Serves images stored in R2. Example URL: `/photos/originals/2025/09/14/file.jpg`. Returns the raw image bytes with appropriate Content-Type (image/jpeg, image/png, etc.) or 404 when missing.

### Public Artwork Pages

`/p/artwork/{id}` is a public-facing path handled by the frontend worker that renders an artwork detail page for web browsers. This is not an API JSON endpoint but an HTML page route.

### Search Suggestions

GET /api/search/suggestions

Query: q=search-term

Returns short suggestion objects for autocompletion. Response (200 OK):

```json
{
  "success": true,
  "data": [
    { "suggestion": "mural", "type": "tag" },
    { "suggestion": "Mural by Unknown", "type": "artwork" }
  ]
}
```

### Test Email (dev/test endpoint)

POST /api/test-email

Used by developers to validate email configuration. Accepts JSON body with `email` and returns a success response when the email was queued/sent.

```json
{
  "success": true,
  "data": { "message": "Test email queued", "email": "dev@example.com" }
}
```

### Admin / Internal Endpoints

The worker exposes several admin and debug endpoints used for maintenance and auditing. These are intended for operator use and require appropriate credentials (admin role + verified email). Below are concise, actionable docs and examples for the key admin endpoints implemented in the worker.

Note: these endpoints are for operator tooling and the admin UI only. They require an admin user token and verified email.

#### GET /api/admin/permissions

Description: List users who currently hold elevated permissions (admin or moderator). Supports optional `permission` and `search` query parameters.

Permissions: admin

Query parameters:

- `permission` (optional): `moderator` or `admin`
- `search` (optional): substring to filter users by email or profile name

Response (200 OK):

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "user_uuid": "user-uuid-1",
        "email": "admin@example.com",
        "permissions": [{ "permission": "admin", "granted_at": "2025-01-01T12:00:00Z" }]
      }
    ],
    "total": 1,
    "filter": null,
    "search": null,
    "retrieved_at": "2025-09-23T12:00:00Z"
  }
}
```

#### POST /api/admin/permissions/grant

Description: Grant a permission to a user.

Permissions: admin

Body (application/json):

```json
{
  "userUuid": "target-user-uuid",
  "permission": "moderator",
  "reason": "Optional short reason (max 500 chars)"
}
```

Response (200 OK):

```json
{
  "success": true,
  "data": {
    "permission_id": "perm-uuid",
    "user_uuid": "target-user-uuid",
    "permission": "moderator",
    "granted_by": "admin-user-uuid",
    "granted_at": "2025-09-23T12:00:00Z",
    "reason": null
  }
}
```

Errors: 400 for validation errors, 403 if caller lacks admin permission.

#### POST /api/admin/permissions/revoke

Description: Revoke a permission from a user.

Permissions: admin

Body (application/json):

```json
{
  "userUuid": "target-user-uuid",
  "permission": "moderator",
  "reason": "Optional short reason (max 500 chars)"
}
```

Response (200 OK):

```json
{
  "success": true,
  "data": {
    "user_uuid": "target-user-uuid",
    "permission": "moderator",
    "revoked_by": "admin-user-uuid",
    "revoked_at": "2025-09-23T12:05:00Z",
    "reason": "Optional reason"
  }
}
```

#### GET /api/admin/audit

Description: Retrieve audit logs with filtering and pagination. Use for investigating admin/moderation actions and system events.

Permissions: admin

Query parameters (examples):

- `type` (optional): `moderation` or `admin`
- `userUuid` (optional): filter by actor UUID
- `targetUuid` (optional): filter by target entity UUID
- `decision` (optional): `approved`, `rejected`, `skipped`
- `actionType` (optional): `grant_permission`, `revoke_permission`, `view_audit_logs`
- `startDate`, `endDate` (optional ISO 8601)
- `page` (optional), `limit` (optional, max 100)

Response (200 OK):

```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "audit-1",
        "actor": "admin-user-uuid",
        "action": "grant_permission",
        "target": "target-user-uuid",
        "meta": { "permissionType": "moderator" },
        "timestamp": "2025-09-23T11:00:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1 },
    "filters": { "type": null },
    "retrieved_at": "2025-09-23T12:00:00Z"
  }
}
```

#### GET /api/admin/statistics

Description: Retrieve system and audit statistics (permission counts, recent audit metrics).

Permissions: admin

Query parameters:

- `days` (optional): number of days to include in audit analytics (default: 30)

Response (200 OK):

```json
{
  "success": true,
  "data": {
    "period_days": 30,
    "permissions": {
      "totalUsers": 12,
      "moderators": 3,
      "admins": 2,
      "activePermissions": 15
    },
    "audit": { "totalEvents": 250, "recentErrors": 0 },
    "generated_at": "2025-09-23T12:00:00Z"
  }
}
```

#### GET /api/admin/badges

Description: List badges with administrative statistics.

Permissions: admin

Response (200 OK):

```json
{
  "success": true,
  "data": {
    "badges": [{ "id": "badge-uuid", "badge_key": "submission_1", "title": "First Discovery", "active": true }],
    "total": 1,
    "retrieved_at": "2025-09-23T12:00:00Z"
  }
}
```

#### POST /api/admin/badges

Description: Create a new badge. Body parameters validate badge_key, title, description, icon_emoji, category, level, threshold_type and threshold_value. See server-side validation rules.

Permissions: admin

Request body (example):

```json
{
  "badge_key": "contributor_10",
  "title": "Top Contributor",
  "description": "Awarded for 10 approved submissions",
  "icon_emoji": "\\u2b50",
  "category": "activity",
  "level": 1,
  "threshold_type": "submission_count",
  "threshold_value": 10
}
```

Response (201 Created):

```json
{
  "success": true,
  "data": {
    "badge_id": "badge-uuid",
    "badge_key": "contributor_10",
    "created_at": "2025-09-23T12:00:00Z"
  }
}
```

#### PUT /api/admin/badges/{id}

Description: Update an existing badge. Send partial updates in JSON.

Permissions: admin

Request body (example):

```json
{
  "title": "Top Contributor (updated)",
  "description": "Updated description"
}
```

Response (200 OK): returns the updated badge object.

#### DELETE /api/admin/badges/{id}

Description: Deactivate a badge (soft-delete / deactivate). Returns the `badge_id` and `deactivated_at` timestamp on success.

Permissions: admin

Response (200 OK):

```json
{
  "success": true,
  "data": { "badge_id": "badge-uuid", "deactivated_at": "2025-09-23T12:10:00Z" }
}
```

#### Additional Operational Endpoints (implemented but not expanded)

The worker also exposes several operational and developer endpoints. They are implemented and used by the system; most require admin or developer-level credentials. Quick inventory:

- GET /api/admin/audit
- GET /api/admin/badges
- GET /api/admin/badges/{id}
- GET /api/admin/permissions
- POST /api/admin/permissions/grant
- POST /api/admin/permissions/revoke
- GET /api/admin/statistics
- Various `/api/dev/*` debug endpoints (fix-permissions-schema, update-steven-permissions)
- Mass-import operational subpaths: `/api/mass-import/osm`, `/api/mass-import/osm/validate`, `/api/mass-import/photos`, `/api/mass-import/submit`
- User operational endpoints: `/api/me/notifications` (list), `/api/me/notifications/{id}/read`, `/api/me/notifications/{id}/dismiss`, `/api/me/notifications/unread-count`
- Search helper: `/api/search/suggestions`
- Health & status: `/api/status`, `/health`
- Misc: `/api/test-email`, `/photos/*`, `/p/artwork/{id}`

Note: If you want any of these expanded into full public docs with examples, I can add them — otherwise they remain listed here as operational/internal endpoints.

##### Notifications (user-facing)

The notifications endpoints return simple user notifications for authenticated users. Example response (GET `/api/me/notifications`):

```json
{
  "success": true,
  "data": [
    {
      "id": "notif-uuid-1",
      "type": "submission_approved",
      "message": "Your submission was approved",
      "read": false,
      "created_at": "2025-09-22T13:00:00Z"
    },
    {
      "id": "notif-uuid-2",
      "type": "comment",
      "message": "A reviewer commented on your submission",
      "read": true,
      "created_at": "2025-09-20T09:30:00Z"
    }
  ]
}
```

### Deprecated: /api/artworks/{id}/tags

The endpoint `/api/artworks/{id}/tags` is not implemented in the current worker and has been removed from the canonical endpoint list. Tag metadata is available as part of the artwork detail payload (`GET /api/artworks/{id}`).

### Moderation Endpoints

Note: These endpoints require moderator or admin role.

#### Get Review Queue

Retrieve pending submissions for moderation across all submission types.

```http
GET /api/review/queue
```

**Authentication**: Required (Moderator or Admin)

**Parameters**:

- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (default: 20)
- `submission_type` (optional): Filter by type (`artwork_photos`, `artwork_edit`, `artist_edit`, `new_artwork`, `new_artist`)
- `sort` (optional): Sort order (`created_at`, `priority`) (default: `created_at`)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "id": "submission-uuid",
        "submission_type": "artwork_photos",
        "lat": 49.2827,
        "lon": -123.1207,
        "notes": "Street art submission",
        "photos": ["https://art-photos.abluestar.com/photo.jpg"],
        "tags": {
          "artwork_type": "mural",
          "material": "paint"
        },
        "user_token": "user-uuid",
        "email": "user@example.com",
        "verification_status": "verified",
        "created_at": "2024-01-15T10:30:00Z",
        "nearby_artworks": [
          {
            "id": "artwork-uuid",
            "distance_km": 0.1,
            "title": "Existing Mural",
            "status": "approved"
          }
        ]
      },
      {
        "id": "edit-submission-uuid",
        "submission_type": "artwork_edit",
        "artwork_id": "artwork-uuid",
        "old_data": {
          "title": "Old Title",
          "description": "Basic description"
        },
        "new_data": {
          "title": "Corrected Title",
          "description": "Detailed description with historical context"
        },
        "user_token": "user-uuid",
        "created_at": "2024-01-16T14:22:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 15,
      "total_pages": 1
    },
    "summary": {
      "by_type": {
        "artwork_photos": 8,
        "artwork_edit": 5,
        "artist_edit": 2,
        "new_artwork": 0,
        "new_artist": 0
      },
      "total_pending": 15
    }
  }
}
```

#### Approve Submission

Approve a pending submission and apply changes to target entities.

```http
POST /api/review/approve/{submission_id}
```

**Authentication**: Required (Moderator or Admin)

**Content-Type**: `application/json`

**Body**:

```json
{
  "action": "create_new",
  "approval_notes": "Verified location and content",
  "overrides": {
    "tags": {
      "material": "bronze",
      "condition": "excellent"
    }
  }
}
```

**Action Types**:

- `create_new`: Create a new artwork from the submission (default for new artworks)
- `link_existing`: Link the submission to an existing artwork (used for logbook entries and photo aggregation)
  - Requires `artwork_id` field to specify target artwork
  - Automatically used for logbook entries with existing `artwork_id`
  - Aggregates photos to the existing artwork instead of creating duplicates

**Photo Aggregation**: When using `link_existing`, photos from the submission are automatically aggregated to the target artwork. This enables multiple contributors to add photos to the same artwork over time.

**Logbook Entry Handling**: Submissions with `type: "logbook_entry"` and an existing `artwork_id` are automatically processed with `link_existing` action to aggregate photos and updates to the original artwork.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "submission_id": "submission-uuid",
    "status": "approved",
    "target_entity": {
      "type": "artwork",
      "id": "artwork-uuid",
      "action": "created"
    },
    "reviewed_at": "2024-01-16T10:30:00Z"
  }
}
```

#### Batch Review Operations

Process multiple submissions in a single request.

```http
POST /api/review/batch
```

**Authentication**: Required (Moderator or Admin)  
**Content-Type**: `application/json`

**Body**:

```json
{
  "operations": [
    {
      "submission_id": "submission-uuid-1",
      "action": "approve",
      "reviewer_notes": "Verified"
    },
    {
      "submission_id": "submission-uuid-2",
      "action": "reject",
      "rejection_reason": "Duplicate"
    }
  ]
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "processed": 2,
    "successful": 2,
    "failed": 0,
    "results": [
      {
        "submission_id": "submission-uuid-1",
        "status": "approved"
      },
      {
        "submission_id": "submission-uuid-2",
        "status": "rejected"
      }
    ]
  }
}
```

#### Get Artwork Edits Queue

Retrieve pending artwork edits for moderation.

```http
GET /api/review/artwork-edits
```

**Authentication**: Required (Moderator or Admin)

**Parameters**:

- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (default: 20)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "edits": [
      {
        "edit_id": "edit-uuid",
        "artwork_id": "artwork-uuid",
        "field_name": "title",
        "field_value_old": "Old Title",
        "field_value_new": "New Title",
        "user_token": "user-uuid",
        "submitted_at": "2024-01-15T10:30:00Z",
        "status": "pending"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 5,
      "total_pages": 1
    }
  }
}
```

#### Get Artwork Edit Details

Get detailed information about a specific artwork edit.

```http
GET /api/review/artwork-edits/{editId}
```

**Authentication**: Required (Moderator or Admin)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "edit": {
      "edit_id": "edit-uuid",
      "artwork_id": "artwork-uuid",
      "field_name": "title",
      "field_value_old": "Old Title",
      "field_value_new": "New Title",
      "user_token": "user-uuid",
      "submitted_at": "2024-01-15T10:30:00Z",
      "status": "pending"
    },
    "artwork": {
      "id": "artwork-uuid",
      "title": "Current Title",
      "lat": 49.2827,
      "lon": -123.1207
    }
  }
}
```

#### Approve Artwork Edit

Approve a pending artwork edit.

```http
POST /api/review/artwork-edits/{editId}/approve
```

**Authentication**: Required (Moderator or Admin)  
**Content-Type**: `application/json`

**Body**:

```json
{
  "reviewer_notes": "Edit verified and approved"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "edit_id": "edit-uuid",
    "status": "approved",
    "artwork_updated": true
  }
}
```

#### Reject Artwork Edit

Reject a pending artwork edit.

```http
POST /api/review/artwork-edits/{editId}/reject
```

**Authentication**: Required (Moderator or Admin)  
**Content-Type**: `application/json`

**Body**:

```json
{
  "rejection_reason": "Insufficient information provided"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "edit_id": "edit-uuid",
    "status": "rejected"
  }
}
```

#### Get Review Submission Details

Get detailed information about a specific submission for review.

```http
GET /api/review/submission/{id}
```

**Authentication**: Required (Moderator or Admin)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "submission": {
      "id": "submission-uuid",
      "submission_type": "artwork_photos",
      "lat": 49.2827,
      "lon": -123.1207,
      "notes": "Street art submission",
      "photos": ["https://art-photos.abluestar.com/photo.jpg"],
      "tags": {
        "artwork_type": "mural",
        "material": "paint"
      },
      "user_token": "user-uuid",
      "email": "user@example.com",
      "verification_status": "verified",
      "created_at": "2024-01-15T10:30:00Z"
    },
    "context": {
      "nearby_artworks": [
        {
          "id": "artwork-uuid",
          "distance_km": 0.1,
          "title": "Existing Mural",
          "status": "approved"
        }
      ]
    }
  }
}
```

#### Reject Submission

Reject a pending submission with reason.

```http
POST /api/review/reject/{submission_id}
```

**Authentication**: Required (Reviewer)

**Content-Type**: `application/json`

**Body**:

```json
{
  "rejection_reason": "Duplicate of existing artwork"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "message": "Submission rejected",
    "photos_cleaned": 2
  }
}
```

#### Get Moderation Statistics

Retrieve moderation statistics and metrics.

```http
GET /api/review/stats
```

**Authentication**: Required (Reviewer)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "pending_submissions": 15,
    "approved_today": 8,
    "rejected_today": 2,
    "total_artworks": 245,
    "recent_activity": [
      {
        "action": "approved",
        "submission_id": "uuid",
        "timestamp": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

## Error Codes

| Code                   | Description                       |
| ---------------------- | --------------------------------- |
| `VALIDATION_ERROR`     | Request validation failed         |
| `UNAUTHORIZED`         | Authentication required           |
| `FORBIDDEN`            | Insufficient permissions          |
| `NOT_FOUND`            | Resource not found                |
| `RATE_LIMITED`         | Rate limit exceeded               |
| `FILE_TOO_LARGE`       | Uploaded file exceeds size limit  |
| `INVALID_FILE_TYPE`    | Unsupported file format           |
| `DUPLICATE_SUBMISSION` | Similar submission already exists |
| `INTERNAL_ERROR`       | Server error occurred             |

## Photo Handling

Photos are processed and stored with the following specifications:

- **Supported formats**: JPEG, PNG, WebP, GIF
- **Maximum size**: 15MB per file
- **Maximum count**: 3 photos per submission
- **Processing**: Original photos are stored with date-based folder structure
- **URLs**: Secure signed URLs with expiration
- **Cleanup**: Automatic removal of photos from rejected submissions

## Spatial Queries

The API uses efficient spatial indexing for location-based searches:

- **Coordinate system**: WGS84 (GPS coordinates)
- **Search algorithm**: Bounding box filtering with haversine distance calculation
- **Default radius**: 500 meters
- **Maximum radius**: 10 kilometers
- **Minimum radius**: 50 meters

## Development and Testing

### Environment Variables

````bash
# Required
DATABASE_URL=your-d1-database
KV_NAMESPACE_SESSIONS=your-kv-namespace
KV_NAMESPACE_RATE_LIMITS=your-kv-namespace
KV_NAMESPACE_MAGIC_LINKS=your-kv-namespace
R2_BUCKET_PHOTOS=your-r2-bucket

# Optional
ENVIRONMENT=development

## Appendix: Example responses

This appendix provides compact, representative example responses for commonly used endpoints so developers can see expected output shapes.

### GET /api/artists

```json
{
  "success": true,
  "data": {
    "page": 1,
    "per_page": 30,
    "total": 124,
    "items": [
      { "id": "artist-uuid-1", "name": "Artist One", "artwork_count": 12 },
      { "id": "artist-uuid-2", "name": "Artist Two", "artwork_count": 3 }
    ]
  }
}
````

### GET /api/artists/{id}

```json
{
  "success": true,
  "data": {
    "id": "artist-uuid-1",
    "name": "Artist One",
    "bio": "Short biography...",
    "artworks": [{ "id": "artwork-uuid-1", "title": "Sculpture" }]
  }
}
```

### POST /api/submissions

Response (201 Created):

```json
{
  "success": true,
  "data": {
    "submission_id": "submission-uuid-123",
    "submission_type": "new_artwork",
    "status": "pending",
    "created_at": "2025-09-23T12:10:00Z"
  }
}
```

### GET /api/users/{uuid}

```json
{
  "success": true,
  "data": {
    "uuid": "user-uuid-1",
    "profile_name": "artlover",
    "badges": [],
    "member_since": "2024-06-01T08:00:00Z"
  }
}
```

### GET /api/review/artwork-edits

```json
{
  "success": true,
  "data": [{ "editId": "edit-uuid-1", "artwork_id": "artwork-uuid-1", "changes": { "title": "New Title" } }]
}
```

### Admin endpoint example — GET /api/admin/audit

```json
{
  "success": true,
  "data": {
    "total": 12,
    "entries": [{ "id": "audit-1", "action": "mass_import", "timestamp": "2025-09-22T11:00:00Z" }]
  }
}
```

### Environment (example)

```bash
FRONTEND_URL=http://localhost:3000 LOG_LEVEL=debug
```

## Testing with cURL

```bash
# Submit artwork
curl -X POST https://art-api.abluestar.com/api/logbook \
  -H "Authorization: Bearer your-token" \
  -F "lat=49.2827" \
  -F "lon=-123.1207" \
  -F "note=Test submission" \
  -F "photos=@photo.jpg"

# Search nearby
curl "https://art-api.abluestar.com/api/artworks/nearby?lat=49.2827&lon=-123.1207&radius=1000"

# Get user submissions
curl -H "Authorization: Bearer your-token" \
  https://art-api.abluestar.com/api/me/submissions
```

### Rate Limit Testing

```javascript
// Test rate limiting
for (let i = 0; i < 12; i++) {
  const response = await fetch('/api/logbook', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
    body: formData,
  });

  if (response.status === 429) {
    console.log('Rate limited at submission', i);
    const retryAfter = response.headers.get('Retry-After');
    console.log('Retry after', retryAfter, 'seconds');
    break;
  }
}
```

## Admin Endpoints

Administrative endpoints for platform management. Requires admin authentication.

Note: The public data dump system was removed during pre-release hardening. Internal backups remain available via the backup commands below.

## NPM Commands

The platform includes command-line tools for backup generation:

### Local Backup

```bash
# Generate backup to current directory
npm run backup

# Custom output directory
npm run backup -- --output-dir ./backups

# Show help
npm run backup -- --help
```

### Remote Backup

```bash
# Generate backup using Cloudflare credentials
npm run backup:remote -- --output-dir ./production-backups
```

**Required Environment Variables**:

```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
DATABASE_ID=your-d1-database-id
PHOTOS_BUCKET=your-r2-bucket-name
```

## Support and Resources

- GitHub Repository: <https://github.com/funvill/cultural-archiver>
- Issue Tracker: <https://github.com/funvill/cultural-archiver/issues>
- Database Schema: See `/docs/database.md` for schema details and relationships
