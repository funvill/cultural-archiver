# Mass Import v3: Scraper Development Plan

## Overview

Scrapers are the **first component** of the mass import v3 system. Each scraper is a standalone script designed to extract artwork and artist data from a specific website and output standardized GeoJSON and JSON files.

Scrapers live in `src\mass-import\scraper\{name}\`
Scrapers shared modules `src\mass-import\scraper\shared\`

## Goals

- Extract artwork data (title, coordinates, photos, metadata) from source websites
- Extract artist data (name, biography, metadata) from source websites
- Output standardized GeoJSON format for artworks
- Output standardized JSON format for artists
- Handle pagination, rate limiting, and errors gracefully
- Validate data quality before writing output files

## Design Decisions

Based on the clarifying questions (70-89), here are the key decisions:

### Architecture

- **Language**: Node.js/TypeScript (all scrapers use same stack for consistency)
- **Organization**: Ad-hoc scripts (no strict directory structure)
- **Retry Logic**: Yes, with exponential backoff (3-5 attempts)
- **Rate Limiting**: Yes, respectful delays (1-2 seconds between requests)
- **Validation**: Basic validation with warnings before writing output

### Data Handling

- **Incremental Updates**: Manual tracking by user (no automatic incremental mode)
- **Metadata**: Include scraper metadata in output files
- **Pagination**: Auto-detect and follow pagination patterns
- **Normalization**: Heavy normalization to match database schema exactly
- **Incomplete Data**: Include partial data with null fields and completeness tags
- **Photo URLs**: Extract URLs only (CLI handles downloading)
- **Coordinates**: Convert all formats to decimal degrees
- **Duplicate Detection**: De-duplicate within scrape using unique identifiers

### Features

- **Configuration**: CLI arguments with README examples (no config files)
- **Authentication**: Public data only (no auth support)
- **Reports**: Error reports only (no preview/validation reports)
- **Dry-run**: No dry-run mode (always write files)
- **Multi-language**: English content only
- **Logging**: Structured logging with levels (DEBUG, INFO, WARN, ERROR)

## Output Format Specifications

### GeoJSON Artwork File

```json
{
  "type": "FeatureCollection",
  "metadata": {
    "scraper": "burnaby-art-gallery-scraper",
    "version": "1.0.0",
    "source": "https://burnabyartgallery.ca",
    "scrapedAt": "2025-10-14T12:00:00Z",
    "totalItems": 150
  },
  "features": [
    {
      "type": "Feature",
      "id": "source-unique-id-here",
      "geometry": {
        "type": "Point",
        "coordinates": [-123.003613, 49.225237]
      },
      "properties": {
        "source": "https://burnabyartgallery.ca",
        "source_url": "https://collections.burnabyartgallery.ca/link/publicart117",
        "title": "blacktail",
        "description": "Artwork description in Markdown...",
        "artwork_type": "sculpture",
        "artist": "Muse Atelier",
        "start_date": "2015",
        "material": "aluminum",
        "photos": [
          "https://collections.burnabyartgallery.ca/path/to/photo1.jpg",
          "https://collections.burnabyartgallery.ca/path/to/photo2.jpg"
        ]
      }
    }
  ]
}
```

### JSON Artist File

```json
{
  "metadata": {
    "scraper": "burnaby-art-gallery-scraper",
    "version": "1.0.0",
    "source": "https://burnabyartgallery.ca",
    "scrapedAt": "2025-10-14T12:00:00Z",
    "totalItems": 30
  },
  "artists": [
    {
      "type": "Artist",
      "id": "source-unique-id-here",
      "name": "Muse Atelier",
      "description": "Artist biography in Markdown...",
      "properties": {
        "source": "https://burnabyartgallery.ca",
        "source_url": "https://collections.burnabyartgallery.ca/link/artists1307",
        "birth_date": "1928",
        "death_date": "2016",
        "website": "http://www.example.com"
      }
    }
  ]
}
```

## Development Plan

### Phase 1: Scraper Framework Setup

**Goal**: Create reusable scraper utilities and base classes

**Tasks**:

- [ ] Create `src/mass-import/scraper/` directory structure
- [ ] Create `src/mass-import/scraper/shared/` for shared utilities
- [ ] Implement HTTP client with retry logic (exponential backoff)
- [ ] Implement rate limiter (1-2 second delays with jitter)
- [ ] Create coordinate converter utility (DMS/UTM → decimal degrees)
- [ ] Create data validator (required fields, coordinate ranges)
- [ ] Create structured logger (DEBUG/INFO/WARN/ERROR levels)
- [ ] Create pagination detector/follower utility
- [ ] Create duplicate tracker (within-scrape deduplication)
- [ ] Create GeoJSON/JSON output formatter
- [ ] Write unit tests for all utilities

**Dependencies**: `axios`, `winston`, `proj4` or `mgrs`, `zod`

**Success Criteria**:

- All utilities have TypeScript type definitions
- Unit tests pass with >80% coverage
- Example usage documented in README

### Phase 2: Reference Scraper Implementation

**Goal**: Build first complete scraper as reference implementation

**Tasks**:

- [ ] Use Burnaby Art Gallery as first data source
- [ ] Create scraper directory: `src/mass-import/scraper/burnaby-art-gallery/`
- [ ] Create scraper script: `src/mass-import/scraper/burnaby-art-gallery/scraper.ts`
- [ ] Implement CLI argument parsing (source URL, output directory, max pages)
- [ ] Implement data extraction logic:
  - [ ] Parse HTML/JSON from source
  - [ ] Extract artwork fields (title, coordinates, description, photos)
  - [ ] Extract artist fields (name, biography)
  - [ ] Normalize data to match schema
  - [ ] Convert coordinates to decimal degrees
- [ ] Implement pagination handling
- [ ] Implement duplicate detection within scrape
- [ ] Implement error logging and reporting
- [ ] Generate metadata section for output files
- [ ] Write output to GeoJSON and JSON files
- [ ] Create comprehensive README.md:
  - Source website description and URL
  - Data fields available
  - Known limitations
  - Setup instructions
  - CLI usage examples
  - Last successful scrape date
- [ ] Test with small dataset (2-3 pages)
- [ ] Validate output format
- [ ] Review error log for issues

**Success Criteria**:

- Scraper completes without crashes
- Output files are valid GeoJSON/JSON
- All required fields are populated
- Photo URLs are valid and accessible
- Coordinates are in valid range
- Error log shows handled exceptions
- README provides complete usage guide

### Phase 3: Additional Scrapers

**Goal**: Build scrapers for other data sources using reference implementation

**For each new scraper**:

- [ ] Create new directory: `src/mass-import/scraper/<source-name>/`
- [ ] Create scraper script: `src/mass-import/scraper/<source-name>/scraper.ts`
- [ ] Analyze source website structure
- [ ] Implement source-specific extraction logic
- [ ] Reuse utilities from framework
- [ ] Handle source-specific quirks (coordinate formats, pagination styles)
- [ ] Create README.md with source documentation
- [ ] Test with limited dataset
- [ ] Validate output quality
- [ ] Document last successful scrape

**Priority Sources** (in order):

1. Burnaby Art Gallery
2. Vancouver Public Art Registry
3. City of Richmond Public Art
4. TransLink Art Program
5. Additional sources as identified

### Phase 4: Scraper Testing & Refinement

**Goal**: Ensure all scrapers are robust and maintainable

**Tasks**:

- [ ] Create test suite for each scraper:
  - [ ] Mock HTTP responses for common scenarios
  - [ ] Test pagination handling
  - [ ] Test error recovery (404s, timeouts)
  - [ ] Test duplicate detection
  - [ ] Test coordinate conversion
  - [ ] Test data validation
- [ ] Run full scrapes for each source
- [ ] Validate output files against schema
- [ ] Check photo URL accessibility (sample 10%)
- [ ] Review error logs for patterns
- [ ] Optimize rate limiting (avoid being blocked)
- [ ] Update READMEs with findings
- [ ] Document maintenance schedule (how often to re-scrape)

**Success Criteria**:

- All scrapers complete full runs successfully
- Output files validate against schema
- Error rates < 5% of total items
- No IP blocks or rate limit violations
- Documentation is complete and accurate

## Implementation Guidelines

### Code Quality Standards

**TypeScript Best Practices**:

- Use strict mode
- Define interfaces for all data structures
- Use type guards for runtime validation
- Avoid `any` type (use `unknown` if necessary)
- Document complex logic with comments

**Error Handling**:

- Use try-catch for async operations
- Log all errors with context (URL, item ID)
- Include error type, message, and stack trace
- Don't crash on single item failures
- Continue processing after errors

**Logging Strategy**:

```typescript
// DEBUG: Request details, raw responses
logger.debug('Fetching page', { url, page: 2 });

// INFO: Progress and milestones
logger.info('Page complete', { itemsFound: 15, page: 2 });

// WARN: Missing optional data
logger.warn('Missing photos', { artworkId: 'abc123', title: 'Artwork' });

// ERROR: Failed requests, invalid data
logger.error('Request failed', { url, error: err.message });
```

**Rate Limiting Implementation**:

```typescript
// Add delay between requests with random jitter
const baseDelay = 1000; // 1 second
const jitter = Math.random() * 500; // 0-500ms
await sleep(baseDelay + jitter);

// Check for rate limit headers
if (response.headers['retry-after']) {
  const delay = parseInt(response.headers['retry-after']) * 1000;
  await sleep(delay);
}
```

### Data Validation Rules

**Required Fields (Artwork)**:

- `title` - must be non-empty string
- `coordinates` - must be valid lat/lon in decimal degrees
  - lat: -90 to 90
  - lon: -180 to 180
  - Reject (0, 0) as likely error
- `source` - must be valid domain
- `source_url` - must be valid URL

**Required Fields (Artist)**:

- `name` - must be non-empty string
- `source` - must be valid domain
- `source_url` - must be valid URL

**Optional Fields**:

- `description` - if present, should be Markdown string
- `photos` - if present, should be array of valid URLs
- `artwork_type` - if present, normalize to lowercase
- All other fields stored as-is in properties

**Data Completeness Calculation**:

```typescript
const expectedFields = ['title', 'description', 'artist', 'photos', 'artwork_type'];
const presentFields = expectedFields.filter(field => properties[field] != null);
const completeness = (presentFields.length / expectedFields.length) * 100;

// Add to properties
properties.data_completeness = `${completeness}%`;
```

### Testing Strategy

**Unit Tests** (for utilities):

- HTTP client retry logic
- Rate limiter timing
- Coordinate conversion accuracy
- Data validation rules
- Duplicate detection algorithm
- Output formatter (valid GeoJSON/JSON)

**Integration Tests** (for scrapers):

- Mock website responses (HTML/JSON)
- Test pagination following
- Test error recovery
- Test output file generation

**Manual Testing**:

- Run scraper with `--max-pages 2` flag
- Inspect output files manually
- Check photo URLs in browser
- Verify coordinates on map
- Review error logs

## Dependencies

### Required Packages

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "winston": "^3.11.0",
    "commander": "^11.1.0",
    "zod": "^3.22.4",
    "cheerio": "^1.0.0-rc.12"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

### Optional Packages (as needed)

- `proj4` - Advanced coordinate conversions (UTM, etc.)
- `puppeteer` or `playwright` - For JavaScript-heavy sites
- `csv-parser` - If scraping CSV data
- `xml2js` - If scraping XML/KML data

## Success Metrics

### Quality Metrics

- **Data Completeness**: >80% of items have all expected fields
- **Coordinate Accuracy**: 100% of coordinates in valid range
- **Photo URL Validity**: >95% of URLs return 200 status
- **Error Rate**: <5% of items skipped due to errors
- **Duplicate Rate**: <2% duplicates detected within scrape

### Performance Metrics

- **Scrape Speed**: 1-2 items per second (respecting rate limits)
- **Pagination Success**: 100% of pages followed successfully
- **Retry Success**: >90% of failed requests succeed on retry
- **Memory Usage**: <500MB for scrapes of 1000+ items

## Deliverables

### For Each Scraper

1. **Scraper Directory**: `src/mass-import/scraper/<source-name>/`
2. **TypeScript Script**: `src/mass-import/scraper/<source-name>/scraper.ts`
3. **README.md**: Complete documentation in scraper directory
4. **Output Files**: Sample GeoJSON and JSON files
5. **Error Log**: Sample error log from test run
6. **Test Results**: Unit test coverage report

### Shared Utilities

1. **Scraper Utils**: `src/mass-import/scraper/shared/`
2. **Type Definitions**: `src/mass-import/scraper/shared/types.ts`
3. **Test Suite**: `src/mass-import/scraper/shared/test/`
4. **Documentation**: `docs/scraper-development.md`

## Timeline Estimate

- **Phase 1** (Framework Setup): 2-3 days
- **Phase 2** (Reference Scraper): 2-3 days
- **Phase 3** (Additional Scrapers): 1-2 days per scraper
- **Phase 4** (Testing & Refinement): 2-3 days

**Total for 5 scrapers**: ~2 weeks

## Next Steps After Completion

Once scrapers are complete and tested:

1. **Generate sample data**: Run all scrapers to produce output files
2. **Proceed to Phase 2**: Develop Mass-Import Endpoint (see `plan-mass-import-endpoint.md`)
3. **Test integration**: Ensure scraper output format works with endpoint
4. **Document maintenance**: Create schedule for re-running scrapers

## Notes

- Scrapers should be **defensive**: handle errors gracefully, validate data, log issues
- Keep scrapers **simple**: focus on extraction, let CLI/API handle complex logic
- Make scrapers **maintainable**: good documentation, clear code, comprehensive logging
- Scrapers are **source-specific**: don't try to generalize too much, embrace quirks
- **Test incrementally**: start with small datasets, gradually increase scope

---

## Burnaby Art Gallery Scraper - Detailed Implementation Plan

### Overview

The Burnaby Art Gallery scraper will be the first reference implementation, extracting artwork and artist data from the Burnaby Art Gallery Public Art Registry.

### Source Information

- **Base URL**: `https://collections.burnabyartgallery.ca/`
- **Search URL**: `https://collections.burnabyartgallery.ca/list?q=&p=1&ps=200&sort=title_sort%20asc&src_facet=Public%20Art%20Registry`
- **Pagination**: Page parameter `p=1`, page size `ps=200`
- **Data Format**: HTML pages with embedded data

### Directory Structure

```
src/mass-import/scraper/burnaby-art-gallery/
├── scraper.ts              # Main scraper implementation
├── README.md               # Documentation
├── output/                 # Output directory
│   ├── artworks.geojson   # Generated artwork data
│   └── artists.json       # Generated artist data
└── test/                   # Tests
    └── scraper.test.ts
```

### Data Mapping

#### Artwork Fields

| Source Field | Target Field | Notes |
|-------------|--------------|-------|
| publicart{number} | `id` | Format: `burnabyartgallery/publicart{number}` |
| Permalink coordinates | `geometry.coordinates` | Extract from page, format: `[lon, lat]` |
| collections.burnabyartgallery.ca | `properties.source` | Static value |
| Permalink URL | `properties.source_url` | Example: `https://collections.burnabyartgallery.ca/link/publicart46` |
| Title | `properties.title` | Extract from page |
| Artist | `properties.artist` | Artist name(s) |
| Type | `properties.artwork_type` | Normalize to lowercase |
| Location | `properties.location` | Full location text |
| Date | `properties.start_date` | Year or date range |
| Description | `properties.description` | Full markdown description |
| Photo(s) | `properties.photos[]` | Array of photo URLs |

**Example Output**:

```json
{
  "type": "Feature",
  "id": "burnabyartgallery/publicart46",
  "geometry": {
    "type": "Point",
    "coordinates": [-122.915511, 49.278845]
  },
  "properties": {
    "source": "https://collections.burnabyartgallery.ca",
    "source_url": "https://collections.burnabyartgallery.ca/link/publicart46",
    "title": "Arc de Triomphe",
    "description": "The modular and abstracted aluminum form of Arc de Triomphe...",
    "artwork_type": "sculpture",
    "artist": "Jacques Huet",
    "location": "Simon Fraser University",
    "start_date": "1967",
    "photos": [
      "https://collections.burnabyartgallery.ca/media/..."
    ]
  }
}
```

#### Artist Fields

| Source Field | Target Field | Notes |
|-------------|--------------|-------|
| jacqueshuet{code} | `id` | Format: `burnabyartgallery/jacqueshuet{code}` |
| Artist name | `name` | From artist facet URL |
| collections.burnabyartgallery.ca | `properties.source` | Static value |
| Artist permalink | `properties.source_url` | Example: `https://collections.burnabyartgallery.ca/list?q=&objectType_facet=artist...` |
| Biography | `description` | Full biography text in Markdown |
| Birth Date | `properties.birth_date` | Year |
| Death Date | `properties.death_date` | Year (if applicable) |

**Example Output**:

```json
{
  "type": "Artist",
  "id": "burnabyartgallery/jacqueshuet000000",
  "name": "Jacques Huet",
  "description": "Jacques Huet was a self-taught Montreal sculptor...",
  "properties": {
    "source": "https://collections.burnabyartgallery.ca",
    "source_url": "https://collections.burnabyartgallery.ca/list?q=&objectType_facet=artist&artist_facet=jacqueshuet000000",
    "birth_date": "1932",
    "death_date": "2009"
  }
}
```

### Implementation Steps

#### Step 1: Setup Scraper Structure

```typescript
// src/mass-import/scraper/burnaby-art-gallery/scraper.ts
import { ScraperBase } from '../shared/scraper-base';
import { ArtworkFeature, ArtistRecord } from '../shared/types';
import { logger } from '../shared/logger';

export class BurnabyArtGalleryScraper extends ScraperBase {
  private readonly baseUrl = 'https://collections.burnabyartgallery.ca';
  private readonly searchUrl = `${this.baseUrl}/list`;
  
  constructor() {
    super('burnaby-art-gallery', '1.0.0');
  }
  
  async scrape(): Promise<void> {
    // Implementation
  }
}
```

#### Step 2: Implement Pagination

```typescript
async scrape(): Promise<void> {
  let page = 1;
  let hasMorePages = true;
  
  while (hasMorePages && (!this.maxPages || page <= this.maxPages)) {
    logger.info(`Fetching page ${page}`);
    
    const url = this.buildSearchUrl(page);
    const html = await this.fetchWithRetry(url);
    
    const artworkLinks = this.extractArtworkLinks(html);
    
    if (artworkLinks.length === 0) {
      hasMorePages = false;
      break;
    }
    
    for (const link of artworkLinks) {
      await this.scrapeArtwork(link);
      await this.rateLimiter.wait();
    }
    
    page++;
  }
}

private buildSearchUrl(page: number): string {
  return `${this.searchUrl}?q=&p=${page}&ps=200&sort=title_sort%20asc&src_facet=Public%20Art%20Registry`;
}
```

#### Step 3: Extract Artwork Links from List Page

```typescript
private extractArtworkLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  
  // Find all artwork links (adjust selector based on actual HTML)
  $('a[href*="/link/publicart"]').each((_, element) => {
    const href = $(element).attr('href');
    if (href) {
      const fullUrl = href.startsWith('http') 
        ? href 
        : `${this.baseUrl}${href}`;
      links.push(fullUrl);
    }
  });
  
  return [...new Set(links)]; // Remove duplicates
}
```

#### Step 4: Scrape Individual Artwork Page

```typescript
private async scrapeArtwork(url: string): Promise<void> {
  try {
    logger.debug(`Scraping artwork: ${url}`);
    
    const html = await this.fetchWithRetry(url);
    const $ = cheerio.load(html);
    
    // Extract ID from URL (e.g., publicart46)
    const match = url.match(/publicart(\d+)/);
    if (!match) {
      logger.error('Could not extract ID from URL', { url });
      return;
    }
    
    const id = `burnabyartgallery/publicart${match[1]}`;
    
    // Extract fields (adjust selectors based on actual HTML)
    const title = $('h1.artwork-title').text().trim();
    const artist = $('div.artist-name').text().trim();
    const type = $('div.artwork-type').text().trim().toLowerCase();
    const location = $('div.location').text().trim();
    const date = $('div.date').text().trim();
    const description = $('div.description').html() || '';
    
    // Extract coordinates (may need to parse from map embed or metadata)
    const coordinates = this.extractCoordinates($);
    
    if (!coordinates) {
      logger.warn('No coordinates found', { id, title });
      this.stats.failed++;
      return;
    }
    
    // Extract photo URLs
    const photos = this.extractPhotos($);
    
    // Create artwork feature
    const artwork: ArtworkFeature = {
      type: 'Feature',
      id,
      geometry: {
        type: 'Point',
        coordinates
      },
      properties: {
        source: this.baseUrl,
        source_url: url,
        title,
        description: this.convertToMarkdown(description),
        artwork_type: type,
        artist,
        location,
        start_date: date,
        photos
      }
    };
    
    // Validate
    if (this.validator.validate(artwork)) {
      this.artworks.push(artwork);
      this.stats.success++;
      
      // Track artist for later processing
      if (artist) {
        this.trackArtist(artist, $);
      }
    } else {
      logger.warn('Artwork validation failed', { id, title });
      this.stats.failed++;
    }
    
  } catch (error) {
    logger.error('Failed to scrape artwork', { url, error });
    this.stats.failed++;
  }
}
```

#### Step 5: Extract Coordinates

```typescript
private extractCoordinates($: cheerio.CheerioAPI): [number, number] | null {
  // Method 1: Look for embedded map coordinates
  const mapScript = $('script:contains("coordinates")').html();
  if (mapScript) {
    const match = mapScript.match(/coordinates\s*:\s*\[([^,]+),\s*([^\]]+)\]/);
    if (match) {
      const lon = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      if (this.validator.validateCoordinates(lat, lon)) {
        return [lon, lat];
      }
    }
  }
  
  // Method 2: Look for lat/lon in metadata
  const lat = parseFloat($('meta[property="geo.latitude"]').attr('content') || '');
  const lon = parseFloat($('meta[property="geo.longitude"]').attr('content') || '');
  
  if (this.validator.validateCoordinates(lat, lon)) {
    return [lon, lat];
  }
  
  // Method 3: Parse from text if coordinates are displayed
  // Add more extraction methods as needed
  
  return null;
}
```

#### Step 6: Extract Photo URLs

```typescript
private extractPhotos($: cheerio.CheerioAPI): string[] {
  const photos: string[] = [];
  
  // Find all image elements (adjust selector based on actual HTML)
  $('img.artwork-image, div.photo-gallery img').each((_, element) => {
    const src = $(element).attr('src') || $(element).attr('data-src');
    if (src && !src.includes('placeholder') && !src.includes('thumbnail')) {
      const fullUrl = src.startsWith('http') 
        ? src 
        : `${this.baseUrl}${src}`;
      photos.push(fullUrl);
    }
  });
  
  return [...new Set(photos)]; // Remove duplicates
}
```

#### Step 7: Scrape Artist Data

```typescript
private async scrapeArtist(artistName: string, artistUrl: string): Promise<void> {
  try {
    logger.debug(`Scraping artist: ${artistName}`);
    
    const html = await this.fetchWithRetry(artistUrl);
    const $ = cheerio.load(html);
    
    // Extract ID from URL
    const match = artistUrl.match(/artist_facet=([^|]+)/);
    if (!match) {
      logger.error('Could not extract artist ID from URL', { artistUrl });
      return;
    }
    
    const id = `burnabyartgallery/${match[1]}`;
    
    // Extract biography
    const biography = $('div.biography').html() || '';
    const birthDate = $('div.birth-date').text().trim();
    const deathDate = $('div.death-date').text().trim();
    
    // Create artist record
    const artist: ArtistRecord = {
      type: 'Artist',
      id,
      name: artistName,
      description: this.convertToMarkdown(biography),
      properties: {
        source: this.baseUrl,
        source_url: artistUrl,
        birth_date: birthDate || undefined,
        death_date: deathDate || undefined
      }
    };
    
    // Validate and add
    if (this.validator.validateArtist(artist)) {
      this.artists.push(artist);
    }
    
  } catch (error) {
    logger.error('Failed to scrape artist', { artistName, error });
  }
}
```

#### Step 8: CLI Interface

```typescript
// CLI entry point
import { program } from 'commander';
import { BurnabyArtGalleryScraper } from './scraper';

program
  .name('burnaby-art-gallery-scraper')
  .description('Scrape artwork and artist data from Burnaby Art Gallery')
  .option('-o, --output <directory>', 'Output directory', './output')
  .option('-m, --max-pages <number>', 'Maximum pages to scrape', parseInt)
  .option('-v, --verbose', 'Verbose logging')
  .action(async (options) => {
    const scraper = new BurnabyArtGalleryScraper();
    
    if (options.verbose) {
      // Set log level to DEBUG
    }
    
    if (options.maxPages) {
      scraper.setMaxPages(options.maxPages);
    }
    
    await scraper.run(options.output);
  });

program.parse();
```

### Testing Plan

#### Unit Tests

- [ ] Test URL building (pagination)
- [ ] Test coordinate extraction with mock HTML
- [ ] Test photo URL extraction with mock HTML
- [ ] Test data validation
- [ ] Test ID generation
- [ ] Test Markdown conversion

#### Integration Tests

- [ ] Test scraping single artwork page (real URL)
- [ ] Test scraping single artist page (real URL)
- [ ] Test pagination (limit to 2 pages)
- [ ] Test error handling (invalid URLs)

#### Manual Testing

- [ ] Run with `--max-pages 1` to test first page
- [ ] Verify output GeoJSON is valid
- [ ] Verify output JSON is valid
- [ ] Check coordinates on map
- [ ] Verify photo URLs load in browser
- [ ] Review error logs

### Expected Output

**artworks.geojson** (~150 artworks):

```json
{
  "type": "FeatureCollection",
  "metadata": {
    "scraper": "burnaby-art-gallery",
    "version": "1.0.0",
    "source": "https://collections.burnabyartgallery.ca",
    "scrapedAt": "2025-10-14T12:00:00Z",
    "totalItems": 150
  },
  "features": [...]
}
```

**artists.json** (~30-50 artists):

```json
{
  "metadata": {
    "scraper": "burnaby-art-gallery",
    "version": "1.0.0",
    "source": "https://collections.burnabyartgallery.ca",
    "scrapedAt": "2025-10-14T12:00:00Z",
    "totalItems": 45
  },
  "artists": [...]
}
```

### README.md Template

```markdown
# Burnaby Art Gallery Scraper

Scrapes artwork and artist data from the Burnaby Art Gallery Public Art Registry.

## Source

- **Website**: https://collections.burnabyartgallery.ca/
- **Data Source**: Public Art Registry
- **Data Format**: HTML pages

## Usage

```bash
# Scrape all pages
npm run scraper:burnaby

# Scrape first 2 pages only
npm run scraper:burnaby -- --max-pages 2

# Verbose logging
npm run scraper:burnaby -- --verbose

# Custom output directory
npm run scraper:burnaby -- --output ./custom-output
```

## Output

- `output/artworks.geojson` - GeoJSON FeatureCollection of artworks
- `output/artists.json` - JSON array of artists

## Data Fields

### Artwork
- Title, Artist, Type, Location, Date
- Coordinates (lat/lon)
- Description (Markdown)
- Photo URLs

### Artist
- Name, Biography (Markdown)
- Birth Date, Death Date

## Known Limitations

- Coordinates may not be available for all artworks
- Some artworks may have incomplete data
- Photo quality varies

## Last Successful Scrape

- **Date**: 2025-10-14
- **Artworks**: 150
- **Artists**: 45
- **Errors**: 3 (missing coordinates)

## Maintenance Notes

- Page structure stable as of October 2025
- Pagination uses `p` parameter
- Page size set to 200 items (`ps=200`)
```

### Success Criteria

- [ ] Scraper completes without crashing
- [ ] Output files are valid GeoJSON and JSON
- [ ] >95% of artworks have coordinates
- [ ] >90% of artworks have photos
- [ ] All photo URLs return 200 status (sample check)
- [ ] Artist data extracted for all unique artists
- [ ] Error log shows handled exceptions only
- [ ] README provides complete documentation
