# Burnaby Art Gallery Data Collector

A web scraper designed to collect public artwork data from the Burnaby Art Gallery website and convert it to GeoJSON format compatible with the Cultural Archiver mass import system.

## Overview

This data collector scrapes artwork information from the [Burnaby Art Gallery Public Art Registry](https://collections.burnabyartgallery.ca/list?q=&p=1&ps=200&sort=title_sort%20asc&src_facet=Public%20Art%20Registry) and outputs structured GeoJSON files for import into the Cultural Archiver platform.

**Expected Output**: 114 public artwork records + associated artist information

## Features

- ✅ Zero external dependencies (uses only Node.js built-in modules)
- ✅ Rate-limited requests (250ms delay between requests)
- ✅ Automatic retry logic with exponential backoff
- ✅ Verbose debug logging
- ✅ Coordinate validation (excludes artworks without coordinates)
- ✅ Artist deduplication
- ✅ GeoJSON format output compatible with mass import system

## Directory Structure

```
src/lib/data-collection/burnabyartgallery/
├── index.ts                 # Main entry point
├── config.json              # Configuration parameters
├── README.md                # This file
├── lib/
│   ├── scraper.ts          # HTTP client and scraping logic
│   ├── parser.ts           # HTML parsing utilities
│   ├── mapper.ts           # Data transformation to GeoJSON
│   ├── artist-handler.ts   # Artist data collection and deduplication
│   └── logger.ts           # Verbose logging system
└── output/                  # Generated output files
    ├── artworks.geojson    # All artwork features
    └── artists.json        # All unique artists
```

## Usage

### Running the Data Collector

```powershell
# Navigate to project root
cd c:\Users\funvill\Documents\git\cultural-archiver

# Run the data collector
npx tsx src/lib/data-collection/burnabyartgallery/index.ts

# Output files will be generated in:
# src/lib/data-collection/burnabyartgallery/output/artworks.geojson
# src/lib/data-collection/burnabyartgallery/output/artists.json
```

### Configuration

Edit `config.json` to customize:

- **Rate Limiting**: `delayBetweenRequestsMs` (default: 250ms)
- **Retry Behavior**: `maxRetries`, `retryBackoffBaseMs`
- **Output Paths**: `output.directory`, file names
- **Pagination**: Start page and results per page

## Output Format

### Artwork GeoJSON

Each artwork is a GeoJSON `Feature` with the following structure:

```json
{
  "type": "Feature",
  "id": "node/publicart46",
  "geometry": {
    "type": "Point",
    "coordinates": [-122.915511, 49.278845]
  },
  "properties": {
    "source": "https://burnabyartgallery.ca",
    "source_url": "https://collections.burnabyartgallery.ca/link/publicart46",
    "name": "Arc de Triomphe",
    "artwork_type": "sculpture",
    "location": "Simon Fraser University",
    "date": "1967",
    "medium": "aluminum, concrete",
    "technique": "metal fabrication, concrete installation",
    "dimensions": "",
    "keywords": "public art,architecture,France,SFU",
    "owner": "SFU Art Collection",
    "category": "SFU Art Collection",
    "accession number": "NA",
    "collection": "Public Art Registry",
    "description": "The modular and abstracted aluminum form...",
    "photos": ["https://collections.burnabyartgallery.ca/media/..."]
  }
}
```

### Artist JSON

Artists are stored in a single JSON file with deduplication:

```json
{
  "source": "https://burnabyartgallery.ca",
  "source_url": "https://collections.burnabyartgallery.ca/list?...",
  "name": "Fafard, Joe",
  "type": "Artist",
  "biography": "Nationally and internationally acclaimed artist...",
  "birth date": "1942",
  "death date": "2019",
  "websites": "www.joefafard.com"
}
```

## Data Collection Process

1. **Fetch Artwork Index** - Scrape paginated list of all artworks
2. **Collect URLs** - Extract all artwork detail page URLs (expect 114)
3. **Scrape Artwork Details** - Extract metadata, coordinates, photos, artist links
4. **Scrape Artist Pages** - Collect unique artist information
5. **Transform Data** - Convert to GeoJSON format
6. **Generate Output** - Write `artworks.geojson` and `artists.json`

## Known Limitations

- **Website Dependent**: Changes to the Burnaby Art Gallery website structure will require script updates
- **No Automation**: Designed for manual execution on local machine
- **Single Source**: Only works with Burnaby Art Gallery (by design)
- **Coordinate Required**: Artworks without coordinates are excluded from output

## Integration with Mass Import System

The generated GeoJSON file is compatible with the OSM-artwork importer. After generating the output files, import them using:

### Step 1: Collect Data

```powershell
# Run the data collector to scrape and generate GeoJSON
npx tsx src/lib/data-collection/burnabyartgallery/index.ts

# Optional: Limit to first 10 records for testing
npx tsx src/lib/data-collection/burnabyartgallery/index.ts --limit=10
```

### Step 2: Import to Development Server

**Prerequisites:**
- Development server must be running (`npm run dev`)
- Database should be initialized

```powershell
# Import all artworks with location enhancement enabled
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import \
  --importer osm-artwork \
  --exporter api \
  --input src/lib/data-collection/burnabyartgallery/output/artworks.geojson \
  --config src/lib/mass-import-system/api-config-dev.json \
  --location-enhancement \
  --generate-report \
  --batch-size 10

# Import with limit for testing (first 10 records)
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import \
  --importer osm-artwork \
  --exporter api \
  --input src/lib/data-collection/burnabyartgallery/output/artworks.geojson \
  --config src/lib/mass-import-system/api-config-dev.json \
  --location-enhancement \
  --limit 10 \
  --batch-size 10 \
  --max-consecutive-errors 3 \
  --generate-report
```

### Step 3: Import to Production Server

```powershell
# Production import (use with caution!)
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import \
  --importer osm-artwork \
  --exporter api \
  --input src/lib/data-collection/burnabyartgallery/output/artworks.geojson \
  --config src/lib/mass-import-system/api-config-production.json \
  --location-enhancement \
  --generate-report \
  --batch-size 10
```

### Import Options Explained

- `--importer osm-artwork` - Uses OpenStreetMap/GeoJSON importer (compatible with Burnaby output)
- `--exporter api` - Exports to API endpoint (local dev server or production)
- `--input <path>` - Path to generated artworks.geojson file
- `--config <path>` - API configuration file (api-config-dev.json or api-config-production.json)
- `--location-enhancement` - Enables location enrichment (adds location_display_name, location_country, location_state, location_city, location_suburb, location_neighbourhood tags)
- `--location-cache <path>` - Path to location cache database (default: ./_data/location-cache.sqlite)
- `--limit <number>` - Process only first N records (useful for testing)
- `--batch-size <number>` - Number of records to process per batch (default: 50)
- `--max-consecutive-errors <number>` - Abort after N consecutive batch failures (default: 5)
- `--generate-report` - Create JSON report of import results in ./reports/ directory
- `--dry-run` - Validate data without actually importing

### What Location Enhancement Does

When `--location-enhancement` is enabled, the system:

1. Checks the location cache database first (instant lookup)
2. Falls back to Nominatim reverse geocoding API if not cached
3. Adds these tags to each artwork:
   - `location_display_name` - Full human-readable address
   - `location_country` - Country name
   - `location_state` - Province/state name
   - `location_city` - City name
   - `location_suburb` - Suburb/district name
   - `location_neighbourhood` - Neighbourhood name

This provides better search and filtering capabilities in the application.

## Troubleshooting

### Common Issues

**HTTP Errors**: Increase retry delay in `config.json`  
**Incomplete Data**: Check verbose logs for warnings about missing fields  
**Wrong Record Count**: Verify pagination settings and website structure  
**Character Encoding**: Output files use UTF-8 encoding

### Verbose Logging

The script produces detailed debug logs showing:
- Each HTTP request and response
- Data extraction for each field
- Warnings for missing or invalid data
- Final summary with counts and execution time

## Technical Details

### Zero Dependencies

This script uses only Node.js built-in modules:
- `node:fetch` for HTTP requests
- `node:fs` for file operations
- `node:path` for path handling
- Native string manipulation for HTML parsing (no cheerio/jsdom)

### Rate Limiting

Implements respectful scraping practices:
- 250ms delay between requests (configurable)
- Exponential backoff on failures
- Proper User-Agent identification

### Data Validation

- Coordinates validated (must be present and valid)
- UTF-8 encoding ensured throughout
- GeoJSON format validation
- Artist deduplication by URL

## Maintenance

This script is maintained by the original developer. Future updates or bug fixes will be required if the Burnaby Art Gallery website changes its structure.

## License

Part of the Cultural Archiver project.
