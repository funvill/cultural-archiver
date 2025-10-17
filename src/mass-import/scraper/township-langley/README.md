# Township of Langley Public Art Scraper

Source: <https://www.tol.ca/en/arts-culture/public-art.aspx>

This scraper parses the single public art page which lists artworks in accordion sections by community/artist. Each expanded section contains a table with rows for artworks and columns:

1. Images/addresses (image link + title + park/location + street address)
2. Artist name
3. Year installed
4. Project (artwork type)
5. Description (multiple paragraphs)

## Fields extracted

- name (title)
- artist_name
- start_date (year installed)
- artwork_type (Project column)
- description (concatenated paragraphs)
- photos (external image URLs from first-column anchor links)
- image (first photo)
- addr:full (park + street address + city)
- source (<https://www.tol.ca/en/arts-culture/public-art.aspx>)
- source_url (page URL with section anchor when available)

Coordinates are obtained via geocoding the addr:full using the shared LocationService cache/Nominatim.

## Usage

- Test with a small limit:

  npx tsx src/mass-import/scraper/township-langley/cli.ts --limit 3 --output ./output --verbose

- Full scrape:

  npx tsx src/mass-import/scraper/township-langley/cli.ts --output ./output

## Notes / Limitations

- The page is static HTML with tables; there are no per-artwork detail pages. The source_url includes a section anchor for context.
- Photos are taken from anchor hrefs in the first cell that end with .jpg/.jpeg/.png. If the site changes file extensions or structure, update include logic.
- Geocoding may occasionally fail; such artworks will have [0,0] coordinates. Address strings combine park and street address from the table.
- There are currently 21 artworks visible on the page; this scraper will parse all rows detected in artwork tables.
