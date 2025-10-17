# Maple Ridge Public Art Scraper

Scrapes public art installations from the City of Maple Ridge website.

## Source

- **Website**: https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art
- **Example Artwork**: https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art/maple-ridge-community-mosaic

## Features

- ✅ Paginated listing with multiple artworks per page (currently scrapes first page only)
- ✅ Metadata extracted from `.field` elements with `.field__label` and `.field__item`
- ✅ Multiple photos per artwork (3 images found on example page)
- ✅ Artist names in format: "Rebecca Bayer and David Gregory (SpaceMakePlace Design)"
- ✅ Dates extracted from `<time datetime>` elements
- ✅ Addresses geocoded to GPS coordinates using LocationService with Nominatim
- ✅ Outputs OSM-compatible GeoJSON format directly

## Data Structure

### Metadata Fields Extracted

- **Artist Name**: `field__label` = "Artist Name" (comma-separated string)
  - Parsed into individual artists array
  - Example: "A Kalman, A Plavan, A Waite" → `["A Kalman", "A Plavan", "A Waite"]`
- **Project Status**: "Completed", "Current", "Planned"
- **Art Project Type**: "Installation", "Mural", "Other"
- **Location**: Location name (e.g., "Maple Ridge Leisure Centre")
- **Address**: Full street address with postal code
- **Date**: ISO datetime format (e.g., "2020-01-31T12:00:00Z")

### Photos

Photos are extracted from `<article>` images, filtering out:
- OpenStreetMap map tiles (`tile.openstreetmap.org`)
- Leaflet markers (`leaflet`, `marker-`)

Example page had 3 artwork photos:
1. Main artwork photo
2. Work-in-progress photo
3. Artist photo

### OSM Properties

The scraper outputs OSM-compatible properties with separate metadata fields:

```typescript
{
  "@id": "https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art/maple-ridge-community-mosaic",
  "tourism": "artwork",
  "name": "Maple Ridge Community Mosaic",
  "artist_name": "Rebecca Bayer, David Gregory",
  "artists": ["Rebecca Bayer", "David Gregory"],
  "image": "https://www.mapleridge.ca/sites/default/files/styles/wysiwyg_image/public/2024-08/02%20Z1b%20DSC_1282_Website_Default_%28All_Uses%29%28Original_Resolution%29_6000x3374.JPG?itok=4adBInp3",
  "photos": ["photo1.jpg", "photo2.jpg", "photo3.jpg"],
  "addr:full": "11925 Haney Place, Maple Ridge, BC, V2X 6G2",
  "start_date": "2020",
  "description": "Hand painted ceramic tiles...",
  "notes": "Spacemakeplace Design is the art and design studio...",
  "status": "Completed",
  "artwork_type": "Installation",
  "location": "Maple Ridge Leisure Centre"
}
```

**Artist Handling:**
- `artist_name`: Original comma-separated string from website
- `artists`: Parsed array of individual artist names
- Each artist is tracked separately and saved to the artists JSON file

## Geocoding

- Addresses are geocoded using Nominatim (OpenStreetMap)
- Results are cached in SQLite database (`src/lib/location/cache.db`)
- Cache prevents redundant API calls for same addresses
- Falls back to `[0, 0]` coordinates if geocoding fails
- Respects 1 request/second rate limit

## Usage

### Basic Scraping

```bash
# Scrape all artworks from first page
npx tsx src/mass-import/scraper/mapleridge-ca/cli.ts --output ./output --verbose

# Limit to 5 artworks
npx tsx src/mass-import/scraper/mapleridge-ca/cli.ts --output ./output --limit 5 --verbose
```

### Output Files

The scraper generates:

1. **`mapleridge-ca-artworks.geojson`** - GeoJSON FeatureCollection with all artworks
2. **`mapleridge-ca-artists.json`** - Artist records with metadata
3. **`mapleridge-ca-artists-flat.json`** - Flat array of artists (legacy format)

### Import to Database

```bash
# Import using OSM artwork importer
npx tsx src/mass-import/cli/cli-entry.ts import \
  --importer osm-artwork \
  --exporter api \
  --input ./output/mapleridge-ca-artworks.geojson \
  --config src/mass-import/config/api-config-dev-v3.json \
  --verbose
```

## Pagination Support

The scraper currently processes only the first page of results. Pagination is detected via:

```html
<nav class="pagination">
  <a rel="next" href="?page=1">Next page</a>
</nav>
```

To implement full pagination:
1. Check for `nav.pagination a[rel="next"]`
2. Extract next page URL
3. Recursively fetch and scrape additional pages
4. Combine results before returning

## HTML Structure Notes

The Maple Ridge website uses Drupal with specific class patterns:

### Listing Page
```html
<article>
  <h3><a href="/parks-recreation/arts-theatre/public-art/artwork-slug">Artwork Title</a></h3>
  <div class="field__label">Address:</div>
  <div class="field__item">23000 116 Avenue, Maple Ridge, BC, V2X 0T8</div>
</article>
```

### Detail Page
```html
<h1>Maple Ridge Community Mosaic</h1>

<div class="field field--name-field-name field--type-string field--label-inline">
  <div class="field__label">Artist Name</div>
  <div class="field__item">Rebecca Bayer and David Gregory (SpaceMakePlace Design)</div>
</div>

<div class="field field--name-field-publication-date field--type-datetime field--label-hidden field__item">
  <time datetime="2020-01-31T12:00:00Z" class="datetime">January 31, 2020</time>
</div>

<div class="field field--name-field-address field--type-string-long field--label-inline">
  <div class="field__label">Address</div>
  <div class="field__item">11925 Haney Place, Maple Ridge, BC, V2X 6G2</div>
</div>

<h2>About the Artists: Rebecca Bayer and David Gregory</h2>
<p>Spacemakeplace Design is the art and design studio...</p>
```

## Example Data

From "Maple Ridge Community Mosaic":

- **URL**: https://www.mapleridge.ca/parks-recreation/arts-theatre/public-art/maple-ridge-community-mosaic
- **Title**: Maple Ridge Community Mosaic
- **Artists**: Rebecca Bayer and David Gregory (SpaceMakePlace Design)
- **Status**: Completed
- **Type**: Installation
- **Date**: January 31, 2020
- **Location**: Maple Ridge Leisure Centre
- **Address**: 11925 Haney Place, Maple Ridge, BC, V2X 6G2
- **Photos**: 3 images
- **Geocoded**: [Nominatim API result for address]

## Lessons Learned

1. **OSM Format Required**: Output must be OSM-compatible GeoJSON from the start
2. **Geocoding Essential**: Addresses must be geocoded to GPS coordinates
3. **Photo Arrays**: Include both `image` (first photo) and `photos` (full array)
4. **Field Extraction**: Use `.field__label` and `.field__item` pattern for metadata
5. **Artist Bio**: Found in `<h2>About the Artists:</h2>` section
6. **Description**: First paragraph in `.field--name-field-row-content`

## Statistics

- **Total Artworks**: 10+ (first page only, pagination present)
- **Total Artists**: Varies (parsed from comma-separated lists)
  - Example: "Action Park Poetry and Art" has 9 individual artists
- **Geocoding Success**: Depends on address quality
- **Photo Coverage**: All artworks have at least 1 photo
- **Artist Data**: Individual artists tracked separately, bios when available
