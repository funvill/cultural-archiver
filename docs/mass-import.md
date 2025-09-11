# Mass-Import API Documentation

## Overview
The Mass-Import API endpoint allows trusted users (moderators or higher) to import large batches of artworks, including images and logbook entries (with tags), from public datasets. This endpoint is designed for efficient, automated ingestion of hundreds of records at once, such as from city open data sources.

- **Endpoint:** `/api/mass-import`
- **Method:** `POST`
- **Authentication:** Requires a valid user UUID for a moderator or higher. The UUID must be included in the request for authentication and auditing. All imported records are automatically approved under this user.
- **Rate Limiting:** None (trusted access only).

## Payload Structure

```
{
  "user_uuid": "MODERATOR-USER-UUID-REQUIRED",
  "artwork": {
    "title": "Artwork Title",
    "description": "Description...",
    "lat": 49.2827,
    "lon": -123.1207,
    "photos": [
      { "url": "https://..." }
    ]
  },
  "logbook": [
    {
      "note": "Installed in 2020",
      "timestamp": "2020-06-01T00:00:00Z",
      "tags": [{ "label": "event", "value": "installation" }]
    }
  ]
}
```

### Field Descriptions
- `user_uuid`: (string, required) UUID of the moderator or admin performing the import. All imported records are attributed to this user and are automatically approved.
- `artwork`: (object, required) Main artwork data. Includes title, description, coordinates, and photos.
  - `photos`: (array) List of image URLs to import. The system will fetch, store, and generate thumbnails for each image.
- `logbook`: (array, optional) Logbook entries to attach to the artwork. Each entry can include notes, timestamps, and tags (label/value pairs for metadata).

## Behavior
- All imported artworks, logbook entries, and images are automatically approved and published under the provided user UUID.
- The endpoint processes each record atomically: if any part fails (e.g., image fetch error), the entire import for that record is rolled back.
- Images are fetched from provided URLs, stored in Cloudflare R2, and thumbnails are generated.
- Tags are attached to logbook entries as specified.

## Response
- **201 Created**: On success, returns the new artwork ID and status.
- **4xx/5xx**: On error, returns a descriptive error message. Partial failures are not allowed; all-or-nothing per record.

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
  "logbook": [
    {
      "note": "Installed in 2020",
      "timestamp": "2020-06-01T00:00:00Z",
      "tags": [{ "label": "event", "value": "installation" }]
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
