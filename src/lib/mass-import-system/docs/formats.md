# Mass Import Formats

This document describes the file formats consumed by the mass-import-system importers:

- `artwork.geojson` — used by `src/lib/mass-import-system/importers/osm-artwork.ts`.
- `artists.json` — used by `src/lib/mass-import-system/importers/artist-json.ts`.

Each importer expects JSON in a predictable shape. The examples below show a minimal valid payload and a richer example. Fields are marked `required` or `optional` and include the expected type.

## artwork.geojson (GeoJSON FeatureCollection)

Purpose: a GeoJSON FeatureCollection where each Feature represents a single artwork with geometry (Point) and a `properties` object containing metadata.

Required outer structure:

- A top-level GeoJSON FeatureCollection object.
- Each Feature must have a `Point` geometry with coordinates in [longitude, latitude] order.

Minimal valid example (smallest accepted file):

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [ -123.1207, 49.2827 ] },
      "properties": {
        "id": "osm-way-12345",
        "title": "Untitled Sculpture",
        "city": "Vancouver",
        "source": "osm",
        "source_id": "way/12345"
      }
    }
  ]
}
```

Richer example with common fields:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [ -123.1207, 49.2827 ] },
      "properties": {
        "id": "osm-node-987654321",
        "title": "Public Art: The Wave",
        "description": "Bronze sculpture by Jane Doe located in the plaza.",
        "start_date": "1998",
        "end_date": null,
        "artistNames": "Jane Doe",
        "artistIds": "",
        "tags": ["sculpture","bronze","public-art"],
        "materials": ["bronze"],
        "photos": [
          "https://example.com/photos/wave-1.jpg",
          "https://example.com/photos/wave-2.jpg"
        ],
        "city": "Vancouver",
        "province": "British Columbia",
        "country": "Canada",
        "source": "osm",
        "source_id": "node/987654321",
        "canonical_url": "https://www.openstreetmap.org/node/987654321"
      }
    }
  ]
}
```

Field reference (artwork Feature properties)

- id (string) — recommended unique id for the source (e.g. `osm-node-123`, `osm-way-456`). Optional but helpful; importer will use `source`+`source_id` when missing.
- title (string) — short human-readable title or name.
- description (string | optional) — text describing the artwork or notes.
- start_date (string | optional) — year or ISO date when the artwork was installed (e.g. `1998` or `1998-05-20`).
- end_date (string | optional) — if removed or ephemeral.
- artistNames (string or array | optional) — artist name(s). The importer supports a comma-separated string or JSON array.
- artistIds (string | optional) — IDs that match `artists.json` entries or source identifiers; can be comma-separated or array.
- tags (array[string] | optional) — free-form tags.
- materials (array[string] | optional) — physical materials (e.g. `bronze`, `wood`).
- photos (array[string] | optional) — full URLs to photos. The importer expects absolute URLs (http(s)).
- city, province, country (string) — optional location metadata used to tag imports; useful when sourcing from region-specific dumps.
- source (string) — required source name (e.g. `osm`, `burnaby`, `vancouver-open-data`).
- source_id (string) — required identifier from the source (e.g. `node/12345`, `way/6789`, or provider-specific id). Used to deduplicate imports.
- canonical_url (string | optional) — link to the original page or dataset entry.

Notes & behavior

- Coordinates must be numbers in [longitude, latitude] order.
- If `artistIds` is provided, the importer will try to link to the `artists.json` entries by id. If `artistNames` is provided instead, the importer will attempt to find or create matching artist records using those names.
- Photos should be public, reachable URLs. Relative paths or URLs with query-parameters that restrict size (e.g. `?width=280`) may lead to truncated images; prefer full-sized image URLs.
- The importer treats `source`+`source_id` as the canonical provenance key and will update existing records if the same key is seen again.

## artists.json

Purpose: a JSON file that contains an array (or object with top-level `artists` array) of artist objects used to link artworks to artist metadata.

Minimal example (array form):

```json
[
  {
    "id": "artist-joe-fafard",
    "name": "Joe Fafard",
    "bio": "Canadian sculptor known for animal forms.",
    "birth_date": "1942",
    "death_date": "2020",
    "aliases": ["J. Fafard"],
    "website": "https://example-artist-site.com",
    "wikidata": "Q123456"
  }
]
```

Alternative top-level shape (object with `artists`):

```json
{
  "artists": [ /* same objects as above */ ]
}
```

Field reference (artist object)

- id (string | required) — unique ID to reference an artist from artworks. Use stable, non-changing IDs (e.g. `artist-joe-fafard`, `wikidata-Q123456`). If the importer cannot match by `id`, it will fall back to matching by `name`.
- name (string | required) — display name, e.g. `Joe Fafard`.
- bio (string | optional) — textual biography.
- birth_date (string | optional) — year or full ISO date.
- death_date (string | optional) — year or full ISO date.
- aliases (array[string] | optional) — alternate names or previous names.
- website (string | optional) — official website.
- wikidata (string | optional) — wikidata id (e.g. `Q12345`). Helps linking and enrichment.
- photos (array[string] | optional) — image URLs for the artist portrait or work samples.
- source (string | optional) — provenance/source name (e.g. `burnaby-collection`).
- source_id (string | optional) — source-specific id for the artist.

Notes & behavior

- The importer will use `id` first to link artists to artworks. If `artistIds` in artworks contain these ids (comma-separated or array), links are made directly.
- If there is no `id` match, the importer will attempt case-insensitive name matching using `name` and `aliases`.
- Keep `id` values stable across imports to prevent duplicate artist records.

## Common tips for data-collection scripts

- Produce absolute photo URLs and avoid size-limited query parameters when possible.
- Normalize artist names (e.g. convert `Fafard, Joe` → `Joe Fafard`) before emitting `artists.json` or `artistNames`.
- Include `source` and `source_id` on every artwork so imports are idempotent.
- Validate GeoJSON with a quick script (ensure geometry exists and coordinates are numeric).

## Quick validation checklist

Before handing files to the mass-import system, ensure:

- The top-level JSON is parseable.
- GeoJSON Features have `Point` geometry and numeric [lon, lat] coordinates.
- Every artwork has `source` and `source_id`.
- Photo URLs are reachable and absolute.
- `artists.json` uses a consistent `id` scheme and matches any `artistIds` referenced by artworks.

---

If you want, I can also add a small Node script in this folder that validates the two files automatically and reports common issues. Add that as a follow-up if helpful.
