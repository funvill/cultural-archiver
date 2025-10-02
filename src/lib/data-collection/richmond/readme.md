# Richmond Public Art Data Collection Plan

## Overview

This data collector scrapes public art information from the City of Richmond's Public Art Registry.

**Source:** https://www.richmond.ca/culture/howartworks/publicart/collection/

## Site Structure Analysis

### Index Page Structure
- **URL:** `https://www.richmond.ca/culture/howartworks/publicart/collection/Search.aspx`
- **Total artworks:** 381 results (as of inspection)
- **Results per page:** 12 artworks
- **Pagination:** Numbered pages (32 total pages) + First/Last links
- **Pagination type:** JavaScript postback (`__doPostBack`)

### Index Page - Artwork Card Format
Each artwork card contains:
```html
<div class="result-item">
  <div class="year">"2020"</div>
  <div class="result-content">
    <h2><a href="PublicArt.aspx?ID=569">(Coyote) koyo-te, through the bog</a></h2>
    <div>
      <p><i class="icon-artist"></i>
        <a href="Artist.aspx?ID=164">Nancy Chew</a>,
        <a href="Artist.aspx?ID=230">Jacqueline Metz</a>
      </p>
      <p><i class="icon-location"></i>Hamilton</p>
      <p><i class="icon-address"></i>
        <a href="LocationsMap.aspx?X=-122.966809&Y=49.177886">23100 Garripie Ave</a>
      </p>
    </div>
  </div>
</div>
```

**Key observations:**
- ID is in URL: `PublicArt.aspx?ID=569`
- GPS coordinates are embedded in address link: `LocationsMap.aspx?X=-122.966809&Y=49.177886`
- Multiple artists per artwork (comma-separated links)
- Area/neighbourhood in location field
- Year displayed prominently

### Artwork Detail Page Structure
- **URL pattern:** `PublicArt.aspx?ID={id}`
- **Example:** `https://www.richmond.ca/culture/howartworks/publicart/collection/PublicArt.aspx?ID=569`

**Available fields:**
```
- Title: In <h1> tag
- Artists: Links to Artist.aspx?ID={artistId}
- Address: Link with GPS in URL params (X and Y)
- Area: e.g., "Hamilton", "City Centre", "Steveston"
- Location: Additional location details (e.g., "In front of development")
- Year: From index page
- Photos: Carousel with images (may be multiple)
- Materials: e.g., "Pre-cast concrete: Ductal UHPC and Bronze with black patina"
- Program: Public/Private
- Ownership: Public/Private
- Sponsored By: Organization name
- Description of Work: Full paragraph
- Artist Statement: Full paragraph
```

**Special cases:**
- Some artworks marked "(No longer on display.)"
- Some have multiple photos in carousel
- Some have no GPS coordinates (just address text)

### Artist Detail Page Structure
- **URL pattern:** `Artist.aspx?ID={id}`
- **Example:** `https://www.richmond.ca/culture/howartworks/publicart/collection/Artist.aspx?ID=164`

**Available fields:**
```
- Name: In <h1> tag
- Location: e.g., "Vancouver, Canada"
- Biography: Full paragraph with collaborative details
- Artwork List: Grid of artworks by this artist
```

## Pagination Strategy

Richmond uses **JavaScript postback pagination** which requires special handling:

### Approach 1: Direct URL Construction (Preferred)
The site uses ASP.NET ViewState and postback. We need to:
1. Fetch the first page
2. Extract ViewState and other form fields
3. POST to the same URL with pagination parameters

### Approach 2: Static Page Range (Fallback)
Since we know there are 32 pages with 12 results each:
1. Calculate total pages from "Showing 1 to 12 of 381 results"
2. Iterate through pages 1-32
3. Use POST requests with proper form data

**Note:** The pagination uses ASP.NET's `__doPostBack` JavaScript function, which means we need to simulate form submissions.

## Implementation Plan

### Phase 1: Basic Scraper Setup ✓
- [x] Create project structure
- [x] Create config.json with base settings
- [x] Implement WebScraper with POST support for pagination
- [x] Add delay and retry logic

### Phase 2: Index Page Parsing
- [ ] Parse results count from "Showing 1 to 12 of 381 results"
- [ ] Extract artwork cards from index page
- [ ] Extract ID from PublicArt.aspx?ID={id}
- [ ] Extract GPS coordinates from LocationsMap.aspx?X={lon}&Y={lat}
- [ ] Extract artist links (multiple per artwork)
- [ ] Extract year, area, address
- [ ] Handle pagination with ViewState extraction

### Phase 3: Artwork Detail Parsing
- [ ] Parse title from <h1>
- [ ] Parse address and location details
- [ ] Parse area/neighbourhood
- [ ] Parse materials
- [ ] Parse program type (Public/Private)
- [ ] Parse ownership
- [ ] Parse sponsor
- [ ] Parse description sections (Description of Work + Artist Statement)
- [ ] Extract photo URLs from carousel
- [ ] Handle "(No longer on display.)" status

### Phase 4: Artist Detail Parsing
- [ ] Parse artist name
- [ ] Parse artist location
- [ ] Parse biography
- [ ] Deduplicate artists by ID

### Phase 5: Data Mapping
- [ ] Map to GeoJSON format
- [ ] Handle missing coordinates (log warning)
- [ ] Map artist relationships
- [ ] Include all metadata in properties

### Phase 6: Testing & Validation
- [ ] Test with --limit=5
- [ ] Verify coordinate extraction
- [ ] Verify multi-artist handling
- [ ] Verify pagination across all 32 pages
- [ ] Validate final count (381 artworks)

## Technical Challenges

### 1. ASP.NET ViewState Pagination
**Challenge:** The site uses `__doPostBack` for pagination, requiring ViewState preservation.

**Solution:**
```typescript
// Extract ViewState fields from HTML
const viewStateMatch = html.match(/name="__VIEWSTATE" value="([^"]+)"/);
const viewStateGeneratorMatch = html.match(/name="__VIEWSTATEGENERATOR" value="([^"]+)"/);
const eventValidationMatch = html.match(/name="__EVENTVALIDATION" value="([^"]+)"/);

// POST with form data
const formData = new URLSearchParams({
  '__VIEWSTATE': viewState,
  '__VIEWSTATEGENERATOR': viewStateGenerator,
  '__EVENTVALIDATION': eventValidation,
  '__EVENTTARGET': 'ctl00$main$rptPager$ctl{pageNumber}$btnPage',
  '__EVENTARGUMENT': ''
});
```

### 2. GPS Coordinate Extraction
**Challenge:** Coordinates are in the address link URL, not in the page content.

**Solution:**
```typescript
// Extract from: LocationsMap.aspx?X=-122.966809&Y=49.177886
const coordPattern = /LocationsMap\.aspx\?[Xx]=(-?\d+\.\d+)&[Yy]=(-?\d+\.\d+)/;
const match = html.match(coordPattern);
if (match) {
  coordinates = { lon: parseFloat(match[1]), lat: parseFloat(match[2]) };
}
```

### 3. Multiple Artists Per Artwork
**Challenge:** Artworks can have multiple collaborating artists.

**Solution:**
- Extract all artist links with regex: `/<a[^>]*href=["']Artist\.aspx\?ID=(\d+)["'][^>]*>([^<]+)<\/a>/g`
- Store array of artist IDs and names
- Fetch each unique artist detail page

### 4. Photo Carousel
**Challenge:** Photos are in a carousel structure with varying counts.

**Solution:**
```typescript
// Extract all images from carousel region
const carouselPattern = /<region[^>]*class=["'][^"']*carousel[^"']*["'][^>]*>([\s\S]*?)<\/region>/i;
const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/g;
```

## Output Format

### artworks.geojson
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "richmond-569",
      "geometry": {
        "type": "Point",
        "coordinates": [-122.966809, 49.177886]
      },
      "properties": {
        "title": "(Coyote) koyo-te, through the bog",
        "artistNames": ["Nancy Chew", "Jacqueline Metz"],
        "artistIds": ["richmond-artist-164", "richmond-artist-230"],
        "year": "2020",
        "address": "23100 Garripie Ave",
        "area": "Hamilton",
        "location": "In front of development.",
        "materials": "Pre-cast concrete: Ductal UHPC and Bronze with black patina",
        "program": "Private",
        "ownership": "Private",
        "sponsor": "Oris Consulting Ltd.",
        "description": "A finely detailed plinth suggests packing crates...",
        "photos": ["https://..."],
        "status": "permanent",
        "sourceUrl": "https://www.richmond.ca/culture/howartworks/publicart/collection/PublicArt.aspx?ID=569",
        "source": "City of Richmond Public Art Registry"
      }
    }
  ]
}
```

### artists.json
```json
[
  {
    "id": "richmond-artist-164",
    "name": "Nancy Chew",
    "location": "Vancouver, Canada",
    "biography": "Jacqueline Metz and Nancy Chew are visual artists...",
    "sourceUrl": "https://www.richmond.ca/culture/howartworks/publicart/collection/Artist.aspx?ID=164"
  }
]
```

## Testing Strategy

1. **Development Run:** `npx tsx src/lib/data-collection/richmond/index.ts --limit=5`
   - Test first 5 artworks
   - Verify GPS extraction
   - Verify multi-artist handling
   - Check photo extraction

2. **Pagination Test:** `npx tsx src/lib/data-collection/richmond/index.ts --limit=25`
   - Test across page boundary (page 1 + page 2)
   - Verify ViewState handling

3. **Full Run:** `npx tsx src/lib/data-collection/richmond/index.ts`
   - Process all 381 artworks
   - Verify final count
   - Check for missing coordinates

## Expected Results

- **Artworks:** 381 total
- **Artists:** ~200-300 unique artists (estimated)
- **Photos:** Multiple per artwork (carousel)
- **Coordinates:** Most artworks should have GPS (some may be missing)
- **Processing time:** ~5-10 minutes (500ms delay between requests)

## Dependencies

- Node.js built-in modules only (fs, path, https)
- No external parsing libraries (regex-based)
- TypeScript with ES modules

## Notes

- The site serves HTML rendered server-side (ASP.NET)
- Rate limiting: 500ms between requests (configurable)
- User-Agent spoofing recommended
- Some artworks marked as removed/no longer on display
- GPS coordinates must be extracted from map link URL, not page content
