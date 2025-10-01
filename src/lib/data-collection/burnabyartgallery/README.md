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

After generating the output files, import them using the mass import system:

```powershell
# Future integration (requires creating a Burnaby Art Gallery importer)
npx tsx src/lib/mass-import-system/cli/index.ts import --importer burnabyartgallery src/lib/data-collection/burnabyartgallery/output/artworks.geojson
```

Note: A new importer may need to be created in `src/lib/mass-import-system/importers/burnabyartgallery.ts` if the GeoJSON structure differs from existing importers.

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
