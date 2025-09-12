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

```
https://art-api.abluestar.com
```

## Authentication

The API uses Bearer token authentication with anonymous user tokens. Users receive a UUID token that identifies their submissions without requiring registration.

```http
Authorization: Bearer {user-token-uuid}
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

For trusted, high-volume imports of artworks, see the [Mass-Import API documentation](./mass-import.md). This endpoint allows moderators and admins to import large batches of artworks, images, logbook entries, and tags from public datasets. All imported records are automatically approved and attributed to the importing user.

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

### Submission Endpoints

#### Submit New Artwork

Submit a new artwork for community review.

```http
POST /api/logbook
```

**Content-Type**: `multipart/form-data`

**Authentication**: Required

**Parameters**:

- `lat` (required): Latitude (-90 to 90)
- `lon` (required): Longitude (-180 to 180)
- `note` (optional): Description (max 500 characters)
- `type` (optional): Artwork type (`public_art`, `street_art`, `monument`, `sculpture`, `other`)
- `photos` (optional): Up to 3 image files (15MB each, JPEG/PNG/WebP/GIF)

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "submission_id": "uuid-string",
    "status": "pending",
    "nearby_artworks": [
      {
        "id": "artwork-uuid",
        "distance_km": 0.15,
        "type_name": "Public Art"
      }
    ]
  }
}
```

**Example**:

```javascript
const formData = new FormData();
formData.append('lat', '49.2827');
formData.append('lon', '-123.1207');
formData.append('note', 'Beautiful mural on building wall');
formData.append('type', 'street_art');
formData.append('photos', fileInput.files[0]);

const response = await fetch('/api/logbook', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-user-token',
  },
  body: formData,
});
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
      "parsed_tags": [
        { "key": "year", "value": "2020" }
      ],
      "center": { "lat": 49.2827, "lon": -123.1207 },
      "radius_km": 10,
      "total_found": 1
    },
    "suggestions": [
      "tag:artwork_type:mural",
      "tag:material:paint", 
      "tag:artist_name:banksy"
    ]
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
        "physical_properties": [
          {"key": "material", "value": "bronze", "label": "Material"}
        ],
        "location_details": [
          {"key": "city", "value": "vancouver", "label": "City"},
          {"key": "province", "value": "british_columbia", "label": "Province/State"},
          {"key": "country", "value": "canada", "label": "Country"}
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

#### Edit Artwork Tags

Edit structured tags for an approved artwork. Supports validation against the predefined tag schema.

```http
PUT /api/artworks/{id}/tags
```

**Authentication**: Required (Reviewer or artwork creator)

**Content-Type**: `application/json`

**Body**:

```json
{
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
}
```

**Response** (200 OK):

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

### User Management Endpoints

#### Get User Submissions

Retrieve the authenticated user's submission history.

```http
GET /api/me/submissions
```

**Authentication**: Required

**Parameters**:

- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (1-100, default: 20)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "id": "submission-uuid",
        "lat": 49.2827,
        "lon": -123.1207,
        "note": "Street art submission",
        "status": "approved",
        "artwork_id": "artwork-uuid",
        "photos": ["photo-url"],
        "created_at": "2024-01-15T10:30:00Z"
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

#### Get User Profile

Retrieve user statistics and preferences.

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
    "is_moderator": false,
    "can_review": false,
    "is_reviewer": false, // deprecated alias (to be removed after deprecation period)
    "is_admin": false,
    "statistics": {
      "total_submissions": 12,
      "approved_submissions": 8,
      "pending_submissions": 2
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

Fields:

- `is_moderator` – True if the user has active moderator permission.
- `can_review` – Convenience flag (currently mirrors `is_moderator` or `is_admin`).
- `is_reviewer` – Deprecated legacy alias retained temporarily for backward compatibility.
- `is_admin` – User has administrative privileges (implies moderation capabilities).

### Authentication Endpoints

#### Request Magic Link

Request an email verification link for enhanced user privileges.

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

#### Consume Magic Link

Exchange a magic link token for user verification.

```http
POST /api/auth/consume
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

#### Check Verification Status

Check if a user token is email-verified.

```http
GET /api/auth/verify-status
```

**Authentication**: Required

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "verified": true,
    "email": "user@example.com",
    "verified_at": "2024-01-15T10:30:00Z"
  }
}
```

### Moderation Endpoints

_Note: These endpoints require reviewer permissions_

#### Get Review Queue

Retrieve pending submissions for moderation.

```http
GET /api/review/queue
```

**Authentication**: Required (Reviewer)

**Parameters**:

- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (default: 20)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "id": "submission-uuid",
        "lat": 49.2827,
        "lon": -123.1207,
        "note": "Street art submission",
        "photos": ["photo-url"],
        "user_token": "user-uuid",
        "created_at": "2024-01-15T10:30:00Z",
        "nearby_artworks": [
          {
            "id": "artwork-uuid",
            "distance_km": 0.1,
            "type_name": "Street Art"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 15,
      "total_pages": 1
    }
  }
}
```

#### Approve Submission

Approve a pending submission and create or link to artwork.

```http
POST /api/review/approve/{submission_id}
```

**Authentication**: Required (Reviewer)

**Content-Type**: `application/json`

**Body**:

```json
{
  "action": "create_new_artwork",
  "artwork_overrides": {
    "type_id": "public_art",
    "tags": {
      "material": "bronze",
      "condition": "good"
    }
  }
}
```

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "artwork_id": "artwork-uuid",
    "action_taken": "created_new_artwork",
    "photos_migrated": 2
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

```bash
# Required
DATABASE_URL=your-d1-database
KV_NAMESPACE_SESSIONS=your-kv-namespace
KV_NAMESPACE_RATE_LIMITS=your-kv-namespace
KV_NAMESPACE_MAGIC_LINKS=your-kv-namespace
R2_BUCKET_PHOTOS=your-r2-bucket

# Optional
ENVIRONMENT=development
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=debug
```

### Testing with cURL

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

Administrative endpoints for platform management and data export. Requires admin authentication.

### Generate Data Dump

Create a public data dump containing approved artwork with CC0 licensing.

**Endpoint**: `POST /api/admin/data-dump/generate`  
**Authentication**: Admin token required

```http
POST /api/admin/data-dump/generate
Authorization: Bearer {admin-token}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "datadump-2025-09-04.zip",
    "size": 2048576,
    "artwork_count": 150,
    "creator_count": 75,
    "tag_count": 200,
    "photo_count": 145,
    "download_url": "https://r2.cultural-archiver.com/datadump-2025-09-04.zip",
    "created_at": "2025-09-04T14:30:22.000Z"
  }
}
```

### List Data Dumps

Retrieve all generated data dumps with metadata and download links.

**Endpoint**: `GET /api/admin/data-dumps`  
**Authentication**: Admin token required

```http
GET /api/admin/data-dumps?page=1&limit=20
Authorization: Bearer {admin-token}
```

**Query Parameters**:

- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Results per page (max 100, default: 20)

**Response**:

```json
{
  "success": true,
  "data": {
    "dumps": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "filename": "datadump-2025-09-04.zip",
        "size": 2048576,
        "artwork_count": 150,
        "creator_count": 75,
        "tag_count": 200,
        "photo_count": 145,
        "download_url": "https://r2.cultural-archiver.com/datadump-2025-09-04.zip",
        "created_at": "2025-09-04T14:30:22.000Z",
        "warnings": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "has_more": false
    }
  }
}
```

**Error Responses**:

- `401 Unauthorized`: Invalid or missing admin token
- `500 Internal Server Error`: Data dump generation failed

### Data Dump Contents

Each data dump contains:

- **artwork.json**: Approved artwork with public metadata only
- **creators.json**: Artist information (name, public details)
- **tags.json**: Metadata tags and categories
- **artwork_creators.json**: Artwork-creator relationships
- **photos/thumbnails/**: 800px thumbnail images only
- **LICENSE.txt**: CC0 1.0 Universal Public Domain Dedication
- **README.md**: Usage documentation and dataset information
- **metadata.json**: Generation timestamp and statistics

**Excluded Data**: User tokens, emails, IP addresses, moderation notes, rejected submissions, and original photos.

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

- **GitHub Repository**: https://github.com/funvill/cultural-archiver
- **Issue Tracker**: https://github.com/funvill/cultural-archiver/issues
- **Backup Documentation**: See `/docs/backup-data-dump.md` for detailed setup and usage
