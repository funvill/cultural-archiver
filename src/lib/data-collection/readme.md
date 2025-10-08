# Data Collection Scripts — How to add a new site

See TAG_DEFINITIONS in src\shared\tag-schema.ts for a list of default tags

- Always check capture groups exist before using them.
- Be careful with HTML entities (e.g. `&amp;`, `&nbsp;`) and encoding; decode before using text.
- When in doubt, prefer the longest text candidate for a biography field (search-views often truncate text).
- Avoid heavy dependencies. If parsing becomes complex, you may add a small DOM parser (cheerio) but keep it isolated to `parser.ts`.
- Add logs at debug/info levels that can be toggled. Save HTML of pages that fail to parse for later inspection.

## Output formats (required)

Collectors must produce an OSM-style GeoJSON `FeatureCollection` as the canonical artwork output and may optionally produce an `artists.json` lookup file. Place outputs under the collector's `output/` folder.

- `artworks.geojson` — required. GeoJSON FeatureCollection where each Feature has:
  - `geometry`: Point with `[lon, lat]` coordinates
  - `properties`: object containing `title`, `sourceUrl` and (when available) `artist` (string), `start_date`, `material`, `tags`, and `photos` (array)
- `artists.json` — optional. An array of artist records (or an object keyed by normalized artist name) with fields such as `name`, `bio`, `source_url`, and optional identifiers used by the importer.

Example (run mass-import from repo root):

```powershell
node dist/lib/mass-import-system/cli/cli-entry.js import --importer osm-artwork --input src\lib\data-collection\burnabyartgallery\output\artworks.geojson --config burnaby-osm-config.json --exporter console --limit 10
```

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

### Best practices for pagination

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


