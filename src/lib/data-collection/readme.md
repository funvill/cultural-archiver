See TAG_DEFINITIONS in src\shared\tag-schema.ts for a list of default tags


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
   "properties": { 
      "title": "...", 
      "artistId": "...", 
      "photos": [], 
      "sourceUrl": "..." 
   }
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

## Pagination strategies (lessons learned)

Different sites use different pagination patterns. Here are common approaches and how to handle them:

### 1. **"Next" button pagination** (e.g., New Westminster)
   - Site shows only "Previous" and "Next" buttons, no numbered page links
   - Strategy: Follow "Next" button sequentially until it disappears
   - Implementation:
     ```typescript
     let currentPageUrl: string | null = indexUrl;
     let pageNumber = 1;
     
     while (currentPageUrl !== null) {
       const html = await scraper.fetch(currentPageUrl);
       const urls = parser.parseArtworkIndex(html, config.baseUrl);
       allArtworkUrls.push(...urls);
       
       // Look for Next button: <a href="...">Next</a>
       const nextUrl = parser.extractNextPageUrl(html, config.baseUrl);
       if (nextUrl) {
         currentPageUrl = nextUrl;
         pageNumber++;
       } else {
         currentPageUrl = null; // Last page reached
       }
     }
     ```
   - Pattern to detect: `/<a[^>]*href=["']([^"']+)["'][^>]*>\s*Next\s*<\/a>/i`
   - Be careful: "Next" URLs can be relative or absolute, always normalize to absolute

### 2. **Numbered page links** (e.g., `page2.php`, `page3.php`)
   - Site includes links to specific page numbers
   - Strategy: Detect all page numbers upfront from first page HTML
   - Implementation:
     ```typescript
     const pagePattern = /href=["'][^"']*\/page(\d+)\.php["']/gi;
     let maxPage = 1;
     let match;
     while ((match = pagePattern.exec(html)) !== null) {
       const pageNum = parseInt(match[1], 10);
       if (pageNum > maxPage) maxPage = pageNum;
     }
     ```
   - Then iterate from page 1 to maxPage

### 3. **Query parameter pagination** (e.g., `?page=2`, `?offset=20`)
   - Site uses URL query parameters for pagination
   - Strategy: Construct URLs programmatically
   - Implementation:
     ```typescript
     for (let page = 1; page <= totalPages; page++) {
       const pageUrl = `${indexUrl}?page=${page}`;
       // or: const pageUrl = `${indexUrl}?offset=${(page-1) * resultsPerPage}`;
       const html = await scraper.fetch(pageUrl);
       // ...
     }
     ```

### 4. **JavaScript/AJAX pagination**
   - Site loads more results via JavaScript (infinite scroll, "Load More" button)
   - Strategy: Use Playwright MCP to interact with page and extract rendered HTML
   - Implementation: More complex, requires browser automation
   - Consider: Check if site has an API endpoint that JavaScript calls (inspect Network tab)

### 5. **No pagination indicator**
   - Site shows all results on one page, or doesn't indicate total pages
   - Strategy: Follow "Next" button until it disappears (safest approach)
   - Fallback: Try fetching subsequent pages until you get 404 or empty results

### Best practices for pagination:

1. **Always use browser inspection first** (Playwright MCP or browser DevTools)
   - Navigate to page 2 manually to see actual URL structure
   - Check if pagination uses buttons, numbered links, or query params
   - Look for pagination HTML structure (table, div, nav element)

2. **Log pagination progress clearly**:
   ```typescript
   logger.info(`Processing page ${pageNumber}...`);
   logger.info(`  Found ${urls.length} artworks on page ${pageNumber} (total: ${allArtworkUrls.length})`);
   ```

3. **Handle edge cases**:
   - Empty pages (no artworks found)
   - Duplicate URLs across pages (use Set for deduplication)
   - Relative vs absolute URLs (always normalize)
   - URL encoding issues (decode HTML entities)

4. **Validate final count**:
   ```typescript
   if (config.validation.expectedArtworkCount && 
       uniqueArtworkUrls.length !== config.validation.expectedArtworkCount) {
     logger.warn(`⚠️  Expected ${config.validation.expectedArtworkCount} artworks but found ${uniqueArtworkUrls.length}`);
   }
   ```

5. **Test with small limits first**:
   - Run with `--limit=5` to verify pagination is working
   - Check logs for correct page progression
   - Verify total artwork count matches expectations before full run

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

## Common parsing patterns and tips

### Photo extraction
- **Lazy-loaded images**: Check for `data-src`, `data-thumb`, `data-lazy` attributes in addition to `src`
- **Image galleries**: Look for slideshow/carousel containers (`.slideshow`, `.gallery`, `.carousel`)
- **Thumbnail filtering**: Exclude thumbnails, icons, logos (patterns: `_thumb`, `thumb_`, `icon_`, `logo`, `banner`)
- **URL normalization**: Always convert relative URLs to absolute using `new URL(relativeUrl, baseUrl).href`
- **Base domain extraction**: For photos in different directory, extract base domain: `/^(https?:\/\/[^\/]+)/.exec(url)`

### Coordinates extraction
- **Google Maps embeds**: Search for patterns in script tags: `new google.maps.LatLng(49.123, -122.456)`
- **JSON-LD structured data**: Check for `<script type="application/ld+json">` with geo data
- **OpenStreetMap/Leaflet**: Look for `L.marker([lat, lon])` or `L.latLng(lat, lon)`
- **Data attributes**: Check for `data-lat`, `data-lng`, `data-latitude`, `data-longitude` on elements
- **Address-to-GPS**: If only address available, create helper script using geocoding API (see location-cache system in `/src/lib/location-cache.ts`)

### Description and biography extraction
- **Truncation detection**: Some sites show "..." or "Read more" on list pages
- **Full content location**: Check for `.page-text`, `.biography`, `.description`, `.content` divs
- **Multiple paragraphs**: Use regex with `g` flag to capture ALL paragraphs, not just first one
- **Special sections**: Look for "Artist Statement", "About the Artist", "Artist Bio" headings
- **Cleaning**: Remove navigation links ("Previous", "Next"), "Special Thanks", empty paragraphs

### Metadata field extraction from details sections
Pattern often used:
```html
<div class="details">
  <div><strong>Status:</strong> Temporary</div>
  <div><strong>Type:</strong> Installation</div>
  <div><strong>Year:</strong> 2025</div>
</div>
```

Parse with patterns like: `/<strong>Status:<\/strong>\s*([^<]+)/i`

### Artist name extraction
- Check multiple locations: separate artist section, within title, in metadata
- Handle multiple artists: comma-separated, "and", "&" separators
- Look for artist links: `/artist/[id]` or `/artist/[slug]` patterns

## Browser inspection tools (Playwright MCP)

Before writing any parser, use Playwright MCP to inspect the actual HTML structure:

```typescript
// Navigate to page
mcp_playwright_browser_navigate({ url: "https://example.com/artwork" })

// Get snapshot of page structure
mcp_playwright_browser_snapshot()

// Take screenshot for visual reference
mcp_playwright_browser_take_screenshot({ filename: "page.png" })
```

This gives you the actual rendered HTML structure, which is more reliable than viewing page source (handles JavaScript-rendered content).

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


