# New Westminster Public Art Registry Scraper

Scrapes public art data from the [New Westminster Public Art Registry](https://www.newwestcity.ca/public-art-registry).

## Data Source

- **Website**: https://www.newwestcity.ca/public-art-registry
- **Scraper Name**: `new-west-city`
- **Owner**: City of New Westminster
- **Location**: New Westminster, British Columbia, Canada

## Features

- Extracts artwork details from individual artwork pages
- Supports pagination (multiple pages of results)
- Extracts artist information and biographies
- Rate limiting to avoid overwhelming the server
- Retry logic for failed requests
- CLI interface with options for output directory, page limits, and artwork limits

## Installation

```bash
# Install dependencies (from project root)
npm install
```

## Usage

### Basic Usage

```bash
# Scrape all artworks
npx tsx src/mass-import/scraper/new-west-city/cli.ts

# Scrape with custom output directory
npx tsx src/mass-import/scraper/new-west-city/cli.ts --output ./my-output

# Scrape only first page
npx tsx src/mass-import/scraper/new-west-city/cli.ts --max-pages 1

# Scrape only 5 artworks (useful for testing)
npx tsx src/mass-import/scraper/new-west-city/cli.ts --limit 5

# Enable verbose logging
npx tsx src/mass-import/scraper/new-west-city/cli.ts --verbose
```

### CLI Options

- `--output <path>` - Output directory (default: `./output`)
- `--max-pages <number>` - Maximum number of pages to scrape
- `--limit <number>` - Maximum number of artworks to scrape
- `--verbose` - Enable verbose logging

## Output Files

The scraper generates two files in the output directory:

### new-west-city-artworks.geojson

GeoJSON FeatureCollection containing artwork data with the following properties:

**Artwork Properties:**
- `id` - Unique identifier (format: `newwestcity/{slug}`)
- `title` - Artwork title
- `description` - Combined text from "About the Artwork", "Artist Statement", and "Background" sections
- `artist` - Artist name(s)
- `artwork_type` - Type of artwork (e.g., "Installation", "Mural", "Sculpture")
- `location` - Location description (neighbourhood + address)
- `start_date` - Installation year
- `end_date` - Removal year (for temporary artworks, empty if permanent)
- `photos` - Array of photo URLs
- `medium` - Primary materials (comma-separated string)
- `technique` - Not available (empty string)
- `dimensions` - Not available (empty string)
- `keywords` - Not available (empty array)
- `owner` - Always "City of New Westminster"
- `category` - Neighbourhood name
- `accession_number` - Not available (empty string)
- `source_url` - Original page URL

**Geometry:**
- `type` - Always "Point"
- `coordinates` - `[longitude, latitude]` (currently `[0, 0]` - geocoding not implemented)

### new-west-city-artists.json

JSON collection containing artist data with the following properties:

**Artist Properties:**
- `id` - Unique identifier (format: `newwestcity/{artist-slug}`)
- `name` - Artist full name
- `biography` - Artist biography from "About the Artist" section
- `birth_date` - Not available (empty string)
- `death_date` - Not available (empty string)
- `website` - Artist website URL (from "More About the Artist" link)
- `websites` - Array of website URLs
- `source_urls` - Array of artwork page URLs featuring this artist

## Data Extraction Details

### Page Structure

The New Westminster Public Art Registry uses a simple HTML structure:

1. **List Page**: `/public-art-registry` with pagination links
2. **Detail Pages**: `/public-art/{slug}.php` (e.g., `/public-art/foreshore.php`)

### Metadata Extraction

Metadata is extracted from labeled divs in the "Artwork details" section:
- Neighbourhood
- Installation year
- Removal year (optional, for temporary artworks)
- Status (e.g., "Temporary", "Permanent")
- Type (e.g., "Installation", "Mural")
- Primary materials
- Address

### Description Extraction

The description is built from multiple sections in order:
1. "About the Artwork" - Main artwork description
2. "Artist Statement" - Artist's statement about the work
3. "Background" - Additional context and history

Sections are separated by `---` dividers.

### Artist Information Extraction

Artist information is extracted from:
- Artist name: Displayed div before "Artwork details"
- Biography: "About the Artist" section content
- Website: "More About the Artist" link

### Photo Extraction

Photos are extracted from `<img>` tags on the page, filtering out:
- Logos and icons
- Banner images
- Non-artwork images

Only images with `/public-art/` in the path are included.

## Known Limitations

1. **Coordinates**: Geocoding from addresses is not implemented. All coordinates are set to `[0, 0]`. Future enhancement could add geocoding via Google Maps or OpenStreetMap API.

2. **Missing Fields**: The following fields are not available on the New Westminster website:
   - `technique` - Empty string
   - `dimensions` - Empty string
   - `keywords` - Empty array
   - `accession_number` - Empty string
   - `birth_date` (artist) - Empty string
   - `death_date` (artist) - Empty string

3. **Artist Details**: Artist information is only available when included on the artwork page. No separate artist detail pages exist.

4. **Pagination**: The pagination URL pattern may change. Currently uses:
   - Page 1: `/public-art-registry`
   - Page 2+: `/public-art-registry/main/557/site_art_installations/page{N}.php`

## Rate Limiting

The scraper implements rate limiting to be respectful of the server:
- Base delay: 1.5 seconds between requests
- Random jitter: 0-500ms additional delay
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)

## Error Handling

- Individual artwork failures are logged but don't stop the scraper
- Failed HTTP requests are retried up to 3 times
- Validation warnings are logged but don't prevent data collection
- Duplicate artworks (by ID) are skipped

## Examples

### Test Run

```bash
# Scrape just 2 artworks to test the scraper
npx tsx src/mass-import/scraper/new-west-city/cli.ts --limit 2 --output ./test-output
```

### Production Run

```bash
# Scrape all artworks with verbose logging
npx tsx src/mass-import/scraper/new-west-city/cli.ts --output ./production-data --verbose
```

## Development

### Testing Changes

Use the `--limit` option to test changes quickly:

```bash
npx tsx src/mass-import/scraper/new-west-city/cli.ts --limit 1 --verbose
```

### Debugging

Enable verbose logging to see detailed extraction information:

```bash
npx tsx src/mass-import/scraper/new-west-city/cli.ts --limit 3 --verbose
```

## Integration

This scraper is part of the Mass Import System v3. See the parent documentation for information about:
- Running multiple scrapers
- Importing data into the API
- Deduplication strategies
- Data validation

## License

Part of the Cultural Archiver project. See main project LICENSE file.
