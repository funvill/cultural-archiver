# Task Plan: Data Collector - Burnaby Art Gallery

## Overview

This plan outlines the implementation of a web scraper to collect public artwork data from the Burnaby Art Gallery website and convert it to GeoJSON format compatible with the existing mass import system. The script will be the first in a series of data collectors and should serve as a template for future implementations.

**Target Output**: 114 artwork records + associated artist files  
**Location**: `src/lib/data-collection/burnabyartgallery/`  
**Dependencies**: Zero external dependencies (Node.js built-in modules only)

## Relevant Files

### Files to Create

- `src/lib/data-collection/burnabyartgallery/index.ts` - Main scraper entry point
- `src/lib/data-collection/burnabyartgallery/config.json` - Configuration parameters (URLs, paths, delays)
- `src/lib/data-collection/burnabyartgallery/lib/scraper.ts` - Core scraping logic using built-in fetch
- `src/lib/data-collection/burnabyartgallery/lib/parser.ts` - HTML parsing without external dependencies
- `src/lib/data-collection/burnabyartgallery/lib/mapper.ts` - Data transformation to GeoJSON
- `src/lib/data-collection/burnabyartgallery/lib/artist-handler.ts` - Artist data collection and deduplication
- `src/lib/data-collection/burnabyartgallery/lib/logger.ts` - Verbose logging system
- `src/lib/data-collection/burnabyartgallery/output/.gitkeep` - Output directory placeholder
- `src/lib/data-collection/burnabyartgallery/README.md` - Documentation and usage instructions

### Reference Files (Existing)

- `src/lib/data-collection/osm/fetch-osm-artworks.js` - Reference implementation for data collection
- `src/lib/mass-import-system/importers/osm.ts` - Reference for GeoJSON structure
- `src/lib/mass-import-system/importers/vancouver.ts` - Reference for data mapping patterns
- `scripts/osm-import.js` - Reference for CLI tool patterns

## Tasks

- [ ] 1.0 Project Setup and Configuration
  - [ ] 1.1 Create directory structure at `src/lib/data-collection/burnabyartgallery/`
  - [ ] 1.2 Create `config.json` with configurable parameters (base URL, output paths, rate limiting delay, pagination settings)
  - [ ] 1.3 Create `output/` directory for storing generated files
  - [ ] 1.4 Create README.md with project overview, usage instructions, and expected output format
  - [ ] 1.5 Set up TypeScript configuration to match existing mass-import-system patterns

- [ ] 2.0 Core HTTP Client and Rate Limiting
  - [ ] 2.1 Implement HTTP client using Node.js built-in `fetch` (similar to `fetch-osm-artworks.js`)
  - [ ] 2.2 Add configurable delay between requests (default: 250ms as per Q&A #29)
  - [ ] 2.3 Implement retry logic with exponential backoff for failed requests
  - [ ] 2.4 Add request/response logging for debugging purposes
  - [ ] 2.5 Implement User-Agent header to identify the scraper

- [ ] 3.0 HTML Parsing Without External Dependencies
  - [ ] 3.1 Research and implement HTML parsing using built-in Node.js modules or regex patterns
  - [ ] 3.2 Create utility functions to extract text content from HTML tags
  - [ ] 3.3 Create utility functions to extract attribute values (src, href) from HTML elements
  - [ ] 3.4 Add error handling for malformed HTML or missing elements
  - [ ] 3.5 Implement coordinate extraction from embedded maps or structured data

- [ ] 4.0 Artwork Index Page Scraping
  - [ ] 4.1 Implement pagination discovery by parsing the artwork index page (detect total pages/records)
  - [ ] 4.2 Extract artwork detail page URLs from each paginated index page
  - [ ] 4.3 Handle the `?p=1&ps=200&src_facet=Public%20Art%20Registry` pagination pattern
  - [ ] 4.4 Collect all 114 artwork URLs before processing (as per Q&A #28)
  - [ ] 4.5 Log progress: "Found X artworks across Y pages"

- [ ] 5.0 Artwork Detail Page Scraping
  - [ ] 5.1 Extract artwork title from detail pages
  - [ ] 5.2 Extract coordinates (lat/lon) - exclude artworks without coordinates (Q&A #24)
  - [ ] 5.3 Extract "about" field and rename to "description" in output (Q&A #25)
  - [ ] 5.4 Extract artwork metadata: date, medium, technique, dimensions, location
  - [ ] 5.5 Extract keywords (store as comma-separated string, Q&A #30)
  - [ ] 5.6 Extract artwork_type (default to "unknown" if not found, Q&A #36)
  - [ ] 5.7 Extract photo URLs including query parameters (Q&A #39)
  - [ ] 5.8 Extract artist links for later processing
  - [ ] 5.9 Generate GeoJSON feature ID from URL (e.g., `node/publicart46` from `.../link/publicart46`)

- [ ] 6.0 Artist Data Collection
  - [ ] 6.1 Collect all unique artist URLs from artwork pages
  - [ ] 6.2 Scrape artist detail pages for name, biography, birth/death dates, websites
  - [ ] 6.3 Store exact source URLs including faceting parameters (Q&A #27)
  - [ ] 6.4 Handle empty biographies as empty strings (Q&A #35)
  - [ ] 6.5 Deduplicate artists - create single JSON file per unique artist (Q&A #11)
  - [ ] 6.6 Store all artists in single `artists.json` file (Q&A #23)

- [ ] 7.0 Data Transformation to GeoJSON
  - [ ] 7.1 Map artwork data to GeoJSON Feature format following the example structure
  - [ ] 7.2 Ensure all features have hardcoded source: "https://burnabyartgallery.ca" (Q&A #37)
  - [ ] 7.3 Add source_url pointing to the specific artwork page (Q&A #19)
  - [ ] 7.4 Transform coordinates to GeoJSON Point geometry `[lon, lat]` format
  - [ ] 7.5 Store dates exactly as presented on website (handle ranges and "c. YYYY", Q&A #31)
  - [ ] 7.6 Store artist names exactly as shown (preserve "Last, First" format, Q&A #32)
  - [ ] 7.7 Ensure UTF-8 character encoding throughout (Q&A #38)

- [ ] 8.0 Output File Generation
  - [ ] 8.1 Generate `artworks.geojson` with all valid artwork features (Q&A #22)
  - [ ] 8.2 Generate `artists.json` with all unique artist data (Q&A #23)
  - [ ] 8.3 Implement versioning for incremental runs (e.g., `artworks_v2.geojson`, Q&A #26)
  - [ ] 8.4 Write files to `src/lib/data-collection/burnabyartgallery/output/`
  - [ ] 8.5 Ensure files are valid JSON/GeoJSON and pass format validation

- [ ] 9.0 Logging and Error Handling
  - [ ] 9.1 Implement verbose debug-level logging for every action (Q&A #13)
  - [ ] 9.2 Log warnings for missing fields (artwork without medium, artist, etc., Q&A #4)
  - [ ] 9.3 Log warnings for excluded artworks (missing coordinates, Q&A #24)
  - [ ] 9.4 Track and log HTTP errors with source URLs
  - [ ] 9.5 Generate final summary report: total artworks found, total artists, files written, execution time (Q&A #40)

- [ ] 10.0 Script Entry Point and Execution
  - [ ] 10.1 Create main `index.ts` entry point with command-line argument parsing
  - [ ] 10.2 Load configuration from `config.json` (Q&A #14)
  - [ ] 10.3 Implement execution workflow: fetch index → collect URLs → scrape details → generate output
  - [ ] 10.4 Add execution instructions to README (e.g., `npx tsx src/lib/data-collection/burnabyartgallery/index.ts`)
  - [ ] 10.5 Handle graceful shutdown and cleanup on errors

- [ ] 11.0 Testing and Validation
  - [ ] 11.1 Perform dry run to validate script execution without errors
  - [ ] 11.2 Verify exactly 114 artwork records are collected (Q&A #2)
  - [ ] 11.3 Validate GeoJSON output format matches the provided example
  - [ ] 11.4 Validate artist JSON output format matches the provided example
  - [ ] 11.5 Test that output files pass mass import system validation (Q&A #7)
  - [ ] 11.6 Verify all source_url fields point to correct pages
  - [ ] 11.7 Check for character encoding issues (accents, special characters)
  - [ ] 11.8 Validate coordinate accuracy by spot-checking several artworks

- [ ] 12.0 Documentation and Reusability
  - [ ] 12.1 Document the scraping workflow and data flow in README
  - [ ] 12.2 Add inline code comments explaining key logic (especially HTML parsing)
  - [ ] 12.3 Document known limitations and website dependencies (Q&A #16)
  - [ ] 12.4 Create modular code structure that can serve as template for future collectors (Q&A #5, #15)
  - [ ] 12.5 Document configuration parameters in config.json with comments

## Notes

### Technical Constraints

- **Zero External Dependencies**: Must use only Node.js built-in modules (Q&A #12). HTML parsing will require creative solutions using regex or string manipulation.
- **Rate Limiting**: Implement 250ms delay between requests to be respectful of the gallery's server (Q&A #29).
- **Error Handling**: Missing fields should be omitted from JSON but logged as warnings (Q&A #4).
- **Exact Field Matching**: Output format must strictly match examples for mass import compatibility (Q&A #9).

### Data Quality Requirements

- **Accuracy Over Speed**: Prioritize data completeness and accuracy (Q&A #6).
- **Coordinate Validation**: Artworks without coordinates must be excluded and logged (Q&A #24).
- **UTF-8 Encoding**: Ensure proper handling of special characters (Q&A #38).
- **Source Attribution**: Every record must include accurate source_url (Q&A #19).

### Success Criteria

- Script produces valid `artworks.geojson` with exactly 114 features (Q&A #7)
- Script produces valid `artists.json` with all unique artists
- Output files pass mass import system validation
- Execution completes without fatal errors
- All data fields are accurately mapped from source

### Future Considerations

- This script is intentionally designed for the Burnaby Art Gallery only (Q&A #20)
- The modular architecture should enable easier creation of future collectors (Q&A #15)
- Website structure changes will require script updates - no automatic adaptation (Q&A #16)
- Execution is manual/local only - no automation or UI planned (Q&A #18, #20)

### Execution Instructions (Once Complete)

```powershell
# Navigate to project root
cd c:\Users\funvill\Documents\git\cultural-archiver

# Run the data collector
npx tsx src/lib/data-collection/burnabyartgallery/index.ts

# Output files will be in:
# src/lib/data-collection/burnabyartgallery/output/artworks.geojson
# src/lib/data-collection/burnabyartgallery/output/artists.json
```

### Integration with Mass Import System

After generating the output files, they can be imported using the existing mass import system:

```powershell
# Import artworks (future integration)
npx tsx src/lib/mass-import-system/cli/index.ts import --importer burnabyartgallery src/lib/data-collection/burnabyartgallery/output/artworks.geojson
```

Note: A new importer for Burnaby Art Gallery format may need to be created in `src/lib/mass-import-system/importers/` if the GeoJSON structure differs significantly from the OSM format.
