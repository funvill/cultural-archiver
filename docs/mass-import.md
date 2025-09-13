# Mass-Import API Documentation

## Overview
The Mass-Import API endpoint allows trusted users (moderators or higher) to import large batches of artworks, including images and submissions, from public datasets. This endpoint is designed for efficient, automated ingestion of hundreds of records at once, such as from city open data sources.

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
  "submissions": [
    {
      "submission_type": "logbook_entry",
      "note": "Installed in 2020",
      "tags": { "event": "installation", "material": "bronze" }
    }
  ]
}
```

### Field Descriptions
- `user_uuid`: (string, required) UUID of the moderator or admin performing the import. All imported records are attributed to this user and are automatically approved.
- `artwork`: (object, required) Main artwork data. Includes title, description, coordinates, and photos.
  - `photos`: (array) List of image URLs to import. The system will fetch, store, and generate thumbnails for each image.
- `submissions`: (array, optional) Submission entries to attach to the artwork. Each entry can include notes and structured tags as a JSON object.

## Behavior
- All imported artworks, submissions, and images are automatically approved and published under the provided user UUID.
- The endpoint processes each record atomically: if any part fails (e.g., image fetch error), the entire import for that record is rolled back.
- Images are fetched from provided URLs, stored in Cloudflare R2, and thumbnails are generated.
- Tags are stored as structured JSON objects within submissions.

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
