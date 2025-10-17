# Richmond, BC Public Art Scraper

Scrapes artwork and artist data from the City of Richmond, BC Public Art Registry.

## Source

- **Website**: <https://www.richmond.ca/culture/howartworks/publicart/collection/>
- **Data Source**: Public Art Registry
- **Data Format**: ASP.NET web application with embedded data
- **Total Artworks**: 382 (as of October 2025)

## Installation

```bash
# Install dependencies
npm install

# Build the scraper
npm run build
```

## Usage

```bash
# Scrape all artworks (default output: ./src/mass-import/scraper/output/)
npx tsx src/mass-import/scraper/richmond-ca/cli.ts --output ./src/mass-import/scraper/output

# Scrape first 5 artworks only (for testing)
npx tsx src/mass-import/scraper/richmond-ca/cli.ts --limit 5 --output ./src/mass-import/scraper/output

# Enable verbose logging
npx tsx src/mass-import/scraper/richmond-ca/cli.ts --verbose --output ./src/mass-import/scraper/output

# Custom output directory
npx tsx src/mass-import/scraper/richmond-ca/cli.ts --output ./custom-output

# Combine options (test with first 3 artworks, verbose output)
npx tsx src/mass-import/scraper/richmond-ca/cli.ts \
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

The scraper generates three files in the output directory:

### richmond-ca-artworks.geojson

GeoJSON FeatureCollection containing artwork data:

- `id` - Unique identifier (e.g., `richmond-ca-569`)
- `geometry.coordinates` - Location as `[longitude, latitude]`
- `properties.title` - Artwork title (cleaned, year removed)
- `properties.description` - Artwork description with "Description of Work" and "Artist Statement" sections (Markdown)
- `properties.artists` - Array of artist names
- `properties.location` - Street address
- `properties.start_date` - Installation year
- `properties.material` - Materials used
- `properties.owner` - Ownership (e.g., "Private", "City of Richmond")
- `properties.category` - Program type (e.g., "Private", "Public")
- `properties.keywords` - Array containing area/neighborhood (e.g., ["Hamilton", "City Centre"])
- `properties.photos` - Array of photo URLs
- `properties.sponsored_by` - Sponsor name (if applicable)
- `properties.source` - Source domain (`richmond.ca`)
- `properties.source_url` - Original artwork page URL

### richmond-ca-artists.json

JSON collection containing artist data with metadata wrapper:

```json
{
  "metadata": {
    "scraper": "richmond-ca",
    "version": "1.0.0",
    "source": "https://www.richmond.ca",
    "scrapedAt": "2025-10-15T...",
    "totalItems": 123
  },
  "artists": [
    {
      "type": "Artist",
      "id": "richmond-ca-artist-164",
      "name": "Nancy Chew",
      "properties": {
        "source": "https://www.richmond.ca",
        "source_url": "https://www.richmond.ca/culture/howartworks/publicart/collection/Artist.aspx?ID=164",
        "location": "Vancouver, Canada",
        "bio": "Biography text..."
      }
    }
  ]
}
```

### richmond-ca-artists-flat.json

Flat array of artist records (for legacy CLI compatibility):

```json
[
  {
    "type": "Artist",
    "id": "richmond-ca-artist-164",
    "name": "Nancy Chew",
    "properties": { ... }
  }
]
```

## Data Fields

### Extracted Artwork Fields

- ✅ Title (required) - From `<h1>` element
- ✅ Coordinates (required) - Extracted from `LocationsMap.aspx?x=...&y=...` links
- ✅ Artists - Multiple artists supported, extracted from `Artist.aspx?ID=...` links
- ✅ Location - Street address
- ✅ Area/Neighborhood - Added to keywords array
- ✅ Installation Year - Extracted from title (e.g., "(2020)")
- ✅ Materials - From "Materials:" field
- ✅ Description - Combined "Description of Work" and "Artist Statement" sections
- ✅ Photos - From carousel images
- ✅ Program - Public/Private classification
- ✅ Ownership - Owner information
- ✅ Sponsor - Sponsored by field

### Extracted Artist Fields

- ✅ Name (required)
- ✅ Biography - From "Biography" section
- ✅ Location - City/country (e.g., "Vancouver, Canada")
- ✅ Source URL - Link to artist page
- ✅ Artwork List - Available on artist page but not extracted

## Website Structure

### Search Results Page

**URL Pattern**: `https://www.richmond.ca/culture/howartworks/publicart/collection/Search.aspx`

**Artwork Cards**:

```html
<a href="PublicArt.aspx?ID=569">(Coyote) koyo-te, through the bog</a>
```

**Pagination**: ASP.NET postback mechanism (not yet implemented)

### Artwork Detail Page

**URL Pattern**: `https://www.richmond.ca/culture/howartworks/publicart/collection/PublicArt.aspx?ID=569`

**Key Elements**:

- `<h1>` - Title with year: "(Coyote) koyo-te, through the bog (2020)"
- `<a href="Artist.aspx?ID=164">Artist Name</a>` - Artist links
- `<a href="LocationsMap.aspx?x=-122.966809&y=49.177886">Address</a>` - Coordinates
- `<strong>Area:</strong>` - Neighborhood
- `<strong>Materials:</strong>` - Material description
- `<strong>Program:</strong>` - Program type
- `<strong>Ownership:</strong>` - Owner
- `<strong>Sponsored By:</strong>` - Sponsor
- `<h2>Description of Work</h2>` - Description section
- `<h2>Artist Statement</h2>` - Artist statement section
- `<region role="carousel">` - Photo carousel

### Artist Page

**URL Pattern**: `https://www.richmond.ca/culture/howartworks/publicart/collection/Artist.aspx?ID=164`

**Key Elements**:

- `<h1>` - Artist name
- Location text (e.g., "Vancouver, Canada")
- `<h2>Biography</h2>` - Biography section
- `<h2>Artwork List</h2>` - List of artworks by artist

## Implementation Notes

### Coordinates Extraction

Richmond uses a unique URL format for coordinates:

```text
LocationsMap.aspx?X=-122.966809&Y=49.177886
```

The scraper handles both uppercase (X, Y) and lowercase (x, y) parameters.

### Title Cleaning

Artwork titles include the year in parentheses at the end:

```text
(Coyote) koyo-te, through the bog (2020)
```

The scraper:

1. Extracts the year using regex: `/\((\d{4})\)\s*$/`
2. Removes the year from the title
3. Stores the year in `start_date`

### Multiple Artists

Many artworks have multiple artists (collaborative works). The scraper:

1. Finds all `<a href="Artist.aspx?ID=...">` links
2. Creates an array of artist names in `properties.artists`
3. Tracks each artist separately for detailed scraping

### Description Format

The scraper combines two sections into Markdown:

```markdown
**Description of Work**

[Description paragraphs...]

**Artist Statement**

[Statement paragraphs...]
```

### ASP.NET Pagination

⚠️ **Current Limitation**: The scraper only processes page 1 of search results (12 artworks per page).

Richmond uses ASP.NET postback for pagination with `__doPostBack()` JavaScript calls. Full pagination support requires:

1. Extracting ViewState and EventValidation hidden fields
2. Making POST requests with proper form data
3. Maintaining session state across requests

**Current Behavior**: Scrapes all artwork links found on the first page, which shows 12 of 382 total artworks. Use `--limit` to control testing.

## Rate Limiting

- **Default Rate**: 1.5 seconds between requests
- **Jitter**: Random 0-500ms additional delay
- **Retry Logic**: Automatic exponential backoff on failures

This follows best practices for web scraping and respects the server.

## Testing

```bash
# Test with first 3 artworks
npx tsx src/mass-import/scraper/richmond-ca/cli.ts --limit 3 --verbose --output ./test

# Validate output
cat ./test/richmond-ca-artworks.geojson | jq '.features | length'
cat ./test/richmond-ca-artists.json | jq '.artists | length'
```

## Integration with Mass Import System

```bash
# Import scraped data to development API
npx tsx src/mass-import/cli/cli-entry.ts import \
  --importer richmond-ca \
  --exporter api \
  --input src/mass-import/scraper/output/richmond-ca-artworks.geojson \
  --config src/mass-import/config/api-config-dev-v3.json \
  --verbose
```

## Known Issues

1. **Pagination Not Implemented**: Only first search results page is scraped
2. **Photo URLs**: Some images may be relative URLs that need proper resolution
3. **Location Text**: Sometimes contains additional text beyond address

## Future Improvements

- [ ] Implement ASP.NET postback pagination to scrape all 382 artworks
- [ ] Add support for filtering by area/neighborhood
- [ ] Extract additional metadata if available
- [ ] Improve photo URL validation and resolution
- [ ] Add retry logic for artist detail scraping failures

## Changelog

### Version 1.0.0 (October 2025)

- Initial implementation
- Scrapes artwork details from detail pages
- Extracts artist information with biographies
- Generates GeoJSON and JSON output files
- Supports rate limiting and retry logic
- CLI with verbose logging and limit options
