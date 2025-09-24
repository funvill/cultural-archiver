# Mass-Import API Documentation

## Overview

The Cultural Archiver provides two mass-import endpoints for trusted users (moderators or higher) to import large batches of artworks from public datasets:

### Mass-Import V2 (Recommended)

- **Endpoint:** `/api/mass-import/v2`
- **Features:** Unified schema, CLI plugin integration, enhanced validation, atomic transactions
- **Status:** Production ready with comprehensive testing

### Mass-Import V1 (Legacy)

- **Endpoint:** `/api/mass-import`
- **Status:** Maintained for backward compatibility

Both endpoints are designed for efficient, automated ingestion of hundreds of records at once, such as from city open data sources, with automatic approval under the importing user's credentials.

## Mass-Import V2 Endpoint

### Request Format

```http
POST /api/mass-import/v2
Content-Type: application/json
Authorization: Bearer {admin-token}
```

### Unified Schema

The V2 endpoint uses a unified schema that supports both individual artworks and batch imports:

```json
{
  "items": [
    {
      "artwork": {
        "title": "Victory Monument",
        "description": "Bronze statue commemorating local history",
        "lat": 49.2827,
        "lon": -123.1207,
        "address": "123 Main Street, Vancouver, BC",
        "tags": {
          "artwork_type": "statue",
          "material": "bronze",
          "year": "1995",
          "artist_name": "Jane Doe",
          "height": 5.5,
          "condition": "excellent",
          "access": "yes"
        }
      },
      "artist": {
        "name": "Jane Doe",
        "bio": "Canadian sculptor known for public art installations",
        "website": "https://janedoe.art",
        "tags": {
          "country": "Canada",
          "birth_year": "1965",
          "medium": "sculpture"
        }
      },
      "photos": [
        {
          "url": "https://data.vancouver.ca/photos/victory_monument_1.jpg",
          "caption": "Front view of the monument"
        },
        {
          "url": "https://data.vancouver.ca/photos/victory_monument_2.jpg",
          "caption": "Detail of bronze inscription"
        }
      ]
    }
  ],
  "source": {
    "name": "Vancouver Open Data Portal",
    "url": "https://opendata.vancouver.ca/",
    "license": "CC BY 4.0",
    "attribution": "City of Vancouver Open Data"
  }
}
```

### Field Descriptions

#### Required Fields

- `items`: (array, required) List of items to import
- `items[].artwork`: (object, required) Main artwork data
- `items[].artwork.title`: (string, required) Artwork title
- `items[].artwork.lat`: (number, required) Latitude coordinate
- `items[].artwork.lon`: (number, required) Longitude coordinate

#### Optional Fields

- `items[].artwork.description`: (string) Detailed description
- `items[].artwork.address`: (string) Street address
- `items[].artwork.tags`: (object) Structured metadata tags
- `items[].artist`: (object) Artist information
- `items[].photos`: (array) Image URLs with optional captions
- `source`: (object) Data source attribution

### Enhanced Features

#### CLI Plugin Integration

The V2 endpoint is designed to work with CLI plugins for automated data processing:

```bash
# Example CLI plugin usage
cultural-archiver import vancouver-public-art --format=osm --source="https://opendata.vancouver.ca/"
```

#### Validation and Processing

- **Schema Validation**: Comprehensive validation of all input data
- **Duplicate Detection**: Intelligent detection of similar artworks using location + title + artist matching
- **Photo Processing**: Automatic fetch, validation, and thumbnail generation
- **Tag Normalization**: Structured tag validation and normalization
- **Artist Linking**: Automatic creation and linking of artist records

#### Error Handling

- **Atomic Transactions**: All-or-nothing processing per item
- **Detailed Error Reports**: Specific error messages for failed imports
- **Partial Success**: Continues processing remaining items if some fail
- **Rollback Support**: Automatic cleanup of partial imports on failure

### Response Format

#### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "import_id": "import-uuid",
    "processed_items": 1,
    "successful_imports": 1,
    "failed_imports": 0,
    "results": [
      {
        "status": "success",
        "artwork_id": "artwork-uuid",
        "artist_id": "artist-uuid",
        "photos_imported": 2,
        "created_new_artist": true
      }
    ],
    "processing_time_ms": 1250,
    "source_attribution": {
      "name": "Vancouver Open Data Portal",
      "license": "CC BY 4.0"
    }
  }
}
```

#### Partial Success Response (207 Multi-Status)

```json
{
  "success": true,
  "data": {
    "import_id": "import-uuid",
    "processed_items": 2,
    "successful_imports": 1,
    "failed_imports": 1,
    "results": [
      {
        "status": "success",
        "artwork_id": "artwork-uuid-1",
        "photos_imported": 1
      },
      {
        "status": "error",
        "error": "Invalid coordinates: lat out of range",
        "item_index": 1
      }
    ],
    "processing_time_ms": 850
  }
}
```

#### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": {
    "message": "Schema validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "invalid_fields": [
        {
          "field": "items[0].artwork.lat",
          "error": "Latitude must be between -90 and 90"
        }
      ]
    }
  }
}
```

## Mass-Import V1 (Legacy)

### Request Format

```http
POST /api/mass-import
Content-Type: application/json
Authorization: Bearer {admin-token}
```

### Legacy Payload Structure

```json
{
  "user_uuid": "MODERATOR-USER-UUID-REQUIRED",
  "artwork": {
    "title": "Artwork Title",
    "description": "Description...",
    "lat": 49.2827,
    "lon": -123.1207,
    "photos": [{ "url": "https://..." }]
  },
  "submissions": [
    {
      "submission_type": "logbook_entry",
      "note": "Installed in 2020",
      "tags": { "event": "installation", "material": "bronze" }
    }
  ]
}
```

### Legacy Field Descriptions

- `user_uuid`: (string, required) UUID of the moderator or admin performing the import
- `artwork`: (object, required) Main artwork data with title, description, coordinates, and photos
- `submissions`: (array, optional) Submission entries to attach to the artwork

## Behavior and Processing

### Authentication and Authorization

- **Admin Access Required**: Only users with admin role can access mass-import endpoints
- **User Attribution**: All imported records are attributed to the importing user
- **Automatic Approval**: All imported content is automatically approved and published

### Data Processing

- **Photo Handling**: Images are fetched from URLs, stored in Cloudflare R2, and thumbnails generated
- **Artist Management**: Artists are automatically created if they don't exist, or linked if they do
- **Tag Processing**: Structured tags are validated and stored as JSON objects
- **Coordinate Validation**: GPS coordinates are validated for valid ranges

### Duplicate Detection

- **Location-Based**: Uses spatial indexing to detect nearby existing artworks
- **Multi-Signal Matching**: Combines location, title, and artist name for duplicate detection
- **Threshold-Based**: Configurable similarity thresholds for automatic duplicate detection

## Response Codes

| Code                        | Description                       | Scenario                  |
| --------------------------- | --------------------------------- | ------------------------- |
| `201 Created`               | All items imported successfully   | Complete success          |
| `207 Multi-Status`          | Some items succeeded, some failed | Partial success           |
| `400 Bad Request`           | Invalid request format or data    | Schema validation failure |
| `401 Unauthorized`          | Missing or invalid authentication | No admin token            |
| `403 Forbidden`             | Insufficient permissions          | Non-admin user            |
| `429 Too Many Requests`     | Rate limit exceeded               | Throttling active         |
| `500 Internal Server Error` | Server-side processing error      | System failure            |

## Best Practices

### Data Preparation

1. **Validate Coordinates**: Ensure latitude/longitude are within valid ranges
2. **Clean URLs**: Verify all photo URLs are accessible and return valid images
3. **Normalize Tags**: Use consistent tag naming and values
4. **Source Attribution**: Always include proper source attribution for legal compliance

### Batch Processing

1. **Reasonable Batch Sizes**: Limit batches to 50-100 items for optimal performance
2. **Error Handling**: Implement retry logic for failed imports
3. **Progress Monitoring**: Track import progress and handle timeouts appropriately
4. **Data Validation**: Pre-validate data before submission to reduce failures

### CLI Integration

1. **Plugin Development**: Develop CLI plugins for specific data sources
2. **Configuration Management**: Use configuration files for repeated imports
3. **Logging**: Implement comprehensive logging for audit trails
4. **Testing**: Test with small batches before large imports

## Example Request

```
POST /api/mass-import
Content-Type: application/json

{
  "user_uuid": "MODERATOR-USER-UUID-REQUIRED",
  "artwork": {
    "title": "Vancouver Sculpture",
    "description": "A public artwork in Vancouver.",
    "lat": 49.2827,
    "lon": -123.1207,
    "photos": [
      { "url": "https://example.com/photo.jpg" }
    ]
  },
  "submissions": [
    {
      "submission_type": "logbook_entry",
      "note": "Installed in 2020",
      "tags": { "event": "installation", "material": "bronze" }
    }
  ]
}
```

## Security

- Only users with moderator or admin privileges (verified by UUID) can access this endpoint.
- All imported data is attributed to the importing user for audit purposes.

## Notes

- This endpoint is intended for trusted, high-volume imports only. For regular submissions, use the standard artwork submission API.
- See `/docs/api.md` for general API usage and authentication details.
