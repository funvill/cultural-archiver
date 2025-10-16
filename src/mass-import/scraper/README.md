# Web Scraper Development Guide

This directory contains web scrapers for various public art registries. Each scraper extracts artwork and artist data from municipal websites and outputs standardized GeoJSON and JSON files.

## Quick Start

### Creating a New Scraper

1. **Create scraper directory:**
   ```bash
   mkdir src/mass-import/scraper/[scraper-name]
   cd src/mass-import/scraper/[scraper-name]
   ```

2. **Create required files:**
   - `scraper.ts` - Main scraper implementation
   - `cli.ts` - Command-line interface
   - `README.md` - Scraper-specific documentation

3. **Use existing scrapers as templates:**
   - **Simple structure**: `burnaby-art-gallery` - Clean dt/dd HTML structure
   - **Complex structure**: `new-west-city` - Concatenated metadata text

### Running a Scraper

```bash
# Test with limited results
npx tsx src/mass-import/scraper/[scraper-name]/cli.ts --limit 5 --output ./src/mass-import/scraper/output

# Full scrape
npx tsx src/mass-import/scraper/[scraper-name]/cli.ts --output ./src/mass-import/scraper/output

# With verbose logging
npx tsx src/mass-import/scraper/[scraper-name]/cli.ts --limit 10 --output ./src/mass-import/scraper/output --verbose
```

## Architecture

### ScraperBase Class

All scrapers extend `ScraperBase` from `src/mass-import/scraper-base.ts`:

```typescript
export class YourScraper extends ScraperBase {
  protected async scrapeListingPage(pageNum: number): Promise<string[]> {
    // Return array of artwork detail page URLs
  }

  protected async scrapeDetailPage(url: string): Promise<void> {
    // Extract artwork and artist data, call this.addArtwork()
  }

  protected getSourceUrl(): string {
    // Return base URL of the registry
  }
}
```

**Key Features:**
- ✅ Automatic rate limiting (1.5s + 0-500ms jitter)
- ✅ Retry logic with exponential backoff
- ✅ Artist tracking and deduplication
- ✅ GeoJSON output generation
- ✅ Progress logging
- ✅ Error handling

## Lessons Learned

### 1. Output Format MUST Be OSM-Compatible

**CRITICAL:** Scrapers MUST output OSM-compatible GeoJSON format directly. Do NOT create custom property formats that require conversion.

**Required OSM Properties:**
```typescript
properties: {
  '@id': string,           // Unique identifier (e.g., "surrey-ca/artwork-slug")
  tourism: 'artwork',      // OSM tag for artwork
  name: string,            // Artwork title
  artist_name?: string,    // Comma-separated artist names
  start_date?: string,     // Year installed/created
  description?: string,    // Full description
  image?: string,          // First/main photo URL
  photos?: string[],       // Array of ALL photo URLs
  'addr:full'?: string,    // Full address/location string
  source: string,          // Source website URL
  source_url: string,      // Direct link to artwork page
  notes?: string,          // Additional metadata (category, developer, etc.)
}
```

**Why OSM Format:**
- Works directly with `osm-artwork` importer - no conversion needed
- Standardized across all scrapers
- Compatible with OpenStreetMap conventions
- Eliminates conversion scripts and potential errors

**Example:**
```typescript
const artwork: ArtworkFeature = {
  type: 'Feature',
  id: 'surrey-ca/abstract-mountains',
  geometry: {
    type: 'Point',
    coordinates: [-122.84274, 49.178044]
  },
  properties: {
    '@id': 'surrey-ca/abstract-mountains',
    tourism: 'artwork',
    name: 'Abstract Mountains',
    artist_name: 'Marie Khouri',
    start_date: '2018',
    description: 'Made of stainless steel...',
    image: 'https://www.example.com/photo1.jpg',
    photos: [
      'https://www.example.com/photo1.jpg',
      'https://www.example.com/photo2.jpg',
      'https://www.example.com/photo3.jpg'
    ],
    'addr:full': 'City Centre 2 (9639 137A Street)',
    source: 'https://www.example.com/public-art/',
    source_url: 'https://www.example.com/artwork/abstract-mountains',
    notes: 'Category: Private collection\nDeveloper: Lark Group'
  }
};
```

**Common Mistakes to Avoid:**
- ❌ Using `title` instead of `name`
- ❌ Using `artists` array instead of `artist_name` string
- ❌ Using `location` instead of `addr:full`
- ❌ Only including `image` without `photos` array
- ❌ Creating custom property names

### 2. Always Inspect the Live DOM First

**Use Playwright-MCP for DOM inspection:**

```typescript
// In Copilot, use Playwright tools to navigate and inspect
await mcp_playwright_browser_navigate({ url: "https://example.com/artwork/123" })
```

**Why:** HTML source often differs from rendered DOM due to JavaScript. Playwright shows the actual structure Cheerio will parse.

**Example from New Westminster:**
- Artist name appeared in `<div class="artist">` in DOM
- Simple selector `.artist` worked perfectly after DOM inspection
- Initial complex iteration approaches were unnecessary

**Example from Surrey:**
- Metadata fields had trailing spaces in `<strong>` tags: `<strong>Artists: </strong>`
- Required updating extraction logic to handle both `<strong>Artists:</strong>` and `<strong>Artists: </strong>`
- DOM inspection revealed actual HTML structure vs. assumptions

### 2. Handle Different Metadata Structures

#### Pattern 1: Structured dt/dd Elements (Burnaby)

```typescript
private extractMetadataField($: cheerio.CheerioAPI, label: string): string {
  const dt = $('dt').filter((_, el) => $(el).text().trim() === label);
  if (dt.length > 0) {
    return dt.next('dd').text().trim();
  }
  return '';
}
```

#### Pattern 2: Concatenated Text (New Westminster)

```typescript
private extractMetadataField($: cheerio.CheerioAPI, fieldName: string): string {
  const fullText = this.getMetadataText($); // Get parent text
  
  // List of all possible field names
  const fields = [
    'Neighbourhood:',
    'Installation year:',
    'Removal year:',
    'Status:',
    'Type:',
    'Primary materials:',
    'Address:'
  ];
  
  // Find our field
  const fieldIndex = fullText.indexOf(fieldName);
  if (fieldIndex === -1) return '';
  
  // Extract text after field name
  const afterField = fullText.substring(fieldIndex + fieldName.length);
  
  // Find next field marker
  let nextFieldIndex = afterField.length;
  for (const field of fields) {
    if (field === fieldName) continue;
    const idx = afterField.indexOf(field);
    if (idx !== -1 && idx < nextFieldIndex) {
      nextFieldIndex = idx;
    }
  }
  
  return afterField.substring(0, nextFieldIndex).trim();
}
```

**Lesson:** Don't assume regex will work for concatenated text. Split-based parsing is more reliable.

### 3. Photo Extraction Strategies

#### URL Pattern Filtering (Recommended)

```typescript
private extractPhotos($: cheerio.CheerioAPI): string[] {
  const photos: string[] = [];
  const baseUrl = this.getSourceUrl();
  
  $('img').each((_, element) => {
    const src = $(element).attr('src');
    if (!src) return;
    
    const lowerSrc = src.toLowerCase();
    
    // Include patterns
    const includePatterns = ['/images/', '/photos/', 'public-art', '.jpg', '.png', '.jpeg'];
    const hasInclude = includePatterns.some(pattern => lowerSrc.includes(pattern));
    
    // Exclude patterns
    const excludePatterns = ['logo', 'icon', 'banner', 'sprite', '/assets/', 'avatar'];
    const hasExclude = excludePatterns.some(pattern => lowerSrc.includes(pattern));
    
    if (hasInclude && !hasExclude) {
      const fullUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
      photos.push(fullUrl);
    }
  });
  
  return [...new Set(photos)]; // Deduplicate
}
```

**Why:** More reliable than alt text or parent element inspection. URLs typically follow naming conventions.

**CRITICAL - Photos Array:**

Scrapers MUST include BOTH `image` and `photos` properties:

- `image`: First/main photo URL (for OSM compatibility)
- `photos`: Array of ALL photo URLs (for complete import)

```typescript
properties: {
  // ... other properties
  image: photos && photos.length > 0 ? photos[0] : undefined,
  photos: photos, // Complete array of ALL photos
  // ... other properties
}
```

**Important:** Scrapers should output **external photo URLs**. The Mass Import v3 API automatically:

- Downloads photos from external URLs during import
- Uploads to Cloudflare R2 storage
- Generates proper R2-based URLs
- Stores metadata (original URL, upload timestamp, file size)
- Eliminates hotlinking to external sources

**Photo Output Format:**

```typescript
// Simple URL array (recommended - will be downloaded and uploaded to R2)
photos: [
  "https://example.com/photo1.jpg",
  "https://example.com/photo2.jpg",
  "https://example.com/photo3.jpg"
]

// Or with metadata (optional)
photos: [
  { url: "https://example.com/photo1.jpg", caption: "Front view", credit: "Photographer" }
]
```

### 4. Artist Extraction Patterns

#### Strategy 1: CSS Class Selector (Best)

```typescript
private extractArtist($: cheerio.CheerioAPI): string {
  const artistElement = $('.artist, .artwork-artist, [class*="artist"]');
  return artistElement.first().text().trim();
}
```

#### Strategy 2: Heading-Based

```typescript
private extractArtist($: cheerio.CheerioAPI): string {
  const headings = $('h2, h3, h4');
  const artistHeading = headings.filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return text.includes('artist') || text === 'by';
  });
  
  if (artistHeading.length > 0) {
    return artistHeading.next('p, div').first().text().trim();
  }
  return '';
}
```

#### Strategy 3: DOM Position (Last Resort)

```typescript
private extractArtist($: cheerio.CheerioAPI): string {
  // Find element before "Artwork details" or similar marker
  let artistName = '';
  $('*').each((_, element) => {
    const $elem = $(element);
    const nextText = $elem.next().text();
    
    if (nextText.includes('Artwork details')) {
      const text = $elem.text().trim();
      if (text.length > 0 && text.length < 200) {
        artistName = text;
        return false; // Stop iteration
      }
    }
  });
  return artistName;
}
```

**Lesson:** Try CSS selectors first. Only use DOM traversal as fallback.

### 5. Description Extraction

Combine multiple content sections when available:

```typescript
private extractDescription($: cheerio.CheerioAPI): string {
  const sections: string[] = [];
  
  // Find "About the Artwork" section
  $('h2, h3').each((_, el) => {
    const heading = $(el).text().trim();
    if (heading.toLowerCase().includes('about the artwork')) {
      let content = '';
      let next = $(el).next();
      
      // Collect following paragraphs until next heading
      while (next.length > 0 && !next.is('h1, h2, h3, h4')) {
        if (next.is('p')) {
          content += next.text().trim() + '\n\n';
        }
        next = next.next();
      }
      
      if (content) sections.push(content.trim());
    }
  });
  
  // Similar for "Artist Statement", etc.
  
  return sections.join('\n\n---\n\n');
}
```

### 6. Address and Location Handling

```typescript
private extractAddress($: cheerio.CheerioAPI): string {
  // Method 1: Metadata field
  let address = this.extractMetadataField($, 'Address:');
  
  // Method 2: Look for postal code pattern
  if (!address) {
    const text = $('body').text();
    const postalCodeRegex = /([A-Z]\d[A-Z]\s?\d[A-Z]\d)/;
    const match = text.match(postalCodeRegex);
    if (match) {
      // Extract surrounding text as address
      const index = text.indexOf(match[0]);
      address = text.substring(Math.max(0, index - 100), index + 20).trim();
    }
  }
  
  return address;
}
```

**Note:** Geocoding should be handled separately, not during scraping.

### 7. Error Handling and Logging

```typescript
protected async scrapeDetailPage(url: string): Promise<void> {
  try {
    const html = await this.fetchWithRetry(url);
    const $ = cheerio.load(html);
    
    const title = this.extractTitle($);
    if (!title) {
      this.logger.warn(`No title found for ${url}`);
      return; // Skip this artwork
    }
    
    // Extract other fields...
    
  } catch (error) {
    this.logger.error(`Error scraping ${url}:`, error);
    throw error; // Let ScraperBase handle retry
  }
}
```

**Best Practices:**
- Log warnings for missing fields, not errors
- Only throw errors for network issues or critical failures
- Use `this.logger` for consistent formatting

### 8. Testing Strategy

```typescript
// 1. Start with limit 1 to verify basic extraction
npx tsx src/mass-import/scraper/your-scraper/cli.ts --limit 1 --output ./output

// 2. Check the output
Get-Content ./output/your-scraper-artworks.geojson | ConvertFrom-Json | 
  Select-Object -ExpandProperty features | 
  ForEach-Object { $_.properties | Select-Object title, artist, artwork_type }

// 3. Test with 5-10 to verify consistency
npx tsx src/mass-import/scraper/your-scraper/cli.ts --limit 10 --output ./output

// 4. Full scrape when confident
npx tsx src/mass-import/scraper/your-scraper/cli.ts --output ./output
```

### 9. Artist ID Management (CRITICAL)

**Problem:** Artist biographies were extracting correctly but not saving to output.

**Root Cause:** Artist ID mismatch between `trackArtist()` and subsequent retrieval.

#### ❌ Don't: Use different IDs for tracking and retrieval
```typescript
// BUG: Using artwork ID for tracking
this.trackArtist(artistName, artworkId, url);

// Then generating a different ID for retrieval
const artistId = this.generateArtistId(artistName); // Creates NEW ID
const existingArtist = this.artists.get(artistId); // Not found!
```

#### ✅ Do: Generate artist ID once and use consistently
```typescript
// CORRECT: Generate artist ID first
const artistId = this.generateArtistId(artistName);
this.trackArtist(artistName, artistId, url);

// Use the same ID for retrieval
const existingArtist = this.artists.get(artistId); // Found!
if (existingArtist) {
  existingArtist.properties.biography = artistBiography;
}
```

**Lesson:** The `trackArtist()` method stores artists by the ID you provide. Always generate the artist ID before calling `trackArtist()` and reuse that same ID for any subsequent lookups.

### 10. Conditional Properties (Clean Output)

**Problem:** Output JSON contained many empty fields (`medium: "", technique: "", keywords: []`).

#### ❌ Don't: Include all fields regardless of whether they have values
```typescript
properties: {
  title,
  artist: artistName,
  medium: medium, // Often empty string
  technique: '', // Always empty
  dimensions: '', // Always empty
  keywords: [], // Always empty array
  accession_number: '', // Always empty
}
```

#### ✅ Do: Use conditional spreading to only include non-empty fields
```typescript
properties: {
  title,
  artist: artistName,
  ...(medium && { medium }), // Only if medium has a value
  ...(artwork_type && { artwork_type }),
  ...(start_date && { start_date }),
  ...(neighbourhood && { category: neighbourhood }),
  // Never include technique, dimensions, keywords if site doesn't have them
}
```

**Result:** Clean, minimal JSON without clutter.

**Lesson:** Don't include fields that are always empty or unavailable on the source site. Document unavailable fields in the scraper's README instead.

### 11. Avoid Duplicate Properties

**Problem:** Artist biography appeared twice in output - once at root level, once in properties.

#### ❌ Don't: Set both root-level and properties fields
```typescript
if (artistBiography) {
  existingArtist.biography = artistBiography; // ❌ Creates duplicate
  existingArtist.properties.biography = artistBiography;
}
```

#### ✅ Do: Only set properties fields
```typescript
if (artistBiography) {
  existingArtist.properties.biography = artistBiography; // ✅ Single source
}
```

**Why:** The `ArtistRecord` type defines properties inside a `properties` object. Setting both creates duplicate data and wastes space.

### 12. Coordinates Extraction from JavaScript

**Strategy:** Extract from embedded JavaScript map data when HTML doesn't contain coordinates.

```typescript
private async extractCoordinates($: cheerio.CheerioAPI): Promise<[number, number] | null> {
  // Method 1: Look for map_markers JavaScript variable
  const scripts = $('script');
  for (let i = 0; i < scripts.length; i++) {
    const scriptContent = $(scripts[i]).html();
    if (!scriptContent) continue;
    
    // Match: map_markers = [{lat: 49.2000155, lng: -122.9117314}]
    const mapPattern = /map_markers\s*=\s*\[\{lat:\s*(-?\d+\.?\d*),\s*lng:\s*(-?\d+\.?\d*)/;
    const match = scriptContent.match(mapPattern);
    
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      this.logger.info(`Coordinates extracted from map: [${lat}, ${lng}]`);
      return [lat, lng];
    }
  }
  
  // Method 2: Look for data attributes
  const mapContainer = $('[data-lat][data-lng]');
  if (mapContainer.length > 0) {
    const lat = parseFloat(mapContainer.attr('data-lat') || '0');
    const lng = parseFloat(mapContainer.attr('data-lng') || '0');
    return [lat, lng];
  }
  
  return null;
}
```

**Lesson:** Check script tags for embedded map data. Many sites include coordinates in JavaScript variables for map rendering.

### 13. Section-Based Content Extraction

**Strategy:** Extract content by section headings, stopping at known boundaries.

```typescript
private extractArtistBiography($: cheerio.CheerioAPI): string {
  const paragraphs: string[] = [];
  let foundMarker = false;
  let paragraphCount = 0;
  const maxParagraphs = 10;
  
  // Markers to start collecting
  const startMarkers = ['About the Artist', 'Artist Biography', 'Artist Statement'];
  
  // Markers to stop collecting
  const stopMarkers = ['Special Thanks', 'Back to Registry', 'Photo credit:', ''];
  
  $('p').each((_, element) => {
    const text = $(element).text().trim();
    
    // Check if this is a start marker
    if (!foundMarker) {
      if (startMarkers.some(marker => text.includes(marker))) {
        foundMarker = true;
        this.logger.info(`Found "${text.substring(0, 30)}..." marker`);
      }
      return; // Continue to next paragraph
    }
    
    // Check if we should stop
    if (stopMarkers.some(marker => text.startsWith(marker)) || 
        paragraphCount >= maxParagraphs) {
      this.logger.info(`Stopped at: ${text.substring(0, 30) || '(empty)'}`);
      return false; // Break out of loop
    }
    
    // Collect paragraph
    if (text.length > 20) { // Ignore very short paragraphs
      paragraphs.push(text);
      paragraphCount++;
    }
  });
  
  const biography = paragraphs.join('\n\n');
  if (biography) {
    this.logger.info(`Extracted artist biography: ${biography.length} characters`);
  }
  return biography;
}
```

**Lesson:** Use marker-based extraction for sections that don't have consistent HTML structure. Define both start and stop markers.

### 14. ASP.NET Web Forms Pagination (ViewState)

**Challenge:** Some older government sites use ASP.NET Web Forms with ViewState-based pagination. This requires sending POST requests with specific form fields to navigate pages.

**Key Concepts:**

- **ViewState:** Large encoded state field (`__VIEWSTATE`, `__EVENTVALIDATION`, `__VIEWSTATEGENERATOR`) that must be preserved across requests
- **__doPostBack:** JavaScript function that triggers server-side pagination with control IDs
- **Form Field Management:** Must include search/control fields but exclude result data fields

#### Problem Pattern: Only First Page Works

**Symptoms:**

- Pagination appears to work (POST returns 200 OK)
- All pages return identical results from page 1
- Or pagination returns filtered subset (e.g., 17 of 382 total artworks)

**Root Causes:**

1. Missing ViewState fields → Server resets to default state
2. Missing search form controls → Server applies default filters
3. Including result data fields → Server returns page 1 repeatedly

#### ✅ Solution: Essential Fields Only

```typescript
private extractNextPagePostData($: cheerio.CheerioAPI, targetPageNumber: number): string | null {
  // CRITICAL: Extract ViewState fields (required for all ASP.NET postbacks)
  const viewState = $('input[name="__VIEWSTATE"]').val();
  const eventValidation = $('input[name="__EVENTVALIDATION"]').val();
  const viewStateGenerator = $('input[name="__VIEWSTATEGENERATOR"]').val();

  if (!viewState || !eventValidation) {
    this.logger.error('Missing required ViewState fields');
    return null;
  }

  // Find pagination button control ID (varies by page number)
  const pageButton = $(`a[href*="__doPostBack"][href*="btnPage"]`)
    .filter((_, el) => $(el).text().trim() === targetPageNumber.toString())
    .first();

  if (pageButton.length === 0) {
    this.logger.warn(`No pagination link found for page ${targetPageNumber}`);
    return null;
  }

  // Extract __doPostBack parameters from href
  const href = pageButton.attr('href') || '';
  const targetMatch = href.match(/__doPostBack\('([^']+)'/);
  const argumentMatch = href.match(/'([^']*)'\)/);

  if (!targetMatch) {
    this.logger.error(`Could not extract __doPostBack target from: ${href}`);
    return null;
  }

  const eventTarget = targetMatch[1];
  const eventArgument = argumentMatch?.[1] || '';

  // ESSENTIAL: Include search form controls (preserves filter state)
  const searchControls = {
    'ctl00$main$tbKeyword': $('input[name="ctl00$main$tbKeyword"]').val() || '',
    'ctl00$main$tbArtist': $('input[name="ctl00$main$tbArtist"]').val() || '',
    'ctl00$main$tbArtwork': $('input[name="ctl00$main$tbArtwork"]').val() || '',
    'ctl00$main$ddlArea': $('select[name="ctl00$main$ddlArea"]').val() || '',
    'ctl00$main$ddlYearFrom': $('select[name="ctl00$main$ddlYearFrom"]').val() || '',
    'ctl00$main$ddlYearTo': $('select[name="ctl00$main$ddlYearTo"]').val() || '',
  };

  // Build POST data with ONLY essential fields
  const formData = new URLSearchParams({
    __EVENTTARGET: eventTarget,
    __EVENTARGUMENT: eventArgument,
    __VIEWSTATE: viewState as string,
    __VIEWSTATEGENERATOR: viewStateGenerator as string,
    __EVENTVALIDATION: eventValidation as string,
    ...searchControls, // Include search controls
    // ❌ DO NOT include result data fields (hdArtworkID, rptSearchResults, etc.)
  });

  this.logger.info(`Extracted POST data for page ${targetPageNumber}, target: ${eventTarget}`);
  return formData.toString();
}
```

#### Fetching Next Page (POST Request)

```typescript
protected async fetchNextPage(postData: string): Promise<string> {
  const response = await fetch(this.getSourceUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Referer': this.getSourceUrl(),
    },
    body: postData,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${this.getSourceUrl()}`);
  }

  return await response.text();
}
```

#### Essential vs. Result Data Fields

**✅ Essential Fields (Must Include):**

- `__VIEWSTATE` - Server state (typically 100k+ characters)
- `__EVENTVALIDATION` - Security validation (typically 2-3k characters)
- `__VIEWSTATEGENERATOR` - State generator ID
- `__EVENTTARGET` - Control ID from `__doPostBack()` (e.g., `ctl00$main$rptPager$ctl02$btnPage`)
- `__EVENTARGUMENT` - Usually empty string
- Search form controls - text inputs, dropdowns, filters (preserve search state)

**❌ Result Data Fields (Must Exclude):**

- `hdArtworkID` - Hidden fields with result IDs
- `rptSearchResults$ctl00$*` - Repeater control result data
- Any fields containing current page's artwork data

**Why This Matters:**

- Missing ViewState → Server resets to default state, pagination fails
- Missing search controls → Server applies default filters, returns subset
- Including result data → Server thinks you're submitting page 1 data, returns page 1

#### Debugging with Playwright MCP

When pagination fails, use Playwright to compare browser behavior vs. scraper:

```typescript
// 1. Navigate to page in Playwright
await mcp_playwright_browser_navigate({ url: 'https://site.com/search.aspx' });

// 2. Click pagination link
await mcp_playwright_browser_click({
  element: 'Page 2 link',
  ref: 'a:has-text("2")'
});

// 3. Inspect form fields after navigation
// Compare with scraper's POST data to identify missing fields
```

**Debugging Checklist:**

- [ ] Verify ViewState fields are present and non-empty
- [ ] Check that search form controls are included
- [ ] Confirm result data fields are excluded
- [ ] Compare POST data size with browser network tab
- [ ] Use Playwright to inspect actual form state on page 2
- [ ] Log extracted field names to verify essential fields whitelist

#### Complete Pagination Implementation

```typescript
protected async scrapeListingPage(): Promise<void> {
  let currentPage = 1;
  const maxPages = 50; // Safety limit

  // Fetch initial page
  let html = await this.fetchWithRetry(this.getSourceUrl());
  let $ = cheerio.load(html);

  while (currentPage <= maxPages) {
    this.logger.info(`Scraping page ${currentPage}...`);

    // Extract artwork links from current page
    const links = this.extractArtworkLinks($);
    this.logger.info(`Found ${links.length} artwork links on page ${currentPage}`);

    for (const link of links) {
      await this.scrapeDetailPage(link);
    }

    // Check for next page
    const nextPageNumber = currentPage + 1;
    const postData = this.extractNextPagePostData($, nextPageNumber);

    if (!postData) {
      this.logger.info(`No more pages after page ${currentPage}`);
      break;
    }

    // Fetch next page
    html = await this.fetchNextPage(postData);
    $ = cheerio.load(html);
    currentPage++;
  }
}
```

#### Common Mistakes and Fixes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Missing `__VIEWSTATE` | 500 error or reset to page 1 | Extract from `<input name="__VIEWSTATE">` |
| Missing search controls | Returns filtered subset | Include all form inputs/selects from search panel |
| Including result data | All pages return page 1 | Exclude fields with patterns like `rptSearchResults`, `hdArtworkID` |
| Wrong `__EVENTTARGET` | No pagination | Extract from `__doPostBack('target', 'arg')` in href |
| Missing `Content-Type` header | 400 error | Use `application/x-www-form-urlencoded` |
| Missing `Referer` header | Security error | Set to source URL |

#### Verification

After implementing pagination:

```powershell
# Test with limit to verify pages are different
npx tsx src/mass-import/scraper/your-scraper/cli.ts --limit 50 --output ./output

# Check unique artwork count
$artworks = Get-Content ./output/your-scraper-artworks.geojson | ConvertFrom-Json
$artworks.features.Count  # Should match limit or total available
$artworks.features.id | Sort-Object -Unique | Measure-Object  # Should have no duplicates
```

**Success Indicators:**

- Each page returns different artwork links (use Set for deduplication)
- Total artworks collected matches site's reported total
- No duplicate artwork IDs in final output
- Logs show progression through multiple pages

**Lesson:** ASP.NET Web Forms pagination requires preserving ViewState and search form controls while excluding result data fields. Use Playwright MCP to debug by comparing browser form state with scraper POST data. When in doubt, include control fields but exclude data fields.

### 15. Common Pitfalls

#### ❌ Don't: Assume consistent whitespace in concatenated text

```typescript
// This often fails
const pattern = new RegExp(`${field}:\\s*([^]+?)(?=\\s{2,}\\w+:|$)`);
```

#### ✅ Do: Split on known field names

```typescript
const fieldIndex = fullText.indexOf(fieldName);
const afterField = fullText.substring(fieldIndex + fieldName.length);
const nextFieldIndex = findNextField(afterField, allFieldNames);
return afterField.substring(0, nextFieldIndex).trim();
```

#### ❌ Don't: Complex DOM traversal without checking structure

```typescript
// Fragile and hard to debug
const artist = $('div').filter((_, el) => {
  return $(el).find('*').length > 2 && 
         $(el).parent().parent().next().text().includes('details');
}).first().text();
```

#### ✅ Do: Use specific selectors or simple traversal

```typescript
// Clear and maintainable
const artist = $('.artist').text().trim() || 
               $('[data-artist]').text().trim();
```

#### ❌ Don't: Hardcode field mappings without checking availability

```typescript
// Some sites don't have all fields
medium: this.extractMedium($), // Returns empty string = wasted effort
```

#### ✅ Do: Use conditional spreading for optional fields

```typescript
properties: {
  title,
  artist: artistName,
  ...(medium && { medium }), // Only include if present
  ...(artwork_type && { artwork_type }),
}
```

## Scraper Development Checklist

### Initial Setup

- [ ] Create scraper directory with name matching source
- [ ] Create `scraper.ts`, `cli.ts`, and `README.md`
- [ ] Use Playwright-MCP to inspect target website DOM
- [ ] Document the HTML structure and identify extraction patterns

### Implementation

- [ ] Extend `ScraperBase` class
- [ ] Implement `scrapeListingPage()` - extract artwork URLs
- [ ] Implement `scrapeDetailPage()` - extract artwork data
- [ ] Implement `getSourceUrl()` - return base URL
- [ ] Implement extraction methods:
  - [ ] `extractTitle()`
  - [ ] `extractArtist()`
  - [ ] `extractDescription()`
  - [ ] `extractPhotos()`
  - [ ] `extractAddress()`
  - [ ] `extractCoordinates()` (if available)
  - [ ] Metadata fields (type, year, medium, etc.)

### Testing

- [ ] Test with `--limit 1` - verify basic extraction
- [ ] Check output JSON/GeoJSON structure
- [ ] Test with `--limit 5-10` - verify consistency
- [ ] Verify artist tracking works
- [ ] Check photo extraction quality
- [ ] Test pagination if site has multiple pages
- [ ] Full scrape when confident

### Documentation

- [ ] Update scraper README with:
  - [ ] Source URL
  - [ ] Available fields
  - [ ] Known limitations
  - [ ] Example output
  - [ ] Special considerations
- [ ] Add entry to this main README with scraper name and status

## Available Scrapers

| Scraper Name | Source | Status | Artworks | Notes |
|-------------|--------|--------|----------|-------|
| `burnaby-art-gallery` | [Burnaby Art Gallery](https://www.burnabyartgallery.ca/public-art) | ✅ Complete | ~100+ | Clean dt/dd structure |
| `new-west-city` | [New Westminster](https://www.newwestcity.ca/public-art-registry) | ✅ Complete | 74 | Concatenated metadata, JavaScript coordinates |
| `richmond-ca` | [Richmond BC](https://www.richmond.ca/culture/howartworks/publicart/collection/Search.aspx) | ✅ Complete | 382 | ASP.NET Web Forms with ViewState pagination |

## Output Files

Each scraper generates two files:

### 1. Artworks GeoJSON (`[scraper-name]-artworks.geojson`)

```json
{
  "type": "FeatureCollection",
  "metadata": {
    "scraper": "scraper-name",
    "version": "1.0.0",
    "source": "https://source-url.com",
    "scrapedAt": "2025-10-15T04:50:16.674Z",
    "totalItems": 10
  },
  "features": [
    {
      "type": "Feature",
      "id": "source/artwork-slug",
      "geometry": {
        "type": "Point",
        "coordinates": [-122.9108, 49.2066]
      },
      "properties": {
        "title": "Artwork Title",
        "artist": "Artist Name",
        "description": "Full description...",
        "artwork_type": "Installation",
        "location": "Neighbourhood, Address",
        "start_date": "2025",
        "end_date": "2025",
        "medium": "Materials",
        "photos": ["url1", "url2"],
        "source": "https://source-url.com",
        "source_url": "https://source-url.com/artwork/123"
      }
    }
  ]
}
```

### 2. Artists JSON (`[scraper-name]-artists.json`)

```json
{
  "metadata": {
    "scraper": "scraper-name",
    "version": "1.0.0",
    "source": "https://source-url.com",
    "scrapedAt": "2025-10-15T04:50:16.675Z",
    "totalItems": 10
  },
  "artists": [
    {
      "type": "Artist",
      "id": "source/artwork-slug",
      "name": "Artist Name",
      "properties": {
        "biography": "Artist bio if available",
        "website": "https://artist-site.com",
        "source": "https://source-url.com",
        "source_url": "https://source-url.com/artwork/123"
      }
    }
  ]
}
```

## Troubleshooting

### Issue: Photos not extracting

**Solution:** Use Playwright to inspect image URLs and adjust include/exclude patterns.

### Issue: Metadata fields capturing too much text

**Solution:** Switch from regex to split-based parsing. Log the raw metadata text to understand the format.

### Issue: Artist names empty

**Solution:** Use Playwright to find the artist element, then target by class name or position.

### Issue: Scraper timing out

**Solution:** Check rate limiting settings in `ScraperBase`. The default is 1.5s + jitter. Increase if needed.

### Issue: TypeScript compilation errors

**Solution:** Ensure all async functions are properly awaited and return types match expectations.

## Next Steps

When implementing the next scraper:

1. **Start with Playwright inspection** - Don't guess the HTML structure
2. **Copy a similar scraper** - Use Burnaby for structured sites, New Westminster for text-heavy sites
3. **Test incrementally** - `--limit 1`, then `--limit 5`, then full scrape
4. **Generate artist ID once** - Use the same ID for both `trackArtist()` and subsequent lookups
5. **Use conditional spreading** - Only include properties that have values
6. **Check for JavaScript data** - Look in script tags for embedded coordinates or other data
7. **Document as you go** - Note any quirks or special handling in the README
8. **Verify artist tracking** - Check that biographies save correctly

## Critical Debugging Checklist

If something isn't working:

- [ ] **Artist biography not saving?**
  - Check artist ID generation - are you using the same ID for tracking and retrieval?
  - Add logging to verify biography extraction length
  - Verify `existingArtist` is not undefined before setting properties

- [ ] **Empty fields in output?**
  - Use conditional spreading: `...(field && { field })`
  - Don't include fields that are always empty on the source site

- [ ] **Coordinates missing?**
  - Check script tags for JavaScript variables (map_markers, etc.)
  - Look for data attributes on map containers
  - Log when coordinates are found vs. when using fallback

- [ ] **Metadata extraction failing?**
  - Use split-based parsing instead of regex for concatenated text
  - Log the raw metadata text to understand the format
  - List all possible field names to find boundaries

- [ ] **Photos not extracting?**
  - Inspect actual image URLs with Playwright
  - Update include/exclude patterns based on URL structure
  - Check for thumbnail vs. full-size image URLs

## Resources

- **ScraperBase**: `src/mass-import/scraper/shared/scraper-base.ts`
- **Shared Types**: `src/mass-import/scraper/shared/types.ts`
- **Cheerio Docs**: [https://cheerio.js.org/](https://cheerio.js.org/)
- **Playwright-MCP**: Use in Copilot for DOM inspection

---

**Last updated:** October 15, 2025
