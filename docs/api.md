# Cultural Archiver API Documentation

The Cultural Archiver Worker API provides a comprehensive backend for crowdsourced public art mapping with mobile-first submission workflows. This API is built using Hono with TypeScript and runs on Cloudflare Workers, integrating with D1 (database), KV (rate limiting & sessions), and R2 (photo storage).

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
        "style": "modern"
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
    "statistics": {
      "total_submissions": 12,
      "approved_submissions": 8,
      "pending_submissions": 2,
      "is_reviewer": false
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
