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

### 1. Always Inspect the Live DOM First

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

### 9. Common Pitfalls

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

#### ✅ Do: Extract what's available, document what's missing
```typescript
// Document in README which fields are available
const medium = this.extractMetadataField($, 'Primary materials:');
// Medium often empty on this site - field exists but rarely populated
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
| `new-west-city` | [New Westminster](https://www.newwestcity.ca/public-art-registry) | ✅ Complete | 21+ | Concatenated metadata |

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
4. **Document as you go** - Note any quirks or special handling in the README
5. **Check artist tracking** - Verify artists are being deduplicated correctly

## Resources

- **ScraperBase**: `src/mass-import/scraper-base.ts`
- **Shared Types**: `src/shared/types.ts`
- **Cheerio Docs**: https://cheerio.js.org/
- **Playwright-MCP**: Use in Copilot for DOM inspection

---

*Last updated: October 14, 2025*
