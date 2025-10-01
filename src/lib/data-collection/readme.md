# Data Collection Scripts — How to add a new site

This document explains how we build small TypeScript data-collection scripts (like the Burnaby Art Gallery collector) inside `src/lib/data-collection`. It gives a pragmatic checklist, recommended structure, patterns, and examples so you can create new collectors for other museum, gallery, or public art websites.

## Goals for a collector

- Produce reproducible, versioned output files under `src/lib/data-collection/<site>/output/`, typically:
  - artworks.geojson (GeoJSON FeatureCollection)
  - artists.json (array of artist metadata)
  - optional debug HTML snapshots for tricky pages
- Be resilient to minor HTML template differences and network flakiness.
- Prefer zero runtime dependencies beyond Node.js and TypeScript when possible (use built-in fetch + fs/promises).
- Be easy to maintain: clear logging, small modules, a single orchestrator script with a configurable limit for development runs.

## Recommended project layout (follow the existing example)

`src/lib/data-collection/<site>/`

- `index.ts`                 — Orchestrator: load config, run steps, write outputs
- `config.json`              — Site-specific configuration (baseUrl, expected counts, throttles)
- `lib/`                     — Small helper modules (scraper, parser, mapper, logger)
   - `scraper.ts`             — fetch wrapper (headers, retry/backoff, rate-limit)
   - `parser.ts`              — HTML parsing functions (artifact and artist detail extractors)
   - `mapper.ts`              — Map parsed data to GeoJSON/features
   - `artist-handler.ts`      — Deduplicate & normalize artist records, handle permalink flow
   - `logger.ts`              — Small structured logger (debug/info/warn/error)
- `test/`                    — Small tests (vitest) for parsers & mappers
- `output/`                  — Consumer output files (ignored by git or committed per policy)
   - `artworks.geojson`
   - `artists.json`

## Design contract (tiny)

 - Input: site base URL + optional CLI `--limit=N`
 - Outputs: `artworks.geojson` and `artists.json` in `output/`
 - Error modes: transient network failures (retry/backoff), missing required fields (log & skip), unknown HTML templates (log warning and save debug snapshot)
 - Success: scripts finish with files written and zero runtime exceptions

## Engineering checklist — steps to implement a new collector

1) Inspect the site manually
   - Use your browser to find the index/list pages. Look for: paginated list, search/list query parameters, and the shape of item links.
   - Find one artwork detail page URL and one artist detail page URL (permalink if available).
   - Save at least one HTML snapshot for each page type to aid parser dev (Tools → Save As).

2) Create minimal config
   - `baseUrl`: root origin (e.g. `https://collections.example.org`)
   - `indexPath`: path or query to list artworks (match what you saw in the browser)
   - `expectedArtworkCount`: optional integer used to detect failures
   - `rateLimitMs`: how long to wait between requests (start 400–600ms)
   - `limitArtworks`: `null | number` (overrideable by CLI)

3) Implement a small fetch wrapper (scraper)
   - Add browser-like request headers (User-Agent, Accept-Language, Accept)
   - Implement retries with exponential backoff for 429/5xx errors
   - Implement a short throttle: await delay(rateLimitMs) between requests
   - Optionally dump HTML to output/debug-*.html when parsing fails

4) Parse index pages to collect artwork URLs
   - Use conservative regex or search for known link anchors
   - Support absolute and relative URLs
   - Deduplicate URLs and normalize (remove trailing slash, decode HTML entities)

5) Parse artwork detail pages
   - Extract title, coordinates (lat/lon), photos, artist links, and other metadata
   - Be defensive: check regex match results before using capture groups
   - If artist links are search/list pages or expand links, prefer finding a permalink to the final artist page and let the orchestrator re-fetch it

6) Artist flow and permalink handling
   - Many sites expose a short summary in search/list pages and a full biography in a permalink detail page. When you detect a permalink on the search/expand page, return it to the orchestrator and fetch the permalink page for final parsing.
   - Normalize artist names and deduplicate by canonical URL if available

7) Mapping to GeoJSON
    - Use a simple mapper that builds Feature objects like:

```json
{
   "type": "Feature",
   "id": "node-id-or-permalink-slug",
   "geometry": { "type": "Point", "coordinates": [lon, lat] },
   "properties": { "title": "...", "artistId": "...", "photos": [], "sourceUrl": "..." }
}
```

    - Validate coordinates exist before writing features (log & skip otherwise)

8) Output and verification
   - Write output files to output/ and include a small final summary log (counts, warnings)
   - For development runs, support --limit=N to only fetch a small number of artworks
   - Add a post-run data quality check (e.g., warn if expectedArtworkCount !== exported count)

9) Testing and QA
   - Add parser unit tests: pass saved HTML snapshots to parser functions and assert the parsed fields
   - Add a simple bio-quality check test: assert no biographies end with an ellipsis and that they exceed N characters
   - Run tests with Vitest (project convention) and add the new test files under test/

10) Deployment and maintenance notes

- Keep rate limits conservative. If running large imports, coordinate with the site.
- Save debug snapshots for any parsing anomalies and add tests to cover them.
- When site templates change, update parsers and re-run snapshot-based tests.

## Implementation tips & pitfalls

- Prefer simple, robust parsing rules over brittle DOM assumptions. Look for labelled `dt`/`dd` pairs or specific semantic sections rather than relying only on element positions.
- Always check capture groups exist before using them.
- Be careful with HTML entities (e.g. `&amp;`, `&nbsp;`) and encoding; decode before using text.
- When in doubt, prefer the longest text candidate for a biography field (search-views often truncate text).
- Avoid heavy dependencies. If parsing becomes complex, you may add a small DOM parser (cheerio) but keep it isolated to `parser.ts`.
- Add logs at debug/info levels that can be toggled. Save HTML of pages that fail to parse for later inspection.

Small code template (orchestrator outline)

- index.ts should roughly follow these steps:
  1) load config + parse CLI --limit
  2) fetch index pages → collect artwork URLs
  3) apply limit (if configured)
  4) for each artwork URL: fetch detail → parse → accumulate artwork objects & artist links
  5) deduplicate artist links → fetch each artist (handle permalink flow) → parse artist details
  6) map artworks to GeoJSON, write files, print summary

## Example CLI usage

```powershell
# Development quick run (first 10 items)
npx tsx src/lib/data-collection/<site>/index.ts --limit=10

# Full run
npx tsx src/lib/data-collection/<site>/index.ts --limit=114
```

## Where to put outputs

- Write outputs to `src/lib/data-collection/<site>/output/`
- Commit outputs only if they are small or required. For large exports, keep them out of git and store externally.

Contributing checklist (PR review)

- New collector has config.json and index.ts
- Parser tests exist and pass
- README.md updated with site-specific notes
- Outputs exist under output/ (or documented where they can be found)

Troubleshooting

- If you see 403 or 429, increase rateLimitMs and ensure scraper uses browser-like headers.
- If biographies are truncated, check for a permalink on the summary/expand page and update the parser to follow it.
- When parsing differences appear between artists, save the HTML snapshot and add a test case.

License and ethics

- Respect robots.txt and the target site terms of service. This repository is for research and archival use; prefer polite, infrequent requests and coordinate large imports with site owners.

## Contact

- Add your notes and site-specific quirks to `src/lib/data-collection/<site>/README.md` so future maintainers can pick up where you left off.


