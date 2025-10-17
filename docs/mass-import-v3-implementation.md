# Mass Import v3 Implementation Summary

**Status**: ✅ Phases 1-4 Complete (55/55 tests passing)

## Overview

Mass Import v3 is a RESTful endpoint that accepts individual artwork (GeoJSON Feature) or artist (JSON) items for import into the Cultural Archiver database. This replaces the batch-based v2 system with a simpler, more reliable single-item approach.

## Completed Phases

### Phase 1: Endpoint Setup & Routing (10 tests) ✅
- **Location**: `src/workers/routes/mass-import-v3.ts`
- **Features**:
  - Authentication middleware (Bearer token + admin role required)
  - Type detection (artwork vs artist based on `type` field)
  - Request routing to appropriate handlers
  - Error handling with structured responses
- **Tests**: Authentication, type detection, routing, error responses

### Phase 2: Validation Layer (33 tests) ✅
- **Location**: `src/workers/routes/mass-import-v3/validation.ts`
- **Features**:
  - Zod schemas for artwork and artist validation
  - Coordinate validation (-180 to 180 lon, -90 to 90 lat)
  - URL validation for source URLs
  - Required field enforcement (title, coordinates for artwork; name for artist)
  - Optional field handling (description, tags, properties)
- **Tests**: Valid/invalid data, missing fields, edge cases, error messages

### Phase 3: Artwork Import Handler (7 tests) ✅
- **Location**: `src/workers/routes/mass-import-v3/artwork-handler.ts`
- **Features**:
  - GeoJSON Feature processing
  - Markdown sanitization for descriptions
  - UUID generation for artwork IDs
  - Tag storage (source ID, properties)
  - Auto-creation of artists from artist field
  - Artist linking via `artwork_artists` junction table
  - Support for comma-separated multiple artists
  - Existing artist detection and linking
- **Database Operations**:
  - `INSERT INTO artwork` - Creates artwork records
  - `SELECT FROM artists` - Checks for existing artists by name
  - `INSERT INTO artists` - Auto-creates missing artists
  - `INSERT INTO artwork_artists` - Links artists to artwork

### Phase 4: Artist Import Handler (5 tests) ✅
- **Location**: `src/workers/routes/mass-import-v3/artist-handler.ts`
- **Features**:
  - JSON artist record processing
  - Markdown sanitization for biographies
  - UUID generation for artist IDs
  - Tag storage (source ID, aliases, properties)
  - Duplicate detection by name (case-insensitive)
  - Returns existing artist ID if duplicate found
- **Database Operations**:
  - `SELECT FROM artists` - Checks for existing artist by name
  - `INSERT INTO artists` - Creates new artist records

## API Specification

### Endpoint
```
POST /api/mass-import/v3
Authorization: Bearer <admin-token>
Content-Type: application/json
```

### Request Body - Artwork (GeoJSON Feature)
```json
{
  "type": "Feature",
  "id": "node/publicart117",
  "geometry": {
    "type": "Point",
    "coordinates": [-123.123, 49.282]
  },
  "properties": {
    "title": "Artwork Title",
    "description": "Optional description with **markdown**",
    "artist": "Artist Name",  // Optional, can be comma-separated for multiple
    "source": "osm",
    "source_url": "https://example.com",
    "artwork_type": "statue",
    "material": "bronze"
  }
}
```

### Request Body - Artist
```json
{
  "type": "Artist",
  "id": "artist-123",
  "name": "Artist Name",
  "properties": {
    "description": "Artist biography with **markdown**",
    "source": "vancouver",
    "source_url": "https://example.com",
    "country": "Canada",
    "website": "https://artist.com"
  }
}
```

### Response - Success
```json
{
  "success": true,
  "data": {
    "id": "806a8ac9-264a-4718-b910-6b4c2c10669a",
    "type": "artwork",  // or "artist"
    "status": "created",  // or "existing" for duplicate artists
    "linkedArtists": [  // Only for artworks
      {
        "id": "artist-uuid",
        "name": "Artist Name",
        "status": "created"  // or "existing"
      }
    ],
    "sourceId": "node/publicart117"
  }
}
```

### Response - Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed: Missing required field",
    "details": {
      "field": "title",
      "errors": ["Title is required"]
    }
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing/invalid token or non-admin user |
| `INVALID_TYPE` | 400 | Type must be "Feature" or "Artist" |
| `VALIDATION_ERROR` | 400 | Invalid data (coordinates, URLs, required fields) |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `INTERNAL_ERROR` | 500 | Unexpected error occurred |

## Utility Functions

**Location**: `src/workers/routes/mass-import-v3/utils.ts`

- `sanitizeMarkdown(text: string)`: Strips dangerous HTML, preserves basic markdown
- `parseArtistField(artist: string)`: Splits comma-separated artist names
- `generateUUID()`: Creates UUIDs for new records
- `formatValidationErrors(error: ZodError)`: Formats Zod errors for API responses
- `buildTagsObject(sourceId, properties)`: Constructs tags JSON from properties

## Testing

### Test Files
1. **`mass-import-v3.test.ts`** (10 tests) - Phase 1 routing and authentication
2. **`mass-import-v3-validation.test.ts`** (33 tests) - Phase 2 validation schemas
3. **`mass-import-v3-integration.test.ts`** (12 tests) - Phases 3 & 4 database operations

### Test Coverage
- ✅ Authentication and authorization
- ✅ Request type detection
- ✅ Validation for all fields
- ✅ Artwork creation with auto-artist creation
- ✅ Artist linking (new and existing)
- ✅ Multiple artists (comma-separated)
- ✅ Markdown sanitization
- ✅ Tag storage
- ✅ Duplicate artist detection
- ✅ Error handling and responses

### Running Tests
```powershell
npm run test:workers -- mass-import-v3  # Run v3 tests only
npm run test:workers                    # Run full test suite
```

## Pending Phases

### Phase 5: Photo Upload Handler
- **Features**: Multipart form-data parsing, photo validation, R2 storage, thumbnail generation
- **Status**: Not started

### Phase 6: Enhanced Error Handling & Logging
- **Features**: Structured logging, verbose mode, comprehensive error context
- **Status**: Basic error handling in place, enhancements pending

### Phase 7: Performance Optimization
- **Features**: Query optimization, prepared statements, profiling, <500ms 95th percentile
- **Status**: Not started

### Phase 8: Integration Testing
- **Features**: Real scraper data testing, production database validation, load testing
- **Status**: Not started

## Usage Example

```typescript
// Import artwork with auto-created artist
const response = await fetch('https://api.publicartregistry.com/mass-import/v3', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer admin-token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'Feature',
    id: 'node/osm123',
    geometry: {
      type: 'Point',
      coordinates: [-123.123, 49.282]
    },
    properties: {
      title: 'Beautiful Sculpture',
      description: 'A magnificent bronze sculpture',
      artist: 'Jane Doe',
      source: 'osm',
      source_url: 'https://osm.org/node/123',
      artwork_type: 'sculpture',
      material: 'bronze'
    }
  })
});

const result = await response.json();
// {
//   "success": true,
//   "data": {
//     "id": "artwork-uuid",
//     "type": "artwork",
//     "status": "created",
//     "linkedArtists": [{
//       "id": "artist-uuid",
//       "name": "Jane Doe",
//       "status": "created"
//     }],
//     "sourceId": "node/osm123"
//   }
// }
```

## Architecture Decisions

1. **Single-item imports**: Simpler error handling and recovery than batch imports
2. **Auto-artist creation**: Reduces complexity for scrapers, ensures artist records exist
3. **Duplicate detection**: Name-based for artists prevents duplicates, case-insensitive
4. **Tag storage**: Preserves source metadata in JSON tags for audit trail
5. **Markdown sanitization**: Security + user-friendly rich text in descriptions
6. **Zod validation**: Type-safe validation with excellent error messages

## Next Steps

1. ✅ **Complete Phases 1-4**: Done! All 55 tests passing
2. ⏳ **Phase 5**: Implement photo upload handler for artwork images
3. ⏳ **Phase 6**: Add structured logging and enhanced error context
4. ⏳ **Phase 7**: Optimize database queries and add performance monitoring
5. ⏳ **Phase 8**: Test with real scraper data and validate in production

## Files Created/Modified

### New Files
- `src/workers/routes/mass-import-v3.ts` - Main endpoint handler
- `src/workers/routes/mass-import-v3/errors.ts` - Error types and utilities
- `src/workers/routes/mass-import-v3/validation.ts` - Zod schemas
- `src/workers/routes/mass-import-v3/utils.ts` - Helper functions
- `src/workers/routes/mass-import-v3/artwork-handler.ts` - Artwork import logic
- `src/workers/routes/mass-import-v3/artist-handler.ts` - Artist import logic
- `src/workers/routes/__tests__/mass-import-v3.test.ts` - Phase 1 tests
- `src/workers/routes/__tests__/mass-import-v3-validation.test.ts` - Phase 2 tests
- `src/workers/routes/__tests__/mass-import-v3-integration.test.ts` - Phases 3 & 4 tests

### Modified Files
- `src/workers/index.ts` - Registered `/api/mass-import/v3` route

## Performance Characteristics

**Current Implementation** (Phase 4):
- Single database transaction per artwork/artist
- Auto-artist creation adds 1 SELECT + 1 INSERT per new artist
- Multiple artists add N SELECT + M INSERT operations
- No batch optimization yet (Phase 7)

**Target Performance** (Phase 7):
- <500ms 95th percentile for single-item imports
- <100ms for duplicate artist detection
- Prepared statement caching
- Connection pooling optimization

## Security

- ✅ Admin-only access via Bearer token authentication
- ✅ Markdown sanitization prevents XSS attacks
- ✅ Zod validation prevents injection attacks
- ✅ Coordinate bounds validation
- ✅ URL format validation
- ⏳ Rate limiting (future enhancement)
- ⏳ Request size limits (future enhancement)
