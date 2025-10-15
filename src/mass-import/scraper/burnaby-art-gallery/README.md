# Burnaby Art Gallery Scraper

Scrapes artwork and artist data from the Burnaby Art Gallery Public Art Registry.

## Source

- **Website**: <https://collections.burnabyartgallery.ca/>
- **Data Source**: Public Art Registry
- **Data Format**: HTML pages with embedded data

## Installation

```bash
# Install dependencies
npm install

# Build the scraper
npm run build
```

## Usage

```bash
# Scrape all pages (default output: ./output/)
tsx src/mass-import/scraper/burnaby-art-gallery/cli.ts

# Scrape first 2 pages only (for testing)
tsx src/mass-import/scraper/burnaby-art-gallery/cli.ts --max-pages 2

# Scrape only first 5 artworks (for testing)
tsx src/mass-import/scraper/burnaby-art-gallery/cli.ts --limit 5

# Enable verbose logging
tsx src/mass-import/scraper/burnaby-art-gallery/cli.ts --verbose

# Custom output directory
tsx src/mass-import/scraper/burnaby-art-gallery/cli.ts --output ./custom-output

# Combine options (test with first 3 artworks, verbose output)
tsx src/mass-import/scraper/burnaby-art-gallery/cli.ts \
  --limit 3 \
  --verbose \
  --output ./test-output
```

## CLI Options

- `-o, --output <directory>` - Output directory for generated files (default: `./output`)
- `-m, --max-pages <number>` - Maximum pages to scrape (useful for testing)
- `-l, --limit <number>` - Maximum artworks to scrape (useful for testing and debugging)
- `-v, --verbose` - Enable verbose logging (DEBUG level)
- `-V, --version` - Display version number
- `-h, --help` - Display help information

## Output Files

The scraper generates two files in the output directory:

### burnaby-art-gallery-artworks.geojson

GeoJSON FeatureCollection containing artwork data:

- `id` - Unique identifier (e.g., `burnabyartgallery/publicart46`)
- `geometry.coordinates` - Location as `[longitude, latitude]`
- `properties.title` - Artwork title
- `properties.description` - Artwork description (Markdown)
- `properties.artwork_type` - Type (e.g., `sculpture`, `mural`)
- `properties.artist` - Artist name(s)
- `properties.location` - Location description
- `properties.start_date` - Creation date/year
- `properties.photos` - Array of photo URLs
- `properties.medium` - Comma-separated materials (e.g., "aluminum, concrete")
- `properties.technique` - Comma-separated techniques (e.g., "metal fabrication, concrete installation")
- `properties.dimensions` - Physical dimensions (if available)
- `properties.keywords` - Array of keywords/topics/tags
- `properties.owner` - Artwork owner (e.g., SFU Art Collection)
- `properties.category` - Category classification
- `properties.accession_number` - Accession/catalog number
- `properties.source` - Source domain
- `properties.source_url` - Original artwork page URL

### burnaby-art-gallery-artists.json

JSON collection containing artist data:

- `id` - Unique identifier (e.g., `burnabyartgallery/jacqueshuet`)
- `name` - Artist name
- `biography` - Biography (Markdown)
- `properties.source` - Source domain
- `properties.source_url` - Original artist page URL
- `properties.birth_date` - Birth year (if available)
- `properties.death_date` - Death year (if available)
- `properties.website` - Primary website URL (if available)
- `properties.websites` - Array of website URLs (if available)

## Data Fields

### Extracted Artwork Fields

- Title ✅ (required)
- Artist ✅
- Type/Medium ✅
- Location ✅
- Date ✅
- Coordinates ✅ (required)
- Description ✅
- Photo URLs ✅
- Medium (materials) ✅
- Technique ✅
- Dimensions ✅
- Keywords/Topics ✅
- Owner ✅
- Category ✅
- Accession Number ✅

### Extracted Artist Fields

- Name ✅ (required)
- Biography ✅
- Birth Date ✅
- Death Date ✅
- Websites ⚠️ (when available)
- Death Date ⚠️ (when available)

## Known Limitations

- Coordinates extraction depends on page structure (may need manual verification)
- Some artworks may have incomplete data
- Photo quality and availability varies
- Artist biographical data may be limited
- The scraper uses generic CSS selectors that may need adjustment if the website structure changes

## Technical Details

### Dependencies

- `cheerio` - HTML parsing
- `commander` - CLI argument parsing
- TypeScript for type safety

### Features

- **Retry Logic**: Exponential backoff with 3 retry attempts
- **Rate Limiting**: 1.5s + random jitter (0-500ms) between requests
- **Duplicate Detection**: Within-scrape deduplication based on ID
- **Error Handling**: Graceful error handling with detailed logging
- **Validation**: Coordinate and URL validation
- **Markdown Conversion**: HTML to Markdown for descriptions

### Pagination

- Scrapes 200 items per page (`ps=200`)
- Auto-detects end of pagination
- Page number parameter: `p=1`, `p=2`, etc.

## Development

### Run Tests

```bash
npm test
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Last Successful Scrape

- **Date**: October 15, 2025
- **Artworks**: 3 (test run with --limit 3)
- **Artists**: 3
- **Errors**: 0
- **Status**: ✅ All artwork fields extracting correctly (title, description, artist, type, location, date, coordinates, photos, medium, technique, dimensions, keywords, owner, category, accession_number)
- **Artist Details**: ✅ Biography, birth_date, death_date extracting correctly. Websites extraction implemented but dependent on data availability.

## Maintenance Notes

- Page structure verified as of October 2025
- Pagination stable (uses `p` parameter with `ps=200`)
- Coordinate extraction may need updates if website changes map implementation
- Monitor for changes to CSS class names and HTML structure

## Troubleshooting

### No coordinates found

The scraper attempts multiple methods to extract coordinates:

1. Embedded map data in JavaScript
2. Meta tags (`geo:latitude`, `geo:longitude`)
3. Coordinates in page text

If coordinates are missing, manually inspect the source page and update the `extractCoordinates()` method.

### Empty output files

- Check if the website structure has changed
- Run with `--verbose` to see detailed logs
- Try `--max-pages 1` to test with minimal data
- Verify the source URL is accessible

### Rate limiting or blocking

- Increase rate limit delay in scraper configuration
- Check if User-Agent needs updating
- Verify website's `robots.txt` for crawling restrictions

## Example Output

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
  "features": [
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
        "description": "The modular and abstracted aluminum form...",
        "artwork_type": "sculpture",
        "artist": "Jacques Huet",
        "location": "Simon Fraser University",
        "start_date": "1967",
        "photos": [
          "https://collections.burnabyartgallery.ca/media/..."
        ]
      }
    }
  ]
}
```

## Contributing

When updating this scraper:

1. Test with `--max-pages 1` first
2. Verify output file format
3. Check coordinates on a map
4. Update "Last Successful Scrape" section
5. Document any changes to extraction logic

## License

MIT
