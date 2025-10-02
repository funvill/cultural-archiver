# New Westminster — Data Collection Planning

This document outlines a pragmatic plan to implement a data-collection script for the City of New Westminster Public Art Registry found at:

https://www.newwestcity.ca/public-art-registry

Goal: produce reproducible outputs under `src/lib/data-collection/newwest/output/` including `artworks.geojson` and `artists.json` and small debug HTML snapshots when parsing fails.

## Quick site notes

- Base URL: `https://www.newwestcity.ca`
- Registry index: `/public-art-registry` — contains a searchable listing of public art entries and filters.
- Each artwork appears to have a detail page (permalink). The index includes cards or rows linking to details.
- Photos may be hosted on the same domain or an external CDN.

Note: Inspect the site manually and save at least one HTML snapshot for the index and one artwork detail page before starting implementation.

## Design contract (tiny)

- Input: baseUrl + optional CLI `--limit=N`
- Outputs: `artworks.geojson` (GeoJSON FeatureCollection) and `artists.json` (array)
- Error modes: transient network failures (retry/backoff), missing coords (log & skip), unknown templates (save debug snapshot)
- Success: scripts finish with files written and no runtime exceptions

## Project layout (follow project conventions)

src/lib/data-collection/newwest/
- index.ts — Orchestrator
- config.json — site config (baseUrl, indexPath, rateLimitMs, expected counts)
- lib/
  - scraper.ts — fetch wrapper (headers + retries + throttle)
  - parser.ts — parse index and detail pages
  - mapper.ts — build GeoJSON and normalize fields
  - artist-handler.ts — dedupe/normalize artists
  - logger.ts — small structured logger
- test/ — Vitest parser tests using saved HTML snapshots
- output/ — outputs (artworks.geojson, artists.json, debug-html/)

## Config template (config.json)

Use a `config.json` like this as a starting point:

{
  "baseUrl": "https://www.newwestcity.ca",
  "indexPath": "/public-art-registry",
  "rateLimitMs": 500,
  "limitArtworks": null,
  "expectedArtworkCount": null
}

Set `limitArtworks` via CLI for development runs: `--limit=10`.

## Scraper behavior

- Use built-in fetch with browser-like headers (User-Agent, Accept-Language, Accept)
- Retry on 429/5xx with exponential backoff (3 attempts default)
- Throttle between requests using `rateLimitMs` (default 500ms)
- Save HTML snapshots to `output/debug/html/` when parsing fails or when a 4xx/5xx is received

## Parsing strategy

1. Index parsing
   - Parse `/public-art-registry` and any paginated or AJAX-backed pages to collect artwork detail URLs
   - Look for anchor elements containing `/public-art-registry/` or obvious permalink patterns
   - Support both relative and absolute links; normalize and deduplicate

2. Artwork detail parsing
   - Extract fields: title, artist name(s) and artist page/permalink (if present), description, year (if present), photos (URLs), coordinates (lat/lon)
   - Coordinates: find explicit lat/lon attributes, or look for embedded map widgets, or fallback to address parsing if available (less preferred)
   - If coordinates are missing, log and save a debug snapshot; skip writing a GeoJSON feature unless coordinates can be derived

3. Artist flow
   - If an artist permalink is present, fetch the permalink and parse biography, birth/death years, and canonical URL
   - Deduplicate artists by canonical URL or normalized name

4. Photos
   - Collect full-resolution URLs when available and also store an 800px thumbnail URL if provided
   - Avoid downloading images during the main collection run (just store URLs). If a later processing pipeline needs images, create a separate ingestion job.

## Mapping to GeoJSON

- Each artwork becomes a Feature with:
  - id: permalink slug or artwork id
  - geometry: Point [lon, lat]
  - properties: { title, artistIds, year, photos, sourceUrl, parsedAt }

- Validate coordinates before including features; otherwise, collect into a `missing_coords.json` for manual review.

## Output files

- `output/artworks.geojson` — FeatureCollection of all artworks with valid coordinates
- `output/artists.json` — array of artist objects: { id, name, canonicalUrl, bio, parsedAt }
- `output/debug/html/` — saved HTML snapshots when parse failures occur

## Tests

- Add Vitest tests under `test/` that run parser functions on saved HTML snapshots for index and detail pages.
- Test expectations: title, coords (if present in snapshot), artist permalink detection, and photo URL extraction.

## CLI examples

npx tsx src/lib/data-collection/newwest/index.ts --limit=10
npx tsx src/lib/data-collection/newwest/index.ts  # full run (be respectful — use reasonable rate limit)

## Edge cases & notes

- The registry may include temporary exhibits or seasonal items — include a `status` property if available
- If the website uses client-side rendering to populate the list (AJAX), consider reverse-engineering the JSON API used by the page and calling that instead of scraping HTML
- If coordinates are only available via embedded map widgets (Leaflet/Google Maps), inspect network calls or embedded data attributes for a direct source

## Implementation Status

✅ **Completed:**
- Project structure created
- Configuration file (`config.json`)
- Orchestrator script (`index.ts`) with `--limit` support
- Helper modules:
  - `scraper.ts` - HTTP client with rate limiting and retry logic
  - `parser.ts` - HTML parser (STUB implementation)
  - `mapper.ts` - GeoJSON transformer
  - `artist-handler.ts` - Artist deduplication
  - `logger.ts` - Structured logging
- Test scaffolding (`test/parser.test.ts`)
- Output directories

⚠️ **TODO - CRITICAL:**

1. **Inspect the actual website** and save HTML snapshots:
   - Visit <https://www.newwestcity.ca/public-art-registry>
   - Save the index page HTML to `test/snapshots/index.html`
   - Find at least 2-3 artwork detail pages and save to `test/snapshots/artwork-*.html`
   - If artist pages exist, save to `test/snapshots/artist-*.html`

2. **Update `lib/parser.ts` with real selectors:**
   - The current implementation uses STUB patterns that won't work
   - Inspect the saved HTML snapshots to find:
     - Title selectors (class names, element structure)
     - Coordinate sources (data attributes, embedded maps, scripts)
     - Description/biography fields
     - Photo URLs
     - Artist links
   - Update regex patterns and selector logic in parser methods

3. **Run a test collection:**
   ```powershell
   npx tsx src/lib/data-collection/newwest/index.ts --limit=5
   ```
   - Check `output/artworks.geojson` for valid data
   - Review debug snapshots in `output/debug/html/` if parsing fails
   - Iterate on parser selectors until data looks correct

4. **Write real tests:**
   - Update `test/parser.test.ts` to use saved snapshots
   - Add assertions for all extracted fields
   - Run tests: `npm run test`

5. **Full collection run:**
   ```powershell
   npx tsx src/lib/data-collection/newwest/index.ts
   ```

## Next steps (implementation plan)

1. Save sample HTML snapshots for index and a few artwork pages. Put them under `test/snapshots/`.
2. ~~Implement `config.json` and `index.ts` orchestrator with `--limit` support.~~ ✅ Done
3. ~~Implement `scraper.ts` and `parser.ts` iteratively, adding tests as you go.~~ ⚠️ Stub created - needs real selectors
4. Run a development run with `--limit=10` and iterate until outputs look correct.
5. Add documentation to `/docs/` if anything new or surprising is discovered.

## Contacts & etiquette

- Respect robots.txt and site terms. Use conservative rate limits and contact site maintainers for large imports.

---

End of planning document. Add site-specific quirks and selector notes to this README as you discover them while implementing.
