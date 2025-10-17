# Mass Import v3: Endpoint Development Plan

## Overview

The Mass-Import Endpoint is the **second component** of the mass import v3 system. It's a Cloudflare Worker API endpoint that receives **individual** artwork or artist items, validates them, stores them in the database, and returns success/failure status.

**Key Characteristic**: The endpoint is **stateless** - it processes one item at a time and doesn't track import sessions or maintain statistics.

## Goals

- Accept GeoJSON format for artwork submissions
- Accept JSON format for artist submissions
- Validate data structure and required fields
- Create database records with `approved` status
- Auto-create artist records when needed
- Handle photo uploads (multipart/form-data)
- Return detailed success/failure responses
- Maintain audit trail via admin user token

## Design Decisions

Based on the clarifying questions (30-49), here are the key decisions:

### Request Processing

- **Type Detection**: Check `type` field ("Feature" = artwork, "Artist" = artist)
- **GeoJSON Validation**: Strict validation for artwork (GeoJSON Feature spec)
- **Source ID Handling**: Store in tags as `source_id`, generate UUID for database
- **Artist Creation**: Auto-create stub artist records if not found
- **Duplicate Detection**: No duplicate checking (always insert new records)
- **Photo Handling**: Accept multipart/form-data uploads (not URLs)

### Validation

- **Coordinate Validation**: Strict range checking (lat: -90 to 90, lon: -180 to 180)
- **Required Fields**: Use Zod schemas for structured validation errors
- **Location Enhancement**: No (CLI handles this)
- **Markdown Sanitization**: Basic sanitization (remove `<script>` tags)

### Authentication & Security

- **Auth Method**: Admin bearer token (validate against users + user_roles)
- **Rate Limiting**: No rate limiting (admin-only endpoint)
- **Error Handling**: One item at a time, report errors (no rollback)

### Response Format

- **Success Response**: Return created item details with database ID
- **Duplicate Response**: Return 200 and create anyway (no duplicate blocking)
- **Error Response**: Structured validation errors with field details
- **Idempotency**: No idempotency support

## API Specification

### Endpoint

```
POST /api/mass-import/v3
```

### Authentication

```
Authorization: Bearer <admin-token>
```

### Request Format (Artwork)

```json
{
  "type": "Feature",
  "id": "node/publicart117",
  "geometry": {
    "type": "Point",
    "coordinates": [-123.003613, 49.225237]
  },
  "properties": {
    "source": "https://burnabyartgallery.ca",
    "source_url": "https://collections.burnabyartgallery.ca/link/publicart117",
    "title": "blacktail",
    "description": "Markdown description...",
    "artwork_type": "sculpture",
    "material": "aluminum",
    "start_date": "2015",
    "artist": "Muse Atelier"
  }
}
```

**Note**: Photos are uploaded separately as multipart/form-data

### Request Format (Artist)

```json
{
  "type": "Artist",
  "id": "artist-muse-atelier",
  "name": "Muse Atelier",
  "description": "Artist biography in Markdown...",
  "properties": {
    "source": "https://burnabyartgallery.ca",
    "source_url": "https://collections.burnabyartgallery.ca/link/artists1307",
    "birth_date": "1928",
    "death_date": "2016",
    "website": "http://www.example.com"
  }
}
```

### Response Format (Success)

```json
{
  "success": true,
  "data": {
    "id": "uuid-generated-by-system",
    "sourceId": "node/publicart117",
    "type": "artwork",
    "status": "created",
    "title": "blacktail",
    "artists": [
      {
        "id": "uuid-artist-id",
        "name": "Muse Atelier",
        "status": "linked"
      }
    ],
    "photos": [
      {
        "url": "https://photos.publicartregistry.com/artworks/2025/10/14/timestamp-uuid.jpg",
        "status": "uploaded"
      }
    ]
  }
}
```

### Response Format (Error)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid coordinates",
    "details": {
      "field": "geometry.coordinates",
      "value": [0, 0],
      "reason": "Coordinates at (0, 0) are likely an error"
    }
  }
}
```

## Development Plan

### Phase 1: Endpoint Setup & Routing

**Goal**: Create basic endpoint structure with routing

**Tasks**:

- [ ] Create endpoint file: `src/workers/routes/mass-import-v3.ts`
- [ ] Add route to worker: `POST /api/mass-import/v3`
- [ ] Implement authentication middleware:
  - [ ] Extract bearer token from headers
  - [ ] Validate token against `users` table
  - [ ] Check `user_roles` for admin permission
  - [ ] Return 401 for invalid/missing tokens
- [ ] Implement request type detection:
  - [ ] Parse JSON body
  - [ ] Check `type` field
  - [ ] Route to artwork handler if `type === "Feature"`
  - [ ] Route to artist handler if `type === "Artist"`
  - [ ] Return 400 for invalid type
- [ ] Create placeholder handlers:
  - [ ] `handleArtworkImport(data, env, userId)`
  - [ ] `handleArtistImport(data, env, userId)`
- [ ] Add basic error handling
- [ ] Write initial tests for routing logic

**Success Criteria**:

- Endpoint returns 401 for missing auth
- Endpoint routes to correct handler based on type
- All tests pass

### Phase 2: Validation Layer

**Goal**: Implement comprehensive data validation

**Tasks**:

- [ ] Create Zod schemas: `src/workers/schemas/mass-import-v3.ts`
  - [ ] `ArtworkFeatureSchema` - GeoJSON Feature validation
  - [ ] `ArtistSchema` - Artist JSON validation
  - [ ] `CoordinatesSchema` - Lat/lon validation
  - [ ] `PropertiesSchema` - Required/optional fields
- [ ] Implement coordinate validation:
  - [ ] Check lat range (-90 to 90)
  - [ ] Check lon range (-180 to 180)
  - [ ] Reject (0, 0) coordinates
  - [ ] Allow up to 8 decimal places
- [ ] Implement required field validation:
  - [ ] Artwork: title, coordinates, source, source_url
  - [ ] Artist: name, source, source_url
- [ ] Implement format validation:
  - [ ] URL validation for source_url, photo URLs
  - [ ] Markdown basic sanitization (remove `<script>`)
  - [ ] Array validation for photos
- [ ] Create validation error formatter:
  - [ ] Convert Zod errors to API error format
  - [ ] Include field path, value, and reason
- [ ] Write comprehensive validation tests

**Success Criteria**:

- All validation rules enforced correctly
- Error messages are clear and actionable
- Validation tests cover edge cases
- Validation is fast (<10ms per item)

### Phase 3: Artwork Import Handler

**Goal**: Implement full artwork creation logic

**Tasks**:

- [ ] Implement `handleArtworkImport()`:
  - [ ] Validate artwork data with schema
  - [ ] Generate UUID for database ID
  - [ ] Store source ID in tags as `source_id`
  - [ ] Extract and sanitize description (Markdown)
  - [ ] Process artist field(s):
    - [ ] Parse single artist or comma-separated list
    - [ ] For each artist:
      - [ ] Search `artists` table by name
      - [ ] If not found, create stub artist record
      - [ ] Collect artist IDs for linking
  - [ ] Store artwork in `artwork` table:
    - [ ] Set status to `approved`
    - [ ] Store lat/lon coordinates
    - [ ] Store all properties in `tags` JSON field
    - [ ] Set created_at, updated_at timestamps
  - [ ] Create artist links in `artwork_artists` table:
    - [ ] Link each artist with role `"artist"`
  - [ ] Build success response with:
    - [ ] Generated UUID
    - [ ] Source ID
    - [ ] Created status
    - [ ] Linked artists (with IDs and names)
- [ ] Write integration tests:
  - [ ] Single artist artwork creation
  - [ ] Multiple artists artwork creation
  - [ ] Auto-create new artist
  - [ ] Link existing artist
  - [ ] Full properties storage
  - [ ] Error handling

**Success Criteria**:

- Artworks created successfully in database
- Artists auto-created when needed
- Artist links created correctly
- All properties stored in tags
- Response includes all expected data
- Tests cover happy path and error cases

### Phase 4: Artist Import Handler

**Goal**: Implement artist creation logic

**Tasks**:

- [ ] Implement `handleArtistImport()`:
  - [ ] Validate artist data with schema
  - [ ] Generate UUID for database ID
  - [ ] Store source ID in tags as `source_id`
  - [ ] Extract and sanitize description/biography (Markdown)
  - [ ] Check if artist exists by name:
    - [ ] If exists, return existing artist info
    - [ ] If not exists, create new artist
  - [ ] Store artist in `artists` table:
    - [ ] Store name, description
    - [ ] Store all properties in `tags` JSON field
    - [ ] Set created_at, updated_at timestamps
  - [ ] Build success response with:
    - [ ] Generated UUID or existing UUID
    - [ ] Source ID
    - [ ] Created or existing status
- [ ] Write integration tests:
  - [ ] New artist creation
  - [ ] Existing artist handling
  - [ ] Full properties storage
  - [ ] Biography sanitization
  - [ ] Error handling

**Success Criteria**:

- Artists created successfully
- Existing artists not duplicated
- All properties stored correctly
- Response includes correct status
- Tests pass

### Phase 5: Photo Upload Handler

**Goal**: Implement photo upload and storage

**Tasks**:

- [ ] Add multipart/form-data parsing support
- [ ] Implement photo validation:
  - [ ] Check file format via magic bytes (JPEG, PNG, WebP)
  - [ ] Validate MIME type
  - [ ] Check file size (max 15MB)
  - [ ] Validate image dimensions (min: 200x200, max: 4096x4096)
- [ ] Implement photo storage:
  - [ ] Generate hash-based filename
  - [ ] Upload to R2: `artworks/YYYY/MM/DD/timestamp-uuid.ext`
  - [ ] Generate public URL
  - [ ] Queue thumbnail generation (async)
- [ ] Update artwork handler to include photos:
  - [ ] Store photo URLs in `photos` JSON array
  - [ ] Include photo info in response
- [ ] Handle photo upload errors:
  - [ ] Return validation errors for invalid photos
  - [ ] Continue with artwork creation if some photos fail
  - [ ] Include photo error details in response
- [ ] Write photo upload tests:
  - [ ] Valid photo upload
  - [ ] Invalid format rejection
  - [ ] Size limit enforcement
  - [ ] Multiple photo upload
  - [ ] Partial failure handling

**Success Criteria**:

- Photos uploaded to R2 successfully
- Photo URLs returned in response
- Invalid photos rejected with clear errors
- Partial failures handled gracefully
- Tests cover all scenarios

### Phase 6: Error Handling & Logging

**Goal**: Implement comprehensive error handling and logging

**Tasks**:

- [ ] Create error response helpers:
  - [ ] `ValidationError` - 400 with field details
  - [ ] `AuthenticationError` - 401 with message
  - [ ] `DatabaseError` - 500 with safe message
  - [ ] `PhotoUploadError` - 400/500 with details
- [ ] Implement try-catch wrappers for:
  - [ ] Database operations
  - [ ] Photo uploads
  - [ ] Artist creation
  - [ ] Artwork creation
- [ ] Add structured logging:
  - [ ] Log all requests (method, path, auth user)
  - [ ] Log validation errors (field, value)
  - [ ] Log database operations (insert, update)
  - [ ] Log photo uploads (filename, size)
  - [ ] Log errors with stack traces
- [ ] Implement verbose logging mode (controlled by env var)
- [ ] Write error handling tests:
  - [ ] Database connection failures
  - [ ] Invalid JSON payloads
  - [ ] Missing required fields
  - [ ] Photo upload failures
  - [ ] Unexpected errors

**Success Criteria**:

- All errors return appropriate HTTP codes
- Error messages are clear and actionable
- Sensitive data not exposed in errors
- All operations logged appropriately
- Error tests pass

### Phase 7: Performance Optimization

**Goal**: Ensure endpoint meets performance targets

**Tasks**:

- [ ] Optimize database queries:
  - [ ] Use prepared statements
  - [ ] Add indexes for artist name lookups
  - [ ] Minimize transaction scope
- [ ] Implement request timeout (60 seconds)
- [ ] Add response time logging
- [ ] Profile endpoint with test data:
  - [ ] Measure response times
  - [ ] Identify bottlenecks
  - [ ] Optimize slow operations
- [ ] Load testing:
  - [ ] Test with 100 sequential requests
  - [ ] Measure average response time
  - [ ] Ensure <500ms for 95th percentile
- [ ] Add performance metrics to response (debug mode)

**Success Criteria**:

- Response time <500ms for 95th percentile
- Database queries <50ms
- Photo upload <3s timeout
- No memory leaks
- Performance tests pass

### Phase 8: Integration Testing

**Goal**: Test endpoint with real scraper data

**Tasks**:

- [ ] Create test data from scraper outputs:
  - [ ] Sample artworks (10-20 items)
  - [ ] Sample artists (5-10 items)
  - [ ] Include edge cases (multiple artists, no photos, etc.)
- [ ] Test against development database:
  - [ ] Import sample artworks
  - [ ] Import sample artists
  - [ ] Verify database records
  - [ ] Check artist linking
  - [ ] Validate photo storage
- [ ] Test error scenarios:
  - [ ] Invalid coordinates
  - [ ] Missing required fields
  - [ ] Malformed GeoJSON
  - [ ] Large photo uploads
- [ ] Performance testing:
  - [ ] Import 100+ items sequentially
  - [ ] Measure total time and avg response time
  - [ ] Monitor database load
- [ ] Document findings and fix issues

**Success Criteria**:

- All sample data imports successfully
- Database records match input data
- Artist linking works correctly
- Photos stored in R2
- Error handling works as expected
- Performance meets targets

## Database Schema Reference

### Artwork Table

```sql
CREATE TABLE artwork (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  tags TEXT, -- JSON with all properties
  photos TEXT, -- JSON array of photo URLs
  status TEXT NOT NULL DEFAULT 'approved',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Artists Table

```sql
CREATE TABLE artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  aliases TEXT, -- JSON array
  tags TEXT, -- JSON with properties
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Artwork_Artists Table

```sql
CREATE TABLE artwork_artists (
  artwork_id TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'artist',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (artwork_id, artist_id),
  FOREIGN KEY (artwork_id) REFERENCES artwork(id),
  FOREIGN KEY (artist_id) REFERENCES artists(id)
);
```

## Implementation Guidelines

### Code Organization

```
src/workers/routes/
  mass-import-v3.ts          # Main endpoint handler
  mass-import-v3/
    artwork-handler.ts        # Artwork import logic
    artist-handler.ts         # Artist import logic
    photo-handler.ts          # Photo upload logic
    validation.ts             # Validation logic
    errors.ts                 # Error classes and handlers
```

### TypeScript Types

```typescript
// Request types
interface ArtworkImportRequest {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: ArtworkProperties;
}

interface ArtistImportRequest {
  type: 'Artist';
  id: string;
  name: string;
  description?: string;
  properties: Record<string, any>;
}

// Response types
interface ImportSuccessResponse {
  success: true;
  data: {
    id: string;
    sourceId: string;
    type: 'artwork' | 'artist';
    status: 'created' | 'existing';
    title?: string;
    artists?: ArtistLink[];
    photos?: PhotoUpload[];
  };
}

interface ImportErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `INVALID_TYPE` | 400 | Request type is not Feature or Artist |
| `VALIDATION_ERROR` | 400 | Data validation failed |
| `INVALID_COORDINATES` | 400 | Coordinates out of range or (0,0) |
| `MISSING_REQUIRED_FIELD` | 400 | Required field is missing |
| `INVALID_PHOTO` | 400 | Photo validation failed |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `PHOTO_UPLOAD_ERROR` | 500 | Photo upload to R2 failed |
| `INTERNAL_ERROR` | 500 | Unexpected error occurred |

## Testing Strategy

### Unit Tests

- Validation functions (coordinates, URLs, fields)
- Sanitization functions (Markdown, strings)
- Error formatters
- Response builders

### Integration Tests

- Full artwork import flow (with database)
- Full artist import flow (with database)
- Artist auto-creation
- Artist linking
- Photo upload (with R2 mock)
- Error handling

### End-to-End Tests

- Import from real scraper output
- Multi-artist artwork import
- Photo upload with validation
- Error scenarios

## Dependencies

### Required Packages

```json
{
  "dependencies": {
    "@cloudflare/workers-types": "^4.20231218.0",
    "hono": "^3.11.0",
    "zod": "^3.22.4"
  }
}
```

### Environment Variables

```toml
[vars]
MASS_IMPORT_LOG_LEVEL = "verbose"
SYSTEM_ADMIN_USER_UUID = "system-admin-uuid"
```

### Cloudflare Bindings

- `DB` - D1 database binding
- `PHOTOS_BUCKET` - R2 bucket for photo storage

## Success Metrics

### Functional Requirements

- ✅ Accept GeoJSON artwork format
- ✅ Accept JSON artist format
- ✅ Validate all required fields
- ✅ Create approved artworks
- ✅ Auto-create artists
- ✅ Link artists to artworks
- ✅ Upload photos to R2
- ✅ Return detailed responses
- ✅ Handle errors gracefully

### Performance Requirements

- Response time <500ms (95th percentile)
- Database operations <50ms
- Photo upload timeout 3s
- Support 100+ req/min throughput

### Quality Requirements

- Test coverage >80%
- All validation errors have clear messages
- No data loss on errors
- Proper audit trail (admin user)
- Secure (auth required, input sanitized)

## Timeline Estimate

- **Phase 1** (Setup & Routing): 1 day
- **Phase 2** (Validation): 1-2 days
- **Phase 3** (Artwork Handler): 2 days
- **Phase 4** (Artist Handler): 1 day
- **Phase 5** (Photo Upload): 2 days
- **Phase 6** (Error Handling): 1 day
- **Phase 7** (Performance): 1 day
- **Phase 8** (Integration Testing): 1-2 days

**Total**: ~10-12 days

## Next Steps After Completion

Once endpoint is complete and tested:

1. **Deploy to development environment**
2. **Test with scraper data** from Phase 1
3. **Proceed to Phase 3**: Develop Mass-Import CLI Runner (see `plan-mass-import-runner.md`)
4. **Integration testing**: Test full scraper → CLI → endpoint flow
5. **Deploy to production**: After successful testing

## Documentation

Create comprehensive API documentation:

- [ ] Update `docs/api.md` with v3 endpoint
- [ ] Add request/response examples
- [ ] Document error codes
- [ ] Add authentication guide
- [ ] Include migration guide from v2
