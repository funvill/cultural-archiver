# Surrey Public Art Scraper

Scrapes public art data from the City of Surrey's public art collection.

## Data Source

**Base URL:** https://www.surrey.ca/arts-culture/public-art/

**Collection Page:** https://www.surrey.ca/arts-culture/public-art/permanent-public-art-collection

## Website Structure

### Index Page

The main collection page lists all artworks with links in a left sidebar navigation. Each artwork has:
- Title (link text)
- URL pattern: `/arts-culture/public-art/permanent-public-art-collection/[artwork-slug]`

The page displays artworks grouped by neighborhood sections (City Centre, Cloverdale, Fleetwood, Guildford, Newton, South Surrey, Whalley).

### Artwork Detail Pages

Each artwork page contains:

**Metadata (in paragraph after image):**
- **Artists:** Artist name(s)
- **Location:** Text description (e.g., "City Centre 2 (9639 137A Street)")
- **Category:** e.g., "Private collection"
- **Developer:** Development company name
- **Year Installed:** Installation year

**Content Sections:**
- Main description paragraph (first paragraph after images)
- "About [Artwork Title]" section with artwork description
- "About the Artist" section with artist biography
- Photo gallery with multiple images

**Photos:**
- Multiple images in a list
- High-resolution versions available
- Captions provided

## Data Extraction Strategy

### 1. List Page Scraping

Extract all artwork links from the left sidebar navigation `<nav>` element. All artwork links follow the pattern starting with `/arts-culture/public-art/permanent-public-art-collection/`.

### 2. Detail Page Scraping

**Metadata Fields:**
- Parse the paragraph containing "Artists:", "Location:", etc.
- Extract each field by finding the `<strong>` tag and getting text after it

**Artist:**
- Extract from "Artists:" or "Artist:" field
- May contain multiple artists separated by " and " or ", "

**Location:**
- Text description from "Location:" field
- May include street address in parentheses
- No GPS coordinates available on page - will need geocoding

**Photos:**
- Extract from image list at bottom of page
- Get high-resolution versions from links
- Include captions as metadata

**Description:**
- Combine text from:
  1. First paragraph (short description)
  2. "About [Artwork Title]" section
  3. "About the Artist" section for artist bio

**Year:**
- Extract from "Year Installed:" field
- Format as 4-digit year

**Category:**
- Extract from "Category:" field (e.g., "Private collection")

### 3. ID Generation

Use URL slug as ID: `surrey-ca/[slug]`

Example:
- URL: `https://www.surrey.ca/arts-culture/public-art/permanent-public-art-collection/abstract-mountains`
- ID: `surrey-ca/abstract-mountains`

## Special Considerations

1. **GPS Coordinates via Geocoding:** Location data on the website is text-only (e.g., "City Centre 2 (9639 137A Street)"). The scraper automatically:
   - Extracts street addresses from parentheses
   - Uses the LocationService to geocode addresses to GPS coordinates
   - Appends ", Surrey, BC, Canada" to improve geocoding accuracy
   - Caches geocoding results in SQLite for performance
   - Falls back to `[0, 0]` coordinates if geocoding fails or location is missing

   Example transformation:
   - Input: "3rd Floor Reception Area at City Hall (13450 104 Ave)"
   - Extracted: "13450 104 Ave"
   - Geocoded: `[-122.849229, 49.191354]` (Surrey City Hall)

2. **Multiple Artists:** Many artworks have multiple artists. Parse artist names carefully, handling:
   - " and " separator
   - ", " separator  
   - Different formats like "Artist1 and Artist2" or "Artist1, Artist2, & Artist3"

3. **Artist Bio Location:** The artist biography is in a separate "About the Artist" heading section. This should be stored as artist metadata, not artwork description.

## Geocoding Performance

- **First Run**: ~1 second per address (Nominatim API rate limit)
- **Subsequent Runs**: < 10ms per address (SQLite cache)
- **Cache Location**: `_data/location-cache.sqlite`
- **Cache Strategy**: Stores geocoded results by address query string
- **Error Handling**: Logs warnings for failed geocoding, continues processing

See `docs/location-geocoding.md` for details on the geocoding system.

4. **Developer Field:** Some artworks include developer information (private collections). This is unique to Surrey.

5. **Category Field:** Artworks are categorized (e.g., "Private collection"). Store this as metadata.

## Known Issues

- No geocoding coordinates on page - addresses need to be geocoded separately
- Some URLs may redirect or be updated over time
- Image URLs may change - scrape current versions

## Testing

Test with limited artworks first:

```bash
npx tsx src/mass-import/scraper/surrey-ca/cli.ts --limit 5 --output ./src/mass-import/scraper/output
```

## Full Scrape

```bash
npx tsx src/mass-import/scraper/surrey-ca/cli.ts --output ./src/mass-import/scraper/output
```
